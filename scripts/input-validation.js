'use strict';

// Input validation middleware for AIC API
// Validates request bodies at trust boundaries

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function sanitizeString(val, { maxLen = 1000, allowEmpty = false } = {}) {
  if (val === undefined || val === null) return allowEmpty ? '' : null;
  const s = String(val).trim();
  if (!allowEmpty && s.length === 0) return null;
  if (s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

function sanitizeTaskId(val) {
  const s = String(val || '').trim();
  if (!/^TASK-[A-Za-z0-9_-]{1,64}$/.test(s)) return null;
  return s;
}

function sanitizeIntent(val) {
  const allowed = ['task.create', 'task.start', 'task.pause', 'task.resume', 'task.cancel', 'task.retry'];
  const s = String(val || '').trim().toLowerCase();
  return allowed.includes(s) ? s : null;
}

function validateTaskCreate(data) {
  const errors = [];
  const title = sanitizeString(data.title, { maxLen: 200 });
  if (!title) errors.push('title required (40+ chars for pipeline)');
  const description = sanitizeString(data.description, { maxLen: 10000, allowEmpty: true });
  const projectDir = sanitizeString(data.projectDir, { maxLen: 500, allowEmpty: true });
  const id = data.id ? sanitizeTaskId(data.id) : undefined;
  if (data.id && !id) errors.push('id must match TASK-* pattern');
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { title, description, projectDir, id } };
}

function validateIntent(data) {
  const intent = sanitizeIntent(data.intent);
  if (!intent) return { ok: false, errors: ['invalid intent: ' + (data.intent || '(empty)')] };
  const taskId = data.taskId ? sanitizeTaskId(data.taskId) : undefined;
  if (data.taskId && !taskId) return { ok: false, errors: ['taskId must match TASK-* pattern'] };
  const phase = sanitizeString(data.phase, { maxLen: 30, allowEmpty: true });
  return { ok: true, data: { intent, taskId, phase } };
}

function validateLease(data) {
  const errors = [];
  const taskId = sanitizeTaskId(data.taskId);
  if (!taskId) errors.push('taskId required (TASK-*)');
  const worker = sanitizeString(data.worker, { maxLen: 50 });
  if (!worker) errors.push('worker required');
  const tier = sanitizeString(data.tier, { maxLen: 20 });
  if (!tier) errors.push('tier required');
  const projectDir = sanitizeString(data.projectDir, { maxLen: 500, allowEmpty: true });
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { taskId, worker, tier, projectDir } };
}

function validateMetrics(data) {
  const worker = sanitizeString(data.worker, { maxLen: 50 });
  const tier = sanitizeString(data.tier, { maxLen: 20 });
  const model = sanitizeString(data.model, { maxLen: 100, allowEmpty: true });
  const tokens = data.tokens && typeof data.tokens === 'object' ? data.tokens : {};
  const durationSec = typeof data.durationSec === 'number' ? Math.max(0, data.durationSec) : 0;
  return { ok: true, data: { worker: worker || 'unknown', tier: tier || 'unknown', model, tokens, durationSec } };
}

function validateBodySize(body) {
  if (!body) return true;
  const size = typeof body === 'string' ? body.length : JSON.stringify(body).length;
  return size <= MAX_BODY_SIZE;
}

module.exports = {
  sanitizeString, sanitizeTaskId, sanitizeIntent,
  validateTaskCreate, validateIntent, validateLease, validateMetrics,
  validateBodySize, MAX_BODY_SIZE,
};
