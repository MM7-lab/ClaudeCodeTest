const run = require('./run.cjs');
const path = require('path');
const M = f => path.join(__dirname, 'models', f);
run(async (p, logs) => {
  await run.ready(p);
  const state = () => p.evaluate(() => ({
    mode: __fig.mode, name: document.getElementById('figName').textContent,
    toast: document.getElementById('toast').hidden ? null : document.getElementById('toastText').textContent,
    model: __fig.model ? { h: +__fig.model.height.toFixed(2), baseR: +__fig.model.baseR.toFixed(2), parts: __fig.model.gpu.length, tex: __fig.model.gpu.map(g => g.hasTex), tint: __fig.model.gpu.map(g => g.useTint) } : null,
    paintHidden: document.getElementById('paintWrap').hidden, errs: (__fig.R.errors || []).slice(0, 3),
    x: __fig.body.x.map(v => +v.toFixed(3)),
  }));
  const load = async (files, tag) => {
    const t0 = Date.now();
    await p.setInputFiles('#fileInput', files.map(M));
    await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 120000, polling: 200 });
    await p.waitForTimeout(800);
    const s = await state();
    console.log(tag, Date.now() - t0, 'ms', JSON.stringify(s));
    await run.shot(p, path.join(__dirname, 'm-' + tag + '.png'));
    return s;
  };
  await load(['draco.glb'], 'draco');
  await load(['needsbin.gltf'], 'needsbin');
  await load(['rocket.glb'], 'rocket');
  // Fixed mode: drop is disabled and figure does not move
  await p.click('#dropBtn', { force: true }).catch(() => {});
  await p.waitForTimeout(600);
  console.log('after drop (fixed)', JSON.stringify((await state()).x));
  // finishes
  await p.click('#fMatte'); await p.waitForTimeout(300); await run.shot(p, path.join(__dirname, 'm-rocket-matte.png'));
  await p.click('#fGloss');
  await load(['shroom.obj', 'shroom.mtl', 'spots.png'], 'shroom');
  await load(['rook_zup.stl'], 'rook');
  // paint picker on untextured
  await p.evaluate(() => { const i = document.getElementById('paint'); i.value = '#3a7bd5'; i.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(300); await run.shot(p, path.join(__dirname, 'm-rook-paint.png'));
  // turn / stand up
  await p.click('#turnBtn'); await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 60000 });
  console.log('turned', JSON.stringify(await state()));
  await p.click('#standBtn'); await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 60000 });
  await p.waitForTimeout(500);
  console.log('stood', JSON.stringify(await state()));
  await run.shot(p, path.join(__dirname, 'm-rook-stand.png'));
  // physics with model: unfix, drop
  await p.click('#fixedBtn'); await p.waitForTimeout(200);
  await p.click('#dropBtn'); await p.waitForTimeout(4500);
  console.log('dropped', JSON.stringify(await p.evaluate(() => ({ asleep: __fig.body.asleep, x: __fig.body.x, up: quat.rotate(__fig.body.q, [0, 1, 0]) }))));
  await run.shot(p, path.join(__dirname, 'm-rook-drop.png'));
  await p.click('#fixedBtn'); await p.waitForTimeout(1500);
  await p.click('#spinBtn'); await p.waitForTimeout(1000);
  await p.click('#spinBtn');
  await p.click('#backBtn'); await p.waitForTimeout(1200);
  console.log('back', JSON.stringify(await state()));
  await run.shot(p, path.join(__dirname, 'm-back.png'));
}).then(l => console.log(l.join('\n') || 'no console errors'));
