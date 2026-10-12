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
Object.assign(poses, {
  // 양키 쪼그려 앉기: 오래 가만히 있으면 (무릎을 벌리고 쪼그려 앉아 철퇴는 어깨에, 왼팔은 무릎에 걸치고 올려다본다)
  idle2: { hipY: -0.05, hips: [0, 0.15, 0], spine: [0.42, -0.1, 0], chest: [0.12, -0.1, 0], head: [-0.42, 0.2, -0.1],
    shoulderR: [-0.95, 0, -0.5], elbowR: [-1.9, 0, 0], weapon: [0.55, 2.9, 1.57], shoulderL: [-0.85, 0, 0.35], elbowL: [-0.75, 0, 0],
    hipL: [-1.55, 0, 0.62], kneeL: [2.45, 0, 0], footL: [-0.55, 0, 0], hipR: [-1.5, 0, -0.62], kneeR: [2.45, 0, 0], footR: [-0.55, 0, 0] },
  // 타자 자세 (홈런 스윙 준비): 철퇴를 오른쪽 뒤로 높이 들고 몸을 비튼다
  batter: { hips: [0, -0.95, 0], spine: [0.15, -0.5, 0], chest: [0, -0.7, 0], head: [0, 0.95, 0], shoulderR: [-1.0, 0, -0.95], elbowR: [-1.35, 0, 0], weapon: [0.55, 2.55, 0.3],
    hipL: [-0.25, 0, 0.25], kneeL: [0.5, 0, 0], hipR: [0.15, 0, -0.3], kneeR: [0.45, 0, 0] },
  swingThru: { hips: [0, 0.6, 0], spine: [0.25, 0.45, 0], chest: [0.05, 0.8, 0], head: [0, -0.4, 0], shoulderR: [-1.4, 0, 0.3], elbowR: [-0.15, 0, 0], weapon: [0.15, -0.2, 0], hipL: [-1.0, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.3, 0, 0] },
  follow: { hips: [0, 0.8, 0], spine: [0.15, 0.55, 0], chest: [0, 1.15, 0], head: [0, -0.6, 0], shoulderR: [-2.0, 0, 0.6], elbowR: [-0.3, 0, 0], weapon: [0.75, -2.3, -0.4], hipL: [-0.6, 0, 0.15], kneeL: [0.6, 0, 0], hipR: [0.5, 0, -0.15], kneeR: [0.3, 0, 0] },
  // 한 손 철퇴 들어올림 / 내리치기
  bashUp: { hips: [0, -0.3, 0], spine: [0.05, -0.25, 0], chest: [-0.05, -0.3, 0], shoulderR: [-2.4, 0, -0.5], elbowR: [-1.2, 0, 0], weapon: [1.45, 2.2, 1.57], shoulderL: [-0.6, 0, 0.4], elbowL: [-1.2, 0, 0] },
  bashDn: { hips: [0, 0.25, 0], spine: [0.45, 0.15, 0], chest: [0.15, 0.25, 0], head: [-0.2, 0, 0], shoulderR: [-1.2, 0, -0.15], elbowR: [-0.2, 0, 0], weapon: [-0.6, 0.25, 1.57], shoulderL: [0.3, 0, 0.5], elbowL: [-1.3, 0, 0],
    hipL: [-1.0, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.3, 0, 0] },
  // 앞차기 (왼발)
  kickCh: { hips: [0, 0.1, 0], spine: [-0.1, 0, 0], chest: [-0.05, 0, 0], hipL: [-1.55, 0, 0.1], kneeL: [1.95, 0, 0], footL: [-0.3, 0, 0], hipR: [0.1, 0, -0.05], kneeR: [0.25, 0, 0], shoulderL: [-0.4, 0, 0.6], elbowL: [-1.3, 0, 0] },
  kickEx: { hips: [0, 0.15, 0], spine: [-0.3, 0, 0], chest: [-0.12, 0, 0], head: [0.15, 0, 0], hipL: [-1.45, 0, 0], kneeL: [0.05, 0, 0], footL: [0.55, 0, 0], hipR: [0.15, 0, -0.05], kneeR: [0.3, 0, 0], shoulderL: [0.3, 0, 0.7], elbowL: [-1.0, 0, 0] },
});
const LEGS_LUNGE = { hipL: [-1.0, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.3, 0, 0] };

/* =====================================================================
   불꽃 이펙트 도구
   ===================================================================== */
