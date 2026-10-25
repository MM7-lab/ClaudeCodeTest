import { markSolid } from '../util.js';
import { createBase, createIsland } from '../island.js';
import { createFoam, createSea } from '../sea.js';
import { createFerry } from '../ferry.js';
import { createCity } from '../city.js';
import { createTraffic } from '../traffic.js';
import { createHarbourLights } from '../harbourlights.js';
import { createCityStreetscape } from '../streetscape.js';

/**
 * The cartoon "mini Hong Kong": 80% city, 20% Victoria Harbour, trams, taxis and a ferry.
 * A world is { parts, solid, extras, boundingRadius, setCamera, configure }:
 *  - parts: things with update(t, dt, env), already positioned
 *  - solid: objects that count as "the diorama" for click-through hit testing
 *  - extras: other objects to add to the scene (not solid)
 */
export function createMiniHK() {
  const city = createCity();
  const island = createIsland({ ao: city.ao });
  const base = createBase();
  const sea = createSea();
  const foam = createFoam();
  const ferry = createFerry();
  const traffic = createTraffic();
  const harbourLights = createHarbourLights();
  const detail = createCityStreetscape(city.towers); // street-level detail, shown only when zoomed in

  const solid = [island, base, sea, city, traffic, ferry].map((p) => p.object);
  const detailPart = { object: detail.group, update: (t, dt, env) => detail.update(env) };
  for (const o of solid) markSolid(o);

  return {
    id: 'hk-mini',
    parts: [island, base, sea, foam, city, traffic, ferry, harbourLights, detailPart],
    solid,
    extras: [city.glow], // lamp glows are not solid: clicks pass through them
    boundingRadius: 7.0,
    setCamera: (camera) => city.setCamera(camera),
    setViewDistance: (distance, fit) => detail.setViewDistance(distance, fit),
    configure() {}, // the cartoon look needs no special renderer setup
    debug: { sea, foam, city, traffic, ferry, harbourLights },
  };
}
