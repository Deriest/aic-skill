import { useEffect, useRef } from 'react';
import { useDashboardContext } from '../context/DashboardContext';

export function useStatusPolling() {
  const { dispatch } = useDashboardContext();
  const errorCount = useRef(0);

  useEffect(() => {
    let mounted = true;
    
    const poll = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        if (mounted) {
          dispatch({ type: 'SET_STATE', payload: data });
          errorCount.current = 0;
        }
      } catch (err) {
        if (mounted) {
          errorCount.current++;
          if (errorCount.current > 2) {
            dispatch({ type: 'SET_ERROR', payload: 'Connection lost' });
          }
        }
      }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [dispatch]);
}