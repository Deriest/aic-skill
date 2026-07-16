'use strict';

const fs = require('fs');
const path = require('path');
const { syncDashboardFromCheckpoint } = require('./helpers');
const { clearBarrier } = require('./barrier');
const { readCheckpoint, writeCheckpoint } = require('./persistence');

/**
 * Factory: attaches { runPipeline, completeTask, triggerKnowledgeAsync } to ctx.
 * @param {object} ctx - mutable shared engine context
 */
function createPipeline(ctx) {
  const {
    skillDir, tasksDir,
    getState, saveState, bus,
  } = ctx;

  function triggerKnowledgeAsync(taskId) {
    bus.emit('knowledge.started', { taskId });
    try {
      const kDir = path.join(skillDir, '.aic', 'knowledge');
      const kFile = path.join(kDir, 'task-entries.json');
      const { writeJsonSafe } = require('../atomic-write');
      const entries = fs.existsSync(kFile)
        ? JSON.parse(fs.readFileSync(kFile, 'utf8'))
        : [];
      entries.push({ task_id: taskId, status: 'done', timestamp: Date.now() });
      fs.mkdirSync(kDir, { recursive: true });
      writeJsonSafe(kFile, entries);
      bus.emit('knowledge.completed', { taskId });
    } catch {
      bus.emit('knowledge.completed', { taskId, error: 'best-effort' });
    }
  }

  function completeTask(taskId) {
    const state = getState();
    const cp = readCheckpoint(tasksDir, taskId) || {};
    cp.pipelineState = 'COMPLETE';
    cp.phaseStatus = 'idle';
    cp.phaseBarrier = clearBarrier();
    writeCheckpoint(tasksDir, taskId, cp);

    state.currentPhase = null;
    state.currentTask = null;
    state.phaseBarrier = null;
    state.runtimeGate = null;

    // D-08: Prune all leases for this completed task
    const leases = state.engine?.leases || {};
    for (const [lid, l] of Object.entries(leases)) {
      if (l.taskId === taskId) delete leases[lid];
    }

    saveState();
    bus.emit('task.completed', { taskId });
    triggerKnowledgeAsync(taskId);
    triggerPostmortemAsync(taskId);
    return { ok: true };
  }

  function triggerPostmortemAsync(taskId) {
    const { spawn } = require('child_process');
    bus.emit('postmortem.started', { taskId });
    try {
      const script = path.join(scriptDir, 'postmortem.py');
      if (!fs.existsSync(script)) return;
      const child = spawn('python3', [script, skillDir, taskId], {
        stdio: 'pipe', timeout: 120000
      });
      let stdout = '';
      child.stdout.on('data', (d) => stdout += d);
      child.on('close', (code) => {
        if (code === 0) {
          console.log(`[engine] postmortem complete for ${taskId}`);
          bus.emit('postmortem.completed', { taskId, output: stdout.trim() });
        } else {
          console.error(`[engine] postmortem failed for ${taskId} (exit ${code})`);
          bus.emit('postmortem.completed', { taskId, error: stdout.trim() });
        }
      });
      child.on('error', (err) => {
        console.error(`[engine] postmortem spawn error for ${taskId}:`, err.message);
        bus.emit('postmortem.completed', { taskId, error: err.message });
      });
    } catch (err) {
      console.error(`[engine] postmortem error for ${taskId}:`, err.message);
      bus.emit('postmortem.completed', { taskId, error: err.message });
    }
  }

  async function runPipeline(taskId, projectDir, startFromPhase) {
    if (ctx.pipelineRunning && ctx.activePipelineTaskId !== taskId) {
      return { ok: false, error: 'pipeline_busy', activeTaskId: ctx.activePipelineTaskId };
    }
    if (!ctx.pipelineRunning) {
      ctx.pipelineRunning = true;
      ctx.activePipelineTaskId = taskId;
    }
    try {
      const sequence = [
        'INVESTIGATE',
        'PLANNING',
        'IMPLEMENTATION',
        'VERIFICATION',
        'CLOSEOUT',
      ];
      // Support resume from checkpoint: skip phases already completed
      const startIdx = startFromPhase ? sequence.indexOf(startFromPhase) : 0;
      const effectiveSequence = startIdx >= 0 ? sequence.slice(startIdx) : sequence;
      for (const phase of effectiveSequence) {
        const state = getState();
        if (state.engine?.paused) {
          bus.emit('task.paused', { taskId });
          return { ok: false, paused: true };
        }
        // Check if task was cancelled
        const cpBefore = readCheckpoint(tasksDir, taskId) || {};
        if (cpBefore.pipelineState === 'CANCELLED') {
          bus.emit('task.cancelled', { taskId });
          return { ok: false, cancelled: true };
        }
        const r = await ctx.runPhase(taskId, phase, projectDir);
        if (!r.ok) return r;
        const cp = readCheckpoint(tasksDir, taskId) || {};
        cp.pipelineState = phase;
        writeCheckpoint(tasksDir, taskId, cp);
      }

      await completeTask(taskId);
      return { ok: true };
    } finally {
      if (ctx.activePipelineTaskId === taskId) {
        ctx.pipelineRunning = false;
        ctx.activePipelineTaskId = null;
      }
    }
  }

  ctx.triggerKnowledgeAsync = triggerKnowledgeAsync;
  ctx.completeTask = completeTask;
  ctx.runPipeline = runPipeline;
}

module.exports = { createPipeline };
