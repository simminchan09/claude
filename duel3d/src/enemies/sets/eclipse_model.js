// 1. 일식의 신전 — 공허 결정체 무리 3D 모델 (기술 · 행동은 eclipse.js)
//
//   공허 파편병: 흑요석 유리 몸(붉게 빛나는 균열) · 깎인 결정 두개골 투구(V자 눈빛) · 어깨 · 등에 돋은 결정
//               결정 흉갑 · 오른 팔뚝의 세 갈래 결정 칼날 · 결정 발톱 · 찢어진 허리 천(뒤 두 가닥: 로프 물리)
//   떠도는 공허 정령 사수: 다리 대신 휘어지는 영체 꼬리 · 찢어진 두건 망토 · 초승달 문양 가면 · 등 뒤 일식 후광
//               왼손의 공허 구슬(고리가 돈다) · 주위를 도는 결정 파편 · 어깨에서 흩날리는 영체 띠(로프 물리)
//   흑요석 공허 파쇄자: 깎인 흑요석 거구(주황 균열) · 등의 결정 능선 · 가슴에 박힌 작은 뿔 머리 · 바위 주먹
//               흑요석 대망치(빛나는 핵 · 쇠띠) · 허리에서 늘어진 사슬 두 줄(로프 물리)
//   공허의 기사 니힐: 문양을 새긴 보랏빛 판금 갑옷(겹친 견갑 · 허리 판 · 무릎 가시) · 뿔 달린 투구(T자 눈빛)
//               머리 위를 도는 결정 왕관 · 등 뒤 일식 후광 · 찢어진 별빛 망토(천 물리) · 견갑에서 늘어진 천 띠(로프)
//               공허 균열이 흐르는 대검 (결정 코등이 · 감긴 자루 · 보석 폼멜)
import * as THREE from 'three';
import { buildHumanoid, applyPose } from '../../rig.js';
import { Cloth, Rope, RopeTube, RopeChain } from '../../cloth.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, fbm, heightToNormal, envCube, cached } from '../../sculpt.js';
import { clamp } from '../../core.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = (k, fn) => cached('eclipse:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const _tex = {}; const T = (k, f) => _tex[k] || (_tex[k] = f());
// 갈라진 균열 (흰 선 = 빛나는 틈 · 가장자리가 이어지게 9방향으로 그림) — 발광 맵
function crackCanvas(seed, W = 512, H = 512, n = 8, w0 = 2.0) {
  const [c, g] = cv(W, H), r = rng(seed); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const paths = [];
  const walk = (x, y, a, len, w, depth) => { const pts = [[x, y]]; for (let i = 0; i < len; i++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 7; y += Math.sin(a) * 7; pts.push([x, y]); if (depth < 2 && r() < 0.07) walk(x, y, a + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.7), (len * 0.45) | 0, w * 0.55, depth + 1); } paths.push([pts, w]); };
  for (let i = 0; i < n; i++) walk(r() * W, r() * H, r() * TAU, 14 + ((r() * 26) | 0), w0 * (0.6 + r() * 0.8), 0);
  for (const pass of [[10, 'rgba(255,255,255,0.25)', 3.2], [2, '#fff', 1]]) {
    g.shadowColor = '#fff'; g.shadowBlur = pass[0]; g.strokeStyle = pass[1]; g.lineCap = g.lineJoin = 'round';
    for (const [pts, w] of paths) { g.lineWidth = w * pass[2]; for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); g.stroke(); } }
  }
  return c;
}
// 흑요석 겉면: 짙은 바탕 · 보랏빛 얼룩 · 유리 결
function obsidianCanvas(seed, base = '#17121d', W = 256, H = 256) {
  const [c, g] = cv(W, H), r = rng(seed), img = g.createImageData(W, H), d = img.data, b = parseInt(base.slice(1), 16), br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = fbm(x / 40, y / 40, seed, 4), s = fbm(x / 9, y / 70, seed + 3, 2), k = (y * W + x) * 4, v = 0.75 + n * 0.5 + s * 0.15; d[k] = br * v + 10 * n; d[k + 1] = bg * v; d[k + 2] = bb * v + 18 * n; d[k + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(160,140,190,0.10)'; for (let i = 0; i < 40; i++) { g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * W, y = r() * H; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60); g.stroke(); }
  return c;
}
// 찢어진 천 (위 = 단단, 아래로 갈수록 찢긴 술 · 구멍) — 알파 테스트용. 캔버스 아래 = uv v 0
function tornCanvas(seed, top, bot, W = 256, H = 512, o = {}) {
  const [c, g] = cv(W, H), r = rng(seed), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 결 · 얼룩
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 8 + r() * 40); }
  if (o.stars) for (let i = 0; i < o.stars; i++) { const x = r() * W, y = r() * H * 0.95, s = r() < 0.1 ? 2.2 : 0.9; g.fillStyle = `rgba(${200 + r() * 55},${170 + r() * 60},255,${0.4 + r() * 0.6})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
  if (o.trim) { g.fillStyle = o.trim; g.fillRect(0, 0, W, 10); if (o.rune) for (let x = 12; x < W; x += 28) { g.fillRect(x, 16, 3, 10); g.fillRect(x - 4, 20, 11, 2); } }
  // 아래 가장자리 찢김 (지그재그) + 구멍
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, H); let x = 0; const y0 = H * (o.cut ?? 0.82);
  while (x < W) { const w = 6 + r() * 18; g.lineTo(x + w * 0.5, y0 + r() * (H - y0) * 0.95); x += w; g.lineTo(x, y0 + r() * (H - y0) * 0.25); }
  g.lineTo(W, H); g.closePath(); g.fill();
  for (let i = 0; i < (o.holes ?? 7); i++) { const hx = r() * W, hy = H * (0.45 + r() * 0.4); g.beginPath(); g.ellipse(hx, hy, 3 + r() * 9, 5 + r() * 16, r(), 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  return c;
}
// 판금 문양 (높이 맵 → 노멀맵): 가장자리 띠 + 덩굴 소용돌이 + 별 문양
function engraveCanvas(seed, W = 512, H = 512) {
  const [c, g] = cv(W, H), r = rng(seed); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.lineWidth = 5; for (const y of [18, H - 18]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.lineWidth = 3;
  for (let k = 0; k < 10; k++) { const cx = r() * W, cy = 60 + r() * (H - 120), s = 20 + r() * 34; g.beginPath(); for (let i = 0; i < 70; i++) { const a = i * 0.16, rr = s * (1 - i / 80); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); g.beginPath(); g.moveTo(cx + s, cy); g.quadraticCurveTo(cx + s * 2, cy - s, cx + s * 3, cy + s * 0.3); g.stroke(); }
  for (let k = 0; k < 5; k++) { const cx = r() * W, cy = r() * H, s = 10 + r() * 12; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? s * 0.4 : s; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.stroke(); }
  return c;
}
// 쇠사슬 갑옷 (작은 고리 반복)
function mailCanvas() {
  const [c, g] = cv(128, 128); g.fillStyle = '#0c0a12'; g.fillRect(0, 0, 128, 128); g.lineWidth = 2.2;
  for (let y = 0; y < 136; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 136; x += 8) { g.strokeStyle = 'rgba(150,140,175,0.55)'; g.beginPath(); g.arc(x, y, 4.2, 0.2, Math.PI * 1.2); g.stroke(); g.strokeStyle = 'rgba(20,16,26,0.9)'; g.beginPath(); g.arc(x, y, 4.2, Math.PI * 1.2, Math.PI * 2.2); g.stroke(); }
  return c;
}
// 자루 감개 (비스듬한 가죽 띠)
function wrapCanvas(a, b) { const [c, g] = cv(64, 256); g.fillStyle = a; g.fillRect(0, 0, 64, 256); for (let y = -64; y < 320; y += 22) { g.fillStyle = b; g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 24); g.lineTo(64, y + 32); g.lineTo(0, y + 8); g.closePath(); g.fill(); } return c; }
// 일식 코로나: 가운데 검은 원 · 바깥으로 흩어지는 빛 줄기
function coronaCanvas() {
  const S = 512, [c, g] = cv(S, S), r = rng(77), m = S / 2;
  const gr = g.createRadialGradient(m, m, S * 0.17, m, m, S * 0.5); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,230,255,0.85)'); gr.addColorStop(0.3, 'rgba(255,160,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) { const a = r() * TAU, l = S * (0.22 + r() * 0.26); g.strokeStyle = `rgba(255,200,255,${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(m + Math.cos(a) * S * 0.17, m + Math.sin(a) * S * 0.17); g.quadraticCurveTo(m + Math.cos(a + 0.1) * l * 0.7, m + Math.sin(a + 0.1) * l * 0.7, m + Math.cos(a + 0.05) * l, m + Math.sin(a + 0.05) * l); g.stroke(); }
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath(); g.arc(m, m, S * 0.165, 0, TAU); g.fill();
  return c;
}
// 대검 날: 가운데 홈을 따라 흐르는 공허 균열 (발광)
function bladeGlowCanvas() {
  const W = 128, H = 1024, [c, g] = cv(W, H), r = rng(31); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.shadowColor = '#fff'; g.shadowBlur = 8; g.strokeStyle = '#fff'; g.lineWidth = 3;
  let x = W / 2; g.beginPath(); g.moveTo(x, H); for (let y = H; y > 20; y -= 14) { x = W / 2 + (r() - 0.5) * 18; g.lineTo(x, y); if (r() < 0.12) { g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 50, y - 30 - r() * 30); g.moveTo(x, y); } } g.stroke();
  g.lineWidth = 7; g.globalAlpha = 0.35; g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 30); g.stroke();
  return c;
}

/* =====================================================================
   재질 · 조형 도우미
   ===================================================================== */
