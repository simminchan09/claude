// 아수라 (ASURA · 황금 매의 순례자) — 근·중거리 · 장병기 회전술 · 바람 · 매
// 금빛 매의 깃을 두른 젊은 순례자. 위 끝엔 초승달 갈고리, 아래 끝엔 바퀴 칼날이 달린 황금 장대를 바람개비처럼 돌린다.
// 갈고리로 걸어 등 뒤로 넘기고, 금빛 깃을 흩뿌리며 꿰뚫고 지나가고, 바퀴 칼날을 부메랑처럼 던진다. 맞힐수록 깃이 모인다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, featherGeoShared, GOLD, GOLD2, ORANGE, TEAL, TEAL2, WP } from './asura_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const GOLDS = [GOLD, GOLD2, ORANGE];

/* =====================================================================
   포즈 (weapon = 몸 기준 장대 방향 [피치(위+), 좌우(오른쪽+), 롤]. 왼손은 IK 로 장대를 잡는다)
   ===================================================================== */
const LEGS_LUNGE = { hipL: [-1.0, 0, 0.12], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.12], kneeR: [0.3, 0, 0] };
const poses = {
  // 기본: 왼발을 앞에 두고 몸을 살짝 비튼 자세 — 장대를 비스듬히 세워 갈고리가 앞 위로
  base: { hips: [0, -0.35, 0], spine: [0.06, -0.08, 0], chest: [0.03, -0.1, 0], head: [0.02, 0.42, 0],
    shoulderR: [0.1, 0, -0.2], elbowR: [-1.1, 0, 0], weapon: [0.8, 0.15, 0], shoulderL: [-0.6, 0, 0.1], elbowL: [-0.8, 0, 0],
    hipL: [-0.35, 0, 0.1], kneeL: [0.4, 0, 0], footL: [-0.05, 0, 0], hipR: [0.28, 0, -0.1], kneeR: [0.3, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.15, 0], spine: [0.34, 0.05, 0], chest: [0.06, 0.05, 0], head: [-0.2, 0.1, 0], shoulderR: [0.45, 0, -0.25], elbowR: [-0.75, 0, 0], weapon: [0.12, -0.2, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.3, 0, 0], shoulderR: [-0.5, 0, -0.3], elbowR: [-0.9, 0, 0], weapon: [0.6, -0.2, 0] },
  // 방어: 장대를 몸 앞에 가로로 들어 막는다
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.05, 0], chest: [0.05, 0.05, 0], head: [0, 0.15, 0], shoulderR: [-0.8, 0, -0.2], elbowR: [-1.3, 0, 0], weapon: [0.45, -1.3, 1.45],
    hipL: [-0.5, 0, 0.2], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.8, -0.6, 0.3], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.6, 0.8, 0.4], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.76, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -1.4, 1.57],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.7, 0, -0.3], elbowR: [-0.5, 0, 0], weapon: [0.1, -0.3, 0], shoulderL: [0.7, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.9, 0, 0] },
  // 승리: 장대를 곧게 세워 짚고 먼 곳을 바라본다
  win: { hips: [0, 0.15, 0], spine: [0.0, 0.1, 0], chest: [-0.04, 0.05, 0], head: [-0.12, -0.25, 0], shoulderR: [-0.5, 0, -0.32], elbowR: [-0.95, 0, 0], weapon: [1.5, 0.12, 0], shoulderL: [0.1, 0, 0.15], elbowL: [-0.25, 0, 0],
    hipL: [-0.05, 0, 0.1], kneeL: [0.06, 0, 0], hipR: [0.08, 0, -0.1], kneeR: [0.1, 0, 0] },
  portrait: { hips: [0, 0.2, 0], chest: [0, -0.15, 0], head: [0.02, 0.06, 0], shoulderR: [-0.6, 0, -0.3], elbowR: [-1.25, 0, 0], weapon: [1.3, 0.35, 0.3] },
  // 가로 베기: 오른쪽으로 감았다가 왼쪽으로 (갈고리 날이 앞장선다)
  sweepR: { hips: [0, -0.6, 0], spine: [0.1, -0.35, 0], chest: [0.02, -0.45, 0], head: [0, 0.8, 0], shoulderR: [-1.0, 0, -0.9], elbowR: [-0.4, 0, 0], weapon: [0.1, 1.9, -1.57], shoulderL: [-0.6, 0, 0.3], elbowL: [-1.1, 0, 0],
    hipL: [-0.5, 0, 0.18], kneeL: [0.7, 0, 0], hipR: [0.35, 0, -0.18], kneeR: [0.55, 0, 0] },
  sweepL: { hips: [0, 0.45, 0], spine: [0.2, 0.35, 0], chest: [0.05, 0.45, 0], head: [0, -0.55, 0], shoulderR: [-1.3, 0, 0.45], elbowR: [-0.12, 0, 0], weapon: [0.05, -1.7, -1.57], shoulderL: [0.3, 0, 0.6], elbowL: [-0.5, 0, 0], ...LEGS_LUNGE },
  // 거꾸로 쥔 장대: 바퀴 끝을 왼쪽 앞 → 오른쪽 앞으로 쓸어 친다
  buttPrep: { hips: [0, 0.5, 0], spine: [0.15, 0.35, 0], chest: [0.05, 0.4, 0], head: [0, -0.6, 0], shoulderR: [-1.1, 0, 0.35], elbowR: [-0.5, 0, 0], weapon: [0.5, 2.25, 0], shoulderL: [-0.2, 0, 0.5], elbowL: [-0.9, 0, 0],
    hipL: [-0.55, 0, 0.15], kneeL: [0.75, 0, 0], hipR: [0.4, 0, -0.15], kneeR: [0.5, 0, 0] },
  buttHit: { hips: [0, -0.5, 0], spine: [0.25, -0.35, 0], chest: [0.08, -0.4, 0], head: [0, 0.7, 0], shoulderR: [-1.25, 0, -0.75], elbowR: [-0.2, 0, 0], weapon: [0.3, 3.95, 0], shoulderL: [0.2, 0, 0.6], elbowL: [-0.6, 0, 0],
    hipL: [-0.8, 0, 0.15], kneeL: [0.9, 0, 0], hipR: [0.55, 0, -0.15], kneeR: [0.4, 0, 0] },
  // 회전: 장대를 옆으로 길게 뻗은 채 몸을 돌린다
  spin: { hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.05, 0.25, 0], head: [0, -0.2, 0], shoulderR: [-1.45, 0, -1.15], elbowR: [-0.05, 0, 0], weapon: [-0.05, 1.55, 1.57], shoulderL: [-0.5, 0, 1.2], elbowL: [-0.3, 0, 0],
    hipL: [-0.6, 0, 0.25], kneeL: [0.85, 0, 0], hipR: [0.4, 0, -0.25], kneeR: [0.65, 0, 0] },
  // 머리 위로 치켜든 자세 (갈고리는 등 뒤 위)
  raiseHigh: { hips: [0, 0, 0], spine: [-0.2, 0, 0], chest: [-0.12, 0, 0], head: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.2], elbowR: [-0.45, 0, 0], weapon: [2.35, 0, 0], shoulderL: [-2.7, 0, 0.25], elbowL: [-0.5, 0, 0],
    hipL: [-1.1, 0, 0.1], kneeL: [1.6, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
  // 내려찍은 직후: 무릎을 굽히고 갈고리가 앞쪽 땅에 박힘
  cleave: { hipY: -0.12, hips: [0, -0.15, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.4, 0, 0], shoulderR: [-1.25, 0, -0.08], elbowR: [-0.2, 0, 0], weapon: [-0.75, 0, 0], shoulderL: [-1.1, 0, 0.1], elbowL: [-0.3, 0, 0],
    hipL: [-1.3, 0, 0.12], kneeL: [1.75, 0, 0], footL: [-0.3, 0, 0], hipR: [-0.2, 0, -0.12], kneeR: [1.5, 0, 0], footR: [-0.4, 0, 0] },
  // 갈고리 내지르기 준비 → 길게 뻗기 → 등 뒤로 끌어 넘기기
  hookPrep: { hips: [0, -0.55, 0], spine: [0.1, -0.25, 0], chest: [0.04, -0.3, 0], head: [0, 0.75, 0], shoulderR: [0.45, 0, -0.25], elbowR: [-1.35, 0, 0], weapon: [0.12, 0.05, 3.14],
    hipL: [-0.55, 0, 0.15], kneeL: [0.7, 0, 0], hipR: [0.4, 0, -0.15], kneeR: [0.55, 0, 0] },
  hookReach: { hips: [0, 0.1, 0], spine: [0.35, 0.12, 0], chest: [0.1, 0.18, 0], head: [-0.25, -0.2, 0], shoulderR: [-1.5, 0, 0.02], elbowR: [-0.05, 0, 0], weapon: [0.08, 0, 3.14], ...LEGS_LUNGE },
  hookYank: { hips: [0, -0.75, 0], spine: [-0.1, -0.45, 0], chest: [-0.05, -0.5, 0], head: [0, 0.6, 0], shoulderR: [-0.9, 0, -1.1], elbowR: [-0.3, 0, 0], weapon: [0.2, 2.3, 1.57], shoulderL: [-0.4, 0, 0.6], elbowL: [-0.7, 0, 0],
    hipL: [-0.2, 0, 0.25], kneeL: [0.5, 0, 0], hipR: [0.5, 0, -0.25], kneeR: [0.8, 0, 0] },
  // 돌진: 몸을 낮게 숙이고 장대를 옆구리에 끼워 앞으로
  rush: { hipY: -0.06, hips: [0, -0.2, 0], spine: [0.75, 0, 0], chest: [0.15, 0, 0], head: [-0.55, 0, 0], shoulderR: [-0.2, 0, -0.45], elbowR: [-0.6, 0, 0], weapon: [0.05, 2.7, 1.57], shoulderL: [0.6, 0, 0.5], elbowL: [-0.4, 0, 0],
    hipL: [-1.2, 0, 0.1], kneeL: [0.9, 0, 0], hipR: [0.7, 0, -0.1], kneeR: [0.6, 0, 0] },
  // 지나간 뒤: 미끄러지며 장대를 옆으로 뻗음
  slide: { hipY: -0.14, hips: [0, 0.4, 0], spine: [0.35, 0.3, 0], chest: [0.1, 0.35, 0], head: [-0.2, -0.6, 0], shoulderR: [-1.3, 0, -1.2], elbowR: [-0.05, 0, 0], weapon: [0.15, 1.8, -1.57], shoulderL: [0.3, 0, 0.9], elbowL: [-0.3, 0, 0],
    hipL: [-1.3, 0, 0.3], kneeL: [1.5, 0, 0], footL: [-0.3, 0, 0], hipR: [0.3, 0, -0.5], kneeR: [0.4, 0, 0] },
  // 궁극기: 웅크림 → 하늘로 솟음 → 매처럼 내리꽂음
  crouchUp: { hipY: -0.25, hips: [0, 0.2, 0], spine: [0.55, 0.1, 0], chest: [0.2, 0.1, 0], head: [-0.6, -0.1, 0], shoulderR: [0.5, 0, -0.4], elbowR: [-0.6, 0, 0], weapon: [0.3, 2.6, 0.3], shoulderL: [0.4, 0, 0.6], elbowL: [-0.5, 0, 0],
    hipL: [-1.7, 0, 0.2], kneeL: [2.2, 0, 0], footL: [-0.5, 0, 0], hipR: [-1.0, 0, -0.2], kneeR: [2.1, 0, 0], footR: [-0.9, 0, 0] },
  sky: { hips: [0, 0, 0], spine: [-0.25, 0, 0], chest: [-0.15, 0, 0], head: [-0.3, 0, 0], shoulderR: [-3.0, 0, -0.2], elbowR: [-0.1, 0, 0], weapon: [1.55, 0, 0], shoulderL: [0.2, 0, 1.4], elbowL: [-0.2, 0, 0],
    hipL: [-0.2, 0, 0.1], kneeL: [0.5, 0, 0], footL: [0.4, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [0.8, 0, 0], footR: [0.4, 0, 0] },
  dive: { hips: [0.9, 0, 0], spine: [0.3, 0, 0], chest: [0.1, 0, 0], head: [-0.7, 0, 0], shoulderR: [-1.6, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [-0.9, 0, 0], shoulderL: [0.6, 0, 1.0], elbowL: [-0.2, 0, 0],
    hipL: [0.3, 0, 0.1], kneeL: [0.4, 0, 0], footL: [0.5, 0, 0], hipR: [0.5, 0, -0.1], kneeR: [0.9, 0, 0], footR: [0.5, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 장대를 어깨에 걸치고 왼손은 허리에
  idle2: { hips: [0, 0.15, 0], spine: [0.02, 0.1, 0], chest: [-0.02, 0.1, 0], head: [0.1, -0.3, 0.05], shoulderR: [-1.0, 0, -0.35], elbowR: [-1.9, 0, 0], weapon: [0.35, 1.9, 0.3], shoulderL: [0.15, 0, 0.45], elbowL: [-1.6, 0, 0],
    hipL: [-0.1, 0, 0.12], kneeL: [0.1, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [0.25, 0, 0], footR: [-0.1, 0, 0] },
});

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const fth = (f) => f.feather || 0;
const addFeather = (f, v) => { f.feather = Math.min(100, fth(f) + v); };
const wind = (f, k) => { f.windK = k; };
const goldSlash = (f, o) => f.slashFx({ r: o.r || 2.2, color: o.color ?? GOLD, life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
// 금빛 깃 조각 파티클
function plumes(G, p, n = 10, sp = 4, cols = GOLDS) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.07, 0.14), size1: 0.02, life: rand(0.5, 0.9), color: cols[i % cols.length], alpha: 0.9, drag: 2.2, grav: 1.5, flick: 0.3 }); }
// 바람 소용돌이: 중심 둘레를 도는 청록 · 금빛 바람
function gust(G, c, R = 1.2, n = 12, h = 1.6) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), y = rand(0, h), p = c.clone().add(new V3(Math.cos(a) * R, y, Math.sin(a) * R)), t = new V3(-Math.sin(a), 0.4, Math.cos(a)).multiplyScalar(R * 6); G.fx.p(p, { vel: [t.x, t.y, t.z], size: rand(0.08, 0.16), size1: 0.02, life: rand(0.3, 0.55), color: i % 3 ? TEAL2 : GOLD2, alpha: 0.75, drag: 1.5 }); } }
// 직선 섬광: a → b
function streak(G, a, b, color = GOLD, w = 1) {
  const d = new V3().subVectors(b, a), L = d.length(); d.normalize(); const n = Math.max(3, Math.round(L / 0.45));
  for (let i = 0; i <= n; i++) { const p = a.clone().addScaledVector(d, (i / n) * L); G.fx.p(p, { size: 0.5 * w, size1: 0.05, life: 0.32, color: i % 2 ? color : 0xffffff, alpha: 0.85, drag: 0 }); }
  const mid = a.clone().add(b).multiplyScalar(0.5); G.fx.slash(mid, { fwd: d, normal: new V3().crossVectors(d, UP).normalize().add(UP).normalize(), r: L * 0.55, color, life: 0.3 });
}
// 초승달 바람 (땅을 따라 앞으로 퍼지는 금빛 참격)
function crescentWave(f, G, at, r = 2.2) { const c = f.local(at), fw = f.fwd(new V3()); G.fx.slash(c, { fwd: fw, normal: UP, r, color: GOLD, life: 0.32 }); G.fx.slash(c.clone().addScaledVector(fw, 0.4), { fwd: fw, normal: UP, r: r * 0.75, color: 0xffffff, life: 0.24 }); G.fx.burst(c, 16, GOLDS, 6, { dir: fw, spread: 0.7 }); G.fx.burst(c, 10, 0x8a7a60, 3, { kind: 'dust' }); }

