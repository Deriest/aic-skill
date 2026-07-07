import { DashboardState } from '../../types';

export function PipelineTracker({ state }: { state: DashboardState }) {
  const phases = ['Investigate', 'Planning', 'Execution', 'Documentation', 'Verification'];
  
  return (
    <div className="flex flex-col gap-6">
      {/* Current Task */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-aic-accent text-px-sm">▶</span>
          <h3 className="font-pixel text-px-sm text-aic-accent uppercase">CURRENT TASK</h3>
        </div>
        <div className="bg-aic-bg-panel border border-aic-border/50 rounded p-4 min-h-[80px] flex flex-col justify-center">
          {!state.currentTask ? (
            <span className="text-aic-text-muted font-pixel text-px-xs italic">NO ACTIVE TASK</span>
          ) : (
            <div>
              <div className="text-aic-yellow font-pixel text-px-sm mb-2">[{state.currentTask.id}]</div>
              <div className="text-aic-text-bright text-sm">{state.currentTask.title}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-aic-accent text-px-sm">▶</span>
          <h3 className="font-pixel text-px-sm text-aic-accent uppercase">PIPELINE</h3>
        </div>
        <div className="bg-aic-bg-panel border border-aic-border/50 rounded p-4">
          {!state.currentTask ? (
            <span className="text-aic-text-muted font-pixel text-px-xs italic">NO PIPELINE</span>
          ) : (
            <div className="flex flex-col gap-3">
              {phases.map((p, idx) => {
                const isActive = p === state.currentPhase;
                const currentIndex = phases.indexOf(state.currentPhase || '');
                const isPast = currentIndex > -1 && idx < currentIndex;
                
                let textColor = 'text-aic-text-muted';
                let icon = '○';
                if (isActive) {
                  textColor = 'text-aic-accent font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]';
                  icon = '●';
                } else if (isPast) {
                  textColor = 'text-aic-green';
                  icon = '✓';
                }

                return (
                  <div key={p} className={`flex items-center gap-3 font-pixel text-px-xs ${textColor}`}>
                    <span className="w-4 text-center">{icon}</span>
                    <span className="uppercase">{p}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}