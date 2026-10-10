const run = require('./run.cjs');
run(async (p, logs) => {
  await run.ready(p);
  const cam = (yaw, pitch, dist, t) => p.evaluate(([yaw, pitch, dist, t]) => { const c = __fig.cam; c.yaw = yaw; c.pitch = pitch; c.dist = dist; c.ty0 = t[1]; c.target = t; __fig.camLock = t; }, [yaw, pitch, dist, t]);
  await cam(0.1, 0.05, 5, [-1.7, 9.5, 3.8]); await p.waitForTimeout(300); await run.shot(p, 'z-blade.png');
  await cam(0.1, 0.05, 4.5, [1.2, 9.3, 2.6]); await p.waitForTimeout(300); await run.shot(p, 'z-eye.png');
}).then(l => console.log(l.join('\n')));
