/**
 * Bound Apps Script for the internship tracker Google Sheet.
 *
 * Setup:
 * 1. Extensions → Apps Script, paste this file contents
 * 2. Project Settings → Script Properties, add:
 *      GITHUB_TOKEN  = a fine-grained or classic PAT with `repo` scope
 *                      (needs permission to create repository_dispatch events)
 * 3. Replace OWNER and REPO below with your GitHub username/org and repo name
 * 4. Save, then Run → onEdit once to authorize OAuth scopes
 * 5. Ensure an installable onEdit trigger exists (Edit → Current project's triggers)
 *    if the simple trigger is insufficient (UrlFetchApp requires authorized trigger)
 */

var OWNER = "OWNER"; // e.g. "astridgreene"
var REPO = "REPO"; // e.g. "internship-apps-dashboard"

var REQUIRED_COLUMNS = ["Company", "Location", "Role", "Date Applied", "Status"];
var VALID_STATUSES = {
  Applied: true,
  OA: true,
  Interview: true,
  Offer: true,
  Rejected: true,
};

/**
 * Installable onEdit trigger entrypoint (do not name this "onEdit" —
 * simple triggers cannot use UrlFetchApp).
 * Fires a GitHub repository_dispatch when a new application row looks complete.
 */
function handleSheetEdit(e) {
  if (!e || !e.range) {
    return;
  }

  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Ignore header row
  if (row === 1) {
    return;
  }

  // Only care about edits in the data columns A–E
  if (col < 1 || col > 5) {
    return;
  }

  var headers = sheet.getRange(1, 1, 1, 5).getValues()[0];
  if (!_headersMatch(headers)) {
    Logger.log("Sheet headers do not match expected columns; skipping dispatch.");
    return;
  }

  var rowValues = sheet.getRange(row, 1, 1, 5).getValues()[0];
  if (!_isCompleteRow(rowValues)) {
    return;
  }

  // Avoid duplicate dispatches for the same row/session when the user fills
  // multiple cells quickly — only fire when the last-edited cell completes the row
  // or when Status specifically is set.
  if (!_rowWasJustCompleted(e, rowValues)) {
    return;
  }

  _dispatchGithubEvent_();
}

function _headersMatch(headers) {
  for (var i = 0; i < REQUIRED_COLUMNS.length; i++) {
    if (String(headers[i] || "").trim() !== REQUIRED_COLUMNS[i]) {
      return false;
    }
  }
  return true;
}

function _isCompleteRow(values) {
  var company = String(values[0] || "").trim();
  var location = String(values[1] || "").trim();
  var role = String(values[2] || "").trim();
  var dateApplied = values[3];
  var status = String(values[4] || "").trim();

  if (!company || !location || !role || dateApplied === "" || dateApplied === null) {
    return false;
  }
  if (!status || !VALID_STATUSES[status]) {
    return false;
  }
  return true;
}

function _rowWasJustCompleted(e, rowValues) {
  // Fire when Status is edited to a valid value on an otherwise complete row,
  // or when any required field is filled and the row is now fully complete.
  var editedCol = e.range.getColumn();
  var status = String(rowValues[4] || "").trim();

  if (editedCol === 5 && VALID_STATUSES[status]) {
    return true;
  }

  // For non-status edits, only dispatch if all fields (including status) are filled
  return _isCompleteRow(rowValues);
}

function _dispatchGithubEvent_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GITHUB_TOKEN");
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set in Script Properties. " +
        "Add it under Project Settings → Script Properties."
    );
  }

  if (OWNER === "OWNER" || REPO === "REPO") {
    throw new Error("Replace OWNER and REPO placeholders in onEdit.gs before use.");
  }

  var url = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/dispatches";
  var payload = {
    event_type: "sheet-updated",
    client_payload: {
      source: "google-sheets",
      timestamp: new Date().toISOString(),
    },
  };

  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "internship-apps-dashboard-apps-script",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code !== 204) {
    Logger.log("GitHub dispatch failed (" + code + "): " + response.getContentText());
    throw new Error("GitHub repository_dispatch failed with status " + code);
  }

  Logger.log("Dispatched sheet-updated event to " + OWNER + "/" + REPO);
}

/**
 * One-time helper: create an installable onEdit trigger (required for UrlFetchApp).
 * Run this once from the Apps Script editor after pasting the script.
 */
function createInstallableOnEditTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "handleSheetEdit") {
      Logger.log("handleSheetEdit trigger already exists");
      return;
    }
  }
  ScriptApp.newTrigger("handleSheetEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log("Created installable handleSheetEdit trigger");
}
