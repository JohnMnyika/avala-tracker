#!/usr/bin/env node
// watch-and-import.js
// Watch for an exported avala-projects.json and automatically import it into avala-projects.md

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const watchPath = process.argv[2] || path.join(process.cwd(), 'avala-projects.json');
const importScript = path.join(__dirname, 'import-projects.js');

console.log('Watching', watchPath, 'for changes. Press Ctrl+C to stop.');

let timer = null;
fs.watch(path.dirname(watchPath), (eventType, filename) => {
  if (!filename) return;
  const full = path.join(path.dirname(watchPath), filename);
  if (full !== watchPath) return;
  if (timer) clearTimeout(timer);
  // debounce
  timer = setTimeout(() => {
    if (!fs.existsSync(watchPath)) return;
    console.log('Change detected, importing', watchPath);
    const p = spawn(process.execPath, [importScript, watchPath], { stdio: 'inherit' });
    p.on('close', (code) => console.log('Import exited', code));
  }, 300);
});
