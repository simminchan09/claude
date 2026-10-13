// 단비 (MUDANG · 경계의 무당) — 중거리 · 의식 술사 · 근접 견제
// "기억과 경계의 의식을 치르는 현대 무당." 방울을 흔들고 부적을 붙이며, 까치를 부리고 지전 결계로 홀린다.
// 무기: 무구 방울 + 오색 천 — 부적(붙었다가 터지며 약화) · 까치(연속 급강하) · 지전 결계(최면) · 굿(산신 호랑이)
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, talismanTex, GOLDB, REDM, TEAL, PAPER, OBANG } from './mudang_model.js';
import { makePlunge } from '../plunge.js';
import { loft, strand, surf, lathe, smooth } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const RANGE = 16; // 조준 거리
const SPIRIT = [GOLDB, PAPER, 0xffffff];

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   ===================================================================== */
const LEGS_L = { hipL: [-0.7, 0, 0.12], kneeL: [0.75, 0, 0], hipR: [0.45, 0, -0.12], kneeR: [0.3, 0, 0] };
const poses = {
  // 기본: 방울을 오른손에 세워 들고, 왼손은 가볍게 내림 — 무표정하게 상대를 응시
  base: { hips: [0, 0.15, 0], spine: [0.03, -0.08, 0], chest: [0.02, -0.06, 0], head: [0.04, 0.08, 0],
    shoulderR: [-0.45, 0, -0.24], elbowR: [-0.95, 0, 0], weapon: [1.15, 0.25, 0], shoulderL: [0.05, 0, 0.22], elbowL: [-0.45, 0, 0],
    hipL: [-0.1, 0, 0.04], kneeL: [0.18, 0, 0], footL: [-0.08, 0, 0], hipR: [0.08, 0, -0.05], kneeR: [0.1, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.08, 0], spine: [0.24, 0.04, 0], chest: [0.04, 0.04, 0], head: [-0.12, 0, 0], shoulderR: [-0.5, 0, -0.35], elbowR: [-1.1, 0, 0], weapon: [0.9, 0.6, 0], shoulderL: [0.1, 0, 0.32], elbowL: [-0.9, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.2, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.2, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.3, 0, 0], kneeR: [1.4, 0, 0], footR: [0.4, 0, 0], shoulderL: [-0.6, 0, 0.8], elbowL: [-0.6, 0, 0], weapon: [0.9, 0.5, 0] },
  // 방어: 방울을 가로로 앞에 대고 왼손 부적을 세운다
  guard: { hips: [0, -0.15, 0], spine: [0.12, 0.08, 0], chest: [0.04, 0.08, 0], shoulderR: [-1.1, 0, -0.15], elbowR: [-1.3, 0, 0], weapon: [0.15, -1.45, 0], shoulderL: [-1.35, 0, 0.2], elbowL: [-0.9, 0, 0],
    hipL: [-0.45, 0, 0.18], kneeL: [0.8, 0, 0], hipR: [0.3, 0, -0.18], kneeR: [0.6, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.55], elbowR: [-0.6, 0, 0], weapon: [1.1, 0.6, 0.4], shoulderL: [0.4, 0, 0.75], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.6, 1.2, 0.6], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.7, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.55], shoulderL: [-2.2, 0, 0.65], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -0.6, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.45, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.5, 0, -0.35], elbowR: [-0.6, 0, 0], weapon: [0.3, 2.6, 0.3], shoulderL: [0.7, 0, 0.35], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 방울을 높이 들어 한 번 흔들고, 왼손은 가슴 앞에 모은다
  win: { hips: [0, 0.2, 0], spine: [-0.04, 0.12, 0], chest: [-0.04, 0.1, 0], head: [0.1, -0.2, 0], shoulderR: [-2.7, 0, -0.3], elbowR: [-0.35, 0, 0], weapon: [1.45, 0.2, 0],
    shoulderL: [-0.9, 0, 0.3], elbowL: [-1.7, 0, 0], hipL: [-0.08, 0, 0.06], kneeL: [0.12, 0, 0], hipR: [0.12, 0, -0.06], kneeR: [0.15, 0, 0] },
  portrait: { hips: [0, 0.15, 0], chest: [0, -0.15, 0], head: [0.04, 0.12, 0], shoulderR: [-1.3, 0, -0.35], elbowR: [-1.35, 0, 0], weapon: [1.35, 0.15, 0], shoulderL: [-0.4, 0, 0.3], elbowL: [-1.3, 0, 0] },
  // 오른쪽으로 감은 방울 → 왼쪽으로 후려침
  windR: { hips: [0, -0.4, 0], spine: [0.08, -0.35, 0], chest: [0, -0.35, 0], head: [0, 0.55, 0], shoulderR: [-1.0, 0, -0.85], elbowR: [-0.75, 0, 0], weapon: [0.45, 2.0, 0], shoulderL: [-0.4, 0, 0.4], elbowL: [-1.1, 0, 0] },
  strikeL: { hips: [0, 0.45, 0], spine: [0.18, 0.4, 0], chest: [0.05, 0.45, 0], head: [0, -0.55, 0], shoulderR: [-1.35, 0, 0.4], elbowR: [-0.2, 0, 0], weapon: [0.3, -1.3, 0], shoulderL: [0.25, 0, 0.55], elbowL: [-0.6, 0, 0], ...LEGS_L },
  // 왼손 부적 따귀: 뒤로 젖혔다가 휘둘러 붙인다
  slapPrep: { hips: [0, 0.35, 0], spine: [0, 0.3, 0], chest: [0, 0.3, 0], head: [0, -0.35, 0], shoulderL: [-1.6, 0, 1.0], elbowL: [-1.6, 0, 0], shoulderR: [-0.3, 0, -0.45], elbowR: [-1.0, 0, 0], weapon: [1.0, 0.8, 0] },
  slap: { hips: [0, -0.4, 0], spine: [0.15, -0.35, 0], chest: [0.05, -0.35, 0], head: [0, 0.45, 0], shoulderL: [-1.45, 0, -0.25], elbowL: [-0.15, 0, 0], shoulderR: [-0.1, 0, -0.55], elbowR: [-0.8, 0, 0], weapon: [0.8, 1.4, 0], ...LEGS_L },
  // 두 팔을 벌리고 도는 자세 (오색 천이 휘날림)
  spin: { hips: [0, 0, 0], spine: [0.1, 0, 0], chest: [0.02, 0, 0], head: [0.05, 0, 0], shoulderR: [-1.4, 0, -1.15], elbowR: [-0.1, 0, 0], weapon: [0.05, 1.6, 0], shoulderL: [-0.4, 0, 1.25], elbowL: [-0.3, 0, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.7, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.6, 0, 0] },
  // 왼손으로 가리킴 (까치에게 명령)
  point: { hips: [0, 0.3, 0], spine: [0.05, 0.25, 0], chest: [0.02, 0.2, 0], head: [0, -0.4, 0], shoulderL: [-1.55, 0, 0.05], elbowL: [-0.08, 0, 0], shoulderR: [-0.7, 0, -0.45], elbowR: [-1.1, 0, 0], weapon: [1.3, 0.4, 0], ...LEGS_L },
  // 방울을 머리 위로 (흔들어 부른다)
  call: { hips: [0, 0, 0], spine: [-0.14, 0, 0], chest: [-0.1, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.85, 0, -0.2], elbowR: [-0.3, 0, 0], weapon: [1.5, 0, 0], shoulderL: [-1.2, 0, 0.6], elbowL: [-1.0, 0, 0],
    hipL: [-0.2, 0, 0.12], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 부적 던지기: 왼손을 머리 뒤로 → 앞으로 뿌림
  throwPrep: { hips: [0, 0.5, 0], spine: [-0.05, 0.45, 0], chest: [-0.05, 0.4, 0], head: [0, -0.6, 0], shoulderL: [-2.5, 0, 0.6], elbowL: [-1.4, 0, 0], shoulderR: [-0.5, 0, -0.5], elbowR: [-1.0, 0, 0], weapon: [1.0, 1.0, 0],
    hipL: [-0.3, 0, 0.1], kneeL: [0.4, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.3, 0, 0] },
  throw: { hips: [0, -0.45, 0], spine: [0.25, -0.4, 0], chest: [0.08, -0.4, 0], head: [0, 0.5, 0], shoulderL: [-1.55, 0, -0.25], elbowL: [-0.05, 0, 0], shoulderR: [0.2, 0, -0.55], elbowR: [-0.6, 0, 0], weapon: [0.6, 1.5, 0], ...LEGS_L },
  // 방울로 땅을 내리침
  slam: { hips: [0, -0.15, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.35, 0, 0], shoulderR: [-1.1, 0, -0.12], elbowR: [-0.1, 0, 0], weapon: [-1.25, 0, 0], shoulderL: [-0.6, 0, 0.55], elbowL: [-0.5, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.4, 0, 0] },
  // 굿: 방울을 높이 흔들며 좌우로 몸을 흔드는 춤
  danceA: { hips: [0, 0.45, 0.08], spine: [0, 0.3, 0.12], chest: [-0.05, 0.2, 0.05], head: [-0.2, -0.3, -0.1], shoulderR: [-2.7, 0, -0.45], elbowR: [-0.4, 0, 0], weapon: [1.4, 0.3, 0], shoulderL: [-0.5, 0, 1.15], elbowL: [-0.6, 0, 0],
    hipL: [-0.15, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.25, 0, -0.08], kneeR: [0.5, 0, 0], footR: [0.3, 0, 0] },
  danceB: { hips: [0, -0.45, -0.08], spine: [0, -0.3, -0.12], chest: [-0.05, -0.2, -0.05], head: [-0.2, 0.3, 0.1], shoulderR: [-1.9, 0, -1.1], elbowR: [-0.3, 0, 0], weapon: [1.2, 1.0, 0], shoulderL: [-2.4, 0, 0.5], elbowL: [-0.5, 0, 0],
    hipL: [0.25, 0, 0.08], kneeL: [0.5, 0, 0], footL: [0.3, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.35, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 방울을 내려 들고 고개를 갸웃, 왼손은 후드 끈을 만지작
  idle2: { hips: [0, 0.08, 0.04], spine: [0.08, 0, 0.03], chest: [0.04, 0, 0], head: [0.15, 0.2, 0.22],
    shoulderR: [-0.15, 0, -0.25], elbowR: [-0.5, 0, 0], weapon: [-0.4, 0.4, 0], shoulderL: [-0.75, 0, 0.12], elbowL: [-2.0, 0, 0],
    hipL: [-0.04, 0, 0.04], kneeL: [0.08, 0, 0], hipR: [0.15, 0, -0.04], kneeR: [0.45, 0, 0], footR: [0.25, 0, 0] },
});

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const shingi = (f) => f.shingi || 0;
const bellK = (f, k) => { f.bellK = k; };
const talK = (f, k) => { f.talK = k; };
// 흩날리는 종이 조각 (지전 · 부적)
function paper(G, p, n = 10, sp = 4, cols = [0xffffff, PAPER, 0xf4f2ea]) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.25, 0.25), rand(-0.25, 0.25), rand(-0.25, 0.25))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.07, 0.13), size1: 0.04, life: rand(0.5, 0.9), color: cols[i % cols.length], alpha: 0.95, drag: 2.5, grav: 1.5, flick: 0.3 }); }
// 방울 소리: 놋쇠 빛 고리
function bellRing(G, f, s = 1) { const p = f.model.bellPos(new V3()); sfx('block'); G.fx.ring(p, { r0: 0.05, r1: 0.7 * s, life: 0.25, color: GOLDB, billboard: true }); G.fx.burst(p, Math.round(6 * s), [GOLDB, 0xffffff], 2.5 * s, { lk: 0.6 }); }
const aimPt = (t, out = new V3()) => (t.hurt && t.hurt[0] ? out.copy(t.hurt[0].a).lerp(t.hurt[0].b, 0.45) : t.chest(out));
const alive = (t) => t && !t.gone && t.state !== 'ko';
function aimDir(f, from, spread = 0) {
  const o = f.opp, d = alive(o) && f.dist() < RANGE ? aimPt(o).sub(from).normalize() : f.fwd(new V3()).add(new V3(0, -0.04, 0)).normalize();
  if (spread) d.applyAxisAngle(UP, spread); return d;
}
let _talTex = null; const talTexture = () => _talTex || (_talTex = talismanTex());

