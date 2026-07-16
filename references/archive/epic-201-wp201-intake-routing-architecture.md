# EPIC-201 — WP-201 Intake Routing Architecture

**Status:** Planning only (architecture freeze candidate)  
**Authority:** PM-approved decisions in EPIC-201 brief  
**Out of scope:** Runtime, workers, FSM, implementation

---

## 1. Intake Routing Architecture

### 1.1 Position in the system

Intake sits **before** the engineering pipeline (Investigate → Planning → …). It is **Dispatcher-owned classification**, not a Runtime phase.

```
User message
    ↓
Context Collection (Chat + PRD + Repository)
    ↓
LLM Requirement Extractor (Normalize to Object)
    ↓
Deterministic Validator (Completeness Checklist)
    ↓
Missing Fields
    ↓
Dispatcher Decision (Intent + Intake Mode)
    ↓
[Conversation] → respond only (RH-002)
[Quick]        → Requirement Completeness PASS → Approval (if needed) → task.create/start
[Discovery]    → Q&A (LLM Generated) → PRD_<Project>.md → Operator Approval → Architecture → Planning → …
[From PRD]     → PRD Review → Gap Analysis → Operator Approval → Planning → …
```

**Invariant:** Pipeline (`task.start` / full Investigate-as-engine-phase) **MUST NOT** start until operator approves PRD (Discovery or From PRD path) or Quick path proves completeness per checklist (see §2).

### 1.2 Four intake modes (frozen)

| Mode | Trigger | Pipeline |
|------|---------|----------|
| **Conversation** | No engineering task requested | **Never** enter pipeline |
| **Quick** | Engineering task + completeness **PASS** | Skip Discovery; may still use Investigate phase for repo evidence, but **not** Discovery Q&A |
| **Discovery** | Engineering task + completeness **FAIL** | Discovery process only until PRD + approval |
| **From PRD** | User supplies formal requirements artifact | Skip Discovery; PRD Review + Gap Analysis |

No fifth mode (e.g. “Auto-Discovery”, “Lite-PRD”, “Confidence path”) without a new epic.

### 1.3 Relationship to RH-002 (Intent Boundary)

| User says | Max intake | Max pipeline without approval |
|-----------|------------|-------------------------------|
| “explain …” | Conversation | — |
| “check GitHub” | Quick or Conversation | Investigate-only if classified as investigation, **not** Planning |
| “build X” incomplete | Discovery | **Stop** at PRD + approval |
| “here is the PRD” | From PRD | Gap Analysis → approval → Planning |

Dispatcher **never** auto-escalates Conversation → Discovery → Planning (RH-002).

### 1.4 Discovery process rules (frozen)

- **Not mandatory** — only when completeness FAIL.
- **LLM Question Generation:** The LLM generates clarification questions based *only* on the **Structured Discovery State** (missing fields, count) + existing conversation.
  - Ask only about missing fields; never ask about completed fields.
  - Combine multiple missing fields into one question whenever reasonable.
  - Avoid repeating previous questions and generic/open-ended questions (e.g., "Tell me more").
  - Prefer specific, answerable questions.
  - Minimize the total number of questions.
- **Stop Conditions:** Discovery ends immediately when ANY of the following is true:
  1. All mandatory fields are complete.
  2. The validator confirms Planning can safely begin.
  3. The operator explicitly stops Discovery.
  4. The maximum question limit (10) is reached.
- **Limit Reached (10 Qs):** If capped, Dispatcher MUST produce: **Missing Information Summary**, **Current Requirement Status**, and **Recommended Next Action**. Do **not** continue asking questions indefinitely.
- **Artifact:** `PRD_<ProjectName>.md` (e.g. `PRD_AIC_Website.md`). **No** `DISCOVERY.md` as official output.
- **Approval gate:** Discovery → PRD → **Operator Approval** → Architecture (spec) → Planning → Implementation.

### 1.5 From PRD path (frozen)

User supplies any of: PRD, BRD, SRS, Requirements doc, GitHub Issue, Jira Ticket (structured requirement source).

Flow:

```
From PRD
  → PRD Review (read + normalize)
  → Gap Analysis (checklist vs domain)
  → Operator Approval
  → Planning (engine pipeline)
```

**Skip Discovery** entirely.

### 1.6 PRD Intent Resolution

Purpose: Determine what the operator wants to do with the supplied PRD before entering any engineering pipeline.

A PRD does NOT automatically imply Build. The **Approval Gate applies ONLY when the selected intent is Build.** Review, Improve, Architecture, and Estimate must NOT enter Planning or spawn workers.

