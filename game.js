import * as THREE from './lib/three.module.js';

// ============================================================
//  바람의 대지 — 모바일 오픈월드 어드벤처
// ============================================================

const WORLD = 800, HALF = WORLD / 2, N = 257, CELL = WORLD / (N - 1);
const WATER = 0;
const STEEP = 0.62;           // normal.y below this = climbable / too steep to walk
const GRAVITY = 24;
const SAVE_KEY = 'wildwind_save_v1';

// ---------- RNG & noise ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20241007);
function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}
function fbm(x, z, o) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; }
  return s;
}
function ridged(x, z, o) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) {
    const n = 1 - Math.abs(vnoise(x * f + i * 17.3, z * f - i * 9.1));
    s += a * n * n; f *= 2.1; a *= 0.5;
  }
  return s;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------- Height field ----------
function rawHeight(x, z) {
  const d = Math.hypot(x, z) / (HALF * 0.97);
  const island = 1 - smooth(0.62, 1.0, d);
  let h = 6 + fbm(x * 0.005 + 3.1, z * 0.005 - 7.7, 5) * 30;
  const mMask = smooth(-0.05, 0.35, fbm(x * 0.0025 + 40, z * 0.0025 + 11, 3));
  h += ridged(x * 0.006, z * 0.006, 4) * 100 * mMask;
  return h * island - 18 * (1 - island);
}
const H = new Float32Array(N * N);
for (let iz = 0; iz < N; iz++)
  for (let ix = 0; ix < N; ix++)
    H[iz * N + ix] = rawHeight(-HALF + ix * CELL, -HALF + iz * CELL);

function terrainH(x, z) {
  const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
  if (gx < 0 || gz < 0 || gx >= N - 1 || gz >= N - 1) return -18;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const h00 = H[iz * N + ix], h10 = H[iz * N + ix + 1], h01 = H[(iz + 1) * N + ix], h11 = H[(iz + 1) * N + ix + 1];
  if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
const _n = new THREE.Vector3();
function normalAt(x, z, out = _n) {
  const e = 1.0;
  out.set(terrainH(x - e, z) - terrainH(x + e, z), 2 * e, terrainH(x, z - e) - terrainH(x, z + e));
  return out.normalize();
}
function slopeOK(x, z) { return normalAt(x, z).y > 0.85; }

// ---------- Renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x8cc8ff);
scene.background = skyColor.clone();
scene.fog = new THREE.Fog(skyColor.clone(), 70, 360);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a30, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const sc = sun.shadow.camera;
sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 220;
sun.shadow.bias = -0.0008;
scene.add(sun); scene.add(sun.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  rotateCheck();
}
window.addEventListener('resize', resize);

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });

// ---------- Terrain mesh ----------
function terrainColor(h, ny, x, z, out) {
  const v = fbm(x * 0.03, z * 0.03, 2) * 0.5 + 0.5;
  if (h < 1.6) out.setHex(0xd9c98f);
  else if (h > 62 && ny > 0.55) out.setHex(0xf3f5fa);
  else if (ny < STEEP + 0.05) out.setHex(0x837a6d);
  else if (h > 42) out.setHex(0x7b8a55).lerp(new THREE.Color(0x8d8770), v);
  else out.setHex(0x5f9d3a).lerp(new THREE.Color(0x93bd4c), v);
  return out;
}
{
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
  const c = new THREE.Color();
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const i = iz * N + ix, x = -HALF + ix * CELL, z = -HALF + iz * CELL, h = H[i];
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
    const ny = normalAt(x, z).y;
    terrainColor(h, ny, x, z, c);
    const j = 0.94 + hash2(ix * 7, iz * 13) * 0.12;
    col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < N - 1; iz++) for (let ix = 0; ix < N - 1; ix++) {
    const v00 = iz * N + ix, v10 = v00 + 1, v01 = v00 + N, v11 = v01 + 1;
    idx[k++] = v00; idx[k++] = v01; idx[k++] = v10;
    idx[k++] = v10; idx[k++] = v01; idx[k++] = v11;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, lam(0xffffff, { vertexColors: true }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}
// Water
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(3000, 3000),
  new THREE.MeshPhongMaterial({ color: 0x2f7fb8, transparent: true, opacity: 0.78, shininess: 80, specular: 0x88bbff })
);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER;
scene.add(water);

// ---------- Colliders (spatial grid) ----------
const GRID = 8, colGrid = new Map();
const gkey = (ix, iz) => ix * 100003 + iz;
function addCollider(c) {
  const k = gkey(Math.floor(c.x / GRID), Math.floor(c.z / GRID));
  if (!colGrid.has(k)) colGrid.set(k, []);
  colGrid.get(k).push(c);
}
function collideCylinders(p, rad) {
  const ix = Math.floor(p.x / GRID), iz = Math.floor(p.z / GRID);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const list = colGrid.get(gkey(ix + dx, iz + dz));
    if (!list) continue;
    for (const c of list) {
      if (p.y > c.y + c.h || p.y + 1.8 < c.y) continue;
      const ox = p.x - c.x, oz = p.z - c.z, d = Math.hypot(ox, oz), m = c.r + rad;
      if (d < m && d > 1e-4) { p.x = c.x + ox / d * m; p.z = c.z + oz / d * m; }
    }
  }
}

// ---------- Placement helpers ----------
function findSpot(test, tries = 4000) {
  for (let i = 0; i < tries; i++) {
    const x = (rng() * 2 - 1) * HALF * 0.85, z = (rng() * 2 - 1) * HALF * 0.85;
    const h = terrainH(x, z);
    if (test(x, z, h)) return { x, z, h };
  }
  return null;
}
// Spawn point: gentle grassland nearest the center
let SPAWN = { x: 0, z: 0, h: 10 };
{
  let best = null, bestD = 1e9;
  for (let i = 0; i < 6000; i++) {
    const x = (rng() * 2 - 1) * 160, z = (rng() * 2 - 1) * 160, h = terrainH(x, z);
    if (h > 4 && h < 22 && slopeOK(x, z)) {
      const d = Math.hypot(x, z);
      if (d < bestD) { bestD = d; best = { x, z, h }; }
    }
  }
  if (best) SPAWN = best;
}

// ---------- Trees & rocks ----------
const trees = [];
{
  const pineTrunk = new THREE.CylinderGeometry(0.22, 0.35, 2.2, 6); pineTrunk.translate(0, 1.1, 0);
  const pineTop = new THREE.ConeGeometry(1.7, 4.6, 7); pineTop.translate(0, 4.2, 0);
  const roundTop = new THREE.IcosahedronGeometry(1.9, 0); roundTop.translate(0, 3.6, 0);
  const COUNT = 1500;
  const trunkMesh = new THREE.InstancedMesh(pineTrunk, lam(0x6b4a2e), COUNT);
  const pineMesh = new THREE.InstancedMesh(pineTop, lam(0xffffff), COUNT);
  const roundMesh = new THREE.InstancedMesh(roundTop, lam(0xffffff, { flatShading: true }), COUNT);
  let nT = 0, nP = 0, nR = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < 9000 && nT < COUNT; i++) {
    const x = (rng() * 2 - 1) * HALF * 0.9, z = (rng() * 2 - 1) * HALF * 0.9, h = terrainH(x, z);
    if (h < 2.2 || h > 52) continue;
    const forest = fbm(x * 0.012 + 77, z * 0.012 - 5, 3);
    if (forest < 0.05 && rng() > 0.06) continue;
    if (!slopeOK(x, z)) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8) continue;
    const sc = 0.75 + rng() * 0.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
    s.set(sc, sc, sc); p.set(x, h - 0.1, z);
    m.compose(p, q, s);
    trunkMesh.setMatrixAt(nT++, m);
    const pine = h > 26 || rng() < 0.45;
    if (pine) {
      c.setHSL(0.33 + rng() * 0.05, 0.45, 0.22 + rng() * 0.08);
      pineMesh.setMatrixAt(nP, m); pineMesh.setColorAt(nP++, c);
    } else {
      c.setHSL(0.22 + rng() * 0.08, 0.5, 0.32 + rng() * 0.1);
      roundMesh.setMatrixAt(nR, m); roundMesh.setColorAt(nR++, c);
    }
    const t = { x, z, y: h, h: 6 * sc, r: 0.35 * sc, round: !pine };
    trees.push(t); addCollider(t);
  }
  trunkMesh.count = nT; pineMesh.count = nP; roundMesh.count = nR;
  for (const im of [trunkMesh, pineMesh, roundMesh]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }

  // rocks
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, lam(0x8a8478, { flatShading: true }), 300);
  let nRk = 0;
  for (let i = 0; i < 3000 && nRk < 300; i++) {
    const x = (rng() * 2 - 1) * HALF * 0.9, z = (rng() * 2 - 1) * HALF * 0.9, h = terrainH(x, z);
    if (h < 0.5) continue;
    const sc = 0.5 + rng() * 1.6;
    q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
    s.set(sc * (0.8 + rng() * 0.5), sc * 0.7, sc * (0.8 + rng() * 0.5)); p.set(x, h + sc * 0.2, z);
    m.compose(p, q, s); rocks.setMatrixAt(nRk++, m);
    if (sc > 0.9) addCollider({ x, z, y: h - 1, h: sc * 1.2 + 1, r: sc * 0.8 });
  }
  rocks.count = nRk; rocks.castShadow = true; rocks.receiveShadow = true; scene.add(rocks);
}

