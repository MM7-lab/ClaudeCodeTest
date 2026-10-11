// CI only: look inside the phone app's WebView over Chrome DevTools (adb forward to port 9222)
// and print what the 3D scene is doing, plus a screenshot of the page as base64.
const list = await (await fetch('http://127.0.0.1:9222/json')).json();
console.log('TARGETS', JSON.stringify(list.map(t => ({ type: t.type, url: t.url }))));
const page = list.find(t => t.type === 'page' && t.url.includes('/desk/pet/'));
if (!page) { console.log('no scene page'); process.exit(0); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const waiting = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
await new Promise(r => { ws.onopen = r; });
const send = (method, params = {}) => new Promise(r => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result;
const diag = await ev(`(() => {
  const c = document.getElementById('scene');
  const d = window.__debug;
  return {
    bg: document.documentElement.style.background.slice(0, 90),
    computedBg: getComputedStyle(document.documentElement).backgroundColor,
    size: [innerWidth, innerHeight, devicePixelRatio],
    canvas: c ? [c.width, c.height, c.clientWidth, c.clientHeight, getComputedStyle(c).display, getComputedStyle(c).visibility, getComputedStyle(c).opacity] : null,
    api: typeof window.catApi, android: typeof window.AndroidCat, debug: !!d,
    main: d ? { mode: d.ai.mode, x: Math.round(d.ai.x), y: Math.round(d.ai.y), visible: d.cat.root.visible, scale: d.cat.root.scale.x } : null,
    problem: document.getElementById('phone-problem')?.textContent || null,
    bubble: document.getElementById('bubble')?.hidden,
    scripts: [...document.scripts].map(s => s.src.split('/').pop()),
    resources: performance.getEntriesByType('resource').map(r => r.name.split('/').pop() + ':' + (r.responseStatus ?? '?')).slice(0, 30),
  };
})()`);
console.log('DIAG', JSON.stringify(diag.result ? diag.result.value : diag, null, 1));
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 55 });
const b64 = shot.result ? shot.result.data : '';
console.log('===== page base64 begin =====');
for (let i = 0; i < b64.length; i += 900) console.log(b64.slice(i, i + 900));
console.log('===== page base64 end =====');
ws.close();
// fail the check if the scene can't be seen
const v = diag.result && diag.result.value;
if (!v || !v.canvas || v.canvas[3] < 100 || v.problem) { console.log('SCENE NOT VISIBLE'); process.exit(1); }
console.log('scene visible');
