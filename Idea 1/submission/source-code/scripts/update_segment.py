"""Bulk-update shared fields for one campus segment in hostels.json."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_bool(value: str) -> bool:
    value = value.lower()
    if value in {"yes", "true", "1"}:
        return True
    if value in {"no", "false", "0"}:
        return False
    raise argparse.ArgumentTypeError("use yes or no")


def update_segment(
    path: Path,
    segment: str,
    area: str | None,
    address: str | None,
    fence: bool | None,
    price: int | None,
    pricing_note: str | None,
) -> int:
    records = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for record in records:
        if record.get("campus_status") != segment:
            continue
        if area is not None:
            record["area"] = area
        if address is not None:
            record["address_description"] = address
        if fence is not None:
            record["fence_or_gate"] = fence
        if price is not None:
            record["price_per_year_ngn"] = price
            record["price_min_ngn"] = price
            record["price_max_ngn"] = price
            if segment == "on_campus":
                record["payment_terms"] = "Per academic session (2024/2025)"
        if pricing_note is not None:
            record["pricing_note"] = pricing_note
        changed += 1
    path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--segment", choices=["on_campus", "off_campus", "unverified"], required=True)
    parser.add_argument("--area")
    parser.add_argument("--address")
    parser.add_argument("--fence", type=parse_bool)
    parser.add_argument("--price", type=int)
    parser.add_argument("--pricing-note")
    parser.add_argument("--file", type=Path, default=Path("data/hostels.json"))
    arguments = parser.parse_args()
    changed = update_segment(arguments.file, arguments.segment, arguments.area, arguments.address, arguments.fence, arguments.price, arguments.pricing_note)
    print(f"Updated {changed} {arguments.segment} record(s) in {arguments.file}")


if __name__ == "__main__":
    main()
