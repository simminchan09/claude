// 라이아스 (RAIAS) — GUARDIAN · 부서지지 않는 방패 · 근거리 · 탱커 · 수호
// "공허한 맹세를 지닌 자" — 스테인드글라스 방패 하나로 모든 것을 막아서는 젊은 수호기사.
// 무기: 왼손의 거대한 연 모양 방패 — 밀쳐 치고, 모서리로 베고, 들어 올려 치고, 내리찍는다.
// 고유 게이지 「신념」: 맞거나 막거나 때릴수록 차오르고, 가득 차면 다음 디바인 저지먼트가 성광의 날개를 펼친다.
import * as THREE from 'three';
import { areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { createModel, holyGlassTex, HOLY, HOLY2, PALE, GOLDG, EMBERG } from './guardian_model.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);

/* =====================================================================
   포즈 (handL = 방패 방향: 몸 기준 [앞면 위로+, 앞면 왼쪽으로+, 롤(윗끝 오른쪽으로+)])
   방패를 눕히면 [1.57, 방향, -1.57] : 앞면이 위, 윗끝이 방향(0 = 왼쪽 · -1.57 = 앞 · -3.1 = 오른쪽)을 향한다
   ===================================================================== */
const poses = {
  // 기본: 방패를 왼쪽 앞에 세워 들고 (가시 끝이 땅에 닿을 듯) 꼿꼿이 선다. 오른손은 허리께
  base: { hips: [0, 0.18, 0], spine: [0.02, -0.08, 0], chest: [0.0, -0.08, 0], head: [0.04, -0.04, 0],
    shoulderL: [-0.2, 0, 0.3], elbowL: [-0.6, 0, 0], handL: [0, 0.85, 0], shoulderR: [0.05, 0, -0.16], elbowR: [-0.5, 0, 0], weapon: [-0.4, 0, 0],
    hipL: [-0.08, 0, 0.07], kneeL: [0.1, 0, 0], footL: [-0.02, 0, 0], hipR: [0.06, 0, -0.08], kneeR: [0.08, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.05, 0], spine: [0.3, 0.05, 0], chest: [0.06, 0.05, 0], head: [-0.2, 0, 0], shoulderL: [-0.3, 0, 0.18], elbowL: [-1.0, 0, 0], handL: [0, 0.9, 0], shoulderR: [0.3, 0, -0.2], elbowR: [-0.8, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.3, 0, 0], shoulderL: [-0.6, 0, 0.3], elbowL: [-0.9, 0, 0], handL: [0.1, 0.5, 0], shoulderR: [-0.5, 0, -0.6], elbowR: [-0.6, 0, 0] },
  // 방어: 방패를 몸 앞 가운데로 세워 몸 전체를 가린다
  guard: { hips: [0, 0.3, 0], spine: [0.12, -0.2, 0], chest: [0.06, -0.2, 0], head: [0.02, 0.05, 0], shoulderL: [-0.55, 0, -0.22], elbowL: [-1.05, 0, 0], handL: [0.05, -0.15, 0], shoulderR: [-0.5, 0, 0.2], elbowR: [-1.4, 0, 0],
    hipL: [-0.45, 0, 0.2], kneeL: [0.8, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.6, 0, 0] },
  hit: { spine: [-0.3, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.3, 0, 0], shoulderL: [0.3, 0, 0.4], elbowL: [-0.6, 0, 0], handL: [0.3, 0.8, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.5, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderL: [0.4, 0, 0.8], elbowL: [-0.4, 0, 0], handL: [0.6, 1.0, 0], shoulderR: [0.5, 0, -0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.76, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderL: [-0.3, 0, 0.9], elbowL: [-0.3, 0, 0], handL: [1.4, 0.3, 0], shoulderR: [-2.4, 0, -0.5], elbowR: [-0.3, 0, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0.2, 0], spine: [0.5, -0.1, 0], chest: [0.1, -0.1, 0], shoulderL: [-0.6, 0, -0.1], elbowL: [-1.1, 0, 0], handL: [0, 0, 0], shoulderR: [0.6, 0, -0.3], elbowR: [-0.4, 0, 0], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.0, 0, 0] },
  // 승리: 방패 가시를 땅에 꽂고 오른손을 방패 위에 얹는다 (설정화 자세)
  win: { hips: [0, 0.25, 0], spine: [0.0, -0.2, 0], chest: [0.0, -0.15, 0], head: [0.08, 0.15, 0], shoulderL: [-0.25, 0, -0.05], elbowL: [-0.5, 0, 0], handL: [0, 0.05, 0], shoulderR: [-0.9, 0, 0.35], elbowR: [-0.75, 0, 0],
    hipL: [-0.1, 0, 0.07], kneeL: [0.06, 0, 0], hipR: [0.08, 0, -0.1], kneeR: [0.06, 0, 0] },
  portrait: { hips: [0, 0.3, 0], chest: [0, -0.15, 0], head: [0.04, 0.12, 0], shoulderL: [-0.75, 0, -0.1], elbowL: [-1.2, 0, 0], handL: [0.05, 0.2, 0], shoulderR: [-0.2, 0, -0.2], elbowR: [-0.8, 0, 0] },
  // 밀쳐 치기: 당긴 방패 → 앞으로 내지름
  bashPrep: { hips: [0, 0.45, 0], spine: [0.1, 0.25, 0], chest: [0.05, 0.3, 0], head: [0, -0.5, 0], shoulderL: [-0.6, 0, 0.15], elbowL: [-1.7, 0, 0], handL: [0, -0.35, 0], shoulderR: [0.2, 0, -0.3], elbowR: [-0.9, 0, 0],
    hipL: [-0.45, 0, 0.15], kneeL: [0.7, 0, 0], hipR: [0.4, 0, -0.15], kneeR: [0.5, 0, 0] },
  bash: { hips: [0, -0.2, 0], spine: [0.3, -0.2, 0], chest: [0.1, -0.25, 0], head: [-0.25, 0.3, 0], shoulderL: [-1.35, 0, -0.1], elbowL: [-0.35, 0, 0], handL: [0.05, -0.1, 0], shoulderR: [0.5, 0, -0.35], elbowR: [-0.6, 0, 0],
    hipL: [-1.0, 0, 0.15], kneeL: [0.9, 0, 0], hipR: [0.65, 0, -0.15], kneeR: [0.25, 0, 0] },
  // 모서리 베기: 눕힌 방패를 왼쪽에서 오른쪽으로 가로질러 휘두름
  swipePrep: { hips: [0, 0.55, 0], spine: [0.15, 0.4, 0], chest: [0.05, 0.45, 0], head: [0, -0.7, 0], shoulderL: [0, -0.2, 1.45], elbowL: [-0.25, 0, 0], handL: [1.57, 0.2, -1.57], shoulderR: [-0.4, 0, -0.3], elbowR: [-1.0, 0, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.6, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.5, 0, 0] },
  swipe: { hips: [0, -0.45, 0], spine: [0.25, -0.4, 0], chest: [0.08, -0.45, 0], head: [0, 0.6, 0], shoulderL: [0, -2.5, 1.45], elbowL: [-0.15, 0, 0], handL: [1.57, -2.9, -1.57], shoulderR: [0.3, 0, -0.45], elbowR: [-0.5, 0, 0],
    hipL: [-0.75, 0, 0.12], kneeL: [0.8, 0, 0], hipR: [0.45, 0, -0.12], kneeR: [0.35, 0, 0] },
  // 올려 치기: 낮게 내린 방패 → 머리 위로 쳐올림
  upPrep: { hipY: -0.06, hips: [0, 0.3, 0], spine: [0.45, 0.2, 0], chest: [0.15, 0.25, 0], head: [-0.35, -0.3, 0], shoulderL: [-0.15, 0, 0.0], elbowL: [-0.3, 0, 0], handL: [-1.1, -0.1, 0], shoulderR: [0.4, 0, -0.3], elbowR: [-0.6, 0, 0],
    hipL: [-0.9, 0, 0.15], kneeL: [1.2, 0, 0], hipR: [0.4, 0, -0.15], kneeR: [0.9, 0, 0] },
  upper: { hips: [0, -0.15, 0], spine: [-0.25, -0.1, 0], chest: [-0.15, -0.15, 0], head: [-0.3, 0.2, 0], shoulderL: [-2.7, 0, -0.05], elbowL: [-0.3, 0, 0], handL: [0.75, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.4, 0, 0],
    hipL: [-0.3, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.3, 0, 0] },
  // 머리 위로 치켜든 방패 → 땅에 내리찍기
  raise: { hips: [0, 0, 0], spine: [-0.18, 0, 0], chest: [-0.12, 0, 0], head: [-0.3, 0, 0], shoulderL: [-2.95, 0, -0.15], elbowL: [-0.35, 0, 0], handL: [0.35, 0, 0], shoulderR: [-2.5, 0, 0.2], elbowR: [-0.6, 0, 0],
    hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  slam: { hipY: -0.1, hips: [0, -0.1, 0], spine: [0.6, 0, 0], chest: [0.2, 0, 0], head: [-0.4, 0, 0], shoulderL: [-1.0, 0, -0.1], elbowL: [-0.25, 0, 0], handL: [-0.1, 0, 0], shoulderR: [-0.7, 0, 0.1], elbowR: [-0.8, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.35, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.5, 0, 0] },
  // 방패를 하늘로 치켜든다 (성역 · 궁극기)
  skyward: { hips: [0, 0, 0], spine: [-0.12, 0, 0], chest: [-0.1, 0, 0], head: [-0.4, 0, 0], shoulderL: [-3.0, 0, 0.1], elbowL: [-0.1, 0, 0], handL: [1.0, 0, 0], shoulderR: [0.1, 0, -0.35], elbowR: [-0.3, 0, 0],
    hipL: [-0.15, 0, 0.12], kneeL: [0.15, 0, 0], hipR: [0.15, 0, -0.12], kneeR: [0.15, 0, 0] },
  // 무장 전개: 방패를 앞으로 겨누고 몸을 낮춤
  aim: { hipY: -0.05, hips: [0, 0.35, 0], spine: [0.25, 0.1, 0], chest: [0.08, 0.15, 0], head: [-0.15, -0.3, 0], shoulderL: [-1.15, 0, -0.05], elbowL: [-0.75, 0, 0], handL: [0.05, -0.2, 0], shoulderR: [-0.3, 0, 0.1], elbowR: [-1.5, 0, 0],
    hipL: [-0.75, 0, 0.18], kneeL: [0.95, 0, 0], hipR: [0.55, 0, -0.18], kneeR: [0.75, 0, 0] },
  thrust: { hips: [0, -0.1, 0], spine: [0.4, -0.15, 0], chest: [0.12, -0.2, 0], head: [-0.35, 0.2, 0], shoulderL: [-1.5, 0, -0.08], elbowL: [-0.08, 0, 0], handL: [0.0, -0.05, 0], shoulderR: [0.55, 0, -0.4], elbowR: [-0.5, 0, 0],
    hipL: [-1.15, 0, 0.12], kneeL: [1.05, 0, 0], hipR: [0.8, 0, -0.12], kneeR: [0.2, 0, 0] },
  // 오래 가만히 있으면: 방패를 땅에 세우고 눈을 감듯 고개를 숙인다
  idle2: { hips: [0, 0.22, 0], spine: [0.05, -0.15, 0], chest: [0.0, -0.1, 0], head: [0.3, -0.05, 0], shoulderL: [-0.3, 0, -0.05], elbowL: [-0.55, 0, 0], handL: [0, 0.1, 0], shoulderR: [-0.85, 0, 0.32], elbowR: [-0.7, 0, 0],
    hipL: [-0.1, 0, 0.08], kneeL: [0.08, 0, 0], hipR: [0.08, 0, -0.1], kneeR: [0.06, 0, 0] },
};

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const holy = (f, k) => { f.holyK = k; };
const faith = (f) => f.faith || 0;
const holySlash = (f, o) => f.slashFx({ r: o.r || 2, color: o.color ?? HOLY, life: o.life ?? 0.24, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
function motes(G, p, n = 10, sp = 4, cols = [HOLY, HOLY2, PALE]) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.05, 0.11), size1: 0.015, life: rand(0.4, 0.8), color: cols[i % cols.length], alpha: 0.9, drag: 2, grav: -0.5, flick: 0.3 }); }
// 유리 파편: 납선 같은 어두운 테가 없는 작은 빛 조각들
function shards(G, p, n = 14, sp = 6) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2))), { vel: [rand(-sp, sp), rand(0.5, sp), rand(-sp, sp)], size: rand(0.06, 0.14), size1: 0.03, life: rand(0.5, 0.9), color: [0x3a7aff, 0x8ac8ff, 0xffffff, HOLY][i % 4], alpha: 0.95, drag: 1.5, grav: 9, flick: 0.5 }); }
const shieldFront = (f, d = 0.2) => f.model.tipPos(new V3()).addScaledVector(f.fwd(new V3()), d);
const foeDir = (f, t) => { const d = new V3().subVectors(t.pos, f.pos).setY(0); return d.lengthSq() > 1e-6 ? d.normalize() : f.fwd(new V3()); };
const allies = (f) => (f.G.fighters || [f]).filter((o) => o.team === f.team && o.state !== 'ko' && !o.gone);
// 신념 게이지
const addFaith = (f, v) => { f.faith = Math.min(100, faith(f) + v); };