const env = () => envCube();
function P(o) { const { envI, ...rest } = o; const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...rest }); if ((rest.metalness || 0) > 0.2 || rest.clearcoat) { m.envMap = env(); m.envMapIntensity = envI ?? 1; } return m; }
function addFn(M) {
  return (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); const add = mat.blending === THREE.AdditiveBlending || mat.transparent; me.castShadow = !add; me.receiveShadow = !add; parent.add(me); return me; };
}
// 결정 조각: 오각 기둥 + 뾰족한 끝 (+Y 방향)
const shardG = (w, L, sides = 5) => C(`shard${w}_${L}_${sides}`, () => lathe([[0, -L * 0.14], [w, 0], [w * 0.82, L * 0.6], [0, L]], sides));
// 방향 dir 을 향하는 결정 하나
function shardAt(add, parent, mat, w, L, pos, dir, spin = 0) { const m = add(parent, shardG(w, L), mat, pos); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(...dir).normalize()); m.rotateY(spin); return m; }
// 결정 무리: 중심 pos 에서 dir 주변으로 퍼진 n 개
function cluster(add, parent, mat, pos, dir, n, L, w, seed, spread = 0.5) {
  const r = rng(seed), d0 = new V3(...dir).normalize(), t1 = new V3(0, 1, 0).cross(d0); if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0); t1.normalize(); const t2 = d0.clone().cross(t1);
  for (let i = 0; i < n; i++) { const a = r() * TAU, k = i ? spread * (0.4 + r() * 0.6) : 0, d = d0.clone().addScaledVector(t1, Math.cos(a) * k).addScaledVector(t2, Math.sin(a) * k), l = L * (i ? 0.45 + r() * 0.45 : 1); shardAt(add, parent, mat, w * (i ? 0.6 + r() * 0.3 : 1), l, [pos[0] + Math.cos(a) * w * 0.8 * (i ? 1 : 0), pos[1] + Math.sin(a) * w * 0.5 * (i ? 1 : 0), pos[2]], d.toArray(), r() * 3); }
}
// 근육 팔다리 로프트 (위 → 아래로 뻗음)
const limbLoft = (key, L, top, X, F, B, nu = 24, nv = 12) => C(key, () => loft((v) => ({ y: top - (L + top) * v, rx: X(v), rzF: F(v), rzB: B(v) }), nu, nv));
// 로프 · 천 공통: 장면 등록 · 매 프레임 갱신
function physKit(m) {
  m.ropes = []; m.cloths = []; m.chains = []; const extras = [];
  m.attachScene = (scene) => { if (m._att) return; m._att = true; for (const c of m.cloths) { c.cl = new Cloth(scene, c.W, c.H, c.len, c.mat); extras.push(c.cl.mesh); } for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } for (const ch of m.chains) { scene.add(ch.view.im); extras.push(ch.view.im); if (ch.view.end) { scene.add(ch.view.end); extras.push(ch.view.end); } } };
  m.dispose = (scene) => { for (const o of extras) { scene.remove(o); } for (const c of m.cloths) if (c.cl) { c.cl.mesh.geometry.dispose(); c.cl = null; } extras.length = 0; m._att = false; };
  m.resetCloth = () => { for (const c of m.cloths) if (c.cl) c.cl.ok = false; for (const r of [...m.ropes, ...m.chains]) r.rope.ok = false; };
  const tmp = new V3(), rq = new THREE.Quaternion();
  m.stepPhys = (dt, f) => {
    const vis = f.root.visible, h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.2), r: h0.r * 0.75 + 0.04 * f.scale }, legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * f.scale })), caps = [torso, ...legs];
    m.root.getWorldQuaternion(rq); const wind = new V3(-f.vel.x * 0.7 + Math.sin(f.G.time * 1.3) * 0.6, 0, -f.vel.z * 0.7 + Math.cos(f.G.time * 1.1) * 0.6);
    for (const r of [...m.ropes, ...m.chains]) { r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); r.rope.step(dt, tmp, r.caps === false ? [] : caps, f.pos.y + 0.02, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); (r.view.mesh || r.view.im).visible = vis; if (r.view.end) r.view.end.visible = vis; }
    for (const c of m.cloths) if (c.cl) { c.anchor(c.cl.anchors); c.cl.len = c.len * f.scale; c.cl.mesh.visible = vis; c.cl.step(dt, [...caps, ...(c.extraCaps ? c.extraCaps(f) : [])], f.pos.y + 0.02, [wind.x * 1.4, 0, wind.z * 1.4]); }
  };
}

/* =====================================================================
   공통 재질 묶음
   ===================================================================== */
function voidMats(pal, o = {}) {
  const acc = pal.accent;
  const M = {
    obs: P({ map: T('obs' + (o.obsSeed || 1), () => tex(obsidianCanvas(o.obsSeed || 1, o.obsBase), [2, 2])), emissiveMap: T('crack' + (o.crackSeed || 3), () => tex(crackCanvas(o.crackSeed || 3), [o.crackRep || 1.5, o.crackRep || 1.5], false)), emissive: acc, emissiveIntensity: o.crackI ?? 1.6, roughness: 0.22, metalness: 0.1, clearcoat: 0.9, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: new THREE.Color(0x8a6aa8) }),
    crystal: P({ color: o.crystal ?? 0x1a1222, emissive: acc, emissiveIntensity: 0.16, roughness: 0.06, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, flatShading: true, envI: 1.6 }),
    crystalB: P({ color: 0xffffff, emissive: acc, emissiveIntensity: 1.25, roughness: 0.05, metalness: 0.1, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.88 }),
    glow: new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    hot: new THREE.MeshBasicMaterial({ color: new THREE.Color(acc).lerp(new THREE.Color(0xffffff), 0.55), side: THREE.DoubleSide }),
    dark: P({ color: 0x0a080e, roughness: 0.5, metalness: 0.3 }),
    iron: P({ color: 0x3a3442, roughness: 0.38, metalness: 0.9 }),
  };
  return M;
}

/* =====================================================================
   공허 파편병 (잡병) — 흑요석 유리 몸 · 결정 칼날
   ===================================================================== */
export const DIMS_G = { hipH: 0.96, spineL: 0.2, chestL: 0.3, neckL: 0.085, shW: 0.2, uArm: 0.29, lArm: 0.27, hipW: 0.095, thigh: 0.44, shin: 0.43, headTop: 0.27 };
// 흑요석 인간형 몸통 (파편병 · 니힐 속 몸)
function obsBody(m, add, M, D, key, o = {}) {
  const J = m.J, K = o.k || 1;
  add(J.hips, C(key + 'pelvis', () => loft((v) => ({ y: -0.13 + 0.23 * v, rx: (0.13 + 0.012 * Math.sin(v * Math.PI)) * K, rzF: 0.092 * K, rzB: 0.108 * K, n: 2.2 }), 32, 8)), o.lowMat || M.obs);
  const wX = spl([[0, 0.128], [0.4, 0.112], [1, 0.14]]), wF = spl([[0, 0.088], [0.5, 0.082], [1, 0.098]]);
  add(J.spine, C(key + 'waist', () => loft((v) => ({ y: -0.05 + 0.27 * v, rx: wX(v) * K, rzF: wF(v) * K, rzB: 0.094 * K, n: 2.15 }), 32, 10, { mod: (p, u, v, c, s) => { if (s > 0.3) p.z += 0.008 * Math.abs(Math.sin(v * 9)) * s * (Math.abs(p.x) < 0.06 ? 1 : 0.3); } })), M.obs);
  const cX = spl([[0, 0.138], [0.35, 0.162], [0.72, 0.176], [1, 0.12]]), cF = spl([[0, 0.096], [0.55, 0.118], [1, 0.078]]), cB = spl([[0, 0.096], [0.6, 0.11], [1, 0.08]]);
  const chP = (v) => ({ y: -0.02 + 0.34 * v, rx: cX(v) * K, rzF: cF(v) * K, rzB: cB(v) * K, n: 2.2 });
  const chMod = (p, u, v, c, s) => { if (s > 0) p.z += 0.022 * gauss(Math.abs(p.x) - 0.065, 0.05) * gauss(p.y - 0.2, 0.07) * s; if (s < 0) p.z -= 0.012 * gauss(Math.abs(p.x) - 0.07, 0.04) * gauss(p.y - 0.22, 0.08) * -s; };
  add(J.chest, C(key + 'chest', () => loft(chP, 40, 16, { mod: chMod })), M.obs);
  add(J.chest, C(key + 'chTop', () => loft((v) => ({ y: 0.31 + 0.07 * v, rx: (0.12 - 0.066 * v ** 0.8) * K, rzF: (0.078 - 0.03 * v) * K, rzB: (0.08 - 0.03 * v) * K }), 32, 6)), M.obs);
  add(J.neck, C(key + 'neck', () => loft((v) => ({ y: -0.05 + 0.15 * v, rx: 0.052 - 0.01 * smooth(0.2, 0.8, v), rzF: 0.05, rzB: 0.052 }), 18, 5)), M.obs);
  return { chP, chMod };
}
function obsLimbs(m, add, M, D, key, o = {}) {
  const J = m.J, K = o.k || 1;
  for (const [sh, el, s] of [[J.shoulderL, J.elbowL, 1], [J.shoulderR, J.elbowR, -1]]) {
    add(sh, limbLoft(key + 'uarm', D.uArm, 0.035, (v) => (0.062 - 0.016 * v + 0.006 * Math.sin(v * Math.PI)) * K, (v) => (0.06 - 0.014 * v) * K, (v) => (0.06 - 0.018 * v + 0.008 * gauss(v - 0.4, 0.25)) * K), M.obs);
    add(el, limbLoft(key + 'farm', D.lArm, 0.02, (v) => (0.052 - 0.018 * v + 0.006 * gauss(v - 0.25, 0.2)) * K, (v) => (0.048 - 0.014 * v) * K, (v) => (0.05 - 0.016 * v) * K), M.obs);
  }
  for (const [hp, kn, s] of [[J.hipL, J.kneeL, 1], [J.hipR, J.kneeR, -1]]) {
    const X = spl([[0, 0.092], [0.4, 0.084], [0.85, 0.06], [1, 0.056]]), F = spl([[0, 0.088], [0.5, 0.076], [1, 0.055]]), B = spl([[0, 0.096], [0.35, 0.084], [1, 0.05]]);
    add(hp, limbLoft(key + 'thigh', D.thigh, 0.04, (v) => X(v) * K, (v) => F(v) * K, (v) => B(v) * K, 28, 12), M.obs);
    const sX = spl([[0, 0.058], [0.3, 0.062], [0.75, 0.04], [1, 0.035]]), sB = spl([[0, 0.06], [0.28, 0.078], [0.7, 0.045], [1, 0.037]]);
    add(kn, limbLoft(key + 'shin', D.shin, 0.02, (v) => sX(v) * K, (v) => (0.052 - 0.016 * v) * K, (v) => sB(v) * K, 24, 12), M.obs);
  }
}
// 발: 발목 아래로 바닥(-sole)까지, 앞으로 뻗은 발등 + 발톱
const footGeo = (key, len = 0.24, w = 0.046, sole = 0.07) => C(key, () => {
  const fw = spl([[0, 0.0], [0.08, w * 0.7], [0.3, w * 0.85], [0.7, w], [0.92, w * 0.8], [1, 0.006]]), fh = spl([[0, 0.03], [0.1, 0.07], [0.35, 0.068], [0.7, 0.036], [1, 0.012]]);
  return surf((u, v, p) => { const [c, sn] = ang(u), e = 0.7; p.set(Math.sign(c) * Math.abs(c) ** e * fw(v), -sole + fh(v) / 2 + Math.sign(sn) * Math.abs(sn) ** e * fh(v) / 2, -0.06 + len * v); }, 24, 18, { closedU: true });
});

