// 스이 (SUI · 翠) — 근거리 · 발도술 · 고속 이동
// 비취 검을 쓰는 떠돌이 검객. 칼을 칼집에 대었다가 한순간에 뽑아 베는 발도술(일섬)로 적을 꿰뚫고 지나간다.
// 무기: 비취 칼날 카타나 — 베면 녹색 검기가 남고, 검기가 가득 차면 일섬이 삼연격이 된다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, JADE, JADE2, DEEPJ, CRIM, GOLDJ } from './sui_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const GREENS = [JADE, JADE2, 0xffffff];

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const poses = {
  // 기본: 칼을 오른손에 낮게 내려 들고, 왼손은 허리 칼집에 — 고요한 자세
  base: { hips: [0, 0.1, 0], spine: [0.04, -0.05, 0], chest: [0.02, -0.06, 0], head: [0.05, 0.06, 0],
    shoulderR: [-0.3, 0, -0.14], elbowR: [-0.7, 0, 0], weapon: [-0.5, 0.35, 0], shoulderL: [0.12, 0, 0.14], elbowL: [-1.05, 0, 0],
    hipL: [-0.12, 0, 0.06], kneeL: [0.2, 0, 0], footL: [-0.08, 0, 0], hipR: [0.1, 0, -0.06], kneeR: [0.12, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.1, 0], spine: [0.38, 0.05, 0], chest: [0.08, 0.05, 0], head: [-0.25, 0, 0], shoulderR: [0.5, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [-0.2, 2.7, 0.3], shoulderL: [0.2, 0, 0.15], elbowL: [-1.1, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.4, 0, 0], shoulderL: [-0.6, 0, 0.7], elbowL: [-0.6, 0, 0], weapon: [0.2, 2.4, 0.3] },
  // 방어: 칼을 세워 칼등에 왼손을 댄다
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.1, 0], chest: [0.05, 0.1, 0], shoulderR: [-1.05, 0, -0.1], elbowR: [-1.35, 0, 0], weapon: [0.15, -1.45, -1.2], shoulderL: [-1.2, 0, 0.1], elbowL: [-1.0, 0, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.5, 1.6, 0.4], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.4, 1.4, 0.6], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.72, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -0.8, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.6, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.7, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [-0.1, 2.8, 0.3], shoulderL: [0.6, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 칼을 천천히 칼집에 넣는 자세
  win: { hips: [0, 0.2, 0], spine: [0.05, 0.25, 0], chest: [0.02, 0.2, 0], head: [0.1, -0.35, 0], shoulderR: [-0.75, 0, 0.6], elbowR: [-1.45, 0, 0], weapon: [0.25, -2.55, 0], shoulderL: [0.1, 0, 0.2], elbowL: [-1.3, 0, 0],
    hipL: [-0.1, 0, 0.06], kneeL: [0.15, 0, 0], hipR: [0.1, 0, -0.06], kneeR: [0.1, 0, 0] },
  portrait: { hips: [0, 0.3, 0], chest: [0, -0.2, 0], head: [0.04, 0.1, 0], shoulderR: [-1.25, 0, -0.3], elbowR: [-1.5, 0, 0], weapon: [1.3, 0.25, 0], shoulderL: [-0.2, 0, 0.2], elbowL: [-1.2, 0, 0] },
  // 오른쪽으로 감은 칼 → 왼쪽으로 가로 베기
  windR: { hips: [0, -0.45, 0], spine: [0.1, -0.35, 0], chest: [0.02, -0.4, 0], head: [0, 0.6, 0], shoulderR: [-1.0, 0, -0.75], elbowR: [-0.9, 0, 0], weapon: [0.1, 1.9, 1.57], shoulderL: [-0.4, 0, 0.3], elbowL: [-1.2, 0, 0] },
  slashL: { hips: [0, 0.45, 0], spine: [0.2, 0.4, 0], chest: [0.05, 0.45, 0], head: [0, -0.6, 0], shoulderR: [-1.3, 0, 0.45], elbowR: [-0.15, 0, 0], weapon: [0.05, -1.55, 1.57], shoulderL: [0.3, 0, 0.6], elbowL: [-0.5, 0, 0],
    hipL: [-0.75, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.45, 0, -0.12], kneeR: [0.35, 0, 0] },
  // 왼쪽 아래 → 오른쪽 위 올려베기
  windLow: { hips: [0, 0.5, 0], spine: [0.35, 0.35, 0], chest: [0.1, 0.4, 0], head: [-0.2, -0.6, 0], shoulderR: [-0.5, 0, 0.55], elbowR: [-0.5, 0, 0], weapon: [-0.75, -1.3, 0.9],
    hipL: [-0.8, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.5, 0, -0.15], kneeR: [0.6, 0, 0] },
  slashUp: { hips: [0, -0.4, 0], spine: [-0.15, -0.35, 0], chest: [-0.1, -0.4, 0], head: [-0.2, 0.5, 0], shoulderR: [-2.6, 0, -0.55], elbowR: [-0.25, 0, 0], weapon: [1.05, 1.0, 0.9], shoulderL: [-0.2, 0, 0.6], elbowL: [-0.8, 0, 0] },
  // 수평으로 칼을 뻗은 회전 자세
  spin: { hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.05, 0, 0], shoulderR: [-1.4, 0, -1.1], elbowR: [-0.1, 0, 0], weapon: [0.0, 1.55, 1.57], shoulderL: [-0.5, 0, 1.2], elbowL: [-0.3, 0, 0],
    hipL: [-0.6, 0, 0.2], kneeL: [0.9, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.7, 0, 0] },
  thrustBack: { hips: [0, -0.5, 0], spine: [0.15, -0.4, 0], chest: [0.05, -0.4, 0], head: [0, 0.75, 0], shoulderR: [-0.4, 0, -0.35], elbowR: [-1.9, 0, 0], weapon: [0.05, 0.05, 1.57], shoulderL: [-1.3, 0, 0.25], elbowL: [-0.2, 0, 0],
    hipL: [-0.7, 0, 0.2], kneeL: [1.1, 0, 0], hipR: [0.5, 0, -0.2], kneeR: [0.8, 0, 0] },
  thrust: { hips: [0, 0.35, 0], spine: [0.45, 0.3, 0], chest: [0.1, 0.3, 0], head: [-0.4, -0.5, 0], shoulderR: [-1.6, 0, -0.05], elbowR: [-0.05, 0, 0], weapon: [0.0, -0.05, 1.57], shoulderL: [0.4, 0, 0.5], elbowL: [-0.6, 0, 0],
    hipL: [-1.15, 0, 0.12], kneeL: [1.1, 0, 0], hipR: [0.8, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 발도 자세: 몸을 낮추고 칼을 왼허리 칼집 쪽으로 (칼끝은 뒤로)
  iaiPrep: { hipY: -0.08, hips: [0, 0.55, 0], spine: [0.35, 0.3, 0], chest: [0.1, 0.3, 0], head: [-0.25, -0.75, 0], shoulderR: [-0.75, 0, 0.6], elbowR: [-1.45, 0, 0], weapon: [0.1, -2.6, 0], shoulderL: [-0.25, 0, 0.25], elbowL: [-1.4, 0, 0],
    hipL: [-1.0, 0, 0.25], kneeL: [1.3, 0, 0], footL: [-0.3, 0, 0], hipR: [0.55, 0, -0.25], kneeR: [1.0, 0, 0] },
  // 베고 난 뒤: 오른팔을 옆으로 뻗고 칼끝은 오른쪽 뒤로
  iaiCut: { hipY: -0.06, hips: [0, -0.35, 0], spine: [0.3, -0.25, 0], chest: [0.05, -0.3, 0], head: [-0.2, 0.5, 0], shoulderR: [-1.25, 0, -1.15], elbowR: [-0.08, 0, 0], weapon: [0.05, 2.0, 1.57], shoulderL: [0.35, 0, 0.45], elbowL: [-0.9, 0, 0],
    hipL: [-1.2, 0, 0.2], kneeL: [1.3, 0, 0], hipR: [0.75, 0, -0.2], kneeR: [0.45, 0, 0] },
  raise: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.95, 0, -0.15], elbowR: [-0.35, 0, 0], weapon: [2.2, 0, 1.57], shoulderL: [-2.7, 0, 0.2], elbowL: [-0.5, 0, 0], hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  slam: { hips: [0, -0.15, 0], spine: [0.7, 0, 0], chest: [0.2, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.0, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-1.25, 0, 1.57], shoulderL: [-0.9, 0, 0.1], elbowL: [-0.2, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.4, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 눈을 감듯 고개를 숙이고 칼을 칼집에 대고 기다린다
  idle2: { hips: [0, 0.3, 0], spine: [0.1, 0.2, 0], chest: [0.04, 0.2, 0], head: [0.3, -0.25, 0], shoulderR: [-0.7, 0, 0.55], elbowR: [-1.45, 0, 0], weapon: [0.2, -2.6, 0], shoulderL: [0.05, 0, 0.2], elbowL: [-1.25, 0, 0],
    hipL: [-0.15, 0, 0.1], kneeL: [0.25, 0, 0], hipR: [0.2, 0, -0.08], kneeR: [0.15, 0, 0] },
});

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const ki = (f) => (f.ki || 0);
const blade = (f, k) => { f.bladeK = k; };
const jadeSlash = (f, o) => f.slashFx({ r: o.r || 2, color: o.color ?? JADE, life: o.life ?? 0.24, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
function leaves(G, p, n = 10, sp = 4) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.06, 0.12), size1: 0.02, life: rand(0.4, 0.8), color: i % 3 ? JADE : JADE2, alpha: 0.9, drag: 2, grav: 2, flick: 0.4 }); }
// 직선 검기: a → b 를 따라 녹색 섬광 + 잔상
function slashLine(G, a, b, color = JADE, w = 1) {
  const d = new V3().subVectors(b, a), L = d.length(); d.normalize(); const n = Math.max(3, Math.round(L / 0.5));
  for (let i = 0; i <= n; i++) { const p = a.clone().addScaledVector(d, (i / n) * L); G.fx.p(p, { size: 0.5 * w, size1: 0.05, life: 0.3, color: i % 2 ? color : 0xffffff, alpha: 0.85, drag: 0 }); }
  const mid = a.clone().add(b).multiplyScalar(0.5); G.fx.slash(mid, { fwd: d, normal: new V3().crossVectors(d, UP).normalize().add(UP).normalize(), r: L * 0.55, color, life: 0.3 });
}
// 일섬: 앞으로 순식간에 꿰뚫고 지나간다 (가는 길의 적 모두 피해) → 잠시 뒤 베인 자리에서 검기가 터진다
function iaiFlash(f, o, G, dmg, burst) {
  const fw = f.fwd(new V3()), from = f.pos.clone(); let len = 6.2;
  if (o && !o.gone && o.state !== 'ko') { const to = new V3().subVectors(o.pos, f.pos).setY(0), d = to.length(); if (d < 8 && to.normalize().dot(fw) > 0.5) len = d + 1.5 * o.scale; }
  const dest = from.clone().addScaledVector(fw, len), W = G.stage && G.stage.world;
  if (W) for (let k = 1; k <= 12; k++) { const p = from.clone().addScaledVector(fw, (k / 12) * len).setY(from.y + 0.6); if (W.solidAt(p, 0.3)) { dest.copy(from).addScaledVector(fw, Math.max(0, (k - 1) / 12 * len)); break; } }
  f.pos.x = dest.x; f.pos.z = dest.z; f.vel.set(0, 0, 0); f.model.resetCloth();
  const a = from.clone().setY(from.y + 1.0), b = dest.clone().setY(dest.y + 1.0); slashLine(G, a, b, JADE, 1.2);
  for (let i = 0; i < 6; i++) G.fx.p(a.clone().lerp(b, i / 6), { size: 1.2, size1: 0.3, life: 0.25, color: DEEPJ, alpha: 0.5 }); // 잔상
  sfx('dash'); sfx('swing'); G.flash(JADE2, 0.12);
  const hit = [];
  for (const t of f.foes()) { if (!t.hurtHitSeg(a.clone().setY(from.y + 0.4), b.clone().setY(dest.y + 0.4), 0.45) && !t.hurtHitSeg(a, b, 0.45)) continue; const r = t.takeHit(f, { dmg, kb: [0.5, 0], stun: 0.8, hs: 0.1, daze: 30, snd: 'big' }, fw); if (r === 'hit') hit.push(t); }
  if (burst) G.spawn({ t: 0, done: false, update(dt) { this.t += dt; if (this.t < 0.32) return; this.done = true; sfx('boom'); G.shake(0.2); slashLine(G, a, b, JADE2, 1.6);
    for (const t of hit) if (!t.gone && t.state !== 'ko') { const p = t.chest(new V3()); G.fx.impact(p, JADE, 1.6); leaves(G, p, 16, 5); t.takeHit(f, { dmg: burst, kb: [3, 4], stun: 0.6, hs: 0.12, force: true, noScale: true, daze: 25, snd: 'big' }, fw); } } });
  return hit.length;
}

