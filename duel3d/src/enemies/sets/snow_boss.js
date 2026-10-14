// 빙설 여왕 이스벨 — 거리를 두고 싸우는 얼음 마법사 (보스 기술 · 자세 · AI)
//   다가오면 서리 폭발과 함께 멀리 순간이동하고, 얼음 벽으로 길을 막고, 경기장을 쓸어내는 빙결 광선 · 땅을 따라 솟는 빙창 줄기를 쓴다.
//   2페이즈: 눈보라(경기장 전체 둔화 + 떨어지는 고드름) · 빙각(얼음 껍질 — 깨뜨려 끌어내지 않으면 폭발하며 회복)
import * as THREE from 'three';
import { Projectile, areaHit } from '../../entities.js';
import { rand, sfx } from '../../core.js';
import { ARENA_R } from '../../stage.js';
import { pillar } from '../kit.js';
import { buildIceQueen, crystalGeo, xf } from './snow_model.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const ICE = 0xa8ecff, ICE2 = 0xffffff, SLOW = (t = 2, k = 0.55) => ['slow', t, k];
const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * k; };

/* =====================================================================
   바닥 표식 · 효과 메시 (풀 대신 짧게 살다 사라지는 엔티티)
   ===================================================================== */
let _g = null; const GEO = () => _g || (_g = { disc: new THREE.CircleGeometry(1, 40), ring: new THREE.RingGeometry(0.82, 1, 48), sq: new THREE.PlaneGeometry(1, 1), cyl: (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5); return g; })(),
  spike: crystalGeo(1, 0.18, 0.2, 0.35), wall: (() => { const list = []; for (let i = 0; i < 9; i++) { const x = (i / 8 - 0.5) * 2.8, h = 1.7 + Math.sin(i * 2.3) * 0.4 + (i % 2) * 0.35; list.push(xf(crystalGeo(h, 0.32, 0.05, 0.3), [x, 0, (i % 3 - 1) * 0.12], [(i % 3 - 1) * 0.12, i, (i / 8 - 0.5) * 0.35])); } return mergeG(list); })() });
function mergeG(list) { // snow_model.merge 와 같은 일 (순환 import 피함)
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni); let o = 0, oi = 0;
  for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); const n = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); const a = g.index.array; for (let i = 0; i < a.length; i++) idx[oi + i] = a[i] + o; oi += a.length; o += n; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
}
const addMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
let _iceM = null; const iceSolid = () => _iceM || (_iceM = new THREE.MeshPhysicalMaterial({ color: 0xcfefff, emissive: 0x3a8ad0, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.88 }));
// 바닥 표식: kind 'disc' · 'ring' · 'sq'(sx × sz 직사각형, yaw 방향). fade(k) 로 깜빡임
export function decal(G, owner, o) {
  const mat = addMat(o.color ?? 0xff2a3a, o.op ?? 0.5), me = new THREE.Mesh(GEO()[o.kind || 'disc'], mat);
  me.rotation.set(-Math.PI / 2, 0, o.yaw || 0); me.position.set(o.x, o.y ?? 0.045, o.z); me.scale.set(o.sx ?? o.r ?? 1, o.sz ?? o.r ?? 1, 1); me.renderOrder = 6; G.scene.add(me);
  let t = -(o.delay || 0); me.visible = t >= 0;
  return { done: false, owner, mesh: me, update(dt) { t += dt; me.visible = t >= 0; if (t < 0) return; const k = t / o.life; mat.opacity = (o.op ?? 0.5) * (o.pulse ? 0.65 + 0.35 * Math.sin(t * 18) : 1) * (k > 0.8 ? (1 - k) / 0.2 : 1) * Math.min(1, t / 0.08); if (o.grow) me.scale.setScalar((o.r ?? 1) * Math.min(1, 0.3 + t / o.life)); if (o.tick) o.tick(me, k, dt); if (t >= o.life) this.kill(); },
    kill() { if (this.done) return; this.done = true; G.scene.remove(me); mat.dispose(); } };
}
// 빨간 예고선 (시작점에서 방향 yaw 로 길이 L, 폭 w)
const lane = (G, f, x, z, yaw, L, w, life, color = 0xff2a3a) => decal(G, f, { kind: 'sq', x: x + Math.sin(yaw) * L / 2, z: z + Math.cos(yaw) * L / 2, yaw, sx: w, sz: L, life, color, op: 0.42, pulse: true });
const clampArena = (p, m = 1.5) => { const r = Math.hypot(p.x, p.z), R = ARENA_R - m; if (r > R) { p.x *= R / r; p.z *= R / r; } return p; };

