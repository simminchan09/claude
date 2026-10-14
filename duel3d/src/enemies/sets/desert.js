// 2. 붉은 모래 협곡 — 사막 유적의 미라 · 전갈 · 사암 골렘 · 모래 파라오
// 보스 세크메트: 소환 · 지역 장악형. 모래에서 미라를 일으키고, 유사 구덩이로 끌어당기며, 스카라브 떼를 흘려보내고,
//   석관 봉인(보호막)을 깨야만 다시 피해를 받는다. 2페이즈: 모래 폭풍 (시야 감소 + 주기적인 모래 칼날 — 점프 · 회피)
import * as THREE from 'three';
import { makeSet, poses as P0, slow, swish, chop, slam, shot, pillar } from '../kit.js';
import trainer from '../../characters/trainer.js';
import { Projectile, areaHit } from '../../entities.js';
import { Fighter } from '../../fighter.js';
import { EnemyAI } from '../../ai.js';
import { rand, sfx } from '../../core.js';
import { buildMummy } from './desert_mummy.js';
import { buildScorpion, scorpPoses, scorpRun } from './desert_scorpion.js';
import { buildSandGolem } from './desert_golem.js';
import { buildPharaoh } from './desert_pharaoh.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0), TAU = Math.PI * 2, T = trainer.moves;
const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });
const SAND = 0xe0b070, SAND2 = 0xfff0c0;

const S = makeSet({ id: 'desert',
  grunt: { name: '모래 미라병', short: '미라병', title: '유적의 망자', speed: 4.2, hp: 260, col: C(0xffc04a, 0xd8c8a0, 0x6a5a48, { cloth: 0xe8dcc0, band: '#3a2408' }), st: ['bleed', 3, 5] },
  archer: { name: '거대 독전갈', short: '독전갈', title: '모래 속 사냥꾼', skill: '독침 사격', scale: 1.6, col: C(0x8aff4a, 0x7a3a1a, 0x3a2414, { trim: 0x2a1a0a, band: '#1a2a08' }), shot: { dmg: 40, color: 0x9aff4a, speed: 16, homing: 0.4, st: ['burn', 4, 6] } },
  brute: { name: '사암 골렘', short: '골렘', title: '협곡의 수호석', scale: 1.45, hp: 950, col: C(0xff8a3a, 0xb06a3a, 0x7a4a2a, { band: '#2a1208' }), skill: '사암 붕괴', st: ['slow', 2.5, 0.6] },
  boss: { name: '모래 파라오 세크메트', short: '세크메트', title: '협곡의 저주받은 왕', scale: 1.75, s1: '모래 가시 행렬', s2: '유사 구덩이', col: C(0xffd040, 0x2a3a6a, 0x1a1408, { trim: 0xffc040, cloth: 0x2a3a8a, band: '#2a1a04' }), st: ['slow', 2, 0.7] },
});
const copyPoses = (src, over) => { const o = {}; for (const k in src) o[k] = { ...src[k] }; for (const k in over) o[k] = { ...(o[k] || {}), ...over[k] }; return o; };

/* =====================================================================
   잡몹: 모래 미라병 — 등을 굽히고 왼손을 앞으로 뻗은 채 비틀거린다
   ===================================================================== */
S.grunt.createModel = (p) => buildMummy(p, 1);
S.grunt.poses = copyPoses(P0, {
  base: { hips: [0, -0.2, 0], spine: [0.3, 0.1, 0], chest: [0.12, 0.08, 0], head: [-0.32, 0.1, 0.12], shoulderL: [-1.05, 0, 0.25], elbowL: [-0.35, 0, 0], handL: [0.3, 0, 0] },
  run: { spine: [0.42, 0, 0], head: [-0.4, 0, 0.1], shoulderL: [-1.2, 0, 0.2], elbowL: [-0.3, 0, 0] },
});
S.grunt.moves.heavy = { ...slow(T.light3, { k: 1.25, windup: 0.6, dmg: 0.8, st: S.grunt.moves.light1.hits[0].st }), ev: [[0.62, (f) => sfx('swing')], [0.6 + 0.15 * 1.25, (f, o, G) => G.fx.burst(f.local([0, 1.0, 1.1]), 14, [0xffc04a, SAND2], 6, { kind: 'spark' })]] };
// 소환용 망자 (보스가 모래에서 일으킴): 체력이 낮다
const RAISED = { ...S.grunt, id: 'desert_raised', name: '모래에서 깨어난 망자', short: '망자', stats: { ...S.grunt.stats, hp: 120, daze: 50 } };

/* =====================================================================
   원거리: 거대 독전갈 — 집게 낚아채기 · 꼬리 독침 사격 · 근접 꼬리 찌르기
   ===================================================================== */
