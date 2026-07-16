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

  /**
   * Spawn workers with optional env extras and barrier management.
   * Returns { ok, cp } or { ok: false, error, cp }.
   */
  async function _spawnAndBarrier(taskId, pipelineState, projectDir, spawnPlan, cp, envExtra, phaseLabel) {
    cp.phaseBarrier = startBarrier(spawnPlan.map((p) => p.worker));
    writeCheckpoint(tasksDir, taskId, cp);
    syncDashboardFromCheckpoint(getState, cp, taskId);
    saveState();

    const spawn = await spawnWorkersForPhase(
      taskId, pipelineState, projectDir, spawnPlan, cp, envExtra
    );
    if (!spawn.ok) {
      if (spawn.error !== 'barrier incomplete') {
        return { ok: false, exitCode: spawn.exitCode, cp: spawn.cp };
      }
      return { ok: false, error: spawn.error, cp: spawn.cp };
    }
    return { ok: true, cp: spawn.cp };
  }

  async function runPhase(taskId, pipelineState, projectDir, phaseOpts = {}) {
    const { PHASE_PLANS } = require('./fsm');
    const plan = PHASE_PLANS[pipelineState];
    if (!plan || !plan.length) return { ok: true };

    let cp = readCheckpoint(tasksDir, taskId) || {};
    cp.id = taskId;
    cp.pipelineState = pipelineState;
    cp.phaseStatus = 'spawning';

    const isPlanningFirstRun = pipelineState === 'PLANNING' && !phaseOpts.repairSubset;
    const phaseLabel =
      pipelineState.charAt(0) + pipelineState.slice(1).toLowerCase();

    // ── Execution Plan: PM spawns first in PLANNING ──
    if (isPlanningFirstRun) {
      const pmEntry = plan.find((p) => p.worker === 'pm');
      const downstreamPlan = plan.filter((p) => p.worker !== 'pm');

      if (pmEntry && downstreamPlan.length) {
        bus.emit('phase.started', { taskId, phase: pipelineState, subPhase: 'pm-planning' });
        const pmSpawn = await _spawnAndBarrier(
          taskId, pipelineState, projectDir, [pmEntry], cp, phaseOpts.repairEnv || {}, phaseLabel
        );
        if (!pmSpawn.ok) return pmSpawn;
        cp = pmSpawn.cp;

        // Verify PM produced execution-plan.md
        const fs = require('fs');
        const planPath = path.join(tasksDir, taskId, 'reports', 'execution-plan.md');
        const planExists = fs.existsSync(planPath) && fs.statSync(planPath).size > 50;
        if (!planExists) {
          console.error('[engine] PM did not produce execution-plan.md, falling back to parallel');
          // Fall through to normal parallel spawn
        } else {
          console.log(`[engine] Execution Plan ready (${fs.statSync(planPath).size} bytes), spawning downstream workers`);
          bus.emit('phase.started', { taskId, phase: pipelineState, subPhase: 'downstream-planning' });
          const dsSpawn = await _spawnAndBarrier(
            taskId, pipelineState, projectDir, downstreamPlan, cp,
            { ...phaseOpts.repairEnv, AIC_EXECUTION_PLAN: '1' }, phaseLabel
          );
          if (!dsSpawn.ok) return dsSpawn;
          cp = dsSpawn.cp;

          // ── Consistency Checker (before PM Review) ──
          const ccResult = await _runConsistencyChecker(taskId, pipelineState, projectDir);
          if (ccResult.hasConflicts) {
            console.log(`[engine] Consistency checker found conflicts, injecting into PM context`);
          }

          const repaired = await ctx.pmRepairLoop(taskId, pipelineState, projectDir, plan, phaseLabel, cp);
          return repaired.ok ? { ok: true } : { ok: false, pm: false };
        }
      }
    }

    // ── Normal flow (non-PLANNING, repair, or fallback) ──
    const repairSubset = phaseOpts.repairSubset;
    const spawnPlan =
      repairSubset && repairSubset.length ? repairSubset : plan;

    bus.emit('phase.started', { taskId, phase: pipelineState });
    const normalSpawn = await _spawnAndBarrier(
      taskId, pipelineState, projectDir, spawnPlan, cp, phaseOpts.repairEnv || {}, phaseLabel
    );
    if (!normalSpawn.ok) return normalSpawn;
    cp = normalSpawn.cp;

    const repaired = await ctx.pmRepairLoop(
      taskId, pipelineState, projectDir, plan, phaseLabel, cp
    );
    if (!repaired.ok) {
      return { ok: false, pm: false };
    }
    return { ok: true };
  }

  /**
   * Consistency Checker: compare planning artifacts, produce consistency-report.md.
   * Script, not a worker. Runs after barrier, before PM Review.
   */
  async function _runConsistencyChecker(taskId, phase, projectDir) {
    if (phase !== 'PLANNING') return { hasConflicts: false };
    const fs = require('fs');
    const taskDir = path.join(tasksDir, taskId);
    const reportDir = path.join(taskDir, 'reports');

    // Collect planning artifacts (exclude pm-output, execution-plan, consistency-report)
    const workers = ['architect', 'research', 'designer'];
    const artifacts = {};
    for (const w of workers) {
      const artPath = path.join(reportDir, `${w}-output.md`);
      if (fs.existsSync(artPath)) {
        artifacts[w] = fs.readFileSync(artPath, 'utf8');
      }
    }
    if (Object.keys(artifacts).length < 2) return { hasConflicts: false };

    // Call consistency-checker.py
    
    const ccScript = path.join(scriptDir, 'consistency-checker.py');
    if (!fs.existsSync(ccScript)) return { hasConflicts: false };

    const result = await new Promise((resolve) => {
      const { spawn } = require('child_process');
      const files = Object.entries(artifacts).map(([w]) => path.join(reportDir, `${w}-output.md`));
      const child = spawn('python3', [ccScript, ...files, '--output', path.join(reportDir, 'consistency-report.md')], {
        cwd: projectDir, stdio: 'pipe'
      });
      let stdout = '';
      child.stdout.on('data', (d) => stdout += d);
      child.on('close', (code) => resolve({ code, stdout }));
      child.on('error', () => resolve({ code: 1, stdout: '' }));
    });

    return { hasConflicts: result.code === 2, report: result.stdout };
  }

  ctx.reconcilePhaseBarrier = reconcilePhaseBarrier;
  ctx.logBarrierIncomplete = logBarrierIncomplete;
  ctx.spawnWorkersForPhase = spawnWorkersForPhase;
  ctx.runPhase = runPhase;
}

module.exports = { createPhaseRunner };
