# AIC Dashboard Architecture

**Enforced Constraint (2026-07-07):** The dashboard is strictly a read-only visual control plane ("Pure Virtual Office") combined with a minimal system config editor. 

## Core Principles
- **No Chat or Action Logs:** All human-in-the-loop interaction, task creation, and logging occur strictly in the Hermes TUI via the Dispatcher. The dashboard must NOT implement chat UI, task input forms, or activity log feeds.
- **Visual State Sync:** The UI visually reflects `state.json` (worker statuses, current engines) via continuous polling to `/api/status`.
- **Pipeline Tracker:** The UI tracks the strict, non-negotiable 5-phase lifecycle: `Investigate → Planning → Execution → Documentation → Verification`.
- **Config Management:** Exposes a simple editor for `.env` and `opencode.jsonc` via `/api/config` to allow hot-swapping providers or variables without restarting the control plane.
- **Minimal Backend (`server.js`):** Serves the static Vite build and acts as a strict state gatekeeper. It enforces the 5-phase lifecycle transitions and rejects out-of-bound worker activations (e.g., rejecting an Engineer from working during the Planning phase).