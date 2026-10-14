// 4. 바람의 평원 — 고블린 약탈자 · 고블린 투석병 · 평원 오우거 · 폭풍 켄타우로스 갈레
// 잡몹 · 원거리 · 정예는 공용 기술(makeSet)에 새 모델을 입히고, 보스 갈레는 기병 전용 기술을 따로 쓴다.
//   갈레: 멀리서 빙빙 돌며 거리를 벌리고(keep 5) — 빨간 돌격 길 예고 뒤 경기장을 가로지르는 질주 · 되돌아오는 투창 · 떠도는 돌개바람
//         가까이 붙으면 창 연격과 앞발 짓밟기. 2페이즈: 돌격이 왕복 두 번으로 · 고블린 늑대 기마대가 경기장을 가로지른다
import * as THREE from 'three';
import { makeSet, poses as P0 } from '../kit.js';
import { areaHit } from '../../entities.js';
import { flat, applyPose } from '../../rig.js';
import { rand, sfx } from '../../core.js';
import { ARENA_R } from '../../stage.js';
import { loft, strand, spl, surf, gauss, smooth, cached } from '../../sculpt.js';
import { V3, TAU, UP, Missile, groundMark, phys, addMesh, creatureHead, cv, tex, T } from './plains_lib.js';
import { buildGoblin } from './plains_model.js';
import { buildOgre } from './plains_ogre.js';
import { buildGale, galePoses, galeRun, PI2 } from './plains_gale.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });
const P = PI2;

/* =====================================================================
   잡몹 · 원거리 · 정예
   ===================================================================== */
// 고블린 자세: 등을 굽히고 무릎을 굽힌 채 고개를 든다
const gobPoses = (() => { const o = {}; for (const k in P0) o[k] = { ...P0[k] };
  o.base = { ...P0.base, spine: [0.32, 0.15, 0], chest: [0.12, 0.12, 0], neck: [-0.2, 0, 0], head: [-0.3, 0.1, 0], hipL: [-0.55, 0, 0.12], kneeL: [0.85, 0, 0], footL: [-0.3, 0, 0], hipR: [0.15, 0, -0.14], kneeR: [0.7, 0, 0], footR: [-0.2, 0, 0], hipY: -0.06 };
  o.run = { ...P0.run, spine: [0.45, 0, 0], neck: [-0.25, 0, 0], head: [-0.35, 0, 0] };
  return o; })();

const S = makeSet({ id: 'plains',
  grunt: { name: '고블린 약탈자', short: '고블린', title: '마을 습격대', fast: true, speed: 5.2, scale: 0.72, hp: 260, col: C(0xd8ff4a, 0x4a7a2a, 0x3a2a1a, { band: '#14240a' }), model: {} },
  archer: { name: '고블린 투석병', short: '투석병', title: '언덕의 매복병', skill: '돌팔매', scale: 0.72, col: C(0xffe08a, 0x5a7a2a, 0x3a2a1a, { band: '#14240a' }), model: {}, shot: { dmg: 46, color: 0xc8b090, speed: 15, homing: 0.3, arc: 0.18 } },
  brute: { name: '평원 오우거', short: '오우거', title: '건초밭의 폭군', scale: 1.55, hp: 1000, plan: 'golem', kind: 'ogre', col: C(0xffa04a, 0x6a5a3a, 0x8a9a5a, { cloth: 0x6a4a2a, trim: 0x5a3a1a, band: '#241a0a' }), model: {}, skill: '몽둥이 내려찍기' },
  boss: { name: '폭풍 켄타우로스 갈레', short: '갈레', title: '평원을 달리는 폭풍', col: C(0x7affd0, 0x3a6a4a, 0x2a2014, { trim: 0xd8c070, cloth: 0x2a5a3a, band: '#06241a' }), model: {} },
});
S.grunt.createModel = (p) => buildGoblin(p, { kind: 'raider' }); S.grunt.poses = gobPoses;
S.archer.createModel = (p) => buildGoblin(p, { kind: 'slinger' }); S.archer.poses = gobPoses;
S.brute.createModel = (p) => buildOgre(p);
// 투석병: 둥근 구 대신 실제 돌이 포물선으로 날아간다 (투석끈 주머니에서)
const rockGeo = () => cached('plains:rock', () => { const g = new THREE.DodecahedronGeometry(0.09, 1); const ps = g.attributes.position; for (let k = 0; k < ps.count; k++) ps.setXYZ(k, ps.getX(k) * (1 + 0.18 * Math.sin(k * 2.7)), ps.getY(k) * 0.85, ps.getZ(k) * (1 + 0.1 * Math.cos(k))); g.computeVertexNormals(); return g; });
let rockMat = null;
function slingRock(f, o, G) {
  if (!o) return; const h = f.model.tipPos(new V3()), tgt = o.chest(new V3()), d = tgt.clone().sub(h), dist = Math.hypot(d.x, d.z), tof = Math.max(0.35, dist / 15), grav = 9;
  const vel = new V3(d.x / tof, d.y / tof + 0.5 * grav * tof, d.z / tof);
  rockMat = rockMat || phys({ color: 0x9a8a78, roughness: 0.8 });
  G.spawn(new Missile(G, { owner: f, pos: h, vel, mesh: new THREE.Mesh(rockGeo(), rockMat), r: 0.28, grav, spin: 14, color: 0xc8b090, scale: 1, trail: 0.4, life: 3, hit: { dmg: 46, kb: [4, 3], stun: 0.45, hs: 0.06, noCrit: true } }));
  sfx('shot');
}
S.archer.moves.s1.ev = S.archer.moves.s1.ev.map(([t]) => [t, slingRock]);

