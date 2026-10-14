// 몬스터 몸 형태(body plan): 네발 짐승 · 전갈 · 켄타우로스 · 거구(골렘/오우거/메크) · 떠다니는 자(로브/유령/드레스) · 드론
// 모두 같은 휴머노이드 관절 리그를 쓰되, 치수(dims)와 기본 자세를 바꿔 전혀 다른 몸으로 만든다.
//   네발: 골반을 앞으로 90° 숙여 몸통을 수평으로 눕히고, 팔 = 앞다리 · 다리 = 뒷다리, 목을 들어 머리를 세운다.
//   떠다니는 자: 다리를 긴 옷자락 속에 감추고 sole 을 음수로 해 공중에 뜬다.
import * as THREE from 'three';
import { buildHumanoid, JI } from '../rig.js';

const TAU = Math.PI * 2, V3 = THREE.Vector3;
export function mats(pal, o = {}) {
  return {
    body: new THREE.MeshStandardMaterial({ color: pal.body ?? 0x15121c, metalness: o.metal ?? 0.2, roughness: o.rough ?? 0.6, flatShading: !!o.flat }),
    shell: new THREE.MeshStandardMaterial({ color: pal.armor, metalness: o.metal ?? 0.3, roughness: o.rough ?? 0.45, flatShading: o.flat ?? false }),
    glow: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: pal.accent, emissiveIntensity: 2.6 }),
    trim: new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xc8a050, metalness: 0.8, roughness: 0.3 }),
    cloth: new THREE.MeshStandardMaterial({ color: pal.cloth ?? pal.armor, roughness: 0.85, side: THREE.DoubleSide }),
    bone: new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 }),
    ghost: new THREE.MeshStandardMaterial({ color: pal.cloth ?? pal.armor, emissive: pal.accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  };
}
export const adder = (parent, g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(g, mat); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); parent.add(me); return me; };
const cap = (r, l) => new THREE.CapsuleGeometry(r, Math.max(0.01, l), 5, 10);
const limb = (parent, len, r, mat, r2) => { const g = r2 ? new THREE.CylinderGeometry(r2, r, len, 10) : cap(r, len - r * 2); return adder(parent, g, mat, 0, -len / 2, 0); };

/* =====================================================================
   네발 짐승: kind = 'fox' · 'wolf' · 'lion' · 'scorpion' · 'centaur'
   ===================================================================== */
