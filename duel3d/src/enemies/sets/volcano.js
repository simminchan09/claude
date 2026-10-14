// 6. 용암 분화구 — 용암 임프 · 화염 술사 · 흑요석 골렘 · 화염 거인 수르트
// 모델은 volcano_model.js. 보스 수르트: 느리고 무거운 거인 — 긴 예비 동작의 대검 휘두르기 · 늦게 터지는 용암 균열 ·
// 바위 투척 · 뛰어넘어야 하는 대지 진동 · 가까이 있으면 타는 열기 오라 / 2페이즈: 대검 점화(휘두를 때마다 용암 웅덩이) · 유성우
import * as THREE from 'three';
import { slow, swish, chop, slam, shot, pillar } from '../kit.js';
import { floatPoses } from '../bodies.js';
import { areaHit } from '../../entities.js';
import { rand, sfx } from '../../core.js';
import trainer from '../../characters/trainer.js';
import { buildImp, buildMage, buildGolem, buildSurt } from './volcano_model.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0), TAU = Math.PI * 2, T = trainer.moves;
const pal = (accent, armor, body, o = {}) => ({ accent, armor, body, ...o });
const NOSK = { name: '-', cd: 1 }, NOULT = { name: '-', sub: '' };
// 트레이너 공통 포즈를 복사해 기본 자세 등을 덮어쓴다
function posesOf(src, over) { const o = {}; for (const k in src) o[k] = { ...src[k] }; for (const k in over) o[k] = { ...(o[k] || {}), ...over[k] }; return o; }
const BURN = (s = 3, k = 8) => ['burn', s, k];

/* =====================================================================
   지면 효과: 용암 웅덩이 · 용암 균열선 · 투척 바위 · 대지 진동파
   ===================================================================== */
