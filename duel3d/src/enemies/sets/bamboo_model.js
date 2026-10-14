// 8. 죽림 사당 — 3D 모델 (기술 · 행동은 bamboo.js)
//
//   그림자 닌자: 마엽(麻葉) 무늬 검은 닌자복 · 겹친 깃 · 두건 + 복면 사이로 빛나는 붉은 눈 · 휘날리는 붉은 목도리(로프 물리)
//               팔뚝 · 정강이 감개 · 버선(엄지 갈림) · 허리띠 매듭 · 휜 카타나 · 등에 비스듬한 칼집
//   수리검 닌자: 같은 몸에 금속 반가면(송곳니) · 왼 어깨 갑판 · 가슴을 가로지른 수리검 띠 · 등에 큰 풍마 수리검 · 쿠나이
//   사당의 오니: 근육이 갈라진 붉은 거구 · 호랑이 가죽 허리 천 · 꼬인 금줄 띠와 시데 · 염주 목걸이 · 금 팔찌
//               갈기처럼 뻗친 흰 머리 · 마디 진 두 뿔 · 송곳니 · 빛나는 눈 · 쇠징 박힌 도깨비 방망이(가나보)
//   구미호 쿠즈하: 네발로 걷는 흰 여우 — 매끈하게 깎은 몸통 · 다리 · 여우 머리(주둥이 · 귀 · 붉은 눈매 문양 · 벌어지는 턱)
//               목 둘레 털 갈기 · 금줄과 방울 · 아홉 개의 복슬한 꼬리(끝이 분홍빛으로 타오름 · 절차적 흔들림, 채찍 공격 때 뻗음)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { Rope, RopeTube } from '../../cloth.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, fbm, envCube, cached } from '../../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = (k, fn) => cached('bamboo:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const _tex = {}; const T = (k, f) => _tex[k] || (_tex[k] = f());
// 마엽 무늬 (육각 별 격자) 닌자복
function asanohaCanvas(bg, line) {
  const W = 256, H = 256, [c, g] = cv(W, H); g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = line; g.lineWidth = 1.4;
  const s = 32, h = s * Math.sqrt(3) / 2;
  for (let row = -1; row < H / h + 1; row++) for (let col = -1; col < W / s + 1; col++) { const cx = col * s + (row % 2 ? s / 2 : 0), cy = row * h; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * s / Math.sqrt(3), cy + Math.sin(a) * s / Math.sqrt(3)); g.stroke(); } }
  const r = rng(3); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 1, 6 + r() * 20); }
  return c;
}
// 감개 (비스듬히 겹쳐 감은 천)
function wrapCanvas(a, b, hi) { const [c, g] = cv(64, 256); g.fillStyle = a; g.fillRect(0, 0, 64, 256); for (let y = -64; y < 320; y += 20) { const gr = g.createLinearGradient(0, y, 0, y + 22); gr.addColorStop(0, b); gr.addColorStop(0.5, hi); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 18); g.lineTo(64, y + 30); g.lineTo(0, y + 12); g.closePath(); g.fill(); } return c; }
// 꼬인 금줄
function ropeCanvas(a, b, hi) { const [c, g] = cv(128, 512); g.fillStyle = a; g.fillRect(0, 0, 128, 512); for (let y = -64; y < 576; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 34); gr.addColorStop(0, b); gr.addColorStop(0.5, hi); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + 40); g.lineTo(128, y + 62); g.lineTo(0, y + 22); g.closePath(); g.fill(); } return c; }
// 호랑이 가죽 (노랑 바탕 · 검은 줄 · 찢긴 밑단)
function tigerCanvas() {
  const W = 512, H = 256, [c, g] = cv(W, H), r = rng(19); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#d89a30'); gr.addColorStop(1, '#b87420'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a120a'; for (let x = 0; x < W; x += 26 + r() * 20) { const w = 6 + r() * 10, y0 = r() * 40; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + 14 + r() * 10, H * 0.5, x + (r() - 0.5) * 20, H * (0.75 + r() * 0.25)); g.lineTo(x + w, H * 0.7); g.quadraticCurveTo(x + w + 8, H * 0.4, x + w, y0); g.closePath(); g.fill(); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,240,200,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 1, 3 + r() * 6); }
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, 0); let x = 0; while (x < W) { const w = 10 + r() * 22; g.lineTo(x + w / 2, r() * 40); x += w; g.lineTo(x, r() * 8); } g.lineTo(W, 0); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over';
  return c;
}
// 오니 피부: 붉은 바탕 · 얼룩 · 근육 음영
function oniSkinCanvas() { const W = 256, H = 256, [c, g] = cv(W, H), img = g.createImageData(W, H), d = img.data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = fbm(x / 30, y / 30, 5, 4), k = (y * W + x) * 4, v = 0.78 + n * 0.4; d[k] = 200 * v; d[k + 1] = 52 * v; d[k + 2] = 38 * v; d[k + 3] = 255; } g.putImageData(img, 0, 0); return c; }
// 여우 털: 흰 바탕 · 결 (u: 0 = 등, 0.5 = 배 — 등은 연보라 · 배는 흰색) · 옆구리 붉은 불꽃 문양
function furCanvas(marks) {
  const W = 512, H = 256, [c, g] = cv(W, H), r = rng(marks ? 51 : 52), gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, '#d8cce0'); gr.addColorStop(0.3, '#f4eef6'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.7, '#f4eef6'); gr.addColorStop(1, '#d8cce0'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1600; i++) { const x = r() * W, y = r() * H, l = 6 + r() * 12; g.strokeStyle = r() < 0.5 ? 'rgba(150,130,170,0.22)' : 'rgba(255,255,255,0.6)'; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - l); g.stroke(); }
  if (marks) { g.fillStyle = 'rgba(214,30,70,0.85)'; for (const u of [0.22, 0.78]) { const x = u * W; g.beginPath(); g.moveTo(x - 30, H * 0.3); g.quadraticCurveTo(x - 8, H * 0.55, x - 18, H * 0.85); g.quadraticCurveTo(x + 4, H * 0.6, x + 2, H * 0.3); g.quadraticCurveTo(x - 14, H * 0.42, x - 30, H * 0.3); g.fill(); g.beginPath(); g.moveTo(x + 10, H * 0.35); g.quadraticCurveTo(x + 22, H * 0.55, x + 14, H * 0.7); g.quadraticCurveTo(x + 30, H * 0.52, x + 10, H * 0.35); g.fill(); } }
  return c;
}
// 꼬리: 뿌리(캔버스 아래) 흰색 → 끝(위) 분홍 · 보라 / glow = 끝만 빛남
function tailCanvas(glow) {
  const W = 64, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, H, 0, 0), r = rng(glow ? 8 : 9);
  if (glow) { gr.addColorStop(0, '#000'); gr.addColorStop(0.62, '#000'); gr.addColorStop(0.85, '#c03a8a'); gr.addColorStop(1, '#ffffff'); }
  else { gr.addColorStop(0, '#e8dcec'); gr.addColorStop(0.45, '#ffffff'); gr.addColorStop(0.75, '#ffd0ec'); gr.addColorStop(1, '#ff8ad8'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (!glow) for (let i = 0; i < 500; i++) { const x = r() * W, y = r() * H; g.strokeStyle = r() < 0.5 ? 'rgba(170,140,190,0.25)' : 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 10 - r() * 14); g.stroke(); }
  return c;
}
function P(o) { const { envI, ...rest } = o; const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...rest }); if ((rest.metalness || 0) > 0.2 || rest.clearcoat) { m.envMap = envCube(); m.envMapIntensity = envI ?? 1; } return m; }
function addFn() { return (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); const tr = mat.blending === THREE.AdditiveBlending || mat.transparent; me.castShadow = !tr; me.receiveShadow = !tr; parent.add(me); return me; }; }
const limbLoft = (key, L, top, X, F, B, nu = 24, nv = 12) => C(key, () => loft((v) => ({ y: top - (L + top) * v, rx: X(v), rzF: F(v), rzB: B(v) }), nu, nv));
// 로프 묶음 (장면 등록 · 매 프레임)
function ropeKit(m) {
  m.ropes = []; const extras = [];
  m.attachScene = (scene) => { if (m._att) return; m._att = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } for (const x of m.extraMeshes || []) { scene.add(x); extras.push(x); } };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; m._att = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  const tmp = new V3(), rq = new THREE.Quaternion();
  m.stepPhys = (dt, f) => {
    const vis = f.root.visible, h0 = f.hurt[0], caps = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.2), r: h0.r * 0.75 + 0.03 * f.scale }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * f.scale }))];
    m.root.getWorldQuaternion(rq); const wind = new V3(-f.vel.x * 0.8 + Math.sin(f.G.time * 1.3) * 0.7, 0.3, -f.vel.z * 0.8 + Math.cos(f.G.time * 1.1) * 0.7);
    for (const r of m.ropes) { r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); r.rope.step(dt, tmp, caps, f.pos.y + 0.02, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = vis; }
  };
}
// 휜 칼날 (카타나 · 쿠나이): +Z 로 뻗음, 날(+y) · 등(-y)
const bladeGeo = (key, z0, z1, w, curve) => C(key, () => surf((u, v, p) => { const z = z0 + (z1 - z0) * v, ww = w * (1 - 0.25 * v), tipK = smooth(0.86, 1, v), cy = -curve * v * v, t = u * TAU, ex = Math.sin(t), ey = Math.cos(t), up = ww * (1 - tipK * 0.95), dn = 0.004 * (1 - tipK); p.set(ex * 0.003 * (1 - tipK * 0.7), cy + (ey > 0 ? ey * up : ey * dn) - ww * 0.5 * (1 - tipK), z + tipK * 0.015 * ey); }, 10, 32, { closedU: true }));