/* ---------- 부적: 날아가 붙었다가 터진다 (약화) ---------- */
let _talGeo = null;
class Talisman {
  constructor(G, f, from, dir) {
    this.G = G; this.f = f; this.pos = from.clone(); this.vel = dir.clone().multiplyScalar(19); this.t = 0; this.done = false; this.stuck = null; this.st = 0; this.hitSet = new Set();
    if (!_talGeo) _talGeo = new THREE.PlaneGeometry(0.14, 0.34);
    this.mat = new THREE.MeshStandardMaterial({ map: talTexture(), side: THREE.DoubleSide, emissive: 0xffd040, emissiveMap: talTexture(), emissiveIntensity: 0.6, roughness: 0.8, transparent: true });
    this.mesh = new THREE.Mesh(_talGeo, this.mat); this.mesh.frustumCulled = false; G.scene.add(this.mesh); this.mesh.position.copy(this.pos); this.off = new V3();
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt;
    if (this.stuck) {
      const t = this.stuck; this.st += dt;
      if (!alive(t)) return this.kill();
      t.chest(this.mesh.position).add(this.off); this.mesh.lookAt(G.camera.position); this.mesh.rotation.z += Math.sin(this.st * 30) * 0.05;
      const k = this.st / 1.0; this.mat.emissive.setHex(k > 0.5 ? 0xff3020 : 0xffd040); this.mat.emissiveIntensity = 0.6 + 2 * k * (0.5 + 0.5 * Math.sin(this.st * (10 + k * 30)));
      if (Math.random() < 0.6) G.fx.p(this.mesh.position, { vel: [rand(-0.5, 0.5), rand(0.5, 1.5), rand(-0.5, 0.5)], size: 0.08, size1: 0.02, life: 0.35, color: k > 0.5 ? REDM : GOLDB, alpha: 0.9, drag: 1 });
      if (this.st >= 1.0) this.burst();
      return;
    }
    const tg = f.opp; if (alive(tg) && this.t < 0.9) { const sp = this.vel.length(), d = aimPt(tg).sub(this.pos).normalize().multiplyScalar(sp); this.vel.lerp(d, 1 - Math.exp(-3 * dt)); }
    this.pos.addScaledVector(this.vel, dt); this.mesh.position.copy(this.pos); this.mesh.lookAt(this.pos.clone().add(this.vel)); this.mesh.rotateZ(this.t * 25);
    G.fx.p(this.pos, { size: 0.35, size1: 0.05, life: 0.18, color: GOLDB, alpha: 0.6, drag: 0 });
    for (const t of f.foes()) {
      if (this.hitSet.has(t) || !t.hurtHit(this.pos, 0.2)) continue; this.hitSet.add(t);
      const res = t.takeHit(f, { dmg: 20, kb: [0.6, 0], stun: 0.35, daze: 8, hs: 0.04, basic: false }, this.vel.clone().setY(0).normalize());
      if (res === 'hit') { this.stuck = t; this.off.set(rand(-0.12, 0.12), rand(-0.1, 0.25), 0); sfx('zap'); paper(G, this.pos, 6, 2); return; }
      if (res) return this.kill();
    }
    const W = G.stage && G.stage.world;
    if (this.t > 1.4 || this.pos.y < 0.05 || (W && W.solidAt(this.pos, 0.1))) { paper(G, this.pos, 8, 2); this.kill(); }
  }
  burst() {
    const G = this.G, f = this.f, t = this.stuck, c = this.mesh.position.clone(); this.kill();
    sfx('boom'); G.shake(0.16); G.fx.impact(c, REDM, 1.5); G.fx.ring(c, { r0: 0.2, r1: 2, life: 0.35, color: GOLDB, billboard: true }); paper(G, c, 18, 5, [PAPER, REDM, 0xffffff]); G.fx.light(c, 0xff6030, 80, 0.3);
    // 봉인: 부적이 터진 자리의 적은 받는 피해 ↑
    for (const o of f.foes()) { if (o !== t && o.pos.distanceTo(t.pos) > 1.8) continue; const r = o.takeHit(f, { dmg: 56, kb: [3, 4], stun: 0.6, hs: 0.1, shake: 0.15, daze: 26, snd: 'big', basic: false }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); if (r === 'hit') o.addStatus('vuln', 4, 1.15, f); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mat.dispose(); }
}

/* ---------- 까치: 흑백 날개 · 긴 꼬리 ---------- */
let _mg = null;
function magpieGeo() {
  if (_mg) return _mg;
  const body = lathe([[0, -0.15], [0.03, -0.12], [0.046, -0.05], [0.05, 0.01], [0.044, 0.06], [0.032, 0.09], [0, 0.11]], 16); body.rotateX(Math.PI / 2); body.scale(1, 0.9, 1);
  const belly = new THREE.SphereGeometry(1, 14, 10); belly.scale(0.044, 0.036, 0.07); belly.translate(0, -0.012, -0.02);
  const head = new THREE.SphereGeometry(0.036, 14, 10); head.translate(0, 0.022, 0.11);
  const beak = new THREE.ConeGeometry(0.011, 0.04, 8); beak.rotateX(Math.PI / 2); beak.translate(0, 0.018, 0.16);
  const tail = strand([[0, 0.005, -0.12], [0, 0.0, -0.24], [0, -0.01, -0.36]], 0.03, 0.022, { seg: 10, rad: 8, flat: 0.15, ref: [0, 1, 0] });
  const wing = surf((u, v, p) => { const ch = 0.13 * (1 - 0.55 * u) + 0.03 * Math.sin(u * Math.PI); p.set(u * 0.34, 0.02 * Math.sin(u * Math.PI) - 0.01 * u * u, 0.03 - ch * v + 0.03 * u); }, 12, 4);
  _mg = { body, belly, head, beak, tail, wing }; return _mg;
}
let _wingTex = null;
function wingTex() {
  if (_wingTex) return _wingTex;
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#14161e'; g.fillRect(0, 0, W, H); g.fillStyle = '#1e2a50'; g.fillRect(0, 0, W * 0.5, H * 0.4); // 안쪽: 푸른 윤기
  g.fillStyle = '#f4f4f2'; g.fillRect(W * 0.5, 0, W * 0.4, H * 0.85); // 바깥 깃: 흰색
  g.globalCompositeOperation = 'destination-out'; for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 8, H * 0.8); g.lineTo(x + 16, H); g.fill(); } // 깃 끝 갈라짐
  g.globalCompositeOperation = 'source-over'; _wingTex = new THREE.CanvasTexture(c); _wingTex.colorSpace = THREE.SRGBColorSpace; return _wingTex;
}
class Magpie {
  constructor(G, f, scale = 2.2) {
    this.G = G; this.f = f; this.done = false; this.t = 0; const g = magpieGeo();
    this.mats = [new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 0.35, metalness: 0.2, emissive: 0x0a1030, emissiveIntensity: 0.5, transparent: true }),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.6, emissive: 0x404048, emissiveIntensity: 0.4, transparent: true }),
      new THREE.MeshStandardMaterial({ map: wingTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, emissive: 0x202630, emissiveIntensity: 0.5, transparent: true })];
    const [bk, wh, wg] = this.mats; this.mesh = new THREE.Group(); this.mesh.scale.setScalar(scale); G.scene.add(this.mesh);
    for (const [geo, mt] of [[g.body, bk], [g.belly, wh], [g.head, bk], [g.beak, bk], [g.tail, bk]]) { const me = new THREE.Mesh(geo, mt); me.frustumCulled = false; this.mesh.add(me); }
    this.wings = [1, -1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.03, 0.02, 0.02); p.scale.set(s, 1, 1); const me = new THREE.Mesh(g.wing, wg); me.frustumCulled = false; p.add(me); this.mesh.add(p); return p; });
    this.pos = new V3(); this.vel = new V3();
  }
  flap(dt, rate = 16, amp = 0.8) { this.ph = (this.ph || 0) + dt * rate; this.wings.forEach((w) => { w.rotation.z = Math.sin(this.ph) * amp + 0.1; }); }
  face(dir) { const d = dir.clone(); if (d.lengthSq() < 1e-6) return; d.normalize(); this.mesh.position.copy(this.pos); this.mesh.lookAt(this.pos.clone().add(d)); }
  fade(k) { for (const m of this.mats) m.opacity = k; }
  trail() { if (Math.random() < 0.7) this.G.fx.p(this.pos, { vel: [rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3)], size: 0.3, size1: 0.05, life: 0.3, color: Math.random() < 0.5 ? 0x8aa0ff : 0xffffff, alpha: 0.4, drag: 1 }); }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); for (const m of this.mats) m.dispose(); if (this.f.magpie === this) { this.f.magpie = null; this.f.magpieT = 0; } }
}
// 기본공격 4타: 등 뒤에서 까치가 날아와 상대를 꿰뚫고 지나간다
class MagpieSwoop extends Magpie {
  constructor(G, f, from, to) { super(G, f, 2.0); this.pos.copy(from); this.dir = to.clone().sub(from); this.L = this.dir.length(); this.dir.normalize(); this.hit = new Set(); this.face(this.dir); paper(G, from, 8, 2, [0xffffff, 0x8aa0ff]); }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; if (this.t > 1.0) return this.kill();
    this.pos.addScaledVector(this.dir, 17 * dt); if (this.t > 0.55) this.pos.y += dt * 6; this.face(this.dir.clone().add(new V3(0, this.t > 0.55 ? 0.4 : 0, 0))); this.flap(dt, this.t < 0.5 ? 6 : 18, this.t < 0.5 ? 0.25 : 0.8); this.trail();
    this.fade(Math.min(1, this.t / 0.1, (1 - this.t) / 0.25));
    for (const t of f.foes()) if (!this.hit.has(t) && t.hurtHit(this.pos, 0.45)) { this.hit.add(t); if (t.takeHit(f, { dmg: 36, kb: [2, 0], stun: 0.4, daze: 12, basic: true }, this.dir.clone().setY(0).normalize())) { sfx('hit'); paper(G, this.pos, 10, 4, [0xffffff, 0x14161e, 0x8aa0ff]); } }
  }
}
// Shift: 까치 부르기 — 어깨 위를 맴돌다 상대에게 네 번 급강하
class MagpieFamiliar extends Magpie {
  constructor(G, f) { super(G, f, 2.2); this.life = 6; this.dives = 0; this.mode = 'hover'; this.mt = 0.5; f.magpie = this; f.magpieT = this.life; this.pos.copy(f.local([0.6, 2.2, -0.4])); this.hit = new Set(); }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; f.magpieT = Math.max(0, this.life - this.t);
    if (this.t > this.life || f.state === 'ko' || f.gone) return this.kill();
    this.fade(Math.min(1, this.t / 0.2, (this.life - this.t) / 0.3)); this.trail();
    const tg = f.opp;
    if (this.mode === 'hover') { this.mt -= dt;
      const a = this.t * 2.2, want = f.local([Math.cos(a) * 0.9, 2.3 + 0.2 * Math.sin(a * 2), -0.3 + Math.sin(a) * 0.6]); const d = want.clone().sub(this.pos);
      this.pos.addScaledVector(d, Math.min(1, dt * 4)); this.face(d.lengthSq() > 1e-4 ? d.setY(d.y * 0.3) : f.fwd(new V3())); this.flap(dt, 14, 0.7);
      if (this.mt <= 0 && this.dives < 4 && alive(tg) && f.dist() < 18) { this.mode = 'dive'; this.mt = 0; this.from = this.pos.clone(); this.hit.clear(); sfx('dash'); }
    } else if (this.mode === 'dive') {
      this.mt += dt; const k = Math.min(1, this.mt / 0.38), to = alive(tg) ? aimPt(tg) : this.from.clone().add(f.fwd(new V3()).multiplyScalar(5)), prev = this.pos.clone();
      this.pos.lerpVectors(this.from, to.clone().add(to.clone().sub(this.from).setY(0).normalize().multiplyScalar(0.8)), k * k); this.face(this.pos.clone().sub(prev)); this.flap(dt, 4, 0.15);
      if (alive(tg) && !this.hit.has(tg) && tg.hurtHit(this.pos, 0.5)) { this.hit.add(tg); if (tg.takeHit(f, { dmg: 18, kb: [1.4, 1.5], stun: 0.45, daze: 10, hs: 0.05, basic: false }, this.pos.clone().sub(prev).setY(0).normalize()) === 'hit') { tg.addStatus('slow', 1.5, 0.7, f); paper(G, this.pos, 10, 4, [0xffffff, 0x14161e, 0x8aa0ff]); } }
      if (k >= 1) { this.mode = 'up'; this.mt = 0; this.dives++; this.from = this.pos.clone(); }
    } else { // 다시 날아오름
      this.mt += dt; const want = f.local([0.6, 2.4, -0.3]), d = want.clone().sub(this.pos); this.pos.addScaledVector(d, Math.min(1, dt * 3)); this.pos.y += dt * 3 * (1 - this.mt); this.face(d); this.flap(dt, 18, 0.9);
      if (this.mt > 0.6) { this.mode = 'hover'; this.mt = 0.55; }
    }
  }
}

