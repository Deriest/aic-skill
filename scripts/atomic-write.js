'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Atomic JSON write: writes to a temp file in the same directory, then renames.
 * Prevents corruption on crash mid-write.
 */
function writeJsonSafe(filePath, data) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

/**
 * Atomic write for arbitrary string content.
 */
function writeTextSafe(filePath, content) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

module.exports = { writeJsonSafe, writeTextSafe };
