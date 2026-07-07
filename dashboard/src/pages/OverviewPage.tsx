import { OfficeFloor } from '../components/office/OfficeFloor';
import { ConfigEditor } from '../components/new_layout/ConfigEditor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';
import { useDashboardContext } from '../context/DashboardContext';
import { CRTOverlay } from '../components/layout/CRTOverlay';

export function OverviewPage() {
  const { state } = useDashboardContext();

  const active = Object.values(state.workers).filter(w => w.status === 'working').length;
  const idle = Object.values(state.workers).filter(w => w.status === 'idle').length;

  return (
    <div className="flex flex-col min-h-screen bg-aic-bg-dark text-aic-text-bright font-body overflow-hidden">
      <CRTOverlay />
      
      {/* Top Header */}
      <header className="flex justify-between items-center bg-aic-bg-panel border-b-4 border-aic-border px-6 py-4 z-10 relative">
        <div className="flex items-center gap-3">
          <span className="text-aic-accent text-px-lg font-pixel">▶</span>
          <h1 className="text-3xl font-pixel text-aic-accent tracking-widest uppercase text-shadow-cyan">
            AI ENGINEERING COMPANY
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${state.connected ? 'bg-aic-green shadow-neon-green animate-pulse' : 'bg-red-500'}`}></div>
            <span className={`text-px-sm font-pixel tracking-widest uppercase ${state.connected ? 'text-aic-green' : 'text-red-500'}`}>
              {state.connected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden p-6 gap-6 z-10 relative">
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
          <ConfigEditor />
        </div>
      </div>
    </div>
  );
}