export function buildVoidGrunt(pal, scale = 1) {
  const D = DIMS_G, m = buildHumanoid(D), J = m.J, M = voidMats(pal, { crackSeed: 3 }), add = addFn(M);
  physKit(m);
  M.cloth = P({ map: T('gTorn', () => tex(tornCanvas(5, '#2a0a14', '#14060c', 256, 512, { trim: '#5a1a2a' }))), alphaTest: 0.5, roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color(0x8a2a3a) });
  obsBody(m, add, M, D, 'g:'); obsLimbs(m, add, M, D, 'g:');
  // 결정 흉갑 (가슴 앞 · 깎인 면) + 가운데 빛나는 핵
  const chX = spl([[0, 0.138], [0.35, 0.162], [0.72, 0.176], [1, 0.12]]), chF = spl([[0, 0.096], [0.55, 0.118], [1, 0.078]]);
  const chP = (v) => ({ y: -0.02 + 0.34 * v, rx: chX(v) + 0.016, rzF: chF(v) + 0.02, rzB: 0.1, n: 2.2 });
  add(J.chest, C('g:plate', () => loft((v) => chP(0.3 + 0.62 * v), 8, 4, { a0: 0.3, a1: 0.7 })), M.crystal);
  add(J.chest, C('g:core', () => new THREE.IcosahedronGeometry(0.034, 0)), M.crystalB, [0, 0.2, 0.142]);
  // 어깨 · 등의 결정 무리
  for (const s of [-1, 1]) { const sh = s > 0 ? J.shoulderL : J.shoulderR; add(sh, C('g:delt', () => new THREE.SphereGeometry(0.07, 14, 10)), M.obs, [s * 0.012, 0.0, 0], [0, 0, 0], [1.05, 0.95, 1]); cluster(add, sh, M.crystal, [s * 0.03, 0.05, -0.01], [s * 0.7, 1, -0.15], 4, 0.22, 0.034, 11 + s); }
  for (let i = 0; i < 4; i++) shardAt(add, J.chest, M.crystal, 0.03 - i * 0.004, 0.2 - i * 0.03, [0, 0.3 - i * 0.075, -0.1 + i * 0.006], [0, 0.55, -1], i);
  shardAt(add, J.spine, M.crystal, 0.022, 0.12, [0, 0.12, -0.09], [0, 0.4, -1]);
  // 허리띠 (쇠 고리 · 결정 버클) · 찢어진 앞뒤 천
  add(J.hips, C('g:belt', () => { const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; pts.push(new V3(Math.sin(a) * 0.152, 0.065 + 0.012 * Math.cos(a), Math.cos(a) * 0.118)); } return strand(pts, 0.016, 0.016, { closed: true, seg: 80, rad: 8, flat: 0.45, ref: [0, 1, 0] }); }), M.iron);
  add(J.hips, C('g:buckle', () => new THREE.OctahedronGeometry(0.03, 0)), M.crystalB, [0, 0.065, 0.13], [0, 0, 0], [1, 1.2, 0.5]);
  const flap = (key, w, L, z, sgn) => { const g = new THREE.Group(); g.position.set(0, 0.05, z); J.hips.add(g); add(g, C(key, () => surf((u, v, p) => { const x = (u - 0.5) * 2 * w * (1 - 0.15 * v); p.set(x, -L * v, sgn * (0.004 + 0.05 * (x / w) ** 2 * -0.4 + 0.02 * v)); }, 6, 10)), M.cloth); return g; };
  m.flapF = flap('g:flapF', 0.09, 0.4, 0.122, 1); m.flapB = flap('g:flapB', 0.11, 0.46, -0.13, -1);
  // 등 뒤 찢어진 천 두 가닥 (로프 물리)
  for (const s of [-1, 1]) { const rope = new Rope(6, 0.075 * scale, { damp: 0.975, stiff: 0.12 }), view = new RopeTube(rope, M.cloth, { sub: 2, rad: 6, flat: 0.15, side: new V3(1, 0, 0), prof: (v) => 0.03 * (1 - 0.5 * v) * scale });
    m.ropes.push({ rope, view, joint: J.hips, local: new V3(s * 0.08, 0.06, -0.13), rest: new V3(s * 0.2, -1, -0.4).normalize() }); }
  // 머리: 깎인 결정 두개골 투구 · V자 눈빛 · 뒤로 뻗은 결정 볏
  const H = J.head, hX = spl([[0, 0.036], [0.16, 0.07], [0.45, 0.094], [0.75, 0.088], [1, 0.018]]), hF = spl([[0, 0.07], [0.3, 0.104], [0.62, 0.1], [1, 0.02]]), hB = spl([[0, 0.05], [0.5, 0.102], [1, 0.03]]);
  const hP = (v) => ({ y: 0.0 + 0.28 * v, rx: hX(v), rzF: hF(v), rzB: hB(v), cz: 0.018 - 0.05 * v * v });
  add(H, C('g:helm', () => loft(hP, 10, 9)), M.crystal);
  add(H, C('g:face', () => loft((v) => { const q = hP(0.12 + 0.55 * v); return { ...q, rx: q.rx * 0.9, rzF: q.rzF * 0.9, rzB: q.rzB * 0.9 }; }, 20, 6)), M.dark);
  add(H, C('g:visor', () => { const pts = []; for (let i = 0; i <= 12; i++) { const u = 0.36 + 0.28 * (i / 12), vv = 0.42 + 0.09 * Math.abs(i / 12 - 0.5) * 2; pts.push(loftAt(hP, u, vv, new V3()).multiplyScalar(1.03)); } return strand(pts, 0.007, 0.007, { seg: 30, rad: 6 }); }), M.glow);
  for (let i = 0; i < 3; i++) shardAt(add, H, M.crystal, 0.024 - i * 0.004, 0.2 - i * 0.04, [0, 0.24 - i * 0.05, -0.05 - i * 0.02], [0, 0.6 - i * 0.2, -1], i);
  for (const s of [-1, 1]) shardAt(add, H, M.crystal, 0.016, 0.14, [s * 0.08, 0.18, -0.02], [s * 0.6, 0.8, -0.6]);
  // 손: 왼손 발톱 · 오른손 주먹 + 세 갈래 결정 칼날
  for (const [ha, s] of [[J.handL, 1], [J.handR, -1]]) {
    add(ha, C('g:palm' + s, () => loft((v) => ({ y: 0.0 - 0.075 * v, rx: 0.024, rz: 0.04 + 0.004 * v, n: 3, cx: s * 0.012 }), 16, 5)), M.obs);
    for (let k = 0; k < 4; k++) { const z = 0.03 - k * 0.019, pts = [], curl = s > 0 ? 1.0 : 2.3; for (let i = 0; i <= 6; i++) { const th = -0.6 - (i / 6) * curl; pts.push(new V3(s * (Math.cos(th) * 0.036 + 0.004), -0.07 + Math.sin(th) * 0.036 + 0.02, z)); }
      add(ha, C(`g:fing${s}${k}`, () => strand(pts, 0.0095, 0.006, { seg: 10, rad: 6 })), M.obs); if (s > 0) shardAt(add, ha, M.crystal, 0.007, 0.045, pts[6].toArray(), [s * 0.2, -1, 0.1]); }
  }
  const W = J.weapon;
  cluster(add, J.handR, M.crystal, [0, -0.04, 0.02], [0, 0.2, 1], 4, 0.1, 0.03, 21, 0.9);
  for (const [x, l, a] of [[0, 0.74, 0], [0.04, 0.5, 0.16], [-0.04, 0.54, -0.14]]) { const b = add(W, C('g:blade' + l, () => { const g = lathe([[0, -0.04], [0.022, 0], [0.018, l * 0.75], [0, l]], 4); g.scale(1, 1, 0.35); return g; }), M.crystalB, [x, 0, 0.05]); b.rotation.set(Math.PI / 2, 0, 0); b.rotateZ(a); }
  // 정강이 결정 경갑 · 무릎 가시 · 발 + 발톱
  for (const [kn, ft, s] of [[J.kneeL, J.footL, 1], [J.kneeR, J.footR, -1]]) {
    const sp = (v) => ({ y: 0.0 - (D.shin - 0.05) * v, rx: 0.066 - 0.02 * v, rzF: 0.066 - 0.022 * v, rzB: 0.06 });
    add(kn, C('g:greave', () => loft(sp, 6, 4, { a0: 0.32, a1: 0.68 })), M.crystal);
    shardAt(add, kn, M.crystal, 0.022, 0.1, [0, 0.03, 0.05], [0, 0.7, 1]);
    add(ft, footGeo('g:foot'), M.obs);
    for (const x of [-0.025, 0, 0.025]) shardAt(add, ft, M.crystal, 0.009, 0.06, [x, -0.055, 0.17], [x * 4, -0.2, 1]);
  }
  // 매 프레임: 앞뒤 천 흔들림 · 균열 맥동 · 로프
  const lag = { L: 0, R: 0, vL: 0, vR: 0 }; let t = Math.random() * 10;
  m.update = (dt, f) => {
    t += dt; lag.vL += ((J.hipL.rotation.x - lag.L) * 120 - lag.vL * 12) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 120 - lag.vR * 12) * dt; lag.R += lag.vR * dt;
    const sp = Math.hypot(f.vel.x, f.vel.z); m.flapF.rotation.x = Math.min(0, Math.min(lag.L, lag.R)) * 0.8 - sp * 0.02; m.flapB.rotation.x = Math.max(0, Math.max(-lag.L, -lag.R)) * 0.5 + sp * 0.035;
    M.obs.emissiveIntensity = 1.3 + 0.5 * Math.sin(t * 3.1) + (f.state === 'act' ? 0.8 : 0); M.glow.opacity = 0.75 + 0.25 * Math.sin(t * 7);
    m.stepPhys(dt, f);
  };
  m.sole = 0.07;
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.1)); W.localToWorld(tt.set(0, 0, 0.8)); };
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0, 0.8));
  return m;
}

