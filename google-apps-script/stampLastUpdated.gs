/**
 * Optional Apps Script: stamp Last Updated whenever Status changes in the Sheet.
 *
 * Setup:
 * 1. Add a "Last Updated" column header on each year tab (or let the dashboard create it).
 * 2. Extensions → Apps Script → paste this file.
 * 3. Run createInstallableStampTrigger() once to install the onEdit trigger.
 */

var LAST_UPDATED_HEADER = 'Last Updated'

/**
 * Installable onEdit entrypoint — stamps Last Updated when Status is edited.
 */
function stampStatusUpdated(e) {
  if (!e || !e.range) {
    return
  }

  var sheet = e.range.getSheet()
  var row = e.range.getRow()
  var col = e.range.getColumn()

  if (row === 1) {
    return
  }

  var lastCol = Math.max(sheet.getLastColumn(), 6)
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
  var statusCol = _findHeaderColumn_(headers, 'Status')
  var updatedCol = _findHeaderColumn_(headers, LAST_UPDATED_HEADER)

  if (statusCol < 0) {
    return
  }

  // Only react when the Status cell is edited
  if (col !== statusCol + 1) {
    return
  }

  if (updatedCol < 0) {
    updatedCol = headers.length
    while (updatedCol > 0 && String(headers[updatedCol - 1] || '').trim() === '') {
      updatedCol--
    }
    sheet.getRange(1, updatedCol + 1).setValue(LAST_UPDATED_HEADER)
  }

  sheet.getRange(row, updatedCol + 1).setValue(new Date())
}

function _findHeaderColumn_(headers, name) {
  var target = String(name || '')
    .trim()
    .toLowerCase()
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim().toLowerCase() === target) {
      return i
    }
  }
  return -1
}

/** Run once from the Apps Script editor to install the trigger. */
function createInstallableStampTrigger() {
  var triggers = ScriptApp.getProjectTriggers()
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'stampStatusUpdated') {
      Logger.log('stampStatusUpdated trigger already exists')
      return
    }
  }
  ScriptApp.newTrigger('stampStatusUpdated')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create()
  Logger.log('Created installable stampStatusUpdated trigger')
}
