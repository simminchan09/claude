// 빙설 요새 몬스터 모델 — 서리 늑대 · 얼음 정령 · 설원 예티 · 빙설 여왕 이스벨
// 플레이어 캐릭터와 같은 조형 도구(sculpt.js: loft · surf · strand · lathe)로 곡면을 직접 빚는다.
//   공통: 캔버스 털/서리 텍스처 + 노멀맵, 육각 얼음 결정(lathe 6각), 털 다발은 한 지오메트리로 합쳐 그린다.
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { Rope, RopeTube, Cloth } from '../../cloth.js';
import { animeHead } from '../../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, fbm, heightToNormal, envCube, cached } from '../../sculpt.js';
import { QUAD_DIMS, GOLEM_DIMS } from '../bodies.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = (k, fn) => cached('snow:' + k, fn);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* =====================================================================
   공용 도구
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const _tex = {}; const T = (k, f) => _tex[k] || (_tex[k] = f());
// 지오메트리 변환 복사
export function xf(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const o = new THREE.Object3D(); o.position.set(...p); o.rotation.set(...r); o.scale.set(...(typeof s === 'number' ? [s, s, s] : s)); o.updateMatrix();
  const c = g.clone(); c.applyMatrix4(o.matrix); return c;
}
// 여러 지오메트리를 하나로 (position · normal · uv · index)
export function merge(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let o = 0, oi = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count; pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3); nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[oi + i] = a[i] + o; oi += a.length; } else { for (let i = 0; i < n; i++) idx[oi + i] = o + i; oi += n; }
    o += n;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
// z 축을 따라 단면(타원)을 잇는 곡면 (머리 · 주둥이 · 발): prof(v) → { z, rx, ryT, ryB, cy, cx }
export function zLoft(prof, nu = 28, nv = 24, mod) {
  return surf((u, v, p) => { const s = prof(v), a = u * TAU, sx = Math.sin(a), cy = Math.cos(a); p.set((s.cx || 0) + sx * s.rx, (s.cy || 0) + cy * (cy > 0 ? s.ryT : s.ryB), s.z); if (mod) mod(p, u, v, sx, cy, s); }, nu, nv, { closedU: true, poles: [0, nv] });
}
// 육각 얼음 결정: 길이 h, 반지름 r (밑동 뾰족 · 끝 뾰족)
export const crystalGeo = (h = 1, r = 0.2, base = 0.25, tip = 0.3) => lathe([[0, -h * base], [r * 0.85, 0], [r, h * 0.12], [r * 0.92, h * (1 - tip)], [0, h]], 6);
// 털 다발 하나: 뿌리 p0 에서 방향 d 로, 길이 L · 굵기 w · 휨(아래로 처짐 sag)
function tuftGeo(p0, d, L, w, sag = 0.3, flat = 0.45, curl = [0, 0, 0]) {
  const a = new V3(...p0), D = new V3(...d).normalize(), pts = [a.clone()];
  for (let i = 1; i <= 4; i++) { const t = i / 4; pts.push(a.clone().addScaledVector(D, L * t).add(new V3(curl[0] * t * t * L, -sag * t * t * L + curl[1] * t * t * L, curl[2] * t * t * L))); }
  return strand(pts, w * 1.35, w * 0.3, { seg: 8, rad: 6, flat: Math.min(1, flat * 1.6), ease: (v) => v ** 1.4 });
}
// 털 덮개: 로프트 곡면 위에 다발을 심는다 (each(i) → [u, v, len, w, dir 보정])
function furCover(prof, n, seed, f) {
  const r = rng(seed), list = [];
  for (let i = 0; i < n; i++) { const o = f(i, r); if (!o) continue; const p = loftAt(prof, o.u, o.v, new V3()), q = loftAt(prof, o.u + 0.01, o.v, new V3()), s = loftAt(prof, o.u, Math.min(1, o.v + 0.02), new V3());
    const nrm = new V3().subVectors(s, p).cross(new V3().subVectors(q, p)).normalize(); if (o.flipN) nrm.negate();
    const d = nrm.clone().multiplyScalar(o.out ?? 0.5).add(new V3(...o.dir)).normalize(); p.addScaledVector(nrm, -0.004);
    list.push(tuftGeo([p.x, p.y, p.z], [d.x, d.y, d.z], o.len * 0.8, o.w, (o.sag ?? 0.25) + 0.25, o.flat ?? 0.45)); }
  return merge(list);
}

/* ---------- 텍스처 ---------- */
// 털: 위(등)는 짙은 색, 배는 흰색. 결은 캔버스 세로(로프트 길이 방향)
function furTex(top = '#7d8ea6', mid = '#c9d4e2', belly = '#f4f7fb', seed = 3, frost = 0) {
  const W = 512, H = 512, [c, g] = cv(W, H), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, top); gr.addColorStop(0.2, mid); gr.addColorStop(0.5, belly); gr.addColorStop(0.8, mid); gr.addColorStop(1, top);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const x = r() * W, y = r() * H, l = 6 + r() * 22, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(40,55,80,0.16)' : 'rgba(255,255,255,0.28)'; g.lineWidth = 1 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 6, y + l / 2, x + (r() - 0.5) * 4, y + l); g.stroke(); }
  if (frost) { g.globalAlpha = frost; for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? '#e8fbff' : '#a8dcff'; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); } g.globalAlpha = 1; }
  return tex(c);
}
function furNormal(seed = 5) {
  const W = 256, [c, g] = cv(W, W), r = rng(seed); g.fillStyle = '#808080'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 1400; i++) { const x = r() * W, y = r() * W, l = 6 + r() * 16; g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l); g.stroke(); }
  return heightToNormal(c, 3, [2, 2]);
}
// 얼음: 금 · 서리 결
function iceTex(seed = 9, base = '#bfe6ff') {
  const W = 256, [c, g] = cv(W, W), r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.4})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); let x = r() * W, y = r() * W; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 30; i++) { const x = r() * W, y = r() * W, rg = g.createRadialGradient(x, y, 0, x, y, 10 + r() * 30); rg.addColorStop(0, 'rgba(90,150,220,0.25)'); rg.addColorStop(1, 'rgba(90,150,220,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, W); }
  return tex(c);
}
// 눈송이 문양 (드레스 자수 · 망토)
function flake(g, x, y, s, lw = 2) {
  g.lineWidth = lw; g.lineCap = 'round';
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU, cx = Math.cos(a), sy = Math.sin(a); g.beginPath(); g.moveTo(x, y); g.lineTo(x + cx * s, y + sy * s); g.stroke();
    for (const t of [0.45, 0.72]) { const bx = x + cx * s * t, by = y + sy * s * t, l = s * (0.32 - t * 0.18); for (const sd of [-1, 1]) { const b = a + sd * 0.8; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(b) * l, by + Math.sin(b) * l); g.stroke(); } } }
}

/* =====================================================================
   재질 묶음
   ===================================================================== */
function std(o) { return new THREE.MeshStandardMaterial(o); }
function phys(o) { const m = new THREE.MeshPhysicalMaterial(o); if ((o.metalness || 0) > 0.2 || o.clearcoat) { m.envMap = envCube(); m.envMapIntensity = o.envMapIntensity ?? 1; } return m; }
const iceMat = (o = {}) => phys({ map: T('ice', () => iceTex()), color: o.color ?? 0xd8f2ff, emissive: o.emissive ?? 0x3a8ad0, emissiveIntensity: o.ei ?? 0.45, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: o.flat ?? true, transparent: !!o.op, opacity: o.op ?? 1, depthWrite: !o.op, side: o.side ?? THREE.FrontSide, envMapIntensity: 1.6 });
const glowMat = (c, i = 2.6) => std({ color: 0x000000, emissive: c, emissiveIntensity: i });

/* =====================================================================
   1. 서리 늑대 — 네발 짐승 (골반을 앞으로 눕힌 휴머노이드 리그)
   골반 · 등 · 가슴 관절의 로컬 +Y = 앞, +Z = 아래(배), -Z = 위(등)
   ===================================================================== */
// 몸통 단면 (관절별 로프트, 겹쳐서 이음매를 숨긴다)
const fat = (P, k, kz = k) => (v) => { const q = P(v); return { ...q, rx: q.rx * k, rzB: q.rzB * kz, rzF: q.rzF * kz }; };
const W_HIP = fat((() => { const X = spl([[0, 0.0], [0.07, 0.075], [0.25, 0.118], [0.55, 0.126], [1, 0.114]]), B = spl([[0, 0.0], [0.07, 0.06], [0.25, 0.1], [0.55, 0.112], [1, 0.106]]), F = spl([[0, 0.0], [0.07, 0.07], [0.25, 0.11], [0.55, 0.118], [1, 0.1]]);
  return (v) => ({ y: -0.22 + 0.36 * v, rx: X(v), rzB: B(v), rzF: F(v), cz: 0.0 }); })(), 1.15, 1.12);
const W_SPN = fat((() => { const X = spl([[0, 0.114], [0.45, 0.098], [1, 0.116]]), B = spl([[0, 0.106], [0.5, 0.094], [1, 0.108]]), F = spl([[0, 0.1], [0.4, 0.082], [1, 0.128]]);
  return (v) => ({ y: -0.08 + 0.4 * v, rx: X(v), rzB: B(v), rzF: F(v), cz: -0.004 * Math.sin(v * Math.PI) }); })(), 1.15, 1.12);
const W_CHS = fat((() => { const X = spl([[0, 0.116], [0.35, 0.128], [0.62, 0.12], [0.85, 0.085], [1, 0.0]]), B = spl([[0, 0.108], [0.4, 0.124], [0.62, 0.118], [0.85, 0.08], [1, 0.0]]), F = spl([[0, 0.128], [0.35, 0.168], [0.62, 0.162], [0.85, 0.11], [1, 0.0]]), Z = spl([[0, 0.006], [0.4, 0.03], [0.8, 0.06], [1, 0.08]]);
  return (v) => ({ y: -0.08 + 0.5 * v, rx: X(v), rzB: B(v), rzF: F(v), cz: Z(v) }); })(), 1.14, 1.1);
