const run = require('./run.cjs');
const which = process.argv[2] || 'views';
run(async (p, logs) => {
  await run.ready(p);
  const cam = (yaw, pitch, dist, ty) => p.evaluate(([yaw, pitch, dist, ty]) => { const c = __fig.cam; c.yaw = yaw; c.pitch = pitch; c.dist = dist; c.ty0 = ty; c.target = [0, ty, 0]; }, [yaw, pitch, dist, ty]);
  const pose = (ed, t) => p.evaluate(([ed, t]) => { setEdition(ed); __fig.action.on = false; applyPose(samplePose(actionTimeline().keys, t)); }, [ed, t]);
  if (which === 'views') {
    await cam(0.15, 0.08, 17, 9.0); await p.waitForTimeout(300); await run.shot(p, 'v-face.png');
    await p.evaluate(() => setEdition('B')); await cam(0.5, 0.2, 40, 6.4); await p.waitForTimeout(300); await run.shot(p, 'v-tea.png');
    await cam(2.6, 0.25, 40, 6.4); await p.waitForTimeout(300); await run.shot(p, 'v-back.png');
  }
  if (which === 'actions') {
    await cam(0.35, 0.15, 40, 7.2);
    for (const [ed, t, f] of [['A', 0.9, 'a-salute.png'], ['A', 1.65, 'a-nod.png'], ['B', 1.1, 'b-sip.png'], ['B', 3.6, 'b-sigh.png']]) { await pose(ed, t); await p.waitForTimeout(200); await run.shot(p, f); }
    await p.evaluate(() => { spawnPuff(); for (const pf of __fig.puffs) pf.age = 0.9; }); await run.shot(p, 'b-puff1.png');
    await p.evaluate(() => { for (const pf of __fig.puffs) { pf.age = 2.0; pf.p = v3.madd(pf.p, pf.v, 1.1); } }); await run.shot(p, 'b-puff2.png');
  }
  console.log(JSON.stringify(await p.evaluate(() => __fig.R.errors)));
}).then(l => console.log(l.join('\n')));
