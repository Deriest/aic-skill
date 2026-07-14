/** Task elapsed display — never use server/engine uptime. */

export function formatElapsedMs(ms: number): string {
  const d = Math.max(0, Math.floor(ms));
  const h = Math.floor(d / 3600000);
  const m = Math.floor((d % 3600000) / 60000);
  const s = Math.floor((d % 60000) / 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function isTaskTerminal(task: {
  pipelineState?: string;
  phaseStatus?: string;
} | null): boolean {
  if (!task) return false;
  const ps = (task.pipelineState || '').toUpperCase();
  const ph = (task.phaseStatus || '').toLowerCase();
  if (ps === 'COMPLETE' || ps === 'BLOCKED') return true;
  if (ph === 'failed' || ph === 'cancelled') return true;
  if (ps === 'CANCELLED') return true;
  return false;
}

export type TaskTimingMeta = {
  startedAtMs: number;
  finishedAtMs: number | null;
};

export function resolveTaskTiming(
  task: { pipelineState?: string; phaseStatus?: string } | null,
  meta: TaskTimingMeta | null,
  pipelineRunning: boolean | undefined
): { displayMs: number; ticking: boolean } {
  if (!task) return { displayMs: 0, ticking: false };
  if (!meta?.startedAtMs) return { displayMs: 0, ticking: false };

  const terminal = isTaskTerminal(task);
  const endMs = terminal
    ? meta.finishedAtMs ?? Date.now()
    : Date.now();
  const displayMs = endMs - meta.startedAtMs;
  const ticking = !terminal && pipelineRunning !== false;
  return { displayMs, ticking };
}

export async function fetchTaskTiming(taskId: string): Promise<TaskTimingMeta | null> {
  try {
    const res = await fetch(`/api/tasks/${taskId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const ctx = data.context || {};
    const st = data.state || {};
    const created = ctx.createdAt || ctx.startedAt;
    if (!created) return null;
    const startedAtMs = typeof created === 'number' ? created : Date.parse(created);
    if (Number.isNaN(startedAtMs)) return null;
    let finishedAtMs: number | null = null;
    const last = st.lastActivity || st.finishedAt || ctx.finishedAt;
    if (last) {
      const t = typeof last === 'number' ? last : Date.parse(last);
      if (!Number.isNaN(t)) finishedAtMs = t;
    }
    return { startedAtMs, finishedAtMs };
  } catch {
    return null;
  }
}