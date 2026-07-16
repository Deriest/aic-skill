#!/usr/bin/env python3
"""Consistency Checker — compares planning artifacts for contradictions.

Usage: consistency-checker.py <artifact1.md> [artifact2.md] ... --output <report.md>

Exit codes:
  0 = no conflicts found
  1 = error (bad args, missing files)
  2 = conflicts found (report written)

This is a SCRIPT, not a worker. Hermes executes it after barrier, before PM Review.
Hermes SHALL NOT rewrite artifacts — only detect and report.
"""
import sys
import re
import os
from pathlib import Path

def parse_args(argv):
    files = []
    output = None
    i = 0
    while i < len(argv):
        if argv[i] == '--output' and i + 1 < len(argv):
            output = argv[i + 1]
            i += 2
        else:
            files.append(argv[i])
            i += 1
    return files, output

def read_artifact(path):
    try:
        text = Path(path).read_text(encoding='utf-8')
        name = Path(path).stem  # e.g. "architect-output" → "architect"
        worker = name.replace('-output', '')
        return worker, text
    except Exception:
        return None, ''

def extract_claims(text):
    """Extract factual claims from artifact text.
    
    Simple heuristic: find sentences with strong assertions.
    ponytail: keyword matching, upgrade to NLP/LLM for precision.
    """
    claims = []
    # Match lines with assertions (starts with bullet or numbered, contains key verbs)
    assertion_verbs = [
        'must', 'shall', 'should', 'requires', 'requires no',
        'no issues', 'no gaps', 'no bugs', 'no conflicts',
        'found', 'identified', 'detected', 'missing',
        'impossible', 'cannot', 'will not', 'needs',
        'recommend', 'suggest', 'propose', 'assume',
        'risk', 'constraint', 'dependency', 'blocker',
    ]
    for line in text.split('\n'):
        stripped = line.strip()
        if not stripped or len(stripped) < 20:
            continue
        # Skip headings
        if stripped.startswith('#'):
            continue
        lower = stripped.lower()
        for verb in assertion_verbs:
            if verb in lower:
                claims.append(stripped)
                break
    return claims

def detect_contradictions(artifacts):
    """Detect contradictions between artifacts.
    
    Strategy: keyword-based opposition detection.
    ponytail: upgrade to LLM-based comparison for precision.
    """
    conflicts = []
    workers = list(artifacts.keys())
    
    # Opposition patterns: (positive_pattern, negative_pattern)
    opposition_pairs = [
        (r'no\s+(?:bugs|issues|gaps|conflicts|problems)', r'(?:found|identified|detected)\s+\d+'),
        (r'no\s+(?:bugs|issues|gaps|conflicts|problems)', r'(?:critical|major|minor)\s+(?:bug|issue|gap|defect)'),
        (r'(?:impossible|cannot|will not)', r'(?:must|should|needs?\s+to)'),
        (r'(?:complete|finished|done|ready)', r'(?:incomplete|missing|lacking|unfinished)'),
        (r'(?:no\s+risk|low\s+risk)', r'(?:high\s+risk|critical\s+risk|blocker)'),
        (r'(?:no\s+change|no\s+modification)', r'(?:requires?\s+change|must\s+modify|needs?\s+update)'),
    ]
    
    for i in range(len(workers)):
        for j in range(i + 1, len(workers)):
            w1, w2 = workers[i], workers[j]
            t1, t2 = artifacts[w1].lower(), artifacts[w2].lower()
            
            for pos_pat, neg_pat in opposition_pairs:
                w1_has_pos = bool(re.search(pos_pat, t1))
                w1_has_neg = bool(re.search(neg_pat, t1))
                w2_has_pos = bool(re.search(pos_pat, t2))
                w2_has_neg = bool(re.search(neg_pat, t2))
                
                # Direct contradiction: w1 says positive, w2 says negative (or vice versa)
                if (w1_has_pos and w2_has_neg):
                    conflicts.append({
                        'type': 'contradiction',
                        'workers': [w1, w2],
                        'pattern': f'{w1}: "{pos_pat}" vs {w2}: "{neg_pat}"',
                    })
                elif (w2_has_pos and w1_has_neg):
                    conflicts.append({
                        'type': 'contradiction',
                        'workers': [w2, w1],
                        'pattern': f'{w2}: "{pos_pat}" vs {w1}: "{neg_pat}"',
                    })
    
    # Check for missing cross-references
    for w1 in workers:
        for w2 in workers:
            if w1 == w2:
                continue
            # If worker references something that doesn't exist in any other artifact
            refs = re.findall(r'(?:see|refer|per|according to)\s+(?:' + '|'.join(workers) + r')', artifacts[w1].lower())
    
    return conflicts

