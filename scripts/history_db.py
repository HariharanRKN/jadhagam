#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import io
import json
import sqlite3
import sys
import warnings
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

warnings.filterwarnings("ignore")
with contextlib.redirect_stdout(io.StringIO()):
    from jhora import const
    from jhora.horoscope.chart import charts
    from jhora.panchanga import drik
    from horoscope import PLANET_NAMES, _planet_table_rows, _transit_julday

IST = timezone(timedelta(hours=5, minutes=30), name="IST")
SNAPSHOT_TIME_IST = time(12, 0, 0)
DEFAULT_START_DATE = date(1960, 1, 1)
DEFAULT_DB_PATH = ROOT / "data" / "planet_positions.sqlite"

PLANET_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
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
PLANET_NAME_TO_ID = {
    "sun": 0,
    "moon": 1,
    "mars": 2,
    "mercury": 3,
    "jupiter": 4,
    "guru": 4,
    "venus": 5,
    "sukra": 5,
    "shukra": 5,
    "saturn": 6,
    "rahu": 7,
    "ketu": 8,
}
RASI_NAME_TO_ID = {
    "mesha": 0,
    "aries": 0,
    "rishabha": 1,
    "taurus": 1,
    "mithuna": 2,
    "gemini": 2,
    "karkata": 3,
    "cancer": 3,
    "simha": 4,
    "leo": 4,
    "kanya": 5,
    "virgo": 5,
    "tula": 6,
    "libra": 6,
    "vrischika": 7,
    "scorpio": 7,
    "dhanu": 8,
    "sagittarius": 8,
    "makara": 9,
    "capricorn": 9,
    "kumbha": 10,
    "aquarius": 10,
    "meena": 11,
    "pisces": 11,
}


@dataclass(frozen=True)
class SnapshotRow:
    date_ist: str
    ts_ist: str
    ts_utc: str
    positions: dict[str, dict[str, float | int | str]]


def db_path_from_arg(path_arg: str | None) -> Path:
    return Path(path_arg).expanduser().resolve() if path_arg else DEFAULT_DB_PATH


def normalize_planet_name(name: str) -> tuple[int, str]:
    key = name.strip().lower()
    if key not in PLANET_NAME_TO_ID:
        raise ValueError(f"Unsupported planet: {name}")
    pid = PLANET_NAME_TO_ID[key]
    return pid, PLANET_KEYS[pid]


def normalize_rasi(value: str | int) -> int:
    if isinstance(value, int):
        if 0 <= value <= 11:
            return value
        raise ValueError("Rasi id must be between 0 and 11")
    text = str(value).strip().lower()
    if text.isdigit():
        return normalize_rasi(int(text))
    if text not in RASI_NAME_TO_ID:
        raise ValueError(f"Unsupported rasi: {value}")
    return RASI_NAME_TO_ID[text]


def snapshot_datetime_ist(day: date) -> datetime:
    return datetime.combine(day, SNAPSHOT_TIME_IST, tzinfo=IST)


def compute_snapshot(day: date) -> SnapshotRow:
    drik.set_ayanamsa_mode("LAHIRI")
    const.use_rahu_ketu_as_true_nodes = False

    dt_ist = snapshot_datetime_ist(day)
    jd = _transit_julday(dt_ist)
    place = drik.Place("IST Reference", 13.0827, 80.2707, 5.5)
    planet_positions = charts.rasi_chart(jd, place)

    by_planet_id = {
        row["planetId"]: row
        for row in _planet_table_rows(planet_positions)
        if row["planetId"] in PLANET_IDS
    }

    positions: dict[str, dict[str, float | int | str]] = {}
    for pid in PLANET_IDS:
        row = by_planet_id[pid]
        key = PLANET_KEYS[pid]
        positions[key] = {
            "planetId": pid,
            "planetEn": PLANET_NAMES[pid],
            "rasi": row["rasi"],
            "rasiTa": row["rasiTa"],
            "degInSign": row["degInSign"],
            "totalLongitude": row["totalLongitude"],
            "nakshatraTa": row["nakshatraTa"],
            "pada": row["pada"],
        }

    return SnapshotRow(
        date_ist=day.isoformat(),
        ts_ist=dt_ist.isoformat(),
        ts_utc=dt_ist.astimezone(timezone.utc).isoformat(),
        positions=positions,
    )


