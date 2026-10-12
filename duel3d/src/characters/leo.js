// 레오 폰 아이젠가르트 (Leo Von Eisengard) — GLAIVIER · 근거리 · 물리 · 브루저
// "짐이란 감히 누구도 쳐다볼 수 없는 '절대적인 공포'다!"
// 무능한 형을 베고 왕좌에 오른 찬탈자. 질서를 바로잡기 위해 기꺼이 형제를 베고 괴물이 되었다.
// 디자인 키워드: 황금 · 욕심 · 왕족 · 중세 / 색: 남색 · 회갈색 · 금 · 적 · 백
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { areaHit } from '../entities.js';
import { rand, sfx, clamp } from '../core.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const DIMS = { hipH: 1.0, spineL: 0.23, chestL: 0.32, neckL: 0.1, shW: 0.25, uArm: 0.3, lArm: 0.28, hipW: 0.11, thigh: 0.45, shin: 0.45, headTop: 0.27 };
// 글레이브 치수 (오른손 기준 +Z 방향, m)
const GL = { butt: -0.95, poleEnd: 0.98, guard: 1.0, bladeStart: 1.06, tip: 2.2, grip2: 0.6 };
const GOLD = 0xffc24a, FIRE = 0xff6a2a, SHIELD = 0x6ab4ff, ROSE = 0xff5a7a;

/* =====================================================================
   텍스처 (캔버스로 직접 그림)
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1]) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 바로크 소용돌이 한 개
function scroll(g, x, y, r, a0, turns, dir = 1) {
  g.beginPath(); const n = 40;
  for (let i = 0; i <= n; i++) { const t = i / n, rr = r * (1 - t * 0.85), a = a0 + dir * t * turns * TAU; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
}
// 백합 문장 (fleur-de-lis)
function fleur(g, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s, s); g.beginPath();
  g.moveTo(0, -60); g.bezierCurveTo(18, -38, 16, -10, 6, 10); g.lineTo(-6, 10); g.bezierCurveTo(-16, -10, -18, -38, 0, -60); // 가운데 꽃잎
  g.moveTo(6, 4); g.bezierCurveTo(30, -20, 58, -10, 48, 14); g.bezierCurveTo(42, 28, 26, 22, 30, 10); g.bezierCurveTo(22, 18, 14, 18, 8, 14); // 오른쪽
  g.moveTo(-6, 4); g.bezierCurveTo(-30, -20, -58, -10, -48, 14); g.bezierCurveTo(-42, 28, -26, 22, -30, 10); g.bezierCurveTo(-22, 18, -14, 18, -8, 14); // 왼쪽
  g.fill(); g.fillRect(-26, 14, 52, 9); // 띠
  g.beginPath(); g.moveTo(-5, 23); g.lineTo(5, 23); g.lineTo(3, 48); g.quadraticCurveTo(0, 56, -3, 48); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-12, 23); g.quadraticCurveTo(-30, 30, -24, 44); g.quadraticCurveTo(-14, 36, -6, 23); g.fill();
  g.beginPath(); g.moveTo(12, 23); g.quadraticCurveTo(30, 30, 24, 44); g.quadraticCurveTo(14, 36, 6, 23); g.fill();
  g.restore();
}
function noiseFill(g, w, h, r, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * a})`; g.fillRect(r() * w, r() * h, 2, 2); } }
// 갑옷판: 검은 강철 + 금 상감 소용돌이
function armorTexture() {
  const [c, g] = cv(512, 512), r = rng(7);
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#3a373e'); grd.addColorStop(1, '#232127'); g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  noiseFill(g, 512, 512, r, 7000, 0.06);
  g.strokeStyle = '#d4ab52'; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const x = 40 + r() * 432, y = 40 + r() * 432; g.lineWidth = 3 + r() * 3; scroll(g, x, y, 22 + r() * 26, r() * TAU, 1.3, r() < 0.5 ? 1 : -1); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 160, y + (r() - 0.5) * 160, x + (r() - 0.5) * 120, y + (r() - 0.5) * 120); g.stroke(); }
  g.lineWidth = 10; g.strokeRect(5, 5, 502, 502); g.strokeStyle = '#8a6a2a'; g.lineWidth = 3; g.strokeRect(16, 16, 480, 480);
  return tex(c);
}
// 앞치마(타바드): 검정 + 금테 + 백합 문장
function tabardTexture() {
  const [c, g] = cv(256, 640);
  g.fillStyle = '#26232a'; g.fillRect(0, 0, 256, 640); noiseFill(g, 256, 640, rng(3), 4000, 0.05);
  g.strokeStyle = '#d4ab52'; g.lineWidth = 9; g.strokeRect(10, 0, 236, 626); g.lineWidth = 3; g.strokeRect(24, 0, 208, 610);
  g.fillStyle = '#d4ab52'; fleur(g, 128, 430, 1.25); fleur(g, 128, 150, 0.7);
  g.lineWidth = 3; scroll(g, 70, 270, 26, 0, 1.2, 1); scroll(g, 186, 270, 26, Math.PI, 1.2, -1);
  g.beginPath(); g.moveTo(10, 600); g.lineTo(128, 640); g.lineTo(246, 600); g.lineWidth = 8; g.stroke();
  return tex(c);
}
// 망토: 로열 블루 벨벳 + 아래쪽 금 장식 띠
function capeTexture(base) {
  const [c, g] = cv(512, 1024), col = new THREE.Color(base), hexs = (k) => `#${col.clone().multiplyScalar(k).getHexString()}`;
  const grd = g.createLinearGradient(0, 0, 512, 0); grd.addColorStop(0, hexs(0.55)); grd.addColorStop(0.5, hexs(1.15)); grd.addColorStop(1, hexs(0.55));
  g.fillStyle = grd; g.fillRect(0, 0, 512, 1024);
  for (let x = 0; x < 512; x += 3) { g.fillStyle = `rgba(255,255,255,${0.012 + 0.012 * Math.sin(x * 0.21)})`; g.fillRect(x, 0, 1, 1024); } // 벨벳 결
  noiseFill(g, 512, 1024, rng(11), 9000, 0.05);
  g.strokeStyle = '#c9a24a'; g.lineCap = 'round';
  g.lineWidth = 7; g.beginPath(); g.moveTo(0, 940); g.lineTo(512, 940); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(0, 912); g.lineTo(512, 912); g.stroke();
  for (let i = 0; i < 6; i++) { const x = 42 + i * 86; g.lineWidth = 4; scroll(g, x, 978, 22, -Math.PI / 2, 1.1, 1); scroll(g, x + 43, 978, 16, Math.PI / 2, 1.1, -1); }
  g.lineWidth = 5; g.beginPath(); g.moveTo(8, 0); g.lineTo(8, 1024); g.moveTo(504, 0); g.lineTo(504, 1024); g.stroke();
  g.fillStyle = 'rgba(201,162,74,0.22)'; fleur(g, 256, 520, 1.6);
  return tex(c);
}
// 칼날 홈(풀러): 짙은 남색 + 금 덩굴
function fullerTexture() {
  const [c, g] = cv(128, 512);
  const grd = g.createLinearGradient(0, 0, 128, 0); grd.addColorStop(0, '#0a1230'); grd.addColorStop(0.5, '#1c2e6a'); grd.addColorStop(1, '#0a1230'); g.fillStyle = grd; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = '#d4ab52'; g.lineWidth = 4;
  for (let i = 0; i < 5; i++) { scroll(g, 40, 60 + i * 95, 22, 0, 1.1, 1); scroll(g, 88, 108 + i * 95, 22, Math.PI, 1.1, -1); }
  g.lineWidth = 6; g.strokeRect(3, 3, 122, 506);
  return tex(c);
}

/* =====================================================================
   천 시뮬레이션 (망토): 위쪽 줄은 등에 고정, 몸 캡슐과 충돌
   ===================================================================== */
class Cloth {
  constructor(scene, W, H, len, mat) {
    this.W = W; this.H = H; this.len = len; this.n = W * H;
    this.p = new Float32Array(this.n * 3); this.o = new Float32Array(this.n * 3); this.ok = false;
    const geo = new THREE.PlaneGeometry(1, 1, W - 1, H - 1); geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true; scene.add(this.mesh);
    this.acc = 0; this.anchors = Array.from({ length: W }, () => new V3());
  }
  reset() {
    const { W, H, p, o } = this;
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { const a = this.anchors[i], k = (j * W + i) * 3; p[k] = o[k] = a.x; p[k + 1] = o[k + 1] = a.y - j * this.dy; p[k + 2] = o[k + 2] = a.z - j * 0.01; }
    this.ok = true;
  }
  step(dt, caps, floor, wind) {
    const { W, H, p, o } = this;
    this.dx = this.anchors[0].distanceTo(this.anchors[1]); this.dy = this.len / (H - 1);
    if (!this.ok) this.reset();
    // 순간이동 등으로 고정점이 크게 튀면 다시 펼친다
    const k0 = 0; if (Math.hypot(p[k0] - this.anchors[0].x, p[k0 + 1] - this.anchors[0].y, p[k0 + 2] - this.anchors[0].z) > 1.5) this.reset();
    this.acc += Math.min(dt, 0.05); const h = 1 / 90;
    while (this.acc >= h) {
      this.acc -= h;
      for (let j = 1; j < H; j++) for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3;
        for (let a = 0; a < 3; a++) { const v = (p[k + a] - o[k + a]) * 0.982; o[k + a] = p[k + a]; p[k + a] += v + (a === 1 ? -9.8 * h * h : wind[a] * h * h); }
      }
      for (let i = 0; i < W; i++) { const a = this.anchors[i], k = i * 3; p[k] = a.x; p[k + 1] = a.y; p[k + 2] = a.z; }
      for (let it = 0; it < 5; it++) {
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const k = (j * W + i) * 3;
          if (i < W - 1) this.link(k, k + 3, this.dx, j === 0);
          if (j < H - 1) this.link(k, k + W * 3, this.dy, j === 0);
          if (i < W - 1 && j < H - 1) this.link(k, k + W * 3 + 3, Math.hypot(this.dx, this.dy), j === 0);
        }
        // 몸 캡슐과 충돌 · 바닥
        for (let q = W * 3; q < this.n * 3; q += 3) {
          for (const c of caps) {
            const ax = c.a.x, ay = c.a.y, az = c.a.z, bx = c.b.x - ax, by = c.b.y - ay, bz = c.b.z - az, l2 = bx * bx + by * by + bz * bz;
            let t = l2 ? ((p[q] - ax) * bx + (p[q + 1] - ay) * by + (p[q + 2] - az) * bz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const cx = p[q] - (ax + bx * t), cy = p[q + 1] - (ay + by * t), cz = p[q + 2] - (az + bz * t), d = Math.hypot(cx, cy, cz), r = c.r;
            if (d < r && d > 1e-5) { const s = r / d; p[q] = ax + bx * t + cx * s; p[q + 1] = ay + by * t + cy * s; p[q + 2] = az + bz * t + cz * s; }
          }
          if (p[q + 1] < floor) p[q + 1] = floor;
        }
      }
    }
    const pos = this.mesh.geometry.attributes.position; pos.array.set(p); pos.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
  }
  link(a, b, rest, pinA) {
    const p = this.p, dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6, f = (d - rest) / d;
    if (pinA) { p[b] -= dx * f; p[b + 1] -= dy * f; p[b + 2] -= dz * f; }
    else { const h = f * 0.5; p[a] += dx * h; p[a + 1] += dy * h; p[a + 2] += dz * h; p[b] -= dx * h; p[b + 1] -= dy * h; p[b + 2] -= dz * h; }
  }
}

