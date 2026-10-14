// 7. 천봉 정상 — 타락한 수행승 · 바람매 궁수 · 돌사자 해태 · 천둥 산신 뇌공
// 잡몹 · 원거리 · 정예는 공용 기술(makeSet)에 새 모델을 입히고, 보스 뇌공은 번개 전용 기술을 따로 쓴다.
//   뇌공: 중거리에서 떠다니며 번개를 다루는 술사형 — 마디마디 튀는 연쇄 번개(선을 피해 서야 한다) · 땅을 타고 퍼지는 북 충격파(뛰어 넘기)
//         하늘로 날아올라 표식 위로 내리꽂기 · 플레이어를 가두는 번개 감옥(울타리에 닿지 말고 가운데 낙뢰를 피하기)
//         2페이즈: 머리 위에 영구 뇌운이 생겨 1초 전 플레이어가 서 있던 자리에 계속 벼락이 떨어진다 · 연쇄 마디 · 충격파 수가 늘어난다
import * as THREE from 'three';
import { makeSet, slow, poses as P0 } from '../kit.js';
import { areaHit } from '../../entities.js';
import { rand, sfx } from '../../core.js';
import { ARENA_R } from '../../stage.js';
import trainer from '../../characters/trainer.js';
import { cached } from '../../sculpt.js';
import { V3, TAU, UP, Missile, groundMark, bolt, phys, glowMat } from './plains_lib.js';
import { buildMonk, buildHawk } from './peak_model.js';
import { buildHaetae } from './peak_haetae.js';
import { buildNoegong } from './peak_noegong.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });
const TM = trainer.moves;

const S = makeSet({ id: 'peak',
  grunt: { name: '타락한 수행승', short: '수행승', title: '정상의 파계승', fast: true, col: C(0xffb04a, 0xa83a1a, 0x2a1a14, { cloth: 0xc84a1a, band: '#2a1004' }), model: {} },
  archer: { name: '바람매 궁수', short: '매궁수', title: '하늘 사냥꾼', skill: '바람 화살', col: C(0xa8e0ff, 0x5a4a3a, 0x2a2420, { cloth: 0x6a5a4a, band: '#0a1a2a' }), model: {}, shot: { dmg: 22, n: 3, color: 0xc8f0ff, speed: 20, homing: 0.3, r: 0.22 } },
  brute: { name: '돌사자 해태', short: '해태', title: '불탑의 문지기', scale: 1.6, plan: 'quad', kind: 'lion', col: C(0x7ad0ff, 0x8a8a80, 0x8a8a80, { cloth: 0x6a6a64, band: '#14181a' }), model: {}, skill: '바위 내려찍기', st: ['slow', 2, 0.6] },
  boss: { name: '천둥 산신 뇌공', short: '뇌공', title: '구름 위의 산신', col: C(0x8ad8ff, 0x2a2a4a, 0x10101c, { trim: 0xffd060, cloth: 0x3a3a6a, band: '#060a2a' }), model: {} },
});
S.grunt.createModel = (p) => buildMonk(p);
S.archer.createModel = (p) => buildHawk(p);
S.brute.createModel = (p) => buildHaetae(p);
// 바람매 궁수: 구 대신 진짜 화살 세 발 (활 손잡이에서 부채꼴)
const arrowGeo = () => cached('peak:arrow', () => { const g = new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6); g.rotateX(Math.PI / 2); return g; });
const arrowHead = () => cached('peak:arrowH', () => { const g = new THREE.ConeGeometry(0.03, 0.1, 4); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.4); return g; });
const arrowFl = () => cached('peak:arrowF', () => { const g = new THREE.PlaneGeometry(0.06, 0.14); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.3); return g; });
let arrowM = null;
function windArrows(f, o, G) {
  if (!o) return; arrowM = arrowM || { s: phys({ color: 0x5a3a20, roughness: 0.5 }), h: phys({ color: 0xc8d8e8, metalness: 1, roughness: 0.25 }), f: phys({ color: 0xf0f4ff, emissive: 0x6ab0ff, emissiveIntensity: 0.6, side: THREE.DoubleSide }) };
  const h = f.model.tipPos(new V3());
  for (let i = -1; i <= 1; i++) { const d = o.chest(new V3()).sub(h).normalize().applyAxisAngle(UP, i * 0.2), mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(arrowGeo(), arrowM.s), new THREE.Mesh(arrowHead(), arrowM.h)); const fl = new THREE.Mesh(arrowFl(), arrowM.f); mesh.add(fl); const fl2 = fl.clone(); fl2.rotation.z = Math.PI / 2; mesh.add(fl2);
    G.spawn(new Missile(G, { owner: f, pos: h.clone().addScaledVector(d, 0.3), vel: d.multiplyScalar(20), mesh, r: 0.24, homing: 0.3, color: 0xc8f0ff, scale: 1.2, life: 2.5, trail: 0.6, hit: { dmg: 22 / Math.sqrt(3) * 1.7, kb: [4, 3], stun: 0.45, hs: 0.06, noCrit: true } })); }
  sfx('shot');
}
S.archer.moves.s1.ev = S.archer.moves.s1.ev.map(([t]) => [t, windArrows]);

