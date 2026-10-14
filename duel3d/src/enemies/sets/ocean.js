// 5. 노을빛 해상 — 해골 해적 · 해적 총잡이 · 심해 어인 · 유령 선장
// 보스 블랙타이드: 유령 해적 선장. 갑판을 가로지르는 포격 줄 · 사슬 닻으로 끌어당기기 · 유령 선원 소환 · 경기장을 가로지르는 해일(점프 · 회피)
//   2페이즈: 영체화 — 몸이 투명해졌다 실체로 돌아오기를 반복하며, 실체일 때(그리고 공격하는 순간)만 피해를 받는다. 등 뒤로 순간 도약 베기
import * as THREE from 'three';
import { makeSet, poses as P0, slow, swish, chop, slam, shot } from '../kit.js';
import trainer from '../../characters/trainer.js';
import { areaHit } from '../../entities.js';
import { Fighter } from '../../fighter.js';
import { EnemyAI } from '../../ai.js';
import { rand, sfx } from '../../core.js';
import { buildSkeleton } from './ocean_bones.js';
import { buildFishman } from './ocean_fishman.js';
import { buildCaptain, floatPosesOf } from './ocean_captain.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0), TAU = Math.PI * 2, T = trainer.moves;
const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });
const SEA = 0x5affd0, FOAM = 0xe8fffa;

const S = makeSet({ id: 'ocean',
  grunt: { name: '해골 해적', short: '해골', title: '저주받은 선원', hp: 260, col: C(0x4affd8, 0xe8e0c8, 0x2a2a3a, { cloth: 0x8a1a2a, band: '#08201e' }), st: ['bleed', 3, 5] },
  archer: { name: '해적 총잡이', short: '총잡이', title: '갑판의 사수', skill: '권총 사격', col: C(0xffd060, 0x6a3a2a, 0x1a1a24, { trim: 0xd8a040, band: '#241608' }), shot: { dmg: 48, color: 0xffe08a, speed: 24, homing: 0.15, r: 0.2 } },
  brute: { name: '심해 어인', short: '어인', title: '바다 밑의 전사', scale: 1.5, hp: 950, col: C(0x3affc8, 0x2a6a7a, 0x1a3a4a, { cloth: 0x3a9aa8, band: '#04202a' }), skill: '해일 강타', st: ['slow', 2.5, 0.6] },
  boss: { name: '유령 선장 블랙타이드', short: '블랙타이드', title: '노을 바다의 망령', scale: 1.7, s1: '포격 지원', s2: '닻 사슬', col: C(0x5affd0, 0x1a2a3a, 0x0a1218, { trim: 0xd8a040, cloth: 0x2a0a14, band: '#041a1a' }), st: ['slow', 2, 0.7] },
});
const copyPoses = (src, over) => { const o = {}; for (const k in src) o[k] = { ...src[k] }; for (const k in over) o[k] = { ...(o[k] || {}), ...over[k] }; return o; };

/* ---------- 잡몹: 해골 해적 ---------- */
S.grunt.createModel = (p) => buildSkeleton(p, 1, 'grunt');
S.grunt.poses = copyPoses(P0, { base: { spine: [0.18, 0.15, 0], head: [-0.12, 0.12, 0.08] } });
// 소환용 유령 선원 (보스): 반투명 · 체력 낮음
const CREW = { ...S.grunt, id: 'ocean_crew', name: '유령 선원', short: '유령 선원', stats: { ...S.grunt.stats, hp: 120, daze: 50 }, palettes: [{ ...S.grunt.palettes[0], accent: 0x7affe8 }], createModel: (p) => buildSkeleton(p, 1, 'ghost') };