/* =====================================================================
   자세 (지팡이는 몸 기준 방향 — model.rigHook)
   ===================================================================== */
const LEGS = { hipL: [0.05, 0, 0.04], kneeL: [0.1, 0, 0], footL: [0.4, 0, 0], hipR: [0.05, 0, -0.04], kneeR: [0.1, 0, 0], footR: [0.4, 0, 0] };
export const poses = {
  base: { hips: [0, 0, 0], spine: [0.02, 0, 0], chest: [-0.05, 0.05, 0], neck: [0, 0, 0], head: [0.06, -0.05, 0],
    shoulderR: [-0.3, 0, -0.16], elbowR: [-1.15, 0, 0], handR: [0, 0, 0], weapon: [1.5, 0, 0.06], shoulderL: [-0.25, 0, 0.32], elbowL: [-1.0, 0.3, 0], handL: [0.2, 0, 0.4], ...LEGS },
  run: { spine: [0.18, 0, 0], chest: [0.05, 0, 0], shoulderR: [0.1, 0, -0.25], elbowR: [-0.9, 0, 0], weapon: [0.6, 0, 0], shoulderL: [0.35, 0, 0.35], elbowL: [-0.4, 0, 0] },
  jump: { spine: [-0.1, 0, 0], shoulderL: [-0.6, 0, 0.7], shoulderR: [-0.6, 0, -0.5] },
  guard: { chest: [0.05, -0.3, 0], shoulderR: [-1.3, 0, 0.4], elbowR: [-1.0, 0, 0], weapon: [1.4, 0.6, 0.6], shoulderL: [-1.2, 0, -0.1], elbowL: [-1.4, 0, 0] },
  hit: { spine: [-0.3, 0, 0], chest: [-0.2, 0.2, 0], head: [-0.3, 0, 0], shoulderR: [0.3, 0, -0.5], shoulderL: [0.3, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.4, 0, 0], spine: [-0.3, 0, 0], head: [-0.4, 0, 0], shoulderR: [0.5, 0, -0.9], shoulderL: [0.5, 0, 0.9] },
  down: { hipY: -0.76, hips: [-1.52, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0] },
  dash: { spine: [0.4, 0, 0], shoulderR: [0.6, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [0.2, 0, 0], shoulderL: [0.7, 0, 0.4] },
  win: { chest: [-0.15, 0, 0], head: [-0.15, 0, 0], shoulderR: [-2.6, 0, -0.2], elbowR: [-0.3, 0, 0], weapon: [1.7, 0, 0], shoulderL: [-0.4, 0, 0.6], elbowL: [-0.6, 0, 0] },
  portrait: { chest: [0, -0.3, 0], head: [0.05, 0.25, 0], shoulderR: [-1.4, 0, -0.3], elbowR: [-1.2, 0, 0], weapon: [1.5, 0.3, 0] },
  crouch: { spine: [0.3, 0, 0], ...LEGS },
};
// 기술 자세 조각
const P = {
  castL: { chest: [-0.05, 0.35, 0], shoulderL: [-1.55, 0, 0.1], elbowL: [-0.15, 0, 0], handL: [0, 0, 0], shoulderR: [-0.2, 0, -0.3] },
  castL2: { chest: [0.05, -0.15, 0], shoulderL: [-1.45, 0, 0.0], elbowL: [-0.05, 0, 0], handL: [0.4, 0, 0] },
  aim: { chest: [0, -0.25, 0], spine: [0.05, 0, 0], shoulderR: [-1.45, 0, -0.05], elbowR: [-0.15, 0, 0], weapon: [0.05, 0, 0], shoulderL: [-0.5, 0, 0.5], elbowL: [-0.9, 0, 0] },
  raise: { spine: [-0.15, 0, 0], chest: [-0.15, 0, 0], head: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.15], elbowR: [-0.2, 0, 0], weapon: [1.75, 0, 0], shoulderL: [-0.6, 0, 0.9], elbowL: [-0.4, 0, 0] },
  slam: { spine: [0.45, 0, 0], chest: [0.15, 0, 0], head: [-0.2, 0, 0], shoulderR: [-1.0, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-0.9, 0, 0], shoulderL: [-0.3, 0, 0.8] },
  swingA: { chest: [0, 0.9, 0], spine: [0.05, 0.3, 0], shoulderR: [-1.3, 0, -0.9], elbowR: [-0.3, 0, 0], weapon: [0.2, 1.0, 0] },
  swingB: { chest: [0.1, -0.9, 0], spine: [0.1, -0.3, 0], shoulderR: [-1.3, 0, 0.5], elbowR: [-0.2, 0, 0], weapon: [0.2, -1.2, 0] },
  pray: { spine: [-0.1, 0, 0], chest: [-0.1, 0, 0], head: [0.25, 0, 0], shoulderR: [-0.9, 0, 0.3], elbowR: [-1.6, 0, 0], weapon: [1.57, 0, 0], shoulderL: [-0.9, 0, -0.3], elbowL: [-1.6, 0, 0] },
  spread: { spine: [-0.2, 0, 0], chest: [-0.2, 0, 0], head: [-0.25, 0, 0], shoulderR: [-1.0, 0, -1.2], elbowR: [-0.1, 0, 0], weapon: [1.2, 0, 0], shoulderL: [-1.0, 0, 1.2], elbowL: [-0.1, 0, 0] },
};

