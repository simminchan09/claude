// 8. 죽림 사당 — 그림자 닌자 · 수리검 닌자 · 사당의 오니 · 보스 구미호 쿠즈하
// 모델은 bamboo_model.js. 닌자 · 오니는 makeSet 기본 틀의 기술을 쓰고, 쿠즈하는 네발 전용 기술 · 행동을 가진다.
//
// 쿠즈하 — 빠르고 교활한 네발 여우. 쉬지 않고 뛰어다니며 짧은 간격으로 공격한다.
//   여우 연격(물기 · 할퀴기 · 덮치기) · 삼연 도약(세 번 연달아 덮치며 할큄) · 여우불 공전(몸 주위를 돌던 여우불이 하나씩 날아옴)
//   환영 분신(진짜 하나 + 환영들이 플레이어를 둘러싸고 돌다 차례로 돌진 — 진짜를 때리면 환영이 흩어진다 · 환영은 그림자가 없고 깜빡인다)
//   등불 이동(석등 옆으로 순간이동해 여우불 부채꼴) · 꼬리 내려찍기(빨강: 아홉 꼬리를 들어 앞을 내려친다)
//   2페이즈: 구미 난무(아홉 꼬리가 차례로 뻗어 채찍질) · 여우불 고리(뛰어올라 착지하며 퍼지는 불의 고리 두 겹 — 뛰어넘어야 함)
import * as THREE from 'three';
import { makeSet } from '../kit.js';
import { Projectile, areaHit } from '../../entities.js';
import { applyPose } from '../../rig.js';
import { rand, sfx } from '../../core.js';
import { quadPoses, quadRun } from '../bodies.js';
import { buildNinja, buildOni, buildKuzuha } from './bamboo_model.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });
const FOX = 0xff7ad0, FOX2 = 0xffd0f0, FIRE = 0x8a6aff;

const S = makeSet({ id: 'bamboo',
  grunt: { name: '그림자 닌자', short: '닌자', title: '죽림의 자객', fast: true, speed: 5.6, hp: 250, col: C(0xff3a4a, 0x1a1a24, 0x0a0a10, { cloth: 0x14141c, band: '#1a0408' }), model: { weapon: 'katana' }, st: ['bleed', 3, 6] },
  archer: { name: '수리검 닌자', short: '수리검', title: '나무 위의 눈', skill: '수리검 난사', col: C(0xc8c8ff, 0x24243a, 0x0a0a14, { cloth: 0x1a1a2a, band: '#0a0a1a' }), model: { weapon: 'shuriken' }, shot: { dmg: 20, n: 3, color: 0xd8d8ff, speed: 19, homing: 0.2, r: 0.2, st: ['bleed', 2, 5] } },
  brute: { name: '사당의 오니', short: '오니', title: '붉은 도깨비', scale: 1.55, plan: 'golem', kind: 'oni', col: C(0xffd040, 0x5a1a14, 0xc83a2a, { trim: 0xe8c040, cloth: 0xd8a040, band: '#2a0806' }), model: { weapon: 'club' }, skill: '도깨비 방망이' },
  boss: { name: '구미호 쿠즈하', short: '쿠즈하', title: '사당을 삼킨 여우', col: C(FOX, 0xf0e8f0, 0x2a1a2a, { trim: 0xff5a8a, cloth: 0xc82a4a, band: '#2a0a1a' }) },
});
const grunt = S.grunt, archer = S.archer, brute = S.brute;
grunt.createModel = (p) => buildNinja(p, grunt.scale, { kind: 'blade' }); grunt.viewH = 1.9;
archer.createModel = (p) => buildNinja(p, archer.scale, { kind: 'star' }); archer.viewH = 1.9;
brute.createModel = (p) => buildOni(p, brute.scale); brute.viewH = 1.9;
brute.poses = { ...brute.poses, base: { ...brute.poses.base, weapon: [0.3, 0, 0] } };

