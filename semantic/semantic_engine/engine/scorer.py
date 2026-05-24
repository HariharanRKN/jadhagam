from __future__ import annotations

from typing import Dict


class SemanticScorer:
    @staticmethod
    def score(event_vector: Dict[str, float], dasha_vector: Dict[str, float]) -> float:
        if not event_vector or not dasha_vector:
            return 0.0

        dot = 0.0
        event_norm = 0.0
        dasha_norm = 0.0
        for dim, event_w in event_vector.items():
            dasha_w = dasha_vector.get(dim, 0.0)
            dot += event_w * dasha_w
            event_norm += event_w * event_w
            dasha_norm += dasha_w * dasha_w

        if event_norm <= 0.0 or dasha_norm <= 0.0:
            return 0.0
        return dot / ((event_norm**0.5) * (dasha_norm**0.5))
