// 아리엘 (AQUARIST) — 원거리 · 물 마법 · 견제
// "낙천적이고 호기심 많은 소녀. 바다 정령의 힘을 빌려 원거리 마법을 쓴다.
//  누군가에게 마력의 일부를 빼앗겨, 그것을 되찾기 위해 여행 중."
// 무기: 금빛 지팡이 + 아쿠아마린 — 물방울 탄 · 물의 창 · 거품 감옥 · 소용돌이 · 바다 정령(고래)
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, AQUA, DEEP, FOAM, GOLDW } from './aquarist_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const WATERS = [AQUA, FOAM, 0x7ae8ff];
const RANGE = 30; // 조준 거리

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const poses = {
  // 기본: 지팡이를 오른손에 세워 들고, 왼손은 가볍게 — 고개를 갸웃한 밝은 자세
  base: { hips: [0, 0.12, 0.03], spine: [0.02, -0.06, 0], chest: [0, -0.06, 0], head: [0.04, 0.08, 0.1],
    shoulderR: [-0.2, 0, -0.34], elbowR: [-0.8, 0, 0], weapon: [1.38, 0.3, 0], shoulderL: [-0.32, 0, 0.1], elbowL: [-1.35, 0, 0.2], handL: [0, 0, -0.3],
    hipL: [-0.1, 0, 0.02], kneeL: [0.22, 0, 0], footL: [-0.1, 0, 0], hipR: [0.06, 0, -0.04], kneeR: [0.05, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.08, 0], spine: [0.22, 0.04, 0], chest: [0.04, 0.04, 0], head: [-0.1, 0, 0], shoulderR: [-0.45, 0, -0.32], elbowR: [-1.05, 0, 0], weapon: [1.05, 0.55, 0], shoulderL: [0.1, 0, 0.3], elbowL: [-0.9, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.2, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.2, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.3, 0, 0], kneeR: [1.4, 0, 0], footR: [0.4, 0, 0], shoulderL: [-0.6, 0, 0.8], elbowL: [-0.6, 0, 0], weapon: [1.0, 0.4, 0] },
  // 방어: 지팡이를 가로로 앞에 대고 왼손을 내밀어 물의 막
  guard: { hips: [0, -0.15, 0], spine: [0.12, 0.08, 0], chest: [0.04, 0.08, 0], shoulderR: [-1.05, 0, -0.1], elbowR: [-1.25, 0, 0], weapon: [0.2, -1.45, 0], shoulderL: [-1.3, 0, 0.15], elbowL: [-0.45, 0, 0],
    hipL: [-0.45, 0, 0.18], kneeL: [0.8, 0, 0], hipR: [0.3, 0, -0.18], kneeR: [0.6, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [1.1, 0.6, 0.4], shoulderL: [0.4, 0, 0.7], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.6, 1.2, 0.6], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.7, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -0.6, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.45, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.5, 0, -0.3], elbowR: [-0.6, 0, 0], weapon: [0.3, 2.6, 0.3], shoulderL: [0.7, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 지팡이를 치켜들고 왼손 브이
  win: { hips: [0, 0.15, 0.04], spine: [-0.05, -0.1, 0], chest: [-0.05, -0.12, 0], head: [-0.05, 0.15, 0.22], shoulderR: [-2.75, 0, -0.25], elbowR: [-0.3, 0, 0], weapon: [1.45, 0.2, 0],
    shoulderL: [-0.95, 0, 0.55], elbowL: [-2.3, 0, 0], hipL: [-0.1, 0, 0.08], kneeL: [0.15, 0, 0], hipR: [0.35, 0, -0.06], kneeR: [0.75, 0, 0], footR: [0.35, 0, 0] },
  portrait: { hips: [0, 0.1, 0], chest: [0, -0.15, 0], head: [-0.08, 0.18, 0.18], shoulderR: [-1.2, 0, -0.3], elbowR: [-1.3, 0, 0], weapon: [1.3, 0.3, 0], shoulderL: [-0.9, 0, 0.5], elbowL: [-2.2, 0, 0] },
  // 지팡이를 앞으로 겨눔 (보석이 상대를 향함)
  cast: { hips: [0, 0.3, 0], spine: [0.06, 0.22, 0], chest: [0.02, 0.2, 0], head: [0, -0.4, 0], shoulderR: [-1.5, 0, -0.08], elbowR: [-0.18, 0, 0], weapon: [0.08, 0, 0], shoulderL: [0.1, 0, 0.45], elbowL: [-0.6, 0, 0],
    hipL: [-0.5, 0, 0.12], kneeL: [0.55, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.25, 0, 0] },
  castPrep: { hips: [0, 0.4, 0], spine: [-0.04, 0.3, 0], chest: [-0.04, 0.25, 0], head: [0, -0.5, 0], shoulderR: [-1.0, 0, -0.5], elbowR: [-1.2, 0, 0], weapon: [0.6, 0.7, 0], shoulderL: [-0.2, 0, 0.4], elbowL: [-0.9, 0, 0] },
  // 왼손 장풍 (지팡이는 뒤로)
  palm: { hips: [0, -0.3, 0], spine: [0.08, -0.3, 0], chest: [0.02, -0.25, 0], head: [0, 0.45, 0], shoulderL: [-1.5, 0, 0.05], elbowL: [-0.1, 0, 0], shoulderR: [-0.1, 0, -0.5], elbowR: [-0.7, 0, 0], weapon: [1.0, 0.9, 0],
    hipL: [-0.55, 0, 0.12], kneeL: [0.55, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.25, 0, 0] },
  sweepA: { hips: [0, -0.5, 0], spine: [0.08, -0.4, 0], chest: [0, -0.45, 0], head: [0, 0.6, 0], shoulderR: [-1.2, 0, -0.7], elbowR: [-0.5, 0, 0], weapon: [0.15, 1.5, 0], shoulderL: [-0.3, 0, 0.4], elbowL: [-0.9, 0, 0] },
  sweepB: { hips: [0, 0.45, 0], spine: [0.1, 0.4, 0], chest: [0.02, 0.5, 0], head: [0, -0.6, 0], shoulderR: [-1.35, 0, 0.35], elbowR: [-0.15, 0, 0], weapon: [0.12, -1.1, 0], shoulderL: [0.2, 0, 0.5], elbowL: [-0.6, 0, 0],
    hipL: [-0.5, 0, 0.12], kneeL: [0.5, 0, 0], hipR: [0.4, 0, -0.12], kneeR: [0.3, 0, 0] },
  // 지팡이를 머리 위로
  raise: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.12, 0, 0], head: [-0.35, 0, 0], shoulderR: [-2.9, 0, -0.12], elbowR: [-0.25, 0, 0], weapon: [1.5, 0, 0], shoulderL: [-2.4, 0, 0.5], elbowL: [-0.4, 0, 0],
    hipL: [-0.2, 0, 0.12], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 창 던지기 준비 (지팡이를 뒤로 젖힘)
  lanceBack: { hips: [0, -0.6, 0], spine: [-0.1, -0.5, 0], chest: [-0.1, -0.5, 0], head: [0, 0.9, 0], shoulderR: [-2.2, 0, -0.8], elbowR: [-0.9, 0, 0], weapon: [0.4, 2.7, 0], shoulderL: [-1.4, 0, 0.3], elbowL: [-0.2, 0, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.5, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.4, 0, 0] },
  slam: { hips: [0, -0.15, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.1, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-1.2, 0, 0], shoulderL: [-0.6, 0, 0.5], elbowL: [-0.4, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.4, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 지팡이에 두 손을 얹고 한쪽 다리를 뒤로 접은 채 갸웃
  idle2: { hips: [0, 0.05, 0.05], spine: [0.12, 0, 0.04], chest: [0.06, 0, 0], head: [0.12, 0.15, 0.28],
    shoulderR: [-0.75, 0, 0.18], elbowR: [-1.35, 0, 0], weapon: [1.48, 0.05, 0], shoulderL: [-0.8, 0, -0.12], elbowL: [-1.3, 0, 0],
    hipL: [-0.04, 0, 0.04], kneeL: [0.1, 0, 0], hipR: [0.18, 0, -0.04], kneeR: [1.55, 0, 0], footR: [0.5, 0, 0] },
});
const LEGS_CAST = { hipL: [-0.5, 0, 0.12], kneeL: [0.55, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.25, 0, 0] };

/* =====================================================================
   물 재질 · 이펙트
   ===================================================================== */
// 가장자리가 빛나는 물 정령 재질 (가산 · 세로 그라데이션 → 물거품)
function waterMat(a = DEEP, b = FOAM, op = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uOp: { value: op }, uT: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uA; uniform vec3 uB; uniform float uOp; uniform float uT; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); float r = 0.5 + 0.5 * sin(vUv.y * 40.0 - uT * 9.0 + vUv.x * 12.0);
        vec3 c = mix(uA, uB, pow(vUv.y, 3.0) * 0.8 + f * 0.4); gl_FragColor = vec4(c * (0.28 + 1.5 * f + 0.12 * r) * uOp, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}
const SPH = new THREE.SphereGeometry(1, 20, 14);
function splash(G, p, s = 1, dir) {
  G.fx.burst(p, Math.round(18 * s), WATERS, 7 * s, dir ? { dir, spread: 1.2, grav: 12 } : { grav: 12 });
  G.fx.burst(p, Math.round(5 * s), AQUA, 1.5 * s, { kind: 'glow', sk: 0.7 * s });
  G.fx.p(p, { size: 0.9 * s, size1: 1.8 * s, life: 0.16, color: FOAM, alpha: 0.8 });
  G.fx.ring(p, { r0: 0.1, r1: 1.2 * s, life: 0.28, color: AQUA, billboard: true });
  G.fx.light(p, AQUA, 45 * s, 0.22, 8);
}
function groundSplash(G, c, r = 2) {
  G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.3, r1: r * 1.2, life: 0.45, color: AQUA }); G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.2, r1: r * 0.7, life: 0.32, color: FOAM });
  G.fx.burst(c.clone().setY(c.y + 0.2), Math.round(26 * r / 2), WATERS, 6 * r / 2, { dir: UP, spread: 0.9, grav: 14 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; G.fx.p(c.clone().add(new V3(Math.cos(a) * r * 0.5, 0.1, Math.sin(a) * r * 0.5)), { vel: [Math.cos(a) * 3, rand(3, 6), Math.sin(a) * 3], size: rand(0.25, 0.45), size1: 0.06, life: rand(0.4, 0.7), color: i % 2 ? AQUA : FOAM, alpha: 0.85, drag: 1, grav: 12 }); }
}
// 몸통 중심 (조준점)
const aimPt = (t, out = new V3()) => (t.hurt && t.hurt[0] ? out.copy(t.hurt[0].a).lerp(t.hurt[0].b, 0.45) : t.chest(out));
function aimDir(f, from, spread = 0) {
  const o = f.opp, d = o && !o.gone && o.state !== 'ko' && f.dist() < RANGE ? aimPt(o).sub(from).normalize() : f.fwd(new V3()).add(new V3(0, -0.03, 0)).normalize();
  if (spread) d.applyAxisAngle(UP, spread);
  return d;
}

