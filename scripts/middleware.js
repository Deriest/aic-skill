'use strict';

const fs = require('fs');
const path = require('path');

function createMiddleware({ allowedOrigins, skillDir }) {
  function resolveCorsOrigin(req) {
    const origin = req.headers.origin;
    if (!allowedOrigins) { if (!origin) return '*'; return origin; }
    if (origin && allowedOrigins.includes(origin)) return origin;
    return null;
  }

  function securityHeadersForApi() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    };
  }

  function securityHeadersForStatic() {
    return {
      ...securityHeadersForApi(),
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    };
  }

  // ponytail: global map, per-IP sliding window if precision matters
  const rateLimits = new Map();
  function checkRateLimit(ip) {
    const now = Date.now();
    const window = 60000;
    let record = rateLimits.get(ip);
    if (!record || now - record.start > window) {
      record = { start: now, count: 0 };
      rateLimits.set(ip, record);
    }
    return ++record.count <= 60;
  }

  const RBAC_MATRIX = {
    admin: ['*'],
    lead: ['project.*', 'worker.*', 'audit.*', 'knowledge.*', 'dispatchers.*', 'pipeline.*'],
    member: ['task.*', 'artifact.*', 'knowledge.read', 'queue.*'],
    viewer: ['status.read', 'metrics.read', 'health.read'],
  };

  function checkAccess(role, resource, action) {
    const perms = RBAC_MATRIX[role] || [];
    if (perms.includes('*')) return true;
    if (perms.includes(resource + '.*')) return true;
    if (perms.includes(resource + '.' + action)) return true;
    return false;
  }

  function serveStatic(req, res, pathname, send) {
    const distDir = path.join(skillDir, 'dashboard', 'dist');
    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(distDir)) return send(res, 403, { error: 'forbidden' });
    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
      if (!fs.existsSync(filePath)) return send(res, 503, { error: 'Dashboard building or missing.' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = {
      '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
      '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
      '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', ...securityHeadersForStatic() });
    fs.createReadStream(filePath).pipe(res);
  }

  return { resolveCorsOrigin, securityHeadersForApi, securityHeadersForStatic, checkRateLimit, checkAccess, serveStatic };
}

module.exports = { createMiddleware };
