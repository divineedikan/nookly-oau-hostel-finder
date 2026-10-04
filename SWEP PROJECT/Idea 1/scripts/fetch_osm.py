"""Fetch candidate accommodation features from OpenStreetMap via Overpass.

This script never invents listing details. OSM records remain candidates until
someone verifies them on site or by contact.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_BBOX = (7.45, 4.48, 7.58, 4.60)  # south, west, north, east: OAU/Ile-Ife area


def build_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    box = f"{south},{west},{north},{east}"
    return f"""[out:json][timeout:60];
(
  nwr["tourism"~"hostel|guest_house|apartment"]({box});
  nwr["building"~"apartments|residential|dormitory"]({box});
  nwr["amenity"="shelter"]({box});
);
out center tags;"""


def build_gate_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    box = f"{south},{west},{north},{east}"
    return f"""[out:json][timeout:30];
(
  nwr["entrance"="main"]({box});
  nwr["name"~"OAU|Obafemi Awolowo|University", i]({box});
);
out center tags;"""


def element_coordinates(element: dict[str, Any]) -> tuple[float | None, float | None]:
    if element.get("type") == "node":
        return element.get("lat"), element.get("lon")
    center = element.get("center") or {}
    return center.get("lat"), center.get("lon")


def candidate_from_element(element: dict[str, Any]) -> dict[str, Any]:
    tags = element.get("tags") or {}
    latitude, longitude = element_coordinates(element)
    osm_id = f"{element.get('type')}/{element.get('id')}"
    return {
        "id": f"osm-{element.get('type')}-{element.get('id')}",
        "name": tags.get("name"),
        "area": tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
        "address_description": tags.get("addr:full") or tags.get("addr:street"),
        "latitude": latitude,
        "longitude": longitude,
        "price_per_year_ngn": None,
        "room_type": None,
        "rooms_available": None,
        "water": None,
        "power_hours_estimate": None,
        "fence_or_gate": None,
        "security_guard": None,
        "distance_to_gate_km": None,
        "landlord_name": None,
        "contact": None,
        "source": f"OpenStreetMap: https://www.openstreetmap.org/{osm_id}",
        "verified_status": "from_osm",
        "date_collected": date.today().isoformat(),
        "notes": "OSM candidate; accommodation details require verification.",
    }


def request_overpass(query: str, timeout: int = 75) -> dict[str, Any]:
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "OAU-Off-Campus-Hostel-Finder/1.0 (SWEP student project)"},
            timeout=timeout,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as error:
        raise RuntimeError(f"Overpass request failed: {error}") from error
    except ValueError as error:
        raise RuntimeError("Overpass returned invalid JSON") from error


def fetch(output_path: Path, site_config_path: Path, bbox: tuple[float, float, float, float]) -> None:
    accommodation = request_overpass(build_query(bbox)).get("elements", [])
    candidates = [candidate_from_element(element) for element in accommodation]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(candidates, indent=2), encoding="utf-8")

    gate_elements = request_overpass(build_gate_query(bbox), timeout=45).get("elements", [])
    gate = None
    for element in gate_elements:
        latitude, longitude = element_coordinates(element)
        if latitude is not None and longitude is not None:
            osm_id = f"{element.get('type')}/{element.get('id')}"
            gate = {
                "name": (element.get("tags") or {}).get("name") or "OAU main gate",
                "latitude": latitude,
                "longitude": longitude,
                "source": f"OpenStreetMap: https://www.openstreetmap.org/{osm_id}",
                "verified_status": "from_osm",
                "date_collected": date.today().isoformat(),
            }
            break
    site_config_path.write_text(
        json.dumps({"main_gate": gate}, indent=2), encoding="utf-8"
    )
    print(f"Wrote {len(candidates)} OSM candidates to {output_path}")
    print(f"Main gate feature: {'found' if gate else 'not found; verify manually'}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/.cache/osm_candidates.json"))
    parser.add_argument("--site-config", type=Path, default=Path("data/site_config.json"))
    parser.add_argument("--bbox", nargs=4, type=float, metavar=("SOUTH", "WEST", "NORTH", "EAST"), default=DEFAULT_BBOX)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        fetch(args.output, args.site_config, tuple(args.bbox))
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
