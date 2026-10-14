// 궤도 성역 몬스터 모델 — 별빛 수호병 · 성좌 마법사 · 수정 거상 · 성좌의 심판자 아스트라
// 조형 도구는 snow_model.js 와 공유한다 (로프트 판갑 · 금테 · 별자리 캔버스 텍스처 · 육각 수정).
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { Rope, RopeTube, Cloth } from '../../cloth.js';
import { animeHead } from '../../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, gauss, smooth, envCube, cached } from '../../sculpt.js';
import { GOLEM_DIMS } from '../bodies.js';
import { xf, merge, zLoft, crystalGeo, sculptHand, cv, tex, rng, T, std, phys, glowMat, ropeStep, adder } from './snow_model.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = (k, fn) => cached('orbit:' + k, fn);
export const GOLD = 0xffd27a, STAR = 0xbfd4ff, VIO = 0xd0a8ff;

/* ---------- 텍스처 ---------- */
function starPath(g, x, y, r0, r1, n = 4, rot = -Math.PI / 2) { g.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r1 : r0; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
const starShape = (r0, r1, n = 4) => { const sh = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i / (n * 2)) * TAU, r = i % 2 ? r1 : r0; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath(); return sh; };
const starGeo = (r0, r1, n = 4, d = 0.004) => new THREE.ExtrudeGeometry(starShape(r0, r1, n), { depth: d, bevelEnabled: true, bevelThickness: d * 0.4, bevelSize: d * 0.4, bevelSegments: 1 });
// 별자리 천: 남빛 바탕 + 금 별 + 별을 잇는 선 (hem: 캔버스 위쪽에 금 띠)
function constTex(base = '#141a3e', base2 = '#2a2470', seed = 3, hem = true, alphaHem = false) {
  const W = 1024, H = 1024, [c, g] = cv(W, H), r = rng(seed);
  const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, base); gr.addColorStop(1, base2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(200,210,255,${r() * 0.5})`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
  for (let k = 0; k < 9; k++) { const cx = r() * W, cy = r() * H * 0.8 + H * 0.1, pts = []; for (let i = 0; i < 5; i++) pts.push([cx + (r() - 0.5) * 220, cy + (r() - 0.5) * 200]);
    g.strokeStyle = 'rgba(255,214,130,0.55)'; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    for (const [x, y] of pts) { g.fillStyle = '#ffe2a0'; starPath(g, x, y, 9 + r() * 7, 3); g.fill(); } }
  if (hem) { g.fillStyle = '#e8b85a'; g.fillRect(0, 8, W, 10); g.fillRect(0, 34, W, 4); for (let x = 20; x < W; x += 64) { g.fillStyle = '#ffd88a'; starPath(g, x, 26, 9, 3); g.fill(); } }
  if (alphaHem) { g.globalCompositeOperation = 'destination-out'; for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 40 + (x * 7) % 40); g.lineTo(x + 48, 0); g.closePath(); g.fill(); } g.globalCompositeOperation = 'source-over'; }
  return tex(c);
}
// 흰 비단 + 금 별 자수 (아스트라 예복)
function robeTex() {
  const W = 1024, H = 1024, [c, g] = cv(W, H), r = rng(11); const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, '#f6f4ee'); gr.addColorStop(0.7, '#ebe8f4'); gr.addColorStop(1, '#d8d4f0'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) { const x = (i / 24) * W, fg = g.createLinearGradient(x, 0, x + W / 24, 0); fg.addColorStop(0, 'rgba(255,255,255,0.15)'); fg.addColorStop(1, 'rgba(60,50,110,0.12)'); g.fillStyle = fg; g.fillRect(x, 0, W / 24, H); }
  for (let i = 0; i < 40; i++) { const x = r() * W, y = H * (0.04 + 0.5 * r() ** 1.5); g.fillStyle = '#e2b450'; starPath(g, x, y, 10 + r() * 10, 3.5); g.fill(); }
  g.fillStyle = '#d8a440'; g.fillRect(0, 6, W, 14); g.fillStyle = '#2a2470'; g.fillRect(0, 26, W, 10); g.fillStyle = '#d8a440'; g.fillRect(0, 40, W, 4);
  return tex(c);
}
// 황도 고리: 투명 바탕에 금 글리프
function zodiacTex() {
  const W = 1024, H = 128, [c, g] = cv(W, H), r = rng(5); g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,220,140,0.9)'; g.fillRect(0, 6, W, 6); g.fillRect(0, H - 12, W, 6);
  g.strokeStyle = 'rgba(255,230,160,1)'; g.lineWidth = 5; g.lineCap = 'round';
  for (let k = 0; k < 12; k++) { const x = (k + 0.5) * W / 12, y = H / 2; g.beginPath();
    for (let s = 0; s < 3; s++) { const a = r() * TAU; g.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); g.quadraticCurveTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30, x + Math.cos(a + 2) * 22, y + Math.sin(a + 2) * 22); }
    g.stroke(); g.fillStyle = 'rgba(255,240,200,1)'; starPath(g, x + W / 24, y, 8, 3); g.fill(); }
  return tex(c);
}
function metalTex(seed = 2, base = '#d8dce8') { const W = 256, [c, g] = cv(W, W), r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, W); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,20' : '255,255,255'},${r() * 0.06})`; g.fillRect(r() * W, r() * W, 30 * r(), 1); } return tex(c); }
function hairTexG() { const W = 256, H = 512, [c, g] = cv(W, H), r = rng(37); g.fillStyle = '#f0d690'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.4 ? '#c09040' : k > 0.85 ? '#fff4d0' : '#e8c878'; g.globalAlpha = 0.35 + r() * 0.4; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.bezierCurveTo(x + (r() - 0.5) * 30, H * 0.66, x + (r() - 0.5) * 30, H * 0.33, x + (r() - 0.5) * 12, 0); g.stroke(); }
  g.globalAlpha = 1; return tex(c); }

const plateMats = (env) => ({
  steel: phys({ map: T('o:steel', () => metalTex(2)), color: 0xeef0f8, metalness: 0.9, roughness: 0.22, clearcoat: 0.4 }),
  steelD: phys({ color: 0x8a90a8, metalness: 0.9, roughness: 0.3 }),
  gold: phys({ color: 0xf2c25a, metalness: 1, roughness: 0.22, clearcoat: 0.4 }),
  under: phys({ color: 0x1c1e34, roughness: 0.65, sheen: 0.6, sheenColor: new THREE.Color(0x6a6aa8) }),
  leather: std({ color: 0x2a2234, roughness: 0.7 }),
});
// 로프트 판 · 금테 도우미
function kitFor(add) {
  const rim = (parent, key, pts, r, closed, mat) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !((o.a1 ?? 1) - (o.a0 ?? 0) < 0.999), mat);
  return { rim, lRim };
}

/* =====================================================================
   1. 별빛 수호병 — 은빛 판갑 기사 · 별 투구 · 별창 · 원형 방패
   ===================================================================== */
