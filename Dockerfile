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
RUN pip install --no-cache-dir -r requirements.txt

WORKDIR /app/web
COPY --from=builder /app/kundli-ui/.next/standalone ./
COPY --from=builder /app/kundli-ui/.next/static ./.next/static
COPY --from=builder /app/kundli-ui/public ./public

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
