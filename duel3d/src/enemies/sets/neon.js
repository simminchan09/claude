// 9. 네온 시티 옥상 — 사이버 깡패 · 저격 드론 · 중장갑 메크 · 메가 메크 오버클럭
// 모델은 neon_model.js. 보스 오버클럭: 중거리에서 견제하는 메크 — 아레나를 쓸어 가는 바닥 레이저(점프/회피) · 바닥 표시 미사일 일제 사격 ·
// 로켓 부스트 돌진 · 뛰어올라 덮치는 충격 착지 · 지원 드론 전개 · 큰 기술을 쓸수록 쌓이는 열 → 과열되면 냉각판을 열고 멈춰 약점 노출(받는 피해 ×1.6)
// 2페이즈: 실드 발생기를 세우고 실드 돔(받는 피해 ×0.25) — 발생기를 부수면 실드가 꺼지고 폭주(빨라짐 · 연속 돌진 · 왕복 레이저 · 미사일 증가)
import * as THREE from 'three';
import { slow, swish, slam, shot, pillar } from '../kit.js';
import { floatPoses } from '../bodies.js';
import { EnemyAI } from '../../ai.js';
import { areaHit } from '../../entities.js';
import { rand, sfx } from '../../core.js';
import trainer from '../../characters/trainer.js';
import { buildThug, buildDrone, buildMech, buildOverclock, buildPylon } from './neon_model.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0), TAU = Math.PI * 2, T = trainer.moves;
const pal = (accent, armor, body, o = {}) => ({ accent, armor, body, ...o });
const NOSK = { name: '-', cd: 1 }, NOULT = { name: '-', sub: '' };
function posesOf(src, over) { const o = {}; for (const k in src) o[k] = { ...src[k] }; for (const k in over) o[k] = { ...(o[k] || {}), ...over[k] }; return o; }
const VULN = (s = 2, k = 1.1) => ['vuln', s, k];

/* =====================================================================
   1. 사이버 깡패 (잡몹)
   ===================================================================== */
const thugPoses = posesOf(trainer.poses, { base: { spine: [0.15, 0.15, 0], head: [-0.05, 0.15, 0], shoulderL: [-0.25, 0, 0.35], elbowL: [-1.4, 0, 0] } });
const grunt = {
  id: 'neon_grunt', name: '사이버 깡패', short: '깡패', title: '옥상 갱단', enemy: true, scale: 1,
  stats: { hp: 270, speed: 4.8, jump: 8, daze: 70, breakTime: 3 }, palettes: [pal(0xff2ad8, 0x2a2a3a, 0x14141c, { trim: 0x2affff, band: '#1a0420' })],
  skills: { s1: NOSK, s2: NOSK, ult: NOULT }, createModel: (p) => buildThug(p), poses: thugPoses,
  moves: {
    light1: slow(T.light1, { k: 1.25, windup: 0.42, next: 'light2', dmg: 0.7, st: VULN(2, 1.1) }),
    light2: slow(T.light2, { k: 1.25, windup: 0.15, tele: null, dmg: 0.7, st: VULN(2, 1.1) }),
    // 네온 마체테 돌진 베기
    heavy: slow(T.light3, { k: 1.15, windup: 0.6, dmg: 0.85, st: VULN(2, 1.1), ev: [[0.6 + 0.13 * 1.15, (f, o, G) => { sfx('zap'); G.fx.burst(f.chest(), 14, [0xff2ad8, 0x2affff], 6); }]] }),
  },
  ai: { range: 2.1, keep: 1.4, cdMin: 0.9, cdMax: 2, chain: 0.6, pick: (f, o, d) => (d < 2.6 ? (Math.random() < 0.65 ? 'light' : 'heavy') : null) },
};

/* =====================================================================
   2. 저격 드론 (원거리) — 조준 레이저로 겨눈 뒤 레일건 한 발
   ===================================================================== */
