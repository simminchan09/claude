// 모르웬 (MORWEN · 피의 인형사) — 중거리 · 실 채찍 · 인형 소환 · 속박 / 출혈
// "죽은 자의 기억을 인형에 묶어두는 인형사." 사라진 이들의 이름이 끝내 잊히지 않도록, 오늘도 조용히 인형에게 이름을 붙인다.
// 무기: 피가 흘러내리는 마리오네트 조종 십자 — 실을 채찍처럼 휘두르고, 핏빛 실로 묶고, 꿰맨 인형을 부린다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, buildDoll, BLOOD, ROSE, PINKF, CREAM, VIOLET, DARKR } from './morwen_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const FLAMES = [ROSE, PINKF, 0xffd0dc, BLOOD];
const RANGE = 14; // 조준 거리
const HYEOL_MAX = 100;

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const poses = {
  // 기본: 왼팔로 양 인형을 안고, 오른손에 조종 십자를 가슴 앞에 들어 실을 늘어뜨린다 — 고요한 자세
  base: { hips: [0, 0.08, 0], spine: [0.02, -0.04, 0], chest: [0.02, -0.04, 0], head: [0.1, 0.12, 0.08],
    shoulderR: [-0.75, 0, -0.18], elbowR: [-1.0, 0, 0], weapon: [-0.25, 0.05, 0], shoulderL: [-0.35, 0, 0.12], elbowL: [-1.75, 0, 0], handL: [0, 0, 0.1],
    hipL: [-0.06, 0, 0.04], kneeL: [0.12, 0, 0], footL: [0.15, 0, 0], hipR: [0.08, 0, -0.04], kneeR: [0.06, 0, 0], footR: [0.12, 0, 0] },
  run: { hips: [0, -0.06, 0], spine: [0.25, 0.04, 0], chest: [0.05, 0.04, 0], head: [-0.15, 0, 0], shoulderR: [-0.5, 0, -0.3], elbowR: [-1.1, 0, 0], weapon: [0.1, 0.8, 0], shoulderL: [-0.45, 0, 0.15], elbowL: [-1.8, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.3, 0, 0], kneeR: [1.3, 0, 0], footR: [0.4, 0, 0], shoulderR: [-1.2, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.6, 0.6, 0] },
  // 방어: 인형을 앞에 내밀어 가리고 십자를 세운다
  guard: { hips: [0, -0.12, 0], spine: [0.15, 0.06, 0], chest: [0.05, 0.06, 0], head: [0.1, 0, 0], shoulderR: [-1.15, 0, -0.05], elbowR: [-1.45, 0, 0], weapon: [1.1, -0.2, 0], shoulderL: [-1.15, 0, 0.1], elbowL: [-1.1, 0, 0],
    hipL: [-0.45, 0, 0.16], kneeL: [0.75, 0, 0], hipR: [0.3, 0, -0.16], kneeR: [0.55, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.6, 0.8, 0.3], shoulderL: [-0.1, 0, 0.5], elbowL: [-1.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.5, 1.2, 0.5], shoulderL: [0.2, 0, 0.8], elbowL: [-1.2, 0, 0], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.7, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-1.2, 0, 0.3], elbowR: [-0.3, 0, 0], elbowL: [-1.6, 0, 0], weapon: [0.05, -0.6, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.45, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.5, 0, -0.3], elbowR: [-0.6, 0, 0], weapon: [0.3, 2.4, 0.3], shoulderL: [-0.3, 0, 0.3], elbowL: [-1.7, 0, 0], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 인형을 두 팔로 꼭 안고 고개를 기울인다
  win: { hips: [0, 0.12, 0.03], spine: [0.08, -0.05, 0], chest: [0.04, -0.06, 0], head: [0.22, 0.2, 0.22], shoulderR: [-0.7, 0, 0.35], elbowR: [-1.75, 0, 0], weapon: [-0.9, -0.6, 0], shoulderL: [-0.55, 0, 0.0], elbowL: [-1.8, 0, 0],
    hipL: [-0.05, 0, 0.06], kneeL: [0.12, 0, 0], hipR: [0.3, 0, -0.08], kneeR: [0.6, 0, 0], footR: [0.4, 0, 0] },
  portrait: { hips: [0, 0.15, 0], chest: [0, -0.12, 0], head: [0.06, 0.12, 0.12], shoulderR: [-1.4, 0, -0.35], elbowR: [-1.5, 0, 0], weapon: [0.15, 0.4, 0], shoulderL: [-0.45, 0, 0.1], elbowL: [-1.75, 0, 0] },
  // 오른쪽으로 감은 실 → 왼쪽으로 가로 채찍
  windR: { hips: [0, -0.4, 0], spine: [0.08, -0.3, 0], chest: [0.02, -0.35, 0], head: [0, 0.5, 0], shoulderR: [-1.15, 0, -0.95], elbowR: [-0.5, 0, 0], weapon: [0.1, 1.75, 0], shoulderL: [-0.45, 0, 0.15], elbowL: [-1.7, 0, 0] },
  lashL: { hips: [0, 0.4, 0], spine: [0.15, 0.35, 0], chest: [0.05, 0.4, 0], head: [0, -0.5, 0], shoulderR: [-1.35, 0, 0.5], elbowR: [-0.15, 0, 0], weapon: [-0.05, -1.5, 0], shoulderL: [-0.2, 0, 0.35], elbowL: [-1.7, 0, 0],
    hipL: [-0.55, 0, 0.12], kneeL: [0.6, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.3, 0, 0] },
  // 왼쪽에서 감아 오른쪽으로 되돌려 치는 채찍
  windL: { hips: [0, 0.45, 0], spine: [0.1, 0.35, 0], chest: [0.03, 0.4, 0], head: [0, -0.55, 0], shoulderR: [-1.3, 0, 0.55], elbowR: [-0.9, 0, 0], weapon: [0.15, -1.9, 0], shoulderL: [-0.3, 0, 0.3], elbowL: [-1.7, 0, 0] },
  lashR: { hips: [0, -0.4, 0], spine: [0.18, -0.35, 0], chest: [0.04, -0.4, 0], head: [0, 0.5, 0], shoulderR: [-1.25, 0, -1.0], elbowR: [-0.1, 0, 0], weapon: [-0.1, 1.55, 0], shoulderL: [-0.4, 0, 0.2], elbowL: [-1.7, 0, 0],
    hipL: [-0.5, 0, 0.12], kneeL: [0.55, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.3, 0, 0] },
  // 십자를 머리 위로 → 앞으로 내려치기
  raise: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.85, 0, -0.15], elbowR: [-0.3, 0, 0], weapon: [1.45, 0, 0], shoulderL: [-0.5, 0, 0.2], elbowL: [-1.7, 0, 0],
    hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  slam: { hips: [0, -0.1, 0], spine: [0.5, 0, 0], chest: [0.15, 0, 0], head: [-0.3, 0, 0], shoulderR: [-1.25, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-0.45, 0, 0], shoulderL: [-0.3, 0, 0.3], elbowL: [-1.7, 0, 0],
    hipL: [-0.9, 0, 0.12], kneeL: [1.0, 0, 0], hipR: [0.5, 0, -0.12], kneeR: [0.35, 0, 0] },
  // 왼손으로 인형을 던짐
  tossBack: { hips: [0, 0.5, 0], spine: [-0.1, 0.4, 0], chest: [-0.05, 0.35, 0], head: [0, -0.6, 0], shoulderL: [-2.5, 0, 0.5], elbowL: [-1.0, 0, 0], shoulderR: [-0.6, 0, -0.3], elbowR: [-1.1, 0, 0], weapon: [0.1, 0.5, 0],
    hipL: [-0.2, 0, 0.12], kneeL: [0.3, 0, 0], hipR: [0.4, 0, -0.12], kneeR: [0.5, 0, 0] },
  toss: { hips: [0, -0.35, 0], spine: [0.3, -0.3, 0], chest: [0.08, -0.3, 0], head: [-0.2, 0.4, 0], shoulderL: [-1.45, 0, 0.05], elbowL: [-0.1, 0, 0], shoulderR: [-0.4, 0, -0.4], elbowR: [-1.0, 0, 0], weapon: [0.2, 0.9, 0],
    hipL: [-0.8, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.5, 0, -0.12], kneeR: [0.3, 0, 0] },
  // 십자를 앞으로 겨눔 (실을 쏜다)
  aimX: { hips: [0, 0.3, 0], spine: [0.08, 0.25, 0], chest: [0.03, 0.22, 0], head: [0, -0.4, 0], shoulderR: [-1.55, 0, -0.06], elbowR: [-0.12, 0, 0], weapon: [0.05, 0, 0], shoulderL: [-0.4, 0, 0.2], elbowL: [-1.7, 0, 0],
    hipL: [-0.5, 0, 0.12], kneeL: [0.55, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.25, 0, 0] },
  aimPrep: { hips: [0, 0.4, 0], spine: [-0.04, 0.3, 0], chest: [-0.04, 0.25, 0], head: [0, -0.5, 0], shoulderR: [-1.0, 0, -0.6], elbowR: [-1.4, 0, 0], weapon: [0.9, 1.0, 0], shoulderL: [-0.4, 0, 0.2], elbowL: [-1.7, 0, 0] },
  // 무릎 꿇듯 낮게 앉아 인형을 앞에 내려놓는 소환 자세
  summon: { hipY: -0.12, hips: [0, 0, 0], spine: [0.45, 0, 0], chest: [0.15, 0, 0], head: [-0.2, 0, 0], shoulderL: [-1.2, 0, 0.1], elbowL: [-0.4, 0, 0], shoulderR: [-0.9, 0, -0.6], elbowR: [-0.6, 0, 0], weapon: [-0.6, 0.9, 0],
    hipL: [-1.3, 0, 0.12], kneeL: [1.7, 0, 0], footL: [-0.4, 0, 0], hipR: [-0.1, 0, -0.1], kneeR: [1.6, 0, 0], footR: [-0.2, 0, 0] },
  // 지휘하듯 두 팔을 벌림 (궁극기 · 소환진)
  conduct: { hips: [0, 0, 0], spine: [-0.12, 0, 0], chest: [-0.1, 0, 0], head: [-0.25, 0, 0], shoulderR: [-2.2, 0, -0.75], elbowR: [-0.3, 0, 0], weapon: [1.0, 0.6, 0], shoulderL: [-2.0, 0, 0.8], elbowL: [-0.4, 0, 0],
    hipL: [-0.15, 0, 0.12], kneeL: [0.15, 0, 0], hipR: [0.15, 0, -0.12], kneeR: [0.15, 0, 0] },
  // 뒤로 물러서는 자세 (반격)
  hop: { hips: [0, 0, 0], spine: [-0.25, 0, 0], chest: [-0.1, 0, 0], head: [0.1, 0, 0], shoulderR: [-1.4, 0, -0.4], elbowR: [-0.3, 0, 0], weapon: [0.2, 0.2, 0], shoulderL: [-0.3, 0, 0.6], elbowL: [-1.0, 0, 0],
    hipL: [-0.9, 0, 0], kneeL: [1.2, 0, 0], hipR: [0.3, 0, 0], kneeR: [0.9, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 인형을 들어 올려 얼굴을 맞대고 속삭인다
  idle2: { hips: [0, 0.1, 0.03], spine: [0.06, 0.05, 0], chest: [0.02, 0.05, 0], head: [0.2, 0.25, 0.25], shoulderL: [-1.1, 0, 0.05], elbowL: [-2.0, 0, 0], handL: [0, 0, 0.3], shoulderR: [-0.3, 0, -0.1], elbowR: [-0.6, 0, 0], weapon: [-1.2, 0.2, 0],
    hipL: [-0.04, 0, 0.04], kneeL: [0.1, 0, 0], hipR: [0.15, 0, -0.04], kneeR: [0.4, 0, 0], footR: [0.3, 0, 0] },
});

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const hyeol = (f) => f.hyeol || 0;
const lash = (f, on) => { f.lashOn = on; };
const aimPt = (t, out = new V3()) => (t.hurt && t.hurt[0] ? out.copy(t.hurt[0].a).lerp(t.hurt[0].b, 0.45) : t.chest(out));
const alive = (t) => t && !t.gone && t.state !== 'ko';
function flame(G, p, n = 8, s = 1) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.25, 0.25) * s, rand(-0.1, 0.2) * s, rand(-0.25, 0.25) * s)), { vel: [rand(-0.6, 0.6), rand(1.5, 3.5) * s, rand(-0.6, 0.6)], size: rand(0.18, 0.36) * s, size1: 0.03, life: rand(0.35, 0.7), color: FLAMES[i % 4], alpha: 0.85, drag: 1.2, grav: -1.5, flick: 0.5 }); }
function bloodBurst(G, p, s = 1, dir) {
  G.fx.burst(p, Math.round(16 * s), [BLOOD, 0x8a0414, ROSE], 6 * s, dir ? { dir, spread: 1.2, grav: 14 } : { grav: 14 });
  G.fx.burst(p, Math.round(4 * s), ROSE, 1.4 * s, { kind: 'glow', sk: 0.7 * s });
  G.fx.light(p, ROSE, 40 * s, 0.22, 8);
}
function fluff(G, p, n = 14, sp = 4) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.06, 0.12), size1: 0.04, life: rand(0.5, 1), color: i % 3 ? CREAM : 0xf2c8d0, alpha: 0.95, drag: 3, grav: 1.5, smoke: false }); }
// 펑 터지는 분홍빛 핏불꽃
function dollBlast(G, p, s = 1) {
  sfx('boom'); G.shake(0.14 * s); bloodBurst(G, p, 1.4 * s); flame(G, p, Math.round(18 * s), 1.2 * s); fluff(G, p, Math.round(16 * s), 5 * s);
  G.fx.ring(p, { r0: 0.2, r1: 1.8 * s, life: 0.3, color: ROSE, billboard: true }); G.fx.p(p, { size: 1.2 * s, size1: 2.2 * s, life: 0.16, color: 0xffd0dc, alpha: 0.9 });
}
// 실 한 가닥 (가는 원기둥을 a → b 사이에 놓음)
const SEG = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); SEG.translate(0, 0.5, 0);
const _sv = new V3();
function setSeg(mesh, a, b, r) { _sv.subVectors(b, a); const L = _sv.length() || 1e-4; mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(UP, _sv.divideScalar(L)); mesh.scale.set(r, L, r); }
const strMat = () => new THREE.MeshBasicMaterial({ color: 0xe8183c, transparent: true, opacity: 0.95, depthWrite: false });