/* =====================================================================
   떠도는 공허 정령 사수 — 영체 꼬리 · 두건 망토 · 일식 후광 · 공허 구슬
   ===================================================================== */
export const DIMS_W = { hipH: 0.98, spineL: 0.2, chestL: 0.27, neckL: 0.085, shW: 0.17, uArm: 0.27, lArm: 0.26, hipW: 0.09, thigh: 0.44, shin: 0.44, headTop: 0.26 };
export function buildVoidWisp(pal, scale = 1) {
  const D = DIMS_W, m = buildHumanoid(D), J = m.J, M = voidMats(pal, { crackSeed: 9, crackI: 1.2 }), add = addFn(M);
  physKit(m);
  M.robe = P({ map: T('wRobe', () => tex(tornCanvas(8, '#2a1a44', '#0c0814', 256, 512, { trim: '#7a5ab0', rune: true, cut: 0.7, holes: 5 }))), alphaTest: 0.5, roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color(0xb08aff), emissive: 0x1a0a30, emissiveIntensity: 0.6 });
  M.ghost = new THREE.MeshPhysicalMaterial({ color: 0x1a0a30, emissive: pal.accent, emissiveIntensity: 0.9, transparent: true, opacity: 0.5, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false });
  M.mask = P({ color: 0xe8e2f0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.5, sheenColor: new THREE.Color(0xd8c8ff) });
  M.corona = new THREE.MeshBasicMaterial({ map: T('corona', () => tex(coronaCanvas(), [1, 1])), color: pal.accent, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  M.black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  // 상체: 가는 흑요석 몸 (갈비 결정)
  add(J.spine, C('w:waist', () => loft((v) => ({ y: -0.06 + 0.27 * v, rx: 0.088 + 0.02 * v, rzF: 0.068, rzB: 0.07, n: 2.1 }), 28, 8)), M.obs);
  const cX = spl([[0, 0.11], [0.5, 0.128], [1, 0.09]]), chP = (v) => ({ y: -0.02 + 0.3 * v, rx: cX(v), rzF: 0.082 + 0.01 * Math.sin(v * Math.PI), rzB: 0.08, n: 2.2 });
  add(J.chest, C('w:chest', () => loft(chP, 32, 12)), M.obs);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) add(J.chest, C('w:rib' + i + s, () => { const pts = []; for (let k = 0; k <= 8; k++) { const u = 0.5 + s * (0.06 + 0.26 * k / 8); pts.push(loftAt(chP, u, 0.2 + i * 0.16 - 0.06 * k / 8, new V3()).multiplyScalar(1.04)); } return strand(pts, 0.008, 0.004, { seg: 16, rad: 5 }); }), M.crystalB);
  add(J.chest, C('w:core', () => new THREE.OctahedronGeometry(0.04, 0)), M.crystalB, [0, 0.16, 0.1], [0, 0, 0], [1, 1.4, 0.6]);
  add(J.neck, C('w:neck', () => loft((v) => ({ y: -0.04 + 0.13 * v, rx: 0.04, rz: 0.042 }), 14, 4)), M.obs);
  // 망토 (어깨 → 허리, 앞이 트임) · 두건
  add(J.chest, C('w:mantle', () => loft((v) => ({ y: 0.3 - 0.5 * v, rx: 0.13 + 0.12 * v, rzF: 0.1 + 0.06 * v, rzB: 0.1 + 0.1 * v }), 30, 12, { a0: 0.62, a1: 1.38, mod: (p, u, v) => { p.y += 0.03 * Math.sin(u * 40) * v; } })), M.robe);
  const hood = (v) => ({ y: 0.02 + 0.3 * v, rx: 0.115 - 0.06 * v * v, rzF: 0.12 - 0.07 * v, rzB: 0.13 - 0.05 * v, cz: -0.02 - 0.06 * v * v });
  add(J.head, C('w:hood', () => loft(hood, 30, 10, { a0: 0.66, a1: 1.34 })), M.robe);
  add(J.head, C('w:hoodIn', () => new THREE.SphereGeometry(0.1, 16, 12)), M.black, [0, 0.13, -0.015], [0, 0, 0], [1, 1.15, 1.05]);
  // 가면: 매끈한 타원 판 · 초승달 문양 · 가는 눈
  const mask = new THREE.Group(); mask.position.set(0, 0.13, 0.062); J.head.add(mask);
  add(mask, C('w:mask', () => surf((u, v, p) => { const a = (u - 0.5) * 2.2, b = (v - 0.5) * 2.6; p.set(Math.sin(a) * 0.075, b * 0.06 - 0.01 * b * b, Math.cos(a) * 0.035 - 0.02 * b * b); }, 16, 16)), M.mask);
  add(mask, C('w:crescent', () => { const pts = []; for (let i = 0; i <= 16; i++) { const a = -2.2 + 4.4 * i / 16; pts.push(new V3(Math.sin(a) * 0.026, 0.07 + Math.cos(a) * 0.026 - 0.026, 0.035)); } return strand(pts, 0.005, 0.003, { seg: 24, rad: 5 }); }), M.glow, [0, -0.02, 0]);
  for (const s of [-1, 1]) add(mask, C('w:eye' + s, () => strand([[s * 0.012, 0.0, 0.04], [s * 0.03, 0.006, 0.037], [s * 0.048, 0.0, 0.032]], 0.004, 0.002, { seg: 8, rad: 5 })), M.glow);
  // 등 뒤 일식 후광 (검은 원 · 코로나)
  const halo = new THREE.Group(); halo.position.set(0, 0.24, -0.16); J.head.add(halo); m.halo = halo;
  add(halo, C('w:disc', () => new THREE.CircleGeometry(0.15, 40)), M.black);
  add(halo, C('w:corona', () => new THREE.PlaneGeometry(0.9, 0.9)), M.corona, [0, 0, -0.005]);
  // 팔: 가는 팔 + 넓은 소매 · 긴 손가락
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, limbLoft('w:uarm', D.uArm, 0.03, (v) => 0.042 - 0.01 * v, (v) => 0.04 - 0.01 * v, (v) => 0.04 - 0.01 * v), M.obs);
    add(el, limbLoft('w:farm', D.lArm, 0.02, (v) => 0.034 - 0.012 * v, (v) => 0.032 - 0.01 * v, (v) => 0.033 - 0.011 * v), M.obs);
    add(sh, C('w:sleeve', () => loft((v) => ({ y: 0.04 - 0.34 * v, rx: 0.06 + 0.06 * v * v, rz: 0.06 + 0.06 * v * v }), 20, 6, { mod: (p, u, v) => { if (v > 0.8) p.y -= 0.06 * Math.max(0, Math.sin(u * TAU * 3)) * (v - 0.8) * 5; } })), M.robe);
    add(el, C('w:cuff', () => loft((v) => ({ y: -0.08 - 0.12 * v, rx: 0.04 + 0.05 * v, rz: 0.04 + 0.05 * v }), 18, 4)), M.ghost);
    add(ha, C('w:palm', () => loft((v) => ({ y: 0.0 - 0.06 * v, rx: 0.018, rz: 0.03, n: 3 }), 12, 4)), M.obs);
    for (let k = 0; k < 4; k++) { const z = 0.022 - k * 0.015, pts = []; for (let i = 0; i <= 6; i++) { const th = -0.5 - (i / 6) * 1.1; pts.push(new V3(s * Math.cos(th) * 0.05, -0.05 + Math.sin(th) * 0.05 + 0.02, z)); } add(ha, C(`w:f${s}${k}`, () => strand(pts, 0.006, 0.0025, { seg: 10, rad: 5 })), M.obs); }
  }
  // 왼손의 공허 구슬 (돌아가는 고리 두 개)
  const orb = new THREE.Group(); orb.position.set(0.0, -0.12, 0.06); J.handL.add(orb); m.orb = orb;
  add(orb, C('w:orb', () => new THREE.IcosahedronGeometry(0.05, 2)), M.black);
  add(orb, C('w:orbG', () => new THREE.IcosahedronGeometry(0.07, 2)), M.glow, [0, 0, 0], [0, 0, 0], [1, 1, 1]).material = new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = [0, 1].map((i) => add(orb, C('w:ring', () => new THREE.TorusGeometry(0.085, 0.004, 6, 40)), M.glow, [0, 0, 0], [i * 1.2, 0.4, 0]));
  // 아래: 찢긴 영체 치맛자락 + 휘어지는 영체 꼬리 (절차적 곡선)
  add(J.hips, C('w:skirt', () => loft((v) => ({ y: 0.04 - 0.3 * v, rx: 0.13 + 0.07 * v, rzF: 0.11 + 0.05 * v, rzB: 0.12 + 0.08 * v }), 30, 10, { mod: (p, u, v) => { p.y += 0.05 * Math.sin(u * TAU * 5) * v * v; } })), M.robe);
  add(J.hips, C('w:skirtG', () => loft((v) => ({ y: 0.0 - 0.42 * v, rx: 0.11 + 0.06 * v, rzF: 0.1 + 0.04 * v, rzB: 0.11 + 0.06 * v }), 24, 8, { mod: (p, u, v) => { p.y += 0.07 * Math.sin(u * TAU * 4 + 1) * v * v; } })), M.ghost);
  const tail = new Rope(9, 0.11 * scale), tailV = new RopeTube(tail, M.ghost, { sub: 3, rad: 10, prof: (v) => (0.12 * (1 - v) ** 0.9 + 0.006) * (0.75 + 0.5 * Math.sin(Math.min(1, v * 3) * Math.PI / 2) * (1 - v)) * scale });
  m.attachScene0 = m.attachScene; m.attachScene = (scene) => { m.attachScene0(scene); scene.add(tailV.mesh); m._tail = scene; };
  m.dispose0 = m.dispose; m.dispose = (scene) => { m.dispose0(scene); scene.remove(tailV.mesh); };
  // 어깨에서 흩날리는 영체 띠 (로프 물리)
  for (const s of [-1, 1]) { const rope = new Rope(7, 0.08 * scale, { damp: 0.97, stiff: 0.2 }), view = new RopeTube(rope, M.robe, { sub: 2, rad: 6, flat: 0.12, side: new V3(1, 0, 0), prof: (v) => 0.028 * (1 - 0.6 * v) * scale });
    m.ropes.push({ rope, view, joint: J.chest, local: new V3(s * 0.1, 0.28, -0.08), rest: new V3(s * 0.3, -0.6, -1).normalize(), caps: false }); }
  // 주위를 도는 결정 파편
  const ring = new THREE.Group(); ring.position.y = 1.15; m.body.add(ring);
  const orbitS = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, g = new THREE.Group(); g.position.set(Math.cos(a) * 0.5, Math.sin(i * 2.1) * 0.12, Math.sin(a) * 0.5); ring.add(g); shardAt(add, g, M.crystal, 0.025, 0.13, [0, -0.06, 0], [0, 1, 0]); orbitS.push(g); }
  let t = Math.random() * 10; const tA = new V3(), tB = new V3(), base = new V3();
  m.update = (dt, f) => {
    t += dt; m.sole = -0.42 + Math.sin(t * 1.8) * 0.05;
    ring.rotation.y += dt * 1.0; orbitS.forEach((g, i) => { g.rotation.y += dt * (1.5 + i * 0.2); g.position.y = Math.sin(t * 1.6 + i * 2.1) * 0.12; });
    rings[0].rotation.y += dt * 3; rings[1].rotation.x += dt * 2.3; halo.rotation.z += dt * 0.2;
    M.obs.emissiveIntensity = 1 + 0.4 * Math.sin(t * 2.4); M.ghost.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 3.3);
    // 영체 꼬리: 골반 아래에서 뒤로 휘며 흔들림 (이동 반대쪽으로 끌림)
    J.hips.updateMatrixWorld(true); J.hips.localToWorld(base.set(0, -0.2, -0.02));
    const fw = f.fwd(tA), rt = f.right(tB), sp = Math.hypot(f.vel.x, f.vel.z), sc = f.scale;
    for (let i = 0; i < tail.n; i++) { const k = i / (tail.n - 1); tail.p[i].copy(base).addScaledVector(fw, (-0.1 * k - 0.5 * k * k - sp * 0.06 * k) * sc).addScaledVector(rt, Math.sin(t * 2.2 - k * 3) * 0.1 * k * sc); tail.p[i].y -= (0.55 * k - 0.05 * k * k) * sc; }
    tailV.update(); tailV.mesh.visible = f.root.visible;
    m.stepPhys(dt, f);
  };
  m.sole = -0.42;
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.1, 0)); J.handR.localToWorld(tt.set(0, -0.12, 0.02)); };
  m.tipPos = (out = new V3()) => orb.getWorldPosition(out);
  return m;
}

