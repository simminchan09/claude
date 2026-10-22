// 클라운 (CLOWN · 차원의 광대) — 근·중거리 · 넓은 낫 휘두르기 · 출혈 · 약화 · 차원문 순간이동
// 차원의 틈을 넘나드는 적 진영의 광대 소녀. 큰 장대 낫을 춤추듯 휘둘러 피를 흩뿌리고, 기분 나쁜 웃음으로 적을 조롱하며,
// 다이아몬드 차원문을 열어 적의 등 뒤로 넘어가 치명타를 꽂는다.
// 무기: 진홍 초승달 날의 장대 낫 — 맞힐수록 광기가 차오르고, 가득 차면 피의 무도가 세 바퀴 광란으로 바뀐다.
import * as THREE from 'three';
import { rand, sfx } from '../core.js';
import { createModel, CRIM, MAG, BLOOD, GOLDC, VOID, diaShape } from './clown_model.js';
import { makePlunge } from '../plunge.js';
import { JI } from '../rig.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);

/* =====================================================================
   포즈 (weapon = 몸 기준 [피치(위+), 좌우(오른쪽+), 롤])
   롤 규칙: 오른→왼 가로 베기 +1.57 · 왼→오른 −1.57 · 내려베기 0 · 올려베기 π (날이 휘두르는 쪽을 향함)
   ===================================================================== */
const poses = {
  // 기본: 낫을 오른손에 세워 들고(날은 오른쪽 위 바깥으로) 왼손은 허리에 — 고개를 살짝 갸웃
  base: { hips: [0, 0.18, 0], spine: [0.03, -0.06, 0], chest: [0.02, -0.08, 0], head: [0.05, 0.1, 0.08],
    shoulderR: [-0.42, 0, -0.24], elbowR: [-1.3, 0, 0], weapon: [1.22, 0.3, -1.2], shoulderL: [0.05, 0, 0.14], elbowL: [-0.5, 0, 0],
    hipL: [-0.14, 0, 0.07], kneeL: [0.2, 0, 0], footL: [-0.06, 0, 0], hipR: [0.1, 0, -0.09], kneeR: [0.14, 0, 0], footR: [0, 0, 0] },
  run: { hips: [0, -0.1, 0], spine: [0.34, 0.05, 0], chest: [0.06, 0.05, 0], head: [-0.22, 0, 0], shoulderR: [0.45, 0, -0.3], elbowR: [-0.35, 0, 0], weapon: [-0.15, 2.75, 1.4], shoulderL: [0.3, 0, 0.2], elbowL: [-1.0, 0, 0],
    hipL: [0, 0, 0], kneeL: [0.25, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.25, 0, 0], footR: [0, 0, 0] },
  jump: { hipL: [-1.1, 0, 0.1], kneeL: [1.8, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [1.2, 0, 0], shoulderL: [-0.6, 0, 0.45], elbowL: [-0.7, 0, 0], shoulderR: [-0.35, 0, -0.55], elbowR: [-0.95, 0, 0], weapon: [1.15, 0.45, -1.2] },
  // 방어: 낫 자루를 몸 앞에 비스듬히 세운다 (왼손 IK 로 자루를 잡음)
  guard: { hips: [0, -0.2, 0], spine: [0.15, 0.12, 0], chest: [0.05, 0.12, 0], shoulderR: [-0.9, 0, -0.15], elbowR: [-1.4, 0, 0], weapon: [0.75, -1.25, 1.57],
    hipL: [-0.5, 0, 0.2], kneeL: [0.85, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.65, 0, 0] },
  hit: { spine: [-0.35, 0, 0], chest: [-0.15, 0.2, 0], head: [-0.35, 0, 0], shoulderR: [0.3, 0, -0.5], elbowR: [-0.6, 0, 0], weapon: [1.1, 0.6, -1.2], shoulderL: [0.4, 0, 0.6], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.5, 0, -0.9], weapon: [0.35, 2.4, 1.3], shoulderL: [0.5, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.74, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0], weapon: [0.05, -0.9, 1.57],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.7, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [-0.1, 2.8, 1.4], shoulderL: [0.6, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.5, 0, 0], kneeR: [1.1, 0, 0] },
  // 승리: 왼손으로 모자 챙을 잡고 인사 · 낫은 곧게 세워 짚음
  win: { hips: [0, 0.25, 0], spine: [0.08, 0.1, 0], chest: [0.05, 0.1, 0], head: [0.15, 0.1, 0.12], shoulderR: [-0.25, 0, -0.32], elbowR: [-0.75, 0, 0], weapon: [1.5, 0.25, -1.25],
    shoulderL: [-2.5, 0, 0.45], elbowL: [-1.75, 0, 0], hipL: [-0.15, 0, 0.06], kneeL: [0.25, 0, 0], footL: [-0.15, 0, 0], hipR: [0.05, 0, -0.08], kneeR: [0.05, 0, 0] },
  // 컷인: 모자 챙을 잡고 낫을 비스듬히 어깨에
  portrait: { hips: [0, 0.3, 0], chest: [0, -0.15, 0], head: [0.06, 0.15, 0.1], shoulderR: [-0.9, 0, -0.35], elbowR: [-1.3, 0, 0], weapon: [1.0, -0.55, -1.2], shoulderL: [-2.5, 0, 0.45], elbowL: [-1.75, 0, 0] },
  // 오른쪽 뒤로 감은 낫 → 왼쪽으로 크게 쓸어 베기
  windR: { hips: [0, -0.5, 0], spine: [0.1, -0.35, 0], chest: [0.02, -0.45, 0], head: [0, 0.55, 0], shoulderR: [-1.0, 0, -0.85], elbowR: [-0.7, 0, 0], weapon: [0.15, 2.05, 1.57], shoulderL: [-0.6, 0, 0.4], elbowL: [-1.1, 0, 0],
    hipL: [-0.4, 0, 0.12], kneeL: [0.5, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.4, 0, 0] },
  slashL: { hips: [0, 0.5, 0], spine: [0.2, 0.42, 0], chest: [0.05, 0.5, 0], head: [0, -0.6, 0], shoulderR: [-1.35, 0, 0.45], elbowR: [-0.15, 0, 0], weapon: [0.0, -1.75, 1.57], shoulderL: [0.3, 0, 0.7], elbowL: [-0.5, 0, 0],
    hipL: [-0.8, 0, 0.12], kneeL: [0.85, 0, 0], hipR: [0.45, 0, -0.12], kneeR: [0.35, 0, 0] },
  // 왼쪽 아래 → 오른쪽 위 올려베기
  windLow: { hips: [0, 0.5, 0], spine: [0.38, 0.35, 0], chest: [0.1, 0.4, 0], head: [-0.2, -0.6, 0], shoulderR: [-0.55, 0, 0.55], elbowR: [-0.5, 0, 0], weapon: [-0.65, -1.45, -1.57],
    hipL: [-0.8, 0, 0.15], kneeL: [1.0, 0, 0], hipR: [0.5, 0, -0.15], kneeR: [0.6, 0, 0] },
  slashUp: { hips: [0, -0.4, 0], spine: [-0.15, -0.35, 0], chest: [-0.1, -0.45, 0], head: [-0.25, 0.5, 0], shoulderR: [-2.6, 0, -0.55], elbowR: [-0.25, 0, 0], weapon: [1.05, 1.2, -1.57], shoulderL: [-0.2, 0, 0.7], elbowL: [-0.8, 0, 0] },
  // 낫을 수평으로 뻗은 회전 자세
  spin: { hips: [0, 0, 0], spine: [0.2, 0, 0], chest: [0.05, 0, 0], head: [0.1, 0, 0], shoulderR: [-1.45, 0, -1.15], elbowR: [-0.08, 0, 0], weapon: [0.05, 1.57, 1.57], shoulderL: [-0.5, 0, 1.25], elbowL: [-0.3, 0, 0],
    hipL: [-0.6, 0, 0.25], kneeL: [0.9, 0, 0], hipR: [0.4, 0, -0.2], kneeR: [0.7, 0, 0] },
  // 바통 돌리기: 낫을 앞으로 내밀어 손목으로 빙빙 돌린다
  twirl: { hips: [0, 0.1, 0], spine: [0.1, 0, 0], chest: [0.05, 0, 0], head: [0, 0, 0], shoulderR: [-1.4, 0, -0.05], elbowR: [-0.5, 0, 0], shoulderL: [-0.4, 0, 0.5], elbowL: [-1.4, 0, 0],
    hipL: [-0.3, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.25, 0, -0.1], kneeR: [0.25, 0, 0] },
  // 왼손으로 카드를 뽑아 던지기
  cardWind: { hips: [0, 0.5, 0], spine: [0.05, 0.4, 0], chest: [0, 0.45, 0], head: [0, -0.6, 0], shoulderL: [-1.0, 0, -0.6], elbowL: [-1.8, 0, 0], shoulderR: [-0.3, 0, -0.4] },
  cardThrow: { hips: [0, -0.4, 0], spine: [0.15, -0.35, 0], chest: [0.05, -0.4, 0], head: [0, 0.45, 0], shoulderL: [-1.5, 0, 0.9], elbowL: [-0.1, 0, 0], shoulderR: [-0.3, 0, -0.5],
    hipL: [-0.5, 0, 0.12], kneeL: [0.6, 0, 0], hipR: [0.35, 0, -0.12], kneeR: [0.3, 0, 0] },
  // 머리 위로 크게 치켜든 자세 (날이 앞을 향해 매달림)
  raised: { hips: [0, 0, 0], spine: [-0.18, 0, 0], chest: [-0.1, 0, 0], head: [-0.25, 0, 0], shoulderR: [-3.0, 0, -0.2], elbowR: [-0.45, 0, 0], weapon: [2.3, 0, 0], shoulderL: [-2.7, 0, 0.25], elbowL: [-0.5, 0, 0],
    hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.2, 0, 0] },
  // 내려찍은 직후: 상체를 숙이고 날이 앞쪽 땅에 박힘
  reap: { hips: [0, -0.15, 0], spine: [0.7, 0, 0], chest: [0.2, 0, 0], head: [-0.4, 0, 0], shoulderR: [-1.0, 0, -0.08], elbowR: [-0.1, 0, 0], weapon: [-0.75, 0, 0], shoulderL: [-0.9, 0, 0.1], elbowL: [-0.2, 0, 0],
    hipL: [-1.1, 0, 0.12], kneeL: [1.3, 0, 0], hipR: [0.6, 0, -0.12], kneeR: [0.4, 0, 0] },
  // 조롱의 환희: 몸을 젖히고 입가에 손을 대고 웃음
  laugh: { hips: [0, -0.2, 0], spine: [-0.25, -0.1, 0], chest: [-0.18, -0.15, 0], head: [-0.35, 0.2, -0.15], shoulderR: [-0.3, 0, -0.6], elbowR: [-0.6, 0, 0], weapon: [1.2, 0.8, -1.3], shoulderL: [-1.3, 0, 0.1], elbowL: [-2.3, 0, 0],
    hipL: [-0.1, 0, 0.1], kneeL: [0.25, 0, 0], hipR: [0.25, 0, -0.1], kneeR: [0.1, 0, 0] },
  // 궁극기 인사: 왼손으로 모자를 벗듯 들고 허리를 숙인다
  bow: { hips: [0, 0.15, 0], spine: [0.45, 0, 0], chest: [0.2, 0, 0], head: [0.25, 0, 0], shoulderR: [-0.3, 0, -0.85], elbowR: [-0.3, 0, 0], weapon: [0.6, 1.7, -1.4], shoulderL: [-1.6, 0, 0.3], elbowL: [-1.2, 0, 0],
    hipL: [0.1, 0, 0.08], kneeL: [0.35, 0, 0], footL: [-0.1, 0, 0], hipR: [-0.35, 0, -0.06], kneeR: [0.2, 0, 0] },
};
Object.assign(poses, {
  // 오래 가만히 있으면: 낫 자루에 몸을 기대고 고개를 갸웃
  idle2: { hips: [0, 0.4, 0.05], spine: [0.05, 0.1, -0.08], chest: [0.02, 0.15, -0.05], head: [0.1, -0.25, -0.22], shoulderR: [-0.5, 0, -0.1], elbowR: [-1.3, 0, 0], weapon: [1.3, -0.1, -1.4], shoulderL: [-0.7, 0, 0.1], elbowL: [-1.9, 0, 0],
    hipL: [-0.05, 0, 0.12], kneeL: [0.1, 0, 0], hipR: [-0.25, 0, -0.04], kneeR: [0.45, 0, 0], footR: [0.25, 0, 0] },
});

