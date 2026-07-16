'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.join(__dirname, '..');
const STATE_FILE = path.join(SKILL_DIR, '.aic', 'state.json');
const METRICS_FILE = path.join(SKILL_DIR, '.aic', 'metrics.json');
const LATENCY_METRICS_FILE = path.join(SKILL_DIR, '.aic', 'latency_metrics.json');
const TASKS_DIR = path.join(SKILL_DIR, '.aic', 'tasks');
const ENV_FILE = path.join(SKILL_DIR, '.env');
const LOG_FILE = path.join(SKILL_DIR, '.aic', 'logs', 'app.log');
const HEALTH_FILE = path.join(SKILL_DIR, '.aic', 'health.json');
const QUEUE_FILE = path.join(SKILL_DIR, '.aic', 'queue.json');
const AUDIT_LOG = path.join(SKILL_DIR, '.aic', 'audit.log');
const PID_FILE = path.join(SKILL_DIR, '.aic', 'server.pid');

const LATENCY_RING_MAX = 500;
const SLO_API_P99_MS = 250;
const ERROR_BUDGET_PCT = 1;

const WORKERS = [
  'pm', 'architect', 'research', 'frontend', 'backend', 'qa',
  'designer', 'infra', 'security', 'perf', 'data', 'integration',
  'documentation', 'governor', 'dispatcher',
];

// Lifecycle enforcement — phase → allowed workers
const PHASE_ALLOWED = {
  investigate:    ['pm', 'research'],
  planning:       ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra', 'designer'],
  implementation: ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra', 'designer', 'frontend', 'backend'],
  verification:   ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra', 'designer', 'frontend', 'backend', 'qa', 'perf'],
  closeout:       ['pm', 'research', 'architect', 'data', 'integration', 'security', 'infra', 'designer', 'frontend', 'backend', 'qa', 'perf', 'documentation', 'governor'],
};

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

function getActiveProject() {
  const env = loadEnv();
  return {
    path: env.AIC_ACTIVE_PROJECT || env.AIC_PROJECT_DIR || '',
    name: env.AIC_ACTIVE_PROJECT_NAME || '',
    workspace: env.AIC_PROJECT_DIR || '',
  };
}

function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(path.join(SKILL_DIR, '.aic', 'credentials.json'), 'utf8'));
  } catch { return {}; }
}

function parseAllowedOrigins() {
  const raw = (process.env.AIC_CORS_ORIGINS || '').trim();
  if (!raw) return null;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

module.exports = {
  SKILL_DIR,
  STATE_FILE,
  METRICS_FILE,
  LATENCY_METRICS_FILE,
  TASKS_DIR,
  ENV_FILE,
  LOG_FILE,
  HEALTH_FILE,
  QUEUE_FILE,
  AUDIT_LOG,
  PID_FILE,
  LATENCY_RING_MAX,
  SLO_API_P99_MS,
  ERROR_BUDGET_PCT,
  WORKERS,
  PHASE_ALLOWED,
  loadEnv,
  getActiveProject,
  loadCredentials,
  parseAllowedOrigins,
};
