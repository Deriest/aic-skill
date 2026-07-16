// Enterprise Platform Endpoints (Milestone J)
const fs = require('fs');
const path = require('path');

const aicDir = path.join(__dirname, '..', '.aic');

function readJson(f, def) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; }
}
function writeJson(f, data) { fs.writeFileSync(f, JSON.stringify(data, null, 2)); }

async function handleEnterpriseEndpoint(req, res, send, readBody, state) {
  const url = new URL(req.url, `http://localhost:${state.port}`);
  const p = url.pathname;

  // J-1: Projects
  if (p === '/api/projects' && req.method === 'GET') {
    send(res, 200, { projects: readJson(path.join(aicDir, 'projects.json'), []) }); return true;
  }
  if (p === '/api/projects' && req.method === 'POST') {
    const body = await readBody(req);
    const projects = readJson(path.join(aicDir, 'projects.json'), []);
    const proj = { id: `proj-${Date.now()}`, name: body.name, dir: body.dir || process.cwd(), status: 'active', created_at: Date.now() };
    projects.push(proj);
    writeJson(path.join(aicDir, 'projects.json'), projects);
    send(res, 201, proj); return true;
  }
  if (p.match(/^\/api\/projects\/select\/.+/) && req.method === 'POST') {
    const pid = p.split('/').pop();
    const projects = readJson(path.join(aicDir, 'projects.json'), []);
    const proj = projects.find(x => x.id === pid);
    if (!proj) { send(res, 404, { error: 'project not found' }); return true; }
    writeJson(path.join(aicDir, 'active-project.json'), { project_dir: proj.dir, task_type: 'feature', timestamp: Date.now(), branch: 'main', project_id: pid });
    send(res, 200, { selected: pid }); return true;
  }

  // J-2: Workspaces
  if (p === '/api/workspaces' && req.method === 'GET') {
    const wsDir = path.join(aicDir, 'workspaces');
    const workspaces = [];
    try {
      for (const d of fs.readdirSync(wsDir)) {
        const cfg = path.join(wsDir, d, 'config.json');
        if (fs.existsSync(cfg)) workspaces.push(readJson(cfg, {}));
      }
    } catch {}
    send(res, 200, { workspaces }); return true;
  }

  // J-4: Permissions
  if (p === '/api/permissions' && req.method === 'GET') {
    send(res, 200, readJson(path.join(aicDir, 'permissions.json'), {})); return true;
  }
  if (p === '/api/permissions/assign' && req.method === 'POST') {
    const body = await readBody(req);
    const perms = readJson(path.join(aicDir, 'permissions.json'), {});
    perms.users = perms.users || {};
    perms.users[body.user] = body.role;
    writeJson(path.join(aicDir, 'permissions.json'), perms);
    send(res, 200, { assigned: `${body.user} → ${body.role}` }); return true;
  }

  // J-5: Audit
  if (p === '/api/audit' && req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const filter = url.searchParams.get('filter') || '';
    try {
      let lines = fs.readFileSync(path.join(aicDir, 'audit.log'), 'utf8').split('\n').filter(Boolean);
      if (filter) lines = lines.filter(l => l.includes(filter));
      send(res, 200, { entries: lines.slice(-limit), total: lines.length }); return true;
    } catch { send(res, 200, { entries: [], total: 0 }); }
  }

  // J-6: Resources
  if (p === '/api/resources/quota' && req.method === 'GET') {
    send(res, 200, readJson(path.join(aicDir, 'quotas.json'), {})); return true;
  }
  if (p === '/api/resources/quota' && req.method === 'POST') {
    const body = await readBody(req);
    const quotas = readJson(path.join(aicDir, 'quotas.json'), {});
    quotas[body.workspace] = { max_tokens_per_day: body.max_tokens || 1000000, max_workers: body.max_workers || 10 };
    writeJson(path.join(aicDir, 'quotas.json'), quotas);
    send(res, 200, { quota_set: body.workspace }); return true;
  }

  // J-7: Dispatchers
  if (p === '/api/dispatchers' && req.method === 'GET') {
    send(res, 200, { dispatchers: readJson(path.join(aicDir, 'dispatcher-registry.json'), []) }); return true;
  }
  if (p === '/api/dispatchers' && req.method === 'POST') {
    const body = await readBody(req);
    const reg = readJson(path.join(aicDir, 'dispatcher-registry.json'), []);
    const disp = { id: `disp-${Date.now()}`, name: body.name, port: body.port || 6868, projects: [], status: 'active', registered_at: Date.now() };
    reg.push(disp);
    writeJson(path.join(aicDir, 'dispatcher-registry.json'), reg);
    send(res, 201, disp); return true;
  }

  return false; // not handled
}

module.exports = { handleEnterpriseEndpoint };