/* =====================================================================
   보스: 천둥 산신 뇌공
   ===================================================================== */
const ACC = (f) => f.palette.accent, WHITE = 0xffffff;
const H = (o) => ({ noCrit: true, ...o });
// 지면 충격파 고리: 땅에 붙은 상대만 맞는다 (뛰어서 피한다)
function shockRing(G, f, c, r1, dur, dmg) {
  let t = 0; const hit = new Set(), col = ACC(f);
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 72), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.rotation.x = Math.PI / 2; mesh.position.set(c.x, 0.18, c.z); G.scene.add(mesh); sfx('boom'); G.shake(0.18);
  G.spawn({ done: false, owner: f, update(dt) {
    t += dt; const k = Math.min(1, t / dur), R = 0.8 + (r1 - 0.8) * k; mesh.scale.set(R, R, 1 + 3 * (1 - k)); mesh.material.opacity = 0.9 * (1 - k * 0.5);
    for (let i = 0; i < 5; i++) { const a = rand(0, TAU); G.fx.p(new V3(c.x + Math.cos(a) * R, 0.15, c.z + Math.sin(a) * R), { vel: [0, rand(1, 4), 0], size: 0.22, life: 0.25, color: Math.random() < 0.3 ? WHITE : col, alpha: 0.9 }); }
    for (const o of f.foes()) { if (hit.has(o.id)) continue; const d = Math.hypot(o.pos.x - c.x, o.pos.z - c.z); if (Math.abs(d - R) < 0.5 + 0.3 * o.scale && o.pos.y - (o.gy || 0) < 0.45) { if (o.takeHit(f, { dmg, kb: [6, 5], stun: 0.5, hs: 0.06, unblock: true, noCrit: true, st: ['vuln', 3, 1.15] }, new V3(o.pos.x - c.x, 0, o.pos.z - c.z).normalize())) hit.add(o.id); } }
    if (k >= 1) this.kill();
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); } });
}
// 낙뢰 한 번: 하늘(또는 from)에서 점 p 로 · 범위 피해
function strike(G, f, p, r, dmg, from) {
  const top = from ? from.clone() : p.clone().setY(14); bolt(G, top, p.clone().setY(0.1), ACC(f), { n: 18, jit: 0.8, size: 0.5, life: 0.22 }); bolt(G, top, p.clone().setY(0.1), WHITE, { n: 12, jit: 0.5, size: 0.3, life: 0.18 });
  G.fx.beam(p.clone().setY(0), { r: r * 0.5, h: 14, color: ACC(f), life: 0.4 }); G.fx.ring(p.clone().setY(0.06), { normal: UP, r0: 0.3, r1: r * 1.5, life: 0.4, color: ACC(f) });
  G.fx.burst(p.clone().setY(0.4), 26, [ACC(f), WHITE], 10, { dir: UP, spread: 1.3 }); G.fx.light(p.clone().setY(1.5), ACC(f), 110, 0.3, 18); sfx('zap'); sfx('boom'); G.shake(0.2); G.stage && G.stage.flashSky && G.stage.flashSky(0.25);
  areaHit(f, p, r, { dmg, kb: [3, 8], stun: 0.6, hs: 0.08, unblock: true, noCrit: true, st: ['vuln', 3, 1.2] }, 3);
}
// 감전 구슬 (연쇄 번개 마디 · 감옥 기둥)
let orbMat = null; const orbGeo = () => cached('peak:orb', () => new THREE.IcosahedronGeometry(0.22, 2));
const postGeo = () => cached('peak:post', () => { const g = new THREE.CylinderGeometry(0.08, 0.12, 2.2, 8); g.translate(0, 1.1, 0); return g; });

