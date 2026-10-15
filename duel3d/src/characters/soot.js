// 수트 스파이럴 (SOOT SPIRAL) — 근거리 · 탱커 · 공간 장악
// 저주받은 바람과 모래의 들끓는 원소가 응결해 태어난 고대 골렘. 신전 영묘의 타고난 수호자.
// 무기: 양손 곁에 떠 있는 두 개의 원반 방패 — 밀쳐 치고, 맞부딪쳐 짓누르고, 던지면 부메랑처럼 돌아온다.
// 고유 게이지 「모래」: 때리거나 방벽으로 막을수록 차오르고, 가득 차면 다음 원반 투척이 쌍원반이 된다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx, clamp } from '../core.js';
import { createModel, sealTex, SCALE, DISC, TEAL, TEAL2, SAND, SAND2, NAVY } from './soot_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const SANDS = [SAND, SAND2, 0xc49a5a];

/* =====================================================================
   포즈 (weapon = 오른 원반 · handL = 왼 원반: 몸 기준 [피치(위+), 바깥(+), 롤] — 원반 앞면 법선 방향)
   원반 앞면: [0, 1.2, 0] 바깥 · [0, 0, 0] 앞 · [0, -1.57, 0] 안쪽(맞은편) · [1.5, 0, 0] 위 · [-1.5, 0, 0] 아래
   ===================================================================== */