/* =====================================================================
   혈사(血絲): 핏빛 실 — 맞으면 묶여서(둔화) 피를 흘리고, 잠시 뒤 실이 뜯겨 나간다
   ===================================================================== */
class BloodString {
  // 십자 끝에서 실이 뻗어 나간다. 맞으면 BloodBind 로 이어짐
  constructor(G, f, dir, o = {}) {
    this.G = G; this.f = f; this.dir = dir.clone(); this.from = f.model.tipPos(new V3()); this.pos = this.from.clone(); this.t = 0; this.done = false; this.o = o; this.len = 0;
    this.mat = strMat(); this.mesh = new THREE.Mesh(SEG, this.mat); this.mesh.frustumCulled = false; G.scene.add(this.mesh);
    this.head = new THREE.Mesh(SEG, this.mat); this.head.frustumCulled = false;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    if (!alive(f)) return this.kill();
    this.from = f.model.tipPos(this.from); this.len += 24 * dt; this.pos.copy(this.from).addScaledVector(this.dir, this.len);
    // 살짝 유도
    const o = f.opp; if (this.o.home && alive(o)) { const want = aimPt(o).sub(this.from).normalize(); this.dir.lerp(want, 1 - Math.exp(-dt * 3)).normalize(); }
    setSeg(this.mesh, this.from, this.pos, 0.012);
    G.fx.p(this.pos, { size: 0.22, size1: 0.04, life: 0.15, color: ROSE, alpha: 0.8, drag: 0 });
    if (Math.random() < 0.5) G.fx.p(this.pos, { vel: [0, -1, 0], size: 0.05, size1: 0.02, life: 0.4, color: BLOOD, alpha: 0.9, grav: 8 });
    for (const t of f.foes()) {
      if (!t.hurtHitSeg(this.from.clone().lerp(this.pos, 0.6), this.pos, 0.14)) continue;
      const res = t.takeHit(f, { dmg: this.o.dmg ?? 34, kb: [0.6, 0], stun: 0.55, hs: 0.06, daze: 14, basic: false, snd: 'hit' }, this.dir.clone().setY(0).normalize());
      if (res === 'hit') { t.addStatus('slow', 2.6, 0.5, f); t.addStatus('bleed', 4, 6, f); bloodBurst(G, aimPt(t), 1, this.dir.clone().negate()); const cur = (f.binds || []).find((b) => !b.done && b.tg === t); if (!cur || (this.o.big && !cur.big)) G.spawn(new BloodBind(G, f, t, this.o)); }
      return this.kill();
    }
    const W = G.stage && G.stage.world;
    if (this.len > 10 || this.pos.y < 0.03 || (W && W.solidAt(this.pos, 0.1))) { G.fx.burst(this.pos, 6, [BLOOD, ROSE], 3); this.kill(); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mat.dispose(); }
}
// 묶인 실: 십자 → 상대를 잇고 있다가 뜯긴다. 혈사가 가득 찼으면 상대를 매달아 올렸다가 찢는다
class BloodBind {
  constructor(G, f, t, o = {}) {
    this.G = G; this.f = f; this.tg = t; this.t = 0; this.done = false; this.o = o; this.big = !!o.big; this.dur = this.big ? 1.5 : 1.1; this.y0 = t.pos.y;
    if (f.binds) for (const b of f.binds) if (b.tg === t && !b.done) b.kill(); // 이미 묶인 실은 새 실로 바뀐다 f.binds = (f.binds || []).filter((b) => !b.done); f.binds.push(this);
    this.mats = []; this.lines = [];
    for (let i = 0; i < (this.big ? 5 : 3); i++) { const mt = strMat(); this.mats.push(mt); const me = new THREE.Mesh(SEG, mt); me.frustumCulled = false; G.scene.add(me); this.lines.push(me); }
    if (this.big && !t.held && t.state !== 'ko') { t.lock(); t.vel.set(0, 0, 0); this.locked = true; }
  }
  update(dt) {
    const G = this.G, f = this.f, t = this.tg; this.t += dt;
    if (!alive(t) || !alive(f)) return this.kill();
    const tip = f.model.tipPos(new V3()), J = t.model.J;
    const pts = [J.handL, J.handR, J.head, J.footL, J.footR].map((j) => j.getWorldPosition(new V3()));
    this.lines.forEach((me, i) => { setSeg(me, tip, pts[i % pts.length], 0.008 + 0.004 * Math.sin(this.t * 30 + i)); this.mats[i].opacity = 0.9 * Math.min(1, (this.dur - this.t) / 0.15 + 0.2); });
    if (this.locked) { // 꼭두각시처럼 매달아 올림
      t.held = true; t.vel.set(0, 0, 0); const h = this.y0 + 1.1 * Math.min(1, this.t / 0.5) * t.scale; t.pos.y += (h - t.pos.y) * Math.min(1, dt * 8); t.onGround = false; t.yaw += Math.sin(this.t * 6) * dt;
      if (Math.random() < 0.6) G.fx.p(aimPt(t).add(new V3(rand(-0.3, 0.3), rand(-0.6, 0.3), rand(-0.3, 0.3))), { vel: [0, -2, 0], size: 0.06, size1: 0.02, life: 0.5, color: BLOOD, alpha: 0.9, grav: 10 });
    }
    if (this.t >= this.dur) this.tear();
  }
  tear() {
    if (this.done) return; const G = this.G, f = this.f, t = this.tg; const locked = this.locked; this.kill();
    if (!alive(t)) return;
    sfx('swing'); sfx(this.big ? 'big' : 'hit'); const p = aimPt(t); bloodBurst(G, p, this.big ? 2.2 : 1.2);
    for (let i = 0; i < 5; i++) { const a = rand(0, TAU), d = new V3(Math.cos(a), rand(-0.5, 0.8), Math.sin(a)).normalize(); G.fx.slash(p, { fwd: d, normal: new V3().crossVectors(d, UP).normalize(), r: 0.8, color: i % 2 ? ROSE : BLOOD, life: 0.22 }); }
    const dir = new V3().subVectors(t.pos, f.pos).setY(0).normalize();
    t.takeHit(f, this.big ? { dmg: 78, kb: [3, 6], stun: 0.7, hs: 0.14, shake: 0.3, force: locked, noScale: true, daze: 40, basic: false, snd: 'big' } : { dmg: 18, kb: [-2.5, 0], stun: 0.45, hs: 0.06, daze: 10, basic: false, noScale: true }, dir);
    if (this.big) G.slow(0.4, 0.25);
  }
  kill() { if (this.done) return; this.done = true; for (const me of this.lines) this.G.scene.remove(me); for (const m of this.mats) m.dispose(); if (this.locked && this.tg && !this.tg.gone) { this.tg.release(); } }
}

/* ---------- 인형 투척 (기본 공격 4타): 포물선으로 날아가 핏불꽃으로 터진다 ---------- */
class ThrownDoll {
  constructor(G, f, from, target) {
    this.G = G; this.f = f; this.pos = from.clone(); this.t = 0; this.done = false;
    const to = target.clone(), d = new V3().subVectors(to, from), hd = Math.hypot(d.x, d.z), T = Math.max(0.35, Math.min(0.8, hd / 14));
    this.vel = new V3(d.x / T, (d.y + 0.5 * 14 * T * T) / T, d.z / T); this.grav = 14;
    this.g = buildDoll(); this.g.scale.setScalar(1.3); G.scene.add(this.g); this.g.position.copy(this.pos); this.spin = rand(8, 12);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.vel.y -= this.grav * dt; this.pos.addScaledVector(this.vel, dt);
    this.g.position.copy(this.pos); this.g.rotation.x += this.spin * dt; this.g.rotation.y += dt * 3;
    if (Math.random() < 0.6) G.fx.p(this.pos, { size: 0.16, size1: 0.03, life: 0.3, color: ROSE, alpha: 0.7, drag: 1, grav: -1 });
    for (const t of f.foes()) if (t.hurtHit(this.pos, 0.28)) { t.takeHit(f, { dmg: 26, kb: [0.3, 0], stun: 0.25, hs: 0.05, basic: true }, this.vel.clone().setY(0).normalize()); return this.blast(t); }
    const W = G.stage && G.stage.world, gy = W ? W.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3) : 0;
    if (this.t > 2 || this.pos.y < gy + 0.1 || (W && W.solidAt(this.pos, 0.15))) this.blast(null);
  }
  blast(skip) {
    if (this.done) return; const G = this.G, f = this.f; dollBlast(G, this.pos, 0.9);
    for (const t of f.foes()) if (t !== skip && t.hurtHit(this.pos, 1.5)) t.takeHit(f, { dmg: 14, kb: [0.3, 0], stun: 0.2, basic: true, noScale: true }, new V3().subVectors(t.pos, this.pos).setY(0).normalize());
    this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); }
}

