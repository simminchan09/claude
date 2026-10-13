// 단비 (MUDANG · 경계의 무당) — 3D 모델 (기술·포즈는 mudang.js)
// 기억과 경계의 의식을 치르는 현대 무당.
//
// 구성: 부스스한 검은 머리(아호게 · 얼굴 옆으로 길게 내린 두 가닥 + 옆 가닥: 로프 물리) · 작은 붉은 머리끈 · 녹색 눈 · 볼의 붉은 무늬
//       뾰족한 흰 후드(붉은 점선 테두리 · 끈 끝에 금 호리병 두 개: 로프 물리) · 큰 흰 패딩 점퍼(누빔 · 앞섶이 열림 · 부푼 소매 · 시보리 소매단)
//       회색 반소매 상의 + 파란 깃 · 가슴의 흰 붕대 · 길게 늘어진 붉은 넥타이(로프 물리)
//       흰·파랑 허리띠 + 색동 구슬 줄 · 청록 밑단 검은 주름치마(다리를 따라 출렁임) · 오색 복주머니 + 붉은 노리개 술
//       왼 허벅지 가터(파랑 · 붉은 매듭) · 흰 양말 · 흰·검정 청키 운동화(붉은 뒤축) · 손가락 없는 검은 장갑 · 검은 백팩(붉은 동그라미)
//       무기: 무구 방울 (나무 자루 · 놋쇠 방울 송이) + 오색 천(로프 물리) · 왼손 부적(기술 때만)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.84, spineL: 0.18, chestL: 0.25, neckL: 0.068, shW: 0.18, uArm: 0.265, lArm: 0.24, hipW: 0.086, thigh: 0.41, shin: 0.4, headTop: 0.27 };
// 방울 치수 (오른손 기준 +Z): 자루 끝(오색 천) · 방울 송이 끝
export const BL = { butt: -0.09, neck: 0.14, top: 0.27 };
export const GOLDB = 0xffc84a, REDM = 0xe0303a, TEAL = 0x3ad8c0, PAPER = 0xfff2b0, OBANG = [0x2a5ad8, 0xe0303a, 0xf4c430, 0x2aa860, 0xf4f2ea];
const C = (k, fn) => cached('mud:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 검은 머리: 푸른 윤기 + 결 (strand uv v: 뿌리 0 → 끝 1)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(17), gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, cap ? '#141416' : '#1c1c22'); gr.addColorStop(1, '#0f0f14'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.5 ? 'rgba(0,0,0,0.5)' : k < 0.85 ? 'rgba(60,62,72,0.35)' : 'rgba(140,144,160,0.22)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 16, H / 2, x + (r() - 0.5) * 10, 0); g.stroke(); }
  if (!cap) { g.globalAlpha = 0.3; g.fillStyle = '#8a8e9e'; const y0 = H * 0.78; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - 6 - r() * 16); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + 4 + r() * 10); g.closePath(); g.fill(); g.globalAlpha = 1; }
  return tex(c);
}
// 회색 상의 + 가슴 흰 붕대 (loft uv: u 0 = 뒤 · 0.5 = 앞, v 0 = 아래 = 캔버스 아래)
function topTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H), r = rng(5); g.fillStyle = '#8e9198'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2, 2); }
  // 붕대: 가슴을 가로로 감은 흰 천 (조금씩 비스듬히 겹침)
  for (let k = 0; k < 7; k++) { const y = H * (0.2 + k * 0.075), sk = (k % 2 ? 1 : -1) * 10; g.fillStyle = k % 2 ? '#f4f2ec' : '#e8e6e0'; g.beginPath(); g.moveTo(0, y + sk); g.lineTo(W, y - sk); g.lineTo(W, y - sk + 40); g.lineTo(0, y + sk + 40); g.closePath(); g.fill(); g.strokeStyle = 'rgba(150,150,160,0.6)'; g.lineWidth = 2; g.stroke(); }
  return tex(c);
}
// 허리띠: 흰 바탕 · 위아래 파랑 · 가운데 색동 구슬 줄
function beltTex() {
  const W = 1024, H = 128, [c, g] = cv(W, H); g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a44b0'; g.fillRect(0, 0, W, 26); g.fillRect(0, H - 26, W, 26); g.fillStyle = '#5a7ae0'; g.fillRect(0, 8, W, 4); g.fillRect(0, H - 12, W, 4);
  const cols = ['#e0303a', '#f4c430', '#2a5ad8', '#2aa860', '#f08a20'];
  for (let i = 0; i < 64; i++) { const x = (i + 0.5) * W / 64; g.fillStyle = '#7a1418'; g.beginPath(); g.ellipse(x, H / 2, 7.5, 14, 0, 0, TAU); g.fill(); g.fillStyle = cols[i % 5]; g.beginPath(); g.ellipse(x, H / 2, 6, 12, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 2, H / 2 - 8, 2, 6); }
  return tex(c, [2, 1]);
}
// 주름치마: 검정 + 주름 음영 + 청록 밑단 두 줄 (캔버스 위 = 밑단 v 1)
function skirtTex() {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.fillStyle = '#17171c'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.9, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0.06)'); g.fillStyle = gr; g.fillRect(x, 0, 32, H); }
  g.fillStyle = '#3ac8b0'; g.fillRect(0, 0, W, 34); g.fillStyle = '#f4f2ec'; g.fillRect(0, 38, W, 5); g.fillStyle = '#3ac8b0'; g.fillRect(0, 48, W, 16); g.fillStyle = '#1a7a6a'; g.fillRect(0, 30, W, 4);
  return tex(c);
}
// 가터: 파랑 · 흰 줄 · 붉은 마름모
function garterTex() {
  const W = 256, H = 64, [c, g] = cv(W, H); g.fillStyle = '#2a44b0'; g.fillRect(0, 0, W, H); g.fillStyle = '#f4f2ec'; g.fillRect(0, 26, W, 12);
  g.fillStyle = '#e0303a'; for (let i = 0; i < 8; i++) { const x = (i + 0.5) * W / 8; g.beginPath(); g.moveTo(x, 22); g.lineTo(x + 6, 32); g.lineTo(x, 42); g.lineTo(x - 6, 32); g.closePath(); g.fill(); }
  return tex(c, [2, 1]);
}
// 양말: 흰색 + 골지
function sockTex() { const W = 128, H = 64, [c, g] = cv(W, H); g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 8) { g.fillStyle = 'rgba(160,165,180,0.25)'; g.fillRect(x, 0, 3, H); } return tex(c, [3, 1]); }
// 운동화 갑피: 흰 바탕 · 아래쪽 검정 · 옆 검정 사선 · 뒤축 붉은 탭 (surf uv: u 0 = 바닥 · 0.25 왼옆 · 0.5 위 · 0.75 오른옆, v 뒤꿈치 → 앞코 = 캔버스 아래 → 위)
function shoeTex() {
  const W = 512, H = 512, [c, g] = cv(W, H); g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#18181c'; g.fillRect(0, 0, W * 0.13, H); g.fillRect(W * 0.87, 0, W * 0.13, H);
  for (const [a, b] of [[0.12, 0.38], [0.62, 0.88]]) for (let k = 0; k < 4; k++) { const y0 = H * (0.25 + k * 0.16); g.beginPath(); g.moveTo(W * a, y0); g.lineTo(W * b, y0 - 50); g.lineTo(W * b, y0 - 20); g.lineTo(W * a, y0 + 30); g.closePath(); g.fill(); }
  g.fillStyle = '#d8283a'; g.fillRect(W * 0.38, H - 70, W * 0.24, 70); g.fillRect(W * 0.2, H - 34, W * 0.6, 12);
  g.fillStyle = '#c8c8cc'; g.fillRect(0, 0, W, 30); // 앞코 고무
  return tex(c);
}
// 백팩: 검정 + 회색 지퍼 두 줄
function packTex() { const W = 256, H = 256, [c, g] = cv(W, H); g.fillStyle = '#1a1a20'; g.fillRect(0, 0, W, H); g.fillStyle = '#6a6c76'; g.fillRect(0, H * 0.35, W, 6); g.fillRect(0, H * 0.55, W, 6); g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2); return tex(c); }
// 후드 테두리 끈: 붉은 · 흰 점선 (strand uv v = 길이)
function dashTex() { const [c, g] = cv(16, 64); g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 16, 64); g.fillStyle = '#d8283a'; g.fillRect(0, 0, 16, 40); return tex(c, [1, 60]); }
// 복주머니: 오색 쪽 (lathe uv u = 둘레)
function pouchTex() { const W = 512, H = 128, [c, g] = cv(W, H), cols = ['#e0303a', '#f4c430', '#2a5ad8', '#f4f2ec', '#e0303a', '#2a5ad8']; cols.forEach((k, i) => { g.fillStyle = k; g.fillRect(i * W / 6, 0, W / 6 + 1, H); }); g.fillStyle = '#18181c'; g.fillRect(0, H - 22, W, 22); g.fillStyle = '#f4c430'; g.fillRect(0, H - 26, W, 4); return tex(c); }
// 부적: 노란 종이 + 붉은 부문(符文) · 도장
export function talismanTex() {
  const W = 128, H = 320, [c, g] = cv(W, H), r = rng(77); g.fillStyle = '#f4d040'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c81e1e'; g.lineWidth = 4; g.strokeRect(8, 8, W - 16, H - 16); g.lineWidth = 6; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const y = 40 + k * 60; g.beginPath(); g.moveTo(W / 2 - 30, y); g.lineTo(W / 2 + 30, y + 6); g.moveTo(W / 2, y - 14); g.quadraticCurveTo(W / 2 + 20 * (r() - 0.5), y + 20, W / 2 - 18, y + 36); g.moveTo(W / 2 + 6, y + 14); g.lineTo(W / 2 + 26, y + 34); g.stroke(); }
  g.fillStyle = '#c81e1e'; g.fillRect(W / 2 - 22, H - 64, 44, 44); g.fillStyle = '#f4d040'; g.font = 'bold 30px serif'; g.textAlign = 'center'; g.fillText('勅', W / 2, H - 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------- 얼굴: 실제 비율 · 무표정 · 녹색 눈 · 볼의 붉은 무늬 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.071, 0.1, 0.089], jaw: 0.32 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  g.fillStyle = '#fae2d8'; g.fillRect(0, 0, W, H);
  const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,248,244,0.55)'); gr.addColorStop(0.6, 'rgba(255,236,230,0)'); gr.addColorStop(1, 'rgba(190,140,140,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,130,0)'); cg.addColorStop(1, 'rgba(190,130,120,0.4)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  // 볼의 붉은 무늬: 눈 밑 바깥쪽에 짧은 붉은 선 두 줄 (의식 화장)
  g.strokeStyle = 'rgba(205,40,48,0.85)'; g.lineCap = 'round'; g.lineWidth = 5;
  for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) { const x0 = sd * (0.034 + k * 0.007), y0 = Y.eyeY - 0.016 - k * 0.003, [ax, ay] = M(x0, y0), [bx, by] = M(x0 + sd * 0.004, y0 - 0.014); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
  paintFace(g, M, { ...Y, tilt: 0.04, lidDrop: 0.05, open, iris: ['#c8f8c8', '#3ab070', '#0e5a32', '#06301a'], pupil: '#04140a', lash: '#121014', brow: '#1a161c' });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const coat = pal.coat ?? 0xf6f7f9, tieC = pal.tie ?? REDM;
  const M = {
    skin: phys({ color: 0xfbe2d6, emissive: 0x7a5650, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    face: phys({ map: T('face', () => faceTex(false)), emissiveMap: T('face', () => faceTex(false)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8cc) }),
    faceO: phys({ map: T('faceO', () => faceTex(true)), emissiveMap: T('faceO', () => faceTex(true)), emissive: 0x6a5652, emissiveIntensity: 1, roughness: 0.5 }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.42, sheen: 0.7, sheenColor: new THREE.Color(0x606878), sheenRoughness: 0.35 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.45, sheen: 0.7, sheenColor: new THREE.Color(0x585e70), sheenRoughness: 0.35 }),
    puff: phys({ color: coat, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5, emissive: 0x30343c, emissiveIntensity: 0.25 }),
    puffIn: phys({ color: 0xd8dce4, roughness: 0.7 }),
    rib: phys({ color: 0xe4e6ea, roughness: 0.8 }),
    top: phys({ map: T('top', topTex), roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xc0c4d0) }),
    blue: phys({ color: 0x2a44b0, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0x8aa0ff) }),
    belt: phys({ map: T('belt', beltTex), roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    skirt: phys({ map: T('skirt', skirtTex), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x50506a) }),
    black: phys({ color: 0x16161b, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0x50506a) }),
    glove: phys({ color: 0x18181d, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0x60606a) }),
    red: phys({ color: tieC, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xff9aa0) }),
    redD: phys({ color: 0xa81822, roughness: 0.55 }),
    trim: phys({ map: T('dash', dashTex), roughness: 0.6 }),
    garter: phys({ map: T('gart', garterTex), roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xaabbff) }),
    sock: phys({ map: T('sock', sockTex), roughness: 0.75 }),
    shoe: phys({ map: T('shoe', shoeTex), roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    sole: phys({ color: 0xf0f0ee, roughness: 0.6 }),
    pack: phys({ map: T('pack', packTex), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
    pouch: phys({ map: T('pouch', pouchTex), roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    gold: phys({ color: 0xe8b850, metalness: 1, roughness: 0.25, clearcoat: 0.4, emissive: 0x000000 }),
    goldD: phys({ color: 0xb08838, metalness: 1, roughness: 0.34 }),
    brass: phys({ color: 0xd8a848, metalness: 1, roughness: 0.22, clearcoat: 0.5, emissive: 0x6a4010, emissiveIntensity: 0 }),
    wood: phys({ color: 0x4a2a18, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    nail: phys({ color: 0xf0c0c0, roughness: 0.25, clearcoat: 1 }),
    paper: new THREE.MeshStandardMaterial({ map: T('tal', talismanTex), side: THREE.DoubleSide, roughness: 0.8, emissive: 0x6a5010, emissiveIntensity: 0.3 }),
    ribbon: OBANG.map((c) => phys({ color: c, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.4 })),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const tassel = (parent, key, p, len = 0.07, mat = M.red, r = 0.012, bead = M.gold) => { // 매듭 + 구슬 + 술
    const g = new THREE.Group(); g.position.set(...p); parent.add(g);
    add(g, C('tbead', () => new THREE.SphereGeometry(0.009, 12, 10)), bead);
    add(g, C('tas' + key, () => lathe([[0.002, -0.006], [r * 0.7, -0.014], [r, -0.03], [r * 1.1, -len * 0.7], [r * 1.25, -len], [0, -len]], 14)), mat);
    return g;
  };
  // 누빔: 높이 방향으로 n 줄의 부푼 관 (이음매는 오므라듦)
  const quilt = (n, amp) => (p, u, v, c, sn, s) => { const k = 1 + amp * (Math.pow(Math.abs(Math.sin(Math.PI * v * n)), 0.45) - 0.75); p.x = (s.cx || 0) + (p.x - (s.cx || 0)) * k; p.z = (s.cz || 0) + (p.z - (s.cz || 0)) * k; };
  // 앞섶이 열린 점퍼 판: u 0 → 1 이 왼쪽 앞섶 → 등 → 오른쪽 앞섶, gap(v) = 앞 트임 반폭 (u 단위)
  const openSurf = (prof, gap, mod) => (u, v, p) => { const g = gap(v), a = 0.5 + g + (1 - 2 * g) * u; return loftAt(prof, a, v, p, mod); };
  m.ropes = []; m.ends = [];
  m.skirt = []; // 다리를 따라 출렁이는 메시 (골반 기준)

  /* ---------- 골반(검은 반바지) · 주름치마 · 하이웨이스트 · 허리띠 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: 0.09 - 0.2 * v, rx: 0.116 + 0.024 * v, rzF: 0.084, rzB: 0.096, n: 2.2 }), 28, 6)), M.black);
  const SK_L = 0.25, skR = (d) => { const t = d / SK_L, e = t * t * (1.7 - 0.7 * t); return { rx: 0.14 + 0.07 * e, rzF: 0.112 + 0.065 * e, rzB: 0.122 + 0.07 * e }; };
  const skP = (v) => ({ y: 0.04 - SK_L * v, ...skR(SK_L * v), n: 2.1 });
  const pleat = (n, amp) => (p, u, v) => { const f = u * n - Math.floor(u * n), w = f < 0.8 ? f / 0.8 : (1 - f) / 0.2, k = 1 + amp * (w - 0.5) * smooth(0.0, 0.5, v); p.x *= k; p.z *= k; }; // 한쪽으로 접힌 칼주름
  m.skirt.push(add(J.hips, C('skirt', () => loft(skP, 192, 10, { mod: pleat(28, 0.05) })), M.skirt));
  const bX = spl([[0, 0.114], [0.45, 0.09], [1, 0.104]]), bF = spl([[0, 0.078], [0.5, 0.068], [1, 0.076]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.15 }), 40, 12)), M.top);
  // 하이웨이스트: 배를 덮는 치마 윗부분 (허리 관절 위)
  const hwP = (v) => { const y = -0.1 + 0.21 * v, w = clamp((y + 0.035) / 0.24, 0, 1); return { y, rx: bX(w) + 0.01 + 0.02 * (1 - v), rzF: bF(w) + 0.01 + 0.03 * (1 - v), rzB: 0.088 + 0.03 * (1 - v), n: 2.2 }; };
  add(J.spine, C('hiwaist', () => loft(hwP, 64, 6)), M.skirt);
  const beltP = (v) => { const y = 0.1 + 0.05 * v, w = clamp((y + 0.035) / 0.24, 0, 1); return { y, rx: bX(w) + 0.014, rzF: bF(w) + 0.016, rzB: 0.094, n: 2.3 }; };
  add(J.spine, C('belt', () => loft(beltP, 64, 3, { uvU: 1 })), M.belt);
  // 붉은 노리개 술 (허리띠 왼쪽 앞) · 오색 복주머니 (오른쪽 허리)
  { const p = loftAt(beltP, 0.36, 0.2, new V3()); const tg = tassel(J.spine, 'N', [p.x, p.y, p.z + 0.01], 0.13, M.red, 0.013); tg.rotation.z = 0.08;
    add(tg, C('norK', () => new THREE.TorusKnotGeometry(0.012, 0.004, 32, 6, 2, 3)), M.red, [0, -0.012, 0.006]); }
  { const g = new THREE.Group(); g.position.set(-0.165, -0.03, 0.08); g.rotation.set(0, -0.6, 0.1); J.hips.add(g); m.pouch = g;
    add(g, C('pouch', () => lathe([[0.001, -0.06], [0.03, -0.055], [0.045, -0.035], [0.046, -0.015], [0.034, 0.004], [0.016, 0.012], [0.018, 0.022], [0.012, 0.026]], 24)), M.pouch);
    add(g, C('pouchCord', () => new THREE.TorusGeometry(0.017, 0.003, 6, 18)), M.red, [0, 0.014, 0], [Math.PI / 2, 0, 0]);
    add(g, C('pouchLoop', () => strand([[0, 0.02, 0], [0.01, 0.05, 0], [0, 0.07, 0], [-0.01, 0.05, 0], [0, 0.02, 0]], 0.0025, 0.0025, { closed: true, seg: 20, rad: 5 })), M.red);
    tassel(g, 'P', [0, -0.06, 0], 0.07, M.red, 0.01); }

  /* ---------- 상체: 회색 상의 · 가슴 붕대 · 파란 깃 ---------- */
  const chX = spl([[0, 0.104], [0.3, 0.114], [0.55, 0.122], [0.8, 0.118], [1, 0.094]]), chF = spl([[0, 0.076], [0.5, 0.086], [1, 0.07]]), chB = spl([[0, 0.078], [0.6, 0.084], [1, 0.07]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.024 * gauss(ax - 0.054, 0.04) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod, uvU: 1 })), M.top);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.12 - 0.072 * v ** 0.8, rzF: 0.072 - 0.028 * v, rzB: 0.069 - 0.026 * v }), 40, 8)), M.top);
  // 파란 V 깃: 목 옆에서 가슴 가운데로
  for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(loftAt(chP, 0.5 + s * (0.075 - 0.07 * t), 0.97 - 0.2 * t, new V3(), chMod).multiplyScalar(1.04).add(new V3(0, 0, 0.004))); } rim(J.chest, 'vcol' + s, pts, 0.008, false, M.blue); }

  /* ---------- 흰 패딩 점퍼: 가슴판 · 허리판 · 아랫단 (앞섶 열림 · 누빔) ---------- */
  const jcX = spl([[0, 0.158], [0.3, 0.166], [0.62, 0.178], [0.85, 0.17], [1, 0.11]]), jcF = spl([[0, 0.118], [0.5, 0.13], [0.85, 0.118], [1, 0.088]]), jcB = spl([[0, 0.128], [0.5, 0.14], [0.85, 0.13], [1, 0.09]]);
  const jcP = (v) => ({ y: -0.07 + 0.36 * v, rx: jcX(v), rzF: jcF(v), rzB: jcB(v), n: 2.3 });
  const jcG = (v) => 0.075 - 0.035 * v, jcS = openSurf(jcP, jcG, quilt(4, 0.07));
  add(J.chest, C('jChest', () => surf(jcS, 64, 40)), M.puff);
  const jsP = (v) => ({ y: -0.05 + 0.26 * v, rx: 0.156 + 0.004 * v, rzF: 0.118, rzB: 0.128, n: 2.3 });
  const jsG = (v) => 0.1 - 0.025 * v, jsS = openSurf(jsP, jsG, quilt(2, 0.07));
  add(J.spine, C('jSpine', () => surf(jsS, 64, 20)), M.puff);
  const JL = 0.42, jhP = (v) => { const e = v * v; return { y: 0.15 - JL * v, rx: 0.164 + 0.115 * e, rzF: 0.126 + 0.09 * e, rzB: 0.136 + 0.13 * e, n: 2.2 }; };
  const jhG = (v) => 0.1 + 0.075 * v, jhS = openSurf(jhP, jhG, quilt(3, 0.065));
  m.skirt.push(add(J.hips, C('jHips', () => surf(jhS, 72, 30)), M.puff));
  // 앞섶 가장자리 · 아랫단 (두툼한 테)
  const edgePts = (fn, u, n = 16) => { const pts = []; for (let i = 0; i <= n; i++) { const p = new V3(); fn(u, i / n, p); pts.push(p); } return pts; };
  for (const u of [0, 1]) { rim(J.chest, 'jcE' + u, edgePts(jcS, u), 0.014, false, M.puff); rim(J.spine, 'jsE' + u, edgePts(jsS, u, 8), 0.014, false, M.puff); m.skirt.push(rim(J.hips, 'jhE' + u, edgePts(jhS, u), 0.015, false, M.puff)); }
  { const pts = []; for (let i = 0; i <= 48; i++) { const p = new V3(); jhS(i / 48, 1, p); pts.push(p); } m.skirt.push(rim(J.hips, 'jhHem', pts, 0.02, false, M.puff)); }
  // 목 깃 (두툼한 스탠드 칼라 · 뒤가 높음)
  const colP = (v) => ({ y: 0.245 + 0.075 * v, rx: 0.098 - 0.01 * v, rzF: 0.09 - 0.008 * v, rzB: 0.098, n: 2.2 });
  const colS = openSurf(colP, () => 0.06, (p, u, v, c, sn) => { const k = 1 + 0.1 * Math.sin(Math.PI * v); p.x *= k; p.z *= k; p.y += 0.03 * Math.max(0, -sn) * v; });
  add(J.chest, C('jCollar', () => surf(colS, 48, 8)), M.puff);
  // 백팩: 등에 멘 검은 가방 + 어깨끈 + 붉은 동그라미 장식
  { const g = new THREE.Group(); g.position.set(0, 0.09, -0.205); J.chest.add(g); m.pack = g;
    const pkP = (v) => { const top = smooth(0.75, 1, v); return { y: -0.15 + 0.3 * v, rx: 0.12 * (1 - 0.35 * top * top), rz: 0.055 * (1 - 0.2 * top), n: 3.2 }; };
    add(g, C('pack', () => loft(pkP, 40, 14, { poles: [] })), M.pack);
    add(g, C('packB', () => { const geo = new THREE.CircleGeometry(1, 24); geo.scale(0.12, 0.055, 1); geo.rotateX(Math.PI / 2); geo.translate(0, -0.15, 0); return geo; }), M.pack);
    add(g, C('packP', () => loft((v) => ({ y: -0.12 + 0.12 * v, rx: 0.095, rz: 0.03, cz: -0.05, n: 3 }), 28, 4)), M.pack);
    add(g, C('packTop', () => new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2)), M.pack, [0, 0.148, 0], [0, 0, 0], [0.078, 0.02, 0.044]);
    add(g, C('packHandle', () => strand([[-0.03, 0.15, 0], [0, 0.185, 0], [0.03, 0.15, 0]], 0.005, 0.005, { seg: 10, rad: 6 })), M.black);
    add(g, C('packDisc', () => new THREE.CylinderGeometry(0.024, 0.024, 0.008, 20)), M.red, [-0.11, -0.04, -0.015], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) add(J.chest, C('strap' + s, () => strand([[s * 0.06, 0.24, -0.15], [s * 0.1, 0.3, -0.1], [s * 0.125, 0.315, -0.01], [s * 0.13, 0.28, 0.07], [s * 0.13, 0.22, 0.1]], 0.012, 0.012, { seg: 16, rad: 6, flat: 0.35, ref: [0, 1, 0] })), M.black); }

  /* ---------- 팔: 부푼 패딩 소매 · 시보리 · 손가락 없는 검은 장갑 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const upP = (v) => { const cap = Math.sqrt(smooth(0, 0.2, v)); return { y: 0.075 - (DIMS.uArm + 0.1) * v, rx: 0.004 + 0.074 * cap, rz: 0.004 + 0.07 * cap, cx: s * 0.006 }; };
    add(sh, C('slvU', () => loft(upP, 32, 30, { mod: (p, u, v, c, sn, q) => { if (v > 0.2) quilt(3, 0.08)(p, u, (v - 0.2) / 0.8, c, sn, q); } })), M.puff);
    const loP = (v) => { const r = (0.068 - 0.006 * v) * (1 - 0.36 * smooth(0.86, 1, v)); return { y: 0.045 - (DIMS.lArm + 0.0) * v, rx: r, rz: r * 0.96 }; };
    add(el, C('slvL', () => loft(loP, 32, 28, { mod: (p, u, v, c, sn, q) => { if (v < 0.86) quilt(3, 0.07)(p, u, v / 0.86, c, sn, q); } })), M.puff);
    const cfP = (v) => ({ y: -DIMS.lArm + 0.04 - 0.05 * v, rx: 0.042 - 0.004 * v, rz: 0.04 - 0.004 * v });
    add(el, C('cuff', () => loft(cfP, 24, 4, { mod: (p, u) => { const k = 1 + 0.03 * Math.sin(u * TAU * 16); p.x *= k; p.z *= k; } })), M.rib);
    add(el, C('wrist', () => loft((v) => ({ y: -DIMS.lArm + 0.04 - 0.05 * v, rx: 0.031, rz: 0.029 }), 16, 3)), M.glove);
    // 손: 장갑(손바닥 · 손등 검정) + 맨 손가락
    const hg = new THREE.Group(); hg.scale.setScalar(0.84); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: 0.004 - 0.075 * v, rx: 0.021 + 0.003 * Math.sin(v * Math.PI), rz: 0.034 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.glove);
    add(hg, C('ring', () => new THREE.TorusGeometry(0.009, 0.0022, 6, 14)), M.goldD, [s * 0.04, -0.03, 0.0], [0, Math.PI / 2, 0]);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.2 + k * 0.1 : 2.5;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0075, 0.006, { seg: 14, rad: 8 })), M.skin);
      add(hg, C(`fingG${s}${k}`, () => strand(pts.slice(0, 3), 0.0085, 0.0082, { seg: 6, rad: 8 })), M.glove);
      add(hg, C(`nail${s}${k}`, () => new THREE.SphereGeometry(0.0056, 8, 6)), M.nail, pts[8].toArray(), [0, 0, 0], [1, 1, 0.6]);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0092, 0.0068, { seg: 12, rad: 8 })), M.skin);
  }
  // 왼손 부적 (부적 기술을 쓸 때만 보임)
  { const g = new THREE.Group(); g.position.set(0.02, -0.07, 0.03); g.rotation.set(-0.3, 0.2, 0.2); J.handL.add(g); m.talCard = g; g.visible = false;
    add(g, C('talCard', () => { const geo = new THREE.PlaneGeometry(0.06, 0.15); geo.translate(0, -0.05, 0); return geo; }), M.paper); }

  /* ---------- 다리: 맨다리 · 왼 허벅지 가터 · 흰 양말 · 청키 운동화 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.086], [0.4, 0.076], [0.85, 0.055], [1, 0.053]]), thF = spl([[0, 0.082], [0.5, 0.068], [1, 0.053]]), thB = spl([[0, 0.084], [0.35, 0.074], [1, 0.048]]);
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12)), M.skin);
    if (s > 0) { // 가터 + 붉은 매듭 술
      const gp = (v) => { const q = thP(0.5 + 0.06 * v); return { ...q, rx: q.rx + 0.004, rzF: q.rzF + 0.004, rzB: q.rzB + 0.004 }; };
      add(hp, C('garter', () => loft(gp, 32, 3)), M.garter); lRim(hp, 'gtR0', gp, 0, 0.003, M.blue); lRim(hp, 'gtR1', gp, 1, 0.003, M.blue);
      const k = loftAt(gp, 0.42, 0.5, new V3()).multiplyScalar(1.06);
      add(hp, C('gKnot', () => new THREE.TorusKnotGeometry(0.008, 0.003, 32, 6, 2, 3)), M.red, k.toArray());
      tassel(hp, 'G', [k.x, k.y - 0.008, k.z + 0.004], 0.06, M.red, 0.008);
    }
    const cX = spl([[0, 0.052], [0.3, 0.056], [0.75, 0.036], [1, 0.031]]), cF = spl([[0, 0.05], [0.5, 0.042], [1, 0.031]]), cB = spl([[0, 0.052], [0.3, 0.07], [0.7, 0.042], [1, 0.033]]);
    const shP = (v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) });
    add(kn, C('shin', () => loft(shP, 28, 14)), M.skin);
    const skP2 = (v) => { const q = shP(0.5 + 0.5 * v); return { ...q, rx: q.rx + 0.003, rzF: q.rzF + 0.003, rzB: q.rzB + 0.003 }; };
    add(kn, C('sock', () => loft(skP2, 28, 8)), M.sock); lRim(kn, 'sockTop', skP2, 0, 0.0035, M.sock);
    // 운동화: 높은 발목 갑피 · 두툼한 흰 밑창 · 검은 끈 · 붉은 뒤축 탭
    const fw = spl([[0, 0.0], [0.05, 0.036], [0.25, 0.043], [0.6, 0.05], [0.85, 0.044], [1, 0.012]]), fh = spl([[0, 0.1], [0.1, 0.13], [0.3, 0.12], [0.5, 0.075], [0.8, 0.052], [1, 0.03]]);
    const B0 = -0.068, shoe = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.72; p.set(Math.sign(c) * Math.abs(c) ** e * w, B0 + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.075 + 0.275 * v); };
    add(ft, C('shoe', () => surf(shoe, 32, 24, { closedU: true })), M.shoe);
    const sole = (u, v, p) => { const [c, sn] = ang(u), w = fw(Math.min(0.97, Math.max(0.03, v))) * 1.12 + 0.004, e = 0.3, k = (Math.sign(sn) * Math.abs(sn) ** e + 1) / 2; p.set(Math.sign(c) * Math.abs(c) ** e * w, -0.1 + (B0 + 0.006 - -0.1) * k + 0.012 * smooth(0.85, 1, v) * k, -0.083 + 0.293 * v); };
    add(ft, C('sole', () => surf(sole, 32, 20, { closedU: true })), M.sole);
    { const pts = []; for (let i = 0; i <= 24; i++) { const p = new V3(); sole(0.25, i / 24, p); p.y = -0.084; pts.push(p); } for (let i = 24; i >= 0; i--) { const p = new V3(); sole(0.75, i / 24, p); p.y = -0.084; pts.push(p); } rim(ft, 'soleL', pts, 0.003, true, M.black); }
    for (let k = 0; k < 4; k++) { const v = 0.42 + k * 0.1, a = new V3(), b = new V3(); shoe(0.42, v, a); shoe(0.58, v + 0.06, b); a.y += 0.004; b.y += 0.004; rim(ft, 'lace' + k, [a, a.clone().lerp(b, 0.5).add(new V3(0, 0.004, 0)), b], 0.0035, false, M.black); shoe(0.58, v, a); shoe(0.42, v + 0.06, b); a.y += 0.004; b.y += 0.004; rim(ft, 'laceB' + k, [a, a.clone().lerp(b, 0.5).add(new V3(0, 0.004, 0)), b], 0.0035, false, M.black); }
    add(ft, C('heelTab', () => strand([[0, B0 + 0.07, -0.078], [0, B0 + 0.11, -0.082], [0, B0 + 0.14, -0.074]], 0.009, 0.007, { seg: 8, rad: 6, flat: 0.35, ref: [0, 0, 1] })), M.red);
  }

  /* ---------- 목 · 얼굴 · 머리카락 · 후드 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.034 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.033 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.033 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  m.headMesh = add(H, C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] })), M.face);
  H.scale.setScalar(1.1);
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.1, -0.006], [s * 0.08, 0.104, -0.014], [s * 0.084, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  const r = rng(29), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), M.hair);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.14 + 0.38 * w * w : 0.14 - 0.9 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.007 + 0.014 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    // 앞머리: 부스스하게 갈라진 결 (가운데가 길어 눈썹 아래까지 · 끝이 들쭉날쭉)
    for (let k = 0; k < 19; k++) {
      const t = k / 18, az = 1.05 - t * 2.1 + (r() - 0.5) * 0.06, side = Math.abs(az), tipEl = 0.24 - 0.12 * r() - 0.3 * smooth(0.5, 1.0, side) - (k % 4 === 1 ? 0.06 : 0), sweep = (r() - 0.5) * 0.18 + (az > 0 ? 0.04 : -0.04);
      const pts = [headAt(az * 0.3, 1.2, 0.022), headAt(az * 0.75 + sweep * 0.3, 0.82, 0.032), headAt(az * 0.95 + sweep * 0.7, 0.52, 0.032), headAt(az + sweep, (0.5 + tipEl) / 2, 0.026), headAt(az + sweep * 1.4, tipEl, 0.013 + 0.01 * r())];
      const d = dirOf(az, 0.5); clump('bang' + k, pts, (k % 2 ? 0.024 : 0.034) + r() * 0.01, 0.0014, 0.22, [d.x, d.y, d.z]);
    }
    // 옆 · 뒷머리: 어깨에 닿는 부스스한 머리 (끝이 바깥으로 뻗침)
    for (let k = 0; k < 24; k++) {
      const az = (k / 24) * TAU + Math.PI * 0.5 + 0.13, w = Math.cos(az); if (w > 0.45) continue;
      const tipEl = -1.05 + 0.15 * Math.max(0, -w) + (r() - 0.5) * 0.12, flick = 0.03 + 0.03 * r();
      const pts = [headAt(az, 0.7, 0.02), headAt(az, 0.15, 0.028), headAt(az + (r() - 0.5) * 0.08, -0.45, 0.034), headAt(az + (r() - 0.5) * 0.14, tipEl, 0.034 + flick), headAt(az + (r() - 0.5) * 0.2, tipEl - 0.06, 0.04 + flick * 1.5)];
      const d = dirOf(az, 0); clump('back' + k, pts, 0.04, 0.004, 0.26, [d.x, 0, d.z]);
    }
    // 얼굴 옆 짧은 가닥 (귀 앞)
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const az = s * (1.05 + k * 0.16), pts = [headAt(az * 0.9, 0.7, 0.02), headAt(az, 0.15, 0.018), headAt(az * 1.02, -0.45 - k * 0.1, 0.016), headAt(az * 1.05, -0.8 - k * 0.1, 0.022)]; const d = dirOf(az, 0); clump(`side${s}${k}`, pts, 0.03, 0.004, 0.22, [d.x, 0, d.z]); }
    // 아호게 (정수리에서 둥글게 말린 한 가닥)
    { const b = headAt(-0.12, 0.98, 0.016); clump('ahoge', [b, b.clone().add(new V3(-0.004, 0.025, 0.01)), b.clone().add(new V3(-0.01, 0.05, 0.03)), b.clone().add(new V3(-0.002, 0.062, 0.058)), b.clone().add(new V3(0.014, 0.05, 0.068)), b.clone().add(new V3(0.018, 0.034, 0.056))], 0.008, 0.0015, 0.45, [1, 0, 0]); }
    // 붉은 머리끈 (관자놀이 옆 가닥) · 길게 내린 두 가닥 + 뒤 옆 두 가닥 (로프 물리)
    for (const [az, el, n, front] of [[1.22, -0.22, 8, true], [-1.22, -0.22, 8, true], [1.75, -0.45, 5, false], [-1.75, -0.45, 5, false]]) {
      const local = headAt(az, el, 0.026);
      if (front) { const o = add(H, C('htie', () => new THREE.TorusGeometry(0.011, 0.0055, 8, 16)), M.red, local.toArray(), [Math.PI / 2, 0, 0]); add(o, C('htieB', () => new THREE.SphereGeometry(0.008, 10, 8)), M.red, [Math.sign(az) * 0.012, 0, 0]); }
      const rope = new Rope(n, 0.058, { damp: 0.978, stiff: 0.06 }), ph = az * 2.3;
      const view = new RopeTube(rope, M.hair, { sub: 3, rad: 10, uvV: 2, flat: 0.32, side: new V3(1, 0, 0), prof: (v) => (front ? 0.026 : 0.034) * (v < 0.05 ? 0.85 : 1 - 0.5 * v) * (v > 0.85 ? 1 - (v - 0.85) * 5 : 1), wave: (v) => 0.008 * Math.sin(v * TAU + ph) * v });
      const rest = front ? new V3(Math.sign(az) * 0.15, -1, 0.3).normalize() : new V3(Math.sign(az) * 0.35, -0.9, -0.35).normalize();
      m.ropes.push({ rope, view, joint: H, local, rest, sideL: new V3(Math.cos(az), 0, -Math.sin(az)), caps: 'hair' });
    }
  }
  // 후드: 머리를 감싼 뾰족한 흰 후드 — 앞(조금 위)으로 열린 고깔 (얼굴 · 앞머리 · 아호게가 보임) + 붉은 점선 테두리
  {
    const nO = new V3(0, -0.25, 1).normalize(), A = nO.clone().negate(), E1 = new V3(1, 0, 0), E2 = new V3().crossVectors(A, E1).normalize(), TH = Math.PI - 1.36, TIP = new V3(0, 0.9, -0.44).normalize();
    const hoodPt = (th, ph, inner, p) => {
      const d = A.clone().multiplyScalar(Math.cos(th)).addScaledVector(E1, Math.cos(ph) * Math.sin(th)).addScaledVector(E2, Math.sin(ph) * Math.sin(th));
      headPt(d.x, d.y, d.z, p); const n = headN(p);
      const tip = Math.pow(Math.max(0, d.dot(TIP)), 6), off = 0.052 + 0.025 * Math.max(0, -d.z) + 0.02 * smooth(0, -0.9, d.y) + 0.055 * tip - inner * 0.012;
      p.addScaledVector(n, off); p.y += 0.02 * tip; p.z -= 0.02 * tip; return p;
    };
    add(H, C('hood', () => surf((u, v, p) => hoodPt(TH * v, u * TAU, 0, p), 64, 28, { closedU: true, poles: [0] })), M.puff);
    add(H, C('hoodIn', () => surf((u, v, p) => hoodPt(TH * (0.7 + 0.3 * v), u * TAU, 1, p), 64, 6, { closedU: true, flip: true })), M.puffIn);
    const edge = []; for (let i = 0; i < 80; i++) edge.push(hoodPt(TH, (i / 80) * TAU, 0.4, new V3()));
    add(H, C('hoodRoll', () => strand(edge, 0.012, 0.012, { closed: true, seg: 160, rad: 8 })), M.puff);
    const edge2 = edge.map((q) => q.clone().add(new V3(0, 0, 0.004)).addScaledVector(headN(q), 0.008));
    add(H, C('hoodTrim', () => strand(edge2, 0.0042, 0.0042, { closed: true, seg: 160, rad: 6 })), M.trim);
    // 후드 끈 구멍 (턱 양옆)
    for (const s of [-1, 1]) { const q = hoodPt(TH, Math.PI / 2 * (s > 0 ? 3 : 1), 0.2, new V3()); add(H, C('grom', () => new THREE.TorusGeometry(0.006, 0.0022, 6, 12)), M.goldD, q.toArray()); }
  }

  /* ---------- 로프: 붉은 넥타이 · 후드 끈의 금 호리병 · 무구 방울의 오색 천 ---------- */
  { const knot = add(J.chest, C('tieKnot', () => { const g = new THREE.SphereGeometry(0.018, 14, 10); g.scale(1, 1.25, 0.7); return g; }), M.red, [0, 0.24, 0.088]);
    const rope = new Rope(11, 0.06, { damp: 0.975, stiff: 0.1 }), view = new RopeTube(rope, M.red, { sub: 2, rad: 8, flat: 0.16, side: new V3(1, 0, 0), prof: (v) => (0.016 + 0.018 * smooth(0, 0.3, v)) * (v > 0.94 ? Math.max(0.15, 1 - (v - 0.94) * 14) : 1) });
    m.ropes.push({ rope, view, joint: J.chest, local: new V3(0, 0.225, 0.092), rest: new V3(0, -1, 0.2).normalize(), sideJ: J.chest, sideL: new V3(1, 0, 0), caps: 'tie' }); m.tieKnot = knot; }
  const gourd = () => { const g = new THREE.Group();
    add(g, C('gourd', () => lathe([[0.002, 0.0], [0.006, -0.004], [0.011, -0.016], [0.007, -0.028], [0.009, -0.034], [0.019, -0.05], [0.02, -0.066], [0.012, -0.08], [0, -0.084]], 18)), M.gold);
    add(g, C('gourdT', () => lathe([[0.002, -0.084], [0.01, -0.09], [0.013, -0.13], [0.016, -0.16], [0, -0.16]], 14)), M.goldD); return g; };
  for (const s of [-1, 1]) { const rope = new Rope(5, 0.05, { damp: 0.975, stiff: 0.1 }), view = new RopeTube(rope, M.trim, { sub: 2, rad: 6, prof: () => 0.0035 });
    const end = gourd(); m.ropes.push({ rope, view, joint: J.chest, local: new V3(s * 0.072, 0.262, 0.1), rest: new V3(0, -1, 0.15).normalize(), caps: 'coat', end }); m.ends.push(end); }
  m.ribbons = [];
  OBANG.forEach((c, i) => { const rope = new Rope(6 + (i % 3), 0.06, { damp: 0.965, stiff: 0.02 }), view = new RopeTube(rope, M.ribbon[i], { sub: 2, rad: 6, flat: 0.12, side: new V3(1, 0, 0), prof: (v) => 0.016 * (v > 0.9 ? 1 - (v - 0.9) * 6 : 1) });
    const a = (i / 5) * TAU, R = { rope, view, joint: J.weapon, local: new V3(Math.cos(a) * 0.02, Math.sin(a) * 0.02, BL.butt + 0.01), rest: new V3(Math.cos(a) * 0.5, -1, Math.sin(a) * 0.5).normalize(), caps: 'none', ribbon: true, sideW: a };
    m.ropes.push(R); m.ribbons.push(R); });
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
    for (const e of m.ends) { scene.add(e); extras.push(e); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 무기: 무구 방울 (나무 자루 · 놋쇠 방울 송이) ---------- */
  const bell = new THREE.Group(); J.weapon.add(bell); m.bell = bell; m.glaive = bell;
  {
    const X = [Math.PI / 2, 0, 0];
    add(bell, C('bl:grip', () => new THREE.CylinderGeometry(0.0125, 0.014, BL.neck - BL.butt, 14)), M.wood, [0, 0, (BL.neck + BL.butt) / 2], X);
    for (let i = 0; i < 6; i++) add(bell, C('bl:wrap', () => new THREE.TorusGeometry(0.0138, 0.0028, 6, 16)), M.red, [0, 0, -0.03 + i * 0.012]);
    add(bell, C('bl:butt', () => lathe([[0.015, 0.012], [0.02, 0.004], [0.018, -0.008], [0.008, -0.016], [0, -0.018]], 16)), M.goldD, [0, 0, BL.butt], [-Math.PI / 2, 0, 0]);
    add(bell, C('bl:ring', () => new THREE.TorusGeometry(0.008, 0.0025, 6, 14)), M.goldD, [0, 0, BL.butt - 0.016], [0, Math.PI / 2, 0]);
    add(bell, C('bl:cup', () => lathe([[0.013, -0.01], [0.022, 0.0], [0.03, 0.012], [0.02, 0.016]], 20)), M.goldD, [0, 0, BL.neck], X);
    add(bell, C('bl:stem', () => new THREE.CylinderGeometry(0.004, 0.004, BL.top - BL.neck, 8)), M.goldD, [0, 0, (BL.top + BL.neck) / 2], X);
    // 방울: 둥근 몸통 + 아래 홈 + 꼭지 고리 — 세 단 송이 (아래 단이 넓음)
    const bellG = C('bl:bell', () => { const g = lathe([[0.0, 0.016], [0.007, 0.014], [0.012, 0.008], [0.0135, 0.0], [0.012, -0.007], [0.008, -0.011], [0.004, -0.012]], 14); g.rotateX(Math.PI / 2); return g; });
    const slitG = C('bl:slit', () => new THREE.BoxGeometry(0.018, 0.0025, 0.004));
    m.bells = [];
    for (const [z, n, R0, s] of [[BL.neck + 0.035, 7, 0.032, 1], [BL.neck + 0.075, 5, 0.022, 0.95], [BL.neck + 0.108, 3, 0.012, 0.9]]) for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + z * 20, g = new THREE.Group(); g.position.set(Math.cos(a) * R0, Math.sin(a) * R0, z); g.scale.setScalar(s); bell.add(g); m.bells.push(g);
      add(g, bellG, M.brass); add(g, slitG, M.black, [0, 0, -0.0115]);
      rim(bell, `bl:arm${z}${i}`, [[0, 0, z - 0.01], [Math.cos(a) * R0 * 0.6, Math.sin(a) * R0 * 0.6, z - 0.006], [Math.cos(a) * R0, Math.sin(a) * R0, z + 0.012]].map((q) => new V3(...q)), 0.0016, false, M.goldD);
    }
    add(bell, C('bl:top', () => new THREE.SphereGeometry(0.012, 12, 10)), M.brass, [0, 0, BL.top]);
  }

  /* ---------- 매 프레임 ---------- */
  const lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 }, tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion(), wq = new THREE.Quaternion(), down = new V3(0, -1, 0);
  for (const me of m.skirt) { me.geometry = me.geometry.clone(); me.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); me.userData.base = me.geometry.attributes.position.array.slice(); me.frustumCulled = false; }
  m.glow = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    // 치마 · 점퍼 아랫단: 다리 각도를 스프링으로 따라 출렁임
    const k = 1 - Math.exp(-dt * 16), tgL = J.hipL.rotation.x, tgR = J.hipR.rotation.x;
    lag.vL += ((tgL - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((tgR - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * k;
    const spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.4, 1.4)), zR = -Math.sin(clamp(lag.R, -1.4, 1.4));
    for (const me of m.skirt) {
      const base = me.userData.base, pa = me.geometry.attributes.position, arr = pa.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, 0.02 - y), wL = clamp(0.5 + x / 0.14, 0, 1), wR = 1 - wL;
        const dz = (wL * zL + wR * zR) * depth * 0.95, out = 1 + (spread * 0.3 + lag.sw * 0.15) * (depth / 0.4);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.3; arr[i + 2] = z * out + dz - lag.sw * 0.12 * depth;
      }
      pa.needsUpdate = true; me.geometry.computeVertexNormals();
    }
    // 로프: 머리칼 · 넥타이 · 후드 끈 · 오색 천
    J.chest.updateMatrixWorld(true);
    const h0 = f.hurt[0], hc = H.localToWorld(tmp2.copy(HC)), legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.02 * sc }));
    const chA = J.spine.getWorldPosition(new V3()), chB = J.neck.getWorldPosition(new V3()), hipC = J.hips.localToWorld(new V3(0, -0.12, 0.0));
    const capsHair = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: 0.15 * sc }, { a: hc, b: hc, r: 0.13 * sc }, ...legs];
    const capsTie = [{ a: chA, b: chB, r: 0.098 * sc }, { a: hipC, b: hipC, r: 0.2 * sc }, ...legs];
    const capsCoat = [{ a: chA, b: chB, r: 0.135 * sc }];
    const wind = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6); H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq); J.weapon.getWorldQuaternion(wq);
    const showW = vis && bell.visible;
    for (const r of m.ropes) {
      r.joint.localToWorld(tmp.copy(r.local));
      if (r.ribbon) r.view.side.set(Math.cos(r.sideW), Math.sin(r.sideW), 0).applyQuaternion(wq);
      else if (r.sideL) r.view.side.copy(r.sideL).applyQuaternion(r.sideJ ? r.sideJ.getWorldQuaternion(new THREE.Quaternion()) : hq);
      const caps = r.caps === 'hair' ? capsHair : r.caps === 'tie' ? capsTie : r.caps === 'coat' ? capsCoat : [];
      r.rope.step(dt, tmp, caps, f.pos.y + 0.01, r.ribbon ? r.rest.clone().applyQuaternion(rq) : r.rest.clone().applyQuaternion(rq), r.ribbon ? wind.clone().multiplyScalar(1.5) : wind); r.view.update();
      r.view.mesh.visible = r.ribbon ? showW : vis;
      if (r.end) { const p = r.rope.p, a = p[p.length - 2], b = p[p.length - 1]; r.end.position.copy(b); r.end.quaternion.setFromUnitVectors(new V3(0, -1, 0), tmp.subVectors(b, a).normalize()); r.end.scale.setScalar(sc); r.end.visible = vis; }
    }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    // 부적 (왼손) · 방울 빛 (신기가 가득 차거나 의식 중)
    m.talCard.visible = (f.talK || 0) > 0;
    const want = Math.max(f.bellK || 0, (f.shingi || 0) >= 100 ? 0.7 : 0); m.glow += (want - m.glow) * Math.min(1, dt * 8);
    M.brass.emissiveIntensity = m.glow * (0.8 + 0.4 * Math.sin(f.G.time * 9));
    // 방울이 흔들린다
    const sh = f.state === 'act' ? 0.35 : 0.08; m.bells.forEach((b, i) => { b.rotation.x = Math.sin(f.G.time * 23 + i * 1.7) * sh; b.rotation.y = Math.cos(f.G.time * 19 + i) * sh; });
  };
  m.setWeapon = (v) => { bell.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.1;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, BL.butt)); J.weapon.localToWorld(t.set(0, 0, BL.top + 0.03)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, BL.neck)); J.weapon.localToWorld(t.set(0, 0, BL.top + 0.04)); };
  m.bellPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, BL.neck + 0.07)); };
  m.extras = extras;
  return m;
}
