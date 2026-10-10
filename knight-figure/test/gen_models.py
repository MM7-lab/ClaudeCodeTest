import struct, zlib, json, math, os
OUT = os.path.join(os.path.dirname(__file__), 'models')

def png(w, h, fn):
    raw = b''.join(b'\x00' + bytes(sum((fn(x, y) for x in range(w)), ())) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

checker = png(64, 64, lambda x, y: (230, 80, 70, 255) if ((x // 8) + (y // 8)) % 2 else (250, 235, 200, 255))
stripes = png(32, 32, lambda x, y: (60, 120, 200, 255) if (y // 4) % 2 else (240, 240, 245, 255))

# --- a textured "toy rocket": lathe body with UVs (textured) + vertex-coloured fins ---
def lathe(profile, seg=48):
    P, N, UV, I = [], [], [], []
    for i, (r, y) in enumerate(profile):
        for j in range(seg + 1):
            a = j / seg * 2 * math.pi
            P += [r * math.cos(a), y, r * math.sin(a)]
            UV += [j / seg, i / (len(profile) - 1)]
    W = seg + 1
    for i in range(len(profile) - 1):
        for j in range(seg):
            a, b, c, d = i * W + j, i * W + j + 1, (i + 1) * W + j + 1, (i + 1) * W + j
            I += [a, c, b, a, d, c]
    return P, UV, I
prof = [(0.0001, 0), (0.5, 0.05), (0.62, 0.4), (0.65, 1.6), (0.55, 2.3), (0.3, 2.8), (0.0001, 3.1)]
P, UV, I = lathe(prof)
fins_P, fins_C, fins_I = [], [], []
for k in range(3):
    a = k * 2 * math.pi / 3; c, s = math.cos(a), math.sin(a)
    base = len(fins_P) // 3
    for (x, y) in [(0.5, 0.0), (1.2, -0.1), (0.6, 0.9)]:
        for zoff in (-0.04, 0.04):
            fins_P += [x * c - zoff * s, y, x * s + zoff * c]; fins_C += [0.2, 0.7, 0.4, 1.0]
    q = [base + i for i in range(6)]
    fins_I += [q[0], q[2], q[4], q[1], q[5], q[3], q[0], q[1], q[3], q[0], q[3], q[2], q[2], q[3], q[5], q[2], q[5], q[4], q[4], q[5], q[1], q[4], q[1], q[0]]

def glb(json_obj, binary):
    js = json.dumps(json_obj).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    binary += b'\x00' * ((4 - len(binary) % 4) % 4)
    return b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(binary)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(binary)) + b'BIN\x00' + binary

def build_gltf(extra_ext=None, external_bin=None):
    bufs, views, accs = b'', [], []
    def add(data, fmt, comp, typ, count, target=None, minmax=None):
        nonlocal bufs
        while len(bufs) % 4: bufs += b'\x00'
        off = len(bufs); raw = struct.pack('<' + fmt * len(data), *data); bufs += raw
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), **({'target': target} if target else {})})
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': count, 'type': typ}
        if minmax: a.update(minmax)
        accs.append(a); return len(accs) - 1
    xs, ys, zs = P[0::3], P[1::3], P[2::3]
    p0 = add(P, 'f', 5126, 'VEC3', len(P) // 3, 34962, {'min': [min(xs), min(ys), min(zs)], 'max': [max(xs), max(ys), max(zs)]})
    u0 = add(UV, 'f', 5126, 'VEC2', len(UV) // 2, 34962)
    i0 = add(I, 'H', 5123, 'SCALAR', len(I), 34963)
    fx, fy, fz = fins_P[0::3], fins_P[1::3], fins_P[2::3]
    p1 = add(fins_P, 'f', 5126, 'VEC3', len(fins_P) // 3, 34962, {'min': [min(fx), min(fy), min(fz)], 'max': [max(fx), max(fy), max(fz)]})
    c1 = add([int(v * 255) for v in fins_C], 'B', 5121, 'VEC4', len(fins_C) // 4, 34962); accs[c1]['normalized'] = True
    i1 = add(fins_I, 'H', 5123, 'SCALAR', len(fins_I), 34963)
    while len(bufs) % 4: bufs += b'\x00'
    img_off = len(bufs); bufs += checker
    views.append({'buffer': 0, 'byteOffset': img_off, 'byteLength': len(checker)})
    j = {
        'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'name': 'root', 'rotation': [0, 0, 0.0871557, 0.9961947], 'scale': [2, 2, 2], 'children': [1]}, {'mesh': 0, 'translation': [0, 0.1, 0]}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': p0, 'TEXCOORD_0': u0}, 'indices': i0, 'material': 0},
                                    {'attributes': {'POSITION': p1, 'COLOR_0': c1}, 'indices': i1, 'material': 1}]}],
        'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}, {'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1]}}],
        'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{}],
        'images': [{'bufferView': len(views) - 1, 'mimeType': 'image/png'}],
        'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bufs)}],
    }
    if extra_ext: j['extensionsUsed'] = [extra_ext]; j['extensionsRequired'] = [extra_ext]
    if external_bin: j['buffers'][0]['uri'] = external_bin
    return j, bufs

