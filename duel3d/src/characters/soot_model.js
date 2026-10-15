// 수트 스파이럴 (SOOT SPIRAL) — 3D 모델 (기술·포즈는 soot.js)
// 저주받은 바람과 모래의 들끓는 원소가 응결해 태어난, 신전 영묘의 타고난 수호자. 사람이 아닌 고대 골렘.
//
// 구성: 얼굴 없는 둥근 투구 (청록 십자 시질 · 정수리 볏 · 청록 보석) · 높은 목가리개
//       어두운 몸체 위에 겹친 크림·모래금 고대 금속판 (가슴판 · 등판 · 마디진 복부 고리 · 허리띠 + 둥근 청록 메달)
//       거대한 둥근 견갑 (청록 보석 마개) · 마디진 팔 · 금 팔꿈치 구체 · 넓어지는 건틀릿 · 발톱 달린 큰 손
//       허리 옆 판갑 · 무거운 판금 다리 (허벅지판 · 청록 보석 무릎 · 넓은 정강이 · 판금 발)
//       앞뒤로 늘어진 남색 천 (천 물리) · 발치에서 흩날리는 모래 꼬리 (로프 물리 · 위로 뜨는 바람)
//       무기: 양손 곁에 떠 있는 두 개의 큰 원반 방패 (크림금 · 새긴 문자 · 십자 살 · 청록 중심 보석)
//             오른 원반 = weapon 채널, 왼 원반 = handL 채널 (둘 다 몸 기준 [피치(위+), 바깥(+), 롤], 앞면 법선이 그 방향)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, heightToNormal, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const SCALE = 1.25;
export const DIMS = { hipH: 1.0, spineL: 0.2, chestL: 0.34, neckL: 0.05, shW: 0.3, uArm: 0.3, lArm: 0.3, hipW: 0.13, thigh: 0.44, shin: 0.44, headTop: 0.26 };
// 원반 치수 (원반 좌표: 중심 = 원점, +Z = 앞면 법선) · DOFF = 손에서 원반 중심까지 (법선 방향)
export const DISC = { R: 0.4, DOFF: 0.21 };
export const TEAL = 0x3ae8d8, TEAL2 = 0xa8fff4, SAND = 0xd9b878, SAND2 = 0xf0dca8, NAVY = 0x1c2744, GOLDS = 0xe6d29a;
const C = (k, fn) => cached('soot:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 각진 고대 문자 하나 (ㄷ · ㄹ · ㄱ 같은 꺾인 획) — 같은 붓질로 색/높이 캔버스에 그린다
function glyph(g, x, y, s, seed) {
  const r = rng(seed * 7919 + 13), k = s / 2; g.beginPath();
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const pts = []; let px = x + (r() - 0.5) * k, py = y + (r() - 0.5) * k; pts.push([px, py]);
    for (let j = 0; j < 2 + Math.floor(r() * 2); j++) { if (j % 2 === 0) px = clamp(px + (r() < 0.5 ? -1 : 1) * k * (0.5 + r() * 0.6), x - k, x + k); else py = clamp(py + (r() < 0.5 ? -1 : 1) * k * (0.5 + r() * 0.6), y - k, y + k); pts.push([px, py]); }
    g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  }
  g.stroke();
}
// 판갑: 크림 → 모래금 · 가장자리 이중 음각선 · 드문드문 문자 · 닳은 얼룩.  (color, height) 두 캔버스
function plateCanvas(glyphs) {
  const W = 512, H = 512, [c, g] = cv(W, H), [hc, h] = cv(W, H), r = rng(glyphs ? 5 : 9);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f2e6c0'); gr.addColorStop(0.55, '#dcc690'); gr.addColorStop(1, '#b89a5e'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  h.fillStyle = '#808080'; h.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, rr = 10 + r() * 40, rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, `rgba(120,90,50,${0.06 + r() * 0.08})`); rg.addColorStop(1, 'rgba(120,90,50,0)'); g.fillStyle = rg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  const both = (fn) => { g.strokeStyle = 'rgba(110,82,40,0.75)'; h.strokeStyle = '#303030'; fn(g); fn(h); };
  both((q) => { q.lineWidth = 5; q.beginPath(); q.moveTo(0, 18); q.lineTo(W, 18); q.moveTo(0, H - 18); q.lineTo(W, H - 18); q.stroke(); q.lineWidth = 2; q.beginPath(); q.moveTo(0, 32); q.lineTo(W, 32); q.moveTo(0, H - 32); q.lineTo(W, H - 32); q.stroke(); });
  if (glyphs) both((q) => { q.lineWidth = 6; q.lineCap = 'square'; for (let i = 0; i < 6; i++) glyph(q, 50 + i * 82, H * 0.5 + (i % 2 ? 60 : -60), 44, i + 1); });
  // 밝은 모서리 (닳아서 반짝이는 테)
  g.fillStyle = 'rgba(255,248,220,0.5)'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 8, W, 8); h.fillStyle = '#c0c0c0'; h.fillRect(0, 0, W, 8); h.fillRect(0, H - 8, W, 8);
  return [c, hc];
}
// 원반 앞면 (평면 uv: 중심 0.5,0.5 · 반지름 0.5 = 원반 테): 테 띠 · 십자 살 · 네 칸의 문자 · 중심 고리
function discCanvas(mode) { // mode: 'c' 색 · 'h' 높이 · 'g' 빛 (청록 문자)
  const W = 1024, [c, g] = cv(W, W), O = W / 2, R = W / 2;
  if (mode === 'c') { const gr = g.createRadialGradient(O * 0.8, O * 0.7, 20, O, O, R); gr.addColorStop(0, '#f6ecca'); gr.addColorStop(0.7, '#dfc890'); gr.addColorStop(1, '#a88a50'); g.fillStyle = gr; }
  else g.fillStyle = mode === 'h' ? '#808080' : '#000';
  g.fillRect(0, 0, W, W);
  const ink = mode === 'c' ? 'rgba(96,70,34,0.85)' : mode === 'h' ? '#2a2a2a' : 'rgba(0,0,0,0)';
  const lite = mode === 'c' ? '#f8eecc' : mode === 'h' ? '#d0d0d0' : '#000';
  // 바깥 띠 (눈금)
  g.strokeStyle = ink; g.lineWidth = 10; g.beginPath(); g.arc(O, O, R * 0.86, 0, TAU); g.stroke(); g.lineWidth = 5; g.beginPath(); g.arc(O, O, R * 0.8, 0, TAU); g.stroke();
  for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; g.lineWidth = 4; g.beginPath(); g.moveTo(O + Math.cos(a) * R * 0.86, O + Math.sin(a) * R * 0.86); g.lineTo(O + Math.cos(a) * R * 0.93, O + Math.sin(a) * R * 0.93); g.stroke(); }
  // 십자 살 (도드라진 넓은 띠)
  if (mode !== 'g') for (let i = 0; i < 4; i++) { g.save(); g.translate(O, O); g.rotate(i * Math.PI / 2); g.fillStyle = lite; g.fillRect(-R * 0.07, R * 0.17, R * 0.14, R * 0.64); g.strokeStyle = ink; g.lineWidth = 5; g.strokeRect(-R * 0.07, R * 0.17, R * 0.14, R * 0.64); g.restore(); }
  // 네 칸의 문자
  g.lineCap = 'square';
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, x = O + Math.cos(a) * R * 0.5, y = O + Math.sin(a) * R * 0.5;
    g.strokeStyle = mode === 'g' ? '#3ae8d8' : ink; g.lineWidth = mode === 'g' ? 9 : 14; glyph(g, x - R * 0.09, y - R * 0.05, R * 0.17, i * 3 + 2); glyph(g, x + R * 0.09, y + R * 0.07, R * 0.15, i * 3 + 3); }
  // 중심 고리
  g.strokeStyle = mode === 'g' ? '#3ae8d8' : ink; g.lineWidth = mode === 'g' ? 8 : 12; g.beginPath(); g.arc(O, O, R * 0.17, 0, TAU); g.stroke();
  if (mode === 'g') { const rg = g.createRadialGradient(O, O, 0, O, O, R * 0.14); rg.addColorStop(0, '#d8fffa'); rg.addColorStop(0.6, '#3ae8d8'); rg.addColorStop(1, 'rgba(58,232,216,0)'); g.fillStyle = rg; g.fillRect(O - R * 0.15, O - R * 0.15, R * 0.3, R * 0.3); }
  return c;
}
// 남색 천: 금빛 테 · 가운데 모래빛 문자 줄 (캔버스 위 = 허리띠 쪽)
function clothTex(back) {
  const W = 256, H = 1024, [c, g] = cv(W, H), r = rng(back ? 3 : 4);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a2440'); gr.addColorStop(1, '#253256'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.04)`; g.fillRect(r() * W, 0, 1 + r() * 2, H); }
  g.strokeStyle = '#c8ad74'; g.lineWidth = 8; g.strokeRect(10, -10, W - 20, H); g.lineWidth = 3; g.strokeRect(26, -10, W - 52, H - 18);
  g.strokeStyle = 'rgba(214,190,130,0.8)'; g.lineWidth = 7; g.lineCap = 'square';
  for (let i = 0; i < (back ? 3 : 4); i++) glyph(g, W / 2, 200 + i * 190, 64, i + (back ? 20 : 10));
  // 닳은 아랫단
  g.fillStyle = 'rgba(200,170,110,0.35)'; g.fillRect(0, H - 60, W, 60);
  return tex(c);
}
// 모래 꼬리: 끝으로 갈수록 투명 (RopeTube uv v: 뿌리 0 → 끝 1)
function sandTex() {
  const W = 64, H = 256, [c, g] = cv(W, H), r = rng(77), gr = g.createLinearGradient(0, H, 0, 0);
  gr.addColorStop(0, 'rgba(240,220,170,0.9)'); gr.addColorStop(0.6, 'rgba(217,184,120,0.55)'); gr.addColorStop(1, 'rgba(217,184,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,240,200,${r() * 0.5})`; g.fillRect(r() * W, r() * H, 2, 2); }
  return tex(c, [1, 1]);
}
// 바닥 문양 (궁극기 · 모래 소용돌이에서 씀): 청록 문자 원
export function sealTex() {
  const W = 1024, [c, g] = cv(W, W), O = W / 2;
  g.strokeStyle = '#3ae8d8'; g.lineCap = 'square';
  for (const [r, w] of [[0.96, 10], [0.9, 4], [0.62, 8], [0.56, 3], [0.24, 6]]) { g.lineWidth = w; g.beginPath(); g.arc(O, O, O * r, 0, TAU); g.stroke(); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.save(); g.translate(O + Math.cos(a) * O * 0.76, O + Math.sin(a) * O * 0.76); g.rotate(a + Math.PI / 2); g.lineWidth = 7; glyph(g, 0, 0, 52, i + 40); g.restore(); }
  for (let i = 0; i < 4; i++) { g.save(); g.translate(O, O); g.rotate(i * Math.PI / 2 + Math.PI / 4); g.lineWidth = 8; g.beginPath(); g.moveTo(0, O * 0.24); g.lineTo(0, O * 0.56); g.stroke(); g.beginPath(); g.moveTo(-O * 0.1, O * 0.4); g.lineTo(O * 0.1, O * 0.4); g.stroke(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
// 원반 (원반 좌표): 볼록한 앞면 · 금테 · 어두운 뒷면 · 중심 돌기 + 청록 보석 · 테 옆 청록 보석 두 개
function discParts() {
  const R = DISC.R;
  const planarUV = (g) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * R) + 0.5, p.getY(i) / (2 * R) + 0.5); uv.needsUpdate = true; return g; };
  return {
    face: C('dFace', () => planarUV(surf((u, v, p) => { const a = u * TAU, r = R * 0.9 * v; p.set(Math.cos(a) * r, Math.sin(a) * r, 0.05 * (1 - v * v) + 0.018); }, 64, 14, { closedU: true, poles: [0] }))),
    rim: C('dRim', () => new THREE.TorusGeometry(R * 0.93, R * 0.075, 10, 72)),
    back: C('dBack', () => surf((u, v, p) => { const a = u * TAU, r = R * 0.95 * (1 - v); p.set(Math.cos(a) * r, Math.sin(a) * r, -0.012 - 0.03 * v * v); }, 48, 6, { closedU: true, poles: [6] })),
    boss: C('dBoss', () => { const g = lathe([[0, 0.12], [0.035, 0.115], [0.06, 0.095], [0.075, 0.06], [0.08, 0.02]], 32); g.rotateX(Math.PI / 2); return g; }),
    gem: C('dGem', () => { const g = new THREE.SphereGeometry(0.042, 20, 14); g.scale(1, 1, 0.55); return g; }),
    rimGem: C('dRimGem', () => { const g = new THREE.SphereGeometry(0.034, 14, 10); g.scale(0.7, 1.3, 0.7); return g; }),
    grip: C('dGrip', () => new THREE.TorusGeometry(0.07, 0.016, 8, 24)),
  };
}

export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const teal = pal.teal ?? TEAL;
  const plate = T('plate', () => plateCanvas(false)), plateG = T('plateG', () => plateCanvas(true));
  const pMap = T('pMap', () => tex(plate[0])), pNrm = T('pNrm', () => heightToNormal(plate[1], 3)), gMap = T('gMap', () => tex(plateG[0])), gNrm = T('gNrm', () => heightToNormal(plateG[1], 3));
  const M = {
    gold: phys({ map: pMap, normalMap: pNrm, normalScale: new THREE.Vector2(0.8, 0.8), color: pal.gold ?? 0xfff4dc, metalness: 0.75, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.9 }),
    goldG: phys({ map: gMap, normalMap: gNrm, normalScale: new THREE.Vector2(0.9, 0.9), color: pal.gold ?? 0xfff4dc, metalness: 0.75, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.9 }),
    goldS: phys({ color: pal.goldS ?? GOLDS, metalness: 0.8, roughness: 0.32, clearcoat: 0.4, envMapIntensity: 1 }),
    goldD: phys({ color: pal.goldD ?? 0xa8894e, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.8 }),
    body: phys({ color: pal.body ?? 0x1e2230, roughness: 0.62, metalness: 0.3, envMapIntensity: 0.4 }),
    joint: phys({ color: 0x2c3040, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.6 }),
    cloth: phys({ map: T('clF', () => clothTex(false)), color: pal.cloth ?? 0xffffff, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color(0x6a7ab0) }),
    clothB: phys({ map: T('clB', () => clothTex(true)), color: pal.cloth ?? 0xffffff, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color(0x6a7ab0) }),
    sand: new THREE.MeshBasicMaterial({ map: T('sand', sandTex), color: pal.sand ?? 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    gem: phys({ color: 0x0e8a84, emissive: teal, emissiveIntensity: 0.8, roughness: 0.08, clearcoat: 1, metalness: 0.1 }),
    visor: new THREE.MeshBasicMaterial({ color: teal, transparent: true, opacity: 0.95 }),
    glowA: new THREE.MeshBasicMaterial({ color: teal, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    dFace: phys({ map: T('dC', () => tex(discCanvas('c'))), normalMap: T('dH', () => heightToNormal(discCanvas('h'), 3.5)), emissiveMap: T('dG', () => new THREE.CanvasTexture(discCanvas('g'))), emissive: teal, emissiveIntensity: 0.5, color: pal.gold ?? 0xfff4dc, metalness: 0.7, roughness: 0.36, clearcoat: 0.4, envMapIntensity: 0.9 }),
  };
  M.gem.envMap = env;
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.glowA && mat !== M.sand; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.goldS) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat = M.goldS, o = {}) => rim(parent, key, loftRing(prof, v, { n: 48, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const gemAt = (parent, key, p, r = 0.03, sc = [1, 1, 0.6], rot = [0, 0, 0]) => { add(parent, C('gemRing' + r, () => new THREE.TorusGeometry(r * 1.15, r * 0.25, 8, 20)), M.goldD, p, rot); return add(parent, C('gemS' + r, () => new THREE.SphereGeometry(r, 16, 12)), M.gem, p, rot, sc); };
  m.ropes = [];

  /* ---------- 골반 · 허리띠 + 둥근 청록 메달 · 옆 판갑 ---------- */
  const pelP = (v) => ({ y: -0.13 + 0.24 * v, rx: 0.2 - 0.02 * v, rzF: 0.15, rzB: 0.16, n: 2.4 });
  add(J.hips, C('pelvis', () => loft(pelP, 32, 6)), M.body);
  const beltP = (v) => ({ y: -0.02 + 0.1 * v, rx: 0.215, rzF: 0.168, rzB: 0.175, n: 2.5 });
  add(J.hips, C('belt', () => loft(beltP, 48, 3, { uvU: 3 })), M.gold); lRim(J.hips, 'beltR0', beltP, 0, 0.012); lRim(J.hips, 'beltR1', beltP, 1, 0.012);
  // 배꼽 메달: 금 원판 + 문자 고리 + 청록 보석
  { const g = new THREE.Group(); g.position.set(0, 0.03, 0.172); J.hips.add(g);
    add(g, C('medal', () => { const gg = lathe([[0, 0.03], [0.05, 0.028], [0.085, 0.018], [0.1, 0]], 32); gg.rotateX(Math.PI / 2); return gg; }), M.goldS);
    add(g, C('medalR', () => new THREE.TorusGeometry(0.095, 0.01, 8, 40)), M.goldD);
    gemAt(g, 'medalG', [0, 0, 0.03], 0.032); }
  // 옆 판갑 (허리띠 아래로 두 겹, 다리를 따라 젖혀짐)
  const tassets = [];
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.17, -0.02, 0); J.hips.add(g); tassets.push(g);
    for (let k = 0; k < 2; k++) { const pp = (v) => ({ y: -0.02 - k * 0.1 - 0.16 * v, rx: 0.1 + 0.015 * v + 0.01 * k, rz: 0.13 + 0.02 * v + 0.01 * k });
      const a0 = s > 0 ? 0.08 : 0.58, a1 = a0 + 0.34; add(g, C(`tas${s}${k}`, () => loft(pp, 16, 4, { a0, a1 })), M.gold, [s * 0.02, 0, 0]);
      rim(g, `tasR${s}${k}`, loftRing(pp, 1, { a0, a1, n: 16 }).map((q) => q.add(new V3(s * 0.02, 0, 0))), 0.008, false); } }

  /* ---------- 복부: 마디진 금속 고리 세 겹 (어두운 몸체 위) ---------- */
  add(J.spine, C('abCore', () => loft((v) => ({ y: -0.04 + 0.26 * v, rx: 0.17 + 0.03 * v, rzF: 0.13 + 0.01 * v, rzB: 0.14, n: 2.3 }), 32, 6)), M.body);
  for (let k = 0; k < 3; k++) {
    const P = (v) => ({ y: 0.0 + k * 0.068 + 0.05 * v, rx: 0.19 + 0.012 * k + 0.008 * Math.sin(v * Math.PI), rzF: 0.15 + 0.008 * k + 0.008 * Math.sin(v * Math.PI), rzB: 0.155 + 0.006 * k, n: 2.4 });
    add(J.spine, C('ab' + k, () => loft(P, 40, 4, { uvU: 3 })), M.gold); lRim(J.spine, 'abR' + k, P, 1, 0.007, M.goldD);
  }

  /* ---------- 가슴판 · 등판 · 목가리개 ---------- */
  const chX = spl([[0, 0.21], [0.4, 0.27], [0.75, 0.3], [1, 0.25]]), chF = spl([[0, 0.16], [0.5, 0.2], [0.85, 0.19], [1, 0.15]]), chB = spl([[0, 0.16], [0.6, 0.19], [1, 0.16]]);
  const chP = (v) => ({ y: -0.05 + 0.4 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.3 });
  add(J.chest, C('chCore', () => loft(chP, 40, 10)), M.body);
  // 가슴판: 앞면 · 두 개의 둥근 흉갑 융기 + 가운데 세로 능선
  const brMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.045 * gauss(ax - 0.12, 0.09) * gauss(p.y - 0.2, 0.12) * sn + 0.012 * gauss(p.x, 0.012) * smooth(0.1, 0.5, v) * sn; } };
  const brP = (v) => { const q = chP(0.06 + 0.94 * v); return { ...q, rx: q.rx + 0.018, rzF: q.rzF + 0.022, rzB: q.rzB + 0.02 }; };
  add(J.chest, C('breast', () => loft(brP, 48, 18, { a0: 0.16, a1: 0.84, mod: brMod })), M.goldG);
  rim(J.chest, 'brRim0', loftRing(brP, 0, { a0: 0.16, a1: 0.84, n: 40, mod: brMod }), 0.011, false);
  rim(J.chest, 'brRimL', Array.from({ length: 12 }, (_, i) => loftAt(brP, 0.16, i / 11, new V3(), brMod)), 0.011, false);
  rim(J.chest, 'brRimR', Array.from({ length: 12 }, (_, i) => loftAt(brP, 0.84, i / 11, new V3(), brMod)), 0.011, false);
  // 가슴 아래 금 띠 (갈비 판)
  for (let k = 0; k < 2; k++) { const P = (v) => { const q = chP(0.02 + k * 0.1 + 0.06 * v); return { ...q, rx: q.rx + 0.03, rzF: q.rzF + 0.034, rzB: q.rzB + 0.03 }; }; add(J.chest, C('rib' + k, () => loft(P, 40, 3, { a0: 0.2, a1: 0.8 })), M.gold); }
  // 등판
  const bkP = (v) => { const q = chP(0.08 + 0.9 * v); return { ...q, rx: q.rx + 0.016, rzF: q.rzF + 0.02, rzB: q.rzB + 0.026 }; };
  add(J.chest, C('backP', () => loft(bkP, 36, 12, { a0: 0.82, a1: 1.18, mod: (p, u, v, c, sn) => { if (sn < 0) p.z -= 0.02 * gauss(p.x, 0.05); } })), M.gold);
  rim(J.chest, 'bkRim', loftRing(bkP, 0, { a0: 0.82, a1: 1.18, n: 30 }), 0.01, false);
  // 높은 목가리개 (투구가 어깨 사이에 묻힌 느낌)
  const gorP = (v) => ({ y: 0.31 + 0.11 * v, rx: 0.17 - 0.02 * v, rzF: 0.15 - 0.025 * v, rzB: 0.15 - 0.01 * v, n: 2.2 });
  add(J.chest, C('gorget', () => loft(gorP, 40, 4)), M.gold); lRim(J.chest, 'gorR', gorP, 1, 0.012);
  add(J.chest, C('gorIn', () => loft((v) => ({ y: 0.3 + 0.1 * v, rx: 0.13, rz: 0.11 }), 24, 2)), M.body);
  // 가슴 가운데 청록 보석
  gemAt(J.chest, 'chGem', [0, 0.27, 0.205], 0.026, [1, 1.3, 0.6], [-0.2, 0, 0]);

  /* ---------- 거대한 둥근 견갑 (청록 보석 마개) · 마디진 팔 · 건틀릿 · 발톱 손 ---------- */
  const pauls = [];
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    // 견갑: 몸통에 붙어 팔 회전을 일부만 따라간다 (머리를 파고들지 않게)
    const pg = new THREE.Group(); pg.position.set(s * DIMS.shW, DIMS.chestL - 0.06, 0); J.chest.add(pg); pauls.push(pg);
    const dome = (r, y0, h) => lathe(Array.from({ length: 13 }, (_, i) => { const t = i / 12, a = t * Math.PI / 2; return [Math.max(0.001, Math.sin(a) * r), y0 + Math.cos(a) * h]; }).reverse(), 40);
    { const d1 = add(pg, C('paul', () => dome(0.21, -0.02, 0.17)), M.goldG, [s * 0.05, 0.03, 0], [0, 0, -s * 0.32]);
      add(d1, C('paulRim', () => new THREE.TorusGeometry(0.207, 0.016, 8, 48)), M.goldS, [0, -0.02, 0], [Math.PI / 2, 0, 0]);
      const d2 = add(pg, C('paul2', () => dome(0.235, -0.07, 0.12)), M.gold, [s * 0.075, -0.05, 0], [0, 0, -s * 0.5]);
      add(d2, C('paul2Rim', () => new THREE.TorusGeometry(0.232, 0.013, 8, 48)), M.goldD, [0, -0.07, 0], [Math.PI / 2, 0, 0]); }
    // 보석 마개: 금 받침 + 청록 원기둥 + 금 뚜껑 (견갑 위 바깥쪽에 솟음)
    { const cap = new THREE.Group(); cap.position.set(s * 0.14, 0.17, 0.02); cap.rotation.set(0, 0, -s * 0.42); pg.add(cap);
      add(cap, C('capB', () => lathe([[0.06, 0], [0.062, 0.02], [0.05, 0.03]], 24)), M.goldS);
      add(cap, C('capG', () => new THREE.CylinderGeometry(0.044, 0.046, 0.07, 20)), M.gem, [0, 0.065, 0]);
      add(cap, C('capT', () => lathe([[0.05, 0], [0.052, 0.012], [0.03, 0.025], [0, 0.028]], 24)), M.goldS, [0, 0.1, 0]); }
    // 위팔: 어두운 마디 + 금 고리 두 개
    add(sh, C('uarm', () => loft((v) => ({ y: 0.0 - (DIMS.uArm + 0.02) * v, rx: 0.078 - 0.01 * v, rz: 0.075 - 0.01 * v }), 20, 6)), M.body);
    for (const [y, r] of [[-0.11, 0.088], [-0.2, 0.084]]) add(sh, C('uaBand' + r, () => loft((v) => ({ y: y - 0.05 * v, rx: r + 0.006 * Math.sin(v * Math.PI), rz: r - 0.004 + 0.006 * Math.sin(v * Math.PI) }), 24, 3, { uvU: 2 })), M.gold);
    // 팔꿈치 구체
    add(el, C('elbow', () => new THREE.SphereGeometry(0.085, 24, 16)), M.goldS);
    add(el, C('elbowB', () => new THREE.TorusGeometry(0.086, 0.012, 8, 28)), M.goldD, [0, 0, 0], [0, 0, Math.PI / 2]);
    // 건틀릿: 팔꿈치 아래 → 손목으로 넓어진다 + 바깥 능선 지느러미 + 금테
    const gaP = (v) => ({ y: -0.04 - 0.25 * v, rx: 0.085 + 0.03 * v * v, rzF: 0.082 + 0.024 * v * v, rzB: 0.085 + 0.03 * v * v, n: 2.2 });
    add(el, C('fcore', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.065, rz: 0.06 }), 16, 3)), M.body);
    add(el, C('gaunt', () => loft(gaP, 32, 8)), M.gold); lRim(el, 'gaR0', gaP, 0, 0.011); lRim(el, 'gaR1', gaP, 1, 0.013);
    add(el, C('fin' + s, () => surf((u, v, p) => { const y = -0.07 - 0.2 * u, w = 0.025 + 0.035 * Math.sin(u * Math.PI) * (1 - Math.abs(v - 0.5) * 2); const q = loftAt(gaP, s > 0 ? 0.25 : 0.75, (-0.04 - y) / 0.25, new V3()); p.set(q.x + s * w, y, (v - 0.5) * 0.02); }, 10, 4)), M.goldS);
    gemAt(el, 'gaGem' + s, [s * 0.0, -0.14, 0.098], 0.018, [1, 1.4, 0.6]);
    // 손: 두꺼운 손바닥 + 세 개의 발톱 손가락 + 엄지 (손가락 마디 = 어두운 구체)
    const hg = new THREE.Group(); hg.position.y = -0.01; ha.add(hg);
    add(hg, C('palm', () => loft((v) => ({ y: 0.0 - 0.11 * v, rx: 0.055 + 0.006 * Math.sin(v * Math.PI), rzF: 0.085, rzB: 0.08, n: 2.6 }), 20, 5)), M.goldS);
    add(hg, C('palmIn', () => loft((v) => ({ y: 0.0 - 0.105 * v, rx: 0.05, rz: 0.075, n: 2.6 }), 16, 3)), M.body, [s * -0.006, 0, 0]);
    for (let k = 0; k < 3; k++) {
      const z = 0.05 - k * 0.05, pts = [], curl = 1.5 + k * 0.08;
      for (let i = 0; i <= 8; i++) { const th = (i / 8) * curl; pts.push(new V3(-s * (1 - Math.cos(th)) * 0.075 + s * 0.01, -0.1 - Math.sin(th) * 0.075, z * (1 + i * 0.03))); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.025, 0.006, { seg: 16, rad: 8 })), M.goldS);
      add(hg, C('knk', () => new THREE.SphereGeometry(0.026, 12, 10)), M.joint, pts[0].toArray());
      add(hg, C('knk2', () => new THREE.SphereGeometry(0.02, 10, 8)), M.joint, pts[4].toArray());
    }
    { const pts = [[-s * 0.02, -0.03, 0.075], [-s * 0.045, -0.07, 0.095], [-s * 0.065, -0.11, 0.085], [-s * 0.075, -0.135, 0.06]].map((a) => new V3(...a)); add(hg, C('thumb' + s, () => strand(pts, 0.026, 0.008, { seg: 12, rad: 8 })), M.goldS); add(hg, C('knk', () => new THREE.SphereGeometry(0.026, 12, 10)), M.joint, pts[0].toArray()); }
  }

  /* ---------- 다리: 허벅지판 · 청록 보석 무릎 · 넓은 정강이 갑주 · 판금 발 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03;
    add(hp, C('thCore', () => loft((v) => ({ y: 0.04 - L * v, rx: 0.1 - 0.015 * v, rz: 0.1 - 0.012 * v }), 20, 6)), M.body);
    const thP = (v) => ({ y: -0.02 - (L - 0.08) * v, rx: 0.118 - 0.012 * v, rzF: 0.12 - 0.01 * v + 0.012 * Math.sin(v * Math.PI), rzB: 0.115 - 0.012 * v });
    add(hp, C('thPlate', () => loft(thP, 32, 8, { a0: 0.12, a1: 0.88 })), M.gold);
    rim(hp, 'thRim', loftRing(thP, 1, { a0: 0.12, a1: 0.88, n: 30 }), 0.009, false); rim(hp, 'thRim0', loftRing(thP, 0, { a0: 0.12, a1: 0.88, n: 30 }), 0.009, false);
    // 무릎: 앞으로 볼록한 금 덮개 + 청록 보석
    add(kn, C('knee', () => { const g = new THREE.SphereGeometry(0.1, 24, 16, 0, TAU, 0, Math.PI * 0.62); g.rotateX(Math.PI / 2); return g; }), M.goldS, [0, 0.0, 0.03], [0, 0, 0], [1, 1.15, 0.85]);
    add(kn, C('kneeJ', () => new THREE.SphereGeometry(0.085, 16, 12)), M.joint);
    gemAt(kn, 'knGem', [0, 0.0, 0.112], 0.022);
    // 정강이: 아래로 넓어지는 무거운 갑주 + 앞 능선
    const shP = (v) => ({ y: -0.07 - (DIMS.shin - 0.1) * v, rx: 0.09 + 0.028 * v * v, rzF: 0.1 + 0.022 * v * v, rzB: 0.098 + 0.02 * v, n: 2.2 });
    add(kn, C('shCore', () => loft((v) => ({ y: 0.0 - DIMS.shin * v, rx: 0.075, rz: 0.075 }), 16, 3)), M.body);
    add(kn, C('greave', () => loft(shP, 36, 10, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z += 0.016 * gauss(p.x, 0.02) * sn; } })), M.goldG);
    lRim(kn, 'grR0', shP, 0, 0.011); lRim(kn, 'grR1', shP, 1, 0.013);
    // 발: 넓고 둥근 판금 발 (발등판 두 겹) — 바닥 = FOOT_B
    const fw = spl([[0, 0.05], [0.2, 0.085], [0.6, 0.095], [0.9, 0.08], [1, 0.03]]), fh = spl([[0, 0.12], [0.3, 0.13], [0.6, 0.09], [0.85, 0.065], [1, 0.03]]);
    const FB = -0.1, foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.55; p.set(Math.sign(c) * Math.abs(c) ** e * w, FB + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.11 + 0.33 * v); };
    add(ft, C('foot', () => surf(foot, 28, 16, { closedU: true })), M.goldS);
    add(ft, C('toeP', () => surf((u, v, p) => { const a = (u - 0.5) * Math.PI * 0.9, vv = 0.55 + 0.42 * v, w = fw(vv) + 0.008, h = fh(vv); p.set(Math.sin(a) * w, FB + h * (0.55 + 0.45 * Math.cos(a)) + 0.012, -0.11 + 0.33 * vv); }, 14, 6)), M.gold);
    add(ft, C('ankle', () => loft((v) => ({ y: 0.04 - 0.1 * v, rx: 0.085, rz: 0.09 }), 20, 3)), M.joint);
    add(ft, C('sole', () => surf((u, v, p) => { const [c, sn] = ang(u); p.set(c * fw(v) * 1.02 * (1 - 0.0), FB + 0.004, -0.11 + 0.33 * v); p.x = Math.sign(c) * Math.abs(c) ** 0.55 * fw(v) * 1.02; }, 20, 8)), M.goldD);
  }

  /* ---------- 투구: 얼굴 없는 둥근 투구 · 청록 십자 시질 · 정수리 볏 · 청록 보석 ---------- */
  const H = J.head; H.scale.setScalar(1.0);
  const HY = 0.12, HRX = 0.15, HRY = 0.17, HRZ = 0.16;
  const helmPt = (az, el, off, p) => { const ce = Math.cos(el), front = Math.max(0, Math.cos(az)) * ce, flatK = 1 - 0.1 * front * front; return p.set(Math.sin(az) * ce * (HRX + off), HY + Math.sin(el) * (HRY + off) * (el < 0 ? 0.8 : 1), Math.cos(az) * ce * (HRZ + off) * flatK); };
  const helmGeo = C('helm', () => surf((u, v, p) => helmPt((u - 0.5) * TAU, -0.75 + v * (Math.PI / 2 + 0.75), 0, p), 56, 28, { closedU: true, poles: [28] }));
  m.headMesh = add(H, helmGeo, M.goldG);
  // 앞 얼굴판: 조금 어둡고 도드라진 판 (십자 시질이 새겨짐)
  add(H, C('facePl', () => surf((u, v, p) => { const az = (u - 0.5) * 1.5, el = -0.72 + v * 1.2; helmPt(az, el, 0.012 * Math.cos(az * 1.6) * Math.sin((v) * Math.PI) + 0.006, p); }, 24, 16)), M.goldS);
  // 십자 시질 (청록 빛): 세로 줄 + 눈높이 가로 줄 + 가운데 마름모
  { const vPts = [], hPts = []; for (let i = 0; i <= 14; i++) { vPts.push(helmPt(0, -0.62 + i / 14 * 1.15, 0.022, new V3())); hPts.push(helmPt(-0.62 + i / 14 * 1.24, 0.06, 0.02, new V3())); }
    m.visor = [add(H, C('visV', () => strand(vPts, 0.011, 0.011, { seg: 28, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.visor), add(H, C('visH', () => strand(hPts, 0.012, 0.012, { seg: 28, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.visor)];
    const c = helmPt(0, 0.06, 0.026, new V3()); add(H, C('visC', () => { const g = new THREE.OctahedronGeometry(0.026, 0); g.scale(1, 1.2, 0.4); return g; }), M.visor, c.toArray());
    // 시질 테두리 금선 (도드라진 홈 가장자리)
    for (const sd of [-1, 1]) { rim(H, 'visVR' + sd, vPts.map((q) => q.clone().add(new V3(sd * 0.022, 0, -0.004))), 0.004, false, M.goldD); rim(H, 'visHR' + sd, hPts.map((q) => q.clone().add(new V3(0, sd * 0.024, -0.004))), 0.004, false, M.goldD); } }
  // 정수리 볏: 앞이마에서 뒤통수까지 세로 지느러미 + 이마의 청록 보석
  for (const sd of [-1, 1]) add(H, C('crestS' + sd, () => surf((u, v, p) => { const el = 0.45 + u * 2.4, q = helmPt(el < Math.PI / 2 ? 0 : Math.PI, el < Math.PI / 2 ? el : Math.PI - el, 0, new V3()), hgt = 0.05 * Math.sin(u * Math.PI) ** 0.6 + 0.008; const n = q.clone().sub(new V3(0, HY, 0)).normalize(); p.copy(q).addScaledVector(n, hgt * v); p.x = sd * 0.012 * (1 - v * 0.6); }, 30, 4)), M.goldS);
  { const q = helmPt(0, 0.62, 0.035, new V3()); gemAt(H, 'crGem', q.toArray(), 0.03, [1, 1.35, 0.65], [-0.5, 0, 0]); }
  // 옆 귀 원판
  for (const sd of [-1, 1]) { add(H, C('ear', () => { const g = lathe([[0, 0.03], [0.045, 0.026], [0.06, 0.012], [0.062, 0]], 24); g.rotateZ(-Math.PI / 2); return g; }), M.goldS, [sd * (HRX - 0.004), HY - 0.01, -0.01], [0, 0, sd > 0 ? 0 : Math.PI]); }
  // 뒤 목덜미 판
  add(H, C('nape', () => surf((u, v, p) => { const az = Math.PI + (u - 0.5) * 2.2, el = -0.95 + v * 0.55; helmPt(az, el, 0.012 + 0.02 * (1 - v), p); }, 16, 5)), M.gold);

  /* ---------- 앞뒤 남색 천 (천 물리) · 발치의 모래 꼬리 (로프 물리) ---------- */
  for (const s of [-1, 1]) {
    const rope = new Rope(8, 0.11, { damp: 0.96, stiff: 0.05 }), view = new RopeTube(rope, M.sand, { sub: 2, rad: 6, flat: 0.25, prof: (v) => 0.05 * (1 - 0.5 * v), uvV: 1 });
    m.ropes.push({ rope, view, joint: s > 0 ? J.kneeL : J.kneeR, local: new V3(s * 0.02, -DIMS.shin + 0.06, -0.1), rest: new V3(s * 0.2, -0.3, -1).normalize() });
  }
  let front = null, back = null;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    front = new Cloth(scene, 6, 11, 1.0, M.cloth); back = new Cloth(scene, 7, 12, 1.1, M.clothB);
    for (const c of [front, back]) extras.push(c.mesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const c of [front, back]) if (c) c.mesh.geometry.dispose(); for (const r of m.ropes) r.view.mesh.geometry.dispose(); front = back = null; m._attached = false; };
  m.resetCloth = () => { for (const c of [front, back]) if (c) c.ok = false; for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 무기: 두 원반 방패 ---------- */
  const DP = discParts();
  const makeDisc = () => {
    const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    add(spin, DP.face, M.dFace); add(spin, DP.rim, M.goldS); add(spin, DP.back, M.gold); add(spin, DP.boss, M.goldS); add(spin, DP.gem, M.gem, [0, 0, 0.115]);
    for (const a of [0, Math.PI]) add(spin, DP.rimGem, M.gem, [Math.cos(a) * DISC.R * 0.93, Math.sin(a) * DISC.R * 0.93, 0.0], [0, 0, a]);
    add(spin, DP.grip, M.goldD, [0, 0, -0.04]);
    const gl = add(g, C('dGlow', () => new THREE.RingGeometry(0.03, 0.12, 24)), M.glowA, [0, 0, -0.06]); // 손과 원반을 잇는 빛
    g.userData.spin = spin; g.userData.glow = gl; return g;
  };
  const holdR = J.weapon, holdL = new THREE.Group(); holdL.position.set(0, -0.06, 0); J.handL.add(holdL);
  const discR = makeDisc(), discL = makeDisc(); discR.position.z = DISC.DOFF; discL.position.z = DISC.DOFF; holdR.add(discR); holdL.add(discL);
  m.discR = discR; m.discL = discL; m.makeDisc = makeDisc;

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), rq = new THREE.Quaternion(), lag = { L: 0, R: 0, vL: 0, vR: 0 };
  m.glow = 0; m.wallK = 0; m.sandFx = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale, G = f.G;
    // 옆 판갑 · 견갑: 다리 · 팔 회전을 일부만 따른다
    lag.vL += ((J.hipL.rotation.x - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    tassets[1].rotation.x = Math.min(0, lag.L) * 0.6; tassets[0].rotation.x = Math.min(0, lag.R) * 0.6;
    tassets[1].rotation.z = Math.max(0, J.hipL.rotation.z) * 0.6; tassets[0].rotation.z = Math.min(0, J.hipR.rotation.z) * 0.6;
    for (const [pg, sh, s] of [[pauls[0], J.shoulderL, 1], [pauls[1], J.shoulderR, -1]]) { const r = sh.rotation; pg.rotation.set(clamp(r.x * 0.35, -0.6, 0.4), r.y * 0.3, s > 0 ? clamp(r.z * 0.4, 0, 0.5) : clamp(r.z * 0.4, -0.5, 0)); }
    J.chest.updateMatrixWorld(true);
    const wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(G.time * 1.3) * 0.8, 0, wv(f.vel.z) + Math.cos(G.time * 1.1) * 0.8];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * sc })), h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.75 };
    // 앞 · 뒤 천: 허리띠 아래에 고정
    const hang = (cl, a0, a1, len) => { const W = cl.W; for (let i = 0; i < W; i++) { const a = a0 + (a1 - a0) * (i / (W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0.15, cl.anchors[i]).multiplyScalar(1.06)); }
      cl.len = len * sc; cl.mesh.visible = vis; cl.step(dt, [torso, ...legs], f.pos.y + 0.02, wind); };
    if (front) hang(front, 0.36, 0.64, 0.86);
    if (back) hang(back, 1.12, 0.88, 0.95);
    // 모래 꼬리: 위로 뜨는 바람 (중력을 거의 상쇄) + 움직임 반대 방향
    m.root.getWorldQuaternion(rq); const windV = new V3(-f.vel.x * 0.8 + Math.sin(G.time * 2.1) * 2, 8.8 + Math.sin(G.time * 3) * 1.2, -f.vel.z * 0.8 + Math.cos(G.time * 1.7) * 2);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); r.rope.seg = 0.11 * sc;
      r.rope.step(dt, tmp, [], f.pos.y + 0.03, r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.view.mesh.visible = vis;
    }
    // 발치에 흩날리는 모래 알갱이
    if (vis && G.fx) { m.sandFx += dt * (f.state === 'run' ? 26 : 10); while (m.sandFx >= 1) { m.sandFx -= 1; const ft = Math.random() < 0.5 ? J.footL : J.footR; ft.getWorldPosition(tmp2); G.fx.p(tmp2.add(new V3((Math.random() - 0.5) * 0.4, 0.02, (Math.random() - 0.5) * 0.4)), { vel: [(Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8], size: 0.05 + Math.random() * 0.05, size1: 0.01, life: 0.7, color: Math.random() < 0.5 ? SAND : SAND2, alpha: 0.7, drag: 1.5, grav: -0.3 }); } }
    // 시질 · 원반 빛: 기술 중 · 모래 가득 → 밝게 / 기합 때 번쩍
    const shout = f.state === 'act' && f.act && f.act.shout;
    const want = Math.max(f.glowK || 0, (f.sand || 0) >= 100 ? 0.75 : 0.25, shout ? 1 : 0); m.glow += (want - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.88 + 0.12 * Math.sin(G.time * 5);
    M.visor.opacity = 0.75 + 0.25 * m.glow; M.glowA.opacity = (0.18 + 0.5 * m.glow) * pulse; M.gem.emissiveIntensity = (0.55 + m.glow * 1.2) * pulse; M.dFace.emissiveIntensity = (0.25 + m.glow * 1.6) * pulse;
    // 원반: 천천히 돌며 둥실 뜬다
    for (const [d, ph] of [[discR, 0], [discL, 1.7]]) { d.userData.spin.rotation.z += dt * (0.6 + m.glow * 2.5); d.userData.base = Math.sin(G.time * 2.2 + ph) * 0.018; }
    // 방벽 상태: 원반이 앞으로 나가 나란히 선다 (공격 중에는 손으로 돌아옴)
    const wallOn = (f.wallT || 0) > 0 && f.state !== 'ko' && !(f.state === 'act' && f.actName !== 's1');
    m.wallK += ((wallOn ? 1 : 0) - m.wallK) * Math.min(1, dt * 10);
    for (const o of extras) o.visible = vis;
  };
  m.setWeapon = (v) => { discR.visible = v; m.weaponOut = !v; };
  m.setDiscL = (v) => { discL.visible = v; };
  m.weaponOut = false;
  m.sole = 0.1 * SCALE;
  // 원반 방향: weapon · handL 채널을 몸 기준 방향으로 (guardian 방식) + 방벽 위치로 섞기
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), dp = new V3(), dq = new THREE.Quaternion(), ds = new V3(), ONE = new V3(1, 1, 1), QI = new THREE.Quaternion();
  const placeWall = (disc, holder, side) => {
    const bob = disc.userData.base || 0;
    if (m.wallK < 0.002) { disc.position.set(0, bob, DISC.DOFF); disc.quaternion.identity(); disc.scale.setScalar(1); return; }
    holder.updateMatrixWorld(true);
    mB.compose(tmp.set(side * 0.43, 1.05 + bob, 0.95), QI, tmp2.set(1.45, 1.45, 1.45));
    mA.copy(holder.matrixWorld).invert().multiply(m.root.matrixWorld).multiply(mB); mA.decompose(dp, dq, ds);
    const k = m.wallK; disc.position.set(0, bob, DISC.DOFF).lerp(dp, k); disc.quaternion.copy(QI).slerp(dq, k); disc.scale.copy(ONE).lerp(ds, k);
  };
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
    const s = J.handL.rotation; wE.set(-s.x, s.y, s.z, 'YXZ'); wQ.setFromEuler(wE);
    J.handL.rotation.set(0, 0, 0); J.handL.updateMatrixWorld(true);
    m.root.getWorldQuaternion(wR); J.handL.getWorldQuaternion(wP);
    holdL.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); holdL.updateMatrixWorld(true);
    placeWall(discR, holdR, -1); placeWall(discL, holdL, 1);
    discR.updateMatrixWorld(true); discL.updateMatrixWorld(true);
  };
  // 원반 위의 점 (원반 좌표 → 월드)
  m.discPt = (out, side, x, y, z = 0) => { const d = side < 0 ? discR : discL; d.updateMatrixWorld(true); return d.localToWorld(out.set(x, y, z)); };
  m.weaponPts = (b, t) => { m.discPt(b, -1, 0, -DISC.R * 0.9); m.discPt(t, -1, 0, DISC.R * 0.9); };
  m.trailPts = (b, t) => { m.discPt(b, -1, 0, DISC.R * 0.5); m.discPt(t, -1, 0, DISC.R); };
  m.tipPos = (out = new V3()) => m.discPt(out, -1, 0, 0, 0.1);
  m.extras = extras;
  return m;
}