/* =====================================================================
   공격 도우미
   ===================================================================== */
const handL = (f) => f.model.J.handL.getWorldPosition(new V3());
const staffTip = (f) => f.model.tipPos(new V3());
function shard(f, o, G, from, dir, { dmg = 28, speed = 15, homing = 0.6, r = 0.28, st = SLOW() } = {}) {
  G.spawn(new Projectile(G, { owner: f, pos: from.clone().addScaledVector(dir, 0.3), vel: dir.clone().multiplyScalar(speed), r, color: ICE, homing, life: 2.6, hit: { dmg, kb: [3, 2], stun: 0.4, hs: 0.05, noCrit: true, st } }));
}
const aimDir = (from, o, spread = 0) => { const d = o.chest(new V3()).sub(from).normalize(); if (spread) d.applyAxisAngle(UP, spread); return d; };
const frostBurst = (G, p, n = 30, sp = 7) => { G.fx.burst(p, n, [ICE, ICE2], sp); G.fx.burst(p, 6, 0xbfeaff, 2, { kind: 'glow', sk: 0.8 }); };
// 순간이동: 상대 반대편 멀리 (장애물 · 경기장 밖은 피한다)
function blinkAway(f, o, G) {
  const W = G.stage && G.stage.world, from = f.pos.clone(); let best = null, bs = -1;
  for (let i = 0; i < 10; i++) {
    const a = (o ? Math.atan2(f.pos.x - o.pos.x, f.pos.z - o.pos.z) : rand(0, TAU)) + rand(-1.3, 1.3), R = rand(8, 11);
    const p = clampArena(new V3((o ? o.pos.x : f.pos.x) + Math.sin(a) * R, 0, (o ? o.pos.z : f.pos.z) + Math.cos(a) * R), 2.5);
    if (W) W.push(p, 0.7); const d = o ? Math.hypot(p.x - o.pos.x, p.z - o.pos.z) : 9, sc = d - (Math.hypot(p.x, p.z) > ARENA_R - 4 ? 3 : 0);
    if (sc > bs) { bs = sc; best = p; }
  }
  frostBurst(G, from.clone().setY(1.2 * f.scale), 40, 8); for (let i = 0; i <= 10; i++) G.fx.p(from.clone().lerp(best, i / 10).setY(1.2 * f.scale), { size: 0.7, size1: 0.1, life: 0.35, color: ICE, alpha: 0.6 });
  f.pos.copy(best); f.vel.set(0, 0, 0); f.faceOpp(); f.inv = Math.max(f.inv, 0.25); f.hasW = false; if (f.model.resetCloth) f.model.resetCloth();
  frostBurst(G, best.clone().setY(1.2 * f.scale), 34, 6); G.fx.ring(best.clone().setY(0.05), { normal: UP, r0: 2.5, r1: 0.3, life: 0.35, color: ICE }); sfx('dash');
}
// 얼음 벽 한 조각: 실제 장애물(콜라이더)로 막고, 시간이 지나면 부서진다
function iceWall(G, f, x, z, yaw, life) {
  const W = G.stage && G.stage.world, me = new THREE.Mesh(GEO().wall, iceSolid()); me.position.set(x, -1.6, z); me.rotation.y = yaw; me.castShadow = true; G.scene.add(me);
  const col = { t: 'b', x, z, hw: 1.5, hd: 0.36, c: Math.cos(yaw), s: Math.sin(yaw), y0: 0, top: 2.3 }; let t = 0, added = false;
  return { done: false, owner: f, update(dt) {
    t += dt; me.position.y = Math.min(0, -1.6 + t * 9);
    if (!added && t > 0.12 && W) { W.colliders.push(col); added = true; }
    if (t > life - 0.4) { me.scale.y = Math.max(0.05, (life - t) / 0.4); me.material.opacity = 0.88; }
    if (t >= life) { frostBurst(G, new V3(x, 1, z), 26, 6); sfx('hit'); this.kill(); }
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(me); if (added && W) { const i = W.colliders.indexOf(col); if (i >= 0) W.colliders.splice(i, 1); } } };
}
// 점이 회전 직사각형(중심 x,z · 반폭 hw, hd · yaw) 안인가
const inRect = (p, x, z, yaw, hw, hd, pad = 0.35) => { const dx = p.x - x, dz = p.z - z, c = Math.cos(yaw), s = Math.sin(yaw), lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < hw + pad && Math.abs(lz) < hd + pad; };

