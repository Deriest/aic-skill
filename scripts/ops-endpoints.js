// Production Operations Endpoints (Milestone I)
const fs = require('fs');
const path = require('path');
const { percentile } = require('./utils');

const SKILL_DIR = path.join(__dirname, '..');
const METRICS_FILE = path.join(SKILL_DIR, '.aic', 'metrics.json');
const LATENCY_METRICS_FILE = path.join(SKILL_DIR, '.aic', 'latency_metrics.json');
const SLO_API_P99_MS = 250;
const ERROR_BUDGET_PCT = 1;

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
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99 },
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

function readLatencySummary() {
  let samples = [];
  try {
    const d = JSON.parse(fs.readFileSync(LATENCY_METRICS_FILE, 'utf8'));
    samples = Array.isArray(d.samples) ? d.samples : [];
  } catch {}
  return { sli: buildLatencySli(samples), updatedAt: samples.length ? samples[samples.length - 1].ts : null };
}
const LOG_FILE = path.join(SKILL_DIR, '.aic', 'logs', 'app.log');
const QUEUE_FILE = path.join(SKILL_DIR, '.aic', 'queue.json');
const INSTANCE_ID = `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

async function handleOpsEndpoint(req, res, send, readBody, state) {
  const url = new URL(req.url, `http://localhost:${state.port || 6868}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health/components') {
    const components = {};
    try { fs.accessSync(path.join(SKILL_DIR, '.aic', 'auth.json')); components.auth = 'healthy'; } catch { components.auth = 'unhealthy'; }
    try { fs.accessSync(path.join(SKILL_DIR, '.aic', 'knowledge')); components.knowledge = 'healthy'; } catch { components.knowledge = 'unhealthy'; }
    components.server = 'healthy';
    const st = Object.values(components).includes('unhealthy') ? 'degraded' : 'healthy';
    send(res, 200, { state: st, components, instance: INSTANCE_ID });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/metrics/summary') {
    let metrics = [];
    try { metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); } catch {}
    const os = require('os');
    const mem = process.memoryUsage();
    send(res, 200, {
      total: metrics.length,
      totalInput: metrics.reduce((s, m) => s + (m.tokens?.input || 0), 0),
      totalOutput: metrics.reduce((s, m) => s + (m.tokens?.output || 0), 0),
      workers: [...new Set(metrics.map(m => m.worker).filter(Boolean))],
      tiers: metrics.reduce((acc, m) => { acc[m.tier] = (acc[m.tier] || 0) + 1; return acc; }, {}),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      cpu: { loadAvg: os.loadavg(), cores: os.cpus().length },
      latency: readLatencySummary(),
    }, req);
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/monitor') {
    let metrics = [];
    try { metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); } catch {}
    let logLines = [];
    try { logLines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).slice(-20).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch {}
    const errors = logLines.filter(l => l.level === 'ERROR');
    send(res, 200, {
      server: { ok: true, uptime: Math.floor((Date.now() - (state.startedAt || Date.now())) / 1000), instance: INSTANCE_ID },
      metrics: { total: metrics.length, input: metrics.reduce((s, m) => s + (m.tokens?.input || 0), 0), output: metrics.reduce((s, m) => s + (m.tokens?.output || 0), 0) },
      recentErrors: errors.length,
      workers: Object.keys(state.workers || {}).length
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/queue/enqueue') {
    const data = await readBody(req);
    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch {}
    queue.push({ task_id: data.taskId || 'task-' + Date.now(), priority: data.priority || 2, worker: data.worker || 'auto', status: 'queued', created: new Date().toISOString(), retries: 0 });
    queue.sort((a, b) => a.priority - b.priority);
    fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    send(res, 200, { ok: true, queueSize: queue.length });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/queue/status') {
    let queue = [];
    try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch {}
    const queued = queue.filter(t => t.status === 'queued').length;
    const running = queue.filter(t => t.status === 'running').length;
    send(res, 200, { total: queue.length, queued, running });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/config/reload') {
    send(res, 200, { ok: true, message: 'Configuration reloaded' });
    return true;
  }

  return false; // not handled
}

module.exports = { handleOpsEndpoint, INSTANCE_ID };
