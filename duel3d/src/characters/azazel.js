// 아자젤 (AZAZEL) — OVERLORD · 근거리 · 화염 · 파워
// "차별이라는 사슬을 끊어내고, 잃어버린 마족의 영광을 되찾고 싶어하는 양키 여고생"
// 무기: 가시 철퇴 「GRIGORI」 — 각성하면 붉게 달아오르며 불길에 휩싸인다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, FIRE, EMBER, BLOOD, HOT } from './azazel_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const FIRES = [FIRE, EMBER, HOT];

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const poses = {
  // 기본: 철퇴를 오른 어깨에 걸치고 왼손은 허리에 — 삐딱하게 선 양키 자세
  base: { hips: [0, 0.22, 0.04], spine: [0.04, -0.12, 0], chest: [0.02, -0.12, 0], head: [0.06, 0.18, -0.08],
    shoulderR: [-0.85, 0, -0.42], elbowR: [-1.8, 0, 0], weapon: [0.48, 2.95, 1.57], shoulderL: [0.3, 0, 0.5], elbowL: [-1.55, 0, 0],
    hipL: [-0.14, 0, 0.13], kneeL: [0.28, 0, 0], footL: [-0.1, 0, 0], hipR: [0.18, 0, -0.08], kneeR: [0.12, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.1, 0], spine: [0.25, 0.05, 0], chest: [0.05, 0.05, 0], head: [-0.12, 0, 0], shoulderR: [-0.75, 0, -0.4], elbowR: [-1.85, 0, 0], weapon: [0.62, 2.85, 1.57], shoulderL: [0, 0, 0.15], elbowL: [-0.9, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.2, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.2, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.3, 0, 0], shoulderL: [-0.8, 0, 0.7], elbowL: [-0.6, 0, 0] },
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.1, 0], chest: [0.05, 0.1, 0], shoulderR: [-0.9, 0, -0.1], elbowR: [-1.5, 0, 0], weapon: [0.25, -1.5, 1.57],
    hipL: [-0.5, 0, 0.2], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.8, 2.3, 1.2], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.5, 2.0, 1.2], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.7, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -1.3, 1.57],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.6, 0, -0.3], elbowR: [-0.6, 0, 0], weapon: [0.3, 2.9, 1.3], shoulderL: [0.8, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.9, 0, 0] },
  // 승리: 철퇴를 어깨에 메고 왼 주먹을 치켜든다
  win: { hips: [0, 0.2, 0.04], spine: [-0.05, -0.1, 0], chest: [-0.05, -0.1, 0], head: [-0.15, 0.15, -0.06], shoulderR: [-0.85, 0, -0.42], elbowR: [-1.8, 0, 0], weapon: [0.78, 2.72, 1.57], shoulderL: [-2.7, 0, 0.35], elbowL: [-0.5, 0, 0],
    hipL: [-0.12, 0, 0.12], kneeL: [0.2, 0, 0], hipR: [0.15, 0, -0.08], kneeR: [0.1, 0, 0] },
  // 컷인: 턱을 들고 이를 드러내며 노려본다
  portrait: { hips: [0, 0.1, 0], chest: [0, -0.2, 0], head: [-0.12, 0.28, -0.1], shoulderR: [-1.0, 0, -0.5], elbowR: [-1.95, 0, 0], weapon: [1.0, 2.6, 1.57], shoulderL: [0.3, 0, 0.5], elbowL: [-1.5, 0, 0] },
  // 머리 위로 치켜든 자세 (철퇴가 등 뒤로 넘어감)
  raised: { hips: [0, 0, 0], spine: [-0.18, 0, 0], chest: [-0.1, 0, 0], head: [-0.25, 0, 0], shoulderR: [-3.0, 0, -0.2], elbowR: [-0.5, 0, 0], weapon: [2.4, 0, 1.57], hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  slam: { hips: [0, -0.15, 0], spine: [0.7, 0, 0], chest: [0.22, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.0, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-0.68, 0.05, 1.57], hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.4, 0, 0] },
  // 포효: 가슴을 젖히고 두 팔을 벌린다 (궁극기 시작)
  roar: { hips: [0, 0, 0], spine: [-0.3, 0, 0], chest: [-0.25, 0, 0], head: [-0.4, 0, 0], shoulderR: [-1.2, 0, -1.3], elbowR: [-0.3, 0, 0], weapon: [0.6, 1.6, 0.4], shoulderL: [-1.0, 0, 1.4], elbowL: [-0.4, 0, 0],
    hipL: [-0.3, 0, 0.25], kneeL: [0.5, 0, 0], hipR: [0.25, 0, -0.25], kneeR: [0.45, 0, 0] },
};
const LEGS_LUNGE = { hipL: [-1.0, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.3, 0, 0] };

