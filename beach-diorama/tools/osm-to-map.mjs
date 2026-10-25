#!/usr/bin/env node
// Turns an OpenStreetMap (Overpass JSON) export into a map data module for the realistic map
// (the same format as scene/real/kowloonbay.data.js, but with real building footprints).
//
//   node tools/osm-to-map.mjs overpass.json scene/real/kowloonbay.data.js 22.3215 114.2100 1400
//
// Arguments: input JSON, output .js file, centre latitude, centre longitude, side length in
// metres (default 1400). Export the JSON on a machine with internet access, for example with
// the Overpass query printed by `--query`:
//
//   node tools/osm-to-map.mjs --query 22.3215 114.2100 1400
//
// KNOWN LIMITATION: the sea is usually drawn in OSM as open natural=coastline lines, which this
// tool does not turn into water. If the export has no closed water polygon, the output has no
// sea (the bay becomes land). Pass --keep-water=<existing data file> to reuse the water and
// promenade polygons of the hand-traced map; that is only correct if your centre and size
// match the traced square (about 22.3215, 114.2100, 1400 m is a rough guess, unverified).
//
// Data (c) OpenStreetMap contributors, ODbL. Keep that attribution if you publish the result.
// This tool has only been tested on a small synthetic export, not on a real Overpass file.
import fs from 'node:fs';
import path from 'node:path';

const SIZE = 923; // reference pixels, same as the hand-traced map

function toLocalMetres(lat, lon, lat0, lon0) {
  const mPerDegLat = 110574;
  const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return [(lon - lon0) * mPerDegLon, -(lat - lat0) * mPerDegLat]; // x east, y south
}

if (process.argv[2] === '--query') {
  const [lat, lon, side = 1400] = process.argv.slice(3).map(Number);
  const d = side / 2;
  const dLat = d / 110574;
  const dLon = d / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon}`;
  console.log(`[out:json][timeout:60];
(
  way["building"](${bbox});
  way["highway"](${bbox});
  way["railway"~"rail|subway"](${bbox});
  way["leisure"~"park|pitch|garden"](${bbox});
  way["natural"~"water|bay|coastline"](${bbox});
);
out body; >; out skel qt;`);
  process.exit(0);
}

const keepWater = process.argv.find((a) => a.startsWith('--keep-water='))?.split('=')[1];
const [inputPath, outputPath, latArg, lonArg, sideArg = '1400'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!inputPath || !outputPath || !latArg || !lonArg) {
  console.error('usage: node tools/osm-to-map.mjs overpass.json out.data.js <lat> <lon> [sideMetres]');
  process.exit(1);
}
const lat0 = Number(latArg);
const lon0 = Number(lonArg);
const sideM = Number(sideArg);
const metresPerPixel = sideM / SIZE;

const osm = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const nodes = new Map();
for (const e of osm.elements) if (e.type === 'node') nodes.set(e.id, e);

const toPx = (node) => {
  const [x, y] = toLocalMetres(node.lat, node.lon, lat0, lon0);
  return [Math.round((x / metresPerPixel + SIZE / 2) * 10) / 10, Math.round((y / metresPerPixel + SIZE / 2) * 10) / 10];
};
const wayPoints = (way) => way.nodes.map((id) => nodes.get(id)).filter(Boolean).map(toPx);
const inside = ([x, y]) => x >= -40 && x <= SIZE + 40 && y >= -40 && y <= SIZE + 40;
const closed = (way) => way.nodes.length > 3 && way.nodes[0] === way.nodes[way.nodes.length - 1];

const out = { id: 'osm-import', name: 'OSM import', size: SIZE, origin: [0, 0], metresPerPixel, water: [], promenade: [], roads: [], parks: [], buildings: [], zones: [], landmarks: [] };
let railPts = null;
const waterPolys = [];

for (const way of osm.elements.filter((e) => e.type === 'way')) {
  const t = way.tags ?? {};
  const pts = wayPoints(way);
  if (pts.length < 2 || !pts.some(inside)) continue;
  if (t.building) {
    if (!closed(way)) continue;
    const levels = Number(t['building:levels']) || (Number(t.height) ? Number(t.height) / 3.3 : 0) || 8;
    out.buildings.push({ name: t.name ?? '', pts: pts.slice(0, -1), storeys: Math.round(levels) });
  } else if (t.highway) {
    const major = ['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link'].includes(t.highway);
    const street = ['secondary', 'tertiary', 'residential', 'unclassified', 'primary_link', 'secondary_link'].includes(t.highway);
    if (!major && !street && !['service', 'living_street', 'pedestrian'].includes(t.highway)) continue;
    out.roads.push({ name: t.name ?? '', kind: major ? 'major' : street ? 'street' : 'minor', width: major ? 26 : street ? 13 : 7, pts });
  } else if (t.railway && !railPts) {
    railPts = pts;
  } else if ((t.leisure || t.landuse === 'grass') && closed(way)) {
    out.parks.push(pts.slice(0, -1));
  } else if (t.natural && closed(way)) {
    waterPolys.push(pts.slice(0, -1));
  }
}
// the map has one water polygon: keep the largest (by bounding box)
const bboxArea = (p) => (Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]))) * (Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1])));
if (waterPolys.length) out.water = waterPolys.sort((a, b) => bboxArea(b) - bboxArea(a))[0];
if (railPts) out.rail = { corridor: [], tracks: railPts, offsets: [-8, -3, 3, 8] };

if (!out.water.length) {
  if (keepWater) {
    const traced = (await import(path.resolve(keepWater))).default;
    // traced coordinates are image pixels; the square starts at `origin` inside the image
    const shift = ([x, y]) => [x - traced.origin[0], y - traced.origin[1]];
    out.water = traced.water.map(shift);
    out.promenade = (traced.promenade ?? []).map(shift);
    console.warn('no closed water polygon found: reusing the traced water and promenade (check they line up)');
  } else {
    console.warn('WARNING: no closed water polygon found, so there will be no sea. See --keep-water in the header.');
  }
}
fs.writeFileSync(outputPath, `// Generated by tools/osm-to-map.mjs from OpenStreetMap data (c) OpenStreetMap contributors, ODbL.\nexport default ${JSON.stringify(out)};\n`);
console.log(`wrote ${outputPath}: ${out.buildings.length} buildings, ${out.roads.length} roads, ${out.parks.length} parks`);