/* =====================================================================
   쿠즈하 도우미
   ===================================================================== */
const P = 1.45, N = -1.15, H = (o) => ({ noCrit: true, ...o });
const crouchK = { hipY: -0.12, chest: [0.22, 0, 0], hipL: [-P - 0.7, 0, 0], hipR: [-P - 0.7, 0, 0], kneeL: [1.2, 0, 0], kneeR: [1.2, 0, 0], shoulderL: [-P - 0.3, 0, 0], shoulderR: [-P - 0.3, 0, 0], elbowL: [0.5, 0, 0], elbowR: [0.5, 0, 0] };
const leapK = { hipY: 0, chest: [-0.3, 0, 0], shoulderL: [-P - 0.9, 0, 0], shoulderR: [-P - 0.9, 0, 0], hipL: [-P + 0.5, 0, 0], hipR: [-P + 0.5, 0, 0], kneeL: [0.45, 0, 0], kneeR: [0.45, 0, 0] };
const dashK = { chest: [0.1, 0, 0], neck: [N + 0.3, 0, 0], shoulderL: [-P - 0.75, 0, 0], shoulderR: [-P - 0.75, 0, 0], hipL: [-P + 0.65, 0, 0], hipR: [-P + 0.65, 0, 0] };
const strideK = { hipY: -0.04, chest: [0.08, 0, 0], neck: [N + 0.1, 0, 0], shoulderL: [-P - 0.45, 0, 0], shoulderR: [-P + 0.2, 0, 0], elbowL: [0.3, 0, 0], hipL: [-P + 0.25, 0, 0], hipR: [-P - 0.55, 0, 0], kneeR: [0.8, 0, 0] };
const howlK = { neck: [N - 0.6, 0, 0], chest: [-0.28, 0, 0], head: [-(P + N) - 0.4, 0, 0] };
const sphereHit = (f, c, r, h) => { let any = false; for (const t of f.foes()) if (t.hurtHit(c, r)) { const d = new V3().subVectors(t.pos, c).setY(0); if (d.lengthSq() < 1e-4) f.fwd(d); any = t.takeHit(f, h, d.normalize()) || any; } return any; };
const foxPuff = (G, p, s = 1) => { const c = p.clone().setY(p.y + 0.8 * s); G.fx.burst(c, 26, [FOX, FIRE, FOX2], 7, { kind: 'glow', sk: 0.5 * s }); G.fx.burst(c, 20, [FOX2, 0xffffff], 8); G.fx.ring(p.clone().setY(0.06), { normal: UP, r0: 0.3, r1: 2.2 * s, life: 0.4, color: FOX }); G.fx.light(c, FOX, 60, 0.3); };
const clampArena = (p, R = 19) => { const r = Math.hypot(p.x, p.z); if (r > R) { p.x *= R / r; p.z *= R / r; } return p; };
// 석등 자리 (죽림 사당 결투장 안 석등 셋 — 다른 맵이면 같은 반경의 세 점)
const LANTERNS = [0.8, 2.6, 4.45].map((a) => new V3(Math.sin(a) * 7.1, 0, Math.cos(a) * 7.1));
// 꼬리 제어: i 번째 꼬리를 tgt 쪽으로 k 만큼 뻗는다
const tailTo = (f, i, tgt, k) => { const T0 = f.model.tails && f.model.tails[i]; if (!T0) return; T0.whip = k; if (tgt) T0.tgt.copy(tgt); };
const tailsReset = (f) => { for (const T0 of f.model.tails || []) T0.whip = 0; };
// 여우불 (쏘기 전 잠시 공전하는 구슬)
function foxOrb(G, f, i, n, wait) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshBasicMaterial({ color: FOX, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); mesh.add(core); G.scene.add(mesh);
  let t = 0; const a0 = i / n * TAU;
  return { done: false, owner: f, update(dt) {
    t += dt; if (f.state === 'ko' || f.gone) return this.kill();
    const a = a0 + t * 3.2, R = 1.3 * f.scale * Math.min(1, t * 4), p = mesh.position.set(f.pos.x + Math.cos(a) * R, f.pos.y + 1.0 * f.scale + Math.sin(t * 5 + i) * 0.15, f.pos.z + Math.sin(a) * R);
    mesh.scale.setScalar(0.9 + 0.2 * Math.sin(t * 20 + i)); if (Math.random() < 0.7) G.fx.p(p, { vel: [0, 1.2, 0], size: 0.22, size1: 0.04, life: 0.3, color: Math.random() < 0.5 ? FOX : FIRE, alpha: 0.8 });
    if (t >= wait) { const o = f.opp, d = (o ? o.chest(new V3()) : f.local([0, 1, 8])).sub(p).normalize(); G.spawn(new Projectile(G, { owner: f, pos: p.clone(), vel: d.multiplyScalar(11), r: 0.3, color: FOX, homing: 1.1, life: 2.6, hit: H({ dmg: 24, kb: [3, 2], stun: 0.4, hs: 0.05, st: ['burn', 2, 6] }) })); sfx('shot'); this.kill(); }
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(mesh); mesh.geometry.dispose(); core.geometry.dispose(); } };
}
// 환영 여우: 같은 모습 · 같은 자세 (그림자가 없고 이따금 깜빡인다)
function foxClone(G, f) {
  const mdl = buildKuzuha(f.palette, f.scale); mdl.stepPhys = () => {}; mdl.root.scale.setScalar(f.scale); G.scene.add(mdl.root); for (const x of mdl.extraMeshes) { G.scene.add(x); x.castShadow = false; }
  mdl.root.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const fake = { vel: new V3(), state: 'act', root: { visible: true }, scale: f.scale }; let t = rand(0, 1);
  return { mdl, pos: mdl.root.position, yaw: 0, alive: true, dashing: false,
    step(dt) { t += dt; const flick = (t % 0.9) < 0.07; fake.root.visible = !flick; mdl.root.visible = !flick; mdl.root.rotation.y = this.yaw; applyPose(mdl, f.pose); mdl.body.position.y = f.model.body.position.y; mdl.root.updateMatrixWorld(true); mdl.update(dt, fake);
      if (flick && Math.random() < 0.5) G.fx.burst(this.pos.clone().setY(0.8 * f.scale), 6, [FOX, FOX2], 3); },
    remove() { if (!this.alive) return; this.alive = false; foxPuff(G, this.pos, 0.6); G.scene.remove(mdl.root); for (const x of mdl.extraMeshes) G.scene.remove(x); } };
}
// 여우불 고리: 착지한 자리에서 퍼지는 불의 고리 (땅을 따라감 → 뛰어넘기)
function fireRing(G, f, c, delay) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: FOX, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); mesh.rotation.x = -Math.PI / 2; mesh.position.copy(c).setY(0.08); G.scene.add(mesh);
  let t = -delay; const hitSet = new Set();
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return; const R = 0.6 + t * 8.5; mesh.scale.setScalar(R); mesh.material.opacity = 0.9 * Math.min(1, t * 5) * Math.max(0, 1 - R / 15);
    for (let k = 0; k < 10; k++) { const a = rand(0, TAU); G.fx.p(new V3(c.x + Math.cos(a) * R, 0.15, c.z + Math.sin(a) * R), { vel: [0, rand(1.5, 3.5), 0], size: 0.3, size1: 0.05, life: 0.35, color: Math.random() < 0.6 ? FOX : FIRE, alpha: 0.85 }); }
    for (const o of f.foes()) { if (hitSet.has(o) || o.pos.y > 0.55) continue; const d = Math.hypot(o.pos.x - c.x, o.pos.z - c.z); if (Math.abs(d - R) < 0.45 + 0.25 * o.scale && o.takeHit(f, H({ dmg: 40, kb: [5, 4], stun: 0.5, hs: 0.06, unblock: true, st: ['burn', 3, 6] }), new V3(o.pos.x - c.x, 0, o.pos.z - c.z).normalize())) hitSet.add(o); }
    if (R > 15) this.kill();
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(mesh); mesh.geometry.dispose(); } };
}

