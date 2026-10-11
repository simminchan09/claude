// 몬스터 · 보스 정의 (토벌전 · 보스전)
// 캐릭터 정의와 같은 형식에 ai(행동)와 stats.daze(그로기) · stats.armor(슈퍼아머)가 추가된다.
// 기술의 tele: [시간, 'yellow' | 'red'] — 공격 예고 빛. 노랑은 패리 가능, 빨강(unblock)은 회피해야 한다.
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { Projectile, areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import trainer from '../characters/trainer.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.21, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44, headTop: 0.24 };
const T = trainer.moves;

/* ---------- 모델: 공허 결정체 ---------- */
function construct(pal, weapon) {
  const m = buildHumanoid(DIMS), J = m.J;
  const body = new THREE.MeshStandardMaterial({ color: pal.body ?? 0x15121c, metalness: 0.35, roughness: 0.5 });
  const shell = new THREE.MeshStandardMaterial({ color: pal.armor, metalness: 0.5, roughness: 0.3, flatShading: true });
  const glow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: pal.accent, emissiveIntensity: 2.6 });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); parent.add(me); return me; };
  const limb = (parent, len, r, mat) => add(parent, new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 8), mat, 0, -len / 2, 0);
  add(J.hips, new THREE.BoxGeometry(0.3, 0.16, 0.2), shell, 0, -0.02, 0);
  add(J.spine, new THREE.CapsuleGeometry(0.12, 0.1, 4, 8), body, 0, 0.1, 0);
  const tor = add(J.chest, new THREE.IcosahedronGeometry(0.22, 0), shell, 0, 0.15, 0); tor.scale.set(1.1, 1, 0.8);
  add(J.chest, new THREE.OctahedronGeometry(0.07), glow, 0, 0.16, 0.15);
  for (const s of [-1, 1]) add(J.chest, new THREE.ConeGeometry(0.06, 0.32, 5), shell, s * 0.2, 0.32, -0.04, 0, 0, -s * 0.5);
  add(J.neck, new THREE.CylinderGeometry(0.045, 0.055, 0.12, 8), body, 0, 0.03, 0);
  const head = add(J.head, new THREE.OctahedronGeometry(0.13), shell, 0, 0.12, 0); head.scale.set(0.9, 1.25, 1);
  add(J.head, new THREE.BoxGeometry(0.16, 0.025, 0.04), glow, 0, 0.13, 0.1);
  for (const s of [-1, 1]) add(J.head, new THREE.ConeGeometry(0.03, 0.22, 4), shell, s * 0.08, 0.27, -0.02, -0.4, 0, -s * 0.35);
  for (const [sh, el, ha] of [[J.shoulderL, J.elbowL, J.handL], [J.shoulderR, J.elbowR, J.handR]]) {
    add(sh, new THREE.DodecahedronGeometry(0.09, 0), shell); limb(sh, DIMS.uArm, 0.05, body); add(el, new THREE.SphereGeometry(0.035, 8, 6), glow); limb(el, DIMS.lArm, 0.048, shell);
    add(ha, new THREE.BoxGeometry(0.075, 0.1, 0.07), body, 0, -0.04, 0);
  }
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    limb(hp, DIMS.thigh, 0.072, body); add(kn, new THREE.SphereGeometry(0.045, 8, 6), glow); limb(kn, DIMS.shin, 0.06, shell);
    add(ft, new THREE.ConeGeometry(0.07, 0.26, 4), shell, 0, -0.04, 0.06, Math.PI / 2, 0, 0);
  }
  let len = 1.1;
  if (weapon === 'claw') { len = 0.75; for (const x of [-0.035, 0, 0.035]) add(J.weapon, new THREE.BoxGeometry(0.012, 0.03, 0.7), glow, x, 0, 0.42); }
  else if (weapon === 'hammer') { len = 1.3; add(J.weapon, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), body, 0, 0, 0.5, Math.PI / 2); add(J.weapon, new THREE.BoxGeometry(0.34, 0.34, 0.5), shell, 0, 0, 1.15); add(J.weapon, new THREE.BoxGeometry(0.36, 0.06, 0.52), glow, 0, 0, 1.15); }
  else if (weapon === 'greatsword') { len = 1.7; add(J.weapon, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), body, 0, 0, 0, Math.PI / 2); add(J.weapon, new THREE.BoxGeometry(0.3, 0.05, 0.06), shell, 0, 0, 0.16); add(J.weapon, new THREE.BoxGeometry(0.04, 0.2, 1.5), shell, 0, 0, 0.95); add(J.weapon, new THREE.BoxGeometry(0.045, 0.03, 1.5), glow, 0, 0.1, 0.95); }
  else { len = 0.5; add(J.weapon, new THREE.BoxGeometry(0.02, 0.05, 0.45), glow, 0, 0, 0.28); }
  return { ...m, sole: 0.07, weaponPts(b, t) { J.weapon.localToWorld(b.set(0, 0, 0.2)); J.weapon.localToWorld(t.set(0, 0, len)); } };
}

