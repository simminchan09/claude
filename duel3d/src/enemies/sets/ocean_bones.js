// 노을 바다의 해골들: 해골 해적 (잡몹) · 해적 총잡이 (원거리)
// 공통 해골: 깊은 눈구멍 속 도깨비불 눈 · 따로 움직이는 아래턱과 이빨 · 목뼈 · 등뼈 마디 · 늑골 6쌍 + 흉골 · 쇄골 · 어깨뼈
//            골반 날개 · 마디 굵은 팔다리뼈 (요골/척골 · 경골/비골 두 가닥) · 손가락뼈
// 해골 해적: 붉은 두건 (뒤 매듭 · 두 꼬리 로프) · 금 귀고리 · 찢어진 줄무늬 바지 · 붉은 허리띠 (두 꼬리 로프) · 놋쇠 손잡이 커틀러스
// 해적 총잡이: 금 테 붉은 프록코트 (열린 앞섶으로 늑골이 보임 · 소매 커프스 · 뒤 코트 자락 두 장 로프) · 깃털 달린 삼각모
//              가죽 탄띠 · 화약통 · 무릎 장화 · 플린트락 권총 (금 장식 개머리 · 공이)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, strand, spl, lathe, gauss, smooth, envCube } from '../../sculpt.js';
import { V3, TAU, C, cv, tex, rng, T, shared, std, add, rim, lRim, normalFrom, physRig } from './ocean_kit.js';

export const BONE_DIMS = { hipH: 0.95, spineL: 0.2, chestL: 0.28, neckL: 0.09, shW: 0.18, uArm: 0.29, lArm: 0.27, hipW: 0.088, thigh: 0.44, shin: 0.43, headTop: 0.24 };
const D = BONE_DIMS;

function boneCanvas(hgt) { const W = 256, H = 256, [c, g] = cv(W, H), r = rng(hgt ? 8 : 6); g.fillStyle = hgt ? '#808080' : '#d8ceb0'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) { const x = r() * W, y = r() * H, l = 3 + r() * 14; g.strokeStyle = hgt ? `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},0.3)` : r() < 0.6 ? 'rgba(120,100,70,0.22)' : 'rgba(255,250,230,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l); g.stroke(); }
  if (!hgt) for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * H, rr = 10 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(90,110,70,0.25)'); gr.addColorStop(1, 'rgba(90,110,70,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  return c; }
function stripeCanvas(a, b, n = 8) { const W = 256, H = 64, [c, g] = cv(W, H); for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i / n) * W, 0, W / n + 1, H); } const r = rng(3); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(r() * W, r() * H, 3, 1); } return c; }
function clothCanvas(base, seed = 4) { const W = 256, H = 256, [c, g] = cv(W, H), r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H); for (let i = 0; i < 2000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)'; g.fillRect(r() * W, r() * H, 2, 2); } for (let i = 0; i < 10; i++) { const x = r() * W, y = r() * H, rr = 15 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } return c; }
// 코트: 붉은 천 · 앞섶 금 테 (u 0.5 = 앞, 앞섶은 열려 있어 메시를 a0/a1 로 자른다)
function coatCanvas() { const W = 512, H = 256, [c, g] = cv(W, H); g.drawImage(clothCanvas('#7a2018', 5), 0, 0, W, H); g.fillStyle = '#d8a040'; g.fillRect(0, 0, 14, H); g.fillRect(W - 14, 0, 14, H); g.fillRect(0, H - 10, W, 10); for (let y = 30; y < H; y += 46) for (const x of [26, W - 26]) { g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); } return c; }

