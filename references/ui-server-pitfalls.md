# Dashboard UI & Server Pitfalls

## Node.js Static Server Crashes on Vite Rebuilds
**Symptom:** The backend API server (`server.js`) crashes with an `ENOENT` error when the frontend runs `npm run build`.
**Root Cause:** Vite temporarily deletes `dist/index.html` during the build process. If the server receives a request and attempts an SPA fallback (`res.sendFile('index.html')`) at that exact moment, it throws an unhandled error and dies.
**Fix:** Always wrap static fallback reads with `fs.existsSync`. If the file is missing, gracefully return an HTTP 503 (e.g., "Dashboard is building") instead of attempting to serve a non-existent file.

## SVG Overflow with object-fit
**Symptom:** Pixel-art SVGs overflow their parent containers despite having inline `width: 100%`, `height: 100%`, and `objectFit: "cover"`.
**Root Cause:** The SVG's native `preserveAspectRatio="none"` attribute overrides CSS `object-fit`.
**Fix:** Change the SVG attribute to `preserveAspectRatio="xMidYMid slice"`. This is the SVG-native equivalent of `object-fit: cover` and ensures the graphic scales proportionally and clips correctly without bleeding out of `overflow-hidden` containers.

## Optical Alignment of Pixel Icons
**Symptom:** Text-baseline alignment (`flex items-center`) leaves pixel-art icons (like `▶`) visually misaligned (usually too low).
**Fix:** Do not rely solely on flexbox for pixel-perfect optical alignment of mixed icon/text elements. Remove flex centering from the icon wrapper and apply explicit translation: `className="inline-block -translate-y-[2px]"`.

## Config Form Jsonc Parsing
**Symptom:** The opencode.jsonc config file appears blank in the UI.
**Root Cause:** Raw textarea representations are unsafe and the UI doesn't know how to parse trailing comments in JSONC.
**Fix:** Provide a two-column form UI. Parse `opencode.jsonc` by stripping comments (`replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')`) before passing to `JSON.parse`. Include a "Fetch Models" button that hits `baseURL + '/models'` with the provided API key, maps the available IDs, and populates dropdown selects.

## Dispatcher "SOP Harga Mati" & Server Lifecycle
**Symptom:** PM or Governor workers silently fail to activate (stay "idle" on dashboard) despite being spawned successfully.
**Root Cause:** The server's `PHASE_ALLOWED` array lacks the worker for that specific phase, returning a 403 Forbidden silently to `spawn-worker.sh`.
**Fix:** Ensure backend lifecycle logic perfectly mirrors the strict SOP. `pm` MUST be allowed in `investigate` and `planning`. `governor` MUST be allowed in `documentation` and `verification`. The Dispatcher is ABSOLUTELY FORBIDDEN from bypassing phases, even for trivial visual tasks (SOP Harga Mati).