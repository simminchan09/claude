// 고죠 사토루 (GOJO SATORU) — 최강의 주술사 · 근·중거리 · 맨손 체술 · 무하한 술식
// 주술고전 교사. 눈을 붕대로 가린 채 주머니에 손을 넣고 다니다가, 맨손 체술과 무하한 술식으로 싸운다.
// 술식순전 「창」(끌어당김) · 술식반전 「혁」(밀쳐냄) · 허식 「무라사키」(둘을 합친 가상의 질량 — 일직선을 지운다) · 영역전개 「무량공처」.
// 고유 게이지 '무하한': 시간이 지나거나 때릴수록 차고, 가득 차면 몇 초 동안 무한이 펼쳐져 날아오는 탄이 멈추고 받는 피해가 줄어든다.
import * as THREE from 'three';
import { rand, sfx } from '../core.js';
import { createModel, BLUE, BLUE2, RED, RED2, PURPLE, PURPLE2, VOIDW } from './gojo_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const INF_DUR = 6; // 무하한 발동 시간 (초)

/* =====================================================================
   포즈 (맨손 — weapon 채널은 쓰지 않음)
   ===================================================================== */
const poses = {
  // 기본: 큰 키로 느긋하게 선 자세 — 왼손은 주머니에, 오른손은 힘을 뺀 채 늘어뜨림 · 고개를 살짝 기울임
  base: { hips: [0, 0.12, 0], spine: [0.0, -0.04, 0], chest: [-0.04, -0.06, 0], head: [0.04, 0.12, 0.07],
    shoulderL: [-0.03, 0, 0.0], elbowL: [-0.26, 0, 0], shoulderR: [0.04, 0, -0.1], elbowR: [-0.22, 0, 0], weapon: [0, 0, 0],
    hipL: [-0.04, 0, 0.05], kneeL: [0.06, 0, 0], footL: [0, 0, 0], hipR: [0.05, 0, -0.08], kneeR: [0.05, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.08, 0], spine: [0.32, 0.05, 0], chest: [0.06, 0.05, 0], head: [-0.22, 0, 0], shoulderR: [0.25, 0, -0.15], elbowR: [-1.0, 0, 0], shoulderL: [0.25, 0, 0.15], elbowL: [-1.0, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.35, 0, 0], kneeR: [1.2, 0, 0], shoulderL: [-0.35, 0, 0.55], elbowL: [-0.7, 0, 0], shoulderR: [-0.3, 0, -0.55], elbowR: [-0.7, 0, 0] },
  // 방어: 손바닥을 앞으로 — 무한이 공격을 멈춘다
  guard: { hips: [0, -0.3, 0], spine: [0.08, 0.15, 0], chest: [0.02, 0.15, 0], head: [0, -0.15, 0], shoulderR: [-1.4, 0, -0.08], elbowR: [-0.3, 0, 0], shoulderL: [-0.03, 0, 0.0], elbowL: [-0.26, 0, 0],
    hipL: [-0.35, 0, 0.12], kneeL: [0.5, 0, 0], hipR: [0.28, 0, -0.12], kneeR: [0.4, 0, 0] },
  hit: { spine: [-0.32, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.8, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.5, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.6, 0, -0.25], elbowR: [-0.4, 0, 0], shoulderL: [0.6, 0, 0.25], elbowL: [-0.4, 0, 0], hipL: [-0.8, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.45, 0, 0], kneeR: [1.0, 0, 0] },
  // 승리: 오른손으로 안대를 살짝 끌어내리며 고개를 기울임 · 왼손은 주머니
  win: { hips: [0, 0.2, 0], spine: [-0.05, 0.1, 0], chest: [-0.06, 0.1, 0], head: [-0.08, -0.15, -0.12], shoulderR: [-0.55, 0, 0.55], elbowR: [-2.3, 0, 0], shoulderL: [-0.03, 0, 0.0], elbowL: [-0.26, 0, 0],
    hipL: [-0.05, 0, 0.05], kneeL: [0.06, 0, 0], hipR: [0.06, 0, -0.08], kneeR: [0.05, 0, 0] },
  // 컷인: 얼굴 앞에서 검지와 중지를 세운 손 (영역전개 수인)
  portrait: { hips: [0, 0.25, 0], spine: [0, 0.05, 0], chest: [-0.05, -0.1, 0], head: [0.05, 0.15, 0.05], shoulderR: [-0.95, 0, 0.6], elbowR: [-2.0, 0, 0], shoulderL: [-0.03, 0, 0.0], elbowL: [-0.26, 0, 0] },
  // 왼손 잽
  jabPrep: { hips: [0, -0.25, 0], spine: [0.08, -0.2, 0], chest: [0.04, -0.25, 0], head: [0, 0.4, 0], shoulderL: [-0.8, 0, 0.12], elbowL: [-1.7, 0, 0], shoulderR: [-0.55, 0, -0.18], elbowR: [-1.9, 0, 0],
    hipL: [-0.45, 0, 0.1], kneeL: [0.45, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.35, 0, 0] },
  jab: { hips: [0, -0.4, 0], spine: [0.12, -0.3, 0], chest: [0.05, -0.38, 0], head: [0, 0.65, 0], shoulderL: [-1.52, 0, -0.08], elbowL: [-0.06, 0, 0], shoulderR: [-0.6, 0, -0.2], elbowR: [-1.95, 0, 0],
    hipL: [-0.6, 0, 0.1], kneeL: [0.5, 0, 0], hipR: [0.4, 0, -0.1], kneeR: [0.25, 0, 0] },
  // 돌려차기: 오른다리를 옆으로 뻗은 채 몸을 한 바퀴 돌린다 (회전은 기술 tick 에서 몸 방향으로)
  kickPrep: { hipY: -0.04, hips: [0, -0.5, 0], spine: [0.1, -0.2, 0], chest: [0.05, -0.2, 0], head: [0, 0.5, 0], shoulderL: [-0.5, 0, 0.5], elbowL: [-1.2, 0, 0], shoulderR: [-0.4, 0, -0.5], elbowR: [-1.4, 0, 0],
    hipL: [-0.2, 0, 0.05], kneeL: [0.45, 0, 0], hipR: [-0.9, 0, -0.5], kneeR: [1.7, 0, 0] },
  kick: { hipY: -0.02, hips: [0, 0, -0.45], spine: [0.05, 0, 0.35], chest: [0, 0, 0.15], head: [0, 0, -0.35], shoulderL: [-0.2, 0, 1.2], elbowL: [-0.6, 0, 0], shoulderR: [-0.3, 0, -0.8], elbowR: [-1.3, 0, 0],
    hipL: [-0.1, 0, 0.35], kneeL: [0.35, 0, 0], hipR: [-0.15, 0, -1.55], kneeR: [0.08, 0, 0], footR: [0.4, 0, 0] },
  // 장타: 오른 손바닥을 앞으로 내지른다 (손바닥에 작은 「창」)
  palmPrep: { hips: [0, 0.35, 0], spine: [0.08, 0.25, 0], chest: [0.03, 0.3, 0], head: [0, -0.5, 0], shoulderR: [0.25, 0, -0.25], elbowR: [-1.9, 0, 0], shoulderL: [-0.9, 0, 0.3], elbowL: [-0.8, 0, 0],
    hipL: [-0.5, 0, 0.12], kneeL: [0.6, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.45, 0, 0] },
  palm: { hips: [0, -0.35, 0], spine: [0.2, -0.3, 0], chest: [0.06, -0.35, 0], head: [-0.1, 0.55, 0], shoulderR: [-1.5, 0, 0.12], elbowR: [-0.05, 0, 0], shoulderL: [0.3, 0, 0.4], elbowL: [-1.0, 0, 0],
    hipL: [-0.75, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.5, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 오른 정권 (주먹에 작은 「혁」)
  punchPrep: { hipY: -0.04, hips: [0, 0.45, 0], spine: [0.1, 0.3, 0], chest: [0.04, 0.35, 0], head: [0, -0.6, 0], shoulderR: [0.35, 0, -0.3], elbowR: [-2.0, 0, 0], shoulderL: [-1.2, 0, 0.1], elbowL: [-0.5, 0, 0],
    hipL: [-0.6, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.4, 0, -0.12], kneeR: [0.6, 0, 0] },
  punch: { hipY: -0.06, hips: [0, -0.45, 0], spine: [0.22, -0.35, 0], chest: [0.08, -0.4, 0], head: [-0.15, 0.65, 0], shoulderR: [-1.55, 0, 0.08], elbowR: [-0.04, 0, 0], shoulderL: [0.4, 0, 0.45], elbowL: [-1.6, 0, 0],
    hipL: [-0.9, 0, 0.12], kneeL: [0.85, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.15, 0, 0] },
  // 손끝으로 가리키는 자세 (창 · 혁) — 오른팔을 곧게 뻗음
  point: { hips: [0, -0.4, 0], spine: [0.05, -0.25, 0], chest: [0, -0.3, 0], head: [0, 0.55, 0], shoulderR: [-1.5, 0, 0.0], elbowR: [-0.08, 0, 0], shoulderL: [-0.03, 0, 0.0], elbowL: [-0.26, 0, 0],
    hipL: [-0.4, 0, 0.12], kneeL: [0.35, 0, 0], hipR: [0.3, 0, -0.12], kneeR: [0.25, 0, 0] },
  pointPrep: { hips: [0, -0.2, 0], spine: [0.0, -0.1, 0], chest: [-0.04, -0.15, 0], head: [0.05, 0.3, 0], shoulderR: [-1.0, 0, -0.2], elbowR: [-1.3, 0, 0], shoulderL: [-0.03, 0, 0.0], elbowL: [-0.26, 0, 0],
    hipL: [-0.25, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.15, 0, 0] },
  // 무라사키: 두 팔을 벌려 왼손에 「창」, 오른손에 「혁」 → 앞에서 합침 → 오른손 끝으로 쏜다
  spread: { hipY: -0.05, hips: [0, 0, 0], spine: [-0.08, 0, 0], chest: [-0.08, 0, 0], head: [-0.12, 0, 0], shoulderL: [-0.55, 0, 1.15], elbowL: [-0.6, 0, 0], shoulderR: [-0.55, 0, -1.15], elbowR: [-0.6, 0, 0],
    hipL: [-0.3, 0, 0.25], kneeL: [0.5, 0, 0], hipR: [-0.1, 0, -0.25], kneeR: [0.5, 0, 0] },
  join: { hipY: -0.06, hips: [0, -0.15, 0], spine: [0.1, -0.1, 0], chest: [0.05, -0.1, 0], head: [0.05, 0.1, 0], shoulderL: [-1.15, 0, 0.0], elbowL: [-1.15, 0, 0], shoulderR: [-1.15, 0, 0.0], elbowR: [-1.15, 0, 0],
    hipL: [-0.4, 0, 0.25], kneeL: [0.6, 0, 0], hipR: [0.15, 0, -0.25], kneeR: [0.55, 0, 0] },
  fire: { hipY: -0.06, hips: [0, -0.6, 0], spine: [0.12, -0.45, 0], chest: [0.04, -0.45, 0], head: [-0.05, 0.85, 0], shoulderR: [-1.55, 0, 0.18], elbowR: [-0.02, 0, 0], shoulderL: [0.15, 0, 0.5], elbowL: [-0.8, 0, 0],
    hipL: [-0.75, 0, 0.2], kneeL: [0.75, 0, 0], hipR: [0.5, 0, -0.2], kneeR: [0.3, 0, 0] },
  // 영역전개 수인: 얼굴 앞에 세운 오른손
  mudra: { hips: [0, 0.1, 0], spine: [0, 0, 0], chest: [-0.04, -0.05, 0], head: [0.02, 0.08, 0], shoulderR: [-0.95, 0, 0.62], elbowR: [-2.05, 0, 0], shoulderL: [-0.03, 0, 0.0], elbowL: [-0.26, 0, 0],
    hipL: [-0.04, 0, 0.06], kneeL: [0.05, 0, 0], hipR: [0.05, 0, -0.08], kneeR: [0.05, 0, 0] },
  // 연타 (좌 · 우)
  rushL: { hipY: -0.05, hips: [0, -0.35, 0], spine: [0.15, -0.3, 0], chest: [0.05, -0.3, 0], head: [0, 0.5, 0], shoulderL: [-1.55, 0, -0.05], elbowL: [-0.05, 0, 0], shoulderR: [-0.7, 0, -0.2], elbowR: [-1.9, 0, 0],
    hipL: [-0.6, 0, 0.15], kneeL: [0.7, 0, 0], hipR: [0.45, 0, -0.15], kneeR: [0.45, 0, 0] },
  rushR: { hipY: -0.05, hips: [0, 0.35, 0], spine: [0.15, 0.3, 0], chest: [0.05, 0.3, 0], head: [0, -0.5, 0], shoulderR: [-1.55, 0, 0.05], elbowR: [-0.05, 0, 0], shoulderL: [-0.7, 0, 0.2], elbowL: [-1.9, 0, 0],
    hipL: [-0.6, 0, 0.15], kneeL: [0.7, 0, 0], hipR: [0.45, 0, -0.15], kneeR: [0.45, 0, 0] },
  // 낙하: 무릎을 모으고 주먹을 치켜듦 → 주먹을 아래로 → 땅을 내려침
  plungeUp: { hips: [-0.2, 0, 0], spine: [-0.1, 0, 0], head: [-0.2, 0, 0], shoulderR: [-2.8, 0, -0.2], elbowR: [-0.6, 0, 0], shoulderL: [-0.6, 0, 0.6], elbowL: [-1.0, 0, 0], hipL: [-1.3, 0, 0.1], kneeL: [1.8, 0, 0], hipR: [-1.0, 0, -0.1], kneeR: [1.7, 0, 0] },
  plungeFall: { hips: [0.35, 0, 0], spine: [0.4, 0, 0], head: [0.15, 0, 0], shoulderR: [-0.6, 0, -0.1], elbowR: [-0.1, 0, 0], shoulderL: [0.3, 0, 0.6], elbowL: [-0.8, 0, 0], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
  plungeLand: { hipY: -0.32, hips: [0, -0.2, 0], spine: [0.75, -0.1, 0], chest: [0.2, 0, 0], head: [-0.4, 0, 0], shoulderR: [-0.75, 0, 0.05], elbowR: [-0.05, 0, 0], shoulderL: [0.3, 0, 0.5], elbowL: [-1.0, 0, 0],
    hipL: [-1.2, 0, 0.15], kneeL: [1.8, 0, 0], hipR: [0.2, 0, -0.15], kneeR: [1.5, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 두 손을 주머니에 넣고 고개를 젖혀 하늘을 본다
  idle2: { ...poses.base, head: [-0.3, 0.05, 0.05], shoulderR: [-0.03, 0, 0.0], elbowR: [-0.26, 0, 0], chest: [-0.08, -0.04, 0] },
});

/* =====================================================================
   이펙트 도구
   ===================================================================== */
const SPH = new THREE.SphereGeometry(1, 32, 20), TOR = new THREE.TorusGeometry(1, 0.035, 8, 64);
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
function orbParts(G, color, core, halo = color) {
  const g = new THREE.Group(); G.scene.add(g);
  const mats = [new THREE.MeshBasicMaterial({ color: core, transparent: true, opacity: 1, depthWrite: false, fog: false }), addMat(color, 0.75), addMat(halo, 0.3)];
  const a = new THREE.Mesh(SPH, mats[0]), b = new THREE.Mesh(SPH, mats[1]), c = new THREE.Mesh(SPH, mats[2]); a.scale.setScalar(0.55); c.scale.setScalar(1.6); g.add(a, b, c);
  for (const o of [a, b, c]) o.frustumCulled = false;
  return { g, mats, core: a, shell: b, halo: c };
}
const hand = (f, s) => f.model.handPos(s, new V3());
// 빨려 들어가는 / 퍼져 나가는 빛 입자
function suck(G, c, R, n, color, sp = 4) { for (let i = 0; i < n; i++) { const d = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), p = c.clone().addScaledVector(d, R * rand(0.7, 1.1)), v = d.clone().multiplyScalar(-sp * rand(0.7, 1.2)); G.fx.p(p, { vel: [v.x, v.y, v.z], size: rand(0.05, 0.11), size1: 0.01, life: R / sp, color: Array.isArray(color) ? color[i % color.length] : color, alpha: 0.95, drag: 0 }); } }
function blast(G, c, n, color, sp = 6, size = 0.12) { G.fx.burst(c, n, color, sp, { kind: 'spark', sk: size / 0.1 }); }
const foeTeam = (e) => { const o = e.owner || e.f; return o && o.team; };
// 맞은 상대의 머리 · 가슴
const aim = (t) => t.chest(new V3()).add(new V3(0, 0.1 * t.scale, 0));

/* ---------- 술식순전 「창」: 끌어당기는 푸른 구 (연속 피해 · 둔화 → 마지막에 수축 폭발) ---------- */
class BlueOrb {
  constructor(G, f, c) {
    this.G = G; this.f = f; this.c = c.clone(); this.t = 0; this.life = 2.3; this.R = 4.2; this.done = false; this.tick = 0.15;
    this.o = orbParts(G, BLUE, 0x061238, BLUE2); this.o.g.position.copy(this.c);
    this.ring = new THREE.Mesh(TOR, addMat(BLUE2, 0.6)); this.ring2 = new THREE.Mesh(TOR, addMat(BLUE, 0.5)); this.o.g.add(this.ring, this.ring2);
    sfx('zap'); sfx('charge'); G.fx.ring(this.c, { r0: 2.5, r1: 0.2, life: 0.35, color: BLUE2, billboard: true }); G.fx.light(this.c, BLUE, 70, 0.4);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt;
    if (f.state === 'ko' || f.gone) return this.kill();
    const k = Math.min(1, this.t / 0.2), out = Math.max(0, (this.t - (this.life - 0.25)) / 0.25), s = (0.85 + 0.08 * Math.sin(this.t * 30)) * k * (1 - out * 0.8);
    this.o.g.scale.setScalar(s); this.o.g.rotation.y += dt * 4;
    this.ring.rotation.set(this.t * 3, this.t * 5, 0); this.ring2.rotation.set(-this.t * 4, 0, this.t * 6); this.ring.scale.setScalar(1.5 + 0.2 * Math.sin(this.t * 9)); this.ring2.scale.setScalar(1.9);
    suck(G, this.c, 2.6, 3, [BLUE, BLUE2, 0xffffff], 7);
    if (Math.random() < 0.3) G.fx.ring(this.c.clone().setY(Math.max(0.05, this.c.y - 1.0)), { normal: UP, r0: this.R, r1: 0.3, life: 0.5, color: BLUE, op: 0.4 });
    // 끌어당김 (상대만 · 붙잡힌 상대 제외)
    for (const t of f.foes()) {
      const d = new V3().subVectors(this.c, t.pos).setY(0), L = d.length(); if (L > this.R + 1 || t.held || t.pos.y - this.c.y > 2.5) continue;
      if (L > 0.35) { const sp = Math.min(L - 0.3, 6.5 * dt * (t.scale > 1.2 ? 0.45 : 1)); t.pos.addScaledVector(d.normalize(), sp); }
    }
    if (this.tick <= 0 && this.t < this.life - 0.3) { this.tick = 0.24;
      for (const t of f.foes()) if (Math.hypot(t.pos.x - this.c.x, t.pos.z - this.c.z) < 1.7 + 0.4 * t.scale && t.pos.y - this.c.y < 2) {
        if (t.takeHit(f, { dmg: 8, kb: [0, 0], stun: 0.45, daze: 6, hs: 0.02, noCrit: true, noScale: true, basic: false, col: BLUE }, new V3().subVectors(this.c, t.pos).setY(0).normalize())) t.addStatus('slow', 1.2, 0.6, f);
      } }
    if (this.t >= this.life) {
      sfx('boom'); G.shake(0.2); G.fx.ring(this.c, { r0: 2.6, r1: 0.1, life: 0.3, color: BLUE2, billboard: true }); G.fx.impact(this.c, BLUE, 1.6); blast(G, this.c, 30, [BLUE, BLUE2, 0xffffff], 9);
      for (const t of f.foes()) if (t.hurtHit(this.c, 2.2)) t.takeHit(f, { dmg: 34, kb: [2, 5.5], stun: 0.6, hs: 0.1, shake: 0.18, daze: 25, noScale: true, basic: false, snd: 'big', col: BLUE }, new V3().subVectors(t.pos, this.c).setY(0).normalize());
      this.kill();
    }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.o.g); for (const m of this.o.mats) m.dispose(); this.ring.material.dispose(); this.ring2.material.dispose(); }
}

/* ---------- 술식반전 「혁」: 앞으로 터져 나가는 붉은 척력 (관통 · 큰 넉백) ---------- */
class RedBlast {
  constructor(G, f, from, dir) {
    this.G = G; this.f = f; this.pos = from.clone(); this.dir = dir.clone(); this.t = 0; this.done = false; this.hitSet = new Set();
    this.o = orbParts(G, RED, 0xfff0ea, RED2); this.o.g.position.copy(this.pos);
    sfx('boom'); sfx('big'); G.shake(0.3); G.flash(RED, 0.25); G.fx.light(from, RED, 120, 0.4, 16);
    G.fx.ring(from, { r0: 0.2, r1: 2.6, life: 0.3, color: RED2, billboard: true }); blast(G, from, 24, [RED, RED2, 0xffffff], 10);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    const R = 0.75 + this.t * 2.2; this.pos.addScaledVector(this.dir, 30 * dt); this.o.g.position.copy(this.pos); this.o.g.scale.setScalar(R * 0.8);
    for (const m of this.o.mats) m.opacity = Math.max(0, 1 - this.t / 0.34) * (m === this.o.mats[2] ? 0.3 : 0.9);
    if (Math.random() < 0.8) G.fx.ring(this.pos, { r0: R * 0.6, r1: R * 1.5, life: 0.18, color: RED, normal: this.dir });
    for (let i = 0; i < 4; i++) G.fx.p(this.pos.clone().add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(R * 0.6)), { vel: [this.dir.x * 8 + rand(-3, 3), rand(-2, 3), this.dir.z * 8 + rand(-3, 3)], size: rand(0.1, 0.25), size1: 0.02, life: 0.3, color: i % 2 ? RED : RED2, alpha: 0.9, drag: 2 });
    for (const t of f.foes()) {
      if (this.hitSet.has(t) || !t.hurtHit(this.pos, R)) continue; this.hitSet.add(t);
      if (t.takeHit(f, { dmg: 105, kb: [16, 4.5], stun: 0.85, hs: 0.15, shake: 0.32, daze: 48, basic: false, snd: 'big', col: RED }, this.dir.clone().setY(0).normalize())) { G.fx.impact(aim(t), RED, 2); G.slow(0.5, 0.12); }
    }
    if (this.t > 0.34) { blast(G, this.pos, 18, [RED, RED2], 7); this.kill(); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.o.g); for (const m of this.o.mats) m.dispose(); }
}

/* ---------- 무라사키 충전: 왼손 「창」 · 오른손 「혁」 → 두 손을 모으면 보랏빛 구로 합쳐진다 ---------- */
class PurpleCharge {
  constructor(G, f) {
    this.G = G; this.f = f; this.done = false;
    this.b = orbParts(G, BLUE, 0x061238, BLUE2); this.r = orbParts(G, RED, 0xfff0ea, RED2); this.p = orbParts(G, PURPLE, 0xffffff, PURPLE2);
    for (const o of [this.b, this.r, this.p]) o.g.scale.setScalar(0.001);
  }
  update(dt) {
    const G = this.G, f = this.f, t = f.at;
    if (f.state !== 'act' || f.actName !== 'heavy' || t > 1.3) return this.kill();
    const L = hand(f, 'L'), Rh = hand(f, 'R'), mid = L.clone().add(Rh).multiplyScalar(0.5).add(f.fwd(new V3()).multiplyScalar(0.12)), mix = Math.min(1, Math.max(0, (t - 0.82) / 0.16)), w = Math.sin(G.time * 40) * 0.03;
    const sb = Math.min(1, Math.max(0, (t - 0.12) / 0.25)) * (1 - mix) * 0.17, sr = Math.min(1, Math.max(0, (t - 0.4) / 0.25)) * (1 - mix) * 0.17, sp = mix * (0.2 + 0.25 * Math.min(1, (t - 0.82) / 0.4));
    this.b.g.position.copy(L).lerp(mid, mix); this.r.g.position.copy(Rh).lerp(mid, mix); this.p.g.position.copy(mid);
    this.b.g.scale.setScalar(sb + w * sb); this.r.g.scale.setScalar(sr + w * sr); this.p.g.scale.setScalar(sp * (1 + w * 2));
    if (sb > 0.01) suck(G, this.b.g.position, 0.9, 2, [BLUE, BLUE2], 4);
    if (sr > 0.01) G.fx.p(this.r.g.position, { vel: [rand(-2, 2), rand(-1, 2), rand(-2, 2)], size: 0.12, size1: 0.01, life: 0.3, color: Math.random() < 0.5 ? RED : RED2, alpha: 0.9, drag: 2 });
    if (mix > 0) { suck(G, mid, 1.6, 4, [PURPLE, PURPLE2, 0xffffff], 6); if (Math.random() < 0.25) G.fx.ring(mid, { r0: 1.4, r1: 0.1, life: 0.25, color: PURPLE2, billboard: true }); }
  }
  kill() { if (this.done) return; this.done = true; for (const o of [this.b, this.r, this.p]) { this.G.scene.remove(o.g); for (const m of o.mats) m.dispose(); } }
}

/* ---------- 허식 「무라사키」: 일직선상의 모든 것을 지우는 거대한 보랏빛 구 (관통 · 막을 수 없음) ---------- */
class HollowPurple {
  constructor(G, f, from, dir) {
    this.G = G; this.f = f; this.pos = from.clone(); this.dir = dir.clone().normalize(); this.t = 0; this.done = false; this.hitSet = new Set(); this.R = 1.3;
    this.o = orbParts(G, PURPLE, 0xffffff, PURPLE2); this.o.g.position.copy(this.pos);
    this.rings = [0, 1, 2].map((i) => { const m = new THREE.Mesh(TOR, addMat(i ? PURPLE : PURPLE2, 0.55)); m.frustumCulled = false; this.o.g.add(m); return m; });
    sfx('boom'); sfx('big'); G.shake(0.55); G.flash(PURPLE2, 0.5); G.slow(0.4, 0.22); G.fx.light(from, PURPLE, 200, 0.6, 26);
    G.fx.ring(from, { r0: 0.3, r1: 5, life: 0.5, color: PURPLE2, normal: this.dir }); blast(G, from, 50, [PURPLE, PURPLE2, 0xffffff], 14);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    const k = Math.min(1, this.t / 0.15), fade = Math.max(0, (this.t - 1.45) / 0.2), R = this.R * k * (1 - fade * 0.6);
    this.pos.addScaledVector(this.dir, 19 * dt); this.o.g.position.copy(this.pos); this.o.g.scale.setScalar(R * (1 + 0.05 * Math.sin(this.t * 50)));
    this.rings.forEach((m, i) => { m.rotation.set(this.t * (5 + i * 2), this.t * (3 - i * 2), i * 1.1); m.scale.setScalar(1.25 + 0.15 * i); });
    for (const m of this.o.mats) m.opacity = (1 - fade) * (m === this.o.mats[2] ? 0.35 : 0.95);
    // 지나간 자리: 보랏빛 잔광 · 바닥이 깎여 나간 흔적
    for (let i = 0; i < 6; i++) { const d = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); G.fx.p(this.pos.clone().addScaledVector(d, R * rand(0.6, 1.1)), { vel: [d.x * 2 - this.dir.x * 6, d.y * 2, d.z * 2 - this.dir.z * 6], size: rand(0.12, 0.3), size1: 0.02, life: rand(0.3, 0.6), color: i % 3 ? PURPLE : i % 2 ? PURPLE2 : 0xffffff, alpha: 0.9, drag: 1.5 }); }
    G.fx.p(this.pos.clone().addScaledVector(this.dir, -R * 0.6), { size: R * 2.2, size1: R * 0.6, life: 0.35, color: PURPLE, alpha: 0.35, drag: 0 });
    if (Math.random() < 0.6) G.fx.burst(this.pos.clone().setY(0.1).addScaledVector(new V3(-this.dir.z, 0, this.dir.x), rand(-1, 1) * R), 3, 0x6a5a70, 3, { kind: 'dust', sk: 1.2 });
    // 지운다: 적의 탄 · 소환물
    for (const e of G.ents) if (e !== this && !e.done && e.pos && e.pos.isVector3 && foeTeam(e) !== undefined && foeTeam(e) !== f.team && e.pos.distanceTo(this.pos) < R + 0.6 && e.kill) { G.fx.burst(e.pos.clone(), 14, [PURPLE2, 0xffffff], 5); e.kill(); e.done = true; }
    for (const t of f.foes()) {
      if (this.hitSet.has(t) || !t.hurtHit(this.pos, R)) continue; this.hitSet.add(t);
      if (t.takeHit(f, { dmg: 170, kb: [13, 6], stun: 1.0, hs: 0.22, shake: 0.5, unblock: true, daze: 90, basic: false, snd: 'big', col: PURPLE }, this.dir.clone().setY(0).normalize())) { const c = aim(t); G.fx.impact(c, PURPLE, 2.6); blast(G, c, 40, [PURPLE, PURPLE2, 0xffffff], 12); G.flash(0xffffff, 0.35); }
    }
    if (this.t > 1.65 || Math.hypot(this.pos.x, this.pos.z) > 40) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.o.g); for (const m of this.o.mats) m.dispose(); for (const r of this.rings) r.material.dispose(); }
}

