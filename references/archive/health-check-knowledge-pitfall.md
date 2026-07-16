# Knowledge Subsystem: Lazy Creation & Health Check Pitfall

## Background
The Knowledge Subsystem is an **optional, best-effort** ledger appended by the runtime engine (`triggerKnowledgeAsync`) when a task completes successfully.

By design, the `.aic/knowledge` directory is **lazy-created**. It does not exist on a fresh installation and is not initialized by `setup.sh`.

## The Pitfall
Pre-v3.1.6, `health-check.sh` erroneously checked `[[ -d "$SKILL_DIR/.aic/knowledge" ]]` as a strict requirement. On a cold start (no tasks run yet), this caused the global health state to report as **`degraded`** despite the system being fully functional.

Simultaneously, path drift existed where `engine/index.js` wrote to `$SKILL_DIR/knowledge/` while the shell scripts checked `$SKILL_DIR/.aic/knowledge/`.

## Resolution (v3.1.6)
1. **Canonical Path:** The canonical path for the Knowledge Subsystem is strictly `.aic/knowledge`.
2. **Lazy Health Status:** `health-check.sh` now classifies an absent `.aic/knowledge` directory as **`lazy`** rather than `unhealthy`.
3. **Global Status Protection:** The `lazy` state explicitly does **not** trigger a global `degraded` system state.

If the user reports `degraded` status on a fresh start with `knowledge: unhealthy`, they are likely running a pre-v3.1.6 `health-check.sh` script or have experienced a path regression.

Do NOT fix this by modifying `setup.sh` to create empty directories. Fix the health-check policy and ensure path canonicalization.

## Refinement (v3.2.0): Knowledge never triggers degradation — by design
The `for r in "$R_SERVER" "$R_AUTH" "$R_KNOWLEDGE" "$R_FS"` loop checks each component for `"unhealthy"`. But `check_knowledge()` only ever returns `"healthy"` or `"lazy"` — never `"unhealthy"`. This means knowledge is **naturally excluded** from triggering the degradation condition without needing any special handling or redundant guard lines.

Any code like `[[ "$STATE" == "healthy" && "$R_KNOWLEDGE" == "lazy" ]] && STATE="healthy"` is a no-op and should be removed. The protection is inherent in the two-value return contract of `check_knowledge()`.

If someone proposes adding `"unhealthy"` as a third return value for knowledge, that would break this implicit protection. Knowledge's two-value contract (`healthy`/`lazy`) is the deliberate design choice that makes it a safe best-effort subsystem.