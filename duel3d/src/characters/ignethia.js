// 이그네시아 (IGNETHIA) — 근거리 · 업화 · 암룡 소환
// 진홍 업화의 여왕. 분홍 업화에 휩싸인 장검을 휘두르고, 그림자 같은 암룡을 불러 하늘에서 불씨를 떨어뜨린다.
// 무기: 검보라 칼날의 가늘고 긴 장검 — 맞힐수록 업화가 차오르고, 가득 차면 흑염참이 불꽃 파도를 함께 날린다.
// 암룡은 늘 곁에 있는 몸이 아니라 기술을 쓸 때만 그림자 불길로 모습을 드러낸다 (AbyssDragon).
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, PINK, VIOLET, CINDER, HOTP, EMER } from './ignethia_model.js';
import { makePlunge } from '../plunge.js';
import { surf, strand, lathe, smooth, gauss, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const FLAMES = [PINK, VIOLET, HOTP];

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const poses = {
  // 기본: 장검을 오른손에 비스듬히 내려 들고, 왼손은 발톱을 세워 앞으로 — 여유로운 여왕의 자세
  base: { hips: [0, 0.18, 0], spine: [0.04, -0.08, 0], chest: [0.0, -0.1, 0], head: [0.04, 0.12, 0],
    shoulderR: [-0.3, 0, -0.22], elbowR: [-0.85, 0, 0], weapon: [-0.62, 0.42, 0.3], shoulderL: [-0.4, 0, 0.22], elbowL: [-1.2, 0, 0],
    hipL: [-0.15, 0, 0.06], kneeL: [0.22, 0, 0], footL: [-0.08, 0, 0], hipR: [0.12, 0, -0.08], kneeR: [0.12, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.1, 0], spine: [0.38, 0.05, 0], chest: [0.08, 0.05, 0], head: [-0.25, 0, 0], shoulderR: [0.55, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [-0.15, 2.7, 0.3], shoulderL: [0.3, 0, 0.2], elbowL: [-1.0, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.4, 0, 0], shoulderL: [-0.6, 0, 0.8], elbowL: [-0.6, 0, 0], weapon: [0.2, 2.4, 0.3] },
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.1, 0], chest: [0.05, 0.1, 0], shoulderR: [-1.05, 0, -0.1], elbowR: [-1.35, 0, 0], weapon: [0.15, -1.45, -1.2], shoulderL: [-1.2, 0, 0.1], elbowL: [-1.0, 0, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.5, 1.6, 0.4], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.4, 1.4, 0.6], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.74, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -0.8, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.6, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.7, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [-0.1, 2.8, 0.3], shoulderL: [0.6, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 장검을 땅에 비스듬히 꽂듯 내리고 왼손을 허리에 — 내려다보는 여왕
  win: { hips: [0, 0.3, 0], spine: [-0.05, -0.15, 0], chest: [-0.05, -0.15, 0], head: [-0.12, 0.3, 0], shoulderR: [-0.35, 0, -0.35], elbowR: [-0.3, 0, 0], weapon: [-1.1, 0.4, 1.57], shoulderL: [0.3, 0, 0.5], elbowL: [-1.6, 0, 0],
    hipL: [-0.1, 0, 0.1], kneeL: [0.15, 0, 0], hipR: [0.18, 0, -0.1], kneeR: [0.1, 0, 0] },
  portrait: { hips: [0, 0.3, 0], chest: [0, -0.2, 0], head: [0.04, 0.12, 0], shoulderR: [-1.25, 0, -0.3], elbowR: [-1.5, 0, 0], weapon: [1.3, 0.25, 0], shoulderL: [-0.6, 0, 0.5], elbowL: [-1.0, 0, 0] },
  // 오른쪽으로 감은 칼 → 왼쪽으로 가로 베기
  windR: { hips: [0, -0.45, 0], spine: [0.1, -0.35, 0], chest: [0.02, -0.4, 0], head: [0, 0.6, 0], shoulderR: [-1.0, 0, -0.75], elbowR: [-0.9, 0, 0], weapon: [0.1, 1.9, 1.57], shoulderL: [-0.4, 0, 0.3], elbowL: [-1.2, 0, 0] },
  slashL: { hips: [0, 0.45, 0], spine: [0.2, 0.4, 0], chest: [0.05, 0.45, 0], head: [0, -0.6, 0], shoulderR: [-1.3, 0, 0.45], elbowR: [-0.15, 0, 0], weapon: [0.05, -1.55, 1.57], shoulderL: [0.3, 0, 0.6], elbowL: [-0.5, 0, 0],
    hipL: [-0.75, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.45, 0, -0.12], kneeR: [0.35, 0, 0] },
  windLow: { hips: [0, 0.5, 0], spine: [0.35, 0.35, 0], chest: [0.1, 0.4, 0], head: [-0.2, -0.6, 0], shoulderR: [-0.5, 0, 0.55], elbowR: [-0.5, 0, 0], weapon: [-0.75, -1.3, 0.9],
    hipL: [-0.8, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.5, 0, -0.15], kneeR: [0.6, 0, 0] },
  slashUp: { hips: [0, -0.4, 0], spine: [-0.15, -0.35, 0], chest: [-0.1, -0.4, 0], head: [-0.2, 0.5, 0], shoulderR: [-2.6, 0, -0.55], elbowR: [-0.25, 0, 0], weapon: [1.05, 1.0, 0.9], shoulderL: [-0.2, 0, 0.6], elbowL: [-0.8, 0, 0] },
  spin: { hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.05, 0, 0], shoulderR: [-1.4, 0, -1.1], elbowR: [-0.1, 0, 0], weapon: [0.0, 1.55, 1.57], shoulderL: [-0.5, 0, 1.2], elbowL: [-0.3, 0, 0],
    hipL: [-0.6, 0, 0.2], kneeL: [0.9, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.7, 0, 0] },
  raise: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.95, 0, -0.15], elbowR: [-0.35, 0, 0], weapon: [2.2, 0, 1.57], shoulderL: [-2.7, 0, 0.2], elbowL: [-0.5, 0, 0], hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  slam: { hips: [0, -0.15, 0], spine: [0.7, 0, 0], chest: [0.2, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.0, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-1.25, 0, 1.57], shoulderL: [-0.9, 0, 0.1], elbowL: [-0.2, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.4, 0, 0] },
  // 흑염참 힘 모으기: 몸을 낮추고 칼을 오른쪽 뒤로 길게 끈다 (왼손은 앞으로 발톱을 세움)
  gather: { hipY: -0.1, hips: [0, -0.7, 0], spine: [0.3, -0.45, 0], chest: [0.1, -0.5, 0], head: [-0.2, 1.0, 0], shoulderR: [-0.3, 0, -1.0], elbowR: [-0.3, 0, 0], weapon: [-0.15, 2.4, 1.57], shoulderL: [-1.3, 0, 0.35], elbowL: [-0.5, 0, 0],
    hipL: [-1.1, 0, 0.3], kneeL: [1.4, 0, 0], footL: [-0.3, 0, 0], hipR: [0.5, 0, -0.3], kneeR: [1.0, 0, 0] },
  // 크게 휘두른 뒤: 몸이 왼쪽으로 완전히 돌아가고 칼끝은 왼쪽 뒤로
  sweep: { hipY: -0.08, hips: [0, 0.7, 0], spine: [0.3, 0.5, 0], chest: [0.08, 0.55, 0], head: [-0.15, -0.9, 0], shoulderR: [-1.45, 0, 0.6], elbowR: [-0.1, 0, 0], weapon: [-0.05, -1.9, 1.57], shoulderL: [0.4, 0, 0.8], elbowL: [-0.4, 0, 0],
    hipL: [-1.0, 0, 0.25], kneeL: [1.1, 0, 0], hipR: [0.7, 0, -0.25], kneeR: [0.6, 0, 0] },
  // 낙인: 칼을 세워 얼굴 앞에 들고 왼손 발톱을 칼날에 댄다
  brand: { hips: [0, 0.1, 0], spine: [-0.08, 0, 0], chest: [-0.1, -0.05, 0], head: [-0.15, 0, 0], shoulderR: [-1.15, 0, -0.05], elbowR: [-1.75, 0, 0], weapon: [1.45, 0.0, 0], shoulderL: [-1.25, 0, 0.25], elbowL: [-1.5, 0, 0],
    hipL: [-0.15, 0, 0.12], kneeL: [0.2, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [0.12, 0, 0] },
  // 두 팔을 벌려 암룡을 부른다
  summon: { hips: [0, 0, 0], spine: [-0.3, 0, 0], chest: [-0.25, 0, 0], head: [-0.45, 0, 0], shoulderR: [-1.4, 0, -1.2], elbowR: [-0.2, 0, 0], weapon: [0.9, 1.6, 1.57], shoulderL: [-1.3, 0, 1.3], elbowL: [-0.3, 0, 0],
    hipL: [-0.3, 0, 0.25], kneeL: [0.5, 0, 0], hipR: [0.25, 0, -0.25], kneeR: [0.45, 0, 0] },
  thrust: { hips: [0, 0.35, 0], spine: [0.45, 0.3, 0], chest: [0.1, 0.3, 0], head: [-0.4, -0.5, 0], shoulderR: [-1.6, 0, -0.05], elbowR: [-0.05, 0, 0], weapon: [0.0, -0.05, 1.57], shoulderL: [0.4, 0, 0.5], elbowL: [-0.6, 0, 0],
    hipL: [-1.15, 0, 0.12], kneeL: [1.1, 0, 0], hipR: [0.8, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 용의 발톱: 왼쪽 건틀릿을 뒤로 젖혔다가 앞으로 할퀴기
  clawWind: { hips: [0, -0.45, 0], spine: [0.15, -0.4, 0], chest: [0.05, -0.45, 0], head: [0, 0.6, 0], shoulderL: [-0.6, 0, 1.2], elbowL: [-1.4, 0, 0], shoulderR: [0.2, 0, -0.4], elbowR: [-0.8, 0, 0], weapon: [-0.3, 2.6, 0.3] },
  clawSwipe: { hips: [0, 0.5, 0], spine: [0.35, 0.4, 0], chest: [0.1, 0.45, 0], head: [-0.2, -0.5, 0], shoulderL: [-1.5, 0, -0.35], elbowL: [-0.15, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [-0.3, 2.6, 0.3],
    hipL: [-0.9, 0, 0.12], kneeL: [0.9, 0, 0], hipR: [0.5, 0, -0.12], kneeR: [0.35, 0, 0] },
  // 공중에서 칼을 머리 뒤로 젖힘 (궁극기 마무리)
  leap: { hips: [-0.2, 0, 0], spine: [-0.35, 0, 0], chest: [-0.2, 0, 0], head: [-0.2, 0, 0], shoulderR: [-3.0, 0, -0.2], elbowR: [-0.7, 0, 0], weapon: [2.6, 0, 1.57], shoulderL: [-1.8, 0, 0.6], elbowL: [-0.4, 0, 0],
    hipL: [-1.4, 0, 0.1], kneeL: [1.9, 0, 0], footL: [-0.4, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.6, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 장검을 어깨에 걸치고 왼손으로 긴 머리를 쓸어 넘긴다
  idle2: { hips: [0, 0.3, 0], spine: [0.0, -0.1, 0], chest: [-0.05, -0.15, 0], head: [0.1, 0.25, 0.1], shoulderR: [-0.8, 0, -0.4], elbowR: [-1.9, 0, 0], weapon: [0.6, 2.85, 1.57], shoulderL: [-2.2, 0, 0.5], elbowL: [-2.1, 0, 0],
    hipL: [-0.12, 0, 0.1], kneeL: [0.18, 0, 0], hipR: [0.18, 0, -0.1], kneeR: [0.1, 0, 0] },
});

/* =====================================================================
   불꽃 이펙트 도구
   ===================================================================== */
const flame = (f, k) => { f.flameK = k; };
const pinkSlash = (f, o) => f.slashFx({ r: o.r || 2.1, color: o.color ?? PINK, life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
function embers(G, p, n = 14, sp = 5) { G.fx.burst(p, n, FLAMES, sp, { kind: 'ember', lk: 1.2 }); }
function pinkBurst(G, p, s = 1, up = false) {
  G.fx.burst(p, 24 * s | 0, FLAMES, 7 * s, up ? { dir: UP, spread: 1.1 } : {});
  G.fx.burst(p, 8 * s | 0, 0x1a0a20, 3 * s, { kind: 'smoke', sk: 1.2 * s });
  for (let i = 0; i < 9 * s; i++) G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3) * s, rand(-0.1, 0.4) * s, rand(-0.3, 0.3) * s)), { vel: [rand(-1, 1), rand(1.5, 4), rand(-1, 1)], life: rand(0.3, 0.6), size: rand(0.4, 0.8) * s, size1: 0.05, color: i % 3 === 0 ? VIOLET : PINK, alpha: 0.85, drag: 2 });
  G.fx.light(p.clone().setY(p.y + 0.6), PINK, 70 * s, 0.35, 10 * s);
}
function explosion(G, p, s = 1) {
  sfx('boom'); G.shake(0.22 * s); G.flash(0xff8ad0, 0.15 * s);
  G.fx.impact(p, PINK, 2.0 * s, UP);
  G.fx.ring(p, { r0: 0.2, r1: 2.2 * s, life: 0.35, color: VIOLET, billboard: true }); G.fx.ring(p, { r0: 0.1, r1: 1.4 * s, life: 0.25, color: 0xffffff, billboard: true });
  pinkBurst(G, p, 1.3 * s, true);
}
// 손에서 칼끝 쪽으로 불꽃이 모여든다 (힘 모으기)
function gatherFx(f, G, n = 2, R = 2.2) {
  const c = f.model.tipPos(new V3()).lerp(f.chest(new V3()), 0.5);
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), r = rand(1, R), p = c.clone().add(new V3(Math.cos(a) * r, rand(-0.6, 1.0), Math.sin(a) * r)), v = c.clone().sub(p).multiplyScalar(3.2); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.03, life: 0.3, color: i % 2 ? PINK : VIOLET, alpha: 0.9, drag: 0 }); }
}