/* =====================================================================
   물방울 탄 · 큰 거품: 유도 · 관통 · 폭발(범위)
   ===================================================================== */
class WaterOrb {
  // o: { pos, dir, speed, r, hit, homing, life, pierce, splash: { r, hit }, bubble, onHit(orb, t, res) }
  constructor(G, f, o) {
    this.G = G; this.owner = f; this.pos = o.pos.clone(); this.vel = o.dir.clone().multiplyScalar(o.speed ?? 22); this.r = o.r ?? 0.22; this.h = o.hit; this.o = o;
    this.life = o.life ?? 1.6; this.homing = o.homing ?? 0; this.t = 0; this.done = false; this.hitSet = new Set();
    this.mesh = new THREE.Group(); G.scene.add(this.mesh); this.mesh.position.copy(this.pos);
    this.shell = new THREE.Mesh(SPH, o.bubble ? bubbleMat() : waterMat(AQUA, FOAM, 0.9)); this.shell.scale.setScalar(this.r); this.mesh.add(this.shell);
    this.core = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: FOAM, transparent: true, opacity: o.bubble ? 0.12 : 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); this.core.scale.setScalar(this.r * 0.45); this.mesh.add(this.core);
    if (f.tideT > 0 && !o.bubble) this.core.material.color.setHex(GOLDW);
  }
  update(dt) {
    const G = this.G, f = this.owner, tgt = f.opp; this.t += dt;
    if (this.homing && tgt && !tgt.gone && tgt.state !== 'ko') { const sp = this.vel.length(), d = aimPt(tgt).sub(this.pos).normalize().multiplyScalar(sp); this.vel.lerp(d, 1 - Math.exp(-this.homing * dt)); }
    this.pos.addScaledVector(this.vel, dt); this.mesh.position.copy(this.pos);
    const wob = 1 + 0.12 * Math.sin(this.t * 38); this.shell.scale.set(this.r * wob, this.r / wob, this.r * wob); this.shell.material.uniforms && (this.shell.material.uniforms.uT.value = this.t);
    // 꼬리: 물보라 + 흩날리는 물방울
    G.fx.p(this.pos, { size: this.r * 2.2, size1: this.r * 0.3, life: 0.18, color: AQUA, alpha: 0.5, drag: 0 });
    if (Math.random() < 0.7) G.fx.p(this.pos.clone().add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(this.r * 0.6)), { vel: [rand(-0.6, 0.6), rand(-0.3, 0.8), rand(-0.6, 0.6)], size: rand(0.04, 0.08), size1: 0.01, life: rand(0.25, 0.45), color: FOAM, alpha: 0.9, drag: 1, grav: 6 });
    for (const t of f.foes()) {
      if (this.hitSet.has(t) || !t.hurtHit(this.pos, this.r)) continue;
      const res = t.takeHit(f, this.h, this.vel.clone().setY(0).normalize()); this.hitSet.add(t);
      if (res) { splash(G, this.pos, this.r * 3.5, this.vel.clone().normalize().negate()); this.o.onHit && this.o.onHit(this, t, res); if (!this.o.pierce) return this.burst(true); }
    }
    const W = G.stage && G.stage.world;
    if (this.t > this.life || this.pos.y < 0.05 || (W && W.solidAt(this.pos, this.r * 0.6)) || Math.hypot(this.pos.x, this.pos.z) > 40) this.burst(false);
  }
  burst(hit) {
    const G = this.G, s = this.o.splash;
    if (s) { sfx('boom'); G.shake(0.12); splash(G, this.pos, s.r * 0.9); G.fx.ring(this.pos, { r0: 0.2, r1: s.r * 1.3, life: 0.35, color: FOAM, billboard: true });
      for (const t of this.owner.foes()) if (!this.hitSet.has(t) && t.hurtHit(this.pos, s.r)) t.takeHit(this.owner, s.hit, new V3().subVectors(t.pos, this.pos).setY(0).normalize()); }
    else if (!hit) splash(G, this.pos, this.r * 2.2);
    this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.shell.material.dispose(); this.core.material.dispose(); }
}
function bubbleMat() { return new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0, metalness: 0, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 600], clearcoat: 1, emissive: AQUA, emissiveIntensity: 0.25, side: THREE.DoubleSide, depthWrite: false }); }
// 물방울 탄 발사 (보석에서) — 만조 중에는 공격력 ↑ · 작은 유도탄 하나 추가
function bolt(f, G, o = {}) {
  const from = f.model.gemPos(new V3()), dir = aimDir(f, from, o.spread || 0);
  G.spawn(new WaterOrb(G, f, { pos: from, dir, speed: o.speed ?? 24, r: o.r ?? 0.2, homing: o.homing ?? 2.2, life: o.life ?? 1.5, pierce: o.pierce, splash: o.splash, bubble: o.bubble, onHit: o.onHit,
    hit: { dmg: o.dmg ?? 24, kb: o.kb ?? [1.6, 0], stun: o.stun ?? 0.34, daze: o.daze ?? 10, hs: o.hs ?? 0.05, ...(o.hit || {}) } }));
  G.fx.burst(from, 6, WATERS, 3, { dir, spread: 0.5 }); G.fx.p(from, { size: 0.5, size1: 0.05, life: 0.12, color: FOAM, alpha: 0.9 });
  if (f.tideT > 0 && !o.noTide) G.spawn(new WaterOrb(G, f, { pos: from.clone().add(new V3(0, 0.15, 0)), dir: dir.clone().applyAxisAngle(UP, rand(-0.5, 0.5)).add(new V3(0, 0.2, 0)).normalize(), speed: 15, r: 0.12, homing: 6, life: 1.6, hit: { dmg: 10, kb: [0.8, 0], stun: 0.25, daze: 4, noScale: true } }));
}

