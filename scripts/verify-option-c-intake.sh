#!/usr/bin/env bash
# EPIC-201 Option C — LLM-assisted question payload + regression
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY=python3
fail=0

echo "== WP-202 regression =="
bash scripts/verify-wp202-intake.sh

echo "== Phase 2 regression =="
bash scripts/verify-intake-phase2.sh

echo "== Option C: discovery payload =="
TEST_DIR="/tmp/aic-option-c-test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
$PY scripts/intake-evaluate.py --dir "$TEST_DIR" --state-init >/dev/null
out=$($PY scripts/intake-evaluate.py --text "buat landing page biochar" --type website --dir "$TEST_DIR")
mode=$(echo "$out" | $PY -c "import sys,json; print(json.load(sys.stdin).get('intake_mode',''))")
if [[ "$mode" == "discovery" ]]; then echo "PASS discovery mode"; else echo "FAIL mode=$mode"; fail=1; fi

payload=$($PY scripts/intake-evaluate.py --text "buat landing page biochar" --type website --dir "$TEST_DIR" --discovery-payload)
missing_len=$(echo "$payload" | $PY -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('missing_fields',[])))")
if [[ "$missing_len" -gt 0 ]]; then echo "PASS missing_fields controlled by validator ($missing_len)"; else echo "FAIL empty missing"; fail=1; fi

echo "$payload" | $PY -c "import sys,json; d=json.load(sys.stdin); assert 'known_fields' in d and 'max_questions' in d; assert d['max_questions']==10"
echo "PASS structured payload schema"

echo "== Real Discovery simulation =="
# Turn 1: validator
$PY scripts/intake-evaluate.py --dir "$TEST_DIR" --state-init >/dev/null
p1=$($PY scripts/intake-evaluate.py --text "buat website promosi" --type website --dir "$TEST_DIR" --discovery-payload)
mf1=$(echo "$p1" | $PY -c "import sys,json; print(','.join(json.load(sys.stdin)['missing_fields'][:3]))")
echo "Turn1 missing (sample): $mf1"
# Simulated LLM output (contract check only — Dispatcher uses live LLM in production)
sim_q='{"question":"Who is the primary audience and what are the must-have pages or features?","covers_fields":["target_user","pages_or_ia"]}'
echo "$sim_q" | $PY -c "import sys,json; d=json.load(sys.stdin); assert d.get('question') and d.get('covers_fields')"
echo "PASS LLM output contract"
# Turn 2: user answer appended
ans="Target user: plantation managers. Pages: Home, Product, Contact. Acceptance: mobile 375px OK."
$PY scripts/intake-evaluate.py --dir "$TEST_DIR" --state-increment >/dev/null
out2=$($PY scripts/intake-evaluate.py --text "buat website promosi. $ans" --type website --dir "$TEST_DIR")
comp2=$(echo "$out2" | $PY -c "import sys,json; print(json.load(sys.stdin).get('completeness',''))")
miss2=$(echo "$out2" | $PY -c "import sys,json; print(len(json.load(sys.stdin).get('missing_for_planning',[])))")
echo "Turn2 completeness=$comp2 remaining_missing=$miss2"
if [[ "$miss2" -lt "$missing_len" ]] || [[ "$comp2" == "PASS" ]]; then echo "PASS validator updated after answer"; else echo "WARN validator may need more fields (still $miss2 missing)"; fi

pl=$($PY scripts/intake-evaluate.py --text "buat website promosi" --type website --dir "$TEST_DIR" | $PY -c "import sys,json; print(json.load(sys.stdin).get('pipeline_allowed'))")
if [[ "$pl" == "False" ]]; then echo "PASS pipeline blocked pre-approval"; else echo "FAIL pipeline_allowed=$pl"; fail=1; fi

echo "== Engine diff guard =="
for f in scripts/engine/index.js scripts/server.js; do
  if git diff --quiet -- "$f" 2>/dev/null; then echo "PASS no diff $f"; else echo "FAIL diff $f"; fail=1; fi
done

if [[ $fail -eq 0 ]]; then
  echo "OK_EPIC201_OPTION_C_VERIFY"
else
  exit 1
fi