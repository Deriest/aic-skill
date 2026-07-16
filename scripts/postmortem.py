#!/usr/bin/env python3
"""Postmortem Analysis — runs automatically after every COMPLETE task.

Collects evidence from all task artifacts, analyzes execution quality,
produces postmortem report + updates engineering metrics.

Usage: postmortem.py <skill_dir> <task_id>

Exit codes:
  0 = postmortem complete
  1 = error (missing data, bad args)

NEVER modifies the completed task.
"""
import sys
import os
import json
import glob
from pathlib import Path
from datetime import datetime, timezone

def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception:
        return None

def load_text(path):
    try:
        return Path(path).read_text(encoding='utf-8')
    except Exception:
        return ''

def word_count(text):
    return len(text.split()) if text else 0

# ── Evidence Collection ──

def collect_evidence(skill_dir, task_id):
    """Collect all available evidence from a completed task."""
    task_dir = Path(skill_dir) / '.aic' / 'tasks' / task_id
    reports_dir = task_dir / 'reports'

    evidence = {
        'task_id': task_id,
        'collected_at': datetime.now(timezone.utc).isoformat(),
        'artifacts': {},
        'consistency_report': None,
        'execution_plan': None,
        'pm_reviews': [],
        'repair_history': [],
        'validation': {},
        'checkpoint': None,
        'context': None,
    }

    # Context
    ctx_path = task_dir / 'context.json'
    evidence['context'] = load_json(ctx_path)

    # Checkpoint (has all pipeline state)
    cp_path = task_dir / 'checkpoint.json'
    evidence['checkpoint'] = load_json(cp_path)

    # Worker artifacts
    if reports_dir.exists():
        for art_file in sorted(reports_dir.glob('*-output.md')):
            worker = art_file.stem.replace('-output', '')
            text = load_text(art_file)
            evidence['artifacts'][worker] = {
                'path': str(art_file),
                'bytes': art_file.stat().st_size,
                'words': word_count(text),
                'has_h1': text.startswith('#') if text else False,
            }

        # Execution plan
        ep_path = reports_dir / 'execution-plan.md'
        if ep_path.exists():
            text = load_text(ep_path)
            evidence['execution_plan'] = {
                'bytes': ep_path.stat().st_size,
                'words': word_count(text),
                'sections': [l.strip() for l in text.split('\n') if l.strip().startswith('##')],
            }

        # Consistency report
        cc_path = reports_dir / 'consistency-report.md'
        if cc_path.exists():
            text = load_text(cc_path)
            evidence['consistency_report'] = {
                'bytes': cc_path.stat().st_size,
                'has_conflicts': 'CONFLICTS' in text and 'NO CONFLICTS' not in text,
                'word_count': word_count(text),
            }

        # PM verdict
        verdict_path = reports_dir / '.pm-last-verdict.txt'
        if verdict_path.exists():
            evidence['pm_reviews'].append(load_text(verdict_path))

        # EDP
        edp_path = reports_dir / '.pm-last-edp.json'
        edp = load_json(edp_path)
        if edp:
            evidence['repair_history'].append(edp)

    # Validation reports
    for val_file in sorted(task_dir.rglob('validation-report*')):
        evidence['validation'][val_file.name] = load_text(val_file)

    return evidence

# ── Analysis ──

def analyze_execution(evidence):
    """Analyze execution quality from collected evidence."""
    cp = evidence.get('checkpoint') or {}
    rework = cp.get('rework') or {}
    context = evidence.get('context') or {}

    analysis = {
        'worker_agreement': analyze_worker_agreement(evidence),
        'repair_analysis': analyze_repairs(evidence, cp),
        'artifact_quality': analyze_artifacts(evidence),
        'execution_plan_quality': analyze_execution_plan(evidence),
        'consistency_analysis': analyze_consistency(evidence),
        'pipeline_efficiency': analyze_pipeline_efficiency(cp),
        'ship_with_caveats': cp.get('shipWithCaveats', False),
    }

    return analysis