const puddleGeo = new THREE.CircleGeometry(1, 24); puddleGeo.rotateX(-Math.PI / 2);
// 용암 웅덩이: 서 있으면 화상 (경직 없음)
function lavaPool(G, f, x, z, r = 1.1, life = 4.5) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6a14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const me = new THREE.Mesh(puddleGeo, mat); me.position.set(x, 0.035, z); me.scale.setScalar(r); me.renderOrder = 3; G.scene.add(me);
  let t = 0, tick = 0;
  return { done: false, owner: f, update(dt) {
    t += dt; tick -= dt; const k = Math.min(1, t * 4) * Math.min(1, (life - t) * 1.5);
    mat.opacity = 0.55 * k * (0.85 + 0.15 * Math.sin(t * 9)); me.scale.setScalar(r * (0.6 + 0.4 * Math.min(1, t * 3)));
    if (Math.random() < dt * 10) G.fx.p(new V3(x + rand(-r, r) * 0.7, 0.1, z + rand(-r, r) * 0.7), { vel: [0, rand(0.8, 2), 0], size: 0.09, size1: 0.02, life: 0.5, color: Math.random() < 0.5 ? 0xff7a20 : 0xffd060, drag: 1 });
    if (tick <= 0 && t > 0.25) { tick = 0.5; for (const o of f.foes()) if (Math.hypot(o.pos.x - x, o.pos.z - z) < r + 0.25 && o.pos.y < 0.35) { o.addStatus('burn', 1.6, 12, f); o.dot(f, 5, 0xff6a1a); } }
    if (t > life) this.kill();
  }, kill() { this.done = true; G.scene.remove(me); mat.dispose(); } };
}
// 용암 균열: 바닥에 붉은 금이 먼저 번지고, 잠시 뒤 앞에서부터 차례로 용암이 솟는다 (빨강: 막을 수 없음)
function crackLine(G, f, from, dir, { n = 9, step = 1.25, delay = 0.75, dmg = 62, pools = false, hit = new Set() } = {}) {
  const pts = []; for (let i = 0; i < n; i++) pts.push(from.clone().addScaledVector(dir, 1.4 + i * step).setY(0.05));
  let t = 0, k = 0;
  return { done: false, owner: f, update(dt) {
    t += dt;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], tb = delay + i * 0.07; if (t < tb && Math.random() < dt * 30) G.fx.p(p.clone().add(new V3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5))), { vel: [0, 0.4, 0], size: 0.22, size1: 0.1, life: 0.25, color: 0xff2a10, alpha: 0.9, drag: 2 }); }
    while (k < pts.length && t >= delay + k * 0.07) {
      const p = pts[k++]; G.fx.burst(p.clone().setY(0.3), 18, [0xff6a10, 0xffd070], 9, { dir: UP, spread: 0.45 }); G.fx.burst(p, 6, 0x3a2a2a, 3, { kind: 'dust', sk: 1.2 });
      if (k % 3 === 1) { G.fx.light(p.clone().setY(1), 0xff6a10, 60, 0.3); sfx('boom'); G.shake(0.1); }
      for (const o of f.foes()) if (!hit.has(o) && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 1.15 + 0.3 * o.scale && o.pos.y < 1.2) { if (o.takeHit(f, { dmg, kb: [3, 8], stun: 0.6, hs: 0.08, unblock: true, noCrit: true, st: BURN(3, 8) }, dir.clone())) hit.add(o); }
      if (pools && k % 2 === 0) G.spawn(lavaPool(G, f, p.x, p.z, 0.95, 4));
    }
    if (t > delay + n * 0.07 + 0.3) this.done = true;
  }, kill() { this.done = true; } };
}
// 바위 투척: 포물선으로 날아가 표시된 자리에 떨어진다
function boulderThrow(G, f, from, to, geo, mat, dur = 1.05) {
  const me = new THREE.Mesh(geo, mat); me.scale.setScalar(f.scale); me.position.copy(from); G.scene.add(me);
  const c = to.clone().setY(0.06); G.fx.ring(c, { normal: UP, r0: 2.6, r1: 2.3, life: dur, color: 0xff2a2a, op: 0.9 });
  let t = 0;
  return { done: false, owner: f, update(dt) {
    t += dt; const u = Math.min(1, t / dur); me.position.lerpVectors(from, c, u); me.position.y += Math.sin(u * Math.PI) * 5.5; me.rotation.x += dt * 6; me.rotation.z += dt * 4;
    if (Math.random() < 0.7) G.fx.p(me.position, { size: 0.6, size1: 0.2, life: 0.3, color: 0xff6a10, alpha: 0.6 });
    if (u >= 1) {
      sfx('boom'); G.shake(0.35); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 3.4, life: 0.5, color: 0xff6a10 }); G.fx.burst(c.clone().setY(0.5), 40, [0xff6a10, 0xffd070, 0x2a2020], 12, { dir: UP, spread: 1.2 }); G.fx.burst(c, 20, 0x3a2a2a, 6, { kind: 'dust', sk: 1.6 }); G.fx.light(c.clone().setY(1.2), 0xff6a10, 90, 0.4);
      areaHit(f, c, 2.4, { dmg: 88, kb: [6, 7], stun: 0.7, hs: 0.1, shake: 0.2, unblock: true, noCrit: true, st: BURN(3, 8) }, 1.4);
      G.spawn(lavaPool(G, f, c.x, c.z, 1.5, f.ignited ? 6 : 4)); this.kill();
    }
  }, kill() { this.done = true; G.scene.remove(me); } };
}
// 대지 진동: 바깥으로 퍼지는 충격파 — 땅에 서 있으면 맞는다 (점프로 넘는다)
function quakeWave(G, f, { speed = 8, r1 = 13, dmg = 55 } = {}) {
  const c = f.pos.clone().setY(0.06), hit = new Set(); let r = 1.2;
  G.fx.ring(c, { normal: UP, r0: r, r1, life: (r1 - r) / speed, color: 0xff5a10, op: 1 });
  return { done: false, owner: f, update(dt) {
    r += speed * dt;
    for (let i = 0; i < 14; i++) { const a = Math.random() * TAU; G.fx.p(new V3(c.x + Math.cos(a) * r, 0.15, c.z + Math.sin(a) * r), { vel: [0, rand(1.5, 3.5), 0], size: 0.16, size1: 0.04, life: 0.3, color: Math.random() < 0.5 ? 0xff5a10 : 0x5a4a44, alpha: 0.9, drag: 2 }); }
    for (const o of f.foes()) { if (hit.has(o)) continue; const d = Math.hypot(o.pos.x - c.x, o.pos.z - c.z); if (Math.abs(d - r) < 0.55 && o.pos.y < 0.4) { hit.add(o); o.takeHit(f, { dmg, kb: [5, 6], stun: 0.6, hs: 0.08, unblock: true, noCrit: true, st: BURN(2, 6) }); } }
    if (r >= r1) this.done = true;
  }, kill() { this.done = true; } };
}

