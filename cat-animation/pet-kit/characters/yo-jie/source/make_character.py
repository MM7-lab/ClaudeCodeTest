"""Build Yo 姐 from her model sheet (sheet/yo0.jpg … yo7.jpg) and write ../character.svg.html.

    python3 make_character.py          (needs: pip install opencv-python-headless numpy pillow)

The sheet was generated from one prompt, so every full-body image has the same scale and the same floor line:
    yo0  standing, arms down          -> her body; the head is cut out so it can nod and tilt
    yo1  five expressions             -> faces laid over yo0's face (aligned automatically by the hair and eyes)
    yo3  waving    yo4  drinking    yo5  laptop    yo6  presenting    yo7  hooray jump
                                      -> whole figures, faded in by rig.js for those moves
(yo2, the cut-out arm parts, is kept for later.) Coordinates below are pixels in the sheet images.
"""
import base64, io, json, os
import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sheet = [cv2.imread(os.path.join(HERE, "sheet", f"yo{n}.jpg")) for n in range(8)]
H, W = sheet[0].shape[:2]

def border_labels(lab):
    return list(set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0})

def figure_mask(img):
    """Everything that is not the white background, as 0/1."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    barrier = cv2.dilate((gray < 170).astype(np.uint8), np.ones((3, 3), np.uint8))
    paper = ((gray > 232) & (hsv[..., 1] < 25)).astype(np.uint8)
    _, lab = cv2.connectedComponents(((paper == 1) & (barrier == 0)).astype(np.uint8), connectivity=4)
    fg = (~np.isin(lab, border_labels(lab))).astype(np.uint8)
    inv = (1 - fg).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    outside = set(border_labels(lab))
    for i in range(1, n):                                            # fill small holes, keep real gaps (arm and body)
        if i not in outside and st[i, cv2.CC_STAT_AREA] < 2500:
            fg[lab == i] = 1
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    keep = np.zeros_like(fg)
    if n > 1:
        big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        for i in range(1, n):
            if i == big or st[i, cv2.CC_STAT_AREA] > 4000:
                keep[lab == i] = 1
    return keep

def poly(points):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(points, np.int32)], 1)
    return m

# ---------- canvas placement: 600 × 630, her feet on y = 586 ----------
K = 0.224                                                            # 2320 px tall in the sheet -> 520
FEET_Y, CENTER_X = 2470, 828
def feet_center(mask):
    ys, xs = np.nonzero(mask[FEET_Y - 140:FEET_Y + 20])
    return float(xs.mean()) if len(xs) else CENTER_X
def to_canvas(x, y, dx=0.0):
    return (304 + (x + dx - CENTER_X) * K, 586 + (y - FEET_Y) * K)
def pt(x, y, dx=0.0):
    return [round(v, 1) for v in to_canvas(x, y, dx)]

OUT_SCALE = 0.42                                                     # stored pixels per sheet pixel (about 2x the canvas)
def encode_rgba(rgba, x0, y0, dx=0.0, hit=None):
    """An <image> of rgba (whose top-left is sheet pixel x0, y0) placed on the canvas, plus an optional hit outline."""
    h, w = rgba.shape[:2]
    im = Image.fromarray(rgba, "RGBA").resize((max(1, round(w * OUT_SCALE)), max(1, round(h * OUT_SCALE))), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "WEBP", quality=88, method=6)
    cx, cy = to_canvas(x0, y0, dx)
    href = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    out = f'<image href="{href}" x="{cx:.1f}" y="{cy:.1f}" width="{w * K:.1f}" height="{h * K:.1f}" preserveAspectRatio="none" pointer-events="none" />'
    if hit is not None:
        cs, _ = cv2.findContours(hit.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = cv2.approxPolyDP(max(cs, key=cv2.contourArea), 6, True)[:, 0, :]
        out += '<polygon points="' + " ".join("%.1f,%.1f" % to_canvas(x + x0, y + y0, dx) for x, y in c) + '" fill="transparent" />'
    return out

def encode_mask(img, mask, dx=0.0):
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    alpha = cv2.GaussianBlur(mask[y0:y1, x0:x1].astype(np.float32), (3, 3), 0.8)
    rgba = np.dstack([cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2RGB), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    return encode_rgba(rgba, x0, y0, dx, hit=mask[y0:y1, x0:x1])

# ---------- yo0: body and head ----------
base = figure_mask(sheet[0])
head_poly = poly([(540, 40), (1130, 40), (1130, 560), (985, 575), (930, 606), (885, 628), (795, 628), (752, 606), (735, 575), (700, 560), (540, 560)])
head = base & head_poly
# the head's neck fades out at the bottom so the seam with the body never shows when she nods
fade = np.ones((H, W), np.float32); fade[590:630] = np.linspace(1, 0, 40)[:, None]; fade[630:] = 0
upper_only = poly([(540, 40), (1130, 40), (1130, 560), (985, 575), (930, 590), (750, 590), (735, 575), (700, 560), (540, 560)])
body = base & (1 - upper_only)

def head_rgba():
    ys, xs = np.nonzero(head)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    a = cv2.GaussianBlur(head[y0:y1, x0:x1].astype(np.float32), (3, 3), 0.8) * fade[y0:y1, x0:x1]
    rgba = np.dstack([cv2.cvtColor(sheet[0][y0:y1, x0:x1], cv2.COLOR_BGR2RGB), (np.clip(a, 0, 1) * 255).astype(np.uint8)])
    return rgba, x0, y0, (head & upper_only)[y0:y1, x0:x1]

# ---------- yo1: faces, aligned onto yo0's face ----------
FACES = {   # name: (upper part used for matching: hair and eyes, x0, y0, x1, y1)
    "smile": (80, 80, 640, 470), "calm": (960, 80, 1520, 470), "closed": (520, 850, 1080, 1250),
    "happy": (90, 1640, 650, 2030), "sleepy": (960, 1640, 1520, 2030),
}
SEARCH = (540, 60, 1140, 700)
FACE_C, FACE_R = (838, 448), (168, 142)                              # the part of the face that is swapped (under the bangs, to the chin)
def edges(gray):
    return cv2.GaussianBlur(cv2.Canny(gray, 60, 140), (0, 0), 2.0)
g0 = cv2.cvtColor(sheet[0], cv2.COLOR_BGR2GRAY); g1 = cv2.cvtColor(sheet[1], cv2.COLOR_BGR2GRAY)
search = edges(g0[SEARCH[1]:SEARCH[3], SEARCH[0]:SEARCH[2]])
yy, xx = np.mgrid[0:H, 0:W]
ell = (((xx - FACE_C[0]) / FACE_R[0]) ** 2 + ((yy - FACE_C[1]) / FACE_R[1]) ** 2 <= 1).astype(np.float32)
ell = cv2.GaussianBlur(ell, (0, 0), 7)
faces = {}
for name, (x0, y0, x1, y1) in FACES.items():
    tmpl_full = edges(g1[y0:y1, x0:x1])
    best = (-1, 0, 0, 0)
    for s in np.arange(0.80, 1.00, 0.003):
        t = cv2.resize(tmpl_full, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if t.shape[0] >= search.shape[0] or t.shape[1] >= search.shape[1]:
            continue
        r = cv2.matchTemplate(search, t, cv2.TM_CCOEFF_NORMED)
        _, v, _, loc = cv2.minMaxLoc(r)
        if v > best[0]:
            best = (v, s, loc[0], loc[1])
    v, s, tx, ty = best
    # sheet1 point p -> sheet0 point (p - (x0, y0)) * s + SEARCH origin + (tx, ty)
    M = np.float32([[s, 0, SEARCH[0] + tx - x0 * s], [0, s, SEARCH[1] + ty - y0 * s]])
    warped = cv2.warpAffine(sheet[1], M, (W, H), flags=cv2.INTER_AREA, borderValue=(255, 255, 255))
    fm = figure_mask(warped).astype(np.float32)
    a = ell * fm
    bx0, by0, bx1, by1 = FACE_C[0] - FACE_R[0] - 30, FACE_C[1] - FACE_R[1] - 30, FACE_C[0] + FACE_R[0] + 30, FACE_C[1] + FACE_R[1] + 30
    rgba = np.dstack([cv2.cvtColor(warped[by0:by1, bx0:bx1], cv2.COLOR_BGR2RGB), (np.clip(a[by0:by1, bx0:bx1], 0, 1) * 255).astype(np.uint8)])
    faces[name] = encode_rgba(rgba, bx0, by0)
    print(f"face {name}: match {v:.3f} scale {s:.3f}")

# ---------- whole figures ----------
FIGS = {"wave": 3, "cocoa": 4, "code": 5, "clock": 6, "jump": 7}
base_feet = feet_center(base)
figs, fig_dx = {}, {}
for name, n in FIGS.items():
    m = figure_mask(sheet[n])
    dx = 0.0 if name == "jump" else base_feet - feet_center(m)       # stand where yo0 stands
    fig_dx[name] = dx
    figs[name] = encode_mask(sheet[n], m, dx)

# ---------- joints on the canvas (for rig.js) ----------
joints = {
    "head": pt(838, 600), "eyeL": pt(758, 380), "eyeR": pt(918, 378), "mouth": pt(838, 500),
    "earL": pt(700, 478), "earR": pt(978, 480), "strand": pt(992, 515), "neck": pt(838, 640),
    "button": pt(838, 1100), "braid": pt(510, 1010), "handL": pt(560, 1330), "handR": pt(1110, 1330),
    "palm": pt(1448, 786, fig_dx["clock"]), "mug": pt(848, 600, fig_dx["cocoa"]), "laptop": pt(1000, 1060, fig_dx["code"]),
    "waveHand": pt(1450, 520, fig_dx["wave"]), "hairTop": pt(838, 150),
}
json.dump(joints, open(os.path.join(HERE, "joints.json"), "w"), indent=1)

J = joints
hrgba, hx0, hy0, hhit = head_rgba()
head_img = encode_rgba(hrgba, hx0, hy0, hit=hhit)
def hp(name):
    return f'translate({J[name][0]}, {J[name][1]})'
ex, ey = J["eyeL"]; fx, fy = J["eyeR"]

svg = f'''                <svg id="character-svg" viewBox="0 0 600 630" class="w-full h-auto max-w-[500px] max-h-[500px] z-10 select-none overflow-visible my-auto" data-joints='{json.dumps(joints)}'>
                    <!-- Yo 姐: built from source/sheet/*.jpg by source/make_character.py (edit the script, not this file) -->
                    <defs><filter id="yo-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" /></filter></defs>
                    <ellipse id="rig-shadow" cx="304" cy="586" rx="186" ry="24" fill="#dfdbd0" transform="translate(304 586) scale(0.5 0.55) translate(-304 -586)" />
                    <g id="rig-root" transform="translate(304, 586)">
                        <g transform="translate(-304, -586)">
                        <g id="yo-base">
                            <g id="rig-tail" class="hotspot" transform="{hp("braid")}"><g transform="translate({-J["braid"][0]}, {-J["braid"][1]})"><rect x="{J["braid"][0] - 14:.1f}" y="{J["braid"][1] - 26:.1f}" width="28" height="52" fill="transparent" /></g></g>
                            <g id="rig-torso">{encode_mask(sheet[0], body)}
                                <g id="rig-belly-content" transform="translate(0, 0)">
                                    <g id="rig-zipper" transform="{hp("neck")}"></g>
                                    <g id="rig-belly-bear" class="hotspot" transform="{hp("button")}">
                                        <g id="belly-eyes-open"><circle r="6" fill="transparent" /></g>
                                        <g id="belly-eyes-wink" class="hidden"><circle r="6" fill="transparent" /><path d="M 0 -8 Q 0.8 -0.8 8 0 Q 0.8 0.8 0 8 Q -0.8 0.8 -8 0 Q -0.8 -0.8 0 -8 Z" fill="#fff8d6" stroke="#f4b400" stroke-width="1.2" /></g>
                                    </g>
                                </g>
                            </g>
                            <g id="rig-leg-left" class="hotspot"><g id="rig-foot-left"></g><rect x="{J["button"][0] - 34:.1f}" y="{J["button"][1] + 40:.1f}" width="68" height="{586 - J["button"][1] - 40:.1f}" fill="transparent" /></g>
                            <g id="rig-leg-right" class="hotspot"><g id="rig-foot-right"></g></g>
                            <g id="prop-laptop" class="hidden"></g>
                            <g id="rig-arm-left">
                                <path id="sleeve-left-fill" class="hidden" d="M 0 0" /><path id="sleeve-left-outer" class="hidden" d="M 0 0" /><path id="sleeve-left-inner" class="hidden" d="M 0 0" /><path id="sleeve-left-crease" class="hidden" d="M 0 0" />
                                <g id="rig-paw-left" transform="{hp("handL")}"></g>
                            </g>
                            <g id="rig-head" transform="{hp("head")}">
                                <g transform="translate({-J["head"][0]}, {-J["head"][1]})">
                                    {head_img}
                                    <g id="face-blush" opacity="0">
                                        <ellipse cx="{ex - 2:.1f}" cy="{ey + 11:.1f}" rx="7" ry="3.6" fill="#f0817a" opacity="0.4" filter="url(#yo-soft)" />
                                        <ellipse cx="{fx + 2:.1f}" cy="{fy + 11:.1f}" rx="7" ry="3.6" fill="#f0817a" opacity="0.4" filter="url(#yo-soft)" />
                                    </g>
                                    <!-- expressions from the sheet, laid over her face (later ones win) -->
                                    <g id="rig-mouth" transform="translate(0, 0)">
                                        <g id="mouth-deadpan"></g><g id="mouth-cat" class="hidden"></g>
                                        <g id="mouth-smile" class="hidden">{faces["smile"]}</g>
                                    </g>
                                    <g id="rig-eyes" transform="translate(0, 0)"></g>
                                    <g id="eyes-open"></g>
                                    <g id="eyes-closed" class="hidden">{faces["closed"]}</g>
                                    <g id="mouth-o" class="hidden">{faces["sleepy"]}</g>
                                    <g id="eyes-happy" class="hidden">{faces["happy"]}</g>
                                    <g id="rig-ear-left" class="hotspot" transform="{hp("earL")}"><g transform="translate({-J["earL"][0]}, {-J["earL"][1]})"><circle cx="{J["earL"][0]}" cy="{J["earL"][1]}" r="4" fill="transparent" /></g></g>
                                    <g id="rig-ear-right" class="hotspot" transform="{hp("earR")}"><g transform="translate({-J["earR"][0]}, {-J["earR"][1]})"><circle cx="{J["earR"][0]}" cy="{J["earR"][1]}" r="4" fill="transparent" /></g></g>
                                    <g id="rig-glasses" class="hotspot" transform="translate(0, 0)">
                                        <rect x="{J["strand"][0] - 4:.1f}" y="{J["strand"][1] - 14:.1f}" width="8" height="28" fill="transparent" />
                                        <g id="glasses-shine" opacity="0"><path d="M {J["strand"][0] + 8:.1f} {J["strand"][1] - 24:.1f} q 1 7 8 8 q -7 1 -8 8 q -1 -7 -8 -8 q 7 -1 8 -8 Z" fill="#ffffff" stroke="#fbbf24" stroke-width="1.2" /></g>
                                    </g>
                                    <g id="prop-headphones" class="hidden">
                                        <path d="M {J["earL"][0] - 4:.1f} {J["earL"][1] - 12:.1f} C {J["earL"][0] - 8:.1f} {J["hairTop"][1] - 28:.1f}, {J["earR"][0] + 8:.1f} {J["hairTop"][1] - 28:.1f}, {J["earR"][0] + 4:.1f} {J["earR"][1] - 12:.1f}" fill="none" stroke="#3f3f46" stroke-width="6" stroke-linecap="round" />
                                        <path d="M {J["earL"][0] - 4:.1f} {J["earL"][1] - 12:.1f} C {J["earL"][0] - 8:.1f} {J["hairTop"][1] - 28:.1f}, {J["earR"][0] + 8:.1f} {J["hairTop"][1] - 28:.1f}, {J["earR"][0] + 4:.1f} {J["earR"][1] - 12:.1f}" fill="none" stroke="#2b1c17" stroke-width="2.2" stroke-linecap="round" />
                                        <rect x="{J["earL"][0] - 11:.1f}" y="{J["earL"][1] - 26:.1f}" width="12" height="24" rx="6" fill="#e07a5f" stroke="#2b1c17" stroke-width="2.2" />
                                        <rect x="{J["earR"][0] - 1:.1f}" y="{J["earR"][1] - 26:.1f}" width="12" height="24" rx="6" fill="#e07a5f" stroke="#2b1c17" stroke-width="2.2" />
                                    </g>
                                </g>
                            </g>
                            <g id="rig-arm-right">
                                <path id="sleeve-right-fill" class="hidden" d="M 0 0" /><path id="sleeve-right-shadow" class="hidden" d="M 0 0" /><path id="sleeve-right-upper" class="hidden" d="M 0 0" /><path id="sleeve-right-lower" class="hidden" d="M 0 0" /><path id="sleeve-right-crease" class="hidden" d="M 0 0" />
                                <g id="rig-paw-right" transform="{hp("handR")}"><g id="prop-mug" class="hidden"></g></g>
                            </g>
                        </g>
                        <!-- whole figures from the sheet, faded in by rig.js -->
''' + "".join(f'                        <g id="yo-fig-{name}" class="hidden" opacity="0">{figs[name]}</g>\n' for name in FIGS) + '''                        <g id="particles-layer" pointer-events="none"></g>
                        </g>
                    </g>
                </svg>
'''
open(os.path.join(HERE, "..", "character.svg.html"), "w", encoding="utf-8").write(svg)
print("character.svg.html", len(svg), "bytes")
print(json.dumps(joints))
