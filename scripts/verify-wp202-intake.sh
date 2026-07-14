#!/usr/bin/env bash
# WP-202 routing verification — deterministic intake-evaluate cases
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY=python3
fail=0

check() {
  local name="$1" expect_mode="$2" expect_pipe="$3"
  out=$($PY scripts/intake-evaluate.py --case "$name")
  mode=$(echo "$out" | $PY -c "import sys,json; print(json.load(sys.stdin).get('intake_mode',''))")
  pipe=$(echo "$out" | $PY -c "import sys,json; print(json.load(sys.stdin).get('pipeline_allowed',False))")
  if [[ "$mode" != "$expect_mode" ]] || [[ "$pipe" != "$expect_pipe" ]]; then
    echo "FAIL $name mode=$mode pipe=$pipe expected $expect_mode $expect_pipe"
    fail=1
  else
    echo "PASS $name"
  fi
}

check conversation conversation False
check quick quick True
check discovery discovery False
check from_prd_review from_prd False
check from_prd_improve from_prd False
check from_prd_architecture from_prd False
check from_prd_estimate from_prd False
check from_prd_build from_prd True
check from_prd_upload_only from_prd False

# Regression: engine untouched
for f in scripts/engine/index.js scripts/server.js; do
  if git diff --quiet HEAD -- "$f" 2>/dev/null; then
    echo "PASS no diff $f"
  else
    echo "FAIL unexpected diff $f"
    fail=1
  fi
done

if [[ $fail -eq 0 ]]; then
  echo "OK_WP202_INTAKE_VERIFY"
else
  exit 1
fi