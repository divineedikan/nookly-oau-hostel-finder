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
    priced = frame.dropna(subset=["price_per_year_ngn"]).copy()
    summary = priced.groupby("area", dropna=False)["price_per_year_ngn"].agg(["count", "mean", "median", "min", "max"])
    summary.to_csv(output_dir / "price_summary_by_area.csv")
    (output_dir / "sample_size.txt").write_text(
        f"Total records: {len(frame)}\nRecords with price: {len(priced)}\nRecords with price and distance: {len(priced.dropna(subset=['distance_to_gate_km']))}\n",
        encoding="utf-8",
    )

    if priced.empty:
        return
    priced["price_per_year_ngn"].plot.hist(bins=min(10, max(1, len(priced))), color="#1d684e", edgecolor="white")
    plt.xlabel("Annual rent (NGN)")
    plt.ylabel("Listings")
    plt.tight_layout()
    plt.savefig(output_dir / "price_histogram.png", dpi=160)
    plt.close()

    scatter = priced.dropna(subset=["distance_to_gate_km"])
    if scatter.empty:
        return
    scatter.plot.scatter(x="distance_to_gate_km", y="price_per_year_ngn", color="#ef795f")
    plt.xlabel("Distance to OAU main gate (km)")
    plt.ylabel("Annual rent (NGN)")
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
