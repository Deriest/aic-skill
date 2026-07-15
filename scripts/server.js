const os = require('os');
// AIC Dashboard API - Minimal server (TASK-20260707-019)
// Pure state broadcaster for the Virtual Office dashboard.
// No chat, no tasks, no agents workflow, no audit log, no cost tracking.
// Just: read state.json -> serve /api/status + accept /api/agent-status writes.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const { handleOpsEndpoint } = require('./ops-endpoints');
const { handleEnterpriseEndpoint } = require('./enterprise-endpoints');
const { createEngine } = require('./engine');
const { createObservabilityHandler } = require('./observability-handler');

function broadcast() {
  /* ponytail: no-op; dashboard polls GET /api/status */
}

const SKILL_DIR = path.join(__dirname, '..');
const STATE_FILE = path.join(SKILL_DIR, '.aic', 'state.json');
const METRICS_FILE = path.join(SKILL_DIR, '.aic', 'metrics.json');
const LATENCY_METRICS_FILE = path.join(SKILL_DIR, '.aic', 'latency_metrics.json');
const LATENCY_RING_MAX = 500;
const SLO_API_P99_MS = 250;
const ERROR_BUDGET_PCT = 1;
const TASKS_DIR = path.join(SKILL_DIR, '.aic', 'tasks');
const ENV_FILE = path.join(SKILL_DIR, '.env');
const LOG_FILE = path.join(SKILL_DIR, '.aic', 'logs', 'app.log');
const HEALTH_FILE = path.join(SKILL_DIR, '.aic', 'health.json');
const QUEUE_FILE = path.join(SKILL_DIR, '.aic', 'queue.json');
const AUDIT_LOG = path.join(path.join(SKILL_DIR, '.aic'), 'audit.log');

