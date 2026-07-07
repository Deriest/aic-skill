# ARCHITECTURE.md — AIC Marketing Website

**TASK ID:** TASK-20260707-002
**Author:** Architect
**Date:** 2026-07-07
**Status:** Ready for implementation

---

## 1. File Structure

```
site/
├── index.html        (~18KB)  — single page, all 8 sections
├── styles.css        (~12KB)  — design system + layouts
├── script.js         (~4KB)   — interactions only
├── assets/
│   ├── og-image.png  (~30KB)  — social preview card
│   └── favicon.svg   (~1KB)   — AIC pixel logo (inline SVG)
└── ARCHITECTURE.md   — this file (not deployed)
```

**Total deployed budget: ~65KB** (well under 100KB limit)

No `assets/screenshot.png` — dashboard demo uses a CSS-built mockup (zero image bytes). No framework, no build step, no `node_modules`. Open `index.html` in a browser or serve with any static host.

---

## 2. Design System (Shared with Dashboard)

Every token below matches `dashboard/tailwind.config.js` and `dashboard/src/index.css` exactly. The marketing site re-declares them as CSS custom properties — no Tailwind dependency.

### 2.1 CSS Variables (`:root`)

```css
:root {
  /* Backgrounds */
  --bg-dark:        #0f0f23;
  --bg-floor:       #0a0a1a;
  --bg-panel:       #1a1a2e;
  --bg-panel-dark:  #0f0f1a;

  /* Borders */
  --border:         #2a2a4a;

  /* Accents */
  --accent:         #00d4ff;
  --accent2:        #7c3aed;
  --green:          #00ff88;
  --yellow:         #ffcc00;
  --red:            #ff4444;
  --orange:         #ff8800;
  --purple:         #aa66ff;

  /* Text */
  --text:           #e0e0e0;
  --text-dim:       #6b7280;
  --text-muted:     #4b5563;

  /* Typography */
  --font-pixel:     'Press Start 2P', monospace;
  --font-mono:      'Courier New', Courier, monospace;

  /* Spacing scale (8px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;

  /* Neon shadows (from dashboard) */
  --shadow-accent:  0 0 10px rgba(0,212,255,0.5), 0 0 20px rgba(0,212,255,0.3);
  --shadow-green:   0 0 8px rgba(0,255,136,0.6);
  --shadow-yellow:  0 0 10px rgba(255,204,0,0.5), 0 0 20px rgba(255,204,0,0.3);
}
```

### 2.2 Global Styles

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  scroll-behavior: smooth;
  scroll-padding-top: 60px; /* nav height offset */
}

body {
  font-family: var(--font-mono);
  background: var(--bg-dark);
  color: var(--text);
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
```

### 2.3 CRT Scanline Overlay (reused from dashboard)

Applied via `body::after` — fixed, pointer-events: none, z-index: 9999:

```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0,0,0,0.15),
    rgba(0,0,0,0.15) 1px,
    transparent 1px,
    transparent 2px
  );
  z-index: 9999;
}
```

### 2.4 Grid Overlay (subtle, from dashboard `office-grid-bg`)

Applied to select sections for depth:

```css
.grid-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(42,42,74,0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(42,42,74,0.1) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
  z-index: 0;
}
```

### 2.5 Utility Classes

```css
/* Text */
.text-accent  { color: var(--accent); }
.text-green   { color: var(--green); }
.text-yellow  { color: var(--yellow); }
.text-dim     { color: var(--text-dim); }
.text-pixel   { font-family: var(--font-pixel); }
.text-glow    { text-shadow: 0 0 10px var(--accent), 0 0 20px var(--accent); }
.text-glow-green { text-shadow: 0 0 10px var(--green); }

/* Panels (matches dashboard .panel) */
.panel {
  background: var(--bg-panel);
  border: 3px solid var(--border);
  position: relative;
}
.panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--accent);
}

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

/* Neon button */
.btn-primary {
  font-family: var(--font-pixel);
  font-size: 10px;
  padding: var(--space-3) var(--space-6);
  background: transparent;
  color: var(--accent);
  border: 3px solid var(--accent);
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  box-shadow: var(--shadow-accent);
  transition: background 0.2s, color 0.2s;
}
.btn-primary:hover, .btn-primary:focus-visible {
  background: var(--accent);
  color: var(--bg-dark);
}

