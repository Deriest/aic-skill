'use strict';

// Artifact Provider — abstracts artifact retrieval for PM Review
// PM Review never reads files directly. It asks the provider.
// ponytail: single reports/ provider; add cache/object-storage when multi-node

const fs = require('fs');
const path = require('path');

function parseFrontmatter(content) {
  const str = String(content);
  if (!str.startsWith('---')) return { metadata: {}, body: str };
  const end = str.indexOf('\n---', 3);
  if (end === -1) return { metadata: {}, body: str };
  const yaml = str.slice(4, end).trim();
  const body = str.slice(end + 4).replace(/^\n/, '');
  const meta = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { metadata: meta, body };
}

class ArtifactProvider {
  constructor(tasksDir) {
    this.tasksDir = tasksDir;
  }

  _reportDir(taskId) {
    return path.join(this.tasksDir, taskId, 'reports');
  }

  // Get artifact content (body only, frontmatter stripped)
  get(taskId, worker, phase) {
    const filePath = this._resolve(taskId, worker);
    if (!filePath || !fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return parseFrontmatter(raw).body;
  }

  // Get full content including frontmatter
  getRaw(taskId, worker) {
    const filePath = this._resolve(taskId, worker);
    if (!filePath || !fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  }

  // Get metadata envelope only
  getMetadata(taskId, worker) {
    const filePath = this._resolve(taskId, worker);
    if (!filePath || !fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const { metadata } = parseFrontmatter(raw);
    return Object.keys(metadata).length ? metadata : { schema_version: 0 };
  }

  // List all artifacts for a task
  list(taskId) {
    const dir = this._reportDir(taskId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      .map(f => {
        const worker = f.replace(/-output\.md$/, '');
        const meta = this.getMetadata(taskId, worker);
        return { filename: f, worker, metadata: meta };
      });
  }

  // Check if artifact is stale relative to current generation
  isStale(taskId, worker, currentGeneration) {
    const meta = this.getMetadata(taskId, worker);
    if (!meta || !meta.generation) return false; // no metadata = can't determine
    return parseInt(meta.generation, 10) < currentGeneration;
  }

  // Resolve artifact file path
  _resolve(taskId, worker) {
    const dir = this._reportDir(taskId);
    const name = `${worker}-output.md`;
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) return filePath;
    // Fallback: try without -output suffix
    const alt = path.join(dir, `${worker}.md`);
    if (fs.existsSync(alt)) return alt;
    return null;
  }
}

module.exports = { ArtifactProvider, parseFrontmatter };
