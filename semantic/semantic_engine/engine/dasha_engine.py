from __future__ import annotations

from typing import Dict, Optional

from semantic_engine.engine.ontology_loader import get_planet_vector

# Mahadasha dominates; bhukti and antara refine the active period vector.
_LEVEL_WEIGHTS = (0.55, 0.30, 0.15)


class DashaEngine:
    @staticmethod
    def compose_dasha(
        *,
        mahadasha: str,
        bhukti: str,
        antara: Optional[str] = None,
    ) -> Dict[str, float]:
        levels = [mahadasha, bhukti]
        weights = list(_LEVEL_WEIGHTS[:2])
        if antara:
            levels.append(antara)
            weights = list(_LEVEL_WEIGHTS)

        vectors = [get_planet_vector(name) for name in levels]
        total_w = sum(weights)
        merged: Dict[str, float] = {}
        for vec, weight in zip(vectors, weights):
            share = weight / total_w
            for dim, value in vec.items():
                merged[dim] = merged.get(dim, 0.0) + value * share
        return merged