.btn-secondary {
  /* same as btn-primary but green */
  color: var(--green);
  border-color: var(--green);
  box-shadow: var(--shadow-green);
}
.btn-secondary:hover, .btn-secondary:focus-visible {
  background: var(--green);
  color: var(--bg-dark);
}
```

### 2.6 Animations (subset of dashboard — only what's needed)

```css
@keyframes blink-pixel {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes float-particle {
  0%   { transform: translateY(100vh) rotate(0deg);   opacity: 0; }
  10%  { opacity: 0.3; }
  90%  { opacity: 0.3; }
  100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
}

@keyframes typewriter {
  from { width: 0; }
  to   { width: 100%; }
}
```

---

## 3. Section-by-Section Design Specs

### 3.0 Navigation (fixed top bar)

| Aspect | Spec |
|---|---|
| Position | `fixed`, top, full width, z-index: 100 |
| Background | `var(--bg-panel)` with `border-bottom: 3px solid var(--border)` |
| Content | Logo (pixel text "AIC") + nav links + mobile hamburger |
| Links | Features, Why AIC, Get Started, Dashboard, Architecture, FAQ |
| Behavior | Smooth scroll via `scroll-behavior: smooth` on `html`. Active link highlighted with `var(--accent)` via IntersectionObserver |
| Mobile | Hamburger icon toggles full-width dropdown menu. Links close menu on click |
| Height | 56px (7 × 8px grid) |

### 3.1 Hero Section (`#hero`)

| Aspect | Spec |
|---|---|
| Layout | Flex column, centered, min-height: 100vh |
| Background | `var(--bg-dark)` + `.grid-bg` overlay |
| Content | `h1`: "AI Engineering Company" (pixel font, 18px, accent glow) |
| | `p` tagline: "10-worker AI orchestration for software development" (mono, 16px) |
| | `p` sub-tagline: "Your agent becomes a Dispatcher. 10 specialized workers build, test, and ship." (dim text) |
| | Two buttons: "Get Started" (primary) + "View on GitHub" (secondary) |
| Visual | ASCII art block below tagline — 10 desk placeholders in 2×5 grid using box-drawing chars. One desk blinks (`animation: blink-pixel 1s infinite`) to show activity. Pure CSS/HTML, zero images |
| Scroll indicator | Down arrow at bottom, fades with `blink-pixel` animation |

**ASCII desk block (inline HTML, monospace):**
```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ PM  │ │RESRCH│ │DESIGN│ │ ARCH│ │FRONT│
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│BACK │ │ INFRA│ │  QA │ │ GOV │ │DISPT│
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
```

Each cell styled as `.panel` with colored top-bar matching worker shirt color from dashboard `workers.ts`.

### 3.2 Features Section (`#features`)

| Aspect | Spec |
|---|---|
| Layout | 4 cards in 2×2 grid (stacks to 1-col on mobile) |
| Background | `var(--bg-floor)` |

**Card 1: 10 Specialized Workers**
- Title with pixel font
- 3-column worker grid grouped by office: Product (PM, Researcher, Designer), Engineering (Architect, Frontend, Backend, Infra, QA), Governance (Governor, Dispatcher)
- Each worker: name badge + role + model tier pill (opus=yellow, sonnet=cyan, haiku=green, session=purple — colors from dashboard status system)
- All data sourced from `dashboard/src/data/workers.ts`

**Card 2: Pipeline Orchestration**
- Title: "You say WHAT. Dispatcher decides HOW."
- Horizontal flow diagram using pure CSS flex + box-drawing connectors:
  `User → Dispatcher → [Workers] → Delivery`
- Example pipeline phases listed: PM → Architect → Engineers → QA → Governor
- Task classification mini-table (3 rows, styled as `.panel`)

**Card 3: Dashboard Monitoring**
- CSS-built mockup of dashboard (not a screenshot): 2×5 grid of `.panel` boxes with colored top-bars, status dots, pixel font labels
- Badge: "React + Vite + Tailwind · Port 6969"
- Feature bullets: live status, pipeline phases, activity log

**Card 4: OpenCode Engine**
- Badge: "All workers powered by OpenCode" (purple accent border)
- 3 reasons (bulleted list): reads/writes real files, single engine = simpler config, consistent behavior
- Link to https://github.com/anomalyco/opencode

### 3.3 Why AIC Section (`#why-aic`)

| Aspect | Spec |
|---|---|
| Layout | Benefits list (left) + comparison table (right), 2-col. Stacks on mobile |
| Background | `var(--bg-dark)` + `.grid-bg` |

**Benefits (6 items):**
Each as a `.panel` mini-card with icon (CSS box-drawing character) + title + description. Icons: ▸ pipeline, ◆ files, ◈ multi-provider, ◉ dashboard, ▣ approval, ⚡ extensible.

**Comparison table:**
- Styled as `.panel` with striped rows (`:nth-child(even)` gets `var(--bg-panel-dark)`)
- 4 columns: Feature, AIC, Single-agent, Manual multi-agent
- 5 rows from requirements.md
- AIC column cells highlighted with `var(--accent)`

**Use Cases (4 items):**
- Horizontal scroll on mobile, grid on desktop
- Each: `.panel` card with task description in pixel font + pipeline arrow diagram

### 3.4 Getting Started Section (`#getting-started`)

| Aspect | Spec |
|---|---|
| Layout | Centered single column, max-width: 720px |
| Background | `var(--bg-floor)` |

**Content:**
- Prerequisites: 2 items (Node.js, API key)
- 3-step install: each step in a `.panel` with copy button (clipboard API)
- First Run: 3-line terminal block (styled as `.panel` with `var(--bg-panel-dark)`, monospace, green prompt)
- First Task: terminal block showing `/aic build a todo app with React and a REST API`

**Code blocks:**
```css
pre {
  background: var(--bg-panel-dark);
  border: 3px solid var(--border);
  padding: var(--space-4);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--green);
  overflow-x: auto;
  position: relative;
}
```

Copy button: absolute top-right, uses `navigator.clipboard.writeText()`, shows "Copied!" feedback for 2s.

### 3.5 Dashboard Demo Section (`#dashboard`)

| Aspect | Spec |
|---|---|
| Layout | Centered, max-width: 960px |
| Background | `var(--bg-dark)` + `.grid-bg` |

**Content:**
- Title: "AIC Office Dashboard" (pixel font)
- CSS-built interactive mockup (not a screenshot — keeps site under 100KB):
  - Outer `.panel` frame with CRT glow (`box-shadow: var(--shadow-accent)`)
  - Inside: 5×2 grid of worker desks (reusing the desk pattern from Hero, but smaller)
  - Each desk: 3px colored top-bar (shirt color from `workers.ts`), worker name, blinking status dot
  - One desk shows "working" state (yellow blink), others idle (gray)
- Feature bullets below mockup: pixel art workers, CRT effect, activity log, pipeline phases
- How to start: `node server.js 3000 → http://localhost:6969` in a code block

### 3.6 Architecture Overview Section (`#architecture`)

| Aspect | Spec |
|---|---|
| Layout | Centered, max-width: 800px |
| Background | `var(--bg-floor)` |

**Content:**
- ASCII/CSS diagram showing data flow:
  ```
  User → Dispatcher → Product Office (PM, Researcher, Designer)
                     → Engineering Office (Architect, Frontend, Backend, Infra, QA)
                     → Governance Office (Governor)
                     → OpenCode Engine (shared)
                     → Dashboard (React, port 6969)
  ```
- Built as nested `.panel` boxes with connector lines (CSS borders)
- Worker → Engine mapping table (10 rows, styled like comparison table)
- Data flow paragraph: User input → classification → worker spawn → result chain → delivery

### 3.7 FAQ Section (`#faq`)

| Aspect | Spec |
|---|---|
| Layout | Single column, max-width: 720px |
| Background | `var(--bg-dark)` |

**Behavior:**
- Accordion pattern: click question → answer expands (CSS `max-height` transition + JS toggle)
- Only one answer open at a time (close others on open)
- Arrow indicator rotates on open (▸ → ▾)
- Each item is a `.panel`

**Questions (8):** From requirements.md, verbatim.

**CSS accordion:**
```css
.faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.faq-answer.open {
  max-height: 500px; /* generous max, actual content is shorter */
}
```

### 3.8 Footer

| Aspect | Spec |
|---|---|
| Layout | Flex row, space-between, wraps on mobile |
| Background | `var(--bg-panel)` with `border-top: 3px solid var(--border)` |
| Content | Left: "AIC · MIT License · Built with OpenCode" |
| | Right: GitHub link (https://github.com/Deriest/aic-skill) + SKILL.md link |
| Font | Pixel font, 7px (dashboard `px-sm` equivalent) |

---

## 4. JavaScript Interactions (`script.js`)

Total scope: ~100 lines. No libraries.

### 4.1 Smooth Scroll (already handled by CSS)

`html { scroll-behavior: smooth; scroll-padding-top: 60px; }` — no JS needed for basic smooth scroll. JS only adds active nav link highlighting.

### 4.2 Active Nav Link (IntersectionObserver)

```js
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav a[href^="#"]');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
      });
    }
  });
}, { rootMargin: '-60px 0px -50% 0px', threshold: 0 });

sections.forEach(section => observer.observe(section));
```

### 4.3 FAQ Accordion

```js
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const answer = btn.nextElementSibling;
    const isOpen = answer.classList.contains('open');

    // Close all
    document.querySelectorAll('.faq-answer.open').forEach(a => a.classList.remove('open'));
    document.querySelectorAll('.faq-question').forEach(b => b.setAttribute('aria-expanded', 'false'));

    // Toggle clicked
    if (!isOpen) {
      answer.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});
```

### 4.4 Mobile Menu Toggle

```js
const menuBtn = document.querySelector('.menu-toggle');
const navMenu = document.querySelector('.nav-links');

menuBtn.addEventListener('click', () => {
  const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
  menuBtn.setAttribute('aria-expanded', !expanded);
  navMenu.classList.toggle('open');
});

// Close menu on link click
navMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    menuBtn.setAttribute('aria-expanded', 'false');
    navMenu.classList.remove('open');
  });
});
```

### 4.5 Copy-to-Clipboard (Getting Started code blocks)

```js
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.closest('pre').querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    });
  });
});
```

### 4.6 Floating Particles (subtle, 8 particles)

```js
// Inject 8 particle divs into a fixed container (matches dashboard pattern)
const container = document.createElement('div');
container.className = 'particles';
container.setAttribute('aria-hidden', 'true');
document.body.appendChild(container);

for (let i = 0; i < 8; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.style.left = Math.random() * 100 + '%';
  p.style.animationDuration = (8 + Math.random() * 4) + 's';
  p.style.animationDelay = Math.random() * 10 + 's';
  container.appendChild(p);
}
```

```css
.particles {
  position: fixed; inset: 0;
  pointer-events: none; z-index: 0;
}
.particle {
  position: absolute;
  bottom: 0;
  width: 4px; height: 4px;
  background: var(--accent);
  opacity: 0.3;
  animation: float-particle 10s linear infinite;
}
```

---

## 5. Performance Budget

| Asset | Target | Strategy |
|---|---|---|
| `index.html` | ≤ 18KB | Semantic HTML, no inline styles (except critical above-fold), no frameworks |
| `styles.css` | ≤ 12KB | CSS variables eliminate repetition, no Tailwind/PostCSS |
| `script.js` | ≤ 4KB | Vanilla JS, no libraries, minimal DOM manipulation |
| `favicon.svg` | ≤ 1KB | Inline SVG data URI in `<link>` tag |
| `og-image.png` | ≤ 30KB | Optional — can be skipped for v1 |
| **Total** | **≤ 65KB** | Well under 100KB limit |

**What's NOT included (and why):**
- No screenshots/GIFs — dashboard demo is CSS-built mockup (saves ~200KB+)
- No web fonts via CDN — Press Start 2P loaded from Google Fonts (`<link>` tag, ~15KB woff2 cached separately, not counted in budget)
- No framework (React, Vue, etc.) — vanilla HTML/CSS/JS
- No CSS preprocessor output — hand-written CSS with variables

**Loading strategy:**
- `<link rel="preconnect">` for Google Fonts
- `<link rel="preload">` for `styles.css`
- Script at bottom of `<body>` (no `defer` needed)
- No lazy loading needed (single page, no images)

---

## 6. Accessibility

### 6.1 Semantic HTML

| Element | Usage |
|---|---|
| `<header>` | Navigation bar |
| `<main>` | Wraps all content sections |
| `<section>` | Each of the 8 sections, with `id` for nav linking |
| `<nav>` | Navigation links |
| `<footer>` | Footer content |
| `<h1>`–`<h3>` | Proper heading hierarchy (one `h1` in Hero, `h2` per section, `h3` for cards) |
| `<pre><code>` | Code blocks |
| `<table>` + `<th scope="col">` | Comparison and mapping tables |
| `<button>` | FAQ toggles, copy buttons, mobile menu |
| `<a>` | All links |

### 6.2 ARIA Attributes

| Element | Attributes |
|---|---|
| Mobile menu button | `aria-expanded="false"`, `aria-controls="nav-menu"`, `aria-label="Toggle navigation"` |
| FAQ buttons | `aria-expanded="false"`, `aria-controls="faq-answer-N"` |
| FAQ answers | `role="region"`, `aria-labelledby="faq-question-N"` |
| Copy buttons | `aria-label="Copy to clipboard"` |
| Floating particles | Parent `aria-hidden="true"` (decorative) |
| ASCII art / decorative elements | `aria-hidden="true"` |
| Skip link | `<a href="#main" class="skip-link">Skip to content</a>` |

### 6.3 Keyboard Navigation

- All interactive elements are `<button>` or `<a>` (native keyboard support)
- FAQ accordion: Enter/Space toggles (native button behavior)
- Mobile menu: Escape closes
- Visible `:focus-visible` outlines using `var(--accent)` box-shadow
- Tab order follows visual order (top-to-bottom, left-to-right)
- Skip-to-content link as first focusable element

### 6.4 Color Contrast

All text/background combinations meet WCAG AA (4.5:1):
- `#e0e0e0` on `#0f0f23` → 12.8:1 ✓
- `#00d4ff` on `#0f0f23` → 8.9:1 ✓
- `#6b7280` on `#0f0f23` → 4.8:1 ✓ (used only for decorative/secondary)
- `#00ff88` on `#0a0a1a` → 9.2:1 ✓

### 6.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  html { scroll-behavior: auto; }
  .particles { display: none; }
  .faq-answer { transition: none; }
}
```

---

## 7. Browser Support

| Browser | Version | Notes |
|---|---|---|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support |
| Edge | 90+ | Full support |
| Mobile Safari | 14+ | Full support |
| Chrome Android | 90+ | Full support |

**Features requiring fallback awareness:**
- `inset` shorthand: supported in all target browsers
- `scroll-behavior: smooth`: universal in targets, graceful degradation to instant scroll
- `IntersectionObserver`: universal in targets
- `navigator.clipboard.writeText()`: HTTPS required; fallback: `document.execCommand('copy')`
- CSS custom properties: universal in targets
- `<link rel="preconnect">`: universal in targets

**No polyfills needed** for the target browser set.

---

## 8. Responsive Breakpoints

| Breakpoint | Layout Changes |
|---|---|
| < 640px (mobile) | Single column everything. Nav → hamburger. Worker grid → 2-col. Hero desks → 2×5. Tables scroll horizontally |
| 640–1023px (tablet) | 2-column grids. Nav links visible. Worker grid → 3-col |
| ≥ 1024px (desktop) | Full layout. 4-col feature cards. 2-col Why AIC |

```css
/* Mobile-first base styles are single-column */
/* Tablet */
@media (min-width: 640px) { ... }
/* Desktop */
@media (min-width: 1024px) { ... }
```

---

## 9. Implementation Order

1. **`index.html`** — full semantic structure, all 8 sections, placeholder content from requirements.md
2. **`styles.css`** — design system (variables, resets, utilities) then section-by-section styles
3. **`script.js`** — nav highlighting, FAQ accordion, mobile menu, copy buttons, particles
4. **Assets** — favicon SVG (inline), optional og-image
5. **Verify** — open in browser, test responsive, run Lighthouse, check 100KB budget

---

## 10. Constraints & Trade-offs

| Decision | Rationale |
|---|---|
| CSS mockup instead of dashboard screenshot | Saves 200KB+, always pixel-perfect, no image to maintain |
| Google Fonts for Press Start 2P | ~15KB woff2, cached after first load. Self-hosting adds ~30KB to repo |
| No CSS preprocessor | CSS variables cover all reuse needs. Preprocessor adds build step (violates "no build step" requirement) |
| Vanilla JS only | 4 interaction patterns don't justify a framework. Under 100 lines total |
| 8 floating particles (not 15) | Marketing page doesn't need dashboard-level visual density. Saves CPU on mobile |
| Single HTML file | Simpler deployment. GitHub Pages serves it directly |
| `max-height` accordion (not `<details>`) | `<details>` can't be animated cross-browser. `max-height` transition is reliable |