/* ---------- 인형 소환: 꿰맨 양 인형들이 아장아장 달려가 껴안고 터진다 ---------- */
class DollMinion {
  constructor(G, f, pos, side) {
    this.G = G; this.f = f; this.pos = pos.clone(); this.t = 0; this.done = false; this.side = side; this.life = 3.6; this.yaw = f.yaw;
    this.g = buildDoll(); this.S = 2.0 * f.scale; this.g.scale.setScalar(0.01); G.scene.add(this.g); this.g.position.copy(this.pos);
    this.eyes = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3050 })); this.eyes.position.set(-0.03, 0.065, 0.16); this.g.add(this.eyes);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    if (!alive(f)) return this.kill();
    const k = Math.min(1, this.t / 0.3); this.g.scale.setScalar(this.S * (0.2 + 0.8 * k));
    if (this.t < 0.35) { this.pos.y = f.pos.y + (1 - k) * -0.2; this.g.position.copy(this.pos).setY(this.pos.y + 0.1 * this.S); return; }
    const o = f.opp, W = G.stage && G.stage.world;
    let tgt = null; for (const t of f.foes()) if (alive(t) && (!tgt || t.pos.distanceTo(this.pos) < tgt.pos.distanceTo(this.pos))) tgt = t;
    if (tgt) { const d = new V3().subVectors(tgt.pos, this.pos).setY(0), L = d.length(); const want = Math.atan2(d.x, d.z) + (L > 2 ? this.side * 0.35 : 0); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 6);
      if (L < 0.6 + 0.35 * tgt.scale && Math.abs(tgt.pos.y - this.pos.y) < 1.6) return this.blast(); }
    const sp = 7.5 * Math.min(1, (this.t - 0.35) / 0.3); this.pos.x += Math.sin(this.yaw) * sp * dt; this.pos.z += Math.cos(this.yaw) * sp * dt;
    if (W) { this.pos.y = W.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5); if (W.solidAt(this.pos.clone().setY(this.pos.y + 0.3), 0.2)) return this.blast(); }
    const hop = Math.abs(Math.sin(this.t * 16)) * 0.12; this.g.position.set(this.pos.x, this.pos.y + 0.1 * this.S + hop, this.pos.z); this.g.rotation.set(0.15, this.yaw, Math.sin(this.t * 16) * 0.18);
    if (Math.random() < 0.4) G.fx.p(this.pos.clone().setY(this.pos.y + 0.05), { vel: [0, 0.5, 0], size: 0.25, size1: 0.5, life: 0.4, color: 0x6a5a60, alpha: 0.3, smoke: true });
    if (Math.random() < 0.5) flame(G, this.g.position.clone().add(new V3(0, 0.15 * this.S, 0)), 1, 0.6);
    if (this.t > this.life) this.blast();
  }
  blast() {
    if (this.done) return; const G = this.G, f = this.f, c = this.g.position.clone(); dollBlast(G, c, 1.4); G.fx.ring(c.clone().setY(this.pos.y + 0.05), { normal: UP, r0: 0.2, r1: 2.2, life: 0.4, color: ROSE });
    areaHit(f, c.clone().setY(this.pos.y), 1.7, { dmg: 52, kb: [4.5, 5], stun: 0.6, hs: 0.1, shake: 0.2, daze: 26, basic: false, snd: 'big' }, 1.6);
    for (const t of f.foes()) if (Math.hypot(t.pos.x - c.x, t.pos.z - c.z) < 1.7 + 0.4 * t.scale) t.addStatus('burn', 3, 8, f);
    this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.eyes.geometry.dispose(); this.eyes.material.dispose(); }
}