| User Request | Dispatcher Action |
|--------------|-------------------|
| Upload PRD only (no intent) | Ask ONE clarification question: "What would you like me to do? 1. Review 2. Improve 3. Generate Architecture 4. Estimate 5. Build" |
| Review PRD | Execute intent immediately (no pipeline/planning) |
| Improve PRD | Execute intent immediately (no pipeline/planning) |
| Generate Architecture | Execute intent immediately (no pipeline/planning) |
| Estimate | Execute intent immediately (no pipeline/planning) |
| Build from PRD | Gap Analysis → Operator Approval Gate → Planning (engine pipeline) |

---

## 2. Requirement Completeness Architecture

### 2.1 Single question

> **Do we have enough information to begin Planning safely?**

Answer: **`PASS`** | **`FAIL`** | **`NOT_APPLICABLE`** (Conversation only).

**No** probabilities. **No** confidence percentages. **No** PM 0–100 score (supersedes legacy `dispatcher-discovery.md` confidence model for intake routing).

### 2.2 Evaluator design

**Architecture:** LLM-Assisted, Deterministic-Controlled Intake.

**Responsibilities:**
- **LLM:** Requirement extraction, normalization, classification, question generation, and PRD drafting. MUST NOT decide routing, approval, execution, or completeness.
- **Dispatcher / Deterministic Logic:** Completeness validation, gap calculation, routing, approval gating, question limit enforcement, and pipeline execution.

**Component:** `RequirementCompletenessEvaluator` (logical module; implementation in WP-202+).

**Inputs:**

1. `project_type` (domain enum, §3)
2. `user_text` + optional attachments (PRD path)
3. `project_path` signals (repo layout, read-only)
4. Explicit operator overrides (`project_type=website` if user states)

**Process:**

1. Context Collection: Gather chat, PRD, and repo heuristics. (Extensible design allows future context providers: GitHub Issues, Jira, Linear, Notion, Local KB).
2. LLM Extraction: Extract and normalize requirement facts into an object.
3. Select **checklist** for `project_type` (§4).
4. For each **mandatory** field (Deterministic Validation): `PRESENT` | `MISSING` | `DERIVABLE` (from repo/docs only).
5. **PASS** iff all mandatory fields are `PRESENT` or `DERIVABLE`.
6. **FAIL** → route **Discovery Orchestrator** (or **From PRD** + Gap Analysis if artifact exists but incomplete).
7. **Discovery Update Cycle:** Iterative loop where the LLM receives the latest **Structured Discovery State** (`project_type`, `known_fields`, `missing_fields`, `question_count`, `max_questions`, `selected_intent`, `operator_approved`) + conversation to generate the next question. The LLM never regenerates from scratch; the Validator remains the source of truth.

**Output (structured, deterministic):**

```yaml
completeness: PASS | FAIL
project_type: website
mandatory:
  business_goal: PRESENT
  target_user: MISSING
  ...
missing_for_planning: [target_user, deployment_target]
recommended_intake: quick | discovery | from_prd
```

### 2.3 DERIVABLE vs Discovery questions

| Source | Intake may mark DERIVABLE | Discovery may ask |
|--------|---------------------------|-------------------|
| README, package.json, existing routes | Tech hints, deploy target | — |
| User-only preferences | — | Business goal, brand, scope |
| Issue/ticket body | Scope if explicit | Ambiguous acceptance criteria |

Rule: Discovery questions only for fields that are **MISSING** and **not DERIVABLE** (aligns with existing discovery discipline).

---

## 3. Project Type Detection Strategy

### 3.1 Supported domains (v1)

| `project_type` | Detection signals (deterministic, ordered) |
|----------------|--------------------------------------------|
| `website` | User says “landing”, “website”, “marketing site”; or `index.html` / Next marketing app without API-only |
| `mobile_app` | “iOS/Android/React Native/Flutter”; `android/`, `ios/` |
| `api` | “REST/GraphQL API”; OpenAPI; `routes/`, no UI |
| `ai_agent` | “agent”, “bot”, “orchestration”; links to Hermes/AIC/opencode |
| `desktop_app` | Electron, Tauri, “desktop” |
| `library` | “npm package”, “library”, publishable pkg without app entry |
| `cli` | “CLI”, `bin/`, commander/yargs |
| `devops` | “pipeline”, “k8s”, “terraform”, `.github/workflows` focus |
| `documentation` | “docs only”, “guide”, no code change |
| `unknown` | No match → use **generic** checklist (stricter: more mandatory fields) |

### 3.2 Detection algorithm (deterministic)

```
1. If user declares type explicitly → use it (wins).
2. Else if attachment is Issue/Ticket → infer from labels/title keywords (api, ui, docs).
3. Else if project_path readable → score keyword hits per type; highest wins if margin ≥ 2 hits; else unknown.
4. If unknown → generic checklist; Discovery likely.
```

**No ML.** Tie-break: ask **one** forced-choice question (“Which type: website / API / …?”) — counts toward Discovery question budget.

---

## 4. Checklist Specification

