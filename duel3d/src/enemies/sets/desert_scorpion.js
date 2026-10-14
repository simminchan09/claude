// 거대 독전갈 — 모래 속 사냥꾼 (원거리)
// 몸 구조: 휴머노이드 리그의 골반을 앞으로 90° 눕혀 몸통을 수평으로 (골반 좌표: +Y = 앞, +Z = 아래, +X = 왼쪽)
//   팔 = 집게발(촉지), 리그 다리 = 몸 아래 보이지 않는 접지 기준, 걷는 다리 3쌍은 절차적 IK (삼각 보행)
// 구성: 광택 키틴 등판 (두흉갑 · 눈 언덕의 빛나는 중앙 눈 · 옆눈) · 겹친 배 마디 7장 (용골 · 테두리)
//       굵은 집게 (손바닥 마디 + 고정 · 움직이는 손가락, 안쪽 톱니) · 다섯 마디 꼬리 + 독주머니(빛) + 휜 독침
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, strand, spl, lathe, gauss, smooth, envCube } from '../../sculpt.js';
import { V3, TAU, C, cv, tex, rng, T, shared, phys, std, add, normalFrom, ik2 } from './desert_kit.js';

export const SCORP_DIMS = { hipH: 0.42, spineL: 0.2, chestL: 0.26, neckL: 0.04, shW: 0.12, uArm: 0.2, lArm: 0.17, hipW: 0.08, thigh: 0.13, shin: 0.13, headTop: 0.08 };
const D = SCORP_DIMS, P = Math.PI / 2;

