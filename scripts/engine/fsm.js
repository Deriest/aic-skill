'use strict';

const PHASE_ORDER = [
  'CREATED',
  'INVESTIGATE',
  'PLANNING',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSEOUT',
  'COMPLETE',
];

const TERMINAL = new Set(['COMPLETE', 'CANCELLED', 'BLOCKED']);

const PHASE_PLANS = {
  INVESTIGATE: [{ worker: 'pm', tier: 'thinker' }],
  PLANNING: [
    { worker: 'pm', tier: 'thinker' },
    { worker: 'architect', tier: 'thinker' },
    { worker: 'research', tier: 'thinker' },
  ],
  IMPLEMENTATION: [
    { worker: 'backend', tier: 'crafter' },
    { worker: 'frontend', tier: 'crafter' },
  ],
  VERIFICATION: [{ worker: 'qa', tier: 'crafter' }],
  CLOSEOUT: [{ worker: 'pm', tier: 'thinker' }],
};

function normalizePhase(pipelineState) {
  return String(pipelineState || '').toUpperCase();
}

function nextPhase(pipelineState) {
  const p = normalizePhase(pipelineState);
  const i = PHASE_ORDER.indexOf(p);
  if (i < 0 || i >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[i + 1];
}

function canAdvance(from, barrierComplete, pmPass) {
  if (!barrierComplete || !pmPass) return false;
  const n = nextPhase(from);
  return n != null && n !== 'COMPLETE' || (from === 'CLOSEOUT' && pmPass);
}

function phaseToCurrentPhase(pipelineState) {
  const p = normalizePhase(pipelineState);
  if (p === 'CREATED') return null;
  if (p === 'COMPLETE') return 'Complete';
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function isTerminal(pipelineState) {
  return TERMINAL.has(normalizePhase(pipelineState));
}

module.exports = {
  PHASE_ORDER,
  PHASE_PLANS,
  TERMINAL,
  normalizePhase,
  nextPhase,
  canAdvance,
  phaseToCurrentPhase,
  isTerminal,
};