/* ---------- 아이기스 레기스: 몸을 감싸는 스테인드글라스 원형 방벽 (피해 80% 감소 · 적을 밀어냄) ---------- */
let _domeGeo = null, _wireGeo = null;
class Aegis {
  constructor(G, f, life = 4) {
    this.G = G; this.f = f; this.t = 0; this.life = life; this.done = false; this.R = 2.6; this.flash = 1; f.aegisT = life; f.aegis = this;
    if (!_domeGeo) { _domeGeo = new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI * 0.55); _wireGeo = new THREE.IcosahedronGeometry(1.01, 3); }
    this.mat = new THREE.MeshBasicMaterial({ map: holyGlassTex(), color: HOLY, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.wire = new THREE.MeshBasicMaterial({ color: 0xc8d8ff, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.g = new THREE.Group(); this.dome = new THREE.Mesh(_domeGeo, this.mat); this.w = new THREE.Mesh(_wireGeo, this.wire); this.dome.add(this.w); this.g.add(this.dome); G.scene.add(this.g);
    this.dome.renderOrder = 11; this.w.renderOrder = 11;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; f.aegisT = Math.max(0, this.life - this.t); this.flash = Math.max(0, this.flash - dt * 3);
    if (this.t > this.life || f.state === 'ko' || f.gone) return this.kill();
    // 방벽 동안 받는 피해 80% 감소 (상태 효과)
    f.addStatus('vuln', 0.15, 0.2, f);
    const grow = 1 - (1 - Math.min(1, this.t / 0.25)) ** 3, fade = Math.min(1, (this.life - this.t) / 0.35), R = this.R * f.scale * grow;
    this.g.position.set(f.pos.x, f.pos.y, f.pos.z); this.dome.scale.set(R, R * 0.92, R); this.w.rotation.y = this.t * 0.5; this.dome.rotation.y = -this.t * 0.2;
    this.mat.opacity = (0.32 + this.flash * 0.4) * fade; this.wire.opacity = (0.12 + this.flash * 0.3) * fade;
    // 안으로 들어온 적을 밀어낸다
    for (const t of f.foes()) { if (t.held) continue; const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z, d = Math.hypot(dx, dz), lim = R + 0.35 * t.scale; if (d >= lim || Math.abs(t.pos.y - f.pos.y) > 2.5) continue;
      const nx = d > 0.01 ? dx / d : Math.sin(f.yaw), nz = d > 0.01 ? dz / d : Math.cos(f.yaw); t.pos.x = f.pos.x + nx * lim; t.pos.z = f.pos.z + nz * lim; if (t.vel.x * nx + t.vel.z * nz < 0) { t.vel.x = nx * 2; t.vel.z = nz * 2; }
      if (Math.random() < 0.3) G.fx.p(new V3(f.pos.x + nx * R, t.pos.y + 1, f.pos.z + nz * R), { size: 0.5, size1: 0.1, life: 0.2, color: HOLY2, alpha: 0.6 }); }
    if (Math.random() < 0.5) { const a = rand(0, TAU), e = rand(0, 1.3); G.fx.p(new V3(f.pos.x + Math.cos(a) * Math.cos(e) * R, f.pos.y + Math.sin(e) * R * 0.92, f.pos.z + Math.sin(a) * Math.cos(e) * R), { vel: [0, 0.6, 0], size: 0.09, size1: 0.01, life: 0.5, color: Math.random() < 0.5 ? HOLY : PALE, alpha: 0.9 }); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.mat.dispose(); this.wire.dispose(); this.f.aegisT = 0; if (this.f.aegis === this) this.f.aegis = null;
    const c = this.f.pos.clone().setY(this.f.pos.y + 1); shards(this.G, c, 24, 5); }
}

/* ---------- 그레이스 생츄어리: 발밑에 펼쳐지는 성역 (안에 선 아군: 회복 · 방어력 · 이동 속도 증가) ---------- */
let _discGeo = null;
class Sanctuary {
  constructor(G, f, p, life = 6.5) {
    this.G = G; this.f = f; this.owner = f; this.p = p.clone(); this.t = 0; this.life = life; this.done = false; this.R = 3.6 * f.scale; this.tick = 0;
    if (!_discGeo) { _discGeo = new THREE.CircleGeometry(1, 64); _discGeo.rotateX(-Math.PI / 2); }
    const gt = holyGlassTex();
    this.mat = new THREE.MeshBasicMaterial({ map: gt, color: HOLY2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ring = new THREE.MeshBasicMaterial({ color: GOLDG, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.g = new THREE.Group(); this.g.position.copy(this.p).setY(this.p.y + 0.03); G.scene.add(this.g);
    this.disc = new THREE.Mesh(_discGeo, this.mat); this.disc.scale.setScalar(this.R); this.g.add(this.disc);
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64), this.ring); this.rim.rotation.x = -Math.PI / 2; this.rim.scale.setScalar(this.R); this.rim.position.y = 0.01; this.g.add(this.rim);
    this.rim2 = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.64, 48), this.ring); this.rim2.rotation.x = -Math.PI / 2; this.rim2.scale.setScalar(this.R); this.rim2.position.y = 0.012; this.g.add(this.rim2);
    for (const m of [this.disc, this.rim, this.rim2]) m.renderOrder = 4;
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.tick -= dt;
    if (this.t > this.life) return this.kill();
    const k = Math.min(1, this.t / 0.4) * Math.min(1, (this.life - this.t) / 0.5);
    this.mat.opacity = 0.32 * k; this.ring.opacity = 0.85 * k; this.disc.rotation.y += dt * 0.25; this.rim2.rotation.z -= dt * 0.6;
    // 위로 떠오르는 빛 · 가장자리 빛기둥
    if (Math.random() < 0.9 * k) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * this.R; G.fx.p(new V3(this.p.x + Math.cos(a) * r, this.p.y + 0.05, this.p.z + Math.sin(a) * r), { vel: [0, rand(1, 2.4), 0], size: rand(0.05, 0.1), size1: 0.01, life: rand(0.8, 1.4), color: [HOLY, HOLY2, PALE, GOLDG][Math.floor(rand(0, 4))], alpha: 0.9, drag: 0.4, flick: 0.4 }); }
    if (this.tick <= 0) { this.tick = 0.25; f.inSanct = false;
      for (const a of allies(f)) { const d = Math.hypot(a.pos.x - this.p.x, a.pos.z - this.p.z); if (d > this.R || a.pos.y - this.p.y > 2.5) continue;
        // 방벽(0.2)이 끝난 뒤에도 같은 상태가 갱신되며 0.2 로 남지 않게 성역 값으로 되돌린다
        const v = a.st.vuln; if (v && v.k < 0.7 && !(a.aegisT > 0)) v.k = 0.7;
        a.addStatus('regen', 0.4, 26, f); a.addStatus('vuln', 0.4, 0.7, f); a.addStatus('haste', 0.4, 1.25, f); if (a === f) f.inSanct = true; } }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.mat.dispose(); this.ring.dispose(); this.rim.geometry.dispose(); this.rim2.geometry.dispose(); this.f.inSanct = false; }
}

/* ---------- 디바인 저지먼트: 방패에서 펼쳐지는 빛의 무장 (날개처럼 퍼진 빛의 칼날) ---------- */
let _bladeGeo = null;
class Armament {
  constructor(G, f, big) {
    this.G = G; this.f = f; this.t = 0; this.life = 0.95; this.done = false; this.big = big;
    if (!_bladeGeo) { const sh = new THREE.Shape(); sh.moveTo(-0.05, 0); sh.quadraticCurveTo(-0.07, 0.3, 0, 0.75); sh.quadraticCurveTo(0.07, 0.3, 0.05, 0); sh.closePath(); _bladeGeo = new THREE.ShapeGeometry(sh, 8); }
    this.mat = new THREE.MeshBasicMaterial({ color: big ? 0xb0a0ff : HOLY, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.g = new THREE.Group(); G.scene.add(this.g); this.blades = [];
    const n = big ? 10 : 7;
    for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1, k = Math.floor(i / 2), a = s * (0.55 + k * 0.42), m = new THREE.Mesh(_bladeGeo, this.mat), c = new THREE.Mesh(_bladeGeo, this.core); c.scale.set(0.35, 0.9, 1); c.position.z = 0.002; m.add(c); m.renderOrder = 12; this.g.add(m); this.blades.push([m, a, 0.8 + k * 0.18 + (big ? 0.25 : 0)]); }
    // 위로 솟는 가운데 칼날
    const top = new THREE.Mesh(_bladeGeo, this.mat); this.g.add(top); this.blades.push([top, 0, big ? 1.5 : 1.15]);
  }
  update(dt) {
    const f = this.f; this.t += dt; if (this.t > this.life || f.state !== 'act' || f.actName !== 'heavy') return this.kill();
    const sh = f.model.shield; sh.updateMatrixWorld(true); this.g.position.setFromMatrixPosition(sh.matrixWorld); this.g.quaternion.setFromRotationMatrix(sh.matrixWorld); this.g.scale.setScalar(f.scale);
    const open = 1 - (1 - Math.min(1, this.t / 0.3)) ** 3, fade = Math.min(1, (this.life - this.t) / 0.2);
    for (const [m, a, L] of this.blades) { m.position.set(Math.sin(a) * 0.28, 0.25 + Math.cos(a) * 0.3, 0.11); m.rotation.set(0, 0, -a * open); m.scale.set(1, L * open * (1 + 0.05 * Math.sin(this.t * 40)), 1); }
    this.mat.opacity = 0.75 * fade; this.core.opacity = 0.9 * fade;
    if (Math.random() < 0.8) { const [m] = this.blades[Math.floor(rand(0, this.blades.length))]; const p = m.localToWorld(new V3(0, 0.6, 0)); this.G.fx.p(p, { vel: [0, 0.5, 0], size: 0.1, size1: 0.01, life: 0.3, color: HOLY2, alpha: 0.9 }); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.mat.dispose(); this.core.dispose(); }
}
function judgment(f, o, G) {
  const big = !!f.judgeBig, fw = f.fwd(new V3()), reach = big ? 3.8 : 3.2;
  // 앞쪽의 적 한 명 (가장 가까운)
  let best = null, bd = 1e9; for (const t of f.foes()) { const d = new V3().subVectors(t.pos, f.pos); const y = d.y; d.y = 0; const L = d.length(); if (L > reach + 0.4 * t.scale || Math.abs(y) > 2.2) continue; if (L > 0.5 && d.normalize().dot(fw) < 0.45) continue; if (L < bd) { bd = L; best = t; } }
  const p0 = shieldFront(f, 0.1); sfx('boom'); sfx('heavy'); G.shake(0.3); G.flash(0xd8d0ff, 0.25);
  for (let i = 0; i < 10; i++) G.fx.p(p0.clone().addScaledVector(fw, i * 0.3), { size: 0.9 - i * 0.05, size1: 0.1, life: 0.25, color: i % 2 ? HOLY : 0xffffff, alpha: 0.8, drag: 0 });
  G.fx.ring(p0.clone().addScaledVector(fw, 0.6), { normal: fw, r0: 0.2, r1: big ? 2.4 : 1.8, life: 0.32, color: HOLY }); G.fx.light(p0, HOLY, 120, 0.35);
  if (!best) return;
  const c = best.chest(new V3()); G.fx.impact(c, HOLY, 1.8, fw); shards(G, c, 18, 6);
  best.takeHit(f, { dmg: big ? 118 : 82, kb: [big ? 13 : 10, 3.2], stun: 0.75, hs: 0.14, shake: 0.3, daze: big ? 60 : 40, snd: 'big' }, foeDir(f, best));
  if (big) best.addStatus('slow', 2.5, 0.6, f);
}

/* ---------- 궁극기: 성광의 대성당 — 대상 둘레에 스테인드글라스 벽이 솟고, 하늘에서 빛의 거대 방패가 내리꽂힌다 ---------- */
let _paneGeo = null;
class Cathedral {
  constructor(G, f, tgt) {
    this.G = G; this.f = f; this.tgt = tgt; this.t = 0; this.done = false; this.c = tgt.pos.clone().setY(0); this.fell = false;
    if (!_paneGeo) { const sh = new THREE.Shape(), w = 0.7, h = 3.4; sh.moveTo(-w, 0); sh.lineTo(-w, h * 0.7); sh.quadraticCurveTo(-w, h * 0.92, 0, h); sh.quadraticCurveTo(w, h * 0.92, w, h * 0.7); sh.lineTo(w, 0); sh.closePath(); _paneGeo = new THREE.ShapeGeometry(sh, 12); const uv = _paneGeo.attributes.uv, p = _paneGeo.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * w) + 0.5, p.getY(i) / h); }
    this.mat = new THREE.MeshBasicMaterial({ map: holyGlassTex(), color: 0xb8c0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.g = new THREE.Group(); this.g.position.copy(this.c); G.scene.add(this.g); this.panes = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, m = new THREE.Mesh(_paneGeo, this.mat); m.position.set(Math.cos(a) * 2.7, -3.6, Math.sin(a) * 2.7); m.rotation.y = -a + Math.PI / 2; m.renderOrder = 11; this.g.add(m); this.panes.push(m); }
    // 빛의 거대 방패 (라이아스의 방패를 본뜬 것)
    this.big = f.model.shield.clone(true); this.big.traverse((o) => { o.castShadow = false; }); this.big.scale.setScalar(4.2 * f.scale); this.big.visible = false; G.scene.add(this.big);
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: HOLY, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); this.glow.scale.set(1.6, 3.4, 0.5); this.big.add(this.glow); this.glow.scale.multiplyScalar(1 / 4.2);
  }
  update(dt) {
    const G = this.G, f = this.f, o = this.tgt; this.t += dt;
    const rise = Math.min(1, this.t / 0.7), y = -3.6 + 3.6 * (1 - (1 - rise) ** 3);
    for (const [i, m] of this.panes.entries()) m.position.y = y + Math.sin(this.t * 3 + i) * 0.02;
    this.mat.opacity = this.fell ? Math.max(0, 0.9 - (this.t - this.fallT) * 1.6) : 0.85 * rise;
    if (!this.fell && Math.random() < 0.8) { const a = rand(0, TAU); G.fx.p(this.c.clone().add(new V3(Math.cos(a) * 2.7, rand(0, 3.4), Math.sin(a) * 2.7)), { vel: [0, 1, 0], size: 0.12, size1: 0.02, life: 0.6, color: [HOLY, HOLY2, PALE][Math.floor(rand(0, 3))], alpha: 0.9 }); }
    // 1.25초: 하늘에 빛의 방패 → 1.75초에 내리꽂힘
    if (this.t > 1.2 && this.t < 1.78) { const k = Math.min(1, (this.t - 1.2) / 0.55); this.big.visible = true; this.big.position.copy(this.c).add(new V3(0, 3.6 + 12 * (1 - k * k), 0)); this.big.rotation.set(0, f.yaw + Math.PI, 0);
      G.fx.p(this.big.position.clone().add(new V3(rand(-1, 1), rand(-2, 2), rand(-0.3, 0.3))), { vel: [0, 8, 0], size: 0.4, size1: 0.05, life: 0.3, color: HOLY2, alpha: 0.8 }); }
    if (!this.fell && this.t >= 1.75) { this.fell = true; this.fallT = this.t; this.impact(); }
    if (this.fell) { const k = (this.t - this.fallT) / 0.6; this.glow.material.opacity = 0.35 * Math.max(0, 1 - k); if (k > 1) this.big.visible = false; }
    if (this.t > 2.6) this.kill();
  }
  impact() {
    const G = this.G, f = this.f, o = this.tgt, c = this.c;
    sfx('boom'); sfx('big'); sfx('block'); G.shake(0.7); G.flash(0xe8e0ff, 0.7); G.stage.flashSky && G.stage.flashSky(0.6); G.slow(0.35, 0.45);
    G.fx.beam(c, { r: 2.4, h: 30, color: HOLY, life: 0.8 }); G.fx.ring(c.clone().setY(0.06), { normal: UP, r0: 0.5, r1: 9, life: 0.8, color: HOLY }); G.fx.ring(c.clone().setY(0.08), { normal: UP, r0: 0.3, r1: 6, life: 0.6, color: 0xffffff });
    G.fx.burst(c.clone().setY(1.2), 120, [HOLY, HOLY2, 0xffffff, GOLDG], 16, { lk: 1.3 }); G.fx.burst(c, 30, 0x8a8aa0, 7, { kind: 'dust', sk: 2 }); G.fx.light(c.clone().setY(1.5), HOLY, 220, 0.9, 24);
    for (const m of this.panes) shards(G, m.getWorldPosition(new V3()).add(new V3(0, 1.6, 0)), 14, 6);
    if (o && !o.gone) { o.release(); o.takeHit(f, { dmg: 210, kb: [4, 12], stun: 0.95, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 100, snd: 'big' }, foeDir(f, o)); }
    for (const t of f.foes()) if (t !== o && Math.hypot(t.pos.x - c.x, t.pos.z - c.z) < 5.5) t.takeHit(f, { dmg: 120, kb: [7, 9], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, c).setY(0).normalize());
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.g); this.G.scene.remove(this.big); this.mat.dispose(); this.glow.geometry.dispose(); this.glow.material.dispose(); const o = this.tgt; if (o && o.held) o.release(); }
}

/* =====================================================================
   기술 — 방패 싸움: 밀쳐 치기 · 모서리 베기 · 올려 치기 · 내리찍기 / 방벽 · 심판 · 성역
   ===================================================================== */
const SW = { br: 0.3 }; // 방패 판정 굵기 (방패 반폭)
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 방패를 발밑으로 내려 가시부터 내리꽂는다 --- */
  ...makePlunge({
    up: 'raise',
    fall: { ...poses.raise, spine: [0.35, 0, 0], head: [0.1, 0, 0], shoulderL: [-0.5, 0, 0.05], elbowL: [-0.3, 0, 0], handL: [0.1, 0, 0], shoulderR: [-1.0, 0, -0.3], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'slam', color: HOLY, dmg: 74, r: 2.5,
    fx: (f, o, G, c) => { shards(G, c.clone().setY(c.y + 0.4), 24, 6); motes(G, c.clone().setY(c.y + 0.3), 16, 5); },
  }),

  /* --- 기본 공격: 밀쳐 치기 → 모서리 베기 → 올려 치기 → 내리찍기 --- */
  light1: { dur: 0.46, cancel: 0.24, next: 'light2', trail: true, track: 0.1, aim: true,
    keys: [[0, 'bashPrep'], [0.1, 'bash'], [0.24, {}], [0.46, 'base']], lunge: [[0.04, 0.15, 6.5]],
    ev: [[0.07, () => sfx('swing')], [0.11, (f, o, G) => { const p = shieldFront(f, 0.3); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.2, life: 0.22, color: HOLY }); motes(G, p, 6, 3); }]],
    hits: [{ t0: 0.06, t1: 0.17, dmg: 30, kb: [3.2, 0], stun: 0.38, daze: 12, ...SW }] },
  light2: { dur: 0.48, cancel: 0.26, next: 'light3', trail: true, track: 0.08, aim: true,
    keys: [[0, 'swipePrep'], [0.14, 'swipe'], [0.28, {}], [0.48, 'base']], lunge: [[0.04, 0.14, 5]],
    ev: [[0.06, () => sfx('swing')], [0.08, (f) => holySlash(f, { tilt: 0.05, r: 2.1, flip: true })]],
    hits: [{ t0: 0.05, t1: 0.17, dmg: 32, kb: [2.6, 0], stun: 0.4, daze: 12, ...SW }] },
  light3: { dur: 0.52, cancel: 0.3, next: 'light4', trail: true, track: 0.08, aim: true,
    keys: [[0, 'upPrep'], [0.12, 'upPrep'], [0.24, 'upper'], [0.36, {}], [0.52, 'base']], lunge: [[0.1, 0.22, 4.5]],
    ev: [[0.13, () => sfx('swing')], [0.16, (f) => holySlash(f, { tilt: Math.PI / 2 - 0.15, r: 2.0, at: [-0.1, 1.2, 0.5] })]],
    hits: [{ t0: 0.13, t1: 0.26, dmg: 36, kb: [2.2, 6.5], stun: 0.5, daze: 14, ...SW }] },
  light4: { dur: 0.7, trail: true, track: 0.16, aim: true, shout: true,
    keys: [[0, 'raise'], [0.18, { ...poses.raise, spine: [-0.25, 0, 0] }], [0.3, 'slam'], [0.48, {}], [0.7, 'base']], lunge: [[0.15, 0.3, 5]],
    start: () => sfx('charge'),
    ev: [[0.22, () => sfx('swing')], [0.3, (f, o, G) => {
      const c = f.model.shieldPt(new V3(), 0, -0.9).setY(f.pos.y + 0.05); sfx('boom'); sfx('heavy'); G.shake(0.3);
      G.fx.ring(c, { normal: UP, r0: 0.3, r1: 2.6, life: 0.4, color: HOLY }); G.fx.ring(c, { normal: UP, r0: 0.2, r1: 1.6, life: 0.3, color: 0xffffff }); shards(G, c.clone().setY(c.y + 0.3), 16, 5); G.fx.burst(c, 16, 0x8a8a9a, 4, { kind: 'dust', sk: 1.3 }); G.fx.light(c.clone().setY(c.y + 1), HOLY, 90, 0.3);
      areaHit(f, c, 1.9 * f.scale, { dmg: 22, kb: [4, 3], stun: 0.45, noCrit: true, daze: 10 }, 0.8);
    }]],
    hits: [{ t0: 0.2, t1: 0.33, dmg: 56, kb: [3, 4.5], stun: 0.6, hs: 0.12, shake: 0.18, daze: 24, snd: 'big', ...SW }] },

