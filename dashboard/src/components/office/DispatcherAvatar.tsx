import { useDashboard } from '../../context/DashboardContext';
import { DISPATCHER_WORKER } from '../../data/workers';
import { WorkerDesk } from './WorkerDesk';

export function DispatcherAvatar() {
  const { state } = useDashboard();
  const status = state.workers.dispatcher?.status ?? 'idle';
  const engine = state.workers.dispatcher?.engine;

  return (
    <div className="flex justify-center border-b-2 border-aic-border/20 pb-4 mb-4">
      <div className="w-48">
        <WorkerDesk
          worker={DISPATCHER_WORKER}
          status={status}
          engine={engine}
        />
      </div>
    </div>
  );
}