/* ---------- 기술 변형 도우미 ----------
   원본 기술 앞에 '자세 잡기(windup)' 시간을 넣고 전체를 k배 느리게 만든다. 적의 공격이 읽히도록. */
function slow(src, { k = 1.2, windup = 0.4, tele = 'yellow', dmg = 1, unblock = false, ev, hits, lunge, next, cancel } = {}) {
  const sh = (t) => windup + t * k;
  const keys = [src.keys[0], [windup, {}], ...src.keys.slice(1).map(([t, p]) => [sh(t), p])];
  return {
    dur: sh(src.dur), trail: src.trail, track: windup * 0.85, aim: true, keys, tele: tele ? [windup * 0.3, tele] : null, next, cancel: cancel ?? (next ? sh(src.cancel ?? src.dur * 0.6) : undefined),
    lunge: lunge ?? (src.lunge || []).map(([a, b, s]) => [sh(a), sh(b), s / k]),
    ev: ev ?? (src.ev || []).filter(([t]) => t > 0.001).map(([t, fn]) => [sh(t), fn]),
    hits: hits ?? (src.hits || []).map((h) => ({ ...h, t0: sh(h.t0), t1: sh(h.t1), dmg: h.dmg * dmg, unblock: unblock || h.unblock, noCrit: true })),
  };
}
const swish = (f) => { sfx('swing'); f.slashFx({ tilt: 0.15, r: 1.35 * f.scale, at: [0, 1.15 * f.scale, 0.35] }); };
const chop = (f) => { sfx('heavy'); f.slashFx({ tilt: Math.PI / 2, r: 1.4 * f.scale, at: [0.05, 1.1 * f.scale, 0.3], flip: true }); };
function slam(f, G, r, dmg, color) {
  const c = f.local([0, 0, 1.2 * f.scale]).setY(0.06); sfx('boom'); G.shake(0.35);
  G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.4, r1: r * 1.2, life: 0.55, color }); G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.2, r1: r * 0.8, life: 0.4, color: 0xffffff });
  G.fx.burst(c, 40, [color, 0xffffff], 12, { dir: new V3(0, 1, 0), spread: 1.3 }); G.fx.burst(c, 22, 0x6a5a70, 6, { kind: 'dust', sk: 1.5 }); G.fx.light(c.clone().setY(1), color, 90, 0.35);
  areaHit(f, c, r, { dmg, kb: [7, 7], stun: 0.6, hs: 0.1, shake: 0.15, unblock: true, noCrit: true });
}
function shot(f, o, G, { dmg = 40, speed = 13, homing = 0.6, r = 0.3, spread = 0 } = {}) {
  const h = f.model.J.handL.getWorldPosition(new V3()), d = o.chest(new V3()).sub(h).normalize();
  if (spread) d.applyAxisAngle(new V3(0, 1, 0), spread);
  G.spawn(new Projectile(G, { owner: f, pos: h.addScaledVector(d, 0.3), vel: d.multiplyScalar(speed), r, color: f.palette.accent, homing, hit: { dmg, kb: [4, 3], stun: 0.45, hs: 0.06, noCrit: true } })); sfx('shot');
}
// 바닥 경고 → 기둥 폭발 (보스 2페이즈)
function voidPillar(G, f, x, z, delay) {
  let t = -delay; const ring = { x, z };
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return;
    if (t < 0.9) { if (Math.random() < 0.5) G.fx.p(new V3(x + rand(-1.4, 1.4), 0.1, z + rand(-1.4, 1.4)), { vel: [0, rand(1, 3), 0], life: 0.4, size: 0.14, color: 0xff2a3a }); if (!ring.r) { ring.r = 1; G.fx.ring(new V3(x, 0.05, z), { normal: new V3(0, 1, 0), r0: 1.7, r1: 1.6, life: 0.9, color: 0xff2a3a, op: 0.9 }); } }
    else if (!ring.boom) {
      ring.boom = true; G.fx.beam(new V3(x, 0, z), { r: 1.2, h: 14, color: f.palette.accent, life: 0.6 }); G.fx.burst(new V3(x, 0.5, z), 30, [f.palette.accent, 0xffffff], 10, { dir: new V3(0, 1, 0), spread: 0.6 });
      sfx('boom'); G.shake(0.2); areaHit(f, new V3(x, 0, z), 1.6, { dmg: 85, kb: [3, 9], stun: 0.6, hs: 0.08, unblock: true, noCrit: true }, 3);
    }
    if (t > 1.5) this.done = true;
  } };
}

