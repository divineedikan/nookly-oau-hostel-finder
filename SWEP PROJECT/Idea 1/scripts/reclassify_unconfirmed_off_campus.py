"""Classify currently unconfirmed location records as off-campus leads."""
from __future__ import annotations

import json
from pathlib import Path


path = Path("data/hostels.json")
records = json.loads(path.read_text(encoding="utf-8"))
changed = 0
for record in records:
    if record.get("campus_status") in {"unconfirmed", "unverified"}:
        record["campus_status"] = "off_campus"
        changed += 1
path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
print(f"Classified {changed} unconfirmed record(s) as off_campus")