/* ---------- 비취 회선: 몸 주위를 도는 비취 칼날들 (닿는 적에게 연속 피해) ---------- */
let _orbGeo = null;
class BladeOrbit {
  constructor(G, f) {
    this.G = G; this.f = f; this.t = 0; this.life = 5; this.done = false; this.tick = 0; f.orbitT = this.life;
    if (!_orbGeo) { const sh = new THREE.Shape(); sh.moveTo(0, -0.05); sh.quadraticCurveTo(0.04, 0.1, 0, 0.42); sh.quadraticCurveTo(-0.015, 0.1, -0.012, -0.05); sh.closePath(); _orbGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }); }
    this.mat = new THREE.MeshBasicMaterial({ color: JADE, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.g = new THREE.Group(); G.scene.add(this.g); this.blades = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(_orbGeo, this.mat); m.frustumCulled = false; this.g.add(m); this.blades.push(m); }
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt; f.orbitT = Math.max(0, this.life - this.t);
    if (this.t > this.life || f.state === 'ko' || f.gone) return this.kill();
    const c = f.chest(new V3()), k = Math.min(1, this.t / 0.3) * Math.min(1, (this.life - this.t) / 0.3 + 0.1), R = 1.15 * f.scale;
    this.mat.opacity = 0.85 * k;
    this.blades.forEach((m, i) => { const a = this.t * 7 + (i / 6) * TAU, y = c.y - 0.3 + 0.25 * Math.sin(this.t * 3 + i), p = new V3(c.x + Math.cos(a) * R, y, c.z + Math.sin(a) * R);
      m.position.copy(p); m.lookAt(p.clone().add(new V3(-Math.sin(a), 0, Math.cos(a)))); m.rotateX(Math.PI / 2); m.scale.setScalar(f.scale * 1.7);
      if (Math.random() < 0.5) G.fx.p(p, { vel: [0, 0.4, 0], size: 0.12, size1: 0.02, life: 0.25, color: i % 2 ? JADE : JADE2, alpha: 0.8, drag: 1 }); });
    if (this.tick <= 0) { this.tick = 0.25;
      for (const t of f.foes()) { const d = Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z); if (d > R + 0.45 * t.scale || Math.abs(t.pos.y - f.pos.y) > 1.6) continue; t.takeHit(f, { dmg: 9, kb: [1.2, 0], stun: 0.28, daze: 6, hs: 0.02, noCrit: true }, new V3().subVectors(t.pos, f.pos).setY(0).normalize()); sfx('swing'); } }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.mat.dispose(); this.f.orbitT = 0; }
}