function boneMats(pal, kind) {
  return shared('bones:' + kind + pal.accent, () => {
    const env = envCube(), nb = T('boneN', () => normalFrom(boneCanvas(true), 1.6));
    const M = {
      bone: std({ map: T('bone', () => tex(boneCanvas(false))), normalMap: nb, roughness: 0.72 }),
      boneD: std({ map: T('bone', () => tex(boneCanvas(false))), normalMap: nb, color: 0xb8ac90, roughness: 0.78 }),
      hole: std({ color: 0x050608, roughness: 1 }),
      eye: new THREE.MeshBasicMaterial({ color: pal.accent }),
      eyeGlow: new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
      red: std({ map: T('redC', () => tex(clothCanvas('#9a1c24'))), roughness: 0.8, side: THREE.DoubleSide }),
      pants: std({ map: T('pants', () => tex(stripeCanvas('#2a3248', '#c8c0a8', 10), [2, 1])), roughness: 0.85, side: THREE.DoubleSide }),
      coat: std({ map: T('coat', () => tex(coatCanvas())), roughness: 0.75, side: THREE.DoubleSide }),
      coatIn: std({ map: T('redC2', () => tex(clothCanvas('#4a1010', 9))), roughness: 0.8, side: THREE.DoubleSide }),
      leather: std({ map: T('lea', () => tex(clothCanvas('#3a2416', 11))), roughness: 0.6 }),
      hat: std({ map: T('hat', () => tex(clothCanvas('#1a1418', 13))), roughness: 0.7, side: THREE.DoubleSide }),
      gold: std({ color: 0xe0b050, metalness: 1, roughness: 0.28, envMap: env, envMapIntensity: 1.2 }),
      brass: std({ color: 0xc89040, metalness: 0.9, roughness: 0.35, envMap: env }),
      steel: std({ color: 0xc8ccd4, metalness: 1, roughness: 0.22, envMap: env, envMapIntensity: 1.2 }),
      iron: std({ color: 0x3a3a40, metalness: 0.8, roughness: 0.45, envMap: env }),
      wood: std({ color: 0x5a3018, roughness: 0.55 }),
      feather: std({ color: 0xf0ece0, roughness: 0.8, side: THREE.DoubleSide }),
      edge: std({ color: 0x000000, emissive: pal.accent, emissiveIntensity: 1.4 }),
    };
    // 유령 선원: 모든 재질이 반투명한 청록 빛
    if (kind === 'ghost') for (const k in M) { const mt = M[k]; if (!mt.isMeshStandardMaterial) continue; mt.transparent = true; mt.opacity = 0.5; mt.depthWrite = false; mt.emissive = new THREE.Color(pal.accent); mt.emissiveIntensity = 0.45; }
    return M;
  });
}

