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
    cape:      std(0xece4d4, 0.9),
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

  // 兩點之間嘅圓柱（手臂、腳用），兩端加圓球令關節圓潤
  function limb(a, b, r, mat, parent, caps) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mesh(new THREE.CylinderGeometry(r, r, dir.length(), 48), mat, parent);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(Y, dir.normalize());
    if (caps !== false) {
      mesh(sphere(r, 40, 28), mat, parent, [a.x, a.y, a.z]);
      mesh(sphere(r, 40, 28), mat, parent, [b.x, b.y, b.z]);
    }
    return m;
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
  // 胸甲上嘅凸線花紋
  for (const s of [-1, 1]) {
    mesh(new THREE.TorusGeometry(0.22, 0.022, 8, 28, Math.PI), M.steelDark, body, [0.3 * s, 1.75, 0.8], [-0.2, 0.3 * s, 0]);
  }
  mesh(new THREE.TorusGeometry(0.56, 0.09, 20, 96), M.steel, body, [0, 2.36, 0.02], [Math.PI / 2, 0, 0], [1, 0.9, 1], 'Gorget');
  // 頸位一圈淺色毛
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + 0.7 * i / 8);
    mesh(sphere(0.2, 16, 12), M.furLight, body, [Math.cos(a) * 0.5, 2.48, Math.sin(a) * 0.42], null, [1, 0.8, 1]);
  }

  // 鎖子甲裙 + 前面兩塊腿甲
  mesh(lathe([[0, 0.42], [0.98, 0.42], [1.05, 0.62], [0.96, 1.05], [0, 1.05]]), M.mail, body, null, null, [1, 1, 0.9], 'Chainmail');
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.5, 0.55, 0.07), M.steel, body, [0.36 * s, 0.78, 0.93], [-0.18, 0.32 * s, 0], null, 'Tasset');
    mesh(new THREE.BoxGeometry(0.44, 0.05, 0.08), M.steelDark, body, [0.36 * s, 0.98, 0.98], [-0.18, 0.32 * s, 0]);
    const tasset = new THREE.Group();
    tasset.position.set(0.36 * s, 0.78, 0.93);
    tasset.rotation.set(-0.18, 0.32 * s, 0);
    body.add(tasset);
    for (const [x, y] of [[-0.19, 0.2], [0.19, 0.2], [-0.19, -0.2], [0.19, -0.2]]) mesh(sphere(0.03, 10, 8), M.brass, tasset, [x, y, 0.045]);
    mesh(new THREE.BoxGeometry(0.5, 0.035, 0.09), M.steel, tasset, [0, -0.27, 0]);   // 下緣卷邊
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

  // 腳：毛毛大髀、膝甲、脛甲、鐵靴
  for (const s of [-1, 1]) {
    limb(V(0.42 * s, 0.6, 0.05), V(0.42 * s, 0.42, 0.1), 0.26, M.fur, body, false);
    limb(V(0.42 * s, 0.42, 0.1), V(0.42 * s, 0.16, 0.1), 0.23, M.steel, body, false);
    mesh(sphere(0.2), M.steel, body, [0.42 * s, 0.42, 0.3], null, [1, 1, 0.55], 'Poleyn');
    mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), M.steelDark, body, [0.42 * s, 0.42, 0.33], null, [1, 1, 0.6]);
    mesh(sphere(0.3), M.steelDark, body, [0.42 * s, 0.12, 0.24], null, [1, 0.45, 1.4], 'Sabaton');
    mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 24), M.steel, body, [0.42 * s, 0.16, 0.2], [Math.PI / 2, 0, 0], [1, 1.3, 1]);
  }

  // 蓬鬆尾巴（喺右後腳旁邊伸出嚟）
  const tailCurve = new THREE.CatmullRomCurve3([V(0.1, 0.75, -0.75), V(0.45, 0.5, -1.05), V(0.9, 0.42, -0.95), V(1.25, 0.6, -0.6)]);
  mesh(new THREE.TubeGeometry(tailCurve, 40, 0.22, 16, false), M.fur, body, null, null, null, 'Tail');
  const tip = tailCurve.getPoint(1);
  mesh(sphere(0.25), M.fur, body, [tip.x, tip.y, tip.z], null, [1, 0.9, 1]);

  /* ---------- 白披風（向左後方飄） ---------- */
  let cape = null;
  if (!opts.forPrint) {
    const capeGeo = new THREE.BoxGeometry(1, 1, 1, 36, 12, 1);
    const base = capeGeo.attributes.position.array.slice();
    cape = mesh(capeGeo, M.cape, root, null, null, null, 'Cape');
    cape.userData.wave = function (time) {
      const p = capeGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = base[i * 3], v = base[i * 3 + 1], w = base[i * 3 + 2];
        const s = u + 0.5;                                       // 0 = 膊頭，1 = 飄出去嗰端
        const flap = Math.sin(s * 6.5 - time * 4 + v * 1.6) * 0.24 * s;
        const width = (0.5 + s * 0.9) * (1 - 0.35 * s * s);         // 尾端收窄
        const hem = v < 0 ? Math.sin(s * 9 - time * 5) * 0.14 * s * -v * 2 : 0;   // 下擺波浪
        p.setXYZ(i,
          0.55 - s * 3.0 + Math.sin(v * 3 + time) * 0.08 * s,
          2.15 - s * 0.35 - s * s * 0.45 + v * width + hem + Math.sin(s * 4 - time * 2.6 + v) * 0.1 * s,
          -0.55 - Math.sin(s * Math.PI * 0.85) * 0.4 + flap + w * 0.06);
      }
      p.needsUpdate = true;
      capeGeo.computeVertexNormals();
    };
    cape.userData.wave(0);
  }

  /* ---------- 長劍（垂直豎喺面前偏右） ---------- */
  const sword = new THREE.Group();
  sword.name = 'Sword';
  sword.position.set(-0.6, 2.15, 1.3);
  sword.rotation.set(0.04, 0, 0.03);
  root.add(sword);
  const blade = new THREE.Shape();
  blade.moveTo(-0.12, 0);
  blade.lineTo(0.12, 0);
  blade.lineTo(0.08, 4.7);
  blade.lineTo(0, 5.15);
  blade.lineTo(-0.08, 4.7);
  blade.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2 });
  bladeGeo.translate(0, 0, -0.025);
  mesh(bladeGeo, M.blade, sword, null, null, null, 'Blade');
  mesh(new THREE.BoxGeometry(0.04, 3.8, 0.11), M.steelDark, sword, [0, 2.0, 0], null, null, 'Fuller');
  // 微微向下彎嘅護手
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.46, 0.08, 0.12), M.brass, sword, [0.21 * s, -0.02, 0], [0, 0, 0.12 * s], null, 'Crossguard');
    mesh(sphere(0.07), M.brass, sword, [0.44 * s, -0.08, 0]);
  }
  mesh(new THREE.BoxGeometry(0.2, 0.14, 0.14), M.brass, sword, [0, -0.03, 0]);
  mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.8, 20), M.leather, sword, [0, -0.47, 0], null, null, 'Grip');
  mesh(sphere(0.12), M.brass, sword, [0, -0.92, 0], null, [1, 0.85, 1], 'Pommel');

  /* ---------- 雙手（右手由側邊、左手橫過胸前握住劍柄） ---------- */
  sword.updateMatrix();
  const onGrip = y => V(0, y, 0).applyMatrix4(sword.matrix);
  const arms = [
    { shoulder: V(-0.82, 2.08, 0.15), hand: onGrip(-0.2), elbowOut: V(-0.3, -0.35, 0.05) },
    { shoulder: V(0.82, 2.08, 0.15), hand: onGrip(-0.58), elbowOut: V(0.2, -0.45, 0.25) },
  ];
  for (const { shoulder, hand, elbowOut } of arms) {
    const elbow = shoulder.clone().lerp(hand, 0.45).add(elbowOut);
    limb(shoulder, elbow, 0.19, M.steel, root);
    limb(elbow, hand, 0.2, M.steel, root, false);
    mesh(sphere(0.23, 48, 32), M.steelDark, root, [elbow.x, elbow.y, elbow.z], null, null, 'Couter');
    // 毛毛手掌包住劍柄
    mesh(sphere(0.21), M.fur, root, [hand.x, hand.y, hand.z + 0.02], null, [1.15, 0.95, 1], 'Paw');
    for (let k = -1; k <= 1; k++) {
      mesh(sphere(0.075, 12, 10), M.furDark, root, [hand.x + 0.04, hand.y + k * 0.085, hand.z + 0.2]).userData.noFur = true;
    }
  }

  /* ---------- 頭 ---------- */
  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, 3.2, 0.12);
  head.rotation.x = 0.07;   // 微微耷低頭，由眉下望上去，眼神更堅定
  root.add(head);
  mesh(sphere(1.05, 48, 36), M.fur, head, [0, 0, 0], null, [1.12, 0.97, 1], 'Skull');
  // 長毛：面邊、頭頂一嚿嚿毛
  for (const s of [-1, 1]) {
    for (const [a, r] of [[0.1, 0.3], [0.32, 0.32], [0.55, 0.26]]) {   // 面珠墩兩邊嘅長毛
      mesh(sphere(r, 18, 14), M.fur, head, [s * Math.cos(a) * 0.98, -0.12 - Math.sin(a) * 0.62, 0.22], null, [1, 0.8, 0.85]);
    }
  }
  for (const [x, y, z, r] of [[-0.3, 0.88, 0.2, 0.3], [0.05, 0.95, 0.15, 0.32], [-0.6, 0.62, 0.3, 0.26], [0.32, 0.85, 0.05, 0.26]]) {
    mesh(sphere(r, 18, 14), M.fur, head, [x, y, z], null, [1, 0.7, 1]);
  }
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