/* =====================================================================
   기술 — 발도술 검객: 빠른 베기 · 꿰뚫고 지나가는 일섬 · 질풍 연참 · 회전하는 비취 칼날
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 칼을 거꾸로 쥐고 내리꽂아 비취 검기 폭발 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.3, 0, 0], head: [0.2, 0, 0], shoulderR: [-1.6, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.4, 0, 1.57], shoulderL: [-1.5, 0, 0.1], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: JADE, dmg: 70, r: 2.4,
    fx: (f, o, G, c) => { leaves(G, c.clone().setY(c.y + 0.3), 24, 6); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, d = new V3(Math.cos(a), 0, Math.sin(a)); slashLine(G, c.clone().setY(c.y + 0.1), c.clone().addScaledVector(d, 2.4).setY(c.y + 0.1), JADE, 0.7); } },
  }),

  /* --- 기본 공격: 가로 베기 → 올려베기 → 회전 베기(2타) → 꿰뚫는 찌르기 돌진 --- */
  light1: { dur: 0.4, cancel: 0.19, next: 'light2', trail: true, track: 0.08, ikOff: true,
    keys: [[0, 'windR'], [0.1, 'slashL'], [0.22, {}], [0.4, 'base']], lunge: [[0.03, 0.13, 7]],
    ev: [[0.06, () => sfx('swing')], [0.09, (f) => jadeSlash(f, { tilt: 0.1, r: 1.9 })]],
    hits: [{ t0: 0.05, t1: 0.15, dmg: 34, kb: [2.2, 0], stun: 0.36, daze: 11 }] },
  light2: { dur: 0.42, cancel: 0.21, next: 'light3', trail: true, track: 0.08, ikOff: true,
    keys: [[0, 'windLow'], [0.1, 'slashUp'], [0.24, {}], [0.42, 'base']], lunge: [[0.03, 0.13, 6.5]],
    ev: [[0.06, () => sfx('swing')], [0.09, (f) => jadeSlash(f, { tilt: -0.9, r: 2, flip: true })]],
    hits: [{ t0: 0.05, t1: 0.16, dmg: 36, kb: [2, 1.5], stun: 0.42, daze: 12 }] },
  light3: { dur: 0.52, cancel: 0.3, next: 'light4', trail: true, track: 0.06, ikOff: true,
    keys: [[0, 'spin'], [0.4, 'spin'], [0.52, 'base']], lunge: [[0.04, 0.3, 4]],
    tick: (f, o, G, t, dt) => { if (t > 0.06 && t < 0.38) f.yaw += dt * TAU / 0.32 * 1.0; if (t >= 0.38 && t < 0.4) f.faceOpp(); },
    ev: [[0.06, () => sfx('swing')], [0.2, () => sfx('swing')], [0.12, (f, o, G) => { G.fx.ring(f.local([0, 1.0, 0]), { normal: UP, r0: 0.5, r1: 1.9, life: 0.3, color: JADE }); leaves(G, f.chest(new V3()), 8, 4); }]],
    hits: [{ t0: 0.06, t1: 0.22, dmg: 24, kb: [1.6, 0], stun: 0.4, daze: 9 }, { t0: 0.22, t1: 0.38, dmg: 26, kb: [2.4, 0], stun: 0.45, daze: 9 }] },
  light4: { dur: 0.62, trail: true, track: 0.14, ikOff: true,
    keys: [[0, 'thrustBack'], [0.16, 'thrust'], [0.42, {}], [0.62, 'base']], lunge: [[0.15, 0.3, 19]],
    start: () => sfx('charge'),
    ev: [[0.15, () => sfx('dash')], [0.2, (f, o, G) => { sfx('heavy'); const a = f.local([0, 1.1, 0.2]), b = f.local([0, 1.1, 2.4]); slashLine(G, a, b, JADE2, 0.8); }]],
    hits: [{ t0: 0.15, t1: 0.32, weapon: false, at: [0, 1.05, 0.9], r: 0.6, dmg: 58, kb: [7, 2.5], stun: 0.7, hs: 0.12, shake: 0.2, daze: 26, snd: 'big' }] },

  /* --- 우클: 일섬 — 칼을 칼집에 대었다가 한순간에 꿰뚫고 지나가며 벤다. 검기가 가득 차면 삼연격 --- */
  heavy: { dur: 0.95, cd: 'heavy', ikOff: true, track: 0.32, aim: true, shout: true, noMove: true,
    keys: [[0, 'iaiPrep'], [0.32, 'iaiPrep'], [0.36, 'iaiCut'], [0.72, {}], [0.95, 'base']],
    start: (f, o, G) => { f.empIai = ki(f) >= 100; if (f.empIai) { f.ki = 0; G.say(f, '"…삼연(三連)."'); } blade(f, 1); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.32) { const p = f.model.J.handR.getWorldPosition(new V3()); G.fx.p(p.clone().add(new V3(rand(-0.4, 0.4), rand(-0.2, 0.5), rand(-0.4, 0.4))), { vel: [0, 0.5, 0], size: 0.1, size1: 0.02, life: 0.3, color: JADE, alpha: 0.9 }); } },
    ev: [[0.34, (f, o, G) => { iaiFlash(f, o, G, 66, 34); }],
      [0.52, (f, o, G) => { if (!f.empIai) return; f.faceOpp(); iaiFlash(f, o, G, 40, 20); }],
      [0.68, (f, o, G) => { if (!f.empIai) return; f.faceOpp(); iaiFlash(f, o, G, 40, 30); }],
      [0.8, (f) => blade(f, 0)]],
    end: (f) => { blade(f, 0); f.empIai = false; } },

  /* --- Shift: 녹풍 연참 — 상대 주위를 지그재그로 세 번 파고들며 벤다 --- */
  s1: { dur: 1.02, cd: 's1', ikOff: true, trail: true, aim: true, noMove: true,
    keys: [[0, 'windR'], [0.12, 'slashL'], [0.3, 'windLow'], [0.42, 'slashUp'], [0.6, 'windR'], [0.72, 'slashL'], [0.86, {}], [1.02, 'base']],
    start: (f, o, G) => { G.say(f, '"바람처럼."'); blade(f, 1); },
    tick: (f, o, G, t, dt) => {
      for (const [t0, side] of [[0.04, 1], [0.32, -1], [0.62, 1]]) if (t >= t0 && t < t0 + 0.14) {
        let dir = f.fwd(new V3()); if (o && !o.gone && f.dist() < 12) { const to = new V3().subVectors(o.pos, f.pos).setY(0), d = to.length(); to.normalize(); const sideV = new V3(to.z, 0, -to.x).multiplyScalar(side * 0.55); dir = to.add(sideV).normalize(); f.yaw = Math.atan2(dir.x, dir.z); }
        const sp = o && !o.gone ? Math.min(24, Math.max(6, (f.dist() + 1.2) / 0.14)) : 16; f.vel.x = dir.x * sp; f.vel.z = dir.z * sp;
        G.fx.p(f.chest(new V3()), { size: 1.1, size1: 0.3, life: 0.2, color: DEEPJ, alpha: 0.5 });
      } else if ([0.18, 0.46, 0.76].some((x) => t >= x && t < x + 0.04)) { f.vel.x *= 0.2; f.vel.z *= 0.2; f.faceOpp(); }
    },
    ev: [[0.1, (f) => { sfx('swing'); jadeSlash(f, { tilt: 0.2 }); }], [0.4, (f) => { sfx('swing'); jadeSlash(f, { tilt: -0.9, flip: true }); }], [0.7, (f) => { sfx('heavy'); jadeSlash(f, { tilt: 0.25, r: 2.4 }); }], [0.9, (f) => blade(f, 0)]],
    hits: [{ t0: 0.06, t1: 0.2, weapon: false, at: [0, 1.0, 0.8], r: 0.8, dmg: 30, kb: [1.5, 0], stun: 0.55, daze: 12 }, { t0: 0.34, t1: 0.48, weapon: false, at: [0, 1.0, 0.8], r: 0.8, dmg: 30, kb: [1.5, 0], stun: 0.55, daze: 12 },
      { t0: 0.64, t1: 0.8, weapon: false, at: [0, 1.0, 0.8], r: 0.85, dmg: 44, kb: [5.5, 2], stun: 0.6, hs: 0.1, daze: 18, snd: 'big' }],
    end: (f) => blade(f, 0) },

  /* --- E: 비취 회선 — 몸 주위를 도는 비취 칼날 여섯 자루 (5초 · 닿으면 연속 피해 · 이동 속도 ↑) --- */
  s2: { dur: 0.55, cd: 's2', ikOff: true, aim: false, shout: true,
    keys: [[0, { ...poses.raise, weapon: [1.5, 0, 1.57] }], [0.2, { ...poses.spin, spine: [0, 0, 0] }], [0.4, {}], [0.55, 'base']],
    start: (f, o, G) => { G.say(f, '"흩날려라, 비취."'); sfx('charge'); blade(f, 1); },
    ev: [[0.2, (f, o, G) => { sfx('zap'); G.spawn(new BladeOrbit(G, f)); G.fx.ring(f.local([0, 1.0, 0]), { normal: UP, r0: 0.3, r1: 2.2, life: 0.4, color: JADE }); leaves(G, f.chest(new V3()), 20, 5); }], [0.5, (f) => blade(f, 0)]],
    end: (f) => blade(f, 0) },

  /* --- 극한 회피 뒤 좌클: 그림자 발도 — 상대 등 뒤로 순간이동해 벤다 --- */
  counter: { dur: 0.6, aim: true, ikOff: true, trail: true,
    keys: [[0, 'iaiPrep'], [0.08, 'iaiCut'], [0.4, {}], [0.6, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest(); if (o) { const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(d, 1.3 + 0.3 * o.scale); f.yaw = Math.atan2(-d.x, -d.z); }
      slashLine(G, from, f.chest(), JADE2, 1); sfx('dash'); G.flash(JADE, 0.2); f.model.resetCloth();
    }], [0.08, (f) => { sfx('heavy'); jadeSlash(f, { tilt: 0.15, r: 2.6, life: 0.32 }); }]],
    hits: [{ t0: 0.06, t1: 0.2, dmg: 92, kb: [6, 3], stun: 0.6, hs: 0.14, shake: 0.18, daze: 40, snd: 'big', br: 0.22 }] },

  /* --- Q: 천검 · 비취우 — 모습을 감추고 수십 번 베어낸 뒤, 등 뒤에서 칼을 거두는 순간 모든 검기가 터진다 --- */
  ult: { dur: 3.3, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, 'iaiPrep'], [0.62, 'iaiPrep'], [0.68, 'iaiCut'], [1.9, 'iaiCut'], [2.0, { ...poses.win, head: [0.25, -0.2, 0] }], [2.75, 'win'], [3.3, 'base']],
    cam: [[0, { ref: 'self', p: [0.9, 0.7, 2.2], l: [0, 1.0, 0], fov: 38 }], [0.6, { ref: 'self', p: [0.5, 0.9, 1.4], l: [0, 1.1, 0], fov: 32 }],
      [0.72, { ref: 'target', p: [3.8, 1.6, -3], l: [0, 1.3, 0], fov: 58 }], [1.9, { ref: 'target', p: [-3.5, 1.2, -3.5], l: [0, 1.4, 0], fov: 56 }],
      [2.1, { ref: 'target', p: [1.2, 1.3, 2.6], l: [0, 1.25, -0.6], fov: 44 }], [3.3, { ref: 'target', p: [2.2, 1.8, 4.2], l: [0, 1.2, -0.6], fov: 50 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(DEEPJ, 0.32); blade(f, 1); sfx('charge'); G.say(f, '"…베어지는 것조차, 모르게."'); leaves(G, f.chest(new V3()), 20, 3); }],
      [0.66, (f, o, G) => { o = f.ultTgt || o; sfx('dash'); G.flash(0xffffff, 0.3); leaves(G, f.chest(new V3()), 30, 7); f.root.visible = false; f.vanish = true; f.ultCuts = 0; }],
      [1.95, (f, o, G) => { o = f.ultTgt || o; if (!o) return; const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(0).addScaledVector(d, 1.8); f.yaw = Math.atan2(d.x, d.z); f.root.visible = true; f.vanish = false; f.model.resetCloth(); sfx('dash'); leaves(G, f.chest(new V3()), 20, 4); }],
      [2.75, (f, o, G) => { o = f.ultTgt || o; if (!o) return; o.release(); sfx('block'); sfx('boom'); sfx('big'); G.say(f, '"…찰칵."'); G.flash(0xeaffef, 0.55); G.shake(0.5); G.stage.flashSky && G.stage.flashSky(0.4);
        const c = o.chest(new V3()); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI, d = new V3(Math.cos(a), Math.sin(a) * 0.8, Math.sin(a) * 0.3).normalize(); slashLine(G, c.clone().addScaledVector(d, -2.4), c.clone().addScaledVector(d, 2.4), i % 2 ? JADE : JADE2, 1.4); }
        G.fx.impact(c, JADE, 2.6); leaves(G, c, 50, 9); G.fx.light(c, JADE, 180, 0.8, 20); G.fx.ring(o.pos.clone().setY(0.05), { normal: UP, r0: 0.5, r1: 7, life: 0.6, color: JADE });
        o.takeHit(f, { dmg: 190, kb: [5, 11], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize().negate());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) t.takeHit(f, { dmg: 110, kb: [6, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, o.pos).setY(0).normalize());
        G.slow(0.35, 0.5); }],
    ],
    tick: (f, o, G, t, dt) => {
      if (t < 0.62) { const c = f.chest(new V3()); for (let i = 0; i < 2; i++) { const a = rand(0, TAU), R = rand(1.2, 2.6), p = c.clone().add(new V3(Math.cos(a) * R, rand(-0.8, 1), Math.sin(a) * R)), v = c.clone().sub(p).multiplyScalar(3); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.1, size1: 0.02, life: 0.3, color: i ? JADE : JADE2, alpha: 0.9 }); } }
      // 모습을 감춘 동안: 대상 주위에 사방에서 베기 (0.06초마다 한 번, 작은 피해)
      const tg = f.ultTgt; if (tg && f.vanish && t > 0.7 && t < 1.9) { f.cutAcc = (f.cutAcc || 0) + dt; while (f.cutAcc >= 0.06) { f.cutAcc -= 0.06; f.ultCuts++;
        const c = tg.chest(new V3()), a = rand(0, TAU), e = rand(-0.9, 0.9), d = new V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); slashLine(G, c.clone().addScaledVector(d, -1.6), c.clone().addScaledVector(d, 1.6), f.ultCuts % 3 ? JADE : 0xffffff, 0.9);
        if (f.ultCuts % 3 === 0) { sfx('swing'); tg.takeHit(f, { dmg: 9, kb: [0, 0], stun: 99, hs: 0.01, nokill: true, noScale: true, force: true, noCrit: true, daze: 8, snd: 'hit' }, d.clone().setY(0).normalize()); } } }
    },
    end: (f, o, G) => { G.setTint(0, 0); blade(f, 0); f.root.visible = true; f.vanish = false; const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, JADE, big ? 1.7 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? JADE2 : JADE, life: 0.2 });
  leaves(G, p, big ? 12 : 5, 4);
  // 검기: 맞힐 때마다 쌓인다 (가득 차면 다음 일섬이 삼연격)
  att.ki = Math.min(100, (att.ki || 0) + h.dmg * 0.4);
}

