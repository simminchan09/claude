// 이그네시아 (IGNETHIA) — 3D 모델 (기술·포즈는 ignethia.js)
// 진홍 업화의 여왕 · 암룡을 거느린 용기사.
//
// 구성: 무릎까지 흘러내리는 분홍빛 진홍 장발(로프 물리) · 뾰족한 엘프 귀 · 노란빛 녹색 눈 · 이마의 금 마름모 서클릿(주홍 보석)
//       머리 양옆으로 휜 검은 용뿔 장식 · 금 초커 + 검은 가시 펜던트
//       검은 가슴 갑주(분홍 발광 테 · 아래로 돋친 가시 · 가슴 가운데 에메랄드) · 드러난 허리
//       가시 돋친 검보라 어깨 갑주 · 위팔까지 오는 장갑(겹친 판 · 팔꿈치 가시 · 손등 분홍 결정 · 발톱 손끝)
//       금테 · 에메랄드 버클 갑주 벨트 · 앞 가리개 · 용비늘 조각을 겹친 들쭉날쭉한 허리 갑주(다리를 따라 흔들림)
//       허리 양옆에서 발목까지 늘어진 분홍 날개칼 네 자루 · 무릎 덮개가 솟은 정강이 갑주 · 용 발톱 부츠(앞 발톱 셋 · 뒤 며느리발톱)
//       무기: 검보라 칼날의 가늘고 긴 장검 (분홍 날빛 · 코등이의 에메랄드 · 용 날개 코등이) — 기술을 쓰면 분홍 업화에 휩싸인다
//       등 뒤: 암룡의 낙인 문장 (버프 중에만 떠오름)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.9, spineL: 0.18, chestL: 0.25, neckL: 0.07, shW: 0.178, uArm: 0.27, lArm: 0.25, hipW: 0.086, thigh: 0.44, shin: 0.43, headTop: 0.25 };
// 장검 치수 (오른손 기준 +Z)
export const KT = { pommel: -0.25, guard: 0.035, tip: 1.06 };
export const PINK = 0xff3aa8, VIOLET = 0xb03aff, CINDER = 0xff6a3a, HOTP = 0xffb0e0, EMER = 0x3aff7a;
const C = (k, fn) => cached('ign:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// 분홍빛 진홍 머리: 뿌리 짙은 진홍 → 끝 밝은 분홍 (strand v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap, c0, c1, c2) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(cap ? 13 : 57), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, c1); gr.addColorStop(1, c0); } else { gr.addColorStop(0, c2); gr.addColorStop(0.5, c1); gr.addColorStop(1, c0); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.4 ? 'rgba(90,0,30,0.4)' : k > 0.8 ? 'rgba(255,220,235,0.35)' : 'rgba(255,120,170,0.25)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.bezierCurveTo(x + (r() - 0.5) * 24, H * 0.66, x + (r() - 0.5) * 24, H * 0.33, x + (r() - 0.5) * 10, 0); g.stroke(); }
  return tex(c);
}
// 용비늘 갑판: 검보라 바탕 + 겹친 비늘 결 (어둡게)
function scaleTex() {
  const W = 256, H = 256, [c, g] = cv(W, H); g.fillStyle = '#1a1420'; g.fillRect(0, 0, W, H);
  for (let row = 0, y = -16; y < H + 16; row++, y += 14) for (let x = (row % 2) * 12 - 12; x < W + 24; x += 24) {
    const gr = g.createRadialGradient(x, y - 4, 1, x, y, 14); gr.addColorStop(0, '#3a2c48'); gr.addColorStop(0.7, '#201828'); gr.addColorStop(1, '#0c0810');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 12, y - 6); g.quadraticCurveTo(x - 11, y + 8, x, y + 12); g.quadraticCurveTo(x + 11, y + 8, x + 12, y - 6); g.closePath(); g.fill();
  }
  return tex(c, [2, 2]);
}
// 가슴 갑주: 살빛 바탕 + 검은 가슴판 (분홍 테 · 아래 가시) — loft uv: u 0 = 뒤 · 0.5 = 앞, v 0 = 아래(캔버스 아래)
function topPath(W, H) {
  const P = (u, v) => [u * W, (1 - v) * H], p = new Path2D(), top = [[0, 0.56], [0.12, 0.57], [0.24, 0.66], [0.33, 0.78], [0.4, 0.84], [0.45, 0.8], [0.485, 0.66], [0.5, 0.5]];
  const pts = [...top, ...top.slice(0, -1).reverse().map(([u, v]) => [1 - u, v])];
  pts.forEach(([u, v], i) => { const [x, y] = P(u, v); i ? p.lineTo(x, y) : p.moveTo(x, y); });
  // 아래 테: 앞쪽은 가시가 아래로 돋친다
  for (let i = 0; i <= 40; i++) { const u = 1 - i / 40, f = Math.abs(u - 0.5), base = f < 0.25 ? 0.3 + 0.12 * (f / 0.25) ** 2 : 0.42 + 0.02 * ((f - 0.25) / 0.25); const sp = f < 0.24 && i % 2 ? -0.07 * (1 - f / 0.24 * 0.6) : 0; const [x, y] = P(u, base + sp); p.lineTo(x, y); }
  p.closePath(); return p;
}
function topTex(glow, line) {
  const W = 1024, H = 512, [c, g] = cv(W, H), p = topPath(W, H);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.strokeStyle = line; g.lineWidth = 7; g.stroke(p);
    g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W * (0.5 + s * 0.02), H * 0.6); g.quadraticCurveTo(W * (0.5 + s * 0.08), H * 0.38, W * (0.5 + s * 0.16), H * 0.3); g.stroke(); }
    return tex(c, [1, 1], false); }
  g.fillStyle = '#f8e0d8'; g.fillRect(0, 0, W, H);
  const sh = g.createLinearGradient(0, H * 0.2, 0, H); sh.addColorStop(0, 'rgba(200,140,140,0)'); sh.addColorStop(1, 'rgba(190,120,125,0.25)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
  g.fillStyle = '#16111c'; g.fill(p); g.save(); g.clip(p);
  for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(120,90,150,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W * (0.3 + i * 0.022), H * 0.1); g.lineTo(W * (0.32 + i * 0.02), H * 0.8); g.stroke(); }
  g.restore(); g.strokeStyle = line; g.lineWidth = 7; g.stroke(p);
  return tex(c);
}
// 칼자루 감개: 검정 바탕 + 보라 마름모
function tsukaTex() { const [c, g] = cv(64, 256); g.fillStyle = '#100c14'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#7a3ab0'; for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(32, y + 4); g.lineTo(52, y + 16); g.lineTo(32, y + 28); g.lineTo(12, y + 16); g.closePath(); g.fill(); } return tex(c); }
// 암룡의 낙인 문장 (V 자 불꽃 + 마름모) — 가산 합성용
function sigilTex() {
  const W = 512, [c, g] = cv(W, W), cx = W / 2; g.clearRect(0, 0, W, W);
  const glow = g.createRadialGradient(cx, cx, 10, cx, cx, W / 2); glow.addColorStop(0, 'rgba(255,90,180,0.55)'); glow.addColorStop(0.5, 'rgba(176,58,255,0.18)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, W);
  g.strokeStyle = '#ffb0e0'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cx, 220, 0, TAU); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, 196, 0, TAU); g.stroke();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * 198, cx + Math.sin(a) * 198); g.lineTo(cx + Math.cos(a) * (i % 2 ? 210 : 218), cx + Math.sin(a) * (i % 2 ? 210 : 218)); g.stroke(); }
  g.fillStyle = '#ff5ab8'; g.strokeStyle = '#ffe0f0'; g.lineWidth = 5;
  const v = new Path2D(); v.moveTo(cx, cx + 150); v.lineTo(cx - 170, cx - 60); v.lineTo(cx - 60, cx - 10); v.lineTo(cx - 40, cx - 150); v.lineTo(cx, cx - 40); v.lineTo(cx + 40, cx - 150); v.lineTo(cx + 60, cx - 10); v.lineTo(cx + 170, cx - 60); v.closePath(); g.fill(v); g.stroke(v);
  const d = new Path2D(); d.moveTo(cx, cx - 90); d.lineTo(cx + 34, cx - 20); d.lineTo(cx, cx + 50); d.lineTo(cx - 34, cx - 20); d.closePath(); g.fillStyle = '#ffe8f4'; g.fill(d);
  return tex(c);
}

