/**
 * Daily internship reminder email (8:30pm).
 *
 * Sends to REMINDER_EMAIL:
 *  - a nudge to keep applying
 *  - list of incomplete OAs (Status = OA and OA Complete = N) on the active year tab
 *
 * Setup (one-time):
 * 1. Open your tracker spreadsheet → Extensions → Apps Script.
 * 2. Add a new script file and paste this file (or replace Code.gs).
 * 3. File → Project settings → Time zone → (UTC-05:00) Eastern Time (or your zone).
 *    8:30pm uses this timezone.
 * 4. Optional: Project Settings → Script properties:
 *      REMINDER_EMAIL = you@example.com   (overrides the default below)
 *      REMINDER_YEAR  = 2027                 (optional; otherwise picks next summer year)
 * 5. Select createDailyReminderTrigger → Run (authorize when asked).
 * 6. Optional: select sendDailyReminderEmail → Run once to test an email now.
 *
 * Does not put any data in GitHub — email only from your Google account.
 */

var REMINDER_EMAIL_DEFAULT = 'you@example.com'
var DASHBOARD_URL = 'https://YOUR_USER.github.io/YOUR_REPO/'
var APPLY_URL =
  'https://simplify.jobs/jobs?query=Software%20Engineering&state=United%20States&country=United%20States&category=Backend%20Engineering%3BFull-Stack%20Engineering%3BDevOps%20Engineering%3BSoftware%20Engineering&seasons=Summer%202027&mostRecent=true&excludeApplied=true&jobType=Internship&workArrangement=In%20Person%3BHybrid'

/**
 * Install (or replace) a clock trigger for 8:30pm every day.
 */
function createDailyReminderTrigger() {
  var handler = 'sendDailyReminderEmail'
  var triggers = ScriptApp.getProjectTriggers()
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(triggers[i])
    }
  }

  ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(20).nearMinute(30).create()

  Logger.log(
    'Created daily trigger for sendDailyReminderEmail around 8:30pm ' +
      '(script timezone: ' +
      Session.getScriptTimeZone() +
      '). Run sendDailyReminderEmail once to test.',
  )
}

/**
 * Build and send today's reminder. Safe to run manually anytime.
 */
function sendDailyReminderEmail() {
  var email = _reminderEmail_()
  var year = _reminderYear_()
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(String(year))
  if (!sheet) {
    MailApp.sendEmail({
      to: email,
      subject: 'Internship reminder — year tab ' + year + ' missing',
      body:
        'Could not find a sheet tab named "' +
        year +
        '". Rename a tab to that year (exactly four digits) or set Script property REMINDER_YEAR.',
    })
    return
  }

  var incompleteOas = _listIncompleteOas_(sheet)
  var subject =
    incompleteOas.length === 0
      ? 'Apply tonight · no open OAs (' + year + ')'
      : 'Apply tonight · ' +
        incompleteOas.length +
        ' OA' +
        (incompleteOas.length === 1 ? '' : 's') +
        ' to finish (' +
        year +
        ')'

  var html = _buildEmailHtml_(year, incompleteOas)
  var text = _buildEmailText_(year, incompleteOas)

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: text,
    htmlBody: html,
  })

  Logger.log('Sent reminder to ' + email + ' (' + incompleteOas.length + ' incomplete OA(s)).')
}

function _reminderEmail_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('REMINDER_EMAIL')
  return (fromProps && String(fromProps).trim()) || REMINDER_EMAIL_DEFAULT
}

/** Same rule as the dashboard: Jan–May → this year; Jun–Dec → next year. */
function _reminderYear_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('REMINDER_YEAR')
  if (fromProps && /^\d{4}$/.test(String(fromProps).trim())) {
    return String(fromProps).trim()
  }
  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() // 0 = Jan
  return String(month < 5 ? year : year + 1)
}

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

/**
 * Rows with Status OA and OA Complete = N (same as dashboard OA card).
 */
function _listIncompleteOas_(sheet) {
  var values = sheet.getDataRange().getValues()
  if (!values.length) {
    return []
  }

  var headers = values[0]
  var companyCol = _findCol_(headers, ['company', 'employer', 'org', 'organization'])
  var roleCol = _findCol_(headers, ['role', 'position', 'title', 'job', 'job title'])
  var statusCol = _findCol_(headers, ['status', 'stage', 'result', 'outcome', 'application status'])
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
    var status = String(row[statusCol] || '').trim()
    if (status !== 'OA') {
      continue
    }
    var oaComplete = oaCol < 0 ? 'N/A' : _normalizeOaComplete_(row[oaCol])
    if (oaComplete !== 'N') {
      continue
    }
    out.push({
      company: String(row[companyCol] || '').trim() || 'Untitled',
      role: roleCol < 0 ? '' : String(row[roleCol] || '').trim(),
      lastUpdated: updatedCol < 0 ? '' : _formatCellDate_(row[updatedCol]),
    })
  }
  return out
}

function _formatCellDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'M/d/yyyy')
  }
  var s = String(value || '').trim()
  return s
}