/* ---------- 오각 촛불 진: 땅에 그린 오망성 + 다섯 촛불. 안에 있으면 둔화 · 화상, 끝에 분홍 불기둥 ---------- */
let _pentaTex = null;
function pentaTex() {
  if (_pentaTex) return _pentaTex;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2);
  const R = S * 0.46; g.strokeStyle = 'rgba(255,60,100,1)'; g.lineCap = 'round';
  g.lineWidth = 9; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(0, 0, R * 0.86, 0, TAU); g.stroke();
  g.lineWidth = 8; g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 2 % 5) * TAU / 5, x = Math.cos(a) * R * 0.86, y = Math.sin(a) * R * 0.86; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.fillStyle = 'rgba(255,120,150,1)'; g.font = 'bold 26px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const runes = '✝ᚱᛟᛗᚹᛖᚾ✝ᛞᛟᛚᛚᛊ'; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.save(); g.rotate(a); g.fillText(runes[i % runes.length], 0, -R * 0.93); g.restore(); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, 'rgba(160,10,40,0.45)'); gr.addColorStop(0.8, 'rgba(120,10,40,0.15)'); gr.addColorStop(1, 'rgba(120,10,40,0)'); g.globalCompositeOperation = 'destination-over'; g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S);
  _pentaTex = new THREE.CanvasTexture(c); _pentaTex.colorSpace = THREE.SRGBColorSpace; return _pentaTex;
}
let _candle = null;
function candleGeo() {
  if (_candle) return _candle;
  const wax = new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.072, 0.02], [0.068, 0.2], [0.075, 0.22], [0.066, 0.3], [0.05, 0.31], [0.006, 0.3], [0, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  const fl = new THREE.SphereGeometry(0.05, 10, 8); fl.scale(0.6, 1.6, 0.6); fl.translate(0, 0.37, 0);
  _candle = { wax, fl, waxM: new THREE.MeshStandardMaterial({ color: 0xf2e4d0, roughness: 0.7, emissive: 0x5a2a20, emissiveIntensity: 0.4 }) }; return _candle;
}
class Pentagram {
  constructor(G, f, c) {
    this.G = G; this.f = f; this.c = c.clone(); this.t = 0; this.life = 4.4; this.done = false; this.tick = 0.4; this.R = 2.5;
    this.mat = new THREE.MeshBasicMaterial({ map: pentaTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.R * 1.08, 48), this.mat); this.disc.rotation.x = -Math.PI / 2; this.disc.position.copy(this.c).setY(this.c.y + 0.04); G.scene.add(this.disc);
    const CG = candleGeo(); this.flM = new THREE.MeshBasicMaterial({ color: 0xff6a9a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.candles = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, g = new THREE.Group(), w = new THREE.Mesh(CG.wax, CG.waxM), fl = new THREE.Mesh(CG.fl, this.flM); w.castShadow = true; g.add(w); g.add(fl); g.userData.fl = fl;
      g.position.set(this.c.x + Math.cos(a) * this.R * 0.86, this.c.y - 0.4, this.c.z + Math.sin(a) * this.R * 0.86); g.scale.setScalar(1.2 + 0.4 * (i % 2)); G.scene.add(g); this.candles.push(g); }
    sfx('charge'); G.fx.ring(this.c.clone().setY(this.c.y + 0.05), { normal: UP, r0: 0.3, r1: this.R * 1.2, life: 0.5, color: ROSE });
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt;
    const k = Math.min(1, this.t / 0.35) * Math.min(1, (this.life - this.t) / 0.3 + 0.15);
    this.mat.opacity = (0.75 + 0.2 * Math.sin(this.t * 9)) * k; this.disc.rotation.z += dt * 0.6;
    this.candles.forEach((g, i) => { g.position.y += (this.c.y - g.position.y) * Math.min(1, dt * 10); const fl = g.userData.fl; fl.scale.set(1 + 0.15 * Math.sin(this.t * 23 + i), 1 + 0.25 * Math.sin(this.t * 17 + i * 2), 1); if (Math.random() < 0.35) flame(G, g.position.clone().add(new V3(0, 0.45 * g.scale.y, 0)), 1, 0.4); });
    if (Math.random() < 0.6) { const a = rand(0, TAU), r = rand(0.2, 1) * this.R; G.fx.p(this.c.clone().add(new V3(Math.cos(a) * r, 0.05, Math.sin(a) * r)), { vel: [0, rand(0.8, 2), 0], size: rand(0.08, 0.16), size1: 0.02, life: 0.8, color: FLAMES[(Math.random() * 4) | 0], alpha: 0.85, drag: 0.6, grav: -0.5, flick: 0.5 }); }
    // 안에 선 상대: 둔화 · 0.45초마다 작은 피해 + 화상
    for (const t of f.foes()) { const d = Math.hypot(t.pos.x - this.c.x, t.pos.z - this.c.z); if (d < this.R + 0.3 * t.scale && t.pos.y - this.c.y < 1.5) t.addStatus('slow', 0.3, 0.55, f); }
    if (this.tick <= 0 && this.t > 0.4 && this.t < this.life - 0.3) { this.tick = 0.45;
      for (const t of f.foes()) if (Math.hypot(t.pos.x - this.c.x, t.pos.z - this.c.z) < this.R + 0.3 * t.scale && t.pos.y - this.c.y < 1.5) { t.takeHit(f, { dmg: 5, kb: [0, 0], stun: 0.3, hs: 0.02, daze: 5, basic: false, noCrit: true, noScale: true }, new V3().subVectors(this.c, t.pos).setY(0).normalize()); t.addStatus('burn', 1.5, 6, f); flame(G, aimPt(t), 4, 0.7); } }
    if (this.t >= this.life - 0.3 && !this.erupt) { this.erupt = true; sfx('boom'); sfx('big'); G.shake(0.3);
      G.fx.beam(this.c, { r: 1.6, h: 9, color: ROSE, life: 0.55 }); G.fx.light(this.c.clone().setY(1.5), ROSE, 140, 0.5, 16);
      for (let i = 0; i < 40; i++) { const a = rand(0, TAU), r = rand(0, this.R); flame(G, this.c.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), 1, 1.6); }
      areaHit(f, this.c, this.R, { dmg: 48, kb: [1.2, 9.5], stun: 0.7, hs: 0.12, shake: 0.2, daze: 28, basic: false, snd: 'big' }, 1.6); }
    if (this.t >= this.life) this.kill();
  }
  kill() { if (this.done) return; this.done = true; const G = this.G; G.scene.remove(this.disc); this.disc.geometry.dispose(); this.mat.dispose(); for (const g of this.candles) G.scene.remove(g); this.flM.dispose(); }
}

