import { useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { POLL_INTERVAL } from '../utils/constants';
import type { ServerStatus } from '../types';

export function useStatusPolling() {
  const { state, dispatch } = useDashboard();
  const prevTaskIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ServerStatus = await res.json();

      // Update connection state
      if (!state.connected) {
        dispatch({ type: 'SET_CONNECTED', payload: true });
      }

      // Dispatch agent/phase/task updates (merge to avoid stale agent leaks)
      dispatch({
        type: 'MERGE_STATUS',
        payload: {
          agents: data.agents,
          phases: data.phases,
          currentTask: data.currentTask,
        },
      });

      // Track new task start
      if (data.currentTask?.id !== prevTaskIdRef.current) {
        prevTaskIdRef.current = data.currentTask?.id ?? null;
        dispatch({ type: 'SET_TASK_START', payload: Date.now() });
      }

      // Append all new logs from server (drained queue — no dedup needed)
      if (data.logs && data.logs.length > 0) {
        for (const log of data.logs) {
          dispatch({
            type: 'APPEND_LOG',
            payload: {
              id: crypto.randomUUID(),
              message: log.message,
              type: log.type,
              timestamp: new Date(),
            },
          });
        }
      }
    } catch {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    }
  };

  useEffect(() => {
    fetchStatus(); // Initial fetch
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    // Pause on tab hidden
    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalRef.current);
      } else {
        fetchStatus();
        intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
