// 그레이브 (GRAVE) — 중거리 · 그래플러 · 독
// 사슬 갈고리로 사냥감을 끌어와 아가리 건틀릿으로 물어뜯는 흉터투성이 현상금 사냥꾼.
// 무기: 오른손의 긴 사슬 + 세 갈래 갈고리 (채찍처럼 휘두르고 · 던져서 낚아챈다) / 왼손의 아가리 건틀릿 (문다)
// 고유 게이지 「사냥」: 맞히고 · 낚아채고 · 독을 먹일수록 차오른다. 가득 차면 다음 사냥 갈고리의 물기가 세 번 물어뜯는 처형 물기가 된다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, CH, MAG, MAG2, PURP, POIS } from './reaper_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const TOX = [MAG, MAG2, POIS];

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤] — 채찍질할 때 사슬이 뻗는 방향)
   ===================================================================== */
const LUNGE_L = { hipL: [-0.85, 0, 0.15], kneeL: [0.9, 0, 0], hipR: [0.5, 0, -0.15], kneeR: [0.35, 0, 0] };
const poses = {
  // 기본: 넓게 버티고 서서 오른손에 사슬을 늘어뜨리고, 왼손 아가리 건틀릿을 배 앞에 든다
  base: { hips: [0, 0.12, 0], spine: [0.1, -0.06, 0], chest: [0.06, -0.06, 0], head: [-0.06, 0.1, 0],
    shoulderR: [-0.16, 0, -0.28], elbowR: [-0.42, 0, 0], weapon: [-1.45, 0.1, 0], shoulderL: [-0.38, 0, 0.32], elbowL: [-1.0, 0, 0],
    hipL: [-0.14, 0, 0.13], kneeL: [0.24, 0, 0], footL: [-0.08, 0, 0], hipR: [0.1, 0, -0.13], kneeR: [0.18, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.08, 0], spine: [0.32, 0.05, 0], chest: [0.08, 0.05, 0], head: [-0.25, 0, 0], shoulderR: [0.35, 0, -0.38], elbowR: [-0.5, 0, 0], weapon: [-1.2, 0, 0], shoulderL: [-0.5, 0, 0.38], elbowL: [-1.3, 0, 0],
    hipL: [0, 0, 0.04], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, -0.04], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0.1], kneeL: [1.6, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [1.3, 0, 0], shoulderL: [-0.9, 0, 0.6], elbowL: [-0.9, 0, 0], shoulderR: [-0.4, 0, -0.6], elbowR: [-0.5, 0, 0] },
  // 방어: 아가리 건틀릿을 얼굴 앞에 방패처럼 세운다
  guard: { hips: [0, 0.3, 0], spine: [0.15, 0.2, 0], chest: [0.08, 0.25, 0], head: [0.1, -0.35, 0], shoulderL: [-1.35, 0, -0.25], elbowL: [-1.55, 0, 0], shoulderR: [0.1, 0, -0.4], elbowR: [-0.9, 0, 0],
    hipL: [-0.55, 0, 0.22], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.22], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.55], elbowR: [-0.6, 0, 0], shoulderL: [0.4, 0, 0.65], elbowL: [-0.5, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.8, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.55], shoulderL: [-2.2, 0, 0.65], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.7, 0, -0.35], elbowR: [-0.4, 0, 0], shoulderL: [0.6, 0, 0.35], elbowL: [-0.6, 0, 0], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 갈고리 사슬을 어깨에 걸치고 아가리를 앞으로 내민다
  win: { hips: [0, 0.25, 0], spine: [0.0, 0.15, 0], chest: [-0.04, 0.2, 0], head: [0.12, -0.25, 0], shoulderR: [-2.3, 0, -0.5], elbowR: [-1.9, 0, 0], shoulderL: [-1.0, 0, 0.25], elbowL: [-1.3, 0, 0],
    hipL: [-0.1, 0, 0.13], kneeL: [0.12, 0, 0], hipR: [0.1, 0, -0.13], kneeR: [0.1, 0, 0] },
  portrait: { hips: [0, 0.35, 0], chest: [0, -0.15, 0], head: [0.12, 0.05, 0], shoulderL: [-1.25, 0, 0.0], elbowL: [-1.75, 0, 0], shoulderR: [-2.2, 0, -0.45], elbowR: [-1.9, 0, 0] },
  // 오래 가만히 있으면: 고개를 숙이고 사슬을 손목에 한 번 감아 쥔다
  idle2: { hips: [0, 0.25, 0], spine: [0.14, 0.1, 0], chest: [0.06, 0.12, 0], head: [0.35, -0.2, 0], shoulderR: [-0.7, 0, -0.1], elbowR: [-1.3, 0, 0], shoulderL: [-0.6, 0, 0.2], elbowL: [-1.4, 0, 0],
    hipL: [-0.12, 0, 0.14], kneeL: [0.2, 0, 0], hipR: [0.12, 0, -0.12], kneeR: [0.15, 0, 0] },

  /* --- 기술 자세 --- */
  // 사슬을 오른쪽 뒤로 감은 자세 → 왼쪽으로 휘두름
  windR: { hips: [0, -0.45, 0], spine: [0.1, -0.35, 0], chest: [0.05, -0.4, 0], head: [0, 0.55, 0], shoulderR: [-0.9, 0, -1.1], elbowR: [-0.3, 0, 0], weapon: [0.2, 2.3, 0], shoulderL: [-0.6, 0, 0.35], elbowL: [-1.3, 0, 0],
    hipL: [-0.5, 0, 0.18], kneeL: [0.6, 0, 0], hipR: [0.35, 0, -0.18], kneeR: [0.4, 0, 0] },
  whipL: { hips: [0, 0.5, 0], spine: [0.25, 0.4, 0], chest: [0.08, 0.45, 0], head: [0, -0.55, 0], shoulderR: [-1.35, 0, 0.35], elbowR: [-0.1, 0, 0], weapon: [-0.05, -1.9, 0], shoulderL: [0.3, 0, 0.5], elbowL: [-0.9, 0, 0], ...LUNGE_L },
  // 왼 주먹(아가리)을 뒤로 당긴 자세 → 내지르며 문다
  punchPrep: { hips: [0, 0.35, 0], spine: [0.05, 0.3, 0], chest: [0, 0.35, 0], head: [0, -0.5, 0], shoulderL: [0.25, 0, 0.5], elbowL: [-1.9, 0, 0], shoulderR: [-0.3, 0, -0.35], elbowR: [-0.6, 0, 0],
    hipL: [-0.3, 0, 0.15], kneeL: [0.45, 0, 0], hipR: [0.3, 0, -0.15], kneeR: [0.4, 0, 0] },
  punch: { hips: [0, -0.4, 0], spine: [0.3, -0.35, 0], chest: [0.1, -0.4, 0], head: [-0.2, 0.55, 0], shoulderL: [-1.6, 0, 0.1], elbowL: [-0.08, 0, 0], shoulderR: [0.3, 0, -0.45], elbowR: [-0.7, 0, 0],
    hipL: [-0.9, 0, 0.12], kneeL: [0.95, 0, 0], hipR: [0.55, 0, -0.12], kneeR: [0.3, 0, 0] },
  // 낮은 사슬 회전 (왼쪽 → 앞 → 오른쪽 → 뒤)
  spinWind: { hipY: -0.05, hips: [0, 0.5, 0], spine: [0.2, 0.4, 0], chest: [0.05, 0.45, 0], head: [0, -0.5, 0], shoulderR: [-1.1, 0, 0.45], elbowR: [-0.3, 0, 0], weapon: [-0.35, -2.2, 0], shoulderL: [-0.5, 0, 0.5], elbowL: [-1.1, 0, 0],
    hipL: [-0.6, 0, 0.25], kneeL: [0.9, 0, 0], hipR: [-0.25, 0, -0.25], kneeR: [0.8, 0, 0] },
  spinMid: { hipY: -0.07, hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.08, 0, 0], head: [0, 0, 0], shoulderR: [-1.3, 0, -0.6], elbowR: [-0.1, 0, 0], weapon: [-0.38, 0.3, 0] },
  spinEnd: { hipY: -0.06, hips: [0, -0.6, 0], spine: [0.2, -0.5, 0], chest: [0.05, -0.5, 0], head: [0, 0.6, 0], shoulderR: [-0.6, 0, -1.3], elbowR: [-0.1, 0, 0], weapon: [-0.32, 2.8, 0], shoulderL: [-0.2, 0, 0.6] },
  spinOver: { shoulderR: [0.2, 0, -1.15], weapon: [-0.25, 3.9, 0] },
  // 갈고리 던지기: 머리 위로 치켜든 자세 → 앞으로 내던짐 → 당기기
  throwPrep: { hips: [0, -0.4, 0], spine: [-0.05, -0.3, 0], chest: [-0.05, -0.35, 0], head: [0, 0.45, 0], shoulderR: [-2.6, 0, -0.45], elbowR: [-1.1, 0, 0], weapon: [0.9, 0.9, 0], shoulderL: [-0.9, 0, 0.3], elbowL: [-1.0, 0, 0],
    hipL: [-0.45, 0, 0.15], kneeL: [0.45, 0, 0], hipR: [0.4, 0, -0.15], kneeR: [0.35, 0, 0] },
  throw: { hips: [0, 0.35, 0], spine: [0.35, 0.3, 0], chest: [0.1, 0.3, 0], head: [-0.3, -0.45, 0], shoulderR: [-1.6, 0, -0.08], elbowR: [-0.05, 0, 0], weapon: [-0.02, -0.05, 0], shoulderL: [0.35, 0, 0.45], elbowL: [-0.7, 0, 0], ...LUNGE_L },
  yank: { hips: [0, -0.2, 0], spine: [-0.2, -0.15, 0], chest: [-0.15, -0.2, 0], head: [0.1, 0.2, 0], shoulderR: [-0.5, 0, -0.38], elbowR: [-1.7, 0, 0], weapon: [0.35, 0.15, 0], shoulderL: [-0.6, 0, 0.4], elbowL: [-1.3, 0, 0],
    hipL: [-0.2, 0, 0.15], kneeL: [0.6, 0, 0], hipR: [0.45, 0, -0.15], kneeR: [0.5, 0, 0] },
  // 아가리 물기: 크게 치켜들어 벌림 → 내리꽂으며 다묾
  biteOpen: { hips: [0, 0.4, 0], spine: [-0.05, 0.3, 0], chest: [-0.05, 0.35, 0], head: [-0.1, -0.4, 0], shoulderL: [-2.3, 0, 0.45], elbowL: [-1.2, 0, 0], shoulderR: [0.3, 0, -0.35], elbowR: [-1.4, 0, 0], weapon: [0.0, 0.1, 0],
    hipL: [-0.4, 0, 0.15], kneeL: [0.5, 0, 0], hipR: [0.35, 0, -0.15], kneeR: [0.4, 0, 0] },
  biteSlam: { hips: [0, -0.4, 0], spine: [0.5, -0.3, 0], chest: [0.15, -0.35, 0], head: [-0.35, 0.45, 0], shoulderL: [-1.35, 0, 0.05], elbowL: [-0.12, 0, 0], shoulderR: [0.45, 0, -0.4], elbowR: [-1.0, 0, 0], ...LUNGE_L },
  // 독병: 아가리로 물고 있다가 앞으로 내던짐
  vialPrep: { hips: [0, 0.45, 0], spine: [0.1, 0.35, 0], chest: [0.02, 0.4, 0], head: [0, -0.5, 0], shoulderL: [0.7, 0, 0.45], elbowL: [-1.2, 0, 0], shoulderR: [-0.4, 0, -0.35], elbowR: [-0.7, 0, 0],
    hipL: [-0.3, 0, 0.18], kneeL: [0.6, 0, 0], hipR: [0.4, 0, -0.18], kneeR: [0.45, 0, 0] },
  vialToss: { hips: [0, -0.3, 0], spine: [0.15, -0.3, 0], chest: [0.0, -0.35, 0], head: [-0.25, 0.35, 0], shoulderL: [-2.2, 0, 0.2], elbowL: [-0.25, 0, 0], shoulderR: [0.2, 0, -0.4], elbowR: [-0.6, 0, 0], ...LUNGE_L },
  // 사슬 선풍: 오른팔을 옆으로 뻗고 몸째 돈다
  spin: { hipY: -0.06, hips: [0, 0, 0], spine: [0.15, 0, 0], chest: [0.02, 0, 0], head: [-0.1, 0, 0], shoulderR: [-1.4, 0, -1.25], elbowR: [-0.12, 0, 0], weapon: [0.08, 1.57, 0], shoulderL: [-0.6, 0, 1.0], elbowL: [-0.9, 0, 0],
    hipL: [-0.4, 0, 0.35], kneeL: [0.7, 0, 0], hipR: [-0.3, 0, -0.35], kneeR: [0.65, 0, 0] },
  // 머리 위로 사슬을 치켜든 자세 → 내리꽂기
  liftOver: { hips: [0, -0.1, 0], spine: [-0.18, -0.05, 0], chest: [-0.12, -0.05, 0], head: [-0.35, 0.1, 0], shoulderR: [-3.0, 0, -0.25], elbowR: [-0.45, 0, 0], weapon: [1.35, 0.0, 0], shoulderL: [-0.4, 0, 0.6], elbowL: [-1.2, 0, 0],
    hipL: [-0.25, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [0.25, 0, -0.15], kneeR: [0.25, 0, 0] },
  smash: { hipY: -0.06, hips: [0, -0.2, 0], spine: [0.7, -0.1, 0], chest: [0.2, -0.1, 0], head: [-0.45, 0.1, 0], shoulderR: [-1.15, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [-0.85, 0, 0], shoulderL: [0.1, 0, 0.6], elbowL: [-0.9, 0, 0],
    hipL: [-1.1, 0, 0.14], kneeL: [1.3, 0, 0], hipR: [0.55, 0, -0.14], kneeR: [0.5, 0, 0] },
};

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const hunt = (f) => f.hunt || 0;
const addHunt = (f, v) => { f.hunt = Math.min(100, hunt(f) + v); };
function toxic(G, p, n = 12, sp = 4) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.25, 0.25), rand(-0.2, 0.3), rand(-0.25, 0.25))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.06, 0.13), size1: 0.02, life: rand(0.35, 0.7), color: TOX[i % 3], alpha: 0.9, drag: 2, grav: 3, flick: 0.3 }); }
function poisonBurst(G, p, s = 1) {
  G.fx.burst(p, Math.round(26 * s), TOX, 7 * s, { spread: Math.PI });
  G.fx.burst(p, Math.round(8 * s), [0x5a1a6a, 0x8a2aa0], 1.8 * s, { kind: 'smoke', sk: 1.2 * s });
  G.fx.burst(p, 4, MAG, 1.4, { kind: 'glow', sk: 0.9 * s });
  G.fx.ring(p.clone().setY(p.y + 0.05), { normal: UP, r0: 0.2, r1: 2.2 * s, life: 0.45, color: MAG });
  G.fx.light(p, MAG, 70 * s, 0.35, 12);
}
// 아가리가 다무는 순간: 위 · 아래에서 맞물리는 두 개의 호
function biteFx(G, p, fw, s = 1) {
  const right = new V3().crossVectors(fw, UP).normalize();
  for (const k of [1, -1]) G.fx.slash(p.clone().addScaledVector(UP, k * 0.18 * s), { fwd: UP.clone().multiplyScalar(-k), normal: right, r: 0.42 * s, color: k > 0 ? 0xffffff : MAG, life: 0.18, flip: k < 0 });
  G.fx.burst(p, Math.round(14 * s), [0xffffff, MAG2, 0xd01030], 5 * s, { dir: fw, spread: 1.2 });
  G.fx.ring(p, { r0: 0.05, r1: 0.7 * s, life: 0.2, color: MAG2, billboard: true });
}
// 사슬이 지나간 자국: 쇳빛 불꽃 + 자홍 잔광
function chainLine(G, a, b, w = 1) {
  const d = new V3().subVectors(b, a), L = d.length(), n = Math.max(3, Math.round(L / 0.35));
  for (let i = 0; i <= n; i++) G.fx.p(a.clone().addScaledVector(d, i / n), { vel: [rand(-0.5, 0.5), rand(0, 0.8), rand(-0.5, 0.5)], size: 0.16 * w, size1: 0.03, life: 0.3, color: i % 2 ? MAG : 0xc8b8c8, alpha: 0.8, drag: 1 });
}
const tipOf = (f) => (f.model.hookPos ? f.model.hookPos.clone() : f.chest(new V3()));

