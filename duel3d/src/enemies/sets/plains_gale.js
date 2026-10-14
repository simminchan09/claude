// 폭풍 켄타우로스 갈레 3D 모델
// 몸 구조: 휴머노이드 관절 리그를 골반에서 앞으로 90° 눕혀 말의 몸통으로 쓴다.
//   hips = 엉덩이 · spine / chest = 몸통 · neck = 사람 허리(위로 세움) · head = 사람 머리
//   다리(hip/knee/foot) = 말 뒷다리 (접지 담당) · 팔(shoulder/elbow/hand) = 사람 팔 (어깨 관절을 사람 상체로 옮겨 붙임)
//   말 앞다리는 리그 밖 별도 관절: rigHook 에서 2마디 IK 로 발굽을 땅에 딛게 하고, 달리기 · 돌격 · 앞발 들기 때 접어 올린다
// 외형: 회청색 얼룩 털 · 녹색 바람 무늬 안장 천 + 금 테 · 가슴 마갑 · 흰 발목 털 · 긴 꼬리(로프)
//       사람 상체: 녹색 가죽 몸통 갑옷 + 금 비늘 흉갑 · 왼어깨 겹판 · 팔토시 · 매 부리 투구(빛나는 눈 틈 · 깃털 볏 · 옆 날개) · 은빛 긴 머리(로프)
//       무기: 날개 달린 긴 창 (녹색 빛 날 · 금 띠 · 바람 술)
import * as THREE from 'three';
import { buildHumanoid, JI } from '../../rig.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, cached } from '../../sculpt.js';
import { animeHead } from '../../face.js';
import { V3, TAU, UP, cv, tex, T, mottle, scaleTex, clothTex, cardTex, phys, glowMat, addMesh as add, tube, limb, bulge, clawHand, cards, physKit, ik2 } from './plains_lib.js';

const C = (k, fn) => cached('plains:gale:' + k, fn);
export const PI2 = Math.PI / 2;
export const GALE_DIMS = { hipH: 1.0, spineL: 0.4, chestL: 0.42, neckL: 0.46, shW: 0.17, uArm: 0.29, lArm: 0.27, hipW: 0.13, thigh: 0.38, shin: 0.36, headTop: 0.26 };
export const SPEAR = { butt: -0.95, tip: 1.95 };
const FL = { A: 0.5, B: 0.3, hoof: 0.13, sh: [0.125, 0.36, 0.16] }; // 앞다리: 위 마디 · 정강이 · 발목 아래 / 어깨 위치(가슴 로컬)
const HEAD = animeHead({ C: new V3(0, 0.1, 0.006), R: [0.074, 0.1, 0.09], jaw: 0.3 });

