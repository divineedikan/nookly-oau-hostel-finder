"""Remove unnamed records from the public dataset while preserving raw OSM candidates."""
from __future__ import annotations

import json
from pathlib import Path


DATA_PATH = Path("data/hostels.json")


records = json.loads(DATA_PATH.read_text(encoding="utf-8"))
visible_records = [
    record for record in records
    if isinstance(record.get("name"), str) and record["name"].strip()
]
DATA_PATH.write_text(json.dumps(visible_records, indent=2) + "\n", encoding="utf-8")
print(f"Kept {len(visible_records)} named records; raw OSM candidates remain in the ignored data/.cache directory")