/* ---------- 원거리: 해적 총잡이 ---------- */
const AIM = { chest: [0, 0.5, 0], spine: [0.05, 0.3, 0], head: [0, -0.6, 0], shoulderR: [-1.55, 0, -0.05], elbowR: [-0.05, 0, 0], weapon: [1.55, 0, 0], shoulderL: [-0.2, 0, 0.3], elbowL: [-0.5, 0, 0] };
S.archer.createModel = (p) => buildSkeleton(p, 1, 'gunner');
S.archer.poses = copyPoses(P0, { base: { shoulderR: [-0.9, 0, -0.35], elbowR: [-1.3, 0, 0], weapon: [2.2, 0, 0] } });
S.archer.skills.heavy = { name: '연발', cd: 6 };
const pistol = (dmg, spread = 0) => (f, o, G) => { if (!o) return; shot(f, o, G, { dmg, color: 0xffe08a, speed: 24, homing: 0.15, r: 0.2, spread }); const p = f.model.tipPos(new V3()); G.fx.burst(p, 14, [0xffe08a, 0xffffff, 0x8a8a8a], 5, { dir: f.fwd(new V3()), spread: 0.5 }); G.fx.burst(p, 4, 0x8a8a8a, 1, { kind: 'smoke', sk: 0.4 }); G.fx.light(p, 0xffd060, 30, 0.12); };
S.archer.moves.s1 = { dur: 1.25, cd: 's1', aim: true, track: 0.6, tele: [0.2, 'yellow'], keys: [[0, 'base'], [0.45, AIM], [0.66, AIM], [0.72, { ...AIM, shoulderR: [-1.9, 0, -0.05], weapon: [1.3, 0, 0] }], [1.25, 'base']], ev: [[0.1, () => sfx('charge')], [0.66, pistol(48)]] };
S.archer.moves.heavy = { dur: 1.5, cd: 'heavy', aim: true, track: 0.9, tele: [0.2, 'yellow'], keys: [[0, 'base'], [0.4, AIM], [0.62, { ...AIM, shoulderR: [-1.85, 0, -0.05] }], [0.8, AIM], [1.0, { ...AIM, shoulderR: [-1.85, 0, -0.05] }], [1.5, 'base']], ev: [[0.58, pistol(30, -0.12)], [0.96, pistol(30, 0.12)]] };
S.archer.ai = { range: 11, keep: 7, cdMin: 1.0, cdMax: 2.2, pick: (f, o, d) => (d > 4 && f.cd.s1 <= 0 ? 's1' : d > 3.5 && f.cd.heavy <= 0 && Math.random() < 0.4 ? 'heavy' : d < 2.6 ? 'light' : null) };

/* ---------- 정예: 심해 어인 ---------- */
S.brute.createModel = (p) => buildFishman(p, 1.5);
S.brute.poses = copyPoses(P0, { base: { hips: [0, -0.2, 0], spine: [0.3, 0.12, 0], chest: [0.15, 0.08, 0], head: [-0.38, 0.1, 0], shoulderL: [-0.3, 0, 0.45], elbowL: [-0.7, 0, 0], hipL: [-0.55, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.15, 0, -0.14], kneeR: [0.6, 0, 0] } });
S.brute.skills.heavy = { name: '삼지창 돌격', cd: 7 };
S.brute.moves.heavy = { ...slow(T.light3, { k: 1.3, windup: 0.75, tele: 'red', unblock: true, dmg: 1.2, st: ['slow', 2.5, 0.6], lunge: [[0.75 + 0.13 * 1.3, 0.75 + 0.3 * 1.3, 15]], ev: [[0.75 + 0.12 * 1.3, (f, o, G) => { sfx('dash'); G.fx.burst(f.chest(new V3()), 26, [SEA, FOAM], 7); }]] }), cd: 'heavy' };
S.brute.ai = { range: 3.6, keep: 2, cdMin: 1.6, cdMax: 3, pick: (f, o, d) => (d < 3.4 ? (f.cd.s2 <= 0 && Math.random() < 0.4 ? 's2' : 'light') : d < 7 && f.cd.heavy <= 0 && Math.random() < 0.5 ? 'heavy' : null) };

/* =====================================================================
   보스: 유령 선장 블랙타이드
   ===================================================================== */
