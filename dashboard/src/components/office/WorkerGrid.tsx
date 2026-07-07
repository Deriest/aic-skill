import { groupWorkersBySection } from '../../data/workers';
import { WorkerDesk } from './WorkerDesk';
import { useDashboardContext } from '../../context/DashboardContext';

export function WorkerGrid() {
  const { state } = useDashboardContext();
  const sections = groupWorkersBySection();

  return (
    <div className="flex-1 h-full flex flex-col items-center py-2 justify-center">
      <div className="w-full flex flex-col justify-between h-full max-h-full">
        {sections.map(([section, workers]) => (
          <div key={section} className="w-full flex flex-col items-center">
            <div className="font-pixel text-[10px] text-aic-text-muted/60 uppercase tracking-widest mb-1 text-center border-b border-aic-border/30 pb-1 w-1/3 max-w-sm">
              {section}
            </div>
            <div className="flex justify-center gap-2 md:gap-4 overflow-hidden w-full max-w-full">
              {workers.map((worker) => {
                const workerState = state.workers[worker.id];
                return (
                  <div key={worker.id} className="w-[200px] flex-shrink-0">
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
    </div>
  );
}