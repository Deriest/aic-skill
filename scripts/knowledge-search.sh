#!/usr/bin/env bash
# knowledge-search.sh — Knowledge Search (H-3)
# Keyword search over knowledge base
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$SKILL_DIR/.aic/knowledge/registry.json"
ARTIFACTS_DIR="$SKILL_DIR/.aic/artifacts"

QUERY="${1:?Missing search query}"
TYPE_FILTER="${2:-}"
TAG_FILTER="${3:-}"

[ -f "$REGISTRY" ] || { echo "  No registry found"; exit 1; }

python3 -c "
import json, os, subprocess

query = '$QUERY'.lower()
type_filter = '$TYPE_FILTER'
tag_filter = '$TAG_FILTER'
reg = json.load(open('$REGISTRY'))
results = []

for a in reg['artifacts'].values():
    score = 0
    if query in a['title'].lower(): score += 3
    if query in a['type'].lower(): score += 2
    for tag in a.get('tags', []):
        if query in tag.lower(): score += 2
        if tag_filter and tag == tag_filter: score += 1
    if query in a['id'].lower(): score += 1
    if type_filter and a['type'] != type_filter: continue
    if score > 0:
        results.append((score, a))

results.sort(key=lambda x: -x[0])
if not results:
    print('  No results found')
else:
    print(f'  Found {len(results)} results:')
    for score, a in results[:10]:
        print(f'    [{a[\"status\"]}] {a[\"id\"]} — {a[\"title\"]} (score:{score})')
"