/* =====================================================================
   쿠즈하 기술
   ===================================================================== */
const sc3 = (f, a) => f.local(a.map((v) => v * f.scale));
const swipe = (f) => { sfx('swing'); f.slashFx({ tilt: 1.2, r: 0.9 * f.scale, at: [-0.15, 0.5 * f.scale, 0.7], color: FOX2 }); };
// 삼연 도약
const REND = [0.42, 0.86, 1.3];
const rend = { dur: 1.85, cd: 's1', aim: true, track: 0.3, tele: [0.12, 'yellow'], noMove: true,
  keys: [[0, 'base'], [0.4, crouchK], ...REND.flatMap((t0, i) => [[t0 + 0.1, leapK], [t0 + 0.24, { chest: [0.2, 0, 0], shoulderL: [-P - (i % 2 ? 0.2 : 1.2), 0, 0.2], shoulderR: [-P - (i % 2 ? 1.2 : 0.2), 0, -0.2], hipL: [-P - 0.3, 0, 0], hipR: [-P - 0.3, 0, 0] }], [t0 + 0.4, i < 2 ? crouchK : {}]]), [1.85, 'base']],
  lunge: REND.map((t0) => [t0, t0 + 0.2, 10.5]),
  ev: REND.flatMap((t0) => [[t0 - 0.01, (f) => { f.faceOpp(); f.vel.y = 4.6; f.onGround = false; sfx('jump'); }], [t0 + 0.2, swipe]]),
  hits: REND.map((t0) => H({ t0: t0 + 0.16, t1: t0 + 0.32, at: [0, 0.45, 0.8], r: 0.75, dmg: 32, kb: [3, 1.5], stun: 0.4, hs: 0.06, st: ['bleed', 3, 5] })) };
