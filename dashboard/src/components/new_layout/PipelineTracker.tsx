import { DashboardState } from '../../types';
import { WorkspaceScene } from './WorkspaceScene';

export function PipelineTracker({ state }: { state: DashboardState }) {
  const phases = ['Investigate', 'Planning', 'Execution', 'Documentation', 'Verification'];
  
  return (
    <div className="flex flex-col gap-6 h-full font-pixel">
      {/* Current Task */}
      <div className="shrink-0 flex flex-col min-h-[220px]">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-aic-accent text-px-md font-pixel drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">▶</span>
          <h3 className="font-pixel text-px-md text-aic-accent uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">CURRENT TASK</h3>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-5 flex-1 shadow-lg relative overflow-hidden flex flex-col">
          {!state.currentTask ? (
            <span className="text-aic-text-muted font-pixel text-px-sm italic m-auto">NO ACTIVE TASK</span>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-start mb-2 shrink-0">
                <div className="text-aic-yellow font-pixel text-px-md">[{state.currentTask.id}]</div>
                <div className="text-aic-accent/70 font-pixel text-[10px] uppercase border border-aic-accent/30 px-2 py-1 rounded bg-aic-bg-dark">
                  {state.currentTask.type || 'FEATURE'}
                </div>
              </div>
              <div className="text-white text-xl md:text-2xl uppercase tracking-wider line-clamp-1 leading-tight mb-3 shrink-0">
                {state.currentTask.title}
              </div>
              {/* Task Description Detail */}
              <div className="text-aic-text-bright/90 font-pixel text-[11px] leading-relaxed overflow-y-auto bg-aic-bg-dark/40 p-3 rounded border border-aic-border/20 flex-1 min-h-[60px]">
                {/* Fallback to a placeholder description if state doesn't have one */}
                {(state.currentTask as any).description || `Dispatcher has initialized the task orchestration. Currently establishing connection with OpenCode engine and formulating the primary workspace configuration...`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline & Doodle */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-aic-accent text-px-md font-pixel drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">▶</span>
          <h3 className="font-pixel text-px-md text-aic-accent uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">PIPELINE</h3>
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-6 flex-1 shadow-lg flex flex-col relative overflow-hidden">
          {!state.currentTask ? (
            <div className="text-aic-text-muted font-pixel text-px-sm italic m-auto z-10">NO PIPELINE</div>
          ) : (
            <div className="flex flex-col gap-6 py-2 z-10">
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
                  <div key={p} className={`flex items-center gap-6 font-pixel text-px-base md:text-px-lg transition-all duration-300 ${textColor} ${isActive ? 'scale-105 ml-4' : ''}`}>
                    <span className="w-8 text-center">{icon}</span>
                    <span className="uppercase tracking-widest">{p}</span>
                  </div>
                );
              })}
            </div>
          )}

          
        </div>
      </div>

        {/* Workspace Scene - SVG only, perfectly scaled to fit the remaining space alongside IDLE box */}
        <div className="w-full h-[100px] mt-auto overflow-hidden shrink-0 flex items-center justify-center bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-1">
          <WorkspaceScene />
        </div>
    </div>
  );
}