// 엘루스 (ELUS) — 3D 모델 (기술·포즈는 elus.js)
// 유적에서 유물을 훔쳐 내다 파는 도굴꾼.
//
// 구성: 끝이 밝은 청록으로 빠지는 짙은 청흑색 웨이브 단발 · 구릿빛 피부
//       흰 하이칼라 스카프(목을 감싼 두툼한 카울) · 흰 상의 + 가슴 아래 갈색 가죽 코르셋(앞 끈) · 짧은 갈색 가죽 조끼(앞이 트임)
//       드러난 허리 · 넓은 가죽 벨트(금 버클) + 비스듬한 두 번째 벨트와 파우치 · 오른 허벅지 홀스터 끈(금 원형 장식) · 늘어진 가죽 끈(로프 물리)
//       오른팔: 맨팔 + 붕대 감은 팔뚝·손 / 왼팔: 청록 천 소매 + 크림·금 유물 팔찌(팔꿈치 청록 결정) + 갈색 장갑
//       등: 왼 어깨에서 늘어진 흰 반망토(천 물리)
//       검은 레깅스 · 무릎까지 오는 갈색 부츠(접힌 목 · 버클 끈 · 굽)
//       무기: 거대한 고대 유물 건틀릿 — 크림·금 자루(붕대 감개) · 끝의 갈고리 장식 · 청록 결정 핵이 박힌 거대한 손(갈퀴 손가락) · 늘어진 붕대(로프 물리)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.9, spineL: 0.18, chestL: 0.25, neckL: 0.07, shW: 0.176, uArm: 0.27, lArm: 0.245, hipW: 0.086, thigh: 0.45, shin: 0.43, headTop: 0.25 };
// 유물 건틀릿 치수 (오른손 기준 +Z): 갈고리 끝 · 손목 테 · 손가락 마디 · 끝
export const RL = { hook: -0.42, cuff: 0.74, knuck: 1.2, tip: 1.6, hs: 1.22 }; // hs: 거대한 손 배율 (손목 테 기준)
export const TEAL = 0x2affd6, TEAL2 = 0xa8fff0, DEEPT = 0x0a6a62, GOLDR = 0xf0cf80, CREAM = 0xe6d2a6;
const C = (k, fn) => cached('elus:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 갈색 가죽: 얼룩 · 결 · 가장자리 바느질
function leatherTex(base = '#6a4128', hi = 'rgba(255,220,180,0.06)', lo = 'rgba(30,14,6,0.18)', stitch = true) {
  const W = 256, H = 256, [c, g] = cv(W, H), r = rng(17); g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) { g.fillStyle = r() < 0.5 ? hi : lo; const x = r() * W, y = r() * H, s = 4 + r() * 20; g.beginPath(); g.ellipse(x, y, s, s * (0.3 + r() * 0.5), r() * 3, 0, TAU); g.fill(); }
  if (stitch) { g.strokeStyle = 'rgba(220,190,150,0.45)'; g.lineWidth = 2; g.setLineDash([6, 5]); for (const y of [8, H - 8]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.setLineDash([]); }
  return tex(c);
}
// 붕대: 겹겹이 비스듬히 감긴 띠 (크림 회색)
function bandTex() {
  const W = 128, H = 256, [c, g] = cv(W, H); g.fillStyle = '#cfc6b2'; g.fillRect(0, 0, W, H);
  for (let y = -64; y < H + 64; y += 22) { const gr = g.createLinearGradient(0, y, 0, y + 24); gr.addColorStop(0, 'rgba(90,80,64,0.5)'); gr.addColorStop(0.25, 'rgba(240,234,220,0.6)'); gr.addColorStop(1, 'rgba(160,150,130,0.25)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 26); g.lineTo(W, y + 48); g.lineTo(0, y + 22); g.closePath(); g.fill(); }
  const r = rng(5); g.strokeStyle = 'rgba(120,108,88,0.25)'; g.lineWidth = 1; for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + r() * 20, y + 4); g.stroke(); }
  return tex(c, [1, 3]);
}
// 유물 표면: 크림 바탕 + 새겨진 금 홈 무늬
function relicTex() {
  const W = 512, H = 512, [c, g] = cv(W, H), r = rng(23); g.fillStyle = '#e8dab8'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,250,235,0.12)' : 'rgba(120,96,60,0.08)'; g.beginPath(); g.arc(r() * W, r() * H, 3 + r() * 14, 0, TAU); g.fill(); }
  g.strokeStyle = '#b88a3a'; g.lineWidth = 5;
  for (let y = 40; y < H; y += 128) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 32) g.lineTo(x, y + ((x / 32) % 2 ? 14 : 0)); g.stroke(); }
  g.lineWidth = 3; for (let x = 64; x < W; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  return tex(c);
}
// 흰 상의: 가운데 열쇠 구멍(살빛) — loft uv: u 0.5 = 앞, v 0 = 아래(캔버스 아래)
function topTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H); g.fillStyle = '#f2efe8'; g.fillRect(0, 0, W, H);
  const r = rng(3); for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(160,150,140,0.12)'; g.lineWidth = 2 + r() * 3; const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (r() - 0.5) * 60, H / 2, x + (r() - 0.5) * 40, H); g.stroke(); }
  const p = new Path2D(); p.moveTo(W * 0.5 - 50, 0); p.quadraticCurveTo(W * 0.5 - 18, H * 0.32, W * 0.5, H * 0.52); p.quadraticCurveTo(W * 0.5 + 18, H * 0.32, W * 0.5 + 50, 0); p.closePath();
  g.fillStyle = '#b07a56'; g.fill(p); g.strokeStyle = '#d8d0c4'; g.lineWidth = 6; g.stroke(p);
  return tex(c);
}
// 흰 천 (스카프 · 망토): 은은한 결 + 단
function clothTex(hem) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(9); g.fillStyle = '#f0ede6'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) { g.strokeStyle = `rgba(150,145,140,${0.06 + r() * 0.1})`; g.lineWidth = 2 + r() * 6; const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 30, H); g.stroke(); }
  if (hem) { g.fillStyle = '#d4cec2'; g.fillRect(0, H - 16, W, 10); }
  return tex(c);
}
// 머리: 뿌리 청흑 → 끝 청록 (strand uv v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(31), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#0e1a1e'); gr.addColorStop(1, '#0a1518'); } else { gr.addColorStop(0, '#6ad8d0'); gr.addColorStop(0.16, '#2a8a90'); gr.addColorStop(0.34, '#10242a'); gr.addColorStop(1, '#0a1416'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(0,8,12,0.5)' : 'rgba(120,200,210,0.12)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 16, H / 2, x + (r() - 0.5) * 10, 0); g.stroke(); }
  return tex(c);
}
// 레깅스: 검정 + 은은한 광택 결
function leggTex() { const [c, g] = cv(128, 256), r = rng(13); g.fillStyle = '#17171b'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(120,120,140,0.08)'; g.lineWidth = 3 + r() * 6; const x = r() * 128; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 20, 256); g.stroke(); } return tex(c); }

/* ---------- 얼굴: 실제 비율 · 무표정 · 구릿빛 피부 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.07, 0.1, 0.088], jaw: 0.34, chin: 0.009 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#b8805c'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(230,180,140,0.45)'); gr.addColorStop(0.6, 'rgba(210,150,110,0)'); gr.addColorStop(1, 'rgba(110,60,40,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(120,70,50,0)'); cg.addColorStop(1, 'rgba(110,60,42,0.4)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
    // 볼 홍조 (은은하게)
    g.save(); g.filter = 'blur(18px)'; g.fillStyle = 'rgba(200,100,90,0.22)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.036, Y.eyeY - 0.022); g.beginPath(); g.ellipse(x, y, 34, 20, 0, 0, TAU); g.fill(); } g.restore();
  }
  paintFace(g, M, { ...Y, tilt: 0.05, lidDrop: 0.1, glow, open, iris: glow ? ['#d0fff4', '#5affd8', '#18c0a0', '#000'] : ['#a8f0c8', '#3aa878', '#124a32', '#062418'], pupil: '#04140c', lash: '#0c1418', brow: '#142a30', lip: 'rgba(150,80,70,0.7)' });
  const t = new THREE.CanvasTexture(c); if (!glow) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const core = pal.core ?? TEAL;
  const M = {
    skin: phys({ color: 0xbc8460, emissive: 0x4a2a1a, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffc8a0) }),
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x4a3028, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffc8a0) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x4a3028, emissiveIntensity: 1, roughness: 0.5 }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.5, sheen: 0.45, sheenColor: new THREE.Color(0x3a7a80), sheenRoughness: 0.4, emissive: 0x020608, emissiveIntensity: 0.4 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0x2a5a60), sheenRoughness: 0.4 }),
    top: phys({ map: T('top', topTex), roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    white: phys({ map: T('cloth', () => clothTex(false)), roughness: 0.7, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    cape: phys({ map: T('capeT', () => clothTex(true)), roughness: 0.7, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    leather: phys({ map: T('lea', () => leatherTex()), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    leatherD: phys({ map: T('leaD', () => leatherTex('#3e2416', 'rgba(255,220,180,0.05)', 'rgba(10,4,2,0.2)', false)), roughness: 0.6 }),
    leatherL: phys({ map: T('leaL', () => leatherTex('#8a5a36')), roughness: 0.55, clearcoat: 0.2 }),
    boot: phys({ map: T('boot', () => leatherTex('#5a3a26', 'rgba(255,220,180,0.07)', 'rgba(20,10,4,0.2)', false)), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    sole: phys({ color: 0x1e1612, roughness: 0.8 }),
    legg: phys({ map: T('legg', leggTex), roughness: 0.42, sheen: 0.5, sheenColor: new THREE.Color(0x4a4a50), clearcoat: 0.15 }),
    band: phys({ map: T('band', bandTex), roughness: 0.85 }),
    tealC: phys({ color: 0x2a7a82, roughness: 0.55, sheen: 0.9, sheenColor: new THREE.Color(0x9affff) }),
    gold: phys({ color: 0xe2b864, metalness: 1, roughness: 0.28, clearcoat: 0.4 }),
    goldD: phys({ color: 0xa8823e, metalness: 1, roughness: 0.38 }),
    brass: phys({ color: 0xc89a50, metalness: 0.9, roughness: 0.35 }),
    relic: phys({ map: T('relic', relicTex), color: 0xf6e6c4, metalness: 0.25, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    relicP: phys({ color: CREAM, metalness: 0.25, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    bronze: phys({ color: 0x4a3a2a, metalness: 0.7, roughness: 0.5 }),
    core: phys({ color: 0x8affe8, emissive: core, emissiveIntensity: 1.3, roughness: 0.05, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.95 }),
    glow: new THREE.MeshBasicMaterial({ color: core, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  M.core.envMap = env;
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.glow; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const onto = (o, p, n) => { o.position.copy(p); o.lookAt(p.clone().add(n)); return o; }; // +Z 가 n 을 향하게
  const rbox = (key, w, h, d, r = 0.006) => C('rb' + key, () => { const sh = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r; sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -y); sh.lineTo(w / 2, y); sh.quadraticCurveTo(w / 2, h / 2, x, h / 2); sh.lineTo(-x, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, y); sh.lineTo(-w / 2, -y); sh.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
    const bv = Math.min(r * 0.6, d * 0.3), g = new THREE.ExtrudeGeometry(sh, { depth: d - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -(d - bv * 2) / 2); return g; });
  // 금 버클: 둥근 사각 테 + 가운데 막대
  const buckle = (parent, key, p, n, w = 0.04, h = 0.034) => { const g = onto(new THREE.Group(), p, n); parent.add(g);
    add(g, C('bk' + key, () => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2); sh.lineTo(-w / 2, h / 2); sh.closePath(); const ho = new THREE.Path(); ho.moveTo(-w / 2 + 0.007, -h / 2 + 0.007); ho.lineTo(-w / 2 + 0.007, h / 2 - 0.007); ho.lineTo(w / 2 - 0.007, h / 2 - 0.007); ho.lineTo(w / 2 - 0.007, -h / 2 + 0.007); ho.closePath(); sh.holes.push(ho);
      return new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 }); }), M.gold);
    add(g, C('bkp' + key, () => new THREE.BoxGeometry(0.004, h - 0.01, 0.006)), M.gold, [0.004, 0, 0.003]); return g; };
  m.ropes = [];

  /* ---------- 골반 · 레깅스 · 드러난 허리 · 벨트 두 줄 · 파우치 ---------- */
  const pX = spl([[0, 0.142], [0.6, 0.128], [1, 0.118]]);
  const pelP = (v) => ({ y: -0.11 + 0.17 * v, rx: pX(v), rzF: 0.086, rzB: 0.1 - 0.008 * v, n: 2.2 });
  add(J.hips, C('pelvis', () => loft(pelP, 40, 8)), M.legg);
  const bX = spl([[0, 0.11], [0.45, 0.088], [1, 0.1]]), bF = spl([[0, 0.078], [0.5, 0.066], [1, 0.072]]);
  const bellyMod = (p, u, v, c, sn) => { if (sn > 0) p.z -= 0.003 * gauss(p.x, 0.006) * gauss(p.y - 0.04, 0.008); }; // 배꼽
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.06 + 0.26 * v, rx: bX(v), rzF: bF(v), rzB: 0.076, n: 2.15 }), 40, 14, { mod: bellyMod })), M.skin);
  // 넓은 벨트: 오른쪽이 조금 내려간 골반 벨트 + 금 버클
  const beltP = (v) => ({ y: 0.005 + 0.04 * v, rx: pX(0.7) + 0.012, rzF: 0.096, rzB: 0.108, n: 2.3 });
  const beltMod = (p) => { p.y -= 0.022 * clamp(-p.x / 0.14, -1, 1); };
  add(J.hips, C('belt', () => loft(beltP, 64, 3, { mod: beltMod, uvU: 3 })), M.leather);
  lRim(J.hips, 'beltR0', beltP, 0, 0.0025, M.leatherD, { mod: beltMod }); lRim(J.hips, 'beltR1', beltP, 1, 0.0025, M.leatherD, { mod: beltMod });
  buckle(J.hips, 'B', loftAt(beltP, 0.53, 0.5, new V3(), beltMod).add(new V3(0, 0, 0.006)), new V3(0.15, 0, 1).normalize(), 0.05, 0.04);
  // 두 번째 벨트: 왼쪽 위 → 오른쪽 아래 (오른 골반에 파우치)
  const belt2P = (v) => ({ y: -0.04 + 0.03 * v, rx: pX(0.4) + 0.02, rzF: 0.1, rzB: 0.112, n: 2.3 });
  const belt2Mod = (p) => { p.y -= 0.05 * clamp(-p.x / 0.14, -1, 1) - 0.01; };
  add(J.hips, C('belt2', () => loft(belt2P, 64, 2, { mod: belt2Mod, uvU: 3 })), M.leatherL);
  { const p = loftAt(belt2P, 0.66, 0.4, new V3(), belt2Mod), n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.022); p.y -= 0.04;
    const o = onto(add(J.hips, rbox('pouch', 0.07, 0.08, 0.04, 0.012), M.leather), p, n); add(o, rbox('pouchF', 0.074, 0.03, 0.044, 0.008), M.leatherD, [0, 0.03, 0.002]); add(o, C('pouchS', () => new THREE.SphereGeometry(0.007, 10, 8)), M.gold, [0, 0.018, 0.024]);
    const p2 = loftAt(belt2P, 0.8, 0.4, new V3(), belt2Mod), n2 = new V3(p2.x, 0, p2.z).normalize(); p2.addScaledVector(n2, 0.016); p2.y -= 0.025;
    onto(add(J.hips, rbox('pouch2', 0.05, 0.06, 0.03, 0.01), M.leatherD), p2, n2); }
  buckle(J.hips, 'B2', loftAt(belt2P, 0.28, 0.5, new V3(), belt2Mod).multiplyScalar(1.04), new V3(1, 0, 0.6).normalize(), 0.03, 0.028);
  // 벨트에서 늘어진 가죽 끈 두 가닥 (로프 물리)
  for (const [u, n] of [[0.3, 5], [0.36, 4]]) { const p = loftAt(belt2P, u, 0, new V3(), belt2Mod), nn = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(nn, 0.012);
    const rope = new Rope(n, 0.05, { damp: 0.975, stiff: 0.12 }), view = new RopeTube(rope, M.leatherD, { sub: 2, rad: 6, flat: 0.22, side: new V3(1, 0, 0), prof: () => 0.011 });
    m.ropes.push({ rope, view, joint: J.hips, local: p, rest: new V3(nn.x * 0.25, -1, nn.z * 0.25).normalize(), caps: 'legs' }); }

  /* ---------- 상체: 흰 상의 · 가슴 아래 가죽 코르셋 · 짧은 가죽 조끼 · 흰 하이칼라 스카프 ---------- */
  const chX = spl([[0, 0.1], [0.3, 0.112], [0.55, 0.124], [0.8, 0.118], [1, 0.094]]), chF = spl([[0, 0.074], [0.5, 0.088], [1, 0.07]]), chB = spl([[0, 0.076], [0.6, 0.082], [1, 0.068]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.034 * gauss(ax - 0.054, 0.04) * gauss(p.y - 0.135, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod, uvU: 1 })), M.top);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.12 - 0.072 * v ** 0.8, rzF: 0.072 - 0.028 * v, rzB: 0.068 - 0.026 * v }), 40, 8)), M.white);
  // 코르셋: 가슴 아래 → 갈비뼈 (앞 교차 끈 · 세로 바느질)
  const coP = (v) => { const q = chP(0.06 + 0.36 * v); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.007, rzB: q.rzB + 0.006 }; };
  add(J.chest, C('corset', () => loft(coP, 56, 8, { mod: chMod, uvU: 2 })), M.leather);
  lRim(J.chest, 'coR0', coP, 0, 0.003, M.leatherD, { mod: chMod }); lRim(J.chest, 'coR1', coP, 1, 0.0035, M.leatherD, { mod: chMod });
  for (const u of [0.32, 0.4, 0.6, 0.68, 0.1, 0.9]) { const pts = []; for (let i = 0; i <= 6; i++) pts.push(loftAt(coP, u, i / 6, new V3(), chMod).multiplyScalar(1.02)); rim(J.chest, 'coSt' + u, pts, 0.0018, false, M.leatherD); }
  for (let i = 0; i < 4; i++) { const v0 = 0.12 + i * 0.22, v1 = v0 + 0.2; for (const q of [-1, 1]) { const a = loftAt(coP, 0.5 + q * 0.03, v0, new V3(), chMod).multiplyScalar(1.025), b = loftAt(coP, 0.5 - q * 0.03, v1, new V3(), chMod).multiplyScalar(1.025); rim(J.chest, `coL${i}${q}`, [a, b], 0.0016, false, M.white); } }
  // 짧은 가죽 조끼: 앞이 트이고 어깨 · 등 · 옆을 덮음 (가슴 아래에서 끝남) + 깃 테두리
  const veP = (v) => { const q = chP(0.4 + 0.6 * v); return { ...q, rx: q.rx + 0.01, rzF: q.rzF + 0.012, rzB: q.rzB + 0.01 }; };
  const veMod = (p, u, v, c, sn) => { chMod(p, u, 0.4 + 0.6 * v, c, sn); if (sn > 0) p.y += 0.035 * (1 - v) * sn; };
  const VA0 = 0.585, VA1 = 1.415;
  add(J.chest, C('vest', () => loft(veP, 56, 12, { a0: VA0, a1: VA1, mod: veMod })), M.leather);
  lRim(J.chest, 'veR0', veP, 0, 0.0035, M.leatherD, { a0: VA0, a1: VA1, mod: veMod });
  for (const a of [VA0, VA1]) { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(veP, a, i / 10, new V3(), veMod)); rim(J.chest, 'veE' + a, pts, 0.005, false, M.leatherD); }
  // 깃: 어깨 앞으로 접힌 넓은 라펠
  for (const s of [-1, 1]) add(J.chest, C('lapel' + s, () => surf((u, v, p) => { const a = 0.5 + s * (0.085 + 0.09 * u * (0.4 + 0.6 * v)); loftAt(veP, a, 0.55 + 0.45 * v, p, veMod); const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.006 + 0.006 * u); }, 6, 8)), M.leatherL);
  // 흰 하이칼라 스카프: 목을 감싼 두툼한 카울 + 가슴 앞으로 접혀 내려온 자락
  const scP = (v) => ({ y: 0.205 + 0.115 * v, rx: 0.13 - 0.06 * smooth(0, 0.8, v) + 0.012 * Math.sin(v * Math.PI), rzF: 0.11 - 0.04 * smooth(0, 0.8, v) + 0.014 * Math.sin(v * Math.PI), rzB: 0.1 - 0.04 * smooth(0, 0.8, v) + 0.01 * Math.sin(v * Math.PI), n: 2.1 });
  const scMod = (p, u, v, c, sn) => { const k = 1 + 0.035 * Math.sin(u * TAU * 5 + v * 3) * (1 - v * 0.4) + 0.02 * Math.sin(u * TAU * 3 - v * 4); p.x *= k; p.z *= k; if (sn > 0) p.y -= 0.035 * sn * sn * (1 - v) ** 1.5; };
  add(J.chest, C('scarf', () => loft(scP, 64, 12, { mod: scMod })), M.white);
  add(J.chest, C('scarfIn', () => loft((v) => { const q = scP(0.6 + 0.4 * v); return { ...q, rx: q.rx - 0.008, rzF: q.rzF - 0.008, rzB: q.rzB - 0.008 }; }, 40, 4)), M.white);
  // 접힌 앞자락 (왼쪽으로 넘어간 큰 주름)
  add(J.chest, C('scarfD', () => surf((u, v, p) => { const a = 0.44 + 0.2 * u; loftAt(scP, a, 0.15 + 0.3 * (1 - v), p, scMod); p.y -= 0.06 * v * v; p.z += 0.012 + 0.02 * Math.sin(u * Math.PI) * v; p.x -= 0.01 * v; }, 10, 8)), M.white);

  /* ---------- 팔: 오른팔 맨팔 + 붕대 / 왼팔 청록 소매 + 유물 팔찌 + 장갑 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const uaP = (v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.043 - 0.01 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.041 - 0.009 * v });
    add(sh, C('uarm', () => loft(uaP, 24, 10)), M.skin);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.035 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.033 - 0.01 * v }), 24, 10)), M.skin);
    // 조끼 어깨 (짧은 캡 소매)
    const capP = (v) => ({ y: 0.05 - 0.07 * v, rx: 0.058 + 0.006 * v, rz: 0.056 + 0.006 * v });
    add(sh, C('vcap' + s, () => loft(capP, 24, 4, { a0: s > 0 ? -0.05 : 0.55, a1: s > 0 ? 0.45 : 1.05 })), M.leather);
    lRim(sh, 'vcapR' + s, capP, 1, 0.003, M.leatherD, { a0: s > 0 ? -0.05 : 0.55, a1: s > 0 ? 0.45 : 1.05 });
    const hg = new THREE.Group(); hg.scale.setScalar(0.84); hg.position.y = -0.006; ha.add(hg);
    const handMat = s > 0 ? M.leatherD : M.skin;
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.02 + 0.003 * Math.sin(v * Math.PI), rz: 0.033 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), s > 0 ? M.leatherD : M.band);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = 2.5;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0078, 0.0062, { seg: 14, rad: 8 })), handMat);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0094, 0.007, { seg: 12, rad: 8 })), handMat);
    if (s < 0) {
      // 오른팔: 팔뚝 · 손목 · 손바닥을 감은 붕대
      const bnP = (v) => ({ y: -0.06 - (DIMS.lArm - 0.04) * v, rx: 0.037 - 0.008 * v + 0.003 * Math.sin(v * 2.5), rz: 0.035 - 0.007 * v });
      add(el, C('bandA', () => loft(bnP, 24, 10, { mod: (p, u, v) => { const k = 1 + 0.06 * Math.max(0, Math.sin(v * 38 + u * TAU)); p.x *= k; p.z *= k; } })), M.band);
      add(hg, C('bandH', () => loft((v) => ({ y: 0.012 - 0.05 * v, rx: 0.024, rz: 0.037, n: 3, cx: -0.016 }), 18, 4)), M.band);
      // 위팔 붕대 고리 하나
      const u2 = (v) => { const q = uaP(0.22 + 0.06 * v); return { ...q, rx: q.rx + 0.003, rz: q.rz + 0.003 }; }; add(sh, C('bandU', () => loft(u2, 20, 2)), M.band);
    } else {
      // 왼팔: 청록 천 소매 (위팔) + 금 띠
      const slP = (v) => { const q = uaP(0.08 + 0.85 * v); return { ...q, rx: q.rx + 0.006 + 0.004 * v, rz: q.rz + 0.006 + 0.004 * v }; };
      add(sh, C('tsl', () => loft(slP, 24, 8, { mod: (p, u, v) => { const k = 1 + 0.04 * Math.sin(u * TAU * 5 + v * 5); p.x *= k; p.z *= k; } })), M.tealC);
      lRim(sh, 'tslR', slP, 0.04, 0.004, M.gold); lRim(sh, 'tslR2', slP, 0.97, 0.003, M.gold);
      // 유물 팔찌: 크림 판 + 금 능선 + 팔꿈치 청록 결정
      const brP = (v) => ({ y: 0.01 - (DIMS.lArm - 0.02) * v, rx: 0.045 - 0.008 * v, rz: 0.043 - 0.008 * v });
      add(el, C('brc', () => loft(brP, 28, 8)), M.relic); lRim(el, 'brc0', brP, 0, 0.004, M.gold); lRim(el, 'brc1', brP, 1, 0.004, M.gold); lRim(el, 'brcM', brP, 0.5, 0.003, M.goldD);
      for (const u of [0.25, 0.5]) { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(brP, u, i / 10, new V3()).multiplyScalar(1.07)); rim(el, 'brcRg' + u, pts, 0.004, false); }
      // 팔꿈치 판 + 결정
      add(el, C('elbP', () => { const g = new THREE.SphereGeometry(0.05, 18, 12, 0, TAU, 0, Math.PI * 0.45); g.rotateX(-Math.PI / 2); return g; }), M.relicP, [0, 0.005, -0.012], [0, 0, 0], [1, 1, 0.8]);
      add(el, C('elbG', () => { const g = new THREE.OctahedronGeometry(0.022, 0); g.scale(0.8, 1.2, 0.7); return g; }), M.core, [0.032, -0.03, 0.0], [0, 0, 0.2]);
      add(el, C('elbGR', () => new THREE.TorusGeometry(0.024, 0.004, 6, 20)), M.gold, [0.034, -0.03, 0.0], [0, Math.PI / 2, 0]);
      add(hg, C('gcuff', () => loft((v) => ({ y: 0.02 - 0.03 * v, rx: 0.036, rz: 0.04 }), 18, 2)), M.leatherD);
    }
  }

  /* ---------- 다리: 검은 레깅스 · 오른 허벅지 홀스터 끈 · 무릎까지 오는 갈색 부츠 ---------- */
  const PB = -0.085;
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.088], [0.4, 0.076], [0.85, 0.054], [1, 0.052]]), thF = spl([[0, 0.084], [0.5, 0.068], [1, 0.052]]), thB = spl([[0, 0.086], [0.35, 0.076], [1, 0.047]]);
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12)), M.legg);
    const cX = spl([[0, 0.052], [0.3, 0.056], [0.75, 0.037], [1, 0.031]]), cF = spl([[0, 0.05], [0.5, 0.043], [1, 0.031]]), cB = spl([[0, 0.052], [0.3, 0.068], [0.7, 0.043], [1, 0.033]]);
    const cnP = (v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) });
    add(kn, C('shin', () => loft(cnP, 28, 14)), M.legg);
    if (s < 0) { // 오른 허벅지: 홀스터 끈 두 줄 + 금 원형 장식 + 가죽 주머니
      for (const [k, vv] of [['a', 0.22], ['b', 0.36]]) { const hbP = (v) => { const q = thP(vv + 0.04 * v); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.006, rzB: q.rzB + 0.006 }; }; add(hp, C('holB' + k, () => loft(hbP, 32, 2)), M.leather); }
      const p = loftAt(thP, 0.75, 0.29, new V3()), n = new V3(-1, 0, 0.25).normalize(); p.addScaledVector(n, 0.012);
      const o = onto(add(hp, rbox('hol', 0.06, 0.13, 0.026, 0.01), M.leatherD), p, n); add(o, rbox('holF', 0.064, 0.04, 0.03, 0.008), M.leather, [0, 0.04, 0.002]);
      const md = add(o, C('medal', () => { const g = new THREE.CylinderGeometry(0.019, 0.019, 0.006, 24); g.rotateX(Math.PI / 2); return g; }), M.gold, [0, 0.0, 0.017]);
      add(md, C('medalG', () => new THREE.SphereGeometry(0.008, 12, 8)), M.core, [0, 0, 0.004], [0, 0, 0], [1, 1, 0.6]);
    }
    // 무릎 부츠: 정강이 아래 → 발목 (위에 접힌 목) · 버클 끈 둘
    const btP = (v) => { const q = cnP(0.16 + 0.84 * v); return { ...q, y: q.y, rx: q.rx + 0.007, rzF: q.rzF + 0.007, rzB: q.rzB + 0.008 }; };
    add(kn, C('bootS', () => loft(btP, 32, 14, { mod: (p, u, v) => { const k = 1 + 0.02 * Math.sin(v * 22) * smooth(0.3, 0.9, v); p.x *= k; p.z *= k; } })), M.boot);
    const cfP = (v) => { const q = btP(0); return { y: q.y + 0.04 - 0.07 * v, rx: q.rx + 0.012 + 0.006 * v, rzF: q.rzF + 0.016 + 0.006 * v, rzB: q.rzB + 0.012 + 0.006 * v }; };
    const cfMod = (p, u, v) => { p.y += 0.015 * Math.sin(u * TAU * 3) * v; };
    add(kn, C('bootC', () => loft(cfP, 32, 4, { mod: cfMod })), M.leatherL); lRim(kn, 'bootCR', cfP, 1, 0.004, M.leatherD, { mod: cfMod }); lRim(kn, 'bootCT', cfP, 0, 0.004, M.leatherL, { mod: cfMod });
    for (const vv of [0.3, 0.62]) { const sbP = (v) => { const q = btP(vv + 0.04 * v); return { ...q, rx: q.rx + 0.004, rzF: q.rzF + 0.004, rzB: q.rzB + 0.004 }; };
      add(kn, C('bootB' + vv, () => loft(sbP, 32, 2)), M.leatherD); buckle(kn, 'bb' + vv, loftAt(sbP, s > 0 ? 0.3 : 0.7, 0.5, new V3()).multiplyScalar(1.06), new V3(s, 0, 0.4).normalize(), 0.022, 0.02); }
    const fw = spl([[0, 0.0], [0.06, 0.028], [0.25, 0.035], [0.6, 0.04], [0.85, 0.033], [1, 0.01]]), fh = spl([[0, 0.028], [0.08, 0.056], [0.3, 0.06], [0.6, 0.04], [0.85, 0.03], [1, 0.016]]);
    const fb = (v) => -0.06 + 0.02 * (1 - smooth(0.3, 0.72, v));
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb(v) + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.06 + 0.24 * v); };
    add(ft, C('foot', () => surf(foot, 28, 20, { closedU: true })), M.boot);
    add(ft, C('ankle', () => loft((v) => ({ y: 0.03 - 0.07 * v, rx: 0.041 + 0.004 * v, rzF: 0.046 + 0.01 * v, rzB: 0.046 }), 20, 4)), M.boot);
    const sole = (u, v, p) => { const [c, sn] = ang(u), w = fw(Math.min(0.98, Math.max(0.04, v))) + 0.005, top = fb(v) - 0.002, heel = v < 0.28 ? PB : PB + 0.022 * smooth(0.28, 0.4, v), e = 0.35; const k = (Math.sign(sn) * Math.abs(sn) ** e + 1) / 2; p.set(Math.sign(c) * Math.abs(c) ** e * w, heel + (top - heel) * k, -0.066 + 0.25 * v); };
    add(ft, C('sole', () => surf(sole, 32, 18, { closedU: true })), M.sole);
  }

  /* ---------- 목 · 얼굴 · 웨이브 단발 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.033 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.032 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.032 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.1);
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.067, 0.1, -0.006], [s * 0.079, 0.104, -0.014], [s * 0.083, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.14 + 0.38 * w * w : 0.12 - 0.9 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.007 + 0.013 * smooth(0, 0.4, v) + 0.008 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(19), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 18, rad: 8, flat, ref })), M.hair);
    // 앞머리: 가르마에서 오른쪽(-x)으로 넘긴 굵은 웨이브 (오른눈 위를 비스듬히 덮음)
    for (let k = 0; k < 15; k++) {
      const t = k / 14, az = 1.05 - t * 2.1 + (r() - 0.5) * 0.04, side = Math.abs(az), long = az < 0.1 && az > -0.75 ? 0.14 : 0, tipEl = 0.2 - 0.06 * r() - 0.42 * smooth(0.5, 1.05, side) - long, sweep = -0.22 - 0.1 * t;
      const pts = [headAt(0.3 + az * 0.3, 1.2, 0.022), headAt(az * 0.75 + sweep * 0.3, 0.82, 0.034), headAt(az * 0.95 + sweep * 0.7, 0.5, 0.036), headAt(az + sweep + 0.04 * Math.sin(k), (0.5 + tipEl) / 2, 0.032), headAt(az + sweep * 1.3, tipEl, 0.016 + 0.01 * smooth(0.6, 1, side))];
      const d = dirOf(az, 0.5); clump('bang' + k, pts, (k % 2 ? 0.028 : 0.038) + r() * 0.008, 0.002, 0.22, [d.x, d.y, d.z]);
    }
    // 웨이브 단발: 턱선까지 · 끝은 바깥으로 뻗치며 청록 (앞옆이 조금 길고 뒤는 목덜미)
    for (let k = 0; k < 28; k++) {
      const az = (k / 28) * TAU + Math.PI * 0.5 + 0.1, w = Math.cos(az); if (w > 0.6) continue;
      const tipEl = -1.0 + 0.24 * Math.max(0, -w) - 0.08 * Math.max(0, w) + (r() - 0.5) * 0.08, flick = 0.06 + 0.035 * r() + 0.02 * Math.max(0, w), wv = 0.06 * Math.sin(k * 1.7);
      const pts = [headAt(az, 0.72, 0.02), headAt(az + wv * 0.4, 0.15, 0.03), headAt(az - wv, -0.4, 0.04), headAt(az + wv + (r() - 0.5) * 0.05, tipEl + 0.16, 0.046), headAt(az + (r() - 0.5) * 0.12 + Math.sign(Math.sin(az)) * 0.12, tipEl, flick)];
      const d = dirOf(az, 0); clump('bob' + k, pts, 0.046, 0.007, 0.27, [d.x, 0, d.z]);
    }
    // 바깥으로 크게 뻗친 끝머리 (볼 옆 · 청록 끝)
    for (let k = 0; k < 6; k++) { const sd = k < 3 ? 1 : -1, az = sd * (1.25 + (k % 3) * 0.45), e = -0.85 - 0.06 * (k % 3); clump('wisp' + k, [headAt(az, -0.25, 0.04), headAt(az, e + 0.12, 0.055), headAt(az + 0.16 * sd, e - 0.06, 0.1)], 0.018, 0.002, 0.4, [Math.sin(az), 0, Math.cos(az)]); }
  }

  /* ---------- 무기: 거대한 유물 건틀릿 ---------- */
  const relic = new THREE.Group(); J.weapon.add(relic); m.relic = relic;
  const X = [Math.PI / 2, 0, 0];
  {
    // 자루: 크림 유물 관 + 금 고리 + 붕대 감개
    const shP = (v) => ({ y: RL.hook + 0.06 + (RL.cuff - RL.hook - 0.04) * v, rx: 0.042 + 0.006 * smooth(0.7, 1, v), rz: 0.04 + 0.006 * smooth(0.7, 1, v) });
    add(relic, C('shaft', () => { const g = loft(shP, 20, 12, { uvV: 3 }); g.rotateX(Math.PI / 2); return g; }), M.relic);
    for (const z of [-0.3, -0.06, 0.12, 0.42, 0.66]) add(relic, C('sring', () => new THREE.TorusGeometry(0.046, 0.007, 8, 28)), M.gold, [0, 0, z]);
    for (const [z0, z1] of [[-0.04, 0.1], [0.22, 0.38]]) add(relic, C('swrap' + z0, () => { const g = loft((v) => ({ y: z0 + (z1 - z0) * v, rx: 0.05, rz: 0.048 }), 20, 8, { uvV: 1.5, mod: (p, u, v) => { const k = 1 + 0.06 * Math.max(0, Math.sin(v * 30 + u * TAU)); p.x *= k; p.z *= k; } }); g.rotateX(Math.PI / 2); return g; }), M.band);
    // 끝 장식: 위로 말린 금 갈고리 + 청록 작은 결정
    add(relic, C('pom', () => lathe([[0.05, 0], [0.056, -0.02], [0.05, -0.05], [0.03, -0.07], [0, -0.075]], 20)), M.gold, [0, 0, RL.hook + 0.07], [-Math.PI / 2, 0, 0]);
    add(relic, C('hook', () => strand([[0, 0.0, RL.hook + 0.02], [0, 0.03, RL.hook - 0.07], [0, 0.12, RL.hook - 0.12], [0, 0.21, RL.hook - 0.07], [0, 0.22, RL.hook + 0.02], [0, 0.17, RL.hook + 0.07]], 0.03, 0.01, { seg: 40, rad: 8, flat: 0.4, ref: [1, 0, 0] })), M.relicP);
    add(relic, C('hookR', () => strand([[0, 0.02, RL.hook - 0.06], [0, 0.11, RL.hook - 0.135], [0, 0.225, RL.hook - 0.08], [0, 0.24, RL.hook + 0.02]], 0.007, 0.004, { seg: 30, rad: 6 })), M.gold, [0.012, 0, 0]);
    add(relic, C('hookR', () => strand([[0, 0.02, RL.hook - 0.06], [0, 0.11, RL.hook - 0.135], [0, 0.225, RL.hook - 0.08], [0, 0.24, RL.hook + 0.02]], 0.007, 0.004, { seg: 30, rad: 6 })), M.gold, [-0.012, 0, 0]);
    add(relic, C('hookG', () => { const g = new THREE.OctahedronGeometry(0.02, 0); g.scale(0.7, 1.2, 0.7); return g; }), M.core, [0, 0.13, RL.hook - 0.05]);
  }
  // 거대한 손 (분리된 그룹: 궁극기에서 복제해 거대화한다)
  const handG = new THREE.Group(); handG.position.z = RL.cuff * (1 - RL.hs); handG.scale.setScalar(RL.hs); relic.add(handG); m.relicHead = handG;
  {
    // 손목 테: 넓은 금 고리 두 겹 + 청록 선
    add(handG, C('cuff', () => { const g = lathe([[0.06, 0], [0.085, 0.01], [0.092, 0.05], [0.088, 0.1], [0.07, 0.11]], 32); g.rotateX(Math.PI / 2); return g; }), M.gold, [0, 0, RL.cuff - 0.05]);
    add(handG, C('cuffL', () => new THREE.TorusGeometry(0.093, 0.006, 8, 40)), M.glow, [0, 0, RL.cuff]);
    // 손등 · 손바닥: 너비가 넓어지는 둥근 사각 로프트 (y → z 로 눕힘 · 등 +y, 손바닥 -y)
    const hwX = spl([[0, 0.085], [0.2, 0.1], [0.5, 0.15], [0.82, 0.19], [1, 0.18]]), hbY = spl([[0, 0.085], [0.3, 0.095], [0.65, 0.085], [1, 0.06]]), hpY = spl([[0, 0.075], [0.4, 0.06], [1, 0.045]]);
    const hEnd = (v) => (v > 0.9 ? Math.max(0.02, Math.sqrt(Math.max(0, 1 - ((v - 0.9) / 0.1) ** 2))) : 1); // 손가락 쪽 끝은 둥글게 닫힘
    const hP = (v) => ({ y: RL.cuff + 0.04 + (RL.knuck - RL.cuff - 0.02) * v + 0.03 * smooth(0.9, 1, v), rx: hwX(v) * hEnd(v), rzF: hpY(v) * hEnd(v), rzB: hbY(v) * hEnd(v), n: 2.7 });
    const hMod = (p, u, v, c, sn) => { if (sn < 0) p.z -= 0.018 * Math.pow(-sn, 3) * Math.sin(v * Math.PI); };
    const HP = (u, v, out = new V3()) => { loftAt(hP, u, v, out, hMod); return out.set(out.x, -out.z, out.y); }; // 로프트 좌표 → 무기 좌표
    add(handG, C('hand', () => { const g = loft(hP, 48, 18, { mod: hMod, poles: [] }); g.rotateX(Math.PI / 2); return g; }), M.relic);
    // 손등의 겹친 판 (금 테)
    for (let k = 0; k < 3; k++) {
      const v0 = 0.08 + k * 0.3, v1 = v0 + 0.34, plate = (u, v, p) => { HP(0.75 + 0.5 * u, v0 + (v1 - v0) * v, p); const n = new V3(p.x * 0.3, 1, 0).normalize(); p.addScaledVector(n, 0.01 + 0.012 * (1 - v) + 0.004 * k); };
      add(handG, C('plate' + k, () => surf(plate, 16, 6)), M.relicP);
      { const pts = []; for (let i = 0; i <= 16; i++) { const p = new V3(); plate(i / 16, 1, p); pts.push(p); } rim(handG, 'plateR' + k, pts, 0.005, false); }
    }
    // 금 능선 (손등 가로질러 세로로)
    for (const u of [0.86, 1.14]) { const pts = []; for (let i = 0; i <= 12; i++) { const p = HP(u, 0.05 + 0.9 * (i / 12)); p.y += 0.02; pts.push(p); } rim(handG, 'ridge' + u, pts, 0.006, false); }
    // 청록 결정 핵 (손등 가운데) + 금 받침 + 작은 결정 둘
    { const p = HP(1.0, 0.36); p.y += 0.04; m.corePos = p.clone();
      add(handG, C('coreG', () => { const g = new THREE.OctahedronGeometry(0.05, 0); g.scale(0.85, 0.6, 1.5); return g; }), M.core, p.toArray());
      add(handG, C('coreS', () => { const g = new THREE.TorusGeometry(0.058, 0.01, 8, 32); g.scale(0.9, 1.5, 1); return g; }), M.gold, [p.x, p.y - 0.01, p.z], [Math.PI / 2, 0, 0]);
      m.coreHalo = add(handG, C('coreH', () => new THREE.SphereGeometry(0.075, 16, 12)), M.glow, p.toArray(), [0, 0, 0], [1, 0.6, 1.4]);
      for (const s of [-1, 1]) { const q = HP(1.0 + s * 0.12, 0.7); q.y += 0.03; add(handG, C('coreG2', () => { const g = new THREE.OctahedronGeometry(0.022, 0); g.scale(0.8, 0.6, 1.4); return g; }), M.core, q.toArray()); } }
    // 손바닥 가운데 포구 (청록 빛)
    { const p = HP(0.5, 0.75); p.y -= 0.006; add(handG, C('palmG', () => { const g = new THREE.CircleGeometry(0.045, 20); g.rotateX(Math.PI / 2); return g; }), M.glow, p.toArray()); }
    // 갈퀴 손가락 넷 + 엄지 (마디 그룹: 궁극기에서 접었다 편다)
    m.claws = [];
    for (let k = 0; k < 4; k++) {
      const x = -0.13 + k * 0.087, L = k === 0 || k === 3 ? 0.88 : 1, g = new THREE.Group(); g.name = 'claw' + k; g.position.set(x, -0.005, RL.knuck - 0.02); handG.add(g); m.claws.push(g);
      add(g, C('clawA' + L, () => strand([[0, 0, -0.02], [0, 0.012, 0.07 * L], [0, -0.02, 0.14 * L], [0, -0.075, 0.185 * L], [0, -0.13, 0.19 * L]], 0.036, 0.008, { seg: 24, rad: 10, flat: 0.8, ref: [1, 0, 0] })), M.relicP);
      for (const [z, y, rr] of [[0.03, 0.006, 0.036], [0.105, -0.002, 0.03]]) add(g, C('clawRing' + rr, () => new THREE.TorusGeometry(rr, 0.005, 6, 20)), M.gold, [0, y, z * L], [0.1, 0, 0]);
      add(g, C('clawT' + L, () => strand([[0, -0.06, 0.18 * L], [0, -0.12, 0.2 * L], [0, -0.17, 0.18 * L]], 0.011, 0.002, { seg: 10, rad: 8 })), M.gold);
    }
    { const g = new THREE.Group(); g.name = 'thumb'; g.position.set(0.17, -0.02, RL.cuff + 0.18); g.rotation.set(0, 0.5, 0); handG.add(g); m.claws.push(g);
      add(g, C('thumbA', () => strand([[0, 0, 0], [0.02, -0.02, 0.07], [0.0, -0.07, 0.13], [-0.04, -0.11, 0.15]], 0.034, 0.008, { seg: 20, rad: 10, flat: 0.8, ref: [0, 1, 0] })), M.relicP);
      add(g, C('thumbT', () => strand([[-0.02, -0.09, 0.145], [-0.06, -0.12, 0.15], [-0.09, -0.12, 0.13]], 0.01, 0.002, { seg: 10, rad: 8 })), M.gold); }
    // 손을 비스듬히 감은 붕대 (납작한 띠)
    for (const [k, v0, v1, tw] of [[0, 0.1, 0.45, 0.6], [1, 0.4, 0.12, -0.7], [2, 0.6, 0.85, 0.5]]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, u = 0.0 + t, v = v0 + (v1 - v0) * t + tw * 0.05 * Math.sin(t * TAU), p = HP(u, clamp(v, 0, 1)); const n = new V3(p.x, p.y, 0).normalize(); p.addScaledVector(n, 0.007); pts.push(p); }
      add(handG, C('hwrap' + k, () => strand(pts, 0.016, 0.016, { closed: true, seg: 60, rad: 6, flat: 0.15, ref: [0, 0, 1] })), M.band);
    }
  }
  // 손목 테에서 늘어진 붕대 두 가닥 (로프 물리)
  for (const [x, n, len] of [[0.07, 7, 0.05], [-0.05, 6, 0.045]]) {
    const rope = new Rope(n, len, { damp: 0.975, stiff: 0.1 }), view = new RopeTube(rope, M.band, { sub: 2, rad: 6, flat: 0.16, side: new V3(1, 0, 0), uvV: 2, prof: (v) => 0.017 * (1 - 0.35 * v) });
    m.ropes.push({ rope, view, joint: J.weapon, local: new V3(x, 0.07, RL.cuff - 0.02), rest: new V3(0, -1, 0), caps: 'body', world: true });
  }

  // 왼손 단검 (도굴용 · 기술 중에만 꺼냄): 주먹 아래로 뻗는 짧은 칼날
  const dagger = new THREE.Group(); dagger.position.set(0.012, -0.06, 0.0); J.handL.add(dagger); dagger.visible = false; m.dagger = dagger;
  add(dagger, C('dgGrip', () => new THREE.CylinderGeometry(0.011, 0.012, 0.09, 10)), M.leatherD, [0, -0.01, 0]);
  add(dagger, C('dgGuard', () => new THREE.BoxGeometry(0.012, 0.012, 0.07)), M.gold, [0, -0.06, 0]);
  add(dagger, C('dgBlade', () => { const sh = new THREE.Shape(); sh.moveTo(-0.016, 0); sh.lineTo(0.016, 0); sh.quadraticCurveTo(0.018, -0.12, 0, -0.2); sh.quadraticCurveTo(-0.006, -0.1, -0.016, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }); g.translate(0, 0, -0.002); g.rotateY(Math.PI / 2); return g; }), M.relicP, [0, -0.066, 0]);
  add(dagger, C('dgEdge', () => strand([[0, -0.07, 0.016], [0, -0.17, 0.012], [0, -0.26, 0]], 0.0018, 0.0006, { seg: 12, rad: 4 })), M.glow);

  /* ---------- 흰 반망토 (왼 어깨 → 등 · 천 물리) ---------- */
  let cape = null;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    cape = new Cloth(scene, 6, 12, 0.78, M.cape); extras.push(cape.mesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; if (cape) cape.mesh.geometry.dispose(); cape = null; m._attached = false; };
  m.resetCloth = () => { if (cape) cape.ok = false; for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), rq = new THREE.Quaternion(), capeA = [];
  for (let i = 0; i < 6; i++) { const u = i / 5, p = loftAt(chP, 0.27 - 0.29 * u, 0.97, new V3()); p.multiplyScalar(1.12); p.y += 0.03 - 0.02 * u; p.z -= 0.012; capeA.push(p); }
  m.glow = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    J.chest.updateMatrixWorld(true);
    const wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 0.8, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 0.8];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.04 * sc })), h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.2), r: h0.r * 0.72 + 0.05 * sc };
    const armL = { a: f.hurt[2].a, b: f.hurt[2].b, r: f.hurt[2].r + 0.03 * sc };
    if (cape) { for (let i = 0; i < cape.W; i++) J.chest.localToWorld(cape.anchors[i].copy(capeA[i])); cape.len = 0.78 * sc; cape.mesh.visible = vis; cape.step(dt, [torso, armL, ...legs], f.pos.y + 0.02, wind); }
    const capsBody = [torso, ...legs], windV = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6); m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local));
      r.rope.step(dt, tmp, r.caps === 'legs' ? legs : capsBody, f.pos.y + 0.01, r.world ? r.rest : r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.view.mesh.visible = vis && (!r.world || relic.visible);
    }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    // 결정 핵: 유물 게이지 · 차징 · 기술 중 빛 (relicK 0..1)
    const want = Math.max(f.relicGlow || 0, (f.relic || 0) >= 100 ? 0.8 : 0.15 + 0.4 * (f.relic || 0) / 100, f.holdK || 0); m.glow += (want - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.88 + 0.12 * Math.sin(f.G.time * 7);
    M.core.emissiveIntensity = (1 + m.glow * 2.2) * pulse; M.glow.opacity = (0.25 + m.glow * 0.6) * pulse; m.coreHalo.scale.set(1 + m.glow * 0.5, 0.6 + m.glow * 0.3, 1.4 + m.glow * 0.6);
    m.dagger.visible = vis && !!f.daggerOn;
  };
  m.setWeapon = (v) => { relic.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = -PB + 0.003;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.25)); J.weapon.localToWorld(t.set(0, -0.04, RL.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, RL.cuff)); J.weapon.localToWorld(t.set(0, -0.06, RL.tip)); };
  // 포구 (손바닥 앞) · 결정 핵 월드 위치
  m.muzzle = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, -0.03, RL.tip + 0.02)); };
  m.coreWorld = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return handG.localToWorld(out.copy(m.corePos)); };
  m.extras = extras;
  return m;
}