// ---------- Clouds ----------
const clouds = (() => {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666, flatShading: true }), 160);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < 40; i++) {
    const cx = (rng() * 2 - 1) * 600, cz = (rng() * 2 - 1) * 600, cy = 130 + rng() * 40;
    for (let j = 0; j < 4; j++) {
      const r = 10 + rng() * 10;
      p.set(cx + (rng() - 0.5) * 30, cy + (rng() - 0.5) * 5, cz + (rng() - 0.5) * 18);
      s.set(r * 1.4, r * 0.5, r);
      m.compose(p, q, s); im.setMatrixAt(k++, m);
    }
  }
  im.count = k; scene.add(im);
  return im;
})();

// ---------- Glow beams ----------
function makeBeam(color, height = 60) {
  const geo = new THREE.CylinderGeometry(0.6, 0.6, height, 8, 1, true);
  geo.translate(0, height / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  return new THREE.Mesh(geo, mat);
}

// ---------- Shrines ----------
const shrines = [];
{
  const stone = lam(0x6e6a64);
  for (let i = 0; i < 8; i++) {
    let spot = findSpot((x, z, h) => {
      if (h < 3 || h > 48 || !slopeOK(x, z)) return false;
      const ds = Math.hypot(x - SPAWN.x, z - SPAWN.z);
      if (i === 0 ? (ds < 45 || ds > 95) : ds < 60) return false;
      return shrines.every(s => Math.hypot(s.x - x, s.z - z) > 120);
    }, 8000);
    if (!spot) spot = findSpot((x, z, h) => h > 2 && slopeOK(x, z));
    const g = new THREE.Group();
    g.position.set(spot.x, spot.h, spot.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.6, 8), stone);
    base.position.y = 0.1; base.receiveShadow = true; g.add(base);
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + Math.PI / 4;
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), stone);
      pil.position.set(Math.cos(a) * 2.6, 1.9, Math.sin(a) * 2.6); pil.castShadow = true; g.add(pil);
    }
    const crystalMat = new THREE.MeshLambertMaterial({ color: 0xffa53a, emissive: 0xff7a10, emissiveIntensity: 0.9 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), crystalMat);
    crystal.position.y = 2.2; crystal.scale.y = 1.6; g.add(crystal);
    const beam = makeBeam(0xffa53a); beam.position.y = 0.3; g.add(beam);
    scene.add(g);
    const s = { x: spot.x, z: spot.z, y: spot.h, done: false, discovered: false, group: g, crystal, crystalMat, beam, trial: false };
    shrines.push(s);
    addCollider({ x: spot.x, z: spot.z, y: spot.h, h: 4, r: 0.7 });
  }
}

// ---------- Towers ----------
const towers = [];
{
  for (let i = 0; i < 2; i++) {
    const spot = findSpot((x, z, h) => {
      if (h < 8 || h > 40 || !slopeOK(x, z)) return false;
      const ds = Math.hypot(x - SPAWN.x, z - SPAWN.z);
      if (ds < 110 || ds > 300) return false;
      return towers.every(t => Math.hypot(t.x - x, t.z - z) > 260);
    }, 8000) || findSpot((x, z, h) => h > 5 && slopeOK(x, z));
    const R = 3, base = spot.h - 3, height = 34, top = base + height;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.6, height, 10), lam(0x55504a));
    body.position.set(spot.x, base + height / 2, spot.z); body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let k = 1; k < 6; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.15 + 0.6 * (1 - k / 6), 0.12, 6, 20), lam(0x3a3632));
      ring.rotation.x = Math.PI / 2; ring.position.set(spot.x, base + k * height / 6, spot.z); g.add(ring);
    }
    const capMat = new THREE.MeshLambertMaterial({ color: 0x9a8cff, emissive: 0x6a50ff, emissiveIntensity: 0.4 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.8, R, 0.6, 10), capMat);
    cap.position.set(spot.x, top - 0.3, spot.z); g.add(cap);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), capMat);
    orb.position.set(spot.x, top + 1.2, spot.z); g.add(orb);
    scene.add(g);
    towers.push({ x: spot.x, z: spot.z, r: R, base, top, activated: false, capMat, orb });
  }
}
function towerClimbR(t) { return t.r + 0.35; }
function groundAt(x, z, y) {
  let g = terrainH(x, z);
  for (const t of towers) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d <= t.r + 0.8 && y >= t.top - 1.0) g = Math.max(g, t.top);
  }
  return g;
}

// ---------- Apples ----------
const APPLE_CAP = 420;
const appleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), lam(0xd8262a, { emissive: 0x330000 }), APPLE_CAP);
appleMesh.castShadow = true;
scene.add(appleMesh);
const apples = [];
const _m4 = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function setAppleSlot(a) {
  if (a.alive) _m4.makeTranslation(a.x, a.y + 0.22, a.z); else _m4.copy(_zero);
  appleMesh.setMatrixAt(a.slot, _m4);
  appleMesh.instanceMatrix.needsUpdate = true;
}
function addApple(x, z, natural) {
  let slot = apples.findIndex(a => !a.alive && !a.natural);
  let a;
  if (slot >= 0) { a = apples[slot]; }
  else { if (apples.length >= APPLE_CAP) return; a = { slot: apples.length }; apples.push(a); }
  Object.assign(a, { x, z, y: terrainH(x, z), alive: true, natural, respawn: 0 });
  setAppleSlot(a);
}
{
  const round = trees.filter(t => t.round);
  for (let i = 0; i < 260 && round.length; i++) {
    const t = round[Math.floor(rng() * round.length)];
    const a = rng() * Math.PI * 2;
    const x = t.x + Math.cos(a) * 1.2, z = t.z + Math.sin(a) * 1.2;
    if (terrainH(x, z) > WATER + 0.5) addApple(x, z, true);
  }
  appleMesh.count = APPLE_CAP;
  for (let i = apples.length; i < APPLE_CAP; i++) appleMesh.setMatrixAt(i, _zero);
}

