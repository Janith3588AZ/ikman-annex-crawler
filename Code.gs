/**
 * @OnlyCurrentDoc
 * This script crawles ikman.lk for room rentals and sends detailed email notifications.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI Annex Crawler')
    .addItem('1. Initial Sheet Setup', 'initialSetup')
    .addSeparator()
    .addItem('2. Run Crawler & Notifier Now', 'runSingleCrawlAndNotify')
    .addSeparator()
    .addItem('3. Install 15-Minute Triggers', 'installTriggers')
    .addItem('4. Uninstall All Triggers', 'uninstallTriggers')
    .addToUi();
}

// --- MODIFIED: Added 'Rejected' and 'Failures' sheets ---
function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToCreate = {
    'Config': ['Key', 'Value'],
    'Rentals': ['Title', 'Price', 'URL', 'Description', 'AI Decision', 'Date Added'],
    'Rejected': ['Title', 'Price', 'URL', 'Description', 'AI Decision', 'Date Added'],
    'Failures': ['Title', 'Price', 'URL', 'Description', 'Error Message', 'Date Added']
  };

  for (const sheetName in sheetsToCreate) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.clear();
    sheet.appendRow(sheetsToCreate[sheetName]);
    sheet.getRange(1, 1, 1, sheetsToCreate[sheetName].length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  const configSheet = ss.getSheetByName('Config');
  configSheet.clearContents().appendRow(['Key', 'Value']);
  configSheet.getRange('A1:B1').setFontWeight('bold');

  configSheet.appendRow(['Source_URL', 'https://ikman.lk/en/ads/colombo/room-annex-rentals?money.price.maximum=50000']);
  configSheet.appendRow(['to_email', 'showt997@gmail.com']);
  configSheet.appendRow(['to_email', '333subashini@gmail.com']);
  
  SpreadsheetApp.getUi().alert('Initial setup complete! "Rejected" and "Failures" sheets have been added. Please ensure your GOOGLE_API_KEY is set in Script Properties.');
}

function installTriggers() {
  uninstallTriggers();
  
  ScriptApp.newTrigger('runSingleCrawlAndNotify')
      .timeBased()
      .everyMinutes(15)
      .create();
      
  SpreadsheetApp.getUi().alert('Trigger installed successfully! The crawler will run every 15 minutes.');
}

function uninstallTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  Logger.log('All triggers have been uninstalled.');
}

function runSingleCrawlAndNotify() {
  crawlAndNotify();
}