export const KNIGHT_DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.21, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44, headTop: 0.24 };
export function buildSentinel(pal, o = {}) {
  const D = KNIGHT_DIMS, m = buildHumanoid(D), J = m.J, extras = [], acc = pal.accent ?? 0x9ab8ff;
  const M = { ...plateMats(), glow: glowMat(acc, 3), star: glowMat(0xdfe8ff, 3.4), tabard: phys({ map: T('o:tab', () => constTex('#10183a', '#1c2a5a', 7)), roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0x8a9aff), side: THREE.DoubleSide }) };
  const add = adder(), { rim, lRim } = kitFor(add);
  // 골반: 속옷 + 앞뒤 허리 판(tasset) + 별자리 휘장
  add(J.hips, C('k:pel', () => loft((v) => ({ y: 0.08 - 0.18 * v, rx: 0.13 + 0.02 * v, rzF: 0.095, rzB: 0.1, n: 2.3 }), 28, 6)), M.under);
  const TS = (v) => ({ y: 0.02 - 0.2 * v, rx: 0.15 + 0.05 * v, rzF: 0.11 + 0.04 * v, rzB: 0.12 + 0.04 * v, n: 2.2 });
  for (const [a0, a1, k] of [[0.3, 0.46, 'L'], [0.54, 0.7, 'R'], [0.06, 0.22, 'BL'], [0.78, 0.94, 'BR']]) { add(J.hips, C('k:tas' + k, () => loft(TS, 12, 4, { a0, a1 })), M.steel); lRim(J.hips, 'k:tasR' + k, TS, 1, 0.005, M.gold, { a0, a1 }); }
  const TAB = (v) => ({ y: 0.03 - 0.5 * v, rx: 0.13 + 0.06 * v, rzF: 0.105 + 0.05 * v, rzB: 0.11 + 0.05 * v, n: 2.2 });
  const tabF = add(J.hips, C('k:tabF', () => loft(TAB, 10, 8, { a0: 0.44, a1: 0.56 })), M.tabard), tabB = add(J.hips, C('k:tabB', () => loft(TAB, 10, 8, { a0: -0.07, a1: 0.07 })), M.tabard);
  add(J.hips, C('k:belt', () => loft((v) => ({ y: 0.02 + 0.05 * v, rx: 0.145, rzF: 0.108, rzB: 0.114, n: 2.3 }), 40, 2)), M.leather);
  add(J.hips, C('k:buckle', () => starGeo(0.03, 0.012, 4, 0.006)), M.gold, [0, 0.045, 0.112]);
  // 몸통: 배 갑 (겹친 띠) · 흉갑 (가운데 능선) · 금테 · 가슴의 별
  for (let i = 0; i < 3; i++) { const P = (v) => ({ y: 0.0 + i * 0.065 + 0.07 * v, rx: 0.12 + i * 0.006 + 0.004 * v, rzF: 0.09 + i * 0.004, rzB: 0.088, n: 2.3 }); add(J.spine, C('k:lame' + i, () => loft(P, 40, 3)), M.steel); lRim(J.spine, 'k:lameR' + i, P, 1, 0.003, M.gold); }
  const cX = spl([[0, 0.13], [0.4, 0.158], [0.75, 0.165], [1, 0.11]]), cF = spl([[0, 0.1], [0.45, 0.12], [1, 0.08]]);
  const CU = (v) => ({ y: -0.02 + 0.3 * v, rx: cX(v), rzF: cF(v), rzB: 0.1 + 0.01 * v, n: 2.4 });
  const cuMod = (p, u, v, c, sn) => { if (sn > 0) p.z += 0.012 * gauss(p.x, 0.02) * sn - 0.008 * gauss(Math.abs(p.x) - 0.06, 0.03) * gauss(v - 0.4, 0.3); };
  add(J.chest, C('k:cuir', () => loft(CU, 48, 14, { mod: cuMod })), M.steel);
  lRim(J.chest, 'k:cuirTop', CU, 1, 0.006, M.gold, { mod: cuMod }); lRim(J.chest, 'k:cuirBot', CU, 0, 0.005, M.gold, { mod: cuMod });
  { const p = loftAt(CU, 0.5, 0.55, new V3(), cuMod); add(J.chest, C('k:cstar', () => starGeo(0.05, 0.016, 4, 0.008)), M.gold, [p.x, p.y, p.z + 0.004]); add(J.chest, C('k:cgem', () => new THREE.OctahedronGeometry(0.018, 0)), M.star, [p.x, p.y, p.z + 0.016]); }
  add(J.chest, C('k:gorget', () => loft((v) => ({ y: 0.27 + 0.07 * v, rx: 0.1 - 0.04 * v, rzF: 0.085 - 0.03 * v, rzB: 0.085 - 0.03 * v }), 32, 4)), M.steel);
  lRim(J.chest, 'k:gorR', (v) => ({ y: 0.34, rx: 0.06, rzF: 0.055, rzB: 0.055 }), 0, 0.004, M.gold);
  // 등 뒤 짧은 망토 판 (별자리 천)
  add(J.chest, C('k:capeB', () => loft((v) => ({ y: 0.3 - 0.62 * v, rx: 0.17 + 0.05 * v, rzF: 0.13, rzB: 0.12 + 0.06 * v, n: 2.2 }), 16, 10, { a0: -0.17, a1: 0.17 })), M.tabard);
  // 팔: 견갑(세 겹) · 상완 · 팔꿈치 · 하완 · 장갑
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('k:ua', () => loft((v) => ({ y: 0.02 - (D.uArm + 0.02) * v, rx: 0.052 - 0.01 * v, rz: 0.05 - 0.01 * v }), 20, 6)), M.under);
    for (let k = 0; k < 3; k++) { const g = new THREE.Group(); g.position.set(s * 0.012, 0.04 - k * 0.05, 0); g.rotation.z = s * (0.25 + k * 0.12); sh.add(g);
      const R = 0.1 - k * 0.006; add(g, C('k:pau' + k, () => new THREE.SphereGeometry(R, 22, 10, 0, TAU, 0, Math.PI * 0.42)), M.steel, [0, 0, 0], [0, 0, 0], [1.1, 0.9, 1.05]);
      if (k === 0) add(g, C('k:pauR' + k, () => new THREE.TorusGeometry(R * Math.sin(Math.PI * 0.42), 0.004, 6, 32)), M.gold, [0, R * Math.cos(Math.PI * 0.42) * 0.9, 0], [Math.PI / 2, 0, 0], [1.1, 1.05, 1]); }
    add(sh, C('k:rere', () => loft((v) => ({ y: -0.06 - 0.18 * v, rx: 0.058, rz: 0.056 }), 24, 3)), M.steel);
    add(el, C('k:couter', () => xf(new THREE.SphereGeometry(0.05, 16, 10, 0, TAU, 0, Math.PI * 0.55), [0, 0, 0], [Math.PI / 2 - 0.4, 0, 0])), M.steel, [0, 0, -0.01]);
    const VB = (v) => ({ y: -0.02 - (D.lArm - 0.06) * v, rx: 0.044 + 0.004 * v, rz: 0.046 + 0.006 * Math.sin(v * Math.PI) });
    add(el, C('k:vamb', () => loft(VB, 24, 6)), M.steel); lRim(el, 'k:vambR', VB, 1, 0.004, M.gold);
    const hg = sculptHand(add, ha, 'k:', s, M.steelD, 1.05); hg.position.y = -0.004;
    add(ha, C('k:gauntCuff', () => loft((v) => ({ y: 0.01 - 0.04 * v, rx: 0.05 + 0.008 * v, rz: 0.048 + 0.008 * v }), 20, 2)), M.steel);
  }
  // 원형 방패 (왼팔)
  { const g = new THREE.Group(); g.position.set(0.06, -0.14, 0.02); g.rotation.set(0, Math.PI / 2, 0); J.elbowL.add(g);
    add(g, C('k:shield', () => lathe([[0, 0.03], [0.12, 0.022], [0.2, 0.008], [0.21, 0], [0.205, -0.008], [0, -0.004]], 40)), M.steel, [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(g, C('k:shRim', () => new THREE.TorusGeometry(0.205, 0.008, 8, 48)), M.gold);
    add(g, C('k:shStar', () => starGeo(0.12, 0.035, 4, 0.008)), M.gold, [0, 0, 0.024]);
    add(g, C('k:shGem', () => new THREE.OctahedronGeometry(0.025, 0)), M.star, [0, 0, 0.04]); }
  // 다리: 넓적다리 판 · 무릎 · 정강이 · 철 신
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, C('k:th', () => loft((v) => ({ y: 0.03 - (D.thigh + 0.03) * v, rx: 0.074 - 0.018 * v, rz: 0.078 - 0.02 * v }), 20, 6)), M.under);
    const CS = (v) => ({ y: -0.04 - 0.3 * v, rx: 0.08 - 0.016 * v, rzF: 0.084 - 0.02 * v, rzB: 0.07 - 0.01 * v });
    add(hp, C('k:cuisse', () => loft(CS, 24, 6, { a0: 0.18, a1: 0.82 })), M.steel); lRim(hp, 'k:cuR', CS, 0, 0.004, M.gold, { a0: 0.18, a1: 0.82 });
    add(kn, C('k:poleyn', () => xf(new THREE.SphereGeometry(0.056, 16, 10, 0, TAU, 0, Math.PI * 0.5), [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.8])), M.steel, [0, 0, 0.03]);
    add(kn, C('k:polStar', () => starGeo(0.025, 0.009, 4, 0.004)), M.gold, [0, 0, 0.078]);
    const GR = spl([[0, 0.058], [0.3, 0.062], [0.8, 0.045], [1, 0.044]]), GB = spl([[0, 0.06], [0.3, 0.07], [0.8, 0.046], [1, 0.045]]);
    add(kn, C('k:greave', () => loft((v) => ({ y: -0.02 - (D.shin - 0.04) * v, rx: GR(v), rzF: GR(v) * 1.05, rzB: GB(v) }), 24, 10, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z += 0.01 * gauss(p.x, 0.015) * sn; } })), M.steel);
    add(ft, C('k:sab', () => zLoft((v) => { const e = Math.sin(Math.PI * Math.min(1, v * 1.04)) ** 0.5; return { z: -0.07 + 0.26 * v, rx: 0.05 * e + 0.004, ryT: 0.05 * e * (1 - 0.5 * v), ryB: 0.03 * e, cy: -0.03 }; }, 24, 14)), M.steel);
    for (let k = 0; k < 3; k++) add(ft, C('k:sabR' + k, () => new THREE.TorusGeometry(0.046 - k * 0.006, 0.003, 5, 20, Math.PI)), M.gold, [0, -0.03, 0.05 + k * 0.035], [0, 0, 0], [1, 0.9 - k * 0.15, 1]);
  }
  // 투구: 둥근 대투구 + 별빛 눈구멍 + 금 볏
  add(J.neck, C('k:neck', () => loft((v) => ({ y: -0.02 + 0.12 * v, rx: 0.045, rz: 0.045 }), 16, 3)), M.under);
  const H = J.head, HM = (v) => { const e = Math.sin(Math.PI * Math.min(1, 0.06 + v * 0.94)); return { y: 0.0 + 0.28 * v, rx: 0.105 * e ** 0.55 + 0.004 * (1 - v), rzF: 0.115 * e ** 0.55, rzB: 0.115 * e ** 0.55, n: 2.2 }; };
  add(H, C('k:helm', () => loft(HM, 40, 18, { poles: [18], mod: (p, u, v, c, sn) => { if (sn > 0.3) p.z += 0.025 * gauss(p.x, 0.04) * smooth(0.2, 0.55, v) * (1 - smooth(0.75, 1, v)); } })), M.steel);
  add(H, C('k:visor', () => xf(new THREE.BoxGeometry(0.15, 0.016, 0.02), [0, 0, 0], [0, 0, 0])), M.star, [0, 0.13, 0.128]);
  add(H, C('k:visorV', () => new THREE.BoxGeometry(0.016, 0.07, 0.02)), M.star, [0, 0.095, 0.132]);
  lRim(H, 'k:helmR', HM, 0.02, 0.006, M.gold);
  add(H, C('k:crest', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.12, 0.1, 0.26, 0.04); sh.quadraticCurveTo(0.14, 0.03, 0.02, -0.04); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }); g.translate(0, 0, -0.006); g.rotateY(Math.PI / 2); return g; }), M.gold, [0, 0.26, 0.04], [0.15, 0, 0]);
  add(H, C('k:helmStar', () => starGeo(0.035, 0.012, 4, 0.006)), M.gold, [0, 0.215, 0.11], [-0.5, 0, 0]);
  // 별창
  const W = J.weapon, SP = { butt: -0.55, top: 1.5, tip: 1.88 }, X = [Math.PI / 2, 0, 0];
  add(W, C('k:shaft', () => new THREE.CylinderGeometry(0.017, 0.015, SP.top - SP.butt, 10)), M.under, [0, 0, (SP.top + SP.butt) / 2], X);
  for (const z of [SP.butt + 0.02, -0.12, 0.12, SP.top - 0.04]) add(W, C('k:ring', () => lathe([[0.017, -0.02], [0.024, -0.01], [0.024, 0.01], [0.017, 0.02]], 14)), M.gold, [0, 0, z], X);
  add(W, C('k:head', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.06, 0.08, 0.0, 0.34); sh.quadraticCurveTo(-0.06, 0.08, 0, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }); g.translate(0, 0, -0.004); g.rotateX(Math.PI / 2); return g; }), M.steel, [0, 0, SP.top + 0.02]);
  add(W, C('k:headG', () => starGeo(0.06, 0.016, 4, 0.006)), M.gold, [0, 0, SP.top + 0.04], [0, Math.PI / 2, 0]);
  add(W, C('k:headGem', () => new THREE.OctahedronGeometry(0.02, 0)), M.glow, [0, 0, SP.top + 0.05]);
  let t = 0; m.sole = 0.07;
  m.update = (dt, f) => { t += dt; if (!f) return; const k = Math.hypot(f.vel.x, f.vel.z) * 0.04; tabF.rotation.x = Math.min(0.4, k) + J.hipL.rotation.x * -0.15; tabB.rotation.x = -Math.min(0.4, k * 1.2); M.glow.emissiveIntensity = 2.6 + Math.sin(t * 5) * 0.5; };
  m.tipPos = (out) => W.localToWorld(out.set(0, 0, SP.tip));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.2)); W.localToWorld(tt.set(0, 0, SP.tip)); };
  return m;
}

