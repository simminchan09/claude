// 레오 폰 아이젠가르트 (Leo Von Eisengard) — GLAIVIER · 근거리 · 물리 · 브루저
// "짐이란 감히 누구도 쳐다볼 수 없는 '절대적인 공포'다!"
// 무능한 형을 베고 왕좌에 오른 찬탈자. 질서를 바로잡기 위해 기꺼이 형제를 베고 괴물이 되었다.
// 디자인 키워드: 황금 · 욕심 · 왕족 · 중세 / 색: 남색 · 회갈색 · 금 · 적 · 백
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, GOLD, FIRE, SHIELD, ROSE } from './leo_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;

/* =====================================================================
   포즈 · 기술
   (회전 규칙은 rig.js 참고. 왼손은 IK 로 창대를 잡으므로 왼팔 값은 IK 를 끈 기술에서만 쓰인다)
   ===================================================================== */
const poses = {
  // 기본: 설정화처럼 오른손으로 창을 비스듬히 들어 날이 왼쪽 어깨 뒤 위로 솟는다
  base: { hips: [0, -0.45, 0], spine: [0.1, 0.22, 0], chest: [0.06, 0.16, 0], head: [-0.06, 0.1, 0],
    shoulderR: [-0.3, 0, -0.32], elbowR: [-0.95, 0, 0], weapon: [1.0, -2.5, 0.2], shoulderL: [-0.05, 0, 0.16], elbowL: [-0.35, 0, 0],
    hipL: [-0.45, 0, 0.12], kneeL: [0.6, 0, 0], footL: [-0.15, 0, 0], hipR: [0.32, 0, -0.14], kneeR: [0.45, 0, 0], footR: [0.05, 0, 0] },
  run: { hips: [0, -0.15, 0], spine: [0.2, 0.05, 0], chest: [0.05, 0.05, 0], head: [-0.1, 0, 0], shoulderR: [0.15, 0, -0.25], elbowR: [-0.7, 0, 0], weapon: [0.55, -2.95, 1.3],
    hipL: [0, 0, 0], kneeL: [0.2, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.2, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.3, 0, 0], shoulderR: [-1.0, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.8, -2.6, 0.4] },
  // 방어: 창대를 몸 앞에 가로로
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.1, 0], chest: [0.05, 0.1, 0], shoulderR: [-0.9, 0, -0.1], elbowR: [-1.5, 0, 0], weapon: [0.2, -1.5, 1.57],
    hipL: [-0.5, 0, 0.22], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.22], kneeR: [0.65, 0, 0] },
  // 오만한 반격 태세 (Action 3): 꼿꼿이 서서 창끝을 왼쪽 앞 아래로 늘어뜨린다
  stance: { hips: [0, 0.1, 0], spine: [-0.05, 0.05, 0], chest: [-0.05, 0.05, 0], head: [0.08, 0, 0], shoulderR: [-0.55, 0, -0.15], elbowR: [-0.55, 0, 0], weapon: [-0.55, -0.85, 1.4],
    hipL: [-0.1, 0, 0.1], kneeL: [0.1, 0, 0], hipR: [0.1, 0, -0.1], kneeR: [0.1, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.5, 0, 0], weapon: [0.9, -2.3, 0.3] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.5, -2.0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.78, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -1.4, 1.57],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.8, 0, -0.3], elbowR: [-0.4, 0, 0], weapon: [0.3, -2.85, 1.3], shoulderL: [0.8, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.9, 0, 0] },
  // 승리: 창을 곧게 세워 짚고 내려다본다
  win: { hips: [0, 0, 0], spine: [-0.05, 0, 0], chest: [-0.05, 0, 0], head: [0.12, 0, 0], shoulderR: [-0.55, 0, -0.35], elbowR: [-0.9, 0, 0], weapon: [1.48, 0.1, 1.57], shoulderL: [0.05, 0, 0.12], elbowL: [-0.2, 0, 0],
    hipL: [-0.05, 0, 0.12], kneeL: [0.05, 0, 0], hipR: [0.05, 0, -0.12], kneeR: [0.05, 0, 0] },
  // 컷인: 턱을 들고 내려다보며 창을 곧게 세운다
  portrait: { hips: [0, -0.2, 0], chest: [0, -0.25, 0], head: [-0.12, 0.3, 0], shoulderR: [-0.9, 0, -1.0], elbowR: [-1.3, 0, 0], weapon: [1.45, -0.2, 1.57] },
  // 오른쪽 아래 뒤로 창을 끌어당긴 준비 자세 (올려베기 시작)
  windup: { hips: [0, -0.55, 0], spine: [0.15, -0.35, 0], chest: [0.05, -0.45, 0], shoulderR: [0.25, 0, -0.55], elbowR: [-0.45, 0, 0], weapon: [-0.55, 2.3, 0.9],
    hipL: [-0.55, 0, 0.2], kneeL: [0.75, 0, 0], hipR: [0.4, 0, -0.25], kneeR: [0.55, 0, 0] },
  // 머리 위로 크게 치켜든 자세 (날이 등 뒤로 넘어감)
  raised: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.25, 0, 0], shoulderR: [-3.0, 0, -0.2], elbowR: [-0.45, 0, 0], weapon: [2.35, 0, 1.57], hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  // 하늘을 찌르듯 곧게 치켜든 자세 (궁극기 인장)
  skyward: { hips: [0, 0, 0], spine: [-0.12, 0, 0], chest: [-0.1, 0, 0], head: [-0.35, 0, 0], shoulderR: [-3.05, 0, -0.15], elbowR: [-0.1, 0, 0], weapon: [1.5, 0, 1.57], shoulderL: [0.1, 0, 0.35], elbowL: [-0.2, 0, 0],
    hipL: [-0.15, 0, 0.12], kneeL: [0.15, 0, 0], hipR: [0.15, 0, -0.12], kneeR: [0.15, 0, 0] },
  // 내려찍은 직후: 상체를 숙이고 날이 앞쪽 땅을 향함
  slamDown: { hips: [0, -0.2, 0], spine: [0.75, 0, 0], chest: [0.25, 0, 0], head: [-0.4, 0, 0], shoulderR: [-1.0, 0, -0.05], elbowR: [-0.1, 0, 0], weapon: [-0.7, 0, 1.57], hipL: [-1.2, 0, 0.1], kneeL: [1.7, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [1.5, 0, 0] },
};
const LEGS_LUNGE = { hipL: [-1.0, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.3, 0, 0] };
const ACC = GOLD;
const goldSlash = (f, o) => f.slashFx({ r: (o.r || 2.4), color: o.color ?? GOLD, life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
function embers(G, p, n = 12, col = FIRE) { G.fx.burst(p, n, [col, 0xffd070], 5, { kind: 'ember', lk: 1.2 }); }
function crack(G, c, r, col, n = 9) {
  // 땅 갈라짐: 방사형 빛줄기
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(-0.2, 0.2), L = r * rand(0.6, 1.1), dir = new V3(Math.cos(a), 0, Math.sin(a));
    G.fx.slash(c.clone().addScaledVector(dir, L * 0.45).setY(0.04), { fwd: dir, normal: new V3(0, 1, 0), r: L * 0.55, color: col, life: 0.5 });
  }
}
// 유도 없이 날아가 박히는 글레이브 (파괴의 투창)
class ThrownGlaive {
  constructor(G, f, from, to) {
    this.G = G; this.owner = f; this.t = 0; this.done = false; this.hit = new Set(); this.phase = 'fly';
    this.mesh = f.model.glaive.clone(true); this.mesh.scale.setScalar(f.scale); G.scene.add(this.mesh); f.model.setWeapon(false);
    this.from = from.clone(); this.to = to.clone(); this.pos = from.clone(); this.prev = from.clone();
    this.dur = Math.max(0.22, from.distanceTo(to) / 32);
  }
  update(dt) {
    const G = this.G, f = this.owner; this.t += dt;
    if (this.phase === 'fly') {
      const k = Math.min(1, this.t / this.dur); this.prev.copy(this.pos);
      this.pos.lerpVectors(this.from, this.to, k); this.pos.y += Math.sin(k * Math.PI) * 1.2;
      const d = this.pos.clone().sub(this.prev); if (d.lengthSq() > 1e-6) this.mesh.lookAt(this.pos.clone().add(d));
      this.mesh.position.copy(this.pos).addScaledVector(d.normalize(), -1.6 * f.scale);
      G.fx.p(this.pos, { size: 0.9, size1: 0.2, life: 0.25, color: GOLD, alpha: 0.8 }); G.fx.burst(this.pos, 3, [GOLD, 0xffffff], 2, { lk: 0.5 });
      // 경로 위 적: 32
      for (const t of f.foes()) if (!this.hit.has(t) && t.hurtHitSeg(this.prev, this.pos, 0.35)) { this.hit.add(t); t.takeHit(f, { dmg: 32, kb: [3, 0], stun: 0.35, hs: 0.04, daze: 15 }, d); }
      if (k >= 1) this.impact();
    } else if (this.phase === 'stuck') {
      if (this.t > 0.6) { this.phase = 'return'; this.t = 0; this.from.copy(this.mesh.position); sfx('dash'); }
    } else if (this.phase === 'return') {
      const k = Math.min(1, this.t / 0.32), hand = f.model.J.handR.getWorldPosition(new V3());
      this.mesh.position.lerpVectors(this.from, hand, k * k); this.mesh.rotation.y += dt * 20;
      G.fx.p(this.mesh.position, { size: 0.7, size1: 0.1, life: 0.2, color: GOLD, alpha: 0.6 });
      if (k >= 1) this.kill(true);
    }
  }
  impact() {
    const G = this.G, f = this.owner, c = this.to.clone().setY(0); this.phase = 'stuck'; this.t = 0;
    this.mesh.position.copy(c).add(new V3(0, 1.45 * f.scale, 0)); this.mesh.lookAt(c.clone().add(new V3(0.15, -1, 0.1)));
    sfx('boom'); sfx('parry'); G.shake(0.45); G.flash(0xffe6a0, 0.35); G.stage.flashSky && G.stage.flashSky(0.3);
    // 반구 충격파 (Action 2: 금빛 갈라짐 + 푸른 돔)
    G.spawn(dome(G, c, 4, 0x8ad0ff)); crack(G, c, 4.4, GOLD, 11);
    G.fx.ring(c.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.4, r1: 4.6, life: 0.55, color: GOLD }); G.fx.ring(c.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.2, r1: 3.2, life: 0.4, color: 0xffffff });
    G.fx.burst(c.clone().setY(0.5), 60, [GOLD, 0xffffff, 0xffe08a], 14, { dir: new V3(0, 1, 0), spread: 1.2 }); G.fx.burst(c, 24, 0x7a6a60, 6, { kind: 'dust', sk: 1.8 });
    G.fx.light(c.clone().setY(1.2), GOLD, 140, 0.5, 16); G.fx.beam(c, { r: 0.7, h: 10, color: GOLD, life: 0.45 });
    areaHit(f, c, 4, { dmg: 154, kb: [4, 10.5], stun: 0.7, hs: 0.14, shake: 0.2, daze: 70, snd: 'big' }, 1.6);
  }
  kill(caught) {
    this.done = true; this.G.scene.remove(this.mesh); this.owner.model.setWeapon(true);
    if (caught) { const h = this.owner.model.J.handR.getWorldPosition(new V3()); this.G.fx.burst(h, 16, [GOLD, 0xffffff], 4); sfx('block'); }
  }
}
// 반투명 반구가 부풀었다 사라짐
function dome(G, c, r, col) {
  const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, Math.PI / 2), mat); m.position.copy(c); G.scene.add(m);
  let t = 0; return { done: false, update(dt) { t += dt; const k = t / 0.6; m.scale.setScalar(r * (0.3 + 0.75 * (1 - (1 - Math.min(1, k)) ** 3))); mat.opacity = 0.55 * Math.max(0, 1 - k); if (k >= 1) { this.done = true; G.scene.remove(m); m.geometry.dispose(); mat.dispose(); } } };
}
// 방어 태세 방벽 (Action 3: 앞쪽 푸른 돔)
function barrier(G, f) {
  const mat = new THREE.MeshBasicMaterial({ color: SHIELD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const wire = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const geo = new THREE.SphereGeometry(1.25, 28, 14, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.05, Math.PI * 0.62);
  const m = new THREE.Mesh(geo, mat), w = new THREE.Mesh(new THREE.IcosahedronGeometry(1.26, 2), wire); m.add(w); G.scene.add(m);
  return { m, mat, wire, t: 0, hitFlash: 0, update(dt) {
    this.t += dt; this.hitFlash = Math.max(0, this.hitFlash - dt * 4); const a = Math.min(1, this.t * 8);
    m.position.copy(f.pos).add(new V3(0, 1.05 * f.scale, 0)); m.rotation.y = f.yaw + Math.PI / 2; m.scale.setScalar(f.scale * (1 + 0.03 * Math.sin(this.t * 20)));
    w.rotation.y = -this.t * 0.6; mat.opacity = a * (0.22 + this.hitFlash * 0.5); wire.opacity = a * (0.18 + this.hitFlash * 0.5);
  }, kill() { G.scene.remove(m); geo.dispose(); w.geometry.dispose(); mat.dispose(); wire.dispose(); } };
}

const moves = {
  /* --- 공중 좌클: 낙하 공격 — 창을 머리 위로 치켜들었다가 수직으로 내리꽂아 땅을 가른다 --- */
  ...makePlunge({
    up: 'raised',
    fall: { ...poses.raised, spine: [0.25, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.0, 0, -0.15], elbowR: [-0.5, 0, 0], weapon: [-1.4, 0, 1.57], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.2, 0, 0] },
    land: { ...poses.slamDown, weapon: [-1.2, 0, 1.57] },
    color: GOLD, dmg: 78, r: 2.6,
    fx: (f, o, G, c) => { crack(G, c, 2.8, GOLD, 9); embers(G, c, 18, GOLD); },
  }),
  /* --- 기본 공격 4연타 (Action 1: 사선 내려베기 → 올려베기 → 회전 베기 → 찌르기) --- */
  light1: { dur: 0.5, cancel: 0.3, next: 'light2', trail: true, track: 0.1,
    keys: [[0, 'windup'], [0.09, { chest: [0.05, -0.55, 0], weapon: [-0.6, 2.45, 0.9] }],
      [0.2, { hips: [0, 0.35, 0], spine: [0.2, 0.3, 0], chest: [0.0, 0.5, 0], shoulderR: [-2.4, 0, -0.1], elbowR: [-0.3, 0, 0], weapon: [1.05, -0.7, 0.9], ...LEGS_LUNGE }],
      [0.3, { chest: [-0.05, 0.6, 0], weapon: [1.3, -1.3, 0.9] }], [0.5, 'base']],
    lunge: [[0.07, 0.22, 6.5]],
    ev: [[0.12, (f) => { sfx('heavy'); goldSlash(f, { tilt: 0.95, r: 2.5, at: [0.2, 1.3, 0.3], flip: true }); }]],
    hits: [{ t0: 0.12, t1: 0.24, dmg: 44, kb: [2.5, 0], stun: 0.36, daze: 14 }] },
  light2: { dur: 0.5, cancel: 0.3, next: 'light3', trail: true, track: 0.08,
    keys: [[0, 'raised'], [0.09, { weapon: [2.55, -0.1, 1.57], spine: [-0.22, 0, 0] }],
      [0.2, { hips: [0, -0.1, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.3, 0, 0], shoulderR: [-1.05, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [-0.6, 0.05, 1.57], hipL: [-1.1, 0, 0.15], kneeL: [1.2, 0, 0], hipR: [0.7, 0, -0.15], kneeR: [0.4, 0, 0] }],
      [0.32, { weapon: [-0.72, 0.05, 1.57] }], [0.5, 'base']],
    lunge: [[0.06, 0.18, 4]],
    ev: [[0.1, (f) => { sfx('heavy'); goldSlash(f, { tilt: Math.PI / 2, r: 2.6, at: [0, 1.3, 0.3] }); }],
      [0.19, (f, o, G) => { const c = f.local([0, 0.05, 2.1]); crack(G, c, 1.4, GOLD, 5); G.fx.burst(c, 10, 0x7a6a60, 3, { kind: 'dust' }); G.shake(0.08); }]],
    hits: [{ t0: 0.1, t1: 0.24, dmg: 48, kb: [3, 0], stun: 0.38, daze: 14 }] },
  // 회전 베기: 몸 전체가 한 바퀴 돈다 (한 손)
  light3: { dur: 0.62, cancel: 0.42, next: 'light4', trail: true, ikOff: true, aim: true,
    keys: [[0, { hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0, 0.3, 0], shoulderR: [-1.5, 0, -1.2], elbowR: [-0.05, 0, 0], weapon: [0.05, 1.25, 0], shoulderL: [-0.6, 0, 1.1], elbowL: [-0.3, 0, 0], hipL: [-0.6, 0, 0.3], kneeL: [0.8, 0, 0], hipR: [0.4, 0, -0.3], kneeR: [0.6, 0, 0] }],
      [0.08, { weapon: [0.0, 1.45, 0] }], [0.45, {}], [0.62, 'base']],
    tick: (f, o, G, t, dt) => { if (t > 0.06 && t < 0.44) f.yaw -= dt * (TAU / 0.38); },
    end: (f) => { f.faceOpp(); },
    ev: [[0.08, (f, o, G) => { sfx('swing'); G.fx.ring(f.pos.clone().setY(1.0), { normal: new V3(0, 1, 0), r0: 0.5, r1: 3.6, life: 0.4, color: GOLD }); }], [0.25, () => sfx('swing')]],
    hits: [{ t0: 0.08, t1: 0.44, dmg: 56, kb: [4.5, 3], stun: 0.45, daze: 18 }] },
  light4: { dur: 0.62, trail: true, track: 0.14,
    keys: [[0, { hips: [0, -0.7, 0], spine: [0.1, -0.4, 0], chest: [0, -0.5, 0], shoulderR: [-0.35, 0, -0.3], elbowR: [-1.7, 0, 0], weapon: [0.1, 0.15, 0] }], [0.14, { chest: [0, -0.6, 0] }],
      [0.22, { hips: [0, 0.15, 0], spine: [0.42, 0.2, 0], chest: [0.15, 0.35, 0], shoulderR: [-1.5, 0, 0.05], elbowR: [-0.05, 0, 0], weapon: [0.02, 0, 0], ...LEGS_LUNGE }], [0.4, {}], [0.62, 'base']],
    lunge: [[0.15, 0.3, 11]],
    ev: [[0.16, (f, o, G) => { sfx('zap'); const p = f.local([0, 1.15, 2.4]); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.6, life: 0.3, color: GOLD }); G.fx.burst(p, 20, [GOLD, 0xffffff], 12, { dir: f.fwd(), spread: 0.25 }); }]],
    hits: [{ t0: 0.16, t1: 0.3, dmg: 72, kb: [8, 5], stun: 0.6, hs: 0.1, shake: 0.14, daze: 24, snd: 'big' }] },

  /* --- 우클: 오만한 반격 — 1.5초 방어 태세(앞쪽 피해 50% 감소). 맞거나 다시 누르면 반격 --- */
  heavy: { dur: 1.5, cd: 'heavy', stance: true, aim: true, track: 1.5,
    keys: [[0, 'stance'], [1.5, 'stance']],
    start: (f, o, G) => { f.riposte = false; f.barrier = barrier(G, f); G.spawn(f.barrier); G.say(f, '"주제도 모르고."'); sfx('charge'); G.fx.burst(f.chest(), 20, [SHIELD, 0xffffff], 5); },
    onHit: (f, att, h, dir) => {
      const toAtt = new V3().subVectors(att.pos, f.pos).setY(0).normalize(), front = f.fwd(new V3()).dot(toAtt) > 0.1;
      f.barrier && (f.barrier.hitFlash = 1); f.riposte = true; f.riposteAt = att;
      const p = f.chest().addScaledVector(toAtt, 0.9); f.G.fx.burst(p, 24, [SHIELD, 0xffffff], 8); f.G.fx.ring(p, { r0: 0.2, r1: 1.6, life: 0.3, color: SHIELD, billboard: true }); sfx('block');
      return front ? { dmgK: 0.5, armor: true } : null;
    },
    tick: (f, o, G, t) => {
      if (t > 0.18 && (f.riposte || (f.buf && f.buf.a === 'heavy'))) { f.buf = null; f.start('riposte'); }
    },
    end: (f) => { if (f.barrier) { f.barrier.kill(); f.barrier.done = true; f.barrier = null; } } },
  riposte: { dur: 0.75, trail: true, aim: true, ikOff: true,
    keys: [[0, { hips: [0, -0.7, 0], spine: [0.1, -0.6, 0], chest: [0, -0.8, 0], shoulderR: [-1.3, 0, -1.25], elbowR: [-0.2, 0, 0], weapon: [0.45, 2.2, 0.5], shoulderL: [-0.5, 0, 0.6] }],
      [0.08, { chest: [0, -0.95, 0], weapon: [0.5, 2.4, 0.5] }], [0.22, { hips: [0, 0.5, 0], spine: [0.3, 0.6, 0], chest: [0.15, 0.95, 0], shoulderR: [-1.5, 0, 0.55], weapon: [-0.3, -1.7, 0.5], ...LEGS_LUNGE }], [0.45, {}], [0.75, 'base']],
    start: (f, o, G) => { if (f.riposteAt && !f.riposteAt.gone) { f.opp = f.riposteAt; f.faceOpp(); } G.say(f, '"꺼져라!"'); G.slow(0.4, 0.18); },
    lunge: [[0.08, 0.2, 5]],
    ev: [[0.09, (f, o, G) => { sfx('heavy'); sfx('boom'); goldSlash(f, { r: 3.4, color: ROSE, life: 0.34, at: [0, 1.1, 0.2], tilt: 0.1 }); G.fx.light(f.chest(), ROSE, 90, 0.3); }]],
    hits: [{ t0: 0.09, t1: 0.26, dmg: 185, kb: [6, 10.5], stun: 0.8, hs: 0.16, shake: 0.3, daze: 70, snd: 'big', br: 0.25 }] },

  /* --- Shift: 난도질 — 제자리에서 2회 휘두른 뒤 마지막에 강하게 내려베어 넘어뜨림 --- */
  s1: { dur: 1.45, cd: 's1', trail: true, track: 0.25, aim: true,
    keys: [[0, { hips: [0, -0.8, 0], spine: [0.1, -0.5, 0], chest: [0, -0.8, 0], shoulderR: [-1.6, 0, -1.1], elbowR: [-0.3, 0, 0], weapon: [0.15, 2.1, 0.25] }],
      [0.14, {}], [0.3, { hips: [0, 0.3, 0], spine: [0.25, 0.5, 0], chest: [0.1, 0.85, 0], shoulderR: [-1.35, 0, 0.55], weapon: [-0.05, -1.7, 0.25], ...LEGS_LUNGE }],
      [0.42, {}], [0.6, { hips: [0, -0.7, 0], spine: [0.2, -0.5, 0], chest: [0.05, -0.85, 0], shoulderR: [-1.7, 0, -1.15], weapon: [0.15, 2.1, -0.25] }],
      [0.72, {}], [0.9, 'raised'], [0.98, { shoulderR: [-3.1, 0, -0.15], spine: [-0.2, 0, 0] }], [1.1, 'slamDown'], [1.25, {}], [1.45, 'base']],
    start: (f, o, G) => G.say(f, '"조각을 내주마."'),
    ev: [[0.16, (f, o, G) => { sfx('heavy'); goldSlash(f, { r: 2.7, color: FIRE, tilt: 0.12 }); embers(G, f.local([0, 1.1, 1.6])); }],
      [0.46, (f, o, G) => { sfx('heavy'); goldSlash(f, { r: 2.7, color: FIRE, tilt: -0.12, flip: true }); embers(G, f.local([0, 1.1, 1.6])); }],
      [0.9, () => sfx('charge')],
      [1.12, (f, o, G) => {
        const c = f.local([0, 0, 2.0]).setY(0.05); sfx('boom'); G.shake(0.4); G.flash(0xffb070, 0.2);
        goldSlash(f, { r: 2.4, color: FIRE, tilt: Math.PI / 2, flip: true, at: [0, 1.3, 0.3], life: 0.3 });
        crack(G, c, 2.6, FIRE, 7); G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.3, r1: 3, life: 0.45, color: FIRE });
        G.fx.burst(c.clone().setY(0.4), 50, [FIRE, 0xffd070, 0xffffff], 11, { dir: new V3(0, 1, 0), spread: 1.1 }); embers(G, c, 30); G.fx.burst(c, 20, 0x6a5a50, 5, { kind: 'dust', sk: 1.4 }); G.fx.light(c.clone().setY(1), FIRE, 110, 0.4);
        areaHit(f, c, 1.8, { dmg: 40, kb: [3, 4], stun: 0.5, noCrit: true }, 0.8);
      }]],
    hits: [{ t0: 0.16, t1: 0.32, dmg: 42, kb: [2, 0], stun: 0.5, daze: 18 }, { t0: 0.46, t1: 0.62, dmg: 50, kb: [2, 0], stun: 0.55, daze: 18 },
      { t0: 1.0, t1: 1.14, dmg: 89, kb: [3, 5.5], stun: 0.7, hs: 0.14, shake: 0.25, daze: 40, snd: 'big', br: 0.22 }] },

  /* --- E: 파괴의 투창 — 조준한 곳으로 창을 던짐. 경로 피해 후 땅에 박히며 반경 4m 충격파 --- */
  s2: { dur: 0.95, cd: 's2', ikOff: true, aim: true, track: 0.4,
    keys: [[0, { hips: [0, -0.9, 0], spine: [-0.15, -0.5, 0], chest: [-0.1, -0.6, 0], head: [0, 0.4, 0], shoulderR: [-2.6, 0, -0.35], elbowR: [-1.25, 0, 0], weapon: [0.22, 0.05, 1.57], shoulderL: [-1.5, 0, 0.35], elbowL: [-0.1, 0, 0], hipL: [-0.7, 0, 0.2], kneeL: [0.6, 0, 0], hipR: [0.5, 0, -0.2], kneeR: [0.5, 0, 0] }],
      [0.36, { spine: [-0.25, -0.55, 0], shoulderR: [-2.8, 0, -0.4], elbowR: [-1.45, 0, 0], weapon: [0.28, 0.05, 1.57] }],
      [0.46, { hips: [0, 0.3, 0], spine: [0.45, 0.3, 0], chest: [0.15, 0.4, 0], head: [0, 0, 0], shoulderR: [-1.3, 0, 0.1], elbowR: [-0.05, 0, 0], weapon: [0, 0, 1.57], shoulderL: [0.3, 0, 0.3], ...LEGS_LUNGE }],
      [0.7, {}], [0.95, 'base']],
    start: (f, o, G) => { G.say(f, '"부서져라!"'); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.42) { const p = f.model.J.weapon.localToWorld(new V3(0, 0, 1.7)); G.fx.p(p, { size: 0.6, size1: 0.1, life: 0.15, color: GOLD, alpha: 0.7 }); } },
    ev: [[0.46, (f, o, G) => {
      const from = f.model.J.weapon.localToWorld(new V3(0, 0, 1.4));
      let to; if (o && f.dist() < 18) to = o.pos.clone(); else { const cf = f.team === 0 && G.camFwd ? G.camFwd : { x: Math.sin(f.yaw), z: Math.cos(f.yaw) }; to = f.pos.clone().add(new V3(cf.x, 0, cf.z).multiplyScalar(13)); }
      const R = Math.hypot(to.x, to.z); if (R > 20) to.multiplyScalar(20 / R);
      G.spawn(new ThrownGlaive(G, f, from, to)); sfx('shot'); sfx('dash');
    }]] },

  /* --- 극한 회피 뒤 좌클: 순간 돌진 찌르기 --- */
  counter: { dur: 0.6, trail: true, aim: true,
    keys: [[0, { hips: [0, -0.6, 0], chest: [0, -0.5, 0], shoulderR: [-0.35, 0, -0.3], elbowR: [-1.7, 0, 0], weapon: [0.1, 0.15, 0] }],
      [0.08, { hips: [0, 0.15, 0], spine: [0.45, 0.2, 0], chest: [0.15, 0.35, 0], shoulderR: [-1.5, 0, 0.05], elbowR: [-0.05, 0, 0], weapon: [0.02, 0, 0], ...LEGS_LUNGE }], [0.35, {}], [0.6, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest();
      if (o) { const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? 0 : o.pos.y).addScaledVector(d, 2.3 + 0.4 * o.scale); f.faceOpp(); }
      for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.chest(), i / 8), { size: 0.9, size1: 0.2, life: 0.3, color: GOLD, alpha: 0.7 });
      sfx('dash'); G.flash(GOLD, 0.2); f.model.resetCloth();
    }], [0.06, (f, o, G) => { sfx('zap'); const p = f.local([0, 1.15, 2.4]); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.8, life: 0.3, color: GOLD }); }]],
    hits: [{ t0: 0.05, t1: 0.2, dmg: 96, kb: [7, 4], stun: 0.6, hs: 0.12, shake: 0.15, daze: 45, snd: 'big' }] },

  /* --- Q: 궁극기 「절대적인 공포」 — 하늘의 왕관 인장 → 도약 → 내리꽂기 → 뽑아 올려베기 --- */
  ult: { dur: 3.1, ult: true, aim: true, ikOff: true,
    keys: [[0, 'skyward'], [0.5, 'skyward'], [0.6, { hipL: [-1.2, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.5, 0, 0], kneeR: [1.3, 0, 0], weapon: [1.9, 0, 1.57] }], [1.0, 'raised'], [1.12, { ...poses.slamDown, weapon: [-1.15, 0, 1.57] }], [1.85, {}],
      [1.95, { hips: [0, -0.8, 0], spine: [0.3, -0.6, 0], chest: [0, -0.8, 0], shoulderR: [-0.3, 0, -0.7], elbowR: [-0.2, 0, 0], weapon: [-0.55, 2.0, 0.9] }],
      [2.15, { hips: [0, 0.4, 0], spine: [-0.1, 0.5, 0], chest: [-0.1, 0.8, 0], shoulderR: [-2.9, 0, 0.3], elbowR: [-0.1, 0, 0], weapon: [1.55, -0.5, 0.9], ...LEGS_LUNGE }], [2.6, {}], [3.1, 'win']],
    cam: [[0, { ref: 'self', p: [0.9, 0.5, 2.8], l: [0, 1.9, 0], fov: 40 }], [0.5, { ref: 'self', p: [3.5, 1.4, 1.5], l: [0, 2.5, 3], fov: 50 }],
      [1.05, { ref: 'target', p: [5, 1.0, -3.5], l: [0, 1.2, 0], fov: 55 }], [1.8, { ref: 'target', p: [-4.5, 0.6, -4.5], l: [0, 1.8, 0], fov: 55 }],
      [2.3, { ref: 'target', p: [-1.5, 2.5, -9], l: [0, 3, 0], fov: 58 }], [3.1, { ref: 'target', p: [-1.5, 3, -10], l: [0, 3.4, 0], fov: 58 }]],
    ev: [
      [0, (f, o, G) => {
        f.ultTgt = o; o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; G.setTint(GOLD, 0.35); sfx('charge'); G.say(f, '"짐은 감히 누구도 쳐다볼 수 없는 절대적인 공포다!"');
        G.fx.burst(f.chest(), 50, [GOLD, 0xffffff], 7); G.fx.light(f.chest(), GOLD, 100, 0.6); f.ultFrom = f.pos.clone(); f.ultTo = o.pos.clone().addScaledVector(new V3().subVectors(f.pos, o.pos).setY(0).normalize(), 1.9 * o.scale);
        // 하늘의 왕관 인장
        const top = o.pos.clone().setY(9);
        G.fx.ring(top, { normal: new V3(0, 1, 0), r0: 0.5, r1: 4.5, life: 1.3, color: GOLD, op: 1 }); G.fx.ring(top, { normal: new V3(0, 1, 0), r0: 0.3, r1: 3.2, life: 1.3, color: 0xffffff, op: 0.8 });
        for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; G.fx.beam(top.clone().add(new V3(Math.cos(a) * 3.4, -0.5, Math.sin(a) * 3.4)), { r: 0.18, h: 2.5, color: GOLD, life: 1.2 }); }
      }],
      [0.5, (f) => { f.float = true; f.onGround = false; sfx('jump'); sfx('dash'); f.model.resetCloth && 0; }],
      [1.1, (f, o, G) => { o = f.ultTgt || o; if (!o) return;
        const c = o.pos.clone().setY(0); f.pos.copy(f.ultTo).setY(0); f.float = false; f.onGround = true; f.vel.set(0, 0, 0);
        sfx('boom'); sfx('thunder' in {} ? 'boom' : 'big'); G.shake(0.6); G.flash(0xfff0c0, 0.75); G.stage.flashSky(0.6);
        G.spawn(dome(G, c, 6, GOLD)); crack(G, c, 7, GOLD, 14); G.fx.beam(c, { r: 2.2, h: 30, color: GOLD, life: 0.9 });
        G.fx.ring(c.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.5, r1: 9, life: 0.8, color: GOLD }); G.fx.burst(c.clone().setY(1), 120, [GOLD, 0xffffff, 0xffe08a], 18, { lk: 1.4 });
        G.fx.burst(c, 40, 0x7a6a60, 8, { kind: 'dust', sk: 2.2 }); G.fx.light(c.clone().setY(1.5), GOLD, 200, 0.9, 24);
        o.takeHit(f, { dmg: 150, kb: [0, 0], stun: 99, hs: 0.2, shake: 0.5, nokill: true, noScale: true, force: true, daze: 120, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(c) < 6) t.takeHit(f, { dmg: 120, kb: [6, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
      }],
      [1.3, (f, o, G) => { o = f.ultTgt || o; if (!o) return; for (let i = 0; i < 8; i++) G.spawn({ done: false, t: -i * 0.07, update(dt) { this.t += dt; if (this.t >= 0 && !this.d) { this.d = true; const p = o.pos.clone().add(new V3(rand(-3, 3), 0, rand(-3, 3))); G.fx.beam(p, { r: 0.35, h: 8, color: GOLD, life: 0.35 }); G.fx.burst(p.clone().setY(0.3), 12, [GOLD, 0xffffff], 6, { dir: new V3(0, 1, 0), spread: 0.6 }); sfx('zap'); } if (this.t > 0.3) this.done = true; } }); }],
      [1.98, (f, o, G) => { o = f.ultTgt || o; if (!o) return;
        o.release(); sfx('heavy'); sfx('boom'); G.say(f, '"엎드려라."');
        goldSlash(f, { r: 3.8, color: ROSE, tilt: Math.PI / 2 - 0.2, life: 0.4, at: [0, 1.4, 0.3] }); G.fx.light(o.chest(), ROSE, 140, 0.5);
        o.takeHit(f, { dmg: 160, kb: [5, 13], stun: 0.9, hs: 0.18, shake: 0.4, noScale: true, force: true, daze: 80, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        G.slow(0.35, 0.5); G.flash(0xffffff, 0.5);
      }],
    ],
    tick: (f, o, G, t) => {
      // 도약 궤적 (0.5 ~ 1.1초): 포물선으로 대상 앞에 내리꽂는다
      if (t > 0.5 && t < 1.1 && f.ultFrom) { const k = (t - 0.5) / 0.6; f.pos.lerpVectors(f.ultFrom, f.ultTo, k); f.pos.y = Math.sin(k * Math.PI) * 6 * (1 - k * 0.3); f.faceOpp(); G.fx.p(f.chest(), { size: 0.8, size1: 0.2, life: 0.3, color: GOLD, alpha: 0.6 }); }
    },
    end: (f, o, G) => { G.setTint(0, 0); f.float = false; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 70;
  G.fx.impact(p, GOLD, big ? 1.8 : 1.1, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? ROSE : GOLD, life: 0.2 });
  G.fx.burst(p, big ? 14 : 6, [FIRE, GOLD], 4, { kind: 'ember' });
}

export default {
  id: 'leo', name: '레오 폰 아이젠가르트', short: '레오', title: 'GLAIVIER · 찬탈한 왕', scale: 1.1,
  desc: '근거리 · 물리 · 브루저. "짐이란 감히 누구도 쳐다볼 수 없는 \'절대적인 공포\'다!" 무능한 형을 베고 왕좌에 오른 찬탈자. 거대한 글레이브로 넓게 쓸어 버린다.',
  stats: { hp: 1150, speed: 6.6, jump: 9, crit: 0.2 },
  palettes: [{ accent: GOLD, armor: 0x2c2a30, cape: 0x1c2a6a, cloth: 0x1e2a5e, band: '#141a3a' }, { accent: 0xff4a5a, armor: 0x2c2a30, cape: 0x5a0f1c, cloth: 0x3a1420, band: '#2a0a12' }],
  skills: { heavy: { name: '오만한 반격', cd: 18 }, s1: { name: '난도질', cd: 9 }, s2: { name: '파괴의 투창', cd: 14 }, ult: { name: '절대적인 공포', sub: '감히 짐을 쳐다보느냐' } },
  moveList: [['좌클 ×4', '사선 내려베기 → 올려베기 → 회전 베기 → 돌진 찌르기'], ['우클 · 오만한 반격', '1.5초 방어 태세(앞 피해 50%↓) · 맞거나 다시 누르면 「꺼져라!」 반격 185'],
    ['Shift · 난도질', '2회 휘두르기(42·50) → 내려베기 89, 넘어뜨림'], ['E · 파괴의 투창', '창 투척(경로 32) → 착탄 충격파 반경 4m 154, 띄움 → 창 회수'],
    ['Q · 절대적인 공포', '하늘의 왕관 인장 → 도약 내리꽂기 150 → 뽑아 올려베기 160'], ['C (타이밍) · 극한 회피', '적이 느려지고 좌클릭으로 순간 돌진 찌르기']],
  createModel, poses, moves, hitFx,
};