/* ---------- 궁극기: 거대한 꿰맨 인형 — 매달린 상대를 끌어안고 찢어버린다 ---------- */
class GiantDoll {
  constructor(G, f, tgt) {
    this.G = G; this.f = f; this.tg = tgt; this.t = 0; this.done = false;
    const fw = new V3().subVectors(tgt.pos, f.pos).setY(0).normalize(); this.fw = fw; this.base = tgt.pos.clone().setY(0).addScaledVector(fw, 1.4);
    this.g = buildDoll(); this.S = 11; this.g.scale.setScalar(this.S); this.g.traverse((o) => { o.frustumCulled = false; }); G.scene.add(this.g);
    this.g.position.copy(this.base).setY(-3.5); this.g.lookAt(this.g.position.clone().sub(fw)); this.mats = [];
    // 붉게 빛나는 눈
    for (const x of [0.03, -0.03]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a4a })); e.position.set(x, 0.07, 0.17); this.g.add(e); this.mats.push(e); }
  }
  update(dt) {
    const G = this.G; this.t += dt; const fw = this.fw;
    // 0 ~ 0.6 땅에서 솟음 → 0.9 ~ 1.3 앞으로 덮쳐 끌어안음 → 1.6 ~ 꽉 조임 (떨림)
    const up = Math.min(1, this.t / 0.6), e = 1 - (1 - up) ** 3, lean = Math.min(1, Math.max(0, (this.t - 0.9) / 0.35));
    const p = this.base.clone().addScaledVector(fw, -1.1 * lean); p.y = -3.5 + 4.9 * e - 0.5 * lean; this.g.position.copy(p);
    this.g.lookAt(p.clone().sub(fw)); this.g.rotateX(-1.25 + 1.5 * lean); // 뒷다리로 일어섰다가 앞으로 덮친다
    const sq = this.t > 1.3 ? 1 + 0.05 * Math.sin(this.t * 40) : 1; this.g.scale.set(this.S * sq, this.S / sq, this.S * sq);
    if (this.t < 0.7) for (let i = 0; i < 4; i++) { const a = rand(0, TAU), r = rand(0.5, 2); flame(G, this.base.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), 1, 1.4); }
    if (Math.random() < 0.4) fluff(G, p.clone().add(new V3(rand(-1, 1), 1 + rand(0, 1.5), rand(-1, 1))), 1, 1);
  }
  burst() {
    const G = this.G, c = this.g.position.clone().add(new V3(0, 1.1, 0)); dollBlast(G, c, 3); fluff(G, c, 60, 9);
    for (let i = 0; i < 30; i++) G.fx.p(c.clone().add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1))), { vel: [rand(-6, 6), rand(2, 9), rand(-6, 6)], size: rand(0.2, 0.4), size1: 0.05, life: rand(0.6, 1.1), color: i % 2 ? BLOOD : ROSE, alpha: 0.9, drag: 1, grav: 12 });
    this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); for (const e of this.mats) { e.geometry.dispose(); e.material.dispose(); } }
}

/* =====================================================================
   기술 — 중거리 인형사: 실 채찍으로 견제하고, 핏빛 실로 묶어 피를 흘리게 하고, 인형과 촛불 진으로 몰아붙인다
   ===================================================================== */
