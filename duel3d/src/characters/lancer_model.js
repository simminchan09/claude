// 세라 (LANCER · 수호 사제) — 3D 모델 (기술·포즈는 lancer.js)
// 성스러운 빛의 창을 든 수호 사제.
//
// 구성: 일자 앞머리 · 턱선까지 오는 옆머리 · 짧은 뒷머리 · 귀 뒤에서 땋아 내린 금발 두 갈래(로프 물리) · 보라색 눈
//       검은 하이칼라 원피스 · 흰·은 판금 흉갑(짙은 강철 테 · 덩굴 장식 · 호박색 보석) · 등판
//       칼날처럼 뻗은 날개깃이 달린 겹친 어깨 갑주 · 팔꿈치가 뾰족한 건틀릿 · 검은 장갑 + 흰 손등판
//       검은 짧은 치마(다리를 따라 출렁임) · 옆 허벅지 판 · 흰 긴 자락(뒤·왼쪽 / 앞 오른쪽, 천 물리, 짙은 테 · 점 격자 · 주황 마름모 징)
//       왼쪽 앞의 높은 트임 · 검은 니삭스 · 무릎 갑주(호박색 징) · 흰 판금 장화
//       무기: 짙은 강철 자루 · 은빛 십자(네 갈래 별) 창머리 + 푸른 고리 · 긴 은빛 창날 (성광이 차오르면 금빛으로 빛난다)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.9, spineL: 0.18, chestL: 0.25, neckL: 0.07, shW: 0.18, uArm: 0.27, lArm: 0.245, hipW: 0.088, thigh: 0.44, shin: 0.42, headTop: 0.25 };
// 창 치수 (오른손 기준 +Z, m)
export const LN = { butt: -0.72, socket: 1.12, ring: 1.21, guard: 1.3, bladeStart: 1.36, tip: 2.02, grip2: 0.48 };
export const HOLY = 0xffc84a, HOLY2 = 0xfff0b0, AMBER = 0xff9a2a, RINGB = 0x3a7aff;
const C = (k, fn) => cached('lancer:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function diamond(g, x, y, w, h, fill, hi) { g.fillStyle = fill; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w, y); g.lineTo(x, y + h); g.lineTo(x - w, y); g.closePath(); g.fill(); if (hi) { g.fillStyle = hi; g.beginPath(); g.moveTo(x, y - h * 0.6); g.lineTo(x + w * 0.45, y - h * 0.05); g.lineTo(x, y + h * 0.1); g.lineTo(x - w * 0.3, y - h * 0.1); g.closePath(); g.fill(); } }
// 금발 결 (뿌리 → 끝: strand uv v 0 → 1 = 캔버스 아래 → 위) + 천사의 고리
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(17), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#e8bd6a'); gr.addColorStop(1, '#d9a650'); } else { gr.addColorStop(0, '#fbe3a0'); gr.addColorStop(0.5, '#efc778'); gr.addColorStop(1, '#d49a48'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.42 ? 'rgba(170,110,40,0.42)' : k > 0.8 ? 'rgba(255,248,215,0.55)' : 'rgba(240,200,120,0.4)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.bezierCurveTo(x + (r() - 0.5) * 20, H * 0.66, x + (r() - 0.5) * 20, H * 0.33, x + (r() - 0.5) * 8, 0); g.stroke(); }
  if (cap) { g.globalAlpha = 0.5; g.fillStyle = '#fff6d8'; const y0 = H * 0.42; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - 8 - r() * 18); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + 6 + r() * 12); g.closePath(); g.fill(); g.globalAlpha = 1; }
  return tex(c);
}
// 땋은 금발: 비스듬히 엇갈린 세 갈래 결
function braidTex() {
  const W = 128, H = 512, [c, g] = cv(W, H); g.fillStyle = '#e2b464'; g.fillRect(0, 0, W, H);
  for (let y = -64; y < H + 64; y += 32) for (let k = 0; k < 2; k++) {
    const gr = g.createLinearGradient(0, y, 0, y + 36); gr.addColorStop(0, '#a8742e'); gr.addColorStop(0.5, '#ffe6a8'); gr.addColorStop(1, '#a8742e');
    g.fillStyle = gr; g.beginPath(); const x0 = k ? W : 0, x1 = k ? 0 : W, yo = k * 16; g.moveTo(x0, y + yo); g.quadraticCurveTo(W / 2, y + yo + 22, x1, y + yo + 16); g.lineTo(x1, y + yo + 32); g.quadraticCurveTo(W / 2, y + yo + 38, x0, y + yo + 26); g.closePath(); g.fill();
  }
  return tex(c, [1, 2]);
}
// 흰 긴 자락: 은은한 그늘 · 점 격자 · 주황 마름모 징 · 짙은 테 (캔버스 위 = 허리)
function tabardTex(W, edges) {
  const H = 1024, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#e8eaee'); gr.addColorStop(0.6, '#f4f5f7'); gr.addColorStop(1, '#d8dbe2'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W / 40; i++) { const x = (i + 0.5) * 40, lg = g.createLinearGradient(x - 20, 0, x + 20, 0); lg.addColorStop(0, 'rgba(150,155,170,0)'); lg.addColorStop(0.5, 'rgba(150,155,170,0.16)'); lg.addColorStop(1, 'rgba(150,155,170,0)'); g.fillStyle = lg; g.fillRect(x - 20, 0, 40, H); }
  const step = 44, x0 = edges ? 34 : 0, x1 = W - (edges ? 34 : 0);
  g.strokeStyle = 'rgba(120,128,145,0.25)'; g.lineWidth = 1.5;
  for (let x = x0 + step / 2; x < x1; x += step) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, H - 60); g.stroke(); }
  for (let y = 150; y < H - 60; y += step) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  for (let x = x0 + step / 2, i = 0; x < x1; x += step, i++) for (let y = 150, j = 0; y < H - 60; y += step, j++) {
    if ((i + j) % 4 === 0 && y > 300) diamond(g, x, y, 7, 11, '#ff8a1a', '#ffd08a');
    else { g.fillStyle = 'rgba(90,98,115,0.7)'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
  }
  // 허리 쪽 짙은 띠 · 밑단 짙은 테 + 은선
  g.fillStyle = '#2a2d36'; g.fillRect(0, 0, W, 26); g.fillRect(0, H - 44, W, 44); g.fillStyle = '#c8ccd6'; g.fillRect(0, 28, W, 4); g.fillRect(0, H - 50, W, 4);
  for (let x = 30; x < W; x += 60) diamond(g, x, 13, 8, 9, '#ff9a2a', '#ffe0a8');
  if (edges) { g.fillStyle = '#2a2d36'; g.fillRect(0, 0, 26, H); g.fillRect(W - 26, 0, 26, H); g.fillStyle = '#c8ccd6'; g.fillRect(28, 0, 4, H); g.fillRect(W - 32, 0, 4, H);
    for (let y = 120; y < H - 60; y += 130) { diamond(g, 13, y, 7, 12, '#ff9a2a', '#ffe0a8'); diamond(g, W - 13, y, 7, 12, '#ff9a2a', '#ffe0a8'); } }
  return tex(c);
}
// 흰 판금: 아주 옅은 붓 결 + 가장자리 쪽 그늘
function plateTex() {
  const W = 256, [c, g] = cv(W, W), r = rng(5); g.fillStyle = '#eef0f4'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '150,160,180'},${r() * 0.08})`; g.fillRect(r() * W, r() * W, 2, 2); }
  for (let y = 0; y < W; y += 3) { g.fillStyle = `rgba(160,170,190,${0.03 * r()})`; g.fillRect(0, y, W, 1); }
  return tex(c, [2, 2]);
}
// 검은 원피스 천: 잔 결
function dressTex() { const W = 128, [c, g] = cv(W, W), r = rng(9); g.fillStyle = '#17181d'; g.fillRect(0, 0, W, W); for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(120,125,140,${r() * 0.08})`; g.fillRect(r() * W, r() * W, 1, 3); } return tex(c, [4, 4]); }
// 창 자루 감개: 짙은 바탕 + 은 마름모
function gripTex() { const [c, g] = cv(64, 256); g.fillStyle = '#16171c'; g.fillRect(0, 0, 64, 256); for (let y = 0; y < 256; y += 32) diamond(g, 32, y + 16, 18, 12, '#5a5f6c'); return tex(c, [1, 2]); }

