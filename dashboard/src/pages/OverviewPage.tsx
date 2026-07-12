import { OfficeFloor } from '../components/office/OfficeFloor';
import { PipelineTracker } from '../components/new_layout/PipelineTracker';
import { useDashboardContext } from '../context/DashboardContext';
import { WORKERS } from '../data/workers';
import { useState, useEffect } from 'react';

function PerfPanel() {
  const [perf, setPerf] = useState<any>(null);
  useEffect(() => {
    const load = () => fetch('/api/metrics/summary').then(r => r.json()).then(setPerf).catch(() => {});
    load(); const i = setInterval(load, 5000); return () => clearInterval(i);
  }, []);
  const mem = perf?.memory;
  const cpu = perf?.cpu;
  const memMB = mem ? Math.round(mem.rss / 1048576) : '—';
  const heapMB = mem ? Math.round(mem.heapUsed / 1048576) : '—';
  const load1 = cpu?.loadAvg?.[0]?.toFixed(2) ?? '—';
  const load5 = cpu?.loadAvg?.[1]?.toFixed(2) ?? '—';
  const cores = cpu?.cores ?? '—';
  const reqs = perf?.totalRequests ?? '—';
  const inp = perf?.totalInput ? Math.round(perf.totalInput / 1000) + 'k' : '—';
  const out = perf?.totalOutput ? Math.round(perf.totalOutput / 1000) + 'k' : '—';
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

function TaskRuntime() {
  const { state } = useDashboardContext();
  const [elapsed, setElapsed] = useState('00:00:00');
  useEffect(() => {
    if (!state.currentTask) { setElapsed('00:00:00'); return; }
    const started = (state.currentTask as any).startedAt || Date.now();
    const update = () => { const d = Date.now() - started; setElapsed(`${String(Math.floor(d/3600000)).padStart(2,'0')}:${String(Math.floor((d%3600000)/60000)).padStart(2,'0')}:${String(Math.floor((d%60000)/1000)).padStart(2,'0')}`); };
    update(); const i = setInterval(update, 1000); return () => clearInterval(i);
  }, [state.currentTask]);
  return (
    <div className="flex justify-between text-[10px] font-pixel"><span className="text-gray-400">Task Runtime</span><span className="text-aic-yellow tabular-nums">{elapsed}</span></div>
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
    <div className="flex flex-col h-screen w-full p-3 min-h-0 overflow-hidden bg-aic-bg-dark">
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: Virtual Office — 1.5 ratio */}
        <div className="flex-[1.5] flex flex-col min-w-0 h-full">
          <div className="h-[94%] bg-aic-bg-panel border-2 border-aic-border/50 rounded shadow-lg overflow-hidden flex flex-col min-h-0">
            <OfficeFloor />
          </div>
        </div>

        {/* Right: Pipeline + Gate + Stats + Performance — 1 ratio */}
        <div className="flex-1 flex flex-col h-full min-w-[340px] overflow-hidden">
          {/* Top: Pipeline & Runtime Gate */}
          <div className="flex-none">
            <PipelineTracker state={state} taskProgress={pct} />
          </div>

          {/* Performance Panel */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-aic-accent text-[10px]">▶</span>
              <h3 className="text-[10px] text-aic-accent uppercase tracking-widest">PERFORMANCE</h3>
            </div>
            <div className="shrink-0 bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-3 font-pixel">
              <PerfPanel />
            </div>
          </div>

          {/* Worker Summary cards */}
          <div className="mt-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-aic-accent text-[10px]">&#9654;</span>
              <h3 className="text-[10px] text-aic-accent uppercase tracking-widest">STATUS</h3>
            </div>
            <div className="grid grid-cols-4 gap-2 shrink-0 font-pixel">
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
        </div>
      </div>
    </div>
  );
}
