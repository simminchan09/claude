import * as THREE from './lib/three.module.js';
import {
  SIZE, HALF, SEA, ROOT, ORIGIN, LEAF_RES, MIN_NODE, GRID, PLATEAU, CASTLE,
  heightRaw, hash2, smooth, mulberry32, forestK, desertK, snowK,
} from './world.js';

// ============================================================
//  바람의 대지 — PC 오픈월드 어드벤처
//  월드: 8654m × 8654m ≈ 74.9 km² · 플레이어 키 180cm
// ============================================================

const WATER = SEA;
const STEEP = 0.62;               // normal.y below this = climbable / too steep to walk
const GRAVITY = 24;
const PLAYER_HEIGHT = 1.8;
const SAVE_KEY = 'wildwind_save_v2';
const SHRINE_COUNT = 120, TOWER_COUNT = 15;
const DAY_LENGTH = 1440;          // 실시간 24분 = 게임 속 하루
const CELL = 64;                  // object streaming cell (m)
let TREE_R = 1000, NEAR_TREE_R = 130;
const APPLE_R = 200, CAMP_R = 180, CAMP_DROP_R = 260;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const rng = mulberry32(987654);

// ---------- Physics height (2m grid, matches the finest terrain chunks) ----------
const GN = Math.round((ROOT * 9) / GRID);
const HC_SIZE = 1 << 18, hcKeys = new Int32Array(HC_SIZE).fill(-1), hcVals = new Float32Array(HC_SIZE);
function gridH(ix, iz) {
  ix = ix < 0 ? 0 : ix > GN ? GN : ix; iz = iz < 0 ? 0 : iz > GN ? GN : iz;
  const key = ix * 8192 + iz, idx = ((ix * 73856093) ^ (iz * 19349663)) & (HC_SIZE - 1);
  if (hcKeys[idx] === key) return hcVals[idx];
  const h = heightRaw(ORIGIN + ix * GRID, ORIGIN + iz * GRID);
  hcKeys[idx] = key; hcVals[idx] = h;
  return h;
}
function terrainH(x, z) {
  const gx = (x - ORIGIN) / GRID, gz = (z - ORIGIN) / GRID;
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const h00 = gridH(ix, iz), h10 = gridH(ix + 1, iz), h01 = gridH(ix, iz + 1);
  if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  const h11 = gridH(ix + 1, iz + 1);
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
const _n = new THREE.Vector3();
function normalAt(x, z, out = _n) {
  const e = 1.0;
  out.set(terrainH(x - e, z) - terrainH(x + e, z), 2 * e, terrainH(x, z - e) - terrainH(x, z + e));
  return out.normalize();
}
function slopeOK(x, z, lim = 0.85) { return normalAt(x, z).y > lim; }

// ---------- Renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x8cc8ff);
scene.background = skyColor.clone();
scene.fog = new THREE.Fog(skyColor.clone(), 500, 5200);
const camera = new THREE.PerspectiveCamera(60, 1, 0.25, 12000);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a30, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.castShadow = true;
const sc = sun.shadow.camera;
sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
sun.shadow.bias = -0.0008;
scene.add(sun); scene.add(sun.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });

// ---------- Terrain streaming (LOD quadtree + worker) ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const terrainMat = lam(0xffffff, { vertexColors: true });
const V = LEAF_RES + 1;
const chunkIndex = (() => {
  const idx = [];
  for (let j = 0; j < LEAF_RES; j++) for (let i = 0; i < LEAF_RES; i++) {
    const v00 = j * V + i, v10 = v00 + 1, v01 = v00 + V, v11 = v01 + 1;
    idx.push(v00, v01, v10, v10, v01, v11);
  }
  // skirts (both windings so they are visible from either side)
  const base = V * V;
  for (let e = 0; e < 4; e++) for (let i = 0; i < V - 1; i++) {
    const s0 = base + e * V + i, s1 = s0 + 1;
    const a = e === 0 ? i : e === 1 ? (V - 1) * V + i : e === 2 ? i * V : i * V + V - 1;
    const b = e === 0 ? i + 1 : e === 1 ? (V - 1) * V + i + 1 : e === 2 ? (i + 1) * V : (i + 1) * V + V - 1;
    idx.push(a, b, s0, b, s1, s0, a, s0, b, b, s0, s1);
  }
  return new THREE.BufferAttribute(new Uint32Array(idx), 1);
})();
let SPLIT = 1.4;
const chunks = new Map();     // key -> {mesh, lastSeen}
const pending = new Set();
let inFlight = 0;
const nodeKey = (s, x, z) => s + ':' + x + ':' + z;
function boxDist(px, pz, x0, z0, s) {
  const dx = Math.max(x0 - px, 0, px - (x0 + s)), dz = Math.max(z0 - pz, 0, pz - (z0 + s));
  return Math.hypot(dx, dz);
}
let desiredLeaves = [];
let terrainTimer = 0;
const visibleChunks = new Set();
function ancestorKey(s0, x0, z0, s) {
  return nodeKey(s, ORIGIN + Math.floor((x0 - ORIGIN) / s) * s, ORIGIN + Math.floor((z0 - ORIGIN) / s) * s);
}
function updateTerrain() {
  const px = P.pos.x, pz = P.pos.z;
  desiredLeaves = [];
  const walk = (s, x0, z0) => {
    const d = boxDist(px, pz, x0, z0, s);
    if (s > MIN_NODE && d < s * SPLIT) {
      const h = s / 2;
      walk(h, x0, z0); walk(h, x0 + h, z0); walk(h, x0, z0 + h); walk(h, x0 + h, z0 + h);
    } else desiredLeaves.push({ s, x0, z0, d, key: nodeKey(s, x0, z0) });
  };
  for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) walk(ROOT, ORIGIN + i * ROOT, ORIGIN + j * ROOT);

  visibleChunks.clear();
  const want = [];
  for (const L of desiredLeaves) {
    if (chunks.has(L.key)) { visibleChunks.add(L.key); continue; }
    want.push(L);
    let s = L.s, found = false;
    while (s < ROOT) {
      s *= 2;
      const k = ancestorKey(L.s, L.x0, L.z0, s);
      if (chunks.has(k)) { visibleChunks.add(k); found = true; break; }
    }
    if (!found && L.s > MIN_NODE) {
      const addDesc = (s2, x, z, depth) => {
        if (depth > 3 || s2 < MIN_NODE) return;
        const k = nodeKey(s2, x, z);
        if (chunks.has(k)) { visibleChunks.add(k); return; }
        const h = s2 / 2;
        addDesc(h, x, z, depth + 1); addDesc(h, x + h, z, depth + 1); addDesc(h, x, z + h, depth + 1); addDesc(h, x + h, z + h, depth + 1);
      };
      const h = L.s / 2;
      addDesc(h, L.x0, L.z0, 1); addDesc(h, L.x0 + h, L.z0, 1); addDesc(h, L.x0, L.z0 + h, 1); addDesc(h, L.x0 + h, L.z0 + h, 1);
    }
  }
  // drop nodes whose ancestor is also visible (avoids overlapping LODs)
  for (const k of [...visibleChunks]) {
    const [s0, x0, z0] = k.split(':').map(Number);
    for (let s = s0 * 2; s <= ROOT; s *= 2) if (visibleChunks.has(ancestorKey(s0, x0, z0, s))) { visibleChunks.delete(k); break; }
  }
  const now = performance.now();
  for (const [k, c] of chunks) {
    const vis = visibleChunks.has(k);
    c.mesh.visible = vis;
    if (vis) c.lastSeen = now;
    else if (now - c.lastSeen > 8000) {
      scene.remove(c.mesh); c.mesh.geometry.setIndex(null); c.mesh.geometry.dispose(); chunks.delete(k);
    }
  }
  // request missing chunks, nearest / coarsest first
  want.sort((a, b) => (a.d - a.s * 0.5) - (b.d - b.s * 0.5));
  for (const L of want) {
    if (inFlight >= 4) break;
    if (pending.has(L.key)) continue;
    pending.add(L.key); inFlight++;
    worker.postMessage({ type: 'chunk', key: L.key, x0: L.x0, z0: L.z0, size: L.s });
  }
}
function onChunk(m) {
  pending.delete(m.key); inFlight--;
  const [s, x0, z0] = m.key.split(':').map(Number);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(m.clr, 3));
  geo.setIndex(chunkIndex);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(0, m.minY, 0), new THREE.Vector3(s, m.maxY, s));
  geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
  const mesh = new THREE.Mesh(geo, terrainMat);
  mesh.position.set(x0, 0, z0);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  mesh.visible = false;
  scene.add(mesh);
  chunks.set(m.key, { mesh, lastSeen: performance.now() });
  terrainTimer = 0;
}
function playerChunkReady() {
  for (const L of desiredLeaves) if (L.d === 0 && !chunks.has(L.key)) return false;
  return desiredLeaves.length > 0;
}

// Water (follows the camera)
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(24000, 24000),
  new THREE.MeshPhongMaterial({ color: 0x2f7fb8, transparent: true, opacity: 0.8, shininess: 80, specular: 0x88bbff })
);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER;
scene.add(water);

// ---------- Clouds ----------
const clouds = (() => {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x777777, flatShading: true }), 600);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < 150; i++) {
    const cx = (rng() * 2 - 1) * 6000, cz = (rng() * 2 - 1) * 6000, cy = 750 + rng() * 250;
    for (let j = 0; j < 4; j++) {
      const r = 40 + rng() * 50;
      p.set(cx + (rng() - 0.5) * 140, cy + (rng() - 0.5) * 20, cz + (rng() - 0.5) * 90);
      s.set(r * 1.5, r * 0.45, r);
      m.compose(p, q, s); im.setMatrixAt(k++, m);
    }
  }
  im.count = k; im.frustumCulled = false; scene.add(im);
  return im;
})();

