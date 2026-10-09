#!/usr/bin/env python3
"""社畜貓嘅一日：將三張靜態圖砌成一條有鏡頭推移、煙霧粒子同字幕嘅短片。

用法：python3 cat-animation/make_animation.py
輸出：cat-animation/shachu-cat.mp4（1080x1350，30fps，需要 ffmpeg）
"""
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "shachu-cat.mp4"
W, H, FPS = 1080, 1350, 30
DURATION = 22.0
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"


def font(size):
    return ImageFont.truetype(FONT, size)


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def lerp(a, b, k):
    return a + (b - a) * k


def ramp(t, t0, t1):
    """0 → 1 between t0 and t1."""
    return ease((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t0)


# ---------- 粒子（煙 / 蒸氣） ----------

def gaussian_sprite(n=96):
    y, x = np.mgrid[-1:1:n * 1j, -1:1:n * 1j]
    return np.exp(-(x * x + y * y) * 4.0).astype(np.float32)


SPRITE = gaussian_sprite()
_sprite_cache = {}


def sprite(d):
    d = max(4, int(d))
    if d not in _sprite_cache:
        im = Image.fromarray((SPRITE * 255).astype(np.uint8)).resize((d, d), Image.BILINEAR)
        _sprite_cache[d] = np.asarray(im, dtype=np.float32) / 255.0
    return _sprite_cache[d]


class Emitter:
    """喺來源圖座標 (x, y) 噴出粒子。burst=(週期, 噴氣秒數) 用嚟模擬呼氣。"""

    def __init__(self, seed, x, y, t0, t1, rate, life, speed, spread, size0, grow,
                 alpha, sway=12.0, drift=0.0, decel=0.0, burst=None, jitter=6.0):
        rng = np.random.default_rng(seed)
        self.parts = []
        t = t0
        while t < t1:
            t += rng.exponential(1.0 / rate)
            if burst:
                period, on = burst
                if ((t - t0) % period) > on:
                    continue
            self.parts.append(dict(
                ts=t,
                x=x + rng.uniform(-jitter, jitter),
                y=y + rng.uniform(-jitter * 0.5, jitter * 0.5),
                vx=drift + rng.normal(0, spread),
                vy=-speed * rng.uniform(0.75, 1.25),
                life=life * rng.uniform(0.7, 1.3),
                s0=size0 * rng.uniform(0.7, 1.3),
                grow=grow * rng.uniform(0.7, 1.3),
                a=alpha * rng.uniform(0.6, 1.0),
                ph=rng.uniform(0, 2 * math.pi),
                f=rng.uniform(0.25, 0.6),
                sway=sway * rng.uniform(0.6, 1.4),
            ))
        self.decel = decel

    def draw(self, acc, t, cam):
        for p in self.parts:
            age = t - p["ts"]
            if age < 0 or age > p["life"]:
                continue
            k = self.decel
            travel = (1 - math.exp(-k * age)) / k if k > 0 else age
            sx = p["x"] + p["vx"] * travel + p["sway"] * age ** 1.2 * math.sin(2 * math.pi * p["f"] * age + p["ph"])
            sy = p["y"] + p["vy"] * travel - 18 * age  # 煙會慢慢向上飄
            size = (p["s0"] + p["grow"] * age) * cam.scale
            u = age / p["life"]
            a = p["a"] * min(1.0, u / 0.12) * (1 - u) ** 1.6
            ox, oy = cam.to_out(sx, sy)
            stamp(acc, ox, oy, size, a)


def stamp(acc, cx, cy, d, a):
    spr = sprite(d)
    n = spr.shape[0]
    x0, y0 = int(cx - n / 2), int(cy - n / 2)
    x1, y1 = x0 + n, y0 + n
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        return
    sx0, sy0 = max(0, -x0), max(0, -y0)
    sx1, sy1 = n - max(0, x1 - W), n - max(0, y1 - H)
    acc[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] += spr[sy0:sy1, sx0:sx1] * a


def glow(frame, cx, cy, radius, color, strength):
    """喺 frame（float32 0..255）加一個發光點。"""
    r = int(radius * 3)
    x0, x1 = max(0, int(cx) - r), min(W, int(cx) + r)
    y0, y1 = max(0, int(cy) - r), min(H, int(cy) + r)
    if x0 >= x1 or y0 >= y1:
        return
    y, x = np.mgrid[y0:y1, x0:x1]
    g = np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * radius * radius)) * strength
    frame[y0:y1, x0:x1] += g[..., None] * np.array(color, dtype=np.float32)


# ---------- 鏡頭 ----------

class Cam:
    def __init__(self, cx, cy, w):
        self.cx, self.cy, self.w = cx, cy, w
        self.h = w * H / W
        self.scale = W / w

    def to_out(self, x, y):
        return (x - (self.cx - self.w / 2)) * self.scale, (y - (self.cy - self.h / 2)) * self.scale