/* ---------- 아쿠아 랜스: 관통하는 물의 창 ---------- */
class WaterLance {
  constructor(G, f, from, dir) {
    this.G = G; this.f = f; this.pos = from.clone(); this.dir = dir.clone(); this.t = 0; this.done = false; this.hitSet = new Set();
    this.mesh = new THREE.Group(); G.scene.add(this.mesh); this.mat = waterMat(DEEP, FOAM, 1.1);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1.5, 16, 6, true), this.mat); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.55; this.mesh.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 16), this.mat); tip.rotation.x = Math.PI / 2; tip.position.z = 0.5; this.mesh.add(tip);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.9, 8), new THREE.MeshBasicMaterial({ color: FOAM, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); core.rotation.x = Math.PI / 2; core.position.z = -0.2; this.mesh.add(core);
    this.geos = [shaft.geometry, tip.geometry, core.geometry]; this.core = core;
    this.mesh.position.copy(this.pos); this.mesh.lookAt(this.pos.clone().add(this.dir));
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.mat.uniforms.uT.value = this.t;
    this.pos.addScaledVector(this.dir, 38 * dt); this.mesh.position.copy(this.pos);
    for (let i = 0; i < 3; i++) { const a = this.t * 40 + i * 2.1, side = new V3().crossVectors(this.dir, UP).normalize(), up = new V3().crossVectors(side, this.dir); const p = this.pos.clone().addScaledVector(this.dir, -0.6).addScaledVector(side, Math.cos(a) * 0.22).addScaledVector(up, Math.sin(a) * 0.22); G.fx.p(p, { vel: [0, 0.3, 0], size: 0.12, size1: 0.02, life: 0.35, color: i ? AQUA : FOAM, alpha: 0.9, drag: 2 }); }
    G.fx.p(this.pos.clone().addScaledVector(this.dir, -0.9), { size: 0.7, size1: 0.1, life: 0.2, color: DEEP, alpha: 0.6, drag: 0 });
    for (const t of f.foes()) {
      if (this.hitSet.has(t)) continue;
      const a = this.pos.clone().addScaledVector(this.dir, -1.3), b = this.pos.clone().addScaledVector(this.dir, 0.8);
      if (!t.hurtHitSeg(a, b, 0.2)) continue; this.hitSet.add(t);
      if (t.takeHit(f, { dmg: 72, kb: [7, 2.5], stun: 0.75, hs: 0.12, shake: 0.18, daze: 30, snd: 'big' }, this.dir.clone().setY(0).normalize())) { splash(G, aimPt(t), 1.4, this.dir.clone().negate()); G.fx.slash(aimPt(t), { fwd: this.dir, normal: UP, r: 1.4, color: AQUA, life: 0.25 }); }
    }
    const W = G.stage && G.stage.world;
    if (this.t > 0.7 || this.pos.y < 0.05 || (W && W.solidAt(this.pos, 0.15))) { splash(G, this.pos, 1.3); this.kill(); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mat.dispose(); for (const g of this.geos) g.dispose(); this.core.material.dispose(); }
}