// ---------- Placement: spawn, shrines, towers ----------
let SPAWN = { x: PLATEAU.x, z: PLATEAU.z, h: 0 };
{
  const r = mulberry32(42);
  let best = null, bd = 1e9;
  for (let i = 0; i < 3000; i++) {
    const x = PLATEAU.x + (r() * 2 - 1) * 400, z = PLATEAU.z + (r() * 2 - 1) * 400, h = terrainH(x, z);
    if (h > PLATEAU.h - 30 && slopeOK(x, z, 0.9)) { const d = Math.hypot(x - PLATEAU.x, z - PLATEAU.z); if (d < bd) { bd = d; best = { x, z, h }; } }
  }
  if (best) SPAWN = best; else SPAWN.h = terrainH(SPAWN.x, SPAWN.z);
}
const shrinePos = [];
{
  const r = mulberry32(1234);
  for (let t = 0; t < 4000 && shrinePos.length < 4; t++) {            // 4 shrines on the starting plateau
    const a = r() * Math.PI * 2, d = 250 + r() * 550;
    const x = PLATEAU.x + Math.cos(a) * d, z = PLATEAU.z + Math.sin(a) * d, h = terrainH(x, z);
    if (h < PLATEAU.h - 40 || !slopeOK(x, z)) continue;
    if (shrinePos.some(s => Math.hypot(s.x - x, s.z - z) < 300)) continue;
    shrinePos.push({ x, z, y: h });
  }
  for (let t = 0; t < 60000 && shrinePos.length < SHRINE_COUNT; t++) {
    const x = (r() * 2 - 1) * HALF * 0.9, z = (r() * 2 - 1) * HALF * 0.9;
    if (Math.hypot(x - PLATEAU.x, z - PLATEAU.z) < PLATEAU.r + 150) continue;
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r + 50) continue;
    const h = terrainH(x, z);
    if (h < 3 || h > 520 || !slopeOK(x, z)) continue;
    const minD = t < 30000 ? 480 : 360;
    if (shrinePos.some(s => Math.hypot(s.x - x, s.z - z) < minD)) continue;
    shrinePos.push({ x, z, y: h });
  }
}
const shrines = shrinePos.map((p, i) => ({ ...p, i, done: false, discovered: false, trial: false, mesh: null }));

const climbables = [];   // beacon towers + castle
{
  const r = mulberry32(777);
  const addTower = (x, z) => {
    const R = 3, base = terrainH(x, z) - 3, height = 45;
    climbables.push({ x, z, r: R, base, top: base + height, beacon: true, activated: false, name: '' });
  };
  for (let t = 0; t < 3000; t++) {                                   // plateau tower first
    const a = r() * 6.283, d = 120 + r() * 200, x = SPAWN.x + Math.cos(a) * d, z = SPAWN.z + Math.sin(a) * d;
    if (terrainH(x, z) > PLATEAU.h - 30 && slopeOK(x, z) && shrinePos.every(s => Math.hypot(s.x - x, s.z - z) > 40)) { addTower(x, z); break; }
  }
  const G = 4, cs = SIZE * 0.92 / G;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    if (climbables.length >= TOWER_COUNT) break;
    const cx0 = -SIZE * 0.46 + i * cs, cz0 = -SIZE * 0.46 + j * cs;
    if (Math.hypot(cx0 + cs / 2 - PLATEAU.x, cz0 + cs / 2 - PLATEAU.z) < cs * 0.6) continue;
    for (let t = 0; t < 2000; t++) {
      const x = cx0 + cs * (0.2 + r() * 0.6), z = cz0 + cs * (0.2 + r() * 0.6), h = terrainH(x, z);
      if (h < 6 || h > 450 || !slopeOK(x, z)) continue;
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r + 80) continue;
      if (shrinePos.some(s => Math.hypot(s.x - x, s.z - z) < 40)) continue;
      if (climbables.some(c => Math.hypot(c.x - x, c.z - z) < 1200)) continue;
      addTower(x, z); break;
    }
  }
  for (let t = 0; t < 40000 && climbables.length < TOWER_COUNT; t++) {
    const x = (r() * 2 - 1) * HALF * 0.85, z = (r() * 2 - 1) * HALF * 0.85, h = terrainH(x, z);
    if (h < 6 || h > 450 || !slopeOK(x, z) || climbables.some(c => Math.hypot(c.x - x, c.z - z) < 900)) continue;
    addTower(x, z);
  }
  climbables.forEach((c, i) => { c.name = i === 0 ? '시작의 탑' : `탑 ${i + 1}`; });
  const ch = terrainH(CASTLE.x, CASTLE.z);
  climbables.push({ x: CASTLE.x, z: CASTLE.z, r: 22, base: ch - 2, top: ch + 85, beacon: false });
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, x = CASTLE.x + Math.cos(a) * 140, z = CASTLE.z + Math.sin(a) * 140, h = terrainH(x, z);
    climbables.push({ x, z, r: 7, base: h - 2, top: h + 42, beacon: false });
  }
}
const towers = climbables.filter(c => c.beacon);
for (const c of climbables) {
  const height = c.top - c.base;
  const g = new THREE.Group();
  if (c.beacon) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r + 0.6, height, 10), lam(0x55504a));
    body.position.set(c.x, c.base + height / 2, c.z); body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let k = 1; k < 7; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(c.r + 0.15 + 0.6 * (1 - k / 7), 0.12, 6, 20), lam(0x3a3632));
      ring.rotation.x = Math.PI / 2; ring.position.set(c.x, c.base + k * height / 7, c.z); g.add(ring);
    }
    c.capMat = new THREE.MeshLambertMaterial({ color: 0x9a8cff, emissive: 0x6a50ff, emissiveIntensity: 0.4 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(c.r + 0.8, c.r, 0.6, 10), c.capMat);
    cap.position.set(c.x, c.top - 0.3, c.z); g.add(cap);
    c.orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), c.capMat);
    c.orb.position.set(c.x, c.top + 1.2, c.z); g.add(c.orb);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r * 1.1, height, 16), lam(c.r > 10 ? 0x8d8a84 : 0x7c786f));
    body.position.set(c.x, c.base + height / 2, c.z); body.castShadow = true; body.receiveShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(c.r * 0.85, c.r * 1.4, 16), lam(0x3f4f7a));
    roof.position.set(c.x, c.top + c.r * 0.7, c.z); g.add(roof);
  }
  scene.add(g);
}
function towerClimbR(t) { return t.r + 0.35; }
function groundAt(x, z, y) {
  let g = terrainH(x, z);
  for (const t of climbables) {
    if (Math.abs(x - t.x) > t.r + 1 || Math.abs(z - t.z) > t.r + 1) continue;
    if (Math.hypot(x - t.x, z - t.z) <= t.r + 0.8 && y >= t.top - 1.0) g = Math.max(g, t.top);
  }
  return g;
}

// ---------- Object cells (trees, rocks, apples, enemy camps) ----------
const cellCache = new Map();
const cellKey = (cx, cz) => (cx + 500) * 1000 + (cz + 500);
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _e = new THREE.Euler();
function getCell(cx, cz) {
  const key = cellKey(cx, cz);
  let c = cellCache.get(key);
  if (c) return c;
  const r = mulberry32((hash2(cx * 7 + 1, cz * 13 + 5) * 4294967296) | 0);
  const trees = [], rocks = [], apples = [];
  let camp = null;
  const x0 = cx * CELL, z0 = cz * CELL;
  if (terrainH(x0 + CELL / 2, z0 + CELL / 2) > -5) {
    for (let i = 0; i < 30; i++) {
      const x = x0 + r() * CELL, z = z0 + r() * CELL, roll = r(), sc = 0.75 + r() * 0.7, rot = r() * 6.283, typeRoll = r();
      const h = terrainH(x, z);
      if (h < 2.5) continue;
      const f = forestK(x, z, h), dK = desertK(x, z);
      let type = null;
      if (dK > 0.6) { if (roll < 0.012) type = 3; }
      else if (roll < f * 0.95 + (h < 300 && dK < 0.3 ? 0.035 : 0)) type = (h > 140 || snowK(x, z) > 0.45 || typeRoll < 0.4) ? 1 : 2;
      if (type === null || !slopeOK(x, z, 0.8)) continue;
      const t = { x, z, y: h, type, r: (type === 3 ? 0.4 : 0.35) * sc, h: 6 * sc, hue: typeRoll };
      _q.setFromAxisAngle(_up, rot); _s.set(sc, sc, sc); _p.set(x, h - 0.1, z);
      t.m = new THREE.Matrix4().compose(_p, _q, _s);
      trees.push(t);
      if (type === 2 && r() < 0.3) {
        const a = r() * 6.283, ax = x + Math.cos(a) * 1.3, az = z + Math.sin(a) * 1.3;
        apples.push({ id: key + ':' + apples.length, x: ax, z: az, y: terrainH(ax, az) });
      }
    }
    for (let i = 0; i < 2; i++) {
      const x = x0 + r() * CELL, z = z0 + r() * CELL, sc = 0.5 + r() * 1.8, roll = r(), e1 = r() * 3, e2 = r() * 3, e3 = r() * 3, sx = r(), sz = r();
      if (roll > 0.45) continue;
      const h = terrainH(x, z);
      if (h < 0.5) continue;
      _q.setFromEuler(_e.set(e1, e2, e3)); _s.set(sc * (0.8 + sx * 0.5), sc * 0.7, sc * (0.8 + sz * 0.5)); _p.set(x, h + sc * 0.2, z);
      rocks.push({ x, z, y: h - 1, h: sc * 1.2 + 1, r: sc > 0.9 ? sc * 0.8 : 0, m: new THREE.Matrix4().compose(_p, _q, _s) });
    }
    const cr = r(), cxp = x0 + 10 + r() * 44, czp = z0 + 10 + r() * 44, cn = 2 + Math.floor(r() * 2.5);
    if (cr < 0.022) {
      const h = terrainH(cxp, czp);
      if (h > 3 && h < 420 && slopeOK(cxp, czp) && Math.hypot(cxp - SPAWN.x, czp - SPAWN.z) > 160 && Math.hypot(cxp - CASTLE.x, czp - CASTLE.z) > 120)
        camp = { id: key, x: cxp, z: czp, n: cn };
    }
  }
  c = { key, cx, cz, trees, rocks, apples, camp };
  cellCache.set(key, c);
  if (cellCache.size > 6000) {
    for (const [k, v] of cellCache) {
      if (Math.abs(v.cx * CELL - P.pos.x) > 1600 || Math.abs(v.cz * CELL - P.pos.z) > 1600) cellCache.delete(k);
      if (cellCache.size < 4000) break;
    }
  }
  return c;
}