/* ---------- 사냥 갈고리: 날아가 꽂히면 끌어온다 (가까우면 상대를, 멀거나 무거우면 나를) ---------- */
class HookShot {
  constructor(G, f, target) {
    this.G = G; this.f = f; this.t = 0; this.done = false; this.phase = 'out'; this.hooked = null; this.mode = null;
    const hand = f.model.handPos(new V3()); this.from = hand.clone(); this.pos = hand.clone();
    const aim = target && !target.gone && target.state !== 'ko' && f.dist() < 11 ? target.chest(new V3()) : f.local([0, 1.2, 10]);
    this.dir = aim.sub(hand).normalize(); this.max = 10.5 * f.scale;
    f.hookShot = this; f.model.hookTarget = this.pos;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    if (f.state === 'ko' || f.gone) return this.kill();
    if (this.phase === 'out') {
      const step = 36 * dt; this.pos.addScaledVector(this.dir, step);
      G.fx.p(this.pos, { size: 0.3, size1: 0.05, life: 0.14, color: MAG, alpha: 0.6 });
      for (const t of f.foes()) if (t.hurtHit(this.pos, 0.34)) {
        const r = t.takeHit(f, { dmg: 28, kb: [0, 0], stun: 1.3, hs: 0.06, daze: 20, snd: 'hit' }, this.dir.clone().negate());
        sfx('block'); G.fx.burst(this.pos, 16, TOX, 5);
        if (r === 'hit' && f.act === moves.heavy) {
          this.hooked = t; this.phase = 'pull'; this.t = 0; addHunt(f, 20);
          const heavyFoe = t.scale > 1.2 || t.def.boss || (t.def.stats && t.def.stats.armor);
          this.mode = heavyFoe || f.dist() > 5.5 ? 'me' : 'them'; G.say(f, this.mode === 'me' ? '"도망칠 곳은 없다."' : '"이리 와."');
        } else { this.phase = 'back'; this.t = 0; }
        break;
      }
      const W = G.stage && G.stage.world;
      if (this.phase === 'out' && (this.pos.distanceTo(this.from) > this.max || this.pos.y < 0.05 || (W && W.solidAt(this.pos, 0.15)))) { this.phase = 'back'; this.t = 0; }
    } else if (this.phase === 'pull') {
      const t = this.hooked, k = Math.min(1, this.t / 0.24);
      if (!t || t.gone || t.state === 'ko' || f.act !== moves.heavy) { this.phase = 'back'; this.t = 0; }
      else {
        const gap = (1.15 + 0.3 * t.scale) * f.scale, a = Math.min(1, k * 0.5 + dt * 13);
        if (this.mode === 'them') { const dest = f.local([0, 0, gap]); t.pos.x += (dest.x - t.pos.x) * a; t.pos.z += (dest.z - t.pos.z) * a; t.vel.set(0, Math.min(t.vel.y, 0), 0); }
        else { const d = new V3().subVectors(f.pos, t.pos).setY(0).normalize(), dest = t.pos.clone().addScaledVector(d, gap); f.pos.x += (dest.x - f.pos.x) * a; f.pos.z += (dest.z - f.pos.z) * a; f.vel.set(0, 0, 0); f.faceOpp(); f.model.resetCloth(); G.fx.p(f.chest(new V3()), { size: 1.0, size1: 0.3, life: 0.18, color: PURP, alpha: 0.4 }); }
        this.pos.copy(t.chest(new V3()));
        if (this.t > 0.26) { this.phase = 'back'; this.t = 0; f.faceOpp(); if (f.act === moves.heavy) f.start(hunt(f) >= 100 ? 'heavyBite3' : 'heavyBite'); }
      }
    } else {
      const hand = f.model.handPos(new V3()); this.pos.lerp(hand, Math.min(1, dt * 16));
      if (this.pos.distanceTo(hand) < 0.25 || this.t > 0.5) return this.kill();
    }
  }
  kill() { if (this.done) return; this.done = true; const f = this.f; if (f.model.hookTarget === this.pos) f.model.hookTarget = null; if (f.hookShot === this) f.hookShot = null; }
}

