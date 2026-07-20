'use strict';

const os = require('os');
const http = require('http');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const { writeJsonSafe } = require('./atomic-write');
const { handleOpsEndpoint } = require('./ops-endpoints');
const { handleEnterpriseEndpoint } = require('./enterprise-endpoints');
const { createEngine } = require('./engine');
const { createObservabilityHandler } = require('./observability-handler');
const { createLatencyTracker } = require('./latency-tracker');
const { createMiddleware } = require('./middleware');
const { handleTaskRoutes } = require('./routes/task-routes');
const { handleMetricsRoutes } = require('./routes/metrics-routes');
const { handleRuntimeRoutes } = require('./routes/runtime-routes');
const { handleAgentRoutes } = require('./routes/agent-routes');
const { handlePublicRoutes } = require('./routes/public-routes');
const {
  SKILL_DIR, STATE_FILE, METRICS_FILE, LATENCY_METRICS_FILE, LATENCY_RING_MAX,
  SLO_API_P99_MS, ERROR_BUDGET_PCT, TASKS_DIR, LOG_FILE, AUDIT_LOG, PID_FILE,
  WORKERS, PHASE_ALLOWED, loadEnv, getActiveProject, loadCredentials, parseAllowedOrigins,
} = require('./config');

// === Audit / Logging ===
function auditEvent(type, details) {
  const line = new Date().toISOString() + ' ' + type + ' ' + details + '\n';
  try { fs.appendFileSync(AUDIT_LOG, line); } catch(e) {}
}

function log(level, cat, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), level, cat, msg, data };
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {}
}

// === Latency tracker ===
const latencyTracker = createLatencyTracker({
  metricsFile: LATENCY_METRICS_FILE, ringMax: LATENCY_RING_MAX,
  sloP99Ms: SLO_API_P99_MS, errorBudgetPct: ERROR_BUDGET_PCT,
});

// === Middleware ===
const mw = createMiddleware({ allowedOrigins: parseAllowedOrigins(), skillDir: SKILL_DIR });

const PORT = parseInt(process.argv[2] || process.env.PORT || '6868', 10);

function send(res, status, body, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...mw.securityHeadersForApi(),
  };
  if (req) {
    const cors = mw.resolveCorsOrigin(req);
    if (cors) headers['Access-Control-Allow-Origin'] = cors;
    if (cors && cors !== '*') headers['Vary'] = 'Origin';
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
  if (req && req.url) {
    try {
      const p = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
      if (p.startsWith('/api')) {
        latencyTracker.record({
          ts: new Date().toISOString(), kind: 'api', method: req.method,
          path: p, status, latencyMs: Date.now() - (req._aicStartMs || Date.now()),
        });
      }
    } catch {}
  }
}

// === State management ===
const defaultState = () => ({
  workers: Object.fromEntries(
    WORKERS.map(id => [id, { status: 'idle', engine: null, currentTask: null, subWorkers: [] }])
  ),
  currentTask: null,
  currentPhase: null,
  runtimeGate: null,
  phaseBarrier: null,
  pmReview: null,
  rework: null,
  engine: { paused: false, leases: {} },
  startedAt: Date.now(),
});

let state = defaultState();

let runtimeEngine = null;
function getRuntimeEngine() {
  if (!runtimeEngine) {
    runtimeEngine = createEngine({
      skillDir: SKILL_DIR,
      scriptDir: __dirname,
      tasksDir: TASKS_DIR,
      workerIds: WORKERS,
      getState: () => state,
      setState: (s) => { state = s; },
      saveState,
      getActiveProject,
    });
    runtimeEngine.startupReconcile();
  }
  return runtimeEngine;
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const saved = JSON.parse(raw);
    state = { ...defaultState(), ...saved, startedAt: saved.startedAt || Date.now() };
    if (state.workers) {
      for (const w of Object.keys(state.workers)) {
        if (!WORKERS.includes(w)) delete state.workers[w];
      }
    }
    for (const w of WORKERS) {
      if (!state.workers[w]) state.workers[w] = { status: 'idle', engine: null, currentTask: null, subWorkers: [] };
      if (!state.workers[w].subWorkers) state.workers[w].subWorkers = [];
    }
    state.workers.dispatcher.status = state.currentTask ? 'working' : 'idle';
  } catch {
    state = defaultState();
  }
}

function saveState() {
  try { writeJsonSafe(STATE_FILE, state); }
  catch (err) { console.error('saveState error:', err.message); }
}

// === Init ===
loadState();
getRuntimeEngine();
const obsHandler = createObservabilityHandler({
  skillDir: SKILL_DIR,
  tasksDir: TASKS_DIR,
  getState: () => state,
  engine: getRuntimeEngine(),
});

const routeCtx = {
  engine: null,
  state,
  saveState,
  getActiveProject,
  tasksDir: TASKS_DIR,
  skillDir: SKILL_DIR,
  metricsFile: METRICS_FILE,
  latencyMetricsFile: LATENCY_METRICS_FILE,
  recordApiLatency: latencyTracker.record,
  getLatencyMetricsSummary: latencyTracker.getSummary,
  defaultState,
  WORKERS,
  PHASE_ALLOWED,
  port: PORT,
};

