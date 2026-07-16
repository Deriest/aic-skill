'use strict';

const fs = require('fs');
// TTL cache for filesystem reads (CR-O1, CR-O3)
const _fsCache = new Map();
function _cachedRead(fp, ttlMs = 5000) {
  const now = Date.now();
  const e = _fsCache.get(fp);
  // TTL + mtime check: invalidate if file changed on disk
  if (e && now - e.ts < ttlMs) {
    try {
      const st = fs.statSync(fp);
      if (st.mtimeMs === e.mtime) return e.data;
    } catch {}
  }
  try {
    const data = fs.readFileSync(fp, 'utf8');
    const mtime = fs.statSync(fp).mtimeMs;
    _fsCache.set(fp, { data, ts: now, mtime });
    return data;
  } catch { return null; }
}
function _cachedJson(fp, ttlMs = 5000) {
  const raw = _cachedRead(fp, ttlMs);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const path = require('path');

function createObservability(opts) {
  const { skillDir, tasksDir, getState, getEventStore, getContracts } = opts;

  function buildRuntimeSnapshot() {
    const state = getState();
    const store = getEventStore();
    const project = _getProject();

    // Workers with lease info
    const workers = {};
    const leases = state.engine?.leases || {};
    for (const [id, w] of Object.entries(state.workers || {})) {
      let leaseId = null, leaseStatus = null;
      for (const [lid, lease] of Object.entries(leases)) {
        if (lease.worker === id && (lease.status === 'active' || lease.status === 'complete')) {
          leaseId = lid;
          leaseStatus = lease.status;
          break;
        }
      }
      workers[id] = {
        status: w.status,
        leaseId,
        leaseStatus,
        taskId: w.currentTask || null,
      };
    }

    // Active task
    const ct = state.currentTask;
    const activeTask = ct ? {
      id: ct.id,
      title: ct.title,
      type: ct.type || 'feature',
      pipelineState: ct.pipelineState,
      phaseStatus: ct.phaseStatus,
      startedAt: ct.startedAt || null,
    } : null;

    // Pipeline
    let cp = null;
    if (ct?.id) {
      try {
        cp = _cachedJson(path.join(tasksDir, ct.id, 'checkpoint.json'));
      } catch {}
    }
    const pipeline = {
      currentPhase: state.currentPhase || null,
      phaseStatus: cp?.phaseStatus || ct?.phaseStatus || null,
      barrier: cp?.phaseBarrier || state.phaseBarrier || null,
      runtimeGate: state.runtimeGate || null,
      pmReview: state.pmReview || null,
      rework: state.rework || null,
    };

    // Lease registry
    const leaseRegistry = {};
    for (const [lid, lease] of Object.entries(leases)) {
      leaseRegistry[lid] = {
        worker: lease.worker,
        taskId: lease.taskId,
        status: lease.status,
        issuedAt: lease.issuedAt || null,
        completedAt: lease.completedAt || null,
        exitCode: lease.exitCode ?? null,
      };
    }

    // Knowledge
    const knowledge = _getKnowledgeStatus();

    // Health
    const health = _getHealthStatus();

    // Metrics
    const metrics = _getMetrics();

    // Recent events
    const events = store ? store.recent(50).map(e => ({
      ts: e.ts,
      type: e.type,
      taskId: e.taskId || null,
      phase: e.phase || null,
      data: e.data || {},
    })) : (state.engine?.events || []);

    return {
      engine: {
        paused: !!state.engine?.paused,
        pipelineRunning: !!state.engine?.pipelineRunning,
        uptime: Math.floor((Date.now() - (state.startedAt || Date.now())) / 1000),
      },
      activeTask,
      workers,
      leases: leaseRegistry,
      pipeline,
      knowledge,
      health,
      metrics,
      events,
      project,
    };
  }

  function getWorkerDetail(workerId) {
    const state = getState();
    const w = state.workers?.[workerId];
    if (!w) return null;
    const leases = state.engine?.leases || {};
    const workerLeases = [];
    for (const [lid, lease] of Object.entries(leases)) {
      if (lease.worker === workerId) {
        workerLeases.push({ id: lid, ...lease });
      }
    }
    return {
      id: workerId,
      status: w.status,
      engine: w.engine || null,
      currentTask: w.currentTask || null,
      subWorkers: w.subWorkers || [],
      leases: workerLeases,
    };
  }

  function getTaskPipeline(taskId) {
    let cp = null;
    try {
      cp = JSON.parse(fs.readFileSync(path.join(tasksDir, taskId, 'checkpoint.json'), 'utf8'));
    } catch {}
    if (!cp) return null;
    const store = getEventStore();
    const taskEvents = store ? store.query({ taskId, limit: 200 }).events : [];
    return {
      taskId,
      pipelineState: cp.pipelineState,
      phaseStatus: cp.phaseStatus,
      barrier: cp.phaseBarrier || null,
      pmReview: cp.pmReview || null,
      rework: cp.rework || null,
      events: taskEvents,
    };
  }

  function getTaskKnowledge(taskId) {
    const kDir = path.join(skillDir, '.aic', 'knowledge');
    const entriesFile = path.join(kDir, 'task-entries.json');
    try {
      const entries = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
      const entry = Array.isArray(entries) ? entries.find(e => e.taskId === taskId) : null;
      if (!entry) return null;
      return { taskId, ...entry };
    } catch { return null; }
  }

  function getTaskArtifacts(taskId) {
    const reportDir = path.join(tasksDir, taskId, 'reports');
    try {
      const files = fs.readdirSync(reportDir);
      const artifacts = files.filter(f => f.endsWith('.md')).map(f => {
        const fp = path.join(reportDir, f);
        const stat = fs.statSync(fp);
        return { filename: f, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
      });
      return { taskId, artifacts };
    } catch { return null; }
  }

  function _getProject() {
    try {
      const env = _loadEnv();
      return { path: env.AIC_ACTIVE_PROJECT || env.AIC_PROJECT_DIR || '', name: env.AIC_ACTIVE_PROJECT_NAME || '' };
    } catch { return { path: '', name: '' }; }
  }

  function _loadEnv() {
    const envFile = path.join(skillDir, '.env');
    const env = {};
    try {
      for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq > 0) env[t.slice(0, eq)] = t.slice(eq + 1);
      }
    } catch {}
    return env;
  }

  function _getKnowledgeStatus() {
    const kDir = path.join(skillDir, '.aic', 'knowledge');
    const entriesFile = path.join(kDir, 'task-entries.json');
    try {
      if (!fs.existsSync(kDir)) return { initialized: false, entryCount: 0, lastUpdated: null };
      const entries = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
      const count = Array.isArray(entries) ? entries.length : 0;
      const last = count > 0 ? entries[count - 1].generatedAt || null : null;
      return { initialized: count > 0, entryCount: count, lastUpdated: last };
    } catch { return { initialized: false, entryCount: 0, lastUpdated: null }; }
  }

  function _getHealthStatus() {
    try {
      const hf = path.join(skillDir, '.aic', 'health.json');
      const history = _cachedJson(hf);
      if (Array.isArray(history) && history.length > 0) {
        const latest = history[history.length - 1];
        return { ...latest.components, state: latest.state, lastCheck: latest.ts };
      }
    } catch {}
    return { state: 'unknown', server: 'unknown', auth: 'unknown', knowledge: 'unknown', filesystem: 'unknown', lastCheck: null };
  }

  function _getMetrics() {
    try {
      const mf = path.join(skillDir, '.aic', 'metrics.json');
      return _cachedJson(mf) || {};
    } catch { return {}; }
  }

  return { buildRuntimeSnapshot, getWorkerDetail, getTaskPipeline, getTaskKnowledge, getTaskArtifacts };
}

module.exports = { createObservability };
