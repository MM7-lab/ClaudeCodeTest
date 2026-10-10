const run = require('./run.cjs');
run(async (p, logs) => {
  const t0 = Date.now();
  await run.ready(p);
  const info = await p.evaluate(() => ({ errors: __fig.R.errors, ms: __fig.sculpt && __fig.sculpt.ms, sipErr: __fig.keyFrames && __fig.keyFrames.sipErr }));
  console.log('ready in', (Date.now() - t0) / 1000, 's', JSON.stringify(info));
  await p.waitForTimeout(800);
  await run.shot(p, 'shot-main.png');
}).then(l => console.log(l.join('\n')));
