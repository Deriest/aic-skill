import { OfficeFloor } from '../components/office/OfficeFloor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';
import { useDashboardContext } from '../context/DashboardContext';

export function OverviewPage() {
  const { state } = useDashboardContext();

  const active = Object.values(state.workers).filter(w => w.status === 'working').length;
  const idle = Object.values(state.workers).filter(w => w.status === 'idle').length;

  return (
    <div className="flex flex-col h-full w-full p-6 min-h-0">
      <h2 className="font-pixel text-aic-accent text-px-md uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)] shrink-0 mb-4">OVERVIEW</h2>
      
      <div className="flex flex-1 gap-6 min-h-0 relative">
        {/* Main Content (Left) */}
        <div className="flex-[2] flex flex-col min-w-0 gap-4 h-full relative">
          
          {/* Decorative Cyberpunk Server/Plant SVG (Top Right above Office) */}
          <div className="absolute -top-10 right-4 opacity-40 pointer-events-none select-none">
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-aic-accent">
              <g fill="currentColor" shapeRendering="crispEdges">
                {/* Server Rack / Base */}
                <rect x="8" y="24" width="16" height="8" className="text-aic-bg-dark" fill="currentColor"/>
                <rect x="10" y="26" width="4" height="1" className="text-aic-accent" fill="currentColor"/>
                <rect x="10" y="28" width="12" height="1" className="text-aic-text-muted" fill="currentColor"/>
                <rect x="18" y="26" width="2" height="1" className="text-aic-green" fill="currentColor"/>
                <rect x="21" y="26" width="1" height="1" className="text-red-500" fill="currentColor"/>
                
                {/* Holographic Plant / Tree */}
                <rect x="15" y="18" width="2" height="6" className="text-aic-text-muted" fill="currentColor"/>
                <rect x="15" y="10" width="2" height="8" />
                <rect x="11" y="14" width="4" height="2" />
                <rect x="17" y="12" width="5" height="2" />
                <rect x="19" y="8" width="2" height="4" />
                <rect x="11" y="10" width="2" height="4" />
                <rect x="14" y="6" width="4" height="4" />
                {/* Floating Pixels */}
                <rect x="12" y="7" width="1" height="1" />
                <rect x="19" y="5" width="1" height="1" />
                <rect x="16" y="4" width="2" height="1" />
              </g>
            </svg>
          </div>

          {/* Virtual Office Box */}
          <div className="flex-1 bg-aic-bg-panel border-2 border-aic-border/50 rounded p-1 shadow-lg overflow-hidden flex flex-col min-h-0">
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
        <div className="flex-1 flex flex-col gap-4 h-full min-w-[400px]">
          <PipelineTracker state={state} />
        </div>
      </div>
    </div>
  );
}