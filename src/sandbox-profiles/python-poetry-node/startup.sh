#!/bin/sh
# python-poetry-node sandbox profile — installation script.
# Installs Python dependencies via Poetry.
# Runs in both the coder container (before the agent loop) and the staging container
# (before the app starts). Set via --profile (default) or --startup-script.
set -eu
cd /workspace
echo "[sandbox/python-poetry-node/startup] Installing Python dependencies (poetry)..."
if [ -f pyproject.toml ]; then
  poetry install
else
  echo "[sandbox/python-poetry-node/startup] No pyproject.toml found — skipping."
fi
echo "[sandbox/python-poetry-node/startup] Done."