const treeGeo = {
  trunk: (() => { const g = new THREE.CylinderGeometry(0.22, 0.35, 2.2, 6); g.translate(0, 1.1, 0); return g; })(),
  pine: (() => { const g = new THREE.ConeGeometry(1.7, 4.6, 7); g.translate(0, 4.2, 0); return g; })(),
  round: (() => { const g = new THREE.IcosahedronGeometry(1.9, 0); g.translate(0, 3.6, 0); return g; })(),
  cactus: (() => { const g = new THREE.CylinderGeometry(0.35, 0.4, 3, 7); g.translate(0, 1.5, 0); return g; })(),
};
function makeTreeSet(cap, shadow) {
  const set = {
    trunk: new THREE.InstancedMesh(treeGeo.trunk, lam(0x6b4a2e), cap),
    pine: new THREE.InstancedMesh(treeGeo.pine, lam(0xffffff), cap),
    round: new THREE.InstancedMesh(treeGeo.round, lam(0xffffff, { flatShading: true }), cap),
    cactus: new THREE.InstancedMesh(treeGeo.cactus, lam(0x4f8a3a), Math.ceil(cap / 4)),
  };
  set.pine.setColorAt(0, new THREE.Color()); set.round.setColorAt(0, new THREE.Color());
  for (const im of Object.values(set)) {
    im.castShadow = shadow; im.receiveShadow = true; im.count = 0; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
  }
  return set;
}
const nearTrees = makeTreeSet(4000, true), farTrees = makeTreeSet(26000, false);
const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam(0x8a8478, { flatShading: true }), 3000);
rockMesh.count = 0; rockMesh.castShadow = true; rockMesh.receiveShadow = true; rockMesh.frustumCulled = false; scene.add(rockMesh);
const appleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), lam(0xd8262a, { emissive: 0x330000 }), 1500);
appleMesh.count = 0; appleMesh.castShadow = true; appleMesh.frustumCulled = false; scene.add(appleMesh);
const pickedApples = new Map();   // id -> respawn time (gameClock)
let dropApples = [];
let nearApples = [];
const _c = new THREE.Color(), _m4 = new THREE.Matrix4();
let lastObjCell = '';
function rebuildObjects(force) {
  const pcx = Math.floor(P.pos.x / CELL), pcz = Math.floor(P.pos.z / CELL);
  const id = pcx + ',' + pcz;
  if (!force && id === lastObjCell) return;
  lastObjCell = id;
  const R = Math.ceil(TREE_R / CELL);
  const cntN = [0, 0, 0, 0], cntF = [0, 0, 0, 0];
  let nRock = 0;
  nearApples = [];
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const cx = pcx + dx, cz = pcz + dz;
    const d = Math.hypot((cx + 0.5) * CELL - P.pos.x, (cz + 0.5) * CELL - P.pos.z);
    if (d > TREE_R + CELL) continue;
    const c = getCell(cx, cz);
    const near = d < NEAR_TREE_R;
    const set = near ? nearTrees : farTrees, ct = near ? cntN : cntF;
    for (const t of c.trees) {
      if (t.type === 3) { if (ct[3] < set.cactus.instanceMatrix.count) set.cactus.setMatrixAt(ct[3]++, t.m); continue; }
      if (ct[0] >= set.trunk.instanceMatrix.count) continue;
      set.trunk.setMatrixAt(ct[0]++, t.m);
      if (t.type === 1) { _c.setHSL(0.33 + t.hue * 0.05, 0.45, 0.2 + t.hue * 0.08); set.pine.setMatrixAt(ct[1], t.m); set.pine.setColorAt(ct[1]++, _c); }
      else { _c.setHSL(0.22 + t.hue * 0.08, 0.5, 0.3 + t.hue * 0.1); set.round.setMatrixAt(ct[2], t.m); set.round.setColorAt(ct[2]++, _c); }
    }
    if (d < 400) for (const rk of c.rocks) if (nRock < 3000) rockMesh.setMatrixAt(nRock++, rk.m);
    if (d < APPLE_R) for (const a of c.apples) nearApples.push(a);
  }
  for (const [set, ct] of [[nearTrees, cntN], [farTrees, cntF]]) {
    set.trunk.count = ct[0]; set.pine.count = ct[1]; set.round.count = ct[2]; set.cactus.count = ct[3];
    for (const im of Object.values(set)) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  rockMesh.count = nRock; rockMesh.instanceMatrix.needsUpdate = true;
  refreshApples();
  updateCamps();
}
function appleAlive(a) { const t = pickedApples.get(a.id); return t === undefined || gameClock > t; }
function refreshApples() {
  let n = 0;
  for (const a of nearApples) if (appleAlive(a) && n < 1500) { _m4.makeTranslation(a.x, a.y + 0.11, a.z); appleMesh.setMatrixAt(n++, _m4); }
  for (const a of dropApples) if (n < 1500) { _m4.makeTranslation(a.x, a.y + 0.11, a.z); appleMesh.setMatrixAt(n++, _m4); }
  appleMesh.count = n; appleMesh.instanceMatrix.needsUpdate = true;
}
function collideObjects(p, rad) {
  const pcx = Math.floor(p.x / CELL), pcz = Math.floor(p.z / CELL);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = cellCache.get(cellKey(pcx + dx, pcz + dz));
    if (!c) continue;
    for (const list of [c.trees, c.rocks]) for (const o of list) {
      if (!o.r || p.y > o.y + o.h || p.y + 1.8 < o.y) continue;
      const ox = p.x - o.x, oz = p.z - o.z, d = Math.hypot(ox, oz), m = o.r + rad;
      if (d < m && d > 1e-4) { p.x = o.x + ox / d * m; p.z = o.z + oz / d * m; }
    }
  }
}

// ---------- Shrine visuals ----------
const BEAM_H = 160;
const beams = (() => {
  const geo = new THREE.CylinderGeometry(2.2, 2.2, BEAM_H, 8, 1, true); geo.translate(0, BEAM_H / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const im = new THREE.InstancedMesh(geo, mat, shrines.length);
  shrines.forEach((s, i) => { im.setMatrixAt(i, _m4.makeTranslation(s.x, s.y, s.z)); im.setColorAt(i, _c.setHex(0xffa53a)); });
  im.frustumCulled = false;
  scene.add(im);
  return im;
})();
function updateShrineLook(s) {
  beams.setColorAt(s.i, _c.setHex(s.done ? 0x1a6a90 : 0xffa53a));
  beams.instanceColor.needsUpdate = true;
  if (s.mesh) {
    s.mesh.crystalMat.color.setHex(s.done ? 0x4fd2ff : 0xffa53a);
    s.mesh.crystalMat.emissive.setHex(s.done ? 0x1a8fd0 : 0xff7a10);
  }
}
const shrineGeo = {
  base: new THREE.CylinderGeometry(3.2, 3.6, 0.6, 8),
  pillar: new THREE.BoxGeometry(0.5, 3.2, 0.5),
  crystal: new THREE.OctahedronGeometry(0.9, 0),
};
const stoneMat = lam(0x6e6a64);
function ensureShrineMesh(s) {
  if (s.mesh) return;
  const g = new THREE.Group();
  g.position.set(s.x, s.y, s.z);
  const base = new THREE.Mesh(shrineGeo.base, stoneMat); base.position.y = 0.1; base.receiveShadow = true; g.add(base);
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + Math.PI / 4;
    const pil = new THREE.Mesh(shrineGeo.pillar, stoneMat);
    pil.position.set(Math.cos(a) * 2.6, 1.9, Math.sin(a) * 2.6); pil.castShadow = true; g.add(pil);
  }
  const crystalMat = new THREE.MeshLambertMaterial({ color: 0xffa53a, emissive: 0xff7a10, emissiveIntensity: 0.9 });
  const crystal = new THREE.Mesh(shrineGeo.crystal, crystalMat);
  crystal.position.y = 2.2; crystal.scale.y = 1.6; g.add(crystal);
  scene.add(g);
  s.mesh = { group: g, crystal, crystalMat };
  updateShrineLook(s);
}
function dropShrineMesh(s) {
  if (!s.mesh) return;
  scene.remove(s.mesh.group); s.mesh.crystalMat.dispose(); s.mesh = null;
}

