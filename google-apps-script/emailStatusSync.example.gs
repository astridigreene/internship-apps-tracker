/**
 * Gmail → Sheet status auto-update
 *
 * Every ~5 minutes, scans recent Gmail for messages that mention a company on
 * your active year tab, classifies intent from subject/body heuristics, and
 * auto-updates Status (and OA Complete when moving to OA).
 *
 * Why not a true "on new email" trigger?
 *   Gmail has no simple Apps Script onNewEmail hook. Instant push needs
 *   Gmail users.watch + Cloud Pub/Sub. A 5-minute time trigger is the
 *   practical near-real-time approach for a personal tracker.
 *
 * Safety rails:
 *   - Requires a company-name match in From / Subject / early body
 *   - Requires a strong keyword classification (otherwise skip)
 *   - Only advances pipeline (never Applied ← Interview)
 *   - Stage-aware rejections; does not un-reject or weaken Offer with OA/Interview
 *   - Remembers processed Gmail message IDs so re-runs do not flip twice
 *   - Caps updates per run (default 20)
 *
 * Setup (one-time):
 * 1. Open your tracker spreadsheet → Extensions → Apps Script.
 * 2. Add this file to the same Apps Script project as onEdit.gs (already has the GitHub ping).
 * 3. File → Project settings → Time zone → your zone.
 * 4. Optional Script properties:
 *        SYNC_YEAR   = 2027          (else same next-summer rule as the dashboard)
 *        GMAIL_QUERY = in:inbox is:unread newer_than:2d -from:me
 *        MAX_UPDATES = 20
 * 5. Select createEmailStatusSyncTrigger → Run (authorize Gmail + Sheets).
 * 6. Optional: select syncStatusesFromEmail → Run once to test now.
 *
 * After each run that updates ≥1 status, calls _dispatchGithubEvent_() from onEdit.gs
 * so `.github/workflows/application-ping.yml` creates the empty contribution commit.
 *
 * Personal copy tip: save local tweaks as emailStatusSync.gs (gitignored);
 * keep this *.example.gs in the repo.
 *
 * Does not put company/role/status into git — only an empty activity commit.
 */

var EMAIL_SYNC_HANDLER = 'syncStatusesFromEmail'
var EMAIL_SYNC_PROCESSED_KEY = 'EMAIL_SYNC_PROCESSED_IDS'
var EMAIL_SYNC_PROCESSED_MAX = 400
var GMAIL_QUERY_DEFAULT = 'in:inbox is:unread newer_than:2d -from:me'
var MAX_UPDATES_DEFAULT = 20
var BODY_SCAN_CHARS = 2500

/**
 * Install (or replace) a clock trigger that runs about every 5 minutes.
 */
function createEmailStatusSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers()
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === EMAIL_SYNC_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i])
    }
  }

  ScriptApp.newTrigger(EMAIL_SYNC_HANDLER).timeBased().everyMinutes(5).create()

  Logger.log(
    'Created ~5 minute trigger for syncStatusesFromEmail ' +
      '(script timezone: ' +
      Session.getScriptTimeZone() +
      '). Run syncStatusesFromEmail once to authorize and test.',
  )
}

/**
 * Clear remembered Gmail message IDs so unread mail can be reconsidered.
 * Run once from the Apps Script editor if sync stopped updating after an earlier run.
 */
function clearEmailStatusSyncProcessedIds() {
  PropertiesService.getScriptProperties().deleteProperty(EMAIL_SYNC_PROCESSED_KEY)
  Logger.log('emailStatusSync: cleared EMAIL_SYNC_PROCESSED_IDS')
}

/**
 * Scan Gmail and update matching application rows. Safe to run manually anytime.
 */
