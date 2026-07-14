'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createEventBus } = require('./events');
const {
  PHASE_PLANS,
  normalizePhase,
  nextPhase,
  phaseToCurrentPhase,
  isTerminal,
} = require('./fsm');
const {
  startBarrier,
  barrierSatisfied,
  markWorkerComplete,
  markWorkerFailed,
  clearBarrier,
  resetWorkersForRepair,
} = require('./barrier');
const {
  getMaxPmRepairAttempts,
  parseWorkersFromPmVerdict,
  resolvePmRepairTargets,
  readPmVerdictFile,
} = require('./pm-repair');
const {
  ensureTaskDir,
  readCheckpoint,
  writeCheckpoint,
  allocateTaskId,
} = require('./persistence');
const { reconcileOnStartup } = require('./recovery');
const {
  validateArtifactFile,
  resolveArtifactPath,
  runShellValidation,
} = require('./validate-artifact');

function loadContracts(skillDir) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(skillDir, '.aic', 'runtime-contracts.json'), 'utf8')
    );
  } catch {
    return { defaultReport: { minBytes: 10, minContentLines: 2 } };
  }
}

function filterPmArtifacts(skillDir, phase, artifactPaths) {
  const norm = String(phase).toLowerCase().replace(/[^a-z]/g, '');
  const fileMap = { investigate: 'investigate.json', implementation: 'implementation.json' };
  const fname = fileMap[norm];
  if (!fname) return artifactPaths;
  const cpath = path.join(skillDir, '.aic', 'phase-contracts', fname);
  if (!fs.existsSync(cpath)) return artifactPaths;
  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(cpath, 'utf8'));
  } catch {
    return artifactPaths;
  }
  const allowed = new Set();
  for (const rc of Object.values(contract.roles || {})) {
    if (rc.artifact?.filename) allowed.add(rc.artifact.filename);
  }
  const filtered = artifactPaths.filter((p) => allowed.has(path.basename(p)));
  return filtered.length ? filtered : artifactPaths;
}

