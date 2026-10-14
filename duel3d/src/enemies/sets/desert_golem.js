// 사암 골렘 — 협곡의 수호석 (정예 · 슈퍼아머)
// 구성: 붉은 · 황토 · 크림 지층 결의 사암 덩어리 (노이즈로 깎은 곡면) · 넓은 어깨 바위 · 땅에 닿을 듯 긴 팔과 바위 주먹
//       가슴의 상형문자 석판 (빛나는 홈) + 태양 원반 핵 · 몸을 가로지르는 빛나는 균열
//       가슴에 파묻힌 스핑크스 석상 머리 (줄무늬 네메스 두건 · 눈구멍의 빛) · 등에 박힌 부러진 오벨리스크 조각
//       어깨 주위를 도는 작은 돌조각 · 관절에서 흘러내리는 모래
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, strand, spl, fbm, gauss, smooth } from '../../sculpt.js';
import { V3, TAU, C, cv, tex, rng, T, shared, std, add, normalFrom } from './desert_kit.js';

export const GOLEM_DIMS = { hipH: 0.84, spineL: 0.2, chestL: 0.38, neckL: 0.05, shW: 0.38, uArm: 0.4, lArm: 0.44, hipW: 0.17, thigh: 0.36, shin: 0.38, headTop: 0.16 };
const D = GOLEM_DIMS;