/* ---------- 연쇄 번개: 마디(구슬)를 차례로 튀며 선분마다 감전 · 마지막은 플레이어가 서 있던 자리에 낙뢰 ---------- */
function chainLightning(G, f, o) {
  const n = f.enraged ? 5 : 3, warn = 0.8, gap = 0.13, base = rand(0, TAU), R = 3.3, nodes = [f.model.tipPos(new V3())];
  for (let j = 0; j < n; j++) { const a = base + (j / n) * TAU * 0.92; nodes.push(new V3(o.pos.x + Math.cos(a) * R, 1.15, o.pos.z + Math.sin(a) * R)); }
  const fin = o.pos.clone().setY(0); nodes.push(fin.clone().setY(1.0));
  orbMat = orbMat || glowMat(0xbaf0ff, 3); const orbs = nodes.slice(1, -1).map((p) => { const m = new THREE.Mesh(orbGeo(), orbMat); m.position.copy(p); G.scene.add(m); return m; });
  groundMark(G, { kind: 'disc', x: fin.x, z: fin.z, r: 1.5, life: warn + gap * n + 0.05, color: 0xff2a3a, owner: f });
  let t = 0, done = 0; const hit = new Set();
  G.spawn({ done: false, owner: f, update(dt) {
    t += dt; orbs.forEach((m, i) => { m.scale.setScalar(0.8 + 0.3 * Math.sin(t * 30 + i)); m.rotation.y += dt * 5; });
    if (t < warn) { // 예고: 마디 사이에 붉은 점선
      if (Math.random() < 0.5) for (let i = 0; i < nodes.length - 1; i++) { const a = nodes[i], b = nodes[i + 1]; for (let k = 0; k < 6; k++) G.fx.p(a.clone().lerp(b, Math.random()), { size: 0.12, life: 0.12, color: 0xff3a4a, alpha: 0.9 }); }
      return; }
    while (done < nodes.length - 1 && t >= warn + done * gap) {
      const a = nodes[done], b = nodes[done + 1], last = done === nodes.length - 2; done++;
      bolt(G, a, b, ACC(f), { n: 16, jit: 0.4, size: 0.4 }); bolt(G, a, b, WHITE, { n: 10, jit: 0.25, size: 0.22 }); G.fx.light(b, ACC(f), 70, 0.2); sfx('zap');
      if (done - 1 < orbs.length) { G.scene.remove(orbs[done - 1]); G.fx.burst(b, 14, [ACC(f), WHITE], 6); }
      for (const tg of f.foes()) if (!hit.has(tg.id) && tg.hurtHitSeg(a, b, 0.42)) { if (tg.takeHit(f, { dmg: 48, kb: [4, 3], stun: 0.5, hs: 0.06, unblock: true, noCrit: true }, new V3().subVectors(b, a).setY(0).normalize())) hit.add(tg.id); }
      if (last) strike(G, f, fin, 1.5, 70, b.clone().setY(6));
    }
    if (done >= nodes.length - 1) this.kill();
  }, kill() { if (this.done) return; this.done = true; for (const m of orbs) G.scene.remove(m); } });
}
/* ---------- 번개 감옥: 플레이어 둘레에 기둥 여덟 · 울타리(닿으면 감전) · 가운데 낙뢰 (2페이즈: 한 번 더) ---------- */
function lightningCage(G, f, o) {
  const c = o.pos.clone().setY(0), R = 3.4, N = 8, life = 4.4, posts = [], cool = {}; orbMat = orbMat || glowMat(0xbaf0ff, 3);
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU, m = new THREE.Mesh(postGeo(), orbMat); m.position.set(c.x + Math.cos(a) * R, 0, c.z + Math.sin(a) * R); m.scale.y = 0.01; G.scene.add(m); posts.push(m); G.fx.beam(m.position.clone(), { r: 0.4, h: 6, color: ACC(f), life: 0.4 }); }
  groundMark(G, { kind: 'ring', x: c.x, z: c.z, r: R + 0.3, life, color: 0xff2a3a, owner: f, op: 0.5 });
  const strikes = [{ at: 2.1, p: c.clone(), m: false, s: false }]; if (f.enraged) { const a = rand(0, TAU); strikes.push({ at: 3.1, p: c.clone().add(new V3(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7)), m: false, s: false }); }
  let t = 0; sfx('charge');
  G.spawn({ done: false, owner: f, update(dt) {
    t += dt; const up = Math.min(1, t / 0.5); posts.forEach((m) => { m.scale.y = up * (0.9 + 0.1 * Math.sin(t * 40)); });
    if (t > 0.6 && t < life - 0.2) {
      for (let k = 0; k < 2; k++) { const i = (Math.random() * N) | 0, a = posts[i].position.clone().setY(rand(0.4, 1.9)), b = posts[(i + 1) % N].position.clone().setY(rand(0.4, 1.9)); bolt(G, a, b, Math.random() < 0.5 ? ACC(f) : WHITE, { n: 8, jit: 0.25, size: 0.25, life: 0.1 }); }
      for (const tg of f.foes()) { if ((cool[tg.id] = (cool[tg.id] ?? 0) - dt) > 0) continue; const d = Math.hypot(tg.pos.x - c.x, tg.pos.z - c.z);
        if (Math.abs(d - R) < 0.4 + 0.3 * tg.scale && tg.pos.y < 2.2) { cool[tg.id] = 0.8; tg.takeHit(f, { dmg: 40, kb: [5, 3], stun: 0.45, hs: 0.05, unblock: true, noCrit: true }, new V3(c.x - tg.pos.x, 0, c.z - tg.pos.z).normalize()); sfx('zap'); } }
    }
    for (const s of strikes) { if (!s.m && t > s.at - 1.05) { s.m = true; groundMark(G, { kind: 'disc', x: s.p.x, z: s.p.z, r: 1.8, life: 1.05, color: 0xff2a3a, owner: f }); } if (!s.s && t > s.at) { s.s = true; strike(G, f, s.p, 1.8, 90); } }
    if (t > life) this.kill();
  }, kill() { if (this.done) return; this.done = true; for (const m of posts) G.scene.remove(m); } });
}
/* ---------- 영구 뇌운 (2페이즈): 플레이어 머리 위를 따라다니며, 1초 전 서 있던 자리에 벼락 ---------- */
let cloudMat = null;
function thunderCloud(G, f) {
  cloudMat = cloudMat || new THREE.MeshStandardMaterial({ color: 0x2a2e3a, emissive: 0x3a6aaa, emissiveIntensity: 0.2, roughness: 1, transparent: true, opacity: 0.92 });
  const g = new THREE.Group(); for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(cached('peak:puff', () => new THREE.IcosahedronGeometry(1, 2)), cloudMat); const a = i * 2.4, r = 0.4 + (i % 4) * 0.45; s.position.set(Math.cos(a) * r * 1.4, Math.sin(i * 1.3) * 0.3, Math.sin(a) * r); s.scale.setScalar(0.9 + (i % 3) * 0.35); g.add(s); }
  const o0 = f.opp; g.position.set(o0 ? o0.pos.x : 0, 9, o0 ? o0.pos.z : 0); g.scale.setScalar(0.01); G.scene.add(g);
  let t = 0, next = 1.2; const pend = [];
  const ent = { done: false, owner: f, update(dt) {
    t += dt; g.scale.setScalar(Math.min(1.3, t * 1.3)); g.rotation.y += dt * 0.2;
    if (f.state === 'ko' || f.gone || f.hp <= 0) return this.kill();
    const o = f.opp; if (!o) return;
    g.position.x += (o.pos.x - g.position.x) * Math.min(1, dt * 1.2); g.position.z += (o.pos.z - g.position.z) * Math.min(1, dt * 1.2);
    cloudMat.emissiveIntensity = 0.2 + (Math.random() < 0.04 ? 2 : 0);
    if (Math.random() < 0.3) G.fx.p(g.position.clone().add(new V3(rand(-2, 2), -0.8, rand(-1.5, 1.5))), { vel: [0, -2, 0], size: 0.1, life: 0.5, color: 0x9ad8ff, alpha: 0.6 });
    if (t > next) { next = t + (f.enraged ? 1.6 : 2); const p = o.pos.clone().setY(0), R = Math.hypot(p.x, p.z); if (R > ARENA_R - 0.5) p.multiplyScalar((ARENA_R - 0.5) / R);
      groundMark(G, { kind: 'disc', x: p.x, z: p.z, r: 1.4, life: 1.0, color: 0xff2a3a, owner: f }); pend.push({ p, at: t + 1.0 }); }
    for (let i = pend.length - 1; i >= 0; i--) if (t >= pend[i].at) { strike(G, f, pend[i].p, 1.4, 55, g.position.clone().add(new V3(0, -0.6, 0))); pend.splice(i, 1); }
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(g); } };
  G.spawn(ent); return ent;
}