def analyze_worker_agreement(evidence):
    """Check if workers produced consistent outputs."""
    artifacts = evidence.get('artifacts', {})
    workers = list(artifacts.keys())
    planning_workers = [w for w in workers if w in ('architect', 'research', 'designer', 'pm')]

    if len(planning_workers) < 2:
        return {'rate': 1.0, 'detail': 'insufficient workers to compare'}

    # Simple heuristic: if consistency report exists and has no conflicts
    cc = evidence.get('consistency_report')
    if cc and not cc.get('has_conflicts'):
        return {'rate': 1.0, 'detail': 'consistency checker: no conflicts'}

    if cc and cc.get('has_conflicts'):
        return {'rate': 0.0, 'detail': 'consistency checker: conflicts found'}

    return {'rate': None, 'detail': 'no consistency report available'}

def analyze_repairs(evidence, cp):
    """Analyze repair iterations."""
    rework = cp.get('rework') or {}
    repair_attempts = rework.get('attempt', 0)
    repaired_workers = rework.get('repairedWorkers', [])

    return {
        'total_repair_attempts': repair_attempts,
        'repaired_workers': repaired_workers,
        'last_verdict': rework.get('lastVerdict', 'NONE'),
        'ship_with_caveats': cp.get('shipWithCaveats', False),
    }

def analyze_artifacts(evidence):
    """Analyze quality of produced artifacts."""
    artifacts = evidence.get('artifacts', {})
    quality = {}

    for worker, info in artifacts.items():
        issues = []
        if info['bytes'] < 100:
            issues.append('too_small')
        if info['words'] < 50:
            issues.append('too_short')
        if not info.get('has_h1'):
            issues.append('missing_h1')

        quality[worker] = {
            'words': info['words'],
            'bytes': info['bytes'],
            'issues': issues,
            'score': max(0, 100 - len(issues) * 20),
        }

    return quality

def analyze_execution_plan(evidence):
    """Analyze execution plan quality."""
    ep = evidence.get('execution_plan')
    if not ep:
        return {'exists': False, 'quality': 0}

    required_sections = ['Objective', 'Scope', 'Non-Scope', 'Assumptions',
                         'Constraints', 'Deliverables', 'Risks', 'Acceptance Criteria']
    sections = [s.replace('## ', '').strip() for s in ep.get('sections', [])]

    found = sum(1 for req in required_sections if any(req.lower() in s.lower() for s in sections))
    missing = [req for req in required_sections if not any(req.lower() in s.lower() for s in sections)]

    return {
        'exists': True,
        'words': ep['words'],
        'sections_found': found,
        'sections_total': len(required_sections),
        'missing_sections': missing,
        'quality': round(found / len(required_sections) * 100),
    }

def analyze_consistency(evidence):
    """Analyze consistency report."""
    cc = evidence.get('consistency_report')
    if not cc:
        return {'exists': False}

    return {
        'exists': True,
        'has_conflicts': cc.get('has_conflicts', False),
    }