function createEngine(opts) {
  const {
    skillDir,
    scriptDir,
    tasksDir,
    workerIds,
    getState,
    setState,
    saveState,
    getActiveProject,
  } = opts;

  const bus = createEventBus();
  const contracts = loadContracts(skillDir);
  let pipelineRunning = false;
  let activePipelineTaskId = null;

  function checkpointTaskId(cp) {
    return cp?.id || cp?.taskId || null;
  }

  function syncDashboardFromCheckpoint(cp, taskId) {
    const state = getState();
    if (!cp) return;
    const cpId = checkpointTaskId(cp);
    const activeId = taskId || state.currentTask?.id;
    if (!cpId || !activeId || cpId !== activeId) return;
    state.currentPhase = phaseToCurrentPhase(cp.pipelineState);
    if (state.currentTask && state.currentTask.id === cpId) {
      state.currentTask.pipelineState = cp.pipelineState;
      state.currentTask.phaseStatus = cp.phaseStatus;
    }
    state.phaseBarrier = cp.phaseBarrier || null;
    state.runtimeGate = cp.runtimeGate || null;
    state.pmReview = cp.pmReview || null;
    state.rework = cp.rework || null;
  }

  function pipelineBusyError() {
    return {
      ok: false,
      error: 'pipeline_busy',
      message: 'Another engineering pipeline is already running.',
      activeTaskId: activePipelineTaskId,
    };
  }

  function isCheckpointTerminal(pipelineState) {
    return pipelineState === 'COMPLETE' || pipelineState === 'CANCELLED';
  }

  function taskActiveOwnershipError(state, activeTaskId, ownerCp) {
    return {
      ok: false,
      error: 'task_active',
      message: 'Another task still owns the Runtime until it is COMPLETE or CANCELLED.',
      activeTaskId,
      activePhase: state.currentPhase || null,
      pipelineState: ownerCp?.pipelineState ?? null,
    };
  }

  function validateTaskDescription(description) {
    const d = String(description || '').trim();
    if (d.length < 40) {
      return {
        ok: false,
        error: 'description_required',
        message:
          'Task description must be at least 40 characters with clear deliverables for PM Review.',
      };
    }
    return { ok: true };
  }

  function resetWorkersIdle() {
    const state = getState();
    for (const w of workerIds) {
      state.workers[w] = {
        status: 'idle',
        engine: null,
        currentTask: null,
        subWorkers: state.workers[w]?.subWorkers || [],
        leaseId: null,
      };
    }
    state.workers.dispatcher.status = 'working';
  }

  function buildSnapshot() {
    const state = getState();
    const project = getActiveProject();
    return {
      connected: true,
      workers: state.workers,
      currentTask: state.currentTask,
      currentPhase: state.currentPhase,
      runtimeGate: state.runtimeGate,
      phaseBarrier: state.phaseBarrier,
      pmReview: state.pmReview,
      rework: state.rework,
      startedAt: state.startedAt,
      project,
      engine: {
        paused: !!state.engine?.paused,
        pipelineRunning,
        events: bus.list(20),
      },
    };
  }

  function spawnBash(script, args, envExtra = {}) {
    return new Promise((resolve) => {
      const child = spawn('bash', [script, ...args], {
        cwd: skillDir,
        env: { ...process.env, ...envExtra, AIC_RUNTIME_ENGINE: '1' },
        stdio: 'inherit',
      });
      child.on('close', (code) => resolve(code ?? 1));
      child.on('error', () => resolve(1));
    });
  }

  function spawnNode(script, args, envExtra = {}) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [script, ...args], {
        cwd: skillDir,
        env: { ...process.env, ...envExtra, AIC_RUNTIME_ENGINE: '1' },
        stdio: 'inherit',
      });
      child.on('close', (code) => resolve(code ?? 1));
      child.on('error', () => resolve(1));
    });
  }

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

    const code = await spawnBash(
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
    const code = await spawnBash(
      path.join(scriptDir, 'phase-runner.sh'),
      [phaseLabel, projectDir, ...planSubset.map((p) => `${p.worker},${p.tier}`)],
      { AIC_TASK_ID: taskId, AIC_PIPELINE_PHASE: pipelineState, ...envExtra }
    );
    cp = readCheckpoint(tasksDir, taskId) || cp;
    if (code !== 0) {
      cp.phaseStatus = 'failed';
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(cp, taskId);
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
      syncDashboardFromCheckpoint(cp, taskId);
      console.log(
        '[engine] barrier reconciled',
        JSON.stringify({ taskId, phase: pipelineState, reconciled })
      );
    }
    if (!barrierSatisfied(cp.phaseBarrier)) {
      logBarrierIncomplete(taskId, cp);
      cp.phaseStatus = 'failed';
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(cp, taskId);
      saveState();
      return { ok: false, error: 'barrier incomplete', cp };
    }
    writeCheckpoint(tasksDir, taskId, cp);
    syncDashboardFromCheckpoint(cp, taskId);
    saveState();
    bus.emit('barrier.completed', { taskId, phase: pipelineState });
    return { ok: true, cp };
  }

  async function runPhase(taskId, pipelineState, projectDir, phaseOpts = {}) {
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
    syncDashboardFromCheckpoint(cp, taskId);
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

    const repaired = await pmRepairLoop(
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

  async function pmRepairLoop(
    taskId,
    pipelineState,
    projectDir,
    plan,
    phaseLabel,
    cp
  ) {
    const maxAttempts = getMaxPmRepairAttempts(contracts);
    let attempt = cp.rework?.attempt || 0;

    while (true) {
      const pm = await runPmReview(phaseLabel, projectDir, taskId);
      if (pm.allPass) {
        cp.rework = null;
        cp.phaseStatus = 'idle';
        cp.pmReview = getState().pmReview;
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(cp, taskId);
        saveState();
        return { ok: true, cp };
      }

      if (pm.exitCode === 2 || pm.exitCode === 3) {
        cp.phaseStatus = 'failed';
        cp.pipelineState = 'BLOCKED';
        cp.rework = {
          phase: pipelineState,
          attempt,
          repairedWorkers: [],
          lastVerdict: pm.exitCode === 2 ? 'BLOCKED' : 'UNKNOWN',
        };
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(cp, taskId);
        saveState();
        return { ok: false, pm: false, cp };
      }

      attempt += 1;
      if (attempt > maxAttempts) {
        console.error(
          '[engine] pm repair limit exceeded',
          JSON.stringify({ taskId, phase: pipelineState, attempt, maxAttempts })
        );
        cp.phaseStatus = 'failed';
        cp.pipelineState = 'BLOCKED';
        cp.rework = {
          phase: pipelineState,
          attempt,
          repairedWorkers: [],
          lastVerdict: 'REWORK',
        };
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(cp, taskId);
        saveState();
        return { ok: false, pm: false, repairLimit: true, cp };
      }

      const verdictText = readPmVerdictFile(tasksDir, taskId);
      const resolved = resolvePmRepairTargets(
        verdictText,
        pipelineState,
        plan,
        PHASE_PLANS
      );
      let targets = resolved.workers;
      let repairSpawnPlan = resolved.spawnPlan;
      if (!targets.length) {
        targets = plan.map((p) => String(p.worker).toLowerCase());
        repairSpawnPlan = plan;
        console.log(
          '[engine] pm repair full-phase fallback',
          JSON.stringify({ taskId, phase: pipelineState })
        );
      } else if (resolved.artifactPhase) {
        console.log(
          '[engine] pm repair cross-phase targets',
          JSON.stringify({
            taskId,
            repairPipelinePhase: pipelineState,
            artifactPhase: resolved.artifactPhase,
            targets,
          })
        );
      }

      cp.rework = {
        phase: pipelineState,
        attempt,
        repairedWorkers: targets,
        lastVerdict: 'REWORK',
        artifactPhase: resolved.artifactPhase || null,
      };
      cp.phaseStatus = 'pm_repair';
      resetWorkersForRepair(cp.phaseBarrier, targets);
      writeCheckpoint(tasksDir, taskId, cp);
      syncDashboardFromCheckpoint(cp, taskId);
      saveState();
      bus.emit('pm.repair.started', {
        taskId,
        phase: pipelineState,
        attempt,
        targets,
      });

      const verdictPath = path.join(
        tasksDir,
        taskId,
        'reports',
        '.pm-last-verdict.txt'
      );
      const ctxPath = path.join(tasksDir, taskId, 'context.json');
      const delCode = await spawnNode(
        path.join(scriptDir, 'pm-repair-respawn.js'),
        [
          'delete-artifacts',
          skillDir,
          taskId,
          targets.join(','),
        ],
        {}
      );
      if (delCode !== 0) {
        console.error(
          '[engine] pm repair delete-artifacts failed',
          JSON.stringify({ taskId, code: delCode })
        );
      }

      const spawnPipelineState =
        resolved.artifactPhase && repairSpawnPlan.length
          ? resolved.artifactPhase
          : pipelineState;

      const repairEnv = {
        AIC_PM_REPAIR: '1',
        AIC_PM_VERDICT_FILE: verdictPath,
        AIC_PM_REPAIR_WORKERS: targets.join(','),
        AIC_CONTEXT_FILE: ctxPath,
      };

      if (
        spawnPipelineState !== pipelineState &&
        repairSpawnPlan.length
      ) {
        console.log(
          '[engine] pm repair cross-phase re-entry',
          JSON.stringify({
            taskId,
            interruptedPhase: pipelineState,
            artifactPhase: spawnPipelineState,
            targets,
            attempt,
          })
        );
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(cp, taskId);
        saveState();
        const reenter = await runPhase(taskId, spawnPipelineState, projectDir, {
          repairSubset: repairSpawnPlan,
          repairEnv,
        });
        if (!reenter.ok) {
          cp = readCheckpoint(tasksDir, taskId) || cp;
          cp.pipelineState = 'BLOCKED';
          cp.phaseStatus = 'failed';
          writeCheckpoint(tasksDir, taskId, cp);
          syncDashboardFromCheckpoint(cp, taskId);
          saveState();
          return { ok: false, crossPhase: true, cp };
        }
        cp = readCheckpoint(tasksDir, taskId) || cp;
        cp.pipelineState = pipelineState;
        cp.phaseStatus = 'spawning';
        cp.phaseBarrier = startBarrier(plan.map((p) => p.worker));
        cp.rework = {
          phase: pipelineState,
          attempt,
          repairedWorkers: targets,
          lastVerdict: 'REWORK',
          artifactPhase: spawnPipelineState,
        };
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(cp, taskId);
        saveState();
        continue;
      }

      cp.phaseStatus = 'spawning';
      writeCheckpoint(tasksDir, taskId, cp);
      const spawn = await spawnWorkersForPhase(
        taskId,
        spawnPipelineState,
        projectDir,
        repairSpawnPlan,
        cp,
        repairEnv
      );
      if (!spawn.ok) {
        cp.pipelineState = 'BLOCKED';
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(cp, taskId);
        saveState();
        return { ok: false, spawn: false, cp: spawn.cp || cp };
      }
      cp = spawn.cp;
    }
  }

  async function runPipeline(taskId, projectDir) {
    if (pipelineRunning && activePipelineTaskId !== taskId) {
      return { ok: false, error: 'pipeline_busy', activeTaskId: activePipelineTaskId };
    }
    if (!pipelineRunning) {
      pipelineRunning = true;
      activePipelineTaskId = taskId;
    }
    try {
      const sequence = [
        'INVESTIGATE',
        'PLANNING',
        'IMPLEMENTATION',
        'VERIFICATION',
        'CLOSEOUT',
      ];
      for (const phase of sequence) {
        const state = getState();
        if (state.engine?.paused) {
          bus.emit('task.paused', { taskId });
          return { ok: false, paused: true };
        }
        const r = await runPhase(taskId, phase, projectDir);
        if (!r.ok) return r;
        const cp = readCheckpoint(tasksDir, taskId) || {};
        cp.pipelineState = phase;
        writeCheckpoint(tasksDir, taskId, cp);
      }

      await completeTask(taskId);
      return { ok: true };
    } finally {
      if (activePipelineTaskId === taskId) {
        pipelineRunning = false;
        activePipelineTaskId = null;
      }
    }
  }

  function triggerKnowledgeAsync(taskId) {
    bus.emit('knowledge.started', { taskId });
    try {
      const kDir = path.join(skillDir, 'knowledge');
      const kFile = path.join(kDir, 'task-entries.json');
      const entries = fs.existsSync(kFile)
        ? JSON.parse(fs.readFileSync(kFile, 'utf8'))
        : [];
      entries.push({ task_id: taskId, status: 'done', timestamp: Date.now() });
      fs.mkdirSync(kDir, { recursive: true });
      fs.writeFileSync(kFile, JSON.stringify(entries, null, 2));
      bus.emit('knowledge.completed', { taskId });
    } catch {
      bus.emit('knowledge.completed', { taskId, error: 'best-effort' });
    }
  }

  function completeTask(taskId) {
    const state = getState();
    const cp = readCheckpoint(tasksDir, taskId) || {};
    cp.pipelineState = 'COMPLETE';
    cp.phaseStatus = 'idle';
    cp.phaseBarrier = clearBarrier();
    writeCheckpoint(tasksDir, taskId, cp);

    state.currentPhase = 'Complete';
    if (state.currentTask) {
      state.currentTask.pipelineState = 'COMPLETE';
      state.currentTask.phaseStatus = 'idle';
    }
    state.phaseBarrier = null;
    state.runtimeGate = null;
    state.currentTask = null;
    saveState();
    bus.emit('task.completed', { taskId });
    triggerKnowledgeAsync(taskId);
    return { ok: true };
  }

  function issueLease({ taskId, worker, tier, projectDir }) {
    const state = getState();
    const cp = readCheckpoint(tasksDir, taskId);
    if (!cp || !state.currentTask || state.currentTask.id !== taskId) {
      return { ok: false, error: 'invalid task' };
    }
    const phase = normalizePhase(cp.pipelineState);
    const plan = PHASE_PLANS[phase] || [];
    const allowed = plan.map((p) => p.worker);
    const w = String(worker).toLowerCase();
    if (!allowed.includes(w)) {
      return { ok: false, error: `worker ${w} not in phase ${phase}` };
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
      syncDashboardFromCheckpoint(cp, lease.taskId);
    }
    saveState();
    bus.emit('worker.completed', { leaseId, worker: w, taskId: lease.taskId });
    return { ok: true };
  }

  async function handleIntent(intent, body) {
    const state = getState();
    if (!state.engine) state.engine = { paused: false, leases: {} };

    switch (intent) {
      case 'task.create': {
        const taskId = body.id || allocateTaskId(tasksDir);
        if (!body.title) return { ok: false, error: 'title required' };
        const descCheck = validateTaskDescription(body.description);
        if (!descCheck.ok) return descCheck;
        ensureTaskDir(tasksDir, taskId);
        fs.writeFileSync(
          path.join(tasksDir, taskId, 'context.json'),
          JSON.stringify(
            {
              taskId,
              title: body.title,
              description: body.description || '',
              projectDir: body.projectDir || '',
              createdAt: new Date().toISOString(),
            },
            null,
            2
          )
        );
        const cp = {
          id: taskId,
          pipelineState: 'CREATED',
          phaseStatus: 'idle',
          projectDir: body.projectDir || '',
          phaseBarrier: null,
        };
        writeCheckpoint(tasksDir, taskId, cp);
        bus.emit('task.created', { taskId });
        return { ok: true, taskId };
      }
      case 'task.start': {
        if (pipelineRunning) return pipelineBusyError();
        const taskId = body.taskId || state.currentTask?.id;
        if (!taskId || !taskId.startsWith('TASK-')) {
          return { ok: false, error: 'TASK-* taskId required' };
        }
        const ownerId = state.currentTask?.id;
        if (ownerId && ownerId !== taskId) {
          const ownerCp = readCheckpoint(tasksDir, ownerId);
          const ownerPs = ownerCp?.pipelineState;
          if (ownerPs && !isCheckpointTerminal(ownerPs)) {
            return taskActiveOwnershipError(state, ownerId, ownerCp);
          }
        }
        const cp = readCheckpoint(tasksDir, taskId);
        const projectDir =
          body.projectDir || cp?.projectDir || getActiveProject().workspace;
        if (!projectDir) return { ok: false, error: 'projectDir required' };
        const ctx = readTaskContext(tasksDir, taskId);
        const descCheck = validateTaskDescription(ctx?.description);
        if (!descCheck.ok) return descCheck;

        state.currentTask = {
          id: taskId,
          title: body.title || readTaskContext(tasksDir, taskId)?.title || 'Task',
          type: body.type || 'feature',
          pipelineState: 'INVESTIGATE',
          phaseStatus: 'spawning',
        };
        resetWorkersIdle();
        cp.pipelineState = 'INVESTIGATE';
        cp.phaseStatus = 'spawning';
        cp.projectDir = projectDir;
        writeCheckpoint(tasksDir, taskId, cp);
        syncDashboardFromCheckpoint(cp, taskId);
        saveState();
        bus.emit('task.started', { taskId });

        pipelineRunning = true;
        activePipelineTaskId = taskId;
        setImmediate(() => {
          runPipeline(taskId, projectDir)
            .catch((e) => {
              console.error('[engine] pipeline error', e);
            })
            .finally(() => {
              pipelineRunning = false;
              activePipelineTaskId = null;
            });
        });
        return { ok: true, taskId, started: true };
      }
      case 'task.pause': {
        state.engine.paused = true;
        saveState();
        bus.emit('task.paused', { taskId: body.taskId });
        return { ok: true };
      }
      case 'task.resume': {
        if (pipelineRunning) return pipelineBusyError();
        state.engine.paused = false;
        const taskId = body.taskId || state.currentTask?.id;
        const cp = readCheckpoint(tasksDir, taskId);
        const projectDir = cp?.projectDir || body.projectDir;
        if (taskId && projectDir) {
          pipelineRunning = true;
          activePipelineTaskId = taskId;
          setImmediate(() =>
            runPipeline(taskId, projectDir).finally(() => {
              pipelineRunning = false;
              activePipelineTaskId = null;
            })
          );
        }
        bus.emit('task.resumed', { taskId });
        return { ok: true };
      }
      case 'task.cancel': {
        const taskId = body.taskId || state.currentTask?.id;
        if (taskId) {
          const cp = readCheckpoint(tasksDir, taskId) || {};
          cp.pipelineState = 'CANCELLED';
          writeCheckpoint(tasksDir, taskId, cp);
        }
        state.currentTask = null;
        state.currentPhase = null;
        for (const w of workerIds) {
          state.workers[w].status = 'idle';
        }
        saveState();
        bus.emit('task.cancelled', { taskId });
        return { ok: true };
      }
      case 'task.retry': {
        if (pipelineRunning) return pipelineBusyError();
        state.engine.paused = false;
        const taskId = body.taskId || state.currentTask?.id;
        const cp = readCheckpoint(tasksDir, taskId);
        if (cp && cp.pipelineState === 'BLOCKED') {
          cp.pipelineState = body.phase
            ? normalizePhase(body.phase)
            : 'INVESTIGATE';
          cp.phaseStatus = 'idle';
          writeCheckpoint(tasksDir, taskId, cp);
        }
        if (taskId && cp?.projectDir) {
          pipelineRunning = true;
          activePipelineTaskId = taskId;
          setImmediate(() =>
            runPipeline(taskId, cp.projectDir).finally(() => {
              pipelineRunning = false;
              activePipelineTaskId = null;
            })
          );
        }
        return { ok: true };
      }
      default:
        return { ok: false, error: `unknown intent: ${intent}` };
    }
  }

  function readTaskContext(tasksDir, taskId) {
    try {
      return JSON.parse(
        fs.readFileSync(path.join(tasksDir, taskId, 'context.json'), 'utf8')
      );
    } catch {
      return null;
    }
  }

  function startupReconcile() {
    const notes = reconcileOnStartup(getState(), tasksDir, workerIds);
    saveState();
    return notes;
  }

  function legacyMutationBlocked() {
    return {
      ok: false,
      error:
        'Runtime Engine owns pipeline state. Use POST /api/runtime/intent with task.* or lease APIs.',
    };
  }

  return {
    bus,
    buildSnapshot,
    handleIntent,
    issueLease,
    finishLease,
    completeTask,
    startupReconcile,
    legacyMutationBlocked,
    runPipeline,
  };
}

module.exports = { createEngine };