// 머리 (Y 위 · Z 앞): 두개골 → 주둥이
const W_HEAD = (() => { const X = spl([[0, 0], [0.07, 0.058], [0.24, 0.084], [0.4, 0.07], [0.52, 0.046], [0.75, 0.034], [0.94, 0.027], [1, 0]]), Tp = spl([[0, 0], [0.07, 0.058], [0.24, 0.074], [0.4, 0.066], [0.52, 0.042], [0.75, 0.03], [0.94, 0.024], [1, 0]]),
  Bt = spl([[0, 0], [0.07, 0.05], [0.24, 0.066], [0.4, 0.052], [0.52, 0.03], [0.75, 0.02], [0.94, 0.017], [1, 0]]), Y = spl([[0, 0.085], [0.3, 0.08], [0.5, 0.062], [0.75, 0.052], [1, 0.048]]);
  return (v) => ({ z: -0.1 + 0.36 * v, rx: X(v), ryT: Tp(v), ryB: Bt(v), cy: Y(v) }); })();
const W_JAW = (() => { const X = spl([[0, 0], [0.08, 0.05], [0.3, 0.044], [0.7, 0.028], [0.95, 0.02], [1, 0]]), Tp = spl([[0, 0], [0.1, 0.012], [1, 0.006]]), Bt = spl([[0, 0], [0.1, 0.026], [0.5, 0.02], [0.95, 0.012], [1, 0]]);
  return (v) => ({ z: -0.03 + 0.26 * v, rx: X(v), ryT: Tp(v), ryB: Bt(v), cy: -0.004 }); })();
// 다리
const legP = (L, r0x, r1x, r0z, r1z, top = 0.03, bulge = 0) => (v) => ({ y: top - (L + top) * v, rx: r0x + (r1x - r0x) * v + bulge * Math.sin(v * Math.PI) * 0.6, rzF: r0z + (r1z - r0z) * v + bulge * Math.sin(v * 2.2), rzB: r0z + (r1z - r0z) * v + bulge * Math.sin(v * Math.PI) });
// 발 (Z 앞)
const PAW = (v) => { const e = Math.sin(Math.PI * Math.min(1, v * 1.05)) ** 0.6; return { z: -0.045 + 0.12 * v, rx: 0.036 * e + 0.004, ryT: 0.034 * e * (1 - v * 0.5), ryB: 0.012 * e, cy: -0.004 + 0.008 * (1 - v) }; };

export function buildFrostWolf(pal, o = {}) {
  const D = QUAD_DIMS, m = buildHumanoid(D), J = m.J, extras = [];
  const fN = T('furN', () => furNormal());
  const M = {
    fur: phys({ map: T('wolfFur', () => furTex('#62748e', '#b9c6d8', '#f2f6fb', 3, 0.5)), normalMap: fN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.82, sheen: 1, sheenColor: new THREE.Color(0xd8ecff), sheenRoughness: 0.5 }),
    furL: phys({ map: T('wolfFurL', () => furTex('#8696ad', '#d0dae6', '#f4f7fb', 7, 0.3)), normalMap: fN, roughness: 0.82, sheen: 1, sheenColor: new THREE.Color(0xd8ecff), sheenRoughness: 0.5 }),
    tuft: phys({ color: 0xdfe8f2, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }),
    tuftD: phys({ color: 0x7e8ea6, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color(0xc8dcff), side: THREE.DoubleSide }),
    nose: phys({ color: 0x1a1c24, roughness: 0.25, clearcoat: 0.8 }),
    mouth: std({ color: 0x3a1a24, roughness: 0.6 }), tooth: phys({ color: 0xf4f2ea, roughness: 0.3, clearcoat: 0.6 }), claw: phys({ color: 0x2a3040, roughness: 0.3, clearcoat: 0.6 }),
    pad: std({ color: 0x2a2c36, roughness: 0.7 }), earIn: std({ color: 0x8a7a8c, roughness: 0.8 }),
    eye: glowMat(pal.accent ?? 0x7ad8ff, 3.2), ice: iceMat(), lid: std({ color: 0x2a3040, roughness: 0.6 }),
  };
  const add = (parent, g, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(g, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...(typeof s === 'number' ? [s, s, s] : s)); parent.add(me); return me; };
  // 몸통
  add(J.hips, C('w:hip', () => loft(W_HIP, 36, 16, { poles: [0] })), M.fur);
  add(J.spine, C('w:spn', () => loft(W_SPN, 36, 12)), M.fur);
  add(J.chest, C('w:chs', () => loft(W_CHS, 36, 18, { poles: [18] })), M.fur);
  // 등 갈기 · 가슴 털 · 엉덩이 털 (합친 털 다발)
  add(J.chest, C('w:chestFur', () => furCover(W_CHS, 34, 11, (i, r) => i < 18 ? { u: 0.5 + (r() - 0.5) * 0.5, v: 0.55 + r() * 0.35, len: 0.07 + r() * 0.05, w: 0.018, dir: [0, -0.2, 1], out: 0.9, sag: -0.1 } : { u: (r() - 0.5) * 0.3, v: 0.1 + r() * 0.75, len: 0.06 + r() * 0.04, w: 0.016, dir: [0, -1, -0.3], out: 0.8 })), M.tuft);
  add(J.spine, C('w:backFur', () => furCover(W_SPN, 16, 12, (i, r) => ({ u: (r() - 0.5) * 0.18, v: r(), len: 0.05 + r() * 0.03, w: 0.015, dir: [0, -1, -0.3], out: 0.7 }))), M.tuftD);
  add(J.hips, C('w:rumpFur', () => furCover(W_HIP, 18, 13, (i, r) => ({ u: 0.15 + r() * 0.7, v: 0.12 + r() * 0.3, len: 0.05 + r() * 0.04, w: 0.016, dir: [0, -1, 0.4], out: 0.6 }))), M.tuft);
  // 등줄기의 얼음 결정 (서리 늑대)
  { const list = []; const r = rng(17);
    for (let i = 0; i < 9; i++) { const v = 0.12 + i * 0.085, sp = loftAt(W_CHS, 0, v, new V3()), h = 0.07 + 0.08 * Math.sin(i / 8 * Math.PI) + r() * 0.03;
      for (const sd of i % 2 ? [-1, 1] : [0]) list.push(xf(crystalGeo(h, 0.016 + h * 0.08), [sd * 0.035, sp.y, sp.z + 0.01], [-Math.PI / 2 + 0.55, 0, sd * 0.45 + (r() - 0.5) * 0.2])); }
    add(J.chest, C('w:crys', () => merge(list)), M.ice);
    const l2 = []; for (let i = 0; i < 4; i++) { const v = 0.15 + i * 0.22, sp = loftAt(W_SPN, 0, v, new V3()); l2.push(xf(crystalGeo(0.05, 0.014), [0, sp.y, sp.z + 0.008], [-Math.PI / 2 + 0.7, 0, (i % 2 - 0.5) * 0.4])); }
    add(J.spine, C('w:crys2', () => merge(l2)), M.ice); }
  // 목 (로컬 +Y 위 · +Z 앞 = 목울대)
  const NECK = (v) => ({ y: -0.1 + 0.32 * v, rx: 0.088 - 0.016 * v, rzF: 0.098 - 0.02 * v, rzB: 0.09 - 0.02 * v, cz: 0.012 * v });
  add(J.neck, C('w:neck', () => loft(NECK, 30, 10)), M.fur);
  add(J.neck, C('w:ruff', () => furCover(NECK, 46, 21, (i, r) => ({ u: r(), v: 0.15 + r() * 0.7, len: 0.08 + r() * 0.07, w: 0.022, dir: [0, -0.9, -0.35], out: 0.75, sag: 0.25 }))), M.tuft);
  // 머리
  const H = J.head;
  add(H, C('w:head', () => zLoft(W_HEAD, 36, 30, (p, u, v, sx, cy) => { // 눈두덩 · 이마 골 · 볼
    const ax = Math.abs(p.x); p.y += 0.006 * gauss(ax - 0.04, 0.015) * gauss(p.z - 0.075, 0.03) * Math.max(0, cy); p.y -= 0.004 * gauss(p.x, 0.008) * gauss(p.z - 0.05, 0.05) * Math.max(0, cy);
    p.x *= 1 + 0.08 * gauss(p.z - 0.0, 0.05) * Math.max(0, -cy); })), M.fur);
  const jaw = new THREE.Group(); jaw.position.set(0, 0.034, 0.0); H.add(jaw);
  add(jaw, C('w:jaw', () => zLoft(W_JAW, 24, 18)), M.fur);
  add(jaw, C('w:mouthIn', () => xf(new THREE.SphereGeometry(1, 14, 8), [0, 0.006, 0.12], [0, 0, 0], [0.028, 0.006, 0.09])), M.mouth);
  add(H, C('w:nose', () => { const g = new THREE.SphereGeometry(0.024, 16, 12); g.scale(1.15, 0.85, 1); return g; }), M.nose, [0, 0.07, 0.252]);
  add(H, C('w:lip', () => xf(new THREE.SphereGeometry(1, 14, 8), [0, 0.04, 0.15], [0, 0, 0], [0.036, 0.008, 0.09])), M.mouth);
  for (const s of [-1, 1]) {
    // 송곳니 · 이빨
    add(H, C('w:fang', () => xf(new THREE.ConeGeometry(0.006, 0.03, 8), [0, -0.012, 0], [Math.PI, 0, 0])), M.tooth, [s * 0.022, 0.038, 0.205]);
    add(jaw, C('w:fangL', () => new THREE.ConeGeometry(0.005, 0.022, 8)), M.tooth, [s * 0.018, 0.012, 0.19]);
    for (let k = 0; k < 3; k++) add(jaw, C('w:tooth', () => new THREE.ConeGeometry(0.0035, 0.012, 6)), M.tooth, [s * (0.024 - k * 0.0015), 0.008, 0.16 - k * 0.025]);
    // 눈: 눈두덩 아래 가늘게 빛나는 눈 + 어두운 눈가
    const e = add(H, C('w:eye', () => new THREE.SphereGeometry(0.016, 14, 10)), M.eye, [s * 0.045, 0.092, 0.07], [0, s * 0.5, s * -0.25], [1.2, 0.55, 0.6]);
    add(H, C('w:lid', () => new THREE.TorusGeometry(0.017, 0.004, 6, 18)), M.lid, [s * 0.0455, 0.092, 0.072], [0, s * 0.55, s * -0.25], [1.2, 0.6, 1]);
    // 귀: 세모 · 앞은 오목 (속귀)
    const EAR = (v) => ({ y: 0.0 + 0.105 * v, rx: 0.036 * (1 - v) ** 0.75 + 0.002, rzF: 0.01 * (1 - v) + 0.002, rzB: 0.022 * (1 - v) + 0.002, n: 2.4 });
    const eg = new THREE.Group(); eg.position.set(s * 0.05, 0.135, -0.03); eg.rotation.set(-0.2, s * -0.35, s * -0.32); H.add(eg);
    add(eg, C('w:ear', () => loft(EAR, 18, 8, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z -= 0.012 * (1 - Math.abs(c)) * Math.sin(v * Math.PI) * (1 - v * 0.3); } })), M.fur);
    add(eg, C('w:earIn', () => xf(new THREE.ConeGeometry(0.022, 0.08, 3, 1, true), [0, 0.045, 0.004], [0.1, 0, 0], [1, 1, 0.25])), M.earIn);
    // 볼 털
    add(H, C('w:cheek' + s, () => merge([0, 1, 2, 3, 4].map((k) => tuftGeo([s * 0.07, 0.05 + k * 0.012, 0.03 - k * 0.012], [s * 1, -0.5, -0.7], 0.06 + k * 0.006, 0.016, 0.25)))), M.tuft);
  }
  // 앞다리 (팔)
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const UA = legP(D.uArm, 0.07, 0.046, 0.08, 0.05, 0.06, 0.012);
    add(a, C('w:ua', () => loft(UA, 24, 10, { mod: (p, u, v, cc, sn) => { if (sn < 0) p.z += 0.02 * gauss(v - 0.93, 0.08) * -sn; } })), M.furL);
    add(b, C('w:la', () => loft(legP(D.lArm, 0.038, 0.03, 0.04, 0.034, 0.03), 20, 10, { mod: (p, u, v, cc, sn) => { p.z += 0.008 * gauss(v - 0.9, 0.08) * sn; } })), M.furL);
    add(b, C('w:elbFur', () => merge([0, 1, 2].map((k) => tuftGeo([(k - 1) * 0.015, 0.0, -0.035], [0, -0.6, -1], 0.05, 0.014, 0.4)))), M.tuft);
    const pg = new THREE.Group(); pg.position.set(0, -0.012, 0.01); c.add(pg); paw(pg, s);
  }
  // 뒷다리 (넓적다리 · 정강이)
  for (const [a, b, c, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    add(a, C('w:th', () => loft((v) => ({ y: 0.08 - (D.thigh + 0.08) * v, rx: 0.084 - 0.042 * v, rzF: 0.095 - 0.05 * v + 0.01 * Math.sin(v * 3), rzB: 0.115 - 0.07 * v, cz: -0.012 * Math.sin(v * Math.PI) }), 26, 12)), M.fur);
    add(b, C('w:sh', () => loft((v) => ({ y: 0.02 - (D.shin + 0.02) * v, rx: 0.034 - 0.01 * v, rzF: 0.03 - 0.008 * v, rzB: 0.05 - 0.024 * v + 0.012 * gauss(v - 0.85, 0.1) }), 20, 10)), M.furL);
    add(a, C('w:thFur', () => merge([0, 1, 2, 3].map((k) => tuftGeo([(k - 1.5) * 0.02, -0.1 - k * 0.03, -0.085 + k * 0.01], [0, -0.7, -1], 0.06, 0.016, 0.4)))), M.tuft);
    const pg = new THREE.Group(); pg.position.set(0, -0.012, 0.0); pg.rotation.x = -0.4; c.add(pg); paw(pg, s);
  }
  function paw(g, s) {
    add(g, C('w:paw', () => zLoft(PAW, 20, 14)), M.furL);
    for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.017, z = 0.06 + (k === 0 || k === 3 ? -0.008 : 0);
      add(g, C('w:toe', () => new THREE.SphereGeometry(0.013, 10, 8)), M.furL, [x, -0.002, z], [0, 0, 0], [1, 0.8, 1.2]);
      add(g, C('w:claw', () => xf(new THREE.ConeGeometry(0.004, 0.02, 6), [0, 0, 0.008], [Math.PI / 2 + 0.5, 0, 0])), M.claw, [x, -0.004, z + 0.012]); }
    add(g, C('w:pad', () => new THREE.SphereGeometry(0.02, 10, 6)), M.pad, [0, -0.012, 0.01], [0, 0, 0], [1.2, 0.3, 1]);
  }
  // 꼬리 (로프 물리 · 털 관)
  m.ropes = [];
  { const rope = new Rope(7, 0.068, { damp: 0.975, stiff: 0.16 });
    const view = new RopeTube(rope, M.fur, { sub: 3, rad: 12, uvV: 1, prof: (v) => (0.034 + 0.03 * Math.sin(Math.min(1, v * 1.25) * Math.PI) ** 0.7) * (v > 0.85 ? 1 - (v - 0.85) * 5.5 : 1) });
    m.ropes.push({ rope, view, joint: J.hips, local: new V3(0, -0.2, -0.07), rest: new V3(0, -0.45, -0.9).normalize() }); }
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const x of extras) scene.remove(x); extras.length = 0; for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  const tmp = new V3(), rq = new THREE.Quaternion();
  m.sole = 0.05;
  m.update = (dt, f) => {
    jaw.rotation.x += ((f && f.state === 'act' ? 0.42 : f && f.state === 'run' ? 0.12 : 0.03) - jaw.rotation.x) * Math.min(1, dt * 14);
    if (!f) return; m.root.getWorldQuaternion(rq);
    const caps = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.02 * f.scale })), wind = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6);
    for (const r of m.ropes) { r.joint.localToWorld(tmp.copy(r.local)); r.rope.step(dt, tmp, caps, f.pos.y + 0.05, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = f.root.visible; }
  };
  m.tipPos = (out) => jaw.localToWorld(out.set(0, 0.02, 0.22));
  m.weaponPts = (b, t) => { J.head.localToWorld(b.set(0, 0.06, 0)); J.head.localToWorld(t.set(0, 0.04, 0.32)); };
  return m;
}