const dronePoses = floatPoses(trainer.poses);
const droneDef = (o = {}) => ({
  id: o.id || 'neon_archer', name: o.name || '저격 드론', short: o.short || '드론', title: '보안 시스템', enemy: true, scale: 1,
  stats: { hp: o.hp ?? 210, speed: 4.4, jump: 8, daze: 55, breakTime: 3 }, palettes: [pal(0x2affff, 0x3a3a4a, 0x1a1a24, { trim: 0xff2ad8, band: '#04202a' })],
  skills: { s1: { name: '레일건 저격', cd: o.cd ?? 2.4 }, s2: NOSK, ult: NOULT }, createModel: (p) => buildDrone(p, { k: o.k ?? 1 }), poses: dronePoses,
  moves: {
    // 몸통 박치기 (전기 방전)
    light1: { dur: 0.95, aim: true, track: 0.35, tele: [0.12, 'yellow'], keys: [[0, 'base'], [0.95, 'base']], lunge: [[0.4, 0.6, 9]],
      ev: [[0.42, (f, o, G) => { sfx('zap'); G.fx.burst(f.local([0, 1.5, 0.5]), 14, [0x2affff, 0xffffff], 6); }]],
      hits: [{ t0: 0.42, t1: 0.62, at: [0, 1.45, 0.6], r: 0.6, dmg: 24, kb: [3, 1], stun: 0.35, hs: 0.06, noCrit: true, st: VULN(2, 1.1) }] },
    // 레일건: 붉은 조준선이 상대를 따라가다 고정되고 한 발 (노랑 · 막기 가능)
    s1: { dur: 1.45, cd: 's1', aim: true, track: 0.82, fireT: 0.95, tele: [0.4, 'yellow'], noMove: true, keys: [[0, 'base'], [1.45, 'base']],
      ev: [[0.05, () => sfx('charge')], [0.95, (f, o, G) => { if (!o) return; shot(f, o, G, { dmg: 44, color: 0x4affff, speed: 30, homing: 0.08, r: 0.2, st: VULN(3, 1.12) }); G.fx.burst(f.model.tipPos(new V3()), 12, [0x4affff, 0xffffff], 7); G.fx.light(f.model.tipPos(new V3()), 0x4affff, 40, 0.15); }]] },
  },
  ai: { range: 12, keep: 7.5, cdMin: 1.0, cdMax: 2.2, pick: (f, o, d) => (d > 3.5 && f.cd.s1 <= 0 ? 's1' : d < 2.4 ? 'light' : null) },
});
const archer = droneDef();
// 오버클럭이 전개하는 소형 지원 드론
const SUPPORT = droneDef({ id: 'neon_support', name: '지원 드론', short: '지원기', hp: 120, k: 0.75, cd: 3.2 });

/* =====================================================================
   3. 중장갑 메크 (정예, 슈퍼아머) — 파일 드라이버
   ===================================================================== */
const golemPoses = posesOf(trainer.poses, { base: { hips: [0, 0, 0], spine: [0.22, 0.1, 0], chest: [0.1, 0.1, 0], head: [-0.2, 0, 0], shoulderL: [-0.2, 0, 0.3], shoulderR: [-0.1, 0, -0.3], elbowL: [-0.9, 0, 0], elbowR: [-0.6, 0, 0], hipL: [-0.25, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.1, 0, -0.1], kneeR: [0.3, 0, 0] } });
const pileT = 0.65 + 0.15 * 1.4;
const brute = {
  id: 'neon_brute', name: '중장갑 메크', short: '메크', title: '진압용 기체', enemy: true, scale: 1.5,
  stats: { hp: 950, speed: 3.4, jump: 7, daze: 150, armor: true, breakTime: 4 }, palettes: [pal(0xffd02a, 0x4a4a5a, 0x2a2a34, { trim: 0xffd02a, band: '#2a2004' })],
  skills: { s1: NOSK, s2: { name: '충격 착지', cd: 6 }, ult: NOULT }, createModel: (p) => buildMech(p), poses: golemPoses,
  moves: {
    // 파일 드라이버: 팔을 뻗어 찌르는 순간 말뚝이 튀어나간다
    light1: { ...slow(T.light3, { k: 1.4, windup: 0.65, dmg: 1.35, ev: [[pileT, (f, o, G) => { sfx('boom'); G.shake(0.2); const p = f.model.tipPos(new V3()); G.fx.burst(p, 24, [0xffd02a, 0xffffff], 9, { dir: f.fwd(new V3()), spread: 0.5 }); G.fx.burst(p, 10, 0x8a8a96, 3, { kind: 'smoke' }); }]] }), pileT },
    s2: { ...slow(T.s2, { k: 1.2, windup: 0.7, tele: 'red', ev: [[0.7 + 0.1 * 1.2, (f) => { f.vel.y = 5; f.onGround = false; }], [0.7 + 0.55 * 1.2, (f, o, G) => slam(f, G, 4.5, 110, 0xffd02a)]] }), cd: 's2' },
  },
  ai: { range: 2.9, keep: 2, cdMin: 1.6, cdMax: 3, pick: (f, o, d) => (d < 3.4 ? (f.cd.s2 <= 0 && Math.random() < 0.45 ? 's2' : 'light') : null) },
};

