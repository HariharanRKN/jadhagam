#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple


ROOT = Path(__file__).resolve().parents[1]
ONTOLOGY_DIR = ROOT / "ontology"


def _load(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _iter_dims_from_catalog(catalog: Dict[str, Any]) -> Iterable[Tuple[str, Dict[str, float]]]:
    for name, obj in catalog.items():
        dims = obj.get("dimensions")
        if isinstance(dims, dict):
            yield name, dims  # type: ignore[misc]


def _iter_dims_from_plain_map(m: Dict[str, Any]) -> Iterable[Tuple[str, Dict[str, float]]]:
    for name, dims in m.items():
        if isinstance(dims, dict):
            yield name, dims  # type: ignore[misc]


def _validate_weights(label: str, dims: Dict[str, Any], errors: list[str]) -> None:
    for k, v in dims.items():
        if not isinstance(k, str) or not k:
            errors.append(f"{label}: invalid dimension key {k!r}")
            continue
        if not isinstance(v, (int, float)):
            errors.append(f"{label}: {k} weight not number: {v!r}")
            continue
        if v < 0 or v > 1:
            errors.append(f"{label}: {k} weight out of range [0,1]: {v}")


def main() -> None:
    dims_path = ONTOLOGY_DIR / "dimensions.json"
    planets_path = ONTOLOGY_DIR / "planets.json"
    events_path = ONTOLOGY_DIR / "events.json"
    conjunctions_path = ONTOLOGY_DIR / "conjunctions.json"

    if not dims_path.exists():
        print("Missing ontology/dimensions.json", file=sys.stderr)
        raise SystemExit(2)

    dimensions_doc = _load(dims_path)
    dim_defs = dimensions_doc.get("dimensions", {})
    if not isinstance(dim_defs, dict) or not dim_defs:
        print("dimensions.json must contain non-empty { dimensions: {...} }", file=sys.stderr)
        raise SystemExit(2)

    known_dims = set(dim_defs.keys())

    planets = _load(planets_path)
    events = _load(events_path)
    conjunctions = _load(conjunctions_path)

    errors: list[str] = []
    used_dims: Counter[str] = Counter()
    by_file_unknown: dict[str, set[str]] = defaultdict(set)
    by_file_used: dict[str, set[str]] = defaultdict(set)

    for name, dims in _iter_dims_from_catalog(planets):
        label = f"planets.json:{name}"
        _validate_weights(label, dims, errors)
        for d in dims.keys():
            used_dims[d] += 1
            by_file_used["planets.json"].add(d)
            if d not in known_dims:
                by_file_unknown["planets.json"].add(d)

    for name, dims in _iter_dims_from_catalog(events):
        label = f"events.json:{name}"
        _validate_weights(label, dims, errors)
        for d in dims.keys():
            used_dims[d] += 1
            by_file_used["events.json"].add(d)
            if d not in known_dims:
                by_file_unknown["events.json"].add(d)

    for name, dims in _iter_dims_from_plain_map(conjunctions):
        label = f"conjunctions.json:{name}"
        _validate_weights(label, dims, errors)
        for d in dims.keys():
            used_dims[d] += 1
            by_file_used["conjunctions.json"].add(d)
            if d not in known_dims:
                by_file_unknown["conjunctions.json"].add(d)

    unused_dims = sorted(known_dims - set(used_dims.keys()))

    report = {
        "knownDimensions": len(known_dims),
        "usedDimensions": len(used_dims),
        "unusedDimensions": unused_dims,
        "unknownDimensionsByFile": {k: sorted(v) for k, v in by_file_unknown.items()},
        "dimensionUseTop": used_dims.most_common(25),
        "errors": errors,
    }

    # Exit non-zero if there are structural errors or unknown dimensions referenced.
    ok = not errors and all(len(v) == 0 for v in by_file_unknown.values())
    print(json.dumps(report, indent=2, sort_keys=True))
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()

