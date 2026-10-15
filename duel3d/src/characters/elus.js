// 엘루스 (ELUS) — 근거리 중량급 · 붙잡기 · 차지 포격
// 유적에서 유물을 훔쳐 내다 파는 도굴꾼. 훔친 고대 유물 건틀릿을 어깨에 메고 다니며 몽둥이처럼 휘두르고, 결정 핵을 열어 포격한다.
// 무기: 거대한 유물 건틀릿 — 맞힐수록 '유물' 게이지가 차고, 가득 차면 다음 유물 포격이 폭주 포격이 된다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, clamp, sfx } from '../core.js';
import { createModel, TEAL, TEAL2, DEEPT, GOLDR, CREAM, RL } from './elus_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const poses = {
  // 기본: 설정화처럼 오른손을 어깨 높이로 들어 유물 자루를 쥐고, 거대한 손은 오른 다리 앞으로 늘어뜨림 · 왼손은 허리에
  base: { hips: [0, 0.12, 0.03], spine: [0.02, -0.06, -0.02], chest: [-0.02, -0.08, 0], head: [0.04, 0.12, 0.06],
    shoulderR: [-0.3, 0, -0.42], elbowR: [-1.75, 0, 0], weapon: [-0.85, 0.55, 0.35], shoulderL: [0.15, 0, 0.5], elbowL: [-1.35, 0.6, 0],
    hipL: [-0.12, 0, 0.1], kneeL: [0.16, 0, 0], footL: [-0.06, 0, 0], hipR: [0.08, 0, -0.08], kneeR: [0.08, 0, 0], footR: [0, 0, 0] },
  // 달리기: 유물을 오른 어깨에 걸쳐 메고 (거대한 손이 등 뒤 위)
  run: { hips: [0, -0.1, 0], spine: [0.34, 0.05, 0], chest: [0.06, 0.05, 0], head: [-0.22, 0, 0], shoulderR: [-0.3, 0, -0.25], elbowR: [-2.2, 0, 0], weapon: [0.55, 2.75, 0], shoulderL: [0.3, 0, 0.15], elbowL: [-1.1, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.35, 0, 0], kneeR: [1.3, 0, 0], shoulderR: [-0.3, 0, -0.25], elbowR: [-2.2, 0, 0], weapon: [0.6, 2.7, 0], shoulderL: [-0.6, 0, 0.7], elbowL: [-0.6, 0, 0] },
  // 방어: 거대한 손을 세워 방패처럼 앞에 (손등 결정이 앞)
  guard: { hips: [0, -0.15, 0], spine: [0.15, 0.1, 0], chest: [0.05, 0.1, 0], shoulderR: [-0.9, 0, -0.05], elbowR: [-1.5, 0, 0], weapon: [0.95, 0.12, 3.14], shoulderL: [-1.0, 0, -0.2], elbowL: [-1.3, 0, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.2, 0, -0.5], elbowR: [-0.9, 0, 0], weapon: [-0.6, 0.9, 0.3], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.4, 0, -0.9], elbowR: [-0.5, 0, 0], weapon: [0.3, 1.5, 0.4], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.74, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-1.6, 0, -0.9], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, 1.2, 1.57],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [-0.3, 0, -0.25], elbowR: [-2.2, 0, 0], weapon: [0.4, 2.8, 0], shoulderL: [0.6, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 유물을 어깨에 메고 한 손으로 동전을 튕기듯
  win: { hips: [0, 0.25, 0.04], spine: [-0.04, 0.1, 0], chest: [-0.06, 0.15, 0], head: [-0.15, -0.2, 0.05], shoulderR: [-0.3, 0, -0.25], elbowR: [-2.2, 0, 0], weapon: [0.55, 2.75, 0], shoulderL: [-2.3, 0, 0.35], elbowL: [-0.9, 0, 0],
    hipL: [-0.1, 0, 0.1], kneeL: [0.12, 0, 0], hipR: [0.12, 0, -0.06], kneeR: [0.1, 0, 0] },
  portrait: { hips: [0, 0.3, 0], chest: [0, -0.2, 0], head: [0.04, 0.15, 0], shoulderR: [-0.3, 0, -0.3], elbowR: [-2.1, 0, 0], weapon: [0.6, 2.6, 0.2], shoulderL: [0.15, 0, 0.5], elbowL: [-1.35, 0.6, 0] },
  // 역수 휘두르기: 왼쪽으로 감은 유물 → 오른쪽 바깥으로 손등 치기
  windL: { hips: [0, 0.55, 0], spine: [0.15, 0.4, 0], chest: [0.05, 0.45, 0], head: [0, -0.55, 0], shoulderR: [-1.1, 0, 0.55], elbowR: [-0.9, 0, 0], weapon: [0.15, -1.6, 1.57], shoulderL: [0.2, 0, 0.4], elbowL: [-1.2, 0, 0],
    hipL: [-0.4, 0, 0.12], kneeL: [0.5, 0, 0], hipR: [0.3, 0, -0.12], kneeR: [0.35, 0, 0] },
  backhand: { hips: [0, -0.45, 0], spine: [0.15, -0.35, 0], chest: [0.05, -0.4, 0], head: [0, 0.5, 0], shoulderR: [-1.3, 0, -1.0], elbowR: [-0.15, 0, 0], weapon: [0.05, 1.95, 1.57], shoulderL: [-0.3, 0, 0.5], elbowL: [-0.9, 0, 0],
    hipL: [-0.7, 0, 0.12], kneeL: [0.75, 0, 0], hipR: [0.45, 0, -0.12], kneeR: [0.35, 0, 0] },
  // 두 손으로 머리 위로 치켜듦 → 앞으로 내려찍기
  raise: { hips: [0, 0, 0], spine: [-0.2, 0, 0], chest: [-0.12, 0, 0], head: [-0.25, 0, 0], shoulderR: [-2.9, 0, -0.1], elbowR: [-0.4, 0, 0], weapon: [2.2, 0, 3.14], shoulderL: [-2.7, 0, 0.25], elbowL: [-0.6, 0, 0], hipL: [-0.25, 0, 0.1], kneeL: [0.25, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  slam: { hipY: -0.06, hips: [0, -0.1, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.15, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-0.95, 0, 0], shoulderL: [-1.0, 0, 0.12], elbowL: [-0.2, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.55, 0, -0.12], kneeR: [0.5, 0, 0] },
  // 단검 · 발차기 (유물은 어깨에 멘 채)
  stab: { hips: [0, -0.35, 0], spine: [0.25, -0.3, 0], chest: [0.05, -0.3, 0], head: [-0.15, 0.45, 0], shoulderR: [-0.3, 0, -0.25], elbowR: [-2.2, 0, 0], weapon: [0.6, 2.7, 0], shoulderL: [-1.55, 0, -0.15], elbowL: [-0.08, 0, 0], handL: [0, 0, 0],
    hipL: [-0.95, 0, 0.12], kneeL: [0.9, 0, 0], hipR: [0.55, 0, -0.12], kneeR: [0.35, 0, 0] },
  slashD: { hips: [0, 0.35, 0], spine: [0.2, 0.3, 0], chest: [0.05, 0.35, 0], head: [-0.1, -0.4, 0], shoulderR: [-0.3, 0, -0.25], elbowR: [-2.2, 0, 0], weapon: [0.6, 2.7, 0], shoulderL: [-1.2, 0, 1.0], elbowL: [-0.2, 0, 0],
    hipL: [-0.6, 0, 0.12], kneeL: [0.6, 0, 0], hipR: [0.4, 0, -0.12], kneeR: [0.3, 0, 0] },
  kickC: { hips: [0, -0.1, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [0.15, 0, 0], shoulderR: [-0.3, 0, -0.35], elbowR: [-2.2, 0, 0], weapon: [0.6, 2.7, 0], shoulderL: [0.3, 0, 0.6], elbowL: [-1.0, 0, 0],
    hipL: [-0.15, 0, 0.12], kneeL: [0.25, 0, 0], hipR: [-1.0, 0, 0], kneeR: [1.9, 0, 0] },
  kick: { hips: [0, -0.15, 0], spine: [-0.3, 0, 0], chest: [-0.15, 0, 0], head: [0.3, 0, 0], shoulderR: [-0.3, 0, -0.4], elbowR: [-2.2, 0, 0], weapon: [0.6, 2.7, 0], shoulderL: [0.4, 0, 0.7], elbowL: [-0.8, 0, 0],
    hipL: [-0.05, 0, 0.12], kneeL: [0.2, 0, 0], hipR: [-1.65, 0, 0], kneeR: [0.1, 0, 0], footR: [0.4, 0, 0] },
  // 유물 주먹: 뒤로 당겼다가 앞으로 내지름
  punchBack: { hips: [0, -0.5, 0], spine: [0.1, -0.4, 0], chest: [0.05, -0.4, 0], head: [0, 0.65, 0], shoulderR: [0.3, 0, -0.35], elbowR: [-1.6, 0, 0], weapon: [0.15, 0.2, 0], shoulderL: [-1.2, 0, 0.3], elbowL: [-0.4, 0, 0],
    hipL: [-0.7, 0, 0.2], kneeL: [0.9, 0, 0], hipR: [0.5, 0, -0.2], kneeR: [0.6, 0, 0] },
  punch: { hips: [0, 0.35, 0], spine: [0.35, 0.3, 0], chest: [0.1, 0.3, 0], head: [-0.35, -0.5, 0], shoulderR: [-1.55, 0, -0.08], elbowR: [-0.05, 0, 0], weapon: [0.0, -0.02, 0], shoulderL: [0.4, 0, 0.5], elbowL: [-0.6, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.0, 0, 0], hipR: [0.75, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 포격 자세: 허리에 유물을 끼고 앞으로 겨눔 (왼손으로 자루를 받침)
  aim: { hipY: -0.04, hips: [0, -0.35, 0], spine: [0.12, -0.25, 0], chest: [0.02, -0.15, 0], head: [-0.05, 0.6, 0], shoulderR: [-0.25, 0, -0.35], elbowR: [-1.35, 0, 0], weapon: [0.02, 0.05, 0], shoulderL: [-1.0, 0, -0.35], elbowL: [-0.75, 0, 0],
    hipL: [-0.75, 0, 0.18], kneeL: [0.85, 0, 0], footL: [-0.1, 0, 0], hipR: [0.55, 0, -0.2], kneeR: [0.55, 0, 0] },
  recoil: { hipY: -0.04, hips: [0, -0.3, 0], spine: [-0.12, -0.25, 0], chest: [-0.1, -0.15, 0], head: [-0.15, 0.55, 0], shoulderR: [-0.05, 0, -0.35], elbowR: [-1.6, 0, 0], weapon: [0.3, 0.05, 0], shoulderL: [-0.8, 0, -0.3], elbowL: [-1.0, 0, 0],
    hipL: [-0.55, 0, 0.18], kneeL: [0.7, 0, 0], hipR: [0.65, 0, -0.2], kneeR: [0.6, 0, 0] },
  // 움켜쥐기: 손을 활짝 펴고 앞으로 → 들어 올림
  grabReach: { hips: [0, 0.2, 0], spine: [0.4, 0.15, 0], chest: [0.1, 0.15, 0], head: [-0.35, -0.2, 0], shoulderR: [-1.5, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [0.05, 0, 3.14], shoulderL: [0.4, 0, 0.5], elbowL: [-0.6, 0, 0],
    hipL: [-1.0, 0, 0.12], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.12], kneeR: [0.25, 0, 0] },
  grabLift: { hips: [0, 0.05, 0], spine: [-0.25, 0.05, 0], chest: [-0.15, 0.05, 0], head: [-0.4, 0, 0], shoulderR: [-2.5, 0, -0.15], elbowR: [-0.2, 0, 0], weapon: [1.0, 0, 3.14], shoulderL: [0.3, 0, 0.5], elbowL: [-1.2, 0, 0],
    hipL: [-0.3, 0, 0.12], kneeL: [0.3, 0, 0], hipR: [0.3, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 연막: 몸을 낮추고 왼손으로 발밑에 던짐
  throwDown: { hipY: -0.16, hips: [0, 0.1, 0], spine: [0.55, 0.1, 0], chest: [0.15, 0, 0], head: [-0.3, 0, 0], shoulderR: [-0.3, 0, -0.25], elbowR: [-2.2, 0, 0], weapon: [0.6, 2.7, 0], shoulderL: [-0.9, 0, 0.2], elbowL: [-0.3, 0, 0],
    hipL: [-1.2, 0, 0.2], kneeL: [1.6, 0, 0], footL: [-0.3, 0, 0], hipR: [0.2, 0, -0.2], kneeR: [1.4, 0, 0] },
  // 궁극기: 유물을 하늘로 치켜듦 · 앞으로 뻗어 움켜쥠
  sky: { hips: [0, 0.1, 0], spine: [-0.2, 0.05, 0], chest: [-0.15, 0, 0], head: [-0.45, 0, 0], shoulderR: [-3.0, 0, -0.2], elbowR: [-0.1, 0, 0], weapon: [1.5, 0, 0], shoulderL: [0.2, 0, 0.6], elbowL: [-0.8, 0, 0],
    hipL: [-0.4, 0, 0.18], kneeL: [0.35, 0, 0], hipR: [0.3, 0, -0.15], kneeR: [0.25, 0, 0] },
  clench: { hips: [0, 0.3, 0], spine: [0.25, 0.25, 0], chest: [0.08, 0.25, 0], head: [-0.25, -0.35, 0], shoulderR: [-1.75, 0, -0.1], elbowR: [-0.15, 0, 0], weapon: [0.35, -0.05, 0], shoulderL: [0.3, 0, 0.5], elbowL: [-1.0, 0, 0],
    hipL: [-0.9, 0, 0.15], kneeL: [0.9, 0, 0], hipR: [0.65, 0, -0.15], kneeR: [0.3, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 유물에 기대 서서 훔친 장신구를 들여다본다
  idle2: { hips: [0, 0.2, 0.06], spine: [0.08, 0.1, -0.04], chest: [0.06, 0.1, 0], head: [0.35, 0.25, 0.05], shoulderR: [-0.15, 0, -0.32], elbowR: [-0.6, 0, 0], weapon: [-1.45, 0.6, 0.2], shoulderL: [-0.9, 0, 0.1], elbowL: [-1.6, 0, 0],
    hipL: [-0.08, 0, 0.12], kneeL: [0.25, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [0.05, 0, 0] },
});

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const relicV = (f) => f.relic || 0;
const glow = (f, k) => { f.relicGlow = k; };
const addRelic = (f, v) => { f.relic = Math.min(100, relicV(f) + v); };
function shards(G, p, n = 10, sp = 4, col = TEAL) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.25, 0.25), rand(-0.25, 0.25), rand(-0.25, 0.25))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.05, 0.11), size1: 0.01, life: rand(0.35, 0.7), color: i % 3 ? col : TEAL2, alpha: 0.95, drag: 2, grav: 4, flick: 0.3 }); }
function dust(G, p, n = 18, sp = 4) { G.fx.burst(p, n, 0x8a7458, sp, { kind: 'dust', sk: 1.2 }); }
// 지면 충격: 고리 + 흙먼지 + 청록 파편
function quake(G, c, r, col = TEAL) {
  G.fx.ring(c, { normal: UP, r0: 0.2, r1: r * 1.2, life: 0.4, color: col }); G.fx.ring(c, { normal: UP, r0: 0.1, r1: r * 0.7, life: 0.3, color: 0xffffff });
  dust(G, c, 26, 5); shards(G, c.clone().setY(c.y + 0.2), 14, 5); G.fx.light(c.clone().setY(c.y + 0.8), col, 70, 0.3);
}
// 결정 핵으로 빨려 드는 빛 (차징 · 흡수)
function suck(G, from, to, n = 2, col = TEAL) { for (let i = 0; i < n; i++) { const p = from.clone().add(new V3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5))), v = to.clone().sub(p).multiplyScalar(4); G.fx.p(p, { vel: [v.x, v.y, v.z], size: rand(0.06, 0.12), size1: 0.02, life: 0.25, color: i % 2 ? col : TEAL2, alpha: 0.95, drag: 0 }); } }
const behind = (o, d = 1.25) => { const b = o.fwd(new V3()).multiplyScalar(-d * Math.max(1, o.scale)); return o.pos.clone().add(b); };

/* ---------- 유물 포격: 관통하는 청록 광선 (굵기 · 피해는 차징량에 비례) ---------- */
let _beamGeo = null;
class RelicBeam {
  // o: { len, w, hit(t) → 피격 데이터, life, color, onHit(t) }
  constructor(G, f, from, dir, o = {}) {
    this.G = G; this.f = f; this.t = 0; this.done = false; this.life = o.life ?? 0.5; this.w = o.w ?? 0.3; this.col = o.color ?? TEAL;
    if (!_beamGeo) { _beamGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true); _beamGeo.rotateX(Math.PI / 2); _beamGeo.translate(0, 0, 0.5); }
    const W = G.stage && G.stage.world; let len = o.len ?? 14;
    if (W) for (let k = 1; k <= 40; k++) { const p = from.clone().addScaledVector(dir, (k / 40) * len); if (W.solidAt(p, 0.1) || p.y < -0.05) { len = Math.max(0.5, ((k - 0.5) / 40) * len); break; } }
    this.a = from.clone(); this.dir = dir.clone(); this.len = len; this.b = from.clone().addScaledVector(dir, len);
    for (const t of f.foes()) { if (!t.hurtHitSeg(this.a, this.b, this.w)) continue; const r = t.takeHit(f, o.hit ? o.hit(t) : { dmg: 60 }, dir.clone().setY(0).normalize()); if (r) { const p = t.chest(new V3()); G.fx.impact(p, this.col, 1.8, dir); shards(G, p, 14, 5); o.onHit && o.onHit(t, r); } }
    this.mo = new THREE.MeshBasicMaterial({ color: this.col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mi = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    this.g = new THREE.Group(); this.g.position.copy(this.a); this.g.lookAt(this.b); G.scene.add(this.g);
    this.outer = new THREE.Mesh(_beamGeo, this.mo); this.inner = new THREE.Mesh(_beamGeo, this.mi); this.g.add(this.outer, this.inner); this.g.traverse((m) => { m.frustumCulled = false; });
    const n = Math.min(10, Math.round(len / 1.6)); for (let i = 1; i <= n; i++) G.fx.ring(this.a.clone().addScaledVector(dir, (i / (n + 1)) * len), { normal: dir, r0: this.w * 0.4, r1: this.w * 2.6, life: 0.3 + i * 0.02, color: i % 2 ? this.col : TEAL2, op: 0.7 });
    G.fx.light(this.a, this.col, 50, 0.25, 9); G.fx.light(this.b, this.col, 40, 0.3, 9); G.fx.impact(this.b, this.col, 1.2);
    this.update(0);
  }
  update(dt) {
    const G = this.G; this.t += dt; const k = this.t / this.life; if (k >= 1) return this.kill();
    const w = this.w * (1 - k) ** 0.5 * (1 + 0.12 * Math.sin(this.t * 70));
    this.outer.scale.set(w, w, this.len); this.inner.scale.set(w * 0.35, w * 0.35, this.len); this.mo.opacity = 0.6 * (1 - k); this.mi.opacity = 1 - k * k;
    if (k < 0.7) for (let i = 0; i < 4; i++) { const p = this.a.clone().addScaledVector(this.dir, rand(0, this.len)).add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(this.w)); G.fx.p(p, { vel: [rand(-0.6, 0.6), rand(0, 1.2), rand(-0.6, 0.6)], size: rand(0.06, 0.14), size1: 0.01, life: 0.4, color: i % 2 ? this.col : TEAL2, alpha: 0.9, drag: 2 }); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.mo.dispose(); this.mi.dispose(); }
}

/* ---------- 연막: 발밑에 퍼지는 회색 연기 (안에 든 적은 둔화) ---------- */
class SmokeCloud {
  constructor(G, f, p, o = {}) { this.G = G; this.f = f; this.p = p.clone(); this.t = 0; this.life = o.life ?? 3.2; this.r = o.r ?? 2.3; this.done = false; this.tick = 0; }
  update(dt) {
    const G = this.G; this.t += dt; this.tick -= dt; if (this.t > this.life) return this.kill();
    const k = Math.min(1, this.t / 0.25) * Math.min(1, (this.life - this.t) / 0.6);
    if (Math.random() < 0.9 * k) for (let i = 0; i < 2; i++) { const a = rand(0, TAU), rr = rand(0, this.r); G.fx.p(this.p.clone().add(new V3(Math.cos(a) * rr, rand(0.1, 1.2), Math.sin(a) * rr)), { vel: [rand(-0.3, 0.3), rand(0.1, 0.5), rand(-0.3, 0.3)], size: rand(0.6, 1.0), size1: rand(1.4, 2.2), life: rand(0.8, 1.3), color: i ? 0x8a8a90 : 0x5a6064, alpha: 0.32, drag: 1.5, smoke: true }); }
    if (this.tick <= 0) { this.tick = 0.25; for (const t of this.f.foes()) if (Math.hypot(t.pos.x - this.p.x, t.pos.z - this.p.z) < this.r + 0.3 * t.scale) t.addStatus && t.addStatus('slow', 0.6, 0.6, this.f); }
  }
  kill() { this.done = true; }
}

/* ---------- 거인의 손: 유물 손을 복제해 거대하게 키운 고대의 손 (궁극기) ---------- */
class GiantHand {
  constructor(G, f, o) {
    this.G = G; this.f = f; this.o = o; this.t = 0; this.done = false; this.S = 4.4 * Math.max(1, o.scale * 0.9);
    const src = f.model.relicHead; this.g = new THREE.Group(); const inner = src.clone(true); inner.position.set(0, 0, -(RL.cuff * (1 - RL.hs) + RL.hs * (RL.cuff + RL.knuck) / 2)); this.g.add(inner); G.scene.add(this.g);
    this.g.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; m.castShadow = true; } });
    this.claws = ['claw0', 'claw1', 'claw2', 'claw3'].map((n) => inner.getObjectByName(n)); this.thumb = inner.getObjectByName('thumb'); this.thumb0 = this.thumb.rotation.y;
    // 엘루스 쪽에서 상대 쪽으로 손가락이 향하게
    const d = new V3().subVectors(o.pos, f.pos).setY(0); if (d.lengthSq() < 1e-4) f.fwd(d); d.normalize(); this.yaw = Math.atan2(d.x, d.z); this.dir = d;
    this.g.scale.setScalar(0.01); this.curl(-0.5); this.update(0);
  }
  curl(a) { for (const c of this.claws) c.rotation.x = a; this.thumb.rotation.y = this.thumb0 - Math.max(0, a) * 0.6; }
  center(out) { const o = this.o; return out.set(o.pos.x, o.pos.y + 1.0 * o.scale, o.pos.z); }
  update(dt) {
    const G = this.G; this.t += dt; const t = this.t, c = this.center(new V3());
    // 0~0.6 하늘에서 형성 · 0.6~1.0 내려옴 · 1.0~2.0 움켜쥐고 짓누름 · 2.0~ 터지며 흩어짐
    const form = clamp(t / 0.6, 0, 1), fall = clamp((t - 0.6) / 0.4, 0, 1), close = clamp((t - 0.85) / 0.3, 0, 1), fade = clamp((t - 2.05) / 0.5, 0, 1);
    const h = 7 * (1 - fall * fall) + 0.8, s = this.S * (0.15 + 0.85 * Math.sqrt(form)) * (1 + 0.04 * Math.sin(t * 40) * close * (1 - fade)) * (1 - fade * 0.3);
    this.g.position.set(c.x - this.dir.x * 0.2 * this.S, c.y + h, c.z - this.dir.z * 0.2 * this.S); this.g.rotation.set(-0.15 * (1 - fall), this.yaw, 0); this.g.scale.setScalar(Math.max(0.01, s));
    this.curl(-0.5 + 1.95 * close - 0.6 * fade);
    this.g.visible = fade < 1;
    if (form < 1 || fall < 1) { const p = this.g.position; for (let i = 0; i < 3; i++) G.fx.p(p.clone().add(new V3(rand(-1, 1) * s * 0.25, rand(-0.5, 0.5) * s * 0.1, rand(-1, 1) * s * 0.25)), { vel: [0, -2, 0], size: rand(0.15, 0.35), size1: 0.03, life: 0.5, color: i % 2 ? TEAL : GOLDR, alpha: 0.85, drag: 1 }); }
    if (fade > 0 && fade < 1) shards(G, this.g.position.clone().add(new V3(rand(-1.5, 1.5), rand(-1, 1), rand(-1.5, 1.5))), 6, 6, i0(t));
    if (t > 2.7) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); if (this.o && this.o.held && this.f.ultTgt === this.o) this.o.release(); }
}
const i0 = (t) => ((t * 10) | 0) % 2 ? TEAL : GOLDR;