/* =====================================================================
   불꽃 이펙트 도구
   ===================================================================== */
const fireSlash = (f, o) => f.slashFx({ r: o.r || 2.2, color: o.color ?? (f.awakenT > 0 ? EMBER : FIRE), life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.0, 0.35] });
function embers(G, p, n = 14, sp = 5) { G.fx.burst(p, n, FIRES, sp, { kind: 'ember', lk: 1.2 }); }
function flameBurst(G, p, s = 1, up = false) {
  G.fx.burst(p, 26 * s | 0, FIRES, 7 * s, up ? { dir: new V3(0, 1, 0), spread: 1.1 } : {});
  G.fx.burst(p, 10 * s | 0, 0x2a1a18, 3 * s, { kind: 'dust', sk: 1.4 * s });
  for (let i = 0; i < 10 * s; i++) G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3) * s, rand(-0.1, 0.4) * s, rand(-0.3, 0.3) * s)), { vel: [rand(-1, 1), rand(1.5, 4), rand(-1, 1)], life: rand(0.3, 0.6), size: rand(0.4, 0.8) * s, size1: 0.05, color: i % 2 ? FIRE : EMBER, alpha: 0.85, drag: 2 });
  G.fx.light(p.clone().setY(p.y + 0.6), FIRE, 70 * s, 0.35, 10 * s);
}
function fireCrack(G, c, r, n = 8) {
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rand(-0.2, 0.2), L = r * rand(0.6, 1.1), d = new V3(Math.cos(a), 0, Math.sin(a)); G.fx.slash(c.clone().addScaledVector(d, L * 0.45).setY(c.y + 0.04), { fwd: d, normal: new V3(0, 1, 0), r: L * 0.55, color: FIRE, life: 0.55 }); }
}
// 폭발: 화구 + 링 + 별 모양 섬광 (작렬 찌르기 · 궁극기)
function explosion(G, p, s = 1) {
  sfx('boom'); G.shake(0.25 * s); G.flash(0xffb060, 0.18 * s);
  G.fx.impact(p, FIRE, 2.2 * s, new V3(0, 1, 0));
  G.fx.ring(p, { r0: 0.2, r1: 2.2 * s, life: 0.35, color: EMBER, billboard: true }); G.fx.ring(p, { r0: 0.1, r1: 1.4 * s, life: 0.25, color: 0xffffff, billboard: true });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, d = new V3(Math.cos(a), Math.sin(a) * 0.7, Math.sin(a) * 0.5).normalize(); G.fx.slash(p.clone().addScaledVector(d, 0.6 * s), { fwd: d, normal: new V3(-d.y, d.x, 0).normalize(), r: 1.1 * s, color: i % 2 ? FIRE : HOT, life: 0.3 }); }
  flameBurst(G, p, 1.4 * s);
}