// ---------- Player model (180cm) ----------
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
  const sword = new THREE.Group(); sword.position.set(0, -0.6, 0.05); arms[1].add(sword);
  add(new THREE.BoxGeometry(0.06, 0.06, 0.25), lam(0x3a2a1a), 0, 0, 0.05, sword);
  add(new THREE.BoxGeometry(0.3, 0.06, 0.06), lam(0x5577aa), 0, 0, 0.2, sword);
  add(new THREE.BoxGeometry(0.05, 0.1, 0.95), lam(0xdfe6ee, { emissive: 0x223344 }), 0, 0, 0.7, sword);
  const glider = new THREE.Group(); glider.position.y = 2.55; g.add(glider);
  glider.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 1.0), lam(0xc8553d)));
  glider.add(new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.06, 0.25), lam(0xf0d9a0)));
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 4), brown);
    pole.position.set(0.45 * sx, -0.45, 0); pole.rotation.z = -0.35 * sx; glider.add(pole);
  }
  glider.visible = false;
  // scale to exactly 180cm (top of hair is 1.98 model units)
  const wrap = new THREE.Group();
  g.scale.setScalar(PLAYER_HEIGHT / 1.98);
  wrap.add(g);
  return { group: wrap, body: g, legs, arms, sword, glider };
}
const PM = makePlayerModel();
scene.add(PM.group);

// ---------- Enemies (streamed per camp) ----------
const enemyGeo = {
  body: new THREE.SphereGeometry(0.55, 10, 8), head: new THREE.SphereGeometry(0.4, 10, 8),
  horn: new THREE.ConeGeometry(0.1, 0.35, 6), eye: new THREE.SphereGeometry(0.07, 6, 4),
  leg: new THREE.BoxGeometry(0.2, 0.5, 0.22), club: new THREE.CylinderGeometry(0.09, 0.16, 1.1, 6),
};
const enemyShared = { dark: lam(0x2a1a14), horn: lam(0xeeddbb), eye: lam(0xffee55, { emissive: 0xaa8800 }), club: lam(0x7a5a3a) };
function makeEnemyModel(guardian) {
  const g = new THREE.Group();
  const mat = lam(guardian ? 0x5b4ab0 : 0xc2483a);
  const body = new THREE.Mesh(enemyGeo.body, mat);
  body.scale.set(1, 1.15, 0.9); body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(enemyGeo.head, mat); head.position.set(0, 1.75, 0.08); head.castShadow = true; g.add(head);
  const horn = new THREE.Mesh(enemyGeo.horn, enemyShared.horn); horn.position.set(0, 2.18, 0.05); g.add(horn);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(enemyGeo.eye, enemyShared.eye); eye.position.set(0.15 * sx, 1.8, 0.42); g.add(eye);
    const leg = new THREE.Mesh(enemyGeo.leg, enemyShared.dark); leg.position.set(0.22 * sx, 0.25, 0); g.add(leg);
  }
  const arm = new THREE.Group(); arm.position.set(0.6, 1.25, 0); g.add(arm);
  const club = new THREE.Mesh(enemyGeo.club, enemyShared.club);
  club.position.set(0, -0.2, 0.5); club.rotation.x = Math.PI / 2; club.castShadow = true; arm.add(club);
  return { group: g, mat, arm };
}
const enemies = [];
const enemyDeadUntil = new Map();
const activeCamps = new Map();
function spawnEnemy(x, z, opts = {}) {
  const guardian = !!opts.guardian;
  const m = makeEnemyModel(guardian);
  const y = terrainH(x, z);
  const e = {
    id: opts.id || null, camp: opts.camp || null, model: m, home: new THREE.Vector3(x, y, z), pos: new THREE.Vector3(x, y, z),
    hp: guardian ? 4 + (opts.extraHp || 0) : 3, dead: false, facing: rng() * 6.28,
    wanderT: 0, wanderTarget: new THREE.Vector3(x, 0, z), windup: 0, cd: 0, flash: 0,
    kb: new THREE.Vector3(), guardian, trial: opts.trial || null, deathT: 0, speedMul: guardian ? 1.15 : 1,
  };
  m.group.position.copy(e.pos);
  scene.add(m.group);
  enemies.push(e);
  return e;
}
function removeEnemy(e) {
  scene.remove(e.model.group); e.model.mat.dispose();
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
}
function updateCamps() {
  const pcx = Math.floor(P.pos.x / CELL), pcz = Math.floor(P.pos.z / CELL), R = Math.ceil(CAMP_R / CELL);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const c = getCell(pcx + dx, pcz + dz);
    if (!c.camp || activeCamps.has(c.camp.id)) continue;
    if (Math.hypot(c.camp.x - P.pos.x, c.camp.z - P.pos.z) > CAMP_R) continue;
    activeCamps.set(c.camp.id, c.camp);
    for (let k = 0; k < c.camp.n; k++) {
      const id = c.camp.id + ':' + k;
      const until = enemyDeadUntil.get(id);
      if (until !== undefined && gameClock < until) continue;
      const a = k / c.camp.n * 6.283;
      spawnEnemy(c.camp.x + Math.cos(a) * 3, c.camp.z + Math.sin(a) * 3, { id, camp: c.camp.id });
    }
  }
  for (const [id, camp] of activeCamps) {
    if (Math.hypot(camp.x - P.pos.x, camp.z - P.pos.z) > CAMP_DROP_R) {
      for (const e of enemies.filter(e => e.camp === id)) removeEnemy(e);
      activeCamps.delete(id);
    }
  }
}

// ---------- Player state ----------
const P = {
  pos: new THREE.Vector3(SPAWN.x, SPAWN.h, SPAWN.z),
  vel: new THREE.Vector3(), vy: 0, state: 'ground', facing: 0,
  stamina: 100, maxStamina: 100, exhausted: false, regenDelay: 0,
  hp: 12, maxHp: 12, inv: 0, kb: new THREE.Vector3(),
  attackT: 0, hitDone: false, climbBoost: 0, tower: null, towerAngle: 0,
  lastSafe: new THREE.Vector3(SPAWN.x, SPAWN.h, SPAWN.z), safeT: 0,
  apples: 0, orbs: 0, walkPhase: 0, dead: false, speed: 0,
};
let gameClock = 0;