function syncStatusesFromEmail() {
  var year = _syncYear_()
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(String(year))
  if (!sheet) {
    Logger.log('emailStatusSync: year tab "' + year + '" not found. Set SYNC_YEAR or rename a tab.')
    return
  }

  var apps = _loadApplications_(sheet)
  if (!apps.length) {
    Logger.log('emailStatusSync: no application rows on tab ' + year)
    return
  }

  var query = _gmailQuery_()
  var maxUpdates = _maxUpdates_()
  var processed = _loadProcessedIds_()
  var processedSet = {}
  for (var p = 0; p < processed.length; p++) {
    processedSet[processed[p]] = true
  }

  // Newest first; keep the scan bounded.
  var threads = GmailApp.search(query, 0, 40)
  var updates = 0
  var newlyProcessed = []

  for (var t = 0; t < threads.length; t++) {
    if (updates >= maxUpdates) {
      break
    }
    var messages = threads[t].getMessages()
    for (var m = 0; m < messages.length; m++) {
      if (updates >= maxUpdates) {
        break
      }
      var message = messages[m]
      if (!message.isUnread()) {
        continue
      }
      var messageId = message.getId()
      if (processedSet[messageId]) {
        continue
      }

      var from = String(message.getFrom() || '')
      var subject = String(message.getSubject() || '')
      var body = ''
      try {
        body = String(message.getPlainBody() || '').slice(0, BODY_SCAN_CHARS)
      } catch (err) {
        body = String(message.getBody() || '')
          .replace(/<[^>]+>/g, ' ')
          .slice(0, BODY_SCAN_CHARS)
      }

      var haystack = (from + '\n' + subject + '\n' + body).toLowerCase()
      var match = _bestCompanyMatch_(apps, haystack)
      if (!match) {
        // Leave unprocessed while unread — company row may be added later.
        Logger.log('emailStatusSync: no company match — ' + subject.slice(0, 80))
        continue
      }

      var classified = _classifyStatus_(subject + '\n' + body, match.status)
      if (!classified) {
        // Leave unprocessed while unread — heuristics may improve; user can mark read to stop.
        Logger.log(
          'emailStatusSync: matched ' +
            match.company +
            ' but no status keywords — ' +
            subject.slice(0, 80),
        )
        continue
      }

      if (!_shouldApplyStatus_(match.status, classified)) {
        Logger.log(
          'emailStatusSync: skip ' +
            match.company +
            ' (' +
            match.status +
            ' → ' +
            classified +
            ') — safety rail',
        )
        newlyProcessed.push(messageId)
        processedSet[messageId] = true
        continue
      }

      _writeApplicationUpdate_(sheet, match, classified)
      updates += 1
      newlyProcessed.push(messageId)
      processedSet[messageId] = true
      Logger.log(
        'emailStatusSync: ' +
          match.company +
          ' ' +
          match.status +
          ' → ' +
          classified +
          ' (msg ' +
          messageId +
          ')',
      )
    }
  }

  if (newlyProcessed.length) {
    _saveProcessedIds_(processed.concat(newlyProcessed))
  }

  if (updates > 0) {
    try {
      // From onEdit.gs in this same Apps Script project.
      _dispatchGithubEvent_('application-added')
    } catch (pingErr) {
      Logger.log(
        'emailStatusSync: GitHub ping failed (Sheet updates still saved): ' +
          (pingErr && pingErr.message ? pingErr.message : pingErr),
      )
    }
  }

  Logger.log(
    'emailStatusSync: done. updates=' +
      updates +
      ' scannedThreads=' +
      threads.length +
      ' year=' +
      year,
  )
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function _syncYear_() {
  var props = PropertiesService.getScriptProperties()
  var fromProps =
    props.getProperty('SYNC_YEAR') || props.getProperty('REMINDER_YEAR')
  if (fromProps && /^\d{4}$/.test(String(fromProps).trim())) {
    return String(fromProps).trim()
  }
  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() // 0 = Jan
  return String(month < 5 ? year : year + 1)
}

function _gmailQuery_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('GMAIL_QUERY')
  return (fromProps && String(fromProps).trim()) || GMAIL_QUERY_DEFAULT
}

function _maxUpdates_() {
  var raw = PropertiesService.getScriptProperties().getProperty('MAX_UPDATES')
  var n = raw ? parseInt(String(raw).trim(), 10) : MAX_UPDATES_DEFAULT
  if (!n || n < 1) {
    return MAX_UPDATES_DEFAULT
  }
  return n
}

// ---------------------------------------------------------------------------
// Sheet load / write
// ---------------------------------------------------------------------------

function _normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function _findCol_(headers, aliases) {
  for (var i = 0; i < headers.length; i++) {
    var h = _normalizeHeader_(headers[i])
    for (var a = 0; a < aliases.length; a++) {
      if (h === aliases[a]) {
        return i
      }
    }
  }
  return -1
}

function _normalizeOaComplete_(raw) {
  var v = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (v === 'Y' || v === 'YES') {
    return 'Y'
  }
  if (v === 'N' || v === 'NO') {
    return 'N'
  }
  return 'N/A'
}

