'use strict';

const fs = require('fs');
const path = require('path');

const KNOWN_WORKERS = [
  'pm',
  'architect',
  'research',
  'backend',
  'frontend',
  'qa',
];

/**
 * @param {object} contracts from runtime-contracts.json
 */
function getMaxPmRepairAttempts(contracts) {
  const n = contracts?.maxPmRepairAttempts;
  if (typeof n === 'number' && n >= 0) return n;
  return 3;
}

/**
 * Parse PM rationale for worker names (pm-output.md, Regenerate **pm**, etc.)
 * @param {string} text
 * @param {{ worker: string }[]} plan
 * @returns {string[]} lowercase worker ids
 */
function parseWorkersFromPmVerdict(text, plan) {
  const planWorkers = new Set(
    (plan || []).map((p) => String(p.worker).toLowerCase())
  );
  const found = new Set();
  const lower = String(text || '').toLowerCase();

  for (const w of KNOWN_WORKERS) {
    if (!planWorkers.has(w)) continue;
    const patterns = [
      new RegExp(`${w}-output\\.md`, 'i'),
      new RegExp(`regenerat(?:e|ing)\\s+\\*\\*${w}\\*\\*`, 'i'),
      new RegExp(`\\*\\*${w}\\*\\*\\s+must`, 'i'),
      new RegExp(`\\*\\*${w}\\*\\*`, 'i'),
      new RegExp(`\\b${w}\\b\\s+planning`, 'i'),
      new RegExp(`respawn\\s+\\*\\*${w}\\*\\*`, 'i'),
      new RegExp(`\\*\\*${w}-output`, 'i'),
    ];
    if (patterns.some((re) => re.test(text))) found.add(w);
  }

  if (found.size) return [...found];

  for (const w of KNOWN_WORKERS) {
    if (planWorkers.has(w) && lower.includes(w)) found.add(w);
  }
  return [...found];
}

const ARTIFACT_PHASE_HINTS = [
  { re: /\bplanning\s+`?pm-output/i, phase: 'PLANNING', workers: ['pm'] },
  { re: /planning\s+artifacts?.*`?pm-output/i, phase: 'PLANNING', workers: ['pm'] },
  { re: /regenerat(?:e|ing)\s+planning\s+`?\*?\*?pm/i, phase: 'PLANNING', workers: ['pm'] },
  { re: /refresh\s+planning\s+\*?\*?pm/i, phase: 'PLANNING', workers: ['pm'] },
  { re: /planning\s+\*?\*?pm-output/i, phase: 'PLANNING', workers: ['pm'] },
  { re: /`?architect-output\.md`?/i, phase: 'PLANNING', workers: ['architect'] },
  { re: /trim\s+`?architect-output/i, phase: 'PLANNING', workers: ['architect'] },
  { re: /`?research-output\.md`?/i, phase: 'PLANNING', workers: ['research'] },
  { re: /`?backend-output\.md`?/i, phase: 'IMPLEMENTATION', workers: ['backend'] },
  { re: /`?frontend-output\.md`?/i, phase: 'IMPLEMENTATION', workers: ['frontend'] },
  { re: /`?qa-output\.md`?/i, phase: 'VERIFICATION', workers: ['qa'] },
];

/**
 * Resolve repair workers from verdict artifact phase, not only current pipeline plan.
 * @param {string} text
 * @param {string} pipelineState e.g. VERIFICATION
 * @param {{ worker: string }[]} currentPlan
 * @param {object} phasePlans PHASE_PLANS from fsm
 */
function resolvePmRepairTargets(text, pipelineState, currentPlan, phasePlans) {
  const t = String(text || '');
  const found = new Set();
  let artifactPhase = null;

  for (const hint of ARTIFACT_PHASE_HINTS) {
    if (!hint.re.test(t)) continue;
    artifactPhase = hint.phase;
    for (const w of hint.workers) found.add(w);
  }

  for (const w of KNOWN_WORKERS) {
    if (new RegExp(`${w}-output\\.md`, 'i').test(t)) {
      found.add(w);
      if (!artifactPhase) {
        for (const [phase, plan] of Object.entries(phasePlans || {})) {
          if ((plan || []).some((p) => String(p.worker).toLowerCase() === w)) {
            artifactPhase = phase;
            break;
          }
        }
      }
    }
  }

  if (!found.size) {
    const fallback = parseWorkersFromPmVerdict(t, currentPlan);
    return {
      workers: fallback,
      artifactPhase: null,
      spawnPlan: (currentPlan || []).filter((p) =>
        fallback.includes(String(p.worker).toLowerCase())
      ),
    };
  }

  const workers = [...found];
  const spawnPhase =
    artifactPhase && (phasePlans || {})[artifactPhase]
      ? artifactPhase
      : pipelineState;
  const spawnPlan = ((phasePlans || {})[spawnPhase] || []).filter((p) =>
    workers.includes(String(p.worker).toLowerCase())
  );

  return { workers, artifactPhase: artifactPhase || spawnPhase, spawnPlan };
}

/**
 * Lines from PM verdict mentioning this worker (for repair prompt).
 * @param {string} text
 * @param {string} worker
 */
function extractWorkerFailuresFromVerdict(text, worker) {
  const w = String(worker).toLowerCase();
  const lines = String(text || '').split('\n');
  const hits = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const ll = t.toLowerCase();
    if (
      ll.includes(`${w}-output`) ||
      ll.includes(`**${w}**`) ||
      (ll.includes(w) && (ll.includes('fail') || ll.includes('wrong') || ll.includes('revise') || ll.includes('replace')))
    ) {
      hits.push(t);
    }
  }
  if (hits.length) return hits.join('\n');
  return `PM rejected this phase. Regenerate **${w}** output for the current task only. Full verdict excerpt unavailable.`;
}

function readPmVerdictFile(tasksDir, taskId) {
  const f = path.join(
    tasksDir,
    taskId,
    'reports',
    '.pm-last-verdict.txt'
  );
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
}

module.exports = {
  getMaxPmRepairAttempts,
  parseWorkersFromPmVerdict,
  resolvePmRepairTargets,
  extractWorkerFailuresFromVerdict,
  readPmVerdictFile,
  KNOWN_WORKERS,
};