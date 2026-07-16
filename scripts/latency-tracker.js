'use strict';

const fs = require('fs');
const { writeJsonSafe } = require('./atomic-write');
const { percentile } = require('./utils');

function createLatencyTracker({ metricsFile, ringMax, sloP99Ms, errorBudgetPct }) {
  const ring = [];

  function record(entry) {
    ring.push(entry);
    if (ring.length > ringMax) ring.shift();
    let store = { samples: [], updatedAt: null };
    try {
      if (fs.existsSync(metricsFile)) {
        store = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      }
    } catch {}
    if (!Array.isArray(store.samples)) store.samples = [];
    store.samples.push(entry);
    if (store.samples.length > ringMax) store.samples = store.samples.slice(-ringMax);
    store.updatedAt = entry.ts;
    try { writeJsonSafe(metricsFile, store); } catch {}
  }

  function buildSli(samples) {
    const api = samples.filter(s => s.kind === 'api');
    const latencies = api.map(s => s.latencyMs).sort((a, b) => a - b);
    const total = api.length;
    const errors = api.filter(s => s.status >= 500).length;
    const errorRate = total ? errors / total : 0;
    const budgetConsumedPct = total ? Math.min(100, (errorRate / (errorBudgetPct / 100)) * 100) : 0;
    const p99 = percentile(latencies, 99);
    return {
      windowSamples: total,
      latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99 },
      errorRate: +errorRate.toFixed(4),
      slo: {
        apiP99TargetMs: sloP99Ms,
        apiP99Met: total === 0 || p99 <= sloP99Ms,
        errorBudgetPct,
        errorBudgetConsumedPct: +budgetConsumedPct.toFixed(2),
        errorBudgetRemainingPct: +Math.max(0, 100 - budgetConsumedPct).toFixed(2),
      },
    };
  }

  function getSummary() {
    const samples = ring.length ? ring : (() => {
      try {
        const d = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
        return Array.isArray(d.samples) ? d.samples : [];
      } catch { return []; }
    })();
    return { sli: buildSli(samples), updatedAt: samples.length ? samples[samples.length - 1].ts : null };
  }

  return { record, getSummary };
}

module.exports = { createLatencyTracker };