/* =====================================================================
   바닥에 남는 업화 (흑염참의 궤적 · 유성 낙하 자국) — 밟으면 화상
   pts 는 나중에 더 늘어날 수 있다 (불꽃 파도가 지나가며 추가)
   ===================================================================== */
class BurnTrail {
  constructor(G, f, pts, o = {}) { this.G = G; this.f = f; this.pts = pts.map((p) => p.clone()); this.t = 0; this.life = o.life ?? 4.5; this.r = o.r ?? 0.8; this.k = o.k ?? 1; this.done = false; this.tick = 0; this.cd = {}; }
  add(p) { this.pts.push(p.clone()); }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt; if (this.t > this.life) { this.done = true; return; }
    const k = Math.min(1, (this.life - this.t) / 0.8) * Math.min(1, this.t / 0.15);
    for (const c of this.pts) {
      if (Math.random() < 0.55 * k + 0.05) { const a = rand(0, TAU), rr = rand(0, this.r * 0.8); G.fx.p(c.clone().add(new V3(Math.cos(a) * rr, 0.05, Math.sin(a) * rr)), { vel: [rand(-0.3, 0.3), rand(1.4, 2.8), rand(-0.3, 0.3)], size: rand(0.25, 0.5) * (0.6 + 0.6 * k) * this.k, size1: 0.04, life: rand(0.3, 0.55), color: Math.random() < 0.55 ? PINK : Math.random() < 0.6 ? VIOLET : CINDER, alpha: 0.85, drag: 1.5 }); }
      if (Math.random() < 0.06 * k) G.fx.p(c.clone().setY(c.y + 0.05), { size: this.r * 2.2, size1: this.r * 2.4, life: 0.4, color: 0x5a0a3a, alpha: 0.4, drag: 0 });
    }
    if (this.tick > 0) return; this.tick = 0.2;
    for (const t of f.foes()) {
      if (t.pos.y - (this.pts[0] ? this.pts[0].y : 0) > 0.6) continue;
      let on = false; for (const c of this.pts) if (Math.hypot(t.pos.x - c.x, t.pos.z - c.z) < this.r + 0.35 * t.scale) { on = true; break; }
      if (!on) continue; const last = this.cd[t.id] || -9; if (G.time - last < 0.5) continue; this.cd[t.id] = G.time;
      t.takeHit(f, { dmg: 6 * this.k, kb: [0.4, 0], stun: 0.14, daze: 4, hs: 0.02, noCrit: true, snd: 'hit' }, new V3().subVectors(t.pos, f.pos).setY(0).normalize());
      t.addStatus('burn', 3, 12 * this.k, f);
    }
  }
  kill() { this.done = true; }
}