/* =====================================================================
   보스: 폭풍 켄타우로스 갈레 (기병)
   ===================================================================== */
const H = (o) => ({ noCrit: true, weapon: false, ...o });
const legs = (a = 0) => ({ hipL: [-P - 0.35 + a, 0, 0.02], kneeL: [0.75, 0, 0], footL: [-0.4, 0, 0], hipR: [-P - 0.35 + a, 0, -0.02], kneeR: [0.75, 0, 0], footR: [-0.4, 0, 0] });
const REAR = (k) => ({ hips: [P - 0.6 * k, 0, 0], ...legs(0.6 * k), neck: [-P + 0.6 * k - 0.05, 0, 0] }); // 앞발 들기: 몸을 세우고 뒷다리 · 사람 상체는 수직 유지
const COUCH = { neck: [-P + 0.3, 0, 0], head: [-0.2, 0, 0], shoulderR: [-0.15, 0, -0.35], elbowR: [-1.5, 0, 0], weapon: [0.02, 0.06, 0], shoulderL: [-0.8, 0, 0.2] };
const ACC = (f) => f.palette.accent;
const laneLen = (x, z, dx, dz, want) => { const R = ARENA_R - 1.0, b = x * dx + z * dz, c = x * x + z * z - R * R; return Math.max(5, Math.min(want, -b + Math.sqrt(Math.max(0, b * b - c)))); };
// 발굽 충격: 앞쪽에 원형 충격
function stomp(f, G, r, dmg, unblock) {
  const c = f.local([0, 0, 1.35 * f.scale]).setY(0.06), col = ACC(f); sfx('boom'); G.shake(unblock ? 0.35 : 0.2);
  G.fx.ring(c, { normal: UP, r0: 0.4, r1: r * 1.15, life: 0.5, color: col }); G.fx.ring(c, { normal: UP, r0: 0.2, r1: r * 0.7, life: 0.35, color: 0xffffff });
  G.fx.burst(c, 26, 0x9a8a6a, 6, { kind: 'dust', sk: 1.6 }); G.fx.burst(c, 30, [col, 0xffffff], 9, { dir: UP, spread: 1.2 }); G.fx.light(c.clone().setY(1), col, 70, 0.3);
  areaHit(f, c, r, { dmg, kb: [7, 6], stun: 0.6, hs: 0.1, shake: 0.15, unblock, noCrit: true });
  return c;
}
// 퍼져 나가는 돌풍 고리: 지면에 붙은 상대만 맞는다 (뛰어서 피한다)
function windWave(G, f, c, r0, r1, dur, dmg) {
  let t = 0; const hit = new Set(), col = ACC(f);
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.rotation.x = Math.PI / 2; mesh.position.copy(c).setY(0.25); G.scene.add(mesh);
  G.spawn({ done: false, owner: f, update(dt) {
    t += dt; const k = Math.min(1, t / dur), R = r0 + (r1 - r0) * k; mesh.scale.set(R, R, 1 + 2 * (1 - k)); mesh.material.opacity = 0.85 * (1 - k * 0.6);
    for (let i = 0; i < 4; i++) { const a = rand(0, TAU); G.fx.p(new V3(c.x + Math.cos(a) * R, 0.2, c.z + Math.sin(a) * R), { vel: [Math.cos(a) * 3, rand(1, 3), Math.sin(a) * 3], size: 0.25, life: 0.3, color: col, alpha: 0.7 }); }
    for (const o of f.foes()) { if (hit.has(o.id)) continue; const d = Math.hypot(o.pos.x - c.x, o.pos.z - c.z); if (Math.abs(d - R) < 0.55 + 0.3 * o.scale && o.pos.y - (o.gy || 0) < 0.45) { if (o.takeHit(f, { dmg, kb: [7, 4], stun: 0.5, hs: 0.06, unblock: true, noCrit: true }, new V3(o.pos.x - c.x, 0, o.pos.z - c.z).normalize())) hit.add(o.id); } }
    if (k >= 1) this.kill();
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); } });
}