// ---------- Player model ----------
function makePlayerModel() {
  const g = new THREE.Group();
  const skin = lam(0xf1c7a0), tunic = lam(0x3f7fbf), pants = lam(0xe6dcc2), boots = lam(0x5a3a22), hairM = lam(0xd9b35a), brown = lam(0x6b4a2e);
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(new THREE.CylinderGeometry(0.3, 0.4, 0.75, 8), tunic, 0, 1.08, 0);
  add(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 8), brown, 0, 0.84, 0);
  add(new THREE.SphereGeometry(0.27, 12, 10), skin, 0, 1.66, 0);
  const hair = add(new THREE.SphereGeometry(0.29, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 1.69, -0.03);
  hair.rotation.x = -0.25;
  add(new THREE.BoxGeometry(0.07, 0.07, 0.05), lam(0x223355), 0.1, 1.68, 0.25);
  add(new THREE.BoxGeometry(0.07, 0.07, 0.05), lam(0x223355), -0.1, 1.68, 0.25);
  // shield on back
  const shield = add(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), lam(0x8a6a3a), 0, 1.1, -0.42);
  shield.rotation.x = Math.PI / 2;
  const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const lp = new THREE.Group(); lp.position.set(0.14 * sx, 0.75, 0); g.add(lp);
    add(new THREE.BoxGeometry(0.17, 0.5, 0.19), pants, 0, -0.25, 0, lp);
    add(new THREE.BoxGeometry(0.19, 0.25, 0.24), boots, 0, -0.62, 0.02, lp);
    legs.push(lp);
    const ap = new THREE.Group(); ap.position.set(0.42 * sx, 1.38, 0); g.add(ap);
    add(new THREE.BoxGeometry(0.13, 0.55, 0.14), tunic, 0, -0.26, 0, ap);
    add(new THREE.SphereGeometry(0.08, 8, 6), skin, 0, -0.58, 0, ap);
    arms.push(ap);
  }
  // sword in right hand
  const sword = new THREE.Group(); sword.position.set(0, -0.6, 0.05); arms[1].add(sword);
  add(new THREE.BoxGeometry(0.06, 0.06, 0.25), lam(0x3a2a1a), 0, 0, 0.05, sword);
  add(new THREE.BoxGeometry(0.3, 0.06, 0.06), lam(0x5577aa), 0, 0, 0.2, sword);
  add(new THREE.BoxGeometry(0.05, 0.1, 0.95), lam(0xdfe6ee, { emissive: 0x223344 }), 0, 0, 0.7, sword);
  // glider
  const glider = new THREE.Group(); glider.position.y = 2.55; g.add(glider);
  const sail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 1.0), lam(0xc8553d)); glider.add(sail);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.06, 0.25), lam(0xf0d9a0)); glider.add(stripe);
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 4), brown);
    pole.position.set(0.45 * sx, -0.45, 0); pole.rotation.z = -0.35 * sx; glider.add(pole);
  }
  glider.visible = false;
  return { group: g, legs, arms, sword, glider };
}
const PM = makePlayerModel();
scene.add(PM.group);

// ---------- Enemies ----------
const enemies = [];
function makeEnemyModel(guardian) {
  const g = new THREE.Group();
  const mat = lam(guardian ? 0x5b4ab0 : 0xc2483a);
  const dark = lam(0x2a1a14);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat);
  body.scale.set(1, 1.15, 0.9); body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat);
  head.position.set(0, 1.75, 0.08); head.castShadow = true; g.add(head);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), lam(0xeeddbb));
  horn.position.set(0, 2.18, 0.05); g.add(horn);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), lam(0xffee55, { emissive: 0xaa8800 }));
    eye.position.set(0.15 * sx, 1.8, 0.42); g.add(eye);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.22), dark);
    leg.position.set(0.22 * sx, 0.25, 0); g.add(leg);
  }
  const arm = new THREE.Group(); arm.position.set(0.6, 1.25, 0); g.add(arm);
  const club = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 1.1, 6), lam(0x7a5a3a));
  club.position.set(0, -0.2, 0.5); club.rotation.x = Math.PI / 2; club.castShadow = true; arm.add(club);
  return { group: g, mat, arm };
}
function spawnEnemy(x, z, guardian = false, trialShrine = null) {
  const m = makeEnemyModel(guardian);
  const e = {
    model: m, home: new THREE.Vector3(x, terrainH(x, z), z), pos: new THREE.Vector3(x, terrainH(x, z), z),
    hp: guardian ? 5 : 3, maxHp: guardian ? 5 : 3, dead: false, respawnT: 0, facing: rng() * 6.28,
    wanderT: 0, wanderTarget: new THREE.Vector3(x, 0, z), windup: 0, cd: 0, flash: 0,
    kb: new THREE.Vector3(), guardian, trial: trialShrine, deathT: 0, speedMul: guardian ? 1.15 : 1,
  };
  m.group.position.copy(e.pos);
  scene.add(m.group);
  enemies.push(e);
  return e;
}
for (let i = 0; i < 34; i++) {
  const s = findSpot((x, z, h) => h > 2 && h < 45 && slopeOK(x, z) && Math.hypot(x - SPAWN.x, z - SPAWN.z) > 45);
  if (s) spawnEnemy(s.x, s.z);
}

// ---------- Player state ----------
const P = {
  pos: new THREE.Vector3(SPAWN.x, SPAWN.h, SPAWN.z),
  vel: new THREE.Vector3(), vy: 0, state: 'ground', facing: 0,
  stamina: 100, maxStamina: 100, exhausted: false, regenDelay: 0,
  hp: 12, maxHp: 12, inv: 0, kb: new THREE.Vector3(),
  attackT: 0, hitDone: false, climbBoost: 0, tower: null, towerAngle: 0,
  lastSafe: new THREE.Vector3(SPAWN.x, SPAWN.h, SPAWN.z), safeT: 0,
  apples: 0, walkPhase: 0, glideDir: new THREE.Vector3(0, 0, 1), dead: false, speed: 0,
};

// ---------- Input ----------
const input = { jx: 0, jy: 0, kx: 0, ky: 0, sprint: false, sprintKey: false, jump: false, jumpPressed: false, attackPressed: false, interactPressed: false, eatPressed: false };
const keys = new Set();
const cam = { yaw: Math.PI, pitch: 0.35, dist: 6.5, target: new THREE.Vector3() };

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') { input.jumpPressed = true; input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyJ' || e.code === 'KeyK') input.attackPressed = true;
  if (e.code === 'KeyE' || e.code === 'KeyF') input.interactPressed = true;
  if (e.code === 'KeyQ') input.eatPressed = true;
  if (e.code === 'KeyM') toggleMap();
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'Space') input.jump = false;
});
window.addEventListener('blur', () => { keys.clear(); input.jx = input.jy = 0; });
function readKeys() {
  input.kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  input.ky = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  input.sprintKey = keys.has('ShiftLeft') || keys.has('ShiftRight');
}

const joyBase = document.getElementById('joyBase'), joyKnob = document.getElementById('joyKnob');
const pointers = new Map();
let joyId = null;
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.45 && joyId === null) {
    joyId = e.pointerId;
    pointers.set(e.pointerId, { type: 'joy', ox: e.clientX, oy: e.clientY });
    joyBase.style.display = 'block';
    joyBase.style.left = e.clientX + 'px'; joyBase.style.top = e.clientY + 'px';
    joyKnob.style.transform = 'translate(0px,0px)';
  } else {
    pointers.set(e.pointerId, { type: 'cam', x: e.clientX, y: e.clientY });
  }
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (p.type === 'joy') {
    let dx = e.clientX - p.ox, dy = e.clientY - p.oy;
    const d = Math.hypot(dx, dy), max = 55;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
    input.jx = dx / max; input.jy = -dy / max;
  } else {
    const k = e.pointerType === 'mouse' ? 0.006 : 0.008;
    cam.yaw -= (e.clientX - p.x) * k;
    cam.pitch = clamp(cam.pitch + (e.clientY - p.y) * k * 0.8, -0.35, 1.3);
    p.x = e.clientX; p.y = e.clientY;
  }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (p.type === 'joy') { joyId = null; input.jx = input.jy = 0; joyBase.style.display = 'none'; }
  pointers.delete(e.pointerId);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

function bindButton(id, down, up) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('pressed'); el.setPointerCapture?.(e.pointerId); down(); });
  const rel = e => { el.classList.remove('pressed'); up && up(); };
  el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('lostpointercapture', rel);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindButton('btnJump', () => { input.jumpPressed = true; input.jump = true; }, () => { input.jump = false; });
bindButton('btnAttack', () => { input.attackPressed = true; });
bindButton('btnSprint', () => { input.sprint = true; }, () => { input.sprint = false; });
bindButton('btnInteract', () => { input.interactPressed = true; });
bindButton('btnEat', () => { input.eatPressed = true; });
bindButton('btnMap', () => toggleMap());
bindButton('btnFull', () => goFullscreen());

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!document.fullscreenElement && req) {
    Promise.resolve(req.call(el)).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

// ---------- Audio ----------
let actx = null;
function sfx(freq, dur = 0.1, type = 'square', vol = 0.06, slide = 0) {
  if (!actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => sfx(f, 0.25, 'triangle', 0.08), i * 140)); }

