// 천둥 산신 뇌공 3D 모델
// 푸른 근육질 몸(번개처럼 빛나는 핏줄) · 매부리 부리코 · 튀어나온 빛나는 눈 · 송곳니 · 작은 뿔 · 위로 타오르는 흰 머리 · 수염
// 등 뒤 금 고리에 매단 천둥북 여덟 개(빙빙 돈다) · 검푸른 깃털 날개(평소 접음 · 비행 때 펼침)
// 금 가슴띠 + 번개 문장 · 구름무늬 허리 가리개 · 금 팔찌 · 정강이 갑 · 매 발톱 발 · 떠다니는 천의(로프 4) · 양손 북채
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, gauss, smooth, cached } from '../../sculpt.js';
import { V3, TAU, UP, cv, tex, T, mottle, clothTex, cardTex, phys, glowMat, addMesh as add, tube, limb, bulge, creatureHead, clawHand, physKit } from './plains_lib.js';
import { buildWing } from './peak_model.js';

const C = (k, fn) => cached('peak:ng:' + k, fn);
export const NG_DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.32, neckL: 0.09, shW: 0.23, uArm: 0.3, lArm: 0.28, hipW: 0.11, thigh: 0.44, shin: 0.44, headTop: 0.3 };
const HEAD = creatureHead({ C: new V3(0, 0.1, 0.02), R: [0.095, 0.11, 0.105], back: 0.15, jaw: 0.12, brow: 0.035, browY: 0.2, cheek: 0.02, chin: 0.015,
  nose: { len: 0.075, w: 0.11, y: -0.08, h: 0.22, hook: 0.6 }, mouth: { y: -0.5, w: 0.52, depth: 0.016, h: 0.04 }, socket: [0.36, 0.08, 0.016] });
