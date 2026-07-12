# Dashboard Source Development Workflow

## Source Location

Dashboard source code lives in `dashboard/src/` (NOT compiled-only).

## Component Structure

```
dashboard/src/
├── App.tsx                          # Router
├── main.tsx                         # Entry point
├── index.css                        # Global styles
├── context/
│   └── DashboardContext.tsx          # State management (useReducer)
├── data/
│   └── workers.ts                   # Worker registry (15 workers)
├── types/                           # TypeScript types
├── pages/
│   ├── OverviewPage.tsx             # Main dashboard (Office + Pipeline + Stats)
│   ├── HistoryPage.tsx              # Task history
│   ├── CostsPage.tsx                # Token costs
│   └── ConfigPage.tsx               # Configuration
├── components/
│   ├── office/                      # Virtual Office
│   │   ├── OfficeFloor.tsx          # Office container
│   │   ├── WorkerGrid.tsx           # 5-5-5 worker grid
│   │   ├── WorkerDesk.tsx           # Individual worker card
│   │   ├── DeskComputer.tsx         # Worker computer visual
│   │   └── StatusBubble.tsx         # Status indicator
│   ├── new_layout/                  # Pipeline & Runtime Gate
│   │   ├── PipelineTracker.tsx      # Pipeline phases + Runtime Gate + ElapsedTimer
│   │   └── WorkspaceScene.tsx       # Workspace scene
│   ├── shared/                      # Reusable components
│   │   ├── MetricCard.tsx           # Metric display card
│   │   ├── DataTable.tsx            # Data table
│   │   ├── EmptyState.tsx           # Empty state placeholder
│   │   ├── ErrorBoundary.tsx        # Error boundary
│   │   └── PageShell.tsx            # Page wrapper
│   └── layout/                      # Layout components
│       ├── DashboardLayout.tsx      # Main layout
│       ├── CRTOverlay.tsx           # CRT scanline effect
│       ├── ConnectionIndicator.tsx   # Connection status
│       └── FloatingParticles.tsx    # Particle effect
```

## Build Process

```bash
cd dashboard && npm run build
```

Output: `dashboard/dist/` (served by server.js at `http://localhost:6868`)

## Key Layout Ratios (OverviewPage)

- Left (Virtual Office): `flex-[1.5]`
- Right (Pipeline + Stats + Performance): `flex-1`
- PipelineTracker: two panels at `h-[190px]` each
- Worker Summary: `grid grid-cols-4`
- Performance Panel: live data from `/api/metrics/summary`

## State Flow

```
DashboardContext (useReducer)
  → SET_STATE action (from SSE /api/events)
  → state.workers, state.currentTask, state.currentPhase
  → OverviewPage reads state
  → PipelineTracker, WorkerGrid, PerfPanel consume state
```

## API Endpoints Used

| Endpoint | Used By | Data |
|----------|---------|------|
| `/api/status` | DashboardContext (SSE) | Workers, task, phase |
| `/api/metrics/summary` | PerfPanel | CPU, memory, load |
| `/api/metrics` | CostsPage | Token usage, cost |
| `/api/tasks` | HistoryPage | Task history |
| `/api/config` | ConfigPage | Runtime config |
| `/api/pipeline/status` | PipelineTracker | Phase state |

## Pitfalls

### Tailwind Config
NEVER overwrite `tailwind.config.js`. Use `patch` to add entries only. Existing config has custom `aic` colors, `pixel` font, `fontSize` tokens.

### Fixed Heights
PipelineTracker panels use fixed `h-[190px]`. When adjusting, ensure total right column fits in viewport (100vh). Too tall = Performance panel cut off at bottom.

### Performance Panel Data
`/api/metrics/summary` returns flat object: `{memory: {rss, heapUsed}, cpu: {loadAvg, cores}}`. The full `/api/metrics` returns `{metrics, summary}` with cost in `summary.cost`. Use `/api/metrics/summary` for live perf panel (simpler shape).