/* ---------- 지전 결계: 오색 소용돌이 원 + 흰 종이 술대 — 안의 적은 느려지고 홀린다 ---------- */
let _spiral = null, _streamTex = null;
function spiralTex() {
  if (_spiral) return _spiral;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2);
  const cols = ['#ff3a3a', '#ffb43a', '#f4f04a', '#3ae86a', '#3ab0ff', '#8a5aff'];
  for (let i = 0; i < 700; i++) { const t = i / 700, a = t * TAU * 6, r = t * S * 0.48; g.fillStyle = cols[Math.floor(t * 36) % 6]; g.globalAlpha = 0.85 * (1 - t * 0.5); g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 6 + 16 * t, 0, TAU); g.fill(); }
  g.globalAlpha = 1; g.strokeStyle = 'rgba(255,240,180,0.9)'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, S * 0.47, 0, TAU); g.stroke();
  _spiral = new THREE.CanvasTexture(c); _spiral.colorSpace = THREE.SRGBColorSpace; return _spiral;
}
function streamTex() { // 오려 낸 흰 종이 술 (지전)
  if (_streamTex) return _streamTex;
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#f8f6f0'; g.fillRect(0, 0, W, 40);
  for (let x = 4; x < W; x += 14) g.fillRect(x, 30, 9, H - 30 - (x % 28 ? 20 : 0));
  g.fillStyle = '#c8e8e0'; for (let y = 70; y < H; y += 60) { g.beginPath(); g.moveTo(W / 2, y - 12); g.lineTo(W / 2 + 10, y); g.lineTo(W / 2, y + 12); g.lineTo(W / 2 - 10, y); g.fill(); }
  _streamTex = new THREE.CanvasTexture(c); _streamTex.colorSpace = THREE.SRGBColorSpace; return _streamTex;
}
class SpiritCircle {
  constructor(G, f, c) {
    this.G = G; this.f = f; this.c = c.clone(); this.t = 0; this.life = 3.2; this.done = false; this.tick = 0.2; this.R = 2.6; this.hyp = false;
    this.mat = new THREE.MeshBasicMaterial({ map: spiralTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.R, 48), this.mat); this.disc.rotation.x = -Math.PI / 2; this.disc.position.copy(this.c).setY(this.c.y + 0.05); G.scene.add(this.disc);
    this.sMat = new THREE.MeshStandardMaterial({ map: streamTex(), alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0x606060, emissiveIntensity: 0.6, roughness: 0.8 });
    this.poleMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6 });
    this.g = new THREE.Group(); G.scene.add(this.g); this.streams = []; this.geos = [new THREE.PlaneGeometry(0.34, 0.8), new THREE.CylinderGeometry(0.018, 0.022, 1.7, 8)]; this.geos[0].translate(0, -0.4, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, p = new THREE.Group(); p.position.set(this.c.x + Math.cos(a) * this.R, this.c.y, this.c.z + Math.sin(a) * this.R); p.rotation.y = -a + Math.PI / 2; this.g.add(p);
      const pole = new THREE.Mesh(this.geos[1], this.poleMat); pole.position.y = 0.85; p.add(pole); const s = new THREE.Mesh(this.geos[0], this.sMat); s.position.set(0, 1.65, 0.03); p.add(s); this.streams.push({ p, s, ph: i * 1.3 }); }
    this.g.scale.set(1, 0.01, 1); sfx('charge'); paper(G, this.c.clone().setY(this.c.y + 0.3), 24, 4);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt; const k = Math.min(1, this.t / 0.3) * Math.min(1, (this.life - this.t) / 0.25 + 0.15);
    this.disc.rotation.z -= dt * (3 + this.t); this.mat.opacity = 0.75 * k; this.g.scale.y = Math.min(1, this.t / 0.3);
    for (const s of this.streams) s.s.rotation.x = 0.2 * Math.sin(this.t * 5 + s.ph);
    if (Math.random() < 0.5) { const a = rand(0, TAU), r = rand(0.3, 1) * this.R; G.fx.p(this.c.clone().add(new V3(Math.cos(a) * r, rand(0.1, 1.6), Math.sin(a) * r)), { vel: [-Math.sin(a) * 2, 0.6, Math.cos(a) * 2], size: 0.1, size1: 0.03, life: 0.6, color: OBANG[Math.floor(rand(0, 5))], alpha: 0.9, drag: 1 }); }
    const inside = (t) => Math.hypot(t.pos.x - this.c.x, t.pos.z - this.c.z) < this.R + 0.3 * t.scale && t.pos.y - this.c.y < 2.4;
    for (const t of f.foes()) if (inside(t)) t.addStatus('slow', 0.3, 0.45, f);
    if (this.tick <= 0 && this.t < this.life - 0.3) { this.tick = 0.35;
      for (const t of f.foes()) if (inside(t)) { t.takeHit(f, { dmg: 7, kb: [0, 0], stun: 0.2, daze: 5, hs: 0.01, noCrit: true, basic: false, snd: 'hit' }, new V3().subVectors(this.c, t.pos).setY(0).normalize()); } }
    // 끝: 소용돌이가 조여들며 최면 — 안의 적은 넋을 잃고 멈춘다
    if (!this.hyp && this.t >= this.life - 0.3) { this.hyp = true; sfx('zap'); sfx('boom'); G.shake(0.2); G.fx.ring(this.c.clone().setY(this.c.y + 0.1), { normal: UP, r0: this.R * 1.1, r1: 0.2, life: 0.35, color: 0xff8aff }); G.fx.beam(this.c, { r: 1.0, h: 6, color: 0xffd04a, life: 0.4 });
      for (const t of f.foes()) if (inside(t)) { const r = t.takeHit(f, { dmg: 34, kb: [0, 0], stun: 1.3, hs: 0.1, daze: 34, snd: 'big', basic: false }, new V3().subVectors(this.c, t.pos).setY(0).normalize()); if (r === 'hit') { t.addStatus('slow', 2.5, 0.6, f); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; G.fx.p(t.pos.clone().add(new V3(Math.cos(a) * 0.4, 2.1, Math.sin(a) * 0.4)), { vel: [-Math.sin(a), 0, Math.cos(a)], size: 0.12, size1: 0.04, life: 1.2, color: 0xffd04a, alpha: 0.9, drag: 0.5 }); } } } }
    if (this.t >= this.life) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.disc); this.G.scene.remove(this.g); this.disc.geometry.dispose(); this.mat.dispose(); this.sMat.dispose(); this.poleMat.dispose(); for (const g of this.geos) g.dispose(); }
}

