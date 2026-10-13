// 제이 (SNIPER · 표적 제거) — 원거리 · 저격 · 함정
// 대물 저격총 "PROJECT-J" 를 쓰는 암살자. 말수가 적고, 한 발로 끝내는 것을 좋아한다.
// 무기: 대물 저격총 — 허리 사격 · 개머리판 타격 · 초정밀 저격(관통 광선) · 대인 살상 마인 · 마력 개방
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx, clamp } from '../core.js';
import { createModel, DIMS, CYAN, CYAN2, CORAL, REDJ } from './sniper_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const CYANS = [CYAN, CYAN2, 0xffffff];
const RANGE = 30; // 조준 거리 (마력 개방 중 45)
const FOCUS_T = 8; // 마력 개방 지속 시간

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const LEGS_AIM = { hipL: [-0.42, 0, 0.12], kneeL: [0.38, 0, 0], footL: [0.05, 0, 0], hipR: [0.3, 0, -0.14], kneeR: [0.22, 0, 0], footR: [0, 0, 0] };
const poses = {
  // 기본: 총을 오른손에 낮게 들어 총구가 앞 아래를 향함 · 왼손은 가볍게 · 무표정하게 선 자세
  base: { hips: [0, 0.12, 0.02], spine: [0.02, -0.06, 0], chest: [0, -0.06, 0], head: [0.06, 0.08, -0.04],
    shoulderR: [-0.1, 0, -0.2], elbowR: [-0.45, 0, 0], weapon: [-0.42, 0.14, 0], shoulderL: [0.06, 0, 0.12], elbowL: [-0.32, 0, 0], handL: [0, 0, 0.1],
    hipL: [-0.1, 0, 0.03], kneeL: [0.16, 0, 0], footL: [-0.06, 0, 0], hipR: [0.08, 0, -0.06], kneeR: [0.06, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.1, 0], spine: [0.3, 0.06, 0], chest: [0.06, 0.06, 0], head: [-0.2, 0, 0], shoulderR: [-0.5, 0, -0.25], elbowR: [-1.2, 0, 0], weapon: [0.55, -0.45, 0.3], shoulderL: [0.15, 0, 0.18], elbowL: [-0.9, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.35, 0, 0], kneeR: [1.4, 0, 0], footR: [0.4, 0, 0], shoulderL: [-0.6, 0, 0.7], elbowL: [-0.6, 0, 0], shoulderR: [-0.5, 0, -0.25], elbowR: [-1.1, 0, 0], weapon: [0.6, -0.4, 0.3] },
  // 방어: 총을 가로로 들어 몸 앞을 막는다 (왼손이 총열 덮개를 받침)
  guard: { hips: [0, -0.15, 0], spine: [0.12, 0.05, 0], chest: [0.04, 0.05, 0], head: [0.05, 0, 0], shoulderR: [-0.9, 0, -0.2], elbowR: [-1.25, 0, 0], weapon: [0.15, -1.4, 0],
    hipL: [-0.45, 0, 0.18], kneeL: [0.8, 0, 0], hipR: [0.3, 0, -0.18], kneeR: [0.6, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.4, 0.6, 0.4], shoulderL: [0.4, 0, 0.7], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.6, 1.2, 0.6], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.72, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -0.6, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.5, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.3, 0, -0.3], elbowR: [-0.9, 0, 0], weapon: [0.2, 2.6, 0.3], shoulderL: [0.7, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 총을 오른 어깨에 걸치고 (총구가 뒤 위) 왼손으로 모자 챙을 내린다
  win: { hips: [0, 0.2, 0.03], spine: [-0.04, 0.12, 0], chest: [-0.04, 0.12, 0], head: [0.12, -0.15, 0.05], shoulderR: [-0.55, 0, -0.35], elbowR: [-1.85, 0, 0], weapon: [0.75, 2.75, 0],
    shoulderL: [-2.3, 0, 0.55], elbowL: [-1.9, 0, 0], handL: [0, 0, -0.6], hipL: [-0.08, 0, 0.06], kneeL: [0.1, 0, 0], hipR: [0.2, 0, -0.08], kneeR: [0.32, 0, 0], footR: [0.2, 0, 0] },
  portrait: { hips: [0, 0.15, 0], chest: [0, -0.1, 0], head: [0.12, 0.12, 0.05], shoulderR: [-0.55, 0, -0.35], elbowR: [-1.85, 0, 0], weapon: [0.75, 2.75, 0], shoulderL: [-2.3, 0, 0.55], elbowL: [-1.9, 0, 0], handL: [0, 0, -0.6] },
  // 허리 사격: 총을 허리 높이에서 앞으로
  hip: { hips: [0, -0.25, 0], spine: [0.08, -0.2, 0], chest: [0.02, -0.15, 0], head: [0, 0.4, 0], shoulderR: [-0.55, 0, -0.18], elbowR: [-1.05, 0, 0], weapon: [0.02, 0, 0], shoulderL: [-0.5, 0, 0.2], elbowL: [-1.2, 0, 0], ...LEGS_AIM },
  hipKick: { hips: [0, -0.3, 0], spine: [-0.04, -0.24, 0], chest: [-0.06, -0.18, 0], head: [-0.05, 0.45, 0], shoulderR: [-0.7, 0, -0.18], elbowR: [-1.15, 0, 0], weapon: [0.22, 0.03, 0], shoulderL: [-0.6, 0, 0.2], elbowL: [-1.25, 0, 0], ...LEGS_AIM },
  // 견착 조준: 왼 어깨를 앞으로 · 개머리판을 오른 어깨에 · 고개를 스코프로
  aim: { hips: [0, -0.55, 0], spine: [0.06, -0.3, 0], chest: [0.05, -0.25, 0], head: [0.12, 0.8, 0.08], shoulderR: [-1.15, 0, -0.55], elbowR: [-1.35, 0, 0], weapon: [0, 0, 0], shoulderL: [-1.2, 0, 0.2], elbowL: [-0.4, 0, 0], ...LEGS_AIM },
  aimKick: { hips: [0, -0.55, 0], spine: [-0.1, -0.32, 0], chest: [-0.08, -0.27, 0], head: [0, 0.82, 0.08], shoulderR: [-1.3, 0, -0.55], elbowR: [-1.5, 0, 0], weapon: [0.3, 0, 0], shoulderL: [-1.3, 0, 0.2], elbowL: [-0.4, 0, 0], ...LEGS_AIM },
  // 무릎 쏴 (궁극기): 오른 무릎을 땅에
  kneel: { hipY: -0.32, hips: [0, -0.55, 0], spine: [0.15, -0.3, 0], chest: [0.06, -0.25, 0], head: [0.15, 0.8, 0.08], shoulderR: [-1.15, 0, -0.55], elbowR: [-1.35, 0, 0], weapon: [0, 0, 0], shoulderL: [-1.2, 0, 0.2], elbowL: [-0.4, 0, 0],
    hipL: [-1.35, 0, 0.18], kneeL: [1.45, 0, 0], footL: [-0.1, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [1.95, 0, 0], footR: [-0.6, 0, 0] },
  // 개머리판 타격: 총을 뒤집어 개머리판으로 찌른다
  buttWind: { hips: [0, -0.45, 0], spine: [0.0, -0.35, 0], chest: [-0.04, -0.3, 0], head: [0, 0.6, 0], shoulderR: [-0.3, 0, -0.4], elbowR: [-1.6, 0, 0], weapon: [0.35, 2.7, 0], shoulderL: [-0.9, 0, 0.3], elbowL: [-1.3, 0, 0],
    hipL: [-0.4, 0, 0.12], kneeL: [0.5, 0, 0], hipR: [0.35, 0, -0.14], kneeR: [0.3, 0, 0] },
  buttHit: { hips: [0, 0.35, 0], spine: [0.3, 0.3, 0], chest: [0.08, 0.3, 0], head: [-0.2, -0.4, 0], shoulderR: [-1.45, 0, 0.2], elbowR: [-0.35, 0, 0], weapon: [0.05, 3.0, 0], shoulderL: [0.2, 0, 0.5], elbowL: [-0.6, 0, 0],
    hipL: [-0.85, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.5, 0, -0.12], kneeR: [0.3, 0, 0] },
  // 마인 설치: 한쪽 무릎을 굽혀 낮게 · 왼손으로 바닥에
  plant: { hipY: -0.28, hips: [0, 0.2, 0], spine: [0.55, 0.1, 0], chest: [0.15, 0.05, 0], head: [-0.35, -0.1, 0], shoulderR: [-0.3, 0, -0.3], elbowR: [-0.8, 0, 0], weapon: [0.9, 0.5, 0], shoulderL: [-0.95, 0, 0.1], elbowL: [-0.25, 0, 0],
    hipL: [-1.45, 0, 0.15], kneeL: [1.6, 0, 0], footL: [-0.15, 0, 0], hipR: [0.0, 0, -0.12], kneeR: [1.9, 0, 0], footR: [-0.7, 0, 0] },
  // 마력 개방: 총을 세로로 세우고 왼손을 펼침
  release: { hips: [0, 0.1, 0], spine: [-0.12, 0, 0], chest: [-0.12, 0, 0], head: [-0.2, 0, 0], shoulderR: [-0.9, 0, -0.35], elbowR: [-1.3, 0, 0], weapon: [1.45, 0, 0], shoulderL: [-0.4, 0, 1.2], elbowL: [-0.2, 0, 0], handL: [0, 0, 0.4],
    hipL: [-0.35, 0, 0.22], kneeL: [0.35, 0, 0], hipR: [0.3, 0, -0.22], kneeR: [0.3, 0, 0] },
  raise: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.6, 0, -0.2], elbowR: [-0.6, 0, 0], weapon: [1.4, 0, 0], shoulderL: [-2.4, 0, 0.3], elbowL: [-0.6, 0, 0], hipL: [-0.4, 0, 0.1], kneeL: [0.8, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.6, 0, 0] },
  slam: { hipY: -0.2, hips: [0, -0.15, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.1, 0, -0.1], elbowR: [-0.3, 0, 0], weapon: [-1.3, 0, 0], shoulderL: [-0.9, 0, 0.2], elbowL: [-0.4, 0, 0],
    hipL: [-1.3, 0, 0.12], kneeL: [1.5, 0, 0], hipR: [0.3, 0, -0.12], kneeR: [1.4, 0, 0], footR: [-0.4, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 총을 어깨에 걸치고 한쪽 다리에 체중을 싣는다
  idle2: { hips: [0, 0.18, 0.05], spine: [0.02, 0.08, 0.03], chest: [0, 0.06, 0], head: [0.1, -0.12, -0.08], shoulderR: [-0.55, 0, -0.35], elbowR: [-1.85, 0, 0], weapon: [0.75, 2.75, 0],
    shoulderL: [0.1, 0, 0.1], elbowL: [-0.4, 0, 0], hipL: [-0.04, 0, 0.04], kneeL: [0.06, 0, 0], hipR: [0.15, 0, -0.06], kneeR: [0.4, 0, 0], footR: [0.25, 0, 0] },
});

