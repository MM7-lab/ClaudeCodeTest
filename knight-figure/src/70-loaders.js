/* ============================================================================
   Model loading without libraries: .glb / .gltf (+ .bin + images), .obj (+ .mtl
   + images), .stl (binary or ASCII). Output: submeshes with positions, normals,
   uvs, vertex colours, indices and a simple material.
   ========================================================================== */
class FriendlyError extends Error {}

const baseName = s => decodeURIComponent(String(s).split(/[\\/]/).pop()).toLowerCase();
function findFile(files, uri) { return files.get(baseName(uri)) || null; }
function b64ToBytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function dataUri(uri) { const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri); if (!m) return null; return { mime: m[1], bytes: m[2] ? b64ToBytes(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3])) }; }
async function bitmapFrom(blob) {
  try { return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); } catch (e) { return null; }
}
const extOf = n => (n.split('.').pop() || '').toLowerCase();

async function loadModelFiles(fileArray) {
  const files = new Map();
  for (const f of fileArray) files.set(baseName(f.name), f);
  const all = [...files.values()];
  const pick = ext => all.find(f => extOf(f.name) === ext);
  const main = pick('glb') || pick('gltf') || pick('obj') || pick('stl');
  if (!main) throw new FriendlyError('Drop a .glb, .gltf, .obj or .stl file (with its .bin, .mtl and texture files if it has them).');
  const ext = extOf(main.name), msgs = [];
  let model;
  if (ext === 'glb') model = await parseGLB(await main.arrayBuffer(), files, msgs);
  else if (ext === 'gltf') model = await parseGLTF(JSON.parse(await main.text()), null, files, msgs);
  else if (ext === 'obj') model = await parseOBJ(await main.text(), files, msgs);
  else model = parseSTL(await main.arrayBuffer(), msgs);
  model.name = main.name.replace(/\.[^.]+$/, '');
  model.messages = msgs;
  for (const sm of model.submeshes) if (!sm.normals) Object.assign(sm, creaseNormals(sm));
  model.submeshes = model.submeshes.filter(sm => sm.indices.length >= 3);
  if (!model.submeshes.length) throw new FriendlyError('That file has no triangles to show.');
  return model;
}

/* ---------------- glTF ---------------- */
async function parseGLB(buf, files, msgs) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new FriendlyError('This .glb file is not a valid glTF binary.');
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const chunk = new Uint8Array(buf, off + 8, len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  if (!json) throw new FriendlyError('This .glb file has no scene description.');
  return parseGLTF(json, bin, files, msgs);
}

const GL_COMP = { 5120: [1, 'getInt8', 127], 5121: [1, 'getUint8', 255], 5122: [2, 'getInt16', 32767], 5123: [2, 'getUint16', 65535], 5125: [4, 'getUint32', 0], 5126: [4, 'getFloat32', 0] };
const GL_N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

