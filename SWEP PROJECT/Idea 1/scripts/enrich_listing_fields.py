"""Add the app's enriched listing fields without overwriting existing values."""
from __future__ import annotations

import json
import math
import re
from pathlib import Path


path = Path("data/hostels.json")
records = json.loads(path.read_text(encoding="utf-8"))
site_config = json.loads(Path("data/site_config.json").read_text(encoding="utf-8"))
gate = site_config.get("main_gate") or {}


def haversine_km(latitude: float, longitude: float, gate_latitude: float, gate_longitude: float) -> float:
    radius_km = 6371.0088
    lat1, lat2 = math.radians(latitude), math.radians(gate_latitude)
    delta_lat = math.radians(gate_latitude - latitude)
    delta_lon = math.radians(gate_longitude - longitude)
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(value))


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def area_group(record: dict) -> str:
    area = str(record.get("area") or "").lower()
    for key, group in (("damico", "damico-ooni-crownland"), ("ooni", "damico-ooni-crownland"), ("maintenance", "maintenance"), ("ede road", "ede-road"), ("aserifa", "aserifa"), ("moremi", "moremi-estate"), ("oduduwa", "oduduwa-estate"), ("ibadan", "ibadan-road"), ("mayfair", "mayfair")):
        if key in area:
            return group
    return "on-campus" if record.get("campus_status") == "on_campus" else "other"


for record in records:
    name = str(record.get("name") or "")
    record.setdefault("slug", slugify(name) if name else str(record.get("id", "listing")))
    record.setdefault("campus_status", "unconfirmed")
    record.setdefault("area_group", area_group(record))
    if record.get("distance_to_gate_km") is None and all(record.get(key) is not None for key in ("latitude", "longitude")) and all(gate.get(key) is not None for key in ("latitude", "longitude")):
        record["distance_to_gate_km"] = round(haversine_km(float(record["latitude"]), float(record["longitude"]), float(gate["latitude"]), float(gate["longitude"])), 2)
        record.setdefault("distance_note", "Straight-line distance calculated from the sourced OAU gate coordinate; not a road or walking route.")
    if record.get("walk_minutes_estimate") is None and record.get("distance_to_gate_km") is not None:
        record["walk_minutes_estimate"] = round(float(record["distance_to_gate_km"]) * 15)
        record.setdefault("distance_note", "Straight-line distance converted to an approximate 15-minute-per-kilometre walk estimate; not measured on foot.")
    record.setdefault("map_links", {})
    if record.get("latitude") is not None and record.get("longitude") is not None:
        record["map_links"].setdefault("google_maps_directions", f"https://www.google.com/maps/dir/?api=1&destination={record['latitude']},{record['longitude']}")
        record["map_links"].setdefault("openstreetmap", f"https://www.openstreetmap.org/?mlat={record['latitude']}&mlon={record['longitude']}#map=18/{record['latitude']}/{record['longitude']}")
    record.setdefault("gender_policy", None)
    record.setdefault("room_types", [])
    record.setdefault("price_min_ngn", None)
    record.setdefault("price_max_ngn", None)
    record.setdefault("payment_terms", None)
    record.setdefault("caution_fee_ngn", None)
    record.setdefault("agent_fee_ngn", None)
    record.setdefault("facilities", {"wifi": None, "kitchen": None, "private_bathroom": None, "parking": None, "furnished": None, "generator_or_solar": None})
    record.setdefault("photos", [])
    record.setdefault("whatsapp", None)
    record.setdefault("student_rating_avg", None)
    record.setdefault("student_rating_count", 0)
    record.setdefault("reports_count", 0)
    record.setdefault("listing_status", "lead")
    record.setdefault("visible_on_site", False)
    record.setdefault("last_verified_at", None)
    record.setdefault("verified_by", None)
    record.setdefault("google_place_id", None)

path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
print(f"Enriched {len(records)} records")