/* =====================================================================
   조준 · 이펙트
   ===================================================================== */
const focusOn = (f) => (f.focusT || 0) > 0;
const range = (f) => (focusOn(f) ? 45 : RANGE);
const aimPt = (t, out = new V3()) => (t.hurt && t.hurt[0] ? out.copy(t.hurt[0].a).lerp(t.hurt[0].b, 0.5) : t.chest(out));
const tgtOk = (f) => { const o = f.opp; return o && !o.gone && o.state !== 'ko' && f.dist() < range(f) ? o : null; };
function aimDir(f, from, spread = 0) {
  const o = tgtOk(f), d = o ? aimPt(o).sub(from).normalize() : f.fwd(new V3()).add(new V3(0, -0.01, 0)).normalize();
  if (spread) d.applyAxisAngle(UP, spread);
  return d;
}
const charge = (f, k) => { f.chargeK = k; };
function muzzleFlash(f, G, dir, s = 1) {
  const p = f.model.muzzle(new V3());
  G.fx.p(p, { size: 0.7 * s, size1: 0.1, life: 0.08, color: 0xffffff, alpha: 1 });
  G.fx.p(p.clone().addScaledVector(dir, 0.15 * s), { size: 0.9 * s, size1: 0.2, life: 0.1, color: CYAN, alpha: 0.9 });
  G.fx.burst(p, Math.round(8 * s), CYANS, 6 * s, { dir, spread: 0.35 });
  const side = new V3().crossVectors(dir, UP).normalize(); // 머즐 브레이크 양옆 가스
  for (const q of [-1, 1]) G.fx.burst(p, Math.round(4 * s), [0xaab8c0, CYAN2], 3 * s, { dir: side.clone().multiplyScalar(q), spread: 0.4, lk: 0.6 });
  G.fx.light(p, CYAN, 30 * s, 0.1, 8);
  // 탄피 (오른쪽으로 튐)
  const e = f.model.J.weapon.localToWorld(new V3(0, 0.08, 0.08)), r = f.right(new V3());
  G.fx.p(e, { vel: [r.x * 2.5 + rand(-0.4, 0.4), 2.5 + rand(0, 1), r.z * 2.5 + rand(-0.4, 0.4)], size: 0.05, size1: 0.04, life: 0.5, color: 0xffc860, alpha: 1, drag: 0.5, grav: 12 });
}
function spark(G, p, dir, s = 1) {
  G.fx.burst(p, Math.round(10 * s), [CYAN, 0xffffff, 0xffd080], 6 * s, dir ? { dir, spread: 1.1 } : {});
  G.fx.p(p, { size: 0.5 * s, size1: 0.9 * s, life: 0.1, color: CYAN2, alpha: 0.9 });
  G.fx.ring(p, { r0: 0.05, r1: 0.6 * s, life: 0.2, color: CYAN, billboard: true });
}

