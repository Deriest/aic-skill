#!/usr/bin/env python3
"""extract-code-blocks.py — Extract fenced code blocks with file annotations from worker output.

Convention: Workers annotate code blocks with a file path comment on the first line:
    ```tsx src/components/Hero.tsx
    export function Hero() { ... }
    ```

    ```html index.html
    <!DOCTYPE html>
    ```

    ```css src/index.css
    body { ... }
    ```

    ```ts src/data/workers.ts
    export const workers = [...]
    ```

Also supports the `file:` prefix:
    ```file:src/App.tsx
    ...code...
    ```

Usage:
    python3 extract-code-blocks.py <report_file> <project_dir> [--dry-run]

Exit codes:
    0 = files extracted (or dry-run)
    1 = no code blocks found or parse error
    2 = missing args
"""

import re
import sys
import os

# Pattern: ```<lang> <filepath>  or  ```file:<filepath>
BLOCK_PATTERN = re.compile(
    r'```(?:(\w+)\s+([\w./@\-_]+)|file:([\w./@\-_]+))\s*\n(.*?)```',
    re.DOTALL
)

# Extensions we recognize as valid file targets
VALID_EXTS = {
    '.tsx', '.ts', '.jsx', '.js', '.css', '.html', '.json', '.md',
    '.py', '.sh', '.yaml', '.yml', '.toml', '.svg', '.woff2',
}

def is_valid_filepath(fp: str) -> bool:
    """Check if string looks like a real file path (not a language tag)."""
    # Must have a valid extension or be a known config file
    _, ext = os.path.splitext(fp)
    if ext.lower() in VALID_EXTS:
        return True
    # Known files without standard extensions
    basename = os.path.basename(fp)
    if basename in ('Makefile', 'Dockerfile', '.env', '.gitignore', '.eslintrc', '.prettierrc'):
        return True
    return False

def extract_blocks(report_path: str, project_dir: str, dry_run: bool = False) -> list:
    """Extract code blocks and write to project_dir."""
    with open(report_path, 'r') as f:
        content = f.read()

    matches = BLOCK_PATTERN.findall(content)
    if not matches:
        return []

    extracted = []
    for lang, path1, path2, code in matches:
        filepath = path1 or path2
        if not filepath or not is_valid_filepath(filepath):
            continue

        # Normalize path
        filepath = filepath.strip().strip('`').strip('"').strip("'")
        if filepath.startswith('/'):
            # Absolute path — only allow within project dir
            if not filepath.startswith(project_dir):
                continue
            filepath = os.path.relpath(filepath, project_dir)

        full_path = os.path.join(project_dir, filepath)

        # Skip if empty code
        code_stripped = code.strip()
        if len(code_stripped) < 5:
            continue

        # Skip if file already exists with same content
        if os.path.exists(full_path):
            with open(full_path, 'r') as f:
                if f.read() == code_stripped:
                    continue

        if dry_run:
            print(f"  [DRY-RUN] Would write: {filepath} ({len(code_stripped)} bytes)")
        else:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w') as f:
                f.write(code_stripped)
            print(f"  Extracted: {filepath} ({len(code_stripped)} bytes)")

        extracted.append(filepath)

    return extracted

def main():
    if len(sys.argv) < 3:
        print("Usage: extract-code-blocks.py <report_file> <project_dir> [--dry-run]", file=sys.stderr)
        sys.exit(2)

    report_file = sys.argv[1]
    project_dir = sys.argv[2]
    dry_run = '--dry-run' in sys.argv

    if not os.path.exists(report_file):
        sys.exit(1)

    extracted = extract_blocks(report_file, project_dir, dry_run)
    if extracted:
        print(f"[extract] {len(extracted)} file(s) from {os.path.basename(report_file)}")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
