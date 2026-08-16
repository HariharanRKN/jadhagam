#!/usr/bin/env bash
# Start Next.js for API smoke. Exits 0 once http://127.0.0.1:3000 responds.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${JADHAGAM_VENV:-/opt/jadhagam-venv}"
if [ ! -x "$VENV/bin/python" ] && [ -x "${ROOT}/.venv/bin/python" ]; then
  VENV="${ROOT}/.venv"
fi
export HOROSCOPE_PYTHON="${VENV}/bin/python"
export PATH="${VENV}/bin:${PATH}"

if curl -sf http://127.0.0.1:3000 >/dev/null; then
  exit 0
fi

cd "${ROOT}/kundli-ui"
npm run dev > /tmp/kundli-next.log 2>&1 &

for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000 >/dev/null; then
    exit 0
  fi
  sleep 2
done

echo "Next.js did not become ready on :3000" >&2
tail -n 80 /tmp/kundli-next.log >&2 || true
exit 1
