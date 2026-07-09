# Dispatcher Lifecycle & Execution Model

## Rule of 5 (Business Workflow)

The AIC organization follows a fixed 5-phase governance pipeline:

```
User
  ↓
Dispatcher (classify, route)
  ↓
PM (Discovery, requirements)
  ↓
Architect (technical design)
  ↓
Engineering (implementation)
  ↓
QA (verification)
  ↓
Governor (compliance, release)
  ↓
Dispatcher (deliver to user)
  ↓
User
```

Rule of 5 defines **who does what**. It does NOT define execution order within a phase.

---

## Execution Model (Scheduler Behavior)

Rule of 5 is executed through the Phase-Based Parallel Scheduler:

```
Investigate (Serial)
  → PM
  ↓
Planning (Serial then Parallel)
  → Architect (first)
  → THEN [Data, Integration, Infrastructure, Security] (concurrent)
  ↓
Implementation (Parallel)
  → [Backend, Frontend, Designer] (concurrent)
  ↓
Verification (Parallel)
  → [QA, Performance] (concurrent)
  ↓
Closeout (Serial)
  → Documentation (first)
  → THEN Governor
```

Execution Model defines **how workers run**. It is NOT Rule of 5.

---

## Phase Groups

### Investigate (Serial)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| PM | Dispatcher assignment | NO |
| Research | PM assignment | Conditional |

### Planning (Serial then Parallel)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| Architect | PM Discovery + PM PASS | NO (must complete first) |
| Data | Architecture Specification | YES |
| Integration | Architecture Specification | YES |
| Infrastructure | Architecture Specification | YES |
| Security | Architecture Specification | YES |

### Implementation (Parallel)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| Backend | Architecture Spec + Work Package + PM PASS | YES |
| Frontend | Architecture Spec + Work Package + PM PASS | YES |
| Designer | PM + Frontend request | YES |

### Verification (Parallel)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| QA | Implementation Reports + PM PASS | YES |
| Performance | Implementation Reports | YES |

### Closeout (Serial)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| Documentation | All phase reports | NO (must complete first) |
| Governor | All reports + Documentation + PM PASS | NO |

---

## Parallel Execution Rules

1. **Only officially defined Phase Groups execute concurrently.** No other parallel combinations are permitted.
2. **Serial phases remain serial.** Investigate and Closeout workers execute one at a time.
3. **Within Planning, Architect MUST complete before specialists.** Specialists cannot start until Architecture Specification exists.
4. **Within Closeout, Documentation MUST complete before Governor.** Governor cannot start until Documentation Handoff Report exists.
5. **Each Head Worker may spawn sub-workers.** Sub-workers provide additional parallelism within the Head Worker's scope.
6. **Phase barrier blocks until ALL required workers reach terminal state.** PM Review cannot begin until barrier completes.

---

## Dispatcher Lifecycle Process

### Investigate Phase
1. Dispatcher assigns task to PM
2. PM performs Discovery
3. PM produces Discovery Report + Work Package
4. PM Review → PASS
5. Dispatcher Gate → advance to Planning

### Planning Phase
1. Dispatcher spawns Architect
2. Architect produces Architecture Specification
3. PM Review (Architect) → PASS
4. Dispatcher spawns [Data, Integration, Infrastructure, Security] concurrently
5. Phase barrier: all 4 specialists complete
6. PM Review (per specialist artifact) → all PASS
7. Dispatcher Gate → advance to Implementation

### Implementation Phase
1. Dispatcher spawns [Backend, Frontend, Designer] concurrently
2. Phase barrier: all 3 complete
3. PM Review (per artifact) → all PASS
4. Dispatcher Gate → advance to Verification

### Verification Phase
1. Dispatcher spawns [QA, Performance] concurrently
2. Phase barrier: both complete
3. PM Review (per artifact) → all PASS
4. Dispatcher Gate → advance to Closeout

### Closeout Phase
1. Dispatcher spawns Documentation
2. Documentation produces Handoff Report
3. Dispatcher spawns Governor
4. Governor produces Release Checklist + Summary
5. PM Review → PASS
6. Dispatcher Gate → deliver to User

---

## REWORK Policy

If PM Review returns REWORK for one or more artifacts:

1. Dispatcher identifies failed workers
2. Dispatcher respawns ONLY failed workers
3. Previously PASSED workers retain their artifacts
4. Phase barrier re-triggers after respawned workers complete
5. PM reviews only new artifacts
6. Dispatcher Gate advances when all artifacts PASS
7. Max 2 rework attempts per worker

---

## Reference Runtime Example

```bash
# Investigate (serial)
spawn-worker.sh pm thinker /dir /prompt   # blocks
# PM Review → Dispatcher Gate

# Planning (serial then parallel)
spawn-worker.sh architect thinker /dir /prompt   # blocks
# PM Review (architect) → Dispatcher Gate

spawn-worker.sh data thinker /dir /prompt &
PID_DATA=$!
spawn-worker.sh integration thinker /dir /prompt &
PID_INTEG=$!
spawn-worker.sh infra crafter /dir /prompt &
PID_INFRA=$!
spawn-worker.sh security crafter /dir /prompt &
PID_SEC=$!
wait $PID_DATA $PID_INTEG $PID_INFRA $PID_SEC   # phase barrier
# PM Review (all 4) → Dispatcher Gate

# Implementation (parallel)
spawn-worker.sh backend crafter /dir /prompt &
PID_BE=$!
spawn-worker.sh frontend crafter /dir /prompt &
PID_FE=$!
spawn-worker.sh designer crafter /dir /prompt &
PID_DES=$!
wait $PID_BE $PID_FE $PID_DES   # phase barrier
# PM Review (all 3) → Dispatcher Gate

# Verification (parallel)
spawn-worker.sh qa crafter /dir /prompt &
PID_QA=$!
spawn-worker.sh perf sprinter /dir /prompt &
PID_PERF=$!
wait $PID_QA $PID_PERF   # phase barrier
# PM Review (all 2) → Dispatcher Gate

# Closeout (serial)
spawn-worker.sh documentation crafter /dir /prompt   # blocks
spawn-worker.sh governor sprinter /dir /prompt   # blocks
# PM Review → Dispatcher Gate → User
```

---

## API Calls

```bash
# Start task
curl -s -X POST $API/api/task-start -d '{"id":"TASK-...","title":"...","type":"..."}'

# Advance phase
curl -s -X POST $API/api/task-status -d '{"currentPhase":"Planning"}'

# Worker status (auto-updated by spawn-worker.sh)
# No manual API calls needed

# Close
curl -s -X POST $API/api/task-status -d '{"currentPhase":"Closeout"}'
curl -s -X POST $API/api/task-complete
```