class Scene:
    def __init__(self, img, t0, t1, cam_from, cam_to, emitters, extra=None):
        self.img = Image.open(HERE / "images" / img).convert("RGB")
        self.t0, self.t1 = t0, t1
        self.cam_from, self.cam_to = cam_from, cam_to
        self.emitters = emitters
        self.extra = extra

    def render(self, t):
        k = ease((t - self.t0) / (self.t1 - self.t0))
        cx, cy, cw = (lerp(a, b, k) for a, b in zip(self.cam_from, self.cam_to))
        # 輕微手持鏡頭晃動
        cx += 2.0 * math.sin(t * 1.3) + 1.2 * math.sin(t * 3.1)
        cy += 1.6 * math.cos(t * 1.1)
        cam = Cam(cx, cy, cw)
        box = (cx - cw / 2, cy - cam.h / 2, cx + cw / 2, cy + cam.h / 2)
        frame = np.asarray(self.img.transform((W, H), Image.EXTENT, box, Image.BICUBIC),
                           dtype=np.float32)
        acc = np.zeros((H, W), np.float32)
        for e in self.emitters:
            e.draw(acc, t, cam)
        a = np.clip(acc, 0, 0.8)[..., None]
        frame = frame * (1 - a) + np.array([232, 234, 238], np.float32) * a
        if self.extra:
            self.extra(frame, t, cam)
        return frame


def tip_glow(x, y, base):
    def fn(frame, t, cam):
        ox, oy = cam.to_out(x, y)
        pulse = base * (0.75 + 0.25 * math.sin(t * 2.4) + 0.1 * math.sin(t * 7.7))
        glow(frame, ox, oy, 5 * cam.scale, (255, 120, 30), pulse)
    return fn


def coffee_extra(frame, t, cam):
    # 咖啡機個燈圈一閃一閃
    ox, oy = cam.to_out(1052, 165)
    glow(frame, ox, oy, 26 * cam.scale, (120, 200, 255), 0.35 + 0.25 * math.sin(t * 3.0))


# 時間線（秒）
A0, A1 = 2.0, 7.6      # 返工飲咖啡
CARD0, CARD1 = 7.6, 9.0
B0, B1 = 9.0, 14.3     # 躺平食煙
C0, C1 = 13.6, 19.6    # 呼氣
END0 = 19.6

SCENES = {
    "A": Scene("1-coffee.jpg", A0, A1, (709, 902, 1418), (790, 690, 980), [
        Emitter(1, 855, 736, A0 - 3, A1, rate=26, life=3.0, speed=75, spread=8,
                size0=22, grow=34, alpha=0.30, sway=16, drift=32, jitter=35),
    ], coffee_extra),
    "B": Scene("2-lying.jpg", B0, B1, (565, 520, 640), (603, 660, 1050), [
        Emitter(2, 583, 476, B0 - 3, B1, rate=22, life=2.4, speed=95, spread=5,
                size0=8, grow=26, alpha=0.20, sway=10, jitter=2),
    ], tip_glow(583, 478, 0.9)),
    "C": Scene("3-exhale.jpg", C0, C1, (587, 700, 1100), (560, 560, 700), [
        Emitter(3, 498, 532, C0, C1, rate=70, life=2.2, speed=330, spread=30,
                size0=14, grow=55, alpha=0.16, sway=16, drift=25, decel=1.6,
                burst=(2.6, 0.9), jitter=5),
        Emitter(4, 707, 494, C0 - 3, C1, rate=18, life=2.2, speed=80, spread=4,
                size0=7, grow=20, alpha=0.18, sway=8, jitter=2),
    ], tip_glow(707, 497, 0.8)),
}

SUBS = [  # (開始, 結束, 字幕)
    (2.5, 4.9, "第三杯咖啡……"),
    (5.0, 7.4, "點解仲未醒……"),
    (9.5, 11.6, "一行出公司門口——"),
    (11.8, 13.9, "就地躺平。"),
    (14.4, 16.4, "呼——"),
    (16.6, 19.4, "聽日嘅事，聽日先算。"),
]
CLOCKS = [(A0, A1, "09:00"), (B0, B1 - 0.4, "18:31"), (C0 + 0.4, C1, "18:45")]


# ---------- 文字 ----------

def text_layer(draw_fn):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    return layer


def blend_layer(img, layer, opacity):
    if opacity <= 0:
        return img
    if opacity < 1:
        a = layer.getchannel("A").point(lambda v: int(v * opacity))
        layer.putalpha(a)
    return Image.alpha_composite(img, layer)