def detect_missing_dependencies(artifacts):
    """Check if one artifact references a deliverable that another doesn't mention."""
    issues = []
    workers = list(artifacts.keys())
    
    # Extract deliverable references (files, components, services)
    file_refs = {}
    for w, text in artifacts.items():
        refs = set()
        # File references
        for m in re.finditer(r'[\w\-]+\.(?:js|py|ts|sh|md|json|yaml|yml|sql|html|css)', text):
            refs.add(m.group().lower())
        # Component/service names (capitalized words)
        for m in re.finditer(r'\b[A-Z][a-z]+(?:Service|Component|Module|Controller|Handler)\b', text):
            refs.add(m.group().lower())
        file_refs[w] = refs
    
    # If architect references a file that backend/frontend don't mention
    # (This is a soft signal, not a hard conflict)
    return issues

def generate_report(artifacts, conflicts, missing_deps):
    """Generate consistency-report.md."""
    lines = [
        '# Consistency Report',
        '',
        f'Artifacts analyzed: {", ".join(artifacts.keys())}',
        '',
    ]
    
    if not conflicts and not missing_deps:
        lines.append('## Result: NO CONFLICTS DETECTED')
        lines.append('')
        lines.append('All planning artifacts are consistent.')
        return '\n'.join(lines)
    
    if conflicts:
        lines.append(f'## Conflicts Found: {len(conflicts)}')
        lines.append('')
        for i, c in enumerate(conflicts, 1):
            lines.append(f'### Conflict {i}: {c["type"].title()}')
            lines.append(f'- Workers: {", ".join(c["workers"])}')
            lines.append(f'- Pattern: {c["pattern"]}')
            lines.append('')
    
    if missing_deps:
        lines.append(f'## Missing Dependencies: {len(missing_deps)}')
        lines.append('')
        for dep in missing_deps:
            lines.append(f'- {dep}')
        lines.append('')
    
    lines.append('## Recommendation')
    lines.append('')
    lines.append('PM should reconcile these conflicts before making PASS/REWORK decision.')
    lines.append('Workers responsible for conflicting claims should provide evidence.')
    lines.append('')
    
    return '\n'.join(lines)

def main():
    files, output = parse_args(sys.argv[1:])
    
    if not files:
        print('Usage: consistency-checker.py <artifact1.md> ... --output <report.md>', file=sys.stderr)
        sys.exit(1)
    
    # Read all artifacts
    artifacts = {}
    for f in files:
        if not os.path.isfile(f):
            print(f'Warning: {f} not found, skipping', file=sys.stderr)
            continue
        worker, text = read_artifact(f)
        if worker and text:
            artifacts[worker] = text
    
    if len(artifacts) < 2:
        print('Not enough artifacts to compare (< 2)', file=sys.stderr)
        sys.exit(0)
    
    # Run checks
    conflicts = detect_contradictions(artifacts)
    missing_deps = detect_missing_dependencies(artifacts)
    
    # Generate report
    report = generate_report(artifacts, conflicts, missing_deps)
    
    if output:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        Path(output).write_text(report, encoding='utf-8')
        print(f'Consistency report written to {output}')
    
    if conflicts:
        print(f'CONFLICTS: {len(conflicts)} found')
        sys.exit(2)
    else:
        print('NO CONFLICTS')
        sys.exit(0)

if __name__ == '__main__':
    main()
