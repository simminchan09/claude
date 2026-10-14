// 천봉 정상 몬스터 3D 모델: 타락한 수행승 · 바람매 궁수 (+ 날개 조립 도구 — 뇌공도 쓴다)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, cached } from '../../sculpt.js';
import { V3, TAU, UP, cv, tex, T, mottle, scaleTex, clothTex, cardTex, phys, glowMat, addMesh as add, tube, beads, limb, bulge, creatureHead, clawHand, cards, physKit } from './plains_lib.js';

const C = (k, fn) => cached('peak:' + k, fn);

/* =====================================================================
   날개: 어깨뼈 → 팔꿈치 → 손목 세 마디 + 칼깃(첫째) · 둘째깃 · 덮깃 카드
   update(k): 0 = 등에 접음 · 1 = 활짝 · flap = 날갯짓 위상
   ===================================================================== */
export function buildWing(parent, s, mats, o = {}) {
  const L = o.len ?? 1, root = new THREE.Group(); root.position.set(...(o.at ?? [s * 0.08, 0.22, -0.1])); parent.add(root);
  const seg = [root, new THREE.Group(), new THREE.Group()], segL = [0.26 * L, 0.3 * L, 0.24 * L];
  seg[0].add(seg[1]); seg[1].position.x = s * segL[0]; seg[1].add(seg[2]); seg[2].position.x = s * segL[1];
  // 뼈대 (살 · 깃털 덮인 팔)
  for (let i = 0; i < 3; i++) add(seg[i], C(`wbone${s}${i}${L}`, () => strand([[0, 0, 0], [s * segL[i] * 0.5, 0.012, 0], [s * segL[i], 0, 0]], 0.03 * L * (1 - i * 0.25), 0.022 * L * (1 - i * 0.25), { seg: 8, rad: 8 })), mats.cover);
  const feather = C('wfeathG', () => { const g = new THREE.PlaneGeometry(1, 1, 1, 4); g.translate(0, -0.5, 0); const ps = g.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setZ(i, 0.12 * y * y); } g.computeVertexNormals(); return g; });
  const put = (grp, x, len, w, rot, mat, z = 0) => { const f = new THREE.Mesh(feather, mat); f.position.set(x, 0, z); f.scale.set(w, len, 1); f.rotation.set(PI2w, 0, rot); grp.add(f); return f; };
  const PI2w = Math.PI / 2;
  // 칼깃: 손목 마디에서 바깥 · 뒤로 부채꼴
  for (let i = 0; i < 8; i++) { const t = i / 7; put(seg[2], s * segL[2] * (0.2 + 0.8 * t), (0.42 + 0.12 * t) * L, 0.16 * L, s * (0.2 + 1.0 * t), mats.prim, -0.004 * i); }
  for (let i = 0; i < 8; i++) { const t = i / 7; put(seg[1], s * segL[1] * t, (0.36 - 0.04 * t) * L, 0.17 * L, s * (0.02 + 0.15 * t), mats.sec, -0.003 * i); }
  for (let i = 0; i < 5; i++) { const t = i / 4; put(seg[0], s * segL[0] * (0.2 + 0.8 * t), 0.24 * L, 0.16 * L, s * 0.05, mats.sec, -0.002 * i); }
  // 덮깃: 앞쪽 가장자리를 덮는 짧은 깃
  for (let k = 1; k < 3; k++) for (let i = 0; i < 6; i++) { const t = i / 5; put(seg[k], s * segL[k] * t, 0.14 * L, 0.12 * L, s * 0.1, mats.cover, 0.006); }
  return {
    root, seg,
    update(k, flap = 0) {
      // 접힘: 몸 뒤로 눕혀 아래로 · 펼침: 옆으로 크게
      const fl = Math.sin(flap) * k;
      seg[0].rotation.set(-0.3 + 0.2 * k, s * (1.25 - 1.15 * k), s * (-0.9 + 1.0 * k + 0.45 * fl));
      seg[1].rotation.set(0, s * (-2.5 + 2.4 * k), s * (0.25 * fl));
      seg[2].rotation.set(0, s * (2.6 - 2.5 * k), s * (-0.2 + 0.3 * fl));
    },
  };
}

/* =====================================================================
   타락한 수행승: 민머리(계 흉터 · 검붉은 핏줄 · 빛나는 금) · 가사(조각 천)를 왼어깨에 두른 회색 장삼
   오른 맨어깨 · 왼팔 넓은 소매 · 큰 염주 · 넓은 바지 + 행전 · 짚신 · 석장(고리 여섯) · 등에 멘 삿갓
   ===================================================================== */
export const MONK_DIMS = { hipH: 0.95, spineL: 0.2, chestL: 0.28, neckL: 0.08, shW: 0.19, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.43, headTop: 0.25 };
const MONK_HEAD = creatureHead({ C: new V3(0, 0.1, 0.008), R: [0.083, 0.104, 0.095], back: 0.14, jaw: -0.05, brow: 0.014, browY: 0.22, cheek: -0.004, chin: 0.01, temple: 0.03,
  nose: { len: 0.024, w: 0.1, y: -0.18, h: 0.16, hook: 0.25 }, mouth: { y: -0.52, w: 0.32, depth: 0.006 }, socket: [0.36, 0.05, 0.014] });