/* =====================================================================
   기술 — 중량급 도굴꾼: 유물 몽둥이 · 단검 발차기 · 차지 포격 · 움켜쥐어 빼앗기 · 연막 기습
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 유물을 머리 위로 치켜들었다가 거대한 손으로 땅을 내려찍음 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.35, 0, 0], head: [0.1, 0, 0], shoulderR: [-1.5, 0, -0.1], elbowR: [-0.15, 0, 0], weapon: [-1.35, 0, 0], shoulderL: [-1.4, 0, 0.1], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: TEAL, dmg: 76, r: 2.6,
    fx: (f, o, G, c) => { quake(G, c, 2.6); addRelic(f, 6); },
  }),

  /* --- 기본 공격: 유물 손등 치기 → 머리 위 내려찍기 → 단검 · 발차기 연격 → 유물 주먹 + 결정 폭발 --- */
  light1: { dur: 0.46, cancel: 0.24, next: 'light2', trail: true, track: 0.08, ikOff: true,
    keys: [[0, 'windL'], [0.1, 'windL'], [0.2, 'backhand'], [0.32, {}], [0.46, 'base']], lunge: [[0.08, 0.18, 6]],
    ev: [[0.11, () => sfx('swing')], [0.15, (f) => f.slashFx({ tilt: 0.12, r: 2.0, at: [0, 1.0, 0.5], color: GOLDR, flip: true })]],
    hits: [{ t0: 0.1, t1: 0.22, dmg: 34, br: 0.24 }] },
  light2: { dur: 0.62, cancel: 0.36, next: 'light3', trail: true, track: 0.18, ikOff: true,
    keys: [[0, 'raise'], [0.16, 'raise'], [0.26, 'slam'], [0.46, 'slam'], [0.62, 'base']], lunge: [[0.14, 0.24, 5]],
    ev: [[0.16, () => sfx('swing')], [0.27, (f, o, G) => { sfx('heavy'); G.shake(0.14); const c = f.local([0, 0, 1.55]); c.y = f.pos.y + 0.05; quake(G, c, 1.4); }]],
    hits: [{ t0: 0.17, t1: 0.29, dmg: 42, br: 0.26 }, { t0: 0.27, t1: 0.3, weapon: false, at: [0, 0.3, 1.5], r: 0.9, dmg: 8 }] },
  light3: { dur: 0.64, cancel: 0.46, next: 'light4', track: 0.4, ikOff: true,
    keys: [[0, 'slashD'], [0.06, 'stab'], [0.16, 'slashD'], [0.22, {}], [0.3, 'kickC'], [0.38, 'kick'], [0.5, 'kick'], [0.64, 'base']],
    lunge: [[0.04, 0.08, 6], [0.16, 0.2, 5], [0.34, 0.4, 6]],
    start: (f) => { f.daggerOn = true; },
    ev: [[0.05, (f) => { sfx('swing'); f.slashFx({ tilt: 1.3, r: 1.0, at: [0.15, 1.15, 0.6], color: TEAL2 }); }], [0.17, (f) => { sfx('swing'); f.slashFx({ tilt: -0.5, r: 1.2, at: [0.1, 1.1, 0.55], color: TEAL2, flip: true }); }],
      [0.38, (f, o, G) => { sfx('heavy'); G.fx.burst(f.local([-0.1, 0.95, 0.9]), 10, [TEAL, 0xffffff], 4, { dir: f.fwd(new V3()), spread: 0.8 }); }], [0.52, (f) => { f.daggerOn = false; }]],
    hits: [{ t0: 0.05, t1: 0.1, weapon: false, at: [0.1, 1.15, 0.85], r: 0.48, dmg: 12 }, { t0: 0.16, t1: 0.21, weapon: false, at: [0.05, 1.1, 0.85], r: 0.5, dmg: 12 },
      { t0: 0.36, t1: 0.43, weapon: false, at: [-0.1, 0.95, 0.95], r: 0.5, dmg: 18 }],
    end: (f) => { f.daggerOn = false; } },
  light4: { dur: 0.74, track: 0.24, ikOff: true, trail: true, noMove: true, shout: true,
    keys: [[0, 'punchBack'], [0.2, 'punchBack'], [0.28, 'punch'], [0.52, 'punch'], [0.74, 'base']], lunge: [[0.2, 0.3, 9]],
    start: (f, o, G) => { sfx('charge'); glow(f, 0.8); },
    tick: (f, o, G, t) => { if (t < 0.2) suck(G, f.chest(new V3()).add(new V3(0, 0.3, 0)), f.model.coreWorld(new V3()), 1); },
    ev: [[0.22, () => sfx('swing')], [0.32, (f, o, G) => { sfx('boom'); G.shake(0.16); const p = f.model.muzzle(new V3()); G.fx.impact(p, TEAL, 1.5, f.fwd(new V3())); G.fx.ring(p, { normal: f.fwd(new V3()), r0: 0.2, r1: 1.6, life: 0.3, color: TEAL }); shards(G, p, 12, 5); }], [0.5, (f) => glow(f, 0)]],
    hits: [{ t0: 0.22, t1: 0.32, dmg: 30, br: 0.26 }, { t0: 0.32, t1: 0.36, weapon: false, at: [0, 1.1, 2.0], r: 0.8, dmg: 24 }],
    end: (f) => glow(f, 0) },

  /* --- 우클: 유물 포격 — 누르고 있으면 결정 핵에 힘을 모으고, 떼는 순간 관통하는 청록 광선 (유물 게이지 가득 = 폭주 포격) --- */
  heavy: { dur: 1.05, cd: 'heavy', track: 0.48, noMove: true, shout: true, ikOff: true, hold: { key: 'heavy', at: 0.45, max: 1.3 },
    keys: [[0, 'aim'], [0.47, 'aim'], [0.52, 'recoil'], [0.8, 'aim'], [1.05, 'base']],
    start: (f, o, G) => { f.overload = relicV(f) >= 100; glow(f, 0.6); sfx('charge'); if (f.overload) G.say(f, '"…다 쏟아내 볼까?"'); },
    tick: (f, o, G, t) => { if (t < 0.48) { const c = f.model.coreWorld(new V3()); suck(G, c.clone().add(new V3(0, 0.2, 0)), c, 1 + Math.round(2 * (f.holdK || 0))); glow(f, 0.6 + 0.4 * (f.holdK || 0)); } },
    ev: [[0.48, (f, o, G) => {
      const k = f.holdK || 0, ov = f.overload, from = f.model.muzzle(new V3()), dir = f.fwd(new V3());
      if (o && !o.gone && f.dist() < 16) { const to = o.chest(new V3()).sub(from); to.y = clamp(to.y, -1, 1.2); if (to.clone().setY(0).normalize().dot(dir) > 0.8) dir.copy(to.normalize()); }
      if (ov) { f.relic = 0; }
      const dmg = Math.round((48 + 92 * k) * (ov ? 1.35 : 1));
      G.spawn(new RelicBeam(G, f, from, dir, { w: (0.26 + 0.3 * k) * (ov ? 1.5 : 1), len: 14 + 4 * k, life: 0.5 + 0.2 * k, color: ov ? TEAL2 : TEAL,
        hit: () => ({ dmg, kb: [4 + 6 * k, 1.5 + 2.5 * k], stun: 0.6 + 0.25 * k, hs: 0.1 + 0.05 * k, shake: 0.2, daze: 25 + 25 * k, snd: 'big', noScale: true }),
        onHit: (t) => { if (ov && t.addStatus) t.addStatus('vuln', 4, 1.15, f); } }));
      sfx('shot'); sfx('boom'); G.shake(0.18 + 0.15 * k); G.flash(TEAL2, 0.12 + 0.1 * k); f.vel.addScaledVector(dir.clone().setY(0).normalize(), -(4 + 5 * k)); glow(f, 1);
      G.fx.impact(from, TEAL, 1 + k); dust(G, f.pos.clone().setY(f.pos.y + 0.05), 10, 3);
    }], [0.8, (f) => glow(f, 0)]],
    end: (f) => { glow(f, 0); f.overload = false; } },

  /* --- Shift: 도굴꾼의 손 — 유물 손을 내뻗어 붙잡고, 궁극기 기운과 버프를 빼앗은 뒤 땅에 내리꽂는다 --- */
  s1: { dur: 1.42, cd: 's1', ikOff: true, aim: true, noMove: true, shout: true,
    keys: [[0, 'punchBack'], [0.12, 'grabReach'], [0.32, 'grabReach'], [0.6, 'grabLift'], [0.86, 'grabLift'], [1.0, 'slam'], [1.2, 'slam'], [1.42, 'base']],
    start: (f, o, G) => { f.grabT = null; glow(f, 0.7); sfx('swing'); },
    tick: (f, o, G, t) => {
      if (!f.grabT && t >= 0.06 && t <= 0.32 && o && !o.gone) { // 손이 닿을 거리까지 파고든다
        const to = new V3().subVectors(o.pos, f.pos).setY(0), d = to.length(); to.normalize(); const sp = d > 1.7 * Math.max(1, o.scale) ? 12 : 0; f.vel.x = to.x * sp; f.vel.z = to.z * sp; f.yaw = Math.atan2(to.x, to.z); }
      if (!f.grabT && t >= 0.12 && t <= 0.34) {
        const c = f.model.muzzle(new V3()), c0 = f.model.coreWorld(new V3());
        for (const tg of f.foes()) { if (!tg.hurtHitSeg(c0, c, 0.4)) continue;
          const r = tg.takeHit(f, { dmg: 14, kb: [0, 0], stun: 1.6, hs: 0.06, unblock: true, daze: 10, snd: 'hit' }, f.fwd(new V3()));
          if (r === 'hit') { f.grabT = tg; if (!(tg.def.boss || tg.scale > 1.25) && tg.state !== 'ko') tg.lock(); G.say(f, '"그거, 내가 가져갈게."'); sfx('block'); G.fx.impact(c, TEAL, 1.2); } break; }
      }
      if (!f.grabT && t > 0.36) { f.at = Math.max(f.at, 1.22); return; } // 놓쳤으면 바로 회수 자세로
      const tg = f.grabT; if (!tg) return;
      if (tg.held && t < 1.0) { const c = f.model.muzzle(new V3()); tg.pos.set(c.x, Math.max(f.pos.y, c.y - 1.0 * tg.scale), c.z); tg.vel.set(0, 0, 0); tg.yaw = f.yaw + Math.PI; }
      if (t > 0.5 && t < 0.9) suck(G, tg.chest(new V3()), f.model.coreWorld(new V3()), 2);
    },
    ev: [[0.62, (f, o, G) => {
      const tg = f.grabT; if (!tg) return;
      // 빼앗기: 궁극기 게이지 (최대 25) + 버프 하나
      const take = Math.min(25, tg.energy || 0); tg.energy = (tg.energy || 0) - take; f.energy = Math.min(100, f.energy + take); addRelic(f, 35);
      let stole = null; for (const k of ['atk', 'haste', 'regen', 'vuln']) { const s = tg.st && tg.st[k]; if (!s || s.t <= 0 || (k === 'vuln' && s.k >= 1)) continue; delete tg.st[k]; f.addStatus(k, Math.max(3, s.t), s.k, f); stole = k; break; }
      sfx('zap'); G.flash(TEAL, 0.15); shards(G, f.model.coreWorld(new V3()), 18, 3);
      G.hud.damage && G.hud.damage(tg.chest(new V3()).add(new V3(0, 0.5, 0)), stole ? '강탈!' : '-' + Math.round(take), false, true);
    }],
      [1.0, (f, o, G) => {
        const tg = f.grabT; if (!tg) return; if (tg.held) tg.release();
        const c = f.local([0, 0, 1.6]); c.y = f.pos.y;
        if (!(tg.def.boss || tg.scale > 1.25)) { tg.pos.set(c.x, f.pos.y + 0.1, c.z); }
        sfx('boom'); sfx('heavy'); G.shake(0.3); quake(G, c.clone().setY(c.y + 0.05), 2);
        tg.takeHit(f, { dmg: 48, kb: [3, 4.5], stun: 0.8, hs: 0.14, shake: 0.25, force: true, daze: 32, snd: 'big' }, f.fwd(new V3()));
        areaHit(f, c, 1.8, { dmg: 18, kb: [4, 3], stun: 0.5, daze: 10 });
      }], [1.2, (f) => glow(f, 0)]],
    end: (f) => { glow(f, 0); const tg = f.grabT; if (tg && tg.held) tg.release(); f.grabT = null; } },

  /* --- E: 연막 기습 — 발밑에 연막탄을 터뜨려 모습을 감추고, 상대 등 뒤에 나타나 단검으로 찌른다 (확정 치명타 · 출혈) --- */
  s2: { dur: 1.0, cd: 's2', ikOff: true, aim: true, noMove: true,
    keys: [[0, 'throwDown'], [0.14, 'throwDown'], [0.42, { ...poses.stab, shoulderL: [-0.6, 0, 0.5], elbowL: [-1.6, 0, 0] }], [0.5, 'stab'], [0.68, 'stab'], [1.0, 'base']],
    start: (f, o, G) => { f.daggerOn = true; G.say(f, '"…어디 보는 거야?"'); },
    ev: [[0.1, (f, o, G) => { sfx('boom'); G.spawn(new SmokeCloud(G, f, f.pos)); G.fx.burst(f.pos.clone().setY(f.pos.y + 0.4), 24, [0x8a8a90, 0x5a6064], 4, { kind: 'smoke', sk: 1.3 }); G.fx.burst(f.pos.clone().setY(f.pos.y + 0.2), 10, [TEAL, 0xffffff], 5); }],
      [0.16, (f, o, G) => { f.root.visible = false; f.vanish = true; f.inv = Math.max(f.inv, 0.5); sfx('dash'); }],
      [0.4, (f, o, G) => {
        o = o && !o.gone && o.state !== 'ko' && f.dist() < 10 ? o : null;
        const p = o ? behind(o, 1.15) : f.pos.clone().addScaledVector(f.fwd(new V3()), 4); const W = G.stage && G.stage.world;
        if (W && W.solidAt(p.clone().setY(p.y + 0.6), 0.3)) p.copy(o ? o.pos.clone().addScaledVector(o.fwd(new V3()), 1.15) : f.pos);
        f.pos.x = p.x; f.pos.z = p.z; if (o) f.yaw = f.yawTo(o.pos); f.vel.set(0, 0, 0); f.root.visible = true; f.vanish = false; f.model.resetCloth(); f.wJump = true;
        G.fx.burst(f.chest(new V3()), 14, [0x8a8a90, 0x5a6064], 3, { kind: 'smoke' }); sfx('dash');
      }],
      [0.5, (f) => { sfx('swing'); f.slashFx({ tilt: 1.45, r: 1.0, at: [0.12, 1.15, 0.6], color: TEAL2 }); }], [0.8, (f) => { f.daggerOn = false; }]],
    hits: [{ t0: 0.48, t1: 0.56, weapon: false, at: [0.12, 1.1, 0.85], r: 0.55, dmg: 40, crit: true, kb: [3, 1], stun: 0.6, hs: 0.1, daze: 22, st: ['bleed', 3, 6] }],
    end: (f) => { f.daggerOn = false; f.root.visible = true; f.vanish = false; } },

  /* --- 극한 회피 뒤 좌클: 도굴꾼의 반격 — 돌며 유물 손등 치기 → 바로 앞에서 결정 포 한 발 --- */
  counter: { dur: 0.8, aim: true, ikOff: true, trail: true, noMove: true,
    keys: [[0, 'windL'], [0.08, 'backhand'], [0.26, 'aim'], [0.4, 'recoil'], [0.6, 'aim'], [0.8, 'base']],
    start: (f, o, G) => { glow(f, 1); sfx('swing'); },
    ev: [[0.08, (f) => f.slashFx({ tilt: 0.1, r: 2.2, at: [0, 1.0, 0.5], color: TEAL, flip: true })],
      [0.38, (f, o, G) => { const from = f.model.muzzle(new V3()), dir = f.fwd(new V3()); G.spawn(new RelicBeam(G, f, from, dir, { w: 0.4, len: 6, life: 0.4, hit: () => ({ dmg: 42, kb: [7, 3], stun: 0.6, hs: 0.12, daze: 26, snd: 'big', noScale: true }) })); sfx('shot'); sfx('boom'); G.shake(0.2); f.vel.addScaledVector(dir, -4); }],
      [0.6, (f) => glow(f, 0)]],
    hits: [{ t0: 0.06, t1: 0.2, dmg: 52, kb: [3, 2], stun: 0.6, hs: 0.12, daze: 28, br: 0.28, snd: 'big' }],
    end: (f) => glow(f, 0) },

  /* --- Q: 유물 폭주 · 거인의 손 — 건틀릿이 하늘에서 거대한 고대의 손으로 펼쳐져 상대를 움켜쥐고 짓뭉갠다 --- */
  ult: { dur: 3.4, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, 'aim'], [0.3, 'sky'], [1.0, 'sky'], [1.2, 'clench'], [2.2, 'clench'], [2.35, { ...poses.clench, shoulderR: [-1.9, 0, -0.1], weapon: [0.55, -0.05, 0] }], [2.9, 'clench'], [3.4, 'base']],
    cam: [[0, { ref: 'self', p: [1.4, 1.2, 2.6], l: [0, 1.4, 0], fov: 40 }], [0.5, { ref: 'self', p: [1.6, 0.6, 2.2], l: [0, 2.4, 0], fov: 46 }],
      [0.85, { ref: 'target', p: [4.5, 1.0, -4.5], l: [0, 3.2, 0], fov: 60 }], [1.4, { ref: 'target', p: [5, 1.4, -5], l: [0, 1.6, 0], fov: 56 }],
      [2.3, { ref: 'target', p: [3.4, 2.4, 3.2], l: [0, 1.4, 0], fov: 50 }], [3.4, { ref: 'target', p: [4.2, 2.6, 5], l: [0, 1.2, 0], fov: 54 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(DEEPT, 0.32); glow(f, 1); sfx('charge'); G.say(f, '"잠들어 있던 걸 깨워 줄게 — 일어나."'); }],
      [0.4, (f, o, G) => { o = f.ultTgt || o; sfx('zap'); sfx('boom'); G.flash(TEAL2, 0.35); G.stage.flashSky && G.stage.flashSky(0.3);
        const c = f.model.coreWorld(new V3()); G.fx.beam(c.clone().setY(f.pos.y), { r: 0.6, h: 30, life: 0.8, color: TEAL }); G.fx.light(c, TEAL, 140, 0.6, 18); shards(G, c, 30, 7);
        if (o) G.spawn(f.giant = new GiantHand(G, f, o)); }],
      [1.08, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('heavy'); sfx('boom'); G.shake(0.45); quake(G, o.pos.clone().setY(o.pos.y + 0.05), 3.4); G.say(f, '"…부숴."');
        o.takeHit(f, { dmg: 30, kb: [0, 0], stun: 99, hs: 0.06, nokill: true, noScale: true, force: true, noCrit: true, daze: 20, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); }],
      [2.4, (f, o, G) => { o = f.ultTgt || o; if (!o) return; o.release(); sfx('boom'); sfx('big'); G.flash(0xeafff8, 0.55); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.4);
        const c = o.chest(new V3()); G.fx.impact(c, TEAL, 2.8); shards(G, c, 60, 10); G.fx.light(c, TEAL, 200, 0.8, 22); G.fx.ring(o.pos.clone().setY(o.pos.y + 0.05), { normal: UP, r0: 0.5, r1: 7.5, life: 0.6, color: TEAL }); dust(G, o.pos.clone(), 40, 7);
        const dir = new V3().subVectors(o.pos, f.pos).setY(0).normalize();
        o.takeHit(f, { dmg: 165, kb: [6, 10], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big' }, dir);
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) t.takeHit(f, { dmg: 100, kb: [6, 8], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, o.pos).setY(0).normalize());
        addRelic(f, 40); G.slow(0.35, 0.5); }],
    ],
    tick: (f, o, G, t, dt) => {
      if (t < 0.4) { const c = f.model.coreWorld(new V3()); for (let i = 0; i < 2; i++) { const a = rand(0, TAU), R = rand(1, 2.4), p = c.clone().add(new V3(Math.cos(a) * R, rand(-0.8, 1), Math.sin(a) * R)), v = c.clone().sub(p).multiplyScalar(3); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.1, size1: 0.02, life: 0.3, color: i ? TEAL : GOLDR, alpha: 0.9 }); } }
      // 움켜쥔 동안: 손 안에서 짓눌리는 연속 피해 (0.12초마다)
      const tg = f.ultTgt; if (tg && tg.held && t > 1.15 && t < 2.35) { f.crushAcc = (f.crushAcc || 0) + dt; while (f.crushAcc >= 0.12) { f.crushAcc -= 0.12;
        const c = tg.chest(new V3()); shards(G, c, 5, 4, (Math.random() < 0.5 ? TEAL : GOLDR)); G.shake(0.08); if (Math.random() < 0.5) sfx('hit');
        tg.takeHit(f, { dmg: 7, kb: [0, 0], stun: 99, hs: 0.01, nokill: true, noScale: true, force: true, noCrit: true, daze: 6, snd: 'hit' }, new V3().subVectors(tg.pos, f.pos).setY(0).normalize()); } }
    },
    end: (f, o, G) => { G.setTint(0, 0); glow(f, 0); f.crushAcc = 0; const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 55;
  G.fx.impact(p, TEAL, big ? 1.7 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.5 : 1.0, color: big ? TEAL2 : GOLDR, life: 0.2 });
  shards(G, p, big ? 12 : 5, 4);
  // 유물 게이지: 맞힐 때마다 쌓인다 (가득 차면 다음 포격이 폭주 포격)
  addRelic(att, h.dmg * 0.3);
}

