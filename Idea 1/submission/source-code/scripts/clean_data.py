"""Merge OSM candidates and student survey data into the app data file."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    "id", "name", "area", "address_description", "latitude", "longitude",
    "price_per_year_ngn", "room_type", "rooms_available", "water",
    "power_hours_estimate", "fence_or_gate", "security_guard",
    "distance_to_gate_km", "landlord_name", "contact", "source",
    "verified_status", "date_collected", "notes",
}
STATUSES = {"partially_verified", "verified_on_site", "verified_by_contact", "from_osm", "from_google_search", "unverified"}
SURVEY_COLUMNS = [
    "id", "campus_status", "name", "area", "address_description", "latitude", "longitude",
    "price_per_year_ngn", "room_type", "rooms_available", "water",
    "power_hours_estimate", "fence_or_gate", "security_guard",
    "distance_to_gate_km", "landlord_name", "contact", "source",
    "verified_status", "date_collected", "notes",
]


def haversine_km(latitude: float, longitude: float, gate_latitude: float, gate_longitude: float) -> float:
    """Return the great-circle distance between two coordinates in kilometres."""
    radius_km = 6371.0088
    lat1, lat2 = math.radians(latitude), math.radians(gate_latitude)
    delta_lat = math.radians(gate_latitude - latitude)
    delta_lon = math.radians(gate_longitude - longitude)
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(value))


def load_json_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError(f"{path} must contain a JSON list")
    return value


def normalise(value: Any) -> Any:
    try:
        import pandas as pd
        is_missing = pd.isna(value)
    except ImportError:
        is_missing = value is None
    if is_missing:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def load_survey(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    if len(path.read_text(encoding="utf-8").splitlines()) <= 1:
        return []
    try:
        import pandas as pd
    except ImportError as error:
        raise RuntimeError("pandas is required to merge a survey CSV; install requirements.txt") from error
    frame = pd.read_csv(path)
    missing = set(SURVEY_COLUMNS) - set(frame.columns)
    if "campus_status" in missing:
        frame["campus_status"] = "unverified"
        missing.remove("campus_status")
    if missing:
        raise ValueError(f"Survey CSV is missing columns: {', '.join(sorted(missing))}")
    return [{key: normalise(row[key]) for key in SURVEY_COLUMNS} for _, row in frame.iterrows()]


def validate_record(record: dict[str, Any]) -> list[str]:
    errors = []
    missing = REQUIRED_FIELDS - record.keys()
    if missing:
        errors.append(f"missing fields: {', '.join(sorted(missing))}")
    if record.get("verified_status") not in STATUSES:
        errors.append("invalid verified_status")
    if not record.get("source"):
        errors.append("source is required")
    if not record.get("date_collected"):
        errors.append("date_collected is required")
    for field in ("latitude", "longitude"):
        value = record.get(field)
        if value is not None:
            try:
                float(value)
            except (TypeError, ValueError):
                errors.append(f"{field} must be numeric or null")
    return errors


def clean_records(records: list[dict[str, Any]], gate: dict[str, Any] | None) -> list[dict[str, Any]]:
    cleaned: dict[str, dict[str, Any]] = {}
    for record in records:
        record = {key: normalise(value) for key, value in record.items()}
        if not isinstance(record.get("name"), str) or not record["name"].strip():
            continue
        record.setdefault("campus_status", "unverified")
        errors = validate_record(record)
        if errors:
            raise ValueError(f"Invalid record {record.get('id')}: {'; '.join(errors)}")
        record["latitude"] = float(record["latitude"]) if record["latitude"] is not None else None
        record["longitude"] = float(record["longitude"]) if record["longitude"] is not None else None
        if gate and record["latitude"] is not None and record["longitude"] is not None:
            record["distance_to_gate_km"] = round(haversine_km(record["latitude"], record["longitude"], gate["latitude"], gate["longitude"]), 2)
        cleaned[str(record["id"])] = record
    return list(cleaned.values())


def clean(osm_path: Path, survey_path: Path, output_path: Path, site_config_path: Path) -> None:
    records = load_json_records(osm_path) + load_survey(survey_path)
    config = json.loads(site_config_path.read_text(encoding="utf-8")) if site_config_path.exists() else {}
    gate = config.get("main_gate")
    if gate and not all(isinstance(gate.get(key), (int, float)) for key in ("latitude", "longitude")):
        gate = None
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(clean_records(records, gate), indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} validated records to {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm", type=Path, default=Path("data/.cache/osm_candidates.json"))
    parser.add_argument("--survey", type=Path, default=Path("data/survey_template.csv"))
    parser.add_argument("--output", type=Path, default=Path("data/hostels.json"))
    parser.add_argument("--site-config", type=Path, default=Path("data/site_config.json"))
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    clean(
        osm_path=arguments.osm,
        survey_path=arguments.survey,
        output_path=arguments.output,
        site_config_path=arguments.site_config,
    )
