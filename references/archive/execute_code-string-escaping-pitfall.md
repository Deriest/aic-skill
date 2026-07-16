# PITFALL: execute_code python string escaping corrupts files

## Symptom
Using `execute_code` to write multi-line shell/node code via Python string interpolation introduces invisible syntax errors — extra quotes, unescaped newlines, broken heredocs.

## Root Cause
`execute_code` runs Python. When Python writes shell scripts or JS via string manipulation (`content.replace(...)`), the escaping layers compound:
- Python string escaping (`\n`, `\"`)
- Shell string escaping (heredocs, backticks)
- JavaScript string escaping (template literals, regex)

Three layers of escaping produce corruption that `bash -n` or `node --check` catches, but only AFTER the file is written.

## Incident (v3.3.0)
A Python script in `execute_code` attempted to patch `engine/index.js` using `content.replace()` with a multi-line JS string containing template literals (`${...}`), regex (`/pattern/`), and shell heredocs. The result was syntactically invalid JS that passed Python's string operations but failed `node --check`.

## Rule
**Use the `patch` tool for file modifications, NOT `execute_code` with string manipulation.**

The `patch` tool:
- Applies exact find-and-replace without string escaping layers
- Has fuzzy matching for whitespace differences
- Auto-runs syntax checks after editing
- Returns a unified diff for verification

### When execute_code IS appropriate:
- Reading and filtering data (grep, parse, analyze)
- Running multiple independent terminal commands
- Looping over file lists with conditional logic
- Processing tool outputs before deciding next action

### When execute_code is NOT appropriate for file editing:
- Any multi-line replacement in `.js`, `.sh`, or `.py` files
- Anything containing template literals, heredocs, or regex
- Anything that would be better expressed as `old_string → new_string`

## Prevention
- Always prefer `patch(mode='replace')` over Python string `replace()` in `execute_code`
- If you must use execute_code for batch edits, verify syntax immediately after: `node --check` or `bash -n`
- If syntax check fails, do NOT use `git checkout` to fix (see git-checkout-uncommitted-pitfall.md)