### 4.1 Field states

- **Mandatory (M):** required for Planning PASS.
- **Optional (O):** improves plan quality; does not block Quick.
- **Minimum bar:** all **M** satisfied.

### 4.2 Website

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | “Convert leads for biochar product” |
| Target user | M | “Plantation managers in SEA” |
| Pages / IA | M | Home, Product, Contact |
| Core features | M | Form, pricing table, i18n ID/EN |
| Tech stack | O | React + Vite (or DERIVABLE from repo) |
| Deployment | M | Cloudflare Pages / VPS |
| Brand / design constraints | O | “Match AIC-WEB style” |
| Acceptance criteria | M | “Lighthouse > 90”, “mobile 375px” |
| Out of scope | O | “No checkout” |

### 4.3 Mobile App

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Target user | M | |
| Platforms | M | iOS + Android |
| Core user flows | M | Onboarding, login, dashboard |
| Backend dependency | M | Existing API URL or greenfield |
| Offline / push | O | |
| Acceptance criteria | M | |
| App store constraints | O | |

### 4.4 API

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Consumers | M | Mobile app, partners |
| Resources / endpoints | M | CRUD users, orders |
| Auth model | M | JWT, API key |
| SLA / rate limits | O | |
| Data model | M | Entities + relationships |
| Deployment | M | |
| Acceptance criteria | M | Contract tests, OpenAPI |

### 4.5 AI Agent

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Operator persona | M | |
| Tools / integrations | M | Terminal, browser, CRM |
| Safety boundaries | M | No prod writes without approval |
| Model / provider | O | DERIVABLE from .env |
| Acceptance criteria | M | Scenarios + eval set |

### 4.6 Desktop App

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Target OS | M | Win + macOS |
| Core features | M | |
| Update strategy | O | |
| Acceptance criteria | M | |

### 4.7 Library

| Field | M/O | Example |
|-------|-----|---------|
| Problem statement | M | |
| Public API surface | M | Exported functions/classes |
| Target runtime | M | Node 20+, browser |
| Compatibility / semver | M | |
| Acceptance criteria | M | Tests, docs |

### 4.8 CLI

| Field | M/O | Example |
|-------|-----|---------|
| Problem statement | M | |
| Commands / flags | M | |
| Input / output formats | M | stdin JSON, stdout table |
| Exit codes | O | |
| Acceptance criteria | M | |

### 4.9 DevOps

| Field | M/O | Example |
|-------|-----|---------|
| Goal | M | CI for monorepo |
| Target environment | M | prod/staging |
| Current pain | M | Slow deploy, no cache |
| Constraints | M | GitHub Actions only |
| Acceptance criteria | M | Green pipeline < 10m |

### 4.10 Documentation

| Field | M/O | Example |
|-------|-----|---------|
| Audience | M | Operators |
| Scope | M | Runtime OAT guide |
| Source of truth | M | Which repo paths |
| Format | M | Markdown in docs/ |
| Acceptance criteria | M | Reviewed by PM |

### 4.11 Generic (unknown type)

| Field | M/O |
|-------|-----|
| Business goal | M |
| Target user / consumer | M |
| Scope (in / out) | M |
| Constraints | M |
| Acceptance criteria | M |
| Deployment / delivery | M |

---

## 5. Routing Decision Tree

```
START: Parse user message
│
├─ Engineering task requested? ──NO──► Conversation (STOP)
│
YES
│
├─ Context Collection (Chat + PRD + Repo)
├─ LLM Requirement Extraction
│
├─ Formal requirement artifact attached? ──YES──► From PRD
│       │
│       ├─ Gap Analysis PASS ──► Await Operator Approval ──► Planning+
│       └─ Gap FAIL ──► Discovery Orchestrator (bounded Q) OR Missing Info List (if cap reached)
│
NO
│
├─ Detect project_type
├─ Deterministic Requirement Completeness Evaluator
│
├─ PASS ──► Quick
│       └─► Operator confirms scope
│       └─► task.create / pipeline per policy
│
└─ FAIL ──► Discovery Orchestrator
        ├─► Provide Structured Discovery State to LLM
        ├─► LLM Question Generator (Strict Quality Rules)
        ├─► User Response
        ├─► LLM Requirement Extraction
        ├─► Deterministic Validator Update
        ├─► Discovery State Update
        ├─► Check Stop Conditions (PASS, Operator Stop, or Cap 10)
        │      └─► If Cap 10: Emit Missing Info Summary & Recommended Action
        └─► Generate PRD_<Project>.md
        └─► Operator Approval
        └─► Architecture → Planning → …
```

**Hard stops:**

- Conversation → never `task.start` for implementation.
- Discovery without approved PRD → never Planning.
- From PRD with critical gaps → never Planning until Gap Analysis PASS or approved exceptions documented in PRD amendment.

