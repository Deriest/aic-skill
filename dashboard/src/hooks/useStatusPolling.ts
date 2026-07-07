import { useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { POLL_INTERVAL } from '../utils/constants';
import type { ServerStatus } from '../types';

export function useStatusPolling() {
  const { state, dispatch } = useDashboard();
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ServerStatus = await res.json();

      if (!stateRef.current.connected) {
        dispatch({ type: 'SET_CONNECTED', payload: true });
      }

      dispatch({
        type: 'MERGE_STATUS',
        payload: {
          workers: data.workers,
          phases: data.phases,
          currentTask: data.currentTask,
          workflow: data.workflow,
        },
      });
    } catch {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    }
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

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
