# Historical Planet Positions

This project now supports a local historical database of daily planetary positions, stored as SQLite and intended to be bundled into the Docker image for Render.

## Snapshot model

- Coverage: from `1960-01-01`
- Granularity: daily
- Time basis: `12:00:00 IST` for each `date_ist`
- Ayanamsa: Lahiri
- Nodes: mean

The database is built at:

- [data/planet_positions.sqlite](/Users/hariharanradhakrishnan/Documents/Playground/play/data/planet_positions.sqlite)

The build/query script lives at:

- [scripts/history_db.py](/Users/hariharanradhakrishnan/Documents/Playground/play/scripts/history_db.py)

## Rebuild locally

```bash
python3 scripts/history_db.py build --start-date 1960-01-01 --end-date 2026-04-03
```

To rebuild through today:

```bash
python3 scripts/history_db.py build --start-date 1960-01-01 --end-date "$(date +%F)"
```

## Query examples

Check A: get planetary positions for a date

```bash
python3 scripts/history_db.py position-on-date --date 1990-05-20
```

Check B: find dates when Sukra and Guru were together in Mesha

```bash
python3 scripts/history_db.py search-rasi \
  --planet sukra \
  --planet guru \
  --rasi mesha \
  --start-date 2006-04-03 \
  --end-date 2026-04-03
```

## API routes

These routes are exposed from the Next.js app:

- `GET /api/history/positions?date=1990-05-20`
- `GET /api/history/search?planet=sukra&planet=guru&rasi=mesha&startDate=2006-04-03&endDate=2026-04-03`

Notes:

- `planet` can be repeated.
- Planet aliases currently supported: `sun`, `moon`, `mars`, `mercury`, `jupiter`, `guru`, `venus`, `sukra`, `shukra`, `saturn`, `rahu`, `ketu`
- `rasi` accepts either numeric ids (`0..11`) or names like `mesha`, `aries`, `taurus`, etc.

## Deployment

The Docker image now copies:

- [scripts/](/Users/hariharanradhakrishnan/Documents/Playground/play/scripts)
- [data/](/Users/hariharanradhakrishnan/Documents/Playground/play/data)

The app reads the database from:

- `HISTORY_DB_PATH`

If unset, it defaults to:

- `/app/data/planet_positions.sqlite`

For Render Git-based deploys, make sure the SQLite file is committed so it is present in the build context.
