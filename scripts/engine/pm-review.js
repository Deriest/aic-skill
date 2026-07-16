'use strict';

const fs = require('fs');
const path = require('path');
const { filterPmArtifacts, spawnBash, spawnNode, syncDashboardFromCheckpoint } = require('./helpers');

/**
 * Factory: attaches { runPmReview, pmRepairLoop } to ctx.
 * @param {object} ctx - mutable shared engine context
 */
function createPmReview(ctx) {
  const {
    skillDir, scriptDir, tasksDir,
    getState, saveState, bus,
  } = ctx;
  const { resetWorkersForRepair } = require('./barrier');
  const { readCheckpoint, writeCheckpoint } = require('./persistence');

  async function runPmReview(phase, projectDir, taskId) {
    const reportDir = path.join(tasksDir, taskId, 'reports');
    let artifacts = [];
    if (fs.existsSync(reportDir)) {
      for (const f of fs.readdirSync(reportDir)) {
        if (f.endsWith('.md')) artifacts.push(path.join(reportDir, f));
      }
    }
    if (!artifacts.length) return { allPass: true, skipped: true };

    artifacts = filterPmArtifacts(skillDir, phase, artifacts);

    const state = getState();
    state.runtimeGate = {
      type: 'pm-review',
      owner: 'pm',
      target: phase,
      status: 'reviewing',
      startedAt: Date.now(),
      metadata: null,
    };
    saveState();

// WP-3.3: Mechanical Validation Gate
    const targetWorkers = artifacts.map(a => path.basename(a, '-output.md'));
    const valCode = await spawnBash(skillDir,
      path.join(scriptDir, 'validate-framework-invariants.sh'),
      [path.join(tasksDir, taskId), targetWorkers.join(',')]
    );

    if (valCode !== 0) {
      console.log(`[engine] Mechanical Validation Gate FAILED for ${taskId}`);
      state.pmReview = {
        phase,
        verdicts: { all: 'BLOCKED' },
        feedback: { verdict: 'BLOCKED', reason: 'InvalidArtifact', decision_package: { owner: 'Worker', root_cause: 'Mechanical Validation Failed', engineering_objective: 'Ensure deliverables have H1 and meet minimum length', expected_deliverables: targetWorkers.map(w => w + '-output.md'), completion_criteria: [] } },
        completedAt: Date.now(),
        exitCode: 2,
      };
      saveState();
      bus.emit('pm.review.completed', { phase, allPass: false });
      return { allPass: false, exitCode: 2 };
    }

    const code = await spawnBash(skillDir,
      path.join(scriptDir, 'pm-review.sh'),
      [phase, projectDir, ...artifacts],
      { AIC_TASK_ID: taskId }
    );

    const allPass = code === 0;
    state.pmReview = {
      phase,
      verdicts: { all: allPass ? 'PASS' : code === 2 ? 'BLOCKED' : 'REWORK' },
      feedback: {},
      completedAt: Date.now(),
      exitCode: code,
    };
    if (allPass) {
      state.rework = null;
    }
    state.runtimeGate = null;
    saveState();
    bus.emit('pm.review.completed', { phase, allPass });
    return { allPass, exitCode: code };
  }

  async function pmRepairLoop(taskId, pipelineState, projectDir, plan, phaseLabel, cp) {
    const {
      recordCycle, evaluateProgress, selectStrategy,
      getStrategyAction, summarizeRecovery, STRATEGIES,
    } = require('./recovery-strategy');

    const maxCycles = STRATEGIES.length + 2; // Hard ceiling: strategies + grace
    let attempt = cp.rework?.attempt || 0;

    while (true) {
      const pm = await runPmReview(phaseLabel, projectDir, taskId);

      if (pm.allPass) {
        cp.rework = null;
        cp.phaseStatus = 'idle';
        cp.pmReview = getState().pmReview;
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        console.log(`[engine] PM PASS after ${attempt} recovery cycles`);
        return { ok: true, cp };
      }

      if (pm.exitCode === 2 || pm.infrastructure_failure) {
        cp.phaseStatus = 'failed';
        cp.pipelineState = 'BLOCKED';
        cp.rework = { phase: pipelineState, attempt, repairedWorkers: [], lastVerdict: 'BLOCKED' };
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        return { ok: false, pm: false, cp };
      }

      attempt += 1;

      // Hard ceiling: prevent infinite loops regardless of strategy
      if (attempt > maxCycles) {
        console.log(`[engine] hard ceiling reached (${maxCycles} cycles) — shipping with caveats`);
        cp.rework = null;
        cp.phaseStatus = 'idle';
        cp.pmReview = getState().pmReview;
        cp.shipWithCaveats = true;
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        bus.emit('phase.passed', { taskId, phase: pipelineState, caveats: true });
        return { ok: true, cp };
      }

      // M2: Read EDP from pm-review.sh output
      let edp = null;
      try {
        edp = JSON.parse(fs.readFileSync(path.join(tasksDir, taskId, 'reports', '.pm-last-edp.json'), 'utf8'));
      } catch (e) {
        console.error('[engine] Failed to parse EDP JSON:', e.message);
        cp.phaseStatus = 'failed';
        cp.pipelineState = 'BLOCKED';
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        return { ok: false, pm: false, cp };
      }

      const pkg = edp.decision_package || {};

      // ── Recovery Strategy Engine ──
      const strategy = selectStrategy(cp, edp, attempt);
      const { action, envExtras } = getStrategyAction(strategy, edp, cp);

      const owner = String(pkg.owner || '').toLowerCase();
      let targets = [];
      if (owner) {
        const allowed = plan.map(p => String(p.worker).toLowerCase());
        const ownerParts = owner.split('/').map(s => s.trim()).filter(Boolean);
        for (const part of ownerParts) {
          if (allowed.includes(part)) targets.push(part);
        }
        if (!targets.length) targets = allowed;
      } else {
        targets = plan.map(p => String(p.worker).toLowerCase());
      }

      // Record cycle
      recordCycle(cp, {
        attempt, strategy, targets,
        rootCause: pkg.root_cause || '',
        verdict: 'REWORK',
      });

      // Evaluate progress
      const progress = evaluateProgress(cp);
      console.log(`[engine] Recovery cycle ${attempt}: strategy=${strategy} progress=${progress.hasProgress} (${progress.reason})`);

      // ── Strategy Actions ──

      if (action === 'ship') {
        console.log('[engine] Recovery exhausted — shipping with documented caveats');
        cp.rework = null;
        cp.phaseStatus = 'idle';
        cp.pmReview = getState().pmReview;
        cp.shipWithCaveats = true;
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        bus.emit('phase.passed', { taskId, phase: pipelineState, caveats: true });
        return { ok: true, cp };
      }

      if (action === 'refine_plan') {
        console.log('[engine] Strategy: execution plan refinement — spawning PM to rewrite plan');
        // Delete current execution plan, spawn PM to rewrite
        const planPath = path.join(tasksDir, taskId, 'reports', 'execution-plan.md');
        try { fs.unlinkSync(planPath); } catch {}
        // Spawn only PM with instruction to refine
        const pmEntry = plan.find(p => p.worker === 'pm');
        if (pmEntry) {
          const refineEnv = {
            ...envExtras,
            AIC_PM_REPAIR: '1',
            AIC_PM_VERDICT_FILE: path.join(tasksDir, taskId, 'reports', '.pm-last-verdict.txt'),
            AIC_PM_REPAIR_WORKERS: 'pm',
            AIC_CONTEXT_FILE: path.join(tasksDir, taskId, 'context.json'),
            AIC_EDP_OBJECTIVE: pkg.engineering_objective || '',
            AIC_EDP_ROOT_CAUSE: pkg.root_cause || '',
            AIC_REPAIR_ATTEMPT: String(attempt),
            AIC_PLAN_REFINEMENT: '1',
          };
          const refineResult = await ctx.spawnWorkersForPhase(
            taskId, pipelineState, projectDir, [pmEntry], cp, refineEnv
          );
          if (refineResult.ok) {
            cp = refineResult.cp;
            // Now spawn downstream with refined plan
            const downstream = plan.filter(p => p.worker !== 'pm');
            if (downstream.length) {
              const dsResult = await ctx.spawnWorkersForPhase(
                taskId, pipelineState, projectDir, downstream, cp,
                { AIC_EXECUTION_PLAN: '1', ...envExtras }
              );
              if (dsResult.ok) cp = dsResult.cp;
            }
          }
        }
        // Continue loop — next iteration will review
        cp.rework.phase = pipelineState;
        cp.phaseStatus = 'spawning';
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        continue;
      }

      if (action === 'pm_author') {
        console.log('[engine] Strategy: PM authoring — PM will directly produce problematic artifact');
        // Spawn PM as the sole worker for the problematic role
        const pmEntry = plan.find(p => p.worker === 'pm');
        if (pmEntry) {
          const authorEnv = {
            ...envExtras,
            AIC_PM_REPAIR: '1',
            AIC_PM_VERDICT_FILE: path.join(tasksDir, taskId, 'reports', '.pm-last-verdict.txt'),
            AIC_PM_REPAIR_WORKERS: targets.join(','),
            AIC_CONTEXT_FILE: path.join(tasksDir, taskId, 'context.json'),
            AIC_EDP_OBJECTIVE: pkg.engineering_objective || '',
            AIC_EDP_ROOT_CAUSE: pkg.root_cause || '',
            AIC_REPAIR_ATTEMPT: String(attempt),
            AIC_PM_AUTHORING: '1',
            AIC_PM_AUTHOR_TARGETS: targets.join(','),
          };
          const authorResult = await ctx.spawnWorkersForPhase(
            taskId, pipelineState, projectDir, [pmEntry], cp, authorEnv
          );
          if (authorResult.ok) cp = authorResult.cp;
        }
        cp.rework.phase = pipelineState;
        cp.phaseStatus = 'spawning';
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        continue;
      }

      // ── Default: repair (targeted or collaborative) ──
      const repairSpawnPlan = plan.filter(p => targets.includes(String(p.worker).toLowerCase()));

      cp.rework = { phase: pipelineState, attempt, repairedWorkers: targets, lastVerdict: 'REWORK', strategy };
      cp.phaseStatus = 'pm_repair';
      resetWorkersForRepair(cp.phaseBarrier, targets);
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(getState, cp, taskId);
      saveState();
      bus.emit('pm.repair.started', { taskId, phase: pipelineState, attempt, targets, strategy });

      const verdictPath = path.join(tasksDir, taskId, 'reports', '.pm-last-verdict.txt');
      const ctxPath = path.join(tasksDir, taskId, 'context.json');
      const delCode = await spawnNode(skillDir,
        path.join(scriptDir, 'pm-repair-respawn.js'),
        ['delete-artifacts', skillDir, taskId, targets.join(',')],
        {}
      );
      if (delCode !== 0) {
        console.error('[engine] pm repair delete-artifacts failed', JSON.stringify({ taskId, code: delCode }));
      }

      const repairEnv = {
        AIC_PM_REPAIR: '1',
        AIC_PM_VERDICT_FILE: verdictPath,
        AIC_PM_REPAIR_WORKERS: targets.join(','),
        AIC_CONTEXT_FILE: ctxPath,
        AIC_EDP_OBJECTIVE: pkg.engineering_objective || '',
        AIC_EDP_ROOT_CAUSE: pkg.root_cause || '',
        AIC_REPAIR_ATTEMPT: String(attempt),
        ...envExtras,
      };

      cp.phaseStatus = 'spawning';
      writeCheckpoint(tasksDir, taskId, cp);
      const spawnResult = await ctx.spawnWorkersForPhase(
        taskId, pipelineState, projectDir, repairSpawnPlan, cp, repairEnv
      );
      if (!spawnResult.ok) {
        console.error(`[engine] Recovery spawn failed (strategy=${strategy})`);
        cp.pipelineState = 'BLOCKED';
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        return { ok: false, spawn: false, cp: spawnResult.cp || cp };
      }
      cp = spawnResult.cp;
    }
  }

  ctx.runPmReview = runPmReview;
  ctx.pmRepairLoop = pmRepairLoop;
}

module.exports = { createPmReview };
