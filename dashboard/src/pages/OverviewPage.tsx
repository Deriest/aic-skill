import { OfficeFloor } from '../components/office/OfficeFloor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';
import { useDashboardContext } from '../context/DashboardContext';
import { WORKERS } from '../data/workers';
import { useState, useEffect, useRef, useCallback } from 'react';

function ScrollContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState('');
  const update = useCallback(() => {
    const el = ref.current; if (!el) return;
    const top = el.scrollTop > 0;
    const bot = el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setShadow(top && bot ? 'has-both-shadow' : top ? 'has-top-shadow' : bot ? 'has-bottom-shadow' : '');
  }, []);
  useEffect(() => { update(); const el = ref.current; if (!el) return; el.addEventListener('scroll', update, { passive: true }); const ro = new ResizeObserver(update); ro.observe(el); return () => { el.removeEventListener('scroll', update); ro.disconnect(); }; }, [update]);
  return <div ref={ref} className={`scroll-shadow ${shadow} ${className}`}>{children}</div>;
}

function PerfPanel() {
  const { metrics } = useDashboardContext();
  const mem = metrics?.memory;
  const cpu = metrics?.cpu;
  const memMB = mem ? Math.round(mem.rss / 1048576) : '—';
  const heapMB = mem ? Math.round(mem.heapUsed / 1048576) : '—';
  const load1 = cpu?.loadAvg?.[0]?.toFixed(2) ?? '—';
  const load5 = cpu?.loadAvg?.[1]?.toFixed(2) ?? '—';
  const cores = cpu?.cores ?? '—';
  const reqs = metrics?.totalRequests ?? '—';
  const inp = metrics?.totalInput ? Math.round(metrics.totalInput / 1000) + 'k' : '—';
  const out = metrics?.totalOutput ? Math.round(metrics.totalOutput / 1000) + 'k' : '—';
  return (
    <div className="flex flex-col gap-0.5 text-[10px] font-pixel">
      <div className="flex justify-between"><span className="text-gray-400">RSS</span><span className="text-aic-yellow">{memMB} MB</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Heap</span><span className="text-aic-yellow">{heapMB} MB</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Load 1m</span><span className="text-aic-cyan">{load1}</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Load 5m</span><span className="text-aic-cyan">{load5}</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Cores</span><span className="text-white">{cores}</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Total Requests</span><span className="text-aic-green">{reqs}</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Total Input</span><span className="text-aic-green">{inp}</span></div>
      <div className="flex justify-between"><span className="text-gray-400">Total Output</span><span className="text-aic-green">{out}</span></div>
    </div>
  );
}

export function OverviewPage() {
  const { state } = useDashboardContext();

  // Progress Bar logic (excludes Global/Dispatcher)
  const required = WORKERS.filter(w => w.phase !== 'Global');
  const completeRequired = required.filter(w => { const ws = state.workers?.[w.id]; return ws?.status === 'complete' && (!ws?.subWorkers || ws.subWorkers.every(s => s.status === 'complete')) && state.pmReview?.phase !== w.phase; }).length;
  const pct = required.length > 0 ? Math.round(completeRequired / required.length * 100) : 0;

  // Worker Statistics logic (includes all 15 Head Workers)
  const working = WORKERS.filter(w => { if (w.id === 'dispatcher' && state.connected) return true; const ws = state.workers?.[w.id]; return ws?.status === 'working' || ws?.subWorkers?.some(s => s.status === 'working'); }).length;
  const complete = WORKERS.filter(w => { const ws = state.workers?.[w.id]; return ws?.status === 'complete' && (!ws?.subWorkers || ws.subWorkers.every(s => s.status === 'complete')) && state.pmReview?.phase !== w.phase; }).length;
  const idle = WORKERS.filter(w => { if (w.id === 'dispatcher' && state.connected) return false; const ws = state.workers?.[w.id]; return !ws || ws.status === 'idle'; }).length;
  const total = WORKERS.length;

  return (
    <div className="flex flex-col flex-1 p-3 min-h-0 overflow-hidden">
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: Virtual Office — 1.5 ratio */}
        <div className="flex-[1.5] flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 bg-aic-bg-panel border-2 border-aic-border/50 rounded shadow-lg overflow-hidden flex flex-col">
            <OfficeFloor />
          </div>
        </div>

        {/* Right: Pipeline + Gate + Stats + Performance — 1 ratio */}
        <div className="flex-1 flex flex-col min-w-[340px] min-h-0 overflow-hidden">
          <ScrollContainer className="flex-1 min-h-0 flex flex-col gap-2 pr-1">
            {/* Top: Pipeline & Runtime Gate */}
            <div className="shrink-0">
              <PipelineTracker state={state} taskProgress={pct} />
            </div>

            {/* Performance Panel */}
            <div className="shrink-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-aic-accent text-[10px]">▶</span>
                <h3 className="text-[10px] text-aic-accent uppercase tracking-widest">PERFORMANCE</h3>
              </div>
              <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-3 font-pixel">
                <PerfPanel />
              </div>
            </div>

            {/* Worker Summary cards */}
            <div className="shrink-0 mt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-aic-accent text-[10px]">&#9654;</span>
                <h3 className="text-[10px] text-aic-accent uppercase tracking-widest">STATUS</h3>
              </div>
              <div className="grid grid-cols-4 gap-2 font-pixel">
              <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg flex flex-col items-center justify-center h-[140px]">
                <span className="text-2xl text-aic-yellow">{working}</span>
                <span className="text-[9px] text-aic-text-muted uppercase tracking-widest">Working</span>
                {working > 0 && <div className="w-8 h-0.5 bg-aic-yellow/30 rounded-full mt-1"><div className="h-full bg-aic-yellow rounded-full" style={{width:`${Math.round(working/total*100)}%`}} /></div>}
              </div>
              <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg flex flex-col items-center justify-center h-[140px]">
                <span className="text-2xl text-aic-green">{complete}</span>
                <span className="text-[9px] text-aic-text-muted uppercase tracking-widest">Complete</span>
                {complete > 0 && <div className="w-8 h-0.5 bg-aic-green/30 rounded-full mt-1"><div className="h-full bg-aic-green rounded-full" style={{width:`${Math.round(complete/total*100)}%`}} /></div>}
              </div>
              <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg flex flex-col items-center justify-center h-[140px]">
                <span className="text-2xl text-gray-400">{idle}</span>
                <span className="text-[9px] text-aic-text-muted uppercase tracking-widest">Idle</span>
              </div>
              <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg flex flex-col items-center justify-center h-[140px]">
                <span className="text-2xl text-white">{total}</span>
                <span className="text-[9px] text-aic-text-muted uppercase tracking-widest">Total</span>
              </div>
            </div>
            </div>
          </ScrollContainer>
        </div>
      </div>
    </div>
  );
}