/* =====================================================================
   공용: 손 (손바닥 + 손가락 4 + 엄지) — s = 1 왼손 · -1 오른손
   ===================================================================== */
export function sculptHand(add, parent, key, s, mat, k = 1, nail) {
  const hg = new THREE.Group(); hg.scale.setScalar(k); parent.add(hg);
  add(hg, C(key + 'palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.02 + 0.003 * Math.sin(v * Math.PI), rz: 0.033 + 0.004 * v, n: 3, cx: s * 0.012 }), 18, 6)), mat);
  for (let f = 0; f < 4; f++) {
    const z = 0.024 - f * 0.016, L = f === 3 ? 0.84 : 1, pts = [];
    for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * 1.5 * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
    add(hg, C(key + `f${s}${f}`, () => strand(pts, 0.0082, 0.0062, { seg: 14, rad: 8 })), mat);
    if (nail) add(hg, C(key + 'nail', () => xf(new THREE.ConeGeometry(0.005, 0.018, 6), [0, 0, 0], [Math.PI, 0, 0])), nail, [pts[8].x, pts[8].y - 0.004, pts[8].z]);
  }
  add(hg, C(key + 'th' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0098, 0.0072, { seg: 12, rad: 8 })), mat);
  return hg;
}
const ropeStep = (m, f, dt, caps, rq, tmp, wind) => {
  for (const r of m.ropes) { r.joint.localToWorld(tmp.copy(r.local)); if (r.side) r.view.side.copy(r.sideL).applyQuaternion(r.hq); r.rope.step(dt, tmp, caps, f.pos.y + 0.02, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = f.root.visible; }
};
const adder = (add0) => (parent, g, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(g, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...(typeof s === 'number' ? [s, s, s] : s)); if (mat.transparent) me.castShadow = false; parent.add(me); return me; };

/* =====================================================================
   2. 얼음 정령 — 떠다니는 결정 몸 · 아래는 눈보라 소용돌이 (다리 없음)
   ===================================================================== */
export const SPIRIT_DIMS = { hipH: 0.98, spineL: 0.2, chestL: 0.26, neckL: 0.08, shW: 0.17, uArm: 0.27, lArm: 0.25, hipW: 0.09, thigh: 0.44, shin: 0.44, headTop: 0.24 };
const SP_HEAD = animeHead({ C: new V3(0, 0.1, 0.006), R: [0.068, 0.098, 0.086], jaw: 0.42, chin: 0.012, nose: 0.6 });
export function buildIceSpirit(pal, o = {}) {
  const D = SPIRIT_DIMS, m = buildHumanoid(D), J = m.J, extras = [];
  const acc = pal.accent ?? 0x9af0ff;
  const M = {
    ice: iceMat({ ei: 0.55 }), iceS: iceMat({ flat: false, ei: 0.6, color: 0xe8f8ff }), iceT: iceMat({ op: 0.6, ei: 0.8, side: THREE.DoubleSide }),
    core: glowMat(acc, 3.4), eye: glowMat(0xeaffff, 4),
    mist: std({ color: 0xc8ecff, emissive: acc, emissiveIntensity: 0.55, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6 }),
    mist2: std({ color: 0xffffff, emissive: 0x9adcff, emissiveIntensity: 0.8, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  };
  const add = adder();
  // 허리 · 가슴: 깎아낸 결정 몸
  const WA = (v) => ({ y: -0.06 + 0.26 * v, rx: 0.1 - 0.03 * Math.sin(v * Math.PI), rzF: 0.07 - 0.015 * Math.sin(v * Math.PI), rzB: 0.07 - 0.012 * Math.sin(v * Math.PI) });
  add(J.spine, C('sp:waist', () => loft(WA, 12, 6)), M.ice);
  const CHX = spl([[0, 0.088], [0.45, 0.11], [0.75, 0.118], [1, 0.07]]), CHZ = spl([[0, 0.066], [0.5, 0.078], [1, 0.06]]);
  const CH = (v) => ({ y: -0.03 + 0.31 * v, rx: CHX(v), rzF: CHZ(v), rzB: CHZ(v) * 0.95 });
  add(J.chest, C('sp:chest', () => loft(CH, 14, 8, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z += 0.02 * gauss(Math.abs(p.x) - 0.05, 0.035) * gauss(p.y - 0.14, 0.05); } })), M.ice);
  add(J.chest, C('sp:collar', () => xf(crystalGeo(0.12, 0.06), [0, 0.25, 0], [0, 0, 0], [1.3, 0.6, 1.1])), M.ice);
  // 가슴의 빛나는 핵 + 서리 고리
  const core = add(J.chest, C('sp:core', () => new THREE.IcosahedronGeometry(0.04, 0)), M.core, [0, 0.13, 0.072]);
  add(J.chest, C('sp:coreRing', () => new THREE.TorusGeometry(0.052, 0.006, 6, 6)), M.iceS, [0, 0.13, 0.07]);
  // 어깨 결정 (위 · 바깥으로 솟음)
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(J.chest, C('sp:pau' + k, () => crystalGeo(0.14 - k * 0.03, 0.026 - k * 0.004)), M.ice, [s * (0.11 + k * 0.03), 0.23 - k * 0.03, -0.02 - k * 0.012], [-0.35 - k * 0.1, 0, -s * (0.55 + k * 0.32)]);
  // 등 뒤 얼음 날개 조각
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) add(J.chest, C('sp:wing' + k, () => xf(crystalGeo(0.3 - k * 0.05, 0.03), [0, 0, 0], [0, 0, 0], [1, 1, 0.35])), M.iceT, [s * 0.06, 0.2 - k * 0.04, -0.08], [-0.6, s * 0.2, -s * (0.75 + k * 0.32)]);
  // 아래: 고드름 치마 + 눈보라 소용돌이
  { const list = [], r = rng(41); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, L = 0.18 + r() * 0.24 + (Math.cos(a) < 0 ? 0.08 : 0);
      list.push(xf(crystalGeo(L, 0.026, 0.15, 0.45), [Math.sin(a) * 0.1, 0.02, Math.cos(a) * 0.075], [Math.PI + Math.cos(a) * 0.32, 0, -Math.sin(a) * 0.32])); }
    add(J.hips, C('sp:icicles', () => merge(list)), M.ice); }
  add(J.hips, C('sp:pelvis', () => loft((v) => ({ y: 0.06 - 0.12 * v, rx: 0.1 + 0.02 * v, rzF: 0.072, rzB: 0.076 }), 12, 4)), M.ice);
  const vortex = new THREE.Group(); J.hips.add(vortex);
  const VX = (k, tw) => surf((u, v, p) => { const a = u * TAU + v * tw, R = (0.15 + 0.05 * Math.sin(v * Math.PI)) * (1 - v) ** 1.2 * (1 + 0.18 * Math.sin(a * 3 + v * 9)) * k; p.set(Math.sin(a) * R * (0.7 + 0.3 * smooth(0, 0.25, v)), -0.02 - 0.92 * v, Math.cos(a) * R * (0.7 + 0.3 * smooth(0, 0.25, v))); }, 36, 18, { closedU: true });
  const vx1 = add(vortex, C('sp:vx1', () => VX(1, 5)), M.mist), vx2 = add(vortex, C('sp:vx2', () => VX(1.3, -4)), M.mist2);
  // 팔: 가는 결정 팔 · 앞팔의 고드름 날 · 세 손가락 발톱
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(a, C('sp:ua', () => loft((v) => ({ y: 0.02 - (D.uArm + 0.02) * v, rx: 0.036 - 0.008 * v, rz: 0.034 - 0.008 * v }), 8, 5)), M.ice);
    add(b, C('sp:la', () => loft((v) => ({ y: 0.02 - (D.lArm + 0.02) * v, rx: 0.03 - 0.006 * v, rz: 0.03 + 0.012 * Math.sin(v * Math.PI) }), 8, 5)), M.ice);
    add(b, C('sp:blade', () => xf(crystalGeo(0.3, 0.02, 0.1, 0.5), [0, 0, 0], [0, 0, 0], [0.5, 1, 1])), M.iceT, [s * 0.026, -0.05, -0.03], [Math.PI - 0.25, 0, s * 0.2]);
    for (let f = 0; f < 3; f++) add(c, C('sp:claw' + f, () => strand([[0, 0, 0], [(f - 1) * 0.012, -0.05, 0.02], [(f - 1) * 0.02, -0.1, 0.045], [(f - 1) * 0.024, -0.14, 0.08]], 0.009, 0.001, { seg: 10, rad: 5 })), M.iceS, [0, -0.01, 0.005]);
    add(c, C('sp:palm', () => xf(new THREE.IcosahedronGeometry(0.03, 0), [0, -0.015, 0], [0, 0, 0], [0.8, 1, 1.1])), M.ice);
  }
  // 머리: 매끈한 얼음 얼굴 + 빛나는 눈 + 뒤로 뻗은 고드름 관
  const H = J.head; const { headPt, dirOf } = SP_HEAD;
  add(H, C('sp:head', () => surf((u, v, p) => { const d = dirOf((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI); headPt(d.x, d.y, d.z, p); }, 40, 30, { closedU: true, poles: [0, 30] })), M.iceS);
  for (const s of [-1, 1]) add(H, C('sp:eye', () => new THREE.SphereGeometry(0.012, 10, 8)), M.eye, [s * 0.028, 0.104, 0.082], [0, s * 0.3, s * -0.2], [1.5, 0.45, 0.4]);
  { const list = [], r = rng(57);
    for (let i = 0; i < 13; i++) { const t = (i / 12 - 0.5), L = 0.2 + 0.16 * (1 - Math.abs(t) * 1.6) + r() * 0.05; list.push(xf(crystalGeo(L, 0.016, 0.1, 0.5), [t * 0.12, 0.17 + 0.03 * (1 - Math.abs(t)), -0.02], [-1.15 - Math.abs(t) * 0.5 + (r() - 0.5) * 0.15, 0, -t * 1.3])); }
    for (let i = 0; i < 6; i++) { const t = i / 5 - 0.5; list.push(xf(crystalGeo(0.12, 0.012, 0.1, 0.5), [t * 0.1, 0.205, 0.04], [-0.35, 0, -t * 1.1])); }
    add(H, C('sp:crest', () => merge(list)), M.ice); }
  // 몸 주위를 도는 결정
  const orb = new THREE.Group(); orb.position.y = 1.15; m.body.add(orb);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; add(orb, C('sp:orb', () => crystalGeo(0.11, 0.022, 0.4, 0.4)), M.ice, [Math.cos(a) * 0.48, Math.sin(i * 2) * 0.12, Math.sin(a) * 0.48], [0.3, 0, 0.4]); }
  // 서리 리본 두 가닥 (등 · 로프 물리)
  m.ropes = [];
  for (const s of [-1, 1]) { const rope = new Rope(7, 0.07, { damp: 0.96, stiff: 0.05 }), view = new RopeTube(rope, M.mist, { sub: 3, rad: 6, flat: 0.15, side: new V3(1, 0, 0), prof: (v) => 0.04 * (1 - v * 0.7) });
    m.ropes.push({ rope, view, joint: J.chest, local: new V3(s * 0.05, 0.2, -0.07), rest: new V3(s * 0.25, -0.3, -1).normalize(), side: true, sideL: new V3(1, 0, 0), hq: new THREE.Quaternion() }); }
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const x of extras) scene.remove(x); extras.length = 0; for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  let t = 0; const tmp = new V3(), rq = new THREE.Quaternion();
  m.sole = 0.26;
  m.update = (dt, f) => {
    t += dt; m.sole = 0.26 + Math.sin(t * 1.9) * 0.05; orb.rotation.y += dt * 1.3; vx1.rotation.y -= dt * 2.4; vx2.rotation.y += dt * 1.7; core.rotation.y += dt * 2; core.rotation.x += dt;
    M.core.emissiveIntensity = 3 + Math.sin(t * 6) * 0.6 + (f && f.state === 'act' ? 1.5 : 0);
    if (!f) return; m.root.getWorldQuaternion(rq); J.chest.getWorldQuaternion(m.ropes[0].hq); m.ropes[1].hq.copy(m.ropes[0].hq);
    const caps = [{ a: f.hurt[0].a, b: f.hurt[0].b, r: f.hurt[0].r }];
    ropeStep(m, f, dt, caps, rq, tmp, new V3(-f.vel.x * 0.8, 0.6, -f.vel.z * 0.8));
    if (f.root.visible && Math.random() < dt * 14) { const p = J.hips.getWorldPosition(tmp).add(new V3((Math.random() - 0.5) * 0.4, -Math.random() * 0.8 * f.scale, (Math.random() - 0.5) * 0.4)); f.G.fx.p(p, { vel: [0, -0.4, 0], size: 0.08, size1: 0.02, life: 0.7, color: 0xe0f6ff, alpha: 0.8, drag: 1 }); }
  };
  m.tipPos = (out) => J.handL.localToWorld(out.set(0, -0.08, 0.04));
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.1, 0)); J.handR.localToWorld(tt.set(0, -0.14, 0.08)); };
  return m;
}

