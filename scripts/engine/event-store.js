'use strict';

const fs = require('fs');
const path = require('path');

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ARCHIVES = 5;

function createEventStore(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  let _appendCount = 0;
  function append(event) {
    const entry = {
      ts: new Date().toISOString(),
      type: event.type || 'unknown',
      taskId: event.taskId || null,
      phase: event.phase || null,
      data: event.data || {},
    };
    try {
      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
      if (++_appendCount % 100 === 0) rotateIfNeeded();
    } catch (err) {
      console.error('[event-store] append failed:', err.message);
    }
    return entry;
  }

  function rotateIfNeeded() {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size < MAX_FILE_BYTES) return;
      const ts = Date.now().toString(36);
      const archive = filePath.replace('.jsonl', `.${ts}.jsonl`);
      fs.renameSync(filePath, archive);
      // Prune old archives
      const dir = path.dirname(filePath);
      const base = path.basename(filePath, '.jsonl');
      const archives = fs.readdirSync(dir)
        .filter(f => f.startsWith(base + '.') && f.endsWith('.jsonl') && f !== path.basename(filePath))
        .sort();
      while (archives.length > MAX_ARCHIVES) {
        const old = archives.shift();
        try { fs.unlinkSync(path.join(dir, old)); } catch {}
      }
    } catch {}
  }

  function query(opts = {}) {
    const { limit = 50, taskId, phase, type } = opts;
    const lines = readAll();
    let filtered = lines;
    if (taskId) filtered = filtered.filter(e => e.taskId === taskId);
    if (phase) filtered = filtered.filter(e => e.phase === phase);
    if (type) filtered = filtered.filter(e => e.type === type);
    const total = filtered.length;
    const slice = filtered.slice(-limit);
    return { events: slice, total, hasMore: total > limit };
  }

  function readAll() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      const events = [];
      for (const line of lines) {
        try { events.push(JSON.parse(line)); } catch {} // skip corrupted lines
      }
      return events;
    } catch { return []; }
  }

  function recent(limit = 50) {
    const all = readAll();
    return all.slice(-limit);
  }

  return { append, query, recent, readAll };
}

module.exports = { createEventStore };
