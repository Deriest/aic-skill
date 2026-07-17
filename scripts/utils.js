'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonSafe } = require('./atomic-write');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function ensureTaskDir(taskId, tasksDir) {
  const dir = path.join(tasksDir, taskId);
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true });
  return dir;
}

function getTaskIds(tasksDir) {
  try { return fs.readdirSync(tasksDir).filter(d => d.startsWith('TASK-')).sort().reverse(); }
  catch { return []; }
}

function readTaskContext(taskId, tasksDir) {
  try { return JSON.parse(fs.readFileSync(path.join(tasksDir, taskId, 'context.json'), 'utf8')); }
  catch { return null; }
}

function readTaskState(taskId, tasksDir) {
  try { return JSON.parse(fs.readFileSync(path.join(tasksDir, taskId, 'state.json'), 'utf8')); }
  catch { return null; }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
  });
}

module.exports = {
  percentile,
  ensureTaskDir,
  getTaskIds,
  readTaskContext,
  readTaskState,
  readBody,
};
