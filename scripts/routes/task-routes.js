'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonSafe } = require('../atomic-write');
const { ensureTaskDir, getTaskIds, readTaskContext, readTaskState, readBody } = require('../utils');
const { validateTaskCreate } = require('../input-validation');

function handleTaskRoutes(req, res, send, ctx) {
  const { engine, state, saveState, getActiveProject, tasksDir } = ctx;
  const { method, url } = req;
  const pathname = url.pathname;

  // POST /api/task-start
  if (method === 'POST' && pathname === '/api/task-start') {
    return (async () => {
      const data = await readBody(req);
      if (!data.title && !data.id) { send(res, 400, { error: 'Missing title' }); return true; }
      const created = await engine.handleIntent('task.create', {
        id: data.id,
        title: data.title || 'Untitled Task',
        description: data.description || '',
        projectDir: data.projectDir || data.project_dir || getActiveProject().workspace,
        type: data.type,
      });
      if (!created.ok) { send(res, 400, created); return true; }
      const started = await engine.handleIntent('task.start', {
        taskId: created.taskId,
        title: data.title,
        type: data.type || 'feature',
        projectDir: data.projectDir || data.project_dir || getActiveProject().workspace,
      });
      saveState();
      send(res, 200, { success: true, currentTask: state.currentTask, ...started });
      return true;
    })();
  }

  // GET /api/tasks — list all tasks
  if (method === 'GET' && pathname === '/api/tasks') {
    const ids = getTaskIds(tasksDir);
    const tasks = ids.map(id => {
      const tCtx = readTaskContext(id, tasksDir) || {};
      const st = readTaskState(id, tasksDir) || {};
      return { taskId: id, ...tCtx, ...st };
    });
    send(res, 200, tasks); return true;
  }

  // GET /api/tasks/:id
  if (method === 'GET' && pathname.match(/^\/api\/tasks\/TASK-[\w-]+$/)) {
    const id = pathname.split('/').pop();
    const taskCtx = readTaskContext(id, tasksDir);
    const st = readTaskState(id, tasksDir);
    if (!taskCtx && !st) return send(res, 404, { error: 'task not found' }), true;
    let reports = [];
    try { reports = fs.readdirSync(path.join(tasksDir, id, 'reports')).filter(f => f.endsWith('.md')); } catch {}
    return send(res, 200, { context: taskCtx, state: st, reports }), true;
  }

  // GET /api/tasks/:id/context
  if (method === 'GET' && pathname.match(/^\/api\/tasks\/TASK-[\w-]+\/context$/)) {
    const id = pathname.split('/')[3];
    const taskCtx = readTaskContext(id, tasksDir);
    if (!taskCtx) return send(res, 404, { error: 'not found' }), true;
    return send(res, 200, taskCtx), true;
  }

  // POST /api/work-packages
  if (method === 'POST' && pathname === '/api/work-packages') {
    return (async () => {
      const data = await readBody(req);
      if (!data.taskId) { send(res, 400, { error: 'missing taskId' }); return true; }
      const taskDir = ensureTaskDir(data.taskId, tasksDir);
      writeJsonSafe(path.join(taskDir, 'work-packages.json'), data.packages);
      send(res, 200, { success: true }); return true;
    })();
  }

  // GET /api/work-packages/:taskId
  if (method === 'GET' && pathname.match(/^\/api\/work-packages\/TASK-[\w-]+$/)) {
    const taskId = pathname.split('/').pop();
    try {
      const wps = JSON.parse(fs.readFileSync(path.join(tasksDir, taskId, 'work-packages.json'), 'utf8'));
      return send(res, 200, wps), true;
    } catch { return send(res, 200, []), true; }
  }

  return false;
}

module.exports = { handleTaskRoutes };