/* =====================================================================
   흑요석 공허 파쇄자 (정예) — 깎인 흑요석 거구 · 대망치 · 사슬
   ===================================================================== */
export const GOLEM_DIMS = { hipH: 0.82, spineL: 0.2, chestL: 0.36, neckL: 0.02, shW: 0.36, uArm: 0.4, lArm: 0.42, hipW: 0.17, thigh: 0.36, shin: 0.38, headTop: 0.14 };
export function buildObsidianBrute(pal, scale = 1.4) {
  const D = GOLEM_DIMS, m = buildHumanoid(D), J = m.J, M = voidMats(pal, { crackSeed: 14, crackRep: 1, crackI: 2.0, obsSeed: 4, obsBase: '#1a1418' }), add = addFn(M);
  physKit(m);
  M.obsF = M.obs.clone(); M.obsF.flatShading = true; M.violet = P({ color: 0x2a1a3a, emissive: 0x9a4aff, emissiveIntensity: 0.5, roughness: 0.06, metalness: 0.2, clearcoat: 1, flatShading: true });
  const F = M.obsF;
  // 몸통: 넓게 굽은 가슴 · 깎인 면 (낮은 분할 + 평면 음영)
  add(J.hips, C('b:pelvis', () => loft((v) => ({ y: -0.16 + 0.3 * v, rx: 0.25, rzF: 0.19, rzB: 0.2 }), 12, 5)), F);
  add(J.spine, C('b:belly', () => loft((v) => ({ y: -0.06 + 0.32 * v, rx: 0.25 + 0.04 * v, rzF: 0.21 + 0.02 * Math.sin(v * Math.PI), rzB: 0.2 }), 12, 5)), F);
  const cX = spl([[0, 0.3], [0.4, 0.42], [0.75, 0.46], [1, 0.3]]), cF = spl([[0, 0.24], [0.5, 0.3], [1, 0.2]]), cB = spl([[0, 0.24], [0.6, 0.32], [1, 0.26]]);
  const chP = (v) => ({ y: -0.02 + 0.44 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), cz: -0.04 * v, n: 2.4 });
  add(J.chest, C('b:chest', () => loft(chP, 14, 7)), F);
  add(J.chest, C('b:top', () => loft((v) => ({ y: 0.41 + 0.07 * v, rx: 0.3 - 0.18 * v, rzF: 0.2 - 0.08 * v, rzB: 0.26 - 0.1 * v, cz: -0.05 }), 12, 3)), F);
  // 가슴판 (겹친 흑요석 판) · 등 결정 능선 (보라 결정)
  for (const s of [-1, 1]) add(J.chest, C('b:pec' + s, () => loft((v) => chP(0.35 + 0.5 * v), 4, 3, { a0: s > 0 ? 0.5 : 0.25, a1: s > 0 ? 0.75 : 0.5 })), F, [0, 0, 0.03], [0, 0, 0], [1.04, 1, 1.04]);
  for (let i = 0; i < 6; i++) { const y = 0.5 - i * 0.09; cluster(add, J.chest, M.violet, [0, y, -0.24 - 0.02 * Math.sin(i)], [0, 0.55, -1], 3, 0.3 - i * 0.03, 0.05, 40 + i, 0.6); }
  add(J.chest, C('b:core', () => new THREE.IcosahedronGeometry(0.07, 0)), M.crystalB, [0, 0.28, 0.27]);
  // 머리: 가슴에 파묻힌 뿔 달린 작은 머리 · 빛나는 눈 · 입 틈
  const H = new THREE.Group(); H.position.set(0, 0.06, 0.1); J.head.add(H);
  add(H, C('b:head', () => loft((v) => ({ y: -0.06 + 0.24 * v, rx: 0.12 - 0.04 * v * v, rzF: 0.13 - 0.05 * v, rzB: 0.11, cz: 0.1 }), 10, 5)), F);
  add(H, C('b:brow', () => loft((v) => ({ y: 0.07 + 0.04 * v, rx: 0.13, rzF: 0.15, rzB: 0.05, cz: 0.1 }), 10, 2, { a0: 0.3, a1: 0.7 })), F);
  for (const s of [-1, 1]) { add(H, C('b:eye', () => new THREE.OctahedronGeometry(0.022, 0)), M.hot, [s * 0.045, 0.05, 0.235], [0, 0, s * 0.4], [1.5, 0.6, 0.5]); shardAt(add, H, M.violet, 0.03, 0.2, [s * 0.1, 0.12, 0.06], [s * 0.8, 1, -0.2]); }
  add(H, C('b:mouth', () => new THREE.BoxGeometry(0.1, 0.012, 0.02)), M.hot, [0, -0.02, 0.232]);
  // 팔: 굵은 어깨 바위 · 팔뚝 · 바위 주먹
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('b:shPad', () => new THREE.DodecahedronGeometry(0.2, 0)), F, [s * 0.04, 0.05, 0], [0.3, 0.2, 0.1], [1.2, 0.9, 1.1]);
    cluster(add, sh, M.violet, [s * 0.08, 0.15, -0.02], [s * 0.5, 1, -0.2], 3, 0.24, 0.045, 50 + s, 0.5);
    add(sh, limbLoft('b:uarm', D.uArm, 0.05, (v) => 0.13 - 0.03 * v, (v) => 0.12 - 0.02 * v, (v) => 0.13 - 0.03 * v, 10, 5), F);
    add(el, C('b:elb', () => new THREE.DodecahedronGeometry(0.1, 0)), F);
    add(el, limbLoft('b:farm', D.lArm, 0.03, (v) => 0.12 + 0.05 * v, (v) => 0.12 + 0.04 * v, (v) => 0.12 + 0.04 * v, 10, 5), F);
    add(ha, C('b:fist', () => new THREE.DodecahedronGeometry(0.15, 1)), F, [0, -0.09, 0.02], [0, 0, 0], [1, 1.05, 1.15]);
    for (let k = 0; k < 4; k++) add(ha, C('b:knk', () => new THREE.DodecahedronGeometry(0.04, 0)), M.obsF, [s * 0.02 + (k - 1.5) * 0.055 * 0.8, -0.15, 0.12]);
  }
  // 다리: 짧고 굵은 바위 다리 · 넓은 발
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    add(hp, limbLoft('b:thigh', D.thigh, 0.05, (v) => 0.16 - 0.03 * v, (v) => 0.15 - 0.03 * v, (v) => 0.16 - 0.03 * v, 10, 4), F);
    add(kn, C('b:knee', () => new THREE.DodecahedronGeometry(0.11, 0)), F, [0, 0, 0.04]);
    add(kn, limbLoft('b:shin', D.shin, 0.03, (v) => 0.13 - 0.01 * v, (v) => 0.13, (v) => 0.12, 10, 4), F);
    add(ft, C('b:foot', () => { const g = new THREE.DodecahedronGeometry(0.14, 0); g.scale(1, 0.5, 1.45); g.translate(0, -0.03, 0.07); return g; }), F);
  }
  // 허리: 쇠띠 + 늘어진 사슬 두 줄 (로프 물리) · 결정 장식
  add(J.hips, C('b:belt', () => loft((v) => ({ y: 0.08 + 0.06 * v, rx: 0.27, rzF: 0.21, rzB: 0.22 }), 24, 2)), M.iron);
  const link = C('b:link', () => new THREE.TorusGeometry(0.03, 0.009, 6, 12)), pend = new THREE.Group(); add(pend, shardG(0.03, 0.14), M.violet, [0, -0.12, 0], [Math.PI, 0, 0]);
  for (const s of [-1, 1]) { const rope = new Rope(8, 0.05 * scale, { damp: 0.97 }), view = new RopeChain(rope, link, M.iron, s > 0 ? pend : pend.clone()); view.end.scale.setScalar(scale); m.chains.push({ rope, view, joint: J.hips, local: new V3(s * 0.2, 0.08, 0.12), rest: new V3(s * 0.2, -1, 0.2).normalize() }); }
  // 대망치: 감긴 자루 · 깎인 흑요석 머리 · 빛나는 핵과 균열 · 뒤쪽 결정 가시
  const W = J.weapon;
  M.wrap = P({ map: T('bWrap', () => tex(wrapCanvas('#1a1216', '#3a2a24'), [1, 5])), roughness: 0.7 });
  add(W, C('b:haft', () => { const g = loft((v) => ({ y: -0.2 + 1.35 * v, rx: 0.034, rz: 0.034 }), 12, 4); g.rotateX(Math.PI / 2); return g; }), M.wrap);
  for (const z of [0.05, 0.9, 1.0]) add(W, C('b:band', () => new THREE.TorusGeometry(0.038, 0.01, 6, 16)), M.iron, [0, 0, z]);
  const hd = new THREE.Group(); hd.position.set(0, 0, 1.12); hd.scale.setScalar(0.72); W.add(hd);
  add(hd, C('b:hh', () => { const g = loft((v) => ({ y: -0.3 + 0.6 * v, rx: 0.2 + 0.03 * Math.sin(v * Math.PI), rz: 0.17 + 0.03 * Math.sin(v * Math.PI), n: 4 }), 8, 4); g.rotateZ(Math.PI / 2); return g; }), F);
  for (const s of [-1, 1]) { add(hd, C('b:face', () => { const g = new THREE.CylinderGeometry(0.17, 0.2, 0.08, 8); g.rotateZ(Math.PI / 2); return g; }), F, [s * 0.32, 0, 0]); add(hd, C('b:hband', () => { const g = loft((v) => ({ y: -0.03 + 0.06 * v, rx: 0.215, rz: 0.19, n: 4 }), 16, 2); g.rotateZ(Math.PI / 2); return g; }), M.iron, [s * 0.18, 0, 0]); }
  add(hd, C('b:hcore', () => new THREE.IcosahedronGeometry(0.07, 0)), M.crystalB, [0, 0.19, 0]);
  shardAt(add, hd, M.violet, 0.05, 0.3, [0, 0, 0.12], [0, 0.2, 1]); shardAt(add, hd, M.violet, 0.04, 0.22, [0, 0.12, -0.08], [0, 1, -0.3]);
  let t = Math.random() * 10;
  m.update = (dt, f) => { t += dt; M.obsF.emissiveIntensity = 1.8 + 0.6 * Math.sin(t * 2.2) + (f.state === 'act' ? 1 : 0); m.stepPhys(dt, f); };
  m.sole = 0.07;
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.3)); W.localToWorld(tt.set(0, 0, 1.3)); };
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0, 1.2));
  return m;
}