/* ---------- 버블 프리즌: 맞은 상대를 거품에 가둬 띄웠다가 터뜨린다 ---------- */
class BubblePrison {
  constructor(G, f, t) {
    this.G = G; this.f = f; this.tg = t; this.t = 0; this.done = false; this.dur = 1.7; this.y0 = t.pos.y;
    t.lock(); t.vel.set(0, 0, 0); f.prison = this;
    const R = 0.95 * t.scale; this.R = R;
    this.mesh = new THREE.Group(); G.scene.add(this.mesh);
    this.ball = new THREE.Mesh(SPH, bubbleMat()); this.ball.scale.setScalar(R); this.mesh.add(this.ball);
    this.rimM = waterMat(AQUA, FOAM, 0.55); this.rim = new THREE.Mesh(SPH, this.rimM); this.rim.scale.setScalar(R * 1.01); this.mesh.add(this.rim);
    sfx('zap'); G.fx.burst(aimPt(t), 24, WATERS, 5);
  }
  update(dt) {
    const G = this.G, t = this.tg; this.t += dt; this.rimM.uniforms.uT.value = this.t;
    if (t.gone || t.state === 'ko' || this.f.state === 'ko') return this.pop(false);
    const k = Math.min(1, this.t / 0.5), h = this.y0 + (1.0 + 0.08 * Math.sin(this.t * 4)) * k * t.scale;
    t.held = true; t.vel.set(0, 0, 0); t.pos.y += (h - t.pos.y) * Math.min(1, dt * 8); t.onGround = false; t.yaw += dt * 1.5;
    const c = t.pos.clone().add(new V3(0, 0.95 * t.scale, 0)); this.mesh.position.copy(c);
    const wob = 1 + 0.04 * Math.sin(this.t * 11); this.ball.scale.set(this.R * wob, this.R / wob, this.R * wob); this.rim.scale.copy(this.ball.scale).multiplyScalar(1.01);
    if (Math.random() < 0.5) G.fx.p(c.clone().add(new V3(rand(-0.5, 0.5), -this.R * 0.8, rand(-0.5, 0.5))), { vel: [rand(-0.2, 0.2), rand(0.8, 1.6), rand(-0.2, 0.2)], size: rand(0.06, 0.12), size1: 0.03, life: 0.6, color: FOAM, alpha: 0.8, drag: 0.5 });
    if (this.t >= this.dur) this.pop(true);
  }
  pop(dmg) {
    if (this.done) return; const G = this.G, t = this.tg, c = this.mesh.position.clone();
    this.kill();
    if (!dmg || t.gone) return;
    sfx('boom'); sfx('hit'); G.shake(0.2); splash(G, c, 2.4); G.fx.ring(c, { r0: 0.3, r1: 2.6, life: 0.35, color: FOAM, billboard: true });
    for (let i = 0; i < 16; i++) { const a = rand(0, TAU), e = rand(-0.6, 0.9), d = new V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); G.fx.p(c.clone().addScaledVector(d, this.R), { vel: [d.x * 5, d.y * 5, d.z * 5], size: rand(0.08, 0.16), size1: 0.02, life: 0.45, color: FOAM, alpha: 0.9, drag: 2, grav: 8 }); }
    t.takeHit(this.f, { dmg: 54, kb: [2.5, 6.5], stun: 0.6, hs: 0.1, force: true, noScale: true, daze: 30, snd: 'big' }, new V3().subVectors(t.pos, this.f.pos).setY(0).normalize());
  }
  kill() { if (this.done) return; this.done = true; if (this.tg && !this.tg.gone) this.tg.release(); this.G.scene.remove(this.mesh); this.ball.material.dispose(); this.rimM.dispose(); if (this.f.prison === this) this.f.prison = null; }
}

/* ---------- 해류 소용돌이: 상대를 빨아들이며 연속 피해 → 물기둥 ---------- */
let _spiralTex = null;
function spiralTex() {
  if (_spiralTex) return _spiralTex;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.clearRect(0, 0, S, S); g.translate(S / 2, S / 2);
  for (let arm = 0; arm < 5; arm++) { g.beginPath(); for (let i = 0; i <= 120; i++) { const t = i / 120, a = arm * TAU / 5 + t * 5.5, r = t * S * 0.48; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.strokeStyle = 'rgba(160,240,255,0.9)'; g.lineWidth = 14; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 4; g.stroke(); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, S / 2); gr.addColorStop(0, 'rgba(40,140,255,0.9)'); gr.addColorStop(0.7, 'rgba(40,160,255,0.35)'); gr.addColorStop(1, 'rgba(40,160,255,0)'); g.fillStyle = gr; g.globalCompositeOperation = 'destination-over'; g.fillRect(-S / 2, -S / 2, S, S);
  _spiralTex = new THREE.CanvasTexture(c); _spiralTex.colorSpace = THREE.SRGBColorSpace; return _spiralTex;
}
class Whirlpool {
  constructor(G, f, c) {
    this.G = G; this.f = f; this.c = c.clone(); this.t = 0; this.life = 2.2; this.done = false; this.tick = 0; this.R = 2.6;
    this.mat = new THREE.MeshBasicMaterial({ map: spiralTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.R * 1.15, 48), this.mat); this.disc.rotation.x = -Math.PI / 2; this.disc.position.copy(this.c).setY(this.c.y + 0.06); G.scene.add(this.disc);
    this.fm = waterMat(DEEP, FOAM, 0); this.funnel = new THREE.Mesh(new THREE.CylinderGeometry(this.R * 0.9, 0.25, 1.6, 32, 4, true), this.fm); this.funnel.position.copy(this.c).setY(this.c.y + 0.8); G.scene.add(this.funnel);
    sfx('charge'); groundSplash(G, this.c, 1.6);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt; const k = Math.min(1, this.t / 0.25) * Math.min(1, (this.life - this.t) / 0.25 + 0.2);
    this.disc.rotation.z += dt * 5; this.mat.opacity = 0.85 * k; this.funnel.rotation.y -= dt * 7; this.fm.uniforms.uOp.value = 0.7 * k; this.fm.uniforms.uT.value = this.t;
    for (let i = 0; i < 3; i++) { const a = this.t * 6 + i * 2.1 + rand(0, 0.5), r = rand(0.4, 1) * this.R, p = this.c.clone().add(new V3(Math.cos(a) * r, rand(0.05, 0.4), Math.sin(a) * r)), tg = new V3(-Math.sin(a), 0.6, Math.cos(a)).multiplyScalar(5).addScaledVector(new V3(-Math.cos(a), 0, -Math.sin(a)), 2); G.fx.p(p, { vel: [tg.x, tg.y, tg.z], size: rand(0.1, 0.22), size1: 0.03, life: 0.45, color: WATERS[i], alpha: 0.85, drag: 1 }); }
    // 끌어당김
    for (const t of f.foes()) {
      const d = new V3().subVectors(this.c, t.pos).setY(0), L = d.length(); if (L > this.R + 1.2 || t.held || t.pos.y - this.c.y > 2.5) continue;
      if (L > 0.3) { const sp = Math.min(L, 3.8 * dt * (t.scale > 1.2 ? 0.5 : 1)); t.pos.addScaledVector(d.normalize(), sp); }
    }
    if (this.tick <= 0 && this.t < this.life - 0.2) { this.tick = 0.22; sfx('swing');
      for (const t of f.foes()) if (Math.hypot(t.pos.x - this.c.x, t.pos.z - this.c.z) < this.R + 0.4 * t.scale && t.pos.y - this.c.y < 2.2) t.takeHit(f, { dmg: 8, kb: [0, 0], stun: 0.4, daze: 6, hs: 0.02, noCrit: true }, new V3().subVectors(this.c, t.pos).setY(0).normalize()); }
    if (this.t >= this.life - 0.2 && !this.geyser) { this.geyser = true; sfx('boom'); G.shake(0.25);
      G.fx.beam(this.c, { r: 1.2, h: 9, color: AQUA, life: 0.5 }); groundSplash(G, this.c, 2.6);
      for (let i = 0; i < 30; i++) G.fx.p(this.c.clone().add(new V3(rand(-0.6, 0.6), rand(0, 0.5), rand(-0.6, 0.6))), { vel: [rand(-1.5, 1.5), rand(8, 14), rand(-1.5, 1.5)], size: rand(0.3, 0.6), size1: 0.08, life: rand(0.6, 0.9), color: i % 3 ? AQUA : FOAM, alpha: 0.85, drag: 0.8, grav: 14 });
      areaHit(f, this.c, this.R, { dmg: 58, kb: [1.5, 11], stun: 0.7, hs: 0.12, shake: 0.2, daze: 28, snd: 'big' }, 2.5); }
    if (this.t >= this.life) this.kill();
  }
  kill() { if (this.done) return; this.done = true; for (const o of [this.disc, this.funnel]) { this.G.scene.remove(o); o.geometry.dispose(); } this.mat.dispose(); this.fm.dispose(); }
}

/* ---------- 궁극기: 해일 + 바다 정령(고래) ---------- */
class TidalWave {
  constructor(G, f, from, to) {
    this.G = G; this.f = f; this.from = from.clone(); this.to = to.clone(); this.t = 0; this.dur = 1.15; this.done = false;
    // 단면: 뒤쪽 완만한 비탈 → 높은 물마루 → 앞으로 말려 내려오는 끝
    const prof = [[-2.6, 0], [-1.6, 0.9], [-0.7, 2.3], [0, 3.3], [0.7, 3.4], [1.2, 2.9], [1.25, 2.3]];
    const geo = new THREE.BufferGeometry(), nu = 40, nv = prof.length - 1, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, x = (u - 0.5) * 12, w = Math.cos((u - 0.5) * Math.PI) ** 0.6, [z, y] = prof[j]; pos.push(x, y * (0.35 + 0.65 * w), z * w - 1.2 * (1 - w)); uv.push(u, j / nv); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    this.mat = waterMat(DEEP, FOAM, 0); this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; G.scene.add(this.mesh);
    this.mesh.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); this.prof = prof;
  }
  update(dt) {
    const G = this.G; this.t += dt; const k = Math.min(1, this.t / this.dur), e = 1 - (1 - k) ** 2;
    this.mesh.position.lerpVectors(this.from, this.to, e); this.mesh.scale.set(0.6 + 0.4 * e, 0.3 + 0.7 * Math.sin(Math.min(1, k * 1.3) * Math.PI / 2), 1);
    this.mat.uniforms.uOp.value = Math.min(1, this.t / 0.2) * (k > 0.8 ? (1 - k) / 0.2 : 1) * 1.05; this.mat.uniforms.uT.value = this.t;
    const fw = new V3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y)), side = new V3(fw.z, 0, -fw.x);
    for (let i = 0; i < 6; i++) { const p = this.mesh.position.clone().addScaledVector(side, rand(-5, 5)).addScaledVector(fw, 0.6).add(new V3(0, 3.2 * this.mesh.scale.y, 0)); G.fx.p(p, { vel: [fw.x * 6 + rand(-1, 1), rand(1, 4), fw.z * 6 + rand(-1, 1)], size: rand(0.3, 0.7), size1: 0.1, life: rand(0.4, 0.7), color: i % 2 ? FOAM : AQUA, alpha: 0.8, drag: 1, grav: 9 }); }
    if (Math.random() < 0.5) G.fx.burst(this.mesh.position.clone().addScaledVector(side, rand(-5, 5)).setY(0.2), 4, WATERS, 4, { dir: UP, spread: 0.8, grav: 12 });
    if (this.t >= this.dur) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
