'use strict';

const path = require('path');
const { spawnBash, syncDashboardFromCheckpoint } = require('./helpers');
const {
  startBarrier,
  barrierSatisfied,
  markWorkerComplete,
} = require('./barrier');
const {
  readCheckpoint,
  writeCheckpoint,
} = require('./persistence');
const {
  validateArtifactFile,
  resolveArtifactPath,
} = require('./validate-artifact');

/**
 * Factory: attaches { reconcilePhaseBarrier, logBarrierIncomplete, spawnWorkersForPhase, runPhase } to ctx.
 * @param {object} ctx - mutable shared engine context
 */
function createPhaseRunner(ctx) {
  const {
    skillDir, scriptDir, tasksDir,
    getState, saveState, bus, contracts,
  } = ctx;

  function reconcilePhaseBarrier(taskId, cp) {
    const barrier = cp?.phaseBarrier;
    if (!barrier?.workers?.length) return { reconciled: [] };

    const state = getState();
    const taskDir = path.join(tasksDir, taskId);
    const reconciled = [];

    for (const worker of barrier.workers) {
      const w = String(worker).toLowerCase();
      if (barrier.failed?.[w]) continue;
      if (barrier.completed?.[w] === 'complete') continue;

      let via = null;

      const leases = state.engine?.leases || {};
      for (const lease of Object.values(leases)) {
        if (
          lease.taskId === taskId &&
          String(lease.worker).toLowerCase() === w &&
          lease.status === 'complete'
        ) {
          via = 'lease';
          break;
        }
      }

      if (!via) {
        const art = resolveArtifactPath(taskDir, w, contracts);
        const fileCheck = validateArtifactFile(
          art,
          contracts.defaultReport?.minBytes ?? 10,
          contracts.defaultReport?.minContentLines ?? 2
        );
        if (fileCheck.ok) via = 'artifact';
      }

      if (via) {
        markWorkerComplete(barrier, w);
        reconciled.push({ worker: w, via });
      }
    }

    return { reconciled };
  }

  function logBarrierIncomplete(taskId, cp) {
    const barrier = cp.phaseBarrier;
    const required = barrier?.workers || [];
    const missing = required.filter(
      (w) =>
        barrier.completed?.[w] !== 'complete' && !barrier.failed?.[w]
    );
    const taskDir = path.join(tasksDir, taskId);
    const details = missing.map((w) => {
      const art = resolveArtifactPath(taskDir, w, contracts);
      const fileCheck = validateArtifactFile(
        art,
        contracts.defaultReport?.minBytes ?? 10,
        contracts.defaultReport?.minContentLines ?? 2
      );
      const leases = getState().engine?.leases || {};
      const leaseStates = Object.values(leases)
        .filter(
          (l) =>
            l.taskId === taskId && String(l.worker).toLowerCase() === w
        )
        .map((l) => ({ status: l.status, leaseId: l.leaseId }));
      return {
        worker: w,
        artifactPath: art,
        artifactOk: fileCheck.ok,
        artifactError: fileCheck.error || null,
        leases: leaseStates,
        barrierCompleted: barrier.completed?.[w] ?? null,
        barrierFailed: barrier.failed?.[w] ?? null,
      };
    });
    console.error(
      '[engine] barrier incomplete after reconciliation',
      JSON.stringify({ taskId, missingWorkers: missing, details, barrier })
    );
  }

  async function spawnWorkersForPhase(
    taskId,
    pipelineState,
    projectDir,
    planSubset,
    cp,
    envExtra = {}
  ) {
    const phaseLabel =
      pipelineState.charAt(0) + pipelineState.slice(1).toLowerCase();
    const code = await spawnBash(skillDir,
      path.join(scriptDir, 'phase-runner.sh'),
      [phaseLabel, projectDir, ...planSubset.map((p) => `${p.worker},${p.tier}`)],
      { AIC_TASK_ID: taskId, AIC_PIPELINE_PHASE: pipelineState, ...envExtra }
    );
    cp = readCheckpoint(tasksDir, taskId) || cp;
    if (code !== 0) {
      cp.phaseStatus = 'failed';
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(getState, cp, taskId);
      saveState();
      bus.emit('worker.failed', {
        taskId,
        phase: pipelineState,
        exitCode: code,
      });
      return { ok: false, exitCode: code, cp };
    }
    cp.phaseStatus = 'barrier_wait';
    const { reconciled } = reconcilePhaseBarrier(taskId, cp);
    if (reconciled.length) {
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(getState, cp, taskId);
      console.log(
        '[engine] barrier reconciled',
        JSON.stringify({ taskId, phase: pipelineState, reconciled })
      );
    }
    if (!barrierSatisfied(cp.phaseBarrier)) {
      logBarrierIncomplete(taskId, cp);
      cp.phaseStatus = 'failed';
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(getState, cp, taskId);
      saveState();
      return { ok: false, error: 'barrier incomplete', cp };
    }
    writeCheckpoint(tasksDir, taskId, cp);
    syncDashboardFromCheckpoint(getState, cp, taskId);
    saveState();
    bus.emit('barrier.completed', { taskId, phase: pipelineState });
    return { ok: true, cp };
  }

  async function runPhase(taskId, pipelineState, projectDir, phaseOpts = {}) {
    const { PHASE_PLANS } = require('./fsm');
    const plan = PHASE_PLANS[pipelineState];
    if (!plan || !plan.length) return { ok: true };

    let cp = readCheckpoint(tasksDir, taskId) || {};
    cp.id = taskId;
    cp.pipelineState = pipelineState;
    cp.phaseStatus = 'spawning';

    const repairSubset = phaseOpts.repairSubset;
    const spawnPlan =
      repairSubset && repairSubset.length ? repairSubset : plan;
    cp.phaseBarrier = startBarrier(spawnPlan.map((p) => p.worker));
    writeCheckpoint(tasksDir, taskId, cp);
    syncDashboardFromCheckpoint(getState, cp, taskId);
    saveState();
    bus.emit('phase.started', { taskId, phase: pipelineState });

    const phaseLabel =
      pipelineState.charAt(0) + pipelineState.slice(1).toLowerCase();
    const spawn = await spawnWorkersForPhase(
      taskId,
      pipelineState,
      projectDir,
      spawnPlan,
      cp,
      phaseOpts.repairEnv || {}
    );
    if (!spawn.ok) {
      if (spawn.error !== 'barrier incomplete') {
        return { ok: false, exitCode: spawn.exitCode };
      }
      return { ok: false, error: spawn.error };
    }
    cp = spawn.cp;

    const repaired = await ctx.pmRepairLoop(
      taskId,
      pipelineState,
      projectDir,
      plan,
      phaseLabel,
      cp
    );
    if (!repaired.ok) {
      return { ok: false, pm: false };
    }
    return { ok: true };
  }

  ctx.reconcilePhaseBarrier = reconcilePhaseBarrier;
  ctx.logBarrierIncomplete = logBarrierIncomplete;
  ctx.spawnWorkersForPhase = spawnWorkersForPhase;
  ctx.runPhase = runPhase;
}

module.exports = { createPhaseRunner };
