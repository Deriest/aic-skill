# Requirements: AIC Marketing/Documentation Website

**TASK ID:** TASK-20260707-002
**Author:** PM Worker
**Date:** 2026-07-07
**Status:** Draft

---

## Target Audience

**Primary:** AI developers and engineers evaluating multi-agent orchestration tools for their workflow.

**Secondary:**
- OpenCode/Hermes users looking for skills to extend their setup
- Technical leads comparing AI dev tools
- Open-source contributors interested in AI orchestration

**Visitor intent:** Land on page → understand what AIC does → see it in action → install it.

---

## Content Strategy

- **Tone:** Technical but approachable. No buzzwords. Show, don't tell.
- **Format:** Single-page static site (index.html). No build step. Ship as part of the repo.
- **Visual style:** Dark theme, monospace accents, pixel art nods (matches dashboard aesthetic).
- **Proof points:** Real worker names, real task types, real dashboard screenshots. Not hypothetical.

---

## Sections

### 1. Hero Section

**Goal:** Communicate what AIC is in under 5 seconds.

**Content:**
- Company name: "AI Engineering Company (AIC)"
- Tagline: "10-worker AI orchestration for software development"
- Sub-tagline: "Your agent becomes a Dispatcher. 10 specialized workers build, test, and ship."
- CTA button: "Get Started" (links to Getting Started section)
- CTA button: "View on GitHub" (links to repo)

**Visual:** Animated or static pixel art of 10 worker desks (reuse dashboard visual language).

---

### 2. Features Section

**Goal:** Show the 3 core pillars of AIC.

**Content:**

#### 10 Specialized Workers
- Grid/list of all workers with icon, name, role, model tier
- Workers: PM, Researcher, Designer, Architect, Frontend, Backend, Infra, QA, Governor, Dispatcher
- Group by office: Product, Engineering, Governance
- Each worker card: name, soul quote, model tier badge (opus/sonnet/haiku)

#### Pipeline Orchestration
- Visual diagram: User → Dispatcher → Workers → Delivery
- Multi-phase workflow example: Feature (PM → Architect → Engineers → QA → Governor)
- Task classification table: "build X" → feature pipeline, "fix bug" → bug pipeline
- Key point: "You say WHAT. Dispatcher decides HOW."

#### Dashboard Monitoring
- Screenshot or embedded demo of the AIC Office dashboard
- Features: 10 worker cards, live status, pipeline phases, activity log
- Tech badge: "React + Vite + Tailwind · Port 6969"

#### OpenCode Engine
- Badge/section: "All workers powered by OpenCode"
- Why: reads/writes real files, single engine = simpler config, consistent behavior
- Link to OpenCode: https://github.com/anomalyco/opencode

---

### 3. Why AIC Section

**Goal:** Differentiate from alternatives. Answer "why should I use this?"

**Content:**

#### Benefits
- **Structured pipeline** — not just "ask AI to code", it's PM → Architect → Engineer → QA → Governor
- **Real file operations** — workers read/write your actual codebase via OpenCode
- **Multi-provider** — Claude, GPT-4o, DeepSeek, or custom
- **Visual monitoring** — dashboard shows what each worker is doing in real-time
- **Approval gates** — deploy requires your sign-off (or yolo mode for speed)
- **Extensible** — add workers, change workflows, customize model assignments

#### Comparison Table
| Feature | AIC | Single-agent | Manual multi-agent |
|---|---|---|---|
| Specialized workers | 10 | 1 | You configure |
| Pipeline phases | Automatic | Manual | Manual |
| Quality gates | Governor | None | You review |
| Dashboard | Built-in | None | You build |
| Task classification | Automatic | Manual | Manual |

#### Use Cases
- "Build a REST API with JWT auth" → full pipeline
- "Fix this frontend bug" → targeted single worker
- "Research best database for this use case" → Researcher
- "Security audit" → Backend → Governor

---

### 4. Getting Started Guide

**Goal:** Get user from zero to first task in under 5 minutes.

**Content:**

#### Prerequisites
- Node.js installed
- API key (OpenRouter, Anthropic, OpenAI, or use free tier)

#### Install (3 steps)
```bash
# 1. Install OpenCode
npm install -g opencode-ai@latest

# 2. Clone AIC skill
git clone https://github.com/Deriest/aic-skill.git
cp -r aic-skill/* ~/.hermes/skills/workflows/aic/

# 3. Load and configure
/aic
```

#### First Run
- Shows interactive config: API key → model tier selection
- Auto-generates `.env`
- Ready to dispatch

#### First Task
```
/aic
build a todo app with React and a REST API
```
- Show expected output: pipeline phases, worker dispatches, delivery

---

### 5. Dashboard Demo Section

**Goal:** Show the dashboard is real, not a mockup.

**Content:**
- Static screenshot of dashboard (10 worker cards, sidebar, stats bar)
- Alternatively: embedded GIF showing a task flowing through workers
- Feature list: pixel art workers, CRT effect, activity log, pipeline phases
- How to start: `node server.js 3000` → `http://localhost:6969`

---

### 6. Architecture Overview

**Goal:** Show how the pieces fit together.

**Content:**
- Visual diagram (SVG or ASCII):
```
User → Dispatcher → [PM, Researcher, Designer]    (Product)
                  → [Architect, Frontend, Backend, Infra, QA] (Engineering)
                  → [Governor]                     (Governance)
                  → OpenCode Engine (all workers)
                  → Dashboard (React, port 6969)
```
- Worker → Engine mapping table
- Data flow: User input → classification → worker spawn → result chain → delivery

---

### 7. FAQ Section

**Goal:** Address common objections and questions.

**Questions:**
1. **What is OpenCode?** — CLI tool for AI-powered coding. All AIC workers use it.
2. **Do I need an API key?** — Yes, unless using the free DeepSeek tier.
3. **Can I use my own models?** — Yes, custom provider option during setup.
4. **Does it work on Windows/Mac/Linux?** — Yes, all platforms supported.
5. **What if a worker fails?** — Automatic retry (5 attempts, exponential backoff). Escalates to you after.
6. **Can I add more workers?** — Yes, the system is extensible.
7. **Is the dashboard required?** — No, optional. Works without it.
8. **What's yolo mode?** — Skips all approval gates. Workers run without confirmation. Fast but risky.

---

### 8. Footer

**Content:**
- GitHub link: https://github.com/Deriest/aic-skill
- License: MIT
- "Built with OpenCode"
- Link to SKILL.md or docs

---

## Technical Requirements

- **Format:** Single `index.html` file with inline CSS/JS, or `index.html` + `style.css` + `script.js`
- **No build step:** Must work by opening the file or serving with any static server
- **Responsive:** Mobile-first. Must look good on phone, tablet, desktop.
- **Performance:** Under 100KB total (no heavy frameworks for the marketing page)
- **Accessibility:** Semantic HTML, proper headings, alt text, keyboard nav
- **Assets:** Screenshots in `assets/` directory. Pixel art sprites reused from dashboard if possible.

---

## Success Criteria

- [ ] Page loads in under 1 second on local server
- [ ] All 8 sections present and populated
- [ ] Getting Started guide is copy-pasteable and accurate
- [ ] GitHub link works and points to correct repo
- [ ] Dashboard screenshot/demo is included
- [ ] Architecture diagram is clear and correct
- [ ] FAQ answers the listed questions
- [ ] Responsive: looks good on mobile and desktop
- [ ] No build step required — works as static files

---

## Out of Scope

- Blog/CMS
- User authentication
- Analytics tracking
- Internationalization (English only for v1)
- Interactive playground (future)
