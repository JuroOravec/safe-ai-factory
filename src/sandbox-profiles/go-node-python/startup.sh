#!/bin/sh
# go-node-python sandbox profile — installation script.
# Downloads Go module dependencies declared in go.mod.
# Runs in both the coder container (before the agent loop) and the staging container
# (before the app starts). Set via --profile (default) or --startup-script.
set -eu
cd /workspace
echo "[sandbox/go-node-python/startup] Installing dependencies (go mod)..."
if [ -f go.mod ]; then
  go mod download
else
  echo "[sandbox/go-node-python/startup] No go.mod found — skipping."
fi
echo "[sandbox/go-node-python/startup] Done."