const fireSlash = (f, o) => f.slashFx({ r: o.r || 2.2, color: o.color ?? ((f.fireK || 0) > 0.5 ? EMBER : FIRE), life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.0, 0.35] });
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
    this.G = G; this.f = f; this.t = 0; this.done = false; this.phase = 'out'; this.hooked = null; this.pullTo = 1.05;
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
      const t = this.hooked, k = Math.min(1, this.t / 0.24), dest = f.local([0, 0, this.pullTo + 0.3 * t.scale]);
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


// 바닥에 남는 불길 (양키 돌격의 철퇴 자국) — 잠시 타오르며 밟은 상대에게 짧은 화상
class FireZone {
  constructor(G, f, p) { this.G = G; this.f = f; this.p = p.clone(); this.t = 0; this.life = 2.4; this.done = false; this.tick = 0; }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt; if (this.t > this.life) { this.done = true; return; }
    const k = 1 - this.t / this.life;
    if (Math.random() < 0.7 * k + 0.2) G.fx.p(this.p.clone().add(new V3(rand(-0.25, 0.25), 0.05, rand(-0.25, 0.25))), { vel: [rand(-0.3, 0.3), rand(1.2, 2.6), rand(-0.3, 0.3)], size: rand(0.25, 0.5) * (0.5 + k), size1: 0.04, life: rand(0.3, 0.5), color: Math.random() < 0.5 ? FIRE : EMBER, alpha: 0.85, drag: 1.5 });
    if (this.tick <= 0) {
      this.tick = 0.15; f.burnCd = f.burnCd || {};
      for (const t of f.foes()) { if (Math.hypot(t.pos.x - this.p.x, t.pos.z - this.p.z) > 0.75 * t.scale + 0.3 || t.pos.y - this.p.y > 0.5) continue; const last = f.burnCd[t.id] || -9; if (G.time - last < 0.45) continue; f.burnCd[t.id] = G.time; t.takeHit(f, { dmg: 10, kb: [0.6, 0], stun: 0.22, daze: 5, noCrit: true }, new V3(0, 0, 0).subVectors(t.pos, this.p).setY(0).normalize()); }
    }
  }
}
// 화염 숨결: 입에서 부채꼴로 뿜는 불길 + 0.12초마다 부채꼴 안 상대에게 피해
function breathTick(f, G, t, dt) {
  const J = f.model.J; J.head.updateMatrixWorld(true);
  const mouth = J.head.localToWorld(new V3(0, 0.06, 0.1)), fw = f.fwd(new V3()), dir = fw.clone().add(new V3(0, -0.12, 0)).normalize();
  for (let i = 0; i < 7; i++) {
    const sp = new V3(rand(-0.22, 0.22), rand(-0.12, 0.12), rand(-0.22, 0.22)), v = dir.clone().add(sp).normalize().multiplyScalar(rand(11, 16));
    G.fx.p(mouth.clone().addScaledVector(dir, rand(0, 0.2)), { vel: [v.x, v.y, v.z], size: rand(0.15, 0.3), size1: rand(1.0, 1.6), life: rand(0.32, 0.42), color: [HOT, EMBER, FIRE][i % 3], alpha: 0.9, drag: 2.2 });
  }
  if (Math.random() < dt * 12) G.fx.p(mouth.clone().addScaledVector(dir, 4.5), { vel: [0, 1.5, 0], size: 1.2, size1: 2.2, life: 0.5, color: 0x3a2a26, alpha: 0.4, drag: 1 });
  f.breathAcc = (f.breathAcc || 0) + dt;
  if (f.breathAcc >= 0.12) {
    f.breathAcc = 0; sfx('swing');
    for (const o of f.foes()) {
      const rel = new V3().subVectors(o.pos, f.pos), y = rel.y; rel.y = 0; const d = rel.length(); if (d > 5.6 + 0.3 * o.scale || y > 2.2 || y < -1) continue;
      const ang = d < 0.5 ? 0 : Math.acos(Math.max(-1, Math.min(1, rel.normalize().dot(fw)))); if (ang > 0.5 + Math.atan2(0.4 * o.scale, d)) continue;
      o.takeHit(f, { dmg: 12, kb: [1.3, 0], stun: 0.32, daze: 7, noScale: true }, fw);
    }
  }
}