// 사슬 낚아채기: 왼손에서 사슬 갈고리가 날아가 상대를 끌어온다
class ChainHook {
  constructor(G, f, target) {
    this.G = G; this.f = f; this.t = 0; this.done = false; this.phase = 'out'; this.hooked = null;
    const hand = f.model.J.handL.getWorldPosition(new V3());
    this.from = hand.clone(); this.pos = hand.clone();
    const aim = target && !target.gone && f.dist() < 10 ? target.chest(new V3()) : f.local([0, 1.1, 9]);
    this.dir = aim.sub(hand).normalize(); this.max = 9.5;
    const link = new THREE.TorusGeometry(0.02, 0.0055, 6, 12).scale(1, 1.55, 1);
    this.links = new THREE.InstancedMesh(link, new THREE.MeshStandardMaterial({ color: 0x8a8a94, metalness: 0.8, roughness: 0.35, emissive: 0x3a0a04, emissiveIntensity: 0.6 }), 40); this.links.frustumCulled = false; G.scene.add(this.links);
    const sh = new THREE.Shape(); sh.moveTo(0, 0.09); sh.lineTo(0.024, 0.03); sh.lineTo(0.012, 0); sh.lineTo(0.024, -0.03); sh.lineTo(0, -0.07); sh.lineTo(-0.024, -0.03); sh.lineTo(-0.012, 0); sh.lineTo(-0.024, 0.03); sh.closePath();
    this.head = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0x9a9aa4, metalness: 0.9, roughness: 0.3, emissive: 0xff3a10, emissiveIntensity: 0.4 }));
    G.scene.add(this.head); f.chainHook = this;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; const hand = f.model.J.handL.getWorldPosition(new V3());
    if (this.phase === 'out') {
      this.pos.addScaledVector(this.dir, 34 * dt);
      for (const t of f.foes()) if (t.hurtHit(this.pos, 0.3)) { this.hooked = t; this.phase = 'pull'; this.t = 0; sfx('block'); sfx('hit'); t.takeHit(f, { dmg: 28, kb: [0, 0], stun: 1.1, hs: 0.06, daze: 20 }, this.dir.clone().negate()); G.fx.burst(this.pos, 16, FIRES, 5); f.hooked = t; break; }
      if (this.phase === 'out' && this.pos.distanceTo(this.from) > this.max) { this.phase = 'back'; this.t = 0; }
    } else if (this.phase === 'pull') {
      const t = this.hooked, k = Math.min(1, this.t / 0.24), dest = f.local([0, 0, 1.45 + 0.35 * t.scale]);
      if (!t.gone) { t.pos.x += (dest.x - t.pos.x) * Math.min(1, k * 0.5 + dt * 12); t.pos.z += (dest.z - t.pos.z) * Math.min(1, k * 0.5 + dt * 12); t.vel.set(0, Math.min(t.vel.y, 0), 0); this.pos.copy(t.chest(new V3())); }
      if (this.t > 0.26) { this.phase = 'back'; this.t = 0; }
    } else { this.pos.lerp(hand, Math.min(1, dt * 18)); if (this.pos.distanceTo(hand) < 0.15 || this.t > 0.5) this.kill(); }
    // 사슬 고리 배치 (손 → 갈고리)
    const d = new V3().subVectors(this.pos, hand), L = d.length(), n = Math.min(40, Math.max(1, Math.round(L / 0.045))), m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new V3(0, 1, 0), dir = d.clone().normalize(), sag = this.phase === 'out' ? 0.1 : 0.02;
    q.setFromUnitVectors(Y, dir);
    for (let i = 0; i < 40; i++) { if (i >= n) { m.makeScale(0, 0, 0); this.links.setMatrixAt(i, m); continue; } const u = (i + 0.5) / n, p = hand.clone().addScaledVector(d, u); p.y -= Math.sin(u * Math.PI) * sag * L * 0.1; const qq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, (i % 2) * Math.PI / 2)); m.compose(p, qq, new V3(1, 1, 1)); this.links.setMatrixAt(i, m); }
    this.links.instanceMatrix.needsUpdate = true; this.head.position.copy(this.pos); this.head.quaternion.setFromUnitVectors(Y, dir);
    if (Math.random() < 0.5) G.fx.p(this.pos, { size: 0.3, size1: 0.05, life: 0.15, color: FIRE, alpha: 0.6 });
  }
  kill() { this.done = true; this.G.scene.remove(this.links); this.G.scene.remove(this.head); this.links.geometry.dispose(); this.head.geometry.dispose(); if (this.f.chainHook === this) this.f.chainHook = null; }
}

