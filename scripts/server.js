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

const defaultState = () => ({
  workers: Object.fromEntries(
    WORKERS.map(id => [id, { status: 'idle', engine: null, currentTask: null }])
  ),
  startedAt: Date.now(),
});

let state = defaultState();

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const saved = JSON.parse(raw);
    state = { ...defaultState(), ...saved, startedAt: saved.startedAt || Date.now() };
    // Ensure all workers exist
    for (const w of WORKERS) {
      if (!state.workers[w]) state.workers[w] = { status: 'idle', engine: null, currentTask: null };
    }
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
      startedAt: state.startedAt,
    });
  }

  // POST /api/agent-status — set a worker's state
  if (req.method === 'POST' && pathname === '/api/agent-status') {
    const data = await readBody(req);
    const agent = String(data.agent || '').toLowerCase();
    if (!WORKERS.includes(agent)) {
      return send(res, 400, { error: `unknown agent: ${agent}` });
    }
    state.workers[agent] = {
      status: data.status || 'idle',
      engine: data.engine || state.workers[agent].engine || null,
      currentTask: data.currentTask ?? state.workers[agent].currentTask ?? null,
    };
    saveState();
    return send(res, 200, { success: true, worker: state.workers[agent] });
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
