// 돌사자 해태 3D 모델 (네발): 화강암 몸 · 이끼 · 금 사이로 빛나는 푸른 부적 문양
// 큰 사자 머리(튀어나온 둥근 눈 · 넓은 주둥이 · 드러난 이빨 · 이마의 외뿔) · 소라 모양 곱슬 갈기 · 방울 목걸이
// 등의 비늘 · 팔꿈치의 불꽃 곱슬 · 발톱 달린 큰 발 · 위로 말린 불꽃 꼬리
// 몸 구조: kit/bodies 의 네발 리그 (골반을 앞으로 1.45 rad 눕힘 → 관절 로컬 +Y = 앞, +Z = 아래). 자세 · 보행은 quadPoses('lion') · quadRun
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { QUAD_DIMS } from '../bodies.js';
import { surf, loft, loftAt, strand, spl, lathe, gauss, smooth, cached } from '../../sculpt.js';
import { V3, TAU, UP, mottle, scaleTex, phys, glowMat, addMesh as add, tube, limb, bulge, creatureHead, cards, cardTex } from './plains_lib.js';

const C = (k, fn) => cached('peak:hae:' + k, fn);
const HEAD = creatureHead({ C: new V3(0, 0.07, 0.03), R: [0.15, 0.14, 0.14], snout: { len: 0.085, w: 0.55, y: -0.35, h: 0.35, p: 1.2 }, brow: 0.035, browY: 0.25, jaw: 0.22, cheek: 0.02,
  nose: { len: 0.02, w: 0.3, y: -0.12, h: 0.15 }, mouth: { y: -0.55, w: 0.6, depth: 0.022, h: 0.05 }, flatTop: 0.15 });
