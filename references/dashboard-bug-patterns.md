# AIC Dashboard — Known Bugs & Fixes

For the full architecture document with decision matrices, file change summaries, and testing strategies, see `~/aic-fix-architecture.md`.

## Bug 1: Idle Stuck (agents stay in complete/working) ✅ FIXED

**Symptom:** After a task ends, agents persist in "complete" or "working" state. They don't auto-reset to "idle" on the next task.

**Root Cause (Precise):**
1. Dispatcher calls `update-status.py agent-status '{"agent":"pm","status":"working"}'` → writes `agents.pm = {status: "working"}` to status.json
2. Dispatcher calls `agent-status '{"agent":"pm","status":"complete"}'` → writes `agents.pm = {status: "complete"}` to status.json
3. Task ends. Nobody calls `reset`. status.json still has `agents.pm = {status: "complete"}`.
4. Server returns this stale agent state on every GET /api/status
5. Client reducer: `agents: action.payload.agents ?? state.agents` → replaces client agents with server agents (including stale pm=complete)
6. WorkerGrid: `state.agents[worker.id]?.status ?? 'idle'` → falls back to 'idle' only if key is MISSING from agents dict. But key EXISTS with value `{status: "complete"}` → stays complete.

**Key insight:** The `?? 'idle'` fallback only works for agents never written to the dict. Once written, the value persists forever.

**Fix Applied (2026-07-06):** `MERGE_STATUS` reducer action — implemented in `types/index.ts`, `dashboardReducer.ts`, and `useStatusPolling.ts`.

The polling hook dispatches `MERGE_STATUS` instead of `UPDATE_STATUS`. The reducer merges agents by key: any key present in `state.agents` but missing from incoming `data.agents` gets reset to `{ status: 'idle' }`. This means when the server stops reporting an agent (task reset), the client auto-idles it within one poll cycle (~2s).

**Files changed:**
- `src/types/index.ts` — Added `MERGE_STATUS` to `DashboardAction` union
- `src/context/dashboardReducer.ts` — New `MERGE_STATUS` case with key-based merge
- `src/hooks/useStatusPolling.ts` — Dispatch `MERGE_STATUS` instead of `UPDATE_STATUS`

## Bug 2: Log Dedup Blocks Accumulation ✅ FIXED

**Symptom:** Activity log only shows the first unique message, then stops. Server re-sends same log every poll.

**Root Cause (Precise):**
1. `update-status.py` writes `status.log` as a SINGLE OBJECT (not a queue) — `{"message": "...", "type": "info"}`
2. Server returns the same `log` on every GET /api/status until a new action overwrites it
3. Client dedup by `${message}::${type}` key blocks repeated messages
4. **Problem 1:** Two different actions within 2s producing different messages → server overwrites the first → client misses it entirely
5. **Problem 2:** Two agents producing same `message::type` → second silently dropped

**The dedup solves the wrong problem.** The real problem is the server only keeps the LATEST log.

**Fix Applied (2026-07-06):** Log queue + drain pattern — append on write, drain on read.

1. `update-status.py` now maintains a `logs` array. Every log-producing action (`task-start`, `phase-start`, `phase-complete`, `agent-status`, `log`) **appends** to the array instead of overwriting a single field. A backward-compat `log` field still points to the last entry.
2. `server.js` `GET /api/status` now **drains** the logs array: reads status.json, extracts all pending logs, returns them in a `logs: [...]` field, then writes back status.json with `logs: []`.
3. Client (`useStatusPolling.ts`) removes `seenLogsRef` entirely. Processes the `data.logs` array with a for-of loop, dispatching `APPEND_LOG` for each entry.

**ServerStatus type changed:** `log: { message, type }` → `logs: Array<{ message, type }>` in `src/types/index.ts`.

**NOTE (2026-07-07):** The drain-on-read pattern was briefly broken when the server was consolidated to a ring buffer. Restored in Bug 11 fix — server drains both `state.logs` and `state.log` on GET, flushes to disk.

## Bug 2 (superseded): Log Dedup Blocks Accumulation — then Ring Buffer Clash ⚠️ OPEN
- `src/hooks/useStatusPolling.ts` — Removed `seenLogsRef`, iterates `data.logs` array
- `src/types/index.ts` — `ServerStatus.log` → `ServerStatus.logs: Array<...>`

## Bug 3: UI Layout Not Clean ✅ FIXED

**Symptom:** Dashboard layout is functional but not visually polished.

**Fixes Applied (2026-07-06):**

