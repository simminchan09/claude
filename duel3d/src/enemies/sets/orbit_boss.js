// 성좌의 심판자 아스트라 — 천체의 심판자 (보스 기술 · 자세 · AI)
//   중력정이 상대를 끌어당기고, 별자리 격자로 별이 떨어지며(안전한 칸을 찾아 움직여야 한다), 몸 둘레로 광선 고리가 돈다.
//   쌍둥이 성좌: 상대를 사이에 두고 반대편에 거울상이 나타나 모든 공격을 동시에 따라 한다.
//   2페이즈: 시간 정지장(장 안에서 크게 느려짐) → 긴 빨간 예고 뒤 '심판' 돌진.
import * as THREE from 'three';
import { areaHit } from '../../entities.js';
import { rand, sfx } from '../../core.js';
import { ARENA_R } from '../../stage.js';
import { JOINTS } from '../../rig.js';
import { decal, lane, addMat, clampArena, inRect, LEGS } from './snow_boss.js';
import { buildJudge, JST } from './orbit_model.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const GOLD = 0xffe08a, STARC = 0xfff4d0, VIOL = 0xb08aff, BLUE = 0x9ab8ff, SL = ['slow', 2, 0.65];
const burst = (G, p, n = 30, sp = 7, cols = [GOLD, STARC]) => { G.fx.burst(p, n, cols, sp); G.fx.burst(p, 5, cols[0], 2, { kind: 'glow', sk: 0.8 }); };
const H = (o) => ({ noCrit: true, weapon: false, ...o });

/* =====================================================================
   자세 (홀은 몸 기준 방향 — model.rigHook)
   ===================================================================== */