// ---------- UI ----------
const heartsCv = document.getElementById('hearts'), hctx = heartsCv.getContext('2d');
const staminaEl = document.getElementById('stamina'), staminaRing = document.getElementById('staminaRing');
const toastEl = document.getElementById('toast'), promptEl = document.getElementById('prompt');
const clockEl = document.getElementById('clock'), shrineCountEl = document.getElementById('shrineCount');
const appleCountEl = document.getElementById('appleCount'), btnInteract = document.getElementById('btnInteract');
let toastTimer = 0;
function toast(msg, t = 2.6) { toastEl.innerHTML = msg; toastEl.classList.add('show'); toastTimer = t; }

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.closePath();
}
let lastHeartsKey = '';
function drawHearts() {
  const key = P.hp + '/' + P.maxHp;
  if (key === lastHeartsKey) return;
  lastHeartsKey = key;
  const n = P.maxHp / 4, s = 26, gap = 30;
  const cols = Math.min(n, 13);
  heartsCv.width = Math.max(200, cols * gap + 10) * 2; heartsCv.height = (n > 13 ? 2 : 1) * 32 * 2;
  heartsCv.style.width = heartsCv.width / 2 + 'px'; heartsCv.style.height = heartsCv.height / 2 + 'px';
  hctx.setTransform(2, 0, 0, 2, 0, 0);
  for (let i = 0; i < n; i++) {
    const x = 16 + (i % 13) * gap, y = 3 + Math.floor(i / 13) * 30;
    const fill = clamp(P.hp - i * 4, 0, 4) / 4;
    heartPath(hctx, x, y, s);
    hctx.fillStyle = 'rgba(30,10,10,.55)'; hctx.fill();
    hctx.lineWidth = 2; hctx.strokeStyle = 'rgba(255,255,255,.85)'; hctx.stroke();
    if (fill > 0) {
      hctx.save(); heartPath(hctx, x, y, s); hctx.clip();
      hctx.beginPath(); hctx.moveTo(x, y + s * 0.5);
      hctx.arc(x, y + s * 0.5, s, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
      hctx.closePath(); hctx.fillStyle = '#ff3b4a'; hctx.fill(); hctx.restore();
    }
  }
}

// Map images
const mapImg = document.createElement('canvas');
{
  const R = 256; mapImg.width = mapImg.height = R;
  const ctx = mapImg.getContext('2d'), img = ctx.createImageData(R, R), c = new THREE.Color();
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const x = -HALF + (i + 0.5) / R * WORLD, z = -HALF + (j + 0.5) / R * WORLD, h = terrainH(x, z);
    if (h < WATER) c.setRGB(0.18, 0.45 - Math.min(0.2, -h * 0.01), 0.7 - Math.min(0.3, -h * 0.015));
    else { terrainColor(h, normalAt(x, z).y, x, z, c); const l = 0.75 + h / 160; c.multiplyScalar(l); }
    const k = (j * R + i) * 4;
    img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const miniCv = document.getElementById('minimap'), mctx = miniCv.getContext('2d');
const bigCv = document.getElementById('bigmap'), bctx = bigCv.getContext('2d');
const mapView = document.getElementById('mapView');
let mapOpen = false;
function toggleMap() {
  if (!started) return;
  mapOpen = !mapOpen;
  mapView.classList.toggle('hidden', !mapOpen);
  if (mapOpen) drawBigMap();
}
mapView.addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(); });

function drawMarker(ctx, x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
}
function drawArrow(ctx, x, y, ang, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-ang + Math.PI);
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.8); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.7, s * 0.8); ctx.closePath();
  ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}
function drawMinimap() {
  const W = miniCv.width, view = 160; // meters across
  const toPx = 256 / WORLD;
  const sx = (P.pos.x + HALF) * toPx - view * toPx / 2, sz = (P.pos.z + HALF) * toPx - view * toPx / 2;
  mctx.save();
  mctx.beginPath(); mctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#1d4f7a'; mctx.fillRect(0, 0, W, W);
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(mapImg, sx, sz, view * toPx, view * toPx, 0, 0, W, W);
  const k = W / view;
  const toMini = (x, z) => [W / 2 + (x - P.pos.x) * k, W / 2 + (z - P.pos.z) * k];
  for (const t of towers) { const [x, y] = toMini(t.x, t.z); drawMarker(mctx, clamp(x, 6, W - 6), clamp(y, 6, W - 6), 5, '#c9a0ff'); }
  for (const s of shrines) if (s.discovered) {
    let [x, y] = toMini(s.x, s.z);
    const dx = x - W / 2, dy = y - W / 2, d = Math.hypot(dx, dy), lim = W / 2 - 7;
    if (d > lim) { x = W / 2 + dx / d * lim; y = W / 2 + dy / d * lim; }
    drawMarker(mctx, x, y, 5, s.done ? '#4fd2ff' : '#ffa53a');
  }
  for (const e of enemies) if (!e.dead) {
    const [x, y] = toMini(e.pos.x, e.pos.z);
    if (Math.hypot(x - W / 2, y - W / 2) < W / 2 - 4 && P.pos.distanceTo(e.pos) < 45) { mctx.fillStyle = '#ff4040'; mctx.fillRect(x - 2, y - 2, 4, 4); }
  }
  drawArrow(mctx, W / 2, W / 2, P.facing, 8);
  // camera direction tick
  mctx.restore();
}
function drawBigMap() {
  const W = bigCv.width;
  bctx.fillStyle = '#1d4f7a'; bctx.fillRect(0, 0, W, W);
  bctx.drawImage(mapImg, 0, 0, W, W);
  const toMap = (x, z) => [(x + HALF) / WORLD * W, (z + HALF) / WORLD * W];
  for (const t of towers) { const [x, y] = toMap(t.x, t.z); drawMarker(bctx, x, y, 8, t.activated ? '#c9a0ff' : '#776a99'); }
  for (const s of shrines) if (s.discovered) { const [x, y] = toMap(s.x, s.z); drawMarker(bctx, x, y, 7, s.done ? '#4fd2ff' : '#ffa53a'); }
  const [px, py] = toMap(P.pos.x, P.pos.z); drawArrow(bctx, px, py, P.facing, 12);
}

// ---------- Game state ----------
let started = false, paused = false;
let dayTime = 8 / 24; // 0..1
const DAY_LENGTH = 600; // seconds per in-game day
let trialShrine = null;

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      shrines: shrines.map(s => [s.done, s.discovered]), towers: towers.map(t => t.activated),
      maxHp: P.maxHp, maxStamina: P.maxStamina, apples: P.apples, pos: [P.lastSafe.x, P.lastSafe.y, P.lastSafe.z], dayTime,
    }));
  } catch (e) { /* storage unavailable */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!d) return false;
    d.shrines.forEach((v, i) => { if (shrines[i]) { shrines[i].done = v[0]; shrines[i].discovered = v[1]; } });
    d.towers.forEach((v, i) => { if (towers[i]) towers[i].activated = v; });
    P.maxHp = d.maxHp; P.hp = d.maxHp; P.maxStamina = d.maxStamina; P.stamina = d.maxStamina; P.apples = d.apples;
    P.pos.set(...d.pos); P.lastSafe.set(...d.pos); dayTime = d.dayTime ?? dayTime;
    shrines.forEach(updateShrineLook); towers.forEach(updateTowerLook);
    return true;
  } catch (e) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

function updateShrineLook(s) {
  const c = s.done ? 0x4fd2ff : 0xffa53a;
  s.crystalMat.color.setHex(c); s.crystalMat.emissive.setHex(s.done ? 0x1a8fd0 : 0xff7a10);
  s.beam.material.color.setHex(c);
  s.beam.material.opacity = s.done ? 0.15 : 0.35;
}
function updateTowerLook(t) {
  t.capMat.color.setHex(t.activated ? 0x4fd2ff : 0x9a8cff);
  t.capMat.emissive.setHex(t.activated ? 0x1a8fd0 : 0x6a50ff);
  t.capMat.emissiveIntensity = t.activated ? 1 : 0.4;
}