/* =====================================================================
   기술
   ===================================================================== */
export const moves = {
  // 서리 화살: 왼손으로 얼음 조각 셋을 부채꼴로 (기본 · 노랑)
  light1: { dur: 0.95, next: 'light2', cancel: 0.7, aim: true, track: 0.42, tele: [0.12, 'yellow'], keys: [[0, 'base'], [0.38, P.castL], [0.52, P.castL2], [0.95, 'base']],
    ev: [[0.15, () => sfx('charge')], [0.5, (f, o, G) => { if (!o) return; const h = handL(f); for (const a of [-0.24, 0, 0.24]) shard(f, o, G, h, aimDir(h, o, a), { dmg: 26 }); sfx('shot'); frostBurst(G, h, 14, 4); }]] },
  // 빙창: 지팡이 끝에서 굵은 얼음창 한 발
  light2: { dur: 1.1, aim: true, track: 0.5, keys: [[0, P.castL2], [0.45, { ...P.aim, chest: [0, 0.2, 0] }], [0.6, P.aim], [1.1, 'base']],
    ev: [[0.58, (f, o, G) => { if (!o) return; const h = staffTip(f); shard(f, o, G, h, aimDir(h, o), { dmg: 46, speed: 20, homing: 0.35, r: 0.42, st: SLOW(2.5, 0.5) }); sfx('zap'); frostBurst(G, h, 20, 6); }]] },
  // 빙결 휘두르기: 붙으면 지팡이를 크게 휘두른다 (노랑 · 패리 가능)
  heavy: { dur: 1.05, aim: true, track: 0.4, trail: true, tele: [0.12, 'yellow'], keys: [[0, 'base'], [0.42, P.swingA], [0.62, P.swingB], [1.05, 'base']], lunge: [[0.44, 0.58, 4]],
    ev: [[0.46, (f, o, G) => { sfx('swing'); f.slashFx({ tilt: 0.1, r: 1.5 * f.scale, at: [0, 1.0 * f.scale, 0.4], color: ICE }); }]],
    hits: [{ t0: 0.46, t1: 0.62, at: [0, 1.0, 1.0], r: 1.15, dmg: 62, kb: [6, 3], stun: 0.5, hs: 0.08, noCrit: true, weapon: false, st: SLOW(2.5, 0.5) }] },
  // 서리 폭발 + 순간이동: 다가온 상대를 얼리고 멀리 물러난다
  nova: { dur: 1.0, cd: 'nova', aim: true, track: 0.3, tele: [0.08, 'yellow'], keys: [[0, 'base'], [0.36, P.slam], [0.55, P.slam], [0.62, 'base'], [1.0, 'base']], noMove: true,
    ev: [[0.42, (f, o, G) => { const c = f.pos.clone().setY(0.06); sfx('boom'); G.shake(0.2); G.fx.ring(c, { normal: UP, r0: 0.4, r1: 3.6, life: 0.45, color: ICE }); G.fx.ring(c, { normal: UP, r0: 0.2, r1: 2.6, life: 0.35, color: ICE2 }); frostBurst(G, c.clone().setY(0.6), 40, 9);
      areaHit(f, c, 3.2, { dmg: 48, kb: [8, 4], stun: 0.5, hs: 0.08, noCrit: true, st: SLOW(2.5, 0.45) }, 1.5); }], [0.58, (f, o, G) => blinkAway(f, o, G)]] },
  // 빙벽: 상대와 자신 사이에 얼음 벽을 세운다 (솟는 자리 빨강 · 2페이즈는 상대 양옆도 막는다)
  wall: { dur: 1.35, cd: 'wall', aim: true, track: 0.3, tele: [0.12, 'red'], noMove: true, keys: [[0, 'base'], [0.4, P.raise], [0.85, P.slam], [1.35, 'base']],
    ev: [[0.3, (f, o, G) => { if (!o) return; const d = Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z), yaw = f.yawTo(o.pos), segs = [], k = Math.min(0.55, Math.max(0.35, 2.6 / d));
        const cx = f.pos.x + (o.pos.x - f.pos.x) * k, cz = f.pos.z + (o.pos.z - f.pos.z) * k, px = Math.cos(yaw), pz = -Math.sin(yaw);
        for (const s of [-1, 0, 1]) segs.push([cx + px * s * 2.9 - Math.sin(yaw) * Math.abs(s) * 0.7, cz + pz * s * 2.9 - Math.cos(yaw) * Math.abs(s) * 0.7, yaw + Math.PI / 2 - s * 0.35]);
        if (f.enraged) for (const s of [-1, 1]) segs.push([o.pos.x + px * s * 2.4, o.pos.z + pz * s * 2.4, yaw]);
        f._walls = segs; for (const [x, z, y] of segs) G.spawn(decal(G, f, { kind: 'sq', x, z, yaw: y, sx: 3.2, sz: 0.9, life: 0.68, op: 0.5, pulse: true })); sfx('charge'); }],
      [0.98, (f, o, G) => { if (!f._walls) return; sfx('boom'); G.shake(0.25); let hitO = false;
        for (const [x, z, y] of f._walls) { G.spawn(iceWall(G, f, x, z, y, f.enraged ? 6.5 : 7.5)); frostBurst(G, new V3(x, 0.6, z), 30, 8); G.fx.burst(new V3(x, 0.2, z), 12, 0xd8eaf4, 4, { kind: 'dust', sk: 1.2 });
          if (o && !hitO && inRect(o.pos, x, z, y, 1.5, 0.36)) { hitO = true; o.takeHit(f, { dmg: 60, kb: [4, 9], stun: 0.6, hs: 0.08, unblock: true, noCrit: true, st: SLOW() }, new V3(o.pos.x - x, 0, o.pos.z - z).normalize()); } }
        f._walls = null; }]] },
  // 빙결 광선: 빨간 예고선 뒤 지팡이 광선이 경기장을 부채꼴로 쓸어낸다 (2페이즈: 반대로 도는 두 번째 광선)
  beam: { dur: 3.05, cd: 'beam', aim: true, track: 0.15, tele: [0.15, 'red'], noMove: true, keys: [[0, 'base'], [0.5, P.raise], [0.95, P.aim], [2.6, P.aim], [3.05, 'base']],
    start: (f, o) => { const y0 = o ? f.yawTo(o.pos) : f.yaw, sd = Math.random() < 0.5 ? 1 : -1, sw = 1.0; f._bm = { a0: y0 - sd * sw, a1: y0 + sd * sw, hitT: 0, hitT2: 0, meshes: [], lanes: false }; },
    tick: (f, o, G, t, dt) => { const B = f._bm; if (!B) return; const R = 17, h0 = 1.15 * f.scale;
      if (!B.lanes && t > 0.2) { B.lanes = true; G.spawn(lane(G, f, f.pos.x, f.pos.z, B.a0, R, 0.9, 0.8)); if (f.enraged) G.spawn(lane(G, f, f.pos.x, f.pos.z, B.a1, R, 0.9, 0.8)); }
      if (t < 1.0) { f.yaw = B.a0; if (t > 0.5 && Math.random() < 0.6) G.fx.p(staffTip(f), { size: 0.6, size1: 0.1, life: 0.2, color: ICE, alpha: 0.9 }); return; }
      const k = Math.min(1, (t - 1.0) / 1.5), e = k * k * (3 - 2 * k), dirs = [angLerp(B.a0, B.a1, e)]; if (f.enraged) dirs.push(angLerp(B.a1, B.a0, e)); f.yaw = dirs[0];
      if (!B.meshes.length) { sfx('zap'); G.shake(0.15); for (let i = 0; i < dirs.length; i++) { const me = new THREE.Mesh(GEO().cyl, addMat(ICE, 0.75)), core = new THREE.Mesh(GEO().cyl, addMat(0xffffff, 0.9)); me.add(core); core.scale.set(0.4, 0.4, 1); me.renderOrder = 7; G.scene.add(me); B.meshes.push(me); } }
      const on = t < 2.55; B.meshes.forEach((me, i) => { me.visible = on; if (!on) return; const a = dirs[i], from = new V3(f.pos.x + Math.sin(a) * 0.8, h0, f.pos.z + Math.cos(a) * 0.8), W = G.stage && G.stage.world;
        me.position.copy(from); me.rotation.set(0, a, 0); const w = 0.35 + 0.06 * Math.sin(t * 50); me.scale.set(w, w, R);
        if (Math.random() < 0.7) { const p = from.clone().add(new V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(rand(1, R))); G.fx.p(p, { vel: [rand(-1, 1), rand(0, 2), rand(-1, 1)], size: 0.25, size1: 0.05, life: 0.4, color: Math.random() < 0.5 ? ICE : ICE2, alpha: 0.9 }); }
        const end = from.clone().add(new V3(Math.sin(a) * R, 0, Math.cos(a) * R)), key = i ? 'hitT2' : 'hitT'; B[key] -= dt;
        for (const t2 of f.foes()) if (B[key] <= 0 && t2.hurtHitSeg(from, end, 0.42)) { B[key] = 0.4; t2.takeHit(f, { dmg: 30, kb: [2.5, 0], stun: 0.35, hs: 0.04, unblock: true, noCrit: true, st: SLOW(2.5, 0.5) }, new V3(Math.cos(a), 0, -Math.sin(a))); } });
      if (on && Math.random() < 0.5) G.fx.light(f.chest(new V3()), ICE, 30, 0.1);
    },
    end: (f, o, G) => { const B = f._bm; if (B) for (const me of B.meshes) { G.scene.remove(me); me.material.dispose(); me.children[0].material.dispose(); } f._bm = null; } },
  // 빙창 지열: 지팡이로 땅을 찍으면 얼음 가시가 줄지어 솟으며 뻗어간다 (빨강 · 점프로 넘을 수 있다)
  spikes: { dur: 1.6, cd: 'spikes', aim: true, track: 0.45, tele: [0.12, 'red'], noMove: true, keys: [[0, 'base'], [0.42, P.raise], [0.6, P.slam], [1.6, 'base']],
    ev: [[0.6, (f, o, G) => { sfx('boom'); G.shake(0.2); const n = f.enraged ? 5 : 3, base = f.yaw;
      for (let l = 0; l < n; l++) G.spawn(spikeLine(G, f, base + (l - (n - 1) / 2) * (f.enraged ? 0.32 : 0.38))); }]] },
  // 눈보라 (2페이즈): 경기장 전체가 느려지고, 상대 머리 위로 고드름이 쏟아진다
  blizzard: { dur: 1.6, cd: 'blizzard', aim: true, track: 0.3, tele: [0.15, 'red'], noMove: true, keys: [[0, 'base'], [0.5, P.spread], [1.2, P.spread], [1.6, 'base']],
    ev: [[0.2, () => sfx('charge')], [0.8, (f, o, G) => { G.spawn(blizzard(G, f, 11)); G.flash(0xd8f4ff, 0.3); sfx('teleRed'); }]] },
  // 빙각 (2페이즈): 얼음 껍질 속에서 회복하며 파편을 뿌린다. 껍질을 깨면 끌려 나와 무력화, 못 깨면 폭발
  shell: { dur: 7.3, cd: 'shell', aim: true, track: 0.2, noMove: true, keys: [[0, 'base'], [0.5, P.pray], [7.0, P.pray], [7.3, 'base']],
    start: (f) => { f._sh = { hp: 540, max: 540, broken: null, shotT: 1.2, boom: false, tel: false }; },
    onHit: (f, att, h) => { const S = f._sh; if (!S || S.broken || f.at < 0.45) return null; S.hp -= (h.dmg || 0) * (att.dmgMul || 1); f.G.fx.burst(f.chest(new V3()), 10, [ICE, ICE2], 6); sfx('block'); if (S.hp <= 0) S.broken = att; return { dmgK: 0.08, armor: true }; },
    tick: (f, o, G, t, dt) => { const S = f._sh, m = f.model; if (!S) return;
      if (t > 0.3) { m.shell.visible = true; m.shell.scale.setScalar(Math.min(1, (t - 0.3) / 0.25)); m.lift = Math.min(0.4, (t - 0.3) * 0.8); const k = Math.max(0, S.hp / S.max); m.shell.children[0].material.opacity = 0.35 + 0.35 * k; }
      if (S.broken) { const att = S.broken; f._sh = null; m.shell.visible = false; m.lift = 0; frostBurst(G, f.chest(new V3()), 70, 12); G.fx.ring(f.chest(new V3()), { r0: 0.4, r1: 4, life: 0.4, color: ICE, billboard: true }); G.shake(0.35); sfx('brk'); G.hud && G.hud.pop && G.hud.pop('빙각 파괴!', 'cyan');
        f.vel.set(0, 0, 0); f.breakStart(att); return; }
      if (t > 0.5) { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.01 * dt); S.shotT -= dt;
        if (S.shotT <= 0 && t < 5.8) { S.shotT = 1.3; const c = f.chest(new V3()); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t; shard(f, o, G, c, new V3(Math.sin(a), 0, Math.cos(a)), { dmg: 24, speed: 11, homing: 0.15 }); } sfx('shot'); } }
      if (!S.tel && t > 5.9) { S.tel = true; G.telegraph(f, 'red'); G.spawn(decal(G, f, { kind: 'disc', x: f.pos.x, z: f.pos.z, r: 5.2, life: 0.85, op: 0.35, pulse: true })); }
      if (!S.boom && t > 6.75) { S.boom = true; m.shell.visible = false; m.lift = 0; const c = f.pos.clone().setY(0.06); sfx('boom'); G.shake(0.45); G.flash(0xd8f4ff, 0.3); G.fx.ring(c, { normal: UP, r0: 0.5, r1: 6, life: 0.55, color: ICE }); frostBurst(G, c.clone().setY(1.2), 80, 13);
        areaHit(f, c, 5.2, { dmg: 85, kb: [10, 6], stun: 0.6, hs: 0.1, unblock: true, noCrit: true, st: SLOW(3, 0.45) }, 2); f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.04); f._sh = null; } },
    end: (f) => { f._sh = null; f.model.shell.visible = false; f.model.lift = 0; } },
};
// 빙창 한 줄: 경고 고리가 먼저 지나가고, 0.45초 뒤 가시가 차례로 솟는다
function spikeLine(G, f, yaw) {
  const x0 = f.pos.x, z0 = f.pos.z, sx = Math.sin(yaw), sz = Math.cos(yaw), N = 17, gap = 0.9, warn = 0.45, step = 0.07; let t = 0, hit = false; const sp = [];
  for (let i = 0; i < N; i++) { const d = 1.3 + i * gap, p = new V3(x0 + sx * d, 0, z0 + sz * d); if (Math.hypot(p.x, p.z) > ARENA_R - 0.5) break; sp.push({ p, t: warn + i * step, up: false, me: null }); }
  for (const s of sp) G.spawn(decal(G, f, { kind: 'ring', x: s.p.x, z: s.p.z, r: 0.75, life: warn + 0.05, delay: s.t - warn, op: 0.7, color: 0xff3a4a }));
  return { done: false, owner: f, update(dt) { t += dt;
    for (const s of sp) {
      if (!s.up && t >= s.t) { s.up = true; s.me = new THREE.Mesh(GEO().spike, iceSolid()); s.me.position.copy(s.p); s.me.rotation.set(rand(-0.25, 0.25), rand(0, TAU), rand(-0.25, 0.25)); s.me.scale.set(1, 0.01, 1); G.scene.add(s.me); s.k = 0;
        G.fx.burst(s.p.clone().setY(0.3), 10, [ICE, ICE2], 6, { dir: UP, spread: 0.6 }); if (Math.random() < 0.3) sfx('hit');
        if (!hit && areaHit(f, s.p, 0.8, { dmg: 55, kb: [2, 8], stun: 0.5, hs: 0.07, unblock: true, noCrit: true, st: SLOW() }, 0.55)) hit = true; }
      if (s.me) { s.k += dt; const k = s.k < 0.12 ? s.k / 0.12 : s.k > 0.9 ? Math.max(0, 1 - (s.k - 0.9) / 0.3) : 1; s.me.scale.set(0.9 + 0.3 * k, 1.5 * k + 0.01, 0.9 + 0.3 * k); }
    }
    if (t > sp.length * step + warn + 1.3) this.kill(); },
  kill() { if (this.done) return; this.done = true; for (const s of sp) if (s.me) G.scene.remove(s.me); } };
}
// 눈보라: 둔화 + 떨어지는 고드름 (주인이 쓰러지면 그친다)
function blizzard(G, f, life) {
  if (f._bliz && !f._bliz.done) f._bliz.kill(); let t = 0, drop = 0.6;
  const e = { done: false, owner: f, update(dt) { t += dt; const o = f.opp;
    if (t > life || f.state === 'ko' || f.gone) return this.kill();
    if (o && o.state !== 'ko') { o.addStatus('slow', 0.3, 0.72, f);
      for (let i = 0; i < 4; i++) G.fx.p(new V3(o.pos.x + rand(-9, 9), rand(0.5, 7), o.pos.z + rand(-9, 9)), { vel: [rand(4, 8), rand(-3, -1), rand(-1, 2)], size: rand(0.06, 0.14), size1: 0.04, life: 1.0, color: 0xf2faff, alpha: 0.85, drag: 0 });
      drop -= dt; if (drop <= 0) { drop = rand(0.5, 0.75); const a = rand(0, TAU), r = Math.random() < 0.35 ? 0 : rand(1.2, 4), x = o.pos.x + Math.cos(a) * r + o.vel.x * 0.5, z = o.pos.z + Math.sin(a) * r + o.vel.z * 0.5;
        G.spawn(pillar(G, f, x, z, 0, { color: ICE, color2: ICE2, style: 'fall', dmg: 55, r: 1.3, st: SLOW(2, 0.55), warn: 1.0 })); } }
    if (Math.random() < dt * 2) G.setTint(0x9ad8ff, 0.22, 0.6);
  }, kill() { this.done = true; } };
  f._bliz = e; return e;
}

