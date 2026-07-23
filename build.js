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

function render(g) {
  return template
    .replace(/{{FIRST_NAME}}/g, esc(g.firstName || (g.name || '').split(' ')[0]))
    .replace(/{{FULL_NAME}}/g, esc(g.name || ''))
    .replace(/{{STATUS}}/g, esc(g.status || 'Confirmed'))
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

// ---- host check-in page (unguessable path, state kept in localStorage) ----
const sorted = [...data.guests].sort((a, b) => (a.seat || 99) - (b.seat || 99));
if (data.hostCode) {
  const hostDir = path.join(ROOT, 'host', data.hostCode);
  fs.rmSync(path.join(ROOT, 'host'), { recursive: true, force: true });
  fs.mkdirSync(hostDir, { recursive: true });
  const guestJs = JSON.stringify(sorted.map(g => ({ name: g.name, firstName: g.firstName, seat: g.seat || null })));
  fs.writeFileSync(path.join(hostDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#ECE8E0" />
<meta name="robots" content="noindex, nofollow" />
<title>Ladies Night · Host Check-In</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: 'Jost', sans-serif; background: #ECE8E0; color: #BC4B2B; min-height: 100svh; padding: 28px 18px 60px; }
  .wrap { max-width: 560px; margin: 0 auto; }
  .eyebrow { text-align: center; font-size: 11px; letter-spacing: .32em; text-transform: uppercase; color: #C96A47; }
  h1 { text-align: center; font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 40px; margin: 6px 0 2px; }
  .count { text-align: center; font-size: 13px; letter-spacing: .12em; color: #C96A47; margin: 10px 0 24px; }
  .count b { color: #BC4B2B; }
  .list { display: grid; gap: 12px; }
  .guest {
    display: flex; align-items: center; gap: 16px;
    background: #F3F0E9; border: 1px solid rgba(188,75,43,.25); border-radius: 14px;
    padding: 16px 18px; cursor: pointer; user-select: none; -webkit-user-select: none;
    transition: background .25s, border-color .25s, opacity .25s;
  }
  .guest .seatno {
    flex: 0 0 46px; height: 46px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid rgba(188,75,43,.5);
    font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 600;
    transition: background .25s, color .25s;
  }
  .guest .who { flex: 1; }
  .guest .who .nm { font-family: 'Cormorant Garamond', serif; font-size: 23px; font-weight: 500; line-height: 1.1; }
  .guest .who .st { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #C96A47; margin-top: 3px; }
  .guest .mark {
    flex: 0 0 30px; height: 30px; border-radius: 50%;
    border: 1.5px solid rgba(188,75,43,.4);
    display: flex; align-items: center; justify-content: center;
    color: transparent; transition: background .25s, color .25s, border-color .25s;
    font-size: 15px;
  }
  .guest.in { background: rgba(188,75,43,.10); border-color: rgba(188,75,43,.55); }
  .guest.in .seatno { background: #BC4B2B; color: #F3F0E9; border-color: #BC4B2B; }
  .guest.in .mark { background: #BC4B2B; border-color: #BC4B2B; color: #F3F0E9; }
  .guest.in .who .st { color: #BC4B2B; }
  .foot { text-align: center; margin-top: 30px; }
  .reset {
    font-family: 'Jost', sans-serif; font-size: 11px; letter-spacing: .26em; text-transform: uppercase;
    color: #C96A47; background: none; border: 1px solid rgba(188,75,43,.35);
    border-radius: 100px; padding: 10px 22px; cursor: pointer;
  }
  .note { margin-top: 16px; font-size: 12px; color: #C96A47; letter-spacing: .04em; }
</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">Host Check-In</p>
    <h1>Ladies Night</h1>
    <p class="count"><b id="n">0</b> of ${sorted.length} checked in</p>
    <div class="list" id="list"></div>
    <div class="foot">
      <button class="reset" id="reset">Reset all</button>
      <p class="note">Tap a guest as she arrives. Saved on this device — safe to refresh.</p>
    </div>
  </div>
  <script>
    var GUESTS = ${guestJs};
    var KEY = 'ln-checkin-v1';
    var state = {};
    try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    var list = document.getElementById('list');
    function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
    function draw() {
      list.innerHTML = '';
      var n = 0;
      GUESTS.forEach(function (g) {
        var on = !!state[g.name];
        if (on) n++;
        var el = document.createElement('div');
        el.className = 'guest' + (on ? ' in' : '');
        el.innerHTML =
          '<div class="seatno">' + (g.seat || '–') + '</div>' +
          '<div class="who"><div class="nm">' + g.name + '</div>' +
          '<div class="st">' + (on ? 'Checked in · Seat ' + g.seat : 'Not arrived') + '</div></div>' +
          '<div class="mark">✓</div>';
        el.onclick = function () { state[g.name] = !state[g.name]; save(); draw(); };
        list.appendChild(el);
      });
      document.getElementById('n').textContent = n;
    }
    document.getElementById('reset').onclick = function () {
      if (confirm('Clear all check-ins?')) { state = {}; save(); draw(); }
    };
    draw();
  <\/script>
</body>
</html>
`);
}

// ---- printables: folded name cards + triple tags ----
const printDir = path.join(ROOT, 'printables');
fs.mkdirSync(printDir, { recursive: true });

const PRINT_HEAD = `<meta charset="UTF-8" /><meta name="robots" content="noindex, nofollow" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />`;

// name cards: 4in × 4in, fold in half to a 4×2 tent. Top panel is printed
// upside-down so it reads correctly from the other side once folded.
const cardsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${PRINT_HEAD}
<title>Ladies Night · Place Cards (print)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Jost', sans-serif; background: #d8d4cc; color: #BC4B2B; }
  .page { width: 8.5in; height: 11in; margin: 0 auto; background: #fff; display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: .15in; padding: .25in; }
  .card { width: 3.9in; height: 3.9in; border: 1px solid #e0c9bd; position: relative; background: #F3F0E9; }
  .half { height: 1.95in; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .12in; overflow: hidden; }
  .half.top { transform: rotate(180deg); border-bottom: 1px dashed rgba(188,75,43,.5); }
  .nm { font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 34px; line-height: 1; text-align: center; padding: 0 .2in; }
  .seat-label { font-size: 9px; letter-spacing: .3em; text-transform: uppercase; color: #C96A47; }
  .seatnum { font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 64px; line-height: .9; }
  .mini { font-size: 9px; letter-spacing: .3em; text-transform: uppercase; color: #C96A47; }
  .flourish { color: #C96A47; font-family: 'Cormorant Garamond', serif; font-size: 16px; letter-spacing: .2em; }
  @media print {
    body { background: #fff; }
    .page { page-break-after: always; }
    @page { size: letter; margin: 0; }
  }
</style>
</head>
<body>
${chunk(sorted, 4).map(group => `<div class="page">
${group.map(g => `  <div class="card">
    <div class="half top">
      <div class="seat-label">Seat</div>
      <div class="seatnum">${g.seat || ''}</div>
    </div>
    <div class="half">
      <div class="mini">Ladies Night</div>
      <div class="nm">${esc(g.name)}</div>
      <div class="flourish">❧</div>
    </div>
  </div>`).join('\n')}
</div>`).join('\n')}
</body>
</html>
`;
fs.writeFileSync(path.join(printDir, 'name-cards.html'), cardsHtml);

// tags: each guest ×3 (valet key, bag, coat) with a hole-punch guide
const tagsList = sorted.flatMap(g => [g, g, g]);
const tagsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${PRINT_HEAD}
<title>Ladies Night · Item Tags (print)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Jost', sans-serif; background: #d8d4cc; color: #BC4B2B; }
  .page { width: 8.5in; height: 11in; margin: 0 auto; background: #fff; display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: .18in; padding: .4in; }
  .tag { width: 3.4in; height: 1.35in; border: 1px solid #e0c9bd; background: #F3F0E9; display: flex; align-items: center; gap: .18in; padding: 0 .22in; }
  .hole { flex: 0 0 .22in; height: .22in; border-radius: 50%; border: 1px dashed rgba(188,75,43,.6); }
  .body { flex: 1; }
  .nm { font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 22px; line-height: 1.05; }
  .mini { font-size: 8px; letter-spacing: .28em; text-transform: uppercase; color: #C96A47; margin-top: 4px; }
  @media print {
    body { background: #fff; }
    .page { page-break-after: always; }
    @page { size: letter; margin: 0; }
  }
</style>
</head>
<body>
${chunk(tagsList, 12).map(group => `<div class="page">
${group.map(g => `  <div class="tag"><div class="hole"></div><div class="body"><div class="nm">${esc(g.name)}</div><div class="mini">Ladies Night · Seat ${g.seat || ''}</div></div></div>`).join('\n')}
</div>`).join('\n')}
</body>
</html>
`;
fs.writeFileSync(path.join(printDir, 'tags.html'), tagsHtml);

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

console.log(`Built ${urls.length} guest page(s) → /invite/<code>/`);
if (data.hostCode) console.log(`Host check-in page → /host/${data.hostCode}/`);
console.log(`Printables → /printables/name-cards.html, /printables/tags.html, /printables/menu.html`);
console.log(`Base URL: ${baseUrl}`);
urls.forEach(u => console.log(`  ${u.name.padEnd(22)} ${u.url}`));
console.log(`\nWrote nfc-urls.txt and nfc-urls.csv for NFC programming.`);