// 지층 사암: 가로 띠 (v 방향 반복) + 모래 알갱이
function strataCanvas(hgt) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(hgt ? 33 : 31);
  const cols = ['#c27a48', '#c98450', '#b8703e', '#d09460', '#c07446', '#b46a3c', '#cc8a56', '#d49a68'];
  let y = 0, i = 0; while (y < H) { const h = 40 + r() * 90; g.fillStyle = hgt ? `rgb(${90 + (i % 3) * 50},0,0)`.replace(/rgb\((\d+),0,0\)/, (_, v) => `rgb(${v},${v},${v})`) : cols[i % cols.length]; g.fillRect(0, y, W, h + 1); y += h; i++; }
  // 띠 경계의 물결
  for (let k = 0; k < 30; k++) { const yy = r() * H; g.strokeStyle = hgt ? 'rgba(0,0,0,0.6)' : 'rgba(80,30,10,0.35)'; g.lineWidth = 1 + r() * 2; g.beginPath(); for (let x = 0; x <= W; x += 8) g.lineTo(x, yy + Math.sin(x * 0.05 + k) * 3); g.stroke(); }
  for (let k = 0; k < 2600; k++) { const x = r() * W, yy = r() * H, v = r(); g.fillStyle = hgt ? `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},0.3)` : v < 0.5 ? 'rgba(70,30,10,0.25)' : 'rgba(255,230,190,0.2)'; g.fillRect(x, yy, 2, 2); }
  return c;
}
// 상형문자 석판: 테두리 · 칸 · 새 · 눈 · 앙크 · 물결 (glow = 홈만 흰색)
function glyphCanvas(glow) {
  const W = 256, H = 256, [c, g] = cv(W, H);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); } else { g.drawImage(strataCanvas(false), 0, 0, W, H); g.fillStyle = 'rgba(230,190,140,0.35)'; g.fillRect(0, 0, W, H); }
  g.strokeStyle = glow ? '#fff' : 'rgba(90,40,15,0.9)'; g.lineWidth = 5; g.lineCap = 'round';
  g.strokeRect(14, 14, W - 28, H - 28); g.beginPath(); g.moveTo(W / 2, 20); g.lineTo(W / 2, H - 20); g.stroke();
  const glyph = (x, y, k) => { g.beginPath();
    if (k === 0) { g.ellipse(x, y, 16, 9, 0, 0, TAU); g.moveTo(x + 4, y); g.arc(x, y, 4, 0, TAU); g.moveTo(x - 6, y + 9); g.lineTo(x - 10, y + 22); } // 눈
    else if (k === 1) { g.arc(x, y - 8, 9, 0, TAU); g.moveTo(x, y + 1); g.lineTo(x, y + 24); g.moveTo(x - 12, y + 8); g.lineTo(x + 12, y + 8); } // 앙크
    else if (k === 2) { for (let i = 0; i < 3; i++) { g.moveTo(x - 16, y - 8 + i * 9); for (let j = 0; j <= 4; j++) g.lineTo(x - 16 + j * 8, y - 8 + i * 9 + (j % 2 ? -4 : 3)); } } // 물결
    else { g.moveTo(x - 14, y + 12); g.quadraticCurveTo(x - 4, y - 18, x + 12, y - 8); g.lineTo(x + 18, y - 4); g.moveTo(x - 2, y - 4); g.lineTo(x + 4, y + 16); } // 새
    g.stroke(); };
  for (let row = 0; row < 4; row++) for (const col of [0, 1]) glyph(W * (0.27 + col * 0.46), 52 + row * 52, (row * 2 + col) % 4);
  return c;
}
function golemMats(pal) {
  return shared('golem:' + pal.accent, () => {
    const n = T('strN', () => normalFrom(strataCanvas(true), 2.0, [1, 1]));
    return {
      rock: std({ map: T('strata', () => tex(strataCanvas(false))), normalMap: n, roughness: 0.94 }),
      rockD: std({ map: T('strata', () => tex(strataCanvas(false))), normalMap: n, color: 0xb88a70, roughness: 0.96 }),
      plate: std({ map: T('glyph', () => tex(glyphCanvas(false))), emissiveMap: T('glyphG', () => tex(glyphCanvas(true))), emissive: pal.accent, emissiveIntensity: 1.6, roughness: 0.85 }),
      glow: std({ color: 0x000000, emissive: pal.accent, emissiveIntensity: 2.4 }),
      core: std({ color: 0xffd080, emissive: pal.accent, emissiveIntensity: 2.0, roughness: 0.2 }),
      gold: std({ color: 0xd8a040, metalness: 0.85, roughness: 0.35 }),
      halo: new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
  });
}
// 노이즈로 깎은 바위 덩어리 (타원체 곡면)
function rockBall(key, rx, ry, rz, amp = 0.18, fr = 5, seed = 0, o = {}) {
  return C('g:ball' + key, () => surf((u, v, p) => {
    const az = u * TAU, el = -Math.PI / 2 + v * Math.PI, x = Math.sin(az) * Math.cos(el), y = Math.sin(el), z = Math.cos(az) * Math.cos(el);
    const n = fbm(x * fr + seed, y * fr + seed * 2, z * fr, 3), k = 1 + amp * (n - 0.5) * 2 - (o.flatBot ? 0.25 * smooth(-0.3, -0.9, y) : 0);
    // 깎인 면 느낌: 반지름을 몇 단계로 양자화
    const q = o.facet ? Math.round(k * o.facet) / o.facet * 0.4 + k * 0.6 : k;
    p.set(x * rx * q, y * ry * q, z * rz * q);
  }, 28, 18, { closedU: true, poles: [0, 18], uvV: 1.2 }));
}
// 둥근 사각 로프트 + 노이즈 (덩어리 몸통)
const rockMod = (amp, fr, seed) => (p, u, v, c, sn) => { const n = fbm(p.x * fr + seed, p.y * fr, p.z * fr + seed, 3) - 0.5, l = Math.hypot(p.x, p.z) || 1; p.x += (p.x / l) * n * amp; p.z += (p.z / l) * n * amp; };

export function buildSandGolem(pal, scale = 1.45) {
  const m = buildHumanoid(D), J = m.J, M = golemMats(pal);
  /* 골반 · 배 */
  add(J.hips, C('g:pelvis', () => loft((v) => ({ y: -0.16 + 0.24 * v, rx: 0.25 - 0.03 * v, rzF: 0.18, rzB: 0.2, n: 2.8 }), 32, 8, { mod: rockMod(0.05, 7, 1) })), M.rock);
  add(J.spine, C('g:belly', () => loft((v) => ({ y: -0.04 + 0.26 * v, rx: 0.22 + 0.04 * v, rzF: 0.17 + 0.03 * v, rzB: 0.18, n: 2.6 }), 32, 8, { mod: rockMod(0.05, 6, 2) })), M.rockD);
  /* 가슴: 큰 바위 몸통 (위로 갈수록 넓어지는 어깨) */
  const chX = spl([[0, 0.27], [0.4, 0.34], [0.8, 0.4], [1, 0.3]]), chF = spl([[0, 0.2], [0.6, 0.25], [1, 0.18]]);
  const chP = (v) => ({ y: -0.03 + 0.46 * v, rx: chX(v), rzF: chF(v), rzB: chF(v) * 1.05, n: 2.9 });
  add(J.chest, C('g:chest', () => loft(chP, 44, 14, { mod: rockMod(0.06, 5, 3) })), M.rock);
  // 가슴 석판 (상형문자) + 태양 원반 핵
  add(J.chest, C('g:plate', () => surf((u, v, p) => { const x = (u - 0.5) * 0.3, y = 0.08 + 0.3 * v, k = loftAt(chP, 0.5, (y + 0.03) / 0.5, new V3()); p.set(x, y, k.z + 0.012 - 2.2 * x * x); }, 8, 8)), M.plate);
  add(J.chest, C('g:core', () => new THREE.SphereGeometry(0.06, 20, 14)), M.core, [0, 0.42, 0.21], [0, 0, 0], [1, 1, 0.55]);
  add(J.chest, C('g:coreR', () => new THREE.TorusGeometry(0.075, 0.012, 8, 32)), M.gold, [0, 0.42, 0.215]);
  const hl = add(J.chest, C('g:coreH', () => new THREE.SphereGeometry(0.13, 16, 12)), M.halo, [0, 0.42, 0.2]); hl.renderOrder = 4;
  // 빛나는 균열 (몸통 표면 위 꺾인 선)
  const crack = (key, parent, prof, pts) => { const q = pts.map(([u, v]) => { const p = loftAt(prof, u, v, new V3()); const l = Math.hypot(p.x, p.z); p.x *= (l + 0.008) / l; p.z *= (l + 0.008) / l; return p; }); add(parent, C('g:cr' + key, () => strand(q, 0.007, 0.002, { seg: 20, rad: 5 })), M.glow); };
  crack('a', J.chest, chP, [[0.36, 0.95], [0.38, 0.8], [0.34, 0.66], [0.37, 0.5], [0.33, 0.35]]);
  crack('b', J.chest, chP, [[0.66, 0.9], [0.62, 0.75], [0.66, 0.6], [0.63, 0.45]]);
  crack('c', J.chest, chP, [[0.05, 0.9], [0.02, 0.7], [0.97, 0.5], [0.0, 0.3]]);
  // 등의 부러진 오벨리스크 조각
  { const g = new THREE.Group(); g.position.set(0.06, 0.38, -0.2); g.rotation.set(-0.5, 0.2, -0.25); J.chest.add(g);
    add(g, C('g:obel', () => loft((v) => ({ y: 0.45 * v, rx: 0.07 - 0.025 * v, rz: 0.07 - 0.025 * v, n: 8, mod: 0 }), 16, 6, { mod: (p, u, v) => { if (v > 0.9) p.y -= 0.05 * Math.abs(Math.sin(u * 9)); } })), M.rockD);
    for (let i = 0; i < 3; i++) add(g, C('g:obG' + i, () => new THREE.BoxGeometry(0.03, 0.03, 0.005)), M.glow, [0, 0.1 + i * 0.1, 0.066 - i * 0.008]); }
  /* 머리: 가슴에 파묻힌 스핑크스 석상 */
  const H = new THREE.Group(); H.position.set(0, -0.02, 0.12); J.head.add(H);
  add(H, C('g:face', () => loft((v) => ({ y: -0.04 + 0.2 * v, rx: 0.1 - 0.015 * v, rzF: 0.11, rzB: 0.09, n: 3 }), 24, 8, { mod: rockMod(0.012, 12, 4) })), M.rockD, [0, 0, 0.1]);
  // 네메스 두건 (줄무늬 홈) — 머리 위에서 어깨로 퍼짐
  add(H, C('g:nemes', () => loft((v) => ({ y: 0.17 - 0.24 * v, rx: 0.115 + 0.09 * v * v, rzF: 0.08 + 0.02 * v, rzB: 0.11 + 0.03 * v, n: 2.4, cz: 0.08 - 0.02 * v }), 36, 10, { a0: 0.6, a1: 1.4, mod: (p, u, v) => { const k = 1 + 0.025 * Math.sign(Math.sin(u * TAU * 8)); p.x *= k; } })), M.rock);
  for (const s of [-1, 1]) {
    add(H, C('g:eye', () => new THREE.BoxGeometry(0.04, 0.014, 0.02)), M.glow, [s * 0.04, 0.07, 0.205], [0, 0, s * 0.12]);
    add(H, C('g:brow', () => new THREE.BoxGeometry(0.055, 0.016, 0.03)), M.rockD, [s * 0.042, 0.095, 0.2], [0, 0, s * 0.1]);
  }
  add(H, C('g:nose', () => new THREE.BoxGeometry(0.03, 0.05, 0.04)), M.rockD, [0, 0.04, 0.21], [0.25, 0, 0]);
  add(H, C('g:beard', () => loft((v) => ({ y: -0.04 - 0.1 * v, rx: 0.02 - 0.006 * v, rz: 0.018, n: 2.5 }), 10, 4)), M.rock, [0, 0, 0.18]);
  /* 팔: 어깨 바위 · 기둥 같은 위팔 · 넓어지는 아래팔 · 바위 주먹 */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, rockBall('sh', 0.2, 0.17, 0.19, 0.2, 4, s > 0 ? 1 : 7, { facet: 6 }), M.rock, [s * 0.04, 0.05, 0]);
    add(sh, rockBall('sh2', 0.1, 0.08, 0.1, 0.25, 6, 3), M.rockD, [s * 0.15, 0.17, -0.04]);
    add(sh, C('g:uarm', () => loft((v) => ({ y: -0.05 - (D.uArm - 0.05) * v, rx: 0.115 - 0.02 * v, rz: 0.11 - 0.015 * v, n: 2.5 }), 20, 6, { mod: rockMod(0.03, 8, 5) })), M.rockD);
    add(el, rockBall('el', 0.1, 0.09, 0.1, 0.2, 7, 2), M.rock);
    add(el, C('g:farm', () => loft((v) => ({ y: -0.02 - (D.lArm - 0.04) * v, rx: 0.12 + 0.035 * v, rz: 0.11 + 0.03 * v, n: 2.7 }), 22, 8, { mod: rockMod(0.04, 7, 6) })), M.rock);
    crack('f' + s, el, (v) => ({ y: -0.02 - (D.lArm - 0.04) * v, rx: 0.12 + 0.035 * v, rz: 0.11 + 0.03 * v, n: 2.7 }), [[s > 0 ? 0.3 : 0.7, 0.1], [s > 0 ? 0.35 : 0.65, 0.4], [s > 0 ? 0.3 : 0.7, 0.7]]);
    add(ha, rockBall('fist', 0.16, 0.15, 0.16, 0.2, 5, s > 0 ? 4 : 9, { facet: 5 }), M.rockD, [0, -0.09, 0.02]);
    for (let k = 0; k < 4; k++) add(ha, rockBall('kn' + k, 0.045, 0.04, 0.05, 0.3, 9, k), M.rock, [s * 0.015 + (k - 1.5) * 0.065 * -s, -0.16, 0.12]);
  }
  /* 다리: 짧고 굵은 기둥 · 넓은 발 */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    add(hp, C('g:thigh', () => loft((v) => ({ y: 0.02 - (D.thigh + 0.02) * v, rx: 0.15 - 0.02 * v, rz: 0.15 - 0.02 * v, n: 2.5 }), 20, 6, { mod: rockMod(0.04, 7, 7) })), M.rockD);
    add(kn, rockBall('kn', 0.11, 0.1, 0.11, 0.2, 6, s), M.rock, [0, 0, 0.02]);
    add(kn, C('g:shin', () => loft((v) => ({ y: -0.02 - D.shin * v, rx: 0.13 + 0.015 * v, rz: 0.13 + 0.01 * v, n: 2.6 }), 20, 6, { mod: rockMod(0.04, 7, 8) })), M.rock);
    add(ft, C('g:foot', () => loft((v) => ({ y: -0.08 + 0.36 * v, rx: 0.13 - 0.02 * v, rzF: 0.06, rzB: 0.04, n: 3, cz: 0.0 }), 20, 6, { mod: rockMod(0.02, 9, 9) }).rotateX(Math.PI / 2).translate(0, -0.03, -0.06)), M.rockD);
  }
  /* 떠도는 돌조각 */
  const orb = new THREE.Group(); orb.position.y = 0.3; J.chest.add(orb); const bits = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, b = add(orb, rockBall('bit' + (i % 3), 0.04, 0.035, 0.045, 0.35, 8, i), i % 2 ? M.rock : M.rockD, [Math.cos(a) * 0.55, Math.sin(i * 2.3) * 0.12, Math.sin(a) * 0.45]); bits.push(b); }
  let t = 0;
  m.update = (dt, f) => {
    t += dt; orb.rotation.y += dt * 0.7; bits.forEach((b, i) => { b.rotation.x += dt * (0.5 + i * 0.2); b.position.y = Math.sin(t * 1.6 + i * 1.3) * 0.12; });
    const k = 0.75 + 0.25 * Math.sin(t * 3.2); M.core.emissiveIntensity = 1.6 + k; M.glow.emissiveIntensity = 1.8 + k * 0.8;
    // 관절에서 모래가 흘러내림
    if (f.root.visible && f.G && Math.random() < dt * 9) { const j = [J.shoulderL, J.shoulderR, J.elbowL, J.elbowR, J.hips][(Math.random() * 5) | 0]; const p = j.getWorldPosition(new V3()); f.G.fx.p(p, { vel: [0, -0.5, 0], size: 0.06, size1: 0.02, life: 0.8, color: 0xd8a868, alpha: 0.8, drag: 0.3, grav: 6 }); }
  };
  m.sole = 0.08;
  m.tipPos = (out = new V3()) => J.handR.localToWorld(out.set(0, -0.12, 0.15));
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.25, 0)); J.handR.localToWorld(tt.set(0, -0.2, 0.06)); };
  m.extras = [];
  return m;
}