/* =====================================================================
   닌자 (그림자 닌자 · 수리검 닌자) — o.kind = 'blade' | 'star'
   ===================================================================== */
export const DIMS_J = { hipH: 0.9, spineL: 0.18, chestL: 0.27, neckL: 0.075, shW: 0.18, uArm: 0.27, lArm: 0.25, hipW: 0.088, thigh: 0.43, shin: 0.42, headTop: 0.25 };
export function buildNinja(pal, scale = 1, o = {}) {
  const D = DIMS_J, m = buildHumanoid(D), J = m.J, add = addFn(), star = o.kind === 'star';
  ropeKit(m);
  const giCol = star ? ['#3a4660', 'rgba(195,210,245,0.55)'] : ['#343846', 'rgba(190,195,220,0.5)'];
  const M = {
    gi: P({ map: T('gi' + star, () => tex(asanohaCanvas(...giCol), [3, 2])), roughness: 0.7, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(star ? 0xb0c0f0 : 0xa0a4c0) }),
    giD: P({ color: star ? 0x2a3246 : 0x262a34, roughness: 0.72, sheen: 0.9, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x9a9ec0) }),
    trim: P({ color: pal.accent, emissive: pal.accent, emissiveIntensity: 0.7, roughness: 0.5 }),
    eyeG: new THREE.MeshBasicMaterial({ color: star ? 0xa8b8ff : 0xff3040, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    wrap: P({ map: T('jWrap' + star, () => tex(star ? wrapCanvas('#2a3040', '#1a1e2a', '#4a5470') : wrapCanvas('#26262c', '#16161a', '#46464e'), [1, 3])), roughness: 0.85 }),
    skin: P({ color: 0xc89880, roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xffd0c0) }),
    red: P({ color: pal.accent, roughness: 0.6, sheen: 0.9, sheenColor: new THREE.Color(0xff9aa8), emissive: pal.accent, emissiveIntensity: 0.08 }),
    eye: new THREE.MeshBasicMaterial({ color: star ? 0xc8d0ff : 0xff3a4a }),
    steel: P({ color: 0xd8dce8, metalness: 1, roughness: 0.16, clearcoat: 0.6, envI: 1.8 }),
    iron: P({ color: 0x4a4e5a, metalness: 0.9, roughness: 0.35 }),
    lacq: P({ color: 0x18100e, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
    gold: P({ color: 0xc8a050, metalness: 1, roughness: 0.3 }),
    tsuka: P({ map: T('jTsuka', () => { const [c, g] = cv(64, 256); g.fillStyle = '#111'; g.fillRect(0, 0, 64, 256); g.fillStyle = pal.accent === 0xff3a4a ? '#8a1a22' : '#5a6a9a'; for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(32, y + 4); g.lineTo(54, y + 16); g.lineTo(32, y + 28); g.lineTo(10, y + 16); g.closePath(); g.fill(); } return tex(c, [1, 2]); }), roughness: 0.6 }),
  };
  /* ---- 몸통: 골반 · 허리 · 가슴(겹친 깃) · 허리띠 매듭 ---- */
  add(J.hips, C('j:pelvis', () => loft((v) => ({ y: -0.12 + 0.21 * v, rx: 0.128 + 0.008 * Math.sin(v * Math.PI), rzF: 0.088, rzB: 0.1, n: 2.2 }), 32, 8)), M.gi);
  const wX = spl([[0, 0.118], [0.45, 0.102], [1, 0.12]]);
  add(J.spine, C('j:waist', () => loft((v) => ({ y: -0.04 + 0.24 * v, rx: wX(v), rzF: 0.08, rzB: 0.084, n: 2.15 }), 32, 8)), M.gi);
  const cX = spl([[0, 0.118], [0.4, 0.138], [0.75, 0.144], [1, 0.1]]), cF = spl([[0, 0.084], [0.55, 0.1], [1, 0.07]]), chP = (v) => ({ y: -0.02 + 0.3 * v, rx: cX(v), rzF: cF(v), rzB: 0.088 + 0.006 * Math.sin(v * Math.PI), n: 2.2 });
  add(J.chest, C('j:chest', () => loft(chP, 40, 14, { mod: (p, u, v, c, s) => { if (s > 0) p.z += 0.012 * gauss(Math.abs(p.x) - 0.06, 0.05) * gauss(p.y - 0.17, 0.07); } })), M.gi);
  add(J.chest, C('j:top', () => loft((v) => ({ y: 0.27 + 0.065 * v, rx: 0.1 - 0.058 * v ** 0.8, rzF: 0.07 - 0.026 * v, rzB: 0.072 - 0.026 * v }), 32, 5)), M.gi);
  // 겹친 깃 (왼깃이 위로 · 오른쪽 아래로 내려감)
  for (const s of [1, -1]) add(J.chest, C('j:lapel' + s, () => { const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(loftAt(chP, 0.5 + s * (0.13 - 0.2 * k), 0.96 - 0.82 * k, new V3()).multiplyScalar(1.03 + 0.01 * (s > 0 ? 1 : 0))); } return strand(pts, 0.018, 0.016, { seg: 24, rad: 6, flat: 0.3, ref: [0, 0, 1] }); }), M.giD);
  for (const s of [1, -1]) add(J.chest, C('j:lapT' + s, () => { const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(loftAt(chP, 0.5 + s * (0.13 - 0.2 * k) - s * 0.03, 0.96 - 0.82 * k, new V3()).multiplyScalar(1.045)); } return strand(pts, 0.0035, 0.0035, { seg: 24, rad: 5 }); }), M.trim);
  const obiP = (v) => ({ y: -0.06 + 0.11 * v, rx: wX(0.25) + 0.012, rzF: 0.092, rzB: 0.096, n: 2.3 });
  add(J.spine, C('j:obi', () => loft(obiP, 40, 3)), M.wrap);
  for (const v of [0, 1]) add(J.spine, C('j:obiR' + v, () => strand(loftRing(obiP, v, { n: 40 }).map((q) => q.multiplyScalar(1.02)), 0.004, 0.004, { closed: true, seg: 60, rad: 5 })), M.trim);
  { const g = new THREE.Group(); g.position.set(0, -0.01, -0.1); J.spine.add(g); add(g, C('j:knot', () => new THREE.SphereGeometry(0.03, 12, 10)), M.giD, [0, 0, -0.01], [0, 0, 0], [1.3, 1, 0.8]);
    for (const s of [-1, 1]) add(g, C('j:obiT' + s, () => strand([[s * 0.01, 0, -0.01], [s * 0.04, -0.08, -0.03], [s * 0.05, -0.18, -0.03]], 0.02, 0.016, { seg: 10, rad: 6, flat: 0.2, ref: [0, 0, 1] })), M.giD); }
  /* ---- 머리: 두건 · 복면 · 눈 틈 · 붉은 목도리 ---- */
  add(J.neck, C('j:neck', () => loft((v) => ({ y: -0.03 + 0.12 * v, rx: 0.042, rz: 0.044 }), 16, 4)), M.giD);
  const H = J.head, hd = (v) => ({ y: -0.0 + 0.24 * v, rx: 0.074 * Math.sin(Math.PI * (0.12 + 0.88 * v)) ** 0.7 + 0.004, rzF: 0.088 * Math.sin(Math.PI * (0.12 + 0.88 * v)) ** 0.7 + 0.004, rzB: 0.09 * Math.sin(Math.PI * (0.1 + 0.9 * v)) ** 0.7 + 0.004, cz: 0.005 });
  add(H, C('j:skin', () => loft((v) => { const q = hd(v); return { ...q, rx: q.rx * 0.97, rzF: q.rzF * 0.97, rzB: q.rzB * 0.97 }; }, 24, 12)), M.skin);
  add(H, C('j:hood', () => loft((v) => { const q = hd(0.55 + 0.45 * v); return { ...q, rx: q.rx + 0.008, rzF: q.rzF + 0.008, rzB: q.rzB + 0.01 }; }, 32, 8, { poles: [8] })), M.gi);
  add(H, C('j:hoodB', () => loft((v) => { const q = hd(0.1 + 0.5 * v); return { ...q, rx: q.rx + 0.009, rzF: q.rzF + 0.009, rzB: q.rzB + 0.012 }; }, 32, 8, { a0: 0.66, a1: 1.34 })), M.gi);
  if (!star) add(H, C('j:mask', () => loft((v) => { const q = hd(0.04 + 0.42 * v); return { ...q, rx: q.rx + 0.007, rzF: q.rzF + 0.01 + 0.006 * Math.sin(v * Math.PI), rzB: q.rzB + 0.01 }; }, 32, 8)), M.giD);
  else { // 금속 반가면 (코 · 송곳니 · 볼 판)
    add(H, C('j:mempo', () => loft((v) => { const q = hd(0.06 + 0.4 * v); return { ...q, rx: q.rx + 0.009, rzF: q.rzF + 0.014 + 0.01 * gauss(v - 0.8, 0.15), rzB: q.rzB }; }, 24, 8, { a0: 0.22, a1: 0.78 })), M.iron);
    for (const s of [-1, 1]) add(H, C('j:fang' + s, () => { const g = new THREE.ConeGeometry(0.006, 0.02, 6); g.rotateX(Math.PI); return g; }), M.steel, [s * 0.02, 0.05, 0.098]);
    add(H, C('j:mBand', () => loft((v) => { const q = hd(0.0 + 0.06 * v); return { ...q, rx: q.rx + 0.01, rzF: q.rzF + 0.012, rzB: q.rzB + 0.01 }; }, 24, 2)), M.gi);
  }
  add(H, C('j:brow', () => loft((v) => { const q = hd(0.56 + 0.05 * v); return { ...q, rx: q.rx + 0.012, rzF: q.rzF + 0.014, rzB: q.rzB + 0.012 }; }, 32, 2)), star ? M.iron : M.giD);
  for (const s of [-1, 1]) { add(H, C('j:eye' + s, () => strand([[s * 0.012, 0.128, 0.084], [s * 0.026, 0.132, 0.08], [s * 0.04, 0.128, 0.07]], 0.0065, 0.0045, { seg: 8, rad: 6 })), M.eye); add(H, C('j:eyeG', () => new THREE.SphereGeometry(0.022, 10, 8)), M.eyeG, [s * 0.026, 0.13, 0.082], [0, 0, 0], [1.6, 0.7, 0.5]); }
  // 이마 띠의 빛나는 금속판 (닌자 문양)
  add(H, C('j:plate', () => { const g = new THREE.CylinderGeometry(0.03, 0.03, 0.006, 6); g.rotateX(Math.PI / 2); return g; }), M.steel, [0, 0.165, 0.094], [-0.25, 0, 0], [1.4, 0.7, 1]);
  // 두건 뒤로 늘어진 끈 두 줄 (고정) · 목도리 감은 부분
  for (const s of [-1, 1]) add(H, C('j:tie' + s, () => strand([[s * 0.02, 0.16, -0.09], [s * 0.04, 0.12, -0.13], [s * 0.05, 0.05, -0.15]], 0.01, 0.008, { seg: 10, rad: 6, flat: 0.3, ref: [1, 0, 0] })), M.giD);
  add(J.neck, C('j:scarf', () => loft((v) => ({ y: -0.04 + 0.09 * v, rx: 0.07 + 0.004 * Math.sin(v * 9), rzF: 0.072, rzB: 0.07 }), 28, 6)), M.red, [0, 0, 0]);
  for (const s of [-1, 1]) { const rope = new Rope(7, 0.085 * scale, { damp: 0.972, stiff: 0.08 }), view = new RopeTube(rope, M.red, { sub: 2, rad: 6, flat: 0.16, side: new V3(1, 0, 0), prof: (v) => 0.036 * (1 - 0.35 * v) * scale });
    m.ropes.push({ rope, view, joint: J.neck, local: new V3(s * 0.03, 0.01, -0.07), rest: new V3(s * 0.25, -0.35, -1).normalize() }); }
  /* ---- 팔: 소매 · 팔뚝 감개 · 장갑 ---- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('j:delt', () => new THREE.SphereGeometry(0.058, 14, 10)), M.gi, [s * 0.008, 0, 0]);
    add(sh, limbLoft('j:uarm', D.uArm, 0.03, (v) => 0.058 - 0.008 * v, (v) => 0.056 - 0.006 * v, (v) => 0.058 - 0.008 * v), M.gi);
    add(el, limbLoft('j:farm', D.lArm, 0.02, (v) => 0.046 - 0.014 * v + 0.004 * gauss(v - 0.25, 0.2), (v) => 0.043 - 0.012 * v, (v) => 0.045 - 0.013 * v), M.wrap);
    { const bp = (v) => ({ y: -0.05 - 0.17 * v, rx: 0.05 - 0.01 * v, rz: 0.048 - 0.01 * v }); const a0 = s > 0 ? 0.08 : 0.58; add(el, C('j:bracer' + s, () => loft(bp, 12, 4, { a0, a1: a0 + 0.34 })), M.steel); for (let k = 0; k < 3; k++) add(el, C(`j:brR${s}${k}`, () => strand(loftRing(bp, 0.15 + k * 0.35, { a0, a1: a0 + 0.34, n: 10 }).map((q) => q.multiplyScalar(1.04)), 0.003, 0.003, { seg: 14, rad: 4 })), M.iron); }
    if (star && s > 0) { add(sh, C('j:sode', () => loft((v) => ({ y: 0.07 - 0.17 * v, rx: 0.08 + 0.02 * v, rz: 0.075 + 0.02 * v }), 16, 4, { a0: 0.02, a1: 0.48 })), M.iron); for (let k = 0; k < 3; k++) add(sh, C('j:sodeL' + k, () => { const pts = loftRing((v) => ({ y: 0.04 - k * 0.05 - 0.0 * v, rx: 0.086 + k * 0.007, rz: 0.081 + k * 0.007 }), 0, { a0: 0.02, a1: 0.48, n: 16 }); return strand(pts, 0.003, 0.003, { seg: 20, rad: 4 }); }), M.red); }
    const hg = new THREE.Group(); hg.scale.setScalar(0.9); ha.add(hg);
    add(hg, C('j:palm' + s, () => loft((v) => ({ y: 0.0 - 0.07 * v, rx: 0.022, rz: 0.038, n: 3, cx: s * 0.012 }), 16, 5)), M.giD);
    for (let k = 0; k < 4; k++) { const z = 0.027 - k * 0.018, pts = [], curl = s > 0 && !star ? 1.2 : 2.5; for (let i = 0; i <= 7; i++) { const th = -0.7 - (i / 7) * curl; pts.push(new V3(s * (Math.cos(th) * 0.032 + 0.003), -0.06 + Math.sin(th) * 0.032 + 0.016, z)); } add(hg, C(`j:fing${s}${k}${curl}`, () => strand(pts, 0.0085, 0.007, { seg: 10, rad: 6 })), M.giD); }
    add(hg, C('j:thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.046], [s * 0.004, -0.058, 0.044], [s * 0.018, -0.07, 0.034]], 0.0095, 0.0075, { seg: 10, rad: 6 })), M.giD);
  }
  /* ---- 다리: 바지 · 정강이 감개 · 버선(엄지 갈림) ---- */
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, limbLoft('j:thigh', D.thigh, 0.03, (v) => 0.088 - 0.024 * v, (v) => 0.084 - 0.024 * v, (v) => 0.09 - 0.03 * v, 28, 10), M.gi);
    const sX = spl([[0, 0.058], [0.3, 0.056], [0.8, 0.038], [1, 0.034]]), sB = spl([[0, 0.06], [0.3, 0.068], [0.75, 0.042], [1, 0.036]]);
    add(kn, limbLoft('j:shin', D.shin, 0.02, (v) => sX(v), (v) => 0.054 - 0.018 * v, (v) => sB(v), 24, 10), M.wrap);
    add(kn, C('j:kneeP', () => new THREE.SphereGeometry(0.056, 12, 10)), M.gi, [0, 0.01, 0.006]);
    add(kn, C('j:kneeG', () => loft((v) => ({ y: 0.05 - 0.13 * v, rx: 0.062 - 0.01 * v, rz: 0.064 - 0.01 * v }), 12, 4, { a0: 0.33, a1: 0.67 })), M.steel);
    const fw = spl([[0, 0.0], [0.08, 0.03], [0.35, 0.036], [0.7, 0.04], [0.9, 0.03], [1, 0.006]]), fh = spl([[0, 0.04], [0.1, 0.07], [0.35, 0.06], [0.7, 0.032], [1, 0.016]]);
    add(ft, C('j:tabi', () => surf((u, v, p) => { const [c, sn] = ang(u), e = 0.7, x = Math.sign(c) * Math.abs(c) ** e * fw(v); p.set(x - (v > 0.75 && x < -0.008 ? 0.006 * smooth(0.75, 0.85, v) : 0), -0.065 + fh(v) / 2 + Math.sign(sn) * Math.abs(sn) ** e * fh(v) / 2, -0.05 + 0.2 * v); }, 24, 16, { closedU: true })), M.giD);
    add(ft, C('j:toeGap', () => new THREE.BoxGeometry(0.003, 0.03, 0.05)), M.wrap, [-0.012, -0.05, 0.13]);
  }
  /* ---- 무기 ---- */
  const W = J.weapon; let tip = 0.95;
  if (!star) {
    const k = new THREE.Group(); W.add(k);
    add(k, C('j:tsuka', () => { const g = loft((v) => ({ y: -0.24 + 0.26 * v, rx: 0.013, rz: 0.016 }), 12, 4); g.rotateX(Math.PI / 2); return g; }), M.tsuka);
    add(k, C('j:tsuba', () => new THREE.CylinderGeometry(0.038, 0.038, 0.008, 8)), M.iron, [0, 0, 0.03], [Math.PI / 2, 0, 0]);
    add(k, bladeGeo('j:blade', 0.04, tip, 0.026, 0.04), M.steel);
    const saya = new THREE.Group(); saya.position.set(0.08, 0.2, -0.11); saya.rotation.set(-2.5, 0, 0.5); J.chest.add(saya);
    add(saya, C('j:saya', () => { const pts = []; for (let i = 0; i <= 12; i++) { const v = i / 12; pts.push(new V3(0, -0.035 * v * v, -0.85 * v)); } return strand(pts, 0.018, 0.015, { seg: 24, rad: 10, flat: 0.7, ref: [1, 0, 0] }); }), M.lacq);
    add(saya, C('j:tsuka2', () => { const g = loft((v) => ({ y: 0.0 + 0.24 * v, rx: 0.013, rz: 0.016 }), 12, 4); g.rotateX(Math.PI / 2); return g; }), M.tsuka, [0, 0, 0.02]);
    add(saya, C('j:tsuba2', () => new THREE.CylinderGeometry(0.036, 0.036, 0.008, 8)), M.iron, [0, 0, 0.012], [Math.PI / 2, 0, 0]);
    add(J.chest, C('j:strap', () => { const pts = []; for (let i = 0; i <= 16; i++) { const k2 = i / 16; pts.push(loftAt(chP, 0.5 + 0.38 * (k2 - 0.5) * 2 * 0 + (k2 < 0.5 ? 0.65 + 0.3 * k2 * 2 : 0.95 + 0.3 * (k2 - 0.5) * 2) % 1, 0.95 - 0.8 * k2, new V3()).multiplyScalar(1.05)); } return strand(pts, 0.011, 0.011, { seg: 30, rad: 5, flat: 0.35 }); }), M.lacq);
  } else {
    tip = 0.32;
    add(W, C('j:kunaiG', () => { const g = loft((v) => ({ y: -0.1 + 0.12 * v, rx: 0.01, rz: 0.01 }), 8, 3); g.rotateX(Math.PI / 2); return g; }), M.wrap);
    add(W, C('j:kunaiR', () => new THREE.TorusGeometry(0.018, 0.004, 6, 14)), M.iron, [0, 0, -0.115], [0, Math.PI / 2, 0]);
    add(W, C('j:kunai', () => { const g = lathe([[0, 0], [0.024, 0.03], [0.016, 0.16], [0, 0.22]], 4); g.scale(1, 1, 0.25); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.02); return g; }), M.steel);
    // 가슴띠의 수리검들 · 등의 큰 풍마 수리검 · 왼손에 든 수리검
    const starG = (r, k = 4) => { const sh = new THREE.Shape(); for (let i = 0; i < k * 2; i++) { const a = i / (k * 2) * TAU, rr = i % 2 ? r * 0.28 : r; if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(rr, 0); } sh.closePath(); const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.12, 0, TAU, true); sh.holes.push(hole); const g = new THREE.ExtrudeGeometry(sh, { depth: r * 0.06, bevelEnabled: true, bevelThickness: r * 0.03, bevelSize: r * 0.03, bevelSegments: 1 }); g.translate(0, 0, -r * 0.03); return g; };
    const band = []; for (let i = 0; i <= 16; i++) { const k2 = i / 16; band.push(loftAt(chP, (0.64 + 0.72 * k2) % 1, 0.95 - 0.8 * k2, new V3()).multiplyScalar(1.05)); }
    add(J.chest, C('j:band', () => strand(band, 0.013, 0.013, { seg: 30, rad: 5, flat: 0.35 })), M.lacq);
    for (const k2 of [0.38, 0.5, 0.62]) { const q = band[Math.round(k2 * 16)], s = add(J.chest, C('j:star', () => starG(0.04)), M.steel, q.clone().multiplyScalar(1.04).toArray()); s.lookAt(s.position.clone().multiplyScalar(2)); }
    const fuma = add(J.chest, C('j:fuma', () => starG(0.22)), M.steel, [0, 0.14, -0.12]); fuma.rotation.set(0, 0, 0.4);
    add(J.chest, C('j:fumaC', () => new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12)), M.iron, [0, 0.14, -0.12], [Math.PI / 2, 0, 0]);
    m.handStar = add(J.handL, C('j:star2', () => starG(0.06)), M.steel, [0, -0.08, 0.05], [Math.PI / 2, 0, 0]);
  }
  const lag = { L: 0, vL: 0 }; let t = Math.random() * 10;
  m.update = (dt, f) => { t += dt; if (m.handStar) m.handStar.rotation.z += dt * 10; m.stepPhys(dt, f); };
  m.sole = 0.065;
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.1)); W.localToWorld(tt.set(0, 0, tip)); };
  m.tipPos = (out = new V3()) => (star ? J.handL.localToWorld(out.set(0, -0.08, 0.05)) : W.localToWorld(out.set(0, 0, tip)));
  return m;
}

