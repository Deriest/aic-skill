#!/usr/bin/env node
'use strict';
// Exit codes: 0=success, 1=error, 2=blocked
const fs = require('fs');
const path = require('path');

function deleteArtifacts(skillDir, taskId, workers) {
  const dir = path.join(skillDir, '.aic', 'tasks', taskId, 'reports');
  const failures = [];
  for (const w of workers) {
    const f = path.join(dir, w + '-output.md');
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (e) {
      console.error('delete failed', f, e.message);
      failures.push({ file: f, error: e.message });
    }
  }
  if (failures.length > 0) {
    console.error(`${failures.length}/${workers.length} deletions failed`);
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
if (args[0] === 'delete-artifacts' && args.length >= 4) {
  deleteArtifacts(args[1], args[2], args[3].split(','));
} else if (args[0] === 'repair-block' && args.length >= 3) {
  const worker = args[1];
  const verdictFile = args[2];
  const contextFile = args[3] || '';
  try {
    const verdict = fs.readFileSync(verdictFile, 'utf8').trim();
    // Try to read EDP JSON (sibling to verdict file)
    const edpPath = path.join(path.dirname(verdictFile), '.pm-last-edp.json');
    let edp = {};
    try { edp = JSON.parse(fs.readFileSync(edpPath, 'utf8')); } catch (_) {}
    const pkg = edp.decision_package || {};

    const owner = String(pkg.owner || '').toLowerCase();
    const workerLower = worker.toLowerCase();
    const ownerParts = owner.split('/').map(s => s.trim()).filter(Boolean);
    const isTarget = ownerParts.includes(workerLower);

    const objective = pkg.engineering_objective || '';
    const rootCause = pkg.root_cause || '';
    const criteria = (pkg.completion_criteria || []).map(c => '- ' + c).join('\n');
    const deliverables = (pkg.expected_deliverables || []).filter(d =>
      d.toLowerCase().includes(workerLower)
    ).map(d => '- ' + d).join('\n');

    let block = `\n=== PM REPAIR FEEDBACK (attempt ${edp.attempt || '?'}) ===\n`;
    block += `YOUR PREVIOUS OUTPUT WAS REJECTED BY PM REVIEW.\n\n`;
    if (rootCause) block += `Root Cause:\n${rootCause}\n\n`;
    if (objective) block += `Engineering Objective:\n${objective}\n\n`;
    if (isTarget) block += `You are a primary repair target for this rework.\n`;
    else block += `You are being respawned as a supporting worker.\n`;
    if (deliverables) block += `\nYour Expected Deliverables:\n${deliverables}\n`;
    if (criteria) block += `\nCompletion Criteria:\n${criteria}\n`;
    block += `\nFull PM Verdict:\n${verdict}\n`;
    block += `\nFIX THE ISSUES ABOVE IN YOUR NEW OUTPUT. Do not repeat the same content.\n`;
    block += `=== END PM REPAIR FEEDBACK ===\n`;

    process.stdout.write(block);
  } catch (e) {
    console.error('repair-block failed:', e.message);
    process.exit(1);
  }
} else {
  console.error('usage: pm-repair-respawn.js delete-artifacts <skillDir> <taskId> <workersCsv>');
  console.error('       pm-repair-respawn.js repair-block <worker> <verdictFile> [contextFile]');
  process.exit(1);
}