/* ---------- 돌개바람: 떠도는 회오리 (빨간 원 예고 뒤 생겨나 천천히 플레이어를 따라온다) ---------- */
function swirlTex() { const [c, g] = cv(256, 256); g.clearRect(0, 0, 256, 256); for (let i = 0; i < 26; i++) { const y = Math.random() * 256, w = 40 + Math.random() * 120, x = Math.random() * 256; const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.4 + Math.random() * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.save(); g.translate(x, y); g.rotate(-0.35); g.fillRect(0, 0, w, 3 + Math.random() * 6); g.restore(); } return tex(c, [2, 1], false); }
const twisterGeo = () => cached('plains:twister', () => surf((u, v, p) => { const a = u * TAU, r = 0.25 + 1.1 * v * v + 0.06 * Math.sin(v * 12 + a * 2); p.set(Math.cos(a) * r, v * 4.2, Math.sin(a) * r); }, 32, 16));
function tornado(G, f, x, z, delay, life = 5.5) {
  let t = -delay; const col = ACC(f), pos = new V3(x, 0, z), cool = {};
  const mat = new THREE.MeshBasicMaterial({ color: col, map: T('plains:swirl', swirlTex), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mat2 = mat.clone(); mat2.color.set(0xffffff);
  const g = new THREE.Group(), a = new THREE.Mesh(twisterGeo(), mat), b = new THREE.Mesh(twisterGeo(), mat2); b.scale.set(0.7, 1.05, 0.7); g.add(a, b); g.position.copy(pos); g.visible = false; G.scene.add(g);
  const warn = 0.85; let marked = false;
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return;
    if (!marked) { marked = true; groundMark(G, { kind: 'disc', x: pos.x, z: pos.z, r: 1.3, life: warn, color: 0xff2a3a, owner: f }); }
    if (t < warn) { if (Math.random() < 0.4) G.fx.p(pos.clone().add(new V3(rand(-1, 1), 0.1, rand(-1, 1))), { vel: [0, rand(1, 3), 0], size: 0.2, life: 0.4, color: col, alpha: 0.6 }); return; }
    const k = t - warn; g.visible = f.root.visible || true;
    const fade = Math.min(1, k / 0.3) * Math.min(1, (life - k) / 0.5); mat.opacity = 0.45 * fade; mat2.opacity = 0.3 * fade; a.rotation.y += dt * 9; b.rotation.y -= dt * 13; mat.map.offset.x += dt * 1.5;
    // 플레이어 쪽으로 천천히 떠돈다 (최대 1.7m/s) + 흔들림
    const o = f.opp; if (o) { const dx = o.pos.x - pos.x, dz = o.pos.z - pos.z, d = Math.hypot(dx, dz) || 1, sp = 1.7; pos.x += (dx / d) * sp * dt + Math.sin(k * 2.3 + x) * dt * 1.2; pos.z += (dz / d) * sp * dt + Math.cos(k * 1.9 + z) * dt * 1.2; }
    const R = Math.hypot(pos.x, pos.z); if (R > ARENA_R - 1) pos.multiplyScalar((ARENA_R - 1) / R); g.position.copy(pos);
    if (Math.random() < 0.8) { const aa = rand(0, TAU), rr = rand(0.3, 1.2), hh = rand(0, 3.5); G.fx.p(pos.clone().add(new V3(Math.cos(aa) * rr, hh, Math.sin(aa) * rr)), { vel: [-Math.sin(aa) * 5, 2, Math.cos(aa) * 5], size: 0.18, life: 0.35, color: Math.random() < 0.5 ? col : 0xffffff, alpha: 0.7 }); }
    if (Math.random() < 0.3) G.fx.burst(pos.clone().setY(0.1), 2, 0x9a8a6a, 3, { kind: 'dust' });
    for (const tg of f.foes()) { if ((cool[tg.id] = (cool[tg.id] ?? 0) - dt) > 0) continue; if (Math.hypot(tg.pos.x - pos.x, tg.pos.z - pos.z) < 0.85 + 0.35 * tg.scale && tg.pos.y < 3) { cool[tg.id] = 0.75; tg.takeHit(f, { dmg: 30, kb: [2.5, 7.5], stun: 0.5, hs: 0.05, unblock: true, noCrit: true }, new V3(tg.pos.x - pos.x, 0, tg.pos.z - pos.z).normalize()); } }
    if (k > life) this.kill();
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(g); mat.dispose(); mat2.dispose(); } };
}

