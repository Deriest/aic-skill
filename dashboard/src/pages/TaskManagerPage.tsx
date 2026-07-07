import { useDashboard } from '../context/DashboardContext';
import { PageShell } from '../components/shared/PageShell';
import { StatusBadge } from '../components/shared/StatusBadge';
import { EmptyState } from '../components/shared/EmptyState';
import * as tasksApi from '../api/tasks';
import { useState } from 'react';
import type { TaskQueueEntry } from '../types';

export function TaskManagerPage() {
  const { state } = useDashboard();
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('feature');

  const handleStart = async () => {
    if (!newTitle.trim()) return;
    await tasksApi.startTask(newTitle, newType, crypto.randomUUID());
    setNewTitle('');
  };

  const handleEnqueue = async () => {
    if (!newTitle.trim()) return;
    await tasksApi.enqueueTask(newTitle, newType, crypto.randomUUID());
    setNewTitle('');
  };

  const handleCancel = async () => {
    await tasksApi.cancelTask(state.currentTask?.id);
  };

  return (
    <PageShell title="TASK MANAGER">
      <div className="flex flex-col gap-4 h-full">
        {/* Current Task */}
        <div className="panel p-4">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-2 uppercase">Current Task</div>
          {state.currentTask ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-pixel text-px-sm text-white">{state.currentTask.title}</div>
                <div className="font-pixel text-px-xs text-aic-text-muted">{state.currentTask.type} — {state.currentTask.id}</div>
              </div>
              <button onClick={handleCancel} className="font-pixel text-px-xs px-3 py-1.5 bg-aic-red text-white hover:opacity-80 transition-opacity">
                CANCEL
              </button>
            </div>
          ) : (
            <div className="font-pixel text-px-sm text-aic-text-muted">No active task</div>
          )}
        </div>

        {/* New Task Form */}
        <div className="panel p-4">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-2 uppercase">New Task</div>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full bg-aic-bg-dark border-2 border-aic-border text-aic-text font-pixel text-px-sm p-2 focus:outline-none focus:border-aic-accent"
              />
            </div>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-aic-bg-dark border-2 border-aic-border text-aic-text font-pixel text-px-xs p-2 focus:outline-none focus:border-aic-accent"
            >
              <option value="feature">feature</option>
              <option value="bugfix">bugfix</option>
              <option value="refactor">refactor</option>
              <option value="research">research</option>
            </select>
            <button onClick={handleStart} className="font-pixel text-px-xs px-3 py-2 bg-aic-accent text-aic-bg-dark hover:opacity-80 transition-opacity">
              START
            </button>
            <button onClick={handleEnqueue} className="font-pixel text-px-xs px-3 py-2 border-2 border-aic-accent text-aic-accent hover:bg-aic-accent hover:text-aic-bg-dark transition-colors">
              ENQUEUE
            </button>
          </div>
        </div>

        {/* Queue */}
        <div className="panel p-4 flex-1 min-h-0 overflow-y-auto">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-2 uppercase">Queue ({state.taskQueue.length})</div>
          {state.taskQueue.length === 0 ? (
            <EmptyState message="Queue is empty" icon="☐" />
          ) : (
            <div className="space-y-1">
              {state.taskQueue.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-1.5 px-2 border-b border-aic-border">
                  <div>
                    <span className="font-pixel text-px-xs text-white">{task.title}</span>
                    <span className="font-pixel text-px-xs text-aic-text-muted ml-2">[{task.type}]</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-px-xs text-aic-text-dim">P{task.priority}</span>
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
