#!/usr/bin/env python3
"""PR smoke checks: pipes still answer. Does not assert astrology correctness."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = ROOT / "tests" / "fixtures" / "pondicherry-birth.json"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def ok(msg: str) -> None:
    print(f"ok: {msg}")


def load_fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def run_dasha_normalize_unit() -> None:
    proc = subprocess.run(
        [python_bin(), str(ROOT / "tests" / "test_dasha_normalize.py")],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        check=False,
    )
    if proc.returncode != 0:
        fail(
            "tests/test_dasha_normalize.py failed: "
            f"{proc.stderr.strip()[:2000] or proc.stdout.strip()[:500]}"
        )
    ok("tests/test_dasha_normalize.py")


def is_record(v: Any) -> bool:
    return isinstance(v, dict)


def require_keys(obj: Any, keys: list[str], label: str) -> dict[str, Any]:
    if not is_record(obj):
        fail(f"{label}: expected object, got {type(obj).__name__}")
    missing = [k for k in keys if k not in obj]
    if missing:
        fail(f"{label}: missing keys {missing}")
    return obj


def python_bin() -> str:
    return os.environ.get("HOROSCOPE_PYTHON") or sys.executable


def run_horoscope_engine(fixture: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "name": fixture.get("name"),
        "gender": fixture.get("gender"),
        "birth": fixture["birth"],
        "place": fixture["place"],
        "transit": fixture.get("transit"),
    }
    proc = subprocess.run(
        [python_bin(), str(ROOT / "horoscope.py"), "--stdin-ui"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        check=False,
    )
    if proc.returncode != 0:
        fail(
            "horoscope.py --stdin-ui exited "
            f"{proc.returncode}: {proc.stderr.strip()[:2000] or proc.stdout.strip()[:500]}"
        )
    try:
        chart = json.loads(proc.stdout.strip().splitlines()[-1])
    except json.JSONDecodeError as e:
        fail(f"horoscope.py stdout was not JSON: {e}; stdout={proc.stdout[:500]!r}")
    assert_chart_shape(chart, "horoscope.py")
    ok("horoscope.py --stdin-ui")
    return chart


def run_ontology_check() -> None:
    proc = subprocess.run(
        [python_bin(), str(ROOT / "semantic" / "semantic_engine" / "tools" / "check_ontology.py")],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        check=False,
    )
    if proc.returncode != 0:
        fail(f"check_ontology.py exited {proc.returncode}: {proc.stdout[-1500:]}{proc.stderr[-500:]}")
    ok("ontology check")


def run_semantic_engine() -> None:
    payload = {
        "mahadasha": "Jupiter",
        "bhukti": "Saturn",
        "antara": "Venus",
        "event": "marriage",
    }
    env = os.environ.copy()
    semantic_cwd = str(ROOT / "semantic")
    env["PYTHONPATH"] = semantic_cwd + (f":{env['PYTHONPATH']}" if env.get("PYTHONPATH") else "")
    proc = subprocess.run(
        [python_bin(), "-m", "semantic_engine.semantic_api"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=semantic_cwd,
        env=env,
        check=False,
    )
    if proc.returncode != 0:
        fail(f"semantic_api exited {proc.returncode}: {proc.stderr.strip()[:2000]}")
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        fail(f"semantic_api stdout was not JSON: {e}; stdout={proc.stdout[:500]!r}")
    if "error" in data and "score" not in data and "rankedPeriods" not in data:
        fail(f"semantic_api returned error: {data}")
    ok("semantic_engine.semantic_api")


def assert_chart_shape(chart: Any, label: str) -> None:
    obj = require_keys(
        chart,
        ["meta", "birth", "transit", "natalLagna", "natalPlanets", "transitPlanets", "vimsottari"],
        label,
    )
    birth = require_keys(obj["birth"], ["planetsByRasi", "ascendantRasi"], f"{label}.birth")
    if not isinstance(birth["ascendantRasi"], (int, float)):
        fail(f"{label}.birth.ascendantRasi must be a number")
    natal = obj["natalPlanets"]
    if not isinstance(natal, list) or len(natal) < 9:
        fail(f"{label}.natalPlanets must be a non-empty list of planets")
    if any(isinstance(row, dict) and row.get("planetId") == -1 for row in natal):
        fail(f"{label}.natalPlanets must not include Lagna (planetId -1)")
    lagna = require_keys(
        obj["natalLagna"],
        ["planetId", "planetEn", "rasi", "degInSign", "totalLongitude", "nakshatraTa", "pada"],
        f"{label}.natalLagna",
    )
    if lagna.get("planetId") != -1 or lagna.get("planetEn") != "Lagna":
        fail(f"{label}.natalLagna must be Lagna with planetId -1")
    if not isinstance(lagna.get("degInSign"), (int, float)):
        fail(f"{label}.natalLagna.degInSign must be a number")
    if not isinstance(lagna.get("pada"), int) or not (1 <= lagna["pada"] <= 4):
        fail(f"{label}.natalLagna.pada must be 1..4")
    vims = require_keys(obj["vimsottari"], ["mahadasha", "bhukti", "antara"], f"{label}.vimsottari")
    if not isinstance(vims["mahadasha"], list) or not vims["mahadasha"]:
        fail(f"{label}.vimsottari.mahadasha must be a non-empty list")


def http_json(
    base: str,
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    timeout: float = 120,
) -> tuple[int, Any]:
    url = base.rstrip("/") + path
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        status = e.code
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw[:800]
        fail(f"{method} {path} -> HTTP {status}: {parsed}")
    except urllib.error.URLError as e:
        fail(f"{method} {path} failed: {e}")
    try:
        parsed = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        fail(f"{method} {path} returned non-JSON: {raw[:500]!r}")
    return status, parsed


def http_get_ok(base: str, path: str) -> None:
    url = base.rstrip("/") + path
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            body = resp.read()
    except urllib.error.HTTPError as e:
        fail(f"GET {path} -> HTTP {e.code}")
    except urllib.error.URLError as e:
        fail(f"GET {path} failed: {e}")
    if status != 200 or not body:
        fail(f"GET {path} -> HTTP {status} empty={not body}")
    ok(f"GET {path}")


def smoke_http(base: str, fixture: dict[str, Any]) -> None:
    for path in ("/", "/marriage-2", "/ask"):
        http_get_ok(base, path)

    horoscope_body = {
        "name": fixture.get("name"),
        "gender": fixture.get("gender"),
        "birth": fixture["birth"],
        "place": fixture["place"],
        "transit": fixture.get("transit"),
    }
    status, chart = http_json(base, "POST", "/api/horoscope", horoscope_body)
    if status != 200:
        fail(f"POST /api/horoscope -> HTTP {status}")
    if is_record(chart) and chart.get("error"):
        fail(f"POST /api/horoscope error: {chart}")
    assert_chart_shape(chart, "POST /api/horoscope")
    ok("POST /api/horoscope")

    status, marriage = http_json(
        base,
        "POST",
        "/api/prediction/marriage",
        {"chart": chart, "language": "en"},
    )
    if status != 200:
        fail(f"POST /api/prediction/marriage -> HTTP {status}")
    require_keys(marriage, ["overview", "foundation", "periodSequence", "reasoning"], "marriage")
    overview = require_keys(marriage["overview"], ["marriageStrengthScore", "summary"], "marriage.overview")
    if not isinstance(overview["summary"], str) or not overview["summary"].strip():
        fail("marriage.overview.summary is empty")
    ok("POST /api/prediction/marriage")

    status, houses = http_json(base, "POST", "/api/house-analysis", chart)
    if status != 200:
        fail(f"POST /api/house-analysis -> HTTP {status}")
    require_keys(houses, ["houses", "ascendantRasi"], "house-analysis")
    if not isinstance(houses["houses"], list) or len(houses["houses"]) != 12:
        fail("house-analysis.houses must have 12 houses")
    ok("POST /api/house-analysis")

    status, ask = http_json(
        base,
        "POST",
        "/api/ask",
        {
            "dob": fixture["dob"],
            "tob": fixture["tob"],
            "place": fixture["placeQuery"],
            "questionText": fixture["questionText"],
            "eventOverride": fixture["eventOverride"],
            "mode": "now",
            "limit": 5,
        },
        timeout=180,
    )
    if status != 200:
        fail(f"POST /api/ask -> HTTP {status}")
    require_keys(ask, ["chosen", "semantic"], "ask")
    semantic = ask["semantic"]
    if not is_record(semantic) or not semantic:
        fail("ask.semantic missing")
    ok("POST /api/ask")


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke the jadhagam chart/prediction pipes")
    parser.add_argument("--base-url", default=os.environ.get("SMOKE_BASE_URL", ""), help="Next.js origin, e.g. http://127.0.0.1:3000")
    parser.add_argument("--engine-only", action="store_true", help="Skip HTTP checks")
    args = parser.parse_args()

    fixture = load_fixture()
    run_dasha_normalize_unit()
    run_ontology_check()
    run_horoscope_engine(fixture)
    run_semantic_engine()

    if args.engine_only:
        print("engine smoke passed")
        return
    if not args.base_url:
        fail("pass --base-url or set SMOKE_BASE_URL (or use --engine-only)")
    smoke_http(args.base_url, fixture)
    print("smoke passed")


if __name__ == "__main__":
    main()