/* ---------- 고블린 늑대 기마대 (2페이즈): 경기장 끝에서 끝으로 가로지르는 바람 늑대 + 고블린 ---------- */
const WOLF_HEAD = creatureHead({ C: new V3(0, 0, 0), R: [0.11, 0.1, 0.13], snout: { len: 0.2, w: 0.3, y: -0.25, h: 0.35, drop: 0.05 }, brow: 0.02, back: 0.1 });
let riderMats = null;
function riderMesh(pal) {
  const M = riderMats || (riderMats = { wolf: new THREE.MeshPhysicalMaterial({ color: 0x9affe0, emissive: pal.accent, emissiveIntensity: 0.55, roughness: 0.4, transparent: true, opacity: 0.82, sheen: 1, sheenColor: new THREE.Color(0xffffff) }), eye: new THREE.MeshBasicMaterial({ color: 0xffffff }) });
  const g = new THREE.Group(), wolf = new THREE.Group(); g.add(wolf);
  addMesh(wolf, cached('plains:wolfBody', () => { const W = spl([[0, 0.02], [0.15, 0.13], [0.6, 0.15], [0.85, 0.17], [1, 0.08]]); const g2 = loft((v) => ({ y: -0.55 + 1.1 * v, rx: W(v), rzF: W(v) * 1.15, rzB: W(v) * 0.95, cz: -0.02 * v }), 24, 14, { poles: [0] }); g2.rotateX(PI2); return g2; }), M.wolf, [0, 0.72, 0]);
  const head = new THREE.Group(); head.position.set(0, 0.9, 0.62); wolf.add(head);
  addMesh(head, cached('plains:wolfHead', () => WOLF_HEAD.geo(32, 24)), M.wolf);
  for (const s of [-1, 1]) { addMesh(head, cached('plains:wolfEar', () => new THREE.ConeGeometry(0.04, 0.12, 6)), M.wolf, [s * 0.06, 0.1, -0.04], [-0.3, 0, -s * 0.2]); addMesh(head, cached('plains:wolfEye', () => new THREE.SphereGeometry(0.014, 6, 5)), M.eye, WOLF_HEAD.at(s * 0.45, 0.25, 0).toArray()); }
  const legsG = [];
  for (const [x, z] of [[0.1, 0.4], [-0.1, 0.4], [0.1, -0.38], [-0.1, -0.38]]) { const L = new THREE.Group(); L.position.set(x, 0.72, z); wolf.add(L); addMesh(L, cached('plains:wolfLeg', () => strand([[0, 0, 0], [0, -0.3, 0.05], [0, -0.55, -0.02], [0, -0.7, 0.04]], 0.05, 0.025, { seg: 10, rad: 8 })), M.wolf); legsG.push(L); }
  const tail = addMesh(wolf, cached('plains:wolfTail', () => strand([[0, 0, 0], [0, 0.05, -0.25], [0, -0.05, -0.5], [0, -0.1, -0.7]], 0.06, 0.01, { seg: 12, rad: 8 })), M.wolf, [0, 0.78, -0.52]);
  const gob = buildGoblin(pal, { kind: 'raider' }); gob.root.scale.setScalar(0.72); gob.root.position.set(0, 0.62, -0.08); g.add(gob.root);
  applyPose(gob, flat({ ...gobPoses.base, hipY: -0.1, spine: [0.45, 0, 0], hipL: [-1.3, 0, 0.55], kneeL: [1.7, 0, 0], hipR: [-1.3, 0, -0.55], kneeR: [1.7, 0, 0], shoulderR: [-2.6, 0, -0.3], elbowR: [-0.5, 0, 0], weapon: [1.2, 0, 0], shoulderL: [-0.9, 0, 0.3], elbowL: [-0.6, 0, 0] }));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.legs = legsG; g.userData.tail = tail; return g;
}
function riderRun(G, f, delay) {
  const o = f.opp; if (!o) return null; let t = -delay, ph = 0;
  const tp = o.pos.clone(), a = rand(0, TAU), dx = Math.cos(a), dz = Math.sin(a), R = ARENA_R - 0.8;
  // 플레이어 위치를 지나는 직선: 경기장 끝 A → 반대쪽 끝 B
  const b = tp.x * dx + tp.z * dz, c = tp.x * tp.x + tp.z * tp.z - R * R, disc = Math.sqrt(Math.max(0, b * b - c)), tA = -b - disc, tB = -b + disc;
  const A = new V3(tp.x + dx * tA, 0, tp.z + dz * tA), len = tB - tA, yaw = Math.atan2(dx, dz), warn = 1.0, speed = 17; let mesh = null, hit = new Set();
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return;
    if (!this.m) { this.m = groundMark(G, { kind: 'lane', x: A.x, z: A.z, w: 1.8, len, yaw, life: warn + len / speed * 0.6, color: 0xff2a3a, owner: f }); }
    if (t < warn) return;
    if (!mesh) { mesh = riderMesh(f.palette); mesh.rotation.y = yaw; G.scene.add(mesh); sfx('dash'); }
    const k = (t - warn) * speed; if (k > len) return this.kill();
    mesh.position.set(A.x + dx * k, 0, A.z + dz * k); ph += dt * 18;
    mesh.userData.legs.forEach((L, i) => { L.rotation.x = Math.sin(ph + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.4) * 0.8; }); mesh.children[0].position.y = Math.abs(Math.sin(ph)) * 0.08; mesh.userData.tail.rotation.y = Math.sin(ph * 0.5) * 0.4;
    if (Math.random() < 0.7) G.fx.burst(mesh.position.clone().setY(0.1), 2, 0x9a8a6a, 3, { kind: 'dust' });
    G.fx.p(mesh.position.clone().add(new V3(rand(-0.3, 0.3), rand(0.5, 1.3), rand(-0.3, 0.3))), { vel: [-dx * 4, 0.5, -dz * 4], size: 0.3, life: 0.3, color: ACC(f), alpha: 0.5 });
    for (const tg of f.foes()) if (!hit.has(tg.id) && Math.hypot(tg.pos.x - mesh.position.x, tg.pos.z - mesh.position.z) < 0.85 + 0.35 * tg.scale && tg.pos.y < 1.3) { if (tg.takeHit(f, { dmg: 60, kb: [8, 5], stun: 0.6, hs: 0.08, unblock: true, noCrit: true }, new V3(dx, 0, dz))) hit.add(tg.id); }
  }, kill() { if (this.done) return; this.done = true; if (mesh) G.scene.remove(mesh); } };
}

