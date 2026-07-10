const os = require('os');
// AIC Dashboard API - Minimal server (TASK-20260707-019)
// Pure state broadcaster for the Virtual Office dashboard.
// No chat, no tasks, no agents workflow, no audit log, no cost tracking.
// Just: read state.json -> serve /api/status + accept /api/agent-status writes.

const http = require('http');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');

const SKILL_DIR = path.join(__dirname, '..');
const STATE_FILE = path.join(SKILL_DIR, '.aic', 'state.json');
const METRICS_FILE = path.join(SKILL_DIR, '.aic', 'metrics.json');
const TASKS_DIR = path.join(SKILL_DIR, '.aic', 'tasks');
const ENV_FILE = path.join(SKILL_DIR, '.env');

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
      WORKERS.map(id => [id, { status: id === 'dispatcher' ? 'working' : 'idle', engine: null, currentTask: null, subWorkers: [] }])
    ),
    currentTask: null,
    currentPhase: null,
    runtimeGate: null,
    phaseBarrier: null,
    pmReview: null,
    rework: null,
    startedAt: Date.now(),
  };
  return s;
};

let state = defaultState();

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
      if (!state.workers[w]) state.workers[w] = { status: w === 'dispatcher' ? 'working' : 'idle', engine: null, currentTask: null, subWorkers: [] };
      if (!state.workers[w].subWorkers) state.workers[w].subWorkers = [];
    }
    state.workers.dispatcher.status = 'working'; // Force dispatcher to always be working
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

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // Rate limit: 60 req/min per IP
  const clientIp = req.socket.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    return send(res, 429, { error: 'rate limit exceeded' });
  }

  // Health check — no auth required
  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true, port: PORT, uptime: Math.floor((Date.now() - state.startedAt) / 1000) });
  }

  // Dashboard GET /api/status — no auth required (dashboard consumer)
  if (req.method === 'GET' && pathname === '/api/status') {
    return send(res, 200, {
      connected: true,
      workers: state.workers,
      currentTask: state.currentTask,
      currentPhase: state.currentPhase,
      startedAt: state.startedAt,
    });
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
  if (pathname.startsWith('/api') && !auth.requireAuth(req, res)) return;

  // POST /api/task-start — start a new task (sets currentTask + resets workers)
  if (req.method === 'POST' && pathname === '/api/task-start') {
    const data = await readBody(req);
    if (data.id || data.title) {
      const now = new Date();
      const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
      const existing = (function() { try { return fs.readdirSync(TASKS_DIR).filter(d => d.startsWith('TASK-')); } catch(e) { return []; } })().filter(t => t.startsWith(`TASK-${ymd}`));
      let nextSeq = 1;
      if (existing.length > 0) {
        const seqs = existing.map(t => parseInt(t.split('-')[2], 10)).filter(n => !isNaN(n));
        if (seqs.length > 0) nextSeq = Math.max(...seqs) + 1;
      }
      const seq = String(nextSeq).padStart(3, '0');
      const taskId = data.id || `TASK-${ymd}-${seq}`;
      state.currentTask = {
        id: taskId,
        title: data.title || 'Untitled Task',
        type: data.type || 'general'
      };
      state.currentPhase = null;
      // Reset all workers to idle
      for (const w of WORKERS) {
        if (w !== 'dispatcher') {
          state.workers[w] = { status: 'idle', engine: null, currentTask: null };
        }
      }
      // Create task directory with context + state
      const taskDir = ensureTaskDir(taskId);
      fs.writeFileSync(path.join(taskDir, 'context.json'), JSON.stringify({
        taskId, title: data.title || 'Untitled Task',
        description: data.description || '',
        classification: data.classification || data.type || 'general',
        userRequirement: data.userRequirement || data.description || '',
        createdAt: new Date().toISOString()
      }, null, 2));
      fs.writeFileSync(path.join(taskDir, 'state.json'), JSON.stringify({
        phase: null, status: 'active', lastActivity: new Date().toISOString(), workers: []
      }, null, 2));
      saveState();
      return send(res, 200, { success: true, currentTask: state.currentTask });
    }
    return send(res, 400, { error: 'Missing id or title' });
  }

  // POST /api/task-status — set current task and pipeline phase
  if (req.method === 'POST' && pathname === '/api/task-status') {
    const data = await readBody(req);
    if (data.currentTask !== undefined) {
      // Auto-generate task ID if not provided
      if (data.currentTask && !data.currentTask.id) {
        const now = new Date();
        const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
        const existing = (function() { try { return fs.readdirSync(TASKS_DIR).filter(d => d.startsWith('TASK-')); } catch(e) { return []; } })().filter(t => t.startsWith(`TASK-${ymd}`));
        let nextSeq = 1;
        if (existing.length > 0) {
          const seqs = existing.map(t => parseInt(t.split('-')[2], 10)).filter(n => !isNaN(n));
          if (seqs.length > 0) nextSeq = Math.max(...seqs) + 1;
        }
        const seq = String(nextSeq).padStart(3, '0');
        data.currentTask.id = `TASK-${ymd}-${seq}`;
      }
      state.currentTask = data.currentTask;
    }
    if (data.currentPhase !== undefined) state.currentPhase = data.currentPhase;
    // Persist phase transition to task state
    if (state.currentTask?.id && data.currentPhase !== undefined) {
      try {
        const ts = readTaskState(state.currentTask.id) || {};
        ts.phase = data.currentPhase;
        ts.lastActivity = new Date().toISOString();
        if (data.report) {
          fs.writeFileSync(path.join(TASKS_DIR, state.currentTask.id, 'reports', `${data.currentPhase}.md`), data.report);
        }
        fs.writeFileSync(path.join(TASKS_DIR, state.currentTask.id, 'state.json'), JSON.stringify(ts, null, 2));
      } catch {}
    }
    saveState();
    return send(res, 200, { success: true, currentTask: state.currentTask, currentPhase: state.currentPhase });
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

  // POST /api/pm-review — batch PM review verdicts
  if (req.method === 'POST' && pathname === '/api/pm-review') {
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

  // POST /api/phase-barrier — update phase barrier state
  if (req.method === 'POST' && pathname === '/api/phase-barrier') {
    const data = await readBody(req);
    const action = String(data.action || 'update');

    if (action === 'start') {
      state.phaseBarrier = {
        active: true,
        workers: data.workers || [],
        completed: {},
        startedAt: Date.now(),
        timeout: data.timeout || 600000
      };
    } else if (action === 'update') {
      if (state.phaseBarrier) {
        const worker = String(data.worker || '');
        const status = String(data.status || 'complete');
        if (worker) state.phaseBarrier.completed[worker] = status;
      }
    } else if (action === 'clear') {
      state.phaseBarrier = null;
    }

    saveState();
    broadcast('state', state);
    return send(res, 200, { ok: true, phaseBarrier: state.phaseBarrier });
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

  // POST /api/task-complete — mark task done
  if (req.method === 'POST' && pathname === '/api/task-complete') {
    const data = await readBody(req);
    const tid = data.taskId || state.currentTask?.id;
    if (tid) {
      const taskDir = path.join(TASKS_DIR, tid);
      const stateFile = path.join(taskDir, 'state.json');
      if (fs.existsSync(stateFile)) {
        const ts = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        ts.status = 'done';
        ts.lastActivity = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(ts, null, 2));
      }
    }
    // Don't reset workers — let them stay 'complete' so dashboard shows who did what
    // Workers reset to idle on next task-start
    saveState();
    return send(res, 200, { success: true, status: 'done' });
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
      
      return send(res, 200, { metrics, summary });
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
  });
  fs.createReadStream(filePath).pipe(res);
}

loadState();
server.listen(PORT, () => {
  console.log(`AIC API on http://localhost:${PORT}`);
  console.log(`Serving dashboard from ${path.join(SKILL_DIR, 'dashboard', 'dist')}`);
});