export const QUAD_DIMS = { hipH: 0.62, spineL: 0.26, chestL: 0.3, neckL: 0.16, shW: 0.13, uArm: 0.27, lArm: 0.26, hipW: 0.12, thigh: 0.3, shin: 0.28, headTop: 0.2 };
const SCORP_DIMS = { hipH: 0.42, spineL: 0.22, chestL: 0.28, neckL: 0.06, shW: 0.2, uArm: 0.24, lArm: 0.22, hipW: 0.16, thigh: 0.22, shin: 0.2, headTop: 0.1 };
const CENT_DIMS = { hipH: 0.95, spineL: 0.36, chestL: 0.34, neckL: 0.62, shW: 0.15, uArm: 0.42, lArm: 0.4, hipW: 0.15, thigh: 0.46, shin: 0.44, headTop: 0.24 };
export function buildQuad(pal, o = {}) {
  const kind = o.kind || 'wolf', D = kind === 'scorpion' ? SCORP_DIMS : kind === 'centaur' ? CENT_DIMS : QUAD_DIMS;
  const m = buildHumanoid(D), J = m.J, M = mats(pal, o), add = adder;
  const fur = kind === 'fox' ? M.shell : M.body, fat = kind === 'lion' ? 1.35 : kind === 'centaur' ? 1.35 : kind === 'scorpion' ? 1.3 : kind === 'fox' ? 1.25 : 1.2;
  const tails = []; let tip = null, jaw = null;
  // 몸통 (골반 → 등 → 가슴: 자세에서 수평으로 눕는다)
  if (kind === 'scorpion') {
    for (const [j, y, r] of [[J.hips, 0.0, 0.17], [J.spine, 0.12, 0.2], [J.chest, 0.14, 0.18]]) { const s = add(j, new THREE.SphereGeometry(r, 12, 8), M.shell, 0, y, 0); s.scale.set(1.35, 1.1, 0.55); }
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const g = new THREE.Group(); g.position.set(sd * 0.2, 0.05 + i * 0.12, 0); g.rotation.set(0, 0, sd * 1.0); J.spine.add(g); add(g, new THREE.CylinderGeometry(0.018, 0.012, 0.36, 6), M.shell, 0, -0.18, 0); }
  } else {
    add(J.hips, new THREE.SphereGeometry(0.16 * fat, 14, 10), fur, 0, 0.02, 0).scale.set(1, 1, 0.95);
    add(J.spine, cap(0.15 * fat, D.spineL * 0.9), fur, 0, D.spineL * 0.5, 0).scale.set(1, 1, 0.92);
    add(J.chest, cap(0.17 * fat, D.chestL * 0.6), fur, 0, D.chestL * 0.42, 0).scale.set(1.02, 1, 1.05);
    if (kind === 'fox') add(J.chest, new THREE.SphereGeometry(0.13, 10, 8), M.bone, 0, D.chestL * 0.6, 0.11).scale.set(1, 1.3, 0.7); // 흰 가슴털
    if (kind === 'lion') for (let i = 0; i < 4; i++) add(J.spine, new THREE.DodecahedronGeometry(0.06, 0), M.glow, 0, 0.08 + i * 0.07, -0.16 * fat); // 등의 빛나는 문양
  }
  // 다리 (앞다리 = 팔, 뒷다리 = 다리)
  const legR = kind === 'centaur' ? 0.075 : kind === 'lion' ? 0.085 : kind === 'scorpion' ? 0.03 : 0.068;
  for (const [a, b, c] of [[J.shoulderL, J.elbowL, J.handL], [J.shoulderR, J.elbowR, J.handR]]) {
    limb(a, D.uArm, legR * 1.15, fur); limb(b, D.lArm, legR * 0.8, kind === 'scorpion' ? M.shell : fur, legR * 0.7);
    if (kind === 'scorpion') { for (const sd of [-1, 1]) add(c, new THREE.ConeGeometry(0.035, 0.22, 5), M.shell, sd * 0.03, -0.02, 0.1, Math.PI / 2 + 0.3, 0, sd * 0.4); add(c, new THREE.SphereGeometry(0.07, 8, 6), M.shell, 0, 0, 0).scale.set(1, 0.7, 1.3); }
    else add(c, new THREE.SphereGeometry(legR * 1.2, 8, 6), kind === 'centaur' ? M.trim : M.body, 0, -0.01, 0.03).scale.set(1, 0.6, 1.4);
  }
  for (const [a, b, c] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    limb(a, D.thigh, legR * 1.6, fur, legR); limb(b, D.shin, legR * 0.8, kind === 'scorpion' ? M.shell : fur, legR * 0.65);
    if (kind !== 'scorpion') add(c, new THREE.SphereGeometry(legR * 1.2, 8, 6), kind === 'centaur' ? M.trim : M.body, 0, -0.01, 0.03).scale.set(1, 0.6, 1.4);
  }
  // 꼬리 (골반에서 뒤로: 골반 로컬 -Y = 뒤, x 회전 + = 위로 휨)
  const tailChain = (n, seg, r0, mat, curl, spread = 0) => {
    const root = new THREE.Group(); root.position.set(0, -0.12, 0); root.rotation.set(0.5, 0, spread); J.hips.add(root); let p = root;
    for (let i = 0; i < n; i++) { const g = new THREE.Group(); if (i) g.position.y = -seg; g.rotation.x = curl; p.add(g); add(g, cap(r0 * (1 - i / (n + 1) * 0.8), seg * 0.7), mat, 0, -seg / 2, 0); p = g; }
    tails.push(root); return p;
  };
  if (kind === 'fox') {
    const n = o.tails || 1;
    for (let k = 0; k < n; k++) { const sp = n > 1 ? (k - (n - 1) / 2) * 0.3 : 0, end = tailChain(6, 0.15, 0.12, M.shell, 0.24, sp); add(end, new THREE.SphereGeometry(0.07, 8, 6), M.glow, 0, -0.12, 0).scale.set(1, 1.6, 1); }
  } else if (kind === 'wolf') tailChain(4, 0.12, 0.06, fur, 0.18);
  else if (kind === 'lion') { const end = tailChain(5, 0.12, 0.03, fur, 0.2); add(end, new THREE.SphereGeometry(0.06, 8, 6), M.cloth, 0, -0.1, 0); }
  else if (kind === 'centaur') { const end = tailChain(3, 0.16, 0.05, M.cloth, 0.3); add(end, new THREE.ConeGeometry(0.08, 0.4, 6), M.cloth, 0, -0.2, 0, Math.PI); }
  else if (kind === 'scorpion') { // 독침 꼬리: 등 위로 크게 휘어 앞을 겨눈다
    const root = new THREE.Group(); root.position.set(0, -0.12, 0); root.rotation.set(1.3, 0, 0); J.hips.add(root); let p = root;
    for (let i = 0; i < 6; i++) { const g = new THREE.Group(); if (i) g.position.y = -0.12; g.rotation.x = 0.42; p.add(g); add(g, new THREE.SphereGeometry(0.07 - i * 0.006, 8, 6), M.shell, 0, -0.06, 0).scale.set(1, 1.3, 1); p = g; }
    add(p, new THREE.SphereGeometry(0.07, 8, 6), M.glow, 0, -0.12, 0); add(p, new THREE.ConeGeometry(0.025, 0.16, 6), M.trim, 0, -0.22, 0, Math.PI);
    tip = new THREE.Object3D(); tip.position.set(0, -0.3, 0); p.add(tip); tails.push(root);
  }
  // 머리 (목을 세워 정면을 본다)
  const H = J.head;
  if (kind === 'centaur') { // 사람 상체: 목 관절 = 허리, 머리 관절 = 머리
    add(J.neck, cap(0.15, 0.28), M.shell, 0, 0.28, 0).scale.set(1.15, 1, 0.8); // 흉갑
    add(J.neck, new THREE.SphereGeometry(0.1, 10, 8), M.trim, 0, 0.42, 0.11).scale.set(1, 0.8, 0.5);
    for (const sd of [-1, 1]) { add(J.neck, new THREE.SphereGeometry(0.09, 10, 8), M.trim, sd * 0.22, 0.5, 0); add(J.neck, cap(0.05, 0.3), M.body, sd * 0.24, 0.32, 0.12, -1.2, 0, sd * 0.2); }
    add(H, new THREE.SphereGeometry(0.11, 12, 10), M.body, 0, 0.1, 0); add(H, new THREE.CylinderGeometry(0.12, 0.125, 0.15, 12), M.trim, 0, 0.14, 0); add(H, new THREE.BoxGeometry(0.15, 0.02, 0.03), M.glow, 0, 0.12, 0.11);
    for (let i = 0; i < 7; i++) add(H, new THREE.ConeGeometry(0.035, 0.22, 4), M.cloth, 0, 0.22 + Math.sin(i) * 0.02, -0.08 - i * 0.05, -0.9 - i * 0.12);
    // 창: 오른팔이 앞으로 겨눈다 (허리 기준)
    const sp = new THREE.Group(); sp.position.set(-0.24, 0.3, 0.3); J.neck.add(sp); m.spear = sp;
    add(sp, new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), M.body, 0, 0, 0.5, Math.PI / 2); add(sp, new THREE.ConeGeometry(0.06, 0.38, 4), M.glow, 0, 0, 1.75, Math.PI / 2);
    jaw = sp;
  } else if (kind === 'scorpion') {
    add(H, new THREE.SphereGeometry(0.1, 10, 8), M.shell, 0, 0.05, 0.06).scale.set(1.4, 0.6, 1); for (const sd of [-1, 1]) add(H, new THREE.SphereGeometry(0.022, 6, 5), M.glow, sd * 0.05, 0.1, 0.13);
  } else {
    const snout = kind === 'fox' ? 0.22 : kind === 'lion' ? 0.13 : 0.2, hr = kind === 'lion' ? 0.14 : 0.115;
    add(H, new THREE.SphereGeometry(hr, 14, 10), fur, 0, 0.08, 0).scale.set(1, 0.95, 1.05);
    add(H, new THREE.ConeGeometry(kind === 'lion' ? 0.09 : 0.065, snout, 8), fur, 0, 0.05, hr + snout * 0.35, Math.PI / 2);
    add(H, new THREE.SphereGeometry(0.022, 6, 5), M.body, 0, 0.06, hr + snout * 0.82);
    jaw = new THREE.Group(); jaw.position.set(0, 0.0, hr * 0.6); H.add(jaw); add(jaw, new THREE.BoxGeometry(0.07, 0.025, snout * 0.9), fur, 0, 0, snout * 0.45);
    for (const sd of [-1, 1]) {
      add(H, new THREE.SphereGeometry(0.024, 8, 6), M.glow, sd * 0.055, 0.12, hr * 0.85);
      if (kind !== 'lion') add(H, new THREE.ConeGeometry(kind === 'fox' ? 0.05 : 0.04, kind === 'fox' ? 0.2 : 0.13, 4), fur, sd * 0.07, 0.22, -0.01, -0.15, 0, -sd * 0.18);
    }
    if (kind === 'lion' || o.mane) for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; add(H, new THREE.ConeGeometry(0.06, 0.22, 5), M.cloth, Math.cos(a) * 0.15, 0.08 + Math.sin(a) * 0.15, -0.06, Math.sin(a) * 0.6 - 0.4, 0, -Math.cos(a) * 1.1 + Math.PI / 2 * 0); }
    if (o.crown) for (let i = 0; i < 5; i++) add(H, new THREE.ConeGeometry(0.018, 0.09, 4), M.glow, (i - 2) * 0.035, 0.22, 0.02);
    if (kind === 'fox' && o.tails > 1) for (const sd of [-1, 1]) add(H, new THREE.TorusGeometry(0.035, 0.01, 4, 10), M.trim, sd * 0.07, 0.3, -0.01);
  }
  const box = new THREE.Box3();
  let t = 0;
  return { ...m, sole: kind === 'scorpion' ? 0.04 : 0.05,
    update(dt, f) { t += dt; const sp = f ? Math.hypot(f.vel.x, f.vel.z) : 0;
      for (let i = 0; i < tails.length; i++) { const r = tails[i]; r.rotation.y = Math.sin(t * (2 + sp * 0.4) + i * 0.7) * (kind === 'scorpion' ? 0.08 : 0.25); }
      if (jaw && kind !== 'centaur') jaw.rotation.x = f && f.state === 'act' ? 0.35 : 0.05; },
    tipPos(out) { return (tip || jaw || J.head).getWorldPosition(out).add(new V3(0, 0.05, 0)); },
    weaponPts(b, tt) { if (m.spear) { m.spear.localToWorld(b.set(0, 0, 0.5)); m.spear.localToWorld(tt.set(0, 0, 1.9)); } else { J.head.localToWorld(b.set(0, 0.06, 0)); J.head.localToWorld(tt.set(0, 0.04, 0.4)); } } };
}
// 네발 자세: 골반을 앞으로 눕히고(+1.45) 팔 · 다리를 수직으로 되돌린 뒤 목을 세운다
export function quadPoses(kind) {
  const P = kind === 'centaur' ? 1.5 : 1.45, neck = kind === 'centaur' ? -1.5 : kind === 'scorpion' ? -1.2 : -1.15;
  const base = { hips: [P, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [neck, 0, 0], head: [kind === 'centaur' ? 0 : -(P + neck) + 0.05, 0, 0],
    shoulderL: [-P, 0, 0.02], elbowL: [0.05, 0, 0], handL: [0, 0, 0], shoulderR: [-P, 0, -0.02], elbowR: [0.05, 0, 0], handR: [0, 0, 0],
    hipL: [-P - 0.25, 0, 0], kneeL: [0.45, 0, 0], footL: [0.2, 0, 0], hipR: [-P - 0.25, 0, 0], kneeR: [0.45, 0, 0], footR: [0.2, 0, 0], weapon: [0, 0, 0] };
  if (kind === 'scorpion') { base.shoulderL = [-P + 0.4, 0, 0.9]; base.elbowL = [-1.2, 0, 0]; base.shoulderR = [-P + 0.4, 0, -0.9]; base.elbowR = [-1.2, 0, 0]; base.hipL = [-P, 0, 0.5]; base.hipR = [-P, 0, -0.5]; base.kneeL = base.kneeR = [0.9, 0, 0]; }
  return {
    base,
    run: { spine: [0.04, 0, 0], neck: [neck + 0.15, 0, 0] },
    jump: { hipL: [-P - 0.9, 0, 0], hipR: [-P - 0.9, 0, 0], kneeL: [1.2, 0, 0], kneeR: [1.2, 0, 0], shoulderL: [-P - 0.6, 0, 0], shoulderR: [-P - 0.6, 0, 0], chest: [-0.15, 0, 0] },
    guard: { chest: [-0.12, 0, 0], neck: [neck - 0.2, 0, 0], hipL: [-P - 0.5, 0, 0], hipR: [-P - 0.5, 0, 0], kneeL: [0.9, 0, 0], kneeR: [0.9, 0, 0] },
    hit: { chest: [-0.3, 0.15, 0], neck: [neck - 0.3, 0, 0.2], spine: [-0.1, 0, 0] },
    air: { chest: [-0.35, 0, 0.3], hipL: [-P + 0.5, 0, 0], hipR: [-P + 0.3, 0, 0], shoulderL: [-P + 0.5, 0, 0], shoulderR: [-P + 0.6, 0, 0] },
    down: { hipY: -0.32, hips: [P, 0, 1.45], neck: [neck + 0.3, 0, 0], shoulderL: [-P + 0.4, 0, 0], shoulderR: [-P + 0.5, 0, 0], hipL: [-P + 0.3, 0, 0], hipR: [-P + 0.4, 0, 0] },
    dash: { chest: [0.1, 0, 0], neck: [neck + 0.25, 0, 0], shoulderL: [-P - 0.7, 0, 0], shoulderR: [-P - 0.7, 0, 0], hipL: [-P + 0.6, 0, 0], hipR: [-P + 0.6, 0, 0] },
    win: { chest: [-0.35, 0, 0], neck: [neck - 0.4, 0, 0], head: [kind === 'centaur' ? 0 : -(P + neck) - 0.2, 0, 0] },
    portrait: { neck: [neck - 0.1, 0.2, 0] },
    crouch: { hipY: -0.15, hipL: [-P - 0.7, 0, 0], hipR: [-P - 0.7, 0, 0], kneeL: [1.3, 0, 0], kneeR: [1.3, 0, 0], shoulderL: [-P - 0.35, 0, 0], shoulderR: [-P - 0.35, 0, 0], elbowL: [0.6, 0, 0], elbowR: [0.6, 0, 0] },
  };
}
// 네발 보행: 대각선 다리가 함께 움직인다 (왼앞 + 오른뒤)
export function quadRun(out, ph) {
  const s = Math.sin(ph), c = Math.cos(ph);
  out[JI.shoulderL] += 0.7 * s; out[JI.hipR] += 0.7 * s; out[JI.shoulderR] -= 0.7 * s; out[JI.hipL] -= 0.7 * s;
  out[JI.elbowL] += 0.5 * Math.max(0, -c); out[JI.elbowR] += 0.5 * Math.max(0, c); out[JI.kneeL] += 0.6 * Math.max(0, c); out[JI.kneeR] += 0.6 * Math.max(0, -c);
  out[JI.chest] += 0.06 * c; out[0] += Math.abs(c) * 0.04;
}

/* =====================================================================
   거구: kind = 'stone' · 'obsidian' · 'fur'(예티) · 'crystal' · 'mech' · 'ogre' · 'oni'
   어깨가 넓고 팔이 땅에 닿을 만큼 길며, 머리는 가슴에 파묻혀 있다
   ===================================================================== */
export const GOLEM_DIMS = { hipH: 0.82, spineL: 0.2, chestL: 0.36, neckL: 0.02, shW: 0.36, uArm: 0.4, lArm: 0.42, hipW: 0.17, thigh: 0.36, shin: 0.38, headTop: 0.14 };
export function buildGolem(pal, o = {}) {
  const kind = o.kind || 'stone', D = GOLEM_DIMS, m = buildHumanoid(D), J = m.J, M = mats(pal, { ...o, flat: ['stone', 'obsidian', 'crystal'].includes(kind) }), add = adder;
  const chunk = (r) => kind === 'crystal' ? new THREE.OctahedronGeometry(r, 0) : kind === 'mech' ? new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6) : ['fur', 'ogre', 'oni'].includes(kind) ? new THREE.SphereGeometry(r, 14, 10) : new THREE.DodecahedronGeometry(r, 0);
  const skin = ['ogre', 'oni', 'fur'].includes(kind) ? M.body : M.shell, floatParts = [];
  // 몸통: 거대한 가슴 · 배
  add(J.hips, chunk(0.2), skin, 0, 0, 0).scale.set(1.3, 0.8, 1);
  add(J.spine, chunk(0.22), skin, 0, 0.12, 0.02).scale.set(1.25, 1, 1.05);
  const ch = add(J.chest, chunk(0.34), skin, 0, 0.2, 0); ch.scale.set(1.35, 1, 0.95);
  if (kind === 'ogre') add(J.spine, new THREE.SphereGeometry(0.27, 14, 10), M.body, 0, 0.05, 0.1); // 배
  if (kind === 'stone' || kind === 'obsidian') for (let i = 0; i < 5; i++) add(J.chest, new THREE.BoxGeometry(0.025, 0.2, 0.02), M.glow, -0.2 + i * 0.1, 0.18 + Math.sin(i * 2) * 0.06, 0.3, 0, 0, Math.sin(i * 3) * 0.6); // 갈라진 빛
  if (kind === 'crystal') for (let i = 0; i < 6; i++) { const c = add(J.chest, new THREE.OctahedronGeometry(0.1, 0), M.glow, Math.cos(i) * 0.3, 0.45 + (i % 2) * 0.1, Math.sin(i) * 0.25 - 0.1); c.scale.set(0.5, 1.6, 0.5); }
  if (kind === 'mech') { add(J.chest, new THREE.BoxGeometry(0.34, 0.14, 0.04), M.glow, 0, 0.22, 0.33); add(J.chest, new THREE.BoxGeometry(0.5, 0.3, 0.2), M.trim, 0, 0.25, -0.32); for (const sd of [-1, 1]) { add(J.chest, new THREE.CylinderGeometry(0.06, 0.06, 0.5, 10), M.body, sd * 0.32, 0.58, -0.05, Math.PI / 2 - 0.3); add(J.chest, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10), M.glow, sd * 0.32, 0.66, 0.2, Math.PI / 2 - 0.3); } }
  if (kind === 'fur') for (let i = 0; i < 10; i++) add(J.chest, new THREE.ConeGeometry(0.07, 0.25, 5), M.body, Math.cos(i * 0.7) * 0.36, 0.0 + (i % 3) * 0.12, Math.sin(i * 0.7) * 0.3, Math.PI, 0, 0);
  if (kind === 'oni' || kind === 'ogre') { const lc = add(J.hips, new THREE.CylinderGeometry(0.26, 0.34, 0.3, 10, 1, true), M.cloth, 0, -0.12, 0); if (kind === 'oni') for (let i = 0; i < 8; i++) add(lc, new THREE.BoxGeometry(0.04, 0.24, 0.02), M.trim, Math.cos(i * 0.8) * 0.3, 0, Math.sin(i * 0.8) * 0.3, 0, -i * 0.8, 0); }
  // 머리: 가슴에 파묻힌 작은 머리
  const H = J.head;
  if (kind === 'mech') { add(H, new THREE.BoxGeometry(0.22, 0.14, 0.2), M.shell, 0, 0.05, 0.08); add(H, new THREE.BoxGeometry(0.2, 0.035, 0.02), M.glow, 0, 0.06, 0.185); }
  else if (kind === 'crystal') { const hd = add(H, new THREE.OctahedronGeometry(0.13, 0), M.shell, 0, 0.22, 0.04); hd.scale.set(0.8, 1.2, 0.8); floatParts.push(hd); add(hd, new THREE.SphereGeometry(0.03, 6, 5), M.glow, 0, 0, 0.1); }
  else { const hd = add(H, chunk(0.13), skin, 0, 0.04, 0.12); for (const sd of [-1, 1]) add(H, new THREE.SphereGeometry(0.025, 6, 5), M.glow, sd * 0.05, 0.07, 0.24);
    if (kind === 'oni' || kind === 'fur' || o.horns) for (const sd of [-1, 1]) add(H, new THREE.ConeGeometry(0.04, kind === 'oni' ? 0.22 : 0.16, 6), kind === 'fur' ? M.bone : M.trim, sd * 0.1, 0.2, 0.08, -0.2, 0, -sd * 0.35);
    if (kind === 'oni' || kind === 'ogre') for (const sd of [-1, 1]) add(H, new THREE.ConeGeometry(0.018, 0.07, 4), M.bone, sd * 0.05, -0.02, 0.23, Math.PI - 0.3); }
  // 팔: 굵고 길다, 주먹이 크다
  for (const [a, b, c, sd] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(a, chunk(0.17), kind === 'mech' ? M.trim : skin, 0, 0.02, 0).scale.set(1.1, 1, 1.1);
    limb(a, D.uArm, 0.1, skin, 0.12); add(b, chunk(0.1), M.shell); limb(b, D.lArm, 0.11, skin, 0.15);
    const fist = add(c, chunk(0.15), kind === 'fur' ? M.body : M.shell, 0, -0.08, 0.02); fist.scale.set(1, 1.1, 1.1);
    if (kind === 'crystal' || kind === 'stone') add(c, new THREE.OctahedronGeometry(0.06, 0), M.glow, 0, -0.1, 0.14);
  }
  // 다리: 짧고 굵다
  for (const [a, b, c] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    limb(a, D.thigh, 0.12, skin, 0.15); add(b, chunk(0.11), M.shell); limb(b, D.shin, 0.12, kind === 'mech' ? M.trim : skin, 0.11);
    add(c, chunk(0.13), M.shell, 0, -0.04, 0.06).scale.set(1, 0.55, 1.4);
  }
  // 무기 (곤봉 · 망치 · 대검) — 없으면 주먹
  const W = J.weapon; let len = 0.35, fistW = !o.weapon;
  if (o.weapon === 'club') { len = 1.3; add(W, new THREE.CylinderGeometry(0.15, 0.05, 1.25, 10), M.trim, 0, 0, 0.6, Math.PI / 2); for (let i = 0; i < 10; i++) add(W, new THREE.ConeGeometry(0.035, 0.1, 4), M.bone, Math.cos(i * 2) * 0.14, Math.sin(i * 2) * 0.14, 0.8 + (i % 4) * 0.1, Math.cos(i * 2) * 1.5, 0, 0); }
  else if (o.weapon === 'hammer') { len = 1.4; add(W, new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8), M.body, 0, 0, 0.55, Math.PI / 2); add(W, new THREE.BoxGeometry(0.4, 0.4, 0.55), M.shell, 0, 0, 1.2); add(W, new THREE.BoxGeometry(0.42, 0.07, 0.57), M.glow, 0, 0, 1.2); }
  else if (o.weapon === 'greatsword') { len = 1.9; add(W, new THREE.BoxGeometry(0.06, 0.26, 1.7), M.shell, 0, 0, 1.0); add(W, new THREE.BoxGeometry(0.065, 0.04, 1.7), M.glow, 0, 0.12, 1.0); add(W, new THREE.BoxGeometry(0.4, 0.07, 0.07), M.trim, 0, 0, 0.14); }
  let t = 0;
  return { ...m, sole: 0.07,
    update(dt) { t += dt; floatParts.forEach((p, i) => { p.position.y = 0.22 + Math.sin(t * 2 + i) * 0.03; p.rotation.y += dt; }); },
    tipPos(out) { return (fistW ? J.handR : W).localToWorld(out.set(0, fistW ? -0.1 : 0, fistW ? 0.15 : len)); },
    weaponPts(b, tt) { if (fistW) { J.elbowR.localToWorld(b.set(0, -0.2, 0)); J.handR.localToWorld(tt.set(0, -0.2, 0.05)); } else { W.localToWorld(b.set(0, 0, 0.3)); W.localToWorld(tt.set(0, 0, len)); } } };
}

