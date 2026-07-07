import { useMemo } from 'react';
import { WORKERS } from '../../data/workers';
import { WorkerDesk } from './WorkerDesk';
import { useDashboardContext } from '../../context/DashboardContext';

export function WorkerGrid() {
  const { state } = useDashboardContext();

  const sections = useMemo(() => {
    const grouped: Record<string, typeof WORKERS> = {};
    for (const worker of WORKERS) {
      if (!grouped[worker.section]) {
        grouped[worker.section] = [];
      }
      grouped[worker.section].push(worker);
    }
    return Object.entries(grouped);
  }, []);

  return (
    <div className="space-y-4">
      {sections.map(([section, workers]) => (
        <div key={section}>
          <div className="font-pixel text-px-xs text-aic-text-muted uppercase tracking-widest mb-4 ml-1 mt-1">
            {section}
          </div>
          <div className="grid grid-cols-office-sm md:grid-cols-office-md lg:grid-cols-office gap-3 md:gap-4 overflow-hidden">
            {workers.map((worker) => {
              const workerState = state.workers[worker.id];
              return (
                <WorkerDesk
                  key={worker.id}
                  worker={worker}
                  status={workerState?.status ?? 'idle'}
                  engine={workerState?.engine}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}