| # | Issue | File | Fix |
|---|---|---|---|
| 1 | `min-h-[500px]` on OfficeFloor is arbitrary | OfficeFloor.tsx | Removed min-h; let content drive height |
| 2 | ActivityLog has fixed max-h instead of flex-grow | ActivityLog.tsx | Added `flex-1 min-h-0` for scrollable fill, bumped max-h to 400px |
| 3 | Flat 10-item grid with no visual hierarchy | WorkerGrid.tsx | Grouped by section (Product/Engineering/Governance) with labels via `useMemo` |
| 4 | Header scroll-border (-8px) overlaps content | Header.tsx | Changed to `bottom-0 translate-y-full` + `mb-2` on header |
| 5 | Sidebar width 320px insufficient on large screens | DashboardLayout.tsx | Changed to flex layout with `lg:w-[340px]` using `main`/`aside` semantic HTML |
| 6 | StatsBar consumes grid space | OfficeFloor.tsx | Absolute overlay at bottom of OfficeFloor |
| 7 | Idle count wrong — `agents.length` only counts explicitly set agents, not all 10 workers | StatsBar.tsx | Import `WORKERS` from data/workers.ts, use `WORKERS.length` as total instead of `agents.length` |

**StatsBar idle count bug detail:** After a task ends, if only 3 agents were set (pm=complete, frontend=complete, architect=complete), `agents.length = 3`, so `idle = 3 - 0 - 3 = 0`. But real idle should be `10 - 0 - 3 = 7`. Fix: `const total = WORKERS.length` (always 10).

**DashboardLayout key change:**
```tsx
<div className="flex flex-col lg:flex-row gap-3 md:gap-4 p-3 md:p-5 max-w-[1500px] mx-auto">
  <main className="flex-1 min-w-0"><OfficeFloor /></main>
  <aside className="w-full lg:w-[340px] lg:shrink-0"><Sidebar /></aside>
</div>
```

**Files changed:**
- `src/components/layout/DashboardLayout.tsx` — Grid → flex, semantic elements, 340px sidebar
- `src/components/office/OfficeFloor.tsx` — Removed min-h, StatsBar as absolute overlay
- `src/components/office/WorkerGrid.tsx` — Section grouping with useMemo
- `src/components/sidebar/ActivityLog.tsx` — Flex scrollable, max-h bumped
- `src/components/effects/StatsBar.tsx` — Dynamic idle count
- `src/components/layout/Header.tsx` — Border overlap fix

**Build verified:** `npx tsc --noEmit && npm run build` — 0 errors, 415 modules, 4.80s.

## Bug 4: Layout — Activity Log Position + Worker Detail ✅ FIXED

**Symptom:** Activity log was cramped in sidebar (340px). Worker desks only showed name + model, no role description.

**Fixes Applied (2026-07-07):**

| # | Issue | File | Fix |
|---|---|---|---|
| 1 | Activity log cramped in sidebar | DashboardLayout.tsx | Moved below Virtual Office, full width (`max-w-[1800px]`) |
| 2 | Sidebar too narrow for task info | DashboardLayout.tsx | Sidebar 340px → 320px, removed ActivityLog from Sidebar |
| 3 | Worker desks lack detail | WorkerDesk.tsx | Added role line between name and model |
| 4 | Main area too small | DashboardLayout.tsx | max-w 1500px → 1800px, bigger padding |

**New layout structure:**
```
┌─────────────────────────────────────────────┐
│  VIRTUAL OFFICE (full flex width)           │
│  [Workers grid with role + model labels]    │
│  [ACTIVE] [COMPLETE] [IDLE]                 │
├──────────┬──────────────────────────────────┤
│ SIDEBAR  │                                  │
│ Task     │                                  │
│ Pipeline │                                  │
├──────────┴──────────────────────────────────┤
│  ▸ ACTIVITY LOG (full width below office)   │
│  [entries...]                               │
└─────────────────────────────────────────────┘
```

**User preference:** "activity log di bawah memanjang ke kanan ukuran nya sama dengan virtual office" — activity log should stretch below the virtual office at full width.

**Files changed:**
- `src/components/layout/DashboardLayout.tsx` — Full-width layout, activity log below
- `src/components/sidebar/Sidebar.tsx` — Removed ActivityLog (now in layout)
- `src/components/sidebar/ActivityLog.tsx` — Full-width panel, max-h 300px
- `src/components/office/WorkerDesk.tsx` — Added role description line

## Bug 5: StatusBubble Shows IDLE Badge ✅ FIXED

**Symptom:** "IDLE" badge appears above every idle worker. User: "masih ada idle di atas designer tidak hilang".