/* =====================================================================
   AI: 거리를 벌리며 싸운다 — 붙으면 폭발 + 순간이동, 멀면 광선 · 가시 · 벽
   ===================================================================== */
export const ai = { range: 15, keep: 6.5, cdMin: 0.75, cdMax: 1.6, chain: 0.6,
  pick: (f, o, d) => {
    const R = (k) => (f.cd[k] || 0) <= 0, r = Math.random();
    if (f.enraged) {
      if (R('shell') && f.hp < f.maxHp * 0.45 && r < 0.5) return 'shell';
      if (R('blizzard') && r < 0.6) return 'blizzard';
    }
    if (d < 3.4 && R('nova')) return 'nova';
    if (d < 2.6) return 'heavy';
    if (d > 6 && R('wall') && r < 0.35) return 'wall';
    if (d > 4.5 && R('beam') && r < 0.45) return 'beam';
    if (d > 3 && R('spikes') && r < 0.55) return 'spikes';
    if (d < 16) return 'light';
    return R('beam') ? 'beam' : null;
  } };
export const skills = { s1: { name: '빙결 광선', cd: 1 }, s2: { name: '빙벽', cd: 1 }, ult: { name: '-', sub: '' },
  nova: { name: '서리 폭발', cd: 5.5 }, wall: { name: '빙벽', cd: 13 }, beam: { name: '빙결 광선', cd: 9 }, spikes: { name: '빙창 지열', cd: 6.5 }, blizzard: { name: '눈보라', cd: 22 }, shell: { name: '빙각', cd: 26 } };
export const createModel = (p, o) => buildIceQueen(p, o);

// 궤도 성역 보스가 함께 쓰는 도우미
export { lane, addMat, GEO, clampArena, inRect, LEGS };
