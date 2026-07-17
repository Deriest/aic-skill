# Post-Delivery Verification Checklist

After AIC pipeline reaches COMPLETE, NEVER trust the status blindly. Always verify.

## Checklist

1. **Code exists on disk**: `find $PROJECT_DIR/src -name '*.tsx' -o -name '*.ts' | wc -l` — if 0, code generation failed
2. **TypeScript passes**: `cd $PROJECT_DIR && npx tsc --noEmit`
3. **Build succeeds**: use `terminal(background=true, notify_on_complete=true)` for `npx vite build` — Hermes blocks vite as "long-lived process" in foreground
4. **Dashboard state correct**: `/api/status` returns:
   - `currentTask.pipelineState === 'COMPLETE'`
   - `runtimeGate.status === 'complete'`
   - `lastCompletedTask.id` set
5. **Files are real**: spot-check file sizes (>50 bytes, not stubs)
6. **dist/ exists**: `ls $PROJECT_DIR/dist/` — should have assets/ with JS/CSS bundles

## If Code Doesn't Exist

Workers wrote reports but never created files → check `references/code-generation-pipeline.md` for the extract-code-blocks solution. The `extract-code-blocks.py` script runs automatically after barrier in IMPLEMENTATION phase.

## If Dashboard Shows "WAITING FOR TASK"

Task completed but `currentTask` is null → `completeTask()` nullified it. This should be fixed (v3.6.0+) but if it happens, check `recovery.js` `reconcileOnStartup` and `pipeline.js` `completeTask()`.

## If Progress Bar Stuck < 100%

Workers reset to idle after complete → progress count drops. Fix: `OverviewPage.tsx` checks `pipelineState === 'COMPLETE'` → force 100%.