/* ---------- 궁극기: 산신 호랑이 (민화 까치호랑이) — 뒤에서 솟아 상대를 덮쳐 할퀴고 포효한다 ---------- */
let _tg = null, _tigerTex = null;
function tigerTex() {
  if (_tigerTex) return _tigerTex;
  const W = 512, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#d8801e'); gr.addColorStop(0.36, '#f0a83a'); gr.addColorStop(0.46, '#f8e6c0'); gr.addColorStop(0.54, '#f8e6c0'); gr.addColorStop(0.64, '#f0a83a'); gr.addColorStop(1, '#d8801e');
  g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#1a120c';
  for (let k = 0; k < 14; k++) { const y0 = (k + 0.5) * H / 14; for (const s of [0, 1]) { g.beginPath(); const x0 = s ? W * 0.62 : 0, x1 = s ? W : W * 0.38; g.moveTo(x0, y0); for (let x = x0; x <= x1; x += 8) { const t = (x - x0) / (x1 - x0), th = 9 * Math.sin(Math.PI * (s ? 1 - t : t) ** 0.7); g.lineTo(x, y0 + 8 * Math.sin(x * 0.05 + k) - th); } for (let x = x1; x >= x0; x -= 8) { const t = (x - x0) / (x1 - x0), th = 9 * Math.sin(Math.PI * (s ? 1 - t : t) ** 0.7); g.lineTo(x, y0 + 8 * Math.sin(x * 0.05 + k) + th); } g.closePath(); g.fill(); } }
  _tigerTex = new THREE.CanvasTexture(c); _tigerTex.colorSpace = THREE.SRGBColorSpace; return _tigerTex;
}
function tigerGeo() {
  if (_tg) return _tg;
  const body = loft((v) => ({ y: -0.78 + 1.56 * v, rx: 0.24 + 0.06 * Math.sin(Math.PI * v) + 0.04 * smooth(0.6, 1, v), rz: 0.26 + 0.05 * Math.sin(Math.PI * v) + 0.03 * smooth(0.65, 1, v), n: 2.1 }), 28, 16);
  body.rotateX(Math.PI / 2); // 길이 = +Z, 단면 앞(u 0.5) = 배
  const skull = new THREE.SphereGeometry(1, 24, 16); skull.scale(0.27, 0.24, 0.25);
  const muzzle = new THREE.SphereGeometry(1, 18, 12); muzzle.scale(0.15, 0.11, 0.13); muzzle.translate(0, -0.08, 0.2);
  const cheek = new THREE.SphereGeometry(1, 14, 10); cheek.scale(0.12, 0.11, 0.1);
  const ear = lathe([[0.07, 0], [0.06, 0.04], [0.03, 0.08], [0, 0.09]], 10); ear.scale(1, 1, 0.5);
  const eye = new THREE.CircleGeometry(0.07, 24), pupil = new THREE.CircleGeometry(0.03, 16), rimG = new THREE.RingGeometry(0.068, 0.085, 24);
  const nose = new THREE.SphereGeometry(1, 12, 8); nose.scale(0.05, 0.035, 0.03);
  const fang = new THREE.ConeGeometry(0.018, 0.07, 6); fang.rotateX(Math.PI);
  const leg = strand([[0, 0.08, 0], [0, -0.22, 0.02], [0, -0.5, 0.0]], 0.1, 0.07, { seg: 10, rad: 10 });
  const paw = new THREE.SphereGeometry(1, 14, 10); paw.scale(0.09, 0.06, 0.12); paw.translate(0, -0.56, 0.04);
  const tail = strand([[0, 0.1, -0.74], [0, -0.05, -1.0], [0, 0.2, -1.32], [0, 0.65, -1.3], [0, 0.95, -1.08], [0, 1.05, -0.9]], 0.06, 0.032, { seg: 30, rad: 10 });
  _tg = { body, skull, muzzle, cheek, ear, eye, pupil, rimG, nose, fang, leg, paw, tail }; return _tg;
}
class SpiritTiger {
  constructor(G, f, tgt) {
    this.G = G; this.f = f; this.tg = tgt; this.t = 0; this.done = false; const g = tigerGeo();
    const fw = f.fwd(new V3()); this.start = f.pos.clone().addScaledVector(fw, -2.4).setY(f.pos.y); this.fw = fw;
    this.fur = new THREE.MeshStandardMaterial({ map: tigerTex(), emissive: 0xff9a30, emissiveMap: tigerTex(), emissiveIntensity: 0.45, roughness: 0.6, transparent: true, opacity: 0 });
    this.aura = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });
    this.white = new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0x806040, emissiveIntensity: 0.5, roughness: 0.6, transparent: true, opacity: 0 });
    this.dark = new THREE.MeshBasicMaterial({ color: 0x140c08, transparent: true, opacity: 0 });
    this.eyeM = new THREE.MeshBasicMaterial({ color: 0xffe040, transparent: true, opacity: 0, side: THREE.DoubleSide });
    this.rimM = new THREE.MeshBasicMaterial({ color: 0xe0302a, transparent: true, opacity: 0, side: THREE.DoubleSide });
    this.mats = [this.fur, this.aura, this.white, this.dark, this.eyeM, this.rimM];
    const M = (geo, mt, p = [0, 0, 0], r = [0, 0, 0], s = 1) => { const me = new THREE.Mesh(geo, mt); me.position.set(...p); me.rotation.set(...r); me.scale.setScalar(s); me.frustumCulled = false; return me; };
    this.root = new THREE.Group(); G.scene.add(this.root); this.sc = 1.45;
    this.body = new THREE.Group(); this.body.position.y = 0.62; this.root.add(this.body);
    this.body.add(M(g.body, this.fur)); this.body.add(M(g.body, this.aura, [0, 0, 0], [0, 0, 0], 1.1)); this.body.add(M(g.tail, this.fur));
    this.head = new THREE.Group(); this.head.position.set(0, 0.2, 0.88); this.body.add(this.head);
    this.head.add(M(g.skull, this.fur)); this.head.add(M(g.skull, this.aura, [0, 0, 0], [0, 0, 0], 1.12)); this.head.add(M(g.muzzle, this.white)); this.head.add(M(g.nose, this.dark, [0, -0.02, 0.33]));
    for (const s of [-1, 1]) { this.head.add(M(g.cheek, this.white, [s * 0.18, -0.1, 0.08])); this.head.add(M(g.ear, this.fur, [s * 0.17, 0.17, -0.02], [0, 0, -s * 0.5]));
      this.head.add(M(g.rimG, this.rimM, [s * 0.11, 0.06, 0.226], [0, s * 0.35, 0])); this.head.add(M(g.eye, this.eyeM, [s * 0.11, 0.06, 0.228], [0, s * 0.35, 0])); this.head.add(M(g.pupil, this.dark, [s * 0.112, 0.055, 0.236], [0, s * 0.35, 0]));
      this.head.add(M(g.fang, this.white, [s * 0.05, -0.17, 0.27])); }
    this.legs = [];
    for (const [x, z] of [[0.17, 0.52], [-0.17, 0.52], [0.17, -0.5], [-0.17, -0.5]]) { const l = new THREE.Group(); l.position.set(x, -0.04, z); this.body.add(l); l.add(M(g.leg, this.fur)); l.add(M(g.paw, this.white)); this.legs.push(l); }
    this.root.scale.setScalar(0.3 * this.sc); this.root.position.copy(this.start); this.root.rotation.y = Math.atan2(fw.x, fw.z);
    sfx('charge'); paper(G, this.start.clone().setY(1), 30, 5, [0xffffff, PAPER, 0xffb040]); G.fx.beam(this.start, { r: 1.4, h: 8, color: 0xffb040, life: 0.6 });
  }
  op(k) { this.fur.opacity = k; this.white.opacity = k; this.dark.opacity = k; this.eyeM.opacity = k; this.rimM.opacity = k; this.aura.opacity = 0.22 * k; }
  update(dt) {
    const G = this.G, t = this.t += dt, tg = this.tg, sc = this.sc; let k = 1;
    const to = alive(tg) || (tg && tg.held) ? tg.pos.clone().setY(tg.pos.y > 0.3 ? tg.pos.y : 0) : this.start.clone().addScaledVector(this.fw, 6);
    const dir = to.clone().sub(this.start).setY(0), L = dir.length(); dir.normalize(); const land = this.start.clone().addScaledVector(dir, Math.max(0, L - 1.1));
    const L4 = this.legs;
    if (t < 0.4) { // 솟아오름 (앉은 자세에서 몸을 일으킴)
      k = t / 0.4; this.root.scale.setScalar((0.3 + 0.7 * k) * sc); this.root.position.copy(this.start); this.root.rotation.y = Math.atan2(dir.x, dir.z);
      this.body.rotation.x = -0.35 * (1 - k); this.head.rotation.x = -0.3; L4.forEach((l, i) => { l.rotation.x = i < 2 ? -0.2 : 0.6 * (1 - k); });
    } else if (t < 0.85) { // 도약: 포물선을 그리며 덮친다
      const u = (t - 0.4) / 0.45; this.root.scale.setScalar(sc); this.root.position.lerpVectors(this.start, land, u); this.root.position.y = this.start.y + 2.4 * Math.sin(Math.PI * u);
      this.body.rotation.x = -0.45 + 0.9 * u; this.head.rotation.x = -0.2 + 0.4 * u; L4.forEach((l, i) => { l.rotation.x = i < 2 ? -1.2 + 0.4 * u : 1.0 - 0.3 * u; });
      if (Math.random() < 0.9) paper(G, this.root.position.clone().add(new V3(0, 0.8, 0)), 2, 2, [0xffb040, 0xffffff]);
    } else if (t < 2.0) { // 할퀴기: 앞발을 번갈아 휘두르며 머리를 흔든다
      const u = t - 0.85; this.root.position.copy(land); this.root.position.y = to.y; this.body.rotation.x = -0.35 + 0.08 * Math.sin(u * 12); this.body.position.y = 0.66 + 0.05 * Math.sin(u * 12);
      this.head.rotation.set(0.25 + 0.15 * Math.sin(u * 9), 0.25 * Math.sin(u * 7), 0.1 * Math.sin(u * 11)); L4[0].rotation.x = -1.4 + 0.9 * Math.max(0, Math.sin(u * 11)); L4[1].rotation.x = -1.4 + 0.9 * Math.max(0, Math.sin(u * 11 + Math.PI)); L4[2].rotation.x = 0.3; L4[3].rotation.x = 0.3;
      if (t > 1.65) { this.head.rotation.x = -0.45; this.body.rotation.x = -0.5; } // 포효
    } else { // 종이 술로 흩어지며 사라짐
      k = Math.max(0, 1 - (t - 2.0) / 0.4); if (Math.random() < 0.8) paper(G, this.root.position.clone().add(new V3(rand(-0.6, 0.6), rand(0.4, 1.4), rand(-0.6, 0.6))), 3, 3, [0xffffff, PAPER, 0xffb040]);
    }
    this.op(Math.min(1, t / 0.15) * k); if (t > 2.4) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.root); for (const m of this.mats) m.dispose(); }
}