const poses = {
  // 기본: 넓게 버티고 서서 두 팔을 늘어뜨림 — 원반은 손 곁에서 바깥을 향해 떠 있다
  base: { hips: [0, 0, 0], spine: [0.06, 0, 0], chest: [0.05, 0, 0], head: [0.02, 0, 0],
    shoulderL: [0.02, 0, 0.3], elbowL: [-0.42, 0, 0], handL: [0.08, 1.1, 0], shoulderR: [0.02, 0, -0.3], elbowR: [-0.42, 0, 0], weapon: [0.08, 1.1, 0],
    hipL: [-0.06, 0, 0.12], kneeL: [0.14, 0, 0], footL: [-0.08, 0, -0.1], hipR: [-0.06, 0, -0.12], kneeR: [0.14, 0, 0], footR: [-0.08, 0, 0.1] },
  run: { hips: [0, 0, 0], spine: [0.28, 0, 0], chest: [0.06, 0, 0], head: [-0.2, 0, 0], shoulderL: [0.1, 0, 0.35], elbowL: [-0.6, 0, 0], handL: [0.2, 0.9, 0], shoulderR: [0.1, 0, -0.35], elbowR: [-0.6, 0, 0], weapon: [0.2, 0.9, 0],
    hipL: [0, 0, 0.08], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, -0.08], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { spine: [0.1, 0, 0], hipL: [-1.0, 0, 0.15], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.15], kneeR: [1.3, 0, 0], shoulderL: [-0.5, 0, 0.75], elbowL: [-0.5, 0, 0], shoulderR: [-0.5, 0, -0.75], elbowR: [-0.5, 0, 0], handL: [-0.4, 1.0, 0], weapon: [-0.4, 1.0, 0] },
  // 방어: 두 원반을 앞으로 겹쳐 세운다
  guard: { hips: [0, 0, 0], spine: [0.15, 0, 0], chest: [0.08, 0, 0], head: [0.05, 0, 0], shoulderL: [-1.15, 0, 0.12], elbowL: [-0.75, 0, 0], handL: [0.05, 0.12, 0], shoulderR: [-1.1, 0, -0.12], elbowR: [-0.75, 0, 0], weapon: [0.05, 0.12, 0],
    hipL: [-0.45, 0, 0.18], kneeL: [0.7, 0, 0], hipR: [0.3, 0, -0.18], kneeR: [0.55, 0, 0] },
  hit: { spine: [-0.25, 0, 0], chest: [-0.12, 0.15, 0], head: [-0.25, 0, 0], shoulderL: [0.3, 0, 0.6], elbowL: [-0.4, 0, 0], shoulderR: [0.3, 0, -0.6], elbowR: [-0.4, 0, 0], handL: [0.4, 1.2, 0], weapon: [0.4, 1.2, 0] },
  air: { hips: [-0.4, 0, 0], spine: [-0.35, 0, 0], head: [-0.4, 0, 0], shoulderL: [0.5, 0, 0.9], shoulderR: [0.5, 0, -0.9], handL: [0.6, 1.2, 0], weapon: [0.6, 1.2, 0], hipL: [-0.8, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.8, hips: [-1.5, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.2, 0, 0], shoulderL: [-2.3, 0, 0.6], shoulderR: [-2.3, 0, -0.6], elbowL: [-0.3, 0, 0], elbowR: [-0.3, 0, 0], handL: [1.4, 0.4, 0], weapon: [1.4, 0.4, 0],
    hipL: [-0.1, 0, 0.18], kneeL: [0.3, 0, 0], hipR: [-0.4, 0, -0.15], kneeR: [0.8, 0, 0] },
  dash: { spine: [0.5, 0, 0], chest: [0.1, 0, 0], shoulderL: [0.6, 0, 0.4], shoulderR: [0.6, 0, -0.4], elbowL: [-0.3, 0, 0], elbowR: [-0.3, 0, 0], handL: [-0.2, 1.3, 0], weapon: [-0.2, 1.3, 0], hipL: [-0.8, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [0.4, 0, -0.1], kneeR: [1.0, 0, 0] },
  // 승리: 두 원반을 머리 위로 들어 맞대고 선다
  win: { hips: [0, 0, 0], spine: [-0.08, 0, 0], chest: [-0.06, 0, 0], head: [-0.25, 0, 0], shoulderL: [-2.7, 0, 0.35], elbowL: [-0.35, 0, 0], handL: [0.6, -1.2, 0], shoulderR: [-2.7, 0, -0.35], elbowR: [-0.35, 0, 0], weapon: [0.6, -1.2, 0] },
  portrait: { hips: [0, 0.2, 0], chest: [0, -0.15, 0], head: [0.05, 0.1, 0], shoulderL: [-0.9, 0, 0.35], elbowL: [-1.1, 0, 0], handL: [0.1, 0.25, 0], shoulderR: [-0.15, 0, -0.35], elbowR: [-0.5, 0, 0], weapon: [0.1, 1.2, 0] },
  // 오래 가만히 있으면: 고개를 숙이고 원반을 바닥에 세워 짚은 채 잠든 석상처럼 멈춘다
  idle2: { hipY: -0.04, spine: [0.15, 0, 0], chest: [0.1, 0, 0], head: [0.45, 0, 0], shoulderL: [-0.25, 0, 0.35], elbowL: [-0.5, 0, 0], handL: [0.0, 1.45, 0], shoulderR: [-0.25, 0, -0.35], elbowR: [-0.5, 0, 0], weapon: [0.0, 1.45, 0],
    hipL: [-0.15, 0, 0.14], kneeL: [0.3, 0, 0], hipR: [-0.15, 0, -0.14], kneeR: [0.3, 0, 0] },
  /* --- 기술 자세 --- */
  // 왼 원반 강타: 왼어깨를 뒤로 감았다가 → 앞으로 밀쳐 친다
  windL: { hips: [0, 0.3, 0], spine: [0.08, 0.25, 0], chest: [0.04, 0.3, 0], head: [0, -0.4, 0], shoulderL: [0.25, 0, 0.75], elbowL: [-1.3, 0, 0], handL: [0, 0.9, 0], shoulderR: [-0.4, 0, -0.35], elbowR: [-0.8, 0, 0], weapon: [0.1, 0.6, 0],
    hipL: [0.2, 0, 0.12], kneeL: [0.3, 0, 0], hipR: [-0.45, 0, -0.12], kneeR: [0.4, 0, 0] },
  bashL: { hips: [0, -0.3, 0], spine: [0.2, -0.3, 0], chest: [0.08, -0.35, 0], head: [0, 0.5, 0], shoulderL: [-1.5, 0, 0.05], elbowL: [-0.15, 0, 0], handL: [0.05, -0.2, 0], shoulderR: [0.2, 0, -0.45], elbowR: [-0.6, 0, 0], weapon: [0.1, 1.2, 0],
    hipL: [-0.6, 0, 0.14], kneeL: [0.6, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.3, 0, 0] },
  windR: { hips: [0, -0.3, 0], spine: [0.08, -0.25, 0], chest: [0.04, -0.3, 0], head: [0, 0.4, 0], shoulderR: [0.25, 0, -0.75], elbowR: [-1.3, 0, 0], weapon: [0, 0.9, 0], shoulderL: [-0.4, 0, 0.35], elbowL: [-0.8, 0, 0], handL: [0.1, 0.6, 0],
    hipR: [0.2, 0, -0.12], kneeR: [0.3, 0, 0], hipL: [-0.45, 0, 0.12], kneeL: [0.4, 0, 0] },
  bashR: { hips: [0, 0.3, 0], spine: [0.2, 0.3, 0], chest: [0.08, 0.35, 0], head: [0, -0.5, 0], shoulderR: [-1.5, 0, -0.05], elbowR: [-0.15, 0, 0], weapon: [0.05, -0.2, 0], shoulderL: [0.2, 0, 0.45], elbowL: [-0.6, 0, 0], handL: [0.1, 1.2, 0],
    hipR: [-0.6, 0, -0.14], kneeR: [0.6, 0, 0], hipL: [0.35, 0, 0.12], kneeL: [0.3, 0, 0] },
  // 맞부딪치기: 두 팔을 활짝 벌렸다가 → 앞에서 원반을 맞댄다
  spread: { hips: [0, 0, 0], spine: [-0.05, 0, 0], chest: [-0.1, 0, 0], head: [-0.1, 0, 0], shoulderL: [-0.9, 0, 1.25], elbowL: [-0.2, 0, 0], handL: [0, -1.4, 0], shoulderR: [-0.9, 0, -1.25], elbowR: [-0.2, 0, 0], weapon: [0, -1.4, 0],
    hipL: [-0.1, 0, 0.18], kneeL: [0.2, 0, 0], hipR: [-0.1, 0, -0.18], kneeR: [0.2, 0, 0] },
  clap: { hips: [0, 0, 0], spine: [0.25, 0, 0], chest: [0.1, 0, 0], head: [-0.2, 0, 0], shoulderL: [-1.45, 0, -0.08], elbowL: [-0.1, 0, 0], handL: [0, -1.57, 0], shoulderR: [-1.45, 0, 0.08], elbowR: [-0.1, 0, 0], weapon: [0, -1.57, 0],
    hipL: [-0.55, 0, 0.16], kneeL: [0.6, 0, 0], hipR: [0.3, 0, -0.16], kneeR: [0.35, 0, 0] },
  // 내려찍기: 두 원반을 머리 위로 → 땅에 찍어 모래 충격파
  raise: { hips: [0, 0, 0], spine: [-0.2, 0, 0], chest: [-0.12, 0, 0], head: [-0.3, 0, 0], shoulderL: [-2.85, 0, 0.3], elbowL: [-0.35, 0, 0], handL: [1.2, 0.3, 0], shoulderR: [-2.85, 0, -0.3], elbowR: [-0.35, 0, 0], weapon: [1.2, 0.3, 0],
    hipL: [-0.15, 0, 0.14], kneeL: [0.2, 0, 0], hipR: [-0.15, 0, -0.14], kneeR: [0.2, 0, 0] },
  slam: { hipY: -0.16, hips: [0, 0, 0], spine: [0.6, 0, 0], chest: [0.3, 0, 0], head: [-0.35, 0, 0], shoulderL: [-1.15, 0, 0.3], elbowL: [-0.1, 0, 0], handL: [-1.45, 0.3, 0], shoulderR: [-1.15, 0, -0.3], elbowR: [-0.1, 0, 0], weapon: [-1.45, 0.3, 0],
    hipL: [-0.95, 0, 0.2], kneeL: [1.1, 0, 0], footL: [-0.1, 0, 0], hipR: [-0.35, 0, -0.2], kneeR: [0.9, 0, 0], footR: [-0.3, 0, 0] },
  // 원반 던지기: 오른팔을 왼쪽으로 감았다가 → 옆으로 휘둘러 납작하게 던진다
  throwWind: { hips: [0, 0.45, 0], spine: [0.15, 0.4, 0], chest: [0.06, 0.45, 0], head: [0, -0.7, 0], shoulderR: [-1.25, 0, 0.55], elbowR: [-1.45, 0, 0], weapon: [1.45, 0, 0], shoulderL: [-0.2, 0, 0.5], elbowL: [-0.6, 0, 0], handL: [0.1, 1.1, 0],
    hipL: [-0.5, 0, 0.14], kneeL: [0.6, 0, 0], hipR: [0.3, 0, -0.14], kneeR: [0.35, 0, 0] },
  throwGo: { hips: [0, -0.35, 0], spine: [0.2, -0.3, 0], chest: [0.06, -0.4, 0], head: [0, 0.4, 0], shoulderR: [-1.5, 0, -0.75], elbowR: [-0.05, 0, 0], weapon: [1.45, 0.3, 0], shoulderL: [0.3, 0, 0.55], elbowL: [-0.6, 0, 0], handL: [0.1, 1.2, 0],
    hipL: [-0.6, 0, 0.14], kneeL: [0.55, 0, 0], hipR: [0.4, 0, -0.14], kneeR: [0.3, 0, 0] },
  // 방벽: 두 손을 앞으로 내밀어 원반을 세운다
  wall: { hips: [0, 0, 0], spine: [0.12, 0, 0], chest: [0.05, 0, 0], head: [0.05, 0, 0], shoulderL: [-1.3, 0, 0.35], elbowL: [-0.25, 0, 0], handL: [0, 0.1, 0], shoulderR: [-1.3, 0, -0.35], elbowR: [-0.25, 0, 0], weapon: [0, 0.1, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.6, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.45, 0, 0] },
  // 회오리: 두 팔을 옆으로 뻗고 원반 날을 세워 돈다
  spin: { hipY: -0.05, hips: [0, 0, 0], spine: [0.1, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], shoulderL: [-0.15, 0, 1.4], elbowL: [-0.1, 0, 0], handL: [0, 1.57, 0], shoulderR: [-0.15, 0, -1.4], elbowR: [-0.1, 0, 0], weapon: [0, 1.57, 0],
    hipL: [-0.3, 0, 0.25], kneeL: [0.45, 0, 0], hipR: [-0.3, 0, -0.25], kneeR: [0.45, 0, 0] },
  // 올려치기 (반격): 낮게 → 위로
  low: { hipY: -0.12, hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.2, 0, 0], head: [-0.4, 0, 0], shoulderL: [-0.5, 0, 0.25], elbowL: [-0.3, 0, 0], handL: [-1.1, 0.2, 0], shoulderR: [-0.5, 0, -0.25], elbowR: [-0.3, 0, 0], weapon: [-1.1, 0.2, 0],
    hipL: [-0.9, 0, 0.18], kneeL: [1.1, 0, 0], hipR: [0.2, 0, -0.18], kneeR: [0.7, 0, 0] },
  upper: { hips: [0, 0, 0], spine: [-0.2, 0, 0], chest: [-0.15, 0, 0], head: [-0.35, 0, 0], shoulderL: [-2.5, 0, 0.15], elbowL: [-0.2, 0, 0], handL: [0.9, -0.3, 0], shoulderR: [-2.5, 0, -0.15], elbowR: [-0.2, 0, 0], weapon: [0.9, -0.3, 0],
    hipL: [-0.3, 0, 0.14], kneeL: [0.25, 0, 0], hipR: [0.25, 0, -0.14], kneeR: [0.1, 0, 0] },
  // 봉인 (궁극기): 두 팔을 하늘로 벌려 원반을 띄운다 → 주먹을 모아 짓누른다
  summon: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.15, 0, 0], head: [-0.4, 0, 0], shoulderL: [-2.4, 0, 0.9], elbowL: [-0.2, 0, 0], handL: [1.2, 0.6, 0], shoulderR: [-2.4, 0, -0.9], elbowR: [-0.2, 0, 0], weapon: [1.2, 0.6, 0] },
  crush: { hipY: -0.06, hips: [0, 0, 0], spine: [0.3, 0, 0], chest: [0.15, 0, 0], head: [-0.2, 0, 0], shoulderL: [-1.5, 0, -0.15], elbowL: [-0.5, 0, 0], handL: [0, -1.4, 0], shoulderR: [-1.5, 0, 0.15], elbowR: [-0.5, 0, 0], weapon: [0, -1.4, 0],
    hipL: [-0.6, 0, 0.2], kneeL: [0.7, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.5, 0, 0] },
};

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const sand = (f) => f.sand || 0;
const gainSand = (f, v) => { f.sand = Math.min(100, sand(f) + v); };
const glow = (f, k) => { f.glowK = k; };
function sandBurst(G, p, n = 14, sp = 4, up = 1) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3), rand(0, 0.3), rand(-0.3, 0.3))), { vel: [rand(-sp, sp), rand(0.3, 1) * sp * up, rand(-sp, sp)], size: rand(0.08, 0.18), size1: 0.03, life: rand(0.5, 1.0), color: SANDS[i % 3], alpha: 0.85, drag: 2, grav: 4 }); G.fx.burst(p, Math.round(n * 0.6), 0xb89a68, sp * 0.9, { kind: 'dust', sk: 1.3 }); }
function tealSpark(G, p, n = 8, sp = 3) { for (let i = 0; i < n; i++) G.fx.p(p.clone(), { vel: [rand(-sp, sp), rand(-sp, sp), rand(-sp, sp)], size: rand(0.06, 0.12), size1: 0.02, life: rand(0.25, 0.5), color: i % 2 ? TEAL : TEAL2, alpha: 0.9, drag: 3 }); }
// 지면 모래 충격파: 링 + 사방으로 튀는 모래
function sandWave(G, c, r, color = SAND) {
  G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.3, r1: r * 1.2, life: 0.45, color });
  G.fx.ring(c.clone().setY(c.y + 0.08), { normal: UP, r0: 0.2, r1: r * 0.75, life: 0.32, color: TEAL });
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + rand(0, 0.3), d = new V3(Math.cos(a), 0, Math.sin(a)), p = c.clone().addScaledVector(d, rand(0.3, r * 0.6)); G.fx.p(p.setY(c.y + 0.1), { vel: [d.x * rand(3, 7), rand(2, 6), d.z * rand(3, 7)], size: rand(0.15, 0.3), size1: 0.05, life: rand(0.5, 0.9), color: SANDS[i % 3], alpha: 0.85, drag: 2, grav: 9 }); }
  G.fx.burst(c, 24, 0xb89a68, 6, { kind: 'dust', sk: 1.8 });
}
// 원반 위치 (월드): side = -1 오른 원반 · 1 왼 원반
const discAt = (f, side, out = new V3()) => f.model.discPt(out, side, 0, 0, 0);

