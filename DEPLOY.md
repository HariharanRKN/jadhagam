# Deploy kundli to the internet

This app needs **Node.js** (Next.js) and **Python** (PyJHora + Swiss Ephemeris) on the same host. The included **Dockerfile** builds both.

## Deploy in about 10 minutes (GitHub private + Render)

Do these steps **on your machine** (this environment cannot log in to GitHub or Render for you).

### 1) Commit and push to a private GitHub repo

Repo root must be this folder (`Dockerfile`, `horoscope.py`, `kundli-ui/` at the top level).

```bash
cd /path/to/play   # this project root
git add -A && git status
git commit -m "Deploy: Docker, PyJHora deps, compose port"   # skip if nothing to commit
```

Create a **new private repository** on [github.com/new](https://github.com/new) (any name, e.g. `kundli`). **Do not** add a README/license (keep it empty).

Then:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 2) Create a Render web service

1. Sign up / log in at [render.com](https://render.com) and **connect GitHub**.
2. **New +** → **Web Service** → select your repo.
3. Settings:
   - **Runtime:** Docker
   - **Dockerfile path:** `Dockerfile`
   - **Docker build context:** `.` (repository root)
   - **Instance type:** choose the smallest paid Docker instance if free Docker is unavailable; free tiers change over time.
4. **Create Web Service**. Wait for the first build (several minutes). Open the **`.onrender.com` URL** when deploy is live.

Render sets **`PORT`** automatically; the Next.js image listens on that port.

### 3) Smoke test

- Open the site URL → you should see the chart UI.
- Submit the birth form → **Compute chart** should return data (Python runs inside the same container).

### Local Docker (optional)

- Install [Docker](https://docs.docker.com/get-docker/) and run:  
  `docker compose up --build` → **http://localhost:3001** (see `compose.yaml`; use `3000:3000` if port 3000 is free).

## Prerequisites (reference)

- Push this repository to **GitHub** (private is fine) — see steps above.

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