/* =====================================================================
   이펙트 · 도구
   ===================================================================== */
const mad = (f) => (f.madness || 0);
const rift = (f, k) => { f.riftK = k; };
const ac = (f) => f.palette.accent, ac2 = (f) => f.palette.accent2 ?? MAG;
const redSlash = (f, o) => f.slashFx({ r: o.r || 2.3, color: o.color ?? ac(f), life: o.life ?? 0.26, tilt: o.tilt || 0, flip: o.flip, at: o.at || [0, 1.1, 0.4] });
// 핏방울: 아래로 떨어지는 짙은 붉은 입자
function blood(G, p, n = 10, sp = 4) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2))), { vel: [rand(-sp, sp), rand(0, sp * 0.8), rand(-sp, sp)], size: rand(0.05, 0.1), size1: 0.02, life: rand(0.4, 0.8), color: i % 3 ? BLOOD : 0xff2a4a, alpha: 0.95, drag: 1.5, grav: 12 }); }
// 트럼프 카드 조각 같은 반짝임 (다이아 입자)
function sparkles(G, p, n = 8, col = MAG, sp = 3) { for (let i = 0; i < n; i++) G.fx.p(p.clone().add(new V3(rand(-0.4, 0.4), rand(-0.3, 0.5), rand(-0.4, 0.4))), { vel: [rand(-sp, sp), rand(0, sp), rand(-sp, sp)], size: rand(0.06, 0.12), size1: 0.01, life: rand(0.4, 0.8), color: i % 2 ? col : 0xffffff, alpha: 0.9, drag: 2, flick: 0.5 }); }
function slashLine(G, a, b, color, w = 1) {
  const d = new V3().subVectors(b, a), L = d.length(); d.normalize(); const n = Math.max(3, Math.round(L / 0.45));
  for (let i = 0; i <= n; i++) G.fx.p(a.clone().addScaledVector(d, (i / n) * L), { size: 0.5 * w, size1: 0.05, life: 0.3, color: i % 2 ? color : 0xffffff, alpha: 0.85, drag: 0 });
  G.fx.slash(a.clone().add(b).multiplyScalar(0.5), { fwd: d, normal: new V3().crossVectors(d, UP).normalize().add(UP).normalize(), r: L * 0.55, color, life: 0.3 });
}
// 대상 주위 원형 판정 (명중한 대상을 돌려줌)
function circleHit(f, c, R, h, maxY = 1.6) {
  const out = [];
  for (const t of f.foes()) { const dx = t.pos.x - c.x, dz = t.pos.z - c.z, d = Math.hypot(dx, dz); if (d > R + 0.45 * t.scale || Math.abs(t.pos.y - c.y) > maxY) continue;
    const r = t.takeHit(f, h, d > 0.01 ? new V3(dx / d, 0, dz / d) : f.fwd(new V3())); if (r === 'hit') out.push(t); }
  return out;
}
// 확정 치명타 (플레이어 쪽만 치명타가 있음 — 판정 순간에만 치명타 확률을 1로)
function critHit(f, t, h, dir) { return t.takeHit(f, { ...h, crit: true }, dir); } // 확정 치명타 (엔진 h.crit)

