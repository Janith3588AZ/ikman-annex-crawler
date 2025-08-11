// අනුපිටපත් දැන්වීම් හඳුනාගෙන Status යාවත්කාලීන කිරීම
function processDuplicates(category) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(category);
  const descSheet = ss.getSheetByName('Description');
  
  const sheetData = sheet.getDataRange().getValues();
  const descData = descSheet.getDataRange().getValues();
  
  const headers = sheetData[0];
  const urlIndex = headers.indexOf('URL');
  const statusIndex = headers.indexOf('Status');
  const totalIndex = headers.indexOf('Total');
  const notesIndex = headers.indexOf('Notes');

  const descHeaders = descData[0];
  const descUrlIndex = descHeaders.indexOf('URL');
  const descTextIndex = descHeaders.indexOf('Description');

  // දත්ත පහසුවෙන් access කිරීමට maps සාදාගැනීම
  const descMap = new Map(descData.slice(1).map(row => [row[descUrlIndex], row[descTextIndex]]));
  const sheetDataMap = new Map(sheetData.slice(1).map(row => [row[urlIndex], row]));

  const newAdsBefore = sheetData.slice(1).filter(row => row[statusIndex] === '').length;
  Logger.log(`New ads before processing: ${newAdsBefore}`);

  // Status එක හිස් (empty) ඇති පේළි පමණක් සලකා බැලීම
  for (let i = 1; i < sheetData.length; i++) {
    const rowA = sheetData[i];
    if (rowA[statusIndex] !== '') continue;

    const urlA = rowA[urlIndex];
    const descA = descMap.get(urlA);
    if (!descA) continue;

    let matchedRowsB = [];
    // අනෙක් සියලු විස්තර සමඟ සසඳා බැලීම
    for (const [otherUrl, otherDesc] of descMap.entries()) {
      if (urlA !== otherUrl && stringSimilarity(descA, otherDesc) >= 0.90) {
        const matchedRow = sheetDataMap.get(otherUrl);
        if (matchedRow) {
          matchedRowsB.push(matchedRow);
        }
      }
    }

    if (matchedRowsB.length === 0) continue;

    const totalA = parseFloat(rowA[totalIndex].replace(/,/g, ''));
    
    // ඔබගේ README ගොනුවේ ඇති තර්කය මෙහි ක්‍රියාත්මක කර ඇත
    if (matchedRowsB.every(row => row[statusIndex] === '')) {
      // Step X
      const minTotalRow = matchedRowsB.reduce((min, row) => parseFloat(row[totalIndex].replace(/,/g, '')) < parseFloat(min[totalIndex].replace(/,/g, '')) ? row : min);
      if (totalA > parseFloat(minTotalRow[totalIndex].replace(/,/g, ''))) {
        rowA[statusIndex] = "Ignore";
        rowA[notesIndex] = `Similar but pricier than: ${minTotalRow[urlIndex]}`;
      } else {
        matchedRowsB.forEach(rowB => {
          rowB[statusIndex] = "Ignore";
          rowB[notesIndex] = `Similar but pricier than: ${urlA}`;
        });
      }
    } else if (matchedRowsB.some(row => row[statusIndex] === 'Consider')) {
      // Step Y
      const considerRows = matchedRowsB.filter(row => row[statusIndex] === 'Consider');
      const minConsiderRow = considerRows.reduce((min, row) => parseFloat(row[totalIndex].replace(/,/g, '')) < parseFloat(min[totalIndex].replace(/,/g, '')) ? row : min);
      if (totalA < parseFloat(minConsiderRow[totalIndex].replace(/,/g, ''))) {
        rowA[statusIndex] = "Consider";
        rowA[notesIndex] = `Cheaper version of a considered ad: ${minConsiderRow[urlIndex]}`;
      } else {
        rowA[statusIndex] = "Ignore";
        rowA[notesIndex] = `Pricier version of a considered ad: ${minConsiderRow[urlIndex]}`;
      }
    } else if (matchedRowsB.some(row => row[statusIndex] === 'Ignore')) {
      // Step Z
      const ignoreRows = matchedRowsB.filter(row => row[statusIndex] === 'Ignore');
      const minIgnoreRow = ignoreRows.reduce((min, row) => parseFloat(row[totalIndex].replace(/,/g, '')) < parseFloat(min[totalIndex].replace(/,/g, '')) ? row : min);
       if (totalA >= parseFloat(minIgnoreRow[totalIndex].replace(/,/g, ''))) {
        rowA[statusIndex] = "Ignore";
        rowA[notesIndex] = `Similar to an ignored ad: ${minIgnoreRow[urlIndex]}`;
      }
    }
  }

  // දත්ත Status එක අනුව sort කිරීම (Consider -> Empty -> Ignore)
  const sortedData = sheetData.slice(1).sort((a, b) => {
    const statusOrder = { 'Consider': 1, '': 2, 'Ignore': 3 };
    return (statusOrder[a[statusIndex]] || 3) - (statusOrder[b[statusIndex]] || 3);
  });

  // යාවත්කාලීන වූ දත්ත නැවත sheet එකට ලිවීම
  if (sortedData.length > 0) {
    sheet.getRange(2, 1, sortedData.length, headers.length).setValues(sortedData);
  }

  const newAdsAfter = sheet.getDataRange().getValues().slice(1).filter(row => row[statusIndex] === '').length;
  Logger.log(`New ads after processing: ${newAdsAfter}`);

  // Notification යැවීම
  if (newAdsAfter > 0) {
    sendNotification(newAdsAfter, category);
  }
}