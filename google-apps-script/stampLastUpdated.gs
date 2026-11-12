/**
 * Optional Apps Script: stamp Last Updated whenever Status changes in the Sheet,
 * and stamp Offer Date (if blank) when Status becomes Offer.
 *
 * Setup:
 * 1. Add a "Last Updated" column header on each year tab (or let the dashboard create it).
 * 2. Extensions → Apps Script → paste this file.
 * 3. Run createInstallableStampTrigger() once to install the onEdit trigger.
 */

var LAST_UPDATED_HEADER = 'Last Updated'
var OFFER_DATE_HEADER = 'Offer Date'
var OFFER_DATE_ALIASES = ['offer date', 'date offered', 'offered on', 'offer received', 'date of offer']

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

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy')
  sheet.getRange(row, updatedCol + 1).setValue(today)

  var status = String(sheet.getRange(row, statusCol + 1).getValue() || '').trim().toLowerCase()
  if (status === 'offer') {
    _stampOfferDate_(sheet, row, today)
  }
}

/** Fill Offer Date with today when it's blank (adds the column on first use). */
function _stampOfferDate_(sheet, row, today) {
  // Re-read headers: Last Updated may have just been added.
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
  var offerCol = -1
  for (var i = 0; i < OFFER_DATE_ALIASES.length && offerCol < 0; i++) {
    offerCol = _findHeaderColumn_(headers, OFFER_DATE_ALIASES[i])
  }
  if (offerCol < 0) {
    offerCol = headers.length
    while (offerCol > 0 && String(headers[offerCol - 1] || '').trim() === '') {
      offerCol--
    }
    sheet.getRange(1, offerCol + 1).setValue(OFFER_DATE_HEADER)
  }
  var cell = sheet.getRange(row, offerCol + 1)
  if (String(cell.getValue() || '').trim() === '') {
    cell.setValue(today)
  }
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
