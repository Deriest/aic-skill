import { groupWorkersBySection } from '../../data/workers';
import { WorkerDesk } from './WorkerDesk';
import { useDashboardContext } from '../../context/DashboardContext';

export function WorkerGrid() {
  const { state } = useDashboardContext();
  const sections = groupWorkersBySection();

  return (
    <div className="space-y-4 flex flex-col items-center">
      {sections.map(([section, workers]) => (
        <div key={section} className="w-full flex flex-col items-center">
          <div className="font-pixel text-px-xs text-aic-text-muted uppercase tracking-widest mb-4 mt-1 text-center">
            {section}
          </div>
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 overflow-hidden">
            {workers.map((worker) => {
              const workerState = state.workers[worker.id];
              return (
                <div key={worker.id} className="w-[140px] md:w-[150px] flex-shrink-0 h-full">
                  <WorkerDesk
                    worker={worker}
                    status={workerState?.status ?? 'idle'}
                    engine={workerState?.engine}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}