/* =====================================================================
   기술 — 의식 술사: 방울 · 부적 · 까치 · 지전 결계 · 굿
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 방울을 아래로 내리꽂아 놋쇠 울림 + 부적 비 --- */
  ...makePlunge({
    up: 'call',
    fall: { ...poses.call, spine: [0.3, 0, 0], head: [0.2, 0, 0], shoulderR: [-1.5, 0, -0.15], elbowR: [-0.2, 0, 0], weapon: [-1.3, 0, 0], shoulderL: [-0.4, 0, 0.8], hipL: [-1.0, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: GOLDB, dmg: 64, r: 2.5,
    fx: (f, o, G, c) => { paper(G, c.clone().setY(c.y + 0.4), 26, 6, [PAPER, 0xffffff, REDM]); G.fx.ring(c.clone().setY(c.y + 0.08), { normal: UP, r0: 0.2, r1: 3, life: 0.5, color: TEAL }); sfx('block'); },
  }),

  /* --- 기본 공격: 방울 후려치기 → 부적 따귀(왼손) → 오색 회오리(한 바퀴) → 까치 급강하 (피해만) --- */
  light1: { dur: 0.38, cancel: 0.18, next: 'light2', trail: true, track: 0.08,
    keys: [[0, 'windR'], [0.08, 'windR'], [0.16, 'strikeL'], [0.26, {}], [0.38, 'base']], lunge: [[0.06, 0.14, 5]],
    ev: [[0.08, () => sfx('swing')], [0.14, (f, o, G) => { bellRing(G, f, 0.8); f.slashFx({ r: 1.5, color: GOLDB, at: [0, 1.2, 0.5], tilt: 0.15 }); }]],
    hits: [{ t0: 0.1, t1: 0.2, weapon: false, at: [0, 1.15, 0.85], r: 0.62, dmg: 28 }] },
  light2: { dur: 0.42, cancel: 0.2, next: 'light3', track: 0.1,
    keys: [[0, 'slapPrep'], [0.1, 'slapPrep'], [0.17, 'slap'], [0.28, {}], [0.42, 'base']], lunge: [[0.08, 0.16, 5]],
    start: (f) => talK(f, 1),
    ev: [[0.1, () => sfx('swing')], [0.17, (f, o, G) => { const p = f.model.J.handL.getWorldPosition(new V3()); paper(G, p, 10, 3, [PAPER, REDM]); G.fx.p(p, { size: 0.8, size1: 0.1, life: 0.15, color: GOLDB, alpha: 0.9 }); }], [0.32, (f) => talK(f, 0)]],
    hits: [{ t0: 0.14, t1: 0.22, weapon: false, at: [0.05, 1.25, 0.75], r: 0.6, dmg: 26 }],
    end: (f) => talK(f, 0) },
  light3: { dur: 0.56, cancel: 0.36, next: 'light4', trail: true, aim: true,
    keys: [[0, 'spin'], [0.4, 'spin'], [0.56, 'base']],
    start: (f) => { f.spinYaw = f.yaw; },
    tick: (f, o, G, t) => { if (t >= 0.04 && t <= 0.4) { f.yaw = f.spinYaw + TAU * ((t - 0.04) / 0.36); if (Math.random() < 0.6) { const p = f.model.bellPos(new V3()); G.fx.p(p, { size: 0.15, size1: 0.03, life: 0.35, color: OBANG[Math.floor(rand(0, 5))], alpha: 0.9, drag: 1 }); } } else if (t > 0.4) f.yaw = f.spinYaw; },
    ev: [[0.06, () => sfx('swing')], [0.12, (f, o, G) => G.fx.ring(f.local([0, 1.05, 0]), { normal: UP, r0: 0.3, r1: 1.6, life: 0.3, color: GOLDB })], [0.24, (f, o, G) => { sfx('swing'); bellRing(G, f, 0.6); }]],
    hits: [{ t0: 0.08, t1: 0.2, weapon: false, at: [0, 1.0, 0.25], r: 1.15, dmg: 15 }, { t0: 0.24, t1: 0.38, weapon: false, at: [0, 1.0, 0.25], r: 1.15, dmg: 15 }],
    end: (f) => { if (f.spinYaw !== undefined) f.yaw = f.spinYaw; } },
  light4: { dur: 0.6, track: 0.2, move: 0.3,
    keys: [[0, 'call'], [0.12, 'point'], [0.44, {}], [0.6, 'base']],
    ev: [[0.02, (f, o, G) => bellRing(G, f, 1)], [0.12, (f, o, G) => { sfx('dash');
      const from = f.local([0.7, 2.1, -1.4]), to = alive(o) && f.dist() < 10 ? aimPt(o) : f.local([0, 1.1, 6]); to.addScaledVector(to.clone().sub(from).normalize(), 1.5); G.spawn(new MagpieSwoop(G, f, from, to)); }]] },

  /* --- 우클: 봉인 부적 — 부적을 던져 붙인다 → 1초 뒤 터지며 약화(받는 피해 ×1.15 · 4초). 신기가 가득 차면 세 장 --- */
  heavy: { dur: 0.7, cd: 'heavy', track: 0.3, shout: true, move: 0.2,
    keys: [[0, 'throwPrep'], [0.22, 'throwPrep'], [0.3, 'throw'], [0.5, {}], [0.7, 'base']],
    start: (f, o, G) => { talK(f, 1); f.empTal = shingi(f) >= 100; if (f.empTal) { f.shingi = 0; G.say(f, '"…세 겹으로 봉한다."'); } else G.say(f, '"붙어라."'); sfx('charge'); },
    tick: (f, o, G, t) => { if (t < 0.28 && Math.random() < 0.6) { const p = f.model.J.handL.getWorldPosition(new V3()); G.fx.p(p.add(new V3(rand(-0.15, 0.15), rand(-0.1, 0.2), rand(-0.15, 0.15))), { vel: [0, 0.6, 0], size: 0.09, size1: 0.02, life: 0.3, color: GOLDB, alpha: 0.9 }); } },
    ev: [[0.3, (f, o, G) => { talK(f, 0); sfx('shot'); sfx('swing'); const from = f.model.J.handL.getWorldPosition(new V3()), n = f.empTal ? 3 : 1;
      for (let i = 0; i < n; i++) G.spawn(new Talisman(G, f, from, aimDir(f, from, n > 1 ? (i - 1) * 0.22 : 0))); paper(G, from, 6, 2); }]],
    end: (f) => { talK(f, 0); f.empTal = false; } },

  /* --- Shift: 까치 부르기 — 방울을 흔들어 까치를 부른다. 6초 동안 상대에게 네 번 급강하 (18 · 둔화) --- */
  s1: { dur: 0.6, cd: 's1', shout: true, move: 0.3,
    keys: [[0, 'call'], [0.36, 'call'], [0.46, 'point'], [0.6, 'base']],
    start: (f, o, G) => { G.say(f, '"까치야, 길을 열어."'); bellK(f, 1); if (f.magpie) f.magpie.kill(); },
    ev: [[0.06, (f, o, G) => bellRing(G, f, 1.2)], [0.2, (f, o, G) => bellRing(G, f, 1.2)],
      [0.34, (f, o, G) => { sfx('zap'); G.spawn(new MagpieFamiliar(G, f)); paper(G, f.local([0.6, 2.2, -0.4]), 20, 4, [0xffffff, 0x14161e, 0x8aa0ff]); bellK(f, 0); }]],
    end: (f) => bellK(f, 0) },

  /* --- E: 지전 결계 — 상대 발밑에 오색 소용돌이 원 + 종이 술대 (3초: 둔화 · 연속 피해 → 최면 34 · 1.3초 멈춤) --- */
  s2: { dur: 0.85, cd: 's2', shout: true, move: 0.15, track: 0.3,
    keys: [[0, 'call'], [0.3, { ...poses.call, weapon: [1.3, 0, 0.6] }], [0.4, 'slam'], [0.65, {}], [0.85, 'base']],
    start: (f, o, G) => { G.say(f, '"경계 안으로—."'); bellK(f, 1); },
    ev: [[0.1, (f, o, G) => bellRing(G, f, 1)], [0.4, (f, o, G) => { sfx('heavy'); bellRing(G, f, 1.4); const tip = f.model.bellPos(new V3()).setY(f.pos.y + 0.05); G.fx.ring(tip, { normal: UP, r0: 0.1, r1: 1.4, life: 0.3, color: GOLDB });
      const c = alive(o) && f.dist() < 12 ? o.pos.clone().setY(o.onGround ? o.pos.y : f.pos.y) : f.local([0, 0, 5]); c.y = Math.max(0, Math.min(c.y, f.pos.y + 0.5)); G.spawn(new SpiritCircle(G, f, c)); }], [0.7, (f) => bellK(f, 0)]],
    end: (f) => bellK(f, 0) },

  /* --- 극한 회피 뒤 좌클: 방울 울림 — 방울을 높이 흔들어 놋쇠 충격파 + 부적 비 --- */
  counter: { dur: 0.62,
    keys: [[0, 'call'], [0.3, 'call'], [0.45, {}], [0.62, 'base']],
    ev: [[0, (f, o, G) => { bellK(f, 1); sfx('boom'); bellRing(G, f, 2); G.flash(GOLDB, 0.22); const c = f.pos.clone().setY(f.pos.y + 0.05);
      G.fx.ring(c, { normal: UP, r0: 0.3, r1: 3.2, life: 0.4, color: GOLDB }); G.fx.ring(f.chest(new V3()), { r0: 0.2, r1: 2.6, life: 0.35, color: 0xffffff, billboard: true }); paper(G, f.chest(new V3()), 30, 6, [PAPER, REDM, 0xffffff]);
      areaHit(f, c, 2.6, { dmg: 74, kb: [7, 4], stun: 0.6, hs: 0.12, shake: 0.2, daze: 30, snd: 'big' }, 1.6); }],
      [0.14, (f, o, G) => bellRing(G, f, 1.2)], [0.5, (f) => bellK(f, 0)]],
    end: (f) => bellK(f, 0) },

  /* --- Q: 굿 · 범 내려온다 — 방울 춤으로 굿판을 열면 산신 호랑이가 뒤에서 솟아 덮쳐 할퀴고, 포효로 날려 버린다 --- */
  ult: { dur: 3.3, ult: true, aim: true, shout: true,
    keys: [[0, 'call'], [0.2, 'danceA'], [0.42, 'danceB'], [0.64, 'danceA'], [0.86, 'danceB'], [1.05, 'call'], [1.4, 'point'], [2.7, 'point'], [2.85, 'call'], [3.3, 'win']],
    cam: [[0, { ref: 'self', p: [0.9, 0.9, 2.4], l: [0, 1.15, 0], fov: 40 }], [0.85, { ref: 'self', p: [1.4, 1.3, 3.0], l: [0, 1.25, -0.6], fov: 48 }],
      [1.05, { ref: 'self', p: [2.4, 1.8, 3.6], l: [0, 1.4, -1.6], fov: 54 }], [1.5, { ref: 'self', p: [-4.0, 1.7, 2.0], l: [0, 1.3, 3.0], fov: 58 }],
      [1.85, { ref: 'target', p: [3.4, 1.5, 3.0], l: [0, 1.1, 0], fov: 52 }], [2.6, { ref: 'target', p: [-3.0, 1.1, 2.6], l: [0, 1.2, 0], fov: 50 }], [3.3, { ref: 'target', p: [-1.8, 2.4, 5.4], l: [0, 1.1, 0], fov: 56 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(0x6a3a10, 0.3); bellK(f, 1); sfx('charge'); G.say(f, '"굿판을 연다. 산신님, 내려오소서."'); paper(G, f.chest(new V3()), 24, 3); }],
      ...[0.2, 0.42, 0.64, 0.86].map((t) => [t, (f, o, G) => { bellRing(G, f, 1.3); G.fx.ring(f.pos.clone().setY(f.pos.y + 0.06), { normal: UP, r0: 0.4, r1: 2.6, life: 0.4, color: OBANG[Math.floor(t * 5) % 5] }); }]),
      [1.0, (f, o, G) => { o = f.ultTgt || o; sfx('boom'); G.shake(0.25); G.flash(0xffc060, 0.25); G.spawn(f.tiger = new SpiritTiger(G, f, o)); G.say(f, '"범 내려온다."'); }],
      [1.75, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('big'); sfx('boom'); G.shake(0.4); G.fx.impact(aimPt(o), 0xffb040, 2); paper(G, aimPt(o), 20, 6, [0xffb040, 0xffffff]);
        o.takeHit(f, { dmg: 68, kb: [0, 0], stun: 99, hs: 0.12, shake: 0.3, nokill: true, noScale: true, force: true, daze: 50, snd: 'big', basic: false }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); }],
      ...[1.95, 2.15, 2.35, 2.55].map((t, i) => [t, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('swing'); sfx('hit'); const c = aimPt(o), a = (i % 2 ? 1 : -1) * 0.7;
        f.G.fx.slash(c, { fwd: new V3().subVectors(o.pos, f.pos).setY(0).normalize(), normal: new V3(Math.sin(a), Math.cos(a), 0).normalize(), r: 1.3, color: 0xffb040, life: 0.22 });
        o.takeHit(f, { dmg: 16, kb: [0, 0], stun: 99, hs: 0.04, nokill: true, noScale: true, force: true, noCrit: true, daze: 12, snd: 'hit', basic: false }, new V3().subVectors(o.pos, f.pos).setY(0).normalize()); }]),
      [2.8, (f, o, G) => { o = f.ultTgt || o; if (!o) return; o.release(); sfx('boom'); sfx('big'); G.say(f, '"…경계 밖으로."'); G.flash(0xfff0c0, 0.5); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.4);
        const c = o.pos.clone().setY(0.05); G.fx.ring(c, { normal: UP, r0: 0.5, r1: 7, life: 0.6, color: 0xffb040 }); G.fx.impact(aimPt(o), 0xffb040, 2.6); G.fx.light(c.clone().setY(1.5), 0xffb040, 180, 0.8, 22); paper(G, aimPt(o), 50, 9, [0xffb040, 0xffffff, PAPER]);
        o.takeHit(f, { dmg: 120, kb: [6, 10], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 80, snd: 'big', basic: false }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) t.takeHit(f, { dmg: 100, kb: [6, 9], stun: 0.8, force: true, noCrit: true, basic: false }, new V3().subVectors(t.pos, o.pos).setY(0).normalize());
        G.slow(0.35, 0.5); }],
    ],
    tick: (f, o, G, t) => { if (t < 1.0) { const c = f.chest(new V3()); for (let i = 0; i < 2; i++) { const a = t * 6 + i * Math.PI + rand(0, 0.4), R = 1.1 - t * 0.3, p = f.pos.clone().add(new V3(Math.cos(a) * R, 0.2 + t * 1.6 + rand(0, 0.3), Math.sin(a) * R)); G.fx.p(p, { vel: [0, 1.2, 0], size: 0.12, size1: 0.04, life: 0.5, color: i ? PAPER : 0xffffff, alpha: 0.9, drag: 1 }); } } },
    end: (f, o, G) => { G.setTint(0, 0); bellK(f, 0); const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, GOLDB, big ? 1.6 : 1.0, dir);
  paper(G, p, big ? 12 : 5, 4, [PAPER, 0xffffff, REDM]);
  if (big) G.fx.ring(p, { r0: 0.2, r1: 1.8, life: 0.3, color: TEAL, billboard: true });
  // 신기: 의식이 닿을 때마다 쌓인다 (가득 차면 다음 봉인 부적이 세 장)
  att.shingi = Math.min(100, (att.shingi || 0) + h.dmg * 0.35);
}

