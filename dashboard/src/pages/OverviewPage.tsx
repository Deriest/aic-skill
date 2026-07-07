import { OfficeFloor } from '../components/office/OfficeFloor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';
import { useDashboardContext } from '../context/DashboardContext';

export function OverviewPage() {
  const { state } = useDashboardContext();

  const active = Object.values(state.workers).filter(w => w.status === 'working').length;
  const idle = Object.values(state.workers).filter(w => w.status === 'idle').length;

  return (
    <div className="flex flex-1 p-6 gap-6 w-full h-full min-h-0">
      {/* Main Content (Left) */}
      <div className="flex-[2] flex flex-col min-w-0 gap-4 h-full">
        <h2 className="font-pixel text-aic-accent text-px-md uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)] shrink-0">OVERVIEW</h2>
        
        {/* Virtual Office Box */}
        <div className="flex-1 min-h-0 bg-aic-bg-panel border-2 border-aic-border/50 rounded p-1 shadow-lg overflow-hidden">
           <OfficeFloor />
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 shrink-0 font-pixel h-[100px]">
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center py-2">
            <span className="text-3xl text-aic-accent mb-1">{active}</span>
            <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">ACTIVE</span>
          </div>
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center py-2">
            <span className="text-3xl text-aic-green mb-1">0</span>
            <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">COMPLETE</span>
          </div>
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center py-2">
            <span className="text-3xl text-aic-text-muted mb-1">{idle}</span>
            <span className="text-px-sm text-aic-text-muted uppercase tracking-widest">IDLE</span>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="flex-1 flex flex-col gap-6 h-full min-w-[400px]">
        <PipelineTracker state={state} />
      </div>
    </div>
  );
}