// 환영 분신
const ILL_T0 = 0.38, ILL_DASH = 2.0, ILL_GAP = 0.34;
function illusionMove() {
  return { dur: 4.2, cd: 's2', aim: true, track: 0.3, tele: [0.2, 'red'], noMove: true,
    keys: [[0, 'base'], [0.35, crouchK], [0.6, strideK], [ILL_DASH - 0.1, strideK], [ILL_DASH + 0.1, dashK], [4.2, dashK]],
    ev: [[ILL_T0, (f, o, G) => {
      if (!o) return; const n = (f.enraged ? 5 : 3) + 1, R = 4.8, s = { c: o.pos.clone().setY(0), a: rand(0, TAU), n, R, real: (Math.random() * n) | 0, clones: [], order: [], t: 0, done: new Set() };
      for (let i = 0; i < n; i++) s.order.push(i); s.order.sort(() => Math.random() - 0.5);
      for (let i = 0; i < n; i++) s.clones.push(i === s.real ? null : foxClone(G, f));
      foxPuff(G, f.pos); f._ill = s; f.vel.set(0, 0, 0); sfx('dash');
      // 감시: 기술이 어떤 식으로 끝나든(쓰러짐 포함) 환영을 치운다
      G.spawn({ done: false, owner: f, update() { if (f._ill !== s || f.state !== 'act' || f.actName !== 's2' || f.gone) { for (const cl of s.clones) cl && cl.remove(); if (f._ill === s) f._ill = null; this.done = true; } }, kill() { for (const cl of s.clones) cl && cl.remove(); this.done = true; } });
      f.act.dur = ILL_DASH + n * ILL_GAP + 0.5; }]],
    tick: (f, o, G, t, dt) => {
      const s = f._ill; if (!s || t < ILL_T0) return;
      s.t += dt; if (o && t < ILL_DASH) s.c.lerp(o.pos.clone().setY(0), 1 - Math.exp(-dt * 2));
      if (s.broken) { if (f.at < f.act.dur - 0.35) f.at = f.act.dur - 0.35; return; }
      const rot = s.a + s.t * 1.15;
      for (let i = 0; i < s.n; i++) {
        const k = s.order.indexOf(i), td = ILL_DASH + k * ILL_GAP, ang = rot + i / s.n * TAU, home = new V3(s.c.x + Math.sin(ang) * s.R, 0, s.c.z + Math.cos(ang) * s.R);
        let p = home, yaw = Math.atan2(s.c.x - home.x, s.c.z - home.z);
        if (t >= td - 0.42 && !s.done.has('w' + i)) { s.done.add('w' + i); G.fx.ring(home.clone().setY(0.07), { normal: UP, r0: 1.6, r1: 0.6, life: 0.42, color: 0xff2a3a }); sfx('teleRed'); }
        if (t >= td) { const k2 = Math.min(1, (t - td) / 0.34), from = s['from' + i] || (s['from' + i] = home.clone()), dir = s.c.clone().sub(from).setY(0).normalize(); p = from.clone().addScaledVector(dir, 2 * s.R * k2); yaw = Math.atan2(dir.x, dir.z);
          if (k2 < 1 && !s.done.has('h' + i)) { if (sphereHit(f, p.clone().setY(0.55 * f.scale), 0.7 * f.scale, H({ dmg: i === s.real ? 46 : 22, kb: [6, 3], stun: 0.5, hs: 0.07, unblock: true }))) s.done.add('h' + i); if (Math.random() < 0.8) G.fx.burst(p.clone().setY(0.6 * f.scale), 3, [FOX, FIRE], 3, { kind: 'glow', sk: 0.4 }); }
          if (k2 >= 1 && i !== s.real && s.clones[i] && s.clones[i].alive) s.clones[i].remove(); }
        clampArena(p);
        if (i === s.real) { f.pos.x = p.x; f.pos.z = p.z; f.yaw = yaw; f.vel.set(0, 0, 0); }
        else { const cl = s.clones[i]; if (!cl || !cl.alive) continue; cl.pos.copy(p); cl.yaw = yaw; cl.step(dt);
          // 플레이어 무기가 환영을 스치면 사라진다
          const pl = f.opp; if (pl && pl.state === 'act' && pl.hasW && t < td && pl.wt.distanceTo(p.clone().setY(0.6 * f.scale)) < 0.85 * f.scale) cl.remove(); }
      }
    },
    // 진짜를 때리면 환영이 모두 흩어지고 기술이 끝난다 (받는 피해 증가)
    onHit: (f, att, h) => { const s = f._ill; if (!s || s.broken) return null; s.broken = true; for (const cl of s.clones) cl && cl.remove(); f.G.hud.pop('간파!', 'gold'); sfx('brk'); return { dmgK: 1.4 }; },
    end: (f) => { const s = f._ill; if (s) for (const cl of s.clones) cl && cl.remove(); f._ill = null; } };
}
// 등불 이동 + 여우불 부채꼴
const lantern = { dur: 1.7, cd: 'lantern', aim: true, track: 1.3, noMove: true, tele: [0.78, 'yellow'],
  keys: [[0, 'base'], [0.28, crouchK], [0.56, { ...howlK, hipY: 0 }], [0.95, howlK], [1.05, { chest: [0.1, 0, 0], neck: [N + 0.2, 0, 0] }], [1.2, howlK], [1.35, { chest: [0.1, 0, 0] }], [1.7, 'base']],
  ev: [[0.28, (f, o, G) => { foxPuff(G, f.pos); f.root.visible = false; f.inv = Math.max(f.inv, 0.35); sfx('dash'); }],
    [0.55, (f, o, G) => { const pts = G.mapId === 'bamboo' ? LANTERNS : LANTERNS.map((p) => p.clone().applyAxisAngle(UP, 0.4)); let best = null, bs = -1;
      for (const p of pts) { const d = o ? p.distanceTo(o.pos) : 0, me = p.distanceTo(f.pos); const sc = d + rand(0, 3) - (me < 2 ? 99 : 0); if (sc > bs && d > 3.5) { bs = sc; best = p; } }
      best = best || pts[0]; f.pos.set(best.x, 0, best.z); f.vel.set(0, 0, 0); f.faceOpp(); f.root.visible = true; f.wJump = true; foxPuff(G, f.pos, 0.8); }],
    ...[0.98, 1.13, 1.28].map((t, i) => [t, (f, o, G) => { if (!o) return; const h = f.model.tipPos(new V3()); for (let k = -1; k <= 1; k++) { const d = o.chest(new V3()).sub(h).normalize().applyAxisAngle(UP, k * 0.2 + (i - 1) * 0.06); G.spawn(new Projectile(G, { owner: f, pos: h.clone().addScaledVector(d, 0.3), vel: d.multiplyScalar(15), r: 0.28, color: FOX, homing: 0.25, life: 2, hit: H({ dmg: 18, kb: [3, 2], stun: 0.35, hs: 0.05, st: ['burn', 2, 5] }) })); } sfx('shot'); G.fx.burst(h, 12, [FOX, FOX2], 5); }])],
  end: (f) => { f.root.visible = true; } };