// ---------- Player helpers ----------
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function moveVector(out) {
  let jx = input.jx + input.kx, jy = input.jy + input.ky;
  const mag = Math.min(1, Math.hypot(jx, jy));
  if (mag < 0.08) return out.set(0, 0, 0);
  const l = Math.hypot(jx, jy); jx = jx / l * mag; jy = jy / l * mag;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  return out.set(fx * jy + rx * jx, 0, fz * jy + rz * jx);
}
function canClimb() { return P.stamina > 0 && !P.exhausted; }
function useStamina(a) {
  P.stamina -= a; P.regenDelay = 0.8;
  if (P.stamina <= 0) { P.stamina = 0; P.exhausted = true; }
}
function hurt(q, fromX, fromZ) {
  if (P.inv > 0 || P.dead) return;
  P.hp = Math.max(0, P.hp - q); P.inv = 1.0;
  sfx(160, 0.2, 'sawtooth', 0.08, -80);
  if (fromX !== undefined && P.state === 'ground') {
    const dx = P.pos.x - fromX, dz = P.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
    P.kb.set(dx / d * 9, 0, dz / d * 9);
  }
  if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
  if (P.hp <= 0) die();
}
function die() {
  P.dead = true;
  document.getElementById('gameover').classList.remove('hidden');
}
function respawn() {
  P.dead = false; P.hp = P.maxHp; P.stamina = P.maxStamina; P.exhausted = false;
  P.pos.copy(P.lastSafe); P.state = 'ground'; P.vy = 0; P.vel.set(0, 0, 0); P.inv = 2;
  document.getElementById('gameover').classList.add('hidden');
}
function enterClimbTerrain() { P.state = 'climb'; P.tower = null; P.vy = 0; sfx(300, 0.05, 'triangle', 0.04); }
function tryTowerClimb(mv) {
  for (const t of towers) {
    const dx = P.pos.x - t.x, dz = P.pos.z - t.z, d = Math.hypot(dx, dz);
    if (d < towerClimbR(t) + 0.15 && P.pos.y < t.top - 0.3 && P.pos.y > t.base - 1) {
      if (mv.lengthSq() > 0.04 && (mv.x * -dx + mv.z * -dz) / d > 0.4 * mv.length() && canClimb()) {
        P.state = 'climb'; P.tower = t; P.towerAngle = Math.atan2(dz, dx); P.vy = 0;
        return true;
      }
      // push out
      const R = towerClimbR(t);
      P.pos.x = t.x + dx / d * R; P.pos.z = t.z + dz / d * R;
    }
  }
  return false;
}
function clampWorld() {
  const lim = HALF - 6;
  P.pos.x = clamp(P.pos.x, -lim, lim); P.pos.z = clamp(P.pos.z, -lim, lim);
}

