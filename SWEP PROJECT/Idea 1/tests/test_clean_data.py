import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from clean_data import clean_records, haversine_km, validate_record


def test_haversine_zero_distance():
    assert haversine_km(7.5, 4.5, 7.5, 4.5) == 0


def test_haversine_is_reasonable():
    assert 10 < haversine_km(7.5, 4.5, 7.6, 4.5) < 12


def test_record_requires_provenance():
    record = {"id": "x", "verified_status": "from_osm", "date_collected": "2026-10-03"}
    assert "source is required" in validate_record(record)


def test_clean_records_deduplicates_by_id():
    record = {
        "id": "x", "name": "Example", "area": "Area", "address_description": None,
        "latitude": 7.5, "longitude": 4.5, "price_per_year_ngn": None,
        "room_type": None, "rooms_available": None, "water": None,
        "power_hours_estimate": None, "fence_or_gate": None, "security_guard": None,
        "distance_to_gate_km": None, "landlord_name": None, "contact": None,
        "source": "OpenStreetMap: https://www.openstreetmap.org/node/1",
        "verified_status": "from_osm", "date_collected": "2026-10-03", "notes": None,
    }
    assert len(clean_records([record, record], None)) == 1