export const poses = {
  base: { hips: [0, 0, 0], spine: [0.0, 0, 0], chest: [-0.06, 0, 0], head: [0.04, 0, 0],
    shoulderR: [-0.35, 0, -0.2], elbowR: [-1.1, 0, 0], weapon: [1.52, 0, 0.0], shoulderL: [-0.15, 0, 0.42], elbowL: [-1.3, 0.4, 0], handL: [0.3, 0, 0.5], ...LEGS },
  run: { spine: [0.2, 0, 0], shoulderR: [0.1, 0, -0.3], elbowR: [-0.9, 0, 0], weapon: [0.5, 0, 0], shoulderL: [0.35, 0, 0.4], elbowL: [-0.4, 0, 0] },
  jump: { spine: [-0.1, 0, 0], shoulderL: [-0.6, 0, 0.7], shoulderR: [-0.6, 0, -0.5] },
  guard: { chest: [0.05, -0.3, 0], shoulderR: [-1.3, 0, 0.4], elbowR: [-1.0, 0, 0], weapon: [1.3, 0.8, 0.5], shoulderL: [-1.2, 0, -0.1], elbowL: [-1.4, 0, 0] },
  hit: { spine: [-0.3, 0, 0], chest: [-0.2, 0.2, 0], head: [-0.3, 0, 0], shoulderR: [0.3, 0, -0.5], shoulderL: [0.3, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.4, 0, 0], spine: [-0.3, 0, 0], head: [-0.4, 0, 0], shoulderR: [0.5, 0, -0.9], shoulderL: [0.5, 0, 0.9] },
  down: { hipY: -0.76, hips: [-1.52, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0] },
  dash: { spine: [0.4, 0, 0], shoulderR: [0.6, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [0.2, 0, 0], shoulderL: [0.7, 0, 0.4] },
  win: { chest: [-0.15, 0, 0], head: [-0.15, 0, 0], shoulderR: [-2.6, 0, -0.2], elbowR: [-0.3, 0, 0], weapon: [1.7, 0, 0], shoulderL: [-0.4, 0, 0.6], elbowL: [-0.6, 0, 0] },
  portrait: { chest: [0, -0.3, 0], head: [0.05, 0.25, 0], shoulderR: [-1.4, 0, -0.3], elbowR: [-1.2, 0, 0], weapon: [1.5, 0.3, 0] },
  crouch: { spine: [0.3, 0, 0], ...LEGS },
};
const P = {
  thrustA: { chest: [0, 0.5, 0], spine: [-0.05, 0.2, 0], shoulderR: [-1.0, 0, -0.4], elbowR: [-1.6, 0, 0], weapon: [0.05, 0, 0] },
  thrustB: { chest: [0.1, -0.35, 0], spine: [0.15, -0.15, 0], shoulderR: [-1.5, 0, 0.05], elbowR: [-0.05, 0, 0], weapon: [0.0, 0, 0] },
  sweepA: { chest: [0, 1.0, 0], spine: [0.05, 0.3, 0], shoulderR: [-1.3, 0, -1.0], elbowR: [-0.3, 0, 0], weapon: [0.15, 1.2, 0] },
  sweepB: { chest: [0.1, -1.0, 0], spine: [0.1, -0.3, 0], shoulderR: [-1.3, 0, 0.6], elbowR: [-0.2, 0, 0], weapon: [0.15, -1.2, 0] },
  raise: { spine: [-0.15, 0, 0], chest: [-0.15, 0, 0], head: [-0.25, 0, 0], shoulderR: [-2.9, 0, -0.15], elbowR: [-0.2, 0, 0], weapon: [1.75, 0, 0], shoulderL: [-0.6, 0, 0.9], elbowL: [-0.4, 0, 0] },
  smash: { spine: [0.5, 0, 0], chest: [0.2, 0, 0], head: [-0.2, 0, 0], shoulderR: [-1.2, 0, -0.05], elbowR: [-0.1, 0, 0], weapon: [-0.5, 0, 0], shoulderL: [-0.2, 0, 0.7] },
  palm: { chest: [-0.05, 0.3, 0], shoulderL: [-1.6, 0, 0.1], elbowL: [-0.1, 0, 0], handL: [0.6, 0, 0], shoulderR: [-0.3, 0, -0.3] },
  spread: { spine: [-0.25, 0, 0], chest: [-0.2, 0, 0], head: [-0.3, 0, 0], shoulderR: [-1.1, 0, -1.3], elbowR: [-0.1, 0, 0], weapon: [1.3, 0, 0], shoulderL: [-1.1, 0, 1.3], elbowL: [-0.1, 0, 0] },
  lance: { spine: [0.35, 0, 0], chest: [0.1, 0, 0], head: [-0.3, 0, 0], shoulderR: [-1.55, 0, 0], elbowR: [0, 0, 0], weapon: [0.0, 0, 0], shoulderL: [0.6, 0, 0.5], elbowL: [-0.3, 0, 0] },
};
const tip = (f) => f.model.tipPos(new V3());

/* =====================================================================
   패턴 엔티티
   ===================================================================== */
// 중력정: 상대를 끌어당기고 중심은 계속 아프다. 끝에 붕괴(빨간 원 예고 → 폭발)
function gravityWell(G, f, x, z, life = 4.8) {
  let t = 0, tickT = 0, warned = false; const R = 6.5, c = new V3(x, 0.05, z);
  const disc = decal(G, f, { kind: 'disc', x, z, r: 1.4, life, color: 0x5a2aff, op: 0.55, tick: (me) => me.scale.setScalar(1.3 + 0.15 * Math.sin(t * 8)) });
  const ring = decal(G, f, { kind: 'ring', x, z, r: R, life, color: VIOL, op: 0.35, tick: (me) => { me.rotation.z = -t * 2; me.scale.setScalar(R * (1 - (t % 1) * 0.6)); } });
  G.spawn(disc); G.spawn(ring); sfx('charge');
  return { done: false, owner: f, update(dt) {
    t += dt; tickT -= dt; const o = f.opp;
    for (let i = 0; i < 3; i++) { const a = rand(0, TAU), r = rand(2, R); G.fx.p(new V3(x + Math.cos(a) * r, rand(0.1, 1.5), z + Math.sin(a) * r), { vel: [-Math.cos(a) * r * 1.2, 0, -Math.sin(a) * r * 1.2], size: 0.1, size1: 0.02, life: 0.6, color: Math.random() < 0.5 ? VIOL : STARC, alpha: 0.9, drag: 0 }); }
    if (o && o.state !== 'ko' && !o.held && t < life - 0.15) { const dx = x - o.pos.x, dz = z - o.pos.z, d = Math.hypot(dx, dz);
      if (d < R && d > 0.25) { const sp = 1.2 + 3.0 * (1 - d / R); o.pos.x += dx / d * sp * dt; o.pos.z += dz / d * sp * dt; }
      if (d < 1.4 && tickT <= 0) { tickT = 0.5; o.takeHit(f, { dmg: 10, kb: [0, 0], stun: 0.15, hs: 0.02, unblock: true, noCrit: true, noScale: true }, new V3(-dx, 0, -dz).normalize()); } }
    if (!warned && t > life - 0.9) { warned = true; G.spawn(decal(G, f, { kind: 'disc', x, z, r: 2.7, life: 0.9, op: 0.45, pulse: true })); G.fx.ring(c, { normal: UP, r0: 2.8, r1: 0.2, life: 0.9, color: 0xff2a3a }); }
    if (t >= life) { sfx('boom'); G.shake(0.3); G.fx.ring(c, { normal: UP, r0: 0.2, r1: 3.6, life: 0.45, color: VIOL }); burst(G, c.clone().setY(0.8), 50, 11, [VIOL, STARC]); G.fx.light(c.clone().setY(1), VIOL, 90, 0.35);
      areaHit(f, c, 2.7, { dmg: 75, kb: [9, 6], stun: 0.6, hs: 0.1, unblock: true, noCrit: true }, 2); this.kill(); }
  }, kill() { this.done = true; disc.kill(); ring.kill(); } };
}
// 성좌 낙성: 상대 둘레 격자 — 별자리 무늬 칸에 별이 떨어지고(빨간 칸), 이어서 나머지 칸이 떨어진다
const PATTERNS = [(i, j) => (i + j) % 2 === 0, (i, j) => i % 2 === 0, (i, j) => j % 2 === 0, (i, j, c) => Math.max(Math.abs(i - c), Math.abs(j - c)) % 2 === 1, (i, j, c) => i !== c && j !== c];
function starGrid(G, f, o, enr) {
  const N = 7, S = 2.6, c = (N - 1) / 2, cx = Math.round(o.pos.x / S) * S, cz = Math.round(o.pos.z / S) * S, pat = PATTERNS[(Math.random() * PATTERNS.length) | 0], warn = enr ? 1.15 : 1.35;
  const cells = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = cx + (i - c) * S, z = cz + (j - c) * S; if (Math.hypot(x, z) < ARENA_R - 0.5) cells.push({ i, j, x, z, w: pat(i, j, c) ? 0 : 1 }); }
  const waves = [0, 1].map((w) => ({ t0: w * (warn + 0.35), cells: cells.filter((q) => q.w === w), on: false, hit: false }));
  let t = 0; sfx('teleRed');
  return { done: false, owner: f, update(dt) {
    t += dt;
    for (const W of waves) {
      if (!W.on && t >= W.t0) { W.on = true;
        for (const q of W.cells) G.spawn(decal(G, f, { kind: 'sq', x: q.x, z: q.z, sx: S * 0.94, sz: S * 0.94, life: warn, op: 0.32, pulse: true }));
        // 별자리 선: 떨어질 칸들 중 이웃끼리 잇는다
        const set = new Map(W.cells.map((q) => [q.i * 10 + q.j, q]));
        for (const q of W.cells) for (const [di, dj] of [[1, 1], [1, -1], [2, 0], [0, 2], [1, 0], [0, 1]]) { const n = set.get((q.i + di) * 10 + q.j + dj); if (n && Math.random() < 0.35) { const yaw = Math.atan2(n.x - q.x, n.z - q.z), L = Math.hypot(n.x - q.x, n.z - q.z); G.spawn(lane(G, f, q.x, q.z, yaw, L, 0.07, warn, GOLD)); } } }
      if (W.on && !W.boom && t >= W.t0 + warn) { W.boom = true; sfx('boom'); G.shake(0.25); const o2 = f.opp;
        for (const q of W.cells) { const p = new V3(q.x, 0.4, q.z); if (Math.random() < 0.5) G.fx.burst(p, 10, [GOLD, STARC], 8, { dir: UP, spread: 0.9 }); G.fx.p(new V3(q.x, 6, q.z), { vel: [0, -40, 0], size: 1.2, size1: 0.3, life: 0.15, color: STARC, alpha: 1 }); }
        G.fx.light(new V3(cx, 2, cz), GOLD, 120, 0.35);
        if (o2 && !W.hit && o2.pos.y < 1.5) for (const q of W.cells) if (Math.abs(o2.pos.x - q.x) < S / 2 + 0.2 && Math.abs(o2.pos.z - q.z) < S / 2 + 0.2) { W.hit = true; o2.takeHit(f, { dmg: 70, kb: [3, 8], stun: 0.6, hs: 0.08, unblock: true, noCrit: true, st: SL }, new V3(rand(-1, 1), 0, rand(-1, 1)).normalize()); burst(G, o2.chest(new V3()), 30, 9); break; } }
    }
    if (t > waves[1].t0 + warn + 0.5) this.kill();
  }, kill() { this.done = true; } };
}
// 천궁 회전: 주인 둘레로 낮은 광선 고리가 돈다 (점프로 넘거나 도는 방향으로 달려 피함)
function beamRing(G, f, enr) {
  const n = enr ? 8 : 6, R0 = 1.2, L = 12.5, tele = 1.2, on1 = 4.2; let t = 0, a0 = rand(0, TAU), hitT = 0; const meshes = [], lanes = [];
  for (let i = 0; i < n; i++) { const me = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, L), addMat(GOLD, 0.85)); me.geometry.translate(0, 0, R0 + L / 2); const core = new THREE.Mesh(me.geometry, addMat(0xffffff, 0.9)); core.scale.set(0.4, 0.4, 1); me.add(core); me.visible = false; me.renderOrder = 7; G.scene.add(me); meshes.push(me); }
  for (let i = 0; i < n; i++) { const d = decal(G, f, { kind: 'sq', x: 0, z: 0, sx: 0.5, sz: L, life: tele, op: 0.45, pulse: true }); lanes.push(d); G.spawn(d); }
  const ang = (i) => a0 + (i / n) * TAU;
  return { done: false, owner: f, update(dt) {
    t += dt; hitT -= dt; if (f.state === 'ko' || f.gone) return this.kill();
    const w = (enr ? 1.0 : 0.75) * (enr && t > (tele + on1) / 2 ? -1 : 1); if (t > tele) a0 += w * dt;
    for (let i = 0; i < n; i++) { const a = ang(i), sx = Math.sin(a), sz = Math.cos(a);
      if (t < tele) { const me = lanes[i].mesh; me.position.set(f.pos.x + sx * (R0 + L / 2), 0.045, f.pos.z + sz * (R0 + L / 2)); me.rotation.set(-Math.PI / 2, 0, a); continue; }
      const me = meshes[i]; me.visible = t < on1; me.position.set(f.pos.x, 0.45, f.pos.z); me.rotation.set(0, a, 0); me.scale.set(1 + 0.12 * Math.sin(t * 40), 1, 1);
      if (Math.random() < 0.3) G.fx.p(new V3(f.pos.x + sx * rand(R0, R0 + L), 0.45, f.pos.z + sz * rand(R0, R0 + L)), { vel: [0, rand(0.5, 2), 0], size: 0.2, size1: 0.04, life: 0.35, color: STARC, alpha: 0.9 });
      const o = f.opp; if (o && t < on1 && hitT <= 0 && o.state !== 'ko' && o.pos.y < 0.75) { const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, along = dx * sx + dz * sz, perp = Math.abs(dx * sz - dz * sx);
        if (along > R0 - 0.3 && along < R0 + L && perp < 0.5) { hitT = 0.7; o.takeHit(f, { dmg: 45, kb: [5, 5], stun: 0.5, hs: 0.07, unblock: true, noCrit: true }, new V3(sz * Math.sign(w), 0, -sx * Math.sign(w))); } } }
    if (t > tele && !this.snd) { this.snd = true; sfx('zap'); G.shake(0.15); }
    if (t >= on1) this.kill();
  }, kill() { if (this.done) return; this.done = true; for (const me of meshes) { G.scene.remove(me); me.geometry.dispose(); me.material.dispose(); me.children[0].material.dispose(); } for (const l of lanes) l.kill(); } };
}
// 시간 정지장 (2페이즈): 상대 자리에 시계 문양 장 — 안에 있으면 크게 느려진다
function timeField(G, f, x, z, life = 7.5) {
  const R = 5; let t = 0; const hands = [];
  const base = decal(G, f, { kind: 'disc', x, z, r: R, life, color: 0x3a4aff, op: 0.2 }), rim = decal(G, f, { kind: 'ring', x, z, r: R, life, color: BLUE, op: 0.6 });
  for (let k = 0; k < 2; k++) { const L = k ? R * 0.85 : R * 0.6; hands.push(decal(G, f, { kind: 'sq', x, z, sx: 0.12, sz: L, life, color: STARC, op: 0.6, tick: (me) => { const a = t * (k ? 0.8 : 0.12) * -1; me.position.set(x + Math.sin(a) * L / 2, 0.05, z + Math.cos(a) * L / 2); me.rotation.set(-Math.PI / 2, 0, a); } })); }
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; hands.push(decal(G, f, { kind: 'disc', x: x + Math.sin(a) * R * 0.9, z: z + Math.cos(a) * R * 0.9, r: 0.14, life, color: STARC, op: 0.8 })); }
  for (const d of [base, rim, ...hands]) G.spawn(d); sfx('charge');
  return { done: false, owner: f, update(dt) { t += dt; const o = f.opp; if (t > life || f.state === 'ko') return this.kill();
    if (o && Math.hypot(o.pos.x - x, o.pos.z - z) < R) { o.addStatus('slow', 0.25, 0.4, f); if (Math.random() < 0.4) G.fx.p(o.chest(new V3()).add(new V3(rand(-0.5, 0.5), rand(-0.6, 0.6), rand(-0.5, 0.5))), { vel: [0, 0.2, 0], size: 0.12, size1: 0.02, life: 0.8, color: BLUE, alpha: 0.8 }); }
    if (Math.random() < dt * 30) { const a = rand(0, TAU); G.fx.p(new V3(x + Math.cos(a) * R, rand(0.1, 3), z + Math.sin(a) * R), { vel: [0, 0.3, 0], size: 0.12, size1: 0.03, life: 1.2, color: BLUE, alpha: 0.7, drag: 0 }); }
  }, kill() { if (this.done) return; this.done = true; for (const d of [base, rim, ...hands]) d.kill(); } };
}
// 쌍둥이 성좌: 상대를 사이에 둔 반대편 거울상. 아스트라의 동작 · 피격 판정 · 'm' 표시 이벤트를 그대로 따라 한다 (피해 60%)
function mirrorImage(G, f, life) {
  if (f._mirror && !f._mirror.done) f._mirror.kill();
  const model = buildJudge(f.palette, { ghost: true }); model.root.scale.setScalar(f.scale); G.scene.add(model.root);
  const ghost = Object.create(f); ghost.pos = new V3(); ghost.vel = new V3(); ghost.model = model; ghost.dmgMul = 0.6; ghost.combo = 0; ghost.comboT = 0; ghost.energy = 0; ghost.isMirror = true;
  const piv = f.opp ? f.opp.pos.clone() : new V3(); let t = 0, act = null, seen = 0, done = new Set(), vis = 0;
  const place = () => { ghost.pos.set(2 * piv.x - f.pos.x, f.pos.y, 2 * piv.z - f.pos.z); clampArena(ghost.pos, 1); ghost.yaw = f.yaw + Math.PI; model.root.position.copy(ghost.pos); model.root.rotation.y = ghost.yaw; };
  place(); burst(G, ghost.chest(new V3()), 50, 8, [VIOL, STARC]); G.fx.ring(ghost.pos.clone().setY(0.05), { normal: UP, r0: 0.4, r1: 3.5, life: 0.5, color: VIOL });
  const e = { done: false, owner: f, ghost, update(dt) {
    t += dt; const o = f.opp;
    if (t > life || f.state === 'ko' || f.gone || f.brokenT > 0) { if (!this.fading) { this.fading = true; this.ft = 0; burst(G, ghost.chest(new V3()), 40, 6, [VIOL, STARC]); sfx('dash'); } }
    if (this.fading) { this.ft += dt; model.root.scale.setScalar(f.scale * Math.max(0.01, 1 - this.ft * 3)); if (this.ft > 0.35) return this.kill(); }
    if (o) piv.lerp(o.pos, 1 - Math.exp(-dt * 3)); place();
    for (const j of JOINTS) model.J[j].quaternion.copy(f.model.J[j].quaternion); model.J.hips.position.copy(f.model.J.hips.position); model.body.position.y = f.model.body.position.y; model.lift = f.model.lift || 0;
    model.update(dt, null); model.root.updateMatrixWorld(true);
    vis = Math.min(1, vis + dt * 3); model.root.visible = f.root.visible;
    if (this.fading) return;
    if (f.state === 'act' && f.act) {
      const m = f.act; if (m !== act) { act = m; seen = 0; done = new Set(); while (seen < (f.evDone || 0)) seen++; }
      const ev = m.ev || []; while (seen < f.evDone) { const x = ev[seen++]; if (x && x[2] === 'm') x[1](ghost, o, G); }
      const hits = m.hits || [];
      for (let i = 0; i < hits.length; i++) { const hb = hits[i]; if (f.at < hb.t0 || f.at > hb.t1 || !hb.at) continue; const p = ghost.local(hb.at.map((v) => v * f.scale));
        for (const tg of f.foes()) { const key = i * 100000 + tg.id; if (done.has(key)) continue; if (tg.hurtHit(p, hb.r * f.scale) && tg.takeHit(ghost, hb)) done.add(key); } }
      if (Math.random() < 0.3) G.fx.p(ghost.chest(new V3()).add(new V3(rand(-0.4, 0.4), rand(-0.8, 0.8), rand(-0.4, 0.4))), { vel: [0, 1, 0], size: 0.14, size1: 0.02, life: 0.5, color: VIOL, alpha: 0.8 });
    } else act = null;
    if (Math.random() < dt * 20) G.fx.p(ghost.pos.clone().add(new V3(rand(-0.6, 0.6), rand(0.2, 2.6) * f.scale, rand(-0.6, 0.6))), { vel: [0, 0.6, 0], size: 0.1, size1: 0.02, life: 0.7, color: Math.random() < 0.5 ? VIOL : STARC, alpha: 0.8, drag: 0 });
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(model.root); if (f._mirror === e) f._mirror = null; } };
  f._mirror = e; return e;
}