// ---------- Player update ----------
const mv = new THREE.Vector3();
function updatePlayer(dt) {
  moveVector(mv);
  const mag = mv.length();
  const wantSprint = (input.sprint || input.sprintKey) && mag > 0.1 && !P.exhausted;
  if (P.inv > 0) P.inv -= dt;
  if (P.climbBoost > 0) P.climbBoost -= dt;

  switch (P.state) {
    case 'ground': {
      let spd = (P.exhausted ? 3.2 : wantSprint ? 9.5 : 5.6) * mag;
      if (P.attackT > 0) spd *= 0.35;
      if (wantSprint && P.attackT <= 0) useStamina(16 * dt);
      if (mag > 0.08) {
        const nx = P.pos.x + mv.x / mag * spd * dt, nz = P.pos.z + mv.z / mag * spd * dt;
        const hNew = terrainH(nx, nz), nn = normalAt(nx, nz);
        const onTower = groundAt(P.pos.x, P.pos.z, P.pos.y) > terrainH(P.pos.x, P.pos.z) + 0.5;
        if (!onTower && nn.y < STEEP && hNew > P.pos.y + 0.05) {
          if (canClimb()) enterClimbTerrain();
        } else { P.pos.x = nx; P.pos.z = nz; }
        P.facing = angleLerp(P.facing, Math.atan2(mv.x, mv.z), Math.min(1, dt * 12));
      }
      P.speed = spd;
      // knockback
      if (P.kb.lengthSq() > 0.01) { P.pos.addScaledVector(P.kb, dt); P.kb.multiplyScalar(Math.exp(-7 * dt)); }
      if (P.state !== 'ground') break;
      collideCylinders(P.pos, 0.4);
      if (tryTowerClimb(mv)) break;
      clampWorld();
      const g = groundAt(P.pos.x, P.pos.z, P.pos.y);
      const isTerrain = g <= terrainH(P.pos.x, P.pos.z) + 0.01;
      const n = normalAt(P.pos.x, P.pos.z);
      if (isTerrain && n.y < STEEP) {
        // slide down steep slopes
        const hl = Math.hypot(n.x, n.z) || 1;
        P.pos.x += n.x / hl * 7 * dt; P.pos.z += n.z / hl * 7 * dt;
      }
      const g2 = groundAt(P.pos.x, P.pos.z, P.pos.y);
      if (g2 < P.pos.y - 0.7) { P.state = 'air'; P.vy = 0; P.vel.set(mv.x * spd, 0, mv.z * spd); break; }
      P.pos.y = g2;
      if (WATER - g2 > 1.1) { P.state = 'swim'; break; }
      // safe point
      P.safeT += dt;
      if (P.safeT > 1 && isTerrain && n.y > 0.8 && g2 > WATER + 0.5) { P.safeT = 0; P.lastSafe.copy(P.pos); }
      // regen
      if (!wantSprint) {
        P.regenDelay -= dt;
        if (P.regenDelay <= 0) {
          P.stamina = Math.min(P.maxStamina, P.stamina + 38 * dt);
          if (P.stamina >= P.maxStamina) P.exhausted = false;
        }
      }
      if (input.jumpPressed && P.attackT <= 0) {
        P.state = 'air'; P.vy = 8.2; P.vel.set(mv.x * spd, 0, mv.z * spd);
        sfx(420, 0.08, 'square', 0.04, 200);
      }
      break;
    }
    case 'air':
    case 'glide': {
      const gliding = P.state === 'glide';
      if (gliding) {
        P.vy = lerp(P.vy, -2.4, Math.min(1, dt * 4));
        if (mag > 0.1) {
          const ta = Math.atan2(mv.x, mv.z);
          P.facing = angleLerp(P.facing, ta, Math.min(1, dt * 2.5));
        }
        const gs = 9.5;
        P.vel.set(Math.sin(P.facing) * gs, 0, Math.cos(P.facing) * gs);
        useStamina(6 * dt);
        if (P.stamina <= 0 || input.jumpPressed) { P.state = 'air'; input.jumpPressed = false; }
      } else {
        P.vy -= GRAVITY * dt;
        const target = (wantSprint ? 7 : 5.5);
        P.vel.x = lerp(P.vel.x, mv.x * target, Math.min(1, dt * 2.5));
        P.vel.z = lerp(P.vel.z, mv.z * target, Math.min(1, dt * 2.5));
        if (mag > 0.1) P.facing = angleLerp(P.facing, Math.atan2(mv.x, mv.z), Math.min(1, dt * 6));
        if (input.jumpPressed && canClimb()) { P.state = 'glide'; P.vy = Math.max(P.vy, -4); sfx(220, 0.15, 'triangle', 0.05, 120); }
      }
      const nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
      const hNew = terrainH(nx, nz);
      if (hNew > P.pos.y + 0.4) {
        // hit a wall
        if (normalAt(nx, nz).y < STEEP && canClimb() && mag > 0.1) { enterClimbTerrain(); break; }
        P.vel.x *= 0.2; P.vel.z *= 0.2;
      } else { P.pos.x = nx; P.pos.z = nz; }
      P.pos.y += P.vy * dt;
      collideCylinders(P.pos, 0.4);
      if (tryTowerClimb(mv)) break;
      clampWorld();
      const g = groundAt(P.pos.x, P.pos.z, P.pos.y);
      if (WATER - g > 1.1 && P.pos.y < WATER - 0.6) { P.state = 'swim'; P.vy = 0; sfx(180, 0.25, 'sine', 0.06, -60); break; }
      if (P.pos.y <= g) {
        P.pos.y = g;
        if (!gliding && P.vy < -24) { hurt(Math.ceil((-P.vy - 24) / 4) * 2); }
        P.state = 'ground'; P.vy = 0;
      }
      break;
    }
    case 'climb': {
      if (P.tower) {
        const t = P.tower, R = towerClimbR(t);
        const sp = 3.0 * (P.climbBoost > 0 ? 2.4 : 1);
        const up = input.jy + input.ky, side = input.jx + input.kx;
        P.pos.y += clamp(up, -1, 1) * sp * dt;
        // tangent direction relative to camera right
        const tx = -Math.sin(P.towerAngle), tz = Math.cos(P.towerAngle);
        const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
        const sgn = (tx * rx + tz * rz) >= 0 ? 1 : -1;
        P.towerAngle += clamp(side, -1, 1) * sgn * sp / R * dt;
        P.pos.x = t.x + Math.cos(P.towerAngle) * R; P.pos.z = t.z + Math.sin(P.towerAngle) * R;
        P.facing = Math.atan2(-Math.cos(P.towerAngle), -Math.sin(P.towerAngle));
        const moving = Math.abs(up) + Math.abs(side) > 0.1;
        useStamina((moving ? 6.5 : 1.5) * dt);
        const tg = terrainH(P.pos.x, P.pos.z);
        if (P.pos.y >= t.top) {
          P.pos.set(t.x + Math.cos(P.towerAngle) * (t.r - 1.2), t.top, t.z + Math.sin(P.towerAngle) * (t.r - 1.2));
          P.state = 'ground'; P.tower = null; break;
        }
        if (P.pos.y <= tg && up < 0) { P.pos.y = tg; P.state = 'ground'; P.tower = null; break; }
        P.pos.y = Math.max(P.pos.y, tg);
        if (input.jumpPressed && P.stamina > 0) { useStamina(20); P.climbBoost = 0.45; sfx(500, 0.08, 'square', 0.04, 200); }
        if (P.stamina <= 0 || input.attackPressed) {
          P.state = 'air'; P.vy = 0; P.vel.set(Math.cos(P.towerAngle) * 2, 0, Math.sin(P.towerAngle) * 2); P.tower = null;
          input.attackPressed = false;
        }
        break;
      }
      const n = normalAt(P.pos.x, P.pos.z);
      if (n.y >= STEEP) { P.state = 'ground'; break; }
      const hl = Math.hypot(n.x, n.z) || 1;
      const ox = n.x / hl, oz = n.z / hl;       // outward (downhill)
      const ux = -ox, uz = -oz;                 // uphill direction
      let px = -oz, pz = ox;                    // sideways along wall
      const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      if (px * rx + pz * rz < 0) { px = -px; pz = -pz; }
      const up = clamp(input.jy + input.ky, -1, 1), side = clamp(input.jx + input.kx, -1, 1);
      const sp = 2.0 * (P.climbBoost > 0 ? 2.8 : 1);
      const vScale = n.y; // horizontal step that produces ~sp along the surface
      P.pos.x += (ux * up * vScale + px * side) * sp * dt;
      P.pos.z += (uz * up * vScale + pz * side) * sp * dt;
      clampWorld();
      P.pos.y = terrainH(P.pos.x, P.pos.z);
      P.facing = Math.atan2(ux, uz);
      const moving = Math.abs(up) + Math.abs(side) > 0.1;
      useStamina((moving ? 10 : 1.5) * dt);
      if (input.jumpPressed && P.stamina > 0) { useStamina(20); P.climbBoost = 0.45; sfx(500, 0.08, 'square', 0.04, 200); }
      if (WATER - P.pos.y > 1.1) { P.state = 'swim'; break; }
      if (P.stamina <= 0 || input.attackPressed) {
        P.state = 'air'; P.vy = 0; P.vel.set(ox * 2.5, 0, oz * 2.5); P.pos.x += ox * 0.3; P.pos.z += oz * 0.3;
        input.attackPressed = false;
      }
      break;
    }
    case 'swim': {
      const sprinting = (input.sprint || input.sprintKey) && P.stamina > 0 && mag > 0.1;
      const spd = (sprinting ? 5.2 : 2.6) * mag;
      if (mag > 0.08) {
        P.pos.x += mv.x / mag * spd * dt; P.pos.z += mv.z / mag * spd * dt;
        P.facing = angleLerp(P.facing, Math.atan2(mv.x, mv.z), Math.min(1, dt * 8));
      }
      P.speed = spd;
      clampWorld();
      useStamina((sprinting ? 20 : mag > 0.1 ? 3.5 : 1.5) * dt);
      P.pos.y = lerp(P.pos.y, WATER - 0.95, Math.min(1, dt * 6));
      const g = terrainH(P.pos.x, P.pos.z);
      if (g >= WATER - 1.0) {
        if (normalAt(P.pos.x, P.pos.z).y < STEEP && canClimb()) { P.pos.y = g; enterClimbTerrain(); break; }
        P.pos.y = g; P.state = 'ground'; break;
      }
      if (P.stamina <= 0) {
        toast('물에 빠졌다...');
        hurt(4); P.inv = 0;
        if (!P.dead) { P.pos.copy(P.lastSafe); P.state = 'ground'; P.stamina = P.maxStamina; P.exhausted = false; }
      }
      break;
    }
  }

  // stamina regen in water/air does not happen; regen during climb idle no.
  // attack
  if (input.attackPressed && P.state === 'ground' && P.attackT <= 0) {
    P.attackT = 0.4; P.hitDone = false; sfx(700, 0.07, 'sawtooth', 0.04, -400);
  }
  if (P.attackT > 0) {
    P.attackT -= dt;
    if (!P.hitDone && P.attackT < 0.24) {
      P.hitDone = true;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d > 2.9 || Math.abs(e.pos.y - P.pos.y) > 2) continue;
        let da = Math.atan2(dx, dz) - P.facing;
        while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > 1.3 && d > 1.0) continue;
        hitEnemy(e, dx / (d || 1), dz / (d || 1));
      }
    }
  }
  // fell out of the world
  if (P.pos.y < -30) { hurt(4); P.inv = 0; if (!P.dead) respawn(); }
}