function monkFaceTex(skin) {
  const W = 1024, H = 512, [c, g] = cv(W, H), P = (az, el) => MONK_HEAD.P(az, el, W, H); g.drawImage(skin.map.image, 0, 0, W, H);
  const shade = (az, el, r, col, sy = 1) => { const [x, y] = P(az, el), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, y); g.scale(1, sy); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); };
  for (const s of [-1, 1]) { shade(s * 0.36, 0.05, 40, 'rgba(40,10,20,0.75)', 0.7); shade(s * 0.5, -0.3, 46, 'rgba(60,20,30,0.3)'); }
  // 찌푸린 눈썹 · 깊은 주름 · 입선
  g.strokeStyle = 'rgba(30,14,10,0.9)'; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.lineWidth = 7; g.beginPath(); const [a, b] = P(s * 0.1, 0.18), [c2, d] = P(s * 0.55, 0.28); g.moveTo(a, b); g.quadraticCurveTo((a + c2) / 2, b - 14, c2, d); g.stroke();
    g.lineWidth = 2.5; const [x0, y0] = P(s * 0.16, -0.25), [x1, y1] = P(s * 0.34, -0.55); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + s * 18, (y0 + y1) / 2, x1, y1); g.stroke(); }
  g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 12; i++) { const a = -0.3 + i * 0.05, [x, y] = P(a, -0.52 - 0.04 * Math.abs(a) * 3); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.lineWidth = 2; for (let k = 0; k < 3; k++) { const [x, y] = P(-0.12 + k * 0.12, 0.5); g.beginPath(); g.moveTo(x - 30, y); g.quadraticCurveTo(x, y - 6, x + 30, y); g.stroke(); }
  // 정수리 연비 흉터 (점 아홉)
  g.fillStyle = 'rgba(60,20,10,0.85)'; for (let i = 0; i < 9; i++) { const [x, y] = P(((i % 3) - 1) * 0.35, 1.05 + Math.floor(i / 3) * 0.12); g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
  return tex(c);
}
function kasayaTex() { // 가사: 붉은 주황 조각 천을 이은 격자 (짙은 이음선)
  const W = 512, H = 512, [c, g] = cv(W, H), r = () => Math.random();
  for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 48) { g.fillStyle = `hsl(${12 + r() * 10}, ${62 + r() * 12}%, ${34 + r() * 8}%)`; g.fillRect(x, y, 48, 64); }
  g.strokeStyle = '#3a0e06'; g.lineWidth = 4; for (let y = 0; y <= H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let x = 0; x <= W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.strokeStyle = 'rgba(255,190,90,0.35)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); for (let y = 6; y <= H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.setLineDash([]);
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(r() * W, r() * H, 1 + r() * 8, 1); }
  return tex(c, [2, 2]);
}
export function buildMonk(pal) {
  const D = MONK_DIMS, m = physKit(buildHumanoid(D)), J = m.J;
  const skinT = mottle('monkSkin', { base: '#a87a62', dark: '#7a4a40', light: '#c09078', scale: 12, seed: 23, rep: [2, 1], bump: 1.2, cracks: 10, crackColor: 'rgba(60,10,20,0.9)', crackGlow: '#ff7a1a' });
  const M = {
    skin: phys({ map: skinT.map, normalMap: skinT.normal, normalScale: new THREE.Vector2(0.5, 0.5), emissiveMap: skinT.glow, emissive: 0xff8a2a, emissiveIntensity: 0.7, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffc0a0) }),
    face: phys({ map: T('monkFace', () => monkFaceTex(skinT)), normalMap: skinT.normal, normalScale: new THREE.Vector2(0.4, 0.4), emissiveMap: skinT.glow, emissive: 0xff8a2a, emissiveIntensity: 1.0, roughness: 0.5 }),
    robe: phys({ map: clothTex('pk_robe', { bg: '#4a4844', weave: true, grain: 260 }), roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color(0x9a9890), side: THREE.DoubleSide }),
    kasaya: phys({ map: T('kasaya', kasayaTex), roughness: 0.7, sheen: 0.8, sheenColor: new THREE.Color(0xff9a60), side: THREE.DoubleSide }),
    wrap: phys({ map: clothTex('pk_wrap', { bg: '#d8d0bc', weave: true, grain: 120 }), roughness: 0.9 }),
    straw: phys({ map: clothTex('pk_straw', { bg: '#b8985a', grain: 400, weave: true }), roughness: 0.9, side: THREE.DoubleSide }),
    bead: phys({ color: 0x4a1a10, roughness: 0.3, clearcoat: 1 }),
    beadB: phys({ color: 0xc89a40, roughness: 0.35, metalness: 0.5 }),
    wood: phys({ color: 0x3a2618, roughness: 0.5, clearcoat: 0.6 }),
    bronze: phys({ color: 0xb08850, metalness: 1, roughness: 0.32 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x200a00, emissive: pal.accent, emissiveIntensity: 2.4 }),
    nail: phys({ color: 0x3a2018, roughness: 0.4 }),
  };
  /* ---------- 몸통: 장삼(회색) — 오른어깨는 드러나고 가사가 왼어깨에서 오른옆구리로 ---------- */
  add(J.hips, C('m:pelvis', () => loft((v) => ({ y: -0.11 + 0.2 * v, rx: 0.13, rzF: 0.095, rzB: 0.1, n: 2.2 }), 32, 6)), M.robe);
  add(J.spine, C('m:waist', () => loft((v) => ({ y: -0.04 + 0.25 * v, rx: 0.12 + 0.01 * v, rzF: 0.09, rzB: 0.085, n: 2.2 }), 32, 8)), M.robe);
  const cX = spl([[0, 0.13], [0.4, 0.15], [0.75, 0.165], [0.9, 0.145], [1, 0.06]]), cF = spl([[0, 0.09], [0.55, 0.105], [0.85, 0.085], [1, 0.045]]), cB = spl([[0, 0.088], [0.6, 0.1], [1, 0.05]]);
  const chP = (v) => ({ y: -0.02 + 0.32 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), n: 2.2 });
  const pecs = (p, u, v, c, sn) => { if (sn > 0) { const l = Math.hypot(p.x, p.z), k = 0.012 * gauss(Math.abs(p.x) - 0.07, 0.05) * gauss(v - 0.68, 0.1) * sn; p.x += (p.x / l) * k; p.z += (p.z / l) * k; } };
  add(J.chest, C('m:chest', () => loft(chP, 44, 18, { mod: pecs })), M.skin);
  // 장삼: 왼쪽 가슴 · 등을 덮는 천 (오른 어깨 · 오른 가슴 일부는 맨살)
  const robeP = (v) => { const q = chP(v * 0.92); return { ...q, rx: q.rx + 0.008, rzF: q.rzF + 0.008, rzB: q.rzB + 0.008 }; };
  add(J.chest, C('m:robeTop', () => loft(robeP, 36, 14, { a0: -0.32, a1: 0.66, mod: (p, u, v) => { if (u > 0.5) p.y -= 0.12 * smooth(0.5, 0.66, u) * (1 - v * 0.3); } })), M.robe);
  // 가사: 왼어깨 위에서 오른 옆구리로 비스듬히 감는 넓은 띠
  add(J.chest, C('m:kasaya', () => surf((u, v, p) => { const a = u, band = (v - 0.5) * 0.12, y = 0.3 - 0.36 * a + band * 1.3 + 0.03 * Math.sin(a * TAU); const ring = loftAt(chP, 0.25 + a * 1.0, Math.max(0, Math.min(1, (y + 0.02) / 0.32)), new V3()); p.set(ring.x * 1.09, y, ring.z * 1.1); }, 48, 6)), M.kasaya);
  // 허리끈 + 왼 옆구리에 늘어진 두 가닥 (로프)
  const beltP = () => ({ y: 0.0, rx: 0.135, rzF: 0.1, rzB: 0.095, n: 2.2 });
  add(J.spine, C('m:belt', () => tube(loftRing(beltP, 0.5, { n: 40 }), 0.014, 0.014, { closed: true, seg: 80 })), M.kasaya);
  for (const dz of [0.02, -0.02]) m.addRope(J.spine, new V3(0.13, 0, dz), 5, 0.07, M.kasaya, (v) => 0.016 * (1 - 0.3 * v), { rest: new V3(0.2, -1, 0), flat: 0.35, side: new V3(1, 0, 0), caps: 'legs' });
  // 앞뒤 가리개 (가사 자락): 다리를 따라 젖혀진다
  for (const [z0, k] of [[0.1, 1], [-0.11, -1]]) { const g = new THREE.Group(); g.position.set(0, -0.06, z0); J.hips.add(g); m[k > 0 ? 'flapF' : 'flapB'] = g;
    add(g, C('m:flap' + k, () => surf((u, v, p) => { const w = 0.13 * (1 + 0.15 * v), x = (u - 0.5) * 2 * w; p.set(x, -0.5 * v, k * (0.01 + 0.03 * v - 0.06 * (x / w) ** 2)); }, 8, 8)), M.kasaya); }
  // 큰 염주: 목에 걸어 가슴까지
  { const pts = []; for (let i = 0; i <= 30; i++) { const a = (i / 30) * TAU; pts.push(new V3(Math.sin(a) * 0.12, 0.31 - 0.13 * (0.5 + 0.5 * Math.cos(a)) * (Math.cos(a) > 0 ? 1 : 0.25), Math.cos(a) * 0.105 + 0.01)); }
    add(J.chest, C('m:beads', () => beads(pts, 0.016, 26, { closed: true })), M.bead);
    add(J.chest, C('m:bigBead', () => new THREE.SphereGeometry(0.026, 12, 10)), M.beadB, [0, 0.18, 0.12]);
    add(J.chest, C('m:beadTas', () => lathe([[0.004, 0], [0.014, -0.014], [0.018, -0.07], [0, -0.075]], 12)), M.kasaya, [0, 0.16, 0.122]); }
  // 등에 멘 삿갓 (끈은 가슴으로)
  add(J.chest, C('m:hat', () => lathe([[0, 0.12], [0.03, 0.11], [0.2, 0.04], [0.29, 0], [0.285, -0.008], [0.0, 0.1]], 32)), M.straw, [0, 0.12, -0.2], [-Math.PI / 2 + 0.25, 0, 0]);
  /* ---------- 팔: 오른팔 맨살(핏줄) · 왼팔 넓은 소매 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const bare = s < 0;
    add(sh, C('m:delt', () => new THREE.SphereGeometry(0.055, 14, 10)), bare ? M.skin : M.robe, [0, -0.005, 0], [0, 0, 0], [1.05, 1, 1.05]);
    add(sh, C('m:uarm', () => limb(D.uArm, [[0, 0.052], [0.4, 0.05], [1, 0.037]], [[0, 0.05], [0.4, 0.048], [1, 0.035]], { mod: bulge([[0.5, 0.42, 0.01], [0, 0.4, 0.007]]) })), bare ? M.skin : M.robe);
    add(el, C('m:farm', () => limb(D.lArm, [[0, 0.04], [0.3, 0.043], [1, 0.03]], [[0, 0.038], [0.3, 0.04], [1, 0.028]], { mod: bulge([[0.25, 0.3, 0.006]]) })), M.skin);
    if (!bare) add(el, C('m:sleeve', () => loft((v) => ({ y: 0.02 - 0.22 * v, rx: 0.055 + 0.05 * v, rzF: 0.055 + 0.04 * v, rzB: 0.06 + 0.08 * v, cz: -0.03 * v }), 24, 6)), M.robe);
    add(el, C('m:wrist', () => loft((v) => ({ y: -D.lArm * (0.72 + 0.26 * v), rx: 0.033 + 0.002 * Math.sin(v * 30), rz: 0.031 + 0.002 * Math.sin(v * 30) }), 14, 10)), M.wrap);
    const hg = clawHand(C, 'm:hand', { s, n: 4, len: 0.065, r: 0.0095, curl: s < 0 ? 2.3 : 1.0, claw: 0.012, palm: [0.03, 0.06, 0.017], mat: M.skin, clawMat: M.nail }); hg.position.y = -0.006; ha.add(hg);
  }
  /* ---------- 다리: 넓은 바지 · 행전 · 짚신 ---------- */
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, C('m:pant', () => limb(D.thigh + 0.04, [[0, 0.1], [0.5, 0.095], [1, 0.08]], [[0, 0.1], [0.5, 0.1], [1, 0.085]], { mod: (p, u, v) => { const l = Math.hypot(p.x, p.z), k = 0.006 * Math.sin(u * TAU * 5 + v * 3); p.x += (p.x / l) * k; p.z += (p.z / l) * k; } })), M.robe);
    add(kn, C('m:pantL', () => limb(0.16, [[0, 0.085], [1, 0.06]], [[0, 0.09], [1, 0.065]])), M.robe);
    add(kn, C('m:gaiter', () => loft((v) => ({ y: -0.12 - (D.shin - 0.14) * v, rx: 0.052 - 0.014 * v + 0.0025 * Math.sin(v * 40), rz: 0.056 - 0.016 * v + 0.0025 * Math.sin(v * 40) }), 18, 16)), M.wrap);
    const fw = spl([[0, 0.0], [0.08, 0.035], [0.5, 0.042], [0.85, 0.04], [1, 0.012]]), fh = spl([[0, 0.025], [0.1, 0.05], [0.5, 0.042], [0.85, 0.03], [1, 0.012]]);
    add(ft, C('m:foot', () => surf((u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.8; p.set(Math.sign(c) * Math.abs(c) ** e * w, -0.058 + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.05 + 0.22 * v); }, 22, 14, { closedU: true })), M.skin);
    add(ft, C('m:sandal', () => { const g = new THREE.CylinderGeometry(1, 1, 0.018, 20); g.scale(0.05, 1, 0.13); return g; }), M.straw, [0, -0.064, 0.06]);
    for (const z of [0.02, 0.09]) add(ft, C('m:sstrap', () => new THREE.TorusGeometry(0.045, 0.006, 6, 16, Math.PI)), M.straw, [0, -0.055, z], [0, PI2m(), 0]);
  }
  function PI2m() { return Math.PI / 2; }
  /* ---------- 머리: 민머리 · 길게 늘어진 귓불 · 빛나는 눈 ---------- */
  add(J.neck, C('m:neck', () => limb(0.13, [[0, 0.05], [1, 0.044]], [[0, 0.05], [1, 0.042]], { y0: 0.02, y1: -0.13 })), M.skin).rotation.x = Math.PI;
  const H = J.head, HD = MONK_HEAD;
  add(H, C('m:head', () => HD.geo(64, 48)), M.face);
  for (const s of [-1, 1]) {
    add(H, C('m:eye', () => new THREE.SphereGeometry(0.012, 10, 8)), M.eye, HD.at(s * 0.36, 0.06, -0.012).toArray(), [0, 0, 0], [1.2, 0.6, 0.7]);
    add(H, C('m:ear' + s, () => strand([HD.at(s * 1.5, 0.15, -0.004), HD.at(s * 1.55, 0.05, 0.012), HD.at(s * 1.5, -0.2, 0.014), HD.at(s * 1.45, -0.42, 0.006)], 0.016, 0.012, { seg: 12, rad: 8, flat: 0.45, ref: [s, 0, 0] })), M.skin);
  }
  /* ---------- 석장: 나무 자루 · 청동 고리틀 + 작은 고리 여섯 ---------- */
  const W = J.weapon, len = 1.5;
  add(W, C('m:staff', () => { const g = new THREE.CylinderGeometry(0.018, 0.02, 1.55, 10); g.rotateX(PI2m()); g.translate(0, 0, 0.55); return g; }), M.wood);
  add(W, C('m:ferrule', () => { const g = new THREE.ConeGeometry(0.022, 0.08, 10); g.rotateX(-PI2m()); g.translate(0, 0, -0.24); return g; }), M.bronze);
  const top = new THREE.Group(); top.position.z = 1.36; W.add(top);
  add(top, C('m:loop', () => { const pts = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU; pts.push(new V3(Math.sin(a) * 0.09, 0, 0.1 - Math.cos(a) * 0.1 + 0.04 * Math.max(0, Math.cos(a)) ** 4)); } return tube(pts, 0.007, 0.007, { closed: true, seg: 80 }); }), M.bronze);
  add(top, C('m:fin', () => { const g = lathe([[0.02, 0], [0.025, 0.02], [0.012, 0.06], [0, 0.09]], 12); g.rotateX(PI2m()); return g; }), M.bronze, [0, 0, 0.2]);
  add(top, C('m:axis', () => { const g = new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6); g.rotateX(PI2m()); g.translate(0, 0, 0.1); return g; }), M.bronze);
  const rings = []; for (let i = 0; i < 6; i++) { const s = i < 3 ? 1 : -1, k = i % 3, r = add(top, C('m:ring', () => new THREE.TorusGeometry(0.03, 0.004, 6, 16)), M.bronze, [s * 0.085, 0, 0.06 + k * 0.05], [0, 0, 0]); rings.push(r); }
  add(top, C('m:orb', () => new THREE.SphereGeometry(0.03, 10, 8)), M.eye, [0, 0, 0.1]);
  let t = 0; const lag = { L: 0, vL: 0 };
  m.update = (dt, f) => {
    t += dt; lag.vL += ((Math.min(J.hipL.rotation.x, J.hipR.rotation.x) - lag.L) * 110 - lag.vL * 12) * dt; lag.L += lag.vL * dt;
    m.flapF.rotation.x = Math.min(0, lag.L) * 0.85 - Math.hypot(f.vel.x, f.vel.z) * 0.02; m.flapB.rotation.x = Math.max(0, Math.max(J.hipL.rotation.x, J.hipR.rotation.x)) * 0.6 + Math.hypot(f.vel.x, f.vel.z) * 0.03;
    rings.forEach((r, i) => { r.rotation.y = Math.sin(t * 7 + i) * 0.4 * (f.state === 'act' || f.state === 'run' ? 1.5 : 0.3); });
    const pulse = 0.8 + 0.4 * Math.sin(t * 3); M.skin.emissiveIntensity = pulse * (f.state === 'act' ? 1.8 : 1); M.face.emissiveIntensity = M.skin.emissiveIntensity;
    const cp = m.bodyCaps(f, 0.12); m.stepRopes(dt, f, cp.body, cp.legs);
  };
  m.sole = 0.064;
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0, len));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.2)); W.localToWorld(tt.set(0, 0, len + 0.05)); };
  return m;
}

