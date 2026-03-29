# Deploy kundli to the internet

This app needs **Node.js** (Next.js) and **Python** (PyJHora + Swiss Ephemeris) on the same host. The included **Dockerfile** builds both.

## GitHub Desktop → push code

1. In **GitHub Desktop**: **File → Add Local Repository** → choose this project folder (`play`).
2. If the remote is missing: **Repository → Repository Settings → Remote** → URL `https://github.com/HariharanRKN/jadhagam.git`.
3. Commit any pending changes, then **Push origin** (branch `main`).

Until the code is on GitHub, cloud hosts cannot build it.

## Deploy in about 10 minutes (GitHub + Render — no GitHub Actions)

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

## Option B: Fly.io + GitHub Actions (deploy on every push)

After code is on GitHub (`main`):

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/) and run **`fly auth login`** once.
2. Create the app name used in `fly.toml` (default **`jadhagam`**). If the name is taken, change `app` in `fly.toml` and use that name here:

   ```bash
   fly apps create jadhagam
   ```

3. Create a deploy token and add it to GitHub (**do not paste it in chat**):

   ```bash
   fly tokens create deploy
   ```

   In the repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**  
   Name: **`FLY_API_TOKEN`** — Value: the token from the command above.

4. Push to `main` (e.g. from GitHub Desktop). The workflow **Deploy to Fly.io** (`.github/workflows/deploy-fly.yml`) runs **`flyctl deploy --remote-only`**.

5. Open the URL from **`fly apps open`** or the Fly dashboard.

Manual re-run: **Actions** tab → **Deploy to Fly.io** → **Run workflow**.

### Fly.io from your laptop only (no Actions)

```bash
fly auth login
fly apps create jadhagam   # if not created yet
fly deploy
```

## Option C: Railway / other Docker hosts

- **New project → Deploy from GitHub** → pick this repo.
- Set **Dockerfile path** to `./Dockerfile` and **context** to `.` (repository root where `Dockerfile` lives).

## Troubleshooting: `Publish directory build does not exist`

That message means the host is treating the project as a **static site** (it looks for a `build/` folder after a front-end build). **This app is not a static site** — it is a **Docker** image that runs **Next.js + Python** together.

**On Render**

1. Do **not** use **Static Site**. Use **Web Service**.
2. In the service settings, set **Runtime** to **Docker** (not Node, not static).
3. **Dockerfile path:** `Dockerfile` · **Docker build context:** `.` (repo root).
4. Clear or ignore any **Publish directory** / **static publish** field — that applies only to static sites, not Docker web services.
5. If the wrong service type was created, **delete** it and create a new **Web Service** with Docker as above.

You can also use **New → Blueprint** and point at this repo so [`render.yaml`](render.yaml) is applied (it defines a **Docker `web`** service, not a static site).

## What does not work on Vercel alone?

[Vercel](https://vercel.com) serverless functions do not run your bundled **Python + PyJHora** process. Use Docker on Render, Fly, Railway, etc., or split into a separate Python API.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `PHOTON_API_URL` | Server (optional) | Photon geocoder base URL; default is komoot’s public API. |
| `PORT` | Container | Set automatically by most platforms (default `3000` in Docker). |

Client-side env vars are not required for the current Photon/timezone flow (those use same-origin `/api/*`).
