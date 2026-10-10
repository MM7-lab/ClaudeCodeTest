const run = require('./run.cjs');
run(async (p, logs) => {
  await run.ready(p);
  // project a figure-local point to page pixels
  const toScreen = pt => p.evaluate(pt => {
    const M = partMatrices(); const w = m4.point(M.root, pt); const c = cameraMatrices();
    const ndc = m4.point(c.vp, w); const r = document.getElementById('gfx').getBoundingClientRect();
    return [r.left + (ndc[0] * 0.5 + 0.5) * r.width, r.top + (0.5 - ndc[1] * 0.5) * r.height];
  }, pt);
  const drag = async (from, dx, dy, steps = 10) => {
    await p.mouse.move(from[0], from[1]); await p.mouse.down();
    await p.waitForTimeout(400);
    for (let i = 1; i <= steps; i++) { await p.mouse.move(from[0] + dx * i / steps, from[1] + dy * i / steps); await p.waitForTimeout(30); }
    await p.mouse.up();
  };
  // Pose mode
  await p.click('#poseBtn');
  const head0 = await p.evaluate(() => ({ ...__fig.head }));
  await drag(await toScreen([0.8, 10.2, 2.4]), 160, 60);
  const head1 = await p.evaluate(() => ({ ...__fig.head }));
  console.log('head pose', JSON.stringify(head0), '->', JSON.stringify(head1));
  const arm0 = await p.evaluate(() => ({ ...__fig.arm }));
  await drag(await toScreen([-2.3, 4.6, 1.2]), 0, -300);
  const arm1 = await p.evaluate(() => ({ ...__fig.arm }));
  console.log('arm pose', JSON.stringify(arm0), '->', JSON.stringify(arm1), 'pitch limit', (await p.evaluate(() => ARM_LIM.p[0])).toFixed(3));
  await run.shot(p, 'i-pose.png');
  await p.click('#poseBtn');
  // Orbit in fixed mode: dragging the figure orbits, never moves it
  const yaw0 = await p.evaluate(() => __fig.cam.yaw), x0 = await p.evaluate(() => __fig.body.x.slice());
  await drag(await toScreen([0, 5, 1.5]), 120, 0);
  console.log('fixed drag: cam yaw', yaw0.toFixed(3), '->', (await p.evaluate(() => __fig.cam.yaw)).toFixed(3), 'figure moved:', JSON.stringify(x0) !== JSON.stringify(await p.evaluate(() => __fig.body.x.slice())));
  // Grab and throw in free mode
  await p.click('#fixedBtn'); await p.waitForTimeout(300);
  const g = await toScreen([0, 5.5, 1.8]);
  await p.mouse.move(g[0], g[1]); await p.mouse.down(); await p.waitForTimeout(500);
  const grabbed = await p.evaluate(() => !!__fig.body.grab);
  for (let i = 1; i <= 8; i++) { await p.mouse.move(g[0] + i * 4, g[1] - i * 22); await p.waitForTimeout(40); }
  const lifted = await p.evaluate(() => __fig.body.x[1]);
  for (let i = 1; i <= 4; i++) { await p.mouse.move(g[0] + 32 + i * 60, g[1] - 176 - i * 10); await p.waitForTimeout(16); }
  await p.mouse.up();
  const vRel = await p.evaluate(() => v3.len(__fig.body.v));
  let s; for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); s = await p.evaluate(() => ({ asleep: __fig.body.asleep, x: __fig.body.x.map(v => +v.toFixed(2)) })); if (s.asleep) break; }
  console.log('grab:', grabbed, 'lifted COM y', lifted.toFixed(2), 'release speed', vRel.toFixed(1), 'cm/s, rests:', JSON.stringify(s));
  console.log(JSON.stringify(await p.evaluate(() => __fig.R.errors)));
}).then(l => console.log(l.join('\n')));