**Root Cause:** `StatusBubble` renders for ALL statuses including idle. The idle variant shows a gray "IDLE" text badge.

**Fix:** `StatusBubble.tsx` — return `null` when `status === 'idle'`. Only show badges for working/complete/error.

```tsx
export function StatusBubble({ status }: StatusBubbleProps) {
  if (status === 'idle') return null;
  // ... rest of component
}
```

**User preference:** Idle workers should have NO visible status indicator. Only working/complete/error states get badges.

## Bug 6: Worker Label Text Too Small ✅ FIXED

**Symptom:** Worker name, role, and model text unreadable. User: "tulisan masih kurang besar, gedein sedikit lagi".

**Root Cause:** Tailwind pixel font sizes are tiny — `px-xs` = 6px, `px-sm` = 7px. With Press Start 2P font, these are barely legible.

**Fix:** Bump all worker labels:
- Worker name: `text-px-sm` (7px) → `text-px-base` (8px), color `#ccc`
- Role: `text-px-xs` (6px) → `text-px-sm` (7px), color `#888`
- Model: `text-px-xs` (6px) → `text-px-sm` (7px), cyan bold

**Rule of thumb:** Press Start 2P minimum readable size is 8px for primary labels, 7px for secondary. Below 7px is illegible on most screens.

## Architecture Change: Single Engine ✅ APPLIED

**User request (2026-07-07):** "semua worker kecuali orchestrator itu pakai opencode"

**Change:** All 9 workers now use `opencode run`. Only Dispatcher uses `delegate_task` (for parallel orchestration). Removed two-engine split entirely.

**Impact on SKILL.md:**
- "Two Worker Engines" table → single table, all opencode
- "How to Spawn Workers" → consolidated to one template
- delegate_task section → Dispatcher-only reference
- Rule #2: "All workers use OpenCode"
- Rule #16: no engine fallback, report to operator after 5 retries
- Rule #17-21: updated references to opencode

**User preference:** "info yang di beritahukan ke user yang penting2 saja" — reports should be concise, no rule numbers, no model names, no internal details.

## Bug 7: StatusBubble Overflow into Header ✅ FIXED

**Symptom:** COMPLETE/WORKING badge from top-row workers overflows upward and overlaps the "VIRTUAL OFFICE" header text. User: "ada icon dan complete terbang di header".

**Root Cause:** `StatusBubble` uses `absolute top-[-35px]` positioning. When a worker in the top row (Product section) has status "complete", the bubble escapes the OfficeFloor container and overlaps the header.

**First attempt (WRONG):** Added `overflow-hidden` to the outer `<div>` in OfficeFloor.tsx. This clipped the "VIRTUAL OFFICE" label which uses `absolute top-[-12px]` — both the label AND the badge were hidden.

**Correct fix:** Move `overflow-hidden` to the WorkerGrid wrapper div (one level deeper). This clips the StatusBubble inside the worker area while keeping the "VIRTUAL OFFICE" label visible above the border.

```tsx
// ❌ WRONG — clips the label too
<div className="... overflow-hidden">
  <div className="absolute top-[-12px]">VIRTUAL OFFICE</div>
  <div className="relative z-10 pb-16">

// ✅ CORRECT — clips only the StatusBubble
<div className="...">
  <div className="absolute top-[-12px]">VIRTUAL OFFICE</div>
  <div className="relative z-10 pb-16 overflow-hidden">
```

**Lesson:** `overflow-hidden` must go on the innermost container that wraps ONLY the elements to be clipped. If your fix clips things that should stay visible, you put it on the wrong ancestor — move it one level deeper.

## Bug 8: DeskComputer Stand Leaking Below Monitor ✅ FIXED

**Symptom:** Small gray 2×2px square visible below the desk computer monitor. User: "masih ada bug kecil di dashboard".

**Root Cause:** `DeskComputer.tsx` has a stand div with `absolute bottom-[-8px]` — a 2×2px gray square that extends 8px below the monitor container.

**Fix:** Remove the stand div entirely from `DeskComputer.tsx`. It's barely visible and causes overflow issues.

```tsx
// Removed:
<div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#222]" />
```

## Bug 9: Section Labels Too Close to Workers ✅ FIXED

**Symptom:** "PRODUCT" label and the PM character row are too close together. User: "turunin ui nya dikit atau kasih space di antara product dengan karakter PM".

**Fix:** `WorkerGrid.tsx` — increase section label bottom margin from `mb-2` to `mb-4` and add `mt-1`.