/* ---------- 탄환: 빠른 예광탄 (프레임 사이 선분 판정 · 관통 선택) ---------- */
const TRACER = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); TRACER.rotateX(Math.PI / 2); TRACER.translate(0, 0, -0.5);
class Bullet {
  // o: { pos, dir, speed, r, life, hit, pierce, w, onHit(b, t, res) }
  constructor(G, f, o) {
    this.G = G; this.f = f; this.o = o; this.pos = o.pos.clone(); this.prev = this.pos.clone(); this.dir = o.dir.clone().normalize(); this.speed = o.speed ?? 110; this.r = o.r ?? 0.12; this.h = o.hit;
    this.life = o.life ?? range(f) / this.speed; this.t = 0; this.done = false; this.hitSet = new Set(); const w = o.w ?? 1;
    this.mesh = new THREE.Group(); G.scene.add(this.mesh);
    this.matO = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    this.matI = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.outer = new THREE.Mesh(TRACER, this.matO); this.outer.scale.set(0.035 * w, 0.035 * w, 2.2 * w); this.mesh.add(this.outer);
    this.inner = new THREE.Mesh(TRACER, this.matI); this.inner.scale.set(0.012 * w, 0.012 * w, 1.6 * w); this.mesh.add(this.inner);
    this.mesh.frustumCulled = false; this.mesh.traverse((m) => { m.frustumCulled = false; }); this.place();
  }
  place() { this.mesh.position.copy(this.pos); this.mesh.lookAt(this.pos.clone().add(this.dir)); }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.prev.copy(this.pos); this.pos.addScaledVector(this.dir, this.speed * dt); this.place();
    const k = Math.min(1, this.t / 0.03); this.outer.scale.z = 2.2 * (this.o.w ?? 1) * k; this.inner.scale.z = 1.6 * (this.o.w ?? 1) * k;
    if (Math.random() < 0.6) G.fx.p(this.pos.clone().addScaledVector(this.dir, -rand(0.2, 1.2)), { vel: [rand(-0.3, 0.3), rand(-0.1, 0.4), rand(-0.3, 0.3)], size: 0.06, size1: 0.01, life: 0.25, color: CYAN2, alpha: 0.8, drag: 2 });
    for (const t of f.foes()) {
      if (this.hitSet.has(t) || !t.hurtHitSeg(this.prev, this.pos, this.r)) continue;
      this.hitSet.add(t); const res = t.takeHit(f, this.h, this.dir.clone().setY(0).normalize());
      if (res) { spark(G, aimPt(t), this.dir.clone().negate(), 1.2); this.o.onHit && this.o.onHit(this, t, res); if (!this.o.pierce) return this.kill(); }
    }
    const W = G.stage && G.stage.world;
    if (this.pos.y < 0.03 || (W && W.solidAt(this.pos, 0.08))) { spark(G, this.pos.clone().setY(Math.max(0.05, this.pos.y)), this.dir.clone().negate(), 0.8); G.fx.burst(this.pos, 5, 0x8a7a70, 2, { kind: 'dust' }); return this.kill(); }
    if (this.t > this.life || Math.hypot(this.pos.x, this.pos.z) > 60) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.matO.dispose(); this.matI.dispose(); }
}
// 총구에서 한 발 (마력 개방 중: 더 빠르고 멀리 · 관통)
function fire(f, G, o = {}) {
  const from = f.model.muzzle(new V3()), dir = o.dir || aimDir(f, from, o.spread || 0), foc = focusOn(f);
  G.spawn(new Bullet(G, f, { pos: from, dir, speed: (o.speed ?? 110) * (foc ? 1.35 : 1), r: o.r ?? 0.12, w: o.w ?? 1, pierce: o.pierce || foc, onHit: o.onHit,
    hit: { dmg: o.dmg ?? 22, kb: o.kb ?? [1.4, 0], stun: o.stun ?? 0.32, daze: o.daze ?? 9, hs: o.hs ?? 0.04, ...(o.hit || {}) } }));
  muzzleFlash(f, G, dir, o.flash ?? 1); sfx('shot'); if (o.big) { sfx('heavy'); G.shake(0.08); }
  return dir;
}

/* ---------- 레이저 조준선: 총구 → 대상 (저격 · 궁극기 충전 중) ---------- */
class LaserSight {
  constructor(G, f, act, color = CYAN) {
    this.G = G; this.f = f; this.act = act; this.t = 0; this.done = false; this.k = 0;
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.Mesh(TRACER, this.mat); this.mesh.frustumCulled = false; G.scene.add(this.mesh);
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); this.dot.frustumCulled = false; G.scene.add(this.dot);
    this.ringT = 0;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.ringT -= dt;
    if (f.act !== this.act || f.state !== 'act' || f.gone) return this.kill();
    const a = f.model.muzzle(new V3()), o = f.ultTgt && !f.ultTgt.gone ? f.ultTgt : tgtOk(f), b = o ? aimPt(o) : a.clone().addScaledVector(f.fwd(new V3()), range(f));
    const d = b.clone().sub(a), L = d.length(); this.k = Math.min(1, this.t / 0.2);
    this.mesh.position.copy(b); this.mesh.lookAt(b.clone().add(d)); this.mesh.scale.set(0.006 + 0.004 * (f.chargeK || 0), 0.006 + 0.004 * (f.chargeK || 0), L);
    this.mat.opacity = (0.5 + 0.4 * Math.sin(this.t * 40)) * this.k;
    this.dot.position.copy(b); this.dot.scale.setScalar(0.05 + 0.03 * Math.sin(this.t * 30)); this.dot.material.opacity = 0.9 * this.k;
    if (o && this.ringT <= 0) { this.ringT = 0.16; G.fx.ring(b, { r0: 0.9, r1: 0.15, life: 0.22, color: CYAN, billboard: true, op: 0.8 }); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.G.scene.remove(this.dot); this.mat.dispose(); this.dot.geometry.dispose(); this.dot.material.dispose(); }
}