/* ---------- 독병: 포물선으로 날아가 깨지며 자홍 독구름을 남긴다 ---------- */
let _vialGeo = null, _cloudTex = null;
function cloudTex() {
  if (_cloudTex) return _cloudTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,90,230,0.9)'); gr.addColorStop(0.5, 'rgba(170,40,200,0.5)'); gr.addColorStop(0.85, 'rgba(110,20,140,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, r = 30 + Math.random() * 80, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; g.fillStyle = 'rgba(255,160,250,0.25)'; g.beginPath(); g.arc(x, y, 3 + Math.random() * 8, 0, TAU); g.fill(); }
  _cloudTex = new THREE.CanvasTexture(c); _cloudTex.colorSpace = THREE.SRGBColorSpace; return _cloudTex;
}
class PoisonVial {
  constructor(G, f, from, to) {
    this.G = G; this.f = f; this.t = 0; this.done = false; this.pos = from.clone();
    const dist = Math.hypot(to.x - from.x, to.z - from.z), T = 0.42 + 0.035 * dist; this.g = 16;
    this.vel = new V3((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * this.g * T, (to.z - from.z) / T);
    if (!_vialGeo) _vialGeo = new THREE.LatheGeometry([[0, -0.07], [0.026, -0.066], [0.03, -0.04], [0.03, 0], [0.016, 0.018], [0.012, 0.032], [0, 0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    this.mat = new THREE.MeshBasicMaterial({ color: f.palette.glow ?? MAG });
    this.mesh = new THREE.Mesh(_vialGeo, this.mat); this.mesh.position.copy(this.pos); G.scene.add(this.mesh);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.vel.y -= this.g * dt; this.pos.addScaledVector(this.vel, dt);
    this.mesh.position.copy(this.pos); this.mesh.rotation.x += dt * 14; this.mesh.rotation.z += dt * 6;
    G.fx.p(this.pos, { size: 0.16, size1: 0.03, life: 0.25, color: MAG, alpha: 0.8 });
    let hit = false; for (const t of f.foes()) if (t.hurtHit(this.pos, 0.22)) { hit = true; break; }
    const W = G.stage && G.stage.world, gy = W ? W.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5) : 0;
    if (hit || this.pos.y <= gy + 0.03 || this.t > 2.5 || (W && W.solidAt(this.pos, 0.08))) this.shatter(gy);
  }
  shatter(gy) {
    const G = this.G, f = this.f, c = this.pos.clone(); c.y = Math.max(gy, Math.min(c.y, gy + 0.2));
    sfx('block'); sfx('boom'); G.shake(0.12); poisonBurst(G, c.clone().setY(c.y + 0.2), 1);
    G.fx.burst(c.clone().setY(c.y + 0.2), 14, [0xffffff, 0xf0d8ff], 6, { lk: 0.7 }); // 유리 조각
    areaHit(f, c, 1.5 * f.scale, { dmg: 32, kb: [1.5, 0], stun: 0.45, hs: 0.05, daze: 12, st: ['bleed', 3, 10] }, 1.5);
    G.spawn(new PoisonCloud(G, f, c, 4.5, 2.4));
    this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mat.dispose(); }
}
class PoisonCloud {
  constructor(G, f, c, life = 4.5, R = 2.4) {
    this.G = G; this.f = f; this.c = c.clone(); this.t = 0; this.life = life; this.R = R * f.scale; this.done = false; this.tick = 0;
    this.mat = new THREE.MeshBasicMaterial({ map: cloudTex(), color: f.palette.glow ?? MAG, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.R * 1.1, 40), this.mat); this.disc.rotation.x = -Math.PI / 2; this.disc.position.copy(this.c).setY(this.c.y + 0.05); G.scene.add(this.disc);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt;
    const k = Math.min(1, this.t / 0.3) * Math.min(1, (this.life - this.t) / 0.6); this.mat.opacity = 0.75 * k; this.disc.rotation.z += dt * 0.6;
    for (let i = 0; i < 2; i++) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * this.R, p = this.c.clone().add(new V3(Math.cos(a) * r, rand(0.05, 0.4), Math.sin(a) * r));
      if (Math.random() < 0.55) G.fx.p(p, { vel: [rand(-0.3, 0.3), rand(0.4, 1.0), rand(-0.3, 0.3)], size: rand(0.5, 0.9), size1: rand(1.2, 1.8), life: rand(0.8, 1.3), color: i ? 0x8a2aa0 : 0x5a1a6a, alpha: 0.32 * k, drag: 1, grav: -0.3, smoke: true });
      else G.fx.p(p, { vel: [0, rand(0.6, 1.6), 0], size: rand(0.05, 0.1), size1: 0.02, life: 0.7, color: TOX[i % 3], alpha: 0.9 * k, drag: 0.5 }); }
    if (this.tick <= 0 && this.t < this.life - 0.3) { this.tick = 0.5;
      for (const t of f.foes()) { const d = Math.hypot(t.pos.x - this.c.x, t.pos.z - this.c.z); if (d > this.R + 0.3 * t.scale || t.pos.y - this.c.y > 2.2) continue;
        if (t.addStatus) { t.addStatus('bleed', 2.0, 12, f); t.addStatus('slow', 0.8, 0.55, f); } addHunt(f, 3); } }
    if (this.t >= this.life) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.disc); this.disc.geometry.dispose(); this.mat.dispose(); }
}

/* =====================================================================
   기술 — 사슬 사냥꾼: 채찍처럼 휘두르는 갈고리 · 끌어당기기 · 아가리 물기 · 독
   move.whip = [[t0, t1, 사슬 길이]]: 그 구간 동안 사슬이 무기 방향으로 곧게 뻗는다 (판정도 그 길이)
   move.jaw  = [[t0, t1]]: 그 구간 동안 아가리 건틀릿이 벌어진다 (끝나는 순간 문다)
   ===================================================================== */
const BITE_AT = [-0.05, 1.3, 0.95];
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 사슬을 머리 위로 휘돌렸다가 갈고리째 내리꽂아 독을 튀긴다 --- */
  ...makePlunge({
    up: 'liftOver',
    fall: { ...poses.liftOver, spine: [0.35, 0, 0], chest: [0.15, 0, 0], head: [0.1, 0, 0], shoulderR: [-1.7, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.3, 0, 0], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'smash', color: MAG, dmg: 70, r: 2.4,
    fx: (f, o, G, c) => { poisonBurst(G, c.clone().setY(c.y + 0.2), 1.1); toxic(G, c.clone().setY(c.y + 0.3), 20, 6); },
  }),

  /* --- 기본 공격: 갈고리 채찍 → 아가리 주먹(물기) → 낮은 사슬 회전 → 갈고리 투척 · 낚아채기 --- */
  light1: { dur: 0.5, cancel: 0.28, next: 'light2', trail: true, track: 0.08, whip: [[0.02, 0.34, 2.3]],
    keys: [[0, { ...poses.windR, chest: [0.05, -0.3, 0] }], [0.1, 'windR'], [0.22, 'whipL'], [0.36, {}], [0.5, 'base']], lunge: [[0.04, 0.14, 5]],
    ev: [[0.1, () => sfx('swing')], [0.16, (f) => f.slashFx({ r: 2.3, color: MAG, life: 0.22, tilt: 0.05, at: [0, 1.25, 0.4] })]],
    hits: [{ t0: 0.1, t1: 0.24, dmg: 38, br: 0.2 }] },
  light2: { dur: 0.56, cancel: 0.32, next: 'light3', track: 0.12, jaw: [[0, 0.22]],
    keys: [[0, 'punchPrep'], [0.1, 'punchPrep'], [0.2, 'punch'], [0.4, {}], [0.56, 'base']], lunge: [[0.08, 0.18, 7]],
    ev: [[0.12, () => sfx('swing')], [0.22, (f, o, G) => { sfx('block'); sfx('hit'); biteFx(G, f.model.jawPos(new V3()), f.fwd(new V3()), 0.9); }]],
    hits: [{ t0: 0.14, t1: 0.21, weapon: false, at: BITE_AT, r: 0.52, dmg: 20 }, { t0: 0.22, t1: 0.29, weapon: false, at: BITE_AT, r: 0.55, dmg: 20 }] },
  light3: { dur: 0.62, cancel: 0.4, next: 'light4', trail: true, track: 0.06, whip: [[0.04, 0.44, 2.4]],
    keys: [[0, 'spinWind'], [0.1, 'spinWind'], [0.2, 'spinMid'], [0.3, 'spinEnd'], [0.38, 'spinOver'], [0.5, {}], [0.62, 'base']],
    ev: [[0.12, () => sfx('swing')], [0.26, () => sfx('swing')], [0.2, (f, o, G) => G.fx.ring(f.local([0, 0.45, 0]), { normal: UP, r0: 0.4, r1: 2.6 * f.scale, life: 0.3, color: MAG })]],
    hits: [{ t0: 0.12, t1: 0.4, dmg: 46, br: 0.22 }] },
  light4: { dur: 0.8, track: 0.14, trail: true, noMove: true, whip: [[0.14, 0.46, 3.4], [0.46, 0.6, 2.0]],
    keys: [[0, 'throwPrep'], [0.12, 'throwPrep'], [0.18, 'throw'], [0.4, 'throw'], [0.5, 'yank'], [0.66, {}], [0.8, 'base']],
    start: () => sfx('charge'),
    ev: [[0.15, () => { sfx('shot'); sfx('swing'); }], [0.24, (f, o, G) => chainLine(G, f.model.handPos(new V3()), tipOf(f), 0.8)],
      [0.47, (f, o, G) => { sfx('block'); sfx('heavy'); G.fx.burst(tipOf(f), 14, TOX, 5); }]],
    hits: [{ t0: 0.14, t1: 0.28, dmg: 30, br: 0.24 }, { t0: 0.46, t1: 0.56, dmg: 22, br: 0.26 }] },

  /* --- 우클: 사냥 갈고리 — 갈고리를 던져 낚아채고 끌어온 뒤 아가리로 문다 --- */
  heavy: { dur: 1.0, cd: 'heavy', aim: true, track: 0.16, noMove: true, shout: true,
    keys: [[0, 'throwPrep'], [0.14, 'throwPrep'], [0.2, 'throw'], [0.75, 'throw'], [1.0, 'base']],
    start: (f) => { sfx('charge'); },
    ev: [[0.18, (f, o, G) => { sfx('shot'); sfx('dash'); G.spawn(new HookShot(G, f, o)); }]],
    end: (f) => { if (f.hookShot && f.hookShot.phase !== 'pull') f.hookShot.phase = 'back'; } },
  heavyBite: { dur: 0.62, cat: 'heavy', aim: true, noMove: true, jaw: [[0, 0.17]],
    keys: [[0, 'biteOpen'], [0.16, 'biteSlam'], [0.38, {}], [0.62, 'base']],
    ev: [[0.17, (f, o, G) => { sfx('big'); sfx('block'); G.shake(0.2); biteFx(G, f.model.jawPos(new V3()), f.fwd(new V3()), 1.4); toxic(G, f.model.jawPos(new V3()), 10, 4); }]],
    hits: [{ t0: 0.16, t1: 0.25, weapon: false, at: BITE_AT, r: 0.66, dmg: 62, kb: [5, 2.5], stun: 0.7, hs: 0.12, shake: 0.15, daze: 34, snd: 'big' }] },
  // 사냥 게이지가 가득 찼을 때: 세 번 물어뜯는 처형 물기 (출혈)
  heavyBite3: { dur: 1.0, cat: 'heavy', aim: true, noMove: true, shout: true, jaw: [[0, 0.13], [0.24, 0.39], [0.5, 0.69]],
    keys: [[0, 'biteOpen'], [0.12, 'biteSlam'], [0.26, 'biteOpen'], [0.38, 'biteSlam'], [0.54, 'biteOpen'], [0.68, 'biteSlam'], [0.85, {}], [1.0, 'base']],
    start: (f, o, G) => { f.hunt = 0; G.say(f, '"사냥은 끝났다."'); },
    ev: [0.13, 0.39, 0.69].map((t, i) => [t, (f, o, G) => { sfx(i === 2 ? 'big' : 'heavy'); sfx('block'); G.shake(i === 2 ? 0.3 : 0.12); biteFx(G, f.model.jawPos(new V3()), f.fwd(new V3()), i === 2 ? 1.7 : 1.1); toxic(G, f.model.jawPos(new V3()), 12, 5); }]),
    hits: [{ t0: 0.12, t1: 0.2, weapon: false, at: BITE_AT, r: 0.66, dmg: 36, kb: [0.6, 0], stun: 0.5, hs: 0.08, daze: 16 },
      { t0: 0.38, t1: 0.46, weapon: false, at: BITE_AT, r: 0.66, dmg: 36, kb: [0.6, 0], stun: 0.5, hs: 0.08, daze: 16 },
      { t0: 0.68, t1: 0.76, weapon: false, at: BITE_AT, r: 0.7, dmg: 54, kb: [6, 3.5], stun: 0.8, hs: 0.15, shake: 0.2, daze: 34, snd: 'big', st: ['bleed', 4, 10] }] },

  /* --- Shift: 독병 투척 — 아가리에 문 독병을 내던져 자홍 독구름을 퍼뜨린다 (출혈 · 둔화) --- */
  s1: { dur: 0.62, cd: 's1', aim: true, track: 0.2, jaw: [[0.16, 0.3]],
    keys: [[0, 'vialPrep'], [0.14, 'vialPrep'], [0.24, 'vialToss'], [0.42, {}], [0.62, 'base']],
    start: (f, o, G) => { G.say(f, '"숨 쉬어 봐라."'); },
    ev: [[0.08, (f) => { const v = f.model.vials[2]; if (v) v.visible = false; }],
      [0.24, (f, o, G) => { sfx('swing'); const from = f.model.jawPos(new V3()); let to;
        if (o && !o.gone && o.state !== 'ko' && f.dist() < 10) to = o.pos.clone(); else to = f.local([0, 0, 6]);
        const d = new V3().subVectors(to, f.pos).setY(0), L = d.length(); if (L < 1.6) to = f.pos.clone().addScaledVector(L > 0.01 ? d.normalize() : f.fwd(new V3()), 1.6);
        to.y = Math.max(0, to.y); G.spawn(new PoisonVial(G, f, from, to)); }]],
    end: (f) => { const v = f.model.vials[2]; if (v) v.visible = true; } },

  /* --- E: 사슬 선풍 — 사슬을 뻗은 채 몸째 돌며 주위 적을 끌어당기고 갈아낸다 --- */
  s2: { dur: 1.5, cd: 's2', aim: false, trail: true, move: 0.45, shout: true, whip: [[0.08, 1.34, 2.6]],
    keys: [[0, 'spinWind'], [0.14, 'spin'], [1.3, 'spin'], [1.5, 'base']],
    start: (f, o, G) => { G.say(f, '"하나도 놓치지 않는다."'); sfx('charge'); f.spinTick = 0.1; },
    tick: (f, o, G, t, dt) => {
      if (t < 0.14 || t > 1.3) return;
      f.yaw += dt * 13; f.spinTick -= dt; const R = 2.9 * f.scale;
      if (Math.random() < 0.6) { const p = tipOf(f); G.fx.p(p, { vel: [0, 0.5, 0], size: 0.25, size1: 0.04, life: 0.25, color: MAG, alpha: 0.7 }); }
      for (const tg of f.foes()) { if (tg.held || tg.state === 'ko') continue; const d = new V3().subVectors(f.pos, tg.pos).setY(0), L = d.length(); if (L > 5.2 * f.scale || L < 1.5 * f.scale || tg.pos.y - f.pos.y > 2) continue; tg.pos.addScaledVector(d.normalize(), Math.min(L - 1.5 * f.scale, 4.5 * dt * (tg.scale > 1.2 ? 0.4 : 1))); }
      if (f.spinTick <= 0) { f.spinTick = 0.2; sfx('swing');
        for (const tg of f.foes()) { const L = Math.hypot(tg.pos.x - f.pos.x, tg.pos.z - f.pos.z); if (L > R + 0.4 * tg.scale || tg.pos.y - f.pos.y > 1.8) continue; tg.takeHit(f, { dmg: 12, kb: [0, 0], stun: 0.34, hs: 0.02, daze: 6, noCrit: true }, new V3().subVectors(tg.pos, f.pos).setY(0).normalize()); } }
    },
    ev: [[0.14, (f, o, G) => { sfx('dash'); G.fx.ring(f.local([0, 0.9, 0]), { normal: UP, r0: 0.4, r1: 3 * f.scale, life: 0.4, color: MAG }); }],
      [1.3, (f, o, G) => { f.faceOpp(); sfx('heavy'); sfx('big'); G.shake(0.25); const c = f.local([0, 1.0, 0]);
        for (let i = 0; i < 2; i++) G.fx.ring(c.clone().setY(c.y - 0.4 + i * 0.5), { normal: UP, r0: 0.6, r1: 3.6 * f.scale, life: 0.4, color: i ? 0xffffff : MAG });
        for (const tg of f.foes()) { const L = Math.hypot(tg.pos.x - f.pos.x, tg.pos.z - f.pos.z); if (L > 3.3 * f.scale || tg.pos.y - f.pos.y > 2) continue; tg.takeHit(f, { dmg: 46, kb: [7, 3.5], stun: 0.6, hs: 0.1, daze: 26, snd: 'big' }, new V3().subVectors(tg.pos, f.pos).setY(0).normalize()); } }]] },

  /* --- 극한 회피 뒤 좌클: 사냥개의 아가리 — 사슬로 순식간에 몸을 당겨 붙어 문다 --- */
  counter: { dur: 0.62, aim: true, noMove: true, jaw: [[0, 0.11]],
    keys: [[0, 'biteOpen'], [0.11, 'biteSlam'], [0.36, {}], [0.62, 'base']],
    ev: [[0, (f, o, G) => { const from = f.chest(new V3());
      if (o) { const d = new V3().subVectors(o.pos, f.pos).setY(0); if (d.lengthSq() < 1e-4) f.fwd(d); d.normalize(); f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(d, -(1.1 + 0.3 * o.scale) * f.scale); f.yaw = Math.atan2(d.x, d.z); }
      chainLine(G, from, f.chest(new V3()), 1.2); sfx('dash'); sfx('block'); G.flash(MAG, 0.18); f.model.resetCloth(); }],
      [0.11, (f, o, G) => { sfx('big'); G.shake(0.2); biteFx(G, f.model.jawPos(new V3()), f.fwd(new V3()), 1.5); }]],
    hits: [{ t0: 0.1, t1: 0.2, weapon: false, at: BITE_AT, r: 0.68, dmg: 90, kb: [6, 3], stun: 0.6, hs: 0.14, shake: 0.18, daze: 40, snd: 'big', st: ['bleed', 3, 10] }] },

  /* --- Q: 처형의 아가리 — 갈고리로 꿰어 끌어오고, 거듭 물어뜯은 뒤 사슬째 머리 위로 들어 땅에 메다꽂는다 (독 폭발) --- */
  ult: { dur: 3.3, ult: true, aim: true, shout: true, jaw: [[1.0, 1.1], [1.22, 1.32], [1.44, 1.54], [1.66, 1.76]],
    keys: [[0, 'throwPrep'], [0.3, 'throwPrep'], [0.36, 'throw'], [0.55, 'throw'], [0.72, 'yank'], [0.95, 'yank'],
      [1.0, 'punchPrep'], [1.1, 'punch'], [1.22, 'punchPrep'], [1.32, 'punch'], [1.44, 'punchPrep'], [1.54, 'punch'], [1.66, 'punchPrep'], [1.76, 'punch'],
      [1.95, 'liftOver'], [2.32, 'liftOver'], [2.48, 'smash'], [2.9, 'smash'], [3.3, 'base']],
    cam: [[0, { ref: 'self', p: [-1.1, 0.8, 2.3], l: [0, 1.2, 0], fov: 40 }], [0.32, { ref: 'self', p: [-0.7, 1.0, 1.6], l: [0, 1.4, 0.3], fov: 36 }],
      [0.45, { ref: 'self', p: [2.4, 1.6, -1.6], l: [0, 1.2, 2.5], fov: 54 }], [0.95, { ref: 'self', p: [2.0, 1.4, -0.4], l: [0, 1.25, 1.2], fov: 46 }],
      [1.85, { ref: 'self', p: [2.6, 1.2, 1.4], l: [0, 1.3, 1.0], fov: 44 }], [2.3, { ref: 'self', p: [3.4, 2.6, 0.6], l: [0, 1.8, 1.0], fov: 52 }],
      [2.6, { ref: 'self', p: [3.2, 1.4, 3.4], l: [0, 0.6, 1.8], fov: 50 }], [3.3, { ref: 'self', p: [3.8, 2.0, 4.4], l: [0, 0.8, 1.8], fov: 54 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; f.ultHookP = f.ultHookP || new V3(); if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(PURP, 0.32); sfx('charge'); G.say(f, '"네 목에 걸린 현상금… 내가 받아 가지."'); toxic(G, f.chest(new V3()), 16, 3); }],
      [0.34, (f, o, G) => { sfx('shot'); sfx('dash'); f.ultHook = 0; }],
      [0.46, (f, o, G) => { o = f.ultTgt; if (!o) return; sfx('block'); sfx('hit'); const p = o.chest(new V3()); G.fx.burst(p, 20, TOX, 6); G.flash(MAG, 0.2);
        o.takeHit(f, { dmg: 26, kb: [0, 0], stun: 99, hs: 0.06, nokill: true, noScale: true, force: true, noCrit: true, daze: 10, snd: 'hit' }, f.fwd(new V3()).negate()); addHunt(f, 20); }],
      ...[1.1, 1.32, 1.54, 1.76].map((t, i) => [t, (f, o, G) => { o = f.ultTgt; if (!o) return; sfx('block'); sfx(i === 3 ? 'big' : 'heavy'); G.shake(0.12);
        biteFx(G, f.model.jawPos(new V3()), f.fwd(new V3()), 1.2); toxic(G, o.chest(new V3()), 8, 4);
        o.takeHit(f, { dmg: 16, kb: [0, 0], stun: 99, hs: 0.04, nokill: true, noScale: true, force: true, noCrit: true, daze: 10, snd: 'hit' }, f.fwd(new V3())); }]),
      [1.95, (f, o, G) => { sfx('swing'); sfx('charge'); G.say(f, '"끝이다."'); }],
      [2.5, (f, o, G) => { o = f.ultTgt; if (!o) return; const c = f.local([0, 0, 1.9 * f.scale]); c.y = f.pos.y; o.pos.copy(c); o.vel.set(0, 0, 0); o.release(); f.ultHookP = null; f.model.hookTarget = null;
        sfx('boom'); sfx('big'); G.shake(0.6); G.flash(MAG2, 0.5); G.stage.flashSky && G.stage.flashSky(0.35); G.slow(0.35, 0.45);
        poisonBurst(G, c.clone().setY(c.y + 0.3), 2.2); toxic(G, c.clone().setY(c.y + 0.4), 50, 9); G.fx.burst(c, 30, 0x6a5a60, 6, { kind: 'dust', sk: 1.6 });
        G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.5, r1: 6.5, life: 0.6, color: MAG }); G.fx.beam(c, { r: 1.1, h: 7, color: MAG, life: 0.45 }); G.fx.light(c.clone().setY(c.y + 1), MAG, 200, 0.8, 22);
        o.takeHit(f, { dmg: 185, kb: [3, 8], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big', st: ['bleed', 4, 14] }, f.fwd(new V3()));
        if (o.addStatus && o.hp > 0) o.addStatus('slow', 2.5, 0.6, f);
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(c) < 5.5) t.takeHit(f, { dmg: 90, kb: [6, 7], stun: 0.8, force: true, noCrit: true, st: ['bleed', 3, 10] }, new V3().subVectors(t.pos, c).setY(0).normalize());
        G.spawn(new PoisonCloud(G, f, c, 3.0, 2.8)); }],
    ],
    tick: (f, o, G, t, dt) => {
      const tg = f.ultTgt, m = f.model; if (!tg || !f.ultHookP) return;
      const chestP = tg.chest(new V3());
      if (f.ultHook !== undefined && f.ultHook !== null && t < 0.46) { f.ultHook += dt; const hand = m.handPos(new V3()); f.ultHookP.lerpVectors(hand, chestP, Math.min(1, f.ultHook / 0.12)); m.hookTarget = f.ultHookP; }
      else if (t >= 0.46 && t < 2.5) {
        if (t < 0.95) { const dest = f.local([0, 0, 1.25 * f.scale]), k = Math.min(1, dt * 10); tg.pos.x += (dest.x - tg.pos.x) * k; tg.pos.z += (dest.z - tg.pos.z) * k; if (Math.random() < 0.4) chainLine(G, m.handPos(new V3()), chestP, 0.5); }
        else if (t >= 1.95) { // 사슬째 머리 위로 들어 올렸다가 앞으로 메다꽂음
          const k = Math.min(1, (t - 1.95) / 0.55), up = k < 0.68 ? Math.sin((k / 0.68) * Math.PI / 2) : Math.cos(((k - 0.68) / 0.32) * Math.PI / 2), fw = k < 0.68 ? 1.25 - 0.6 * (k / 0.68) : 0.65 + 1.25 * ((k - 0.68) / 0.32);
          const p = f.local([0, up * 2.5 * f.scale, fw * f.scale]); tg.pos.copy(p); tg.vel.set(0, 0, 0);
          if (Math.random() < 0.6) G.fx.p(tg.chest(new V3()), { size: 0.5, size1: 0.1, life: 0.25, color: MAG, alpha: 0.6 });
        }
        f.ultHookP.copy(tg.chest(new V3())); m.hookTarget = f.ultHookP;
      }
    },
    end: (f, o, G) => { G.setTint(0, 0); f.model.hookTarget = null; f.ultHook = null; const tg = f.ultTgt; if (tg && tg.held) tg.release(); f.ultTgt = null; } },
};
// 채찍(사슬 뻗기) · 아가리 구간 처리를 모든 기술에 붙인다
moves.plunge.whip = [[0.1, 4, 1.5]]; moves.plungeLand.whip = [[0, 0.3, 1.5]];
for (const k in moves) {
  const mv = moves[k], tk = mv.tick, en = mv.end;
  if (!mv.whip && !mv.jaw) continue;
  mv.tick = (f, o, G, t, dt) => {
    if (mv.whip) { let on = 0; for (const [a, b, L] of mv.whip) if (t >= a && t < b) { on = 1; f.whipL = L; } f.whipK = on; }
    if (mv.jaw) { let on = 0; for (const [a, b] of mv.jaw) if (t >= a && t < b) on = 1; f.jawK = on; }
    tk && tk(f, o, G, t, dt);
  };
  mv.end = (f, o, G) => { f.whipK = 0; f.jawK = 0; en && en(f, o, G); };
}

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60, col = att.palette.glow ?? MAG;
  G.fx.impact(p, col, big ? 1.6 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.4 : 0.95, color: col, life: 0.18 });
  G.fx.burst(p, big ? 10 : 5, [0xd01030, 0x8a0a20], 4, { dir, spread: 0.9 });
  // 사냥 게이지: 맞힐 때마다 쌓인다 (가득 차면 다음 사냥 갈고리가 처형 물기)
  addHunt(att, h.dmg * 0.12);
}