/* ---------- 텍스처: 얼룩진 키틴 (마디 가장자리 어둡게) ---------- */
function chitinCanvas(hgt) {
  const W = 256, H = 256, [c, g] = cv(W, H), r = rng(hgt ? 21 : 17);
  g.fillStyle = hgt ? '#808080' : '#a8542a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H, rr = 2 + r() * 9; for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { g.fillStyle = hgt ? `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.25)` : r() < 0.5 ? 'rgba(30,12,4,0.35)' : 'rgba(170,90,40,0.25)'; g.beginPath(); g.arc(x + ox, y + oy, rr, 0, TAU); g.fill(); } }
  // 마디 테두리 (v 방향으로 4줄)
  for (let k = 0; k < 4; k++) { const y = (k / 4) * H, gr = g.createLinearGradient(0, y, 0, y + H / 4); gr.addColorStop(0, hgt ? 'rgba(0,0,0,0.9)' : 'rgba(20,8,2,0.75)'); gr.addColorStop(0.12, 'rgba(0,0,0,0)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, hgt ? 'rgba(255,255,255,0.5)' : 'rgba(150,80,40,0.35)'); g.fillStyle = gr; g.fillRect(0, y, W, H / 4); }
  return c;
}
function scorpMats(pal) {
  return shared('scorp:' + pal.accent, () => {
    const env = envCube(), n = T('chitN', () => normalFrom(chitinCanvas(true), 2.2));
    const M = {
      shell: phys({ map: T('chit', () => tex(chitinCanvas(false))), normalMap: n, color: 0xffd8c0, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.25, envMap: env, envMapIntensity: 0.6 }),
      dark: phys({ color: 0x4a2412, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.3, envMap: env, envMapIntensity: 0.5 }),
      belly: std({ color: 0xb08850, roughness: 0.6 }),
      claw: phys({ color: 0x1a0c06, roughness: 0.3, clearcoat: 1, envMap: env, envMapIntensity: 0.8 }),
      venom: phys({ color: 0x3a6a10, emissive: pal.accent, emissiveIntensity: 1.3, roughness: 0.15, clearcoat: 1, transmission: 0, transparent: true, opacity: 0.92 }),
      eye: new THREE.MeshBasicMaterial({ color: pal.accent }),
      eyeGlow: new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    return M;
  });
}

// 등판 단면: y = 몸 길이 방향(앞 +), rx = 반폭, rzB = 등 높이(-Z), rzF = 배 높이(+Z)
export function buildScorpion(pal, scale = 1) {
  const m = buildHumanoid(D), J = m.J, M = scorpMats(pal);
  /* 배 마디 7장 (골반 기준, 뒤 → 앞) */
  const segN = 7, y0 = -0.27, y1 = 0.24;
  for (let i = 0; i < segN; i++) {
    const a = y0 + (y1 - y0) * (i / segN), b = y0 + (y1 - y0) * ((i + 1) / segN) + 0.02, k = i / (segN - 1), w = 0.11 + 0.06 * Math.sin(Math.PI * (0.25 + k * 0.6)), hb = 0.058 + 0.018 * Math.sin(Math.PI * (0.2 + k * 0.6));
    const prof = (v) => { const lip = smooth(0.75, 1, v); return { y: a + (b - a) * v, rx: w * (0.94 + 0.08 * lip), rzB: hb * (0.92 + 0.1 * lip), rzF: 0.04 + 0.01 * k, n: 2.4 }; };
    add(J.hips, C('s:terg' + i, () => loft(prof, 28, 6, { mod: (p, u, v, c, sn) => { if (sn < -0.6) p.z -= 0.012 * gauss(c, 0.12); /* 등 용골 */ }, uvU: 1, uvV: 0.25 })), M.shell);
  }
  // 배 아래 판 (밝은 색)
  add(J.hips, C('s:ster', () => loft((v) => ({ y: y0 + 0.02 + (y1 - y0 - 0.04) * v, rx: 0.1 * Math.sin(Math.PI * (0.15 + v * 0.7)), rzF: 0.046, rzB: 0.01, n: 2.2 }), 20, 10)), M.belly);
  /* 두흉갑 (가슴 기준) · 눈 */
  const cP = (v) => ({ y: -0.06 + 0.3 * v, rx: 0.13 - 0.05 * v * v, rzB: 0.07 - 0.03 * v, rzF: 0.045, n: 2.6 });
  add(J.chest, C('s:cara', () => loft(cP, 32, 12, { mod: (p, u, v, c, sn) => { if (sn < 0) p.z += 0.012 * gauss(Math.abs(c) - 0.45, 0.15) * -sn; /* 양쪽 홈 */ }, uvU: 1, uvV: 0.4 })), M.shell);
  add(J.chest, C('s:mound', () => new THREE.SphereGeometry(0.03, 14, 10)), M.dark, [0, 0.13, -0.065], [0, 0, 0], [1, 1.3, 0.7]);
  for (const s of [-1, 1]) {
    add(J.chest, C('s:eyeM', () => new THREE.SphereGeometry(0.011, 10, 8)), M.eye, [s * 0.014, 0.15, -0.084]);
    const g = add(J.chest, C('s:eyeG', () => new THREE.SphereGeometry(0.024, 10, 8)), M.eyeGlow, [s * 0.014, 0.15, -0.084]); g.renderOrder = 4;
    for (let k = 0; k < 3; k++) add(J.chest, C('s:eyeL', () => new THREE.SphereGeometry(0.0065, 8, 6)), M.eye, [s * (0.068 + k * 0.008), 0.215 - k * 0.012, -0.03]);
    // 협각 (작은 앞 집게)
    add(J.chest, C('s:chel' + s, () => strand([[s * 0.02, 0.22, 0.0], [s * 0.026, 0.27, 0.01], [s * 0.016, 0.3, 0.02]], 0.016, 0.006, { seg: 8, rad: 8 })), M.dark);
  }
  /* 집게발 (팔 리그) */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('s:pe1', () => new THREE.SphereGeometry(0.038, 12, 10)), M.dark);
    add(sh, C('s:hum', () => loft((v) => ({ y: -D.uArm * v, rx: 0.03 + 0.006 * Math.sin(v * Math.PI), rz: 0.026 + 0.005 * Math.sin(v * Math.PI) }), 14, 8, { uvV: 0.3 })), M.shell);
    add(el, C('s:pe2', () => new THREE.SphereGeometry(0.032, 12, 10)), M.dark);
    add(el, C('s:pat', () => loft((v) => ({ y: -D.lArm * v, rx: 0.032 + 0.01 * v, rz: 0.028 + 0.006 * v }), 14, 8, { uvV: 0.3 })), M.shell);
    // 집게: 손바닥 마디(부풀었다가 손가락으로) — 손 기준 -Y 가 앞
    const ch = new THREE.Group(); ch.scale.setScalar(1.45); ha.add(ch);
    const man = (v) => ({ y: 0.01 - 0.15 * v, rx: (0.05 + 0.03 * Math.sin(Math.PI * Math.min(1, v * 1.2))) * (1 - 0.25 * v), rz: 0.04 + 0.016 * Math.sin(Math.PI * Math.min(1, v * 1.1)), cx: s * 0.006 * v });
    add(ch, C('s:manus' + s, () => loft(man, 22, 10, { uvV: 0.4, mod: (p, u, v, c) => { p.x += s * 0.008 * gauss(c - s, 0.4) * Math.sin(v * Math.PI); } })), M.shell);
    // 고정 손가락 (바깥쪽) · 움직이는 손가락 (안쪽, 경첩 회전)
    const finger = (key, side, len) => strand([[side * 0.026, -0.13, 0], [side * 0.03, -0.18, 0.002], [side * 0.018, -0.13 - len * 0.85, 0], [-side * 0.006, -0.13 - len, -0.002]], 0.03, 0.004, { seg: 14, rad: 8 });
    add(ch, C('s:fixF' + s, () => finger('f', s, 0.15)), M.dark);
    const mv = new THREE.Group(); mv.position.set(-s * 0.02, -0.13, 0); ch.add(mv); m['pinch' + (s > 0 ? 'L' : 'R')] = mv;
    add(mv, C('s:movF' + s, () => strand([[0, 0, 0], [-s * 0.012, -0.05, 0.002], [-s * 0.004, -0.11, 0], [s * 0.02, -0.15, -0.002]], 0.026, 0.004, { seg: 14, rad: 8 })), M.dark);
    for (let k = 0; k < 4; k++) add(mv, C('s:tooth', () => new THREE.ConeGeometry(0.004, 0.012, 5)), M.belly, [s * 0.004 - s * 0.002 * k, -0.03 - k * 0.025, 0], [0, 0, -s * Math.PI / 2]);
  }
  /* 걷는 다리 3쌍 (절차적 IK). 각 다리: root(넓적다리 방향) → knee(정강이) */
  const legs = [], LA = 0.19, LB = 0.27;
  const femurG = C('s:femur', () => loft((v) => ({ y: LA * v, rx: 0.024 - 0.006 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.028 - 0.006 * v }), 12, 6, { uvV: 0.3 }).rotateX(Math.PI / 2));
  const tibiaG = C('s:tibia', () => { const g = strand([[0, 0, 0], [0, 0.004, LB * 0.45], [0, -0.004, LB * 0.85], [0, -0.012, LB]], 0.021, 0.004, { seg: 12, rad: 7 }); return g; });
  const jointG = C('s:legJ', () => new THREE.SphereGeometry(0.02, 10, 8));
  const roots = [[J.chest, 0.15, 1.0], [J.chest, 0.02, 0.35], [J.spine, 0.06, -0.35]];
  roots.forEach(([jn, y, splay], pi) => { for (const s of [-1, 1]) {
    const anchor = new THREE.Object3D(); anchor.position.set(s * 0.1, y, 0.02); jn.add(anchor);
    const root = new THREE.Group(); anchor.add(root); add(root, jointG, M.dark); add(root, femurG, M.shell);
    const knee = new THREE.Group(); knee.position.set(0, 0, LA); root.add(knee); add(knee, jointG, M.dark, [0, 0, 0], [0, 0, 0], 0.85); add(knee, tibiaG, M.shell);
    legs.push({ anchor, root, knee, s, splay, ph: (pi % 2 === 0) === (s > 0) ? 0 : Math.PI, foot: new V3(), init: false });
  } });
  /* 꼬리 (골반 뒤 → 위로 말려 앞을 겨눔) */
  const tail = [], segL = [0.1, 0.1, 0.105, 0.11, 0.115];
  let par = new THREE.Group(); par.position.set(0, y0 + 0.01, -0.03); J.hips.add(par); tail.push(par);
  segL.forEach((L, i) => {
    const r0 = 0.05 - i * 0.004, prof = (v) => ({ y: -L * v, rx: r0 * (0.86 + 0.14 * Math.sin(Math.PI * v)), rzB: r0 * (0.95 + 0.12 * Math.sin(Math.PI * v)), rzF: r0 * 0.85, n: 2.3 });
    add(par, C('s:tseg' + i, () => loft(prof, 18, 6, { mod: (p, u, v, c, sn) => { if (sn < -0.5) p.z -= 0.008 * gauss(Math.abs(c) - 0.3, 0.12); }, uvV: 0.25 })), M.shell);
    add(par, C('s:tj', () => new THREE.SphereGeometry(0.036, 10, 8)), M.dark, [0, -L, 0]);
    const g = new THREE.Group(); g.position.set(0, -L, 0); par.add(g); tail.push(g); par = g;
  });
  // 독주머니 + 독침
  add(par, C('s:ves', () => { const g = new THREE.SphereGeometry(0.05, 16, 12); g.scale(0.9, 1.25, 1); g.translate(0, -0.05, 0); return g; }), M.venom);
  add(par, C('s:acul', () => strand([[0, -0.09, 0], [0, -0.13, 0.015], [0, -0.155, 0.05], [0, -0.15, 0.085]], 0.018, 0.0015, { seg: 14, rad: 8 })), M.claw);
  const stingTip = new THREE.Object3D(); stingTip.position.set(0, -0.15, 0.09); par.add(stingTip);
  const tailBase = [1.3, 0.55, 0.6, 0.66, 0.7, 0.6];
  /* 매 프레임: 다리 IK · 꼬리 · 집게 */
  let t = 0; const tw = new V3(), fw = new V3(), rt = new V3();
  m.update = (dt, f) => {
    t += dt; const sc = f.scale, mv = Math.hypot(f.vel.x, f.vel.z), act = f.state === 'act' ? f.actName : '', at = f.at || 0;
    // 꼬리: 대기 흔들림 · 독침 사격(s1) 때 뒤로 젖혔다가 앞으로 내지름 · 찌르기(heavy)
    let curl = 0;
    if (act === 's1') curl = at < 0.55 ? -0.35 * smooth(0, 0.5, at) : -0.35 + 0.75 * smooth(0.55, 0.7, at) - 0.4 * smooth(0.8, 1.1, at);
    if (act === 'heavy') curl = at < 0.5 ? -0.3 * smooth(0, 0.45, at) : -0.3 + 1.2 * smooth(0.5, 0.62, at) - 0.9 * smooth(0.8, 1.2, at);
    for (let i = 0; i < tail.length; i++) { tail[i].rotation.x = tailBase[i] + curl * (i ? 0.22 : 0.5) + Math.sin(t * 2.1 + i * 0.6) * 0.03; tail[i].rotation.y = Math.sin(t * 1.3 + i) * 0.04; }
    // 집게: 공격 중 벌렸다 닫음
    const open = act === 'light1' ? (at < 0.4 ? 0.7 : 0.05) : 0.12 + 0.08 * Math.sin(t * 3);
    if (m.pinchL) { m.pinchL.rotation.z = open * 0.6; m.pinchR.rotation.z = -open * 0.6; }
    // 다리: 몸 옆 바닥에 발 기준점 → 움직이면 삼각 보행
    m.root.updateMatrixWorld(true); f.fwd(fw); const right = f.right(new V3()), gy = f.pos.y + 0.012 * sc;
    const stride = Math.min(1, mv / 3) * 0.1 * sc, cyc = f.runP * 0.85;
    for (const L of legs) {
      L.anchor.getWorldPosition(rt);
      const home = tw.copy(rt).addScaledVector(right, -L.s * 0.34 * sc).addScaledVector(fw, L.splay * 0.2 * sc); home.y = gy;
      const ph = cyc + L.ph, lift = mv > 0.3 ? Math.max(0, Math.cos(ph)) * 0.07 * sc : 0;
      home.addScaledVector(fw, mv > 0.3 ? Math.sin(ph) * stride : 0); home.y += lift;
      if (f.state === 'down' || f.state === 'ko') home.y = rt.y - 0.05 * sc;
      L.foot.copy(home);
      ik2(L.root, L.knee, L.foot, LA, LB, 0);
    }
  };
  m.sole = 0.0;
  m.tipPos = (out = new V3()) => stingTip.getWorldPosition(out);
  m.weaponPts = (b, tt) => { J.handR.localToWorld(b.set(0, -0.05, 0)); J.handR.localToWorld(tt.set(0, -0.26, 0)); };
  m.extras = [];
  return m;
}

// 전갈 자세: 골반 90° 눕힘 · 리그 다리는 수직(접지 기준) · 집게는 앞으로 내밀어 안쪽으로 굽힘
const ZL = Math.PI - 0.75;
export function scorpPoses() {
  const legs = { hipL: [-P, 0, 0], kneeL: [0, 0, 0], footL: [0, 0, 0], hipR: [-P, 0, 0], kneeR: [0, 0, 0], footR: [0, 0, 0] };
  const base = { hips: [P, 0, 0], spine: [0, 0, 0], chest: [-0.04, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], shoulderL: [-0.35, 0, ZL], elbowL: [0, 0, 0.62], handL: [0.15, 0, 0.12], shoulderR: [-0.35, 0, -ZL], elbowR: [0, 0, -0.62], handR: [0.15, 0, -0.12], weapon: [0, 0, 0], ...legs };
  return {
    base,
    run: { chest: [0.02, 0, 0] },
    jump: { chest: [-0.12, 0, 0], shoulderL: [-0.6, 0, ZL], shoulderR: [-0.6, 0, -ZL] },
    guard: { shoulderL: [-0.75, 0, ZL - 0.25], elbowL: [0, 0, 1.6], shoulderR: [-0.75, 0, -ZL + 0.25], elbowR: [0, 0, -1.6] },
    hit: { chest: [-0.15, 0.15, 0], spine: [-0.08, 0, 0], shoulderL: [-0.1, 0, ZL + 0.3], shoulderR: [-0.1, 0, -ZL - 0.3] },
    air: { hips: [P - 0.3, 0, 0.25], shoulderL: [0.1, 0, ZL + 0.4], shoulderR: [0.1, 0, -ZL - 0.4] },
    down: { hipY: -0.32, hips: [P, 0, 0.5], chest: [0.1, 0, 0], ...legs, hipL: [-P + 0.6, 0, 0], hipR: [-P + 0.6, 0, 0] },
    dash: { chest: [0.05, 0, 0], shoulderL: [-0.2, 0, ZL + 0.2], shoulderR: [-0.2, 0, -ZL - 0.2] },
    win: { chest: [-0.2, 0, 0], shoulderL: [-0.9, 0, ZL - 0.2], shoulderR: [-0.9, 0, -ZL + 0.2] },
    portrait: { chest: [-0.12, 0.2, 0] },
    crouch: { hipY: -0.12, ...legs },
  };
}
// 보행: 다리는 IK 가 처리하므로 몸만 살짝 출렁
export function scorpRun(out, ph) { out[0] += Math.abs(Math.sin(ph)) * 0.012; }
