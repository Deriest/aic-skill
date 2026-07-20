'use strict';

const os = require('os');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { readBody } = require('../utils');

function fetchUpstreamModelsJson(baseURL, apiKey) {
  const raw = String(baseURL || '').trim();
  if (!raw) return Promise.reject(new Error('baseURL required'));
  const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  const modelsUrl = `${base}/models`;
  const u = new URL(modelsUrl);
  // D-dispatcher-06: SSRF protection — block internal/private addresses
  const hostname = u.hostname.toLowerCase();
  const isPrivate = (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    (hostname.startsWith('172.') && (() => { const o = parseInt(hostname.split('.')[1], 10); return o >= 16 && o <= 31; })()) ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('fc00:') ||
    hostname.startsWith('fe80:')
  );
  if (isPrivate) return Promise.reject(new Error('baseURL cannot target internal/private addresses'));
  const lib = u.protocol === 'https:' ? https : http;
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers,
      timeout: 20000,
    }, (upstream) => {
      let body = '';
      upstream.on('data', (c) => { body += c; });
      upstream.on('end', () => {
        if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
          return reject(new Error(`Upstream HTTP ${upstream.statusCode}`));
        }
        try { resolve(JSON.parse(body || '{}')); }
        catch (e) { reject(new Error('Invalid JSON from upstream')); }
      });
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Upstream timeout')); });
    req.end();
  });
}

async function handlePublicRoutes(req, res, send, ctx) {
  const { method, url } = req;
  const pathname = url.pathname;
  const { state, port, getRuntimeEngine, getActiveProject, skillDir, auth } = ctx;

  // Health (no auth)
  if (method === 'GET' && pathname === '/health') {
    send(res, 200, { ok: true, port, uptime: Math.floor((Date.now() - state.startedAt) / 1000) });
    return true;
  }

  // Status (no auth)
  if (method === 'GET' && pathname === '/api/status') {
    send(res, 200, getRuntimeEngine().buildSnapshot());
    return true;
  }

  // Version (no auth)
  if (method === 'GET' && pathname === '/api/version') {
    send(res, 200, { version: '4.0.1', milestone: 'K' }); // D-04: match SKILL.md baseline
    return true;
  }

  // Project (no auth)
  if (method === 'GET' && pathname === '/api/project') {
    send(res, 200, getActiveProject());
    return true;
  }

  // Pipeline status (no auth)
  if (method === 'GET' && pathname === '/api/pipeline/status') {
    const tasksDir = path.join(skillDir, '.aic', 'tasks');
    const phases = [];
    try {
      for (const d of fs.readdirSync(tasksDir)) {
        const sf = path.join(tasksDir, d, 'state.json');
        if (fs.existsSync(sf)) {
          const s = JSON.parse(fs.readFileSync(sf, 'utf8'));
          phases.push({ id: s.id, phase: s.phase, status: s.status, description: s.description });
        }
      }
    } catch {}
    send(res, 200, { phases, current: phases.find(p => p.status === 'running') || null });
    return true;
  }

  // Model proxy (no auth)
  if (method === 'POST' && pathname === '/api/models') {
    const data = await readBody(req);
    const baseURL = String(data.baseURL || '').trim();
    const apiKey = String(data.apiKey || '').trim();
    if (!baseURL) { send(res, 400, { error: 'baseURL required' }, req); return true; }
    try {
      const result = await fetchUpstreamModelsJson(baseURL, apiKey);
      send(res, 200, result, req);
    } catch (err) {
      send(res, 502, { error: err.message || 'Upstream fetch failed' }, req);
    }
    return true;
  }

  // Config GET (D-15: dashboard needs read access without auth)
  if (method === 'GET' && pathname === '/api/config') {
    const envPath = path.join(skillDir, '.env');
    const openCodePath = path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc');
    const project = getActiveProject();
    send(res, 200, {
      env: fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '',
      opencode: fs.existsSync(openCodePath) ? fs.readFileSync(openCodePath, 'utf8') : '',
      project,
    });
    return true;
  }

  // Config POST (requires auth)
  if (method === 'POST' && pathname === '/api/config') {
    if (!ctx.auth.requireAuth(req, res)) return true;
    const data = await readBody(req);
    const envPath = path.join(skillDir, '.env');
    const openCodePath = path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc');
    try {
      if (data.env !== undefined) fs.writeFileSync(envPath, data.env);
      if (data.opencode !== undefined) fs.writeFileSync(openCodePath, data.opencode);
      send(res, 200, { success: true });
    } catch (err) {
      send(res, 500, { error: err.message });
    }
    return true;
  }

  // Auth management (protected)
  if (pathname.startsWith('/api/auth')) {
    if (!auth.requireAuth(req, res)) return true;
    if (method === 'POST' && pathname === '/api/auth/keys') {
      const data = await readBody(req);
      const key = auth.addApiKey(data.label || 'default');
      send(res, 200, { success: true, key });
      return true;
    }
    if (method === 'GET' && pathname === '/api/auth/keys') {
      send(res, 200, { keys: auth.listApiKeys() });
      return true;
    }
    if (method === 'DELETE' && pathname === '/api/auth/keys') {
      const data = await readBody(req);
      if (!data.key) { send(res, 400, { error: 'missing key' }); return true; }
      const removed = auth.removeApiKey(data.key);
      removed ? send(res, 200, { success: true }) : send(res, 404, { error: 'key not found' });
      return true;
    }
    send(res, 404, { error: 'unknown auth endpoint' });
    return true;
  }

  return false; // not handled
}

module.exports = { handlePublicRoutes };