async function parseGLTF(json, bin, files, msgs) {
  const exts = new Set([...(json.extensionsRequired || []), ...(json.extensionsUsed || [])]);
  const compressed = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_meshopt_compression'].filter(e => exts.has(e));
  if (compressed.length) {
    const kind = compressed[0].includes('draco') ? 'Draco' : 'meshopt';
    throw new FriendlyError(`This model is ${kind}-compressed, and this viewer reads files without any decoder libraries. Re-export it without ${kind} compression (in Blender: glTF export → uncheck “Compression”) and drop it again.`);
  }
  // buffers
  const missing = [];
  const buffers = await Promise.all((json.buffers || []).map(async (b, i) => {
    if (!b.uri) return bin || new Uint8Array(0);
    const du = dataUri(b.uri);
    if (du) return du.bytes;
    const f = findFile(files, b.uri);
    if (!f) { missing.push(decodeURIComponent(b.uri)); return null; }
    return new Uint8Array(await f.arrayBuffer());
  }));
  if (missing.length) throw new FriendlyError(`This .gltf keeps its geometry in ${missing.join(', ')}. Drop that file together with the .gltf (select them all at once).`);

  const accCache = new Map();
  const readAcc = (idx, asInt) => {
    const key = idx + (asInt ? 'i' : 'f');
    if (accCache.has(key)) return accCache.get(key);
    const a = json.accessors[idx], n = GL_N[a.type], [size, getter, norm] = GL_COMP[a.componentType];
    const out = asInt ? new Uint32Array(a.count * n) : new Float32Array(a.count * n);
    if (a.bufferView !== undefined) {
      const bv = json.bufferViews[a.bufferView], buf = buffers[bv.buffer];
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const stride = bv.byteStride || size * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
      const scale = a.normalized && norm ? 1 / norm : 1;
      for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) {
        let v = dv[getter](base + i * stride + c * size, true);
        if (a.normalized && norm) v = Math.max(v * scale, -1);
        out[i * n + c] = v;
      }
    }
    if (a.sparse) {
      const sp = a.sparse, ib = json.bufferViews[sp.indices.bufferView], vb = json.bufferViews[sp.values.bufferView];
      const ibuf = buffers[ib.buffer], vbuf = buffers[vb.buffer];
      const idv = new DataView(ibuf.buffer, ibuf.byteOffset, ibuf.byteLength), vdv = new DataView(vbuf.buffer, vbuf.byteOffset, vbuf.byteLength);
      const [isz, iget] = GL_COMP[sp.indices.componentType];
      for (let k = 0; k < sp.count; k++) {
        const ti = idv[iget]((ib.byteOffset || 0) + (sp.indices.byteOffset || 0) + k * isz, true);
        for (let c = 0; c < n; c++) {
          let v = vdv[getter]((vb.byteOffset || 0) + (sp.values.byteOffset || 0) + (k * n + c) * size, true);
          if (a.normalized && norm) v = Math.max(v / norm, -1);
          out[ti * n + c] = v;
        }
      }
    }
    const r = { data: out, n, count: a.count };
    accCache.set(key, r);
    return r;
  };

  // images (decoded on demand)
  const imgCache = new Map();
  const loadImage = async (texIdx) => {
    const tex = (json.textures || [])[texIdx];
    if (!tex) return null;
    let src = tex.source;
    if (src === undefined && tex.extensions) {
      if (tex.extensions.KHR_texture_basisu) { msgs.push('KTX2/Basis textures can’t be decoded without a library, so those parts show their base colour.'); return null; }
      src = tex.extensions.EXT_texture_webp?.source ?? tex.extensions.EXT_texture_avif?.source;
    }
    if (src === undefined) return null;
    if (imgCache.has(src)) return imgCache.get(src);
    const im = json.images[src];
    let blob = null;
    if (im.bufferView !== undefined) {
      const bv = json.bufferViews[im.bufferView], b = buffers[bv.buffer];
      blob = new Blob([b.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)], { type: im.mimeType || 'image/png' });
    } else if (im.uri) {
      const du = dataUri(im.uri);
      if (du) blob = new Blob([du.bytes], { type: du.mime });
      else {
        const f = findFile(files, im.uri);
        if (f) blob = f;
        else msgs.push(`Texture “${decodeURIComponent(im.uri)}” wasn’t included, so that part shows its base colour. Drop it together with the .gltf to see it.`);
      }
    }
    const bmp = blob ? await bitmapFrom(blob) : null;
    imgCache.set(src, bmp);
    return bmp;
  };
  const materials = await Promise.all((json.materials || []).map(async m => {
    const pbr = m.pbrMetallicRoughness || {}, sg = m.extensions?.KHR_materials_pbrSpecularGlossiness;
    const cf = pbr.baseColorFactor || sg?.diffuseFactor || [1, 1, 1, 1];
    const ti = pbr.baseColorTexture?.index ?? sg?.diffuseTexture?.index;
    return {
      color: cf, texture: ti !== undefined ? await loadImage(ti) : null,
      alphaCutoff: m.alphaMode === 'MASK' ? (m.alphaCutoff ?? 0.5) : 0,
      metal: pbr.metallicFactor ?? 1, rough: pbr.roughnessFactor ?? 1, named: true,
    };
  }));
  const defaultMat = { color: [1, 1, 1, 1], texture: null, alphaCutoff: 0, named: false };

  // scene graph
  const nodeMat = n => {
    if (n.matrix) return new Float32Array(n.matrix);
    const t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
    return m4.mul(m4.fromQuat(r, t), m4.scale(s));
  };
  const submeshes = [];
  let skinned = false;
  const visit = (ni, parent) => {
    const n = json.nodes[ni], world = m4.mul(parent, nodeMat(n));
    if (n.mesh !== undefined) {
      const isSkin = n.skin !== undefined;
      if (isSkin) skinned = true;
      addMesh(json.meshes[n.mesh], isSkin ? m4.ident() : world);
    }
    for (const c of n.children || []) visit(c, world);
  };
  const addMesh = (mesh, world) => {
    const nm = m4.normalMat(world), det = m4det3(world);
    for (const prim of mesh.primitives) {
      const mode = prim.mode ?? 4;
      if (prim.extensions && (prim.extensions.KHR_draco_mesh_compression)) throw new FriendlyError('This model is Draco-compressed; re-export it without compression.');
      if (![4, 5, 6].includes(mode) || prim.attributes.POSITION === undefined) continue;
      const P = readAcc(prim.attributes.POSITION), count = P.count;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { const p = m4.point(world, [P.data[i * 3], P.data[i * 3 + 1], P.data[i * 3 + 2]]); positions.set(p, i * 3); }
      let normals = null;
      if (prim.attributes.NORMAL !== undefined) {
        const Nn = readAcc(prim.attributes.NORMAL); normals = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) normals.set(v3.norm(m4.dir(nm, [Nn.data[i * 3], Nn.data[i * 3 + 1], Nn.data[i * 3 + 2]])), i * 3);
      }
      const uvs = prim.attributes.TEXCOORD_0 !== undefined ? readAcc(prim.attributes.TEXCOORD_0).data : null;
      let colors = null;
      if (prim.attributes.COLOR_0 !== undefined) {
        const C = readAcc(prim.attributes.COLOR_0); colors = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
          // vertex colours are linear in glTF; store as sRGB so the 8-bit attribute keeps precision in darks
          for (let c = 0; c < 3; c++) colors[i * 4 + c] = Math.pow(Math.max(C.data[i * C.n + c], 0), 1 / 2.2);
          colors[i * 4 + 3] = C.n === 4 ? C.data[i * 4 + 3] : 1;
        }
      }
      let idx = prim.indices !== undefined ? readAcc(prim.indices, true).data : Uint32Array.from({ length: count }, (_, i) => i);
      if (mode === 5) { const o = []; for (let i = 0; i + 2 < idx.length; i++) i % 2 ? o.push(idx[i + 1], idx[i], idx[i + 2]) : o.push(idx[i], idx[i + 1], idx[i + 2]); idx = new Uint32Array(o); }
      if (mode === 6) { const o = []; for (let i = 1; i + 1 < idx.length; i++) o.push(idx[0], idx[i], idx[i + 1]); idx = new Uint32Array(o); }
      if (det < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      const mat = prim.material !== undefined ? materials[prim.material] : defaultMat;
      submeshes.push({ positions, normals, uvs, colors, indices: idx, material: mat, colorsAreSRGB: true });
    }
  };
  const scene = (json.scenes || [])[json.scene ?? 0];
  const roots = scene ? scene.nodes : (json.nodes || []).map((_, i) => i).filter(i => !(json.nodes || []).some(n => (n.children || []).includes(i)));
  for (const r of roots || []) visit(r, m4.ident());
  if (!json.nodes && json.meshes) for (const m of json.meshes) addMesh(m, m4.ident());
  if (skinned) msgs.push('This is a rigged (skinned) model, so it’s shown in its rest pose.');
  if (json.animations?.length && !skinned) msgs.push('Animations in this file aren’t played; the model is shown as posed.');
  return { submeshes };
}
function m4det3(m) { return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]); }

