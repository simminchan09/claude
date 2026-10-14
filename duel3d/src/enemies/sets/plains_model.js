// 바람의 평원 몬스터 3D 모델: 고블린(약탈자 · 투석병) · 평원 오우거 · 폭풍 켄타우로스 갈레
import * as THREE from 'three';
import { buildHumanoid, JI } from '../../rig.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, cached } from '../../sculpt.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../../face.js';
import { V3, TAU, UP, cv, tex, rng, T, mottle, scaleTex, clothTex, cardTex, phys, glowMat, addMesh as add, tube, beads, limb, bulge, creatureHead, clawHand, cards, physKit, ik2 } from './plains_lib.js';

const C = (k, fn) => cached('plains:' + k, fn);

/* =====================================================================
   공용 재질
   ===================================================================== */
function leatherTex(key, bg, stitch) { return clothTex('pl_leather' + key, { bg, grain: 420, stitch, stitchY: [10, 246], paint: (g, W, H, r) => { for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * W, y = r() * H; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y + (r() - 0.5) * 30, x + 40 + r() * 30, y + (r() - 0.5) * 20); g.stroke(); } } }); }
export function rustTex() { return mottle('pl_rust', { base: '#8a8480', dark: '#5a3a28', light: '#b8b0a8', scale: 9, spots: 160, seed: 21, bump: 3,
  paint: (g, W, H, r) => { for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${140 + r() * 60 | 0},${60 + r() * 30 | 0},20,${0.25 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * W, r() * H, 4 + r() * 18, 3 + r() * 10, r() * 3, 0, TAU); g.fill(); } } }); }
export function barkTex() { return mottle('pl_bark', { base: '#7a6044', dark: '#4a3420', light: '#9a8264', scale: 5, seed: 33, bump: 4, h: 512, rep: [2, 1],
  paint: (g, W, H, r, hg) => { for (let i = 0; i < 70; i++) { const x = r() * W, w = 1 + r() * 3; for (const [cg, col] of [[g, 'rgba(20,12,6,0.7)'], [hg, 'rgba(0,0,0,0.9)']]) { cg.strokeStyle = col; cg.lineWidth = w; cg.beginPath(); let xx = x; cg.moveTo(xx, 0); for (let y = 0; y < H; y += 16) { xx += (r() - 0.5) * 6; cg.lineTo(xx, y); } cg.stroke(); } } } }); }

/* =====================================================================
   고블린: 큰 머리 · 매부리코 · 긴 귀 · 마른 몸 · 툭 튀어나온 배 · 긴 팔 · 세 발가락 큰 발
   o.kind = 'raider'(식칼 · 어깨 가죽 갑옷 · 상투) | 'slinger'(두건 · 투석끈 · 돌 주머니 · 깃털)
   ===================================================================== */
export const GOB_DIMS = { hipH: 0.8, spineL: 0.19, chestL: 0.24, neckL: 0.07, shW: 0.16, uArm: 0.26, lArm: 0.25, hipW: 0.085, thigh: 0.36, shin: 0.37, headTop: 0.32 };
const GOB_HEAD = creatureHead({ C: new V3(0, 0.075, 0.03), R: [0.1, 0.105, 0.112], back: 0.3, jaw: 0.12, temple: 0.05, brow: 0.028, browY: 0.22, cheek: 0.018, chin: 0.012,
  nose: { len: 0.085, w: 0.085, y: -0.08, h: 0.2, hook: 0.35 }, mouth: { y: -0.5, w: 0.42, depth: 0.012, h: 0.04 }, socket: [0.36, 0.08, 0.012], snout: { len: 0.02, y: -0.45, h: 0.3, w: 0.5 } });
