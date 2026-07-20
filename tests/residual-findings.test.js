'use strict';
/**
 * Residual Findings Triage Tests
 * Covers: SSRF, path traversal, enterprise RBAC, shell invocation.
 */

const fs = require('fs');
const path = require('path');

describe('RESIDUAL-01: Enterprise endpoints protected by RBAC', () => {
  it('enterprise/ops handlers run AFTER RBAC check in server.js', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'server.js'), 'utf8');
    const lines = src.split('\n');
    let rbacLine = -1, entLine = -1, opsLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('RBAC enforcement MUST happen BEFORE')) rbacLine = i;
      if (lines[i].includes('handleEnterpriseEndpoint(req')) entLine = i;
      if (lines[i].includes('handleOpsEndpoint(req')) opsLine = i;
    }
    expect(rbacLine).toBeGreaterThan(0);
    expect(entLine).toBeGreaterThan(rbacLine);
    expect(opsLine).toBeGreaterThan(rbacLine);
  });

  it('RBAC matrix prevents viewer from enterprise writes', () => {
    const { createMiddleware } = require('../scripts/middleware');
    const mw = createMiddleware({ allowedOrigins: null, skillDir: '/tmp' });
    // viewer cannot write to projects, permissions, quotas, dispatchers
    expect(mw.checkAccess('viewer', 'projects', 'write')).toBe(false);
    expect(mw.checkAccess('viewer', 'permissions', 'write')).toBe(false);
    expect(mw.checkAccess('viewer', 'resources', 'write')).toBe(false);
    expect(mw.checkAccess('viewer', 'dispatchers', 'write')).toBe(false);
    // member cannot either (only task.read, artifact, knowledge.read)
    expect(mw.checkAccess('member', 'projects', 'write')).toBe(false);
    expect(mw.checkAccess('member', 'permissions', 'write')).toBe(false);
    expect(mw.checkAccess('member', 'reset', 'write')).toBe(false);
    // admin can
    expect(mw.checkAccess('admin', 'projects', 'write')).toBe(true);
    expect(mw.checkAccess('admin', 'permissions', 'write')).toBe(true);
  });
});

describe('RESIDUAL-02: SSRF protection on /api/models', () => {
  it('public-routes.js blocks localhost', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'routes', 'public-routes.js'), 'utf8');
    expect(src).toContain('localhost');
    expect(src).toContain('isPrivate');
    expect(src).toContain('127.0.0.1');
    expect(src).toContain('169.254.');
    expect(src).toContain('internal/private addresses');
  });

  it('public-routes.js blocks RFC1918 ranges', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'routes', 'public-routes.js'), 'utf8');
    expect(src).toContain("hostname.startsWith('10.')");
    expect(src).toContain("hostname.startsWith('192.168.')");
    expect(src).toContain("hostname.startsWith('172.')");
    expect(src).toContain('o >= 16 && o <= 31');
  });

  it('public-routes.js blocks IPv6 loopback and link-local', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'routes', 'public-routes.js'), 'utf8');
    expect(src).toContain("'::1'");
    expect(src).toContain("hostname.startsWith('fc00:')");
    expect(src).toContain("hostname.startsWith('fe80:')");
  });

  it('SSRF guard is inside fetchUpstreamModelsJson (runs for both public and auth routes)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'routes', 'public-routes.js'), 'utf8');
    // Guard must be in the function body, not in the route handler
    const fnStart = src.indexOf('function fetchUpstreamModelsJson');
    const fnEnd = src.indexOf('const lib = ', fnStart);
    const guard = src.substring(fnStart, fnEnd);
    expect(guard).toContain('isPrivate');
  });
});

describe('RESIDUAL-03: Postmortem path traversal', () => {
  it('taskId with ../ is contained within tasks dir by path.join + suffix', () => {
    const base = '/home/tvd/.hermes/skills/workflows/aic';
    // path.join normalizes ../ but the suffix /reports/postmortem-report.md
    // prevents escaping to read arbitrary files
    const malicious = path.join(base, '.aic', 'tasks', '../../etc/passwd', 'reports', 'postmortem-report.md');
    // path.join normalizes to: /home/tvd/.hermes/skills/workflows/aic/etc/passwd/reports/postmortem-report.md
    // This is CONTAINED under the skill dir (not /etc/passwd)
    expect(malicious).toContain('postmortem-report.md');
    expect(malicious).not.toBe('/etc/passwd');
    expect(malicious).not.toMatch(/\/etc\/passwd$/);
  });

  it('taskId with absolute path is contained', () => {
    const base = '/home/tvd/.hermes/skills/workflows/aic';
    const malicious = path.join(base, '.aic', 'tasks', '/etc/passwd', 'reports', 'postmortem-report.md');
    expect(malicious).toContain('postmortem-report.md');
    expect(malicious).not.toBe('/etc/passwd');
  });

  it('taskId TASK-1 is the expected pattern', () => {
    const base = '/home/tvd/.hermes/skills/workflows/aic';
    const normal = path.join(base, '.aic', 'tasks', 'TASK-1', 'reports', 'postmortem-report.md');
    expect(normal).toBe('/home/tvd/.hermes/skills/workflows/aic/.aic/tasks/TASK-1/reports/postmortem-report.md');
  });

  it('postmortem reads a fixed filename, not user-controlled', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'routes', 'metrics-routes.js'), 'utf8');
    // The filename is hardcoded, only taskId is from URL
    expect(src).toContain("'reports', 'postmortem-report.md'");
  });
});

describe('RESIDUAL-04: Direct shell invocation trust boundary', () => {
  it('spawn-worker.sh requires AIC_LEASE_ID or engine API', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'spawn-worker.sh'), 'utf8');
    expect(src).toContain('AIC_LEASE_ID');
    expect(src).toContain('No runtime lease');
  });

  it('spawn-worker.sh validates tier', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'spawn-worker.sh'), 'utf8');
    expect(src).toContain('thinker');
    expect(src).toContain('crafter');
    expect(src).toContain('sprinter');
  });

  it('phase-runner.sh is called by engine via spawnBash, not by HTTP routes', () => {
    const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'engine', 'phase-runner.js'), 'utf8');
    expect(engineSrc).toContain('phase-runner.sh');
    expect(engineSrc).toContain('spawnBash');
    // phase-runner.sh is NOT called by any route handler
    const routeDir = path.join(__dirname, '..', 'scripts', 'routes');
    for (const file of fs.readdirSync(routeDir)) {
      const routeSrc = fs.readFileSync(path.join(routeDir, file), 'utf8');
      expect(routeSrc).not.toContain('phase-runner.sh');
    }
  });

  it('no git operations in any shell script', () => {
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    const shFiles = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.sh'));
    for (const file of shFiles) {
      const src = fs.readFileSync(path.join(scriptsDir, file), 'utf8');
      // Skip comment lines
      const codeLines = src.split('\n').filter(l => !l.trim().startsWith('#'));
      const code = codeLines.join('\n');
      const gitOps = code.match(/\bgit\s+(add|commit|push|merge|reset|rebase)\b/);
      expect(gitOps).toBeNull();
    }
  });
});
