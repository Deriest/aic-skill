import sys, os, re, json
import yaml

def parse_frontmatter(content):
    if not content.startswith('---'): return None
    end = content.find('\n---', 3)
    if end == -1: return None
    try: return yaml.safe_load(content[3:end])
    except: return None

def validate_artifact(path, worker):
    if not os.path.exists(path):
        return f"Missing required deliverable: {worker}-output.md"
    
    with open(path, 'r') as f:
        content = f.read()
    
    # 1. Frontmatter exists
    meta = parse_frontmatter(content)
    if not meta:
        return f"Missing or malformed YAML frontmatter in {worker}-output.md"
    
    # 2. H1 heading exists
    if not re.search(r'^# .+', content, re.MULTILINE):
        return f"Missing required H1 heading in {worker}-output.md"
        
    # 3. Minimum word count
    words = len(re.findall(r'\w+', content))
    if words < 50:
        return f"Artifact too short ({words} words) in {worker}-output.md"
        
    return None

if __name__ == '__main__':
    if len(sys.argv) < 3: sys.exit(0)
    task_dir = sys.argv[1]
    workers = sys.argv[2].split(',')
    
    errors = []
    for w in workers:
        w = w.strip()
        if not w: continue
        art_path = os.path.join(task_dir, 'reports', f"{w}-output.md")
        err = validate_artifact(art_path, w)
        if err: errors.append(err)
        
    if errors:
        print(json.dumps({
            "verdict": "BLOCKED",
            "reason": "InvalidArtifact",
            "decision_package": {
                "owner": "Worker",
                "root_cause": "Mechanical validation failed: " + "; ".join(errors),
                "engineering_objective": "Produce structurally valid deliverables matching phase contracts.",
                "expected_deliverables": [f"{w}-output.md" for w in workers],
                "completion_criteria": ["Frontmatter exists", "H1 exists", "Word count >= 50"]
            }
        }))
        sys.exit(1)
    sys.exit(0)