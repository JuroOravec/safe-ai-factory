#!/bin/sh
# rust-node sandbox profile — installation script.
# Pre-fetches Cargo dependencies declared in Cargo.toml so the first build is fast.
# Runs in both the coder container (before the agent loop) and the staging container
# (before the app starts). Set via --profile (default) or --startup-script.
set -eu
cd /workspace
echo "[sandbox/rust-node/startup] Installing dependencies (cargo fetch)..."
if [ -f Cargo.toml ]; then
  cargo fetch
else
  echo "[sandbox/rust-node/startup] No Cargo.toml found — skipping."
fi
echo "[sandbox/rust-node/startup] Done."