// 물로 된 고래: 대상 뒤 땅속에서 솟구쳐 머리 위로 포물선을 그리며 넘어가 앞쪽으로 내리꽂힌다
let _whaleGeo = null;
function whaleGeo() {
  if (_whaleGeo) return _whaleGeo;
  const body = new THREE.LatheGeometry([[0, -2.1], [0.18, -1.95], [0.32, -1.5], [0.5, -0.8], [0.72, 0.0], [0.8, 0.6], [0.74, 1.2], [0.55, 1.65], [0.28, 1.95], [0, 2.05]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  body.rotateX(Math.PI / 2); body.scale(1, 0.82, 1); // 길이 방향 = +Z (머리)
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.4, 0.1, 0.9, 0.35, 1.25, 0.15); sh.bezierCurveTo(1.0, -0.05, 0.6, -0.18, 0.3, -0.12); sh.lineTo(0, -0.05);
  sh.lineTo(-0.3, -0.12); sh.bezierCurveTo(-0.6, -0.18, -1.0, -0.05, -1.25, 0.15); sh.bezierCurveTo(-0.9, 0.35, -0.4, 0.1, 0, 0);
  const tail = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 14 }); tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -2.0);
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.bezierCurveTo(0.3, -0.1, 0.8, -0.35, 1.1, -0.6); fin.bezierCurveTo(0.7, -0.5, 0.3, -0.3, 0, -0.25);
  const finG = new THREE.ExtrudeGeometry(fin, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 10 }); finG.rotateX(-Math.PI / 2);
  _whaleGeo = { body, tail, finG }; return _whaleGeo;
}
class SpiritWhale {
  constructor(G, f, tgt, fw) {
    this.G = G; this.f = f; this.c = tgt.clone(); this.fw = fw.clone(); this.t = 0; this.dur = 1.35; this.done = false; this.sp1 = false;
    const W = whaleGeo(); this.mat = waterMat(DEEP, FOAM, 1.2); this.mat2 = waterMat(AQUA, FOAM, 0.5);
    this.mesh = new THREE.Group(); G.scene.add(this.mesh); this.mesh.scale.setScalar(1.7);
    this.mesh.add(new THREE.Mesh(W.body, this.mat)); const inner = new THREE.Mesh(W.body, this.mat2); inner.scale.setScalar(0.7); this.mesh.add(inner);
    this.tail = new THREE.Mesh(W.tail, this.mat); this.mesh.add(this.tail);
    for (const s of [-1, 1]) { const fn = new THREE.Mesh(W.finG, this.mat); fn.position.set(s * 0.6, -0.25, 0.7); fn.scale.set(s, 1, 1); fn.rotation.z = s * 0.3; this.mesh.add(fn); }
    for (const s of [-1, 1]) { const e = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: FOAM, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); e.scale.setScalar(0.07); e.position.set(s * 0.55, 0.05, 1.3); this.mesh.add(e); }
    this.mesh.frustumCulled = false; this.mesh.traverse((o) => { o.frustumCulled = false; });
    this.place(0);
  }
  path(k, out) { return out.copy(this.c).addScaledVector(this.fw, -4 + 8 * k).setY(this.c.y - 2 + 8.5 * Math.sin(k * Math.PI)); }
  place(k) { const p = this.path(k, new V3()), q = this.path(Math.min(1, k + 0.02), new V3()); if (k >= 0.98) q.copy(p).add(this.path(k, new V3()).sub(this.path(k - 0.02, new V3()))); this.mesh.position.copy(p); this.mesh.lookAt(q); }
  update(dt) {
    const G = this.G; this.t += dt; const k = Math.min(1, this.t / this.dur);
    this.place(k); this.tail.rotation.x = Math.sin(this.t * 9) * 0.25; this.mat.uniforms.uT.value = this.t; this.mat2.uniforms.uT.value = this.t;
    const p = this.mesh.position;
    for (let i = 0; i < 5; i++) G.fx.p(p.clone().add(new V3(rand(-0.8, 0.8), rand(-0.8, 0.8), rand(-0.8, 0.8))), { vel: [rand(-1, 1), rand(-1, 2), rand(-1, 1)], size: rand(0.2, 0.5), size1: 0.05, life: rand(0.4, 0.8), color: i % 2 ? AQUA : FOAM, alpha: 0.8, drag: 1, grav: 6 });
    if (!this.sp1 && p.y > 0) { this.sp1 = true; groundSplash(G, this.c.clone().addScaledVector(this.fw, -2.2), 3); sfx('boom'); }
    if (this.t >= this.dur) { groundSplash(G, this.c.clone().addScaledVector(this.fw, 3.5), 3.5); this.kill(); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mat.dispose(); this.mat2.dispose(); this.mesh.traverse((o) => { if (o.material && o.material.type === 'MeshBasicMaterial') o.material.dispose(); }); }
}

