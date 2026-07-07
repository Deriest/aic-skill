import { groupWorkersBySection } from '../../data/workers';
import { WorkerDesk } from './WorkerDesk';
import { useDashboardContext } from '../../context/DashboardContext';

export function WorkerGrid() {
  const { state } = useDashboardContext();
  const sections = groupWorkersBySection();

  return (
    <div className="space-y-12 flex flex-col items-center py-6">
      {sections.map(([section, workers]) => (
        <div key={section} className="w-full flex flex-col items-center">
          <div className="font-pixel text-px-sm text-aic-text-muted/60 uppercase tracking-widest mb-6 text-center border-b border-aic-border/30 pb-2 w-1/2 max-w-md">
            {section}
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 overflow-hidden max-w-5xl">
            {workers.map((worker) => {
              const workerState = state.workers[worker.id];
              return (
                <div key={worker.id} className="w-[150px] md:w-[160px] flex-shrink-0 h-full">
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