/* =====================================================================
   2. 성좌 마법사 — 떠 있는 별자리 로브 · 깊은 두건 속 별빛 눈 · 혼천의 지팡이
   ===================================================================== */
export const MAGE_DIMS = { hipH: 0.98, spineL: 0.2, chestL: 0.27, neckL: 0.08, shW: 0.18, uArm: 0.28, lArm: 0.26, hipW: 0.09, thigh: 0.44, shin: 0.44, headTop: 0.24 };
export function buildStarMage(pal, o = {}) {
  const D = MAGE_DIMS, m = buildHumanoid(D), J = m.J, extras = [], acc = pal.accent ?? VIO;
  const M = { ...plateMats(),
    robe: phys({ map: T('o:robe', () => constTex('#120e30', '#2a1a5a', 13, true, true)), alphaTest: 0.4, roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0x9a7aff), sheenRoughness: 0.5, side: THREE.DoubleSide }),
    robe2: phys({ map: T('o:robe2', () => constTex('#1a1440', '#2a1e64', 21, true)), roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0x9a7aff), side: THREE.DoubleSide }),
    void: std({ color: 0x020108, roughness: 1 }), eye: glowMat(0xe8dcff, 4.5), glow: glowMat(acc, 3), orb: glowMat(0xf0e0ff, 3.5),
    skin: phys({ color: 0xc8b89a, roughness: 0.5, metalness: 0.3 }),
    ring: phys({ map: T('o:zod', zodiacTex), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, color: 0xffffff, emissive: 0x6a4a10, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }) };
  const add = adder(), { rim, lRim } = kitFor(add);
  // 로브: 가슴에서 바닥까지 · 갈라진 밑단 (알파)
  const RL = 1.02, RP = (v) => ({ y: 0.06 - RL * v, rx: 0.13 + 0.26 * v ** 1.3, rzF: 0.11 + 0.22 * v ** 1.3, rzB: 0.12 + 0.28 * v ** 1.3, n: 2.1 });
  const fold = (p, u, v) => { const k = 1 + 0.05 * Math.sin(u * TAU * 9 + 1) * smooth(0.1, 1, v); p.x *= k; p.z *= k; };
  const robe = add(J.hips, C('m:robe', () => loft(RP, 120, 18, { mod: fold })), M.robe);
  add(J.hips, C('m:sash', () => loft((v) => ({ y: 0.0 + 0.06 * v, rx: 0.14, rzF: 0.115, rzB: 0.12, n: 2.2 }), 40, 2)), M.gold);
  add(J.spine, C('m:belly', () => loft((v) => ({ y: -0.03 + 0.25 * v, rx: 0.12 - 0.015 * Math.sin(v * Math.PI), rzF: 0.09, rzB: 0.09, n: 2.2 }), 32, 6)), M.robe2);
  const CH = (v) => ({ y: -0.02 + 0.3 * v, rx: 0.12 + 0.03 * Math.sin(v * 2.2), rzF: 0.09 + 0.01 * Math.sin(v * 2.4), rzB: 0.09, n: 2.2 });
  add(J.chest, C('m:chest', () => loft(CH, 40, 10)), M.robe2);
  // 어깨 망토 (금테) + 높은 깃
  const MP = (v) => ({ y: 0.31 - 0.2 * v ** 0.9, rx: 0.08 + 0.17 * v ** 0.7, rzF: 0.08 + 0.08 * v ** 0.8, rzB: 0.08 + 0.1 * v ** 0.8, n: 2.15 });
  add(J.chest, C('m:mantle', () => loft(MP, 64, 8, { a0: 0.56, a1: 1.44 })), M.robe2); lRim(J.chest, 'm:mantleR', MP, 1, 0.005, M.gold, { a0: 0.56, a1: 1.44 });
  add(J.chest, C('m:clasp', () => starGeo(0.035, 0.012, 4, 0.006)), M.gold, [0, 0.27, 0.085]);
  // 팔: 넓은 소매 + 장갑 손
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('m:ua', () => loft((v) => ({ y: 0.03 - (D.uArm + 0.03) * v, rx: 0.05 + 0.006 * v, rz: 0.05 + 0.006 * v }), 20, 6)), M.robe2);
    const SL = (v) => ({ y: 0.02 - (D.lArm + 0.06) * v, rx: 0.05 + 0.07 * v ** 1.4, rz: 0.05 + 0.06 * v ** 1.4 });
    add(el, C('m:sleeve' + s, () => loft(SL, 32, 8, { mod: (p, u, v, c) => { p.y -= 0.07 * v * Math.max(0, -c * s) ** 1.2; } })), M.robe2);
    lRim(el, 'm:slR' + s, SL, 1, 0.005, M.gold, { mod: (p, u, v, c) => { p.y -= 0.07 * v * Math.max(0, -c * s) ** 1.2; } });
    const hg = sculptHand(add, ha, 'm:', s, M.skin, 0.9); hg.position.y = -0.004;
  }
  // 두건: 앞이 열린 깊은 두건 · 속은 어둠 · 별빛 눈 두 개
  add(J.neck, C('m:neck', () => loft((v) => ({ y: -0.02 + 0.12 * v, rx: 0.042, rz: 0.042 }), 12, 3)), M.void);
  const H = J.head; add(H, C('m:void', () => new THREE.SphereGeometry(0.1, 20, 14)), M.void, [0, 0.11, 0]);
  const HD = (v) => { const e = Math.sin(Math.PI * Math.min(1, 0.04 + v * 0.96)); return { y: -0.04 + 0.36 * v, rx: 0.13 * e ** 0.6, rzF: 0.15 * e ** 0.6, rzB: 0.14 * e ** 0.6 + 0.04 * smooth(0.5, 1, v), cz: -0.03 * v - 0.05 * smooth(0.7, 1, v) }; };
  add(H, C('m:hood', () => loft(HD, 48, 16, { a0: 0.62, a1: 1.38, poles: [16] })), M.robe2);
  for (const s of [-1, 1]) add(H, C('m:eye', () => starGeo(0.016, 0.004, 4, 0.002)), M.eye, [s * 0.034, 0.115, 0.095]);
  lRim(H, 'm:hoodR', HD, 0.5, 0.004, M.gold, { a0: 0.62, a1: 1.38 });
  // 혼천의 지팡이: 금 고리 셋이 별 구슬 둘레를 돈다
  const W = J.weapon, X = [Math.PI / 2, 0, 0];
  add(W, C('m:shaft', () => new THREE.CylinderGeometry(0.014, 0.012, 1.55, 10)), M.under, [0, 0, 0.5], X);
  add(W, C('m:spiral', () => { const pts = []; for (let i = 0; i <= 120; i++) { const tt = i / 120, a = tt * TAU * 7; pts.push(new V3(Math.cos(a) * 0.016, Math.sin(a) * 0.016, -0.2 + 1.35 * tt)); } return strand(pts, 0.003, 0.003, { seg: 200, rad: 5 }); }), M.gold);
  add(W, C('m:cup', () => lathe([[0.012, -0.03], [0.03, 0], [0.036, 0.03], [0.02, 0.05]], 16)), M.gold, [0, 0, 1.27], X);
  const arm = new THREE.Group(); arm.position.set(0, 0, 1.42); W.add(arm); const rings = [];
  add(arm, C('m:orb', () => new THREE.IcosahedronGeometry(0.05, 2)), M.orb);
  for (let k = 0; k < 3; k++) { const r = add(arm, C('m:ring' + k, () => new THREE.TorusGeometry(0.1 + k * 0.022, 0.0055, 6, 40)), M.gold, [0, 0, 0], [k * 1.0, k * 0.7, 0]); rings.push(r); }
  // 몸을 도는 큰 황도 고리 (글리프) + 작은 별
  const orb = new THREE.Group(); orb.position.y = 1.1; m.body.add(orb);
  const zr = add(orb, C('m:zod', () => { const g = new THREE.CylinderGeometry(0.62, 0.62, 0.08, 64, 1, true); return g; }), M.ring, [0, 0, 0], [0.25, 0, 0.15]);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; add(orb, C('m:st', () => starGeo(0.04, 0.012, 4, 0.006)), M.orb, [Math.cos(a) * 0.5, 0.25 + Math.sin(i * 2) * 0.15, Math.sin(a) * 0.5]); }
  // 앞으로 늘어진 금 별 영대(스톨) 두 가닥 (로프)
  m.ropes = [];
  for (const s of [-1, 1]) { const rope = new Rope(8, 0.07, { damp: 0.975, stiff: 0.08 }), view = new RopeTube(rope, M.robe2, { sub: 3, rad: 6, flat: 0.18, side: new V3(1, 0, 0), prof: () => 0.035 });
    m.ropes.push({ rope, view, joint: J.chest, local: new V3(s * 0.06, 0.27, 0.08), rest: new V3(0, -1, 0.25).normalize(), side: true, sideL: new V3(1, 0, 0), hq: new THREE.Quaternion() }); }
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const x of extras) scene.remove(x); extras.length = 0; for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  let t = 0; const tmp = new V3(), rq = new THREE.Quaternion(); m.sole = 0.2;
  m.update = (dt, f) => { t += dt; m.sole = 0.2 + Math.sin(t * 1.7) * 0.04; rings.forEach((r, i) => { r.rotation.x += dt * (1 + i * 0.5); r.rotation.y += dt * (0.7 - i * 0.3); }); zr.rotation.y += dt * 0.6; orb.rotation.y -= dt * 0.3; robe.rotation.y = Math.sin(t * 1.1) * 0.06;
    M.orb.emissiveIntensity = 3 + Math.sin(t * 5) * 0.6 + (f && f.state === 'act' ? 2 : 0);
    if (!f) return; m.root.getWorldQuaternion(rq); for (const r of m.ropes) J.chest.getWorldQuaternion(r.hq);
    const h0 = f.hurt[0]; ropeStep(m, f, dt, [{ a: h0.a, b: h0.b, r: h0.r + 0.03 * f.scale }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.1 * f.scale }))], rq, tmp, new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6)); };
  m.tipPos = (out) => arm.localToWorld(out.set(0, 0, 0));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.2)); W.localToWorld(tt.set(0, 0, 1.5)); };
  return m;
}

