"""Classify Google-sourced records as research leads, not verified listings."""
from __future__ import annotations

import json
from pathlib import Path


path = Path("data/hostels.json")
records = json.loads(path.read_text(encoding="utf-8"))
changed = 0
for record in records:
    source = str(record.get("source", "")).lower()
    if "google.com" in source or "google maps" in source:
        if record.get("verified_status") != "from_google_search":
            record["verified_status"] = "from_google_search"
            changed += 1
path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
print(f"Classified {changed} Google-sourced record(s) as from_google_search")
