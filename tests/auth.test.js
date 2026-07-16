'use strict';
const fs = require('fs');
const path = require('path');

// auth.js resolves CREDS_FILE = path.join(__dirname, '..', '.aic', 'auth.json')
// Write test creds to that location, backup and restore after each test.
const aicDir = path.join(__dirname, '..', '.aic');
const realCredsFile = path.join(aicDir, 'auth.json');
let savedCreds = null;

beforeEach(() => {
  try { savedCreds = fs.readFileSync(realCredsFile, 'utf8'); } catch { savedCreds = null; }
  fs.mkdirSync(aicDir, { recursive: true });
  fs.writeFileSync(realCredsFile, JSON.stringify({
    apiKeys: [
      { key: 'test-key-1234567890abcdef1234567890ab', label: 'test', createdAt: new Date().toISOString() }
    ]
  }));
  // Bust require cache so auth.js re-reads creds
  delete require.cache[require.resolve('../scripts/auth')];
});

afterEach(() => {
  if (savedCreds !== null) {
    fs.writeFileSync(realCredsFile, savedCreds);
  } else {
    try { fs.unlinkSync(realCredsFile); } catch {}
  }
});

describe('auth.validateRequest', () => {
  it('returns valid=true for correct API key via x-api-key header', () => {
    const { validateRequest } = require('../scripts/auth');
    const req = { headers: { 'x-api-key': 'test-key-1234567890abcdef1234567890ab' } };
    expect(validateRequest(req).valid).toBe(true);
  });

  it('returns valid=true for correct API key via Bearer header', () => {
    const { validateRequest } = require('../scripts/auth');
    const req = { headers: { 'authorization': 'Bearer test-key-1234567890abcdef1234567890ab' } };
    expect(validateRequest(req).valid).toBe(true);
  });

  it('returns valid=false for missing key', () => {
    const { validateRequest } = require('../scripts/auth');
    const req = { headers: {} };
    const r = validateRequest(req);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Missing API key/);
  });

  it('returns valid=false for wrong key', () => {
    const { validateRequest } = require('../scripts/auth');
    const req = { headers: { 'x-api-key': 'wrong-key' } };
    const r = validateRequest(req);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Invalid API key/);
  });
});