/* =====================================================================
   3. 수정 거상 — 검은 암석 골격 · 어깨와 등에 솟은 육각 수정 · 금 궤도 띠 · 가슴의 핵 · 떠 있는 수정 머리
   ===================================================================== */
export function buildCrystalColossus(pal, o = {}) {
  const D = GOLEM_DIMS, m = buildHumanoid(D), J = m.J, acc = pal.accent ?? 0x8ae0ff;
  const M = { ...plateMats(),
    rock: phys({ color: 0x2a3048, roughness: 0.55, metalness: 0.25, flatShading: true, clearcoat: 0.3 }),
    rock2: phys({ color: 0x3a4466, roughness: 0.5, metalness: 0.3, flatShading: true }),
    cry: phys({ color: 0xbfeaff, emissive: acc, emissiveIntensity: 0.55, roughness: 0.06, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.9, envMapIntensity: 1.6, metalness: 0.1 }),
    core: glowMat(acc, 3.6), eye: glowMat(0xffffff, 4) };
  M.cry.envMap = envCube();
  const add = adder();
  // 깎인 암석 판: 로프트에 계단식 면 노이즈
  const facet = (k, sd) => (p, u, v) => { const n = Math.sin(u * 37 * k + sd) * Math.sin(v * 23 + sd * 2) * 0.5 + 0.5, s = 1 + 0.06 * (Math.round(n * 3) / 3 - 0.5); p.x *= s; p.z *= s; };
  add(J.hips, C('c:pel', () => loft((v) => ({ y: 0.08 - 0.24 * v, rx: 0.28 - 0.05 * v, rzF: 0.2, rzB: 0.21, n: 2.4 }), 12, 4, { mod: facet(1, 1) })), M.rock);
  add(J.spine, C('c:abd', () => loft((v) => ({ y: -0.06 + 0.3 * v, rx: 0.22 + 0.03 * Math.sin(v * Math.PI), rzF: 0.18, rzB: 0.19, n: 2.4 }), 12, 5, { mod: facet(1.3, 2) })), M.rock2);
  const CHX = spl([[0, 0.3], [0.4, 0.4], [0.7, 0.44], [0.9, 0.36], [1, 0.18]]), CHZ = spl([[0, 0.22], [0.5, 0.27], [1, 0.16]]);
  const CH = (v) => ({ y: -0.06 + 0.56 * v, rx: CHX(v), rzF: CHZ(v), rzB: CHZ(v) * 1.08, n: 2.6 });
  add(J.chest, C('c:chest', () => loft(CH, 14, 8, { mod: (p, u, v, c, sn) => { facet(0.9, 3)(p, u, v); if (sn > 0) p.z -= 0.08 * gauss(p.x, 0.1) * gauss(v - 0.5, 0.18); } })), M.rock);
  // 가슴의 핵 + 그 둘레 금 고리 (궤도)
  const core = add(J.chest, C('c:core', () => new THREE.IcosahedronGeometry(0.09, 1)), M.core, [0, 0.24, 0.2]); const coreR = [];
  for (let k = 0; k < 2; k++) coreR.push(add(J.chest, C('c:coreR' + k, () => new THREE.TorusGeometry(0.14 + k * 0.03, 0.008, 6, 40)), M.gold, [0, 0.24, 0.2], [k * 1.2, 0.4, 0]));
  // 몸통 둘레 금 띠
  for (const [j, y, rx, rz] of [[J.spine, 0.12, 0.25, 0.21], [J.chest, 0.02, 0.31, 0.24]]) add(j, C('c:band' + y, () => new THREE.TorusGeometry(1, 0.03, 6, 48)), M.gold, [0, y, 0], [Math.PI / 2, 0, 0], [rx, rz, 1]);
  // 수정 군집: 어깨 · 등
  { const r = rng(5), list = []; for (const s of [-1, 1]) for (let i = 0; i < 7; i++) list.push(xf(crystalGeo(0.25 + r() * 0.35, 0.05 + r() * 0.04), [s * (0.3 + r() * 0.12), 0.42 + r() * 0.05, -0.05 - r() * 0.15], [-0.3 - r() * 0.4, 0, -s * (0.2 + r() * 0.7)]));
    for (let i = 0; i < 8; i++) list.push(xf(crystalGeo(0.22 + r() * 0.3, 0.05 + r() * 0.03), [(r() - 0.5) * 0.4, 0.15 + r() * 0.3, -0.24], [-1.0 - r() * 0.5, 0, (r() - 0.5) * 0.9]));
    add(J.chest, C('c:cry', () => merge(list)), M.cry); }
  // 떠 있는 수정 머리 + 눈 + 광륜
  const head = new THREE.Group(); head.position.set(0, 0.2, 0.08); J.head.add(head);
  add(head, C('c:head', () => xf(crystalGeo(0.3, 0.1, 0.4, 0.35), [0, -0.1, 0], [0, 0, 0])), M.cry);
  add(head, C('c:eye', () => new THREE.BoxGeometry(0.1, 0.016, 0.02)), M.eye, [0, 0.03, 0.095]);
  const halo = add(head, C('c:halo', () => new THREE.TorusGeometry(0.2, 0.01, 6, 40)), M.gold, [0, 0.05, -0.04], [Math.PI / 2 - 0.3, 0, 0]);
  // 팔: 암석 팔 · 앞팔은 수정 덩어리 · 손목 금 고리 · 주먹
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(a, C('c:sh', () => new THREE.DodecahedronGeometry(0.17, 1)), M.rock2, [0, 0.02, 0], [0, 0, 0], [1.1, 1, 1.05]);
    add(a, C('c:ua', () => loft((v) => ({ y: 0.0 - (D.uArm + 0.02) * v, rx: 0.12 - 0.02 * v, rz: 0.11 - 0.02 * v, n: 2.5 }), 10, 4, { mod: facet(1.1, 4) })), M.rock);
    add(b, C('c:el', () => new THREE.DodecahedronGeometry(0.1, 0)), M.rock2);
    add(b, C('c:la', () => loft((v) => ({ y: 0.0 - (D.lArm + 0.0) * v, rx: 0.12 + 0.03 * Math.sin(v * 2.5), rz: 0.12 + 0.03 * Math.sin(v * 2.5), n: 2.5 }), 10, 5, { mod: facet(1.2, 5) })), M.rock);
    add(b, C('c:laCry', () => { const r = rng(9), list = []; for (let i = 0; i < 5; i++) { const aa = r() * TAU; list.push(xf(crystalGeo(0.18 + r() * 0.12, 0.04), [Math.sin(aa) * 0.1, -0.1 - r() * 0.2, Math.cos(aa) * 0.1 - 0.04], [Math.cos(aa) * 0.8, 0, -Math.sin(aa) * 0.8])); } return merge(list); }), M.cry);
    add(b, C('c:wrist', () => new THREE.TorusGeometry(0.15, 0.02, 6, 32)), M.gold, [0, -D.lArm + 0.04, 0], [Math.PI / 2, 0, 0]);
    add(c, C('c:fist', () => xf(new THREE.DodecahedronGeometry(0.16, 1), [0, -0.09, 0.02], [0, 0, 0], [1, 1.1, 1.1])), M.rock2);
    add(c, C('c:knuck', () => merge([0, 1, 2, 3].map((k) => xf(crystalGeo(0.08, 0.02), [(k - 1.5) * 0.06, -0.16, 0.12], [1.2, 0, 0])))), M.cry);
  }
  for (const [a, b, c] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(a, C('c:th', () => loft((v) => ({ y: 0.04 - (D.thigh + 0.04) * v, rx: 0.15 - 0.02 * v, rz: 0.15 - 0.02 * v, n: 2.5 }), 10, 4, { mod: facet(1, 6) })), M.rock);
    add(b, C('c:kn', () => new THREE.DodecahedronGeometry(0.11, 0)), M.rock2);
    add(b, C('c:shin', () => loft((v) => ({ y: 0.0 - (D.shin + 0.0) * v, rx: 0.13 - 0.01 * v, rz: 0.13, n: 2.5 }), 10, 4, { mod: facet(1, 7) })), M.rock);
    add(c, C('c:foot', () => zLoft((v) => { const e = Math.sin(Math.PI * Math.min(1, v * 1.03)) ** 0.5; return { z: -0.1 + 0.32 * v, rx: 0.11 * e + 0.01, ryT: 0.08 * e, ryB: 0.03 * e, cy: -0.03 }; }, 10, 8)), M.rock2);
  }
  let t = 0; m.sole = 0.07;
  m.update = (dt, f) => { t += dt; head.position.y = 0.2 + Math.sin(t * 2) * 0.025; head.rotation.y = Math.sin(t * 0.7) * 0.2; halo.rotation.z += dt; core.rotation.y += dt * 1.5; coreR.forEach((r, i) => { r.rotation.y += dt * (1.2 - i * 2); r.rotation.x += dt * 0.5; }); M.core.emissiveIntensity = 3.2 + Math.sin(t * 4) * 0.8 + (f && f.state === 'act' ? 1.5 : 0); };
  m.tipPos = (out) => J.handR.localToWorld(out.set(0, -0.15, 0.1));
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.2, 0)); J.handR.localToWorld(tt.set(0, -0.2, 0.05)); };
  return m;
}