/* =====================================================================
   기술 — 거친 싸움꾼: 철퇴 + 발차기 · 몸통박치기 · 박치기 · 사슬 · 마족의 불
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 철퇴를 거꾸로 쥐고 내리꽂아 화염 폭발 --- */
  ...makePlunge({
    up: 'raised',
    fall: { ...poses.raised, spine: [0.25, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.0, 0, -0.15], elbowR: [-0.5, 0, 0], weapon: [-1.35, 0, 1.57], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.2, 0, 0] },
    land: { ...poses.slam, weapon: [-1.1, 0, 1.57] },
    color: FIRE, dmg: 76, r: 2.5,
    fx: (f, o, G, c) => { fireCrack(G, c, 2.6, 9); flameBurst(G, c, 1.1, true); },
  }),

  /* --- 기본 공격: 한 손 내리치기 → 앞차기 → 어깨 몸통박치기 → 두 손 홈런 스윙 --- */
  light1: { dur: 0.42, cancel: 0.22, next: 'light2', trail: true, track: 0.08, ikOff: true,
    keys: [[0, 'bashUp'], [0.1, 'bashDn'], [0.2, { weapon: [-0.78, 0.2, 1.57] }], [0.42, 'base']],
    lunge: [[0.03, 0.15, 7.5]],
    ev: [[0.05, () => sfx('swing')], [0.1, (f, o, G) => { sfx('heavy'); fireSlash(f, { tilt: Math.PI / 2 - 0.35, r: 1.9, at: [-0.1, 1.2, 0.3] }); G.fx.burst(f.local([-0.15, 0.05, 1.3]), 8, FIRES, 3, { kind: 'ember' }); }]],
    hits: [{ t0: 0.05, t1: 0.15, dmg: 42, kb: [2.5, 0], stun: 0.38, daze: 13 }] },
  light2: { dur: 0.46, cancel: 0.25, next: 'light3', track: 0.08, ikOff: true,
    keys: [[0, 'kickCh'], [0.09, 'kickEx'], [0.2, {}], [0.3, { hipL: [-0.6, 0, 0.1], kneeL: [0.6, 0, 0] }], [0.46, 'base']],
    lunge: [[0.04, 0.14, 4]],
    ev: [[0.08, (f, o, G) => { sfx('hit'); G.fx.burst(f.local([-0.09, 0.8, 0.9]), 10, [0xffffff, EMBER], 4); G.fx.ring(f.local([-0.09, 0.8, 0.95]), { r0: 0.1, r1: 0.7, life: 0.2, color: 0xffffff, billboard: true }); }]],
    hits: [{ t0: 0.07, t1: 0.16, weapon: false, at: [-0.09, 0.8, 0.82], r: 0.46, dmg: 40, kb: [2.6, 0], stun: 0.48, daze: 14 }] },
  light3: { dur: 0.5, cancel: 0.28, next: 'light4', track: 0.1, ikOff: true,
    keys: [[0, { hips: [0, -0.9, 0], spine: [0.3, -0.6, 0], chest: [0.1, -0.5, 0], shoulderL: [0.2, 0, 0.2], elbowL: [-1.7, 0, 0], hipL: [-0.7, 0, 0.2], kneeL: [0.9, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.5, 0, 0] }],
      [0.07, {}], [0.16, { hips: [0, -1.2, 0], spine: [0.5, -0.85, 0], hipL: [-1.0, 0, 0.15], kneeL: [0.8, 0, 0], hipR: [0.7, 0, -0.1], kneeR: [0.3, 0, 0] }], [0.3, {}], [0.5, 'base']],
    lunge: [[0.04, 0.22, 12]],
    ev: [[0.06, () => sfx('dash')], [0.13, (f, o, G) => { sfx('big'); G.shake(0.1); G.fx.burst(f.local([0.15, 1.15, 0.55]), 14, [0xffffff, FIRE], 5); }]],
    hits: [{ t0: 0.06, t1: 0.24, weapon: false, at: [0.15, 1.12, 0.55], r: 0.58, dmg: 48, kb: [3.2, 0], stun: 0.6, hs: 0.08, daze: 18 }] },
  light4: { dur: 0.82, track: 0.18, trail: true,
    keys: [[0, 'batter'], [0.2, { weapon: [0.62, 2.78, 0.3], chest: [0, -0.8, 0] }], [0.3, 'swingThru'], [0.42, 'follow'], [0.62, {}], [0.82, 'base']],
    start: (f, o, G) => sfx('charge'),
    lunge: [[0.22, 0.32, 5]],
    ev: [[0.23, () => sfx('swing')], [0.29, (f, o, G) => { sfx('heavy'); fireSlash(f, { tilt: 0.05, r: 2.6, at: [0, 1.0, 0.25], life: 0.32 }); }]],
    hits: [{ t0: 0.24, t1: 0.36, dmg: 80, kb: [13, 4.5], stun: 0.9, hs: 0.18, shake: 0.3, daze: 34, snd: 'big', br: 0.2 }] },

  /* --- 우클: 사슬 낚아채기 → 박치기 --- */
  heavy: { dur: 0.98, cd: 'heavy', ikOff: true, aim: true, track: 0.14, shout: true,
    keys: [[0, { spine: [0.1, 0.35, 0], chest: [0.05, 0.4, 0], shoulderL: [-0.6, 0, 0.9], elbowL: [-1.6, 0, 0] }],
      [0.12, { shoulderL: [-1.65, 0, 0.2], elbowL: [-0.1, 0, 0], ...LEGS_LUNGE }], [0.34, { spine: [-0.2, 0.1, 0], chest: [-0.15, 0.1, 0], head: [-0.4, 0, 0], shoulderL: [-0.4, 0, 0.5], elbowL: [-1.7, 0, 0] }],
      [0.45, { spine: [0.6, 0, 0], chest: [0.25, 0, 0], head: [0.5, 0, 0], hipL: [-0.9, 0, 0.1], kneeL: [0.9, 0, 0], hipR: [0.6, 0, -0.1], kneeR: [0.3, 0, 0] }], [0.6, {}], [0.98, 'base']],
    start: (f, o, G) => { f.hooked = null; G.say(f, '"어딜 도망가!"'); },
    ev: [[0.12, (f, o, G) => { sfx('shot'); sfx('dash'); G.spawn(new ChainHook(G, f, o)); }],
      [0.45, (f, o, G) => { const p = f.model.J.head.getWorldPosition(new V3()).addScaledVector(f.fwd(new V3()), 0.3); sfx('big'); sfx('block'); G.shake(0.2);
        G.fx.ring(p, { r0: 0.1, r1: 1.1, life: 0.25, color: 0xffffff, billboard: true }); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; G.fx.p(p.clone().add(new V3(Math.cos(a) * 0.4, 0.35 + Math.sin(a) * 0.12, Math.sin(a) * 0.4)), { size: 0.22, size1: 0.05, life: 0.6, color: 0xffe060, alpha: 1 }); } }]],
    hits: [{ t0: 0.44, t1: 0.54, weapon: false, at: [0, 1.38, 0.55], r: 0.48, dmg: 70, kb: [6, 2], stun: 1.1, hs: 0.16, shake: 0.15, daze: 55, snd: 'big' }],
    end: (f) => { if (f.chainHook) f.chainHook.phase = 'back'; } },

  /* --- Shift: 양키 돌격 — 철퇴를 바닥에 끌며 돌진(불길 자국), 골프 스윙으로 띄움 --- */
  s1: { dur: 1.12, cd: 's1', aim: true, trail: true, ikOff: true,
    keys: [[0, { spine: [0.5, 0, 0], chest: [0.15, 0, 0], head: [-0.35, 0, 0], shoulderR: [0.55, 0, -0.35], elbowR: [-0.2, 0, 0], weapon: [-0.42, 2.85, 0.5], shoulderL: [-0.8, 0, 0.3], elbowL: [-1.3, 0, 0], hipL: [-0.9, 0, 0.1], kneeL: [1.0, 0, 0], hipR: [0.5, 0, -0.1], kneeR: [0.6, 0, 0] }],
      ...[0.12, 0.24, 0.36, 0.48, 0.6].map((t, i) => [t, i % 2 ? { hipL: [-0.9, 0, 0.1], kneeL: [0.9, 0, 0], hipR: [0.6, 0, -0.1], kneeR: [0.9, 0, 0], shoulderL: [-0.8, 0, 0.3] } : { hipL: [0.6, 0, 0.1], kneeL: [0.9, 0, 0], hipR: [-0.9, 0, -0.1], kneeR: [0.9, 0, 0], shoulderL: [0.6, 0, 0.3] }]),
      [0.7, { hips: [0, -0.5, 0], spine: [0.45, -0.35, 0], chest: [0.1, -0.4, 0], shoulderR: [0.3, 0, -0.65], weapon: [-0.65, 2.1, 0.9], hipL: [-0.7, 0, 0.2], kneeL: [1.0, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.7, 0, 0] }],
      [0.86, { hips: [0, 0.45, 0], spine: [-0.15, 0.4, 0], chest: [-0.1, 0.6, 0], head: [-0.3, 0, 0], shoulderR: [-2.75, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [1.55, -0.3, 1.2], hipL: [-0.3, 0, 0.1], kneeL: [0.3, 0, 0], hipR: [0.4, 0, -0.1], kneeR: [0.2, 0, 0] }], [0.98, {}], [1.12, 'base']],
    start: (f, o, G) => { G.say(f, '"비켜, 방해야!"'); sfx('dash'); f.zoneT = 0; },
    tick: (f, o, G, t, dt) => {
      if (t > 0.06 && t < 0.7) {
        if (o && !o.gone && f.dist() < 12) f.faceOpp(5, dt);
        const fw = f.fwd(new V3()); f.vel.x = fw.x * 12.5; f.vel.z = fw.z * 12.5;
        if (o && !o.gone && f.dist() < 0.95 + 0.3 * o.scale && f.hitDone.size) f.at = Math.max(f.at, 0.66); // 붙으면 바로 올려치기로
        f.zoneT -= dt; const tip = f.model.clubTip(new V3()); tip.y = f.pos.y + 0.02;
        if (f.zoneT <= 0) { f.zoneT = 0.06; G.spawn(new FireZone(G, f, tip)); }
        G.fx.burst(tip, 2, [HOT, EMBER], 3, { kind: 'ember', lk: 0.6 }); if (Math.random() < dt * 20) sfx('swing');
      } else if (t >= 0.7 && t < 0.75) { f.vel.x *= 0.3; f.vel.z *= 0.3; }
    },
    ev: [[0.76, (f, o, G) => { sfx('heavy'); sfx('charge'); fireSlash(f, { tilt: Math.PI / 2 - 0.25, r: 2.3, at: [0, 0.9, 0.35], flip: true }); const c = f.local([0, 0, 1.3]); G.fx.beam(c, { r: 0.4, h: 3.5, color: FIRE, life: 0.3 }); }]],
    hits: [{ t0: 0.08, t1: 0.68, weapon: false, at: [0, 1.0, 0.6], r: 0.62, dmg: 30, kb: [3, 0], stun: 0.5, daze: 12 }, { t0: 0.74, t1: 0.9, dmg: 64, kb: [3, 10.5], stun: 0.7, hs: 0.12, shake: 0.15, daze: 30, snd: 'big', br: 0.2 }] },

  /* --- E: 마족의 숨결 — 숨을 들이켰다가 입으로 화염을 뿜는다 (부채꼴 지속 피해) --- */
  s2: { dur: 1.4, cd: 's2', aim: true, track: 1.15, shout: true,
    keys: [[0, { spine: [-0.32, 0, 0], chest: [-0.25, 0, 0], head: [-0.5, 0, 0], shoulderL: [-0.2, 0, 0.6], elbowL: [-0.6, 0, 0], hipL: [-0.2, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [0.2, 0, -0.15], kneeR: [0.2, 0, 0] }],
      [0.26, { spine: [0.42, 0, 0], chest: [0.22, 0, 0], head: [0.15, 0, 0], shoulderL: [-0.5, 0, 0.9], elbowL: [-0.3, 0, 0], hipL: [-0.65, 0, 0.2], kneeL: [0.75, 0, 0], hipR: [0.45, 0, -0.2], kneeR: [0.4, 0, 0] }],
      [1.15, {}], [1.4, 'base']],
    start: (f, o, G) => { G.say(f, '"다 태워주지!"'); sfx('charge'); f.breathAcc = 0; },
    tick: (f, o, G, t, dt) => {
      if (t < 0.24) { const m = f.model.J.head.localToWorld(new V3(0, 0.06, 0.1)); const p = m.clone().add(new V3(rand(-1.2, 1.2), rand(-0.6, 0.8), rand(0.4, 1.6)).applyAxisAngle(new V3(0, 1, 0), f.yaw)); const v = m.clone().sub(p).multiplyScalar(4); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.02, life: 0.25, color: EMBER, alpha: 0.8 }); f.breathing = false; }
      else if (t < 1.15) { f.breathing = true; breathTick(f, G, t, dt); if (Math.random() < dt * 6) G.fx.light(f.local([0, 1.3, 1.5]), FIRE, 60, 0.2, 8); }
      else f.breathing = false;
    },
    end: (f) => { f.breathing = false; } },

  /* --- 극한 회피 뒤 좌클: 드롭킥 --- */
  counter: { dur: 0.66, aim: true, ikOff: true,
    keys: [[0, { hips: [-0.5, 0, 0], spine: [-0.35, 0, 0], head: [0.3, 0, 0], hipL: [-1.55, 0, 0.12], kneeL: [0.15, 0, 0], footL: [0.5, 0, 0], hipR: [-1.45, 0, -0.12], kneeR: [0.2, 0, 0], footR: [0.5, 0, 0], shoulderL: [0.6, 0, 1.0], elbowL: [-0.3, 0, 0] }],
      [0.3, {}], [0.45, { hips: [0, 0, 0], spine: [0.2, 0, 0], ...LEGS_LUNGE }], [0.66, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest();
      if (o) { const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? 0 : o.pos.y).addScaledVector(d, 1.6 + 0.4 * o.scale); f.faceOpp(); }
      f.vel.y = 3.5; f.onGround = false; for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.chest(), i / 8), { size: 0.8, size1: 0.2, life: 0.3, color: FIRE, alpha: 0.7 });
      sfx('dash'); G.flash(FIRE, 0.2); f.model.resetCloth();
    }], [0.08, (f, o, G) => { sfx('big'); explosion(G, f.local([0, 0.9, 0.9]), 0.55); }]],
    lunge: [[0, 0.22, 7]],
    hits: [{ t0: 0.04, t1: 0.24, weapon: false, at: [0, 0.9, 0.75], r: 0.55, dmg: 96, kb: [9, 3], stun: 0.6, hs: 0.12, shake: 0.15, daze: 45, snd: 'big' }] },

  /* --- Q: OVERLORD — 족쇄 사슬을 스스로 끊고 → 돌진 → 난타 → 풀스윙 홈런. 이후 12초 각성 --- */
  ult: { dur: 3.3, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, { ...poses.roar, shoulderR: [-1.0, 0, -0.9], shoulderL: [-1.0, 0, 0.9], elbowR: [-1.4, 0, 0], elbowL: [-1.4, 0, 0], weapon: [0.6, 1.4, 0.4] }],
      [0.4, { shoulderR: [-1.1, 0, -1.1], shoulderL: [-1.1, 0, 1.1], elbowR: [-1.2, 0, 0], elbowL: [-1.2, 0, 0] }],
      [0.5, { spine: [-0.35, 0, 0], head: [-0.5, 0, 0], shoulderR: [-2.3, 0, -1.2], elbowR: [-0.2, 0, 0], shoulderL: [-2.3, 0, 1.2], elbowL: [-0.2, 0, 0] }],
      [0.62, { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], head: [-0.3, 0, 0], shoulderR: [0.6, 0, -0.3], elbowR: [-0.4, 0, 0], weapon: [0.2, 2.9, 1.2], shoulderL: [0.8, 0, 0.3], elbowL: [-0.6, 0, 0], hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.9, 0, 0] }],
      [0.86, 'bashUp'], [0.98, 'bashDn'], [1.06, { ...poses.bashUp, weapon: [1.3, -1.0, 1.0], shoulderR: [-2.2, 0, 0.2] }], [1.16, { ...poses.bashDn, weapon: [0.1, 1.6, 0.3], chest: [0.1, -0.6, 0], shoulderR: [-1.5, 0, -1.0] }],
      [1.24, 'kickCh'], [1.32, 'kickEx'], [1.44, 'bashUp'], [1.54, 'bashDn'],
      [1.75, 'batter'], [2.2, { weapon: [0.7, 2.85, 0.3], chest: [0, -0.85, 0] }], [2.32, 'swingThru'], [2.46, 'follow'], [2.8, {}], [3.3, 'win']],
    cam: [[0, { ref: 'self', p: [0.6, 0.35, 1.9], l: [0, 1.25, 0], fov: 38 }], [0.5, { ref: 'self', p: [1.6, 0.6, 2.4], l: [0, 1.3, 0], fov: 46 }],
      [0.85, { ref: 'target', p: [3.6, 0.8, -1.4], l: [0, 1.1, 0], fov: 52 }], [1.6, { ref: 'target', p: [2.6, 0.5, -2.6], l: [0, 1.2, 0], fov: 50 }],
      [2.15, { ref: 'self', p: [-1.4, 1.5, -2.2], l: [0, 1.2, 3], fov: 52 }], [2.5, { ref: 'self', p: [-2.2, 1.8, -3.2], l: [0, 1.6, 8], fov: 58 }], [3.3, { ref: 'self', p: [-2.4, 2.4, -4], l: [0, 2.4, 14], fov: 60 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; G.setTint(FIRE, 0.38); sfx('charge'); G.say(f, '"차별의 사슬 따위…"'); f.ultFrom = f.pos.clone(); }],
      [0.5, (f, o, G) => {
        f.awakenT = 12; f.heat = 100; sfx('boom'); sfx('parry'); G.shake(0.35); G.flash(0xffa060, 0.4); G.say(f, '"…전부 물어뜯어 주마!"');
        for (const h of [f.model.J.handL, f.model.J.handR]) { const p = h.getWorldPosition(new V3()); G.fx.burst(p, 18, [0x8a8a94, 0xc8c8d0], 7, { kind: 'dust', sk: 0.5 }); G.fx.burst(p, 20, FIRES, 6); G.fx.ring(p, { r0: 0.1, r1: 1.2, life: 0.3, color: EMBER, billboard: true }); }
        flameBurst(G, f.pos.clone().setY(f.pos.y + 1), 1.4, true); G.fx.beam(f.pos.clone(), { r: 0.8, h: 8, color: FIRE, life: 0.6 });
      }],
      ...[0.98, 1.16, 1.32, 1.54].map((t, i) => [t, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx(i % 2 ? 'heavy' : 'big'); const p = o.chest(new V3()); explosion(G, p, 0.5); o.takeHit(f, { dmg: 38, kb: [0, 0], stun: 99, hs: 0.06, nokill: true, noScale: true, force: true, daze: 20 }, f.fwd(new V3())); }]),
      [2.0, (f, o, G) => { G.say(f, '"날아가버려!!"'); sfx('charge'); }],
      [2.3, (f, o, G) => { o = f.ultTgt || o; if (!o) return;
        o.release(); sfx('boom'); sfx('big'); const p = o.chest(new V3()); explosion(G, p, 2); fireSlash(f, { tilt: 0.05, r: 3.4, at: [0, 1.0, 0.25], life: 0.4, color: EMBER });
        G.fx.beam(p.clone().setY(0), { r: 1.4, h: 14, color: FIRE, life: 0.6 }); G.shake(0.6); G.stage.flashSky && G.stage.flashSky(0.5);
        o.takeHit(f, { dmg: 220, kb: [17, 8], stun: 1.0, hs: 0.25, shake: 0.5, noScale: true, force: true, daze: 100, snd: 'big' }, f.fwd(new V3()));
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(f.pos) < 5) t.takeHit(f, { dmg: 110, kb: [9, 6], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, f.pos).setY(0).normalize());
        G.slow(0.3, 0.55);
      }],
    ],
    tick: (f, o, G, t) => {
      o = f.ultTgt || o;
      if (t < 0.5) { const p = f.pos.clone().add(new V3(rand(-0.6, 0.6), rand(0, 1.8), rand(-0.6, 0.6))); G.fx.p(p, { vel: [0, rand(2, 5), 0], size: rand(0.3, 0.7), size1: 0.05, life: 0.5, color: Math.random() < 0.5 ? FIRE : EMBER, alpha: 0.9, drag: 1 }); }
      // 돌진: 0.6 ~ 0.84 초에 상대 바로 앞까지
      if (t > 0.6 && t < 0.85 && o && f.ultFrom) { if (!f.ultTo) f.ultTo = o.pos.clone().addScaledVector(new V3().subVectors(f.ultFrom, o.pos).setY(0).normalize(), 1.35 * o.scale); const k = Math.min(1, (t - 0.6) / 0.24); f.pos.lerpVectors(f.ultFrom, f.ultTo, k * k * (3 - 2 * k)); f.faceOpp(); G.fx.p(f.chest(), { size: 0.9, size1: 0.2, life: 0.3, color: FIRE, alpha: 0.7 }); }
      if (t > 0.85 && o) f.faceOpp();
    },
    end: (f, o, G) => { G.setTint(0, 0); f.ultTo = null; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 70, fk = att.fireK || 0;
  G.fx.impact(p, fk > 0.5 ? EMBER : FIRE, big ? 1.9 : 1.2, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? HOT : FIRE, life: 0.2 });
  G.fx.burst(p, big ? 18 : 8, FIRES, 5, { kind: 'ember' });
  if (fk > 0.5) { G.fx.burst(p, 10, FIRES, 4, { dir: new V3(0, 1, 0), spread: 0.8 }); G.fx.light(p, FIRE, 40, 0.15, 6); }
  // 열기: 때릴 때마다 쌓인다 (각성·발화 중에는 쌓지 않음)
  if (!(att.awakenT > 0) && !(att.igniteT > 0)) att.heat = Math.min(100, (att.heat || 0) + h.dmg * 0.32);
}

