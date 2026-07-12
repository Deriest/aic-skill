# AIC Dashboard Theming & Workflow Rules

## 1. Git Workflow: STRICTLY No Auto-Commit
- **Rule:** NEVER automatically `git commit` after finishing an implementation or fix. 
- **Why:** The user ("tvd") requires manual review of the visual and functional state before changes are committed ("ga ada yang suruh commit"). Auto-committing disrupts their review flow and requires reverting.
- **Action:** Stage changes (`git add .`), visually verify them, report readiness to the user, and **WAIT** for their explicit command to commit.

## 2. Strict Single-Theme Status Colors
The dashboard UI enforces a strict "one theme per status" rule. Do not mix colors for a single state (e.g., blue borders with yellow text). All elements of a worker's representation (border, text, pulse/glow, badges, background tints) must share the same base color:
- **WORKING:** Yellow (`text-aic-yellow`, `border-aic-yellow`, yellow shadow/glow).
- **COMPLETE:** Green (`text-aic-green`, `border-aic-green`, green shadow/glow).
- **IDLE:** Gray/Muted (`text-gray-500`, muted borders and backgrounds).
- **REWORK / BLOCKED:** Red (`text-red-400` or `text-red-500`, red shadow/glow).

*Pitfall:* Watch out for duplicated state mappings. Components like `WorkerDesk.tsx` and `StatusBubble.tsx` may both have their own `statusConfig` objects. If you change a status color, you must update it in **all** localized config objects to maintain the single-theme rule.

## 3. Visual Spacing & Proportions
- **Avoid 100% Heights:** When adjusting large structural panels (like the Virtual Office floor), prefer percentage heights that leave a slight gap (e.g., `h-[94%]`) over `h-full` unless explicitly requested. The user dislikes panels that stretch entirely to the bottom edge without breathing room.
- **Readability Margins:** Ensure text labels (like worker names) placed below structural elements (like desks) have sufficient margin (e.g., `mt-2`) so the text does not touch or overlap the structural borders.
- **Gap vs Per-Section Spacing:** `gap-N` on a parent flex/grid container applies to ALL children equally. If the user wants different spacing between specific sections, remove the parent `gap` and use per-section `mt-*` / `mb-*` instead. User was frustrated when `gap-2` caused unwanted space between STATUS cards and PERFORMANCE panel.

## 4. Vite Build Timing Pitfall (CRITICAL)
After editing dashboard source files, `npm run build` may succeed but the `dist/` output can be OLDER than the source if the build ran before the last edit. The AIC server serves from `dist/`, so the browser shows stale content.

**Verification pattern:**
```bash
stat -c '%Y %y' dashboard/dist/index.html
stat -c '%Y %y' dashboard/src/pages/OverviewPage.tsx
```
If source timestamp > dist timestamp, run `npm run build` again before restarting the server.

**Why this happens:** Multiple rapid edits + one `npm run build` in between. The build captures everything up to that point, but subsequent `patch` edits are not included.

**Fix:** Always rebuild AFTER the last edit, then restart server, then tell user to hard-refresh (`Ctrl+Shift+R`).

## 5. Python Replace + Unicode Pitfall
Python `str.replace()` silently fails when the search string contains unicode characters (e.g., `▶`, `✓`) that don't match the encoded representation in the file. The replace returns without error but doesn't change anything.

**Fix:** Use the `patch` tool instead of Python string replace for files containing unicode characters. The `patch` tool handles encoding correctly.

**Example:** `▶` in `<span className="text-aic-accent text-[10px]">▶</span>` — Python replace with this literal character failed silently. `patch` tool worked immediately.

## 6. Performance Panel: Single Column Layout
The Performance panel uses `flex flex-col gap-0.5` (not `grid grid-cols-2`). User explicitly requested vertical single-column layout. All metrics stack vertically: RSS, Heap, Load 1m, Load 5m, Cores, Total Requests, Total Input, Total Output.

Title "▶ PERFORMANCE" is ABOVE the card, not inside it (consistent with PIPELINE/RUNTIME GATE/STATUS titles).

Task Runtime was REMOVED from the Performance panel — it lives in the Pipeline/Runtime Gate section instead.

## 7. Dispatcher Always Working When Connected
When the AIC server is online, the dispatcher (Hermes) worker must ALWAYS display `working` status — it is never `idle`. The backend may report `status: 'idle'` for the dispatcher, but the UI must override this.

**Implementation:** In `WorkerGrid.tsx`, after resolving `uiStatus`:
```typescript
if (worker.id === 'dispatcher' && state.connected) uiStatus = 'working';
```
The `DELEGATE` badge on the dispatcher card is also tied to `status === 'working'`, so it always renders when connected.

The OverviewPage stats (working/complete/idle counts) must also treat dispatcher as always working:
```typescript
if (w.id === 'dispatcher' && state.connected) return true; // always working
```

## 8. Right Panel Layout Order
The right panel vertical order is: **Pipeline/Runtime Gate → PERFORMANCE → STATUS**.

User explicitly requested STATUS be moved below PERFORMANCE. When iterating on layout order, confirm the final sequence with the user before committing — they may want to swap sections again.

## 9. Pipeline/Runtime Gate Height Sync
Both Pipeline and Runtime Gate cards must have the same fixed height (`h-[180px]`) to stay bottom-aligned. Use `grid grid-cols-2` for the parent container instead of `flex` to guarantee equal heights regardless of content. The title areas also need fixed height (`h-[28px]`) to prevent misalignment when one title has extra content (e.g., timer in Runtime Gate title).