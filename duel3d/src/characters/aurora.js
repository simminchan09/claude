// 오로라 (AURORA · 빛의 잔향) — 원거리 · 활 · 번개 · 빛의 리본
// "무너진 세계의 빛을 모으는 마지막 인도자. 꺼진 하늘에 다시 빛을 돌려놓기 위해."
// 무기: 은색 기계 활 (활 · 소총 겸용) — 칼날 활대로 베고, 빛의 화살과 번개 화살을 쏘고, 하늘에서 화살비와 낙뢰를 부르며, 빛의 리본을 타고 옮겨 다닌다.
// 고유 게이지 '잔광': 맞힐수록 빛의 조각이 모인다 (3칸). 우클 뇌광 관통시가 모은 잔광을 모두 실어 쏘고, 칸마다 낙뢰가 따라 떨어진다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, ICE, BOLT, NAVY, GOLDA, CREAM } from './aurora_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const LIGHTS = [ICE, BOLT, 0xffffff];
const RANGE = 30; // 조준 거리
const GLOW_MAX = 100, CHARGE = GLOW_MAX / 3; // 잔광: 3칸

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const LEGS_AIM = { hipL: [-0.42, 0, 0.14], kneeL: [0.4, 0, 0], footL: [0.05, 0, 0], hipR: [0.3, 0, -0.16], kneeR: [0.22, 0, 0], footR: [0, 0, 0] };
const poses = {
  // 기본: 큰 활을 오른손에 세워 옆구리에 대고, 왼손은 가볍게 내림 — 고요히 선 자세
  base: { hips: [0, 0.12, 0], spine: [0.02, -0.05, 0], chest: [0, -0.06, 0], head: [0.04, 0.06, 0],
    shoulderR: [-0.15, 0, -0.3], elbowR: [-0.55, 0, 0], weapon: [-0.08, 0.22, 0.05], shoulderL: [0.05, 0, 0.12], elbowL: [-0.35, 0, 0], handL: [0, 0, -0.15],
    hipL: [-0.1, 0, 0.04], kneeL: [0.18, 0, 0], footL: [-0.06, 0, 0], hipR: [0.08, 0, -0.06], kneeR: [0.1, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.08, 0], spine: [0.3, 0.04, 0], chest: [0.06, 0.04, 0], head: [-0.18, 0, 0], shoulderR: [0.25, 0, -0.32], elbowR: [-0.7, 0, 0], weapon: [-0.15, 1.6, 0.6], shoulderL: [0.2, 0, 0.18], elbowL: [-0.9, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.22, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.22, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.35, 0, 0], kneeR: [1.3, 0, 0], footR: [0.4, 0, 0], shoulderL: [-0.6, 0, 0.8], elbowL: [-0.6, 0, 0], weapon: [0.4, 1.0, 0.5] },
  // 방어: 활을 세로로 앞에 세우고 왼손을 활대에 댐
  guard: { hips: [0, -0.15, 0], spine: [0.12, 0.08, 0], chest: [0.04, 0.08, 0], shoulderR: [-1.1, 0, -0.05], elbowR: [-1.2, 0, 0], weapon: [0.15, -1.45, 0], shoulderL: [-1.2, 0, 0.1], elbowL: [-0.9, 0, 0],
    hipL: [-0.45, 0, 0.18], kneeL: [0.8, 0, 0], hipR: [0.3, 0, -0.18], kneeR: [0.6, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.6, 1.2, 0.4], shoulderL: [0.4, 0, 0.7], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.5, 1.3, 0.6], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.72, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -0.6, 1.5],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.45, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.5, 0, -0.35], elbowR: [-0.5, 0, 0], weapon: [-0.2, 2.0, 0.8], shoulderL: [0.7, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 활을 세워 들고 하늘을 올려다봄 · 왼손은 가슴에
  win: { hips: [0, 0.1, 0], spine: [-0.05, 0, 0], chest: [-0.08, -0.05, 0], head: [-0.35, 0.1, 0], shoulderR: [-0.35, 0, -0.3], elbowR: [-1.1, 0, 0], weapon: [1.0, 0.2, 0],
    shoulderL: [-0.55, 0, -0.1], elbowL: [-1.9, 0, 0], hipL: [-0.08, 0, 0.06], kneeL: [0.12, 0, 0], hipR: [0.15, 0, -0.06], kneeR: [0.35, 0, 0], footR: [0.15, 0, 0] },
  portrait: { hips: [0, 0.25, 0], chest: [0, -0.15, 0], head: [0.04, 0.1, 0], shoulderR: [-0.6, 0, -0.35], elbowR: [-1.25, 0, 0], weapon: [1.15, 0.35, 0.1], shoulderL: [-0.4, 0, 0.2], elbowL: [-1.4, 0, 0] },
  // 겨눔: 활을 앞으로 뻗어 상대를 향함 (살짝 눕힌 활) · 왼손은 시위
  aim: { hips: [0, 0.4, 0], spine: [0.04, 0.3, 0], chest: [0.02, 0.28, 0], head: [0, -0.55, 0], shoulderR: [-1.5, 0, -0.12], elbowR: [-0.12, 0, 0], weapon: [0.02, 0.12, 0.5],
    shoulderL: [-1.35, 0, -0.62], elbowL: [-0.9, 0, 0], ...LEGS_AIM },
  aimPrep: { hips: [0, 0.3, 0], spine: [0.04, 0.22, 0], chest: [0.02, 0.2, 0], head: [0, -0.45, 0], shoulderR: [-1.15, 0, -0.3], elbowR: [-0.6, 0, 0], weapon: [0.3, 0.25, 0.5],
    shoulderL: [-0.9, 0, -0.3], elbowL: [-1.2, 0, 0], ...LEGS_AIM },
  // 끝까지 당김: 왼손을 뺨 옆까지
  draw: { hips: [0, 0.45, 0], spine: [-0.02, 0.32, 0], chest: [-0.04, 0.3, 0], head: [0.05, -0.6, 0], shoulderR: [-1.52, 0, -0.08], elbowR: [-0.05, 0, 0], weapon: [0.0, 0.05, 0.5],
    shoulderL: [-1.5, 0, -0.95], elbowL: [-2.0, 0, 0], hipL: [-0.55, 0, 0.18], kneeL: [0.55, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.3, 0, 0] },
  // 칼날 활대 베기: 오른쪽으로 감은 활 → 왼쪽으로 쓸어 벰
  windR: { hips: [0, -0.45, 0], spine: [0.1, -0.35, 0], chest: [0.02, -0.4, 0], head: [0, 0.6, 0], shoulderR: [-1.0, 0, -0.8], elbowR: [-0.8, 0, 0], weapon: [0.1, 1.9, 1.57], shoulderL: [-0.4, 0, 0.3], elbowL: [-1.2, 0, 0] },
  slashL: { hips: [0, 0.45, 0], spine: [0.2, 0.4, 0], chest: [0.05, 0.45, 0], head: [0, -0.6, 0], shoulderR: [-1.3, 0, 0.45], elbowR: [-0.15, 0, 0], weapon: [0.05, -1.5, 1.57], shoulderL: [0.3, 0, 0.6], elbowL: [-0.5, 0, 0],
    hipL: [-0.75, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.45, 0, -0.12], kneeR: [0.35, 0, 0] },
  // 하늘로 겨눔
  raise: { hips: [0, 0.2, 0], spine: [-0.2, 0.1, 0], chest: [-0.15, 0.1, 0], head: [-0.6, -0.2, 0], shoulderR: [-2.6, 0, -0.2], elbowR: [-0.15, 0, 0], weapon: [1.25, 0.1, 0.5], shoulderL: [-2.3, 0, -0.5], elbowL: [-1.1, 0, 0],
    hipL: [-0.3, 0, 0.12], kneeL: [0.3, 0, 0], hipR: [0.25, 0, -0.12], kneeR: [0.25, 0, 0] },
  slam: { hips: [0, -0.15, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.1, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-1.2, 0, 1.57], shoulderL: [-0.6, 0, 0.5], elbowL: [-0.4, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.4, 0, 0] },
  // 공중에서 아래로 겨눔 (반격)
  aimDown: { hips: [0, 0.3, 0], spine: [0.5, 0.2, 0], chest: [0.2, 0.2, 0], head: [0.4, -0.4, 0], shoulderR: [-1.0, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [-1.0, 0.1, 0.5], shoulderL: [-0.9, 0, -0.5], elbowL: [-1.0, 0, 0],
    hipL: [-1.0, 0, 0.1], kneeL: [1.4, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [1.2, 0, 0] },
  // 궁극기 마지막: 낮게 버티고 서서 끝까지 당김
  bigDraw: { hipY: -0.06, hips: [0, 0.5, 0], spine: [0.02, 0.35, 0], chest: [-0.04, 0.32, 0], head: [0.05, -0.65, 0], shoulderR: [-1.55, 0, -0.06], elbowR: [-0.04, 0, 0], weapon: [0.04, 0.05, 0.3],
    shoulderL: [-1.5, 0, -1.0], elbowL: [-2.05, 0, 0], hipL: [-0.95, 0, 0.25], kneeL: [1.05, 0, 0], footL: [-0.1, 0, 0], hipR: [0.6, 0, -0.25], kneeR: [0.75, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 활을 땅에 세워 짚고 고개를 들어 하늘을 봄
  idle2: { hips: [0, 0.2, 0.02], spine: [-0.04, -0.1, 0], chest: [-0.04, -0.08, 0], head: [-0.4, 0.2, 0.05], shoulderR: [-0.35, 0, -0.25], elbowR: [-0.4, 0, 0], weapon: [-0.05, 0.25, 1.4],
    shoulderL: [-0.15, 0, 0.25], elbowL: [-0.5, 0, 0], hipL: [-0.06, 0, 0.04], kneeL: [0.1, 0, 0], hipR: [0.2, 0, -0.08], kneeR: [0.5, 0, 0], footR: [0.25, 0, 0] },
});

/* =====================================================================
   빛 · 번개 이펙트
   ===================================================================== */
// 몸통 중심 (조준점)
const aimPt = (t, out = new V3()) => (t.hurt && t.hurt[0] ? out.copy(t.hurt[0].a).lerp(t.hurt[0].b, 0.45) : t.chest(out));
function aimDir(f, from, spread = 0, lift = 0) {
  const o = f.opp, d = o && !o.gone && o.state !== 'ko' && f.dist() < RANGE ? aimPt(o).sub(from).normalize() : f.fwd(new V3()).add(new V3(0, -0.02, 0)).normalize();
  if (spread) d.applyAxisAngle(UP, spread);
  if (lift) { d.y += lift; d.normalize(); }
  return d;
}
// 번개: a → b 로 꺾이며 뻗는 빛 (입자) · 곁가지
function zap(G, a, b, o = {}) {
  const d = new V3().subVectors(b, a), L = d.length(); if (L < 1e-3) return; d.normalize();
  const side = new V3().crossVectors(d, Math.abs(d.y) > 0.9 ? new V3(1, 0, 0) : UP).normalize(), up = new V3().crossVectors(side, d);
  const n = Math.max(3, Math.round(L / (o.seg || 0.35))), amp = (o.amp ?? 0.18) * Math.min(1.6, 0.4 + L / 6), w = o.w || 1, col = o.color ?? BOLT, pts = [a.clone()];
  for (let i = 1; i < n; i++) { const t = i / n, k = Math.sin(t * Math.PI); pts.push(a.clone().addScaledVector(d, t * L).addScaledVector(side, rand(-1, 1) * amp * k).addScaledVector(up, rand(-1, 1) * amp * k)); }
  pts.push(b.clone());
  for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1], m = Math.max(1, Math.round(p.distanceTo(q) / 0.11));
    for (let j = 0; j < m; j++) G.fx.p(p.clone().lerp(q, j / m), { size: (0.09 + Math.random() * 0.05) * w, size1: 0.02, life: o.life ?? rand(0.08, 0.16), color: Math.random() < 0.45 ? 0xffffff : col, alpha: 1, drag: 0 }); }
  if (o.branch) for (let k = 0; k < o.branch; k++) { const i = 1 + ((Math.random() * (pts.length - 2)) | 0), s = pts[i], e = s.clone().addScaledVector(d, rand(0.2, 0.6) * L / n * 3).addScaledVector(side, rand(-1, 1) * L * 0.12).addScaledVector(up, rand(-0.6, 0.6) * L * 0.1); zap(G, s, e, { ...o, branch: 0, w: w * 0.6 }); }
}
function sparks(G, p, s = 1, dir) {
  G.fx.burst(p, Math.round(14 * s), LIGHTS, 8 * s, dir ? { dir, spread: 1.1 } : {});
  G.fx.burst(p, Math.round(3 * s), ICE, 1.5 * s, { kind: 'glow', sk: 0.7 * s });
  G.fx.p(p, { size: 0.8 * s, size1: 1.6 * s, life: 0.14, color: 0xffffff, alpha: 0.85 });
  for (let i = 0; i < 2; i++) { const e = p.clone().add(new V3(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).multiplyScalar(0.8 * s)); zap(G, p, e, { w: 0.6 * s, amp: 0.08 }); }
}
// 하늘에서 내리꽂히는 낙뢰 (지면 충격파 판정)
function skyStrike(G, f, p, hit, r = 1.6) {
  const top = p.clone().add(new V3(rand(-1.5, 1.5), 13, rand(-1.5, 1.5))), g = p.clone().setY(p.y + 0.02);
  zap(G, top, g, { w: 1.8, amp: 0.7, seg: 0.8, branch: 3 }); zap(G, top, g, { w: 0.9, amp: 0.9, seg: 0.9 });
  G.fx.ring(g.clone().setY(g.y + 0.04), { normal: UP, r0: 0.2, r1: r * 1.3, life: 0.35, color: BOLT }); G.fx.burst(g.clone().setY(g.y + 0.2), 18, LIGHTS, 7, { dir: UP, spread: 1.0 });
  G.fx.light(g.clone().setY(g.y + 1.5), BOLT, 120, 0.3, 18); sfx('zap'); sfx('boom'); G.shake(0.15);
  if (hit) areaHit(f, g, r, hit, 3);
}

/* ---------- 빛의 화살: 직선 · 유도 · 관통 · 번개 꼬리 ---------- */
let _arw = null;
function arrowGeo() {
  if (_arw) return _arw;
  const shaft = new THREE.CylinderGeometry(0.018, 0.035, 1, 8, 1, true); shaft.translate(0, -0.5, 0); shaft.rotateX(Math.PI / 2); // 길이 방향 = 뒤(-Z)
  const head = new THREE.OctahedronGeometry(0.07, 0); head.scale(0.55, 0.55, 1.9);
  const fin = new THREE.ConeGeometry(0.06, 0.18, 4, 1, true); fin.rotateX(-Math.PI / 2); fin.translate(0, 0, -0.75);
  const mShaft = new THREE.MeshBasicMaterial({ color: BOLT, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const mHead = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const mGold = new THREE.MeshBasicMaterial({ color: GOLDA, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  _arw = { shaft, head, fin, mShaft, mHead, mGold }; return _arw;
}
class LightArrow {
  // o: { pos, dir, speed, size, hit, pierce, homing, life, bolt(번개 꼬리), gold, onHit(arrow, t, res), noHit }
  constructor(G, f, o) {
    this.G = G; this.owner = f; this.o = o; this.pos = o.pos.clone(); this.vel = o.dir.clone().normalize().multiplyScalar(o.speed ?? 50); this.t = 0; this.done = false; this.hitSet = new Set();
    this.size = o.size ?? 1; this.life = o.life ?? 0.9; this.homing = o.homing ?? 0; this.prev = this.pos.clone();
    const A = arrowGeo(); this.mesh = new THREE.Group(); G.scene.add(this.mesh);
    const sh = new THREE.Mesh(A.shaft, o.gold ? A.mGold : A.mShaft); sh.scale.set(this.size, this.size, 0.9 * this.size + (o.bolt ? 0.6 : 0)); this.mesh.add(sh);
    const hd = new THREE.Mesh(A.head, A.mHead); hd.scale.setScalar(this.size); this.mesh.add(hd);
    const fn = new THREE.Mesh(A.fin, o.gold ? A.mGold : A.mShaft); fn.scale.setScalar(this.size); this.mesh.add(fn);
    this.mesh.traverse((m) => { m.frustumCulled = false; m.renderOrder = 10; });
    this.place();
  }
  place() { this.mesh.position.copy(this.pos); this.mesh.lookAt(this.pos.clone().add(this.vel)); }
  update(dt) {
    const G = this.G, f = this.owner, tgt = f.opp; this.t += dt; this.prev.copy(this.pos);
    if (this.homing && tgt && !tgt.gone && tgt.state !== 'ko' && this.t > 0.04) { const sp = this.vel.length(), d = aimPt(tgt).sub(this.pos).normalize().multiplyScalar(sp); this.vel.lerp(d, 1 - Math.exp(-this.homing * (1 + this.t * (this.o.ramp || 0)) * dt)); }
    this.pos.addScaledVector(this.vel, dt); this.place();
    const s = this.size, col = this.o.gold ? GOLDA : BOLT;
    G.fx.p(this.pos, { size: 0.32 * s, size1: 0.05, life: 0.12, color: col, alpha: 0.7, drag: 0 });
    G.fx.p(this.prev.clone().lerp(this.pos, 0.5), { size: 0.22 * s, size1: 0.03, life: 0.18, color: Math.random() < 0.5 ? ICE : 0xffffff, alpha: 0.6, drag: 0 });
    if (this.o.bolt && Math.random() < 0.7) { const back = this.pos.clone().addScaledVector(this.vel, -0.03); zap(G, this.pos, back.add(new V3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4)).multiplyScalar(s)), { w: 0.7 * s, amp: 0.12 * s, life: 0.1 }); }
    if (!this.o.noHit) for (const t of f.foes()) {
      if (this.hitSet.has(t) || !t.hurtHitSeg(this.prev, this.pos, 0.14 * s)) continue;
      this.hitSet.add(t); const res = t.takeHit(f, this.o.hit, this.vel.clone().setY(0).normalize());
      if (res) { sparks(G, this.pos, 0.8 + 0.4 * s, this.vel.clone().normalize().negate()); this.o.onHit && this.o.onHit(this, t, res); if (!this.o.pierce) return this.kill(); }
    }
    const W = G.stage && G.stage.world;
    if (this.t > this.life || this.pos.y < 0.03 || (W && W.solidAt(this.pos, 0.1)) || Math.hypot(this.pos.x, this.pos.z) > 45) { if (this.pos.y < 0.4 || this.t <= this.life) sparks(G, this.pos, 0.6 * s); this.o.onEnd && this.o.onEnd(this); this.kill(); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); }
}
// 활 앞코에서 화살 발사
function shoot(f, G, o = {}) {
  const from = f.model.tipPos(new V3()), dir = o.dir || aimDir(f, from, o.spread || 0, o.lift || 0);
  G.spawn(new LightArrow(G, f, { pos: from, dir, speed: o.speed ?? 52, size: o.size ?? 1, homing: o.homing ?? 0, ramp: o.ramp, life: o.life ?? 0.9, pierce: o.pierce, bolt: o.bolt, gold: o.gold, onHit: o.onHit,
    hit: { dmg: o.dmg ?? 18, kb: o.kb ?? [1.4, 0], stun: o.stun ?? 0.3, daze: o.daze ?? 8, hs: o.hs ?? 0.04, ...(o.hit || {}) } }));
  G.fx.p(from, { size: 0.6 * (o.size ?? 1), size1: 0.05, life: 0.1, color: 0xffffff, alpha: 0.9 }); G.fx.burst(from, 5, LIGHTS, 3, { dir, spread: 0.5 });
  return dir;
}

/* ---------- 빛의 화살비: 표식 위로 화살이 쏟아지고, 끝에 낙뢰 ---------- */
class ArrowRain {
  constructor(G, f, c) { this.G = G; this.f = f; this.c = c.clone(); this.t = 0; this.life = 1.9; this.done = false; this.tick = 0.45; this.spawnT = 0; this.ringT = 0; this.R = 2.7; }
  update(dt) {
    const G = this.G, f = this.f, c = this.c, R = this.R; this.t += dt; this.tick -= dt; this.spawnT -= dt; this.ringT -= dt;
    if (this.ringT <= 0) { this.ringT = 0.3; G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: R * 0.9, r1: R * 1.05, life: 0.3, color: ICE, op: 0.7 }); }
    if (this.t > 0.35 && this.t < this.life - 0.3) while (this.spawnT <= 0) { this.spawnT += 0.035;
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * R, p = c.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)), h = rand(4.5, 6.5);
      G.fx.p(p.clone().setY(c.y + h), { vel: [0, -h / 0.16, 0], size: 0.16, size1: 0.1, life: 0.16, color: Math.random() < 0.5 ? ICE : 0xffffff, alpha: 0.95, drag: 0 });
      G.fx.p(p.clone().setY(c.y + h + 0.4), { vel: [0, -h / 0.16, 0], size: 0.1, size1: 0.06, life: 0.16, color: BOLT, alpha: 0.7, drag: 0 });
      if (Math.random() < 0.5) G.fx.burst(p.clone().setY(c.y + 0.08), 3, LIGHTS, 3, { dir: UP, spread: 0.9 }); }
    if (this.tick <= 0 && this.t < this.life - 0.3) { this.tick = 0.2; sfx('shot');
      for (const t of f.foes()) if (Math.hypot(t.pos.x - c.x, t.pos.z - c.z) < R + 0.4 * t.scale && t.pos.y - c.y < 3) t.takeHit(f, { dmg: 8, kb: [0, 0], stun: 0.35, daze: 5, hs: 0.02, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize()); }
    if (this.t >= this.life - 0.3 && !this.boom) { this.boom = true; skyStrike(G, f, c, { dmg: 44, kb: [1.5, 7.5], stun: 0.65, hs: 0.1, daze: 26, snd: 'big' }, R); }
    if (this.t >= this.life) this.kill();
  }
  kill() { this.done = true; }
}

