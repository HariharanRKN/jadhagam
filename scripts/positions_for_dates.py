#!/usr/bin/env python3
"""Look up IST daily snapshots for a JSON list of YYYY-MM-DD dates on stdin."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "planet_positions.sqlite"
PLANET_KEYS = {
    0: "sun",
    1: "moon",
    2: "mars",
    3: "mercury",
    4: "jupiter",
    5: "venus",
    6: "saturn",
    7: "rahu",
    8: "ketu",
}
PLANET_NAMES = {
    0: "Sun",
    1: "Moon",
    2: "Mars",
    3: "Mercury",
    4: "Jupiter",
    5: "Venus",
    6: "Saturn",
    7: "Rahu",
    8: "Ketu",
}


def main() -> None:
    dates = json.load(sys.stdin)
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DB
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    out = []
    missing = []
    for date_ist in dates:
        row = conn.execute(
            "SELECT * FROM planet_positions WHERE date_ist = ?",
            (date_ist,),
        ).fetchone()
        if row is None:
            missing.append(date_ist)
            out.append({"dateIst": date_ist, "positions": None})
            continue
        positions = {}
        for pid, key in PLANET_KEYS.items():
            positions[key] = {
                "planetId": pid,
                "planetEn": PLANET_NAMES[pid],
                "rasi": row[f"{key}_rasi"],
                "degInSign": row[f"{key}_deg"],
                "totalLongitude": row[f"{key}_long"],
            }
        out.append({"dateIst": date_ist, "positions": positions})
    conn.close()
    json.dump({"snapshots": out, "missing": missing}, sys.stdout)


if __name__ == "__main__":
    main()
