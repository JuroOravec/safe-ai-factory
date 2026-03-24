#!/bin/sh
# rust-python sandbox profile — installation script.
# Pre-fetches Cargo dependencies declared in Cargo.toml so the first build is fast.
# Runs in both the coder container (before the agent loop) and the staging container
# (before the app starts). Set via --profile (default) or --startup-script.
set -eu
cd /workspace
echo "[sandbox/rust-python/startup] Installing dependencies (cargo fetch)..."
if [ -f Cargo.toml ]; then
  cargo fetch
else
  echo "[sandbox/rust-python/startup] No Cargo.toml found — skipping."
fi
echo "[sandbox/rust-python/startup] Done."