/* =====================================================================
   1. 용암 임프 (잡몹)
   ===================================================================== */
const impPoses = posesOf(trainer.poses, {
  base: { hips: [0.1, -0.3, 0], spine: [0.35, 0.12, 0], chest: [0.2, 0.1, 0], neck: [-0.25, 0, 0], head: [-0.3, 0.1, 0], shoulderL: [-0.6, 0, 0.45], elbowL: [-1.1, 0, 0], shoulderR: [-0.7, 0, -0.45], elbowR: [-1.0, 0, 0], weapon: [0.8, 0, 0],
    hipL: [-0.7, 0, 0.14], kneeL: [1.1, 0, 0], footL: [-0.35, 0, 0], hipR: [-0.1, 0, -0.14], kneeR: [0.9, 0, 0], footR: [-0.5, 0, 0] },
  run: { spine: [0.55, 0, 0], neck: [-0.4, 0, 0], head: [-0.3, 0, 0], shoulderL: [0.5, 0, 0.5], shoulderR: [0.5, 0, -0.5], elbowL: [-0.4, 0, 0], elbowR: [-0.4, 0, 0] },
});
const grunt = {
  id: 'volcano_grunt', name: '용암 임프', short: '임프', title: '분화구의 졸개', enemy: true, scale: 0.72,
  stats: { hp: 240, speed: 5.2, jump: 9, daze: 70, breakTime: 3 }, palettes: [pal(0xff6a1a, 0x5a1a10, 0x2a0a06, { trim: 0x2a1a1a, band: '#2a0a04' })],
  skills: { s1: NOSK, s2: NOSK, ult: NOULT }, createModel: (p) => buildImp(p), poses: impPoses,
  moves: {
    light1: slow(T.light1, { k: 1.25, windup: 0.42, next: 'light2', dmg: 0.7, st: BURN(3, 6) }),
    light2: slow(T.light2, { k: 1.25, windup: 0.15, tele: null, dmg: 0.7, st: BURN(3, 6) }),
    // 날개 퍼덕여 뛰어올라 덮치며 할퀸다
    heavy: { ...slow(T.light3, { k: 1.2, windup: 0.55, dmg: 0.8, st: BURN(3, 6), ev: [[0.5, (f) => { f.vel.y = 6; f.onGround = false; sfx('jump'); }], [0.55 + 0.15 * 1.2, (f, o, G) => { sfx('zap'); G.fx.burst(f.chest(), 14, [0xff6a10, 0xffd070], 6); }]] }) },
  },
  ai: { range: 2.1, keep: 1.4, cdMin: 0.9, cdMax: 2, chain: 0.6, pick: (f, o, d) => (d < 2.6 ? (Math.random() < 0.65 ? 'light' : 'heavy') : null) },
};

/* =====================================================================
   2. 화염 술사 (원거리)
   ===================================================================== */
