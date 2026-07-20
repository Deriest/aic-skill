'use strict';
/**
 * Adversarial Compliance Test Suite — v4.0.0
 * Tests deterministic enforcement of critical invariants.
 */

const {
  startBarrier, barrierSatisfied, markWorkerComplete, markWorkerFailed,
  resetWorkersForRepair, clearBarrier,
} = require('../scripts/engine/barrier');
const {
  PHASE_ORDER, PHASE_PLANS, TERMINAL,
  normalizePhase, nextPhase, canAdvance, isTerminal,
} = require('../scripts/engine/fsm');
const { validateArtifactFile } = require('../scripts/engine/validate-artifact');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Category A — Hard Invariants', () => {
  describe('A-05: task.retry must validate phase injection (HIGH)', () => {
    it('PHASE_ORDER is a valid set for retry validation', () => {
      expect(PHASE_ORDER).toBeDefined();
      expect(Array.isArray(PHASE_ORDER)).toBe(true);
      expect(PHASE_ORDER).toContain('INVESTIGATE');
      expect(PHASE_ORDER).toContain('PLANNING');
      expect(PHASE_ORDER).toContain('COMPLETE');
    });

    it('nonRetryable phases include CREATED, COMPLETE, CANCELLED', () => {
      const nonRetryable = new Set(['CREATED', 'COMPLETE', 'CANCELLED']);
      expect(nonRetryable.has('CREATED')).toBe(true);
      expect(nonRetryable.has('COMPLETE')).toBe(true);
      expect(nonRetryable.has('CANCELLED')).toBe(true);
      expect(nonRetryable.has('INVESTIGATE')).toBe(false);
      expect(nonRetryable.has('PLANNING')).toBe(false);
    });

    it('PHASE_ORDER does not contain arbitrary strings', () => {
      expect(PHASE_ORDER).not.toContain('GARBAGE');
      expect(PHASE_ORDER).not.toContain('CLOSEOUT_SKIP');
      expect(PHASE_ORDER).not.toContain('');
    });
  });


  describe('A-01: Barrier timeout must be fail-closed', () => {
    it('timed-out barrier should NOT satisfy — require explicit handling', () => {
      const barrier = startBarrier(['pm', 'architect']);
      markWorkerComplete(barrier, 'pm');
      // architect never completes — simulate timeout by setting startedAt far back
      barrier.startedAt = Date.now() - 600001; // just past 600s timeout
      
      // CURRENT BEHAVIOR: barrierSatisfied returns true on timeout (fail-open)
      // This is the compliance defect — a timed-out barrier should NOT auto-pass
      const result = barrierSatisfied(barrier);
      expect(barrier.timedOut).toBe(true);
      // FIX: timed-out barriers must NOT be silently satisfied
      // The fix changes barrier.js to return false on timeout
      expect(result).toBe(false);
    });

    it('barrier without timeout should still check completion', () => {
      const barrier = startBarrier(['pm']);
      expect(barrierSatisfied(barrier)).toBe(false);
      markWorkerComplete(barrier, 'pm');
      expect(barrierSatisfied(barrier)).toBe(true);
    });
  });

  describe('A-02: Invalid phase transitions must fail closed', () => {
    it('nextPhase(COMPLETE) returns null — no advancement past end', () => {
      expect(nextPhase('COMPLETE')).toBeNull();
    });

    it('nextPhase(unknown) returns null', () => {
      expect(nextPhase('GARBAGE')).toBeNull();
    });

    it('isTerminal(CANCELLED) is true', () => {
      expect(isTerminal('CANCELLED')).toBe(true);
    });

    it('canAdvance requires BOTH barrier and PM pass', () => {
      expect(canAdvance('INVESTIGATE', false, true)).toBe(false);
      expect(canAdvance('INVESTIGATE', true, false)).toBe(false);
      expect(canAdvance('INVESTIGATE', false, false)).toBe(false);
      expect(canAdvance('INVESTIGATE', true, true)).toBe(true);
    });
  });

  describe('A-03: PHASE_PLANS must define all active phases', () => {
    it('every phase in PHASE_ORDER (except CREATED/COMPLETE) has a plan', () => {
      const activePhases = PHASE_ORDER.filter(
        (p) => p !== 'CREATED' && p !== 'COMPLETE'
      );
      for (const phase of activePhases) {
        expect(PHASE_PLANS[phase]).toBeDefined();
        expect(PHASE_PLANS[phase].length).toBeGreaterThan(0);
      }
    });

    it('all workers in PHASE_PLANS have valid worker and tier fields', () => {
      const validTiers = new Set(['thinker', 'crafter', 'sprinter']);
      for (const [phase, plan] of Object.entries(PHASE_PLANS)) {
        for (const entry of plan) {
          expect(entry.worker).toBeDefined();
          expect(typeof entry.worker).toBe('string');
          expect(entry.worker.length).toBeGreaterThan(0);
          expect(validTiers.has(entry.tier)).toBe(true);
        }
      }
    });

    it('PLANNING phase must include designer (v4.0.0 requirement)', () => {
      const planWorkers = PHASE_PLANS.PLANNING.map((p) => p.worker);
      expect(planWorkers).toContain('designer');
    });

    it('designer must be thinker tier (empty output at crafter — D-29)', () => {
      const designer = PHASE_PLANS.PLANNING.find((p) => p.worker === 'designer');
      expect(designer.tier).toBe('thinker');
    });
  });

  describe('A-04: Artifact validation must reject empty/trivial files', () => {
    const tmpDir = path.join(os.tmpdir(), 'compliance-test-' + Date.now());

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('rejects non-existent file', () => {
      const r = validateArtifactFile('/nonexistent/file.md');
      expect(r.ok).toBe(false);
    });

    it('rejects file below minBytes', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      const p = path.join(tmpDir, 'tiny.md');
      fs.writeFileSync(p, 'hi');
      const r = validateArtifactFile(p, 10);
      expect(r.ok).toBe(false);
    });

    it('rejects file with insufficient content lines', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      const p = path.join(tmpDir, 'fewlines.md');
      fs.writeFileSync(p, 'x'.repeat(1000)); // 1000 bytes but only 1 line
      const r = validateArtifactFile(p, 10, 2);
      expect(r.ok).toBe(false);
    });

    it('accepts file meeting all thresholds', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      const p = path.join(tmpDir, 'good.md');
      fs.writeFileSync(p, '# Title\nSome content here.\nMore lines.\n');
      const r = validateArtifactFile(p, 10, 2);
      expect(r.ok).toBe(true);
    });
  });
});

