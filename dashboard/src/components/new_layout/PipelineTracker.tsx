import { DashboardState } from '../../types';

export function PipelineTracker({ state }: { state: DashboardState }) {
  const phases = ['Investigate', 'Planning', 'Execution', 'Documentation', 'Verification'];
  
  return (
    <div className="flex flex-col gap-6 h-full font-pixel">
      {/* Current Task */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-aic-accent text-px-md font-pixel drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">▶</span>
          <h3 className="font-pixel text-px-md text-aic-accent uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">CURRENT TASK</h3>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-6 min-h-[100px] flex flex-col justify-center shadow-lg">
          {!state.currentTask ? (
            <span className="text-aic-text-muted font-pixel text-px-sm italic text-center">NO ACTIVE TASK</span>
          ) : (
            <div>
              <div className="text-aic-yellow font-pixel text-px-md mb-3">[{state.currentTask.id}]</div>
              <div className="text-white text-xl uppercase tracking-wider">{state.currentTask.title}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-aic-accent text-px-md font-pixel drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">▶</span>
          <h3 className="font-pixel text-px-md text-aic-accent uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">PIPELINE</h3>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-6 flex-1 shadow-lg flex flex-col justify-center">
          {!state.currentTask ? (
            <div className="text-aic-text-muted font-pixel text-px-sm italic text-center">NO PIPELINE</div>
          ) : (
            <div className="flex flex-col justify-between h-full py-4">
              {phases.map((p, idx) => {
                const isActive = p === state.currentPhase;
                const currentIndex = phases.indexOf(state.currentPhase || '');
                const isPast = currentIndex > -1 && idx < currentIndex;
                
                let textColor = 'text-aic-text-muted/50';
                let icon = '○';
                if (isActive) {
                  textColor = 'text-aic-accent font-bold drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]';
                  icon = '●';
                } else if (isPast) {
                  textColor = 'text-aic-green drop-shadow-[0_0_5px_rgba(0,255,0,0.5)]';
                  icon = '✓';
                }

                return (
                  <div key={p} className={`flex items-center gap-6 font-pixel text-px-sm md:text-px-base transition-all duration-300 ${textColor} ${isActive ? 'scale-105 ml-2' : ''}`}>
                    <span className="w-6 text-center">{icon}</span>
                    <span className="uppercase tracking-widest">{p}</span>
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