function _loadApplications_(sheet) {
  var values = sheet.getDataRange().getValues()
  if (!values.length) {
    return []
  }
  var headers = values[0]
  var companyCol = _findCol_(headers, ['company', 'employer', 'org', 'organization'])
  var statusCol = _findCol_(headers, [
    'status',
    'stage',
    'result',
    'outcome',
    'application status',
  ])
  var oaCol = _findCol_(headers, [
    'oa complete',
    'oacomplete',
    'oa completed',
    'oa done',
    'completed oa',
  ])
  var updatedCol = _findCol_(headers, [
    'last updated',
    'lastupdated',
    'status updated',
    'updated',
    'updated at',
  ])

  if (companyCol < 0 || statusCol < 0) {
    throw new Error('Sheet is missing Company and/or Status headers in row 1.')
  }

  var out = []
  for (var r = 1; r < values.length; r++) {
    var row = values[r]
    var company = String(row[companyCol] || '').trim()
    if (!company) {
      continue
    }
    out.push({
      rowIndex: r + 1, // 1-based sheet row
      company: company,
      companyKey: _normalizeCompanyKey_(company),
      status: String(row[statusCol] || '').trim(),
      oaComplete: oaCol < 0 ? null : _normalizeOaComplete_(row[oaCol]),
      companyCol: companyCol,
      statusCol: statusCol,
      oaCol: oaCol,
      updatedCol: updatedCol,
    })
  }
  // Longest company name first so "Meta Platforms" wins over "Meta" collisions carefully
  out.sort(function (a, b) {
    return b.companyKey.length - a.companyKey.length
  })
  return out
}

function _writeApplicationUpdate_(sheet, app, newStatus) {
  var statusCell = sheet.getRange(app.rowIndex, app.statusCol + 1)
  statusCell.setValue(newStatus)

  if (app.updatedCol >= 0) {
    sheet.getRange(app.rowIndex, app.updatedCol + 1).setValue(_statusStamp_())
  }

  if (newStatus === 'OA' && app.oaCol >= 0) {
    var currentOa = app.oaComplete
    if (currentOa === 'N/A' || currentOa === null || currentOa === '') {
      sheet.getRange(app.rowIndex, app.oaCol + 1).setValue('N')
    }
  }
}

/** Same M/D/YYYY style the dashboard writes for Last Updated. */
function _statusStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy')
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function _normalizeCompanyKey_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(incorporated|inc|llc|l\.l\.c|corp|corporation|co|ltd|limited|company)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Prefer the longest company key that appears as a whole-ish token in haystack.
 */
function _bestCompanyMatch_(apps, haystack) {
  var best = null
  for (var i = 0; i < apps.length; i++) {
    var app = apps[i]
    var key = app.companyKey
    if (!key || key.length < 2) {
      continue
    }
    if (_haystackHasCompany_(haystack, key)) {
      if (!best || key.length > best.companyKey.length) {
        best = app
      }
    }
  }
  return best
}

function _haystackHasCompany_(haystack, companyKey) {
  // Escape regex special chars in company key spaces already normalized to single spaces
  var parts = companyKey.split(' ')
  var escaped = []
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) {
      continue
    }
    escaped.push(parts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  }
  if (!escaped.length) {
    return false
  }
  var pattern = '\\b' + escaped.join('\\s+') + '\\b'
  return new RegExp(pattern, 'i').test(haystack)
}

// ---------------------------------------------------------------------------
// Classification + safety
// ---------------------------------------------------------------------------

function _normalizeStatusKey_(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s*(?:→|->|➜|⇒)\s*/g, '->')
}

function _isRejectedStatus_(status) {
  var normalized = _normalizeStatusKey_(status)
  return (
    normalized === 'rejected' ||
    normalized.endsWith('->rejected') ||
    /\breject/.test(normalized)
  )
}

function _statusRank_(status) {
  switch (_normalizeStatusKey_(status)) {
    case 'applied':
      return 1
    case 'oa':
      return 2
    case 'interview':
      return 3
    case 'offer':
      return 4
    default:
      return 0
  }
}

function _rejectionStatusFor_(status) {
  var normalized = _normalizeStatusKey_(status)
  if (normalized === 'oa') {
    return 'OA->Rejected'
  }
  if (normalized === 'interview') {
    return 'Interview->Rejected'
  }
  if (_isRejectedStatus_(status)) {
    if (normalized === 'oa->rejected') {
      return 'OA->Rejected'
    }
    if (normalized === 'interview->rejected') {
      return 'Interview->Rejected'
    }
    return 'Rejected'
  }
  return 'Rejected'
}

function _textHasAny_(text, phrases) {
  var lower = String(text || '').toLowerCase()
  for (var i = 0; i < phrases.length; i++) {
    if (lower.indexOf(phrases[i]) !== -1) {
      return true
    }
  }
  return false
}