/* =====================================================================
   떠다니는 자: kind = 'robe'(술사) · 'gown'(여왕) · 'ghost'(유령) · 'wisp'(공허 정령)
   다리는 옷자락 속에 숨기고 sole 음수로 띄운다. 주변을 도는 파편(orbit)
   ===================================================================== */
const FLOAT_DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.2, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44, headTop: 0.24 };
export function buildFloater(pal, o = {}) {
  const kind = o.kind || 'robe', m = buildHumanoid(FLOAT_DIMS), J = m.J, M = mats(pal, o), add = adder;
  const low = kind === 'ghost' || kind === 'wisp' ? M.ghost : M.cloth;
  // 상체
  add(J.spine, cap(0.12, 0.12), M.cloth, 0, 0.1, 0);
  add(J.chest, cap(0.15, 0.16), kind === 'wisp' ? M.shell : M.cloth, 0, 0.16, 0).scale.set(1.15, 1, 0.85);
  add(J.neck, new THREE.CylinderGeometry(0.045, 0.05, 0.12, 8), M.body, 0, 0.03, 0);
  // 아래: 넓게 퍼지는 옷자락 (다리를 덮음)
  const skirtH = kind === 'gown' ? 1.05 : 0.95, flare = kind === 'gown' ? 0.62 : kind === 'ghost' ? 0.08 : kind === 'wisp' ? 0.05 : 0.42;
  const sk = add(J.hips, new THREE.CylinderGeometry(0.17, flare, skirtH, 18, 4, true), low, 0, -skirtH / 2 + 0.06, 0);
  if (kind === 'ghost' || kind === 'wisp') { const p = sk.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -0.2) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.sin(a * 5) * 0.08); } } sk.geometry.computeVertexNormals(); }
  if (kind === 'gown') for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; add(J.hips, new THREE.OctahedronGeometry(0.05, 0), M.glow, Math.cos(a) * 0.6, -0.95, Math.sin(a) * 0.6); }
  if (kind === 'robe') add(J.hips, new THREE.TorusGeometry(0.18, 0.025, 6, 16), M.trim, 0, 0.02, 0, Math.PI / 2);
  // 팔: 넓은 소매
  for (const [a, b, c, sd] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(a, new THREE.SphereGeometry(0.07, 10, 8), kind === 'gown' ? M.trim : M.cloth); limb(a, 0.29, 0.045, M.cloth);
    add(b, new THREE.CylinderGeometry(0.11, 0.05, 0.3, 10, 1, true), low, 0, -0.16, 0);
    add(c, new THREE.SphereGeometry(0.035, 8, 6), kind === 'ghost' || kind === 'wisp' ? M.glow : M.body, 0, -0.03, 0);
  }
  // 머리
  const H = J.head;
  if (kind === 'robe') { add(H, new THREE.ConeGeometry(0.16, 0.42, 12, 1, true), M.cloth, 0, 0.2, -0.02); add(H, new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x050308 }), 0, 0.12, 0.02); for (const sd of [-1, 1]) add(H, new THREE.SphereGeometry(0.02, 6, 5), M.glow, sd * 0.035, 0.13, 0.1); }
  else if (kind === 'gown') { add(H, new THREE.SphereGeometry(0.11, 14, 10), M.body, 0, 0.12, 0); add(H, new THREE.SphereGeometry(0.125, 14, 10, 0, TAU, 0, 1.9), M.cloth, 0, 0.13, -0.01); for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const c = add(H, new THREE.OctahedronGeometry(0.035, 0), M.glow, Math.sin(a) * 0.1, 0.27 + Math.cos(i) * 0.02, Math.cos(a) * 0.05); c.scale.set(0.5, 2.2, 0.5); } for (const sd of [-1, 1]) add(H, new THREE.SphereGeometry(0.016, 6, 5), M.glow, sd * 0.038, 0.13, 0.1); }
  else if (kind === 'ghost') { add(H, new THREE.SphereGeometry(0.11, 12, 10), M.bone, 0, 0.12, 0); for (const sd of [-1, 1]) add(H, new THREE.SphereGeometry(0.026, 6, 5), M.glow, sd * 0.042, 0.13, 0.09); if (o.hat) { add(H, new THREE.CylinderGeometry(0.2, 0.23, 0.05, 3), M.body, 0, 0.24, 0); add(H, new THREE.CylinderGeometry(0.1, 0.11, 0.12, 12), M.body, 0, 0.29, 0); } }
  else { const c = add(H, new THREE.OctahedronGeometry(0.13, 0), M.shell, 0, 0.13, 0); c.scale.set(0.8, 1.35, 0.8); add(H, new THREE.BoxGeometry(0.14, 0.02, 0.04), M.glow, 0, 0.13, 0.08); }
  if (o.crown) for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; add(H, new THREE.ConeGeometry(0.02, 0.1, 4), M.trim, Math.sin(a) * 0.1, 0.3, Math.cos(a) * 0.1); }
  if (o.halo) add(H, new THREE.TorusGeometry(0.22, 0.012, 6, 28), M.glow, 0, 0.44, -0.05, Math.PI / 2 - 0.2);
  if (o.wings) for (const sd of [-1, 1]) { const w = new THREE.Group(); w.position.set(sd * 0.1, 0.3, -0.14); w.rotation.set(0.2, -sd * 0.4, sd * 0.25); J.chest.add(w); for (let k = 0; k < 5; k++) { const f = add(w, new THREE.OctahedronGeometry(0.1, 0), M.glow, sd * (0.18 + k * 0.1), 0.15 - k * 0.07, 0); f.scale.set(0.5, 2.6 - k * 0.3, 0.2); f.rotation.z = sd * (0.4 + k * 0.25); } }
  if (o.cape) { const c = add(J.chest, new THREE.PlaneGeometry(0.44, 1.0, 1, 4), M.cloth, 0, -0.1, -0.18, 0.1); c.geometry.translate(0, -0.15, 0); }
  // 주변을 도는 파편
  const orb = new THREE.Group(); orb.position.y = 1.2; m.body.add(orb);
  for (let i = 0; i < (o.orbit ?? 4); i++) { const a = (i / (o.orbit ?? 4)) * TAU, s = add(orb, kind === 'gown' ? new THREE.OctahedronGeometry(0.07, 0) : new THREE.IcosahedronGeometry(0.05, 0), M.glow, Math.cos(a) * 0.55, Math.sin(i * 2) * 0.15, Math.sin(a) * 0.55); s.scale.y = 1.6; }
  // 무기 (지팡이 · 검 · 없음)
  const W = J.weapon; let len = 0.4;
  if (o.weapon === 'staff') { len = 1.5; add(W, new THREE.CylinderGeometry(0.02, 0.02, 1.45, 8), M.trim, 0, 0, 0.58, Math.PI / 2); add(W, new THREE.OctahedronGeometry(0.1), M.glow, 0, 0, 1.36); add(W, new THREE.TorusGeometry(0.11, 0.012, 6, 16), M.trim, 0, 0, 1.36); }
  else if (o.weapon === 'sword') { len = 1.1; add(W, new THREE.BoxGeometry(0.014, 0.06, 0.95), M.ghost, 0, 0, 0.6); add(W, new THREE.BoxGeometry(0.2, 0.03, 0.04), M.trim, 0, 0, 0.12); }
  else if (o.weapon === 'spear') { len = 1.9; add(W, new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), M.trim, 0, 0, 0.75, Math.PI / 2); add(W, new THREE.ConeGeometry(0.05, 0.34, 4), M.glow, 0, 0, 1.75, Math.PI / 2); }
  let t = 0;
  const md = { ...m, sole: -0.42,
    update(dt) { t += dt; md.sole = -0.42 + Math.sin(t * 1.8) * 0.05; orb.rotation.y += dt * 1.1; sk.rotation.y = Math.sin(t * 1.3) * 0.12; },
    tipPos(out) { return (o.weapon ? W : J.handL).localToWorld(out.set(0, 0, o.weapon ? len : 0.1)); },
    weaponPts(b, tt) { W.localToWorld(b.set(0, 0, 0.2)); W.localToWorld(tt.set(0, 0, len)); } };
  return md;
}
// 떠다니는 자 자세: 다리는 모아 늘어뜨린다 (옷자락 속)
export function floatPoses(src) {
  const legs = { hipL: [0.05, 0, 0.04], kneeL: [0.1, 0, 0], footL: [0.4, 0, 0], hipR: [0.05, 0, -0.04], kneeR: [0.1, 0, 0], footR: [0.4, 0, 0] };
  const out = {}; for (const k in src) out[k] = { ...src[k], ...(k === 'down' ? {} : legs) }; out.crouch = { ...src.base, ...legs, spine: [0.3, 0, 0] }; return out;
}