/* ---------- 업화 파도: 업화가 가득 찼을 때 흑염참이 앞으로 날리는 불꽃 초승달 ---------- */
class FlameWave {
  constructor(G, f, trail) { this.G = G; this.f = f; this.trail = trail; this.t = 0; this.done = false; this.dir = f.fwd(new V3()); this.pos = f.local([0, 0.05, 1.2]); this.hit = new Set(); this.drop = 0; }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; if (this.t > 0.55) return this.kill();
    this.pos.addScaledVector(this.dir, 15 * dt); this.drop += 15 * dt;
    if (this.drop > 0.7) { this.drop = 0; if (this.trail && !this.trail.done) this.trail.add(this.pos.clone().setY(f.pos.y)); }
    const side = new V3(this.dir.z, 0, -this.dir.x);
    for (let i = 0; i < 6; i++) { const s = rand(-1.3, 1.3), p = this.pos.clone().addScaledVector(side, s).setY(this.pos.y + rand(0, 1.4) * (1 - Math.abs(s) * 0.5)); G.fx.p(p, { vel: [this.dir.x * 4, rand(1, 3), this.dir.z * 4], size: rand(0.35, 0.7), size1: 0.05, life: 0.3, color: i % 3 ? PINK : VIOLET, alpha: 0.8, drag: 2 }); }
    for (const t of f.foes()) { if (this.hit.has(t)) continue; const rel = new V3().subVectors(t.pos, this.pos); if (Math.abs(rel.dot(this.dir)) > 0.7 || Math.abs(rel.dot(side)) > 1.5 + 0.3 * t.scale || rel.y > 1.8) continue;
      this.hit.add(t); t.takeHit(f, { dmg: 44, kb: [5, 3], stun: 0.6, hs: 0.08, daze: 20, snd: 'big' }, this.dir); t.addStatus('burn', 4, 14, f); }
  }
  kill() { this.done = true; }
}

/* ---------- 흑염 초승달: 칼에서 날아가는 분홍 불꽃 초승달 (관통) ---------- */
class Crescent {
  constructor(G, f) { this.G = G; this.f = f; this.t = 0; this.done = false; this.dir = f.fwd(new V3()); this.pos = f.local([0, 1.05, 0.8]); this.hit = new Set(); this.side = new V3(this.dir.z, 0, -this.dir.x); }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; if (this.t > 0.42) return this.kill();
    this.pos.addScaledVector(this.dir, 17 * dt);
    if (Math.random() < 0.8) G.fx.slash(this.pos, { fwd: this.dir, normal: UP, r: 1.1, color: Math.random() < 0.5 ? PINK : VIOLET, life: 0.12 });
    for (let i = 0; i < 3; i++) G.fx.p(this.pos.clone().addScaledVector(this.side, rand(-0.9, 0.9)), { vel: [0, rand(0.5, 1.5), 0], size: 0.18, size1: 0.03, life: 0.3, color: i ? PINK : HOTP, alpha: 0.85, drag: 1 });
    for (const t of f.foes()) { if (this.hit.has(t) || !t.hurtHitSeg(this.pos.clone().addScaledVector(this.side, -0.9), this.pos.clone().addScaledVector(this.side, 0.9), 0.25)) continue; this.hit.add(t); t.takeHit(f, { dmg: 30, basic: true }, this.dir); }
    const W = G.stage && G.stage.world; if (W && W.solidAt(this.pos, 0.2)) this.kill();
  }
  kill() { this.done = true; }
}

/* =====================================================================
   암룡 (AbyssDragon): 기술을 쓸 때만 나타나는 그림자 불길의 용
   조형: 머리(주둥이 · 눈두덩 · 아래턱 · 이빨 · 뿔 넷) · 굽은 목 + 가시 · 가슴 · 꼬리 · 날개 둘(뼈 셋 · 들쭉날쭉한 막)
   재질: 검은 반투명 몸 + 가장자리가 분홍으로 일렁이는 프레넬 빛 (하나의 셰이더)
   ===================================================================== */