/**
 * Returns a sheet status string, or null if confidence is too low.
 * Order: rejection → offer → interview → OA (rejection wins over interview language).
 */
function _classifyStatus_(text, currentStatus) {
  var rejectPhrases = [
    'unfortunately',
    'not moving forward',
    'will not be moving forward',
    'won\'t be moving forward',
    'other candidates',
    'decided to pursue other',
    'position has been filled',
    'no longer under consideration',
    'we regret to',
    'not selected',
    'not be advancing',
    'rejected',
    'decline to move forward',
  ]
  if (_textHasAny_(text, rejectPhrases)) {
    return _rejectionStatusFor_(currentStatus)
  }

  var offerPhrases = [
    'offer letter',
    'pleased to offer',
    'excited to offer',
    'formal offer',
    'job offer',
    'extend an offer',
    'extending an offer',
    'offer of employment',
    'offer for the',
  ]
  if (_textHasAny_(text, offerPhrases)) {
    return 'Offer'
  }
  // "congratulations" alone is weak — require offer-ish neighbor words
  if (
    /\bcongratulations\b/i.test(text) &&
    /\b(offer|joining|welcome aboard|accept this)\b/i.test(text)
  ) {
    return 'Offer'
  }

  var interviewPhrases = [
    'interview',
    'phone screen',
    'phone-screen',
    'onsite',
    'on-site',
    'schedule a call',
    'schedule time to talk',
    'speak with the team',
    'next round',
    'hiring manager chat',
  ]
  if (_textHasAny_(text, interviewPhrases)) {
    // Avoid OA platforms that say "interview" rarely; prefer OA if assessment platform dominates
    if (_looksLikeOa_(text) && !_textHasAny_(text, ['schedule an interview', 'interview invitation', 'interview with'])) {
      return 'OA'
    }
    return 'Interview'
  }

  if (_looksLikeOa_(text)) {
    return 'OA'
  }

  return null
}

function _looksLikeOa_(text) {
  var oaPhrases = [
    'online assessment',
    'online test',
    'coding assessment',
    'coding challenge',
    'take-home',
    'take home',
    'hackerrank',
    'codesignal',
    'codility',
    'hirevue',
    'hire vue',
    'spark hire',
    'assessment invitation',
    'complete the assessment',
    'oa invitation',
    'technical assessment',
  ]
  return _textHasAny_(text, oaPhrases)
}

/**
 * Whether applying newStatus to currentStatus is allowed.
 */
function _shouldApplyStatus_(currentStatus, newStatus) {
  if (!newStatus || newStatus === currentStatus) {
    return false
  }

  // Already rejected — do not bounce around reject variants unless identical skip above
  if (_isRejectedStatus_(currentStatus)) {
    return false
  }

  if (_isRejectedStatus_(newStatus)) {
    // Allow reject from Applied / OA / Interview / Offer
    return true
  }

  // Never weaken an Offer with OA/Interview
  if (_normalizeStatusKey_(currentStatus) === 'offer') {
    return false
  }

  // Forward pipeline only
  return _statusRank_(newStatus) > _statusRank_(currentStatus)
}

// ---------------------------------------------------------------------------
// Processed message IDs
// ---------------------------------------------------------------------------

function _loadProcessedIds_() {
  var raw = PropertiesService.getScriptProperties().getProperty(EMAIL_SYNC_PROCESSED_KEY)
  if (!raw) {
    return []
  }
  try {
    var parsed = JSON.parse(raw)
    if (!parsed || !parsed.length) {
      return []
    }
    var out = []
    for (var i = 0; i < parsed.length; i++) {
      if (parsed[i]) {
        out.push(String(parsed[i]))
      }
    }
    return out
  } catch (err) {
    return []
  }
}

function _saveProcessedIds_(ids) {
  // Keep the newest tail only
  var trimmed = ids
  if (trimmed.length > EMAIL_SYNC_PROCESSED_MAX) {
    trimmed = trimmed.slice(trimmed.length - EMAIL_SYNC_PROCESSED_MAX)
  }
  // Dedupe while preserving order
  var seen = {}
  var unique = []
  for (var i = 0; i < trimmed.length; i++) {
    var id = String(trimmed[i])
    if (seen[id]) {
      continue
    }
    seen[id] = true
    unique.push(id)
  }
  PropertiesService.getScriptProperties().setProperty(
    EMAIL_SYNC_PROCESSED_KEY,
    JSON.stringify(unique),
  )
}