/* =====================================================================
   3. 설원 예티 — 거구 (굽은 등 · 땅에 닿을 듯 긴 팔 · 흰 털 · 숫양 뿔)
   ===================================================================== */
const Y_CH = (() => { const X = spl([[0, 0.3], [0.35, 0.37], [0.62, 0.42], [0.85, 0.34], [1, 0.16]]), F = spl([[0, 0.25], [0.4, 0.28], [0.7, 0.26], [1, 0.12]]), B = spl([[0, 0.25], [0.4, 0.3], [0.7, 0.33], [0.9, 0.26], [1, 0.12]]);
  return (v) => ({ y: -0.08 + 0.58 * v, rx: X(v), rzF: F(v), rzB: B(v), cz: -0.03 * v }); })();
const Y_BELLY = (v) => ({ y: -0.1 + 0.36 * v, rx: 0.3 + 0.02 * Math.sin(v * Math.PI), rzF: 0.27 + 0.04 * Math.sin(v * Math.PI), rzB: 0.23, cz: 0.02 });
const Y_HEAD = (() => { const X = spl([[0, 0], [0.1, 0.1], [0.4, 0.13], [0.7, 0.115], [0.92, 0.08], [1, 0]]), Tp = spl([[0, 0], [0.1, 0.1], [0.45, 0.13], [0.75, 0.1], [0.92, 0.06], [1, 0]]), Bt = spl([[0, 0], [0.1, 0.09], [0.5, 0.13], [0.8, 0.12], [0.95, 0.06], [1, 0]]);
  return (v) => ({ z: -0.12 + 0.3 * v, rx: X(v), ryT: Tp(v), ryB: Bt(v), cy: 0.05 }); })();
