// 라이아스 (RAIAS · GUARDIAN) — 3D 모델 (기술·포즈는 guardian.js)
// 부서지지 않는 방패를 든 젊은 수호기사.
//
// 구성: 갈색 단정한 단발(옆가르마 앞머리) · 보랏빛 눈 · 금 귀걸이
//       흰 군복 롱코트 (하이칼라 · 금 목받이 · 푸른 금 단추 · 금 견장 사슬 · 회청색 판넬) · 흰 바지
//       왼 어깨: 금 불꽃 장식의 큰 흰 견갑 (주황 · 푸른 보석) · 오른 어깨: 겹친 흰 견갑
//       남색 허리띠 + 금 십자 버클 · 옆 허리 판갑 · 앞 휘장 · 코트 앞자락 (안감 스테인드글라스)
//       강철 건틀릿 · 금 불꽃 무릎 갑주 · 흰 정강이 갑주 · 판금 장화
//       등: 어깨에서 발목까지 내려오는 두 갈래 코트 자락 (천 물리 · 아랫단·안감 스테인드글라스)
//       무기: 왼손의 거대한 연 모양 방패 — 스테인드글라스 면 · 금/청동 불꽃 세공 테 · 긴 아래 가시
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.96, spineL: 0.2, chestL: 0.28, neckL: 0.075, shW: 0.205, uArm: 0.29, lArm: 0.265, hipW: 0.095, thigh: 0.46, shin: 0.45, headTop: 0.25 };
export const HOLY = 0x8a7aff, HOLY2 = 0x5ab0ff, PALE = 0xdde8ff, GOLDG = 0xffd88a, EMBERG = 0xff7a3a;
// 방패 치수 (방패 좌표: 손잡이 = 원점, +Y = 방패 위, +Z = 앞면 법선)
export const SH = { yb: -0.56, yt: 0.6, spike: -0.92, crest: 0.74, cz: 0.085, bulge: 0.05, back: 0.022 };
const C = (k, fn) => cached('guardian:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const GLASS = ['#1a3c9e', '#2a62d8', '#3f86f0', '#8cc4ff', '#d8ecff', '#f2f8ff', '#5a6ad8', '#2448b8', '#a8d4ff', '#6a8ae8'];
// 스테인드글라스: 보로노이 조각 (파랑 · 하늘 · 흰 유리) + 굵은 납선. glow = 발광 맵(납선은 검정)
function glassCanvas(W, H, n, seed, glow, opt = {}) {
  const [c, g] = cv(W, H), r = rng(seed), S = [];
  for (let i = 0; i < n; i++) S.push([r() * W, r() * H, GLASS[Math.floor(r() * GLASS.length)], 0.75 + r() * 0.5]);
  // 가장자리를 이어 붙일 수 있게 (가로 반복) 복제 점
  if (opt.wrap) for (const s of S.slice()) { S.push([s[0] - W, s[1], s[2], s[3]], [s[0] + W, s[1], s[2], s[3]]); }
  const img = g.createImageData(W, H), d = img.data, lead = opt.lead ?? 3.2, cols = S.map((s) => { const v = parseInt(s[2].slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let b0 = 1e9, b1 = 1e9, i0 = 0, i1 = 0;
    for (let i = 0; i < S.length; i++) { const dx = x - S[i][0], dy = y - S[i][1], q = dx * dx + dy * dy; if (q < b0) { b1 = b0; i1 = i0; b0 = q; i0 = i; } else if (q < b1) { b1 = q; i1 = i; } }
    const p0x = S[i0][0], p0y = S[i0][1], p1x = S[i1][0], p1y = S[i1][1], ex = p1x - p0x, ey = p1y - p0y, el = Math.hypot(ex, ey) || 1;
    const edge = ((x - (p0x + p1x) / 2) * ex + (y - (p0y + p1y) / 2) * ey) / el; // 경계까지 거리 (음수)
    const k = (y * W + x) * 4, inn = Math.min(1, Math.sqrt(b0) / (el * 0.6 + 1));
    if (-edge < lead) { const a = glow ? 0 : 1; d[k] = 22 * a; d[k + 1] = 24 * a; d[k + 2] = 38 * a; d[k + 3] = 255; continue; }
    const cl = cols[i0], sh = (glow ? 0.85 : S[i0][3]) * (1.08 - 0.32 * inn); // 조각 중심이 밝고 납선 쪽이 어둡다
    d[k] = clamp(cl[0] * sh, 0, 255); d[k + 1] = clamp(cl[1] * sh, 0, 255); d[k + 2] = clamp(cl[2] * sh, 0, 255); d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (!glow) { // 유리 결 반사
    g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, gr = g.createRadialGradient(x, y, 0, x, y, 30 + r() * 40); gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - 80, y - 80, 160, 160); }
    g.globalCompositeOperation = 'source-over';
  }
  return [c, g];
}
function glassTex(glow, seed = 11, rep = [1, 1]) { const [c] = glassCanvas(512, 1024, 70, seed, glow); return tex(c, rep, !glow); }
// 코트 등자락 (천): 위 = 어깨. 흰 → 연한 회청 그라데이션 · 금 테 · 아랫단 스테인드글라스 띠 · 푸른 다이아 장식
function capeTex(lining) {
  const W = 256, H = 1024;
  if (lining) { const [c] = glassCanvas(W, H, 42, 77, false, { lead: 2.6 }); return tex(c); }
  const [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#f4f5f8'); gr.addColorStop(0.45, '#e2e6ee'); gr.addColorStop(0.58, '#b8c2d4'); gr.addColorStop(1, '#a6b0c4'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [gc] = glassCanvas(W, 400, 22, 31, false, { lead: 2.6 }); g.drawImage(gc, 0, H - 400);
  g.fillStyle = '#d8b060'; g.fillRect(0, H - 408, W, 9); g.fillStyle = '#f0d890'; g.fillRect(0, H - 405, W, 2);
  for (const x of [0, W - 12]) { g.fillStyle = '#d8b060'; g.fillRect(x, 0, 12, H); g.fillStyle = '#f0d890'; g.fillRect(x + 4, 0, 2, H); }
  g.fillStyle = '#d8b060'; g.fillRect(0, H - 10, W, 10);
  for (const y of [330, 450]) { g.fillStyle = '#d8b060'; g.beginPath(); g.moveTo(W / 2, y - 34); g.lineTo(W / 2 + 15, y); g.lineTo(W / 2, y + 34); g.lineTo(W / 2 - 15, y); g.closePath(); g.fill(); g.fillStyle = '#3a6ae8'; g.beginPath(); g.moveTo(W / 2, y - 22); g.lineTo(W / 2 + 8, y); g.lineTo(W / 2, y + 22); g.lineTo(W / 2 - 8, y); g.closePath(); g.fill(); }
  return tex(c);
}
// 코트 상의: u 0 = 뒤 · 0.5 = 앞. 흰 바탕 · 옆 회청 판넬 · 앞 여밈 금선 · 아래 금 테 (캔버스 아래 = v 0 = 허리)
function coatTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H); g.fillStyle = '#f3f4f7'; g.fillRect(0, 0, W, H);
  for (const u of [0.25, 0.75]) { const gr = g.createLinearGradient((u - 0.09) * W, 0, (u + 0.09) * W, 0); gr.addColorStop(0, 'rgba(176,190,212,0)'); gr.addColorStop(0.3, 'rgba(176,190,212,0.9)'); gr.addColorStop(0.7, 'rgba(176,190,212,0.9)'); gr.addColorStop(1, 'rgba(176,190,212,0)'); g.fillStyle = gr; g.fillRect((u - 0.09) * W, 0, 0.18 * W, H); }
  g.strokeStyle = 'rgba(150,160,185,0.6)'; g.lineWidth = 3; for (const u of [0.16, 0.34, 0.66, 0.84]) { g.beginPath(); g.moveTo(u * W, 0); g.lineTo(u * W, H); g.stroke(); }
  g.fillStyle = '#d8b060'; g.fillRect(W * 0.5 - 5, 0, 10, H); g.fillStyle = '#f0d890'; g.fillRect(W * 0.5 - 1, 0, 2, H);
  g.fillStyle = '#d8b060'; g.fillRect(0, H - 14, W, 8); return tex(c);
}
// 코트 앞자락 (치마꼴): 캔버스 위 = 아랫단 (v 1). 흰 · 회청 판넬 · 앞 가장자리와 아랫단 금 테 · 푸른 다이아
function skirtTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, '#f2f3f7'); gr.addColorStop(1, '#dfe4ee'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (const u of [0.22, 0.5, 0.78]) { g.fillStyle = 'rgba(170,184,208,0.75)'; g.fillRect(u * W - 40, 0, 80, H); g.fillStyle = '#d8b060'; g.fillRect(u * W - 42, 0, 4, H); g.fillRect(u * W + 38, 0, 4, H); }
  g.fillStyle = '#d8b060'; g.fillRect(0, 0, W, 22); g.fillStyle = '#f0d890'; g.fillRect(0, 8, W, 3);
  for (const x of [0, W - 22]) { g.fillStyle = '#d8b060'; g.fillRect(x, 0, 22, H); g.fillStyle = '#f0d890'; g.fillRect(x + 9, 0, 3, H); }
  for (const u of [0.22, 0.78]) { const x = u * W, y = 110; g.fillStyle = '#d8b060'; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 18, y); g.lineTo(x, y + 40); g.lineTo(x - 18, y); g.closePath(); g.fill(); g.fillStyle = '#3a6ae8'; g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 9, y); g.lineTo(x, y + 26); g.lineTo(x - 9, y); g.closePath(); g.fill(); }
  return tex(c);
}
// 갈색 머리 (뿌리 어둡고 끝 밝음 — strand uv v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(23), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#5a4636'); gr.addColorStop(1, '#4a3a2c'); } else { gr.addColorStop(0, '#8a735c'); gr.addColorStop(0.5, '#64503e'); gr.addColorStop(1, '#45372a'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(30,20,12,0.45)' : 'rgba(210,190,165,0.22)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 14, H / 2, x + (r() - 0.5) * 8, 0); g.stroke(); }
  return tex(c);
}
// 허리띠: 남색 가죽 + 금 실선
function beltTex() { const W = 512, H = 64, [c, g] = cv(W, H); g.fillStyle = '#1e2442'; g.fillRect(0, 0, W, H); g.fillStyle = '#d8b060'; g.fillRect(0, 4, W, 3); g.fillRect(0, H - 7, W, 3); g.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < W; x += 6) g.fillRect(x, 10, 2, H - 20); return tex(c, [2, 1]); }
// 금 목받이 (가로 금 줄무늬)
function gorgetTex() { const W = 64, H = 128, [c, g] = cv(W, H); for (let y = 0; y < H; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#f8dc8a'); gr.addColorStop(0.5, '#d89a40'); gr.addColorStop(1, '#8a5a20'); g.fillStyle = gr; g.fillRect(0, y, W, 16); } return tex(c, [6, 1]); }
// 금 사슬 결
function chainTex() { const W = 64, H = 256, [c, g] = cv(W, H); g.fillStyle = '#b08030'; g.fillRect(0, 0, W, H); for (let y = -32; y < H + 32; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#8a6020'); gr.addColorStop(0.5, '#ffe9a8'); gr.addColorStop(1, '#8a6020'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 18); g.lineTo(W, y + 28); g.lineTo(0, y + 10); g.closePath(); g.fill(); } return tex(c, [1, 8]); }

/* ---------- 얼굴: 실제 남성 비율 · 무표정 · 보랏빛 눈 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.104, 0.006), R: [0.073, 0.103, 0.091], jaw: 0.3, chin: 0.01, nose: 1.1 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#f6dccf'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,248,242,0.5)'); gr.addColorStop(0.6, 'rgba(255,236,228,0)'); gr.addColorStop(1, 'rgba(180,135,130,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,130,0)'); cg.addColorStop(1, 'rgba(185,130,120,0.42)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  }
  paintFace(g, M, { ...Y, male: true, tilt: 0.04, lidDrop: 0.1, glow, open, iris: glow ? ['#f0e0ff', '#b08aff', '#6a4ae0', '#000'] : ['#d8c0ff', '#9070e0', '#46288a', '#1c0e3a'], pupil: '#120a24', lash: '#1e1612', brow: '#3e2e22' });
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
  const holy = pal.holy ?? HOLY;
  const M = {
    skin: phys({ color: 0xf6dcd0, emissive: 0x7a5650, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5 }),
    eyeGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xd8c0a0), sheenRoughness: 0.35, emissive: 0x140e08, emissiveIntensity: 0.5 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xc0a888), sheenRoughness: 0.35 }),
    coat: phys({ map: T('coat', coatTex), roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xc8d0e8) }),
    white: phys({ color: 0xf2f3f7, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xc8d0e8) }),
    grey: phys({ color: 0xb4bfd2, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xe0e8ff) }),
    pants: phys({ color: 0xeeeff4, roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0xc8d0e8) }),
    skirt: phys({ map: T('skirt', skirtTex), roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xc8d0e8), side: THREE.BackSide }),
    skirtIn: phys({ map: T('glassL', () => glassTex(false, 53, [2, 1])), roughness: 0.3, emissive: 0x1a2a6a, emissiveIntensity: 0.4, side: THREE.FrontSide }),
    plate: phys({ color: 0xf6f6fa, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, metalness: 0.05 }),
    plateG: phys({ color: 0xc8d0de, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, metalness: 0.3 }),
    steel: phys({ color: 0xb8bfcc, metalness: 0.9, roughness: 0.28, clearcoat: 0.5 }),
    steelD: phys({ color: 0x6a7080, metalness: 0.9, roughness: 0.35 }),
    gold: phys({ color: 0xe6b862, metalness: 1, roughness: 0.24, clearcoat: 0.4 }),
    goldD: phys({ color: 0xb0843e, metalness: 1, roughness: 0.32 }),
    bronze: phys({ color: 0xd0904a, metalness: 1, roughness: 0.3, clearcoat: 0.3 }),
    ember: phys({ color: 0xe8603a, emissive: 0x6a1a08, emissiveIntensity: 0.6, roughness: 0.35, clearcoat: 0.8 }),
    belt: phys({ map: T('belt', beltTex), roughness: 0.5, clearcoat: 0.4 }),
    navy: phys({ color: 0x1e2442, roughness: 0.5, clearcoat: 0.3 }),
    gorget: phys({ map: T('gorget', gorgetTex), metalness: 0.9, roughness: 0.28 }),
    chain: phys({ map: T('chain', chainTex), metalness: 1, roughness: 0.3 }),
    gem: phys({ color: 0x6a9aff, emissive: holy, emissiveIntensity: 1.0, roughness: 0.05, clearcoat: 1, flatShading: true }),
    btn: phys({ color: 0x3a5ae0, emissive: 0x1a2a8a, emissiveIntensity: 0.5, roughness: 0.15, clearcoat: 1 }),
    cape: phys({ map: T('cape', () => capeTex(false)), roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xc8d0e8), side: THREE.FrontSide }),
    capeIn: phys({ map: T('capeL', () => capeTex(true)), roughness: 0.3, emissive: 0x1a2a6a, emissiveIntensity: 0.35, side: THREE.BackSide }),
    glass: phys({ map: T('glass', () => glassTex(false)), emissiveMap: T('glassG', () => glassTex(true)), emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.1 }),
    shieldBack: phys({ color: 0xdfe4ee, roughness: 0.3, clearcoat: 0.8, metalness: 0.2 }),
    halo: new THREE.MeshBasicMaterial({ color: holy, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };
  M.gem.envMap = env; M.glass.envMap = env; M.glass.envMapIntensity = 0.8;
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.eyeGlow && mat !== M.halo; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  // 불꽃 모양 금판 (아래 → 위로 일렁이며 끝이 뾰족). w: 폭, h: 높이, curl: 끝이 휘는 쪽
  const flameGeo = (key, w, h, curl = 0.3, depth = 0.008) => C('flame' + key, () => {
    const sh = new THREE.Shape(); sh.moveTo(-w * 0.5, 0);
    sh.bezierCurveTo(-w * 0.75, h * 0.3, -w * 0.1, h * 0.45, -w * 0.32, h * 0.7); sh.bezierCurveTo(-w * 0.1, h * 0.65, curl * w * 0.6, h * 0.85, curl * w, h);
    sh.bezierCurveTo(w * 0.15 + curl * w * 0.2, h * 0.75, w * 0.6, h * 0.55, w * 0.25, h * 0.38); sh.bezierCurveTo(w * 0.55, h * 0.35, w * 0.6, h * 0.12, w * 0.5, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.3, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -depth / 2); return g; });
  const diamond = (key, w, h, d = 0.004) => C('dia' + key, () => { const s = new THREE.Shape(); s.moveTo(0, h); s.lineTo(w, 0); s.lineTo(0, -h); s.lineTo(-w, 0); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: d * 0.4, bevelSize: d * 0.3, bevelSegments: 1 }); });

  /* ---------- 골반 · 흰 바지 · 남색 허리띠 + 금 십자 버클 · 옆 판갑 · 앞 휘장 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: -0.12 + 0.22 * v, rx: 0.148 - 0.02 * v, rzF: 0.092, rzB: 0.104, n: 2.2 }), 40, 8)), M.pants);
  const bX = spl([[0, 0.13], [0.45, 0.118], [1, 0.135]]), bF = spl([[0, 0.088], [0.5, 0.08], [1, 0.09]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.04 + 0.25 * v, rx: bX(v), rzF: bF(v), rzB: 0.088, n: 2.15 }), 40, 12, { uvU: 1 })), M.coat);
  const beltP = (v) => ({ y: 0.025 + 0.055 * v, rx: 0.152, rzF: 0.104, rzB: 0.112, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 64, 3)), M.belt); lRim(J.hips, 'beltR0', beltP, 0, 0.0035, M.gold); lRim(J.hips, 'beltR1', beltP, 1, 0.0035, M.gold);
  { const p = loftAt(beltP, 0.5, 0.5, new V3()), g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.006); J.hips.add(g);
    add(g, C('buckle', () => { const s = new THREE.Shape(), a = 0.012, b = 0.034; s.moveTo(-a, b); s.lineTo(a, b); s.lineTo(a, a); s.lineTo(b, a); s.lineTo(b, -a); s.lineTo(a, -a); s.lineTo(a, -b * 1.2); s.lineTo(0, -b * 1.45); s.lineTo(-a, -b * 1.2); s.lineTo(-a, -a); s.lineTo(-b, -a); s.lineTo(-b, a); s.lineTo(-a, a); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }); }), M.gold);
    add(g, diamond('bg', 0.008, 0.013), M.ember, [0, 0, 0.009]);
    for (const s of [-1, 1]) add(g, C('bkPlate', () => new THREE.BoxGeometry(0.022, 0.05, 0.006)), M.gold, [s * 0.06, 0, -0.002]); }
  // 옆 허리 판갑 (흰 판 두 장 + 금 테) — 다리를 따라 들림
  m.tassets = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 0.13, 0.03, 0.01); g.rotation.z = s * 0.12; J.hips.add(g); m.tassets.push(g);
    for (let k = 0; k < 2; k++) {
      const tp = (v) => ({ y: -0.005 - k * 0.07 - 0.1 * v, rx: 0.06 + 0.006 * v, rz: 0.075 + 0.008 * v, cx: s * 0.015 });
      const a0 = s > 0 ? 0.08 : 0.58, a1 = a0 + 0.34;
      add(g, C(`tas${s}${k}`, () => loft(tp, 16, 4, { a0, a1 })), M.plate); rim(g, `tasR${s}${k}`, loftRing(tp, 1, { a0, a1, n: 16 }), 0.0035, false);
    }
    add(g, diamond('tg', 0.009, 0.016), M.gem, [s * 0.085, -0.07, 0.0], [0, s * Math.PI / 2, 0]);
  }
  // 앞 휘장: 허리띠 아래로 늘어진 흰 천 띠 (금 테 · 삼지창 문장 · 푸른 보석) — 왼쪽 앞
  const tabG = new THREE.Group(); tabG.position.set(0.06, 0.03, 0.108); J.hips.add(tabG); m.tabG = tabG;
  { const TW = 0.036, TL = 0.42;
    add(tabG, C('tab', () => surf((u, v, p) => { const w = TW * (1 - 0.15 * v); p.set((u - 0.5) * 2 * w, -TL * v, 0.004 + 0.01 * v); }, 4, 10)), M.white);
    const e = []; for (let i = 0; i <= 10; i++) { const v = i / 10; e.push(new V3(TW * (1 - 0.15 * v), -TL * v, 0.006 + 0.01 * v)); }
    e.push(new V3(0, -TL - 0.03, 0.017)); const pts = [...e.slice().reverse().map((q) => new V3(-q.x, q.y, q.z)).slice(1), ...e]; rim(tabG, 'tabRim', pts.reverse(), 0.003, false);
    add(tabG, flameGeo('tri', 0.04, 0.06, 0, 0.004), M.gold, [0, -0.13, 0.012]); add(tabG, diamond('tg2', 0.008, 0.016), M.gem, [0, -0.25, 0.014]); add(tabG, diamond('tg3', 0.006, 0.012), M.gem, [0, -0.33, 0.016]); }

  /* ---------- 코트 앞자락 (허리 → 무릎 아래, 앞이 트임) : 겉 흰 · 안 스테인드글라스 ---------- */
  const SK_L = 0.62, skR = (d) => { const t = d / SK_L, e = t * t * (1.5 - 0.5 * t); return { rx: 0.156 + 0.1 * e, rzF: 0.108 + 0.07 * e, rzB: 0.116 + 0.12 * e }; };
  const skirtFn = (u, v, p) => { const d = SK_L * v, s = skR(d), a0 = 0.548 + 0.06 * v, a1 = 1.452 - 0.06 * v; loftAt(() => ({ y: 0.03 - d, ...s, n: 2.1 }), a0 + (a1 - a0) * u, 0, p);
    const w = Math.sin(u * TAU * 7 + 0.4), k = 1 + 0.025 * w * smooth(0.1, 1, v); p.x *= k; p.z *= k; };
  const skGeo = C('skirt', () => surf(skirtFn, 96, 14)).clone(); skGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const skO = add(J.hips, skGeo, M.skirt), skI = add(J.hips, skGeo, M.skirtIn); skO.frustumCulled = skI.frustumCulled = false; skI.castShadow = false;
  m.skirt = { geo: skGeo, base: skGeo.attributes.position.array.slice() };
  { const pts = []; for (let i = 0; i <= 48; i++) { const p = new V3(); skirtFn(i / 48, 1, p); pts.push(p.multiplyScalar(1.006)); } rim(J.hips, 'skHem', pts, 0.0045, false); }

  /* ---------- 상체: 흰 코트 (가슴판 · 단추 · 견장 사슬) · 하이칼라 · 금 목받이 ---------- */
  const chX = spl([[0, 0.128], [0.3, 0.14], [0.55, 0.152], [0.8, 0.15], [1, 0.11]]), chF = spl([[0, 0.088], [0.5, 0.1], [1, 0.074]]), chB = spl([[0, 0.088], [0.6, 0.094], [1, 0.072]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.25 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.016 * gauss(ax - 0.065, 0.045) * gauss(p.y - 0.15, 0.06) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod, uvU: 1 })), M.coat);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.255 + 0.05 * v, rx: 0.11 - 0.05 * v ** 0.8, rzF: 0.074 - 0.022 * v, rzB: 0.072 - 0.02 * v }), 40, 6)), M.white);
  // 하이칼라: 흰 깃 (앞이 살짝 벌어짐) + 금 테 · 안쪽 금 목받이
  const colP = (v) => ({ y: 0.285 + 0.085 * v, rx: 0.058 + 0.01 * v, rzF: 0.056 + 0.012 * v, rzB: 0.06 + 0.004 * v, n: 2.2 });
  add(J.chest, C('collar', () => loft(colP, 40, 4, { a0: 0.54, a1: 1.46 })), M.white);
  lRim(J.chest, 'colR1', colP, 1, 0.0035, M.gold, { a0: 0.54, a1: 1.46 });
  add(J.chest, C('gorget', () => loft((v) => ({ y: 0.285 + 0.075 * v, rx: 0.046 + 0.004 * v, rzF: 0.05 + 0.004 * v, rzB: 0.046 }), 32, 4, { a0: 0.3, a1: 0.7 })), M.gorget);
  // 가슴판: 흰 법랑 판 두 장 (가운데 금 능선) + 금 V 테두리
  const plateFn = (s) => (u, v, p) => { const a = 0.5 + s * (0.004 + 0.13 * u * (0.55 + 0.45 * v)); loftAt(chP, a, 0.4 + 0.55 * v, p, chMod); const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.007); };
  for (const s of [-1, 1]) { add(J.chest, C('chPlate' + s, () => surf(plateFn(s), 8, 10)), M.plate);
    const e = []; for (let i = 0; i <= 10; i++) { const p = new V3(); plateFn(s)(1, i / 10, p); e.push(p); } rim(J.chest, 'chPR' + s, e, 0.003, false);
    const b = []; for (let i = 0; i <= 8; i++) { const p = new V3(); plateFn(s)(i / 8, 0, p); b.push(p); } rim(J.chest, 'chPB' + s, b, 0.003, false); }
  { const r = []; for (let i = 0; i <= 10; i++) { const p = loftAt(chP, 0.5, 0.38 + 0.58 * i / 10, new V3(), chMod); p.z += 0.011; r.push(p); } rim(J.chest, 'chRidge', r, 0.005, false); }
  add(J.chest, flameGeo('chest', 0.05, 0.07, 0, 0.005), M.gold, [0, 0.13, 0.112], [-0.15, 0, 0]);
  add(J.chest, diamond('cg', 0.009, 0.015), M.gem, [0, 0.16, 0.12], [-0.15, 0, 0]);
  // 오른쪽 가슴: 단추 판 (푸른 단추 세 개 + 금 고리 · 금 가로 단추끈)
  for (let i = 0; i < 3; i++) { const p = loftAt(chP, 0.5 - 0.12, 0.5 + i * 0.13, new V3(), chMod), n = new V3(p.x, 0, p.z).normalize();
    p.addScaledVector(n, 0.012); const g = new THREE.Group(); g.position.copy(p); g.lookAt(p.clone().add(n)); J.chest.add(g);
    add(g, C('btn', () => new THREE.SphereGeometry(0.0085, 14, 10)), M.btn, [0, 0, 0], [0, 0, 0], [1, 1, 0.6]); add(g, C('btnR', () => new THREE.TorusGeometry(0.009, 0.0022, 6, 18)), M.gold);
    add(g, C('btnT', () => new THREE.BoxGeometry(0.03, 0.006, 0.003)), M.gold, [0.022, 0, -0.002]); }
  // 견장 사슬: 오른 어깨에서 가슴 가운데로 늘어진 금 사슬 두 줄
  for (const [k, sag] of [[0, 0.06], [1, 0.1]]) add(J.chest, C('aig' + k, () => strand([[-0.15, 0.245, 0.04], [-0.12, 0.2 - sag * 0.4, 0.1], [-0.06, 0.2 - sag, 0.118], [-0.01, 0.215 - sag * 0.5, 0.115], [0.01, 0.235, 0.105]], 0.005, 0.005, { seg: 40, rad: 8 })), M.chain);
  add(J.chest, C('aigK', () => new THREE.SphereGeometry(0.012, 12, 10)), M.gold, [0.01, 0.235, 0.106]);

  /* ---------- 어깨 · 팔 (흰 소매 · 금 소맷부리 · 강철 팔갑) · 건틀릿 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('deltoid', () => loft((v) => ({ y: 0.045 - 0.12 * v, rx: 0.058 - 0.004 * v, rz: 0.06 - 0.008 * v }), 20, 6, { poles: [] })), M.coat);
    add(sh, C('uarm', () => loft((v) => ({ y: 0.0 - (DIMS.uArm + 0.01) * v, rx: 0.05 - 0.01 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.049 - 0.009 * v }), 24, 10)), M.white);
    add(el, C('farm', () => loft((v) => ({ y: 0.025 - (DIMS.lArm * 0.5) * v, rx: 0.044 - 0.004 * v, rz: 0.042 - 0.004 * v }), 24, 6)), M.white);
    const cuffP = (v) => ({ y: -0.02 - 0.05 * v, rx: 0.05 + 0.004 * v, rz: 0.048 + 0.004 * v });
    add(el, C('cuff', () => loft(cuffP, 24, 3)), M.grey); lRim(el, 'cuffR0', cuffP, 0, 0.0035, M.gold); lRim(el, 'cuffR1', cuffP, 1, 0.0035, M.gold);
    // 강철 팔갑: 손목까지 · 금 테 · 바깥 능선
    const vbP = (v) => ({ y: -0.075 - (DIMS.lArm - 0.085) * v, rx: 0.044 - 0.008 * v, rz: 0.042 - 0.008 * v });
    add(el, C('vamb', () => loft(vbP, 28, 8)), M.steel); lRim(el, 'vbR0', vbP, 0, 0.003, M.gold); lRim(el, 'vbR1', vbP, 1, 0.003, M.gold);
    { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(vbP, s > 0 ? 0.25 : 0.75, i / 10, new V3()).multiplyScalar(1.05)); rim(el, 'vbRidge' + s, pts, 0.0035, false); }
    add(el, C('elbowCop', () => { const g = new THREE.SphereGeometry(0.036, 16, 10, 0, TAU, 0, Math.PI * 0.55); g.rotateX(-Math.PI / 2); return g; }), M.plate, [0, -0.01, -0.035]);
    // 건틀릿: 강철 손등 판 · 마디 판 · 강철 손가락
    const hg = new THREE.Group(); hg.scale.setScalar(0.9); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.021 + 0.003 * Math.sin(v * Math.PI), rz: 0.035 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.steelD);
    add(hg, C('hback' + s, () => loft((v) => ({ y: 0.008 - 0.06 * v, rx: 0.025, rz: 0.039, n: 3, cx: s * 0.017 }), 18, 4, { a0: s > 0 ? 0.05 : 0.55, a1: s > 0 ? 0.45 : 0.95 })), M.steel);
    add(hg, C('cuffG' + s, () => loft((v) => ({ y: 0.03 - 0.035 * v, rx: 0.046 + 0.006 * v, rz: 0.044 + 0.006 * v }), 20, 3)), M.steel);
    for (let k = 0; k < 4; k++) {
      const z = 0.025 - k * 0.0165, L = k === 3 ? 0.86 : 1, pts = [], curl = 1.9 + k * 0.1;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.031 + s * 0.003, -0.05 + Math.sin(th) * 0.031, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0085, 0.0068, { seg: 14, rad: 8 })), M.steel);
      add(hg, C('knuck', () => new THREE.SphereGeometry(0.0095, 8, 6)), M.gold, pts[1].toArray(), [0, 0, 0], [1, 1, 0.8]);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.031], [-s * 0.01, -0.036, 0.047], [s * 0.003, -0.058, 0.046], [s * 0.017, -0.07, 0.038]], 0.01, 0.0075, { seg: 12, rad: 8 })), M.steel);
  }
  // 오른 어깨: 겹친 흰 견갑 세 장 + 금 테 · 푸른 보석
  for (let k = 0; k < 3; k++) {
    const pp = (v) => ({ y: 0.07 - k * 0.032 - 0.065 * v, rx: 0.074 + 0.012 * k + 0.02 * v, rz: 0.072 + 0.01 * k + 0.016 * v });
    add(J.shoulderR, C(`pldR${k}`, () => loft(pp, 24, 4, { a0: 0.52, a1: 0.98 })), M.plate, [-0.012, 0, 0]);
    rim(J.shoulderR, `pldRR${k}`, loftRing(pp, 1, { a0: 0.52, a1: 0.98, n: 24 }).map((q) => q.add(new V3(-0.012, 0, 0))), 0.0035, false);
  }
  add(J.shoulderR, diamond('pr', 0.01, 0.017), M.gem, [-0.096, 0.03, 0], [0, -Math.PI / 2, 0]);
  // 왼 어깨: 큰 흰 견갑 (네 장) + 위로 솟는 금 불꽃 세공 · 주황 불꽃 · 푸른 보석
  { const P = J.shoulderL, g = new THREE.Group(); g.position.set(0.012, 0.0, 0); P.add(g); m.pauldron = g;
    for (let k = 0; k < 4; k++) {
      const pp = (v) => ({ y: 0.095 - k * 0.04 - 0.085 * v, rx: 0.088 + 0.014 * k + 0.026 * v, rz: 0.088 + 0.012 * k + 0.022 * v });
      add(g, C(`pldL${k}`, () => loft(pp, 28, 5, { a0: 0.0, a1: 0.5 })), M.plate);
      rim(g, `pldLR${k}`, loftRing(pp, 1, { a0: 0.0, a1: 0.5, n: 28 }), 0.0045, false, k % 2 ? M.bronze : M.gold);
    }
    add(g, C('pldTop', () => { const geo = new THREE.SphereGeometry(0.094, 24, 12, 0, Math.PI, 0, Math.PI * 0.42); geo.rotateY(0); return geo; }), M.plate, [0, 0.0, 0], [0, 0, 0], [1, 0.9, 1]);
    // 불꽃 세공: 견갑 위에서 위 · 바깥으로 솟는 금 불꽃 여러 장 (안쪽에 주황 불꽃)
    for (const [x, y, z, ry, rz, w, h, sc, kk] of [[0.06, 0.06, 0.02, 1.4, -0.35, 0.07, 0.2, 1, 'a'], [0.07, 0.05, -0.05, 1.9, -0.55, 0.06, 0.16, 1, 'b'], [0.04, 0.07, 0.07, 1.0, -0.2, 0.05, 0.13, 1, 'c'], [0.11, 0.0, 0.0, 1.57, -1.1, 0.06, 0.15, 1, 'd'], [0.1, -0.06, 0.05, 1.3, -1.6, 0.05, 0.12, 1, 'e']]) {
      const o = add(g, flameGeo(kk, w, h, 0.35), M.gold, [x * 1.15 + 0.02, y * 0.6, z], [0, ry, rz - 0.45], [sc * 0.62, sc * 0.62, sc * 0.62]);
      add(o, flameGeo(kk + 'i', w * 0.45, h * 0.6, 0.3, 0.006), M.ember, [0, h * 0.08, 0.004]);
    }
    add(g, diamond('pl', 0.013, 0.022, 0.006), M.gem, [0.118, 0.01, 0.02], [0, Math.PI / 2, -0.4]);
    add(g, C('plGemR', () => new THREE.TorusGeometry(0.02, 0.003, 6, 20)), M.gold, [0.12, 0.01, 0.02], [0, Math.PI / 2, -0.4], [0.7, 1.15, 1]);
  }

  /* ---------- 다리: 흰 바지 · 금 불꽃 무릎 갑주 · 흰 정강이 갑주 · 판금 장화 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.09], [0.4, 0.082], [0.85, 0.062], [1, 0.058]]), thF = spl([[0, 0.088], [0.5, 0.075], [1, 0.058]]), thB = spl([[0, 0.09], [0.35, 0.08], [1, 0.054]]);
    add(hp, C('thigh', () => loft((v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) }), 28, 12)), M.pants);
    const cX = spl([[0, 0.058], [0.3, 0.06], [0.75, 0.042], [1, 0.036]]), cF = spl([[0, 0.056], [0.5, 0.048], [1, 0.036]]), cB = spl([[0, 0.058], [0.3, 0.07], [0.7, 0.046], [1, 0.038]]);
    add(kn, C('shin', () => loft((v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) }), 28, 12)), M.pants);
    // 정강이 갑주: 무릎 아래 → 발목, 앞쪽 3/4 를 감싸고 가운데 금 능선
    const grP = (v) => { const q = v, y = -0.05 - (DIMS.shin - 0.1) * q; return { y, rx: cX(0.12 + 0.82 * q) + 0.012, rzF: cF(0.12 + 0.82 * q) + 0.016, rzB: cB(0.12 + 0.82 * q) + 0.008 }; };
    add(kn, C('greave', () => loft(grP, 32, 14, { a0: 0.1, a1: 0.9 })), M.plate);
    rim(kn, 'grE0', loftRing(grP, 0, { a0: 0.1, a1: 0.9, n: 28 }), 0.004, false); rim(kn, 'grE1', loftRing(grP, 1, { a0: 0.1, a1: 0.9, n: 28 }), 0.004, false);
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(grP, 0.5, i / 12, new V3()).add(new V3(0, 0, 0.004))); rim(kn, 'grRidge', pts, 0.0045, false); }
    for (const a of [0.1, 0.9]) { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(grP, a, i / 12, new V3())); rim(kn, 'grS' + a, pts, 0.0035, false); }
    add(kn, flameGeo('shin', 0.04, 0.09, 0, 0.005), M.gold, [0, -0.32, cF(0.75) + 0.02], [0.08, 0, 0]);
    // 무릎 갑주: 둥근 판 + 위아래 겹판 · 금 테 · 주황 불꽃 문장
    { const g = new THREE.Group(); g.position.set(0, 0.0, 0.05); kn.add(g); m['knee' + s] = g;
      add(g, C('kneeCop', () => { const geo = new THREE.SphereGeometry(0.062, 24, 14, 0, TAU, 0, Math.PI * 0.5); geo.rotateX(Math.PI / 2); geo.scale(1, 1.15, 0.65); return geo; }), M.plate);
      add(g, C('kneeRim', () => new THREE.TorusGeometry(0.06, 0.0045, 8, 32)), M.gold, [0, 0, 0.0], [0, 0, 0], [1, 1.15, 1]);
      add(g, C('kneeUp', () => { const geo = new THREE.SphereGeometry(0.07, 20, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.25, Math.PI * 0.3); geo.rotateY(-Math.PI / 2 - Math.PI * 0.0); return geo; }), M.plate, [0, 0.03, -0.03], [-0.3, Math.PI / 2 - Math.PI / 2, 0]);
      const fo = add(g, flameGeo('knee', 0.055, 0.075, 0, 0.006), M.gold, [0, -0.035, 0.04], [-0.2, 0, 0]);
      add(fo, flameGeo('kneeI', 0.028, 0.045, 0, 0.005), M.ember, [0, 0.008, 0.005]);
      for (const q of [-1, 1]) add(g, flameGeo('kneeW' + q, 0.03, 0.06, q * 0.6, 0.005), M.gold, [q * 0.055, 0.0, 0.0], [0, q * 0.9, -q * 1.2]); }
    // 장화: 판금 발등 (흰 법랑 · 금 테) · 발목 갑주 · 굽
    const fw = spl([[0, 0.0], [0.08, 0.038], [0.3, 0.042], [0.62, 0.045], [0.86, 0.036], [1, 0.01]]), fh = spl([[0, 0.05], [0.1, 0.08], [0.3, 0.085], [0.6, 0.05], [0.85, 0.035], [1, 0.016]]);
    const FB = -0.085, boot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.7; p.set(Math.sign(c) * Math.abs(c) ** e * w, FB + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.07 + 0.265 * v); };
    add(ft, C('boot', () => surf(boot, 28, 20, { closedU: true })), M.plate);
    add(ft, C('sole', () => { const g = surf((u, v, p) => { const [c, sn] = ang(u), e = 0.3; p.set(Math.sign(c) * Math.abs(c) ** e * (fw(v) + 0.004), FB - 0.012 + 0.012 * (Math.sign(sn) * Math.abs(sn) ** e + 1) / 2, -0.074 + 0.272 * v); }, 24, 14, { closedU: true }); return g; }), M.steelD);
    { const pts = []; for (let i = 0; i <= 16; i++) { const v = i / 16; pts.push(new V3(fw(v) + 0.003, FB + 0.004, -0.07 + 0.265 * v)); } rim(ft, 'bootR', pts, 0.003, false, M.gold); rim(ft, 'bootL', pts.map((q) => new V3(-q.x, q.y, q.z)), 0.003, false, M.gold); }
    add(ft, C('toeCap', () => { const geo = new THREE.SphereGeometry(0.04, 16, 10, 0, TAU, 0, Math.PI * 0.5); geo.scale(1, 0.55, 1.3); return geo; }), M.plate, [0, FB + 0.03, 0.13]);
    rim(ft, 'toeRim', (() => { const a = []; for (let i = 0; i <= 16; i++) { const t = Math.PI * (i / 16); a.push(new V3(Math.cos(t) * 0.041, FB + 0.03, 0.13 - Math.sin(t) * 0.04 * 1.3 * 0.35)); } return a; })(), 0.003, false);
    add(ft, flameGeo('foot', 0.035, 0.05, 0, 0.004), M.gold, [0, FB + 0.07, 0.07], [-1.15, 0, 0]);
    const akP = (v) => ({ y: 0.0 + 0.11 * v, rx: 0.05 - 0.008 * v, rzF: 0.058 - 0.01 * v, rzB: 0.055 - 0.006 * v });
    add(ft, C('ankleG', () => loft(akP, 28, 4)), M.plate); lRim(ft, 'akR1', akP, 1, 0.0035, M.gold); lRim(ft, 'akR0', akP, 0, 0.0035, M.gold);
    add(ft, diamond('ak', 0.008, 0.014), M.gem, [s * 0.05, 0.05, 0.0], [0, s * Math.PI / 2, 0]);
  }

  /* ---------- 목 · 얼굴 · 머리 (옆가르마 단발) · 금 귀걸이 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.04 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.039 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.039 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.09);
  m.eyeGlow = add(H, headGeo, M.eyeGlow, [0, 0, 0], [0, 0, 0], [1.002, 1.002, 1.002]); m.eyeGlow.renderOrder = 5;
  for (const s of [-1, 1]) {
    add(H, C('ear' + s, () => strand([[s * 0.07, 0.106, -0.004], [s * 0.082, 0.11, -0.012], [s * 0.086, 0.094, -0.018], [s * 0.078, 0.078, -0.01]], 0.014, 0.007, { seg: 10, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
    // 금 귀걸이: 작은 구슬 + 늘어진 금 방울
    const eg = new THREE.Group(); eg.position.set(s * 0.079, 0.074, -0.008); H.add(eg);
    add(eg, C('earB', () => new THREE.SphereGeometry(0.0045, 10, 8)), M.gold);
    add(eg, C('earD', () => lathe([[0.0005, 0], [0.002, -0.004], [0.0035, -0.012], [0.005, -0.022], [0.0035, -0.03], [0, -0.032]], 12)), M.gold, [0, -0.003, 0]);
  }
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.2 + 0.3 * w * w : 0.2 - 1.0 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.008 + 0.014 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(9), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), M.hair);
    // 앞머리: 오른쪽(-az) 가르마에서 왼쪽으로 쓸어 넘긴 결 · 가운데 한 가닥이 미간까지
    // 가르마(az -0.42)에서 갈라져, 대부분은 왼쪽(+az)으로 비스듬히 쓸려 내려오고 오른쪽 몇 가닥은 귀 쪽으로
    const PART = -0.42;
    const BANG = [ // [끝 방위, 끝 높이, 굵기]
      [-0.95, 0.12, 0.036], [-0.72, 0.2, 0.04], [-0.5, 0.3, 0.036],
      [-0.3, 0.2, 0.044], [-0.12, 0.13, 0.046], [0.04, 0.08, 0.04], [0.2, 0.15, 0.048], [0.38, 0.2, 0.046], [0.56, 0.22, 0.044], [0.74, 0.16, 0.042], [0.92, 0.06, 0.04], [1.08, -0.04, 0.036]];
    BANG.forEach(([az, tipEl, rr], k) => {
      const left = az > PART, rootAz = left ? PART + 0.08 + (az - PART) * 0.25 : PART - 0.08 + (az - PART) * 0.3, mid = left ? az - 0.28 : az + 0.12;
      const pts = [headAt(rootAz, 1.15, 0.02), headAt(rootAz * 0.4 + mid * 0.6, 0.85, 0.03), headAt(mid, 0.55, 0.03), headAt(az - (left ? 0.06 : -0.03), (0.55 + tipEl) / 2 + 0.03, 0.025), headAt(az, tipEl, 0.012)];
      const d = dirOf(az, 0.45); clump('bang' + k, pts, rr + r() * 0.006, 0.002, 0.2, [d.x, d.y, d.z]);
    });
    // 옆 · 뒷머리: 귀 위를 덮고 목덜미에서 짧게 정리 (부피를 줄여 머리에 붙게)
    for (let k = 0; k < 30; k++) {
      const az = (k / 30) * TAU + Math.PI * 0.5 + 0.1, w = Math.cos(az); if (w > 0.45) continue;
      const tipEl = -0.06 - 0.5 * Math.max(0, -w) + (r() - 0.5) * 0.06 - (w > 0.05 ? 0.08 : 0);
      const pts = [headAt(az, 0.85, 0.016), headAt(az, 0.4, 0.02), headAt(az + (r() - 0.5) * 0.05, (0.4 + tipEl) / 2, 0.019), headAt(az + (w > 0 ? Math.sign(az) * 0.04 : 0), tipEl, 0.008)];
      const d = dirOf(az, 0); clump('side' + k, pts, 0.04, 0.005, 0.24, [d.x, 0, d.z]);
    }
  }

  /* ---------- 등 코트 자락 (어깨 → 발목, 두 갈래) : 천 물리 · 겉 흰/스테인드글라스 · 안감 스테인드글라스 ---------- */
  let capes = [], linings = [];
  const CAPE_L = 1.3;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    capes = [new Cloth(scene, 6, 18, CAPE_L, M.cape), new Cloth(scene, 6, 18, CAPE_L, M.cape)];
    for (const c of capes) { const l = new THREE.Mesh(c.mesh.geometry, M.capeIn); l.frustumCulled = false; l.receiveShadow = true; scene.add(l); linings.push(l); extras.push(c.mesh, l); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const c of capes) c.mesh.geometry.dispose(); capes = []; linings = []; m._attached = false; };
  m.resetCloth = () => { for (const c of capes) c.ok = false; };

  /* ---------- 방패: 연 모양 · 스테인드글라스 면 · 금/청동 불꽃 세공 · 긴 아래 가시 ---------- */
  const shield = new THREE.Group(); J.handL.add(shield); m.shield = shield;
  const hwS = spl([[SH.yb, 0.0], [-0.48, 0.07], [-0.3, 0.15], [-0.05, 0.24], [0.2, 0.3], [0.38, 0.33], [0.48, 0.3], [0.55, 0.18], [SH.yt, 0.0]]);
  const sP = (v) => { const y = SH.yb + (SH.yt - SH.yb) * v, w = Math.max(0.002, hwS(y)); return { y, rx: w, rzF: SH.bulge * Math.sqrt(Math.max(0.05, w / 0.33)), rzB: SH.back, cz: SH.cz }; };
  const faceZ = (x, y) => { const w = Math.max(0.002, hwS(y)), q = clamp(Math.abs(x) / w, 0, 1); return SH.cz + SH.bulge * Math.sqrt(Math.max(0.05, w / 0.33)) * Math.sqrt(1 - q * q); };
  const planarUV = (g) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.7 + 0.5, (p.getY(i) - SH.yb) / (SH.yt - SH.yb)); return g; };
  add(shield, C('sh:face', () => planarUV(loft(sP, 40, 48, { a0: 0.25, a1: 0.75 }))), M.glass);
  add(shield, C('sh:back', () => loft(sP, 40, 32, { a0: 0.75, a1: 1.25 })), M.shieldBack);
  // 테: 바깥 금 테 + 안쪽 청동 테
  { const pts = []; for (let i = 0; i <= 40; i++) { const y = SH.yb + (SH.yt - SH.yb) * (i / 40); pts.push(new V3(hwS(y) + 0.004, y, SH.cz)); } const ring = [...pts, ...pts.slice(1, -1).reverse().map((q) => new V3(-q.x, q.y, q.z))];
    add(shield, C('sh:rim', () => strand(ring, 0.018, 0.018, { closed: true, seg: 160, rad: 8, flat: 0.55, ref: [0, 0, 1] })), M.gold);
    const inner = ring.map((q) => { const k = 0.86, x = q.x * k, y = q.y * 0.94 + 0.005; return new V3(x, y, faceZ(x, y) + 0.004); });
    add(shield, C('sh:rim2', () => strand(inner, 0.006, 0.006, { closed: true, seg: 160, rad: 6 })), M.bronze); }
  // 가운데 세로 금 등줄 (위 볏 → 아래 가시) + 가로 팔 (십자)
  const ribPts = (x0, x1, y0, y1, n, lift = 0.008) => { const a = []; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; a.push(new V3(x, y, faceZ(x, y) + lift)); } return a; };
  add(shield, C('sh:spine', () => strand(ribPts(0, 0, SH.yb + 0.04, SH.yt - 0.03, 24), 0.032, 0.032, { seg: 60, rad: 8, flat: 0.32, ref: [0, 0, 1], prof: (v) => 0.55 + 0.45 * Math.sin(v * Math.PI) ** 0.4 })), M.gold);
  add(shield, C('sh:spineE', () => strand(ribPts(0, 0, SH.yb + 0.06, SH.yt - 0.05, 24, 0.016), 0.008, 0.008, { seg: 60, rad: 6 })), M.ember);
  add(shield, C('sh:arm', () => strand(ribPts(-0.3, 0.3, 0.3, 0.3, 24), 0.026, 0.026, { seg: 60, rad: 8, flat: 0.32, ref: [0, 0, 1], prof: (v) => 0.4 + 0.6 * Math.sin(v * Math.PI) ** 0.5 })), M.gold);
  add(shield, C('sh:armE', () => strand(ribPts(-0.26, 0.26, 0.3, 0.3, 24, 0.016), 0.006, 0.006, { seg: 60, rad: 6 })), M.ember);
  // 불꽃 덩굴: 등줄에서 바깥으로 말려 나가는 금 가지 (양쪽 대칭) + 안쪽 주황선
  for (const s of [-1, 1]) {
    for (const [y0, dx, dy, curl, r0, key] of [[0.12, 0.2, 0.08, 0.06, 0.016, 'a'], [-0.05, 0.17, -0.06, 0.05, 0.015, 'b'], [-0.24, 0.12, -0.08, 0.04, 0.013, 'c'], [0.42, 0.15, 0.08, 0.04, 0.013, 'd'], [-0.4, 0.06, -0.06, 0.03, 0.01, 'e']]) {
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, x = s * (0.02 + dx * t + curl * Math.sin(t * 3.4) * t), y = y0 + dy * t + curl * (1 - Math.cos(t * 3.4)) * t * 0.8; pts.push(new V3(x, y, faceZ(x, y) + 0.006)); }
      add(shield, C(`sh:vine${s}${key}`, () => strand(pts, r0, 0.002, { seg: 30, rad: 6, flat: 0.45, ref: [0, 0, 1] })), M.gold);
      if (key < 'c') add(shield, C(`sh:vineE${s}${key}`, () => strand(pts.slice(0, 8).map((q) => q.clone().add(new V3(0, 0, 0.008))), r0 * 0.35, 0.0015, { seg: 24, rad: 5 })), M.ember);
    }
    // 바깥 불꽃 날개 (가로 팔 끝 · 어깨 · 아래)
    const wing = (key, x, y, rz, w, h, sc = 1) => { const o = add(shield, flameGeo('sw' + key, w, h, 0.4), M.gold, [x * s, y, SH.cz + 0.01], [0, 0, rz * s], [s * sc, sc, sc]); add(o, flameGeo('swi' + key, w * 0.45, h * 0.55, 0.3, 0.006), M.ember, [0, h * 0.1, 0.006]); return o; };
    wing('a', 0.3, 0.3, -1.45, 0.09, 0.22); wing('b', 0.3, 0.44, -0.75, 0.07, 0.17); wing('c', 0.24, 0.0, -2.0, 0.06, 0.16); wing('d', 0.12, -0.36, -2.5, 0.05, 0.14); wing('e', 0.14, 0.56, -0.35, 0.05, 0.13);
  }
  // 위 볏: 가운데로 솟은 금 불꽃 + 보석
  { const o = add(shield, flameGeo('crest', 0.1, 0.2, 0.0, 0.012), M.gold, [0, SH.yt - 0.06, SH.cz + 0.01]); add(o, flameGeo('crestI', 0.045, 0.11, 0, 0.008), M.ember, [0, 0.02, 0.007]); }
  add(shield, diamond('shc', 0.024, 0.038, 0.01), M.gem, [0, 0.3, faceZ(0, 0.3) + 0.022]);
  add(shield, C('sh:cRing', () => new THREE.TorusGeometry(0.036, 0.006, 8, 28)), M.gold, [0, 0.3, faceZ(0, 0.3) + 0.02], [0, 0, 0], [0.75, 1.15, 1]);
  // 아래 가시: 긴 청동/금 창날
  add(shield, C('sh:spike', () => { const g = new THREE.ConeGeometry(0.07, SH.yb + 0.08 - SH.spike, 4, 1); g.rotateY(Math.PI / 4); g.rotateX(Math.PI); g.scale(1, 1, 0.35); g.translate(0, (SH.yb + 0.08 + SH.spike) / 2, SH.cz); return g; }), M.gold);
  add(shield, C('sh:spikeE', () => { const g = new THREE.ConeGeometry(0.03, 0.22, 4, 1); g.rotateY(Math.PI / 4); g.rotateX(Math.PI); g.scale(1, 1, 0.35); g.translate(0, SH.yb - 0.08, SH.cz + 0.014); return g; }), M.ember);
  for (const s of [-1, 1]) add(shield, flameGeo('spw', 0.04, 0.12, 0.5), M.gold, [s * 0.05, SH.yb - 0.02, SH.cz], [0, 0, s * 2.7], [s, 1, 1]);
  // 뒷면: 다이아 손잡이 판 · 금 테 · 손잡이
  add(shield, C('sh:gripPlate', () => { const g = new THREE.BoxGeometry(0.12, 0.12, 0.01); g.rotateZ(Math.PI / 4); g.scale(0.8, 1.3, 1); return g; }), M.plateG, [0, 0.0, SH.cz - SH.back - 0.004]);
  add(shield, C('sh:gripRim', () => new THREE.TorusGeometry(0.086, 0.004, 6, 4)), M.gold, [0, 0, SH.cz - SH.back - 0.01], [0, 0, Math.PI / 4], [0.8, 1.3, 1]);
  add(shield, C('sh:handle', () => strand([[0, 0.07, 0.055], [0, 0.04, 0.0], [0, -0.04, 0.0], [0, -0.07, 0.055]], 0.012, 0.012, { seg: 16, rad: 8 })), M.navy);
  // 방패 빛 (기술 중 · 성역에서 밝아지는 보랏빛 후광)
  m.shieldHalo = add(shield, C('sh:halo', () => { const g = loft(sP, 24, 24, { a0: 0.25, a1: 0.75 }); g.scale(1.25, 1.12, 1.4); return g; }), M.halo, [0, 0.02, 0]); m.shieldHalo.renderOrder = 6;

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 };
  m.glow = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    // 앞자락: 다리 각도를 스프링으로 따라 출렁임
    lag.vL += ((J.hipL.rotation.x - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * (1 - Math.exp(-dt * 10));
    { const base = m.skirt.base, pa = m.skirt.geo.attributes.position, arr = pa.array, spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.4, 1.4)), zR = -Math.sin(clamp(lag.R, -1.4, 1.4));
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, 0.03 - y), wL = clamp(0.5 + x / 0.16, 0, 1), wR = 1 - wL, front = clamp(z / 0.15, 0, 1);
        const dz = (wL * zL + wR * zR) * depth * (0.55 + 0.4 * front), out = 1 + (spread * 0.25 + lag.sw * 0.12) * (depth / SK_L);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.3; arr[i + 2] = z * out + dz - lag.sw * 0.14 * depth;
      }
      pa.needsUpdate = true; m.skirt.geo.computeVertexNormals(); }
    for (const [i, t] of m.tassets.entries()) t.rotation.x = Math.min(0, i ? lag.L : lag.R) * 0.55;
    m.tabG.rotation.x = Math.min(0, lag.L) * 0.8 - lag.sw * 0.25;
    // 등 코트 자락: 어깨 뒤에 고정 (두 갈래)
    J.chest.updateMatrixWorld(true);
    const wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 1.0, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 1.0];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.05 * sc })), h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.12), r: h0.r + 0.06 * sc };
    const hp = J.hips.getWorldPosition(new V3()), s1 = hp.clone().add(new V3(0, -0.2 * sc, 0)), s2 = hp.clone().add(new V3(0, -0.42 * sc, 0));
    const caps = [torso, ...legs, { a: s1, b: s1, r: (0.22 + lag.sw * 0.03) * sc }, { a: s2, b: s2, r: (0.26 + lag.sw * 0.05) * sc }];
    capes.forEach((cl, ci) => {
      const s = ci ? -1 : 1;
      for (let k = 0; k < cl.W; k++) { const u = k / (cl.W - 1), q = ci ? u : 1 - u, x = s * (0.015 + 0.19 * q), edge = q; /* 두 자락 모두 왼쪽 → 오른쪽 순서 (앞뒤 면 방향을 같게) */ J.chest.localToWorld(cl.anchors[k].set(x, DIMS.chestL - 0.005 + 0.012 * edge, -0.105 - 0.012 * Math.cos(u * 1.4) + 0.04 * edge * edge)); }
      cl.len = CAPE_L * sc; cl.mesh.visible = vis; linings[ci].visible = vis; cl.step(dt, caps, f.pos.y + 0.02, wind);
    });
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림 / 성광 (기술 중 · 성역 안에서 밝게)
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    const want = Math.max(f.holyK || 0, f.aegisT > 0 ? 0.7 : 0, f.inSanct ? 0.5 : 0.1); m.glow += (want - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.88 + 0.12 * Math.sin(f.G.time * 5);
    M.eyeGlow.opacity = (0.25 + m.glow * 0.5) * pulse; M.glass.emissiveIntensity = (0.3 + m.glow * 1.3) * pulse; M.gem.emissiveIntensity = 0.9 + m.glow * 1.5;
    M.halo.opacity = m.glow * 0.22 * pulse; m.shieldHalo.visible = vis && m.glow > 0.15 && shield.visible;
    if (vis && m.glow > 0.4 && Math.random() < m.glow * 0.6) { const p = m.shieldPt(tmp, (Math.random() - 0.5) * 0.5, Math.random() * 1.1 - 0.5); f.G.fx.p(p, { vel: [0, 0.8, 0], size: 0.07, size1: 0.01, life: 0.5, color: Math.random() < 0.5 ? HOLY : HOLY2, alpha: 0.9, drag: 1 }); }
  };
  m.setWeapon = (v) => { shield.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.097;
  // 오른손 무기 관절: 몸 기준 [피치, 좌우, 롤] (빈손이지만 규칙 유지) · 왼손 handL 포즈 값 = 방패 방향 (몸 기준 [앞면 위로+, 앞면 왼쪽으로+, 롤])
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
    const s = J.handL.rotation; wE.set(-s.x, s.y, s.z, 'YXZ'); wQ.setFromEuler(wE);
    J.handL.rotation.set(0, 0, 0); J.handL.updateMatrixWorld(true);
    m.root.getWorldQuaternion(wR); J.handL.getWorldQuaternion(wP);
    shield.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); shield.updateMatrixWorld(true);
  };
  // 방패 위의 점 (방패 좌표 x, y → 월드). 판정 = 가시 끝 → 볏 (방패 세로축)
  m.shieldPt = (out, x, y, z = SH.cz) => { shield.updateMatrixWorld(true); return shield.localToWorld(out.set(x, y, z)); };
  m.weaponPts = (b, t) => { m.shieldPt(b, 0, SH.spike + 0.08); m.shieldPt(t, 0, SH.yt); };
  m.trailPts = (b, t) => { m.shieldPt(b, 0, SH.spike + 0.05); m.shieldPt(t, 0, SH.crest - 0.05); };
  m.tipPos = (out = new V3()) => m.shieldPt(out, 0, 0.1, SH.cz + 0.08);
  m.extras = extras;
  return m;
}

// 기술 이펙트에서 쓰는 스테인드글라스 텍스처 (궁극기 유리벽 · 방벽 돔 · 성역 바닥)
export function holyGlassTex() { return T('glass', () => glassTex(false)); }
