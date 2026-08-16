#!/usr/bin/env bash
# Idempotent Cloud Agent / local bootstrap: Python venv + UI node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! dpkg -s python3-venv python3-dev gcc g++ >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y python3-venv python3-dev gcc g++
fi

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci --prefix kundli-ui
