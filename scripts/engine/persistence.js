'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonSafe } = require('../atomic-write');

function ensureTaskDir(tasksDir, taskId) {
  const taskDir = path.join(tasksDir, taskId);
  fs.mkdirSync(path.join(taskDir, 'reports'), { recursive: true });
  fs.mkdirSync(path.join(taskDir, 'leases'), { recursive: true });
  return taskDir;
}

function readCheckpoint(tasksDir, taskId) {
  try {
    const f = path.join(tasksDir, taskId, 'engine.json');
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

function writeCheckpoint(tasksDir, taskId, checkpoint) {
  const taskDir = ensureTaskDir(tasksDir, taskId);
  const f = path.join(taskDir, 'engine.json');
  writeJsonSafe(f, checkpoint);
  const legacy = path.join(taskDir, 'state.json');
  // Map pipelineState to legacy status field consistently
  const terminalStates = { COMPLETE: 'done', CANCELLED: 'cancelled', BLOCKED: 'blocked' };
  const status = terminalStates[checkpoint.pipelineState] || 'active';
  writeJsonSafe(legacy, {
    id: taskId,
    phase: checkpoint.pipelineState,
    phaseStatus: checkpoint.phaseStatus,
    status,
    lastActivity: new Date().toISOString(),
  });
}

function allocateTaskId(tasksDir) {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  let nextSeq = 1;
  try {
    const existing = fs
      .readdirSync(tasksDir)
      .filter((d) => d.startsWith(`TASK-${ymd}`));
    if (existing.length) {
      const seqs = existing
        .map((t) => parseInt(t.split('-')[2], 10))
        .filter((n) => !Number.isNaN(n));
      if (seqs.length) nextSeq = Math.max(...seqs) + 1;
    }
  } catch {
    /* empty tasks dir */
  }
  return `TASK-${ymd}-${String(nextSeq).padStart(3, '0')}`;
}

module.exports = {
  ensureTaskDir,
  readCheckpoint,
  writeCheckpoint,
  allocateTaskId,
};