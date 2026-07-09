# Dashboard Specification v1.0

**Status:** OFFICIAL BASELINE
**Authority:** ADR-002, Dashboard Specification Freeze

---

## Philosophy

Dashboard is an **observability layer** — NOT a control center.
- Displays runtime state
- Never owns business logic
- Never controls execution
- Never computes scheduler state
- Consumes `server.js` API as Single Source of Truth

## Information Hierarchy

| Priority | Panel | Question Answered |
|----------|-------|-------------------|
| 1 | Virtual Office | Who is working? |
| 2 | Current Task | What is being executed? |
| 3 | Pipeline | Which lifecycle phase is active? |
| 4 | Runtime Gate | Why hasn't execution advanced? |
| 5 | Worker Statistics | What is workforce status? |

## Layout

```
┌──────────────────────────┬────────────────────┐
│                          │                    │
│   VIRTUAL OFFICE         │   PIPELINE         │
│   (flex-2, ~60%)         │   (flex-1.2, ~40%) │
│                          │                    │
│                          │  ┌──────────────┐  │
│                          │  │ Current Task  │  │
│                          │  ├──────────────┤  │
│                          │  │ Pipeline +    │  │
│                          │  │ Runtime Gate  │  │
│                          │  └──────────────┘  │
│                          │                    │
├──────────────────────────┤                    │
│ WORKING│COMPLETE│ IDLE   │                    │
└──────────────────────────┴────────────────────┘
```

- 100vh, no scrolling
- Only log areas may scroll internally
- Virtual Office never scrolls

## Component Rules

| Panel | Shows | NEVER Shows |
|-------|-------|-------------|
| Virtual Office | Worker positions, state, department | Pipeline, logs, task details |
| Current Task | Task ID, title, type, log | Pipeline, runtime gate |
| Pipeline | 5 lifecycle phases only | Worker names, task details |
| Runtime Gate | Gate type, owner, barrier, PM review, elapsed | Pipeline info, worker info |
| Statistics | Working, Complete, Idle (3 cards) | Charts, graphs, history |

## Colors

| State | Color |
|-------|-------|
| Working | Yellow |
| Idle | Grey |
| Complete | Green |
| REWORK | Red |
| Waiting PM | Cyan accent |
| Current phase | Cyan + glow |
| Completed phase | Green + glow |
| Future phase | Grey |

## Principles

1. Virtual Office never scrolls
2. Overview fits in one viewport
3. Pipeline shows lifecycle only
4. Runtime Gate explains bottlenecks
5. Statistics remain three cards
6. Dashboard never computes runtime state
7. No duplicated information across panels
8. Every panel answers ONE question