export function buildYeti(pal, o = {}) {
  const D = GOLEM_DIMS, m = buildHumanoid(D), J = m.J, extras = [];
  const fN = T('furN', () => furNormal());
  const M = {
    fur: phys({ map: T('yetiFur', () => furTex('#c8d6e6', '#eef3f8', '#ffffff', 23, 0.6)), normalMap: fN, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xe0f0ff), sheenRoughness: 0.5 }),
    tuft: phys({ color: 0xeef4fa, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }),
    tuftB: phys({ color: 0xb8cce0, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xe0f0ff), side: THREE.DoubleSide }),
    skin: phys({ color: 0x7486a4, roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color(0x9ab0d0) }),
    skinD: std({ color: 0x2a3244, roughness: 0.8 }),
    horn: phys({ map: T('horn', () => { const [c, g] = cv(64, 256); g.fillStyle = '#d8cfbc'; g.fillRect(0, 0, 64, 256); for (let y = 0; y < 256; y += 9) { g.fillStyle = 'rgba(90,70,50,0.35)'; g.fillRect(0, y, 64, 3); } return tex(c, [1, 3]); }), roughness: 0.55, clearcoat: 0.3 }),
    tooth: phys({ color: 0xf2eee0, roughness: 0.35, clearcoat: 0.5 }), nail: std({ color: 0x1a1e28, roughness: 0.4 }),
    eye: glowMat(pal.accent ?? 0x6ac8ff, 3.6), ice: iceMat(),
  };
  const add = adder();
  // 몸통: 골반 · 배 · 굽은 등과 솟은 어깨
  add(J.hips, C('y:pelvis', () => loft((v) => ({ y: 0.08 - 0.26 * v, rx: 0.3 - 0.06 * v * v, rzF: 0.22 - 0.04 * v, rzB: 0.24, n: 2.2 }), 32, 8)), M.fur);
  add(J.spine, C('y:belly', () => loft(Y_BELLY, 32, 10)), M.fur);
  add(J.chest, C('y:chest', () => loft(Y_CH, 40, 18, { mod: (p, u, v, c, sn) => { // 등의 혹 · 승모근 · 가슴 판
    if (sn < 0) p.z -= 0.06 * gauss(v - 0.78, 0.18) * -sn * (1 - Math.abs(c) * 0.5); if (sn > 0) p.z += 0.03 * gauss(Math.abs(p.x) - 0.16, 0.1) * gauss(v - 0.55, 0.15); p.y += 0.05 * gauss(Math.abs(p.x) - 0.24, 0.1) * smooth(0.6, 1, v); } })), M.fur);
  add(J.chest, C('y:chestTop', () => xf(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2), [0, 0.48, -0.02], [0, 0, 0], [0.24, 0.12, 0.2])), M.fur);
  // 털 덮개
  add(J.chest, C('y:chestFur', () => furCover(Y_CH, 70, 61, (i, r) => i < 30 ? { u: 0.5 + (r() - 0.5) * 0.7, v: 0.1 + r() * 0.7, len: 0.14 + r() * 0.1, w: 0.04, dir: [0, -1, 0.15], out: 0.4, sag: 0.3 } : { u: (r() - 0.5) * 0.7, v: 0.2 + r() * 0.75, len: 0.15 + r() * 0.12, w: 0.045, dir: [0, -1, -0.2], out: 0.45, sag: 0.25 })), M.tuft);
  add(J.spine, C('y:bellyFur', () => furCover(Y_BELLY, 40, 62, (i, r) => ({ u: r(), v: 0.1 + r() * 0.7, len: 0.14 + r() * 0.1, w: 0.04, dir: [0, -1, 0], out: 0.35, sag: 0.25 }))), M.tuftB);
  add(J.hips, C('y:hipFur', () => { const r = rng(63), list = []; for (let i = 0; i < 34; i++) { const a = r() * TAU, R = 0.3; list.push(tuftGeo([Math.sin(a) * R * 0.95, -0.05 - r() * 0.1, Math.cos(a) * 0.23], [Math.sin(a) * 0.4, -1, Math.cos(a) * 0.4], 0.2 + r() * 0.12, 0.045, 0.2)); } return merge(list); }), M.tuft);
  // 어깨 · 등의 얼음 결정
  { const list = [], r = rng(71); for (const s of [-1, 1]) for (let i = 0; i < 5; i++) list.push(xf(crystalGeo(0.16 + r() * 0.14, 0.04), [s * (0.24 + r() * 0.14), 0.46 + r() * 0.06, -0.12 - r() * 0.12], [-0.5 - r() * 0.4, 0, -s * (0.3 + r() * 0.6)]));
    for (let i = 0; i < 4; i++) list.push(xf(crystalGeo(0.12 + r() * 0.08, 0.035), [(r() - 0.5) * 0.2, 0.3 + i * 0.04, -0.33], [-1.2, 0, (r() - 0.5) * 0.6]));
    add(J.chest, C('y:ice', () => merge(list)), M.ice); }
  // 머리: 가슴에 파묻힌 얼굴 (짙은 피부) · 털 두건 · 숫양 뿔 · 아래 엄니
  const H = J.head, hg = new THREE.Group(); hg.position.set(0, -0.04, 0.15); hg.scale.setScalar(1.45); H.add(hg);
  add(hg, C('y:skull', () => zLoft(Y_HEAD, 30, 24)), M.fur);
  const FACE = (v) => { const e = Math.sin(Math.PI * v) ** 0.5; return { z: 0.0 + 0.2 * v, rx: 0.095 * e + 0.005, ryT: 0.075 * e, ryB: 0.09 * e, cy: 0.035 }; };
  add(hg, C('y:face', () => zLoft(FACE, 28, 20, (p) => { const ax = Math.abs(p.x);
    p.z += 0.035 * gauss(p.y - 0.085, 0.022) * gauss(ax - 0.035, 0.05);            // 눈썹뼈
    p.z += 0.04 * gauss(p.y - 0.03, 0.03) * gauss(p.x, 0.03);                         // 넓은 코
    p.z += 0.02 * gauss(p.y + 0.02, 0.03) * gauss(ax, 0.07);                          // 주둥이
    p.z -= 0.012 * gauss(p.y - 0.06, 0.015) * gauss(ax - 0.04, 0.02); })), M.skin);   // 눈구멍
  for (const s of [-1, 1]) {
    add(hg, C('y:eye', () => new THREE.SphereGeometry(0.014, 10, 8)), M.eye, [s * 0.04, 0.066, 0.19], [0, 0, 0], [1.3, 0.7, 0.6]);
    add(hg, C('y:nostril', () => new THREE.SphereGeometry(0.009, 8, 6)), M.skinD, [s * 0.016, 0.028, 0.236], [0, 0, 0], [1, 0.6, 0.6]);
    add(hg, C('y:tusk', () => xf(new THREE.ConeGeometry(0.012, 0.07, 8), [0, 0.035, 0], [0, 0, 0])), M.tooth, [s * 0.045, -0.035, 0.2], [0.25, 0, s * -0.25]);
    // 숫양 뿔: 옆머리에서 뒤로 말려 앞으로 감김
    const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, a = t * 4.6, R = 0.09 * (1 - t * 0.55); pts.push(new V3(s * (0.1 + t * 0.07), 0.13 + Math.sin(a) * R * 0.9, -0.02 - Math.cos(a) * R + R)); }
    add(hg, C('y:horn' + s, () => strand(pts, 0.034, 0.008, { seg: 40, rad: 10 })), M.horn);
  }
  add(hg, C('y:mouth', () => xf(new THREE.TorusGeometry(0.05, 0.006, 6, 20, Math.PI), [0, -0.02, 0.2], [0, 0, Math.PI], [1, 0.4, 1])), M.skinD);
  add(hg, C('y:hood', () => { const r = rng(83), list = []; for (let i = 0; i < 40; i++) { const a = -2.4 + (i / 39) * 4.8, e = 0.2 + r() * 0.9; const p = [Math.sin(a) * 0.13 * Math.cos(e * 0.5), 0.05 + Math.sin(e) * 0.12, Math.cos(a) * 0.12 - 0.02]; list.push(tuftGeo(p, [Math.sin(a) * 0.8, -0.5 + r() * 0.3, Math.cos(a) * 0.2 - 0.6], 0.12 + r() * 0.08, 0.03, 0.3)); }
    for (let i = 0; i < 10; i++) { const x = (i / 9 - 0.5) * 0.14; list.push(tuftGeo([x, -0.06, 0.17], [x * 2, -1, 0.3], 0.1 + Math.abs(x) * 0.4, 0.022, 0.2)); } return merge(list); }), M.tuft); // 털 두건 · 턱수염
  // 팔: 굵은 털 팔 · 짙은 손 (손가락 · 손톱)
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(a, C('y:del', () => xf(new THREE.SphereGeometry(0.15, 20, 14), [0, -0.03, 0], [0, 0, 0], [0.95, 1, 0.95])), M.fur);
    add(a, C('y:ua', () => loft((v) => ({ y: 0.04 - (D.uArm + 0.04) * v, rx: 0.13 - 0.03 * v + 0.02 * Math.sin(v * Math.PI), rz: 0.12 - 0.02 * v + 0.02 * Math.sin(v * Math.PI) }), 24, 10)), M.fur);
    add(b, C('y:la', () => loft((v) => ({ y: 0.03 - (D.lArm + 0.0) * v, rx: 0.115 + 0.02 * Math.sin(v * 2.4) - 0.03 * v, rzF: 0.11, rzB: 0.13 + 0.02 * Math.sin(v * 2) - 0.03 * v }), 24, 10)), M.fur);
    add(b, C('y:laFur', () => { const r = rng(91), list = []; for (let i = 0; i < 22; i++) { const a = r() * TAU, y = -0.05 - r() * 0.3; list.push(tuftGeo([Math.sin(a) * 0.12, y, Math.cos(a) * 0.12], [Math.sin(a) * 0.5, -1, Math.cos(a) * 0.5 - 0.3], 0.14 + r() * 0.08, 0.04, 0.2)); } return merge(list); }), M.tuft);
    add(b, C('y:icicle', () => merge([0, 1, 2].map((k) => xf(crystalGeo(0.1 + k * 0.03, 0.016, 0.2, 0.6), [(k - 1) * 0.05, -0.32 - k * 0.02, -0.14], [Math.PI, 0, 0])))), M.ice);
    const hand = sculptHand(add, c, 'y:', s, M.skin, 2.4, M.nail); hand.position.set(0, 0.03, 0); hand.rotation.x = -0.3;
    add(c, C('y:wristFur', () => merge([0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * TAU; return tuftGeo([Math.sin(a) * 0.08, 0.04, Math.cos(a) * 0.08], [Math.sin(a), -0.4, Math.cos(a)], 0.08, 0.03, 0.4); }))), M.tuft);
  }
  // 다리: 짧고 굵다 · 넓은 맨발
  for (const [a, b, c] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(a, C('y:th', () => loft((v) => ({ y: 0.06 - (D.thigh + 0.06) * v, rx: 0.15 - 0.02 * v, rz: 0.16 - 0.03 * v }), 24, 8)), M.fur);
    add(b, C('y:sh', () => loft((v) => ({ y: 0.02 - (D.shin + 0.02) * v, rx: 0.13 - 0.02 * v, rzF: 0.12, rzB: 0.14 - 0.03 * v }), 24, 8)), M.fur);
    add(b, C('y:shFur', () => { const r = rng(97), list = []; for (let i = 0; i < 18; i++) { const a = r() * TAU; list.push(tuftGeo([Math.sin(a) * 0.12, -0.18 - r() * 0.16, Math.cos(a) * 0.12], [Math.sin(a) * 0.5, -1, Math.cos(a) * 0.5], 0.12 + r() * 0.06, 0.04, 0.2)); } return merge(list); }), M.tuft);
    add(c, C('y:foot', () => zLoft((v) => { const e = Math.sin(Math.PI * Math.min(1, v * 1.03)) ** 0.55; return { z: -0.09 + 0.3 * v, rx: 0.1 * e + 0.005, ryT: 0.07 * e * (1 - 0.5 * v), ryB: 0.02 * e, cy: -0.04 }; }, 24, 16)), M.skin);
    for (let k = 0; k < 4; k++) add(c, C('y:toe', () => xf(new THREE.SphereGeometry(0.03, 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.8, 1.3])), M.skin, [(k - 1.5) * 0.045, -0.045, 0.19 - Math.abs(k - 1.5) * 0.02]);
  }
  // 긴 털 다발 (팔 뒤 · 로프 물리)
  m.ropes = [];
  for (const [jt, s] of [[J.elbowL, 1], [J.elbowR, -1]]) for (const dz of [0.04, -0.06]) { const rope = new Rope(5, 0.08, { damp: 0.96, stiff: 0.08 }), view = new RopeTube(rope, M.tuft, { sub: 3, rad: 7, flat: 0.35, side: new V3(1, 0, 0), prof: (v) => 0.05 * (1 - v * 0.85) });
    m.ropes.push({ rope, view, joint: jt, local: new V3(s * 0.06, -0.12, -0.12 + dz), rest: new V3(0, -1, -0.3).normalize(), side: true, sideL: new V3(1, 0, 0), hq: new THREE.Quaternion() }); }
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const x of extras) scene.remove(x); extras.length = 0; for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  const tmp = new V3(), rq = new THREE.Quaternion();
  m.sole = 0.07;
  m.update = (dt, f) => { if (!f) return; m.root.getWorldQuaternion(rq); for (const r of m.ropes) r.joint.getWorldQuaternion(r.hq);
    const caps = f.hurt.slice(2, 6).map((c) => ({ a: c.a, b: c.b, r: c.r * 1.1 })); ropeStep(m, f, dt, caps, rq, tmp, new V3(-f.vel.x * 0.5, 0, -f.vel.z * 0.5)); };
  m.tipPos = (out) => J.handR.localToWorld(out.set(0, -0.15, 0.1));
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.2, 0)); J.handR.localToWorld(tt.set(0, -0.22, 0.05)); };
  return m;
}

