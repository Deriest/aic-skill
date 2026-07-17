import { WORKERS, groupWorkersBySection } from '../../data/workers';
import { WorkerDesk } from './WorkerDesk';
import { useDashboardContext } from '../../context/DashboardContext';

export function WorkerGrid() {
  const { state } = useDashboardContext();
  const sections = groupWorkersBySection();

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center min-h-0">
      <div className="w-full flex flex-col gap-3 justify-center h-full overflow-y-auto pt-2">
        {sections.map(([section, workers]) => (
          <div key={section} className="w-full flex flex-col items-center shrink-0">
            <div className="font-pixel text-[10px] text-aic-text-muted/60 uppercase tracking-widest mb-1.5 text-center border-b border-aic-border/30 pb-1 w-1/3 max-w-sm">
              {section}
              <span className="ml-2 text-aic-accent/50">({workers.length})</span>
            </div>
            <div className="flex justify-center gap-3 w-full">
              {workers.map((worker) => {
                const ws = state.workers?.[worker.id];
                let uiStatus: string = ws?.status ?? 'idle';
                const activeSubs = ws?.subWorkers?.filter(s => s.status === 'working').length ?? 0;
                const completedSubs = ws?.subWorkers?.filter(s => s.status === 'complete').length ?? 0;
                const totalSubs = ws?.subWorkers?.length ?? 0;
                if (worker.id === 'dispatcher' && state.connected) uiStatus = 'working';
                else if (uiStatus === 'working' || activeSubs > 0) uiStatus = 'working';
                else if (state.rework?.failedWorkers?.includes(worker.id)) uiStatus = 'rework';
                else if (uiStatus === 'complete' && state.pmReview?.phase === worker.phase && state.currentTask?.pipelineState !== 'COMPLETE' && state.runtimeGate?.status !== 'complete') uiStatus = 'waiting_pm';
                return (
                  <div key={worker.id} className="w-[175px]">
                    <WorkerDesk worker={worker} status={uiStatus} engine={ws?.engine}
                      subWorkerCount={completedSubs} subWorkerTotal={totalSubs > 0 ? totalSubs : undefined} />
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
