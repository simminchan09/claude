// 스이 (SUI · 翠) — 3D 모델 (기술·포즈는 sui.js)
// 비취 검을 쓰는 떠돌이 검객.
//
// 구성: 넓은 검은 삿갓(금 테 · 정수리 금 가시 · 앞 금 뿔 장식과 녹색 보석 · 양옆으로 늘어진 천 띠 · 붉은 술) · 끝이 밝아지는 짙은 녹색 단발
//       금테 하이칼라 · 청해파 무늬 검은 상의(가슴창 · 트인 등) · 금 가시가 달린 어깨 갑주 + 붉은 술 · 흰→검정 소매 · 검은 팔토시
//       어깨에서 늘어진 큰 소매 자락(천 물리 · 안쪽 녹색 구름 무늬) · 붉은·검정 오비 + 금 장식 · 녹색 술 · 붉은 리본 · 앞 가리개 천
//       골반 트임 · 왼 허벅지 보라 띠 · 검정→흰색 니삭스 · 굽 높은 게타 + 붉은 발목 리본
//       등: 녹색 시메나와 고리 · 발목까지 내려오는 검은 땋은 줄(로프 물리) + 붉은 술 · 긴 뒷자락(천 물리)
//       무기: 비취 칼날 카타나 (금 코등이) · 왼 허리의 검은 칼집
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.87, spineL: 0.18, chestL: 0.25, neckL: 0.068, shW: 0.18, uArm: 0.27, lArm: 0.245, hipW: 0.086, thigh: 0.43, shin: 0.42, headTop: 0.25 };
// 카타나 치수 (오른손 기준 +Z)
export const KT = { pommel: -0.25, guard: 0.035, tip: 0.88 };
export const JADE = 0x3aff7a, JADE2 = 0x9affb8, DEEPJ = 0x0a8a3a, CRIM = 0xd8204a, GOLDJ = 0xffd88a;
const C = (k, fn) => cached('sui:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 청해파 (겹친 물결 반원) 무늬
function seigaiha(g, x0, y0, w, h, r, bg, line) {
  g.fillStyle = bg; g.fillRect(x0, y0, w, h); g.strokeStyle = line; g.lineWidth = Math.max(1, r * 0.08);
  for (let row = 0, y = y0 - r; y < y0 + h + r; row++, y += r * 0.5) for (let x = x0 - r + (row % 2) * r; x < x0 + w + r; x += r * 2) {
    g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.fill();
    for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x, y, r * (1 - k * 0.25) + r * 0.05, Math.PI, 0); g.stroke(); }
  }
}
function waveTex() { const [c, g] = cv(256, 256); seigaiha(g, 0, 0, 256, 256, 32, '#1f2026', 'rgba(150,152,165,0.45)'); return tex(c, [3, 2]); }
// 상의: 청해파 + 가슴창(앞) · 트인 등(뒤) 은 살빛 + 금 테두리.  loft uv: u 0 = 뒤 · 0.5 = 앞, v 0 = 아래(캔버스 아래)
function topTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H); seigaiha(g, 0, 0, W, H, 26, '#1d1e24', 'rgba(150,152,165,0.42)');
  const skin = '#f6dccf', gold = '#d8b060';
  const win = (cx, top, bot, hw) => { const p = new Path2D(); p.moveTo(cx, top); p.bezierCurveTo(cx + hw, top + (bot - top) * 0.25, cx + hw * 0.9, bot - 20, cx, bot); p.bezierCurveTo(cx - hw * 0.9, bot - 20, cx - hw, top + (bot - top) * 0.25, cx, top); return p; };
  const f = win(W * 0.5, H * 0.08, H * 0.5, 70); g.fillStyle = skin; g.fill(f); g.strokeStyle = gold; g.lineWidth = 6; g.stroke(f);
  for (const x of [0, W]) { const b = win(x, H * 0.04, H * 0.72, 120); g.fillStyle = skin; g.fill(b); g.strokeStyle = gold; g.lineWidth = 6; g.stroke(b); }
  g.fillStyle = gold; g.fillRect(0, H - 10, W, 6); return tex(c);
}
// 하의(골반): 청해파 + 옆 골반 트임 (u 0.25 · 0.75)
function lowTex() {
  const W = 1024, H = 256, [c, g] = cv(W, H); seigaiha(g, 0, 0, W, H, 22, '#1d1e24', 'rgba(150,152,165,0.4)');
  for (const u of [0.25, 0.75]) { const p = new Path2D(); p.ellipse(u * W, H * 0.42, 62, 70, 0, 0, TAU); g.fillStyle = '#f6dccf'; g.fill(p); g.strokeStyle = '#d8b060'; g.lineWidth = 6; g.stroke(p); }
  return tex(c);
}
// 세로 그라데이션 (캔버스 위 = v 1)
function gradTex(top, bottom, w = 64, h = 256) { const [c, g] = cv(w, h), gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, w, h); return tex(c); }
// 큰 소매 자락: 검정 바탕 · 금 테두리 · 아래로 갈수록 녹색 그라데이션 + 구름 무늬 (캔버스 위 = 어깨)
function panelTex(back) {
  const W = 256, H = 1024, [c, g] = cv(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1c1d22'); gr.addColorStop(back ? 1 : 0.35, '#1c1d22'); if (!back) { gr.addColorStop(0.7, '#3a9a5a'); gr.addColorStop(1, '#bfeec8'); } g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (!back) { g.strokeStyle = 'rgba(220,255,225,0.35)'; g.lineWidth = 8; for (const [x, y, r] of [[80, 720, 60], [170, 860, 70], [110, 960, 40]]) { g.beginPath(); for (let i = 0; i < 80; i++) { const a = i * 0.2, rr = r * (1 - i / 90); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.stroke(); } }
  else { g.fillStyle = '#d8b060'; for (let i = 0; i < 4; i++) { const y = 380 + i * 160; g.beginPath(); g.moveTo(W / 2, y - 26); g.lineTo(W / 2 + 10, y); g.lineTo(W / 2, y + 26); g.lineTo(W / 2 - 10, y); g.closePath(); g.fill(); } }
  g.strokeStyle = '#d8b060'; g.lineWidth = 10; g.strokeRect(8, -10, W - 16, H - 2); g.lineWidth = 3; g.strokeRect(24, -10, W - 48, H - 18);
  return tex(c);
}
// 오비: 붉은 줄 · 검정 · 녹색 끈 줄무늬 (가로 띠)
function obiTex() {
  const W = 512, H = 128, [c, g] = cv(W, H); g.fillStyle = '#16161a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c81e44'; g.fillRect(0, 10, W, 26); g.fillStyle = '#e8506a'; g.fillRect(0, 18, W, 4);
  g.fillStyle = '#3aa860'; g.fillRect(0, 44, W, 10); g.fillStyle = '#c81e44'; g.fillRect(0, 98, W, 14);
  g.fillStyle = '#d8b060'; g.fillRect(0, 2, W, 4); g.fillRect(0, H - 6, W, 4); return tex(c, [2, 1]);
}
// 꼬인 줄 (시메나와 · 땋은 줄): 비스듬한 결
function ropeTex(a, b, hi) {
  const W = 128, H = 512, [c, g] = cv(W, H); g.fillStyle = a; g.fillRect(0, 0, W, H);
  for (let y = -64; y < H + 64; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 34); gr.addColorStop(0, b); gr.addColorStop(0.5, hi); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 40); g.lineTo(W, y + 62); g.lineTo(0, y + 22); g.closePath(); g.fill(); }
  return tex(c, [1, 6]);
}
// 짙은 녹색 머리 (뿌리 어둡고 끝 밝음 — strand uv v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(41), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#16301f'); gr.addColorStop(1, '#122a1b'); } else { gr.addColorStop(0, '#5ac87a'); gr.addColorStop(0.45, '#1f5a34'); gr.addColorStop(1, '#10261a'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 360; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(0,20,8,0.5)' : 'rgba(150,230,170,0.25)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 14, H / 2, x + (r() - 0.5) * 8, 0); g.stroke(); }
  return tex(c);
}
// 삿갓 윗면: 방사 결 · 금 테 쪽 징 (lathe uv: u 둘레, v 정수리 → 테)
function hatTex() {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.fillStyle = '#1b1c21'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 32; i++) { const x = (i / 32) * W; g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, 0, 3, H); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 3, 0, 2, H); }
  g.fillStyle = '#d8b060'; for (let i = 0; i < 64; i++) { g.beginPath(); g.arc((i + 0.5) / 64 * W, H - 22, 3.5, 0, TAU); g.fill(); }
  return tex(c);
}
// 칼자루 감개: 검정 바탕 + 흰 마름모
function tsukaTex() { const [c, g] = cv(64, 256); g.fillStyle = '#121216'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#e8e6e0'; for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(32, y + 4); g.lineTo(52, y + 16); g.lineTo(32, y + 28); g.lineTo(12, y + 16); g.closePath(); g.fill(); } return tex(c); }

/* ---------- 얼굴: 실제 비율 · 무표정 · 빛나는 녹색 눈 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.071, 0.101, 0.089], jaw: 0.34 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#f8e2d8'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,248,242,0.55)'); gr.addColorStop(0.6, 'rgba(255,236,228,0)'); gr.addColorStop(1, 'rgba(190,140,135,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,130,0)'); cg.addColorStop(1, 'rgba(190,130,120,0.4)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
    // 눈 밑 녹색 문신 점 (설정화의 눈 밑 표식)
    g.fillStyle = 'rgba(40,150,80,0.75)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.033, Y.eyeY - 0.011); g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 4, y + 6); g.lineTo(x - 4, y + 6); g.closePath(); g.fill(); }
  }
  paintFace(g, M, { ...Y, tilt: 0.06, lidDrop: 0.08, glow, open, iris: glow ? ['#d8ffd0', '#5aff8a', '#18c050', '#000'] : ['#b8ff9a', '#34c060', '#0a4a20', '#052410'], pupil: '#041a0a', lash: '#0e1a12', brow: '#1a3a24' });
  const t = new THREE.CanvasTexture(c); if (!glow) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const jade = pal.jade ?? JADE;
  const M = {
    skin: phys({ color: 0xf8e0d4, emissive: 0x7a5650, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5 }),
    eyeGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0x9affb8), sheenRoughness: 0.35, emissive: 0x06140a, emissiveIntensity: 0.5 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0x7ae09a), sheenRoughness: 0.35 }),
    top: phys({ map: T('top', topTex), roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0x707080) }),
    low: phys({ map: T('low', lowTex), roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0x707080) }),
    wave: phys({ map: T('wave', waveTex), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x707080) }),
    black: phys({ color: 0x1a1b20, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    lacq: phys({ color: 0x141418, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
    gold: phys({ color: 0xe0b460, metalness: 1, roughness: 0.26, clearcoat: 0.4 }),
    goldD: phys({ color: 0xb08a40, metalness: 1, roughness: 0.34 }),
    red: phys({ color: CRIM, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xff8098) }),
    green: phys({ map: T('rope', () => ropeTex('#3a9a5a', '#2a7a44', '#7ad89a')), roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xb0ffc8) }),
    braid: phys({ map: T('braid', () => ropeTex('#18181c', '#0e0e12', '#4a4a54')), roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0x8a8a98) }),
    purple: phys({ map: T('pur', () => gradTex('#f0e0ff', '#7a4ac8')), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xe0c8ff) }),
    sleeve: phys({ map: T('slv', () => gradTex('#3a3a42', '#f2f2f0')), roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }), // 위(어깨, v 0 = 캔버스 아래) 흰 → 팔꿈치 회색
    stockT: phys({ color: 0x1c1c22, roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color(0x8a8a98) }),
    stockS: phys({ map: T('stk', () => gradTex('#f4f2ee', '#1c1c22')), roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color(0xc8c8d0) }), // 무릎 검정 → 발목 흰
    tabi: phys({ color: 0xf4f2ee, roughness: 0.6 }),
    obi: phys({ map: T('obi', obiTex), roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xff9aa8) }),
    panel: phys({ map: T('pnl', () => panelTex(false)), roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xa0ffc0) }),
    panelB: phys({ map: T('pnlB', () => panelTex(true)), roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0x707080) }),
    cloth: phys({ color: 0x3a3c44, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0x9a9aa8) }),
    hat: phys({ map: T('hat', hatTex), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    gem: phys({ color: 0x6aff9a, emissive: jade, emissiveIntensity: 1.2, roughness: 0.05, clearcoat: 1, flatShading: true }),
    tsuka: phys({ map: T('tsuka', tsukaTex), roughness: 0.6 }),
    blade: phys({ color: 0x5aff90, emissive: jade, emissiveIntensity: 0.9, roughness: 0.12, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.94 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xd8ffe0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    nail: phys({ color: 0x5ad88a, roughness: 0.2, clearcoat: 1 }),
  };
  M.gem.envMap = env; M.blade.envMap = env;
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.edge && mat !== M.eyeGlow; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const tassel = (parent, key, p, len = 0.07, mat = M.red, r = 0.012) => { // 매듭 + 금 구슬 + 술
    const g = new THREE.Group(); g.position.set(...p); parent.add(g);
    add(g, C('tbead', () => new THREE.SphereGeometry(0.009, 12, 10)), M.gold);
    add(g, C('tas' + key, () => lathe([[0.002, -0.006], [r * 0.7, -0.014], [r, -0.03], [r * 1.1, -len * 0.7], [r * 1.25, -len], [0, -len]], 14)), mat);
    return g;
  };
  m.ropes = [];

  /* ---------- 골반 · 하의(골반 트임) · 오비 · 앞 가리개 · 시메나와 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: -0.11 + 0.2 * v, rx: 0.14 - 0.024 * v, rzF: 0.084, rzB: 0.098, n: 2.2 }), 40, 8, { uvU: 1 })), M.low);
  const bX = spl([[0, 0.114], [0.45, 0.09], [1, 0.106]]), bF = spl([[0, 0.078], [0.5, 0.068], [1, 0.076]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.15 }), 40, 12)), M.wave);
  // 오비: 허리에 두른 넓은 띠 (붉은 줄 · 녹색 끈)
  const obiP = (v) => { const y = -0.07 + 0.13 * v, w = clamp((y + 0.035) / 0.24, 0, 1); return { y, rx: bX(w) + 0.012, rzF: bF(w) + 0.014, rzB: 0.09, n: 2.3 }; };
  add(J.spine, C('obi', () => loft(obiP, 64, 6, { uvU: 2 })), M.obi);
  // 앞 금 장식 (꽃 모양 + 녹색 보석) · 녹색 술 · 붉은 리본
  { const p = loftAt(obiP, 0.5, 0.5, new V3()); const g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.008); J.spine.add(g);
    const sh = new THREE.Shape(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + Math.PI / 2, r = i % 2 ? 0.02 : 0.042 + (i % 4 === 0 ? 0.01 : 0); if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
    add(g, C('obiOrn', () => new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 })), M.gold);
    add(g, C('obiGem', () => new THREE.IcosahedronGeometry(0.014, 1)), M.gem, [0, 0, 0.01]);
    for (const s of [-1, 1]) add(g, C('obiBow' + s, () => strand([[0, -0.03, 0.006], [s * 0.04, -0.02, 0.01], [s * 0.05, -0.05, 0.01], [0, -0.035, 0.006]], 0.008, 0.008, { closed: true, seg: 20, rad: 6, flat: 0.35, ref: [0, 0, 1] })), M.red);
    add(g, C('obiTail', () => strand([[0.01, -0.04, 0.008], [0.016, -0.1, 0.012], [0.01, -0.16, 0.02]], 0.014, 0.01, { seg: 12, rad: 6, flat: 0.25, ref: [0, 0, 1] })), M.red);
    const tg = tassel(g, 'G', [-0.022, -0.04, 0.01], 0.11, M.green, 0.014); tg.rotation.z = -0.1; }
  // 앞 가리개 천: 오비 아래에서 무릎 위까지 (다리 움직임을 따라 젖혀짐)
  const flapG = new THREE.Group(); flapG.position.set(0, -0.02, 0.098); J.hips.add(flapG);
  add(flapG, C('flap', () => surf((u, v, p) => { const w = 0.11 - 0.025 * v; p.set((u - 0.5) * 2 * w, -0.42 * v, 0.006 - 0.04 * ((u - 0.5) * 2 * w) ** 2 * 4 + 0.012 * v); }, 8, 12)), M.wave);
  { const pts = []; for (let i = 0; i <= 12; i++) { const v = i / 12; pts.push(new V3(-(0.11 - 0.025 * v), -0.42 * v, 0.006 + 0.012 * v - 0.004)); } rim(flapG, 'flapL', pts, 0.004, false); rim(flapG, 'flapR', pts.map((q) => new V3(-q.x, q.y, q.z)), 0.004, false); rim(flapG, 'flapB', [new V3(-0.085, -0.42, 0.018), new V3(0, -0.43, 0.02), new V3(0.085, -0.42, 0.018)], 0.004, false);
    const hem = new THREE.Shape(); hem.moveTo(0, 0.03); hem.lineTo(0.012, 0); hem.lineTo(0, -0.03); hem.lineTo(-0.012, 0); hem.closePath(); add(flapG, C('flapDia', () => new THREE.ExtrudeGeometry(hem, { depth: 0.003, bevelEnabled: false })), M.gold, [0, -0.32, 0.016]); }
  m.flapG = flapG;
  // 등 뒤 녹색 시메나와 고리 두 개 + 가운데 매듭
  { const g = new THREE.Group(); g.position.set(0, 0.01, -0.12); J.hips.add(g);
    for (const s of [-1, 1]) add(g, C('shime' + s, () => { const pts = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; pts.push(new V3(s * (0.09 + Math.cos(a) * 0.09), -0.04 + Math.sin(a) * 0.11, -0.03 - 0.02 * Math.sin(a * 0.5) ** 2)); } return strand(pts, 0.026, 0.026, { closed: true, seg: 80, rad: 12 }); }), M.green);
    add(g, C('shimeK', () => new THREE.SphereGeometry(0.032, 16, 12)), M.green, [0, 0.03, -0.03], [0, 0, 0], [1.2, 1, 0.9]);
    add(g, C('shimeO', () => new THREE.TorusGeometry(0.018, 0.004, 8, 20)), M.gold, [0, -0.01, -0.06]); }

  /* ---------- 상체: 청해파 상의 (가슴창 · 트인 등) · 하이칼라 ---------- */
  const chX = spl([[0, 0.104], [0.3, 0.116], [0.55, 0.126], [0.8, 0.12], [1, 0.094]]), chF = spl([[0, 0.076], [0.5, 0.09], [1, 0.07]]), chB = spl([[0, 0.078], [0.6, 0.084], [1, 0.068]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.03 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod, uvU: 1 })), M.top);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.122 - 0.074 * v ** 0.8, rzF: 0.074 - 0.028 * v, rzB: 0.069 - 0.026 * v }), 40, 8)), M.black);
  const colP = (v) => ({ y: 0.25 + 0.075 * v, rx: 0.05 + 0.006 * v, rzF: 0.048 + 0.008 * v, rzB: 0.05, n: 2.2 });
  add(J.chest, C('collar', () => loft(colP, 40, 4)), M.black); lRim(J.chest, 'colR1', colP, 1, 0.004, M.gold); lRim(J.chest, 'colR0', colP, 0, 0.004, M.gold);
  { const sh = new THREE.Shape(); sh.moveTo(0, 0.03); sh.lineTo(0.03, 0.0); sh.lineTo(0.012, -0.004); sh.lineTo(0, -0.03); sh.lineTo(-0.012, -0.004); sh.lineTo(-0.03, 0); sh.closePath();
    add(J.chest, C('colOrn', () => new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 })), M.gold, [0, 0.285, 0.056], [-0.2, 0, 0]);
    // 가슴 위 검은 갑판 (하이칼라에서 내려오는 V자)
    for (const s of [-1, 1]) add(J.chest, C('chPlate' + s, () => surf((u, v, p) => { const a = 0.5 + s * (0.03 + 0.12 * u * (1 - v * 0.5)); loftAt(chP, a, 0.82 + 0.16 * v, p, chMod); const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.006); }, 6, 6)), M.black); }

  /* ---------- 어깨 갑주 · 팔 (흰→검정 소매 · 검은 팔토시) · 손 (녹색 손톱) ---------- */
  const spike = C('spike', () => { const g = new THREE.ConeGeometry(0.012, 0.06, 8); g.translate(0, 0.03, 0); return g; });
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    // 갑주: 겹친 판 세 장 + 금 테 + 가시 + 붉은 술
    for (let k = 0; k < 3; k++) {
      const pp = (v) => ({ y: 0.06 - k * 0.035 - 0.07 * v, rx: 0.07 + 0.012 * k + 0.02 * v, rz: 0.066 + 0.01 * k + 0.018 * v });
      const a0 = s > 0 ? 0.02 : 0.52, a1 = a0 + 0.46;
      add(sh, C(`pld${s}${k}`, () => loft(pp, 24, 4, { a0, a1 })), M.black, [s * 0.012, 0, 0]);
      rim(sh, `pldR${s}${k}`, loftRing(pp, 1, { a0, a1, n: 24 }).map((q) => q.add(new V3(s * 0.012, 0, 0))), 0.004, false);
    }
    for (const [dy, dz, rz] of [[0.07, 0.03, 0.5], [0.04, -0.03, 0.9]]) { const o = add(sh, spike, M.gold, [s * 0.07, dy, dz]); o.rotation.set(0, 0, -s * rz); }
    tassel(sh, 'R', [s * 0.1, -0.06, 0.04], 0.07);
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.044 - 0.01 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.042 - 0.009 * v }), 24, 10)), M.sleeve);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.036 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.034 - 0.01 * v }), 24, 10)), M.skin);
    // 팔토시: 팔꿈치 아래 → 손등까지 (금 능선 · 손등 판)
    const brP = (v) => ({ y: -0.02 - (DIMS.lArm - 0.0) * v, rx: 0.041 - 0.008 * v, rz: 0.039 - 0.008 * v });
    add(el, C('bracer', () => loft(brP, 28, 8)), M.black); lRim(el, 'brR0', brP, 0, 0.0035, M.gold); lRim(el, 'brR1', brP, 1, 0.003, M.gold);
    { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(brP, s > 0 ? 0.25 : 0.75, i / 10, new V3()).multiplyScalar(1.06)); rim(el, 'brRidge' + s, pts, 0.0035, false); }
    add(el, C('brSpike', () => { const g = new THREE.ConeGeometry(0.01, 0.045, 8); g.rotateZ(Math.PI); g.translate(0, -0.02, 0); return g; }), M.gold, [s * 0.042, -0.04, 0], [0, 0, s * 0.35]);
    tassel(el, 'B', [s * 0.03, -DIMS.lArm + 0.02, -0.03], 0.05);
    const hg = new THREE.Group(); hg.scale.setScalar(0.84); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.02 + 0.003 * Math.sin(v * Math.PI), rz: 0.033 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.skin);
    add(hg, C('hback' + s, () => loft((v) => ({ y: 0.005 - 0.055 * v, rx: 0.023, rz: 0.036, n: 3, cx: s * 0.017 }), 18, 4, { a0: s > 0 ? 0.05 : 0.55, a1: s > 0 ? 0.45 : 0.95 })), M.black);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.2 + k * 0.1 : 2.6;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0076, 0.006, { seg: 14, rad: 8 })), M.skin);
      add(hg, C(`nail${s}${k}`, () => new THREE.SphereGeometry(0.0058, 8, 6)), M.nail, pts[8].toArray(), [0, 0, 0], [1, 1, 0.6]);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0092, 0.0068, { seg: 12, rad: 8 })), M.skin);
  }

  /* ---------- 다리: 검정→흰색 니삭스 · 허벅지 금 장식 · 왼 허벅지 보라 띠 · 굽 높은 게타 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.088], [0.4, 0.078], [0.85, 0.056], [1, 0.054]]), thF = spl([[0, 0.084], [0.5, 0.07], [1, 0.054]]), thB = spl([[0, 0.086], [0.35, 0.076], [1, 0.049]]);
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12)), M.skin);
    const stP = (v) => { const vv = 0.3 + 0.7 * v, q = thP(vv); return { ...q, rx: q.rx + 0.002, rzF: q.rzF + 0.002, rzB: q.rzB + 0.002 }; };
    add(hp, C('stockT', () => loft(stP, 28, 10)), M.stockT); lRim(hp, 'stTop', stP, 0, 0.004, M.gold);
    // 허벅지 바깥 금 덩굴 장식
    { const pts = []; for (let i = 0; i <= 10; i++) { const v = i / 10, q = loftAt(stP, s > 0 ? 0.3 : 0.7, 0.05 + 0.4 * v, new V3()); q.addScaledVector(new V3(q.x, 0, q.z).normalize(), 0.004 + 0.006 * Math.sin(v * Math.PI)); q.z += 0.02 * Math.sin(v * 5); pts.push(q); } rim(hp, 'thOrn' + s, pts, 0.0035, false); }
    if (s > 0) { // 보라 띠 + 늘어진 끝
      const bp = (v) => { const q = thP(0.32 + 0.06 * v); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.006, rzB: q.rzB + 0.006 }; };
      add(hp, C('sash', () => loft(bp, 32, 3)), M.purple);
      const k = loftAt(bp, 0.3, 0.5, new V3()).multiplyScalar(1.08);
      for (const [dx, len] of [[0, 0.16], [0.02, 0.12]]) add(hp, C('sashT' + len, () => strand([[k.x, k.y, k.z], [k.x + 0.02 + dx, k.y - len * 0.5, k.z + 0.01], [k.x + 0.03 + dx, k.y - len, k.z + 0.005]], 0.016, 0.013, { seg: 10, rad: 6, flat: 0.25, ref: [1, 0, 0.3] })), M.purple);
      add(hp, C('sashRing', () => new THREE.TorusGeometry(0.012, 0.003, 6, 16)), M.gold, [k.x, k.y, k.z], [0, Math.PI / 2, 0]);
    }
    const cX = spl([[0, 0.054], [0.3, 0.058], [0.75, 0.038], [1, 0.032]]), cF = spl([[0, 0.052], [0.5, 0.044], [1, 0.032]]), cB = spl([[0, 0.054], [0.3, 0.072], [0.7, 0.044], [1, 0.034]]);
    add(kn, C('shin', () => loft((v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) }), 28, 14)), M.stockS);
    add(kn, C('ankle', () => loft((v) => ({ y: -DIMS.shin + 0.03 - 0.05 * v, rx: 0.032 + 0.004 * v, rz: 0.034 + 0.006 * v }), 16, 4)), M.tabi);
    // 붉은 발목 리본
    add(kn, C('ankR', () => new THREE.TorusGeometry(0.037, 0.005, 8, 24)), M.red, [0, -DIMS.shin + 0.02, 0], [Math.PI / 2, 0, 0]);
    for (const q of [-1, 1]) add(kn, C('ankBow' + q, () => strand([[0, 0, 0], [q * 0.022, 0.012, 0.006], [q * 0.028, -0.01, 0.006], [0, 0, 0]], 0.004, 0.004, { closed: true, seg: 14, rad: 5, flat: 0.4, ref: [0, 0, 1] })), M.red, [0, -DIMS.shin + 0.02, 0.04]);
    add(kn, C('ankTail', () => strand([[0, 0, 0], [0.006, -0.03, 0.006], [0.002, -0.05, 0.004]], 0.004, 0.003, { seg: 8, rad: 5, flat: 0.4, ref: [0, 0, 1] })), M.red, [0, -DIMS.shin + 0.016, 0.042]);
    // 발 (흰 버선) · 굽 높은 게타 (앞은 낮고 뒤꿈치가 높다) · 끈
    const fw = spl([[0, 0.0], [0.06, 0.026], [0.25, 0.033], [0.6, 0.038], [0.85, 0.03], [1, 0.008]]), fh = spl([[0, 0.025], [0.08, 0.052], [0.3, 0.055], [0.6, 0.034], [0.85, 0.024], [1, 0.012]]);
    const fb = (v) => -0.06 + 0.04 * (1 - smooth(0.3, 0.72, v));
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb(v) + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.055 + 0.23 * v); };
    add(ft, C('foot', () => surf(foot, 28, 20, { closedU: true })), M.tabi);
    const PB = -0.13; // 게타 바닥
    const geta = (u, v, p) => { const [c, sn] = ang(u), w = 0.04 + 0.006 * Math.sin(v * Math.PI), top = fb(v) - 0.002, e = 0.35; const k = (Math.sign(sn) * Math.abs(sn) ** e + 1) / 2; p.set(Math.sign(c) * Math.abs(c) ** e * w, PB + (top - PB) * k, -0.07 + 0.26 * v); };
    add(ft, C('geta', () => surf(geta, 32, 16, { closedU: true })), M.lacq);
    { const pts = []; for (let i = 0; i <= 16; i++) { const v = i / 16; pts.push(new V3(0.042, fb(v) - 0.004, -0.07 + 0.26 * v)); } rim(ft, 'getaR', pts, 0.0025, false, M.goldD); rim(ft, 'getaL', pts.map((q) => new V3(-q.x, q.y, q.z)), 0.0025, false, M.goldD); }
    add(ft, C('hanao', () => strand([[-0.032, fb(0.45), 0.05], [-0.018, fb(0.6) + 0.035, 0.09], [0, fb(0.8) + 0.02, 0.135], [0.018, fb(0.6) + 0.035, 0.09], [0.032, fb(0.45), 0.05]], 0.005, 0.005, { seg: 20, rad: 6 })), M.lacq);
  }

  /* ---------- 목 · 얼굴 · 단발 · 삿갓 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.034 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.033 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.033 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.1);
  m.eyeGlow = add(H, headGeo, M.eyeGlow, [0, 0, 0], [0, 0, 0], [1.002, 1.002, 1.002]); m.eyeGlow.renderOrder = 5;
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.1, -0.006], [s * 0.08, 0.104, -0.014], [s * 0.084, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.14 + 0.38 * w * w : 0.14 - 0.9 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(7), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), M.hair);
    // 앞머리: 오른쪽(-x)으로 쓸어 넘긴 결, 오른눈 쪽이 조금 길게 덮음
    for (let k = 0; k < 17; k++) {
      const t = k / 16, az = 1.0 - t * 2.0 + (r() - 0.5) * 0.04, side = Math.abs(az), long = az < -0.15 && az > -0.6 ? 0.12 : 0, tipEl = 0.22 - 0.06 * r() - 0.3 * smooth(0.55, 1.0, side) - long, sweep = -0.18 - 0.08 * t;
      const pts = [headAt(0.35 + az * 0.3, 1.18, 0.02), headAt(az * 0.75 + sweep * 0.3, 0.8, 0.03), headAt(az * 0.95 + sweep * 0.7, 0.5, 0.03), headAt(az + sweep, (0.5 + tipEl) / 2, 0.025), headAt(az + sweep * 1.25, tipEl, 0.012)];
      const d = dirOf(az, 0.5); clump('bang' + k, pts, (k % 2 ? 0.026 : 0.036) + r() * 0.008, 0.0015, 0.22, [d.x, d.y, d.z]);
    }
    // 단발: 귀를 덮고 턱선에서 안쪽으로 말리는 보브 (옆 · 뒤)
    for (let k = 0; k < 26; k++) {
      const az = (k / 26) * TAU + Math.PI * 0.5 + 0.12, w = Math.cos(az); if (w > 0.62) continue;
      const tipEl = -0.95 + 0.25 * Math.max(0, -w) + (r() - 0.5) * 0.06;
      const pts = [headAt(az, 0.7, 0.018), headAt(az, 0.15, 0.026), headAt(az, -0.45, 0.034), headAt(az + (r() - 0.5) * 0.06, tipEl, 0.03), headAt(az, tipEl + 0.1, 0.006)];
      const d = dirOf(az, 0); clump('bob' + k, pts, 0.044, 0.006, 0.26, [d.x, 0, d.z]);
    }
  }
  // 삿갓: 얕은 원뿔 (방사 결 · 금 테 · 징) + 정수리 금 가시 + 앞 금 뿔 장식 · 녹색 보석 + 양옆 천 띠(로프) + 붉은 술
  {
    const hat = new THREE.Group(); hat.position.set(0, 0.168, -0.004); hat.rotation.set(-0.1, 0, 0); H.add(hat); m.hat = hat;
    const R0 = 0.31, Ht = 0.16;
    add(hat, C('hatTop', () => { const g = new THREE.LatheGeometry([[0, Ht], [0.03, Ht - 0.012], [R0 * 0.55, Ht * 0.42], [R0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 64); return g; }), M.hat);
    add(hat, C('hatIn', () => new THREE.LatheGeometry([[R0 * 0.98, -0.006], [R0 * 0.5, Ht * 0.36], [0.06, Ht * 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 48)), M.black);
    add(hat, C('hatRim', () => new THREE.TorusGeometry(R0, 0.008, 8, 96)), M.gold, [0, -0.002, 0], [Math.PI / 2, 0, 0]);
    add(hat, C('hatRim2', () => new THREE.TorusGeometry(R0 * 0.72, 0.004, 6, 80)), M.goldD, [0, Ht * 0.28, 0], [Math.PI / 2, 0, 0]);
    add(hat, C('hatBand', () => new THREE.CylinderGeometry(0.086, 0.09, 0.03, 32, 1, true)), M.black, [0, 0.0, 0]);
    add(hat, C('hatTip', () => lathe([[0.03, 0], [0.02, 0.02], [0.012, 0.04], [0.006, 0.08], [0, 0.11]], 16)), M.gold, [0, Ht - 0.01, 0]);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4, o = add(hat, C('hatFin', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.03, 0.01, 0.05, 0.035); sh.quadraticCurveTo(0.02, 0.02, 0, 0.02); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false }); g.translate(0, 0, -0.0015); return g; }), M.gold, [Math.sin(a) * 0.025, Ht - 0.01, Math.cos(a) * 0.025]); o.rotation.y = a - Math.PI / 2; }
    // 테 위 금 가시 장식 (네 방향)
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4, o = add(hat, spike, M.gold, [Math.sin(a) * R0, 0.004, Math.cos(a) * R0], [0, 0, 0], [0.6, 0.6, 0.6]); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(Math.sin(a), 0.25, Math.cos(a)).normalize()); }
    // 앞 장식: 뿔처럼 휜 금 장식 + 녹색 보석
    { const g = new THREE.Group(); g.position.set(0, Ht * 0.2, R0 * 0.62); g.rotation.x = -0.32; hat.add(g);
      for (const s of [-1, 1]) add(g, C('crest' + s, () => strand([[0, -0.01, 0], [s * 0.04, 0.0, 0.004], [s * 0.075, 0.03, 0.002], [s * 0.09, 0.07, -0.006]], 0.008, 0.002, { seg: 20, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.gold);
      add(g, C('crestB', () => strand([[-0.035, -0.02, 0.004], [0, -0.035, 0.008], [0.035, -0.02, 0.004]], 0.006, 0.006, { seg: 12, rad: 6 })), M.gold);
      add(g, C('crestGem', () => { const geo = new THREE.OctahedronGeometry(0.018, 0); geo.scale(0.8, 1.3, 0.6); return geo; }), M.gem, [0, 0.0, 0.01]); }
    // 양옆 붉은 술
    for (const s of [-1, 1]) tassel(hat, 'H', [s * R0 * 0.82, -0.01, R0 * 0.3], 0.08);
    // 양옆으로 늘어진 회색 천 띠 (로프 물리 · 납작한 리본)
    for (const s of [-1, 1]) {
      const rope = new Rope(6, 0.06, { damp: 0.975, stiff: 0.15 }), view = new RopeTube(rope, M.cloth, { sub: 2, rad: 8, flat: 0.12, side: new V3(0, 0, 1), prof: (v) => 0.032 * (1 - 0.1 * v) });
      m.ropes.push({ rope, view, joint: hat, local: new V3(s * R0 * 0.9, -0.004, -0.04), rest: new V3(s * 0.15, -1, 0).normalize(), sideL: new V3(0, 0, 1), caps: 'body' });
    }
  }

  /* ---------- 큰 소매 자락 (어깨 → 종아리) · 긴 뒷자락 · 검은 땋은 줄 : 천/로프 물리 ---------- */
  // 땋은 줄: 등 허리 매듭에서 발목까지 + 끝에 붉은 술
  { const rope = new Rope(14, 0.058, { damp: 0.982, stiff: 0.08 }), view = new RopeTube(rope, M.braid, { sub: 3, rad: 10, uvV: 4, prof: (v) => (v > 0.9 ? 0.024 + (v - 0.9) * 0.25 : 0.022) * (v > 0.985 ? 0.3 : 1) });
    m.ropes.push({ rope, view, joint: J.hips, local: new V3(0, -0.02, -0.17), rest: new V3(0, -1, -0.15).normalize(), caps: 'legs', braid: true }); }
  let sleeves = [], coat = null;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    sleeves = [new Cloth(scene, 5, 15, 0.92, M.panel), new Cloth(scene, 5, 15, 0.92, M.panel)];
    coat = new Cloth(scene, 7, 15, 0.86, M.panelB);
    for (const c of [...sleeves, coat]) extras.push(c.mesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
    for (const t of m.endTassels) { scene.add(t); extras.push(t); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const c of [...sleeves, coat]) if (c) c.mesh.geometry.dispose(); sleeves = []; coat = null; m._attached = false; };
  m.resetCloth = () => { for (const c of [...sleeves, coat]) if (c) c.ok = false; for (const r of m.ropes) r.rope.ok = false; };
  // 천 끝에 달리는 검은 술 뭉치 (소매 자락 2) · 붉은 술 (땋은 줄 끝)
  const pom = () => { const g = new THREE.Group(); add(g, C('pomK', () => new THREE.SphereGeometry(0.018, 12, 10)), M.gold); add(g, C('pom', () => lathe([[0.004, 0], [0.03, -0.02], [0.042, -0.07], [0.036, -0.11], [0, -0.115]], 16)), M.braid); return g; };
  m.endTassels = [pom(), pom(), (() => { const g = new THREE.Group(); add(g, C('rtas', () => lathe([[0.004, 0], [0.012, -0.012], [0.016, -0.06], [0, -0.065]], 12)), M.red); return g; })()];

  /* ---------- 무기: 비취 카타나 · 칼집 ---------- */
  const sword = new THREE.Group(); J.weapon.add(sword); m.glaive = sword; m.sword = sword;
  {
    const X = [Math.PI / 2, 0, 0];
    add(sword, C('kt:tsuka', () => { const g = loft((v) => ({ y: KT.pommel + 0.012 + (0.02 - KT.pommel - 0.012) * v, rx: 0.0135 + 0.001 * Math.sin(v * Math.PI), rz: 0.017 + 0.001 * Math.sin(v * Math.PI) }), 16, 8, { uvV: 1 }); g.rotateX(Math.PI / 2); return g; }), M.tsuka);
    add(sword, C('kt:kashira', () => lathe([[0.016, 0], [0.019, -0.008], [0.017, -0.018], [0.008, -0.026], [0, -0.028]], 20)), M.gold, [0, 0, KT.pommel + 0.012], X);
    // 코등이: 가시 돋친 꽃 모양 금판 + 칼날 쪽으로 뻗은 금 발톱
    add(sword, C('kt:tsuba', () => { const sh = new THREE.Shape(); for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, r = i % 2 ? 0.03 : 0.045 + (i % 5 === 0 ? 0.015 : 0); if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.8); } sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }); g.translate(0, 0, -0.004); return g; }), M.gold, [0, 0, KT.guard]);
    for (const s of [-1, 1]) add(sword, C('kt:claw' + s, () => strand([[0, s * 0.03, KT.guard], [0, s * 0.045, KT.guard + 0.04], [0, s * 0.03, KT.guard + 0.09], [0, s * 0.012, KT.guard + 0.12]], 0.006, 0.0015, { seg: 16, rad: 6, flat: 0.45, ref: [1, 0, 0] })), M.gold);
    add(sword, C('kt:habaki', () => new THREE.BoxGeometry(0.01, 0.034, 0.03)), M.gold, [0, 0, KT.guard + 0.02]);
    // 칼날: 휜 비취 날 (등이 -y, 날이 +y 쪽 볼록) · 끝은 뾰족한 칼끝
    add(sword, C('kt:blade', () => surf((u, v, p) => { const z = KT.guard + 0.03 + (KT.tip - KT.guard - 0.03) * v, w = 0.03 - 0.008 * v, tipK = smooth(0.88, 1, v), cy = -0.035 * v * v, t = u * TAU, ex = Math.sin(t), ey = Math.cos(t);
      const up = w * (1 - tipK * 0.95), dn = 0.006 * (1 - tipK); p.set(ex * 0.0035 * (1 - tipK * 0.7), cy + (ey > 0 ? ey * up : ey * dn) - w * 0.5 * (1 - tipK), z + tipK * 0.02 * ey); }, 12, 40, { closedU: true })), M.blade);
    add(sword, C('kt:edge', () => { const pts = []; for (let i = 0; i <= 30; i++) { const v = i / 30, w = 0.03 - 0.008 * v, tipK = smooth(0.88, 1, v); pts.push(new V3(0, -0.035 * v * v + w * (1 - tipK * 0.95) - w * 0.5 * (1 - tipK), KT.guard + 0.03 + (KT.tip - KT.guard - 0.03) * v)); } return strand(pts, 0.0018, 0.0006, { seg: 60, rad: 5 }); }), M.edge);
    // 칼집: 왼 허리, 뒤로 비스듬히
    const saya = new THREE.Group(); saya.position.set(0.15, -0.02, -0.02); saya.rotation.set(0.5, 0.15, 0.28); J.hips.add(saya); m.saya = saya;
    add(saya, C('kt:saya', () => { const pts = []; for (let i = 0; i <= 20; i++) { const v = i / 20; pts.push(new V3(0, -0.035 * v * v, -0.82 * v)); } return strand(pts, 0.019, 0.016, { seg: 40, rad: 12, flat: 0.7, ref: [1, 0, 0] }); }), M.lacq);
    add(saya, C('kt:koi', () => new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16)), M.gold, [0, 0, 0], X);
    add(saya, C('kt:kojiri', () => lathe([[0.019, 0], [0.02, -0.03], [0.012, -0.05], [0, -0.055]], 14)), M.gold, [0, -0.035, -0.82], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) add(saya, C('kt:cord', () => new THREE.TorusGeometry(0.022, 0.0035, 6, 16)), M.red, [0, -0.002, -0.1 - i * 0.018], [0, 0, i * 0.3]);
  }

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion(), lag = { L: 0, R: 0, vL: 0, vR: 0 };
  m.glow = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible;
    lag.vL += ((J.hipL.rotation.x - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    m.flapG.rotation.x = Math.min(0, Math.min(lag.L, lag.R)) * 0.75 - Math.hypot(f.vel.x, f.vel.z) * 0.012;
    J.chest.updateMatrixWorld(true);
    const sc = f.scale, wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 1.0, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 1.0];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.04 * sc })), h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.25), r: h0.r * 0.7 + 0.05 * sc };
    // 큰 소매 자락: 어깨 위 → 위팔 뒤쪽에 고정 (팔을 따라 움직임)
    sleeves.forEach((cl, i) => {
      const [sh, el, s] = i ? [J.shoulderR, J.elbowR, -1] : [J.shoulderL, J.elbowL, 1];
      for (let k = 0; k < cl.W; k++) { const u = k / (cl.W - 1); sh.localToWorld(tmp.set(s * 0.05, 0.05, -0.04)); el.localToWorld(tmp2.set(s * 0.02, 0.0, -0.05)); cl.anchors[k].lerpVectors(tmp, tmp2, u); }
      cl.len = 0.92 * sc; cl.mesh.visible = vis; cl.step(dt, [torso, ...legs], f.pos.y + 0.02, wind);
    });
    if (coat) { const W = coat.W, beltP = (v) => ({ y: 0.04, rx: 0.14, rzF: 0.11, rzB: 0.115, n: 2.3 });
      for (let i = 0; i < W; i++) { const a = 0.13 - 0.26 * (i / (W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0, coat.anchors[i]).multiplyScalar(1.12)); }
      const hp = J.hips.getWorldPosition(new V3()), s2 = hp.clone().add(new V3(0, -0.25 * sc, 0));
      coat.len = 0.86 * sc; coat.mesh.visible = vis; coat.step(dt, [torso, ...legs, { a: s2, b: s2, r: 0.2 * sc }], f.pos.y + 0.02, wind); }
    // 천 끝 술 뭉치
    sleeves.forEach((cl, i) => { const k = ((cl.H - 1) * cl.W + (i ? cl.W - 1 : 0)) * 3, t = m.endTassels[i]; t.position.set(cl.p[k], cl.p[k + 1], cl.p[k + 2]); t.visible = vis && cl.ok; });
    // 로프 (땋은 줄 · 삿갓 천 띠)
    const capsBody = [torso, { a: H.localToWorld(tmp2.copy(HC)), b: H.localToWorld(new V3().copy(HC)), r: 0.11 * sc }, ...legs];
    H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq); const windV = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); if (r.sideL) r.view.side.copy(r.sideL).applyQuaternion(hq);
      r.rope.step(dt, tmp, r.caps === 'legs' ? legs : capsBody, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.view.mesh.visible = vis;
      if (r.braid) { const p = r.rope.p, t = m.endTassels[2]; t.position.copy(p[p.length - 1]); t.visible = vis; }
    }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림 / 녹색 눈빛 (기술 중 · 검기 가득 → 더 밝게)
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    const want = Math.max(f.bladeK || 0, (f.ki || 0) >= 100 ? 0.8 : 0.3); m.glow += (want - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.9 + 0.1 * Math.sin(f.G.time * 6);
    M.eyeGlow.opacity = (0.35 + m.glow * 0.6) * pulse; M.blade.emissiveIntensity = (0.7 + m.glow * 1.6) * pulse; M.edge.opacity = 0.5 + m.glow * 0.5; M.gem.emissiveIntensity = 1 + m.glow;
    for (const o of extras) if (o !== m.endTassels[0] && o !== m.endTassels[1]) o.visible = vis;
  };
  m.setWeapon = (v) => { sword.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.135;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.1)); J.weapon.localToWorld(t.set(0, 0, KT.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, -0.01, 0.3)); J.weapon.localToWorld(t.set(0, -0.03, KT.tip)); };
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, -0.03, KT.tip)); };
  m.extras = extras;
  return m;
}
