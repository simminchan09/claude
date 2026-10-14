// 1. 일식의 신전 — 공허 결정체 무리: 공허 파편병 · 떠도는 공허 정령 사수 · 흑요석 공허 파쇄자 · 보스 공허의 기사 니힐
// 모델은 eclipse_model.js. 잡몹 · 사수 · 정예의 기술은 makeSet 기본 틀을 쓰고, 니힐은 전용 기술 · 행동을 가진다.
//
// 니힐 — 순간이동하는 공허의 기사. 모든 베기가 0.6초 뒤 같은 자리를 다시 베는 '잔향'을 남긴다.
//   공허 검격(1~3타) · 공허 보행(플레이어 등 뒤로 순간이동해 베기) · 거울 분신(분신이 둘러싸고 같은 동작으로 벤다)
//   파멸의 낙참(빨강: 내려찍기 + 앞으로 뻗는 땅 균열) · 공허 일섬(회전 베기 + 같은 자리 잔향) · 공허 파동검(원거리 참격파 + 잔향 파동)
//   2페이즈: 공허 균열(플레이어 자리에 끌어당기는 균열 지대 · 주기적 폭발) · 공허 보행이 2연속 · 분신 3체
import * as THREE from 'three';
import { makeSet, slow, swish, chop, poses } from '../kit.js';
import { Projectile, areaHit } from '../../entities.js';
import { applyPose } from '../../rig.js';
import { rand, sfx } from '../../core.js';
import trainer from '../../characters/trainer.js';
import { buildVoidGrunt, buildVoidWisp, buildObsidianBrute, buildNihil } from './eclipse_model.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0), T = trainer.moves;
const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });
const VOID = 0xb04aff, VOID2 = 0xe0b0ff;

const S = makeSet({ id: 'eclipse',
  grunt: { name: '공허 파편병', short: '파편병', title: '공허 잡병', col: C(0xff3a5a, 0x2a1a2a, 0x15121c, { band: '#2a0612' }), model: { weapon: 'claw' } },
  archer: { name: '떠도는 공허 정령', short: '정령 사수', title: '공허 사수', skill: '공허탄', plan: 'float', kind: 'wisp', col: C(0xb06aff, 0x2a2240, 0x15121c, { cloth: 0x2a1a44, band: '#1a0a2a' }), shot: { dmg: 45 } },
  brute: { name: '흑요석 공허 파쇄자', short: '파쇄자', title: '중장갑 정예', plan: 'golem', kind: 'obsidian', col: C(0xff6a2a, 0x332622, 0x15121c, { band: '#2a1006' }), model: { weapon: 'hammer' } },
  boss: { name: '공허의 기사 니힐', short: '니힐', title: '공허의 기사', col: C(VOID, 0x3a3048, 0x15121c, { band: '#1a0628', trim: 0xb8a8d8 }) },
});
const grunt = S.grunt, archer = S.archer, brute = S.brute;
grunt.createModel = (p) => buildVoidGrunt(p, grunt.scale); grunt.viewH = 2.0;
archer.createModel = (p) => buildVoidWisp(p, archer.scale); archer.viewH = 2.0;
brute.createModel = (p) => buildObsidianBrute(p, brute.scale); brute.viewH = 2.0;
brute.poses = { ...brute.poses, base: { ...brute.poses.base, weapon: [0.2, 0, 0] } }; // 대망치를 앞으로 들고 선다

/* =====================================================================
   니힐 전용 이펙트 · 도우미
   ===================================================================== */
