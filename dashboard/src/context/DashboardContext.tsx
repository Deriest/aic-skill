import { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import type { DashboardState, DashboardAction } from '../types';

export interface MetricsState {
  memory?: { rss: number; heapUsed: number; heapTotal: number };
  cpu?: { loadAvg: number[]; cores: number };
  total?: number;
  totalRequests?: number;
  totalInput?: number;
  totalOutput?: number;
  latency?: {
    sli: {
      windowSamples: number;
      latencyMs: { p50: number; p95: number; p99: number };
      errorRate: number;
      slo: {
        apiP99TargetMs: number;
        apiP99Met: boolean;
        errorBudgetPct: number;
        errorBudgetConsumedPct: number;
        errorBudgetRemainingPct: number;
      };
    };
    updatedAt: string | null;
  };
}

const initialState: DashboardState = {
  connected: false,
  workers: {},
  currentTask: null,
  currentPhase: null,
  runtimeGate: null,
  phaseBarrier: null,
  pmReview: null,
  rework: null,
  startedAt: Date.now(),
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...action.payload, connected: true };
    case 'SET_ERROR':
      return { ...state, connected: false };
    default:
      return state;
  }
}

const DashboardContext = createContext<{
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
  metrics: MetricsState;
} | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [metrics, setMetrics] = useReducer(
    (prev: MetricsState, next: Partial<MetricsState>) => ({ ...prev, ...next }),
    {} as MetricsState
  );
  const errorCount = useRef(0);

  // Status polling — single source, 5s
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        if (mounted) { dispatch({ type: 'SET_STATE', payload: data }); errorCount.current = 0; }
      } catch {
        if (mounted) { errorCount.current++; if (errorCount.current > 2) dispatch({ type: 'SET_ERROR', payload: 'Connection lost' }); }
      }
    };
    poll();
    const i = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(i); };
  }, [dispatch]);

  // Metrics polling — single source, 5s
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/metrics/summary');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setMetrics(data);
      } catch { /* silent */ }
    };
    poll();
    const i = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(i); };
  }, []);

  return (
    <DashboardContext.Provider value={{ state, dispatch, metrics }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}