def analyze_pipeline_efficiency(cp):
    """Analyze pipeline execution efficiency."""
    if not cp:
        return {}

    phases = []
    for phase in ['INVESTIGATE', 'PLANNING', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSEOUT']:
        phases.append({
            'phase': phase,
            'status': 'completed',  # If task is COMPLETE, all phases completed
        })

    return {
        'phases': phases,
        'total_phases': len(phases),
        'ship_with_caveats': cp.get('shipWithCaveats', False),
    }

# ── Metrics Update ──

def update_metrics(skill_dir, task_id, evidence, analysis):
    """Update cumulative engineering metrics."""
    metrics_path = Path(skill_dir) / '.aic' / 'engineering-metrics.json'

    if metrics_path.exists():
        metrics = load_json(metrics_path)
    else:
        metrics = _init_metrics()

    # Pipeline metrics
    metrics['pipeline']['total_tasks'] += 1
    metrics['pipeline']['successful_tasks'] += 1

    rep = analysis.get('repair_analysis', {})
    if rep.get('total_repair_attempts', 0) > 0:
        metrics['pipeline']['tasks_with_repairs'] += 1
        metrics['pipeline']['total_repair_iterations'] += rep['total_repair_attempts']

    # Worker metrics
    wa = analysis.get('worker_agreement', {})
    if wa.get('rate') is not None:
        metrics['worker']['agreement_samples'].append(wa['rate'])

    # Consistency metrics
    cc = analysis.get('consistency_analysis', {})
    if cc.get('exists'):
        metrics['consistency']['total_reports'] += 1
        if cc.get('has_conflicts'):
            metrics['consistency']['reports_with_conflicts'] += 1

    # Execution plan metrics
    ep = analysis.get('execution_plan_quality', {})
    if ep.get('exists'):
        metrics['execution_plan']['total_plans'] += 1
        metrics['execution_plan']['quality_samples'].append(ep['quality'])
        if ep.get('missing_sections'):
            metrics['execution_plan']['missing_section_count'] += len(ep['missing_sections'])

    # Artifact quality
    for worker, info in analysis.get('artifact_quality', {}).items():
        metrics['artifacts']['total'] += 1
        if info.get('issues'):
            metrics['artifacts']['with_issues'] += 1
        metrics['artifacts']['quality_samples'].append(info['score'])

    # Caveats
    if analysis.get('ship_with_caveats'):
        metrics['pipeline']['caveat_shipments'] += 1

    # History entry
    metrics['history'].append({
        'task_id': task_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'repair_attempts': rep.get('total_repair_attempts', 0),
        'worker_agreement': wa.get('rate'),
        'consistency_conflicts': cc.get('has_conflicts', False) if cc.get('exists') else None,
        'execution_plan_quality': ep.get('quality', 0),
        'caveats': analysis.get('ship_with_caveats', False),
    })

    # Keep last 100 history entries
    if len(metrics['history']) > 100:
        metrics['history'] = metrics['history'][-100:]

    Path(metrics_path).parent.mkdir(parents=True, exist_ok=True)
    Path(metrics_path).write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding='utf-8')
    return metrics

def _init_metrics():
    return {
        'version': '1.0',
        'updated_at': None,
        'pipeline': {
            'total_tasks': 0,
            'successful_tasks': 0,
            'tasks_with_repairs': 0,
            'total_repair_iterations': 0,
            'caveat_shipments': 0,
        },
        'worker': {
            'agreement_samples': [],
        },
        'consistency': {
            'total_reports': 0,
            'reports_with_conflicts': 0,
        },
        'execution_plan': {
            'total_plans': 0,
            'quality_samples': [],
            'missing_section_count': 0,
        },
        'artifacts': {
            'total': 0,
            'with_issues': 0,
            'quality_samples': [],
        },
        'history': [],
    }

# ── Pattern Discovery ──

def discover_patterns(metrics):
    """Discover recurring patterns from historical metrics."""
    patterns = []
    history = metrics.get('history', [])

    if len(history) < 2:
        return patterns

    # Pattern: frequent repairs
    repair_tasks = [h for h in history if h.get('repair_attempts', 0) > 0]
    if len(repair_tasks) > len(history) * 0.5:
        patterns.append({
            'type': 'frequent_repairs',
            'severity': 'HIGH',
            'evidence': f'{len(repair_tasks)}/{len(history)} tasks needed repairs',
            'recommendation': 'Review worker prompts for clarity. Execution plan quality may be insufficient.',
        })

    # Pattern: recurring consistency conflicts
    conflict_tasks = [h for h in history if h.get('consistency_conflicts')]
    if len(conflict_tasks) > len(history) * 0.3:
        patterns.append({
            'type': 'recurring_conflicts',
            'severity': 'MEDIUM',
            'evidence': f'{len(conflict_tasks)}/{len(history)} tasks had consistency conflicts',
            'recommendation': 'Workers may need clearer role boundaries. Consider strengthening execution plan constraints.',
        })

    # Pattern: poor execution plans
    ep_qualities = [h.get('execution_plan_quality', 100) for h in history if h.get('execution_plan_quality')]
    if ep_qualities:
        avg_quality = sum(ep_qualities) / len(ep_qualities)
        if avg_quality < 70:
            patterns.append({
                'type': 'poor_execution_plans',
                'severity': 'HIGH',
                'evidence': f'Average execution plan quality: {avg_quality:.0f}%',
                'recommendation': 'PM needs better execution plan prompt. Add template validation.',
            })

    # Pattern: frequent caveat shipments
    caveat_tasks = [h for h in history if h.get('caveats')]
    if len(caveat_tasks) > len(history) * 0.3:
        patterns.append({
            'type': 'frequent_caveats',
            'severity': 'MEDIUM',
            'evidence': f'{len(caveat_tasks)}/{len(history)} tasks shipped with caveats',
            'recommendation': 'Quality gate may be too strict, or workers need improvement. Review rejection criteria.',
        })

    return patterns