/* =====================================================================
   4. 성좌의 심판자 아스트라 — 눈을 가린 심판자 · 흰 예복과 금 갑 · 황도 광륜 · 빛의 깃털 날개 · 천칭 홀
   o.ghost: 거울상(분신)용 — 물리(머리칼 · 망토) 없이 반투명 별빛 재질
   ===================================================================== */
export const JUDGE_DIMS = { hipH: 0.95, spineL: 0.2, chestL: 0.27, neckL: 0.078, shW: 0.18, uArm: 0.28, lArm: 0.26, hipW: 0.09, thigh: 0.42, shin: 0.42, headTop: 0.27 };
export const JST = { butt: -0.6, top: 1.25, head: 1.42 };
const J_HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.071, 0.1, 0.088], jaw: 0.32, chin: 0.01 });
let _ghostM = null;
export const ghostMat = () => _ghostM || (_ghostM = new THREE.MeshStandardMaterial({ color: 0x6a5aff, emissive: 0xb89aff, emissiveIntensity: 1.1, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, roughness: 0.4 }));
export function buildJudge(pal, o = {}) {
  const D = JUDGE_DIMS, m = buildHumanoid(D), J = m.J, extras = [], ghost = !!o.ghost, acc = pal.accent ?? 0xffe08a;
  const M = { ...plateMats(),
    skin: phys({ color: 0xf6ead8, emissive: 0x5a4a3a, emissiveIntensity: 0.25, roughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color(0xffe0c0) }),
    robe: phys({ map: T('o:jrobe', robeTex), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xe8e0ff), sheenRoughness: 0.4, side: THREE.DoubleSide }),
    white: phys({ color: 0xf8f6f0, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }),
    navy: phys({ map: T('o:jcape', () => constTex('#0c1030', '#1a2060', 31, true)), roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0x8a9aff), side: THREE.DoubleSide }),
    hair: phys({ map: T('o:jhair', hairTexG), roughness: 0.38, sheen: 1, sheenColor: new THREE.Color(0xfff0c0), sheenRoughness: 0.3, side: THREE.DoubleSide }),
    feather: std({ color: 0x000000, emissive: 0xfff0c0, emissiveIntensity: 1.6, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    glow: glowMat(acc, 3), star: glowMat(0xfff4d0, 4),
    zod: phys({ map: T('o:zod', zodiacTex), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, color: 0xffffff, emissive: 0x8a6a20, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.3 }) };
  const add = adder(), { rim, lRim } = kitFor(add);
  m.ropes = [];
  // 예복: 긴 흰 치마 (금 별 자수) + 앞뒤로 늘어진 남빛 별자리 휘장
  const RL = 1.0, RP = (v) => ({ y: 0.05 - RL * v, rx: 0.13 + 0.34 * v ** 1.4, rzF: 0.11 + 0.3 * v ** 1.4, rzB: 0.12 + 0.38 * v ** 1.4, n: 2.1 });
  const fold = (p, u, v) => { const w = Math.sin(u * TAU * 11 + 0.5), k = 1 + 0.04 * w * smooth(0.1, 1, v); p.x *= k; p.z *= k; };
  const robe = add(J.hips, C('j:robe', () => loft(RP, 140, 20, { mod: fold })), M.robe);
  const PN = (v) => { const s = RP(v * 0.97); return { ...s, rx: s.rx * 1.04 + 0.012, rzF: s.rzF * 1.04 + 0.012, rzB: s.rzB * 1.04 + 0.012 }; };
  const panF = add(J.hips, C('j:panF', () => loft(PN, 16, 14, { a0: 0.42, a1: 0.58, mod: fold })), M.navy), panB = add(J.hips, C('j:panB', () => loft(PN, 16, 14, { a0: -0.09, a1: 0.09, mod: fold })), M.navy);
  for (const [a0, a1, k] of [[0.42, 0.58, 'F'], [-0.09, 0.09, 'B']]) for (const a of [a0, a1]) { const pts = []; for (let i = 0; i <= 14; i++) pts.push(loftAt(PN, a, i / 14, new V3(), fold)); rim(J.hips, `j:panE${k}${a}`, pts, 0.005, false, M.gold); }
  // 금 허리 갑 (tasset) + 띠
  const BT = (v) => ({ y: 0.0 + 0.07 * v, rx: 0.14, rzF: 0.115, rzB: 0.12, n: 2.3 });
  add(J.hips, C('j:belt', () => loft(BT, 48, 2)), M.gold);
  add(J.hips, C('j:beltStar', () => starGeo(0.04, 0.013, 4, 0.006)), M.white, [0, 0.035, 0.12]);
  // 몸통: 흰 속옷 위 금 흉갑 (태양-별 문장)
  add(J.spine, C('j:waist', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: 0.115 - 0.02 * Math.sin(v * Math.PI), rzF: 0.08, rzB: 0.08, n: 2.15 }), 40, 8)), M.white);
  const chX = spl([[0, 0.106], [0.3, 0.116], [0.55, 0.124], [0.8, 0.12], [1, 0.096]]), chF = spl([[0, 0.078], [0.5, 0.088], [1, 0.072]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: 0.08, n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.022 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('j:chest', () => loft(chP, 56, 14, { mod: chMod })), M.white);
  const CU = (v) => { const s = chP(0.1 + 0.62 * v); return { ...s, rx: s.rx + 0.008, rzF: s.rzF + 0.009, rzB: s.rzB + 0.008 }; };
  add(J.chest, C('j:cuir', () => loft(CU, 56, 10, { mod: chMod })), M.gold); lRim(J.chest, 'j:cuirT', CU, 1, 0.004, M.white, { mod: chMod });
  { const p = loftAt(CU, 0.5, 0.5, new V3(), chMod); add(J.chest, C('j:sun', () => starGeo(0.06, 0.02, 8, 0.006)), M.white, [p.x, p.y, p.z + 0.006]); add(J.chest, C('j:sunG', () => new THREE.OctahedronGeometry(0.02, 0)), M.star, [p.x, p.y, p.z + 0.018]); }
  add(J.chest, C('j:collar', () => loft((v) => ({ y: 0.25 + 0.09 * v, rx: 0.08 - 0.03 * v + 0.02 * v * v, rzF: 0.07 - 0.03 * v, rzB: 0.07 + 0.01 * v }), 40, 5, { a0: 0.62, a1: 1.38 })), M.white);
  lRim(J.chest, 'j:collarR', (v) => ({ y: 0.34, rx: 0.07, rzF: 0.04, rzB: 0.08 }), 0, 0.004, M.gold, { a0: 0.62, a1: 1.38 });
  // 날개 모양 금 견갑
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.17, 0.25, 0); g.rotation.z = -s * 0.35; J.chest.add(g);
    for (let k = 0; k < 4; k++) add(g, C('j:pf' + k, () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.06, 0.03, 0.16 - k * 0.02, -0.02); sh.quadraticCurveTo(0.07, -0.03, 0, -0.03); const ge = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1 }); ge.translate(0, 0, -0.05); return ge; }), M.gold, [0, -k * 0.035, 0], [0, s < 0 ? Math.PI : 0, -0.25 * k]); }
  // 팔: 흰 긴 소매 · 금 팔찌 · 손
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('j:ua', () => loft((v) => ({ y: 0.03 - (D.uArm + 0.03) * v, rx: 0.046 - 0.008 * v, rz: 0.044 - 0.008 * v }), 24, 8)), M.white);
    const SL = (v) => ({ y: 0.02 - (D.lArm - 0.02) * v, rx: 0.04 + 0.03 * v ** 2, rz: 0.038 + 0.03 * v ** 2 });
    add(el, C('j:la', () => loft(SL, 24, 8)), M.white); lRim(el, 'j:laR', SL, 1, 0.004, M.gold);
    add(el, C('j:brace', () => loft((v) => ({ y: -0.08 - 0.08 * v, rx: 0.048, rz: 0.046 }), 24, 2)), M.gold);
    const hg = sculptHand(add, ha, 'j:', s, M.skin, 0.88); hg.position.y = -0.006;
  }
  // 머리: 눈가리개 (금 눈 문양) · 금발 · 작은 관 · 등 뒤 황도 광륜
  add(J.neck, C('j:neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.033 - 0.007 * smooth(0.2, 0.8, v), rzF: 0.032 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.032 }), 20, 6)), M.skin);
  const H = J.head, { headPt, headAt, dirOf } = J_HEAD; H.scale.setScalar(1.08);
  add(H, C('j:head', () => surf((u, v, p) => { const d = dirOf((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI); headPt(d.x, d.y, d.z, p); }, 72, 54, { closedU: true, poles: [0, 54] })), M.skin);
  add(H, C('j:blind', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = 0.0 + 0.2 * v; headAt(az, el, 0.004 + 0.002 * Math.cos(az), p); }, 64, 4, { closedU: true })), M.white);
  for (const v of [0, 1]) rim(H, 'j:blindR' + v, Array.from({ length: 64 }, (_, i) => headAt((i / 64 - 0.5) * TAU, 0.2 * v, 0.006)), 0.0025, true, M.gold);
  add(H, C('j:eyeSig', () => { const sh = new THREE.Shape(); sh.moveTo(-0.03, 0); sh.quadraticCurveTo(0, 0.022, 0.03, 0); sh.quadraticCurveTo(0, -0.022, -0.03, 0); return new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false }); }), M.gold, [0, 0.11, 0.093]);
  add(H, C('j:eyeDot', () => new THREE.SphereGeometry(0.007, 10, 8)), M.star, [0, 0.11, 0.097]);
  { const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.3 + 0.3 * w * w : 0.1 - 0.9 * w * w; };
    add(H, C('j:hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.007 + 0.012 * smooth(0, 0.4, v), p); }, 64, 18, { closedU: true, poles: [18], uvU: 6 })), M.hair);
    const r = rng(43), clump = (key, pts, r0, r1, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat: 0.25, ref })), M.hair);
    for (let k = 0; k < 10; k++) { const t = k / 9, az = 0.85 - t * 1.7; const pts = [headAt(az * 0.3, 1.2, 0.02), headAt(az * 0.8, 0.8, 0.03), headAt(az, 0.45, 0.025), headAt(az * 1.15, 0.22 - 0.3 * Math.abs(az), 0.012)]; const d = dirOf(az, 0.5); clump('jb' + k, pts, 0.03 + r() * 0.008, 0.002, [d.x, d.y, d.z]); }
    for (const s of [-1, 1]) { const az = s * 1.1, pts = [headAt(az * 0.9, 0.7, 0.018), headAt(az, 0.0, 0.016), headAt(az * 1.03, -0.7, 0.02), headAt(az * 1.05, -1.2, 0.02)]; const d = dirOf(az, 0); clump(`js${s}`, pts, 0.03, 0.006, [d.x, 0, d.z]); }
    if (!ghost) [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0].forEach((dd, i) => { const az = Math.PI + dd, rope = new Rope(10, 0.075, { damp: 0.978, stiff: 0.06 }), ph = i * 1.1;
      const view = new RopeTube(rope, M.hair, { sub: 3, rad: 10, uvV: 2, flat: 0.3, side: new V3(1, 0, 0), prof: (v) => 0.05 * (1 - 0.5 * v) * (v > 0.85 ? 1 - (v - 0.85) * 5 : 1), wave: (v) => 0.014 * Math.sin(v * TAU * 1.3 + ph) * smooth(0.1, 0.5, v) });
      m.ropes.push({ rope, view, joint: H, local: headAt(az, -0.35 + 0.1 * Math.abs(dd), 0.02), rest: new V3(Math.sin(az) * 0.3, -0.8, -0.55).normalize(), side: true, sideL: new V3(Math.cos(az), 0, -Math.sin(az)), hq: new THREE.Quaternion() }); }); }
  { const cr = new THREE.Group(); cr.position.set(0, 0.2, 0); cr.rotation.x = -0.15; H.add(cr);
    add(cr, C('j:circlet', () => new THREE.TorusGeometry(0.082, 0.005, 8, 40)), M.gold, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1.12, 1]);
    add(cr, C('j:crStar', () => starGeo(0.04, 0.012, 4, 0.006)), M.gold, [0, 0.03, 0.09]); add(cr, C('j:crGem', () => new THREE.OctahedronGeometry(0.013, 0)), M.star, [0, 0.03, 0.1]); }
  const halo = new THREE.Group(); halo.position.set(0, 0.2, -0.2); J.head.add(halo);
  const zr = add(halo, C('j:zodiac', () => new THREE.CylinderGeometry(0.34, 0.34, 0.06, 72, 1, true)), M.zod, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(halo, C('j:haloR', () => new THREE.TorusGeometry(0.4, 0.008, 6, 64)), M.gold);
  add(halo, C('j:haloR2', () => new THREE.TorusGeometry(0.29, 0.005, 6, 64)), M.gold);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; add(halo, C('j:hs', () => starGeo(0.03, 0.008, 4, 0.004)), M.star, [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.01]); }
  // 빛의 깃털 날개 (세 쌍)
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.08, 0.22, -0.11); J.chest.add(w); wings.push([w, s]);
    for (let k = 0; k < 7; k++) { const L = 0.75 - k * 0.07; add(w, C('j:fe' + k, () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(L * 0.4, 0.05, L, 0.0); sh.quadraticCurveTo(L * 0.45, -0.035, 0, 0); return new THREE.ShapeGeometry(sh, 10); }), M.feather, [0, 0, -k * 0.006], [0, s < 0 ? Math.PI : 0, 0.75 - k * 0.24]); } }
  // 천칭 홀: 금 자루 · 꼭대기 별 · 가로대에 매달린 두 접시
  const W = J.weapon, staff = new THREE.Group(); W.add(staff); const X = [Math.PI / 2, 0, 0];
  add(staff, C('j:shaft', () => new THREE.CylinderGeometry(0.015, 0.013, JST.top - JST.butt, 12)), M.gold, [0, 0, (JST.top + JST.butt) / 2], X);
  for (const z of [JST.butt + 0.03, 0, JST.top - 0.05]) add(staff, C('j:ring', () => lathe([[0.016, -0.02], [0.026, -0.01], [0.026, 0.01], [0.016, 0.02]], 14)), M.white, [0, 0, z], X);
  add(staff, C('j:bar', () => new THREE.CylinderGeometry(0.008, 0.008, 0.42, 8)), M.gold, [0, 0, JST.top - 0.04], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) { for (const k of [-1, 1]) add(staff, C('j:chain', () => new THREE.CylinderGeometry(0.002, 0.002, 0.16, 4)), M.gold, [s * 0.2 + k * 0.02, -0.07, JST.top - 0.04], [0, 0, k * 0.15]);
    add(staff, C('j:pan', () => new THREE.SphereGeometry(0.045, 16, 8, 0, TAU, Math.PI * 0.6, Math.PI * 0.4)), M.gold, [s * 0.2, -0.13, JST.top - 0.04]); }
  add(staff, C('j:topStar', () => starGeo(0.08, 0.024, 4, 0.008)), M.gold, [0, 0, JST.head], [0, Math.PI / 2, 0]);
  const tGem = add(staff, C('j:topGem', () => new THREE.OctahedronGeometry(0.03, 0)), M.star, [0, 0, JST.head]);
  add(staff, C('j:butt', () => xf(new THREE.ConeGeometry(0.02, 0.12, 8), [0, 0, 0], [-Math.PI / 2, 0, 0])), M.gold, [0, 0, JST.butt - 0.04]);
  // 망토 (천 물리) — 남빛 별자리
  let cloth = null;
  m.attachScene = (scene) => { if (m._attached || ghost) return; m._attached = true; cloth = new Cloth(scene, 9, 14, 1.1, M.navy); extras.push(cloth.mesh); for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const x of extras) scene.remove(x); extras.length = 0; if (cloth) { cloth.mesh.geometry.dispose(); cloth = null; } for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { if (cloth) cloth.ok = false; for (const r of m.ropes) r.rope.ok = false; };
  if (ghost) m.root.traverse((x) => { if (x.isMesh) { x.material = ghostMat(); x.castShadow = false; } });
  let t = 0; const tmp = new V3(), tmp2 = new V3(), rq = new THREE.Quaternion(), hq = new THREE.Quaternion();
  m.lift = 0; m.glow = 0; const sole0 = 0.24; m.sole = sole0;
  m.update = (dt, f) => {
    t += dt; m.sole = sole0 + m.lift + Math.sin(t * 1.5) * 0.04; zr.rotation.y += dt * 0.25; halo.rotation.z = Math.sin(t * 0.4) * 0.1; tGem.rotation.z += dt * 2;
    for (const [w, s] of wings) { w.rotation.set(0.15, -s * (0.55 + Math.sin(t * 1.6) * 0.08), s * (0.25 + Math.sin(t * 1.6 + 1) * 0.06)); }
    robe.rotation.y = Math.sin(t * 1.1) * 0.04; const spd = f ? Math.hypot(f.vel.x, f.vel.z) : 0; panF.rotation.x = Math.min(0.3, spd * 0.04); panB.rotation.x = -Math.min(0.35, spd * 0.05);
    if (!ghost) { m.glow += ((f && f.state === 'act' ? 1 : 0) - m.glow) * Math.min(1, dt * 6); M.star.emissiveIntensity = 3.4 + m.glow * 2 + Math.sin(t * 4) * 0.4; M.feather.emissiveIntensity = 1.4 + m.glow * 1.2; }
    if (!f || ghost) return;
    J.chest.updateMatrixWorld(true); m.root.getWorldQuaternion(rq); H.getWorldQuaternion(hq);
    if (cloth) { cloth.mesh.visible = f.root.visible; const Wc = cloth.W;
      for (let i = 0; i < Wc; i++) { const a = -0.2 + 0.4 * (i / (Wc - 1)); const u = i / (Wc - 1) - 0.5; J.chest.localToWorld(cloth.anchors[i].set(u * 0.34, 0.26, -0.085 - 0.03 * (1 - Math.cos(u * 3)))); }
      const hp = J.hips.getWorldPosition(tmp2), sc = f.scale, caps = [{ a: f.hurt[0].a, b: f.hurt[0].b, r: f.hurt[0].r + 0.05 * sc }];
      for (let k = 1; k <= 3; k++) { const c = hp.clone().add(new V3(0, -0.28 * k * sc, 0)); caps.push({ a: c, b: c, r: (0.09 + 0.115 * k) * sc }); }
      cloth.len = 1.1 * sc; cloth.step(dt, caps, f.pos.y + 0.03, [-f.vel.x + Math.sin(t * 1.3) * 1.0, 0, -f.vel.z + Math.cos(t) * 1.0]); }
    for (const r of m.ropes) r.hq.copy(hq);
    const hc = H.localToWorld(tmp2.copy(J_HEAD.HC)), h0 = f.hurt[0], caps = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.62 + 0.04 * f.scale }, { a: hc.clone(), b: hc.clone(), r: 0.108 * f.scale }];
    ropeStep(m, f, dt, caps, rq, tmp, new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6));
    for (const x of extras) x.visible = f.root.visible;
    if (f.root.visible && Math.random() < dt * 8) { const p = J.hips.getWorldPosition(tmp).add(new V3((Math.random() - 0.5) * 1.0, -0.9 * f.scale, (Math.random() - 0.5) * 1.0)); f.G.fx.p(p, { vel: [0, 0.5, 0], size: 0.08, size1: 0.02, life: 0.9, color: 0xfff0c0, alpha: 0.8, drag: 1 }); }
  };
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => { const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE); m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP); J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true); };
  m.tipPos = (out) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, JST.head)); };
  m.weaponPts = (b, tt) => { J.weapon.localToWorld(b.set(0, 0, 0.2)); J.weapon.localToWorld(tt.set(0, 0, JST.head + 0.08)); };
  return m;
}
