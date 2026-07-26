#!/usr/bin/env node
// import-projects.js
// Read an exported avala-projects.json and merge/update avala-projects.md

const fs = require('fs');
const path = require('path');

const jsonPath = process.argv[2] || 'avala-projects.json';
const mdPath = path.join(__dirname, '..', 'avala-projects.md');

if (!fs.existsSync(jsonPath)) {
  console.error('JSON file not found:', jsonPath);
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
let md = '';
if (fs.existsSync(mdPath)) md = fs.readFileSync(mdPath, 'utf8');

function ensureHeader(text) {
  if (!text.startsWith('# Avala Tracked Projects')) {
    return '# Avala Tracked Projects\n\nThis file lists projects tracked on Avala for quick reference.\n\n' + text;
  }
  return text;
}

md = ensureHeader(md);

for (const key of Object.keys(data)) {
  const item = data[key];
  const title = item.title || item.dataset || key;
  const url = item.url || '';
  const firstSeen = item.firstSeenAt || item.firstSeen || '';
  const sequences = (item.sequences && item.sequences.join(', ')) || item.sequence || '';

  const entryMd = `- **Title:** ${title}\n  - **Dataset:** ${item.dataset || ''}\n  - **Sequences:** ${sequences}\n  - **Avala link:** ${url}\n  - **First seen:** ${firstSeen}\n`;

  // If an entry with the same dataset exists, replace it. Otherwise append.
  const header = `- **Dataset:** ${item.dataset || key}`;
  const datasetPattern = new RegExp(escapeReg(header) + '[\\s\\S]*?(?=\\n- \\\*\\\*Title:|$)', 'm');
  if (datasetPattern.test(md)) {
    md = md.replace(datasetPattern, entryMd + '\n');
  } else {
    md = md.trim() + '\n\n' + entryMd + '\n';
  }
}

fs.writeFileSync(mdPath, md, 'utf8');
console.log('Updated', mdPath);

function escapeReg(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
