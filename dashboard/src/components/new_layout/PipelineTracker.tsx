import { DashboardState } from '../../types';

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

          {/* Doodle Art SVG (Bottom Right) */}
          <div className="absolute bottom-0 right-2 opacity-30 pointer-events-none select-none flex flex-col items-end z-0">
            <span className="font-pixel text-[8px] text-aic-accent mb-1 mr-2">HAPPY CODING!</span>
            <svg width="100" height="100" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-aic-accent">
              <g fill="currentColor" shapeRendering="crispEdges">
                {/* Desk */}
                <rect x="2" y="24" width="28" height="2" />
                <rect x="4" y="26" width="2" height="6" />
                <rect x="26" y="26" width="2" height="6" />
                
                {/* Monitor */}
                <rect x="4" y="12" width="12" height="10" />
                <rect x="5" y="13" width="10" height="8" className="text-aic-bg-dark" fill="currentColor" />
                <rect x="6" y="14" width="8" height="6" className="text-aic-accent" fill="currentColor" fillOpacity="0.3"/>
                {/* Stand */}
                <rect x="9" y="22" width="2" height="2" />
                
                {/* Keyboard */}
                <rect x="6" y="23" width="8" height="1" />
                
                {/* Character Head */}
                <rect x="18" y="10" width="8" height="8" />
                {/* Glowing Glasses */}
                <rect x="18" y="13" width="3" height="2" className="text-aic-bg-dark" fill="currentColor" />
                <rect x="23" y="13" width="3" height="2" className="text-aic-bg-dark" fill="currentColor" />
                <rect x="19" y="13" width="1" height="2" className="text-aic-accent" fill="currentColor" />
                <rect x="24" y="13" width="1" height="2" className="text-aic-accent" fill="currentColor" />
                
                {/* Character Body */}
                <rect x="17" y="18" width="10" height="6" />
                {/* Arm typing */}
                <rect x="15" y="20" width="5" height="2" />
                
                {/* Coffee Mug */}
                <rect x="27" y="21" width="3" height="3" />
                <rect x="30" y="21" width="1" height="2" />
              </g>
            </svg>
          </div>

          {/* Decorative Cyberpunk Server/Plant SVG (Bottom Left Corner) */}
          <div className="absolute -bottom-4 left-4 opacity-30 pointer-events-none select-none z-0">
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-aic-accent">
              <g fill="currentColor" shapeRendering="crispEdges">
                {/* Circuit Board / Chip Doodle */}
                {/* Main Chip Body */}
                <rect x="10" y="10" width="12" height="12" className="text-aic-bg-dark" fill="currentColor"/>
                <rect x="11" y="11" width="10" height="10" className="text-aic-accent" fill="currentColor" fillOpacity="0.8"/>
                <rect x="13" y="13" width="6" height="6" className="text-aic-bg-panel" fill="currentColor"/>
                
                {/* Top Pins */}
                <rect x="12" y="6" width="2" height="4" />
                <rect x="15" y="6" width="2" height="4" />
                <rect x="18" y="6" width="2" height="4" />
                
                {/* Bottom Pins */}
                <rect x="12" y="22" width="2" height="4" />
                <rect x="15" y="22" width="2" height="4" />
                <rect x="18" y="22" width="2" height="4" />
                
                {/* Left Pins */}
                <rect x="6" y="12" width="4" height="2" />
                <rect x="6" y="15" width="4" height="2" />
                <rect x="6" y="18" width="4" height="2" />
                
                {/* Right Pins */}
                <rect x="22" y="12" width="4" height="2" />
                <rect x="22" y="15" width="4" height="2" />
                <rect x="22" y="18" width="4" height="2" />
                
                {/* Connecting traces */}
                <rect x="2" y="15" width="4" height="1" className="text-aic-green" fill="currentColor" />
                <rect x="2" y="16" width="1" height="4" className="text-aic-green" fill="currentColor" />
                <rect x="3" y="19" width="3" height="1" className="text-aic-green" fill="currentColor" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}