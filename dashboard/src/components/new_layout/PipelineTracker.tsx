import { DashboardState } from '../../types';
import { useState, useEffect } from 'react';

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState('00:00:00');
  useEffect(() => {
    const update = () => { const d = Date.now() - startedAt; setElapsed(`${Math.floor(d/3600000).toString().padStart(2,'0')}:${Math.floor((d%3600000)/60000).toString().padStart(2,'0')}:${Math.floor((d%60000)/1000).toString().padStart(2,'0')}`); };
    update(); const i = setInterval(update, 1000); return () => clearInterval(i);
  }, [startedAt]);
  return <span className="text-aic-yellow font-pixel text-[10px] tabular-nums">{elapsed}</span>;
}

export function PipelineTracker({ state, taskProgress }: { state: DashboardState; taskProgress?: number }) {
  const phases = ['Investigate', 'Planning', 'Implementation', 'Verification', 'Closeout'];
  const barrierTotal = state.phaseBarrier?.workers?.length || 0;
  const barrierDone = state.phaseBarrier ? Object.keys(state.phaseBarrier.completed || {}).length : 0;
  const pmV = state.pmReview?.verdicts || {};
  const pmPass = Object.values(pmV).filter(v => v === 'PASS').length;
  const pmRework = Object.values(pmV).filter(v => v === 'REWORK').length;
  const pmTotal = Object.keys(pmV).length;
  const reworkActive = state.rework?.active || false;

  const dispatcherStatus = state.workers?.dispatcher?.status;
  const hasActiveWorkers = Object.values(state.workers||{}).some(w => w.status === 'working' || w.subWorkers?.some(s => s.status === 'working'));

  const gate = (() => {
    if (!state.currentTask) return { label: 'ONLINE', color: 'text-aic-green' };
    if (reworkActive) return { label: 'RECOVERING', color: 'text-red-400' };
    if (state.pmReview && pmTotal > 0 && pmRework > 0) return { label: 'RECOVERING', color: 'text-red-400' };
    if (state.pmReview && pmTotal > 0) return { label: 'WAITING APPROVAL', color: 'text-aic-yellow' };
    if (state.runtimeGate) { const s = state.runtimeGate.status; return { label: s==='blocked'||s==='rework' ? 'RECOVERING' : 'WAITING APPROVAL', color: s==='passed'||s==='complete' ? 'text-aic-green' : s==='blocked'||s==='rework' ? 'text-red-400' : 'text-aic-yellow' }; }
    if (state.phaseBarrier?.active && barrierDone < barrierTotal) return { label: 'MONITORING', color: 'text-aic-yellow' };
    if (hasActiveWorkers) return { label: 'DISPATCHING', color: 'text-aic-cyan' };
    if (state.currentPhase) return { label: 'MONITORING', color: 'text-aic-yellow' };
    return { label: 'ONLINE', color: 'text-aic-green' };
  })();

  const next = (() => {
    if (reworkActive) return `Respawn: ${state.rework?.failedWorkers?.join(', ')}`;
    if (state.pmReview && pmTotal > 0) return pmRework > 0 ? `PM: ${pmRework} REWORK` : pmPass === pmTotal ? 'Dispatcher Gate' : 'Waiting PM';
    if (state.phaseBarrier?.active) return barrierDone === barrierTotal ? 'Invoke PM Review' : `Waiting ${barrierTotal - barrierDone} workers`;
    if (state.runtimeGate) return state.runtimeGate.status;
    if (state.currentPhase) return 'Worker executing';
    return 'Pending';
  })();

  return (
    <div className="flex flex-col gap-2 h-full font-pixel">
      {/* Current Task */}
      <div className="shrink-0 flex flex-col h-[250px]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-aic-accent text-[11px]">▶</span>
            <h3 className="text-[11px] text-aic-accent uppercase tracking-widest">CURRENT TASK</h3>
          </div>
          {taskProgress !== undefined && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-aic-bg-dark rounded-full overflow-hidden"><div className="h-full bg-aic-accent rounded-full transition-all" style={{ width: `${taskProgress}%` }} /></div>
              <span className="text-aic-text-muted text-[9px]">{taskProgress}%</span>
            </div>
          )}
        </div>
        <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-3 flex-1 shadow-lg overflow-hidden flex flex-col min-h-0">
          {!state.currentTask ? <span className="text-aic-text-muted text-[10px] italic m-auto tracking-widest">[ WAITING FOR TASK ]</span> : (
            <div className="flex flex-col h-full min-h-0">
              <div className="text-aic-yellow text-[11px] mb-0.5">[{state.currentTask.id}]</div>
              <div className="text-white text-base uppercase tracking-wide line-clamp-1 mb-1">{state.currentTask.title}</div>
              <div className="text-aic-text-bright/80 text-[10px] leading-relaxed overflow-y-auto bg-aic-bg-dark/40 p-1.5 rounded border border-aic-border/20 flex-1 min-h-0">
                {(state.currentTask as any).description || 'Dispatcher initialized task orchestration.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline + Runtime Gate — titles above cards, side by side */}
      <div className="shrink-0 grid grid-cols-2 gap-2 h-[215px]">
          {/* Pipeline */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-1.5 mb-1 shrink-0">
              <span className="text-aic-accent text-[10px]">▶</span>
              <h3 className="text-[10px] text-aic-accent uppercase tracking-widest">PIPELINE</h3>
            </div>
            <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-2 shadow-lg flex flex-col justify-between h-[180px]">
              {phases.map((p, idx) => {
                const ci = state.currentPhase ? phases.indexOf(state.currentPhase) : -1;
                const isComplete = state.currentPhase === 'Closeout' && state.workers?.governor?.status === 'complete';
                const isPast = isComplete || (state.currentTask && ci > -1 && idx < ci);
                const isActive = !isComplete && state.currentTask ? p === state.currentPhase : false;
                return (
                  <div key={p} className={`flex items-center gap-1.5 px-1 py-1 rounded transition-all ${isActive ? 'text-aic-accent font-bold bg-aic-accent/5' : isPast ? 'text-aic-green' : 'text-gray-500'}`}>
                    <span className="w-6 text-center text-base">{isActive ? '●' : isPast ? '✓' : '○'}</span>
                    <span className="text-base uppercase tracking-wide">{p}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Runtime Gate */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-aic-accent text-[10px]">▶</span>
                <h3 className="text-[10px] text-aic-accent uppercase tracking-widest">RUNTIME GATE</h3>
              </div>
              {state.currentTask ? <ElapsedTimer startedAt={(state.currentTask as any).startedAt || state.startedAt} /> : <span className="text-gray-500 font-pixel text-[10px] tabular-nums">00:00:00</span>}
            </div>
            <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-2 shadow-lg flex flex-col h-[180px]">
              {state.currentTask ? (
                <div className="flex flex-col gap-1 text-[10px] flex-1">
                  <div className="flex justify-between bg-aic-bg-dark/40 p-1 rounded"><span className="text-gray-400">Gate</span><span className={`${gate.color} uppercase font-bold`}>{gate.label}</span></div>
                  <div className="flex justify-between px-1"><span className="text-gray-400">Phase</span><span className="text-aic-accent">{state.currentPhase || '—'}</span></div>
                  <div className="flex justify-between px-1"><span className="text-gray-400">Owner</span><span className="text-white">{state.runtimeGate?.owner || '—'}</span></div>
                  <div className="flex justify-between px-1"><span className="text-gray-400">Waiting</span><span className="text-white">{state.runtimeGate?.target || '—'}</span></div>
                  <div className="flex justify-between px-1"><span className="text-gray-400">Barrier</span><span className={state.phaseBarrier?.active ? (barrierDone===barrierTotal?'text-aic-green':'text-aic-yellow') : 'text-gray-500'}>{state.phaseBarrier?.active ? `${barrierDone}/${barrierTotal}` : '—'}</span></div>
                  <div className="flex justify-between px-1"><span className="text-gray-400">PM</span><span className={state.pmReview && pmTotal > 0 ? (pmRework>0?'text-red-400':'text-aic-green') : 'text-gray-500'}>{state.pmReview && pmTotal > 0 ? `${pmPass}P${pmRework>0?` ${pmRework}R`:''}` : '—'}</span></div>
                  {reworkActive && <div className="flex justify-between px-1"><span className="text-gray-400">Rework</span><span className="text-red-400">{state.rework?.failedWorkers?.join(', ')} (#{state.rework?.attempt})</span></div>}
                  <div className="flex justify-between px-1 pt-0.5 border-t border-aic-border/20 mt-auto"><span className="text-gray-400">Next</span><span className="text-aic-text-bright text-[9px]">{next}</span></div>
                </div>
              ) : <span className="text-aic-text-muted text-[9px] italic m-auto tracking-widest">[ NO ACTIVE TASK ]</span>}
            </div>
          </div>
      </div>
    </div>
  );
}