/* ---------- 관통 광선 (초정밀 저격 · 궁극기): 즉시 판정, 벽에서 멈춤, 서서히 사라지는 빛줄기 ---------- */
class RailBeam {
  // o: { len, w, hit(t, d) → 피격 데이터, life, color }
  constructor(G, f, from, dir, o = {}) {
    this.G = G; this.f = f; this.t = 0; this.done = false; this.life = o.life ?? 0.55; this.w = o.w ?? 0.25;
    const W = G.stage && G.stage.world; let len = o.len ?? range(f);
    if (W) for (let k = 1; k <= 60; k++) { const p = from.clone().addScaledVector(dir, (k / 60) * len); if (W.solidAt(p, 0.1) || p.y < 0) { len = Math.max(0.5, ((k - 0.5) / 60) * len); break; } }
    this.a = from.clone(); this.b = from.clone().addScaledVector(dir, len); this.dir = dir.clone(); this.len = len; this.hits = [];
    // 판정: 광선 위 모든 대상 (관통)
    for (const t of f.foes()) { if (!t.hurtHitSeg(this.a, this.b, this.w)) continue; const d = t.pos.distanceTo(f.pos), h = o.hit ? o.hit(t, d) : { dmg: 60 }; const r = t.takeHit(f, h, dir.clone().setY(0).normalize()); if (r) { this.hits.push(t); const p = aimPt(t); spark(G, p, dir.clone().negate(), 2.2); G.fx.impact(p, CYAN, 1.8, dir); } }
    this.mo = new THREE.MeshBasicMaterial({ color: o.color ?? CYAN, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mi = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.Group(); G.scene.add(this.mesh); this.mesh.position.copy(this.b); this.mesh.lookAt(this.b.clone().add(dir));
    this.outer = new THREE.Mesh(TRACER, this.mo); this.inner = new THREE.Mesh(TRACER, this.mi); this.mesh.add(this.outer, this.inner); this.mesh.traverse((m) => { m.frustumCulled = false; });
    this.side = new V3().crossVectors(dir, UP).normalize(); if (this.side.lengthSq() < 0.1) this.side.set(1, 0, 0); this.up = new V3().crossVectors(this.side, dir).normalize();
    // 광선을 따라 고리 · 흩날리는 빛
    const n = Math.min(14, Math.round(len / 2.2)); for (let i = 1; i <= n; i++) G.fx.ring(this.a.clone().addScaledVector(dir, (i / (n + 1)) * len), { normal: dir, r0: this.w * 0.3, r1: this.w * 2.2, life: 0.3 + i * 0.015, color: i % 2 ? CYAN : CYAN2, op: 0.7 });
    G.fx.light(this.a, CYAN, 25, 0.2, 8); G.fx.light(this.b, CYAN, 25, 0.25, 8);
    spark(G, this.b, dir.clone().negate(), 1.4);
    this.update(0);
  }
  update(dt) {
    const G = this.G; this.t += dt; const k = this.t / this.life; if (k >= 1) return this.kill();
    const w = this.w * (1 - k) ** 0.6 * (1 + 0.15 * Math.sin(this.t * 80));
    this.outer.scale.set(w * 0.55, w * 0.55, this.len); this.inner.scale.set(w * 0.16, w * 0.16, this.len); this.mo.opacity = 0.55 * (1 - k); this.mi.opacity = 1 - k * k;
    if (k < 0.6) for (let i = 0; i < 4; i++) { const s = rand(0, this.len), a = this.t * 30 + s * 3, p = this.a.clone().addScaledVector(this.dir, s).addScaledVector(this.side, Math.cos(a) * this.w * 1.4).addScaledVector(this.up, Math.sin(a) * this.w * 1.4); G.fx.p(p, { vel: [rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5)], size: rand(0.06, 0.14), size1: 0.01, life: 0.4, color: i % 2 ? CYAN : CYAN2, alpha: 0.9, drag: 2 }); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mo.dispose(); this.mi.dispose(); }
}

/* ---------- 대인 살상 마인: 180초 · 적이 밟으면 짧은 경고음 뒤 폭발 (범위 피해 + 둔화) ---------- */
let _mineGeo = null;
function mineGeo() {
  if (_mineGeo) return _mineGeo;
  const body = new THREE.LatheGeometry([[0, 0.075], [0.06, 0.074], [0.11, 0.06], [0.15, 0.035], [0.17, 0.012], [0.17, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const cap = new THREE.CylinderGeometry(0.05, 0.06, 0.03, 20); cap.translate(0, 0.085, 0);
  const ring = new THREE.TorusGeometry(0.135, 0.008, 6, 40); ring.rotateX(Math.PI / 2); ring.translate(0, 0.042, 0);
  const zone = new THREE.RingGeometry(0.96, 1.0, 56); zone.rotateX(-Math.PI / 2);
  _mineGeo = { body, cap, ring, zone }; return _mineGeo;
}
const MINE_R = 1.15, MINE_BLAST = 2.6, MINE_LIFE = 180, MINE_MAX = 3;
class Mine {
  constructor(G, f, pos) {
    this.G = G; this.f = f; this.pos = pos.clone(); this.t = 0; this.done = false; this.trig = -1; const g = mineGeo();
    this.mesh = new THREE.Group(); this.mesh.position.copy(this.pos); G.scene.add(this.mesh);
    this.mBody = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.5, metalness: 0.5 });
    this.mGlow = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mZone = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const body = new THREE.Mesh(g.body, this.mBody); body.castShadow = true; this.mesh.add(body);
    this.mesh.add(new THREE.Mesh(g.cap, this.mBody), new THREE.Mesh(g.ring, this.mGlow));
    this.zone = new THREE.Mesh(g.zone, this.mZone); this.zone.position.y = 0.02; this.zone.scale.setScalar(MINE_R); this.mesh.add(this.zone);
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), this.mGlow); this.lamp.position.y = 0.105; this.mesh.add(this.lamp);
    G.fx.ring(this.pos.clone().setY(this.pos.y + 0.03), { normal: UP, r0: 0.2, r1: MINE_R, life: 0.4, color: CYAN }); G.fx.burst(this.pos, 8, 0x8a7a70, 2, { kind: 'dust' });
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    if (this.t > MINE_LIFE) return this.kill();
    const armed = this.t > 0.5;
    this.mesh.rotation.y += dt * 0.6;
    if (this.trig < 0) {
      const blink = armed ? (Math.sin(this.t * 6) > 0.6 ? 1 : 0.2) : 0.5;
      this.mGlow.opacity = 0.35 + 0.6 * blink; this.lamp.scale.setScalar(0.8 + blink * 0.5); this.mZone.opacity = armed ? 0.12 + 0.06 * Math.sin(this.t * 3) : 0;
      if (armed) for (const t of f.foes()) { const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z); if (d < MINE_R + 0.3 * t.scale && t.pos.y - this.pos.y < 0.6 && t.state !== 'ko') { this.trig = 0; sfx('teleRed'); break; } }
    } else {
      this.trig += dt; this.mGlow.color.setHex(this.trig % 0.08 < 0.04 ? 0xff3040 : CYAN); this.mGlow.opacity = 1; this.mZone.opacity = 0.5; this.lamp.scale.setScalar(2);
      if (this.trig >= 0.22) return this.blast();
    }
  }
  blast() {
    const G = this.G, f = this.f, c = this.pos.clone(); this.kill();
    sfx('boom'); sfx('big'); G.shake(0.3);
    G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.3, r1: MINE_BLAST * 1.3, life: 0.45, color: CYAN }); G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.2, r1: MINE_BLAST * 0.8, life: 0.3, color: 0xffffff });
    G.fx.burst(c.clone().setY(c.y + 0.3), 40, [CYAN, CYAN2, 0xffffff, 0xff8040], 11, { dir: UP, spread: 1.2, grav: 10 });
    G.fx.burst(c, 26, 0x6a5a50, 6, { kind: 'smoke', sk: 1.5 }); G.fx.burst(c, 16, 0x7a6a60, 5, { kind: 'dust', sk: 1.6 });
    G.fx.beam(c, { r: 1.0, h: 4, color: CYAN, life: 0.35 }); G.fx.light(c.clone().setY(c.y + 1), CYAN, 120, 0.4, 14);
    for (const t of f.foes()) {
      const dx = t.pos.x - c.x, dz = t.pos.z - c.z, d = Math.hypot(dx, dz); if (d > MINE_BLAST + 0.42 * t.scale || t.pos.y - c.y > 1.6) continue;
      const r = t.takeHit(f, { dmg: 72, kb: [3.5, 7.5], stun: 0.7, hs: 0.1, shake: 0.2, daze: 34, snd: 'big', noScale: true }, d > 0.01 ? new V3(dx / d, 0, dz / d) : f.fwd(new V3()));
      if (r === 'hit' || r === 'block') t.addStatus('slow', 4, 0.55, f);
    }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mBody.dispose(); this.mGlow.dispose(); this.mZone.dispose(); this.lamp.geometry.dispose(); const L = this.f.mines; if (L) { const i = L.indexOf(this); if (i >= 0) L.splice(i, 1); } }
}

