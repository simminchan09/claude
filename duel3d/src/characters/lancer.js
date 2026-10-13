// 세라 (LANCER · 수호 사제) — 근·중거리 · 창술 · 성광 · 수호
// 성스러운 빛을 다루는 수호 사제. 긴 은빛 창으로 찌르고 쓸며, 도약해 땅을 내려찍고, 빛의 창을 쏘아 꿰뚫는다.
// 광휘의 축복으로 자신(과 아군)의 공격력과 체력을 끌어올린다. 맞힐수록 성광이 차오르고, 가득 차면 세라픽 피어스가 두 겹의 빛 파동이 된다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, HOLY, HOLY2, AMBER, RINGB } from './lancer_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const GOLDS = [HOLY, HOLY2, 0xffffff];

/* =====================================================================
   포즈 (weapon = 몸 기준 창끝 방향 [피치(위+), 좌우(오른쪽+), 롤]. 왼손은 IK 로 창대를 잡는다)
   ===================================================================== */
const LEGS_LUNGE = { hipL: [-1.0, 0, 0.12], kneeL: [1.0, 0, 0], hipR: [0.7, 0, -0.12], kneeR: [0.3, 0, 0] };
const poses = {
  // 기본: 왼발을 앞에 두고 몸을 오른쪽으로 비튼 창술 자세 — 창끝은 앞으로 비스듬히 위
  base: { hips: [0, -0.4, 0], spine: [0.06, -0.08, 0], chest: [0.03, -0.1, 0], head: [0.02, 0.5, 0],
    shoulderR: [0.15, 0, -0.18], elbowR: [-1.15, 0, 0], weapon: [0.32, -0.08, 0], shoulderL: [-0.6, 0, 0.1], elbowL: [-0.8, 0, 0],
    hipL: [-0.38, 0, 0.1], kneeL: [0.42, 0, 0], footL: [-0.05, 0, 0], hipR: [0.28, 0, -0.1], kneeR: [0.32, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.15, 0], spine: [0.32, 0.05, 0], chest: [0.06, 0.05, 0], head: [-0.2, 0.1, 0], shoulderR: [0.45, 0, -0.25], elbowR: [-0.75, 0, 0], weapon: [0.15, -0.25, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.2, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.3, 0, 0], shoulderR: [-0.5, 0, -0.3], elbowR: [-0.9, 0, 0], weapon: [0.6, -0.2, 0] },
  // 방어: 창대를 몸 앞에 비스듬히 세워 막는다
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.05, 0], chest: [0.05, 0.05, 0], head: [0, 0.15, 0], shoulderR: [-0.75, 0, -0.15], elbowR: [-1.5, 0, 0], weapon: [0.9, -1.2, 1.2],
    hipL: [-0.5, 0, 0.2], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [0.8, -0.6, 0.3], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.6, 0.8, 0.4], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.74, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -1.4, 1.57],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.7, 0, -0.3], elbowR: [-0.5, 0, 0], weapon: [0.1, -0.3, 0], shoulderL: [0.7, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.9, 0, 0] },
  // 승리: 창을 곧게 세워 짚고 고개를 숙여 기도
  win: { hips: [0, 0, 0], spine: [0.02, 0, 0], chest: [0, 0, 0], head: [0.35, 0, 0], shoulderR: [-0.5, 0, -0.32], elbowR: [-0.95, 0, 0], weapon: [1.5, 0.12, 0], shoulderL: [-0.75, 0, 0.1], elbowL: [-1.3, 0, 0],
    hipL: [-0.05, 0, 0.08], kneeL: [0.06, 0, 0], hipR: [0.05, 0, -0.08], kneeR: [0.06, 0, 0] },
  // 컷인: 창을 세우고 정면을 바라본다
  portrait: { hips: [0, 0.2, 0], chest: [0, -0.15, 0], head: [0.02, 0.06, 0], shoulderR: [-0.6, 0, -0.3], elbowR: [-1.25, 0, 0], weapon: [1.4, 0.2, 0.3] },
  // 찌르기 준비: 창을 허리 뒤로 당김 (창은 수평)
  poise: { hips: [0, -0.55, 0], spine: [0.1, -0.25, 0], chest: [0.04, -0.3, 0], head: [0, 0.75, 0], shoulderR: [0.45, 0, -0.25], elbowR: [-1.35, 0, 0], weapon: [0.08, 0.05, 0],
    hipL: [-0.55, 0, 0.15], kneeL: [0.7, 0, 0], hipR: [0.4, 0, -0.15], kneeR: [0.55, 0, 0] },
  // 찌르기: 몸을 앞으로 던지며 오른팔을 곧게 뻗는다
  stab: { hips: [0, 0.1, 0], spine: [0.32, 0.12, 0], chest: [0.1, 0.18, 0], head: [-0.25, -0.2, 0], shoulderR: [-1.45, 0, 0.02], elbowR: [-0.05, 0, 0], weapon: [0.03, 0, 0], ...LEGS_LUNGE },
  // 가로 쓸기: 오른쪽으로 감았다가 왼쪽으로
  sweepR: { hips: [0, -0.6, 0], spine: [0.1, -0.35, 0], chest: [0.02, -0.45, 0], head: [0, 0.8, 0], shoulderR: [-1.0, 0, -0.9], elbowR: [-0.4, 0, 0], weapon: [0.1, 1.9, 1.57], shoulderL: [-0.6, 0, 0.3], elbowL: [-1.1, 0, 0],
    hipL: [-0.5, 0, 0.18], kneeL: [0.7, 0, 0], hipR: [0.35, 0, -0.18], kneeR: [0.55, 0, 0] },
  sweepL: { hips: [0, 0.45, 0], spine: [0.2, 0.35, 0], chest: [0.05, 0.45, 0], head: [0, -0.55, 0], shoulderR: [-1.3, 0, 0.45], elbowR: [-0.12, 0, 0], weapon: [0.05, -1.7, 1.57], shoulderL: [0.3, 0, 0.6], elbowL: [-0.5, 0, 0], ...LEGS_LUNGE },
  // 회전: 창을 수평으로 크게 뻗은 자세
  spin: { hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.05, 0.25, 0], shoulderR: [-1.45, 0, -1.15], elbowR: [-0.05, 0, 0], weapon: [-0.1, 1.45, 1.57], shoulderL: [-0.5, 0, 1.2], elbowL: [-0.3, 0, 0],
    hipL: [-0.6, 0, 0.25], kneeL: [0.85, 0, 0], hipR: [0.4, 0, -0.25], kneeR: [0.65, 0, 0] },
  // 올려치기 마무리
  rise: { hips: [0, -0.3, 0], spine: [-0.15, -0.2, 0], chest: [-0.1, -0.3, 0], head: [-0.3, 0.4, 0], shoulderR: [-2.6, 0, -0.45], elbowR: [-0.2, 0, 0], weapon: [1.2, 0.4, 1.57], shoulderL: [-0.3, 0, 0.6], elbowL: [-0.6, 0, 0],
    hipL: [-0.2, 0, 0.12], kneeL: [0.25, 0, 0], hipR: [0.2, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 머리 위로 치켜든 자세 (창끝은 앞 아래)
  raised: { hips: [0, 0, 0], spine: [-0.18, 0, 0], chest: [-0.1, 0, 0], head: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.2], elbowR: [-0.45, 0, 0], weapon: [-0.35, 0, 0], shoulderL: [-2.7, 0, 0.25], elbowL: [-0.5, 0, 0],
    hipL: [-1.1, 0, 0.1], kneeL: [1.6, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
  // 내려꽂은 직후: 무릎을 굽히고 창끝이 앞쪽 땅에 박힘
  pierce: { hipY: -0.12, hips: [0, -0.15, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.4, 0, 0], shoulderR: [-1.25, 0, -0.08], elbowR: [-0.2, 0, 0], weapon: [-0.95, 0, 0], shoulderL: [-1.1, 0, 0.1], elbowL: [-0.3, 0, 0],
    hipL: [-1.3, 0, 0.12], kneeL: [1.75, 0, 0], footL: [-0.3, 0, 0], hipR: [-0.2, 0, -0.12], kneeR: [1.5, 0, 0], footR: [-0.4, 0, 0] },
  // 기도: 창을 앞에 곧게 세우고 두 손으로 짚는다 (광휘의 축복)
  pray: { hips: [0, 0, 0], spine: [0.05, 0, 0], chest: [0.02, 0, 0], head: [0.4, 0, 0], shoulderR: [-0.85, 0, 0.12], elbowR: [-0.9, 0, 0], weapon: [1.53, 0, 0], shoulderL: [-0.85, 0, -0.1], elbowL: [-0.9, 0, 0],
    hipL: [-0.08, 0, 0.06], kneeL: [0.1, 0, 0], hipR: [0.08, 0, -0.06], kneeR: [0.1, 0, 0] },
  // 하늘을 향해 창을 치켜듦 (궁극기)
  skyward: { hips: [0, 0, 0], spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.4, 0, 0], shoulderR: [-3.0, 0, -0.15], elbowR: [-0.1, 0, 0], weapon: [1.52, 0, 0], shoulderL: [-0.3, 0, 0.9], elbowL: [-0.3, 0, 0],
    hipL: [-0.2, 0, 0.12], kneeL: [0.25, 0, 0], hipR: [0.1, 0, -0.12], kneeR: [0.4, 0, 0] },
  // 던지기 (궁극기: 빛의 창을 내리꽂음)
  hurl: { hips: [0, 0.3, 0], spine: [0.55, 0.25, 0], chest: [0.15, 0.3, 0], head: [-0.2, -0.3, 0], shoulderR: [-1.6, 0, 0.1], elbowR: [-0.05, 0, 0], weapon: [-0.6, 0, 0], shoulderL: [0.4, 0, 0.6], elbowL: [-0.5, 0, 0],
    hipL: [-1.2, 0, 0.1], kneeL: [1.2, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.9, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 창을 세워 짚고 한쪽 무릎을 꿇어 기도한다
  idle2: { hipY: -0.42, hips: [0, 0, 0], spine: [0.12, 0, 0], chest: [0.05, 0, 0], head: [0.45, 0, 0], shoulderR: [-0.95, 0, 0.1], elbowR: [-1.0, 0, 0], weapon: [1.5, 0.2, 0], shoulderL: [-0.9, 0, -0.1], elbowL: [-1.0, 0, 0],
    hipL: [-1.55, 0, 0.1], kneeL: [1.6, 0, 0], footL: [0.0, 0, 0], hipR: [0.05, 0, -0.08], kneeR: [1.65, 0, 0], footR: [-0.1, 0, 0] },
});

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const rad = (f) => f.radiance || 0;
const holy = (f, k) => { f.holyK = k; };
const goldSlash = (f, o) => f.slashFx({ r: o.r || 2.2, color: o.color ?? HOLY, life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
function motes(G, p, n = 10, sp = 3, up = 1.5) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))), { vel: [rand(-sp, sp), rand(0, sp) + up, rand(-sp, sp)], size: rand(0.05, 0.11), size1: 0.02, life: rand(0.5, 0.9), color: i % 3 ? HOLY : HOLY2, alpha: 0.95, drag: 2, grav: -0.5, flick: 0.5 }); }
// 땅 갈라짐: 방사형 금빛 균열
function cracks(G, c, r, n = 9, col = HOLY) {
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rand(-0.25, 0.25), L = r * rand(0.55, 1.05), d = new V3(Math.cos(a), 0, Math.sin(a)); G.fx.slash(c.clone().addScaledVector(d, L * 0.45).setY(c.y + 0.04), { fwd: d, normal: UP, r: L * 0.55, color: col, life: 0.55 }); }
}
// 찌르기 빛줄기: a → b 선을 따라 금빛 입자
function thrustLine(G, a, b, w = 1, col = HOLY) {
  const d = new V3().subVectors(b, a), L = d.length(), n = Math.max(3, Math.round(L / 0.35));
  for (let i = 0; i <= n; i++) G.fx.p(a.clone().addScaledVector(d, i / n), { vel: [0, 0, 0], size: 0.35 * w * (1 - 0.5 * i / n), size1: 0.04, life: 0.25, color: i % 2 ? col : 0xffffff, alpha: 0.85, drag: 0 });
}
// 빛의 십자 (작은 반짝임)
function crossFlash(G, p, s = 1, col = HOLY) {
  for (const n of [new V3(1, 0, 0), new V3(0, 0, 1)]) G.fx.slash(p, { fwd: UP, normal: n, r: 0.9 * s, color: col, life: 0.22 });
  G.fx.p(p, { size: 1.4 * s, size1: 0.2, life: 0.22, color: 0xffffff, alpha: 0.9 });
}