/* ---------------- OBJ ---------------- */
async function parseOBJ(text, files, msgs) {
  const V = [], VT = [], VN = [], VC = [];
  const groups = new Map();
  let cur = null, mtlFile = null, hasVC = false;
  const group = name => { if (!groups.has(name)) groups.set(name, { name, corners: [] }); return groups.get(name); };
  cur = group('');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const parts = line.split(/\s+/), tag = parts[0];
    if (tag === 'v') {
      V.push(+parts[1], +parts[2], +parts[3]);
      if (parts.length >= 7) { VC.push(+parts[4], +parts[5], +parts[6]); hasVC = true; } else VC.push(1, 1, 1);
    } else if (tag === 'vt') VT.push(+parts[1], +(parts[2] || 0));
    else if (tag === 'vn') VN.push(+parts[1], +parts[2], +parts[3]);
    else if (tag === 'f') {
      const ref = parts.slice(1).map(s => {
        const [a, b, c] = s.split('/');
        const fix = (x, n) => { if (!x) return -1; const i = parseInt(x, 10); return i < 0 ? n + i : i - 1; };
        return [fix(a, V.length / 3), fix(b, VT.length / 2), fix(c, VN.length / 3)];
      });
      for (let i = 1; i + 1 < ref.length; i++) cur.corners.push(ref[0], ref[i], ref[i + 1]);
    } else if (tag === 'usemtl') cur = group(parts.slice(1).join(' '));
    else if (tag === 'mtllib') mtlFile = parts.slice(1).join(' ');
  }
  // materials
  const mats = new Map();
  if (mtlFile) {
    const f = findFile(files, mtlFile);
    if (!f) msgs.push(`Materials file “${mtlFile}” wasn’t included, so the model uses one paint colour. Drop it with the .obj to keep its colours.`);
    else {
      let m = null;
      for (const raw of (await f.text()).split(/\r?\n/)) {
        const p = raw.trim().split(/\s+/);
        if (p[0] === 'newmtl') { m = { color: [1, 1, 1, 1], texFile: null, named: true }; mats.set(p.slice(1).join(' '), m); }
        else if (m && p[0] === 'Kd') m.color = [srgbToLin(+p[1]), srgbToLin(+p[2]), srgbToLin(+p[3]), 1];
        else if (m && p[0] === 'd') m.color[3] = +p[1];
        else if (m && p[0] === 'map_Kd') m.texFile = p[p.length - 1];
      }
      for (const [, mm] of mats) {
        mm.texture = null;
        if (mm.texFile) {
          const tf = findFile(files, mm.texFile);
          if (tf) mm.texture = await bitmapFrom(tf);
          else msgs.push(`Texture “${mm.texFile}” wasn’t included, so that part shows its base colour.`);
        }
      }
    }
  }
  const hasN = VN.length > 0, hasT = VT.length > 0;
  const submeshes = [];
  for (const g of groups.values()) {
    if (!g.corners.length) continue;
    const map = new Map(), pos = [], nrm = [], uv = [], col = [], idx = [];
    for (const [vi, ti, ni] of g.corners) {
      const key = vi + '/' + ti + '/' + ni;
      let k = map.get(key);
      if (k === undefined) {
        k = pos.length / 3; map.set(key, k);
        pos.push(V[vi * 3], V[vi * 3 + 1], V[vi * 3 + 2]);
        col.push(VC[vi * 3], VC[vi * 3 + 1], VC[vi * 3 + 2], 1);
        if (hasN) { if (ni >= 0) nrm.push(VN[ni * 3], VN[ni * 3 + 1], VN[ni * 3 + 2]); else nrm.push(0, 1, 0); }
        if (hasT) { if (ti >= 0) uv.push(VT[ti * 2], 1 - VT[ti * 2 + 1]); else uv.push(0, 0); }
      }
      idx.push(k);
    }
    const mat = mats.get(g.name) || { color: [1, 1, 1, 1], texture: null, named: false };
    submeshes.push({
      positions: new Float32Array(pos), normals: hasN ? new Float32Array(nrm) : null, uvs: hasT ? new Float32Array(uv) : null,
      colors: hasVC ? new Float32Array(col) : null, indices: new Uint32Array(idx), material: { alphaCutoff: 0, ...mat },
    });
  }
  return { submeshes };
}

