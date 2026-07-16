# Dashboard Layout Foundation (IMP-002)

## Viewport Chain

The entire viewport chain must be `height:100%; overflow:hidden` to prevent phantom scrolling:

```css
/* index.css @layer base */
html { height: 100%; overflow: hidden; }
body { height: 100%; overflow: hidden; }
#root { height: 100%; overflow: hidden; }
```

```tsx
// App.tsx — root container
<div className="flex flex-col h-screen ...overflow-hidden">
```

```tsx
// OverviewPage.tsx — NO h-screen (parent flex-1 handles it)
<div className="flex flex-col flex-1 p-3 min-h-0 overflow-hidden">
```

**Anti-patterns:**
- `min-h-screen` on App → allows growing past viewport → phantom scroll
- `h-screen` on page components inside flex-1 parent → duplicates viewport calc
- `h-[94%]` → magic number, unstable across resolutions/DPI
- `h-full` on flex children → unreliable across browsers (Chrome vs Firefox differ)

## Layout Approach: Hybrid Grid + Flex

- **Page structure**: CSS Grid or Flex for top-level header+content split
- **Column layout**: Flex for left/right ratio (`flex-[1.5]` / `flex-1`)
- **Content panels**: Flex for internal layout
- **Card grids**: CSS Grid (`grid-cols-4`, `grid-cols-2`)

Use `flex-1 min-h-0` instead of `h-full` everywhere. The `min-h-0` override is critical — without it, flex children won't shrink below their content size, causing overflow.

## Scroll Infrastructure

Only ONE container should own scrolling per panel. The right panel uses a `ScrollContainer` component:

```tsx
function ScrollContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState('');
  const update = useCallback(() => {
    const el = ref.current; if (!el) return;
    const top = el.scrollTop > 0;
    const bot = el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setShadow(top && bot ? 'has-both-shadow' : top ? 'has-top-shadow' : bot ? 'has-bottom-shadow' : '');
  }, []);
  useEffect(() => {
    update();
    const el = ref.current; if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [update]);
  return <div ref={ref} className={`scroll-shadow ${shadow} ${className}`}>{children}</div>;
}
```

All children inside ScrollContainer use `shrink-0` to prevent flex shrinking.

## Scroll Shadows (CSS)

```css
/* index.css @layer utilities */
.scroll-shadow {
  overflow-y: auto; overflow-x: hidden;
  background:
    linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%) top,
    linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%) bottom;
  background-size: 100% 16px;
  background-repeat: no-repeat;
  background-attachment: local, local;
}
.scroll-shadow.has-top-shadow {
  background:
    linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%) top,
    linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%) bottom;
  background-size: 100% 16px;
  background-repeat: no-repeat;
  background-attachment: scroll, local;
}
.scroll-shadow.has-bottom-shadow {
  background:
    linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%) top,
    linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%) bottom;
  background-size: 100% 16px;
  background-repeat: no-repeat;
  background-attachment: local, scroll;
}
.scroll-shadow.has-both-shadow {
  background:
    linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%) top,
    linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%) bottom;
  background-size: 100% 16px;
  background-repeat: no-repeat;
  background-attachment: scroll, scroll;
}
```

Uses `background-attachment: scroll vs local` to create shadow-on-scroll effect without JS opacity manipulation. Shadow opacity 0.4 — subtle, matches dark theme.

## Container Normalization Rules

1. Never use `min-h-screen` — use `h-screen` (exact viewport)
2. Never use `h-full` inside flex — use `flex-1 min-h-0`
3. Never use magic percentage heights (e.g., `h-[94%]`) — use flex distribution
4. All flex children that might overflow need `min-h-0`
5. `overflow-hidden` only on containers that should NEVER scroll
6. `overflow-y: auto` only on the ONE designated scroll container per panel
7. `shrink-0` on all non-scrollable content inside a scroll container

## Cross-Browser Consistency

- `min-h-0` is the key fix for Firefox flex overflow (Chrome is more forgiving)
- Custom scrollbar styling (`::-webkit-scrollbar`) for Chromium; Firefox uses `scrollbar-width: thin` by default
- Font rendering: `font-pixel` + `antialiased` (from Tailwind) normalizes across browsers
- Avoid `dvh`/`lvh`/`svh` — use `%` for maximum compatibility (2026 baseline still needs it)
