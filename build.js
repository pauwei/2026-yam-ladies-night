#!/usr/bin/env node
/*
 * Ladies Night — site builder
 * Reads guests.json + template.html and generates a self-contained page
 * for every guest at /invite/<code>/index.html, plus the NFC URL list.
 *
 *   node build.js                → uses the base URL in guests.json / default
 *   node build.js https://user.github.io/ladies-night   → override base URL
 *
 * Each generated page bakes in ONLY that one guest's details, so the full
 * guest list is never shipped in a single fetchable file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'guests.json'), 'utf8'));
const template = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');

const baseUrl = (process.argv[2] || data.baseUrl || 'https://USERNAME.github.io/ladies-night').replace(/\/$/, '');
const ev = data.event;

// ---- reusable inline SVG art (keeps pages self-contained) ----
const SUNBURST = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${
  Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15) * Math.PI / 180;
    const x1 = 50 + Math.cos(a) * 14, y1 = 50 + Math.sin(a) * 14;
    const x2 = 50 + Math.cos(a) * 46, y2 = 50 + Math.sin(a) * 46;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#BC4B2B" stroke-width="2.4" stroke-linecap="round"/>`;
  }).join('')
}<circle cx="50" cy="50" r="8" fill="#BC4B2B"/></svg>`;

const PLACESETTING = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#BC4B2B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="100" cy="100" r="52" opacity=".9"/>
  <circle cx="100" cy="100" r="42" opacity=".5"/>
  <!-- fork -->
  <path d="M40 62v20a10 10 0 0 0 10 10v46" opacity=".85"/>
  <path d="M40 62v22M50 62v22M46 62v22" opacity=".85"/>
  <!-- knife -->
  <path d="M160 62c-8 4-10 18-10 28h10z" opacity=".85"/>
  <path d="M160 62v76" opacity=".85"/>
  <!-- napkin bow -->
  <path d="M100 96c-14-6-24 6-16 12 6 4 16-2 16-12z" opacity=".9"/>
  <path d="M100 96c14-6 24 6 16 12-6 4-16-2-16-12z" opacity=".9"/>
  <circle cx="100" cy="99" r="3" fill="#BC4B2B" stroke="none"/>
</svg>`;

function seating(g) {
  if (g.table && g.seat) return `Table ${g.table}, Seat ${g.seat}`;
  if (g.table) return `Table ${g.table}`;
  return 'To be announced';
}

function render(g) {
  return template
    .replace(/{{FIRST_NAME}}/g, esc(g.firstName || (g.name || '').split(' ')[0]))
    .replace(/{{FULL_NAME}}/g, esc(g.name || ''))
    .replace(/{{STATUS}}/g, esc(g.status || 'Confirmed'))
    .replace(/{{SEATING}}/g, esc(seating(g)))
    .replace(/{{DATE}}/g, esc(ev.date))
    .replace(/{{TIME}}/g, esc(ev.time))
    .replace(/{{SUNBURST}}/g, SUNBURST)
    .replace(/{{PLACESETTING}}/g, PLACESETTING);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---- generate guest pages ----
const inviteDir = path.join(ROOT, 'invite');
// clean previously generated code folders
if (fs.existsSync(inviteDir)) {
  for (const d of fs.readdirSync(inviteDir)) {
    const p = path.join(inviteDir, d);
    if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(inviteDir, { recursive: true });
}

const seen = new Set();
const urls = [];
for (const g of data.guests) {
  if (!g.code) { console.warn(`! skipping guest with no code: ${g.name}`); continue; }
  if (seen.has(g.code)) { console.warn(`! duplicate code "${g.code}" — skipped`); continue; }
  seen.add(g.code);
  const dir = path.join(inviteDir, g.code);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(g));
  urls.push({ name: g.name, code: g.code, url: `${baseUrl}/invite/${g.code}/` });
}

// ---- NFC url list (plain text + csv) ----
fs.writeFileSync(
  path.join(ROOT, 'nfc-urls.txt'),
  urls.map(u => `${u.name}\t${u.code}\t${u.url}`).join('\n') + '\n'
);
fs.writeFileSync(
  path.join(ROOT, 'nfc-urls.csv'),
  'Guest Name,Code,URL,Card Printed,NFC Programmed,Tested\n' +
    urls.map(u => `"${u.name}",${u.code},${u.url},,,`).join('\n') + '\n'
);

console.log(`Built ${urls.length} guest page(s) → /invite/<code>/`);
console.log(`Base URL: ${baseUrl}`);
urls.forEach(u => console.log(`  ${u.name.padEnd(22)} ${u.url}`));
console.log(`\nWrote nfc-urls.txt and nfc-urls.csv for NFC programming.`);
