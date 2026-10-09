/* 小貓騎士 3D 模型：長毛虎斑貓、頭頂細粉紅蝴蝶結、銀色鎧甲、白披風，雙手將長劍垂直豎喺面前。
   用法（瀏覽器）：buildKnightKitten(THREE, { fur: 'tabby' })
   用法（Node）  ：require('./model.js')(THREE, { forPrint: true })   // 唔包鬚同披風
   單位：1 = 約 1 cm；面向 +Z，Y 向上。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.buildKnightKitten = factory;
})(typeof self !== 'undefined' ? self : this, function buildKnightKitten(THREE, opts) {
  opts = opts || {};

  const FURS = {
    tabby:  { base: 0xa8927b, dark: 0x6b5a4b, light: 0xe4d8c6 },
    orange: { base: 0xe2a062, dark: 0xb06a32, light: 0xf8e6cf },
    grey:   { base: 0xa9adb6, dark: 0x656a75, light: 0xe6e8ec },
    black:  { base: 0x3a3840, dark: 0x1e1d23, light: 0xf2efe9 },
  };
  const fur = FURS[opts.fur] || FURS.tabby;

  const std = (color, roughness, metalness) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: metalness || 0 });
  // 打磨過嘅金屬：全金屬 + 一層薄清漆，反光會有兩重高光
  const metal = (color, roughness, coat) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 1, clearcoat: coat || 0, clearcoatRoughness: 0.08 });
  const M = {
    fur:       std(fur.base, 0.95),
    furDark:   std(fur.dark, 0.95),
    furLight:  std(fur.light, 0.95),
    whisker:   std(0xf6f2ea, 0.8),
    pink:      std(0xf2a7bd, 0.55),
    pinkSoft:  std(0xd9a3a0, 0.75),
    nose:      std(0xc4837d, 0.45),
    eye:       std(0x0b0a0c, 0.2),
    iris:      std(0x4a3520, 0.35),
    cornea:    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0 }),
    shine:     new THREE.MeshBasicMaterial({ color: 0xffffff }),
    steel:     metal(0xd6d9de, 0.14, 0.35),
    steelDark: metal(0xa3a8b0, 0.26, 0.2),
    mail:      metal(0x8d939b, 0.42),
    blade:     metal(0xc3c7cc, 0.1, 0.5),
    brass:     metal(0xc9a05a, 0.22, 0.3),
    leather:   std(0x5e3a22, 0.8),
    cape:      new THREE.MeshPhysicalMaterial({ color: 0xeee8dc, roughness: 0.82, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }),
  };

  const root = new THREE.Group();
  root.name = 'KnightKitten';
  const Y = new THREE.Vector3(0, 1, 0);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function mesh(geo, mat, parent, pos, rot, scale, name) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (name) m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || root).add(m);
    return m;
  }
  const sphere = (r, w, h) => new THREE.SphereGeometry(r, w || 32, h || 24);
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), segs || 96);

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const Z = new THREE.Vector3(0, 0, 1);

  // 有機管：沿曲線走，粗幼跟住長度順滑變化（手臂、腳、尾）。
  // 法線按粗幼變化嘅斜度修正，所以光暗連貫，唔會似一節節水喉。
  function organicTube(pts, radii, mat, parent, o) {
    o = o || {};
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const segs = o.segs || 40, radial = o.radial || 32;
    const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
    const rAt = t => {
      const f = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f)), k = f - i;
      return radii[i] + (radii[i + 1] - radii[i]) * k * k * (3 - 2 * k);
    };
    const pos = geo.attributes.position, nor = geo.attributes.normal, L = curve.getLength();
    const c = new THREE.Vector3(), T = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, t0 = Math.max(0, t - 0.002), t1 = Math.min(1, t + 0.002);
      curve.getPointAt(t, c);
      curve.getTangentAt(t, T);
      const r = rAt(t), slope = (rAt(t1) - rAt(t0)) / ((t1 - t0) * L);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        d.fromBufferAttribute(pos, k).sub(c);
        pos.setXYZ(k, c.x + d.x * r, c.y + d.y * r, c.z + d.z * r);
        n.copy(d).addScaledVector(T, -slope).normalize();
        nor.setXYZ(k, n.x, n.y, n.z);
      }
    }
    const m = mesh(geo, mat, parent, null, null, null, o.name);
    const cap = (t, r) => { const p = curve.getPointAt(t); mesh(sphere(r, 32, 24), mat, parent, [p.x, p.y, p.z]); };
    if (o.capStart) cap(0, radii[0]);
    if (o.capEnd) cap(1, radii[radii.length - 1]);
    return { mesh: m, curve };
  }

  // 一節甲片：由 a 到 b 嘅短錐筒，下緣闊少少再加卷邊，疊埋一齊似真盔甲咁一片壓一片
  function lame(a, b, r0, r1, mat, parent, roll) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mesh(new THREE.CylinderGeometry(r1, r0, dir.length(), 48, 1, false), mat, parent);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
    if (roll !== false) {
      const t = mesh(new THREE.TorusGeometry(r1 - 0.004, 0.016, 10, 48), M.steel, parent, [b.x, b.y, b.z]);
      t.quaternion.setFromUnitVectors(Z, dir.clone().normalize());
    }
    return m;
  }

  // 護翼（手肘、膝頭外側）：水滴形薄甲片，中間一條凸脊，尖位指向關節
  function wing(at, facing, r, parent, pointTo) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -r * 1.25);
    shape.bezierCurveTo(r * 0.55, -r * 0.7, r * 1.05, -r * 0.1, r * 0.95, r * 0.35);
    shape.bezierCurveTo(r * 0.8, r * 0.95, -r * 0.8, r * 0.95, -r * 0.95, r * 0.35);
    shape.bezierCurveTo(-r * 1.05, -r * 0.1, -r * 0.55, -r * 0.7, 0, -r * 1.25);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 });
    g.translate(0, 0, -0.006);
    const m = mesh(g, M.steel, parent, [at.x, at.y, at.z], null, null, 'Wing');
    // 法線向外，尖位指向關節
    const f = facing.clone().normalize();
    const yAxis = pointTo.clone().sub(at).multiplyScalar(-1);
    yAxis.addScaledVector(f, -yAxis.dot(f)).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, f);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, f));
    const ridge = mesh(new THREE.CapsuleGeometry(0.012, r * 1.3, 4, 8), M.steel, parent);
    ridge.position.copy(at).addScaledVector(f, 0.012);
    ridge.quaternion.copy(m.quaternion);
  }

  /* ---------- 身體：胸甲、皮帶、鎖子甲裙 ---------- */
  const body = new THREE.Group();
  body.name = 'Armor';
  root.add(body);
  mesh(lathe([[0, 0.95], [0.82, 1.0], [0.95, 1.25], [0.97, 1.6], [0.88, 1.95],
              [0.66, 2.25], [0.36, 2.42], [0, 2.44]]), M.steel, body, null, null, [1, 1, 0.88], 'Cuirass');
  mesh(new THREE.BoxGeometry(0.05, 1.05, 0.06), M.steelDark, body, [0, 1.62, 0.84], [-0.1, 0, 0]);
  mesh(new THREE.TorusGeometry(0.83, 0.035, 12, 96), M.steel, body, [0, 1.0, 0], [Math.PI / 2, 0, 0], [1, 0.88, 1], 'CuirassRoll');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    mesh(sphere(0.035, 12, 8), M.brass, body, [Math.sin(a) * 0.9, 1.2, Math.cos(a) * 0.9 * 0.88]);
  }
  mesh(new THREE.TorusGeometry(0.56, 0.09, 20, 96), M.steel, body, [0, 2.36, 0.02], [Math.PI / 2, 0, 0], [1, 0.9, 1], 'Gorget');
  // 頸位一圈連續嘅淺色毛領（之前係一粒粒波，睇落唔自然）
  mesh(new THREE.TorusGeometry(0.5, 0.17, 24, 72), M.furLight, body, [0, 2.47, 0.04], [Math.PI / 2, 0, 0], [1, 0.88, 0.75], 'Ruff');

  // 鎖子甲裙 + 前面兩塊腿甲
  mesh(lathe([[0, 0.42], [0.98, 0.42], [1.05, 0.62], [0.96, 1.05], [0, 1.05]]), M.mail, body, null, null, [1, 1, 0.9], 'Chainmail');
  // 腿甲：彎曲甲片順住裙身弧度，有厚度、上緣卷邊、四粒鉚釘
  for (const s of [-1, 1]) {
    const mid = Math.PI / 2 - 0.4 * s, half = 0.27, R = 1.1;
    const sector = new THREE.Shape();
    sector.absarc(0, 0, R + 0.04, mid - half, mid + half, false);
    sector.absarc(0, 0, R, mid + half, mid - half, true);
    const tg = new THREE.ExtrudeGeometry(sector, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 32 });
    tg.rotateX(Math.PI / 2);
    const tasset = mesh(tg, M.steel, body, [0, 1.02, 0], null, [1, 1, 0.9], 'Tasset');
    const rimGeo = new THREE.TorusGeometry(R + 0.045, 0.018, 8, 32, half * 2);
    rimGeo.rotateZ(mid - half);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.scale(1, 1, 0.9);   // 同裙身一樣前後扁少少
    mesh(rimGeo, M.steel, body, [0, 1.0, 0]);
    for (const da of [-0.2, 0.2]) {
      for (const y of [0.93, 0.56]) {
        const a = mid + da;
        mesh(sphere(0.028, 10, 8), M.brass, body, [Math.cos(a) * (R + 0.05), y, Math.sin(a) * (R + 0.05) * 0.9]);
      }
    }
  }
  // 腰帶、斜孭皮帶、圓形銅扣
  mesh(new THREE.TorusGeometry(0.97, 0.06, 10, 64), M.leather, body, [0, 1.08, 0], [Math.PI / 2, 0, 0], [1, 0.92, 1.4], 'Belt');
  mesh(new THREE.TorusGeometry(1.0, 0.055, 10, 64), M.leather, body, [0, 1.25, 0.02], [Math.PI / 2, -0.42, 0], [1, 0.92, 1.3], 'Baldric');
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 28), M.brass, body, [-0.5, 1.12, 0.78], [Math.PI / 2 - 0.15, 0, 0.5], null, 'Buckle');

  // 肩甲（三層）
  for (const s of [-1, 1]) {
    const lames = [[0.46, 0.82, 2.24, 0.38, 0.6, M.steel], [0.4, 0.9, 2.06, 0.42, 0.5, M.steel], [0.33, 0.96, 1.9, 0.46, 0.45, M.steelDark]];
    lames.forEach(([r, x, y, tilt, sy, mat], i) => {
      const lame = new THREE.Group();
      lame.position.set(x * s, y, 0.02);
      lame.rotation.set(0, 0, -tilt * s);
      body.add(lame);
      mesh(sphere(r, 64, 40), mat, lame, null, null, [1, sy, 1], i === 0 ? 'Pauldron' : null);
      mesh(new THREE.TorusGeometry(r * 0.97, 0.03, 10, 64), M.steel, lame, [0, -0.02, 0], [Math.PI / 2, 0, 0]);   // 卷邊
      if (i === 0) {
        for (let k = 0; k < 3; k++) {
          const a = -0.6 + k * 0.6;
          mesh(sphere(0.04, 12, 8), M.brass, lame, [Math.sin(a) * r * 0.82, 0.12, Math.cos(a) * r * 0.82]);
        }
      }
    });
  }

  // 腳：毛毛大髀 → 有護翼嘅膝甲 → 錐形脛甲 → 一片疊一片嘅鐵靴
  for (const s of [-1, 1]) {
    const hip = V(0.42 * s, 0.82, 0.0), knee = V(0.43 * s, 0.46, 0.16), ankle = V(0.42 * s, 0.2, 0.14);
    organicTube([hip, V(0.44 * s, 0.64, 0.09), knee], [0.27, 0.27, 0.22], M.fur, body, { name: 'Thigh' });
    organicTube([knee.clone().add(V(0, 0.02, -0.02)), V(0.42 * s, 0.32, 0.15), ankle], [0.19, 0.17, 0.18], M.steel, body, { name: 'Greave' });
    const t1 = mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 48), M.steel, body, [ankle.x, ankle.y + 0.01, ankle.z], [Math.PI / 2, 0, 0]);
    // 膝甲：向前嘅杯形 + 外側扇翼
    mesh(sphere(0.2, 48, 32), M.steel, body, [knee.x, knee.y, knee.z + 0.08], null, [1, 0.95, 0.62], 'Poleyn');
    mesh(new THREE.TorusGeometry(0.19, 0.02, 10, 48), M.steelDark, body, [knee.x, knee.y, knee.z + 0.1], null, [1, 0.95, 0.62]);
    wing(V(knee.x + 0.18 * s, knee.y + 0.02, knee.z + 0.02), V(s, 0, 0.35), 0.09, body, knee.clone().add(V(0, 0, 0.08)));
    // 鐵靴：成隻腳嘅形狀（腳踭高、腳尖低），面頭幾條弧形甲片接縫
    mesh(sphere(0.2, 56, 32), M.steel, body, [0.42 * s, 0.11, 0.3], [0.12, 0, 0], [0.95, 0.58, 1.75], 'Sabaton');
    for (let i = 0; i < 4; i++) {
      const z = 0.2 + i * 0.09, rr = 0.19 * Math.sqrt(Math.max(0.15, 1 - Math.pow((z - 0.3) / 0.35, 2)));
      mesh(new THREE.TorusGeometry(rr, 0.012, 8, 32, Math.PI), M.steelDark, body, [0.42 * s, 0.1 - i * 0.012, z], [0.12, 0, 0], [0.95, 0.6, 1]);
    }
    mesh(sphere(0.03, 12, 8), M.brass, body, [0.42 * s + 0.17 * s, 0.17, 0.12]);
  }

  // 蓬鬆尾巴：根部粗、中間最蓬、尾端收細再圓頭
  organicTube([V(0.1, 0.78, -0.72), V(0.45, 0.5, -1.05), V(0.9, 0.42, -0.95), V(1.22, 0.6, -0.62), V(1.32, 0.86, -0.38)],
              [0.19, 0.23, 0.25, 0.22, 0.14], M.fur, body, { name: 'Tail', capEnd: true, segs: 56 });

  /* ---------- 白披風：扣喺兩邊肩胛，被風吹向左後方 ---------- */
  let cape = null;
  if (!opts.forPrint) {
    const COLS = 28, ROWS = 48, LEN = 3.7;
    const capeGeo = new THREE.PlaneGeometry(1, 1, COLS, ROWS);
    cape = mesh(capeGeo, M.cape, root, null, null, null, 'Cape');
    cape.castShadow = true;
    const down = V(0, -1, -0.15).normalize();
    const wind = V(-1, 0.08, -0.3).normalize();
    const across = V(1, 0, 0), streamed = V(0, -1, -0.25).normalize();
    const dir = new THREE.Vector3(), axis = new THREE.Vector3(), nrm = new THREE.Vector3();
    const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    cape.userData.wave = function (time) {
      const p = capeGeo.attributes.position;
      // 陣風：慢慢強弱交替，唔會死板咁一直吹
      const gust = 0.74 + 0.14 * Math.sin(time * 0.7) + 0.08 * Math.sin(time * 1.9 + 1.3);
      for (let i = 0; i < p.count; i++) {
        const u = i % (COLS + 1) / COLS;                 // 0 = 右肩胛，1 = 左肩胛
        const v = Math.floor(i / (COLS + 1)) / ROWS;     // 0 = 領口，1 = 披風尾
        // 中線：近領口垂低，越落越俾風吹向左後方，布尾受重力微微下垂
        dir.copy(down).lerp(wind, gust * Math.min(1, v * 1.7)).normalize();
        const len = LEN * v;
        let x = dir.x * len, y = 2.32 + dir.y * len - 0.5 * v * v * (1 - 0.5 * gust), z = -0.68 + dir.z * len;
        // 闊度方向：喺膊頭係左右橫跨，被風吹起之後扭成上下，所以由正面睇到成幅布
        const twist = smooth(0, 0.32, v) * Math.min(1, gust * 1.2);
        axis.copy(across).lerp(streamed, twist).normalize();
        const width = 0.96 + 0.95 * v - 0.45 * v * v * v;
        const w = (u - 0.5) * width;
        x += axis.x * w; y += axis.y * w; z += axis.z * w;
        z += (2 * u - 1) * (2 * u - 1) * 0.3 * (1 - twist);   // 領口順住背部弧度
        // 摺位同波浪：沿布面法線方向推
        nrm.crossVectors(dir, axis).normalize();
        const pleat = Math.sin(u * Math.PI * 3 + v * 2.2) * (0.03 + 0.06 * v) + Math.sin(u * Math.PI * 7 + 1.1) * 0.012;
        const ripple = Math.sin(v * 6 - time * 4.2 + u * 1.6) * 0.24 * v * gust
                     + Math.sin(v * 15 - time * 9 + u * 5) * 0.05 * v * v;
        const off = pleat + ripple;
        p.setXYZ(i, x + nrm.x * off, y + nrm.y * off + Math.sin(v * 5 - time * 3.1 + u * 3) * 0.1 * v * gust, z + nrm.z * off);
      }
      p.needsUpdate = true;
      capeGeo.computeVertexNormals();
    };
    cape.userData.wave(0);
  }

  /* ---------- 長劍（垂直豎喺面前偏右）：雙手大劍，長劍柄 ---------- */
  const sword = new THREE.Group();
  sword.name = 'Sword';
  sword.position.set(-0.62, 2.2, 1.34);
  sword.rotation.set(0.04, 0, 0.03);
  root.add(sword);
  const blade = new THREE.Shape();
  blade.moveTo(-0.16, 0);
  blade.lineTo(0.16, 0);
  blade.lineTo(0.11, 5.6);
  blade.lineTo(0, 6.2);
  blade.lineTo(-0.11, 5.6);
  blade.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2 });
  bladeGeo.translate(0, 0, -0.03);
  mesh(bladeGeo, M.blade, sword, null, null, null, 'Blade');
  mesh(new THREE.BoxGeometry(0.05, 4.6, 0.13), M.steelDark, sword, [0, 2.45, 0], null, null, 'Fuller');
  mesh(new THREE.BoxGeometry(0.3, 0.28, 0.11), M.steel, sword, [0, 0.16, 0], null, null, 'Ricasso');
  // 護手：粗身、兩端向下彎、末端擴闊
  mesh(new THREE.BoxGeometry(0.32, 0.18, 0.2), M.brass, sword, [0, -0.02, 0], null, null, 'QuillonBlock');
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.62, 20), M.brass, sword, [0.42 * s, -0.04, 0], [0, 0, Math.PI / 2 + 0.12 * s], null, 'Crossguard');
    mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 20), M.brass, sword, [0.74 * s, -0.12, 0], [0, 0, 0.5 * s], null, 'QuillonEnd');
  }
  // 長劍柄：皮革纏繞 + 兩頭銅箍
  mesh(new THREE.CylinderGeometry(0.095, 0.085, 1.25, 28), M.leather, sword, [0, -0.76, 0], null, null, 'Grip');
  for (let i = 0; i < 12; i++) {
    mesh(new THREE.TorusGeometry(0.093, 0.016, 8, 24), M.leather, sword, [0, -0.2 - i * 0.1, 0], [Math.PI / 2 + 0.25, 0, 0]);
  }
  mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.09, 28), M.brass, sword, [0, -0.14, 0], null, null, 'Ferrule');
  mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.09, 28), M.brass, sword, [0, -1.38, 0], null, null, 'Ferrule');
  // 輪形劍首
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 36), M.brass, sword, [0, -1.55, 0], [Math.PI / 2, 0, 0], null, 'Pommel');
  mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 36), M.brass, sword, [0, -1.55, 0]);
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24), M.steel, sword, [0, -1.55, 0.075 * s], [Math.PI / 2, 0, 0]);
  mesh(sphere(0.05), M.brass, sword, [0, -1.77, 0], null, null, 'PommelCap');

  /* ---------- 雙手（右手由側邊、左手橫過胸前握住劍柄） ---------- */
  sword.updateMatrix();
  const onGrip = y => V(0, y, 0).applyMatrix4(sword.matrix);
  const gripAxis = Y.clone().applyQuaternion(sword.quaternion);
  const arms = [
    { shoulder: V(-0.8, 2.1, 0.12), hand: onGrip(-0.32), elbowOut: V(-0.3, -0.35, 0.05) },
    { shoulder: V(0.8, 2.1, 0.12), hand: onGrip(-0.86), elbowOut: V(0.2, -0.45, 0.25) },
  ];
  const bodyCenter = V(0, 1.7, 0);
  for (const { shoulder: S, hand: H, elbowOut } of arms) {
    const E = S.clone().lerp(H, 0.45).add(elbowOut);
    const toHand = H.clone().sub(E).normalize();
    const W = H.clone().addScaledVector(toHand, -0.27);          // 手腕（喺護腕入面）
    const up = E.clone().sub(S), fore = W.clone().sub(E);
    // 手肘尖向外嘅方向，同手臂彎曲平面嘅外側
    const tip = S.clone().sub(E).normalize().add(W.clone().sub(E).normalize()).negate().normalize();
    const side = new THREE.Vector3().crossVectors(up, fore).normalize();
    if (side.dot(E.clone().sub(bodyCenter)) < 0) side.negate();

    // 上臂：三片由上而下疊嘅甲片
    for (let k = 0; k < 3; k++) {
      const a = S.clone().lerp(E, k * 0.29 - (k ? 0.03 : 0)), b = S.clone().lerp(E, (k + 1) * 0.29);
      lame(a, b, 0.19 - 0.008 * k, 0.205 - 0.008 * k, k === 1 ? M.steelDark : M.steel, root);
    }
    // 手肘內彎：露出鎖子甲
    organicTube([S.clone().lerp(E, 0.86), E.clone().addScaledVector(tip, -0.06), E.clone().lerp(W, 0.16)], [0.16, 0.15, 0.16], M.mail, root, { name: 'ElbowMail', segs: 16 });
    // 手肘甲：包住手肘尖嘅杯 + 外側扇翼
    const cop = mesh(sphere(0.2, 48, 32), M.steel, root, null, null, [1, 1, 0.66], 'Couter');
    cop.position.copy(E).addScaledVector(tip, 0.05);
    cop.quaternion.setFromUnitVectors(Z, tip);
    wing(E.clone().addScaledVector(side, 0.16).addScaledVector(tip, -0.02), side, 0.11, root, E.clone().addScaledVector(tip, 0.1));
    // 前臂護腕：微微錐形，手腕位外翻成喇叭口，中間一條皮帶
    const E2 = E.clone().lerp(W, 0.12);
    organicTube([E2, E2.clone().lerp(W, 0.5), W], [0.17, 0.18, 0.15], M.steel, root, { name: 'Vambrace', segs: 24 });
    const cuffEnd = W.clone().addScaledVector(toHand, 0.07);
    lame(W.clone().addScaledVector(toHand, -0.02), cuffEnd, 0.15, 0.19, M.steel, root);
    const strap = mesh(new THREE.TorusGeometry(0.183, 0.022, 10, 40), M.leather, root);
    strap.position.copy(E2.clone().lerp(W, 0.45));
    strap.quaternion.setFromUnitVectors(Z, fore.clone().normalize());
    const buckle = strap.position.clone().addScaledVector(side, 0.19);
    mesh(new THREE.BoxGeometry(0.06, 0.07, 0.03), M.brass, root, [buckle.x, buckle.y, buckle.z]).quaternion.setFromUnitVectors(Z, side);

    // 毛毛貓掌：由護腕伸出，掌心貼住劍柄，四隻腳趾包住劍柄前面
    organicTube([W.clone().addScaledVector(toHand, -0.04), W.clone().addScaledVector(toHand, 0.14), H.clone().addScaledVector(toHand, -0.02)],
                [0.13, 0.155, 0.15], M.fur, root, { name: 'Paw', capEnd: true, segs: 16 });
    const b = toHand.clone().addScaledVector(gripAxis, -toHand.dot(gripAxis)).normalize();
    const c = new THREE.Vector3().crossVectors(gripAxis, b).normalize();
    if (c.z < 0) c.negate();
    for (let k = 0; k < 4; k++) {
      const along = (k - 1.5) * 0.075, ang = 1.25 + Math.abs(k - 1.5) * 0.12;
      const p = H.clone().addScaledVector(gripAxis, along)
        .addScaledVector(b, Math.cos(ang) * 0.13).addScaledVector(c, Math.sin(ang) * 0.13);
      const toe = mesh(sphere(0.062, 24, 16), M.fur, root, [p.x, p.y, p.z], null, [1, 0.85, 1.1], 'Toe');
      toe.quaternion.setFromUnitVectors(Z, c);
    }
  }

  /* ---------- 頭 ---------- */
  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, 3.2, 0.12);
  head.rotation.x = 0.07;   // 微微耷低頭，由眉下望上去，眼神更堅定
  root.add(head);
  // 頭骨：一個連續形狀，兩邊面珠墩脹啲、頭頂略扁（之前係一粒粒波黐埋，睇落似玩具）
  const skullGeo = sphere(1.05, 72, 54);
  const sp = skullGeo.attributes.position, sv = new THREE.Vector3();
  for (let i = 0; i < sp.count; i++) {
    sv.fromBufferAttribute(sp, i).divideScalar(1.05);
    const cheek = smooth(0.3, 0.85, Math.abs(sv.x)) * smooth(0.35, -0.45, sv.y) * smooth(-0.6, 0.1, sv.z);
    const flatTop = smooth(0.55, 1.0, sv.y) * 0.05;
    const chin = smooth(-0.6, -0.95, sv.y) * smooth(0.0, 0.6, sv.z) * 0.06;
    sv.multiplyScalar(1.05 * (1 + 0.15 * cheek - flatTop - chin));
    sp.setXYZ(i, sv.x, sv.y, sv.z);
  }
  mesh(skullGeo, M.fur, head, [0, 0, 0], null, [1.12, 0.97, 1], 'Skull');
  for (const s of [-1, 1]) {
    mesh(sphere(0.25), M.furLight, head, [0.14 * s, -0.36, 0.84], null, [1, 0.78, 0.8], 'WhiskerPad');
  }
  mesh(sphere(0.16), M.fur, head, [0, -0.02, 0.9], null, [0.75, 1.4, 0.7], 'NoseBridge');
  mesh(sphere(0.16), M.furLight, head, [0, -0.52, 0.84], null, [1, 0.7, 0.8]);
  mesh(sphere(0.075, 20, 14), M.nose, head, [0, -0.21, 1.04], [0.25, 0, 0], [1.3, 0.75, 0.75], 'Nose');
  mesh(new THREE.BoxGeometry(0.012, 0.08, 0.02), M.nose, head, [0, -0.29, 1.06]).userData.noFur = true;   // 人中
  for (const s of [-1, 1]) {
    // 嘴角向下（∩∩），抿住嘴好認真
    mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), M.eye, head, [0.06 * s, -0.4, 1.04], [0, 0, 0], [1, 0.7, 1], 'Mouth');
  }

  // 大大對濕濕眼，加上向鼻樑壓低嘅上眼皮同眉骨，表情嚴肅
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(0.38 * s, -0.02, 0.95);
    eye.rotation.z = 0.06 * s;
    head.add(eye);
    mesh(sphere(0.21, 40, 28), M.eye, eye, [0, 0, -0.02], null, [1, 1.08, 0.62], 'EyeRim');
    mesh(sphere(0.19, 40, 28), M.iris, eye, [0, 0, 0], null, [1, 1.06, 0.6], 'Iris');
    mesh(sphere(0.155, 32, 24), M.eye, eye, [0, 0, 0.035], null, [1, 1.1, 0.6], 'Pupil');      // 大瞳孔：幼貓喺陰天會擴張
    mesh(sphere(0.205, 40, 28), M.cornea, eye, [0, 0, 0.012], null, [1, 1.07, 0.66], 'Cornea');
    mesh(sphere(0.03, 12, 10), M.shine, eye, [0.06 * s, 0.02, 0.125]);
    // 上眼皮：毛色半球殼，蓋住眼上面兩成，眼頭一邊壓得最低
    const lid = mesh(new THREE.SphereGeometry(0.218, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.27), M.fur, eye, [0, 0.005, 0], null, [1.06, 1.1, 0.74], 'Eyelid');
    lid.rotation.set(0.12, 0, 0.32 * s, 'ZYX');
    eyes.push(eye);
    // 眉骨：深色毛，向眉心壓落
    mesh(new THREE.CapsuleGeometry(0.04, 0.3, 6, 12), M.furDark, head, [0.36 * s, 0.12, 1.0], [0, 0, Math.PI / 2 + 0.5 * s], [1, 1, 0.5], 'Brow');
  }

  // 細細對耳仔，向兩邊開
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.7 * s, 0.68, 0.0);
    ear.rotation.set(-0.15, 0, -0.62 * s);
    head.add(ear);
    mesh(new THREE.ConeGeometry(0.3, 0.52, 32), M.fur, ear, [0, 0.2, 0], null, [1, 1, 0.75], 'Ear');
    mesh(new THREE.ConeGeometry(0.18, 0.34, 24), M.pinkSoft, ear, [0, 0.16, 0.12], null, [1, 1, 0.4], 'InnerEar');
    mesh(new THREE.ConeGeometry(0.08, 0.3, 12), M.furLight, ear, [0, 0.12, 0.17], null, [1, 1, 0.5]);
  }

  // 鬚
  if (!opts.forPrint) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 6), M.whisker, head,
             [0.6 * s, -0.3 - k * 0.07, 0.84], [0, -0.35 * s, Math.PI / 2 + (k - 1) * 0.12 * s], null, 'Whisker');
      }
    }
  }

  // 細細粒粉紅蝴蝶結（頭頂左邊、近耳仔）
  const bow = new THREE.Group();
  bow.name = 'Bow';
  bow.position.set(0.4, 0.86, 0.42);
  bow.rotation.set(-0.45, 0.2, -0.25);
  head.add(bow);
  for (const s of [-1, 1]) {
    mesh(sphere(0.13), M.pink, bow, [0.15 * s, 0.01, 0], [0, 0, 0.3 * s], [1.3, 0.85, 0.5], 'BowLoop');
    mesh(new THREE.CapsuleGeometry(0.035, 0.12, 6, 10), M.pink, bow, [0.06 * s, -0.12, 0.01], [0, 0, 0.45 * s], [1, 1, 0.6]);
  }
  mesh(sphere(0.06), M.pink, bow, [0, 0, 0.02], null, [1, 1, 0.8], 'BowKnot');

  root.userData = { head, eyes, sword, cape, materials: M, furs: FURS, furMaterials: [M.fur, M.furDark, M.furLight] };
  root.userData.setFur = function (key) {
    const f = FURS[key];
    if (!f) return;
    M.fur.color.setHex(f.base);
    M.furDark.color.setHex(f.dark);
    M.furLight.color.setHex(f.light);
  };
  return root;
});