const sc3 = (f, a) => f.local(a.map((v) => v * f.scale));
const H = (o) => ({ noCrit: true, ...o });
// 구 판정 한 번 (구 안의 적에게 피격)
function sphereHit(f, c, r, h) { let any = false; for (const t of f.foes()) if (t.hurtHit(c, r)) { const d = new V3().subVectors(t.pos, c).setY(0); if (d.lengthSq() < 1e-4) f.fwd(d); any = t.takeHit(f, h, d.normalize()) || any; } return any; }
// 잔향: 지금 베어낸 자리에 흐릿한 참격 잔상을 남기고, delay 뒤 같은 자리를 다시 벤다 (막을 수 있음)
function echo(G, f, c, { delay = 0.6, r = 1.1, dmg = 36, tilt = 0.15, fwd, ring = false, maxY } = {}) {
  const F = (fwd || f.fwd(new V3())).clone(), n = new V3(0, 1, 0).multiplyScalar(Math.cos(tilt)).addScaledVector(f.right(new V3()), Math.sin(tilt));
  let t = 0, fired = false;
  G.fx.slash(c, { fwd: F, normal: n, r: r * 1.3, color: VOID2, life: 0.5 });
  return { done: false, owner: f, update(dt) {
    t += dt;
    if (!fired && Math.random() < 0.7) G.fx.p(c.clone().add(new V3(rand(-r, r) * 0.6, rand(-0.4, 0.4), rand(-r, r) * 0.6)), { vel: [0, 0.4, 0], size: 0.12, size1: 0.02, life: 0.35, color: VOID, alpha: 0.8 });
    if (ring && !fired && Math.random() < 0.5) G.fx.ring(c.clone().setY(c.y), { normal: UP, r0: r * 0.95, r1: r, life: 0.12, color: VOID2, op: 0.35 });
    if (!fired && t >= delay) {
      fired = true; sfx('swing'); G.fx.slash(c, { fwd: F, normal: n, r: r * 1.5, color: VOID, life: 0.25, flip: true }); G.fx.burst(c, 18, [VOID, 0xffffff], 7); G.fx.light(c, VOID, 50, 0.25);
      const h = H({ dmg, kb: [3.5, 1], stun: 0.4, hs: 0.06, basic: false });
      if (ring) for (const o of f.foes()) { const dx = o.pos.x - c.x, dz = o.pos.z - c.z, d = Math.hypot(dx, dz); if (d < r + 0.4 * o.scale && o.pos.y < (maxY ?? 3.5)) o.takeHit(f, h, new V3(dx, 0, dz).normalize()); }
      else sphereHit(f, c, r, h);
    }
    if (t > delay + 0.3) this.done = true;
  }, kill() { this.done = true; } };
}
// 순간이동 이펙트 (사라짐 / 나타남)
function voidPuff(G, f, p, big = 1) { const c = p.clone().setY(p.y + 1.1 * f.scale); G.fx.burst(c, 30 * big, [VOID, 0x000000, VOID2], 7, { kind: 'glow', sk: 0.6 }); G.fx.burst(c, 24, [VOID2, 0xffffff], 9); G.fx.ring(p.clone().setY(0.06), { normal: UP, r0: 0.3, r1: 2.4 * big, life: 0.45, color: VOID }); G.fx.light(c, VOID, 70, 0.3); }
// 공허 분신: 니힐의 자세를 그대로 따라 하며 플레이어를 둘러싸고 같은 순간에 벤다
function voidClone(G, f, pos, hitT) {
  const mdl = buildNihil(f.palette, f.scale, { ghost: true }); mdl.root.scale.setScalar(f.scale); mdl.root.position.copy(pos); G.scene.add(mdl.root);
  const [gm, dk] = mdl.ghostMats; let t = 0, yaw = 0, hit = false, fade = 0, dead = false;
  voidPuff(G, f, pos, 0.6); sfx('charge');
  return { done: false, owner: f, update(dt) {
    t += dt; const o = f.opp, live = f.state === 'act' && f.actName === 's2' && !dead;
    if (o && (!live || f.at < hitT[0] - 0.12)) yaw = Math.atan2(o.pos.x - pos.x, o.pos.z - pos.z);
    mdl.root.rotation.y = yaw; applyPose(mdl, f.pose); mdl.body.position.y = f.model.body.position.y; mdl.root.updateMatrixWorld(true); mdl.update(dt);
    if (live && !hit && f.at >= hitT[0] && f.at <= hitT[1]) {
      const s = Math.sin(yaw), c = Math.cos(yaw), k = f.scale, p = new V3(pos.x + s * 1.3 * k, 1.1 * k, pos.z + c * 1.3 * k);
      if (sphereHit(f, p, 1.0 * k, H({ dmg: 46, kb: [4, 1.5], stun: 0.45, hs: 0.07, basic: false }))) hit = true;
      if (f.at >= hitT[1] - 0.05 && !this.ech) { this.ech = true; G.spawn(echo(G, f, p, { dmg: 30, r: 1.0, fwd: new V3(s, 0, c) })); }
    }
    if (!live && !dead) { dead = true; fade = t; }
    const a = Math.min(1, t / 0.3) * (dead ? Math.max(0, 1 - (t - fade) / 0.35) : 1); gm.opacity = 0.16 * a; dk.opacity = 0.55 * a;
    if (dead && t - fade > 0.35) { voidPuff(G, f, pos, 0.4); this.kill(); }
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(mdl.root); } };
}
// 공허 균열 (2페이즈 장판): 플레이어를 끌어당기고, 안에 있으면 지속 피해 · 둔화, 주기적으로 폭발한다
function voidRift(G, f, x, z) {
  const R = 2.5, grp = new THREE.Group(); grp.position.set(x, 0.04, z); G.scene.add(grp);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0x05020a, transparent: true, opacity: 0, depthWrite: false })); disc.rotation.x = -Math.PI / 2; grp.add(disc);
  const ringM = new THREE.MeshBasicMaterial({ color: VOID, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rings = [R, R * 0.66, R * 0.35].map((r, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.06 - i * 0.02, r, 48, 1, 0, TAU * (0.6 + i * 0.15)), ringM); m.rotation.x = -Math.PI / 2; m.position.y = 0.01 * i; grp.add(m); return m; });
  const shardM = new THREE.MeshStandardMaterial({ color: 0x1a1426, emissive: VOID, emissiveIntensity: 1.4, flatShading: true }), shards = [];
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), shardM); s.scale.set(0.6, 1.8, 0.6); grp.add(s); shards.push([s, rand(0, TAU), rand(0.6, R * 0.9), rand(0.4, 1.6)]); }
  let t = 0, nextBoom = 1.3, warn = false, life = 9;
  sfx('charge'); G.fx.ring(new V3(x, 0.06, z), { normal: UP, r0: 0.2, r1: R * 1.4, life: 0.6, color: VOID });
  const e = { done: false, owner: f, update(dt) {
    t += dt; const a = Math.min(1, t / 0.5) * Math.min(1, (life - t) / 0.6);
    disc.material.opacity = 0.75 * a; ringM.opacity = 0.9 * a; rings.forEach((m, i) => (m.rotation.z += dt * (i % 2 ? -1.5 : 1.1)));
    shards.forEach((s) => { s[1] += dt * 1.2; s[0].position.set(Math.cos(s[1]) * s[2], s[3] + Math.sin(t * 2 + s[2]) * 0.2, Math.sin(s[1]) * s[2]); s[0].rotation.y += dt * 2; });
    if (Math.random() < 0.8) { const an = rand(0, TAU), rr = R * 1.3; G.fx.p(new V3(x + Math.cos(an) * rr, 0.2, z + Math.sin(an) * rr), { vel: [-Math.cos(an) * 3.5, 0.6, -Math.sin(an) * 3.5], size: 0.12, size1: 0.02, life: 0.5, color: Math.random() < 0.5 ? VOID : VOID2, drag: 0 }); }
    const alive = f.state !== 'ko' && !f.gone;
    if (alive && t > 0.4 && t < life - 0.4) for (const o of f.foes()) {
      const dx = x - o.pos.x, dz = z - o.pos.z, d = Math.hypot(dx, dz);
      if (d < 7 && d > 0.3 && o.state !== 'dash' && o.onGround) { const k = 1.7 * dt * (1 - d / 7.5); o.pos.x += dx / d * k; o.pos.z += dz / d * k; } // 끌어당김
      if (d < R) { o.addStatus('slow', 0.4, 0.7, f); this.dotT = (this.dotT || 0) - dt; if (this.dotT <= 0) { this.dotT = 0.5; o.dot(f, 7, VOID); } }
    }
    // 주기적 폭발: 빨간 예고 링 → 막을 수 없는 분출
    if (alive && t > nextBoom - 0.85 && !warn) { warn = true; G.fx.ring(new V3(x, 0.07, z), { normal: UP, r0: R + 0.3, r1: R, life: 0.85, color: 0xff2a3a, op: 0.95 }); sfx('teleRed'); }
    if (alive && t > nextBoom) { warn = false; nextBoom += 2.6; const c = new V3(x, 0, z);
      G.fx.beam(c, { r: R * 0.7, h: 10, color: VOID, life: 0.5 }); G.fx.burst(c.clone().setY(0.5), 40, [VOID, VOID2, 0xffffff], 11, { dir: UP, spread: 0.7 }); G.fx.light(c.clone().setY(1), VOID, 90, 0.35); sfx('boom'); G.shake(0.2);
      areaHit(f, c, R, H({ dmg: 55, kb: [3, 8], stun: 0.6, hs: 0.08, unblock: true }), 2.5); }
    if (t > life || !alive) this.kill();
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(grp); disc.geometry.dispose(); rings.forEach((m) => m.geometry.dispose()); if (f._rift === e) f._rift = null; } };
  if (f._rift) f._rift.kill(); f._rift = e; return e;
}