  /* --- 우클: 디바인 저지먼트 — 방패의 무장(빛의 칼날 날개)을 펼친 뒤 앞의 적 한 명을 꿰뚫듯 쳐서 멀리 밀어낸다 --- */
  heavy: { dur: 0.95, cd: 'heavy', aim: true, track: 0.35, noMove: true, shout: true,
    keys: [[0, 'aim'], [0.36, { ...poses.aim, shoulderL: [-1.0, 0, -0.05], elbowL: [-1.0, 0, 0] }], [0.44, 'thrust'], [0.7, {}], [0.95, 'base']], lunge: [[0.38, 0.5, 9]],
    start: (f, o, G) => { f.judgeBig = faith(f) >= 100; if (f.judgeBig) { f.faith = 0; G.say(f, '"신념이여, 날개가 되어라."'); } else G.say(f, '"심판을."'); holy(f, 1); sfx('charge'); G.spawn(new Armament(G, f, f.judgeBig)); },
    tick: (f, o, G, t) => { if (t < 0.38 && Math.random() < 0.7) { const p = f.model.tipPos(new V3()); G.fx.p(p.clone().add(new V3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6))), { vel: [0, 0, 0], size: 0.12, size1: 0.02, life: 0.25, color: HOLY2, alpha: 0.9 }); } },
    ev: [[0.46, (f, o, G) => judgment(f, o, G)], [0.85, (f) => holy(f, 0)]],
    end: (f) => { holy(f, 0); f.judgeBig = false; } },

  /* --- Shift: 아이기스 레기스 — 방패를 땅에 세워 원형 방벽 전개: 주위의 적을 밀쳐내고 4초간 받는 피해 80% 감소 --- */
  s1: { dur: 0.75, cd: 's1', aim: false, noMove: true, shout: true,
    keys: [[0, 'raise'], [0.2, 'slam'], [0.55, {}], [0.75, 'base']],
    start: (f, o, G) => { G.say(f, '"이 안은, 누구도 건드리지 못한다."'); sfx('charge'); holy(f, 1); },
    ev: [[0.22, (f, o, G) => {
      const c = f.pos.clone().setY(f.pos.y + 0.05); sfx('boom'); sfx('block'); G.shake(0.35); G.flash(0xc8c0ff, 0.25);
      if (f.aegis) f.aegis.kill(); G.spawn(new Aegis(G, f, 4));
      G.fx.ring(c, { normal: UP, r0: 0.3, r1: 3.2, life: 0.45, color: HOLY }); G.fx.ring(f.chest(new V3()), { r0: 0.3, r1: 3, life: 0.35, color: PALE, billboard: true });
      shards(G, c.clone().setY(c.y + 0.5), 26, 6); G.fx.light(c.clone().setY(1.2), HOLY, 120, 0.4);
      areaHit(f, c, 2.7 * f.scale, { dmg: 40, kb: [8.5, 2.5], stun: 0.55, hs: 0.08, daze: 20, snd: 'big' }, 1.4);
    }], [0.6, (f) => holy(f, 0)]],
    end: (f) => holy(f, 0) },

  /* --- E: 그레이스 생츄어리 — 방패를 치켜들어 발밑에 성역을 편다 (6.5초 · 안에 선 아군 회복 · 피해 30% 감소 · 이동 속도 ×1.25) --- */
  s2: { dur: 0.8, cd: 's2', aim: false, shout: true, move: 0.15,
    keys: [[0, { ...poses.raise, handL: [0.6, 0, 0] }], [0.25, 'skyward'], [0.6, {}], [0.8, 'base']],
    start: (f, o, G) => { G.say(f, '"은총이 머무는 곳으로."'); sfx('charge'); holy(f, 1); },
    ev: [[0.28, (f, o, G) => {
      sfx('zap'); const c = f.pos.clone(); G.spawn(new Sanctuary(G, f, c)); G.fx.beam(c, { r: 1.0, h: 14, color: HOLY2, life: 0.7 });
      const p = f.model.tipPos(new V3()); G.fx.light(p, HOLY2, 120, 0.5); motes(G, p, 26, 5, [HOLY2, PALE, GOLDG]); G.fx.ring(c.clone().setY(c.y + 0.06), { normal: UP, r0: 0.3, r1: 3.6, life: 0.5, color: GOLDG });
    }], [0.7, (f) => holy(f, 0)]],
    end: (f) => holy(f, 0) },

  /* --- 극한 회피 뒤 좌클: 성벽 돌진 — 상대 앞으로 빛처럼 파고들어 방패로 들이받는다 --- */
  counter: { dur: 0.62, aim: true, trail: true,
    keys: [[0, 'bashPrep'], [0.08, 'bash'], [0.36, {}], [0.62, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest(); if (o) { const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(d, 0.95 + 0.3 * o.scale); f.faceOpp(); }
      for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.chest(), i / 8), { size: 0.9, size1: 0.2, life: 0.3, color: HOLY, alpha: 0.7 });
      sfx('dash'); G.flash(HOLY, 0.2); f.model.resetCloth(); holy(f, 1);
    }], [0.08, (f, o, G) => { sfx('heavy'); sfx('block'); const p = shieldFront(f, 0.4); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.9, life: 0.3, color: HOLY }); shards(G, p, 14, 5); }], [0.4, (f) => holy(f, 0)]],
    hits: [{ t0: 0.04, t1: 0.2, weapon: false, at: [0, 1.1, 0.85], r: 0.75, dmg: 90, kb: [8, 3], stun: 0.6, hs: 0.13, shake: 0.18, daze: 40, snd: 'big' }],
    end: (f) => holy(f, 0) },

  /* --- Q: 성광의 대성당 — 대상을 스테인드글라스 벽으로 가두고, 하늘에서 빛의 거대 방패를 내리꽂는다 --- */
  ult: { dur: 3.1, ult: true, aim: true, shout: true,
    keys: [[0, 'aim'], [0.35, 'skyward'], [1.45, 'skyward'], [1.62, 'raise'], [1.76, 'slam'], [2.5, {}], [3.1, 'win']],
    cam: [[0, { ref: 'self', p: [1.0, 0.8, 2.6], l: [0, 1.2, 0], fov: 40 }], [0.4, { ref: 'self', p: [1.6, 0.6, 2.2], l: [0, 2.0, 0], fov: 46 }],
      [0.8, { ref: 'target', p: [5.5, 2.2, -4], l: [0, 1.6, 0], fov: 56 }], [1.3, { ref: 'target', p: [4, 1.2, -6.5], l: [0, 4.5, 0], fov: 60 }],
      [1.8, { ref: 'target', p: [6, 2.6, -6], l: [0, 1.4, 0], fov: 58 }], [3.1, { ref: 'target', p: [7, 3.4, -7], l: [0, 1.4, 0], fov: 56 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(0x3a2a8a, 0.32); holy(f, 1); sfx('charge'); G.say(f, '"부서지지 않는 맹세의 이름으로."'); motes(G, f.chest(new V3()), 30, 4); }],
      [0.4, (f, o, G) => { o = f.ultTgt || o; if (!o) return; sfx('zap'); G.fx.beam(f.model.tipPos(new V3()), { r: 0.5, h: 20, color: HOLY, life: 0.6 }); f.cath = new Cathedral(G, f, o); G.spawn(f.cath); }],
      [1.0, (f, o, G) => G.say(f, '"…무너져라."')],
      [1.76, (f, o, G) => { const c = f.model.shieldPt(new V3(), 0, -0.9).setY(f.pos.y + 0.05); G.fx.ring(c, { normal: UP, r0: 0.3, r1: 2.4, life: 0.4, color: HOLY }); shards(G, c, 16, 5); }],
    ],
    tick: (f, o, G, t, dt) => {
      const tg = f.ultTgt; if (!tg || t < 0.5 || t > 1.7) return;
      // 유리벽 안: 빛의 파편이 계속 대상을 벤다 (작은 피해 · 쓰러지지 않음)
      f.cutAcc = (f.cutAcc || 0) + dt; while (f.cutAcc >= 0.16) { f.cutAcc -= 0.16; const c = tg.chest(new V3()), a = rand(0, TAU), d = new V3(Math.cos(a), rand(-0.4, 0.6), Math.sin(a)).normalize();
        G.fx.slash(c, { fwd: d, normal: new V3(-d.z, 0.3, d.x).normalize(), r: 1.2, color: HOLY2, life: 0.18 }); sfx('swing');
        tg.takeHit(f, { dmg: 8, kb: [0, 0], stun: 99, hs: 0.01, nokill: true, noScale: true, force: true, noCrit: true, daze: 6, snd: 'hit' }, d.clone().setY(0).normalize()); }
    },
    end: (f, o, G) => { G.setTint(0, 0); holy(f, 0); const tg = f.ultTgt; if (tg && tg.held) tg.release(); f.cutAcc = 0; } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60;
  G.fx.impact(p, HOLY, big ? 1.7 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.5 : 1.0, color: big ? HOLY2 : HOLY, life: 0.2 });
  shards(G, p, big ? 10 : 4, 4);
  addFaith(att, h.dmg * 0.22);
}