def typed(text, t, t0, cps=12):
    return text[:max(0, int((t - t0) * cps) + 1)]


def centered(d, y, text, f, fill, stroke=0):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0, 220))


def overlay_text(img, t):
    f_sub = font(62)
    for s0, s1, text in SUBS:
        if s0 <= t <= s1:
            op = ramp(t, s0, s0 + 0.2) * (1 - ramp(t, s1 - 0.3, s1))
            shown = typed(text, t, s0)
            img = blend_layer(img, text_layer(
                lambda d: centered(d, H - 190, shown, f_sub, (255, 255, 255, 255), stroke=5)), op)
    f_clock, f_small = font(44), font(26)
    for c0, c1, clock in CLOCKS:
        if c0 <= t <= c1:
            op = ramp(t, c0 + 0.2, c0 + 0.6) * (1 - ramp(t, c1 - 0.4, c1))

            def draw_clock(d, clock=clock):
                d.rounded_rectangle((44, 44, 230, 116), 18, fill=(0, 0, 0, 150))
                d.ellipse((66, 72, 82, 88), fill=(255, 70, 60, 255) if int(t * 2) % 2 == 0 else (120, 30, 30, 255))
                d.text((96, 56), clock, font=f_clock, fill=(255, 255, 255, 255))
            img = blend_layer(img, text_layer(draw_clock), op)
    # AI 生成標示（全片保留）
    img = blend_layer(img, text_layer(
        lambda d: d.text((W - 210, H - 56), "內容由 AI 生成", font=f_small, fill=(255, 255, 255, 170),
                         stroke_width=2, stroke_fill=(0, 0, 0, 120))), 1.0)
    return img


def black_card(t, lines):
    """純黑底文字卡。lines = [(開始, 文字, 字號, y, 顏色)]"""
    img = Image.new("RGBA", (W, H), (12, 12, 14, 255))
    for t0, text, size, y, color in lines:
        if t >= t0:
            shown = typed(text, t, t0, cps=10)
            img = blend_layer(img, text_layer(
                lambda d: centered(d, y, shown, font(size), color)), ramp(t, t0, t0 + 0.3))
    return img


# ---------- 合成 ----------

def vignette():
    y, x = np.mgrid[0:H, 0:W]
    r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    return (1 - 0.38 * np.clip(r - 0.55, 0, 1) ** 1.5)[..., None].astype(np.float32)


VIG = vignette()
RNG = np.random.default_rng(7)


def finish(frame):
    frame = frame * VIG + RNG.normal(0, 2.0, (H, W, 1)).astype(np.float32)
    return Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8)).convert("RGBA")


def frame_at(t):
    if t < A0:  # 開場標題
        img = black_card(t, [
            (0.3, "社畜貓嘅一日", 96, 560, (255, 255, 255, 255)),
            (1.1, "A Day in the Life of an Office Cat", 34, 690, (180, 180, 185, 255)),
        ])
        fade = ramp(t, 0, 0.3) * (1 - ramp(t, A0 - 0.3, A0))
        return dim(img, fade)
    if t < CARD0:
        img = overlay_text(finish(SCENES["A"].render(t)), t)
        return dim(img, ramp(t, A0, A0 + 0.5) * (1 - ramp(t, A1 - 0.4, A1)))
    if t < CARD1:
        img = black_card(t, [(CARD0 + 0.2, "18:30　收工", 88, 600, (255, 210, 120, 255))])
        return dim(img, 1 - ramp(t, CARD1 - 0.3, CARD1))
    if t < C0:
        img = overlay_text(finish(SCENES["B"].render(t)), t)
        return dim(img, ramp(t, B0, B0 + 0.4))
    if t < B1:  # B → C 交叉淡入
        k = ramp(t, C0, B1)
        fb = SCENES["B"].render(t) * (1 - k) + SCENES["C"].render(t) * k
        return overlay_text(finish(fb), t)
    if t < END0:
        img = overlay_text(finish(SCENES["C"].render(t)), t)
        return dim(img, 1 - ramp(t, END0 - 0.5, END0))
    img = black_card(t, [
        (END0 + 0.2, "辛苦晒，打工仔", 88, 560, (255, 255, 255, 255)),
        (END0 + 1.2, "今日都要好好休息", 40, 690, (190, 190, 195, 255)),
    ])
    return dim(img, 1 - ramp(t, DURATION - 0.5, DURATION))


def dim(img, k):
    if k >= 1:
        return img
    return Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 255)), img, max(0.0, k))


def main():
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", str(OUT)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(DURATION * FPS)
    for i in range(n):
        proc.stdin.write(frame_at(i / FPS).convert("RGB").tobytes())
        if i % 60 == 0:
            print(f"{i}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("done:", OUT)


if __name__ == "__main__":
    main()
