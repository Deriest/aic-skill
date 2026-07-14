#!/usr/bin/env node
'use strict';
/** FIX-019: PM repair respawn prep + repair context block */
const fs = require('fs');
const path = require('path');
const {
  parseWorkersFromPmVerdict,
  extractWorkerFailuresFromVerdict,
} = require('./engine/pm-repair');

function usage() {
  console.error(
    'usage: pm-repair-respawn.js delete-artifacts <skillDir> <taskId> <workersCsv>\n' +
      '       pm-repair-respawn.js repair-block <worker> <verdictFile> <contextFile>'
  );
  process.exit(2);
}

function deleteArtifacts(skillDir, taskId, workers) {
  const dir = path.join(skillDir, '.aic', 'tasks', taskId, 'reports');
  for (const w of workers) {
    const f = path.join(dir, `${w}-output.md`);
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (e) {
      console.error('delete failed', f, e.message);
      process.exit(1);
    }
  }
}

function repairBlock(worker, verdictFile, contextFile) {
  let verdict = '';
  let ctx = {};
  try {
    verdict = fs.readFileSync(verdictFile, 'utf8');
  } catch {
    verdict = '';
  }
  try {
    ctx = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
  } catch {
    ctx = {};
  }
  const failures = extractWorkerFailuresFromVerdict(verdict, worker);
  const tid = ctx.taskId || '';
  const title = ctx.title || '';
  const desc = ctx.description || '';
  const block = `PM REPAIR CONTEXT (mandatory — FIX-019)

Previous PM verdict: REWORK

Previous PM findings (worker-specific):
${failures}

Current task id: ${tid}
Current title: ${title}
Current description: ${desc}

Instructions:
- Correct ONLY the issues identified by PM for this worker.
- Do not change unrelated sections.
- Remain within the current task authority above.
- Do not reference other task ids or prior OAT packages.
`;
  process.stdout.write(block);
}

const [,, cmd, ...args] = process.argv;
if (cmd === 'delete-artifacts') {
  const [skillDir, taskId, workersCsv] = args;
  if (!skillDir || !taskId || !workersCsv) usage();
  deleteArtifacts(
    skillDir,
    taskId,
    workersCsv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
} else if (cmd === 'repair-block') {
  const [worker, verdictFile, contextFile] = args;
  if (!worker || !verdictFile || !contextFile) usage();
  repairBlock(worker, verdictFile, contextFile);
} else {
  usage();
}