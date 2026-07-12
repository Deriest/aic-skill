import { useState, useEffect } from 'react';
import { api } from '../api';

interface TaskEntry {
  taskId: string;
  title?: string;
  description?: string;
  classification?: string;
  phase?: string;
  status?: string;
  lastActivity?: string;
  createdAt?: string;
}

interface WorkPackage {
  wp_id: string;
  title: string;
  description: string;
  priority: string;
  depends_on: string[];
  status: 'pending' | 'active' | 'complete' | 'blocked';
}

// ponytail: computed inline, move to server if list grows large
function isInterrupted(t: TaskEntry): boolean {
  if (t.status === 'complete') return false;
  if (!t.lastActivity) return false;
  return (Date.now() - new Date(t.lastActivity).getTime()) > 3600_000;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-aic-text-muted',
  active: 'text-aic-accent',
  complete: 'text-aic-green',
  blocked: 'text-red-400',
  INTERRUPTED: '', // handled separately
};

function WPNode({ wp, allWps }: { wp: WorkPackage; allWps: WorkPackage[] }) {
  const blocked = wp.depends_on.some(dep => {
    const depWp = allWps.find(w => w.wp_id === dep);
    return depWp && depWp.status !== 'complete';
  });
  const effectiveStatus = blocked && wp.status !== 'complete' ? 'blocked' : wp.status;
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-4 mt-1">
      <div
        className="flex items-center gap-2 cursor-pointer hover:bg-aic-bg-panel/50 px-2 py-1 rounded"
        onClick={() => setOpen(!open)}
      >
        <span className="font-pixel text-px-sm text-aic-text-muted">{wp.wp_id}</span>
        <span className="font-body text-sm text-white">{wp.title}</span>
        <span className={`font-pixel text-px-sm ml-auto ${STATUS_COLORS[effectiveStatus] || 'text-aic-text-muted'}`}>
          [{effectiveStatus.toUpperCase()}]
        </span>
      </div>
      {open && (
        <div className="ml-6 text-xs text-aic-text-muted font-body">
          <p>{wp.description}</p>
          {wp.depends_on.length > 0 && (
            <p className="mt-1">Depends on: {wp.depends_on.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryPage() {
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, WorkPackage[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    api.getTasks().then(setTasks).catch(() => {});
  }, []);

  const toggleExpand = async (taskId: string) => {
    if (expanded[taskId] !== undefined) {
      const next = { ...expanded };
      delete next[taskId];
      setExpanded(next);
    } else {
      const wps = await api.getWorkPackages(taskId);
      setExpanded(prev => ({ ...prev, [taskId]: wps }));
    }
  };

  const resumeTask = async (taskId: string) => {
    await fetch('/api/task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentTask: { id: taskId } })
    });
    setTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, lastActivity: new Date().toISOString() } : t));
  };

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-pixel text-aic-text-muted text-px-base">NO TASK HISTORY</p>
      </div>
    );
  }

  const totalPages = Math.ceil(tasks.length / itemsPerPage) || 1;
  const currentTasks = tasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="font-pixel text-px-lg text-aic-accent">TASK HISTORY</h2>
        {totalPages > 1 && (
          <div className="flex gap-4 font-pixel text-px-sm items-center text-aic-text-bright">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 border border-aic-border rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-aic-bg-panel'}`}
            >
              PREV
            </button>
            <span>PAGE {currentPage} OF {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 border border-aic-border rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-aic-bg-panel'}`}
            >
              NEXT
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto pr-2 pb-8">
      {currentTasks.map(t => {
        const interrupted = isInterrupted(t);
        return (
          <div key={t.taskId} className="bg-aic-bg-panel border-2 border-aic-border rounded p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleExpand(t.taskId)}
                className="font-pixel text-aic-accent text-px-sm hover:text-white"
              >
                {expanded[t.taskId] !== undefined ? '▼' : '▶'}
              </button>
              <span className="font-pixel text-px-base text-white">{t.taskId}</span>
              <span className="font-body text-sm text-aic-text-muted">{t.title || 'Untitled'}</span>
              <span className="font-pixel text-px-sm text-aic-accent ml-2">{t.phase || '—'}</span>
              {interrupted ? (
                <span
                  className="font-pixel text-px-sm ml-auto px-2 py-0.5 rounded"
                  style={{ backgroundColor: '#ff0000', color: '#fff' }}
                >
                  INTERRUPTED
                </span>
              ) : (
                <span className={`font-pixel text-px-sm ml-auto ${t.status === 'done' || t.status === 'complete' ? 'text-aic-green' : 'text-aic-accent'}`}>
                  {(t.status || 'active').toUpperCase()}
                </span>
              )}
              {interrupted && (
                <button
                  onClick={() => resumeTask(t.taskId)}
                  className="font-pixel text-px-sm bg-aic-accent text-aic-bg-dark px-3 py-1 rounded hover:bg-white transition-colors"
                >
                  RESUME
                </button>
              )}
            </div>
            {/* Expanded Details & Work packages tree */}
            {expanded[t.taskId] !== undefined && (
              <div className="mt-3 border-t border-aic-border pt-3">
                
                {/* Context Details */}
                <div className="mb-4 bg-aic-bg-dark/40 p-3 rounded border border-aic-border/30">
                  <h4 className="font-pixel text-px-sm text-aic-accent mb-2">TASK CONTEXT</h4>
                  <div className="text-sm font-body text-aic-text-bright space-y-1">
                    <p><span className="text-aic-text-muted">Type:</span> {t.classification || 'general'}</p>
                    <p><span className="text-aic-text-muted">Created:</span> {t.createdAt ? new Date(t.createdAt).toLocaleString() : 'Unknown'}</p>
                    {t.description && (
                      <div className="mt-2 text-white bg-black/30 p-2 rounded whitespace-pre-wrap font-mono text-xs">
                        {t.description}
                      </div>
                    )}
                  </div>
                </div>

                <h4 className="font-pixel text-px-sm text-aic-accent mb-2">WORK PACKAGES</h4>
                <div className="pl-2">
                {expanded[t.taskId].length === 0 ? (
                  <p className="font-pixel text-px-sm text-aic-text-muted ml-4">No work packages</p>
                ) : (
                  expanded[t.taskId].map(wp => (
                    <WPNode key={wp.wp_id} wp={wp} allWps={expanded[t.taskId]} />
                  ))
                )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