/* ---------------- STL (Z-up → Y-up) ---------------- */
function parseSTL(buf, msgs) {
  const dv = new DataView(buf);
  let pos;
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (buf.byteLength >= 84 && 84 + n * 50 === buf.byteLength) {
    pos = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true);
    }
  } else {
    const text = new TextDecoder().decode(buf), out = [];
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    let m;
    while ((m = re.exec(text))) out.push(+m[1], +m[2], +m[3]);
    pos = new Float32Array(out);
  }
  for (let i = 0; i < pos.length; i += 3) { const y = pos[i + 1], z = pos[i + 2]; pos[i + 1] = z; pos[i + 2] = -y; }
  const idx = Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  void msgs;
  return { submeshes: [{ positions: pos, normals: null, uvs: null, colors: null, indices: idx, material: { color: [1, 1, 1, 1], texture: null, alphaCutoff: 0, named: false } }] };
}

/* ---------------- crease-preserving smooth normals ---------------- */
function creaseNormals(sm, creaseDeg = 30) {
  const P = sm.positions, I = sm.indices, nv = P.length / 3, nt = I.length / 3;
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], P[i * 3 + c]); mx[c] = Math.max(mx[c], P[i * 3 + c]); }
  const eps = (v3.len(v3.sub(mx, mn)) || 1) * 2e-6;
  const weld = new Int32Array(nv), map = new Map();
  let nw = 0;
  for (let i = 0; i < nv; i++) {
    const k = Math.round(P[i * 3] / eps) + ',' + Math.round(P[i * 3 + 1] / eps) + ',' + Math.round(P[i * 3 + 2] / eps);
    let w = map.get(k); if (w === undefined) { w = nw++; map.set(k, w); } weld[i] = w;
  }
  const fn = new Float32Array(nt * 3), fu = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const n = v3.cross(e1, e2), l = v3.len(n) || 1e-20;
    fn.set(n, t * 3); fu.set([n[0] / l, n[1] / l, n[2] / l], t * 3);
  }
  const cnt = new Uint32Array(nw + 1);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) cnt[weld[I[t * 3 + k]] + 1]++;
  for (let i = 0; i < nw; i++) cnt[i + 1] += cnt[i];
  const adj = new Uint32Array(nt * 3), fill = cnt.slice(0, nw);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) adj[fill[weld[I[t * 3 + k]]]++] = t;
  const cosC = Math.cos(creaseDeg * DEG);
  const outP = [], outN = [], outUV = [], outC = [], outI = new Uint32Array(nt * 3), dedup = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const vi = I[t * 3 + k], w = weld[vi];
    let nx = 0, ny = 0, nz = 0;
    for (let j = cnt[w]; j < cnt[w + 1]; j++) {
      const g = adj[j];
      if (fu[g * 3] * fu[t * 3] + fu[g * 3 + 1] * fu[t * 3 + 1] + fu[g * 3 + 2] * fu[t * 3 + 2] >= cosC) { nx += fn[g * 3]; ny += fn[g * 3 + 1]; nz += fn[g * 3 + 2]; }
    }
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const key = vi + ':' + Math.round(nx * 64) + ',' + Math.round(ny * 64) + ',' + Math.round(nz * 64);
    let o = dedup.get(key);
    if (o === undefined) {
      o = outP.length / 3; dedup.set(key, o);
      outP.push(P[vi * 3], P[vi * 3 + 1], P[vi * 3 + 2]); outN.push(nx, ny, nz);
      if (sm.uvs) outUV.push(sm.uvs[vi * 2], sm.uvs[vi * 2 + 1]);
      if (sm.colors) outC.push(sm.colors[vi * 4], sm.colors[vi * 4 + 1], sm.colors[vi * 4 + 2], sm.colors[vi * 4 + 3]);
    }
    outI[t * 3 + k] = o;
  }
  return {
    positions: new Float32Array(outP), normals: new Float32Array(outN), indices: outI,
    uvs: sm.uvs ? new Float32Array(outUV) : null, colors: sm.colors ? new Float32Array(outC) : null,
  };
}
