/**
 * OPTIONAL — GitHub “ping” (empty commit) when applications are added.
 *
 * The dashboard never puts application rows in git. This script only tells
 * GitHub to create an empty commit via repository_dispatch.
 *
 * Setup:
 * 1. Replace OWNER and REPO below.
 * 2. Project Settings → Script Properties:
 *      GITHUB_TOKEN = classic PAT (or fine-grained) with "Contents: Read and write"
 *                    OR a classic PAT with `repo` scope (needed for repository_dispatch)
 *      Optional: PING_SECRET = shared secret; also set the same value in the site as
 *                VITE_GITHUB_PING_SECRET if you want a basic check.
 * 3. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone (token stays in Script Properties; URL can spam empty commits)
 * 4. Copy the Web App URL into VITE_GITHUB_PING_URL (.env.local / GitHub Actions secret)
 *
 * Bound installable onEdit (createInstallableOnEditTrigger) is optional and only
 * fires for edits made in the Sheets UI — not for dashboard API writes.
 */

var OWNER = 'OWNER' // e.g. 'your-github-username'
var REPO = 'REPO' // e.g. 'internship-apps-tracker'

var REQUIRED_COLUMNS = ['Company', 'Location', 'Role', 'Date Applied', 'Status']
var VALID_STATUSES = {
  Applied: true,
  OA: true,
  Interview: true,
  Offer: true,
  Rejected: true,
  'OA->Rejected': true,
  'Interview->Rejected': true,
}

/**
 * Web app entry — optional POST (same behavior as GET ?ping=1).
 */
function doPost(e) {
  return _handlePing_(e)
}

/**
 * GET health check, or ping with ?ping=1 (used by the dashboard).
 * Optional: &secret=… matching Script Property PING_SECRET
 */
function doGet(e) {
  var params = (e && e.parameter) || {}
  if (params.ping || params.event === 'application-added') {
    return _handlePing_(e)
  }
  return _json_({
    ok: true,
    service: 'internship-apps-tracker-ping',
    hint: 'Call with ?ping=1 after adding an application.',
  })
}

function _handlePing_(e) {
  try {
    _assertPingSecret_(e)
    _dispatchGithubEvent_('application-added')
    return _json_({ ok: true })
  } catch (err) {
    return _json_({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}

/**
 * Installable onEdit — only for Sheet UI edits (not Sheets API / dashboard writes).
 */
function handleSheetEdit(e) {
  if (!e || !e.range) {
    return
  }

  var sheet = e.range.getSheet()
  var row = e.range.getRow()
  var col = e.range.getColumn()

  if (row === 1) {
    return
  }
  if (col < 1 || col > 5) {
    return
  }

  var headers = sheet.getRange(1, 1, 1, 5).getValues()[0]
  if (!_headersMatch(headers)) {
    Logger.log('Sheet headers do not match expected columns; skipping dispatch.')
    return
  }

  var rowValues = sheet.getRange(row, 1, 1, 5).getValues()[0]
  if (!_isCompleteRow(rowValues)) {
    return
  }
  if (!_rowWasJustCompleted(e, rowValues)) {
    return
  }

  _dispatchGithubEvent_('application-added')
}

function _headersMatch(headers) {
  for (var i = 0; i < REQUIRED_COLUMNS.length; i++) {
    if (String(headers[i] || '').trim() !== REQUIRED_COLUMNS[i]) {
      return false
    }
  }
  return true
}

function _isCompleteRow(values) {
  var company = String(values[0] || '').trim()
  var location = String(values[1] || '').trim()
  var role = String(values[2] || '').trim()
  var dateApplied = values[3]
  var status = String(values[4] || '').trim()

  if (!company || !location || !role || dateApplied === '' || dateApplied === null) {
    return false
  }
  if (!status || !VALID_STATUSES[status]) {
    return false
  }
  return true
}

function _rowWasJustCompleted(e, rowValues) {
  var editedCol = e.range.getColumn()
  var status = String(rowValues[4] || '').trim()

  if (editedCol === 5 && VALID_STATUSES[status]) {
    return true
  }
  return _isCompleteRow(rowValues)
}

function _assertPingSecret_(e) {
  var expected = PropertiesService.getScriptProperties().getProperty('PING_SECRET')
  if (!expected) {
    return
  }
  var headers = (e && e.headers) || {}
  var params = (e && e.parameter) || {}
  var provided =
    headers['X-Ping-Secret'] ||
    headers['x-ping-secret'] ||
    params.secret ||
    ''
  if (String(provided) !== String(expected)) {
    throw new Error('Unauthorized ping')
  }
}

function _dispatchGithubEvent_(eventType) {
  var props = PropertiesService.getScriptProperties()
  var token = props.getProperty('GITHUB_TOKEN')
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is not set in Script Properties. ' +
        'Add it under Project Settings → Script Properties.',
    )
  }

  if (OWNER === 'OWNER' || REPO === 'REPO') {
    throw new Error('Replace OWNER and REPO placeholders before use.')
  }

  var url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/dispatches'
  var payload = {
    event_type: eventType || 'application-added',
    client_payload: {
      source: 'internship-apps-tracker',
      // No company/role/status — only a timezone-agnostic stamp.
      timestamp: new Date().toISOString(),
    },
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'internship-apps-tracker-apps-script',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  })

  var code = response.getResponseCode()
  if (code !== 204) {
    Logger.log('GitHub dispatch failed (' + code + '): ' + response.getContentText())
    throw new Error('GitHub repository_dispatch failed with status ' + code)
  }

  Logger.log('Dispatched ' + payload.event_type + ' to ' + OWNER + '/' + REPO)
}

function _json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}

/** One-time: installable onEdit for Sheet UI completions. */
function createInstallableOnEditTrigger() {
  var triggers = ScriptApp.getProjectTriggers()
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'handleSheetEdit') {
      Logger.log('handleSheetEdit trigger already exists')
      return
    }
  }
  ScriptApp.newTrigger('handleSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create()
  Logger.log('Created installable handleSheetEdit trigger')
}