const mageBase = floatPoses(trainer.poses);
const magePoses = posesOf(mageBase, { base: { spine: [0.05, 0.1, 0], chest: [0, 0.1, 0], head: [0.05, -0.1, 0], shoulderR: [-0.45, 0, -0.18], elbowR: [-1.15, 0, 0], weapon: [0.05, 0, 0], shoulderL: [-0.3, 0, 0.25], elbowL: [-1.2, 0, 0] } });
const fireball = (f, o, G) => o && shot(f, o, G, { dmg: 40, color: 0xff7a2a, speed: 12, homing: 0.8, r: 0.36, st: BURN(4, 8) });
const archer = {
  id: 'volcano_archer', name: '화염 술사', short: '술사', title: '불꽃 교단', enemy: true, scale: 1,
  stats: { hp: 210, speed: 4.2, jump: 8, daze: 55, breakTime: 3 }, palettes: [pal(0xff8a2a, 0x3a1a14, 0x1a0806, { cloth: 0x5a1a10, trim: 0xd8a040, band: '#2a0a04' })],
  skills: { s1: { name: '화염구', cd: 2.2 }, s2: { name: '불기둥', cd: 8 }, ult: NOULT }, createModel: (p) => buildMage(p), poses: magePoses,
  moves: {
    light1: slow(T.light1, { k: 1.3, windup: 0.4, dmg: 0.6 }),
    s1: { ...slow(T.s1, { k: 1.4, windup: 0.5, ev: [[0.5 + 0.24 * 1.4, fireball]] }), cd: 's1', tick: undefined },
    // 지팡이를 높이 들어 상대 발밑에 불기둥 (바닥 표시 → 솟음, 빨강)
    s2: { dur: 1.5, cd: 's2', aim: true, track: 0.5, tele: [0.15, 'red'], keys: [[0, 'base'], [0.45, { shoulderR: [-2.7, 0, -0.2], elbowR: [-0.3, 0, 0], weapon: [0.3, 0, 0], spine: [-0.15, 0, 0], shoulderL: [-1.2, 0, 0.6], elbowL: [-0.4, 0, 0] }], [1.1, {}], [1.5, 'base']],
      ev: [[0.5, (f, o, G) => { if (!o) return; sfx('charge'); G.spawn(pillar(G, f, o.pos.x, o.pos.z, 0, { color: 0xff6a10, color2: 0xffd080, dmg: 55, r: 1.4, st: BURN(4, 8), warn: 1.0 })); }]] },
  },
  ai: { range: 11, keep: 7, cdMin: 1.0, cdMax: 2.2, pick: (f, o, d) => (d > 4 && f.cd.s2 <= 0 && Math.random() < 0.3 ? 's2' : d > 4 && f.cd.s1 <= 0 ? 's1' : d < 2.6 ? 'light' : null) },
};

/* =====================================================================
   3. 흑요석 골렘 (정예, 슈퍼아머)
   ===================================================================== */
const golemPoses = posesOf(trainer.poses, { base: { hips: [0, 0, 0], spine: [0.32, 0.12, 0], chest: [0.12, 0.1, 0], head: [-0.3, 0, 0], shoulderL: [0.05, 0, 0.32], shoulderR: [0.1, 0, -0.32], elbowL: [-0.3, 0, 0], elbowR: [-0.4, 0, 0], hipL: [-0.25, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.1, 0, -0.1], kneeR: [0.3, 0, 0] } });
const brute = {
  id: 'volcano_brute', name: '흑요석 골렘', short: '흑요석', title: '용암의 핵', enemy: true, scale: 1.5,
  stats: { hp: 950, speed: 3.4, jump: 7, daze: 150, armor: true, breakTime: 4 }, palettes: [pal(0xff5a10, 0x1a1418, 0x0a0808, { band: '#2a0804' })],
  skills: { s1: NOSK, s2: { name: '용암 분출', cd: 6 }, ult: NOULT }, createModel: (p) => buildGolem(p), poses: golemPoses,
  moves: {
    light1: slow(T.light2, { k: 1.5, windup: 0.6, dmg: 1.5, st: BURN(4, 10), ev: [[0.6 + 0.09 * 1.5, chop]] }),
    // 두 주먹으로 땅을 내리쳐 용암을 분출시키고, 주변에 용암 웅덩이를 남긴다
    s2: { ...slow(T.s2, { k: 1.2, windup: 0.7, tele: 'red', ev: [[0.7 + 0.1 * 1.2, (f) => { f.vel.y = 5; f.onGround = false; }], [0.7 + 0.55 * 1.2, (f, o, G) => {
      slam(f, G, 4.5, 110, 0xff5a10, BURN(4, 10)); const c = f.local([0, 0, 1.2 * f.scale]);
      for (let i = 0; i < 3; i++) { const a = f.yaw + (i - 1) * 0.9; G.spawn(lavaPool(G, f, c.x + Math.sin(a) * 2.2, c.z + Math.cos(a) * 2.2, 1.0, 3.5)); } }]] }), cd: 's2' },
  },
  ai: { range: 2.9, keep: 2, cdMin: 1.6, cdMax: 3, pick: (f, o, d) => (d < 3.4 ? (f.cd.s2 <= 0 && Math.random() < 0.45 ? 's2' : 'light') : null) },
};

/* =====================================================================
   4. 보스 화염 거인 수르트
   ===================================================================== */
