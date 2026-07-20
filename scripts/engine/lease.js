'use strict';

const crypto = require('crypto');
const path = require('path');
const { syncDashboardFromCheckpoint } = require('./helpers');
const { normalizePhase, PHASE_PLANS, validatePhase } = require('./fsm');
const { markWorkerComplete } = require('./barrier');
const { readCheckpoint, writeCheckpoint } = require('./persistence');
const {
  validateArtifactFile,
  resolveArtifactPath,
  runShellValidation,
} = require('./validate-artifact');

/**
 * Factory: attaches { issueLease, finishLease } to ctx.
 * @param {object} ctx - mutable shared engine context
 */
function createLease(ctx) {
  const {
    scriptDir, tasksDir,
    getState, saveState, bus, contracts,
  } = ctx;

  function issueLease({ taskId, worker, tier, projectDir }) {
    const state = getState();
    const cp = readCheckpoint(tasksDir, taskId);
    if (!cp || !state.currentTask || state.currentTask.id !== taskId) {
      return { ok: false, error: 'invalid task' };
    }
    // D-dispatcher-02: validate phase against known FSM states
    const phase = validatePhase(cp.pipelineState);
    if (!phase) {
      return { ok: false, error: `invalid checkpoint phase: ${cp.pipelineState}` };
    }
    const plan = PHASE_PLANS[phase] || [];
    const allowed = plan.map((p) => p.worker);
    const w = String(worker).toLowerCase();
    if (!allowed.includes(w)) {
      return { ok: false, error: `worker ${w} not in phase ${phase}` };
    }
    // D-dispatcher-03: validate tier matches PHASE_PLANS (prevent tier injection)
    const planEntry = plan.find((p) => p.worker === w);
    const expectedTier = planEntry?.tier;
    if (expectedTier && tier && tier !== expectedTier) {
      return { ok: false, error: `tier mismatch for ${w} in ${phase}: expected ${expectedTier}, got ${tier}` };
    }
    if (state.engine?.paused) {
      return { ok: false, error: 'runtime paused' };
    }

    const leaseId = `lease-${crypto.randomBytes(8).toString('hex')}`;
    if (!state.engine) state.engine = { paused: false, leases: {} };
    state.engine.leases[leaseId] = {
      taskId,
      worker: w,
      tier,
      projectDir,
      phase,
      status: 'active',
      createdAt: Date.now(),
    };
    state.workers[w] = {
      ...state.workers[w],
      status: 'working',
      engine: 'opencode',
      currentTask: taskId,
      leaseId,
    };
    saveState();
    bus.emit('worker.started', { taskId, worker: w, leaseId });
    return { ok: true, leaseId };
  }

  async function finishLease(leaseId, { exitCode, artifactPath }) {
    const state = getState();
    const lease = state.engine?.leases?.[leaseId];
    if (!lease) return { ok: false, error: 'unknown lease' };
    // D-dispatcher-04: prevent double-finish on same lease (TOCTOU guard)
    if (lease.status !== 'active') {
      return { ok: false, error: `lease already ${lease.status}` };
    }

    const w = lease.worker;
    const taskDir = path.join(tasksDir, lease.taskId);
    const art =
      artifactPath ||
      resolveArtifactPath(taskDir, w, contracts);

    if (exitCode !== 0) {
      state.workers[w].status = 'failed';
      state.workers[w].leaseId = null;
      lease.status = 'failed';
      saveState();
      bus.emit('worker.failed', { leaseId, worker: w, reason: 'exit' });
      return { ok: false, error: 'process failed' };
    }

    const fileCheck = validateArtifactFile(
      art,
      contracts.defaultReport?.minBytes ?? 10,
      contracts.defaultReport?.minContentLines ?? 2
    );
    if (!fileCheck.ok) {
      state.workers[w].status = 'failed';
      lease.status = 'failed';
      saveState();
      bus.emit('worker.failed', { leaseId, worker: w, reason: fileCheck.error });
      return { ok: false, error: fileCheck.error };
    }

    const shellVal = await runShellValidation(scriptDir, w, art);
    if (!shellVal.ok && !shellVal.skipped) {
      state.workers[w].status = 'failed';
      lease.status = 'failed';
      saveState();
      bus.emit('worker.failed', { leaseId, worker: w, reason: 'validation' });
      return { ok: false, error: 'artifact validation failed' };
    }

    state.workers[w].status = 'complete';
    state.workers[w].leaseId = null;
    lease.status = 'complete';
    lease.artifactPath = art;

    const cp = readCheckpoint(tasksDir, lease.taskId);
    if (cp?.phaseBarrier) {
      markWorkerComplete(cp.phaseBarrier, w);
      writeCheckpoint(tasksDir, lease.taskId, cp);
      syncDashboardFromCheckpoint(getState, cp, lease.taskId);
    }
    saveState();
    bus.emit('worker.completed', { leaseId, worker: w, taskId: lease.taskId });

    // D-08: Prune leases from non-current tasks to prevent unbounded growth
    const currentId = state.currentTask?.id;
    if (currentId) {
      const leases = state.engine?.leases || {};
      for (const [lid, l] of Object.entries(leases)) {
        if (l.taskId !== currentId && (l.status === 'complete' || l.status === 'failed')) {
          delete leases[lid];
        }
      }
    }

    return { ok: true };
  }

  ctx.issueLease = issueLease;
  ctx.finishLease = finishLease;
}

module.exports = { createLease };
