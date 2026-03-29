# Deploy kundli to the internet

This app needs **Node.js** (Next.js) and **Python** (PyJHora + Swiss Ephemeris) on the same host. The included **Dockerfile** builds both.

## Prerequisites

- Push this repository to **GitHub** (private is fine).
- Install [Docker](https://docs.docker.com/get-docker/) locally to test:  
  `docker compose up --build` then open http://localhost:3000

## Option A: Render

1. Sign up at [render.com](https://render.com) and connect your GitHub account.
2. **New → Blueprint** (or **Web Service** with Docker).
3. Select the repo; set root to the directory that contains `Dockerfile` (this `play` folder if that is the repo root).
4. Render will detect `render.yaml` or use **Docker** with `Dockerfile` at repo root.
5. Deploy. Note: free/starter instances may sleep when idle.

Optional env var: `PHOTON_API_URL` — base URL for a [self-hosted Photon](https://github.com/komoot/photon) instance.

## Option B: Fly.io

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/).
2. From the folder that contains `Dockerfile` and `fly.toml`:

   ```bash
   fly auth login
   fly launch
   ```

   Edit `app` in `fly.toml` if the name is taken. Then:

   ```bash
   fly deploy
   ```

## Option C: Railway / other Docker hosts

- **New project → Deploy from GitHub** → pick this repo.
- Set **Dockerfile path** to `./Dockerfile` and **context** to `.` (repository root where `Dockerfile` lives).

## What does not work on Vercel alone?

[Vercel](https://vercel.com) serverless functions do not run your bundled **Python + PyJHora** process. Use Docker on Render, Fly, Railway, etc., or split into a separate Python API.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `PHOTON_API_URL` | Server (optional) | Photon geocoder base URL; default is komoot’s public API. |
| `PORT` | Container | Set automatically by most platforms (default `3000` in Docker). |

Client-side env vars are not required for the current Photon/timezone flow (those use same-origin `/api/*`).