/* ---------- 원반 투척: 부메랑처럼 날아갔다가 돌아온다 (가는 길 · 오는 길 따로 적중) ---------- */
class ThrownDisc {
  constructor(G, f, side, o = {}) {
    this.G = G; this.f = f; this.side = side; this.o = o; this.t = 0; this.done = false; this.phase = 0; this.hitOut = new Set(); this.hitBack = new Set();
    this.mesh = f.model.makeDisc(); this.mesh.scale.setScalar(f.scale * (o.big ? 1.25 : 1.1)); G.scene.add(this.mesh); this.mesh.traverse((q) => { if (q.isMesh) q.castShadow = true; });
    this.pos = discAt(f, side); this.mesh.position.copy(this.pos);
    const fw = f.fwd(new V3()); let aim = f.local([0, 1.15 * f.scale, 8]);
    const tg = f.opp; if (tg && !tg.gone && tg.state !== 'ko' && f.dist() < 13) aim = tg.chest(new V3());
    this.dir = aim.clone().sub(this.pos); const L = this.dir.length(); this.dir.normalize(); if (this.dir.dot(fw) < 0.3) this.dir.copy(fw);
    this.reach = clamp(L + 1.5, 5, 11); this.from = this.pos.clone(); this.speed = 19; this.travel = 0;
    this.sideV = new V3(this.dir.z, 0, -this.dir.x).multiplyScalar(-side); // 바깥으로 살짝 휘는 궤도
    (side < 0 ? f.model.setWeapon : f.model.setDiscL)(false); f.discOut = (f.discOut || 0) + 1;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    if (f.gone || f.state === 'ko' || this.t > 3.2) return this.kill();
    if (this.phase === 0) {
      this.travel += this.speed * dt; const k = Math.min(1, this.travel / this.reach);
      this.pos.copy(this.from).addScaledVector(this.dir, this.travel).addScaledVector(this.sideV, Math.sin(k * Math.PI) * 1.2);
      if (k >= 1 || (G.stage && G.stage.world && G.stage.world.solidAt(this.pos, 0.3))) { this.phase = 1; sfx('block'); sandBurst(G, this.pos, 10, 3); tealSpark(G, this.pos, 10, 4); if (this.o.burst) this.burstAt(); }
    } else {
      const home = discAt(f, this.side, new V3()), d = home.clone().sub(this.pos), L = d.length(); this.speed = Math.min(30, this.speed + dt * 22);
      if (L < 0.5) return this.kill(true);
      this.pos.addScaledVector(d.normalize(), Math.min(L, this.speed * dt));
    }
    this.mesh.position.copy(this.pos); this.mesh.userData.spin.rotation.z += dt * 26;
    this.mesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), new V3(-this.side * 0.25, 1, 0).normalize()); // 납작하게 누워 돈다
    if (Math.random() < 0.8) G.fx.p(this.pos.clone().add(new V3(rand(-0.3, 0.3), rand(-0.1, 0.1), rand(-0.3, 0.3))), { vel: [0, 0.5, 0], size: rand(0.12, 0.24), size1: 0.03, life: 0.4, color: SANDS[(Math.random() * 3) | 0], alpha: 0.7, drag: 1 });
    const set = this.phase ? this.hitBack : this.hitOut, R = 0.62 * f.scale * (this.o.big ? 1.15 : 1);
    for (const t of f.foes()) { if (set.has(t.id) || !t.hurtHit(this.pos, R)) continue; set.add(t.id);
      const dmg = this.phase ? this.o.back ?? 40 : this.o.out ?? 46, dir = this.phase ? new V3().subVectors(f.pos, t.pos).setY(0).normalize() : this.dir.clone().setY(0).normalize();
      const r = t.takeHit(f, { dmg, kb: this.phase ? [3.5, 0] : [2.5, 0], stun: 0.45, hs: 0.06, daze: 16, snd: 'heavy' }, dir);
      if (r) { G.fx.impact(this.pos, TEAL, 1.2, dir); sandBurst(G, this.pos, 8, 3); } }
  }
  burstAt() { // 모래 가득: 되돌아서는 자리에서 모래 폭발 (둔화)
    const G = this.G, f = this.f, c = this.pos.clone().setY(Math.max(0, this.pos.y - 1.1)); sfx('boom'); G.shake(0.15); sandWave(G, c, 2.2);
    for (const t of f.foes()) { const d = Math.hypot(t.pos.x - c.x, t.pos.z - c.z); if (d > 2.2 + 0.4 * t.scale || t.pos.y - c.y > 2.5) continue; t.takeHit(f, { dmg: 24, kb: [1.5, 2], stun: 0.5, daze: 12, noCrit: true }, new V3(t.pos.x - c.x, 0, t.pos.z - c.z).normalize()); t.addStatus('slow', 2.2, 0.6, f); }
  }
  kill(caught) {
    if (this.done) return; this.done = true; this.G.scene.remove(this.mesh);
    const f = this.f; (this.side < 0 ? f.model.setWeapon : f.model.setDiscL)(true); f.discOut = Math.max(0, (f.discOut || 1) - 1);
    if (caught) { sfx('block'); tealSpark(this.G, discAt(f, this.side), 8, 2); }
  }
}

