'use strict';

const { readBody } = require('../utils');
const { validateIntent, validateLease } = require('../input-validation');

function handleRuntimeRoutes(req, res, send, ctx) {
  const { engine, state, saveState } = ctx;
  const { method, url } = req;
  const pathname = url.pathname;

  // POST /api/runtime/intent
  if (method === 'POST' && pathname === '/api/runtime/intent') {
    return (async () => {
      const data = await readBody(req);
      const v = validateIntent(data);
      if (!v.ok) { send(res, 400, { error: 'validation', details: v.errors }); return true; }
      const result = await engine.handleIntent(v.data.intent, v.data);
      saveState();
      send(res, result.ok ? 200 : 400, result); return true;
    })();
  }

  // POST /api/runtime/lease/issue
  if (method === 'POST' && pathname === '/api/runtime/lease/issue') {
    return (async () => {
      const data = await readBody(req);
      const v = validateLease(data);
      if (!v.ok) { send(res, 400, { error: 'validation', details: v.errors }); return true; }
      const result = engine.issueLease(v.data);
      saveState();
      send(res, result.ok ? 200 : 403, result); return true;
    })();
  }

  // POST /api/runtime/lease/:id/complete
  const leaseComplete = pathname.match(/^\/api\/runtime\/lease\/([^/]+)\/complete$/);
  if (method === 'POST' && leaseComplete) {
    return (async () => {
      const data = await readBody(req);
      const result = await engine.finishLease(leaseComplete[1], {
        exitCode: data.exitCode ?? 1,
        artifactPath: data.artifactPath,
      });
      saveState();
      send(res, result.ok ? 200 : 400, result); return true;
    })();
  }

  // POST /api/runtime-gate
  if (method === 'POST' && pathname === '/api/runtime-gate') {
    return (async () => {
      const data = await readBody(req);
      if (data.action === 'clear') {
        state.runtimeGate = null;
      } else {
        state.runtimeGate = {
          type: String(data.type || 'pm-review'),
          owner: String(data.owner || 'pm'),
          target: String(data.target || ''),
          status: String(data.status || 'reviewing'),
          startedAt: state.runtimeGate?.startedAt || Date.now(),
          metadata: data.metadata || null,
        };
      }
      saveState();
      send(res, 200, { ok: true, runtimeGate: state.runtimeGate }); return true;
    })();
  }

  // Legacy blocked endpoints
  if (method === 'POST' && (pathname === '/api/task-status' || pathname === '/api/phase-barrier' || pathname === '/api/task-complete')) {
    return send(res, 403, engine.legacyMutationBlocked()), true;
  }

  return false;
}

module.exports = { handleRuntimeRoutes };
