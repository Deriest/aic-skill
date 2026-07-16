'use strict';

const { readBody } = require('../utils');
const { PHASE_ALLOWED } = require('../config');

function handleAgentRoutes(req, res, send, ctx) {
  const { engine, state, saveState, WORKERS } = ctx;
  const { method } = req;
  const pathname = new URL(req.url, `http://localhost:${ctx.port}`).pathname;

  // POST /api/agent-status
  if (method === 'POST' && pathname === '/api/agent-status') {
    return (async () => {
      const data = await readBody(req);
      const agent = String(data.agent || '').toLowerCase();
      if (!WORKERS.includes(agent)) {
        send(res, 400, { error: `unknown agent: ${agent}` }); return true;
      }
      if (agent !== 'dispatcher' && state.currentTask?.id?.startsWith('TASK-')) {
        send(res, 403, engine.legacyMutationBlocked()); return true;
      }
      if (data.status === 'working' && agent !== 'dispatcher') {
        const phase = (state.currentPhase || '').toLowerCase();
        const allowed = PHASE_ALLOWED[phase];
        if (!allowed) {
          send(res, 403, {
            error: `No active phase. Set currentPhase via POST /api/task-status before spawning workers.`,
            currentPhase: state.currentPhase,
          }); return true;
        }
        if (!allowed.includes(agent)) {
          send(res, 403, {
            error: `Worker "${agent}" is not allowed in phase "${state.currentPhase}".`,
            currentPhase: state.currentPhase,
            allowedWorkers: allowed,
          }); return true;
        }
      }
      state.workers[agent] = {
        status: data.status || 'idle',
        engine: data.engine || state.workers[agent].engine || null,
        currentTask: data.currentTask ?? state.workers[agent].currentTask ?? null,
      };
      saveState();
      send(res, 200, { success: true, worker: state.workers[agent] }); return true;
    })();
  }

  // POST /api/sub-agent-status
  if (method === 'POST' && pathname === '/api/sub-agent-status') {
    return (async () => {
      const data = await readBody(req);
      const parent = String(data.parent || '').toLowerCase();
      const subId = String(data.id || '');
      const scope = String(data.scope || '');
      const status = String(data.status || 'working');

      if (!WORKERS.includes(parent)) {
        send(res, 400, { error: `unknown parent agent: ${parent}` }); return true;
      }
      if (!subId) {
        send(res, 400, { error: `sub-agent id required` }); return true;
      }

      const workerState = state.workers[parent];
      const existingIdx = workerState.subWorkers.findIndex(sw => sw.id === subId);
      if (existingIdx >= 0) {
        workerState.subWorkers[existingIdx].status = status;
        if (scope) workerState.subWorkers[existingIdx].scope = scope;
      } else {
        workerState.subWorkers.push({ id: subId, scope, status });
      }

      saveState();
      send(res, 200, { ok: true, state }); return true;
    })();
  }

  // POST /api/pm-review
  if (method === 'POST' && pathname === '/api/pm-review') {
    if (state.currentTask?.pipelineState && state.currentTask.pipelineState !== 'CREATED') {
      send(res, 403, engine.legacyMutationBlocked()); return true;
    }
    return (async () => {
      const data = await readBody(req);
      const phase = String(data.phase || '');
      const verdicts = data.verdicts || {};
      const feedback = data.feedback || {};

      state.pmReview = { phase, verdicts, feedback, completedAt: Date.now() };
      const allPass = Object.values(verdicts).every(v => v === 'PASS');
      const failedWorkers = Object.entries(verdicts)
        .filter(([_, v]) => v === 'REWORK')
        .map(([k]) => k);

      if (!allPass) {
        state.rework = {
          active: true,
          failedWorkers,
          passedWorkers: Object.entries(verdicts)
            .filter(([_, v]) => v === 'PASS')
            .map(([k]) => k),
          attempt: (state.rework?.attempt || 0) + 1,
        };
      } else {
        state.rework = null;
      }

      saveState();
      send(res, 200, { ok: true, allPass, failedWorkers, pmReview: state.pmReview, rework: state.rework }); return true;
    })();
  }

  // POST /api/reset
  if (method === 'POST' && pathname === '/api/reset') {
    const defaultState = ctx.defaultState;
    Object.assign(state, defaultState());
    saveState();
    return send(res, 200, { success: true }), true;
  }

  return false;
}

module.exports = { handleAgentRoutes };