/* ---------- 돌격 (질풍 돌격): 빨간 돌격 길 예고 → 경기장을 가로질러 질주 ---------- */
function chargeMove({ wind, speed, dmg, second }) {
  const run = 0.95, dur = wind + run + 0.5;
  return {
    dur, noMove: true, aim: true, track: 0, tele: [0.05, 'red'], ...(second ? {} : { cd: 's1' }),
    keys: [[0, 'base'], [wind * 0.6, { ...REAR(0.35), shoulderR: [-1.6, 0, -0.3], elbowR: [-1.0, 0, 0], weapon: [0.9, 0, 0] }], [wind, COUCH], [wind + run, COUCH], [dur, 'base']],
    gallop: (f, t) => (f._lane && t > wind && t < wind + f._lane.T ? 1 : 0), rear: (f, t) => (t < wind ? 0.45 * Math.sin(Math.min(1, t / wind) * Math.PI) : 0),
    start: (f, o, G) => { const d = f.fwd(new V3()), len = laneLen(f.pos.x, f.pos.z, d.x, d.z, 17); f._lane = { dx: d.x, dz: d.z, yaw: f.yaw, T: Math.min(run, len / (speed * 0.86)) };
      groundMark(G, { kind: 'lane', x: f.pos.x, z: f.pos.z, w: 2.6 * f.scale, len, yaw: f.yaw, life: wind + 0.15, color: 0xff2a3a, owner: f }); sfx('charge'); },
    tick: (f, o, G, t) => { const L = f._lane; if (!L) return; f.yaw = L.yaw;
      if (t < wind) { if (Math.random() < 0.35) G.fx.burst(f.local([0, 0.05, 1.0 * f.scale]), 3, 0x9a8a6a, 3, { kind: 'dust' }); }
      else if (t < wind + L.T) { f.vel.x = L.dx * speed; f.vel.z = L.dz * speed;
        G.fx.burst(f.local([0, 0.05, -0.5]), 2, 0x9a8a6a, 4, { kind: 'dust', sk: 1.3 }); G.fx.p(f.local([rand(-0.6, 0.6), rand(0.6, 2.4), rand(-1, 1)]), { vel: [-L.dx * 9, 0, -L.dz * 9], size: 0.35, life: 0.25, color: ACC(f), alpha: 0.6 }); } },
    ev: [[wind, (f, o, G) => { sfx('dash'); G.shake(0.15); G.fx.burst(f.chest(), 26, [ACC(f), 0xffffff], 8); }],
      ...(second ? [] : [[wind + run + 0.25, (f, o, G) => { if (f.enraged) f.start('s1b'); }]])],
    hits: [H({ t0: wind, t1: wind + run, at: [0, 0.95, 1.0], r: 1.1, dmg, kb: [10, 6], stun: 0.7, hs: 0.1, shake: 0.2, unblock: true })],
    end: (f) => { f._lane = null; },
  };
}