const SC = 1.95;
const surtPoses = posesOf(trainer.poses, {
  base: { hips: [0, -0.3, 0], spine: [0.08, 0.1, 0], chest: [0.06, 0.12, 0], neck: [0.05, 0, 0], head: [-0.05, 0.1, 0], shoulderR: [-0.55, 0, -0.3], elbowR: [-0.85, 0, 0], weapon: [1.05, 0, 0], shoulderL: [-0.15, 0, 0.42], elbowL: [-0.5, 0, 0],
    hipL: [-0.35, 0, 0.16], kneeL: [0.45, 0, 0], footL: [-0.1, 0, 0], hipR: [0.25, 0, -0.16], kneeR: [0.35, 0, 0], footR: [0, 0, 0] },
  run: { spine: [0.15, 0, 0], shoulderR: [0.1, 0, -0.35], elbowR: [-0.7, 0, 0], weapon: [1.6, 0, 0], shoulderL: [0.1, 0, 0.35], elbowL: [-0.4, 0, 0] },
});
const surtBurn = BURN(3, 8);
// 점화 상태에서 휘두르면 앞쪽 반원에 용암 웅덩이가 남는다
const trailPools = (f, G, side = 1) => { if (!f.ignited) return; for (let i = 0; i < 3; i++) { const x = side * (-1.6 + i * 1.6), p = f.local([x, 0, 2.7 + (i === 1 ? 0.5 : 0)]); G.spawn(lavaPool(G, f, p.x, p.z, 1.0, 4.5)); } };
const flameFx = (f, G) => G.fx.burst(f.model.J.weapon.localToWorld(new V3(0, 0, 1.2)), 20, [0xff6a10, 0xffd070], 6);
// 큰 대검 휘두르기 (예비 동작 길다 · 노랑)
const sweep1 = slow(T.light1, { k: 1.5, windup: 0.78, next: 'light2', dmg: 1.7, st: surtBurn, ev: [[0.78 + 0.08 * 1.5, (f, o, G) => { swish(f); flameFx(f, G); }], [0.78 + 0.15 * 1.5, (f, o, G) => trailPools(f, G, 1)]] });
const sweep2 = slow(T.light2, { k: 1.45, windup: 0.4, next: 'light3', dmg: 1.7, st: surtBurn, ev: [[0.4 + 0.09 * 1.45, (f, o, G) => { chop(f); flameFx(f, G); }], [0.4 + 0.17 * 1.45, (f, o, G) => trailPools(f, G, -1)]] });
// 균열 내려찍기: 대검을 땅에 꽂으면 앞으로 금이 가고 늦게 용암이 솟는다
const crackT = 0.7 + 0.16 * 1.4;
const crack = slow(T.light2, { k: 1.4, windup: 0.7, tele: 'yellow', dmg: 1.5, st: surtBurn, ev: [[0.7 + 0.09 * 1.4, chop], [crackT, (f, o, G) => {
  const fw = f.fwd(new V3()); sfx('boom'); G.shake(0.3); G.fx.burst(f.local([0, 0.2, 2.6]), 30, [0xff6a10, 0x3a2a2a], 8, { dir: UP, spread: 1 });
  const hit = new Set(); G.spawn(crackLine(G, f, f.pos.clone(), fw, { pools: !!f.ignited, hit }));
  if (f.enraged) for (const a of [-0.5, 0.5]) G.spawn(crackLine(G, f, f.pos.clone(), fw.clone().applyAxisAngle(UP, a), { n: 7, delay: 0.95, hit }));
}]] });
crack.dur += 0.3;
const surtMoves = {
  light1: sweep1, light2: sweep2, light3: crack,
  crack: { ...crack, cd: 'crack' },
  // 대지 진동: 왼발을 높이 들었다 구르면 충격파가 퍼진다 (빨강 · 점프로 넘는다)
  heavy: { dur: 1.7, cd: 'heavy', aim: true, track: 0.5, noMove: true, tele: [0.2, 'red'],
    keys: [[0, 'base'], [0.7, { spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], hipL: [-1.35, 0, 0.2], kneeL: [1.3, 0, 0], footL: [0.3, 0, 0], hipR: [0.1, 0, -0.16], kneeR: [0.3, 0, 0], shoulderL: [-0.6, 0, 1.0], elbowL: [-0.5, 0, 0], shoulderR: [-0.3, 0, -0.8] }],
      [0.85, { spine: [0.35, 0, 0], chest: [0.15, 0, 0], hipL: [-0.5, 0, 0.2], kneeL: [0.7, 0, 0], footL: [-0.2, 0, 0], hipR: [0.35, 0, -0.16], kneeR: [0.6, 0, 0], hipY: -0.12 }], [1.25, {}], [1.7, 'base']],
    ev: [[0.84, (f, o, G) => { sfx('boom'); G.shake(0.45); G.flash(0xff6a10, 0.15); const c = f.pos.clone().setY(0.06); G.fx.burst(c, 30, 0x4a3a34, 7, { kind: 'dust', sk: 2 }); G.fx.light(c.clone().setY(1), 0xff5a10, 90, 0.4);
      areaHit(f, c, 2.6, { dmg: 40, kb: [7, 5], stun: 0.5, unblock: true, noCrit: true }, 0.8);
      G.spawn(quakeWave(G, f, { dmg: 55 })); if (f.enraged) G.spawn({ done: false, t: 0, owner: f, update(dt) { this.t += dt; if (this.t > 0.6) { G.spawn(quakeWave(G, f, { dmg: 50, speed: 9 })); this.done = true; } }, kill() { this.done = true; } }); }]] },
  // 바위 투척: 땅에서 바위를 뜯어 들어 올려 상대 자리로 던진다 (빨강 표시)
  s1: { dur: 1.95, cd: 's1', aim: true, track: 1.2, noMove: true, tele: [0.95, 'red'],
    keys: [[0, 'base'], [0.5, { hipY: -0.22, spine: [0.75, 0.3, 0], chest: [0.2, 0.2, 0], shoulderL: [-1.0, 0, 0.25], elbowL: [-0.2, 0, 0], hipL: [-1.0, 0, 0.2], kneeL: [1.3, 0, 0], hipR: [-0.2, 0, -0.2], kneeR: [1.0, 0, 0] }], [0.62, {}],
      [1.05, { hipY: 0, spine: [-0.25, -0.3, 0], chest: [-0.1, -0.3, 0], shoulderL: [-3.0, 0, 0.25], elbowL: [-0.5, 0, 0], hipL: [-0.35, 0, 0.16], kneeL: [0.45, 0, 0], hipR: [0.3, 0, -0.16], kneeR: [0.35, 0, 0] }], [1.22, {}],
      [1.4, { spine: [0.45, 0.4, 0], chest: [0.2, 0.3, 0], shoulderL: [-1.3, 0, 0.1], elbowL: [-0.1, 0, 0] }], [1.95, 'base']],
    ev: [[0.55, (f, o, G) => { f.model.boulder.visible = true; sfx('heavy'); G.shake(0.2); G.fx.burst(f.local([0.6, 0.1, 1.2]), 26, 0x4a3a34, 6, { kind: 'dust', sk: 1.6 }); G.fx.burst(f.local([0.6, 0.2, 1.2]), 16, [0xff6a10, 0xffd070], 6, { dir: UP }); }],
      [1.32, (f, o, G) => { const m = f.model; m.boulder.visible = false; const from = m.boulder.getWorldPosition(new V3());
        const to = o ? o.pos.clone().addScaledVector(o.vel.clone().setY(0), 0.35) : f.local([0, 0, 9]); sfx('swing');
        G.spawn(boulderThrow(G, f, from, to, m.boulder.geometry, m.boulder.material)); }]],
    end: (f) => { f.model.boulder.visible = false; } },
  // 열기 폭발: 대검을 꽂고 몸을 달궈 주변을 태운다 (빨강 · 붙어 있으면 위험)
  s2: { dur: 1.9, cd: 's2', aim: true, track: 0.3, noMove: true, tele: [0.25, 'red'],
    keys: [[0, 'base'], [0.5, { hipY: -0.1, spine: [0.3, 0, 0], shoulderR: [-1.0, 0, -0.2], elbowR: [-0.3, 0, 0], weapon: [1.9, 0, 0], shoulderL: [-0.4, 0, 0.9], elbowL: [-1.2, 0, 0], hipL: [-0.6, 0, 0.3], kneeL: [0.8, 0, 0], hipR: [0.2, 0, -0.3], kneeR: [0.7, 0, 0] }],
      [1.1, { spine: [0.1, 0, 0], chest: [-0.2, 0, 0], head: [-0.4, 0, 0], shoulderL: [-0.2, 0, 1.4], elbowL: [-0.3, 0, 0] }], [1.3, { chest: [-0.35, 0, 0], shoulderL: [0.1, 0, 1.6] }], [1.9, 'base']],
    tick: (f, o, G, t) => { if (t > 0.4 && t < 1.15 && Math.random() < 0.8) { const a = Math.random() * TAU, R = 4.8; G.fx.p(new V3(f.pos.x + Math.cos(a) * R, 0.1, f.pos.z + Math.sin(a) * R), { vel: [0, 2, 0], size: 0.2, size1: 0.05, life: 0.3, color: 0xff2a10 }); G.fx.p(f.chest().add(new V3(rand(-1, 1), rand(0, 1.5), rand(-1, 1))), { vel: [0, 1, 0], size: 0.4, size1: 0.1, life: 0.3, color: 0xff7a20, alpha: 0.6 }); } },
    ev: [[1.15, (f, o, G) => { const c = f.pos.clone().setY(0.06); sfx('boom'); G.shake(0.5); G.flash(0xff6a10, 0.3);
      G.fx.ring(c, { normal: UP, r0: 0.5, r1: 5.4, life: 0.5, color: 0xff6a10 }); G.fx.ring(c.clone().setY(1.2), { normal: UP, r0: 0.3, r1: 4.5, life: 0.4, color: 0xffd070 });
      G.fx.burst(c.clone().setY(1.5), 60, [0xff5a10, 0xffd070, 0xffffff], 14); G.fx.light(c.clone().setY(2), 0xff6a10, 120, 0.5);
      areaHit(f, c, 4.8, { dmg: 95, kb: [9, 6], stun: 0.7, hs: 0.1, shake: 0.2, unblock: true, noCrit: true, st: BURN(4, 10) }, 2.5); }]] },
  // 2페이즈 시작: 대검 점화 — 이후 휘두를 때마다 용암 웅덩이가 남고, 열기 오라가 넓어진다
  ignite: { dur: 2.1, aim: true, noMove: true, tele: [0.2, 'red'],
    keys: [[0, 'base'], [0.7, { spine: [-0.2, 0, 0], chest: [-0.15, 0, 0], head: [-0.35, 0, 0], shoulderR: [-3.0, 0, -0.15], elbowR: [-0.2, 0, 0], weapon: [0.0, 0, 0], shoulderL: [-0.4, 0, 1.2], elbowL: [-0.6, 0, 0] }], [1.5, {}], [2.1, 'base']],
    tick: (f, o, G, t) => { if (t < 0.95) for (let i = 0; i < 2; i++) G.fx.p(f.model.J.weapon.localToWorld(new V3(rand(-0.1, 0.1), rand(-0.1, 0.1), rand(0.2, 1.75))), { vel: [0, 2, 0], size: 0.3, size1: 0.05, life: 0.4, color: 0xffa040 }); },
    ev: [[0.95, (f, o, G) => { f.ignited = true; sfx('ult'); G.shake(0.5); G.flash(0xff8a30, 0.45); G.setTint(0xff5a10, 0.35, 1.2);
      const c = f.pos.clone().setY(0.06); G.fx.ring(c, { normal: UP, r0: 0.5, r1: 6, life: 0.6, color: 0xff6a10 }); G.fx.beam(c, { r: 1.2 * f.scale, h: 16, color: 0xff6a10, life: 0.8 }); G.fx.burst(f.chest(), 60, [0xff6a10, 0xffd070], 12);
      areaHit(f, c, 3.6, { dmg: 30, kb: [10, 5], stun: 0.5, unblock: true, noCrit: true, st: BURN(3, 8) }, 2); }]] },
  // 2페이즈: 종말의 유성우 — 대검을 하늘로 치켜들면 아레나 곳곳에 유성이 떨어진다 (처음 넷은 상대를 쫓아온다)
  meteor: { dur: 2.3, cd: 'meteor', aim: true, track: 0.4, noMove: true, tele: [0.2, 'red'],
    keys: [[0, 'base'], [0.55, { spine: [-0.3, 0, 0], chest: [-0.2, 0, 0], head: [-0.6, 0, 0], shoulderR: [-3.05, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [-0.1, 0, 0], shoulderL: [-2.6, 0, 0.5], elbowL: [-0.4, 0, 0] }], [1.8, {}], [2.3, 'base']],
    ev: [[0.6, (f, o, G) => { if (!o) return; sfx('charge'); G.flash(0xff6a10, 0.2);
      const tgt = { pos: o.pos }; for (let i = 0; i < 4; i++) G.spawn({ done: false, t: 0, owner: f, update(dt) { this.t += dt; if (this.t >= i * 0.4) { G.spawn(pillar(G, f, tgt.pos.x + rand(-0.6, 0.6), tgt.pos.z + rand(-0.6, 0.6), 0, { color: 0xff5a10, color2: 0xffd080, style: 'fall', dmg: 72, r: 1.8, st: BURN(4, 10), warn: 1.0 })); this.done = true; } }, kill() { this.done = true; } });
      for (let i = 0; i < 9; i++) { const a = rand(0, TAU), R = rand(3, 15); G.spawn(pillar(G, f, Math.cos(a) * R, Math.sin(a) * R, 0.2 + i * 0.18, { color: 0xff5a10, color2: 0xffd080, style: 'fall', dmg: 72, r: 1.8, st: BURN(4, 10), warn: 1.1 })); } }]] },
  // 거인의 걸음: 땅을 울리며 천천히 다가온다 (공격 아님 — AI 접근용)
  stride: { dur: 0.95, aim: true, track: 0.9, keys: [[0, 'base'], [0.3, { hipL: [-0.9, 0, 0.16], kneeL: [0.9, 0, 0], spine: [0.15, 0, 0] }], [0.6, { hipL: [-0.2, 0, 0.16], kneeL: [0.3, 0, 0], hipR: [0.5, 0, -0.16] }], [0.95, 'base']],
    lunge: [[0.15, 0.7, 3.8]], start: (f) => { if (f.ctrl && 'cool' in f.ctrl) f.ctrl.cool = 0.12; },
    ev: [[0.62, (f, o, G) => { sfx('land'); G.shake(0.12); G.fx.burst(f.local([0.25, 0.05, 0.4]), 10, 0x4a3a34, 3, { kind: 'dust', sk: 1.3 }); }]] },
};
const boss = {
  id: 'volcano_boss', name: '화염 거인 수르트', short: '수르트', title: '분화구의 왕', enemy: true, boss: true, scale: SC,
  stats: { hp: 4300, speed: 3.5, jump: 7, daze: 380, armor: true, breakTime: 5 }, palettes: [pal(0xff4a10, 0x2a1410, 0x140806, { trim: 0xff8a2a, cloth: 0x3a0a06, band: '#2a0604' })],
  skills: { s1: { name: '바위 투척', cd: 7 }, s2: { name: '열기 폭발', cd: 9 }, heavy: { name: '대지 진동', cd: 6 }, crack: { name: '용암 균열', cd: 5 }, meteor: { name: '종말의 유성우', cd: 11 }, ult: NOULT },
  createModel: (p) => {
    const m = buildSurt(p, SC), up = m.update;
    // 열기 오라: 가까이 있는 상대에게 계속 화상 (2페이즈에 넓어지고 세짐)
    m.update = (dt, f) => { up(dt, f); const G = f.G; if (G.state !== 'fight' || f.state === 'ko') return; f.auraT = (f.auraT || 0) - dt; if (f.auraT > 0) return; f.auraT = 1;
      const R = f.ignited ? 4.2 : 3.2; for (const o of f.foes()) if (Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z) < R && o.pos.y < 1.5) o.addStatus('burn', 1.3, f.ignited ? 11 : 6, f); };
    return m;
  },
  onReset: (f) => { f.ignited = false; f.auraT = 0; },
  poses: surtPoses, moves: surtMoves,
  ai: { range: 9.5, keep: 2.6, cdMin: 1.3, cdMax: 2.4, chain: 0.45,
    pick: (f, o, d) => {
      const R = Math.random();
      if (f.enraged && !f.ignited) return 'ignite';
      if (f.enraged && f.cd.meteor <= 0 && R < 0.4) return 'meteor';
      if (d > 6.5) return f.cd.s1 <= 0 && R < 0.55 ? 's1' : 'stride';
      if (d < 3.4 && f.cd.s2 <= 0 && R < 0.35) return 's2';
      if (d < 7.5 && f.cd.heavy <= 0 && R < 0.5) return 'heavy';
      if (d < 4.8) return R < 0.6 || f.cd.crack > 0 ? 'light' : 'crack';
      return f.cd.s1 <= 0 && R < 0.3 ? 's1' : 'stride';
    } },
};

export default { grunt, archer, brute, boss };