/* =====================================================================
   4. 보스 메가 메크 오버클럭
   ===================================================================== */
const SC = 1.9, PINK = 0xff2a6a, CYAN = 0x2affff;
const addHeat = (f, n) => { f.ocHeat = Math.min(100, (f.ocHeat || 0) + n * (f.berserk ? 1.25 : 1)); };
const heatEv = (t, n) => [t, (f) => addHeat(f, n)];
// 바닥 레이저 소인: 캐논을 낮게 겨누고 몸을 돌려 아레나를 쓸어 간다 — 땅에 서 있으면 맞는다 (점프 · 회피)
function laserSweep(G, f, mv, { a0, a1, dur, back }) {
  const coreM = new THREE.MeshBasicMaterial({ color: 0xffe0f0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const haloM = new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const geo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); geo.translate(0, 0.5, 0);
  const parts = []; for (const [mat, r] of [[coreM, 0.07], [haloM, 0.22], [coreM, 0.06], [haloM, 0.2]]) { const me = new THREE.Mesh(geo, mat); me.userData.r = r; me.frustumCulled = false; me.renderOrder = 12; G.scene.add(me); parts.push(me); }
  const yaw0 = f.yaw, hit = new Set(), A = new V3(), B = new V3(), Cg = new V3(), q = new THREE.Quaternion(), dir = new V3(); let t = 0, pass = 0;
  const place = (me, from, to) => { dir.subVectors(to, from); const L = dir.length(); me.position.copy(from); me.quaternion.setFromUnitVectors(UP, dir.normalize()); me.scale.set(me.userData.r, L, me.userData.r); };
  return { done: false, owner: f, update(dt) {
    if (f.act !== mv || f.state !== 'act') return this.kill();
    t += dt; let u = Math.min(1, t / dur);
    if (u >= 1 && back && pass === 0) { pass = 1; t = 0; u = 0; hit.clear(); }
    const ease = u * u * (3 - 2 * u), a = pass === 0 ? a0 + (a1 - a0) * ease : a1 + (a0 - a1) * ease;
    f.yaw = yaw0 + a; f.root.rotation.y = f.yaw;
    f.model.tipPos(A); const fw = f.fwd(new V3()); Cg.copy(f.pos).addScaledVector(fw, 2.6 * f.scale * 0.55).setY(0.45); B.copy(f.pos).addScaledVector(fw, 19).setY(0.45);
    place(parts[0], A, Cg); place(parts[1], A, Cg); place(parts[2], Cg, B); place(parts[3], Cg, B);
    haloM.opacity = 0.45 + 0.2 * Math.sin(G.time * 50);
    // 바닥 불꽃 · 긁힌 자국
    for (let i = 0; i < 4; i++) { const p = Cg.clone().lerp(B, Math.random()); p.y = 0.1; G.fx.p(p, { vel: [rand(-1, 1), rand(1, 3), rand(-1, 1)], size: 0.14, size1: 0.02, life: 0.3, color: Math.random() < 0.5 ? PINK : 0xffffff, drag: 2, grav: 6 }); }
    G.fx.p(Cg, { size: 0.9, size1: 0.3, life: 0.1, color: 0xffd0e8 });
    // 판정: 레이저 선(가까운 쪽 1.2m ~ 19m)의 옆 거리 0.65 이내 · 땅 가까이 (점프하면 넘는다)
    for (const o of f.foes()) { if (hit.has(o)) continue; const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, along = dx * fw.x + dz * fw.z, side = Math.abs(dx * fw.z - dz * fw.x);
      if (along > 1.2 && along < 19 && side < 0.55 + 0.25 * o.scale && o.pos.y < 0.55) { hit.add(o); o.takeHit(f, { dmg: 70, kb: [5, 6], stun: 0.6, hs: 0.08, unblock: true, noCrit: true, st: VULN(3, 1.15) }, new V3(fw.z, 0, -fw.x).multiplyScalar(a1 > a0 ? -1 : 1)); } }
    if (u >= 1 && (!back || pass === 1)) this.kill();
  }, kill() { if (this.done) return; this.done = true; for (const me of parts) G.scene.remove(me); geo.dispose(); coreM.dispose(); haloM.dispose(); } };
}
// 미사일 발사 연출 (포드에서 솟아올라 사라짐) — 실제 피해는 바닥 표시 뒤 떨어지는 기둥
const missileGeo = new THREE.ConeGeometry(0.07, 0.4, 8);
function missileFx(G, f, from) {
  const me = new THREE.Mesh(missileGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })); me.position.copy(from); G.scene.add(me); const v = new V3(rand(-2, 2), rand(14, 18), rand(-2, 2)); let t = 0;
  return { done: false, owner: f, update(dt) { t += dt; me.position.addScaledVector(v, dt); me.quaternion.setFromUnitVectors(UP, v.clone().normalize()); G.fx.p(me.position, { vel: [0, -2, 0], size: 0.3, size1: 0.6, life: 0.4, color: 0xaaaab8, alpha: 0.4, smoke: true }); G.fx.p(me.position, { size: 0.25, size1: 0.05, life: 0.12, color: 0xffa060 }); if (t > 0.9) this.kill(); },
    kill() { this.done = true; G.scene.remove(me); me.material.dispose(); } };
}
// 지원 드론 · 실드 발생기 소환 (진짜 적 파이터로 — 공격해서 부술 수 있다)
function summon(G, f, def, pos, ctrl) {
  const W = G.stage && G.stage.world; if (W) for (let k = 0; k < 3; k++) W.push(pos, 0.6);
  const F = f.constructor, a = new F(def, 1, ctrl || new EnemyAI(), G, def.palettes[0]); a.reset(pos); a.opp = f.opp; a.faceOpp(); a.inv = 0.6; a.ai = a.ctrl; a.summoner = f;
  G.fighters.push(a); (f.adds || (f.adds = [])).push(a); G.hud && G.hud.setWave && G.hud.setWave(G);
  const c = pos.clone().setY(0.05); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 2.2, life: 0.6, color: def.palettes[0].accent }); G.fx.burst(c.clone().setY(1.2), 24, [def.palettes[0].accent, 0xffffff], 6); sfx('spawn');
  return a;
}
const PYLON = {
  id: 'neon_pylon', name: '실드 발생기', short: '발생기', title: '오버클럭 실드', enemy: true, scale: 1.25,
  stats: { hp: 650, speed: 0, jump: 0, daze: 0, armor: true, breakTime: 1 }, palettes: [pal(CYAN, 0x3a3a4a, 0x1a1a24, { band: '#04202a' })],
  skills: { s1: NOSK, s2: NOSK, ult: NOULT }, createModel: (p) => buildPylon(p), poses: dronePoses, moves: {},
  ai: { range: 0, keep: 0, cdMin: 9, cdMax: 9, pick: () => null },
};
const STILL = { human: false, read: () => ({ mx: 0, mz: 0, guard: false, jumpP: false, press: null }) };

