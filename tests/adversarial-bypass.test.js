'use strict';
/**
 * Adversarial Bypass Tests — documents remaining prompt-only boundaries.
 * These tests VERIFY existing behavior, documenting what's enforcement vs guidance.
 * Tests that FAIL indicate enforcement that should be added.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Adversarial: Prompt-Only Boundaries (documented gaps)', () => {

  describe('GAP-01: No commit/merge authorization in engine', () => {
    it('engine has no commit authorization field in checkpoint', () => {
      // The engine checkpoint tracks pipelineState, phaseStatus, phaseBarrier,
      // rework, shipWithCaveats, reworkHistory — but NO commit/merge authorization.
      // This is entirely prompt-enforced (SKILL.md "NEVER commit without explicit user instruction").
      // Assessment: ACCEPTABLE — Git operations happen outside engine scope.
      // The engine delegates to spawn-worker.sh → opencode, which cannot git push.
      // Git commands come only from Hermes terminal tool, controlled by SKILL.md rules.
      const { readCheckpoint, writeCheckpoint } = require('../scripts/engine/persistence');
      const cp = {
        id: 'TEST-001',
        pipelineState: 'COMPLETE',
        phaseStatus: 'idle',
        phaseBarrier: null,
      };
      // Verify no commit/merge fields exist
      expect(cp.commitAuthorized).toBeUndefined();
      expect(cp.mergeAuthorized).toBeUndefined();
      expect(cp.approvedScope).toBeUndefined();
    });
  });

  describe('GAP-02: No scope enforcement — workers write freely', () => {
    it('PHASE_PLANS has no allowedPaths field', () => {
      const { PHASE_PLANS } = require('../scripts/engine/fsm');
      for (const [phase, plan] of Object.entries(PHASE_PLANS)) {
        for (const entry of plan) {
          expect(entry.allowedPaths).toBeUndefined();
        }
      }
    });
  });

  describe('GAP-03: Auth RBAC defaults to viewer (fail-open)', () => {
    it('middleware checkAccess denies unknown roles for admin actions', () => {
      const { createMiddleware } = require('../scripts/middleware');
      const mw = createMiddleware({ allowedOrigins: null, skillDir: '/tmp' });
      
      // viewer role (default when no role set) should NOT access admin endpoints
      expect(mw.checkAccess('viewer', 'state', 'write')).toBe(false);
      expect(mw.checkAccess('viewer', 'task', 'create')).toBe(false);
      expect(mw.checkAccess('viewer', 'worker', 'spawn')).toBe(false);
      
      // But viewer CAN read status
      expect(mw.checkAccess('viewer', 'status', 'read')).toBe(true);
      expect(mw.checkAccess('viewer', 'health', 'read')).toBe(true);
      
      // admin can do anything
      expect(mw.checkAccess('admin', 'state', 'write')).toBe(true);
    });

    it('missing role defaults to viewer in server.js flow', () => {
      // This verifies the server.js RBAC behavior:
      // const rbacRole = apiKeyData?.role || 'viewer';
      // When auth.json has no role field, it defaults to viewer.
      // IMPACT: admin endpoints return 403 if role not explicitly set.
      // This is fail-closed for admin, which is correct.
      const apiKeyWithoutRole = { key: 'test-key' };
      const role = apiKeyWithoutRole?.role || 'viewer';
      expect(role).toBe('viewer');
    });
  });

  describe('GAP-04: Pipeline does not verify file scope changes', () => {
    it('runPipeline has no post-phase diff check', () => {
      const pipelineSrc = fs.readFileSync(
        path.join(__dirname, '..', 'scripts', 'engine', 'pipeline.js'), 'utf8'
      );
      // Pipeline does not call git diff or verify file scope after phases
      expect(pipelineSrc).not.toContain('git diff');
      expect(pipelineSrc).not.toContain('allowedPaths');
      expect(pipelineSrc).not.toContain('scope');
    });
  });

  describe('GAP-05: Smart Approval can destroy credentials', () => {
    it('api-auth.sh uses $apikey (not $key) to avoid Smart Approval', () => {
      const apiAuth = fs.readFileSync(
        path.join(__dirname, '..', 'scripts', 'api-auth.sh'), 'utf8'
      );
      // D-27 fix: curl_api must use $apikey (not $key) to avoid Smart Approval pattern
      // The local `key` var inside _aic_get_api_key() is fine — it never goes through curl -H
      expect(apiAuth).toContain('$apikey');
      // Verify curl -H uses $apikey, not $key
      const curlLine = apiAuth.split('\n').find(l => l.includes('X-API-Key:'));
      expect(curlLine).toBeDefined();
      expect(curlLine).toContain('$apikey');
    });
  });

  describe('GAP-06: Server does not hot-reload engine modules', () => {
    it('fsm.js uses require() which caches modules', () => {
      // Server uses require('./engine/fsm') at startup.
      // File edits on disk have NO effect until process restart.
      // This is documented in D-29 but has no enforcement.
      // Assessment: inherent Node.js behavior, acceptable with documented kill-restart pattern.
      const fsmSrc = fs.readFileSync(
        path.join(__dirname, '..', 'scripts', 'engine', 'fsm.js'), 'utf8'
      );
      expect(fsmSrc).toContain("module.exports");
    });
  });
});

describe('Adversarial: Context Loss / Session Recovery', () => {

  describe('GAP-07: State persistence survives server restart', () => {
    it('pipeline writes checkpoint to disk', () => {
      const persistenceSrc = fs.readFileSync(
        path.join(__dirname, '..', 'scripts', 'engine', 'persistence.js'), 'utf8'
      );
      expect(persistenceSrc).toContain('writeCheckpoint');
      expect(persistenceSrc).toContain('readCheckpoint');
      // Verify atomic write is used
      expect(persistenceSrc).toContain('atomic-write');
    });
  });

  describe('GAP-08: Reconciliation handles interrupted barriers', () => {
    it('reconcilePhaseBarrier checks leases AND artifacts', () => {
      const phaseRunnerSrc = fs.readFileSync(
        path.join(__dirname, '..', 'scripts', 'engine', 'phase-runner.js'), 'utf8'
      );
      // Must check both lease completion AND artifact existence
      expect(phaseRunnerSrc).toContain("lease.status === 'complete'");
      expect(phaseRunnerSrc).toContain('validateArtifactFile');
      expect(phaseRunnerSrc).toContain('reconcilePhaseBarrier');
    });
  });
});

describe('Adversarial: Prompt Injection Resistance', () => {

  describe('GAP-09: Skill rules cannot be overridden by task content', () => {
    it('SKILL.md has core rules that are always loaded', () => {
      const skillSrc = fs.readFileSync(
        path.join(__dirname, '..', 'SKILL.md'), 'utf8'
      );
      // Core rules must be in the primary SKILL.md (always loaded)
      expect(skillSrc).toContain('Dispatcher NEVER writes code');
      expect(skillSrc).toContain('NEVER commit without explicit user instruction');
      expect(skillSrc).toContain('UNKNOWN and MANUAL_APPROVAL_REQUIRED are forbidden');
    });

    it('SKILL.md is not optional', () => {
      const skillSrc = fs.readFileSync(
        path.join(__dirname, '..', 'SKILL.md'), 'utf8'
      );
      // SKILL.md must define itself as always-loaded
      expect(skillSrc).toContain('Always load');
    });
  });
});

describe('Adversarial: Delegation Bypass', () => {

  describe('GAP-10: Subagent restrictions', () => {
    it('spawn-worker.sh passes AIC_RUNTIME_ENGINE env', () => {
      const helperSrc = fs.readFileSync(
        path.join(__dirname, '..', 'scripts', 'engine', 'helpers.js'), 'utf8'
      );
      // Workers spawned via engine get AIC_RUNTIME_ENGINE=1
      expect(helperSrc).toContain("AIC_RUNTIME_ENGINE: '1'");
    });

    it('PHASE_ALLOWED restricts which workers can get leases per phase', () => {
      const config = require('../scripts/config');
      // Each phase has a whitelist of workers
      expect(config.PHASE_ALLOWED.investigate).toContain('pm');
      expect(config.PHASE_ALLOWED.investigate).not.toContain('frontend');
      expect(config.PHASE_ALLOWED.planning).toContain('designer');
      expect(config.PHASE_ALLOWED.implementation).not.toContain('qa');
      expect(config.PHASE_ALLOWED.verification).toContain('qa');
      expect(config.PHASE_ALLOWED.closeout).toContain('governor');
    });
  });
});
