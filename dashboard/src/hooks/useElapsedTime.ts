import { useState, useEffect } from 'react';
import { computeElapsed } from '../utils/formatters';

export function useElapsedTime(startTimestamp: number | null): string {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startTimestamp) {
      setElapsed('00:00:00');
      return;
    }

    const update = () => setElapsed(computeElapsed(startTimestamp));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startTimestamp]);

  return elapsed;
}