/* ---------- 원반 방벽: 앞에 나란히 선 두 원반 + 모래 문자 벽 (투사체 차단 · 받는 피해 감소) ---------- */
let _sealTex = null;
const seal = () => _sealTex || (_sealTex = sealTex());
class ShieldWall {
  constructor(G, f, life) {
    this.G = G; this.f = f; this.life = life; this.t = 0; this.done = false; f.wallT = life; this.seen = new Map();
    this.mat = new THREE.MeshBasicMaterial({ map: seal(), color: TEAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), this.mat); G.scene.add(this.mesh);
    f.addStatus('vuln', life, 0.5, f);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; f.wallT = Math.max(0, this.life - this.t);
    if (this.t > this.life || f.state === 'ko' || f.gone) return this.kill();
    const k = f.model.wallK || 0; this.mesh.position.copy(f.local([0, 1.31, 1.25])); this.mesh.rotation.set(0, f.yaw, this.t * 0.6);
    this.mat.opacity = 0.32 * k * (0.85 + 0.15 * Math.sin(this.t * 9)) * Math.min(1, (this.life - this.t) / 0.3);
    if (Math.random() < 0.5 * k) { const p = f.local([rand(-1.1, 1.1), rand(0.3, 2.3), 1.2 * f.scale]); G.fx.p(p, { vel: [rand(-0.3, 0.3), rand(0.2, 0.8), 0], size: rand(0.06, 0.12), size1: 0.02, life: 0.5, color: Math.random() < 0.5 ? TEAL : SAND2, alpha: 0.8, drag: 1 }); }
    if (k < 0.5) return;
    // 투사체 차단: 앞쪽 벽 영역을 지나는 상대편 비행체를 부순다
    const fw = f.fwd(new V3()), rt = f.right(new V3());
    for (const e of G.ents) {
      if (e === this || e.done || !e.pos || !e.pos.isVector3) continue; const ow = e.owner || e.f; if (!ow || ow.team === undefined || ow.team === f.team) continue;
      const prev = this.seen.get(e), sp = prev ? prev.distanceTo(e.pos) / Math.max(dt, 1e-4) : 0; this.seen.set(e, e.pos.clone());
      if (!prev || sp < 4) continue;
      const d = new V3().subVectors(e.pos, f.pos), fz = d.dot(fw), sx = Math.abs(d.dot(rt)), y = e.pos.y - f.pos.y;
      if (fz > 0.2 && fz < 2.2 * f.scale && sx < 1.5 * f.scale && y > -0.2 && y < 2.8 * f.scale) {
        try { e.kill(); } catch (err) { e.done = true; }
        e.done = true; sfx('block'); G.fx.impact(e.pos.clone(), TEAL, 1.1); sandBurst(G, e.pos.clone(), 8, 3); gainSand(f, 12); G.hud.damage(e.pos.clone(), '차단', false, true);
      }
    }
  }
  kill() { if (this.done) return; this.done = true; this.f.wallT = 0; this.G.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

/* ---------- 모래 소용돌이: 몸을 중심으로 도는 모래 회오리 (끌어당김 · 연속 피해 · 둔화) ---------- */
let _swirl = null;
function swirlTex() {
  if (_swirl) return _swirl; const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) { const y = Math.random() * 256, a = 0.25 + Math.random() * 0.5; g.strokeStyle = `rgba(${200 + Math.random() * 40},${170 + Math.random() * 40},${110 + Math.random() * 30},${a})`; g.lineWidth = 3 + Math.random() * 9; g.beginPath(); g.moveTo(-20, y); g.bezierCurveTo(80, y - 30, 170, y + 30, 276, y - 10); g.stroke(); }
  _swirl = new THREE.CanvasTexture(c); _swirl.wrapS = _swirl.wrapT = THREE.RepeatWrapping; _swirl.colorSpace = THREE.SRGBColorSpace; return _swirl;
}
class SandVortex {
  constructor(G, f, life) {
    this.G = G; this.f = f; this.life = life; this.t = 0; this.done = false; this.tick = 0.2; this.R = 2.5 * f.scale; this.PULL = 5.2 * f.scale;
    this.mat = new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.funnel = new THREE.Mesh(new THREE.CylinderGeometry(this.R * 1.05, this.R * 0.45, 3.4 * f.scale, 36, 4, true), this.mat); G.scene.add(this.funnel);
    this.mat2 = this.mat.clone(); this.mat2.map = swirlTex().clone(); this.mat2.map.needsUpdate = true; this.mat2.map.repeat.set(2, 1);
    this.inner = new THREE.Mesh(new THREE.CylinderGeometry(this.R * 0.6, this.R * 0.25, 2.6 * f.scale, 28, 3, true), this.mat2); G.scene.add(this.inner);
    this.gm = new THREE.MeshBasicMaterial({ map: seal(), color: SAND, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(this.R * 1.2, 48), this.gm); this.ground.rotation.x = -Math.PI / 2; G.scene.add(this.ground);
    f.vortexT = life;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; f.vortexT = Math.max(0, this.life - this.t); this.tick -= dt;
    if (this.t > this.life || f.state === 'ko' || f.gone) return this.kill();
    const c = f.pos, k = Math.min(1, this.t / 0.3) * Math.min(1, (this.life - this.t) / 0.4 + 0.05), H = 3.4 * f.scale;
    this.funnel.position.set(c.x, c.y + H / 2, c.z); this.inner.position.set(c.x, c.y + 1.3 * f.scale, c.z); this.ground.position.set(c.x, c.y + 0.04, c.z);
    this.funnel.rotation.y -= dt * 7; this.inner.rotation.y -= dt * 11; this.ground.rotation.z += dt * 2;
    this.mat.map.offset.y = (this.mat.map.offset.y + dt * 0.4) % 1; this.mat.opacity = 0.62 * k; this.mat2.opacity = 0.5 * k; this.gm.opacity = 0.45 * k;
    for (let i = 0; i < 3; i++) { const a = this.t * 7 + i * 2.1 + rand(0, 0.6), r = rand(0.5, 1.1) * this.R, y = rand(0.05, H), p = new V3(c.x + Math.cos(a) * r, c.y + y, c.z + Math.sin(a) * r), tg = new V3(-Math.sin(a), 0.4, Math.cos(a)).multiplyScalar(-6).addScaledVector(new V3(-Math.cos(a), 0, -Math.sin(a)), 2);
      G.fx.p(p, { vel: [tg.x, tg.y, tg.z], size: rand(0.1, 0.24), size1: 0.03, life: 0.5, color: SANDS[i], alpha: 0.85, drag: 1 }); }
    // 끌어당김
    for (const t of f.foes()) { const d = new V3().subVectors(c, t.pos).setY(0), L = d.length(); if (L > this.PULL || t.held || t.pos.y - c.y > 3) continue;
      if (L > 1.0 * f.scale) t.pos.addScaledVector(d.normalize(), Math.min(L - 1.0 * f.scale, (L > this.R ? 4.2 : 2.6) * dt * (t.scale > 1.2 ? 0.5 : 1))); }
    if (this.tick <= 0) { this.tick = 0.35; sfx('swing');
      for (const t of f.foes()) if (Math.hypot(t.pos.x - c.x, t.pos.z - c.z) < this.R + 0.4 * t.scale && t.pos.y - c.y < 3) { t.takeHit(f, { dmg: 8, kb: [0, 0], stun: 0.3, daze: 5, hs: 0.02, noCrit: true }, new V3().subVectors(c, t.pos).setY(0).normalize()); t.addStatus('slow', 1.0, 0.55, f); } }
  }
  kill() { if (this.done) return; this.done = true; this.f.vortexT = 0; for (const o of [this.funnel, this.inner, this.ground]) { this.G.scene.remove(o); o.geometry.dispose(); } this.mat.dispose(); this.mat2.map.dispose(); this.mat2.dispose(); this.gm.dispose(); }
}

/* ---------- 궁극기: 영묘의 봉인 — 거대한 문자 원 · 두 원반이 거대해져 대상을 사이에 두고 짓누른다 ---------- */
class MausoleumSeal {
  constructor(G, f, tg) {
    this.G = G; this.f = f; this.tg = tg; this.t = 0; this.done = false;
    const c = tg ? tg.pos.clone().setY(0) : f.local([0, 0, 4]).setY(0); this.c = c;
    this.gm = new THREE.MeshBasicMaterial({ map: seal(), color: TEAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.circle = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), this.gm); this.circle.rotation.x = -Math.PI / 2; this.circle.position.copy(c).setY(c.y + 0.05); G.scene.add(this.circle);
    this.gm2 = this.gm.clone(); this.gm2.color = new THREE.Color(SAND2); this.circle2 = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), this.gm2); this.circle2.rotation.x = -Math.PI / 2; this.circle2.position.copy(c).setY(c.y + 0.07); G.scene.add(this.circle2);
    // 대상의 좌우 축 (소환자 → 대상 방향에 수직)
    const d = c.clone().sub(f.pos).setY(0); if (d.lengthSq() < 1e-4) f.fwd(d); d.normalize(); this.ax = new V3(d.z, 0, -d.x); this.fw = d;
    this.discs = [-1, 1].map((s) => { const m = f.model.makeDisc(); m.visible = false; G.scene.add(m); return m; });
  }
  // 0~0.55 문자 원 · 0.55~1.25 원반이 떠올라 커지며 양옆으로 · 1.25~1.75 잠깐 멈춤 · 1.75~1.95 쾅 · ~2.5 짓누름 · 2.55 모래 분출
  update(dt) {
    const G = this.G, f = this.f, t = (this.t += dt), c = this.c, BIG = 4.2;
    const k0 = Math.min(1, t / 0.4); this.gm.opacity = 0.75 * k0 * (t > 2.6 ? Math.max(0, 1 - (t - 2.6) / 0.6) : 1); this.gm2.opacity = 0.55 * k0 * (t > 2.6 ? Math.max(0, 1 - (t - 2.6) / 0.6) : 1);
    this.circle.rotation.z += dt * 0.8; this.circle2.rotation.z -= dt * 1.6;
    if (t < 1.4 && Math.random() < 0.8) { const a = rand(0, TAU), r = rand(0.5, 4.4); G.fx.p(c.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), { vel: [0, rand(1.5, 4), 0], size: rand(0.08, 0.16), size1: 0.02, life: 0.7, color: Math.random() < 0.5 ? TEAL : SAND2, alpha: 0.85, drag: 0.5 }); }
    if (t >= 0.55) {
      const from = (s) => discAt(f, s, new V3());
      this.discs.forEach((m, i) => { const s = i ? 1 : -1; m.visible = t < 3.0;
        let p, sc; const side = this.ax.clone().multiplyScalar(s);
        if (t < 1.25) { const k = (t - 0.55) / 0.7, e = k * k * (3 - 2 * k); p = from(s).lerp(c.clone().addScaledVector(side, 3.6).setY(2.4), e); p.y += Math.sin(k * Math.PI) * 1.5; sc = f.scale * (1 + (BIG - 1) * e); }
        else if (t < 1.75) { p = c.clone().addScaledVector(side, 3.6 + 0.25 * (t - 1.25) / 0.5).setY(2.4 + 0.08 * Math.sin(t * 20)); sc = f.scale * BIG; }
        else if (t < 1.95) { const k = (t - 1.75) / 0.2; p = c.clone().addScaledVector(side, 3.85 - (3.85 - 0.62) * k * k).setY(2.4 - 0.6 * k); sc = f.scale * BIG; }
        else if (t < 2.55) { p = c.clone().addScaledVector(side, 0.62 + 0.04 * Math.sin(t * 60)).setY(1.8); sc = f.scale * BIG; }
        else { const k = Math.min(1, (t - 2.55) / 0.45); p = c.clone().addScaledVector(side, 0.62 + 2.6 * k).setY(1.8 - 2.6 * k * k); sc = f.scale * BIG * (1 - 0.3 * k); }
        m.position.copy(p); m.scale.setScalar(sc); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), side.clone().negate()); m.userData.spin.rotation.z += dt * (t < 1.75 ? 3 : 0.5);
      });
    }
    if (t > 3.2) this.kill();
  }
  kill() { if (this.done) return; this.done = true; for (const o of [this.circle, this.circle2]) { this.G.scene.remove(o); o.geometry.dispose(); } this.gm.dispose(); this.gm2.dispose(); for (const m of this.discs) this.G.scene.remove(m); const tg = this.tg; if (tg && tg.held) tg.release(); }
}

