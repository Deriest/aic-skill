# Website Task Description Template

Use this template when creating tasks for website/landing page projects. Vague prompts cause worker divergence (TASK-20260715-009: Tailwind v3 vs v4, flat vs nested dirs, conflicting dep lists).

## Required Fields

```
Task Title: [Project Name] — [Type]

Description:
Build a [frontend-only/full-stack] website for [purpose].

MANDATORY tech stack:
- Framework: [e.g. React 19]
- Language: [e.g. TypeScript]
- Build: [e.g. Vite]
- CSS: [e.g. Tailwind CSS v4 + @tailwindcss/vite, NO PostCSS]
- 3D: [e.g. React Three Fiber + Three.js + Drei, or "none"]
- Animation: [e.g. Framer Motion, or "CSS only"]
- Icons: [e.g. Lucide React, or "SVG only"]

MANDATORY directory structure:
src/
  components/{list subdirs}
  data/
  hooks/
  styles/
  [others]

Design language:
- Background: [hex]
- Panels: [hex]
- Accent: [hex]
- Success: [hex]
- Borders: [hex]
- Typography: [font family]

Background effects: [explicit list, exact count]
3D elements: [explicit list, exact count]

Sections: [numbered list with brief description]

Reference: [link to design brief in .aic/prompts/]

Out of scope: [explicit exclusions]
```

## Why This Template Exists

TASK-009 failed because:
- Architect chose Tailwind v4, Research chose v3
- Architect listed 3 background effects, PM cited 6 from design brief
- Research included Press Start 2P font, Architect didn't mention it
- Directory structure: nested vs flat

All because the original prompt said "React+TS+Vite+TailwindCSS+R3F+Framer Motion" without specifying versions, counts, or structure.

## Dispatcher Workflow

1. User gives website task request
2. Dispatcher creates design brief at `.aic/prompts/<TASK-ID>-design-brief.md` using `templates/promo-design-brief.md`
3. Dispatcher fills in this template with explicit constraints
4. Task created with filled template as description
5. Canonical Spec step (v3.3.0) validates consistency before workers diverge
