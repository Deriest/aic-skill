#!/usr/bin/env node
/**
 * AIC Office — Status API Server
 *
 * Pure REST API for status updates. The dashboard UI is served separately
 * by the Vite dev server (port 6969) which proxies /api requests here.
 *
 * Usage: node server.js [port]
 * Default port: 3000
 *
 * Status file location: ~/.hermes/skills/workflows/aic/status.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.argv[2] || 3000;
const STATUS_FILE = path.join(os.homedir(), '.hermes', 'skills', 'workflows', 'aic', 'status.json');

console.log(`[AIC] Status file: ${STATUS_FILE}`);

function loadStatus() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[AIC] Error loading status:', e.message);
    }
    return {
        connected: true,
        currentTask: null,
        phases: [],
        agents: {},
        logs: [],
        log: { message: 'API server ready', type: 'success' }
    };
}

function drainLogs() {
    /**
     * Read status.json, extract pending logs, write back with cleared logs.
     * Returns the drained log entries.
     */
    const status = loadStatus();
    const pendingLogs = Array.isArray(status.logs) ? [...status.logs] : [];

    // Clear logs in status file
    status.logs = [];
    status.log = null;
    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    } catch (e) {
        console.error('[AIC] Error clearing logs:', e.message);
    }

    return { status, pendingLogs };
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // GET /api/status — drain logs and return combined response
    if (req.url === '/api/status' && req.method === 'GET') {
        const { status, pendingLogs } = drainLogs();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...status, logs: pendingLogs }));
        return;
    }

    // POST /api/status
    if (req.url === '/api/status' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                fs.writeFileSync(STATUS_FILE, JSON.stringify(JSON.parse(body), null, 2));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                console.log('[AIC] Status updated via API');
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Health check
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, port: PORT }));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════╗\n║     🏢 AIC Office — Status API Server       ║\n╠══════════════════════════════════════════════╣\n║                                              ║\n║  API:  http://localhost:${PORT}/api/status    ║\n║  UI:   http://localhost:6969 (Vite dev)     ║\n║                                              ║\n╚══════════════════════════════════════════════╝\n    `);
});

process.on('SIGINT', () => {
    console.log('\n[AIC] Shutting down...');
    server.close();
    process.exit(0);
});
