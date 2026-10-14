// 유령 선장 블랙타이드 — 노을 바다의 망령 (보스, 떠다니는 유령)
// 구성: 푸르스름한 해골 얼굴 (깊은 눈구멍의 청록 도깨비불 · 아래턱) · 턱에서 흘러내리는 유령불 수염
//       금 테 · 해골 문장 · 흰 깃털의 거대한 삼각모 · 높은 깃의 남색 선장 코트 (금 단추 두 줄 · 붉은 안감 · 흰 자보)
//       금 술 견장 · 넓은 금 커프스 · 반투명 유령 손 · 큰 버클 허리띠
//       아래: 다리 대신 소용돌이치며 가늘어지는 유령 꼬리 (마디마다 흔들림) + 찢긴 코트 자락 (천 물리)
//       무기: 오른손 유령불 커틀러스 · 왼손에 감긴 사슬 (로프 + 사슬 고리) 끝의 녹슨 닻
//       영체화: 모든 재질이 투명해지고 청록 빛만 남는다 (setEther)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, strand, spl, lathe, gauss, smooth, envCube } from '../../sculpt.js';
import { V3, TAU, C, cv, tex, rng, T, std, phys, add, rim, lRim, normalFrom, physRig } from './ocean_kit.js';
import { skullPt } from './ocean_bones.js';

export const CAPT_DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.22, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44, headTop: 0.28 };
const D = CAPT_DIMS;

function coatCanvas() { const W = 512, H = 256, [c, g] = cv(W, H), r = rng(21); g.fillStyle = '#141c34'; g.fillRect(0, 0, W, H); for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(120,140,200,0.06)'; g.fillRect(r() * W, r() * H, 2, 2); }
  // 앞 여밈 (u 0.5) 양옆 금 단추 두 줄 · 금 테
  g.fillStyle = '#d8a040'; for (const x of [0.44, 0.56]) for (let y = 30; y < H - 20; y += 36) { g.beginPath(); g.arc(x * W, y, 7, 0, TAU); g.fill(); }
  g.fillRect(W * 0.5 - 3, 0, 6, H); g.fillRect(0, H - 12, W, 8); return c; }
function skirtCanvas() { const W = 256, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#141c34'); gr.addColorStop(0.75, '#1a2440'); gr.addColorStop(1, 'rgba(40,200,180,0.6)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#d8a040'; g.fillRect(0, 0, 8, H); g.fillRect(W - 8, 0, 8, H);
  g.fillStyle = 'rgba(0,0,0,1)'; g.globalCompositeOperation = 'destination-out'; const r = rng(3); for (let i = 0; i < 9; i++) { const x = r() * W, w = 20 + r() * 40, h = 40 + r() * 90; g.beginPath(); g.moveTo(x - w / 2, H); g.lineTo(x, H - h); g.lineTo(x + w / 2, H); g.fill(); } g.globalCompositeOperation = 'source-over'; return c; }