// ---------- Settings / graphics quality ----------
const SETTINGS_KEY = 'wildwind_settings_v1';
const QUALITY = {
  low:    { pr: 1,    shadow: 1024, shadowR: 40, split: 1.0, treeR: 650,  nearR: 90,  fogFar: 3800 },
  medium: { pr: 1.25, shadow: 2048, shadowR: 50, split: 1.4, treeR: 1000, nearR: 130, fogFar: 5200 },
  high:   { pr: 2,    shadow: 4096, shadowR: 60, split: 1.8, treeR: 1400, nearR: 180, fogFar: 6500 },
};
const settings = { quality: 'medium', sens: 1, invertY: false, fov: 65 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
if (!QUALITY[settings.quality]) settings.quality = 'medium';
function applySettings() {
  const q = QUALITY[settings.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  sun.shadow.mapSize.set(q.shadow, q.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sc.left = sc.bottom = -q.shadowR; sc.right = sc.top = q.shadowR; sc.updateProjectionMatrix();
  SPLIT = q.split; TREE_R = q.treeR; NEAR_TREE_R = q.nearR;
  scene.fog.far = q.fogFar;
  camera.fov = settings.fov;
  resize();
  if (started) { rebuildObjects(true); updateTerrain(); }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}

// ---------- Input (keyboard + mouse with pointer lock) ----------
const input = { kx: 0, ky: 0, sprintKey: false, jumpPressed: false, attackPressed: false, interactPressed: false, eatPressed: false };
const keys = new Set();
const cam = { yaw: Math.PI, pitch: 0.35, dist: 6.5, zoom: 1, target: new THREE.Vector3() };
let paused = false;
const pauseEl = document.getElementById('pause');
const isLocked = () => document.pointerLockElement === canvas;
function requestLock() {
  try { const r = canvas.requestPointerLock?.({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { canvas.requestPointerLock(); } catch (e) {} }); } catch (e) {}
}
function overlayOpen() { return mapOpen || P.dead || !rewardEl.classList.contains('hidden'); }
function setPaused(v) {
  paused = v;
  pauseEl.classList.toggle('hidden', !v);
  if (v) { document.getElementById('pauseSettings').appendChild(settingsPanel); keys.clear(); if (isLocked()) document.exitPointerLock(); }
  else requestLock();
}
document.addEventListener('pointerlockchange', () => {
  if (!isLocked() && started && !paused && !overlayOpen()) setPaused(true);
});
window.addEventListener('keydown', e => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (!started) return;
  if (e.code === 'KeyM' || e.code === 'Tab') { if (!paused && rewardEl.classList.contains('hidden')) toggleMap(); return; }
  if (e.code === 'Escape') { if (mapOpen) toggleMap(); else if (paused) setPaused(false); return; }
  if (paused || overlayOpen()) return;
  keys.add(e.code);
  if (e.code === 'Space') input.jumpPressed = true;
  if (e.code === 'KeyE' || e.code === 'KeyF') input.interactPressed = true;
  if (e.code === 'KeyQ') input.eatPressed = true;
  if (e.code === 'KeyJ') input.attackPressed = true;
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
function readKeys() {
  input.kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  input.ky = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  input.sprintKey = keys.has('ShiftLeft') || keys.has('ShiftRight');
}
canvas.addEventListener('mousedown', e => {
  if (!started || paused || overlayOpen()) return;
  if (!isLocked()) { requestLock(); return; }
  if (e.button === 0) input.attackPressed = true;
});
document.addEventListener('mousemove', e => {
  if (!started || paused || overlayOpen()) return;
  // with pointer lock: free look; without (lock unavailable): drag with the left button
  if (!isLocked() && !(e.buttons & 1)) return;
  const k = 0.0022 * settings.sens;
  cam.yaw -= e.movementX * k;
  cam.pitch = clamp(cam.pitch + e.movementY * k * (settings.invertY ? -1 : 1), -0.35, 1.3);
});
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = clamp(cam.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.45, 2.5); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// settings panel (shown on the title screen and in the pause menu)
const settingsPanel = document.getElementById('settingsPanel');
{
  const q = document.getElementById('setQuality'), sens = document.getElementById('setSens'), fov = document.getElementById('setFov'), inv = document.getElementById('setInvert');
  q.value = settings.quality; sens.value = settings.sens; fov.value = settings.fov; inv.checked = settings.invertY;
  const label = () => { document.getElementById('sensVal').textContent = (+sens.value).toFixed(1); document.getElementById('fovVal').textContent = fov.value + '°'; };
  label();
  q.addEventListener('change', () => { settings.quality = q.value; applySettings(); });
  sens.addEventListener('input', () => { settings.sens = +sens.value; label(); applySettings(); });
  fov.addEventListener('input', () => { settings.fov = +fov.value; label(); camera.fov = settings.fov; camera.updateProjectionMatrix(); applySettings(); });
  inv.addEventListener('change', () => { settings.invertY = inv.checked; applySettings(); });
}
document.getElementById('btnResume').addEventListener('click', () => setPaused(false));
document.getElementById('btnSaveQuit').addEventListener('click', () => { save(); location.reload(); });

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
const appleCountEl = document.getElementById('appleCount');
const coordEl = document.getElementById('coords');
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
  const n = P.maxHp / 4, per = 10, s = 22, gap = 25, rows = Math.ceil(n / per);
  const cols = Math.min(n, per);
  heartsCv.width = (cols * gap + 14) * 2; heartsCv.height = (rows * 25 + 4) * 2;
  heartsCv.style.width = heartsCv.width / 2 + 'px'; heartsCv.style.height = heartsCv.height / 2 + 'px';
  hctx.setTransform(2, 0, 0, 2, 0, 0);
  for (let i = 0; i < n; i++) {
    const x = 14 + (i % per) * gap, y = 3 + Math.floor(i / per) * 25;
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
  document.getElementById('info').style.top = `calc(${heartsCv.height / 2 + 14}px + env(safe-area-inset-top))`;
}

// Maps
const MAP_RES = 1024;
const mapImg = document.createElement('canvas'); mapImg.width = mapImg.height = MAP_RES;
let mapReady = false;
const miniImg = document.createElement('canvas');
let mini = null, miniPending = false;
const miniCv = document.getElementById('minimap'), mctx = miniCv.getContext('2d');
const bigCv = document.getElementById('bigmap'), bctx = bigCv.getContext('2d');
const mapView = document.getElementById('mapView');
const mapSel = document.getElementById('mapSel'), mapSelText = document.getElementById('mapSelText');
let mapOpen = false;
const mapState = { zoom: 1, cx: 0, cz: 0, sel: null, selKind: null };
function toggleMap() {
  if (!started) return;
  mapOpen = !mapOpen;
  mapView.classList.toggle('hidden', !mapOpen);
  if (mapOpen) document.exitPointerLock?.(); else requestLock();
  if (mapOpen) { mapState.cx = P.pos.x; mapState.cz = P.pos.z; mapState.sel = null; mapSel.classList.add('hidden'); drawBigMap(); }
}
worker.onmessage = e => {
  const m = e.data;
  if (m.type === 'chunk') onChunk(m);
  else if (m.type === 'map') {
    mapImg.getContext('2d').putImageData(new ImageData(m.data, m.res, m.res), 0, 0);
    mapReady = true;
    if (mapOpen) drawBigMap();
  } else if (m.type === 'mini') {
    miniImg.width = miniImg.height = m.res;
    miniImg.getContext('2d').putImageData(new ImageData(m.data, m.res, m.res), 0, 0);
    mini = { cx: m.cx, cz: m.cz, span: m.span }; miniPending = false;
  }
};
function drawMarker(ctx, x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
}
function drawArrow(ctx, x, y, ang, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-ang + Math.PI);
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.8); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.7, s * 0.8); ctx.closePath();
  ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}
const MINI_VIEW = 240;
function drawMinimap() {
  const W = 140, k = W / MINI_VIEW;           // logical size; canvas is drawn at higher resolution
  mctx.setTransform(miniCv.width / W, 0, 0, miniCv.width / W, 0, 0);
  if (!miniPending && (!mini || Math.hypot(mini.cx - P.pos.x, mini.cz - P.pos.z) > 70)) {
    miniPending = true;
    worker.postMessage({ type: 'mini', cx: Math.round(P.pos.x), cz: Math.round(P.pos.z), span: 480, res: 192 });
  }
  mctx.save();
  mctx.beginPath(); mctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#1d4f7a'; mctx.fillRect(0, 0, W, W);
  if (mini && Math.hypot(mini.cx - P.pos.x, mini.cz - P.pos.z) < 120) {
    const pxPerM = miniImg.width / mini.span;
    const sx = (P.pos.x - MINI_VIEW / 2 - (mini.cx - mini.span / 2)) * pxPerM, sz = (P.pos.z - MINI_VIEW / 2 - (mini.cz - mini.span / 2)) * pxPerM;
    mctx.drawImage(miniImg, sx, sz, MINI_VIEW * pxPerM, MINI_VIEW * pxPerM, 0, 0, W, W);
  } else if (mapReady) {
    const toPx = MAP_RES / SIZE;
    mctx.drawImage(mapImg, (P.pos.x + HALF - MINI_VIEW / 2) * toPx, (P.pos.z + HALF - MINI_VIEW / 2) * toPx, MINI_VIEW * toPx, MINI_VIEW * toPx, 0, 0, W, W);
  }
  const toMini = (x, z) => [W / 2 + (x - P.pos.x) * k, W / 2 + (z - P.pos.z) * k];
  const edgeClamp = (x, y) => {
    const dx = x - W / 2, dy = y - W / 2, d = Math.hypot(dx, dy), lim = W / 2 - 7;
    return d > lim ? [W / 2 + dx / d * lim, W / 2 + dy / d * lim] : [x, y];
  };
  for (const t of towers) if (Math.hypot(t.x - P.pos.x, t.z - P.pos.z) < 1500) { const [x, y] = edgeClamp(...toMini(t.x, t.z)); drawMarker(mctx, x, y, 5, t.activated ? '#c9a0ff' : '#776a99'); }
  for (const s of shrines) if (s.discovered && Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < 1500) {
    const [x, y] = edgeClamp(...toMini(s.x, s.z));
    drawMarker(mctx, x, y, 5, s.done ? '#4fd2ff' : '#ffa53a');
  }
  for (const e of enemies) if (!e.dead) {
    const [x, y] = toMini(e.pos.x, e.pos.z);
    if (Math.hypot(x - W / 2, y - W / 2) < W / 2 - 4 && P.pos.distanceTo(e.pos) < 60) { mctx.fillStyle = '#ff4040'; mctx.fillRect(x - 2, y - 2, 4, 4); }
  }
  drawArrow(mctx, W / 2, W / 2, P.facing, 8);
  mctx.restore();
}
function mapToScreen(x, z) {
  const W = bigCv.width, view = SIZE / mapState.zoom;
  return [(x - (mapState.cx - view / 2)) / view * W, (z - (mapState.cz - view / 2)) / view * W];
}
function clampMapCenter() {
  const view = SIZE / mapState.zoom, lim = HALF - view / 2;
  mapState.cx = clamp(mapState.cx, -lim, lim); mapState.cz = clamp(mapState.cz, -lim, lim);
}
function drawBigMap() {
  clampMapCenter();
  const W = bigCv.width, view = SIZE / mapState.zoom;
  bctx.fillStyle = '#1d4f7a'; bctx.fillRect(0, 0, W, W);
  if (mapReady) {
    const toPx = MAP_RES / SIZE;
    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(mapImg, (mapState.cx - view / 2 + HALF) * toPx, (mapState.cz - view / 2 + HALF) * toPx, view * toPx, view * toPx, 0, 0, W, W);
  } else { bctx.fillStyle = '#fff'; bctx.font = '24px sans-serif'; bctx.fillText('지도 생성 중...', W / 2 - 80, W / 2); }
  bctx.strokeStyle = 'rgba(255,255,255,.12)'; bctx.lineWidth = 1;
  for (let g = -4000; g <= 4000; g += 1000) {
    const [x] = mapToScreen(g, 0), [, y] = mapToScreen(0, g);
    bctx.beginPath(); bctx.moveTo(x, 0); bctx.lineTo(x, W); bctx.stroke();
    bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(W, y); bctx.stroke();
  }
  const r = 4 + mapState.zoom * 1.2;
  for (const t of towers) { const [x, y] = mapToScreen(t.x, t.z); drawMarker(bctx, x, y, r + 2, t.activated ? '#c9a0ff' : '#776a99'); }
  for (const s of shrines) if (s.discovered) { const [x, y] = mapToScreen(s.x, s.z); drawMarker(bctx, x, y, r, s.done ? '#4fd2ff' : '#ffa53a'); }
  if (mapState.sel) {
    const [x, y] = mapToScreen(mapState.sel.x, mapState.sel.z);
    bctx.beginPath(); bctx.arc(x, y, r + 8, 0, Math.PI * 2); bctx.strokeStyle = '#ffe14a'; bctx.lineWidth = 3; bctx.stroke();
  }
  const [px, py] = mapToScreen(P.pos.x, P.pos.z); drawArrow(bctx, px, py, P.facing, 12);
  const barM = mapState.zoom >= 4 ? 250 : 1000, barPx = barM / view * W;
  bctx.fillStyle = 'rgba(0,0,0,.5)'; bctx.fillRect(12, W - 34, barPx + 16, 26);
  bctx.fillStyle = '#fff'; bctx.fillRect(20, W - 14, barPx, 3);
  bctx.font = '14px sans-serif'; bctx.fillText(barM >= 1000 ? '1 km' : barM + ' m', 22, W - 19);
}
{
  const mp = new Map();
  let downX = 0, downY = 0, moved = false;
  const cssToCanvas = e => { const r = bigCv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * bigCv.width, (e.clientY - r.top) / r.height * bigCv.height]; };
  bigCv.addEventListener('pointerdown', e => { e.preventDefault(); bigCv.setPointerCapture?.(e.pointerId); mp.set(e.pointerId, [e.clientX, e.clientY]); downX = e.clientX; downY = e.clientY; moved = false; });
  bigCv.addEventListener('pointermove', e => {
    const last = mp.get(e.pointerId); if (!last) return;
    const r = bigCv.getBoundingClientRect(), view = SIZE / mapState.zoom;
    mapState.cx -= (e.clientX - last[0]) / r.width * view; mapState.cz -= (e.clientY - last[1]) / r.height * view;
    mp.set(e.pointerId, [e.clientX, e.clientY]);
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
    drawBigMap();
  });
  bigCv.addEventListener('pointerup', e => {
    if (!mp.has(e.pointerId)) return;
    mp.delete(e.pointerId);
    if (moved) return;
    const [px, py] = cssToCanvas(e);
    let best = null, bd = 30;
    const cand = [...towers.map(o => ({ kind: 'tower', o })), ...shrines.filter(s => s.discovered).map(o => ({ kind: 'shrine', o }))];
    for (const c of cand) { const [x, y] = mapToScreen(c.o.x, c.o.z); const d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = c; } }
    mapState.sel = best ? best.o : null; mapState.selKind = best ? best.kind : null;
    if (best) {
      const o = best.o, canGo = best.kind === 'tower' ? o.activated : o.done;
      const name = best.kind === 'tower' ? o.name : `사당 ${o.i + 1}`;
      const dist = Math.hypot(o.x - P.pos.x, o.z - P.pos.z);
      mapSelText.textContent = `${name} · ${dist >= 1000 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm'}${canGo ? '' : (best.kind === 'tower' ? ' (미활성)' : ' (미정화)')}`;
      document.getElementById('btnTravel').classList.toggle('hidden', !canGo);
      mapSel.classList.remove('hidden');
    } else mapSel.classList.add('hidden');
    drawBigMap();
  });
  bigCv.addEventListener('pointercancel', e => mp.delete(e.pointerId));
  bigCv.addEventListener('wheel', e => { e.preventDefault(); zoomMap(e.deltaY < 0 ? 2 : 0.5); }, { passive: false });
}
function zoomMap(f) { mapState.zoom = clamp(mapState.zoom * f, 1, 16); drawBigMap(); }
document.getElementById('btnZoomIn').addEventListener('click', () => zoomMap(2));
document.getElementById('btnZoomOut').addEventListener('click', () => zoomMap(0.5));
document.getElementById('btnMapMe').addEventListener('click', () => { mapState.cx = P.pos.x; mapState.cz = P.pos.z; if (mapState.zoom < 4) mapState.zoom = 4; drawBigMap(); });
document.getElementById('btnMapClose').addEventListener('click', () => toggleMap());
document.getElementById('btnTravel').addEventListener('click', () => {
  const o = mapState.sel; if (!o) return;
  const kind = mapState.selKind;
  toggleMap();
  if (kind === 'tower') teleport(o.x + o.r + 2.5, o.z); else teleport(o.x + 4.5, o.z);
});
let loadingWait = false;
const loadingEl = document.getElementById('loading');
function teleport(x, z) {
  if (trialShrine) { for (const e of enemies.filter(e => e.trial === trialShrine)) removeEnemy(e); trialShrine.trial = false; trialShrine = null; }
  P.pos.set(x, terrainH(x, z), z); P.state = 'ground'; P.vy = 0; P.vel.set(0, 0, 0); P.lastSafe.copy(P.pos);
  cam.target.copy(P.pos);
  for (const e of [...enemies]) removeEnemy(e);
  activeCamps.clear();
  rebuildObjects(true); updateTerrain();
  loadingWait = true; loadingEl.classList.remove('hidden');
  sfx(880, 0.4, 'sine', 0.06, -500);
}