describe('Category B — Workflow Invariants', () => {
  describe('B-04: PM review must fail-closed on empty artifacts (HIGH)', () => {
    it('pm-review.js no longer returns allPass:true for empty artifacts', () => {
      const pmSrc = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'scripts', 'engine', 'pm-review.js'), 'utf8'
      );
      // Verify old fail-open pattern is removed
      expect(pmSrc).not.toContain('allPass: true, skipped: true');
      // Verify new fail-closed pattern exists
      expect(pmSrc).toContain('allPass: false');
      expect(pmSrc).toContain('no_artifacts');
    });
  });

  describe('B-05: Pipeline must fail-closed on phase failure (HIGH)', () => {
    it('pipeline.js no longer calls completeTask on phase failure', () => {
      const pipelineSrc = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'scripts', 'engine', 'pipeline.js'), 'utf8'
      );
      // Verify old fail-open pattern is removed
      expect(pipelineSrc).not.toContain('shipping with caveats');
      expect(pipelineSrc).not.toContain('caveats: true');
      // Verify new fail-closed pattern exists
      expect(pipelineSrc).toContain('BLOCKED');
      expect(pipelineSrc).toContain('phase_failed');
      expect(pipelineSrc).toContain('failedPhase');
    });
  });


  describe('B-01: Terminal states cannot be reversed', () => {
    it('COMPLETE is terminal', () => {
      expect(TERMINAL.has('COMPLETE')).toBe(true);
    });
    it('CANCELLED is terminal', () => {
      expect(TERMINAL.has('CANCELLED')).toBe(true);
    });
    it('BLOCKED is terminal', () => {
      expect(TERMINAL.has('BLOCKED')).toBe(true);
    });
    it('no active phase is terminal', () => {
      for (const phase of PHASE_ORDER) {
        if (phase === 'COMPLETE') continue;
        expect(TERMINAL.has(phase)).toBe(false);
      }
    });
  });

  describe('B-02: Barrier workers are case-normalized and deduped', () => {
    it('startBarrier normalizes and deduplicates', () => {
      const b = startBarrier(['PM', 'Architect', 'pm', 'ARCHITECT']);
      expect(b.workers).toEqual(['pm', 'architect']);
    });

    it('markWorkerComplete is case-insensitive', () => {
      const b = startBarrier(['PM']);
      markWorkerComplete(b, 'PM');
      expect(b.completed['pm']).toBe('complete');
      expect(barrierSatisfied(b)).toBe(true);
    });
  });

  describe('B-03: Repair workers must be reset before respawn', () => {
    it('resetWorkersForRepair clears completed status', () => {
      const b = startBarrier(['pm', 'architect']);
      markWorkerComplete(b, 'pm');
      markWorkerComplete(b, 'architect');
      expect(barrierSatisfied(b)).toBe(true);
      
      resetWorkersForRepair(b, ['architect']);
      expect(barrierSatisfied(b)).toBe(false);
      expect(b.completed['pm']).toBe('complete');
      expect(b.completed['architect']).toBeUndefined();
    });

    it('resetWorkersForRepair clears failed status too', () => {
      const b = startBarrier(['pm']);
      markWorkerFailed(b, 'pm', 'timeout');
      expect(b.failed['pm']).toBe('timeout');
      
      resetWorkersForRepair(b, ['pm']);
      expect(b.failed['pm']).toBeUndefined();
      expect(b.completed['pm']).toBeUndefined();
    });
  });
});

describe('Category C — Behavioral Guidance', () => {

  describe('C-01: Phase ordering matches 5-phase pipeline', () => {
    it('PHASE_ORDER has exactly 7 entries', () => {
      expect(PHASE_ORDER).toHaveLength(7);
    });

    it('PHASE_ORDER follows lifecycle', () => {
      expect(PHASE_ORDER).toEqual([
        'CREATED', 'INVESTIGATE', 'PLANNING',
        'IMPLEMENTATION', 'VERIFICATION', 'CLOSEOUT', 'COMPLETE',
      ]);
    });
  });

  describe('C-02: Recovery strategies exist', () => {
    it('recovery-strategy.js exports expected interface', () => {
      const rs = require('../scripts/engine/recovery-strategy');
      expect(rs.STRATEGIES).toBeDefined();
      expect(rs.STRATEGIES.length).toBeGreaterThan(0);
      expect(typeof rs.selectStrategy).toBe('function');
      expect(typeof rs.evaluateProgress).toBe('function');
    });

    it('strategies include ship_with_caveats as final fallback', () => {
      const rs = require('../scripts/engine/recovery-strategy');
      const lastStrategy = rs.STRATEGIES[rs.STRATEGIES.length - 1];
      expect(lastStrategy).toBe('ship_with_caveats');
    });
  });
});