/* ---------- 궁극기 스코프 화면 (조준경 시야 연출 · DOM 오버레이) ---------- */
class ScopeView {
  constructor(G, f, life) {
    this.G = G; this.f = f; this.t = 0; this.life = life; this.done = false;
    const d = document.createElement('div'); this.el = d;
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;transition:opacity .08s;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 31vmin, rgba(0,12,16,0.92) 33vmin)';
    d.innerHTML = '<div style="position:absolute;left:50%;top:50%;width:64vmin;height:64vmin;transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 0 2px rgba(58,240,255,.85), inset 0 0 40px rgba(58,240,255,.25)"></div>'
      + '<div style="position:absolute;left:50%;top:calc(50% - 32vmin);width:2px;height:64vmin;margin-left:-1px;background:linear-gradient(rgba(58,240,255,.9) 0 44%, transparent 44% 56%, rgba(58,240,255,.9) 56%)"></div>'
      + '<div style="position:absolute;top:50%;left:calc(50% - 32vmin);height:2px;width:64vmin;margin-top:-1px;background:linear-gradient(90deg, rgba(58,240,255,.9) 0 44%, transparent 44% 56%, rgba(58,240,255,.9) 56%)"></div>'
      + '<div style="position:absolute;left:50%;top:50%;width:7vmin;height:7vmin;transform:translate(-50%,-50%);border:2px solid rgba(255,60,80,.9);border-radius:50%"></div>'
      + '<div style="position:absolute;left:calc(50% + 34vmin);top:calc(50% - 3vmin);font:bold 2.4vmin monospace;color:rgba(58,240,255,.9)">PROJECT-J<br>TARGET LOCK</div>';
    document.body.appendChild(d); requestAnimationFrame(() => { if (!this.done) d.style.opacity = '1'; });
  }
  update(dt) { this.t += dt; if (this.t >= this.life || this.f.state !== 'act' || !this.f.act || !this.f.act.ult) this.kill(); }
  kill() { if (this.done) return; this.done = true; this.el.remove(); if (this.f.scope === this) this.f.scope = null; }
}