/* ---------- 빛의 창: 가산 혼합 반투명 창 메시 (루미너스 런스 · 궁극기) ---------- */
function lightLanceMesh(len, r, col) {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const geos = [];
  const mk = (geo, m, p, rr) => { geos.push(geo); const me = new THREE.Mesh(geo, m); me.position.set(...p); if (rr) me.rotation.set(...rr); me.frustumCulled = false; g.add(me); return me; };
  // 자루 (+Z 방향으로 len) · 창날 · 십자 가시 · 고리
  mk(new THREE.CylinderGeometry(r * 0.35, r * 0.2, len * 0.62, 12, 1, true), mat, [0, 0, len * 0.31], [Math.PI / 2, 0, 0]);
  mk(new THREE.CylinderGeometry(r * 0.14, r * 0.1, len * 0.62, 8, 1, true), core, [0, 0, len * 0.31], [Math.PI / 2, 0, 0]);
  mk(new THREE.ConeGeometry(r, len * 0.36, 4, 1, true), mat, [0, 0, len * 0.82], [Math.PI / 2, 0, 0]);
  mk(new THREE.ConeGeometry(r * 0.4, len * 0.34, 4, 1, true), core, [0, 0, len * 0.82], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; const sp = mk(new THREE.ConeGeometry(r * 0.35, r * 3.2, 4), mat, [Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4, len * 0.64]); sp.rotation.z = a - Math.PI / 2; }
  mk(new THREE.TorusGeometry(r * 1.4, r * 0.12, 6, 32), mat, [0, 0, len * 0.64]);
  return { g, mats: [mat, core], geos };
}
// 루미너스 런스: 창끝에서 앞으로 순식간에 뻗는 빛의 창 (경로의 적 모두 관통)
class LuminousLance {
  constructor(G, f, from, dir, len, dmg, big) {
    this.G = G; this.f = f; this.t = 0; this.done = false; this.life = 0.45; this.from = from.clone(); this.dir = dir.clone().normalize(); this.len = len;
    const L = lightLanceMesh(len, big ? 0.32 : 0.22, HOLY); this.L = L; L.g.position.copy(from); L.g.quaternion.setFromUnitVectors(new V3(0, 0, 1), this.dir); G.scene.add(L.g); L.g.scale.set(1, 1, 0.05);
    const to = from.clone().addScaledVector(this.dir, len);
    for (const t of f.foes()) if (t.hurtHitSeg(from, to, big ? 0.55 : 0.42)) { t.takeHit(f, { dmg, kb: [6, 2.2], stun: 0.6, hs: 0.12, shake: 0.22, daze: 34, snd: 'big' }, this.dir.clone().setY(0).normalize()); }
    thrustLine(G, from, to, big ? 1.6 : 1.2); G.fx.ring(from.clone().addScaledVector(this.dir, 0.4), { normal: this.dir, r0: 0.2, r1: 1.4, life: 0.3, color: HOLY }); G.fx.light(from, HOLY, 90, 0.35, 12);
    G.fx.burst(to, 24, GOLDS, 8, { dir: this.dir, spread: 0.6 });
  }
  update(dt) {
    this.t += dt; const k = this.t / this.life, g = this.L.g;
    g.scale.set(1 - 0.3 * k, 1 - 0.3 * k, Math.min(1, this.t / 0.08)); this.L.mats[0].opacity = 0.8 * (1 - k); this.L.mats[1].opacity = 0.7 * (1 - k);
    if (Math.random() < 0.8) this.G.fx.p(this.from.clone().addScaledVector(this.dir, Math.random() * this.len), { vel: [rand(-0.5, 0.5), rand(0.3, 1.2), rand(-0.5, 0.5)], size: 0.1, size1: 0.02, life: 0.5, color: HOLY2, alpha: 0.9, drag: 1 });
    if (k >= 1) this.kill();
  }
  kill() { if (this.done && !this.L) return; this.done = true; if (!this.L) return; this.G.scene.remove(this.L.g); for (const m of this.L.mats) m.dispose(); for (const g of this.L.geos) g.dispose(); this.L = null; }
}
// 빛의 날개 (궁극기): 등 뒤에 펼쳐지는 깃털 여섯 장씩 · 천천히 날갯짓
let _featherGeo = null;
class LightWings {
  constructor(G, f, life) {
    this.G = G; this.f = f; this.t = 0; this.life = life; this.done = false;
    if (!_featherGeo) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.09, 0.25, 0.03, 0.62); sh.quadraticCurveTo(0.0, 0.66, -0.03, 0.6); sh.quadraticCurveTo(-0.07, 0.25, 0, 0); _featherGeo = new THREE.ShapeGeometry(sh, 8); }
    this.mat = new THREE.MeshBasicMaterial({ color: HOLY, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.g = new THREE.Group(); G.scene.add(this.g); this.wings = [];
    for (const s of [-1, 1]) { const w = new THREE.Group(); this.g.add(w); w.userData.s = s; this.wings.push(w);
      for (let i = 0; i < 7; i++) { const fe = new THREE.Mesh(_featherGeo, this.mat); fe.frustumCulled = false; const a = 0.25 + i * 0.2; fe.position.set(s * (0.05 + i * 0.07), 0.05 + i * 0.03, 0); fe.rotation.set(0, 0, -s * a); fe.scale.setScalar(1.1 + i * 0.22); w.add(fe); } }
  }
  update(dt) {
    const f = this.f; this.t += dt; if (this.t > this.life || f.gone) return this.kill();
    const k = Math.min(1, this.t / 0.35) * Math.min(1, (this.life - this.t) / 0.3); this.mat.opacity = 0.55 * k; this.g.visible = f.root.visible;
    const J = f.model.J; J.chest.updateMatrixWorld(true); J.chest.localToWorld(this.g.position.set(0, 0.17, -0.1)); J.chest.getWorldQuaternion(this.g.quaternion); this.g.scale.setScalar(f.scale * (0.6 + 0.4 * k));
    const flap = Math.sin(this.t * 5) * 0.25; for (const w of this.wings) { const s = w.userData.s; w.rotation.set(0.15, s * (-0.5 + flap), 0); }
    if (Math.random() < 0.6) { const p = new V3(); this.wings[Math.random() < 0.5 ? 0 : 1].children[6].getWorldPosition(p); this.G.fx.p(p, { vel: [rand(-0.4, 0.4), -0.4, rand(-0.4, 0.4)], size: 0.12, size1: 0.02, life: 0.8, color: HOLY2, alpha: 0.9, drag: 1 }); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.mat.dispose(); }
}
// 궁극기: 하늘에서 만들어져 대상에게 꽂히는 거대한 빛의 창
class JudgementLance {
  constructor(G, f, tgt) {
    this.G = G; this.f = f; this.tgt = tgt; this.t = 0; this.done = false; this.phase = 'form';
    this.L = lightLanceMesh(5.5, 0.5, HOLY); G.scene.add(this.L.g); this.L.g.scale.setScalar(0.01); this.pos = new V3(); this.aim();
  }
  aim() { const f = this.f, tg = this.tgt; this.pos.copy(f.pos).add(new V3(0, 3.2 * f.scale, 0)).addScaledVector(f.fwd(new V3()), -0.5); const to = tg ? tg.pos.clone().setY(tg.pos.y + 0.6) : f.local([0, 0, 6]); this.dir = to.clone().sub(this.pos).normalize(); this.to = to; }
  update(dt) {
    const G = this.G, g = this.L.g; this.t += dt;
    if (this.phase === 'form') { this.aim(); const k = Math.min(1, this.t / 0.55); g.scale.setScalar(0.01 + k); g.position.copy(this.pos).addScaledVector(this.dir, -2.6); g.quaternion.setFromUnitVectors(new V3(0, 0, 1), this.dir); this.L.mats[0].opacity = 0.85 * k;
      for (let i = 0; i < 2; i++) { const p = g.position.clone().add(new V3(rand(-2, 2), rand(-1.5, 1.5), rand(-2, 2))); const v = g.position.clone().sub(p).multiplyScalar(3); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.12, size1: 0.02, life: 0.33, color: i ? HOLY : HOLY2, alpha: 0.9 }); }
    } else if (this.phase === 'fly') { const k = Math.min(1, this.t / 0.22); g.position.lerpVectors(this.flyFrom, this.flyTo, k * k); G.fx.p(g.position.clone().addScaledVector(this.dir, 4.5), { size: 1.6, size1: 0.3, life: 0.2, color: HOLY, alpha: 0.7 }); if (k >= 1) { this.phase = 'stuck'; this.t = 0; } }
    else if (this.phase === 'stuck') { this.L.mats[0].opacity = 0.85 * Math.max(0, 1 - this.t / 1.6); this.L.mats[1].opacity = 0.7 * Math.max(0, 1 - this.t / 1.6); if (this.t > 1.6) this.kill(); }
  }
  launch() { if (this.phase !== 'form') return; this.phase = 'fly'; this.t = 0; this.aim(); this.flyFrom = this.L.g.position.clone(); this.flyTo = this.to.clone().addScaledVector(this.dir, -4.6); }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.L.g); for (const m of this.L.mats) m.dispose(); for (const g of this.L.geos) g.dispose(); }
}
// 빛의 기둥 (광휘의 축복 · 궁극기)
function pillar(G, c, r = 1.2, h = 16, life = 1) { G.fx.beam(c, { r, h, color: HOLY, life }); G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.3, r1: r * 2.6, life: 0.6, color: HOLY }); G.fx.light(c.clone().setY(c.y + 1.2), HOLY, 120, 0.6, 16); }
// 축복: 시전자 포함 주위 아군의 공격력 · 체력 상승 (12초) + 즉시 회복
function bless(f, G) {
  const allies = (G.fighters || [f]).filter((t) => t.team === f.team && t.state !== 'ko' && !t.gone && Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) < 10);
  for (const t of allies) {
    t.addStatus('atk', 12, 1.3, f); t.addStatus('regen', 12, 14, f); t.addStatus('vuln', 12, 0.8, f);
    t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.08); pillar(G, t.pos.clone(), 0.9, 14, 0.9); motes(G, t.chest(new V3()), 30, 2, 2.5);
  }
}

