// Kowloon Bay (九龍灣), Hong Kong: a hand-traced layout.
//
// SOURCE AND ACCURACY: traced by eye from one Google Maps screenshot (dark theme, Chinese
// labels) given by the project owner; the screenshot itself is not included. Roads, parks,
// the coast and the named buildings are placed where they appear on that screenshot, as best
// as could be judged by eye: the error was NOT measured. Building storeys are ESTIMATES, and
// so is the scale. To replace this with better data, run tools/osm-to-map.mjs on an
// OpenStreetMap (Overpass) export of the same area. Because it derives from a Google Maps
// screenshot, use the OSM route before publishing this data widely.
//
// All coordinates are pixels of a 923 x 923 reference square (x to the right, y down; the
// top-left corner is the north-west corner of the map). `size` is its side in pixels and
// `metresPerPixel` converts to real distances (an ESTIMATE of about 1.5 m per pixel, so the
// square is very roughly 1.4 km across).

export default {
  id: 'kowloon-bay',
  name: '九龍灣 Kowloon Bay',
  size: 923,
  origin: [0, 20], // top-left of the 923 px square within the reference image
  metresPerPixel: 1.5,

  // The sea: bottom-left corner of the map (Kowloon Bay / the old Kai Tak runway apron).
  water: [[0, 610], [40, 650], [120, 740], [200, 820], [270, 890], [320, 943], [0, 943]],
  // Reclaimed land between the coastal road and the water (paved, no buildings).
  promenade: [[0, 440], [490, 790], [470, 850], [320, 943], [270, 890], [200, 820], [120, 740], [40, 650], [0, 610]],

  // kind: major / street / minor. width is in pixels.
  roads: [
    { name: '啟祥道', kind: 'major', width: 26, pts: [[0, 196], [120, 188], [250, 178], [400, 160], [520, 146], [640, 128], [700, 75], [745, 20]] },
    { name: '承啟道', kind: 'major', width: 26, pts: [[95, 20], [75, 110], [68, 250], [75, 360], [100, 430], [160, 500], [260, 590], [360, 670], [440, 735], [500, 770], [600, 765], [700, 762], [800, 742], [923, 718]] },
    { name: '承昌道', kind: 'major', width: 22, pts: [[0, 372], [60, 425], [130, 490], [230, 570], [330, 650], [430, 730], [490, 765]] },
    { name: '偉業街', kind: 'major', width: 26, pts: [[610, 140], [618, 250], [624, 350], [630, 470], [640, 590], [650, 690], [700, 780], [780, 850], [850, 930], [880, 943]] },
    { name: '觀塘繞道', kind: 'major', width: 28, pts: [[820, 20], [850, 100], [870, 250], [880, 400], [885, 560], [900, 700], [923, 740]] },
    { name: '宏照道', kind: 'street', width: 13, pts: [[402, 160], [406, 250], [420, 400], [432, 540], [445, 640], [452, 700]] },
    { name: '臨興街', kind: 'street', width: 12, pts: [[165, 248], [300, 245], [410, 240], [565, 228]] },
    { name: '常悅道', kind: 'street', width: 13, pts: [[230, 492], [330, 484], [430, 470], [540, 462], [620, 455]] },
    { name: '常怡道', kind: 'street', width: 14, pts: [[330, 662], [450, 656], [540, 654], [630, 648], [770, 640], [923, 634]] },
    { name: '啟樂街', kind: 'street', width: 11, pts: [[440, 80], [560, 78]] },
    { name: '', kind: 'street', width: 11, pts: [[565, 228], [568, 330], [572, 460]] },
    { name: '', kind: 'street', width: 11, pts: [[480, 300], [484, 450], [488, 640]] },
    { name: '祥業街', kind: 'street', width: 12, pts: [[515, 805], [580, 880], [610, 943]] },
    { name: '啟興道', kind: 'street', width: 12, pts: [[690, 800], [700, 880], [708, 943]] },
    { name: '', kind: 'minor', width: 7, pts: [[470, 395], [610, 395]] },
    { name: '', kind: 'minor', width: 7, pts: [[485, 520], [625, 520]] },
    { name: '', kind: 'minor', width: 7, pts: [[235, 340], [400, 335]] },
    { name: '', kind: 'minor', width: 7, pts: [[236, 330], [238, 430], [240, 560]] },
    { name: '', kind: 'minor', width: 7, pts: [[160, 250], [168, 440], [175, 560]] },
    { name: '', kind: 'minor', width: 7, pts: [[330, 560], [440, 556]] },
  ],

  parks: [
    [[335, 486], [432, 486], [432, 602], [335, 602]], // pitch next to MegaBox
    [[195, 20], [392, 20], [392, 102], [195, 102]], // school fields (north)
    [[396, 20], [582, 20], [582, 72], [396, 72]],
    [[225, 356], [300, 356], [300, 400], [225, 400]],
    [[860, 345], [923, 345], [923, 440], [860, 440]],
    [[500, 165], [518, 165], [520, 440], [502, 440]], // green walkway
  ],

  // MTR corridor east of Wai Yip Street, with the Kowloon Bay depot.
  rail: {
    corridor: [[715, 20], [790, 20], [800, 300], [830, 520], [840, 700], [790, 700], [770, 560], [735, 380], [705, 200]],
    tracks: [[740, 20], [780, 200], [800, 330], [820, 500], [835, 690]],
    offsets: [-18, -6, 6, 18],
  },

  // Named buildings: centre (x, y) and footprint (w x d) in pixels, storeys (estimated).
  landmarks: [
    { name: '君立酒店 Camlux Hotel', x: 205, y: 268, w: 50, d: 40, storeys: 22, color: '#c9d6df' },
    { name: '歷山文儀中心', x: 392, y: 322, w: 70, d: 50, storeys: 26, color: '#d8d2c4' },
    { name: 'MegaBox', x: 388, y: 596, w: 92, d: 74, storeys: 40, color: '#cfd7de', clock: true },
    { name: '香港兒童醫院', x: 470, y: 915, w: 120, d: 60, storeys: 14, color: '#e6e2d8' },
    { name: '九龍灣站 Kowloon Bay MTR', x: 812, y: 342, w: 46, d: 26, storeys: 3, color: '#d9dde2' },
    { name: '淘大商場', x: 905, y: 215, w: 60, d: 70, storeys: 8, color: '#e2d8c8' },
    { name: '車廠 Depot', x: 748, y: 520, w: 34, d: 130, storeys: 2, color: '#b9bdc2' },
  ],

  // Typical storeys for generated buildings in an area; the first matching zone wins.
  zones: [
    { name: 'schools and low blocks', poly: [[100, 20], [600, 20], [600, 120], [100, 120]], storeys: [5, 12] },
    { name: 'industrial', poly: [[650, 700], [923, 700], [923, 943], [650, 943]], storeys: [8, 18] },
    { name: 'housing near Camlux', poly: [[100, 150], [380, 150], [380, 460], [100, 460]], storeys: [18, 32] },
    { name: 'commercial centre', poly: [[380, 220], [610, 220], [610, 700], [380, 700]], storeys: [14, 30] },
  ],
  defaultStoreys: [12, 26],

  // Closed loop that the taxis drive: intersections of 啟祥道, 偉業街, 常怡道 and 宏照道.
  taxiLoop: [[408, 172], [612, 142], [624, 320], [634, 640], [452, 656], [432, 470]],
};