/* =====================================================================
   기술 — 원거리 저격수: 쏘고, 물러나고, 함정을 깐다
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 사격 — 공중에서 총구를 아래로 겨누고 쏘며 내리꽂혀 마력 폭발 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.35, 0, 0], head: [0.3, 0, 0], shoulderR: [-1.3, 0, -0.15], elbowR: [-0.6, 0, 0], weapon: [-1.4, 0, 0], shoulderL: [-1.2, 0, 0.2], elbowL: [-0.4, 0, 0], hipL: [-1.0, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: CYAN, dmg: 64, r: 2.5, fallDmg: 28,
    fx: (f, o, G, c) => { G.fx.beam(c, { r: 0.7, h: 5, color: CYAN, life: 0.35 }); G.fx.burst(c.clone().setY(c.y + 0.2), 24, CYANS, 8, { dir: UP, spread: 1 }); sfx('shot'); },
  }),

  /* --- 기본 공격: 허리 사격 → 두 발 연사 → 개머리판 타격 + 근접 사격 → 견착 강탄 (움직이며 쏠 수 있음) --- */
  light1: { dur: 0.34, cancel: 0.16, next: 'light2', move: 0.5, ikOff: true, track: 0.06,
    keys: [[0, 'hip'], [0.06, 'hip'], [0.09, 'hipKick'], [0.2, 'hip'], [0.34, 'base']],
    ev: [[0.07, (f, o, G) => { fire(f, G, { dmg: 22 }); if (focusOn(f)) fire(f, G, { dmg: 10, spread: 0.06, flash: 0.5, hit: { noScale: true } }); }]] },
  light2: { dur: 0.4, cancel: 0.22, next: 'light3', move: 0.5, ikOff: true, track: 0.1,
    keys: [[0, 'hip'], [0.05, 'hipKick'], [0.1, 'hip'], [0.15, 'hipKick'], [0.22, 'hip'], [0.4, 'base']],
    ev: [[0.05, (f, o, G) => fire(f, G, { dmg: 15, stun: 0.28 })], [0.15, (f, o, G) => fire(f, G, { dmg: 17, stun: 0.34 })]] },
  light3: { dur: 0.6, cancel: 0.4, next: 'light4', move: 0.3, ikOff: true, trail: true, track: 0.12,
    keys: [[0, 'buttWind'], [0.1, 'buttWind'], [0.17, 'buttHit'], [0.28, 'buttHit'], [0.36, 'hip'], [0.47, 'hipKick'], [0.6, 'base']], lunge: [[0.08, 0.18, 7]],
    ev: [[0.1, () => sfx('swing')], [0.15, (f) => f.slashFx({ r: 1.2, color: CYAN, tilt: 0.3, at: [0, 1.2, 0.6] })], [0.45, (f, o, G) => fire(f, G, { dmg: 22, kb: [3, 1.5], stun: 0.42 })]],
    hits: [{ t0: 0.12, t1: 0.24, weapon: false, at: [0, 1.15, 0.85], r: 0.7, dmg: 30, kb: [3.5, 1.2], stun: 0.5, hs: 0.08, daze: 14 }] },
  light4: { dur: 0.72, move: 0.15, track: 0.3, shout: true,
    keys: [[0, 'aim'], [0.3, 'aim'], [0.34, 'aimKick'], [0.5, 'aim'], [0.72, 'base']],
    start: (f) => { charge(f, 0.6); sfx('charge'); },
    ev: [[0.32, (f, o, G) => { const d = fire(f, G, { dmg: 46, kb: [6, 2], stun: 0.6, hs: 0.1, daze: 22, speed: 140, w: 1.6, r: 0.18, pierce: true, flash: 1.6, big: true }); f.vel.addScaledVector(d.clone().setY(0).normalize(), -5); }], [0.5, (f) => charge(f, 0)]],
    end: (f) => charge(f, 0) },

  /* --- 우클: 초정밀 타겟 저격 — 레이저로 조준한 뒤 관통하는 마력 광선 (멀수록 강함 · 집중 가득 차면 헤드샷) --- */
  heavy: { dur: 1.1, cd: 'heavy', track: 0.6, noMove: true, shout: true,
    keys: [[0, 'aim'], [0.62, 'aim'], [0.65, { ...poses.aimKick, weapon: [0.45, 0, 0], spine: [-0.18, -0.32, 0] }], [0.85, 'aim'], [1.1, 'base']],
    start: (f, o, G) => { charge(f, 0.2); sfx('charge'); G.spawn(new LaserSight(G, f, f.act)); f.headshot = !!f.manaFull; if (f.headshot) G.say(f, '"…머리."'); },
    tick: (f, o, G, t) => { if (t < 0.62) { charge(f, 0.2 + t * 1.3); const p = f.model.muzzle(new V3()); for (let i = 0; i < 2; i++) { const a = rand(0, TAU), q = p.clone().add(new V3(Math.cos(a) * 0.5, rand(-0.4, 0.4), Math.sin(a) * 0.5)), v = p.clone().sub(q).multiplyScalar(5); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.08, size1: 0.02, life: 0.2, color: i ? CYAN : CYAN2, alpha: 0.9 }); } } },
    ev: [[0.63, (f, o, G) => {
      const from = f.model.muzzle(new V3()), dir = aimDir(f, from), foc = focusOn(f), hs = f.headshot; if (hs) { f.mana = 0; f.manaFull = false; }
      G.spawn(new RailBeam(G, f, from, dir, { w: foc ? 0.36 : 0.26, life: 0.6, hit: (t, d) => ({ dmg: Math.round((72 + 68 * clamp((d - 5) / 15, 0, 1)) * (hs ? 1.5 : 1) * (foc ? 1.15 : 1)), kb: [8, 2.5], stun: 0.75, hs: 0.14, shake: 0.25, daze: 40, snd: 'big', noScale: true }) }));
      muzzleFlash(f, G, dir, 2.2); sfx('shot'); sfx('boom'); G.shake(0.22); G.flash(CYAN2, 0.15); f.vel.addScaledVector(dir.clone().setY(0).normalize(), -7); charge(f, 1); f.headshot = false;
    }], [0.9, (f) => charge(f, 0)]],
    end: (f) => { charge(f, 0); f.headshot = false; } },

  /* --- Shift: 마력집중 – 개방 — 마력을 풀어 8초간 공격력 ×1.3 · 사거리 · 탄속 ↑ · 탄 관통 (풀려나는 충격파) --- */
  s1: { dur: 0.7, cd: 's1', ikOff: true, aim: false, shout: true, move: 0.1,
    keys: [[0, { ...poses.release, shoulderL: [-0.6, 0, 0.5], elbowL: [-1.4, 0, 0] }], [0.22, 'release'], [0.5, 'release'], [0.7, 'base']],
    start: (f, o, G) => { G.say(f, '"마력집중 — 개방."'); sfx('charge'); charge(f, 1); },
    tick: (f, o, G, t) => { if (t < 0.22) { const c = f.chest(new V3()); for (let i = 0; i < 3; i++) { const a = rand(0, TAU), R = rand(1, 2), p = c.clone().add(new V3(Math.cos(a) * R, rand(-0.9, 0.9), Math.sin(a) * R)), v = c.clone().sub(p).multiplyScalar(5); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.1, size1: 0.02, life: 0.22, color: CYANS[i], alpha: 0.9 }); } } },
    ev: [[0.22, (f, o, G) => {
      f.focusT = FOCUS_T; f.addStatus('atk', FOCUS_T, 1.3, f); sfx('zap'); sfx('boom'); G.shake(0.18); G.flash(CYAN, 0.18);
      const c = f.pos.clone().setY(f.pos.y + 0.05); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 3.2, life: 0.5, color: CYAN }); G.fx.ring(f.chest(new V3()), { r0: 0.2, r1: 2.2, life: 0.35, color: CYAN2, billboard: true });
      G.fx.beam(c, { r: 0.9, h: 6, color: CYAN, life: 0.5 }); G.fx.burst(f.chest(new V3()), 40, CYANS, 7); G.fx.light(f.chest(new V3()), CYAN, 120, 0.5, 14);
      areaHit(f, c, 2.3, { dmg: 30, kb: [6, 2.5], stun: 0.45, hs: 0.06, daze: 14 }, 1.2);
    }], [0.6, (f) => charge(f, 0)]],
    end: (f) => charge(f, 0) },

  /* --- E: 대인 살상 마인 — 앞에 마인을 묻는다 (180초 · 최대 3개 · 적이 밟으면 폭발 72 + 둔화 4초) --- */
  s2: { dur: 0.62, cd: 's2', ikOff: true, aim: true, move: 0,
    keys: [[0, { ...poses.plant, hipY: -0.1, spine: [0.3, 0.1, 0] }], [0.2, 'plant'], [0.42, 'plant'], [0.62, 'base']],
    start: (f) => { sfx('swing'); },
    ev: [[0.28, (f, o, G) => {
      const p = f.local([0.05, 0, 0.75]); p.y = f.pos.y; const W = G.stage && G.stage.world; if (W) p.y = W.groundAt(p.x, p.z, f.pos.y + 0.3);
      f.mines = f.mines || []; while (f.mines.length >= MINE_MAX) f.mines[0].kill();
      const mi = new Mine(G, f, p); f.mines.push(mi); G.spawn(mi); sfx('block'); sfx('tele');
    }]] },

  /* --- 극한 회피 뒤 좌클: 백플립 사격 — 뒤로 공중제비를 돌며 거꾸로 된 채 한 발 --- */
  counter: { dur: 0.72, ikOff: true, aim: true, noMove: true,
    keys: [[0, { ...poses.hip, hipY: -0.12, kneeL: [0.9, 0, 0], kneeR: [0.9, 0, 0], hipL: [-0.7, 0, 0.1], hipR: [-0.3, 0, -0.1] }], [0.1, { ...poses.aim, hipL: [-1.3, 0, 0.1], kneeL: [1.7, 0, 0], hipR: [-1.0, 0, -0.1], kneeR: [1.6, 0, 0] }], [0.5, {}], [0.62, { hipL: [-0.5, 0, 0.1], kneeL: [0.8, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [0.6, 0, 0] }], [0.72, 'base']],
    start: (f, o, G) => { f.inv = Math.max(f.inv, 0.55); f.flipA = 0; },
    ev: [[0.04, (f, o, G) => { const back = o ? new V3().subVectors(f.pos, o.pos).setY(0).normalize() : f.fwd(new V3()).negate(); f.vel.set(back.x * 7.5, 8.2, back.z * 7.5); f.onGround = false; sfx('dash'); sfx('jump'); G.fx.burst(f.pos.clone().setY(0.1), 10, 0x8a7a90, 3, { kind: 'dust' }); }],
      [0.3, (f, o, G) => { fire(f, G, { dmg: 66, kb: [5, 3], stun: 0.6, hs: 0.12, daze: 30, speed: 140, w: 1.5, r: 0.18, pierce: true, flash: 1.5, big: true, hit: { snd: 'big' } }); G.slow(0.4, 0.18); }]],
    tick: (f, o, G, t) => { f.flipA = -TAU * clamp((t - 0.06) / 0.5, 0, 1) ** 0.9; f.faceOpp(); },
    end: (f) => { f.flipA = 0; } },

  /* --- Q: 표적 제거 · 레일 스나이프 — 무릎 쏴 자세로 마력을 모아, 조준경 너머의 표적을 관통 광선으로 지운다 --- */
  ult: { dur: 3.4, ult: true, aim: true, shout: true,
    keys: [[0, 'aim'], [0.4, 'kneel'], [1.82, 'kneel'], [1.86, { ...poses.kneel, weapon: [0.55, 0, 0], spine: [-0.2, -0.32, 0], head: [-0.1, 0.8, 0.08] }], [2.3, 'kneel'], [2.9, 'kneel'], [3.4, 'win']],
    cam: [[0, { ref: 'self', p: [1.2, 1.2, 2.1], l: [0, 1.05, 0], fov: 40 }], [0.85, { ref: 'self', p: [0.75, 1.15, 1.25], l: [0, 1.0, 0.2], fov: 32 }],
      [0.95, { ref: 'self', p: [0.12, 1.12, -0.7], l: [0.05, 1.0, 12], fov: 14 }], [1.8, { ref: 'self', p: [0.12, 1.12, -0.65], l: [0.05, 1.0, 12], fov: 9 }],
      [1.86, { ref: 'target', p: [3.2, 1.5, 2.2], l: [0, 1.1, 0], fov: 50 }], [2.45, { ref: 'target', p: [4.2, 1.8, 3.6], l: [0, 1.0, -2], fov: 56 }],
      [2.55, { ref: 'self', p: [3.6, 1.6, 2.6], l: [0, 1.0, 4], fov: 58 }], [3.4, { ref: 'self', p: [2.4, 1.7, 3.4], l: [0, 1.1, 0], fov: 46 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(0x062a30, 0.4); charge(f, 1); sfx('charge'); G.say(f, '"표적 확인."'); G.spawn(new LaserSight(G, f, f.act)); }],
      [0.95, (f, o, G) => { G.spawn(f.scope = new ScopeView(G, f, 0.9)); sfx('tele'); }],
      ...[1.15, 1.35, 1.55].map((t, i) => [t, (f, o, G) => { o = f.ultTgt || o; if (!o || o.gone) return; const from = f.model.muzzle(new V3()), dir = aimPt(o).sub(from).normalize(); G.spawn(new Bullet(G, f, { pos: from, dir, speed: 160, r: 0.2, life: 1, pierce: true, hit: { dmg: 16, kb: [0, 0], stun: 99, hs: 0.03, nokill: true, noScale: true, force: true, noCrit: true, daze: 10, snd: 'hit' } })); muzzleFlash(f, G, dir, 0.8); sfx('shot'); if (i === 2) G.say(f, '"…제거."'); }]),
      [1.84, (f, o, G) => { o = f.ultTgt || o; if (f.scope) f.scope.kill(); const from = f.model.muzzle(new V3()), dir = o && !o.gone ? aimPt(o).sub(from).normalize() : f.fwd(new V3());
        if (o) o.release(); sfx('boom'); sfx('big'); sfx('shot'); G.flash(0xeaffff, 0.65); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.5);
        G.spawn(new RailBeam(G, f, from, dir, { len: 60, w: 0.75, life: 1.1, hit: (t) => t === o ? { dmg: 240, kb: [13, 5], stun: 1.0, hs: 0.22, shake: 0.5, noScale: true, force: true, daze: 100, snd: 'big' } : { dmg: 120, kb: [9, 5], stun: 0.8, force: true, noCrit: true, noScale: true } }));
        muzzleFlash(f, G, dir, 3.5); G.fx.ring(from, { r0: 0.2, r1: 3, life: 0.5, color: CYAN2, billboard: true }); G.fx.light(from, CYAN, 200, 0.6, 20);
        f.vel.addScaledVector(dir.clone().setY(0).normalize(), -9); G.slow(0.3, 0.6); charge(f, 0.4); }],
    ],
    tick: (f, o, G, t, dt) => {
      // 마력이 몸에서 총으로 빨려 들어간다
      if (t < 1.82) { const p = f.model.muzzle(new V3()), c = f.chest(new V3()); for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1, q = c.clone().add(new V3(Math.cos(a) * 0.9, rand(-0.6, 0.8), Math.sin(a) * 0.9)), v = p.clone().sub(q).multiplyScalar(3); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.02, life: 0.3, color: CYANS[i], alpha: 0.9, drag: 0.5 }); }
        if (Math.random() < 0.5) G.fx.p(p, { size: 0.3 + t * 0.2, size1: 0.05, life: 0.12, color: CYAN2, alpha: 0.8 }); }
    },
    end: (f, o, G) => { G.setTint(0, 0); charge(f, 0); if (f.scope) f.scope.kill(); const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, CYAN, big ? 1.7 : 1.0, dir);
  G.fx.burst(p, big ? 18 : 8, [CYAN, CYAN2, 0xffffff], 7, { dir: dir.clone().negate(), spread: 1.2 });
  if (big) G.fx.ring(p, { r0: 0.2, r1: 1.8, life: 0.3, color: CYAN2, billboard: true });
  // 집중: 맞힐 때마다 쌓이고, 가득 차면 다음 저격이 헤드샷 (×1.5)
  if (!att.manaFull) { att.mana = Math.min(100, (att.mana || 0) + h.dmg * 0.35); if (att.mana >= 100) { att.manaFull = true; sfx('tele'); } }
}