const poses = trainer.poses;
const pal = (accent, armor, band) => ({ accent, armor, band });

/* ---------- 잡몹 ---------- */
export const GRUNT = {
  id: 'grunt', name: '공허 파편병', short: '파편병', title: '공허 잡병', enemy: true,
  stats: { hp: 280, speed: 4.6, jump: 8, daze: 70, breakTime: 3 }, palettes: [pal(0xff3a5a, 0x2a2233, '#2a0612')],
  skills: { s1: { name: '-', cd: 1 }, s2: { name: '-', cd: 1 }, ult: { name: '-', sub: '' } },
  createModel: (p) => construct(p, 'claw'), poses,
  moves: {
    light1: slow(T.light1, { k: 1.3, windup: 0.45, next: 'light2', dmg: 0.7 }),
    light2: slow(T.light2, { k: 1.3, windup: 0.15, tele: null, dmg: 0.7 }),
    heavy: slow(T.light3, { k: 1.2, windup: 0.6, dmg: 0.8, ev: [[0.6 + 0.15 * 1.2, (f) => { sfx('zap'); }]] }),
  },
  ai: { range: 2.1, keep: 1.4, cdMin: 1.2, cdMax: 2.6, chain: 0.6, pick: (f, o, d) => (d < 2.6 ? (Math.random() < 0.65 ? 'light' : 'heavy') : null) },
};
export const ARCHER = {
  id: 'archer', name: '공허 사수', short: '사수', title: '원거리 잡병', enemy: true,
  stats: { hp: 210, speed: 4.2, jump: 8, daze: 55, breakTime: 3 }, palettes: [pal(0xb06aff, 0x231f33, '#1a0a2a')],
  skills: { s1: { name: '공허탄', cd: 2.2 }, s2: { name: '-', cd: 1 }, ult: { name: '-', sub: '' } },
  createModel: (p) => construct(p, 'dagger'), poses,
  moves: {
    light1: slow(T.light1, { k: 1.3, windup: 0.4, dmg: 0.6 }),
    s1: { ...slow(T.s1, { k: 1.4, windup: 0.5, ev: [[0.5 + 0.24 * 1.4, (f, o, G) => o && shot(f, o, G, { dmg: 45 })]] }), cd: 's1', tick: undefined },
  },
  ai: { range: 11, keep: 7, cdMin: 1.0, cdMax: 2.2, pick: (f, o, d) => (d > 4 && f.cd.s1 <= 0 ? 's1' : d < 2.6 ? 'light' : null) },
};
export const BRUTE = {
  id: 'brute', name: '공허 파쇄자', short: '파쇄자', title: '중장갑 정예', enemy: true, scale: 1.4,
  stats: { hp: 900, speed: 3.4, jump: 7, daze: 150, armor: true, breakTime: 4 }, palettes: [pal(0xff6a2a, 0x332622, '#2a1006')],
  skills: { s1: { name: '-', cd: 1 }, s2: { name: '지면 강타', cd: 6 }, ult: { name: '-', sub: '' } },
  createModel: (p) => construct(p, 'hammer'), poses,
  moves: {
    light1: slow(T.light2, { k: 1.5, windup: 0.6, dmg: 1.5, ev: [[0.6 + 0.09 * 1.5, chop]] }),
    s2: { ...slow(T.s2, { k: 1.2, windup: 0.7, tele: 'red', ev: [[0.7 + 0.1 * 1.2, (f) => { f.vel.y = 5; f.onGround = false; }], [0.7 + 0.55 * 1.2, (f, o, G) => slam(f, G, 4.5, 110, f.palette.accent)]] }), cd: 's2' },
  },
  ai: { range: 2.9, keep: 2, cdMin: 1.6, cdMax: 3, pick: (f, o, d) => (d < 3.4 ? (f.cd.s2 <= 0 && Math.random() < 0.45 ? 's2' : 'light') : null) },
};