/* ---------- 얼굴: 실제 비율 · 무표정 · 보라색 눈 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.071, 0.1, 0.088], jaw: 0.36, chin: 0.006 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#fbe6dc'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,250,246,0.55)'); gr.addColorStop(0.6, 'rgba(255,238,230,0)'); gr.addColorStop(1, 'rgba(195,145,140,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,130,0)'); cg.addColorStop(1, 'rgba(190,130,120,0.38)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
    // 옅은 볼 홍조
    g.save(); g.filter = 'blur(14px)'; g.fillStyle = 'rgba(240,150,150,0.22)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.036, Y.eyeY - 0.022); g.beginPath(); g.ellipse(x, y, 44, 22, 0, 0, TAU); g.fill(); } g.restore();
  }
  paintFace(g, M, { ...Y, tilt: 0.02, lidDrop: 0.04, glow, open, eyeH: 0.0122, iris: glow ? ['#f0e0ff', '#c89aff', '#8a5ae0', '#000'] : ['#e6d2ff', '#a07ae0', '#4e2e96', '#2a1658'], pupil: '#1a0c30', lash: '#3a2614', brow: '#b08a48', browW: 0.0026 });
  const t = new THREE.CanvasTexture(c); if (!glow) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = ({ env: useEnv, ...o }) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2 || useEnv) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const holy = pal.holy ?? HOLY;
  const M = {
    skin: phys({ color: 0xfbe4d8, emissive: 0x7a5852, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5 }),
    eyeGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xfff0c0), sheenRoughness: 0.35, emissive: 0x4a3010, emissiveIntensity: 0.3 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xfff0c0), sheenRoughness: 0.35, emissive: 0x4a3010, emissiveIntensity: 0.25 }),
    braid: phys({ map: T('braid', braidTex), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xfff0c0), sheenRoughness: 0.35, emissive: 0x4a3010, emissiveIntensity: 0.25 }),
    plate: phys({ map: T('plate', plateTex), color: 0xf6f7fa, metalness: 0.32, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.8 }),
    plateS: phys({ color: 0xc8cdd8, metalness: 0.6, roughness: 0.3, clearcoat: 0.6 }),
    steel: phys({ color: 0x2c3039, metalness: 0.85, roughness: 0.34, clearcoat: 0.5 }),
    silver: phys({ color: 0xe4e8f0, metalness: 1, roughness: 0.16, clearcoat: 0.6 }),
    dress: phys({ map: T('dress', dressTex), roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0x6a6c7a) }),
    glove: phys({ color: 0x1a1b21, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
    stock: phys({ color: 0x15161b, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0x7a7a8a) }),
    tabB: phys({ map: T('tabB', () => tabardTex(512, true)), roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    tabF: phys({ map: T('tabF', () => tabardTex(256, true)), roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    shaft: phys({ color: 0x22252c, metalness: 0.7, roughness: 0.38, clearcoat: 0.5 }),
    grip: phys({ map: T('grip', gripTex), roughness: 0.6 }),
    gem: phys({ color: 0xffb040, emissive: AMBER, emissiveIntensity: 0.9, roughness: 0.05, clearcoat: 1, flatShading: true, env: true }),
    ring: phys({ color: RINGB, metalness: 0.9, roughness: 0.2, clearcoat: 1, emissive: 0x0a2a8a, emissiveIntensity: 0.5 }),
    blade: phys({ color: 0xf6f8fc, metalness: 0.45, roughness: 0.22, envMapIntensity: 1.2, clearcoat: 1, clearcoatRoughness: 0.05, emissive: holy, emissiveIntensity: 0 }),
    edge: new THREE.MeshBasicMaterial({ color: holy, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.edge && mat !== M.eyeGlow; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.steel) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const gemGeo = C('gem', () => { const g = new THREE.OctahedronGeometry(0.011, 0); g.scale(0.85, 1.2, 0.55); return g; });
  const stud = (parent, p, s = 1, rot = [0, 0, 0]) => add(parent, gemGeo, M.gem, p, rot, [s, s, s]);
  // 곡면 위 판(갑옷): prof 로프트 위 a0~a1, v0(a)~v1(a) 영역을 off 만큼 띄운 판
  const shell = (prof, mod, a0, a1, v0, v1, off) => (u, v, p) => { const a = a0 + (a1 - a0) * u, vv = v0(a) + (v1(a) - v0(a)) * v; loftAt(prof, a, vv, p, mod); const n = new V3(p.x - (prof(vv).cx || 0), 0, p.z - (prof(vv).cz || 0)).normalize(); p.addScaledVector(n, off); };
  const shellEdge = (fn, along, at, n = 40) => { const pts = []; for (let i = 0; i <= n; i++) { const p = new V3(); along === 'u' ? fn(i / n, at, p) : fn(at, i / n, p); pts.push(p); } return pts; };
  m.ropes = [];

  /* ---------- 골반 · 검은 짧은 치마 · 허리 판 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: -0.11 + 0.2 * v, rx: 0.138 - 0.022 * v, rzF: 0.084, rzB: 0.098, n: 2.2 }), 40, 8)), M.dress);
  const SK_L = 0.3, skR = (d) => { const t = d / SK_L, e = t * t * (1.5 - 0.5 * t); return { rx: 0.14 + 0.085 * e, rzF: 0.106 + 0.07 * e, rzB: 0.118 + 0.085 * e }; };
  const skP = (v) => ({ y: 0.02 - SK_L * v, ...skR(SK_L * v), n: 2.1 });
  const pleat = (n, amp) => (p, u, v) => { const w = Math.sin(u * TAU * n + 0.7), k = 1 + amp * w * smooth(0.1, 0.9, v); p.x *= k; p.z *= k; };
  const skO = add(J.hips, C('skirt', () => loft(skP, 120, 12, { mod: pleat(14, 0.025) })), M.dress);
  skO.geometry = skO.geometry.clone(); skO.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); skO.userData.base = skO.geometry.attributes.position.array.slice(); skO.frustumCulled = false;
  const skRim = add(J.hips, C('skHem', () => strand(loftRing(skP, 0.985, { n: 120, mod: pleat(14, 0.025) }), 0.004, 0.004, { closed: true, seg: 240, rad: 5 })), M.plateS);
  skRim.geometry = skRim.geometry.clone(); skRim.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); skRim.userData.base = skRim.geometry.attributes.position.array.slice(); skRim.frustumCulled = false;
  m.skirt = [skO, skRim];
  // 허리띠: 짙은 강철 + 흰 판 (앞 가운데 호박색 보석)
  const beltP = (v) => ({ y: 0.0 + 0.05 * v, rx: 0.146, rzF: 0.11, rzB: 0.12, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 64, 3)), M.steel);
  add(J.hips, C('fauld', () => surf(shell(beltP, null, 0.3, 0.7, () => -0.25, (a) => 1.1 + 0.25 * gauss(a - 0.5, 0.08), 0.006), 24, 4)), M.plate);
  rim(J.hips, 'fauldR', shellEdge(shell(beltP, null, 0.3, 0.7, () => -0.25, (a) => 1.1 + 0.25 * gauss(a - 0.5, 0.08), 0.008), 'u', 1), 0.003, false);
  { const p = loftAt(beltP, 0.5, 0.6, new V3()); stud(J.hips, [p.x, p.y + 0.004, p.z + 0.012], 1.3); }

  /* ---------- 배 · 상체: 검은 하이칼라 원피스 + 흰 흉갑 · 등판 ---------- */
  const bX = spl([[0, 0.12], [0.45, 0.094], [1, 0.106]]), bF = spl([[0, 0.08], [0.5, 0.068], [1, 0.076]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.15 }), 40, 12)), M.dress);
  // 허리 코르셋 판 (짙은 강철 · 앞이 뾰족)
  const coP = (v) => { const y = -0.04 + 0.13 * v, w = clamp((y + 0.035) / 0.24, 0, 1); return { y, rx: bX(w) + 0.006, rzF: bF(w) + 0.007, rzB: 0.085, n: 2.2 }; };
  const coF = shell(coP, null, 0.0, 1.0, () => 0, (a) => 1 - 0.0 * a, 0.0);
  add(J.spine, C('corset', () => surf((u, v, p) => { coF(u, v, p); const [, sn] = ang(u); p.y += 0.035 * Math.max(0, sn) ** 6 * (v > 0.5 ? 1 : v * 2); }, 64, 6, { closedU: true })), M.steel);
  const chX = spl([[0, 0.106], [0.3, 0.118], [0.55, 0.128], [0.8, 0.122], [1, 0.094]]), chF = spl([[0, 0.078], [0.5, 0.092], [1, 0.07]]), chB = spl([[0, 0.078], [0.6, 0.084], [1, 0.068]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.03 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod })), M.dress);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.122 - 0.074 * v ** 0.8, rzF: 0.074 - 0.028 * v, rzB: 0.069 - 0.026 * v }), 40, 8)), M.dress);
  // 흉갑: 가슴을 덮는 흰 판 (V자 목선 · 아래는 뾰족) + 짙은 테
  const bpTop = (a) => 0.9 + 0.03 * Math.cos((a - 0.5) * TAU) - 0.2 * gauss(a - 0.5, 0.045), bpBot = (a) => 0.2 - 0.18 * gauss(a - 0.5, 0.09);
  const bpF = shell(chP, chMod, 0.2, 0.8, bpBot, (a) => bpTop(a), 0.009);
  add(J.chest, C('breast', () => surf(bpF, 48, 18)), M.plate);
  rim(J.chest, 'bpRt', shellEdge(shell(chP, chMod, 0.2, 0.8, bpBot, (a) => bpTop(a), 0.012), 'u', 1, 60), 0.0045, false);
  rim(J.chest, 'bpRb', shellEdge(shell(chP, chMod, 0.2, 0.8, bpBot, (a) => bpTop(a), 0.012), 'u', 0, 60), 0.0045, false);
  // 흉갑 위 짙은 강철 덩굴 장식 (가운데에서 양쪽 아래로 말림) + 호박색 보석
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, a = 0.5 + s * (0.012 + 0.11 * t), vv = 0.62 - 0.28 * t + 0.08 * Math.sin(t * Math.PI); const p = loftAt(chP, a, vv, new V3(), chMod); p.addScaledVector(new V3(p.x, 0, p.z).normalize(), 0.013); pts.push(p); }
    rim(J.chest, 'bpVine' + s, pts, 0.0035, false);
    const p2 = []; for (let i = 0; i <= 12; i++) { const t = i / 12, a = 0.5 + s * (0.06 + 0.05 * Math.cos(t * 4)), vv = 0.48 - 0.12 * t + 0.03 * Math.sin(t * 4); const p = loftAt(chP, a, vv, new V3(), chMod); p.addScaledVector(new V3(p.x, 0, p.z).normalize(), 0.013); p2.push(p); }
    rim(J.chest, 'bpCurl' + s, p2, 0.003, false);
  }
  { const p = loftAt(chP, 0.5, 0.56, new V3(), chMod); stud(J.chest, [p.x, p.y, p.z + 0.018], 1.4); }
  // 등판
  const backF = shell(chP, chMod, 0.82, 1.18, () => 0.25, () => 0.86, 0.008);
  add(J.chest, C('backP', () => surf(backF, 36, 12)), M.plate);
  rim(J.chest, 'backR0', shellEdge(shell(chP, chMod, 0.82, 1.18, () => 0.25, () => 0.86, 0.011), 'u', 0), 0.004, false);
  rim(J.chest, 'backR1', shellEdge(shell(chP, chMod, 0.82, 1.18, () => 0.25, () => 0.86, 0.011), 'u', 1), 0.004, false);
  // 하이칼라 (검정 · 흰 테 · 앞 보석)
  const colP = (v) => ({ y: 0.245 + 0.07 * v, rx: 0.05 + 0.008 * v, rzF: 0.048 + 0.01 * v, rzB: 0.05 + 0.004 * v, n: 2.2 });
  add(J.chest, C('collar', () => loft(colP, 40, 4)), M.dress); lRim(J.chest, 'colR1', colP, 1, 0.0035, M.plateS); lRim(J.chest, 'colR0', colP, 0.05, 0.003, M.plateS);
  { const p = loftAt(colP, 0.5, 0.4, new V3()); stud(J.chest, [p.x, p.y, p.z + 0.004], 0.9); }

  /* ---------- 어깨 갑주 (겹친 판 + 칼날 같은 깃) · 팔 · 건틀릿 · 손 ---------- */
  const finShape = (L, W) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(W * 1.1, L * 0.35, W * 0.25, L); sh.quadraticCurveTo(W * 0.35, L * 0.4, -W * 0.5, L * 0.05); sh.closePath(); return sh; };
  const finGeo = (k, L, W) => C('fin' + k, () => { const g = new THREE.ExtrudeGeometry(finShape(L, W), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.003); return g; });
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const cc = s > 0 ? 0.25 : 0.75, a0 = cc - 0.3, a1 = cc + 0.3;
    // 둥근 덮개
    const capP = (v) => { const t = 0.12 + 0.88 * v; return { y: 0.05 + 0.05 * Math.cos(t * Math.PI / 2) - 0.07 * v, rx: 0.088 * Math.sin(t * Math.PI / 2) + 0.004, rz: 0.084 * Math.sin(t * Math.PI / 2) + 0.004, cx: s * 0.02 }; };
    add(sh, C('pCap' + s, () => loft(capP, 28, 10, { a0, a1 })), M.plate);
    rim(sh, 'pCapR' + s, loftRing(capP, 1, { a0, a1, n: 28 }), 0.0045, false);
    // 겹친 판 두 장
    for (let k = 0; k < 2; k++) {
      const lp = (v) => ({ y: -0.005 - k * 0.032 - 0.045 * v, rx: 0.094 + 0.008 * k + 0.012 * v, rz: 0.09 + 0.006 * k + 0.01 * v, cx: s * 0.02 });
      add(sh, C(`pLame${s}${k}`, () => loft(lp, 24, 3, { a0: a0 + 0.03, a1: a1 - 0.03 })), M.plate);
      rim(sh, `pLameR${s}${k}`, loftRing(lp, 1, { a0: a0 + 0.03, a1: a1 - 0.03, n: 24 }), 0.004, false);
    }
    // 칼날 같은 깃: 위로 솟은 큰 깃 (흰 · 짙은 테) + 뒤쪽 작은 깃
    const fg = new THREE.Group(); fg.position.set(s * 0.07, 0.07, -0.01); fg.rotation.set(0.25, s * -1.35, s * -0.5); sh.add(fg);
    add(fg, finGeo('a', 0.15, 0.04), M.steel, [0, -0.004, -0.004], [0, 0, 0], [1.12, 1.08, 1]);
    add(fg, finGeo('a', 0.15, 0.04), M.plate, [0, 0, 0.003]);
    const fg2 = new THREE.Group(); fg2.position.set(s * 0.085, 0.04, -0.045); fg2.rotation.set(0.9, s * -1.1, s * -0.9); sh.add(fg2);
    add(fg2, finGeo('b', 0.1, 0.03), M.steel, [0, -0.003, -0.003], [0, 0, 0], [1.15, 1.1, 1]);
    add(fg2, finGeo('b', 0.1, 0.03), M.plate, [0, 0, 0.003]);
    stud(sh, [s * 0.075, 0.06, 0.06], 1.2, [-0.6, s * 0.6, 0]);
    // 위팔: 검은 소매
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.043 - 0.009 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.041 - 0.008 * v }), 24, 10)), M.dress);
    // 팔꿈치 덮개 (짙은 강철 원반 + 흰 날개)
    add(el, C('elbowC', () => { const g = new THREE.SphereGeometry(0.032, 16, 10, 0, TAU, 0, Math.PI / 2); g.rotateX(-Math.PI / 2); g.scale(1, 1, 0.7); return g; }), M.steel, [0, 0, -0.026]);
    // 건틀릿: 팔꿈치 쪽이 벌어지고 손목에서 좁아짐 + 뒤로 뻗은 뾰족한 끝
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.034 - 0.01 * v, rz: 0.032 - 0.009 * v }), 20, 8)), M.glove);
    const gaP = (v) => ({ y: -0.035 - (DIMS.lArm - 0.03) * v, rx: 0.046 - 0.012 * v + 0.006 * gauss(v, 0.15), rz: 0.043 - 0.011 * v + 0.006 * gauss(v, 0.15) });
    add(el, C('gauntlet', () => loft(gaP, 28, 10, { mod: (p, u, v, c, sn) => { if (sn < 0) p.y += 0.035 * Math.max(0, -sn) ** 4 * (1 - v) ** 3; } })), M.plate);
    lRim(el, 'gaR0', gaP, 0, 0.0035, M.steel, { mod: (p, u, v, c, sn) => { if (sn < 0) p.y += 0.035 * Math.max(0, -sn) ** 4; } }); lRim(el, 'gaR1', gaP, 1, 0.003, M.steel);
    { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(gaP, 0.5, 0.08 + 0.85 * i / 10, new V3()).multiplyScalar(1.07)); rim(el, 'gaRidge', pts, 0.003, false); }
    stud(el, [0, -0.11, 0.045], 0.9);
    // 손: 검은 장갑 손가락 + 흰 손등판
    const hg = new THREE.Group(); hg.scale.setScalar(0.84); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.02 + 0.003 * Math.sin(v * Math.PI), rz: 0.033 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.glove);
    add(hg, C('hback' + s, () => loft((v) => ({ y: 0.008 - 0.06 * v, rx: 0.025, rz: 0.038, n: 3, cx: s * 0.017 }), 18, 4, { a0: s > 0 ? 0.05 : 0.55, a1: s > 0 ? 0.45 : 0.95 })), M.plate);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.2 + k * 0.1 : 2.6;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0082, 0.0066, { seg: 14, rad: 8 })), M.glove);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0098, 0.0072, { seg: 12, rad: 8 })), M.glove);
    if (s > 0) add(hg, C('ringB', () => new THREE.TorusGeometry(0.0095, 0.0028, 8, 18)), M.ring, [s * 0.031, -0.062, 0.024], [0, 0, 0.8]); // 왼손 약지 푸른 반지
  }

  /* ---------- 다리: 허벅지 · 검은 니삭스 · 옆 허벅지 판 · 무릎 갑주 · 흰 장화 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.09], [0.4, 0.078], [0.85, 0.056], [1, 0.054]]), thF = spl([[0, 0.086], [0.5, 0.07], [1, 0.054]]), thB = spl([[0, 0.088], [0.35, 0.076], [1, 0.049]]);
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12)), M.skin);
    const stP = (v) => { const vv = 0.36 + 0.64 * v, q = thP(vv); return { ...q, rx: q.rx + 0.002, rzF: q.rzF + 0.002, rzB: q.rzB + 0.002 }; };
    add(hp, C('stockT', () => loft(stP, 28, 10)), M.stock);
    const bandP = (v) => { const q = stP(v * 0.08); return { ...q, rx: q.rx + 0.003, rzF: q.rzF + 0.003, rzB: q.rzB + 0.003 }; };
    add(hp, C('stockB', () => loft(bandP, 28, 2)), M.glove);
    for (let i = 0; i < 6; i++) { const p = loftAt(bandP, 0.3 + i * 0.08 * (s > 0 ? 1 : -1) + (s > 0 ? 0 : 0.4), 0.5, new V3()); add(hp, C('stDot', () => new THREE.SphereGeometry(0.0035, 8, 6)), M.plateS, [p.x * 1.03, p.y, p.z * 1.03]); }
    // 옆 허벅지 판 (바깥쪽, 짙은 테 + 보석)
    const tasP = (v) => { const q = thP(v * 0.36); return { ...q, rx: q.rx + 0.014, rzF: q.rzF + 0.012, rzB: q.rzB + 0.012 }; };
    const ta0 = s > 0 ? 0.13 : 0.65, ta1 = ta0 + 0.22;
    add(hp, C('tasset' + s, () => loft(tasP, 16, 6, { a0: ta0, a1: ta1 })), M.plate);
    rim(hp, 'tasR' + s, loftRing(tasP, 1, { a0: ta0, a1: ta1, n: 16 }), 0.0035, false);
    rim(hp, 'tasS0' + s, shellEdge((u, v, p) => loftAt(tasP, ta0, v, p), 'v', 0, 8).map((q) => q.multiplyScalar(1.01)), 0.003, false);
    rim(hp, 'tasS1' + s, shellEdge((u, v, p) => loftAt(tasP, ta1, v, p), 'v', 0, 8).map((q) => q.multiplyScalar(1.01)), 0.003, false);
    { const p = loftAt(tasP, (ta0 + ta1) / 2, 0.7, new V3()); stud(hp, [p.x * 1.04, p.y, p.z * 1.04], 0.9, [0, s * 1.2, 0]); }
    // 무릎 갑주: 앞쪽 둥근 판 + 바깥쪽 뾰족한 날개 + 호박색 징
    const kcP = (v) => ({ y: 0.075 - 0.15 * v, rx: 0.06 + 0.008 * Math.sin(v * Math.PI), rzF: 0.062 + 0.014 * Math.sin(v * Math.PI), rzB: 0.05, cz: 0.004 });
    add(kn, C('kneeC', () => loft(kcP, 20, 8, { a0: 0.3, a1: 0.7 })), M.plate);
    rim(kn, 'kneeCR0', loftRing(kcP, 0, { a0: 0.3, a1: 0.7, n: 20 }), 0.0035, false); rim(kn, 'kneeCR1', loftRing(kcP, 1, { a0: 0.3, a1: 0.7, n: 20 }), 0.0035, false);
    const kw = new THREE.Group(); kw.position.set(s * 0.055, 0.03, 0.035); kw.rotation.set(-0.3, s * 1.2, s * 0.3); kn.add(kw);
    add(kw, finGeo('k', 0.08, 0.026), M.steel, [0, 0, -0.003], [0, 0, 0], [1.15, 1.1, 1]); add(kw, finGeo('k', 0.08, 0.026), M.plate, [0, 0, 0.002]);
    stud(kn, [0, 0.0, 0.08], 1.3);
    // 정강이 갑주 (장화 목): 종아리 모양을 따라 위가 조금 벌어짐
    const cX = spl([[0, 0.062], [0.3, 0.064], [0.75, 0.044], [1, 0.04]]), cF = spl([[0, 0.06], [0.5, 0.052], [1, 0.04]]), cB = spl([[0, 0.058], [0.3, 0.076], [0.7, 0.05], [1, 0.042]]);
    const grP = (v) => ({ y: -0.04 - (DIMS.shin - 0.08) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) });
    add(kn, C('greave', () => loft(grP, 32, 16, { mod: (p, u, v, c, sn) => { if (sn < 0) p.y += 0.03 * Math.max(0, -sn) ** 2 * (1 - v) ** 4; } })), M.plate);
    lRim(kn, 'grR0', grP, 0, 0.0045, M.steel, { mod: (p, u, v, c, sn) => { if (sn < 0) p.y += 0.03 * Math.max(0, -sn) ** 2; } }); lRim(kn, 'grR1', grP, 1, 0.004, M.steel);
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(grP, 0.5, 0.05 + 0.9 * i / 12, new V3()).multiplyScalar(1.04)); rim(kn, 'grRidge', pts, 0.0032, false); }
    for (const s2 of [-1, 1]) { const pts = []; for (let i = 0; i <= 10; i++) { const v = 0.15 + 0.7 * i / 10; pts.push(loftAt(grP, 0.5 + s2 * (0.12 - 0.04 * v), v, new V3()).multiplyScalar(1.025)); } rim(kn, 'grSide' + s2, pts, 0.0022, false, M.plateS); }
    stud(kn, [0, -0.3, 0.05], 0.8);
    // 발목 (검정)
    add(kn, C('ankle', () => loft((v) => ({ y: -DIMS.shin + 0.05 - 0.05 * v, rx: 0.038, rz: 0.04 }), 16, 3)), M.glove);
    // 판금 장화: 겹친 발등 판 · 뾰족한 앞코 · 짙은 밑창 · 낮은 굽
    const fw = spl([[0, 0.0], [0.06, 0.03], [0.25, 0.037], [0.6, 0.041], [0.85, 0.032], [1, 0.006]]), fh = spl([[0, 0.03], [0.08, 0.06], [0.3, 0.064], [0.6, 0.042], [0.85, 0.028], [1, 0.01]]);
    const fb = -0.068, foot = (o) => (u, v, p) => { const [c, sn] = ang(u), w = fw(v) + o, h = fh(v) + o, e = 0.7; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.06 + 0.25 * v); };
    add(ft, C('boot', () => surf(foot(0.002), 28, 20, { closedU: true })), M.plate);
    add(ft, C('sole', () => surf((u, v, p) => { const [c, sn] = ang(u), w = fw(v) + 0.004; p.set(Math.sign(c) * Math.abs(c) ** 0.3 * w, fb - 0.004 + 0.012 * (Math.sign(sn) * Math.abs(sn) ** 0.3 + 1) / 2, -0.062 + 0.254 * v); }, 24, 16, { closedU: true })), M.steel);
    add(ft, C('heelB', () => loft((v) => ({ y: fb + 0.004 - 0.012 * v, rx: 0.025 - 0.003 * v, rz: 0.028 - 0.003 * v, n: 3, cz: -0.032 }), 12, 3)), M.steel);
    for (let k = 0; k < 3; k++) { const v0 = 0.42 + k * 0.13, pts = []; for (let i = 0; i <= 14; i++) { const u = 0.25 + 0.5 * i / 14, p = new V3(); foot(0.004)(u < 0.5 ? u + 0 : u, v0, p); pts.push(p); } rim(ft, 'bootL' + k, pts, 0.0028, false); }
    stud(ft, [0, fb + 0.07, 0.07], 0.7, [-1.0, 0, 0]);
  }

  /* ---------- 목 · 얼굴 · 머리 (일자 앞머리 · 옆머리 · 짧은 뒷머리 · 땋은 머리 두 갈래) ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.033 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.032 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.033 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.1);
  m.eyeGlow = add(H, headGeo, M.eyeGlow, [0, 0, 0], [0, 0, 0], [1.002, 1.002, 1.002]); m.eyeGlow.renderOrder = 5;
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.1, -0.006], [s * 0.08, 0.104, -0.014], [s * 0.084, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.14 + 0.4 * w * w : 0.14 - 0.95 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.008 + 0.012 * smooth(0, 0.4, v) + 0.008 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(11), clump = (key, pts, r0, r1, flat, ref, mat = M.hair) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), mat);
    // 일자 앞머리: 눈썹 높이에서 반듯하게 자름 (가운데가 아주 조금 짧음)
    for (let k = 0; k < 21; k++) {
      const t = k / 20, az = -0.98 + t * 1.96 + (r() - 0.5) * 0.03, side = Math.abs(az), tipEl = 0.2 + 0.012 * gauss(az, 0.3) - 0.004 * r() - 0.22 * smooth(0.7, 1.0, side);
      const pts = [headAt(az * 0.3, 1.2, 0.022), headAt(az * 0.78, 0.86, 0.034), headAt(az * 0.94, 0.56, 0.036), headAt(az, (0.56 + tipEl) / 2, 0.032), headAt(az * 1.01, tipEl, 0.024)];
      const d = dirOf(az, 0.4); clump('bang' + k, pts, (k % 2 ? 0.028 : 0.036) + r() * 0.006, 0.012, 0.24, [d.x, d.y, d.z]);
    }
    // 옆머리: 귀 앞으로 턱선까지 반듯하게 (히메컷)
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const az = s * (1.02 + k * 0.13), tip = -0.8 - k * 0.04, pts = [headAt(az * 0.9, 0.75, 0.02), headAt(az, 0.2, 0.022), headAt(az * 1.01, -0.4, 0.024), headAt(az * 1.02, tip, 0.024)];
      const d = dirOf(az, 0); clump(`side${s}${k}`, pts, 0.034, 0.02, 0.24, [d.x, 0, d.z]);
    }
    // 짧은 뒷머리 (목덜미까지)
    for (let k = 0; k < 24; k++) {
      const az = (k / 24) * TAU + Math.PI * 0.5 + 0.13, w = Math.cos(az); if (w > -0.05) continue;
      const tipEl = -0.72 - 0.12 * Math.max(0, -w) + (r() - 0.5) * 0.05;
      const pts = [headAt(az, 0.75, 0.02), headAt(az, 0.1, 0.03), headAt(az, -0.4, 0.034), headAt(az + (r() - 0.5) * 0.05, tipEl, 0.026), headAt(az, tipEl + 0.08, 0.008)];
      const d = dirOf(az, 0); clump('back' + k, pts, 0.046, 0.01, 0.26, [d.x, 0, d.z]);
    }
    // 정수리 위 덩어리 (볼륨)
    for (let k = 0; k < 10; k++) { const az = (k / 10) * TAU, pts = [headAt(az * 0.2, 1.4, 0.022), headAt(az, 1.0, 0.03), headAt(az, 0.7, 0.03)]; const d = dirOf(az, 0.9); clump('top' + k, pts, 0.045, 0.03, 0.3, [d.x, d.y, d.z], M.hairCap); }
    // 땋은 머리 뿌리: 관자놀이 위에서 귀 뒤로 감아 내려옴
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(headAt(s * (1.4 + 0.5 * t), 0.45 - 0.9 * t, 0.026 - 0.004 * t)); }
      add(H, C('braidRoot' + s, () => strand(pts, 0.012, 0.014, { seg: 24, rad: 10 })), M.braid);
    }
  }
  // 땋은 머리 두 갈래: 귀 뒤에서 어깨 앞으로 (로프 물리) + 끝 매듭 · 끝 다발
  for (const s of [-1, 1]) {
    const rope = new Rope(9, 0.05, { damp: 0.98, stiff: 0.1 }), view = new RopeTube(rope, M.braid, { sub: 4, rad: 10, uvV: 1, twist: 6,
      prof: (v) => (v < 0.85 ? 0.016 * (1 - 0.25 * v) * (1 + 0.16 * Math.abs(Math.sin(v * Math.PI * 22))) : v < 0.9 ? 0.011 : 0.011 + (v - 0.9) * 0.18) * (v > 0.985 ? 0.35 : 1) });
    m.ropes.push({ rope, view, joint: H, local: headAt(s * 1.9, -0.45, 0.028), rest: new V3(s * 0.25, -1, 0.3).normalize(), caps: 'body', braid: s });
  }
  m.braidTies = [-1, 1].map(() => { const g = new THREE.Mesh(C('tie', () => new THREE.TorusGeometry(0.013, 0.004, 8, 18)), M.steel); g.castShadow = true; return g; });

  /* ---------- 흰 긴 자락 (천 물리): 뒤 → 왼쪽 옆 / 앞 오른쪽 ---------- */
  let backC = null, frontC = null;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    backC = new Cloth(scene, 9, 16, 0.92, M.tabB); frontC = new Cloth(scene, 5, 15, 0.84, M.tabF);
    for (const c of [backC, frontC]) extras.push(c.mesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
    for (const t of m.braidTies) { scene.add(t); extras.push(t); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const c of [backC, frontC]) if (c) c.mesh.geometry.dispose(); backC = frontC = null; m._attached = false; };
  m.resetCloth = () => { for (const c of [backC, frontC]) if (c) c.ok = false; for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 무기: 십자 창머리 은빛 창 ---------- */
  const lance = new THREE.Group(); J.weapon.add(lance); m.glaive = lance; m.lance = lance;
  {
    const X = [Math.PI / 2, 0, 0];
    const pole = LN.socket - LN.butt;
    add(lance, C('ln:shaft', () => new THREE.CylinderGeometry(0.0165, 0.0165, pole, 20, 1, true)), M.shaft, [0, 0, (LN.socket + LN.butt) / 2], X);
    add(lance, C('ln:grip1', () => new THREE.CylinderGeometry(0.019, 0.019, 0.26, 20, 1, true)), M.grip, [0, 0, 0.0], X);
    add(lance, C('ln:grip2', () => new THREE.CylinderGeometry(0.019, 0.019, 0.2, 20, 1, true)), M.grip, [0, 0, LN.grip2], X);
    const band = C('ln:band', () => lathe([[0.0163, -0.014], [0.021, -0.011], [0.023, 0], [0.021, 0.011], [0.0163, 0.014]], 24));
    for (const z of [-0.6, -0.14, 0.14, LN.grip2 - 0.11, LN.grip2 + 0.11, 0.85, 1.02]) add(lance, band, M.silver, [0, 0, z], X);
    // 물미: 뾰족한 은 끝
    add(lance, C('ln:butt', () => lathe([[0.017, 0], [0.022, -0.02], [0.018, -0.05], [0.008, -0.1], [0, -0.13]], 20)), M.silver, [0, 0, LN.butt], X);
    // 창머리 소켓 (위로 벌어지는 은 관) + 푸른 고리
    add(lance, C('ln:socket', () => lathe([[0.017, 0], [0.019, 0.04], [0.016, 0.08], [0.022, 0.12], [0.03, 0.16], [0.026, 0.19], [0.012, 0.2]], 24)), M.silver, [0, 0, LN.socket], [-Math.PI / 2, 0, 0]);
    add(lance, C('ln:ringB', () => new THREE.TorusGeometry(0.026, 0.0065, 10, 32)), M.ring, [0, 0, LN.ring]);
    // 네 갈래 별 코등이: 긴 가시 넷(위아래·좌우) + 짧은 사선 가시 넷 + 둥근 고리 + 가운데 호박색 보석
    const spikeShape = (L, W) => { const sh = new THREE.Shape(); sh.moveTo(0, -W * 0.6); sh.lineTo(L * 0.25, -W); sh.quadraticCurveTo(L * 0.6, -W * 0.45, L, 0); sh.quadraticCurveTo(L * 0.6, W * 0.45, L * 0.25, W); sh.lineTo(0, W * 0.6); sh.closePath(); return sh; };
    const spike = (k, L, W) => C('ln:spk' + k, () => { const g = new THREE.ExtrudeGeometry(spikeShape(L, W), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 }); g.translate(0, 0, -0.003); return g; });
    const star = new THREE.Group(); star.position.z = LN.guard; lance.add(star); m.star = star;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; const o = add(star, spike('L', 0.15, 0.022), M.silver); o.rotation.set(0, 0, a); const o2 = add(star, spike('S', 0.075, 0.015), M.plateS); o2.rotation.set(0, 0, a + Math.PI / 4); }
    // 별 가시 끝이 창날 쪽으로 살짝 휘어지도록 앞으로 기울인 작은 갈고리
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU, d = [Math.cos(a), Math.sin(a)]; add(star, C('ln:hook', () => strand([[0.05, 0, 0], [0.08, 0, 0.03], [0.085, 0, 0.07]], 0.006, 0.0015, { seg: 10, rad: 6 })), M.silver, [0, 0, 0], [0, 0, a]); void d; }
    add(star, C('ln:halo', () => new THREE.TorusGeometry(0.062, 0.005, 8, 40)), M.silver);
    add(star, C('ln:core', () => new THREE.IcosahedronGeometry(0.022, 1)), M.gem);
    add(star, C('ln:coreR', () => new THREE.TorusGeometry(0.027, 0.004, 8, 24)), M.ring);
    // 긴 창날: 마름모 단면 (두께 얇게), 밑동이 조금 넓고 끝으로 갈수록 가늘어짐
    const bw = (v) => 0.034 * (1 - 0.35 * v) * (v < 0.08 ? 0.6 + 5 * v : 1) * (1 - smooth(0.82, 1, v) * 0.98);
    add(lance, C('ln:blade', () => surf((u, v, p) => { const z = LN.bladeStart + (LN.tip - LN.bladeStart) * v, t = u * TAU, w = bw(v), c = Math.cos(t), s = Math.sin(t); p.set(Math.sign(c) * Math.abs(c) ** 1.6 * w, Math.sign(s) * Math.abs(s) ** 1.6 * 0.0075 * (1 - smooth(0.85, 1, v) * 0.9), z); }, 16, 40, { closedU: true })), M.blade);
    // 날 가운데 금빛 홈 (성광 선)
    for (const sY of [-1, 1]) add(lance, C('ln:fuller' + sY, () => { const pts = []; for (let i = 0; i <= 20; i++) { const v = 0.04 + 0.78 * i / 20; pts.push(new V3(0, sY * 0.0074, LN.bladeStart + (LN.tip - LN.bladeStart) * v)); } return strand(pts, 0.004, 0.0012, { seg: 30, rad: 5, flat: 0.3, ref: [0, 1, 0] }); }), M.edge);
    add(lance, C('ln:bladeBase', () => lathe([[0.012, 0], [0.024, 0.012], [0.02, 0.03], [0.008, 0.045]], 16)), M.silver, [0, 0, LN.guard + 0.005], [-Math.PI / 2, 0, 0]);
    m.bladeGlow = add(lance, C('ln:glow', () => surf((u, v, p) => { const z = LN.bladeStart + (LN.tip - LN.bladeStart + 0.04) * v, t = u * TAU, w = bw(Math.min(1, v)) + 0.014; p.set(Math.cos(t) * w, Math.sin(t) * 0.016, z); }, 12, 20, { closedU: true })), M.edge);
  }

  /* ---------- 매 프레임 ---------- */
  const tS = new V3(), tT = new V3(), tE = new V3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), dn = new V3(0, -1, 0), tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion();
  const lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 };
  m.ikW = 1; m.glow = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    // 왼손은 창대를 잡는다 (기술마다 ikOff 로 끌 수 있음)
    const want = m.weaponOut ? 0 : f.state === 'act' ? (f.act.ikOff ? 0 : 1) : (f.state === 'guard' || f.state === 'idle' || f.state === 'run') ? 1 : 0;
    m.ikW += (want - m.ikW) * Math.min(1, dt * 14);
    if (m.ikW > 0.02) {
      J.chest.updateMatrixWorld(true); J.weapon.updateMatrixWorld(true);
      J.shoulderL.getWorldPosition(tS); J.weapon.localToWorld(tT.set(0, 0, LN.grip2));
      const L1 = DIMS.uArm * sc, L2 = DIMS.lArm * sc, natural = J.handL.getWorldPosition(new V3()); tT.lerp(natural, 1 - m.ikW);
      const d = clamp(tT.distanceTo(tS), 0.05, L1 + L2 - 0.002), dir = tT.clone().sub(tS).normalize(), a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const hint = new V3(0, -1, 0).addScaledVector(f.fwd(new V3()), -0.3).add(f.right(new V3()).multiplyScalar(-0.5)), n = hint.addScaledVector(dir, -hint.dot(dir)).normalize();
      tE.copy(tS).addScaledVector(dir, a).addScaledVector(n, h);
      J.shoulderL.parent.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tE.clone().sub(tS).normalize()); J.shoulderL.quaternion.copy(q0.clone().invert().multiply(q1)); J.shoulderL.updateMatrixWorld(true);
      J.shoulderL.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tT.clone().sub(tE).normalize()); J.elbowL.quaternion.copy(q0.clone().invert().multiply(q1)); J.elbowL.updateMatrixWorld(true);
    }
    // 검은 치마: 다리 각도를 스프링으로 따라 출렁임
    const k = 1 - Math.exp(-dt * 16);
    lag.vL += ((J.hipL.rotation.x - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * k;
    const spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.4, 1.4)), zR = -Math.sin(clamp(lag.R, -1.4, 1.4));
    for (const me of m.skirt) {
      const base = me.userData.base, pa = me.geometry.attributes.position, arr = pa.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, 0.02 - y), wL = clamp(0.5 + x / 0.14, 0, 1), wR = 1 - wL;
        const dz = (wL * zL + wR * zR) * depth * 0.95, out = 1 + (spread * 0.3 + lag.sw * 0.12) * (depth / SK_L);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.3; arr[i + 2] = z * out + dz - lag.sw * 0.1 * depth;
      }
      pa.needsUpdate = true; me.geometry.computeVertexNormals();
    }
    J.chest.updateMatrixWorld(true);
    const wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 0.8, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 0.8];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.05 * sc })), h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.72 + 0.05 * sc };
    const hp = J.hips.getWorldPosition(new V3()), s1 = hp.clone().add(new V3(0, -0.12 * sc, 0)), s2 = hp.clone().add(new V3(0, -0.26 * sc, 0));
    const skirtCaps = [torso, ...legs, { a: s1, b: s1, r: 0.2 * sc }, { a: s2, b: s2, r: (0.29 + spread * 0.05) * sc }];
    // 뒤 자락: 왼쪽 옆(트임) → 뒤 → 오른쪽 옆
    if (backC) { const W = backC.W; for (let i = 0; i < W; i++) { const a = 0.29 - 0.56 * (i / (W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0.4, backC.anchors[i]).multiplyScalar(1.14)); }
      backC.len = 0.92 * sc; backC.mesh.visible = vis; backC.step(dt, skirtCaps, f.pos.y + 0.02, wind); }
    // 앞 오른쪽 자락: 앞 가운데 → 오른쪽 옆
    if (frontC) { const W = frontC.W; for (let i = 0; i < W; i++) { const a = 0.49 + 0.25 * (i / (W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0.4, frontC.anchors[i]).multiplyScalar(1.14)); }
      frontC.len = 0.84 * sc; frontC.mesh.visible = vis; frontC.step(dt, skirtCaps, f.pos.y + 0.02, wind); }
    // 땋은 머리: 몸통(어깨 높이까지) + 머리 구 + 어깨 갑주 구
    const hc = H.localToWorld(tmp2.copy(HC)), shL = J.shoulderL.localToWorld(new V3(0.02, 0.02, 0)), shR = J.shoulderR.localToWorld(new V3(-0.02, 0.02, 0));
    const capsBody = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.28), r: h0.r * 0.72 + 0.06 * sc }, { a: hc, b: hc.clone(), r: 0.108 * sc }, { a: shL, b: shL, r: 0.1 * sc }, { a: shR, b: shR, r: 0.1 * sc }];
    H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq); const windV = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local));
      r.rope.step(dt, tmp, capsBody, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.view.mesh.visible = vis;
      const p = r.rope.p, i = p.length - 2, t = m.braidTies[r.braid > 0 ? 1 : 0]; t.position.copy(p[i]).lerp(p[i + 1], 0.0); t.quaternion.setFromUnitVectors(new V3(0, 0, 1), tmp.subVectors(p[i + 1], p[i - 1]).normalize()); t.visible = vis;
    }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림 / 성광: 창날 · 보석 · 눈빛
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    const blessed = f.stK ? f.stK('atk') > 1 : false;
    const wantG = Math.max(f.holyK || 0, blessed ? 0.65 : 0, (f.radiance || 0) >= 100 ? 0.5 : 0.08); m.glow += (wantG - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.9 + 0.1 * Math.sin(f.G.time * 6);
    M.blade.emissiveIntensity = m.glow * 0.9 * pulse; M.edge.opacity = (0.25 + m.glow * 0.75) * pulse; m.bladeGlow.visible = m.glow > 0.15; m.bladeGlow.scale.set(1, 1, 1);
    M.gem.emissiveIntensity = 0.8 + m.glow * 1.6; M.eyeGlow.opacity = m.glow > 0.5 ? (m.glow - 0.5) * 0.6 : 0;
    for (const o of extras) o.visible = vis;
  };
  m.setWeapon = (v) => { lance.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.072;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 판정: 자루 앞부분 ~ 창끝 / 궤적: 창머리 ~ 창끝
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.5)); J.weapon.localToWorld(t.set(0, 0, LN.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, LN.guard)); J.weapon.localToWorld(t.set(0, 0, LN.tip)); };
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, LN.tip)); };
  m.headPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, LN.guard)); };
  m.extras = extras;
  return m;
}
