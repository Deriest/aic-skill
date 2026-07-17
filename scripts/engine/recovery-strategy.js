'use strict';

/**
 * Recovery Strategy Engine — replaces fixed retry counting with
 * evidence-based, adaptive recovery.
 *
 * Recovery is driven by:
 * 1. Root cause analysis (from PM verdict EDP)
 * 2. Measurable progress between cycles
 * 3. Strategy evolution when progress stalls
 * 4. Historical effectiveness data
 */

const fs = require('fs');
const path = require('path');

// ── Strategy Ladder (escalation order) ──
const STRATEGIES = [
  'targeted_repair',           // Default: repair only affected workers + feedback
  'collaborative_repair',      // Repair with sibling artifacts injected
  'execution_plan_refinement', // PM rewrites execution plan, then workers re-execute
  'pm_authoring',              // PM directly writes the problematic artifact
  'ship_with_caveats',         // Final: ship product, document gaps
];

/**
 * Record a recovery cycle's data into checkpoint rework history.
 */
function recordCycle(cp, cycleData) {
  if (!cp.reworkHistory) cp.reworkHistory = [];
  cp.reworkHistory.push({
    attempt: cycleData.attempt,
    strategy: cycleData.strategy,
    targets: cycleData.targets,
    rootCause: cycleData.rootCause,
    timestamp: Date.now(),
    verdict: cycleData.verdict || 'REWORK',
  });
  // Keep last 20 cycles
  if (cp.reworkHistory.length > 20) {
    cp.reworkHistory = cp.reworkHistory.slice(-20);
  }
}

/**
 * Evaluate engineering progress between consecutive recovery cycles.
 *
 * Returns { hasProgress, reason, metric }
 */
function evaluateProgress(cp) {
  const history = cp.reworkHistory || [];
  if (history.length < 2) {
    // First cycle — assume progress opportunity exists
    return { hasProgress: true, reason: 'first_cycle', metric: null };
  }

  const current = history[history.length - 1];
  const previous = history[history.length - 2];

  // Check 1: Root cause changed (issue shifted = progress)
  if (current.rootCause && previous.rootCause &&
      current.rootCause !== previous.rootCause) {
    return { hasProgress: true, reason: 'root_cause_shifted', metric: 'different_root_cause' };
  }

  // Check 2: Fewer targeted workers (narrowing = progress)
  if (current.targets?.length < previous.targets?.length) {
    return { hasProgress: true, reason: 'scope_narrowed', metric: `${previous.targets.length}→${current.targets.length} workers` };
  }

  // Check 3: Different targets (shifted focus = progress)
  const currSet = new Set(current.targets || []);
  const prevSet = new Set(previous.targets || []);
  const sameTargets = currSet.size === prevSet.size &&
    [...currSet].every(t => prevSet.has(t));
  if (!sameTargets) {
    return { hasProgress: true, reason: 'targets_shifted', metric: 'different_workers' };
  }

  // Check 4: Same root cause, same targets = stalled
  if (current.rootCause === previous.rootCause &&
      sameTargets && current.strategy === previous.strategy) {
    return { hasProgress: false, reason: 'stalled_same_strategy', metric: 'identical_cycle' };
  }

  // Check 5: Same root cause but different strategy = trying harder
  if (current.rootCause === previous.rootCause &&
      sameTargets && current.strategy !== previous.strategy) {
    // Check if this strategy was tried before with same root cause
    const priorWithSameStrategy = history.slice(0, -1).filter(
      h => h.strategy === current.strategy && h.rootCause === current.rootCause
    );
    if (priorWithSameStrategy.length > 0) {
      return { hasProgress: false, reason: 'strategy_repeat', metric: `${current.strategy} already tried for this root cause` };
    }
    return { hasProgress: true, reason: 'strategy_evolved', metric: `${previous.strategy}→${current.strategy}` };
  }

  // Default: assume progress if cycle is different enough
  return { hasProgress: true, reason: 'cycle_different', metric: null };
}

/**
 * Select the next recovery strategy based on evidence.
 *
 * @param {object} cp - checkpoint with reworkHistory
 * @param {object} edp - PM's Engineering Decision Package
 * @param {number} attempt - current attempt number
 * @returns {string} strategy name
 */
function selectStrategy(cp, edp, attempt) {
  const history = cp.reworkHistory || [];
  const progress = evaluateProgress(cp);

  // First cycle: always start with targeted repair
  if (attempt <= 1) return 'targeted_repair';

  // Hard cap: after 4 attempts on same phase, always ship (ponytail: root_cause_shifted loops forever)
  if (attempt > 4) return 'ship_with_caveats';

  // If progress exists with current strategy, keep it
  if (progress.hasProgress && history.length > 0) {
    const lastStrategy = history[history.length - 1].strategy;
    if (lastStrategy && STRATEGIES.includes(lastStrategy)) {
      return lastStrategy;
    }
  }

  // Progress stalled: escalate to next strategy
  if (!progress.hasProgress) {
    const currentStrategy = history.length > 0 ? history[history.length - 1].strategy : 'targeted_repair';
    const currentIdx = STRATEGIES.indexOf(currentStrategy);
    const nextIdx = Math.min(currentIdx + 1, STRATEGIES.length - 1);
    return STRATEGIES[nextIdx];
  }

  // Default escalation based on attempt number
  // ponytail: simple mapping, upgrade to ML-based selection with historical data
  if (attempt <= 2) return 'targeted_repair';
  if (attempt <= 3) return 'collaborative_repair';
  if (attempt <= 4) return 'execution_plan_refinement';
  if (attempt <= 5) return 'pm_authoring';
  return 'ship_with_caveats';
}

/**
 * Determine recovery action from strategy.
 *
 * Returns: { action, envExtras }
 * action: 'repair' | 'refine_plan' | 'pm_author' | 'ship'
 */
function getStrategyAction(strategy, edp, cp) {
  switch (strategy) {
    case 'targeted_repair':
      return { action: 'repair', envExtras: {} };

    case 'collaborative_repair':
      return { action: 'repair', envExtras: { AIC_COLLABORATIVE_REPAIR: '1' } };

    case 'execution_plan_refinement':
      return { action: 'refine_plan', envExtras: {} };

    case 'pm_authoring':
      return { action: 'pm_author', envExtras: {} };

    case 'ship_with_caveats':
      return { action: 'ship', envExtras: {} };

    default:
      return { action: 'repair', envExtras: {} };
  }
}

/**
 * Generate recovery summary for logging/diagnostics.
 */
function summarizeRecovery(cp) {
  const history = cp.reworkHistory || [];
  if (!history.length) return 'No recovery cycles';

  const lines = history.map((h, i) => {
    return `  Cycle ${i + 1}: strategy=${h.strategy} targets=${(h.targets || []).join(',')} rootCause="${(h.rootCause || '').substring(0, 60)}"`;
  });

  const progress = evaluateProgress(cp);
  lines.push(`  Progress: ${progress.hasProgress ? 'YES' : 'NO'} (${progress.reason})`);

  return lines.join('\n');
}

module.exports = {
  STRATEGIES,
  recordCycle,
  evaluateProgress,
  selectStrategy,
  getStrategyAction,
  summarizeRecovery,
};