let _fthMat = null;
const fthGeo = () => featherGeoShared(0.42, 0.06, 0.1);

/* ---------- 금빛 깃 칼날: 돌진한 자리에 꽂혀 있다가 일제히 날아올라 상대에게 꽂힌다 ---------- */
class FeatherBlades {
  constructor(G, f, a, b, n) {
    this.G = G; this.f = f; this.owner = f; this.t = 0; this.done = false; this.items = [];
    if (!_fthMat) _fthMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mat = _fthMat.clone(); this.g = new THREE.Group(); G.scene.add(this.g);
    const d = new V3().subVectors(b, a).setY(0), side = new V3(-d.z, 0, d.x).normalize();
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, p = a.clone().lerp(b, k).addScaledVector(side, ((i % 2) * 2 - 1) * rand(0.25, 0.6)); p.y = a.y + 0.05;
      const me = new THREE.Mesh(fthGeo(), this.mat); me.frustumCulled = false; me.position.copy(p); me.scale.setScalar(0.01 * f.scale);
      const dir = new V3(rand(-0.3, 0.3), 1, rand(-0.3, 0.3)).normalize(); me.lookAt(p.clone().add(dir)); this.g.add(me);
      this.items.push({ me, p, vel: new V3(), state: 'stuck', delay: 0.4 + i * 0.035, hit: false, life: 0 });
    }
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    if (this.t > 2.6 || f.gone) return this.kill();
    let alive = 0;
    for (const it of this.items) {
      if (it.state === 'dead') continue; alive++;
      if (it.state === 'stuck') {
        it.me.scale.setScalar(Math.min(1, this.t / 0.12) * f.scale); if (Math.random() < 0.2) G.fx.p(it.p.clone().setY(it.p.y + 0.2), { vel: [0, 1, 0], size: 0.1, size1: 0.02, life: 0.3, color: GOLD2, alpha: 0.8 });
        if (this.t >= it.delay) { it.state = 'fly'; sfx('swing'); const tg = this.target(it.p); const to = tg ? tg.chest(new V3()) : it.p.clone().add(new V3(0, 3, 0)); it.vel.subVectors(to, it.p).normalize().multiplyScalar(20); it.tg = tg; }
      } else if (it.state === 'fly') {
        it.life += dt;
        if (it.tg && !it.tg.gone && it.tg.state !== 'ko') { const want = it.tg.chest(new V3()).sub(it.p).normalize().multiplyScalar(24); it.vel.lerp(want, 1 - Math.exp(-8 * dt)); }
        it.p.addScaledVector(it.vel, dt); it.me.position.copy(it.p); it.me.lookAt(it.p.clone().add(it.vel));
        G.fx.p(it.p, { size: 0.25, size1: 0.04, life: 0.16, color: GOLD, alpha: 0.7, drag: 0 });
        for (const t of f.foes()) if (t.hurtHit(it.p, 0.22)) { const r = t.takeHit(f, { dmg: 8, kb: [0.6, 0], stun: 0.22, hs: 0.02, daze: 5, noCrit: true, noScale: true, snd: 'hit' }, it.vel.clone().setY(0).normalize()); if (r === 'hit') addFeather(f, 2); G.fx.burst(it.p, 8, GOLDS, 4); it.state = 'dead'; it.me.visible = false; break; }
        if (it.state === 'fly' && (it.life > 0.9 || it.p.y < -0.2)) { G.fx.burst(it.p, 6, GOLDS, 3); it.state = 'dead'; it.me.visible = false; }
      }
    }
    if (!alive) this.kill();
  }
  target(p) { let best = null, bd = 9; for (const t of this.f.foes()) { const d = t.pos.distanceTo(p); if (d < bd) { bd = d; best = t; } } return best; }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.mat.dispose(); }
}