const B = S.boss, bst = ['slow', 2, 0.7];
B.createModel = (p) => buildCaptain(p, 1.7);
B.poses = floatPosesOf(copyPoses(P0, {
  base: { hips: [0, -0.25, 0], spine: [0.12, 0.12, 0], chest: [0.02, 0.1, 0], head: [-0.05, 0.1, 0], shoulderL: [-0.45, 0, 0.35], elbowL: [-0.8, 0, 0], shoulderR: [-0.5, 0, -0.3], elbowR: [-0.9, 0, 0], weapon: [0.9, 0, 0] },
  run: { spine: [0.45, 0, 0], shoulderL: [0.3, 0, 0.4], shoulderR: [0.3, 0, -0.4], elbowR: [-0.4, 0, 0], weapon: [1.6, 0, 0] },
}));
B.stats = { hp: 4200, speed: 4.8, jump: 9, daze: 340, armor: true, breakTime: 5 };
B.skills = { heavy: { name: '망령 올려베기', cd: 6 }, s1: { name: '포격 지원', cd: 9 }, s2: { name: '닻 사슬', cd: 7 }, ult: { name: '-', sub: '' } };
const ready = (f, k) => (f._cd && f._cd[k] || 0) <= f.G.time;
const setCd = (f, k, s) => { (f._cd || (f._cd = {}))[k] = f.G.time + s * (f.enraged ? 0.75 : 1); };
const addsOf = (f) => (f._adds || []).filter((a) => a.state !== 'ko' && !a.gone && f.G.fighters.includes(a));

