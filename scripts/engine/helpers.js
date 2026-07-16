'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { phaseToCurrentPhase } = require('./fsm');

// --- Existing helpers ---

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

// --- Shared utilities ---

function checkpointTaskId(cp) {
  return cp?.id || cp?.taskId || null;
}

function syncDashboardFromCheckpoint(getState, cp, taskId) {
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

function pipelineBusyError(activePipelineTaskId) {
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

function resetWorkersIdle(state, workerIds) {
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

function spawnBash(skillDir, script, args, envExtra = {}) {
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

function spawnNode(skillDir, script, args, envExtra = {}) {
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

function readTaskContext(tasksDir, taskId) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(tasksDir, taskId, 'context.json'), 'utf8')
    );
  } catch {
    return null;
  }
}

module.exports = {
  loadContracts,
  filterPmArtifacts,
  checkpointTaskId,
  syncDashboardFromCheckpoint,
  pipelineBusyError,
  isCheckpointTerminal,
  taskActiveOwnershipError,
  validateTaskDescription,
  resetWorkersIdle,
  spawnBash,
  spawnNode,
  readTaskContext,
};