/* ---------- 빛의 리본: 지나간 자리에 남은 무지갯빛 띠 → 잠시 뒤 번개로 터짐 ---------- */
function ribbonShader() {
  return new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uOp: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT; uniform float uOp; varying vec2 vUv;
      void main(){ float h = vUv.x * 1.5 - uT * 0.8 + vUv.y * 0.3; vec3 c = 0.55 + 0.45 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67))); c = mix(c, vec3(0.7, 0.95, 1.0), 0.4);
        float e = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0); float w = 0.6 + 0.4 * sin(vUv.x * 30.0 - uT * 12.0); gl_FragColor = vec4(c * uOp * e * w, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}
class RibbonTrail {
  constructor(G, f, a, b) {
    this.G = G; this.f = f; this.a = a.clone(); this.b = b.clone(); this.t = 0; this.done = false; this.boomT = 0.55; this.life = 1.0;
    const n = 24, geo = new THREE.BufferGeometry(), pos = [], uv = [], idx = [], d = new V3().subVectors(b, a), side = new V3(-d.z, 0, d.x).normalize();
    for (let i = 0; i <= n; i++) { const u = i / n, p = a.clone().lerp(b, u), y = 0.75 + 0.35 * Math.sin(u * Math.PI * 2.5), sw = 0.25 * Math.sin(u * Math.PI * 3);
      for (const k of [0, 1]) { pos.push(p.x + side.x * sw, p.y + y + (k ? 0.32 : -0.32), p.z + side.z * sw); uv.push(u, k); } }
    for (let i = 0; i < n; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    this.mat = ribbonShader(); this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9; G.scene.add(this.mesh);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.mat.uniforms.uT.value = this.t;
    this.mat.uniforms.uOp.value = Math.min(1, this.t / 0.08) * (this.t > this.boomT ? Math.max(0, 1 - (this.t - this.boomT) / (this.life - this.boomT)) : 1) * 1.1;
    if (this.t < this.boomT && Math.random() < 0.6) { const p = this.a.clone().lerp(this.b, Math.random()).add(new V3(0, rand(0.5, 1.1), 0)); zap(G, p, p.clone().add(new V3(rand(-0.4, 0.4), rand(-0.3, 0.3), rand(-0.4, 0.4))), { w: 0.5, amp: 0.06 }); }
    if (this.t >= this.boomT && !this.boom) { this.boom = true; sfx('zap'); sfx('boom'); G.shake(0.14);
      const a = this.a.clone().setY(this.a.y + 0.9), b = this.b.clone().setY(this.b.y + 0.9); zap(G, a, b, { w: 1.6, amp: 0.3, branch: 4 }); zap(G, a, b, { w: 0.8, amp: 0.4 });
      for (const t of f.foes()) if (t.hurtHitSeg(a, b, 0.55) || t.hurtHitSeg(this.a.clone().setY(this.a.y + 0.3), this.b.clone().setY(this.b.y + 0.3), 0.5)) {
        if (t.takeHit(f, { dmg: 38, kb: [2, 4.5], stun: 0.6, hs: 0.08, daze: 18, snd: 'big' }, new V3().subVectors(t.pos, f.pos).setY(0).normalize())) { t.addStatus('slow', 2, 0.65, f); sparks(G, aimPt(t), 1.1); } } }
    if (this.t >= this.life) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

/* ---------- 궁극기: 하늘을 덮는 오로라 장막 · 거대한 극광의 화살 ---------- */
class AuroraVeil {
  constructor(G, c, life) {
    this.G = G; this.c = c.clone(); this.t = 0; this.life = life; this.done = false; this.mat = ribbonShader(); this.meshes = [];
    for (let k = 0; k < 3; k++) { const n = 40, geo = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) { const u = i / n, x = (u - 0.5) * 22, z = -3 - k * 3 + Math.sin(u * 7 + k) * 2.2; for (const j of [0, 1]) { pos.push(x, 6 + k * 1.2 + j * (3.5 + k), z); uv.push(u * 2 + k * 0.3, j); } }
      for (let i = 0; i < n; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      const me = new THREE.Mesh(geo, this.mat); me.position.copy(this.c); me.frustumCulled = false; me.renderOrder = 7; G.scene.add(me); this.meshes.push(me); }
  }
  aim(yaw) { for (const me of this.meshes) me.rotation.y = yaw; }
  update(dt) { this.t += dt; this.mat.uniforms.uT.value = this.t; this.mat.uniforms.uOp.value = 0.6 * Math.min(1, this.t / 0.5) * Math.min(1, (this.life - this.t) / 0.5); this.meshes.forEach((me, k) => { me.position.y = this.c.y + Math.sin(this.t * 1.2 + k) * 0.3; }); if (this.t >= this.life) this.kill(); }
  kill() { if (this.done) return; this.done = true; for (const me of this.meshes) { this.G.scene.remove(me); me.geometry.dispose(); } this.mat.dispose(); }
}
class AuroraBeam {
  constructor(G, f, from, dir, len, hitFn) {
    this.G = G; this.f = f; this.from = from.clone(); this.dir = dir.clone().normalize(); this.len = len; this.t = 0; this.life = 1.0; this.done = false;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); geo.translate(0, 0.5, 0); this.geo = geo;
    this.mat = ribbonShader(); this.core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.outer = new THREE.Mesh(geo, this.mat); this.inner = new THREE.Mesh(geo, this.core);
    for (const me of [this.outer, this.inner]) { me.position.copy(this.from); me.quaternion.setFromUnitVectors(UP, this.dir); me.frustumCulled = false; me.renderOrder = 11; G.scene.add(me); }
    const b = this.from.clone().addScaledVector(this.dir, len);
    for (const t of f.foes()) if (t.hurtHitSeg(this.from, b, 0.9)) { const h = hitFn(t); if (h) t.takeHit(f, h, this.dir.clone().setY(0).normalize()); }
  }
  update(dt) {
    const G = this.G; this.t += dt; const k = Math.min(1, this.t / 0.08), fade = Math.max(0, 1 - Math.max(0, this.t - 0.35) / (this.life - 0.35)), w = (0.95 + 0.12 * Math.sin(this.t * 60)) * fade;
    this.outer.scale.set(w * 1.0 * k, this.len, w * 1.0 * k); this.inner.scale.set(w * 0.35 * k, this.len, w * 0.35 * k); this.mat.uniforms.uT.value = this.t * 3; this.mat.uniforms.uOp.value = 1.4 * fade; this.core.opacity = 0.9 * fade;
    for (let i = 0; i < 5; i++) { const u = Math.random() * this.len, a = rand(0, TAU), side = new V3().crossVectors(this.dir, UP).normalize(), up = new V3().crossVectors(side, this.dir), p = this.from.clone().addScaledVector(this.dir, u).addScaledVector(side, Math.cos(a) * 1.1).addScaledVector(up, Math.sin(a) * 1.1);
      G.fx.p(p, { vel: [side.x * Math.cos(a) * 3, 1 + up.y * 2, side.z * Math.cos(a) * 3], size: 0.18, size1: 0.03, life: 0.4, color: LIGHTS[i % 3], alpha: 0.9, drag: 1 }); }
    if (this.t < 0.5 && Math.random() < 0.7) { const u = Math.random() * this.len * 0.9, p = this.from.clone().addScaledVector(this.dir, u); zap(G, p, p.clone().addScaledVector(this.dir, rand(1.5, 3)).add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1))), { w: 1, amp: 0.3 }); }
    if (this.t >= this.life) this.kill();
  }
  kill() { if (this.done) return; this.done = true; for (const me of [this.outer, this.inner]) this.G.scene.remove(me); this.geo.dispose(); this.mat.dispose(); this.core.dispose(); }
}

