const os = require('os');
// AIC Dashboard API - Minimal server (TASK-20260707-019)
// Pure state broadcaster for the Virtual Office dashboard.
// No chat, no tasks, no agents workflow, no audit log, no cost tracking.
// Just: read state.json -> serve /api/status + accept /api/agent-status writes.

const http = require('http');
const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.join(__dirname, '..');
const STATE_FILE = path.join(SKILL_DIR, '.aic', 'state.json');
const PORT = parseInt(process.argv[2] || process.env.PORT || '6868', 10);

const WORKERS = [
  'pm', 'researcher', 'designer', 'architect',
  'frontend', 'backend', 'infra', 'qa', 'governor', 'dispatcher'
];

const defaultState = () => {
  const s = {
    workers: Object.fromEntries(
      WORKERS.map(id => [id, { status: id === 'dispatcher' ? 'working' : 'idle', engine: null, currentTask: null }])
    ),
    currentTask: null,
    currentPhase: null,
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
    // Ensure all workers exist
    for (const w of WORKERS) {
      if (!state.workers[w]) state.workers[w] = { status: w === 'dispatcher' ? 'working' : 'idle', engine: null, currentTask: null };
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

  // Health check
  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true, port: PORT, uptime: Math.floor((Date.now() - state.startedAt) / 1000) });
  }

  // GET /api/status — single source of truth for dashboard
  if (req.method === 'GET' && pathname === '/api/status') {
    return send(res, 200, {
      connected: true,
      workers: state.workers,
      currentTask: state.currentTask,
      currentPhase: state.currentPhase,
      startedAt: state.startedAt,
    });
  }

  // POST /api/task-status — set current task and pipeline phase
  if (req.method === 'POST' && pathname === '/api/task-status') {
    const data = await readBody(req);
    if (data.currentTask !== undefined) {
      // Auto-generate task ID if not provided
      if (data.currentTask && !data.currentTask.id) {
        const now = new Date();
        const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
        const seq = String(Math.floor(Math.random() * 900) + 100);
        data.currentTask.id = `TASK-${ymd}-${seq}`;
      }
      state.currentTask = data.currentTask;
    }
    if (data.currentPhase !== undefined) state.currentPhase = data.currentPhase;
    saveState();
    return send(res, 200, { success: true, currentTask: state.currentTask, currentPhase: state.currentPhase });
  }

  // GET /api/config
  if (req.method === 'GET' && pathname === '/api/config') {
    const envPath = path.join(SKILL_DIR, '.env');
    const openCodePath = path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc');
    const config = {
      env: fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '',
      opencode: fs.existsSync(openCodePath) ? fs.readFileSync(openCodePath, 'utf8') : ''
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

  // POST /api/agent-status — set a worker's state (lifecycle-enforced)
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
        investigate:    ['pm', 'researcher'],
        planning:       ['pm', 'researcher', 'designer', 'architect'],
        execution:      ['pm', 'researcher', 'designer', 'architect', 'frontend', 'backend', 'infra'],
        documentation:  ['pm', 'researcher', 'designer', 'architect', 'frontend', 'backend', 'infra', 'governor'],
        verification:   ['pm', 'researcher', 'designer', 'architect', 'frontend', 'backend', 'infra', 'qa', 'governor'],
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
          hint: `POST /api/task-status {"currentPhase":"${phase === 'investigate' ? 'Planning' : phase === 'planning' ? 'Execution' : 'Verification'}"}`,
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

  // POST /api/task-complete — reset all workers to idle, clear task/phase
  if (req.method === 'POST' && pathname === '/api/task-complete') {
    for (const w of WORKERS) {
      state.workers[w] = { status: w === 'dispatcher' ? 'working' : 'idle', engine: null, currentTask: null };
    }
    saveState();
    return send(res, 200, { success: true });
  }

  // POST /api/reset — clear all workers to idle
  if (req.method === 'POST' && pathname === '/api/reset') {
    state = defaultState();
    saveState();
    return send(res, 200, { success: true });
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
