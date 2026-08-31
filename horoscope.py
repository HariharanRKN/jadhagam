#!/usr/bin/env python3
from __future__ import annotations
import warnings
warnings.filterwarnings("ignore")

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import swisseph as swe
from jhora.panchanga import drik
from jhora import const
from jhora.horoscope.chart import charts

PLANET_NAMES = {
    0: "Sun", 1: "Moon", 2: "Mars", 3: "Mercury", 4: "Jupiter",
    5: "Venus", 6: "Saturn", 7: "Rahu", 8: "Ketu",
    9: "Uranus", 10: "Neptune", 11: "Pluto"
}
RASI_NAMES = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]
NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]
TITHI_NAMES = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima/Amavasya"
]
YOGA_NAMES = [
    "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
    "Sukarma", "Dhriti", "Shoola", "Ganda", "Vriddhi", "Dhruva",
    "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan",
    "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla",
    "Brahma", "Indra", "Vaidhriti"
]
KARANA_NAMES = [
    "Kimstughna", "Bava", "Balava", "Kaulava", "Taitila", "Gara",
    "Vanija", "Vishti", "Bava", "Balava", "Kaulava", "Taitila",
    "Gara", "Vanija", "Vishti", "Bava", "Balava", "Kaulava",
    "Taitila", "Gara", "Vanija", "Vishti", "Bava", "Balava",
    "Kaulava", "Taitila", "Gara", "Vanija", "Vishti", "Bava",
    "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti",
    "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija",
    "Vishti", "Bava", "Balava", "Kaulava", "Taitila", "Gara",
    "Vanija", "Vishti", "Bava", "Balava", "Kaulava", "Taitila",
    "Gara", "Vanija", "Vishti", "Shakuni", "Chatushpada", "Nagava"
]
VAARA_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# Tamil labels for UI tables (aligned with PLANET_NAMES keys 0..8)
PLANET_TAMIL_FULL = {
    0: "சூரியன்",
    1: "சந்திரன்",
    2: "செவ்வாய்",
    3: "புதன்",
    4: "வியாழன்",
    5: "சுக்கிரன்",
    6: "சனி",
    7: "ராகு",
    8: "கேது",
}

RASI_TAMIL = {
    0: "மேஷம்", 1: "ரிஷபம்", 2: "மிதுனம்", 3: "கடகம்",
    4: "சிம்மம்", 5: "கன்னி", 6: "துலாம்", 7: "விருச்சிகம்",
    8: "தனுசு", 9: "மகரம்", 10: "கும்பம்", 11: "மீனம்",
}

NAKSHATRA_TAMIL = [
    "அஸ்வினி", "பரணி", "கிருத்திகை", "ரோகிணி", "மிருகசீரிடம்", "திருவாதிரை",
    "புனர்பூசம்", "பூசம்", "ஆயில்யம்", "மகம்", "பூரம்", "உத்திரம்",
    "அஸ்தம்", "சித்திரை", "சுவாதி", "விசாகம்", "அனுஷம்", "கேட்டை",
    "மூலம்", "பூராடம்", "உத்திராடம்", "திருவோணம்", "அவிட்டம்",
    "சதயம்", "பூரட்டாதி", "உத்திரட்டாதி", "ரேவதி",
]

VIMSOTTARI_ORDER = [8, 5, 0, 1, 2, 7, 4, 6, 3]  # Ke Ve Su Mo Ma Ra Ju Sa Me
VIMSOTTARI_YEARS = {8: 7, 5: 20, 0: 6, 1: 10, 2: 7, 7: 18, 4: 16, 6: 19, 3: 17}
SIDEREAL_YEAR_DAYS = const.sidereal_year


# Lagna is shown in natal tables but is not a graha (planetId -1).
LAGNA_PLANET_ID = -1


def nak_and_pada(total_longitude):
    nak_span = 360.0 / 27.0
    nak_idx = int(total_longitude / nak_span) % 27
    pada = int((total_longitude % nak_span) / (nak_span / 4.0)) + 1
    return NAKSHATRA_NAMES[nak_idx], pada


def _position_table_row(pid, planet_en, planet_ta, rasi, deg):
    tl = total_longitude(rasi, deg)
    nak_idx = int(tl / (360.0 / 27.0)) % 27
    _, pada = nak_and_pada(tl)
    return {
        "planetId": pid,
        "planetEn": planet_en,
        "planetTa": planet_ta,
        "rasi": rasi,
        "rasiTa": RASI_TAMIL[rasi],
        "degInSign": round(float(deg), 4),
        "totalLongitude": round(tl, 4),
        "nakshatraEn": NAKSHATRA_NAMES[nak_idx],
        "nakshatraTa": NAKSHATRA_TAMIL[nak_idx],
        "pada": pada,
    }