// 꼬리 내려찍기 (빨강)
const tailSlam = { dur: 1.55, cd: 'heavy', aim: true, track: 0.6, tele: [0.2, 'red'], noMove: true,
  keys: [[0, 'base'], [0.6, { chest: [-0.15, 0, 0], neck: [N - 0.3, 0, 0], hipL: [-P - 0.4, 0, 0], hipR: [-P - 0.4, 0, 0], kneeL: [0.8, 0, 0], kneeR: [0.8, 0, 0] }], [0.92, { chest: [0.25, 0, 0], neck: [N + 0.25, 0, 0], shoulderL: [-P - 0.4, 0, 0.1], shoulderR: [-P - 0.4, 0, -0.1] }], [1.2, {}], [1.55, 'base']],
  tick: (f, o, G, t) => { const n = (f.model.tails || []).length, r = f.right(new V3());
    for (let i = 0; i < n; i++) { const fan = (i - (n - 1) / 2) / ((n - 1) / 2), up = sc3(f, [0, 2.4, 0.2]).addScaledVector(r, fan * 0.9), dn = sc3(f, [0, 0.05, 1.75]).addScaledVector(r, fan * 0.8);
      if (t < 0.25) tailTo(f, i, up, t / 0.25 * 0.9); else if (t < 0.8) tailTo(f, i, up, 0.9); else if (t < 0.95) tailTo(f, i, up.lerp(dn, (t - 0.8) / 0.15), 1); else if (t < 1.2) tailTo(f, i, dn, 1); else tailTo(f, i, dn, Math.max(0, 1 - (t - 1.2) / 0.3)); } },
  ev: [[0.95, (f, o, G) => { const c = sc3(f, [0, 0, 1.75]).setY(0.06); sfx('boom'); G.shake(0.3); G.fx.ring(c, { normal: UP, r0: 0.4, r1: 3.2, life: 0.5, color: FOX }); G.fx.burst(c, 40, [FOX, FIRE, 0xffffff], 11, { dir: UP, spread: 1.2 }); G.fx.light(c.clone().setY(1), FOX, 90, 0.35);
    areaHit(f, c, 2.1, H({ dmg: 82, kb: [6, 7], stun: 0.6, hs: 0.1, unblock: true, st: ['burn', 3, 6] })); }]],
  end: tailsReset };
