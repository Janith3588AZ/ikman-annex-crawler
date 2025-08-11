// CRAWLERS.GS ගොනුවේ සම්පූර්ණ අන්තර්ගතයම මෙම කේතයෙන් ආදේශ කරන්න

const URL_PREFIX_AD = "https://ikman.lk/en/ad/";

// --- MAJOR REVISION: Added content-based duplicate filtering AFTER AI check ---
function crawlAndNotify() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = readConfig();
  const sourceUrl = (config['Source_URL'] || [])[0];

  if (!sourceUrl) {
    Logger.log('Source_URL not found in Config sheet. Aborting.');
    return;
  }
  
  const rentalsSheet = ss.getSheetByName('Rentals');
  const rejectedSheet = ss.getSheetByName('Rejected');
  const failuresSheet = ss.getSheetByName('Failures');
  
  // URL-based duplicate check
  const existingUrls = new Set([
      ...rentalsSheet.getRange('C2:C').getValues().flat(),
      ...rejectedSheet.getRange('C2:C').getValues().flat(),
      ...failuresSheet.getRange('C2:C').getValues().flat()
  ].filter(String));
  
  // --- NEW: For content-based duplicate check ---
  const existingDescriptions = rentalsSheet.getRange('D2:D').getValues().flat().filter(String);
  
  let newAdsToProcess = [];

  const data = extractJsonData(sourceUrl);
  if (!data || !data.serp || !data.serp.ads) {
     Logger.log(`Could not fetch or parse data from URL: ${sourceUrl}`);
     return;
  }

  const ads = data.serp.ads.data.ads;

  // Step 1: Fetch all new ads based on URL
  for (const ad of ads) {
    const adUrl = `${URL_PREFIX_AD}${ad.slug}`;
    if (!existingUrls.has(adUrl)) {
      const adDetails = getAdDetails(adUrl);
      const description = adDetails ? adDetails.description : "Description not found.";
      newAdsToProcess.push({
        title: ad.title,
        price: ad.price.replace('Rs', '').trim(),
        url: adUrl,
        description: description,
        dateAdded: new Date()
      });
      existingUrls.add(adUrl);
    }
  }
  
  if (newAdsToProcess.length === 0) {
      Logger.log('No new ads found by URL.');
      return;
  }
  
  // Step 2: AI Filtering
  let aiAcceptedAds = [];
  let aiRejectedAds = [];
  let failedAds = [];

  for(const ad of newAdsToProcess) {
      const aiResponse = getAiFilterDecision(ad.title, ad.description);
      Logger.log(`Ad: "${ad.title}", AI Decision: ${aiResponse.decision}`);
      
      ad.aiDecision = aiResponse.decision;

      switch(aiResponse.decision) {
        case 'ACCEPT':
          aiAcceptedAds.push(ad);
          break;
        case 'REJECT':
          aiRejectedAds.push(ad);
          break;
        default: // ERROR cases
          ad.errorMessage = aiResponse.error || 'Unknown Error';
          failedAds.push(ad);
          break;
      }
  }

  // Step 3: Content-based Duplicate Filtering on AI-accepted ads
  let finalAcceptedAds = [];
  
  for(const newAd of aiAcceptedAds) {
    let isDuplicate = false;
    for(const existingDesc of existingDescriptions) {
        // Using the utility function from Utilities.gs
        if (stringSimilarity(newAd.description, existingDesc) >= 0.90) {
            isDuplicate = true;
            Logger.log(`Content duplicate found for ad: "${newAd.title}". Rejecting.`);
            newAd.aiDecision = 'REJECT_DUPLICATE'; // New status for clarity
            aiRejectedAds.push(newAd); // Add to the rejected list
            break;
        }
    }
    if (!isDuplicate) {
        finalAcceptedAds.push(newAd);
        // Add new description to the list to check against subsequent ads in the same run
        existingDescriptions.push(newAd.description);
    }
  }

  const toEmails = config['to_email'] ? config['to_email'].join(',') : null;
  
  // Step 4: Process final lists
  // Add FINAL ACCEPTED ads to 'Rentals' sheet and notify
  if (finalAcceptedAds.length > 0) {
    insertRowsToTop(rentalsSheet, finalAcceptedAds, ['title', 'price', 'url', 'description', 'aiDecision', 'dateAdded']);
    if(toEmails) {
        finalAcceptedAds.forEach(ad => sendDetailedNotification(ad, toEmails));
    }
  }

  // Add REJECTED (by AI or as duplicate) ads to 'Rejected' sheet
  if (aiRejectedAds.length > 0) {
    insertRowsToTop(rejectedSheet, aiRejectedAds, ['title', 'price', 'url', 'description', 'aiDecision', 'dateAdded']);
  }
  
  // Add FAILED ads to 'Failures' sheet and notify
  if (failedAds.length > 0) {
    insertRowsToTop(failuresSheet, failedAds, ['title', 'price', 'url', 'description', 'errorMessage', 'dateAdded']);
    if(toEmails) {
        sendFailureNotification(failedAds, toEmails);
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// The rest of the functions in Crawlers.gs remain the same. 
// No changes needed for:
// - getAiFilterDecision(title, description)
// - getAdDetails(adUrl)
// - sendDetailedNotification(ad, toEmails)
// - sendFailureNotification(failedAds, toEmails)
// ---------------------------------------------------------------------------------------------------


function getAiFilterDecision(title, description) {
  const prompt = `
    You are an expert assistant evaluating room rental advertisements in Sri Lanka. 
    Your task is to decide if an ad is suitable based on a set of strict rules.
    Analyze the following advertisement's title and description.

    **Rules:**
    1.  REJECT if the ad is exclusively for "girls", "females", or "ladies" (e.g., "ගැහැණු ළමයින්ට පමණි", "Ladies only").
    2.  REJECT if the ad explicitly states that "cooking is not allowed" or has similar restrictions (e.g., "උයන්න දෙන්නෙ නෑ", "No kitchen access").
    3.  ACCEPT all other ads, including those for "boys", "males", or with no gender preference.

    **Advertisement Title:** "${title}"
    **Advertisement Description:** "${description}"

    Based on the rules, what is your decision? 
    Respond ONLY with a JSON object in the following format:
    {"decision": "ACCEPT"} or {"decision": "REJECT"}
  `;
  
  let aiResponseText = null;
  for (let i = 0; i < 3; i++) {
    try {
      aiResponseText = callGemini(prompt);
      const jsonResponse = JSON.parse(aiResponseText);
      return { decision: jsonResponse.decision || 'ERROR_PARSING_RESPONSE', error: null };
    } catch (e) {
      Logger.log(`Attempt ${i + 1} failed for ad "${title}". Error: ${e.message}. Raw response: ${aiResponseText}`);
      if (i < 2) Utilities.sleep(2000); 
    }
  }
  return { decision: 'ERROR_FINAL', error: `Failed after 3 retries. Last raw response: ${aiResponseText}` };
}

function getAdDetails(adUrl) {
  try {
    const data = extractJsonData(adUrl);
    if (data && data.adDetail && data.adDetail.data) {
      return {
        description: data.adDetail.data.ad.description
      };
    }
    return null;
  } catch (e) {
    Logger.log(`Error getting details for ${adUrl}: ${e.message}`);
    return null;
  }
}

function sendDetailedNotification(ad, toEmails) {
  const subject = `[Suitable Ad Found] ${ad.title}`;
  
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #27ae60;">Suitable Ikman.lk Ad Found!</h2>
        <p>Gemini AI and Duplicate Filter have reviewed this ad and found it suitable.</p>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 120px;">Title:</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${ad.title}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Price:</td>
            <td style="padding: 12px; border: 1px solid #ddd;">Rs. ${ad.price}</td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">URL:</td>
            <td style="padding: 12px; border: 1px solid #ddd;"><a href="${ad.url}" target="_blank">${ad.url}</a></td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; vertical-align: top;">Description:</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${ad.description.replace(/\n/g, '<br>')}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 0.9em; color: #7f8c8d;">This is an automated notification from your AI-powered Google Sheet Crawler.</p>
      </body>
    </html>
  `;
  
  GmailApp.sendEmail(toEmails, subject, '', { htmlBody: htmlBody, name: 'AI Ad Finder' });
  Logger.log(`Detailed notification sent for suitable ad: ${ad.title}`);
}

function sendFailureNotification(failedAds, toEmails) {
    const subject = `⚠️ [Action Required] Gemini AI API Failed for ${failedAds.length} Ad(s)`;
    let tableRows = '';
    failedAds.forEach(ad => {
        tableRows += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${ad.title}</td>
                <td style="padding: 8px; border: 1px solid #ddd;"><a href="${ad.url}">${ad.url}</a></td>
                <td style="padding: 8px; border: 1px solid #ddd; color: red;">${ad.errorMessage}</td>
            </tr>
        `;
    });

    const htmlBody = `
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #e74c3c;">Gemini API Failure Alert</h2>
                <p>The system failed to get a decision from the Gemini AI for the following ad(s). They have been added to the 'Failures' sheet for manual review.</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background-color: #f2f2f2;">
                        <tr>
                            <th style="padding: 12px; border: 1px solid #ddd;">Title</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">URL</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </body>
        </html>
    `;
    GmailApp.sendEmail(toEmails, subject, '', { htmlBody: htmlBody, name: 'AI Crawler Alert System' });
    Logger.log(`Failure notification sent for ${failedAds.length} ads.`);
}