def connect_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS planet_positions (
            date_ist TEXT PRIMARY KEY,
            ts_ist TEXT NOT NULL,
            ts_utc TEXT NOT NULL,
            sun_rasi INTEGER NOT NULL,
            sun_deg REAL NOT NULL,
            sun_long REAL NOT NULL,
            moon_rasi INTEGER NOT NULL,
            moon_deg REAL NOT NULL,
            moon_long REAL NOT NULL,
            mars_rasi INTEGER NOT NULL,
            mars_deg REAL NOT NULL,
            mars_long REAL NOT NULL,
            mercury_rasi INTEGER NOT NULL,
            mercury_deg REAL NOT NULL,
            mercury_long REAL NOT NULL,
            jupiter_rasi INTEGER NOT NULL,
            jupiter_deg REAL NOT NULL,
            jupiter_long REAL NOT NULL,
            venus_rasi INTEGER NOT NULL,
            venus_deg REAL NOT NULL,
            venus_long REAL NOT NULL,
            saturn_rasi INTEGER NOT NULL,
            saturn_deg REAL NOT NULL,
            saturn_long REAL NOT NULL,
            rahu_rasi INTEGER NOT NULL,
            rahu_deg REAL NOT NULL,
            rahu_long REAL NOT NULL,
            ketu_rasi INTEGER NOT NULL,
            ketu_deg REAL NOT NULL,
            ketu_long REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_positions_ts_ist ON planet_positions(ts_ist);
        CREATE INDEX IF NOT EXISTS idx_positions_jupiter_venus_rasi_date
            ON planet_positions(jupiter_rasi, venus_rasi, date_ist);
        """
    )


def row_to_insert(snapshot: SnapshotRow) -> tuple[object, ...]:
    values: list[object] = [snapshot.date_ist, snapshot.ts_ist, snapshot.ts_utc]
    for key in [PLANET_KEYS[pid] for pid in PLANET_IDS]:
        values.extend(
            [
                snapshot.positions[key]["rasi"],
                snapshot.positions[key]["degInSign"],
                snapshot.positions[key]["totalLongitude"],
            ]
        )
    return tuple(values)


def build_database(path: Path, start_day: date, end_day: date) -> dict[str, object]:
    if end_day < start_day:
        raise ValueError("end date must be on or after start date")

    conn = connect_db(path)
    create_schema(conn)

    current = start_day
    rows: list[tuple[object, ...]] = []
    total = 0
    while current <= end_day:
        rows.append(row_to_insert(compute_snapshot(current)))
        total += 1
        current += timedelta(days=1)

        if len(rows) >= 250:
            conn.executemany(
                """
                INSERT OR REPLACE INTO planet_positions (
                    date_ist, ts_ist, ts_utc,
                    sun_rasi, sun_deg, sun_long,
                    moon_rasi, moon_deg, moon_long,
                    mars_rasi, mars_deg, mars_long,
                    mercury_rasi, mercury_deg, mercury_long,
                    jupiter_rasi, jupiter_deg, jupiter_long,
                    venus_rasi, venus_deg, venus_long,
                    saturn_rasi, saturn_deg, saturn_long,
                    rahu_rasi, rahu_deg, rahu_long,
                    ketu_rasi, ketu_deg, ketu_long
                ) VALUES (
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?
                )
                """,
                rows,
            )
            conn.commit()
            rows.clear()

    if rows:
        conn.executemany(
            """
            INSERT OR REPLACE INTO planet_positions (
                date_ist, ts_ist, ts_utc,
                sun_rasi, sun_deg, sun_long,
                moon_rasi, moon_deg, moon_long,
                mars_rasi, mars_deg, mars_long,
                mercury_rasi, mercury_deg, mercury_long,
                jupiter_rasi, jupiter_deg, jupiter_long,
                venus_rasi, venus_deg, venus_long,
                saturn_rasi, saturn_deg, saturn_long,
                rahu_rasi, rahu_deg, rahu_long,
                ketu_rasi, ketu_deg, ketu_long
            ) VALUES (
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?
            )
            """,
            rows,
        )
        conn.commit()

    metadata = {
        "coverage_start_ist": start_day.isoformat(),
        "coverage_end_ist": end_day.isoformat(),
        "granularity": "daily",
        "snapshot_time_ist": SNAPSHOT_TIME_IST.isoformat(),
        "timezone": "IST",
        "ayanamsa": "Lahiri",
        "node_type": "mean",
        "updated_at_utc": datetime.now(timezone.utc).isoformat(),
        "row_count": str(total),
    }
    conn.executemany(
        "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
        metadata.items(),
    )
    conn.commit()
    conn.close()
    return {"dbPath": str(path), "rowCount": total, **metadata}


def fetch_positions(path: Path, target_day: date) -> dict[str, object]:
    conn = connect_db(path)
    row = conn.execute(
        "SELECT * FROM planet_positions WHERE date_ist = ?",
        (target_day.isoformat(),),
    ).fetchone()
    if row is None:
        raise ValueError(f"No snapshot found for {target_day.isoformat()}")
    metadata = dict(conn.execute("SELECT key, value FROM metadata").fetchall())
    conn.close()

    positions = {}
    for pid in PLANET_IDS:
        key = PLANET_KEYS[pid]
        positions[key] = {
            "planetId": pid,
            "planetEn": PLANET_NAMES[pid],
            "rasi": row[f"{key}_rasi"],
            "degInSign": row[f"{key}_deg"],
            "totalLongitude": row[f"{key}_long"],
        }

    return {
        "dateIst": row["date_ist"],
        "timestampIst": row["ts_ist"],
        "timestampUtc": row["ts_utc"],
        "positions": positions,
        "metadata": metadata,
    }


def contiguous_ranges(rows: Iterable[sqlite3.Row]) -> list[dict[str, object]]:
    items = list(rows)
    if not items:
        return []
    ranges: list[dict[str, object]] = []
    start = items[0]["date_ist"]
    prev = items[0]["date_ist"]
    for row in items[1:]:
        current = row["date_ist"]
        prev_date = date.fromisoformat(prev)
        current_date = date.fromisoformat(current)
        if current_date == prev_date + timedelta(days=1):
            prev = current
            continue
        ranges.append({"startDateIst": start, "endDateIst": prev})
        start = current
        prev = current
    ranges.append({"startDateIst": start, "endDateIst": prev})
    return ranges


def search_dates_for_positions(
    path: Path,
    planets: list[str],
    rasi: str | int,
    start_day: date,
    end_day: date,
) -> dict[str, object]:
    if not planets:
        raise ValueError("At least one planet is required")

    planet_keys: list[str] = []
    for name in planets:
        _, key = normalize_planet_name(name)
        if key not in planet_keys:
            planet_keys.append(key)

    rasi_id = normalize_rasi(rasi)

    where = ["date_ist >= ?", "date_ist <= ?"]
    params: list[object] = [start_day.isoformat(), end_day.isoformat()]
    for key in planet_keys:
        where.append(f"{key}_rasi = ?")
        params.append(rasi_id)

    conn = connect_db(path)
    rows = conn.execute(
        f"""
        SELECT date_ist, ts_ist, ts_utc
        FROM planet_positions
        WHERE {' AND '.join(where)}
        ORDER BY date_ist ASC
        """,
        params,
    ).fetchall()
    conn.close()

    return {
        "planets": planet_keys,
        "rasi": rasi_id,
        "fromDateIst": start_day.isoformat(),
        "toDateIst": end_day.isoformat(),
        "matchCount": len(rows),
        "matches": [dict(row) for row in rows],
        "ranges": contiguous_ranges(rows),
    }


def parse_date_arg(value: str) -> date:
    return date.fromisoformat(value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build and query historical planetary positions")
    parser.add_argument("--db", help="Path to SQLite database")

    sub = parser.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build", help="Build or refresh the historical database")
    build.add_argument("--start-date", default=DEFAULT_START_DATE.isoformat())
    build.add_argument("--end-date", default=date.today().isoformat())

    position = sub.add_parser("position-on-date", help="Get positions for an IST date")
    position.add_argument("--date", required=True)

    search = sub.add_parser("search-rasi", help="Find dates where planets were in a given rasi")
    search.add_argument("--planet", action="append", required=True, dest="planets")
    search.add_argument("--rasi", required=True)
    search.add_argument("--start-date", required=True)
    search.add_argument("--end-date", required=True)

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db_path = db_path_from_arg(args.db)

    if args.command == "build":
        result = build_database(
            db_path,
            parse_date_arg(args.start_date),
            parse_date_arg(args.end_date),
        )
    elif args.command == "position-on-date":
        result = fetch_positions(db_path, parse_date_arg(args.date))
    elif args.command == "search-rasi":
        result = search_dates_for_positions(
            db_path,
            args.planets,
            args.rasi,
            parse_date_arg(args.start_date),
            parse_date_arg(args.end_date),
        )
    else:
        raise ValueError(f"Unsupported command: {args.command}")

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
