# Dashboard Refactoring Pitfalls

## 1. Modifying Layout Structure vs Modifying Styling

When asked to move a UI component (like the Worker Statistics Panel) from one container to another:
- Do **NOT** rely solely on changing flexbox properties (`flex-col`, `order-`) if the goal is to physically relocate a component across major structural sections (e.g., from the Left Main Content to the Right Sidebar).
- Cut and paste the component's JSX block into the target parent container.
- Run an ad-hoc Node/bash verification script to parse the TSX code using Regex (`content.match()`) to definitively confirm the DOM hierarchy matches the requested relocation before building.

## 2. Dynamic Component Registration (Hardcoded Arrays)

When adding new elements that depend on a predefined array (like `WORKERS` and `WORKER_NAMES`):
- Ensure that *all* dependent arrays, mappings, or hardcoded dictionaries across the application (e.g., `CostsPage.tsx`, `OverviewPage.tsx`, `data/workers.ts`) are updated simultaneously.
- If a new worker is added to the backend API but omitted from a frontend metrics mapping dictionary, it will silently drop from specific dashboard views.
- **Verification Rule:** Write a quick script that extracts keys from the Source of Truth (`data/workers.ts`) and asserts their existence in the dependent view files before compiling.

## 3. Asymmetric Dashboard Layouts

When replacing symmetric grids (`grid-cols-2`) with asymmetric layouts (e.g., 60% / 40% splits):
- Use Tailwind CSS responsive flex classes (`flex flex-col md:flex-row`).
- Assign specific proportional widths to the child containers (e.g., `md:w-3/5` and `md:w-2/5`).
- Remove the old `grid` wrapper entirely to prevent CSS conflicts.

## 4. State Cleanup on Reload (Stale State Injection)

If the dashboard relies on a `state.json` written by the backend API:
- Stale objects (like a renamed worker role, e.g., `researcher` -> `research`) may persist in the state file if the backend merely merges the file at startup.
- This causes the dashboard to render ghost objects (e.g., showing 16 total agents instead of 15).
- **Fix:** The backend API's state-loading function must explicitly filter out keys from the JSON object that are no longer defined in the source-of-truth constants array before serving the state to the frontend.

## 5. False Positives in Health Monitoring

If a script uses `pgrep -f "node.*server.js"` to verify the API server is alive:
- It may falsely match unrelated processes running on the machine (e.g., `tsserver.js` for TypeScript Language Server).
- **Fix:** Verify active network ports (`ss -tlnp | grep 6868`) or hit the health endpoint directly (`curl -sf http://localhost:6868/health`) rather than relying on broad process string matching.

## 6. "Working" Status Derivation (Sub-worker Sync)
The dashboard needs to show a worker as "Working" (yellow) if the Head Worker is working OR if any of its sub-workers are working.
- **Bug:** Using `Object.values(state.workers)` to map rendering fails when trying to access `.phase` or `.id` because `state.workers` only contains the status payload, not the worker metadata constants.
- **Fix:** Always map over `WORKERS` (from `data/workers.ts`) and use `w.id` to look up the runtime state:
  ```typescript
  const ws = state.workers?.[w.id];
  const isWorking = ws?.status === 'working' || ws?.subWorkers?.some(s => s.status === 'working');
  ```

## 7. Waiting PM Review Derivation
A worker must only show "WAITING PM REVIEW" if it has completed execution, but the PM review for that phase is still pending.
- **Fix:**
  ```typescript
  const isWaitingPM = ws?.status === 'complete' && state.pmReview?.phase === w.phase && !state.rework?.failedWorkers?.includes(w.id);
  ```

## 8. Complete Status Calculation
A worker is only truly "Complete" if its own status is complete AND all its sub-workers are complete AND the PM Review phase has advanced past it.
- **Fix:**
  ```typescript
  const isComplete = ws?.status === 'complete' && (!ws?.subWorkers || ws.subWorkers.every(s => s.status === 'complete')) && state.pmReview?.phase !== w.phase;
  ```

## 9. Layout: Flex vs Fixed Height in 100vh
When trying to make the left column (Virtual Office) and right column (Pipeline + Gate) equal height within a 100vh viewport (`h-screen overflow-hidden`), using `h-[XX%]` can cause layout drift. 
- **Fix:** Use `flex-1 min-h-0` on container wrappers, and allocate exact heights (`h-[240px]`) with `shrink-0` to the specific cards you want hard-locked. If filling remaining space with a decorative image, use `flex-1 min-h-0` or `mt-auto` on the image wrapper so it absorbs the slack without overflowing the page.

## 10. Action Buttons (Reserved Space)
When reserving space for future action buttons ("Delegate", "OpenCode") in a worker card, do not show disabled/grey buttons when the worker is idle or complete. It clutters the UI.
- **Fix:** Only render the buttons conditionally when `status === 'working'`. Wait for the status to change before revealing the actions.

## 11. UI Sizing Hard-Freezes
During the AIC dashboard development, the following fixed sizing constraints became permanent. Do **not** modify them to "improve" responsive behavior without an explicit SPEC review.

| Component | Target CSS Constraint |
| --- | --- |
| Current Task Card | `h-[240px] shrink-0` |
| Pipeline Card | `h-[240px] shrink-0` |
| Runtime Gate Card | `h-[240px] shrink-0` |
| Worker Statistics | `h-[150px] shrink-0` |
| Image Overlay (`AIC.png`) | `h-[180px] shrink-0 mt-auto mb-[50px]` |
| Virtual Office Box | `h-[94.5%]` |

## 12. JSX Nesting
When patching files with regex (`sed`) or targeted patches:
- Missing closing divs `</div>` frequently break the build.
- Rather than a multi-pass regex sequence, sometimes a full component rewrite is significantly safer for complex React tree structures.