/* ---------- 해골 머리 ---------- */
const HC = new V3(0, 0.12, 0.0);
export function skullPt(az, el, p) {
  const ce = Math.cos(el), x = Math.sin(az) * ce, y = Math.sin(el), z = Math.cos(az) * ce, fr = Math.max(0, z);
  let rx = 0.074, ry = 0.088, rz = 0.092, r = 1;
  const low = smooth(0.0, -0.7, el); rx *= 1 - 0.3 * low; rz *= 1 - 0.08 * low * (1 - fr);
  r += 0.06 * gauss(el - 0.26, 0.08) * fr * gauss(az, 0.75);
  r += 0.08 * gauss(Math.abs(az) - 0.8, 0.16) * gauss(el + 0.08, 0.12);
  r -= 0.12 * gauss(Math.abs(az) - 1.0, 0.22) * gauss(el + 0.32, 0.18);
  r -= 0.07 * gauss(Math.abs(az) - 1.45, 0.25) * gauss(el - 0.12, 0.18);
  p.set(HC.x + x * rx * r, HC.y + y * ry * r, HC.z + z * rz * r + 0.01 * low * fr);
  if (y < -0.5) p.y = HC.y - ry * 0.5 - (-y - 0.5) * ry * 0.35;
  return p;
}
function addSkull(H, M, o = {}) {
  add(H, C('b:skull', () => surf((u, v, p) => skullPt((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI, p), 56, 40, { closedU: true, poles: [0, 40] })), M.bone);
  // 눈구멍 (어두운 타원 판 + 빛) · 콧구멍 · 윗니
  const eyes = [];
  for (const s of [-1, 1]) {
    const p = skullPt(s * 0.38, 0.06, new V3());
    add(H, C('b:sock', () => { const g = new THREE.SphereGeometry(0.024, 14, 10); g.scale(1.05, 0.95, 0.45); return g; }), M.hole, [p.x, p.y, p.z - 0.002], [0, s * 0.35, 0]);
    add(H, C('b:brow', () => strand([[-0.026, 0.004, -0.006], [0, 0.018, 0.004], [0.026, 0.006, -0.008]], 0.007, 0.007, { seg: 8, rad: 6 })), M.bone, [p.x, p.y + 0.012, p.z], [0, s * 0.35, 0]);
    add(H, C('b:eye', () => new THREE.SphereGeometry(0.007, 8, 6)), M.eye, [p.x, p.y, p.z + 0.006]);
    const g = add(H, C('b:eyeG', () => new THREE.SphereGeometry(0.022, 10, 8)), M.eyeGlow, [p.x, p.y, p.z + 0.008]); g.renderOrder = 4; eyes.push(g);
  }
  const n = skullPt(0, -0.14, new V3()); add(H, C('b:nose', () => { const g = new THREE.ConeGeometry(0.014, 0.03, 3); g.rotateZ(Math.PI); g.scale(1, 1, 0.4); return g; }), M.hole, [n.x, n.y, n.z + 0.001]);
  const tooth = C('b:tooth', () => { const g = new THREE.BoxGeometry(0.008, 0.013, 0.006); return g; });
  for (let i = 0; i < 8; i++) { const az = -0.5 + (i / 7) * 1.0, q = skullPt(az, -0.42, new V3()); add(H, tooth, M.bone, [q.x, q.y - 0.006, q.z - 0.002], [0, az, 0]); }
  // 아래턱 (경첩: 귀 아래)
  const jaw = new THREE.Group(); jaw.position.set(0, 0.07, -0.02); H.add(jaw);
  const jp = []; for (let i = 0; i <= 12; i++) { const a = -1.4 + (i / 12) * 2.8, k = Math.cos(a); jp.push(new V3(Math.sin(a) * 0.052, -0.02 - 0.03 * k, 0.03 + 0.055 * k)); }
  add(jaw, C('b:mand', () => strand(jp, 0.012, 0.012, { seg: 30, rad: 6, flat: 0.55, ref: [0, 1, 0] })), M.bone);
  for (const s of [-1, 1]) add(jaw, C('b:ramus' + s, () => strand([[s * 0.05, -0.04, 0.015], [s * 0.054, -0.005, 0.005], [s * 0.056, 0.01, 0.0]], 0.01, 0.008, { seg: 6, rad: 6 })), M.bone);
  for (let i = 0; i < 7; i++) { const a = -0.55 + (i / 6) * 1.1, k = Math.cos(a); add(jaw, tooth, M.bone, [Math.sin(a) * 0.05, -0.04 - 0.03 * k + 0.013, 0.03 + 0.053 * k], [0, a, 0]); }
  return { jaw, eyes };
}
// 마디 굵은 긴 뼈 (y 0 → -L)
const longBone = (key, L, r0, r1) => C('b:lb' + key, () => lathe([[0, 0.012], [r0 * 1.5, 0.004], [r0 * 1.7, -0.015], [r0, -0.05], [(r0 + r1) / 2 * 0.85, -L * 0.5], [r1, -L + 0.05], [r1 * 1.6, -L + 0.012], [r1 * 1.3, -L - 0.004], [0, -L - 0.01]].map(([r, y]) => [r, y]), 12));

export function buildSkeleton(pal, scale = 1, kind = 'grunt') {
  const m = buildHumanoid(D), J = m.J, M = boneMats(pal, kind); physRig(m, scale);
  const gun = kind === 'gunner';
  /* 골반 · 등뼈 · 늑골 */
  for (const s of [-1, 1]) add(J.hips, C('b:ilium' + s, () => surf((u, v, p) => { const a = -0.4 + 1.6 * u, r = 0.05 + 0.06 * v; p.set(s * (0.03 + Math.sin(a) * r * 0.9), 0.06 * v - 0.02 + 0.03 * Math.sin(u * Math.PI) * v, -0.01 + Math.cos(a) * r * 0.55 - 0.02); }, 10, 6)), M.bone);
  add(J.hips, C('b:sacrum', () => lathe([[0.0, 0.06], [0.03, 0.05], [0.035, 0.0], [0.02, -0.06], [0, -0.08]], 10)), M.boneD, [0, 0, -0.04], [0, 0, 0], [1, 1, 0.6]);
  add(J.hips, C('b:pubis', () => strand([[0.07, -0.02, 0.02], [0.04, -0.07, 0.05], [0, -0.075, 0.06], [-0.04, -0.07, 0.05], [-0.07, -0.02, 0.02]], 0.014, 0.014, { seg: 16, rad: 6 })), M.bone);
  const vert = C('b:vert', () => { const g = lathe([[0, 0.012], [0.02, 0.011], [0.024, 0], [0.02, -0.011], [0, -0.012]], 10); return g; });
  const proc = C('b:proc', () => { const g = new THREE.ConeGeometry(0.008, 0.035, 5); g.rotateX(-Math.PI / 2 - 0.5); return g; });
  for (let i = 0; i < 5; i++) { add(J.spine, vert, M.bone, [0, 0.02 + i * 0.045, -0.02]); add(J.spine, proc, M.boneD, [0, 0.02 + i * 0.045, -0.045]); }
  for (let i = 0; i < 6; i++) { add(J.chest, vert, M.bone, [0, 0.0 + i * 0.05, -0.06], [0, 0, 0], 0.9); add(J.chest, proc, M.boneD, [0, i * 0.05, -0.085]); }
  // 늑골: 등뼈에서 둘레를 감아 흉골로 (아래로 처지며)
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const y = 0.24 - i * 0.04, rx = 0.1 + 0.025 * Math.sin((i / 5) * Math.PI * 0.8 + 0.4), rz = 0.075 + 0.01 * Math.sin((i / 5) * Math.PI), pts = [];
    for (let k = 0; k <= 10; k++) { const a = 0.25 + (k / 10) * (Math.PI - 0.6 - i * 0.05), dy = -0.05 * (k / 10) ** 1.5; pts.push(new V3(s * Math.sin(a) * rx, y + dy, -Math.cos(a) * rz - 0.01)); }
    add(J.chest, C(`b:rib${i}${s}`, () => strand(pts, 0.0075, 0.006, { seg: 20, rad: 5, flat: 0.6, ref: [0, 1, 0] })), M.bone);
  }
  add(J.chest, C('b:stern', () => strand([[0, 0.27, 0.075], [0, 0.18, 0.088], [0, 0.07, 0.078]], 0.014, 0.008, { seg: 10, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.bone);
  for (const s of [-1, 1]) {
    add(J.chest, C('b:clav' + s, () => strand([[s * 0.01, 0.272, 0.07], [s * 0.09, 0.285, 0.05], [s * 0.16, 0.27, 0.0]], 0.01, 0.009, { seg: 10, rad: 6 })), M.bone);
    add(J.chest, C('b:scap' + s, () => surf((u, v, p) => { p.set(s * (0.04 + 0.09 * u), 0.26 - 0.12 * v * (1 - 0.6 * u), -0.085 - 0.02 * Math.sin(u * Math.PI)); }, 6, 6)), M.boneD);
  }
  /* 목 · 머리 */
  for (let i = 0; i < 3; i++) add(J.neck, vert, M.bone, [0, 0.0 + i * 0.035, -0.01], [0, 0, 0], 0.75);
  const H = J.head, sk = addSkull(H, M); H.scale.setScalar(1.12); m.jaw = sk.jaw;
  /* 팔다리 뼈 */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, longBone('hum', D.uArm, 0.013, 0.011), M.bone);
    add(el, C('b:rad', () => strand([[0.01, 0, 0.004], [0.012, -D.lArm * 0.5, 0.006], [0.012, -D.lArm, 0.004]], 0.008, 0.009, { seg: 8, rad: 6 })), M.bone);
    add(el, C('b:uln', () => strand([[-0.008, 0.01, -0.006], [-0.01, -D.lArm * 0.5, -0.004], [-0.008, -D.lArm, -0.004]], 0.009, 0.007, { seg: 8, rad: 6 })), M.boneD);
    const hg = new THREE.Group(); ha.add(hg);
    add(hg, C('b:carp', () => { const g = new THREE.SphereGeometry(0.018, 10, 8); g.scale(1, 0.7, 1.4); return g; }), M.boneD, [0, -0.012, 0]);
    for (let k = 0; k < 4; k++) { const z = 0.02 - k * 0.013, curl = s < 0 ? 2.4 : 1.0 + k * 0.15, pts = []; for (let i = 0; i <= 6; i++) { const th = -0.5 - (i / 6) * curl; pts.push(new V3(s * 0.004 + s * Math.cos(th) * 0.03, -0.05 + Math.sin(th) * 0.032, z)); }
      add(hg, C(`b:fing${s}${k}`, () => strand(pts, 0.0048, 0.0034, { seg: 10, rad: 5 })), M.bone); }
    add(hg, C('b:thumb' + s, () => strand([[0, -0.012, 0.022], [-s * 0.006, -0.032, 0.036], [s * 0.004, -0.05, 0.034]], 0.0055, 0.004, { seg: 8, rad: 5 })), M.bone);
  }
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    add(hp, longBone('fem', D.thigh, 0.017, 0.015), M.bone);
    add(kn, C('b:pat', () => new THREE.SphereGeometry(0.018, 10, 8)), M.boneD, [0, 0.0, 0.025], [0, 0, 0], [1, 1.2, 0.6]);
    add(kn, longBone('tib', D.shin, 0.016, 0.012), M.bone);
    add(kn, C('b:fib', () => strand([[-0.022, -0.02, -0.01], [-0.024, -D.shin * 0.5, -0.012], [-0.02, -D.shin + 0.02, -0.006]], 0.0065, 0.006, { seg: 8, rad: 5 })), M.boneD, [s > 0 ? 0.044 : 0, 0, 0], [0, 0, 0], [s, 1, 1]);
    add(ft, C('b:heel', () => new THREE.SphereGeometry(0.02, 10, 8)), M.bone, [0, -0.035, -0.02]);
    for (let k = 0; k < 4; k++) add(ft, C('b:toe' + k, () => strand([[0, -0.03, 0.0], [(k - 1.5) * 0.012, -0.045, 0.07], [(k - 1.5) * 0.015, -0.055, 0.13 - k * 0.008]], 0.006, 0.004, { seg: 8, rad: 5 })), M.bone);
  }
  /* ---------- 옷 · 무기 ---------- */
  const W = J.weapon;
  if (!gun) {
    // 붉은 두건: 머리 위를 덮는 천 + 뒤 매듭 + 두 꼬리 (로프)
    add(H, C('b:scarf', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = 0.22 + (Math.PI / 2 - 0.22) * v; const lo = 0.32 - 0.25 * Math.max(0, -Math.cos(az)); skullPt(az, Math.max(el, lo + (Math.PI / 2 - lo) * v), p); p.sub(HC).multiplyScalar(1.07).add(HC); }, 40, 10, { closedU: true, poles: [10] })), M.red);
    add(H, C('b:knot', () => new THREE.SphereGeometry(0.022, 12, 10)), M.red, [0, 0.13, -0.098], [0, 0, 0], [1.3, 1, 0.8]);
    for (const s of [-1, 1]) m.addRope({ n: 5, seg: 0.05, joint: H, local: new V3(s * 0.012, 0.125, -0.105), rest: new V3(s * 0.4, -1, -0.4), mat: M.red, prof: (v) => 0.016 - 0.004 * v, flat: 0.2, side: new V3(1, 0, 0), caps: 'none' });
    add(H, C('b:ear', () => new THREE.TorusGeometry(0.014, 0.0028, 6, 16)), M.gold, [0.072, 0.06, 0.0], [0, Math.PI / 2, 0]);
    // 찢어진 바지 (허벅지마다) + 허리띠
    add(J.hips, C('b:waist', () => loft((v) => ({ y: -0.07 + 0.12 * v, rx: 0.115, rzF: 0.085, rzB: 0.09, n: 2.2 }), 32, 3, { uvU: 2 })), M.pants);
    const sashP = (v) => ({ y: 0.02 + 0.06 * v, rx: 0.122, rzF: 0.092, rzB: 0.097, n: 2.3 });
    add(J.hips, C('b:sash', () => loft(sashP, 32, 2, { mod: (p, u, v) => { p.y += 0.008 * Math.sin(u * 19); } })), M.red);
    for (const s of [-1, 1]) m.addRope({ n: 6, seg: 0.055, joint: J.hips, local: new V3(s * 0.1, 0.03, 0.05), rest: new V3(s * 0.3, -1, 0.2), mat: M.red, prof: (v) => 0.02 - 0.006 * v, flat: 0.2, side: new V3(0, 0, 1), caps: 'none' });
    for (const [hp, s] of [[J.hipL, 1], [J.hipR, -1]]) add(hp, C('b:pant', () => loft((v) => ({ y: 0.06 - 0.36 * v, rx: 0.075 - 0.012 * v, rz: 0.072 - 0.01 * v }), 24, 6, { uvU: 1, mod: (p, u, v) => { if (v > 0.85) p.y += 0.03 * Math.abs(Math.sin(u * 23)) * (v - 0.85) * 6; } })), M.pants);
    // 커틀러스: 놋쇠 바구니 손잡이 · 휜 날
    add(W, C('b:grip', () => new THREE.CylinderGeometry(0.014, 0.016, 0.12, 10).rotateX(Math.PI / 2)), M.wood, [0, 0, 0.01]);
    add(W, C('b:pommel', () => new THREE.SphereGeometry(0.018, 10, 8)), M.brass, [0, 0, -0.06]);
    add(W, C('b:basket', () => { const g = new THREE.SphereGeometry(0.055, 14, 10, 0, Math.PI, 0, Math.PI * 0.7); g.rotateX(-Math.PI / 2); return g; }), M.brass, [0, -0.01, 0.07], [0, 0, Math.PI / 2]);
    add(W, C('b:blade', () => surf((u, v, p) => { const z = 0.08 + 0.72 * v, cy = 0.09 * v * v, w = 0.03 * (1 - 0.5 * smooth(0.7, 1, v)) + 0.004, t = u * TAU; p.set(Math.sin(t) * 0.003 * (1 - v * 0.5), cy + (Math.cos(t) > 0 ? Math.cos(t) * w : Math.cos(t) * 0.006), z); }, 10, 24, { closedU: true })), M.steel);
    m.tipK = 0.8;
  } else {
    // 프록코트: 몸통 (앞섶이 열려 늑골이 보인다) · 어깨 · 소매 · 커프스
    const cP = (v) => ({ y: -0.02 + 0.31 * v, rx: 0.13 + 0.015 * Math.sin(v * Math.PI), rzF: 0.092, rzB: 0.098, n: 2.2 });
    add(J.chest, C('b:coat', () => loft(cP, 40, 10, { a0: 0.58, a1: 1.42, uvU: 1 })), M.coat);
    lRim(J.chest, 'b:coatCol', cP, 1, 0.012, M.gold, { a0: 0.58, a1: 1.42 });
    add(J.spine, C('b:coatW', () => loft((v) => ({ y: -0.05 + 0.27 * v, rx: 0.12, rzF: 0.088, rzB: 0.094, n: 2.2 }), 36, 6, { a0: 0.6, a1: 1.4, uvU: 1 })), M.coat);
    add(J.hips, C('b:coatH', () => loft((v) => ({ y: 0.06 - 0.2 * v, rx: 0.13 + 0.05 * v, rzF: 0.1 + 0.03 * v, rzB: 0.11 + 0.04 * v, n: 2.2 }), 36, 5, { a0: 0.62, a1: 1.38, uvU: 1 })), M.coat);
    // 뒤 코트 자락 두 장 (로프 리본)
    for (const s of [-1, 1]) m.addRope({ n: 6, seg: 0.08, joint: J.hips, local: new V3(s * 0.065, -0.12, -0.12), rest: new V3(s * 0.1, -1, -0.25), mat: M.coat, prof: (v) => 0.06 + 0.012 * v, flat: 0.12, side: new V3(1, 0, 0), caps: 'legs', stiff: 0.25 });
    // 탄띠 (오른 어깨 → 왼 허리) + 화약통 + 허리띠
    { const pts = []; for (let i = 0; i <= 12; i++) { const v = i / 12, u = 0.62 - 0.28 * v, q = loftAt(cP, u, 0.95 - 0.95 * v, new V3()); const l = Math.hypot(q.x, q.z); q.x *= (l + 0.01) / l; q.z *= (l + 0.01) / l; pts.push(q); }
      add(J.chest, C('b:bando', () => strand(pts, 0.016, 0.016, { seg: 30, rad: 6, flat: 0.25 })), M.leather);
      for (let k = 0; k < 4; k++) add(J.chest, C('b:shell', () => new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8)), M.brass, pts[3 + k * 2].toArray()); }
    add(J.hips, C('b:belt', () => loft((v) => ({ y: 0.03 + 0.04 * v, rx: 0.135, rzF: 0.105, rzB: 0.115, n: 2.3 }), 32, 2)), M.leather);
    add(J.hips, C('b:buck', () => new THREE.BoxGeometry(0.04, 0.035, 0.01)), M.gold, [0, 0.05, 0.108]);
    add(J.hips, C('b:flask', () => lathe([[0, -0.05], [0.03, -0.04], [0.035, 0.0], [0.02, 0.04], [0.01, 0.06], [0, 0.065]], 12)), M.brass, [0.13, -0.04, 0.03], [0, 0, 0.3]);
    for (const [sh, el, s] of [[J.shoulderL, J.elbowL, 1], [J.shoulderR, J.elbowR, -1]]) {
      add(sh, C('b:epau', () => { const g = new THREE.SphereGeometry(0.06, 14, 10, 0, TAU, 0, Math.PI / 2); g.scale(1.1, 0.6, 1); return g; }), M.coat, [s * 0.01, 0.01, 0]);
      add(sh, C('b:slv', () => loft((v) => ({ y: 0.02 - (D.uArm + 0.02) * v, rx: 0.048 - 0.006 * v, rz: 0.046 - 0.006 * v }), 18, 5)), M.coat);
      const cuf = (v) => ({ y: -0.0 - 0.1 * v, rx: 0.046 + 0.012 * v, rz: 0.044 + 0.012 * v });
      add(el, C('b:fslv', () => loft((v) => ({ y: 0.02 - 0.14 * v, rx: 0.044, rz: 0.042 }), 18, 4)), M.coat);
      add(el, C('b:cuff', () => loft(cuf, 18, 3)), M.coatIn, [0, -0.11, 0]); lRim(el, 'b:cuffR', (v) => ({ ...cuf(v), y: cuf(v).y - 0.11 }), 1, 0.005, M.gold);
    }
    for (const [kn, ft] of [[J.kneeL, J.footL], [J.kneeR, J.footR]]) {
      const bP = (v) => ({ y: -0.08 - (D.shin - 0.05) * v, rx: 0.048 - 0.008 * v, rzF: 0.05 - 0.006 * v, rzB: 0.056 - 0.01 * v });
      add(kn, C('b:boot', () => loft(bP, 20, 6)), M.leather);
      add(kn, C('b:bootTop', () => loft((v) => ({ y: 0.03 - 0.12 * v, rx: 0.062 - 0.012 * v, rzF: 0.066 - 0.012 * v, rzB: 0.06 - 0.01 * v }), 20, 3)), M.leather);
      add(ft, C('b:shoe', () => surf((u, v, p) => { const a = u * TAU, w = 0.042 * Math.sin(Math.min(1, v * 1.3 + 0.25) * Math.PI * 0.9) + 0.01, h = 0.05 * (1 - v * 0.55); p.set(Math.cos(a) * w, -0.055 + h / 2 + Math.sin(a) * h / 2, -0.05 + 0.2 * v); }, 18, 10, { closedU: true })), M.leather);
    }
    // 삼각모: 세 귀퉁이가 올라간 챙 + 높은 머리 · 금 테 · 깃털
    const hat = new THREE.Group(); hat.position.set(0, 0.185, -0.005); hat.rotation.x = -0.12; H.add(hat);
    const brim = (u, v, p) => { const a = u * TAU, r = 0.07 + 0.11 * v, up = 0.07 * v * v * (0.5 + 0.5 * Math.cos(3 * a)); p.set(Math.sin(a) * r, up, Math.cos(a) * r * 0.95); };
    add(hat, C('b:brim', () => surf(brim, 60, 6)), M.hat);
    { const e = []; for (let i = 0; i < 60; i++) { const p = new V3(); brim(i / 60, 1, p); e.push(p); } rim(hat, 'b:brimR', e, 0.005, true, M.gold); }
    add(hat, C('b:crown', () => lathe([[0.078, 0], [0.08, 0.04], [0.072, 0.08], [0.05, 0.1], [0, 0.105]], 24)), M.hat);
    add(hat, C('b:plume', () => strand([[0.06, 0.03, -0.03], [0.12, 0.08, -0.09], [0.14, 0.12, -0.18], [0.1, 0.1, -0.26]], 0.025, 0.004, { seg: 16, rad: 6, flat: 0.25, ref: [0, 1, 0] })), M.feather);
    // 플린트락 권총: 개머리 · 총열 · 공이 · 금 장식
    add(W, C('b:stock', () => strand([[0, -0.06, -0.06], [0, -0.02, -0.02], [0, 0.0, 0.04], [0, 0.01, 0.12]], 0.022, 0.016, { seg: 10, rad: 8, flat: 0.6, ref: [1, 0, 0] })), M.wood);
    add(W, C('b:barrel', () => new THREE.CylinderGeometry(0.012, 0.014, 0.3, 10).rotateX(Math.PI / 2)), M.iron, [0, 0.022, 0.22]);
    add(W, C('b:muzz', () => new THREE.TorusGeometry(0.014, 0.004, 6, 12)), M.gold, [0, 0.022, 0.37]);
    add(W, C('b:lock', () => new THREE.BoxGeometry(0.012, 0.03, 0.05)), M.brass, [0.012, 0.01, 0.05]);
    add(W, C('b:ham', () => strand([[0, 0, 0], [0, 0.02, -0.01], [0, 0.03, 0.004]], 0.005, 0.004, { seg: 6, rad: 5 })), M.iron, [0.012, 0.025, 0.03]);
    add(W, C('b:cap', () => new THREE.SphereGeometry(0.02, 10, 8)), M.gold, [0, -0.06, -0.065]);
    m.tipK = 0.38;
    // 왼손 둘째 권총 (허리춤에)
    add(J.hips, C('b:holst', () => new THREE.CylinderGeometry(0.012, 0.014, 0.22, 10)), M.iron, [-0.135, -0.06, 0.04], [0.3, 0, -0.2]);
  }
  /* 매 프레임: 턱 덜그럭 · 눈빛 · 물리 */
  let t = 0;
  m.update = (dt, f) => {
    t += dt; const act = f.state === 'act';
    sk.jaw.rotation.x = act ? 0.35 + 0.1 * Math.sin(t * 30) : 0.08 + 0.06 * Math.max(0, Math.sin(t * 2.3)) ** 6;
    const k = 0.45 + 0.15 * Math.sin(t * 5 + (f.id || 0)); sk.eyes.forEach((e) => (e.material.opacity = act ? 0.8 : k));
    m.stepPhys(dt, f);
  };
  m.sole = gun ? 0.06 : 0.055;
  m.tipPos = (out = new V3()) => (gun ? W.localToWorld(out.set(0, 0.022, 0.39)) : W.localToWorld(out.set(0, 0.06, 0.8)));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.1)); W.localToWorld(tt.set(0, gun ? 0.02 : 0.08, gun ? 0.38 : 0.8)); };
  return m;
}
