import { WorkerGrid } from './WorkerGrid';
import { StatsBar } from '../effects/StatsBar';

export function OfficeFloor() {
  return (
    <div className="office-grid-bg bg-aic-bg-floor border-4 border-aic-border rounded relative p-4 md:p-5">
      {/* Label */}
      <div className="absolute top-[-12px] left-5 bg-aic-bg-dark px-2.5 font-pixel text-px-md text-aic-accent tracking-widest z-10">
        VIRTUAL OFFICE
      </div>
      {/* Worker Grid — no overflow-hidden here; clipping happens inside WorkerGrid on the per-section card row */}
      <div className="relative z-10 pb-16 pt-3 px-1">
        <WorkerGrid />
      </div>
      {/* Stats — absolute overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <StatsBar />
      </div>
    </div>
  );
}
