'use strict';
const {
  startBarrier, barrierSatisfied, markWorkerComplete,
  markWorkerFailed, resetWorkersForRepair, clearBarrier,
} = require('../scripts/engine/barrier');

describe('barrier', () => {
  describe('startBarrier', () => {
    it('returns active barrier with lowercased deduped workers', () => {
      const b = startBarrier(['PM', 'Architect', 'pm']);
      expect(b.active).toBe(true);
      expect(b.workers).toEqual(['pm', 'architect']);
      expect(b.completed).toEqual({});
      expect(b.failed).toEqual({});
      expect(b.timeout).toBe(600000);
    });
  });

  describe('barrierSatisfied', () => {
    it('returns false for null/inactive barrier', () => {
      expect(barrierSatisfied(null)).toBe(false);
      expect(barrierSatisfied({ active: false })).toBe(false);
    });

    it('returns true for empty workers list', () => {
      expect(barrierSatisfied({ active: true, workers: [], startedAt: Date.now(), timeout: 600000 })).toBe(true);
    });

    it('returns false when not all workers complete', () => {
      const b = startBarrier(['pm', 'architect']);
      markWorkerComplete(b, 'pm');
      expect(barrierSatisfied(b)).toBe(false);
    });

    it('returns true when all workers complete', () => {
      const b = startBarrier(['pm', 'architect']);
      markWorkerComplete(b, 'pm');
      markWorkerComplete(b, 'architect');
      expect(barrierSatisfied(b)).toBe(true);
    });
  });

  describe('markWorkerComplete / markWorkerFailed', () => {
    it('marks worker as complete (case-insensitive)', () => {
      const b = startBarrier(['PM']);
      markWorkerComplete(b, 'PM');
      expect(b.completed['pm']).toBe('complete');
    });

    it('marks worker as failed with reason', () => {
      const b = startBarrier(['qa']);
      markWorkerFailed(b, 'QA', 'timeout');
      expect(b.failed['qa']).toBe('timeout');
    });

    it('returns null for null barrier', () => {
      expect(markWorkerComplete(null, 'x')).toBe(null);
      expect(markWorkerFailed(null, 'x')).toBe(null);
    });
  });

  describe('resetWorkersForRepair', () => {
    it('clears completed/failed for specified workers', () => {
      const b = startBarrier(['pm', 'backend']);
      markWorkerComplete(b, 'pm');
      markWorkerFailed(b, 'backend', 'error');
      resetWorkersForRepair(b, ['backend']);
      expect(b.completed['backend']).toBeUndefined();
      expect(b.failed['backend']).toBeUndefined();
      expect(b.completed['pm']).toBe('complete'); // untouched
    });
  });

  describe('clearBarrier', () => {
    it('returns null', () => { expect(clearBarrier()).toBe(null); });
  });
});
