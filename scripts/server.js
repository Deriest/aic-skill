#!/usr/bin/env node
/**
 * AIC Office — Status API Server (consolidated)
 *
 * Single authority for all status reads AND writes.
 * In-memory state, flushed to status.json after every mutation.
 * Bounded ring buffer for logs (last 100 entries).
 *
 * Features:
 * - Task queue with priority (HIGH/MEDIUM/LOW)
 * - Task cancellation
 * - Circuit breaker per worker (3x fail → open)
 * - Cost tracking (tokens in/out)
 * - ETA estimation (from history)
 * - Audit trail
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
const AUDIT_FILE = path.join(BASE, 'audit.json');
const MAX_LOGS = 100;
const MAX_HISTORY = 50;
const MAX_AUDIT = 500;
const CIRCUIT_FAIL_THRESHOLD = 3;
const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// --- In-memory state ---

function defaultState() {
  return {
    connected: true,
    currentTask: null,
    phases: [],
    agents: {},
    logs: [],
    log: null,
    // Phase 1: Queue + Circuit Breaker
    taskQueue: [],        // [{id, title, type, priority, queuedAt}]
    circuitBreakers: {},  // {agentName: {failCount, state: 'closed'|'open'|'half-open', lastFail}}
    // Phase 4: Cost tracking
    tokens: { input: 0, output: 0 },
    cost: 0,
    // Phase 2: ETA
    startedAt: null,
  };
}

let state = defaultState();

// Load from disk for restart resilience
try {
  if (fs.existsSync(STATUS_FILE)) {
    const saved = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    state = { ...defaultState(), ...saved, log: saved.log ?? null };
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
  const entry = { message, type: type || 'info', timestamp: new Date().toISOString() };
  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) state.logs.shift();
  state.log = entry;
}

// --- History ---

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

// --- Audit Trail ---

function loadAudit() {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[AIC] Failed to load audit.json:', e.message);
  }
  return [];
}

function saveAudit(audit) {
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(audit, null, 2));
  } catch (e) {
    console.error('[AIC] Failed to save audit.json:', e.message);
  }
}

function appendAudit(action, actor, details) {
  const audit = loadAudit();
  audit.push({
    timestamp: new Date().toISOString(),
    action,
    actor: actor || 'system',
    details: details || {},
  });
  if (audit.length > MAX_AUDIT) audit.splice(0, audit.length - MAX_AUDIT);
  saveAudit(audit);
}

// --- Circuit Breaker ---

function getCircuit(agent) {
  if (!state.circuitBreakers[agent]) {
    state.circuitBreakers[agent] = { failCount: 0, state: 'closed', lastFail: null };
  }
  return state.circuitBreakers[agent];
}

function circuitRecordFailure(agent) {
  const cb = getCircuit(agent);
  cb.failCount++;
  cb.lastFail = new Date().toISOString();
  if (cb.failCount >= CIRCUIT_FAIL_THRESHOLD) {
    cb.state = 'open';
    appendLog(`⚠️ Circuit OPEN for ${agent} (${cb.failCount} consecutive failures)`, 'error');
    appendAudit('circuit_open', 'system', { agent, failCount: cb.failCount });
  }
  flush();
}

function circuitRecordSuccess(agent) {
  const cb = getCircuit(agent);
  cb.failCount = 0;
  cb.state = 'closed';
  flush();
}

function circuitIsOpen(agent) {
  return getCircuit(agent).state === 'open';
}

// --- ETA Estimation ---

function estimateETA(taskType, currentPhaseIndex, totalPhases) {
  const history = loadHistory();
  const similar = history.filter(h => h.task && h.task.type === taskType);
  if (similar.length < 2) return null;

  // Average duration from similar tasks
  const durations = similar.map(h => {
    const start = new Date(h.task.startedAt || h.completedAt);
    const end = new Date(h.completedAt);
    return (end - start) / 1000; // seconds
  }).filter(d => d > 0);

  if (durations.length === 0) return null;

  const avgTotal = durations.reduce((a, b) => a + b, 0) / durations.length;
  const progress = totalPhases > 0 ? (currentPhaseIndex + 1) / totalPhases : 0.5;
  const remaining = avgTotal * (1 - progress);

  if (remaining < 60) return `${Math.round(remaining)}s`;
  if (remaining < 3600) return `${Math.round(remaining / 60)}m${Math.round(remaining % 60)}s`;
  return `${Math.round(remaining / 3600)}h${Math.round((remaining % 3600) / 60)}m`;
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

// --- Auto-dequeue ---

function tryDequeue() {
  if (state.currentTask) return; // busy
  if (state.taskQueue.length === 0) return; // nothing queued

  // Sort by priority
  state.taskQueue.sort((a, b) => (PRIORITY_ORDER[a.priority] || 1) - (PRIORITY_ORDER[b.priority] || 1));
  const next = state.taskQueue.shift();

  state.currentTask = {
    title: next.title,
    type: next.type,
    id: next.id,
    priority: next.priority,
    startedAt: new Date().toISOString(),
  };
  state.startedAt = new Date().toISOString();
  appendLog(`🔄 Auto-dequeued: ${next.title} [${next.priority}]`, 'info');
  appendAudit('task_auto_dequeue', 'system', { taskId: next.id, title: next.title });
  flush();
}

// --- Notifications (Phase 5.1) ---

function notify(message) {
  const webhookUrl = process.env.WEBHOOK_URL || process.env.AIC_WEBHOOK_URL;
  if (!webhookUrl) return;

  const url = new URL(webhookUrl);
  const payload = JSON.stringify({ content: message, text: message }); // Discord uses content, Slack uses text
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  };

  const client = url.protocol === 'https:' ? require('https') : http;
  const req = client.request(options, (res) => {
    // fire and forget
  });
  req.on('error', () => {}); // silent fail
  req.write(payload);
  req.end();
}

// --- Route dispatch ---

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Phase 5.5: Optional auth
  const apiKey = process.env.AIC_API_KEY;
  if (apiKey && req.url !== '/health' && !req.url.startsWith('/health')) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== apiKey) {
      return json(res, 401, { error: 'Unauthorized' });
    }
  }

  try {
    // --- GET routes ---

    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, port: Number(PORT) });
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      // Drain logs so client doesn't re-append the same entries each poll
      const logsOut = state.logs.slice();
      const logOut = state.log;
      state.logs = [];
      state.log = null;

      // ETA
      let eta = null;
      if (state.currentTask && state.phases.length > 0) {
        const currentPhase = state.phases.filter(p => p.status === 'complete').length;
        eta = estimateETA(state.currentTask.type, currentPhase, state.phases.length);
      }

      flush();
      return json(res, 200, {
        connected: state.connected,
        currentTask: state.currentTask,
        phases: state.phases,
        agents: state.agents,
        logs: logsOut,
        log: logOut,
        // Phase 1 additions
        queueLength: state.taskQueue.length,
        queue: state.taskQueue,
        circuitBreakers: state.circuitBreakers,
        // Phase 4: Cost
        tokens: state.tokens,
        cost: state.cost,
        // Phase 2: ETA
        eta,
        startedAt: state.startedAt,
      });
    }

    if (req.method === 'GET' && req.url === '/api/history') {
      return json(res, 200, loadHistory());
    }

    if (req.method === 'GET' && req.url === '/api/audit') {
      return json(res, 200, loadAudit());
    }

    if (req.method === 'GET' && req.url === '/api/analytics') {
      const history = loadHistory();
      const byType = {};
      for (const h of history) {
        const type = h.task ? h.task.type : 'unknown';
        if (!byType[type]) byType[type] = { count: 0, totalSeconds: 0, successes: 0 };
        byType[type].count++;
        if (h.task && h.task.startedAt && h.completedAt) {
          const dur = (new Date(h.completedAt) - new Date(h.task.startedAt)) / 1000;
          byType[type].totalSeconds += dur;
        }
        byType[type].successes++;
      }
      const analytics = {};
      for (const [type, data] of Object.entries(byType)) {
        const avg = data.count > 0 ? data.totalSeconds / data.count : 0;
        const avgStr = avg < 60 ? `${Math.round(avg)}s` : `${Math.round(avg/60)}m${Math.round(avg%60)}s`;
        analytics[type] = {
          count: data.count,
          avgTime: avgStr,
          avgSeconds: Math.round(avg),
          successRate: data.count > 0 ? Math.round((data.successes / data.count) * 100) / 100 : 0,
        };
      }
      return json(res, 200, analytics);
    }

    if (req.method === 'GET' && req.url === '/api/cost') {
      return json(res, 200, { tokens: state.tokens, cost: state.cost });
    }

    // --- POST routes ---

    if (req.method === 'POST' && req.url === '/api/task-start') {
      const data = await readBody(req);
      const priority = (data.priority || 'MEDIUM').toUpperCase();
      state.currentTask = {
        title: data.title || 'Unknown',
        type: data.type || 'feature',
        id: data.id || '',
        priority,
        startedAt: new Date().toISOString(),
      };
      state.startedAt = new Date().toISOString();
      appendLog(`Task started: ${state.currentTask.title} [${priority}]`, 'info');
      appendAudit('task_start', 'dispatcher', { taskId: data.id, title: data.title, type: data.type, priority });
      notify(`🚀 Task started: ${data.title} (${data.type})`);
      flush();
      return json(res, 200, { success: true });
    }

    // Phase 1.1: Task Queue
    if (req.method === 'POST' && req.url === '/api/task-enqueue') {
      const data = await readBody(req);
      const priority = (data.priority || 'MEDIUM').toUpperCase();
      const entry = {
        id: data.id || `TASK-${Date.now()}`,
        title: data.title || 'Unknown',
        type: data.type || 'feature',
        priority,
        queuedAt: new Date().toISOString(),
      };
      state.taskQueue.push(entry);
      state.taskQueue.sort((a, b) => (PRIORITY_ORDER[a.priority] || 1) - (PRIORITY_ORDER[b.priority] || 1));
      appendLog(`📥 Queued: ${entry.title} [${priority}] (position: ${state.taskQueue.length})`, 'info');
      appendAudit('task_enqueue', 'dispatcher', { taskId: entry.id, priority });
      flush();
      return json(res, 200, { success: true, position: state.taskQueue.length, queueLength: state.taskQueue.length });
    }

    // Phase 1.2: Task Cancellation
    if (req.method === 'POST' && req.url === '/api/task-cancel') {
      const data = await readBody(req);
      const cancelledId = data.id || (state.currentTask ? state.currentTask.id : null);
      const title = state.currentTask ? state.currentTask.title : 'Unknown';

      // Save to history as cancelled
      if (state.currentTask) {
        const history = loadHistory();
        history.push({
          task: state.currentTask,
          completedAt: new Date().toISOString(),
          status: 'cancelled',
          phases: state.phases,
          agents: state.agents,
        });
        if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
        saveHistory(history);
      }

      // Reset task state
      state.currentTask = null;
      state.phases = [];
      state.agents = {};
      state.tokens = { input: 0, output: 0 };
      state.cost = 0;
      state.startedAt = null;

      appendLog(`❌ Task cancelled: ${title}`, 'warning');
      appendAudit('task_cancel', 'dispatcher', { taskId: cancelledId, title });
      notify(`❌ Task cancelled: ${title}`);

      // Try dequeue next
      tryDequeue();
      flush();
      return json(res, 200, { success: true, cancelledId, nextTask: state.currentTask });
    }

    if (req.method === 'POST' && req.url === '/api/phase-start') {
      const data = await readBody(req);
      state.phases.push({ name: data.name || 'Unknown', status: data.status || 'pending', startedAt: new Date().toISOString() });
      appendLog(`Phase started: ${data.name}`, 'info');
      appendAudit('phase_start', 'dispatcher', { phase: data.name });
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/phase-complete') {
      if (state.phases.length > 0) {
        state.phases[state.phases.length - 1].status = 'complete';
        state.phases[state.phases.length - 1].completedAt = new Date().toISOString();
      }
      appendLog('Phase completed', 'success');
      appendAudit('phase_complete', 'dispatcher', { phase: state.phases[state.phases.length - 1]?.name });
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/agent-status') {
      const data = await readBody(req);
      const agent = data.agent || 'unknown';
      const agentStatus = data.status || 'idle';
      const entry = { status: agentStatus };
      if (data.engine) entry.engine = data.engine;
      if (data.tier) entry.tier = data.tier;
      if (data.parent) entry.parent = data.parent; // Phase 4.1: sub-worker tree
      state.agents[agent] = entry;

      // Circuit breaker: track failures
      if (agentStatus === 'error' || agentStatus === 'failed') {
        circuitRecordFailure(agent);
      } else if (agentStatus === 'complete' || agentStatus === 'idle') {
        circuitRecordSuccess(agent);
      }

      const msgType = agentStatus === 'working' ? 'warning' : agentStatus === 'complete' ? 'success' : 'info';
      const engineStr = data.engine ? ` [${data.engine}]` : '';
      appendLog(`Agent ${agent}: ${agentStatus}${engineStr}`, msgType);
      appendAudit('agent_status', agent, { status: agentStatus, engine: data.engine });
      flush();
      return json(res, 200, { success: true });
    }

    // Phase 4.2: Cost tracking
    if (req.method === 'POST' && req.url === '/api/tokens') {
      const data = await readBody(req);
      const input = data.input || 0;
      const output = data.output || 0;
      state.tokens.input += input;
      state.tokens.output += output;
      // Rough cost estimate ($0.01 per 1K input, $0.03 per 1K output — adjust per provider)
      const inputCost = (input / 1000) * 0.01;
      const outputCost = (output / 1000) * 0.03;
      state.cost += inputCost + outputCost;
      state.cost = Math.round(state.cost * 100) / 100;
      appendLog(`📊 Tokens: +${input}in/+${output}out (total: $${state.cost})`, 'info');
      flush();
      return json(res, 200, { success: true, tokens: state.tokens, cost: state.cost });
    }

    if (req.method === 'POST' && req.url === '/api/log') {
      const data = await readBody(req);
      appendLog(data.message || 'Unknown', data.type || 'info');
      flush();
      return json(res, 200, { success: true });
    }

    if (req.method === 'POST' && req.url === '/api/task-complete') {
      const title = state.currentTask ? state.currentTask.title : 'Unknown';
      const startedAt = state.startedAt;
      const completedAt = new Date().toISOString();

      // Duration
      let duration = null;
      if (startedAt) {
        const secs = (new Date(completedAt) - new Date(startedAt)) / 1000;
        duration = secs < 60 ? `${Math.round(secs)}s` : `${Math.round(secs/60)}m${Math.round(secs%60)}s`;
      }

      // Append to history before resetting
      const history = loadHistory();
      history.push({
        task: { ...state.currentTask, startedAt },
        completedAt,
        status: 'complete',
        duration,
        phases: state.phases,
        agents: state.agents,
        tokens: { ...state.tokens },
        cost: state.cost,
      });
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
      saveHistory(history);

      // Reset task state
      state.currentTask = null;
      state.phases = [];
      state.agents = {};
      state.tokens = { input: 0, output: 0 };
      state.cost = 0;
      state.startedAt = null;

      appendLog(`✅ Task completed: ${title}${duration ? ` (${duration})` : ''}`, 'success');
      appendAudit('task_complete', 'system', { title, duration });
      notify(`✅ Task completed: ${title}${duration ? ` (${duration})` : ''}`);

      // Auto-dequeue next
      tryDequeue();
      flush();
      return json(res, 200, { success: true, duration, nextTask: state.currentTask });
    }

    if (req.method === 'POST' && req.url === '/api/reset') {
      const logs = state.logs.slice();
      state = defaultState();
      state.logs = logs;
      appendLog('Status reset', 'info');
      appendAudit('reset', 'dispatcher', {});
      flush();
      return json(res, 200, { success: true });
    }

    // Backward compat: old POST /api/status
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