// 열기 · 발화 · 각성 상태 갱신 → 모델 불꽃 세기(fireK) · 공격력 배율 · 궤적 색
function createModelWithHeat(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (f.awakenT > 0) { f.awakenT -= dt; if (f.awakenT <= 0) { f.awakenT = 0; f.heat = 0; f.G.say && f.G.say(f, '"…쳇, 시간 다 됐네."'); } }
    if (f.igniteT > 0) { f.igniteT -= dt; if (f.igniteT <= 0) { f.igniteT = 0; f.heat = 0; } }
    else if ((f.heat || 0) >= 100 && !(f.awakenT > 0)) {
      f.igniteT = 8; f.heat = 100; f.G.say && f.G.say(f, '"불 붙었다!"'); sfx('charge');
      const p = m.clubTip(new V3()); f.G.fx.burst(p, 30, FIRES, 6); f.G.fx.ring(p, { r0: 0.1, r1: 1.4, life: 0.35, color: EMBER, billboard: true });
    }
    f.fireK = f.awakenT > 0 ? 1 : f.igniteT > 0 ? 0.8 : ((f.heat || 0) / 100) * 0.35;
    f.dmgMul = f.awakenT > 0 ? 1.25 : f.igniteT > 0 ? 1.15 : 1;
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.fireK > 0.5 ? EMBER : f.palette.accent);
    up(dt, f);
  };
  return m;
}

