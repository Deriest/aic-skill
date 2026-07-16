'use strict';

const { createEventBus } = require('./events');
const { reconcileOnStartup } = require('./recovery');
const { loadContracts } = require('./helpers');
const { createPmReview } = require('./pm-review');
const { createPhaseRunner } = require('./phase-runner');
const { createPipeline } = require('./pipeline');
const { createLease } = require('./lease');
const { createIntent } = require('./intent');

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

  // Mutable context shared by all sub-modules.
  // Factories attach their exported functions onto ctx.
  const ctx = {
    skillDir,
    scriptDir,
    tasksDir,
    workerIds,
    getState,
    setState,
    saveState,
    getActiveProject,
    bus,
    contracts,
    pipelineRunning: false,
    activePipelineTaskId: null,
  };

  // Wire up sub-modules (order matters: phase-runner needs pmRepairLoop,
  // pipeline needs runPhase, etc.)
  createPmReview(ctx);       // ctx.runPmReview, ctx.pmRepairLoop
  createPhaseRunner(ctx);    // ctx.reconcilePhaseBarrier, ctx.spawnWorkersForPhase, ctx.runPhase
  createPipeline(ctx);       // ctx.runPipeline, ctx.completeTask, ctx.triggerKnowledgeAsync
  createLease(ctx);          // ctx.issueLease, ctx.finishLease
  createIntent(ctx);         // ctx.handleIntent

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
        pipelineRunning: ctx.pipelineRunning,
        events: bus.list(20),
      },
    };
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
    handleIntent: ctx.handleIntent,
    issueLease: ctx.issueLease,
    finishLease: ctx.finishLease,
    completeTask: ctx.completeTask,
    startupReconcile,
    legacyMutationBlocked,
    runPipeline: ctx.runPipeline,
  };
}

module.exports = { createEngine };