// ---------- Save ----------
let started = false;
let dayTime = 8 / 24;
let trialShrine = null;
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      shrines: shrines.map(s => (s.done ? 2 : 0) + (s.discovered ? 1 : 0)).join(''),
      towers: towers.map(t => t.activated ? 1 : 0).join(''),
      maxHp: P.maxHp, maxStamina: P.maxStamina, apples: P.apples, orbs: P.orbs,
      pos: [P.lastSafe.x, P.lastSafe.y, P.lastSafe.z], dayTime,
    }));
  } catch (e) { /* storage unavailable */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!d) return false;
    [...d.shrines].forEach((v, i) => { if (shrines[i]) { shrines[i].done = (+v & 2) > 0; shrines[i].discovered = (+v & 1) > 0; } });
    [...d.towers].forEach((v, i) => { if (towers[i]) towers[i].activated = v === '1'; });
    P.maxHp = d.maxHp; P.hp = d.maxHp; P.maxStamina = d.maxStamina; P.stamina = d.maxStamina; P.apples = d.apples; P.orbs = d.orbs || 0;
    P.pos.set(...d.pos); P.lastSafe.set(...d.pos); dayTime = d.dayTime ?? dayTime;
    shrines.forEach(updateShrineLook); towers.forEach(updateTowerLook);
    return true;
  } catch (e) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function updateTowerLook(t) {
  t.capMat.color.setHex(t.activated ? 0x4fd2ff : 0x9a8cff);
  t.capMat.emissive.setHex(t.activated ? 0x1a8fd0 : 0x6a50ff);
  t.capMat.emissiveIntensity = t.activated ? 1 : 0.4;
}