/* =====================================================================
   기술
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 불붙은 철퇴로 내리꽂아 화염 폭발 --- */
  ...makePlunge({
    up: 'raised',
    fall: { ...poses.raised, spine: [0.25, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.0, 0, -0.15], elbowR: [-0.5, 0, 0], weapon: [-1.35, 0, 1.57], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.2, 0, 0] },
    land: { ...poses.slam, weapon: [-1.1, 0, 1.57] },
    color: FIRE, dmg: 76, r: 2.5,
    fx: (f, o, G, c) => { fireCrack(G, c, 2.6, 9); flameBurst(G, c, 1.1, true); },
  }),

  /* --- 기본 공격 4연타: 가로 휘두르기 → 역방향 올려치기 → 내려찍기 → 불꽃 어퍼 --- */
  light1: { dur: 0.48, cancel: 0.28, next: 'light2', trail: true, track: 0.1,
    keys: [[0, { hips: [0, -0.5, 0], spine: [0.1, -0.4, 0], chest: [0, -0.5, 0], head: [0, 0.3, 0], shoulderR: [-1.2, 0, -1.0], elbowR: [-0.4, 0, 0], weapon: [0.25, 2.1, 0.2] }], [0.08, { weapon: [0.25, 2.35, 0.2] }],
      [0.18, { hips: [0, 0.45, 0], spine: [0.25, 0.35, 0], chest: [0.1, 0.6, 0], head: [0, -0.3, 0], shoulderR: [-1.4, 0, 0.4], elbowR: [-0.2, 0, 0], weapon: [0.1, -1.5, 0.2], ...LEGS_LUNGE }],
      [0.3, { weapon: [0.15, -1.9, 0.2] }], [0.48, 'base']],
    lunge: [[0.05, 0.18, 6]],
    ev: [[0.09, (f, o, G) => { sfx('heavy'); fireSlash(f, { tilt: 0.12, r: 2.3, at: [0, 1.05, 0.3] }); }]],
    hits: [{ t0: 0.09, t1: 0.21, dmg: 46, kb: [3, 0], stun: 0.36, daze: 14 }] },
  light2: { dur: 0.48, cancel: 0.28, next: 'light3', trail: true, track: 0.08,
    keys: [[0, { hips: [0, 0.4, 0], spine: [0.2, 0.35, 0], chest: [0.1, 0.7, 0], shoulderR: [-1.4, 0, 0.4], elbowR: [-0.2, 0, 0], weapon: [0.1, -1.7, -0.3], ...LEGS_LUNGE }], [0.07, { weapon: [0.05, -1.95, -0.3] }],
      [0.2, { hips: [0, -0.45, 0], spine: [0.05, -0.4, 0], chest: [-0.05, -0.7, 0], shoulderR: [-1.7, 0, -1.1], elbowR: [-0.15, 0, 0], weapon: [0.65, 1.8, -0.35] }],
      [0.3, { weapon: [0.75, 2.05, -0.35] }], [0.48, 'base']],
    lunge: [[0.05, 0.17, 4]],
    ev: [[0.09, (f) => { sfx('heavy'); fireSlash(f, { tilt: -0.45, r: 2.3, at: [0, 1.15, 0.3], flip: true }); }]],
    hits: [{ t0: 0.09, t1: 0.22, dmg: 50, kb: [2, 0.5], stun: 0.42, daze: 14 }] },
  light3: { dur: 0.62, cancel: 0.4, next: 'light4', trail: true, track: 0.1,
    keys: [[0, 'raised'], [0.1, { weapon: [2.6, -0.1, 1.57], spine: [-0.25, 0, 0] }], [0.22, 'slam'], [0.36, {}], [0.62, 'base']],
    lunge: [[0.04, 0.2, 6.5]],
    ev: [[0.12, (f) => { sfx('heavy'); fireSlash(f, { tilt: Math.PI / 2, r: 2.2, at: [0, 1.3, 0.3] }); }],
      [0.21, (f, o, G) => { const c = f.local([0, 0.05, 1.45]); fireCrack(G, c, 1.6, 6); flameBurst(G, c, 0.8, true); G.shake(0.12); sfx('boom'); }]],
    hits: [{ t0: 0.12, t1: 0.25, dmg: 62, kb: [3, 4], stun: 0.5, hs: 0.08, daze: 20 }] },
  light4: { dur: 0.72, trail: true, track: 0.12,
    keys: [[0, { hips: [0, -0.6, 0], spine: [0.3, -0.4, 0], chest: [0.1, -0.5, 0], shoulderR: [0.3, 0, -0.7], elbowR: [-0.3, 0, 0], weapon: [-0.7, 2.5, 0.9], hipL: [-0.7, 0, 0.2], kneeL: [1.0, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.7, 0, 0] }], [0.12, {}],
      [0.27, { hips: [0, 0.4, 0], spine: [-0.15, 0.3, 0], chest: [-0.1, 0.5, 0], head: [-0.3, 0, 0], shoulderR: [-2.7, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [1.55, -0.3, 1.2], hipL: [-0.3, 0, 0.1], kneeL: [0.3, 0, 0], hipR: [0.4, 0, -0.1], kneeR: [0.2, 0, 0] }],
      [0.42, {}], [0.72, 'base']],
    lunge: [[0.1, 0.26, 6]],
    ev: [[0.13, (f) => { sfx('heavy'); sfx('charge'); fireSlash(f, { tilt: Math.PI / 2 - 0.3, r: 2.6, at: [0, 1.0, 0.4], flip: true, life: 0.32 }); }],
      [0.2, (f, o, G) => { const c = f.local([0, 0, 1.6]); G.fx.beam(c, { r: 0.55, h: 5, color: FIRE, life: 0.4 }); flameBurst(G, c, 1, true); }]],
    hits: [{ t0: 0.13, t1: 0.29, dmg: 74, kb: [2.5, 10], stun: 0.7, hs: 0.1, shake: 0.14, daze: 26, snd: 'big' }] },

  /* --- 우클: 작렬 찌르기 — 끌어당겼다 찔러 넣고, 철퇴 끝에서 화염 폭발 --- */
  heavy: { dur: 0.78, cd: 'heavy', trail: true, aim: true, track: 0.28,
    keys: [[0, { hips: [0, -0.7, 0], spine: [0.1, -0.45, 0], chest: [0, -0.6, 0], shoulderR: [-0.5, 0, -0.3], elbowR: [-1.6, 0, 0], weapon: [0.05, 0.12, 0], hipL: [-0.6, 0, 0.2], kneeL: [0.9, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.6, 0, 0] }], [0.24, {}],
      [0.32, { hips: [0, 0.15, 0], spine: [0.45, 0.2, 0], chest: [0.15, 0.35, 0], shoulderR: [-1.5, 0, 0.05], elbowR: [-0.05, 0, 0], weapon: [0.02, 0, 0], ...LEGS_LUNGE }], [0.5, {}], [0.78, 'base']],
    start: (f, o, G) => { G.say(f, '"터져라!"'); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.28) { const p = f.model.clubTip(new V3()); G.fx.p(p, { vel: [rand(-1, 1), rand(0, 2), rand(-1, 1)], size: 0.35, size1: 0.05, life: 0.2, color: Math.random() < 0.5 ? FIRE : HOT, alpha: 0.9 }); } },
    lunge: [[0.28, 0.4, 10]],
    ev: [[0.3, () => sfx('zap')], [0.38, (f, o, G) => {
      const p = f.model.clubTip(new V3()).addScaledVector(f.fwd(new V3()), 0.25); explosion(G, p, 1);
      areaHit(f, p.clone().setY(f.pos.y), 1.8, { dmg: 88, kb: [9, 5], stun: 0.7, hs: 0.12, shake: 0.2, daze: 45, snd: 'big', unblock: true }, 2.2);
    }]],
    hits: [{ t0: 0.3, t1: 0.4, dmg: 54, kb: [3, 0], stun: 0.4, daze: 16 }] },

  /* --- Shift: 사슬 낚아채기 — 손목 사슬을 던져 끌어온 뒤 후려친다 --- */
  s1: { dur: 1.05, cd: 's1', ikOff: true, aim: true, track: 0.15, trail: true,
    keys: [[0, { ...poses.base, spine: [0.1, 0.35, 0], chest: [0.05, 0.4, 0], shoulderL: [-0.6, 0, 0.9], elbowL: [-1.6, 0, 0] }],
      [0.12, { shoulderL: [-1.65, 0, 0.2], elbowL: [-0.1, 0, 0], ...LEGS_LUNGE }], [0.36, { shoulderL: [-0.6, 0, 0.5], elbowL: [-1.4, 0, 0] }],
      [0.5, { hips: [0, -0.5, 0], spine: [0.1, -0.4, 0], chest: [0, -0.55, 0], shoulderR: [-1.2, 0, -1.0], elbowR: [-0.4, 0, 0], weapon: [0.3, 2.2, 0.2], shoulderL: [0.2, 0, 0.6], elbowL: [-1.2, 0, 0] }],
      [0.64, { hips: [0, 0.45, 0], spine: [0.25, 0.35, 0], chest: [0.1, 0.65, 0], shoulderR: [-1.4, 0, 0.4], elbowR: [-0.2, 0, 0], weapon: [0.1, -1.6, 0.2], ...LEGS_LUNGE }], [0.8, {}], [1.05, 'base']],
    start: (f, o, G) => { f.hooked = null; G.say(f, '"어딜 도망가!"'); },
    ev: [[0.12, (f, o, G) => { sfx('shot'); sfx('dash'); G.spawn(new ChainHook(G, f, o)); }],
      [0.56, (f) => { sfx('heavy'); fireSlash(f, { tilt: 0.1, r: 2.5, at: [0, 1.05, 0.3], life: 0.3 }); }]],
    hits: [{ t0: 0.56, t1: 0.7, dmg: 72, kb: [7, 3], stun: 0.6, hs: 0.1, shake: 0.15, daze: 30, snd: 'big' }],
    end: (f) => { if (f.chainHook) f.chainHook.phase = 'back'; } },

  /* --- E: 마염 선풍 — 불꽃 소용돌이 2회전, 마지막에 화염이 터지며 띄움 --- */
  s2: { dur: 1.3, cd: 's2', ikOff: true, aim: true, trail: true,
    keys: [[0, { hips: [0, 0.3, 0], spine: [0.2, 0.3, 0], chest: [0, 0.4, 0], shoulderR: [-1.5, 0, -1.2], elbowR: [-0.05, 0, 0], weapon: [0.05, 1.35, 0], shoulderL: [-0.6, 0, 1.1], elbowL: [-0.4, 0, 0], hipL: [-0.5, 0, 0.3], kneeL: [0.7, 0, 0], hipR: [0.35, 0, -0.3], kneeR: [0.6, 0, 0] }],
      [0.1, { weapon: [0.0, 1.5, 0] }], [1.0, {}], [1.08, { ...poses.raised, weapon: [1.4, 0.2, 1.57] }], [1.3, 'base']],
    start: (f, o, G) => { G.say(f, '"다 태워주지!"'); sfx('charge'); },
    tick: (f, o, G, t, dt) => {
      if (t > 0.08 && t < 1.0) {
        f.yaw -= dt * (TAU * 2.2);
        // 회전하며 상대 쪽으로 미끄러져 다가간다 (최대 4.5m/s, 1.4m 앞에서 멈춤)
        if (o && !o.gone && f.dist() < 8) { const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, d = Math.hypot(dx, dz), sp = Math.min(4.5, Math.max(0, d - 1.4) * 4); f.vel.x = dx / d * sp; f.vel.z = dz / d * sp; }
        const p = f.model.clubTip(new V3()); for (let i = 0; i < 3; i++) G.fx.p(p.clone().add(new V3(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15))), { vel: [rand(-1, 1), rand(0.5, 2.5), rand(-1, 1)], size: rand(0.4, 0.75), size1: 0.05, life: rand(0.3, 0.5), color: FIRES[i], alpha: 0.85, drag: 2 });
        if (Math.random() < dt * 14) sfx('swing');
      }
    },
    ev: [[0.1, (f, o, G) => { G.fx.ring(f.pos.clone().setY(f.pos.y + 0.9), { normal: new V3(0, 1, 0), r0: 0.5, r1: 3.2, life: 0.5, color: FIRE }); }],
      [0.55, (f, o, G) => { G.fx.ring(f.pos.clone().setY(f.pos.y + 0.6), { normal: new V3(0, 1, 0), r0: 0.5, r1: 3.4, life: 0.5, color: EMBER }); }],
      [1.02, (f, o, G) => { const c = f.pos.clone().setY(f.pos.y + 0.05); explosion(G, c.clone().setY(c.y + 0.8), 1.2); fireCrack(G, c, 3, 10); G.fx.beam(c, { r: 1.2, h: 6, color: FIRE, life: 0.5 }); areaHit(f, c, 3, { dmg: 70, kb: [5, 8.5], stun: 0.7, hs: 0.12, shake: 0.25, daze: 40, snd: 'big' }, 1.5); }]],
    hits: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((t0) => ({ t0, t1: t0 + 0.15, dmg: 22, kb: [1, 0], stun: 0.42, daze: 10, br: 0.22 })) },

  /* --- 극한 회피 뒤 좌클: 순간 돌진 찌르기 + 작은 폭발 --- */
  counter: { dur: 0.6, trail: true, aim: true,
    keys: [[0, { hips: [0, -0.6, 0], chest: [0, -0.5, 0], shoulderR: [-0.5, 0, -0.3], elbowR: [-1.6, 0, 0], weapon: [0.05, 0.12, 0] }],
      [0.08, { hips: [0, 0.15, 0], spine: [0.45, 0.2, 0], chest: [0.15, 0.35, 0], shoulderR: [-1.5, 0, 0.05], elbowR: [-0.05, 0, 0], weapon: [0.02, 0, 0], ...LEGS_LUNGE }], [0.35, {}], [0.6, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest();
      if (o) { const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? 0 : o.pos.y).addScaledVector(d, 1.9 + 0.4 * o.scale); f.faceOpp(); }
      for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.chest(), i / 8), { size: 0.8, size1: 0.2, life: 0.3, color: FIRE, alpha: 0.7 });
      sfx('dash'); G.flash(FIRE, 0.2); f.model.resetCloth();
    }], [0.12, (f, o, G) => explosion(G, f.model.clubTip(new V3()), 0.6)]],
    hits: [{ t0: 0.05, t1: 0.2, dmg: 96, kb: [7, 4], stun: 0.6, hs: 0.12, shake: 0.15, daze: 45, snd: 'big' }] },

  /* --- Q: 마왕 각성 · OVERLORD — 포효 → 도약 → 화염 강타 → 올려치기, 이후 15초 각성 --- */
  ult: { dur: 2.95, ult: true, aim: true, ikOff: true,
    keys: [[0, 'roar'], [0.5, 'roar'], [0.6, { hipL: [-1.2, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.5, 0, 0], kneeR: [1.3, 0, 0], ...poses.raised, weapon: [2.0, 0, 1.57] }], [1.0, 'raised'], [1.12, { ...poses.slam, weapon: [-1.0, 0, 1.57] }], [1.85, {}],
      [1.95, { hips: [0, -0.7, 0], spine: [0.3, -0.5, 0], chest: [0, -0.6, 0], shoulderR: [0.2, 0, -0.7], elbowR: [-0.3, 0, 0], weapon: [-0.6, 2.3, 0.9] }],
      [2.15, { hips: [0, 0.4, 0], spine: [-0.15, 0.4, 0], chest: [-0.1, 0.6, 0], head: [-0.3, 0, 0], shoulderR: [-2.8, 0, 0.2], elbowR: [-0.1, 0, 0], weapon: [1.55, -0.4, 1.2], ...LEGS_LUNGE }], [2.55, {}], [2.95, 'win']],
    cam: [[0, { ref: 'self', p: [0.8, 0.4, 2.2], l: [0, 1.5, 0], fov: 40 }], [0.5, { ref: 'self', p: [3, 1.2, 1.6], l: [0, 2.2, 2.5], fov: 50 }],
      [1.05, { ref: 'target', p: [4.5, 0.9, -3.2], l: [0, 1.1, 0], fov: 55 }], [1.8, { ref: 'target', p: [-4, 0.6, -4], l: [0, 1.6, 0], fov: 55 }],
      [2.3, { ref: 'target', p: [-1.5, 2.2, -8.5], l: [0, 2.8, 0], fov: 58 }], [2.95, { ref: 'target', p: [-1.5, 2.6, -9.5], l: [0, 3.2, 0], fov: 58 }]],
    ev: [
      [0, (f, o, G) => {
        f.ultTgt = o; o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; f.awakenT = 15; G.setTint(FIRE, 0.4); sfx('charge'); sfx('boom');
        G.say(f, '"차별의 사슬 따위… 전부 물어뜯어 주마!"');
        const c = f.pos.clone(); flameBurst(G, c.clone().setY(c.y + 1), 1.6, true); G.fx.ring(c.clone().setY(c.y + 0.05), { normal: new V3(0, 1, 0), r0: 0.3, r1: 5, life: 0.7, color: FIRE }); G.fx.beam(c, { r: 0.9, h: 9, color: FIRE, life: 0.7 });
        f.ultFrom = f.pos.clone(); f.ultTo = o.pos.clone().addScaledVector(new V3().subVectors(f.pos, o.pos).setY(0).normalize(), 1.7 * o.scale);
      }],
      [0.5, (f) => { f.float = true; f.onGround = false; sfx('jump'); sfx('dash'); }],
      [1.1, (f, o, G) => { o = f.ultTgt || o; if (!o) return;
        const c = o.pos.clone().setY(0); f.pos.copy(f.ultTo).setY(0); f.float = false; f.onGround = true; f.vel.set(0, 0, 0);
        explosion(G, c.clone().setY(1.0), 2); fireCrack(G, c, 6, 14); G.fx.beam(c, { r: 2.2, h: 26, color: FIRE, life: 0.9 }); G.fx.ring(c.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.5, r1: 8, life: 0.8, color: EMBER });
        G.shake(0.6); G.flash(0xffc080, 0.7); G.stage.flashSky && G.stage.flashSky(0.5);
        o.takeHit(f, { dmg: 180, kb: [0, 0], stun: 99, hs: 0.2, shake: 0.5, nokill: true, noScale: true, force: true, daze: 120, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(c) < 6) t.takeHit(f, { dmg: 120, kb: [6, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
      }],
      [1.3, (f, o, G) => { o = f.ultTgt || o; if (!o) return; for (let i = 0; i < 9; i++) G.spawn({ done: false, t: -i * 0.06, update(dt) { this.t += dt; if (this.t >= 0 && !this.d) { this.d = true; const p = o.pos.clone().add(new V3(rand(-3.2, 3.2), 0, rand(-3.2, 3.2))).setY(0.05); G.fx.beam(p, { r: 0.45, h: 6, color: i % 2 ? FIRE : EMBER, life: 0.4 }); flameBurst(G, p, 0.6, true); sfx('zap'); } if (this.t > 0.3) this.done = true; } }); }],
      [1.98, (f, o, G) => { o = f.ultTgt || o; if (!o) return;
        o.release(); sfx('heavy'); sfx('boom'); G.say(f, '"이게 마족의 영광이다!"');
        fireSlash(f, { r: 3.6, color: EMBER, tilt: Math.PI / 2 - 0.25, life: 0.4, at: [0, 1.3, 0.3] }); explosion(G, o.chest(new V3()), 1.2);
        o.takeHit(f, { dmg: 140, kb: [5, 13], stun: 0.9, hs: 0.18, shake: 0.4, noScale: true, force: true, daze: 80, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        G.slow(0.35, 0.5); G.flash(0xffffff, 0.45);
      }],
    ],
    tick: (f, o, G, t) => {
      if (t < 0.5) { const p = f.pos.clone().add(new V3(rand(-0.6, 0.6), rand(0, 1.8), rand(-0.6, 0.6))); G.fx.p(p, { vel: [0, rand(2, 5), 0], size: rand(0.3, 0.7), size1: 0.05, life: 0.5, color: Math.random() < 0.5 ? FIRE : EMBER, alpha: 0.9, drag: 1 }); }
      if (t > 0.5 && t < 1.1 && f.ultFrom) { const k = (t - 0.5) / 0.6; f.pos.lerpVectors(f.ultFrom, f.ultTo, k); f.pos.y = Math.sin(k * Math.PI) * 5.5 * (1 - k * 0.3); f.faceOpp(); G.fx.p(f.chest(), { size: 0.9, size1: 0.2, life: 0.3, color: FIRE, alpha: 0.7 }); }
    },
    end: (f, o, G) => { G.setTint(0, 0); f.float = false; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 70, aw = att.awakenT > 0;
  G.fx.impact(p, aw ? EMBER : FIRE, big ? 1.9 : 1.2, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? HOT : FIRE, life: 0.2 });
  G.fx.burst(p, big ? 18 : 8, FIRES, 5, { kind: 'ember' });
  if (aw) G.fx.burst(p, 8, FIRES, 3, { dir: new V3(0, 1, 0), spread: 0.8 });
}

// 각성 상태 갱신 (공격력 ×1.25 · 궤적 색)
const baseCreate = createModel;
function createModelWithAwaken(pal) {
  const m = baseCreate(pal), up = m.update;
  m.update = (dt, f) => {
    if (f.awakenT > 0) { f.awakenT -= dt; if (f.awakenT <= 0) { f.awakenT = 0; f.G.say && f.G.say(f, '"…쳇, 시간 다 됐네."'); } }
    f.dmgMul = f.awakenT > 0 ? 1.25 : 1;
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.awakenT > 0 ? EMBER : f.palette.accent);
    up(dt, f);
  };
  return m;
}

export default {
  id: 'azazel', name: '아자젤', short: '아자젤', title: 'OVERLORD · 양키 마족', scale: 1.0,
  desc: '근거리 · 화염 · 파워. "차별이라는 사슬을 끊어내고, 잃어버린 마족의 영광을 되찾겠어." 가시 철퇴 GRIGORI 를 휘두르는 양키 여고생. 각성하면 철퇴가 불길에 휩싸인다.',
  stats: { hp: 980, speed: 7.4, jump: 10, crit: 0.22 },
  palettes: [{ accent: FIRE, lining: 0xc8102a, hair: 0xd01c30, band: '#3a0a10' }, { accent: 0xb05aff, lining: 0x5a1a9a, hair: 0x8a2ad0, band: '#1a0a3a' }],
  skills: { heavy: { name: '작렬 찌르기', cd: 7 }, s1: { name: '사슬 낚아채기', cd: 9 }, s2: { name: '마염 선풍', cd: 12 }, ult: { name: '마왕 각성', sub: 'OVERLORD' } },
  moveList: [['좌클 ×4', '가로 휘두르기 → 올려치기 → 내려찍기(땅 균열) → 불꽃 어퍼(띄움)'], ['공중 좌클', '불붙은 철퇴로 낙하 강타 · 화염 폭발'],
    ['우클 · 작렬 찌르기', '돌진 찌르기 54 + 철퇴 끝 화염 폭발 88 (방어 불가)'], ['Shift · 사슬 낚아채기', '사슬을 던져 맞은 상대를 끌어온 뒤 후려치기 72'],
    ['E · 마염 선풍', '상대에게 파고드는 불꽃 소용돌이 2회전(22×6) → 화염 폭발 70, 띄움'], ['Q · 마왕 각성', '포효 → 도약 화염 강타 180 → 올려치기 140, 이후 15초 각성(공격력 ×1.25)'],
    ['C (타이밍) · 극한 회피', '순간 돌진 찌르기 + 폭발']],
  createModel: createModelWithAwaken, poses, moves, hitFx,
};