/* =====================================================================
   모델
   ===================================================================== */
// 금속 반사용 간이 환경맵 (하늘-지평선-바닥 그라디언트 + 밝은 반점). 렌더러 없이 캔버스로 만든다.
function envCube() {
  const faces = [];
  for (let f = 0; f < 6; f++) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    if (f === 2) { g.fillStyle = '#e8ecf4'; g.fillRect(0, 0, 64, 64); }
    else if (f === 3) { g.fillStyle = '#2a2420'; g.fillRect(0, 0, 64, 64); }
    else {
      const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#dfe4ee'); gr.addColorStop(0.48, '#8a8f9c'); gr.addColorStop(0.52, '#5a5048'); gr.addColorStop(1, '#2a2420');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const rg = g.createRadialGradient(20 + f * 7, 16, 0, 20 + f * 7, 16, 14); rg.addColorStop(0, 'rgba(255,250,235,0.95)'); rg.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    }
    faces.push(c);
  }
  const t = new THREE.CubeTexture(faces); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

const _texCache = {};
const T = (k, f) => _texCache[k] || (_texCache[k] = f());
function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [];
  const env = T('env', envCube);
  const std = (o) => { const m = new THREE.MeshStandardMaterial(o); if ((o.metalness || 0) > 0.2) { m.envMap = env; m.envMapIntensity = 0.85; } return m; };
  const M = {
    armor: std({ map: T('armor', armorTexture), metalness: 0.8, roughness: 0.38 }),
    steel: std({ color: 0x3c3a44, metalness: 0.6, roughness: 0.32 }),
    gold: std({ color: 0xd8b056, metalness: 1, roughness: 0.26 }),
    goldDk: std({ color: 0x8e6c2c, metalness: 1, roughness: 0.4 }),
    cloth: std({ color: pal.cloth ?? 0x1e2a5e, roughness: 0.9 }),
    leather: std({ color: 0x2b2320, roughness: 0.75 }),
    ruby: std({ color: 0x5a0008, emissive: 0xff1430, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.12 }),
    sapphire: std({ color: 0x050a30, emissive: 0x2a5aff, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.12 }),
    fur: std({ color: 0xf5f3ee, roughness: 1 }), furSh: std({ color: 0xd8d6d2, roughness: 1 }),
    skin: std({ color: 0xd8b29a, roughness: 0.72 }), hair: std({ color: 0xececf0, roughness: 0.55 }), hairSh: std({ color: 0xbfc0c8, roughness: 0.6 }),
    eye: std({ color: 0x1a2030, roughness: 0.3 }), white: std({ color: 0xd8d4cc, roughness: 0.4 }), iris: std({ color: 0x3a5068, emissive: 0x0a1626, roughness: 0.2 }), tabard: std({ map: T('tab', tabardTexture), roughness: 0.85, side: THREE.DoubleSide }),
    blade: std({ color: 0x59606f, metalness: 0.55, roughness: 0.24, emissive: 0x0b1020, emissiveIntensity: 0.6 }), fuller: std({ map: T('ful', fullerTexture), metalness: 0.6, roughness: 0.35, emissive: 0x0a1a5a, emissiveIntensity: 0.5 }),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = true; parent.add(me); return me; };
  const tube = (parent, pts, r, mat = M.gold, seg = 24) => add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new V3(...q))), seg, r, 5), mat);
  const capsule = (parent, len, r, mat, y0 = 0) => add(parent, new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 6, 12), mat, [0, y0 - len / 2, 0]);
  // 금 소용돌이 장식을 곡면 위에 얹기: surf(u, v) → [x, y, z]
  const filigree = (parent, surf, cx, cy, r0, a0, turns, dir, rad = 0.006) => {
    const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, rr = r0 * (1 - t * 0.8), a = a0 + dir * t * turns * TAU; pts.push(surf(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)); }
    return tube(parent, pts, rad, M.gold, 30);
  };

  /* ---------- 골반 · 허리 ---------- */
  add(J.hips, new THREE.CylinderGeometry(0.19, 0.2, 0.2, 20), M.leather, [0, -0.02, 0], [0, 0, 0], [1, 1, 0.78]);
  add(J.hips, new THREE.CylinderGeometry(0.205, 0.205, 0.07, 24), M.leather, [0, 0.07, 0], [0, 0, 0], [1, 1, 0.8]);
  add(J.hips, new THREE.TorusGeometry(0.205, 0.012, 6, 32), M.gold, [0, 0.105, 0], [Math.PI / 2, 0, 0], [1, 0.8, 1]);
  add(J.hips, new THREE.TorusGeometry(0.205, 0.012, 6, 32), M.gold, [0, 0.035, 0], [Math.PI / 2, 0, 0], [1, 0.8, 1]);
  const buckle = add(J.hips, new THREE.BoxGeometry(0.11, 0.09, 0.03), M.gold, [0, 0.07, 0.165]);
  add(buckle, new THREE.OctahedronGeometry(0.026), M.ruby, [0, 0, 0.02], [0, 0, 0], [1, 1.3, 0.6]);
  // 앞치마 판갑(폴드) · 옆 판(태셋)
  for (let i = 0; i < 3; i++) add(J.hips, new THREE.CylinderGeometry(0.215 + i * 0.012, 0.225 + i * 0.012, 0.07, 24, 1, true, -1.2, 2.4), M.armor, [0, -0.04 - i * 0.06, 0.005], [0, 0, 0], [1, 1, 0.82]);
  for (const s of [-1, 1]) {
    const tas = new THREE.Group(); tas.position.set(s * 0.2, -0.05, 0); tas.rotation.z = s * 0.12; J.hips.add(tas); m.tassets = (m.tassets || []).concat(tas);
    add(tas, new THREE.BoxGeometry(0.035, 0.34, 0.24), M.armor, [s * 0.01, -0.17, 0]); add(tas, new THREE.BoxGeometry(0.04, 0.03, 0.25), M.gold, [s * 0.012, -0.34, 0]); add(tas, new THREE.BoxGeometry(0.04, 0.34, 0.025), M.gold, [s * 0.012, -0.17, 0.12]);
  }
  // 타바드 (앞 · 뒤) — 다리 움직임에 따라 흔들림
  const tabF = new THREE.Group(); tabF.position.set(0, 0.0, 0.17); J.hips.add(tabF); add(tabF, new THREE.PlaneGeometry(0.3, 0.82), M.tabard, [0, -0.41, 0]);
  const tabB = new THREE.Group(); tabB.position.set(0, 0.0, -0.165); J.hips.add(tabB); add(tabB, new THREE.PlaneGeometry(0.3, 0.7), M.tabard, [0, -0.35, 0], [0, Math.PI, 0]);
  m.tabF = tabF; m.tabB = tabB;

  /* ---------- 몸통 ---------- */
  for (let i = 0; i < 3; i++) { add(J.spine, new THREE.CylinderGeometry(0.17 + i * 0.012, 0.165 + i * 0.012, 0.07, 22), M.armor, [0, 0.03 + i * 0.065, 0], [0, 0, 0], [1, 1, 0.78]); add(J.spine, new THREE.TorusGeometry(0.168 + i * 0.012, 0.007, 5, 28), M.gold, [0, 0.065 + i * 0.065, 0], [Math.PI / 2, 0, 0], [1, 0.78, 1]); }
  add(J.chest, new THREE.CylinderGeometry(0.235, 0.185, 0.34, 24), M.steel, [0, 0.15, 0], [0, 0, 0], [1, 1, 0.74]);
  // 가슴판: 앞쪽 반구 + 중앙 능선 + 금 소용돌이
  const bp = add(J.chest, new THREE.SphereGeometry(0.24, 32, 20, -Math.PI / 2, Math.PI, 0.18 * Math.PI, 0.62 * Math.PI), M.armor, [0, 0.16, 0.0], [0, 0, 0], [1.05, 1.0, 0.72]);
  const chestSurf = (u, v) => { const x = u * 0.2, y = 0.16 + v * 0.17, zz = 1 - (x / 0.252) ** 2 - ((y - 0.16) / 0.24) ** 2; return [x, y, Math.sqrt(Math.max(0.02, zz)) * 0.24 * 0.72 + 0.006]; };
  for (const s of [-1, 1]) { filigree(J.chest, chestSurf, s * 0.45, 0.35, 0.28, s > 0 ? Math.PI : 0, 1.15, s); filigree(J.chest, chestSurf, s * 0.55, -0.35, 0.22, s > 0 ? 0 : Math.PI, 1.1, -s); filigree(J.chest, chestSurf, s * 0.18, -0.75, 0.16, Math.PI / 2, 0.9, s); }
  tube(J.chest, [[0, 0.33, 0.13], [0, 0.22, 0.178], [0, 0.08, 0.17], [0, 0.0, 0.14]], 0.012, M.gold);
  for (const s of [-1, 1]) tube(J.chest, [[s * 0.22, 0.29, 0.06], [s * 0.15, 0.31, 0.13], [s * 0.05, 0.33, 0.145]], 0.009, M.gold);
  const gem = add(J.chest, new THREE.OctahedronGeometry(0.035), M.ruby, [0, 0.2, 0.188], [0, 0, 0], [0.9, 1.5, 0.6]);
  add(J.chest, new THREE.TorusGeometry(0.034, 0.008, 6, 16), M.gold, [0, 0.2, 0.18], [0, 0, 0], [0.9, 1.4, 1]); m.gem = gem;
  for (const s of [-1, 1]) { const sp = add(J.chest, new THREE.ConeGeometry(0.03, 0.12, 4), M.gold, [s * 0.09, 0.08, 0.16], [0.5, 0, s * 0.7]); sp.scale.z = 0.5; }
  // 목가리개
  add(J.chest, new THREE.CylinderGeometry(0.09, 0.13, 0.08, 18), M.armor, [0, 0.33, 0], [0, 0, 0], [1, 1, 0.9]);
  add(J.chest, new THREE.TorusGeometry(0.11, 0.01, 6, 24), M.gold, [0, 0.36, 0], [Math.PI / 2, 0, 0]);
  // 붉은 넥타이 (흰 털 사이로 보이는 붉은 천)
  add(J.chest, new THREE.ConeGeometry(0.035, 0.12, 4), M.ruby, [0.01, 0.31, 0.12], [Math.PI + 0.25, 0, 0], [1, 1, 0.35]);

  /* ---------- 흰 털 목도리 (왼쪽 어깨를 덮는 큰 털뭉치) ---------- */
  {
    // 설정화처럼 오른쪽 어깨(-X)에 얹는다: 왼쪽 기준으로 만든 뒤 X 를 뒤집음
    const fur = new THREE.Group(); fur.position.set(-0.13, 0.29, -0.01); fur.scale.x = -1; J.chest.add(fur); const r = rng(5);
    const blobs = [[0.06, 0.04, 0, 0.16], [0.13, -0.03, 0.06, 0.12], [0.12, -0.03, -0.08, 0.12], [-0.04, 0.0, 0.1, 0.1], [-0.08, 0.02, -0.07, 0.1], [0.05, 0.08, -0.04, 0.1], [0.17, 0.03, 0, 0.11], [-0.13, -0.02, 0.08, 0.07]];
    for (const [x, y, z, s] of blobs) add(fur, new THREE.IcosahedronGeometry(s, 2), r() < 0.6 ? M.fur : M.furSh, [x, y, z], [r() * 3, r() * 3, 0], [1, 0.85, 1]);
    // 털 가닥 (인스턴스)
    // 털 가닥: 표면에 눕혀 아래로 흘러내리게 (부드러운 털 결)
    const N = 520, strand = new THREE.ConeGeometry(0.026, 0.075, 5); strand.translate(0, 0.0375, 0);
    const im = new THREE.InstancedMesh(strand, M.fur, N), q = new THREE.Quaternion(), mt = new THREE.Matrix4(), up = new V3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const b = blobs[(r() * blobs.length) | 0], d = new V3(r() - 0.5, r() - 0.35, r() - 0.5).normalize(), p = new V3(b[0], b[1], b[2]).addScaledVector(d, b[3] * 0.86);
      const flow = d.clone().multiplyScalar(0.45).add(new V3((r() - 0.5) * 0.4, -1, (r() - 0.5) * 0.4)).normalize();
      q.setFromUnitVectors(up, flow); mt.compose(p, q, new V3(1, 0.7 + r() * 0.8, 0.55)); im.setMatrixAt(i, mt);
      im.setColorAt(i, new THREE.Color().setScalar(0.82 + r() * 0.18));
    }
    im.castShadow = true; fur.add(im);
    add(J.chest, new THREE.TorusGeometry(0.12, 0.05, 8, 20, Math.PI * 1.25), M.fur, [0.0, 0.34, 0.0], [Math.PI / 2, 0, 0.4], [1, 1, 0.7]);
  }

  /* ---------- 어깨 갑옷 ---------- */
  const pauldron = (parent, s, big) => {
    const g = new THREE.Group(); g.position.set(s * 0.03, 0.03, 0); parent.add(g);
    for (let i = 0; i < (big ? 3 : 2); i++) {
      const pl = add(g, new THREE.SphereGeometry(0.15 + i * 0.012, 20, 12, 0, TAU, 0, Math.PI * 0.5), M.armor, [s * i * 0.02, -i * 0.06, 0], [0, 0, s * (0.35 + i * 0.12)], [1.25, 0.8, 1.2]);
      add(pl, new THREE.TorusGeometry(0.15 + i * 0.012, 0.009, 5, 28), M.gold, [0, 0.002, 0], [Math.PI / 2, 0, 0]);
    }
    if (big) for (let i = 0; i < 3; i++) add(g, new THREE.ConeGeometry(0.025, 0.14 - i * 0.025, 5), M.gold, [s * (0.02 + i * 0.05), 0.1 - i * 0.03, -0.04 + i * 0.04], [0, 0, -s * (0.5 + i * 0.25)]);
    const ps = (u, v) => { const th = u * 1.3, ph = 0.45 + v * 0.35; return [s * 0.0 + Math.sin(ph) * Math.cos(th) * 0.188, Math.cos(ph) * 0.12 + 0.02, Math.sin(ph) * Math.sin(th) * 0.18]; };
    filigree(g, ps, 0, 0, 0.6, 0, 1.0, s, 0.006); filigree(g, ps, -0.5, 0.2, 0.35, 1, 0.9, -s, 0.005);
    return g;
  };
  pauldron(J.shoulderR, -1, false); pauldron(J.shoulderL, 1, true);

  /* ---------- 팔 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    capsule(sh, DIMS.uArm, 0.062, M.cloth);
    add(sh, new THREE.CylinderGeometry(0.07, 0.066, 0.16, 14, 1, true), M.armor, [0, -0.17, 0]); add(sh, new THREE.TorusGeometry(0.07, 0.006, 5, 18), M.gold, [0, -0.09, 0], [Math.PI / 2, 0, 0]);
    add(el, new THREE.SphereGeometry(0.06, 14, 10), M.armor); const cop = add(el, new THREE.ConeGeometry(0.05, 0.1, 5), M.gold, [0, 0.0, -0.05], [-Math.PI / 2 - 0.4, 0, 0]); cop.scale.z = 0.4;
    add(el, new THREE.CylinderGeometry(0.068, 0.055, 0.22, 14), M.armor, [0, -0.14, 0]);
    for (const y of [-0.04, -0.24]) add(el, new THREE.TorusGeometry(y < -0.1 ? 0.056 : 0.068, 0.007, 5, 18), M.gold, [0, y, 0], [Math.PI / 2, 0, 0]);
    add(el, new THREE.OctahedronGeometry(0.018), M.ruby, [0, -0.15, 0.065], [0, 0, 0], [1, 1.4, 0.6]);
    tube(el, [[s * 0.06, -0.06, 0.03], [s * 0.05, -0.12, 0.055], [0, -0.17, 0.066]], 0.005);
    // 건틀릿
    add(ha, new THREE.BoxGeometry(0.085, 0.07, 0.075), M.steel, [0, -0.035, 0]);
    add(ha, new THREE.BoxGeometry(0.09, 0.012, 0.08), M.gold, [0, -0.002, 0]);
    for (let f = 0; f < 4; f++) add(ha, new THREE.BoxGeometry(0.018, 0.06, 0.022), M.steel, [-0.03 + f * 0.02, -0.095, 0.012], [0.35, 0, 0]);
    add(ha, new THREE.BoxGeometry(0.02, 0.045, 0.022), M.steel, [s * 0.05, -0.05, 0.03], [0.4, 0, s * 0.4]);
  }

  /* ---------- 다리 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    capsule(hp, DIMS.thigh, 0.085, M.cloth);
    add(hp, new THREE.CylinderGeometry(0.092, 0.08, 0.3, 14, 1, true, -1.4, 2.8), M.armor, [0, -0.2, 0.005]);
    add(kn, new THREE.SphereGeometry(0.07, 14, 10), M.armor, [0, 0, 0.02]); add(kn, new THREE.TorusGeometry(0.06, 0.008, 5, 18), M.gold, [0, 0, 0.05], [0, 0, 0]);
    const wing = add(kn, new THREE.ConeGeometry(0.035, 0.12, 4), M.gold, [s * 0.07, 0.02, 0.02], [0, 0, -s * 1.2]); wing.scale.z = 0.4;
    add(kn, new THREE.CylinderGeometry(0.075, 0.06, 0.38, 14), M.armor, [0, -0.22, 0.005]);
    add(kn, new THREE.BoxGeometry(0.018, 0.34, 0.012), M.gold, [0, -0.22, 0.078]);
    add(kn, new THREE.TorusGeometry(0.062, 0.007, 5, 18), M.gold, [0, -0.4, 0], [Math.PI / 2, 0, 0]);
    // 사바톤
    add(ft, new THREE.BoxGeometry(0.11, 0.075, 0.2), M.steel, [0, -0.035, 0.05]);
    add(ft, new THREE.ConeGeometry(0.055, 0.12, 4), M.steel, [0, -0.04, 0.2], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.6]);
    add(ft, new THREE.BoxGeometry(0.115, 0.012, 0.21), M.gold, [0, 0.005, 0.05]);
  }

  /* ---------- 머리: 얼굴 · 수염 · 장발 · 왕관 ---------- */
  {
    const H = J.head;
    add(J.neck, new THREE.CylinderGeometry(0.048, 0.056, 0.12, 12), M.skin, [0, 0.03, 0]);
    const face = add(H, new THREE.SphereGeometry(0.108, 24, 18), M.skin, [0, 0.11, 0.005], [0, 0, 0], [0.9, 1.12, 1.0]);
    add(H, new THREE.BoxGeometry(0.12, 0.03, 0.05), M.skin, [0, 0.145, 0.082], [0.15, 0, 0]); // 눈썹뼈
    add(H, new THREE.ConeGeometry(0.018, 0.05, 6), M.skin, [0, 0.11, 0.108], [Math.PI / 2 + 0.25, 0, 0]); // 코
    for (const s of [-1, 1]) {
      add(H, new THREE.SphereGeometry(0.016, 10, 8), M.white, [s * 0.036, 0.128, 0.094], [0, 0, 0], [1.2, 0.55, 0.6]); // 흰자
      add(H, new THREE.SphereGeometry(0.0085, 8, 6), M.iris, [s * 0.036, 0.128, 0.102]); // 회청색 눈동자
      add(H, new THREE.BoxGeometry(0.04, 0.008, 0.012), M.hair, [s * 0.038, 0.149, 0.1], [0, s * -0.15, s * -0.3]); // 찌푸린 흰 눈썹
      add(H, new THREE.SphereGeometry(0.03, 10, 8), M.skin, [s * 0.098, 0.115, 0.0], [0, 0, 0], [0.4, 0.8, 0.6]); // 귀
    }
    // 수염: 콧수염 · 턱수염 (여러 덩이)
    for (const s of [-1, 1]) tube(H, [[s * 0.005, 0.085, 0.108], [s * 0.035, 0.075, 0.1], [s * 0.055, 0.05, 0.085]], 0.011, M.hair, 12);
    const beard = [[0, 0.03, 0.08, 0.06, 1.0], [0.04, 0.045, 0.07, 0.045, 0.9], [-0.04, 0.045, 0.07, 0.045, 0.9], [0, -0.01, 0.07, 0.05, 1.1], [0.025, -0.04, 0.06, 0.035, 1.2], [-0.025, -0.04, 0.06, 0.035, 1.2]];
    for (const [x, y, z, r, sy] of beard) add(H, new THREE.IcosahedronGeometry(r, 1), M.hair, [x, y, z], [0, 0, 0], [1, sy, 0.75]);
    add(H, new THREE.ConeGeometry(0.045, 0.12, 8), M.hairSh, [0, -0.08, 0.05], [Math.PI - 0.25, 0, 0]);
    for (const s of [-1, 1]) add(H, new THREE.IcosahedronGeometry(0.04, 1), M.hair, [s * 0.075, 0.07, 0.04], [0, 0, 0], [0.7, 1.4, 0.8]); // 구레나룻
    // 머리카락: 정수리 덮개 + 뒤로 흘러내리는 장발 가닥
    // 앞쪽(+Z, phi=π/2)은 얼굴이 드러나도록 비우고, 정수리만 이마선까지 덮는다
    add(H, new THREE.SphereGeometry(0.118, 22, 14, Math.PI / 2 + 0.95, TAU - 1.9, 0, Math.PI * 0.62), M.hair, [0, 0.13, -0.012], [-0.1, 0, 0], [0.98, 1.0, 1.08]);
    add(H, new THREE.SphereGeometry(0.117, 22, 10, 0, TAU, 0, Math.PI * 0.27), M.hair, [0, 0.135, -0.004], [-0.3, 0, 0], [0.98, 1.0, 1.06]);
    for (let i = 0; i < 5; i++) { const a = -0.7 + i * 0.35; tube(H, [[Math.sin(a) * 0.08, 0.22, Math.cos(a) * 0.07], [Math.sin(a) * 0.11, 0.2, Math.cos(a) * 0.06 - 0.04], [Math.sin(a) * 0.12, 0.15, -0.06]], 0.016, i % 2 ? M.hair : M.hairSh, 10); } // 뒤로 넘긴 앞머리
    const r = rng(9);
    for (let i = 0; i < 11; i++) {
      const a = -1.1 + (i / 10) * 2.2, x = Math.sin(a) * 0.1, z = -Math.cos(a) * 0.09 - 0.01, len = 0.3 + r() * 0.12 - Math.abs(a) * 0.06;
      tube(H, [[x, 0.17, z], [x * 1.25, 0.08, z - 0.035], [x * 1.4, -0.06, z - 0.05], [x * 1.5 + (r() - 0.5) * 0.03, -0.06 - len * 0.6, z - 0.07]], 0.022 - Math.abs(a) * 0.004, i % 3 ? M.hair : M.hairSh, 14);
    }
    for (const s of [-1, 1]) tube(H, [[s * 0.1, 0.16, 0.03], [s * 0.115, 0.08, 0.02], [s * 0.12, -0.02, 0.0], [s * 0.13, -0.12, -0.02]], 0.018, M.hair, 12);
    // 왕관
    const crown = new THREE.Group(); crown.position.set(0, 0.2, -0.005); crown.rotation.x = -0.12; H.add(crown);
    add(crown, new THREE.CylinderGeometry(0.103, 0.1, 0.045, 28, 1, true), M.gold).material.side = THREE.DoubleSide;
    add(crown, new THREE.TorusGeometry(0.103, 0.007, 6, 30), M.gold, [0, 0.022, 0], [Math.PI / 2, 0, 0]); add(crown, new THREE.TorusGeometry(0.1, 0.007, 6, 30), M.gold, [0, -0.022, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, tall = i % 2 === 0 ? 0.1 : 0.065, sp = add(crown, new THREE.ConeGeometry(0.018, tall, 4), M.gold, [Math.sin(a) * 0.1, 0.022 + tall / 2, Math.cos(a) * 0.1], [Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.15]);
      if (i % 2 === 0) add(crown, new THREE.SphereGeometry(0.009, 8, 6), M.gold, [Math.sin(a) * 0.104, 0.03 + tall, Math.cos(a) * 0.104]);
      if (i % 3 === 0) add(crown, new THREE.OctahedronGeometry(0.012), M.ruby, [Math.sin(a) * 0.106, 0, Math.cos(a) * 0.106]);
    }
  }

  /* ---------- 글레이브 ---------- */
  const glaive = new THREE.Group(); J.weapon.add(glaive); m.glaive = glaive;
  buildGlaive(glaive, M, add, tube);

  /* ---------- 망토 (천 시뮬레이션) ---------- */
  const capeMat = std({ map: capeTexture(pal.cape ?? 0x1c2a6a), roughness: 0.82, side: THREE.DoubleSide });
  let cloth = null;
  m.extras = extras;
  m.attachScene = (scene) => { if (cloth) return; cloth = new Cloth(scene, 9, 14, 1.58, capeMat); extras.push(cloth.mesh); };
  m.dispose = (scene) => { if (cloth) { scene.remove(cloth.mesh); cloth.mesh.geometry.dispose(); cloth = null; } };
  m.resetCloth = () => { if (cloth) cloth.ok = false; };

  /* ---------- 매 프레임: 왼손 IK · 망토 · 타바드 ---------- */
  const tS = new V3(), tT = new V3(), tE = new V3(), tH = new V3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), dn = new V3(0, -1, 0);
  m.ikW = 1;
  m.update = (dt, f) => {
    // 왼손은 창대를 잡는다 (기술마다 ikOff 로 끌 수 있음)
    const want = m.weaponOut ? 0 : f.state === 'act' ? (f.act.ikOff ? 0 : 1) : f.state === 'guard' ? 1 : 0;
    m.ikW += (want - m.ikW) * Math.min(1, dt * 14);
    if (m.ikW > 0.02) {
      J.chest.updateMatrixWorld(true); J.weapon.updateMatrixWorld(true);
      J.shoulderL.getWorldPosition(tS); J.weapon.localToWorld(tT.set(0, 0, GL.grip2));
      const sc = f.scale, L1 = DIMS.uArm * sc, L2 = DIMS.lArm * sc;
      const natural = J.handL.getWorldPosition(new V3()); tT.lerp(natural, 1 - m.ikW);
      const d = clamp(tT.distanceTo(tS), 0.05, L1 + L2 - 0.002), dir = tT.clone().sub(tS).normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const fw = f.fwd(new V3()), hint = new V3(0, -1, 0).addScaledVector(fw, -0.3).add(f.right(new V3()).multiplyScalar(-0.5)); // 팔꿈치는 아래·바깥으로
      const n = hint.addScaledVector(dir, -hint.dot(dir)).normalize();
      tE.copy(tS).addScaledVector(dir, a).addScaledVector(n, h);
      // 어깨: 아래(-Y)가 팔꿈치를 향하도록
      J.shoulderL.parent.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tE.clone().sub(tS).normalize()); J.shoulderL.quaternion.copy(q0.clone().invert().multiply(q1));
      J.shoulderL.updateMatrixWorld(true);
      J.shoulderL.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tT.clone().sub(tE).normalize()); J.elbowL.quaternion.copy(q0.clone().invert().multiply(q1));
      J.elbowL.updateMatrixWorld(true);
    }
    // 타바드: 다리를 따라 흔들림
    const lift = Math.min(J.hipL.rotation.x, J.hipR.rotation.x);
    m.tabF.rotation.x = Math.min(0, lift) * 0.85 - Math.abs(f.vel.x + f.vel.z) * 0.004; m.tabB.rotation.x = Math.max(0, Math.max(J.hipL.rotation.x, J.hipR.rotation.x)) * 0.6 + 0.05;
    for (const t of m.tassets) t.rotation.x = Math.min(0, lift) * 0.4;
    // 망토
    if (cloth) {
      cloth.mesh.visible = f.root.visible;
      J.chest.updateMatrixWorld(true);
      for (let i = 0; i < 9; i++) {
        const u = i / 8 - 0.5, edge = Math.abs(u) > 0.42;
        J.chest.localToWorld(cloth.anchors[i].set(u * (edge ? 0.62 : 0.52), DIMS.chestL - 0.01 + (edge ? 0.02 : 0), -0.16 - Math.cos(u * Math.PI) * 0.05 + (edge ? 0.06 : 0)));
      }
      const caps = f.hurt.filter((_, i) => i === 0 || i >= 6).map((c, i) => ({ a: c.a, b: c.b, r: c.r + (i === 0 ? 0.07 : 0.05) * f.scale }));
      const wv = (v) => clamp(-v * 1.1, -9, 9), w = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 1.2, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 1.2];
      cloth.len = 1.58 * f.scale; cloth.step(dt, caps, f.pos.y + 0.02, w);
    }
    if (m.gem) m.gem.material.emissiveIntensity = 0.8 + 0.3 * Math.sin(f.G.time * 3);
  };
  m.setWeapon = (v) => { m.glaive.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.07;
  // 판정: 자루 앞부분부터 날 끝까지 (긴 무기라 가까운 적도 자루·날밑에 맞는다) / 궤적: 칼날만
  // 무기 방향: 포즈의 weapon 값은 손목 회전이 아니라 [피치(위+), 좌우(오른쪽+), 롤] — 몸(루트) 기준 창끝 방향.
  // 팔 자세와 무관하게 궤적을 정할 수 있어 크게 휘두르는 동작이 매끄럽게 이어진다.
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = (f) => {
    const w = J.weapon.rotation, pitch = w.x, side = w.y, roll = w.z;
    wE.set(-pitch, -side, roll, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.25)); J.weapon.localToWorld(t.set(0, 0, GL.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, GL.bladeStart)); J.weapon.localToWorld(t.set(0, 0, GL.tip)); };
  return m;
}