export default {
  id: 'azazel', name: '아자젤', short: '아자젤', title: 'OVERLORD · 양키 마족', scale: 1.0,
  desc: '근거리 · 난타 · 화염. "차별이라는 사슬을 끊어내고, 잃어버린 마족의 영광을 되찾겠어." 철퇴·발차기·박치기로 들이받는 양키 싸움꾼. 때릴수록 열기가 쌓이고, 가득 차면 철퇴에 불이 붙는다.',
  stats: { hp: 980, speed: 7.6, jump: 10, crit: 0.22 },
  palettes: [{ accent: FIRE, lining: 0xc8102a, hair: 0xd01c30, band: '#3a0a10' }, { accent: 0xb05aff, lining: 0x5a1a9a, hair: 0x8a2ad0, band: '#1a0a3a' }],
  skills: { heavy: { name: '사슬 낚아채기', cd: 7 }, s1: { name: '양키 돌격', cd: 9 }, s2: { name: '마족의 숨결', cd: 11 }, ult: { name: 'OVERLORD', sub: '사슬을 끊은 마왕' } },
  // HUD 고유 자원: 열기 게이지
  resource: (f) => f.awakenT > 0 ? { v: f.awakenT / 12, label: '각성', color: 0xffa52a, full: true } : f.igniteT > 0 ? { v: f.igniteT / 8, label: '발화', color: 0xff4a1a, full: true } : { v: (f.heat || 0) / 100, label: '열기', color: 0xc8102a },
  moveList: [['좌클 ×4', '한 손 내리치기 → 앞차기 → 어깨 몸통박치기 → 두 손 홈런 스윙(멀리 날림)'], ['공중 좌클', '불붙은 철퇴로 낙하 강타 · 화염 폭발'],
    ['우클 · 사슬 낚아채기', '사슬을 던져 끌어온 뒤 박치기 70, 기절'], ['Shift · 양키 돌격', '철퇴를 바닥에 끌며 돌진(불타는 자국이 남음) → 골프 스윙으로 띄움 64'],
    ['E · 마족의 숨결', '숨을 들이켰다가 입으로 부채꼴 화염 방사 (0.12초마다 12)'], ['Q · OVERLORD', '족쇄 사슬을 스스로 끊음 → 돌진 → 4연속 난타 → 풀스윙 홈런 220, 이후 12초 각성(공격력 ×1.25)'],
    ['열기', '때릴수록 쌓이고 가득 차면 8초간 발화: 철퇴에 불이 붙고 공격력 ×1.15'], ['C (타이밍) · 극한 회피', '순간이동 드롭킥 + 폭발'], ['가만히', '양키 쪼그려 앉기']],
  createModel: createModelWithHeat, poses, moves, hitFx,
};