// === K-3: Extended Audit ===
function auditEvent(type, details) {
  const line = new Date().toISOString() + ' ' + type + ' ' + details + '\n';
  try { fs.appendFileSync(AUDIT_LOG, line); } catch(e) {}
}
const INSTANCE_ID = `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

// Structured Logger (I-4)
function log(level, cat, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), level, cat, msg, data };
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {}
}

// In-memory cache (I-9)
const cache = new Map();
function cachedRead(filePath, maxAge = 5000) {
  const now = Date.now();
  const c = cache.get(filePath);
  if (c && now - c.ts < maxAge) return c.data;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    cache.set(filePath, { data, ts: now });
    return data;
  } catch { return null; }
}
function invalidateCache(filePath) { cache.delete(filePath); }

// ponytail: in-memory ring; upgrade to latency_metrics.json-only if multi-instance
const latencyRing = [];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function recordApiLatency(entry) {
  latencyRing.push(entry);
  if (latencyRing.length > LATENCY_RING_MAX) latencyRing.shift();
  let store = { samples: [], updatedAt: null };
  try {
    if (fs.existsSync(LATENCY_METRICS_FILE)) {
      store = JSON.parse(fs.readFileSync(LATENCY_METRICS_FILE, 'utf8'));
    }
  } catch {}
  if (!Array.isArray(store.samples)) store.samples = [];
  store.samples.push(entry);
  if (store.samples.length > LATENCY_RING_MAX) store.samples = store.samples.slice(-LATENCY_RING_MAX);
  store.updatedAt = entry.ts;
  try {
    fs.mkdirSync(path.dirname(LATENCY_METRICS_FILE), { recursive: true });
    fs.writeFileSync(LATENCY_METRICS_FILE, JSON.stringify(store, null, 2));
  } catch {}
}

function buildLatencySli(samples) {
  const api = samples.filter(s => s.kind === 'api');
  const latencies = api.map(s => s.latencyMs).sort((a, b) => a - b);
  const total = api.length;
  const errors = api.filter(s => s.status >= 500).length;
  const errorRate = total ? errors / total : 0;
  const budgetConsumedPct = total ? Math.min(100, (errorRate / (ERROR_BUDGET_PCT / 100)) * 100) : 0;
  const p99 = percentile(latencies, 99);
  return {
    windowSamples: total,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99,
    },
    errorRate: +errorRate.toFixed(4),
    slo: {
      apiP99TargetMs: SLO_API_P99_MS,
      apiP99Met: total === 0 || p99 <= SLO_API_P99_MS,
      errorBudgetPct: ERROR_BUDGET_PCT,
      errorBudgetConsumedPct: +budgetConsumedPct.toFixed(2),
      errorBudgetRemainingPct: +Math.max(0, 100 - budgetConsumedPct).toFixed(2),
    },
  };
}

function getLatencyMetricsSummary() {
  const samples = latencyRing.length ? latencyRing : (() => {
    try {
      const d = JSON.parse(fs.readFileSync(LATENCY_METRICS_FILE, 'utf8'));
      return Array.isArray(d.samples) ? d.samples : [];
    } catch { return []; }
  })();
  return { sli: buildLatencySli(samples), updatedAt: samples.length ? samples[samples.length - 1].ts : null };
}

// Task persistence helpers
function ensureTaskDir(taskId) {
  const taskDir = path.join(TASKS_DIR, taskId);
  fs.mkdirSync(path.join(taskDir, 'reports'), { recursive: true });
  return taskDir;
}
function getTaskIds() {
  try { return fs.readdirSync(TASKS_DIR).filter(d => d.startsWith('TASK-')); }
  catch { return []; }
}
function readTaskContext(taskId) {
  try { return JSON.parse(fs.readFileSync(path.join(TASKS_DIR, taskId, 'context.json'), 'utf8')); }
  catch { return null; }
}
function readTaskState(taskId) {
  try { return JSON.parse(fs.readFileSync(path.join(TASKS_DIR, taskId, 'state.json'), 'utf8')); }
  catch { return null; }
}

// Parse .env file into object
function loadEnv() {
  const env = {};
  try {
    const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  } catch {}
  return env;
}

// Get active project (from ./aic selection or .env AIC_PROJECT_DIR)
function getActiveProject() {
  const env = loadEnv();
  return {
    path: env.AIC_ACTIVE_PROJECT || env.AIC_PROJECT_DIR || '',
    name: env.AIC_ACTIVE_PROJECT_NAME || '',
    workspace: env.AIC_PROJECT_DIR || ''
  };
}
const PORT = parseInt(process.argv[2] || process.env.PORT || '6868', 10);

function parseAllowedOrigins() {
  const raw = (process.env.AIC_CORS_ORIGINS || '').trim();
  if (!raw) return null;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
const ALLOWED_ORIGINS = parseAllowedOrigins();

function resolveCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!ALLOWED_ORIGINS) {
    if (!origin) return '*';
    return origin;
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

function securityHeadersForApi() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  };
}

function securityHeadersForStatic() {
  return {
    ...securityHeadersForApi(),
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  };
}

// Rate limiter: 60 req/min per IP
const rateLimits = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60000;
  let record = rateLimits.get(ip);
  if (!record || now - record.start > window) {
    record = { start: now, count: 0 };
    rateLimits.set(ip, record);
  }
  return ++record.count <= 60;
}

const WORKERS = [
  'pm', 'architect', 'research', 'frontend', 'backend', 'qa', 
  'designer', 'infra', 'security', 'perf', 'data', 'integration', 
  'documentation', 'governor', 'dispatcher'
];

const defaultState = () => {
  const s = {
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
  };
  return s;
};

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
    
    // Clean up obsolete workers not in current WORKERS list
    if (state.workers) {
      for (const w of Object.keys(state.workers)) {
        if (!WORKERS.includes(w)) {
          delete state.workers[w];
        }
      }
    }
    
    // Ensure all workers exist
    for (const w of WORKERS) {
      if (!state.workers[w]) state.workers[w] = { status: 'idle', engine: null, currentTask: null, subWorkers: [] };
      if (!state.workers[w].subWorkers) state.workers[w].subWorkers = [];
    }
    state.workers.dispatcher.status = state.currentTask ? 'working' : 'idle'; // DF-002: sync with task state
  } catch {
    state = defaultState();
  }
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('saveState error:', err.message);
  }
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

function fetchUpstreamModelsJson(baseURL, apiKey) {
  const raw = String(baseURL || '').trim();
  if (!raw) return Promise.reject(new Error('baseURL required'));
  const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  const modelsUrl = `${base}/models`;
  const u = new URL(modelsUrl);
  const lib = u.protocol === 'https:' ? https : http;
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        timeout: 20000,
      },
      (upstream) => {
        let body = '';
        upstream.on('data', (c) => { body += c; });
        upstream.on('end', () => {
          if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
            return reject(new Error(`Upstream HTTP ${upstream.statusCode}`));
          }
          try {
            resolve(JSON.parse(body || '{}'));
          } catch (e) {
            reject(new Error('Invalid JSON from upstream'));
          }
        });
      }
    );
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Upstream timeout')); });
    req.end();
  });
}

function send(res, status, body, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...securityHeadersForApi(),
  };
  if (req) {
    const cors = resolveCorsOrigin(req);
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
        recordApiLatency({
          ts: new Date().toISOString(),
          kind: 'api',
          method: req.method,
          path: p,
          status,
          latencyMs: Date.now() - (req._aicStartMs || Date.now()),
        });
      }
    } catch {}
  }
}

loadState();
getRuntimeEngine();
const obsHandler = createObservabilityHandler({
  skillDir: SKILL_DIR,
  tasksDir: TASKS_DIR,
  getState: () => state,
  engine: getRuntimeEngine(),
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    const cors = resolveCorsOrigin(req);
    if (!cors) return send(res, 403, { error: 'CORS origin not allowed' }, req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': cors,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
      ...(cors !== '*' ? { Vary: 'Origin' } : {}),
      ...securityHeadersForApi(),
    });
    return res.end();
  }

  // Rate limit: 60 req/min per IP
  // Request logging (I-4)
  req._aicStartMs = Date.now();
  const clientIp = req.socket.remoteAddress || 'unknown';
  log('INFO', 'api', `${req.method} ${pathname}`, { ip: clientIp });

  if (!checkRateLimit(clientIp)) {
    log('WARN', 'api', 'Rate limit exceeded', { ip: clientIp });
    return send(res, 429, { error: 'Rate limit exceeded' });
  }

  // Health check — no auth required
  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true, port: PORT, uptime: Math.floor((Date.now() - state.startedAt) / 1000) });
  }

  // Dashboard GET /api/status — no auth required (dashboard consumer)
  if (req.method === 'GET' && pathname === '/api/status') {
    const engine = getRuntimeEngine();
    return send(res, 200, engine.buildSnapshot());
  }

  // GET /api/version — version info (no auth required)
  if (req.method === 'GET' && pathname === '/api/version') {
    return send(res, 200, { version: '3.1.3', milestone: 'J' });
  }

  // POST /api/models — proxy model list (CSP connect-src 'self' blocks browser → proxy)
  if (req.method === 'POST' && pathname === '/api/models') {
    const data = await readBody(req);
    const baseURL = String(data.baseURL || '').trim();
    const apiKey = String(data.apiKey || '').trim();
    if (!baseURL) return send(res, 400, { error: 'baseURL required' }, req);
    try {
      const result = await fetchUpstreamModelsJson(baseURL, apiKey);
      return send(res, 200, result, req);
    } catch (err) {
      return send(res, 502, { error: err.message || 'Upstream fetch failed' }, req);
    }
  }

  // Auth management endpoints (protected)
  if (pathname.startsWith('/api/auth')) {
    if (!auth.requireAuth(req, res)) return;

    if (req.method === 'POST' && pathname === '/api/auth/keys') {
      const data = await readBody(req);
      const key = auth.addApiKey(data.label || 'default');
      return send(res, 200, { success: true, key });
    }
    if (req.method === 'GET' && pathname === '/api/auth/keys') {
      return send(res, 200, { keys: auth.listApiKeys() });
    }
    if (req.method === 'DELETE' && pathname === '/api/auth/keys') {
      const data = await readBody(req);
      if (!data.key) return send(res, 400, { error: 'missing key' });
      const removed = auth.removeApiKey(data.key);
      return removed ? send(res, 200, { success: true }) : send(res, 404, { error: 'key not found' });
    }
    return send(res, 404, { error: 'unknown auth endpoint' });
  }

  // All other API routes require auth
  const publicApi = ['/api/config', '/api/tasks', '/api/metrics', '/api/models'];
  if (pathname.startsWith('/api') && !publicApi.some(p => pathname.startsWith(p)) && !auth.requireAuth(req, res)) return;

  const engine = getRuntimeEngine();

  if (req.method === 'POST' && pathname === '/api/runtime/intent') {
    const data = await readBody(req);
    const intent = String(data.intent || '');
    const result = await engine.handleIntent(intent, data);
    saveState();
    return send(res, result.ok ? 200 : 400, result);
  }

  if (req.method === 'POST' && pathname === '/api/runtime/lease/issue') {
    const data = await readBody(req);
    const result = engine.issueLease(data);
    saveState();
    return send(res, result.ok ? 200 : 403, result);
  }

  const leaseComplete = pathname.match(/^\/api\/runtime\/lease\/([^/]+)\/complete$/);
  if (req.method === 'POST' && leaseComplete) {
    const data = await readBody(req);
    const result = await engine.finishLease(leaseComplete[1], {
      exitCode: data.exitCode ?? 1,
      artifactPath: data.artifactPath,
    });
    saveState();
    return send(res, result.ok ? 200 : 400, result);
  }

  // POST /api/task-start — delegates to Runtime Engine (create + start)
  if (req.method === 'POST' && pathname === '/api/task-start') {
    const data = await readBody(req);
    if (!data.title && !data.id) return send(res, 400, { error: 'Missing title' });
    const created = await engine.handleIntent('task.create', {
      id: data.id,
      title: data.title || 'Untitled Task',
      description: data.description || '',
      projectDir: data.projectDir || data.project_dir || getActiveProject().workspace,
      type: data.type,
    });
    if (!created.ok) return send(res, 400, created);
    const started = await engine.handleIntent('task.start', {
      taskId: created.taskId,
      title: data.title,
      type: data.type || 'feature',
      projectDir: data.projectDir || data.project_dir || getActiveProject().workspace,
    });
    saveState();
    return send(res, 200, { success: true, currentTask: state.currentTask, ...started });
  }

  // Legacy pipeline mutation — blocked (FEAT-001)
  if (req.method === 'POST' && pathname === '/api/task-status') {
    return send(res, 403, engine.legacyMutationBlocked());
  }

  // GET /api/project — active project info
  if (req.method === 'GET' && pathname === '/api/project') {
    return send(res, 200, getActiveProject());
  }

  // GET /api/config
  if (req.method === 'GET' && pathname === '/api/config') {
    const envPath = path.join(SKILL_DIR, '.env');
    const openCodePath = path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc');
    const project = getActiveProject();
    const config = {
      env: fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '',
      opencode: fs.existsSync(openCodePath) ? fs.readFileSync(openCodePath, 'utf8') : '',
      project: project
    };
    return send(res, 200, config);
  }

  // POST /api/config
  if (req.method === 'POST' && pathname === '/api/config') {
    const data = await readBody(req);
    const envPath = path.join(SKILL_DIR, '.env');
    const openCodePath = path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc');
    try {
      if (data.env !== undefined) fs.writeFileSync(envPath, data.env);
      if (data.opencode !== undefined) fs.writeFileSync(openCodePath, data.opencode);
      return send(res, 200, { success: true });
    } catch (err) {
      return send(res, 500, { error: err.message });
    }
  }

  // POST /api/runtime-gate
  if (req.method === 'POST' && pathname === '/api/runtime-gate') {
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
        metadata: data.metadata || null
      };
    }
    
    saveState();
    broadcast('state', state);
    return send(res, 200, { ok: true, runtimeGate: state.runtimeGate });
  }

  // POST /api/pm-review — batch PM review verdicts (blocked when engine owns pipeline)
  if (req.method === 'POST' && pathname === '/api/pm-review') {
    if (state.currentTask?.pipelineState && state.currentTask.pipelineState !== 'CREATED') {
      return send(res, 403, engine.legacyMutationBlocked());
    }
    const data = await readBody(req);
    const phase = String(data.phase || '');
    const verdicts = data.verdicts || {};
    const feedback = data.feedback || {};

    state.pmReview = {
      phase,
      verdicts,
      feedback,
      completedAt: Date.now()
    };

    // Determine if all PASS or any REWORK
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
        attempt: (state.rework?.attempt || 0) + 1
      };
    } else {
      state.rework = null;
    }

    saveState();
    broadcast('state', state);
    return send(res, 200, { ok: true, allPass, failedWorkers, pmReview: state.pmReview, rework: state.rework });
  }

  // POST /api/phase-barrier — Runtime Engine owns barriers (FEAT-001)
  if (req.method === 'POST' && pathname === '/api/phase-barrier') {
    return send(res, 403, engine.legacyMutationBlocked());
  }

  // POST /api/sub-agent-status
  if (req.method === 'POST' && pathname === '/api/sub-agent-status') {
    const data = await readBody(req);
    const parent = String(data.parent || '').toLowerCase();
    const subId = String(data.id || '');
    const scope = String(data.scope || '');
    const status = String(data.status || 'working');

    if (!WORKERS.includes(parent)) {
      return send(res, 400, { error: `unknown parent agent: ${parent}` });
    }
    if (!subId) {
      return send(res, 400, { error: `sub-agent id required` });
    }

    const workerState = state.workers[parent];
    const existingIdx = workerState.subWorkers.findIndex(sw => sw.id === subId);
    
    if (existingIdx >= 0) {
      workerState.subWorkers[existingIdx].status = status;
      if (scope) workerState.subWorkers[existingIdx].scope = scope;
    } else {
      workerState.subWorkers.push({ id: subId, scope: scope, status: status });
    }
    
    saveState();
    broadcast('state', state);
    return send(res, 200, { ok: true, state });
  }

  if (req.method === 'POST' && pathname === '/api/agent-status') {
    const data = await readBody(req);
    const agent = String(data.agent || '').toLowerCase();
    if (!WORKERS.includes(agent)) {
      return send(res, 400, { error: `unknown agent: ${agent}` });
    }
    if (agent !== 'dispatcher' && state.currentTask?.id?.startsWith('TASK-')) {
      return send(res, 403, engine.legacyMutationBlocked());
    }
    // Lifecycle enforcement: reject "working" if worker not allowed in current phase
    if (data.status === 'working' && agent !== 'dispatcher') {
      const phase = (state.currentPhase || '').toLowerCase();
      const PHASE_ALLOWED = {
        investigate:    ['pm', 'research'],
        planning:       ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra'],
        implementation: ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra', 'designer', 'frontend', 'backend'],
        verification:   ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra', 'designer', 'frontend', 'backend', 'qa', 'perf'],
        closeout:       ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra', 'designer', 'frontend', 'backend', 'qa', 'perf', 'documentation', 'governor'],
      };
      const allowed = PHASE_ALLOWED[phase];
      if (!allowed) {
        return send(res, 403, {
          error: `No active phase. Set currentPhase via POST /api/task-status before spawning workers.`,
          currentPhase: state.currentPhase,
        });
      }
      if (!allowed.includes(agent)) {
        return send(res, 403, {
          error: `Worker "${agent}" is not allowed in phase "${state.currentPhase}". Advance the phase first via POST /api/task-status.`,
          currentPhase: state.currentPhase,
          allowedWorkers: allowed,
          hint: `POST /api/task-status {"currentPhase":"${phase === 'investigate' ? 'Planning' : phase === 'planning' ? 'Implementation' : 'Verification'}"}`,
        });
      }
    }
    state.workers[agent] = {
      status: data.status || 'idle',
      engine: data.engine || state.workers[agent].engine || null,
      currentTask: data.currentTask ?? state.workers[agent].currentTask ?? null,
    };
    saveState();
    return send(res, 200, { success: true, worker: state.workers[agent] });
  }

  // POST /api/task-complete — Runtime Engine owns completion (FEAT-001)
  if (req.method === 'POST' && pathname === '/api/task-complete') {
    return send(res, 403, engine.legacyMutationBlocked());
  }


  // RP-003.2: Pipeline Status — Phase State Machine
  if (req.method === "GET" && pathname === "/api/pipeline/status") {
    const tasksDir = path.join(SKILL_DIR, ".aic", "tasks");
    const phases = [];
    try {
      for (const d of fs.readdirSync(tasksDir)) {
        const sf = path.join(tasksDir, d, "state.json");
        if (fs.existsSync(sf)) {
          const s = JSON.parse(fs.readFileSync(sf, "utf8"));
          phases.push({ id: s.id, phase: s.phase, status: s.status, description: s.description });
        }
      }
    } catch {}
    return send(res, 200, { phases, current: phases.find(p => p.status === "running") || null });
  }

  // POST /api/reset — clear all workers to idle
  if (req.method === 'POST' && pathname === '/api/reset') {
    state = defaultState();
    saveState();
    return send(res, 200, { success: true });
  }

  // GET /api/metrics — get metrics with optional filtering
  if (req.method === 'GET' && pathname === '/api/metrics') {
    try {
      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');
      const tierParam = url.searchParams.get('tier') || 'all';
      
      let metrics = [];
      if (fs.existsSync(METRICS_FILE)) {
        metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      }
      
      // Filter by date range
      if (fromParam) {
        const fromDate = new Date(fromParam);
        metrics = metrics.filter(m => new Date(m.timestamp) >= fromDate);
      }
      if (toParam) {
        const toDate = new Date(toParam);
        toDate.setHours(23, 59, 59, 999);
        metrics = metrics.filter(m => new Date(m.timestamp) <= toDate);
      }
      
      // Filter by tier
      if (tierParam !== 'all') {
        metrics = metrics.filter(m => m.tier === tierParam);
      }
      
      // Calculate summary
      const summary = {
        totalRequests: metrics.length,
        totalInput: metrics.reduce((sum, m) => sum + (m.tokens?.input || 0), 0),
        totalOutput: metrics.reduce((sum, m) => sum + (m.tokens?.output || 0), 0),
        totalCache: metrics.reduce((sum, m) => sum + (m.tokens?.cacheRead || 0), 0),
        cacheHitRate: 0,
        byWorker: {},
        byDay: {}
      };
      
      if (summary.totalInput + summary.totalOutput > 0) {
        summary.cacheHitRate = summary.totalCache / (summary.totalCache + summary.totalInput);
      }
      
      // Group by worker
      for (const m of metrics) {
        if (!summary.byWorker[m.worker]) {
          summary.byWorker[m.worker] = { requests: 0, input: 0, output: 0, cache: 0 };
        }
        summary.byWorker[m.worker].requests++;
        summary.byWorker[m.worker].input += m.tokens?.input || 0;
        summary.byWorker[m.worker].output += m.tokens?.output || 0;
        summary.byWorker[m.worker].cache += m.tokens?.cacheRead || 0;
      }
      
      // Group by day
      for (const m of metrics) {
        const day = m.timestamp.slice(0, 10);
        if (!summary.byDay[day]) {
          summary.byDay[day] = { requests: 0, input: 0, output: 0, cache: 0 };
        }
        summary.byDay[day].requests++;
        summary.byDay[day].input += m.tokens?.input || 0;
        summary.byDay[day].output += m.tokens?.output || 0;
        summary.byDay[day].cache += m.tokens?.cacheRead || 0;
      }
      
      // K-7: Runtime resource usage
      try {
        const os = require('os');
        const mem = process.memoryUsage();
        summary.memory = { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal };
        summary.cpu = { loadAvg: os.loadavg(), cores: os.cpus().length };
      } catch(e) {}
      // DF-003: Cost calculation (based on token usage)
      const COST_PER_INPUT = 0.000003;
      const COST_PER_OUTPUT = 0.000015;
      summary.cost = {
        input: +(summary.totalInput * COST_PER_INPUT).toFixed(4),
        output: +(summary.totalOutput * COST_PER_OUTPUT).toFixed(4),
        total: +((summary.totalInput * COST_PER_INPUT) + (summary.totalOutput * COST_PER_OUTPUT)).toFixed(4),
        currency: 'USD'
      };
      summary.latency = getLatencyMetricsSummary();
      return send(res, 200, { metrics, summary }, req);
    } catch (err) {
      return send(res, 500, { error: err.message });
    }
  }

  // POST /api/metrics — record a new metric
  if (req.method === 'POST' && pathname === '/api/metrics') {
    try {
      const data = await readBody(req);
      const metric = {
        id: `metric-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        worker: data.worker,
        tier: data.tier,
        model: data.model,
        taskId: data.taskId,
        tokens: data.tokens || { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        durationSec: data.durationSec || 0
      };
      
      // Read existing metrics or create new array
      let metrics = [];
      if (fs.existsSync(METRICS_FILE)) {
        metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      }
      
      metrics.push(metric);
      
      // Save metrics
      fs.mkdirSync(path.dirname(METRICS_FILE), { recursive: true });
      fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
      
      return send(res, 200, { success: true, metric });
    } catch (err) {
      return send(res, 500, { error: err.message });
    }
  }

  // GET /api/tasks — list all tasks
  if (req.method === 'GET' && pathname === '/api/tasks') {
    const ids = getTaskIds();
    const tasks = ids.map(id => {
      const ctx = readTaskContext(id) || {};
      const st = readTaskState(id) || {};
      return { taskId: id, ...ctx, ...st };
    });
    return send(res, 200, tasks);
  }

  // GET /api/tasks/:id — task details + context
  if (req.method === 'GET' && pathname.match(/^\/api\/tasks\/TASK-[\w-]+$/)) {
    const id = pathname.split('/').pop();
    const ctx = readTaskContext(id);
    const st = readTaskState(id);
    if (!ctx && !st) return send(res, 404, { error: 'task not found' });
    let reports = [];
    try { reports = fs.readdirSync(path.join(TASKS_DIR, id, 'reports')).filter(f => f.endsWith('.md')); } catch {}
    return send(res, 200, { context: ctx, state: st, reports });
  }

  // GET /api/tasks/:id/context — just context.json
  if (req.method === 'GET' && pathname.match(/^\/api\/tasks\/TASK-[\w-]+\/context$/)) {
    const id = pathname.split('/')[3];
    const ctx = readTaskContext(id);
    if (!ctx) return send(res, 404, { error: 'not found' });
    return send(res, 200, ctx);
  }

  // POST /api/work-packages — save WP decomposition
  if (req.method === 'POST' && pathname === '/api/work-packages') {
    const data = await readBody(req);
    if (!data.taskId) return send(res, 400, { error: 'missing taskId' });
    const taskDir = ensureTaskDir(data.taskId);
    fs.writeFileSync(path.join(taskDir, 'work-packages.json'), JSON.stringify(data.packages, null, 2));
    return send(res, 200, { success: true });
  }

  // GET /api/work-packages/:taskId — get WPs for a task
  if (req.method === 'GET' && pathname.match(/^\/api\/work-packages\/TASK-[\w-]+$/)) {
    const taskId = pathname.split('/').pop();
    try {
      const wps = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, taskId, 'work-packages.json'), 'utf8'));
      return send(res, 200, wps);
    } catch { return send(res, 200, []); }
  }

  // Static files (dashboard dist)
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    return serveStatic(req, res, pathname);
  }

  // === K-4: RBAC Enforcement ===
  const RBAC_MATRIX = {
    admin: ['*'],
    lead: ['project.*', 'worker.*', 'audit.*', 'knowledge.*', 'dispatchers.*', 'pipeline.*'],
    member: ['task.*', 'artifact.*', 'knowledge.read', 'queue.*'],
    viewer: ['status.read', 'metrics.read', 'health.read'],
  };
  function checkAccess(role, resource, action) {
    const perms = RBAC_MATRIX[role] || [];
    if (perms.includes('*')) return true;
    if (perms.includes(resource + '.*')) return true;
    if (perms.includes(resource + '.' + action)) return true;
    return false;
  }
  // Enforce RBAC on protected endpoints (skip public: /health, dashboard, /api/status)
  const rbacPath = url.pathname;
  const isPublic = rbacPath === '/health' || rbacPath === '/api/status' || rbacPath === '/api/config' || rbacPath === '/api/tasks' || rbacPath === '/api/metrics' || rbacPath === '/api/models' || rbacPath === '/' || rbacPath.startsWith('/dashboard') || rbacPath.startsWith('/assets');
  try {
    if (!isPublic && rbacPath.startsWith('/api/')) {
      const rbacKey = req.headers['x-api-key'] || '';
      const creds = loadCredentials();
      const apiKeyData = (creds.apiKeys || []).find(k => k.key === rbacKey);
      const rbacRole = apiKeyData?.role || 'viewer';
      const parts = rbacPath.split('/').filter(Boolean);
      const resource = parts[1] || 'unknown';
      const action = req.method === 'GET' ? 'read' : (req.method === 'POST' ? 'write' : req.method.toLowerCase());
      if (!checkAccess(rbacRole, resource, action)) {
        auditEvent('RBAC_DENIED', 'role=' + rbacRole + ' resource=' + resource + ' action=' + action);
        return send(res, 403, { error: 'Forbidden: insufficient permissions' });
      }
    }
  } catch(rbacErr) { /* RBAC check failed, allow request to proceed */ }

  // Enterprise endpoints (Milestone J)
  if (await handleEnterpriseEndpoint(req, res, send, readBody, { ...state, port: PORT })) return;

  // Ops endpoints (Milestone I)
  if (await handleOpsEndpoint(req, res, send, readBody, { ...state, port: PORT })) return;

    // === Runtime Observability Platform (WP-80) ===
  if (pathname.startsWith('/api/observability/')) {
    if (!auth.requireAuth(req, res)) return;
    const handled = obsHandler.handleObservability(req, res, pathname, send);
    if (handled !== false) return;
  }

  return send(res, 404, { error: 'not found' });
});

