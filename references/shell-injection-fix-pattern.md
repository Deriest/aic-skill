# Shell Injection Fix Pattern — Bash Heredocs into Python

## Problem

When bash variables are interpolated into `python3 << PYEOF` or `python3 -c "..."`, a crafted value can break out of the Python string context and execute arbitrary code.

**Example vulnerable:**
```bash
ID="${2:-}"
python3 << PYEOF
d = json.load(open("$XREF"))
d["references"].append({"source_id": "$ID", ...})
PYEOF
```

Input `"; import os; os.system("rm -rf /"); "` executes shell code.

## Three Fix Patterns

### Pattern 1: Bash Parameter Expansion (heredoc string variables)

Sanitize ALL user-supplied variables BEFORE the heredoc block.

```bash
# Backslashes first, THEN double quotes (order matters)
ID="${ID//\\/\\\\}"; ID="${ID//\"/\\\"}"
PROJECT="${PROJECT//\\/\\\\}"; PROJECT="${PROJECT//\"/\\\"}"
RELATIONSHIP="${RELATIONSHIP//\\/\\\\}"; RELATIONSHIP="${RELATIONSHIP//\"/\\\"}"
```

**When to use:** Variable interpolated into Python string literals inside unquoted heredoc.

**Order matters:** Escape `\` first, then `"` — otherwise the `\` in `\"` gets double-escaped to `\\"`.

### Pattern 2: Allowlist Validation (command arguments)

```bash
if [[ -n "$ID" && ! "$ID" =~ "^[a-zA-Z0-9._:-]+$" ]]; then
    echo "ERROR: Invalid characters in artifact ID"; exit 1
fi
```

**Pitfall: Unquoted regex with hyphen near `]`.** `[[ "$X" =~ ^[a-zA-Z0-9._:/@ -]+$ ]]` causes bash syntax error (`syntax error in conditional expression`) because `-]+$` confuses the parser — `]` closes `[[` context. **Fix:** ALWAYS quote the regex pattern: `[[ "$X" =~ "^[a-zA-Z0-9._:/@ -]+$" ]]`. Alternatively, place `-` at the very end before `]` or escape with `\ -`. In this session, 4 scripts failed with the unquoted form and all passed after quoting.

**When to use:** Variable is a structured identifier (artifact ID, key name) passed as a command-line argument to another script, not interpolated into a string.

**Stricter** than Pattern 1 — rejects anything that doesn't match the domain.

### Pattern 3: Environment Variable Pass-Through (`python3 -c`)

```bash
# BAD: $model interpolated into single-quoted Python string
ctx=$(echo "$resp" | python3 -c "
target = '$model'.lower()
")

# GOOD: pass via env var
ctx=$(echo "$resp" | MODEL_NAME="$model" python3 -c "
import os
target = os.environ.get('MODEL_NAME', '').lower()
")
```

**When to use:** Variable interpolated into `python3 -c "..."` with single-quoted strings, or when the Python code has complex quoting that makes escaping fragile.

## Scripts Fixed (2026-07-16)

| Script | Variables | Pattern |
|--------|-----------|---------|
| knowledge-cross-project.sh | $ID, $PROJECT, $RELATIONSHIP | P1 |
| knowledge-graph.sh | $ID, $TYPE, $LABEL, $TO | P1 |
| knowledge-index.sh | $FIELD, $VALUE | P1 |
| knowledge-lessons.sh | $TOPIC, $TYPE, $DESC, $WORKER | P1 |
| knowledge-lifecycle.sh | $ID | P2 (allowlist) |
| knowledge-memory.sh | $KEY, $VALUE | P1 |
| knowledge-reuse.sh | $KEYWORD | P1 |
| knowledge-search.sh | $QUERY, $TYPE_FILTER, $TAG_FILTER | P1 |
| detect-context.sh | $model | P3 (env var) |

## Detection Checklist

When auditing scripts, check every `python3 << PYEOF` and `python3 -c "..."` for:
1. Unescaped `$VAR` interpolated into Python string literals
2. `$VAR` in `python3 -c "..."` with nested single/double quotes
3. Variables that come from script arguments (`$1`, `$2`, etc.) or user input
4. Path variables from config files that could contain special characters

## Verification

After applying fixes, always run:
```bash
bash -n script.sh  # syntax check
```

For functional verification, test with inputs containing `"`, `\`, and `'` characters.
