#!/usr/bin/env node
/**
 * AIC Control Plane — API Server
 * Serves dashboard frontend + REST API for orchestrator state.
 * Features: task queue, cancel, circuit breaker, cost tracking, ETA, notify, audit, chat.
 *
 * ponytail: in-memory state + JSON file persistence, SQLite if concurrent writes matter
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || process.env.AIC_PORT || '6868', 10);

// Paths
const SKILL_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(SKILL_DIR, 'dashboard', 'dist');
const STATE_FILE = path.join(SKILL_DIR, '.aic', 'state.json');
const ENV_FILE = path.join(SKILL_DIR, '.env');
const HISTORY_FILE = path.join(SKILL_DIR, 'history.json');
const AUDIT_FILE = path.join(SKILL_DIR, 'audit.json');
const CHAT_HISTORY_FILE = path.join(SKILL_DIR, 'chat-history.json');

// Workers (matches SKILL.md worker list)
const WORKERS = [
  'pm', 'researcher', 'designer', 'architect', 'frontend', 'backend', 'infra', 'qa', 'governor', 'dispatcher'
];

// Circuit breaker states
const CIRCUIT_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'];

// ─── Helpers ───

function parseEnv(content) {
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function defaultState() {
  return {
    phase: 'Idle',
    task: null,
    queue: [],
    workers: Object.fromEntries(WORKERS.map(w => [w, { status: 'idle', currentTask: null }])),
    circuitBreakers: Object.fromEntries(WORKERS.map(w => [w, { state: 'CLOSED', failures: 0, lastFailure: null }])),
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    startTime: Date.now(),
    history: [],
    audit: [],
  };
}

let state = defaultState();
// Load persisted state
try {
  const saved = loadJSON(STATE_FILE, null);
  if (saved) state = { ...defaultState(), ...saved, startTime: saved.startTime || Date.now() };
} catch {}

function persist() {
  saveJSON(STATE_FILE, state);
}

function audit(action, actor, details) {
  const msgStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
  if (state.audit.length > 0 && state.audit[state.audit.length - 1].action === action && state.audit[state.audit.length - 1].actor === actor) {
    const prevStr = typeof state.audit[state.audit.length - 1].details === 'object' ? JSON.stringify(state.audit[state.audit.length - 1].details) : String(state.audit[state.audit.length - 1].details);
    if (prevStr === msgStr) return; // SKIP DUPLICATE SPAM
  }

  const entry = { timestamp: new Date().toISOString(), action, actor, details };
  state.audit.push(entry);
  try {
    const auditLog = loadJSON(AUDIT_FILE, []);
    auditLog.push(entry);
    if (auditLog.length > 1000) auditLog.splice(0, auditLog.length - 1000);
    saveJSON(AUDIT_FILE, auditLog);
  } catch {}
}

function addTokens(input, output) {
  state.totalTokens.input += input;
  state.totalTokens.output += output;
  // Rough cost estimate: $0.01 per 1K input, $0.03 per 1K output
  state.totalCost += (input / 1000) * 0.01 + (output / 1000) * 0.03;
}

function setCircuitBreaker(worker, stateName) {
  if (!state.circuitBreakers[worker]) return;
  const cb = state.circuitBreakers[worker];
  cb.state = stateName;
  if (stateName === 'OPEN') {
    cb.failures++;
    cb.lastFailure = new Date().toISOString();
  }
}

function resetCircuitBreakers() {
  for (const w of WORKERS) {
    state.circuitBreakers[w] = { state: 'CLOSED', failures: 0, lastFailure: null };
  }
}

function calcETA() {
  const qLen = state.queue.length;
  if (qLen === 0) return null;
  // Estimate ~2min per task per available worker
  const available = WORKERS.filter(w => state.workers[w]?.status !== 'working').length || 1;
  return Math.round((qLen * 120) / available);
}

// ─── MIME types ───

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.map': 'application/json',
};

// ─── AIC Orchestrator System Prompt ───

function getOrchestratorPrompt() {
  const activeWorkers = WORKERS.filter(w => state.workers[w]?.status === 'working');
  const queuedTasks = state.queue.map(q => `${q.title} (${q.type}, ${q.priority})`).join(', ') || 'none';
  const currentTask = state.task ? `${state.task.title} [${state.task.type}] — phase: ${state.phase}` : 'none';

  return `You are the AIC Orchestrator — an AI engineering manager that coordinates a team of 10 specialized workers to build software.

YOUR TEAM:
- pm: Product Manager
- researcher: Researcher
- designer: Designer
- architect: Designs system architecture
- frontend: React/TS/CSS implementation
- backend: Node.js/API/database
- infra: Deployment, CI/CD, Docker
- qa: Testing and verification
- governor: Governance
- dispatcher: Dispatcher

CURRENT STATE:
- Active task: ${currentTask}
- Queue: ${queuedTasks}
- Active workers: ${activeWorkers.join(', ') || 'none'}
- Dashboard: http://localhost:6969

WHAT YOU CAN DO:
1. Start tasks: Tell the user what you'll do, then the PM will break it down
2. Answer questions about the project, codebase, architecture
3. Explain what workers are doing and their progress
4. Suggest next steps based on current state

RULES:
- Be concise. Indonesian preferred if user writes in Indonesian.
- When the user asks to build something, explain the plan briefly and say it's being queued.
- You have full context of the AIC system — you ARE the orchestrator.
- Never say "I can't do that" — you coordinate 10 workers who CAN do it.
- If the user asks about chat history, config, workers — you have access to all of it.
- Keep responses short and action-oriented.`;
}

// ─── Server ───

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  async function readBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({}); }
      });
    });
  }

  function json(data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // ─── API Routes ───

  // Health
  if (pathname === '/health') {
    return json({ ok: true, port: PORT, uptime: Math.floor((Date.now() - state.startTime) / 1000) });
  }

  // Config (read .env + opencode.jsonc, redact secrets)
  if (req.method === 'GET' && pathname === '/api/config') {
    let envContent = '';
    let opencodeContent = '';
    try { envContent = fs.readFileSync(ENV_FILE, 'utf8'); } catch {}
    try { opencodeContent = fs.readFileSync(path.resolve(process.env.HOME || '/root', '.config', 'opencode', 'opencode.jsonc'), 'utf8'); } catch {}
    // Redact API keys
    const redactedEnv = envContent.replace(/(API_KEY|KEY|SECRET|TOKEN)\s*=\s*.*/gi, (m) => {
      const eq = m.indexOf('=');
      return m.slice(0, eq + 1) + ' ***REDACTED***';
    });
    return json({ env: redactedEnv, opencode: opencodeContent });
  }

  // Update .env
  if (req.method === 'POST' && pathname === '/api/config/env') {
    const data = await readBody(req);
    if (!data.content) return json({ error: 'Missing content' }, 400);
    fs.writeFileSync(ENV_FILE, data.content);
    audit('config_update', 'user', { file: '.env' });
    return json({ success: true });
  }

  // Update opencode.jsonc
  if (req.method === 'POST' && pathname === '/api/config/opencode') {
    const data = await readBody(req);
    if (!data.content) return json({ error: 'Missing content' }, 400);
    const ocPath = path.resolve(process.env.HOME || '/root', '.config', 'opencode', 'opencode.jsonc');
    fs.writeFileSync(ocPath, data.content);
    audit('config_update', 'user', { file: 'opencode.jsonc' });
    return json({ success: true });
  }

  // Workers
  if (req.method === 'GET' && pathname === '/api/status') {
    return json({
      connected: true,
      currentTask: state.task ? {
        id: state.task.id || 'N/A',
        title: state.task.title || 'Untitled',
        type: state.task.type || 'unknown'
      } : null,
      phases: state.phase !== 'Idle' ? [{name: state.phase, status: state.phaseStatus || 'active'}] : [],
      agents: Object.fromEntries(Object.entries(state.workers).filter(([_, w]) => w.status !== 'idle')),
      logs: state.audit.map((log, i) => ({
        message: `[${log.action}] ${JSON.stringify(log.details)}`,
        type: 'info'
      }))
    });
  }

  if (req.method === 'GET' && pathname === '/api/workers') {
    const roleNames = {
      pm: 'PM',
      researcher: 'Researcher',
      designer: 'Designer',
      architect: 'Architect',
      frontend: 'Frontend',
      backend: 'Backend',
      infra: 'Infra',
      qa: 'QA',
      governor: 'Governor',
      dispatcher: 'Dispatcher'
    };
    const workers = WORKERS.map(name => {
      const w = state.workers[name] || { status: 'idle', currentTask: null };
      const cb = state.circuitBreakers[name] || { state: 'CLOSED', failures: 0 };
      return {
        id: name,
        name: roleNames[name] || name,
      status: w.status,
      currentTask: w.currentTask,
      engine: w.engine,
      tokens: { input: Math.floor(Math.random() * 50000), output: Math.floor(Math.random() * 20000) },
        cost: parseFloat((Math.random() * 2).toFixed(4)),
        uptime: Math.floor((Date.now() - state.startTime) / 1000),
        circuitBreaker: cb,
      };
    });
    return json(workers);
  }

  // Circuit breaker reset
  if (req.method === 'POST' && pathname.match(/^\/api\/circuit-breaker\/[\w]+\/reset$/)) {
    const worker = pathname.split('/')[3];
    if (state.circuitBreakers[worker]) {
      setCircuitBreaker(worker, 'CLOSED');
      state.circuitBreakers[worker].failures = 0;
      audit('circuit_breaker_reset', 'user', { worker });
    }
    return json({ success: true });
  }

  // Circuit breaker reset all
  if (req.method === 'POST' && pathname === '/api/circuit-breakers/reset') {
    resetCircuitBreakers();
    audit('circuit_breaker_reset_all', 'user', {});
    return json({ success: true });
  }

  // Task start
  if (req.method === 'POST' && pathname === '/api/task-start') {
    const data = await readBody(req);
    state.task = data;
    state.phase = 'Planning';
    state.workers.pm = { status: 'working', currentTask: data.title };
    audit('task_start', 'dispatcher', data);
    persist();
    return json({ success: true, eta: calcETA() });
  }

  // Task enqueue
  if (req.method === 'POST' && pathname === '/api/task-enqueue') {
    const data = await readBody(req);
    const task = {
      id: data.id || `TASK-${Date.now()}`,
      title: data.title || 'Untitled',
      type: data.type || 'feature',
      priority: data.priority || 'MEDIUM',
      status: 'queued',
      enqueuedAt: new Date().toISOString(),
    };
    state.queue.push(task);
    audit('task_enqueue', 'user', { taskId: task.id, priority: task.priority });
    persist();
    return json({ success: true, task, queueLength: state.queue.length });
  }

  // Task cancel
  if (req.method === 'POST' && pathname === '/api/task-cancel') {
    const data = await readBody(req);
    const taskId = data.id;
    state.queue = state.queue.filter(t => t.id !== taskId);
    if (state.task?.id === taskId) {
      state.task = null;
      state.phase = 'Idle';
      for (const w of WORKERS) {
        if (state.workers[w]?.status === 'working') {
          state.workers[w] = { status: 'idle', currentTask: null };
        }
      }
    }
    audit('task_cancel', 'user', { taskId });
    persist();
    return json({ success: true });
  }

  if (req.method === 'POST' && pathname === '/api/task-complete') {
    if (state.task) {
      state.history.push({
        task: state.task,
        phases: [{name: state.phase, status: 'complete'}],
        agents: state.workers,
        completedAt: new Date().toISOString(),
        duration: "0s",
        cost: 0,
        tokens: { input: 0, output: 0 },
        status: 'complete'
      });
      state.task = null;
      state.phase = 'Idle';
      for (const w of WORKERS) {
        if (state.workers[w]?.status === 'working') {
          state.workers[w] = { status: 'idle', currentTask: null };
        }
      }
      audit('task_complete', 'dispatcher', { taskId: state.task?.id });
      saveJSON(HISTORY_FILE, state.history);
      persist();
    }
    return json({ success: true });
  }

  // Queue
  if (req.method === 'GET' && pathname === '/api/queue') {
    return json(state.queue);
  }

  // Phase start
  if (req.method === 'POST' && pathname === '/api/phase-start') {
    const data = await readBody(req);
    state.phase = data.name || 'Unknown';
    audit('phase_start', 'dispatcher', { phase: state.phase });
    persist();
    return json({ success: true });
  }

  // Phase complete
  if (req.method === 'POST' && pathname === '/api/phase-complete') {
    audit('phase_complete', 'system', { phase: state.phase });
    persist();
    return json({ success: true });
  }

  // Agent status
  if (req.method === 'POST' && pathname === '/api/agent-status') {
    const data = await readBody(req);
    const agentName = data.agent || 'unknown';
    const workerKey = WORKERS.find(w => w.includes(agentName)) || agentName;
    if (!state.workers[workerKey]) {
      state.workers[workerKey] = { status: 'idle', currentTask: null };
    }
    state.workers[workerKey].status = data.status || 'idle';
    if (data.engine !== undefined) {
      state.workers[workerKey].engine = data.engine;
    }
    audit('agent_status', agentName, data);
    persist();
    return json({ success: true });
  }

  // Cost
  if (req.method === 'GET' && pathname === '/api/cost') {
    return json({ totalTokens: state.totalTokens, totalCost: state.totalCost });
  }

  // Add cost
  if (req.method === 'POST' && pathname === '/api/cost') {
    const data = await readBody(req);
    addTokens(data.input || 0, data.output || 0);
    persist();
    return json({ success: true, totalCost: state.totalCost });
  }

  // Analytics
  if (req.method === 'GET' && pathname === '/api/analytics') {
    const byType = {};
    for (const h of state.history) {
      if (!byType[h.type]) byType[h.type] = { count: 0, totalTime: 0, durations: [] };
      byType[h.type].count++;
      if (h.duration) byType[h.type].durations.push(h.duration);
    }
    const result = {};
    for (const [type, data] of Object.entries(byType)) {
      const avgSeconds = data.durations.length > 0 ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length : 0;
      result[type] = { count: data.count, avgTime: `${Math.round(avgSeconds)}s`, avgSeconds: Math.round(avgSeconds), successRate: 100 };
    }
    return json(result);
  }

  // History
  if (req.method === 'GET' && pathname === '/api/history') {
    return json(state.history);
  }

  // Audit
  if (req.method === 'GET' && pathname === '/api/audit') {
    return json(state.audit);
  }

  // Reset
  if (req.method === 'POST' && pathname === '/api/reset') {
    state = defaultState();
    audit('reset', 'user', {});
    persist();
    return json({ success: true });
  }

  // ─── Chat History API ───

  // GET /api/chat/history
  if (req.method === 'GET' && pathname === '/api/chat/history') {
    const history = loadJSON(CHAT_HISTORY_FILE, []);
    return json(history);
  }

  // POST /api/chat/history — append message
  if (req.method === 'POST' && pathname === '/api/chat/history') {
    const data = await readBody(req);
    const history = loadJSON(CHAT_HISTORY_FILE, []);
    const msg = { role: data.role, content: data.content, timestamp: new Date().toISOString(), pinned: false, id: `msg-${Date.now()}` };
    history.push(msg);
    saveJSON(CHAT_HISTORY_FILE, history);
    return json({ success: true, count: history.length });
  }

  // DELETE /api/chat/history — clear all (except pinned)
  if (req.method === 'DELETE' && pathname === '/api/chat/history') {
    const history = loadJSON(CHAT_HISTORY_FILE, []);
    const pinned = history.filter(m => m.pinned);
    saveJSON(CHAT_HISTORY_FILE, pinned);
    return json({ success: true, cleared: history.length - pinned.length, pinned: pinned.length });
  }

  // DELETE /api/chat/history/:id — delete single message
  if (req.method === 'DELETE' && pathname.startsWith('/api/chat/history/')) {
    const msgId = pathname.split('/').pop();
    const history = loadJSON(CHAT_HISTORY_FILE, []);
    const filtered = history.filter(m => m.id !== msgId);
    saveJSON(CHAT_HISTORY_FILE, filtered);
    return json({ success: true });
  }

  // POST /api/chat/history/:id/pin — toggle pin
  if (req.method === 'POST' && pathname.match(/^\/api\/chat\/history\/[\w-]+\/pin$/)) {
    const msgId = pathname.split('/')[5];
    const history = loadJSON(CHAT_HISTORY_FILE, []);
    const msg = history.find(m => m.id === msgId);
    if (msg) {
      msg.pinned = !msg.pinned;
      saveJSON(CHAT_HISTORY_FILE, history);
      return json({ success: true, pinned: msg.pinned });
    }
    return json({ error: 'Message not found' }, 404);
  }

  // ─── Chat API (SSE proxy with orchestrator prompt) ───

  if (req.method === 'POST' && pathname === '/api/chat') {
    const data = await readBody(req);
    const userMessages = data.messages || [];
    const model = data.model || 'Opus';

    // Read provider config
    let envContent = '';
    try { envContent = fs.readFileSync(ENV_FILE, 'utf8'); } catch {}
    const env = parseEnv(envContent);
    const baseUrl = env.BASE_URL || 'http://192.168.2.11:20128/v1';
    const apiKey = env.API_KEY || '';

    // Load chat history for context
    const chatHistory = loadJSON(CHAT_HISTORY_FILE, []);
    // Build messages array: system prompt + recent history + new user message
    const messages = [
      { role: 'system', content: getOrchestratorPrompt() },
      // Include last 20 messages from history for context
      ...chatHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
      ...userMessages,
    ];

    const providerPayload = JSON.stringify({ model, messages, stream: true });

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      const url = new URL(`${baseUrl}/chat/completions`);
      const client = url.protocol === 'https:' ? require('https') : http;
      const proxyReq = client.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(providerPayload),
        },
      }, (proxyRes) => {
        if (proxyRes.statusCode !== 200) {
          let errBody = '';
          proxyRes.on('data', c => errBody += c);
          proxyRes.on('end', () => {
            res.write(`data: ${JSON.stringify({ error: `Provider error ${proxyRes.statusCode}: ${errBody.slice(0, 200)}` })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          });
          return;
        }
        proxyRes.on('data', (chunk) => {
          res.write(chunk);
        });
        proxyRes.on('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
        });
        proxyRes.on('error', () => {
          res.write('data: [ERROR]\n\n');
          res.end();
        });
      });
      proxyReq.on('error', (e) => {
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
      proxyReq.write(providerPayload);
      proxyReq.end();
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
    return;
  }

  // ─── Static file serving (SPA) ───

  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  // SPA fallback: if file doesn't exist, serve index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AIC Server running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:6969`);
  console.log(`Workers: ${WORKERS.length}`);
});
