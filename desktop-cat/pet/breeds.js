// Cat and dog breeds (品種): body shape and colours for the animal model in cat.js.
// Every field is optional; anything missing falls back to CLASSIC (the original cat).
//
// size     overall scale next to the main cat   len/fat  body length / girth
// legK     leg length                           head     head scale; headShape stretches it (x, y, z)
// ears     cat | small | big | fold | pointy | bat | floppy   (earK scales them)
// snout    0 for a cat's face; a dog's muzzle length   flat  shorter, rounder cat face
// fluff    0..1 long fur: a ruff, a fuller body and tail   tail  { n, r, lift, curl, stub }
// colours  fur, belly, inner (ears), eye, line (outline), stripe (tabby), point (ears, face,
//          legs, tail of a colourpoint), mask (muzzle), saddle (back), nose, paw
export const CLASSIC = {
  kind: 'cat', size: 1, len: 1, fat: 1, legK: 1, head: 1, headShape: [1, 1, 1],
  ears: 'cat', earK: 1, snout: 0, flat: 0, fluff: 0,
  tail: { n: 9, r: 5.6, lift: 0, curl: 0, taper: 0.032 },
  pointLegs: false,
};

export const BREEDS = {
  // ---------- cats ----------
  persian: { label: '波斯貓', kind: 'cat', size: 1.05, fat: 1.1, legK: 0.85, head: 1.08, headShape: [0.92, 1, 1.12],
    ears: 'small', flat: 1, fluff: 1, tail: { n: 9, r: 8.5 },
    fur: 0xfaf4ea, belly: 0xffffff, inner: 0xffc9cf, eye: 0xd9822b, line: 0x6b5a4c, nose: 0xffa3b4 },
  british: { label: '英國短毛貓', kind: 'cat', size: 1.05, fat: 1.15, legK: 0.9, head: 1.08, headShape: [0.95, 1, 1.15],
    ears: 'small', flat: 0.5, tail: { n: 8, r: 6.6 },
    fur: 0x8d98a8, belly: 0x9ea8b6, inner: 0xc9a2ad, eye: 0xe59a2e, line: 0x2e343d, nose: 0x6f7886 },
  american: { label: '美國短毛貓', kind: 'cat', size: 1, fat: 1.05,
    fur: 0xc9ccd1, stripe: 0x4d525a, belly: 0xf1f2f4, inner: 0xf2b5bf, eye: 0x7fb54a, line: 0x2c3036 },
  ragdoll: { label: '布偶貓', kind: 'cat', size: 1.15, fat: 1.05, fluff: 0.7, tail: { n: 9, r: 7.6 },
    fur: 0xf6eee0, belly: 0xffffff, point: 0x6e584a, inner: 0xd9a7a6, eye: 0x4f9be6, line: 0x5b4a3e, paw: 0xffffff },
  siamese: { label: '暹羅貓', kind: 'cat', size: 0.95, len: 1.08, fat: 0.85, legK: 1.08, head: 0.95, headShape: [1.08, 0.95, 0.9],
    ears: 'big', tail: { n: 10, r: 4.2 }, pointLegs: true,
    fur: 0xf1e5cf, belly: 0xf8f0e2, point: 0x3f2d23, inner: 0x7a5546, eye: 0x4aa3f0, line: 0x2d211a },
  fold: { label: '蘇格蘭摺耳貓', kind: 'cat', size: 1, fat: 1.08, head: 1.06, headShape: [0.96, 1, 1.1],
    ears: 'fold', flat: 0.4, tail: { n: 9, r: 6.2 },
    fur: 0xf0d6aa, stripe: 0xd9a663, belly: 0xfff6e8, inner: 0xf3b4a8, eye: 0xd98a26, line: 0x5a4330 },
  // ---------- dogs ----------
  labrador: { label: '拉布拉多', kind: 'dog', size: 1.4, len: 1.1, fat: 1.05, legK: 1.1, head: 1, headShape: [1, 0.95, 0.95],
    ears: 'floppy', earK: 1, snout: 15, tail: { n: 8, r: 6.4, lift: 1.15, curl: -0.12, taper: 0.06 },
    fur: 0xecc98c, belly: 0xf4dcae, inner: 0xd9ad6a, eye: 0x4a2e18, line: 0x5a4126, nose: 0x3a2a22 },
  golden: { label: '黃金獵犬', kind: 'dog', size: 1.4, len: 1.1, legK: 1.1, head: 1, headShape: [1, 0.95, 0.95],
    ears: 'floppy', earK: 1.05, snout: 15, fluff: 0.7, tail: { n: 9, r: 7.2, lift: 1.05, curl: -0.12, taper: 0.05 },
    fur: 0xdfa24c, belly: 0xf0c27e, inner: 0xc98a3a, eye: 0x3e2614, line: 0x5a3a18, nose: 0x2e211b },
  frenchie: { label: '法國鬥牛犬', kind: 'dog', size: 0.9, len: 0.9, fat: 1.1, legK: 0.7, head: 1.12, headShape: [0.95, 1, 1.1],
    ears: 'bat', snout: 5, tail: { n: 2, r: 5, stub: true },
    fur: 0xe2b886, belly: 0xf1d6b0, mask: 0x3a2c26, inner: 0xd99a8f, eye: 0x2b1a12, line: 0x3e2c20, nose: 0x241a16 },
  shepherd: { label: '德國牧羊犬', kind: 'dog', size: 1.45, len: 1.15, legK: 1.12, head: 1, headShape: [1.05, 0.95, 0.9],
    ears: 'pointy', earK: 1.15, snout: 18, fluff: 0.3, tail: { n: 9, r: 6.8, lift: 1.45, curl: -0.14, taper: 0.05 },
    fur: 0xc98a45, belly: 0xdcab6e, saddle: 0x2b2420, mask: 0x2b2420, inner: 0x3a302a, eye: 0x4a2c14, line: 0x2b2018, nose: 0x1f1a17 },
  dachshund: { label: '臘腸犬', kind: 'dog', size: 0.9, len: 1.55, fat: 0.78, legK: 0.45, head: 0.95, headShape: [1.05, 0.95, 0.92],
    ears: 'floppy', earK: 1.2, snout: 17, tail: { n: 8, r: 4.6, lift: 1.0, curl: -0.12, taper: 0.06 },
    fur: 0xa1532a, belly: 0xb8693a, inner: 0x7d3c1c, eye: 0x2e1a10, line: 0x40200f, nose: 0x241712 },
  pomeranian: { label: '博美犬', kind: 'dog', size: 0.65, len: 0.85, fat: 1.05, legK: 0.85, head: 1.05,
    ears: 'pointy', earK: 0.8, snout: 7, fluff: 1, tail: { n: 7, r: 8.5, lift: -0.35, curl: -0.55, taper: 0.03 },
    fur: 0xf2a443, belly: 0xffd59a, inner: 0xe58a5a, eye: 0x2b1a10, line: 0x6a3f14, nose: 0x241a16 },
  chihuahua: { label: '吉娃娃', kind: 'dog', size: 0.55, len: 0.9, fat: 0.85, legK: 0.95, head: 1.25, headShape: [0.9, 1.05, 1.05],
    ears: 'big', earK: 1.3, snout: 6, tail: { n: 8, r: 3.6, lift: -0.15, curl: -0.38, taper: 0.04 },
    fur: 0xe8bb84, belly: 0xf6dcb6, inner: 0xf2a59a, eye: 0x2a1a10, line: 0x5a3c22, nose: 0x3a2a24 },
};
export const CAT_BREEDS = Object.keys(BREEDS).filter(k => BREEDS[k].kind === 'cat');
export const DOG_BREEDS = Object.keys(BREEDS).filter(k => BREEDS[k].kind === 'dog');
