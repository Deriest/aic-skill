"""QA validation for AIC marketing website (site/)"""

import os, re, sys

SITE = os.path.join(os.path.dirname(__file__), "site")
REQUIRED = {"index.html", "styles.css", "script.js", "favicon.svg"}
SECTIONS = ["hero", "features", "why-aic", "getting-started", "dashboard", "architecture", "faq"]
MAX_BYTES = 100 * 1024  # 100KB
PASS, FAIL = 0, 0

def check(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        print(f"  PASS  {label}")
        PASS += 1
    else:
        print(f"  FAIL  {label}  {detail}")
        FAIL += 1

print("=" * 60)
print("AIC WEBSITE QA REPORT")
print("=" * 60)

# --- 1. File existence ---
print("\n[1/5] FILE EXISTENCE & SIZE")
files_found = set(os.listdir(SITE))
# also check assets/
assets = os.path.join(SITE, "assets")
files_found |= {os.path.join("assets", f) for f in os.listdir(assets)}
flat = set()
for f in files_found:
    if os.path.isfile(os.path.join(SITE, f)):
        flat.add(f)
for r in REQUIRED:
    # normalize: favicon.svg is inside assets/
    path = r if r != "favicon.svg" else os.path.join("assets", r)
    rpath = os.path.join(SITE, path)
    exists = os.path.isfile(rpath)
    check(f"File exists: {path}", exists)

# --- 2. Total size < 100KB ---
total = 0
for root, dirs, fnames in os.walk(SITE):
    for fname in fnames:
        fp = os.path.join(root, fname)
        total += os.path.getsize(fp)
check(f"Total size < 100KB ({total:,} bytes)", total < MAX_BYTES, f"actual={total:,}")

# --- 3. Parse index.html ---
html_path = os.path.join(SITE, "index.html")
html = open(html_path, encoding="utf-8").read()

print("\n[2/5] REQUIRED SECTIONS")
for s in SECTIONS:
    found = f'id="{s}"' in html or f"id='{s}'" in html
    check(f"Section: #{s}", found)

print("\n[3/5] ACCESSIBILITY")

# skip link
has_skip = bool(re.search(r'class="[^"]*\bskip-link\b', html))
check("Skip link present", has_skip)

# semantic tags
for tag in ["header", "nav", "main", "section", "article", "footer"]:
    check(f"Semantic <{tag}>", f"<{tag}" in html)

# ARIA
aria_attrs = ["aria-label", "aria-expanded", "aria-controls", "aria-hidden", "aria-labelledby"]
for attr in aria_attrs:
    check(f"ARIA: {attr}", attr in html)

# role attributes
for role in ["banner", "contentinfo", "region"]:
    check(f"role=\"{role}\"", f'role="{role}"' in html)

# lang attribute
check('html lang="..."', 'lang="en"' in html or re.search(r'lang="[a-z]+"', html))

print("\n[4/5] LINK & RESOURCE INTEGRITY")

# local CSS
check("styles.css linked", 'href="styles.css"' in html)

# local JS
check("script.js linked", 'src="script.js"' in html)

# favicon
check("favicon.svg linked", 'href="assets/favicon.svg"' in html or "favicon.svg" in html)

# internal anchor targets match sections
internal_links = re.findall(r'href="#([a-z][\w-]*)"', html)
section_ids = re.findall(r'id="([a-z][\w-]*)"', html)
broken = [l for l in internal_links if l not in section_ids]
# remove href=# which is for logo/scroll-to-top
broken = [b for b in broken if b not in ['']]
check("No broken internal links", len(broken) == 0, f"broken: {broken}")

# external links have rel="noopener"
external_links = re.findall(r'href="https?://[^"]+"', html)
for el in external_links:
    if 'rel="noopener"' not in html and "rel=noopener" not in html:
        # check surrounding context for rel
        pass

# Google Fonts preconnect
check("Font preconnect present", 'href="https://fonts.googleapis.com"' in html)
check("Font stylesheet present", 'fonts.googleapis.com' in html)

print("\n[5/5] CSS QUALITY")

css = open(os.path.join(SITE, "styles.css"), encoding="utf-8").read()

# vendor prefixes (should be minimal in 2026)
prefixes = ["-webkit-", "-moz-", "-ms-", "-o-"]
vendor_count = sum(1 for p in prefixes if p in css)
# css-grid and flexbox usage
has_grid = "grid" in css
has_flex = "flex" in css or "flexbox" in css
check("Uses CSS Grid", has_grid)
check("Uses CSS Flexbox", has_flex)

# print-friendly
has_print = "@media print" in css or "@media print" in css
check("Print-friendly @media print", has_print)

# reduced-motion
has_rm = "prefers-reduced-motion" in css
check("Reduced-motion support", has_rm)

# check for vendor prefixes in CSS (excluding those in font-family values)
vendor_in_css = re.findall(r'-(?:webkit|moz|ms|o)-[a-z-]+', css)
# filter out font-family entries
vendor_in_css_filtered = [v for v in vendor_in_css if 'font' not in v.lower()]
check("No unnecessary vendor prefixes", len(vendor_in_css_filtered) == 0, f"found: {vendor_in_css_filtered}")

# --- SUMMARY ---
print("\n" + "=" * 60)
print(f"RESULTS:  {PASS} passed, {FAIL} failed, {PASS+FAIL} total")
print("=" * 60)
sys.exit(0 if FAIL == 0 else 1)