/* =====================================================================
   바람매 궁수: 매 머리(갈고리 부리 · 노란 눈 · 검은 눈물줄) · 깃털 몸 · 등의 큰 날개(접힘/펼침)
   깃털 바지 · 노란 비늘 정강이 · 검은 발톱 · 왼손 굽은 활 · 허리 화살통 · 꽁지깃 부채
   ===================================================================== */
export const HAWK_DIMS = { hipH: 0.93, spineL: 0.2, chestL: 0.27, neckL: 0.1, shW: 0.18, uArm: 0.28, lArm: 0.26, hipW: 0.09, thigh: 0.38, shin: 0.45, headTop: 0.27 };
const HAWK_HEAD = creatureHead({ C: new V3(0, 0.09, 0.0), R: [0.075, 0.08, 0.095], back: 0.25, brow: 0.022, browY: 0.15, flatTop: 0.15, socket: [0.65, 0.12, 0.008] });
function hawkHeadTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H), P = (az, el) => HAWK_HEAD.P(az, el, W, H);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#4a3a2c'); gr.addColorStop(0.5, '#6a5440'); gr.addColorStop(0.62, '#efe6d6'); gr.addColorStop(1, '#f4ecdc'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const x = Math.random() * W, y = Math.random() * H * 0.6; g.strokeStyle = 'rgba(20,14,8,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 8); g.stroke(); }
  // 흰 뺨 + 검은 눈물줄 (매의 콧수염 무늬)
  for (const s of [-1, 1]) { const [x, y] = P(s * 0.75, -0.15); g.fillStyle = '#f2ead8'; g.beginPath(); g.ellipse(x, y, 70, 60, 0, 0, TAU); g.fill();
    g.fillStyle = '#1e1810'; g.beginPath(); const [a, b] = P(s * 0.62, 0.05), [c2, d] = P(s * 0.62, -0.55); g.moveTo(a - 16, b); g.lineTo(a + 16, b); g.lineTo(c2 + 8, d); g.lineTo(c2 - 8, d); g.fill(); }
  return tex(c);
}
export function buildHawk(pal) {
  const D = HAWK_DIMS, m = physKit(buildHumanoid(D)), J = m.J;
  const fB = scaleTex('hawkBack', { bg: '#3a3028', fg: '#6a5844', tip: '#2a2018', size: 22, feather: true, rep: [3, 2] });
  const fC = scaleTex('hawkChest', { bg: '#d8ccb4', fg: '#efe4cc', tip: '#8a6a4a', size: 18, feather: true, rep: [3, 2] });
  const shinT = scaleTex('hawkShin', { bg: '#a87a10', fg: '#e8b830', tip: '#b88a20', size: 14, rep: [2, 3] });
  const M = {
    back: phys({ map: fB.map, normalMap: fB.normal, roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0xb0c8e0), side: THREE.DoubleSide }),
    chest: phys({ map: fC.map, normalMap: fC.normal, roughness: 0.75, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    head: phys({ map: T('hawkHead', hawkHeadTex), roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    beak: phys({ color: 0xe8b830, roughness: 0.3, clearcoat: 0.8 }), beakTip: phys({ color: 0x2a2420, roughness: 0.25, clearcoat: 1 }),
    shin: phys({ map: shinT.map, normalMap: shinT.normal, roughness: 0.4, clearcoat: 0.5 }),
    talon: phys({ color: 0x141210, roughness: 0.2, clearcoat: 1 }),
    prim: phys({ map: cardTex('hawkPrim', { feather: true, root: '#4a3c30', tip: '#1e1814', band: 'rgba(200,190,170,0.6)' }), alphaTest: 0.45, roughness: 0.7, side: THREE.DoubleSide }),
    sec: phys({ map: cardTex('hawkSec', { feather: true, root: '#6a5644', tip: '#3a2e24', band: 'rgba(220,210,190,0.5)', seed: 4 }), alphaTest: 0.45, roughness: 0.7, side: THREE.DoubleSide }),
    cover: phys({ map: cardTex('hawkCov', { feather: true, root: '#7a6650', tip: '#4a3a2c', seed: 8 }), alphaTest: 0.45, roughness: 0.7, side: THREE.DoubleSide }),
    fluff: phys({ map: cardTex('hawkFluff', { root: '#efe4cc', tip: '#c8b494', n: 140 }), alphaTest: 0.4, roughness: 0.85, side: THREE.DoubleSide }),
    eye: new THREE.MeshStandardMaterial({ color: 0x3a2000, emissive: 0xffaa20, emissiveIntensity: 1.1, roughness: 0.1 }), pupil: new THREE.MeshBasicMaterial({ color: 0x050302 }),
    wood: phys({ color: 0x4a2c1a, roughness: 0.4, clearcoat: 0.7 }), horn: phys({ color: 0xe8dcc0, roughness: 0.35, clearcoat: 0.6 }),
    string: new THREE.MeshBasicMaterial({ color: 0xe8f4ff }), glow: glowMat(pal.accent, 2.4),
    leather: phys({ color: 0x3a2a1c, roughness: 0.6 }), metal: phys({ color: 0xa8b0b8, metalness: 1, roughness: 0.3 }),
  };
  /* ---------- 몸통: 등 짙은 깃 · 가슴 흰 줄무늬 깃 ---------- */
  add(J.hips, C('h:pelvis', () => loft((v) => ({ y: -0.1 + 0.18 * v, rx: 0.105, rzF: 0.085, rzB: 0.095, n: 2.2 }), 28, 6)), M.back);
  add(J.spine, C('h:belly', () => loft((v) => ({ y: -0.04 + 0.24 * v, rx: 0.1 + 0.012 * v, rzF: 0.092, rzB: 0.085, n: 2.2 }), 28, 8)), M.chest);
  const kX = spl([[0, 0.11], [0.5, 0.135], [0.85, 0.13], [1, 0.05]]), kF = spl([[0, 0.095], [0.5, 0.125], [0.85, 0.1], [1, 0.045]]), kB = spl([[0, 0.09], [0.6, 0.1], [1, 0.05]]);
  const chP = (v) => ({ y: -0.02 + 0.31 * v, rx: kX(v), rzF: kF(v), rzB: kB(v), n: 2.1 });
  add(J.chest, C('h:chestF', () => loft(chP, 40, 16, { a0: 0.22, a1: 0.78 })), M.chest);
  add(J.chest, C('h:chestB', () => loft(chP, 40, 16, { a0: -0.24, a1: 0.24 })), M.back);
  add(J.chest, C('h:ruff', () => loft((v) => ({ y: 0.25 + 0.06 * v, rx: 0.1 - 0.04 * v, rzF: 0.09 - 0.03 * v, rzB: 0.085 - 0.03 * v }), 28, 4)), M.chest);
  // 가죽 가슴띠 + 화살통 (오른 엉덩이 뒤)
  { const strap = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * TAU; strap.push(new V3(Math.sin(a) * 0.14 * (0.75 + 0.25 * Math.cos(a)), 0.24 - 0.28 * (0.5 - 0.5 * Math.cos(a)) - 0.05 * Math.sin(a), Math.cos(a) * 0.13)); }
    add(J.chest, C('h:strap', () => tube(strap, 0.008, 0.008, { seg: 60, closed: true, flat: 0.35 })), M.leather);
    const q = new THREE.Group(); q.position.set(-0.11, -0.02, -0.08); q.rotation.set(-0.35, 0, -0.25); J.hips.add(q);
    add(q, C('h:quiver', () => lathe([[0.035, -0.3], [0.04, -0.25], [0.045, 0.05], [0.05, 0.08], [0.044, 0.08], [0.0, -0.3]], 14)), M.leather);
    add(q, C('h:qrim', () => new THREE.TorusGeometry(0.049, 0.006, 6, 16)), M.metal, [0, 0.08, 0], [PI2(), 0, 0]);
    for (let i = 0; i < 5; i++) { const a = add(q, C('h:qarrow', () => { const g = new THREE.CylinderGeometry(0.004, 0.004, 0.2, 5); g.translate(0, 0.12, 0); return g; }), M.wood, [Math.cos(i * 1.3) * 0.02, 0, Math.sin(i * 1.3) * 0.02]); add(a, C('h:qflet', () => new THREE.PlaneGeometry(0.03, 0.06)), M.prim, [0, 0.2, 0]); } }
  // 꽁지깃 부채
  { const tail = new THREE.Group(); tail.position.set(0, -0.06, -0.1); tail.rotation.x = 0.9; J.hips.add(tail); m.tail = tail;
    for (let i = 0; i < 9; i++) { const f = add(tail, C('h:tailF', () => { const g = new THREE.PlaneGeometry(0.07, 0.4); g.translate(0, -0.2, 0); return g; }), M.prim, [(i - 4) * 0.012, 0, -0.002 * Math.abs(i - 4)]); f.rotation.set(-PI2(), 0, (i - 4) * 0.12); } }
  /* ---------- 날개 ---------- */
  m.wings = [1, -1].map((s) => buildWing(J.chest, s, M, { at: [s * 0.07, 0.24, -0.09], len: 1.1 }));
  /* ---------- 팔: 깃털 덮인 위팔 · 비늘 손 · 검은 발톱 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('h:delt', () => new THREE.SphereGeometry(0.05, 14, 10)), M.back);
    add(sh, C('h:uarm', () => limb(D.uArm, [[0, 0.048], [0.4, 0.045], [1, 0.034]], [[0, 0.046], [1, 0.033]], { mod: bulge([[0.5, 0.42, 0.006]]) })), M.back);
    add(el, C('h:farm', () => limb(D.lArm, [[0, 0.036], [0.3, 0.038], [1, 0.026]], [[0, 0.034], [1, 0.024]])), M.back);
    el.add(cards(C, 'h:armFluff', M.cover, 18, (r) => { const a = (s > 0 ? 0 : 0.5) + r() * 0.5, y = -r() * D.lArm * 0.8, p = new V3(Math.sin(a * TAU) * 0.038, y, -Math.cos(a * TAU) * 0.036); return { p, n: new V3(p.x, 0, p.z).normalize(), flow: new V3(0, -1, -0.4), w: 0.03, l: 0.07 + r() * 0.03 }; }, { lift: 0.002 }));
    const hg = clawHand(C, 'h:hand', { s, n: 3, len: 0.07, r: 0.0095, curl: s > 0 ? 2.3 : 1.4, claw: 0.022, palm: [0.026, 0.05, 0.015], mat: M.shin, clawMat: M.talon }); hg.position.y = -0.006; ha.add(hg);
  }
  /* ---------- 다리: 깃털 바지 · 비늘 정강이 · 앞 세 발가락 + 뒤 발가락 ---------- */
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, C('h:thigh', () => limb(D.thigh, [[0, 0.075], [0.5, 0.07], [1, 0.05]], [[0, 0.08], [0.5, 0.075], [1, 0.05]])), M.chest);
    hp.add(cards(C, 'h:pants', M.fluff, 50, (r) => { const a = r(), v = 0.2 + r() * 0.85, p = loftAt((vv) => ({ y: -D.thigh * vv, rx: 0.075 - 0.025 * vv, rz: 0.078 - 0.026 * vv }), a, v, new V3()); return { p, n: new V3(p.x, 0, p.z).normalize(), flow: new V3(0, -1, 0), w: 0.05 + r() * 0.02, l: 0.08 + r() * 0.04 }; }, { lift: 0.003 }));
    add(kn, C('h:shin', () => limb(D.shin, [[0, 0.03], [0.5, 0.026], [1, 0.024]], [[0, 0.032], [1, 0.025]])), M.shin);
    for (const [ax, az, L, r0] of [[0, 1, 0.1, 0.013], [0.5, 0.86, 0.085, 0.012], [-0.5, 0.86, 0.085, 0.012], [0, -1, 0.06, 0.012]]) {
      const pts = [new V3(0, -0.035, 0), new V3(ax * L * 0.5, -0.045, az * L * 0.55), new V3(ax * L, -0.05, az * L)];
      add(ft, C(`h:toe${ax}${az}`, () => strand(pts, r0, r0 * 0.75, { seg: 8, rad: 7 })), M.shin);
      const cl = add(ft, C('h:talon', () => { const g = new THREE.ConeGeometry(0.008, 0.035, 6); g.translate(0, 0.0175, 0); return g; }), M.talon, pts[2].toArray()); cl.quaternion.setFromUnitVectors(UP, new V3(ax, -0.9, az).normalize());
    }
    add(ft, C('h:ankle', () => new THREE.SphereGeometry(0.022, 10, 8)), M.shin, [0, -0.03, 0]);
  }
  /* ---------- 머리: 매 얼굴 · 갈고리 부리 · 노란 눈 · 뒤통수 깃 ---------- */
  add(J.neck, C('h:neck', () => limb(0.14, [[0, 0.05], [1, 0.042]], [[0, 0.052], [1, 0.045]], { y0: 0.02, y1: -0.14 })), M.chest).rotation.x = Math.PI;
  const H = J.head, HD = HAWK_HEAD; H.scale.setScalar(1.15);
  add(H, C('h:head', () => HD.geo(56, 40)), M.head);
  // 부리: 윗부리가 길게 나와 아래로 휜다 (끝은 검정)
  const beakU = (u, v, p) => { const a = u * TAU, z = 0.0 + 0.09 * v, w = 0.03 * (1 - v) ** 0.8 + 0.002, h = 0.028 * (1 - v * 0.7) + 0.002, dy = -0.045 * v * v * v; p.set(Math.cos(a) * w, 0.075 + dy + Math.sin(a) * h * (Math.sin(a) > 0 ? 1 : 0.4), 0.075 + z); };
  add(H, C('h:beakU', () => surf(beakU, 16, 12, { closedU: true })), M.beak);
  add(H, C('h:beakT', () => surf((u, v, p) => { beakU(u, 0.75 + 0.25 * v, p); p.multiplyScalar(1.001); }, 16, 4, { closedU: true })), M.beakTip);
  add(H, C('h:beakL', () => surf((u, v, p) => { const a = u * TAU, z = 0.06 * v, w = 0.022 * (1 - v) + 0.002; p.set(Math.cos(a) * w, 0.05 + Math.sin(a) * 0.01 - 0.006 * v, 0.07 + z); }, 12, 6, { closedU: true })), M.beak);
  add(H, C('h:cere', () => surf((u, v, p) => { const a = u * TAU; p.set(Math.cos(a) * 0.032, 0.078 + Math.sin(a) * 0.026, 0.07 + 0.012 * v); }, 16, 2, { closedU: true })), M.beak);
  for (const s of [-1, 1]) { const e = HD.at(s * 0.62, 0.15, -0.004), eye = add(H, C('h:eye', () => new THREE.SphereGeometry(0.017, 14, 10)), M.eye, e.toArray()); eye.lookAt(e.clone().add(new V3(s * 0.8, 0, 1))); add(eye, C('h:pupil', () => new THREE.SphereGeometry(0.008, 8, 6)), M.pupil, [0, 0, 0.012]);
    add(H, C('h:brow', () => { const g = new THREE.SphereGeometry(0.02, 12, 6, 0, TAU, 0, Math.PI * 0.4); return g; }), M.head, e.toArray(), [0.4, 0, s * 0.4], [1.2, 1, 1.1]); }
  H.add(cards(C, 'h:crest', M.cover, 26, (r) => { const az = Math.PI + (r() - 0.5) * 1.6, el = 0.2 + r() * 0.9, p = HD.at(az, el); return { p, n: p.clone().sub(HD.C).normalize(), flow: new V3(0, -0.4, -1), w: 0.035, l: 0.08 + r() * 0.06 }; }, { lift: 0.002 }));
  /* ---------- 활: 왼손에 세로로 쥔 굽은 활 (뿔 끝 · 빛나는 시위) ---------- */
  const bow = new THREE.Group(); bow.position.set(0, -0.06, 0.01); J.handL.add(bow); m.bow = bow;
  const bowPts = []; for (let i = 0; i <= 20; i++) { const t = i / 20 * 2 - 1, y = t * 0.55, z = 0.12 * (1 - t * t) - 0.05 * Math.abs(t) ** 3 * 0 + (Math.abs(t) > 0.85 ? -0.06 * (Math.abs(t) - 0.85) / 0.15 : 0); bowPts.push(new V3(0, z, y)); }
  add(bow, C('h:bow', () => tube(bowPts, 0.014, 0.014, { seg: 60, prof: (v) => 1 - 0.45 * Math.abs(v - 0.5) * 2 })), M.wood);
  for (const e of [0, 20]) add(bow, C('h:nock', () => new THREE.SphereGeometry(0.014, 8, 6)), M.horn, bowPts[e].toArray());
  add(bow, C('h:grip', () => { const g = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10); g.rotateX(PI2()); return g; }), M.leather, [0, 0.12, 0]);
  const strG = new THREE.CylinderGeometry(0.0025, 0.0025, 1, 4); const str = add(bow, strG, M.string); m.string = str;
  const sA = bowPts[0], sB = bowPts[20]; m.drawK = 0;
  let t = 0;
  m.update = (dt, f) => {
    t += dt;
    // 날개: 공중 · 사격 · 회피 때 펼치고 평소에는 접는다
    const want = !f.onGround || f.state === 'dash' || (f.state === 'act' && f.actName === 's1') ? 1 : f.state === 'run' ? 0.3 : 0.08;
    m.wingK = (m.wingK ?? 0) + (want - (m.wingK ?? 0)) * Math.min(1, dt * 7); const flap = t * (f.onGround ? 3 : 12);
    for (const w of m.wings) w.update(m.wingK, flap);
    m.tail.rotation.y = Math.sin(t * 2) * 0.1; m.tail.rotation.x = 0.9 + 0.3 * m.wingK;
    // 시위: 사격 준비 중 당긴다
    const draw = f.state === 'act' && f.actName === 's1' && f.at < 0.85 ? Math.min(1, f.at / 0.6) : 0; m.drawK += (draw - m.drawK) * Math.min(1, dt * 20);
    const mid = new V3(0, 0.12 - 0.22 * m.drawK, 0), a = sA.clone(), b = sB.clone();
    str.position.copy(a.clone().add(mid).multiplyScalar(0.5)); str.scale.set(1, a.distanceTo(mid), 1); str.quaternion.setFromUnitVectors(UP, mid.clone().sub(a).normalize());
    if (!m.str2) { m.str2 = add(bow, strG, M.string); }
    m.str2.position.copy(b.clone().add(mid).multiplyScalar(0.5)); m.str2.scale.set(1, b.distanceTo(mid), 1); m.str2.quaternion.setFromUnitVectors(UP, mid.clone().sub(b).normalize());
    M.eye.emissiveIntensity = 1 + (f.state === 'act' ? 1 : 0);
  };
  m.sole = 0.05;
  m.tipPos = (out = new V3()) => bow.localToWorld(out.set(0, 0.1, 0.02));
  m.weaponPts = (b, tt) => { J.handR.localToWorld(b.set(0, -0.02, 0)); J.handR.localToWorld(tt.set(0, -0.1, 0.05)); };
  return m;
}
const PI2 = () => Math.PI / 2;