function saddleTex() {
  const W = 512, H = 256, [c, g] = cv(W, H); g.fillStyle = '#1e4a36'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(140,255,210,0.35)'; g.lineWidth = 5;
  for (let k = 0; k < 7; k++) { const x0 = 40 + k * 70, y0 = 70 + (k % 2) * 60; g.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.22, r = 30 * (1 - i / 70); g.lineTo(x0 + Math.cos(a) * r + i * 0.8, y0 + Math.sin(a) * r); } g.stroke(); }
  g.fillStyle = '#d8b060'; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 14, W, 10); g.fillStyle = '#8a1a20'; g.fillRect(0, H - 26, W, 10);
  for (let x = 8; x < W; x += 32) { g.fillStyle = '#d8b060'; g.beginPath(); g.moveTo(x, H - 4); g.lineTo(x + 8, H - 16); g.lineTo(x + 16, H - 4); g.fill(); }
  return tex(c);
}
function leatherG() { return clothTex('gale_leather', { bg: '#24402e', grain: 380, stitch: 'rgba(216,176,96,0.8)', stitchY: [6, 250] }); }
function hairTex() { const W = 128, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#d0dcd8'); gr.addColorStop(0.6, '#8aa8a0'); gr.addColorStop(1, '#4a6a62'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { const x = Math.random() * W; g.strokeStyle = Math.random() < 0.5 ? 'rgba(60,90,80,0.35)' : 'rgba(255,255,255,0.35)'; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 10, H); g.stroke(); } return tex(c, [1, 2]); }

export function buildGale(pal) {
  const D = GALE_DIMS, m = physKit(buildHumanoid(D)), J = m.J;
  // 사람 어깨를 허리(neck) 관절 위로 옮긴다
  J.neck.add(J.shoulderL); J.shoulderL.position.set(D.shW, 0.37, 0); J.neck.add(J.shoulderR); J.shoulderR.position.set(-D.shW, 0.37, 0); J.neck.scale.setScalar(1.12);
  const coatT = mottle('galeCoat', { base: '#6a7480', dark: '#363c46', light: '#9aa4b0', scale: 7, seed: 41, rep: [2, 1], bump: 1.2,
    paint: (g, W, H, r) => { for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H, rr = 6 + r() * 10, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(190,200,210,0.45)'); gr.addColorStop(1, 'rgba(190,200,210,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } } });
  const skinT = mottle('galeSkin', { base: '#d8b49a', dark: '#b88e74', light: '#ecc8b0', scale: 14, seed: 2, bump: 0.6 });
  const scaleT = scaleTex('galeScale', { bg: '#7a5a20', fg: '#e0b860', tip: '#8a6420', size: 18, rep: [3, 2] });
  const M = {
    coat: phys({ map: coatT.map, normalMap: coatT.normal, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xc8d8e8), sheenRoughness: 0.4 }),
    coatD: phys({ color: 0x2a2e36, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x8a9aa8) }),
    hoof: phys({ color: 0x1a1a1e, roughness: 0.35, clearcoat: 0.8 }),
    shoe: phys({ color: 0xd8b060, metalness: 1, roughness: 0.3 }),
    feather: phys({ map: cardTex('galeFeath', { root: '#e8eef0', tip: '#b8c8cc', n: 120 }), alphaTest: 0.4, roughness: 0.8, side: THREE.DoubleSide }),
    tail: phys({ map: T('galeHair', hairTex), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xd8fff0), side: THREE.DoubleSide }),
    saddle: phys({ map: T('galeSaddle', saddleTex), roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0x8affd0), side: THREE.DoubleSide }),
    gold: phys({ color: 0xe0b460, metalness: 1, roughness: 0.28, clearcoat: 0.4 }),
    scale: phys({ map: scaleT.map, normalMap: scaleT.normal, metalness: 0.9, roughness: 0.35, color: 0xffffff }),
    plate: phys({ color: 0x2e5a48, metalness: 0.7, roughness: 0.32, clearcoat: 0.6 }),
    leather: phys({ map: leatherG(), roughness: 0.6, side: THREE.DoubleSide }),
    skin: phys({ color: 0xb88866, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    glove: phys({ color: 0x2a2018, roughness: 0.55 }),
    wood: phys({ color: 0x2a1c14, roughness: 0.35, clearcoat: 0.8 }),
    blade: phys({ color: 0x8affd8, emissive: pal.accent, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.15, clearcoat: 1 }),
    glow: glowMat(pal.accent, 2.6),
    ribbon: phys({ color: 0x3ad8a0, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xc8fff0), side: THREE.DoubleSide }),
    red: phys({ color: 0xa81e2a, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xff8090), side: THREE.DoubleSide }),
  };
  /* ---------- 말 몸통 (축 = 관절 로컬 +Y 앞, +Z 아래 / 단면 rzF = 배 쪽, rzB = 등 쪽) ---------- */
  const hX = spl([[0, 0.01], [0.12, 0.14], [0.35, 0.205], [0.7, 0.21], [1, 0.2]]), hB = spl([[0, 0.01], [0.15, 0.17], [0.4, 0.22], [1, 0.215]]), hF = spl([[0, 0.01], [0.15, 0.2], [0.45, 0.29], [1, 0.285]]), hC = spl([[0, 0.0], [0.3, 0.08], [1, 0.12]]);
  const rumpMod = (p, u, v, c, sn) => { if (sn < 0) p.z -= 0.012 * gauss(Math.abs(p.x) - 0.09, 0.05) * smooth(0.2, 0.5, v); }; // 엉덩이 두 둔덕
  add(J.hips, C('rump', () => loft((v) => ({ y: -0.36 + 0.5 * v, rx: hX(v), rzF: hF(v), rzB: hB(v), cz: hC(v) }), 40, 16, { mod: rumpMod, poles: [0] })), M.coat);
  add(J.spine, C('barrel', () => loft((v) => ({ y: -0.03 + 0.47 * v, rx: 0.205 + 0.015 * Math.sin(v * Math.PI), rzF: 0.29 + 0.02 * Math.sin(v * Math.PI), rzB: 0.235, cz: 0.12 + 0.01 * Math.sin(v * Math.PI) }), 40, 12)), M.coat);
  const fX = spl([[0, 0.215], [0.5, 0.21], [0.75, 0.18], [0.92, 0.12], [1, 0.01]]), fB = spl([[0, 0.215], [0.5, 0.2], [0.8, 0.15], [1, 0.01]]), fF = spl([[0, 0.3], [0.5, 0.31], [0.8, 0.27], [1, 0.01]]), fC = spl([[0, 0.125], [0.6, 0.14], [1, 0.17]]);
  const frontP = (v) => ({ y: -0.03 + 0.6 * v, rx: fX(v), rzF: fF(v), rzB: fB(v), cz: fC(v) });
  add(J.chest, C('front', () => loft(frontP, 40, 18, { poles: [18], mod: (p, u, v, c, sn) => { if (sn > 0.3) p.y += 0.02 * gauss(Math.abs(p.x) - 0.09, 0.06) * smooth(0.6, 0.85, v); } })), M.coat);
  // 안장 천: 등 위를 덮고 옆으로 늘어진 녹색 천 + 금 테 + 붉은 술
  const sadP = (v) => ({ y: -0.0 + 0.4 * v, rx: 0.225 + 0.015 * Math.sin(v * Math.PI), rzF: 0.31, rzB: 0.252, cz: 0.12 });
  add(J.spine, C('saddle', () => loft(sadP, 24, 6, { a0: 0.66, a1: 1.34, mod: (p, u, v, c, sn) => { p.z += 0.03 * smooth(0.3, -0.3, Math.cos((u - 1) * TAU)); } })), M.saddle);
  for (const a of [0.66, 1.34]) for (let i = 0; i < 5; i++) { const q = loftAt(sadP, a, 0.1 + i * 0.2, new V3()); add(J.spine, C('sadTas', () => lathe([[0.004, 0], [0.012, -0.012], [0.015, -0.06], [0, -0.065]], 10)), M.red, [q.x * 1.03, q.y, q.z + 0.03], [Math.PI / 2, 0, 0]); }
  add(J.spine, C('sadRim0', () => tube(loftRing(sadP, 0, { a0: 0.66, a1: 1.34, n: 30 }), 0.007)), M.gold); add(J.spine, C('sadRim1', () => tube(loftRing(sadP, 1, { a0: 0.66, a1: 1.34, n: 30 }), 0.007)), M.gold);
  // 가슴 마갑: 앞가슴을 덮는 판 + 금 테 + 가운데 보석
  const pP = (v) => { const q = frontP(0.62 + 0.3 * v); return { ...q, rx: q.rx + 0.015, rzF: q.rzF + 0.015, rzB: q.rzB + 0.015 }; };
  add(J.chest, C('peytral', () => loft(pP, 28, 8, { a0: 0.2, a1: 0.8 })), M.plate);
  add(J.chest, C('peyRim', () => tube(loftRing(pP, 0, { a0: 0.2, a1: 0.8, n: 30 }), 0.008)), M.gold);
  { const q = loftAt(pP, 0.5, 0.45, new V3()); add(J.chest, C('peyGem', () => new THREE.OctahedronGeometry(0.035, 0)), M.glow, [q.x, q.y, q.z + 0.01]); }
  /* ---------- 말 뒷다리 (접지): 넓적다리 · 정강이 · 비절 아래 대롱뼈 · 발목 털 · 발굽 ---------- */
  const hoofG = C('hoof', () => lathe([[0.0, -0.075], [0.055, -0.075], [0.058, -0.06], [0.05, -0.01], [0.04, 0.0], [0, 0.0]], 18));
  const shoeG = C('shoe', () => new THREE.TorusGeometry(0.054, 0.007, 6, 20));
  const featherCards = (parent, key, y0) => parent.add(cards(C, key, M.feather, 40, (r) => { const a = r() * TAU, p = new V3(Math.cos(a) * 0.045, y0 + r() * 0.05, Math.sin(a) * 0.05), n = new V3(Math.cos(a), 0, Math.sin(a)); return { p, n, flow: new V3(Math.cos(a) * 0.4, -1, Math.sin(a) * 0.4), w: 0.04 + r() * 0.02, l: 0.07 + r() * 0.04 }; }, { lift: 0.002 }));
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, C('hthigh', () => limb(D.thigh, [[0, 0.14], [0.4, 0.13], [1, 0.075]], [[0, 0.16], [0.5, 0.14], [1, 0.08]], { mod: bulge([[0, 0.35, 0.02]]), nu: 22 })), M.coat);
    add(kn, C('hshin', () => limb(D.shin, [[0, 0.09], [0.5, 0.065], [1, 0.046]], [[0, 0.1], [0.5, 0.07], [1, 0.055]], { rzB: [[0, 0.08], [0.6, 0.07], [1, 0.06]], nu: 18 })), M.coat);
    add(ft, C('hock', () => new THREE.SphereGeometry(0.05, 12, 10)), M.coat, [0, 0, -0.01]);
    add(ft, C('cannon', () => limb(0.24, [[0, 0.05], [1, 0.042]], [[0, 0.055], [1, 0.048]], { nu: 14, nv: 4 })), M.coatD);
    add(ft, C('fetlock', () => new THREE.SphereGeometry(0.045, 12, 10)), M.coatD, [0, -0.25, 0.005]);
    add(ft, C('pastern', () => strand([[0, -0.25, 0.005], [0, -0.28, 0.02], [0, -0.31, 0.03]], 0.036, 0.04, { seg: 6, rad: 10 })), M.coatD);
    add(ft, hoofG, M.hoof, [0, -0.305, 0.032]); add(ft, shoeG, M.shoe, [0, -0.378, 0.032], [PI2, 0, 0]);
    featherCards(ft, 'hfeath', -0.3);
  }
  m.sole = 0.38;
  /* ---------- 말 앞다리 (리그 밖, root 직속 → rigHook IK) ---------- */
  const fore = [];
  for (const s of [1, -1]) {
    const up = new THREE.Group(), low = new THREE.Group(), hoof = new THREE.Group(); m.root.add(up); up.add(low); low.position.y = -FL.A; low.add(hoof); hoof.position.y = -FL.B;
    add(up, C('fupper', () => limb(FL.A, [[0, 0.14], [0.3, 0.12], [0.75, 0.07], [1, 0.05]], [[0, 0.17], [0.3, 0.13], [0.75, 0.075], [1, 0.055]], { y0: 0.08, mod: bulge([[0.5, 0.25, 0.02]]), nu: 20 })), M.coat);
    add(low, C('fknee', () => new THREE.SphereGeometry(0.047, 12, 10)), M.coatD);
    add(low, C('fcannon', () => limb(FL.B, [[0, 0.05], [1, 0.042]], [[0, 0.054], [1, 0.048]], { nu: 14, nv: 4 })), M.coatD);
    add(hoof, C('fetlock', () => new THREE.SphereGeometry(0.045, 12, 10)), M.coatD);
    add(hoof, C('fpastern', () => strand([[0, 0, 0], [0, -0.03, 0.015], [0, -0.055, 0.025]], 0.036, 0.04, { seg: 6, rad: 10 })), M.coatD);
    add(hoof, hoofG, M.hoof, [0, -0.055, 0.027]); add(hoof, shoeG, M.shoe, [0, -0.128, 0.027], [PI2, 0, 0]);
    featherCards(hoof, 'ffeath', -0.05);
    fore.push({ s, up, low, hoof, S: new V3(), H: new V3(), lift: 0 });
  }
  m.fore = fore;
  /* ---------- 꼬리 (로프 3가닥) ---------- */
  for (const [dx, k] of [[0, 1], [0.03, 0.7], [-0.03, 0.7]]) m.addRope(J.hips, new V3(dx, -0.33, -0.08), 7, 0.1 * k + 0.02, M.tail, (v) => (0.045 + 0.03 * Math.sin(v * Math.PI)) * k * (1 - 0.7 * v ** 3), { rest: new V3(0, -1, -0.3), caps: 'legs', flat: 0.85, stiff: 0.03, damp: 0.96 });
  /* ---------- 사람 상체: 허리 띠(말과 이음새) · 가죽 몸통 갑옷 · 금 비늘 흉갑 ---------- */
  const tX = spl([[0, 0.17], [0.3, 0.12], [0.55, 0.13], [0.8, 0.15], [0.93, 0.13], [1, 0.06]]), tF = spl([[0, 0.14], [0.3, 0.085], [0.62, 0.105], [0.82, 0.09], [1, 0.045]]), tB = spl([[0, 0.14], [0.3, 0.08], [0.7, 0.09], [1, 0.05]]);
  const torP = (v) => ({ y: -0.2 + 0.64 * v, rx: tX(v), rzF: tF(v), rzB: tB(v), n: 2.15 });
  add(J.neck, C('torso', () => loft(torP, 40, 20, { mod: (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.025 * gauss(ax - 0.06, 0.04) * gauss(v - 0.68, 0.08) * sn; } } })), M.leather);
  add(J.neck, C('skinTop', () => loft((v) => { const q = torP(0.9 + 0.1 * v); return { ...q, rx: q.rx + 0.002, rzF: q.rzF + 0.002, rzB: q.rzB + 0.002 }; }, 30, 4)), M.skin);
  const brP = (v) => { const q = torP(0.48 + 0.4 * v); return { ...q, rx: q.rx + 0.012, rzF: q.rzF + 0.014, rzB: q.rzB + 0.01 }; };
  add(J.neck, C('breast', () => loft(brP, 32, 10, { a0: 0.18, a1: 0.82 })), M.scale);
  add(J.neck, C('brRim0', () => tube(loftRing(brP, 0, { a0: 0.18, a1: 0.82, n: 30 }), 0.006)), M.gold); add(J.neck, C('brRim1', () => tube(loftRing(brP, 1, { a0: 0.18, a1: 0.82, n: 30 }), 0.006)), M.gold);
  { const q = loftAt(brP, 0.5, 0.55, new V3()); add(J.neck, C('brGem', () => new THREE.OctahedronGeometry(0.022, 0)), M.glow, [q.x, q.y, q.z + 0.008]); }
  // 이음새: 허리 위 털 띠 + 넓은 금 허리띠 + 앞 장식 천 두 자락
  const beltP = (v) => { const q = torP(0.08 + 0.12 * v); return { ...q, rx: q.rx + 0.012, rzF: q.rzF + 0.012, rzB: q.rzB + 0.012 }; };
  add(J.neck, C('belt', () => loft(beltP, 36, 4)), M.plate); add(J.neck, C('beltR0', () => tube(loftRing(beltP, 0, { n: 40 }), 0.007, 0.007, { closed: true, seg: 80 })), M.gold); add(J.neck, C('beltR1', () => tube(loftRing(beltP, 1, { n: 40 }), 0.007, 0.007, { closed: true, seg: 80 })), M.gold);
  J.neck.add(cards(C, 'waistFur', M.feather, 110, (r) => { const u = r(), p = loftAt(torP, u, 0.02 + r() * 0.06, new V3()), n = new V3(p.x, 0, p.z).normalize(); return { p: p.multiplyScalar(1.03), n, flow: new V3(0, -1, 0), w: 0.05 + r() * 0.02, l: 0.09 + r() * 0.05 }; }, { lift: 0.006 }));
  /* ---------- 팔: 맨 위팔 · 왼어깨 겹판 · 녹색 팔토시 · 가죽 장갑 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('delt', () => new THREE.SphereGeometry(0.05, 14, 10)), M.skin, [0, -0.005, 0]);
    add(sh, C('uarm', () => limb(D.uArm, [[0, 0.046], [0.4, 0.043], [1, 0.033]], [[0, 0.045], [0.4, 0.042], [1, 0.032]], { mod: bulge([[0.5, 0.42, 0.006]]) })), M.skin);
    add(el, C('farm', () => limb(D.lArm, [[0, 0.034], [0.3, 0.036], [1, 0.026]], [[0, 0.032], [0.3, 0.034], [1, 0.024]])), M.skin);
    const brc = (v) => ({ y: -0.04 - (D.lArm - 0.04) * v, rx: 0.039 - 0.008 * v, rz: 0.037 - 0.008 * v });
    add(el, C('bracer', () => loft(brc, 20, 6)), M.plate); add(el, C('brcR', () => tube(loftRing(brc, 0, { n: 24 }), 0.004, 0.004, { closed: true, seg: 48 })), M.gold);
    const hg = clawHand(C, 'hand', { s, n: 4, len: 0.06, r: 0.008, curl: s < 0 ? 2.4 : 1.2, palm: [0.025, 0.05, 0.014], mat: M.glove }); hg.position.y = -0.005; ha.add(hg);
    const nP = s > 0 ? 3 : 1;
    for (let k = 0; k < nP; k++) { const pp = (v) => ({ y: 0.06 - k * 0.04 - 0.07 * v, rx: 0.065 + 0.012 * k + 0.02 * v, rz: 0.062 + 0.012 * k + 0.018 * v }), a0 = s > 0 ? 0.02 : 0.52, a1 = a0 + 0.46;
      add(sh, C(`pld${s}${k}`, () => loft(pp, 20, 4, { a0, a1 })), M.plate, [s * 0.012, 0, 0]); add(sh, C(`pldR${s}${k}`, () => tube(loftRing(pp, 1, { a0, a1, n: 20 }).map((q) => q.add(new V3(s * 0.012, 0, 0))), 0.004)), M.gold); }
  }
  /* ---------- 머리: 얼굴 + 매 부리 투구 (빛나는 눈 틈 · 깃털 볏 · 옆 날개) · 은빛 머리채 ---------- */
  add(J.head, C('neckH', () => limb(0.12, [[0, 0.036], [1, 0.032]], [[0, 0.036], [1, 0.032]], { y0: 0.02, nu: 14, nv: 4 })), M.skin, [0, 0.07, 0]);
  const H = J.head; H.scale.setScalar(1.15);
  add(H, C('face', () => surf((u, v, p) => { const d = HEAD.dirOf((u - 0.5) * TAU, -PI2 + v * Math.PI); HEAD.headPt(d.x, d.y, d.z, p); }, 64, 48, { closedU: true, poles: [0, 48] })), M.skin);
  // 투구: 머리 윗부분을 감싸는 판 + 앞으로 내려온 매 부리 가면 (눈 높이 아래까지)
  add(H, C('helm', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, front = Math.cos(az), el0 = front > 0 ? -0.05 - 0.45 * smooth(0.55, 1, front) : 0.25 - 0.55 * smooth(-0.2, -1, front), el = el0 + (PI2 - el0) * v;
    HEAD.headAt(az, el, 0.012 + 0.006 * (1 - v), p); if (front > 0.85) { const k = smooth(0.85, 1, front) * smooth(0.6, -0.4, el); p.z += 0.03 * k; p.y -= 0.02 * k; } }, 56, 16, { closedU: true, poles: [16] })), M.plate);
  add(H, C('helmRim', () => { const pts = []; for (let i = 0; i <= 56; i++) { const az = (i / 56 - 0.5) * TAU, front = Math.cos(az), el0 = front > 0 ? -0.05 - 0.45 * smooth(0.55, 1, front) : 0.25 - 0.55 * smooth(-0.2, -1, front), p = HEAD.headAt(az, el0, 0.016); if (front > 0.85) { const k = smooth(0.85, 1, front) * smooth(0.6, -0.4, el0); p.z += 0.03 * k; p.y -= 0.02 * k; } pts.push(p); } return tube(pts, 0.005, 0.005, { closed: true, seg: 120 }); }), M.gold);
  add(H, C('helmCrest', () => { const pts = []; for (let i = 0; i <= 16; i++) { const el = 0.2 + (i / 16) * 2.2; pts.push(el <= PI2 ? HEAD.headAt(0, el, 0.022) : HEAD.headAt(Math.PI, Math.PI - el, 0.022)); } return tube(pts, 0.009, 0.006); }), M.gold);
  for (const s of [-1, 1]) { const q = HEAD.headAt(s * 0.32, 0.03, 0.018); add(H, C('eyeSlit', () => { const g = new THREE.BoxGeometry(0.032, 0.007, 0.01); return g; }), M.glow, q.toArray(), [0, s * 0.3, -s * 0.18]);
    // 옆 날개 장식: 깃털 판 셋
    for (let k = 0; k < 3; k++) { const w = add(H, C('wingF', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.02, 0.06, 0.012, 0.13); sh.quadraticCurveTo(-0.005, 0.07, -0.012, 0.0); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false }); }), M.gold, HEAD.headAt(s * 1.45, 0.25, 0.016).toArray()); w.rotation.set(-0.9 - k * 0.3, s * 1.4, 0); } }
  for (let k = 0; k < 5; k++) { const fg = add(H, C('plume', () => { const g = new THREE.PlaneGeometry(0.06, 0.24); g.translate(0, 0.12, 0); return g; }), M.feather, HEAD.headAt(Math.PI, 1.2 - k * 0.12, 0.03).toArray()); fg.rotation.set(-1.9 + k * 0.08, (k - 2) * 0.25, 0); }
  m.addRope(H, HEAD.headAt(Math.PI, 0.5, 0.02), 8, 0.07, M.tail, (v) => 0.03 * (1 - 0.6 * v) + 0.006, { rest: new V3(0, -0.5, -1), flat: 0.5, side: new V3(1, 0, 0), stiff: 0.12 });
  for (const s of [-1, 1]) m.addRope(H, HEAD.headAt(Math.PI + s * 0.6, 0.15, 0.02), 6, 0.065, M.tail, (v) => 0.022 * (1 - 0.6 * v) + 0.004, { rest: new V3(s * 0.3, -0.6, -1), flat: 0.5, side: new V3(1, 0, 0), stiff: 0.1 });
  /* ---------- 창: 긴 자루 · 금 띠 · 날개 달린 잎 모양 날 · 바람 리본 ---------- */
  const spear = new THREE.Group(); J.weapon.add(spear); m.spear = spear;
  add(spear, C('shaft', () => { const g = new THREE.CylinderGeometry(0.019, 0.022, SPEAR.tip - 0.4 - SPEAR.butt, 12); g.rotateX(PI2); g.translate(0, 0, (SPEAR.tip - 0.4 + SPEAR.butt) / 2); return g; }), M.wood);
  for (const z of [SPEAR.butt + 0.04, -0.15, 0.25, SPEAR.tip - 0.45]) add(spear, C('band', () => new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12)), M.gold, [0, 0, z], [PI2, 0, 0]);
  add(spear, C('butt', () => { const g = new THREE.ConeGeometry(0.026, 0.1, 10); g.rotateX(-PI2); g.translate(0, 0, SPEAR.butt - 0.04); return g; }), M.gold);
  add(spear, C('blade', () => surf((u, v, p) => { const z = SPEAR.tip - 0.42 + 0.42 * v, w = 0.075 * Math.sin(Math.PI * Math.min(1, v * 1.15)) ** 0.7 * (1 - v * 0.2), th = u * TAU; p.set(Math.cos(th) * w, Math.sin(th) * 0.012 * (1 - v), z); }, 16, 20, { closedU: true })), M.blade);
  for (const s of [-1, 1]) add(spear, C('wing' + s, () => strand([[0, 0, SPEAR.tip - 0.45], [s * 0.08, 0, SPEAR.tip - 0.48], [s * 0.15, 0, SPEAR.tip - 0.42], [s * 0.17, 0, SPEAR.tip - 0.34]], 0.012, 0.004, { seg: 16, rad: 6, flat: 0.4, ref: [0, 1, 0] })), M.gold);
  for (const s of [-1, 1]) m.addRope(spear, new V3(s * 0.02, 0, SPEAR.tip - 0.47), 5, 0.07, M.ribbon, (v) => 0.02 * (1 - 0.5 * v), { rest: new V3(0, -1, -0.3), flat: 0.15, side: new V3(0, 0, 1), caps: 'none', stiff: 0.05 });
  /* ---------- rigHook: 창 방향(몸 기준) · 돌격 질주 · 앞다리 IK ---------- */
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion(), tS = new V3(), tH = new V3(), tK = new V3();
  m.weaponOut = false; m.setWeapon = (v) => { spear.visible = v; m.weaponOut = !v; };
  m.rigHook = (f) => {
    // 돌격(gallop) 기술 중에는 뒷다리에 질주 사이클을 더한다
    const gal = f.state === 'act' && f.act && f.act.gallop ? f.act.gallop(f, f.at) : 0, ph = gal ? f.at * 15 : f.runP;
    if (gal) { const s1 = Math.sin(ph), s2 = Math.sin(ph + 0.5); J.hipL.rotation.x += 0.55 * s1 * gal; J.hipR.rotation.x += 0.55 * s2 * gal; J.kneeL.rotation.x += 0.4 * Math.max(0, Math.cos(ph)) * gal; J.kneeR.rotation.x += 0.4 * Math.max(0, Math.cos(ph + 0.5)) * gal; J.hips.rotation.x += 0.05 * Math.cos(ph) * gal; }
    // 창: weapon = [위로 숙임(+), 오른쪽(+), 비틀기] (몸 기준)
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE); m.root.getWorldQuaternion(wR); J.weapon.parent.updateWorldMatrix(true, false); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ));
    // 앞다리: 가슴 로컬 어깨점 → root 로컬, 목표 발굽 위치를 정하고 2마디 IK
    m.root.updateMatrixWorld(true);
    const air = !f.onGround && f.state !== 'act', down = f.state === 'down' || (f.state === 'ko' && f.onGround), run = f.state === 'run' || gal > 0, rear = f.state === 'act' && f.act && f.act.rear ? f.act.rear(f, f.at) : f.state === 'win' ? 1 : 0;
    for (const L of fore) {
      J.chest.localToWorld(tS.set(L.s * FL.sh[0], FL.sh[1], FL.sh[2])); m.root.worldToLocal(tS); L.up.position.copy(tS);
      const gy = 0; let hx = tS.x, hz = tS.z + 0.04, hy = gy;
      if (run) { const p = ph + Math.PI * 0.85 + (L.s > 0 ? 0 : 0.45), k = Math.max(gal, f.state === 'run' ? 1 : 0); hz += 0.36 * Math.cos(p) * k; hy += Math.max(0, -Math.sin(p)) * 0.32 * k; }
      if (air) { hy = tS.y - 0.55; hz = tS.z + 0.25; }
      if (down) { hy = tS.y - 0.25; hz = tS.z + 0.45; }
      if (rear > 0) { const ry = tS.y - 0.42, rz = tS.z + 0.32 + 0.08 * Math.sin(f.G ? f.G.time * 9 + L.s : 0); hy += (ry - hy) * rear; hz += (rz - hz) * rear; }
      // 발목 위(구절) 목표: 발굽 위로 hoof 높이
      tH.set(hx, hy + FL.hoof, hz); const dy = tH.y - tS.y, dz = tH.z - tS.z, d = Math.hypot(dy, dz), phi = Math.atan2(dz, -dy), [A, bend] = ik2(FL.A, FL.B, d);
      const upA = phi + A, lowA = upA - bend; // 아래로부터 앞쪽(+) 각도: 무릎(완골)이 앞으로 나온다
      L.up.rotation.set(-upA, 0, 0); L.low.rotation.set(bend, 0, 0);
      const lifted = hy - gy > 0.05 ? smooth(0.05, 0.3, hy - gy) : 0; L.hoof.rotation.set(lowA + lifted * 1.2, 0, 0);
    }
  };
  /* ---------- 매 프레임 ---------- */
  m.update = (dt, f) => {
    M.glow.emissiveIntensity = 2.2 + 0.6 * Math.sin(f.G.time * 4) + (f.enraged ? 1.2 : 0); M.blade.emissiveIntensity = 0.6 + (f.state === 'act' ? 1.2 : 0) + (f.enraged ? 0.6 : 0);
    const sc = f.scale, h0 = f.hurt[0], h1 = f.hurt[1], body = [{ a: h0.a, b: h0.b, r: 0.3 * sc }, { a: h1.a, b: h1.b.clone().lerp(h1.a, 0.4), r: 0.12 * sc }], legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.05 * sc }));
    m.stepRopes(dt, f, body, legs);
  };
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, SPEAR.tip - 0.1)); };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.2)); J.weapon.localToWorld(t.set(0, 0, SPEAR.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, SPEAR.tip - 0.5)); J.weapon.localToWorld(t.set(0, 0, SPEAR.tip)); };
  return m;
}

