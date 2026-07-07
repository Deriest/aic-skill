import { useDashboardState } from '../hooks/useDashboardState';
import { OfficeFloor } from '../components/office/OfficeFloor';
import { ConfigEditor } from '../components/new_layout/ConfigEditor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';

export function OverviewPage() {
  const { state, error } = useDashboardState();

  if (error) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-red-500 p-6 items-center justify-center font-mono">
        <div className="border border-red-900 bg-red-950/50 p-6 rounded-lg text-center shadow-xl">
          <h1 className="text-xl font-bold mb-2">CONNECTION LOST</h1>
          <p>{error}</p>
          <p className="text-xs text-slate-400 mt-4">Waiting for AIC API on port 6868...</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-slate-500 p-6 items-center justify-center font-mono text-xl animate-pulse">
        CONNECTING TO CONTROL PLANE...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 p-6 gap-6 font-mono overflow-hidden">
      {/* Top Header */}
      <header className="flex justify-between items-end border-b border-slate-800 pb-2 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-green-500 uppercase tracking-widest">AIC Control Plane</h1>
          <p className="text-xs text-slate-500 uppercase mt-1">Live Virtual Office & Orchestration</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"></div>
          <span className="text-xs text-green-500 font-bold uppercase tracking-widest">CONNECTED</span>
        </div>
      </header>

      <div className="flex flex-col gap-6 flex-1 min-h-0">
        {/* Top Half: Virtual Office (Left) + Pipeline (Right) */}
        <div className="flex gap-6 h-[50vh] min-h-[400px]">
          <div className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xl relative">
             <OfficeFloor state={state} />
          </div>
          <div className="w-[450px] shrink-0 flex flex-col justify-start">
             <PipelineTracker state={state} />
          </div>
        </div>

        {/* Bottom Half: Config Editor */}
        <div className="flex-1 min-h-[300px]">
          <ConfigEditor />
        </div>
      </div>
    </div>
  );
}