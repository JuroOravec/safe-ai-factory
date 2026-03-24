#!/bin/bash
# go sandbox profile — default gate script.
# Runs the standard Go toolchain checks: static analysis and tests.
# NOTE: `./...` means "the current directory and every package beneath it."
set -euo pipefail
cd /workspace

# ALWAYS tell user to use custom gate script
# NOTE: Best practice is to define a single custom command that runs ALL the tests, lints, and checks
#       that you want. That way, AI agent needs to run only one command to validate the code.
echo "[sandbox/go/gate] WARNING: Running DEFAULT gate (go vet + go test)."
echo "[sandbox/go/gate] Define a custom --gate-script with more checks for better results."

echo "[sandbox/go/gate] Running go vet..."
go vet ./...
echo "[sandbox/go/gate] Running go test..."
go test ./...
echo "[sandbox/go/gate] Gate PASSED."