// 신념: 받은 피해 · 막은 공격으로도 쌓인다 (모델 갱신 때 체력 변화를 본다)
function createModelWithFaith(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (f._lastHp !== undefined && f.hp < f._lastHp && f.state !== 'ko') addFaith(f, (f._lastHp - f.hp) * (f.state === 'guard' ? 1.6 : 0.35));
    f._lastHp = f.hp;
    if (faith(f) >= 100 && f.root.visible && Math.random() < 0.3) { const p = m.tipPos(new V3()); f.G.fx.p(p.clone().add(new V3(rand(-0.3, 0.3), rand(-0.4, 0.4), 0)), { vel: [0, 0.7, 0], size: 0.09, size1: 0.02, life: 0.5, color: GOLDG, alpha: 0.9, drag: 1 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(f.palette.accent);
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist < 3.2 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist < 2.6 && f.cd.s1 <= 0 && (f.hp < f.maxHp * 0.75 || o.state === 'act') && Math.random() < 0.35) return 's1';
  if (f.cd.s2 <= 0 && f.hp < f.maxHp * 0.65 && Math.random() < 0.3) return 's2';
  return null;
}

export default {
  id: 'guardian', name: '라이아스', short: '라이아스', title: 'GUARDIAN · 부서지지 않는 방패', scale: 1.0,
  desc: '근거리 · 탱커 · 수호. 스테인드글라스 방패 하나로 모든 것을 막아서는 젊은 수호기사. 방패로 밀쳐 치고 모서리로 베며, 원형 방벽으로 적을 밀어내고, 성역으로 자신과 아군을 지킨다. 맞고 막고 때릴수록 신념이 차오르고, 가득 차면 디바인 저지먼트가 성광의 날개를 펼친다.',
  stats: { hp: 1150, speed: 7.0, jump: 9.5, crit: 0.15 },
  palettes: [{ accent: HOLY, holy: HOLY, band: '#1a1440' }, { accent: 0xffb84a, holy: 0xffb84a, band: '#3a2408' }],
  skills: { heavy: { name: '디바인 저지먼트', cd: 8 }, s1: { name: '아이기스 레기스', cd: 15 }, s2: { name: '그레이스 생츄어리', cd: 18 }, ult: { name: '성광의 대성당', sub: 'THE SHIELD THAT NEVER BROKE' } },
  aiPick,
  resource: (f) => faith(f) >= 100 ? { v: 1, label: '신념', color: 0xffd88a, full: true } : { v: faith(f) / 100, label: '신념', color: 0x8a7aff },
  moveList: [['좌클 ×4', '방패 밀쳐 치기 30 → 모서리 베기 32 → 올려 치기 36(띄움) → 내리찍기 56 + 충격파 22'], ['공중 좌클', '방패 가시부터 내리꽂아 빛의 파편 폭발 74'],
    ['우클 · 디바인 저지먼트', '방패의 무장(빛의 칼날 날개)을 펼친 뒤 앞의 적 한 명을 쳐서 멀리 밀어냄 82. 신념이 가득 차면 118 + 둔화'],
    ['Shift · 아이기스 레기스', '원형 방벽 전개: 반경 2.7m 적 밀쳐내기 40 → 4초간 받는 피해 80% 감소 · 다가오는 적을 밀어냄'],
    ['E · 그레이스 생츄어리', '발밑에 성역 6.5초: 안에 선 본인·아군 초당 26 회복 · 받는 피해 30% 감소 · 이동 속도 ×1.25'],
    ['Q · 성광의 대성당', '대상 둘레에 스테인드글라스 벽이 솟아 가두고 빛의 파편으로 베다가, 하늘에서 빛의 거대 방패를 내리꽂는다 210'],
    ['신념', '때리거나 맞거나 막을수록 차오르고, 가득 차면 다음 디바인 저지먼트 강화'], ['C (타이밍) · 극한 회피', '성벽 돌진: 상대 앞으로 파고들어 방패로 들이받기 90'], ['가만히', '방패를 땅에 세우고 고개를 숙인 채 기다림']],
  onReset: (f) => { f.faith = 0; f.holyK = 0; f.aegisT = 0; f.aegis = null; f.inSanct = false; f.judgeBig = false; f.cutAcc = 0; f._lastHp = undefined; f.ultTgt = null; },
  createModel: createModelWithFaith, poses, moves, hitFx,
};