// ---------- Enemies update ----------
function hitEnemy(e, nx, nz) {
  e.hp -= 1; e.flash = 0.15; e.kb.set(nx * 10, 0, nz * 10); e.windup = 0;
  sfx(240, 0.1, 'square', 0.06, -120);
  if (e.hp <= 0) {
    e.dead = true; e.deathT = 0.6; e.respawnT = 150;
    sfx(120, 0.3, 'sawtooth', 0.06, -60);
    if (!e.trial && rng() < 0.6) addApple(e.pos.x + nx * 0.5, e.pos.z + nz * 0.5, false);
  }
}
function updateEnemies(dt) {
  const night = isNight();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i], g = e.model.group;
    if (e.dead) {
      if (e.deathT > 0) {
        e.deathT -= dt;
        const s = Math.max(0.01, e.deathT / 0.6); g.scale.set(s, s, s);
        if (e.deathT <= 0) g.visible = false;
      }
      if (e.trial) { if (e.deathT <= 0) { scene.remove(g); enemies.splice(i, 1); } continue; }
      e.respawnT -= dt;
      if (e.respawnT <= 0 && P.pos.distanceTo(e.home) > 50) {
        e.dead = false; e.hp = e.maxHp; e.pos.copy(e.home); g.visible = true; g.scale.set(1, 1, 1);
      }
      continue;
    }
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    const aggro = (e.trial ? 60 : night ? 24 : 18);
    const canSee = d < aggro && Math.abs(P.pos.y - e.pos.y) < 8 && P.state !== 'swim' && !P.dead;
    let moveX = 0, moveZ = 0, spd = 0;
    if (e.cd > 0) e.cd -= dt;
    if (canSee) {
      e.facing = angleLerp(e.facing, Math.atan2(dx, dz), Math.min(1, dt * 6));
      if (e.windup > 0) {
        e.windup -= dt;
        e.model.arm.rotation.x = lerp(e.model.arm.rotation.x, -2.2, Math.min(1, dt * 10));
        if (e.windup <= 0) {
          e.model.arm.rotation.x = 0.6; e.cd = 1.5;
          if (d < 2.4 && Math.abs(P.pos.y - e.pos.y) < 2) hurt(night || e.guardian ? 3 : 2, e.pos.x, e.pos.z);
        }
      } else if (d < 1.9 && e.cd <= 0) {
        e.windup = 0.6;
      } else if (d > 1.6) {
        moveX = dx / d; moveZ = dz / d; spd = 3.4 * e.speedMul;
      }
    } else {
      e.windup = 0;
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 3 + rng() * 4;
        const a = rng() * Math.PI * 2, r = rng() * 8;
        e.wanderTarget.set(e.home.x + Math.cos(a) * r, 0, e.home.z + Math.sin(a) * r);
      }
      const wx = e.wanderTarget.x - e.pos.x, wz = e.wanderTarget.z - e.pos.z, wd = Math.hypot(wx, wz);
      if (wd > 0.5) { moveX = wx / wd; moveZ = wz / wd; spd = 1.3; e.facing = angleLerp(e.facing, Math.atan2(wx, wz), Math.min(1, dt * 4)); }
    }
    if (e.windup <= 0) e.model.arm.rotation.x = lerp(e.model.arm.rotation.x, 0, Math.min(1, dt * 5));
    let nx = e.pos.x + moveX * spd * dt + e.kb.x * dt, nz = e.pos.z + moveZ * spd * dt + e.kb.z * dt;
    e.kb.multiplyScalar(Math.exp(-8 * dt));
    const nh = terrainH(nx, nz);
    if (nh > WATER + 0.3 && normalAt(nx, nz).y > STEEP) { e.pos.x = nx; e.pos.z = nz; }
    // separation from player
    const pdx = e.pos.x - P.pos.x, pdz = e.pos.z - P.pos.z, pd = Math.hypot(pdx, pdz);
    if (pd < 0.9 && pd > 1e-3 && Math.abs(P.pos.y - e.pos.y) < 1.5) { e.pos.x = P.pos.x + pdx / pd * 0.9; e.pos.z = P.pos.z + pdz / pd * 0.9; }
    e.pos.y = terrainH(e.pos.x, e.pos.z);
    g.position.copy(e.pos);
    g.rotation.y = e.facing;
    g.position.y += spd > 0 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.12 : 0;
    if (e.flash > 0) { e.flash -= dt; e.model.mat.emissive.setHex(0xffffff); e.model.mat.emissiveIntensity = 0.8; }
    else e.model.mat.emissive.setHex(0x000000);
  }
}

// ---------- World interactions ----------
function isNight() { const h = dayTime * 24; return h < 5.5 || h > 19.5; }
function currentInteraction() {
  for (const s of shrines) {
    if (!s.done && !s.trial && Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 4.2 && Math.abs(P.pos.y - s.y) < 3) return { type: 'shrine', s, label: '사당의 시련 시작' };
  }
  for (const t of towers) {
    if (!t.activated && Math.hypot(P.pos.x - t.x, P.pos.z - t.z) < t.r + 0.9 && P.pos.y >= t.top - 0.2) return { type: 'tower', t, label: '탑 활성화' };
  }
  return null;
}
function startTrial(s) {
  s.trial = true; trialShrine = s;
  const n = 2 + shrines.filter(x => x.done).length / 3 | 0;
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + rng();
    let x = s.x + Math.cos(a) * 9, z = s.z + Math.sin(a) * 9;
    if (terrainH(x, z) < WATER + 0.5) { x = s.x + Math.cos(a) * 5; z = s.z + Math.sin(a) * 5; }
    spawnEnemy(x, z, true, s);
  }
  toast('⚔️ 시련 시작! 수호자를 모두 쓰러뜨려라');
  sfx(330, 0.4, 'sawtooth', 0.05, 200);
}
function updateTrial() {
  if (!trialShrine) return;
  const s = trialShrine;
  const alive = enemies.filter(e => e.trial === s && !e.dead);
  const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z);
  if (d > 70 || P.dead) {
    for (const e of enemies) if (e.trial === s) { e.dead = true; e.deathT = 0.01; }
    s.trial = false; trialShrine = null; toast('시련에서 벗어났다');
    return;
  }
  if (alive.length === 0) {
    s.trial = false; s.done = true; trialShrine = null;
    updateShrineLook(s);
    const doneCount = shrines.filter(x => x.done).length;
    let reward;
    if (doneCount % 2 === 1) { P.maxHp += 4; P.hp = P.maxHp; reward = '❤️ 하트 그릇 +1'; }
    else { P.maxStamina += 25; P.stamina = P.maxStamina; P.exhausted = false; reward = '🟢 기력 +25'; }
    toast(`✨ 사당 정화 완료! (${doneCount}/${shrines.length})<br>${reward}`, 4);
    fanfare(); save();
    if (doneCount === shrines.length) setTimeout(() => toast('🏆 모든 사당을 정화했다! 대지에 바람이 돌아왔다.', 6), 4200);
  }
}
function activateTower(t) {
  t.activated = true; updateTowerLook(t);
  let n = 0;
  for (const s of shrines) if (Math.hypot(s.x - t.x, s.z - t.z) < 280 && !s.discovered) { s.discovered = true; n++; }
  toast(`📡 탑 활성화! 지도에 사당 ${n}곳이 표시되었다`, 4);
  fanfare(); save();
}

