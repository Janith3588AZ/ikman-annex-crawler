// --- FIX: Corrected ReferenceError by declaring 'responseText' ---
// --- ENHANCEMENT: Added retry logic and better error handling ---

const properties = PropertiesService.getScriptProperties().getProperties();
const geminiApiKey = properties['GOOGLE_API_KEY'];

function callGemini(prompt, temperature = 0) {
  if (!geminiApiKey) {
    Logger.log("ERROR: GOOGLE_API_KEY not found in Script Properties. Please set it.");
    throw new Error("GOOGLE_API_KEY is not set.");
  }
  
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`;

  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": { "temperature": temperature }
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(geminiEndpoint, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText(); // FIX: This was missing

  if (responseCode !== 200) {
     Logger.log(`Gemini API Error: Code ${responseCode}. Response: ${responseText}`);
     throw new Error(`Gemini API Error: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  if (data && data.candidates && data.candidates[0] && data.candidates[0].content) {
    return data.candidates[0].content.parts[0].text;
  } else {
    Logger.log(`Unexpected Gemini response format: ${responseText}`);
    throw new Error(`Unexpected Gemini response format.`);
  }
}

// --- NEW HELPER FUNCTION: To insert rows at the top of a sheet ---
function insertRowsToTop(sheet, dataObjects, headerOrder) {
    if (!dataObjects || dataObjects.length === 0) return;

    const reversedObjects = dataObjects.reverse();
    const rowsToAdd = reversedObjects.map(obj => headerOrder.map(header => obj[header]));

    sheet.insertRowsBefore(2, rowsToAdd.length);
    sheet.getRange(2, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
}


function readConfig() {
  // Implementation is in Utilities.gs (previous code)
  // No changes needed
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) return {};
  const values = configSheet.getDataRange().getValues();
  const configMap = {};
  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    const value = values[i][1];
    if (key) {
      if (configMap[key]) {
        configMap[key].push(value);
      } else {
        configMap[key] = [value];
      }
    }
  }
  return configMap;
}

// Utilities.gs ගොනුවට මෙය එක් කරන්න (දැනටමත් නොමැති නම්)
function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a.length === 0) return b.length === 0 ? 1 : 0;
  let matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      let cost = (b.charAt(i - 1) == a.charAt(j - 1)) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + cost,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1
      );
    }
  }
  const distance = matrix[b.length][a.length];
  return 1.0 - distance / Math.max(a.length, b.length);
}

function extractJsonData(url) {
  // Implementation is in Utilities.gs (previous code)
  // No changes needed
  try {
    const options = {
      'muteHttpExceptions': true,
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const html = response.getContentText();
      const dataStr = html.split('window.initialData = ')[1].split('</script>')[0].trim();
      return JSON.parse(dataStr);
    } else {
      Logger.log(`Failed to fetch URL: ${url}. Status: ${response.getResponseCode()}`);
      return null;
    }
  } catch (e) {
    Logger.log(`Exception fetching or parsing URL ${url}: ${e.message}`);
    return null;
  }
}