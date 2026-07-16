# RESTORATION PATTERN: Multi-milestone recovery from LLM session history

## When to use
Session work was destroyed (git checkout, accidental overwrite, syntax corruption cascading into rollback) and needs to be restored.

## Recovery procedure

### Step 1: Assess damage
```bash
# Check what's broken
git status
node --check scripts/engine/index.js
bash -n scripts/pm-review.sh
```

### Step 2: Create safety net BEFORE attempting fixes
```bash
mkdir -p /tmp/aic-backup-$(date +%Y%m%d)
cp scripts/*.sh scripts/*.js /tmp/aic-backup-$(date +%Y%m%d)/
```

### Step 3: Identify recovery source
Priority: LLM session history > temp files > editor backups > git stash > git reflog

### Step 4: Write complete files (not patches)
When restoring from session history, write COMPLETE files via `write_file`, not incremental patches. This avoids partial-application errors where patch N depends on patch M which was lost.

### Step 5: Validate after each file
```bash
node --check scripts/engine/index.js && echo OK
bash -n scripts/pm-review.sh && echo OK
```

### Step 6: Integration validation
After all files restored, run a comprehensive grep-based check:
```bash
# Feature presence check
grep -c 'feature_name' file.js  # should be > 0
# Absence check  
grep -c 'removed_feature' file.js  # should be 0
# Syntax check
node --check scripts/engine/index.js
bash -n scripts/pm-review.sh
```

## v3.3.0 Restoration Order (proven)
1. `pm-review.sh` — complete rewrite (M1 degraded + M2 EDP parser)
2. `engine/index.js` — three sequential patches:
   - Patch 1: Import replacement (remove pm-repair, add ArtifactProvider)
   - Patch 2: Replace `runPmReview` (retry loop + mechanical gate + EDP)
   - Patch 3: Replace `pmRepairLoop` (EDP routing, owner mapping)
3. `phase-runner.sh` — targeted patch for canonical spec injection
4. Verify `spawn-worker.sh` frontmatter (should survive if not git-checked-out)
5. Verify auxiliary files (artifact-provider.js, validate scripts)

## Post-restoration validation checklist

After restoring, check for dead references to deleted modules:
```bash
# Find scripts that import deleted modules
grep -rn "pm-repair" scripts/ --include="*.js" --include="*.sh"
# If a companion script (e.g., pm-repair-respawn.js) imports the deleted
# module (e.g., engine/pm-repair.js), the companion will crash on import.
# Engine catches this (delCode !== 0) but old artifacts won't be cleaned up.
# Fix: inline the needed function into the companion, or delete the companion.
```

Known dead-reference pair (v3.3.0, RESOLVED):
- `pm-repair-respawn.js` was rewritten to be self-contained (inlined `deleteArtifacts()`, removed `require('./engine/pm-repair')`)
- The `repair-block` subcommand was removed — only `delete-artifacts` remains
- This fix was applied during the v3.3.0 hardening pass after the restoration was complete
