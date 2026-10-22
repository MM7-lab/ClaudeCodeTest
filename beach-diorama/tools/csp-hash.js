'use strict';
// Prints the CSP hash of the inline import map in index.html.
// Run `node tools/csp-hash.js` after editing the import map and paste the result into the
// Content-Security-Policy <meta> tag in index.html.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!match) throw new Error('No import map found in index.html');
const hash = crypto.createHash('sha256').update(match[1]).digest('base64');
console.log(`'sha256-${hash}'`);
