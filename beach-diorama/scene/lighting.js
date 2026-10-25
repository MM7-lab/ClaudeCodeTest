import * as THREE from 'three';

export const MODES = ['day', 'sunset', 'night'];
export const TRANSITION_SECONDS = 2;

const C = (hex) => new THREE.Color(hex);
const CENTER = new THREE.Vector3(0, 0.4, 0);
const MOON = { azimuth: -125, elevation: 50 };

/**
 * Everything that changes between the three looks. Numbers and colours are interpolated;
 * azimuth/elevation (degrees) give the direction of the sun (or moon at night) light.
 */
export const PRESETS = {
  day: {
    sunColor: C('#fff1d4'), sunIntensity: 2.7, azimuth: -38, elevation: 55,
    skyColor: C('#8cd0ff'), groundColor: C('#f3ddb0'), hemiIntensity: 1.7,
    seaShallow: C('#86e8e0'), seaMid: C('#40c3d9'), seaDeep: C('#2b97d0'),
    foamColor: C('#ffffff'), foamOpacity: 0.95,
    night: 0,
  },
  sunset: {
    sunColor: C('#ffb27a'), sunIntensity: 3.1, azimuth: 118, elevation: 11,
    skyColor: C('#ffb0c8'), groundColor: C('#7a4a6e'), hemiIntensity: 1.35,
    seaShallow: C('#ffe9a6'), seaMid: C('#f592a0'), seaDeep: C('#8f5fb0'),
    foamColor: C('#fff0dc'), foamOpacity: 0.85,
    night: 0,
  },
  night: {
    sunColor: C('#7f95ff'), sunIntensity: 1.1, azimuth: MOON.azimuth, elevation: MOON.elevation,
    skyColor: C('#2c3f9a'), groundColor: C('#0b1030'), hemiIntensity: 0.95,
    seaShallow: C('#6f93e6'), seaMid: C('#4466c4'), seaDeep: C('#2a448f'),
    foamColor: C('#9fb2e8'), foamOpacity: 0.7,
    night: 1,
  },
};

const KEYS = Object.keys(PRESETS.day);

function cloneEnv(src) {
  const out = {};
  for (const k of KEYS) out[k] = src[k].isColor ? src[k].clone() : src[k];
  return out;
}

function blend(out, a, b, k) {
  for (const key of KEYS) {
    const va = a[key];
    if (typeof va === 'number') out[key] = va + (b[key] - va) * k;
    else out[key].lerpColors(va, b[key], k);
  }
}

const ease = (x) => x * x * (3 - 2 * x); // smoothstep

/** Position on the sphere of radius `r` around the diorama centre. */
function polar(azimuthDeg, elevationDeg, r, out) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(r);
}

/**
 * Sun/moon light, sky tint and the smooth day / sunset / night
 * transitions (about 2 seconds of colour and intensity interpolation).
 */
export function createLighting(scene) {
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -7.6;
  cam.right = cam.top = 7.6;
  cam.near = 1;
  cam.far = 45;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.target.position.copy(CENTER);

  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1);
  scene.add(sun, sun.target, hemi);

  const env = cloneEnv(PRESETS.day);
  env.version = 0; // bumped on every change so consumers can skip work while nothing moves
  let from = cloneEnv(PRESETS.day);
  let to = PRESETS.day;
  let elapsed = TRANSITION_SECONDS;
  let mode = 'day';

  const dir = new THREE.Vector3();

  function apply() {
    env.version++;
    polar(env.azimuth, env.elevation, 1, dir);
    sun.position.copy(dir).multiplyScalar(20).add(CENTER);
    sun.color.copy(env.sunColor);
    sun.intensity = env.sunIntensity;
    hemi.color.copy(env.skyColor);
    hemi.groundColor.copy(env.groundColor);
    hemi.intensity = env.hemiIntensity;
  }
  apply();

  return {
    env,
    get mode() {
      return mode;
    },
    /** Switch look; `instant` skips the 2 s interpolation (used on startup). */
    setMode(name, instant = false) {
      if (!PRESETS[name]) return;
      mode = name;
      to = PRESETS[name];
      if (instant) {
        blend(env, to, to, 0);
        elapsed = TRANSITION_SECONDS;
      } else {
        from = cloneEnv(env);
        elapsed = 0;
      }
      apply();
    },
    update(dt) {
      if (elapsed >= TRANSITION_SECONDS) return env;
      elapsed = Math.min(TRANSITION_SECONDS, elapsed + dt);
      blend(env, from, to, ease(elapsed / TRANSITION_SECONDS));
      apply();
      return env;
    },
  };
}