/* =====================================================================
   공허의 기사 니힐 (보스) — 판금 갑옷 · 뿔 투구 · 결정 왕관 · 일식 후광 · 별빛 망토 · 공허 대검
   o.ghost = 분신용 (반투명 · 천/로프 없음)
   ===================================================================== */
export const DIMS_N = { hipH: 0.96, spineL: 0.2, chestL: 0.3, neckL: 0.085, shW: 0.21, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44, headTop: 0.3 };
export const NB = { guard: 0.16, tip: 1.75 }; // 대검 치수 (오른손 기준 +Z)
export function buildNihil(pal, scale = 1.6, o = {}) {
  const D = DIMS_N, m = buildHumanoid(D), J = m.J, M = voidMats(pal, { crackSeed: 21, crackI: 1.4 }), add = addFn(M);
  physKit(m);
  const nS = new THREE.Vector2(0.55, 0.55);
  M.plate = P({ color: pal.armor ?? 0x241c30, normalMap: T('nEng', () => heightToNormal(engraveCanvas(12), 2.4, [2, 2])), normalScale: nS, metalness: 0.86, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, envI: 1.2 });
  M.plateD = P({ color: 0x15111c, metalness: 0.8, roughness: 0.35, clearcoat: 0.3, envI: 0.9 });
  M.trim = P({ color: pal.trim ?? 0xb8a8d8, metalness: 1, roughness: 0.22, clearcoat: 0.4, envI: 1.4 });
  M.mail = P({ map: T('nMail', () => tex(mailCanvas(), [6, 6])), metalness: 0.7, roughness: 0.45, envI: 0.6 });
  M.cape = P({ map: T('nCape', () => tex(tornCanvas(17, '#1a0a2a', '#05030a', 512, 1024, { stars: 260, trim: '#6a4a9a', rune: true, cut: 0.86, holes: 9 }))), alphaTest: 0.5, roughness: 0.75, sheen: 0.8, sheenColor: new THREE.Color(0x9a6aff), emissive: 0x200a3a, emissiveIntensity: 0.35 });
  M.tabard = P({ map: T('nTab', () => tex(tornCanvas(23, '#2a0e3a', '#0a0612', 256, 512, { trim: '#b8a8d8', rune: true, cut: 0.78, holes: 3 }))), alphaTest: 0.5, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color(0xb08aff) });
  M.corona = new THREE.MeshBasicMaterial({ map: T('corona', () => tex(coronaCanvas(), [1, 1])), color: pal.accent, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  M.black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  M.wrap = P({ map: T('nWrap', () => tex(wrapCanvas('#120c18', '#3a2a4a'), [1, 3])), roughness: 0.6 });
  M.blade = P({ color: 0x1a1426, emissiveMap: T('nBlade', () => tex(bladeGlowCanvas(), [1, 1], false)), emissive: pal.accent, emissiveIntensity: 2.2, metalness: 0.9, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envI: 1.5 });
  const rim = (parent, key, pts, r, closed, mat = M.trim) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat = M.trim, oo = {}) => rim(parent, key, loftRing(prof, v, { n: 48, ...oo }), r, !(oo.a1 - (oo.a0 ?? 0) < 0.999), mat);
  // 속 몸 (쇠사슬)
  obsBody(m, add, { ...M, obs: M.mail }, D, 'n:', { lowMat: M.mail });
  obsLimbs(m, add, { ...M, obs: M.mail }, D, 'n:', { k: 1.22 });
  /* ---- 흉갑 · 복부 판 · 목가리개 · 공허 핵 ---- */
  const cX = spl([[0, 0.15], [0.35, 0.175], [0.72, 0.19], [1, 0.13]]), cF = spl([[0, 0.112], [0.55, 0.138], [1, 0.09]]), cB = spl([[0, 0.11], [0.6, 0.126], [1, 0.095]]);
  const cuP = (v) => ({ y: 0.04 + 0.32 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), n: 2.3 });
  const cuMod = (p, u, v, c, s) => { if (s > 0) { p.z += 0.02 * gauss(Math.abs(p.x) - 0.075, 0.055) * gauss(p.y - 0.22, 0.08) * s + 0.008 * gauss(p.x, 0.012) * s; } };
  add(J.chest, C('n:cuirass', () => loft(cuP, 44, 16, { mod: cuMod })), M.plate);
  lRim(J.chest, 'n:cuR0', cuP, 0, 0.007, M.trim, { mod: cuMod });
  add(J.chest, C('n:cuTop', () => loft((v) => ({ y: 0.355 + 0.06 * v, rx: 0.13 - 0.07 * v, rzF: 0.09 - 0.035 * v, rzB: 0.095 - 0.035 * v }), 32, 5)), M.plate);
  // 가슴 가운데 공허 핵 (결정 + 테)
  add(J.chest, C('n:core', () => new THREE.OctahedronGeometry(0.04, 0)), M.crystalB, [0, 0.22, 0.152], [0, 0, 0], [1, 1.4, 0.55]);
  add(J.chest, C('n:coreR', () => new THREE.TorusGeometry(0.052, 0.007, 8, 24)), M.trim, [0, 0.22, 0.142], [0, 0, 0], [1, 1.3, 1]);
  for (let i = 0; i < 3; i++) { const bp = (v) => ({ y: -0.04 + i * 0.075 + 0.07 * v, rx: 0.14 - i * 0.004 + 0.008 * (2 - i), rzF: 0.105, rzB: 0.1, n: 2.2 }); add(J.spine, C('n:lame' + i, () => loft(bp, 36, 3)), M.plate); lRim(J.spine, 'n:lameR' + i, bp, 0, 0.0045); }
  const gP = (v) => ({ y: -0.04 + 0.11 * v, rx: 0.08 - 0.012 * v, rzF: 0.078 - 0.01 * v, rzB: 0.078, n: 2.2 });
  add(J.neck, C('n:gorget', () => loft(gP, 32, 4)), M.plate); lRim(J.neck, 'n:gorR', gP, 1, 0.005);
  /* ---- 견갑 (겹친 판 3장 · 테 · 결정 가시) · 팔 갑주 ---- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    for (let k = 0; k < 3; k++) {
      const pp = (v) => ({ y: 0.08 - k * 0.045 - 0.085 * v, rx: 0.092 + 0.014 * k + 0.028 * v, rz: 0.088 + 0.012 * k + 0.024 * v });
      const a0 = s > 0 ? 0.0 : 0.5, a1 = a0 + 0.5;
      add(sh, C(`n:pld${s}${k}`, () => loft(pp, 24, 5, { a0, a1 })), k ? M.plate : M.plateD, [s * 0.02, 0, 0]);
      rim(sh, `n:pldR${s}${k}`, loftRing(pp, 1, { a0, a1, n: 24 }).map((q) => q.add(new V3(s * 0.02, 0, 0))), 0.005, false);
    }
    cluster(add, sh, M.crystal, [s * 0.07, 0.1, -0.01], [s * 0.6, 1, -0.2], 4, 0.26, 0.032, 60 + s, 0.45);
    // 위팔 판 · 팔꿈치 덮개 · 팔뚝 갑주 (테)
    add(sh, C('n:rere', () => loft((v) => ({ y: -0.06 - 0.2 * v, rx: 0.082 - 0.01 * v, rz: 0.08 - 0.01 * v }), 24, 5, { a0: s > 0 ? 0.0 : 0.5, a1: s > 0 ? 0.75 : 1.25 })), M.plate);
    add(el, C('n:couter', () => lathe([[0.0, 0.055], [0.045, 0.04], [0.062, 0.0], [0.05, -0.04], [0.0, -0.05]], 16)), M.plate, [0, 0, -0.012], [0, 0, 0], [1.05, 1, 1.1]);
    shardAt(add, el, M.crystal, 0.014, 0.09, [0, 0, -0.05], [0, -0.3, -1]);
    const vb = (v) => ({ y: -0.04 - 0.21 * v, rx: 0.068 - 0.012 * v + 0.008 * smooth(0.75, 1, v), rz: 0.066 - 0.012 * v + 0.008 * smooth(0.75, 1, v) });
    add(el, C('n:vamb', () => loft(vb, 24, 6)), M.plate); lRim(el, 'n:vbR0', vb, 0, 0.005); lRim(el, 'n:vbR1', vb, 1, 0.005);
    // 건틀릿: 손등 판 · 마디 판 손가락
    const hg = new THREE.Group(); ha.add(hg);
    add(hg, C('n:palm' + s, () => loft((v) => ({ y: 0.005 - 0.08 * v, rx: 0.026, rz: 0.045 + 0.004 * v, n: 3, cx: s * 0.012 }), 16, 5)), M.plateD);
    add(hg, C('n:hback' + s, () => loft((v) => ({ y: 0.01 - 0.07 * v, rx: 0.03, rz: 0.049, n: 3, cx: s * 0.015 }), 16, 4, { a0: s > 0 ? 0.05 : 0.55, a1: s > 0 ? 0.45 : 0.95 })), M.plate);
    for (let k = 0; k < 4; k++) { const z = 0.03 - k * 0.02, pts = [], curl = s > 0 ? 0.9 + k * 0.08 : 2.5; for (let i = 0; i <= 8; i++) { const th = -0.7 - (i / 8) * curl; pts.push(new V3(s * (Math.cos(th) * 0.038 + 0.004), -0.07 + Math.sin(th) * 0.038 + 0.02, z)); }
      add(hg, C(`n:fing${s}${k}`, () => strand(pts, 0.011, 0.008, { seg: 12, rad: 6 })), M.plate); }
    add(hg, C('n:thumb' + s, () => strand([[0, -0.02, 0.04], [-s * 0.012, -0.045, 0.055], [s * 0.004, -0.07, 0.05], [s * 0.02, -0.08, 0.04]], 0.012, 0.009, { seg: 10, rad: 6 })), M.plate);
  }
  /* ---- 허리 판 (앞 · 옆 · 뒤 늘어진 판 + 테) · 앞 휘장 천 ---- */
  const fauld = (key, a0, a1, L, z0) => { const fp = (v) => ({ y: 0.06 - L * v, rx: 0.165 + 0.06 * v, rzF: 0.125 + 0.05 * v, rzB: 0.13 + 0.05 * v, n: 2.2 }); add(J.hips, C(key, () => loft(fp, 14, 6, { a0, a1 })), M.plate); rim(J.hips, key + 'R', loftRing(fp, 1, { a0, a1, n: 14 }), 0.005, false); rim(J.hips, key + 'T', loftRing(fp, 0, { a0, a1, n: 14 }), 0.006, false); };
  fauld('n:fL', 0.12, 0.38, 0.3); fauld('n:fR', 0.62, 0.88, 0.3); fauld('n:fB', -0.12, 0.12, 0.36);
  add(J.hips, C('n:belt', () => loft((v) => ({ y: 0.05 + 0.05 * v, rx: 0.17, rzF: 0.13, rzB: 0.135, n: 2.2 }), 36, 2)), M.plateD);
  add(J.hips, C('n:buckle', () => new THREE.OctahedronGeometry(0.035, 0)), M.crystalB, [0, 0.075, 0.14], [0, 0, 0], [1.2, 1, 0.5]);
  const tab = new THREE.Group(); tab.position.set(0, 0.06, 0.135); J.hips.add(tab); m.tab = tab;
  add(tab, C('n:tab', () => surf((u, v, p) => { const w = 0.1 - 0.02 * v, x = (u - 0.5) * 2 * w; p.set(x, -0.62 * v, 0.004 - 0.12 * (x * x) + 0.02 * v); }, 8, 14)), M.tabard);
  /* ---- 다리 갑주: 허벅지 판 · 무릎 덮개(가시) · 정강이 · 철 장화 ---- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const cu = (v) => ({ y: -0.02 - 0.36 * v, rx: 0.12 - 0.035 * v, rzF: 0.12 - 0.04 * v, rzB: 0.11 - 0.035 * v });
    add(hp, C('n:cuisse', () => loft(cu, 24, 6, { a0: 0.18, a1: 0.82 })), M.plate); rim(hp, 'n:cuR', loftRing(cu, 0, { a0: 0.18, a1: 0.82, n: 20 }), 0.005, false);
    add(kn, C('n:poleyn', () => lathe([[0.0, 0.07], [0.05, 0.055], [0.07, 0.0], [0.055, -0.05], [0.0, -0.06]], 16)), M.plate, [0, 0.0, 0.03], [0, 0, 0], [1.05, 1, 0.9]);
    shardAt(add, kn, M.crystal, 0.016, 0.11, [0, 0.02, 0.08], [0, 0.4, 1]);
    for (const k of [-1, 1]) add(kn, C('n:pFan', () => surf((u, v, p) => { const a = (u - 0.5) * 1.6; p.set(Math.sin(a) * 0.06 * (1 + v * 0.3), -0.02 + v * 0.02, Math.cos(a) * 0.05 * (1 + v * 0.3)); }, 8, 3)), M.plate, [k * 0.055, 0, 0.0], [0, k * 1.4, 0]);
    const gr = (v) => ({ y: -0.06 - (D.shin - 0.09) * v, rx: 0.08 - 0.022 * v, rzF: 0.084 - 0.028 * v, rzB: 0.09 - 0.035 * v + 0.014 * gauss(v - 0.25, 0.2) });
    add(kn, C('n:greave', () => loft(gr, 28, 8)), M.plate); lRim(kn, 'n:grR0', gr, 0, 0.005); lRim(kn, 'n:grR1', gr, 1, 0.005);
    add(ft, footGeo('n:sab', 0.25, 0.055, 0.075), M.plate);
    for (let i = 0; i < 3; i++) add(ft, C('n:sabR' + i, () => { const pts = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI; pts.push(new V3(Math.cos(a) * 0.052, -0.075 + Math.sin(a) * 0.055 - i * 0.008, 0.06 + i * 0.045)); } return strand(pts, 0.004, 0.004, { seg: 20, rad: 5 }); }), M.trim);
  }
  /* ---- 투구: 둥근 정수리 · 각진 턱 · T자 눈빛 · 휘어진 두 뿔 · 결정 왕관 ---- */
  const H = J.head, hX = spl([[0, 0.07], [0.25, 0.098], [0.6, 0.104], [0.85, 0.085], [1, 0.0]]), hF = spl([[0, 0.1], [0.3, 0.118], [0.65, 0.112], [1, 0.0]]), hB = spl([[0, 0.088], [0.5, 0.11], [1, 0.0]]);
  const hP = (v) => ({ y: -0.02 + 0.3 * v, rx: hX(v), rzF: hF(v), rzB: hB(v), n: v < 0.55 ? 2.6 : 2, cz: 0.008 });
  const hMod = (p, u, v, c, s) => { if (s > 0) p.z += 0.016 * gauss(p.x, 0.02) * smooth(0.0, 0.5, v) * (1 - smooth(0.7, 1, v)); };
  add(H, C('n:helm', () => loft(hP, 44, 22, { mod: hMod, poles: [22] })), M.plate);
  lRim(H, 'n:hR0', hP, 0, 0.007, M.trim, { mod: hMod });
  add(H, C('n:crest', () => { const pts = []; for (let i = 0; i <= 16; i++) { const a = -0.15 + (i / 16) * 2.9; pts.push(new V3(0, 0.12 + Math.sin(a) * 0.17, Math.cos(a) * 0.125 + 0.008)); } return strand(pts, 0.008, 0.005, { seg: 30, rad: 6 }); }), M.trim);
  // T자 눈빛 (가로 틈 + 세로 틈)
  const vis = (u, vv) => loftAt(hP, u, vv, new V3(), hMod).multiplyScalar(1.012);
  add(H, C('n:visorH', () => { const pts = []; for (let i = 0; i <= 14; i++) pts.push(vis(0.36 + 0.28 * i / 14, 0.48)); return strand(pts, 0.008, 0.008, { seg: 30, rad: 6, flat: 0.5, ref: [0, 0, 1] }); }), M.glow);
  add(H, C('n:visorV', () => { const pts = []; for (let i = 0; i <= 8; i++) pts.push(vis(0.5, 0.2 + 0.26 * i / 8)); return strand(pts, 0.006, 0.006, { seg: 16, rad: 6, flat: 0.6, ref: [1, 0, 0] }); }), M.glow);
  for (const s of [-1, 1]) add(H, C('n:horn' + s, () => { const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new V3(s * (0.09 + 0.12 * k), 0.17 + 0.1 * k + 0.14 * k * k, -0.01 - 0.18 * k + 0.05 * k * k * k)); } return strand(pts, 0.03, 0.003, { seg: 24, rad: 10 }); }), M.plateD);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(H, C(`n:hornR${s}${i}`, () => { const k = 0.15 + i * 0.18, c = new V3(s * (0.09 + 0.12 * k), 0.17 + 0.1 * k + 0.14 * k * k, -0.01 - 0.18 * k + 0.05 * k * k * k), pts = []; for (let j = 0; j <= 16; j++) { const a = j / 16 * TAU; pts.push(c.clone().add(new V3(0, Math.cos(a) * (0.031 - k * 0.03), Math.sin(a) * (0.031 - k * 0.03)))); } return strand(pts, 0.0035, 0.0035, { closed: true, seg: 24, rad: 5 }); }), M.trim);
  const crown = new THREE.Group(); crown.position.set(0, 0.36, -0.01); H.add(crown); m.crown = crown;
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, g = new THREE.Group(); g.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15); crown.add(g); shardAt(add, g, M.crystalB, 0.018, 0.12 + (i % 2) * 0.05, [0, -0.04, 0], [0, 1, 0]); }
  /* ---- 등 뒤 일식 후광 ---- */
  const halo = new THREE.Group(); halo.position.set(0, 0.56, -0.26); J.chest.add(halo); halo.scale.setScalar(0.72); m.halo = halo;
  add(halo, C('n:disc', () => new THREE.CircleGeometry(0.24, 48)), M.black);
  add(halo, C('n:corona', () => new THREE.PlaneGeometry(1.5, 1.5)), M.corona, [0, 0, -0.01]);
  add(halo, C('n:hRing', () => new THREE.TorusGeometry(0.27, 0.008, 6, 64)), M.trim);
  const hShards = []; for (let i = 0; i < 6; i++) { const g = new THREE.Group(); halo.add(g); shardAt(add, g, M.crystal, 0.022, 0.14, [0.36, 0, 0], [1, 0, 0]); g.rotation.z = i / 6 * TAU; hShards.push(g); }
  /* ---- 공허 대검: 감긴 자루 · 보석 폼멜 · 결정 날개 코등이 · 균열이 흐르는 날 ---- */
  const sw = new THREE.Group(); J.weapon.add(sw); m.sword = sw;
  add(sw, C('n:grip', () => { const g = loft((v) => ({ y: -0.2 + 0.32 * v, rx: 0.02, rz: 0.022 }), 12, 4); g.rotateX(Math.PI / 2); return g; }), M.wrap);
  add(sw, C('n:pommel', () => new THREE.OctahedronGeometry(0.035, 0)), M.crystalB, [0, 0, -0.23], [0, 0, 0], [1, 1, 1.4]);
  add(sw, C('n:pomR', () => new THREE.TorusGeometry(0.028, 0.007, 6, 16)), M.trim, [0, 0, -0.205]);
  for (const s of [-1, 1]) add(sw, C('n:guard' + s, () => strand([[0, 0, NB.guard - 0.01], [0, s * 0.09, NB.guard + 0.0], [0, s * 0.17, NB.guard + 0.05], [0, s * 0.21, NB.guard + 0.13]], 0.022, 0.004, { seg: 20, rad: 8, flat: 0.55, ref: [1, 0, 0] })), M.plateD);
  for (const s of [-1, 1]) shardAt(add, sw, M.crystalB, 0.014, 0.1, [0, s * 0.2, NB.guard + 0.1], [0, s * 0.4, 1]);
  add(sw, C('n:guardC', () => new THREE.OctahedronGeometry(0.03, 0)), M.crystalB, [0, 0, NB.guard + 0.01], [0, 0, 0], [0.7, 1.2, 1]);
  add(sw, C('n:blade', () => surf((u, v, p) => { const z = NB.guard + 0.02 + (NB.tip - NB.guard - 0.02) * v, w = 0.075 - 0.02 * v, tipK = smooth(0.84, 1, v), th = u * TAU, ex = Math.cos(th), ey = Math.sin(th), hw = w * (1 - tipK * 0.97);
    const fuller = 1 - 0.55 * gauss(ey, 0.35) * (1 - tipK); p.set(ex * 0.016 * fuller * (1 - tipK * 0.7) * (Math.abs(ey) < 0.98 ? 1 : 0.2), ey * hw, z + tipK * 0.03 * (1 - Math.abs(ey))); }, 14, 40, { closedU: true })), M.blade);
  add(sw, C('n:edge', () => { const pts = []; for (let i = 0; i <= 24; i++) { const v = i / 24, w = 0.075 - 0.02 * v, tipK = smooth(0.84, 1, v); pts.push(new V3(0, w * (1 - tipK * 0.97), NB.guard + 0.02 + (NB.tip - NB.guard - 0.02) * v)); } return strand(pts, 0.003, 0.001, { seg: 48, rad: 4 }); }), M.glow);
  add(sw, C('n:edge2', () => { const pts = []; for (let i = 0; i <= 24; i++) { const v = i / 24, w = 0.075 - 0.02 * v, tipK = smooth(0.84, 1, v); pts.push(new V3(0, -w * (1 - tipK * 0.97), NB.guard + 0.02 + (NB.tip - NB.guard - 0.02) * v)); } return strand(pts, 0.003, 0.001, { seg: 48, rad: 4 }); }), M.glow);
  /* ---- 분신: 모든 재질을 반투명 공허 빛으로 ---- */
  if (o.ghost) {
    const gm = new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
    const dk = new THREE.MeshBasicMaterial({ color: 0x05020a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.FrontSide });
    m.root.traverse((x) => { if (x.isMesh && (x.material === M.corona || x.material === M.black)) x.visible = false; if (x.isMesh) { const keep = x.material === M.glow || x.material === M.crystalB || x.material === M.blade; x.material = keep ? M.glow : gm; x.castShadow = false; } });
    m.ghostMats = [gm, dk];
    m.update = (dt, f) => { crown.rotation.y += dt * 0.8; halo.rotation.z += dt * 0.3; };
    m.sole = 0.075; return m;
  }
  /* ---- 망토 (천 물리) · 견갑의 찢어진 천 띠 (로프) ---- */
  m.cloths.push({ W: 8, H: 14, len: 1.3, mat: M.cape, anchor: (A) => { for (let i = 0; i < A.length; i++) { const k = i / (A.length - 1) - 0.5; J.chest.localToWorld(A[i].set(k * 0.46, 0.3 - Math.abs(k) * 0.04, -0.13 - 0.04 * (1 - 4 * k * k))); } },
    extraCaps: (f) => { const a = J.chest.localToWorld(new V3(0, 0.2, -0.12)), b = J.hips.localToWorld(new V3(0, -0.1, -0.16)); return [{ a, b, r: 0.13 * f.scale }]; } });
  for (const s of [-1, 1]) { const rope = new Rope(7, 0.07 * scale, { damp: 0.975, stiff: 0.1 }), view = new RopeTube(rope, M.tabard, { sub: 2, rad: 6, flat: 0.12, side: new V3(0, 0, 1), prof: (v) => 0.032 * (1 - 0.4 * v) * scale });
    m.ropes.push({ rope, view, joint: s > 0 ? J.shoulderL : J.shoulderR, local: new V3(s * 0.12, -0.02, 0.0), rest: new V3(s * 0.25, -1, 0).normalize() }); }
  const lag = { L: 0, R: 0, vL: 0, vR: 0 }; let t = 0;
  m.glowK = 0;
  m.update = (dt, f) => {
    t += dt; lag.vL += ((J.hipL.rotation.x - lag.L) * 120 - lag.vL * 12) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 120 - lag.vR * 12) * dt; lag.R += lag.vR * dt;
    tab.rotation.x = Math.min(0, Math.min(lag.L, lag.R)) * 0.85 - Math.hypot(f.vel.x, f.vel.z) * 0.015;
    crown.rotation.y += dt * 0.8; crown.position.y = 0.36 + Math.sin(t * 2) * 0.012; halo.rotation.z += dt * (f.enraged ? 0.9 : 0.3); hShards.forEach((g, i) => { g.children[0].rotation.y += dt * 2; });
    const want = f.state === 'act' ? 1 : f.enraged ? 0.6 : 0.2; m.glowK += (want - m.glowK) * Math.min(1, dt * 6);
    const pulse = 0.85 + 0.15 * Math.sin(t * 5);
    M.blade.emissiveIntensity = (1.6 + m.glowK * 2) * pulse; M.glow.opacity = 0.7 + 0.3 * pulse; M.crystalB.emissiveIntensity = 1 + m.glowK;
    m.stepPhys(dt, f);
  };
  m.sole = 0.075;
  m.weaponPts = (b, tt) => { J.weapon.localToWorld(b.set(0, 0, 0.25)); J.weapon.localToWorld(tt.set(0, 0, NB.tip)); };
  m.tipPos = (out = new V3()) => J.weapon.localToWorld(out.set(0, 0, NB.tip));
  m.handLPos = (out = new V3()) => J.handL.localToWorld(out.set(0, -0.08, 0.03));
  return m;
}