/* =====================================================================
   기술 (ev 세 번째 칸 'm' = 거울상도 같은 이벤트를 따라 한다)
   ===================================================================== */
const swishF = (tilt, r = 1.6) => (f) => { sfx('swing'); f.slashFx({ tilt, r: r * f.scale, at: [0, 1.05 * f.scale, 0.5], color: GOLD }); };
export const moves = {
  // 심판의 찌르기 → 천칭 베기 → 낙인 (근접 연격 · 노랑)
  light1: { dur: 0.9, next: 'light2', cancel: 0.62, aim: true, track: 0.4, trail: true, tele: [0.1, 'yellow'], keys: [[0, 'base'], [0.38, P.thrustA], [0.5, P.thrustB], [0.9, 'base']], lunge: [[0.4, 0.52, 7]],
    ev: [[0.42, (f) => { sfx('swing'); f.slashFx({ tilt: 0, r: 0.9 * f.scale, at: [0, 1.1 * f.scale, 1.0], color: GOLD }); }, 'm']],
    hits: [H({ t0: 0.42, t1: 0.56, at: [0, 1.1, 1.5], r: 0.8, dmg: 56, kb: [4, 1], stun: 0.4, hs: 0.06 })] },
  light2: { dur: 0.95, next: 'light3', cancel: 0.65, aim: true, track: 0.25, trail: true, keys: [[0, P.thrustB], [0.3, P.sweepA], [0.48, P.sweepB], [0.95, 'base']], lunge: [[0.3, 0.45, 4]],
    ev: [[0.32, swishF(0.1), 'm']], hits: [H({ t0: 0.32, t1: 0.48, at: [0, 1.0, 1.1], r: 1.3, dmg: 60, kb: [5, 2], stun: 0.45, hs: 0.07 })] },
  light3: { dur: 1.15, aim: true, track: 0.45, trail: true, tele: [0.12, 'yellow'], keys: [[0, P.sweepB], [0.5, P.raise], [0.66, P.smash], [1.15, 'base']], lunge: [[0.5, 0.64, 6]],
    ev: [[0.66, (f, o, G) => { sfx('heavy'); const c = f.local([0, 0, 1.6 * f.scale]).setY(0.06); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 2.4, life: 0.4, color: GOLD }); burst(G, c.clone().setY(0.4), 26, 8); }, 'm']],
    hits: [H({ t0: 0.64, t1: 0.76, at: [0, 0.6, 1.5], r: 1.15, dmg: 78, kb: [6, 6], stun: 0.55, hs: 0.1 })] },
  // 천칭의 일격: 좌 · 우 접시가 내려앉고(노랑) 잠시 뒤 가운데 저울대가 늦게 떨어진다(빨강 · 지연 마지막 타)
  heavy: { dur: 1.8, cd: 'heavy', aim: true, track: 0.4, tele: [0.1, 'yellow'], noMove: true, keys: [[0, 'base'], [0.42, P.raise], [0.58, P.smash], [1.1, P.smash], [1.3, P.raise], [1.42, P.smash], [1.8, 'base']],
    ev: [[0.3, (f, o, G) => { for (const s of [-1, 1]) { const p = f.local([s * 1.7 * f.scale, 0, 1.4 * f.scale]); G.spawn(decal(G, f, { kind: 'disc', x: p.x, z: p.z, r: 1.4, life: 0.32, color: 0xffc83a, op: 0.4 })); } }, 'm'],
      [0.6, (f, o, G) => { sfx('boom'); G.shake(0.2); for (const s of [-1, 1]) { const p = f.local([s * 1.7 * f.scale, 0, 1.4 * f.scale]).setY(0.06); G.fx.ring(p, { normal: UP, r0: 0.2, r1: 1.8, life: 0.35, color: GOLD }); burst(G, p.clone().setY(0.4), 22, 7); areaHit(f, p, 1.4, { dmg: 48, kb: [5, 4], stun: 0.45, hs: 0.07, noCrit: true }, 1.4); }
        const c = f.local([0, 0, 2.3 * f.scale]); G.spawn(decal(G, f, { kind: 'disc', x: c.x, z: c.z, r: 1.7, life: 0.82, op: 0.45, pulse: true })); }, 'm'],
      [0.9, (f, o, G) => G.telegraph(f, 'red')],
      [1.44, (f, o, G) => { sfx('boom'); G.shake(0.3); const c = f.local([0, 0, 2.3 * f.scale]).setY(0.06); G.fx.beam(c, { r: 1.2, h: 10, color: GOLD, life: 0.5 }); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 2.6, life: 0.45, color: STARC }); burst(G, c.clone().setY(0.6), 40, 10);
        areaHit(f, c, 1.7, { dmg: 82, kb: [7, 8], stun: 0.6, hs: 0.1, unblock: true, noCrit: true }, 1.6); }, 'm']] },
  // 중력정: 상대 자리에 중력 우물 (2페이즈: 양옆 두 개)
  well: { dur: 1.2, cd: 'well', aim: true, track: 0.4, noMove: true, tele: [0.12, 'red'], keys: [[0, 'base'], [0.4, P.palm], [0.8, P.palm], [1.2, 'base']],
    ev: [[0.5, (f, o, G) => { if (!o) return; const pts = f.enraged ? [-1, 1].map((s) => { const r = f.right(new V3()); return [o.pos.x + r.x * s * 2.6, o.pos.z + r.z * s * 2.6]; }) : [[o.pos.x + o.vel.x * 0.3, o.pos.z + o.vel.z * 0.3]];
      for (const [x, z] of pts) { const p = clampArena(new V3(x, 0, z), 2); G.spawn(gravityWell(G, f, p.x, p.z)); } burst(G, f.model.J.handL.getWorldPosition(new V3()), 20, 5, [VIOL, STARC]); }]] },
  // 성좌 낙성: 격자 칸 두 차례 (안전한 칸으로 옮겨 다녀야 한다)
  starfall: { dur: 1.7, cd: 'starfall', aim: true, track: 0.4, noMove: true, tele: [0.15, 'red'], keys: [[0, 'base'], [0.45, P.raise], [1.3, P.raise], [1.7, 'base']],
    ev: [[0.2, () => sfx('charge')], [0.55, (f, o, G) => { if (o) G.spawn(starGrid(G, f, o, f.enraged)); G.fx.beam(tip(f), { r: 0.3, h: 12, color: GOLD, life: 0.5 }); }]] },
  // 천궁 회전: 떠올라 몸 둘레로 광선 고리를 돌린다 (빨강 예고선 → 낮은 광선 · 점프로 넘기)
  ring: { dur: 4.6, cd: 'ring', aim: true, track: 0.2, noMove: true, tele: [0.12, 'red'], keys: [[0, 'base'], [0.5, P.spread], [4.2, P.spread], [4.6, 'base']],
    ev: [[0.3, (f, o, G) => G.spawn(beamRing(G, f, f.enraged)), 'm']],
    tick: (f, o, G, t) => { f.model.lift = t < 4.2 ? Math.min(0.6, t * 1.2) : Math.max(0, 0.6 - (t - 4.2) * 1.5); },
    end: (f) => { f.model.lift = 0; } },
  // 쌍둥이 성좌: 거울상을 불러낸다
  split: { dur: 1.3, cd: 'split', aim: true, track: 0.3, noMove: true, keys: [[0, 'base'], [0.45, P.spread], [0.9, P.spread], [1.3, 'base']],
    ev: [[0.15, () => sfx('charge')], [0.7, (f, o, G) => { G.spawn(mirrorImage(G, f, f.enraged ? 13 : 10)); G.flash(0xc8b0ff, 0.25); sfx('ult'); }]] },
  // 시간 정지장 (2페이즈) — 곧바로 심판이 이어진다
  slowfield: { dur: 1.2, cd: 'slowfield', aim: true, track: 0.4, noMove: true, tele: [0.12, 'red'], keys: [[0, 'base'], [0.45, P.palm], [1.2, 'base']],
    ev: [[0.55, (f, o, G) => { if (!o) return; G.spawn(timeField(G, f, o.pos.x, o.pos.z)); f._next = 'judgement'; G.setTint(0x3a4aff, 0.25, 1.5); }]] },
  // 심판 (2페이즈): 떠올라 긴 빨간 예고 길(상대를 따라가다 고정) → 길을 따라 단숨에 돌진 (막을 수 없음)
  judgement: { dur: 3.5, cd: 'judgement', aim: true, track: 1.55, noMove: true, tele: [0.15, 'red'], keys: [[0, 'base'], [0.5, P.raise], [1.9, P.raise], [2.15, P.lance], [2.9, P.lance], [3.5, 'base']],
    lunge: [[2.2, 2.62, 32]],
    ev: [[0.2, (f, o, G) => { const L = 15; const d = lane(G, f, f.pos.x, f.pos.z, f.yaw, L, 2.6, 2.05); d.mesh.userData.f = f; G.spawn(d); const orig = d.update.bind(d), self = f;
        d.update = (dt) => { if (self.at < 1.55) { const yaw = self.yaw; d.mesh.position.set(self.pos.x + Math.sin(yaw) * L / 2, 0.045, self.pos.z + Math.cos(yaw) * L / 2); d.mesh.rotation.set(-Math.PI / 2, 0, yaw); } orig(dt); }; sfx('charge'); }, 'm'],
      [1.6, (f, o, G) => { G.telegraph(f, 'red'); }],
      [2.2, (f, o, G) => { sfx('dash'); G.shake(0.3); G.flash(0xfff0c0, 0.2); burst(G, f.chest(new V3()), 40, 9); }, 'm'],
      [2.7, (f, o, G) => { const fw = f.fwd(new V3()); for (let i = 1; i <= 5; i++) { const p = f.pos.clone().addScaledVector(fw, -i * 2.4).setY(0.5); G.fx.burst(p, 16, [GOLD, STARC], 7, { dir: UP, spread: 0.8 }); G.fx.ring(p.clone().setY(0.06), { normal: UP, r0: 0.2, r1: 1.6, life: 0.4, color: GOLD }); } sfx('boom'); }, 'm']],
    hits: [H({ t0: 2.2, t1: 2.66, at: [0, 1.0, 0.6], r: 1.4, dmg: 150, kb: [10, 7], stun: 0.7, hs: 0.14, shake: 0.3, unblock: true })],
    tick: (f, o, G, t) => { f.model.lift = t < 2.15 ? Math.min(0.55, t * 0.8) : Math.max(0, 0.55 - (t - 2.15) * 2); if (t > 2.2 && t < 2.66 && Math.random() < 0.8) G.fx.p(f.chest(new V3()), { size: 1.2, size1: 0.2, life: 0.3, color: GOLD, alpha: 0.7 }); },
    end: (f) => { f.model.lift = 0; } },
};

