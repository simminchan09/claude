// 평원 오우거 3D 모델: 거대한 배 · 굽은 등의 혹 · 가슴에 파묻힌 작은 머리(아래턱 엄니) · 통나무 같은 팔
// 짚 망토 · 가죽 허리 가리개(털 테두리) · 새끼줄 허리띠 + 매달린 자루 · 끊어진 족쇄 사슬 · 쇠띠 두른 통나무 곤봉
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, cached } from '../../sculpt.js';
import { V3, TAU, UP, cv, tex, T, mottle, clothTex, cardTex, phys, addMesh as add, tube, limb, bulge, creatureHead, clawHand, cards, physKit } from './plains_lib.js';
import { rustTex, barkTex } from './plains_model.js';

const C = (k, fn) => cached('plains:' + k, fn);
export const OGRE_DIMS = { hipH: 0.82, spineL: 0.2, chestL: 0.36, neckL: 0.02, shW: 0.36, uArm: 0.4, lArm: 0.42, hipW: 0.17, thigh: 0.36, shin: 0.38, headTop: 0.14 };
const OGRE_HEAD = creatureHead({ C: new V3(0, 0.07, 0.1), R: [0.125, 0.125, 0.125], jaw: 0.38, back: -0.05, brow: 0.045, browY: 0.2, cheek: 0.02, chin: 0.04, flatTop: 0.2,
  nose: { len: 0.04, w: 0.2, y: -0.1, h: 0.18, hook: 0.1 }, mouth: { y: -0.48, w: 0.6, depth: 0.016, h: 0.04 }, socket: [0.32, 0.06, 0.02], snout: { len: 0.035, y: -0.6, h: 0.3, w: 0.6 } });
