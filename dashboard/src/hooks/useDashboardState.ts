import { useState, useEffect } from 'react';
import { api } from '../api';
import { DashboardState } from '../types';

export function useDashboardState() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const poll = async () => {
      try {
        const data = await api.getStatus();
        if (mounted) {
          setState(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Connection lost');
      }
    };

    poll(); // Initial load
    const interval = setInterval(poll, 1500); // Live update every 1.5s
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { state, error };
}