def _lagna_table_row(asc_rasi, asc_deg):
    return _position_table_row(
        LAGNA_PLANET_ID, "Lagna", "லக்னம்", asc_rasi, asc_deg
    )


def total_longitude(rasi, deg):
    return rasi * 30.0 + deg


def years_months_days(total_years):
    y = int(total_years)
    frac = total_years - y
    total_months = frac * 12
    m = int(total_months)
    d = int((total_months - m) * 30)
    return y, m, d


def add_years_to_date(base_dt, years_float):
    days = years_float * SIDEREAL_YEAR_DAYS
    return base_dt + timedelta(days=days)


def compute_vimsottari_dasha(moon_longitude, birth_dt):
    """
    Compute Vimsottari Dasha sequence from birth date.

    1. Find Moon's nakshatra and how much of it has been traversed.
    2. The nakshatra lord determines the running dasha at birth.
    3. The fraction of nakshatra remaining gives the balance of that dasha.
    4. Sequence the 9 dashas starting from the birth nakshatra lord.
    """
    one_star = 360.0 / 27.0
    seed_star = 3

    nak_index = int(moon_longitude / one_star)
    position_in_nak = moon_longitude - (nak_index * one_star)
    fraction_elapsed = position_in_nak / one_star
    fraction_remaining = 1.0 - fraction_elapsed

    adhipati_index = (nak_index - seed_star + 3) % 9
    birth_lord = VIMSOTTARI_ORDER[adhipati_index]

    total_period = VIMSOTTARI_YEARS[birth_lord]
    elapsed_years = fraction_elapsed * total_period
    remaining_years = fraction_remaining * total_period

    dashas = []
    cursor_dt = birth_dt

    lord = birth_lord
    first = True
    for cycle in range(2):
        for i in range(9):
            idx = (VIMSOTTARI_ORDER.index(lord) + i) % 9
            current_lord = VIMSOTTARI_ORDER[idx]

            if first:
                period = remaining_years
                is_balance = True
                first = False
            else:
                period = VIMSOTTARI_YEARS[current_lord]
                is_balance = False

            end_dt = add_years_to_date(cursor_dt, period)
            dashas.append({
                "lord": current_lord,
                "start": cursor_dt,
                "end": end_dt,
                "years": period,
                "is_balance": is_balance,
                "full_period": VIMSOTTARI_YEARS[current_lord],
            })
            cursor_dt = end_dt

            if cursor_dt > birth_dt + timedelta(days=120 * SIDEREAL_YEAR_DAYS):
                break
        if cursor_dt > birth_dt + timedelta(days=120 * SIDEREAL_YEAR_DAYS):
            break
        lord = VIMSOTTARI_ORDER[(VIMSOTTARI_ORDER.index(birth_lord) + 0) % 9]

    return {
        "moon_longitude": moon_longitude,
        "nakshatra_index": nak_index,
        "nakshatra_name": NAKSHATRA_NAMES[nak_index],
        "position_in_nak_deg": position_in_nak,
        "one_star_deg": one_star,
        "fraction_elapsed": fraction_elapsed,
        "fraction_remaining": fraction_remaining,
        "birth_lord": birth_lord,
        "total_period": total_period,
        "elapsed_years": elapsed_years,
        "remaining_years": remaining_years,
        "dashas": dashas,
    }