// 소라 모양 곱슬 (갈기 · 눈썹 · 팔꿈치): 평면 나선 관
const curlGeo = (r, turns = 1.6, th = 0.22) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, a = t * turns * TAU, rr = r * (1 - 0.8 * t); pts.push(new V3(Math.cos(a) * rr, Math.sin(a) * rr, t * r * 0.4)); } return strand(pts, r * th, r * th * 0.4, { seg: 30, rad: 7 }); };
export function buildHaetae(pal) {
  const D = QUAD_DIMS, m = buildHumanoid(D), J = m.J;
  const stoneT = mottle('haeStone', { base: '#b0aea4', dark: '#84827a', light: '#d0cec4', scale: 8, spots: 180, seed: 31, rep: [2, 1], bump: 3.2, cracks: 12, crackColor: 'rgba(30,34,40,0.9)', crackGlow: '#5ac8ff',
    paint: (g, W, H, r) => { for (let i = 0; i < 22; i++) { const x = r() * W, y = r() * H, rr = 8 + r() * 22, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(80,110,50,0.75)'); gr.addColorStop(1, 'rgba(80,110,50,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } } });
  const scl = scaleTex('haeScale', { bg: '#5a5852', fg: '#9a988e', tip: '#6a6860', size: 26, rep: [3, 2], line: 'rgba(20,24,30,0.6)' });
  const M = {
    stone: phys({ map: stoneT.map, normalMap: stoneT.normal, normalScale: new THREE.Vector2(1, 1), emissiveMap: stoneT.glow, emissive: pal.accent, emissiveIntensity: 0.6, roughness: 0.85 }),
    scale: phys({ map: scl.map, normalMap: scl.normal, roughness: 0.75, color: 0xd8d8d0 }),
    dark: phys({ color: 0x4a4844, roughness: 0.8 }),
    tooth: phys({ color: 0xe0dcd0, roughness: 0.5 }),
    bronze: phys({ color: 0x9a7a40, metalness: 0.9, roughness: 0.4 }),
    eye: phys({ color: 0xf0f4f8, roughness: 0.2, clearcoat: 1 }), pupil: glowMat(pal.accent, 2.8),
    moss: phys({ map: cardTex('haeMoss', { root: '#4a6a2a', tip: '#8aa848', n: 90 }), alphaTest: 0.4, roughness: 0.9, side: THREE.DoubleSide }),
    rune: glowMat(pal.accent, 2.2),
  };
  /* ---------- 몸통 (로컬 +Y 앞 · rzF 배 · rzB 등) ---------- */
  const rX = spl([[0, 0.01], [0.2, 0.15], [0.6, 0.18], [1, 0.18]]), rF = spl([[0, 0.01], [0.25, 0.17], [1, 0.2]]), rB = spl([[0, 0.01], [0.25, 0.15], [1, 0.17]]);
  add(J.hips, C('rump', () => loft((v) => ({ y: -0.24 + 0.34 * v, rx: rX(v), rzF: rF(v), rzB: rB(v), cz: 0.02 + 0.02 * v }), 32, 12, { poles: [0] })), M.stone);
  add(J.spine, C('barrel', () => loft((v) => ({ y: -0.03 + 0.33 * v, rx: 0.185 + 0.015 * v, rzF: 0.2 + 0.02 * Math.sin(v * Math.PI) - 0.02 * v, rzB: 0.17 + 0.01 * v, cz: 0.04 }), 32, 10)), M.stone);
  const cX = spl([[0, 0.2], [0.5, 0.23], [0.85, 0.2], [1, 0.01]]), cF = spl([[0, 0.2], [0.5, 0.26], [0.85, 0.22], [1, 0.01]]), cB = spl([[0, 0.18], [0.6, 0.2], [1, 0.01]]);
  add(J.chest, C('chest', () => loft((v) => ({ y: -0.03 + 0.42 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), cz: 0.05 + 0.03 * v }), 32, 14, { poles: [14] })), M.stone);
  // 등 비늘: 엉덩이에서 어깨까지
  for (const [j, y0, L, rx, rb, cz] of [[J.spine, -0.02, 0.32, 0.192, 0.18, 0.04], [J.chest, -0.02, 0.28, 0.215, 0.195, 0.05]]) add(j, C('scales' + y0 + L, () => loft((v) => ({ y: y0 + L * v, rx: rx + 0.01, rzF: 0.2, rzB: rb + 0.012, cz }), 24, 6, { a0: 0.78, a1: 1.22 })), M.scale);
  // 등줄기 돌기
  for (let i = 0; i < 6; i++) add(i < 3 ? J.spine : J.chest, C('ridge', () => { const g = new THREE.ConeGeometry(0.03, 0.08, 6); g.rotateX(Math.PI); return g; }), M.dark, [0, 0.05 + (i % 3) * 0.1, -(i < 3 ? 0.155 : 0.17)], [0.4, 0, 0]);
  // 이끼 덩어리 (등 · 엉덩이)
  J.spine.add(cards(C, 'moss', M.moss, 40, (r) => { const p = loftAt((v) => ({ y: -0.02 + 0.3 * v, rx: 0.2, rzF: 0.2, rzB: 0.19, cz: 0.04 }), 0.85 + r() * 0.3, r(), new V3()); return { p, n: new V3(p.x * 0.5, 0, p.z - 0.04).normalize(), flow: new V3(r() - 0.5, 0.3, 0.3), w: 0.05, l: 0.04 }; }, { bend: 0.4 }));
  /* ---------- 목 · 갈기 · 방울 목걸이 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.08 + 0.26 * v, rx: 0.15 - 0.02 * v, rzF: 0.15, rzB: 0.14 }), 24, 6)), M.stone);
  add(J.neck, C('collar', () => new THREE.TorusGeometry(0.16, 0.022, 8, 28)), M.bronze, [0, 0.0, 0.01], [Math.PI / 2 - 0.25, 0, 0]);
  add(J.neck, C('bell', () => lathe([[0, 0.04], [0.025, 0.035], [0.04, 0.0], [0.05, -0.05], [0.04, -0.055], [0, -0.05]], 16)), M.bronze, [0, -0.06, 0.17], [0.2, 0, 0]);
  add(J.neck, C('bellSlot', () => new THREE.SphereGeometry(0.012, 8, 6)), M.rune, [0, -0.11, 0.18]);
  /* ---------- 머리: 사자 얼굴 · 둥근 눈 · 이빨 · 외뿔 · 소라 곱슬 ---------- */
  const H = J.head; H.scale.setScalar(1.12);
  add(H, C('head', () => HEAD.geo(56, 42)), M.stone);
  const curl = C('curl', () => curlGeo(0.035)), curlS = C('curlS', () => curlGeo(0.024));
  // 갈기: 얼굴 둘레를 두 겹으로 감싼다
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 18; i++) { const a = (i / 17 - 0.5) * 4.4, az = Math.PI + a * 0.9 * (Math.abs(a) > 1.6 ? 1 : 1), el = Math.sin(i * 1.7) * 0.15 + (ring ? -0.2 : 0.35) + 0.25 * Math.cos(a * 0.7);
    const p = HEAD.at(az + (ring ? 0.12 : 0), el, 0.005), n = p.clone().sub(HEAD.C).normalize(), c = add(H, ring ? curlS : curl, M.stone, p.toArray()); c.quaternion.setFromUnitVectors(new V3(0, 0, 1), n); c.rotateZ(i * 1.3); c.scale.setScalar(1 + 0.25 * Math.sin(i * 2.1)); }
  // 볼 · 턱 수염 곱슬
  for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1, k = Math.floor(i / 2), p = HEAD.at(s * (0.85 + k * 0.12), -0.35 - k * 0.13, 0.004), c = add(H, curlS, M.stone, p.toArray()); c.quaternion.setFromUnitVectors(new V3(0, 0, 1), p.clone().sub(HEAD.C).normalize()); }
  for (const s of [-1, 1]) {
    const e = HEAD.at(s * 0.38, 0.18, -0.01), eye = add(H, C('eye', () => new THREE.SphereGeometry(0.034, 16, 12)), M.eye, e.toArray()); eye.lookAt(e.clone().add(new V3(s * 0.4, 0.05, 1)));
    add(eye, C('pupil', () => new THREE.SphereGeometry(0.016, 10, 8)), M.pupil, [0, 0, 0.026]);
    const br = add(H, curl, M.stone, HEAD.at(s * 0.36, 0.38, 0.01).toArray()); br.rotation.set(-0.3, s * 0.3, s * 0.5); br.scale.set(1.3, 0.8, 1);
    add(H, C('ear', () => { const g = new THREE.SphereGeometry(0.05, 12, 8); g.scale(0.5, 0.8, 0.3); return g; }), M.stone, HEAD.at(s * 1.2, 0.6, -0.01).toArray(), [0.3, s * 0.6, s * 0.4]);
    const fang = add(H, C('fang', () => { const g = new THREE.ConeGeometry(0.014, 0.05, 7); g.rotateX(Math.PI); g.translate(0, -0.02, 0); return g; }), M.tooth, HEAD.at(s * 0.28, -0.5, -0.004).toArray()); fang.rotation.x = 0.2;
  }
  for (let i = 0; i < 6; i++) add(H, C('tooth', () => { const g = new THREE.BoxGeometry(0.018, 0.022, 0.012); return g; }), M.tooth, HEAD.at((i - 2.5) * 0.09, -0.52, -0.008).toArray());
  add(H, C('tongue', () => { const g = new THREE.SphereGeometry(0.05, 12, 8); g.scale(1, 0.3, 0.9); return g; }), M.dark, HEAD.at(0, -0.62, -0.03).toArray());
  // 이마의 외뿔 (앞으로 휘어 올라감) + 빛나는 부적 문양
  add(H, C('horn', () => strand([[0, 0, 0], [0, 0.07, 0.015], [0, 0.12, 0.05], [0, 0.14, 0.09]], 0.026, 0.004, { seg: 14, rad: 8 })), M.dark, HEAD.at(0, 0.62, -0.005).toArray());
  add(H, C('runeF', () => new THREE.TorusGeometry(0.03, 0.005, 6, 20)), M.rune, HEAD.at(0, 0.42, 0.006).toArray(), [-0.4, 0, 0]);
  /* ---------- 다리: 굵은 돌 다리 · 팔꿈치 불꽃 곱슬 · 발톱 발 ---------- */
  const paw = (j, s) => { add(j, C('paw', () => { const g = new THREE.SphereGeometry(0.085, 16, 10); g.scale(1, 0.55, 1.25); return g; }), M.stone, [0, -0.03, 0.04]);
    for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.04; add(j, C('toe', () => { const g = new THREE.SphereGeometry(0.03, 10, 8); g.scale(1, 0.8, 1.1); return g; }), M.stone, [x, -0.045, 0.12]); const cl = add(j, C('pclaw', () => { const g = new THREE.ConeGeometry(0.012, 0.045, 6); g.rotateX(Math.PI / 2 + 0.6); return g; }), M.dark, [x, -0.06, 0.15]); } };
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(a, C('fshoulder', () => new THREE.SphereGeometry(0.12, 16, 12)), M.stone, [s * 0.02, 0, 0]);
    add(a, C('fupper', () => limb(D.uArm, [[0, 0.11], [0.5, 0.09], [1, 0.072]], [[0, 0.12], [0.5, 0.095], [1, 0.075]], { mod: bulge([[0.5, 0.3, 0.015]]) })), M.stone);
    add(b, C('flower', () => limb(D.lArm, [[0, 0.07], [1, 0.06]], [[0, 0.075], [1, 0.064]])), M.stone);
    for (let k = 0; k < 3; k++) { const fc = add(b, C('flame' + k, () => strand([[0, 0, 0], [0, -0.04, -0.06 - k * 0.01], [0, 0.0, -0.12 - k * 0.02], [0, 0.04, -0.1]], 0.022 - k * 0.004, 0.003, { seg: 12, rad: 6 })), M.stone, [s * (0.03 - k * 0.025), -0.02 - k * 0.04, -0.03]); fc.rotation.z = s * 0.2; }
    paw(c, s);
  }
  for (const [a, b, c] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(a, C('hthigh', () => limb(D.thigh, [[0, 0.13], [0.5, 0.11], [1, 0.075]], [[0, 0.15], [0.5, 0.12], [1, 0.08]], { mod: bulge([[0, 0.4, 0.02]]) })), M.stone);
    add(b, C('hshin', () => limb(D.shin, [[0, 0.07], [1, 0.058]], [[0, 0.08], [1, 0.062]])), M.stone);
    add(b, C('hflame', () => strand([[0, 0, 0], [0, 0.02, -0.07], [0, 0.07, -0.1]], 0.024, 0.004, { seg: 10, rad: 6 })), M.stone, [0, -0.02, -0.04]);
    paw(c, 1);
  }
  /* ---------- 꼬리: 위로 말려 올라간 불꽃 꼬리 (끝에 곱슬 뭉치) ---------- */
  const tail = new THREE.Group(); tail.position.set(0, -0.22, -0.08); J.hips.add(tail); m.tail = tail;
  add(tail, C('tail', () => strand([[0, 0, 0], [0, -0.12, -0.08], [0, -0.2, -0.25], [0, -0.14, -0.4], [0, -0.04, -0.42]], 0.045, 0.03, { seg: 24, rad: 8 })), M.stone);
  for (let i = 0; i < 5; i++) { const c = add(tail, curl, M.stone, [Math.sin(i * 2.4) * 0.04, -0.04 + Math.cos(i * 2.4) * 0.04, -0.42 - (i % 2) * 0.03]); c.rotation.set(i, i * 0.7, 0); c.scale.setScalar(1.3); }
  let t = 0;
  return { ...m, sole: 0.055,
    update(dt, f) { t += dt; const sp = Math.hypot(f.vel.x, f.vel.z); tail.rotation.z = Math.sin(t * (1.5 + sp * 0.4)) * 0.2; tail.rotation.x = Math.sin(t * 1.1) * 0.08;
      const k = 0.5 + 0.3 * Math.sin(t * 2.5) + (f.state === 'act' ? 0.8 : 0); M.stone.emissiveIntensity = k; M.rune.emissiveIntensity = 1.6 + k; M.pupil.emissiveIntensity = 2 + k; },
    tipPos(out) { return J.head.localToWorld(out.set(0, 0.0, 0.24)); },
    weaponPts(b, tt) { J.head.localToWorld(b.set(0, 0.04, 0.05)); J.head.localToWorld(tt.set(0, 0.0, 0.3)); } };
}