function ghostCanvas() { const W = 256, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(120,255,230,0.0)'); gr.addColorStop(0.3, 'rgba(90,255,210,0.55)'); gr.addColorStop(1, 'rgba(30,120,140,0.85)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(200,255,245,0.35)'; g.lineWidth = 6; for (let k = 0; k < 7; k++) { g.beginPath(); for (let y = 0; y <= H; y += 16) g.lineTo((k / 7) * W + Math.sin(y * 0.03 + k) * 20, y); g.stroke(); } return c; }
function hatCanvas() { const W = 256, H = 256, [c, g] = cv(W, H), r = rng(31); g.fillStyle = '#0e0e14'; g.fillRect(0, 0, W, H); for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(80,80,110,0.12)'; g.fillRect(r() * W, r() * H, 2, 1); } return c; }

export function buildCaptain(pal, scale = 1.7) {
  const m = buildHumanoid(D), J = m.J, env = envCube(); physRig(m, scale);
  const acc = pal.accent, all = [];
  const P = (o) => { const mt = phys({ transparent: true, ...o }); all.push(mt); mt.userData.op = o.opacity ?? 1; return mt; };
  const M = {
    coat: P({ map: T('c:coat', () => tex(coatCanvas())), roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0x6080c0) }),
    lining: P({ color: 0x7a1020, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xff6070) }),
    skirt: P({ map: T('c:skirt', () => tex(skirtCanvas())), roughness: 0.6, alphaTest: 0.3, side: THREE.DoubleSide }),
    gold: P({ color: 0xe8b850, metalness: 1, roughness: 0.25, envMap: env, envMapIntensity: 1.3 }),
    white: P({ color: 0xf0eee8, roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    hat: P({ map: T('c:hat', () => tex(hatCanvas())), roughness: 0.7 }),
    bone: P({ color: 0xc8dcd8, emissive: 0x0a3a34, emissiveIntensity: 0.6, roughness: 0.6 }),
    hole: P({ color: 0x020406, roughness: 1 }),
    leather: P({ color: 0x2a1a12, roughness: 0.5, clearcoat: 0.4 }),
    iron: P({ color: 0x4a4440, metalness: 0.85, roughness: 0.55, envMap: env }),
    rust: P({ color: 0x6a3a22, metalness: 0.5, roughness: 0.8 }),
    ghost: P({ map: T('c:ghost', () => tex(ghostCanvas())), color: 0xffffff, emissive: acc, emissiveIntensity: 0.6, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, roughness: 0.3 }),
    hand: P({ color: 0x8affe8, emissive: acc, emissiveIntensity: 0.8, opacity: 0.75, depthWrite: false, roughness: 0.3 }),
    blade: P({ color: 0xc8fff4, emissive: acc, emissiveIntensity: 1.3, opacity: 0.85, roughness: 0.1, metalness: 0.3 }),
    flame: new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    eye: new THREE.MeshBasicMaterial({ color: 0xd8fff4 }),
  };
  m.mats = M;
  /* 상체: 선장 코트 · 자보 · 깃 · 견장 */
  const chX = spl([[0, 0.13], [0.4, 0.15], [0.8, 0.16], [1, 0.11]]);
  const chP = (v) => ({ y: -0.04 + 0.32 * v, rx: chX(v), rzF: 0.1 + 0.01 * Math.sin(v * Math.PI), rzB: 0.105, n: 2.2 });
  add(J.chest, C('c:chest', () => loft(chP, 48, 14, { uvU: 1 })), M.coat);
  add(J.spine, C('c:waist', () => loft((v) => ({ y: -0.06 + 0.28 * v, rx: 0.12 + 0.01 * v, rzF: 0.09, rzB: 0.095, n: 2.2 }), 40, 8, { uvU: 1 })), M.coat);
  add(J.hips, C('c:hipC', () => loft((v) => ({ y: 0.06 - 0.16 * v, rx: 0.125 + 0.04 * v, rzF: 0.095 + 0.02 * v, rzB: 0.1 + 0.03 * v, n: 2.2 }), 40, 4, { uvU: 1 })), M.coat);
  const beltP = (v) => ({ y: 0.0 + 0.06 * v, rx: 0.13, rzF: 0.1, rzB: 0.105, n: 2.3 });
  add(J.hips, C('c:belt', () => loft(beltP, 40, 2)), M.leather);
  add(J.hips, C('c:buckle', () => new THREE.BoxGeometry(0.07, 0.06, 0.012)), M.gold, [0, 0.03, 0.105]);
  add(J.hips, C('c:buckleI', () => new THREE.BoxGeometry(0.045, 0.036, 0.014)), M.leather, [0, 0.03, 0.106]);
  // 라펠 (붉은 안감) · 자보 · 높은 깃
  for (const s of [-1, 1]) add(J.chest, C('c:lapel' + s, () => surf((u, v, p) => { const y = 0.08 + 0.2 * v, q = loftAt(chP, 0.5 + s * (0.02 + 0.09 * u * (0.4 + 0.6 * v)), (y + 0.04) / 0.32, new V3()); const l = Math.hypot(q.x, q.z); p.set(q.x * (l + 0.006) / l, q.y, q.z * (l + 0.006) / l); }, 6, 8)), M.lining);
  add(J.chest, C('c:jabot', () => surf((u, v, p) => { const y = 0.27 - 0.17 * v, w = 0.02 + 0.03 * v; p.set((u - 0.5) * 2 * w, y + 0.008 * Math.sin(u * 20) * v, 0.108 + 0.02 * v - 0.02 * ((u - 0.5) * 2) ** 2); }, 10, 8)), M.white);
  const colP = (v) => ({ y: 0.26 + 0.1 * v, rx: 0.075 + 0.02 * v, rzF: 0.07 + 0.015 * v, rzB: 0.07 + 0.03 * v, cz: -0.01 * v });
  add(J.chest, C('c:collar', () => loft(colP, 32, 4, { a0: 0.62, a1: 1.38 })), M.coat); lRim(J.chest, 'c:colR', colP, 1, 0.006, M.gold, { a0: 0.62, a1: 1.38 });
  /* 목 · 해골 얼굴 · 유령불 수염 · 삼각모 */
  add(J.neck, C('c:neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.035, rz: 0.035 }), 12, 3)), M.bone);
  const H = J.head; H.scale.setScalar(1.15);
  add(H, C('c:skull', () => surf((u, v, p) => skullPt((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI, p), 56, 40, { closedU: true, poles: [0, 40] })), M.bone);
  const eyes = [];
  for (const s of [-1, 1]) { const p = skullPt(s * 0.38, 0.06, new V3());
    add(H, C('c:sock', () => { const g = new THREE.SphereGeometry(0.024, 14, 10); g.scale(1.05, 0.95, 0.45); return g; }), M.hole, [p.x, p.y, p.z - 0.002], [0, s * 0.35, 0]);
    add(H, C('c:eye', () => new THREE.SphereGeometry(0.008, 8, 6)), M.eye, [p.x, p.y, p.z + 0.006]);
    const f = add(H, C('c:eyeF', () => { const g = new THREE.ConeGeometry(0.022, 0.08, 8, 1, true); g.translate(0, 0.03, 0); return g; }), M.flame, [p.x, p.y, p.z + 0.004], [-0.4, 0, 0]); f.renderOrder = 5; eyes.push(f); }
  { const n = skullPt(0, -0.14, new V3()); add(H, C('c:nose', () => { const g = new THREE.ConeGeometry(0.014, 0.03, 3); g.rotateZ(Math.PI); g.scale(1, 1, 0.4); return g; }), M.hole, [n.x, n.y, n.z + 0.001]); }
  const jaw = new THREE.Group(); jaw.position.set(0, 0.07, -0.02); H.add(jaw); m.jaw = jaw;
  { const jp = []; for (let i = 0; i <= 12; i++) { const a = -1.4 + (i / 12) * 2.8, k = Math.cos(a); jp.push(new V3(Math.sin(a) * 0.052, -0.02 - 0.03 * k, 0.03 + 0.055 * k)); } add(jaw, C('c:mand', () => strand(jp, 0.012, 0.012, { seg: 30, rad: 6, flat: 0.55, ref: [0, 1, 0] })), M.bone);
    const tooth = C('c:tooth', () => new THREE.BoxGeometry(0.008, 0.013, 0.006)); for (let i = 0; i < 7; i++) { const a = -0.55 + (i / 6) * 1.1, k = Math.cos(a); add(jaw, tooth, M.bone, [Math.sin(a) * 0.05, -0.027 - 0.03 * k + 0.013, 0.03 + 0.053 * k], [0, a, 0]); add(H, tooth, M.bone, [Math.sin(a) * 0.05, 0.065, 0.03 + 0.06 * k], [0, a, 0]); } }
  // 수염: 턱에서 늘어지는 유령불 다발 (흔들림)
  const beard = new THREE.Group(); jaw.add(beard); const r = rng(5);
  for (let k = 0; k < 9; k++) { const a = -0.9 + (k / 8) * 1.8, x0 = Math.sin(a) * 0.05, z0 = 0.03 + Math.cos(a) * 0.05, L = 0.12 + 0.1 * Math.cos(a) ** 2;
    const g = add(beard, C('c:beard' + k, () => strand([[x0, -0.04, z0], [x0 * 1.1, -0.04 - L * 0.5, z0 + 0.01], [x0 * 0.6 + (r() - 0.5) * 0.02, -0.04 - L, z0 - 0.01]], 0.016, 0.002, { seg: 10, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.flame); g.renderOrder = 5; }
  // 삼각모
  const hat = new THREE.Group(); hat.position.set(0, 0.19, -0.005); hat.rotation.x = -0.1; H.add(hat); m.hat = hat;
  const brim = (u, v, p) => { const a = u * TAU, rr = 0.075 + 0.16 * v, up = 0.11 * v * v * (0.5 + 0.5 * Math.cos(3 * a)); p.set(Math.sin(a) * rr * 1.08, up, Math.cos(a) * rr * 0.92); };
  add(hat, C('c:brim', () => surf(brim, 72, 8)), M.hat);
  { const e = []; for (let i = 0; i < 72; i++) { const p = new V3(); brim(i / 72, 1, p); e.push(p); } rim(hat, 'c:brimR', e, 0.008, true, M.gold); }
  add(hat, C('c:crown', () => lathe([[0.085, 0], [0.088, 0.05], [0.08, 0.095], [0.055, 0.12], [0, 0.126]], 28)), M.hat);
  add(hat, C('c:band', () => new THREE.CylinderGeometry(0.087, 0.088, 0.02, 28, 1, true)), M.gold, [0, 0.015, 0]);
  { const fr = brim(0.0, 1, new V3()); } // (앞 귀퉁이는 u = 0)
  // 해골 문장 (앞 챙 위)
  { const g = new THREE.Group(); g.position.set(0, 0.07, 0.2); g.rotation.x = -0.55; hat.add(g); add(g, C('c:emb', () => new THREE.SphereGeometry(0.018, 10, 8)), M.white, [0, 0.008, 0], [0, 0, 0], [1, 1, 0.5]);
    for (const s of [-1, 1]) add(g, C('c:embX', () => new THREE.CylinderGeometry(0.004, 0.004, 0.06, 5)), M.white, [0, -0.01, -0.004], [0, 0, s * 0.8]); }
  add(hat, C('c:plume', () => strand([[0.07, 0.04, -0.05], [0.16, 0.12, -0.1], [0.2, 0.2, -0.22], [0.15, 0.2, -0.34], [0.08, 0.14, -0.38]], 0.04, 0.006, { seg: 20, rad: 6, flat: 0.25, ref: [0.2, 1, 0] })), M.white);
  /* 팔: 코트 소매 · 금 커프스 · 견장 · 유령 손 */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('c:epa', () => { const g = new THREE.SphereGeometry(0.075, 16, 10, 0, TAU, 0, Math.PI / 2); g.scale(1.15, 0.45, 1); return g; }), M.gold, [s * 0.015, 0.03, 0]);
    for (let k = 0; k < 9; k++) { const a = (s > 0 ? -0.6 : Math.PI - 1.6) + k * 0.28; add(sh, C('c:fringe', () => strand([[0, 0, 0], [0, -0.03, 0.002], [0, -0.06, 0]], 0.0045, 0.004, { seg: 5, rad: 4 })), M.gold, [s * 0.015 + Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.07]); }
    add(sh, C('c:slv', () => loft((v) => ({ y: 0.02 - (D.uArm + 0.02) * v, rx: 0.056 - 0.005 * v, rz: 0.054 - 0.005 * v }), 20, 6)), M.coat);
    add(el, C('c:fslv', () => loft((v) => ({ y: 0.02 - 0.16 * v, rx: 0.052 + 0.004 * v, rz: 0.05 + 0.004 * v }), 18, 4)), M.coat);
    const cuf = (v) => ({ y: -0.14 - 0.1 * v, rx: 0.06 + 0.014 * v, rz: 0.058 + 0.014 * v });
    add(el, C('c:cuff', () => loft(cuf, 20, 3)), M.gold); lRim(el, 'c:cuffR', cuf, 1, 0.005, M.lining);
    add(el, C('c:wrist', () => loft((v) => ({ y: -0.16 - 0.11 * v, rx: 0.02, rz: 0.018 }), 10, 3)), M.hand);
    const hg = new THREE.Group(); ha.add(hg);
    add(hg, C('c:palm' + s, () => loft((v) => ({ y: -0.005 - 0.06 * v, rx: 0.018, rz: 0.03, n: 3, cx: s * 0.006 }), 12, 4)), M.hand);
    for (let k = 0; k < 4; k++) { const z = 0.022 - k * 0.014, curl = 2.4, pts = []; for (let i = 0; i <= 6; i++) { const th = -0.5 - (i / 6) * curl; pts.push(new V3(s * 0.004 + s * Math.cos(th) * 0.03, -0.05 + Math.sin(th) * 0.032, z)); } add(hg, C(`c:fing${s}${k}`, () => strand(pts, 0.006, 0.004, { seg: 10, rad: 5 })), M.hand); }
  }
  /* 아래: 소용돌이 유령 꼬리 (다리 대신) */
  const tail = []; let par = new THREE.Group(); par.position.set(0, -0.06, 0); J.hips.add(par);
  const segN = 6;
  for (let i = 0; i < segN; i++) { const e = (x) => 0.2 * (1 - x) ** 1.6 + 0.012, r0 = e(i / segN), r1 = e((i + 1) / segN), L = 0.17;
    add(par, C('c:tail' + i, () => loft((v) => ({ y: -L * v - 0.01, rx: r0 + (r1 - r0) * v, rz: (r0 + (r1 - r0) * v) * 0.9 }), 20, 4, { uvU: 1, uvV: 0.17, mod: (p, u, v) => { const k = 1 + 0.08 * Math.sin(u * TAU * 5 + i * 2 + v * 3); p.x *= k; p.z *= k; } })), M.ghost);
    const g = new THREE.Group(); g.position.y = -L; par.add(g); tail.push(g); par = g; }
  add(par, C('c:tailEnd', () => { const g = new THREE.ConeGeometry(0.03, 0.14, 10, 1, true); g.rotateX(Math.PI); g.translate(0, -0.07, 0); return g; }), M.ghost);
  /* 무기: 유령 커틀러스 */
  const W = J.weapon;
  add(W, C('c:grip', () => new THREE.CylinderGeometry(0.016, 0.018, 0.13, 10).rotateX(Math.PI / 2)), M.leather);
  add(W, C('c:basket', () => { const g = new THREE.SphereGeometry(0.06, 14, 10, 0, Math.PI, 0, Math.PI * 0.7); g.rotateX(-Math.PI / 2); return g; }), M.gold, [0, -0.01, 0.075], [0, 0, Math.PI / 2]);
  add(W, C('c:pom', () => new THREE.SphereGeometry(0.02, 10, 8)), M.gold, [0, 0, -0.07]);
  add(W, C('c:blade', () => surf((u, v, p) => { const z = 0.09 + 0.88 * v, cy = 0.11 * v * v, w = 0.036 * (1 - 0.6 * smooth(0.72, 1, v)) + 0.004, t = u * TAU; p.set(Math.sin(t) * 0.004 * (1 - v * 0.5), cy + (Math.cos(t) > 0 ? Math.cos(t) * w : Math.cos(t) * 0.007), z); }, 10, 28, { closedU: true })), M.blade);
  const bg = add(W, C('c:bladeG', () => surf((u, v, p) => { const z = 0.09 + 0.88 * v, cy = 0.11 * v * v, w = 0.06, t = u * TAU; p.set(Math.sin(t) * 0.012, cy + Math.cos(t) * w * (1 - v * 0.6), z); }, 10, 16, { closedU: true })), M.flame); bg.renderOrder = 5;
  /* 왼손 사슬 + 닻 */
  const anchor = new THREE.Group();
  { const s = 1;
    add(anchor, C('c:shank', () => new THREE.CylinderGeometry(0.02, 0.024, 0.42, 10)), M.iron, [0, -0.21, 0]);
    add(anchor, C('c:ring', () => new THREE.TorusGeometry(0.04, 0.01, 8, 16)), M.iron, [0, 0.02, 0]);
    add(anchor, C('c:stock', () => new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8).rotateZ(Math.PI / 2)), M.rust, [0, -0.05, 0], [0, Math.PI / 2, 0]);
    add(anchor, C('c:arms', () => strand([[-0.2, -0.24, 0], [-0.17, -0.37, 0], [-0.08, -0.44, 0], [0, -0.45, 0], [0.08, -0.44, 0], [0.17, -0.37, 0], [0.2, -0.24, 0]], 0.022, 0.022, { seg: 30, rad: 8 })), M.iron);
    for (const x of [-1, 1]) add(anchor, C('c:fluke' + x, () => { const g = new THREE.ConeGeometry(0.05, 0.12, 4); g.scale(1, 1, 0.35); return g; }), M.rust, [x * 0.21, -0.2, 0], [0, 0, -x * 0.35]); }
  anchor.scale.setScalar(scale * 0.95);
  const link = C('c:link', () => { const g = new THREE.TorusGeometry(0.02 * scale, 0.006 * scale, 6, 12); g.scale(0.7, 1.3, 1); return g; });
  const chain = m.addRope({ n: 13, seg: 0.075, joint: J.handL, local: new V3(0, -0.07, 0.02), rest: new V3(0, -1, 0.2), chain: true, linkGeo: link, mat: M.iron, end: anchor, caps: 'none', damp: 0.97, stiff: 0 });
  m.chain = chain; m.anchor = anchor;
  /* 천: 찢긴 코트 자락 (허리 둘레 뒤 · 옆) */
  m.addCloth({ W: 8, H: 10, len: 0.82, mat: M.skirt, anchor: (cl) => { for (let i = 0; i < cl.W; i++) { const u = 0.62 + 0.76 * (i / (cl.W - 1)); J.hips.localToWorld(loftAt((v) => ({ y: 0.0, rx: 0.16, rzF: 0.12, rzB: 0.135, n: 2.2 }), u, 0, cl.anchors[i])); } }, caps: (f, torso) => [torso] });
  /* 영체화: 0 = 실체 · 1 = 영체 */
  m.ether = 0;
  m.setEther = (k) => { m.ether = k; for (const mt of all) { mt.opacity = mt.userData.op * (1 - 0.82 * k); mt.depthWrite = k < 0.3 && mt.userData.op >= 1; } M.ghost.emissiveIntensity = 0.6 + 1.5 * k; M.hand.emissiveIntensity = 0.8 + 1.5 * k; M.flame.opacity = 0.55 + 0.3 * k; };
  /* 매 프레임 */
  let t = 0;
  m.update = (dt, f) => {
    t += dt; m.sole = -0.42 + Math.sin(t * 1.6) * 0.05;
    for (let i = 0; i < tail.length; i++) { const g = tail[i]; g.rotation.x = -0.16 + Math.sin(t * 1.8 - i * 0.7) * 0.12 - Math.min(0.4, Math.hypot(f.vel.x, f.vel.z) * 0.04) * (i > 0 ? 1 : 0.5); g.rotation.z = Math.sin(t * 1.3 - i * 0.9) * 0.1; }
    beard.rotation.x = Math.sin(t * 3) * 0.08; jaw.rotation.x = f.state === 'act' ? 0.3 + 0.08 * Math.sin(t * 25) : 0.06 + 0.05 * Math.sin(t * 1.1);
    eyes.forEach((e, i) => { e.scale.set(1, 0.9 + 0.3 * Math.sin(t * 13 + i * 2), 1); });
    m.stepPhys(dt, f);
    // 유령불 입자
    if (f.root.visible && Math.random() < dt * 16) { const p = tail[tail.length - 1].getWorldPosition(new V3()); f.G.fx.p(p.add(new V3(rand2(), 0, rand2())), { vel: [0, 0.6, 0], size: 0.12, size1: 0.02, life: 0.7, color: acc, alpha: 0.6, drag: 1 }); }
  };
  const rand2 = () => (Math.random() - 0.5) * 0.3;
  m.sole = -0.42;
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0.1, 0.95));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.12)); W.localToWorld(tt.set(0, 0.1, 0.97)); };
  m.handPos = (out = new V3()) => J.handL.localToWorld(out.set(0, -0.07, 0.02));
  return m;
}
// 떠다니는 자 자세: 다리는 모아 꼬리 속에 (보이지 않음)
export function floatPosesOf(src) {
  const legs = { hipL: [0.05, 0, 0.04], kneeL: [0.1, 0, 0], footL: [0.4, 0, 0], hipR: [0.05, 0, -0.04], kneeR: [0.1, 0, 0], footR: [0.4, 0, 0] };
  const out = {}; for (const k in src) out[k] = { ...src[k], ...(k === 'down' ? {} : legs) }; out.crouch = { ...src.base, ...legs, spine: [0.3, 0, 0] }; return out;
}