// ---------- Player helpers ----------
const _v = new THREE.Vector3();
function moveVector(out) {
  let jx = input.kx, jy = input.ky;
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
function die() { P.dead = true; document.getElementById('gameover').classList.remove('hidden'); document.exitPointerLock?.(); }
function respawn() {
  P.dead = false; P.hp = P.maxHp; P.stamina = P.maxStamina; P.exhausted = false;
  P.pos.copy(P.lastSafe); P.state = 'ground'; P.vy = 0; P.vel.set(0, 0, 0); P.inv = 2;
  document.getElementById('gameover').classList.add('hidden');
  requestLock();
}
function enterClimbTerrain() { P.state = 'climb'; P.tower = null; P.vy = 0; sfx(300, 0.05, 'triangle', 0.04); }
function tryTowerClimb(mv) {
  for (const t of climbables) {
    if (Math.abs(P.pos.x - t.x) > t.r + 2 || Math.abs(P.pos.z - t.z) > t.r + 2) continue;
    const dx = P.pos.x - t.x, dz = P.pos.z - t.z, d = Math.hypot(dx, dz);
    if (d < towerClimbR(t) + 0.15 && P.pos.y < t.top - 0.3 && P.pos.y > t.base - 1) {
      if (mv.lengthSq() > 0.04 && (mv.x * -dx + mv.z * -dz) / d > 0.4 * mv.length() && canClimb()) {
        P.state = 'climb'; P.tower = t; P.towerAngle = Math.atan2(dz, dx); P.vy = 0;
        return true;
      }
      const R = towerClimbR(t);
      P.pos.x = t.x + dx / d * R; P.pos.z = t.z + dz / d * R;
    }
  }
  return false;
}
function clampWorld() {
  const lim = HALF - 20;
  P.pos.x = clamp(P.pos.x, -lim, lim); P.pos.z = clamp(P.pos.z, -lim, lim);
}

// ---------- Player update ----------
const mv = new THREE.Vector3();
function updatePlayer(dt) {
  moveVector(mv);
  const mag = mv.length();
  const wantSprint = input.sprintKey && mag > 0.1 && !P.exhausted;
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
          if (canClimb()) { P.pos.set(nx, hNew, nz); enterClimbTerrain(); }
        } else { P.pos.x = nx; P.pos.z = nz; }
        P.facing = angleLerp(P.facing, Math.atan2(mv.x, mv.z), Math.min(1, dt * 12));
      }
      P.speed = spd;
      if (P.kb.lengthSq() > 0.01) { P.pos.addScaledVector(P.kb, dt); P.kb.multiplyScalar(Math.exp(-7 * dt)); }
      if (P.state !== 'ground') break;
      collideObjects(P.pos, 0.4);
      if (tryTowerClimb(mv)) break;
      clampWorld();
      const g = groundAt(P.pos.x, P.pos.z, P.pos.y);
      const isTerrain = g <= terrainH(P.pos.x, P.pos.z) + 0.01;
      const n = normalAt(P.pos.x, P.pos.z);
      if (isTerrain && n.y < STEEP) {
        const hl = Math.hypot(n.x, n.z) || 1;
        P.pos.x += n.x / hl * 7 * dt; P.pos.z += n.z / hl * 7 * dt;
      }
      const g2 = groundAt(P.pos.x, P.pos.z, P.pos.y);
      if (g2 < P.pos.y - 0.7) { P.state = 'air'; P.vy = 0; P.vel.set(mv.x * spd, 0, mv.z * spd); break; }
      P.pos.y = g2;
      if (WATER - g2 > 1.1) { P.state = 'swim'; break; }
      P.safeT += dt;
      if (P.safeT > 1 && isTerrain && n.y > 0.8 && g2 > WATER + 0.5) { P.safeT = 0; P.lastSafe.copy(P.pos); }
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
        if (mag > 0.1) P.facing = angleLerp(P.facing, Math.atan2(mv.x, mv.z), Math.min(1, dt * 2.5));
        const gs = 9.5;
        P.vel.set(Math.sin(P.facing) * gs, 0, Math.cos(P.facing) * gs);
        useStamina(3 * dt);
        if (P.stamina <= 0 || input.jumpPressed) { P.state = 'air'; input.jumpPressed = false; }
      } else {
        P.vy = Math.max(P.vy - GRAVITY * dt, -55);
        const target = wantSprint ? 7 : 5.5;
        P.vel.x = lerp(P.vel.x, mv.x * target, Math.min(1, dt * 2.5));
        P.vel.z = lerp(P.vel.z, mv.z * target, Math.min(1, dt * 2.5));
        if (mag > 0.1) P.facing = angleLerp(P.facing, Math.atan2(mv.x, mv.z), Math.min(1, dt * 6));
        if (input.jumpPressed && canClimb()) { P.state = 'glide'; P.vy = Math.max(P.vy, -4); sfx(220, 0.15, 'triangle', 0.05, 120); }
      }
      const nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
      const hNew = terrainH(nx, nz);
      if (hNew > P.pos.y + 0.4) {
        if (normalAt(nx, nz).y < STEEP && canClimb() && mag > 0.1) { P.pos.set(nx, hNew, nz); enterClimbTerrain(); break; }
        P.vel.x *= 0.2; P.vel.z *= 0.2;
      } else { P.pos.x = nx; P.pos.z = nz; }
      P.pos.y += P.vy * dt;
      collideObjects(P.pos, 0.4);
      if (tryTowerClimb(mv)) break;
      clampWorld();
      const g = groundAt(P.pos.x, P.pos.z, P.pos.y);
      if (WATER - g > 1.1 && P.pos.y < WATER - 0.6) { P.state = 'swim'; P.vy = 0; sfx(180, 0.25, 'sine', 0.06, -60); break; }
      if (P.pos.y <= g) {
        P.pos.y = g;
        if (!gliding && P.vy < -24) hurt(Math.ceil((-P.vy - 24) / 4) * 2);
        P.state = 'ground'; P.vy = 0;
      }
      break;
    }
    case 'climb': {
      if (P.tower) {
        const t = P.tower, R = towerClimbR(t);
        const sp = 3.0 * (P.climbBoost > 0 ? 2.4 : 1);
        const up = input.ky, side = input.kx;
        P.pos.y += clamp(up, -1, 1) * sp * dt;
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
          const inset = Math.min(1.2, t.r * 0.1);
          P.pos.set(t.x + Math.cos(P.towerAngle) * (t.r - inset), t.top, t.z + Math.sin(P.towerAngle) * (t.r - inset));
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
      const ox = n.x / hl, oz = n.z / hl, ux = -ox, uz = -oz;
      let px = -oz, pz = ox;
      const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      if (px * rx + pz * rz < 0) { px = -px; pz = -pz; }
      const up = clamp(input.ky, -1, 1), side = clamp(input.kx, -1, 1);
      const sp = 2.0 * (P.climbBoost > 0 ? 2.8 : 1);
      P.pos.x += (ux * up * n.y + px * side) * sp * dt;
      P.pos.z += (uz * up * n.y + pz * side) * sp * dt;
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
      const sprinting = input.sprintKey && P.stamina > 0 && mag > 0.1;
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
  if (P.pos.y < -60) { hurt(4); P.inv = 0; if (!P.dead) respawn(); }
}

// ---------- Enemies update ----------
function hitEnemy(e, nx, nz) {
  e.hp -= 1; e.flash = 0.15; e.kb.set(nx * 10, 0, nz * 10); e.windup = 0;
  sfx(240, 0.1, 'square', 0.06, -120);
  if (e.hp <= 0) {
    e.dead = true; e.deathT = 0.6;
    sfx(120, 0.3, 'sawtooth', 0.06, -60);
    if (e.id) enemyDeadUntil.set(e.id, gameClock + 600);
    if (!e.trial && rng() < 0.6) { dropApples.push({ x: e.pos.x + nx * 0.5, z: e.pos.z + nz * 0.5, y: terrainH(e.pos.x, e.pos.z) }); refreshApples(); }
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
        if (e.deathT <= 0) removeEnemy(e);
      }
      continue;
    }
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    if (d > 150 && !e.trial) { g.visible = false; continue; }
    g.visible = true;
    const aggro = e.trial ? 60 : night ? 24 : 18;
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
      } else if (d < 1.9 && e.cd <= 0) e.windup = 0.6;
      else if (d > 1.6) { moveX = dx / d; moveZ = dz / d; spd = 3.4 * e.speedMul; }
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
    const nx = e.pos.x + moveX * spd * dt + e.kb.x * dt, nz = e.pos.z + moveZ * spd * dt + e.kb.z * dt;
    e.kb.multiplyScalar(Math.exp(-8 * dt));
    if (terrainH(nx, nz) > WATER + 0.3 && normalAt(nx, nz).y > STEEP) { e.pos.x = nx; e.pos.z = nz; }
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
    if (Math.abs(P.pos.x - s.x) > 6 || Math.abs(P.pos.z - s.z) > 6) continue;
    if (!s.done && !s.trial && Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 4.2 && Math.abs(P.pos.y - s.y) < 3) return { type: 'shrine', s, label: '[E] 사당의 시련 시작' };
  }
  for (const t of towers) {
    if (!t.activated && Math.hypot(P.pos.x - t.x, P.pos.z - t.z) < t.r + 0.9 && P.pos.y >= t.top - 0.2) return { type: 'tower', t, label: '[E] 탑 활성화' };
  }
  return null;
}
function startTrial(s) {
  s.trial = true; trialShrine = s;
  const done = shrines.filter(x => x.done).length;
  const n = Math.min(5, 2 + Math.floor(done / 20));
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + rng();
    let x = s.x + Math.cos(a) * 9, z = s.z + Math.sin(a) * 9;
    if (terrainH(x, z) < WATER + 0.5) { x = s.x + Math.cos(a) * 5; z = s.z + Math.sin(a) * 5; }
    spawnEnemy(x, z, { guardian: true, trial: s, extraHp: Math.floor(done / 15) });
  }
  toast('⚔️ 시련 시작! 수호자를 모두 쓰러뜨려라');
  sfx(330, 0.4, 'sawtooth', 0.05, 200);
}
function updateTrial() {
  if (!trialShrine) return;
  const s = trialShrine;
  const alive = enemies.filter(e => e.trial === s && !e.dead);
  if (Math.hypot(P.pos.x - s.x, P.pos.z - s.z) > 70 || P.dead) {
    for (const e of enemies.filter(e => e.trial === s)) removeEnemy(e);
    s.trial = false; trialShrine = null; toast('시련에서 벗어났다');
    return;
  }
  if (alive.length === 0) {
    s.trial = false; s.done = true; trialShrine = null;
    updateShrineLook(s);
    P.orbs++;
    const doneCount = shrines.filter(x => x.done).length;
    toast(`✨ 사당 정화 완료! (${doneCount}/${shrines.length})<br>빛의 구슬 획득 (${P.orbs % 4 === 0 ? 4 : P.orbs % 4}/4)`, 4);
    fanfare(); save();
    if (P.orbs % 4 === 0) setTimeout(openReward, 1500);
    if (doneCount === shrines.length) setTimeout(() => toast('🏆 사당 120곳을 모두 정화했다! 대지에 바람이 돌아왔다.', 8), 4500);
  }
}
const rewardEl = document.getElementById('reward');
function openReward() {
  const heartMax = P.maxHp >= 120, stamMax = P.maxStamina >= 300;
  document.getElementById('btnRewardHeart').disabled = heartMax;
  document.getElementById('btnRewardStamina').disabled = stamMax;
  if (heartMax && stamMax) return;
  rewardEl.classList.remove('hidden');
  document.exitPointerLock?.();
}
document.getElementById('btnRewardHeart').addEventListener('click', () => {
  P.maxHp += 4; P.hp = P.maxHp; rewardEl.classList.add('hidden'); requestLock(); toast('❤️ 하트 그릇 +1'); fanfare(); save();
});
document.getElementById('btnRewardStamina').addEventListener('click', () => {
  P.maxStamina += 20; P.stamina = P.maxStamina; P.exhausted = false; rewardEl.classList.add('hidden'); requestLock(); toast('🟢 기력의 그릇 +20%'); fanfare(); save();
});
function activateTower(t) {
  t.activated = true; updateTowerLook(t);
  let n = 0;
  for (const s of shrines) if (Math.hypot(s.x - t.x, s.z - t.z) < 1600 && !s.discovered) { s.discovered = true; n++; }
  toast(`📡 ${t.name} 활성화! 지도에 사당 ${n}곳이 표시되었다<br>이제 지도에서 이 탑으로 빠른 이동 가능`, 5);
  fanfare(); save();
}