def export_horoscope_json():
    """
    Emit JSON for the React South Indian chart (0-based rasi keys, English planet names).
    Transit uses natal ascendantRasi for lagna highlight (same as UI contract).
    """
    drik.set_ayanamsa_mode('LAHIRI')
    const.use_rahu_ketu_as_true_nodes = False

    dob = drik.Date(1994, 5, 10)
    tob = (17, 0, 0)
    place = drik.Place("Pondicherry, IN", 11.9416, 79.8083, 5.5)
    tob_hrs = tob[0] + tob[1] / 60.0 + tob[2] / 3600.0
    jd = swe.julday(dob.year, dob.month, dob.day, tob_hrs)

    asc_data = drik.ascendant(jd, place)
    asc_rasi = asc_data[0]
    asc_deg = float(asc_data[1])

    planet_positions = charts.rasi_chart(jd, place)
    house_planets = {i: [] for i in range(12)}
    for entry in planet_positions:
        pid = entry[0]
        rasi = entry[1][0]
        if pid == 'L' or pid in (9, 10, 11):
            continue
        if pid in PLANET_NAMES:
            house_planets[rasi].append(PLANET_NAMES[pid])

    now = datetime.now()
    now_hrs = now.hour + now.minute / 60.0 + now.second / 3600.0
    jd_now = swe.julday(now.year, now.month, now.day, now_hrs)
    transit_positions = charts.rasi_chart(jd_now, place)
    transit_house_planets = {i: [] for i in range(12)}
    for entry in transit_positions:
        pid = entry[0]
        rasi = entry[1][0]
        if pid == 'L' or pid in (9, 10, 11):
            continue
        if pid in PLANET_NAMES:
            transit_house_planets[rasi].append(PLANET_NAMES[pid])

    payload = {
        "birth": {
            "planetsByRasi": {str(k): v for k, v in house_planets.items() if v},
            "ascendantRasi": asc_rasi,
            "ascendantDeg": round(asc_deg, 4),
        },
        "transit": {
            "planetsByRasi": {str(k): v for k, v in transit_house_planets.items() if v},
            "ascendantRasi": asc_rasi,
        },
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def _dhasa_start_datetime(value) -> datetime:
    """Parse a PyJHora dasha start: 4.7 date string or 4.8+ (Y, M, D, fractional_hour)."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, (tuple, list)) and len(value) >= 3 and not isinstance(value[0], str):
        try:
            year, month, day = int(value[0]), int(value[1]), int(value[2])
            if len(value) >= 4 and not isinstance(value[3], str):
                frac_hours = float(value[3])
                total_seconds = int(round(max(frac_hours, 0.0) * 3600.0))
                extra_days, total_seconds = divmod(total_seconds, 24 * 3600)
                hour, rem = divmod(total_seconds, 3600)
                minute, second = divmod(rem, 60)
                return datetime(year, month, day, hour, minute, second) + timedelta(days=extra_days)
            return datetime(year, month, day)
        except (TypeError, ValueError, OverflowError):
            return datetime.min
    text = str(value).strip()
    parts = text.split()
    if len(parts) >= 3 and parts[-1].upper() in ("AM", "PM"):
        try:
            return datetime.strptime(parts[0] + " " + parts[1], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                return datetime.strptime(" ".join(parts[:3]), "%Y-%m-%d %I:%M:%S %p")
            except ValueError:
                return datetime.min
    if len(parts) >= 2:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(parts[0] + " " + parts[1], fmt)
            except ValueError:
                continue
    return datetime.min


def _parse_dhasa_dt(s):
    return _dhasa_start_datetime(s)


def _format_dhasa_start(value) -> str:
    dt = _dhasa_start_datetime(value)
    if dt == datetime.min:
        return str(value)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _is_tuple_dhasa_row(row) -> bool:
    """PyJHora 4.8+ rows are [lords_tuple, (Y,M,D,fh), duration]."""
    return (
        isinstance(row, (list, tuple))
        and len(row) >= 2
        and isinstance(row[0], tuple)
    )


def _normalize_dhasa_rows(rows):
    """Convert 4.7 string rows and 4.8+ tuple rows to [lord, ..., start_str]."""
    out = []
    for row in rows:
        if not row:
            continue
        if _is_tuple_dhasa_row(row):
            lords = [int(x) for x in row[0]]
            start = _format_dhasa_start(row[1])
            out.append(lords + [start])
        else:
            lords = [int(x) for x in row[:-1]]
            start = _format_dhasa_start(row[-1])
            out.append(lords + [start])
    return out


def _vimsottari_fn():
    from jhora.horoscope.dhasa.graha import vimsottari

    fn = getattr(vimsottari, "get_vimsottari_dhasa_bhukthi", None)
    if fn is None:
        fn = getattr(vimsottari, "get_dhasa_bhukthi", None)
    if fn is None:
        raise RuntimeError("PyJHora vimsottari API not found")
    return fn


def _vimsottari_raw_rows(jd, place, dhasa_level_index: int):
    result = _vimsottari_fn()(jd, place, dhasa_level_index=dhasa_level_index)
    if isinstance(result, tuple) and len(result) >= 2:
        return result[1] or []
    return result or []


def _vimsottari_rows(jd, place, dhasa_level_index: int):
    return _normalize_dhasa_rows(_vimsottari_raw_rows(jd, place, dhasa_level_index))


def _configure_ayanamsa():
    setter = getattr(drik, "set_ayanamsa_mode", None)
    if callable(setter):
        setter("LAHIRI")
    if hasattr(const, "use_rahu_ketu_as_true_nodes"):
        const.use_rahu_ketu_as_true_nodes = False


def _end_grouped(rows, key_len, dt_idx):
    """Within each group (first key_len lords), sort by start and set end to next start in group."""
    from collections import defaultdict
    g = defaultdict(list)
    for r in rows:
        g[tuple(r[:key_len])].append(list(r))
    out = []
    for lst in g.values():
        lst.sort(key=lambda x: _parse_dhasa_dt(x[dt_idx]))
        for i, r in enumerate(lst):
            end = lst[i + 1][dt_idx] if i + 1 < len(lst) else None
            out.append(r + [end])
    return out


def _planet_table_rows(planet_positions):
    rows = []
    for entry in planet_positions:
        pid = entry[0]
        if pid == 'L' or pid in (9, 10, 11):
            continue
        if pid not in PLANET_NAMES:
            continue
        rasi = entry[1][0]
        deg = float(entry[1][1])
        rasi = int(rasi) % 12
        rows.append(_position_table_row(
            pid,
            PLANET_NAMES[pid],
            PLANET_TAMIL_FULL.get(pid, ""),
            rasi,
            deg,
        ))
    order = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    rows.sort(key=lambda x: order.index(x["planetId"]) if x["planetId"] in order else 99)
    return rows


def _birth_wall_clock_julday(birth_dt: datetime) -> float:
    """Match historical horoscope.py: local civil date/time passed to swe.julday (see drik.Place tz)."""
    hr = (
        birth_dt.hour
        + birth_dt.minute / 60.0
        + birth_dt.second / 3600.0
        + birth_dt.microsecond / 3_600_000_000.0
    )
    return swe.julday(birth_dt.year, birth_dt.month, birth_dt.day, hr)


def _transit_julday(transit_dt: datetime) -> float:
    if transit_dt.tzinfo is not None:
        transit_dt = transit_dt.astimezone(timezone.utc)
        hr = (
            transit_dt.hour
            + transit_dt.minute / 60.0
            + transit_dt.second / 3600.0
            + transit_dt.microsecond / 3_600_000_000.0
        )
        return swe.julday(transit_dt.year, transit_dt.month, transit_dt.day, hr)
    hr = (
        transit_dt.hour
        + transit_dt.minute / 60.0
        + transit_dt.second / 3600.0
        + transit_dt.microsecond / 3_600_000_000.0
    )
    return swe.julday(transit_dt.year, transit_dt.month, transit_dt.day, hr)


def _vimsottari_labels_ta():
    return {
        "mahadasha": "மஹா தசை",
        "bhukti": "புக்தி",
        "antara": "அந்தர்தசை",
        "sookshma": "சூக்ஷ்ம தசை",
        "start": "தொடக்கம்",
        "end": "முடிவு",
        "planet": "கிரகம்",
        "rasi": "ராசி",
        "deg": "பாகை",
        "totalDegTa": "முழு பாகை (0–360°)",
        "nakshatra": "நட்சத்திரம்",
        "pada": "பாதம்",
        "natalTitle": "ஜனன கிரக நிலை",
        "transitTitle": "கோசார கிரக நிலை",
        "dashaTitle": "விம்சோத்தரி தசை",
    }


def build_ui_payload(
    birth_dt: datetime,
    place,
    *,
    place_label: str,
    transit_dt: datetime | None = None,
    name: str | None = None,
    gender: str | None = None,
):
    """
    Full UI bundle: chart props, Tamil planetary tables, Vimsottari with start/end per level.
    Vimśottari depths: 1=maha, 2=bhukti, 3=pratyantara; sookshma is 4 on PyJHora 4.8+
    and 5 on 4.7 (that version's level 4 duplicates pratyantara).
    `place` is drik.Place(...). `birth_dt` is naive wall-clock at birth place.
    """
    _configure_ayanamsa()

    jd = _birth_wall_clock_julday(birth_dt)

    asc_data = drik.ascendant(jd, place)
    asc_rasi = int(asc_data[0]) % 12
    asc_deg = float(asc_data[1])

    planet_positions = charts.rasi_chart(jd, place)
    house_planets = {i: [] for i in range(12)}
    for entry in planet_positions:
        pid = entry[0]
        rasi = entry[1][0]
        if pid == 'L' or pid in (9, 10, 11):
            continue
        if pid in PLANET_NAMES:
            house_planets[rasi].append(PLANET_NAMES[pid])

    tr = transit_dt if transit_dt is not None else datetime.now()
    jd_now = _transit_julday(tr)
    transit_positions = charts.rasi_chart(jd_now, place)
    transit_house_planets = {i: [] for i in range(12)}
    for entry in transit_positions:
        pid = entry[0]
        rasi = entry[1][0]
        if pid == 'L' or pid in (9, 10, 11):
            continue
        if pid in PLANET_NAMES:
            transit_house_planets[rasi].append(PLANET_NAMES[pid])

    raw_md1 = _vimsottari_raw_rows(jd, place, 1)
    sookshma_level = 4 if (raw_md1 and _is_tuple_dhasa_row(raw_md1[0])) else 5
    md1 = _normalize_dhasa_rows(raw_md1)
    md2 = _vimsottari_rows(jd, place, 2)
    md3 = _vimsottari_rows(jd, place, 3)
    md5 = _vimsottari_rows(jd, place, sookshma_level)

    _sk0 = datetime(1988, 1, 1)
    _sk1 = datetime(2045, 1, 1)
    md5 = [
        r for r in md5
        if len(r) >= 5 and _sk0 <= _parse_dhasa_dt(r[4]) < _sk1
    ]

    l1 = sorted(md1, key=lambda r: _parse_dhasa_dt(r[1]))
    mahas = []
    for i, r in enumerate(l1):
        end = l1[i + 1][1] if i + 1 < len(l1) else None
        mahas.append({"lord": r[0], "start": r[1], "end": end})

    bhukti = []
    for r in _end_grouped(md2, 1, 2):
        bhukti.append({"maha": r[0], "lord": r[1], "start": r[2], "end": r[3]})

    antara = []
    for r in _end_grouped(md3, 2, 3):
        antara.append({"maha": r[0], "bhukti": r[1], "lord": r[2], "start": r[3], "end": r[4]})

    sookshma = []
    for r in _end_grouped(md5, 3, 4):
        sookshma.append({
            "maha": r[0], "bhukti": r[1], "antara": r[2], "lord": r[3],
            "start": r[4], "end": r[5],
        })

    dob_s = birth_dt.strftime("%Y-%m-%d")
    tob_s = birth_dt.strftime("%H:%M:%S")
    meta = {
        "dob": dob_s,
        "tob": tob_s,
        "place": place_label,
        "ayanamsa": "Lahiri",
        "nodes": "mean",
    }
    if name:
        meta["name"] = name
    if gender:
        meta["gender"] = gender

    payload = {
        "meta": meta,
        "birth": {
            "planetsByRasi": {str(k): v for k, v in house_planets.items() if v},
            "ascendantRasi": asc_rasi,
            "ascendantDeg": round(asc_deg, 4),
        },
        "transit": {
            "planetsByRasi": {str(k): v for k, v in transit_house_planets.items() if v},
            "ascendantRasi": asc_rasi,
            "computedAt": tr.isoformat(),
        },
        "natalLagna": _lagna_table_row(asc_rasi, asc_deg),
        "natalPlanets": _planet_table_rows(planet_positions),
        "transitPlanets": _planet_table_rows(transit_positions),
        "vimsottari": {
            "labelsTa": _vimsottari_labels_ta(),
            "mahadasha": mahas,
            "bhukti": bhukti,
            "antara": antara,
            "sookshma": sookshma,
        },
    }
    return payload


def _build_ui_payload():
    birth_dt = datetime(1994, 5, 10, 17, 0, 0)
    place = drik.Place("Pondicherry, IN", 11.9416, 79.8083, 5.5)
    return build_ui_payload(
        birth_dt,
        place,
        place_label="Pondicherry, IN",
        transit_dt=None,
        name=None,
        gender=None,
    )


def _parse_stdin_ui_request(req: dict):
    """Validate stdin JSON and return build_ui_payload kwargs."""
    if not isinstance(req, dict):
        raise ValueError("root must be an object")
    b = req.get("birth")
    p = req.get("place")
    if not isinstance(b, dict) or not isinstance(p, dict):
        raise ValueError("birth and place objects required")
    for k in ("year", "month", "day"):
        if k not in b:
            raise ValueError(f"birth.{k} required")
    birth_dt = datetime(
        int(b["year"]),
        int(b["month"]),
        int(b["day"]),
        int(b.get("hour", 0)),
        int(b.get("minute", 0)),
        int(b.get("second", 0)),
    )
    for k in ("name", "lat", "lng", "tz"):
        if k not in p:
            raise ValueError(f"place.{k} required")
    place = drik.Place(str(p["name"]), float(p["lat"]), float(p["lng"]), float(p["tz"]))
    place_label = str(p["name"])
    transit_raw = req.get("transit")
    transit_dt = None
    if transit_raw:
        s = str(transit_raw).strip()
        if s:
            transit_dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    name = req.get("name")
    if name is not None:
        name = str(name).strip() or None
    gender = req.get("gender")
    if gender is not None:
        gender = str(gender).strip() or None
    return {
        "birth_dt": birth_dt,
        "place": place,
        "place_label": place_label,
        "transit_dt": transit_dt,
        "name": name,
        "gender": gender,
    }


def export_ui_json_from_stdin():
    """Read one JSON object from stdin; write UI payload JSON to stdout."""
    try:
        req = json.load(sys.stdin)
        kw = _parse_stdin_ui_request(req)
        out = build_ui_payload(**kw)
        json.dump(out, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
    except Exception as e:
        print(f"{type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)


def export_ui_json():
    print(json.dumps(_build_ui_payload(), ensure_ascii=False, indent=2))


def write_ui_json_file():
    """Write kundli-ui/public/chart-data.json (no stdout JSON; avoids import noise in shell redirects)."""
    root = Path(__file__).resolve().parent
    out = root / "kundli-ui" / "public" / "chart-data.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(_build_ui_payload(), ensure_ascii=False, indent=2)
    out.write_text(text, encoding="utf-8")
    print(f"Wrote {out} ({len(text)} bytes)", file=sys.stderr)


def main():
    drik.set_ayanamsa_mode('LAHIRI')
    const.use_rahu_ketu_as_true_nodes = False

    dob = drik.Date(1994, 5, 10)
    tob = (17, 0, 0)
    place = drik.Place("Pondicherry, IN", 11.9416, 79.8083, 5.5)
    birth_dt = datetime(1994, 5, 10, 17, 0, 0)

    tob_hrs = tob[0] + tob[1] / 60.0 + tob[2] / 3600.0
    jd = swe.julday(dob.year, dob.month, dob.day, tob_hrs)
    today = datetime.now()

    print("=" * 70)
    print("                    VEDIC HOROSCOPE (Rasi Chart)")
    print("=" * 70)
    print(f"  Date of Birth : 1994-05-10")
    print(f"  Time of Birth : 17:00:00 IST")
    print(f"  Place         : Pondicherry (11.9416°N, 79.8083°E)")
    print(f"  Timezone      : UTC+5:30")
    print(f"  Ayanamsa      : Lahiri")
    print(f"  Node Type     : Mean")
    print("=" * 70)

    # --- Panchanga ---
    print("\n  PANCHANGA")
    print("  " + "-" * 45)

    sunrise_data = drik.sunrise(jd, place)
    sunset_data = drik.sunset(jd, place)
    print(f"  Sunrise       : {sunrise_data[1]}")
    print(f"  Sunset        : {sunset_data[1]}")

    vaara = drik.vaara(jd)
    print(f"  Vaara (Day)   : {VAARA_NAMES[vaara]}")

    tithi_data = drik.tithi(jd, place)
    tithi_no = tithi_data[0]
    paksha = "Shukla" if tithi_no <= 15 else "Krishna"
    t_num = tithi_no if tithi_no <= 15 else tithi_no - 15
    t_name = TITHI_NAMES[t_num - 1] if 1 <= t_num <= 15 else str(t_num)
    print(f"  Tithi         : {paksha} {t_name} ({tithi_no}/30)")

    nak_data = drik.nakshatra(jd, place)
    nak_no = nak_data[0]
    nak_pada = nak_data[1]
    print(f"  Nakshatra     : {NAKSHATRA_NAMES[nak_no - 1]} Pada {nak_pada}")

    yogam_data = drik.yogam(jd, place)
    yoga_no = yogam_data[0]
    yoga_name = YOGA_NAMES[yoga_no - 1] if 1 <= yoga_no <= 27 else str(yoga_no)
    print(f"  Yoga          : {yoga_name} ({yoga_no}/27)")

    karana_data = drik.karana(jd, place)
    karana_no = karana_data[0]
    karana_name = KARANA_NAMES[karana_no - 1] if 1 <= karana_no <= 60 else str(karana_no)
    print(f"  Karana        : {karana_name} ({karana_no})")

    # --- Ascendant ---
    asc_data = drik.ascendant(jd, place)
    asc_rasi = asc_data[0]
    asc_deg = asc_data[1]
    asc_nak = asc_data[2]
    asc_pada = asc_data[3]

    print(f"\n  LAGNA (Ascendant)")
    print("  " + "-" * 45)
    print(f"  Lagna         : {RASI_NAMES[asc_rasi]} {asc_deg:.4f}°")
    print(f"  Lagna Naksh.  : {NAKSHATRA_NAMES[asc_nak - 1]} Pada {asc_pada}")

    # --- Planet Positions ---
    print(f"\n  PLANETARY POSITIONS (Sidereal / Lahiri)")
    print("  " + "-" * 66)
    print(f"  {'Planet':<11} {'Rasi':<14} {'Degree':>8}  {'Nakshatra':<22} {'Pada'}")
    print(f"  {'─'*11} {'─'*14} {'─'*8}  {'─'*22} {'─'*4}")

    planet_positions = charts.rasi_chart(jd, place)

    moon_total_long = None
    for entry in planet_positions:
        pid = entry[0]
        rasi = entry[1][0]
        deg = entry[1][1]

        if pid == 'L':
            name = "Lagna"
        elif pid in PLANET_NAMES:
            name = PLANET_NAMES[pid]
        else:
            continue
        if pid in (9, 10, 11):
            continue

        tl = total_longitude(rasi, deg)
        nak_name, pada = nak_and_pada(tl)
        print(f"  {name:<11} {RASI_NAMES[rasi]:<14} {deg:>8.4f}°  {nak_name:<22} {pada}")

        if pid == 1:
            moon_total_long = tl

    # --- House Chart ---
    print(f"\n  RASI CHART (Houses from Lagna)")
    print("  " + "-" * 66)

    house_planets = {i: [] for i in range(12)}
    for entry in planet_positions:
        pid = entry[0]
        rasi = entry[1][0]
        if pid == 'L' or pid in (9, 10, 11):
            continue
        if pid in PLANET_NAMES:
            house_planets[rasi].append(PLANET_NAMES[pid])

    for i in range(12):
        house_num = ((i - asc_rasi) % 12) + 1
        occupants = house_planets.get(i, [])
        occ_str = ", ".join(occupants) if occupants else "---"
        marker = " (Lagna)" if i == asc_rasi else ""
        print(f"  {RASI_NAMES[i]:<14} (House {house_num:>2}){marker:<10} : {occ_str}")

    # --- Vimsottari Dasha ---
    print(f"\n  {'='*70}")
    print(f"  VIMSOTTARI MAHADASHA — Calculated from Date of Birth")
    print(f"  {'='*70}")

    if moon_total_long is not None:
        dasha_info = compute_vimsottari_dasha(moon_total_long, birth_dt)

        one_star = dasha_info["one_star_deg"]
        print(f"\n  Moon's Sidereal Longitude : {dasha_info['moon_longitude']:.4f}°")
        print(f"  Birth Nakshatra          : {dasha_info['nakshatra_name']} "
              f"(#{dasha_info['nakshatra_index'] + 1}/27)")
        print(f"  Nakshatra Span           : {one_star:.4f}° per nakshatra")
        print(f"  Moon's position in Nak.  : {dasha_info['position_in_nak_deg']:.4f}° "
              f"out of {one_star:.4f}°")
        print(f"  Nakshatra Traversed      : {dasha_info['fraction_elapsed']*100:.2f}%")
        print(f"  Nakshatra Remaining      : {dasha_info['fraction_remaining']*100:.2f}%")

        birth_lord = dasha_info["birth_lord"]
        bal_y, bal_m, bal_d = years_months_days(dasha_info["remaining_years"])
        ela_y, ela_m, ela_d = years_months_days(dasha_info["elapsed_years"])

        print(f"\n  Dasha Lord at Birth      : {PLANET_NAMES[birth_lord]}")
        print(f"  Full Dasha Period        : {dasha_info['total_period']} years")
        print(f"  Elapsed before Birth     : {ela_y}y {ela_m}m {ela_d}d "
              f"({dasha_info['elapsed_years']:.4f} years)")
        print(f"  Balance at Birth         : {bal_y}y {bal_m}m {bal_d}d "
              f"({dasha_info['remaining_years']:.4f} years)")

        print(f"\n  DASHA SEQUENCE (from Date of Birth)")
        print(f"  {'-'*68}")
        print(f"  {'#':<3} {'Dasha Lord':<12} {'Period':>10}  {'Start Date':<14} {'End Date':<14} {'Status'}")
        print(f"  {'─'*3} {'─'*12} {'─'*10}  {'─'*14} {'─'*14} {'─'*10}")

        for idx, d in enumerate(dasha_info["dashas"]):
            lord_name = PLANET_NAMES[d["lord"]]
            y, m, da = years_months_days(d["years"])

            if d["is_balance"]:
                period_str = f"{y}y {m}m {da}d*"
            else:
                period_str = f"{d['full_period']}y"

            start_str = d["start"].strftime("%Y-%m-%d")
            end_str = d["end"].strftime("%Y-%m-%d")

            if d["start"] <= today <= d["end"]:
                status = "<< CURRENT"
            elif d["end"] < today:
                status = "  elapsed"
            else:
                status = "  upcoming"

            note = " (bal.)" if d["is_balance"] else ""
            print(f"  {idx+1:<3} {lord_name:<12} {period_str:>10}  {start_str:<14} {end_str:<14} {status}{note}")

        current = None
        for d in dasha_info["dashas"]:
            if d["start"] <= today <= d["end"]:
                current = d
                break

        if current:
            elapsed_in_current = (today - current["start"]).days / SIDEREAL_YEAR_DAYS
            remaining_in_current = current["years"] - elapsed_in_current
            cr_y, cr_m, cr_d = years_months_days(remaining_in_current)
            print(f"\n  *** Currently running: {PLANET_NAMES[current['lord']]} Mahadasha ***")
            print(f"      Started           : {current['start'].strftime('%Y-%m-%d')}")
            print(f"      Ends              : {current['end'].strftime('%Y-%m-%d')}")
            print(f"      Remaining         : {cr_y}y {cr_m}m {cr_d}d")

        print(f"\n  * Balance period = partial dasha remaining at birth")
    else:
        print("  (Could not determine Moon's longitude)")

    # --- Current Planetary Positions (Transit / Gochara) ---
    print(f"\n  {'='*70}")
    print(f"  CURRENT PLANETARY POSITIONS (Transit / Gochara)")
    print(f"  {'='*70}")

    now = datetime.now()
    now_hrs = now.hour + now.minute / 60.0 + now.second / 3600.0
    jd_now = swe.julday(now.year, now.month, now.day, now_hrs)

    print(f"\n  Date & Time   : {now.strftime('%Y-%m-%d %H:%M:%S')} IST")
    print(f"  Place         : Pondicherry (11.9416°N, 79.8083°E)")

    transit_positions = charts.rasi_chart(jd_now, place)

    print(f"\n  {'Planet':<11} {'Rasi':<14} {'Degree':>8}  {'Nakshatra':<22} {'Pada'}")
    print(f"  {'─'*11} {'─'*14} {'─'*8}  {'─'*22} {'─'*4}")

    for entry in transit_positions:
        pid = entry[0]
        rasi = entry[1][0]
        deg = entry[1][1]

        if pid == 'L':
            continue
        if pid in (9, 10, 11):
            continue
        if pid not in PLANET_NAMES:
            continue

        name = PLANET_NAMES[pid]
        tl = total_longitude(rasi, deg)
        nak_name, pada = nak_and_pada(tl)
        print(f"  {name:<11} {RASI_NAMES[rasi]:<14} {deg:>8.4f}°  {nak_name:<22} {pada}")

    print(f"\n  TRANSIT OVER BIRTH CHART (Houses from Natal Lagna: {RASI_NAMES[asc_rasi]})")
    print("  " + "-" * 66)

    transit_house_planets = {i: [] for i in range(12)}
    for entry in transit_positions:
        pid = entry[0]
        rasi = entry[1][0]
        if pid == 'L' or pid in (9, 10, 11):
            continue
        if pid in PLANET_NAMES:
            transit_house_planets[rasi].append(PLANET_NAMES[pid])

    for i in range(12):
        house_num = ((i - asc_rasi) % 12) + 1
        occupants = transit_house_planets.get(i, [])
        occ_str = ", ".join(occupants) if occupants else "---"
        natal_occ = house_planets.get(i, [])
        natal_str = f"  [natal: {', '.join(natal_occ)}]" if natal_occ else ""
        print(f"  {RASI_NAMES[i]:<14} (House {house_num:>2}) : {occ_str}{natal_str}")

    print("\n" + "=" * 70)
    print("  Generated using PyJHora 4.7.0 | Lahiri Ayanamsa | Mean Nodes")
    print("=" * 70)


if __name__ == "__main__":
    if "--write-ui-data" in sys.argv:
        write_ui_json_file()
    elif "--stdin-ui" in sys.argv:
        export_ui_json_from_stdin()
    elif "--ui-json" in sys.argv:
        export_ui_json()
    elif "--json" in sys.argv:
        export_horoscope_json()
    else:
        main()