// ---------- Day / night ----------
const daySky = new THREE.Color(0x8cc8ff), duskSky = new THREE.Color(0xf2a774), nightSky = new THREE.Color(0x0d1a33);
const sunDir = new THREE.Vector3();
function updateSky(dt) {
  dayTime = (dayTime + dt / DAY_LENGTH) % 1;
  const hrs = dayTime * 24;
  const a = (hrs - 6) / 12 * Math.PI;     // 0 at 6:00, PI at 18:00
  const el = Math.sin(a);
  sunDir.set(Math.cos(a), Math.max(0.15, Math.abs(el)), 0.35).normalize();
  const dayK = smooth(-0.1, 0.25, el);
  const duskK = Math.max(0, 1 - Math.abs(el) / 0.3) * 0.8;
  skyColor.copy(nightSky).lerp(daySky, dayK).lerp(duskSky, duskK * (el > -0.2 ? 1 : 0));
  scene.background.copy(skyColor); scene.fog.color.copy(skyColor);
  sun.intensity = 0.25 + 1.4 * dayK;
  sun.color.setHex(el > 0 ? 0xfff2d8 : 0x9fb8ff);
  hemi.intensity = 0.35 + 0.6 * dayK;
  const hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60);
  clockEl.textContent = `${isNight() ? '🌙' : '☀️'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ---------- Animation of player model ----------
function animatePlayer(dt, t) {
  const g = PM.group;
  g.position.copy(P.pos);
  g.rotation.set(0, P.facing, 0);
  const [lL, lR] = PM.legs, [aL, aR] = PM.arms;
  PM.glider.visible = P.state === 'glide';
  g.visible = P.inv <= 0 || Math.floor(t * 20) % 2 === 0 || P.dead;
  if (P.state === 'ground') {
    const moving = P.speed > 0.3;
    P.walkPhase += dt * (moving ? P.speed * 1.7 : 0);
    const sw = moving ? Math.sin(P.walkPhase) * Math.min(0.9, P.speed * 0.12) : 0;
    lL.rotation.x = sw; lR.rotation.x = -sw;
    aL.rotation.x = -sw * 0.8; aL.rotation.z = 0;
    if (P.attackT > 0) {
      const k = 1 - P.attackT / 0.4;
      aR.rotation.x = lerp(-2.9, -0.4, smooth(0.1, 0.55, k)); aR.rotation.z = 0;
      g.rotation.y += Math.sin(k * Math.PI) * 0.4;
    } else { aR.rotation.x = sw * 0.8 - 0.3; aR.rotation.z = 0; }
    g.position.y += moving ? Math.abs(Math.sin(P.walkPhase)) * 0.06 : 0;
  } else if (P.state === 'air') {
    lL.rotation.x = -0.5; lR.rotation.x = 0.3; aL.rotation.x = -1.2; aR.rotation.x = -1.0;
  } else if (P.state === 'glide') {
    lL.rotation.x = 0.2; lR.rotation.x = 0.35; aL.rotation.x = aR.rotation.x = -Math.PI + 0.15;
    aL.rotation.z = -0.25; aR.rotation.z = 0.25;
    g.rotation.z = 0; g.rotation.x = 0.15;
  } else if (P.state === 'climb') {
    P.walkPhase += dt * 6 * (Math.abs(input.jy + input.ky) + Math.abs(input.jx + input.kx) > 0.1 ? 1 : 0);
    const s = Math.sin(P.walkPhase);
    aL.rotation.x = -2.4 + s * 0.5; aR.rotation.x = -2.4 - s * 0.5; aL.rotation.z = aR.rotation.z = 0;
    lL.rotation.x = -0.6 - s * 0.4; lR.rotation.x = -0.6 + s * 0.4;
    // lean into the wall
    if (!P.tower) { const n = normalAt(P.pos.x, P.pos.z); g.rotation.x = Math.acos(clamp(n.y, -1, 1)) * 0.5; }
  } else if (P.state === 'swim') {
    P.walkPhase += dt * 5;
    const s = Math.sin(P.walkPhase);
    aL.rotation.x = -1.5 + s; aR.rotation.x = -1.5 - s; lL.rotation.x = s * 0.4; lR.rotation.x = -s * 0.4;
    g.rotation.x = 0.9;
    g.position.y += 0.6;
  }
}

// ---------- Camera ----------
function updateCamera(dt) {
  const tgt = _v.copy(P.pos); tgt.y += 1.5;
  cam.target.lerp(tgt, Math.min(1, dt * 10));
  const want = P.state === 'glide' ? 9 : P.state === 'climb' ? 7.5 : 6.5;
  cam.dist = lerp(cam.dist, want, Math.min(1, dt * 3));
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  camera.position.set(
    cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
    cam.target.y + sp * cam.dist,
    cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  const minY = Math.max(terrainH(camera.position.x, camera.position.z), WATER) + 0.6;
  if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(cam.target);
  // shadow light follows player
  sun.position.copy(P.pos).addScaledVector(sunDir, 90);
  sun.target.position.copy(P.pos);
}

// ---------- HUD update ----------
const _proj = new THREE.Vector3();
let hudT = 0;
function updateHUD(dt) {
  drawHearts();
  // stamina wheel near the player
  const frac = P.stamina / P.maxStamina;
  staminaRing.style.strokeDashoffset = String(125.66 * (1 - frac));
  const show = frac < 0.999 || P.exhausted;
  staminaEl.style.opacity = show ? '1' : '0';
  staminaEl.classList.toggle('exhausted', P.exhausted);
  staminaEl.classList.toggle('warn', !P.exhausted && frac < 0.3);
  _proj.copy(P.pos); _proj.y += 1.6; _proj.project(camera);
  const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth + 46, sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight - 28;
  staminaEl.style.transform = `translate(${sx - 28}px, ${sy - 28}px)`;
  const sw = 1 + Math.max(0, P.maxStamina - 100) / 100;
  staminaEl.style.width = staminaEl.style.height = (56 * Math.min(1.6, sw)) + 'px';

  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.classList.remove('show'); }
  const it = currentInteraction();
  promptEl.textContent = it ? it.label : '';
  promptEl.classList.toggle('show', !!it);
  btnInteract.classList.toggle('ready', !!it);
  appleCountEl.textContent = P.apples;
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.15;
    drawMinimap();
    shrineCountEl.textContent = `사당 ${shrines.filter(s => s.done).length}/${shrines.length}`;
  }
}

// ---------- Main loop ----------
const timer = new THREE.Timer();
let saveT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  if (started && !paused && !mapOpen && !P.dead) {
    readKeys();
    updatePlayer(dt);
    updateEnemies(dt);
    // interactions
    if (input.interactPressed) {
      const it = currentInteraction();
      if (it?.type === 'shrine' && !trialShrine) startTrial(it.s);
      else if (it?.type === 'tower') activateTower(it.t);
    }
    if (input.eatPressed) {
      if (P.apples > 0 && P.hp < P.maxHp) { P.apples--; P.hp = Math.min(P.maxHp, P.hp + 4); toast('🍎 사과를 먹었다 (+1 하트)', 1.5); sfx(660, 0.12, 'triangle', 0.06); save(); }
      else if (P.apples === 0) toast('사과가 없다', 1.2);
      else toast('하트가 가득 차 있다', 1.2);
    }
    // apples pickup
    for (const a of apples) {
      if (!a.alive) {
        if (a.natural) { a.respawn -= dt; if (a.respawn <= 0 && Math.hypot(a.x - P.pos.x, a.z - P.pos.z) > 40) { a.alive = true; setAppleSlot(a); } }
        continue;
      }
      if (Math.abs(a.x - P.pos.x) < 1.4 && Math.abs(a.z - P.pos.z) < 1.4 && Math.abs(a.y - P.pos.y) < 2) {
        a.alive = false; a.respawn = 240; setAppleSlot(a); P.apples++; sfx(880, 0.08, 'triangle', 0.05);
      }
    }
    // shrine discovery & animation
    for (const s of shrines) {
      if (!s.discovered && Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 70) { s.discovered = true; toast('새로운 사당을 발견했다!'); save(); }
      s.crystal.rotation.y += dt; s.crystal.position.y = 2.2 + Math.sin(t * 2 + s.x) * 0.15;
    }
    for (const tw of towers) tw.orb.position.y = tw.top + 1.2 + Math.sin(t * 1.5) * 0.2;
    updateTrial();
    updateSky(dt);
    saveT += dt; if (saveT > 10) { saveT = 0; save(); }
  }
  input.jumpPressed = input.attackPressed = input.interactPressed = input.eatPressed = false;
  clouds.position.x = ((t * 2) % 400) - 200;
  animatePlayer(dt, t);
  updateCamera(dt);
  if (started) updateHUD(dt);
  renderer.render(scene, camera);
}

// ---------- Menus ----------
const titleEl = document.getElementById('title');
const rotateEl = document.getElementById('rotate');
let ignoreRotate = false;
function rotateCheck() { rotateEl.classList.toggle('active', !ignoreRotate && window.innerHeight > window.innerWidth); }
document.getElementById('btnIgnoreRotate').addEventListener('click', () => { ignoreRotate = true; rotateCheck(); });
function begin(cont) {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch (e) {}
  if (cont) load();
  else { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  // face toward the first shrine at start
  if (!cont) {
    const s = shrines[0];
    cam.yaw = Math.atan2(-(s.x - P.pos.x), -(s.z - P.pos.z));
    P.facing = Math.atan2(s.x - P.pos.x, s.z - P.pos.z);
  }
  cam.target.copy(P.pos);
  titleEl.classList.add('hidden');
  started = true;
  if (matchMedia('(pointer: coarse)').matches) goFullscreen();
  toast(cont ? '모험을 이어간다' : '주황색 빛기둥의 사당을 찾아 정화하라!<br>보라색 탑에 오르면 지도에 사당이 표시된다', 5);
}
if (hasSave()) document.getElementById('btnContinue').classList.remove('hidden');
document.getElementById('btnContinue').addEventListener('click', () => begin(true));
document.getElementById('btnNew').addEventListener('click', () => begin(false));
document.getElementById('btnRetry').addEventListener('click', respawn);
document.addEventListener('visibilitychange', () => { if (document.hidden && started) save(); });

if (!matchMedia('(pointer: coarse)').matches) {
  for (const id of ['buttons']) document.getElementById(id).style.opacity = '0.75';
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

resize();
cam.target.copy(P.pos);
requestAnimationFrame(frame);
window.__game = { P, shrines, towers, enemies, input, cam, step: dt => updatePlayer(dt), terrainH, normalAt };