/* ---------- 영역전개 「무량공처」: 별빛 가득한 무한의 공간이 주위를 감싼다 ---------- */
let _starTex = null, _floorTex = null;
function starTex() {
  if (_starTex) return _starTex;
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#02030a'); gr.addColorStop(0.5, '#0a1430'); gr.addColorStop(1, '#03040c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 은하수 띠 (푸른빛 · 흰빛 성운)
  for (let i = 0; i < 140; i++) { const x = Math.random() * W, y = H * 0.5 + Math.sin(x / W * TAU * 2) * H * 0.12 + (Math.random() - 0.5) * H * 0.18, r = 30 + Math.random() * 90, rg = g.createRadialGradient(x, y, 0, x, y, r);
    const col = Math.random() < 0.5 ? '120,170,255' : Math.random() < 0.5 ? '200,220,255' : '170,120,255'; rg.addColorStop(0, `rgba(${col},0.16)`); rg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // 별
  for (let i = 0; i < 3200; i++) { const x = Math.random() * W, y = Math.random() * H, s = Math.random() ** 3 * 2.6 + 0.4, a = 0.4 + Math.random() * 0.6; g.fillStyle = `rgba(${Math.random() < 0.2 ? '180,210,255' : '255,255,255'},${a})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { const x = Math.random() * W, y = Math.random() * H, rg = g.createRadialGradient(x, y, 0, x, y, 14); rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(1, 'rgba(160,200,255,0)'); g.fillStyle = rg; g.fillRect(x - 14, y - 14, 28, 28); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 22, y - 0.5, 44, 1); g.fillRect(x - 0.5, y - 22, 1, 44); }
  _starTex = new THREE.CanvasTexture(c); _starTex.colorSpace = THREE.SRGBColorSpace; return _starTex;
}
function floorTex() {
  if (_floorTex) return _floorTex;
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, S / 2); gr.addColorStop(0, '#cfe4ff'); gr.addColorStop(0.08, '#3a5ab0'); gr.addColorStop(0.3, '#0c1638'); gr.addColorStop(1, '#03050e'); g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S);
  for (let i = 1; i < 14; i++) { g.strokeStyle = `rgba(170,210,255,${0.35 - i * 0.02})`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, (i / 14) ** 1.3 * S * 0.5, 0, TAU); g.stroke(); }
  for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; g.strokeStyle = 'rgba(150,190,255,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); g.lineTo(Math.cos(a) * S / 2, Math.sin(a) * S / 2); g.stroke(); }
  for (let i = 0; i < 900; i++) { const a = Math.random() * TAU, r = Math.random() * S / 2; g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`; g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2); }
  _floorTex = new THREE.CanvasTexture(c); _floorTex.colorSpace = THREE.SRGBColorSpace; return _floorTex;
}
class VoidDomain {
  constructor(G, f, c) {
    this.G = G; this.f = f; this.c = c.clone(); this.t = 0; this.done = false; this.R = 18; this.outT = -1;
    this.skyM = new THREE.MeshBasicMaterial({ map: starTex(), side: THREE.BackSide, fog: false, transparent: true, opacity: 1, depthWrite: true });
    this.sky = new THREE.Mesh(SPH, this.skyM); this.sky.position.copy(this.c); this.sky.renderOrder = -2; this.sky.frustumCulled = false; G.scene.add(this.sky);
    this.flM = new THREE.MeshBasicMaterial({ map: floorTex(), fog: false, transparent: true, opacity: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 72), this.flM); this.floor.rotation.x = -Math.PI / 2; this.floor.position.copy(this.c).setY(this.c.y + 0.03); this.floor.renderOrder = -1; G.scene.add(this.floor);
    this.edgeM = addMat(VOIDW, 0.9); this.edge = new THREE.Mesh(SPH, this.edgeM); this.edge.position.copy(this.c); G.scene.add(this.edge);
    sfx('ult'); sfx('boom'); G.flash(VOIDW, 0.7); G.shake(0.35);
  }
  // 영역 안에서는 바깥 세상(맵의 지형 · 소품)이 보이지 않는다 — 다 펼쳐지면 맵 메시를 숨기고, 걷힐 때 되돌린다 (빛은 그대로)
  hideStage(on) {
    const st = this.G.stage, grp = st && st.group; if (!grp) return;
    if (on && !this.hidden) { this.hidden = []; for (const o of grp.children) { let light = false; o.traverse((q) => { if (q.isLight) light = true; }); if (!light && o.visible) { o.visible = false; this.hidden.push(o); } } }
    else if (!on && this.hidden) { for (const o of this.hidden) o.visible = true; this.hidden = null; }
  }
  collapse() { if (this.outT < 0) this.outT = 0; this.hideStage(false); }
  update(dt) {
    const G = this.G; this.t += dt; if (this.outT >= 0) this.outT += dt;
    const grow = 1 - (1 - Math.min(1, this.t / 0.6)) ** 3, shrink = this.outT >= 0 ? Math.min(1, this.outT / 0.5) : 0, s = this.R * grow * (1 - shrink * shrink * 0.98);
    this.sky.scale.setScalar(Math.max(0.01, s)); this.floor.scale.setScalar(Math.max(0.01, s * 0.98)); this.edge.scale.setScalar(Math.max(0.01, s * 1.003));
    this.skyM.opacity = this.flM.opacity = 1 - shrink; this.edgeM.opacity = (1 - grow) * 0.9 + shrink * 0.5 * (1 - shrink);
    this.sky.rotation.y += dt * 0.05;
    if (grow >= 1 && this.outT < 0) this.hideStage(true);
    // 떠도는 별빛 · 바닥에서 피어오르는 빛
    for (let i = 0; i < 4; i++) { const a = rand(0, TAU), r = rand(1, s * 0.9), p = this.c.clone().add(new V3(Math.cos(a) * r, rand(0.1, 6), Math.sin(a) * r)); G.fx.p(p, { vel: [0, rand(0.2, 0.8), 0], size: rand(0.04, 0.1), size1: 0.01, life: rand(0.6, 1.2), color: i % 2 ? VOIDW : BLUE2, alpha: 0.9 * (1 - shrink), drag: 0 }); }
    if (shrink >= 1) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.hideStage(false); for (const o of [this.sky, this.floor, this.edge]) this.G.scene.remove(o); this.floor.geometry.dispose(); this.skyM.dispose(); this.flM.dispose(); this.edgeM.dispose(); }
}

