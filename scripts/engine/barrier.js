'use strict';

function startBarrier(workers) {
  try {
    const list = [...new Set(workers.map((w) => String(w).toLowerCase()))];
    return {
      active: true,
      workers: list,
      completed: {},
      failed: {},
      startedAt: Date.now(),
      timeout: 600000,
    };
  } catch (err) {
    console.error('[barrier] startBarrier error:', err.message);
    return { active: false, workers: [], completed: {}, failed: {}, startedAt: Date.now(), timeout: 600000 };
  }
}

function barrierSatisfied(barrier) {
  if (!barrier || !barrier.active) return false;
  // Fail-closed: timed-out barriers must NOT auto-satisfy.
  // Callers must explicitly handle timedOut flag.
  if (Date.now() - barrier.startedAt > barrier.timeout) {
    barrier.active = false;
    barrier.timedOut = true;
    return false;
  }
  const required = barrier.workers || [];
  if (required.length === 0) return true;
  return required.every((w) => barrier.completed[w] === 'complete');
}

function markWorkerComplete(barrier, worker) {
  if (!barrier) return barrier;
  const w = String(worker).toLowerCase();
  barrier.completed[w] = 'complete';
  return barrier;
}

function markWorkerFailed(barrier, worker, reason) {
  if (!barrier) return barrier;
  const w = String(worker).toLowerCase();
  barrier.failed[w] = reason || 'failed';
  return barrier;
}

/** Clear completion for workers being respawned after PM REWORK (IMP-015). */
function resetWorkersForRepair(barrier, workers) {
  if (!barrier) return barrier;
  for (const worker of workers) {
    const w = String(worker).toLowerCase();
    delete barrier.completed[w];
    delete barrier.failed[w];
  }
  return barrier;
}

function clearBarrier() {
  return null;
}

module.exports = {
  startBarrier,
  barrierSatisfied,
  markWorkerComplete,
  markWorkerFailed,
  resetWorkersForRepair,
  clearBarrier,
};