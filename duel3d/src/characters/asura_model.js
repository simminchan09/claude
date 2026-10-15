// 아수라 (ASURA · 황금 매의 순례자) — 3D 모델 (기술·포즈는 asura.js)
// 금빛 매의 깃을 두른 젊은 순례자. 길고 가벼운 황금 장병기를 바람개비처럼 돌리며 싸운다.
//
// 구성: 짙은 남색 머리(눈썹을 덮는 긴 앞머리 · 턱까지 오는 옆머리) · 황금 매 투구(이마 위로 내민 부리 챙 · 정수리 볏 · 청록 보석)
//       투구 양옆으로 뒤로 휘날리는 큰 주황·금빛 깃 날개 · 청록 목도리(두 갈래 꼬리: 로프 물리)
//       남색 속옷 + 금빛 깃 비늘 흉갑(청록 보석) · 깃을 겹친 어깨 갑주 + 바깥으로 뻗은 큰 깃 · 금빛 팔토시 · 갈색 가죽 장갑
//       갈색 가죽 허리띠(금 버클 · 보석) · 허벅지 위 금빛 깃 갑판 · 앞 청록 자락 · 어깨에서 발목까지 내려오는 긴 청록 망토 (천 물리 2)
//       남색 통 넓은 하렘 바지(종아리에서 부풀고 발목에서 조임) · 크림색 천을 감은 샌들 장화 + 갈색 가죽 끈
//       무기: 긴 황금 장대 — 위 끝에 큰 초승달 갈고리 날, 아래 끝에 청록 보석이 박힌 바퀴 모양 고리 칼날 (던지면 부메랑처럼 돌아온다)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.92, spineL: 0.18, chestL: 0.26, neckL: 0.074, shW: 0.19, uArm: 0.28, lArm: 0.25, hipW: 0.09, thigh: 0.44, shin: 0.43, headTop: 0.27 };
// 장대 치수 (오른손 기준 +Z, m): 아래 끝(바퀴) ~ 위 끝(갈고리)
export const WP = { butt: -0.62, wheel: -0.8, wheelR: 0.17, grip2: 0.48, head: 1.04, hookC: 1.3, hookR: 0.21, top: 1.56 };
export const GOLD = 0xffc040, GOLD2 = 0xfff0a8, ORANGE = 0xff8a1a, TEAL = 0x2ad8c8, TEAL2 = 0xa8fff0, NAVY = 0x1c2850;
const C = (k, fn) => cached('asura:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 금빛 깃 비늘: 아래로 겹친 둥근 깃 끝 줄 (흉갑 · 투구 · 팔토시)
function scaleTex(rep = [1, 1], base = '#d8a446') {
  const W = 512, H = 512, [c, g] = cv(W, H); g.fillStyle = base; g.fillRect(0, 0, W, H);
  const r = 32;
  for (let row = 0, y = -r; y < H + r; row++, y += r * 0.9) for (let x = -r + (row % 2) * r; x < W + r; x += r * 2) {
    const gr = g.createLinearGradient(0, y - r, 0, y + r); gr.addColorStop(0, '#f6d888'); gr.addColorStop(0.6, '#d8a040'); gr.addColorStop(1, '#8a5a1a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x - r, y); g.quadraticCurveTo(x - r, y + r * 1.1, x, y + r * 1.15); g.quadraticCurveTo(x + r, y + r * 1.1, x + r, y); g.lineTo(x + r, y - r); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(90,50,10,0.7)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x - r, y + r * 1.1, x, y + r * 1.15); g.quadraticCurveTo(x + r, y + r * 1.1, x + r, y); g.stroke();
    g.strokeStyle = 'rgba(255,240,190,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - r * 0.6); g.lineTo(x, y + r * 0.9); g.stroke();
  }
  return tex(c, rep);
}
// 깃 한 장: 금빛 뿌리 → 주황 → 짙은 주황 끝 · 깃대 · 비스듬한 깃가지 (surf uv: u 폭, v 길이 = 캔버스 아래 → 위)
function featherTex() {
  const W = 128, H = 512, [c, g] = cv(W, H), r = rng(23), gr = g.createLinearGradient(0, H, 0, 0);
  gr.addColorStop(0, '#fff0b0'); gr.addColorStop(0.25, '#ffc850'); gr.addColorStop(0.65, '#ff9a28'); gr.addColorStop(1, '#e85a10'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const y = r() * H, sd = r() < 0.5 ? -1 : 1; g.strokeStyle = r() < 0.5 ? 'rgba(120,50,0,0.35)' : 'rgba(255,240,180,0.35)'; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(W / 2, y); g.lineTo(W / 2 + sd * W * 0.5, y - 40); g.stroke(); }
  g.fillStyle = 'rgba(255,250,220,0.9)'; g.fillRect(W / 2 - 2, 0, 4, H);
  return tex(c);
}
// 남색 바지: 세로 주름 결
function pantsTex() {
  const W = 512, H = 256, [c, g] = cv(W, H), r = rng(11); g.fillStyle = '#1a2450'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const x = r() * W; g.fillStyle = r() < 0.5 ? 'rgba(10,14,40,0.35)' : 'rgba(90,110,180,0.12)'; g.fillRect(x, 0, 3 + r() * 10, H); }
  return tex(c, [3, 1]);
}
// 감은 천 (발목 · 샌들): 크림색 비스듬한 띠
function wrapTex() {
  const W = 128, H = 256, [c, g] = cv(W, H); g.fillStyle = '#c8a87a'; g.fillRect(0, 0, W, H);
  for (let y = -64; y < H + 64; y += 22) { g.fillStyle = 'rgba(120,95,60,0.45)'; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 30); g.lineTo(W, y + 33); g.lineTo(0, y + 3); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,250,235,0.5)'; g.fillRect(0, y + 8, W, 2); }
  return tex(c, [2, 2]);
}
// 청록 천: 금빛 테두리 · 깃 무늬 (망토 · 앞자락) — 캔버스 위 = 고정된 윗변
function tealTex(front) {
  const W = 256, H = 1024, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#1e7a80'); gr.addColorStop(0.6, '#2aa0a0'); gr.addColorStop(1, '#5ac8c0'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e0b050'; g.lineWidth = 10; g.strokeRect(8, -10, W - 16, H - 2); g.lineWidth = 3; g.strokeRect(24, -10, W - 48, H - 22);
  g.fillStyle = 'rgba(224,176,80,0.85)';
  for (let i = 0; i < (front ? 3 : 4); i++) { const y = 300 + i * 190, x = W / 2; g.beginPath(); g.moveTo(x, y - 60); g.quadraticCurveTo(x + 34, y, x, y + 60); g.quadraticCurveTo(x - 34, y, x, y - 60); g.fill(); }
  g.fillStyle = '#e0b050'; for (let x = 24; x < W - 20; x += 26) { g.beginPath(); g.moveTo(x, H - 4); g.lineTo(x + 13, H - 36); g.lineTo(x + 26, H - 4); g.closePath(); g.fill(); }
  return tex(c);
}
// 짙은 남색 머리 (뿌리 → 끝: strand uv v 0 → 1 = 캔버스 아래 → 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(31), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#10162e'); gr.addColorStop(1, '#0c1226'); } else { gr.addColorStop(0, '#24306a'); gr.addColorStop(0.5, '#141c40'); gr.addColorStop(1, '#0a0f26'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 360; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(0,0,12,0.5)' : 'rgba(120,150,230,0.22)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 14, H / 2, x + (r() - 0.5) * 8, 0); g.stroke(); }
  return tex(c);
}
// 청록 감개 (장대 손잡이)
function gripTex() { const [c, g] = cv(64, 256); g.fillStyle = '#1a7a78'; g.fillRect(0, 0, 64, 256); for (let y = -32; y < 256 + 32; y += 16) { g.fillStyle = 'rgba(150,255,240,0.35)'; g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 12); g.lineTo(64, y + 16); g.lineTo(0, y + 4); g.closePath(); g.fill(); } return tex(c); }
// 가죽: 짙은 갈색 + 결
function leatherTex() { const [c, g] = cv(128, 128), r = rng(5); g.fillStyle = '#6a4226'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(30,15,5,0.25)' : 'rgba(200,150,100,0.12)'; g.fillRect(r() * 128, r() * 128, 2 + r() * 6, 1 + r() * 2); } return tex(c, [2, 1]); }

/* ---------- 깃 한 장 (곡면): +Z 로 뻗고, 폭은 x, 오목한 쪽은 +y ---------- */
function featherGeo(L, W, bend = 0.12) {
  return surf((u, v, p) => {
    const s = (u - 0.5) * 2, w = W * (Math.sin(Math.PI * Math.pow(v, 0.72)) + 0.12 * (1 - v)) * (s < 0 ? 0.8 : 1);
    p.set(s * w, bend * L * v * v + Math.abs(s) * w * 0.28 - 0.01 * L * Math.sin(v * Math.PI), v * L);
  }, 6, 14);
}

export const featherGeoShared = (L, W, bend) => C(`fthS${L}_${W}_${bend}`, () => featherGeo(L, W, bend));

/* ---------- 얼굴: 실제 비율 · 무표정 · 남색 눈동자 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.104, 0.008), R: [0.071, 0.102, 0.09], jaw: 0.3, chin: 0.01, square: 0.6, cheek: 0.003 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#ecc6a4'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,236,214,0.5)'); gr.addColorStop(0.6, 'rgba(250,220,196,0)'); gr.addColorStop(1, 'rgba(170,110,80,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(180,120,90,0)'); cg.addColorStop(1, 'rgba(160,100,70,0.4)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  }
  paintFace(g, M, { ...Y, male: true, tilt: 0.04, lidDrop: 0.1, glow, open, iris: glow ? ['#d0fff8', '#5afff0', '#20c0b0', '#000'] : ['#6ad8d0', '#2a8a90', '#123a50', '#081a28'], pupil: '#06121a', lash: '#101428', brow: '#141c3a' });
  const t = new THREE.CanvasTexture(c); if (!glow) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
const _m4 = new THREE.Matrix4(), _o = new V3();
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const tealC = pal.teal ?? TEAL;
  const M = {
    skin: phys({ color: 0xeac0a0, emissive: 0x6a4a3a, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8c0) }),
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x5a4a42, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8c0) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x5a4a42, emissiveIntensity: 1, roughness: 0.5 }),
    eyeGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0x6a8aff), sheenRoughness: 0.35, emissive: 0x060a1a, emissiveIntensity: 0.5 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0x5a78e0), sheenRoughness: 0.35 }),
    shirt: phys({ color: 0x1e2a50, roughness: 0.6, sheen: 0.7, sheenColor: new THREE.Color(0x6a7ab8) }),
    pants: phys({ map: T('pants', pantsTex), color: 0xb8c0d8, roughness: 0.66, sheen: 0.6, sheenColor: new THREE.Color(0x5a68a8) }),
    gold: phys({ color: 0xe8b450, metalness: 1, roughness: 0.28, clearcoat: 0.4 }),
    goldD: phys({ color: 0xb08030, metalness: 1, roughness: 0.34 }),
    scale: phys({ map: T('scale', () => scaleTex([2, 1])), metalness: 0.85, roughness: 0.32, clearcoat: 0.4, envMapIntensity: 0.9 }),
    scaleS: phys({ map: T('scaleS', () => scaleTex([1.5, 1])), metalness: 0.85, roughness: 0.32, clearcoat: 0.4, envMapIntensity: 0.9 }),
    feather: phys({ map: T('feather', featherTex), roughness: 0.45, metalness: 0.25, sheen: 1, sheenColor: new THREE.Color(0xffd080), emissive: 0x3a1a00, emissiveIntensity: 0.5, envMapIntensity: 0.6 }),
    teal: phys({ color: 0x2aa0a0, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xa8fff0) }),
    scarf: phys({ color: 0x48c0b4, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xd0fff8) }),
    cloak: phys({ map: T('cloak', () => tealTex(false)), roughness: 0.55, sheen: 0.9, sheenColor: new THREE.Color(0xa8fff0) }),
    tabard: phys({ map: T('tabard', () => tealTex(true)), roughness: 0.55, sheen: 0.9, sheenColor: new THREE.Color(0xa8fff0) }),
    leather: phys({ map: T('leather', leatherTex), roughness: 0.6, clearcoat: 0.2 }),
    glove: phys({ color: 0x5a3820, roughness: 0.55, clearcoat: 0.25 }),
    wrap: phys({ map: T('wrap', wrapTex), roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color(0xfff4dc) }),
    sole: phys({ color: 0x3a2414, roughness: 0.7 }),
    grip: phys({ map: T('grip', gripTex), roughness: 0.55 }),
    gem: phys({ color: 0x5affe8, emissive: tealC, emissiveIntensity: 1.1, roughness: 0.05, clearcoat: 1, flatShading: true }),
    blade: phys({ color: 0xffd880, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x6a3a00, emissiveIntensity: 0.3 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  M.gem.envMap = env;
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.edge && mat !== M.eyeGlow; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  // 방향을 주고 메시를 놓는다: 메시의 +Z 가 dir, +Y 가 up 쪽
  const aim = (me, dir, up) => { _m4.lookAt(_o.set(0, 0, 0).add(dir), new V3(), up); me.quaternion.setFromRotationMatrix(_m4); return me; };
  const feather = (parent, L, W, bend, p, dir, up, mat = M.feather) => aim(add(parent, C(`fth${L}_${W}_${bend}`, () => featherGeo(L, W, bend)), mat, p), new V3(...dir).normalize(), new V3(...up).normalize());
  const gemAt = (parent, p, r = 0.014, sc = [1, 1, 0.6]) => add(parent, C('gem' + r, () => new THREE.IcosahedronGeometry(r, 1)), M.gem, p, [0, 0, 0], sc);
  m.ropes = [];

  /* ---------- 골반 · 배 · 허리띠 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: -0.12 + 0.21 * v, rx: 0.15 - 0.022 * v, rzF: 0.094, rzB: 0.104, n: 2.2 }), 40, 8, { uvU: 1 })), M.pants);
  const bX = spl([[0, 0.124], [0.45, 0.112], [1, 0.12]]), bF = spl([[0, 0.088], [0.5, 0.084], [1, 0.088]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.04 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.085, n: 2.15 }), 40, 10)), M.shirt);
  const beltP = (v) => ({ y: -0.06 + 0.07 * v, rx: 0.156, rzF: 0.112, rzB: 0.118, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 64, 4)), M.leather); lRim(J.hips, 'beltR0', beltP, 0, 0.004, M.goldD); lRim(J.hips, 'beltR1', beltP, 1, 0.004, M.goldD);
  // 허리 천 띠 (청록, 허리띠 위로 감음)
  const sashP = (v) => ({ y: 0.012 + 0.05 * v, rx: 0.15 - 0.01 * v, rzF: 0.106, rzB: 0.112, n: 2.25 });
  add(J.hips, C('sash', () => loft(sashP, 56, 4)), M.teal);
  { const g = new THREE.Group(); const p = loftAt(beltP, 0.5, 0.5, new V3()); g.position.set(p.x, p.y, p.z + 0.006); J.hips.add(g);
    const sh = new THREE.Shape(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + Math.PI / 2, r = i % 2 ? 0.026 : 0.042; if (i) sh.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.8); else sh.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.8); } sh.closePath();
    add(g, C('buckle', () => new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 })), M.gold);
    gemAt(g, [0, 0, 0.012], 0.016); m.buckle = g; }
  // 허리 옆 작은 가죽 주머니
  add(J.hips, C('pouch', () => loft((v) => ({ y: -0.02 - 0.09 * v, rx: 0.032 + 0.006 * Math.sin(v * Math.PI), rz: 0.022 + 0.004 * Math.sin(v * Math.PI), n: 2.6 }), 16, 6)), M.leather, [-0.15, -0.02, 0.04], [0, 0.5, 0.12]);

  /* ---------- 상체: 남색 속옷 · 금빛 깃 비늘 흉갑 · 청록 목도리 ---------- */
  const chX = spl([[0, 0.116], [0.3, 0.13], [0.6, 0.14], [0.85, 0.132], [1, 0.104]]), chF = spl([[0, 0.084], [0.55, 0.096], [1, 0.074]]), chB = spl([[0, 0.084], [0.6, 0.09], [1, 0.072]]);
  const chP = (v) => ({ y: -0.02 + 0.29 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.016 * gauss(ax - 0.06, 0.045) * gauss(p.y - 0.17, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 20, { mod: chMod })), M.shirt);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.2 + 0.08 * v, rx: 0.132 - 0.08 * v ** 0.8, rzF: 0.078 - 0.03 * v, rzB: 0.074 - 0.028 * v }), 40, 8)), M.shirt);
  // 흉갑: 앞 · 옆을 덮는 깃 비늘 판 (가장자리 금테) + 가운데 청록 보석
  const plP = (v) => { const q = chP(0.3 + 0.62 * v); return { ...q, rx: q.rx + 0.012, rzF: q.rzF + 0.014, rzB: q.rzB + 0.012 }; };
  const plMod = (p, u, v, c, sn) => { chMod(p, u, v, c, sn); p.z += 0.008 * Math.max(0, sn); };
  add(J.chest, C('plate', () => loft(plP, 40, 12, { a0: 0.2, a1: 0.8, mod: plMod, uvU: 1 })), M.scale);
  rim(J.chest, 'plateR1', loftRing(plP, 1, { a0: 0.2, a1: 0.8, n: 40, mod: plMod }), 0.005, false); rim(J.chest, 'plateR0', loftRing(plP, 0, { a0: 0.2, a1: 0.8, n: 40, mod: plMod }), 0.005, false);
  { const p = loftAt(plP, 0.5, 0.55, new V3(), plMod); gemAt(J.chest, [p.x, p.y, p.z + 0.008], 0.02, [1, 1.3, 0.6]);
    const sh = new THREE.Shape(); sh.moveTo(0, 0.05); sh.quadraticCurveTo(0.045, 0.01, 0.03, -0.035); sh.lineTo(0, -0.05); sh.lineTo(-0.03, -0.035); sh.quadraticCurveTo(-0.045, 0.01, 0, 0.05);
    add(J.chest, C('plateOrn', () => new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 })), M.gold, [p.x, p.y, p.z + 0.002]); }
  // 등판 (뒤): 작은 금 판
  add(J.chest, C('backPl', () => loft(plP, 24, 8, { a0: 0.88, a1: 1.12 })), M.scaleS);
  // 청록 목도리: 목을 두 겹으로 감아 부푼 고리
  const scP = (v) => ({ y: 0.225 + 0.085 * v, rx: 0.09 - 0.036 * v + 0.012 * Math.sin(v * Math.PI), rzF: 0.082 - 0.03 * v + 0.016 * Math.sin(v * Math.PI), rzB: 0.072 - 0.026 * v, n: 2 });
  const scMod = (p, u, v) => { const k = 1 + 0.06 * Math.sin(u * TAU * 5 + v * 4) * Math.sin(v * Math.PI); p.x *= k; p.z *= k; };
  add(J.chest, C('scarf', () => loft(scP, 48, 10, { mod: scMod })), M.scarf);
  add(J.chest, C('scarfK', () => new THREE.SphereGeometry(0.035, 14, 10)), M.scarf, [0.045, 0.255, 0.07], [0, 0, 0.4], [1.2, 0.9, 0.8]);

  /* ---------- 어깨 갑주(깃을 겹친 금판 + 바깥으로 뻗은 큰 깃) · 팔 · 장갑 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    for (let k = 0; k < 3; k++) {
      const pp = (v) => ({ y: 0.07 - k * 0.04 - 0.08 * v, rx: 0.074 + 0.014 * k + 0.022 * v, rz: 0.07 + 0.012 * k + 0.02 * v });
      const a0 = s > 0 ? 0.0 : 0.5, a1 = a0 + 0.5;
      add(sh, C(`pld${s}${k}`, () => loft(pp, 24, 4, { a0, a1 })), M.scaleS, [s * 0.014, 0, 0]);
      rim(sh, `pldR${s}${k}`, loftRing(pp, 1, { a0, a1, n: 24 }).map((q) => q.add(new V3(s * 0.014, 0, 0))), 0.004, false);
    }
    gemAt(sh, [s * 0.098, 0.035, 0.0], 0.015, [0.6, 1, 1]);
    // 큰 깃: 어깨 바깥으로 · 아래 뒤로 부채처럼
    for (let k = 0; k < 5; k++) {
      const L = 0.2 + 0.035 * k, dir = [s * (0.85 - k * 0.06), -0.25 - k * 0.16, -0.2 - k * 0.1], up = [0, 0.3, 1];
      feather(sh, L, 0.03 + 0.003 * k, 0.15, [s * (0.07 + k * 0.006), 0.04 - k * 0.022, -0.03 + k * 0.012], dir, up);
    }
    // 위팔: 헐렁한 남색 소매 · 금빛 팔뚝 고리
    add(sh, C('uarm', () => loft((v) => ({ y: 0.02 - (DIMS.uArm + 0.02) * v, rx: 0.05 - 0.008 * v + 0.006 * Math.sin(v * Math.PI), rz: 0.048 - 0.007 * v + 0.005 * Math.sin(v * Math.PI) }), 24, 10)), M.shirt);
    add(sh, C('armBand', () => loft((v) => ({ y: -0.17 - 0.035 * v, rx: 0.051, rz: 0.049 }), 24, 2)), M.gold);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.038 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.036 - 0.01 * v }), 24, 10)), M.skin);
    // 팔토시: 깃 비늘 금판 (바깥쪽이 뾰족하게 팔꿈치 위로 솟음)
    const brP = (v) => ({ y: -0.03 - (DIMS.lArm - 0.03) * v, rx: 0.045 - 0.008 * v, rz: 0.043 - 0.008 * v });
    add(el, C('bracer', () => loft(brP, 28, 8)), M.scaleS); lRim(el, 'brR0', brP, 0, 0.0035, M.gold); lRim(el, 'brR1', brP, 1, 0.0035, M.gold);
    add(el, C('brFin' + s, () => featherGeo(0.13, 0.026, 0.1)), M.gold, [s * 0.04, -0.12, 0], [Math.PI * 0.5, 0, 0]).rotation.set(-Math.PI / 2 - 0.15, s * 0.25, s * 1.57);
    gemAt(el, [s * 0.04, -0.15, 0.012], 0.011, [0.5, 1, 1]);
    // 손: 갈색 가죽 장갑 + 금 손등판
    const hg = new THREE.Group(); hg.scale.setScalar(0.9); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.021 + 0.003 * Math.sin(v * Math.PI), rz: 0.035 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.glove);
    add(hg, C('hback' + s, () => loft((v) => ({ y: 0.005 - 0.055 * v, rx: 0.025, rz: 0.038, n: 3, cx: s * 0.018 }), 18, 4, { a0: s > 0 ? 0.05 : 0.55, a1: s > 0 ? 0.45 : 0.95 })), M.gold);
    for (let k = 0; k < 4; k++) {
      const z = 0.025 - k * 0.0165, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.3 + k * 0.1 : 2.6;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.031 + s * 0.003, -0.05 + Math.sin(th) * 0.031, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0082, 0.0066, { seg: 14, rad: 8 })), M.glove);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.046], [s * 0.003, -0.058, 0.045], [s * 0.017, -0.07, 0.037]], 0.0098, 0.0072, { seg: 12, rad: 8 })), M.glove);
  }

  /* ---------- 다리: 남색 하렘 바지 (종아리에서 부풀고 발목에서 조임) · 감은 천 · 샌들 ---------- */
  const fold = (p, u, v, k = 0.006) => { const w = 1 + k / 0.08 * Math.sin(u * TAU * 7 + v * 5) * Math.sin(v * Math.PI); p.x *= w; p.z *= w; };
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.04, thX = spl([[0, 0.1], [0.4, 0.094], [0.85, 0.078], [1, 0.076]]), thF = spl([[0, 0.096], [0.5, 0.088], [1, 0.074]]), thB = spl([[0, 0.1], [0.35, 0.094], [1, 0.072]]);
    const thP = (v) => ({ y: 0.04 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12, { mod: (p, u, v) => fold(p, u, v, 0.005) })), M.pants);
    // 허벅지 바깥 금빛 깃 갑판 (세 장 겹침)
    for (let k = 0; k < 3; k++) {
      const tP = (v) => { const q = thP(0.02 + k * 0.1 + 0.5 * v); return { ...q, rx: q.rx + 0.012 + 0.004 * (2 - k), rzF: q.rzF + 0.012 + 0.004 * (2 - k), rzB: q.rzB + 0.012 + 0.004 * (2 - k) }; };
      const c = s > 0 ? 0.3 : 0.7, a0 = c - 0.13 + 0.02 * k, a1 = c + 0.13 - 0.02 * k;
      const tMod = (p, u, v) => { const e = Math.abs((u - (a0 + a1) / 2) / ((a1 - a0) / 2)); p.y += 0.06 * Math.max(0, v - 0.6) * (1 - e * e) * 0; if (v > 0.75) { const tip = (v - 0.75) / 0.25; const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, -0.004 * tip); } };
      add(hp, C(`tas${s}${k}`, () => loft(tP, 12, 8, { a0, a1, mod: tMod })), M.scaleS);
      rim(hp, `tasR${s}${k}`, loftRing(tP, 1, { a0, a1, n: 12 }), 0.0035, false);
    }
    const cX = spl([[0, 0.08], [0.3, 0.09], [0.6, 0.086], [0.8, 0.062], [0.9, 0.044], [1, 0.04]]), cF = spl([[0, 0.078], [0.4, 0.088], [0.75, 0.064], [0.9, 0.044], [1, 0.04]]), cB = spl([[0, 0.08], [0.35, 0.096], [0.7, 0.07], [0.9, 0.046], [1, 0.042]]);
    add(kn, C('shin', () => loft((v) => ({ y: 0.03 - (DIMS.shin - 0.06) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) }), 28, 16, { mod: (p, u, v) => fold(p, u, v, 0.007) })), M.pants);
    // 발목: 감은 천 (정강이 아래 1/4 ~ 발등)
    const wrP = (v) => ({ y: -DIMS.shin * 0.72 - DIMS.shin * 0.3 * v, rx: 0.043 - 0.006 * v, rzF: 0.043 - 0.004 * v, rzB: 0.045 - 0.004 * v });
    add(kn, C('wrapS', () => loft(wrP, 24, 8)), M.wrap);
    // 갈색 가죽 끈: 발목에 X 자로 감김
    for (let i = 0; i < 3; i++) add(kn, C('strap' + i, () => { const pts = []; for (let k = 0; k <= 24; k++) { const a = (k / 24) * TAU, y = -DIMS.shin * (0.76 + i * 0.08) + 0.018 * Math.sin(a); pts.push(new V3(Math.sin(a) * (0.046 - i * 0.002), y, Math.cos(a) * (0.047 - i * 0.002))); } return strand(pts, 0.0035, 0.0035, { closed: true, seg: 48, rad: 5, flat: 0.5, ref: [0, 1, 0] }); }), M.leather);
    // 발 (감은 천) · 샌들 바닥 · 발등 끈
    const fw = spl([[0, 0.0], [0.06, 0.03], [0.25, 0.037], [0.6, 0.042], [0.85, 0.034], [1, 0.01]]), fh = spl([[0, 0.03], [0.08, 0.056], [0.3, 0.058], [0.6, 0.036], [0.85, 0.026], [1, 0.012]]);
    const FB = -0.062;
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, FB + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.06 + 0.24 * v); };
    add(ft, C('foot', () => surf(foot, 28, 20, { closedU: true })), M.wrap);
    const sole = (u, v, p) => { const [c, sn] = ang(u), w = 0.044 + 0.006 * Math.sin(v * Math.PI) - 0.02 * smooth(0.85, 1, v), e = 0.35, k = (Math.sign(sn) * Math.abs(sn) ** e + 1) / 2; p.set(Math.sign(c) * Math.abs(c) ** e * w, FB - 0.014 + 0.016 * k, -0.07 + 0.255 * v); };
    add(ft, C('sole', () => surf(sole, 32, 12, { closedU: true })), M.sole);
    for (const z of [0.07, 0.12]) add(ft, C('fstrap' + z, () => { const pts = []; for (let k = 0; k <= 12; k++) { const a = Math.PI * (k / 12); pts.push(new V3(Math.cos(a) * 0.045, FB + Math.sin(a) * (z < 0.1 ? 0.05 : 0.035), z)); } return strand(pts, 0.004, 0.004, { seg: 20, rad: 5 }); }), M.leather);
  }

  /* ---------- 목 · 얼굴 · 남색 머리 · 황금 매 투구 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.04 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.039 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.039 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.09);
  m.eyeGlow = add(H, headGeo, M.eyeGlow, [0, 0, 0], [0, 0, 0], [1.002, 1.002, 1.002]); m.eyeGlow.renderOrder = 5;
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.1, -0.006], [s * 0.08, 0.104, -0.014], [s * 0.084, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.2 + 0.35 * w * w : 0.2 - 0.85 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(17), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), M.hair);
    // 앞머리: 부리 챙 아래로 흘러내려 눈썹 · 한쪽 눈가를 덮는 긴 결 (가운데에서 갈라 양옆으로)
    for (let k = 0; k < 15; k++) {
      const t = k / 14, az = -0.95 + t * 1.9 + (r() - 0.5) * 0.05, side = Math.abs(az), sweep = (az > 0 ? 1 : -1) * (0.1 + 0.12 * side), long = az < -0.1 && az > -0.6 ? 0.1 : 0;
      const tipEl = 0.08 - 0.08 * r() - 0.38 * smooth(0.5, 1.0, side) - long;
      const pts = [headAt(az * 0.6, 0.95, 0.024), headAt(az * 0.8 + sweep * 0.2, 0.62, 0.032), headAt(az * 0.95 + sweep * 0.6, 0.38, 0.03), headAt(az + sweep, (0.38 + tipEl) / 2, 0.024), headAt(az + sweep * 1.3, tipEl, 0.012)];
      const d = dirOf(az, 0.4); clump('bang' + k, pts, (k % 2 ? 0.026 : 0.034) + r() * 0.008, 0.0015, 0.22, [d.x, d.y, d.z]);
    }
    // 옆 · 뒷머리: 귀를 덮고 턱선까지, 뒤는 목덜미까지 뻗친 결
    for (let k = 0; k < 24; k++) {
      const az = (k / 24) * TAU + Math.PI * 0.5 + 0.13, w = Math.cos(az); if (w > 0.55) continue;
      const tipEl = -0.75 + 0.1 * Math.max(0, -w) + (r() - 0.5) * 0.1, flick = (r() - 0.5) * 0.12;
      const pts = [headAt(az, 0.7, 0.02), headAt(az, 0.15, 0.03), headAt(az, -0.35, 0.036), headAt(az + flick, tipEl, 0.034 + 0.02 * Math.max(0, -w)), headAt(az + flick * 1.5, tipEl - 0.08, 0.05 + 0.03 * Math.max(0, -w))];
      const d = dirOf(az, 0); clump('side' + k, pts, 0.042, 0.004, 0.28, [d.x, 0, d.z]);
    }
  }
  // 투구: 깃 비늘 금 모자 + 정수리 볏 + 부리 챙 + 이마 보석 + 양옆 큰 깃 날개
  {
    const hl = (az) => { const w = Math.cos(az); return w > 0 ? 0.42 + 0.12 * w * w : 0.3 - 0.4 * w * w; };
    const capPt = (az, v, off, p) => { const e0 = hl(az), el = e0 + (Math.PI / 2 - e0) * v; return headAt(az, el, off, p); };
    add(H, C('helm', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI; capPt(az, v, 0.026 + 0.008 * smooth(0, 0.5, v), p); }, 64, 16, { closedU: true, poles: [16], uvU: 4 })), M.scale);
    rim(H, 'helmRim', Array.from({ length: 64 }, (_, i) => capPt((i / 64) * TAU, 0, 0.03, new V3())), 0.005, true);
    // 정수리 볏: 앞에서 뒤로 솟은 금 능선
    { const pts = []; for (let i = 0; i <= 12; i++) { const el = 0.55 + (Math.PI - 0.55 - 0.7) * (i / 12); const p = headAt(0, Math.min(el, Math.PI / 2), 0.034, new V3()); if (el > Math.PI / 2) { headAt(Math.PI, Math.PI - el, 0.034, p); } p.y += 0.012 * Math.sin((i / 12) * Math.PI); pts.push(p); }
      add(H, C('crest', () => strand(pts, 0.012, 0.005, { seg: 30, rad: 8, flat: 0.35, ref: [1, 0, 0] })), M.gold); }
    // 부리 챙: 이마에서 앞 아래로 휜 금 부리
    { const a = headAt(0, 0.85, 0.03), b = headAt(0, 0.58, 0.044), c = headAt(0, 0.42, 0.06).add(new V3(0, 0, 0.012)), d = headAt(0, 0.3, 0.06).add(new V3(0, -0.008, 0.036));
      add(H, C('beak', () => strand([a, b, c, d], 0.05, 0.003, { seg: 24, rad: 12, flat: 0.32, ref: [0, 1, 0], ease: (v) => v * v })), M.gold);
      add(H, C('beakEdge', () => strand([b, c, d].map((q) => q.clone().add(new V3(0, -0.006, 0.004))), 0.004, 0.001, { seg: 16, rad: 5 })), M.goldD);
      // 이마 양옆으로 뒤로 뻗는 금 눈썹 날개
      for (const s of [-1, 1]) add(H, C('brow' + s, () => strand([headAt(s * 0.15, 0.48, 0.034), headAt(s * 0.6, 0.42, 0.036), headAt(s * 1.05, 0.38, 0.036), headAt(s * 1.4, 0.44, 0.04)], 0.012, 0.004, { seg: 20, rad: 6, flat: 0.4, ref: [0, 1, 0] })), M.gold);
      gemAt(H, headAt(0, 0.66, 0.05).toArray(), 0.014, [1, 1.2, 0.6]); }
    // 양옆 큰 깃 날개: 관자놀이에서 뒤 · 위로 휘날림 (주황 · 금)
    for (const s of [-1, 1]) {
      const root = headAt(s * 1.25, 0.32, 0.03);
      for (let k = 0; k < 7; k++) {
        const t = k / 6, L = 0.2 + 0.16 * Math.sin(t * Math.PI * 0.85 + 0.25), dir = [s * (0.55 - 0.25 * t), -0.12 + 0.5 * t, -1];
        feather(H, L, 0.034 - 0.004 * t, 0.12, root.clone().add(new V3(s * 0.006 * k, 0.012 * k, -0.01 * k)).toArray(), dir, [s, 0.2, 0]);
      }
      // 뿌리를 덮는 둥근 금 장식 + 보석
      add(H, C('wingRoot', () => new THREE.SphereGeometry(0.03, 16, 12)), M.gold, root.toArray(), [0, 0, 0], [0.55, 1, 1]);
      gemAt(H, root.clone().add(new V3(s * 0.017, 0, 0)).toArray(), 0.012, [0.5, 1, 1]);
    }
  }

  /* ---------- 천 물리: 긴 청록 망토 (어깨 → 발목) · 앞 청록 자락 / 로프: 목도리 꼬리 둘 ---------- */
  for (const [s, len] of [[1, 9], [-1, 7]]) {
    const rope = new Rope(len, 0.06, { damp: 0.975, stiff: 0.12 }), view = new RopeTube(rope, M.scarf, { sub: 2, rad: 8, flat: 0.2, side: new V3(1, 0, 0), prof: (v) => 0.034 * (1 - 0.25 * v) });
    m.ropes.push({ rope, view, joint: J.chest, local: new V3(0.045 + s * 0.022, 0.235, 0.105), rest: new V3(0.15 + s * 0.1, -1, 0.35).normalize(), sideL: new V3(1, 0, 0) });
  }
  let cloak = null, tabard = null;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    cloak = new Cloth(scene, 9, 16, 1.18, M.cloak); tabard = new Cloth(scene, 5, 12, 0.6, M.tabard);
    for (const c of [cloak, tabard]) extras.push(c.mesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const c of [cloak, tabard]) if (c) c.mesh.geometry.dispose(); cloak = tabard = null; m._attached = false; };
  m.resetCloth = () => { for (const c of [cloak, tabard]) if (c) c.ok = false; for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 무기: 황금 장대 · 초승달 갈고리 날 · 바퀴 칼날 ---------- */
  const staff = new THREE.Group(); J.weapon.add(staff); m.glaive = staff; m.staff = staff;
  {
    const X = [Math.PI / 2, 0, 0];
    const len = WP.head - WP.butt;
    add(staff, C('st:shaft', () => new THREE.CylinderGeometry(0.0155, 0.0155, len, 18, 1, true)), M.gold, [0, 0, (WP.head + WP.butt) / 2], X);
    add(staff, C('st:grip1', () => new THREE.CylinderGeometry(0.019, 0.019, 0.24, 18, 1, true)), M.grip, [0, 0, 0], X);
    add(staff, C('st:grip2', () => new THREE.CylinderGeometry(0.019, 0.019, 0.2, 18, 1, true)), M.grip, [0, 0, WP.grip2], X);
    const band = C('st:band', () => lathe([[0.0155, -0.014], [0.021, -0.01], [0.023, 0], [0.021, 0.01], [0.0155, 0.014]], 20));
    for (const z of [-0.45, -0.13, 0.13, WP.grip2 - 0.11, WP.grip2 + 0.11, 0.8]) add(staff, band, M.goldD, [0, 0, z], X);
    // 위 끝: 깃 모양 소켓 + 보석 → 초승달 갈고리
    add(staff, C('st:socket', () => lathe([[0.016, 0], [0.02, 0.03], [0.017, 0.06], [0.028, 0.1], [0.024, 0.13], [0.012, 0.145]], 20)), M.gold, [0, 0, WP.head - 0.02], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) add(staff, C('st:sockF', () => { const g = featherGeo(0.11, 0.016, 0.3); return g; }), M.gold, [0, 0, WP.head + 0.05], [0, 0, 0]).quaternion.setFromRotationMatrix(_m4.lookAt(new V3(Math.cos(i * TAU / 4) * 0.5, Math.sin(i * TAU / 4) * 0.5, -1), new V3(), new V3(0, 0, 1)));
    gemAt(staff, [0, 0, WP.head + 0.13], 0.02, [1, 1, 1.4]);
    // 초승달 갈고리 날: 소켓 위에서 위로 솟아 +y 쪽으로 크게 휘어 끝이 손잡이 쪽을 향한다
    const hookG = C('st:hook', () => {
      const R = WP.hookR, zc = WP.hookC, yc = 0.115, aB = -Math.PI + Math.asin(yc / R), aE = aB + 4.55, N = 40, out = [], inn = [];
      for (let i = 0; i <= N; i++) { const t = i / N, a = aB + (aE - aB) * t, w = (0.075 * (t < 0.12 ? 0.7 + 0.3 * t / 0.12 : 1) * Math.pow(1 - smooth(0.45, 1, t), 0.8)) + 0.002;
        const ro = R + w * 0.25, ri = R - w * 0.75; out.push([zc + Math.cos(a) * ro, yc + Math.sin(a) * ro]); inn.push([zc + Math.cos(a) * ri, yc + Math.sin(a) * ri]); }
      const sh = new THREE.Shape(); sh.moveTo(...out[0]); for (let i = 1; i < out.length; i++) sh.lineTo(...out[i]); for (let i = inn.length - 1; i >= 0; i--) sh.lineTo(...inn[i]); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -0.003); g.rotateY(-Math.PI / 2); return g;
    });
    add(staff, hookG, M.blade);
    // 날 안쪽 빛나는 날선
    add(staff, C('st:hookEdge', () => { const R = WP.hookR, zc = WP.hookC, yc = 0.115, aB = -Math.PI + Math.asin(yc / R), pts = []; for (let i = 0; i <= 30; i++) { const t = 0.05 + 0.92 * i / 30, a = aB + 4.55 * t, w = 0.075 * Math.pow(1 - smooth(0.45, 1, t), 0.8) + 0.002, ri = R - w * 0.75 + 0.002; pts.push(new V3(0, yc + Math.sin(a) * ri, zc + Math.cos(a) * ri)); } return strand(pts, 0.0028, 0.0008, { seg: 60, rad: 5 }); }), M.edge);
    // 갈고리 뿌리 금 장식 + 청록 보석 · 위 끝 짧은 가시
    gemAt(staff, [0, 0.03, WP.hookC - 0.04], 0.016, [0.6, 1, 1]);
    add(staff, C('st:topSpike', () => lathe([[0.014, 0], [0.012, 0.05], [0.006, 0.11], [0, 0.16]], 12)), M.gold, [0, 0, WP.head + 0.14], [Math.PI / 2, 0, 0]);
    // 아래 끝: 바퀴 칼날 (장대와 같은 평면에 선 고리 · 바람개비 날 넷 · 청록 보석)
    const wheel = new THREE.Group(); wheel.position.set(0, 0, WP.wheel); wheel.rotation.y = -Math.PI / 2; staff.add(wheel); m.wheel = wheel;
    const R = WP.wheelR;
    add(wheel, C('wh:ring', () => new THREE.TorusGeometry(R, 0.016, 10, 48)), M.gold, [0, 0, 0], [0, 0, 0], [1, 1, 0.55]);
    add(wheel, C('wh:ring2', () => new THREE.TorusGeometry(R * 0.66, 0.008, 8, 40)), M.goldD);
    add(wheel, C('wh:hub', () => new THREE.CylinderGeometry(0.036, 0.036, 0.022, 20)), M.gold, [0, 0, 0], X);
    gemAt(wheel, [0, 0, 0], 0.024, [1, 1, 0.9]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      add(wheel, C('wh:spoke', () => strand([[0.03, 0, 0], [R * 0.4, 0.004, 0], [R * 0.66, 0, 0]], 0.007, 0.005, { seg: 8, rad: 6, flat: 0.5, ref: [0, 0, 1] })), M.gold, [0, 0, 0], [0, 0, a]);
      // 바깥 날: 고리에서 바깥으로 휘어 나간 갈고리 날
      add(wheel, C('wh:blade', () => { const sh = new THREE.Shape(), N = 16, o = [], n = [];
        for (let k = 0; k <= N; k++) { const t = k / N, aa = -0.15 + 1.25 * t, ro = R + 0.01 + 0.1 * Math.pow(t, 1.3), ri = R + 0.004; o.push([Math.cos(aa) * ro, Math.sin(aa) * ro]); n.push([Math.cos(aa) * ri, Math.sin(aa) * ri]); }
        sh.moveTo(...n[0]); for (const q of o) sh.lineTo(...q); for (let k = n.length - 1; k >= 0; k--) sh.lineTo(...n[k]); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 1, curveSegments: 4 }); g.translate(0, 0, -0.003); return g; }), M.blade, [0, 0, 0], [0, 0, a]);
      // 고리 안쪽 청록 보석 판
      add(wheel, C('wh:gem', () => { const sh = new THREE.Shape(), N = 10; for (let k = 0; k <= N; k++) { const aa = 0.25 + 0.7 * k / N; const p = [Math.cos(aa) * R * 0.9, Math.sin(aa) * R * 0.9]; if (k) sh.lineTo(...p); else sh.moveTo(...p); } for (let k = N; k >= 0; k--) { const aa = 0.25 + 0.7 * k / N, rr = R * (0.72 + 0.06 * Math.sin(Math.PI * k / N)); sh.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }); g.translate(0, 0, -0.004); return g; }), M.gem, [0, 0, 0], [0, 0, a]);
    }
    // 장대가 바퀴에 꽂히는 목
    add(staff, C('st:neckB', () => lathe([[0.016, 0], [0.024, -0.02], [0.02, -0.035], [0.018, -0.04]], 16)), M.gold, [0, 0, WP.butt], [-Math.PI / 2, 0, 0]);
  }

  /* ---------- 매 프레임 ---------- */
  const tS = new V3(), tT = new V3(), tE = new V3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), dn = new V3(0, -1, 0), tmp = new V3(), tmp2 = new V3(), rq = new THREE.Quaternion(), cq = new THREE.Quaternion();
  m.ikW = 1; m.glow = 0; m.trailButt = false;
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    // 왼손은 장대를 잡는다 (기술마다 ikOff 로 끌 수 있음)
    const want = f.state === 'act' ? (f.act.ikOff ? 0 : 1) : (f.state === 'guard' || (f.state === 'idle' && !(f.idleT > 4)) || f.state === 'run' || f.state === 'crouch') ? 1 : 0;
    m.ikW += (want - m.ikW) * Math.min(1, dt * 14);
    if (m.ikW > 0.02) {
      J.chest.updateMatrixWorld(true); J.weapon.updateMatrixWorld(true);
      J.shoulderL.getWorldPosition(tS); J.weapon.localToWorld(tT.set(0, 0, WP.grip2));
      const L1 = DIMS.uArm * sc, L2 = DIMS.lArm * sc, natural = J.handL.getWorldPosition(new V3()); tT.lerp(natural, 1 - m.ikW);
      const d = clamp(tT.distanceTo(tS), 0.05, L1 + L2 - 0.002), dir = tT.clone().sub(tS).normalize(), a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const hint = new V3(0, -1, 0).addScaledVector(f.fwd(new V3()), -0.3).add(f.right(new V3()).multiplyScalar(-0.5)), n = hint.addScaledVector(dir, -hint.dot(dir)).normalize();
      tE.copy(tS).addScaledVector(dir, a).addScaledVector(n, h);
      J.shoulderL.parent.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tE.clone().sub(tS).normalize()); J.shoulderL.quaternion.copy(q0.clone().invert().multiply(q1)); J.shoulderL.updateMatrixWorld(true);
      J.shoulderL.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tT.clone().sub(tE).normalize()); J.elbowL.quaternion.copy(q0.clone().invert().multiply(q1)); J.elbowL.updateMatrixWorld(true);
    }
    J.chest.updateMatrixWorld(true);
    const wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 1.0, Math.max(0, -f.vel.y) * 0.6, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 1.0];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.06 * sc })), h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.12), r: h0.r * 0.78 + 0.06 * sc };
    const hp = J.hips.getWorldPosition(new V3()), s1 = hp.clone().add(new V3(0, -0.1 * sc, 0));
    const caps = [torso, ...legs, { a: s1, b: s1, r: 0.2 * sc }];
    // 망토: 등 위쪽 (왼 어깨 → 오른 어깨) 에 고정
    if (cloak) { const W = cloak.W; for (let i = 0; i < W; i++) { const u = i / (W - 1), x = 0.17 - 0.34 * u; J.chest.localToWorld(cloak.anchors[i].set(x, 0.235 - 0.04 * Math.abs(x) / 0.17, -0.1 - 0.035 * (1 - (x / 0.17) ** 2))); }
      cloak.len = 1.18 * sc; cloak.mesh.visible = vis; cloak.step(dt, caps, f.pos.y + 0.02, wind); }
    // 앞 자락: 허리띠 앞에 고정
    if (tabard) { const W = tabard.W; for (let i = 0; i < W; i++) { const a = 0.43 + 0.14 * (i / (W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0.2, tabard.anchors[i]).multiplyScalar(1.1)); }
      tabard.len = 0.6 * sc; tabard.mesh.visible = vis; tabard.step(dt, [...legs, { a: s1, b: s1, r: 0.17 * sc }], f.pos.y + 0.02, wind); }
    // 목도리 꼬리
    const hc = J.head.localToWorld(tmp2.copy(HC)), capsB = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.6 + 0.02 * sc }, { a: hc, b: hc.clone(), r: 0.1 * sc }];
    J.chest.getWorldQuaternion(cq); m.root.getWorldQuaternion(rq); const windV = new V3(-f.vel.x * 0.6, -f.vel.y * 0.3, -f.vel.z * 0.6);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); r.view.side.copy(r.sideL).applyQuaternion(cq);
      r.rope.step(dt, tmp, capsB, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.view.mesh.visible = vis;
    }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림 / 깃 게이지 · 기술 중 → 보석 · 날 빛
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    const wantG = Math.max(f.windK || 0, (f.feather || 0) >= 100 ? 0.8 : 0.15); m.glow += (wantG - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.9 + 0.1 * Math.sin(f.G.time * 6);
    M.gem.emissiveIntensity = (0.9 + m.glow * 1.4) * pulse; M.blade.emissiveIntensity = 0.25 + m.glow * 0.9 * pulse; M.edge.opacity = 0.45 + m.glow * 0.5; M.eyeGlow.opacity = m.glow > 0.5 ? (m.glow - 0.5) * 0.5 : 0;
    m.wheel.visible = !f.wheelOut;
    for (const o of extras) o.visible = vis;
  };
  m.setWeapon = (v) => { staff.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.078;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 판정: 바퀴 끝 ~ 갈고리 끝 (장대 전체) / 궤적: 갈고리 (trailButt 이면 바퀴 쪽)
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, WP.wheel - WP.wheelR)); J.weapon.localToWorld(t.set(0, 0.1, WP.hookC + WP.hookR)); };
  m.trailPts = (b, t) => { if (m.trailButt) { J.weapon.localToWorld(b.set(0, 0, WP.butt + 0.05)); J.weapon.localToWorld(t.set(0, 0, WP.wheel - WP.wheelR - 0.04)); } else { J.weapon.localToWorld(b.set(0, 0, WP.head)); J.weapon.localToWorld(t.set(0, 0.12, WP.hookC + WP.hookR + 0.02)); } };
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0.12, WP.hookC + WP.hookR)); };
  m.wheelPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, WP.wheel)); };
  m.extras = extras;
  return m;
}
