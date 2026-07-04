#!/usr/bin/env node
/*
 * Generate unguessable guest codes (5 chars, no ambiguous 0/o/1/l/i).
 *   node scripts/new-code.js        → one code
 *   node scripts/new-code.js 10     → ten codes
 * Codes are checked against existing guests.json so they never collide.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0,o,1,l,i for readability
const LEN = 5;
const n = Math.max(1, parseInt(process.argv[2] || '1', 10));

let taken = new Set();
try {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'guests.json'), 'utf8'));
  taken = new Set((data.guests || []).map(g => g.code));
} catch (_) {}

function make() {
  let c;
  do {
    c = Array.from(crypto.randomBytes(LEN)).map(b => ALPHABET[b % ALPHABET.length]).join('');
  } while (taken.has(c));
  taken.add(c);
  return c;
}

for (let i = 0; i < n; i++) console.log(make());