// ---------- Day / night ----------
const daySky = new THREE.Color(0x8cc8ff), duskSky = new THREE.Color(0xf2a774), nightSky = new THREE.Color(0x0d1a33);
const sunDir = new THREE.Vector3();
function updateSky(dt) {
  dayTime = (dayTime + dt / DAY_LENGTH) % 1;
  const hrs = dayTime * 24;
  const a = (hrs - 6) / 12 * Math.PI;
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

// ---------- Player model animation ----------
function animatePlayer(dt, t) {
  const g = PM.group, b = PM.body;
  g.position.copy(P.pos);
  g.rotation.set(0, P.facing, 0);
  b.rotation.set(0, 0, 0); b.position.set(0, 0, 0);
  const [lL, lR] = PM.legs, [aL, aR] = PM.arms;
  PM.glider.visible = P.state === 'glide';
  g.visible = P.inv <= 0 || Math.floor(t * 20) % 2 === 0 || P.dead;
  aL.rotation.z = aR.rotation.z = 0;
  if (P.state === 'ground') {
    const moving = P.speed > 0.3;
    P.walkPhase += dt * (moving ? P.speed * 1.7 : 0);
    const sw = moving ? Math.sin(P.walkPhase) * Math.min(0.9, P.speed * 0.12) : 0;
    lL.rotation.x = sw; lR.rotation.x = -sw;
    aL.rotation.x = -sw * 0.8;
    if (P.attackT > 0) {
      const k = 1 - P.attackT / 0.4;
      aR.rotation.x = lerp(-2.9, -0.4, smooth(0.1, 0.55, k));
      b.rotation.y = Math.sin(k * Math.PI) * 0.4;
    } else aR.rotation.x = sw * 0.8 - 0.3;
    b.position.y = moving ? Math.abs(Math.sin(P.walkPhase)) * 0.06 : 0;
  } else if (P.state === 'air') {
    lL.rotation.x = -0.5; lR.rotation.x = 0.3; aL.rotation.x = -1.2; aR.rotation.x = -1.0;
  } else if (P.state === 'glide') {
    lL.rotation.x = 0.2; lR.rotation.x = 0.35; aL.rotation.x = aR.rotation.x = -Math.PI + 0.15;
    aL.rotation.z = -0.25; aR.rotation.z = 0.25;
    b.rotation.x = 0.15;
  } else if (P.state === 'climb') {
    P.walkPhase += dt * 6 * (Math.abs(input.ky) + Math.abs(input.kx) > 0.1 ? 1 : 0);
    const s = Math.sin(P.walkPhase);
    aL.rotation.x = -2.4 + s * 0.5; aR.rotation.x = -2.4 - s * 0.5;
    lL.rotation.x = -0.6 - s * 0.4; lR.rotation.x = -0.6 + s * 0.4;
    if (!P.tower) { const n = normalAt(P.pos.x, P.pos.z); b.rotation.x = Math.acos(clamp(n.y, -1, 1)) * 0.5; }
  } else if (P.state === 'swim') {
    P.walkPhase += dt * 5;
    const s = Math.sin(P.walkPhase);
    aL.rotation.x = -1.5 + s; aR.rotation.x = -1.5 - s; lL.rotation.x = s * 0.4; lR.rotation.x = -s * 0.4;
    b.rotation.x = 0.9; b.position.y = 0.6;
  }
}

// ---------- Camera ----------
function updateCamera(dt) {
  const tgt = _v.copy(P.pos); tgt.y += 1.45;
  cam.target.lerp(tgt, Math.min(1, dt * 10));
  if (cam.target.distanceTo(tgt) > 30) cam.target.copy(tgt);
  const want = (P.state === 'glide' ? 9 : P.state === 'climb' ? 7.5 : 6.5) * cam.zoom;
  cam.dist = lerp(cam.dist, want, Math.min(1, dt * 3));
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  camera.position.set(
    cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
    cam.target.y + sp * cam.dist,
    cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  const minY = Math.max(terrainH(camera.position.x, camera.position.z), WATER) + 0.6;
  if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(cam.target);
  sun.position.copy(P.pos).addScaledVector(sunDir, 110);
  sun.target.position.copy(P.pos);
  water.position.x = Math.round(camera.position.x / 100) * 100;
  water.position.z = Math.round(camera.position.z / 100) * 100;
}

// ---------- HUD ----------
const _proj = new THREE.Vector3();
let hudT = 0;
function updateHUD(dt) {
  drawHearts();
  const frac = P.stamina / P.maxStamina;
  staminaRing.style.strokeDashoffset = String(125.66 * (1 - frac));
  const show = frac < 0.999 || P.exhausted;
  staminaEl.style.opacity = show ? '1' : '0';
  staminaEl.classList.toggle('exhausted', P.exhausted);
  staminaEl.classList.toggle('warn', !P.exhausted && frac < 0.3);
  _proj.copy(P.pos); _proj.y += 1.6; _proj.project(camera);
  const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth + 46, sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight - 28;
  const sz = 56 * Math.min(1.6, 1 + Math.max(0, P.maxStamina - 100) / 200);
  staminaEl.style.width = staminaEl.style.height = sz + 'px';
  staminaEl.style.transform = `translate(${sx - sz / 2}px, ${sy - sz / 2}px)`;
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.classList.remove('show'); }
  const it = currentInteraction();
  promptEl.textContent = it ? it.label : '';
  promptEl.classList.toggle('show', !!it);
  appleCountEl.textContent = P.apples;
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.2;
    drawMinimap();
    shrineCountEl.textContent = `사당 ${shrines.filter(s => s.done).length}/${shrines.length}`;
    coordEl.textContent = `${Math.round(P.pos.x)}, ${Math.round(-P.pos.z)} · 고도 ${Math.round(P.pos.y)}m`;
  }
}

// ---------- Shrine streaming / discovery ----------
let shrineScanT = 0;
function updateShrines(dt, t) {
  shrineScanT -= dt;
  if (shrineScanT <= 0) {
    shrineScanT = 0.5;
    for (const s of shrines) {
      const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z);
      if (d < 500) ensureShrineMesh(s); else if (d > 650) dropShrineMesh(s);
      if (!s.discovered && d < 250) { s.discovered = true; toast('새로운 사당을 발견했다!'); save(); }
      // light beams are visible within 1.5km (like a glow you can spot from a hill)
      const show = d < 1500 || (s.discovered && !s.done && d < 2500);
      if (show !== s.beamOn) { s.beamOn = show; beams.setMatrixAt(s.i, show ? _m4.makeTranslation(s.x, s.y, s.z) : _m4.makeScale(0, 0, 0)); beams.instanceMatrix.needsUpdate = true; }
    }
  }
  for (const s of shrines) if (s.mesh) { s.mesh.crystal.rotation.y += dt; s.mesh.crystal.position.y = 2.2 + Math.sin(t * 2 + s.x) * 0.15; }
  for (const tw of towers) tw.orb.position.y = tw.top + 1.2 + Math.sin(t * 1.5) * 0.2;
}

// ---------- Main loop ----------
const timer = new THREE.Timer();
let saveT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  terrainTimer -= dt;
  if (terrainTimer <= 0) { terrainTimer = 0.25; updateTerrain(); }
  if (loadingWait && playerChunkReady()) { loadingWait = false; loadingEl.classList.add('hidden'); }
  const active = started && !paused && !mapOpen && !P.dead && !loadingWait && rewardEl.classList.contains('hidden');
  if (active) {
    gameClock += dt;
    readKeys();
    updatePlayer(dt);
    rebuildObjects(false);
    updateEnemies(dt);
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
    let changed = false;
    for (const a of nearApples) {
      if (Math.abs(a.x - P.pos.x) < 1.2 && Math.abs(a.z - P.pos.z) < 1.2 && Math.abs(a.y - P.pos.y) < 2 && appleAlive(a)) {
        pickedApples.set(a.id, gameClock + 900); P.apples++; changed = true; sfx(880, 0.08, 'triangle', 0.05);
      }
    }
    dropApples = dropApples.filter(a => {
      if (Math.abs(a.x - P.pos.x) < 1.2 && Math.abs(a.z - P.pos.z) < 1.2 && Math.abs(a.y - P.pos.y) < 2) { P.apples++; changed = true; sfx(880, 0.08, 'triangle', 0.05); return false; }
      return Math.hypot(a.x - P.pos.x, a.z - P.pos.z) < 400;
    });
    if (changed) refreshApples();
    updateShrines(dt, t);
    updateTrial();
    updateSky(dt);
    saveT += dt; if (saveT > 10) { saveT = 0; save(); }
  }
  input.jumpPressed = input.attackPressed = input.interactPressed = input.eatPressed = false;
  clouds.position.x = ((t * 3) % 2000) - 1000;
  animatePlayer(dt, t);
  updateCamera(dt);
  if (started) updateHUD(dt);
  renderer.render(scene, camera);
}

// ---------- Menus ----------
const titleEl = document.getElementById('title');
function begin(cont) {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch (e) {}
  let loaded = false;
  if (cont) loaded = load();
  else { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  if (!loaded) {
    const tw = towers[0];
    cam.yaw = Math.atan2(-(tw.x - P.pos.x), -(tw.z - P.pos.z));
    P.facing = Math.atan2(tw.x - P.pos.x, tw.z - P.pos.z);
  }
  cam.target.copy(P.pos); cam.target.y += 1.45;
  titleEl.classList.add('hidden');
  started = true;
  document.getElementById('keyhint').classList.remove('hidden');
  rebuildObjects(true); updateTerrain();
  loadingWait = true; loadingEl.classList.remove('hidden');
  requestLock();
  toast(loaded ? '모험을 이어간다' : '여기는 「시작의 고원」. 보라색 탑에 올라 활성화하고<br>주황색 빛기둥의 사당 120곳을 정화하라!', 6);
}
if (hasSave()) document.getElementById('btnContinue').classList.remove('hidden');
document.getElementById('btnContinue').addEventListener('click', () => begin(true));
document.getElementById('btnNew').addEventListener('click', () => begin(false));
document.getElementById('btnRetry').addEventListener('click', respawn);
document.addEventListener('visibilitychange', () => { if (document.hidden && started) save(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

applySettings();
cam.target.copy(P.pos);
worker.postMessage({ type: 'map', res: MAP_RES });
updateTerrain();
requestAnimationFrame(frame);
window.__game = {
  setPaused, isPaused: () => paused, PM, THREE, P, shrines, towers, climbables, enemies, input, cam, chunks, terrainH, normalAt, teleport, SPAWN,
  step: dt => updatePlayer(dt),
  stats: () => ({ chunks: chunks.size, visible: visibleChunks.size, leaves: desiredLeaves.length, inFlight, enemies: enemies.length, cells: cellCache.size, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