function drumTex() { // 북 가죽: 삼태극 + 번개 무늬
  const W = 256, [c, g] = cv(W, W); g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, W, W); const cx = W / 2, R = W * 0.42;
  const cols = ['#c8202a', '#1a3a9a', '#e8b020'];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; g.fillStyle = cols[i]; g.beginPath(); g.arc(cx, cx, R, a, a + TAU / 3); g.arc(cx + Math.cos(a + TAU / 3) * R / 2, cx + Math.sin(a + TAU / 3) * R / 2, R / 2, a + TAU / 3 + Math.PI, a + TAU / 3, true); g.arc(cx + Math.cos(a) * R / 2, cx + Math.sin(a) * R / 2, R / 2, a, a + Math.PI, false); g.fill(); }
  g.strokeStyle = '#3a2010'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cx, R + 8, 0, TAU); g.stroke(); return tex(c);
}
function cloudTex() {
  const W = 512, H = 256, [c, g] = cv(W, H); g.fillStyle = '#1a2a5a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e8c060'; g.lineWidth = 4;
  for (let k = 0; k < 6; k++) { const x0 = 40 + k * 85, y0 = 90 + (k % 2) * 70; for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x0 + j * 22, y0, 16 - j * 2, Math.PI, 0); g.stroke(); } g.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.3, r = 14 * (1 - i / 34); g.lineTo(x0 + 70 + Math.cos(a) * r, y0 + Math.sin(a) * r); } g.stroke(); }
  g.fillStyle = '#e8c060'; g.fillRect(0, H - 14, W, 8); g.fillStyle = '#a81a2a'; g.fillRect(0, H - 26, W, 8); return tex(c);
}
function hairTex() { const W = 128, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#cfe8ff'); gr.addColorStop(1, '#5ab0ff'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) { const x = Math.random() * W; g.strokeStyle = 'rgba(90,140,220,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 8, H); g.stroke(); } return tex(c); }
export function buildNoegong(pal) {
  const D = NG_DIMS, m = physKit(buildHumanoid(D)), J = m.J;
  const skinT = mottle('ngSkin', { base: '#3e5e92', dark: '#2a4070', light: '#6080b8', scale: 10, seed: 51, rep: [2, 1], bump: 1.4, cracks: 12, crackColor: 'rgba(160,220,255,0.6)', crackGlow: '#8ad8ff' });
  const M = {
    skin: phys({ map: skinT.map, normalMap: skinT.normal, normalScale: new THREE.Vector2(0.6, 0.6), emissiveMap: skinT.glow, emissive: pal.accent, emissiveIntensity: 1, roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color(0xa0d0ff) }),
    gold: phys({ color: 0xe8b850, metalness: 1, roughness: 0.25, clearcoat: 0.5 }),
    cloud: phys({ map: T('ngCloud', cloudTex), roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0x8aa8ff), side: THREE.DoubleSide }),
    lacq: phys({ color: 0xa81a22, roughness: 0.25, clearcoat: 1 }),
    drum: phys({ map: T('ngDrum', drumTex), roughness: 0.6, emissive: 0x000000 }),
    hair: phys({ map: T('ngHair', hairTex), emissive: 0x4aa0ff, emissiveIntensity: 0.6, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }),
    eye: glowMat(0xd8f4ff, 3), tooth: phys({ color: 0xf0ead8, roughness: 0.35 }), horn: phys({ color: 0x1a1a24, roughness: 0.3, clearcoat: 1 }),
    claw: phys({ color: 0x14141c, roughness: 0.2, clearcoat: 1 }), wood: phys({ color: 0x3a2214, roughness: 0.4, clearcoat: 0.6 }),
    glow: glowMat(pal.accent, 2.8), scarf: phys({ color: 0x9ac8ff, emissive: pal.accent, emissiveIntensity: 0.35, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xffffff), transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    prim: phys({ map: cardTex('ngPrim', { feather: true, root: '#2a3a6a', tip: '#0e1430', band: 'rgba(140,200,255,0.5)' }), alphaTest: 0.45, roughness: 0.6, side: THREE.DoubleSide }),
    sec: phys({ map: cardTex('ngSec', { feather: true, root: '#3a4a7a', tip: '#1a2248', seed: 6 }), alphaTest: 0.45, roughness: 0.6, side: THREE.DoubleSide }),
    cover: phys({ map: cardTex('ngCov', { feather: true, root: '#4a5a8a', tip: '#2a3460', seed: 2 }), alphaTest: 0.45, roughness: 0.6, side: THREE.DoubleSide }),
  };
  /* ---------- 근육질 몸통: 복근 · 큰 가슴 · 넓은 등 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: -0.12 + 0.22 * v, rx: 0.15, rzF: 0.11, rzB: 0.12, n: 2.2 }), 32, 6)), M.skin);
  const abs = (p, u, v, c, sn) => { if (sn > 0.3) { const l = Math.hypot(p.x, p.z), k = 0.006 * Math.max(0, Math.sin(v * 3 * TAU)) * gauss(Math.abs(p.x) - 0.035, 0.025); p.x += (p.x / l) * k; p.z += (p.z / l) * k; } };
  add(J.spine, C('abdomen', () => loft((v) => ({ y: -0.04 + 0.27 * v, rx: 0.135 + 0.01 * v, rzF: 0.1, rzB: 0.095, n: 2.2 }), 36, 14, { mod: abs })), M.skin);
  const cX = spl([[0, 0.15], [0.4, 0.18], [0.75, 0.2], [0.9, 0.175], [1, 0.07]]), cF = spl([[0, 0.1], [0.55, 0.125], [0.85, 0.1], [1, 0.05]]), cB = spl([[0, 0.1], [0.6, 0.12], [1, 0.06]]);
  const chP = (v) => ({ y: -0.02 + 0.37 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), n: 2.15 });
  const chMod = (p, u, v, c, sn) => { const l = Math.hypot(p.x, p.z), ax = Math.abs(p.x); let k = 0; if (sn > 0) k += 0.022 * gauss(ax - 0.08, 0.06) * gauss(v - 0.66, 0.1) * sn; k += 0.02 * gauss(v - 0.94, 0.06) * gauss(ax - 0.1, 0.06); if (sn < 0) k += 0.015 * gauss(ax - 0.12, 0.06) * gauss(v - 0.5, 0.2); p.x += (p.x / l) * k; p.z += (p.z / l) * k; };
  add(J.chest, C('chest', () => loft(chP, 48, 20, { mod: chMod })), M.skin);
  // 금 가슴띠(X자) + 가운데 번개 문장
  for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, u = 0.5 + s * (0.42 - 0.84 * t) * 0.5 + (t > 0.5 ? 0 : 0), q = loftAt(chP, 0.5 + s * 0.38 * (1 - 2 * t), 0.95 - 0.8 * t, new V3(), chMod); pts.push(q.multiplyScalar(1.06)); }
    add(J.chest, C('harness' + s, () => tube(pts, 0.012, 0.012, { seg: 40, flat: 0.4 })), M.gold); }
  { const q = loftAt(chP, 0.5, 0.55, new V3(), chMod); const em = new THREE.Group(); em.position.set(q.x, q.y, q.z + 0.02); J.chest.add(em);
    add(em, C('emblem', () => new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24)), M.gold, [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(em, C('bolt', () => { const sh = new THREE.Shape(); sh.moveTo(0.008, 0.035); sh.lineTo(-0.016, 0.0); sh.lineTo(0.002, 0.002); sh.lineTo(-0.01, -0.036); sh.lineTo(0.018, 0.006); sh.lineTo(0.0, 0.004); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }); }), M.glow, [0, 0, 0.006]); }
  // 허리: 금 띠 · 앞뒤 · 옆 구름무늬 가리개
  const beltP = (v) => ({ y: -0.03 + 0.07 * v, rx: 0.16, rzF: 0.12, rzB: 0.128, n: 2.2 });
  add(J.hips, C('belt', () => loft(beltP, 40, 2)), M.gold);
  add(J.hips, C('beltGem', () => new THREE.OctahedronGeometry(0.03, 0)), M.glow, [0, 0.005, 0.13]);
  m.flaps = [];
  for (const [ax, k, w, L] of [[0, 1, 0.13, 0.5], [0, -1, 0.15, 0.55], [1, 0, 0.11, 0.42], [-1, 0, 0.11, 0.42]]) {
    const g = new THREE.Group(); g.position.set(ax * 0.15, -0.04, k * 0.12); g.rotation.y = ax ? ax * Math.PI / 2 : k < 0 ? Math.PI : 0; J.hips.add(g); m.flaps.push({ g, ax, k });
    add(g, C('flap' + w + L, () => surf((u, v, p) => { const ww = w * (1 + 0.25 * v), x = (u - 0.5) * 2 * ww; p.set(x, -L * v, 0.012 + 0.03 * v - 0.07 * (x / w) ** 2); }, 8, 8)), M.cloud);
  }
  /* ---------- 팔: 굵은 팔 · 금 팔찌 · 발톱 손 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('delt', () => new THREE.SphereGeometry(0.068, 16, 12)), M.skin, [s * 0.008, -0.005, 0], [0, 0, 0], [1.1, 1, 1.1]);
    add(sh, C('uarm', () => limb(D.uArm, [[0, 0.064], [0.4, 0.062], [1, 0.045]], [[0, 0.062], [0.4, 0.06], [1, 0.043]], { mod: bulge([[0.5, 0.45, 0.014], [0, 0.4, 0.012]]) })), M.skin);
    add(sh, C('armlet', () => new THREE.TorusGeometry(0.058, 0.009, 8, 24)), M.gold, [0, -0.12, 0], [Math.PI / 2, 0, 0]);
    add(el, C('farm', () => limb(D.lArm, [[0, 0.05], [0.3, 0.055], [1, 0.038]], [[0, 0.048], [0.3, 0.052], [1, 0.035]], { mod: bulge([[0.25, 0.3, 0.008], [0.75, 0.3, 0.008]]) })), M.skin);
    const brc = (v) => ({ y: -D.lArm * (0.5 + 0.48 * v), rx: 0.05 - 0.008 * v, rz: 0.048 - 0.008 * v });
    add(el, C('bracer', () => loft(brc, 20, 4)), M.gold);
    const hg = clawHand(C, 'hand', { s, n: 4, len: 0.075, r: 0.012, curl: 2.2, claw: 0.03, palm: [0.036, 0.065, 0.02], mat: M.skin, clawMat: M.claw }); hg.position.y = -0.006; ha.add(hg);
  }
  /* ---------- 다리: 근육 허벅지 · 금 정강이 갑 · 매 발톱 발 ---------- */
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, C('thigh', () => limb(D.thigh, [[0, 0.09], [0.4, 0.085], [1, 0.056]], [[0, 0.092], [0.4, 0.085], [1, 0.056]], { mod: bulge([[0.5, 0.35, 0.014], [0.25, 0.5, 0.008], [0.75, 0.5, 0.008]]) })), M.skin);
    add(kn, C('shin', () => limb(D.shin, [[0, 0.055], [0.3, 0.058], [1, 0.035]], [[0, 0.056], [0.3, 0.066], [1, 0.036]], { cz: [[0, 0], [0.3, -0.008], [1, 0]] })), M.skin);
    add(kn, C('greave', () => loft((v) => ({ y: -0.06 - (D.shin - 0.12) * v, rx: 0.06 - 0.02 * v, rzF: 0.064 - 0.02 * v, rzB: 0.05 }), 16, 6, { a0: 0.18, a1: 0.82 })), M.gold);
    add(ft, C('ankle', () => new THREE.SphereGeometry(0.035, 10, 8)), M.skin, [0, -0.02, 0]);
    for (const [ax, az, L, r0] of [[0, 1, 0.13, 0.017], [0.55, 0.84, 0.11, 0.016], [-0.55, 0.84, 0.11, 0.016], [0, -1, 0.07, 0.016]]) {
      const pts = [new V3(0, -0.025, 0), new V3(ax * L * 0.5, -0.04, az * L * 0.55), new V3(ax * L, -0.05, az * L)];
      add(ft, C(`toe${ax}${az}`, () => strand(pts, r0, r0 * 0.75, { seg: 8, rad: 7 })), M.skin);
      const cl = add(ft, C('talon', () => { const g = new THREE.ConeGeometry(0.011, 0.045, 6); g.translate(0, 0.022, 0); return g; }), M.claw, pts[2].toArray()); cl.quaternion.setFromUnitVectors(UP, new V3(ax, -0.9, az).normalize());
    }
  }
  /* ---------- 머리: 부리코 · 빛나는 눈 · 송곳니 · 뿔 · 타오르는 머리 · 수염 ---------- */
  add(J.neck, C('neck', () => limb(0.14, [[0, 0.065], [1, 0.055]], [[0, 0.065], [1, 0.055]], { y0: 0.02, y1: -0.14 })), M.skin).rotation.x = Math.PI;
  const H = J.head; H.scale.setScalar(1.12);
  add(H, C('head', () => HEAD.geo(64, 48)), M.skin);
  for (const s of [-1, 1]) {
    const e = HEAD.at(s * 0.36, 0.08, -0.008); add(H, C('eye', () => new THREE.SphereGeometry(0.02, 14, 10)), M.eye, e.toArray(), [0, 0, 0], [1.1, 0.8, 0.8]);
    add(H, C('lid', () => new THREE.SphereGeometry(0.024, 14, 8, 0, TAU, 0, Math.PI * 0.42)), M.skin, e.toArray(), [0.6, 0, s * 0.45], [1.15, 1, 1]);
    const fg = add(H, C('fang', () => { const g = new THREE.ConeGeometry(0.008, 0.035, 7); g.rotateX(Math.PI); g.translate(0, -0.016, 0); return g; }), M.tooth, HEAD.at(s * 0.24, -0.47, -0.004).toArray()); fg.rotation.x = 0.15;
    add(H, C('horn' + s, () => strand([HEAD.at(s * 0.45, 0.75, -0.005), HEAD.at(s * 0.6, 0.95, 0.04), HEAD.at(s * 0.65, 1.15, 0.1)], 0.02, 0.003, { seg: 12, rad: 8 })), M.horn);
    add(H, C('ear' + s, () => strand([HEAD.at(s * 1.45, 0.15, -0.004), HEAD.at(s * 1.55, 0.3, 0.03), HEAD.at(s * 1.5, 0.55, 0.06)], 0.02, 0.003, { seg: 10, rad: 6, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  }
  // 타오르는 머리: 정수리 · 뒤통수에서 위 · 뒤로 솟는 불꽃 다발
  for (let k = 0; k < 16; k++) { const az = Math.PI + (k / 15 - 0.5) * 3.2, el = 0.55 + 0.35 * Math.cos((k / 15 - 0.5) * 3), base = HEAD.at(az, el, 0.002), out = base.clone().sub(HEAD.C).normalize();
    const L = 0.16 + 0.08 * Math.sin(k * 1.7), tip = base.clone().addScaledVector(out, L * 0.5).add(new V3(0, L, -L * 0.5));
    add(H, C('flame' + k, () => strand([base, base.clone().addScaledVector(out, 0.04).add(new V3(0, 0.03, 0)), base.clone().lerp(tip, 0.6).add(new V3(Math.sin(k) * 0.02, 0, 0)), tip], 0.026, 0.002, { seg: 14, rad: 6, flat: 0.5, ref: [out.x, 0, out.z] })), M.hair); }
  for (let k = 0; k < 9; k++) { const az = (k / 8 - 0.5) * 1.6, base = HEAD.at(az, -0.62, 0.002), tip = base.clone().add(new V3(az * 0.03, -0.14 - 0.04 * Math.cos(az * 2), 0.03));
    add(H, C('beard' + k, () => strand([base, base.clone().lerp(tip, 0.5).add(new V3(0, 0, 0.015)), tip], 0.016, 0.002, { seg: 10, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.hair); }
  /* ---------- 날개 · 천둥북 고리 ---------- */
  m.wings = [1, -1].map((s) => buildWing(J.chest, s, M, { at: [s * 0.09, 0.28, -0.11], len: 1.45 }));
  const ring = new THREE.Group(); ring.position.set(0, 0.3, -0.34); J.chest.add(ring); m.ring = ring;
  const RR = 0.72; add(ring, C('ring', () => new THREE.TorusGeometry(RR, 0.022, 10, 72)), M.gold);
  add(ring, C('ring2', () => new THREE.TorusGeometry(RR * 0.88, 0.01, 6, 64)), M.gold);
  m.drums = [];
  const drumG = C('drumBody', () => lathe([[0.0, -0.075], [0.1, -0.075], [0.12, -0.05], [0.13, 0], [0.12, 0.05], [0.1, 0.075], [0, 0.075]], 20));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, d = new THREE.Group(); d.position.set(Math.cos(a) * RR, Math.sin(a) * RR, 0); d.rotation.z = a - Math.PI / 2; ring.add(d);
    add(d, drumG, M.lacq); for (const y of [-0.076, 0.076]) add(d, C('skin', () => new THREE.CircleGeometry(0.1, 20)), M.drum, [0, y, 0], [y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]);
    for (const y of [-0.062, 0.062]) add(d, C('studs', () => new THREE.TorusGeometry(0.108, 0.008, 6, 20)), M.gold, [0, y, 0], [Math.PI / 2, 0, 0]);
    const glow = add(d, C('dglow', () => new THREE.SphereGeometry(0.03, 10, 8)), M.glow, [0, 0.085, 0]); m.drums.push({ d, glow, k: 0 }); }
  /* ---------- 북채 (양손) ---------- */
  const mallet = (parent) => { const g = new THREE.Group(); parent.add(g);
    add(g, C('handle', () => { const gg = new THREE.CylinderGeometry(0.016, 0.02, 0.5, 10); gg.rotateX(Math.PI / 2); gg.translate(0, 0, 0.17); return gg; }), M.wood);
    add(g, C('mhead', () => { const gg = new THREE.SphereGeometry(0.06, 16, 12); gg.scale(1, 1, 1.15); return gg; }), M.lacq, [0, 0, 0.45]);
    add(g, C('mband', () => new THREE.TorusGeometry(0.05, 0.008, 6, 16)), M.gold, [0, 0, 0.41]);
    add(g, C('mglow', () => new THREE.SphereGeometry(0.028, 10, 8)), M.glow, [0, 0, 0.52]); return g; };
  m.malletR = mallet(J.weapon); m.malletL = mallet(J.handL); m.malletL.position.set(0, -0.07, 0); m.malletL.rotation.x = 0.9;
  /* ---------- 떠다니는 천의 (로프 4: 어깨 · 팔꿈치) ---------- */
  for (const [j, p, rest] of [[J.chest, new V3(0.17, 0.3, -0.1), new V3(0.4, -0.3, -1)], [J.chest, new V3(-0.17, 0.3, -0.1), new V3(-0.4, -0.3, -1)], [J.elbowL, new V3(0, -0.05, -0.04), new V3(0.3, -0.5, -1)], [J.elbowR, new V3(0, -0.05, -0.04), new V3(-0.3, -0.5, -1)]])
    m.addRope(j, p, 8, 0.09, M.scarf, (v) => 0.04 * (1 - 0.4 * v), { rest, flat: 0.12, side: new V3(0, 1, 0), caps: 'none', float: 1.05, stiff: 0.05, damp: 0.96 });
  let t = 0; m.ringSpin = 0.4; m.wingK = 0.1;
  m.update = (dt, f) => {
    t += dt;
    // 떠 있는 높이: 발이 땅에서 살짝 떨어져 위아래로 흔들린다
    m.sole = 0.24 + Math.sin(t * 1.8) * 0.04;
    ring.rotation.z += dt * m.ringSpin; m.ringSpin += ((f.state === 'act' ? 1.6 : 0.4) * (f.enraged ? 1.6 : 1) - m.ringSpin) * Math.min(1, dt * 3);
    for (const d of m.drums) { d.k = Math.max(0, d.k - dt * 3); d.glow.scale.setScalar(1 + d.k * 1.5); }
    const want = !f.onGround || (f.state === 'act' && f.act && f.act.wings) ? 1 : 0.1; m.wingK += (want - m.wingK) * Math.min(1, dt * 5);
    for (const w of m.wings) w.update(m.wingK, t * (m.wingK > 0.5 ? 9 : 2));
    for (const { g, ax, k } of m.flaps) { const hx = Math.min(J.hipL.rotation.x, J.hipR.rotation.x); g.rotation.x = ax ? 0 : k > 0 ? Math.min(0, hx) * 0.8 : Math.max(0, Math.max(J.hipL.rotation.x, J.hipR.rotation.x)) * 0.5; if (ax) g.rotation.z = 0; }
    const pulse = 0.8 + 0.4 * Math.sin(t * 6 + Math.sin(t * 17)); M.skin.emissiveIntensity = pulse * (f.enraged ? 1.2 : 0.6); M.glow.emissiveIntensity = 2.4 + pulse; M.hair.emissiveIntensity = 0.5 + 0.3 * pulse;
    const cp = m.bodyCaps(f, 0.14); m.stepRopes(dt, f, cp.body, cp.legs);
  };
  m.beat = (i) => { const d = m.drums[i % 8]; if (d) d.k = 1; };
  m.sole = 0.24;
  m.tipPos = (out = new V3()) => J.weapon.localToWorld(out.set(0, 0, 0.5));
  m.weaponPts = (b, tt) => { J.weapon.localToWorld(b.set(0, 0, 0.15)); J.weapon.localToWorld(tt.set(0, 0, 0.55)); };
  return m;
}
