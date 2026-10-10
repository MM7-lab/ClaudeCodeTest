const run = require('./run.cjs');
const path = require('path');
run(async (p, logs) => {
  await run.ready(p);
  const info = await p.evaluate(() => {
    const P = __fig.probes, t0 = performance.now();
    for (let i = 0; i < 20; i++) posePenetrates();
    return { arm: P.arm.length, A: P.A.length, B: P.B.length, msPerTest: (performance.now() - t0) / 20, restHit: posePenetrates() };
  });
  console.log('probes', JSON.stringify(info));
  // sweep the arm through its whole range: how much of it is reachable, and does the clamp+collision stop it?
  const sweep = await p.evaluate(() => {
    const res = {};
    for (const ed of ['A', 'B']) {
      __fig.edition = ed; let ok = 0, n = 0;
      for (let pp = ARM_LIM.p[0]; pp <= ARM_LIM.p[1] + 1e-6; pp += 5 * DEG) for (let yy = ARM_LIM.y[0]; yy <= ARM_LIM.y[1] + 1e-6; yy += 5 * DEG) {
        __fig.arm = { p: pp, y: yy, r: 0 }; __fig.wrist = autoWrist(); n++; if (!posePenetrates()) ok++;
      }
      res[ed] = ok + '/' + n;
    }
    __fig.edition = 'A'; __fig.arm = { p: 0, y: 0, r: 0 }; __fig.wrist = quat.ident();
    return res;
  });
  console.log('free poses', JSON.stringify(sweep));
  // drag the arm up hard with the mouse in Pose mode, then sideways
  const toScreen = (pt, k = 'root') => p.evaluate(([pt, k]) => { const M = partMatrices(); const w = m4.point(M[k], pt); const c = cameraMatrices();
    const ndc = m4.point(c.vp, w); const r = document.getElementById('gfx').getBoundingClientRect();
    return [r.left + (ndc[0] * 0.5 + 0.5) * r.width, r.top + (0.5 - ndc[1] * 0.5) * r.height]; }, [pt, k]);
  const drag = async (from, dx, dy, steps = 24) => {
    await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.waitForTimeout(400);
    for (let i = 1; i <= steps; i++) { await p.mouse.move(from[0] + dx * i / steps, from[1] + dy * i / steps); await p.waitForTimeout(25); }
    await p.mouse.up();
  };
  await p.click('#poseBtn');
  await drag(await toScreen([-1.6, 4.4, 3.4]), 0, -400);
  console.log('after up-drag', JSON.stringify(await p.evaluate(() => ({ arm: __fig.arm, hit: posePenetrates() }))));
  await p.waitForTimeout(500); await run.shot(p, path.join(__dirname, 'i-pose4.png'));
  await p.evaluate(() => { __fig.cam.yaw = -1.3; }); await p.waitForTimeout(800); await run.shot(p, path.join(__dirname, 'i-pose5.png'));
  await p.evaluate(() => { __fig.cam.yaw = 0.42; }); await p.waitForTimeout(600);
  await drag(await toScreen([-1.05, 4.6, 3.75], 'arm'), 400, 200);
  console.log('after side-drag', JSON.stringify(await p.evaluate(() => ({ arm: __fig.arm, hit: posePenetrates() }))));
  await p.waitForTimeout(500); await run.shot(p, path.join(__dirname, 'i-pose6.png'));
  // tea edition: raise the cup
  await p.click('#edB'); if (!(await p.evaluate(() => __fig.pose))) await p.click('#poseBtn');
  await drag(await toScreen([-0.05, 4.72, 3.9], 'arm'), 0, -400);
  console.log('tea up-drag', JSON.stringify(await p.evaluate(() => ({ arm: __fig.arm, pose: __fig.pose, hit: posePenetrates() }))));
  await p.waitForTimeout(500); await run.shot(p, path.join(__dirname, 'i-pose7.png'));
}).then(l => console.log(l.join('\n') || 'no console errors'));
