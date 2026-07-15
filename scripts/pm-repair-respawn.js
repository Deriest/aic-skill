#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

function deleteArtifacts(skillDir, taskId, workers) {
  const dir = path.join(skillDir, '.aic', 'tasks', taskId, 'reports');
  for (const w of workers) {
    const f = path.join(dir, w + '-output.md');
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (e) {
      console.error('delete failed', f, e.message);
      process.exit(1);
    }
  }
}

const args = process.argv.slice(2);
if (args[0] === 'delete-artifacts' && args.length >= 4) {
  deleteArtifacts(args[1], args[2], args[3].split(','));
} else {
  console.error('usage: pm-repair-respawn.js delete-artifacts <skillDir> <taskId> <workersCsv>');
  process.exit(2);
}
