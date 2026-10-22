import * as THREE from 'three';
import { P, mergeParts, mulberry32, vertexColorMaterial } from './util.js';

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

function buildCampfire(heightAt, x, z) {
  const fire = new THREE.Group();
  fire.position.set(x, heightAt(x, z) - 0.02, z);

  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(P(new THREE.IcosahedronGeometry(0.09, 0), i % 2 ? '#8d99a6' : '#a3adb8', { pos: [0.3 * Math.cos(a), 0.04, 0.3 * Math.sin(a)], scale: [1, 0.7, 1] }));
  }
  const log = new THREE.CylinderGeometry(0.045, 0.045, 0.46, 5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI + 0.3;
    parts.push(P(log, '#6b4427', { pos: [0, 0.08, 0], rot: [Math.PI / 2 - 0.25, a, 0] }));
  }
  fire.add(new THREE.Mesh(mergeParts(parts), vertexColorMaterial));

  const flameMaterial = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const flames = [
    { mesh: new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 5), flameMaterial('#ff7a1c')), base: 1, speed: 9, phase: 0 },
    { mesh: new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), flameMaterial('#ffd34d')), base: 0.9, speed: 12, phase: 1.7 },
    { mesh: new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 5), flameMaterial('#ff5a1a')), base: 0.8, speed: 7, phase: 3.1 },
  ];
  flames[0].mesh.position.set(0, 0.27, 0);
  flames[1].mesh.position.set(0.03, 0.22, 0.02);
  flames[2].mesh.position.set(-0.06, 0.2, -0.03);
  for (const f of flames) fire.add(f.mesh);

  const light = new THREE.PointLight('#ff9a3c', 0, 4.5, 1.6);
  light.position.set(0, 0.45, 0);
  fire.add(light);
  return { fire, flames, light };
}

/** Night-only decorations: twinkling stars and a campfire that lights up the sand. */
export function createNight(heightAt, firePos) {
  const group = new THREE.Group();
  const stars = buildStars();
  const { fire, flames, light } = buildCampfire(heightAt, firePos.x, firePos.z);
  group.add(stars, fire);

  return {
    object: group,
    /** Stars are not solid, so clicks pass through them. Everything else here is. */
    stars,
    campfire: fire,
    setPixelRatio(pr) {
      stars.material.uniforms.uScale.value = pr;
    },
    update(t, dt, env) {
      const n = env.night;
      stars.visible = n > 0.01;
      stars.material.uniforms.uTime.value = t;
      stars.material.uniforms.uOpacity.value = n;

      for (const f of flames) {
        f.mesh.visible = n > 0.01;
        const flicker = 0.85 + 0.15 * Math.sin(t * f.speed + f.phase) + 0.07 * Math.sin(t * f.speed * 2.3);
        f.mesh.scale.set(n * (0.9 + 0.1 * flicker), n * flicker * f.base, n * (0.9 + 0.1 * flicker));
      }
      light.intensity = n * (5.5 + 1.2 * Math.sin(t * 11) + 0.6 * Math.sin(t * 17.3));
    },
  };
}