const ocPoses = posesOf(trainer.poses, {
  base: { hips: [0, -0.25, 0], spine: [0.08, 0.1, 0], chest: [0.04, 0.1, 0], head: [-0.05, 0.1, 0], shoulderR: [-0.45, 0, -0.3], elbowR: [-0.9, 0, 0], weapon: [1.75, 0, 0.0], shoulderL: [-0.35, 0, 0.4], elbowL: [-0.9, 0, 0],
    hipL: [-0.4, 0, 0.14], kneeL: [0.6, 0, 0], footL: [-0.15, 0, 0], hipR: [0.2, 0, -0.14], kneeR: [0.5, 0, 0], footR: [-0.05, 0, 0] },
});
const aimL = { shoulderL: [-1.5, 0, 0.12], elbowL: [-0.05, 0, 0], chest: [0.05, 0.25, 0], spine: [0.1, 0.1, 0], hipY: -0.06, hipL: [-0.6, 0, 0.2], kneeL: [0.8, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.6, 0, 0] };
const ocMoves = {
  // 플라즈마 블레이드 3연격 (노랑)
  light1: { ...slow(T.light1, { k: 1.15, windup: 0.46, next: 'light2', dmg: 1.55, st: VULN(2, 1.1), ev: [[0.46 + 0.08 * 1.15, swish], heatEv(0.7, 7)] }) },
  light2: { ...slow(T.light2, { k: 1.15, windup: 0.18, tele: null, next: 'light3', dmg: 1.55, st: VULN(2, 1.1), ev: [[0.18 + 0.09 * 1.15, swish], heatEv(0.5, 7)] }) },
  light3: { ...slow(T.light3, { k: 1.1, windup: 0.36, dmg: 1.5, st: VULN(2, 1.1), ev: [[0.36 + 0.13 * 1.1, (f, o, G) => { f.boostT = 0.3; sfx('dash'); G.fx.burst(f.chest(), 16, [PINK, 0xffffff], 7); }], heatEv(0.8, 8)] }) },
  // 레이저 소인 (빨강): 충전 1초 → 좌에서 우로 아레나를 쓸고, 폭주 중에는 되돌아온다
  laser: { dur: 3.2, cd: 'laser', aim: true, track: 0.85, noMove: true, tele: [0.2, 'red'],
    keys: [[0, 'base'], [0.6, aimL], [3.0, aimL], [3.2, 'base']],
    tick: (f, o, G, t) => { if (t < 1.0) { const fw = f.fwd(new V3()), side = new V3(fw.z, 0, -fw.x), a = -1.05, dir = fw.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, -Math.sin(a));
      for (let i = 0; i < 3; i++) { const d = rand(1.5, 16); G.fx.p(f.pos.clone().addScaledVector(dir, d).setY(0.08), { size: 0.25, size1: 0.1, life: 0.2, color: 0xff2a4a, alpha: 0.9 }); }
      const mz = f.model.tipPos(new V3()); G.fx.p(mz, { size: 0.3 + t * 0.6, size1: 0.1, life: 0.12, color: PINK }); } },
    ev: [[0.05, () => sfx('charge')], [1.0, (f, o, G) => { sfx('zap'); sfx('boom'); G.shake(0.2); G.spawn(laserSweep(G, f, f.act, { a0: -1.05, a1: 1.05, dur: f.berserk ? 0.85 : 1.15, back: !!f.berserk })); }], heatEv(1.0, 40)],
    start: (f) => { f.act.dur = f.berserk ? 3.2 : 2.6; } },
  // 미사일 일제 사격 (빨강 바닥 표시 → 떨어짐)
  missile: { dur: 2.0, cd: 'missile', aim: true, track: 0.5, noMove: true, tele: [0.15, 'red'],
    keys: [[0, 'base'], [0.4, { hipY: -0.12, spine: [0.25, 0, 0], chest: [0.1, 0, 0], shoulderL: [-0.3, 0, 0.6], shoulderR: [-0.3, 0, -0.6], elbowL: [-0.6, 0, 0], elbowR: [-0.6, 0, 0], hipL: [-0.7, 0, 0.2], kneeL: [1.0, 0, 0], hipR: [0.2, 0, -0.2], kneeR: [0.8, 0, 0] }], [1.5, {}], [2.0, 'base']],
    ev: [[0.5, (f, o, G) => { if (!o) return; sfx('shot'); const n = f.berserk ? 12 : 8, p = new V3();
      for (let i = 0; i < n; i++) { f.model.podPos(i, p); G.spawn(missileFx(G, f, p.clone())); }
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), rr = i === 0 ? 0 : i < 3 ? rand(1.2, 2.5) : rand(2.5, 6.5), px = o.pos.x + o.vel.x * 0.4 * (i === 1 ? 1 : 0) + Math.cos(a) * rr, pz = o.pos.z + o.vel.z * 0.4 * (i === 1 ? 1 : 0) + Math.sin(a) * rr;
        G.spawn(pillar(G, f, px, pz, 0.35 + i * 0.11, { color: PINK, color2: CYAN, style: 'fall', dmg: 58, r: 1.45, st: VULN(2, 1.12), warn: 1.0 })); } }], heatEv(0.5, 35)] },
  // 로켓 부스트 돌진 (빨강) — 폭주 중에는 방향을 다시 잡아 한 번 더
  s1: { dur: 1.6, cd: 's1', aim: true, track: 0.55, tele: [0.15, 'red'],
    keys: [[0, 'base'], [0.5, { hipY: -0.2, spine: [0.7, 0, 0], chest: [0.2, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.6, 0, -0.4], elbowR: [-0.3, 0, 0], weapon: [1.6, 0, 0], shoulderL: [0.6, 0, 0.4], hipL: [-1.0, 0, 0.1], kneeL: [1.4, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [1.2, 0, 0] }], [0.62, { hipY: -0.05, spine: [0.9, 0, 0], hipL: [-0.4, 0, 0], kneeL: [0.4, 0, 0], hipR: [0.7, 0, 0], kneeR: [0.3, 0, 0] }], [1.15, {}], [1.6, 'base']],
    lunge: [[0.6, 1.12, 23]], start: (f) => { f.dash2 = false; }, ev: [[0.6, (f, o, G) => { sfx('dash'); G.shake(0.15); G.fx.burst(f.pos.clone().setY(0.3), 20, [CYAN, 0xffffff], 6, { kind: 'dust' }); }], heatEv(0.6, 25), [1.18, (f) => { if (f.berserk && !f.dash2 && f.actName === 's1') { f.dash2 = true; f.start('s1b'); } }]],
    hits: [{ t0: 0.6, t1: 1.12, at: [0, 1.1, 0.8], r: 0.85, dmg: 78, kb: [9, 4], stun: 0.6, hs: 0.09, unblock: true, noCrit: true, st: VULN(2, 1.12) }] },
  // 충격 착지 (빨강): 추진기로 높이 솟아 상대 쪽으로 날아와 내리찍는다
  s2: { dur: 2.1, cd: 's2', aim: true, track: 0.3, tele: [0.15, 'red'],
    keys: [[0, 'base'], [0.35, { hipY: -0.22, spine: [0.4, 0, 0], hipL: [-1.1, 0, 0.1], kneeL: [1.6, 0, 0], hipR: [-0.2, 0, -0.1], kneeR: [1.4, 0, 0] }], [0.6, { hipY: 0, spine: [-0.1, 0, 0], shoulderR: [-2.9, 0, -0.2], elbowR: [-0.4, 0, 0], weapon: [0.6, 0, 0], hipL: [-0.9, 0, 0], kneeL: [1.2, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.0, 0, 0] }],
      [1.05, { spine: [0.5, 0, 0], shoulderR: [-1.4, 0, -0.1], weapon: [1.6, 0, 0] }], [1.6, {}], [2.1, 'base']],
    ev: [[0.4, (f, o, G) => { f.vel.y = 12; f.onGround = false; f.slamArm = true; f.boostT = 0.7; sfx('jump'); G.fx.burst(f.pos.clone().setY(0.2), 24, [CYAN, 0xffffff], 6, { kind: 'dust' }); }], heatEv(0.4, 25)],
    tick: (f, o, G, t) => { if (t > 0.4 && t < 1.3 && !f.onGround && o) { const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(11, d * 1.6); f.vel.x = dx / d * sp; f.vel.z = dz / d * sp; f.faceOpp(10, 1 / 60); if (t > 0.95) f.vel.y = Math.min(f.vel.y, -14); } },
    onLand: (f, o, G) => { if (!f.slamArm) return; f.slamArm = false; f.vel.x = f.vel.z = 0; const c = f.pos.clone().setY(0.06);
      sfx('boom'); G.shake(0.45); G.flash(PINK, 0.15); G.fx.ring(c, { normal: UP, r0: 0.4, r1: 5.5, life: 0.55, color: PINK }); G.fx.ring(c, { normal: UP, r0: 1, r1: 7, life: 0.6, color: CYAN });
      G.fx.burst(c, 40, [PINK, CYAN, 0xffffff], 12, { dir: UP, spread: 1.3 }); G.fx.burst(c, 22, 0x6a6a78, 6, { kind: 'dust', sk: 1.6 }); G.fx.light(c.clone().setY(1), PINK, 90, 0.35);
      areaHit(f, c, 4.6, { dmg: 100, kb: [8, 7], stun: 0.6, hs: 0.1, shake: 0.15, unblock: true, noCrit: true, st: VULN(3, 1.15) }); } },
  // 드론 전개: 등 해치에서 지원 드론 둘 (부술 수 있다)
  drones: { dur: 1.7, cd: 'drones', aim: true, noMove: true, tele: [0.15, 'yellow'],
    keys: [[0, 'base'], [0.5, { spine: [-0.15, 0, 0], chest: [-0.2, 0, 0], head: [-0.3, 0, 0], shoulderL: [-0.4, 0, 1.3], shoulderR: [-0.4, 0, -1.3], elbowL: [-0.3, 0, 0], elbowR: [-0.3, 0, 0] }], [1.3, {}], [1.7, 'base']],
    ev: [[0.75, (f, o, G) => { const n = f.berserk ? 3 : 2; for (let i = 0; i < n; i++) { const a = f.yaw + Math.PI + (i - (n - 1) / 2) * 1.1; const p = new V3(f.pos.x + Math.sin(a) * 2.5, 0, f.pos.z + Math.cos(a) * 2.5); const r = Math.hypot(p.x, p.z); if (r > 18) p.multiplyScalar(18 / r); summon(G, f, SUPPORT, p); } }]] },
  // 강제 냉각 (과열): 냉각판을 열고 증기를 뿜으며 멈춘다 — 받는 피해 ×1.6 · 그로기 누적 증가
  vent: { dur: 3.4, aim: false, noMove: true, keys: [[0, 'base'], [0.4, { hipY: -0.2, spine: [0.55, 0, 0], chest: [0.25, 0, 0], head: [0.4, 0, 0], shoulderL: [0.15, 0, 0.5], shoulderR: [0.15, 0, -0.5], elbowL: [-0.2, 0, 0], elbowR: [-0.2, 0, 0], weapon: [1.9, 0, 0], hipL: [-0.8, 0, 0.2], kneeL: [1.2, 0, 0], hipR: [-0.1, 0, -0.2], kneeR: [1.1, 0, 0] }], [3.0, {}], [3.4, 'base']],
    start: (f, o, G) => { sfx('brk'); G.hud && G.hud.pop && G.hud.pop('과열 — 약점 노출!', 'gold'); G.fx.burst(f.chest(), 40, [0xd8d8e0, 0xffffff], 7, { kind: 'smoke', sk: 1.5 }); },
    onHit: (f, att, h) => { if (f.maxDaze && f.brokenT <= 0) f.daze = Math.min(f.maxDaze - 1, f.daze + (h.dmg || 0) * 0.4); return { dmgK: 1.6 }; },
    end: (f) => { f.ocHeat = 0; } },
  // 2페이즈 시작: 실드 발생기 설치 — 살아 있는 동안 실드 돔(받는 피해 ×0.25)
  shield: { dur: 2.2, aim: true, noMove: true, tele: [0.2, 'yellow'],
    keys: [[0, 'base'], [0.6, { hipY: -0.25, spine: [0.5, 0, 0], shoulderL: [-0.8, 0, 0.3], elbowL: [-0.1, 0, 0], hipL: [-1.0, 0, 0.2], kneeL: [1.5, 0, 0], hipR: [0.0, 0, -0.2], kneeR: [1.3, 0, 0] }], [1.5, {}], [2.2, 'base']],
    ev: [[0.9, (f, o, G) => { f.shieldDone = true; sfx('ult'); G.flash(CYAN, 0.3); G.shake(0.3);
      let best = null; for (let k = 0; k < 12; k++) { const a = rand(0, TAU), R = rand(8, 13), p = new V3(Math.cos(a) * R, 0, Math.sin(a) * R), s = (o ? Math.hypot(p.x - o.pos.x, p.z - o.pos.z) : 9) + Math.hypot(p.x - f.pos.x, p.z - f.pos.z) * 0.3; if (!best || (s > 6 && s < best.s) || best.s <= 6) best = { p, s }; }
      const py = summon(G, f, PYLON, best.p, STILL); py.link = f; f.pylon = py; f.shieldOn = true; f.defMul = 0.25;
      G.hud && G.hud.announce && G.hud.announce('실드 전개', '실드 발생기를 파괴하라', 'red', 1.8); }]] },
};
ocMoves.s1b = { ...ocMoves.s1, cd: undefined, keys: [[0, ocMoves.s1.keys[1][1]], ...ocMoves.s1.keys.slice(2).map(([t, p]) => [t - 0.25, p])], track: 0.3, tele: [0.05, 'red'], lunge: [[0.35, 0.87, 25]],
  ev: [[0.35, ocMoves.s1.ev[0][1]], [0.35, (f) => addHeat(f, 15)]], hits: [{ ...ocMoves.s1.hits[0], t0: 0.35, t1: 0.87 }], dur: 1.35, start: undefined };