function gobFaceTex(skin, paintCol) {
  const W = 1024, H = 512, [c, g] = cv(W, H), S = skin, P = (az, el) => GOB_HEAD.P(az, el, W, H);
  // 바탕: 얼룩 피부 텍스처를 그대로 깔고 그 위에 이목구비 음영을 그린다
  g.drawImage(S.map.image, 0, 0, W, H);
  const shade = (az, el, rx, ry, col) => { const [x, y] = P(az, el), gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, TAU); g.fill(); g.restore(); };
  for (const s of [-1, 1]) { shade(s * 0.36, 0.1, 46, 30, 'rgba(30,20,10,0.65)'); shade(s * 0.2, -0.28, 30, 22, 'rgba(40,24,10,0.35)'); shade(s * 0.5, -0.3, 40, 26, 'rgba(160,60,40,0.18)'); }
  // 입: 넓게 찢어진 입선 · 아랫입술
  g.strokeStyle = '#1a0c06'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i <= 20; i++) { const a = -0.62 + i * 0.062, [x, y] = P(a, -0.5 + 0.05 * Math.abs(a) ** 1.6 * 4 - 0.03 * Math.cos(a * 3)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.strokeStyle = 'rgba(90,40,30,0.5)'; g.lineWidth = 8; g.beginPath(); for (let i = 0; i <= 12; i++) { const a = -0.4 + i * 0.066, [x, y] = P(a, -0.57); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  // 콧구멍 · 주름
  for (const s of [-1, 1]) { const [x, y] = P(s * 0.08, -0.3); g.fillStyle = '#1a0e06'; g.beginPath(); g.ellipse(x, y, 5, 3, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(30,18,8,0.55)'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { const [a1, b1] = P(s * (0.52 + k * 0.05), 0.12 + k * 0.03), [a2, b2] = P(s * (0.62 + k * 0.05), 0.05 + k * 0.04); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
    const [bx, by] = P(s * 0.3, 0.27); g.beginPath(); g.moveTo(bx - s * 30, by + 6); g.quadraticCurveTo(bx, by - 8, bx + s * 26, by + 10); g.lineWidth = 3; g.stroke(); }
  // 전투 칠: 눈을 가로지르는 줄 · 턱 점
  if (paintCol) { g.fillStyle = paintCol; for (const s of [-1, 1]) { g.beginPath(); const [x0, y0] = P(s * 0.12, 0.17), [x1, y1] = P(s * 0.75, 0.05), [x2, y2] = P(s * 0.72, -0.05), [x3, y3] = P(s * 0.15, 0.07); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.globalAlpha = 0.75; g.fill(); g.globalAlpha = 1; }
    for (let k = 0; k < 3; k++) { const [x, y] = P((k - 1) * 0.12, -0.72); g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); } }
  return tex(c);
}
export function buildGoblin(pal, o = {}) {
  const slinger = o.kind === 'slinger', D = GOB_DIMS, m = physKit(buildHumanoid(D)), J = m.J;
  const skinT = mottle('gobSkin', { base: '#71883e', dark: '#62783a', light: '#869a52', scale: 16, spots: 60, warts: 30, seed: 4, rep: [2, 1] });
  const M = {
    skin: phys({ map: skinT.map, normalMap: skinT.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.62, sheen: 0.4, sheenColor: new THREE.Color(0xc8e090) }),
    face: phys({ map: T('gobFace' + (slinger ? 'S' : 'R'), () => gobFaceTex(skinT, slinger ? null : 'rgba(170,30,20,1)')), normalMap: skinT.normal, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color(0xc8e090) }),
    ear: phys({ map: skinT.map, color: 0xffd8c0, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffb090), side: THREE.DoubleSide }),
    leather: phys({ map: leatherTex(slinger ? 'S' : 'R', slinger ? '#5a3c22' : '#4a2c1a', 'rgba(220,190,140,0.7)'), roughness: 0.7, side: THREE.DoubleSide }),
    leatherD: phys({ map: leatherTex('D', '#2e1c10', 'rgba(150,120,80,0.6)'), roughness: 0.65, side: THREE.DoubleSide }),
    linen: phys({ map: clothTex('pl_linen' + (slinger ? 'S' : ''), { bg: slinger ? '#7a6a3a' : '#8a7a5a', weave: true, grain: 200, paint: (g, W, H, r) => { for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(60,40,20,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * W, r() * H, 10 + r() * 30, 6 + r() * 14, r() * 3, 0, TAU); g.fill(); } } }), roughness: 0.85, side: THREE.DoubleSide }),
    bone: phys({ color: 0xe8dcc0, roughness: 0.5, clearcoat: 0.3 }),
    tooth: phys({ color: 0xf0e4c4, roughness: 0.35, clearcoat: 0.6 }),
    claw: phys({ color: 0x2a2018, roughness: 0.3, clearcoat: 0.8 }),
    hair: phys({ color: 0x1a1410, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0x6a5a4a) }),
    iron: phys({ map: rustTex().map, normalMap: rustTex().normal, color: 0xffffff, metalness: 0.45, roughness: 0.5 }),
    gold: phys({ color: 0xd8a848, metalness: 1, roughness: 0.3 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x302000, emissive: pal.accent, emissiveIntensity: 1.6, roughness: 0.2 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x080400 }),
    wood: phys({ map: barkTex().map, roughness: 0.8 }),
    feather: phys({ map: cardTex('pl_feather', { feather: true, root: '#f0e8d8', tip: '#c83a1a' }), alphaTest: 0.4, roughness: 0.7, side: THREE.DoubleSide }),
  };
  /* ---------- 골반 · 배 · 가슴 (마른 갈비 · 튀어나온 배 · 굽은 등) ---------- */
  add(J.hips, C('g:pelvis', () => loft((v) => ({ y: -0.1 + 0.19 * v, rx: 0.105 - 0.01 * v, rzF: 0.08, rzB: 0.09, n: 2.2 }), 28, 6)), M.skin);
  const bX = spl([[0, 0.095], [0.45, 0.108], [1, 0.1]]), bF = spl([[0, 0.085], [0.45, 0.112], [1, 0.08]]);
  add(J.spine, C('g:belly', () => loft((v) => ({ y: -0.04 + 0.25 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.1 }), 32, 10, { mod: bulge([[0.5, 0.15, -0.006, 0.05, 0.05]]) })), M.skin);
  const cX = spl([[0, 0.11], [0.35, 0.14], [0.7, 0.155], [0.88, 0.135], [1, 0.055]]), cF = spl([[0, 0.078], [0.5, 0.09], [0.85, 0.07], [1, 0.04]]), cB = spl([[0, 0.08], [0.5, 0.1], [0.85, 0.095], [1, 0.045]]);
  const chP = (v) => ({ y: -0.02 + 0.3 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), n: 2.15 });
  // 갈비뼈 줄 · 쇄골 · 날개뼈 (mod)
  const chMod = (p, u, v, c, sn) => { const l = Math.hypot(p.x, p.z) || 1; let k = 0;
    if (sn > 0.2) k += 0.004 * Math.max(0, Math.sin(v * 26)) * smooth(0.1, 0.3, v) * (1 - smooth(0.5, 0.65, v)) * smooth(0.02, 0.06, Math.abs(p.x));
    k += 0.01 * gauss(v - 0.84, 0.05) * sn * smooth(0.02, 0.07, Math.abs(p.x)); if (sn < 0) k += 0.012 * gauss(v - 0.62, 0.12) * gauss(Math.abs(p.x) - 0.06, 0.03);
    p.x += (p.x / l) * k; p.z += (p.z / l) * k; };
  add(J.chest, C('g:chest', () => loft(chP, 40, 18, { mod: chMod })), M.skin);
  add(J.neck, C('g:neck', () => limb(0.12, [[0, 0.055], [1, 0.045]], [[0, 0.055], [1, 0.045]], { y0: 0.02, y1: -0.13, nu: 14, nv: 4 })), M.skin).rotation.x = Math.PI;
  // 허리띠 · 뼈 버클 · 앞뒤 가리개 천
  const beltP = (v) => ({ y: -0.035 + 0.04 * v, rx: 0.112, rzF: 0.088, rzB: 0.097, n: 2.2 });
  add(J.hips, C('g:belt', () => loft(beltP, 36, 2)), M.leatherD);
  add(J.hips, C('g:buckle', () => new THREE.TorusGeometry(0.022, 0.007, 6, 14)), M.bone, [0, -0.015, 0.092]);
  for (const [z0, k, w, L] of [[0.09, 1, 0.075, 0.26], [-0.1, -1, 0.09, 0.3]]) {
    const g = new THREE.Group(); g.position.set(0, -0.04, z0); J.hips.add(g); m[k > 0 ? 'flapF' : 'flapB'] = g;
    add(g, C('g:flap' + k, () => surf((u, v, p) => { const ww = w * (1 - 0.25 * v) * (1 + 0.1 * Math.sin(u * 9 + v * 4)), x = (u - 0.5) * 2 * ww, rag = v > 0.85 ? 0.03 * Math.sin(u * 23) : 0; p.set(x, -L * v - rag, k * (0.012 - 0.05 * (x / w) ** 2 * 0.5 + 0.01 * v)); }, 8, 8)), M.linen);
  }
  // 엉덩이 옆 작은 뼈 장식 (해골 + 끈)
  { const g = new THREE.Group(); g.position.set(0.11, -0.05, 0.03); J.hips.add(g);
    add(g, C('g:skull', () => surf((u, v, p) => { const [cc, ss] = ang(u), el = -Math.PI / 2 + v * Math.PI, rr = 0.026; p.set(cc * Math.cos(el) * rr, Math.sin(el) * rr * 1.1 - 0.035, ss * Math.cos(el) * rr * (ss > 0 ? 1.15 : 1)); }, 14, 10)), M.bone);
    for (const s of [-1, 1]) add(g, C('g:skEye', () => new THREE.SphereGeometry(0.006, 6, 5)), M.pupil, [s * 0.009, -0.03, 0.026]);
    add(g, C('g:skCord', () => tube([[0, 0.02, 0], [0.002, -0.005, 0.002], [0, -0.012, 0.002]], 0.003)), M.leatherD); }
  /* ---------- 팔 (마른 근육 · 손목 붕대 · 세 손가락 + 엄지 발톱) ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('g:delt', () => new THREE.SphereGeometry(0.048, 16, 12)), M.skin, [0, -0.005, 0], [0, 0, 0], [1.05, 1, 1]);
    add(sh, C('g:uarm', () => limb(D.uArm, [[0, 0.05], [0.35, 0.048], [0.8, 0.036], [1, 0.034]], [[0, 0.048], [0.4, 0.045], [1, 0.033]], { mod: bulge([[0.5, 0.42, 0.008], [0, 0.35, 0.006]]) })), M.skin);
    add(el, C('g:elb', () => new THREE.SphereGeometry(0.031, 12, 10)), M.skin, [0, 0, -0.006]);
    add(el, C('g:farm', () => limb(D.lArm, [[0, 0.037], [0.3, 0.042], [1, 0.028]], [[0, 0.035], [0.3, 0.038], [1, 0.025]], { mod: bulge([[0.25, 0.3, 0.005], [0.75, 0.3, 0.005]]) })), M.skin);
    const wrapP = (v) => ({ y: -D.lArm * (0.55 + 0.42 * v), rx: 0.029 - 0.004 * v + 0.002 * Math.sin(v * 30), rz: 0.027 - 0.004 * v + 0.002 * Math.sin(v * 30) });
    add(el, C('g:wrap', () => loft(wrapP, 16, 12)), M.linen);
    const hg = clawHand(C, 'g:hand', { s, n: 3, len: 0.07, r: 0.0105, curl: 1.3, claw: 0.026, palm: [0.03, 0.055, 0.017], mat: M.skin, clawMat: M.claw }); hg.position.y = -0.005; ha.add(hg);
  }
  // 어깨 가죽 갑옷 (약탈자: 왼어깨 겹판 + 리벳 + 뼈 가시)
  if (!slinger) {
    for (let k = 0; k < 3; k++) {
      const pp = (v) => ({ y: 0.05 - k * 0.032 - 0.06 * v, rx: 0.058 + 0.01 * k + 0.02 * v, rz: 0.056 + 0.01 * k + 0.018 * v });
      add(J.shoulderL, C('g:pld' + k, () => loft(pp, 20, 4, { a0: 0.02, a1: 0.48 })), M.leather, [0.01, 0, 0]);
      for (let i = 0; i < 4; i++) { const q = loftAt(pp, 0.06 + i * 0.12, 0.85, new V3()); add(J.shoulderL, C('g:rivet', () => new THREE.SphereGeometry(0.005, 6, 5)), M.iron, [q.x * 1.05 + 0.01, q.y, q.z * 1.05]); }
    }
    for (const [dy, dz, rz] of [[0.05, 0.015, 0.45], [0.03, -0.03, 0.8]]) { const sp = add(J.shoulderL, C('g:spike', () => { const g = new THREE.ConeGeometry(0.012, 0.075, 8); g.translate(0, 0.037, 0); return g; }), M.bone, [0.055, dy, dz]); sp.rotation.set(0, 0, -rz); }
    // 뼈 이빨 목걸이
    const neck = []; for (let i = 0; i <= 16; i++) { const a = -Math.PI * 0.85 + (i / 16) * Math.PI * 1.7; neck.push(new V3(Math.sin(a) * 0.075, 0.245 - 0.035 * Math.cos(a), Math.cos(a) * 0.07 + 0.008)); }
    add(J.chest, C('g:neckCord', () => tube(neck, 0.004, 0.004, { seg: 40 })), M.leatherD);
    for (let i = 2; i <= 14; i += 2) { const q = neck[i]; const t = add(J.chest, C('g:tooth', () => { const g = new THREE.ConeGeometry(0.008, 0.035, 6); g.rotateX(Math.PI); g.translate(0, -0.016, 0); return g; }), M.tooth, q.toArray()); t.rotation.set(-0.3, 0, (i - 8) * 0.06); }
  } else {
    // 투석병: 가슴을 가로지르는 가죽끈 + 돌 주머니 (왼 허리)
    const strap = []; for (let i = 0; i <= 20; i++) { const v = i / 20, a = v * TAU; strap.push(new V3(Math.sin(a) * 0.15 * (0.7 + 0.3 * Math.cos(a)), 0.25 - 0.3 * (0.5 - 0.5 * Math.cos(a)) + 0.06 * Math.sin(a), Math.cos(a) * 0.115)); }
    add(J.chest, C('g:strap', () => tube(strap, 0.008, 0.008, { seg: 60, closed: true, flat: 0.35 })), M.leatherD);
    const bag = new THREE.Group(); bag.position.set(0.12, -0.08, 0.02); bag.rotation.z = 0.15; J.hips.add(bag);
    add(bag, C('g:bag', () => lathe([[0.001, 0.02], [0.035, 0.012], [0.05, -0.03], [0.045, -0.07], [0.02, -0.085], [0, -0.087]], 16)), M.leather, [0, 0, 0], [0, 0, 0], [1, 1, 0.8]);
    add(bag, C('g:bagTie', () => new THREE.TorusGeometry(0.026, 0.005, 6, 16)), M.leatherD, [0, 0.012, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) add(bag, C('g:stone' + i, () => { const g = new THREE.DodecahedronGeometry(0.018 + i * 0.003, 1); const ps = g.attributes.position; for (let k = 0; k < ps.count; k++) ps.setXYZ(k, ps.getX(k) * (1 + 0.15 * Math.sin(k * 3.1)), ps.getY(k) * 0.85, ps.getZ(k)); g.computeVertexNormals(); return g; }), M.iron, [(i - 1) * 0.018, 0.022, (i % 2) * 0.01]);
  }
  /* ---------- 다리 (마른 허벅지 · 툭 불거진 무릎 · 정강이 감개 · 세 발가락 큰 발) ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    add(hp, C('g:thigh', () => limb(D.thigh, [[0, 0.07], [0.3, 0.064], [0.85, 0.044], [1, 0.04]], [[0, 0.07], [0.35, 0.062], [1, 0.04]], { mod: bulge([[0.5, 0.3, 0.008], [0.25, 0.35, 0.005], [0.75, 0.35, 0.005]]) })), M.skin);
    add(kn, C('g:knee', () => new THREE.SphereGeometry(0.036, 12, 10)), M.skin, [0, 0, 0.01], [0, 0, 0], [1, 1, 1.05]);
    add(kn, C('g:shin', () => limb(D.shin, [[0, 0.036], [0.3, 0.038], [0.85, 0.024], [1, 0.026]], [[0, 0.036], [0.25, 0.044], [0.8, 0.026], [1, 0.028]], { cz: [[0, 0], [0.3, -0.006], [1, 0]] })), M.skin);
    const wrP = (v) => ({ y: -D.shin * (0.25 + 0.55 * v), rx: 0.037 - 0.01 * v + 0.0025 * Math.sin(v * 34), rz: 0.04 - 0.012 * v + 0.0025 * Math.sin(v * 34) });
    add(kn, C('g:legwrap', () => loft(wrP, 16, 16)), M.linen);
    // 발: 넓은 발등 + 세 발가락 + 검은 발톱
    const fw = spl([[0, 0.0], [0.08, 0.03], [0.4, 0.04], [0.75, 0.05], [1, 0.044]]), fh = spl([[0, 0.02], [0.1, 0.045], [0.4, 0.04], [0.8, 0.022], [1, 0.018]]);
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.8; p.set(Math.sign(c) * Math.abs(c) ** e * w, -0.052 + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.04 + 0.13 * v); };
    add(ft, C('g:foot', () => surf(foot, 20, 14, { closedU: true })), M.skin);
    for (let k = 0; k < 3; k++) { const x = (k - 1) * 0.03, pts = [new V3(x, -0.04, 0.08), new V3(x * 1.2, -0.042, 0.12), new V3(x * 1.35, -0.05, 0.15)];
      add(ft, C('g:toe' + k, () => strand(pts, 0.014, 0.01, { seg: 8, rad: 7 })), M.skin);
      const cl = add(ft, C('g:tclaw', () => { const g = new THREE.ConeGeometry(0.01, 0.03, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.012); return g; }), M.claw, [x * 1.38, -0.052, 0.155]); cl.rotation.x = 0.35; }
  }
  /* ---------- 머리: 매부리코 · 찢어진 입 · 송곳니 · 노란 눈 · 긴 귀 ---------- */
  const H = J.head, HD = GOB_HEAD; H.scale.setScalar(1.18);
  add(H, C('g:head', () => HD.geo(72, 54)), M.face);
  for (const s of [-1, 1]) {
    const e = HD.at(s * 0.36, 0.08, -0.012), eye = add(H, C('g:eye', () => new THREE.SphereGeometry(0.019, 14, 10)), M.eye, e.toArray(), [0, 0, 0], [1, 0.85, 0.8]);
    add(eye, C('g:pupil', () => new THREE.BoxGeometry(0.005, 0.026, 0.006)), M.pupil, [0, 0, 0.018]);
    // 찡그린 눈꺼풀: 눈 위를 덮는 피부 반구 (안쪽으로 기울어 화난 눈매)
    const lid = add(H, C('g:lid', () => new THREE.SphereGeometry(0.023, 14, 8, 0, TAU, 0, Math.PI * 0.42)), M.skin, e.toArray(), [0.55, 0, s * 0.35], [1.05, 1, 1]);
    // 귀: 길고 뾰족 · 뒤로 젖혀짐 · 안쪽 분홍
    const base = HD.at(s * 1.42, 0.12, -0.006), ear = new THREE.Group(); ear.position.copy(base); ear.rotation.set(0.15, s * 0.35, s * 0.25); H.add(ear);
    add(ear, C('g:ear' + s, () => surf((u, v, p) => { const w = 0.05 * Math.sin(Math.PI * Math.min(1, v * 1.25 + 0.05)) ** 0.8 * (1 - v * 0.6), x = (u - 0.5) * 2 * w; p.set(s * (0.2 * v), 0.055 * v + 0.03 * v * v + x * 0.9, -0.02 * v + x * 0.3 - 0.025 * Math.abs(x / 0.05) ** 2 * 0.5); }, 10, 12)), M.ear);
    add(ear, C('g:earRim' + s, () => { const pts = []; for (let i = 0; i <= 12; i++) { const v = i / 12, w = 0.05 * Math.sin(Math.PI * Math.min(1, v * 1.25 + 0.05)) ** 0.8 * (1 - v * 0.6); pts.push(new V3(s * 0.2 * v, 0.055 * v + 0.03 * v * v + w * 0.9, -0.02 * v + w * 0.3)); } return strand(pts, 0.006, 0.002, { seg: 20, rad: 6 }); }), M.skin);
    if (s > 0) for (const t of [0.35, 0.45]) add(ear, C('g:ering', () => new THREE.TorusGeometry(0.01, 0.0022, 6, 14)), M.gold, [s * 0.2 * t, 0.055 * t + 0.03 * t * t + 0.03, -0.004], [0, Math.PI / 2, 0]);
    // 아래 송곳니 (입꼬리에서 위로)
    const fq = HD.at(s * 0.3, -0.5, -0.004); const fang = add(H, C('g:fang', () => { const g = new THREE.ConeGeometry(0.008, 0.032, 7); g.translate(0, 0.016, 0); return g; }), M.tooth, fq.toArray()); fang.rotation.set(0.25, 0, -s * 0.15);
  }
  for (let i = 0; i < 4; i++) { const q = HD.at((i - 1.5) * 0.12, -0.46, -0.006); const t = add(H, C('g:uteeth', () => { const g = new THREE.ConeGeometry(0.005, 0.014, 5); g.rotateX(Math.PI); g.translate(0, -0.006, 0); return g; }), M.tooth, q.toArray()); t.rotation.x = -0.2; }
  if (!slinger) { // 정수리 상투 + 뒤로 늘어진 머리채 (로프)
    add(H, C('g:knot', () => { const g = new THREE.SphereGeometry(0.03, 12, 10); g.scale(1, 1.25, 1); return g; }), M.hair, HD.at(0, 1.25, 0.012).toArray());
    add(H, C('g:knotTie', () => new THREE.TorusGeometry(0.02, 0.005, 6, 14)), M.gold, HD.at(0, 1.18, 0.012).toArray(), [Math.PI / 2 - 0.5, 0, 0]);
    for (let k = 0; k < 7; k++) { const az = Math.PI + (k - 3) * 0.32; add(H, C('g:hair' + k, () => strand([HD.at(az, 0.35, 0.002), HD.at(az * 0.92 + 0.08 * Math.PI, 0.8, 0.008), HD.at(0, 1.2, 0.01)], 0.008, 0.004, { seg: 10, rad: 5 })), M.hair); }
    m.addRope(H, HD.at(Math.PI, 1.0, 0.03), 5, 0.06, M.hair, (v) => 0.016 * (1 - 0.7 * v) + 0.002, { rest: new V3(0, -0.6, -1), stiff: 0.2 });
  } else { // 두건: 머리를 덮는 천 + 뒤 매듭 꼬리 + 깃털
    add(H, C('g:hood', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, el = -0.05 + v * (Math.PI / 2 + 0.05), fr = Math.cos(az); HD.at(az, el + (fr > 0.6 ? 0.25 * smooth(0.6, 1, fr) * (1 - v) : 0), 0.012 + 0.006 * (1 - v), p); }, 40, 12, { closedU: true, poles: [12] })), M.linen);
    add(H, C('g:hoodKnot', () => new THREE.SphereGeometry(0.022, 10, 8)), M.linen, HD.at(Math.PI, 0.3, 0.025).toArray());
    for (const s of [-1, 1]) m.addRope(H, HD.at(Math.PI + s * 0.12, 0.28, 0.03), 4, 0.05, M.linen, (v) => 0.018 * (1 - 0.4 * v), { rest: new V3(s * 0.3, -0.8, -1), flat: 0.3, side: new V3(1, 0, 0), stiff: 0.2 });
    for (let k = 0; k < 2; k++) { const fg = add(H, C('g:feather', () => { const g = new THREE.PlaneGeometry(0.05, 0.16); g.translate(0, 0.08, 0); return g; }), M.feather, HD.at(Math.PI * 0.82 + k * 0.12, 0.55, 0.02).toArray()); fg.rotation.set(-0.7 - k * 0.2, 0.3, 0.4 + k * 0.3); }
  }
  /* ---------- 무기: 약탈자 = 녹슨 식칼 / 투석병 = 투석끈 (주머니에 돌) ---------- */
  const W = J.weapon; let tipL = 0.55;
  if (!slinger) {
    add(W, C('g:grip', () => { const g = loft((v) => ({ y: -0.06 + 0.18 * v, rx: 0.014 + 0.002 * Math.sin(v * 40), rz: 0.016 + 0.002 * Math.sin(v * 40) }), 10, 16); g.rotateX(Math.PI / 2); return g; }), M.leatherD);
    add(W, C('g:pommel', () => new THREE.SphereGeometry(0.02, 10, 8)), M.iron, [0, 0, -0.07]);
    add(W, C('g:cleaver', () => { const sh = new THREE.Shape(); sh.moveTo(0, -0.02); sh.lineTo(0.03, -0.03); sh.lineTo(0.43, -0.05); sh.quadraticCurveTo(0.5, -0.05, 0.5, 0.04); for (let i = 0; i < 6; i++) sh.lineTo(0.45 - i * 0.06, 0.06 + (i % 2) * 0.012); sh.lineTo(0.08, 0.07); sh.lineTo(0, 0.035); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }); g.translate(0, 0, -0.004); g.rotateY(-Math.PI / 2); g.rotateX(0); return g; }), M.iron, [0, 0.0, 0.07]);
    for (let i = 0; i < 3; i++) add(W, C('g:crivet', () => new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8)), M.gold, [0, 0.03, 0.1 + i * 0.03], [0, 0, Math.PI / 2]);
    tipL = 0.55;
  } else {
    const pts = [[0, 0, 0], [0, -0.06, 0.08], [0, -0.14, 0.12], [0, -0.22, 0.14]];
    add(W, C('g:sling', () => tube(pts, 0.004, 0.004, { seg: 20 })), M.leatherD);
    add(W, C('g:sling2', () => tube(pts.map(([x, y, z]) => [x + 0.012, y, z - 0.01]), 0.004, 0.004, { seg: 20 })), M.leatherD);
    const pouch = new THREE.Group(); pouch.position.set(0.006, -0.25, 0.14); W.add(pouch); m.pouch = pouch;
    add(pouch, C('g:pouch', () => { const g = new THREE.SphereGeometry(0.03, 12, 8, 0, TAU, Math.PI * 0.3, Math.PI * 0.7); g.scale(1, 0.8, 1.3); return g; }), M.leather);
    add(pouch, C('g:stone1', () => new THREE.DodecahedronGeometry(0.021, 1)), M.iron, [0, 0.008, 0]);
    add(J.handL, C('g:stone2', () => new THREE.DodecahedronGeometry(0.024, 1)), M.iron, [-0.01, -0.07, 0.02]);
  }
  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(); let t = 0; const lag = { L: 0, vL: 0 };
  m.update = (dt, f) => {
    t += dt;
    // 가리개 천: 다리를 따라 젖혀짐
    lag.vL += ((Math.min(J.hipL.rotation.x, J.hipR.rotation.x) - lag.L) * 120 - lag.vL * 12) * dt; lag.L += lag.vL * dt;
    if (m.flapF) m.flapF.rotation.x = Math.min(0, lag.L) * 0.8 - Math.hypot(f.vel.x, f.vel.z) * 0.02; if (m.flapB) m.flapB.rotation.x = Math.max(0, Math.max(J.hipL.rotation.x, J.hipR.rotation.x)) * 0.6 + Math.hypot(f.vel.x, f.vel.z) * 0.03;
    // 투석끈 돌리기: 사격 기술 준비 중에는 머리 위에서 빙빙
    if (m.pouch) { const spin = f.state === 'act' && f.actName === 's1' && f.at < 1.2; m.pouch.parent.rotation.z = spin ? t * 22 : 0; }
    M.eye.emissiveIntensity = 1.3 + 0.4 * Math.sin(t * 5) + (f.state === 'act' ? 0.8 : 0);
    if (m.ropes.length) { const cp = m.bodyCaps(f, 0.13); m.stepRopes(dt, f, cp.body, cp.legs); }
  };
  m.sole = 0.052;
  m.tipPos = (out = new V3()) => (m.pouch ? m.pouch.getWorldPosition(out) : W.localToWorld(out.set(0, 0, tipL)));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.08)); W.localToWorld(tt.set(0, 0, slinger ? 0.25 : tipL)); };
  return m;
}