// 유물 게이지 가득 → 결정 핵에서 빛 알갱이
function createModelWithRelic(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (relicV(f) >= 100 && f.root.visible && Math.random() < 0.3) { const p = m.coreWorld(new V3()); f.G.fx.p(p, { vel: [0, 0.8, 0], size: 0.1, size1: 0.02, life: 0.4, color: TEAL2, alpha: 0.9, drag: 1 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist < 2.6 && f.cd.s1 <= 0 && !o.held && Math.random() < 0.3) return 's1';
  if (dist > 3.5 && dist < 12 && f.cd.heavy <= 0 && Math.random() < 0.3) return 'heavy';
  if (dist > 2.5 && dist < 8 && f.cd.s2 <= 0 && Math.random() < 0.22) return 's2';
  return null;
}

export default {
  id: 'elus', name: '엘루스', short: '엘루스', title: '유적 도굴꾼', scale: 1.0,
  desc: '근거리 중량급 · 붙잡기 · 차지 포격. 유적에서 훔친 거대한 고대 유물 건틀릿을 메고 다니는 도굴꾼. 유물을 몽둥이처럼 휘두르고, 결정 핵에 힘을 모아 광선을 쏘며, 붙잡은 상대의 궁극기 기운과 버프를 빼앗는다. 맞힐수록 유물 게이지가 차고, 가득 차면 다음 포격이 폭주한다.',
  stats: { hp: 1020, speed: 7.7, jump: 10.5, crit: 0.22 },
  palettes: [{ accent: TEAL, core: TEAL, band: '#0a2a28' }, { accent: 0xffa040, core: 0xffa040, band: '#2a1a0a' }],
  skills: { heavy: { name: '유물 포격', cd: 7 }, s1: { name: '도굴꾼의 손', cd: 10 }, s2: { name: '연막 기습', cd: 11 }, ult: { name: '유물 폭주 · 거인의 손', sub: 'RUIN RAIDER' } },
  aiPick, onReset: (f) => { f.relic = 0; f.relicGlow = 0; f.overload = false; f.grabT = null; f.daggerOn = false; f.giant = null; f.crushAcc = 0; },
  resource: (f) => relicV(f) >= 100 ? { v: 1, label: '유물', color: 0xa8fff0, full: true } : { v: relicV(f) / 100, label: '유물', color: 0x2ab8a0 },
  moveList: [['좌클 ×4', '유물 손등 치기 34 → 머리 위 내려찍기 42 (+충격 8) → 단검 두 번 12·12 + 앞차기 18 → 유물 주먹 30 + 결정 폭발 24'], ['공중 좌클', '거대한 손으로 땅을 내려찍어 청록 충격파 76'],
    ['우클 · 유물 포격', '누르고 있으면 결정 핵에 힘을 모은다 (최대 1.75초). 떼면 관통 광선 48 ~ 140 · 유물 게이지 가득이면 폭주 포격 (×1.35 · 굵기 ×1.5 · 받는 피해 +15% 4초)'],
    ['Shift · 도굴꾼의 손', '유물 손을 내뻗어 붙잡음 14 (방어 불가) → 상대 궁극기 게이지 최대 25 와 버프 하나를 빼앗아 유물 게이지 +35 → 땅에 내리꽂기 48 + 충격 18'],
    ['E · 연막 기습', '연막탄 (3초 · 안의 적 둔화) 으로 사라졌다가 상대 등 뒤에 나타나 단검 찌르기 40 (확정 치명타 · 출혈)'],
    ['Q · 유물 폭주 · 거인의 손', '건틀릿이 하늘에서 거대한 고대의 손으로 펼쳐져 내려와 움켜쥐고 (30 + 짓누르기 7×10) 마지막에 짓뭉갠다 165'],
    ['유물', '맞힐수록 쌓이고 (붙잡아 빼앗으면 +35) 가득 차면 다음 유물 포격이 폭주 포격'], ['C (타이밍) · 극한 회피', '도굴꾼의 반격: 돌며 손등 치기 52 → 바로 앞에서 결정 포 42'], ['가만히', '유물에 기대어 훔친 장신구를 들여다봄']],
  createModel: createModelWithRelic, poses, moves, hitFx,
};
