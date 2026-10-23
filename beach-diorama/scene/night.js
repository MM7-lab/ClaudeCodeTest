import * as THREE from 'three';
import { mulberry32 } from './util.js';

const STAR_COUNT = 18;
const CENTER_Y = 0.4;

const starVertex = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uScale;
  varying float vTwinkle;
  void main() {
    vTwinkle = 0.55 + 0.45 * sin(uTime * 2.4 + aPhase * 6.2831);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale * (0.7 + 0.5 * vTwinkle);
  }
`;

const starFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dot_ = smoothstep(0.5, 0.0, length(c));
    float arm = max(
      smoothstep(0.07, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)),
      smoothstep(0.07, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)));
    float a = clamp(max(dot_, arm) * 1.25, 0.0, 1.0) * uOpacity * vTwinkle;
    gl_FragColor = vec4(vec3(1.0, 0.96, 0.78), a);
  }
`;

function buildStars() {
  const rng = mulberry32(99);
  const positions = new Float32Array(STAR_COUNT * 3);
  const phases = new Float32Array(STAR_COUNT);
  const sizes = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const az = rng() * Math.PI * 2;
    const el = THREE.MathUtils.degToRad(28 + rng() * 55); // above the island, never below the horizon
    const r = 5.0 + rng() * 0.7;
    positions.set([r * Math.cos(el) * Math.cos(az), CENTER_Y + r * Math.sin(el), r * Math.cos(el) * Math.sin(az)], i * 3);
    phases[i] = rng();
    sizes[i] = 8 + rng() * 8;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uOpacity: { value: 0 } },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/** Night-only decoration: twinkling stars above the map. */
export function createNight() {
  const stars = buildStars();
  return {
    object: stars,
    setPixelRatio(pr) {
      stars.material.uniforms.uScale.value = pr;
    },
    update(t, dt, env) {
      stars.visible = env.night > 0.01;
      stars.material.uniforms.uTime.value = t;
      stars.material.uniforms.uOpacity.value = env.night;
    },
  };
}