function aiPick(f, o, dist) {
  if (dist > 3.5 && dist < 9 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist > 2.5 && dist < 9 && f.cd.s1 <= 0 && Math.random() < 0.3) return 's1';
  if (dist < 3.2 && f.cd.s2 <= 0 && Math.random() < 0.25) return 's2';
  return null;
}

function onReset(f) {
  f.hunt = 0; f.whipK = 0; f.whipL = CH.whip; f.jawK = 0; f.ultTgt = null; f.ultHook = null; f.ultHookP = null; f.hookShot = null; f.spinTick = 0;
  const m = f.model; if (m) { m.hookTarget = null; m.chainOn = true; m.weaponOut = false; if (m.vials) m.vials.forEach((v) => (v.visible = true)); }
}

export default {
  id: 'reaper', name: '그레이브', short: '그레이브', title: '사슬 사냥꾼', scale: 1.04,
  desc: '중거리 · 그래플러 · 독. 사슬 갈고리로 사냥감을 끌어오는 흉터투성이 현상금 사냥꾼. 긴 사슬을 채찍처럼 휘두르고, 갈고리를 던져 낚아채 끌어온 뒤 왼손의 아가리 건틀릿으로 물어뜯는다. 독병을 깨뜨려 자홍빛 독구름을 퍼뜨리고, 사냥 게이지가 가득 차면 물기가 세 번 물어뜯는 처형 물기가 된다.',
  stats: { hp: 1050, speed: 7.4, jump: 10, crit: 0.2 },
  palettes: [{ accent: MAG, glow: MAG, cloth: ['#6a2c86', '#3a1648'], tag: 'a' }, { accent: 0x5aff6a, glow: 0x5aff6a, cloth: ['#2a5a46', '#10302a'], tag: 'b' }],
  skills: { heavy: { name: '사냥 갈고리', cd: 8 }, s1: { name: '독병 투척', cd: 9 }, s2: { name: '사슬 선풍', cd: 12 }, ult: { name: '처형의 아가리', sub: 'CHAIN HUNTER' } },
  aiPick, aimRange: 9, aiRange: [1.6, 2.8], onReset,
  resource: (f) => hunt(f) >= 100 ? { v: 1, label: '사냥', color: MAG2, full: true } : { v: hunt(f) / 100, label: '사냥', color: MAG },
  moveList: [['좌클 ×4', '갈고리 채찍 38 → 아가리 주먹 20 + 물기 20 → 낮은 사슬 회전 46 → 갈고리 투척 30 · 낚아채기 22 (사슬이 닿는 중거리)'], ['공중 좌클', '사슬을 휘돌렸다가 갈고리째 내리꽂아 독을 튀김'],
    ['우클 · 사냥 갈고리', '갈고리를 던져 꽂히면 끌어온다 28 (가까우면 상대를, 멀거나 무거운 상대면 내 몸을) → 아가리로 물기 62. 사냥 게이지가 가득 차면 세 번 물어뜯는 처형 물기 36 · 36 · 54 + 출혈'],
    ['Shift · 독병 투척', '아가리에 문 독병을 던져 깨뜨림 32 + 출혈 → 4.5초 동안 자홍 독구름 (안에 있으면 출혈 초당 12 · 둔화)'],
    ['E · 사슬 선풍', '사슬을 뻗은 채 몸째 돌며 주위 적을 끌어당기고 0.2초마다 12 → 마지막에 크게 휘둘러 날려 보냄 46 (돌면서 이동 가능)'],
    ['Q · 처형의 아가리', '갈고리로 꿰어 끌어옴 26 → 아가리로 네 번 물어뜯기 16 ×4 → 사슬째 머리 위로 들어 땅에 메다꽂고 독 폭발 185 + 출혈 · 둔화'],
    ['사냥', '맞히고 · 낚아채고 · 독을 먹일수록 쌓이고, 가득 차면 다음 사냥 갈고리가 처형 물기'], ['C (타이밍) · 극한 회피', '사냥개의 아가리: 사슬로 순식간에 몸을 당겨 붙어 물기 90 + 출혈'], ['가만히', '고개를 숙이고 사슬을 쥔 채 기다림']],
  createModel, poses, moves, hitFx,
};