function _buildEmailText_(year, oas) {
  var lines = []
  lines.push('Internship evening reminder (' + year + ')')
  lines.push('')
  lines.push('1) APPLY')
  lines.push('Spend 20–30 minutes submitting applications tonight.')
  lines.push('Find roles: ' + APPLY_URL)
  lines.push('')
  lines.push('2) COMPLETE OAs')
  if (!oas.length) {
    lines.push('No open OAs right now.')
  } else {
    lines.push(oas.length + ' OA' + (oas.length === 1 ? '' : 's') + ' waiting:')
    for (var i = 0; i < oas.length; i++) {
      var item = oas[i]
      var line = '- ' + item.company + (item.role ? ' · ' + item.role : '')
      if (item.lastUpdated) {
        line += ' (updated ' + item.lastUpdated + ')'
      }
      lines.push(line)
    }
  }
  lines.push('')
  lines.push('Dashboard: ' + DASHBOARD_URL)
  return lines.join('\n')
}

function _oaRowsHtml_(oas) {
  if (!oas.length) {
    return (
      '<tr><td style="padding:14px 16px;font-size:14px;color:#166534;font-weight:600;">' +
      'You\'re clear — no incomplete OAs. Nice work.' +
      '</td></tr>'
    )
  }

  var rows = ''
  for (var i = 0; i < oas.length; i++) {
    var item = oas[i]
    var bg = i % 2 === 0 ? '#ffffff' : '#f8fafc'
    var border = i === oas.length - 1 ? 'none' : '1px solid #e2e8f0'
    rows +=
      '<tr>' +
      '<td style="padding:12px 16px;background:' +
      bg +
      ';border-bottom:' +
      border +
      ';">' +
      '<div style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.3;">' +
      _esc_(item.company) +
      '</div>' +
      (item.role
        ? '<div style="margin-top:2px;font-size:13px;color:#64748b;line-height:1.35;">' +
          _esc_(item.role) +
          '</div>'
        : '') +
      (item.lastUpdated
        ? '<div style="margin-top:4px;font-size:11px;color:#94a3b8;font-weight:600;">Updated ' +
          _esc_(item.lastUpdated) +
          '</div>'
        : '') +
      '</td></tr>'
  }
  return rows
}

function _buildEmailHtml_(year, oas) {
  var oaCountLabel =
    oas.length === 0
      ? 'None open'
      : String(oas.length) + ' open OA' + (oas.length === 1 ? '' : 's')

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Internship reminder</title></head>' +
    '<body style="margin:0;padding:0;background:#f1f5f9;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">' +
    // Header
    '<tr><td style="background:linear-gradient(90deg,#0d9488,#0891b2,#0ea5e9);padding:22px 24px;">' +
    '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Evening reminder · Summer ' +
    _esc_(year) +
    '</div>' +
    '<div style="margin-top:6px;font-size:22px;font-weight:800;color:#ffffff;line-height:1.25;">Apply tonight. Clear your OAs.</div>' +
    '<div style="margin-top:8px;font-size:14px;color:rgba(255,255,255,0.92);line-height:1.4;">Two jobs before bed: submit apps, then finish outstanding assessments.</div>' +
    '</td></tr>' +
    // Apply section
    '<tr><td style="padding:22px 24px 8px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #99f6e4;background:#f0fdfa;border-radius:10px;">' +
    '<tr><td style="padding:16px 18px;">' +
    '<div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">1 · Apply</div>' +
    '<div style="margin-top:6px;font-size:17px;font-weight:800;color:#134e4a;">Ship a few applications</div>' +
    '<div style="margin-top:6px;font-size:14px;color:#334155;line-height:1.45;">Aim for a short, focused session — even 2–3 quality apps beats scrolling.</div>' +
    '<div style="margin-top:14px;">' +
    '<a href="' +
    APPLY_URL +
    '" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;padding:11px 16px;border-radius:8px;">Browse internships on Simplify</a>' +
    '</div>' +
    '</td></tr></table>' +
    '</td></tr>' +
    // OA section
    '<tr><td style="padding:12px 24px 22px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #93c5fd;background:#eff6ff;border-radius:10px;overflow:hidden;">' +
    '<tr><td style="padding:14px 18px 10px;border-bottom:1px solid #bfdbfe;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>' +
    '<td style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#1d4ed8;">2 · OAs to complete</td>' +
    '<td align="right" style="font-size:12px;font-weight:800;color:#1e40af;">' +
    _esc_(oaCountLabel) +
    '</td>' +
    '</tr></table>' +
    '<div style="margin-top:4px;font-size:13px;color:#1e3a8a;">Same list as your dashboard OA card (OA + Complete = N).</div>' +
    '</td></tr>' +
    _oaRowsHtml_(oas) +
    '<tr><td style="padding:12px 18px;background:#eff6ff;border-top:1px solid #bfdbfe;">' +
    '<a href="' +
    DASHBOARD_URL +
    '" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;padding:10px 14px;border-radius:8px;">Open dashboard</a>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    // Footer
    '<tr><td style="padding:0 24px 20px;">' +
    '<div style="font-size:12px;color:#94a3b8;line-height:1.4;">Automated from your Internship Applications Tracker spreadsheet · Apps Script · ' +
    _esc_(_reminderEmail_()) +
    '</div>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr></table>' +
    '</body></html>'
  )
}

function _esc_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
