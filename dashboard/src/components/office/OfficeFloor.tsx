import { WorkerGrid } from './WorkerGrid';

export function OfficeFloor() {
  return (
    <div className="office-grid-bg bg-aic-bg-floor border-4 border-aic-border rounded relative pt-5 flex flex-col h-full shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
      {/* Label */}
      <div className="absolute top-[-2px] left-5 bg-aic-bg-dark px-3 py-1 font-pixel text-px-md text-aic-accent tracking-widest z-20 border-b-2 border-r-2 border-aic-border rounded-br">
        VIRTUAL OFFICE
      </div>
      
      {/* Worker Grid */}
      <div className="relative z-10 flex-1 px-2 pt-2 pb-2 min-h-0 flex flex-col justify-center">
        <WorkerGrid />
      </div>
      
      {/* Stats Panel */}
      <div className="relative z-20 w-full shrink-0">
      </div>
    </div>
  );
}
