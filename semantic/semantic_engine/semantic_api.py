import json
import sys
from typing import Any, Dict, List, Optional, TypedDict, cast

from semantic_engine.engine.dasha_engine import DashaEngine
from semantic_engine.engine.ontology_loader import EVENTS, get_event_vector
from semantic_engine.engine.scorer import SemanticScorer


def _read_stdin_json() -> Dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


class PeriodIn(TypedDict, total=False):
    start: str
    end: Optional[str]
    mahadasha: str
    bhukti: str
    antara: Optional[str]


def _score_period(event_vector: Dict[str, float], p: PeriodIn) -> Dict[str, Any]:
    mahadasha = p.get("mahadasha")
    bhukti = p.get("bhukti")
    antara = p.get("antara")
    if not isinstance(mahadasha, str) or not isinstance(bhukti, str):
        raise KeyError("period missing mahadasha/bhukti")
    if antara is not None and not isinstance(antara, str):
        antara = None

    dasha_vector = DashaEngine.compose_dasha(mahadasha=mahadasha, bhukti=bhukti, antara=antara)
    score = SemanticScorer.score(event_vector, dasha_vector)
    return {
        "start": p.get("start"),
        "end": p.get("end"),
        "mahadasha": mahadasha,
        "bhukti": bhukti,
        "antara": antara,
        "score": score,
        "dashaVector": dasha_vector,
    }


def main() -> None:
    payload = _read_stdin_json()

    # Timeline mode: score many periods in one process to avoid repeated spawns.
    if isinstance(payload.get("periods"), list):
        event_name = payload.get("event")
        if not isinstance(event_name, str) or not event_name.strip():
            print(json.dumps({"error": "event is required for periods scoring"}))
            raise SystemExit(2)
        try:
            event_vector = get_event_vector(event_name.strip())
        except KeyError:
            print(json.dumps({"error": f"unknown event: {event_name}"}))
            raise SystemExit(2)

        periods_raw = cast(List[Any], payload.get("periods"))
        periods: List[PeriodIn] = [cast(PeriodIn, p) for p in periods_raw if isinstance(p, dict)]
        scored: List[Dict[str, Any]] = []
        for p in periods:
            try:
                scored.append(_score_period(event_vector, p))
            except Exception:
                continue

        scored.sort(key=lambda r: float(r.get("score") or 0.0), reverse=True)

        limit = payload.get("limit")
        if isinstance(limit, int) and limit > 0:
            scored = scored[:limit]

        # Optionally omit vectors to keep payload small.
        include_vectors = payload.get("includeVectors")
        if include_vectors is False:
            for r in scored:
                r.pop("dashaVector", None)

        print(json.dumps({"event": event_name.strip(), "rankedPeriods": scored}))
        return

    mahadasha = payload.get("mahadasha")
    bhukti = payload.get("bhukti")
    antara = payload.get("antara")

    if not isinstance(mahadasha, str) or not isinstance(bhukti, str):
        print(json.dumps({"error": "mahadasha and bhukti are required strings"}))
        raise SystemExit(2)

    if antara is not None and not isinstance(antara, str):
        print(json.dumps({"error": "antara must be a string when provided"}))
        raise SystemExit(2)

    dasha_vector = DashaEngine.compose_dasha(mahadasha=mahadasha, bhukti=bhukti, antara=antara)

    events: Optional[List[str]] = payload.get("events")
    event: Optional[str] = payload.get("event")
    event_names: List[str]
    if isinstance(events, list) and all(isinstance(x, str) for x in events):
        event_names = events
    elif isinstance(event, str) and event.strip():
        event_names = [event.strip()]
    else:
        event_names = list(EVENTS.keys())

    scores: Dict[str, float] = {}
    for name in event_names:
        try:
            ev = get_event_vector(name)
        except KeyError:
            continue
        scores[name] = SemanticScorer.score(ev, dasha_vector)

    out = {
        "input": {"mahadasha": mahadasha, "bhukti": bhukti, "antara": antara},
        "dashaVector": dasha_vector,
        "scores": scores,
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
