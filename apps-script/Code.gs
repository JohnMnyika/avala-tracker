/**
 * Deploy as a Web app (execute as you; access restricted to your organisation).
 * Set SPREADSHEET_ID and SHEET_NAME in Script Properties instead of source code.
 */
function doGet() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  const sheetName = properties.getProperty("SHEET_NAME");
  if (!spreadsheetId || !sheetName) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Set SPREADSHEET_ID and SHEET_NAME in Script Properties." })).setMimeType(ContentService.MimeType.JSON);
  }
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift().map(function (value) { return String(value).trim(); });
  const assignments = values.filter(function (row) { return row.some(String); }).map(function (row) {
    return headers.reduce(function (result, header, index) { result[header] = row[index] || ""; return result; }, {});
  });
  return ContentService.createTextOutput(JSON.stringify({ assignments: assignments, syncedAt: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}