j, b = build_gltf(); open(os.path.join(OUT, 'rocket.glb'), 'wb').write(glb(j, b))
j, b = build_gltf('KHR_draco_mesh_compression'); open(os.path.join(OUT, 'draco.glb'), 'wb').write(glb(j, b))
j, b = build_gltf(external_bin='rocket_data.bin'); open(os.path.join(OUT, 'needsbin.gltf'), 'w').write(json.dumps(j))

# --- OBJ mushroom with MTL + texture, no normals ---
lines = ['mtllib shroom.mtl']
cap = [(0.0001, 1.9), (0.9, 1.75), (1.35, 1.35), (1.4, 1.15), (0.25, 1.1)]
stem = [(0.35, 0.0), (0.42, 0.15), (0.32, 0.8), (0.3, 1.15)]
vcount = 0
def lathe_obj(profile, mat, seg=32, tex=False):
    global vcount
    out = ['usemtl ' + mat]
    base = vcount
    for i, (r, y) in enumerate(profile):
        for j in range(seg):
            a = j / seg * 2 * math.pi
            out.append(f'v {r*math.cos(a):.4f} {y:.4f} {r*math.sin(a):.4f}')
            if tex: out.append(f'vt {j/seg:.4f} {i/(len(profile)-1):.4f}')
    for i in range(len(profile) - 1):
        for j in range(seg):
            a = base + i * seg + j + 1; b2 = base + i * seg + (j + 1) % seg + 1
            c = base + (i + 1) * seg + (j + 1) % seg + 1; d = base + (i + 1) * seg + j + 1
            if tex: out.append(f'f {a}/{a} {c}/{c} {b2}/{b2}'); out.append(f'f {a}/{a} {d}/{d} {c}/{c}')
            else: out.append(f'f {a} {c} {b2}'); out.append(f'f {a} {d} {c}')
    vcount += len(profile) * seg
    return out
lines += lathe_obj(cap, 'cap', tex=True)
lines += lathe_obj(stem, 'stem')
open(os.path.join(OUT, 'shroom.obj'), 'w').write('\n'.join(lines) + '\n')
open(os.path.join(OUT, 'shroom.mtl'), 'w').write('newmtl cap\nKd 1 1 1\nmap_Kd spots.png\nnewmtl stem\nKd 0.95 0.9 0.8\n')
open(os.path.join(OUT, 'spots.png'), 'wb').write(stripes)

# --- Binary STL, Z-up: a chess-rook-like turret ---
tris = []
def ring(r, z, seg=40): return [(r * math.cos(j / seg * 2 * math.pi), r * math.sin(j / seg * 2 * math.pi), z) for j in range(seg)]
prof = [(0.0001, 0), (1.0, 0), (1.0, 0.3), (0.7, 0.5), (0.55, 2.0), (0.8, 2.3), (0.8, 2.8), (0.0001, 2.8)]
rings = [ring(r, z) for r, z in prof]
for a, b in zip(rings, rings[1:]):
    n = len(a)
    for j in range(n):
        p0, p1, p2, p3 = a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]
        tris += [(p0, p1, p2), (p0, p2, p3)]
with open(os.path.join(OUT, 'rook_zup.stl'), 'wb') as f:
    f.write(b'rook'.ljust(80, b' ')); f.write(struct.pack('<I', len(tris)))
    for t in tris: f.write(struct.pack('<3f', 0, 0, 0)); [f.write(struct.pack('<3f', *v)) for v in t]; f.write(b'\x00\x00')
print(os.listdir(OUT))