/* =====================================================================
   드론: 사람 몸 대신 공중에 뜬 기체 (프로펠러 4개 · 카메라 눈 · 포신)
   ===================================================================== */
export function buildDrone(pal, o = {}) {
  const m = buildHumanoid(FLOAT_DIMS), M = mats(pal, { metal: 0.8, rough: 0.25 }), add = adder;
  const d = new THREE.Group(); d.position.y = 1.45; m.body.add(d);
  add(d, new THREE.SphereGeometry(0.2, 16, 12), M.shell).scale.set(1.2, 0.7, 1.3);
  add(d, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), M.glow, 0, 0, 0.24, Math.PI / 2);
  add(d, new THREE.BoxGeometry(0.06, 0.06, 0.4), M.body, 0, -0.12, 0.18); const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.12, 0.42); d.add(muzzle);
  const rot = [];
  for (const [x, z] of [[0.32, 0.3], [-0.32, 0.3], [0.32, -0.3], [-0.32, -0.3]]) { add(d, new THREE.BoxGeometry(Math.abs(x) * 1.1, 0.03, 0.04), M.body, x / 2, 0.05, z / 2, 0, Math.atan2(z, x), 0); add(d, new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), M.trim, x, 0.06, z); const r = add(d, new THREE.BoxGeometry(0.34, 0.006, 0.04), M.glow, x, 0.1, z); rot.push(r); }
  add(d, new THREE.ConeGeometry(0.12, 0.18, 4), M.trim, 0, -0.18, -0.05, Math.PI);
  let t = 0;
  return { ...m, sole: 0.07,
    update(dt, f) { t += dt; rot.forEach((r, i) => (r.rotation.y += dt * (30 + i))); d.position.y = 1.45 + Math.sin(t * 2.2) * 0.08; d.rotation.z = Math.sin(t * 1.3) * 0.08; d.rotation.x = f && f.state === 'run' ? 0.25 : 0; },
    tipPos(out) { return muzzle.getWorldPosition(out); },
    weaponPts(b, tt) { d.localToWorld(b.set(0, 0, 0)); muzzle.getWorldPosition(tt); } };
}