/* =====================================================================
   기술 — 원거리 궁수: 칼날 활대 베기 · 빛의 화살 · 번개 관통시 · 화살비 · 빛의 리본 이동
   ===================================================================== */
const gem = (f, k) => { f.gemK = k; };
const pull = (f, k) => { f.drawK = k; };
const charges = (f) => Math.min(3, Math.floor((f.glowP || 0) / CHARGE + 1e-6));
const iceSlash = (f, o) => f.slashFx({ r: o.r || 1.9, color: o.color ?? ICE, life: o.life ?? 0.22, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.5] });
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 활을 아래로 겨누고 번개를 두른 채 내리꽂힌다 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.3, 0, 0], head: [0.2, 0, 0], shoulderR: [-1.5, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.3, 0, 1.57], shoulderL: [-0.4, 0, 0.8], elbowL: [-0.5, 0, 0], hipL: [-1.0, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: BOLT, dmg: 68, r: 2.5, fallDmg: 30,
    fx: (f, o, G, c) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rand(0, 0.5), d = new V3(Math.cos(a), 0, Math.sin(a)); zap(G, c.clone().setY(c.y + 0.1), c.clone().addScaledVector(d, 2.6).setY(c.y + 0.1), { w: 0.9, amp: 0.25 }); } skyStrike(G, f, c, null, 2); },
  }),

  /* --- 기본 공격: 칼날 활대 베기 → 쌍시 → 섬광 관통시 → 삼호 산사 (쏘면서 이동 가능) --- */
  light1: { dur: 0.4, cancel: 0.2, next: 'light2', trail: true, track: 0.06, ikOff: true,
    keys: [[0, 'windR'], [0.11, 'slashL'], [0.24, {}], [0.4, 'base']], lunge: [[0.02, 0.1, 6]],
    ev: [[0.05, () => sfx('swing')], [0.08, (f) => iceSlash(f, { tilt: 0.12, r: 2.0 })], [0.1, (f, o, G) => { const p = f.local([0, 1.1, 1.0]); zap(G, p.clone().add(new V3(0.6, 0, 0)), p.clone().add(new V3(-0.6, 0, 0)), { w: 0.6, amp: 0.1 }); }]],
    hits: [{ t0: 0.05, t1: 0.17, dmg: 30, br: 0.2 }] },
  light2: { dur: 0.4, cancel: 0.22, next: 'light3', move: 0.5, ikOff: true, track: 0.1,
    keys: [[0, 'aimPrep'], [0.07, 'aim'], [0.26, {}], [0.4, 'base']],
    ev: [[0.02, (f) => { gem(f, 0.5); pull(f, 0.4); }], [0.09, (f, o, G) => { sfx('shot'); pull(f, 0.3); shoot(f, G, { dmg: 15, spread: 0.035, speed: 54 }); }], [0.17, (f, o, G) => { sfx('shot'); pull(f, 0); shoot(f, G, { dmg: 15, spread: -0.035, speed: 54 }); }], [0.3, (f) => gem(f, 0)]],
    end: (f) => { gem(f, 0); pull(f, 0); } },
  light3: { dur: 0.5, cancel: 0.28, next: 'light4', move: 0.4, ikOff: true, track: 0.14,
    keys: [[0, 'aim'], [0.1, 'draw'], [0.2, 'aim'], [0.34, {}], [0.5, 'base']],
    ev: [[0.0, (f) => { gem(f, 0.8); pull(f, 0.8); sfx('charge'); }], [0.2, (f, o, G) => { sfx('shot'); sfx('zap'); pull(f, 0); shoot(f, G, { dmg: 30, speed: 72, size: 1.2, pierce: true, bolt: true, kb: [2, 0] }); }], [0.4, (f) => gem(f, 0)]],
    end: (f) => { gem(f, 0); pull(f, 0); } },
  light4: { dur: 0.72, move: 0.25, ikOff: true, track: 0.3, shout: true,
    keys: [[0, 'aimPrep'], [0.14, { ...poses.draw, weapon: [0.2, 0.05, 0.9] }], [0.3, 'draw'], [0.36, 'aim'], [0.54, {}], [0.72, 'base']],
    ev: [[0, (f) => { gem(f, 1); pull(f, 1); sfx('charge'); }],
      [0.36, (f, o, G) => { sfx('shot'); sfx('dash'); pull(f, 0); for (const s of [-1, 0, 1]) shoot(f, G, { dmg: 17, spread: s * 0.45, lift: Math.abs(s) * 0.08, speed: 30, homing: s ? 5 : 1, ramp: s ? 10 : 0, life: 1.2, size: 1.1, kb: [1.6, 0], hit: { noScale: s !== 0 } }); G.fx.ring(f.model.tipPos(new V3()), { r0: 0.1, r1: 1.0, life: 0.22, color: ICE, billboard: true }); }],
      [0.6, (f) => gem(f, 0)]],
    tick: (f, o, G, t) => { if (t < 0.34) { const p = f.model.tipPos(new V3()); for (let i = 0; i < 2; i++) { const q = p.clone().add(new V3(rand(-0.7, 0.7), rand(-0.6, 0.6), rand(-0.7, 0.7))), v = p.clone().sub(q).multiplyScalar(4); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.09, size1: 0.02, life: 0.24, color: i ? ICE : 0xffffff, alpha: 0.9 }); } } },
    end: (f) => { gem(f, 0); pull(f, 0); } },

  /* --- 우클: 뇌광 관통시 — 끝까지 당겨 번개를 두른 화살을 쏜다 (관통). 모은 잔광을 모두 실어, 칸마다 피해 ↑ · 낙뢰가 따라 떨어진다 --- */
  // 차징: 우클을 누르고 있으면 끝까지 당긴 채로 힘을 모은다 (최대 1.2초 · 누른 시간에 비례: 바로 떼면 ×0.4 → 완충 ×2.0)
  heavy: { dur: 1.0, cd: 'heavy', ikOff: true, track: 0.5, shout: true, noMove: true, hold: { key: 'heavy', at: 0.52, max: 1.2 },
    keys: [[0, 'aimPrep'], [0.16, 'aim'], [0.5, 'draw'], [0.58, { ...poses.aim, spine: [-0.08, 0.35, 0], weapon: [0.12, 0.1, 0.5] }], [0.78, {}], [1.0, 'base']],
    start: (f, o, G) => { f.shotC = charges(f); gem(f, 1); sfx('charge'); G.say(f, f.shotC >= 3 ? '"모든 빛이여 — 꿰뚫어라."' : '"빛이여, 꿰뚫어라."'); },
    tick: (f, o, G, t) => { if (t < 0.56) { pull(f, Math.min(1, t / 0.5)); const p = f.model.tipPos(new V3()), n = 2 + f.shotC;
        for (let i = 0; i < n; i++) { const a = rand(0, TAU), q = p.clone().add(new V3(Math.cos(a) * 0.9, rand(-0.6, 0.6), Math.sin(a) * 0.9)), v = p.clone().sub(q).multiplyScalar(5); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.03, life: 0.2, color: LIGHTS[i % 3], alpha: 0.9 }); }
        if (Math.random() < 0.5) zap(G, p, p.clone().add(new V3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6))), { w: 0.6, amp: 0.1 }); } },
    ev: [[0.56, (f, o, G) => { const c = f.shotC; f.glowP = Math.max(0, (f.glowP || 0) - c * CHARGE); pull(f, 0); sfx('shot'); sfx('zap'); sfx('heavy'); G.shake(0.1); G.flash(BOLT, 0.12 + c * 0.04);
        const hk = 0.4 + 1.6 * (f.holdK || 0), dir = shoot(f, G, { dmg: Math.round((70 + c * 16) * hk), speed: 80, size: (1.7 + c * 0.25) * (0.85 + 0.45 * (f.holdK || 0)), pierce: true, bolt: true, life: 0.7, kb: [7, 2.5], stun: 0.75, hs: 0.12, daze: 30, hit: { shake: 0.16, snd: 'big' },
          onHit: (ar, t, res) => { if (res !== 'hit' || !c) return; let k = 0; G.spawn({ t: 0, done: false, update(dt) { this.t += dt; while (k < c && this.t >= 0.22 + k * 0.16) { k++; if (!t.gone && t.state !== 'ko') skyStrike(G, f, t.pos.clone().setY(t.onGround ? t.pos.y : 0), { dmg: 20, kb: [0.5, 3], stun: 0.5, hs: 0.06, daze: 12, noCrit: true, force: false }, 1.1); } if (k >= c) this.done = true; }, kill() { this.done = true; } }); } });
        const from = f.model.tipPos(new V3()); zap(G, from, from.clone().addScaledVector(dir, 6), { w: 1.4, amp: 0.25, branch: 2 }); G.fx.ring(from, { r0: 0.1, r1: 1.4, life: 0.28, color: ICE, billboard: true }); G.fx.light(from, BOLT, 90, 0.25);
        f.vel.addScaledVector(dir.clone().setY(0).normalize(), -5); }],
      [0.8, (f) => gem(f, 0)]],
    end: (f) => { gem(f, 0); pull(f, 0); } },

  /* --- Shift: 빛의 화살비 — 하늘로 쏘아 올린 화살이 상대 머리 위에서 흩어져 쏟아지고, 끝에 낙뢰 --- */
  s1: { dur: 0.8, cd: 's1', ikOff: true, track: 0.3, shout: true, move: 0.2,
    keys: [[0, 'aimPrep'], [0.2, 'raise'], [0.32, { ...poses.raise, spine: [-0.3, 0.1, 0] }], [0.56, {}], [0.8, 'base']],
    start: (f, o, G) => { gem(f, 1); pull(f, 0.9); G.say(f, '"쏟아져라, 별의 비."'); sfx('charge'); },
    ev: [[0.3, (f, o, G) => { pull(f, 0); sfx('shot'); sfx('zap'); const from = f.model.tipPos(new V3());
        G.spawn(new LightArrow(G, f, { pos: from, dir: new V3(0, 1, 0).addScaledVector(f.fwd(new V3()), 0.15), speed: 40, size: 1.4, life: 0.4, noHit: true, bolt: true }));
        const c = o && !o.gone && o.state !== 'ko' && f.dist() < 24 ? o.pos.clone().setY(o.onGround ? o.pos.y : 0) : f.local([0, 0, 8]); c.y = Math.max(0, Math.min(c.y, f.pos.y + 0.5));
        G.spawn(new ArrowRain(G, f, c)); }], [0.6, (f) => gem(f, 0)]],
    end: (f) => { gem(f, 0); pull(f, 0); } },

  /* --- E: 오로라 스텝 — 빛의 리본을 타고 미끄러지듯 옮겨 가고, 지나간 자리의 리본이 번개로 터진다. 착지하며 번개 화살 한 발 --- */
  s2: { dur: 0.62, cd: 's2', ikOff: true, aim: false, noMove: true,
    keys: [[0, 'dash'], [0.18, 'dash'], [0.28, 'aim'], [0.46, {}], [0.62, 'base']],
    start: (f, o, G) => { gem(f, 1); sfx('dash'); sfx('zap');
      const m = Math.hypot(f.I.mx, f.I.mz); let d;
      if (m > 0.2) d = new V3(f.I.mx / m, 0, f.I.mz / m);
      else if (o && !o.gone) { const to = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); f.stepSide = -(f.stepSide || 1); d = new V3(-to.z, 0, to.x).multiplyScalar(f.stepSide).addScaledVector(to, f.dist() < 5 ? -0.8 : -0.2).normalize(); }
      else d = f.fwd(new V3()).negate();
      f.stepDir = d; f.stepFrom = f.pos.clone(); f.yaw = Math.atan2(d.x, d.z); f.addStatus('haste', 2.5, 1.25, f); G.say(f, '"빛을 따라."'); },
    tick: (f, o, G, t) => { if (t < 0.17) { f.vel.x = f.stepDir.x * 30; f.vel.z = f.stepDir.z * 30; f.inv = Math.max(f.inv, 0.05); G.fx.p(f.chest(new V3()), { size: 1.0, size1: 0.2, life: 0.22, color: ICE, alpha: 0.4 }); }
      else if (t < 0.2) { f.vel.x *= 0.2; f.vel.z *= 0.2; } },
    ev: [[0.19, (f, o, G) => { G.spawn(new RibbonTrail(G, f, f.stepFrom, f.pos.clone())); f.faceOpp(); f.model.resetCloth(); }],
      [0.3, (f, o, G) => { sfx('shot'); shoot(f, G, { dmg: 24, speed: 70, size: 1.15, bolt: true, kb: [2, 0], stun: 0.4, daze: 10 }); }], [0.5, (f) => gem(f, 0)]],
    end: (f) => gem(f, 0) },

  /* --- 극한 회피 뒤 좌클: 천공 낙뢰시 — 상대 머리 위로 순간이동해 아래로 번개 화살을 내리꽂는다 --- */
  counter: { dur: 0.8, ikOff: true, aim: true,
    keys: [[0, 'aimDown'], [0.14, { ...poses.aimDown, shoulderL: [-1.3, 0, -0.9], elbowL: [-1.9, 0, 0] }], [0.2, 'aimDown'], [0.55, {}], [0.8, 'jump']],
    ev: [[0, (f, o, G) => { const from = f.chest(); sfx('dash'); sfx('zap'); G.flash(ICE, 0.2); pull(f, 1); gem(f, 1);
        if (o) { const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); f.pos.copy(o.pos).addScaledVector(d, 1.1).setY((o.onGround ? o.pos.y : 0) + 3.2); f.yaw = Math.atan2(-d.x, -d.z); }
        f.vel.set(0, 0, 0); f.onGround = false; f.float = true; f.model.resetCloth(); zap(G, from, f.chest(new V3()), { w: 1.2, amp: 0.4, branch: 2 }); }],
      [0.18, (f, o, G) => { pull(f, 0); sfx('shot'); sfx('boom'); const from = f.model.tipPos(new V3()), dir = o && !o.gone ? aimPt(o).sub(from).normalize() : new V3(0, -1, 0).addScaledVector(f.fwd(new V3()), 0.6).normalize();
        shoot(f, G, { dir, dmg: 88, speed: 70, size: 1.8, bolt: true, pierce: true, kb: [5, 3], stun: 0.6, hs: 0.14, daze: 40, hit: { snd: 'big', shake: 0.18 }, onEnd: (ar) => skyStrike(G, f, ar.pos.clone().setY(Math.max(0, ar.pos.y)), null, 1.6) }); G.slow(0.45, 0.15); }],
      [0.42, (f) => { f.float = false; f.vel.y = 1; gem(f, 0); }]],
    end: (f) => { f.float = false; pull(f, 0); gem(f, 0); } },

  /* --- Q: 극광 · 빛의 잔향 — 광륜이 열리고 하늘에 오로라가 드리운다. 낙뢰의 폭풍으로 묶은 뒤, 거대한 극광의 화살로 꿰뚫는다 --- */
  ult: { dur: 3.4, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, 'base'], [0.5, { ...poses.raise, head: [-0.7, -0.1, 0] }], [0.9, 'raise'], [1.0, { ...poses.raise, spine: [-0.3, 0.1, 0] }], [2.1, 'raise'], [2.4, 'bigDraw'], [2.84, 'bigDraw'], [2.9, { ...poses.bigDraw, spine: [-0.12, 0.4, 0], shoulderL: [-0.6, 0, 0.9], elbowL: [-0.3, 0, 0] }], [3.4, 'win']],
    cam: [[0, { ref: 'self', p: [0.8, 1.4, 2.2], l: [0, 1.7, 0], fov: 40 }], [0.85, { ref: 'self', p: [0.5, 0.9, 1.9], l: [0, 2.3, 0], fov: 50 }],
      [1.05, { ref: 'target', p: [4.5, 2.0, 4.5], l: [0, 3.5, 0], fov: 62 }], [2.1, { ref: 'target', p: [-4.0, 1.4, 4.2], l: [0, 2.0, 0], fov: 60 }],
      [2.3, { ref: 'self', p: [-0.9, 1.45, -1.3], l: [0.2, 1.3, 6], fov: 46 }], [2.85, { ref: 'self', p: [-0.6, 1.4, -1.0], l: [0.2, 1.3, 6], fov: 40 }],
      [2.95, { ref: 'self', p: [3.2, 1.6, 2.4], l: [0, 1.2, 5], fov: 58 }], [3.4, { ref: 'self', p: [2.6, 1.8, 3.6], l: [0, 1.3, 1], fov: 48 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(NAVY, 0.4); gem(f, 1); f.haloK = 1; sfx('charge'); sfx('ult'); G.say(f, '"꺼진 하늘이여, 빛을 기억하라."'); G.fx.burst(f.chest(), 30, LIGHTS, 5); }],
      [0.95, (f, o, G) => { o = f.ultTgt || o; sfx('shot'); sfx('boom'); G.flash(0xeaffff, 0.35); G.stage.flashSky && G.stage.flashSky(0.5); const from = f.model.tipPos(new V3());
        G.spawn(new LightArrow(G, f, { pos: from, dir: new V3(0, 1, 0), speed: 60, size: 2.2, life: 0.35, noHit: true, bolt: true, gold: true })); zap(G, from, from.clone().add(new V3(0, 14, 0)), { w: 2, amp: 0.5, branch: 3 });
        const c = (o || f).pos.clone().setY(0); f.veil = new AuroraVeil(G, c, 2.45); f.veil.aim(f.yaw); G.spawn(f.veil); }],
      [2.84, (f, o, G) => { o = f.ultTgt || o; pull(f, 0); const from = f.model.tipPos(new V3()), dir = o && !o.gone ? aimPt(o).sub(from).normalize() : f.fwd(new V3());
        if (o) o.release(); sfx('boom'); sfx('big'); sfx('zap'); G.flash(0xeaffff, 0.6); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.6);
        G.spawn(new AuroraBeam(G, f, from, dir, 34, (t) => t === o ? { dmg: 200, kb: [12, 5], stun: 1.0, hs: 0.22, shake: 0.5, noScale: true, force: true, daze: 100, snd: 'big' } : { dmg: 110, kb: [9, 5], stun: 0.8, force: true, noCrit: true, noScale: true }));
        G.fx.ring(from, { r0: 0.2, r1: 3.2, life: 0.5, color: ICE, billboard: true }); G.fx.light(from, BOLT, 200, 0.6, 22); f.vel.addScaledVector(dir.clone().setY(0).normalize(), -8); G.slow(0.3, 0.55); G.say(f, '"…빛은 남는다."'); }],
    ],
    tick: (f, o, G, t, dt) => {
      // 빛의 조각이 열린 광륜으로 모여든다
      if (t < 0.95) { const c = f.model.J.head.getWorldPosition(new V3()).add(new V3(0, 0.5, 0)); for (let i = 0; i < 3; i++) { const a = t * 7 + i * 2.1, R = rand(1.2, 2.4), q = c.clone().add(new V3(Math.cos(a) * R, rand(-1.2, 0.5), Math.sin(a) * R)), v = c.clone().sub(q).multiplyScalar(3); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.02, life: 0.3, color: i ? ICE : GOLDA, alpha: 0.9 }); } }
      // 낙뢰의 폭풍: 대상 주위로 연달아 떨어지고, 세 번에 한 번 대상에 꽂힌다
      const tg = f.ultTgt; if (tg && t > 1.1 && t < 2.3) { f.stormAcc = (f.stormAcc || 0) + dt; while (f.stormAcc >= 0.11) { f.stormAcc -= 0.11; f.stormN = (f.stormN || 0) + 1;
        const onT = f.stormN % 3 === 0, p = tg.pos.clone().setY(0).add(onT ? new V3() : new V3(rand(-3, 3), 0, rand(-3, 3)));
        skyStrike(G, f, p, null, onT ? 1 : 0.8); if (onT && !tg.gone) tg.takeHit(f, { dmg: 12, kb: [0, 0], stun: 99, hs: 0.02, nokill: true, noScale: true, force: true, noCrit: true, daze: 8, snd: 'hit' }, new V3().subVectors(tg.pos, f.pos).setY(0).normalize()); } }
      // 끝까지 당김: 시위에 극광이 모인다
      if (t > 2.35 && t < 2.84) { pull(f, Math.min(1, (t - 2.35) / 0.3)); const p = f.model.tipPos(new V3()); for (let i = 0; i < 3; i++) { const q = p.clone().add(new V3(rand(-1.2, 1.2), rand(-1, 1), rand(-1.2, 1.2))), v = p.clone().sub(q).multiplyScalar(4); G.fx.p(q, { vel: [v.x, v.y, v.z], size: 0.14, size1: 0.03, life: 0.25, color: LIGHTS[i], alpha: 0.9 }); } if (Math.random() < 0.6) zap(G, p, p.clone().add(new V3(rand(-0.8, 0.8), rand(-0.8, 0.8), rand(-0.8, 0.8))), { w: 0.8, amp: 0.12 }); }
    },
    end: (f, o, G) => { G.setTint(0, 0); gem(f, 0); pull(f, 0); f.haloK = 0; f.stormN = 0; f.stormAcc = 0; const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, ICE, big ? 1.7 : 1.0, dir);
  for (let i = 0; i < (big ? 4 : 2); i++) zap(G, p, p.clone().add(new V3(rand(-1, 1), rand(-0.8, 1), rand(-1, 1)).multiplyScalar(big ? 1.2 : 0.7)), { w: 0.7, amp: 0.1 });
  if (big) G.fx.ring(p, { r0: 0.2, r1: 1.8, life: 0.3, color: BOLT, billboard: true });
  // 잔광: 맞힐 때마다 빛의 조각이 모인다 (3칸)
  const was = charges(att); att.glowP = Math.min(GLOW_MAX, (att.glowP || 0) + h.dmg * 0.32); if (charges(att) > was) sfx('tele');
}

