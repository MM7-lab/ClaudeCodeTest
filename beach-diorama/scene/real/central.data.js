// Central, Hong Kong Island: a hand-made, simplified layout drawn by eye from two aerial screenshots
// (not measured, and not a trace of OpenStreetMap data). Streets, blocks and tower positions are
// only roughly in the right places; storeys are estimated. Coordinates are reference pixels in a
// 923 x 923 square (x east, y south), about 1.6 m per pixel (an estimate). North is up: the
// harbour is at the bottom, the wooded Peak hillside at the top.
export default {
  id: 'central',
  name: 'Central',
  size: 923,
  origin: [0, 0],
  metresPerPixel: 1.6,

  // Victoria Harbour (bottom). The edges along the map border lie outside the square.
  water: [[0, 748], [60, 744], [180, 738], [300, 732], [380, 736], [440, 742], [520, 730], [620, 726], [720, 736], [820, 746], [923, 756], [923, 923], [0, 923]],
  // Red-brown harbourfront paving between the coast road and the water.
  promenadeColor: '#b9694e',
  promenade: [[0, 684], [200, 680], [400, 682], [640, 680], [923, 690], [923, 758], [820, 748], [720, 738], [620, 728], [520, 732], [440, 744], [380, 738], [300, 734], [180, 740], [60, 746], [0, 750]],

  roads: [
    { name: '干諾道中', kind: 'major', width: 28, pts: [[0, 652], [200, 644], [400, 638], [600, 636], [800, 644], [923, 656]] },
    { name: '德輔道中', kind: 'major', width: 20, pts: [[0, 560], [250, 552], [500, 548], [750, 558], [923, 574]] },
    { name: '皇后大道中', kind: 'street', width: 14, pts: [[0, 468], [260, 460], [520, 456], [780, 466], [923, 482]] },
    { name: '威靈頓街', kind: 'street', width: 12, pts: [[0, 378], [300, 370], [600, 368], [923, 390]] },
    { name: '夏慤道', kind: 'major', width: 22, pts: [[0, 298], [300, 290], [620, 288], [923, 306]] },
    { name: '', kind: 'street', width: 11, pts: [[120, 298], [122, 470], [124, 560], [126, 650]] },
    { name: '', kind: 'street', width: 11, pts: [[270, 296], [272, 466], [274, 556], [276, 646]] },
    { name: '', kind: 'street', width: 11, pts: [[430, 292], [432, 458], [434, 550], [436, 640]] },
    { name: '', kind: 'street', width: 11, pts: [[590, 290], [592, 458], [594, 550], [596, 638]] },
    { name: '', kind: 'street', width: 11, pts: [[760, 296], [762, 468], [764, 560], [766, 644]] },
  ],

  parks: [
    [[30, 692], [240, 688], [244, 732], [34, 736]], // the open lawn on the waterfront
    [[300, 236], [440, 232], [446, 286], [306, 290]], // Hong Kong Park
    [[640, 236], [780, 236], [784, 286], [644, 288]], // zoological and botanical gardens
  ],

  // The Observation Wheel's plaza.
  plazas: [{ x: 830, y: 690, r: 26 }],

  // Finger piers into the harbour: x, y of the root (on the promenade), length, width.
  piers: [
    { x: 330, y: 728, len: 62, w: 22 },
    { x: 440, y: 734, len: 62, w: 22 },
    { x: 560, y: 724, len: 62, w: 22 },
    { x: 690, y: 730, len: 62, w: 22 },
  ],

  // Wooded hillside along the top edge (nothing is built there).
  hill: { height: 1.0, poly: [[-100, -400], [1100, -400], [1100, 218], [800, 232], [500, 222], [200, 232], [-100, 226]] },

  // Named towers: centre (x, y) and footprint (w x d) in pixels, storeys (estimated). `look` picks
  // the facade, `shape` a special form.
  landmarks: [
    { name: 'Two IFC', x: 640, y: 596, w: 34, d: 34, storeys: 92, color: '#9fb2c4', look: 'glass', shape: 'ifc' },
    { name: 'One IFC', x: 575, y: 596, w: 30, d: 30, storeys: 58, color: '#7f95ab', look: 'glass' },
    { name: 'Bank of China Tower', x: 300, y: 402, w: 36, d: 36, storeys: 70, color: '#b9c8d4', look: 'glass', shape: 'bank' },
    { name: 'Jardine House', x: 235, y: 596, w: 30, d: 24, storeys: 52, color: '#eef0f2', look: 'dots' },
    { name: 'Cheung Kong Center', x: 365, y: 598, w: 30, d: 30, storeys: 62, color: '#33465e', look: 'glass', clock: true },
    { name: 'HSBC', x: 410, y: 504, w: 44, d: 36, storeys: 46, color: '#b7bcc2', look: 'band' },
    { name: 'City Hall', x: 110, y: 600, w: 60, d: 34, storeys: 6, color: '#e8e2d6', look: 'band' },
    { name: 'Lippo Centre', x: 850, y: 440, w: 36, d: 32, storeys: 52, color: '#6f8aa4', look: 'glass' },
    { name: 'Pacific Place', x: 810, y: 372, w: 40, d: 34, storeys: 48, color: '#8b99a6', look: 'glass' },
  ],

  zones: [
    { name: 'financial core', poly: [[150, 440], [700, 440], [700, 640], [150, 640]], storeys: [22, 48] },
    { name: 'hillside residential', poly: [[0, 240], [923, 240], [923, 440], [0, 440]], storeys: [16, 32] },
    { name: 'old Central', poly: [[700, 440], [923, 440], [923, 650], [700, 650]], storeys: [10, 24] },
  ],
  defaultStoreys: [12, 26],
};