/* =====================================================================
   켄타우로스 자세 (P = 골반 앞으로 90°)
   ===================================================================== */
const P = PI2;
const legs = (a = 0) => ({ hipL: [-P - 0.35 + a, 0, 0.02], kneeL: [0.75, 0, 0], footL: [-0.4, 0, 0], hipR: [-P - 0.35 + a, 0, -0.02], kneeR: [0.75, 0, 0], footR: [-0.4, 0, 0] });
export const galePoses = {
  base: { hips: [P, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [-P + 0.05, 0, 0], head: [-0.05, 0.1, 0],
    shoulderL: [-0.55, 0, 0.3], elbowL: [-1.2, 0, 0], handL: [0, 0, 0], shoulderR: [-0.3, 0, -0.25], elbowR: [-1.25, 0, 0], handR: [0, 0, 0], weapon: [0.35, 0.05, 0], ...legs() },
  run: { neck: [-P + 0.3, 0, 0], head: [-0.2, 0, 0], chest: [0.02, 0, 0], shoulderR: [-0.15, 0, -0.35], elbowR: [-1.5, 0, 0], weapon: [0.05, 0.08, 0], shoulderL: [-0.8, 0, 0.2] },
  jump: { hips: [P - 0.15, 0, 0], neck: [-P + 0.2, 0, 0], hipL: [-P - 0.75, 0, 0], kneeL: [1.3, 0, 0], footL: [-0.7, 0, 0], hipR: [-P - 0.75, 0, 0], kneeR: [1.3, 0, 0], footR: [-0.7, 0, 0], weapon: [0.6, 0, 0] },
  guard: { neck: [-P - 0.05, 0.3, 0], shoulderR: [-1.0, 0, 0.2], elbowR: [-1.4, 0, 0], shoulderL: [-1.1, 0, -0.1], elbowL: [-1.2, 0, 0], weapon: [1.0, -0.6, 0.4], ...legs(-0.05) },
  hit: { neck: [-P - 0.3, -0.2, 0], head: [-0.3, 0, 0], chest: [-0.05, 0, 0], shoulderL: [0.2, 0, 0.6], weapon: [0.8, 0.2, 0] },
  air: { hips: [P - 0.3, 0, 0.1], neck: [-P - 0.2, 0, 0], ...legs(0.2), shoulderL: [0.4, 0, 0.8], weapon: [1.0, 0.3, 0] },
  down: { hipY: -0.55, hips: [P, 0, 0.25], neck: [-P + 0.3, 0, -0.2], hipL: [-P - 1.3, 0, 0.1], kneeL: [2.3, 0, 0], footL: [-1.0, 0, 0], hipR: [-P - 1.2, 0, -0.1], kneeR: [2.2, 0, 0], footR: [-1.0, 0, 0], shoulderL: [-0.2, 0, 0.5], weapon: [-0.1, 0.3, 0] },
  dash: { neck: [-P + 0.35, 0, 0], hipL: [-P + 0.3, 0, 0], kneeL: [0.5, 0, 0], hipR: [-P + 0.2, 0, 0], kneeR: [0.6, 0, 0], weapon: [0.05, 0, 0] },
  win: { hips: [P - 0.65, 0, 0], neck: [-P + 0.55, 0, 0], head: [-0.25, 0, 0], ...legs(0.65), shoulderR: [-2.8, 0, -0.2], elbowR: [-0.3, 0, 0], weapon: [1.4, 0, 0], shoulderL: [-0.3, 0, 0.6] },
  portrait: { neck: [-P + 0.05, -0.35, 0], head: [0, 0.3, 0], shoulderR: [-1.6, 0, -0.3], elbowR: [-1.0, 0, 0], weapon: [1.3, -0.2, 0] },
  crouch: { hipY: -0.12, ...legs(-0.15), kneeL: [1.05, 0, 0], kneeR: [1.05, 0, 0], footL: [-0.55, 0, 0], footR: [-0.55, 0, 0], neck: [-P + 0.25, 0, 0] },
};
// 평소 달리기(질주): 뒷다리가 거의 함께 박차고, 몸통이 앞뒤로 출렁 · 사람 상체는 반대로 버텨 안정
export function galeRun(out, ph) {
  const s1 = Math.sin(ph), s2 = Math.sin(ph + 0.5), c = Math.cos(ph);
  out[JI.hipL] += 0.6 * s1; out[JI.hipR] += 0.6 * s2; out[JI.kneeL] += 0.5 * Math.max(0, c); out[JI.kneeR] += 0.5 * Math.max(0, Math.cos(ph + 0.5));
  out[JI.hips] += 0.06 * c; out[JI.neck] -= 0.06 * c; out[0] += Math.abs(c) * 0.05;
}
