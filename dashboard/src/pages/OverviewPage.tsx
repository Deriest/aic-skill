import { OfficeFloor } from '../components/office/OfficeFloor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';
import { useDashboardContext } from '../context/DashboardContext';
import { WORKERS } from '../data/workers';

export function OverviewPage() {
  const { state } = useDashboardContext();
  
  // Progress Bar logic (excludes Global/Dispatcher)
  const required = WORKERS.filter(w => w.phase !== 'Global');
  const completeRequired = required.filter(w => { const ws = state.workers?.[w.id]; return ws?.status === 'complete' && (!ws?.subWorkers || ws.subWorkers.every(s => s.status === 'complete')) && state.pmReview?.phase !== w.phase; }).length;
  const pct = required.length > 0 ? Math.round(completeRequired / required.length * 100) : 0;

  // Worker Statistics logic (includes all 15 Head Workers)
  const working = WORKERS.filter(w => { const ws = state.workers?.[w.id]; return ws?.status === 'working' || ws?.subWorkers?.some(s => s.status === 'working'); }).length;
  const complete = WORKERS.filter(w => { const ws = state.workers?.[w.id]; return ws?.status === 'complete' && (!ws?.subWorkers || ws.subWorkers.every(s => s.status === 'complete')) && state.pmReview?.phase !== w.phase; }).length;
  const idle = WORKERS.filter(w => { const ws = state.workers?.[w.id]; return !ws || ws.status === 'idle'; }).length;

  return (
    <div className="flex flex-col h-screen w-full p-3 min-h-0 overflow-hidden bg-aic-bg-dark">
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: Virtual Office */}
        <div className="flex-[2] flex flex-col min-w-0 h-full">
          <div className="h-[94.5%] bg-aic-bg-panel border-2 border-aic-border/50 rounded shadow-lg overflow-hidden flex flex-col min-h-0">
            <OfficeFloor />
          </div>
        </div>

        {/* Right: Pipeline + Gate + Stats + Image */}
        <div className="flex-[1.2] flex flex-col h-full min-w-[360px] overflow-hidden gap-2">
          {/* Top: Pipeline & Runtime Gate */}
          <div className="flex-none">
            <PipelineTracker state={state} taskProgress={pct} />
          </div>
          
          {/* Middle: Stats cards */}
          <div className="grid grid-cols-3 gap-2 shrink-0 font-pixel h-[150px]">
            <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center">
              <span className="text-4xl text-aic-yellow mb-2">{working}</span>
              <span className="text-[11px] text-aic-text-muted uppercase tracking-widest">WORKING</span>
            </div>
            <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center">
              <span className="text-4xl text-aic-green mb-2">{complete}</span>
              <span className="text-[11px] text-aic-text-muted uppercase tracking-widest">COMPLETE</span>
            </div>
            <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded flex flex-col items-center justify-center">
              <span className="text-4xl text-gray-500 mb-2">{idle}</span>
              <span className="text-[11px] text-aic-text-muted uppercase tracking-widest">IDLE</span>
            </div>
          </div>

          {/* Bottom: AIC Image (Wide & Compact) */}
          <div className="h-[180px] shrink-0 rounded-lg overflow-hidden border-2 border-aic-border/50 shadow-lg bg-aic-bg-panel mt-auto mb-[50px]">
            <img 
              src="/AIC.png" 
              alt="AIC Workspace" 
              className="w-full h-full object-cover object-top"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
