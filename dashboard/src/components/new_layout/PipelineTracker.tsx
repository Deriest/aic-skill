import { DashboardState } from '../../types';

export function PipelineTracker({ state }: { state: DashboardState }) {
  const phases = ['Investigate', 'Planning', 'Execution', 'Documentation', 'Verification'];
  
  if (!state.currentTask) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 font-mono shadow-xl flex items-center justify-center">
        <span className="text-slate-500 italic">No active task in pipeline. Waiting for Dispatcher...</span>
      </div>
    );
  }

  const currentIndex = phases.indexOf(state.currentPhase || '');

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 font-mono shadow-xl flex flex-col justify-center">
      <div className="mb-4">
        <div className="text-xs text-blue-400 uppercase tracking-widest mb-1">Current Task</div>
        <div className="text-lg text-white font-bold truncate">
          <span className="text-yellow-500 mr-2">[{state.currentTask.id}]</span>
          {state.currentTask.title}
        </div>
        <div className="text-xs text-slate-400 mt-1">Type: {state.currentTask.type}</div>
      </div>

      <div className="flex items-center justify-between mt-2">
        {phases.map((p, idx) => {
          const isActive = p === state.currentPhase;
          const isPast = currentIndex > -1 && idx < currentIndex;
          
          let color = 'text-slate-600 border-slate-700 bg-slate-950';
          if (isActive) color = 'text-green-400 border-green-500 bg-green-900/30 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
          else if (isPast) color = 'text-blue-400 border-blue-500 bg-blue-900/20';

          return (
            <div key={p} className="flex flex-col items-center relative flex-1">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 ${color}`}>
                {idx + 1}
              </div>
              <div className={`mt-2 text-xs font-bold uppercase tracking-wider ${isActive ? 'text-green-400' : isPast ? 'text-blue-400' : 'text-slate-600'}`}>
                {p}
              </div>
              
              {/* Connector line */}
              {idx < phases.length - 1 && (
                <div className={`absolute top-4 left-1/2 w-full h-[2px] -z-0 ${isPast || isActive ? 'bg-blue-900' : 'bg-slate-800'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}