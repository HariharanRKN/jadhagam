# Full stack: Next.js (kundli-ui) + Python horoscope (PyJHora / Swiss Ephemeris)
# Build from repo root: docker build -t kundli .
# Run: docker run -p 3000:3000 kundli

FROM node:22-bookworm AS builder

WORKDIR /app/kundli-ui
COPY kundli-ui/package.json kundli-ui/package-lock.json ./
RUN npm ci

COPY kundli-ui/ ./
RUN npm run build

FROM node:22-bookworm AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-dev \
    gcc \
    libc6-dev \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY requirements.txt horoscope.py ./
COPY scripts ./scripts
COPY data ./data
COPY semantic ./semantic
RUN pip install --no-cache-dir -r requirements.txt \
  && apt-get purge -y --auto-remove gcc python3-dev libc6-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/web
COPY --from=builder /app/kundli-ui/.next/standalone ./
COPY --from=builder /app/kundli-ui/.next/static ./.next/static
COPY --from=builder /app/kundli-ui/public ./public

RUN mkdir -p /var/data

ENV NODE_ENV=production
ENV PORT=3000
# Persistent on Render when the service disk is mounted at /var/data.
# Do not use /app/data — that path is copied from the image and is replaced on deploy.
ENV KUNDALI_DB_PATH=/var/data/saved_kundalis.sqlite
ENV KUNDALI_STORE_PATH=/var/data/saved_kundalis.json
# Render free web services are 512MB. Leave headroom for one PyJHora child.
ENV NODE_OPTIONS=--max-old-space-size=192
ENV MALLOC_ARENA_MAX=2
# Render (and other hosts) set HOSTNAME to the container name. Next.js standalone
# binds to process.env.HOSTNAME, so force 0.0.0.0 at process start.
EXPOSE 3000

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
