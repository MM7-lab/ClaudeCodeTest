const run = require('./run.cjs');
run(async (p, logs) => {
  await run.ready(p);
  const state = () => p.evaluate(() => { const b = __fig.body; const up = quat.rotate(b.q, [0, 1, 0]); return { x: b.x.map(v => +v.toFixed(3)), v: +v3.len(b.v).toFixed(3), w: +v3.len(b.w).toFixed(3), asleep: b.asleep, upY: +up[1].toFixed(3), minY: +Math.min(...b.points.map(q => b.toWorld(q)[1])).toFixed(3) }; });
  // Fixed mode: try to move it
  const f0 = await state();
  await p.evaluate(() => { dropFigure(); __fig.body.v = [300, 200, 0]; __fig.body.w = [5, 5, 5]; });
  await p.waitForTimeout(1500);
  const f1 = await state();
  console.log('fixed before', JSON.stringify(f0.x), 'after', JSON.stringify(f1.x), 'unchanged:', JSON.stringify(f0.x) === JSON.stringify(f1.x));
  // Free: drop
  await p.evaluate(() => setFixed(false));
  await p.waitForTimeout(300);
  await p.evaluate(() => dropFigure());
  const t0 = Date.now(); let s;
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); s = await state(); if (s.asleep) break; }
  console.log('drop: rest after', (Date.now() - t0) / 1000, 's', JSON.stringify(s));
  await p.evaluate(() => { __fig.camLock = [__fig.body.x[0], 3, __fig.body.x[2]]; __fig.cam.dist = 34; __fig.cam.pitch = 0.35; });
  await run.shot(p, 'p-drop.png');
  // Throws with random spin, several times
  for (let k = 0; k < 4; k++) {
    await p.evaluate(k => { const b = __fig.body; b.wake(); b.v = [(k % 2 ? 1 : -1) * 160, 220 + k * 40, 90 - k * 60]; b.w = [6 - k * 3, 4, -5 + k * 2]; }, k);
    const t1 = Date.now();
    for (let i = 0; i < 60; i++) { await p.waitForTimeout(250); s = await state(); if (s.asleep) break; }
    console.log('throw', k, 'rest after', (Date.now() - t1) / 1000, 's', JSON.stringify(s));
  }
  await p.evaluate(() => { __fig.camLock = [__fig.body.x[0], 3, __fig.body.x[2]]; });
  await run.shot(p, 'p-throw.png');
  // Reset stands it up
  await p.evaluate(() => { __fig.camLock = null; document.getElementById('resetBtn').click(); });
  await p.waitForTimeout(400); console.log('after reset', JSON.stringify(await state()));
  console.log(JSON.stringify(await p.evaluate(() => __fig.R.errors)));
}).then(l => console.log(l.join('\n')));