// 잔광 칸 수 → 눈 · 보석 빛 / 궤적 색
function createModelWithGlow(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    f.glowC = charges(f);
    if (f.glowC >= 3 && f.root.visible && Math.random() < 0.35) { const a = f.G.time * 3 + Math.random() * TAU; f.G.fx.p(f.pos.clone().add(new V3(Math.cos(a) * 0.5, 0.3 + Math.random() * 1.5, Math.sin(a) * 0.5)), { vel: [0, 0.9, 0], life: 0.6, size: 0.07, size1: 0.02, color: Math.random() < 0.5 ? ICE : GOLDA, alpha: 0.85, drag: 0.5 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

// CPU: 거리를 두고 쏘고, 붙으면 리본으로 빠지며, 잔광이 차면 관통시
function aiPick(f, o, dist) {
  if (dist < 4 && f.cd.s2 <= 0 && Math.random() < 0.35) return 's2';
  if (dist > 4 && dist < 26 && f.cd.heavy <= 0 && (charges(f) >= 2 || Math.random() < 0.3)) return 'heavy';
  if (dist > 3 && dist < 20 && f.cd.s1 <= 0 && Math.random() < 0.28) return 's1';
  if (dist < 2.2 && Math.random() < 0.35) return 'light';
  return null;
}

export default {
  id: 'aurora', name: '오로라', short: '오로라', title: '빛의 잔향', scale: 1.0,
  desc: '원거리 · 활 · 번개. 무너진 세계의 빛을 모으는 마지막 인도자. 은색 기계 활의 칼날 활대로 베고, 빛의 화살과 번개 화살을 쏘며, 하늘에서 화살비와 낙뢰를 부르고, 빛의 리본을 타고 옮겨 다닌다. 맞힐수록 잔광이 모이고, 우클 관통시가 모은 잔광을 모두 실어 쏜다.',
  stats: { hp: 880, speed: 7.6, jump: 10.5, crit: 0.22 },
  palettes: [{ accent: ICE, glow: BOLT }, { accent: 0xffc46a, glow: 0xffc46a }],
  skills: { heavy: { name: '뇌광 관통시', cd: 7 }, s1: { name: '빛의 화살비', cd: 11 }, s2: { name: '오로라 스텝', cd: 9 }, ult: { name: '극광 · 빛의 잔향', sub: 'LIGHT REMAINS' } },
  aimRange: RANGE, aiRange: [6, 14], aiPick,
  onReset: (f) => { f.glowP = 0; f.glowC = 0; f.drawK = 0; f.haloK = 0; f.gemK = 0; f.float = false; f.ultTgt = null; f.veil = null; f.stormN = 0; f.stormAcc = 0; f.shotC = 0; },
  resource: (f) => { const c = charges(f); return c >= 3 ? { v: 1, label: '잔광 ×3', color: 0xfff0b8, full: true } : { v: (f.glowP || 0) / GLOW_MAX, label: `잔광 ×${c}`, color: 0x7ad8ff }; },
  moveList: [['좌클 ×4', '칼날 활대 베기 30 → 쌍시 15·15 → 섬광 관통시(관통 번개 화살) 30 → 삼호 산사: 양옆으로 휘어 들어오는 세 발 17×3. 쏘면서 이동 가능'], ['공중 좌클', '활을 아래로 겨누고 번개를 두른 채 내리꽂혀 낙뢰'],
    ['우클 · 뇌광 관통시', '끝까지 당겨 관통하는 번개 화살 70. 잔광 한 칸마다 피해 +16 · 맞은 상대에게 낙뢰 20이 하나씩 따라 떨어짐'], ['Shift · 빛의 화살비', '하늘로 쏜 화살이 상대 머리 위에서 쏟아짐: 0.2초마다 8 → 끝에 낙뢰 44(띄움)'],
    ['E · 오로라 스텝', '빛의 리본을 타고 옆·뒤로 미끄러지듯 이동(방향키 방향) · 2.5초 이동 속도 ×1.25 → 남은 리본이 번개로 터짐 38 + 2초 둔화 · 번개 화살 24'], ['Q · 극광 · 빛의 잔향', '광륜이 열리고 하늘에 오로라 — 낙뢰의 폭풍으로 묶고(12×4) 거대한 극광의 화살 200'],
    ['잔광', '맞힐수록 빛의 조각이 모인다 (3칸) · 우클 관통시가 모두 실어 쏜다'], ['C (타이밍) · 극한 회피', '천공 낙뢰시: 상대 머리 위로 순간이동해 아래로 번개 화살 88'], ['가만히', '활을 세워 짚고 하늘을 올려다봄']],
  createModel: createModelWithGlow, poses, moves, hitFx,
};