---

## 6. Routing Examples (24)

| # | User input (summary) | Mode | Reason |
|---|----------------------|------|--------|
| 1 | “hai, aic jalan?” | Conversation | No engineering task |
| 2 | “jelaskan barrier di runtime” | Conversation | Explain only (RH-002) |
| 3 | “fix typo di README line 5” | Quick | Scope + file + change clear |
| 4 | “add healthcheck to deploy.sh” | Quick | Single artifact, criteria clear |
| 5 | “buat landing page” | Discovery | Missing pages, goal, deploy |
| 6 | “buat website biochar” | Discovery | Missing IA, features, AC |
| 7 | PRD_Biochar.md attached | From PRD | Formal artifact |
| 8 | GitHub issue #42 with AC | From PRD | Ticket = requirements |
| 9 | “refactor auth module” no AC | Discovery | Scope/constraints missing |
| 10 | “build REST API for orders” + entities listed | Quick | API checklist M satisfied |
| 11 | “build REST API” only | Discovery | No resources/auth/deploy |
| 12 | “React Native app for field workers” + flows | Quick | Mobile M satisfied |
| 13 | “mobile app” only | Discovery | Platforms/flows missing |
| 14 | “CLI to migrate tickets” + commands | Quick | CLI M satisfied |
| 15 | “Hermes skill for X” + tools/AC | Quick | AI agent M satisfied |
| 16 | “perlu agent” tanpa batas | Discovery | Safety/tools missing |
| 17 | “terraform untuk staging” + constraints | Quick | DevOps M satisfied |
| 18 | “update operator guide” + sections | Quick | Documentation M satisfied |
| 19 | “cek github kenapa build fail” | Conversation / Investigate-only | Investigation not build (RH-002) |
| 20 | “investigate PM timeout” | Investigate-only | No planning without ask |
| 21 | Jira SRS paste incomplete deploy | From PRD → Gap FAIL → Discovery | Gap fills deploy |
| 22 | “same as last task” no pointer | Discovery | Missing reference PRD/task id |
| 23 | “implement EPIC-201” + linked PRD | From PRD | Structured epic + doc |
| 24 | After 10 Discovery Q still no deploy | Discovery STOP | Missing Information List |

---

## 7. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quick path ships with hidden ambiguity | Rework loops in PM | Mandatory AC field; Quick only when all M PRESENT/DERIVABLE |
| Over-trigger Discovery | Operator fatigue | 5–7 target; repo-derivable fields excluded |
| Under-trigger Discovery | Bad plans | Generic checklist for unknown type |
| Legacy confidence scoring conflicts | Wrong route | Deprecate % in intake; keep for PM artifact optional metadata only |
| From PRD false PASS | Gap Analysis skipped | Checklist applied to normalized PRD sections |
| Dispatcher starts pipeline pre-approval | Trust break | Gate: no `task.start` until approval flag in session/task metadata |
| project_type mis-detect | Wrong checklist | One forced-choice question within 10-Q cap |
| RH-002 violation | Auto-planning | Intent tree overrides Quick |

---

## 8. Recommended Implementation Plan (WP-202+)

**Phase A — Specification (no runtime)**

1. Add `references/intake-routing-rules.md` (normative) + `templates/PRD_TEMPLATE.md` → `PRD_<Project>.md`.
2. Add machine-readable `templates/intake-checklists/*.yaml` per domain.
3. Update `SKILL.md` router: IF intake / PRD / discovery → load intake refs.
4. Patch `dispatcher-discipline-aic`: RH-004 Intake Modes + approval gate language.
5. Mark `dispatcher-discovery.md` confidence section **deprecated for routing** (retain Investigate-phase narrative).

**Phase B — Dispatcher logic (Hermes skill only)**

6. Implement `RequirementCompletenessEvaluator` as deterministic skill procedure (table + yaml), not LLM score.
7. Session state: `intake_mode`, `discovery_question_count`, `prd_path`, `operator_approved_prd: bool`.
8. Wire approval: Dispatcher explicit “Approve PRD?” before `task.create` for net-new scope.

**Phase C — Optional tooling**

9. CLI `aic intake evaluate --type website --text "..."` for operator debugging (no engine change).
10. Dashboard display: intake mode + missing fields (read-only).

**Explicit non-goals for WP-202:** Engine FSM changes, new workers, auto-PM Discovery in runtime.

**Verification:** Table-driven tests: 24 examples → expected mode; 0% confidence in routing output.

---

## Architecture freeze checklist (for PM)

- [x] Four modes only  
- [x] Discovery optional, 3–10 Q, PRD output  
- [x] Approval before pipeline  
- [x] From PRD skips Discovery  
- [x] Deterministic completeness, no %  
- [x] Domain checklists  
- [x] 20+ examples  

**Await PM approval before WP-202 implementation.**