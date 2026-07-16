'use strict';

const fs = require('fs');
const path = require('path');
const {
  syncDashboardFromCheckpoint,
  pipelineBusyError,
  isCheckpointTerminal,
  taskActiveOwnershipError,
  validateTaskDescription,
  resetWorkersIdle,
  readTaskContext,
} = require('./helpers');
const { normalizePhase, nextPhase } = require('./fsm');
const { readCheckpoint, writeCheckpoint, allocateTaskId } = require('./persistence');

/**
 * Factory: attaches { handleIntent } to ctx.
 * @param {object} ctx - mutable shared engine context
 */
function createIntent(ctx) {
  const {
    tasksDir, workerIds,
    getState, saveState, bus,
  } = ctx;
  const { ensureTaskDir } = require('./persistence');

  function writeJsonSafe(filePath, data) {
    const { writeJsonSafe: atomicWrite } = require('../atomic-write');
    atomicWrite(filePath, data);
  }

  async function handleIntent(intent, body) {
    const state = getState();
    if (!state.engine) state.engine = { paused: false, leases: {} };

    switch (intent) {
      case 'task.create': {
        const taskId = body.id || allocateTaskId(tasksDir);
        if (!body.title) return { ok: false, error: 'title required' };
        const descCheck = validateTaskDescription(body.description);
        if (!descCheck.ok) return descCheck;
        ensureTaskDir(tasksDir, taskId);
        writeJsonSafe(
          path.join(tasksDir, taskId, 'context.json'),
          {
            taskId,
            title: body.title,
            description: body.description || '',
            projectDir: body.projectDir || '',
            createdAt: new Date().toISOString(),
          }
        );
        const cp = {
          id: taskId,
          pipelineState: 'CREATED',
          phaseStatus: 'idle',
          projectDir: body.projectDir || '',
          phaseBarrier: null,
        };
        writeCheckpoint(tasksDir, taskId, cp);
        bus.emit('task.created', { taskId });
        return { ok: true, taskId };
      }
      case 'task.start': {
        if (ctx.pipelineRunning) return pipelineBusyError(ctx.activePipelineTaskId);
        const taskId = body.taskId || state.currentTask?.id;
        if (!taskId || !taskId.startsWith('TASK-')) {
          return { ok: false, error: 'TASK-* taskId required' };
        }
        const ownerId = state.currentTask?.id;
        if (ownerId && ownerId !== taskId) {
          const ownerCp = readCheckpoint(tasksDir, ownerId);
          const ownerPs = ownerCp?.pipelineState;
          if (ownerPs && !isCheckpointTerminal(ownerPs)) {
            return taskActiveOwnershipError(state, ownerId, ownerCp);
          }
        }
        const cp = readCheckpoint(tasksDir, taskId);
        const projectDir =
          body.projectDir || cp?.projectDir || ctx.getActiveProject().workspace;
        if (!projectDir) return { ok: false, error: 'projectDir required' };
        const taskCtx = readTaskContext(tasksDir, taskId);
        const descCheck = validateTaskDescription(taskCtx?.description);
        if (!descCheck.ok) return descCheck;

        state.currentTask = {
          id: taskId,
          title: body.title || readTaskContext(tasksDir, taskId)?.title || 'Task',
          type: body.type || 'feature',
          pipelineState: 'INVESTIGATE',
          phaseStatus: 'spawning',
        };
        resetWorkersIdle(state, workerIds);
        cp.pipelineState = 'INVESTIGATE';
        cp.phaseStatus = 'spawning';
        cp.projectDir = projectDir;
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        bus.emit('task.started', { taskId });

        ctx.pipelineRunning = true;
        ctx.activePipelineTaskId = taskId;
        setImmediate(() => {
          ctx.runPipeline(taskId, projectDir)
            .catch((e) => {
              console.error('[engine] pipeline error', e);
            })
            .finally(() => {
              ctx.pipelineRunning = false;
              ctx.activePipelineTaskId = null;
            });
        });
        return { ok: true, taskId, started: true };
      }
      case 'task.pause': {
        state.engine.paused = true;
        saveState();
        bus.emit('task.paused', { taskId: body.taskId });
        return { ok: true };
      }
      case 'task.resume': {
        if (ctx.pipelineRunning) return pipelineBusyError(ctx.activePipelineTaskId);
        state.engine.paused = false;
        const taskId = body.taskId || state.currentTask?.id;
        const cp = readCheckpoint(tasksDir, taskId);
        const projectDir = cp?.projectDir || body.projectDir;
        // Resume from last checkpoint phase (not from beginning)
        const resumeFrom = cp?.pipelineState && cp.pipelineState !== 'CANCELLED' && cp.pipelineState !== 'BLOCKED'
          ? nextPhase(cp.pipelineState) || cp.pipelineState
          : undefined;
        if (taskId && projectDir) {
          ctx.pipelineRunning = true;
          ctx.activePipelineTaskId = taskId;
          setImmediate(() =>
            ctx.runPipeline(taskId, projectDir, resumeFrom).finally(() => {
              ctx.pipelineRunning = false;
              ctx.activePipelineTaskId = null;
            })
          );
        }
        bus.emit('task.resumed', { taskId });
        return { ok: true };
      }
      case 'task.cancel': {
        const taskId = body.taskId || state.currentTask?.id;
        if (taskId) {
          const cp = readCheckpoint(tasksDir, taskId) || {};
          cp.pipelineState = 'CANCELLED';
          writeCheckpoint(tasksDir, taskId, cp);
        }
        state.currentTask = null;
        state.currentPhase = null;
        for (const w of workerIds) {
          state.workers[w].status = 'idle';
        }
        saveState();
        bus.emit('task.cancelled', { taskId });
        return { ok: true };
      }
      case 'task.retry': {
        if (ctx.pipelineRunning) return pipelineBusyError(ctx.activePipelineTaskId);
        state.engine.paused = false;
        const taskId = body.taskId || state.currentTask?.id;
        const cp = readCheckpoint(tasksDir, taskId);
        if (cp && cp.pipelineState === 'BLOCKED') {
          cp.pipelineState = body.phase
            ? normalizePhase(body.phase)
            : 'INVESTIGATE';
          cp.phaseStatus = 'idle';
          writeCheckpoint(tasksDir, taskId, cp);
        }
        if (taskId && cp?.projectDir) {
          ctx.pipelineRunning = true;
          ctx.activePipelineTaskId = taskId;
          setImmediate(() =>
            ctx.runPipeline(taskId, cp.projectDir).finally(() => {
              ctx.pipelineRunning = false;
              ctx.activePipelineTaskId = null;
            })
          );
        }
        return { ok: true };
      }
      default:
        return { ok: false, error: `unknown intent: ${intent}` };
    }
  }

  ctx.handleIntent = handleIntent;
}

module.exports = { createIntent };