# ── Report Generation ──

def generate_report(evidence, analysis, patterns, metrics):
    """Generate postmortem report."""
    task_id = evidence['task_id']
    context = evidence.get('context') or {}

    lines = [
        f'# Postmortem Report: {task_id}',
        '',
        f'Generated: {evidence["collected_at"]}',
        f'Title: {context.get("title", "N/A")}',
        '',
        '## Execution Summary',
        '',
        f'- Artifacts produced: {len(evidence.get("artifacts", {}))}',
        f'- Execution plan: {"Yes" if evidence.get("execution_plan") else "No"}',
        f'- Consistency report: {"Yes" if evidence.get("consistency_report") else "No"}',
        f'- Ship with caveats: {"Yes" if analysis.get("ship_with_caveats") else "No"}',
        '',
    ]

    # Worker Agreement
    wa = analysis.get('worker_agreement', {})
    lines += [
        '## Worker Agreement',
        '',
        f'- Rate: {wa.get("rate", "N/A")}',
        f'- Detail: {wa.get("detail", "N/A")}',
        '',
    ]

    # Repair Analysis
    rep = analysis.get('repair_analysis', {})
    lines += [
        '## Repair Analysis',
        '',
        f'- Total repair attempts: {rep.get("total_repair_attempts", 0)}',
        f'- Repaired workers: {", ".join(rep.get("repaired_workers", [])) or "None"}',
        f'- Last verdict: {rep.get("last_verdict", "NONE")}',
        '',
    ]

    # Artifact Quality
    lines += [
        '## Artifact Quality',
        '',
        '| Worker | Words | Score | Issues |',
        '|--------|-------|-------|--------|',
    ]
    for worker, info in analysis.get('artifact_quality', {}).items():
        issues = ', '.join(info.get('issues', [])) or 'None'
        lines.append(f'| {worker} | {info["words"]} | {info["score"]} | {issues} |')
    lines.append('')

    # Execution Plan Quality
    ep = analysis.get('execution_plan_quality', {})
    lines += [
        '## Execution Plan Quality',
        '',
        f'- Exists: {ep.get("exists", False)}',
    ]
    if ep.get('exists'):
        lines += [
            f'- Quality: {ep["quality"]}%',
            f'- Sections: {ep["sections_found"]}/{ep["sections_total"]}',
            f'- Missing: {", ".join(ep.get("missing_sections", [])) or "None"}',
        ]
    lines.append('')

    # Consistency Analysis
    cc = analysis.get('consistency_analysis', {})
    lines += [
        '## Consistency Analysis',
        '',
        f'- Report exists: {cc.get("exists", False)}',
        f'- Has conflicts: {cc.get("has_conflicts", "N/A")}',
        '',
    ]

    # Patterns
    if patterns:
        lines += [
            '## Discovered Patterns',
            '',
        ]
        for p in patterns:
            lines += [
                f'### {p["type"]} [{p["severity"]}]',
                f'- Evidence: {p["evidence"]}',
                f'- Recommendation: {p["recommendation"]}',
                '',
            ]

    # Engineering Metrics Summary
    pipeline = metrics.get('pipeline', {})
    lines += [
        '## Cumulative Engineering Metrics',
        '',
        f'- Total tasks: {pipeline.get("total_tasks", 0)}',
        f'- Tasks with repairs: {pipeline.get("tasks_with_repairs", 0)}',
        f'- Total repair iterations: {pipeline.get("total_repair_iterations", 0)}',
        f'- Caveat shipments: {pipeline.get("caveat_shipments", 0)}',
        '',
    ]

    # Recommendations
    recommendations = generate_recommendations(analysis, patterns)
    if recommendations:
        lines += [
            '## Recommendations',
            '',
        ]
        for i, rec in enumerate(recommendations, 1):
            lines += [
                f'{i}. **{rec["target"]}** [{rec["priority"]}]',
                f'   - Evidence: {rec["evidence"]}',
                f'   - Expected benefit: {rec["expected_benefit"]}',
                '',
            ]

    return '\n'.join(lines)

