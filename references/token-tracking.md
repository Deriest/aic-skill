# Token Cost Tracking Architecture

## Data Flow
```
spawn-worker.sh (capture opencode JSON output)
  → parse step_finish events for token counts
  → POST /api/metrics
  → server.js appends to .aic/metrics.json
  → dashboard GET /api/metrics (filter by date/tier)
  → CostsPage.tsx renders charts + table
```

## Metrics Schema
```json
{
  "id": "metric-<timestamp>",
  "timestamp": "ISO string",
  "worker": "pm|architect|research|designer|frontend|backend|qa|governor|documentation|perf|infra|security|data|integration",
  "tier": "thinker|crafter|sprinter",
  "model": "provider/ModelName",
  "tokens": {
    "input": 0,
    "output": 0,
    "reasoning": 0,
    "cacheRead": 0,
    "cacheWrite": 0,
    "total": 0
  },
  "durationSec": 0
}
```

## Cache Hit Rate Formula
**Correct:** `cacheRead / (cacheRead + input)`
**Wrong:** `cache / (input + output)` — produces values > 100%

## Pitfalls

### Vite Circular Chunk (Blank Production Build)
`manualChunks: { ui: ['recharts'], vendor: ['react', 'react-dom', 'framer-motion'] }` causes circular dependency. Fix: merge recharts into vendor chunk:
```ts
manualChunks: { vendor: ['react', 'react-dom', 'framer-motion', 'recharts'] }
```
Dev mode (vite dev) works fine because it doesn't bundle. Production build fails silently (blank page, one empty JS error).

### Recharts AreaChart Needs 2+ Data Points
AreaChart only renders filled areas between points. With 1 data point, it shows a dot. Use BarChart for single-point/categorical data.

### Recharts BarChart Hover Background
Default cursor on BarChart hover shows a light background. Disable with:
```tsx
<Tooltip cursor={{ fill: 'transparent' }} />
```

### XAxis Label Skipping
Recharts auto-skips labels when too many categories. Force all labels:
```tsx
<XAxis interval={0} tick={{ fontSize: 9 }} />
```

### Pre-populate All Workers
Always include all 9 workers (excluding dispatcher) in chart data with 0 values to reserve space:
```tsx
const ALL_WORKERS = [
  'pm', 'architect', 'research', 'designer', 'frontend', 'backend', 'qa', 
  'governor', 'documentation', 'perf', 'infra', 'security', 'data', 'integration'
];
```

### Worker Display Names
Use SHORT_NAMES for chart X-axis (fits better), WORKER_NAMES for table:
```tsx
const SHORT_NAMES = { pm: 'Aria', architect: 'Atlas', ... };
const WORKER_NAMES = { pm: 'Aria (PM)', architect: 'Atlas (Architect)', ... };
```

### Dispatcher Not Tracked
Dispatcher runs via Hermes directly, not through spawn-worker.sh. Token usage is overhead and not captured. Only the 9 workers are tracked.
