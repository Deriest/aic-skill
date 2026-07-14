#!/usr/bin/env bash
# WP-203/206/207 verification — context engine & state manager
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY=python3
fail=0

TEST_DIR="/tmp/aic-intake-test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

echo "== Context Engine (PRD + Repo) =="
cat << 'EOF' > "$TEST_DIR/PRD_test.txt"
# PRD
## Business Goal
Solve a problem.
## Target User
Developers.
EOF

cat << 'EOF' > "$TEST_DIR/package.json"
{
  "dependencies": {
    "react": "^18.0.0"
  }
}
EOF

# Should find target user in PRD (PRESENT) and tech stack in package.json (DERIVABLE)
out=$($PY scripts/intake-evaluate.py --text "buat website" --type website --prd "$TEST_DIR/PRD_test.txt" --dir "$TEST_DIR")
user=$(echo "$out" | $PY -c "import sys,json; print(json.load(sys.stdin).get('mandatory', {}).get('target_user'))")
stack=$(echo "$out" | $PY -c "import sys,json; print(json.load(sys.stdin).get('mandatory', {}).get('tech_stack', 'MISSING'))")

if [[ "$user" == "PRESENT" ]]; then echo "PASS PRD Context (PRESENT)"; else echo "FAIL PRD Context"; fail=1; fi
if [[ "$stack" == "DERIVABLE" || "$stack" == "PRESENT" ]]; then echo "PASS Repo Context (DERIVABLE/PRESENT)"; else echo "FAIL Repo Context: $stack"; fail=1; fi

echo "== State Manager =="
$PY scripts/intake-evaluate.py --dir "$TEST_DIR" --state-init >/dev/null
st1=$($PY scripts/intake-evaluate.py --dir "$TEST_DIR" --state-show | $PY -c "import sys,json; print(json.load(sys.stdin)['question_count'])")
$PY scripts/intake-evaluate.py --dir "$TEST_DIR" --state-increment >/dev/null
st2=$($PY scripts/intake-evaluate.py --dir "$TEST_DIR" --state-show | $PY -c "import sys,json; print(json.load(sys.stdin)['question_count'])")
if [[ "$st1" == "0" && "$st2" == "1" ]]; then echo "PASS State mutation"; else echo "FAIL State mutation ($st1 -> $st2)"; fail=1; fi

echo "== Domain Packs =="
packs=(mobile_app api ai_agent desktop_app library cli devops documentation)
for p in "${packs[@]}"; do
  if [ -f "templates/intake-checklists/$p.yaml" ]; then
    echo "PASS pack $p"
  else
    echo "FAIL pack $p"
    fail=1
  fi
done

if [[ $fail -eq 0 ]]; then
  echo "OK_WP203_INTAKE_VERIFY"
else
  exit 1
fi