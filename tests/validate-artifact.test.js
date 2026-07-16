'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateArtifactFile, resolveArtifactPath } = require('../scripts/engine/validate-artifact');

const tmpDir = path.join(os.tmpdir(), 'aic-validate-test-' + Date.now());

function writeTmp(name, content) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content);
  return p;
}

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('validateArtifactFile', () => {
  it('returns ok=true for a valid file', () => {
    const p = writeTmp('good.md', 'Line one\nLine two\nLine three\n');
    const r = validateArtifactFile(p);
    expect(r.ok).toBe(true);
    expect(r.path).toBe(p);
  });

  it('returns ok=false for missing file', () => {
    const r = validateArtifactFile('/nonexistent/path/file.md');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('artifact not found');
  });

  it('returns ok=false for file that is too small', () => {
    const p = writeTmp('tiny.md', 'hi');
    const r = validateArtifactFile(p, 100);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('artifact too small');
  });

  it('returns ok=false for file with insufficient content lines', () => {
    const p = writeTmp('sparse.md', 'just one alphabetic line\n');
    const r = validateArtifactFile(p, 10, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('insufficient content');
  });
});

describe('resolveArtifactPath', () => {
  it('uses default pattern when no contracts', () => {
    const p = resolveArtifactPath('/tasks/t1', 'backend', null);
    expect(p).toBe('/tasks/t1/reports/backend-output.md');
  });

  it('uses contracts.defaultReport.pattern when provided', () => {
    const contracts = { defaultReport: { pattern: '{taskDir}/artifacts/{worker}.json' } };
    const p = resolveArtifactPath('/tasks/t2', 'qa', contracts);
    expect(p).toBe('/tasks/t2/artifacts/qa.json');
  });
});
