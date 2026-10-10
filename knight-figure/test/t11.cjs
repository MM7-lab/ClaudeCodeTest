const run = require('./run.cjs');
const path = require('path');
const out = f => path.join(__dirname, f);
(async () => {
  let l = await run(async (p, logs) => {
    await run.ready(p);
    await p.waitForTimeout(600);
    await run.shot(p, out('ph-main.png'));
    await p.click('#edB'); await p.waitForTimeout(800);
    await run.shot(p, out('ph-tea.png'));
    const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
      btns: [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [b.id, Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.height)]; }) }));
    console.log(JSON.stringify(ov));
  }, { viewport: { width: 390, height: 844 } });
  console.log(l.join('\n') || 'phone: no console errors');
  l = await run(async (p, logs) => {
    await run.ready(p);
    await p.click('#edB'); await p.waitForTimeout(600);
    await p.evaluate(() => { __fig.cam.yaw = 0.55; __fig.camLock = [-0.5, 6.5, 3]; __fig.cam.dist = 16; });
    await p.waitForTimeout(1200);
    await run.shot(p, out('v-tea2.png'));
    // pose: drive the arm to its upper limit through the clamp
    await p.click('#edA'); await p.click('#poseBtn');
    await p.evaluate(() => { __fig.camLock = null; __fig.cam.yaw = 0.35; __fig.cam.dist = 34; const a = { p: -3, y: 0.3, r: 0 }; clampJoint(a, ARM_LIM); __fig.arm = a; });
    await p.waitForTimeout(800);
    console.log('arm', JSON.stringify(await p.evaluate(() => __fig.arm)));
    await run.shot(p, out('i-pose2.png'));
  });
  console.log(l.join('\n') || 'desktop: no console errors');
})();