// === HTTP Server ===
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  url.pathname = pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    const cors = mw.resolveCorsOrigin(req);
    if (!cors) return send(res, 403, { error: 'CORS origin not allowed' }, req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': cors,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
      ...(cors !== '*' ? { Vary: 'Origin' } : {}),
      ...mw.securityHeadersForApi(),
    });
    return res.end();
  }

  // Request logging + rate limit
  req._aicStartMs = Date.now();
  const clientIp = req.socket.remoteAddress || 'unknown';
  log('INFO', 'api', `${req.method} ${pathname}`, { ip: clientIp });
  if (!mw.checkRateLimit(clientIp)) {
    log('WARN', 'api', 'Rate limit exceeded', { ip: clientIp });
    return send(res, 429, { error: 'Rate limit exceeded' });
  }

  // Public endpoints (no auth)
  req.url = url; // D-01: keep URL object so searchParams getter survives (spread dropped it)
  if (await handlePublicRoutes(req, res, send, { state, port: PORT, getRuntimeEngine, getActiveProject, skillDir: SKILL_DIR, auth })) return;

  // All other API routes require auth
  // D-03 fix: /api/tasks protected from external access.
  // D-15 fix: Dashboard (same-origin) GET endpoints allowed without auth for read-only access.
  const publicGetApi = ['/api/metrics', '/api/models', '/api/status', '/api/config', '/api/tasks'];
  const isReadOnlyGet = req.method === 'GET' && publicGetApi.some(p => pathname.startsWith(p));
  if (pathname.startsWith('/api') && !isReadOnlyGet && !auth.requireAuth(req, res)) return;

  const engine = getRuntimeEngine();
  routeCtx.engine = engine;

  // RBAC enforcement MUST happen BEFORE route dispatch (D-dispatcher-01)
  // Previously RBAC ran after routes, making it advisory-only
  const isPublic = pathname === '/health' || pathname === '/api/status'
    || pathname === '/api/tasks' || pathname === '/api/metrics' || pathname === '/api/models'
    || pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/assets');
  try {
    if (!isPublic && pathname.startsWith('/api/')) {
      const rbacKey = req.headers['x-api-key'] || '';
      const creds = auth.loadCredentials();
      const apiKeyData = (creds.apiKeys || []).find(k => k.key === rbacKey);
      const rbacRole = apiKeyData?.role || 'viewer';
      const parts = pathname.split('/').filter(Boolean);
      const resource = parts[1] || 'unknown';
      const action = req.method === 'GET' ? 'read' : (req.method === 'POST' ? 'write' : req.method.toLowerCase());
      if (!mw.checkAccess(rbacRole, resource, action)) {
        auditEvent('RBAC_DENIED', 'role=' + rbacRole + ' resource=' + resource + ' action=' + action);
        return send(res, 403, { error: 'Forbidden: insufficient permissions' });
      }
    }
  } catch(rbacErr) { return send(res, 500, { error: 'Internal error' }); }

  // Delegate to route modules (RBAC already enforced above)
  if (await handleRuntimeRoutes(req, res, send, routeCtx)) return;
  if (await handleTaskRoutes(req, res, send, routeCtx)) return;
  if (await handleAgentRoutes(req, res, send, routeCtx)) return;
  if (await handleMetricsRoutes(req, res, send, routeCtx)) return;

  // Observability
  if (pathname.startsWith('/api/observability/')) {
    if (!auth.requireAuth(req, res)) return;
    const handled = obsHandler.handleObservability(req, res, pathname, send);
    if (handled !== false) return;
  }

  // Enterprise / Ops
  if (await handleEnterpriseEndpoint(req, res, send, require('./utils').readBody, { ...state, port: PORT })) return;
  if (await handleOpsEndpoint(req, res, send, require('./utils').readBody, { ...state, port: PORT })) return;

  // Static files
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    return mw.serveStatic(req, res, pathname, send);
  }

  return send(res, 404, { error: 'not found' });
});

loadState();
server.listen(PORT, () => {
  console.log(`AIC API on http://localhost:${PORT}`);
  console.log(`Serving dashboard from ${path.join(SKILL_DIR, 'dashboard', 'dist')}`);
});

// === Graceful Shutdown ===
function gracefulShutdown(signal) {
  console.log(`[K-1] ${signal} received, shutting down gracefully...`);
  try {
    for (const [name, w] of Object.entries(state.workers)) {
      if (w.status === 'working') { w.status = 'idle'; w.task = null; }
    }
    saveState();
  } catch(e) { console.error('[K-1] state save failed:', e.message); }
  server.close(() => {
    console.log('[K-1] Server closed cleanly');
    process.exit(0);
  });
  setTimeout(() => { console.log('[K-1] Forced exit'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// === Orphan cleanup ===
try {
  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    if (oldPid && oldPid !== process.pid) {
      try { process.kill(oldPid, 0); process.kill(oldPid, 'SIGTERM'); console.log('[K-1] Killed orphan:', oldPid); } catch(e) {}
    }
  }
  fs.writeFileSync(PID_FILE, String(process.pid));
} catch(e) {}

// Reset stale workers on startup
for (const [name, w] of Object.entries(state.workers)) {
  if (w.status === 'working') { w.status = 'idle'; w.task = null; }
}
saveState();