// 마력 개방 · 집중 상태 · 백플립 회전
function createModelWithFocus(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (f.focusT > 0) { f.focusT = Math.max(0, f.focusT - dt);
      if (f.root.visible && Math.random() < 0.5) { const a = f.G.time * 4 + Math.random() * TAU; f.G.fx.p(f.pos.clone().add(new V3(Math.cos(a) * 0.5, 0.2 + Math.random() * 1.5, Math.sin(a) * 0.5)), { vel: [0, 1.2, 0], life: 0.5, size: 0.08, size1: 0.02, color: Math.random() < 0.5 ? CYAN : CYAN2, alpha: 0.85, drag: 0.5 }); } }
    // 백플립: 골반 높이를 축으로 몸 전체를 x 축 회전
    const b = m.body, a = f.flipA || 0;
    if (a) { const h = DIMS.hipH; b.rotation.x = a; b.position.set(0, b.position.y + h - h * Math.cos(a), -h * Math.sin(a)); m.root.updateMatrixWorld(true); }
    else if (b.rotation.x) { b.rotation.x = 0; b.position.z = 0; m.root.updateMatrixWorld(true); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

// CPU: 거리를 두고 저격 · 가까우면 마인을 깔고 물러난다
function aiPick(f, o, dist) {
  if (dist < 4 && f.cd.s2 <= 0 && (f.mines || []).length < MINE_MAX && Math.random() < 0.35) return 's2';
  if (dist > 5 && dist < 26 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist < 18 && f.cd.s1 <= 0 && !focusOn(f) && Math.random() < 0.15) return 's1';
  return null;
}

export default {
  id: 'sniper', name: '제이', short: '제이', title: 'SNIPER · 표적 제거', scale: 0.98,
  desc: '원거리 · 저격 · 함정. 대물 저격총 "PROJECT-J" 를 쓰는 암살자. 허리 사격으로 견제하고, 레이저로 조준한 관통 광선으로 멀리 있는 적을 저격하며, 발밑에 대인 살상 마인을 깔아 다가오는 적을 묶는다. 마력을 개방하면 공격력과 사거리가 늘어난다.',
  stats: { hp: 860, speed: 7.6, jump: 10.5, crit: 0.25 },
  palettes: [{ accent: CYAN, glow: CYAN }, { accent: 0xff4a6a, glow: 0xff4a6a }],
  skills: { heavy: { name: '초정밀 타겟 저격', cd: 7 }, s1: { name: '마력집중 – 개방', cd: 16 }, s2: { name: '대인 살상 마인', cd: 9 }, ult: { name: '표적 제거 · 레일 스나이프', sub: 'TARGET REMOVAL' } },
  aimRange: RANGE, aiRange: [7, 16], aiPick,
  onReset: (f) => { f.mines = []; f.mana = 0; f.manaFull = false; f.focusT = 0; f.flipA = 0; f.chargeK = 0; f.headshot = false; f.ultTgt = null; if (f.scope) f.scope.kill(); f.scope = null; },
  resource: (f) => focusOn(f) ? { v: f.focusT / FOCUS_T, label: '개방', color: 0xbafcff, full: true } : f.manaFull ? { v: 1, label: '헤드샷', color: 0xff5a6a, full: true } : { v: (f.mana || 0) / 100, label: '집중', color: 0x2ab8c8 },
  moveList: [['좌클 ×4', '허리 사격 22 → 두 발 연사 15·17 → 개머리판 타격 30 + 근접 사격 22 → 견착 강탄(관통) 46. 쏘면서 이동 가능'], ['공중 좌클', '총구를 아래로 겨누고 내리꽂혀 마력 폭발'],
    ['우클 · 초정밀 타겟 저격', '레이저로 조준한 뒤 관통하는 마력 광선 72 (멀수록 강해져 20m 에서 140)'], ['Shift · 마력집중 – 개방', '충격파 30 · 8초간 공격력 ×1.3 · 사거리 45m · 탄속 ↑ · 모든 탄 관통 · 허리 사격 한 발 추가'],
    ['E · 대인 살상 마인', '앞에 마인 설치 (180초 · 최대 3개): 적이 밟으면 폭발 72 + 4초 둔화'], ['Q · 표적 제거 · 레일 스나이프', '무릎 쏴 자세로 조준경 너머 표적에 표식탄 셋(10×3) → 관통 레일 광선 144'],
    ['집중', '맞힐수록 쌓이고 가득 차면 다음 초정밀 저격이 헤드샷 (×1.5)'], ['C (타이밍) · 극한 회피', '백플립 사격: 뒤로 공중제비를 돌며 관통탄 66'], ['가만히', '총을 어깨에 걸치고 쉼']],
  createModel: createModelWithFocus, poses, moves, hitFx,
};