/* =====================================================================
   기술 — 원거리 물 마법: 거리를 두고 쏘고, 가두고, 빨아들인다
   ===================================================================== */
const gem = (f, k) => { f.gemK = k; };
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 지팡이를 아래로 겨누고 물기둥을 타고 내리꽂힌다 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.3, 0, 0], head: [0.2, 0, 0], shoulderR: [-1.5, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.3, 0, 0], shoulderL: [-0.4, 0, 0.8], hipL: [-1.0, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: AQUA, dmg: 66, r: 2.6, fallDmg: 30,
    fx: (f, o, G, c) => { groundSplash(G, c, 2.6); G.fx.beam(c, { r: 0.8, h: 5, color: AQUA, life: 0.35 }); },
  }),

  /* --- 기본 공격: 물방울 탄 → 쌍둥이 물방울(왼손) → 물보라 부채 → 버블 버스트 (움직이며 쏠 수 있음) --- */
  light1: { dur: 0.36, cancel: 0.17, next: 'light2', move: 0.5, ikOff: true, track: 0.08,
    keys: [[0, 'castPrep'], [0.07, 'cast'], [0.2, {}], [0.36, 'base']],
    ev: [[0.02, (f) => gem(f, 0.6)], [0.08, (f, o, G) => { sfx('shot'); bolt(f, G, { dmg: 24 }); }], [0.3, (f) => gem(f, 0)]] },
  light2: { dur: 0.4, cancel: 0.2, next: 'light3', move: 0.5, ikOff: true, track: 0.1,
    keys: [[0, { ...poses.castPrep, shoulderL: [-0.6, 0, 0.6], elbowL: [-1.6, 0, 0] }], [0.09, 'palm'], [0.24, {}], [0.4, 'base']],
    ev: [[0.1, (f, o, G) => { sfx('shot'); const hand = f.model.J.handL.getWorldPosition(new V3());
      for (const s of [-0.13, 0.13]) { const d = aimDir(f, hand, s); G.spawn(new WaterOrb(G, f, { pos: hand, dir: d, speed: 22, r: 0.17, homing: 3, life: 1.5, hit: { dmg: 17, kb: [1.2, 0], stun: 0.32, daze: 7, hs: 0.04 } })); }
      G.fx.burst(hand, 10, WATERS, 4, { dir: f.fwd(new V3()), spread: 0.6 }); G.fx.ring(hand, { r0: 0.05, r1: 0.6, life: 0.2, color: AQUA, billboard: true }); }]] },
  light3: { dur: 0.46, cancel: 0.24, next: 'light4', move: 0.45, ikOff: true, trail: true, track: 0.12,
    keys: [[0, 'sweepA'], [0.12, 'sweepB'], [0.28, {}], [0.46, 'base']],
    ev: [[0.02, (f) => gem(f, 0.8)], [0.12, (f, o, G) => { sfx('swing'); sfx('shot'); for (let i = -2; i <= 2; i++) bolt(f, G, { spread: i * 0.17, dmg: 14, speed: 21, r: 0.15, homing: 0.9, stun: 0.28, noTide: i !== 0, hit: { noScale: i !== 0 } });
      f.slashFx({ r: 1.6, color: AQUA, at: [0, 1.2, 0.5] }); }], [0.36, (f) => gem(f, 0)]] },
  light4: { dur: 0.74, move: 0.3, ikOff: true, track: 0.3, shout: true,
    keys: [[0, 'raise'], [0.3, 'raise'], [0.38, 'cast'], [0.56, {}], [0.74, 'base']],
    ev: [[0, (f, o, G) => { gem(f, 1); sfx('charge'); }],
      [0.38, (f, o, G) => { sfx('shot'); sfx('dash'); bolt(f, G, { bubble: true, dmg: 40, r: 0.5, speed: 14, homing: 1.6, life: 1.8, kb: [3, 5], stun: 0.6, daze: 22, hs: 0.1, noTide: true, splash: { r: 1.9, hit: { dmg: 28, kb: [4, 6], stun: 0.6, daze: 16, noScale: true } } }); }],
      [0.6, (f) => gem(f, 0)]],
    tick: (f, o, G, t) => { if (t < 0.36) { const p = f.model.gemPos(new V3()); for (let i = 0; i < 2; i++) { const q = p.clone().add(new V3(rand(-0.8, 0.8), rand(-0.6, 0.6), rand(-0.8, 0.8))), v = p.clone().sub(q).multiplyScalar(4); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.1, size1: 0.03, life: 0.24, color: i ? AQUA : FOAM, alpha: 0.9 }); } } },
    end: (f) => gem(f, 0) },

  /* --- 우클: 아쿠아 랜스 — 물을 모아 관통하는 창을 던진다 --- */
  heavy: { dur: 0.86, cd: 'heavy', ikOff: true, track: 0.4, shout: true, move: 0.2,
    keys: [[0, 'castPrep'], [0.14, 'lanceBack'], [0.34, 'lanceBack'], [0.42, { ...poses.cast, shoulderR: [-1.6, 0, 0.05], weapon: [0.0, -0.1, 0], spine: [0.2, 0.3, 0], ...LEGS_CAST, hipL: [-0.8, 0, 0.12], kneeL: [0.8, 0, 0] }], [0.62, {}], [0.86, 'base']],
    start: (f, o, G) => { gem(f, 1); sfx('charge'); G.say(f, '"아쿠아 랜스!"'); },
    tick: (f, o, G, t) => { if (t < 0.4) { const p = f.model.gemPos(new V3()); for (let i = 0; i < 3; i++) { const a = rand(0, TAU), q = p.clone().add(new V3(Math.cos(a) * 0.7, rand(-0.5, 0.5), Math.sin(a) * 0.7)), v = p.clone().sub(q).multiplyScalar(5); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.03, life: 0.2, color: [AQUA, FOAM, DEEP][i], alpha: 0.9 }); } } },
    ev: [[0.42, (f, o, G) => { sfx('shot'); sfx('dash'); sfx('heavy'); const from = f.model.gemPos(new V3()), d = aimDir(f, from); G.spawn(new WaterLance(G, f, from, d)); G.fx.ring(from, { r0: 0.1, r1: 1.0, life: 0.25, color: FOAM, billboard: true }); G.shake(0.06); }],
      [0.6, (f) => gem(f, 0)]],
    end: (f) => gem(f, 0) },

  /* --- Shift: 버블 프리즌 — 거품 구슬에 맞으면 갇혀 떠올랐다가 터진다 --- */
  s1: { dur: 0.64, cd: 's1', ikOff: true, track: 0.25, shout: true, move: 0.3,
    keys: [[0, { ...poses.castPrep, shoulderL: [-1.0, 0, 0.5], elbowL: [-1.5, 0, 0] }], [0.2, { ...poses.cast, shoulderL: [-1.4, 0, 0.1], elbowL: [-0.3, 0, 0] }], [0.44, {}], [0.64, 'base']],
    start: (f, o, G) => { gem(f, 1); G.say(f, '"거품 속에 쏙~!"'); sfx('charge'); },
    ev: [[0.22, (f, o, G) => { sfx('shot'); bolt(f, G, { bubble: true, r: 0.42, speed: 15, homing: 4.5, life: 1.8, dmg: 18, kb: [0, 0], stun: 0.6, daze: 10, noTide: true,
      onHit: (orb, t, res) => { if (res === 'hit' && t.state !== 'ko' && !t.held) G.spawn(new BubblePrison(G, f, t)); } }); }], [0.5, (f) => gem(f, 0)]],
    end: (f) => gem(f, 0) },

  /* --- E: 해류 소용돌이 — 상대 발밑에 소용돌이: 빨아들이며 연속 피해, 끝에 물기둥 --- */
  s2: { dur: 0.95, cd: 's2', ikOff: true, track: 0.3, shout: true, move: 0.15,
    keys: [[0, 'raise'], [0.28, { ...poses.raise, weapon: [1.3, 0, 0.8] }], [0.36, { ...poses.slam, spine: [0.35, 0, 0], weapon: [-1.35, 0, 0], hipL: [-0.6, 0, 0.12], kneeL: [0.8, 0, 0] }], [0.7, {}], [0.95, 'base']],
    start: (f, o, G) => { gem(f, 1); G.say(f, '"빙글빙글~ 소용돌이!"'); },
    ev: [[0.36, (f, o, G) => { sfx('heavy'); const tip = f.model.gemPos(new V3()).setY(f.pos.y); groundSplash(G, tip, 1.2);
      const c = o && !o.gone && f.dist() < 14 ? o.pos.clone().setY(o.onGround ? o.pos.y : f.pos.y) : f.local([0, 0, 5]); c.y = Math.max(0, Math.min(c.y, f.pos.y + 0.5)); G.spawn(new Whirlpool(G, f, c)); }], [0.7, (f) => gem(f, 0)]],
    end: (f) => gem(f, 0) },

  /* --- 극한 회피 뒤 좌클: 물보라 순간이동 — 제자리에 물폭발, 뒤로 물러나며 유도탄 셋 --- */
  counter: { dur: 0.62, ikOff: true,
    keys: [[0, 'cast'], [0.16, 'cast'], [0.42, {}], [0.62, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.pos.clone(); sfx('boom'); G.flash(AQUA, 0.2); groundSplash(G, from, 2); G.fx.beam(from, { r: 0.9, h: 4, color: AQUA, life: 0.3 });
      areaHit(f, from, 1.9, { dmg: 46, kb: [6, 4], stun: 0.6, hs: 0.1, daze: 24, snd: 'big' }, 1.5);
      const away = o ? new V3().subVectors(f.pos, o.pos).setY(0).normalize() : f.fwd(new V3()).negate(); f.pos.addScaledVector(away, 3.6); f.faceOpp(); f.vel.set(0, 0, 0); f.model.resetCloth();
      for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.pos, i / 8).setY(f.pos.y + 1), { size: 0.7, size1: 0.1, life: 0.3, color: AQUA, alpha: 0.7 }); sfx('tele'); gem(f, 1);
    }], ...[0.16, 0.24, 0.32].map((t, i) => [t, (f, o, G) => { sfx('shot'); bolt(f, G, { spread: (i - 1) * 0.3, dmg: 22, homing: 5, speed: 20, noTide: true }); }]), [0.5, (f) => gem(f, 0)]],
    end: (f) => gem(f, 0) },

  /* --- Q: 바다 정령의 해일 — 해일이 덮치고, 물의 고래가 솟구쳐 상대를 휩쓸고 내리꽂힌다 --- */
  ult: { dur: 3.3, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, 'raise'], [0.75, { ...poses.raise, shoulderL: [-2.7, 0, 0.6], head: [-0.5, 0, 0] }], [0.9, { ...poses.cast, shoulderL: [-1.4, 0, 0.3], elbowL: [-0.2, 0, 0] }], [1.4, {}],
      [1.55, { ...poses.raise, weapon: [1.5, 0, 0.5] }], [2.45, { ...poses.raise, head: [-0.6, 0, 0] }], [2.6, { ...poses.slam, spine: [0.3, 0, 0], weapon: [-0.4, 0, 0] }], [3.0, {}], [3.3, 'win']],
    cam: [[0, { ref: 'self', p: [0.7, 0.8, 2.3], l: [0, 1.5, 0], fov: 40 }], [0.8, { ref: 'self', p: [0.4, 1.4, 1.6], l: [0, 2.0, 0], fov: 46 }],
      [0.95, { ref: 'self', p: [-1.4, 2.3, -3.6], l: [0, 1.4, 6], fov: 56 }], [1.5, { ref: 'target', p: [5, 1.4, -2.5], l: [0, 2.2, 0], fov: 56 }],
      [2.3, { ref: 'target', p: [-3.5, 0.6, -5.5], l: [0, 3.6, 0], fov: 60 }], [3.3, { ref: 'target', p: [-2.2, 2.6, -9.5], l: [0, 1.4, 0], fov: 56 }]],
    ev: [
      [0, (f, o, G) => {
        if (f.prison) f.prison.kill(); f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; }
        G.setTint(DEEP, 0.32); gem(f, 1); sfx('charge'); G.say(f, '"바다의 정령님, 힘을 빌려줘!"');
        const c = f.pos.clone().setY(f.pos.y + 0.05); G.fx.ring(c, { normal: UP, r0: 0.4, r1: 3.4, life: 1.2, color: AQUA, op: 1 }); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 2.4, life: 1.2, color: FOAM, op: 0.8 });
        G.fx.burst(f.chest(), 40, WATERS, 6); G.fx.light(f.chest(), AQUA, 100, 0.6);
      }],
      [0.9, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('boom'); sfx('dash'); G.shake(0.25);
        const fw = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); G.spawn(new TidalWave(G, f, f.pos.clone().addScaledVector(fw, -1.5).setY(0), o.pos.clone().addScaledVector(fw, 4).setY(0))); }],
      [1.42, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('big'); G.shake(0.35); G.flash(0x8ae8ff, 0.3); splash(G, aimPt(o), 2.4);
        o.takeHit(f, { dmg: 90, kb: [0, 0], stun: 99, hs: 0.12, shake: 0.3, nokill: true, noScale: true, force: true, daze: 60, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); }],
      [1.5, (f, o, G) => { o = f.ultTgt || o; if (!o) return; G.say(f, '"가자, 고래야!"'); const fw = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); G.spawn(new SpiritWhale(G, f, o.pos.clone().setY(0), fw)); G.fx.beam(o.pos.clone().setY(0), { r: 1.4, h: 10, color: AQUA, life: 0.6 }); }],
      [1.95, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('boom'); sfx('big'); G.shake(0.4); splash(G, aimPt(o), 3);
        o.takeHit(f, { dmg: 110, kb: [0, 0], stun: 99, hs: 0.14, shake: 0.4, nokill: true, noScale: true, force: true, daze: 60, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); }],
      [2.85, (f, o, G) => { o = f.ultTgt || o; if (!o) return;
        o.release(); sfx('boom'); sfx('heavy'); G.say(f, '"…찰싹!"'); G.flash(0xffffff, 0.45); G.stage.flashSky && G.stage.flashSky(0.4);
        const c = o.pos.clone().setY(0); groundSplash(G, c, 4); G.fx.beam(c, { r: 2, h: 14, color: AQUA, life: 0.7 }); G.fx.light(c.clone().setY(1.5), AQUA, 180, 0.8, 22);
        o.takeHit(f, { dmg: 150, kb: [6, 12], stun: 0.9, hs: 0.18, shake: 0.5, noScale: true, force: true, daze: 80, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(c) < 6) t.takeHit(f, { dmg: 110, kb: [6, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
        G.slow(0.35, 0.5); }],
    ],
    tick: (f, o, G, t, dt) => {
      // 물 고리가 몸을 감고 솟아오른다
      if (t < 0.9) { const k = t / 0.9; for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1, r = 0.9 - k * 0.3, p = f.pos.clone().add(new V3(Math.cos(a) * r, 0.2 + k * 2 + i * 0.25, Math.sin(a) * r)); G.fx.p(p, { vel: [0, 2, 0], size: 0.22, size1: 0.04, life: 0.45, color: WATERS[i], alpha: 0.9, drag: 1 }); } }
      const tg = f.ultTgt; if (tg && tg.held && t > 1.42 && t < 2.85) { const h = t < 1.95 ? 0.6 : 0.6 + Math.min(1, (t - 1.95) / 0.5) * 3.2 * (1 - Math.max(0, (t - 2.5) / 0.35)); tg.pos.y += (h - tg.pos.y) * Math.min(1, dt * 6); tg.yaw += dt * 4; }
    },
    end: (f, o, G) => { G.setTint(0, 0); gem(f, 0); const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, AQUA, big ? 1.7 : 1.0, dir);
  G.fx.burst(p, big ? 20 : 9, WATERS, 6, { grav: 12 });
  if (big) G.fx.ring(p, { r0: 0.2, r1: 1.8, life: 0.3, color: FOAM, billboard: true });
  // 조류: 맞힐 때마다 쌓인다 (만조 중에는 쌓지 않음)
  if (!(att.tideT > 0)) att.tide = Math.min(100, (att.tide || 0) + h.dmg * 0.4);
}

// 조류 · 만조 상태 → 공격력 배율 · 보석 발광
function createModelWithTide(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (f.tideT > 0) { f.tideT -= dt; if (f.tideT <= 0) { f.tideT = 0; f.tide = 0; } }
    else if ((f.tide || 0) >= 100) {
      f.tideT = 8; f.tide = 100; f.G.say && f.G.say(f, '"만조다~! 힘이 넘쳐!"'); sfx('charge');
      const p = m.gemPos(new V3()); f.G.fx.burst(p, 30, WATERS, 6); f.G.fx.ring(p, { r0: 0.1, r1: 1.5, life: 0.35, color: FOAM, billboard: true });
    }
    f.dmgMul = f.tideT > 0 ? 1.15 : 1;
    if (f.tideT > 0 && f.root.visible && Math.random() < 0.4) { const a = f.G.time * 3 + Math.random() * TAU; f.G.fx.p(f.pos.clone().add(new V3(Math.cos(a) * 0.55, 0.3 + Math.random() * 1.4, Math.sin(a) * 0.55)), { vel: [0, 0.8, 0], life: 0.6, size: 0.08, size1: 0.02, color: Math.random() < 0.5 ? AQUA : FOAM, alpha: 0.85, drag: 0.5 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(AQUA);
    up(dt, f);
  };
  return m;
}

// CPU: 원거리 기술 선택 (거리별)
function aiPick(f, o, dist) {
  if (o.held && f.prison && f.cd.heavy <= 0) return 'heavy'; // 갇힌 상대에게 창
  if (dist > 3 && dist < 13 && f.cd.s1 <= 0 && Math.random() < 0.25) return 's1';
  if (dist < 12 && f.cd.s2 <= 0 && Math.random() < 0.2) return 's2';
  if (dist > 2.5 && dist < 18 && f.cd.heavy <= 0 && Math.random() < 0.3) return 'heavy';
  return null;
}

export default {
  id: 'aquarist', name: '아리엘', short: '아리엘', title: 'AQUARIST · 바다의 마법사', scale: 0.97,
  desc: '원거리 · 물 마법 · 견제. "잃어버린 마력, 꼭 되찾을 거야!" 바다 정령의 힘을 빌려 물방울 탄·물의 창을 쏘고, 거품에 가두고, 소용돌이로 끌어당긴다. 움직이면서 쏠 수 있고, 맞힐수록 조류가 차올라 만조가 된다.',
  stats: { hp: 880, speed: 7.4, jump: 10.5, crit: 0.2 },
  palettes: [{ accent: AQUA, blue: 0x2f6fd0, hat: 0x9ad0f4 }, { accent: 0xff7ac8, blue: 0x9a3aa8, hat: 0xf4b8e0 }],
  skills: { heavy: { name: '아쿠아 랜스', cd: 6 }, s1: { name: '버블 프리즌', cd: 10 }, s2: { name: '해류 소용돌이', cd: 12 }, ult: { name: '바다 정령의 해일', sub: 'AQUARIST' } },
  aimRange: RANGE, aiRange: [5, 12], aiPick,
  resource: (f) => f.tideT > 0 ? { v: f.tideT / 8, label: '만조', color: 0x9af0ff, full: true } : { v: (f.tide || 0) / 100, label: '조류', color: 0x3a8aff },
  moveList: [['좌클 ×4', '물방울 탄 → 쌍둥이 물방울(왼손) → 물보라 부채(5발) → 버블 버스트(큰 거품 · 터지며 범위 피해). 쏘면서 이동 가능'], ['공중 좌클', '지팡이를 아래로 겨누고 내리꽂아 물보라 충격파'],
    ['우클 · 아쿠아 랜스', '물을 모아 관통하는 창을 던짐 72 (멀리까지)'], ['Shift · 버블 프리즌', '거품 구슬: 맞으면 1.7초 동안 거품에 갇혀 떠오름 → 터지며 54'],
    ['E · 해류 소용돌이', '상대 발밑에 소용돌이: 빨아들이며 0.22초마다 8 → 끝에 물기둥 58(띄움)'], ['Q · 바다 정령의 해일', '해일이 덮치고(90) 물의 고래가 솟구쳐 휩쓴 뒤(110) 내리꽂힘(150)'],
    ['조류', '맞힐수록 쌓이고 가득 차면 8초간 만조: 공격력 ×1.15, 물방울 탄마다 작은 유도탄 추가'], ['C (타이밍) · 극한 회피', '제자리 물폭발 + 뒤로 순간이동하며 유도탄 셋'], ['가만히', '지팡이에 기대 쉼']],
  createModel: createModelWithTide, poses, moves, hitFx,
};
