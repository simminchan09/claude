// 심해 어인 — 바다 밑의 전사 (정예 · 슈퍼아머)
// 구성: 겹친 비늘 결의 청록 근육 몸 (밝은 배) · 등을 따라 솟은 가시 지느러미 막 · 어깨와 등의 따개비 무리
//       커다란 심해어 머리 (튀어나온 아래턱 · 바늘 이빨 두 줄 · 옆으로 불룩한 빛나는 눈 · 아가미 틈 · 머리 볏 지느러미)
//       이마에서 늘어진 초롱아귀 미끼 (로프 + 빛나는 구슬) · 팔꿈치 지느러미 · 물갈퀴 손발과 검은 발톱
//       밧줄 허리띠 · 조개 장식 · 해초 허리 가리개 · 늘어진 해초 다발 3 (로프) · 산호가 엉긴 청동 삼지창
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, strand, spl, lathe, gauss, smooth, envCube } from '../../sculpt.js';
import { V3, TAU, C, cv, tex, rng, T, shared, std, phys, add, rim, lRim, normalFrom, physRig } from './ocean_kit.js';

export const FISH_DIMS = { hipH: 0.9, spineL: 0.22, chestL: 0.34, neckL: 0.05, shW: 0.25, uArm: 0.32, lArm: 0.31, hipW: 0.115, thigh: 0.42, shin: 0.41, headTop: 0.3 };
const D = FISH_DIMS;

function scaleCanvas(hgt, belly) {
  const W = 256, H = 256, [c, g] = cv(W, H), r = rng(belly ? 3 : 2); g.fillStyle = hgt ? '#000' : belly ? '#8ac8b0' : '#1e6a6e'; g.fillRect(0, 0, W, H);
  const s = 16;
  for (let row = -1; row < H / (s * 0.6) + 2; row++) for (let i = -1; i < W / s + 1; i++) {
    const x = i * s + (row % 2) * s / 2, y = H - row * s * 0.6;
    const gr = g.createRadialGradient(x, y - s * 0.3, 1, x, y, s * 0.75);
    if (hgt) { gr.addColorStop(0, '#fff'); gr.addColorStop(0.8, '#888'); gr.addColorStop(1, '#000'); }
    else { const v = r() * 30 - 15, b = belly ? [140, 200, 176] : [34, 112, 116]; gr.addColorStop(0, `rgb(${b[0] + 40 + v},${b[1] + 40 + v},${b[2] + 40 + v})`); gr.addColorStop(0.75, `rgb(${b[0] + v},${b[1] + v},${b[2] + v})`); gr.addColorStop(1, `rgb(${b[0] * 0.4},${b[1] * 0.4},${b[2] * 0.4})`); }
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.72, Math.PI, 0); g.lineTo(x + s * 0.72, y + s * 0.3); g.lineTo(x - s * 0.72, y + s * 0.3); g.fill();
  }
  return c;
}
function finCanvas() { const W = 128, H = 256, [c, g] = cv(W, H), gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, 'rgba(30,110,120,0.95)'); gr.addColorStop(1, 'rgba(90,240,210,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(10,40,50,0.7)'; g.lineWidth = 3; for (let x = 8; x < W; x += 16) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + (x - W / 2) * 0.2, 0); g.stroke(); } return c; }
function weedCanvas() { const W = 64, H = 256, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a5a20'); gr.addColorStop(1, '#6a8a2a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(20,40,10,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); return c; }
function ropeCanvas() { const W = 64, H = 256, [c, g] = cv(W, H); g.fillStyle = '#8a7048'; g.fillRect(0, 0, W, H); for (let y = -32; y < H + 32; y += 16) { g.fillStyle = '#5a4428'; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 20); g.lineTo(W, y + 26); g.lineTo(0, y + 6); g.fill(); } return c; }