function serveStatic(req, res, pathname) {
  const distDir = path.join(SKILL_DIR, 'dashboard', 'dist');
  let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);

  // Prevent path traversal
  if (!filePath.startsWith(distDir)) {
    return send(res, 403, { error: 'forbidden' });
  }

  if (!fs.existsSync(filePath)) {
    // SPA fallback
    filePath = path.join(distDir, 'index.html');
    if (!fs.existsSync(filePath)) {
      return send(res, 503, { error: 'Dashboard is currently building or missing. Please try again in a few seconds.' });
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  }[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-store',
    ...securityHeadersForStatic(),
  });
  fs.createReadStream(filePath).pipe(res);
}

loadState();
server.listen(PORT, () => {
  console.log(`AIC API on http://localhost:${PORT}`);
  console.log(`Serving dashboard from ${path.join(SKILL_DIR, 'dashboard', 'dist')}`);
});


// === K-1: Graceful Shutdown ===
function gracefulShutdown(signal) {
  console.log(`[K-1] ${signal} received, shutting down gracefully...`);
  // Save state before exit
  try { saveState(); } catch(e) { console.error('[K-1] state save failed:', e.message); }
  // Reset stale workers
  try {
    for (const [name, w] of Object.entries(state.workers)) {
      if (w.status === 'working') { w.status = 'idle'; w.task = null; }
    }
    saveState();
  } catch(e) {}
  server.close(() => {
    console.log('[K-1] Server closed cleanly');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => { console.log('[K-1] Forced exit'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// === K-1: Orphan cleanup on startup ===
const PID_FILE = path.join(path.join(SKILL_DIR, '.aic'), 'server.pid');
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