// 2페이즈 · 구미 난무: 아홉 꼬리가 하나씩 플레이어를 향해 뻗는다 (노랑 · 막기/패리 가능)
const WHIP = Array.from({ length: 9 }, (_, i) => 0.5 + i * 0.14);
const whip = { dur: 2.25, cd: 'whip', aim: true, track: 2.0, tele: [0.15, 'yellow'], noMove: true,
  keys: [[0, 'base'], [0.4, { chest: [-0.12, 0, 0], neck: [N - 0.25, 0, 0], hipL: [-P - 0.35, 0, 0], hipR: [-P - 0.35, 0, 0], kneeL: [0.75, 0, 0], kneeR: [0.75, 0, 0] }], [2.0, {}], [2.25, 'base']],
  start: (f) => { f._whip = WHIP.map(() => null); },
  tick: (f, o, G, t) => { const tails = f.model.tails || [], root = f.model.tailRoot(new V3());
    WHIP.forEach((t0, i) => { if (!tails[i]) return; const s = f._whip;
      if (t >= t0 - 0.12 && !s[i] && o) { const p = o.chest(new V3()), d = p.clone().sub(root), L = d.length(), mx = 5.5 * f.scale / 1.7; if (L > mx) p.copy(root).addScaledVector(d, mx / L); s[i] = { p, hit: false }; }
      if (!s[i]) return; const k = t < t0 ? 1 - (t0 - t) / 0.12 : t < t0 + 0.12 ? 1 : Math.max(0, 1 - (t - t0 - 0.12) / 0.22); tailTo(f, i, s[i].p, k);
      if (!s[i].hit && t >= t0 && t < t0 + 0.12) { s[i].hit = true; sfx('swing'); G.fx.burst(s[i].p, 10, [FOX, FOX2, 0xffffff], 6); sphereHit(f, s[i].p, 0.6, H({ dmg: i === 8 ? 30 : 15, kb: [i === 8 ? 6 : 1.5, i === 8 ? 4 : 0], stun: 0.28, hs: 0.04, basic: false })); } }); },
  end: tailsReset };