const ZL = Math.PI - 0.75, burn = ['burn', 4, 6];
S.archer.createModel = (p) => buildScorpion(p, 1.6); S.archer.poses = scorpPoses(); S.archer.runCycle = scorpRun;
S.archer.skills = { heavy: { name: '꼬리 찌르기', cd: 4 }, s1: { name: '독침 사격', cd: 2.4 }, s2: { name: '-', cd: 1 }, ult: { name: '-', sub: '' } };
S.archer.moves = {
  light1: { dur: 0.95, aim: true, track: 0.35, tele: [0.1, 'yellow'], keys: [[0, 'base'], [0.38, { chest: [-0.12, 0, 0], shoulderL: [-0.6, 0, ZL + 0.35], elbowL: [0, 0, 1.1], shoulderR: [-0.6, 0, -ZL - 0.35], elbowR: [0, 0, -1.1] }],
      [0.5, { chest: [0.06, 0, 0], shoulderL: [-0.2, 0, ZL - 0.25], elbowL: [0, 0, 0.15], shoulderR: [-0.2, 0, -ZL + 0.25], elbowR: [0, 0, -0.15] }], [0.95, 'base']],
    lunge: [[0.4, 0.52, 5]], ev: [[0.42, () => sfx('swing')]], hits: [{ t0: 0.44, t1: 0.56, at: [0, 0.4, 0.95], r: 0.6, dmg: 26, kb: [3, 1], stun: 0.4, hs: 0.06, noCrit: true }] },
  // 독침 사격: 꼬리를 뒤로 젖혔다가 (모델이 f.at 으로 꼬리를 움직임) 앞으로 내지르며 독 구슬
  s1: { dur: 1.15, cd: 's1', aim: true, track: 0.55, tele: [0.15, 'yellow'], keys: [[0, 'base'], [0.5, { chest: [-0.1, 0, 0], hipY: 0.03 }], [0.7, { chest: [0.06, 0, 0] }], [1.15, 'base']],
    ev: [[0.08, () => sfx('charge')], [0.62, (f, o, G) => { if (!o) return; shot(f, o, G, { dmg: 40, color: 0x9aff4a, speed: 16, homing: 0.4, r: 0.3, st: burn }); G.fx.burst(f.model.tipPos(new V3()), 12, [0x9aff4a, 0xffffff], 4); }]] },
  // 꼬리 찌르기: 머리 위로 꼬리를 내리꽂는다 (가까울 때)
  heavy: { dur: 1.3, cd: 'heavy', aim: true, track: 0.45, tele: [0.12, 'yellow'], keys: [[0, 'base'], [0.48, { chest: [-0.14, 0, 0], hipY: 0.04 }], [0.62, { chest: [0.12, 0, 0], hipY: -0.03 }], [1.3, 'base']],
    ev: [[0.56, (f, o, G) => { sfx('heavy'); G.fx.burst(f.local([0, 0.5, 1.1]), 16, [0x9aff4a, SAND2], 6, { dir: UP, spread: 1.2 }); }]],
    hits: [{ t0: 0.56, t1: 0.7, at: [0, 0.5, 1.05], r: 0.7, dmg: 44, kb: [4, 3], stun: 0.5, hs: 0.08, noCrit: true, st: burn }] },
};
S.archer.ai = { range: 11, keep: 6, cdMin: 1.0, cdMax: 2.1, pick: (f, o, d) => (d < 2.4 ? (f.cd.heavy <= 0 && Math.random() < 0.45 ? 'heavy' : 'light') : d > 3.5 && f.cd.s1 <= 0 ? 's1' : null) };

/* =====================================================================
   정예: 사암 골렘 — 바위 주먹 내려치기 · 점프 강타 · 사암 붕괴(앞으로 솟는 바위 기둥 줄)
   ===================================================================== */
S.brute.createModel = (p) => buildSandGolem(p, 1.45);
S.brute.poses = copyPoses(P0, {
  base: { hips: [0, 0, 0], spine: [0.22, 0, 0], chest: [0.12, 0, 0], head: [-0.3, 0, 0], shoulderL: [0.05, 0, 0.3], shoulderR: [0.05, 0, -0.3], elbowL: [-0.35, 0, 0], elbowR: [-0.35, 0, 0], hipL: [-0.25, 0, 0.14], kneeL: [0.4, 0, 0], footL: [-0.12, 0, 0], hipR: [-0.25, 0, -0.14], kneeR: [0.4, 0, 0], footR: [-0.12, 0, 0], weapon: [0, 0, 0] },
  run: { spine: [0.3, 0, 0], shoulderL: [0.2, 0, 0.3], shoulderR: [0.2, 0, -0.3] },
});
S.brute.skills.heavy = { name: '사암 붕괴', cd: 7 };
S.brute.moves.heavy = { dur: 1.6, cd: 'heavy', aim: true, track: 0.6, tele: [0.2, 'red'],
  keys: [[0, 'base'], [0.6, { spine: [-0.2, 0, 0], chest: [-0.15, 0, 0], shoulderL: [-2.9, 0, 0.2], shoulderR: [-2.9, 0, -0.2], elbowL: [-0.4, 0, 0], elbowR: [-0.4, 0, 0] }],
    [0.8, { spine: [0.75, 0, 0], chest: [0.3, 0, 0], shoulderL: [-1.1, 0, 0.1], shoulderR: [-1.1, 0, -0.1], elbowL: [0, 0, 0], elbowR: [0, 0, 0] }], [1.6, 'base']],
  ev: [[0.8, (f, o, G) => { slam(f, G, 2.6, 70, 0xff8a3a, ['slow', 2.5, 0.6]); const fw = f.fwd(new V3()); for (let i = 1; i <= 5; i++) { const p = f.pos.clone().addScaledVector(fw, 1.2 + i * 1.25); G.spawn(pillar(G, f, p.x, p.z, i * 0.12, { color: 0xff8a3a, color2: SAND2, dmg: 62, r: 1.15, warn: 0.45, st: ['slow', 2.5, 0.6] })); } }]] };
