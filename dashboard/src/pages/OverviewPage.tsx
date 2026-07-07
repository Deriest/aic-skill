import { OfficeFloor } from '../components/office/OfficeFloor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';
import { useDashboardContext } from '../context/DashboardContext';

export function OverviewPage() {
  const { state } = useDashboardContext();

  const active = Object.values(state.workers).filter(w => w.status === 'working').length;
  const idle = Object.values(state.workers).filter(w => w.status === 'idle').length;

  return (
    <div className="flex flex-1 overflow-hidden p-6 gap-6 w-full">
      {/* Main Content (Left) */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        <h2 className="font-pixel text-aic-accent text-px-md uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">OVERVIEW</h2>
        
        {/* Virtual Office Box */}
        <div className="flex-1 min-h-0 bg-aic-bg-panel border-2 border-aic-border/50 rounded p-1 shadow-lg">
           <OfficeFloor />
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 shrink-0 font-pixel mt-2">
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center py-4">
            <span className="text-4xl text-aic-accent mb-2">{active}</span>
            <span className="text-px-sm text-aic-text-muted uppercase">ACTIVE</span>
          </div>
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center py-4">
            <span className="text-4xl text-aic-green mb-2">0</span>
            <span className="text-px-sm text-aic-text-muted uppercase">COMPLETE</span>
          </div>
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center py-4">
            <span className="text-4xl text-aic-text-muted mb-2">{idle}</span>
            <span className="text-px-sm text-aic-text-muted uppercase">IDLE</span>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[400px] shrink-0 flex flex-col gap-6">
        <PipelineTracker state={state} />
      </div>
    </div>
  );
}