function ogreFaceTex(skinT) {
  const W = 1024, H = 512, [c, g] = cv(W, H), P = (az, el) => OGRE_HEAD.P(az, el, W, H); g.drawImage(skinT.map.image, 0, 0, W, H);
  const shade = (az, el, r, col) => { const [x, y] = P(az, el), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const s of [-1, 1]) { shade(s * 0.32, 0.06, 40, 'rgba(20,14,6,0.75)'); shade(s * 0.55, -0.25, 50, 'rgba(150,70,50,0.25)'); }
  g.strokeStyle = '#1a0e06'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i <= 20; i++) { const a = -0.7 + i * 0.07, [x, y] = P(a, -0.47 + 0.08 * a * a); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  // 일자 눈썹 (짙은 털)
  g.strokeStyle = 'rgba(30,20,10,0.9)'; g.lineWidth = 14; g.beginPath(); for (let i = 0; i <= 16; i++) { const a = -0.55 + i * 0.069, [x, y] = P(a, 0.24 - 0.05 * Math.abs(a)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  for (const s of [-1, 1]) { const [x, y] = P(s * 0.1, -0.3); g.fillStyle = '#140a04'; g.beginPath(); g.ellipse(x, y, 9, 6, 0, 0, TAU); g.fill(); }
  // 흉터: 왼뺨을 가로지르는 꿰맨 자국
  const [sx, sy] = P(0.45, 0.0), [ex, ey] = P(0.62, -0.42); g.strokeStyle = 'rgba(120,50,40,0.85)'; g.lineWidth = 4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
  g.strokeStyle = 'rgba(30,20,10,0.9)'; g.lineWidth = 2; for (let k = 1; k < 6; k++) { const x = sx + (ex - sx) * k / 6, y = sy + (ey - sy) * k / 6; g.beginPath(); g.moveTo(x - 7, y - 3); g.lineTo(x + 7, y + 3); g.stroke(); }
  return tex(c);
}
export function buildOgre(pal) {
  const D = OGRE_DIMS, m = physKit(buildHumanoid(D)), J = m.J;
  const skinT = mottle('ogreSkin', { base: '#8c9658', dark: '#646c3c', light: '#b0b47a', scale: 9, spots: 140, warts: 60, seed: 12, rep: [2, 1], bump: 2.6 });
  const hideT = mottle('ogreHide', { base: '#6a4a2c', dark: '#3a2614', light: '#8a6a44', scale: 12, spots: 200, seed: 8, bump: 2,
    paint: (g, W, H, r) => { for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(30,18,8,0.5)'; g.beginPath(); g.ellipse(r() * W, r() * H, 6 + r() * 12, 3 + r() * 6, r() * 3, 0, TAU); g.fill(); } } });
  const M = {
    skin: phys({ map: skinT.map, normalMap: skinT.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xd8e0a0) }),
    face: phys({ map: T('ogreFace', () => ogreFaceTex(skinT)), normalMap: skinT.normal, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color(0xd8e0a0) }),
    hide: phys({ map: hideT.map, normalMap: hideT.normal, roughness: 0.8, side: THREE.DoubleSide }),
    fur: phys({ map: cardTex('ogreFur', { root: '#4a3420', tip: '#8a6a44', n: 140 }), alphaTest: 0.4, roughness: 0.9, side: THREE.DoubleSide }),
    straw: phys({ map: cardTex('straw', { root: '#c8a050', tip: '#e8d088', n: 90, seed: 17 }), alphaTest: 0.35, roughness: 0.85, side: THREE.DoubleSide }),
    rope: phys({ map: clothTex('pl_rope', { bg: '#b89858', grain: 120, rep: [1, 8], paint: (g, W, H) => { for (let y = -32; y < H + 32; y += 16) { g.fillStyle = 'rgba(80,50,20,0.45)'; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 24); g.lineTo(W, y + 30); g.lineTo(0, y + 6); g.fill(); } } }), roughness: 0.9 }),
    tusk: phys({ color: 0xe8dcb8, roughness: 0.45, clearcoat: 0.4 }),
    nail: phys({ color: 0x5a4a30, roughness: 0.4, clearcoat: 0.5 }),
    iron: phys({ map: rustTex().map, normalMap: rustTex().normal, metalness: 0.75, roughness: 0.55 }),
    wood: phys({ map: barkTex().map, normalMap: barkTex().normal, roughness: 0.85 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x302000, emissive: pal.accent, emissiveIntensity: 2.2 }),
    hair: phys({ color: 0x2a1c10, roughness: 0.7 }),
    sack: phys({ map: clothTex('pl_sack', { bg: '#9a8458', weave: true, grain: 160 }), roughness: 0.9 }),
  };
  /* ---------- 몸통: 골반 · 거대한 배 · 가슴 + 등 혹 ---------- */
  add(J.hips, C('o:pelvis', () => loft((v) => ({ y: -0.16 + 0.3 * v, rx: 0.25 + 0.02 * v, rzF: 0.2, rzB: 0.22, n: 2.2 }), 36, 8)), M.skin);
  const bX = spl([[0, 0.27], [0.4, 0.33], [1, 0.32]]), bF = spl([[0, 0.24], [0.4, 0.33], [0.8, 0.28], [1, 0.25]]);
  add(J.spine, C('o:belly', () => loft((v) => ({ y: -0.06 + 0.34 * v, rx: bX(v), rzF: bF(v), rzB: 0.22, cz: 0.04 * Math.sin(v * Math.PI), n: 2.05 }), 40, 14, { mod: bulge([[0.5, 0.42, -0.025, 0.03, 0.04]]) })), M.skin);
  const cX = spl([[0, 0.32], [0.35, 0.38], [0.65, 0.43], [0.85, 0.38], [1, 0.16]]), cF = spl([[0, 0.26], [0.5, 0.27], [0.85, 0.18], [1, 0.1]]), cB = spl([[0, 0.25], [0.5, 0.3], [0.8, 0.31], [1, 0.14]]);
  const chMod = (p, u, v, c, sn) => { const l = Math.hypot(p.x, p.z) || 1, ax = Math.abs(p.x); let k = 0;
    if (sn > 0) k += 0.04 * gauss(v - 0.55, 0.13) * gauss(ax - 0.17, 0.1) * sn;                  // 처진 가슴 근육
    if (sn < 0) k += 0.06 * gauss(v - 0.75, 0.15) * gauss(ax, 0.2) * -sn;                        // 등 혹
    k += 0.04 * gauss(v - 0.92, 0.08) * gauss(ax - 0.17, 0.08);                                   // 승모근
    p.x += (p.x / l) * k; p.z += (p.z / l) * k; };
  add(J.chest, C('o:chest', () => loft((v) => ({ y: -0.02 + 0.52 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), cz: -0.03 * v, n: 2.1 }), 48, 20, { mod: chMod })), M.skin);
  // 짚 망토: 어깨를 덮은 짚 다발 (털 카드)
  { const pp = (v) => ({ y: 0.46 - 0.2 * v, rx: 0.3 + 0.16 * v, rzF: 0.17 + 0.1 * v, rzB: 0.3 + 0.08 * v });
    J.chest.add(cards(C, 'o:straw', M.straw, 220, (r) => { const u = r(), v = r() * 0.9, p = loftAt(pp, u, v, new V3()), n = new V3(p.x, 0.5, p.z).normalize(); return { p, n, flow: new V3(p.x * 0.3, -1, p.z * 0.3), w: 0.05 + r() * 0.03, l: 0.18 + r() * 0.12 }; }, { bend: 0.15, lift: 0.02 }));
    add(J.chest, C('o:strawRope', () => tube(loftRing(pp, 0.05, { n: 40 }).map((q) => q.multiplyScalar(1.04)), 0.018, 0.018, { closed: true, seg: 80 })), M.rope); }
  /* ---------- 허리: 새끼줄 띠 · 가죽 가리개 + 털 테두리 · 자루 ---------- */
  const beltP = () => ({ y: 0.0, rx: 0.285, rzF: 0.245, rzB: 0.245, n: 2.2 });
  add(J.hips, C('o:belt', () => tube(loftRing(beltP, 0.5, { n: 40 }), 0.03, 0.03, { closed: true, seg: 80 })), M.rope);
  for (const [z0, k, w, L] of [[0.22, 1, 0.2, 0.42], [-0.22, -1, 0.24, 0.46]]) {
    const g = new THREE.Group(); g.position.set(0, -0.02, z0); J.hips.add(g); m[k > 0 ? 'flapF' : 'flapB'] = g;
    const fl = (u, v, p) => { const ww = w * (1 + 0.15 * v), x = (u - 0.5) * 2 * ww, rag = 0.04 * Math.sin(u * 17) * smooth(0.8, 1, v); p.set(x, -L * v - rag, k * (0.02 + 0.02 * v - 0.12 * (x / w) ** 2)); };
    add(g, C('o:flap' + k, () => surf(fl, 10, 8)), M.hide);
    g.add(cards(C, 'o:flapFur' + k, M.fur, 40, (r) => { const u = r(), p = new V3(); fl(u, 0.02, p); return { p, n: new V3(0, 0.3, k).normalize(), flow: new V3(0, -1, 0), w: 0.06 + r() * 0.03, l: 0.08 + r() * 0.05 }; }, { lift: 0.01 }));
  }
  m.addRope(J.hips, new V3(0.2, -0.02, 0.17), 4, 0.07, M.rope, () => 0.012, { rest: new V3(0.2, -1, 0.3), caps: 'legs', end: (() => { const g = new THREE.Group(); add(g, C('o:sack', () => lathe([[0.001, 0.0], [0.04, -0.02], [0.08, -0.09], [0.075, -0.16], [0.04, -0.2], [0, -0.205]], 14)), M.sack, [0, 0, 0], [Math.PI, 0, 0]); add(g, C('o:sackTie', () => new THREE.TorusGeometry(0.02, 0.008, 6, 12)), M.rope, [0, 0.01, 0], [Math.PI / 2, 0, 0]); return g; })() });
  /* ---------- 팔: 통나무 팔 · 큰 주먹 · 왼손목 족쇄 + 끊어진 사슬 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('o:delt', () => new THREE.SphereGeometry(0.16, 20, 14)), M.skin, [s * 0.01, 0.0, 0], [0, 0, 0], [1.05, 1, 1.05]);
    add(sh, C('o:uarm', () => limb(D.uArm, [[0, 0.135], [0.4, 0.14], [0.8, 0.11], [1, 0.1]], [[0, 0.13], [0.4, 0.135], [1, 0.1]], { mod: bulge([[0.5, 0.42, 0.03, 0.14, 0.2], [0, 0.4, 0.02, 0.14, 0.25]]), nu: 24 })), M.skin);
    add(el, C('o:elb', () => new THREE.SphereGeometry(0.1, 14, 10)), M.skin);
    add(el, C('o:farm', () => limb(D.lArm, [[0, 0.11], [0.35, 0.14], [0.85, 0.11], [1, 0.1]], [[0, 0.105], [0.35, 0.13], [1, 0.09]], { mod: bulge([[0.25, 0.3, 0.015], [0.75, 0.3, 0.015]]), nu: 24 })), M.skin);
    const hg = clawHand(C, 'o:hand', { s, n: 4, len: 0.13, r: 0.027, curl: 1.9, claw: 0.025, palm: [0.075, 0.1, 0.045], mat: M.skin, clawMat: M.nail }); hg.position.y = -0.01; ha.add(hg);
    if (s > 0) { add(el, C('o:cuff', () => new THREE.CylinderGeometry(0.115, 0.115, 0.08, 16, 1, true)), M.iron, [0, -D.lArm + 0.06, 0]);
      for (const y of [-0.04, 0.04]) add(el, C('o:cuffR', () => new THREE.TorusGeometry(0.115, 0.01, 6, 20)), M.iron, [0, -D.lArm + 0.06 + y, 0], [Math.PI / 2, 0, 0]);
      m.addRope(el, new V3(0.1, -D.lArm + 0.06, 0), 6, 0.06, M.iron, (v) => 0.014 * (1 + 0.6 * Math.abs(Math.sin(v * 40))), { rest: new V3(0.2, -1, 0), stiff: 0.05 }); }
  }
  /* ---------- 다리: 짧고 굵다 · 가죽으로 싼 발 ---------- */
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, C('o:thigh', () => limb(D.thigh, [[0, 0.17], [0.5, 0.16], [1, 0.12]], [[0, 0.17], [0.5, 0.155], [1, 0.12]], { mod: bulge([[0.5, 0.4, 0.02]]), nu: 24 })), M.skin);
    add(kn, C('o:knee', () => new THREE.SphereGeometry(0.11, 14, 10)), M.skin, [0, 0, 0.02]);
    add(kn, C('o:shin', () => limb(D.shin, [[0, 0.12], [0.3, 0.135], [1, 0.1]], [[0, 0.12], [0.3, 0.15], [1, 0.1]], { cz: [[0, 0], [0.3, -0.02], [1, 0]], nu: 24 })), M.skin);
    add(kn, C('o:legwrap', () => loft((v) => ({ y: -D.shin * (0.55 + 0.45 * v), rx: 0.11 + 0.006 * Math.sin(v * 25), rz: 0.11 + 0.006 * Math.sin(v * 25) }), 18, 12)), M.hide);
    const fw = spl([[0, 0.0], [0.08, 0.08], [0.5, 0.1], [0.85, 0.1], [1, 0.07]]), fh = spl([[0, 0.04], [0.12, 0.1], [0.5, 0.08], [0.9, 0.05], [1, 0.03]]);
    add(ft, C('o:foot', () => surf((u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.8; p.set(Math.sign(c) * Math.abs(c) ** e * w, -0.07 + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.09 + 0.3 * v); }, 22, 14, { closedU: true })), M.hide);
    for (let k = 0; k < 4; k++) add(ft, C('o:toe', () => { const g = new THREE.SphereGeometry(0.03, 10, 8); g.scale(1, 0.8, 1.2); return g; }), M.skin, [(k - 1.5) * 0.045, -0.055, 0.21]);
  }
  /* ---------- 머리: 작은 머리 · 일자 눈썹 · 깊은 눈 · 큰 엄니 · 머리 다발 ---------- */
  const H = J.head, HD = OGRE_HEAD; H.scale.setScalar(1.15);
  add(H, C('o:head', () => HD.geo(64, 48)), M.face);
  for (const s of [-1, 1]) {
    add(H, C('o:eye', () => new THREE.SphereGeometry(0.014, 10, 8)), M.eye, HD.at(s * 0.32, 0.06, -0.016).toArray());
    const tq = HD.at(s * 0.3, -0.52, -0.01), tk = add(H, C('o:tusk', () => { const pts = []; for (let i = 0; i <= 8; i++) { const v = i / 8; pts.push(new V3(0, 0.07 * v, 0.02 * v * v)); } return strand(pts, 0.016, 0.003, { seg: 12, rad: 8 }); }), M.tusk, tq.toArray()); tk.rotation.set(0.1, 0, -s * 0.25);
    const ear = add(H, C('o:ear', () => { const g = new THREE.SphereGeometry(0.04, 12, 8); g.scale(0.4, 1, 0.8); return g; }), M.skin, HD.at(s * 1.5, 0.05, -0.01).toArray()); ear.rotation.z = s * 0.3;
  }
  H.add(cards(C, 'o:hairTuft', M.fur, 50, (r) => { const az = Math.PI + (r() - 0.5) * 2.4, el = 0.4 + r() * 0.9, p = HD.at(az, el), n = p.clone().sub(HD.C).normalize(); return { p, n, flow: new V3(0, -0.6, -1), w: 0.04 + r() * 0.02, l: 0.07 + r() * 0.05 }; }, { lift: 0.003 }));
  m.addRope(H, HD.at(Math.PI, 0.6, 0.02), 4, 0.06, M.hair, (v) => 0.02 * (1 - 0.6 * v), { rest: new V3(0, -0.5, -1), stiff: 0.25 });
  /* ---------- 곤봉: 쇠띠 두른 통나무 + 쇠 가시 ---------- */
  const W = J.weapon, len = 1.35;
  add(W, C('o:club', () => { const g = lathe([[0.0, -0.12], [0.05, -0.11], [0.055, 0.2], [0.07, 0.5], [0.11, 0.85], [0.15, 1.15], [0.16, 1.28], [0.1, 1.35], [0, 1.37]], 18); g.rotateX(Math.PI / 2); return g; }), M.wood);
  add(W, C('o:grip', () => { const g = loft((v) => ({ y: -0.08 + 0.3 * v, rx: 0.058 + 0.004 * Math.sin(v * 50), rz: 0.058 + 0.004 * Math.sin(v * 50) }), 12, 24); g.rotateX(Math.PI / 2); return g; }), M.hide);
  for (const [z, r] of [[0.85, 0.115], [1.12, 0.152]]) add(W, C('o:band' + z, () => new THREE.CylinderGeometry(r, r, 0.06, 20, 1, true)), M.iron, [0, 0, z], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 14; i++) { const a = i * 2.4, z = 0.9 + (i % 5) * 0.08, r = 0.11 + (z - 0.85) * 0.17, sp = add(W, C('o:cspike', () => { const g = new THREE.ConeGeometry(0.018, 0.08, 6); g.translate(0, 0.04, 0); return g; }), M.iron, [Math.cos(a) * r, Math.sin(a) * r, z]); sp.quaternion.setFromUnitVectors(UP, new V3(Math.cos(a), Math.sin(a), 0.2).normalize()); }
  const lag = { L: 0, vL: 0 };
  m.update = (dt, f) => {
    lag.vL += ((Math.min(J.hipL.rotation.x, J.hipR.rotation.x) - lag.L) * 100 - lag.vL * 12) * dt; lag.L += lag.vL * dt;
    m.flapF.rotation.x = Math.min(0, lag.L) * 0.7; m.flapB.rotation.x = Math.max(0, Math.max(J.hipL.rotation.x, J.hipR.rotation.x)) * 0.5;
    M.eye.emissiveIntensity = 1.8 + (f.state === 'act' ? 1.2 : 0);
    const cp = m.bodyCaps(f, 0.16); m.stepRopes(dt, f, cp.body, cp.legs);
  };
  m.sole = 0.07;
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0, len));
  m.weaponPts = (b, t) => { W.localToWorld(b.set(0, 0, 0.3)); W.localToWorld(t.set(0, 0, len)); };
  return m;
}