/* =====================================================================
   AI: 느리고 무겁게 — 패턴을 겹쳐 깔고(중력정 → 낙성), 분신과 함께 협공, 2페이즈는 정지장 → 심판
   ===================================================================== */
export const ai = { range: 11, keep: 3.4, cdMin: 1.05, cdMax: 2.0, chain: 0.75,
  pick: (f, o, d) => {
    const R = (k) => (f.cd[k] || 0) <= 0, r = Math.random();
    // 쓸 원거리 패턴이 없으면 사거리를 줄여 직접 다가가 근접 연격 (EnemyAI 는 range 밖이면 접근한다)
    ai.range = (R('starfall') || R('well') || R('ring') || R('split') || (f.enraged && (R('slowfield') || R('judgement')))) ? 11 : 3.4;
    if (f._next) { const n = f._next; if (R(n)) { f._next = null; return n; } if (!f.enraged) f._next = null; }
    if (f.enraged) { if (R('slowfield') && r < 0.4) return 'slowfield'; if (R('judgement') && d > 4 && r < 0.3) return 'judgement'; }
    if (R('split') && !f._mirror && r < 0.3) return 'split';
    if (d > 4.5 && R('starfall') && r < 0.45) { f._next = R('well') ? 'well' : null; return 'starfall'; }
    if (d > 4 && R('well') && r < 0.55) return 'well';
    if (d < 7 && R('ring') && r < 0.4) return 'ring';
    if (d < 3.6) return R('heavy') && r < 0.35 ? 'heavy' : 'light';
    return null;
  } };
export const skills = { s1: { name: '성좌 낙성', cd: 1 }, s2: { name: '중력정', cd: 1 }, ult: { name: '-', sub: '' },
  heavy: { name: '천칭의 일격', cd: 6 }, well: { name: '중력정', cd: 8 }, starfall: { name: '성좌 낙성', cd: 11 }, ring: { name: '천궁 회전', cd: 12 }, split: { name: '쌍둥이 성좌', cd: 24 }, slowfield: { name: '시간 정지장', cd: 17 }, judgement: { name: '심판', cd: 9 } };
export const createModel = (p, o) => buildJudge(p, o);