/* =====================================================================
   니힐 기술
   ===================================================================== */
const L1a = { chest: [0.1, -1.0, 0], spine: [0.15, -0.3, 0], shoulderR: [-1.45, 0, -0.5], elbowR: [-0.25, 0, 0], weapon: [1.5, 0, 0] };
const L1b = { chest: [0.2, 0.95, 0], spine: [0.2, 0.35, 0], shoulderR: [-1.4, 0, 0.35] };
const legsW = { hipL: [-0.55, 0, 0.12], kneeL: [0.7, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.55, 0, 0] };
const crouch = { hipY: -0.12, spine: [0.5, 0, 0], chest: [0.15, 0, 0], head: [-0.3, 0, 0], hipL: [-1.0, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.35, 0, -0.1], kneeR: [1.3, 0, 0], shoulderR: [0.4, 0, -0.5], elbowR: [-0.3, 0, 0], weapon: [1.9, 0, 0], shoulderL: [-0.6, 0, 0.5], elbowL: [-0.9, 0, 0] };
const swishV = (f) => { sfx('swing'); f.slashFx({ tilt: 0.15, r: 1.4 * f.scale, at: [0, 1.15 * f.scale, 0.35], color: VOID2 }); };
// 공허 보행: 가라앉아 사라졌다가 플레이어 등 뒤에서 나타나 벤다 (노랑 · 패리 가능)
function blinkMove(fast, chain) {
  const k = fast ? 0.75 : 1, tv = 0.36 * k, ta = 0.62 * k, ts = ta + 0.44, dur = ts + 0.55;
  return { dur, aim: true, noMove: true, trail: true, track: ts - 0.06, tele: [ta + 0.02, 'yellow'], cd: fast ? undefined : 's1',
    keys: [[0, 'base'], [tv, crouch], [ta, { ...L1a, ...legsW, hipY: 0, spine: [0.2, -0.3, 0], head: [0, 0, 0], shoulderL: [-0.4, 0, 0.5], elbowL: [-1.1, 0, 0] }], [ts - 0.04, { chest: [0.1, -1.15, 0] }], [ts + 0.1, L1b], [ts + 0.2, { chest: [0.2, 1.1, 0] }], [dur, 'base']],
    ev: [[0.02, (f, o, G) => { sfx('charge'); G.fx.burst(f.chest(), 20, [VOID, 0x000000], 4, { kind: 'glow', sk: 0.5 }); }],
      [tv, (f, o, G) => { voidPuff(G, f, f.pos); f.root.visible = false; f.inv = Math.max(f.inv, ta - tv + 0.05); sfx('dash'); }],
      [ta, (f, o, G) => {
        if (o) { const b = o.fwd(new V3()), d = 1.7 + 0.35 * f.scale, p = o.pos.clone().addScaledVector(b, -d).setY(0), r = Math.hypot(p.x, p.z); if (r > 19) p.multiplyScalar(19 / r); f.pos.copy(p); f.vel.set(0, 0, 0); f.faceOpp(); }
        f.root.visible = true; f.wJump = true; voidPuff(G, f, f.pos, 0.8); f.applyRig(1 / 60); }],
      [ts, (f, o, G) => swishV(f)],
      [ts + 0.06, (f, o, G) => G.spawn(echo(G, f, sc3(f, [0, 1.1, 1.2]), { dmg: 34 }))],
      ...(chain ? [[dur - 0.02, (f, o, G) => { if (f.enraged && o && o.state !== 'ko') f.start('blink2'); }]] : [])],
    hits: [H({ t0: ts + 0.02, t1: ts + 0.16, weapon: true, at: [0, 1.1, 1.1], r: 1.0, dmg: 68, kb: [4.5, 1.5], stun: 0.5, hs: 0.09 })],
    end: (f) => { f.root.visible = true; } };
}
const sweepT = 0.62;
const boss = {
  ...S.boss, scale: 1.6, viewH: 2.15,
  stats: { hp: 4200, speed: 4.4, jump: 9, daze: 340, armor: true, breakTime: 5 },
  skills: { s1: { name: '공허 보행', cd: 5 }, s2: { name: '거울 분신', cd: 9 }, heavy: { name: '파멸의 낙참', cd: 6.5 }, sweep: { name: '공허 일섬', cd: 6 }, wave: { name: '공허 파동검', cd: 4 }, rift: { name: '공허 균열', cd: 10 }, ult: { name: '-', sub: '' } },
  createModel: (p) => buildNihil(p, 1.6), poses,
  moves: {
    // 공허 검격 1~3타 (3타는 잔향을 남김)
    light1: slow(T.light1, { k: 1.25, windup: 0.5, next: 'light2', dmg: 1.5, ev: [[0.5 + 0.08 * 1.25, swishV]] }),
    light2: slow(T.light2, { k: 1.25, windup: 0.22, tele: null, next: 'light3', dmg: 1.5, ev: [[0.22 + 0.09 * 1.25, chop]] }),
    light3: slow(T.light3, { k: 1.2, windup: 0.4, tele: 'yellow', dmg: 1.3, ev: [[0.4 + 0.15 * 1.2, (f, o, G) => { sfx('zap'); G.spawn(echo(G, f, sc3(f, [0, 1.1, 1.4]), { dmg: 36, tilt: 0.1 })); }]] }),
    // 파멸의 낙참 (빨강): 내려찍은 자리에서 앞으로 땅 균열이 뻗는다 (옆으로 피하거나 뛰어넘기) + 잔향
    heavy: { ...slow(T.light2, { k: 1.3, windup: 0.8, tele: 'red', unblock: true, dmg: 2.1, ev: [[0.8 + 0.1 * 1.3, (f, o, G) => {
      chop(f); G.shake(0.3); sfx('boom'); const fw = f.fwd(new V3()), p0 = f.pos.clone().setY(0.05); const hitSet = new Set(); // 균열 한 줄은 대상마다 한 번만
      for (let i = 0; i < 9; i++) { const c = p0.clone().addScaledVector(fw, 1.6 + i * 0.95); let t = -i * 0.055, done = false;
        G.spawn({ done: false, owner: f, update(dt) { t += dt; if (t >= 0 && !done) { done = true; G.fx.burst(c.clone().setY(0.3), 12, [VOID, 0x000000, VOID2], 7, { dir: UP, spread: 0.5 }); G.fx.ring(c, { normal: UP, r0: 0.2, r1: 1.3, life: 0.35, color: VOID }); for (const o of f.foes()) { if (hitSet.has(o) || o.pos.y > 0.6) continue; const dx = o.pos.x - c.x, dz = o.pos.z - c.z; if (Math.hypot(dx, dz) < 0.9 + 0.42 * o.scale && o.takeHit(f, H({ dmg: 52, kb: [2, 7], stun: 0.55, hs: 0.06, unblock: true }), fw.clone())) hitSet.add(o); } } if (t > 0.1) this.done = true; }, kill() { this.done = true; } }); }
      G.spawn(echo(G, f, sc3(f, [0, 0.9, 1.3]), { dmg: 40, tilt: Math.PI / 2 }));
    }]] }), cd: 'heavy' },
    // 공허 일섬: 한 바퀴 회전 베기 (노랑) — 0.6초 뒤 같은 자리를 잔향이 다시 쓴다 (원 밖으로 벗어나야 함)
    sweep: { dur: 1.45, cd: 'sweep', aim: true, track: 0.45, tele: [0.15, 'yellow'], noMove: true, trail: true,
      keys: [[0, 'base'], [0.5, { spine: [0.25, 0.9, 0], chest: [0.1, 0.7, 0], shoulderR: [-1.4, 0, -1.0], elbowR: [-0.2, 0, 0], weapon: [1.5, 0, 0], hipL: [-0.7, 0, 0.3], kneeL: [0.9, 0, 0], hipR: [0.3, 0, -0.3], kneeR: [0.8, 0, 0] }],
        [sweepT, { spine: [0.25, -0.4, 0], chest: [0.1, -0.5, 0], shoulderR: [-1.5, 0, 0.3] }], [0.95, {}], [1.45, 'base']],
      tick: (f, o, G, t, dt) => { if (t > sweepT - 0.04 && t < sweepT + 0.3) f.yaw -= dt * TAU / 0.34; },
      ev: [[sweepT - 0.02, (f, o, G) => { sfx('heavy'); f.slashFx({ tilt: 0.05, r: 2.8 * f.scale, at: [0, 0.95 * f.scale, 0], color: VOID2, life: 0.35 }); G.fx.ring(f.pos.clone().setY(1.2), { normal: UP, r0: 0.5, r1: 3.1 * f.scale, life: 0.4, color: VOID }); }],
        [sweepT + 0.3, (f, o, G) => G.spawn(echo(G, f, f.pos.clone().setY(1.0), { ring: true, r: 3.0, dmg: 40, tilt: 0.02 }))]],
      hits: [H({ t0: sweepT, t1: sweepT + 0.3, at: [0, 0.75, 0], r: 1.85, dmg: 62, kb: [7, 2], stun: 0.5, hs: 0.08 })] },
    // 공허 보행 (원거리 → 등 뒤로 순간이동) · 2페이즈에는 한 번 더 이어진다
    s1: blinkMove(false, true), blink2: blinkMove(true, false),
    // 거울 분신: 분신 2체(2페이즈 3체)가 플레이어를 둘러싸고 니힐과 같은 순간에 같은 동작으로 벤다
    s2: { ...slow(T.light1, { k: 1.3, windup: 0.85, tele: 'yellow', dmg: 1.4, ev: [
      [0.12, (f, o, G) => { if (!o) return; const n = f.enraged ? 3 : 2, a0 = Math.atan2(f.pos.x - o.pos.x, f.pos.z - o.pos.z), R = 2.7 + 0.2 * f.scale;
        for (let i = 0; i < n; i++) { const a = a0 + TAU * (i + 1) / (n + 1), p = new V3(o.pos.x + Math.sin(a) * R, 0, o.pos.z + Math.cos(a) * R), r = Math.hypot(p.x, p.z); if (r > 19.5) p.multiplyScalar(19.5 / r); G.spawn(voidClone(G, f, p, [0.85 + 0.1 * 1.3, 0.85 + 0.2 * 1.3])); } }],
      [0.85 + 0.08 * 1.3, swishV], [0.85 + 0.2 * 1.3, (f, o, G) => G.spawn(echo(G, f, sc3(f, [0, 1.1, 1.3]), { dmg: 30 }))]] }), dur: 1.75, cd: 's2', noMove: true },
    // 공허 파동검: 멀리서 참격파를 날리고, 0.6초 뒤 같은 자리에서 잔향 파동이 한 번 더 날아간다
    wave: { ...slow(T.light1, { k: 1.2, windup: 0.5, tele: 'yellow', hits: [], ev: [[0.5 + 0.08 * 1.2, (f, o, G) => {
      swishV(f); const org = sc3(f, [0, 1.15, 0.9]);
      const fire = (from) => { const d = (o ? o.chest(new V3()) : f.local([0, 1.1, 10])).sub(from).normalize(); G.spawn(new Projectile(G, { owner: f, pos: from.clone(), vel: d.multiplyScalar(15), r: 0.55, color: VOID, homing: 0.35, life: 2.2, hit: H({ dmg: 42, kb: [4, 2], stun: 0.45, hs: 0.07, basic: false }) })); G.fx.slash(from, { fwd: d, normal: UP, r: 1.2, color: VOID2, life: 0.3 }); };
      fire(org); let t = 0; G.fx.burst(org, 14, [VOID, VOID2], 4, { kind: 'glow', sk: 0.4 });
      G.spawn({ done: false, owner: f, update(dt) { t += dt; if (Math.random() < 0.6) G.fx.p(org, { size: 0.5, size1: 0.1, life: 0.2, color: VOID2, alpha: 0.6 }); if (t >= 0.6) { fire(org); sfx('shot'); this.done = true; } }, kill() { this.done = true; } });
    }]] }), cd: 'wave' },
    // 2페이즈 · 공허 균열 (빨강): 대검을 땅에 꽂아 플레이어 자리에 균열 지대를 연다
    rift: { dur: 1.6, cd: 'rift', aim: true, track: 0.6, tele: [0.2, 'red'], noMove: true,
      keys: [[0, 'base'], [0.55, { spine: [-0.25, 0, 0], chest: [-0.1, 0, 0], head: [-0.2, 0, 0], shoulderR: [-3.0, 0, -0.2], shoulderL: [-2.8, 0, 0.3], elbowR: [-0.4, 0, 0], elbowL: [-0.6, 0, 0], weapon: [2.6, 0, 0] }],
        [0.85, { spine: [0.7, 0, 0], chest: [0.25, 0, 0], shoulderR: [-1.2, 0, -0.1], shoulderL: [-1.1, 0, 0.2], elbowR: [-0.2, 0, 0], weapon: [2.4, 0, 0], hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.2, 0, 0], kneeR: [1.4, 0, 0], hipY: -0.15 }], [1.25, {}], [1.6, 'base']],
      ev: [[0.1, () => sfx('charge')], [0.86, (f, o, G) => { const c = f.local([0, 0, 1.3 * f.scale]).setY(0.05); G.shake(0.35); sfx('boom'); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 4, life: 0.5, color: VOID }); G.fx.burst(c, 40, [VOID, 0x000000, VOID2], 10, { dir: UP, spread: 1.2 });
        areaHit(f, c, 2.2, H({ dmg: 50, kb: [5, 6], stun: 0.5, unblock: true }));
        const p = o ? o.pos.clone() : c; G.spawn(voidRift(G, f, p.x, p.z)); }]] },
  },
  ai: { range: 11, keep: 3, cdMin: 0.9, cdMax: 1.9, chain: 0.8,
    pick: (f, o, d) => {
      const ok = (k) => (f.cd[k] || 0) <= 0, r = Math.random();
      if (f.enraged && ok('rift') && !f._rift && r < 0.45) return 'rift';
      if (d > 6.5) return ok('s1') && r < 0.6 ? 's1' : ok('wave') ? 'wave' : ok('s1') ? 's1' : null;
      if (d > 3.6) return ok('s2') && r < 0.4 ? 's2' : ok('wave') && r < 0.7 ? 'wave' : ok('s1') ? 's1' : null;
      if (ok('sweep') && r < 0.22) return 'sweep';
      if (ok('heavy') && r < 0.42) return 'heavy';
      if (ok('s2') && r < 0.55) return 's2';
      if (ok('s1') && r < 0.66) return 's1'; // 가까워도 등 뒤로 순간이동
      return 'light';
    } },
};

export default { grunt, archer, brute, boss };