/* =====================================================================
   기술 — 창술 수호 사제: 찌르기 · 쓸기 · 도약 내려찍기 · 빛의 창 · 축복
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 창을 치켜들었다가 수직으로 내리꽂아 금빛 균열 --- */
  ...makePlunge({
    up: { ...poses.raised, weapon: [0.4, 0, 0] },
    fall: { ...poses.raised, spine: [0.3, 0, 0], head: [0.1, 0, 0], shoulderR: [-1.7, 0, -0.1], elbowR: [-0.3, 0, 0], weapon: [-1.45, 0, 0], shoulderL: [-1.6, 0, 0.1] },
    land: 'pierce', color: HOLY, dmg: 74, r: 2.5,
    fx: (f, o, G, c) => { cracks(G, c, 2.8, 9); motes(G, c.clone().setY(c.y + 0.3), 20, 4); crossFlash(G, c.clone().setY(c.y + 0.8), 1.4); },
  }),

  /* --- 기본 공격: 찌르기 → 가로 쓸기 → 이연 찌르기 → 회전 쓸어 올리기 --- */
  light1: { dur: 0.42, cancel: 0.2, next: 'light2', trail: true, track: 0.1,
    keys: [[0, 'poise'], [0.08, 'poise'], [0.15, 'stab'], [0.26, {}], [0.42, 'base']], lunge: [[0.08, 0.17, 8]],
    ev: [[0.08, () => sfx('swing')], [0.13, (f, o, G) => { thrustLine(G, f.local([0, 1.15, 1.2]), f.local([0, 1.15, 2.6]), 0.6); }]],
    hits: [{ t0: 0.1, t1: 0.2, dmg: 32, kb: [2.4, 0], stun: 0.36, daze: 11 }] },
  light2: { dur: 0.5, cancel: 0.26, next: 'light3', trail: true, track: 0.08, ikOff: true,
    keys: [[0, 'sweepR'], [0.1, { chest: [0.02, -0.55, 0], weapon: [0.1, 2.05, 1.57] }], [0.22, 'sweepL'], [0.32, {}], [0.5, 'base']], lunge: [[0.08, 0.2, 5]],
    ev: [[0.1, () => sfx('swing')], [0.14, (f) => goldSlash(f, { tilt: 0.05, r: 2.6 })]],
    hits: [{ t0: 0.1, t1: 0.24, dmg: 38, kb: [2.6, 0], stun: 0.4, daze: 12 }] },
  light3: { dur: 0.54, cancel: 0.32, next: 'light4', trail: true, track: 0.12,
    keys: [[0, 'poise'], [0.06, 'stab'], [0.16, 'poise'], [0.24, { ...poses.stab, weapon: [0.06, 0.04, 0] }], [0.36, {}], [0.54, 'base']], lunge: [[0.04, 0.12, 6], [0.2, 0.28, 6]],
    ev: [[0.04, () => sfx('swing')], [0.2, () => sfx('swing')], [0.07, (f, o, G) => thrustLine(G, f.local([0, 1.15, 1.2]), f.local([0, 1.15, 2.6]), 0.6)], [0.25, (f, o, G) => thrustLine(G, f.local([0.05, 1.2, 1.2]), f.local([0.05, 1.2, 2.7]), 0.7)]],
    hits: [{ t0: 0.03, t1: 0.11, dmg: 22, kb: [1.4, 0], stun: 0.38, daze: 8 }, { t0: 0.2, t1: 0.29, dmg: 26, kb: [2.4, 0], stun: 0.42, daze: 9 }] },
  // 4타 · 성광 연창: 제자리에서 여섯 번 빠르게 찌른 뒤 창끝에 빛을 모아 십자 폭발
  light4: { dur: 0.8, track: 0.5, aim: true, noMove: true,
    keys: [[0, 'poise'], ...[0, 1, 2, 3, 4, 5].flatMap((i) => [[0.06 + i * 0.07, { ...poses.stab, weapon: [0.04 * ((i % 3) - 1), 0.06 * ((i % 2) * 2 - 1), 0] }], [0.095 + i * 0.07, 'poise']]),
      [0.5, 'poise'], [0.58, { ...poses.stab, spine: [0.5, 0.3, 0] }], [0.66, {}], [0.8, 'base']],
    lunge: [[0.54, 0.62, 7]],
    start: (f) => holy(f, 0.6),
    ev: [...[0, 1, 2, 3, 4, 5].map((i) => [0.06 + i * 0.07, (f, o, G) => { sfx('swing'); const y = 1.05 + 0.12 * ((i % 3) - 1), x = 0.12 * ((i % 2) * 2 - 1); thrustLine(G, f.local([x, y, 1.1]), f.local([x, y, 2.5]), 0.45); }]),
      [0.46, (f, o, G) => { holy(f, 1); motes(G, f.local([0, 1.15, 2.2]), 12, 2); sfx('charge'); }],
      [0.6, (f, o, G) => { sfx('heavy'); crossFlash(G, f.local([0, 1.15, 2.3]), 1.1); motes(G, f.local([0, 1.15, 2.3]), 16, 4); }], [0.7, (f) => holy(f, 0)]],
    hits: [...[0, 1, 2, 3, 4, 5].map((i) => ({ t0: 0.06 + i * 0.07, t1: 0.1 + i * 0.07, weapon: false, at: [0, 1.1, 1.8], r: 0.55, dmg: 8 })), { t0: 0.58, t1: 0.66, weapon: false, at: [0, 1.15, 2.2], r: 0.9, dmg: 36 }],
    end: (f) => holy(f, 0) },

  /* --- 우클: 세라픽 피어스 — 도약해 전방의 지면을 창으로 내려찍어 넓은 범위에 금빛 충격파 --- */
  heavy: { dur: 1.05, cd: 'heavy', aim: true, track: 0.1, noMove: true, shout: true,
    keys: [[0, { ...poses.poise, hipY: -0.1, kneeL: [1.1, 0, 0], kneeR: [0.9, 0, 0] }], [0.12, { ...poses.raised, weapon: [0.5, 0, 0] }], [0.36, { ...poses.raised, weapon: [-0.6, 0, 0] }], [0.46, 'pierce'], [0.82, 'pierce'], [1.05, 'base']],
    start: (f, o, G) => { f.empPierce = rad(f) >= 100; if (f.empPierce) { f.radiance = 0; G.say(f, '"빛이여, 두 번 울려라!"'); } else G.say(f, '"세라픽 피어스!"'); holy(f, 1); sfx('charge');
      const fw = f.fwd(new V3()); let L = 4.2; if (o && !o.gone && o.state !== 'ko') { const to = new V3().subVectors(o.pos, f.pos).setY(0), d = to.length(); if (d < 8 && to.normalize().dot(fw) > 0.4) L = Math.max(0.5, d - 1.5 * o.scale); }
      f.leapFrom = f.pos.clone(); f.leapTo = f.pos.clone().addScaledVector(fw, L); },
    tick: (f, o, G, t) => {
      if (t > 0.12 && t < 0.46 && f.leapFrom) { const k = (t - 0.12) / 0.34; f.float = true; f.onGround = false; f.vel.set(0, 0, 0); f.pos.lerpVectors(f.leapFrom, f.leapTo, k); f.pos.y = f.leapFrom.y + Math.sin(k * Math.PI) * 2.2 * (1 - 0.35 * k);
        G.fx.p(f.chest(new V3()), { size: 0.7, size1: 0.15, life: 0.25, color: HOLY, alpha: 0.5 }); }
    },
    ev: [[0.12, () => { sfx('jump'); sfx('dash'); }],
      [0.46, (f, o, G) => { f.float = false; if (f.leapTo) { f.pos.x = f.leapTo.x; f.pos.z = f.leapTo.z; f.pos.y = f.leapFrom.y; } f.vel.set(0, 0, 0);
        const c = f.local([0, 0, 1.5 * f.scale]); c.y = f.pos.y + 0.05; sfx('boom'); sfx('heavy'); G.shake(0.45); G.flash(0xfff0c0, 0.3); G.hitstop = Math.max(G.hitstop || 0, 0.06);
        cracks(G, c, 3.6, 13); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 4.2, life: 0.5, color: HOLY }); G.fx.ring(c, { normal: UP, r0: 0.2, r1: 2.6, life: 0.35, color: 0xffffff });
        G.fx.burst(c.clone().setY(c.y + 0.4), 50, GOLDS, 11, { dir: UP, spread: 1.1 }); G.fx.burst(c, 24, 0x7a6a60, 6, { kind: 'dust', sk: 1.8 }); G.fx.light(c.clone().setY(c.y + 1), HOLY, 150, 0.5, 16); G.fx.beam(c, { r: 0.6, h: 8, color: HOLY, life: 0.4 });
        motes(G, c, 24, 4, 2);
        areaHit(f, c, 3.2 * f.scale, { dmg: 92, kb: [4.5, 6.5], stun: 0.7, hs: 0.12, shake: 0.2, daze: 42, snd: 'big' }, 1.4); }],
      [0.74, (f, o, G) => { if (!f.empPierce) return; const c = f.local([0, 0, 1.5 * f.scale]); c.y = f.pos.y + 0.05; sfx('boom'); sfx('zap'); G.shake(0.35); G.flash(HOLY2, 0.25);
        G.fx.ring(c, { normal: UP, r0: 1, r1: 5.8, life: 0.55, color: HOLY2 }); cracks(G, c, 5, 15, HOLY2); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; G.fx.beam(c.clone().add(new V3(Math.cos(a) * 3, 0, Math.sin(a) * 3)), { r: 0.3, h: 6, color: HOLY, life: 0.4 }); }
        areaHit(f, c, 4.6 * f.scale, { dmg: 54, kb: [5, 8], stun: 0.7, hs: 0.1, daze: 30, noCrit: true, snd: 'big' }, 2); }],
      [0.85, (f) => holy(f, 0)]],
    end: (f) => { f.float = false; holy(f, 0); f.leapFrom = null; } },

  /* --- Shift: 루미너스 런스 — 창에 빛을 모아 전방으로 내질러 길게 꿰뚫는 빛의 창 --- */
  s1: { dur: 0.88, cd: 's1', aim: true, track: 0.3, noMove: true, trail: true,
    keys: [[0, 'poise'], [0.26, { ...poses.poise, chest: [0.04, -0.45, 0], shoulderR: [0.6, 0, -0.28] }], [0.34, 'stab'], [0.6, {}], [0.88, 'base']], lunge: [[0.3, 0.4, 10]],
    start: (f, o, G) => { holy(f, 1); sfx('charge'); G.say(f, '"루미너스 런스!"'); },
    tick: (f, o, G, t) => { if (t < 0.3) { const tip = f.model.tipPos(new V3()); for (let i = 0; i < 2; i++) { const p = tip.clone().add(new V3(rand(-0.7, 0.7), rand(-0.5, 0.7), rand(-0.7, 0.7))), v = tip.clone().sub(p).multiplyScalar(4); G.fx.p(p, { vel: [v.x, v.y, v.z], size: 0.09, size1: 0.03, life: 0.24, color: i ? HOLY : HOLY2, alpha: 0.9 }); } } },
    ev: [[0.34, (f, o, G) => { sfx('shot'); sfx('heavy'); sfx('zap'); G.shake(0.2); G.flash(HOLY2, 0.15); const fw = f.fwd(new V3()), from = f.local([0, 1.15, 0.9]); G.spawn(new LuminousLance(G, f, from, fw, 7.5 * f.scale, 96, rad(f) >= 100)); }],
      [0.6, (f) => holy(f, 0)]],
    hits: [{ t0: 0.3, t1: 0.42, dmg: 24, kb: [1.5, 0], stun: 0.4, daze: 10 }],
    end: (f) => holy(f, 0) },

  /* --- E: 광휘의 축복 — 3초 동안 정신을 집중(피해 감소 · 경직 무시)한 뒤 자신과 아군의 공격력 · 체력 상승 --- */
  s2: { dur: 3.35, cd: 's2', aim: false, noMove: true, shout: true,
    keys: [[0, { ...poses.pray, head: [0, 0, 0], weapon: [1.4, 0.1, 0] }], [0.3, 'pray'], [2.9, 'pray'], [3.05, { ...poses.skyward, shoulderL: [-2.7, 0, 0.3], elbowL: [-0.3, 0, 0] }], [3.35, 'base']],
    start: (f, o, G) => { holy(f, 0.6); sfx('charge'); G.say(f, '"빛이여, 우리를 지켜주소서."'); f.prayT = 0; },
    onHit: (f, att, h) => { f.G.fx.burst(f.chest(new V3()), 10, GOLDS, 4); return { dmgK: 0.6, armor: true }; },
    tick: (f, o, G, t, dt) => {
      if (t < 3.0) { f.holyK = 0.5 + 0.5 * (t / 3);
        const c = f.pos.clone(), n = 1 + Math.floor(t * 1.2); for (let i = 0; i < n; i++) { const a = rand(0, TAU), R = rand(0.4, 1.4); G.fx.p(c.clone().add(new V3(Math.cos(a) * R, rand(0, 0.3), Math.sin(a) * R)), { vel: [0, rand(1.5, 3.5), 0], size: rand(0.05, 0.1), size1: 0.02, life: 0.9, color: i % 2 ? HOLY : HOLY2, alpha: 0.9, drag: 0.5 }); }
        f.prayT = (f.prayT || 0) + dt; if (f.prayT > 0.5) { f.prayT = 0; G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 2.4, r1: 0.3, life: 0.5, color: HOLY }); sfx('charge'); }
      }
    },
    ev: [[3.0, (f, o, G) => { sfx('zap'); sfx('boom'); G.flash(HOLY2, 0.3); G.stage.flashSky && G.stage.flashSky(0.25); pillar(G, f.pos.clone(), 1.5, 20, 1.2); bless(f, G); holy(f, 1); G.say(f, '"광휘의 축복을."'); }],
      [3.3, (f) => holy(f, 0)]],
    end: (f) => holy(f, 0) },

  /* --- 극한 회피 뒤 좌클: 섬광 찌르기 — 상대 옆으로 빛처럼 미끄러져 들어가 꿰뚫는다 --- */
  counter: { dur: 0.6, trail: true, aim: true,
    keys: [[0, 'poise'], [0.07, 'stab'], [0.36, {}], [0.6, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest(); if (o) { const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(), side = new V3(d.z, 0, -d.x).multiplyScalar(0.9); f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(d, 2.2 + 0.4 * o.scale).add(side); f.faceOpp(); }
      for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.chest(), i / 8), { size: 0.9, size1: 0.2, life: 0.3, color: HOLY, alpha: 0.7 }); sfx('dash'); G.flash(HOLY, 0.2); f.model.resetCloth(); holy(f, 1);
    }], [0.06, (f, o, G) => { sfx('heavy'); sfx('zap'); const p = f.local([0, 1.15, 2.2]); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.6, life: 0.3, color: HOLY }); crossFlash(G, p, 1.2); }], [0.4, (f) => holy(f, 0)]],
    hits: [{ t0: 0.05, t1: 0.2, dmg: 94, kb: [7, 3], stun: 0.6, hs: 0.14, shake: 0.18, daze: 42, snd: 'big', br: 0.22 }],
    end: (f) => holy(f, 0) },

  /* --- Q: 천상의 심판 — 빛의 날개를 펼치고 떠올라, 하늘에 만든 거대한 빛의 창을 대상에게 내리꽂는다 --- */
  ult: { dur: 3.4, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, 'skyward'], [0.9, { ...poses.skyward, hipL: [-0.5, 0, 0.12], kneeL: [0.9, 0, 0], hipR: [-0.2, 0, -0.12], kneeR: [1.1, 0, 0] }], [1.05, 'hurl'], [1.4, 'hurl'],
      [1.75, { ...poses.raised, weapon: [-0.4, 0, 0] }], [2.35, { ...poses.raised, weapon: [-0.4, 0, 0] }], [2.5, 'pierce'], [3.0, 'pierce'], [3.4, 'win']],
    cam: [[0, { ref: 'self', p: [1.0, 0.8, 2.6], l: [0, 1.2, 0], fov: 40 }], [0.9, { ref: 'self', p: [2.6, 0.2, 3.4], l: [0, 2.6, 0], fov: 50 }],
      [1.2, { ref: 'target', p: [4.5, 1.2, -3.5], l: [0, 1.4, 0], fov: 56 }], [2.3, { ref: 'target', p: [-4, 2.0, -4.2], l: [0, 1.4, 0], fov: 54 }],
      [2.6, { ref: 'target', p: [-1.8, 1.6, -5.5], l: [0, 1.3, 0], fov: 52 }], [3.4, { ref: 'target', p: [-2.2, 2.4, -7], l: [0, 1.8, 0], fov: 56 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(HOLY, 0.3); holy(f, 1); sfx('charge'); G.say(f, '"하늘이여, 심판의 창을."');
        f.ultWings = new LightWings(G, f, 3.3); G.spawn(f.ultWings); f.ultFrom = f.pos.clone(); motes(G, f.chest(new V3()), 30, 2, 2); G.fx.light(f.chest(new V3()), HOLY, 100, 0.6); }],
      [0.35, (f, o, G) => { o = f.ultTgt || o; f.ultLance = new JudgementLance(G, f, o); G.spawn(f.ultLance); sfx('zap'); }],
      [1.05, (f, o, G) => { if (f.ultLance) f.ultLance.launch(); sfx('shot'); sfx('dash'); G.say(f, '"심판하라!"'); }],
      [1.28, (f, o, G) => { o = f.ultTgt || o; if (!o) return; const c = o.pos.clone().setY(0);
        sfx('boom'); sfx('big'); G.shake(0.6); G.flash(0xfff4d0, 0.7); G.stage.flashSky && G.stage.flashSky(0.6);
        pillar(G, c, 2.0, 30, 1.4); cracks(G, c, 6, 16); G.fx.ring(c.clone().setY(0.06), { normal: UP, r0: 0.5, r1: 8.5, life: 0.8, color: HOLY }); G.fx.burst(c.clone().setY(1), 110, GOLDS, 16, { lk: 1.4 }); G.fx.burst(c, 40, 0x7a6a60, 8, { kind: 'dust', sk: 2.2 });
        o.takeHit(f, { dmg: 130, kb: [0, 0], stun: 99, hs: 0.2, shake: 0.5, nokill: true, noScale: true, force: true, daze: 100, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) t.takeHit(f, { dmg: 100, kb: [6, 8], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
        // 대상 앞으로 내려앉을 자리
        const d = new V3().subVectors(f.pos, o.pos).setY(0); if (d.lengthSq() < 0.01) d.set(0, 0, -1); d.normalize(); f.ultLand = o.pos.clone().setY(0).addScaledVector(d, 1.9 * o.scale); f.ultAir = f.pos.clone(); }],
      [2.5, (f, o, G) => { o = f.ultTgt || o; if (!o) return; f.float = false; f.onGround = true; if (f.ultLand) { f.pos.copy(f.ultLand); f.faceOpp(); } f.vel.set(0, 0, 0); f.model.resetCloth();
        o.release(); sfx('boom'); sfx('heavy'); sfx('big'); G.say(f, '"…아멘."'); G.flash(0xffffff, 0.55); G.shake(0.55);
        const c = o.pos.clone().setY(0); pillar(G, c, 2.6, 40, 1.0); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; G.fx.beam(c.clone().add(new V3(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2)), { r: 0.4, h: 12, color: HOLY, life: 0.6 }); }
        crossFlash(G, o.chest(new V3()), 2.6); G.fx.light(c.clone().setY(1.5), HOLY, 220, 0.9, 24); motes(G, c.clone().setY(1), 60, 6, 3);
        o.takeHit(f, { dmg: 170, kb: [4.5, 12], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) t.takeHit(f, { dmg: 110, kb: [6, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
        G.slow(0.35, 0.5); }],
    ],
    tick: (f, o, G, t, dt) => {
      // 떠오르기 (0.15 ~ 0.95초) → 공중에 머묾 → 내려앉기 (1.75 ~ 2.5초)
      if (t > 0.15 && t < 1.75 && f.ultFrom) { const k = Math.min(1, (t - 0.15) / 0.8); f.float = true; f.onGround = false; f.vel.set(0, 0, 0); f.pos.x = f.ultFrom.x; f.pos.z = f.ultFrom.z; f.pos.y = f.ultFrom.y + (1 - (1 - k) ** 3) * 3.6 + 0.08 * Math.sin(t * 6); f.faceOpp(); }
      if (t >= 1.75 && t < 2.5 && f.ultLand && f.ultAir) { const k = (t - 1.75) / 0.75, kk = k * k; f.float = true; f.pos.x = f.ultAir.x + (f.ultLand.x - f.ultAir.x) * k; f.pos.z = f.ultAir.z + (f.ultLand.z - f.ultAir.z) * k; f.pos.y = (f.ultAir.y + 0.08) * (1 - kk) + 0.0 * kk; f.faceOpp(); G.fx.p(f.chest(new V3()), { size: 0.7, size1: 0.15, life: 0.25, color: HOLY, alpha: 0.5 }); }
      // 빛의 창에 꽂힌 동안: 대상 주위로 빛의 십자가 연달아 (작은 피해)
      const tg = f.ultTgt; if (tg && t > 1.4 && t < 2.4) { f.ultAcc = (f.ultAcc || 0) + dt; while (f.ultAcc >= 0.2) { f.ultAcc -= 0.2; const p = tg.chest(new V3()).add(new V3(rand(-0.6, 0.6), rand(-0.5, 0.6), rand(-0.6, 0.6))); crossFlash(G, p, 0.9); sfx('zap'); tg.takeHit(f, { dmg: 10, kb: [0, 0], stun: 99, hs: 0.01, nokill: true, noScale: true, force: true, noCrit: true, daze: 8, snd: 'hit' }, new V3(0, 0, 1)); } }
    },
    end: (f, o, G) => { G.setTint(0, 0); holy(f, 0); f.float = false; f.ultAcc = 0; if (f.ultWings) { f.ultWings.kill(); f.ultWings = null; } const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, HOLY, big ? 1.7 : 1.0, dir);
  if (big) crossFlash(G, p, 1.3); else G.fx.slash(p.clone().addScaledVector(dir, -0.25), { fwd: dir, normal: new V3(rand(-0.3, 0.3), 1, rand(-0.3, 0.3)).normalize(), r: 1.0, color: HOLY2, life: 0.18 });
  motes(G, p, big ? 10 : 4, 3, 1);
  // 성광: 맞힐 때마다 쌓인다 (가득 차면 다음 세라픽 피어스가 두 겹 파동 · 루미너스 런스가 굵어진다)
  att.radiance = Math.min(100, (att.radiance || 0) + h.dmg * 0.32);
}

// 성광 · 축복 상태 → 창 빛 · 고유 게이지 / 기술 쿨타임 회복 (축복 중 빠르게)
function createModelWithRadiance(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    const blessed = f.stK('atk') > 1;
    f.cdMul = blessed ? 1.15 : 1;
    if (rad(f) >= 100 && f.root.visible && !m.weaponOut && Math.random() < 0.35) { const p = m.tipPos(new V3()); f.G.fx.p(p, { vel: [0, 0.6, 0], size: 0.1, size1: 0.02, life: 0.45, color: HOLY2, alpha: 0.9, drag: 1 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist > 2.5 && dist < 6.5 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist > 2.5 && dist < 8 && f.cd.s1 <= 0 && Math.random() < 0.35) return 's1';
  if ((dist > 7 || f.hp < f.maxHp * 0.55) && f.cd.s2 <= 0 && !(f.stK('atk') > 1) && Math.random() < 0.3) return 's2';
  return null;
}

export default {
  id: 'lancer', name: '세라', short: '세라', title: 'LANCER · 수호 사제', scale: 1.0,
  desc: '근·중거리 · 창술 · 수호. 성스러운 빛을 다루는 수호 사제. 긴 은빛 창으로 찌르고 쓸어내며, 도약해 땅을 내려찍는 세라픽 피어스와 길게 꿰뚫는 빛의 창 루미너스 런스로 싸운다. 광휘의 축복으로 자신과 아군의 공격력과 체력을 끌어올린다.',
  stats: { hp: 1000, speed: 7.4, jump: 10, crit: 0.22 },
  palettes: [{ accent: HOLY, holy: HOLY, band: '#2a2208' }, { accent: 0x7ab8ff, holy: 0x7ab8ff, band: '#0a1a2a' }],
  skills: { heavy: { name: '세라픽 피어스', cd: 8 }, s1: { name: '루미너스 런스', cd: 9 }, s2: { name: '광휘의 축복', cd: 24 }, ult: { name: '천상의 심판', sub: 'HEAVENLY JUDGEMENT' } },
  aiPick, aimRange: 11,
  resource: (f) => rad(f) >= 100 ? { v: 1, label: '성광', color: 0xfff0b0, full: true } : { v: rad(f) / 100, label: '성광', color: 0xd8a830 },
  onReset: (f) => { f.radiance = 0; f.holyK = 0; f.float = false; f.leapFrom = null; f.empPierce = false; f.ultTgt = null; f.ultWings = null; f.ultLance = null; f.ultAcc = 0; },
  moveList: [['좌클 ×4', '찌르기 32 → 가로 쓸기 38 → 이연 찌르기(22 · 26) → 성광 연창: 여섯 번 빠른 찌르기 8×6 → 빛의 십자 폭발 36'], ['공중 좌클', '창을 수직으로 내리꽂아 금빛 균열 74'],
    ['우클 · 세라픽 피어스', '도약 후 전방의 지면을 내려찍어 반경 3.2m 충격파 92. 성광이 가득 차면 두 번째 파동 54 (반경 4.6m)'], ['Shift · 루미너스 런스', '창에 빛을 모아 내질러 7.5m 앞까지 꿰뚫는 빛의 창 96 (관통)'],
    ['E · 광휘의 축복', '3초 정신 집중(받는 피해 40%↓ · 경직 무시) 후 본인 포함 주위 아군: 공격력 ×1.3 · 받는 피해 ×0.8 · 초당 14 회복 (12초) + 즉시 8% 회복'],
    ['Q · 천상의 심판', '빛의 날개를 펼치고 떠올라 거대한 빛의 창을 내리꽂는다 130 → 빛의 십자 연타 → 내려앉으며 심판 170'],
    ['성광', '맞힐수록 쌓이고 가득 차면 다음 세라픽 피어스가 두 겹 파동, 루미너스 런스가 굵어짐'], ['C (타이밍) · 극한 회피', '섬광 찌르기: 상대 옆으로 미끄러져 들어가 꿰뚫기 94'], ['가만히', '창을 세워 짚고 무릎을 꿇어 기도']],
  createModel: createModelWithRadiance, poses, moves, hitFx,
};
