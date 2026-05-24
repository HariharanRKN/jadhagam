from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict

ONTOLOGY_DIR = Path(__file__).resolve().parents[1] / "ontology"


def _load_json(name: str) -> dict:
    with open(ONTOLOGY_DIR / name, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{name} must be a JSON object")
    return data


def _extract_dimensions(catalog: dict) -> Dict[str, Dict[str, float]]:
    out: Dict[str, Dict[str, float]] = {}
    for name, obj in catalog.items():
        if not isinstance(obj, dict):
            continue
        dims = obj.get("dimensions")
        if isinstance(dims, dict):
            out[name] = {str(k): float(v) for k, v in dims.items() if isinstance(v, (int, float))}
    return out


@lru_cache(maxsize=1)
def _planets() -> Dict[str, Dict[str, float]]:
    return _extract_dimensions(_load_json("planets.json"))


@lru_cache(maxsize=1)
def _events() -> Dict[str, Dict[str, float]]:
    return _extract_dimensions(_load_json("events.json"))


EVENTS: Dict[str, Dict[str, float]] = _events()


def get_planet_vector(name: str) -> Dict[str, float]:
    try:
        return dict(_planets()[name])
    except KeyError as exc:
        raise KeyError(f"unknown planet: {name}") from exc


def get_event_vector(name: str) -> Dict[str, float]:
    try:
        return dict(_events()[name])
    except KeyError as exc:
        raise KeyError(f"unknown event: {name}") from exc