const lashEnd = (f) => lash(f, false);
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 십자를 아래로 겨누고 내리꽂아 오망성 핏불꽃 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.3, 0, 0], head: [0.2, 0, 0], shoulderR: [-1.5, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.4, 0, 0], hipL: [-1.0, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: ROSE, dmg: 66, r: 2.4, fallDmg: 30,
    fx: (f, o, G, c) => { G.fx.ring(c.clone().setY(c.y + 0.04), { normal: UP, r0: 0.4, r1: 2.6, life: 0.6, color: BLOOD }); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; flame(G, c.clone().add(new V3(Math.cos(a) * 1.8, 0.1, Math.sin(a) * 1.8)), 8, 1.2); } bloodBurst(G, c.clone().setY(c.y + 0.3), 1.5); },
  }),

  /* --- 기본 공격: 실 채찍 (가로) → 되돌려 치기 → 실 올가미 (내려치고 끌어당김) → 인형 투척 --- */
  light1: { dur: 0.42, cancel: 0.2, next: 'light2', trail: true, track: 0.08, ikOff: true, move: 0.35,
    keys: [[0, 'windR'], [0.08, 'windR'], [0.17, 'lashL'], [0.28, {}], [0.42, 'base']],
    start: (f) => lash(f, true), ev: [[0.08, () => sfx('swing')], [0.3, lashEnd]], end: lashEnd,
    hits: [{ t0: 0.09, t1: 0.2, dmg: 24, kb: [0.2, 0], stun: 0.2, hs: 0.04, br: 0.12 }] },
  light2: { dur: 0.44, cancel: 0.22, next: 'light3', trail: true, track: 0.1, ikOff: true, move: 0.35,
    keys: [[0, 'windL'], [0.08, 'windL'], [0.18, 'lashR'], [0.3, {}], [0.44, 'base']],
    start: (f) => lash(f, true), ev: [[0.09, () => sfx('swing')], [0.32, lashEnd]], end: lashEnd,
    hits: [{ t0: 0.1, t1: 0.21, dmg: 26, kb: [0.2, 0], stun: 0.2, hs: 0.04, br: 0.12 }] },
  light3: { dur: 0.6, cancel: 0.4, next: 'light4', trail: true, track: 0.14, ikOff: true, move: 0.2,
    keys: [[0, 'raise'], [0.12, 'raise'], [0.22, 'slam'], [0.36, 'slam'], [0.46, { ...poses.aimPrep, weapon: [0.7, 0.3, 0] }], [0.6, 'base']],
    start: (f) => { lash(f, true); f.snare = null; },
    ev: [[0.12, () => sfx('swing')],
      // 올가미: 실 끝에 걸린 상대를 끌어당긴다
      [0.36, (f, o, G) => { const t = f.snare; if (!alive(t) || t.held) return; sfx('swing'); const d = new V3().subVectors(f.pos, t.pos).setY(0), L = d.length(); if (L > 1.4) t.pos.addScaledVector(d.normalize(), Math.min(1.2, L - 1.3));
        t.takeHit(f, { dmg: 14, kb: [0, 0], stun: 0.2, hs: 0.05, basic: true, noScale: true }, d.clone().negate().normalize()); bloodBurst(G, aimPt(t), 0.6); }],
      [0.5, lashEnd]],
    end: (f) => { lashEnd(f); f.snare = null; },
    hits: [{ t0: 0.13, t1: 0.26, dmg: 18, kb: [0, 0], stun: 0.2, hs: 0.05, br: 0.14 }],
    tick: (f, o, G, t) => { if (!f.snare && f.hitConfirm && t > 0.13 && t < 0.3) for (const x of f.foes()) if (f.hitDone.has(x.id)) f.snare = x; } },
  light4: { dur: 0.66, move: 0.25, ikOff: true, track: 0.3,
    keys: [[0, 'tossBack'], [0.2, 'tossBack'], [0.3, 'toss'], [0.48, {}], [0.66, 'base']],
    ev: [[0.02, () => sfx('charge')], [0.3, (f, o, G) => { sfx('swing'); f.model.setDoll(false); const from = f.model.J.handL.getWorldPosition(new V3());
      const to = alive(o) && f.dist() < 11 ? aimPt(o) : f.local([0, 0.6, 7]); G.spawn(new ThrownDoll(G, f, from, to)); }], [0.6, (f) => f.model.setDoll(true)]],
    end: (f) => f.model.setDoll(true) },

  /* --- 우클: 혈사 — 핏빛 실 세 가닥을 쏜다. 맞으면 묶여 둔화 · 출혈, 1초 뒤 실이 뜯기며 추가 피해. 혈사가 가득 차면 꼭두각시처럼 매달아 찢는다 --- */
  heavy: { dur: 0.72, cd: 'heavy', ikOff: true, track: 0.3, shout: true, move: 0.2,
    keys: [[0, 'aimPrep'], [0.2, 'aimPrep'], [0.28, 'aimX'], [0.5, {}], [0.72, 'base']],
    start: (f, o, G) => { f.bigBind = hyeol(f) >= HYEOL_MAX; if (f.bigBind) { f.hyeol = 0; G.say(f, '"…이제, 내 인형이 되렴."'); } sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.26) { const p = f.model.tipPos(new V3()); for (let i = 0; i < 2; i++) { const q = p.clone().add(new V3(rand(-0.5, 0.5), rand(-0.4, 0.4), rand(-0.5, 0.5))), v = p.clone().sub(q).multiplyScalar(5); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.08, size1: 0.02, life: 0.2, color: i ? ROSE : BLOOD, alpha: 0.9 }); } } },
    ev: [[0.28, (f, o, G) => { sfx('shot'); sfx('swing'); const from = f.model.tipPos(new V3()), base = alive(o) && f.dist() < RANGE ? aimPt(o).sub(from).normalize() : f.fwd(new V3()).add(new V3(0, -0.05, 0)).normalize();
      for (const s of [-0.12, 0, 0.12]) G.spawn(new BloodString(G, f, base.clone().applyAxisAngle(UP, s), { big: f.bigBind && s === 0, dmg: s === 0 ? 30 : 10, home: s === 0 }));
      G.fx.ring(from, { r0: 0.05, r1: 0.7, life: 0.2, color: ROSE, billboard: true }); }]],
    end: (f) => { f.bigBind = false; } },

  /* --- Shift: 인형 소환 — 오망성에서 꿰맨 양 인형 둘이 기어 나와 상대에게 달려가 터진다 --- */
  s1: { dur: 0.8, cd: 's1', ikOff: true, track: 0.25, shout: true, noMove: true,
    keys: [[0, { ...poses.conduct, shoulderL: [-1.0, 0, 0.3], elbowL: [-1.2, 0, 0] }], [0.2, 'summon'], [0.6, 'summon'], [0.8, 'base']],
    start: (f, o, G) => { G.say(f, '"가서 안아 주렴. 꼭."'); sfx('charge'); },
    ev: [[0.22, (f, o, G) => { const c = f.local([0, 0.04, 1.1]); G.fx.ring(c, { normal: UP, r0: 0.2, r1: 1.4, life: 0.5, color: ROSE }); G.fx.ring(c, { normal: UP, r0: 0.1, r1: 0.9, life: 0.4, color: BLOOD }); flame(G, c, 12, 0.8); sfx('zap');
      for (const s of [-1, 1]) G.spawn(new DollMinion(G, f, f.local([s * 0.45, 0, 1.0]).setY(f.pos.y), s)); }]] },

  /* --- E: 오각 촛불 진 — 상대 발밑에 오망성과 다섯 촛불: 안에서는 둔화 · 지속 화상, 끝에 분홍 불기둥 --- */
  s2: { dur: 0.86, cd: 's2', ikOff: true, track: 0.3, shout: true, move: 0.15,
    keys: [[0, 'raise'], [0.3, { ...poses.raise, weapon: [1.5, 0, 0.6] }], [0.4, 'slam'], [0.66, {}], [0.86, 'base']],
    start: (f, o, G) => { G.say(f, '"…촛불을 켜자. 하나, 둘, 다섯."'); },
    ev: [[0.4, (f, o, G) => { sfx('heavy'); const tip = f.model.tipPos(new V3()).setY(f.pos.y + 0.05); G.fx.ring(tip, { normal: UP, r0: 0.1, r1: 0.9, life: 0.3, color: ROSE });
      const c = alive(o) && f.dist() < 12 ? o.pos.clone().setY(o.onGround ? o.pos.y : f.pos.y) : f.local([0, 0, 5]); c.y = Math.max(0, Math.min(c.y, f.pos.y + 0.5)); G.spawn(new Pentagram(G, f, c)); }]] },

  /* --- 극한 회피 뒤 좌클: 대역 인형 — 제자리에 인형을 남기고 뒤로 물러서면, 인형이 핏불꽃으로 터진다 --- */
  counter: { dur: 0.62, ikOff: true,
    keys: [[0, 'hop'], [0.2, 'hop'], [0.42, {}], [0.62, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.pos.clone(); G.flash(ROSE, 0.2); fluff(G, f.chest(new V3()), 20, 3);
      const away = o ? new V3().subVectors(f.pos, o.pos).setY(0).normalize() : f.fwd(new V3()).negate(); f.pos.addScaledVector(away, 3.2); f.faceOpp(); f.vel.set(0, 0, 0); f.model.resetCloth(); sfx('dash');
      const dummy = { G, t: 0, done: false, g: buildDoll(), update(dt) { this.t += dt; this.g.scale.setScalar(2.4 * (1 + 0.15 * Math.sin(this.t * 40) * Math.min(1, this.t / 0.2))); if (Math.random() < 0.6) flame(G, this.g.position, 1, 0.6);
        if (this.t >= 0.24) { const c = this.g.position.clone(); dollBlast(G, c, 1.5); areaHit(f, from, 2.0, { dmg: 72, kb: [6, 4.5], stun: 0.6, hs: 0.12, daze: 30, basic: false, snd: 'big' }, 1.6); this.kill(); } },
        kill() { if (this.done) return; this.done = true; G.scene.remove(this.g); } };
      dummy.g.position.copy(from).setY(from.y + 0.25); dummy.g.rotation.y = f.yaw + Math.PI; G.scene.add(dummy.g); G.spawn(dummy);
    }], [0.24, (f, o, G) => { lash(f, true); }], [0.5, lashEnd]],
    end: lashEnd },

  /* --- Q: 인형극 · 마지막 막 — 핏빛 실로 상대를 꼭두각시처럼 매달고, 거대한 꿰맨 인형이 솟아 끌어안아 찢는다 --- */
  ult: { dur: 3.3, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, 'aimPrep'], [0.25, 'aimX'], [0.6, 'conduct'], [1.0, { ...poses.conduct, shoulderR: [-2.6, 0, -0.5], shoulderL: [-2.5, 0, 0.5] }], [1.4, 'conduct'],
      [2.3, { ...poses.conduct, spine: [-0.2, 0, 0] }], [2.45, { ...poses.slam, shoulderL: [-0.3, 0, 0.9], elbowL: [-0.3, 0, 0] }], [2.9, {}], [3.3, 'win']],
    cam: [[0, { ref: 'self', p: [0.8, 0.7, 2.0], l: [0, 1.1, 0], fov: 38 }], [0.5, { ref: 'self', p: [-1.2, 1.4, -2.0], l: [0, 1.4, 4], fov: 52 }],
      [1.0, { ref: 'target', p: [4.2, 1.2, -1.5], l: [0, 2.0, 0], fov: 58 }], [1.9, { ref: 'target', p: [3.0, 2.6, -4.2], l: [0, 2.4, 0], fov: 60 }],
      [2.5, { ref: 'target', p: [-2.6, 1.6, -5.0], l: [0, 1.8, 0], fov: 58 }], [3.3, { ref: 'target', p: [-3.2, 2.2, -7.5], l: [0, 1.4, 0], fov: 55 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; f.ultDoll = null; f.ultLines = null; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(DARKR, 0.35); sfx('charge'); G.say(f, '"막을 올리렴. …마지막 막이야."'); flame(G, f.pos.clone().setY(0.1), 14, 1.2);
        G.fx.ring(f.pos.clone().setY(f.pos.y + 0.05), { normal: UP, r0: 0.4, r1: 3, life: 1.0, color: ROSE }); }],
      [0.25, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('shot'); sfx('swing'); lash(f, false);
        const mats = [], lines = []; for (let i = 0; i < 5; i++) { const mt = strMat(); const me = new THREE.Mesh(SEG, mt); me.frustumCulled = false; G.scene.add(me); mats.push(mt); lines.push(me); } f.ultLines = { mats, lines };
        o.takeHit(f, { dmg: 30, kb: [0, 0], stun: 99, hs: 0.08, nokill: true, noScale: true, force: true, daze: 20, basic: false }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); bloodBurst(G, aimPt(o), 1.2); o.addStatus('bleed', 4, 8, f); }],
      [0.95, (f, o, G) => { o = f.ultTgt || o; if (!o) return; G.say(f, '"모두가 너를 기억할 거야."'); sfx('boom'); G.shake(0.25); f.ultDoll = new GiantDoll(G, f, o); G.spawn(f.ultDoll); G.fx.beam(f.ultDoll.base, { r: 2, h: 6, color: ROSE, life: 0.5 }); }],
      ...[1.45, 1.75, 2.05].map((t, i) => [t, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('heavy'); G.shake(0.2 + i * 0.05); bloodBurst(G, aimPt(o), 1.4); fluff(G, aimPt(o), 10, 3);
        o.takeHit(f, { dmg: 22, kb: [0, 0], stun: 99, hs: 0.06, nokill: true, noScale: true, force: true, noCrit: true, daze: 15, basic: false, snd: 'hit' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); }]),
      [2.45, (f, o, G) => { o = f.ultTgt || o; if (!o) return; o.release(); sfx('boom'); sfx('big'); G.say(f, '"…찢어져라."'); G.flash(0xffd0dc, 0.5); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.4);
        if (f.ultDoll) { f.ultDoll.burst(); f.ultDoll = null; } const c = aimPt(o); bloodBurst(G, c, 3); G.fx.light(c, ROSE, 180, 0.8, 20); G.fx.ring(o.pos.clone().setY(0.05), { normal: UP, r0: 0.5, r1: 7, life: 0.6, color: ROSE });
        o.takeHit(f, { dmg: 165, kb: [5, 11], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, basic: false, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) t.takeHit(f, { dmg: 110, kb: [6, 9], stun: 0.8, force: true, noCrit: true, basic: false }, new V3().subVectors(t.pos, o.pos).setY(0).normalize());
        G.slow(0.35, 0.5); ultLinesKill(f, G); }],
    ],
    tick: (f, o, G, t, dt) => {
      const tg = f.ultTgt;
      if (t < 0.25) { const p = f.model.tipPos(new V3()); for (let i = 0; i < 2; i++) { const q = p.clone().add(new V3(rand(-0.8, 0.8), rand(-0.6, 0.6), rand(-0.8, 0.8))), v = p.clone().sub(q).multiplyScalar(4); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.1, size1: 0.03, life: 0.24, color: i ? ROSE : BLOOD, alpha: 0.9 }); } }
      // 실로 매달린 꼭두각시: 들어 올려 흔든다
      if (tg && f.ultLines) { const tip = f.model.tipPos(new V3()), J = tg.model.J; [J.handL, J.handR, J.head, J.footL, J.footR].forEach((j, i) => setSeg(f.ultLines.lines[i], tip, j.getWorldPosition(new V3()), 0.01 + 0.004 * Math.sin(t * 30 + i)));
        if (tg.held) { const h = 1.3 * Math.min(1, (t - 0.25) / 0.5) * tg.scale + 0.15 * Math.sin(t * 5); tg.pos.y += (h - tg.pos.y) * Math.min(1, dt * 6); tg.yaw += Math.sin(t * 4) * dt * 1.5; } }
    },
    end: (f, o, G) => { G.setTint(0, 0); lashEnd(f); ultLinesKill(f, G); if (f.ultDoll) { f.ultDoll.kill(); f.ultDoll = null; } const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};
