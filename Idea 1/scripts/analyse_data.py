"""Create descriptive statistics and charts from the real cleaned dataset."""
from __future__ import annotations

import argparse
from pathlib import Path


def analyse(input_path: Path, output_dir: Path) -> None:
    try:
        import matplotlib.pyplot as plt
        import pandas as pd
    except ImportError as error:
        raise RuntimeError("analysis requires pandas and matplotlib; install requirements.txt") from error

    frame = pd.read_json(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    # Starting price matches the app: minimum, else fixed yearly price, else maximum.
    frame["starting_price_ngn"] = frame["price_min_ngn"].fillna(frame["price_per_year_ngn"]).fillna(frame["price_max_ngn"])
    frame["location_type"] = frame["campus_status"].map(lambda status: "On campus" if status == "on_campus" else "Off campus")
    frame["area"] = frame["area"].fillna("Area not stated")
    priced = frame.dropna(subset=["starting_price_ngn"]).copy()
    # Campus rent is per session and off-campus rent is per year, so they are never averaged together.
    summary = priced.groupby(["rent_period", "location_type", "area"])["starting_price_ngn"].agg(["count", "mean", "median", "min", "max"]).round(0)
    summary.to_csv(output_dir / "price_summary_by_area.csv")
    yearly = priced[priced["rent_period"] == "year"]
    (output_dir / "sample_size.txt").write_text(
        f"Total records: {len(frame)}\n"
        f"On campus: {(frame['location_type'] == 'On campus').sum()}\n"
        f"Off campus: {(frame['location_type'] == 'Off campus').sum()}\n"
        f"Records with price: {len(priced)}\n"
        f"Records with per-session price (on campus): {(priced['rent_period'] == 'session').sum()}\n"
        f"Records with yearly price (off campus): {len(yearly)}\n"
        f"Records with yearly price and distance: {len(yearly.dropna(subset=['distance_to_gate_km']))}\n",
        encoding="utf-8",
    )

    if yearly.empty:
        return
    yearly["starting_price_ngn"].plot.hist(bins=min(10, max(1, len(yearly))), color="#1d684e", edgecolor="white")
    plt.xlabel("Off-campus starting rent per year (NGN)")
    plt.ylabel("Listings")
    plt.gca().yaxis.get_major_locator().set_params(integer=True)
    plt.tight_layout()
    plt.savefig(output_dir / "price_histogram.png", dpi=160)
    plt.close()

    scatter = yearly.dropna(subset=["distance_to_gate_km"])
    if scatter.empty:
        return
    scatter.plot.scatter(x="distance_to_gate_km", y="starting_price_ngn", color="#ef795f")
    plt.xlabel("Distance to OAU main gate (km)")
    plt.ylabel("Off-campus starting rent per year (NGN)")
    plt.tight_layout()
    plt.savefig(output_dir / "distance_price_scatter.png", dpi=160)
    plt.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("data/hostels.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/analysis"))
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    analyse(input_path=arguments.input, output_dir=arguments.output_dir)