let markMat = null, ballMat = null, waveMat = null, foamMat = null;
const mats = () => { if (markMat) return;
  markMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  ballMat = new THREE.MeshStandardMaterial({ color: 0x18181c, metalness: 0.7, roughness: 0.4 });
  waveMat = new THREE.MeshPhysicalMaterial({ color: 0x1a8a9a, emissive: 0x0a4a50, emissiveIntensity: 0.6, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
  foamMat = new THREE.MeshBasicMaterial({ color: FOAM, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }); };
const ballGeo = new THREE.SphereGeometry(0.32, 14, 10);

// 포격 줄 하나: 1.1초 붉은 띠 경고 → 한쪽 끝부터 포탄이 차례로 떨어진다
function cannonLine(G, f, c, dir, len = 24, n = 10, delay = 0) {
  mats(); const mark = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.4), markMat); mark.rotation.x = -Math.PI / 2; mark.rotation.z = -Math.atan2(dir.z, dir.x); mark.position.copy(c).setY(0.04); mark.renderOrder = 2;
  const balls = []; let t = -delay;
  for (let i = 0; i < n; i++) { const p = c.clone().addScaledVector(dir, -len / 2 + (i + 0.5) * (len / n)); const r = Math.hypot(p.x, p.z); if (r < 14) balls.push({ p, at: 1.1 + i * 0.09, boom: false, me: null }); }
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return; if (!mark.parent) { G.scene.add(mark); sfx('teleRed'); }
    markMat.opacity = 0.3 + 0.2 * Math.sin(t * 24);
    for (const b of balls) {
      const k = (t - (b.at - 0.4)) / 0.4;
      if (k > 0 && !b.boom) { if (!b.me) { b.me = new THREE.Mesh(ballGeo, ballMat); G.scene.add(b.me); } b.me.position.set(b.p.x - 3 * (1 - k), 0.3 + 14 * (1 - k), b.p.z); G.fx.p(b.me.position, { size: 0.5, size1: 0.1, life: 0.2, color: 0xffa040, alpha: 0.7 }); }
      if (k >= 1 && !b.boom) { b.boom = true; G.scene.remove(b.me); sfx('boom'); G.shake(0.12); G.fx.burst(b.p.clone().setY(0.3), 26, [0xffa040, 0xffe080, 0x2a2a2a], 9, { dir: UP, spread: 1.2 }); G.fx.burst(b.p.clone().setY(0.4), 6, 0x4a4a4a, 2, { kind: 'smoke', sk: 1.2 }); G.fx.ring(b.p.clone().setY(0.06), { normal: UP, r0: 0.3, r1: 2.0, life: 0.4, color: 0xffa040 });
        areaHit(f, b.p, 1.35, { dmg: 60, kb: [4, 8], stun: 0.6, hs: 0.07, unblock: true, noCrit: true }, 1.2); }
    }
    if (balls.length && balls.every((b) => b.boom)) mark.visible = false;
    if (t > 1.1 + n * 0.09 + 0.6) this.kill();
  }, kill() { this.done = true; G.scene.remove(mark); mark.geometry.dispose(); for (const b of balls) if (b.me) G.scene.remove(b.me); } };
}
// 해일: 경기장 끝에서 낮은 물벽이 가로질러 온다 (높이 약 1.1m — 점프로 넘거나 회피)
function tidalWave(G, f, dir, delay = 0) {
  mats(); const W = 30, geo = new THREE.PlaneGeometry(W, 1.5, 40, 6), pp = geo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i) + 0.75, k = y / 1.5; pp.setXYZ(i, x, y * (1 - 0.1 * Math.cos(x * 0.6)), -0.9 * (1 - k) + 0.6 * k * k - 0.3); }
  geo.computeVertexNormals(); const me = new THREE.Mesh(geo, waveMat); const crest = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.35, 40, 1), foamMat); crest.position.set(0, 1.45, 0.25); crest.rotation.x = -0.9; me.add(crest);
  const perp = new V3(-dir.z, 0, dir.x), pos = dir.clone().multiplyScalar(-16); let t = -delay; const hit = new Set();
  me.position.copy(pos); me.lookAt(pos.clone().add(dir)); me.visible = false;
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return; if (!me.parent) { G.scene.add(me); sfx('charge'); }
    const rise = Math.min(1, t / 0.6); me.visible = true; me.scale.set(1, 0.2 + 0.8 * rise, 1);
    if (t > 0.6) pos.addScaledVector(dir, 9.5 * dt); me.position.copy(pos);
    if (Math.random() < 0.9) G.fx.burst(pos.clone().addScaledVector(perp, rand(-13, 13)).setY(1.2), 2, [FOAM, SEA], 3, { dir: UP, spread: 0.8, grav: 9 });
    if (t > 0.6) for (const o of f.foes()) { if (hit.has(o.id)) continue; const rel = o.pos.clone().sub(pos); if (Math.abs(rel.dot(dir)) < 0.7 && Math.abs(rel.dot(perp)) < W / 2 && o.pos.y < 1.0) { hit.add(o.id); o.takeHit(f, { dmg: 55, kb: [10, 5], stun: 0.7, hs: 0.06, unblock: true, noCrit: true, st: ['slow', 2.5, 0.6] }, dir.clone()); } }
    if (pos.dot(dir) > 17) this.kill();
  }, kill() { this.done = true; G.scene.remove(me); geo.dispose(); crest.geometry.dispose(); } };
}
// 닻 던지기: 손에서 직선으로 날아가 맞으면 붙잡아 끌어온 뒤 후속 베기 ('reel')
const linkGeo = (() => { const g = new THREE.TorusGeometry(0.034, 0.01, 6, 12); g.scale(0.7, 1.3, 1); return g; })();
function anchorThrow(G, f, o) {
  const m = f.model, ch = m.chain, anc = m.anchor, start = m.handPos(new V3()), dir = o.chest(new V3()).sub(start).normalize(), p = start.clone();
  const im = new THREE.InstancedMesh(linkGeo, m.mats.iron, 40); im.frustumCulled = false; G.scene.add(im);
  ch.skip = true; let t = 0, phase = 'out', held = null; const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new V3(0, 1, 0), d = new V3(), one = new V3(1, 1, 1), mid = new V3();
  const draw = (h) => { d.subVectors(p, h); const L = d.length(), n = Math.min(40, Math.max(1, Math.round(L / 0.11))); d.normalize(); q.setFromUnitVectors(Y, d); im.count = n;
    for (let i = 0; i < n; i++) { mid.copy(h).addScaledVector(d, (i + 0.5) * (L / n)); const r = new THREE.Quaternion().setFromAxisAngle(Y, (i % 2) * Math.PI / 2); mt.compose(mid, q.clone().multiply(r), one); im.setMatrixAt(i, mt); } im.instanceMatrix.needsUpdate = true;
    anc.position.copy(p); anc.quaternion.setFromUnitVectors(Y, d.clone().negate()); anc.visible = true; };
  const finish = () => { ch.skip = false; ch.rope.ok = false; G.scene.remove(im); im.dispose(); if (held && held.held) held.release(); };
  return { done: false, owner: f, update(dt) {
    t += dt; const h = m.handPos(new V3());
    if (f.state !== 'act' || f.actName !== 's2' || f.state === 'ko') { if (held && held.held) { held.release(); held.state = 'hit'; held.stun = 0.3; } return this.kill(); }
    if (phase === 'out') { p.addScaledVector(dir, 24 * dt); if (Math.random() < 0.7) G.fx.p(p, { size: 0.3, size1: 0.05, life: 0.25, color: SEA, alpha: 0.7 });
      if (o.state !== 'ko' && o.hurtHit(p, 0.55) && o.takeHit(f, { dmg: 30, kb: [0, 0], stun: 1.6, hs: 0.1, unblock: true, noCrit: true }, dir.clone().negate()) === 'hit' && o.state !== 'ko') { phase = 'pull'; held = o; o.held = true; o.vel.set(0, 0, 0); sfx('heavy'); G.shake(0.2); }
      else if (p.distanceTo(start) > 11 || (G.stage && G.stage.world && G.stage.world.solidAt(p, 0.2))) phase = 'back'; }
    else if (phase === 'pull') { const to = f.pos.clone().sub(o.pos).setY(0), L = to.length(); if (L > 1.9) { o.pos.addScaledVector(to.normalize(), Math.min(L - 1.8, 13 * dt)); o.pos.y = Math.max(0, o.pos.y); } p.copy(o.chest(new V3()));
      if (L <= 1.95 || t > 1.6) { o.release(); o.state = 'hit'; o.stun = 0.55; o.vel.set(0, 0, 0); finish(); this.done = true; f.start('reel'); return; } }
    else { p.lerp(h, Math.min(1, dt * 10)); if (p.distanceTo(h) < 0.4) { finish(); this.done = true; return; } }
    draw(h);
  }, kill() { this.done = true; finish(); } };
}
// 유령 선원 소환
function summonCrew(f, o, G, n) {
  const pts = []; for (let i = 0; i < n; i++) { const a = f.yaw + (i - (n - 1) / 2) * 1.1 + Math.PI * 0.5 * (i % 2 ? 1 : -1), p = f.pos.clone().add(new V3(Math.sin(a) * 2.2, 0, Math.cos(a) * 2.2)); const r = Math.hypot(p.x, p.z); if (r > 12) p.multiplyScalar(12 / r); pts.push(p); }
  for (const p of pts) { G.fx.beam(p.clone().setY(0), { r: 0.7, h: 5, color: SEA, life: 0.7 }); G.fx.ring(p.clone().setY(0.06), { normal: UP, r0: 1.4, r1: 0.3, life: 0.6, color: SEA }); }
  G.spawn({ done: false, owner: f, t: 0, update(dt) { this.t += dt; if (this.t < 0.55) return; this.done = true; if (f.state === 'ko' || f.gone) return;
    for (const p of pts) { const a = new Fighter(CREW, 1, new EnemyAI(), G, CREW.palettes[0]); a.reset(p); a.opp = G.player || f.opp; a.ai = a.ctrl; a.faceOpp(); a.inv = 0.8; G.fighters.push(a); (f._adds || (f._adds = [])).push(a); G.fx.burst(p.clone().setY(1), 30, [SEA, FOAM], 5, { kind: 'glow', sk: 0.6 }); }
    sfx('spawn'); }, kill() { this.done = true; } });
}
// 영체화 주기 (2페이즈): 영체 3.2초 ↔ 실체 3.6초. 기술을 쓰는 동안은 실체가 된다
function etherCycle(G, f) {
  let t = 0, k = 0; f.etherOn = true;
  return { done: false, owner: f, update(dt) {
    if (f.state === 'ko' || f.gone || !G.fighters.includes(f)) { f.ether = false; f.model.setEther(0); f.spdMul = 1; return this.kill(); }
    t += dt; const cyc = t % 6.8, attacking = f.state === 'act' && f.act && !['ether', 'blink'].includes(f.actName) || f.brokenT > 0;
    const want = cyc < 3.2 && !attacking ? 1 : 0; f.ether = want > 0.5;
    if (want && k < 0.05 && Math.random() < 0.5) G.fx.burst(f.chest(new V3()), 18, [SEA, FOAM], 4, { kind: 'glow', sk: 0.7 });
    k += (want - k) * Math.min(1, dt * 7); f.model.setEther(k); f.spdMul = 1 + 0.35 * k;
    if (f.ether && Math.random() < dt * 20) G.fx.p(f.pos.clone().add(new V3(rand(-0.6, 0.6), rand(0.5, 2.6), rand(-0.6, 0.6))), { vel: [0, 0.8, 0], size: 0.15, size1: 0.02, life: 0.6, color: SEA, alpha: 0.6 });
  }, kill() { this.done = true; f.etherOn = false; } };
}
B.onReset = (f) => {
  f._cd = {}; f.ether = false; f.etherOn = false; f.spdMul = 1; if (f.model.setEther) f.model.setEther(0);
  if (f._adds) for (const a of f._adds) if (a.state !== 'ko') a.dot(null, 9999); f._adds = [];
  if (f._wrapped) return; f._wrapped = true;
  const th = f.takeHit.bind(f), dot = f.dot.bind(f);
  // 영체일 때: 공격이 몸을 통과한다
  f.takeHit = (att, h, dir) => { if (f.ether && !h.force && f.state !== 'ko' && att.team !== f.team) { if ((f._nT || 0) < f.G.time) { f._nT = f.G.time + 0.25; f.G.hud.damage(f.chest(new V3()).add(new V3(0, 0.5, 0)), '영체', false, true); f.G.fx.burst(f.chest(new V3()), 8, [SEA, FOAM], 3, { kind: 'glow', sk: 0.5 }); } return false; } return th(att, h, dir); };
  f.dot = (att, d, col) => (f.ether ? undefined : dot(att, d, col));
  f.G.spawn({ done: false, owner: f, update() { if (!f.G.fighters.includes(f) || f.state === 'ko') { for (const a of f._adds || []) if (a.state !== 'ko' && !a.gone) a.dot(null, 9999); if (!f.G.fighters.includes(f) || f.gone) this.done = true; } }, kill() { this.done = true; } });
};
const CALL = { spine: [-0.2, 0, 0], chest: [-0.15, 0, 0], head: [-0.3, 0, 0], shoulderL: [-2.7, 0, 0.45], elbowL: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.3], elbowR: [-0.2, 0, 0], weapon: [0.3, 0, 0] };
const L0 = S.boss.moves;
B.moves = {
  light1: { ...L0.light1, ev: [[0.5 + 0.08 * 1.25, swish]] }, light2: L0.light2, light3: L0.light3, heavy: { ...L0.heavy, cd: 'heavy' },
  // 포격 지원: 칼끝으로 하늘을 가리키면 배의 대포가 갑판을 가로지르는 줄을 차례로 포격 (빨강: 줄 밖으로)
  s1: { dur: 1.5, cd: 's1', aim: true, track: 0.4, tele: [0.2, 'red'], keys: [[0, 'base'], [0.45, { spine: [-0.2, 0, 0], head: [-0.4, 0, 0], shoulderR: [-3.0, 0, -0.15], elbowR: [-0.1, 0, 0], weapon: [0.2, 0, 0], shoulderL: [-0.5, 0, 0.6] }], [1.1, {}], [1.5, 'base']],
    ev: [[0.5, (f, o, G) => { if (!o) return; sfx('charge'); const a = rand(0, Math.PI), dir = new V3(Math.cos(a), 0, Math.sin(a)), perp = new V3(-dir.z, 0, dir.x), base = o.pos.clone().setY(0);
      const offs = f.enraged ? [-4.8, -1.6, 1.6, 4.8] : [-3.3, 0, 3.3], sh = rand(-0.8, 0.8);
      offs.forEach((d, i) => G.spawn(cannonLine(G, f, base.clone().addScaledVector(perp, d + sh), i % 2 ? dir.clone().negate() : dir, 24, 10, i * 0.25)));
      if (f.enraged) G.spawn(cannonLine(G, f, base.clone(), perp, 24, 10, 1.4)); }]] },
  // 닻 사슬: 사슬 닻을 던져 맞으면 끌어당긴다 (빨강: 막을 수 없음 → 회피)
  s2: { dur: 2.6, cd: 's2', aim: true, track: 0.55, tele: [0.15, 'red'], noMove: true, keys: [[0, 'base'], [0.5, { chest: [0, -0.6, 0], shoulderL: [-0.3, 0, 1.2], elbowL: [-0.4, 0, 0] }], [0.62, { chest: [0, 0.4, 0], shoulderL: [-1.6, 0, 0.1], elbowL: [0, 0, 0] }], [1.2, { chest: [0, 0.3, 0], shoulderL: [-1.2, 0, 0.2], elbowL: [-1.4, 0, 0] }], [2.6, 'base']],
    ev: [[0.08, () => sfx('charge')], [0.6, (f, o, G) => { if (!o) return; sfx('swing'); G.spawn(anchorThrow(G, f, o)); }]] },
  // 끌어당긴 뒤 후속 베기
  reel: { dur: 0.9, aim: true, trail: true, track: 0.1, keys: [[0, { chest: [0, -1.0, 0], shoulderR: [-1.4, 0, -0.6], elbowR: [-0.3, 0, 0], weapon: [1.5, 0, 0] }], [0.12, { chest: [0, -1.1, 0] }], [0.3, { chest: [0.2, 1.0, 0], spine: [0.25, 0.4, 0], shoulderR: [-1.4, 0, 0.4] }], [0.9, 'base']],
    ev: [[0.13, (f) => { sfx('heavy'); f.slashFx({ tilt: 0.1, r: 1.5 * f.scale, at: [0, 1.2 * f.scale, 0.4] }); }]], hits: [{ t0: 0.12, t1: 0.3, at: [0, 1.1, 1.0], r: 0.9, weapon: false, dmg: 70, kb: [8, 5], stun: 0.6, hs: 0.1, noCrit: true, st: bst }] },
  // 유령 선원 소환
  crew: { dur: 1.5, aim: true, noMove: true, keys: [[0, 'base'], [0.4, { ...CALL, shoulderR: [-1.2, 0, -0.9] }], [1.2, {}], [1.5, 'base']], ev: [[0.05, () => sfx('charge')], [0.45, (f, o, G) => { setCd(f, 'crew', 18); const n = Math.min(f.enraged ? 3 : 2, 3 - addsOf(f).length); if (n > 0) summonCrew(f, o, G, n); }]] },
  // 해일: 두 팔을 들어 바다를 부른다 → 낮은 물벽이 경기장을 가로지름 (점프로 넘거나 회피). 2페이즈: 직각으로 두 번
  wave: { dur: 1.8, aim: true, noMove: true, tele: [0.25, 'red'], keys: [[0, 'base'], [0.6, CALL], [1.4, CALL], [1.8, 'base']],
    ev: [[0.05, () => sfx('charge')], [0.7, (f, o, G) => { setCd(f, 'wave', 11); const base = o ? o.pos.clone().sub(f.pos).setY(0).normalize() : f.fwd(new V3()); if (base.lengthSq() < 0.1) f.fwd(base); G.spawn(tidalWave(G, f, base)); if (f.enraged) G.spawn(tidalWave(G, f, new V3(-base.z, 0, base.x), 1.6)); G.fx.burst(f.chest(new V3()), 30, [SEA, FOAM], 6, { kind: 'glow', sk: 0.6 }); }]] },
  // 망령 도약 (2페이즈): 사라졌다가 등 뒤에서 나타나 벤다 (노랑)
  blink: { dur: 1.35, aim: false, trail: true, noMove: true, tele: [0.6, 'yellow'], keys: [[0, 'base'], [0.25, { spine: [0.4, 0, 0] }], [0.62, { chest: [0, -1.0, 0], shoulderR: [-1.45, 0, -0.5], elbowR: [-0.25, 0, 0], weapon: [1.5, 0, 0] }], [0.82, { chest: [0, -1.1, 0] }], [0.98, { chest: [0.2, 1.0, 0], spine: [0.25, 0.4, 0], shoulderR: [-1.4, 0, 0.35] }], [1.35, 'base']],
    ev: [[0.05, (f, o, G) => { setCd(f, 'blink', 5); f.inv = 0.6; f.root.visible = false; G.fx.burst(f.chest(new V3()), 40, [SEA, FOAM, 0x000000], 5, { kind: 'glow', sk: 0.8 }); sfx('dash'); }],
      [0.5, (f, o, G) => { f.root.visible = true; if (o) { const b = o.fwd(new V3()); f.pos.set(o.pos.x - b.x * 1.7, 0, o.pos.z - b.z * 1.7); const r = Math.hypot(f.pos.x, f.pos.z); if (r > 13) f.pos.multiplyScalar(13 / r); f.faceOpp(); } f.wJump = true; G.fx.burst(f.chest(new V3()), 40, [SEA, FOAM], 6, { kind: 'glow', sk: 0.8 }); }],
      [0.83, (f) => { sfx('heavy'); f.slashFx({ tilt: 0.15, r: 1.5 * f.scale, at: [0, 1.15 * f.scale, 0.35] }); }]],
    hits: [{ t0: 0.83, t1: 1.0, at: [0, 1.1, 1.0], r: 0.95, weapon: false, dmg: 68, kb: [6, 3], stun: 0.5, hs: 0.08, noCrit: true, st: bst }], end: (f) => { f.root.visible = true; } },
  // 영체화 (2페이즈 시작)
  ether: { dur: 1.8, aim: true, noMove: true, keys: [[0, 'base'], [0.5, { ...CALL, head: [-0.5, 0, 0] }], [1.4, CALL], [1.8, 'base']],
    ev: [[0.1, () => sfx('charge')], [0.7, (f, o, G) => { if (f.etherOn) return; G.spawn(etherCycle(G, f)); G.fx.ring(f.chest(new V3()), { r0: 0.3, r1: 5, life: 0.6, color: SEA, billboard: true }); G.hud.pop && G.hud.pop('영체화', 'cyan'); G.shake(0.2); }]] },
};
B.ai = { range: 7, keep: 2.6, cdMin: 0.8, cdMax: 1.7, chain: 0.8,
  pick: (f, o, d) => {
    const R = Math.random();
    if (f.enraged && !f.etherOn) return 'ether';
    if (ready(f, 'crew') && addsOf(f).length < 2 && R < 0.35) return 'crew';
    if (d > 4.5 && f.cd.s2 <= 0 && Math.random() < 0.5) return 's2';
    if (ready(f, 'wave') && Math.random() < 0.3) return 'wave';
    if (d > 3 && f.cd.s1 <= 0 && Math.random() < 0.45) return 's1';
    if (f.enraged && ready(f, 'blink') && d > 2.5 && Math.random() < 0.55) return 'blink';
    if (d < 3.2) return Math.random() < 0.72 ? 'light' : f.cd.heavy <= 0 ? 'heavy' : 'light';
    return null;
  } };
S.boss.moveList = [['커틀러스 3연격', '노랑'], ['포격 지원', '빨강 · 줄 포격'], ['닻 사슬', '빨강 · 끌어당기기 + 베기'], ['유령 선원', '소환 2~3'], ['해일', '빨강 · 점프로 넘기'], ['영체화', '2페이즈 · 실체일 때만 피해'], ['망령 도약', '2페이즈 · 등 뒤 베기']];
export default S;
