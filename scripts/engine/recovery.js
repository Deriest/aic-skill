'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonSafe } = require('../atomic-write');

function reconcileOnStartup(state, tasksDir, workerIds) {
  const notes = [];
  if (!state.engine) state.engine = { paused: false, leases: {} };

  // Clean up workers stuck in 'working' state
  for (const w of workerIds) {
    if (!state.workers[w]) continue;
    if (state.workers[w].status === 'working') {
      state.workers[w].status = 'idle';
      state.workers[w].leaseId = null;
      notes.push(`reset stale working: ${w}`);
    }
  }

  // Check current task — if it's in a terminal state, clear it
  if (state.currentTask?.id) {
    const cpPath = path.join(tasksDir, state.currentTask.id, 'engine.json');
    if (fs.existsSync(cpPath)) {
      try {
        const cp = JSON.parse(fs.readFileSync(cpPath, 'utf8'));
        // If checkpoint shows terminal state, clear currentTask from global state
        const terminalStates = new Set(['COMPLETE', 'CANCELLED', 'BLOCKED']);
        if (terminalStates.has(cp.pipelineState)) {
          notes.push(`clearing terminal task from state: ${state.currentTask.id} (${cp.pipelineState})`);
          if (cp.pipelineState === 'COMPLETE') {
            // Keep visible on dashboard like live completeTask()
            state.currentTask.pipelineState = 'COMPLETE';
            state.currentTask.phaseStatus = 'idle';
            state.currentPhase = 'Closeout';
            state.runtimeGate = { type: 'complete', owner: 'pipeline', target: state.currentTask.id, status: 'complete', startedAt: Date.now(), metadata: {} };
            state.lastCompletedTask = { id: state.currentTask.id, title: state.currentTask.title || 'Untitled', completedAt: new Date().toISOString() };
          } else {
            state.currentTask = null;
            state.currentPhase = null;
          }
        } else {
          const nonInterruptable = new Set(['idle', 'interrupted', 'failed']);
          if (!nonInterruptable.has(cp.phaseStatus)) {
            cp.phaseStatus = 'interrupted';
            cp.interruptedAt = Date.now();
            writeJsonSafe(cpPath, cp);
            notes.push(`checkpoint interrupted: ${state.currentTask.id}`);
          }
        }
      } catch (err) {
        notes.push(`checkpoint read error: ${state.currentTask.id}: ${err.message}`);
      }
    }
  }

  // D-08 fix: prune leases belonging to terminal tasks on startup
  // Preserves leases for non-terminal tasks (resume-able)
  if (state.engine?.leases) {
    const terminalStates = new Set(['COMPLETE', 'CANCELLED', 'BLOCKED']);
    for (const [lid, l] of Object.entries(state.engine.leases)) {
      const leaseTaskId = l.taskId;
      if (!leaseTaskId) {
        delete state.engine.leases[lid];
        notes.push(`pruned orphan lease (no taskId): ${lid}`);
        continue;
      }
      // Check if the task is terminal via checkpoint
      const cpPath = path.join(tasksDir, leaseTaskId, 'engine.json');
      if (fs.existsSync(cpPath)) {
        try {
          const cp = JSON.parse(fs.readFileSync(cpPath, 'utf8'));
          if (terminalStates.has(cp.pipelineState)) {
            delete state.engine.leases[lid];
            notes.push(`pruned stale lease: ${lid} (task ${leaseTaskId} is ${cp.pipelineState})`);
          }
        } catch (err) {
          // If checkpoint unreadable, leave lease alone — safer than deleting
        }
      } else {
        // No checkpoint file — task dir likely cleaned up, prune
        delete state.engine.leases[lid];
        notes.push(`pruned orphan lease (no checkpoint): ${lid} (task ${leaseTaskId})`);
      }
    }
  }

  return notes;
}

module.exports = { reconcileOnStartup };