#!/usr/bin/env node
// update-json-files.js
// Usage: node update-json-files.js <path-to-json> <path-to-folder>

const fs   = require('fs');
const path = require('path');

if (process.argv.length < 4) {
  console.error('Usage: node packager.js <path-to-json> <path-to-folder>');
  process.exit(1);
}

const jsonPath   = path.resolve(process.argv[2]);
const folderPath = path.resolve(process.argv[3]);
const destination = process.argv[4] ?? path.join('resources', 'app', 'node_modules');

console.log(`Updating ${jsonPath} with files from ${folderPath}`);

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON file not found: ${jsonPath}`);
  process.exit(1);
}
if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
  console.error(`Folder not found or not a directory: ${folderPath}`);
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────
const walk = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : full;
  });

// ────────────────────────────────────────────────────────────────────────────────
// Build new file list
// ────────────────────────────────────────────────────────────────────────────────
const data        = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
data.files        = Array.isArray(data.files) ? data.files : [];

const parentDir   = path.dirname(folderPath);
const existing    = new Set(data.files.map(f => f.source));

const newEntries  = walk(folderPath).map(file => {
  const rel = path.relative(parentDir, file);          // e.g. "@serialport/index.js"
  return {
    source: rel.replace(/\\/g, '/'),                   // always forward-slashes
    target: path.join(destination.replace(/\\/g, '/'), rel)// path.join('resources', 'app', 'node_modules', rel)
                           // Windows-style for target
  };
}).filter(e => !existing.has(e.source));               // avoid duplicates

data.files.push(...newEntries);

// ────────────────────────────────────────────────────────────────────────────────
// Write back
// ────────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
console.log(`Added ${newEntries.length} entr${newEntries.length === 1 ? 'y' : 'ies'} to ${jsonPath}`);