// 검기 · 비취 회선 상태 → 이동 속도 · 칼날 빛
function createModelWithKi(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    f.spdMul = f.orbitT > 0 ? 1.2 : 1;
    if (ki(f) >= 100 && f.root.visible && Math.random() < 0.3) { const p = m.tipPos(new V3()); f.G.fx.p(p, { vel: [0, 0.6, 0], size: 0.1, size1: 0.02, life: 0.4, color: JADE2, alpha: 0.9, drag: 1 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist > 3 && dist < 7 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist > 4 && dist < 10 && f.cd.s1 <= 0 && Math.random() < 0.3) return 's1';
  if (dist < 3 && f.cd.s2 <= 0 && !(f.orbitT > 0) && Math.random() < 0.25) return 's2';
  return null;
}

export default {
  id: 'sui', name: '스이', short: '스이', title: 'JADE RONIN · 비취 검객', scale: 1.0,
  desc: '근거리 · 발도술 · 고속 이동. 비취 검을 쓰는 떠돌이 검객. 칼을 칼집에 대었다가 한순간에 꿰뚫고 지나가는 일섬, 지그재그로 파고드는 연참, 몸 주위를 도는 비취 칼날로 싸운다. 맞힐수록 검기가 차오르고, 가득 차면 일섬이 삼연격이 된다.',
  stats: { hp: 920, speed: 8.2, jump: 11, crit: 0.3 },
  palettes: [{ accent: JADE, jade: JADE, band: '#0a2a14' }, { accent: 0xff5a9a, jade: 0xff5a9a, band: '#2a0a18' }],
  skills: { heavy: { name: '일섬', cd: 7 }, s1: { name: '녹풍 연참', cd: 9 }, s2: { name: '비취 회선', cd: 13 }, ult: { name: '천검 · 비취우', sub: 'JADE RONIN' } },
  aiPick,
  resource: (f) => ki(f) >= 100 ? { v: 1, label: '검기', color: 0x9affb8, full: true } : { v: ki(f) / 100, label: '검기', color: 0x2ab860 },
  moveList: [['좌클 ×4', '가로 베기 → 올려베기 → 회전 베기(2타) → 꿰뚫는 찌르기 돌진 58'], ['공중 좌클', '칼을 거꾸로 쥐고 내리꽂아 비취 검기 폭발'],
    ['우클 · 일섬', '발도 자세에서 한순간에 앞으로 꿰뚫고 지나가며 66 → 0.3초 뒤 베인 자리가 터짐 34. 검기가 가득 차면 삼연격'], ['Shift · 녹풍 연참', '상대 주위를 지그재그로 세 번 파고들며 베기 (30 · 30 · 44)'],
    ['E · 비취 회선', '몸 주위를 도는 비취 칼날 여섯 자루 5초: 닿으면 0.25초마다 9 · 이동 속도 ×1.2'], ['Q · 천검 · 비취우', '모습을 감추고 사방에서 수십 번 베어낸 뒤, 등 뒤에서 칼을 거두는 순간 모든 검기가 터진다 190'],
    ['검기', '맞힐수록 쌓이고 가득 차면 다음 일섬이 삼연격'], ['C (타이밍) · 극한 회피', '그림자 발도: 상대 등 뒤로 순간이동해 베기 92'], ['가만히', '칼을 칼집에 대고 고개를 숙인 채 기다림']],
  createModel: createModelWithKi, poses, moves, hitFx,
};