S.brute.ai = { range: 3.4, keep: 2, cdMin: 1.6, cdMax: 3, pick: (f, o, d) => (d < 3.4 ? (f.cd.s2 <= 0 && Math.random() < 0.35 ? 's2' : f.cd.heavy <= 0 && Math.random() < 0.35 ? 'heavy' : 'light') : null) };

/* =====================================================================
   보스: 모래 파라오 세크메트
   ===================================================================== */
const B = S.boss;
B.createModel = (p) => buildPharaoh(p, 1.75);
const OSIRIS = { spine: [0, 0, 0], chest: [-0.05, 0, 0], head: [-0.1, 0, 0], shoulderL: [-0.6, 0, -0.35], elbowL: [-2.0, 0, 0], handL: [0, 0, 0], shoulderR: [-0.6, 0, 0.35], elbowR: [-2.0, 0, 0], weapon: [1.2, 0, 0] };
B.poses = copyPoses(P0, {
  base: { hips: [0, -0.25, 0], spine: [0.04, 0.1, 0], chest: [0, 0.08, 0], head: [0.02, 0.1, 0], shoulderR: [-0.35, 0, -0.18], elbowR: [-1.2, 0, 0], weapon: [1.45, 0, 0], shoulderL: [-0.2, 0, 0.32], elbowL: [-0.6, 0, 0] },
  portrait: { head: [0.05, 0.3, 0], shoulderR: [-0.4, 0, -0.2], elbowR: [-1.3, 0, 0], weapon: [1.5, 0, 0] },
  win: OSIRIS,
});
B.stats = { hp: 4200, speed: 4.2, jump: 9, daze: 340, armor: true, breakTime: 5 };
B.skills = { heavy: { name: '태양 홀 올려치기', cd: 6 }, s1: { name: '모래 가시 행렬', cd: 7 }, s2: { name: '유사 구덩이', cd: 9 }, ult: { name: '-', sub: '' } };
const bst = ['slow', 2, 0.7];
// 고유 쿨타임 (석관 · 소환 · 스카라브 · 모래 걸음)
const ready = (f, k) => (f._cd && f._cd[k] || 0) <= f.G.time;
const setCd = (f, k, s) => { (f._cd || (f._cd = {}))[k] = f.G.time + s * (f.enraged ? 0.75 : 1); };
const addsOf = (f) => (f._adds || []).filter((a) => a.state !== 'ko' && !a.gone && f.G.fighters.includes(a));

