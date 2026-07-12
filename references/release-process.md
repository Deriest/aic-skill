# Release Process (v1.0.0+)

## Prerequisites

Before release:
- All milestones CLOSED
- Repository Regression Audit = PASS
- Post-Audit Review = PASS
- Final Release Validation = PASS
- Git working tree clean
- No pending hotfixes

## Steps

### 1. Create Annotated Tag
```bash
cd <repo>
git tag -a v1.0.0 -m "AI Engineering Company v1.0.0

Production-ready initial release.

Highlights:
- Runtime Core
- Dispatcher Intelligence
- Worker Intelligence
- Knowledge Platform
- Production Operations
- Enterprise Platform
- Stabilization
- Documentation Consolidation
- Repository Cleanup"
```

### 2. Push Commits and Tag

If HTTPS fails (no credentials), switch to SSH:
```bash
git remote set-url origin git@github.com:<owner>/<repo>.git
git push origin main
git push origin v1.0.0
```

### 3. Create GitHub Release

If `gh` CLI available:
```bash
gh release create v1.0.0 --title "AI Engineering Company v1.0.0" --notes "Production-ready initial release."
```

If `gh` not available, use curl with token:
```bash
curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/<owner>/<repo>/releases \
  -d '{"tag_name":"v1.0.0","name":"AI Engineering Company v1.0.0","body":"...","draft":false,"prerelease":false}'
```

If no API token: report manual URL for user to create release.

## Pitfalls

### 1. HTTPS auth fails without credentials
GitHub disabled password auth. SSH key is for git operations only, not API calls. Two separate auth paths:
- **Git push**: SSH key works after `git remote set-url origin git@github.com:...`
- **GitHub API**: Needs personal access token (GITHUB_TOKEN env var or ~/.git-credentials)

### 2. No GitHub release without API token
SSH key authenticates git operations but NOT GitHub API. Creating a release via API requires a personal access token with `repo` scope. If unavailable, provide the manual URL: `https://github.com/<owner>/<repo>/releases/new?tag=<tag>`

### 3. Release = tag + push only, no repo changes
The release process does NOT modify any files. It's purely git operations. If changes are needed, they must be committed BEFORE the release process starts.
