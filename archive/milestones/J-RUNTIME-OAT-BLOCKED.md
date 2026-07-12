# Milestone J — Runtime OAT (BLOCKED)

**Status:** BLOCKED
**Date:** 2026-07-10

---

## Pre-Check Result

The complete end-to-end AIC engineering pipeline does NOT exist as an automated orchestration.

Each stage requires manual invocation (API call or script execution). No automatic chaining exists.

---

## Pipeline Capability Matrix

| Stage | API Endpoint | Auto-triggered? | Classification |
|-------|-------------|-----------------|----------------|
| `/aic` entry point | `./aic` script | N/A (manual) | IMPLEMENTED |
| Project Selection | `/api/projects/select/:id` | ❌ Manual API call | IMPLEMENTED |
| Dispatcher → Task Start | `/api/task-start` | ❌ Manual API call | IMPLEMENTED |
| Task Decomposition | `/api/work-packages` | ❌ Manual API call | IMPLEMENTED |
| PM (investigate) | `phase-runner.sh investigate` | ❌ Manual script call | IMPLEMENTED |
| Research | `phase-runner.sh investigate` | ❌ Manual script call | IMPLEMENTED |
| Architect (planning) | `phase-runner.sh planning` | ❌ Manual script call | IMPLEMENTED |
| Backend (implementation) | `phase-runner.sh implementation` | ❌ Manual script call | IMPLEMENTED |
| QA (verification) | `phase-runner.sh verification` | ❌ Manual script call | IMPLEMENTED |
| PM Review | `/api/pm-review` | ❌ Manual API call | IMPLEMENTED |
| Knowledge Update | — | ❌ Not implemented | **NOT IMPLEMENTED** |
| Task Closeout | `/api/task-complete` | ❌ Manual API call | IMPLEMENTED |
| Phase auto-chaining | — | ❌ Does not exist | **NOT IMPLEMENTED** |
| Full pipeline orchestrator | — | ❌ Does not exist | **NOT IMPLEMENTED** |

---

## Missing Capabilities

### M-1: Knowledge Auto-Update

**Evidence:** `grep -n 'knowledge.*update\|knowledge.*auto' server.js` → NOT FOUND

The Knowledge Platform has CLI scripts (`knowledge-register.sh`, `knowledge-cross-project.sh`) but no automatic trigger after task completion.

### M-2: Phase Auto-Chaining

**Evidence:** `grep -n 'auto.*chain\|next.*phase\|run.*all' scripts/aic` → NOT FOUND

Each phase (investigate → planning → implementation → verification → closeout) must be triggered separately via `phase-runner.sh <phase> <dir> <workers>`.

No orchestrator exists to automatically advance from one phase to the next.

### M-3: Full Pipeline Orchestrator

**Evidence:** `grep -rl 'orchestrat\|auto.*run\|full.*pipeline' scripts/` → Only `dispatcher-orchestrator.sh` (J-7, dispatcher registry, not pipeline orchestration)

No script or server endpoint exists that executes the complete pipeline:
```
/aic → Project Select → Task Start → Decompose → PM → Research → Architect → Backend → QA → PM Review → Knowledge → Closeout
```

---

## What EXISTS vs What's MISSING

| Component | Status | Evidence |
|-----------|--------|----------|
| Worker spawn per phase | ✅ EXISTS | `spawn-worker.sh`, `phase-runner.sh` |
| Phase worker assignments | ✅ EXISTS | `server.js` lines 489-493 (PHASE_MAP) |
| PM Review API | ✅ EXISTS | `/api/pm-review` endpoint |
| Task state machine | ✅ EXISTS | `.aic/state.json`, `.aic/tasks/*/state.json` |
| Auto phase transition | ❌ MISSING | No code advances phase automatically |
| Knowledge auto-update | ❌ MISSING | No trigger after task/PM review |
| Full pipeline runner | ❌ MISSING | No `run-pipeline` command |

---

## Decision

**Milestone J Runtime OAT = BLOCKED**

**Reason:** The required Enterprise Runtime Pipeline (automatic end-to-end orchestration from `/aic` through all phases to Knowledge Update) is not implemented.

Every individual stage EXISTS as a manual API/script call. But the automatic orchestration that chains them together does NOT exist.

---

## Required Implementation to Unblock

To pass Runtime OAT, implement:

1. **Pipeline Orchestrator** (`scripts/pipeline-orchestrator.sh`):
   - Takes: project dir, task description
   - Chains: task-start → decompose → phase-runner (each phase) → pm-review → knowledge-update → task-complete
   - Each phase auto-starts after previous completes

2. **Knowledge Auto-Update** (server.js + knowledge-register integration):
   - Triggered automatically after PM Review completes
   - Registers artifacts in Knowledge Platform

3. **Phase State Machine** (server.js):
   - Tracks current phase
   - Auto-advances on phase completion
   - Reports progress via `/api/pipeline/status`

---

## Deliverables Produced

- `J-RUNTIME-OAT-BLOCKED.md` (this file)

---

## Final Decision

**Milestone J Runtime OAT = BLOCKED**

Required Enterprise Runtime Pipeline is not implemented.

Stop immediately.