/* ---------- 투창: 던진 창이 날아갔다가 되돌아온다 (돌아오는 길에도 맞는다) ---------- */
function throwSpear(f, o, G) {
  if (!o) return; const mdl = f.model, h = mdl.tipPos(new V3()), d = o.chest(new V3()).sub(h).normalize();
  const mesh = mdl.spear.clone(); mdl.setWeapon(false); const out = 0.62; let back = false;
  const ms = new Missile(G, { owner: f, pos: h.addScaledVector(d, -1.2), vel: d.clone().multiplyScalar(25), mesh, r: 0.45, color: ACC(f), pierce: true, life: 3.2, scale: f.scale,
    hit: { dmg: 62, kb: [5, 3], stun: 0.5, hs: 0.08, noCrit: true },
    tick: (s, dt) => {
      G.fx.p(s.pos.clone().add(new V3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4))), { vel: [0, 0, 0], size: 0.25, life: 0.25, color: 0xffffff, alpha: 0.5 });
      if (s.t > out) { if (!back) { back = true; s.hitSet.clear(); sfx('swing'); }
        const hand = f.chest(new V3()).add(new V3(0, 0.6 * f.scale, 0)), to = hand.sub(s.pos), dist = to.length(); s.vel.lerp(to.normalize().multiplyScalar(22), 1 - Math.exp(-dt * 6));
        if (dist < 1.3 || f.state === 'ko') s.kill(); }
      else s.vel.multiplyScalar(Math.exp(-dt * 1.2)); },
    onEnd: () => { mdl.setWeapon(true); G.fx.burst(f.model.tipPos(new V3()), 14, [ACC(f), 0xffffff], 4); } });
  ms.mesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), d); G.spawn(ms); sfx('heavy');
}

