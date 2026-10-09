// 卡通版「躺平社畜貓」3D 模型。
// buildLyingCat(THREE) 回傳 { root, cat, set, parts }：
//   root  = 成個場景（貓 + 梯級）
//   parts = 動畫要用到嘅部件（chest、tail、head、forearmR、cigTip、nose）
// 同一份檔案俾網頁（全域 buildLyingCat）同 Node 匯出 GLB（module.exports）共用。
(function (root) {
  function buildLyingCat(THREE) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = (color, extra) =>
      new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, extra || {}));

    const mat = {
      fur: M(0xa08a6c),
      furDark: M(0x5a4836),
      furLight: M(0xf3ebdf),
      pink: M(0xe8a0a0),
      bean: M(0x3b2b2b),
      eye: M(0x2a201a),
      whisker: M(0xf7f4ee),
      jacket: M(0x262422),
      pants: M(0x1d1b1a),
      shirt: M(0xf5f5f2),
      tie: M(0x1e2a45),
      shoe: M(0x0f0f10, { roughness: 0.3 }),
      sole: M(0x2b2b2b),
      cig: M(0xfbfbf8),
      filter: M(0xd9a35b),
      ember: new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4a00, emissiveIntensity: 2 }),
      concrete: M(0x9b988f),
      concreteSide: M(0x86837b),
      door: M(0x55666d, { roughness: 0.55, metalness: 0.35 }),
      doorFrame: M(0x6f7478, { roughness: 0.5, metalness: 0.4 }),
    };

    function mesh(geo, m, name) {
      const o = new THREE.Mesh(geo, m);
      if (name) o.name = name;
      o.castShadow = true;
      o.receiveShadow = true;
      return o;
    }

    function ball(r, m, pos, scale, name) {
      const o = mesh(new THREE.SphereGeometry(r, 32, 20), m, name);
      o.position.copy(pos);
      if (scale) o.scale.set(scale[0], scale[1], scale[2]);
      return o;
    }

    // 兩點之間嘅膠囊（手腳、煙）
    function limb(a, b, r, m, name) {
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const o = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 16), m, name);
      o.position.copy(a).add(b).multiplyScalar(0.5);
      o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      return o;
    }

    function rod(a, b, r, m, name) {
      const dir = new THREE.Vector3().subVectors(b, a);
      const o = mesh(new THREE.CylinderGeometry(r, r, dir.length(), 16), m, name);
      o.position.copy(a).add(b).multiplyScalar(0.5);
      o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      return o;
    }

    // 肉球：掌心向 normal 方向
    function paw(center, normal, name) {
      const g = new THREE.Group();
      g.name = name;
      g.position.copy(center);
      g.quaternion.setFromUnitVectors(V(0, 1, 0), normal.clone().normalize());
      g.add(ball(0.1, mat.fur, V(0, 0, 0), [1, 0.75, 1.1]));
      g.add(ball(0.045, mat.bean, V(0, 0.07, 0.01), [1.2, 0.5, 1]));
      [[-0.055, 0.06], [-0.02, 0.085], [0.02, 0.085], [0.055, 0.06]].forEach(([x, z]) =>
        g.add(ball(0.02, mat.bean, V(x, 0.062, z - 0.0), [1, 0.6, 1]))
      );
      // 腳趾肉球擺喺前面一啲
      g.children.slice(2).forEach((c) => (c.position.z += 0.05));
      return g;
    }

    const rootGroup = new THREE.Group();
    rootGroup.name = "LyingOfficeCatScene";

    // ---------- 梯級同門（相入面嘅街景） ----------
    const set = new THREE.Group();
    set.name = "Steps";
    const upper = mesh(new THREE.BoxGeometry(4.2, 0.4, 3.0), mat.concrete, "UpperSlab");
    upper.position.set(0, -0.2, -0.6);
    const lower = mesh(new THREE.BoxGeometry(4.2, 0.3, 1.8), mat.concreteSide, "Pavement");
    lower.position.set(0, -0.55, 1.8);
    const back = mesh(new THREE.BoxGeometry(4.2, 0.3, 0.7), mat.concrete, "BackStep");
    back.position.set(0, 0.15, -1.75);
    const frame = mesh(new THREE.BoxGeometry(2.9, 2.1, 0.08), mat.doorFrame, "DoorFrame");
    frame.position.set(0.2, 1.35, -2.13);
    const door = mesh(new THREE.BoxGeometry(2.6, 1.95, 0.06), mat.door, "Door");
    door.position.set(0.2, 1.33, -2.08);
    set.add(upper, lower, back, frame, door);
    rootGroup.add(set);

    // ---------- 貓 ----------
    const cat = new THREE.Group();
    cat.name = "OfficeCat";
    rootGroup.add(cat);

    // 胸口（會呼吸）
    const chest = new THREE.Group();
    chest.name = "Chest";
    chest.position.set(0, 0.2, -0.2);
    cat.add(chest);
    const torso = mesh(new THREE.CapsuleGeometry(0.27, 0.5, 10, 24), mat.jacket, "Jacket");
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(1.15, 1, 0.75); // capsule 轉咗 90°，z 即係厚度
    chest.add(torso);
    const shirt = mesh(new THREE.CapsuleGeometry(0.14, 0.42, 8, 16), mat.shirt, "Shirt");
    shirt.rotation.x = Math.PI / 2;
    shirt.position.set(0, 0.15, -0.08);
    shirt.scale.set(1, 1, 0.55);
    chest.add(shirt);
    // 恤衫領
    [-1, 1].forEach((s) => {
      const c = mesh(new THREE.BoxGeometry(0.13, 0.03, 0.1), mat.shirt, "Collar");
      c.position.set(0.06 * s, 0.225, -0.47);
      c.rotation.set(-0.3, 0.6 * s, 0.25 * s);
      chest.add(c);
    });
    // 領呔：有少少歪
    const tie = new THREE.Group();
    tie.name = "Tie";
    tie.position.set(0, 0.24, -0.45);
    tie.rotation.set(0.12, 0.18, 0);
    tie.add(ball(0.04, mat.tie, V(0, 0, 0), [1.1, 0.7, 1]));
    const tieBody = mesh(new THREE.BoxGeometry(0.08, 0.018, 0.34), mat.tie);
    tieBody.position.set(0, 0, 0.19);
    tie.add(tieBody);
    const tieTip = mesh(new THREE.BoxGeometry(0.057, 0.018, 0.057), mat.tie);
    tieTip.position.set(0, 0, 0.36);
    tieTip.rotation.y = Math.PI / 4;
    tie.add(tieTip);
    chest.add(tie);
    // 衫腳同褲頭
    const hips = ball(0.26, mat.pants, V(0, 0.17, 0.33), [1.12, 0.62, 0.8], "Hips");
    cat.add(hips);

    // 腳：大髀平放，膝頭喺梯邊，小腿吊落去
    [-1, 1].forEach((s) => {
      const hip = V(0.15 * s, 0.14, 0.38);
      const knee = V(0.17 * s, 0.11, 0.9);
      const ankle = V(0.21 * s, -0.2, 1.02);
      cat.add(limb(hip, knee, 0.12, mat.pants, "Thigh"));
      cat.add(limb(knee, ankle, 0.105, mat.pants, "Shin"));
      cat.add(ball(0.07, mat.fur, ankle.clone().add(V(0, -0.05, 0.02)), null, "Ankle"));
      const shoe = new THREE.Group();
      shoe.name = s < 0 ? "ShoeL" : "ShoeR";
      shoe.position.copy(ankle).add(V(0.02 * s, -0.1, 0.07));
      shoe.rotation.set(-0.9, 0.15 * s, 0);
      shoe.add(ball(0.12, mat.shoe, V(0, 0, 0.06), [1, 0.85, 1.75]));
      shoe.add(ball(0.12, mat.sole, V(0, -0.06, 0.06), [0.92, 0.3, 1.68]));
      cat.add(shoe);
    });

    // 左手攤開，掌心向天
    const shL = V(-0.28, 0.27, -0.58);
    const wrL = V(-0.82, 0.1, -0.5);
    cat.add(limb(shL, wrL, 0.095, mat.jacket, "SleeveL"));
    cat.add(rod(wrL.clone().lerp(shL, 0.06), wrL.clone().lerp(shL, -0.04), 0.085, mat.shirt, "CuffL"));
    cat.add(paw(V(-0.93, 0.09, -0.49), V(0, 1, 0.15), "PawL"));

    // 右手：上臂平放，前臂舉起揸住支煙
    const shR = V(0.28, 0.27, -0.58);
    const elR = V(0.66, 0.12, -0.42);
    cat.add(limb(shR, elR, 0.095, mat.jacket, "UpperArmR"));
    const forearmR = new THREE.Group();
    forearmR.name = "ForearmR";
    forearmR.position.copy(elR);
    cat.add(forearmR);
    const wrR = V(0.04, 0.4, -0.04); // 相對手踭
    forearmR.add(limb(V(0, 0, 0), wrR, 0.09, mat.jacket, "SleeveR"));
    forearmR.add(rod(wrR.clone().multiplyScalar(0.92), wrR.clone().multiplyScalar(1.08), 0.082, mat.shirt, "CuffR"));
    forearmR.add(paw(V(0.045, 0.52, -0.05), V(-0.2, 1, 0.8), "PawR"));
    // 煙：濾嘴喺掌心，煙頭向上斜向個頭
    const cigA = V(0.02, 0.56, -0.07);
    const cigB = V(-0.12, 0.74, -0.22);
    const filterEnd = cigA.clone().lerp(cigB, 0.28);
    forearmR.add(rod(cigA, filterEnd, 0.02, mat.filter, "CigFilter"));
    forearmR.add(rod(filterEnd, cigB, 0.02, mat.cig, "Cigarette"));
    const tip = ball(0.021, mat.ember, cigB.clone().add(new THREE.Vector3().subVectors(cigB, cigA).normalize().multiplyScalar(0.01)), [1, 1, 1], "CigTip");
    forearmR.add(tip);

    // ---------- 頭：仰起，下巴向天 ----------
    const head = new THREE.Group();
    head.name = "Head";
    head.position.set(0, 0.34, -0.98);
    head.rotation.x = -1.05; // 塊面向天、微微望向對腳，頭頂向後
    cat.add(head);
    const R = 0.36;
    head.add(ball(R, mat.fur, V(0, 0, 0), [1.1, 0.95, 0.95], "Skull"));
    // 虎紋：沿住額頭到頭頂
    const up = V(0, 1, 0);
    [[0, 0.62, 0.62], [-0.2, 0.6, 0.55], [0.2, 0.6, 0.55], [0, 0.85, 0.2], [-0.25, 0.8, 0.15], [0.25, 0.8, 0.15]].forEach(
      ([x, y, z]) => {
        const n = V(x, y, z).normalize();
        const st = ball(0.06, mat.furDark, n.clone().multiplyScalar(R * 0.97).multiply(V(1.1, 0.95, 0.95)), [0.6, 0.25, 1.15]);
        st.quaternion.setFromUnitVectors(up, n);
        head.add(st);
      }
    );
    // 腮同下巴
    head.add(ball(0.13, mat.furLight, V(-0.085, -0.11, 0.27), [1.05, 0.85, 0.85], "CheekL"));
    head.add(ball(0.13, mat.furLight, V(0.085, -0.11, 0.27), [1.05, 0.85, 0.85], "CheekR"));
    head.add(ball(0.1, mat.furLight, V(0, -0.2, 0.22), [1, 0.8, 0.9], "Chin"));
    head.add(ball(0.045, mat.pink, V(0, -0.04, 0.37), [1.2, 0.75, 0.8], "Nose"));
    // 瞇埋眼（^ ^）
    [-1, 1].forEach((s) => {
      const e = mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20, Math.PI), mat.eye, "ClosedEye");
      e.position.set(0.14 * s, 0.07, 0.3);
      e.rotation.set(0, 0.42 * s, 0);
      head.add(e);
    });
    // 耳仔：平放喺地，向兩邊攤
    [-1, 1].forEach((s) => {
      const ear = new THREE.Group();
      ear.name = "Ear";
      ear.position.set(0.21 * s, 0.25, -0.02);
      ear.rotation.set(-0.15, 0, -0.55 * s);
      const outer = mesh(new THREE.ConeGeometry(0.12, 0.24, 24), mat.fur);
      outer.position.y = 0.1;
      outer.scale.z = 0.5;
      const inner = mesh(new THREE.ConeGeometry(0.075, 0.17, 24), mat.pink);
      inner.position.set(0, 0.08, 0.03);
      inner.scale.z = 0.35;
      ear.add(outer, inner);
      head.add(ear);
    });
    // 鬚
    [-1, 1].forEach((s) => {
      [-0.15, 0, 0.15].forEach((a) => {
        const from = V(0.13 * s, -0.09, 0.32);
        const to = from.clone().add(V(0.32 * s, 0.32 * a + 0.03, -0.06));
        head.add(rod(from, to, 0.004, mat.whisker, "Whisker"));
      });
    });

    // ---------- 尾 ----------
    const tail = new THREE.Group();
    tail.name = "Tail";
    tail.position.set(0.12, 0.08, 0.45);
    cat.add(tail);
    const curve = new THREE.CatmullRomCurve3([
      V(0, 0, 0), V(0.25, -0.01, 0.1), V(0.5, -0.01, 0.05), V(0.72, -0.01, 0.18), V(0.82, 0.0, 0.36),
    ]);
    tail.add(mesh(new THREE.TubeGeometry(curve, 48, 0.06, 14, false), mat.fur, "TailBody"));
    [0.25, 0.45, 0.65, 0.85].forEach((t) => {
      const ring = mesh(new THREE.TorusGeometry(0.061, 0.014, 8, 20), mat.furDark, "TailStripe");
      ring.position.copy(curve.getPoint(t));
      ring.quaternion.setFromUnitVectors(V(0, 0, 1), curve.getTangent(t));
      tail.add(ring);
    });
    tail.add(ball(0.062, mat.furDark, curve.getPoint(1), null, "TailTip"));

    const parts = {
      chest,
      tail,
      head,
      forearmR,
      cigTip: tip,
      nose: head.getObjectByName("Nose"),
    };
    return { root: rootGroup, cat, set, parts };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = buildLyingCat;
  else root.buildLyingCat = buildLyingCat;
})(typeof self !== "undefined" ? self : this);
