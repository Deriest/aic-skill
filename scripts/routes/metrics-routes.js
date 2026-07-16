'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonSafe } = require('../atomic-write');
const { percentile, readBody } = require('../utils');

function handleMetricsRoutes(req, res, send, ctx) {
  const { metricsFile, latencyMetricsFile, recordApiLatency, getLatencyMetricsSummary } = ctx;
  const { method, url } = req;
  const pathname = url.pathname;

  // GET /api/metrics
  if (method === 'GET' && pathname === '/api/metrics') {
    try {
      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');
      const tierParam = url.searchParams.get('tier') || 'all';

      let metrics = [];
      if (fs.existsSync(metricsFile)) {
        metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      }

      if (fromParam) {
        const fromDate = new Date(fromParam);
        metrics = metrics.filter(m => new Date(m.timestamp) >= fromDate);
      }
      if (toParam) {
        const toDate = new Date(toParam);
        toDate.setHours(23, 59, 59, 999);
        metrics = metrics.filter(m => new Date(m.timestamp) <= toDate);
      }
      if (tierParam !== 'all') {
        metrics = metrics.filter(m => m.tier === tierParam);
      }

      const summary = {
        totalRequests: metrics.length,
        totalInput: metrics.reduce((sum, m) => sum + (m.tokens?.input || 0), 0),
        totalOutput: metrics.reduce((sum, m) => sum + (m.tokens?.output || 0), 0),
        totalCache: metrics.reduce((sum, m) => sum + (m.tokens?.cacheRead || 0), 0),
        cacheHitRate: 0,
        byWorker: {},
        byDay: {},
      };

      if (summary.totalInput + summary.totalOutput > 0) {
        summary.cacheHitRate = summary.totalCache / (summary.totalCache + summary.totalInput);
      }

      for (const m of metrics) {
        if (!summary.byWorker[m.worker]) {
          summary.byWorker[m.worker] = { requests: 0, input: 0, output: 0, cache: 0 };
        }
        summary.byWorker[m.worker].requests++;
        summary.byWorker[m.worker].input += m.tokens?.input || 0;
        summary.byWorker[m.worker].output += m.tokens?.output || 0;
        summary.byWorker[m.worker].cache += m.tokens?.cacheRead || 0;
      }

      for (const m of metrics) {
        const day = m.timestamp.slice(0, 10);
        if (!summary.byDay[day]) {
          summary.byDay[day] = { requests: 0, input: 0, output: 0, cache: 0 };
        }
        summary.byDay[day].requests++;
        summary.byDay[day].input += m.tokens?.input || 0;
        summary.byDay[day].output += m.tokens?.output || 0;
        summary.byDay[day].cache += m.tokens?.cacheRead || 0;
      }

      try {
        const os = require('os');
        const mem = process.memoryUsage();
        summary.memory = { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal };
        summary.cpu = { loadAvg: os.loadavg(), cores: os.cpus().length };
      } catch(e) {}

      const COST_PER_INPUT = 0.000003;
      const COST_PER_OUTPUT = 0.000015;
      summary.cost = {
        input: +(summary.totalInput * COST_PER_INPUT).toFixed(4),
        output: +(summary.totalOutput * COST_PER_OUTPUT).toFixed(4),
        total: +((summary.totalInput * COST_PER_INPUT) + (summary.totalOutput * COST_PER_OUTPUT)).toFixed(4),
        currency: 'USD',
      };
      summary.latency = getLatencyMetricsSummary();
      return send(res, 200, { metrics, summary }, req), true;
    } catch (err) {
      return send(res, 500, { error: err.message }), true;
    }
  }

  // POST /api/metrics
  if (method === 'POST' && pathname === '/api/metrics') {
    return (async () => {
      const data = await readBody(req);
      try {
        const metric = {
          id: `metric-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          worker: data.worker,
          tier: data.tier,
          model: data.model,
          taskId: data.taskId,
          tokens: data.tokens || { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          durationSec: data.durationSec || 0,
        };

        let metrics = [];
        if (fs.existsSync(metricsFile)) {
          metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
        }
        metrics.push(metric);
        writeJsonSafe(metricsFile, metrics);
        send(res, 200, { success: true, metric }); return true;
      } catch (err) {
        send(res, 500, { error: err.message }); return true;
      }
    })();
  }

  // GET /api/engineering-metrics
  if (method === 'GET' && pathname === '/api/engineering-metrics') {
    const emPath = path.join(ctx.skillDir, '.aic', 'engineering-metrics.json');
    if (fs.existsSync(emPath)) {
      send(res, 200, JSON.parse(fs.readFileSync(emPath, 'utf8'))); return true;
    }
    send(res, 200, { pipeline: {}, worker: {}, consistency: {}, execution_plan: {}, artifacts: {}, history: [] }); return true;
  }

  // GET /api/engineering-patterns
  if (method === 'GET' && pathname === '/api/engineering-patterns') {
    const epPath = path.join(ctx.skillDir, '.aic', 'engineering-patterns.json');
    if (fs.existsSync(epPath)) {
      send(res, 200, JSON.parse(fs.readFileSync(epPath, 'utf8'))); return true;
    }
    send(res, 200, []); return true;
  }

  // GET /api/postmortem/:taskId
  if (method === 'GET' && pathname.startsWith('/api/postmortem/')) {
    const taskId = pathname.split('/api/postmortem/')[1];
    if (taskId) {
      const pmPath = path.join(ctx.skillDir, '.aic', 'tasks', taskId, 'reports', 'postmortem-report.md');
      if (fs.existsSync(pmPath)) {
        send(res, 200, { task_id: taskId, report: fs.readFileSync(pmPath, 'utf8') }); return true;
      }
      send(res, 404, { error: 'postmortem not found' }); return true;
    }
  }

  return false;
}

module.exports = { handleMetricsRoutes };