const B = S.boss;
Object.assign(B, {
  scale: 1.35, hurtScale: 1.25,
  stats: { hp: 4200, speed: 6.4, jump: 9, daze: 340, armor: true, breakTime: 5 },
  skills: { s1: { name: '질풍 돌격', cd: 6.5 }, s2: { name: '돌풍 짓밟기', cd: 8 }, ult: { name: '-', sub: '' }, throw: { name: '회오리 투창', cd: 7 }, tornado: { name: '돌개바람', cd: 11 }, riders: { name: '고블린 기마대', cd: 14 } },
  createModel: (p) => buildGale(p), poses: galePoses, runCycle: galeRun,
  moves: {
    // 창 찌르기 → 창 휘두르기 → 앞발 짓밟기 (노랑: 패리 가능)
    light1: { dur: 0.95, trail: true, aim: true, track: 0.4, tele: [0.12, 'yellow'], next: 'light2', cancel: 0.72,
      keys: [[0, 'base'], [0.38, { shoulderR: [-0.1, 0, -0.3], elbowR: [-1.9, 0, 0], weapon: [0.05, 0.05, 0], neck: [-P - 0.05, 0.45, 0] }], [0.5, { shoulderR: [-1.35, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [-0.05, 0, 0], neck: [-P + 0.25, -0.2, 0] }], [0.95, 'base']],
      lunge: [[0.4, 0.52, 7]], ev: [[0.42, (f) => { sfx('swing'); }]], hits: [H({ t0: 0.42, t1: 0.58, at: [0, 1.25, 2.1], r: 0.8, dmg: 58, kb: [4, 1], stun: 0.45, hs: 0.07 })] },
    light2: { dur: 1.0, trail: true, aim: true, track: 0.25, next: 'light3', cancel: 0.75,
      keys: [[0, { neck: [-P + 0.05, 0.4, 0] }], [0.32, { neck: [-P, 0.85, 0], weapon: [0.1, -1.1, 0], shoulderR: [-0.9, 0, -0.9], elbowR: [-0.5, 0, 0] }], [0.52, { neck: [-P + 0.1, -0.75, 0], weapon: [0.0, 1.1, 0], shoulderR: [-1.2, 0, 0.4], elbowR: [-0.2, 0, 0] }], [1.0, 'base']],
      ev: [[0.34, (f) => { sfx('swing'); f.slashFx({ tilt: 0.1, r: 2.2 * f.scale, at: [0, 1.25 * f.scale, 0.9] }); }]], hits: [H({ t0: 0.34, t1: 0.52, at: [0, 1.15, 1.6], r: 1.35, dmg: 54, kb: [6, 2], stun: 0.45, hs: 0.07 })] },
    light3: { dur: 1.35, aim: true, track: 0.5, tele: [0.15, 'yellow'],
      keys: [[0, 'base'], [0.55, { ...REAR(1), shoulderR: [-2.2, 0, -0.2], elbowR: [-0.4, 0, 0], weapon: [0.9, 0, 0] }], [0.8, { ...REAR(-0.15) }], [1.35, 'base']],
      rear: (f, t) => (t < 0.55 ? smooth(0.05, 0.5, t) : 1 - smooth(0.6, 0.78, t)), ev: [[0.3, () => sfx('charge')], [0.8, (f, o, G) => stomp(f, G, 2.5, 76, false)]] },
    // 돌풍 짓밟기 (빨강): 높이 앞발을 들었다 내려찍고, 땅을 따라 돌풍 고리가 두 번 퍼진다 → 뛰어 넘는다
    s2: { dur: 1.9, cd: 's2', aim: true, track: 0.7, tele: [0.2, 'red'],
      keys: [[0, 'base'], [0.85, { ...REAR(1.25), shoulderR: [-2.8, 0, -0.2], elbowR: [-0.3, 0, 0], weapon: [1.4, 0, 0], shoulderL: [-2.4, 0, 0.5] }], [1.05, { ...REAR(-0.2), shoulderR: [-1.0, 0, -0.2], weapon: [-0.4, 0, 0] }], [1.9, 'base']],
      rear: (f, t) => (t < 0.85 ? smooth(0.05, 0.75, t) : 1 - smooth(0.88, 1.03, t)),
      ev: [[0.25, (f, o, G) => { sfx('charge'); G.fx.burst(f.chest(), 30, [ACC(f), 0xffffff], 6, { kind: 'glow' }); }], [1.05, (f, o, G) => { const c = stomp(f, G, 3.6, 110, true); windWave(G, f, c, 1.5, 9, 0.8, 50); f._c = c; }], [1.4, (f, o, G) => windWave(G, f, f._c || f.pos.clone(), 1.5, 9, 0.8, 50)]] },
    // 질풍 돌격 (빨강): 길이 예고된 뒤 경기장을 가로지른다. 2페이즈에는 끝에서 돌아 다시 한 번 (s1b)
    s1: chargeMove({ wind: 0.95, speed: 24, dmg: 105 }),
    s1b: chargeMove({ wind: 0.6, speed: 27, dmg: 95, second: true }),
    // 회오리 투창 (노랑): 창을 던지고, 창은 날아갔다가 손으로 되돌아온다 — 돌아오는 길(뒤쪽)도 위험
    throw: { dur: 1.3, cd: 'throw', aim: true, track: 0.55, tele: [0.15, 'yellow'],
      keys: [[0, 'base'], [0.5, { shoulderR: [-2.7, 0, -0.35], elbowR: [-0.7, 0, 0], weapon: [0.55, 0, 0], neck: [-P - 0.15, 0.55, 0], shoulderL: [-1.4, 0, 0.4] }], [0.62, { shoulderR: [-1.5, 0, -0.1], elbowR: [-0.1, 0, 0], neck: [-P + 0.3, -0.35, 0] }], [1.3, 'base']],
      ev: [[0.62, throwSpear]] },
    // 돌개바람: 창을 머리 위로 돌려 회오리 셋을 부른다 (빨간 원 → 회오리가 천천히 따라온다)
    tornado: { dur: 1.5, cd: 'tornado', aim: true, track: 0.3, tele: [0.2, 'red'],
      keys: [[0, 'base'], [0.4, { ...REAR(0.4), shoulderR: [-3.0, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [1.5, 0, 0], neck: [-P + 0.35, 0, 0] }], [1.1, { ...REAR(0.4), shoulderR: [-3.0, 0, -0.1], weapon: [1.5, 0, 0] }], [1.5, 'base']],
      rear: (f, t) => 0.4 * Math.sin(Math.min(1, t / 1.3) * Math.PI),
      tick: (f, o, G, t) => { if (t > 0.4 && t < 1.1) { const tp = f.model.tipPos(new V3()); for (let i = 0; i < 3; i++) { const a = G.time * 14 + i * 2.1; G.fx.p(tp.clone().add(new V3(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8)), { vel: [0, 1, 0], size: 0.3, life: 0.3, color: ACC(f), alpha: 0.7 }); } } },
      ev: [[0.6, (f, o, G) => { if (!o) return; sfx('charge'); const n = f.enraged ? 4 : 3; for (let i = 0; i < n; i++) { const a = rand(0, TAU), r = i === 0 ? 1.2 : rand(3, 5.5); G.spawn(tornado(G, f, o.pos.x + Math.cos(a) * r, o.pos.z + Math.sin(a) * r, i * 0.25)); } }]] },
    // 고블린 기마대 (2페이즈): 창을 치켜들고 외치면 바람 늑대를 탄 고블린 셋이 플레이어를 지나는 길로 차례로 달려든다
    riders: { dur: 1.6, cd: 'riders', aim: true, track: 0.4, tele: [0.2, 'red'],
      keys: [[0, 'base'], [0.5, { ...REAR(0.8), shoulderR: [-2.9, 0, -0.2], elbowR: [-0.2, 0, 0], weapon: [1.45, 0, 0], neck: [-P + 0.4, 0, 0], head: [-0.4, 0, 0] }], [1.2, { ...REAR(0.8) }], [1.6, 'base']],
      rear: (f, t) => 0.8 * Math.sin(Math.min(1, t / 1.5) * Math.PI),
      ev: [[0.55, (f, o, G) => { sfx('teleRed'); G.shake(0.2); G.fx.ring(f.pos.clone().setY(0.1), { normal: UP, r0: 1, r1: 8, life: 0.6, color: ACC(f) }); for (let i = 0; i < 3; i++) { const r = riderRun(G, f, i * 0.75); if (r) G.spawn(r); } }]] },
  },
  ai: { range: 14, keep: 6, cdMin: 0.7, cdMax: 1.6, chain: 0.85,
    pick: (f, o, d) => {
      const ok = (k) => (f.cd[k] ?? 0) <= 0;
      if (f.enraged && ok('riders') && Math.random() < 0.5) return 'riders';
      if (d > 6 && ok('s1') && Math.random() < 0.6) return 's1';
      if (ok('tornado') && Math.random() < 0.4) return 'tornado';
      if (d > 4.5 && ok('throw') && Math.random() < 0.55) return 'throw';
      if (d < 4.2 && ok('s2') && Math.random() < 0.45) return 's2';
      // 붙으면 가끔만 창 연격 — 나머지는 거리를 벌리며 돈다 (기병)
      if (d < 3.6) return Math.random() < 0.5 ? 'light' : null;
      return ok('s1') ? 's1' : null;
    } },
});
export default S;