function ultLinesKill(f, G) { if (!f.ultLines) return; for (const me of f.ultLines.lines) G.scene.remove(me); for (const m of f.ultLines.mats) m.dispose(); f.ultLines = null; }

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, ROSE, big ? 1.6 : 0.9, dir);
  G.fx.burst(p, big ? 18 : 8, [BLOOD, 0x8a0414, ROSE], 6, { grav: 14 });
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.5 : 1.0, color: big ? PINKF : ROSE, life: 0.2 });
  // 혈사: 피를 흘리는 상대를 칠수록 더 많이 쌓인다
  const t = att.opp, bleeding = t && t.st && t.st.bleed && t.st.bleed.t > 0;
  att.hyeol = Math.min(HYEOL_MAX, (att.hyeol || 0) + h.dmg * (bleeding ? 0.25 : 0.1));
}

// 혈사 게이지: 내가 건 출혈이 흐르는 동안 차오른다 · 가득 차면 십자에서 피가 뚝뚝
function createModelWithHyeol(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (f.state !== 'ko') for (const t of f.foes()) { const b = t.st && t.st.bleed; if (b && b.t > 0 && b.src === f) f.hyeol = Math.min(HYEOL_MAX, (f.hyeol || 0) + dt * 4); }
    if (hyeol(f) >= HYEOL_MAX && f.root.visible && Math.random() < 0.3) { const p = m.tipPos(new V3()); f.G.fx.p(p, { vel: [0, -1.5, 0], size: 0.07, size1: 0.03, life: 0.5, color: BLOOD, alpha: 0.95, grav: 9 }); if (Math.random() < 0.3) f.G.fx.p(p, { vel: [0, 0.6, 0], size: 0.12, size1: 0.02, life: 0.4, color: ROSE, alpha: 0.8 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

// CPU: 중거리 — 실 채찍 사거리를 지키며 묶고, 인형을 보내고, 촛불 진을 깐다
function aiPick(f, o, dist) {
  if (hyeol(f) >= HYEOL_MAX && dist < 9 && f.cd.heavy <= 0) return 'heavy';
  if (dist > 3 && dist < 11 && f.cd.heavy <= 0 && Math.random() < 0.3) return 'heavy';
  if (dist > 2.5 && dist < 10 && f.cd.s1 <= 0 && Math.random() < 0.28) return 's1';
  if (dist < 9 && f.cd.s2 <= 0 && (o.stK('slow') < 1 || Math.random() < 0.2)) return 's2';
  return null;
}

export default {
  id: 'morwen', name: '모르웬', short: '모르웬', title: '피의 인형사', scale: 0.96,
  desc: '중거리 · 실 채찍 · 속박/출혈 · 인형 소환. 죽은 자의 기억을 인형에 묶어두는 인형사. 마리오네트 조종 십자의 실을 채찍처럼 휘둘러 거리를 지키고, 핏빛 실로 묶어 피를 흘리게 하고, 꿰맨 인형과 오각 촛불 진으로 몰아붙인다. 출혈이 흐를수록 혈사가 차오르고, 가득 차면 다음 혈사가 상대를 꼭두각시처럼 매달아 찢는다.',
  stats: { hp: 880, speed: 7.6, jump: 10.5, crit: 0.2 },
  palettes: [{ accent: ROSE, cross: 0xb0122a, rose: 0xffffff, apron: 0xffffff }, { accent: 0x9a7aff, cross: 0x4a2a8a, rose: 0xff6a8a, apron: 0xd8d0ff }],
  skills: { heavy: { name: '혈사', cd: 7 }, s1: { name: '인형 소환', cd: 10 }, s2: { name: '오각 촛불 진', cd: 14 }, ult: { name: '인형극 · 마지막 막', sub: 'DOLLS REMEMBER EVERYTHING' } },
  aimRange: RANGE, aiRange: [2.2, 4.6], aiPick,
  resource: (f) => hyeol(f) >= HYEOL_MAX ? { v: 1, label: '혈사', color: 0xff8aa8, full: true } : { v: hyeol(f) / HYEOL_MAX, label: '혈사', color: 0xc0102a },
  onReset: (f) => { f.hyeol = 0; f.lashOn = false; f.snare = null; f.bigBind = false; f.binds = []; f.ultTgt = null; f.ultDoll = null; f.ultLines = null; if (f.model && f.model.setDoll) f.model.setDoll(true); },
  moveList: [['좌클 ×4', '실 채찍 24 → 되돌려 치기 26 → 실 올가미: 내려쳐 18 · 걸린 상대를 끌어당기며 14 → 인형 투척: 날아가 터지는 인형 26 + 핏불꽃 14 (중거리)'], ['공중 좌클', '십자를 아래로 내리꽂아 오망성 핏불꽃'],
    ['우클 · 혈사', '핏빛 실 세 가닥 (가운데 30 · 양옆 10): 맞으면 묶여 둔화(×0.5) · 출혈(초당 6), 1초 뒤 실이 뜯기며 18. 혈사가 가득 차면 가운데 실이 상대를 매달아 올렸다가 찢어 78'], ['Shift · 인형 소환', '꿰맨 양 인형 둘이 달려가 끌어안고 터짐: 각 52 + 화상'],
    ['E · 오각 촛불 진', '상대 발밑에 오망성과 촛불 다섯: 안에서는 둔화 · 0.45초마다 5 + 화상, 끝에 분홍 불기둥 48(띄움)'], ['Q · 인형극 · 마지막 막', '핏빛 실로 매달아(30) 거대한 꿰맨 인형이 솟아 끌어안고(22×3) 찢어버린다 165'],
    ['혈사', '내가 건 출혈이 흐르는 동안 · 피 흘리는 상대를 칠 때 쌓이고, 가득 차면 다음 혈사가 꼭두각시 처형'], ['C (타이밍) · 극한 회피', '대역 인형: 제자리에 인형을 남기고 물러서면 인형이 터짐 72'], ['가만히', '인형과 얼굴을 맞대고 속삭임']],
  createModel: createModelWithHyeol, poses, moves, hitFx,
};
