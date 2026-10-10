const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGE = process.env.FIG_PAGE || 'index.html';
module.exports = async function run(steps, opts = {}) {
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, q.url === '/' ? PAGE : decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(d); });
  }).listen(opts.port || 8150);
  const b = await chromium.launch({ channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface'] });
  const p = await b.newPage({ viewport: opts.viewport || { width: 1000, height: 640 }, deviceScaleFactor: 1 });
  await p.addInitScript(() => { window.__FIG_OFFSCREEN = true; });
  const logs = [];
  p.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404')) logs.push(m.type() + ': ' + m.text().slice(0, 600)); });
  p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(`http://localhost:${opts.port || 8150}/`, { waitUntil: 'load' });
  try { await steps(p, logs); } catch (e) { logs.push('STEP FAIL: ' + e.message); }
  await b.close(); srv.close();
  return logs;
};
module.exports.ready = p => p.waitForFunction(() => window.__fig && (window.__fig.ready || (window.__fig.R && window.__fig.R.errors && window.__fig.R.errors.length)), null, { timeout: 300000, polling: 500 });
module.exports.shot = async (p, file) => { await p.evaluate(() => __fig.snapshot()); await p.screenshot({ path: file }); };
