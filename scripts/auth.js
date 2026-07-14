const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CREDS_FILE = path.join(__dirname, '..', '.aic', 'auth.json');

function corsOriginForRequest(req) {
  const raw = (process.env.AIC_CORS_ORIGINS || '').trim();
  const origin = req.headers.origin;
  if (!raw) return origin || '*';
  const allowed = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) return origin;
  return null;
}

function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch {
    return { apiKeys: [] };
  }
}

function saveCredentials(creds) {
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
}

function generateApiKey() {
  const key = crypto.randomBytes(32).toString('hex');
  return key;
}

function addApiKey(label = 'default') {
  const creds = loadCredentials();
  const key = generateApiKey();
  creds.apiKeys.push({ key, label, createdAt: new Date().toISOString() });
  saveCredentials(creds);
  return key;
}

function removeApiKey(key) {
  const creds = loadCredentials();
  const before = creds.apiKeys.length;
  creds.apiKeys = creds.apiKeys.filter(k => k.key !== key);
  if (creds.apiKeys.length === before) return false;
  saveCredentials(creds);
  return true;
}

function validateRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  const apiKey = req.headers['x-api-key'] || '';

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (apiKey) {
    token = apiKey;
  }

  if (!token) return { valid: false, error: 'Missing API key. Provide X-API-Key header or Authorization: Bearer <key>' };

  const creds = loadCredentials();
  const found = creds.apiKeys.some(k => k.key === token);
  if (!found) return { valid: false, error: 'Invalid API key' };
  return { valid: true };
}

function requireAuth(req, res) {
  const result = validateRequest(req);
  if (!result.valid) {
    const cors = corsOriginForRequest(req);
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    };
    if (cors) {
      headers['Access-Control-Allow-Origin'] = cors;
      if (cors !== '*') headers.Vary = 'Origin';
    }
    res.writeHead(401, headers);
    res.end(JSON.stringify({ error: result.error }));
    return false;
  }
  return true;
}

function listApiKeys() {
  const creds = loadCredentials();
  return creds.apiKeys.map(k => ({ label: k.label, createdAt: k.createdAt, keyPreview: k.key.slice(0, 8) + '...' }));
}

module.exports = { addApiKey, removeApiKey, validateRequest, requireAuth, listApiKeys, loadCredentials, saveCredentials };
