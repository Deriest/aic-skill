'use strict';
const {
  PHASE_PLANS, PHASE_ORDER, TERMINAL,
  normalizePhase, nextPhase, canAdvance,
  isTerminal, phaseToCurrentPhase,
} = require('../scripts/engine/fsm');

describe('fsm', () => {
  describe('PHASE_PLANS', () => {
    it('defines plans for all active phases except CREATED and COMPLETE', () => {
      const active = PHASE_ORDER.filter(p => p !== 'CREATED' && p !== 'COMPLETE');
      for (const phase of active) {
        expect(PHASE_PLANS[phase]).toBeDefined();
        expect(PHASE_PLANS[phase].length).toBeGreaterThan(0);
      }
    });
  });

  describe('normalizePhase', () => {
    it('uppercases input', () => { expect(normalizePhase('planning')).toBe('PLANNING'); });
    it('handles empty/null', () => { expect(normalizePhase(null)).toBe(''); expect(normalizePhase('')).toBe(''); });
  });

  describe('nextPhase', () => {
    it('CREATED → INVESTIGATE', () => { expect(nextPhase('CREATED')).toBe('INVESTIGATE'); });
    it('CLOSEOUT → COMPLETE', () => { expect(nextPhase('CLOSEOUT')).toBe('COMPLETE'); });
    it('COMPLETE → null', () => { expect(nextPhase('COMPLETE')).toBe(null); });
    it('unknown → null', () => { expect(nextPhase('NONSENSE')).toBe(null); });
  });

  describe('canAdvance', () => {
    it('returns false when barrier not complete', () => {
      expect(canAdvance('INVESTIGATE', false, true)).toBe(false);
    });
    it('returns false when pmPass is false', () => {
      expect(canAdvance('INVESTIGATE', true, false)).toBe(false);
    });
    it('INVESTIGATE with both flags → true (next is PLANNING)', () => {
      expect(canAdvance('INVESTIGATE', true, true)).toBe(true);
    });
    it('returns true for CLOSEOUT with pmPass (advances to COMPLETE)', () => {
      expect(canAdvance('CLOSEOUT', true, true)).toBe(true);
    });
    it('returns false for COMPLETE (no next)', () => {
      expect(canAdvance('COMPLETE', true, true)).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('COMPLETE is terminal', () => { expect(isTerminal('COMPLETE')).toBe(true); });
    it('CANCELLED is terminal', () => { expect(isTerminal('CANCELLED')).toBe(true); });
    it('BLOCKED is terminal', () => { expect(isTerminal('BLOCKED')).toBe(true); });
    it('PLANNING is not terminal', () => { expect(isTerminal('PLANNING')).toBe(false); });
  });

  describe('phaseToCurrentPhase', () => {
    it('CREATED → null', () => { expect(phaseToCurrentPhase('CREATED')).toBe(null); });
    it('COMPLETE → Complete', () => { expect(phaseToCurrentPhase('COMPLETE')).toBe('Complete'); });
    it('PLANNING → Planning', () => { expect(phaseToCurrentPhase('PLANNING')).toBe('Planning'); });
  });
});