def generate_recommendations(analysis, patterns):
    """Generate evidence-based improvement recommendations."""
    recs = []

    # From patterns
    for p in patterns:
        if p['type'] == 'frequent_repairs':
            recs.append({
                'target': 'Worker prompts',
                'priority': 'HIGH',
                'evidence': p['evidence'],
                'expected_benefit': 'Reduce repair iterations, faster task completion',
                'affected_components': ['phase-contract-loader.py', 'worker prompts'],
            })
        if p['type'] == 'recurring_conflicts':
            recs.append({
                'target': 'Execution plan template',
                'priority': 'MEDIUM',
                'evidence': p['evidence'],
                'expected_benefit': 'Clearer role boundaries, fewer contradictions',
                'affected_components': ['pm-repair-respawn.js', 'phase-runner.sh'],
            })
        if p['type'] == 'poor_execution_plans':
            recs.append({
                'target': 'PM planning prompt',
                'priority': 'HIGH',
                'evidence': p['evidence'],
                'expected_benefit': 'Better single source of truth, fewer downstream conflicts',
                'affected_components': ['phase-runner.sh PM_EXECUTION_PLAN_BLOCK'],
            })

    # From artifact quality
    for worker, info in analysis.get('artifact_quality', {}).items():
        if info.get('score', 100) < 60:
            recs.append({
                'target': f'{worker} worker prompt',
                'priority': 'MEDIUM',
                'evidence': f'{worker} artifact score: {info["score"]}, issues: {", ".join(info.get("issues", []))}',
                'expected_benefit': 'Higher quality artifacts from first attempt',
                'affected_components': [f'phase-contract-loader.py ({worker})'],
            })

    return recs

# ── Main ──

def main():
    if len(sys.argv) < 3:
        print('Usage: postmortem.py <skill_dir> <task_id>', file=sys.stderr)
        sys.exit(1)

    skill_dir = sys.argv[1]
    task_id = sys.argv[2]

    if not os.path.isdir(os.path.join(skill_dir, '.aic', 'tasks', task_id)):
        print(f'Error: task directory not found for {task_id}', file=sys.stderr)
        sys.exit(1)

    # 1. Collect evidence
    evidence = collect_evidence(skill_dir, task_id)

    # 2. Analyze
    analysis = analyze_execution(evidence)

    # 3. Update metrics
    metrics = update_metrics(skill_dir, task_id, evidence, analysis)

    # 4. Discover patterns
    patterns = discover_patterns(metrics)

    # 5. Generate report
    report = generate_report(evidence, analysis, patterns, metrics)

    # 6. Write report
    report_dir = os.path.join(skill_dir, '.aic', 'tasks', task_id, 'reports')
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, 'postmortem-report.md')
    Path(report_path).write_text(report, encoding='utf-8')

    # 7. Write patterns if any
    if patterns:
        patterns_path = os.path.join(skill_dir, '.aic', 'engineering-patterns.json')
        existing = load_json(patterns_path) or []
        existing.append({
            'task_id': task_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'patterns': patterns,
        })
        # Keep last 50 pattern reports
        if len(existing) > 50:
            existing = existing[-50:]
        Path(patterns_path).write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f'Postmortem complete: {report_path}')
    print(f'Patterns found: {len(patterns)}')

    sys.exit(0)

if __name__ == '__main__':
    main()