// 2페이즈 · 여우불 고리: 높이 뛰어올라 착지하며 불의 고리 두 겹 (빨강 · 뛰어넘기)
const fireringM = { dur: 2.0, cd: 'firering', aim: true, track: 0.4, tele: [0.15, 'red'], noMove: true,
  keys: [[0, 'base'], [0.42, crouchK], [0.6, leapK], [0.95, { chest: [0.2, 0, 0], shoulderL: [-P - 0.5, 0, 0], shoulderR: [-P - 0.5, 0, 0] }], [1.1, crouchK], [2.0, 'base']],
  ev: [[0.45, (f) => { f.vel.y = 8; f.onGround = false; sfx('jump'); }], [1.05, (f, o, G) => { const c = f.pos.clone().setY(0); sfx('boom'); G.shake(0.3); foxPuff(G, c, 1.2); areaHit(f, c, 2.0, H({ dmg: 40, kb: [6, 5], stun: 0.5, unblock: true })); G.spawn(fireRing(G, f, c, 0)); G.spawn(fireRing(G, f, c, 0.75)); }]] };

const Q = quadPoses('fox');
const boss = {
  ...S.boss, scale: 1.7, viewH: 1.75,
  stats: { hp: 4200, speed: 6.2, jump: 9, daze: 340, armor: true, breakTime: 5 },
  skills: { s1: { name: '삼연 도약', cd: 4 }, s2: { name: '환영 분신', cd: 12 }, heavy: { name: '꼬리 내려찍기', cd: 5.5 }, foxfire: { name: '여우불 공전', cd: 6 }, lantern: { name: '등불 이동', cd: 7 }, whip: { name: '구미 난무', cd: 7 }, firering: { name: '여우불 고리', cd: 10 }, ult: { name: '-', sub: '' } },
  createModel: (p) => buildKuzuha(p, 1.7), poses: Q, runCycle: quadRun,
  moves: {
    // 여우 연격: 물기 → 앞발 할퀴기 → 덮치기
    light1: { dur: 0.8, aim: true, track: 0.35, tele: [0.1, 'yellow'], cancel: 0.58, next: 'light2', keys: [[0, 'base'], [0.34, { chest: [-0.25, 0, 0], neck: [N - 0.45, 0, 0] }], [0.46, { chest: [0.22, 0, 0], neck: [N + 0.4, 0, 0] }], [0.8, 'base']], lunge: [[0.36, 0.48, 9]], ev: [[0.38, () => sfx('swing')]], hits: [H({ t0: 0.4, t1: 0.52, at: [0, 0.55, 0.95], r: 0.6, dmg: 40, kb: [3, 1], stun: 0.4, hs: 0.06 })] },
    light2: { dur: 0.7, aim: true, track: 0.15, cancel: 0.5, next: 'light3', keys: [[0, 'base'], [0.24, { shoulderR: [-P - 1.1, 0, -0.3], chest: [-0.2, 0.25, 0] }], [0.36, { shoulderR: [-P + 0.3, 0, 0.25], chest: [0.15, -0.2, 0] }], [0.7, 'base']], lunge: [[0.22, 0.34, 5]], ev: [[0.28, swipe]], hits: [H({ t0: 0.3, t1: 0.42, at: [-0.2, 0.45, 0.85], r: 0.65, dmg: 38, kb: [3, 1], stun: 0.4, hs: 0.06, st: ['bleed', 3, 5] })] },
    light3: { dur: 1.2, aim: true, track: 0.42, tele: [0.12, 'yellow'], keys: [[0, 'base'], [0.42, crouchK], [0.62, leapK], [0.85, { chest: [0.25, 0, 0] }], [1.2, 'base']], ev: [[0.45, (f) => { f.vel.y = 6; f.onGround = false; sfx('jump'); }]], lunge: [[0.45, 0.82, 9]], hits: [H({ t0: 0.72, t1: 0.92, at: [0, 0.4, 0.7], r: 1.0, dmg: 64, kb: [6, 4], stun: 0.55, hs: 0.08 })] },
    heavy: tailSlam, s1: rend, s2: illusionMove(), lantern,
    foxfire: { dur: 1.0, cd: 'foxfire', aim: true, track: 0.4, tele: [0.12, 'yellow'], keys: [[0, 'base'], [0.3, howlK], [0.75, {}], [1.0, 'base']],
      ev: [[0.32, (f, o, G) => { const n = f.enraged ? 9 : 5; sfx('charge'); for (let i = 0; i < n; i++) G.spawn(foxOrb(G, f, i, n, 1.1 + i * 0.16)); }]] },
    whip, firering: fireringM,
  },
  ai: { range: 10, keep: 2.6, cdMin: 0.45, cdMax: 1.1, chain: 0.85,
    pick: (f, o, d) => {
      const ok = (k) => (f.cd[k] || 0) <= 0, r = Math.random();
      if (f.enraged && ok('firering') && d < 6 && r < 0.3) return 'firering';
      if (f.enraged && ok('whip') && d < 5 && r < 0.55) return 'whip';
      if (d > 7) return ok('lantern') && r < 0.4 ? 'lantern' : ok('foxfire') && r < 0.7 ? 'foxfire' : ok('s1') ? 's1' : null;
      if (d > 3) return ok('s2') && r < 0.3 ? 's2' : ok('s1') && r < 0.65 ? 's1' : ok('foxfire') ? 'foxfire' : ok('lantern') && r < 0.85 ? 'lantern' : null;
      if (ok('heavy') && r < 0.25) return 'heavy';
      if (ok('s1') && r < 0.42) return 's1';
      if (ok('lantern') && r < 0.55) return 'lantern'; // 붙으면 석등으로 달아난다
      if (ok('foxfire') && r < 0.65) return 'foxfire';
      if (f.enraged && ok('whip')) return 'whip';
      return 'light';
    } },
};

export default { grunt, archer, brute, boss };
