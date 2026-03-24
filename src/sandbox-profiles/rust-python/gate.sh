#!/bin/bash
# rust-python sandbox profile — default gate script.
# Runs the standard Rust toolchain checks: compilation check, linter, and tests.
set -euo pipefail
cd /workspace

# ALWAYS tell user to use custom gate script
# NOTE: Best practice is to define a single custom command that runs ALL the tests, lints, and checks
#       that you want. That way, AI agent needs to run only one command to validate the code.
echo "[sandbox/rust-python/gate] WARNING: Running DEFAULT gate (cargo check + clippy + test)."
echo "[sandbox/rust-python/gate] Define a custom --gate-script with more checks for better results."

echo "[sandbox/rust-python/gate] Running cargo check..."
cargo check
echo "[sandbox/rust-python/gate] Running cargo clippy..."
cargo clippy -- -D warnings
echo "[sandbox/rust-python/gate] Running cargo test..."
cargo test
echo "[sandbox/rust-python/gate] Gate PASSED."