// 엔티티용 공용 메시
const spikeGeo = new THREE.ConeGeometry(0.42, 1.9, 7, 1); spikeGeo.translate(0, 0.95, 0);
let spikeMat = null, pitMat = null, bladeMat = null, markMat = null;
function sandTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 4, 128, 128, 128); gr.addColorStop(0, 'rgba(60,30,10,1)'); gr.addColorStop(0.35, 'rgba(170,110,50,0.95)'); gr.addColorStop(0.8, 'rgba(225,175,105,0.75)'); gr.addColorStop(1, 'rgba(225,175,105,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(90,50,20,0.55)'; g.lineWidth = 5; for (let k = 0; k < 6; k++) { g.beginPath(); for (let i = 0; i < 60; i++) { const a = k * 1.05 + i * 0.09, r = 8 + i * 2; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const mats = () => {
  if (spikeMat) return;
  spikeMat = new THREE.MeshStandardMaterial({ color: 0xc8864a, roughness: 0.9, flatShading: true });
  pitMat = new THREE.MeshBasicMaterial({ map: sandTex(), transparent: true, depthWrite: false });
  bladeMat = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  markMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
};

// 모래 가시: 땅에서 솟았다 가라앉는 사암 가시 하나
function spike(G, f, x, z, delay, dmg) {
  mats(); const me = new THREE.Mesh(spikeGeo, spikeMat); me.position.set(x, -2, z); me.rotation.set(rand(-0.15, 0.15), rand(0, TAU), rand(-0.15, 0.15)); me.castShadow = true; let t = -delay, hit = false;
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return; if (!me.parent) { G.scene.add(me); G.fx.burst(new V3(x, 0.1, z), 10, [SAND, SAND2], 4, { kind: 'dust', sk: 1.1 }); }
    const up = Math.min(1, t / 0.12), down = Math.max(0, (t - 0.75) / 0.3); me.position.y = -1.9 + 1.9 * up - 2 * down; me.scale.setScalar(0.7 + 0.3 * up);
    if (!hit && t > 0.06) { hit = true; sfx('boom'); G.shake(0.12); G.fx.burst(new V3(x, 0.4, z), 20, [SAND, SAND2, 0xffd040], 8, { dir: UP, spread: 0.6 }); areaHit(f, new V3(x, 0, z), 0.95, { dmg, kb: [3, 8], stun: 0.6, hs: 0.07, unblock: true, noCrit: true, st: bst }, 0.8); }
    if (t > 1.1) this.kill();
  }, kill() { this.done = true; G.scene.remove(me); } };
}
// 유사 구덩이: 0.8초 동안 생겨난 뒤 6.5초간 끌어당기고 느리게 한다 (가운데는 지속 피해)
function quicksand(G, f, x, z, r = 2.3) {
  mats(); const me = new THREE.Mesh(new THREE.CircleGeometry(1, 48), pitMat); me.rotation.x = -Math.PI / 2; me.position.set(x, 0.035, z); me.renderOrder = 2; G.scene.add(me);
  let t = 0, tick = 0; const c = new V3(x, 0, z);
  G.fx.ring(c.clone().setY(0.06), { normal: UP, r0: r + 0.2, r1: r, life: 0.8, color: 0xffb040 });
  return { done: false, owner: f, update(dt) {
    t += dt; const grow = Math.min(1, t / 0.8), fade = Math.max(0, (t - 6.8) / 0.5); me.scale.setScalar(r * grow * (1 - fade * 0.4) + 0.01); me.rotation.z += dt * 1.6; pitMat.opacity = 1;
    if (Math.random() < 0.6) { const a = rand(0, TAU), rr = rand(0.3, r); G.fx.p(new V3(x + Math.cos(a) * rr, 0.08, z + Math.sin(a) * rr), { vel: [-Math.sin(a) * 1.5 - Math.cos(a) * 0.8, 0.2, Math.cos(a) * 1.5 - Math.sin(a) * 0.8], size: 0.08, size1: 0.02, life: 0.6, color: SAND, alpha: 0.8, drag: 1 }); }
    if (t > 0.8 && fade <= 0) for (const o of f.foes()) {
      const dx = c.x - o.pos.x, dz = c.z - o.pos.z, d = Math.hypot(dx, dz); if (d > r || o.pos.y > 0.4) continue;
      o.addStatus('slow', 0.4, 0.45, f);
      if (!o.held && o.state !== 'dash' && d > 0.15) { const k = (2.6 * (1 - d / r) + 0.6) * dt; o.pos.x += (dx / d) * k; o.pos.z += (dz / d) * k; }
      if (d < 0.8) { tick -= dt; if (tick <= 0) { tick = 0.5; o.dot(f, 9, 0xc08040); } }
    }
    if (t > 7.3) this.kill();
  }, kill() { this.done = true; G.scene.remove(me); me.geometry.dispose(); } };
}
// 미라 소환: 경고 원 → 모래에서 일어나는 망자
function raiseAdds(f, o, G, n) {
  const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rand(-0.4, 0.4), rr = rand(2.6, 3.6); pts.push(new V3(o.pos.x + Math.cos(a) * rr, 0, o.pos.z + Math.sin(a) * rr)); }
  for (const p of pts) { const r = Math.hypot(p.x, p.z); if (r > 12) p.multiplyScalar(12 / r); G.fx.ring(p.clone().setY(0.06), { normal: UP, r0: 1.4, r1: 0.4, life: 0.6, color: 0xffc04a }); G.fx.burst(p.clone().setY(0.1), 16, [SAND, SAND2], 3, { kind: 'dust', sk: 1.2 }); }
  let t = 0;
  G.spawn({ done: false, owner: f, update(dt) { t += dt; for (const p of pts) if (Math.random() < 0.5) G.fx.p(p.clone().add(new V3(rand(-0.6, 0.6), 0.1, rand(-0.6, 0.6))), { vel: [0, rand(1, 3), 0], size: 0.12, life: 0.4, color: SAND }); if (t < 0.6) return; this.done = true;
    if (f.state === 'ko' || f.gone) return;
    for (const p of pts) {
      const a = new Fighter(RAISED, 1, new EnemyAI(), G, RAISED.palettes[0]); a.reset(p); a.opp = G.player || f.opp; a.ai = a.ctrl; a.faceOpp(); a.state = 'down'; a.downT = 0.9; a.inv = 1.1; a.onGround = true;
      G.fighters.push(a); (f._adds || (f._adds = [])).push(a);
      G.fx.burst(p.clone().setY(0.4), 30, [SAND, SAND2, 0xffc04a], 6, { dir: UP, spread: 0.7 }); G.fx.burst(p.clone().setY(0.2), 12, SAND, 3, { kind: 'dust', sk: 1.5 });
    }
    sfx('spawn'); G.hud.setWave && G.hud.setWave(G);
  }, kill() { this.done = true; } });
}
// 모래 폭풍 (2페이즈): 경기장을 도는 모래 입자 · 짙은 안개 · 3.4초마다 경기장을 가로지르는 모래 칼날 (낮게 날아옴: 점프 · 회피)
function sandstorm(G, f) {
  mats(); const N = 1400, pos = new Float32Array(N * 3), dat = []; for (let i = 0; i < N; i++) { const a = rand(0, TAU), r = rand(2, 17), y = rand(0, 6); dat.push([a, r, y, rand(0.6, 1.4)]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe8c08a, size: 0.16, transparent: true, opacity: 0, depthWrite: false })); pts.frustumCulled = false; G.scene.add(pts);
  const fog = G.scene.fog, d0 = fog && fog.density, c0 = fog && fog.color.clone();
  let t = 0, next = 2.2, end = -1; const blades = [];
  const spawnBlade = () => {
    const o = f.opp && f.opp.state !== 'ko' ? f.opp : G.player; if (!o) return;
    const a = rand(0, TAU), dir = new V3(Math.cos(a), 0, Math.sin(a)), perp = new V3(-dir.z, 0, dir.x), start = o.pos.clone().setY(0).addScaledVector(dir, -15);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.5), markMat); mark.rotation.x = -Math.PI / 2; mark.rotation.z = -Math.atan2(dir.z, dir.x); mark.position.copy(o.pos).setY(0.05); G.scene.add(mark);
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.0, 8, 1), bladeMat); { const p = bl.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -0.6 * (x / 3.5) ** 2); } bl.geometry.computeVertexNormals(); }
    bl.position.copy(start).setY(0.55); bl.lookAt(start.clone().add(dir).setY(0.55)); bl.rotateY(Math.PI / 2); bl.visible = false; G.scene.add(bl);
    blades.push({ mark, bl, dir, perp, pos: start, t: 0, hit: new Set() }); sfx('teleRed');
  };
  return { done: false, owner: f, update(dt) {
    t += dt; const dead = f.state === 'ko' || f.gone || !G.fighters.includes(f);
    if (dead && end < 0) end = t;
    const k = end < 0 ? Math.min(1, t / 1.5) : Math.max(0, 1 - (t - end) / 1.2);
    pts.material.opacity = 0.75 * k; if (fog) { fog.density = d0 * (1 + 2.2 * k); fog.color.copy(c0).lerp(new THREE.Color(0xc89a60), 0.5 * k); }
    for (let i = 0; i < N; i++) { const q = dat[i]; q[0] += dt * (0.5 + 2.5 / q[1]) * q[3]; q[2] += Math.sin(t * 2 + i) * dt * 0.3; pos[i * 3] = Math.cos(q[0]) * q[1]; pos[i * 3 + 1] = q[2]; pos[i * 3 + 2] = Math.sin(q[0]) * q[1]; }
    geo.attributes.position.needsUpdate = true;
    if (end < 0) { next -= dt; if (next <= 0) { next = 3.4; spawnBlade(); } }
    for (let i = blades.length - 1; i >= 0; i--) {
      const b = blades[i]; b.t += dt; markMat.opacity = 0.35 + 0.25 * Math.sin(b.t * 20);
      if (b.t > 0.95) { b.mark.visible = false; b.bl.visible = true; b.pos.addScaledVector(b.dir, 15 * dt); b.bl.position.set(b.pos.x, 0.55, b.pos.z);
        if (Math.random() < 0.8) G.fx.burst(b.pos.clone().addScaledVector(b.perp, rand(-3.5, 3.5)).setY(0.3), 2, [SAND, SAND2], 3, { kind: 'dust' });
        for (const o of f.foes()) { if (b.hit.has(o.id)) continue; const rel = o.pos.clone().sub(b.pos); if (Math.abs(rel.dot(b.dir)) < 0.55 && Math.abs(rel.dot(b.perp)) < 3.6 && o.pos.y < 0.7) { b.hit.add(o.id); o.takeHit(f, { dmg: 45, kb: [6, 4], stun: 0.5, hs: 0.06, unblock: true, noCrit: true, st: ['bleed', 3, 5] }, b.dir.clone()); } } }
      if (b.t > 3.2 || dead) { G.scene.remove(b.mark); G.scene.remove(b.bl); b.mark.geometry.dispose(); b.bl.geometry.dispose(); blades.splice(i, 1); }
    }
    if (end >= 0 && t - end > 1.3) this.kill();
  }, kill() { this.done = true; G.scene.remove(pts); geo.dispose(); for (const b of blades) { G.scene.remove(b.mark); G.scene.remove(b.bl); } if (fog && d0 !== undefined) { fog.density = d0; fog.color.copy(c0); } f.stormOn = false; } };
}
// 석관 봉인 관리: 보호막 체력이 다하면 깨지며 브레이크 · 시간이 다하면 체력 회복
function sealFx(G, f, hp) {
  f.sealHp = f.sealMax = hp; f.sealT = 12; let k = 0;
  G.hud.pop && G.hud.pop('석관 봉인', 'gold');
  return { done: false, owner: f, update(dt) {
    const m = f.model; f.sealT -= dt;
    if (f.state === 'ko' || f.gone) { m.setSeal(0); f.sealHp = 0; f.spdMul = 1; return this.kill(); }
    if (f.sealHp > 0 && f.sealT > 0) { k = Math.min(1, k + dt * 2.2); m.setSeal(k, 1 - f.sealHp / f.sealMax); f.spdMul = 0.45; m.sarc.position.x = (1 - f.sealHp / f.sealMax) * Math.sin(G.time * 60) * 0.006; return; }
    m.setSeal(0); f.spdMul = 1; const c = f.chest(new V3());
    if (f.sealHp <= 0) { // 파괴 → 브레이크
      G.fx.burst(c, 60, [0xffd040, 0xf0c060, 0x1e3a9a, 0xffffff], 12); G.fx.ring(c, { r0: 0.4, r1: 5, life: 0.5, color: 0xffd040, billboard: true }); G.shake(0.35); sfx('brk');
      G.hud.pop && G.hud.pop('석관 파괴!', 'violet'); f.daze = f.maxDaze; f.breakStart(f.opp || G.player);
    } else { // 버팀 → 회복
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.06); G.fx.burst(c, 30, [0xffd040, 0x7aff9a], 6, { kind: 'glow' }); G.hud.pop && G.hud.pop('봉인 회복', 'gold'); sfx('charge');
    }
    f.sealHp = 0; this.kill();
  }, kill() { this.done = true; } };
}
B.onReset = (f) => {
  f._cd = {}; f.sealHp = 0; f._sealN = 0; f.stormOn = false; f.spdMul = 1; if (f.model.setSeal) f.model.setSeal(0);
  if (f._adds) for (const a of f._adds) if (a.state !== 'ko') a.dot(null, 9999); f._adds = [];
  if (f._wrapped) return; f._wrapped = true;
  const th = f.takeHit.bind(f), dot = f.dot.bind(f);
  // 봉인 중: 피해를 석관이 흡수 (빨강 · 강제 피해 제외)
  f.takeHit = (att, h, dir) => {
    if (f.sealHp > 0 && !h.force && f.state !== 'ko') {
      if (att.team === f.team) return false;
      const d = h.dmg * (att.dmgMul || 1) * (att.stK ? att.stK('atk') : 1); f.sealHp -= d; att.hitConfirm = true; att.gainEnergy && att.gainEnergy(d * 0.1);
      const p = f.chest(new V3()); f.G.fx.burst(p, 14, [0xffd040, 0xffffff], 7); f.G.hud.damage(p.add(new V3(0, 0.4, 0)), '봉인 ' + Math.max(0, Math.ceil(f.sealHp)), false, true); sfx('block'); f.G.hitstop = Math.max(f.G.hitstop, 0.04);
      return 'block';
    }
    return th(att, h, dir);
  };
  f.dot = (att, d, col) => (f.sealHp > 0 ? undefined : dot(att, d, col));
  // 보스가 쓰러지면 소환된 망자도 무너진다
  f.G.spawn({ done: false, owner: f, update() { if (!f.G.fighters.includes(f) || f.state === 'ko') { for (const a of f._adds || []) if (a.state !== 'ko' && !a.gone) a.dot(null, 9999); if (!f.G.fighters.includes(f) || f.gone) this.done = true; } }, kill() { this.done = true; } });
};
const castArms = { spine: [-0.18, 0, 0], chest: [-0.12, 0, 0], head: [-0.25, 0, 0], shoulderL: [-2.6, 0, 0.5], elbowL: [-0.2, 0, 0], shoulderR: [-2.6, 0, -0.5], elbowR: [-0.2, 0, 0], weapon: [0.4, 0, 0] };
B.moves = {
  ...(() => { const L = S.boss.moves; return { light1: { ...L.light1, ev: [[0.5 + 0.08 * 1.25, swish]] }, light2: L.light2, light3: L.light3, heavy: { ...L.heavy, cd: 'heavy' } }; })(),
  // 모래 가시 행렬: 홀을 내리찍으면 플레이어 쪽으로 사암 가시가 줄지어 솟는다 (빨강: 옆으로 피할 것). 2페이즈: 세 갈래
  s1: { dur: 1.55, cd: 's1', aim: true, track: 0.6, tele: [0.2, 'red'], noMove: true,
    keys: [[0, 'base'], [0.5, { spine: [-0.15, 0, 0], shoulderR: [-2.8, 0, -0.2], elbowR: [-0.5, 0, 0], weapon: [1.0, 0, 0], shoulderL: [-1.6, 0, 0.3] }], [0.72, { spine: [0.5, 0, 0], chest: [0.2, 0, 0], shoulderR: [-1.0, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [2.2, 0, 0], shoulderL: [-0.4, 0, 0.5] }], [1.55, 'base']],
    ev: [[0.3, (f, o, G) => { const fw = f.fwd(new V3()); for (let i = 0; i < 18; i++) G.fx.p(f.pos.clone().addScaledVector(fw, 1 + i * 0.55).setY(0.08), { vel: [0, 0.4, 0], size: 0.25, size1: 0.1, life: 0.6, color: 0xff6030, alpha: 0.8 }); }],
      [0.72, (f, o, G) => { slam(f, G, 1.8, 40, 0xffd040, bst); const n = f.enraged ? 3 : 1; for (let j = 0; j < n; j++) { const a = f.yaw + (j - (n - 1) / 2) * 0.42, dir = new V3(Math.sin(a), 0, Math.cos(a)); for (let i = 0; i < 10; i++) { const p = f.pos.clone().addScaledVector(dir, 1.6 + i * 0.95); G.spawn(spike(G, f, p.x + rand(-0.15, 0.15), p.z + rand(-0.15, 0.15), i * 0.065, 70)); } } }]] },
  // 유사 구덩이: 홀을 땅에 꽂아 플레이어 발밑과 주변에 끌어당기는 모래 구덩이
  s2: { dur: 1.35, cd: 's2', aim: true, track: 0.4, tele: [0.15, 'yellow'],
    keys: [[0, 'base'], [0.45, { spine: [0.1, 0, 0], shoulderR: [-1.8, 0, -0.1], elbowR: [-0.6, 0, 0], weapon: [2.6, 0, 0], shoulderL: [-1.9, 0, 0.6], elbowL: [-0.3, 0, 0] }], [0.62, { spine: [0.35, 0, 0], shoulderR: [-1.2, 0, -0.1], weapon: [3.0, 0, 0] }], [1.35, 'base']],
    ev: [[0.62, (f, o, G) => { if (!o) return; sfx('boom'); G.shake(0.15); G.fx.burst(f.local([0, 0.2, 1.4]), 24, [SAND, SAND2], 5, { kind: 'dust', sk: 1.2 });
      const n = f.enraged ? 3 : 2; G.spawn(quicksand(G, f, o.pos.x, o.pos.z)); for (let i = 1; i < n; i++) { const a = rand(0, TAU); G.spawn(quicksand(G, f, o.pos.x + Math.cos(a) * 4, o.pos.z + Math.sin(a) * 4, 2.0)); } }]] },
  // 망자 소환: 두 팔을 들어 모래에서 미라 2 (2페이즈 3) 마리를 일으킨다
  raise: { dur: 1.7, aim: true, track: 0.3, noMove: true, keys: [[0, 'base'], [0.45, castArms], [1.3, { ...castArms, spine: [-0.25, 0, 0] }], [1.7, 'base']],
    ev: [[0.05, () => sfx('charge')], [0.5, (f, o, G) => { setCd(f, 'raise', 17); const n = Math.min(f.enraged ? 3 : 2, 4 - addsOf(f).length); if (o && n > 0) raiseAdds(f, o, G, n); G.fx.burst(f.model.sun.getWorldPosition(new V3()), 30, [0xffd040, 0xffffff], 6, { kind: 'glow' }); }]],
    tick: (f, o, G, t) => { if (t > 0.4 && t < 1.3 && Math.random() < 0.6) { const h = f.model.handPos(new V3()); G.fx.p(h, { vel: [0, 1.5, 0], size: 0.3, size1: 0.05, life: 0.5, color: 0xffc04a, alpha: 0.8 }); } } },
  // 스카라브 떼: 왼손을 뻗어 1.4초 동안 풍뎅이 떼를 흘려보낸다 (노랑: 막을 수 있음 · 옆으로 돌면 빗나감)
  scarab: { dur: 2.25, aim: true, track: 2.0, tele: [0.15, 'yellow'], move: 0.15,
    keys: [[0, 'base'], [0.4, { chest: [0, 0.35, 0], shoulderL: [-1.55, 0, 0.1], elbowL: [-0.1, 0, 0], handL: [0.4, 0, 0], shoulderR: [-0.3, 0, -0.3] }], [1.95, { chest: [0, 0.25, 0] }], [2.25, 'base']],
    ev: [[0.05, () => sfx('charge')], [0.45, (f) => setCd(f, 'scarab', 8)]],
    tick: (f, o, G, t, dt) => { if (!o || t < 0.5 || t > 1.9) return; f._sc = (f._sc || 0) - dt; if (f._sc > 0) return; f._sc = 0.1;
      const h = f.model.handPos(new V3()), d = o.chest(new V3()).sub(h).normalize(); d.applyAxisAngle(UP, rand(-0.25, 0.25)); d.y += rand(-0.08, 0.12);
      G.spawn(new Projectile(G, { owner: f, pos: h.clone().addScaledVector(d, 0.25), vel: d.multiplyScalar(rand(10, 12.5)), r: 0.17, color: Math.random() < 0.5 ? 0x2ac0a0 : 0xffc040, homing: 1.0, life: 1.8, hit: { dmg: 5, kb: [1.2, 0], stun: 0.18, hs: 0.02, noCrit: true, st: ['bleed', 3, 4] } }));
      if (Math.random() < 0.5) sfx('shot'); } },
  // 석관 봉인: 오시리스 자세로 팔을 엇갈리면 금 석관이 몸을 감싼다 (깨기 전엔 피해 무효)
  seal: { dur: 1.3, aim: true, noMove: true, keys: [[0, 'base'], [0.45, OSIRIS], [1.3, OSIRIS]],
    ev: [[0.05, () => sfx('charge')], [0.42, (f, o, G) => { f._sealN++; G.spawn(sealFx(G, f, f.enraged ? 700 : 560)); G.fx.ring(f.pos.clone().setY(0.08), { normal: UP, r0: 0.4, r1: 4, life: 0.5, color: 0xffd040 }); G.shake(0.15); }]] },
  // 모래 폭풍 (2페이즈 시작): 하늘을 향해 포효하면 경기장이 모래 폭풍에 잠긴다
  storm: { dur: 2.0, aim: true, noMove: true, keys: [[0, 'base'], [0.5, { ...castArms, head: [-0.5, 0, 0] }], [1.6, { ...castArms, head: [-0.55, 0, 0], spine: [-0.3, 0, 0] }], [2.0, 'base']],
    ev: [[0.1, () => sfx('charge')], [0.6, (f, o, G) => { if (f.stormOn) return; f.stormOn = true; G.spawn(sandstorm(G, f)); sfx('boom'); G.shake(0.3); G.fx.burst(f.chest(new V3()), 60, [SAND, SAND2], 10, { kind: 'dust', sk: 1.6 }); G.hud.pop && G.hud.pop('모래 폭풍', 'red'); }]] },
  // 모래 걸음: 모래로 흩어지듯 뒤로 미끄러져 거리를 벌린다
  sandstep: { dur: 0.6, aim: true, noMove: true, keys: [[0, 'base'], [0.15, { spine: [-0.2, 0, 0], hipL: [-0.6, 0, 0.1], kneeL: [0.9, 0, 0] }], [0.6, 'base']], lunge: [[0.08, 0.4, -15]],
    ev: [[0.06, (f, o, G) => { setCd(f, 'step', 5); f.inv = Math.max(f.inv, 0.32); sfx('dash'); G.fx.burst(f.chest(new V3()), 30, [SAND, SAND2], 5, { kind: 'dust', sk: 1.3 }); }]] },
};
B.ai = { range: 9, keep: 4.5, cdMin: 0.9, cdMax: 1.9, chain: 0.7,
  pick: (f, o, d) => {
    const sealed = f.sealHp > 0, hp = f.hp / f.maxHp, R = Math.random();
    if (f.enraged && !f.stormOn) return 'storm';
    if (!sealed && ((f._sealN === 0 && hp < 0.72) || (f._sealN === 1 && hp < 0.32))) return 'seal';
    if (ready(f, 'raise') && addsOf(f).length < (f.enraged ? 3 : 2) && R < 0.55) return 'raise';
    if (d < 2.6) { if (ready(f, 'step') && Math.random() < (sealed ? 0.7 : 0.3)) return 'sandstep'; if (!sealed) return Math.random() < 0.7 ? 'light' : f.cd.heavy <= 0 ? 'heavy' : 'light'; }
    if (d < 9.6 && f.cd.s2 <= 0 && Math.random() < 0.5) return 's2';
    if (d > 3 && f.cd.s1 <= 0 && Math.random() < 0.5) return 's1';
    if (d > 2.8 && ready(f, 'scarab') && Math.random() < 0.55) return 'scarab';
    return d < 3.4 && !sealed ? 'light' : null;
  } };
S.boss.moveList = [['태양 홀 3연격', '노랑 예고'], ['모래 가시 행렬', '빨강 · 줄지어 솟는 가시'], ['유사 구덩이', '끌어당김 · 감속'], ['망자 소환', '미라 2~3'], ['스카라브 떼', '유도 연사'], ['석관 봉인', '보호막을 깨야 함'], ['모래 폭풍', '2페이즈 · 낮은 모래 칼날']];
export default S;