/* =====================================================================
   기술 — 느린 탱커 · 공간 장악: 원반 강타 · 맞부딪치기 · 내려찍기 · 부메랑 원반 · 방벽 · 모래 회오리
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 두 원반을 아래로 세우고 떨어져 모래 충격파 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.slam, hipY: 0, spine: [0.3, 0, 0], chest: [0.1, 0, 0], hipL: [-1.0, 0, 0.15], kneeL: [1.4, 0, 0], hipR: [-0.5, 0, -0.15], kneeR: [1.2, 0, 0] },
    land: 'slam', color: SAND, dmg: 74, r: 2.7,
    fx: (f, o, G, c) => { sandWave(G, c, 2.7); tealSpark(G, c.clone().setY(c.y + 0.3), 14, 4); },
  }),

  /* --- 기본 공격 (원반 4연격): 왼 원반 강타 → 오른 원반 강타 → 맞부딪치기 → 내려찍기 + 모래 충격파 --- */
  light1: { dur: 0.5, cancel: 0.27, next: 'light2', track: 0.12, move: 0.2,
    keys: [[0, 'windL'], [0.13, 'windL'], [0.22, 'bashL'], [0.36, {}], [0.5, 'base']], lunge: [[0.14, 0.24, 5]],
    ev: [[0.15, () => sfx('swing')], [0.22, (f, o, G) => { const p = discAt(f, 1); sandBurst(G, p, 6, 2); f.slashFx({ tilt: 1.3, r: 1.4, at: [-0.35, 1.25, 1.1], color: SAND2, life: 0.2 }); }]],
    hits: [{ t0: 0.18, t1: 0.3, weapon: false, at: [-0.3, 1.0, 1.15], r: 0.72, dmg: 38, snd: 'heavy' }] },
  light2: { dur: 0.52, cancel: 0.28, next: 'light3', track: 0.12, move: 0.2,
    keys: [[0, 'windR'], [0.12, 'windR'], [0.21, 'bashR'], [0.36, {}], [0.52, 'base']], lunge: [[0.13, 0.23, 5]],
    ev: [[0.14, () => sfx('swing')], [0.21, (f, o, G) => { const p = discAt(f, -1); sandBurst(G, p, 6, 2); f.slashFx({ tilt: -1.3, r: 1.4, at: [0.35, 1.25, 1.1], color: SAND2, life: 0.2, flip: true }); }]],
    hits: [{ t0: 0.17, t1: 0.29, weapon: false, at: [0.3, 1.0, 1.15], r: 0.72, dmg: 40, snd: 'heavy' }] },
  light3: { dur: 0.64, cancel: 0.4, next: 'light4', track: 0.2, move: 0.15,
    keys: [[0, 'spread'], [0.22, { ...poses.spread, shoulderL: [-1.0, 0, 1.35], shoulderR: [-1.0, 0, -1.35] }], [0.3, 'clap'], [0.46, {}], [0.64, 'base']], lunge: [[0.22, 0.3, 4]],
    ev: [[0.08, () => sfx('charge')], [0.3, (f, o, G) => { sfx('block'); sfx('heavy'); G.shake(0.12); const p = discAt(f, -1).lerp(discAt(f, 1), 0.5); tealSpark(G, p, 14, 5); sandBurst(G, p, 14, 4); G.fx.ring(p, { r0: 0.1, r1: 1.6, life: 0.25, color: TEAL, billboard: true }); }]],
    hits: [{ t0: 0.27, t1: 0.36, weapon: false, at: [0, 1.1, 1.05], r: 0.8, dmg: 44, hs: 0.1, snd: 'big' }] },
  light4: { dur: 0.9, track: 0.25, noMove: true, shout: true,
    keys: [[0, 'raise'], [0.28, { ...poses.raise, spine: [-0.28, 0, 0] }], [0.4, 'slam'], [0.68, {}], [0.9, 'base']],
    start: (f) => { glow(f, 0.7); sfx('charge'); },
    ev: [[0.4, (f, o, G) => { sfx('boom'); sfx('heavy'); G.shake(0.3); const c = f.local([0, 0, 1.35 * f.scale]); c.y = f.pos.y; sandWave(G, c, 2.6); tealSpark(G, c.clone().setY(c.y + 0.3), 12, 4);
      areaHit(f, c, 2.4 * f.scale, { dmg: 28, kb: [3, 3], stun: 0.5, hs: 0.06, daze: 14 }, 1.2); }], [0.7, (f) => glow(f, 0)]],
    hits: [{ t0: 0.36, t1: 0.45, weapon: false, at: [0, 0.55, 1.15], r: 0.85, dmg: 34, snd: 'big' }],
    end: (f) => glow(f, 0) },

  /* --- 우클: 원반 투척 — 오른 원반을 납작하게 던진다. 날아가며 한 번, 돌아오며 한 번. 모래가 가득 차면 쌍원반 + 모래 폭발 --- */
  heavy: { dur: 0.62, cd: 'heavy', track: 0.24, aim: true, move: 0.15,
    keys: [[0, 'throwWind'], [0.24, 'throwWind'], [0.32, 'throwGo'], [0.48, {}], [0.62, 'base']],
    start: (f, o, G) => { f.empThrow = sand(f) >= 100; if (f.empThrow) { f.sand = 0; G.say(f, '"…모래여, 돌아오라."'); } glow(f, 0.8); sfx('charge'); },
    ev: [[0.3, (f, o, G) => { sfx('swing'); sfx('dash');
      if (f.empThrow) { G.spawn(new ThrownDisc(G, f, -1, { out: 36, back: 30, big: true, burst: true })); G.spawn(new ThrownDisc(G, f, 1, { out: 36, back: 30, big: true, burst: false })); }
      else G.spawn(new ThrownDisc(G, f, -1, { out: 50, back: 44 })); }], [0.5, (f) => glow(f, 0)]],
    end: (f) => { glow(f, 0); f.empThrow = false; } },

  /* --- Shift: 원반 방벽 — 두 원반을 앞에 나란히 세운다 (4.5초: 투사체 차단 · 받는 피해 50% 감소). 세우는 순간 앞을 밀쳐 친다 --- */
  s1: { dur: 0.7, cd: 's1', aim: true, shout: true, noMove: true,
    keys: [[0, 'guard'], [0.2, 'wall'], [0.5, {}], [0.7, 'wall']],
    start: (f, o, G) => { G.say(f, '"…영묘의 문은 닫혀 있다."'); glow(f, 1); sfx('charge'); },
    ev: [[0.22, (f, o, G) => { sfx('block'); sfx('heavy'); G.shake(0.14); G.spawn(new ShieldWall(G, f, 4.5)); const c = f.local([0, 0.05, 1.3 * f.scale]); sandWave(G, c, 1.6); tealSpark(G, f.local([0, 1.3, 1.2 * f.scale]), 18, 4); }], [0.6, (f) => glow(f, 0)]],
    hits: [{ t0: 0.22, t1: 0.34, weapon: false, at: [0, 1.0, 1.1], r: 0.95, dmg: 40, kb: [6.5, 0.5], stun: 0.5, hs: 0.08, daze: 18, snd: 'big' }],
    end: (f) => glow(f, 0) },

  /* --- E: 모래 소용돌이 — 원반 날을 세우고 돌며 모래 회오리를 일으킨다 (끌어당김 · 0.35초마다 8 · 둔화, 3.5초 동안 몸을 따라다님) --- */
  s2: { dur: 1.25, cd: 's2', aim: false, shout: true, move: 0.35,
    keys: [[0, { ...poses.spin, shoulderL: [-0.6, 0, 0.9], shoulderR: [-0.6, 0, -0.9] }], [0.15, 'spin'], [1.05, 'spin'], [1.25, 'base']],
    start: (f, o, G) => { G.say(f, '"흩어져라, 저주받은 바람."'); glow(f, 1); sfx('charge'); f.spinYaw = f.yaw; },
    tick: (f, o, G, t, dt) => { if (t > 0.12 && t < 1.08) { f.yaw += dt * 13; if (Math.random() < 0.7) for (const s of [-1, 1]) G.fx.p(discAt(f, s), { vel: [0, 0.6, 0], size: 0.25, size1: 0.05, life: 0.35, color: SANDS[(Math.random() * 3) | 0], alpha: 0.7, drag: 1 }); }
      else if (t >= 1.08 && o) f.faceOpp(12, dt); },
    ev: [[0.18, (f, o, G) => { sfx('zap'); G.spawn(new SandVortex(G, f, 3.5)); sandWave(G, f.pos.clone(), 2.4); }], [0.5, () => sfx('swing')], [0.85, () => sfx('swing')], [1.1, (f) => glow(f, 0)]],
    hits: [{ t0: 0.2, t1: 0.5, weapon: false, at: [0, 1.0, 0], r: 1.55, dmg: 22, kb: [-2, 0], stun: 0.4, daze: 10 }, { t0: 0.7, t1: 1.0, weapon: false, at: [0, 1.0, 0], r: 1.55, dmg: 22, kb: [-2, 0], stun: 0.4, daze: 10 }],
    end: (f) => glow(f, 0) },

  /* --- 극한 회피 뒤 좌클: 모래 역습 — 모래가 되어 파고든 뒤 두 원반으로 올려친다 --- */
  counter: { dur: 0.66, aim: true, noMove: true,
    keys: [[0, 'low'], [0.14, 'low'], [0.24, 'upper'], [0.5, {}], [0.66, 'base']],
    ev: [[0, (f, o, G) => { const from = f.chest(); if (o) { const d = new V3().subVectors(o.pos, f.pos).setY(0); const L = d.length(); d.normalize(); if (L > 1.6 * f.scale) f.pos.addScaledVector(d, L - 1.4 * f.scale); f.yaw = Math.atan2(d.x, d.z); }
      sandBurst(G, from, 18, 4); sandBurst(G, f.chest(), 14, 3); sfx('dash'); G.flash(SAND2, 0.18); f.model.resetCloth(); glow(f, 1); }],
      [0.22, (f, o, G) => { sfx('heavy'); sfx('block'); const p = f.local([0, 1.4, 1.1 * f.scale]); tealSpark(G, p, 16, 5); f.slashFx({ tilt: Math.PI / 2, r: 1.8, at: [0, 1.4, 1.0], color: SAND2, life: 0.28 }); }], [0.5, (f) => glow(f, 0)]],
    hits: [{ t0: 0.18, t1: 0.32, weapon: false, at: [0, 1.0, 1.1], r: 0.95, dmg: 92, kb: [3, 9], stun: 0.6, hs: 0.14, shake: 0.2, daze: 40, snd: 'big' }],
    end: (f) => glow(f, 0) },

  /* --- Q: 영묘의 봉인 — 대상 발밑에 거대한 문자 원. 두 원반이 거대해져 대상을 사이에 두고 짓누르고, 모래가 솟구친다 --- */
  ult: { dur: 3.4, ult: true, aim: true, shout: true,
    keys: [[0, 'base'], [0.35, 'summon'], [1.6, 'summon'], [1.8, 'crush'], [2.5, 'crush'], [2.65, { ...poses.raise, shoulderL: [-2.6, 0, 0.9], shoulderR: [-2.6, 0, -0.9] }], [3.0, 'win'], [3.4, 'base']],
    cam: [[0, { ref: 'self', p: [1.2, 1.4, 3.6], l: [0, 1.9, 0], fov: 42 }], [0.5, { ref: 'self', p: [0.8, 1.0, 3.0], l: [0, 2.3, 0], fov: 46 }],
      [0.8, { ref: 'target', p: [0.8, 3.2, 8.5], l: [0, 1.7, 0], fov: 58 }], [1.7, { ref: 'target', p: [0.4, 2.4, 7.0], l: [0, 1.8, 0], fov: 54 }],
      [2.0, { ref: 'target', p: [0.2, 1.9, 5.2], l: [0, 1.6, 0], fov: 50 }], [2.6, { ref: 'target', p: [0.6, 2.2, 6.0], l: [0, 1.7, 0], fov: 52 }], [3.4, { ref: 'target', p: [2.0, 4.6, 9.0], l: [0, 1.5, 0], fov: 60 }]],
    ev: [
      [0, (f, o, G) => { const tg = o && !o.gone && o.state !== 'ko' ? o : null; f.ultTgt = tg; if (tg) { tg.lock(); if (tg.pos.y < 0.2) tg.pos.y = 0; tg.faceOpp && tg.faceOpp(); }
        G.setTint(0x8a6a30, 0.3); glow(f, 1); sfx('charge'); G.say(f, '"…이곳에 잠들어라."'); f.ultSeal = new MausoleumSeal(G, f, tg); G.spawn(f.ultSeal); }],
      [0.55, (f, o, G) => { f.model.setWeapon(false); f.model.setDiscL(false); sfx('zap'); for (const s of [-1, 1]) { sandBurst(G, f.local([s * -0.6, 1.2, 0.4]), 12, 3); } }],
      [1.0, (f, o, G) => { sfx('charge'); G.shake(0.12); }],
      [1.93, (f, o, G) => { o = f.ultTgt; sfx('boom'); sfx('block'); sfx('big'); G.shake(0.55); G.flash(0xffffff, 0.35); G.hitstop = Math.max(G.hitstop || 0, 0.08);
        const c = o ? o.chest(new V3()) : f.local([0, 1.4, 4]); tealSpark(G, c, 30, 7); sandBurst(G, c, 30, 6); G.fx.light(c, TEAL, 160, 0.5, 18);
        if (o) o.takeHit(f, { dmg: 40, kb: [0, 0], stun: 99, hs: 0.1, nokill: true, noScale: true, force: true, noCrit: true, daze: 20, snd: 'big' }, f.fwd(new V3())); }],
      [2.15, (f, o, G) => { o = f.ultTgt; sfx('heavy'); G.shake(0.25); if (o) o.takeHit(f, { dmg: 18, kb: [0, 0], stun: 99, hs: 0.04, nokill: true, noScale: true, force: true, noCrit: true, daze: 10 }, f.fwd(new V3())); }],
      [2.35, (f, o, G) => { o = f.ultTgt; sfx('heavy'); G.shake(0.25); if (o) o.takeHit(f, { dmg: 18, kb: [0, 0], stun: 99, hs: 0.04, nokill: true, noScale: true, force: true, noCrit: true, daze: 10 }, f.fwd(new V3())); }],
      [2.58, (f, o, G) => { o = f.ultTgt; const c = f.ultSeal ? f.ultSeal.c.clone() : (o ? o.pos.clone().setY(0) : f.local([0, 0, 4])); if (o) o.release();
        sfx('boom'); sfx('big'); G.say(f, '"…봉인."'); G.flash(0xfff0c8, 0.5); G.shake(0.6); G.stage.flashSky && G.stage.flashSky(0.35);
        G.fx.beam(c, { r: 1.6, h: 12, color: SAND2, life: 0.6 }); sandWave(G, c, 4.6); for (let i = 0; i < 50; i++) G.fx.p(c.clone().add(new V3(rand(-1.2, 1.2), rand(0, 0.6), rand(-1.2, 1.2))), { vel: [rand(-2.5, 2.5), rand(9, 17), rand(-2.5, 2.5)], size: rand(0.25, 0.55), size1: 0.08, life: rand(0.8, 1.3), color: SANDS[i % 3], alpha: 0.9, drag: 0.6, grav: 13 });
        tealSpark(G, c.clone().setY(1.2), 30, 8); G.fx.light(c.clone().setY(2), SAND2, 200, 0.8, 22);
        if (o) o.takeHit(f, { dmg: 205, kb: [2, 13], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && Math.hypot(t.pos.x - c.x, t.pos.z - c.z) < 4.6) t.takeHit(f, { dmg: 110, kb: [5, 10], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
        G.slow(0.4, 0.45); }],
      [3.0, (f, o, G) => { f.model.setWeapon(true); f.model.setDiscL(true); tealSpark(G, f.chest(new V3()), 12, 3); }],
    ],
    tick: (f, o, G, t) => { if (t < 0.6) { const c = f.chest(new V3()); for (let i = 0; i < 2; i++) { const a = rand(0, TAU), R = rand(1.2, 2.8), p = c.clone().add(new V3(Math.cos(a) * R, rand(-1, 1.2), Math.sin(a) * R)), v = c.clone().sub(p).multiplyScalar(3); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.02, life: 0.3, color: i ? SAND2 : TEAL, alpha: 0.9 }); } } },
    end: (f, o, G) => { G.setTint(0, 0); glow(f, 0); f.model.setWeapon(true); f.model.setDiscL(true); if (f.ultSeal) { f.ultSeal.kill(); f.ultSeal = null; } const tg = f.ultTgt; if (tg && tg.held) tg.release(); f.ultTgt = null; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, big ? SAND2 : SAND, big ? 1.7 : 1.05, dir);
  tealSpark(G, p, big ? 12 : 5, 3);
  for (let i = 0; i < (big ? 14 : 6); i++) G.fx.p(p.clone(), { vel: [dir.x * rand(1, 5) + rand(-2, 2), rand(0, 4), dir.z * rand(1, 5) + rand(-2, 2)], size: rand(0.08, 0.16), size1: 0.03, life: rand(0.4, 0.8), color: SANDS[i % 3], alpha: 0.85, drag: 2, grav: 6 });
  // 모래: 때릴수록 쌓인다 (궁극기 중에는 쌓지 않음)
  if (!(att.act && att.act.ult)) gainSand(att, h.dmg * 0.3);
}

// 방벽 중 맞은 피해만큼 모래 · 방벽 중 이동 속도 · 궤적 색
function createModelWithSand(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (f._lastHp !== undefined && f.hp < f._lastHp && (f.wallT || 0) > 0) gainSand(f, (f._lastHp - f.hp) * 0.6);
    f._lastHp = f.hp;
    f.spdMul = (f.wallT || 0) > 0 ? 0.85 : 1;
    if (sand(f) >= 100 && f.root.visible && Math.random() < 0.3) { const p = discAt(f, Math.random() < 0.5 ? -1 : 1); f.G.fx.p(p.add(new V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))), { vel: [0, 0.8, 0], size: 0.1, size1: 0.02, life: 0.5, color: SAND2, alpha: 0.9, drag: 1 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (f.model.weaponOut) return null;
  const ranged = o && o.def && o.def.aiRange;
  if (dist < 3.2 && f.cd.s2 <= 0 && !(f.vortexT > 0) && Math.random() < 0.3) return 's2';
  if (dist > 3.5 && dist < 11 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (f.cd.s1 <= 0 && !(f.wallT > 0) && ((ranged && dist > 4) || (dist < 4 && f.hp < f.maxHp * 0.6)) && Math.random() < 0.3) return 's1';
  return null;
}

export default {
  id: 'soot', name: '수트 스파이럴', short: '수트', title: '모래 영묘의 수호자', scale: SCALE, hurtScale: 0.9,
  desc: '근거리 · 탱커 · 공간 장악. 저주받은 바람과 모래의 들끓는 원소가 응결해 태어난 고대 골렘, 신전 영묘의 타고난 수호자. 손 곁에 떠 있는 두 원반 방패로 밀쳐 치고 맞부딪쳐 짓누르며, 던진 원반은 부메랑처럼 돌아온다. 원반 방벽으로 투사체를 막고, 모래 회오리로 적을 끌어들인다. 느리지만 쉽게 밀려나지 않는다.',
  stats: { hp: 1250, speed: 6.3, jump: 9, crit: 0.15 },
  palettes: [{ accent: TEAL, teal: TEAL, band: '#0a2a2a' }, { accent: 0xff7a3a, teal: 0xff7a3a, gold: 0xd8d8e0, goldS: 0xb8bcc8, goldD: 0x6a6e7a, cloth: 0xe0a8a0, band: '#2a140a' }],
  skills: { heavy: { name: '귀환하는 원반', cd: 8 }, s1: { name: '영묘의 방벽', cd: 13 }, s2: { name: '모래 소용돌이', cd: 13 }, ult: { name: '영묘의 봉인', sub: 'GUARDIAN OF THE SAND MAUSOLEUM' } },
  aiPick,
  resource: (f) => sand(f) >= 100 ? { v: 1, label: '모래', color: 0xf0dca8, full: true } : { v: sand(f) / 100, label: '모래', color: 0xc8a060 },
  moveList: [['좌클 ×4', '왼 원반 강타 38 → 오른 원반 강타 40 → 맞부딪치기 44 → 내려찍기 34 + 모래 충격파 28'], ['공중 좌클', '두 원반을 아래로 세우고 떨어져 모래 충격파'],
    ['우클 · 귀환하는 원반', '오른 원반을 던진다: 날아가며 50 → 돌아오며 44 (상대를 끌어옴). 모래가 가득 차면 쌍원반 (36 + 30 씩) + 되도는 자리에서 모래 폭발 24 · 둔화'],
    ['Shift · 영묘의 방벽', '세우며 밀쳐 치기 40 → 두 원반이 앞에 나란히 서는 방벽 4.5초: 앞에서 오는 투사체 차단 · 받는 피해 50% 감소 · 막을수록 모래'],
    ['E · 모래 소용돌이', '원반 날을 세우고 돌며 22 · 22 → 몸을 따라다니는 모래 회오리 3.5초: 반경 안으로 끌어당김 · 0.35초마다 8 · 둔화'],
    ['Q · 영묘의 봉인', '대상 발밑에 거대한 문자 원 → 두 원반이 거대해져 양옆에서 짓누름 (40 · 18 · 18) → 모래가 솟구친다 205'],
    ['모래', '때리거나 방벽으로 막거나 방벽 중 맞을수록 쌓이고, 가득 차면 다음 원반 투척이 쌍원반'], ['C (타이밍) · 극한 회피', '모래 역습: 모래가 되어 파고든 뒤 두 원반으로 올려치기 92'], ['가만히', '고개를 숙이고 원반을 세운 채 잠든 석상처럼 멈춤']],
  onReset: (f) => { f.sand = 0; f.wallT = 0; f.vortexT = 0; f.glowK = 0; f.discOut = 0; f.empThrow = false; f.ultTgt = null; f.ultSeal = null; f._lastHp = undefined; if (f.model) { f.model.setWeapon(true); f.model.setDiscL(true); f.model.wallK = 0; } },
  createModel: createModelWithSand, poses, moves, hitFx,
};