/* =====================================================================
   4. 빙설 여왕 이스벨 — 떠 있는 드레스 · 서리 깃 · 결정 왕관 · 눈송이 지팡이
   ===================================================================== */
export const QUEEN_DIMS = { hipH: 0.95, spineL: 0.19, chestL: 0.26, neckL: 0.075, shW: 0.17, uArm: 0.27, lArm: 0.25, hipW: 0.085, thigh: 0.42, shin: 0.42, headTop: 0.27 };
export const QST = { butt: -0.42, top: 1.0, head: 1.12 }; // 지팡이 (오른손 기준 +Z)
const Q_HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.07, 0.1, 0.088], jaw: 0.36, chin: 0.01 });
// 드레스 천: 위는 짙은 남빛 → 밑단은 얼음빛, 은사 세로줄 · 밑단 눈송이 자수
function gownTex() { // 캔버스 아래 = 허리(v 0), 위 = 밑단(v 1)
  const W = 1024, H = 1024, [c, g] = cv(W, H), r = rng(77);
  const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, '#1c2e5e'); gr.addColorStop(0.45, '#2e5aa8'); gr.addColorStop(0.82, '#8ac4f0'); gr.addColorStop(1, '#e4f6ff');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) { const x = (i / 16) * W, fg = g.createLinearGradient(x, 0, x + W / 16, 0); fg.addColorStop(0, 'rgba(255,255,255,0.07)'); fg.addColorStop(0.5, 'rgba(0,0,40,0)'); fg.addColorStop(1, 'rgba(0,0,40,0.2)'); g.fillStyle = fg; g.fillRect(x, 0, W / 16, H); }
  g.strokeStyle = 'rgba(220,240,255,0.5)'; for (let i = 0; i < 16; i++) { const x = (i / 16) * W + W / 32; g.lineWidth = 2; g.beginPath(); g.moveTo(x, H); g.lineTo(x, H * 0.3); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.95)'; for (let i = 0; i < 30; i++) { const x = r() * W, y = H * (0.05 + 0.4 * r()), s = 14 + r() * 26; flake(g, x, y, s, 2 + s / 18); }
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 14, W, 8); g.fillStyle = 'rgba(200,230,255,0.9)'; g.fillRect(0, 36, W, 3);
  return tex(c);
}
// 보디스: 남빛 + 은 덩굴 상감
function bodiceTex() {
  const W = 512, H = 512, [c, g] = cv(W, H); g.fillStyle = '#22386e'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(220,236,255,0.8)'; g.lineWidth = 3;
  for (let k = 0; k < 4; k++) { const x0 = k * W / 4 + W / 8; g.beginPath(); for (let y = 0; y <= H; y += 8) g.lineTo(x0 + Math.sin(y / 40) * 22, y); g.stroke();
    for (let y = 20; y < H; y += 60) { flake(g, x0 + Math.sin(y / 40) * 22, y, 12, 2); } }
  return tex(c, [2, 1]);
}
// 서리 레이스 (깃 · 망토): 투명 바탕 + 결정 무늬
function frostLaceTex(seed = 5) {
  const W = 512, [c, g] = cv(W, W), r = rng(seed); g.clearRect(0, 0, W, W); g.fillStyle = seed === 8 ? 'rgba(150,200,245,0.62)' : 'rgba(200,236,255,0.35)'; g.fillRect(0, 0, W, W);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 18; i++) flake(g, r() * W, r() * W, 18 + r() * 30, 2);
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; for (let i = 0; i < 90; i++) { g.beginPath(); const x = r() * W, y = r() * W; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 50, y + (r() - 0.5) * 50); g.stroke(); }
  return tex(c, [2, 2]);
}
function hairTexQ() {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(19); g.fillStyle = '#dfe8f4'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.4 ? '#a8b8d0' : k > 0.85 ? '#ffffff' : '#c8d6e8'; g.globalAlpha = 0.35 + r() * 0.4; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.bezierCurveTo(x + (r() - 0.5) * 30, H * 0.66, x + (r() - 0.5) * 30, H * 0.33, x + (r() - 0.5) * 12, 0); g.stroke(); }
  g.globalAlpha = 1; return tex(c);
}
export function buildIceQueen(pal, o = {}) {
  const D = QUEEN_DIMS, m = buildHumanoid(D), J = m.J, extras = [], env = envCube(), ghost = !!o.ghost;
  const acc = pal.accent ?? 0x8ae8ff;
  const M = {
    skin: phys({ color: 0xe6eefa, emissive: 0x3a4a6a, emissiveIntensity: 0.25, roughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color(0xc8e0ff) }),
    gown: phys({ map: T('gown', gownTex), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xbfe4ff), sheenRoughness: 0.35, side: THREE.DoubleSide }),
    bodice: phys({ map: T('bodice', bodiceTex), roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0x9ac8ff), clearcoat: 0.3 }),
    lace: phys({ map: T('flace', () => frostLaceTex(5)), transparent: true, depthWrite: false, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide, emissive: 0x2a5a8a, emissiveIntensity: 0.3 }),
    cape: phys({ map: T('flace2', () => frostLaceTex(8)), transparent: true, opacity: 0.85, depthWrite: false, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xdff4ff), side: THREE.DoubleSide, emissive: 0x1a3a6a, emissiveIntensity: 0.35 }),
    silver: phys({ color: 0xdfe8f2, metalness: 1, roughness: 0.2, clearcoat: 0.5 }), silverD: phys({ color: 0x9aaac0, metalness: 1, roughness: 0.3 }),
    hair: phys({ map: T('qhair', hairTexQ), roughness: 0.38, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.3, side: THREE.DoubleSide }),
    ice: iceMat({ ei: 0.6 }), iceT: iceMat({ op: 0.55, ei: 0.7, side: THREE.DoubleSide }), gem: glowMat(acc, 3), eye: glowMat(0xdffcff, 4.5),
    sleeve: phys({ color: 0x2a4a8e, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0x9ac8ff), side: THREE.DoubleSide }),
  };
  const add = adder();
  const rim = (parent, key, pts, r, closed, mat = M.silver) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, oo = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...oo }), r, !(oo.a1 - (oo.a0 ?? 0) < 0.999), mat);
  m.ropes = [];
  // 드레스: 허리에서 길게 퍼지는 치마 (주름 · 들쭉날쭉한 얼음 밑단)
  const GL = 1.02, gR = (t) => { const e = t ** 1.5; return { rx: 0.13 + 0.42 * e, rzF: 0.11 + 0.38 * e, rzB: 0.12 + 0.5 * e }; };
  const GP = (v) => ({ y: 0.05 - GL * v, ...gR(v) });
  const fold = (p, u, v) => { const w = Math.sin(u * TAU * 12 + 0.4) + 0.4 * Math.sin(u * TAU * 25), k = 1 + 0.045 * w * smooth(0.1, 1, v); p.x *= k; p.z *= k; p.y += (0.03 * Math.sin(u * TAU * 9) + 0.02 * Math.sin(u * TAU * 23)) * smooth(0.9, 1, v); };
  const gown = add(J.hips, C('q:gown', () => loft(GP, 160, 22, { mod: fold })), M.gown);
  add(J.hips, C('q:over', () => loft((v) => { const s = GP(v * 0.86); return { ...s, rx: s.rx * 1.05 + 0.01, rzF: s.rzF * 1.05 + 0.01, rzB: s.rzB * 1.05 + 0.01 }; }, 96, 14, { a0: 0.6, a1: 1.4, mod: fold })), M.lace);
  { const list = [], r = rng(31); for (let i = 0; i < 26; i++) { const u = i / 26, p = loftAt(GP, u, 0.985, new V3(), fold), n = new V3(p.x, 0, p.z).normalize(), L = 0.12 + r() * 0.14;
      const g = crystalGeo(L, 0.03, 0.2, 0.4); g.rotateX(Math.PI * 0.78); g.rotateY(Math.atan2(n.x, n.z)); g.translate(p.x, p.y + 0.03, p.z); list.push(g); }
    add(J.hips, C('q:hemIce', () => merge(list)), M.ice); }
  // 허리 띠 + 보석
  const BELT = (v) => ({ y: 0.02 + 0.05 * v, rx: 0.135, rzF: 0.11, rzB: 0.118, n: 2.2 });
  add(J.hips, C('q:belt', () => loft(BELT, 48, 2)), M.silver);
  add(J.hips, C('q:beltGem', () => xf(new THREE.OctahedronGeometry(0.03, 0), [0, 0, 0], [0, 0, 0], [0.8, 1.3, 0.5])), M.gem, [0, 0.045, 0.118]);
  // 보디스 · 가슴 · 목선
  const bX = spl([[0, 0.112], [0.45, 0.088], [1, 0.104]]), bF = spl([[0, 0.078], [0.5, 0.066], [1, 0.076]]);
  add(J.spine, C('q:waist', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.15 }), 40, 10)), M.bodice);
  const chX = spl([[0, 0.104], [0.3, 0.114], [0.55, 0.122], [0.8, 0.118], [1, 0.094]]), chF = spl([[0, 0.076], [0.5, 0.086], [1, 0.07]]), chB = spl([[0, 0.078], [0.6, 0.086], [1, 0.07]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.026 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('q:chest', () => loft((v) => chP(v * 0.72), 56, 16, { mod: chMod })), M.bodice);
  add(J.chest, C('q:chestSkin', () => loft((v) => { const s = chP(0.66 + 0.34 * v); return { ...s, rx: s.rx - 0.002, rzF: s.rzF - 0.002, rzB: s.rzB - 0.002 }; }, 48, 8, { mod: chMod })), M.skin);
  add(J.chest, C('q:shoulderTop', () => loft((v) => ({ y: 0.255 + 0.04 * v, rx: 0.094 - 0.05 * v, rzF: 0.068 - 0.024 * v, rzB: 0.068 - 0.022 * v }), 40, 6)), M.skin);
  lRim(J.chest, 'q:neckline', (v) => chP(0.72), 0, 0.005, M.silver, { mod: chMod });
  add(J.chest, C('q:brooch', () => xf(new THREE.OctahedronGeometry(0.034, 0), [0, 0, 0], [0, 0, 0], [0.8, 1.4, 0.45])), M.gem, [0, 0.185, 0.088]);
  add(J.chest, C('q:broochR', () => new THREE.TorusGeometry(0.038, 0.005, 6, 6)), M.silver, [0, 0.185, 0.084], [0, 0, Math.PI / 6]);
  // 서리 깃: 목 뒤로 부채처럼 솟은 레이스 + 끝의 고드름
  const colF = (u, v, p) => { const a = -2.5 + u * 5.0, R = 0.07 + 0.14 * v ** 0.9, h = 0.25 + 0.24 * v; p.set(Math.sin(a) * R, h + 0.03 * Math.cos(u * TAU * 4) * v, Math.cos(a) * R * 0.9 - 0.02 - 0.06 * v); };
  add(J.chest, C('q:collar', () => surf(colF, 64, 8)), M.lace);
  { const pts = []; for (let i = 0; i <= 64; i++) { const p = new V3(); colF(i / 64, 1, p); pts.push(p); } rim(J.chest, 'q:collarRim', pts, 0.004, false);
    const list = []; for (let i = 0; i <= 10; i++) { const p = new V3(); colF(i / 10, 1, p); const dir = new V3(p.x, 0, p.z).normalize(); list.push(xf(crystalGeo(0.07 + 0.05 * Math.sin(i / 10 * Math.PI), 0.012), [p.x, p.y - 0.01, p.z], [-0.2 + dir.z * 0.6, 0, -dir.x * 0.6])); }
    add(J.chest, C('q:collarIce', () => merge(list)), M.ice); }
  // 어깨 결정 견장
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(J.chest, C('q:ep' + k, () => crystalGeo(0.11 - k * 0.025, 0.02)), M.ice, [s * (0.12 + k * 0.025), 0.26 - k * 0.02, -0.01], [-0.2, 0, -s * (0.9 + k * 0.35)]);
  // 팔: 몸에 붙는 긴 소매 · 종 모양 소맷부리 (은테) · 손
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('q:ua', () => loft((v) => ({ y: 0.03 - (D.uArm + 0.03) * v, rx: 0.046 - 0.01 * v, rz: 0.044 - 0.009 * v }), 24, 8)), M.sleeve);
    add(sh, C('q:puff', () => loft((v) => ({ y: 0.04 - 0.1 * v, rx: 0.058 + 0.01 * Math.sin(v * Math.PI), rz: 0.056 + 0.01 * Math.sin(v * Math.PI) }), 24, 6)), M.lace);
    add(el, C('q:la', () => loft((v) => ({ y: 0.02 - (D.lArm - 0.02) * v, rx: 0.038 - 0.008 * v, rz: 0.036 - 0.008 * v }), 24, 8)), M.sleeve);
    const cfP = (v) => ({ y: -D.lArm + 0.07 - 0.14 * v, rx: 0.036 + 0.05 * v ** 1.3, rz: 0.035 + 0.045 * v ** 1.3 });
    const cfMod = (p, u, v, c) => { p.y += 0.06 * v * (1 - Math.max(0, s * c)); };
    add(el, C('q:cuff' + s, () => loft(cfP, 40, 6, { mod: cfMod })), M.sleeve); add(el, C('q:cuffL' + s, () => loft((v) => { const q = cfP(v); return { ...q, rx: q.rx + 0.004, rz: q.rz + 0.004 }; }, 40, 6, { mod: cfMod })), M.lace);
    lRim(el, 'q:cuffHem' + s, cfP, 1, 0.004, M.silver, { mod: cfMod });
    const hg = sculptHand(add, ha, 'q:', s, M.skin, 0.85); hg.position.y = -0.006;
  }
  // 목 · 머리 · 이마 장식 가면 · 머리카락 · 결정 왕관
  add(J.neck, C('q:neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.033 - 0.007 * smooth(0.2, 0.8, v), rzF: 0.032 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.032 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head; const { headPt, headAt, dirOf } = Q_HEAD; H.scale.setScalar(1.08);
  add(H, C('q:head', () => surf((u, v, p) => { const d = dirOf((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI); headPt(d.x, d.y, d.z, p); }, 72, 54, { closedU: true, poles: [0, 54] })), M.skin);
  // 은 가면: 눈가를 감싸는 얇은 테 + 빛나는 눈
  for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU, az = s * 0.42 + Math.cos(a) * 0.3 + s * Math.max(0, Math.cos(a)) * 0.12, el = 0.06 + Math.sin(a) * 0.12 + Math.max(0, Math.cos(a) * s * s) * 0.06; pts.push(headAt(az, el, 0.004)); }
    rim(H, 'q:mask' + s, pts, 0.0035, true);
    add(H, C('q:eye', () => new THREE.SphereGeometry(0.012, 12, 8)), M.eye, [s * 0.03, 0.106, 0.083], [0, s * 0.35, s * -0.15], [1.5, 0.4, 0.5]); }
  add(H, C('q:maskGem', () => xf(new THREE.OctahedronGeometry(0.012, 0), [0, 0, 0], [0, 0, 0], [0.7, 1.4, 0.5])), M.gem, [0, 0.142, 0.092]);
  // 머리칼: 정수리 덮개 + 옆머리 + 긴 로프 머리
  { const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.32 + 0.3 * w * w : 0.1 - 0.9 * w * w; };
    add(H, C('q:hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.007 + 0.012 * smooth(0, 0.4, v), p); }, 64, 18, { closedU: true, poles: [18], uvU: 6 })), M.hair);
    const r = rng(29), clump = (key, pts, r0, r1, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat: 0.25, ref })), M.hair);
    for (let k = 0; k < 12; k++) { const t = k / 11, az = 0.9 - t * 1.8, tip = 0.25 - 0.35 * smooth(0.5, 1, Math.abs(az)); const pts = [headAt(az * 0.3, 1.2, 0.02), headAt(az * 0.8, 0.78, 0.03), headAt(az, 0.5, 0.025), headAt(az * 1.15, tip, 0.012)]; const d = dirOf(az, 0.5); clump('qb' + k, pts, 0.03 + r() * 0.008, 0.002, [d.x, d.y, d.z]); }
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const az = s * (1.05 + k * 0.16), pts = [headAt(az * 0.9, 0.7, 0.018), headAt(az, 0.1, 0.016), headAt(az * 1.03, -0.6, 0.02), headAt(az * 1.05, -1.1, 0.02)]; const d = dirOf(az, 0); clump(`qs${s}${k}`, pts, 0.03, 0.006, [d.x, 0, d.z]); }
    if (!ghost) [-1.1, -0.75, -0.4, 0, 0.4, 0.75, 1.1, 1.35].forEach((dd, i) => {
      const az = Math.PI + (i === 7 ? 0 : dd), rope = new Rope(i === 7 ? 9 : 10, 0.075, { damp: 0.978, stiff: 0.06 }), ph = i * 1.3;
      const view = new RopeTube(rope, M.hair, { sub: 3, rad: 10, uvV: 2, flat: 0.3, side: new V3(1, 0, 0), prof: (v) => 0.05 * (1 - 0.5 * v) * (v > 0.85 ? 1 - (v - 0.85) * 5 : 1), wave: (v) => 0.012 * Math.sin(v * TAU * 1.2 + ph) * smooth(0.1, 0.5, v) });
      const local = headAt(az, i === 7 ? 0.1 : -0.4 + 0.1 * Math.abs(dd), 0.02), sideL = new V3(Math.cos(az), 0, -Math.sin(az)), rest = new V3(Math.sin(az) * 0.3, -0.8, -0.55).normalize();
      m.ropes.push({ rope, view, joint: H, local, rest, side: true, sideL, hq: new THREE.Quaternion(), head: true });
    }); }
  // 결정 왕관: 은 고리 + 가운데가 가장 높은 얼음 첨탑
  { const crown = new THREE.Group(); crown.position.set(0, 0.19, -0.01); crown.rotation.x = -0.18; crown.scale.setScalar(0.82); H.add(crown);
    add(crown, C('q:circlet', () => new THREE.TorusGeometry(0.083, 0.006, 8, 40)), M.silver, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1.12, 1]);
    const list = []; for (let i = 0; i < 9; i++) { const t = i / 8 - 0.5, a = t * 2.6, h = 0.2 * (1 - Math.abs(t) * 1.4) ** 1.2 + 0.05; list.push(xf(crystalGeo(h, 0.016 + h * 0.06, 0.15, 0.35), [Math.sin(a) * 0.08, 0, Math.cos(a) * 0.09], [-0.12 + Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.25])); }
    add(crown, C('q:crownIce', () => merge(list)), M.ice);
    add(crown, C('q:crownGem', () => xf(new THREE.OctahedronGeometry(0.018, 0), [0, 0, 0], [0, 0, 0], [0.8, 1.4, 0.6])), M.gem, [0, 0.02, 0.092]); }
  // 지팡이: 은 자루 + 나선 + 눈송이 머리 (육각 결정 6개)
  const staff = new THREE.Group(); J.weapon.add(staff); m.staff = staff; const X = [Math.PI / 2, 0, 0];
  add(staff, C('q:shaft', () => new THREE.CylinderGeometry(0.014, 0.012, QST.top - QST.butt, 12)), M.silver, [0, 0, (QST.top + QST.butt) / 2], X);
  add(staff, C('q:spiral', () => { const pts = []; for (let i = 0; i <= 140; i++) { const t = i / 140, a = t * TAU * 9; pts.push(new V3(Math.cos(a) * 0.016, Math.sin(a) * 0.016, QST.butt + 0.1 + (QST.top - QST.butt - 0.2) * t)); } return strand(pts, 0.003, 0.003, { seg: 220, rad: 5 }); }), M.iceT);
  add(staff, C('q:buttIce', () => xf(crystalGeo(0.12, 0.02), [0, 0, 0], [-Math.PI / 2, 0, 0])), M.ice, [0, 0, QST.butt + 0.02]);
  add(staff, C('q:cup', () => lathe([[0.012, -0.03], [0.026, 0.0], [0.034, 0.03], [0.02, 0.05]], 18)), M.silver, [0, 0, QST.top], X);
  const flakeHead = new THREE.Group(); flakeHead.position.set(0, 0, QST.head); staff.add(flakeHead);
  add(flakeHead, C('q:flakeCore', () => xf(crystalGeo(0.22, 0.04, 0.3, 0.35), [0, -0.06, 0], [0, 0, 0])), M.ice, [0, 0, 0], [Math.PI / 2, 0, 0]);
  { const list = []; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; list.push(xf(crystalGeo(0.15, 0.016, 0.1, 0.4), [0, 0, 0], [0, 0, a + Math.PI / 2])); for (const sd of [-1, 1]) list.push(xf(crystalGeo(0.05, 0.008, 0.1, 0.4), [Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0], [0, 0, a + Math.PI / 2 + sd * 0.9])); }
    add(flakeHead, C('q:flakeArms', () => merge(list)), M.iceT, [0, 0, 0], [0, Math.PI / 2, 0]); }
  const sGlow = add(flakeHead, C('q:sglow', () => new THREE.IcosahedronGeometry(0.035, 1)), M.gem);
  // 몸 둘레를 도는 얼음 조각
  const orb = new THREE.Group(); orb.position.y = 0.95; m.body.add(orb);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; add(orb, C('q:orb', () => crystalGeo(0.14, 0.024, 0.4, 0.4)), M.ice, [Math.cos(a) * 0.7, Math.sin(i * 2.3) * 0.15, Math.sin(a) * 0.7], [0.4, 0, 0.3]); }
  // 빙각(얼음 껍질): 기술 중에만 보인다
  const shell = new THREE.Group(); shell.visible = false; m.body.add(shell); m.shell = shell;
  { const r = rng(101), list = []; for (let i = 0; i < 26; i++) { const a = r() * TAU, e = (r() - 0.25) * 1.3, R = 0.55; list.push(xf(crystalGeo(0.7 + r() * 0.5, 0.16 + r() * 0.06, 0.2, 0.35), [Math.cos(a) * Math.cos(e) * R * 0.5, 0.6 + Math.sin(e) * 0.5, Math.sin(a) * Math.cos(e) * R * 0.5], [Math.cos(a) * 0.5 * Math.sign(e), r() * TAU, -Math.sin(a) * 0.6])); }
    add(shell, C('q:shell', () => merge(list)), iceMat({ op: 0.62, ei: 0.9, side: THREE.DoubleSide })); }
  // 망토: 어깨 뒤에서 늘어지는 서리 레이스 (천 물리)
  let cloth = null;
  m.attachScene = (scene) => { if (m._attached || ghost) return; m._attached = true; cloth = new Cloth(scene, 9, 14, 1.15, M.cape); extras.push(cloth.mesh); for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const x of extras) scene.remove(x); extras.length = 0; if (cloth) { cloth.mesh.geometry.dispose(); cloth = null; } for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { if (cloth) cloth.ok = false; for (const r of m.ropes) r.rope.ok = false; };
  let t = 0; const tmp = new V3(), tmp2 = new V3(), rq = new THREE.Quaternion(), hq = new THREE.Quaternion();
  m.lift = 0; m.glow = 0; const sole0 = 0.22; m.sole = sole0;
  m.update = (dt, f) => {
    t += dt; m.sole = sole0 + m.lift + Math.sin(t * 1.6) * 0.035; orb.rotation.y += dt * 0.9; flakeHead.rotation.z += dt * 0.8;
    const spd = f ? Math.hypot(f.vel.x, f.vel.z) : 0; gown.rotation.y = Math.sin(t * 1.2) * 0.05; gown.rotation.x = -Math.min(0.25, spd * 0.03);
    m.glow += ((f && f.state === 'act' ? 1 : 0) - m.glow) * Math.min(1, dt * 6); M.gem.emissiveIntensity = 2.4 + m.glow * 2.5 + Math.sin(t * 4) * 0.3; sGlow.scale.setScalar(1 + m.glow * 0.8);
    if (!f || ghost) return;
    J.chest.updateMatrixWorld(true); m.root.getWorldQuaternion(rq); H.getWorldQuaternion(hq);
    if (cloth) { cloth.mesh.visible = f.root.visible; const W = cloth.W;
      for (let i = 0; i < W; i++) { const a = -0.17 + 0.34 * (i / (W - 1)); const u = i / (W - 1) - 0.5; J.chest.localToWorld(cloth.anchors[i].set(u * 0.32, 0.255, -0.085 - 0.03 * (1 - Math.cos(u * 3)))); }
      const hp = J.hips.getWorldPosition(tmp2), sc = f.scale, caps = [{ a: f.hurt[0].a, b: f.hurt[0].b, r: f.hurt[0].r + 0.05 * sc }];
      for (let k = 1; k <= 3; k++) { const c = hp.clone().add(new V3(0, -0.28 * k * sc, 0)); caps.push({ a: c, b: c, r: (0.07 + 0.14 * k) * sc }); }
      cloth.len = 1.15 * sc; cloth.step(dt, caps, f.pos.y + 0.03, [-f.vel.x + Math.sin(t * 1.3) * 1.2, 0, -f.vel.z + Math.cos(t) * 1.2]); }
    for (const r of m.ropes) r.hq.copy(hq);
    const hc = H.localToWorld(tmp2.copy(Q_HEAD.HC)), h0 = f.hurt[0], caps = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.62 + 0.04 * f.scale }, { a: hc.clone(), b: hc.clone(), r: 0.1 * f.scale * 1.08 }];
    ropeStep(m, f, dt, caps, rq, tmp, new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6));
    for (const x of extras) x.visible = f.root.visible;
    if (f.root.visible && Math.random() < dt * 10) { const p = J.hips.getWorldPosition(tmp).add(new V3((Math.random() - 0.5) * 1.2, -0.9 * f.scale, (Math.random() - 0.5) * 1.2)); f.G.fx.p(p, { vel: [0, 0.3, 0], size: 0.1, size1: 0.02, life: 0.9, color: 0xe0f6ff, alpha: 0.7, drag: 1 }); }
  };
  // 무기 방향은 몸 기준 (가만히 서 있어도 지팡이가 곧게 선다)
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => { const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE); m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP); J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true); };
  m.tipPos = (out) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, QST.head)); };
  m.weaponPts = (b, tt) => { J.weapon.localToWorld(b.set(0, 0, 0.2)); J.weapon.localToWorld(tt.set(0, 0, QST.head + 0.1)); };
  return m;
}

// 궤도 성역 모델이 함께 쓰는 조형 도구
export { cv, tex, rng, T, std, phys, glowMat, iceMat, ropeStep, adder, flake, tuftGeo };