/* ---------- 보스 ---------- */
export const BOSS = {
  id: 'boss', name: '공허의 기사 니힐', short: '니힐', title: '공허의 기사', enemy: true, boss: true, scale: 1.6,
  stats: { hp: 4200, speed: 4.6, jump: 9, daze: 340, armor: true, breakTime: 5 }, palettes: [pal(0xb04aff, 0x241c30, '#1a0628')],
  skills: { s1: { name: '공허 돌진', cd: 6 }, s2: { name: '파멸의 강타', cd: 8 }, ult: { name: '-', sub: '' } },
  createModel: (p) => construct(p, 'greatsword'), poses,
  moves: {
    light1: slow(T.light1, { k: 1.25, windup: 0.5, next: 'light2', dmg: 1.6, ev: [[0.5 + 0.08 * 1.25, swish]] }),
    light2: slow(T.light2, { k: 1.25, windup: 0.2, tele: null, next: 'light3', dmg: 1.6, ev: [[0.2 + 0.09 * 1.25, chop]] }),
    light3: slow(T.light3, { k: 1.2, windup: 0.35, tele: 'yellow', dmg: 1.5 }),
    heavy: slow(T.heavy, { k: 1.2, windup: 0.55, dmg: 1.4 }),
    // 공허 돌진: 빨간 예고 뒤 멀리서 단숨에 베어 지나간다 (회피해야 함)
    s1: { ...slow(T.light3, { k: 1.0, windup: 0.75, tele: 'red', unblock: true, dmg: 1.8, lunge: [[0.75 + 0.12, 0.75 + 0.36, 20]], ev: [[0.75 + 0.12, (f, o, G) => { sfx('dash'); G.fx.burst(f.chest(), 20, f.palette.accent, 6); }]] }), cd: 's1' },
    s2: { ...slow(T.s2, { k: 1.15, windup: 0.8, tele: 'red', ev: [[0.8 + 0.1 * 1.15, (f) => { f.vel.y = 7; f.onGround = false; }], [0.8 + 0.55 * 1.15, (f, o, G) => {
      slam(f, G, 5.5, 130, f.palette.accent);
      for (let i = 1; i <= 2; i++) G.spawn({ done: false, t: 0, update(dt) { this.t += dt; if (this.t > i * 0.35 && !this.d) { this.d = true; const c = f.pos.clone().setY(0.06); G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 2, r1: 5.5 + i * 3, life: 0.6, color: f.palette.accent }); areaHit(f, c, 5.5 + i * 3, { dmg: 50, kb: [6, 5], stun: 0.4, unblock: true, noCrit: true }, 0.5); } if (this.t > 1.2) this.done = true; } });
    }]] }), cd: 's2' },
    // 2페이즈 전용: 플레이어 발밑에 공허 기둥 연속 소환
    rain: { dur: 1.6, aim: true, track: 0.4, tele: [0.2, 'red'], keys: [[0, 'base'], [0.3, { shoulderR: [-3.0, 0, -0.2], spine: [-0.2, 0, 0] }], [1.2, {}], [1.6, 'base']],
      ev: [[0.45, (f, o, G) => { if (!o) return; sfx('charge'); for (let i = 0; i < 5; i++) { const a = rand(0, TAU), r = i === 0 ? 0 : rand(1.5, 4); G.spawn(voidPillar(G, f, o.pos.x + Math.cos(a) * r, o.pos.z + Math.sin(a) * r, i * 0.22)); } }]] },
  },
  ai: { range: 3.4, keep: 2.2, cdMin: 0.9, cdMax: 2.0, chain: 0.85,
    pick: (f, o, d) => {
      if (f.enraged && Math.random() < 0.25) return 'rain';
      if (d > 5 && f.cd.s1 <= 0) return 's1';
      if (d < 4 && f.cd.s2 <= 0 && Math.random() < 0.35) return 's2';
      if (d < 3.6) return Math.random() < 0.7 ? 'light' : 'heavy';
      return f.cd.s1 <= 0 ? 's1' : null;
    } },
};
BOSS.ai.range = 8; // 멀리서도 돌진을 고를 수 있게 (근접 기술은 pick 에서 거리로 거른다)

export const ENEMIES = { grunt: GRUNT, archer: ARCHER, brute: BRUTE, boss: BOSS };
// 토벌전 구성 (마지막은 보스)
export const WAVES = [['grunt', 'grunt', 'grunt'], ['grunt', 'archer', 'grunt', 'archer'], ['brute', 'grunt', 'archer'], ['boss']];
