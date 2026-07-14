'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function validateArtifactFile(filePath, minBytes = 10, minContentLines = 2) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'artifact not found', path: filePath };
  }
  const stat = fs.statSync(filePath);
  if (stat.size < minBytes) {
    return { ok: false, error: 'artifact too small', path: filePath };
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const contentLines = text.split('\n').filter((l) => /[a-zA-Z]/.test(l)).length;
  if (contentLines < minContentLines) {
    return { ok: false, error: 'insufficient content', path: filePath };
  }
  return { ok: true, path: filePath };
}

function resolveArtifactPath(taskDir, worker, contracts) {
  const rel = contracts?.defaultReport?.pattern
    || '{taskDir}/reports/{worker}-output.md';
  return rel
    .replace('{taskDir}', taskDir)
    .replace('{worker}', worker);
}

function runShellValidation(scriptDir, worker, artifactPath) {
  return new Promise((resolve) => {
    const script = path.join(scriptDir, 'worker-validation.sh');
    if (!fs.existsSync(script)) {
      resolve({ ok: true, skipped: true });
      return;
    }
    const child = spawn('bash', [script, worker, artifactPath], { stdio: 'pipe' });
    child.on('close', (code) => resolve({ ok: code === 0, exitCode: code }));
    child.on('error', () => resolve({ ok: false, error: 'validation spawn failed' }));
  });
}

module.exports = {
  validateArtifactFile,
  resolveArtifactPath,
  runShellValidation,
};