/* =====================================================================
   기술
   ===================================================================== */
const hitAt = (t0, t1, at, r, dmg, o = {}) => ({ t0, t1, at, r, dmg, weapon: false, ...o });
// 순간이동: 상대의 등 뒤(또는 앞)로 — 출발 · 도착 자리에 푸른 빛
function warp(f, o, G, behind = true, dist = 1.2) {
  if (!o || o.gone) return; const from = f.chest(new V3()), d = new V3().subVectors(o.pos, f.pos).setY(0); if (d.lengthSq() < 1e-4) f.fwd(d); d.normalize();
  f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(d, behind ? dist + 0.3 * o.scale : -(dist + 0.3 * o.scale)); f.yaw = behind ? Math.atan2(-d.x, -d.z) : Math.atan2(d.x, d.z); f.vel.set(0, 0, 0); f.model.resetCloth();
  for (const p of [from, f.chest(new V3())]) { G.fx.burst(p, 16, [BLUE, BLUE2, 0xffffff], 4, { kind: 'glow', sk: 0.5 }); G.fx.ring(p, { r0: 1.2, r1: 0.1, life: 0.25, color: BLUE2, billboard: true }); }
  sfx('dash');
}

const moves = {
  /* --- 공중 좌클: 낙하 정권 — 주먹으로 땅을 내려쳐 「창」이 터진다 --- */
  ...makePlunge({
    up: 'plungeUp', fall: 'plungeFall', land: 'plungeLand', color: BLUE, dmg: 70, r: 2.4,
    fx: (f, o, G, c) => { const p = c.clone().setY(c.y + 0.4); suck(G, p, 2.4, 30, [BLUE, BLUE2, 0xffffff], 8); G.fx.ring(p, { r0: 2.6, r1: 0.1, life: 0.35, color: BLUE2, billboard: true }); G.fx.light(p, BLUE, 80, 0.35); },
  }),

  /* --- 기본 공격 (체술 4연격): 왼손 잽 → 돌려차기 → 「창」을 실은 장타 → 「혁」을 실은 정권 --- */
  light1: { dur: 0.32, cancel: 0.15, next: 'light2', track: 0.06, fist: 'L',
    keys: [[0, 'jabPrep'], [0.07, 'jab'], [0.18, {}], [0.32, 'base']], lunge: [[0.02, 0.09, 7]],
    ev: [[0.05, () => sfx('swing')], [0.08, (f, o, G) => { const p = hand(f, 'L'); G.fx.p(p, { size: 0.5, size1: 0.05, life: 0.12, color: BLUE2, alpha: 0.7 }); }]],
    hits: [hitAt(0.06, 0.13, [0, 1.38, 0.9], 0.45, 30)] },
  light2: { dur: 0.5, cancel: 0.3, next: 'light3', track: 0.04, fist: 'LR',
    keys: [[0, 'kickPrep'], [0.1, 'kick'], [0.3, 'kick'], [0.42, {}], [0.5, 'base']], lunge: [[0.03, 0.1, 5]],
    // 한 바퀴 회전: 오른다리가 정면을 지나는 순간 맞는다 (회전 중 몸 방향을 직접 돌림)
    start: (f) => { f.spin0 = f.yaw; f.kickC = f.local([0, 1.15, 1.0]); f.kickHit = false; },
    tick: (f, o, G, t) => {
      if (t >= 0.04 && t <= 0.4) f.yaw = f.spin0 + TAU * Math.min(1, (t - 0.04) / 0.36); else if (t > 0.4 && t < 0.45) f.yaw = f.spin0;
      if (!f.kickHit && t >= 0.11 && t <= 0.18) for (const tg of f.foes()) if (tg.hurtHit(f.kickC, 0.75 * f.scale) && tg.takeHit(f, { dmg: 42 }, new V3(Math.sin(f.spin0), 0, Math.cos(f.spin0)))) f.kickHit = true;
    },
    ev: [[0.08, () => sfx('swing')], [0.13, (f, o, G) => { G.fx.slash(f.kickC.clone().setY(f.pos.y + 1.0), { fwd: new V3(Math.sin(f.spin0), 0, Math.cos(f.spin0)), normal: UP, r: 1.5, color: BLUE2, life: 0.2, flip: true }); }]] },
  light3: { dur: 0.5, cancel: 0.3, next: 'light4', track: 0.1,
    keys: [[0, 'palmPrep'], [0.12, 'palmPrep'], [0.18, 'palm'], [0.34, {}], [0.5, 'base']], lunge: [[0.12, 0.2, 8]],
    ev: [[0.15, () => sfx('swing')], [0.19, (f, o, G) => { const p = f.local([-0.1, 1.3, 1.05]); suck(G, p, 0.9, 16, [BLUE, BLUE2, 0xffffff], 6); G.fx.ring(p, { r0: 0.9, r1: 0.1, life: 0.2, color: BLUE2, billboard: true }); G.fx.light(p, BLUE, 40, 0.2); sfx('zap'); }]],
    hits: [hitAt(0.17, 0.24, [0, 1.3, 1.0], 0.55, 30), hitAt(0.25, 0.29, [0, 1.3, 1.05], 0.75, 14, { col: BLUE })] },
  light4: { dur: 0.66, track: 0.16, noMove: true, fist: 'R', shout: true,
    keys: [[0, 'punchPrep'], [0.16, 'punchPrep'], [0.22, 'punch'], [0.44, {}], [0.66, 'base']], lunge: [[0.15, 0.24, 9]],
    ev: [[0.08, (f, o, G) => { sfx('charge'); }], [0.2, () => sfx('heavy')],
      [0.3, (f, o, G) => { const p = f.local([0, 1.3, 1.25]); sfx('boom'); G.shake(0.12); G.fx.impact(p, RED, 1.2, f.fwd(new V3())); blast(G, p, 20, [RED, RED2, 0xffffff], 8); G.fx.ring(p, { r0: 0.2, r1: 1.6, life: 0.25, color: RED, normal: f.fwd(new V3()) }); }]],
    tick: (f, o, G, t) => { if (t > 0.08 && t < 0.28) { const p = hand(f, 'R'); G.fx.p(p, { vel: [rand(-1, 1), rand(-0.5, 1), rand(-1, 1)], size: 0.06 + (t - 0.08) * 0.6, size1: 0.01, life: 0.2, color: Math.random() < 0.6 ? RED : RED2, alpha: 0.9, drag: 2 }); } },
    hits: [hitAt(0.21, 0.28, [0, 1.3, 1.0], 0.5, 30), hitAt(0.3, 0.34, [0, 1.3, 1.3], 0.9, 36, { col: RED })] },

  /* --- 우클: 허식 「무라사키」 — 창과 혁을 합쳐 일직선상의 모든 것을 지운다 (막을 수 없음 · 긴 쿨타임) --- */
  heavy: { dur: 2.05, cd: 'heavy', track: 1.15, aim: true, noMove: true, shout: true, tele: [0.6, 'red'],
    keys: [[0, 'pointPrep'], [0.14, 'spread'], [0.72, 'spread'], [0.86, 'join'], [1.18, 'join'], [1.26, 'fire'], [1.75, 'fire'], [2.05, 'base']],
    start: (f, o, G) => { G.say(f, '"술식순전 「창」, 술식반전 「혁」…"'); sfx('charge'); f.purple = new PurpleCharge(G, f); G.spawn(f.purple); G.setTint(PURPLE, 0.18); },
    ev: [[0.42, () => sfx('charge')], [0.86, (f, o, G) => { sfx('zap'); G.flash(PURPLE2, 0.2); G.say(f, '"허식 「무라사키」."'); }],
      [1.27, (f, o, G) => { if (f.purple) f.purple.kill(); const dir = f.fwd(new V3()), from = f.local([-0.1, 1.35, 1.2]); G.spawn(new HollowPurple(G, f, from, dir)); f.vel.addScaledVector(dir, -4); G.setTint(0, 0); }]],
    end: (f, o, G) => { if (f.purple) f.purple.kill(); f.purple = null; G.setTint(0, 0); } },

  /* --- Shift: 술식순전 「창」 — 끌어당기는 푸른 구. 멀리 던지면 고죠도 구 쪽으로 끌려간다 --- */
  s1: { dur: 0.72, cd: 's1', aim: true, track: 0.18, noMove: true,
    keys: [[0, 'pointPrep'], [0.16, 'point'], [0.55, 'point'], [0.72, 'base']],
    start: (f, o, G) => { G.say(f, '"술식순전 「창」."'); sfx('charge'); },
    tick: (f, o, G, t, dt) => {
      if (t < 0.2) suck(G, hand(f, 'R'), 0.6, 2, [BLUE, BLUE2], 3);
      // 자기 끌어당김: 구가 멀면 0.3~0.5초에 구 앞까지 끌려간다
      if (f.blueC && t >= 0.3 && t <= 0.5) { const d = new V3().subVectors(f.blueC, f.pos).setY(0), L = d.length(); if (L > 2.4) { d.normalize(); const sp = Math.min(32, (f.blueGap) / 0.2); f.vel.x = d.x * sp; f.vel.z = d.z * sp; G.fx.p(f.chest(new V3()), { size: 1.0, size1: 0.2, life: 0.2, color: BLUE, alpha: 0.4 }); } else { f.vel.x *= 0.3; f.vel.z *= 0.3; } }
    },
    ev: [[0.2, (f, o, G) => {
      const fw = f.fwd(new V3()); let d = 5.5; if (o && !o.gone && o.state !== 'ko') { const to = new V3().subVectors(o.pos, f.pos).setY(0), L = to.length(); if (L < 11 && to.normalize().dot(fw) > 0.6) d = Math.max(2.2, L); }
      const c = f.pos.clone().addScaledVector(fw, d).setY(f.pos.y + 1.1); f.blueC = d > 4.5 ? c : null; f.blueGap = d - 2.6; G.spawn(new BlueOrb(G, f, c));
    }], [0.5, (f) => { f.vel.x *= 0.2; f.vel.z *= 0.2; }]],
    end: (f) => { f.blueC = null; } },

  /* --- E: 술식반전 「혁」 — 손끝에 모은 붉은 척력을 터뜨려 앞의 적을 멀리 날려 보낸다 --- */
  s2: { dur: 0.8, cd: 's2', aim: true, track: 0.3, noMove: true, shout: true,
    keys: [[0, 'pointPrep'], [0.3, 'pointPrep'], [0.36, 'point'], [0.6, 'point'], [0.8, 'base']],
    start: (f, o, G) => { G.say(f, '"술식반전 「혁」."'); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.34) { const p = hand(f, 'R'), k = t / 0.34; G.fx.p(p, { size: 0.1 + 0.35 * k, size1: 0.05, life: 0.08, color: RED, alpha: 0.9 }); if (Math.random() < 0.6) { const d = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); G.fx.p(p.clone().addScaledVector(d, 0.5), { vel: [-d.x * 3, -d.y * 3, -d.z * 3], size: 0.06, size1: 0.01, life: 0.16, color: RED2, alpha: 0.9, drag: 0 }); } } },
    ev: [[0.36, (f, o, G) => { const dir = f.fwd(new V3()), from = f.local([-0.05, 1.35, 1.0]); G.spawn(new RedBlast(G, f, from, dir)); f.vel.addScaledVector(dir, -3.5); }]] },

  /* --- 극한 회피 뒤 좌클: 순간이동 — 상대 등 뒤로 넘어가 돌려차기 --- */
  counter: { dur: 0.6, aim: true, fist: 'LR',
    keys: [[0, 'kickPrep'], [0.08, 'kick'], [0.36, {}], [0.6, 'base']],
    ev: [[0, (f, o, G) => { warp(f, o, G, true, 1.0); G.flash(BLUE2, 0.2); }], [0.07, (f) => { sfx('heavy'); f.slashFx({ tilt: 0.1, r: 1.9, color: BLUE2, at: [0, 1.15, 0.3], flip: true }); }]],
    hits: [hitAt(0.06, 0.2, [0, 1.15, 0.95], 0.75, 92, { kb: [7, 3.5], stun: 0.6, hs: 0.14, shake: 0.18, daze: 40, snd: 'big' })] },

  /* --- Q: 영역전개 「무량공처」 — 무한의 정보가 쏟아지는 공간에 가둔다. 상대는 아무것도 못 한 채 멈추고, 고죠가 걸어가 끝낸다 --- */
  ult: { dur: 3.9, ult: true, aim: true, shout: true, fist: 'LR',
    keys: (() => { const k = [[0, 'mudra'], [1.15, 'mudra'], [1.35, 'base'], [1.45, 'rushL']]; for (let i = 0, t = 1.55; t < 2.55; i++, t += 0.11) k.push([t, i % 2 ? 'rushL' : 'rushR']);
      k.push([2.62, 'punchPrep'], [2.8, 'punchPrep'], [2.86, 'punch'], [3.3, 'punch'], [3.6, 'win'], [3.9, 'base']); return k; })(),
    cam: [[0, { ref: 'self', p: [0.5, 1.75, 1.5], l: [0, 1.7, 0], fov: 34 }], [0.35, { ref: 'self', p: [0.9, 1.9, 2.4], l: [0, 1.6, 0], fov: 44 }],
      [0.9, { ref: 'self', p: [3.2, 2.6, 6.5], l: [0, 1.5, 2], fov: 62 }], [1.3, { ref: 'target', p: [1.6, 1.7, 2.4], l: [0, 1.5, 0], fov: 46 }],
      [2.4, { ref: 'target', p: [-2.6, 1.4, 1.6], l: [0, 1.3, -0.4], fov: 50 }], [2.85, { ref: 'target', p: [-2.2, 1.2, 0.8], l: [0, 1.3, -0.4], fov: 44 }],
      [3.9, { ref: 'target', p: [3.5, 2.4, 6.5], l: [0, 1.2, -1], fov: 56 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.say(f, '"영역전개."'); sfx('charge'); G.setTint(0x2a3a7a, 0.3); }],
      [0.35, (f, o, G) => { f.domain = new VoidDomain(G, f, f.pos.clone().setY(0)); G.spawn(f.domain); G.setTint(0x1a2a6a, 0.5); G.say(f, '"「무량공처」."'); }],
      [1.3, (f, o, G) => { o = f.ultTgt || o; if (!o) return; warp(f, o, G, false, 0.9); sfx('swing'); }],
      [2.86, (f, o, G) => { o = f.ultTgt || o; if (!o) return; o.release(); sfx('boom'); sfx('big'); G.flash(VOIDW, 0.6); G.shake(0.55); G.slow(0.3, 0.45);
        const c = aim(o); G.fx.impact(c, BLUE, 2.8); blast(G, c, 60, [BLUE, BLUE2, PURPLE2, 0xffffff], 14); G.fx.light(c, BLUE2, 200, 0.8, 22);
        G.fx.ring(c, { r0: 0.3, r1: 6, life: 0.5, color: VOIDW, normal: f.fwd(new V3()) }); G.fx.ring(o.pos.clone().setY(0.05), { normal: UP, r0: 0.5, r1: 7, life: 0.6, color: BLUE2 });
        o.takeHit(f, { dmg: 210, kb: [10, 8], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big', col: BLUE }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) t.takeHit(f, { dmg: 110, kb: [6, 9], stun: 0.8, force: true, noCrit: true, col: BLUE }, new V3().subVectors(t.pos, o.pos).setY(0).normalize()); }],
      [3.3, (f, o, G) => { if (f.domain) f.domain.collapse(); G.setTint(0, 0); }],
    ],
    tick: (f, o, G, t, dt) => {
      const tg = f.ultTgt; if (!tg) return;
      // 무한의 정보: 상대 머리로 쏟아져 들어가는 빛줄기 · 상대는 살짝 떠서 굳는다
      if (t > 0.6 && t < 2.86 && tg.held) { tg.pos.y += (Math.min(0.25, 0.25 * (t - 0.6) * 2) - tg.pos.y) * Math.min(1, dt * 6); tg.vel.set(0, 0, 0);
        const h = tg.chest(new V3()).add(new V3(0, 0.55 * tg.scale, 0)); for (let i = 0; i < 4; i++) { const d = new V3(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize(), p = h.clone().addScaledVector(d, rand(2, 4)), v = h.clone().sub(p).multiplyScalar(4); G.fx.p(p, { vel: [v.x, v.y, v.z], size: rand(0.04, 0.09), size1: 0.01, life: 0.25, color: i % 2 ? VOIDW : BLUE2, alpha: 0.95, drag: 0 }); } }
      // 연타: 0.11초마다 한 대 (작은 피해 · 쓰러지지 않음)
      if (t > 1.5 && t < 2.6 && tg.held) { f.rushAcc = (f.rushAcc || 0) + dt; while (f.rushAcc >= 0.11) { f.rushAcc -= 0.11; const p = aim(tg).addScaledVector(new V3().subVectors(f.pos, tg.pos).setY(0).normalize(), 0.3);
        sfx('hit'); G.fx.burst(p, 8, [BLUE2, 0xffffff], 5); G.fx.ring(p, { r0: 0.1, r1: 0.7, life: 0.12, color: BLUE2, billboard: true });
        tg.takeHit(f, { dmg: 8, kb: [0, 0], stun: 99, hs: 0.015, nokill: true, noScale: true, force: true, noCrit: true, daze: 6, snd: 'hit', col: BLUE }, new V3().subVectors(tg.pos, f.pos).setY(0).normalize()); } }
      if (t > 2.6 && t < 2.86) { const p = hand(f, 'R'); G.fx.p(p, { size: 0.3, size1: 0.05, life: 0.1, color: BLUE2, alpha: 0.9 }); }
    },
    end: (f, o, G) => { G.setTint(0, 0); if (f.domain) f.domain.collapse(); f.domain = null; f.rushAcc = 0; const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};
moves.plunge.fist = 'R'; moves.plungeLand.fist = 'R';

/* =====================================================================
   피격 이펙트 · 무하한 게이지
   ===================================================================== */
function hitFx(G, p, dir, h, att) {
  const col = h.col ?? BLUE, big = h.dmg >= 60;
  G.fx.impact(p, col, big ? 1.7 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.5 : 1.0, color: col === BLUE ? BLUE2 : col, life: 0.18 });
  // 무하한: 때릴수록 차오른다 (발동 중에는 쌓이지 않음)
  if (!(att.infT > 0)) att.inf = Math.min(100, (att.inf || 0) + h.dmg * 0.22);
}

// 무하한: 가득 차면 INF_DUR 초 동안 발동 — 받는 피해 ×0.6 · 주위로 날아오는 적의 탄이 느려지다 멈춘다
function createModelWithInf(pal) {
  const m = createModel(pal), up = m.update;
  const shellM = new THREE.MeshBasicMaterial({ color: BLUE2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: true });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), shellM); shell.position.y = 1.05; shell.scale.set(0.95, 1.2, 0.95); shell.visible = false; shell.castShadow = false; m.root.add(shell);
  const tmp = new V3();
  m.update = (dt, f) => {
    const G = f.G, live = f.state !== 'ko' && !f.gone;
    if (f.infT > 0 && live) {
      f.infT -= dt; f.inf = Math.max(0, f.infT / INF_DUR * 100); f.defMul = 0.6;
      const c = f.chest(tmp);
      for (const e of G.ents) {
        if (e.done || !e.pos || !e.pos.isVector3 || !e.vel || !e.vel.isVector3 || foeTeam(e) === undefined || foeTeam(e) === f.team) continue;
        if (e.pos.distanceTo(c) < 2.6) { e.vel.multiplyScalar(Math.exp(-dt * 9)); if (Math.random() < 0.4) G.fx.p(e.pos, { size: 0.35, size1: 0.6, life: 0.2, color: BLUE2, alpha: 0.4 }); }
      }
      shell.visible = f.root.visible; shell.rotation.y += dt * 0.6; shellM.opacity = 0.05 + 0.03 * Math.sin(G.time * 7);
      if (f.root.visible && Math.random() < 0.25) G.fx.p(f.pos.clone().add(new V3(rand(-0.8, 0.8), rand(0.2, 2.0), rand(-0.8, 0.8))), { vel: [0, 0.3, 0], size: 0.05, size1: 0.01, life: 0.5, color: BLUE2, alpha: 0.8, drag: 1 });
      if (f.infT <= 0) { f.infT = 0; f.inf = 0; }
    } else {
      f.defMul = 1; shell.visible = false;
      if (live && G.state === 'fight') f.inf = Math.min(100, (f.inf || 0) + dt * 4.5);
      if ((f.inf || 0) >= 100 && live) { f.infT = INF_DUR; sfx('zap'); G.fx.ring(f.chest(tmp), { r0: 0.2, r1: 2.6, life: 0.4, color: BLUE2, billboard: true }); G.say(f, '"무하한."'); }
    }
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist > 5 && dist < 16 && f.cd.heavy <= 0 && Math.random() < 0.22) return 'heavy';
  if (dist > 3.5 && dist < 11 && f.cd.s1 <= 0 && Math.random() < 0.35) return 's1';
  if (dist < 5 && f.cd.s2 <= 0 && Math.random() < 0.3) return 's2';
  return null;
}

export default {
  id: 'gojo', name: '고죠 사토루', short: '고죠', title: '최강의 주술사', scale: 1.0,
  desc: '근·중거리 · 맨손 체술 · 술식. 눈을 붕대로 가린 주술고전의 교사. 맨손 체술 사이로 끌어당기는 「창」, 밀쳐내는 「혁」을 섞어 싸우고, 둘을 합친 허식 「무라사키」로 일직선상의 모든 것을 지운다. 무하한이 차면 무한이 펼쳐져 날아오는 탄이 멈추고 받는 피해가 줄어든다.',
  stats: { hp: 950, speed: 8.0, jump: 11, crit: 0.25 },
  palettes: [{ accent: BLUE, band: '#0a1a3a' }, { accent: 0xc070ff, band: '#2a0a3a' }],
  skills: { heavy: { name: '허식 「무라사키」', cd: 25 }, s1: { name: '술식순전 「창」', cd: 9 }, s2: { name: '술식반전 「혁」', cd: 10 }, ult: { name: '영역전개 「무량공처」', sub: 'INFINITE VOID' } },
  aiPick, aimRange: 14,
  resource: (f) => f.infT > 0 ? { v: f.infT / INF_DUR, label: '무하한', color: 0x9ad4ff, full: true } : { v: (f.inf || 0) / 100, label: '무하한', color: 0x3a7cff },
  onReset: (f) => { f.inf = 0; f.infT = 0; f.purple = null; f.domain = null; f.blueC = null; f.rushAcc = 0; f.defMul = 1; },
  moveList: [['좌클 ×4', '왼손 잽 30 → 돌려차기 42 → 「창」을 실은 장타 30 + 14 → 「혁」을 실은 정권 30 + 붉은 폭발 36'], ['공중 좌클', '주먹으로 땅을 내려쳐 「창」이 터진다 70'],
    ['우클 · 허식 「무라사키」', '두 손에 「창」과 「혁」을 모아 합친 보랏빛 구를 쏜다: 일직선을 꿰뚫으며 170 · 막을 수 없음 · 적의 탄을 지움 (쿨타임 25초)'],
    ['Shift · 술식순전 「창」', '앞에 끌어당기는 푸른 구: 0.24초마다 8 + 둔화 → 수축 폭발 34. 멀리 던지면 고죠도 구 앞까지 끌려간다'],
    ['E · 술식반전 「혁」', '손끝에 모은 붉은 척력을 터뜨려 앞의 적을 멀리 날려 보낸다 105'],
    ['Q · 영역전개 「무량공처」', '별빛 가득한 무한의 공간에 가둔다: 상대는 쏟아지는 정보에 굳고, 고죠가 다가가 연타 8×9 → 마지막 일격 210'],
    ['무하한', '시간이 지나거나 때릴수록 차고, 가득 차면 6초 동안 무한 발동: 받는 피해 ×0.6 · 날아오는 적의 탄이 느려지다 멈춘다'],
    ['C (타이밍) · 극한 회피', '순간이동: 상대 등 뒤로 넘어가 돌려차기 92'], ['가만히', '두 손을 주머니에 넣고 하늘을 올려다봄']],
  createModel: createModelWithInf, poses, moves, hitFx,
};