const DRG = (k, fn) => cached('ign:drg:' + k, fn);
const DRG_VS = `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
const DRG_FS = `uniform vec3 uColor; uniform vec3 uColor2; uniform float uOp; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ float nv = abs(dot(normalize(vN), normalize(vV))); float rim = pow(1.0 - nv, 2.2); float fl = 0.5 + 0.5 * sin(vW.y * 5.0 + uTime * 6.0 + vW.x * 3.0 + sin(vW.z * 4.0 + uTime * 3.0));
  vec3 core = mix(vec3(0.035, 0.012, 0.05), uColor2 * 0.25, fl * 0.35); vec3 c = mix(core, uColor * 1.5, clamp(rim * (0.75 + 0.5 * fl), 0.0, 1.0));
  gl_FragColor = vec4(c, uOp * (0.8 + 0.2 * rim)); }`;
function dragonGeo() {
  // 머리 단면: v 0 = 뒤통수 → 1 = 주둥이 끝 (+Z)
  const head = DRG('head', () => surf((u, v, p) => {
    const z = -0.15 + 1.05 * v, t = u * TAU, cx = Math.cos(t), sn = Math.sin(t), tipK = smooth(0.86, 1, v);
    const rx = (0.2 * (1 - 0.5 * v) + 0.05 * gauss(v - 0.32, 0.1)) * (1 - 0.85 * tipK), ry = (0.17 * (1 - 0.55 * v) + 0.035 * gauss(v - 0.35, 0.08) * Math.max(0, sn)) * (1 - 0.8 * tipK), cy = 0.04 * (1 - v) - 0.03 * v;
    p.set(cx * rx * (1 + 0.15 * gauss(v - 0.9, 0.06)), cy + sn * ry * (sn > 0 ? 1 : 0.55), z + tipK * 0.04 * cx * 0);
  }, 20, 26, { closedU: true }));
  const jaw = DRG('jaw', () => surf((u, v, p) => { const t = u * TAU, cx = Math.cos(t), sn = Math.sin(t), tipK = smooth(0.85, 1, v), rx = 0.15 * (1 - 0.45 * v) * (1 - 0.85 * tipK), ry = 0.05 * (1 - 0.3 * v) * (1 - 0.7 * tipK); p.set(cx * rx, sn * ry - 0.02 * v, 0.88 * v); }, 16, 18, { closedU: true }));
  const tooth = DRG('tooth', () => { const g = new THREE.ConeGeometry(0.014, 0.06, 6); g.translate(0, -0.03, 0); g.rotateX(Math.PI); return g; });
  const horns = [-1, 1].flatMap((s) => [
    DRG('horn' + s, () => strand([[s * 0.12, 0.12, -0.02], [s * 0.2, 0.24, -0.36], [s * 0.24, 0.32, -0.72], [s * 0.18, 0.5, -1.0]], 0.06, 0.004, { seg: 18, rad: 8 })),
    DRG('hornS' + s, () => strand([[s * 0.17, 0.0, 0.05], [s * 0.3, 0.05, -0.22], [s * 0.36, 0.14, -0.45]], 0.035, 0.003, { seg: 12, rad: 6 })),
    DRG('brow' + s, () => strand([[s * 0.13, 0.13, 0.42], [s * 0.18, 0.2, 0.24], [s * 0.2, 0.24, 0.08]], 0.02, 0.004, { seg: 10, rad: 6 })),
  ]);
  const neck = DRG('neck', () => strand([[0, 0.1, 0.15], [0, 0.42, 0.45], [0, 0.6, 0.8], [0, 0.62, 1.0]], 0.24, 0.13, { seg: 24, rad: 14 }));
  const spine = DRG('spike', () => { const g = new THREE.ConeGeometry(0.05, 0.22, 6); g.translate(0, 0.11, 0); return g; });
  const body = DRG('body', () => { const g = new THREE.SphereGeometry(1, 20, 14); g.scale(0.42, 0.38, 0.72); return g; });
  const tail = DRG('tail', () => strand([[0, 0, -0.4], [0, -0.15, -1.0], [0.2, -0.35, -1.6], [0.05, -0.45, -2.3], [-0.2, -0.4, -2.8]], 0.26, 0.012, { seg: 30, rad: 10 }));
  const wing = [-1, 1].map((s) => {
    const top = new THREE.CatmullRomCurve3([[0.05, 0.1, 0.05], [0.9, 0.5, -0.15], [1.7, 0.9, -0.1], [2.4, 0.8, -0.25], [3.0, 0.6, -0.4]].map(([x, y, z]) => new V3(s * x, y, z)));
    const bot = new THREE.CatmullRomCurve3([[0.15, -0.25, -0.45], [1.1, -0.55, -0.85], [1.45, -0.22, -0.75], [2.0, -0.65, -1.0], [2.25, -0.12, -0.8], [2.7, -0.25, -0.85], [2.8, 0.3, -0.55], [3.0, 0.6, -0.4]].map(([x, y, z]) => new V3(s * x, y, z)));
    const mem = DRG('mem' + s, () => surf((u, v, p) => { const a = top.getPointAt(u), b = bot.getPointAt(u); p.lerpVectors(a, b, v); p.z -= 0.08 * Math.sin(v * Math.PI) * Math.sin(u * Math.PI); }, 40, 8));
    const arm = DRG('arm' + s, () => strand(top.getPoints(20), 0.07, 0.015, { seg: 40, rad: 8 }));
    const wr = new V3(s * 1.7, 0.9, -0.1), fingers = [[2.7, -0.25, -0.85], [2.0, -0.65, -1.0], [1.1, -0.55, -0.85]].map(([x, y, z], i) => DRG(`fng${s}${i}`, () => strand([wr, wr.clone().lerp(new V3(s * x, y, z), 0.5).add(new V3(0, 0.08, 0)), new V3(s * x, y, z)], 0.035, 0.006, { seg: 14, rad: 6 })));
    const claw = DRG('wclaw' + s, () => { const g = new THREE.ConeGeometry(0.04, 0.22, 6); g.translate(0, 0.11, 0); return g; });
    return { mem, arm, fingers, claw, wr };
  });
  const eye = DRG('eye', () => { const g = new THREE.SphereGeometry(0.035, 10, 8); g.scale(1.3, 0.7, 1); return g; });
  return { head, jaw, tooth, horns, neck, spine, body, tail, wing, eye };
}
class AbyssDragon {
  // o: { life, scale, script(d, t, dt) }
  constructor(G, f, o = {}) {
    this.G = G; this.f = f; this.t = 0; this.life = o.life ?? 2; this.script = o.script; this.done = false; this.jawK = 0; this.flapA = 0.4; this.flapS = 5; this.headPitch = 0;
    const D = dragonGeo();
    this.mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(f.palette.glow ?? PINK) }, uColor2: { value: new THREE.Color(VIOLET) }, uOp: { value: 0 }, uTime: { value: 0 } }, vertexShader: DRG_VS, fragmentShader: DRG_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: CINDER, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const mk = (parent, geo, mat = this.mat, p = [0, 0, 0]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.frustumCulled = false; me.renderOrder = 8; parent.add(me); return me; };
    this.root = new THREE.Group(); this.root.scale.setScalar(o.scale ?? 1.6); G.scene.add(this.root);
    mk(this.root, D.body); mk(this.root, D.tail); mk(this.root, D.neck);
    for (let i = 0; i < 6; i++) { const t = i / 5, me = mk(this.root, D.spine, this.mat, [0, 0.36 + 0.3 * t - 0.05 * t * t, 0.2 + 0.7 * t]); me.rotation.x = -0.5 - 0.4 * t; me.scale.setScalar(1 - 0.4 * t); }
    for (let i = 0; i < 6; i++) { const me = mk(this.root, D.spine, this.mat, [0, 0.32 - 0.1 * i, -0.3 - 0.4 * i]); me.rotation.x = -1.0; me.scale.setScalar(1.1 - 0.15 * i); }
    this.head = new THREE.Group(); this.head.position.set(0, 0.62, 1.0); this.root.add(this.head);
    mk(this.head, D.head); for (const h of D.horns) mk(this.head, h);
    for (const s of [-1, 1]) mk(this.head, D.eye, this.eyeMat, [s * 0.15, 0.1, 0.36]);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const v = 0.35 + i * 0.1; mk(this.head, D.tooth, this.mat, [s * (0.15 * (1 - 0.5 * v) + 0.0) * 0.9, 0.04 * (1 - v) - 0.03 * v - 0.06, -0.15 + 1.05 * v]); }
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.07, 0.02); this.head.add(this.jaw); mk(this.jaw, D.jaw);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const v = 0.35 + i * 0.12, me = mk(this.jaw, D.tooth, this.mat, [s * 0.15 * (1 - 0.45 * v) * 0.85, 0.04, 0.88 * v]); me.rotation.x = Math.PI; }
    this.wings = D.wing.map((w, i) => { const s = i ? 1 : -1, g = new THREE.Group(); g.position.set(s * 0.3, 0.3, 0.05); this.root.add(g); mk(g, w.mem); mk(g, w.arm); for (const fg of w.fingers) mk(g, fg); const c = mk(g, w.claw, this.mat, w.wr.toArray()); c.rotation.z = -s * 0.6; g.userData.s = s; return g; });
    this.tmp = new V3(); G.spawn(this);
  }
  place(p, yaw, pitch = 0) { this.root.position.copy(p); this.root.rotation.set(pitch, yaw, 0, 'YXZ'); }
  mouth(out = new V3()) { this.root.updateMatrixWorld(true); return this.head.localToWorld(out.set(0, -0.06, 0.95)); }
  update(dt) {
    const G = this.G; this.t += dt; if (this.t > this.life) return this.kill();
    const op = Math.min(1, this.t / 0.3) * Math.min(1, (this.life - this.t) / 0.4);
    this.mat.uniforms.uOp.value = op * 0.92; this.mat.uniforms.uTime.value = G.time; this.eyeMat.opacity = op;
    if (this.script) this.script(this, this.t, dt);
    this.jaw.rotation.x = 0.55 * this.jawK; this.head.rotation.x = this.headPitch;
    const fa = Math.sin(this.t * this.flapS) * this.flapA;
    for (const w of this.wings) { const s = w.userData.s; w.rotation.set(0.1, 0, s * (0.15 + fa)); }
    // 몸에서 흩어지는 그림자 연기 · 분홍 불씨
    if (op > 0.2) { this.root.updateMatrixWorld(true);
      for (let i = 0; i < 2; i++) { const w = this.wings[i % 2]; w.localToWorld(this.tmp.set(w.userData.s * rand(0.5, 2.8), rand(-0.5, 0.8), rand(-0.9, 0))); G.fx.p(this.tmp, { vel: [rand(-0.5, 0.5), rand(0.2, 1), rand(-0.5, 0.5)], size: rand(0.4, 0.8), size1: 1.4, life: 0.7, color: 0x140818, alpha: 0.35 * op, drag: 1, smoke: true }); }
      this.root.localToWorld(this.tmp.set(rand(-0.4, 0.4), rand(-0.3, 0.4), rand(-2.4, 0.4))); G.fx.p(this.tmp, { vel: [rand(-0.5, 0.5), rand(0.5, 1.5), rand(-0.5, 0.5)], size: 0.12, size1: 0.02, life: 0.6, color: Math.random() < 0.6 ? PINK : VIOLET, alpha: 0.9 * op, drag: 1 }); }
  }
  kill() { if (this.done && !this.root.parent) return; this.done = true; this.G.scene.remove(this.root); this.mat.dispose(); this.eyeMat.dispose(); }
}
// 용의 입에서 뿜는 분홍 업화 (to 쪽으로)
function breath(G, from, to, n = 6, spd = 16) {
  const d = new V3().subVectors(to, from), L = d.length(); d.normalize();
  for (let i = 0; i < n; i++) { const sp = new V3(rand(-0.12, 0.12), rand(-0.12, 0.12), rand(-0.12, 0.12)), v = d.clone().add(sp).normalize().multiplyScalar(rand(spd * 0.8, spd * 1.1));
    G.fx.p(from.clone().addScaledVector(d, rand(0, 0.3)), { vel: [v.x, v.y, v.z], size: rand(0.15, 0.3), size1: rand(0.9, 1.5), life: Math.min(0.6, L / spd + 0.05), color: [HOTP, PINK, VIOLET][i % 3], alpha: 0.9, drag: 0.6 }); }
}

/* ---------- 유성 낙하: 하늘에서 떨어지는 업화의 불씨 (닿으면 범위 피해 + 잠깐 타오르는 자국) ---------- */
let _rockGeo = null;
class Meteor {
  constructor(G, f, c, delay, o = {}) {
    this.G = G; this.f = f; this.c = c.clone(); this.delay = delay; this.t = 0; this.done = false; this.dmg = o.dmg ?? 22; this.R = o.r ?? 1.5;
    const off = new V3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(rand(3, 5)); this.from = c.clone().add(off).setY(c.y + 14);
    if (!_rockGeo) { _rockGeo = new THREE.IcosahedronGeometry(0.22, 1); const pa = _rockGeo.attributes.position; for (let i = 0; i < pa.count; i++) { const k = 0.8 + 0.4 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1); pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k); } _rockGeo.computeVertexNormals(); }
    this.mat = new THREE.MeshStandardMaterial({ color: 0x1a0a14, emissive: PINK, emissiveIntensity: 1.4, roughness: 0.6, flatShading: true });
    this.mesh = new THREE.Mesh(_rockGeo, this.mat); this.mesh.visible = false; this.mesh.frustumCulled = false; G.scene.add(this.mesh); this.pos = this.from.clone();
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; if (this.t < this.delay) return;
    const k = Math.min(1, (this.t - this.delay) / 0.5); this.mesh.visible = true; this.pos.lerpVectors(this.from, this.c, k * k * 0.3 + k * 0.7); this.mesh.position.copy(this.pos); this.mesh.rotation.x += dt * 9; this.mesh.rotation.y += dt * 7;
    for (let i = 0; i < 3; i++) G.fx.p(this.pos.clone().add(new V3(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15))), { vel: [rand(-0.5, 0.5), rand(0, 1.5), rand(-0.5, 0.5)], size: rand(0.5, 0.9), size1: 0.08, life: rand(0.25, 0.45), color: [HOTP, PINK, VIOLET, CINDER][i + (Math.random() < 0.3 ? 1 : 0)], alpha: 0.85, drag: 2 });
    if (k < 1) return;
    explosion(G, this.c.clone().setY(this.c.y + 0.3), 0.75);
    G.fx.ring(this.c.clone().setY(this.c.y + 0.05), { normal: UP, r0: 0.2, r1: this.R * 1.2, life: 0.4, color: PINK });
    areaHit(f, this.c, this.R * f.scale, { dmg: this.dmg, kb: [2.6, 3.5], stun: 0.5, hs: 0.04, shake: 0.12, daze: 12, snd: 'big' }, 2.2);
    G.spawn(new BurnTrail(G, f, [this.c], { life: 1.8, r: 0.7, k: 0.6 }));
    this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mat.dispose(); }
}

/* =====================================================================
   기술 — 업화의 장검 · 흑염참(불타는 궤적) · 종언-유성낙하(암룡의 불씨 비) · 암룡의 낙인(전 능력 강화)
   ===================================================================== */
const inferno = (f) => f.inferno || 0;
const BRAND_T = 8;
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 칼을 거꾸로 쥐고 내리꽂아 업화 고리를 남긴다 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.3, 0, 0], head: [0.2, 0, 0], shoulderR: [-1.6, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.4, 0, 1.57], shoulderL: [-1.5, 0, 0.1], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: PINK, dmg: 72, r: 2.5,
    fx: (f, o, G, c) => { pinkBurst(G, c.clone().setY(c.y + 0.3), 1.2, true); const pts = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; pts.push(c.clone().add(new V3(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6))); } G.spawn(new BurnTrail(G, f, pts, { life: 2.6, r: 0.6, k: 0.7 })); },
  }),

  /* --- 기본 공격 (용기사 연격): 업화 찌르기 → 용의 발톱(건틀릿 세 줄 할퀴기) → 흑염 초승달 날리기 → 암룡의 이빨(용 머리가 덮쳐 물어뜯음) --- */
  light1: { dur: 0.4, cancel: 0.2, next: 'light2', trail: true, track: 0.1, ikOff: true,
    keys: [[0, { ...poses.thrust, shoulderR: [-0.5, 0, -0.3], elbowR: [-1.8, 0, 0], spine: [0.15, 0.2, 0] }], [0.09, 'thrust'], [0.24, {}], [0.4, 'base']], lunge: [[0.06, 0.16, 9]],
    start: (f) => flame(f, 0.7),
    ev: [[0.06, () => sfx('dash')], [0.1, (f, o, G) => { sfx('swing'); breath(G, f.local([0, 1.1, 0.6]), f.local([0, 1.1, 2.4]), 10, 14); }], [0.3, (f) => flame(f, 0)]],
    hits: [{ t0: 0.07, t1: 0.17, dmg: 30 }], end: (f) => flame(f, 0) },
  light2: { dur: 0.42, cancel: 0.22, next: 'light3', track: 0.1, ikOff: true,
    keys: [[0, 'clawWind'], [0.1, 'clawSwipe'], [0.26, {}], [0.42, 'base']], lunge: [[0.04, 0.13, 6.5]],
    ev: [[0.08, () => sfx('swing')], [0.11, (f, o, G) => { const fw = f.fwd(new V3()), side = new V3(fw.z, 0, -fw.x);
      for (let i = -1; i <= 1; i++) { const c = f.local([0, 1.15 + i * 0.16, 0.9]); G.fx.slash(c, { fwd: fw, normal: side.clone().multiplyScalar(-1).add(new V3(0, 0.6, 0)).normalize(), r: 0.9, color: i ? PINK : HOTP, life: 0.22 }); }
      embers(G, f.local([0, 1.1, 0.9]), 8, 3); }]],
    hits: [{ t0: 0.08, t1: 0.17, weapon: false, at: [0.15, 1.12, 0.85], r: 0.62, dmg: 34 }] },
  light3: { dur: 0.46, cancel: 0.26, next: 'light4', trail: true, track: 0.12, ikOff: true, move: 0.35,
    keys: [[0, 'windR'], [0.1, 'slashL'], [0.26, {}], [0.46, 'base']],
    start: (f) => flame(f, 0.8),
    ev: [[0.06, () => sfx('swing')], [0.1, (f, o, G) => { sfx('zap'); G.spawn(new Crescent(G, f)); }], [0.36, (f) => flame(f, 0)]],
    end: (f) => flame(f, 0) },
  light4: { dur: 0.72, track: 0.2, ikOff: true, noMove: true, shout: true,
    keys: [[0, 'summon'], [0.3, 'summon'], [0.4, { ...poses.thrust, weapon: [0.3, -0.3, 1.57] }], [0.56, {}], [0.72, 'base']],
    start: (f, o, G) => { sfx('charge'); flame(f, 1); const fw = f.fwd(new V3()), tgt = o && !o.gone && f.dist() < 4.5 ? o.pos.clone() : f.local([0, 0, 2.4]); tgt.y = f.pos.y; f.biteAt = tgt;
      new AbyssDragon(G, f, { life: 0.85, scale: 1.0, script: (d, t) => { const k = Math.min(1, t / 0.36), from = f.pos.clone().addScaledVector(fw, -1.4).add(new V3(0, 1.0, 0)), to = tgt.clone().addScaledVector(fw, -1.0).add(new V3(0, 0.35, 0));
        d.place(from.lerp(to, k * k * (3 - 2 * k)), Math.atan2(fw.x, fw.z), -0.15 * (1 - k)); d.jawK = t < 0.3 ? Math.min(1, t / 0.2) : Math.max(0, 1 - (t - 0.3) / 0.08); d.flapA = 0.7; d.flapS = 9; } }); },
    ev: [[0.38, (f, o, G) => { sfx('big'); sfx('heavy'); G.shake(0.18); const c = f.biteAt.clone().setY(f.pos.y + 0.9); pinkBurst(G, c, 0.8); for (const s of [-1, 1]) G.fx.slash(c, { fwd: new V3(0, s, 0), normal: f.right(new V3()), r: 0.9, color: s > 0 ? PINK : VIOLET, life: 0.22 });
        areaHit(f, f.biteAt, 1.1, { dmg: 50 }, 1.6); }], [0.6, (f) => flame(f, 0)]],
    end: (f) => flame(f, 0) },

  /* --- 우클: 흑염참 — 힘을 모은 뒤 장검을 크게 휘둘러 앞의 적을 베고, 바닥에 한동안 불타는 궤적을 남긴다. 업화가 가득 차면 불꽃 파도까지 --- */
  heavy: { dur: 1.12, cd: 'heavy', ikOff: true, trail: true, track: 0.42, aim: true, shout: true, noMove: true,
    keys: [[0, 'gather'], [0.44, 'gather'], [0.58, 'sweep'], [0.86, {}], [1.12, 'base']], lunge: [[0.44, 0.56, 7]],
    start: (f, o, G) => { f.empHeavy = inferno(f) >= 100; if (f.empHeavy) { f.inferno = 0; G.say(f, '"업화여, 모조리 삼켜라."'); } else G.say(f, '"재가 되어라."'); flame(f, 1); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.44) { gatherFx(f, G, f.empHeavy ? 4 : 2); if (Math.random() < 0.3) G.fx.p(f.model.tipPos(new V3()), { size: 0.5, size1: 0.1, life: 0.2, color: PINK, alpha: 0.6 }); } },
    ev: [[0.45, () => sfx('swing')], [0.5, (f, o, G) => {
      sfx('heavy'); sfx('boom'); G.shake(0.25); G.flash(PINK, 0.12);
      pinkSlash(f, { tilt: 0.12, r: 3.4, life: 0.34, at: [0, 1.0, 0.6] }); pinkSlash(f, { tilt: 0.05, r: 2.8, life: 0.3, color: VIOLET, at: [0, 0.7, 0.5] });
      // 휘두른 궤적을 따라 바닥에 업화가 남는다 (오른쪽 → 왼쪽 부채꼴 + 앞으로 한 줄)
      const pts = []; for (let i = 0; i <= 8; i++) { const a = -1.15 + 2.3 * (i / 8), R = 2.2; pts.push(f.local([-Math.sin(a) * R, 0, Math.cos(a) * R]).setY(f.pos.y)); }
      for (const d of [1.2, 3.2]) pts.push(f.local([0, 0, d]).setY(f.pos.y));
      const tr = new BurnTrail(G, f, pts, { life: 4.5, r: 0.85, k: f.empHeavy ? 1.3 : 1 }); G.spawn(tr);
      for (const p of pts) G.fx.p(p.clone().setY(p.y + 0.3), { size: 1.2, size1: 0.3, life: 0.4, color: PINK, alpha: 0.7 });
      if (f.empHeavy) { G.spawn(new FlameWave(G, f, tr)); G.fx.light(f.local([0, 1, 2]), PINK, 120, 0.5, 14); } }], [0.9, (f) => flame(f, 0)]],
    hits: [{ t0: 0.46, t1: 0.58, weapon: false, at: [0, 1.0, 1.7], r: 1.7, dmg: 70, kb: [5, 1.5], stun: 0.65, hs: 0.12, daze: 30, snd: 'big' }],
    end: (f) => { flame(f, 0); f.empHeavy = false; } },

  /* --- Shift: 종언 - 유성낙하 — 암룡이 하늘로 불꽃을 쏘아 올리고, 불씨가 유성처럼 주위 넓은 범위에 떨어진다 --- */
  s1: { dur: 1.15, cd: 's1', ikOff: true, aim: true, shout: true, noMove: true,
    keys: [[0, 'summon'], [0.3, 'summon'], [0.45, { ...poses.raise, weapon: [2.3, 0, 1.57] }], [0.95, {}], [1.15, 'base']],
    start: (f, o, G) => { G.say(f, '"종언이다 — 떨어져라, 불씨여."'); flame(f, 1); sfx('charge'); },
    ev: [[0.08, (f, o, G) => {
      const base = f.local([0, 3.4, -2.6]), yaw = f.yaw;
      new AbyssDragon(G, f, { life: 1.9, scale: 1.5, script: (d, t) => {
        const rise = smooth(0, 0.5, t); d.place(base.clone().setY(base.y + rise * 0.6 + 0.2 * Math.sin(t * 3)), yaw, -0.7 * rise); d.headPitch = -0.7 * rise; d.jawK = smooth(0.35, 0.5, t) * (1 - smooth(1.3, 1.6, t)); d.flapA = 0.35; d.flapS = 6;
        if (t > 0.45 && t < 1.3) { const m = d.mouth(new V3()); breath(G, m, m.clone().add(new V3(0, 12, 0)), 5, 24); }
        if (t > 0.45 && t < 0.5 && !d.roared) { d.roared = true; sfx('boom'); sfx('big'); G.shake(0.2); G.stage.flashSky && G.stage.flashSky(0.35); G.fx.light(d.mouth(new V3()), PINK, 140, 0.6, 20); }
      } });
      pinkBurst(G, f.local([0, 2.6, -1.6]), 1.2); sfx('zap'); }],
      [0.5, (f, o, G) => { G.fx.beam(f.local([0, 4, -2.2]), { r: 0.6, h: 30, life: 0.8, color: PINK }); }],
      [0.85, (f, o, G) => {
        // 불씨 비: 시전자 주위 반경 6.5m 에 14 개 (가까운 상대 쪽으로 몇 개 몰림)
        const c = f.pos.clone(), tg = o && !o.gone && o.state !== 'ko' && f.dist() < 8 ? o : null;
        for (let i = 0; i < 14; i++) { let p;
          if (tg && i % 3 === 0) p = tg.pos.clone().add(new V3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6)));
          else { const a = rand(0, TAU), r = 1.6 + Math.sqrt(Math.random()) * 4.9; p = c.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
          p.y = c.y; G.spawn(new Meteor(G, f, p, i * 0.09 + rand(0, 0.06))); }
        sfx('charge'); }],
      [1.0, (f) => flame(f, 0)]],
    end: (f) => flame(f, 0) },

  /* --- E: 암룡의 낙인 — 암룡과 힘을 나눠 8초 동안 전 능력 대폭 상승 (주는 피해 ×1.35 · 이동 ×1.25 · 받는 피해 ×0.7 · 쿨타임 ×1.3 · 초당 회복 8) --- */
  s2: { dur: 0.95, cd: 's2', ikOff: true, aim: false, shout: true,
    keys: [[0, 'brand'], [0.35, 'brand'], [0.5, 'summon'], [0.78, {}], [0.95, 'base']],
    start: (f, o, G) => { G.say(f, '"암룡이여 — 내게 낙인을."'); flame(f, 1); sfx('charge'); },
    ev: [[0.05, (f, o, G) => {
      const yaw = f.yaw;
      new AbyssDragon(G, f, { life: 1.15, scale: 1.25, script: (d, t) => {
        const k = smooth(0.55, 1.05, t), p = f.local([0, 2.2 - 1.0 * k, -1.8 + 1.6 * k]); d.place(p, yaw, -0.25); d.root.scale.setScalar(1.25 * (1 - 0.7 * k)); d.jawK = smooth(0.15, 0.3, t); d.flapA = 0.5; d.flapS = 8;
        if (t > 0.6) { const m = d.root.position; for (let i = 0; i < 3; i++) G.fx.p(m.clone().add(new V3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6))), { vel: [(f.pos.x - m.x) * 3, (f.pos.y + 1.1 - m.y) * 3, (f.pos.z - m.z) * 3], size: 0.25, size1: 0.05, life: 0.3, color: i ? PINK : VIOLET, alpha: 0.85, drag: 0 }); }
      } }); sfx('zap'); }],
      [0.25, () => { sfx('boom'); }],
      [0.55, (f, o, G) => {
        f.brandT = BRAND_T; for (const [k, v] of [['atk', 1.35], ['haste', 1.25], ['vuln', 0.7], ['regen', 8]]) f.addStatus(k, BRAND_T, v, f);
        sfx('ult'); G.flash(PINK, 0.25); G.shake(0.15); const c = f.pos.clone().setY(f.pos.y + 0.05);
        G.fx.ring(c, { normal: UP, r0: 0.3, r1: 3.2, life: 0.6, color: PINK }); G.fx.ring(c, { normal: UP, r0: 0.2, r1: 2.2, life: 0.45, color: VIOLET }); G.fx.ring(f.chest(new V3()), { r0: 0.2, r1: 1.8, life: 0.4, color: HOTP, billboard: true });
        G.fx.beam(c, { r: 1.1, h: 6, life: 0.6, color: VIOLET }); pinkBurst(G, f.chest(new V3()), 1.2, true); G.fx.light(f.chest(new V3()), PINK, 120, 0.6, 12); }],
      [0.85, (f) => flame(f, 0)]],
    end: (f) => flame(f, 0) },

  /* --- 극한 회피 뒤 좌클: 역린 — 상대 등 뒤로 불꽃처럼 번져 나타나 베고 화상을 남긴다 --- */
  counter: { dur: 0.6, aim: true, ikOff: true, trail: true,
    keys: [[0, 'windR'], [0.08, 'slashL'], [0.4, {}], [0.6, 'base']],
    start: (f) => flame(f, 1),
    ev: [[0, (f, o, G) => {
      const from = f.chest(); if (o) { const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(d, 1.3 + 0.3 * o.scale); f.yaw = Math.atan2(-d.x, -d.z); }
      pinkBurst(G, from, 0.8); for (let i = 0; i < 6; i++) G.fx.p(from.clone().lerp(f.chest(new V3()), i / 6), { size: 1.0, size1: 0.2, life: 0.3, color: i % 2 ? PINK : VIOLET, alpha: 0.6 }); sfx('dash'); G.flash(PINK, 0.18); f.model.resetCloth();
    }], [0.08, (f) => { sfx('heavy'); pinkSlash(f, { tilt: 0.15, r: 2.7, life: 0.32, color: HOTP }); }], [0.45, (f) => flame(f, 0)]],
    hits: [{ t0: 0.06, t1: 0.2, dmg: 90, kb: [6, 3], stun: 0.6, hs: 0.14, shake: 0.18, daze: 40, snd: 'big', br: 0.22 }],
    end: (f) => flame(f, 0) },

  /* --- Q: 종언 · 암룡강림 — 암룡이 내려와 대상을 업화로 불사르고, 공중으로 솟구친 이그네시아가 불타는 일격으로 끝낸다 --- */
  ult: { dur: 3.4, ult: true, aim: true, ikOff: true, shout: true, noMove: true,
    keys: [[0, 'summon'], [0.5, 'summon'], [0.7, 'brand'], [2.0, 'brand'], [2.12, 'leap'], [2.4, 'leap'], [2.5, 'slam'], [3.0, 'slam'], [3.4, 'base']],
    cam: [[0, { ref: 'self', p: [1.2, 1.2, 2.6], l: [0, 1.3, 0], fov: 42 }], [0.5, { ref: 'self', p: [2.4, 2.0, -1.5], l: [0, 2.6, -3], fov: 55 }],
      [0.9, { ref: 'target', p: [4.2, 1.6, 2.2], l: [0, 1.6, 0], fov: 58 }], [1.95, { ref: 'target', p: [3.6, 2.2, -2.6], l: [0, 1.4, 0], fov: 55 }],
      [2.15, { ref: 'target', p: [2.8, 2.6, 3.0], l: [0, 1.8, 0], fov: 50 }], [2.6, { ref: 'target', p: [3.0, 1.4, 3.2], l: [0, 0.9, 0], fov: 48 }], [3.4, { ref: 'target', p: [3.8, 2.0, 4.8], l: [0, 1.0, 0], fov: 52 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(0x3a0830, 0.38); flame(f, 1); sfx('charge'); G.say(f, '"엎드려라. 진홍의 여왕 앞이다."'); pinkBurst(G, f.chest(new V3()), 1); }],
      [0.25, (f, o, G) => {
        o = f.ultTgt || o; if (!o) return; const tgt = o;
        const yaw0 = Math.atan2(tgt.pos.x - f.pos.x, tgt.pos.z - f.pos.z), start = f.local([0, 6.5, -4.5]);
        f.ultDragon = new AbyssDragon(G, f, { life: 2.35, scale: 1.75, script: (d, t, dt) => {
          const hover = tgt.pos.clone().add(new V3(f.pos.x - tgt.pos.x, 0, f.pos.z - tgt.pos.z).setY(0).normalize().multiplyScalar(2.6)).setY(tgt.pos.y + 3.4);
          const k = smooth(0, 0.6, t), p = start.clone().lerp(hover, k); p.y += Math.sin(k * Math.PI) * 1.2;
          const look = new V3().subVectors(tgt.pos, p); d.place(p, Math.atan2(look.x, look.z), t < 0.6 ? -0.2 : 0.35); d.headPitch = t < 0.6 ? 0 : 0.35;
          d.jawK = smooth(0.55, 0.7, t) * (1 - smooth(1.6, 1.8, t)); d.flapA = t < 0.6 ? 0.5 : 0.3; d.flapS = t < 0.6 ? 9 : 6;
          // 업화 숨결: 대상을 불사른다 (0.1초마다 작은 피해 · 쓰러지지 않음)
          if (t > 0.65 && t < 1.65) { const m = d.mouth(new V3()), to = tgt.chest(new V3()); breath(G, m, to, 7, 18);
            G.fx.p(tgt.pos.clone().add(new V3(rand(-0.6, 0.6), 0.1, rand(-0.6, 0.6))), { vel: [rand(-1, 1), rand(2, 4), rand(-1, 1)], size: rand(0.5, 0.9), size1: 0.1, life: 0.4, color: Math.random() < 0.5 ? PINK : VIOLET, alpha: 0.85, drag: 2 });
            f.breathAcc = (f.breathAcc || 0) + dt; while (f.breathAcc >= 0.1) { f.breathAcc -= 0.1; if (!tgt.gone && tgt.state !== 'ko') tgt.takeHit(f, { dmg: 7, kb: [0, 0], stun: 99, hs: 0.0, nokill: true, noScale: true, force: true, noCrit: true, daze: 6, snd: 'hit' }, new V3().subVectors(tgt.pos, d.root.position).setY(0).normalize()); } }
          if (t > 0.62 && !d.roared) { d.roared = true; sfx('boom'); sfx('big'); G.shake(0.3); G.fx.light(d.mouth(new V3()), PINK, 160, 0.6, 20); }
          // 떠오르며 사라짐
          if (t > 1.75) { d.root.position.y += (t - 1.75) * 3; }
        } });
        sfx('zap'); G.stage.flashSky && G.stage.flashSky(0.3); }],
      [1.7, (f, o, G) => { o = f.ultTgt || o; if (!o) return; G.fx.beam(o.pos.clone(), { r: 1.2, h: 12, life: 0.6, color: PINK }); sfx('boom'); G.shake(0.25); o.pos.y = Math.max(o.pos.y, 0) + 0.0; explosion(G, o.chest(new V3()), 0.9); }],
      // 공중으로 솟구쳐 대상 앞 머리 위로
      [2.1, (f, o, G) => { o = f.ultTgt || o; if (!o) return; const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); f.pos.copy(o.pos).addScaledVector(d, -1.5).setY(o.pos.y + 2.2); f.vel.set(0, 1.5, 0); f.yaw = Math.atan2(d.x, d.z); f.model.resetCloth(); sfx('dash'); pinkBurst(G, f.chest(new V3()), 1); G.say(f, '"— 업화강림."'); }],
      [2.4, (f) => { f.vel.set(0, -22, 0); sfx('swing'); }],
      [2.5, (f, o, G) => { o = f.ultTgt || o; if (!o) return; o.release();
        sfx('heavy'); sfx('boom'); sfx('big'); G.flash(0xffc0e8, 0.55); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.45);
        const c = o.pos.clone().setY(o.pos.y + 0.05); explosion(G, o.chest(new V3()), 1.8); G.fx.ring(c, { normal: UP, r0: 0.5, r1: 7, life: 0.6, color: PINK }); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 4.5, life: 0.5, color: VIOLET });
        G.fx.beam(c, { r: 2.0, h: 18, life: 0.7, color: PINK }); G.fx.light(o.chest(new V3()), PINK, 200, 0.8, 22);
        pinkSlash(f, { tilt: 1.5, r: 3.4, life: 0.4, color: HOTP, at: [0, 1.2, 0.8] });
        o.takeHit(f, { dmg: 175, kb: [5, 10], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        o.addStatus('burn', 4, 18, f);
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) { t.takeHit(f, { dmg: 100, kb: [6, 8], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, o.pos).setY(0).normalize()); t.addStatus('burn', 3, 12, f); }
        const pts = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; pts.push(c.clone().add(new V3(Math.cos(a) * 2, 0, Math.sin(a) * 2))); } pts.push(c.clone());
        G.spawn(new BurnTrail(G, f, pts, { life: 3.5, r: 0.8, k: 1 }));
        G.slow(0.35, 0.5); }],
    ],
    tick: (f, o, G, t) => { if (t < 0.5) gatherFx(f, G, 3, 2.6); if (t > 2.1 && t < 2.5) { const p = f.model.tipPos(new V3()); G.fx.p(p, { size: 0.8, size1: 0.1, life: 0.25, color: PINK, alpha: 0.8 }); } },
    end: (f, o, G) => { G.setTint(0, 0); flame(f, 0); f.breathAcc = 0; const tg = f.ultTgt; if (tg && tg.held) tg.release(); f.ultTgt = null; f.ultDragon = null; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, PINK, big ? 1.7 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? HOTP : PINK, life: 0.2 });
  embers(G, p, big ? 12 : 5, 4);
  if (att.brandT > 0) G.fx.burst(p, 8, [VIOLET, 0x1a0a20], 5, { kind: 'glow', sk: 0.6 });
  // 업화: 맞힐 때마다 쌓인다 (가득 차면 다음 흑염참이 불꽃 파도를 날린다)
  if (h.dmg >= 8) att.inferno = Math.min(100, (att.inferno || 0) + h.dmg * 0.35);
}

// 낙인 버프 · 업화 상태 → 쿨타임 회복 · 오라 · 칼날 빛
function createModelWithBrand(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (f.brandT > 0) { f.brandT = Math.max(0, f.brandT - dt);
      if (f.root.visible && Math.random() < 0.6) { const a = rand(0, TAU), r = rand(0.3, 0.6); f.G.fx.p(f.pos.clone().add(new V3(Math.cos(a) * r, rand(0.1, 1.8), Math.sin(a) * r)), { vel: [0, rand(0.8, 1.8), 0], size: rand(0.2, 0.4), size1: 0.6, life: 0.6, color: 0x1a0820, alpha: 0.3, drag: 1, smoke: true }); }
      if (f.root.visible && Math.random() < 0.5) { const a = rand(0, TAU), r = rand(0.35, 0.55); f.G.fx.p(f.pos.clone().add(new V3(Math.cos(a) * r, rand(0.1, 1.6), Math.sin(a) * r)), { vel: [0, rand(1, 2), 0], size: 0.09, size1: 0.02, life: 0.5, color: Math.random() < 0.6 ? PINK : VIOLET, alpha: 0.9, drag: 1 }); } }
    f.cdMul = f.brandT > 0 ? 1.3 : 1;
    if (inferno(f) >= 100 && f.root.visible && Math.random() < 0.3) { const p = m.tipPos(new V3()); f.G.fx.p(p, { vel: [0, 0.8, 0], size: 0.12, size1: 0.02, life: 0.4, color: HOTP, alpha: 0.9, drag: 1 }); }
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist < 3.6 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist < 7 && f.cd.s1 <= 0 && Math.random() < 0.3) return 's1';
  if (dist < 6 && f.cd.s2 <= 0 && !(f.brandT > 0) && Math.random() < 0.3) return 's2';
  return null;
}

export default {
  id: 'ignethia', name: '이그네시아', short: '이그네시아', title: 'DRAGON KNIGHT · 진홍 업화의 여왕', scale: 1.0,
  desc: '근거리 · 업화 · 암룡 소환. 진홍 업화의 여왕이자 암룡을 거느린 용기사. 분홍 업화에 휩싸인 장검으로 베고, 흑염참으로 바닥에 불타는 궤적을 남기며, 그림자 불길의 암룡을 불러 하늘에서 불씨를 떨어뜨린다. 암룡의 낙인으로 잠시 모든 능력이 크게 오른다.',
  stats: { hp: 1000, speed: 8.0, jump: 11, crit: 0.25 },
  palettes: [{ accent: PINK, glow: PINK, key: 'p', band: '#2a0a1e' }, { accent: 0x5a8aff, glow: 0x5a8aff, key: 'b', hair: ['#5a6070', '#c8ccd8', '#f4f6ff'], band: '#0a1430' }],
  skills: { heavy: { name: '흑염참', cd: 8 }, s1: { name: '종언 - 유성낙하', cd: 15 }, s2: { name: '암룡의 낙인', cd: 22 }, ult: { name: '종언 · 암룡강림', sub: 'DRAGON KNIGHT' } },
  aiPick,
  onReset: (f) => { f.brandT = 0; f.inferno = 0; f.flameK = 0; f.empHeavy = false; f.breathAcc = 0; f.ultTgt = null; f.ultDragon = null; },
  resource: (f) => f.brandT > 0 ? { v: f.brandT / BRAND_T, label: '낙인', color: 0xb03aff, full: true } : inferno(f) >= 100 ? { v: 1, label: '업화', color: 0xffb0e0, full: true } : { v: inferno(f) / 100, label: '업화', color: 0xff3aa8 },
  moveList: [['좌클 ×4', '업화 찌르기 30 → 용의 발톱(건틀릿 세 줄 할퀴기) 34 → 흑염 초승달 날리기 30(관통) → 암룡의 이빨: 암룡 머리가 덮쳐 물어뜯음 50'], ['공중 좌클', '칼을 거꾸로 쥐고 내리꽂아 업화 고리를 남김 72'],
    ['우클 · 흑염참', '힘을 모은 뒤 크게 휘둘러 앞의 적 70 · 휘두른 궤적에 4.5초 동안 불타는 바닥 (밟으면 6 + 화상 초당 12). 업화가 가득 차면 불꽃 파도 44 추가'],
    ['Shift · 종언 - 유성낙하', '암룡이 하늘로 불꽃을 쏘아 올리고 주위 반경 6.5m 에 불씨 14 개가 떨어짐 (개당 22 · 범위 1.5m)'],
    ['E · 암룡의 낙인', '8초 동안 주는 피해 ×1.35 · 이동 ×1.25 · 받는 피해 ×0.7 · 쿨타임 회복 ×1.3 · 초당 회복 8'],
    ['Q · 종언 · 암룡강림', '암룡이 내려와 대상을 업화로 불사른 뒤 (0.1초마다 7) 하늘에서 내리꽂는 불타는 일격 175 + 화상'],
    ['업화', '맞힐수록 쌓이고 가득 차면 다음 흑염참이 불꽃 파도를 날림'], ['C (타이밍) · 극한 회피', '역린: 상대 등 뒤에 불꽃처럼 나타나 베기 90'], ['가만히', '장검을 어깨에 걸치고 긴 머리를 쓸어 넘김']],
  createModel: createModelWithBrand, poses, moves, hitFx,
};
