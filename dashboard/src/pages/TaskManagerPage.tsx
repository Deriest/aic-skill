import { useDashboard } from '../context/DashboardContext';
import { PageShell } from '../components/shared/PageShell';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmptyState } from '../components/shared/EmptyState';
import * as tasksApi from '../api/tasks';
import { Link } from 'react-router-dom';

export function TaskManagerPage() {
  const { state } = useDashboard();

  const handleCancel = async () => {
    await tasksApi.cancelTask(state.currentTask?.id);
  };

  return (
    <PageShell title="TASK MANAGER">
      <div className="flex flex-col gap-4 h-full">
        {/* Guidance */}
        <div className="panel p-4 border-aic-yellow bg-aic-surface">
          <div className="flex items-start gap-3">
            <span className="text-aic-yellow text-xl">(!)</span>
            <div>
              <div className="font-pixel text-px-sm text-aic-yellow mb-1">CREATE TASKS VIA CHAT</div>
              <div className="font-mono text-sm text-aic-text-muted">
                All tasks are created through the Orchestrator in the{' '}
                <Link to="/chat" className="text-aic-accent underline hover:text-aic-green">Chat page</Link>.
                Just describe what you want to build — the Orchestrator will plan, queue, and dispatch workers automatically.
              </div>
            </div>
          </div>
        </div>

        {/* Current Task */}
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-pixel text-px-sm text-aic-accent">CURRENT TASK</span>
            <span className="text-aic-yellow text-px-xs">(!)</span>
            <span className="font-mono text-xs text-aic-text-muted">— active task being worked on</span>
          </div>
          {state.currentTask ? (
            <div className="flex items-center justify-between bg-aic-bg-dark p-3 border border-aic-border rounded">
              <div>
                <div className="font-pixel text-px-base text-white">{state.currentTask.title}</div>
                <div className="font-pixel text-px-xs text-aic-text-muted mt-1">{state.currentTask.type} — {state.currentTask.id}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={state.currentTask ? 'working' : 'idle'} />
                <button onClick={handleCancel} className="font-pixel text-px-xs px-3 py-1.5 border-2 border-aic-red text-aic-red hover:bg-aic-red hover:text-white transition-colors">
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div className="font-pixel text-px-sm text-aic-text-muted bg-aic-bg-dark p-4 border border-aic-border rounded text-center">
              No active task — go to Chat to start one
            </div>
          )}
        </div>

        {/* Queue */}
        <div className="panel p-4 flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-pixel text-px-sm text-aic-accent">QUEUE</span>
            <span className="font-pixel text-px-xs px-2 py-0.5 bg-aic-surface border border-aic-border text-aic-text-muted rounded">
              {state.taskQueue.length}
            </span>
            <span className="text-aic-yellow text-px-xs">(!)</span>
            <span className="font-mono text-xs text-aic-text-muted">— pending tasks waiting for workers</span>
          </div>
          {state.taskQueue.length === 0 ? (
            <EmptyState message="Queue is empty — tasks appear when you create them via Chat" icon="☐" />
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[400px]">
              {state.taskQueue.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2 px-3 bg-aic-bg-dark border border-aic-border rounded">
                  <div>
                    <span className="font-pixel text-px-sm text-white">{task.title}</span>
                    <span className="font-pixel text-px-xs text-aic-text-muted ml-2">[{task.type}]</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-pixel text-px-xs text-aic-yellow">P:{task.priority}</span>
                    <StatusBadge status={task.status === 'queued' ? 'idle' : task.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
