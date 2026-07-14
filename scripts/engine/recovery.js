'use strict';

const fs = require('fs');
const path = require('path');

function reconcileOnStartup(state, tasksDir, workerIds) {
  const notes = [];
  if (!state.engine) state.engine = { paused: false, leases: {} };

  for (const w of workerIds) {
    if (!state.workers[w]) continue;
    if (state.workers[w].status === 'working') {
      state.workers[w].status = 'idle';
      state.workers[w].leaseId = null;
      notes.push(`reset stale working: ${w}`);
    }
  }

  if (state.currentTask?.id) {
    const cpPath = path.join(tasksDir, state.currentTask.id, 'engine.json');
    if (fs.existsSync(cpPath)) {
      try {
        const cp = JSON.parse(fs.readFileSync(cpPath, 'utf8'));
        if (cp.phaseStatus === 'running' || cp.phaseStatus === 'spawning') {
          cp.phaseStatus = 'interrupted';
          cp.interruptedAt = Date.now();
          fs.writeFileSync(cpPath, JSON.stringify(cp, null, 2));
          notes.push(`checkpoint interrupted: ${state.currentTask.id}`);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return notes;
}

module.exports = { reconcileOnStartup };