// 글레이브: 검은 창대 + 금 고리 · 끝 창날 · 장식 코등이(루비·사파이어) · 금테 두른 넓은 칼날(남색 풀러)
function buildGlaive(g, M, add, tube) {
  const pole = GL.poleEnd - GL.butt;
  add(g, new THREE.CylinderGeometry(0.021, 0.021, pole, 12), M.steel, [0, 0, (GL.poleEnd + GL.butt) / 2], [Math.PI / 2, 0, 0]);
  for (const z of [GL.butt + 0.05, -0.55, -0.15, 0.3, 0.75, GL.poleEnd - 0.04]) add(g, new THREE.CylinderGeometry(0.028, 0.028, 0.035, 12), M.gold, [0, 0, z], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 9; i++) add(g, new THREE.TorusGeometry(0.023, 0.005, 4, 12), M.leather, [0, 0, -0.08 + i * 0.022], [0, 0, 0]); // 손잡이 감개
  // 끝 창날
  add(g, new THREE.CylinderGeometry(0.03, 0.022, 0.06, 10), M.gold, [0, 0, GL.butt - 0.02], [Math.PI / 2, 0, 0]);
  const sp = add(g, new THREE.ConeGeometry(0.04, 0.24, 4), M.blade, [0, 0, GL.butt - 0.16], [-Math.PI / 2, 0, 0]); sp.scale.set(1, 1, 0.35);
  for (const s of [-1, 1]) { const w = add(g, new THREE.ConeGeometry(0.018, 0.08, 4), M.gold, [s * 0.04, 0, GL.butt - 0.06], [-Math.PI / 2, 0, -s * 0.9]); w.scale.z = 0.4; }
  // 코등이
  const gz = GL.guard;
  add(g, new THREE.BoxGeometry(0.2, 0.05, 0.07), M.gold, [0, 0, gz]);
  for (const s of [-1, 1]) {
    tube(g, [[s * 0.09, 0, gz], [s * 0.15, 0, gz - 0.04], [s * 0.18, 0, gz + 0.02], [s * 0.15, 0, gz + 0.07]], 0.012, M.gold, 14);
    const sp2 = add(g, new THREE.ConeGeometry(0.02, 0.1, 4), M.gold, [s * 0.19, 0, gz + 0.05], [0, 0, -s * 0.4]); sp2.scale.z = 0.5;
    add(g, new THREE.OctahedronGeometry(0.018), M.sapphire, [s * 0.065, 0.03, gz], [0, 0, 0], [1, 1, 0.5]);
  }
  add(g, new THREE.OctahedronGeometry(0.032), M.ruby, [0, 0.032, gz + 0.01], [Math.PI / 2, 0, 0], [0.8, 1.3, 0.5]);
  add(g, new THREE.TorusGeometry(0.035, 0.008, 6, 16), M.gold, [0, 0.026, gz + 0.01], [Math.PI / 2, 0, 0], [0.8, 1.3, 1]);
  // 칼날 외곽 (+Z 방향으로 뻗는 넓은 칼날, 뒤쪽에 가시 두 개)
  const L = GL.tip - GL.bladeStart, sh = new THREE.Shape();
  sh.moveTo(-0.1, 0); sh.lineTo(-0.115, 0.08); sh.lineTo(-0.17, 0.12); sh.lineTo(-0.12, 0.17); sh.lineTo(-0.12, L * 0.62); sh.quadraticCurveTo(-0.11, L * 0.88, 0, L);
  sh.quadraticCurveTo(0.1, L * 0.86, 0.12, L * 0.6); sh.lineTo(0.12, 0.2); sh.lineTo(0.16, 0.14); sh.lineTo(0.11, 0.1); sh.lineTo(0.1, 0); sh.closePath();
  const ex = (shape, depth, bevel) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 10 }); geo.translate(0, 0, -depth / 2); geo.rotateX(Math.PI / 2); geo.rotateZ(0); return geo; };
  // Shape 의 +Y(칼날 길이)가 +Z 로, 두께는 Y 축으로
  const outer = add(g, ex(sh, 0.012, 0.006), M.gold, [0, 0, GL.bladeStart - 0.004]); outer.scale.set(1.07, 1, 1.01);
  const blade = add(g, ex(sh, 0.018, 0.005), M.blade, [0, 0, GL.bladeStart]);
  // 풀러 (양면)
  const fs = new THREE.Shape(); fs.moveTo(-0.055, 0.2); fs.lineTo(-0.06, L * 0.6); fs.quadraticCurveTo(-0.04, L * 0.8, 0, L * 0.86); fs.quadraticCurveTo(0.04, L * 0.8, 0.06, L * 0.6); fs.lineTo(0.055, 0.2); fs.quadraticCurveTo(0, 0.16, -0.055, 0.2);
  const fg = new THREE.ShapeGeometry(fs, 12); const uv = fg.attributes.uv, pos = fg.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.06) / 0.12, pos.getY(i) / (L * 0.86)); fg.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) { const f = add(g, fg, M.fuller, [0, s * 0.0135, GL.bladeStart]); if (s < 0) { f.rotation.x = Math.PI; f.position.z = GL.bladeStart; f.scale.z = -1; } }
  return blade;
}

