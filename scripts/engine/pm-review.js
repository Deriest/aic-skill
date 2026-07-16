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
    const maxAttempts = 3;
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
      if (attempt > maxAttempts) {
        console.error('[engine] pm repair limit exceeded');
        cp.phaseStatus = 'failed';
        cp.pipelineState = 'BLOCKED';
        cp.rework = { phase: pipelineState, attempt, repairedWorkers: [], lastVerdict: 'REWORK' };
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(getState, cp, taskId);
        saveState();
        return { ok: false, pm: false, repairLimit: true, cp };
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
      const owner = String(pkg.owner || '').toLowerCase();
      let targets = [];
      if (owner) {
        const allowed = plan.map(p => String(p.worker).toLowerCase());
        // Handle slash-separated owners like "Architect/Research"
        const ownerParts = owner.split('/').map(s => s.trim()).filter(Boolean);
        for (const part of ownerParts) {
          if (allowed.includes(part)) targets.push(part);
        }
        // Fallback to all workers if no individual owner matched
        if (!targets.length) targets = allowed;
      } else {
        targets = plan.map(p => String(p.worker).toLowerCase());
      }

      const repairSpawnPlan = plan.filter(p => targets.includes(String(p.worker).toLowerCase()));

      cp.rework = { phase: pipelineState, attempt, repairedWorkers: targets, lastVerdict: 'REWORK' };
      cp.phaseStatus = 'pm_repair';
      resetWorkersForRepair(cp.phaseBarrier, targets);
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(getState, cp, taskId);
      saveState();
      bus.emit('pm.repair.started', { taskId, phase: pipelineState, attempt, targets });

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
      };

      cp.phaseStatus = 'spawning';
      writeCheckpoint(tasksDir, taskId, cp);
      const spawnResult = await ctx.spawnWorkersForPhase(
        taskId, pipelineState, projectDir, repairSpawnPlan, cp, repairEnv
      );
      if (!spawnResult.ok) {
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
