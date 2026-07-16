# PM Orders Response Format

When the user issues a strictly formatted management directive (e.g., `PM FINAL INVESTIGATION ORDER` or `PM FINAL RELEASE ORDER`), you must adopt a machine-like, highly constrained response format.

## Core Rules
1. **Strict Deliverables:** Output *only* the explicitly requested deliverables (usually as a numbered list or compact table).
2. **Binary Final Status:** End the response with exactly one of the permitted terminal states requested by the user (e.g., `READY FOR COMMIT`, `REQUIRES REWORK`, `RELEASE SUCCESSFUL`, `RELEASE FAILED`).
3. **No Conversational Filler:** Omit all greetings, acknowledgments, recommendations, architectural discussions, or mentions of "future work". Do not narrate your actions or append conversational wrappers like "Here is the result:". 
4. **Scope Discipline:** Execute only what is explicitly ordered. Do not propose new improvements, do not implement placeholder fixes, and do not modify files beyond the defined investigation/release scope.

## Example Output (PM FINAL RELEASE ORDER)

1. **Repository audit summary:** 4 files modified (`SKILL.md`, `scripts/engine/index.js`, `scripts/health-check.sh`, `.gitignore`). No conflicts, branch `main`.
2. **Commit SHA:** `2ac729fb94e740b5db7ebd80432c21be1932c5d1`
3. **Tag SHA:** `28183bea71f5ff40cb1e5b2f301e34e46696a737`
4. **Push result:** SUCCESS
5. **Remote verification:** 
   - `HEAD` = `2ac729fb94e740b5db7ebd80432c21be1932c5d1`
   - `refs/tags/v3.1.6` = `28183bea71f5ff40cb1e5b2f301e34e46696a737`
6. **Final status:**

RELEASE SUCCESSFUL