/* ---------- 자세 ---------- */
const ngPoses = (() => { const o = {}; for (const k in P0) o[k] = { ...P0[k] };
  const feet = { footL: [0.55, 0, 0], footR: [0.5, 0, 0] };
  o.base = { ...P0.base, hips: [0, -0.2, 0], spine: [0.05, 0.1, 0], chest: [-0.05, 0.1, 0], head: [-0.05, 0.1, 0], shoulderL: [-0.35, 0, 0.55], elbowL: [-1.0, 0, 0], shoulderR: [-0.45, 0, -0.5], elbowR: [-1.1, 0, 0], weapon: [0.6, 0, 0],
    hipL: [-0.3, 0, 0.1], kneeL: [0.5, 0, 0], hipR: [0.1, 0, -0.12], kneeR: [0.7, 0, 0], ...feet };
  o.run = { ...P0.run, spine: [0.35, 0, 0], ...feet, hipL: [-0.2, 0, 0.1], kneeL: [0.9, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [1.1, 0, 0], shoulderL: [0.5, 0, 0.6], shoulderR: [0.5, 0, -0.6] };
  o.win = { ...P0.win, shoulderL: [-2.8, 0, 0.3], elbowL: [-0.3, 0, 0], ...feet };
  return o; })();
const UPA = { shoulderL: [-2.7, 0, 0.5], elbowL: [-0.5, 0, 0], shoulderR: [-2.7, 0, -0.5], elbowR: [-0.5, 0, 0], weapon: [1.2, 0, 0], spine: [-0.15, 0, 0], head: [-0.3, 0, 0] };

const B = S.boss;
Object.assign(B, {
  scale: 1.6,
  stats: { hp: 4200, speed: 4.6, jump: 9, daze: 340, armor: true, breakTime: 5 },
  skills: { s1: { name: '연쇄 번개', cd: 6 }, s2: { name: '뇌고 진동파', cd: 9 }, ult: { name: '-', sub: '' }, dive: { name: '천뢰 강림', cd: 9 }, cage: { name: '뇌옥', cd: 11 }, storm: { name: '뇌운', cd: 3 } },
  createModel: (p) => buildNoegong(p), poses: ngPoses,
  moves: {
    // 북채 연타 (노랑): 오른 북채 가로치기 → 왼 북채 내려치기
    light1: { ...slow(TM.light1, { k: 1.25, windup: 0.5, next: 'light2', dmg: 1.45, ev: [[0.5 + 0.08 * 1.25, (f, o, G) => { sfx('swing'); f.slashFx({ tilt: 0.15, r: 1.4 * f.scale, at: [0, 1.15 * f.scale, 0.35] }); f.model.beat(1); }]] }) },
    light2: { ...slow(TM.light2, { k: 1.25, windup: 0.2, tele: null, dmg: 1.45, ev: [[0.2 + 0.09 * 1.25, (f, o, G) => { sfx('heavy'); f.slashFx({ tilt: Math.PI / 2, r: 1.4 * f.scale, at: [0.05, 1.1 * f.scale, 0.3], flip: true }); G.fx.burst(f.local([0, 0.3, 1.4 * f.scale]), 14, [ACC(f), WHITE], 6); f.model.beat(5); }]] }) },
    // 뇌성 강타 (노랑): 두 북채를 머리 위로 모아 앞을 내려찍는다 — 패리 가능
    heavy: { dur: 1.3, aim: true, track: 0.45, tele: [0.15, 'yellow'],
      keys: [[0, 'base'], [0.55, { ...UPA }], [0.72, { spine: [0.55, 0, 0], shoulderL: [-1.2, 0, 0.2], shoulderR: [-1.2, 0, -0.2], elbowL: [-0.2, 0, 0], elbowR: [-0.2, 0, 0], weapon: [0.6, 0, 0], head: [0, 0, 0] }], [1.3, 'base']],
      ev: [[0.3, () => sfx('charge')], [0.72, (f, o, G) => { const c = f.local([0, 0, 1.5 * f.scale]).setY(0.05); sfx('boom'); G.shake(0.25); bolt(G, c.clone().setY(3), c, ACC(f), { n: 10 }); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 3, life: 0.4, color: ACC(f) }); G.fx.burst(c, 30, [ACC(f), WHITE], 9, { dir: UP, spread: 1.2 }); areaHit(f, c, 2.3, { dmg: 90, kb: [6, 7], stun: 0.6, hs: 0.1, noCrit: true, st: ['vuln', 3, 1.15] }); f.model.beat(0); f.model.beat(4); }]] },
    // 연쇄 번개 (빨강): 북채를 치켜들면 플레이어 둘레에 구슬 마디가 생기고, 번개가 마디를 차례로 튄다
    s1: { dur: 1.5, cd: 's1', aim: true, track: 0.4, tele: [0.15, 'red'],
      keys: [[0, 'base'], [0.4, { shoulderR: [-2.9, 0, -0.3], elbowR: [-0.2, 0, 0], weapon: [1.3, 0, 0], spine: [-0.1, 0.2, 0] }], [1.1, {}], [1.5, 'base']],
      tick: (f, o, G, t) => { if (t > 0.2 && t < 0.5) G.fx.p(f.model.tipPos(new V3()), { size: 0.5, size1: 0.1, life: 0.12, color: ACC(f) }); },
      ev: [[0.45, (f, o, G) => { if (o) chainLightning(G, f, o); f.model.beat(2); sfx('charge'); }]] },
    // 뇌고 진동파 (빨강): 등 뒤 북을 연달아 쳐서 땅을 타고 퍼지는 충격파 셋(2페이즈 넷) — 타이밍 맞춰 뛰어 넘는다
    s2: { dur: 2.3, cd: 's2', aim: true, track: 0.4, tele: [0.15, 'red'], noMove: true,
      keys: [[0, 'base'], [0.35, { shoulderL: [-1.6, 0, 1.3], shoulderR: [-1.6, 0, -1.3], elbowL: [-1.2, 0, 0], elbowR: [-1.2, 0, 0], weapon: [1.4, 0, 0], spine: [-0.15, 0, 0] }],
        [0.6, { shoulderL: [-0.8, 0, 1.5], shoulderR: [-2.2, 0, -1.1] }], [1.0, { shoulderL: [-2.2, 0, 1.1], shoulderR: [-0.8, 0, -1.5] }], [1.4, { shoulderL: [-0.8, 0, 1.5], shoulderR: [-2.2, 0, -1.1] }], [1.8, { shoulderL: [-2.2, 0, 1.1], shoulderR: [-0.8, 0, -1.5] }], [2.3, 'base']],
      ev: [0.62, 1.02, 1.42, 1.82].map((tt, i) => [tt, (f, o, G) => { if (i === 3 && !f.enraged) return; f.model.beat(i * 2); f.model.beat(i * 2 + 1); shockRing(G, f, f.pos, 13, f.enraged ? 1.0 : 1.2, 55); }]) },
    // 천뢰 강림 (빨강): 날개를 펴고 하늘로 솟아 플레이어를 따라가는 표식을 띄운 뒤, 표식이 멈춘 자리로 내리꽂는다
    dive: { dur: 2.7, cd: 'dive', aim: true, track: 0.25, tele: [0.1, 'red'], noMove: true, wings: true,
      keys: [[0, 'base'], [0.3, { ...(P0.crouch || P0.charge), shoulderL: [0.4, 0, 0.6], shoulderR: [0.4, 0, -0.6] }], [0.5, { ...P0.jump, ...UPA }], [1.65, { ...P0.jump, ...UPA }], [1.85, { spine: [0.8, 0, 0], shoulderL: [-1.0, 0, 0.3], shoulderR: [-1.0, 0, -0.3], hipL: [-1.2, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.6, 0, 0], kneeR: [1.4, 0, 0], weapon: [0.4, 0, 0] }], [2.1, { spine: [0.7, 0, 0], hipL: [-1.4, 0, 0.2], kneeL: [2.0, 0, 0], hipR: [-0.4, 0, -0.2], kneeR: [1.8, 0, 0] }], [2.7, 'base']],
      start: (f) => { f._dv = { y0: f.pos.y, from: null, to: null, mark: null }; },
      tick: (f, o, G, t) => { const D = f._dv; if (!D) return;
        if (t >= 0.3 && t < 1.7) { f.float = true; f.onGround = false; f.vel.set(0, 0, 0); f.pos.y = 7.5 * Math.min(1, (t - 0.3) / 0.5) ** 0.6 + Math.sin(t * 6) * 0.1;
          if (o && t > 0.8) { f.pos.x += (o.pos.x - f.pos.x) * Math.min(1, 0.02); f.pos.z += (o.pos.z - f.pos.z) * Math.min(1, 0.02); f.faceOpp(); }
          if (Math.random() < 0.5) G.fx.p(f.chest().add(new V3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6))), { size: 0.3, life: 0.2, color: ACC(f), alpha: 0.7 }); }
        else if (t >= 1.7 && t < 1.95) { if (!D.from) { D.from = f.pos.clone(); D.to = D.mark ? D.mark.mesh.position.clone().setY(0) : f.pos.clone().setY(0); sfx('dash'); }
          const k = (t - 1.7) / 0.25; f.pos.lerpVectors(D.from, D.to, k * k); f.vel.set(0, 0, 0); f.float = true; G.fx.p(f.chest(), { size: 1.0, size1: 0.2, life: 0.2, color: ACC(f), alpha: 0.8 }); } },
      ev: [[0.3, (f, o, G) => { sfx('jump'); G.fx.burst(f.pos.clone().setY(0.1), 26, 0x8a8aa0, 6, { kind: 'dust', sk: 1.4 }); G.fx.ring(f.pos.clone().setY(0.06), { normal: UP, r0: 0.5, r1: 4, life: 0.5, color: ACC(f) }); }],
        [0.9, (f, o, G) => { if (!o) return; f._dv.mark = groundMark(G, { kind: 'disc', x: o.pos.x, z: o.pos.z, r: 3.0, life: 1.1, color: 0xff2a3a, owner: f, follow: (s) => { if (f.at < 1.55 && f.opp) s.mesh.position.set(f.opp.pos.x, 0.04, f.opp.pos.z); } }); }],
        [1.95, (f, o, G) => { const D = f._dv; f.float = false; f.pos.y = 0; f.vel.set(0, 0, 0); f.onGround = true; strike(G, f, f.pos.clone().setY(0), 3.0, 120, f.pos.clone().setY(12)); G.shake(0.45); G.flash && G.flash(0xbaf0ff, 0.25); }]],
      end: (f) => { f.float = false; f._dv = null; } },
    // 뇌옥 (빨강): 플레이어 둘레에 번개 기둥 울타리 — 울타리에 닿으면 감전, 가운데에 낙뢰가 떨어진다
    cage: { dur: 1.4, cd: 'cage', aim: true, track: 0.3, tele: [0.15, 'red'],
      keys: [[0, 'base'], [0.45, { shoulderL: [-1.5, 0, 0.9], shoulderR: [-1.5, 0, -0.9], elbowL: [-0.3, 0, 0], elbowR: [-0.3, 0, 0], weapon: [1.0, 0, 0], spine: [-0.1, 0, 0] }], [0.9, { shoulderL: [-1.7, 0, 0.3], shoulderR: [-1.7, 0, -0.3] }], [1.4, 'base']],
      ev: [[0.5, (f, o, G) => { if (o) lightningCage(G, f, o); for (let i = 0; i < 8; i++) f.model.beat(i); }]] },
    // 뇌운 (2페이즈 시작): 하늘에 영구 뇌운을 부른다 — 1초 전 플레이어 자리에 계속 벼락
    storm: { dur: 1.7, cd: 'storm', aim: true, tele: [0.2, 'red'], noMove: true, wings: true,
      keys: [[0, 'base'], [0.5, { ...UPA }], [1.3, { ...UPA }], [1.7, 'base']],
      tick: (f, o, G, t) => { if (t > 0.4 && t < 1.3 && Math.random() < 0.6) bolt(G, f.chest().add(new V3(0, 1.2 * f.scale, 0)), f.chest().add(new V3(rand(-2, 2), 5, rand(-2, 2))), ACC(f), { n: 8, size: 0.3 }); },
      ev: [[0.7, (f, o, G) => { if (!f._cloud || f._cloud.done) f._cloud = thunderCloud(G, f); sfx('teleRed'); G.shake(0.3); G.setTint && G.setTint(0x2a3a6a, 0.35, 1.2); }]] },
  },
  ai: { range: 10, keep: 3.5, cdMin: 0.9, cdMax: 1.9, chain: 0.7,
    pick: (f, o, d) => {
      const ok = (k) => (f.cd[k] ?? 0) <= 0, r = Math.random();
      if (f.enraged && !(f._cloud && !f._cloud.done) && ok('storm')) return 'storm';
      if (d > 6 && ok('dive') && r < 0.45) return 'dive';
      if (d > 3.2 && ok('s1') && r < 0.6) return 's1';
      if (d > 2.2 && ok('cage') && r < 0.45) return 'cage';
      if (d < 5.5 && ok('s2') && r < 0.45) return 's2';
      if (d < 3.2) return r < 0.7 ? 'light' : 'heavy';
      if (ok('dive') && r < 0.3) return 'dive';
      return null;
    } },
});
export default S;
