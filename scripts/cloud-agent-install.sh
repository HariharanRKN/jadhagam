#!/usr/bin/env bash
# Idempotent Cloud Agent / local bootstrap: Python venv + UI node_modules.
# Use --copies and /opt so the interpreter survives snapshot + git checkout
# (workspace .venv/bin is often only a symlink and gets dropped).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! dpkg -s python3-venv python3-dev gcc g++ >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y python3-venv python3-dev gcc g++
fi

VENV="${JADHAGAM_VENV:-/opt/jadhagam-venv}"
if [ "$(id -u)" -eq 0 ]; then
  python3 -m venv --copies "$VENV"
else
  sudo python3 -m venv --copies "$VENV"
  sudo chown -R "$(id -u):$(id -g)" "$VENV"
fi
"$VENV/bin/pip" install -r requirements.txt
ln -sfn "$VENV" .venv
npm ci --prefix kundli-ui
