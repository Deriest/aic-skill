import { DISPATCHER_WORKER } from '../../data/workers';
import { WorkerDesk } from './WorkerDesk';

export function DispatcherAvatar() {
  // Dispatcher is always "working" as it handles the orchestration
  const status = 'working';
  const engine = 'hermes'; // Dispatcher uses Hermes engine

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
