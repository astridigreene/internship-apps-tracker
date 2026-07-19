#!/usr/bin/env python3
"""Pull internship applications from Google Sheets and write src/data/data.json."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
EXPECTED_HEADERS = ["Company", "Location", "Role", "Date Applied", "Status"]
VALID_STATUSES = {"Applied", "OA", "Interview", "Offer", "Rejected"}

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / "src" / "data" / "data.json"


def load_credentials():
    key_raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY")
    if not key_raw:
        raise SystemExit("GOOGLE_SERVICE_ACCOUNT_KEY secret is not set")

    try:
        info = json.loads(key_raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON: {exc}") from exc

    return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)


def normalize_header(value: str) -> str:
    return value.strip().lower()


def parse_rows(values: list[list[str]]) -> list[dict]:
    if not values:
        return []

    headers = [h.strip() for h in values[0]]
    header_map = {normalize_header(h): i for i, h in enumerate(headers) if h}

    missing = [h for h in EXPECTED_HEADERS if normalize_header(h) not in header_map]
    if missing:
        raise SystemExit(f"Sheet is missing required columns: {', '.join(missing)}")

    apps: list[dict] = []
    for row in values[1:]:
        def cell(col: str) -> str:
            idx = header_map[normalize_header(col)]
            return row[idx].strip() if idx < len(row) else ""

        company = cell("Company")
        location = cell("Location")
        role = cell("Role")
        date_applied = cell("Date Applied")
        status = cell("Status")

        # Skip incomplete rows (e.g. blank trailing sheet rows)
        if not company and not role and not status:
            continue

        if status and status not in VALID_STATUSES:
            print(
                f"Warning: unknown status '{status}' for {company or '(no company)'}; "
                "including as-is",
                file=sys.stderr,
            )

        apps.append(
            {
                "company": company,
                "location": location,
                "role": role,
                "dateApplied": date_applied,
                "status": status,
            }
        )

    return apps


def compute_stats(applications: list[dict]) -> dict:
    total = len(applications)
    counts = {
        "Applied": 0,
        "OA": 0,
        "Interview": 0,
        "Offer": 0,
        "Rejected": 0,
    }
    for app in applications:
        status = app.get("status", "")
        if status in counts:
            counts[status] += 1

    def rate(count: int) -> float:
        if total == 0:
            return 0.0
        return round((count / total) * 100, 1)

    return {
        "totalApplications": total,
        "rejections": counts["Rejected"],
        "oas": counts["OA"],
        "interviews": counts["Interview"],
        "offers": counts["Offer"],
        "rejectionRate": rate(counts["Rejected"]),
        "oaRate": rate(counts["OA"]),
        "interviewRate": rate(counts["Interview"]),
        "offerRate": rate(counts["Offer"]),
    }


def fetch_sheet_values(sheet_id: str, credentials) -> list[list[str]]:
    service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    # Read the first sheet in full; A:E covers the expected five columns.
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range="A:E")
        .execute()
    )
    return result.get("values", [])


def main() -> None:
    sheet_id = os.environ.get("SHEET_ID")
    if not sheet_id:
        raise SystemExit("SHEET_ID secret is not set")

    credentials = load_credentials()
    values = fetch_sheet_values(sheet_id, credentials)
    applications = parse_rows(values)
    stats = compute_stats(applications)

    payload = {
        "lastSynced": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "stats": stats,
        "applications": applications,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(applications)} applications to {OUTPUT_PATH}")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
