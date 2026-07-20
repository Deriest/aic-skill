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
    { worker: 'designer', tier: 'thinker' },
  ],
  IMPLEMENTATION: [
    { worker: 'backend', tier: 'crafter' },
    { worker: 'frontend', tier: 'crafter' },
  ],
  VERIFICATION: [{ worker: 'qa', tier: 'crafter' }],
  CLOSEOUT: [{ worker: 'pm', tier: 'thinker' }],
};

const PHASES = new Set([...PHASE_ORDER, ...TERMINAL]);

function normalizePhase(pipelineState) {
  return String(pipelineState || '').toUpperCase();
}

/** Strict phase validation: returns normalized phase if valid, null if unknown. */
function validatePhase(input) {
  const p = normalizePhase(input);
  return PHASES.has(p) ? p : null;
}

function nextPhase(pipelineState) {
  const p = normalizePhase(pipelineState);
  const i = PHASE_ORDER.indexOf(p);
  if (i < 0 || i >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[i + 1];
}

function canAdvance(from, barrierComplete, pmPass) {
  if (!barrierComplete || !pmPass) return false;
  try {
    const n = nextPhase(from);
    // ponytail: explicit parenthesization for operator precedence clarity
    if (from === 'CLOSEOUT' && pmPass) return true;
    return n != null && n !== 'COMPLETE';
  } catch (err) {
    console.error('[fsm] canAdvance error:', err.message);
    return false;
  }
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
  PHASES,
  TERMINAL,
  normalizePhase,
  validatePhase,
  nextPhase,
  canAdvance,
  phaseToCurrentPhase,
  isTerminal,
};