function fishMats(pal) {
  return shared('fish:' + pal.accent, () => {
    const env = envCube();
    return {
      skin: phys({ map: T('scale', () => tex(scaleCanvas(false), [2, 2])), normalMap: T('scaleN', () => normalFrom(scaleCanvas(true), 2.2, [3, 3])), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.3, envMap: env, envMapIntensity: 0.5 }),
      belly: phys({ map: T('scaleB', () => tex(scaleCanvas(false, true), [3, 3])), normalMap: T('scaleN', () => normalFrom(scaleCanvas(true), 2.2, [3, 3])), roughness: 0.35, clearcoat: 0.6, envMap: env, envMapIntensity: 0.4 }),
      fin: std({ map: T('fin', () => tex(finCanvas())), transparent: true, opacity: 0.88, roughness: 0.4, side: THREE.DoubleSide, depthWrite: false }),
      mouth: std({ color: 0x2a0a14, roughness: 0.6 }),
      tooth: std({ color: 0xf0ecdc, roughness: 0.3 }),
      claw: std({ color: 0x101418, roughness: 0.3 }),
      eye: phys({ color: 0x0a2a20, emissive: pal.accent, emissiveIntensity: 1.6, roughness: 0.05, clearcoat: 1 }),
      pupil: new THREE.MeshBasicMaterial({ color: 0x020404 }),
      glow: new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
      lure: std({ color: 0xc8fff0, emissive: pal.accent, emissiveIntensity: 2.6 }),
      barn: std({ color: 0xc8c0a8, roughness: 0.9, flatShading: true }),
      weed: std({ map: T('weed', () => tex(weedCanvas())), roughness: 0.7, side: THREE.DoubleSide }),
      rope: std({ map: T('rope', () => tex(ropeCanvas(), [1, 4])), roughness: 0.9 }),
      bronze: std({ color: 0x5aa088, metalness: 0.75, roughness: 0.4, envMap: env }),
      bronzeB: std({ color: 0xb88a48, metalness: 0.9, roughness: 0.3, envMap: env, envMapIntensity: 1.2 }),
      coral: std({ color: 0xff7a6a, roughness: 0.7 }),
      shell: std({ color: 0xf0d0c0, roughness: 0.5 }),
    };
  });
}
// 심해어 머리 (위턱 · 머리통): 앞으로 길고 아래가 넓다
const HC = new V3(0, 0.11, 0.05);
function fishHead(az, el, p) {
  const ce = Math.cos(el), x = Math.sin(az) * ce, y = Math.sin(el), z = Math.cos(az) * ce, fr = Math.max(0, z);
  let rx = 0.11, ry = 0.1, rz = 0.15;
  rx *= 1 - 0.25 * smooth(0.2, 1, y) - 0.2 * fr * fr * smooth(-0.2, 0.6, y);
  const r = 1 + 0.08 * gauss(Math.abs(az) - 1.0, 0.25) * gauss(el - 0.1, 0.2); // 눈 둔덕
  p.set(HC.x + x * rx * r, HC.y + y * ry * (y < 0 ? 0.55 : 1) * r, HC.z + z * rz * r);
  return p;
}
export function buildFishman(pal, scale = 1.5) {
  const m = buildHumanoid(D), J = m.J, M = fishMats(pal); physRig(m, scale);
  /* 몸통 */
  add(J.hips, C('f:pelvis', () => loft((v) => ({ y: -0.13 + 0.22 * v, rx: 0.16 - 0.02 * v, rzF: 0.11, rzB: 0.12, n: 2.2 }), 32, 8)), M.skin);
  const bX = spl([[0, 0.15], [0.5, 0.145], [1, 0.17]]);
  add(J.spine, C('f:belly', () => loft((v) => ({ y: -0.04 + 0.28 * v, rx: bX(v), rzF: 0.12 + 0.01 * Math.sin(v * Math.PI), rzB: 0.115, n: 2.2 }), 36, 10)), M.skin);
  add(J.spine, C('f:bellyF', () => loft((v) => ({ y: -0.03 + 0.26 * v, rx: bX(v) * 0.7, rzF: 0.125 + 0.012 * Math.sin(v * Math.PI), rzB: 0.02, n: 2.2 }), 24, 8, { a0: 0.32, a1: 0.68, mod: (p, u, v) => { p.z += 0.004 * Math.cos(v * 20) ** 2; } })), M.belly);
  const chX = spl([[0, 0.17], [0.4, 0.2], [0.8, 0.22], [1, 0.15]]), chF = spl([[0, 0.125], [0.6, 0.14], [1, 0.1]]);
  const chP = (v) => ({ y: -0.02 + 0.36 * v, rx: chX(v), rzF: chF(v), rzB: chF(v) * 1.05, n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) p.z += 0.025 * gauss(Math.abs(p.x) - 0.08, 0.06) * gauss(p.y - 0.22, 0.07) * sn; if (sn < -0.3) p.z -= 0.03 * gauss(v - 0.85, 0.2) * -sn; /* 굽은 등 */ };
  add(J.chest, C('f:chest', () => loft(chP, 48, 16, { mod: chMod })), M.skin);
  // 등지느러미: 등뼈를 따라 가시 + 막
  { const dP = (u, v, p) => { const y = 0.02 + 0.36 * u, back = loftAt(chP, 0, Math.min(1, (y + 0.02) / 0.36), new V3(), chMod), h = 0.16 * Math.sin(Math.PI * (0.1 + 0.85 * u)) * v; p.set(0, y + h * 0.4, back.z - 0.005 - h); };
    add(J.chest, C('f:dorsal', () => surf(dP, 16, 4)), M.fin);
    for (let i = 1; i < 8; i++) { const a = new V3(), b = new V3(); dP(i / 8, 0, a); dP(i / 8, 1.08, b); add(J.chest, C('f:dray' + i, () => strand([a, b], 0.006, 0.0015, { seg: 4, rad: 5 })), M.claw); } }
  // 따개비
  const barnG = C('f:barn', () => { const g = new THREE.CylinderGeometry(0.008, 0.018, 0.018, 7, 1, true); g.translate(0, 0.009, 0); return g; });
  const barns = (parent, pts) => { for (const [x, y, z, nx, nz] of pts) { const o = add(parent, barnG, M.barn, [x, y, z]); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(nx, 0.6, nz).normalize()); } };
  barns(J.chest, [[0.15, 0.3, -0.1, 0.5, -0.8], [0.12, 0.33, -0.12, 0.3, -0.9], [0.17, 0.27, -0.06, 0.8, -0.5], [-0.1, 0.12, -0.15, -0.3, -1], [-0.13, 0.1, -0.13, -0.6, -0.8]]);
  /* 목 · 머리 */
  add(J.neck, C('f:neck', () => loft((v) => ({ y: -0.04 + 0.14 * v, rx: 0.1 - 0.01 * v, rzF: 0.095, rzB: 0.08 }), 24, 4)), M.skin);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(J.neck, C('f:gill' + k, () => strand([[0, 0.05, 0], [0, 0.0, 0.01], [0, -0.05, 0.0]], 0.006, 0.004, { seg: 6, rad: 5 })), M.mouth, [s * (0.098 - k * 0.006), 0.04, 0.02 - k * 0.025]);
  const H = J.head; H.scale.setScalar(1.22);
  add(H, C('f:head', () => surf((u, v, p) => fishHead((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI, p), 48, 32, { closedU: true, poles: [0, 32] })), M.skin);
  // 입 속 (어두운 판) · 위 이빨
  add(H, C('f:mouthIn', () => { const g = new THREE.SphereGeometry(0.1, 16, 10, 0, TAU, Math.PI / 2, Math.PI / 2); g.scale(0.9, 0.35, 1.3); return g; }), M.mouth, [0, 0.07, 0.07]);
  const tooth = C('f:tooth', () => { const g = new THREE.ConeGeometry(0.006, 0.034, 5); g.translate(0, -0.017, 0); return g; });
  for (let i = 0; i < 11; i++) { const a = -1.15 + (i / 10) * 2.3, q = fishHead(a, -0.25, new V3()); add(H, tooth, M.tooth, [q.x * 0.95, q.y - 0.002, q.z - 0.005], [0.15 * Math.cos(a), 0, 0], [1, 0.8 + 0.5 * Math.cos(a * 2) ** 2, 1]); }
  // 아래턱 (튀어나온 주걱턱)
  const jaw = new THREE.Group(); jaw.position.set(0, 0.06, -0.03); H.add(jaw); m.jaw = jaw;
  add(jaw, C('f:jaw', () => surf((u, v, p) => { const a = (u - 0.5) * Math.PI * 1.25, r = 0.13 - 0.02 * v; p.set(Math.sin(a) * r * 0.85, -0.035 * Math.sin(v * Math.PI) - 0.02 * v, 0.03 + Math.cos(a) * r * (1.05 + 0.15 * (1 - v)) - 0.04 * v); }, 20, 6)), M.belly);
  add(jaw, C('f:jawIn', () => surf((u, v, p) => { const a = (u - 0.5) * Math.PI * 1.2, r = 0.115 * (1 - v * 0.8); p.set(Math.sin(a) * r * 0.85, 0.002, 0.03 + Math.cos(a) * r * 1.1); }, 16, 4)), M.mouth);
  for (let i = 0; i < 12; i++) { const a = -1.2 + (i / 11) * 2.4, r = 0.125; add(jaw, tooth, M.tooth, [Math.sin(a) * r * 0.82, 0.0, 0.03 + Math.cos(a) * r * 1.14], [Math.PI + 0.2 * Math.cos(a), 0, 0], [1, 0.9 + 0.6 * Math.cos(a * 2.2) ** 2, 1]); }
  // 눈 · 볏 · 미끼
  for (const s of [-1, 1]) { const q = fishHead(s * 1.0, 0.15, new V3());
    add(H, C('f:eye', () => new THREE.SphereGeometry(0.034, 16, 12)), M.eye, [q.x, q.y, q.z]);
    add(H, C('f:pup', () => { const g = new THREE.SphereGeometry(0.014, 10, 8); g.scale(0.5, 1, 1); return g; }), M.pupil, [q.x + s * 0.03, q.y, q.z + 0.012]);
    const g = add(H, C('f:eyeG', () => new THREE.SphereGeometry(0.06, 12, 10)), M.glow, [q.x, q.y, q.z]); g.renderOrder = 4; }
  { const cP = (u, v, p) => { const az = Math.PI * (0.9 - 1.0 * u), q = fishHead(0, Math.min(1.5, 0.5 + 1.1 * u), new V3()); p.set(0, q.y + 0.1 * v * Math.sin(Math.PI * (0.15 + 0.8 * u)), q.z - 0.06 * v * u); };
    add(H, C('f:crest', () => surf(cP, 12, 3)), M.fin); }
  const lureBall = new THREE.Group(); add(lureBall, C('f:lure', () => new THREE.SphereGeometry(0.03, 14, 10)), M.lure); const lg = add(lureBall, C('f:lureG', () => new THREE.SphereGeometry(0.08, 12, 10)), M.glow); lg.renderOrder = 4;
  const lure = m.addRope({ n: 6, seg: 0.06, joint: H, local: new V3(0, 0.205, 0.1), rest: new V3(0, 0.4, 1), mat: M.claw, prof: (v) => 0.008 - 0.004 * v, rad: 5, caps: 'none', stiff: 0.45, damp: 0.96 });
  m.worldObjs = [lureBall];
  /* 팔: 굵은 근육 · 팔꿈치 지느러미 · 물갈퀴 손 */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('f:delt', () => { const g = new THREE.SphereGeometry(0.095, 18, 14); g.scale(1.05, 0.95, 1); return g; }), M.skin, [s * 0.01, 0, 0]);
    barns(sh, [[s * 0.06, 0.06, -0.02, s * 0.7, -0.3], [s * 0.04, 0.08, 0.03, s * 0.4, 0.3], [s * 0.08, 0.03, 0.0, s, 0]]);
    const uX = spl([[0, 0.078], [0.4, 0.083], [1, 0.062]]);
    add(sh, C('f:uarm', () => loft((v) => ({ y: 0.02 - (D.uArm + 0.02) * v, rx: uX(v), rzF: uX(v) * 1.05, rzB: uX(v) }), 24, 10, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z += 0.014 * gauss(v - 0.45, 0.2) * sn; } })), M.skin);
    const fX = spl([[0, 0.066], [0.3, 0.074], [1, 0.05]]);
    add(el, C('f:farm', () => loft((v) => ({ y: 0.02 - D.lArm * v, rx: fX(v), rz: fX(v) * 0.92 }), 24, 10)), M.skin);
    add(el, C('f:afin' + s, () => surf((u, v, p) => { const y = 0.02 - 0.24 * u; p.set(s * 0.02, y - 0.04 * v * u, -0.06 - 0.1 * v * Math.sin(Math.PI * (0.2 + 0.7 * u))); }, 10, 3)), M.fin);
    const hg = new THREE.Group(); hg.scale.setScalar(1.25); ha.add(hg);
    add(hg, C('f:palm' + s, () => loft((v) => ({ y: -0.005 - 0.07 * v, rx: 0.026, rz: 0.042, n: 3, cx: s * 0.006 }), 14, 5)), M.skin);
    const tips = [];
    for (let k = 0; k < 3; k++) { const z = 0.025 - k * 0.025, curl = s < 0 ? 2.3 : 1.0, pts = []; for (let i = 0; i <= 6; i++) { const th = -0.6 - (i / 6) * curl; pts.push(new V3(s * 0.008 + s * Math.cos(th) * 0.045, -0.06 + Math.sin(th) * 0.045, z)); }
      add(hg, C(`f:fing${s}${k}`, () => strand(pts, 0.011, 0.007, { seg: 10, rad: 6 })), M.skin); add(hg, C('f:claw', () => new THREE.ConeGeometry(0.006, 0.03, 6)), M.claw, pts[6].toArray(), [0, 0, s < 0 ? -2.5 : -1.3]); tips.push(pts); }
    add(hg, C('f:web' + s, () => surf((u, v, p) => { const k = u * 2, i = Math.min(1, Math.floor(k)), f = k - i, a = tips[i][Math.round(v * 4)], b = tips[i + 1][Math.round(v * 4)]; p.lerpVectors(a, b, f); }, 8, 4)), M.fin);
  }
  /* 다리 · 물갈퀴 발 */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const tX = spl([[0, 0.1], [0.4, 0.09], [1, 0.062]]);
    add(hp, C('f:thigh', () => loft((v) => ({ y: 0.03 - (D.thigh + 0.03) * v, rx: tX(v), rzF: tX(v) * 1.02, rzB: tX(v) }), 24, 10)), M.skin);
    const cX = spl([[0, 0.064], [0.3, 0.072], [0.8, 0.046], [1, 0.04]]);
    add(kn, C('f:shin', () => loft((v) => ({ y: 0.02 - D.shin * v, rx: cX(v), rzF: cX(v) * 0.9, rzB: cX(v) * 1.15 }), 24, 10)), M.skin);
    add(ft, C('f:foot', () => surf((u, v, p) => { const a = u * TAU, w = 0.05 * Math.sin(Math.min(1, v * 1.2 + 0.25) * Math.PI * 0.85) + 0.012 + 0.03 * v * v, h = 0.05 * (1 - v * 0.75); p.set(Math.cos(a) * w, -0.06 + h / 2 + Math.sin(a) * h / 2, -0.05 + 0.25 * v); }, 18, 10, { closedU: true })), M.skin);
    for (let k = 0; k < 3; k++) add(ft, C('f:tclaw', () => new THREE.ConeGeometry(0.008, 0.035, 6).rotateX(Math.PI / 2)), M.claw, [(k - 1) * 0.03, -0.055, 0.21]);
  }
  /* 허리: 밧줄 띠 · 조개 · 해초 가리개 · 늘어진 해초 */
  const beltP = (v) => ({ y: 0.03 + 0.03 * v, rx: 0.168, rzF: 0.118, rzB: 0.128, n: 2.2 });
  rim(J.hips, 'f:beltA', [0, 0.12, 0.25, 0.37, 0.5, 0.62, 0.75, 0.88].map((u) => loftAt(beltP, u, 0.3, new V3())), 0.016, true, M.rope);
  rim(J.hips, 'f:beltB', [0, 0.12, 0.25, 0.37, 0.5, 0.62, 0.75, 0.88].map((u) => loftAt(beltP, u + 0.06, 0.9, new V3()).add(new V3(0, -0.02, 0))), 0.013, true, M.rope);
  for (const u of [0.42, 0.55, 0.66]) { const q = loftAt(beltP, u, 0.5, new V3()); add(J.hips, C('f:shell', () => { const g = new THREE.SphereGeometry(0.03, 12, 6, 0, TAU, 0, Math.PI / 2); g.scale(1, 0.5, 1); g.rotateX(Math.PI / 2); return g; }), M.shell, [q.x * 1.05, q.y, q.z * 1.05], [0, Math.atan2(q.x, q.z), 0]); }
  for (let i = 0; i < 9; i++) { const u = 0.3 + i * 0.05, q = loftAt(beltP, u, 0, new V3()); add(J.hips, C('f:weed' + (i % 3), () => surf((uu, v, p) => { p.set((uu - 0.5) * 0.05, -0.28 * v, 0.02 * Math.sin(v * 7 + i) + 0.03 * v); }, 2, 8)), M.weed, [q.x * 1.04, q.y, q.z * 1.04], [0, Math.atan2(q.x, q.z), 0]); }
  m.addRope({ n: 7, seg: 0.07, joint: J.hips, local: new V3(0.15, 0.03, -0.06), rest: new V3(0.3, -1, -0.2), mat: M.weed, prof: () => 0.022, flat: 0.15, side: new V3(1, 0, 0), caps: 'none' });
  m.addRope({ n: 7, seg: 0.07, joint: J.hips, local: new V3(-0.12, 0.03, -0.1), rest: new V3(-0.2, -1, -0.4), mat: M.weed, prof: () => 0.024, flat: 0.15, side: new V3(1, 0, 0), caps: 'none' });
  m.addRope({ n: 6, seg: 0.07, joint: J.shoulderL, local: new V3(0.06, 0.05, -0.06), rest: new V3(0.2, -1, -0.3), mat: M.weed, prof: () => 0.02, flat: 0.15, side: new V3(1, 0, 0), caps: 'none' });
  /* 무기: 산호 엉긴 청동 삼지창 */
  const W = J.weapon;
  add(W, C('f:pole', () => new THREE.CylinderGeometry(0.022, 0.024, 2.0, 10).rotateX(Math.PI / 2)), M.bronze, [0, 0, 0.55]);
  for (const [z, s] of [[0.0, 0.035], [0.9, 0.03], [-0.3, 0.03]]) add(W, C('f:coral' + z, () => { const g = new THREE.IcosahedronGeometry(s, 1); g.scale(1.3, 1, 1.6); return g; }), M.coral, [0.015, 0.01, z]);
  add(W, C('f:tbar', () => strand([[-0.13, 0, 1.45], [-0.06, 0, 1.55], [0, 0, 1.57], [0.06, 0, 1.55], [0.13, 0, 1.45]], 0.018, 0.018, { seg: 16, rad: 6 })), M.bronzeB);
  for (const x of [-0.13, 0, 0.13]) { const L = x ? 0.32 : 0.42;
    add(W, C('f:prong' + x, () => strand([[x, 0, x ? 1.45 : 1.55], [x * 1.05, 0, 1.6 + L * 0.4], [x * 0.9, 0, 1.55 + L]], 0.014, 0.004, { seg: 10, rad: 6 })), M.bronzeB);
    add(W, C('f:barb', () => new THREE.ConeGeometry(0.012, 0.06, 5).rotateX(Math.PI / 2 + 0.5)), M.bronzeB, [x * 0.95, 0, 1.55 + L * 0.72]); }
  let t = 0; const tA = new V3();
  m.update = (dt, f) => {
    t += dt; jaw.rotation.x = f.state === 'act' ? 0.3 + 0.1 * Math.sin(t * 20) : 0.12 + 0.05 * Math.sin(t * 1.7);
    m.stepPhys(dt, f); const p = lure.rope.p; lureBall.position.copy(p[p.length - 1]); lureBall.scale.setScalar(f.scale * (1 + 0.15 * Math.sin(t * 4)));
    M.lure.emissiveIntensity = 2.2 + Math.sin(t * 4) * 0.6;
  };
  m.sole = 0.07;
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0, 1.9));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.5)); W.localToWorld(tt.set(0, 0, 1.95)); };
  return m;
}