/* =====================================================================
   사당의 오니 (정예) — 붉은 근육 거구 · 호랑이 가죽 · 가나보
   ===================================================================== */
export const GOLEM_DIMS = { hipH: 0.82, spineL: 0.2, chestL: 0.36, neckL: 0.02, shW: 0.36, uArm: 0.4, lArm: 0.42, hipW: 0.17, thigh: 0.36, shin: 0.38, headTop: 0.14 };
export function buildOni(pal, scale = 1.55) {
  const D = GOLEM_DIMS, m = buildHumanoid(D), J = m.J, add = addFn();
  ropeKit(m);
  const M = {
    skin: P({ map: T('oniSkin', () => tex(oniSkinCanvas(), [2, 2])), roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(0xff9a7a), clearcoat: 0.15 }),
    tiger: P({ map: T('tiger', () => tex(tigerCanvas(), [2, 1])), alphaTest: 0.5, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color(0xffd080) }),
    rope: P({ map: T('oRope', () => tex(ropeCanvas('#d8c070', '#a88a40', '#f8e8a8'), [1, 8])), roughness: 0.8 }),
    paper: P({ color: 0xf4f0e6, roughness: 0.9 }),
    gold: P({ color: pal.trim ?? 0xe8c040, metalness: 1, roughness: 0.28, clearcoat: 0.4 }),
    horn: P({ color: 0xe8dcc0, roughness: 0.4, clearcoat: 0.6, sheen: 0.4 }),
    hair: P({ color: 0xe8e4dc, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xffffff) }),
    bead: P({ color: 0x3a1a10, roughness: 0.25, clearcoat: 1 }),
    iron: P({ color: 0x2a2a30, metalness: 0.9, roughness: 0.4 }),
    wood: P({ color: 0x3a2214, roughness: 0.7, clearcoat: 0.2 }),
    eye: new THREE.MeshBasicMaterial({ color: pal.accent }),
    mouth: P({ color: 0x2a0606, roughness: 0.6 }),
  };
  /* ---- 몸통: 엉덩이 · 불룩한 배 · 갈라진 가슴 · 승모 ---- */
  add(J.hips, C('o:pelvis', () => loft((v) => ({ y: -0.16 + 0.3 * v, rx: 0.25, rzF: 0.21, rzB: 0.21, n: 2.2 }), 32, 8)), M.skin);
  const bF = spl([[0, 0.22], [0.4, 0.27], [1, 0.22]]);
  add(J.spine, C('o:belly', () => loft((v) => ({ y: -0.06 + 0.32 * v, rx: 0.26 + 0.03 * v, rzF: bF(v), rzB: 0.2, n: 2.1 }), 32, 10, { mod: (p, u, v, c, s) => { if (s > 0.4) p.z += 0.012 * Math.abs(Math.sin(v * 8)) * gauss(p.x, 0.1); } })), M.skin);
  const cX = spl([[0, 0.3], [0.4, 0.4], [0.75, 0.44], [1, 0.3]]), cF = spl([[0, 0.24], [0.5, 0.28], [1, 0.2]]), cB = spl([[0, 0.23], [0.6, 0.28], [1, 0.25]]);
  const chP = (v) => ({ y: -0.02 + 0.44 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), cz: -0.03 * v, n: 2.2 });
  add(J.chest, C('o:chest', () => loft(chP, 44, 16, { mod: (p, u, v, c, s) => { if (s > 0) p.z += 0.05 * gauss(Math.abs(p.x) - 0.15, 0.1) * gauss(p.y - 0.3, 0.1) * s - 0.012 * gauss(p.x, 0.025) * s; if (s < 0) p.z -= 0.03 * gauss(Math.abs(p.x) - 0.15, 0.08) * gauss(p.y - 0.3, 0.12) * -s; } })), M.skin);
  add(J.chest, C('o:traps', () => loft((v) => ({ y: 0.41 + 0.09 * v, rx: 0.3 - 0.18 * v, rzF: 0.18 - 0.06 * v, rzB: 0.24 - 0.08 * v, cz: -0.04 }), 32, 5)), M.skin);
  // 염주 목걸이
  for (let i = 0; i < 18; i++) { const a = (i / 18 - 0.5) * 2.6, p = loftAt(chP, 0.5 + a / TAU, 0.82 - 0.22 * Math.cos(a * 0.6) ** 2 * 0 - 0.25 * (1 - Math.abs(a) / 1.3), new V3()); p.multiplyScalar(1.06); add(J.chest, C('o:bead', () => new THREE.SphereGeometry(0.03, 10, 8)), i === 9 ? M.gold : M.bead, p.toArray(), [0, 0, 0], i === 9 ? [1.3, 1.3, 1.3] : [1, 1, 1]); }
  /* ---- 허리: 꼬인 금줄 · 시데 · 호랑이 가죽 ---- */
  add(J.hips, C('o:rope', () => { const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; pts.push(new V3(Math.sin(a) * 0.27, 0.1 + 0.015 * Math.cos(a), Math.cos(a) * 0.23)); } return strand(pts, 0.03, 0.03, { closed: true, seg: 96, rad: 10 }); }), M.rope);
  for (const a of [-0.5, 0.5, Math.PI - 0.4, Math.PI + 0.4]) { const g = new THREE.Group(); g.position.set(Math.sin(a) * 0.29, 0.08, Math.cos(a) * 0.25); g.rotation.y = a; J.hips.add(g); add(g, C('o:shide', () => { const sh = new THREE.Shape(); sh.moveTo(-0.02, 0); sh.lineTo(0.02, 0); sh.lineTo(0.02, -0.05); sh.lineTo(-0.01, -0.05); sh.lineTo(-0.01, -0.09); sh.lineTo(0.03, -0.09); sh.lineTo(0.03, -0.15); sh.lineTo(-0.02, -0.15); sh.closePath(); return new THREE.ShapeGeometry(sh); }), M.paper); }
  add(J.hips, C('o:loin', () => loft((v) => ({ y: 0.08 - 0.42 * v, rx: 0.27 + 0.09 * v, rzF: 0.24 + 0.08 * v, rzB: 0.24 + 0.1 * v }), 40, 8, { uvU: 1 })), M.tiger);
  /* ---- 머리: 이마 뼈 · 넓은 턱 · 송곳니 · 빛나는 눈 · 마디 진 뿔 · 갈기 ---- */
  const H = new THREE.Group(); H.position.set(0, 0.08, 0.12); J.head.add(H);
  const hP = (v) => ({ y: -0.08 + 0.28 * v, rx: 0.13 * Math.sin(Math.PI * (0.15 + 0.85 * v)) ** 0.6 + 0.01, rzF: 0.14 * Math.sin(Math.PI * (0.12 + 0.88 * v)) ** 0.6 + 0.01, rzB: 0.13 * Math.sin(Math.PI * (0.12 + 0.88 * v)) ** 0.6 + 0.01 });
  const hMod = (p, u, v, c, s) => { if (s > 0) { p.z += 0.03 * gauss(p.y - 0.09, 0.025) * (1 - 0.5 * Math.abs(p.x) / 0.13) + 0.025 * gauss(p.x, 0.025) * gauss(p.y - 0.03, 0.03); p.x *= 1 + 0.15 * gauss(p.y + 0.03, 0.05); } };
  add(H, C('o:head', () => loft(hP, 36, 18, { mod: hMod, poles: [18] })), M.skin);
  add(H, C('o:mouth', () => new THREE.SphereGeometry(0.06, 14, 8, 0, TAU, 0, Math.PI / 2)), M.mouth, [0, -0.04, 0.11], [Math.PI, 0, 0], [1.4, 0.4, 0.5]);
  for (const s of [-1, 1]) {
    add(H, C('o:eye', () => new THREE.SphereGeometry(0.018, 10, 8)), M.eye, [s * 0.045, 0.06, 0.135], [0, 0, 0], [1.3, 0.75, 0.6]);
    add(H, C('o:tusk', () => { const g = new THREE.ConeGeometry(0.014, 0.06, 8); g.translate(0, 0.03, 0); return g; }), M.horn, [s * 0.04, -0.05, 0.14], [0.2, 0, s * -0.15]);
    add(H, C('o:horn' + s, () => { const pts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push(new V3(s * (0.07 + 0.08 * k - 0.03 * k * k), 0.15 + 0.2 * k, 0.02 - 0.06 * k * k)); } return strand(pts, 0.035, 0.004, { seg: 20, rad: 10 }); }), M.horn);
    for (let i = 0; i < 3; i++) { const k = 0.12 + i * 0.16; add(H, C(`o:hornR${s}${i}`, () => { const c = new V3(s * (0.07 + 0.08 * k - 0.03 * k * k), 0.15 + 0.2 * k, 0.02 - 0.06 * k * k), pts = [], rr = 0.035 - 0.031 * k + 0.003; for (let j = 0; j <= 16; j++) { const a = j / 16 * TAU; pts.push(c.clone().add(new V3(Math.cos(a) * rr, 0, Math.sin(a) * rr))); } return strand(pts, 0.004, 0.004, { closed: true, seg: 20, rad: 5 }); }), M.gold); }
  }
  const r = rng(77); for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 1.5 - Math.PI * 0.75 + Math.PI, el = 0.1 + r() * 0.6; const b = new V3(Math.sin(a) * 0.12, 0.1 + el * 0.12, Math.cos(a) * 0.12); const d = b.clone().setY(0).normalize(); const pts = [b, b.clone().addScaledVector(d, 0.08).add(new V3(0, 0.04, -0.05)), b.clone().addScaledVector(d, 0.16).add(new V3(0, -0.02 - r() * 0.08, -0.14)), b.clone().addScaledVector(d, 0.2).add(new V3(0, -0.12 - r() * 0.1, -0.2))];
    add(H, C('o:hair' + k, () => strand(pts, 0.035, 0.004, { seg: 12, rad: 6, flat: 0.5 })), M.hair); }
  /* ---- 팔: 어깨 · 이두 · 굵은 팔뚝 · 금 팔찌 · 주먹 ---- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('o:delt', () => new THREE.SphereGeometry(0.16, 18, 14)), M.skin, [s * 0.03, 0.02, 0], [0, 0, 0], [1.05, 1, 1]);
    add(sh, limbLoft('o:uarm', D.uArm, 0.04, (v) => 0.13 - 0.03 * v + 0.012 * gauss(v - 0.45, 0.2), (v) => 0.12 - 0.02 * v + 0.02 * gauss(v - 0.45, 0.2), (v) => 0.12 - 0.02 * v, 24, 10), M.skin);
    add(el, limbLoft('o:farm', D.lArm, 0.03, (v) => 0.11 + 0.02 * gauss(v - 0.25, 0.25) - 0.02 * v, (v) => 0.1 + 0.015 * gauss(v - 0.3, 0.2) - 0.015 * v, (v) => 0.105 - 0.015 * v, 24, 10), M.skin);
    add(el, C('o:cuff', () => loft((v) => ({ y: -D.lArm + 0.1 - 0.06 * v, rx: 0.1, rz: 0.098 }), 28, 2)), M.gold);
    add(ha, C('o:fist', () => loft((v) => ({ y: 0.02 - 0.17 * v, rx: 0.075, rz: 0.1 + 0.01 * v, n: 3 }), 18, 6)), M.skin, [0, 0, 0.01]);
    for (let k = 0; k < 4; k++) add(ha, C('o:knuck', () => new THREE.SphereGeometry(0.03, 10, 8)), M.skin, [s * 0.05, -0.14, 0.075 - k * 0.05]);
  }
  /* ---- 다리 · 발 (발톱) ---- */
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, limbLoft('o:thigh', D.thigh, 0.06, (v) => 0.17 - 0.04 * v, (v) => 0.16 - 0.03 * v, (v) => 0.17 - 0.04 * v, 24, 8), M.skin);
    add(kn, limbLoft('o:shin', D.shin, 0.03, (v) => 0.12 - 0.03 * v, (v) => 0.11 - 0.02 * v, (v) => 0.13 - 0.03 * v + 0.02 * gauss(v - 0.3, 0.2), 24, 8), M.skin);
    add(kn, C('o:ank', () => loft((v) => ({ y: -D.shin + 0.05 - 0.04 * v, rx: 0.1, rz: 0.1 }), 20, 2)), M.gold);
    add(ft, C('o:foot', () => { const fw = spl([[0, 0], [0.1, 0.08], [0.6, 0.1], [1, 0.05]]), fh = spl([[0, 0.06], [0.2, 0.11], [0.7, 0.06], [1, 0.03]]); return surf((u, v, p) => { const [c, sn] = ang(u), e = 0.7; p.set(Math.sign(c) * Math.abs(c) ** e * fw(v), -0.07 + fh(v) / 2 + Math.sign(sn) * Math.abs(sn) ** e * fh(v) / 2, -0.08 + 0.3 * v); }, 20, 12, { closedU: true }); }), M.skin);
    for (const x of [-0.05, 0, 0.05]) add(ft, C('o:claw', () => { const g = new THREE.ConeGeometry(0.014, 0.04, 6); g.rotateX(Math.PI / 2); return g; }), M.horn, [x, -0.055, 0.22]);
  }
  /* ---- 가나보: 팔각 나무 몸통 · 쇠띠 · 쇠징 ---- */
  const W = J.weapon;
  add(W, C('o:club', () => { const g = lathe([[0.03, -0.2], [0.036, -0.18], [0.04, 0.2], [0.09, 0.6], [0.12, 1.1], [0.11, 1.28], [0.0, 1.32]], 8); g.rotateX(Math.PI / 2); return g; }), M.wood);
  for (const z of [-0.18, 0.2, 0.62, 1.12]) add(W, C('o:band' + z, () => { const r0 = z < 0 ? 0.04 : z < 0.3 ? 0.045 : z < 0.7 ? 0.095 : 0.125; const g = new THREE.CylinderGeometry(r0, r0, 0.035, 8); g.rotateX(Math.PI / 2); return g; }), M.iron, [0, 0, z]);
  add(W, C('o:studs', () => { const cone = new THREE.ConeGeometry(0.018, 0.05, 6), parts = []; for (let k = 0; k < 6; k++) for (let i = 0; i < 8; i++) { const z = 0.66 + k * 0.08, rr = 0.095 + (k / 5) * 0.025, a = i / 8 * TAU + (k % 2) * 0.39 + Math.PI / 8, g = cone.clone(); g.translate(0, rr + 0.02, 0); g.rotateZ(a); g.translate(0, 0, z); parts.push(g); } const out = new THREE.BufferGeometry(); const pos = [], nor = []; for (const p of parts) { const q = p.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); } out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return out; }), M.iron);
  let t = 0;
  m.update = (dt, f) => { t += dt; m.stepPhys(dt, f); };
  m.sole = 0.07;
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.3)); W.localToWorld(tt.set(0, 0, 1.3)); };
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0, 1.2));
  return m;
}