const boss = {
  id: 'neon_boss', name: '메가 메크 오버클럭', short: '오버클럭', title: '옥상의 최종 병기', enemy: true, boss: true, scale: SC,
  stats: { hp: 4200, speed: 4.4, jump: 9, daze: 340, armor: true, breakTime: 5 }, palettes: [pal(PINK, 0x2a2a38, 0x101018, { trim: CYAN, band: '#20041a' })],
  skills: { s1: { name: '부스터 돌진', cd: 6 }, s2: { name: '충격 착지', cd: 8 }, laser: { name: '레이저 소인', cd: 10 }, missile: { name: '미사일 일제 사격', cd: 9 }, drones: { name: '드론 전개', cd: 16 }, ult: NOULT },
  createModel: (p) => {
    const m = buildOverclock(p), up = m.update;
    m.update = (dt, f) => {
      f.boostT = (f.boostT || 0) - dt; up(dt, f);
      const G = f.G;
      // 실드 발생기 파괴 → 실드 해제 · 폭주
      if (f.shieldOn && (!f.pylon || f.pylon.state === 'ko' || f.pylon.gone)) {
        f.shieldOn = false; f.defMul = 1; f.berserk = true; f.spdMul = 1.25; f.cdMul = 1.35;
        if (f.state !== 'ko') { sfx('brk'); G.flash(0xff2a4a, 0.4); G.shake(0.4); G.setTint && G.setTint(0xff1a3a, 0.3, 1.5); G.hud && G.hud.announce && G.hud.announce('폭주', '오버클럭 리미터 해제', 'red', 1.6); G.fx.burst(f.chest(), 50, [CYAN, 0xffffff], 12); }
      }
      // 보스가 쓰러지면 소환물도 함께 정지
      if (f.state === 'ko' && f.adds && f.adds.length) { for (const a of f.adds) if (a.state !== 'ko' && !a.gone) { a.hp = 1; a.takeHit(f.opp || a, { dmg: 99999, force: true, noScale: true }); } f.adds.length = 0; }
    };
    return m;
  },
  onReset: (f) => { f.ocHeat = 0; f.shieldOn = false; f.shieldDone = false; f.berserk = false; f.defMul = 1; f.spdMul = 1; f.cdMul = 1; f.adds = []; f.pylon = null; f.dash2 = false; },
  poses: ocPoses, moves: ocMoves,
  ai: { range: 12, keep: 5, cdMin: 0.9, cdMax: 1.9, chain: 0.7,
    pick: (f, o, d) => {
      const R = Math.random();
      if ((f.ocHeat || 0) >= 100) return 'vent';
      if (f.enraged && !f.shieldDone) return 'shield';
      const adds = (f.adds || []).filter((a) => a.state !== 'ko' && !a.gone && a.def !== PYLON).length;
      if (f.cd.drones <= 0 && adds === 0 && R < 0.35) return 'drones';
      if (d > 7 && f.cd.s1 <= 0 && R < 0.5) return 's1';
      if (f.cd.laser <= 0 && d > 1.6 && d < 15 && R < 0.55) return 'laser';
      if (f.cd.missile <= 0 && d > 1.6 && R < 0.6) return 'missile';
      if (d < 3.8) return f.cd.s2 <= 0 && R < 0.3 ? 's2' : 'light';
      if (d < 10 && f.cd.s2 <= 0 && R < 0.5) return 's2';
      return f.cd.s1 <= 0 && d > 4 ? 's1' : null;
    } },
};

export default { grunt, archer, brute, boss };
