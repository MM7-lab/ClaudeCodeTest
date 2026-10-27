// CI diagnostics: connects to a running app started with --remote-debugging-port=9222, reloads
// the page while listening, and prints console messages, log entries (CSP, network) and page state.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = [];
for (let i = 0; i < 30 && !targets.some((t) => t.type === 'page'); i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  } catch {}
  await sleep(1000);
}
const page = targets.find((t) => t.type === 'page');
if (!page) {
  console.log('no page target', JSON.stringify(targets));
  process.exit(0);
}
console.log('page', page.url);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) return pending.get(d.id)(d);
  if (d.method === 'Runtime.consoleAPICalled') console.log('console.' + d.params.type, d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION', JSON.stringify(d.params.exceptionDetails).slice(0, 1500));
  if (d.method === 'Log.entryAdded') console.log('LOG', d.params.entry.level, d.params.entry.source, d.params.entry.text, d.params.entry.url ?? '');
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await sleep(10000);
const r = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `JSON.stringify({ href: location.href, api: typeof window.diorama, apiKeys: window.diorama ? Object.keys(window.diorama) : null, canvas: !!document.querySelector('canvas'), scripts: [...document.scripts].map((s) => s.type + ':' + (s.src || 'inline')), webgl: (() => { try { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return g ? g.getParameter(g.VERSION) : 'none'; } catch (e) { return 'error ' + e; } })() })`,
});
console.log('STATE', r.result?.result?.value ?? JSON.stringify(r));
ws.close();