/* =====================================================================
   구미호 쿠즈하 (보스) — 네발 여우 · 아홉 꼬리
   리그: 골반을 앞으로 1.45 숙인 휴머노이드 (골반 · 등 · 가슴 로컬: +Y = 앞, -Z = 등 위, +Z = 배)
   o.ghost = 환영 분신용 (반투명 · 꼬리는 단순화)
   ===================================================================== */
export const QUAD_DIMS = { hipH: 0.62, spineL: 0.26, chestL: 0.3, neckL: 0.16, shW: 0.13, uArm: 0.27, lArm: 0.26, hipW: 0.12, thigh: 0.3, shin: 0.28, headTop: 0.2 };
export function buildKuzuha(pal, scale = 1.7, o = {}) {
  const D = QUAD_DIMS, m = buildHumanoid(D), J = m.J, add = addFn();
  ropeKit(m);
  const acc = pal.accent;
  const M = {
    fur: P({ map: T('furM', () => tex(furCanvas(true), [1, 1])), roughness: 0.75, sheen: 1, sheenColor: new THREE.Color(0xffe0f4), sheenRoughness: 0.5 }),
    furP: P({ map: T('furP', () => tex(furCanvas(false), [1, 1])), roughness: 0.75, sheen: 1, sheenColor: new THREE.Color(0xffe0f4), sheenRoughness: 0.5 }),
    tail: P({ map: T('tailM', () => tex(tailCanvas(false))), emissiveMap: T('tailG', () => tex(tailCanvas(true), [1, 1], false)), emissive: acc, emissiveIntensity: 1.4, roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0xffd0f0) }),
    pink: P({ color: 0xf0a0c0, roughness: 0.6 }),
    dark: P({ color: 0x1a1018, roughness: 0.3, clearcoat: 0.8 }),
    red: P({ color: 0xd81e46, roughness: 0.5, emissive: 0xd81e46, emissiveIntensity: 0.25 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffd0f0 }),
    iris: new THREE.MeshBasicMaterial({ color: acc }),
    gold: P({ color: 0xe8c060, metalness: 1, roughness: 0.25, clearcoat: 0.5 }),
    rope: P({ map: T('kRope', () => tex(ropeCanvas('#e8d8a0', '#b89a50', '#fff4c8'), [1, 8])), roughness: 0.8 }),
    paper: P({ color: 0xffffff, roughness: 0.9 }),
    fire: new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    claw: P({ color: 0x2a1a24, roughness: 0.3, clearcoat: 1 }),
    teeth: P({ color: 0xfff8f0, roughness: 0.3 }),
  };
  /* ---- 몸통: 엉덩이 · 허리 · 깊은 가슴 (u 0.5 = 배, 0 = 등) ---- */
  // 몸 전체 단면 (골반 기준 앞쪽 거리 y): 엉덩이 → 잘록한 허리 → 깊은 가슴. 각 마디가 자기 구간을 이어서 만든다
  const BY = [-0.22, -0.1, 0.04, 0.2, 0.34, 0.48, 0.6, 0.7];
  const bX = spl(BY.map((y, i) => [y, [0.06, 0.122, 0.13, 0.096, 0.11, 0.132, 0.12, 0.088][i]])), bF = spl(BY.map((y, i) => [y, [0.05, 0.11, 0.108, 0.082, 0.115, 0.172, 0.158, 0.11][i]])), bB = spl(BY.map((y, i) => [y, [0.06, 0.125, 0.128, 0.104, 0.108, 0.118, 0.11, 0.08][i]])), bC = spl(BY.map((y, i) => [y, [0, 0, 0, 0, 0.012, 0.035, 0.038, 0.02][i]]));
  const seg = (j, key, y0, y1, off) => add(j, C(key, () => loft((v) => { const y = y0 + (y1 - y0) * v; return { y: y - off, rx: bX(y), rzF: bF(y), rzB: bB(y), cz: bC(y), n: 2.05 }; }, 36, 14, { mod: (p, u, v, c, sn) => { const y = y0 + (y1 - y0) * v; if (sn > 0.3 && y > 0.3) p.z += 0.012 * Math.sin(u * TAU * 9) * smooth(0.3, 1, sn); } })), M.fur);
  seg(J.hips, 'k:hipsB', -0.22, 0.17, 0); seg(J.spine, 'k:spineB', 0.06, 0.42, 0.08); seg(J.chest, 'k:chestB', 0.3, 0.7, 0.34);
  // 가슴 · 배의 늘어진 흰 털 (배 쪽 = +Z)
  { const r = rng(9); for (let k = 0; k < 22; k++) { const y = 0.36 + r() * 0.3 - 0.34, x = (r() - 0.5) * 0.16, z = bF(y + 0.34) * 0.92 + bC(y + 0.34); const b = new V3(x, y, z);
      add(J.chest, C('k:belly' + k, () => strand([b, b.clone().add(new V3(x * 0.3, -0.03, 0.04)), b.clone().add(new V3(x * 0.5, -0.07 - r() * 0.03, 0.07 + r() * 0.03))], 0.024, 0.003, { seg: 8, rad: 6, flat: 0.5 })), M.furP); } }
  /* ---- 목 · 털 갈기 · 금줄과 방울 ---- */
  add(J.neck, C('k:neck', () => loft((v) => ({ y: -0.1 + 0.32 * v, rx: 0.088 - 0.022 * v, rzF: 0.1 - 0.03 * v, rzB: 0.085 - 0.02 * v, cz: 0.02 * v }), 28, 8)), M.furP);
  { const r = rng(5); for (let k = 0; k < 34; k++) { const a = (k / 34) * TAU, el = r(); const b = new V3(Math.sin(a) * 0.085, -0.02 + el * 0.14, Math.cos(a) * 0.09); const d = new V3(Math.sin(a), 0, Math.cos(a));
    const pts = [b, b.clone().addScaledVector(d, 0.06).add(new V3(0, -0.02, 0)), b.clone().addScaledVector(d, 0.1 + r() * 0.04).add(new V3(0, -0.07 - r() * 0.05, -0.02))];
    add(J.neck, C('k:ruff' + k, () => strand(pts, 0.03, 0.003, { seg: 10, rad: 6, flat: 0.5 })), M.furP); } }
  const ropeP = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; ropeP.push(new V3(Math.sin(a) * 0.1, 0.06 + 0.02 * Math.cos(a), Math.cos(a) * 0.105 + 0.01)); }
  add(J.neck, C('k:shime', () => strand(ropeP, 0.016, 0.016, { closed: true, seg: 80, rad: 8 })), M.rope);
  add(J.neck, C('k:bell', () => new THREE.SphereGeometry(0.028, 16, 12)), M.gold, [0, 0.03, 0.135]);
  add(J.neck, C('k:bellS', () => new THREE.TorusGeometry(0.029, 0.003, 6, 20)), M.dark, [0, 0.03, 0.135], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.09, 0.05, 0.07); g.rotation.set(0, s * 0.9, 0); J.neck.add(g); add(g, C('k:shide', () => { const sh = new THREE.Shape(); sh.moveTo(-0.015, 0); sh.lineTo(0.015, 0); sh.lineTo(0.015, -0.035); sh.lineTo(-0.008, -0.035); sh.lineTo(-0.008, -0.065); sh.lineTo(0.022, -0.065); sh.lineTo(0.022, -0.11); sh.lineTo(-0.015, -0.11); sh.closePath(); return new THREE.ShapeGeometry(sh); }), M.paper); }
  /* ---- 머리: 길게 깎은 여우 머리 (loft 를 +Z 로 눕힘: rx = 폭, rzB = 위, rzF = 아래) ---- */
  const H = J.head, hg = new THREE.Group(); hg.position.set(0, 0.08, -0.02); H.add(hg); m.headG = hg;
  const hw = spl([[0, 0.05], [0.12, 0.085], [0.32, 0.092], [0.5, 0.06], [0.75, 0.034], [0.94, 0.02], [1, 0.004]]), ht = spl([[0, 0.05], [0.15, 0.082], [0.36, 0.07], [0.52, 0.045], [0.8, 0.03], [1, 0.006]]), hb = spl([[0, 0.05], [0.2, 0.066], [0.4, 0.05], [0.6, 0.028], [1, 0.006]]), hc = spl([[0, 0.0], [0.4, 0.0], [0.7, 0.012], [1, 0.022]]);
  const hP = (v) => ({ y: -0.1 + 0.32 * v, rx: hw(v), rzF: hb(v), rzB: ht(v), cz: hc(v) });
  const headGeo = C('k:head', () => { const g = loft(hP, 32, 24, { mod: (p, u, v, c, s) => { if (s < 0 && v > 0.2 && v < 0.45) p.z -= 0.008 * gauss(Math.abs(p.x) - 0.05, 0.02); } }); g.rotateX(Math.PI / 2); return g; });
  add(hg, headGeo, M.fur);
  const hpt = (u, v, off = 0) => { const p = loftAt(hP, u, v, new V3()); const n = new V3(p.x, 0, p.z - (hP(v).cz || 0)).normalize(); p.addScaledVector(n, off); return new V3(p.x, -p.z, p.y); };
  add(hg, C('k:nose', () => new THREE.SphereGeometry(0.016, 12, 10)), M.dark, hpt(0, 0.985, 0.002).toArray(), [0, 0, 0], [1.2, 0.9, 1]);
  // 아래턱 (벌어짐) · 이빨
  const jaw = new THREE.Group(); jaw.position.copy(hpt(0.5, 0.25, -0.01)); hg.add(jaw); m.jaw = jaw;
  add(jaw, C('k:jaw', () => { const g = loft((v) => ({ y: 0 + 0.17 * v, rx: 0.04 - 0.028 * v, rzF: 0.022 - 0.014 * v, rzB: 0.008, cz: 0 }), 18, 8); g.rotateX(Math.PI / 2); return g; }), M.furP);
  for (const s of [-1, 1]) add(jaw, C('k:fang', () => { const g = new THREE.ConeGeometry(0.005, 0.018, 6); return g; }), M.teeth, [s * 0.016, 0.012, 0.13]);
  for (const s of [-1, 1]) add(hg, C('k:fangU', () => { const g = new THREE.ConeGeometry(0.005, 0.02, 6); g.rotateX(Math.PI); return g; }), M.teeth, hpt(0.5 + s * 0.07, 0.82, -0.004).toArray());
  // 눈 (아몬드형 · 분홍 홍채) · 붉은 눈매 문양 · 이마 불꽃
  for (const s of [-1, 1]) {
    const e = hpt(0.5 + s * 0.31, 0.47, 0.0);
    add(hg, C('k:eyeW', () => new THREE.SphereGeometry(0.015, 12, 8)), M.eye, e.toArray(), [0, s * 0.5, s * 0.25], [1.5, 0.65, 0.6]);
    add(hg, C('k:iris', () => new THREE.SphereGeometry(0.009, 10, 8)), M.iris, e.clone().add(new V3(s * 0.004, 0, 0.004)).toArray(), [0, 0, 0], [0.8, 1.2, 0.6]);
    add(hg, C('k:mark' + s, () => { const pts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push(hpt(0.5 + s * (0.3 - 0.08 * k), 0.47 - 0.35 * k, 0.004)); } return strand(pts, 0.006, 0.0015, { seg: 20, rad: 5 }); }), M.red);
    add(hg, C('k:mark2' + s, () => { const pts = []; for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push(hpt(0.5 + s * (0.36 + 0.02 * k), 0.42 + 0.22 * k, 0.003)); } return strand(pts, 0.004, 0.0012, { seg: 16, rad: 5 }); }), M.red);
    // 뺨 털 (뒤 · 옆으로 뻗음)
    for (let k = 0; k < 4; k++) { const b = hpt(0.5 + s * 0.24, 0.24 + k * 0.06, -0.004); add(hg, C(`k:cheek${s}${k}`, () => strand([b, b.clone().add(new V3(s * 0.04, -0.01, -0.03)), b.clone().add(new V3(s * 0.07, -0.025 - k * 0.006, -0.07))], 0.016, 0.002, { seg: 8, rad: 5, flat: 0.5 })), M.furP); }
    // 귀: 컵 모양 바깥 털 + 분홍 안쪽 + 끝의 붉은 털
    const ear = new THREE.Group(); ear.position.copy(hpt(1 - (0.5 + s * 0.35) % 1 + 0, 0.14, -0.01)); ear.position.set(s * 0.05, 0.06, -0.035); ear.rotation.set(-0.25, 0, -s * 0.28); hg.add(ear);
    add(ear, C('k:ear', () => loft((v) => ({ y: 0.14 * v, rx: 0.045 * (1 - v) ** 0.9 + 0.002, rzF: 0.01 + 0.012 * (1 - v), rzB: 0.022 * (1 - v) + 0.002, cz: -0.012 * v }), 18, 8, { a0: -0.35, a1: 0.35 })), M.fur);
    add(ear, C('k:earIn', () => loft((v) => ({ y: 0.01 + 0.11 * v, rx: 0.032 * (1 - v) ** 0.9 + 0.002, rzF: 0.006, rzB: 0.012 * (1 - v) + 0.002, cz: -0.008 * v }), 14, 6, { a0: -0.32, a1: 0.32 })), M.pink, [0, 0, 0.006]);
    add(ear, C('k:earTip', () => lathe([[0.0, 0.0], [0.012, 0.012], [0.008, 0.03], [0, 0.05]], 8)), M.red, [0, 0.11, -0.014]);
  }
  // 이마의 붉은 불꽃 문양 · 금 비녀 장식
  add(hg, C('k:brand', () => { const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12, a = k * Math.PI; pts.push(hpt(0.5 + Math.cos(a) * 0.06 * (1 - k * 0.5) * 0 + 0.0, 0.3 + 0.2 * k, 0.004).add(new V3(Math.sin(a * 2) * 0.008, 0, 0))); } return strand(pts, 0.006, 0.002, { seg: 20, rad: 5 }); }), M.red);
  { const g = new THREE.Group(); g.position.set(0.045, 0.075, -0.06); g.rotation.set(-0.6, 0, -0.5); hg.add(g); add(g, C('k:kanz', () => new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6)), M.gold, [0, 0.05, 0]); add(g, C('k:kanzF', () => new THREE.IcosahedronGeometry(0.018, 0)), M.red, [0, 0.13, 0]); for (let i = 0; i < 3; i++) add(g, C('k:kanzD', () => new THREE.SphereGeometry(0.006, 6, 5)), M.gold, [0.01 * (i - 1), 0.11 - 0.02 * i, 0.01]); }
  /* ---- 다리: 앞다리 = 팔 · 뒷다리 = 다리 (근육 · 발목 · 발 · 검은 발톱) ---- */
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(a, C('k:shoulder', () => new THREE.SphereGeometry(0.095, 16, 12)), M.fur, [0, -0.03, -0.005], [0, 0, 0], [0.85, 1.25, 1.1]);
    add(a, limbLoft('k:uleg', D.uArm, 0.03, (v) => 0.088 - 0.05 * v ** 0.8, (v) => 0.1 - 0.062 * v ** 0.8, (v) => 0.096 - 0.058 * v ** 0.8, 20, 10), M.fur);
    for (let k = 0; k < 3; k++) add(b, C('k:elbT' + k, () => strand([[0.012 * (k - 1), 0.0, -0.03], [0.015 * (k - 1), -0.03, -0.06], [0.02 * (k - 1), -0.07, -0.075]], 0.016, 0.002, { seg: 6, rad: 5, flat: 0.5 })), M.furP);
    add(b, limbLoft('k:fleg', D.lArm, 0.02, (v) => 0.036 - 0.01 * v, (v) => 0.036 - 0.008 * v, (v) => 0.038 - 0.01 * v, 16, 8), M.furP);
    add(c, C('k:paw', () => { const g = new THREE.SphereGeometry(0.05, 16, 12); g.scale(1, 0.55, 1.35); g.translate(0, -0.022, 0.03); return g; }), M.furP);
    for (const x of [-0.02, -0.007, 0.007, 0.02]) add(c, C('k:claw', () => { const g = new THREE.ConeGeometry(0.005, 0.02, 6); g.rotateX(Math.PI / 2 + 0.4); return g; }), M.claw, [x, -0.03, 0.08]);
  }
  for (const [a, b, c] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(a, limbLoft('k:thigh', D.thigh, 0.07, (v) => 0.12 - 0.075 * v ** 0.75, (v) => 0.15 - 0.105 * v ** 0.75, (v) => 0.13 - 0.09 * v ** 0.75, 22, 10), M.fur);
    for (let k = 0; k < 4; k++) add(a, C('k:thT' + k, () => strand([[0.02 * (k - 1.5), -0.05 - k * 0.04, -0.09], [0.025 * (k - 1.5), -0.09 - k * 0.04, -0.12], [0.03 * (k - 1.5), -0.15 - k * 0.04, -0.12]], 0.022, 0.002, { seg: 6, rad: 5, flat: 0.5 })), M.fur);
    add(b, limbLoft('k:shin', D.shin, 0.02, (v) => 0.036 - 0.01 * v, (v) => 0.032 - 0.006 * v, (v) => 0.044 - 0.014 * v + 0.008 * gauss(v, 0.15), 16, 8), M.furP);
    add(c, C('k:hpaw', () => { const g = loft((v) => ({ y: 0.0 - 0.06 * v, rx: 0.026 + 0.012 * v, rz: 0.03 + 0.02 * v, cz: 0.02 * v }), 14, 5); return g; }), M.furP);
    add(c, C('k:paw', () => { const g = new THREE.SphereGeometry(0.05, 16, 12); g.scale(1, 0.55, 1.35); g.translate(0, -0.022, 0.03); return g; }), M.furP, [0, -0.04, 0.02]);
    for (const x of [-0.02, -0.007, 0.007, 0.02]) add(c, C('k:claw', () => { const g = new THREE.ConeGeometry(0.005, 0.02, 6); g.rotateX(Math.PI / 2 + 0.4); return g; }), M.claw, [x, -0.07, 0.1]);
  }
  /* ---- 아홉 꼬리: 굵기가 변하는 복슬한 관 (절차적 흔들림 · 채찍) ---- */
  const NT = o.tails ?? 9, tails = [];
  for (let i = 0; i < NT; i++) { const rope = new Rope(9, 0.1), view = new RopeTube(rope, o.ghostMat || M.tail, { sub: 3, rad: 12, uvV: 1, prof: (v) => (0.025 + 0.068 * Math.sin(Math.PI * Math.min(1, 0.12 + v * 0.95)) ** 0.75) * (1 - 0.92 * smooth(0.8, 1, v)) * scale * 0.9 });
    tails.push({ rope, view, fan: (i - (NT - 1) / 2) / ((NT - 1) / 2 || 1), whip: 0, tgt: new V3() }); }
  m.tails = tails; m.extraMeshes = tails.map((t) => t.view.mesh);
  // 몸 주위를 떠도는 여우불 셋
  const wisps = []; for (let i = 0; i < 3; i++) { const g = new THREE.Group(); m.body.add(g); add(g, C('k:wisp', () => new THREE.SphereGeometry(0.05, 12, 10)), M.fire); add(g, C('k:wispC', () => new THREE.SphereGeometry(0.022, 10, 8)), M.eye); wisps.push(g); }
  if (o.ghost) { const gm = new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.root.traverse((x) => { if (x.isMesh && x.material !== M.fire && x.material !== M.eye && x.material !== M.iris) { x.material = gm; x.castShadow = false; } }); for (const t of tails) t.view.mesh.material = gm; m.ghostMat = gm; }
  /* ---- 매 프레임: 꼬리 곡선 · 턱 · 여우불 ---- */
  let t = Math.random() * 10; const base = new V3(), q = new V3(), w = new V3();
  m.update = (dt, f) => {
    t += dt; const sp = f ? Math.hypot(f.vel.x, f.vel.z) : 0, act = f && f.state === 'act', vis = f ? f.root.visible : true;
    m.jaw.rotation.x = act ? 0.45 : 0.06 + 0.04 * Math.sin(t * 1.3);
    wisps.forEach((g, i) => { const a = t * 1.4 + i * TAU / 3; g.position.set(Math.cos(a) * 0.55, 0.9 + Math.sin(t * 2 + i) * 0.12, Math.sin(a) * 0.55 - 0.1); g.scale.setScalar(0.85 + 0.2 * Math.sin(t * 9 + i)); });
    J.hips.updateMatrixWorld(true);
    for (let i = 0; i < tails.length; i++) {
      const T0 = tails[i], p = T0.rope.p, fan = T0.fan, ph = t * (1.6 + sp * 0.15) + i * 0.7, L = 0.78;
      for (let k = 0; k < p.length; k++) {
        const s = k / (p.length - 1);
        // 골반 로컬: 뒤 = -Y, 위 = -Z, 옆 = X — 뒤로 뻗어 위로 솟았다가 끝이 살짝 말림 · 부채꼴로 펼침
        q.set(fan * (0.08 + 0.78 * s - 0.1 * s * s) + Math.sin(ph - s * 2.5) * 0.09 * s, -0.13 - L * (0.42 * s + 0.08 * s * s) + 0.12 * s * s * s * Math.abs(fan), -0.04 - L * (0.62 * s + 0.15 * s * s - 0.38 * s * s * s) - 0.32 * (1 - Math.abs(fan)) * s * s + Math.cos(ph * 0.8 - s * 2) * 0.05 * s - sp * 0.03 * s);
        J.hips.localToWorld(p[k].copy(q));
        if (T0.whip > 0.001) { J.hips.localToWorld(base.set(0, -0.13, -0.04)); w.lerpVectors(base, T0.tgt, s); w.y += Math.sin(s * Math.PI) * 0.5 * (1 - T0.whip) * (f ? f.scale : 1); p[k].lerp(w, T0.whip * smooth(0, 0.3, s)); }
      }
      T0.view.update(); T0.view.mesh.visible = vis;
    }
    if (f) m.stepPhys(dt, f);
  };
  m.sole = 0.05;
  m.weaponPts = (b, tt) => { J.head.localToWorld(b.set(0, 0.06, 0)); J.head.localToWorld(tt.set(0, 0.04, 0.32)); };
  m.tipPos = (out = new V3()) => J.head.localToWorld(out.set(0, 0.08, 0.25));
  m.tailRoot = (out = new V3()) => J.hips.localToWorld(out.set(0, -0.13, -0.3));
  return m;
}