/* ---------- 바퀴 칼날 부메랑: 날아가 → 상대 곁에서 맴돌며 베고 → 손으로 돌아온다 ---------- */
class WheelBoomerang {
  constructor(G, f, to) {
    this.G = G; this.f = f; this.owner = f; this.t = 0; this.done = false; this.phase = 'out'; this.tick = 0; this.hitOut = new Set(); this.hitBack = new Set();
    this.mesh = f.model.wheel.clone(true); this.mesh.scale.setScalar(1.45 * f.scale); this.mesh.position.copy(f.model.wheelPos(new V3())); G.scene.add(this.mesh); this.mesh.traverse((o) => { o.frustumCulled = false; });
    this.pos = this.mesh.position; this.to = to.clone(); this.from = this.pos.clone(); this.spin = 0; f.wheelOut = true; f.wheelEnt = this;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.spin += dt * 26;
    if (f.gone || f.state === 'ko' || this.t > 4) return this.kill();
    if (this.phase === 'out') {
      const d = new V3().subVectors(this.to, this.pos), L = d.length(), sp = 19 + 6 * Math.min(1, L / 4);
      if (L < 0.25) { this.phase = 'hover'; this.ht = 0; sfx('zap'); } else this.pos.addScaledVector(d.normalize(), Math.min(L, sp * dt));
      this.hitAll(this.hitOut, { dmg: 42, kb: [2.5, 0], stun: 0.5, hs: 0.07, daze: 16, snd: 'hit' });
    } else if (this.phase === 'hover') {
      this.ht += dt; this.tick -= dt; this.pos.y += Math.sin(this.ht * 10) * 0.004;
      if (this.tick <= 0) { this.tick = 0.13; for (const t of f.foes()) if (t.hurtHit(this.pos, 1.0 * f.scale)) { const r = t.takeHit(f, { dmg: 10, kb: [0.4, 0], stun: 0.3, hs: 0.02, daze: 5, noCrit: true, snd: 'hit' }, new V3().subVectors(t.pos, this.pos).setY(0).normalize()); if (r === 'hit') addFeather(f, 2); sfx('swing'); } }
      gust(G, this.pos.clone().setY(this.pos.y - 0.6), 0.9, 3, 1.2);
      if (this.ht > 0.55) { this.phase = 'back'; sfx('swing'); }
    } else {
      const home = f.model.wheelPos(new V3()), d = new V3().subVectors(home, this.pos), L = d.length();
      this.pos.addScaledVector(d.normalize(), Math.min(L, 24 * dt));
      this.hitAll(this.hitBack, { dmg: 38, kb: [-3, 1.5], stun: 0.55, hs: 0.07, daze: 16, snd: 'hit' });
      if (L < 0.35) { sfx('block'); G.fx.burst(home, 12, GOLDS, 4); return this.kill(); }
    }
    // 회전: 비스듬히 누운 원반처럼 빠르게 돈다
    this.mesh.rotation.set(Math.PI / 2 - 0.35, 0, this.spin);
    G.fx.p(this.pos, { size: 0.6, size1: 0.1, life: 0.16, color: TEAL, alpha: 0.5, drag: 0 });
    if (Math.random() < 0.6) G.fx.p(this.pos.clone().add(new V3(Math.cos(this.spin) * 0.3, 0, Math.sin(this.spin) * 0.3)), { vel: [0, 0.5, 0], size: 0.12, size1: 0.02, life: 0.3, color: GOLD2, alpha: 0.9 });
  }
  hitAll(set, h) { const f = this.f; for (const t of f.foes()) { if (set.has(t.id) || !t.hurtHit(this.pos, 0.42 * f.scale)) continue; set.add(t.id); const dir = new V3().subVectors(t.pos, this.pos).setY(0).normalize(); const r = t.takeHit(f, h, dir); if (r === 'hit') { addFeather(f, 4); this.G.fx.impact(this.pos, GOLD, 1.0); } } }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); if (this.f.wheelEnt === this) { this.f.wheelOut = false; this.f.wheelEnt = null; } }
}