## Bug 10: Sidebar Not Filling Height ✅ FIXED

**Symptom:** Current Task and Pipeline panels don't stretch to match the Virtual Office height. User: "current task dan pipeline penuhi bagian kanan".

**Fix:** 3 changes:
1. `DashboardLayout.tsx` — add `lg:self-stretch` to `<aside>`
2. `Sidebar.tsx` — add `h-full` to wrapper div
3. `TaskInfoPanel.tsx` + `PipelinePanel.tsx` — add `flex-1` to panel divs

## Bug 11: Ring Buffer + APPEND_LOG = Duplicate Logs ✅ FIXED (2026-07-07)

**Symptom:** Activity log grows unboundedly, showing the same entries repeatedly (every 2s poll cycle). User saw: "ini kenapa mengulang2" in activity log.

**Root Cause (2026-07-07):** Server was consolidated from Python+Node hybrid to single Node authority (Batch 2). The ring buffer (100 entries, in-memory) returns the same `state.logs` array on every GET `/api/status`. But `useStatusPolling.ts` still iterates `data.logs` and dispatches `APPEND_LOG` for every entry on every poll — the server never clears the array, so every entry gets re-appended with a new UUID each cycle.

**Fix Applied — SERVER-SIDE drain (not client-side SET_LOGS):**

Rather than adding a new `SET_LOGS` reducer action on the client, the fix restores the drain-on-read pattern on the server. This keeps the client code unchanged and maintains the original contract: "client receives logs once, server clears them after read."

Three changes in `server.js` GET `/api/status` handler:
```js
// 1. Snapshot logs + backward-compat log field
const logsOut = state.logs.slice();
const logOut = state.log;

// 2. Drain both
state.logs = [];
state.log = null;

// 3. Persist drain to disk (prevents re-delivery on restart)
flush();
```

**Sub-bug: `state.log` also needed draining.** The backward-compat `log` field (single latest entry) was never cleared. Even after draining `state.logs`, the `log` field persisted old entries. This caused grep-based test assertions to still match on poll 2+.

**Verification (ad-hoc):** Seed 2 unique markers via POST `/api/log`, then 3 sequential GET polls:
```
P1 X=1 Y=1   ← delivered once
P2 X=0 Y=0   ← drained
P3 X=0 Y=0   ← still empty
```

**Files changed:**
- `scripts/server.js` — Drain `state.logs` + `state.log` on GET, flush to disk

**Why server-side over client-side:** The original Bug 2 fix established a drain-on-read contract. The ring buffer consolidation broke that contract. Restoring it server-side (3 lines) is simpler than changing client reducer + types + hook. The client's `APPEND_LOG` loop remains correct — it processes a drained queue exactly once.

## Component Quick Reference

| File | Purpose | Key Changes (2026-07-06) |
|------|---------|--------------------------|
| `dashboardReducer.ts` | State management | Added `MERGE_STATUS` action (key-based merge with idle default) |
| `useStatusPolling.ts` | 2s polling | `MERGE_STATUS` dispatch, `data.logs` array iteration, no dedup |
| `WorkerGrid.tsx` | Grid layout | Section grouping (Product/Engineering/Governance) |
| `StatsBar.tsx` | Active/Complete/Idle | Dynamic count from `WORKERS.length` (not agents.length) |
| `StatusBubble.tsx` | Status badge above worker | Returns null for idle — no badge shown |
| `WorkerDesk.tsx` | Worker desk + labels | Name (8px) + role (7px) + model (7px cyan bold) |
| `DashboardLayout.tsx` | Main layout | Flex, full-width activity log below office, 1800px max, `lg:self-stretch` sidebar |
| `ActivityLog.tsx` | Log display | Flex scrollable, max-h 400px |
| `DeskComputer.tsx` | Monitor above worker | Screen glow, no stand div |
| `Sidebar.tsx` | Task + Pipeline panels | `h-full` for height fill |
| `TaskInfoPanel.tsx` | Current task display | `flex-1` for sidebar fill |
| `PipelinePanel.tsx` | Pipeline phases | `flex-1` for sidebar fill |
| `server.js` | Node API server (port 6868) | Single authority: in-memory state, ring buffer (100 logs), drain-on-read (Bug 11 fix), POST endpoints, history.json, restart resilience |
| `types/index.ts` | TypeScript types | `MERGE_STATUS` action, `ServerStatus.logs` array |

## Dashboard Ports

| Service | Port | Notes |
|---------|------|-------|
| Vite dev server | **6969** | React UI |
| Status API (Node) | **6868** | `/api/status` JSON |
