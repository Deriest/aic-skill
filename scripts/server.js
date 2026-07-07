#!/usr/bin/env node
/**
 * AIC Office — Status API Server (consolidated)
 *
 * Single authority for all status reads AND writes.
 * In-memory state, flushed to status.json after every mutation.
 * Bounded ring buffer for logs (last 100 entries).
 *
 * Usage: node server.js [port]
 * Default port: 6868
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.argv[2] || 6868;
const BASE = path.join(os.homedir(), '.hermes', 'skills', 'workflows', 'aic');
const STATUS_FILE = path.join(BASE, 'status.json');
const HISTORY_FILE = path.join(BASE, 'history.json');
const MAX_LOGS = 100;
const MAX_HISTORY = 50;

// --- In-memory state ---

function defaultState() {
  return {
    connected: true,
    currentTask: null,
    phases: [],
    agents: {},
    logs: [],      // ring buffer, last MAX_LOGS entries
    log: null,     // backward compat: latest single log entry
  };
}

let state = defaultState();

// Load from disk for restart resilience
try {
  if (fs.existsSync(STATUS_FILE)) {
    const saved = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    state = { ...defaultState(), ...saved, log: saved.log ?? null };
    // Trim logs to ring buffer size
    if (state.logs.length > MAX_LOGS) {
      state.logs = state.logs.slice(-MAX_LOGS);
    }
  }
} catch (e) {
  console.error('[AIC] Failed to load status.json, using defaults:', e.message);
}

function flush() {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[AIC] Failed to flush status.json:', e.message);
  }
}

function appendLog(message, type) {
  const entry = { message, type: type || 'info' };
  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) state.logs.shift();
  state.log = entry; // backward compat
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[AIC] Failed to load history.json:', e.message);
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('[AIC] Failed to save history.json:', e.message);
  }
}

// --- Request body parser ---
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// --- Route dispatch ---

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  try {
    // --- GET routes ---

    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, port: Number(PORT) });
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      // ponytail: full state snapshot on every poll; add SSE if bandwidth matters
      // Drain logs so client doesn't re-append the same entries each poll
      const logsOut = state.logs.slice();
      const logOut = state.log;
      state.logs = [];
      state.log = null;
      flush();
      return json(res, 200, {
        connected: state.connected,
        currentTask: state.currentTask,
        phases: state.phases,
        agents: state.agents,
        logs: logsOut,
        log: logOut,
      });
    }

    if (req.method === 'GET' && req.url === '/api/history') {
      return json(res, 200, loadHistory());
    }

    // --- POST routes ---

    if (req.method === 'POST' && req.url === '/api/task-start') {
      const data = await readBody(req);
      state.currentTask = { title: data.title || 'Unknown', type: data.type || 'feature', id: data.id || '' };
      appendLog(`Task started: ${state.currentTask.title}`, 'info');
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/phase-start') {
      const data = await readBody(req);
      state.phases.push({ name: data.name || 'Unknown', status: data.status || 'pending' });
      appendLog(`Phase started: ${data.name}`, 'info');
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/phase-complete') {
      if (state.phases.length > 0) {
        state.phases[state.phases.length - 1].status = 'complete';
      }
      appendLog('Phase completed', 'success');
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/agent-status') {
      const data = await readBody(req);
      const agent = data.agent || 'unknown';
      const agentStatus = data.status || 'idle';
      const entry = { status: agentStatus };
      if (data.engine) entry.engine = data.engine;
      state.agents[agent] = entry;
      const msgType = agentStatus === 'working' ? 'warning' : agentStatus === 'complete' ? 'success' : 'info';
      const engineStr = data.engine ? ` [${data.engine}]` : '';
      appendLog(`Agent ${agent}: ${agentStatus}${engineStr}`, msgType);
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/log') {
      const data = await readBody(req);
      appendLog(data.message || 'Unknown', data.type || 'info');
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/task-complete') {
      const title = state.currentTask ? state.currentTask.title : 'Unknown';
      // Append to history before resetting
      const history = loadHistory();
      history.push({
        task: state.currentTask,
        completedAt: new Date().toISOString(),
        phases: state.phases,
        agents: state.agents,
      });
      // Keep last MAX_HISTORY entries
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
      saveHistory(history);
      // Reset task state
      state.currentTask = null;
      state.phases = [];
      state.agents = {};
      appendLog(`✅ Task completed: ${title}`, 'success');
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/reset') {
      const logs = state.logs.slice(); // preserve logs through reset
      state = defaultState();
      state.logs = logs;
      appendLog('Status reset', 'info');
      flush();
      return json(res, 200, { success: true });
    }

    // Backward compat: old POST /api/status (raw state overwrite)
    if (req.method === 'POST' && req.url === '/api/status') {
      const data = await readBody(req);
      state = { ...defaultState(), ...data };
      flush();
      return json(res, 200, { success: true });
    }

    json(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[AIC] Request error:', e.message);
    json(res, 400, { error: e.message || 'Bad request' });
  }
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗\n║     🏢 AIC Office — Status API Server       ║\n╠══════════════════════════════════════════════╣\n║                                              ║\n║  API:  http://localhost:${PORT}/api/status    ║\n║  UI:   http://localhost:6969 (Vite dev)     ║\n║                                              ║\n╚══════════════════════════════════════════════╝\n  `);
});

process.on('SIGINT', () => {
  console.log('\n[AIC] Shutting down...');
  flush();
  server.close();
  process.exit(0);
});