/* ---------- 궁극기: 거대한 황금 매의 혼 ---------- */
let _falconGeo = null;
function falconGeo() {
  if (_falconGeo) return _falconGeo;
  const body = new THREE.LatheGeometry([[0, -1.0], [0.16, -0.8], [0.32, -0.3], [0.36, 0.1], [0.3, 0.45], [0.2, 0.7], [0, 0.85]].map(([r, y]) => new THREE.Vector2(r, y)), 20); body.rotateX(Math.PI / 2);
  const head = new THREE.SphereGeometry(0.24, 16, 12); head.scale(0.9, 0.9, 1.1); head.translate(0, 0.12, 0.95);
  const beak = new THREE.ConeGeometry(0.08, 0.3, 10); beak.rotateX(Math.PI / 2 + 0.5); beak.translate(0, 0.02, 1.2);
  // 날개: 어깨에서 끝으로 가늘어지고, 뒤쪽 가장자리는 깃털처럼 톱니
  const wing = (s) => {
    const g = new THREE.BufferGeometry(), N = 28, M = 6, pos = [], idx = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) {
      const u = i / N, v = j / M, span = 2.6 * u, chord = (0.9 - 0.45 * u) * (1 + 0.35 * Math.max(0, Math.sin(u * Math.PI * 9)) * v * (u > 0.2 ? 1 : 0)), z = 0.35 - v * chord - 0.5 * u * u;
      pos.push(s * span, 0.25 * Math.sin(u * Math.PI * 0.8) - 0.15 * u * u, z);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const tail = new THREE.BufferGeometry(); { const pos = [0, 0, -0.8], idx = []; for (let i = 0; i <= 10; i++) { const a = -0.55 + 1.1 * (i / 10), r = 1.0 + 0.12 * (i % 2); pos.push(Math.sin(a) * r, 0, -0.8 - Math.cos(a) * r); } for (let i = 1; i <= 10; i++) idx.push(0, i, i + 1); tail.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tail.setIndex(idx); tail.computeVertexNormals(); }
  _falconGeo = { body, head, beak, wingL: wing(1), wingR: wing(-1), tail };
  return _falconGeo;
}
class FalconSpirit {
  constructor(G, f) {
    this.G = G; this.f = f; this.owner = f; this.t = 0; this.done = false; this.k = 0; this.fade = 1; this.flap = 0;
    const Gm = falconGeo(); this.mats = [0, 1].map((i) => new THREE.MeshBasicMaterial({ color: i ? GOLD2 : ORANGE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh = new THREE.Group(); G.scene.add(this.mesh);
    const mk = (geo, mat, parent = this.mesh) => { const me = new THREE.Mesh(geo, mat); me.frustumCulled = false; parent.add(me); return me; };
    mk(Gm.body, this.mats[0]); const inner = mk(Gm.body, this.mats[1]); inner.scale.setScalar(0.65); mk(Gm.head, this.mats[0]); mk(Gm.beak, this.mats[1]); mk(Gm.tail, this.mats[0]);
    this.wings = [];
    for (const [geo, s] of [[Gm.wingL, 1], [Gm.wingR, -1]]) { const w = new THREE.Group(); w.position.set(s * 0.25, 0.15, 0.25); this.mesh.add(w); mk(geo, this.mats[0], w); const w2 = mk(geo, this.mats[1], w); w2.scale.set(0.92, 1, 0.7); w2.position.y = 0.02; this.wings.push({ w, s }); }
    this.mesh.scale.setScalar(2.2 * f.scale);
  }
  // 위치 · 바라보는 점 · 날갯짓 세기
  place(p, look, flap, dt) {
    this.mesh.position.copy(p); this.mesh.lookAt(look); this.flap += dt * (6 + 10 * flap);
    for (const { w, s } of this.wings) w.rotation.z = s * (Math.sin(this.flap) * 0.55 * flap + (1 - flap) * -0.15);
  }
  update(dt) {
    const G = this.G; this.t += dt; this.k = Math.min(1, this.k + dt * 3);
    const op = this.k * this.fade; this.mats[0].opacity = 0.45 * op; this.mats[1].opacity = 0.6 * op;
    if (op > 0.05 && Math.random() < 0.8) { const p = this.mesh.position.clone().add(new V3(rand(-2.5, 2.5), rand(-0.6, 0.6), rand(-2, 2))); G.fx.p(p, { vel: [0, -1.5, 0], size: rand(0.08, 0.18), size1: 0.02, life: 0.7, color: GOLDS[(Math.random() * 3) | 0], alpha: 0.9, drag: 1, flick: 0.4 }); }
    if (this.dying) { this.fade -= dt * 1.3; this.mesh.position.y += dt * 6; this.place(this.mesh.position, this.mesh.position.clone().add(new V3(0, 1, 0.3)), 1, dt); if (this.fade <= 0) this.kill(); }
    if (this.t > 6) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); for (const m of this.mats) m.dispose(); if (this.f.ultFalcon === this) this.f.ultFalcon = null; }
}

// 깃 돌진: 앞으로 순식간에 꿰뚫고 지나가며 (가는 길의 적 모두 피해) 지나간 자리에 깃 칼날을 남긴다
function featherDash(f, o, G, dmg, n, back) {
  const fw = f.fwd(new V3()), from = f.pos.clone(); let len = 7;
  if (o && !o.gone && o.state !== 'ko') { const to = new V3().subVectors(o.pos, f.pos).setY(0), d = to.length(); if (d < 9 && to.normalize().dot(fw) > 0.5) len = d + 1.7 * o.scale; }
  const dest = from.clone().addScaledVector(fw, len), W = G.stage && G.stage.world;
  if (W) for (let k = 1; k <= 12; k++) { const p = from.clone().addScaledVector(fw, (k / 12) * len).setY(from.y + 0.6); if (W.solidAt(p, 0.3)) { dest.copy(from).addScaledVector(fw, Math.max(0, (k - 1) / 12 * len)); break; } }
  f.pos.x = dest.x; f.pos.z = dest.z; f.vel.set(0, 0, 0); f.model.resetCloth(); f.inv = Math.max(f.inv, 0.15);
  const a = from.clone().setY(from.y + 1.0), b = dest.clone().setY(dest.y + 1.0); streak(G, a, b, GOLD, 1.2);
  for (let i = 0; i < 7; i++) G.fx.p(a.clone().lerp(b, i / 7), { size: 1.3, size1: 0.3, life: 0.28, color: ORANGE, alpha: 0.45 });
  for (let i = 0; i < 24; i++) { const p = a.clone().lerp(b, Math.random()); G.fx.p(p, { vel: [rand(-2, 2), rand(0, 2.5), rand(-2, 2)], size: 0.12, size1: 0.03, life: rand(0.4, 0.8), color: GOLDS[i % 3], alpha: 0.9, drag: 2, grav: 1.5, flick: 0.3 }); }
  sfx('dash'); sfx('swing'); G.flash(GOLD2, 0.1);
  for (const t of f.foes()) { if (!t.hurtHitSeg(a.clone().setY(from.y + 0.4), b.clone().setY(dest.y + 0.4), 0.5) && !t.hurtHitSeg(a, b, 0.5)) continue; t.takeHit(f, { dmg, kb: [back ? -1.5 : 1.2, 0], stun: 0.9, hs: 0.09, daze: 26, snd: 'big' }, fw); }
  if (n) G.spawn(new FeatherBlades(G, f, from.clone().setY(from.y), dest.clone().setY(from.y), n));
}

/* =====================================================================
   기술 — 장병기 회전술: 갈고리 베기 · 바퀴 치기 · 회전 · 도약 내려찍기 / 갈고리 넘기기 · 깃 돌진 · 바퀴 부메랑
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 갈고리를 아래로 세워 내리꽂아 깃 폭풍 --- */
  ...makePlunge({
    up: 'raiseHigh',
    fall: { ...poses.raiseHigh, spine: [0.3, 0, 0], head: [0.2, 0, 0], shoulderR: [-1.5, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.4, 0, 0], shoulderL: [-1.4, 0, 0.1], elbowL: [-0.3, 0, 0], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'cleave', color: GOLD, dmg: 70, r: 2.5,
    fx: (f, o, G, c) => { plumes(G, c.clone().setY(c.y + 0.3), 26, 6); gust(G, c, 2.2, 24, 1.2); },
  }),

  /* --- 기본 공격 (장대 회전 연격): 갈고리 가로 베기 → 바퀴 끝 치기 → 몸을 두 바퀴 돌리는 회전 → 도약해 초승달 내려찍기 --- */
  light1: { dur: 0.42, cancel: 0.2, next: 'light2', trail: true, track: 0.08,
    keys: [[0, 'sweepR'], [0.15, 'sweepL'], [0.27, {}], [0.42, 'base']], lunge: [[0.03, 0.12, 6]],
    ev: [[0.05, () => sfx('swing')], [0.09, (f) => goldSlash(f, { tilt: 0.12, r: 2.3, flip: true })]],
    hits: [{ t0: 0.05, t1: 0.16, dmg: 40 }] },
  light2: { dur: 0.44, cancel: 0.22, next: 'light3', trail: true, track: 0.08, ikOff: true,
    keys: [[0, 'buttPrep'], [0.15, 'buttHit'], [0.28, {}], [0.44, 'base']], lunge: [[0.03, 0.12, 6]],
    start: (f) => { f.model.trailButt = true; }, end: (f) => { f.model.trailButt = false; },
    ev: [[0.06, () => sfx('swing')], [0.1, (f) => goldSlash(f, { tilt: -0.1, r: 2.0, color: TEAL, at: [0, 0.95, 0.5] })], [0.16, (f, o, G) => G.fx.burst(f.model.wheelPos(new V3()), 8, [TEAL, TEAL2], 4)]],
    hits: [{ t0: 0.06, t1: 0.17, dmg: 42 }] },
  light3: { dur: 0.6, cancel: 0.44, next: 'light4', trail: true, ikOff: true, track: 0.04,
    keys: [[0, { ...poses.spin, weapon: [-0.05, 1.2, 1.57] }], [0.06, 'spin'], [0.46, 'spin'], [0.6, 'base']],
    start: (f) => { f.spinY0 = f.yaw; },
    tick: (f, o, G, t) => { if (t > 0.04 && t < 0.46) { f.yaw = f.spinY0 + ((t - 0.04) / 0.42) * TAU * 2; if (Math.random() < 0.6) gust(G, f.pos.clone(), 1.5, 2, 1.4); } else if (t >= 0.46) { f.yaw = f.spinY0; } },
    ev: [0.08, 0.22, 0.36].map((t) => [t, (f, o, G) => { sfx('swing'); G.fx.ring(f.local([0, 1.0, 0]), { normal: UP, r0: 0.4, r1: 2.0, life: 0.25, color: GOLD }); }]),
    hits: [0.08, 0.22, 0.36].map((t) => ({ t0: t, t1: t + 0.1, weapon: false, at: [0, 1.0, 0], r: 1.45, dmg: 16 })) },
  light4: { dur: 0.72, track: 0.16, noMove: true, trail: true,
    keys: [[0, { ...poses.raiseHigh, hipY: -0.06 }], [0.26, 'raiseHigh'], [0.38, 'cleave'], [0.56, 'cleave'], [0.72, 'base']], lunge: [[0.06, 0.34, 6.5]],
    ev: [[0.06, (f, o, G) => { f.vel.y = 6.2; f.onGround = false; sfx('jump'); gust(G, f.pos.clone(), 0.8, 10, 0.6); }], [0.3, () => sfx('swing')],
      [0.38, (f, o, G) => { sfx('heavy'); G.shake(0.16); crescentWave(f, G, [0, 0.15, 1.6], 2.4); plumes(G, f.local([0, 0.3, 1.6]), 12, 5); }]],
    hits: [{ t0: 0.28, t1: 0.4, dmg: 36 }, { t0: 0.38, t1: 0.46, weapon: false, at: [0, 0.4, 2.0], r: 1.0, dmg: 18 }] },

  /* --- 우클: 갈고리 넘기기 — 갈고리를 길게 내질러 상대를 걸고, 내 곁을 지나 등 뒤로 끌어 넘긴 뒤 돌아서며 벤다 --- */
  heavy: { dur: 1.0, cd: 'heavy', aim: true, track: 0.16, noMove: true, shout: true, trail: true,
    keys: [[0, 'hookPrep'], [0.16, 'hookPrep'], [0.24, 'hookReach'], [0.34, 'hookReach'], [0.5, 'hookYank'], [0.62, 'sweepR'], [0.74, 'sweepL'], [0.86, {}], [1.0, 'base']],
    lunge: [[0.18, 0.26, 7]],
    start: (f, o, G) => { f.hooked = null; sfx('charge'); wind(f, 0.6); },
    tick: (f, o, G, t, dt) => {
      // 걸린 상대: 앞 → 오른쪽 → 등 뒤로 반원을 그리며 끌려간다
      const h = f.hooked;
      if (h && !h.gone && t >= 0.34 && t <= 0.52) {
        const k = Math.min(1, (t - 0.34) / 0.16), th = Math.PI * (k * k * (3 - 2 * k)), r = f.hookR + (1.5 * h.scale - f.hookR) * k, fw = f.hookFw, rt = new V3(-fw.z, 0, fw.x).negate();
        const p = f.pos.clone().addScaledVector(fw, Math.cos(th) * r).addScaledVector(rt, Math.sin(th) * r * 0.9);
        h.pos.x = p.x; h.pos.z = p.z; h.pos.y = Math.max(h.pos.y, f.pos.y + Math.sin(th) * 0.5); h.vel.set(0, 0, 0); h.stun = Math.max(h.stun, 0.5);
        if (Math.random() < 0.7) G.fx.p(h.chest(new V3()), { vel: [0, 0.5, 0], size: 0.4, size1: 0.05, life: 0.2, color: GOLD, alpha: 0.6 });
      }
      // 돌아선다: 등 뒤의 상대 쪽으로 몸을 돌린다
      if (t > 0.5 && t < 0.66) f.faceOpp(22, dt);
    },
    ev: [[0.22, () => { sfx('dash'); sfx('swing'); }],
      [0.27, (f, o, G) => {
        const fw = f.fwd(new V3()), tip = f.model.tipPos(new V3()); streak(G, f.chest(new V3()), tip, GOLD, 0.6);
        for (const t of f.foes()) { const d = new V3().subVectors(t.pos, f.pos).setY(0), L = d.length(); if (L > 4.4 * f.scale + 0.4 * t.scale || Math.abs(t.pos.y - f.pos.y) > 1.6 || (L > 0.3 && d.normalize().dot(fw) < 0.55)) continue;
          const r = t.takeHit(f, { dmg: 34, kb: [0, 0], stun: 1.2, hs: 0.08, daze: 18, snd: 'hit' }, fw.clone().negate());
          if (r === 'hit' && !f.hooked && !t.def.stats.armor && t.scale <= 1.3) { f.hooked = t; f.hookR = Math.max(1.2, L); f.hookFw = fw.clone(); sfx('block'); G.fx.burst(t.chest(new V3()), 16, GOLDS, 5); G.say(f, '"넘어와라!"'); } }
      }],
      [0.36, (f, o, G) => { if (f.hooked) { sfx('heavy'); gust(G, f.pos.clone(), 1.2, 16, 1.6); } }],
      [0.66, (f, o, G) => { sfx('swing'); goldSlash(f, { tilt: 0.12, r: 2.6, flip: true }); }],
      [0.9, (f) => wind(f, 0)]],
    hits: [{ t0: 0.64, t1: 0.78, dmg: 60, kb: [6, 3], stun: 0.6, hs: 0.12, shake: 0.18, daze: 30, snd: 'big', br: 0.2 }],
    end: (f) => { f.hooked = null; wind(f, 0); } },

  /* --- Shift: 금빛 깃 질풍 — 상대를 꿰뚫고 지나가며 길에 금빛 깃 칼날을 남기고, 깃 칼날이 일제히 날아올라 꽂힌다. 깃이 가득 차면 되돌아오며 한 번 더 --- */
  s1: { dur: 0.86, cd: 's1', aim: true, track: 0.1, noMove: true, trail: true,
    keys: [[0, 'rush'], [0.12, 'rush'], [0.16, 'slide'], [0.4, 'slide'], [0.56, 'rush'], [0.6, 'slide'], [0.74, {}], [0.86, 'base']],
    start: (f, o, G) => { f.empDash = fth(f) >= 100; if (f.empDash) { f.feather = 0; G.say(f, '"깃이여, 폭풍이 되어라."'); } else G.say(f, '"바람을 타라."'); wind(f, 1); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.13) gust(G, f.pos.clone(), 0.7, 2, 1.2); },
    ev: [[0.14, (f, o, G) => featherDash(f, o, G, 44, f.empDash ? 12 : 7, false)],
      [0.2, (f) => f.faceOpp()],
      [0.58, (f, o, G) => { if (!f.empDash) return; featherDash(f, o, G, 30, 5, true); f.faceOpp(); }],
      [0.7, (f) => wind(f, 0)]],
    end: (f) => { wind(f, 0); f.empDash = false; } },

  /* --- E: 선풍 바퀴 — 장대 끝의 바퀴 칼날을 떼어 던진다. 날아가며 베고, 상대 곁에서 맴돌며 베고, 돌아오며 한 번 더 --- */
  s2: { dur: 0.56, cd: 's2', aim: true, track: 0.14, ikOff: true, trail: true,
    keys: [[0, 'buttPrep'], [0.16, { ...poses.buttPrep, weapon: [0.55, 2.0, 0] }], [0.26, 'buttHit'], [0.4, {}], [0.56, 'base']],
    start: (f, o, G) => { f.model.trailButt = true; G.say(f, '"돌아라, 바람의 바퀴!"'); sfx('charge'); },
    ev: [[0.22, (f, o, G) => {
      sfx('swing'); sfx('zap'); let to;
      if (o && !o.gone && o.state !== 'ko' && f.dist() < 12) to = o.chest(new V3()).addScaledVector(new V3().subVectors(o.pos, f.pos).setY(0).normalize(), 0.4);
      else to = f.local([0, 1.1, 9]);
      const d = new V3().subVectors(to, f.pos).setY(0), L = d.length(); if (L < 3) to = f.local([0, 1.1, 3]); if (L > 11) { to = f.pos.clone().addScaledVector(d.normalize(), 11); to.y = f.pos.y + 1.1; }
      G.spawn(new WheelBoomerang(G, f, to)); G.fx.burst(f.model.wheelPos(new V3()), 14, [TEAL, TEAL2, GOLD], 5);
    }]],
    end: (f) => { f.model.trailButt = false; } },

  /* --- 극한 회피 뒤 좌클: 역풍 — 바람을 타고 상대 옆으로 돌아 들어가 갈고리로 크게 베어 올린다 --- */
  counter: { dur: 0.6, aim: true, trail: true,
    keys: [[0, 'sweepR'], [0.12, 'sweepL'], [0.36, {}], [0.6, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest(new V3()); if (o) { const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(), s = new V3(-d.z, 0, d.x); f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(s, 1.5 + 0.3 * o.scale).addScaledVector(d, -0.4); f.yaw = f.yawTo(o.pos); }
      streak(G, from, f.chest(new V3()), TEAL2, 1); gust(G, f.pos.clone(), 1, 16, 1.6); sfx('dash'); G.flash(GOLD2, 0.18); f.model.resetCloth();
    }], [0.08, (f) => { sfx('heavy'); goldSlash(f, { tilt: 0.3, r: 2.7, life: 0.32, flip: true }); }]],
    hits: [{ t0: 0.06, t1: 0.2, dmg: 92, kb: [6, 3.5], stun: 0.6, hs: 0.14, shake: 0.18, daze: 40, snd: 'big', br: 0.22 }] },

  /* --- Q: 금응 강림 — 하늘 높이 솟구치자 거대한 황금 매의 혼이 날개를 펼치고, 매와 함께 내리꽂힌다 --- */
  ult: { dur: 3.4, ult: true, aim: true, shout: true, ikOff: true,
    keys: [[0, 'crouchUp'], [0.45, 'crouchUp'], [0.6, 'sky'], [1.45, 'sky'], [1.6, 'dive'], [1.98, 'dive'], [2.05, 'cleave'], [2.8, 'cleave'], [3.4, 'base']],
    cam: [[0, { ref: 'self', p: [1.0, 0.7, 2.4], l: [0, 0.9, 0], fov: 40 }], [0.45, { ref: 'self', p: [0.8, 0.5, 2.0], l: [0, 1.0, 0], fov: 38 }],
      [1.0, { ref: 'self', p: [3.5, 1.2, 5.0], l: [0, 0.6, 0], fov: 58 }], [1.5, { ref: 'self', p: [2.4, 2.2, -3.5], l: [0, 0.8, 4], fov: 60 }],
      [1.95, { ref: 'target', p: [3.8, 1.4, 2.6], l: [0, 1.5, -1], fov: 56 }], [2.4, { ref: 'target', p: [3.4, 2.0, 4.0], l: [0, 1.0, -1], fov: 52 }], [3.4, { ref: 'target', p: [2.6, 2.6, 5.6], l: [0, 1.0, -1], fov: 52 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(0x6a3a00, 0.28); wind(f, 1); sfx('charge'); G.say(f, '"날개를 펼쳐라, 황금 매여."'); f.ultY0 = f.pos.y; f.float = true; f.vel.set(0, 0, 0); }],
      [0.5, (f, o, G) => { sfx('dash'); sfx('jump'); G.shake(0.2); gust(G, f.pos.clone(), 1.6, 40, 0.8); G.fx.ring(f.pos.clone().setY(f.pos.y + 0.05), { normal: UP, r0: 0.4, r1: 3.6, life: 0.5, color: GOLD }); G.fx.burst(f.pos.clone().setY(0.1), 24, 0x8a7a60, 5, { kind: 'dust' }); }],
      [0.62, (f, o, G) => { const fal = new FalconSpirit(G, f); f.ultFalcon = fal; G.spawn(fal); sfx('ult'); G.flash(GOLD2, 0.25); }],
      [0.95, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('zap'); G.say(f, '"…끼이이익!"'); gust(G, o.pos.clone(), 1.4, 40, 2.6);
        o.takeHit(f, { dmg: 45, kb: [0, 0], stun: 99, hs: 0.06, nokill: true, noScale: true, force: true, noCrit: true, daze: 30, snd: 'hit' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); }],
      [1.98, (f, o, G) => { o = f.ultTgt || o; f.float = false; f.vel.set(0, 0, 0); if (f.ultFalcon) f.ultFalcon.dying = true; if (!o) return;
        o.release(); sfx('boom'); sfx('big'); sfx('heavy'); G.flash(0xfff4c0, 0.55); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.45);
        const c = o.pos.clone().setY(Math.max(0, o.pos.y)); G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.5, r1: 7.5, life: 0.7, color: GOLD }); G.fx.ring(c.clone().setY(c.y + 0.1), { normal: UP, r0: 0.3, r1: 4.5, life: 0.5, color: 0xffffff });
        G.fx.beam(c, { r: 1.8, h: 16, color: GOLD, life: 0.7 }); G.fx.light(c.clone().setY(1.5), GOLD, 200, 0.9, 24); G.fx.impact(o.chest(new V3()), GOLD, 2.6); plumes(G, c.clone().setY(c.y + 0.6), 60, 9); gust(G, c, 3, 40, 2);
        G.fx.burst(c, 30, 0x8a7a60, 7, { kind: 'dust', sk: 1.6 });
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, d = new V3(Math.cos(a), 0, Math.sin(a)); G.fx.slash(c.clone().addScaledVector(d, 1.6).setY(c.y + 0.2), { fwd: d, normal: UP, r: 1.6, color: i % 2 ? GOLD : ORANGE, life: 0.45 }); }
        o.takeHit(f, { dmg: 230, kb: [5, 12], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(c) < 6) t.takeHit(f, { dmg: 120, kb: [6, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
        G.say(f, '"금응(金鷹) 강림."'); G.slow(0.35, 0.5); }],
      [2.9, (f) => wind(f, 0)],
    ],
    tick: (f, o, G, t, dt) => {
      const tg = f.ultTgt, fal = f.ultFalcon;
      if (t < 0.5) { gust(G, f.pos.clone(), 1.2 - t, 3, 1.4); if (tg) f.faceOpp(10, dt); }
      // 솟구침: 0.5 → 1.0 초에 7m 위로, 1.45 초까지 머문다
      if (t >= 0.5 && t < 1.6) { const k = Math.min(1, (t - 0.5) / 0.5), e = 1 - (1 - k) ** 3; f.pos.y = f.ultY0 + 7.2 * e * f.scale + (t > 1.0 ? Math.sin((t - 1) * 6) * 0.08 : 0); f.vel.set(0, 0, 0); f.onGround = false;
        if (tg && !tg.gone) { const d = new V3().subVectors(tg.pos, f.pos).setY(0); f.yaw = Math.atan2(d.x, d.z); }
        if (fal && !fal.dying) { const back = f.fwd(new V3()).multiplyScalar(-0.6), p = f.pos.clone().add(new V3(0, 1.0 + 0.4 * (1 - k), 0)).add(back); fal.place(p, p.clone().add(f.fwd(new V3())).add(new V3(0, 0.25, 0)), t > 1.0 ? 0.5 : 1, dt); } }
      // 강하: 1.6 → 1.98 초, 상대 바로 앞까지 내리꽂힌다
      if (t >= 1.6 && t < 1.98) {
        if (!f.diveFrom) { f.diveFrom = f.pos.clone(); sfx('dash'); sfx('swing'); }
        const k = Math.min(1, (t - 1.6) / 0.38), e = k * k, to = tg && !tg.gone ? tg.pos.clone().addScaledVector(new V3().subVectors(f.diveFrom, tg.pos).setY(0).normalize(), 1.2 * tg.scale).setY(Math.max(0, tg.pos.y)) : f.diveFrom.clone().setY(f.ultY0).addScaledVector(f.fwd(new V3()), 5);
        const p = f.diveFrom.clone().lerp(to, e); f.pos.copy(p); f.vel.set(0, 0, 0); f.onGround = false;
        G.fx.p(f.chest(new V3()), { size: 1.0, size1: 0.2, life: 0.25, color: ORANGE, alpha: 0.5 });
        if (fal && !fal.dying) { const lead = new V3().subVectors(to, f.diveFrom).normalize(), fp = f.pos.clone().addScaledVector(lead, 1.2).add(new V3(0, 0.6, 0)); fal.place(fp, fp.clone().add(lead), 0.1, dt); }
      }
      if (t >= 1.98 && f.diveFrom) { f.diveFrom = null; f.pos.y = Math.max(f.pos.y, 0); }
    },
    end: (f, o, G) => { G.setTint(0, 0); wind(f, 0); f.float = false; f.diveFrom = null; const tg = f.ultTgt; if (tg && tg.held) tg.release(); if (f.ultFalcon) f.ultFalcon.dying = true; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, GOLD, big ? 1.7 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? ORANGE : GOLD, life: 0.2 });
  plumes(G, p, big ? 10 : 4, 4);
  // 깃: 맞힐 때마다 모인다 (가득 차면 다음 깃 질풍이 왕복 · 깃 칼날 12개)
  addFeather(att, h.dmg * 0.35);
}

// 깃 게이지 · 기술 상태 → 깃털 빛 · 궤적 색
function createModelWithFeather(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (fth(f) >= 100 && f.root.visible && Math.random() < 0.3) { const p = m.tipPos(new V3()); f.G.fx.p(p, { vel: [0, 0.6, 0], size: 0.1, size1: 0.02, life: 0.4, color: GOLD2, alpha: 0.9, drag: 1 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(m.trailButt ? TEAL : f.palette.accent);
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist < 3.8 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist > 3 && dist < 9 && f.cd.s1 <= 0 && Math.random() < (fth(f) >= 100 ? 0.6 : 0.3)) return 's1';
  if (dist > 4 && dist < 11 && f.cd.s2 <= 0 && !f.wheelOut && Math.random() < 0.3) return 's2';
  return null;
}
function onReset(f) { f.feather = 0; f.windK = 0; f.wheelOut = false; f.wheelEnt = null; f.float = false; f.hooked = null; f.empDash = false; f.ultTgt = null; f.ultFalcon = null; f.diveFrom = null; if (f.model) f.model.trailButt = false; }

export default {
  id: 'asura', name: '아수라', short: '아수라', title: '황금 매의 순례자', scale: 1.0,
  desc: '근·중거리 · 장병기 회전술 · 바람. 금빛 매의 깃을 두른 젊은 순례자. 위 끝엔 초승달 갈고리, 아래 끝엔 바퀴 칼날이 달린 황금 장대를 바람개비처럼 돌린다. 갈고리로 걸어 등 뒤로 넘기고, 금빛 깃을 흩뿌리며 꿰뚫고 지나가고, 바퀴 칼날을 부메랑처럼 던진다. 맞힐수록 깃이 모이고, 가득 차면 깃 질풍이 왕복한다.',
  stats: { hp: 960, speed: 8.0, jump: 11.5, crit: 0.25 },
  palettes: [{ accent: GOLD, teal: TEAL, band: '#2a1a04' }, { accent: 0x7ab0ff, teal: 0xff6a9a, band: '#0a1a2a' }],
  skills: { heavy: { name: '갈고리 넘기기', cd: 8 }, s1: { name: '금빛 깃 질풍', cd: 9 }, s2: { name: '선풍 바퀴', cd: 11 }, ult: { name: '금응 강림', sub: 'GOLDEN FALCON' } },
  aiPick, aimRange: 11, onReset,
  resource: (f) => fth(f) >= 100 ? { v: 1, label: '깃', color: 0xfff0a8, full: true } : { v: fth(f) / 100, label: '깃', color: 0xe8a030 },
  moveList: [['좌클 ×4', '갈고리 가로 베기 40 → 바퀴 끝 치기 42 → 장대를 뻗고 두 바퀴 회전 16×3 → 도약해 초승달 내려찍기 36 + 충격 18'], ['공중 좌클', '갈고리를 아래로 세워 내리꽂아 깃 폭풍'],
    ['우클 · 갈고리 넘기기', '갈고리를 4.4m 내질러 걸면 34 → 내 곁을 지나 등 뒤로 끌어 넘기고 돌아서며 베기 60'], ['Shift · 금빛 깃 질풍', '상대를 꿰뚫고 지나가며 44 → 지나간 자리의 깃 칼날 7개가 날아올라 꽂힘 8씩. 깃이 가득 차면 되돌아오며 30 + 깃 칼날 12 · 5개'],
    ['E · 선풍 바퀴', '바퀴 칼날을 떼어 던짐: 날아가며 42 → 상대 곁에서 맴돌며 10×4 → 돌아오며 38'], ['Q · 금응 강림', '하늘 높이 솟구치면 거대한 황금 매의 혼이 날개를 펼치고 (바람 45) → 매와 함께 내리꽂힘 230'],
    ['깃', '맞힐수록 모이고 가득 차면 다음 금빛 깃 질풍이 왕복'], ['C (타이밍) · 극한 회피', '역풍: 바람을 타고 상대 옆으로 돌아 들어가 갈고리로 베어 올림 92'], ['가만히', '장대를 어깨에 걸치고 한 손은 허리에']],
  createModel: createModelWithFeather, poses, moves, hitFx,
};
