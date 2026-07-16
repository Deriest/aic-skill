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
          state.currentTask = null;
          state.currentPhase = null;
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

  return notes;
}

module.exports = { reconcileOnStartup };