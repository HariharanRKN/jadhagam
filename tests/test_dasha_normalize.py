#!/usr/bin/env python3
"""Unit tests for PyJHora 4.7/4.8 dasha row normalization (no live ephemeris)."""
from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from horoscope import (  # noqa: E402
    _format_dhasa_start,
    _is_tuple_dhasa_row,
    _normalize_dhasa_rows,
    _parse_dhasa_dt,
)


class DashaNormalizeTests(unittest.TestCase):
    def test_parse_pyjhora47_ampm_string(self) -> None:
        dt = _parse_dhasa_dt("1979-06-19 21:33:00 PM")
        self.assertEqual(dt, datetime(1979, 6, 19, 21, 33, 0))

    def test_parse_gregorian_tuple(self) -> None:
        dt = _parse_dhasa_dt((1979, 6, 19, 23.754145223647356))
        self.assertEqual(dt.date(), datetime(1979, 6, 19).date())
        self.assertEqual(dt.hour, 23)
        self.assertEqual(dt.minute, 45)

    def test_detect_tuple_rows(self) -> None:
        old = [5, "1979-06-19 21:33:00 PM"]
        new = [(5,), (1979, 6, 19, 23.75), 20.0]
        self.assertFalse(_is_tuple_dhasa_row(old))
        self.assertTrue(_is_tuple_dhasa_row(new))

    def test_normalize_old_and_new_maha_rows(self) -> None:
        old_rows = [[5, "1979-06-19 21:33:00 PM"]]
        new_rows = [[(5,), (1979, 6, 19, 21.55), 20.0]]
        old_n = _normalize_dhasa_rows(old_rows)
        new_n = _normalize_dhasa_rows(new_rows)
        self.assertEqual(old_n[0][0], 5)
        self.assertEqual(new_n[0][0], 5)
        self.assertIsInstance(old_n[0][1], str)
        self.assertIsInstance(new_n[0][1], str)
        self.assertTrue(old_n[0][1].startswith("1979-06-19"))
        self.assertTrue(new_n[0][1].startswith("1979-06-19"))

    def test_normalize_sookshma_new_format_has_five_fields(self) -> None:
        row = [((5, 0, 1, 2), (1994, 5, 10, 17.0), 0.1)]
        out = _normalize_dhasa_rows(row)
        self.assertEqual(len(out[0]), 5)
        self.assertEqual(out[0][:4], [5, 0, 1, 2])
        self.assertEqual(_format_dhasa_start(out[0][4])[:10], "1994-05-10")


if __name__ == "__main__":
    unittest.main()