/* ---------- 다이아몬드 차원문: 금 테 · 소용돌이치는 진홍 틈 ---------- */
let _portal = null;
function portalAssets() {
  if (_portal) return _portal;
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d');
  const gr = g.createRadialGradient(W / 2, W / 2, 4, W / 2, W / 2, W / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, '#ffb0e0'); gr.addColorStop(0.45, '#c0106a'); gr.addColorStop(0.8, '#3a0420'); gr.addColorStop(1, '#100008'); g.fillStyle = gr; g.fillRect(0, 0, W, W);
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 5; k++) { g.strokeStyle = `rgba(255,${120 + k * 20},${200},0.35)`; g.lineWidth = 6 - k * 0.8; g.beginPath(); for (let i = 0; i < 120; i++) { const a = i * 0.09 + (k / 5) * TAU, r = i * 1.05; g.lineTo(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r); } g.stroke(); }
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
  const swirl = new THREE.CanvasTexture(c); swirl.colorSpace = THREE.SRGBColorSpace; swirl.center.set(0.5, 0.5);
  const inner = new THREE.ShapeGeometry(diaShape(0.5, 0.8), 1), p = inner.attributes.position, uv = inner.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + 0.5, p.getY(i) / 1.6 + 0.5);
  const glow = new THREE.ShapeGeometry(diaShape(0.62, 0.98), 1);
  const pts = []; for (const [a, b] of [[[0, 0.8], [0.5, 0]], [[0.5, 0], [0, -0.8]], [[0, -0.8], [-0.5, 0]], [[-0.5, 0], [0, 0.8]]]) for (let i = 0; i < 8; i++) pts.push(new V3(a[0] + (b[0] - a[0]) * i / 8, a[1] + (b[1] - a[1]) * i / 8, 0));
  const frame = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.1), 96, 0.03, 6, true);
  const frame2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => q.clone().multiplyScalar(1.12)), true, 'catmullrom', 0.1), 96, 0.012, 5, true);
  _portal = { swirl, inner, glow, frame, frame2 };
  return _portal;
}
class Portal {
  // pos: 중심, n: 문이 바라보는 방향, size: 높이 배율(1 = 1.6m), life: 유지 시간
  constructor(G, pos, n, size = 1, life = 0.9, color = MAG) {
    const A = portalAssets(); this.G = G; this.t = 0; this.life = life; this.done = false; this.size = size; this.color = color;
    this.g = new THREE.Group(); this.g.position.copy(pos); this.g.lookAt(pos.clone().add(n)); G.scene.add(this.g);
    this.mIn = new THREE.MeshBasicMaterial({ map: A.swirl, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
    this.mGlow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mFr = new THREE.MeshStandardMaterial({ color: GOLDC, metalness: 1, roughness: 0.3, emissive: 0x5a3a10, emissiveIntensity: 0.6 });
    const add = (geo, mat, z = 0) => { const me = new THREE.Mesh(geo, mat); me.position.z = z; me.frustumCulled = false; this.g.add(me); return me; };
    add(A.glow, this.mGlow, -0.01); add(A.inner, this.mIn); add(A.frame, this.mFr); add(A.frame2, this.mFr);
    this.g.scale.setScalar(0.01); sfx('zap');
  }
  update(dt) {
    const G = this.G; this.t += dt; const k = Math.min(1, this.t / 0.16) * Math.min(1, Math.max(0, (this.life - this.t) / 0.18));
    this.g.scale.set(this.size * (0.3 + 0.7 * k), this.size * k, this.size); this.portalSpin = (this.portalSpin || 0) - dt * 3; portalAssets().swirl.rotation = G.time * -2.5;
    this.mGlow.opacity = 0.3 + 0.15 * Math.sin(this.t * 20);
    if (k > 0.5 && Math.random() < 0.6) { const a = rand(0, TAU), p = this.g.localToWorld(new V3(Math.cos(a) * 0.35, Math.sin(a) * 0.6, 0.05)); G.fx.p(p, { vel: [rand(-1, 1), rand(0, 1.5), rand(-1, 1)], size: 0.08, size1: 0.01, life: 0.5, color: Math.random() < 0.5 ? this.color : 0xffffff, alpha: 0.9, drag: 1.5 }); }
    if (this.t >= this.life) this.kill();
  }
  kill() { if (this.done && !this.g.parent) return; this.done = true; this.G.scene.remove(this.g); this.mIn.dispose(); this.mGlow.dispose(); this.mFr.dispose(); }
}
function openPortal(G, pos, n, size, life, color) { const p = new Portal(G, pos, n, size, life, color); G.spawn(p); G.fx.light(pos, color ?? MAG, 70, 0.3, 10); return p; }

/* ---------- 트럼프 카드: 빙글빙글 돌며 일직선으로 날아가는 칼날 카드 ---------- */
let _cardGeo = null, _cardTex = null;
class Card {
  constructor(G, f, from, dir) {
    if (!_cardGeo) { _cardGeo = new THREE.BoxGeometry(0.12, 0.004, 0.17); const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#f8f2ea'; g.fillRect(0, 0, 64, 96); g.strokeStyle = '#b01030'; g.lineWidth = 4; g.strokeRect(4, 4, 56, 88); g.fillStyle = '#c01030'; g.beginPath(); g.moveTo(32, 26); g.lineTo(46, 48); g.lineTo(32, 70); g.lineTo(18, 48); g.closePath(); g.fill(); _cardTex = new THREE.CanvasTexture(c); _cardTex.colorSpace = THREE.SRGBColorSpace; }
    this.G = G; this.f = f; this.pos = from.clone(); this.dir = dir.clone().normalize(); this.t = 0; this.done = false;
    this.mat = new THREE.MeshBasicMaterial({ map: _cardTex }); this.mesh = new THREE.Mesh(_cardGeo, this.mat); this.mesh.position.copy(this.pos); G.scene.add(this.mesh);
  }
  update(dt) {
    const G = this.G, f = this.f; this.t += dt; this.pos.addScaledVector(this.dir, 24 * dt); this.mesh.position.copy(this.pos); this.mesh.rotation.y += dt * 30;
    if (Math.random() < 0.6) G.fx.p(this.pos, { size: 0.12, size1: 0.02, life: 0.2, color: MAG, alpha: 0.7, drag: 0 });
    for (const t of f.foes()) if (t.hurtHit(this.pos, 0.22)) { if (t.takeHit(f, { dmg: 12, basic: true }, this.dir.clone().setY(0).normalize())) sparkles(G, this.pos, 6, MAG, 3); return this.kill(); }
    const W = G.stage && G.stage.world;
    if (this.t > 0.6 || this.pos.y < 0.05 || (W && W.solidAt(this.pos, 0.1))) this.kill();
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.mat.dispose(); }
}

/* ---------- 조롱의 환희: 대상 머리 위에 떠오르는 섬뜩한 미소 (약화 표식) ---------- */
let _grin = null;
function grinTex() {
  if (_grin) return _grin;
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const mouth = new Path2D(); mouth.moveTo(40, 70); mouth.quadraticCurveTo(256, 150, 472, 70); mouth.quadraticCurveTo(470, 110, 440, 130); mouth.quadraticCurveTo(256, 250, 72, 130); mouth.quadraticCurveTo(42, 110, 40, 70); mouth.closePath();
  g.shadowColor = '#ff2ab0'; g.shadowBlur = 40; g.fillStyle = '#ff3ab8'; g.fill(mouth); g.shadowBlur = 0;
  g.save(); g.clip(mouth); g.fillStyle = '#2a0018'; g.beginPath(); g.moveTo(70, 92); g.quadraticCurveTo(256, 170, 442, 92); g.quadraticCurveTo(256, 222, 70, 92); g.fill();
  g.fillStyle = '#fff4fa'; for (let i = 0; i < 13; i++) { const x = 84 + i * 27, y0 = 92 + 0.0026 * (x - 256) ** 2 * -1 + 50 * Math.sin(Math.PI * (x - 70) / 372); g.beginPath(); g.moveTo(x - 12, y0 - 8); g.lineTo(x + 12, y0 - 8); g.lineTo(x, y0 + 16); g.closePath(); g.fill(); }
  g.restore(); g.strokeStyle = '#ffd0f0'; g.lineWidth = 5; g.stroke(mouth);
  _grin = new THREE.CanvasTexture(c); _grin.colorSpace = THREE.SRGBColorSpace; return _grin;
}
class GrinMark {
  constructor(G, f, tgt, life, big) {
    this.G = G; this.f = f; this.tgt = tgt; this.t = 0; this.life = life; this.done = false; this.big = big;
    this.mat = new THREE.SpriteMaterial({ map: grinTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.s = new THREE.Sprite(this.mat); this.s.frustumCulled = false; G.scene.add(this.s);
  }
  update(dt) {
    const G = this.G, t = this.tgt; this.t += dt;
    if (this.t > this.life || !t || t.gone || t.state === 'ko' || (!this.big && !(t.stK('vuln') > 1))) return this.kill();
    const k = Math.min(1, this.t / 0.2) * Math.min(1, (this.life - this.t) / 0.4), wob = Math.sin(this.t * 9);
    this.mat.opacity = (this.big ? 0.95 : 0.75) * k * (0.85 + 0.15 * wob);
    const sc = this.big ? 2.6 + 0.4 * Math.min(1, this.t * 4) : 0.75; this.s.scale.set(sc * t.scale, sc * 0.5 * t.scale, 1);
    this.s.position.set(t.pos.x, t.pos.y + (this.big ? 2.7 : 2.25) * t.scale + 0.06 * wob, t.pos.z);
    if (!this.big && Math.random() < dt * 5) G.fx.p(this.s.position.clone(), { vel: [rand(-0.5, 0.5), 0.6, rand(-0.5, 0.5)], size: 0.07, size1: 0.01, life: 0.6, color: MAG, alpha: 0.8, drag: 1 });
  }
  kill() { if (this.done && !this.s.parent) return; this.done = true; this.G.scene.remove(this.s); this.mat.dispose(); }
}

/* ---------- 피의 무도: 몸을 돌며 큰 원을 그리는 낫 (회전마다 원형 판정 + 출혈) ---------- */
function bloodCircle(f, o, G, R, dmg, bleed) {
  const c = f.pos.clone(); c.y += 0.02; const col = ac(f);
  G.fx.ring(c.clone().setY(c.y + 1.0), { normal: UP, r0: 0.6, r1: R * 1.05, life: 0.32, color: col }); G.fx.ring(c.clone().setY(c.y + 0.06), { normal: UP, r0: R * 0.4, r1: R * 1.1, life: 0.5, color: BLOOD, op: 0.8 });
  for (let i = 0; i < 3; i++) G.fx.slash(f.local([0, 1.0 + i * 0.12, 0]), { fwd: new V3(Math.cos(i * 2.1), 0, Math.sin(i * 2.1)), normal: UP, r: R * 0.95, color: i ? BLOOD : col, life: 0.3 });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, p = c.clone().add(new V3(Math.cos(a) * R * 0.85, 1.0, Math.sin(a) * R * 0.85)); G.fx.p(p, { vel: [Math.cos(a) * 3, 1, Math.sin(a) * 3], size: 0.12, size1: 0.02, life: 0.45, color: i % 2 ? BLOOD : col, alpha: 0.9, grav: 8 }); }
  sfx('heavy'); sfx('swing'); G.shake(0.12);
  const hit = circleHit(f, c, R, { dmg, kb: [2.6, 1.2], stun: 0.42, hs: 0.06, daze: dmg * 0.5 });
  for (const t of hit) { t.addStatus('bleed', bleed[0], bleed[1], f); blood(G, t.chest(new V3()), 14, 4); }
  return hit.length;
}

/* =====================================================================
   기술 — 차원의 광대: 넓은 낫 휘두르기 · 피의 무도 · 차원문 기습 · 조롱의 웃음
   ===================================================================== */
const moves = {
  /* --- 공중 좌클: 낙하 공격 — 낫을 치켜들었다가 내리꽂아 핏빛 원을 그린다 --- */
  ...makePlunge({
    up: 'raised',
    fall: { ...poses.raised, spine: [0.3, 0, 0], head: [0.15, 0, 0], shoulderR: [-1.7, 0, -0.1], elbowR: [-0.2, 0, 0], weapon: [-1.3, 0, 0], shoulderL: [-1.5, 0, 0.1], hipL: [-1.1, 0, 0.1], kneeL: [1.5, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [1.3, 0, 0] },
    land: 'reap', color: CRIM, dmg: 70, r: 2.5,
    fx: (f, o, G, c) => { blood(G, c.clone().setY(c.y + 0.4), 24, 6); G.fx.ring(c.clone().setY(c.y + 0.05), { normal: UP, r0: 0.5, r1: 3.0, life: 0.6, color: BLOOD, op: 0.9 }); sparkles(G, c, 12, ac(f), 5); },
  }),

  /* --- 기본 공격 (서커스 연기): 낫 바통 돌리기(3타) → 트럼프 세 장 던지기 → 공중제비 내려베기 → 깜짝 차원문(발밑에서 낫날이 솟음) --- */
  light1: { dur: 0.5, cancel: 0.3, next: 'light2', trail: true, track: 0.3, ikOff: true,
    keys: [[0, { ...poses.twirl, weapon: [0, 0.2, 0] }], [0.08, { ...poses.twirl, weapon: [1.57, 0.2, 0] }], [0.16, { ...poses.twirl, weapon: [3.14, 0.2, 0] }], [0.24, { ...poses.twirl, weapon: [4.71, 0.2, 0] }],
      [0.32, { ...poses.twirl, weapon: [6.28, 0.2, 0] }], [0.5, { ...poses.base, weapon: [6.28 + (poses.base.weapon || [0])[0], (poses.base.weapon || [0, 0])[1], (poses.base.weapon || [0, 0, 0])[2]] }]],
    lunge: [[0.02, 0.3, 2.5]],
    ev: [0.04, 0.14, 0.24].map((t) => [t, (f, o, G) => { sfx('swing'); G.fx.ring(f.local([0, 1.15, 0.75]), { normal: f.fwd(new V3()), r0: 0.2, r1: 0.9, life: 0.18, color: ac(f) }); sparkles(G, f.local([0, 1.15, 0.8]), 3, ac(f)); }]),
    hits: [0.04, 0.14, 0.24].map((t) => ({ t0: t, t1: t + 0.08, weapon: false, at: [0, 1.1, 0.9], r: 0.75, dmg: 12 })),
    end: (f) => { const i = JI.weapon; f.pose[i] = ((f.pose[i] + Math.PI) % TAU + TAU) % TAU - Math.PI; } }, // 한 바퀴 돈 각도를 되돌려 역회전 방지
  light2: { dur: 0.42, cancel: 0.22, next: 'light3', track: 0.12, ikOff: true, move: 0.5,
    keys: [[0, 'cardWind'], [0.1, 'cardThrow'], [0.24, {}], [0.42, 'base']],
    ev: [[0.1, (f, o, G) => { sfx('shot'); const hand = f.model.J.handL.getWorldPosition(new V3());
      for (const sp of [-0.18, 0, 0.18]) { const d = o && !o.gone && f.dist() < 14 ? o.chest(new V3()).sub(hand).normalize() : f.fwd(new V3()); d.applyAxisAngle(UP, sp); G.spawn(new Card(G, f, hand, d)); } }]] },
  light3: { dur: 0.62, cancel: 0.42, next: 'light4', trail: true, track: 0.14, ikOff: true, noMove: true,
    keys: [[0, { ...poses.raised, hipL: [-1.3, 0, 0.1], kneeL: [1.8, 0, 0], hipR: [-0.9, 0, -0.1], kneeR: [1.6, 0, 0], spine: [0.4, 0, 0] }], [0.18, { ...poses.raised, spine: [0.6, 0, 0], hipL: [-1.6, 0, 0], kneeL: [2.0, 0, 0], hipR: [-1.4, 0, 0], kneeR: [2.0, 0, 0] }],
      [0.32, 'reap'], [0.46, {}], [0.62, 'base']],
    start: (f) => { f.vel.y = 5.2; f.onGround = false; sfx('jump'); },
    lunge: [[0.02, 0.3, 5.5]],
    tick: (f, o, G, t) => { if (t < 0.3 && Math.random() < 0.6) sparkles(G, f.chest(new V3()), 1, ac(f), 1); },
    ev: [[0.26, () => sfx('heavy')], [0.3, (f) => redSlash(f, { tilt: Math.PI / 2, r: 2.4, at: [0, 1.2, 0.5] })]],
    hits: [{ t0: 0.24, t1: 0.36, dmg: 34 }] },
  light4: { dur: 0.72, track: 0.2, shout: true, ikOff: true, noMove: true,
    keys: [[0, 'raised'], [0.16, 'reap'], [0.4, 'reap'], [0.55, {}], [0.72, 'base']],
    start: (f, o) => { f.boxAt = o && !o.gone && f.dist() < 5 ? o.pos.clone() : f.local([0, 0, 2.6]); f.boxAt.y = f.pos.y + 0.02; sfx('charge'); },
    ev: [[0.16, (f, o, G) => { rift(f, 1); sfx('block'); openPortal(G, f.boxAt.clone(), UP, 0.9, 0.62, ac2(f)); G.fx.ring(f.boxAt.clone().setY(f.boxAt.y + 0.03), { normal: UP, r0: 0.2, r1: 1.4, life: 0.35, color: ac(f) }); }],
      [0.36, (f, o, G) => { const c = f.boxAt; sfx('boom'); sfx('heavy'); G.shake(0.16);
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; G.fx.slash(c.clone().setY(c.y + 1.0), { fwd: UP, normal: new V3(Math.cos(a), 0, Math.sin(a)), r: 1.4, color: i % 2 ? ac2(f) : ac(f), life: 0.3 }); }
        blood(G, c.clone().setY(c.y + 0.8), 16, 5); sparkles(G, c.clone().setY(c.y + 1), 12, ac(f), 4);
        circleHit(f, c, 1.25, { dmg: 54, kb: [0, 0] }); }],
      [0.6, (f) => rift(f, 0)]],
    end: (f) => rift(f, 0) },

  /* --- 우클: 피의 무도 — 낫을 크게 돌려 주위를 베고 출혈. 광기가 가득 차면 세 바퀴 광란 --- */
  heavy: { dur: 1.2, cd: 'heavy', ikOff: true, trail: true, aim: true, move: 0.45,
    keys: [[0, 'windR'], [0.12, 'spin'], [1.0, 'spin'], [1.2, 'base']],
    start: (f, o, G) => { f.frenzy = mad(f) >= 100; f.spins = 0; if (f.frenzy) { f.madness = 0; G.say(f, '"아하하하! 더, 더 춤춰 봐!"'); G.flash(ac(f), 0.2); } else G.say(f, '"자, 피의 무도를."'); rift(f, 1); sfx('charge'); },
    tick: (f, o, G, t, dt) => {
      const n = f.frenzy ? 3 : 2, t0 = 0.12, t1 = 1.0; if (t > t0 && t < t1) f.yaw += dt * (n * TAU) / (t1 - t0);
      const k = Math.floor((t - t0) / ((t1 - t0) / n)); if (t > t0 && k >= f.spins && k < n) { f.spins = k + 1; const last = k === n - 1;
        bloodCircle(f, o, G, f.frenzy ? 3.9 : 3.2, f.frenzy ? (last ? 44 : 30) : (last ? 40 : 30), f.frenzy ? [5, 26] : [4, 15]); }
      if (t >= t1 && t < t1 + 0.05) f.faceOpp();
      if (Math.random() < 0.5) { const p = f.model.tipPos(new V3()); G.fx.p(p, { vel: [0, 0.5, 0], size: 0.22, size1: 0.04, life: 0.3, color: Math.random() < 0.5 ? BLOOD : ac(f), alpha: 0.8 }); }
    },
    end: (f) => { rift(f, 0); f.frenzy = false; } },

  /* --- Shift: 죽음의 문턱 — 앞에 차원문을 열고 들어가 적의 등 뒤 문에서 튀어나와 치명타 --- */
  s1: { dur: 1.05, cd: 's1', aim: true, noMove: true, trail: true, ikOff: true,
    keys: [[0, 'windR'], [0.26, { ...poses.windR, spine: [0.35, -0.3, 0] }], [0.42, 'raised'], [0.54, 'reap'], [0.78, {}], [1.05, 'base']],
    start: (f, o, G) => { G.say(f, '"문턱을 넘어볼래?"'); rift(f, 1); const p = f.local([0, 1.1, 1.0]); f.p1 = openPortal(G, p, f.fwd(new V3()), 1.15, 0.6, ac2(f)); sfx('charge'); },
    lunge: [[0.14, 0.26, 4]],
    ev: [[0.27, (f, o, G) => { // 문으로 사라짐
      G.flash(ac2(f), 0.15); sfx('dash'); sparkles(G, f.chest(new V3()), 16, ac2(f), 4); f.root.visible = false; f.inv = Math.max(f.inv, 0.35);
      let dest, face; if (o && !o.gone && o.state !== 'ko' && f.dist() < 12) { const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); if (!o.onGround) d.copy(o.fwd(new V3())).negate(); dest = o.pos.clone().addScaledVector(d, 1.25 + 0.3 * o.scale).setY(o.onGround ? o.pos.y : Math.max(0, o.pos.y - 0.6)); face = Math.atan2(-d.x, -d.z); }
      else { const fw = f.fwd(new V3()); dest = f.pos.clone().addScaledVector(fw, 6); face = f.yaw; }
      const W = G.stage && G.stage.world; if (W && W.solidAt(dest.clone().setY(dest.y + 0.6), 0.3)) dest.copy(f.pos);
      f.blinkTo = dest; f.blinkYaw = face; openPortal(G, dest.clone().setY(dest.y + 1.1), new V3(-Math.sin(face), 0, -Math.cos(face)), 1.15, 0.65, ac2(f)); }],
      [0.4, (f, o, G) => { // 등 뒤 문에서 등장
        if (f.blinkTo) { f.pos.copy(f.blinkTo); f.yaw = f.blinkYaw; f.vel.set(0, 0, 0); f.model.resetCloth(); } f.root.visible = true; sfx('dash'); G.flash(0xffffff, 0.12); sparkles(G, f.chest(new V3()), 14, ac2(f), 4); }],
      [0.5, (f, o, G) => { sfx('heavy'); redSlash(f, { tilt: Math.PI / 2, r: 2.8, at: [0, 1.3, 0.4], life: 0.32 }); }],
      [0.53, (f, o, G) => { // 치명타: 낫 끝이 닿는 앞쪽 부채꼴
        const fw = f.fwd(new V3()); let any = false;
        for (const t of f.foes()) { const d = new V3().subVectors(t.pos, f.pos).setY(0), L = d.length(); if (L > 2.6 + 0.4 * t.scale || Math.abs(t.pos.y - f.pos.y) > 2.2 || (L > 0.4 && d.normalize().dot(fw) < 0.2)) continue;
          if (critHit(f, t, { dmg: 74, kb: [4.5, 5], stun: 0.7, hs: 0.16, shake: 0.28, daze: 42, snd: 'big', br: 0.3 }, fw) === 'hit') { any = true; t.addStatus('bleed', 3, 12, f); blood(G, t.chest(new V3()), 24, 6); G.fx.light(t.chest(new V3()), ac(f), 120, 0.4); } }
        if (any) { G.slow(0.4, 0.2); G.flash(ac(f), 0.25); } }],
      [0.8, (f) => rift(f, 0)]],
    end: (f) => { f.root.visible = true; rift(f, 0); f.blinkTo = null; } },

  /* --- E: 조롱의 환희 — 기분 나쁜 웃음소리로 주위 적의 방어력 · 이동 속도를 떨어뜨림 --- */
  s2: { dur: 0.95, cd: 's2', ikOff: true, aim: true, shout: true, move: 0.5,
    keys: [[0, 'base'], [0.16, 'laugh'], [0.5, { head: [-0.25, -0.15, 0.15], spine: [-0.2, 0.1, 0] }], [0.7, 'laugh'], [0.95, 'base']],
    start: (f, o, G) => { G.say(f, '"후후… 아하하하하!"'); rift(f, 0.8); sfx('charge'); },
    tick: (f, o, G, t) => { if (t > 0.2 && t < 0.8 && Math.random() < 0.6) { const c = f.chest(new V3()), a = rand(0, TAU), R = rand(0.4, 1.4); G.fx.p(c.clone().add(new V3(Math.cos(a) * R, rand(-0.6, 0.9), Math.sin(a) * R)), { vel: [Math.cos(a) * 2, rand(0.5, 2), Math.sin(a) * 2], size: 0.1, size1: 0.02, life: 0.5, color: MAG, alpha: 0.85, drag: 1 }); } },
    ev: [[0.22, (f, o, G) => {
      const c = f.pos.clone(), R = 7.5; sfx('zap'); sfx('boom'); G.shake(0.15); G.setTint(MAG, 0.2, 0.6);
      for (const [r1, life, col] of [[R, 0.7, MAG], [R * 0.7, 0.55, 0xffffff], [R * 1.1, 0.9, ac(f)]]) G.fx.ring(c.clone().setY(c.y + 0.08), { normal: UP, r0: 0.4, r1, life, color: col });
      G.fx.ring(f.chest(new V3()), { r0: 0.2, r1: 2.6, life: 0.5, color: MAG, billboard: true }); G.fx.burst(f.chest(new V3()), 40, [MAG, 0xffffff], 8, { kind: 'glow', sk: 0.6 });
      G.spawn(new GrinMark(G, f, f, 1.2, true));
      const hit = circleHit(f, c, R, { dmg: 18, kb: [1.2, 0], stun: 0.3, hs: 0.04, daze: 14, noCrit: true }, 3);
      for (const t of hit) { t.addStatus('vuln', 6, 1.25, f); t.addStatus('slow', 6, 0.6, f); G.spawn(new GrinMark(G, f, t, 6, false)); sparkles(G, t.chest(new V3()), 10, MAG, 3); }
    }], [0.85, (f) => rift(f, 0)]],
    end: (f) => rift(f, 0) },

  /* --- 극한 회피 뒤 좌클: 틈새 기습 — 작은 차원문으로 상대 등 뒤에 나타나 베기 --- */
  counter: { dur: 0.62, aim: true, ikOff: true, trail: true,
    keys: [[0, 'windR'], [0.1, 'slashL'], [0.4, {}], [0.62, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest(); openPortal(G, from.clone(), f.fwd(new V3()), 0.9, 0.35, ac2(f));
      if (o) { const d = new V3().subVectors(o.pos, f.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(o.onGround ? o.pos.y : f.pos.y).addScaledVector(d, 1.3 + 0.3 * o.scale); f.yaw = Math.atan2(-d.x, -d.z); openPortal(G, f.chest(), d, 0.9, 0.35, ac2(f)); }
      slashLine(G, from, f.chest(), ac2(f), 1); sfx('dash'); G.flash(ac2(f), 0.2); f.model.resetCloth();
    }], [0.1, (f) => { sfx('heavy'); redSlash(f, { tilt: 0.12, r: 2.8, life: 0.32 }); }]],
    hits: [{ t0: 0.06, t1: 0.22, dmg: 90, kb: [6, 3], stun: 0.6, hs: 0.14, shake: 0.18, daze: 40, snd: 'big', br: 0.26 }] },

  /* --- Q: 커튼콜 · 차원 서커스 — 인사 뒤 대상 주위에 차원문 여섯 개를 열고 사방에서 베어낸 뒤, 머리 위 거대한 문에서 떨어져 처형 --- */
  ult: { dur: 3.4, ult: true, aim: true, ikOff: true, shout: true,
    keys: [[0, 'bow'], [0.62, 'bow'], [0.72, 'windR'], [2.05, 'windR'], [2.15, 'raised'], [2.52, 'raised'], [2.62, 'reap'], [3.0, {}], [3.4, 'win']],
    cam: [[0, { ref: 'self', p: [0.9, 1.3, 2.3], l: [0, 1.2, 0], fov: 38 }], [0.62, { ref: 'self', p: [0.6, 1.5, 1.6], l: [0, 1.5, 0], fov: 34 }],
      [0.78, { ref: 'target', p: [4.2, 2.2, -3.6], l: [0, 1.2, 0], fov: 60 }], [2.0, { ref: 'target', p: [-4, 1.6, -4], l: [0, 1.5, 0], fov: 58 }],
      [2.2, { ref: 'target', p: [2.6, 0.9, 3.2], l: [0, 2.6, 0], fov: 55 }], [2.6, { ref: 'target', p: [2.4, 1.2, 3.4], l: [0, 1.2, 0], fov: 50 }], [3.4, { ref: 'target', p: [3.2, 2.0, 4.6], l: [0, 1.2, -0.5], fov: 52 }]],
    ev: [
      [0, (f, o, G) => { f.ultTgt = o; if (o) { o.lock(); if (o.pos.y < 0.2) o.pos.y = 0; } G.setTint(VOID, 0.4); rift(f, 1); sfx('charge'); G.say(f, '"신사 숙녀 여러분… 오늘의 마지막 무대입니다."'); sparkles(G, f.chest(new V3()), 24, ac2(f), 3); }],
      [0.3, (f, o, G) => { o = f.ultTgt || o; if (!o) return; f.ultPortals = []; const c = o.pos.clone(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, p = c.clone().add(new V3(Math.cos(a) * 2.6, 1.15, Math.sin(a) * 2.6)); f.ultPortals.push(p); G.spawn({ t: -i * 0.05, done: false, update(dt) { this.t += dt; if (this.t >= 0) { this.done = true; openPortal(G, p, new V3(-Math.cos(a), 0, -Math.sin(a)), 1.1, 1.75 - i * 0.05, ac2(f)); } }, kill() { this.done = true; } }); } }],
      [0.72, (f, o, G) => { G.flash(0xffffff, 0.25); sfx('dash'); sparkles(G, f.chest(new V3()), 30, ac2(f), 6); f.root.visible = false; f.ultCuts = 0; f.cutAcc = 0; }],
      [2.1, (f, o, G) => { o = f.ultTgt || o; if (!o) return; const top = o.pos.clone().setY(o.pos.y + 4.2); f.bigPortal = openPortal(G, top, new V3(0, -1, 0), 2.4, 1.0, ac2(f));
        const d = new V3().subVectors(f.pos, o.pos).setY(0); if (d.lengthSq() < 0.01) d.set(0, 0, 1); d.normalize(); f.ultLand = o.pos.clone().addScaledVector(d, 1.5 * o.scale).setY(0); f.ultTop = top.clone().addScaledVector(d, 1.0); sfx('charge'); }],
      [2.18, (f, o, G) => { o = f.ultTgt || o; if (!o) return; f.root.visible = true; f.float = true; f.onGround = false; f.pos.copy(f.ultTop).setY(f.ultTop.y - 1.2); f.faceOpp(); f.model.resetCloth(); G.say(f, '"커튼콜."'); sfx('dash'); }],
      [2.6, (f, o, G) => { o = f.ultTgt || o; f.float = false; if (f.ultLand) f.pos.copy(f.ultLand); f.vel.set(0, 0, 0); f.onGround = true; if (!o) return;
        o.release(); sfx('boom'); sfx('big'); G.flash(0xffe0f0, 0.6); G.shake(0.55); G.stage.flashSky && G.stage.flashSky(0.4);
        const c = o.chest(new V3()); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI, dd = new V3(Math.cos(a) * 0.4, Math.sin(a), 0.3).normalize(); slashLine(G, c.clone().addScaledVector(dd, -2.4), c.clone().addScaledVector(dd, 2.4), i % 2 ? ac(f) : MAG, 1.3); }
        G.fx.impact(c, ac(f), 2.6); blood(G, c, 60, 8); G.fx.light(c, ac(f), 180, 0.8, 20); G.fx.ring(o.pos.clone().setY(0.05), { normal: UP, r0: 0.5, r1: 7, life: 0.7, color: BLOOD }); G.fx.ring(o.pos.clone().setY(0.08), { normal: UP, r0: 0.3, r1: 5, life: 0.5, color: MAG });
        openPortal(G, o.pos.clone().setY(0.03), UP, 2.2, 0.6, ac2(f));
        o.takeHit(f, { dmg: 185, kb: [5, 10], stun: 0.9, hs: 0.2, shake: 0.4, noScale: true, force: true, daze: 90, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
        o.addStatus('bleed', 5, 20, f);
        for (const t of f.foes()) if (t !== o && t.pos.distanceTo(o.pos) < 6) { t.takeHit(f, { dmg: 110, kb: [6, 8], stun: 0.8, force: true, noCrit: true }, new V3().subVectors(t.pos, o.pos).setY(0).normalize()); t.addStatus('bleed', 4, 14, f); }
        G.slow(0.35, 0.5); G.say(f, '"…박수는 사양할게."'); }],
    ],
    tick: (f, o, G, t, dt) => {
      if (t < 0.62 && Math.random() < 0.6) sparkles(G, f.chest(new V3()), 1, ac2(f), 1.5);
      // 모습을 감춘 동안: 차원문에서 차원문으로 대상을 꿰뚫고 지나간다 (0.12초마다)
      const tg = f.ultTgt;
      if (tg && !f.root.visible && t > 0.78 && t < 2.0 && f.ultPortals) { f.cutAcc += dt; while (f.cutAcc >= 0.12) { f.cutAcc -= 0.12; const i = f.ultCuts++ % 6, j = (i + 3 + (f.ultCuts % 2 ? 1 : 0)) % 6, a = f.ultPortals[i], b = f.ultPortals[j];
        slashLine(G, a, b, f.ultCuts % 2 ? ac(f) : MAG, 1.1); for (let k = 0; k < 5; k++) G.fx.p(a.clone().lerp(b, k / 5), { size: 1.0, size1: 0.3, life: 0.22, color: VOID, alpha: 0.5 }); blood(G, tg.chest(new V3()), 4, 3); sfx('swing');
        tg.takeHit(f, { dmg: 11, kb: [0, 0], stun: 99, hs: 0.01, nokill: true, noScale: true, force: true, noCrit: true, daze: 8, snd: 'hit' }, b.clone().sub(a).setY(0).normalize()); } }
      // 거대한 문에서 떨어진다
      if (f.float && f.ultTop && f.ultLand && t > 2.18 && t < 2.6) { const k = Math.min(1, (t - 2.18) / 0.42), e = k * k; f.pos.lerpVectors(f.ultTop.clone().setY(f.ultTop.y - 1.2), f.ultLand, e); f.faceOpp(); G.fx.p(f.chest(new V3()), { size: 0.7, size1: 0.2, life: 0.25, color: ac2(f), alpha: 0.5 }); }
    },
    end: (f, o, G) => { G.setTint(0, 0); rift(f, 0); f.root.visible = true; f.float = false; f.ultPortals = null; const tg = f.ultTgt; if (tg && tg.held) tg.release(); } },
};

function hitFx(G, p, dir, h, att) {
  const big = h.dmg >= 60, col = att.palette.accent;
  G.fx.impact(p, col, big ? 1.7 : 1.0, dir);
  const a = rand(0, TAU), n = new V3(Math.cos(a) * 0.3, Math.sin(a), Math.cos(a)).normalize();
  G.fx.slash(p.clone().addScaledVector(dir, -0.3), { fwd: dir, normal: n, r: big ? 1.6 : 1.1, color: big ? MAG : col, life: 0.2 });
  blood(G, p, big ? 14 : 6, 4);
  // 광기: 맞힐 때마다 쌓인다 (출혈 중인 적이면 1.5배)
  const tgt = att.opp, k = tgt && tgt.st && tgt.st.bleed ? 0.5 : 0.33;
  att.madness = Math.min(100, (att.madness || 0) + h.dmg * k);
}

// 광기 상태 → 낫 날 빛 · 궤적 색
function createModelWithMadness(pal) {
  const m = createModel(pal), up = m.update;
  m.update = (dt, f) => {
    if (mad(f) >= 100 && f.root.visible && Math.random() < 0.3) { const p = m.tipPos(new V3()); f.G.fx.p(p, { vel: [0, -0.6, 0], size: 0.09, size1: 0.02, life: 0.5, color: BLOOD, alpha: 0.9, drag: 1, grav: 4 }); }
    if (f.trail && f.trail.mesh.material.uniforms) f.trail.mesh.material.uniforms.uColor.value.setHex(mad(f) >= 100 ? MAG : f.palette.accent);
    up(dt, f);
  };
  return m;
}

function aiPick(f, o, dist) {
  if (dist < 3.3 && f.cd.heavy <= 0 && Math.random() < 0.35) return 'heavy';
  if (dist > 3.5 && dist < 11 && f.cd.s1 <= 0 && Math.random() < 0.3) return 's1';
  if (dist < 6.5 && f.cd.s2 <= 0 && !(o.stK && o.stK('vuln') > 1) && Math.random() < 0.25) return 's2';
  return null;
}

export default {
  id: 'clown', name: '클라운', short: '클라운', title: 'CLOWN · 차원의 광대', scale: 1.0,
  desc: '근·중거리 · 넓은 낫 휘두르기 · 출혈 · 약화. 차원의 틈을 넘나드는 적 진영의 광대 소녀. 큰 장대 낫을 춤추듯 돌려 피를 흩뿌리고, 기분 나쁜 웃음으로 적을 조롱하며, 다이아몬드 차원문을 열어 적의 등 뒤에서 치명타를 꽂는다. 맞힐수록 광기가 차오르고, 가득 차면 피의 무도가 세 바퀴 광란이 된다.',
  stats: { hp: 930, speed: 7.8, jump: 10.5, crit: 0.28 },
  palettes: [{ accent: CRIM, accent2: MAG, main: '#a8142c', dark: '#4a0612', id: 'r', band: '#2a0612' }, { accent: 0x3ae0ff, accent2: 0x6a8aff, main: '#1e6a7c', dark: '#0a2a34', id: 't', gem: 0xff5a9a, band: '#0a2028' }],
  skills: { heavy: { name: '피의 무도', cd: 8 }, s1: { name: '죽음의 문턱', cd: 10 }, s2: { name: '조롱의 환희', cd: 14 }, ult: { name: '커튼콜 · 차원 서커스', sub: 'CLOWN' } },
  aiPick,
  resource: (f) => mad(f) >= 100 ? { v: 1, label: '광기', color: 0xff6ad0, full: true } : { v: mad(f) / 100, label: '광기', color: 0xc8103a },
  onReset: (f) => { f.madness = 0; f.riftK = 0; f.frenzy = false; f.ultTgt = null; f.ultPortals = null; f.blinkTo = null; },
  moveList: [['좌클 ×4', '낫 바통 돌리기 12×3 → 트럼프 세 장 던지기 12×3 → 공중제비 내려베기 34 → 깜짝 차원문: 상대 발밑에서 낫날이 솟음 54'], ['공중 좌클', '낫을 치켜들었다가 내리꽂아 핏빛 원'],
    ['우클 · 피의 무도', '낫을 두 바퀴 크게 돌려 반경 3.2m 30 · 40 + 출혈(초당 15, 4초). 광기가 가득 차면 세 바퀴 광란 (반경 3.9m · 출혈 초당 26)'],
    ['Shift · 죽음의 문턱', '앞에 차원문을 열고 들어가 적의 등 뒤 문에서 튀어나와 확정 치명타 내려베기 74 (×1.6) + 출혈'],
    ['E · 조롱의 환희', '기분 나쁜 웃음: 반경 7.5m 적에게 18 · 6초간 받는 피해 ×1.25 · 이동 속도 ×0.6 (머리 위 섬뜩한 미소)'],
    ['Q · 커튼콜 · 차원 서커스', '인사 → 대상 주위 차원문 여섯 개에서 사방으로 꿰뚫는 연속 베기 → 머리 위 거대한 문에서 떨어져 처형 185 + 출혈'],
    ['광기', '맞힐수록 쌓이고(출혈 중인 적 1.5배) 가득 차면 다음 피의 무도가 세 바퀴 광란'], ['C (타이밍) · 극한 회피', '틈새 기습: 작은 차원문으로 상대 등 뒤에 나타나 베기 90'], ['가만히', '낫 자루에 기대어 고개를 갸웃']],
  createModel: createModelWithMadness, poses, moves, hitFx,
};