// 신기 상태 → 몸 주위에 떠도는 종이 혼불 · 궤적 색
function createModelWithSpirit(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (shingi(f) >= 100 && f.root.visible && Math.random() < 0.35) { const a = f.G.time * 2.5 + Math.random() * TAU; f.G.fx.p(f.pos.clone().add(new V3(Math.cos(a) * 0.6, 0.4 + Math.random() * 1.4, Math.sin(a) * 0.6)), { vel: [0, 0.7, 0], life: 0.7, size: 0.09, size1: 0.02, color: Math.random() < 0.5 ? GOLDB : 0xffffff, alpha: 0.85, drag: 0.5 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(GOLDB);
    up(dt, f);
  };
  return m;
}

// CPU: 중거리 — 부적을 던지고 까치를 부르고, 가까우면 결계와 방울
function aiPick(f, o, dist) {
  if (dist > 3 && dist < 13 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist < 14 && f.cd.s1 <= 0 && !(f.magpieT > 0) && Math.random() < 0.3) return 's1';
  if (dist < 8 && f.cd.s2 <= 0 && Math.random() < 0.25) return 's2';
  if (dist > 2.3 && dist < 6 && Math.random() < 0.15) return 'light';
  return null;
}

export default {
  id: 'mudang', name: '단비', short: '단비', title: '경계의 무당', scale: 0.97,
  desc: '중거리 · 의식 술사 · 근접 견제. 기억과 경계의 의식을 치르는 현대 무당. 방울과 부적으로 치고, 붙인 부적을 터뜨려 약화시키며, 까치를 부려 급강하시키고 지전 결계로 상대를 홀린다. 맞힐수록 신기가 차오르고, 가득 차면 봉인 부적이 세 장이 된다.',
  stats: { hp: 950, speed: 7.8, jump: 10.8, crit: 0.22 },
  palettes: [{ accent: GOLDB, coat: 0xf6f7f9, tie: REDM, band: '#2a1408' }, { accent: 0x6ae0ff, coat: 0x2a2c34, tie: 0x2a7aff, band: '#08182a' }],
  skills: { heavy: { name: '봉인 부적', cd: 7 }, s1: { name: '까치 부르기', cd: 12 }, s2: { name: '지전 결계', cd: 14 }, ult: { name: '굿 · 범 내려온다', sub: 'BOUNDARY SHAMAN' } },
  aimRange: RANGE, aiPick,
  resource: (f) => shingi(f) >= 100 ? { v: 1, label: '신기', color: 0xfff0a0, full: true } : { v: shingi(f) / 100, label: '신기', color: 0xe0a030 },
  onReset: (f) => { f.shingi = 0; f.talK = 0; f.bellK = 0; f.magpie = null; f.magpieT = 0; f.empTal = false; f.ultTgt = null; f.tiger = null; },
  moveList: [['좌클 ×4', '방울 후려치기 28 → 부적 따귀 26 → 오색 회오리 15×2 → 까치 급강하 36 (등 뒤에서 날아와 꿰뚫음)'], ['공중 좌클', '방울을 내리꽂아 놋쇠 울림 + 부적 비'],
    ['우클 · 봉인 부적', '부적을 던져 붙임 20 → 1초 뒤 터짐 56 + 약화(받는 피해 ×1.15 · 4초). 신기가 가득 차면 세 장'], ['Shift · 까치 부르기', '6초 동안 어깨 위를 맴도는 까치가 상대에게 네 번 급강하 (18 · 둔화)'],
    ['E · 지전 결계', '상대 발밑에 오색 소용돌이 원: 3초간 둔화 · 0.35초마다 7 → 끝에 최면 34 (1.3초 멈춤)'], ['Q · 굿 · 범 내려온다', '방울 춤으로 굿판을 열면 산신 호랑이가 솟아 덮침 68 → 할퀴기 16×4 → 포효 120'],
    ['신기', '맞힐수록 쌓이고 가득 차면 다음 봉인 부적이 세 장'], ['C (타이밍) · 극한 회피', '방울 울림: 놋쇠 충격파 74'], ['가만히', '방울을 내려 들고 고개를 갸웃']],
  createModel: createModelWithSpirit, poses, moves, hitFx,
};