/* =====================================================================
   포즈 · 기술
   (회전 규칙은 rig.js 참고. 왼손은 IK 로 창대를 잡으므로 왼팔 값은 IK 를 끈 기술에서만 쓰인다)
   ===================================================================== */
const poses = {
  // 기본: 설정화처럼 오른손으로 창을 비스듬히 들어 날이 왼쪽 어깨 뒤 위로 솟는다
  base: { hips: [0, -0.45, 0], spine: [0.1, 0.22, 0], chest: [0.06, 0.16, 0], head: [-0.06, 0.1, 0],
    shoulderR: [-0.3, 0, -0.32], elbowR: [-0.95, 0, 0], weapon: [1.0, -2.5, 0.2], shoulderL: [-0.05, 0, 0.16], elbowL: [-0.35, 0, 0],
    hipL: [-0.45, 0, 0.12], kneeL: [0.6, 0, 0], footL: [-0.15, 0, 0], hipR: [0.32, 0, -0.14], kneeR: [0.45, 0, 0], footR: [0.05, 0, 0] },
  run: { hips: [0, -0.15, 0], spine: [0.2, 0.05, 0], chest: [0.05, 0.05, 0], head: [-0.1, 0, 0], shoulderR: [0.15, 0, -0.25], elbowR: [-0.7, 0, 0], weapon: [0.55, -2.95, 1.3],
    hipL: [0, 0, 0], kneeL: [0.2, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.2, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.3, 0, 0], shoulderR: [-1.0, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.8, -2.6, 0.4] },
  // 방어: 창대를 몸 앞에 가로로
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.1, 0], chest: [0.05, 0.1, 0], shoulderR: [-0.9, 0, -0.1], elbowR: [-1.5, 0, 0], weapon: [0.2, -1.5, 1.57],
    hipL: [-0.5, 0, 0.22], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.22], kneeR: [0.65, 0, 0] },
  // 오만한 반격 태세 (Action 3): 꼿꼿이 서서 창끝을 왼쪽 앞 아래로 늘어뜨린다
  stance: { hips: [0, 0.1, 0], spine: [-0.05, 0.05, 0], chest: [-0.05, 0.05, 0], head: [0.08, 0, 0], shoulderR: [-0.55, 0, -0.15], elbowR: [-0.55, 0, 0], weapon: [-0.55, -0.85, 1.4],
    hipL: [-0.1, 0, 0.1], kneeL: [0.1, 0, 0], hipR: [0.1, 0, -0.1], kneeR: [0.1, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.5, 0, 0], weapon: [0.9, -2.3, 0.3] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.5, -2.0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.78, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -1.4, 1.57],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.8, 0, -0.3], elbowR: [-0.4, 0, 0], weapon: [0.3, -2.85, 1.3], shoulderL: [0.8, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.9, 0, 0] },
  // 승리: 창을 곧게 세워 짚고 내려다본다
  win: { hips: [0, 0, 0], spine: [-0.05, 0, 0], chest: [-0.05, 0, 0], head: [0.12, 0, 0], shoulderR: [-0.55, 0, -0.35], elbowR: [-0.9, 0, 0], weapon: [1.48, 0.1, 1.57], shoulderL: [0.05, 0, 0.12], elbowL: [-0.2, 0, 0],
    hipL: [-0.05, 0, 0.12], kneeL: [0.05, 0, 0], hipR: [0.05, 0, -0.12], kneeR: [0.05, 0, 0] },
  // 컷인: 턱을 들고 내려다보며 창을 곧게 세운다
  portrait: { hips: [0, -0.2, 0], chest: [0, -0.25, 0], head: [-0.12, 0.3, 0], shoulderR: [-0.9, 0, -1.0], elbowR: [-1.3, 0, 0], weapon: [1.45, -0.2, 1.57] },
  // 오른쪽 아래 뒤로 창을 끌어당긴 준비 자세 (올려베기 시작)
  windup: { hips: [0, -0.55, 0], spine: [0.15, -0.35, 0], chest: [0.05, -0.45, 0], shoulderR: [0.25, 0, -0.55], elbowR: [-0.45, 0, 0], weapon: [-0.55, 2.3, 0.9],
    hipL: [-0.55, 0, 0.2], kneeL: [0.75, 0, 0], hipR: [0.4, 0, -0.25], kneeR: [0.55, 0, 0] },
  // 머리 위로 크게 치켜든 자세 (날이 등 뒤로 넘어감)
  raised: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.25, 0, 0], shoulderR: [-3.0, 0, -0.2], elbowR: [-0.45, 0, 0], weapon: [2.35, 0, 1.57], hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  // 하늘을 찌르듯 곧게 치켜든 자세 (궁극기 인장)
  skyward: { hips: [0, 0, 0], spine: [-0.12, 0, 0], chest: [-0.1, 0, 0], head: [-0.35, 0, 0], shoulderR: [-3.05, 0, -0.15], elbowR: [-0.1, 0, 0], weapon: [1.5, 0, 1.57], shoulderL: [0.1, 0, 0.35], elbowL: [-0.2, 0, 0],
    hipL: [-0.15, 0, 0.12], kneeL: [0.15, 0, 0], hipR: [0.15, 0, -0.12], kneeR: [0.15, 0, 0] },
  // 내려찍은 직후: 상체를 숙이고 날이 앞쪽 땅을 향함
  slamDown: { hips: [0, -0.2, 0], spine: [0.75, 0, 0], chest: [0.25, 0, 0], head: [-0.4, 0, 0], shoulderR: [-1.0, 0, -0.05], elbowR: [-0.1, 0, 0], weapon: [-0.7, 0, 1.57], hipL: [-1.2, 0, 0.1], kneeL: [1.7, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [1.5, 0, 0] },
};
const LEGS_LUNGE = { hipL: [-1.0, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.3, 0, 0] };
const ACC = GOLD;
const goldSlash = (f, o) => f.slashFx({ r: (o.r || 2.4), color: o.color ?? GOLD, life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
function embers(G, p, n = 12, col = FIRE) { G.fx.burst(p, n, [col, 0xffd070], 5, { kind: 'ember', lk: 1.2 }); }
function crack(G, c, r, col, n = 9) {
  // 땅 갈라짐: 방사형 빛줄기
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(-0.2, 0.2), L = r * rand(0.6, 1.1), dir = new V3(Math.cos(a), 0, Math.sin(a));
    G.fx.slash(c.clone().addScaledVector(dir, L * 0.45).setY(0.04), { fwd: dir, normal: new V3(0, 1, 0), r: L * 0.55, color: col, life: 0.5 });
  }
}
// 유도 없이 날아가 박히는 글레이브 (파괴의 투창)
class ThrownGlaive {
  constructor(G, f, from, to) {
    this.G = G; this.owner = f; this.t = 0; this.done = false; this.hit = new Set(); this.phase = 'fly';
    this.mesh = f.model.glaive.clone(true); this.mesh.scale.setScalar(f.scale); G.scene.add(this.mesh); f.model.setWeapon(false);
    this.from = from.clone(); this.to = to.clone(); this.pos = from.clone(); this.prev = from.clone();
    this.dur = Math.max(0.22, from.distanceTo(to) / 32);
  }
  update(dt) {
    const G = this.G, f = this.owner; this.t += dt;
    if (this.phase === 'fly') {
      const k = Math.min(1, this.t / this.dur); this.prev.copy(this.pos);
      this.pos.lerpVectors(this.from, this.to, k); this.pos.y += Math.sin(k * Math.PI) * 1.2;
      const d = this.pos.clone().sub(this.prev); if (d.lengthSq() > 1e-6) this.mesh.lookAt(this.pos.clone().add(d));
      this.mesh.position.copy(this.pos).addScaledVector(d.normalize(), -1.6 * f.scale);
      G.fx.p(this.pos, { size: 0.9, size1: 0.2, life: 0.25, color: GOLD, alpha: 0.8 }); G.fx.burst(this.pos, 3, [GOLD, 0xffffff], 2, { lk: 0.5 });
      // 경로 위 적: 32
      for (const t of f.foes()) if (!this.hit.has(t) && t.hurtHitSeg(this.prev, this.pos, 0.35)) { this.hit.add(t); t.takeHit(f, { dmg: 32, kb: [3, 0], stun: 0.35, hs: 0.04, daze: 15 }, d); }
      if (k >= 1) this.impact();
    } else if (this.phase === 'stuck') {
      if (this.t > 0.6) { this.phase = 'return'; this.t = 0; this.from.copy(this.mesh.position); sfx('dash'); }
    } else if (this.phase === 'return') {
      const k = Math.min(1, this.t / 0.32), hand = f.model.J.handR.getWorldPosition(new V3());
      this.mesh.position.lerpVectors(this.from, hand, k * k); this.mesh.rotation.y += dt * 20;
      G.fx.p(this.mesh.position, { size: 0.7, size1: 0.1, life: 0.2, color: GOLD, alpha: 0.6 });
      if (k >= 1) this.kill(true);
    }
  }
  impact() {
    const G = this.G, f = this.owner, c = this.to.clone().setY(0); this.phase = 'stuck'; this.t = 0;
    this.mesh.position.copy(c).add(new V3(0, 1.45 * f.scale, 0)); this.mesh.lookAt(c.clone().add(new V3(0.15, -1, 0.1)));
    sfx('boom'); sfx('parry'); G.shake(0.45); G.flash(0xffe6a0, 0.35); G.stage.flashSky && G.stage.flashSky(0.3);
    // 반구 충격파 (Action 2: 금빛 갈라짐 + 푸른 돔)
    G.spawn(dome(G, c, 4, 0x8ad0ff)); crack(G, c, 4.4, GOLD, 11);
    G.fx.ring(c.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.4, r1: 4.6, life: 0.55, color: GOLD }); G.fx.ring(c.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.2, r1: 3.2, life: 0.4, color: 0xffffff });
    G.fx.burst(c.clone().setY(0.5), 60, [GOLD, 0xffffff, 0xffe08a], 14, { dir: new V3(0, 1, 0), spread: 1.2 }); G.fx.burst(c, 24, 0x7a6a60, 6, { kind: 'dust', sk: 1.8 });
    G.fx.light(c.clone().setY(1.2), GOLD, 140, 0.5, 16); G.fx.beam(c, { r: 0.7, h: 10, color: GOLD, life: 0.45 });
    areaHit(f, c, 4, { dmg: 154, kb: [4, 10.5], stun: 0.7, hs: 0.14, shake: 0.2, daze: 70, snd: 'big' }, 1.6);
  }
  kill(caught) {
    this.done = true; this.G.scene.remove(this.mesh); this.owner.model.setWeapon(true);
    if (caught) { const h = this.owner.model.J.handR.getWorldPosition(new V3()); this.G.fx.burst(h, 16, [GOLD, 0xffffff], 4); sfx('block'); }
  }
}
// 반투명 반구가 부풀었다 사라짐
function dome(G, c, r, col) {
  const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2), mat); m.position.copy(c); G.scene.add(m);
  let t = 0; return { done: false, update(dt) { t += dt; const k = t / 0.6; m.scale.setScalar(r * (0.3 + 0.75 * (1 - (1 - Math.min(1, k)) ** 3))); mat.opacity = 0.55 * Math.max(0, 1 - k); if (k >= 1) { this.done = true; G.scene.remove(m); m.geometry.dispose(); mat.dispose(); } } };
}
// 방어 태세 방벽 (Action 3: 앞쪽 푸른 돔)
function barrier(G, f) {
  const mat = new THREE.MeshBasicMaterial({ color: SHIELD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const wire = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const geo = new THREE.SphereGeometry(1.25, 28, 14, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.05, Math.PI * 0.62);
  const m = new THREE.Mesh(geo, mat), w = new THREE.Mesh(new THREE.IcosahedronGeometry(1.26, 2), wire); m.add(w); G.scene.add(m);
  return { m, mat, wire, t: 0, hitFlash: 0, update(dt) {
    this.t += dt; this.hitFlash = Math.max(0, this.hitFlash - dt * 4); const a = Math.min(1, this.t * 8);
    m.position.copy(f.pos).add(new V3(0, 1.05 * f.scale, 0)); m.rotation.y = f.yaw + Math.PI / 2; m.scale.setScalar(f.scale * (1 + 0.03 * Math.sin(this.t * 20)));
    w.rotation.y = -this.t * 0.6; mat.opacity = a * (0.22 + this.hitFlash * 0.5); wire.opacity = a * (0.18 + this.hitFlash * 0.5);
  }, kill() { G.scene.remove(m); geo.dispose(); w.geometry.dispose(); mat.dispose(); wire.dispose(); } };
}

const moves = {
  /* --- 기본 공격 4연타 (Action 1: 사선 내려베기 → 올려베기 → 회전 베기 → 찌르기) --- */
  light1: { dur: 0.5, cancel: 0.3, next: 'light2', trail: true, track: 0.1,
    keys: [[0, 'windup'], [0.09, { chest: [0.05, -0.55, 0], weapon: [-0.6, 2.45, 0.9] }],
      [0.2, { hips: [0, 0.35, 0], spine: [0.2, 0.3, 0], chest: [0.0, 0.5, 0], shoulderR: [-2.4, 0, -0.1], elbowR: [-0.3, 0, 0], weapon: [1.05, -0.7, 0.9], ...LEGS_LUNGE }],
      [0.3, { chest: [-0.05, 0.6, 0], weapon: [1.3, -1.3, 0.9] }], [0.5, 'base']],
    lunge: [[0.1, 0.22, 4.5]],
    ev: [[0.12, (f) => { sfx('heavy'); goldSlash(f, { tilt: 0.95, r: 2.5, at: [0.2, 1.3, 0.3], flip: true }); }]],
    hits: [{ t0: 0.12, t1: 0.24, dmg: 44, kb: [2.5, 0], stun: 0.36, daze: 14 }] },
  light2: { dur: 0.5, cancel: 0.3, next: 'light3', trail: true, track: 0.08,
    keys: [[0, 'raised'], [0.09, { weapon: [2.55, -0.1, 1.57], spine: [-0.22, 0, 0] }],
      [0.2, { hips: [0, -0.1, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.3, 0, 0], shoulderR: [-1.05, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [-0.6, 0.05, 1.57], hipL: [-1.1, 0, 0.15], kneeL: [1.2, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.4, 0, 0] }],
      [0.32, { weapon: [-0.72, 0.05, 1.57] }], [0.5, 'base']],
    lunge: [[0.06, 0.18, 4]],
    ev: [[0.1, (f) => { sfx('heavy'); goldSlash(f, { tilt: Math.PI / 2, r: 2.6, at: [0, 1.3, 0.3] }); }],
      [0.19, (f, o, G) => { const c = f.local([0, 0.05, 2.1]); crack(G, c, 1.4, GOLD, 5); G.fx.burst(c, 10, 0x7a6a60, 3, { kind: 'dust' }); G.shake(0.08); }]],
    hits: [{ t0: 0.1, t1: 0.24, dmg: 48, kb: [3, 0], stun: 0.38, daze: 14 }] },
  // 회전 베기: 몸 전체가 한 바퀴 돈다 (한 손)
  light3: { dur: 0.62, cancel: 0.42, next: 'light4', trail: true, ikOff: true, aim: true,
    keys: [[0, { hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0, 0.3, 0], shoulderR: [-1.5, 0, -1.2], elbowR: [-0.05, 0, 0], weapon: [0.05, 1.25, 0], shoulderL: [-0.6, 0, 1.1], elbowL: [-0.3, 0, 0], hipL: [-0.6, 0, 0.3], kneeL: [0.8, 0, 0], hipR: [0.4, 0, -0.3], kneeR: [0.6, 0, 0] }],
      [0.08, { weapon: [0.0, 1.45, 0] }], [0.45, {}], [0.62, 'base']],
    tick: (f, o, G, t, dt) => { if (t > 0.06 && t < 0.44) f.yaw -= dt * (TAU / 0.38); },
    end: (f) => { f.faceOpp(); },
    ev: [[0.08, (f, o, G) => { sfx('swing'); G.fx.ring(f.pos.clone().setY(1.0), { normal: new V3(0, 1, 0), r0: 0.5, r1: 3.6, life: 0.4, color: GOLD }); }], [0.25, () => sfx('swing')]],
    hits: [{ t0: 0.08, t1: 0.44, dmg: 56, kb: [4.5, 3], stun: 0.45, daze: 18 }] },
  light4: { dur: 0.62, trail: true, track: 0.14,
    keys: [[0, { hips: [0, -0.7, 0], spine: [0.1, -0.4, 0], chest: [0, -0.5, 0], shoulderR: [-0.35, 0, -0.3], elbowR: [-1.7, 0, 0], weapon: [0.1, 0.15, 0] }], [0.14, { chest: [0, -0.6, 0] }],
      [0.22, { hips: [0, 0.15, 0], spine: [0.42, 0.2, 0], chest: [0.15, 0.35, 0], shoulderR: [-1.5, 0, 0.05], elbowR: [-0.05, 0, 0], weapon: [0.02, 0, 0], ...LEGS_LUNGE }], [0.4, {}], [0.62, 'base']],
    lunge: [[0.15, 0.3, 11]],
    ev: [[0.16, (f, o, G) => { sfx('zap'); const p = f.local([0, 1.15, 2.4]); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.6, life: 0.3, color: GOLD }); G.fx.burst(p, 20, [GOLD, 0xffffff], 12, { dir: f.fwd(), spread: 0.25 }); }]],
    hits: [{ t0: 0.16, t1: 0.3, dmg: 72, kb: [8, 5], stun: 0.6, hs: 0.1, shake: 0.14, daze: 24, snd: 'big' }] },

  /* --- 우클: 오만한 반격 — 1.5초 방어 태세(앞쪽 피해 50% 감소). 맞거나 다시 누르면 반격 --- */
  heavy: { dur: 1.5, cd: 'heavy', stance: true, aim: true, track: 1.5,
    keys: [[0, 'stance'], [1.5, 'stance']],
    start: (f, o, G) => { f.riposte = false; f.barrier = barrier(G, f); G.spawn(f.barrier); G.say(f, '"주제도 모르고."'); sfx('charge'); G.fx.burst(f.chest(), 20, [SHIELD, 0xffffff], 5); },
    onHit: (f, att, h, dir) => {
      const toAtt = new V3().subVectors(att.pos, f.pos).setY(0).normalize(), front = f.fwd(new V3()).dot(toAtt) > 0.1;
      f.barrier && (f.barrier.hitFlash = 1); f.riposte = true; f.riposteAt = att;
      const p = f.chest().addScaledVector(toAtt, 0.9); f.G.fx.burst(p, 24, [SHIELD, 0xffffff], 8); f.G.fx.ring(p, { r0: 0.2, r1: 1.6, life: 0.3, color: SHIELD, billboard: true }); sfx('block');
      return front ? { dmgK: 0.5, armor: true } : null;
    },
    tick: (f, o, G, t) => {
      if (t > 0.18 && (f.riposte || (f.buf && f.buf.a === 'heavy'))) { f.buf = null; f.start('riposte'); }
    },
    end: (f) => { if (f.barrier) { f.barrier.kill(); f.barrier.done = true; f.barrier = null; } } },
  riposte: { dur: 0.75, trail: true, aim: true, ikOff: true,
    keys: [[0, { hips: [0, -0.7, 0], spine: [0.1, -0.6, 0], chest: [0, -0.8, 0], shoulderR: [-1.3, 0, -1.25], elbowR: [-0.2, 0, 0], weapon: [0.45, 2.2, 0.5], shoulderL: [-0.5, 0, 0.6] }],
      [0.08, { chest: [0, -0.95, 0], weapon: [0.5, 2.4, 0.5] }], [0.22, { hips: [0, 0.5, 0], spine: [0.3, 0.6, 0], chest: [0.15, 0.95, 0], shoulderR: [-1.5, 0, 0.55], weapon: [-0.3, -1.7, 0.5], ...LEGS_LUNGE }], [0.45, {}], [0.75, 'base']],
    start: (f, o, G) => { if (f.riposteAt && !f.riposteAt.gone) { f.opp = f.riposteAt; f.faceOpp(); } G.say(f, '"꺼져라!"'); G.slow(0.4, 0.18); },
    lunge: [[0.08, 0.2, 5]],
    ev: [[0.09, (f, o, G) => { sfx('heavy'); sfx('boom'); goldSlash(f, { r: 3.4, color: ROSE, life: 0.34, at: [0, 1.1, 0.2], tilt: 0.1 }); G.fx.light(f.chest(), ROSE, 90, 0.3); }]],
    hits: [{ t0: 0.09, t1: 0.26, dmg: 185, kb: [6, 10.5], stun: 0.8, hs: 0.16, shake: 0.3, daze: 70, snd: 'big', br: 0.25 }] },

  /* --- Shift: 난도질 — 제자리에서 2회 휘두른 뒤 마지막에 강하게 내려베어 넘어뜨림 --- */
  s1: { dur: 1.45, cd: 's1', trail: true, track: 0.25, aim: true,
    keys: [[0, { hips: [0, -0.8, 0], spine: [0.1, -0.5, 0], chest: [0, -0.8, 0], shoulderR: [-1.6, 0, -1.1], elbowR: [-0.3, 0, 0], weapon: [0.15, 2.1, 0.25] }],
      [0.14, {}], [0.3, { hips: [0, 0.3, 0], spine: [0.25, 0.5, 0], chest: [0.1, 0.85, 0], shoulderR: [-1.35, 0, 0.55], weapon: [-0.05, -1.7, 0.25], ...LEGS_LUNGE }],
      [0.42, {}], [0.6, { hips: [0, -0.7, 0], spine: [0.2, -0.5, 0], chest: [0.05, -0.85, 0], shoulderR: [-1.7, 0, -1.15], weapon: [0.15, 2.1, -0.25] }],
      [0.72, {}], [0.9, 'raised'], [0.98, { shoulderR: [-3.1, 0, -0.15], spine: [-0.2, 0, 0] }], [1.1, 'slamDown'], [1.25, {}], [1.45, 'base']],
    start: (f, o, G) => G.say(f, '"조각을 내주마."'),
    ev: [[0.16, (f, o, G) => { sfx('heavy'); goldSlash(f, { r: 2.7, color: FIRE, tilt: 0.12 }); embers(G, f.local([0, 1.1, 1.6])); }],
      [0.46, (f, o, G) => { sfx('heavy'); goldSlash(f, { r: 2.7, color: FIRE, tilt: -0.12, flip: true }); embers(G, f.local([0, 1.1, 1.6])); }],
      [0.9, () => sfx('charge')],
      [1.12, (f, o, G) => {
        const c = f.local([0, 0, 2.0]).setY(0.05); sfx('boom'); G.shake(0.4); G.flash(0xffb070, 0.2);
        goldSlash(f, { r: 2.4, color: FIRE, tilt: Math.PI / 2, flip: true, at: [0, 1.3, 0.3], life: 0.3 });
        crack(G, c, 2.6, FIRE, 7); G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.3, r1: 3, life: 0.45, color: FIRE });
        G.fx.burst(c.clone().setY(0.4), 50, [FIRE, 0xffd070, 0xffffff], 11, { dir: new V3(0, 1, 0), spread: 1.1 }); embers(G, c, 30); G.fx.burst(c, 20, 0x6a5a50, 5, { kind: 'dust', sk: 1.4 }); G.fx.light(c.clone().setY(1), FIRE, 110, 0.4);
        areaHit(f, c, 1.8, { dmg: 40, kb: [3, 4], stun: 0.5, noCrit: true }, 0.8);
      }]],
    hits: [{ t0: 0.16, t1: 0.32, dmg: 42, kb: [2, 0], stun: 0.5, daze: 18 }, { t0: 0.46, t1: 0.62, dmg: 50, kb: [2, 0], stun: 0.55, daze: 18 },
      { t0: 1.0, t1: 1.14, dmg: 89, kb: [3, 5.5], stun: 0.7, hs: 0.14, shake: 0.25, daze: 40, snd: 'big', br: 0.22 }] },

  /* --- E: 파괴의 투창 — 조준한 곳으로 창을 던짐. 경로 피해 후 땅에 박히며 반경 4m 충격파 --- */
  s2: { dur: 0.95, cd: 's2', ikOff: true, aim: true, track: 0.4,
    keys: [[0, { hips: [0, -0.9, 0], spine: [-0.15, -0.5, 0], chest: [-0.1, -0.6, 0], head: [0, 0.4, 0], shoulderR: [-2.6, 0, -0.35], elbowR: [-1.25, 0, 0], weapon: [0.22, 0.05, 1.57], shoulderL: [-1.5, 0, 0.35], elbowL: [-0.1, 0, 0], hipL: [-0.7, 0, 0.2], kneeL: [0.6, 0, 0], hipR: [0.5, 0, -0.2], kneeR: [0.5, 0, 0] }],
      [0.36, { spine: [-0.25, -0.55, 0], shoulderR: [-2.8, 0, -0.4], elbowR: [-1.45, 0, 0], weapon: [0.28, 0.05, 1.57] }],
      [0.46, { hips: [0, 0.3, 0], spine: [0.45, 0.3, 0], chest: [0.15, 0.4, 0], head: [0, 0, 0], shoulderR: [-1.3, 0, 0.1], elbowR: [-0.05, 0, 0], weapon: [0, 0, 1.57], shoulderL: [0.3, 0, 0.3], ...LEGS_LUNGE }],
      [0.7, {}], [0.95, 'base']],
    start: (f, o, G) => { G.say(f, '"부서져라!"'); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.42) { const p = f.model.J.weapon.localToWorld(new V3(0, 0, 1.7)); G.fx.p(p, { size: 0.6, size1: 0.1, life: 0.15, color: GOLD, alpha: 0.7 }); } },
    ev: [[0.46, (f, o, G) => {
      const from = f.model.J.weapon.localToWorld(new V3(0, 0, 1.4));
      let to; if (o && f.dist() < 18) to = o.pos.clone(); else { const cf = f.team === 0 && G.camFwd ? G.camFwd : { x: Math.sin(f.yaw), z: Math.cos(f.yaw) }; to = f.pos.clone().add(new V3(cf.x, 0, cf.z).multiplyScalar(13)); }
      const R = Math.hypot(to.x, to.z); if (R > 20) to.multiplyScalar(20 / R);
      G.spawn(new ThrownGlaive(G, f, from, to)); sfx('shot'); sfx('dash');
    }]] },

  /* --- 극한 회피 뒤 좌클: 순간 돌진 찌르기 --- */
  counter: { dur: 0.6, trail: true, aim: true,
    keys: [[0, { hips: [0, -0.6, 0], chest: [0, -0.5, 0], shoulderR: [-0.35, 0, -0.3], elbowR: [-1.7, 0, 0], weapon: [0.1, 0.15, 0] }],
      [0.08, { hips: [0, 0.15, 0], spine: [0.45, 0.2, 0], chest: [0.15, 0.35, 0], shoulderR: [-1.5, 0, 0.05], elbowR: [-0.05, 0, 0], weapon: [0.02, 0, 0], ...LEGS_LUNGE }], [0.35, {}], [0.6, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest();
      if (o) { const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? 0 : o.pos.y).addScaledVector(d, 2.3 + 0.4 * o.scale); f.faceOpp(); }
      for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.chest(), i / 8), { size: 0.9, size1: 0.2, life: 0.3, color: GOLD, alpha: 0.7 });
      sfx('dash'); G.flash(GOLD, 0.2); f.model.resetCloth();
    }], [0.06, (f, o, G) => { sfx('zap'); const p = f.local([0, 1.15, 2.4]); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.8, life: 0.3, color: GOLD }); }]],
    hits: [{ t0: 0.05, t1: 0.2, dmg: 96, kb: [7, 4], stun: 0.6, hs: 0.12, shake: 0.15, daze: 45, snd: 'big' }] },

  /* --- Q: 궁극기 「절대적인 공포」 — 하늘의 왕관 인장 → 도약 → 내리꽂기 → 뽑아 올려베기 --- */
  ult: { dur: 3.1, ult: true, aim: true, ikOff: true,
    keys: [[0, 'skyward'], [0.5, 'skyward'], [0.6, { hipL: [-1.2, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.5, 0, 0], kneeR: [1.3, 0, 0], weapon: [1.9, 0, 1.57] }], [1.0, 'raised'], [1.12, { ...poses.slamDown, weapon: [-1.15, 0, 1.57] }], [1.85, {}],
      [1.95, { hips: [0, -0.8, 0], spine: [0.3, -0.6, 0], chest: [0, -0.8, 0], shoulderR: [-0.3, 0, -0.7], elbowR: [-0.2, 0, 0], weapon: [-0.55, 2.0, 0.9] }],
      [2.15, { hips: [0, 0.4, 0], spine: [-0.1, 0.5, 0], chest: [-0.1, 0.8, 0], shoulderR: [-2.9, 0, 0.3], elbowR: [-0.1, 0, 0], weapon: [1.55, -0.5, 0.9], ...LEGS_LUNGE }], [2.6, {}], [3.1, 'win']],
    cam: [[0, { ref: 'self', p: [0.9, 0.5, 2.8], l: [0, 1.9, 0], fov: 40 }], [0.5, { ref: 'self', p: [3.5, 1.4, 1.5], l: [0, 2.5, 3], fov: 50 }],
      [1.05, { ref: 'target', p: [5, 1.0, -3.5], l: [0, 1.2, 0], fov: 55 }], [1.8, { ref: 'target', p: [-4.5, 0.6, -4.5], l: [0, 1.8, 0], fov: 55 }],
      [2.3, { ref: 'target', p: [-1.5, 2.5, -9], l: [0, 3, 0], fov: 58 }], [3.1, { ref: 'target', p: [-1.5, 3, -10], l: [0, 3.4, 0], fov: 58 }]],
    ev: [
      [0, (f, o, G) => {
        o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; G.setTint(GOLD, 0.35); sfx('charge'); G.say(f, '"짐은 감히 누구도 쳐다볼 수 없는 절대적인 공포다!"');
        G.fx.burst(f.chest(), 50, [GOLD, 0xffffff], 7); G.fx.light(f.chest(), GOLD, 100, 0.6); f.ultFrom = f.pos.clone(); f.ultTo = o.pos.clone().addScaledVector(new V3().subVectors(f.pos, o.pos).setY(0).normalize(), 1.9 * o.scale);
        // 하늘의 왕관 인장
        const top = o.pos.clone().setY(9);
        G.fx.ring(top, { normal: new V3(0, 1, 0), r0: 0.5, r1: 4.5, life: 1.3, color: GOLD, op: 1 }); G.fx.ring(top, { normal: new V3(0, 1, 0), r0: 0.3, r1: 3.2, life: 1.3, color: 0xffffff, op: 0.8 });
        for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; G.fx.beam(top.clone().add(new V3(Math.cos(a) * 3.4, -0.5, Math.sin(a) * 3.4)), { r: 0.18, h: 2.5, color: GOLD, life: 1.2 }); }
      }],
      [0.5, (f) => { f.float = true; f.onGround = false; sfx('jump'); sfx('dash'); f.model.resetCloth && 0; }],
      [1.1, (f, o, G) => {
        const c = o.pos.clone().setY(0); f.pos.copy(f.ultTo).setY(0); f.float = false; f.onGround = true; f.vel.set(0, 0, 0);
        sfx('boom'); sfx('thunder' in {} ? 'boom' : 'big'); G.shake(0.6); G.flash(0xfff0c0, 0.75); G.stage.flashSky(0.6);
        G.spawn(dome(G, c, 6, GOLD)); crack(G, c, 7, GOLD, 14); G.fx.beam(c, { r: 2.2, h: 30, color: GOLD, life: 0.9 });
        G.fx.ring(c.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.5, r1: 9, life: 0.8, color: GOLD }); G.fx.burst(c.clone().setY(1), 120, [GOLD, 0xffffff, 0xffe08a], 18, { lk: 1.4 });
        G.fx.burst(c, 40, 0x7a6a60, 8, { kind: 'dust', sk: 2.2 }); G.fx.light(c.clone().setY(1.5), GOLD, 200, 0.9, 24);
        o.takeHit(f, { dmg: 150, kb: [0, 0], stun: 99, hs: 0.2, shake: 0.5, nokill: true, noScale: true, force: true, daze: 120, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(c) < 6) t.takeHit(f, { dmg: 120, kb: [6, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
      }],
      [1.3, (f, o, G) => { for (let i = 0; i < 8; i++) G.spawn({ done: false, t: -i * 0.07, update(dt) { this.t += dt; if (this.t >= 0 && !this.d) { this.d = true; const p = o.pos.clone().add(new V3(rand(-3, 3), 0, rand(-3, 3))); G.fx.beam(p, { r: 0.35, h: 8, color: GOLD, life: 0.35 }); G.fx.burst(p.clone().setY(0.3), 12, [GOLD, 0xffffff], 6, { dir: new V3(0, 1, 0), spread: 0.6 }); sfx('zap'); } if (this.t > 0.3) this.done = true; } }); }],
      [1.98, (f, o, G) => {
        o.release(); sfx('heavy'); sfx('boom'); G.say(f, '"엎드려라."');
        goldSlash(f, { r: 3.8, color: ROSE, tilt: Math.PI / 2 - 0.2, life: 0.4, at: [0, 1.4, 0.3] }); G.fx.light(o.chest(), ROSE, 140, 0.5);
        o.takeHit(f, { dmg: 160, kb: [5, 13], stun: 0.9, hs: 0.18, shake: 0.4, noScale: true, force: true, daze: 80, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        G.slow(0.35, 0.5); G.flash(0xffffff, 0.5);
      }],
    ],
    tick: (f, o, G, t) => {
      // 도약 궤적 (0.5 ~ 1.1초): 포물선으로 대상 앞에 내리꽂는다
      if (t > 0.5 && t < 1.1 && f.ultFrom) { const k = (t - 0.5) / 0.6; f.pos.lerpVectors(f.ultFrom, f.ultTo, k); f.pos.y = Math.sin(k * Math.PI) * 6 * (1 - k * 0.3); f.faceOpp(); G.fx.p(f.chest(), { size: 0.8, size1: 0.2, life: 0.3, color: GOLD, alpha: 0.6 }); }
    },
    end: (f, o, G) => { G.setTint(0, 0); f.float = false; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 70;
  G.fx.impact(p, GOLD, big ? 1.8 : 1.1, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? ROSE : GOLD, life: 0.2 });
  G.fx.burst(p, big ? 14 : 6, [FIRE, GOLD], 4, { kind: 'ember' });
}

export default {
  id: 'leo', name: '레오 폰 아이젠가르트', short: '레오', title: 'GLAIVIER · 찬탈한 왕', scale: 1.1,
  desc: '근거리 · 물리 · 브루저. "짐이란 감히 누구도 쳐다볼 수 없는 \'절대적인 공포\'다!" 무능한 형을 베고 왕좌에 오른 찬탈자. 거대한 글레이브로 넓게 쓸어 버린다.',
  stats: { hp: 1150, speed: 6.6, jump: 9, crit: 0.2 },
  palettes: [{ accent: GOLD, armor: 0x2c2a30, cape: 0x1c2a6a, cloth: 0x1e2a5e, band: '#141a3a' }, { accent: 0xff4a5a, armor: 0x2c2a30, cape: 0x5a0f1c, cloth: 0x3a1420, band: '#2a0a12' }],
  skills: { heavy: { name: '오만한 반격', cd: 18 }, s1: { name: '난도질', cd: 9 }, s2: { name: '파괴의 투창', cd: 14 }, ult: { name: '절대적인 공포', sub: '감히 짐을 쳐다보느냐' } },
  moveList: [['좌클 ×4', '사선 내려베기 → 올려베기 → 회전 베기 → 돌진 찌르기'], ['우클 · 오만한 반격', '1.5초 방어 태세(앞 피해 50%↓) · 맞거나 다시 누르면 「꺼져라!」 반격 185'],
    ['Shift · 난도질', '2회 휘두르기(42·50) → 내려베기 89, 넘어뜨림'], ['E · 파괴의 투창', '창 투척(경로 32) → 착탄 충격파 반경 4m 154, 띄움 → 창 회수'],
    ['Q · 절대적인 공포', '하늘의 왕관 인장 → 도약 내리꽂기 150 → 뽑아 올려베기 160'], ['C (타이밍) · 극한 회피', '적이 느려지고 좌클릭으로 순간 돌진 찌르기']],
  createModel, poses, moves, hitFx,
};
