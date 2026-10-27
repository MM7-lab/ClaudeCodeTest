'use strict';
// Prints the CSP hashes of the inline import map in index.html, for LF and for CRLF line endings
// (a Windows checkout may convert the file, and the browser hashes the bytes it gets).
// Run `node tools/csp-hash.js` after editing the import map and paste both into the
// Content-Security-Policy <meta> tag in index.html.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!match) throw new Error('No import map found in index.html');
const lf = match[1].replace(/\r\n/g, '\n');
const hash = (text) => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`;
console.log(`${hash(lf)} ${hash(lf.replace(/\n/g, '\r\n'))}`);