/* ---------- 얼굴: 실제 비율 · 무표정 · 노란빛 녹색 눈 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.07, 0.101, 0.089], jaw: 0.36, chin: 0.009 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#f9e2d8'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,248,244,0.55)'); gr.addColorStop(0.6, 'rgba(255,236,230,0)'); gr.addColorStop(1, 'rgba(190,135,140,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,140,0)'); cg.addColorStop(1, 'rgba(190,125,130,0.4)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
    g.save(); g.filter = 'blur(18px)'; g.fillStyle = 'rgba(240,120,140,0.16)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.036, Y.noseY + 0.006); g.beginPath(); g.ellipse(x, y, 70, 30, 0, 0, TAU); g.fill(); } g.restore();
  }
  paintFace(g, M, { ...Y, tilt: 0.1, lidDrop: 0.1, glow, open, iris: glow ? ['#f8ffc0', '#d8ff5a', '#9ad020', '#000'] : ['#f2ff9a', '#bcd83a', '#5a7a10', '#2a3a06'], pupil: '#1a2006', lash: '#2a0a14', brow: '#a8284a', lip: 'rgba(200,90,110,0.75)' });
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
  const glowC = pal.glow ?? PINK, key = pal.key || 'p', hc = pal.hair || ['#9a0c26', '#e83250', '#ff8aa0'];
  const line = hex(glowC);
  const M = {
    skin: phys({ color: 0xf9e0d6, emissive: 0x7a5250, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8d0) }),
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x6a5454, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8d0) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x6a5454, emissiveIntensity: 1, roughness: 0.5 }),
    eyeGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    hair: phys({ map: T('hair' + key, () => hairTex(false, ...hc)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xff9aa8), sheenRoughness: 0.35, emissive: 0x2a0408, emissiveIntensity: 0.5 }),
    hairCap: phys({ map: T('hairC' + key, () => hairTex(true, ...hc)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xff8a9a), sheenRoughness: 0.35, emissive: 0x2a0408, emissiveIntensity: 0.4 }),
    top: phys({ map: T('top' + key, () => topTex(false, line)), emissiveMap: T('topG' + key, () => topTex(true, line)), emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color(0xffd8d0) }),
    armor: phys({ color: 0x241a2c, metalness: 0.55, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.6, sheen: 0.4, sheenColor: new THREE.Color(0x8a4ad0) }),
    armorD: phys({ color: 0x15101a, metalness: 0.5, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.5 }),
    scale: phys({ map: T('scale', scaleTex), metalness: 0.4, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0x9a5ae0) }),
    suit: phys({ color: 0x120e16, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: new THREE.Color(0x6a4a8a) }),
    gold: phys({ color: 0xe8b860, metalness: 1, roughness: 0.25, clearcoat: 0.4 }),
    goldD: phys({ color: 0xb08440, metalness: 1, roughness: 0.34 }),
    gem: phys({ color: 0x6aff9a, emissive: EMER, emissiveIntensity: 1.0, roughness: 0.05, clearcoat: 1, flatShading: true }),
    ruby: phys({ color: 0xff7a4a, emissive: CINDER, emissiveIntensity: 1.0, roughness: 0.05, clearcoat: 1, flatShading: true }),
    crystal: phys({ color: 0xff8ad0, emissive: glowC, emissiveIntensity: 1.0, roughness: 0.05, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.92 }),
    neon: new THREE.MeshBasicMaterial({ color: glowC }),
    bladeBody: phys({ color: 0x1e1228, metalness: 0.85, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, emissive: VIOLET, emissiveIntensity: 0.12 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xffc8ec, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    tsuka: phys({ map: T('tsuka', tsukaTex), roughness: 0.6 }),
    claw: phys({ color: 0x2a1a34, metalness: 0.6, roughness: 0.25, clearcoat: 1, emissive: glowC, emissiveIntensity: 0.15 }),
    sigil: new THREE.MeshBasicMaterial({ map: T('sigil', sigilTex), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: glowC }),
  };
  M.gem.envMap = env; M.ruby.envMap = env; M.crystal.envMap = env;
  const noShadow = new Set([M.edge, M.eyeGlow, M.sigil]);
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = !noShadow.has(mat); me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const orient = (me, from, to) => { me.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3().subVectors(to, from).normalize()); me.position.copy(from); return me; };
  const coneG = (key, r, h) => C(key, () => { const g = new THREE.ConeGeometry(r, h, 8); g.translate(0, h / 2, 0); return g; });
  m.ropes = [];

  /* ---------- 골반(검은 수트) · 허리 · 가슴 갑주 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: 0.09 - 0.2 * v, rx: 0.116 + 0.022 * v - 0.03 * v ** 3, rzF: 0.084 - 0.01 * v ** 2, rzB: 0.098, n: 2.2 }), 32, 8)), M.suit);
  const bX = spl([[0, 0.112], [0.45, 0.086], [1, 0.102]]), bF = spl([[0, 0.078], [0.5, 0.066], [1, 0.075]]);
  const bellyMod = (p, u, v, c, sn) => { if (sn > 0) { p.z -= 0.002 * gauss(p.x, 0.006) * gauss(p.y - 0.03, 0.01); p.z += 0.0015 * gauss(Math.abs(p.x) - 0.03, 0.015) * sn; } };
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.15 }), 40, 12, { mod: bellyMod })), M.skin);
  const chX = spl([[0, 0.102], [0.3, 0.112], [0.55, 0.122], [0.8, 0.118], [1, 0.094]]), chF = spl([[0, 0.075], [0.5, 0.086], [1, 0.07]]), chB = spl([[0, 0.078], [0.6, 0.084], [1, 0.068]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.034 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 64, 24, { mod: chMod, uvU: 1 })), M.top);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.12 - 0.072 * v ** 0.8, rzF: 0.073 - 0.028 * v, rzB: 0.068 - 0.026 * v }), 40, 8)), M.skin);
  // 가슴 가운데 에메랄드 + 금 받침
  { const p = loftAt(chP, 0.5, 0.48, new V3(), chMod); const g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.006); J.chest.add(g);
    add(g, C('stGem', () => { const geo = new THREE.OctahedronGeometry(0.012, 0); geo.scale(0.8, 1.3, 0.6); return geo; }), M.gem);
    for (const s of [-1, 1]) add(g, C('stWing' + s, () => strand([[s * 0.006, 0.006, 0], [s * 0.02, 0.014, -0.004], [s * 0.034, 0.012, -0.012]], 0.003, 0.001, { seg: 10, rad: 5 })), M.gold); }
  // 가슴판 아래 검은 가시 판 (양옆으로 펼쳐진 용 비늘)
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const u0 = 0.5 + s * (0.04 + k * 0.055), v0 = 0.3 - k * 0.02;
    const geo = C(`ubSpk${s}${k}`, () => surf((u, v, p) => { const w = 0.016 * (1 - v), uu = u0 + s * (u - 0.5) * 0.04 * (1 - v); loftAt(chP, uu, v0 - 0.16 * v, p, chMod); const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.004 + 0.006 * v + w * 0.2); }, 4, 6));
    add(J.chest, geo, M.armorD);
  }

  /* ---------- 금 초커 · 검은 가시 펜던트 · 목 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.033 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.032 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.033 - 0.004 * v }), 20, 6)), M.skin);
  { const chP2 = (v) => ({ y: 0.028 + 0.016 * v, rx: 0.0345, rzF: 0.0335, rzB: 0.0345 });
    add(J.neck, C('choker', () => loft(chP2, 32, 2)), M.gold); lRim(J.neck, 'chkR0', chP2, 0, 0.0022, M.goldD); lRim(J.neck, 'chkR1', chP2, 1, 0.0022, M.goldD);
    const g = new THREE.Group(); g.position.set(0, 0.03, 0.036); g.rotation.x = 0.2; J.neck.add(g);
    const sh = new THREE.Shape(); sh.moveTo(0, 0.004); sh.lineTo(0.022, 0.01); sh.lineTo(0.008, -0.006); sh.lineTo(0.004, -0.03); sh.lineTo(0, -0.045); sh.lineTo(-0.004, -0.03); sh.lineTo(-0.008, -0.006); sh.lineTo(-0.022, 0.01); sh.closePath();
    add(g, C('pend', () => new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 1 })), M.armorD);
    add(g, C('pendGem', () => new THREE.OctahedronGeometry(0.005, 0)), M.crystal, [0, -0.012, 0.006]); }

  /* ---------- 어깨 갑주 · 팔(긴 장갑) · 손(발톱) ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    // 가시 돋친 어깨 갑주: 겹친 판 두 장 + 뒤로 뻗은 가시 셋 + 분홍 테
    for (let k = 0; k < 2; k++) {
      const pp = (v) => ({ y: 0.06 - k * 0.04 - 0.07 * v, rx: 0.066 + 0.012 * k + 0.024 * v, rz: 0.064 + 0.01 * k + 0.02 * v });
      const a0 = s > 0 ? 0.0 : 0.5, a1 = a0 + 0.5;
      add(sh, C(`pld${s}${k}`, () => loft(pp, 24, 5, { a0, a1 })), M.armor, [s * 0.01, 0, 0]);
      rim(sh, `pldR${s}${k}`, loftRing(pp, 1, { a0, a1, n: 24 }).map((q) => q.add(new V3(s * 0.01, 0, 0))), 0.0032, false, M.neon);
    }
    for (const [dy, dz, ax, len] of [[0.05, -0.04, 0.9, 0.12], [0.02, -0.06, 1.3, 0.1], [0.07, 0.0, 0.45, 0.07]]) {
      const base = new V3(s * 0.075, dy, dz), tip = base.clone().add(new V3(s * 0.05, len * Math.cos(ax), -len * Math.sin(ax)));
      add(sh, C(`pSpk${s}${len}`, () => strand([base, base.clone().lerp(tip, 0.5).add(new V3(s * 0.012, 0.01, 0)), tip], 0.014, 0.001, { seg: 10, rad: 6, flat: 0.45, ref: [0, 0, 1] })), M.armorD);
    }
    // 위팔: 살 + 팔꿈치 위까지 오는 장갑 윗단 (분홍 테)
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.042 - 0.009 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.04 - 0.008 * v }), 24, 10)), M.skin);
    const gvP = (v) => ({ y: -0.12 - (DIMS.uArm - 0.12 + 0.02) * v, rx: 0.039 - 0.004 * v, rz: 0.037 - 0.004 * v });
    add(sh, C('gloveU', () => loft(gvP, 24, 6)), M.suit); lRim(sh, 'gvR', gvP, 0, 0.003, M.neon);
    // 앞팔 갑주: 팔꿈치에서 나팔처럼 벌어진 판 → 손목으로 좁아짐 + 바깥쪽 겹친 판 셋
    const faP = (v) => ({ y: 0.03 - (DIMS.lArm + 0.0) * v, rx: 0.046 - 0.012 * v + 0.006 * (1 - smooth(0, 0.25, v)), rz: 0.044 - 0.011 * v + 0.006 * (1 - smooth(0, 0.25, v)) });
    add(el, C('farm', () => loft(faP, 28, 10)), M.armor); lRim(el, 'faR0', faP, 0, 0.0032, M.neon);
    for (let k = 0; k < 3; k++) {
      const v0 = 0.12 + k * 0.27, pl = (v) => { const q = faP(v0 + 0.3 * v); return { ...q, rx: q.rx + 0.006, rz: q.rz + 0.006 }; };
      const a0 = s > 0 ? 0.08 : 0.58, a1 = a0 + 0.34;
      add(el, C(`faPl${s}${k}`, () => loft(pl, 14, 4, { a0, a1 })), M.armorD);
      rim(el, `faPlR${s}${k}`, loftRing(pl, 1, { a0, a1, n: 14 }), 0.0022, false, M.neon);
    }
    // 팔꿈치 가시 (뒤쪽)
    add(el, C('elSpk', () => strand([[0, 0.02, -0.036], [0, 0.04, -0.07], [0, 0.07, -0.1]], 0.016, 0.001, { seg: 10, rad: 6, flat: 0.5, ref: [1, 0, 0] })), M.armorD);
    // 손목 분홍 결정
    add(el, C('wristGem', () => { const g = new THREE.OctahedronGeometry(0.011, 0); g.scale(0.7, 1.4, 0.5); return g; }), M.crystal, [s * 0.034, -DIMS.lArm + 0.04, 0.012], [0, 0, s * 0.2]);
    // 손: 갑주 장갑 · 발톱 손끝
    const hg = new THREE.Group(); hg.scale.setScalar(0.86); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.021 + 0.003 * Math.sin(v * Math.PI), rz: 0.034 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.suit);
    add(hg, C('hback' + s, () => loft((v) => ({ y: 0.008 - 0.06 * v, rx: 0.024, rz: 0.037, n: 3, cx: s * 0.018 }), 18, 4, { a0: s > 0 ? 0.05 : 0.55, a1: s > 0 ? 0.45 : 0.95 })), M.armor);
    add(hg, C('hGem' + s, () => { const g = new THREE.OctahedronGeometry(0.009, 0); g.scale(0.6, 1.2, 0.8); return g; }), M.crystal, [s * 0.043, -0.03, 0.0]);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.25 + k * 0.1 : 2.6;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0082, 0.0062, { seg: 14, rad: 8 })), M.suit);
      const tip = pts[8], dir = pts[8].clone().sub(pts[7]).normalize();
      orient(add(hg, coneG('claw', 0.0058, 0.02), M.claw), tip.clone().addScaledVector(dir, -0.003), tip.clone().addScaledVector(dir, 1));
    }
    const th = [[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]].map((q) => new V3(...q));
    add(hg, C('thumb' + s, () => strand(th, 0.0096, 0.007, { seg: 12, rad: 8 })), M.suit);
    { const d = th[3].clone().sub(th[2]).normalize(); orient(add(hg, coneG('clawT', 0.0065, 0.02), M.claw), th[3].clone().addScaledVector(d, -0.003), th[3].clone().addScaledVector(d, 1)); }
  }

  /* ---------- 다리: 맨 허벅지 · 무릎 덮개가 솟은 정강이 갑주 · 용 발톱 부츠 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.088], [0.4, 0.078], [0.85, 0.056], [1, 0.053]]), thF = spl([[0, 0.084], [0.5, 0.07], [1, 0.054]]), thB = spl([[0, 0.086], [0.35, 0.076], [1, 0.049]]);
    add(hp, C('thigh', () => loft((v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) }), 28, 12)), M.skin);
    // 정강이 갑주: 무릎 위에서 시작해 발목으로 좁아짐 (앞 능선 분홍 발광)
    const cX = spl([[0, 0.058], [0.3, 0.061], [0.75, 0.042], [1, 0.037]]), cF = spl([[0, 0.06], [0.5, 0.05], [1, 0.04]]), cB = spl([[0, 0.058], [0.3, 0.074], [0.7, 0.048], [1, 0.04]]);
    const gP = (v) => ({ y: 0.05 - (DIMS.shin + 0.0) * v, rx: cX(v), rzF: cF(v), rzB: cB(v), n: 2.1 });
    const gMod = (p, u, v, c, sn) => { if (sn > 0) p.z += 0.01 * gauss(p.x, 0.012) * sn; };
    add(kn, C('greave', () => loft(gP, 28, 14, { mod: gMod })), M.armor);
    lRim(kn, 'grTop', gP, 0, 0.003, M.neon, { mod: gMod });
    { const pts = []; for (let i = 0; i <= 12; i++) { const q = loftAt(gP, 0.5, 0.08 + 0.85 * (i / 12), new V3(), gMod); q.z += 0.002; pts.push(q); } rim(kn, 'grRidge', pts, 0.0028, false, M.neon); }
    // 무릎 덮개: 앞으로 솟은 뾰족한 판 (허벅지 쪽으로 올라감)
    add(kn, C('kneeCap', () => surf((u, v, p) => { const w = 0.05 * (1 - 0.85 * v ** 1.4), a = (u - 0.5) * 2; p.set(a * w, -0.06 + 0.2 * v, 0.06 + 0.012 * Math.sin(v * Math.PI) - 0.03 * a * a + 0.012 * v); }, 8, 10)), M.armorD);
    { const pts = []; for (let i = 0; i <= 10; i++) { const v = i / 10, w = 0.05 * (1 - 0.85 * v ** 1.4); pts.push(new V3(w, -0.06 + 0.2 * v, 0.06 + 0.012 * Math.sin(v * Math.PI) - 0.03 + 0.012 * v + 0.002)); } rim(kn, 'kcL', pts, 0.0024, false, M.neon); rim(kn, 'kcR', pts.map((q) => new V3(-q.x, q.y, q.z)), 0.0024, false, M.neon); }
    // 바깥쪽 날개 판 (정강이 옆에서 뒤로 뻗음)
    add(kn, C('shFin' + s, () => strand([[s * 0.05, -0.03, 0.0], [s * 0.075, 0.02, -0.04], [s * 0.08, 0.08, -0.09]], 0.018, 0.001, { seg: 12, rad: 6, flat: 0.3, ref: [1, 0, 0] })), M.armorD);
    // 부츠: 굽 높은 갑주 발 (뒤꿈치 -0.02 · 앞꿈치 -0.075)
    const fw = spl([[0, 0.0], [0.06, 0.028], [0.25, 0.036], [0.6, 0.04], [0.85, 0.032], [1, 0.008]]), fh = spl([[0, 0.028], [0.08, 0.058], [0.3, 0.062], [0.6, 0.038], [0.85, 0.026], [1, 0.012]]);
    const fb = (v) => -0.075 + 0.054 * (1 - smooth(0.3, 0.72, v));
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb(v) + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.058 + 0.23 * v); };
    add(ft, C('boot', () => surf(foot, 28, 20, { closedU: true })), M.armor);
    add(kn, C('ankle', () => loft((v) => ({ y: -DIMS.shin + 0.05 - 0.07 * v, rx: 0.038 + 0.006 * v, rz: 0.04 + 0.008 * v }), 16, 4)), M.armor);
    // 발등 판 + 분홍 테
    add(ft, C('instep', () => surf((u, v, p) => { const a = (u - 0.5) * 2, vv = 0.25 + 0.55 * v, q = new V3(); foot(0.5 + a * 0.2, vv, q); p.copy(q); p.y += 0.006; }, 6, 8)), M.armorD);
    // 앞 발톱 셋 (아래로 휘어 땅을 움켜쥔다) · 뒤 며느리발톱 · 굽 발톱
    for (const k of [-1, 0, 1]) {
      const x0 = k * 0.02, pts = [new V3(x0, fb(0.9) + 0.012, 0.13), new V3(x0 * 1.4, fb(1) + 0.012, 0.19), new V3(x0 * 1.6, -0.07, 0.23 - Math.abs(k) * 0.015), new V3(x0 * 1.7, -0.086, 0.24 - Math.abs(k) * 0.02)];
      add(ft, C('toeClaw' + k, () => strand(pts, 0.011, 0.0012, { seg: 14, rad: 7 })), M.claw);
    }
    add(ft, C('spur', () => strand([[0, -0.02, -0.05], [0, -0.035, -0.085], [0, -0.06, -0.11], [0, -0.084, -0.12]], 0.012, 0.0012, { seg: 12, rad: 7 })), M.claw);
    add(ft, C('heelClaw', () => strand([[0, -0.03, -0.035], [0, -0.06, -0.038], [0, -0.086, -0.034]], 0.011, 0.002, { seg: 8, rad: 7 })), M.claw);
  }

  /* ---------- 갑주 벨트 · 앞 가리개 · 들쭉날쭉한 용비늘 허리 갑주 · 분홍 날개칼 ---------- */
  const beltP = (v) => ({ y: 0.015 + 0.05 * v, rx: 0.142 - 0.004 * v, rzF: 0.105, rzB: 0.112, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 56, 3)), M.armor); lRim(J.hips, 'beltR0', beltP, 0, 0.003, M.gold); lRim(J.hips, 'beltR1', beltP, 1, 0.003, M.gold);
  { const p = loftAt(beltP, 0.5, 0.5, new V3()); const g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.004); J.hips.add(g);
    const sh = new THREE.Shape(); sh.moveTo(0, 0.034); sh.lineTo(0.03, 0); sh.lineTo(0, -0.04); sh.lineTo(-0.03, 0); sh.closePath();
    add(g, C('buckle', () => new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 })), M.gold);
    add(g, C('buckleGem', () => { const geo = new THREE.OctahedronGeometry(0.017, 0); geo.scale(0.9, 1.25, 0.55); return geo; }), M.gem, [0, -0.002, 0.01]); }
  // 다리를 따라 흔들리는 판: { g, az, w(왼다리 가중), flare }
  m.plates = [];
  const plate = (key, az, y0, geo, mat, flare, rimPts, rimMat = M.neon) => {
    const g = new THREE.Group(); g.rotation.order = 'YXZ'; const p = loftAt(beltP, az, 0.2, new V3()), n = new V3(p.x, 0, p.z).normalize();
    g.position.set(p.x + n.x * 0.004, y0, p.z + n.z * 0.004); g.rotation.y = Math.atan2(n.x, n.z); J.hips.add(g);
    add(g, geo, mat); if (rimPts) rim(g, key + 'R', rimPts, 0.0026, false, rimMat);
    const a = Math.atan2(n.x, n.z); m.plates.push({ g, a, flare, wl: clamp(0.5 + Math.sin(a) * 0.9, 0, 1) }); return g;
  };
  // 비늘 판 모양: 위가 넓고 아래로 뾰족 (가운데가 볼록) — 판 로컬: x 옆, y 아래로 -, z 바깥
  const shard = (w, len, tips = 1, bend = 0.04) => (u, v, p) => { const a = (u - 0.5) * 2, tipK = tips > 1 ? 1 - 0.35 * Math.abs(Math.sin(a * Math.PI * tips * 0.5 + Math.PI * 0.5 * (tips % 2))) * v : 1, ww = w * (1 - v ** 1.3) * tipK + w * 0.05 * (1 - v);
    p.set(a * ww, -len * v * (1 - 0.08 * a * a * v) - len * 0.25 * (1 - Math.abs(a)) * v * v * (tips > 1 ? 0 : 1) * 0.3, 0.008 * (1 - a * a) + bend * v * v); };
  const shardRim = (w, len, tips, bend) => { const f = shard(w, len, tips, bend), pts = []; for (let i = 0; i <= 10; i++) { const p = new V3(); f(0, i / 10, p); p.z += 0.003; pts.push(p); } for (let i = 10; i >= 0; i--) { const p = new V3(); f(1, i / 10, p); p.z += 0.003; pts.push(p); } return pts; };
  // 앞 가리개: 벨트 아래 가운데 (뾰족한 밑단 · 분홍 테)
  { const fl = (u, v, p) => { const a = (u - 0.5) * 2, w = 0.085 - 0.03 * v; p.set(a * w, -0.36 * v - 0.06 * (1 - Math.abs(a) ** 1.5) * smooth(0.8, 1, v) * 1.6 + 0.04 * Math.abs(a) * smooth(0.85, 1, v), 0.01 - 0.03 * a * a + 0.012 * v); };
    const pts = []; for (let i = 0; i <= 14; i++) { const p = new V3(); fl(i / 14, 1, p); p.z += 0.003; pts.push(p); }
    const fg = new THREE.Group(); fg.position.set(0, 0.0, 0.112); J.hips.add(fg); m.flapG = fg;
    add(fg, C('flap', () => surf(fl, 10, 14)), M.scale); rim(fg, 'flapHem', pts, 0.003, false, M.neon);
    for (const sd of [0, 1]) { const e = []; for (let i = 0; i <= 12; i++) { const p = new V3(); fl(sd, i / 12, p); p.z += 0.003; e.push(p); } rim(fg, 'flapE' + sd, e, 0.0025, false, M.goldD); }
    add(fg, C('flapGem', () => { const g = new THREE.OctahedronGeometry(0.01, 0); g.scale(0.7, 1.4, 0.5); return g; }), M.gem, [0, -0.2, 0.02]); }
  // 용비늘 조각: 위 단(짧음) · 아래 단(긺) — 옆 · 뒤 (앞은 비움)
  for (let k = 0; k < 11; k++) {
    const t = k / 10, az = 0.08 + t * 0.84; if (Math.abs(az - 0.5) < 0.1) continue;
    const front = Math.abs(az - 0.5) < 0.2, len = (front ? 0.24 : 0.36) + 0.06 * Math.sin(k * 2.3), w = 0.065;
    plate('scL' + k, az, 0.0, C('scL' + k, () => surf(shard(w, len, 3, 0.05), 8, 10)), M.scale, 0.22 + (front ? 0.1 : 0), shardRim(w, len, 3, 0.05));
  }
  for (let k = 0; k < 9; k++) {
    const t = k / 8, az = 0.04 + t * 0.92 + 0.05; if (Math.abs(az - 0.5) < 0.16) continue;
    const len = 0.17 + 0.03 * Math.cos(k * 1.7), w = 0.07;
    plate('scU' + k, az, 0.03, C('scU' + k, () => surf(shard(w, len, 1, 0.03), 6, 8)), M.armor, 0.42, shardRim(w, len, 1, 0.03));
  }
  // 분홍 날개칼: 허리 양옆에서 발목까지 (검은 테두리 · 분홍 안쪽 · 위쪽 에메랄드)
  for (const s of [-1, 1]) for (const [az, len, fl] of [[0.33, 0.82, 0.2], [0.15, 0.7, 0.28]]) {
    const a = s > 0 ? az : 1 - az, w = 0.05;
    const bf = (u, v, p) => { const x = (u - 0.5) * 2, ww = w * (1 - v ** 2.2) + 0.003; p.set(x * ww, -len * v, 0.006 * (1 - x * x) + 0.03 * v); };
    const g = plate('wb' + s + az, a, 0.02, C('wb' + az, () => surf(bf, 6, 24)), M.armorD, fl, null);
    // 분홍 안쪽 날 (얇게 앞으로 띄운 면)
    add(g, C('wbIn' + az, () => surf((u, v, p) => { bf(0.25 + u * 0.5, 0.06 + v * 0.88, p); p.z += 0.0035; }, 4, 22)), M.neon);
    add(g, C('wbGem', () => { const geo = new THREE.OctahedronGeometry(0.011, 0); geo.scale(0.8, 1.3, 0.5); return geo; }), M.gem, [0, -0.04, 0.01]);
    add(g, C('wbCap', () => strand([[-0.045, 0.005, 0.006], [0, -0.012, 0.012], [0.045, 0.005, 0.006]], 0.008, 0.008, { seg: 10, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.gold);
  }

  /* ---------- 머리: 얼굴 · 엘프 귀 · 머리카락 · 용뿔 · 서클릿 ---------- */
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.1);
  m.eyeGlow = add(H, headGeo, M.eyeGlow, [0, 0, 0], [0, 0, 0], [1.002, 1.002, 1.002]); m.eyeGlow.renderOrder = 5;
  // 길고 뾰족한 엘프 귀 (뒤 · 위로)
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.066, 0.098, -0.004], [s * 0.078, 0.104, -0.014], [s * 0.098, 0.122, -0.03], [s * 0.124, 0.146, -0.048]], 0.014, 0.0012, { seg: 12, rad: 8, flat: 0.32, ref: [s, 0.3, 0] })), M.skin);
  {
    const lineF = (az) => { const w = Math.cos(az); return w > 0 ? 0.16 + 0.36 * w * w : 0.16 - 0.95 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = lineF(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.008 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(19), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), M.hair);
    // 앞머리: 가운데 가르마 → 양옆으로 흘러내림 (이마의 서클릿이 보이게)
    for (let k = 0; k < 18; k++) {
      const t = k / 17, sd = t < 0.5 ? 1 : -1, az = (t - 0.5) * 2.0 + sd * 0.07 + (r() - 0.5) * 0.04, side = Math.abs(az), tipEl = 0.2 - 0.06 * r() - 0.35 * smooth(0.45, 1.0, side) + 0.12 * (1 - smooth(0.05, 0.3, side)), sweep = sd * 0.16 * (1 - side * 0.4);
      const pts = [headAt(sd * 0.08 + az * 0.25, 1.18, 0.02), headAt(az * 0.7 + sweep * 0.3, 0.82, 0.03), headAt(az * 0.92 + sweep * 0.7, 0.52, 0.03), headAt(az + sweep, (0.52 + tipEl) / 2, 0.025), headAt(az + sweep * 1.3, tipEl, 0.012)];
      const d = dirOf(az, 0.5); clump('bang' + k, pts, (k % 2 ? 0.026 : 0.034) + r() * 0.008, 0.0015, 0.22, [d.x, d.y, d.z]);
    }
    // 얼굴 옆 긴 머리 (귀 앞 → 가슴까지)
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const az = s * (1.05 + k * 0.16), pts = [headAt(az * 0.92, 0.75, 0.018), headAt(az, 0.2, 0.02), headAt(az * 1.02, -0.4, 0.028), headAt(az * 1.06, -0.9, 0.05 + k * 0.01), new V3(s * (0.085 + k * 0.012), -0.06 - k * 0.025, 0.035 - k * 0.02)];
      const d = dirOf(az, 0); clump(`side${s}${k}`, pts, 0.03, 0.004, 0.24, [d.x, 0, d.z]);
    }
    // 뒷머리 위쪽 덩어리
    for (let k = 0; k < 18; k++) {
      const az = Math.PI + (k - 8.5) * 0.21, pts = [headAt(az, 0.75, 0.016), headAt(az + (r() - 0.5) * 0.12, 0.0, 0.024), headAt(az + (r() - 0.5) * 0.18, -0.65, 0.02), headAt(az, -0.95, 0.03)];
      const d = dirOf(az, 0); clump('back' + k, pts, 0.042, 0.02, 0.26, [d.x, 0, d.z]);
    }
    // 무릎까지 흘러내리는 긴 머리: 뒤 9가닥 + 앞으로 내린 2가닥 (로프 물리 · 납작한 리본 관 · 물결)
    const locks = [...[-1.1, -0.82, -0.55, -0.27, 0, 0.27, 0.55, 0.82, 1.1].map((d) => [Math.PI + d, -0.5 + 0.12 * Math.abs(d), 13 - Math.round(Math.abs(d) * 1.6)]), [1.32, -0.6, 9], [-1.32, -0.6, 9]];
    locks.forEach(([az, el, n], i) => {
      const front = i >= 9, rope = new Rope(n, 0.066, { damp: 0.978, stiff: 0.06 }), ph = i * 1.9, wide = front ? 0.032 : 0.054;
      const view = new RopeTube(rope, M.hair, { sub: 3, rad: 12, uvV: 2, flat: 0.28, side: new V3(1, 0, 0),
        prof: (v) => wide * (v < 0.05 ? 0.8 : 1 - 0.5 * v) * (v > 0.88 ? 1 - (v - 0.88) * 6.5 : 1),
        wave: (v) => 0.016 * Math.sin(v * TAU * 1.2 + ph) * smooth(0.1, 0.5, v) });
      const local = headAt(az, el, 0.022), sideL = new V3(Math.cos(az), 0, -Math.sin(az)), rest = front ? new V3(Math.sin(az) * 0.3, -1, 0.4).normalize() : new V3(Math.sin(az) * 0.3, -0.8, -0.55).normalize();
      m.ropes.push({ rope, view, joint: H, local, rest, sideL });
    });
  }
  // 검은 용뿔 장식: 머리 양옆에서 위 · 뒤로 휨 (끝 분홍 발광)
  for (const s of [-1, 1]) {
    const b = headAt(s * 1.25, 0.72, 0.012), pts = [b, b.clone().add(new V3(s * 0.018, 0.03, -0.012)), b.clone().add(new V3(s * 0.026, 0.07, -0.04)), b.clone().add(new V3(s * 0.02, 0.095, -0.08)), b.clone().add(new V3(s * 0.008, 0.1, -0.11))];
    add(H, C('horn' + s, () => strand(pts, 0.012, 0.0012, { seg: 20, rad: 8, ease: (v) => v ** 0.8 })), M.armorD);
    add(H, C('hornT' + s, () => { const g = new THREE.ConeGeometry(0.0042, 0.026, 6); g.translate(0, 0.013, 0); return g; }), M.neon).quaternion.setFromUnitVectors(new V3(0, 1, 0), pts[4].clone().sub(pts[3]).normalize());
    H.children[H.children.length - 1].position.copy(pts[3].clone().lerp(pts[4], 0.35));
    add(H, C('hornB' + s, () => strand([headAt(s * 1.3, 0.62, 0.012), headAt(s * 1.45, 0.65, 0.026), headAt(s * 1.6, 0.6, 0.032)], 0.008, 0.0012, { seg: 10, rad: 6 })), M.armorD);
  }
  // 이마 서클릿: 금 마름모 + 주홍 보석 + 관자놀이로 뻗는 금 선
  { const p0 = headAt(0, 0.6, 0.03), n0 = headN(p0); const g = new THREE.Group(); g.position.copy(p0); g.lookAt(p0.clone().add(n0)); H.add(g);
    const dia = (o, i) => { const sh = new THREE.Shape(); sh.moveTo(0, o * 1.25); sh.lineTo(o, 0); sh.lineTo(0, -o * 1.1); sh.lineTo(-o, 0); sh.closePath(); const hl = new THREE.Path(); hl.moveTo(0, i * 1.25); hl.lineTo(-i, 0); hl.lineTo(0, -i * 1.1); hl.lineTo(i, 0); hl.closePath(); sh.holes.push(hl); return sh; };
    add(g, C('circDia', () => new THREE.ExtrudeGeometry(dia(0.017, 0.011), { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1 })), M.gold);
    add(g, C('circDia2', () => new THREE.ExtrudeGeometry(dia(0.0085, 0.0055), { depth: 0.003, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 })), M.gold, [0, 0.0, 0.001]);
    add(g, C('circGem', () => { const geo = new THREE.OctahedronGeometry(0.0065, 0); geo.scale(1, 1.3, 0.6); return geo; }), M.ruby, [0, 0, 0.004]);
    for (const s of [-1, 1]) add(g, C('circW' + s, () => strand([[s * 0.015, 0.004, 0], [s * 0.025, 0.013, -0.003], [s * 0.03, 0.022, -0.007]], 0.0022, 0.0006, { seg: 10, rad: 5 })), M.gold);
    for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(headAt(s * (0.26 + 0.85 * t), 0.6 + 0.05 * t, 0.03 - 0.008 * t)); } rim(H, 'circL' + s, pts, 0.0024, false, M.gold); } }

  /* ---------- 무기: 검보라 장검 ---------- */
  const sword = new THREE.Group(); J.weapon.add(sword); m.sword = sword;
  {
    const X = [Math.PI / 2, 0, 0];
    add(sword, C('kt:tsuka', () => { const g = loft((v) => ({ y: KT.pommel + 0.012 + (0.02 - KT.pommel - 0.012) * v, rx: 0.013 + 0.001 * Math.sin(v * Math.PI), rz: 0.016 + 0.001 * Math.sin(v * Math.PI) }), 16, 8, { uvV: 1 }); g.rotateX(Math.PI / 2); return g; }), M.tsuka);
    add(sword, C('kt:pommel', () => lathe([[0.016, 0], [0.019, -0.01], [0.012, -0.024], [0.005, -0.04], [0, -0.052]], 16)), M.armorD, [0, 0, KT.pommel + 0.012], X);
    add(sword, C('kt:pomGem', () => new THREE.OctahedronGeometry(0.008, 0)), M.crystal, [0, 0, KT.pommel - 0.012]);
    // 코등이: 양옆으로 펼친 용 날개 가시 + 가운데 에메랄드
    add(sword, C('kt:guard', () => { const g = lathe([[0.012, -0.012], [0.026, -0.006], [0.03, 0.004], [0.02, 0.014], [0.012, 0.018]], 16); g.rotateX(Math.PI / 2); return g; }), M.armor, [0, 0, KT.guard]);
    for (const s of [-1, 1]) {
      add(sword, C('kt:wing' + s, () => strand([[0, s * 0.02, KT.guard], [0.004, s * 0.06, KT.guard - 0.01], [0.002, s * 0.09, KT.guard - 0.04], [0, s * 0.1, KT.guard - 0.075]], 0.009, 0.0012, { seg: 16, rad: 6, flat: 0.45, ref: [1, 0, 0] })), M.armorD);
      add(sword, C('kt:wing2' + s, () => strand([[0, s * 0.03, KT.guard], [0, s * 0.055, KT.guard + 0.02], [0, s * 0.06, KT.guard + 0.05]], 0.006, 0.001, { seg: 12, rad: 6, flat: 0.45, ref: [1, 0, 0] })), M.armorD);
      add(sword, C('kt:wingN' + s, () => strand([[0.003, s * 0.03, KT.guard - 0.004], [0.006, s * 0.06, KT.guard - 0.014], [0.005, s * 0.085, KT.guard - 0.042]], 0.0022, 0.0008, { seg: 12, rad: 4 })), M.neon);
    }
    add(sword, C('kt:gGem', () => { const g = new THREE.OctahedronGeometry(0.013, 0); g.scale(0.55, 1.0, 1.4); return g; }), M.gem, [0, 0, KT.guard + 0.006]);
    // 칼날: 가늘고 곧은 검보라 날 (날 쪽 분홍 빛줄 · 에메랄드 상감) · 뾰족한 칼끝
    const bw = (v) => 0.022 - 0.006 * v;
    add(sword, C('kt:blade', () => surf((u, v, p) => { const z = KT.guard + 0.025 + (KT.tip - KT.guard - 0.025) * v, w = bw(v), tipK = smooth(0.9, 1, v), cy = -0.012 * v * v, t = u * TAU, ex = Math.sin(t), ey = Math.cos(t);
      const up = w * (1 - tipK * 0.96), dn = 0.006 * (1 - tipK); p.set(ex * 0.0034 * (1 - tipK * 0.7), cy + (ey > 0 ? ey * up : ey * dn) - w * 0.4 * (1 - tipK), z + tipK * 0.025 * ey); }, 12, 44, { closedU: true })), M.bladeBody);
    add(sword, C('kt:edge', () => { const pts = []; for (let i = 0; i <= 32; i++) { const v = i / 32, w = bw(v), tipK = smooth(0.9, 1, v); pts.push(new V3(0, -0.012 * v * v + w * (1 - tipK * 0.96) - w * 0.4 * (1 - tipK), KT.guard + 0.025 + (KT.tip - KT.guard - 0.025) * v + tipK * 0.02)); } return strand(pts, 0.0018, 0.0006, { seg: 64, rad: 5 }); }), M.edge);
    for (const sd of [-1, 1]) add(sword, C('kt:fuller' + sd, () => { const pts = []; for (let i = 0; i <= 20; i++) { const v = 0.04 + 0.8 * (i / 20); pts.push(new V3(sd * 0.0036, -0.012 * v * v + 0.0, KT.guard + 0.025 + (KT.tip - KT.guard - 0.025) * v)); } return strand(pts, 0.0013, 0.0008, { seg: 40, rad: 4, flat: 0.4, ref: [1, 0, 0] }); }), M.neon);
    for (const v of [0.12, 0.42]) for (const sd of [-1, 1]) add(sword, C('kt:inlay', () => { const g = new THREE.OctahedronGeometry(0.0045, 0); g.scale(0.35, 1, 2.2); return g; }), M.gem, [sd * 0.0035, -0.012 * v * v, KT.guard + 0.025 + (KT.tip - KT.guard - 0.025) * v]);
  }

  /* ---------- 암룡의 낙인 문장 (등 뒤에 떠오름) ---------- */
  m.sigil = add(J.chest, C('sigil', () => new THREE.PlaneGeometry(0.62, 0.62)), M.sigil, [0, 0.13, -0.3], [0, Math.PI, 0]); m.sigil.renderOrder = 9; m.sigil.visible = false;

  /* ---------- 로프 (머리카락) ---------- */
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion(), lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 };
  m.glow = 0; m.brand = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, G = f.G;
    lag.vL += ((J.hipL.rotation.x - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 8) - lag.sw) * (1 - Math.exp(-dt * 10));
    // 앞 가리개 · 비늘 판 · 날개칼: 다리 각도(앞뒤)에 따라 젖혀짐
    m.flapG.rotation.x = Math.min(0, Math.min(lag.L, lag.R)) * 0.8 - lag.sw * 0.15;
    const zL = -Math.sin(clamp(lag.L, -1.5, 1.5)), zR = -Math.sin(clamp(lag.R, -1.5, 1.5));
    for (const p of m.plates) { const legZ = p.wl * zL + (1 - p.wl) * zR, c = Math.cos(p.a), push = Math.max(0, legZ * c) * 0.95 + Math.max(0, -legZ * c) * 0.25;
      p.g.rotation.x = -(p.flare + push + lag.sw * 0.2 * Math.max(0, -c) + 0.04 * Math.sin(G.time * 2 + p.a * 3)); }
    // 머리카락 로프 (몸통은 어깨 높이까지만 · 머리는 구 하나)
    const h0 = f.hurt[0], hcW = H.localToWorld(tmp2.copy(HC)), capsBody = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.62 + 0.05 * f.scale }, { a: hcW, b: hcW, r: 0.106 * f.scale }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * f.scale }))];
    const wind = new V3(-f.vel.x * 0.6 + Math.sin(G.time * 1.3) * 0.8, 0, -f.vel.z * 0.6 + Math.cos(G.time * 1.1) * 0.8); H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); r.view.side.copy(r.sideL).applyQuaternion(hq);
      r.rope.step(dt, tmp, capsBody, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = vis;
    }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    // 발광: 기술 중 업화(f.flameK) · 낙인 버프(f.brandT)
    const want = Math.max(f.flameK || 0, f.brandT > 0 ? 0.75 : 0.15); m.glow += (want - m.glow) * Math.min(1, dt * 8);
    m.brand += ((f.brandT > 0 ? 1 : 0) - m.brand) * Math.min(1, dt * 5);
    const pulse = 0.88 + 0.12 * Math.sin(G.time * 6);
    M.eyeGlow.opacity = (0.3 + m.glow * 0.55) * pulse; M.edge.opacity = 0.55 + m.glow * 0.45; M.bladeBody.emissiveIntensity = 0.1 + m.glow * 0.6 * pulse;
    M.neon.color.setHex(glowC).multiplyScalar(0.75 + 0.35 * m.glow * pulse); M.crystal.emissiveIntensity = 0.8 + m.glow * 1.2; M.claw.emissiveIntensity = 0.12 + m.glow * 0.4;
    M.sigil.opacity = m.brand * (0.7 + 0.3 * Math.sin(G.time * 4)); m.sigil.visible = vis && m.brand > 0.02; m.sigil.rotation.z = G.time * 0.6; m.sigil.scale.setScalar(0.85 + 0.15 * m.brand);
    // 칼날 업화: 기술 중 분홍 불길이 칼날을 따라 피어오른다
    if (vis && sword.visible && m.glow > 0.3) { const n = Math.random() < m.glow ? 2 : 1; for (let i = 0; i < n; i++) { const v = Math.random(); J.weapon.localToWorld(tmp.set(0, 0.01, KT.guard + 0.05 + (KT.tip - KT.guard - 0.05) * v));
      G.fx.p(tmp, { vel: [(Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6], size: 0.07 + Math.random() * 0.08 * m.glow, size1: 0.01, life: 0.3 + Math.random() * 0.2, color: Math.random() < 0.6 ? glowC : Math.random() < 0.5 ? VIOLET : HOTP, alpha: 0.85, drag: 1.5 }); } }
  };
  m.setWeapon = (v) => { sword.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.086;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.1)); J.weapon.localToWorld(t.set(0, 0, KT.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.32)); J.weapon.localToWorld(t.set(0, 0, KT.tip)); };
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, KT.tip)); };
  m.extras = extras;
  return m;
}
