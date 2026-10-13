// 제이 (SNIPER · 표적 제거) — 3D 모델 (기술·포즈는 sniper.js)
// 대물 저격총 "PROJECT-J" 를 쓰는 암살자.
//
// 구성: 검은 군용 정모(챙 · 붉은 문장 · 옆 붉은 사선 줄 · 은색 턱끈) · 끝이 살짝 뻗친 옅은 민트 회색 단발 + 일자 앞머리
//       흰 칼라 크롭 셔츠(검은 세로 줄무늬 · 민소매) · 검은 넥타이 · 가슴 하네스(작은 파우치 둘) · 드러난 허리
//       어깨에서 흘러내린 검은 테크 재킷(천 물리 · 청록 발광 봉제선 · 산호빛 안감) · 위팔의 산호색 깃 자락 · 부푼 소매 + 커프스 · 장갑
//       왼 위팔 암밴드 · 검은 하이웨스트 반바지 + 벨트 · 비스듬한 탄띠와 파우치 · 늘어진 은 사슬 · 매달린 끈(로프 물리)
//       오른 다리: 붉은 '08' 이 찍힌 검은 사이하이 스타킹 · 왼 허벅지: 탄약 밴드 + 홀스터 파우치
//       청록 발광 밑창의 검은 플랫폼 레이스업 부츠
//       무기: 대물 저격총 PROJECT-J (스코프 · 접힌 양각대 · 머즐 브레이크 · 청록 발광선 · 붉은 '20' 표기)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.87, spineL: 0.18, chestL: 0.245, neckL: 0.068, shW: 0.172, uArm: 0.27, lArm: 0.245, hipW: 0.084, thigh: 0.44, shin: 0.42, headTop: 0.27 };
// 저격총 치수 (오른손 손잡이 기준 +Z, m)
export const RF = { butt: -0.33, bore: 0.075, hg0: 0.26, hg1: 0.74, muzzle: 1.19, scopeY: 0.152, grip2: 0.42 };
export const CYAN = 0x3af0ff, CYAN2 = 0xbafcff, CORAL = 0xf2765e, REDJ = 0xe0283c;
const C = (k, fn) => cached('snp:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 투명 바탕 글자 (총 · 스타킹 표기)
function textTex(str, w, h, color, font, o = {}) {
  const [c, g] = cv(w, h); g.clearRect(0, 0, w, h);
  if (o.rot) { g.translate(w / 2, h / 2); g.rotate(o.rot); g.translate(-w / 2, -h / 2); }
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (o.box) { g.strokeStyle = color; g.lineWidth = o.box; g.strokeRect(o.box, o.box, w - o.box * 2, h - o.box * 2); }
  if (o.bars) for (let i = 0; i < o.bars; i++) { g.save(); g.translate(w * 0.12 + i * h * 0.36, h * 0.5); g.transform(1, 0, -0.5, 1, 0, 0); g.fillRect(-h * 0.1, -h * 0.32, h * 0.2, h * 0.64); g.restore(); }
  g.fillText(str, w / 2 + (o.dx || 0), h / 2 + (o.dy || 0));
  return tex(c);
}
// 흰 셔츠 + 검은 세로 줄무늬 (loft uv: u 0 = 뒤 · 0.5 = 앞, 캔버스 아래 = 밑단)
function shirtTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H); g.fillStyle = '#f2f1ee'; g.fillRect(0, 0, W, H);
  const n = 24; for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * W; if (Math.abs(x - W / 2) < 18) continue; g.fillStyle = '#1a1a1e'; g.fillRect(x - 9, 0, 18, H); }
  // 앞섶 · 단추 · 밑단 박음질 · 은은한 주름 음영
  g.fillStyle = '#e4e2de'; g.fillRect(W / 2 - 14, 0, 28, H); g.fillStyle = '#b8b6b2'; g.fillRect(W / 2 - 15, 0, 2, H); g.fillRect(W / 2 + 13, 0, 2, H);
  for (let y = 60; y < H; y += 110) { g.fillStyle = '#d0cec8'; g.beginPath(); g.arc(W / 2, y, 6, 0, TAU); g.fill(); }
  g.fillStyle = '#d8d6d0'; g.fillRect(0, H - 14, W, 14);
  for (let i = 0; i < 18; i++) { const x = (i / 18) * W, gr = g.createLinearGradient(x, 0, x + W / 18, 0); gr.addColorStop(0, 'rgba(60,60,80,0)'); gr.addColorStop(0.5, 'rgba(60,60,80,0.08)'); gr.addColorStop(1, 'rgba(60,60,80,0)'); g.fillStyle = gr; g.fillRect(x, 0, W / 18, H); }
  return tex(c);
}
// 재킷 (천 물리 · 캔버스 위 = 고정선(팔꿈치 → 등 → 팔꿈치)): 검정 · 청록 봉제선 · 붉은 판 · '08'
function jacketTex(glow) {
  const W = 512, H = 1024, [c, g] = cv(W, H), r = rng(19); g.fillStyle = '#18191e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '160,170,190'},${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2, 2); }
  for (let i = 0; i < 8; i++) { const x = (i / 8) * W, fg = g.createLinearGradient(x, 0, x + W / 8, 0); fg.addColorStop(0, 'rgba(255,255,255,0.03)'); fg.addColorStop(0.6, 'rgba(0,0,0,0.18)'); fg.addColorStop(1, 'rgba(255,255,255,0.03)'); g.fillStyle = fg; g.fillRect(x, 0, W / 8, H); }
  const cy = glow ? '#3af0ff' : '#2aa8b8';
  // 등판 세로 패널선 · 옆 패널
  g.fillStyle = '#26282f'; g.fillRect(W * 0.3, 0, W * 0.4, H * 0.18);
  g.strokeStyle = cy; g.lineWidth = 5; g.beginPath(); g.moveTo(W * 0.3, 0); g.lineTo(W * 0.3, H * 0.18); g.lineTo(W * 0.7, H * 0.18); g.lineTo(W * 0.7, 0); g.stroke();
  for (const x of [0.035, 0.965]) { g.fillStyle = cy; g.fillRect(W * x - 3, 0, 6, H * 0.94); }
  for (const x of [0.22, 0.78]) { g.fillStyle = 'rgba(58,240,255,0.55)'; g.fillRect(W * x - 2, H * 0.3, 4, H * 0.62); }
  // 밑단: 청록선 + 회색 띠
  g.fillStyle = '#3a3d46'; g.fillRect(0, H * 0.9, W, H * 0.1); g.fillStyle = cy; g.fillRect(0, H * 0.9 - 3, W, 6); g.fillRect(0, H - 10, W, 4);
  // 앞자락 붉은 판 + '08'
  for (const [x0, flip] of [[0.06, 1], [0.94, -1]]) { g.fillStyle = '#d8323e'; g.save(); g.translate(W * x0, H * 0.62); g.scale(flip, 1); g.fillRect(0, 0, W * 0.09, H * 0.2); g.restore(); }
  g.save(); g.translate(W * 0.86, H * 0.8); g.rotate(-Math.PI / 2); g.fillStyle = '#f05a5a'; g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.fillText('08', 0, 0); g.restore();
  g.save(); g.translate(W * 0.14, H * 0.8); g.rotate(Math.PI / 2); g.fillStyle = '#f05a5a'; g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.fillText('J-08', 0, 0); g.restore();
  return tex(c);
}
// 산호빛 큐프라 안감: 부드러운 광택 결
function liningTex() {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(5); g.fillStyle = '#ee7a62'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const x = r() * W, gr = g.createLinearGradient(x - 16, 0, x + 16, 0); gr.addColorStop(0, 'rgba(255,200,180,0)'); gr.addColorStop(0.5, 'rgba(255,210,190,0.28)'); gr.addColorStop(1, 'rgba(120,30,20,0)'); g.fillStyle = gr; g.fillRect(x - 16, 0, 32, H); }
  g.strokeStyle = 'rgba(140,40,30,0.35)'; g.lineWidth = 2; for (let y = 40; y < H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 30); g.stroke(); }
  return tex(c);
}
// 사이하이 스타킹 (오른 다리): 검정 + 위쪽 붉은 '08' · 띠 — loft uv: v 0 = 위(캔버스 아래), u 0.75 = 바깥(-x) → 180° 돌려 그린다
function stockTex() {
  const W = 512, H = 512, [c, g] = cv(W, H); g.fillStyle = '#16161b'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W, H); g.rotate(Math.PI); // 이후 좌표: 위 = 스타킹 윗단, x 증가 = 바깥 → 앞
  g.fillStyle = '#2a2a32'; g.fillRect(0, 0, W, 26);
  g.fillStyle = '#e0303e'; g.fillRect(0, 30, W, 5);
  const ux = (u) => (1 - u) * W; // 캔버스 x ↔ loft u (회전 반영)
  g.font = 'bold 64px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('02', ux(0.62), 92);
  for (let i = 0; i < 2; i++) g.fillRect(ux(0.7) - 26 + i * 18, 66, 8, 50);
  g.fillStyle = 'rgba(224,48,62,0.8)'; g.fillRect(ux(0.66) - 50, 130, 100, 4);
  g.restore();
  return tex(c);
}
// 옅은 민트 회색 머리 (strand uv v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(57), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#9ebcba'); gr.addColorStop(1, '#8aaaa8'); } else { gr.addColorStop(0, '#dcefeb'); gr.addColorStop(0.5, '#b4d0cc'); gr.addColorStop(1, '#86a8a6'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.42 ? 'rgba(60,100,104,0.35)' : 'rgba(240,255,252,0.35)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 14, H / 2, x + (r() - 0.5) * 8, 0); g.stroke(); }
  if (!cap) { g.globalAlpha = 0.35; g.fillStyle = '#f4fffc'; const y0 = H * 0.62; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - 6 - r() * 16); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + 6 + r() * 12); g.closePath(); g.fill(); g.globalAlpha = 1; }
  return tex(c);
}
// 총몸: 검은 무광 + 은은한 결
function gunTex() {
  const W = 256, [c, g] = cv(W, W), r = rng(77); g.fillStyle = '#1c1d22'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '200,210,230'},${r() * 0.05})`; g.fillRect(r() * W, r() * W, 1, 1); }
  return tex(c, [2, 2]);
}

/* ---------- 얼굴: 실제 비율 · 무표정 · 분홍빛 갈색 눈 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.071, 0.1, 0.088], jaw: 0.36, chin: 0.006 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  g.fillStyle = '#f9e6de'; g.fillRect(0, 0, W, H);
  const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,250,246,0.55)'); gr.addColorStop(0.6, 'rgba(255,238,232,0)'); gr.addColorStop(1, 'rgba(185,140,140,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,135,0)'); cg.addColorStop(1, 'rgba(185,130,125,0.38)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  g.save(); g.filter = 'blur(18px)'; g.fillStyle = 'rgba(235,140,145,0.16)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.036, Y.noseY + 0.006); g.beginPath(); g.ellipse(x, y, 66, 26, 0, 0, TAU); g.fill(); } g.restore();
  paintFace(g, M, { ...Y, tilt: 0.02, lidDrop: 0.12, open, iris: ['#f2c4c4', '#c07c84', '#6a3440', '#2e141a'], pupil: '#1e0a10', lash: '#22262a', brow: '#6e8e8c' });
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
  const glowC = pal.glow ?? CYAN;
  const faceM = (open) => phys({ map: T('face' + open, () => faceTex(open)), emissiveMap: T('face' + open, () => faceTex(open)), emissive: 0x6a5654, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8d0) });
  const decal = (k, f) => new THREE.MeshBasicMaterial({ map: T(k, f), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  const M = {
    skin: phys({ color: 0xfae4da, emissive: 0x7a5852, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8d0) }),
    face: faceM(false), faceO: faceM(true),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xe8fffa), sheenRoughness: 0.35, emissive: 0x1a2a2a, emissiveIntensity: 0.35 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xd0f0ea), sheenRoughness: 0.35, emissive: 0x142222, emissiveIntensity: 0.3 }),
    shirt: phys({ map: T('shirt', shirtTex), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    white: phys({ color: 0xf2f1ee, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    tie: phys({ color: 0x141418, roughness: 0.4, sheen: 0.8, sheenColor: new THREE.Color(0x707088) }),
    black: phys({ color: 0x1c1d22, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0x6a6e80) }),
    leather: phys({ color: 0x131317, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
    grey: phys({ color: 0x4a4d56, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0x9aa0b0) }),
    coral: phys({ map: T('lin', liningTex), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xffc8b8), sheenRoughness: 0.3 }),
    red: phys({ color: REDJ, roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color(0xff9aa0) }),
    glow: phys({ color: 0x0a2a30, emissive: glowC, emissiveIntensity: 1.6, roughness: 0.3 }),
    silver: phys({ color: 0xd4d8e0, metalness: 1, roughness: 0.22 }),
    brass: phys({ color: 0xd0a24a, metalness: 1, roughness: 0.3 }),
    gun: phys({ map: T('gun', gunTex), roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    gunD: phys({ color: 0x2e3038, roughness: 0.4, metalness: 0.5, clearcoat: 0.3 }),
    glove: phys({ color: 0x2a2c33, roughness: 0.45, sheen: 0.7, sheenColor: new THREE.Color(0x8a90a0) }),
    lens: phys({ color: 0x0a3a44, emissive: glowC, emissiveIntensity: 0.9, roughness: 0.05, clearcoat: 1 }),
    jacket: phys({ map: T('jkt', () => jacketTex(true)), side: THREE.FrontSide, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x6a7080), emissive: 0xffffff, emissiveMap: T('jktE', () => { const [c, g] = cv(512, 1024); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 1024); g.fillStyle = '#3af0ff'; for (const x of [0.035, 0.965]) g.fillRect(512 * x - 3, 0, 6, 1024 * 0.94); g.fillRect(0, 1024 * 0.9 - 3, 512, 6); g.globalAlpha = 0.5; for (const x of [0.22, 0.78]) g.fillRect(512 * x - 2, 1024 * 0.3, 4, 1024 * 0.62); return tex(c); }), emissiveIntensity: 0.9 }),
    lining: phys({ map: T('lin', liningTex), side: THREE.BackSide, roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xffc8b8), sheenRoughness: 0.3 }),
    strap: phys({ color: 0x18181c, roughness: 0.5 }),
    stock: phys({ map: T('stk', stockTex), roughness: 0.42, sheen: 0.8, sheenColor: new THREE.Color(0x8a8aa0), sheenRoughness: 0.35 }),
    stockS: phys({ color: 0x16161b, roughness: 0.42, sheen: 0.8, sheenColor: new THREE.Color(0x8a8aa0), sheenRoughness: 0.35 }),
    sole: phys({ color: 0x101014, roughness: 0.6 }),
    d20: decal('d20', () => textTex('20', 128, 64, '#ff3a48', 'bold 50px monospace', { box: 3 })),
    d20b: decal('d20b', () => textTex('20', 128, 64, '#ff3a48', 'bold 46px monospace', { bars: 0 })),
    dPJ: decal('dPJ', () => textTex('PROJECT-J', 512, 64, '#ff4a56', 'bold 46px monospace', { bars: 3, dx: 46 })),
    d08: decal('d08', () => textTex('08', 128, 64, '#ff3a48', 'bold 48px monospace')),
  };
  // 사이하이 스타킹: 정면은 살빛이 아주 살짝 비치고 가장자리는 짙은 검정
  for (const k of ['stock', 'stockS']) { const mt = M[k]; mt.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ float nv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0); diffuseColor.rgb = mix(diffuseColor.rgb * 0.7, diffuseColor.rgb + vec3(0.22, 0.13, 0.12), pow(nv, 2.2) * 0.55); }'); }; mt.customProgramCacheKey = () => 'snp-nylon'; }
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = !mat.transparent && mat !== M.glow; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.glow) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  // 둥근 상자 (파우치 · 총몸 부품): 폭 w(x) · 높이 h(y) · 깊이 d(z)
  const rbox = (key, w, h, d, r = 0.006) => C('rb' + key, () => { const sh = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r; sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -y); sh.lineTo(w / 2, y); sh.quadraticCurveTo(w / 2, h / 2, x, h / 2); sh.lineTo(-x, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, y); sh.lineTo(-w / 2, -y); sh.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
    const bv = Math.min(r * 0.6, d * 0.3), g = new THREE.ExtrudeGeometry(sh, { depth: d - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -(d - bv * 2) / 2); return g; });
  const onto = (o, p, n) => { o.position.copy(p); o.lookAt(p.clone().add(n)); return o; }; // +Z 가 n 을 향하게
  m.ropes = [];

  /* ---------- 골반 · 하이웨스트 반바지 · 벨트 · 탄띠 · 파우치 · 사슬 ---------- */
  const shP = (v) => ({ y: -0.115 + 0.225 * v, rx: 0.142 - 0.026 * v, rzF: 0.088 - 0.004 * v, rzB: 0.1 - 0.012 * v, n: 2.2 });
  add(J.hips, C('shorts', () => loft(shP, 44, 10)), M.black);
  lRim(J.hips, 'shTop', shP, 1, 0.0035, M.grey);
  const bX = spl([[0, 0.112], [0.45, 0.088], [1, 0.104]]), bF = spl([[0, 0.074], [0.5, 0.066], [1, 0.076]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.02 + 0.22 * v, rx: bX(v), rzF: bF(v), rzB: 0.076, n: 2.15 }), 40, 12, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z -= 0.004 * gauss(p.x, 0.008) * gauss(p.y - 0.035, 0.012); } })), M.skin);
  // 배꼽
  add(J.spine, C('navel', () => new THREE.SphereGeometry(0.004, 8, 6)), M.skin, [0, 0.04, bF(0.27) - 0.002], [0, 0, 0], [0.8, 1.3, 0.5]);
  // 벨트 (허리 높이) + 버클
  const beltP = (v) => ({ y: 0.042 + 0.034 * v, rx: 0.132, rzF: 0.096, rzB: 0.1, n: 2.25 });
  add(J.hips, C('belt', () => loft(beltP, 56, 3)), M.leather); lRim(J.hips, 'beltR0', beltP, 0, 0.0018); lRim(J.hips, 'beltR1', beltP, 1, 0.0018, M.grey);
  for (const [ux, w] of [[0.36, 0.012], [0.64, 0.012], [0.12, 0.012], [0.88, 0.012]]) { const p = loftAt(beltP, ux, 0.5, new V3()); onto(add(J.hips, rbox('loop', w, 0.05, 0.006, 0.002), M.leather), p.multiplyScalar(1.03), new V3(p.x, 0, p.z).normalize()); }
  { const p = loftAt(beltP, 0.5, 0.5, new V3()); const g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.004); J.hips.add(g);
    add(g, rbox('buckle', 0.05, 0.04, 0.008, 0.006), M.silver); add(g, rbox('buckleI', 0.034, 0.024, 0.01, 0.004), M.gunD); add(g, rbox('buckleG', 0.02, 0.006, 0.012, 0.002), M.glow); }
  // 비스듬한 탄띠: 왼 허리 위 → 오른 엉덩이 아래로 (파우치 셋 + 매달린 끈)
  const slingY = (u) => 0.0 - 0.055 * (0.5 - 0.5 * Math.cos((u - 0.25) * TAU)) - 0.01; // u 0.25(왼쪽) 높음 · 0.75(오른쪽) 낮음
  const slP = (v) => ({ y: 0, rx: 0.15, rzF: 0.11, rzB: 0.118, n: 2.3 });
  const slMod = (p, u, v) => { p.y = slingY(u) + 0.03 * v; };
  add(J.hips, C('sling', () => loft(slP, 64, 2, { mod: slMod })), M.grey); lRim(J.hips, 'slR', slP, 1, 0.0022, M.glow, { mod: slMod });
  const pouch = (u, key, w, h, d, dy = -0.03) => { const p = loftAt(slP, u, 0, new V3(), slMod), n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, d / 2 + 0.002); p.y += dy; const o = onto(add(J.hips, rbox(key, w, h, d, 0.008), M.black), p, n);
    const fl = add(o, rbox(key + 'f', w * 1.04, h * 0.4, 0.006, 0.004), M.grey, [0, h * 0.32, d / 2]); add(fl, rbox('pglow', w * 0.5, 0.004, 0.008, 0.0015), M.glow, [0, -h * 0.05, 0.002]); return o; };
  pouch(0.62, 'p1', 0.06, 0.07, 0.035); pouch(0.7, 'p2', 0.05, 0.06, 0.04, -0.034); pouch(0.79, 'p3', 0.045, 0.065, 0.03, -0.036); pouch(0.95, 'p4', 0.05, 0.05, 0.03, -0.03);
  // 늘어진 은 사슬: 앞 왼쪽 벨트 고리 → 오른쪽 옆구리 (늘어짐)
  { const pts = []; for (let i = 0; i <= 26; i++) { const t = i / 26, u = 0.4 + 0.33 * t, y = 0.035 - 0.1 * Math.sin(Math.PI * t) - 0.02 * t; const s = shP(clamp((y + 0.115) / 0.225, 0, 1)), [c, sn] = ang(u); pts.push(new V3(c * (s.rx + 0.008), y, sn * ((sn > 0 ? s.rzF : s.rzB) + 0.012))); }
    const link = C('link', () => new THREE.TorusGeometry(0.0055, 0.0015, 5, 10)); const q = new THREE.Quaternion(), Y = new V3(0, 1, 0);
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], d = b.clone().sub(a).normalize(), o = add(J.hips, link, M.silver, a.clone().lerp(b, 0.5).toArray(), [0, 0, 0], [1, 1.5, 1]); q.setFromUnitVectors(Y, d); o.quaternion.copy(q); o.rotateY((i % 2) * Math.PI / 2); } }
  // 탄띠에서 매달린 끈 둘 (로프 물리 · 납작한 띠)
  for (const [u, n] of [[0.66, 5], [0.84, 4]]) { const p = loftAt(slP, u, 0, new V3(), slMod), nn = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(nn, 0.01);
    const rope = new Rope(n, 0.045, { damp: 0.975, stiff: 0.1 }), view = new RopeTube(rope, M.strap, { sub: 2, rad: 6, flat: 0.18, side: new V3(1, 0, 0), prof: (v) => 0.012 });
    m.ropes.push({ rope, view, joint: J.hips, local: p, rest: new V3(nn.x * 0.2, -1, nn.z * 0.2).normalize(), caps: 'legs' }); }

  /* ---------- 상체: 흰 줄무늬 크롭 셔츠 · 칼라 · 넥타이 · 하네스 ---------- */
  const chX = spl([[0, 0.106], [0.3, 0.112], [0.55, 0.122], [0.8, 0.118], [1, 0.094]]), chF = spl([[0, 0.084], [0.5, 0.09], [1, 0.07]]), chB = spl([[0, 0.078], [0.6, 0.084], [1, 0.068]]);
  const chP = (v) => ({ y: -0.035 + 0.295 * v, rx: chX(v) + 0.008 * (1 - smooth(0, 0.3, v)), rzF: chF(v) + 0.012 * (1 - smooth(0, 0.35, v)), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.03 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod, uvU: 1 })), M.shirt);
  lRim(J.chest, 'hem', chP, 0, 0.004, M.white, { mod: chMod });
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.2 + 0.07 * v, rx: 0.118 - 0.07 * v ** 0.8, rzF: 0.072 - 0.026 * v, rzB: 0.068 - 0.024 * v }), 40, 8)), M.white);
  // 셔츠 칼라: 목 띠 + 접힌 뾰족 깃
  const colP = (v) => ({ y: 0.252 + 0.04 * v, rx: 0.05 + 0.003 * v, rzF: 0.05 + 0.006 * v, rzB: 0.05, n: 2.1 });
  add(J.chest, C('collar', () => loft(colP, 40, 4)), M.white);
  for (const s of [-1, 1]) add(J.chest, C('cflap' + s, () => surf((u, v, p) => { const a0 = new V3(s * 0.008, 0.29, 0.056), a1 = new V3(s * 0.052, 0.295, 0.02), b0 = new V3(s * 0.03, 0.24, 0.078), b1 = new V3(s * 0.074, 0.252, 0.044);
    const top = a0.clone().lerp(a1, u), bot = b0.clone().lerp(b1, u * u); p.copy(top.lerp(bot, v)); p.z += 0.008 * Math.sin(Math.PI * u) * (1 - v * 0.5); }, 8, 6)), M.white);
  // 넥타이: 매듭 + 흉골을 따라 내려오는 가는 날
  add(J.chest, C('tieK', () => { const g = new THREE.SphereGeometry(0.013, 14, 10); g.scale(1, 0.95, 0.7); return g; }), M.tie, [0, 0.262, 0.07]);
  add(J.chest, C('tie', () => { const pts = []; for (let i = 0; i <= 10; i++) { const v = 0.94 - i * 0.075, p = loftAt(chP, 0.5, v, new V3(), chMod); p.z += 0.008; pts.push(p); } return strand(pts, 0.01, 0.016, { seg: 30, rad: 8, flat: 0.18, ref: [0, 0, 1], prof: (v) => (v > 0.92 ? 1 - (v - 0.92) * 9 : 1) }); }), M.tie);
  // 하네스: 어깨 위로 넘어가는 검은 끈 (앞 V · 뒤 H) + 쇄골 아래 작은 파우치 둘
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, u = t < 0.5 ? 0.5 - s * (0.08 + 0.02 * t) : 1 - s * 0.12; const v = t < 0.5 ? 0.62 + 0.36 * (t / 0.5) : 0.98 - 0.5 * ((t - 0.5) / 0.5);
      const p = loftAt(chP, t < 0.5 ? u : (s > 0 ? 0.12 : 0.88), v, new V3(), chMod); p.addScaledVector(new V3(p.x, 0, p.z).normalize(), 0.005); if (v > 0.9) p.y += 0.01; pts.push(p); }
    add(J.chest, C('harness' + s, () => strand(pts, 0.009, 0.009, { seg: 40, rad: 6, flat: 0.3, ref: [0, 0, 1] })), M.strap);
    const p = loftAt(chP, 0.5 - s * 0.085, 0.74, new V3(), chMod), n = new V3(p.x * 0.4, 0.2, p.z).normalize(); p.addScaledVector(n, 0.016);
    const o = onto(add(J.chest, rbox('cpouch', 0.032, 0.036, 0.022, 0.005), M.black), p, n); add(o, rbox('cpf', 0.034, 0.012, 0.005, 0.002), M.grey, [0, 0.012, 0.011]); add(o, rbox('cpg', 0.016, 0.003, 0.006, 0.001), M.glow, [0, -0.004, 0.011]);
  }
  { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(chP, 0.88 + 0.24 * (i / 10), 0.62, new V3()).multiplyScalar(1.05)); add(J.chest, C('harnessB', () => strand(pts, 0.008, 0.008, { seg: 24, rad: 6, flat: 0.3, ref: [0, 0, 1] })), M.strap); }

  /* ---------- 팔: 맨 위팔 · 산호색 깃 자락 · 부푼 재킷 소매 · 커프스 · 장갑 · 왼팔 암밴드 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const slip = s > 0 ? 0.1 : 0; // 왼쪽 재킷은 팔꿈치 쪽으로 더 흘러내림
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.043 - 0.01 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.041 - 0.009 * v }), 24, 10)), M.skin);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.035 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.033 - 0.01 * v }), 24, 10)), M.skin);
    // 깃 자락: 위팔 바깥을 감싸며 아래로 벌어지는 산호색 판 (안쪽 검정) + 청록 테
    const a0 = s > 0 ? -0.08 : 0.42, a1 = a0 + 0.66, y0 = -0.03 - slip;
    const flP = (v) => ({ y: y0 - 0.1 * v, rx: 0.06 + 0.055 * v ** 1.2, rz: 0.058 + 0.045 * v ** 1.2 });
    const flMod = (p, u, v) => { p.y += 0.012 * Math.sin(u * Math.PI * 3) * v; };
    add(sh, C('flap' + s, () => loft(flP, 30, 6, { a0, a1, mod: flMod })), M.coral);
    add(sh, C('flapI' + s, () => loft((v) => { const q = flP(v); return { ...q, rx: q.rx - 0.004, rz: q.rz - 0.004 }; }, 30, 6, { a0, a1, mod: flMod })), M.black);
    lRim(sh, 'flapR' + s, flP, 1, 0.003, M.glow, { a0, a1, mod: flMod });
    lRim(sh, 'flapT' + s, flP, 0, 0.005, M.black, { a0, a1, mod: flMod });
    // 위 소매: 깃 아래에서 팔꿈치까지 (부푼 주름)
    const usP = (v) => ({ y: y0 - 0.03 - (DIMS.uArm - 0.03 + y0 + 0.01) * v, rx: 0.058 + 0.006 * Math.sin(v * Math.PI), rz: 0.056 + 0.006 * Math.sin(v * Math.PI) });
    const fold = (n, a) => (p, u, v) => { const k = 1 + a * Math.sin(u * TAU * n + v * 4); p.x *= k; p.z *= k; };
    add(sh, C('usl' + s, () => loft(usP, 32, 8, { mod: fold(5, 0.04) })), M.black);
    // 아래 소매: 팔꿈치 → 손목 (가운데가 부푼다) · 팔꿈치 회색 패치 · 붉은 문장 · 청록 봉제선
    const lsP = (v) => ({ y: 0.035 - (DIMS.lArm - 0.02) * v, rx: 0.055 + 0.012 * Math.sin(v * Math.PI * 0.9), rz: 0.053 + 0.01 * Math.sin(v * Math.PI * 0.9) });
    add(el, C('lsl', () => loft(lsP, 32, 10, { mod: fold(6, 0.035) })), M.black);
    add(el, C('patch' + s, () => loft((v) => { const q = lsP(0.08 + 0.3 * v); return { ...q, rx: q.rx + 0.003, rz: q.rz + 0.003 }; }, 16, 4, { a0: s > 0 ? 0.08 : 0.58, a1: s > 0 ? 0.42 : 0.92 })), M.grey);
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(lsP, s > 0 ? 0.25 : 0.75, 0.42 + 0.56 * (i / 12), new V3()).multiplyScalar(1.05)); rim(el, 'lslSeam' + s, pts, 0.0025, false); }
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(lsP, 0.5, 0.1 + 0.88 * (i / 12), new V3()).multiplyScalar(1.05)); rim(el, 'lslSeamF', pts, 0.002, false); }
    { const p = loftAt(lsP, s > 0 ? 0.25 : 0.75, 0.22, new V3()).multiplyScalar(1.07), sh2 = new THREE.Shape(); sh2.moveTo(0, 0.018); sh2.lineTo(0.02, -0.004); sh2.lineTo(0.012, -0.01); sh2.lineTo(0, 0.004); sh2.lineTo(-0.012, -0.01); sh2.lineTo(-0.02, -0.004); sh2.closePath();
      const o = add(el, C('emb', () => new THREE.ExtrudeGeometry(sh2, { depth: 0.002, bevelEnabled: false })), M.red); onto(o, p, new V3(s, 0, 0)); o.rotateZ(Math.PI); }
    // 커프스: 회색 띠 + 청록 테
    const cfP = (v) => ({ y: -DIMS.lArm + 0.04 - 0.05 * v, rx: 0.046, rz: 0.044 });
    add(el, C('cuff', () => loft(cfP, 28, 3)), M.grey); lRim(el, 'cfR0', cfP, 0, 0.003); lRim(el, 'cfR1', cfP, 1, 0.003, M.black);
    // 장갑 낀 손
    const hg = new THREE.Group(); hg.scale.setScalar(0.86); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.021 + 0.003 * Math.sin(v * Math.PI), rz: 0.034 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.glove);
    add(hg, C('gcuff', () => loft((v) => ({ y: 0.02 - 0.03 * v, rx: 0.036, rz: 0.04 }), 18, 2)), M.glove);
    add(hg, C('gback' + s, () => loft((v) => ({ y: -0.005 - 0.05 * v, rx: 0.024, rz: 0.037, n: 3, cx: s * 0.017 }), 12, 3, { a0: s > 0 ? 0.1 : 0.6, a1: s > 0 ? 0.4 : 0.9 })), M.gunD);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.2 + k * 0.1 : 2.6;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0082, 0.0066, { seg: 14, rad: 8 })), M.glove);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0096, 0.0072, { seg: 12, rad: 8 })), M.glove);
    if (s > 0) { // 왼 위팔 암밴드 (맨살 위) + 버클
      const abP = (v) => ({ y: -0.07 - 0.03 * v, rx: 0.045, rz: 0.043 });
      add(sh, C('aband', () => loft(abP, 28, 2)), M.leather); lRim(sh, 'abR', abP, 0.5, 0.0018, M.glow);
      const p = loftAt(abP, 0.25, 0.5, new V3()); onto(add(sh, rbox('abk', 0.02, 0.034, 0.012, 0.004), M.gunD), p.multiplyScalar(1.08), new V3(1, 0, 0));
    }
  }

  /* ---------- 다리: 오른쪽 사이하이 스타킹('08') · 왼 허벅지 탄약 밴드 + 홀스터 · 반바지 단 · 플랫폼 부츠 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.086], [0.4, 0.074], [0.85, 0.054], [1, 0.052]]), thF = spl([[0, 0.082], [0.5, 0.066], [1, 0.052]]), thB = spl([[0, 0.084], [0.35, 0.074], [1, 0.047]]);
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12)), M.skin);
    // 반바지 다리 단 (살짝 벌어짐)
    const slP = (v) => { const q = thP(0.04 + 0.2 * v); return { ...q, y: q.y + 0.03, rx: q.rx + 0.014 + 0.008 * v, rzF: q.rzF + 0.014 + 0.008 * v, rzB: q.rzB + 0.016 + 0.008 * v }; };
    add(hp, C('shLeg', () => loft(slP, 32, 4)), M.black); lRim(hp, 'shLegR', slP, 1, 0.003, M.grey);
    const cX = spl([[0, 0.052], [0.3, 0.056], [0.75, 0.037], [1, 0.031]]), cF = spl([[0, 0.05], [0.5, 0.043], [1, 0.031]]), cB = spl([[0, 0.052], [0.3, 0.068], [0.7, 0.043], [1, 0.033]]);
    const cnP = (v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) });
    if (s < 0) { // 사이하이 스타킹
      const stP = (v) => { const q = thP(0.12 + 0.88 * v); return { ...q, rx: q.rx + 0.0025, rzF: q.rzF + 0.0025, rzB: q.rzB + 0.0025 }; };
      add(hp, C('stockT', () => loft(stP, 32, 12)), M.stock);
      const tbP = (v) => { const q = stP(0.05 * v); return { ...q, rx: q.rx + 0.0025, rzF: q.rzF + 0.0025, rzB: q.rzB + 0.0025 }; };
      add(hp, C('stockBand', () => loft(tbP, 32, 2)), M.stockS);
      add(kn, C('shinS', () => loft((v) => { const q = cnP(v); return { ...q, rx: q.rx + 0.002, rzF: q.rzF + 0.002, rzB: q.rzB + 0.002 }; }, 28, 14)), M.stockS);
    } else { // 맨다리 + 탄약 밴드 · 홀스터 · 가터 고리
      add(kn, C('shin', () => loft(cnP, 28, 14)), M.skin);
      const abP = (v) => { const q = thP(0.2 + 0.05 * v); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.006, rzB: q.rzB + 0.006 }; };
      add(hp, C('ammoBand', () => loft(abP, 36, 2)), M.leather); lRim(hp, 'abG', abP, 0.5, 0.0016, M.glow);
      const shell = C('shell', () => lathe([[0.0062, -0.02], [0.0064, 0.012], [0.005, 0.016], [0.0042, 0.024], [0.002, 0.03], [0, 0.031]], 10));
      for (let i = 0; i < 7; i++) { const u = 0.3 + i * 0.045, p = loftAt(abP, u, 0.5, new V3()), n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.008); add(hp, shell, i % 2 ? M.brass : M.glow, p.toArray(), [0, 0, 0]); }
      const lbP = (v) => { const q = thP(0.42 + 0.04 * v); return { ...q, rx: q.rx + 0.005, rzF: q.rzF + 0.005, rzB: q.rzB + 0.005 }; };
      add(hp, C('holB', () => loft(lbP, 32, 2)), M.leather);
      const p = loftAt(thP, 0.25, 0.32, new V3()), o = onto(add(hp, rbox('hol', 0.024, 0.11, 0.06, 0.008), M.black), p.add(new V3(0.016, 0, 0)), new V3(1, 0, 0)); o.rotateZ(Math.PI / 2); o.rotateZ(0);
      add(o, rbox('holF', 0.026, 0.05, 0.004, 0.002), M.grey, [0.0, 0.03, 0.03]); add(o, rbox('holG', 0.004, 0.08, 0.006, 0.001), M.glow, [0, -0.01, 0.031]);
      add(hp, C('garter', () => new THREE.TorusGeometry(0.009, 0.0022, 6, 14)), M.silver, loftAt(thP, 0.34, 0.2, new V3()).multiplyScalar(1.12).toArray(), [0, 0.6, 0]);
    }
    // 플랫폼 부츠: 발목 위까지 오는 목 · 앞 교차 끈 · 굽 높은 플랫폼 밑창 (청록 발광선)
    const btP = (v) => ({ y: -DIMS.shin + 0.11 - 0.14 * v, rx: 0.042 + 0.004 * v, rzF: 0.044 + 0.012 * smooth(0.6, 1, v), rzB: 0.046 + 0.006 * v });
    add(kn, C('bootS', () => loft(btP, 32, 8)), M.leather); lRim(kn, 'bootTop', btP, 0, 0.004, M.leather);
    for (let i = 0; i < 4; i++) { const v0 = 0.12 + i * 0.2, v1 = v0 + 0.2; for (const q of [-1, 1]) { const a = loftAt(btP, 0.5 + q * 0.07, v0, new V3()).multiplyScalar(1.04), b = loftAt(btP, 0.5 - q * 0.07, v1, new V3()).multiplyScalar(1.04); rim(kn, `lace${i}${q}`, [a, a.clone().lerp(b, 0.5).multiplyScalar(1.03), b], 0.0018, false, M.grey); } }
    const fw = spl([[0, 0.0], [0.06, 0.028], [0.25, 0.036], [0.6, 0.041], [0.85, 0.034], [1, 0.012]]), fh = spl([[0, 0.028], [0.08, 0.056], [0.3, 0.06], [0.6, 0.04], [0.85, 0.03], [1, 0.016]]);
    const fb = (v) => -0.06 + 0.042 * (1 - smooth(0.3, 0.72, v));
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb(v) + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.06 + 0.24 * v); };
    add(ft, C('foot', () => surf(foot, 28, 20, { closedU: true })), M.leather);
    for (let i = 0; i < 3; i++) { const v0 = 0.5 + i * 0.09; for (const q of [-1, 1]) { const pa = new V3(), pb = new V3(); foot(0.5 + q * 0.06, v0, pa); foot(0.5 - q * 0.06, v0 + 0.09, pb); rim(ft, `flace${i}${q}`, [pa.multiplyScalar(1.03), pb.multiplyScalar(1.03)], 0.0016, false, M.grey); } }
    const PB = -0.13;
    const sole = (u, v, p) => { const [c, sn] = ang(u), w = fw(Math.min(0.98, Math.max(0.04, v))) + 0.008, top = fb(v) - 0.002, e = 0.35; const k = (Math.sign(sn) * Math.abs(sn) ** e + 1) / 2; p.set(Math.sign(c) * Math.abs(c) ** e * w, PB + (top - PB) * k, -0.07 + 0.255 * v); };
    add(ft, C('sole', () => surf(sole, 32, 18, { closedU: true })), M.sole);
    for (const kk of [0.18, 0.62]) { const pts = []; for (let i = 0; i <= 18; i++) { const v = 0.04 + 0.92 * i / 18, w = fw(v) + 0.0105; pts.push(new V3(w, PB + (fb(v) - PB) * kk, -0.07 + 0.255 * v)); } for (let i = 18; i >= 0; i--) { const v = 0.04 + 0.92 * i / 18, w = fw(v) + 0.0105; pts.push(new V3(-w, PB + (fb(v) - PB) * kk, -0.07 + 0.255 * v)); } rim(ft, 'soleG' + kk, pts, 0.0022, true); }
  }

  /* ---------- 목 · 얼굴 · 단발 · 정모 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.033 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.032 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.032 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  m.headMesh = add(H, C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] })), M.face);
  H.scale.setScalar(1.1);
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.1, -0.006], [s * 0.08, 0.104, -0.014], [s * 0.084, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.16 + 0.36 * w * w : 0.14 - 0.9 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.007 + 0.012 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(11), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), M.hair);
    // 일자 앞머리: 눈썹 바로 아래에서 반듯하게 잘림 · 양옆은 볼을 감싸며 길어짐
    for (let k = 0; k < 21; k++) {
      const t = k / 20, az = 1.12 - t * 2.24 + (r() - 0.5) * 0.03, side = Math.abs(az), tipEl = 0.13 - 0.012 * r() - 0.5 * smooth(0.5, 1.1, side);
      const pts = [headAt(az * 0.35, 1.2, 0.02), headAt(az * 0.8, 0.85, 0.03), headAt(az * 0.96, 0.55, 0.034), headAt(az, (0.55 + tipEl) / 2, 0.03), headAt(az * 1.01, tipEl, 0.02)];
      const d = dirOf(az, 0.4); clump('bang' + k, pts, (k % 2 ? 0.028 : 0.036) + r() * 0.006, 0.006, 0.22, [d.x, d.y, d.z]);
    }
    // 단발: 턱선 길이 · 끝이 바깥으로 살짝 뻗침 (뒤는 조금 짧게)
    for (let k = 0; k < 28; k++) {
      const az = (k / 28) * TAU + Math.PI * 0.5 + 0.1, w = Math.cos(az); if (w > 0.55) continue;
      const tipEl = -0.98 + 0.2 * Math.max(0, -w) + (r() - 0.5) * 0.07, flick = 0.05 + 0.02 * r();
      const pts = [headAt(az, 0.7, 0.019), headAt(az, 0.15, 0.028), headAt(az, -0.42, 0.036), headAt(az + (r() - 0.5) * 0.05, tipEl + 0.14, 0.042), headAt(az + (r() - 0.5) * 0.08, tipEl, flick)];
      const d = dirOf(az, 0); clump('bob' + k, pts, 0.046, 0.008, 0.26, [d.x, 0, d.z]);
    }
    // 바깥으로 뻗친 잔머리 몇 가닥
    for (let k = 0; k < 6; k++) { const az = (k < 3 ? 1 : -1) * (1.5 + (k % 3) * 0.5), e = -0.9 - 0.05 * (k % 3); clump('wisp' + k, [headAt(az, -0.3, 0.036), headAt(az, e + 0.1, 0.05), headAt(az + 0.1 * Math.sign(az), e - 0.05, 0.085)], 0.014, 0.002, 0.4, [Math.sin(az), 0, Math.cos(az)]); }
  }
  // 정모: 띠 · 둥글게 부푼 윗판 · 반짝이는 챙 · 은색 턱끈 · 붉은 문장 · 옆 붉은 사선 줄
  {
    const cap = new THREE.Group(); cap.position.set(0, 0.186, -0.004); cap.rotation.set(-0.02, 0, 0); cap.scale.setScalar(1.12); H.add(cap); m.cap = cap;
    const bandP = (v) => ({ y: -0.012 + 0.04 * v, rx: 0.089, rzF: 0.104, rzB: 0.1, n: 2.1 });
    add(cap, C('band', () => loft(bandP, 48, 3)), M.leather);
    const crR = spl([[0, 0.089], [0.25, 0.111], [0.5, 0.121], [0.72, 0.116], [0.88, 0.082], [0.96, 0.04], [1, 0]]), crY = spl([[0, 0.028], [0.25, 0.046], [0.5, 0.062], [0.72, 0.076], [0.88, 0.085], [1, 0.089]]);
    const crP = (v) => { const r = crR(v); return { y: crY(v), rx: r, rzF: r * 1.17, rzB: r * 1.12, cz: 0.01 * smooth(0, 0.5, v), n: 2.05 }; };
    const crMod = (p, u, v, c, sn) => { p.y += 0.016 * Math.max(0, sn) * smooth(0.2, 0.7, v); };
    add(cap, C('crown', () => loft(crP, 56, 18, { mod: crMod, poles: [18] })), M.black);
    lRim(cap, 'crownE', crP, 0.62, 0.003, M.leather, { mod: crMod, n: 72 });
    // 챙: 앞쪽 반원 · 아래로 기울어짐 (윗면 광택 · 아랫면 무광)
    const visor = (dy) => (u, v, p) => { const a = -1.25 + 2.5 * u, R = 1 + 0.62 * v * Math.cos(a * 0.9) ** 0.7, c = Math.cos(a), sn = Math.sin(a); p.set(sn * 0.091 * R, -0.012 - 0.03 * v * v - 0.006 * v + dy, c * 0.106 * R); };
    add(cap, C('visorT', () => surf(visor(0.002), 40, 6)), M.leather);
    add(cap, C('visorB', () => surf(visor(-0.002), 40, 6, { flip: true })), M.grey);
    { const pts = []; for (let i = 0; i <= 40; i++) { const p = new V3(); visor(0)(i / 40, 1, p); pts.push(p); } rim(cap, 'visorE', pts, 0.0028, false, M.leather); }
    // 은색 턱끈 + 단추
    { const pts = []; for (let i = 0; i <= 24; i++) { const a = -1.3 + 2.6 * i / 24; pts.push(new V3(Math.sin(a) * 0.0915, 0.0, Math.cos(a) * 0.1065)); } rim(cap, 'cord', pts, 0.0022, false, M.silver);
      for (const s of [-1, 1]) add(cap, C('cbtn', () => new THREE.SphereGeometry(0.005, 10, 8)), M.silver, [Math.sin(s * 1.3) * 0.092, 0, Math.cos(1.3) * 0.107]); }
    // 붉은 문장: 위로 굽은 호 + 마름모
    { const p = loftAt(crP, 0.5, 0.42, new V3(), crMod), sh = new THREE.Shape(); sh.absarc(0, -0.012, 0.03, Math.PI * 0.18, Math.PI * 0.82, false); sh.absarc(0, -0.012, 0.021, Math.PI * 0.82, Math.PI * 0.18, true); sh.closePath();
      const g = new THREE.Group(); onto(g, p.add(new V3(0, 0, 0.003)), new V3(0, 0.25, 1).normalize()); cap.add(g);
      add(g, C('embA', () => new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1, curveSegments: 16 })), M.red);
      const dm = new THREE.Shape(); dm.moveTo(0, 0.012); dm.lineTo(0.008, 0); dm.lineTo(0, -0.012); dm.lineTo(-0.008, 0); dm.closePath();
      add(g, C('embD', () => new THREE.ExtrudeGeometry(dm, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 })), M.red, [0, 0.002, 0]); }
    // 오른쪽 옆 붉은 사선 줄 셋
    for (let i = 0; i < 3; i++) { const u = 0.7 + i * 0.03, p = loftAt(crP, u, 0.36, new V3(), crMod), n = new V3(p.x, 0.15, p.z).normalize(), sh = new THREE.Shape(); sh.moveTo(-0.004, -0.012); sh.lineTo(0.004, -0.012); sh.lineTo(0.012, 0.012); sh.lineTo(0.004, 0.012); sh.closePath();
      const o = onto(add(cap, C('stripe', () => new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false })), M.red), p.addScaledVector(n, 0.001), n); o.rotateZ(0); }
  }

  /* ---------- 재킷: 팔꿈치 → 등 → 팔꿈치에 걸쳐 늘어진 천 (겉 검정 · 안 산호색) ---------- */
  let jacket = null, liningMesh = null;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    jacket = new Cloth(scene, 11, 13, 0.5, M.jacket); liningMesh = new THREE.Mesh(jacket.mesh.geometry, M.lining); liningMesh.frustumCulled = false; liningMesh.receiveShadow = true; scene.add(liningMesh);
    extras.push(jacket.mesh, liningMesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; if (jacket) jacket.mesh.geometry.dispose(); jacket = null; liningMesh = null; m._attached = false; };
  m.resetCloth = () => { if (jacket) jacket.ok = false; for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 무기: 대물 저격총 PROJECT-J ---------- */
  const rifle = new THREE.Group(); J.weapon.add(rifle); m.rifle = rifle; m.glaive = rifle;
  {
    const X = [Math.PI / 2, 0, 0], B = RF.bore;
    // 옆 윤곽(z 앞, y 위)을 x 방향으로 두께를 주어 뽑는다
    const side = (key, pts, w, holes = [], bv = 0.003) => C('rf:' + key, () => { const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y))); sh.closePath();
      for (const h of holes) { const p = new THREE.Path(); h.forEach(([z, y], i) => (i ? p.lineTo(z, y) : p.moveTo(z, y))); p.closePath(); sh.holes.push(p); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: w - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2 }); g.translate(0, 0, -(w - bv * 2) / 2); g.rotateY(-Math.PI / 2); return g; });
    // 개머리판: 골격형 + 엄지 구멍 · 뺨받침
    add(rifle, side('stock', [[RF.butt, -0.1], [RF.butt + 0.02, -0.105], [-0.2, -0.06], [-0.07, 0.005], [-0.06, 0.06], [-0.1, 0.105], [-0.25, 0.1], [RF.butt + 0.01, 0.07]], 0.042, [[[-0.26, 0.05], [-0.13, 0.06], [-0.12, 0.02], [-0.24, -0.04]]]), M.gun);
    add(rifle, side('cheek', [[-0.27, 0.1], [-0.12, 0.104], [-0.12, 0.122], [-0.26, 0.12]], 0.036), M.gunD);
    add(rifle, side('buttpad', [[RF.butt - 0.018, -0.104], [RF.butt + 0.002, -0.104], [RF.butt + 0.002, 0.076], [RF.butt - 0.018, 0.072]], 0.048), M.leather);
    // 몸통 (리시버) · 손잡이 · 방아쇠울 · 탄창
    add(rifle, side('recv', [[-0.1, B - 0.04], [RF.hg0, B - 0.04], [RF.hg0 + 0.01, B - 0.03], [RF.hg0 + 0.01, B + 0.03], [0.02, B + 0.036], [-0.1, B + 0.032]], 0.05), M.gun);
    add(rifle, side('rail', [[-0.06, B + 0.034], [RF.hg0 + 0.04, B + 0.034], [RF.hg0 + 0.04, B + 0.046], [-0.06, B + 0.046]], 0.026, [], 0.002), M.gunD);
    add(rifle, side('grip', [[-0.005, B - 0.04], [0.045, B - 0.04], [0.02, -0.075], [-0.03, -0.085], [-0.04, -0.07]], 0.034), M.gunD);
    add(rifle, side('guard', [[0.04, B - 0.04], [0.11, B - 0.04], [0.11, B - 0.048], [0.06, 0.0], [0.03, 0.0]], 0.012, [[[0.05, B - 0.05], [0.1, B - 0.05], [0.06, 0.008], [0.045, 0.008]]], 0.0015), M.gun);
    add(rifle, side('mag', [[0.12, B - 0.04], [0.2, B - 0.04], [0.19, -0.075], [0.115, -0.07]], 0.04), M.gunD);
    add(rifle, side('magP', [[0.11, -0.068], [0.196, -0.072], [0.194, -0.084], [0.108, -0.08]], 0.044), M.gun);
    // 총열 덮개 (팔각) · 총열 · 머즐 브레이크
    const hgP = (v) => ({ y: RF.hg0 + (RF.hg1 - RF.hg0) * v, rx: 0.024 - 0.003 * v, rz: 0.03 - 0.004 * v, n: 3.2, cz: -B });
    add(rifle, C('rf:hg', () => { const g = loft(hgP, 16, 6); g.rotateX(Math.PI / 2); return g; }), M.gun);
    add(rifle, C('rf:barrel', () => new THREE.CylinderGeometry(0.0125, 0.0145, RF.muzzle - RF.hg1, 16, 1, true)), M.gunD, [0, B, (RF.hg1 + RF.muzzle - 0.08) / 2 + 0.0], X);
    add(rifle, side('brake', [[RF.muzzle - 0.1, B - 0.022], [RF.muzzle, B - 0.02], [RF.muzzle, B + 0.02], [RF.muzzle - 0.1, B + 0.022]], 0.04, [[[RF.muzzle - 0.085, B - 0.012], [RF.muzzle - 0.06, B - 0.012], [RF.muzzle - 0.06, B + 0.012], [RF.muzzle - 0.085, B + 0.012]], [[RF.muzzle - 0.045, B - 0.012], [RF.muzzle - 0.02, B - 0.012], [RF.muzzle - 0.02, B + 0.012], [RF.muzzle - 0.045, B + 0.012]]]), M.gun);
    add(rifle, C('rf:bore', () => new THREE.CircleGeometry(0.009, 12)), M.lens, [0, B, RF.muzzle + 0.001]);
    // 접힌 양각대
    for (const s of [-1, 1]) add(rifle, C('rf:bipod' + s, () => strand([[s * 0.012, B - 0.035, RF.hg1 - 0.04], [s * 0.016, B - 0.048, RF.hg1 - 0.14], [s * 0.016, B - 0.05, RF.hg1 - 0.3]], 0.0055, 0.0045, { seg: 10, rad: 6 })), M.gunD);
    add(rifle, C('rf:bipodH', () => new THREE.CylinderGeometry(0.008, 0.008, 0.04, 10)), M.gunD, [0, B - 0.035, RF.hg1 - 0.04], [0, 0, Math.PI / 2]);
    // 스코프: 접안 · 관 · 대물 렌즈 · 조절 손잡이 · 고정 고리
    const S = RF.scopeY;
    add(rifle, C('rf:scope', () => { const g = lathe([[0.0, -0.06], [0.024, -0.06], [0.026, -0.05], [0.02, -0.02], [0.018, 0.0], [0.018, 0.28], [0.03, 0.34], [0.031, 0.4], [0.0, 0.4]], 28); g.rotateX(Math.PI / 2); return g; }), M.gun, [0, S, 0]);
    add(rifle, C('rf:lensF', () => new THREE.CircleGeometry(0.027, 24)), M.lens, [0, S, 0.401]);
    add(rifle, C('rf:lensB', () => new THREE.CircleGeometry(0.02, 20)), M.lens, [0, S, -0.061], [0, Math.PI, 0]);
    for (const [p, r] of [[[0, S + 0.026, 0.13], [0, 0, 0]], [[0.026, S, 0.13], [0, 0, -Math.PI / 2]]]) add(rifle, C('rf:knob', () => new THREE.CylinderGeometry(0.011, 0.012, 0.018, 14)), M.gunD, p, r);
    for (const z of [0.03, 0.24]) { add(rifle, C('rf:ring', () => new THREE.TorusGeometry(0.02, 0.0045, 8, 20)), M.gunD, [0, S, z]); add(rifle, rbox('mount', 0.022, S - B - 0.04, 0.016, 0.003), M.gunD, [0, (S + B + 0.04) / 2 - 0.01, z]); }
    // 청록 고리 장치 (왼쪽) · 발광선 · 렌즈
    add(rifle, C('rf:halo', () => new THREE.TorusGeometry(0.034, 0.004, 8, 32)), M.glow, [0.03, B, 0.14], [0, Math.PI / 2, 0]);
    add(rifle, C('rf:haloC', () => new THREE.CylinderGeometry(0.012, 0.012, 0.012, 14)), M.gunD, [0.028, B, 0.14], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) {
      const sx = s * 0.0255;
      rim(rifle, 'rf:gl1' + s, [[sx, B + 0.012, -0.09], [sx, B + 0.012, 0.0], [sx, B - 0.02, 0.05], [sx, B - 0.02, RF.hg0]].map((q) => new V3(...q)), 0.0016, false);
      rim(rifle, 'rf:gl2' + s, [[s * 0.022, B + 0.008, RF.hg0 + 0.02], [s * 0.021, B + 0.008, RF.hg0 + 0.22], [s * 0.02, B - 0.014, RF.hg0 + 0.3], [s * 0.019, B - 0.014, RF.hg1 - 0.02]].map((q) => new V3(...q)), 0.0015, false);
      rim(rifle, 'rf:gl3' + s, [[s * 0.0215, -0.08, RF.butt + 0.03], [s * 0.0215, -0.04, -0.2], [s * 0.0215, 0.0, -0.09]].map((q) => new V3(...q)), 0.0015, false);
      rim(rifle, 'rf:gl4' + s, [[s * 0.0215, 0.09, RF.butt + 0.02], [s * 0.0215, 0.095, -0.12]].map((q) => new V3(...q)), 0.0015, false);
      // 표기: 개머리판 '20' · 총열 덮개 'PROJECT-J' · 스코프 '08'
      const rotY = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      add(rifle, C('rf:pl20', () => new THREE.PlaneGeometry(0.07, 0.035)), M.d20, [s * 0.0225, 0.02, -0.215], [0, rotY, 0]);
      add(rifle, C('rf:plPJ', () => new THREE.PlaneGeometry(0.2, 0.025)), M.dPJ, [s * 0.0248, B - 0.006, RF.hg0 + 0.16], [0, rotY, 0]);
      add(rifle, C('rf:pl20b', () => new THREE.PlaneGeometry(0.05, 0.025)), M.d20b, [s * 0.021, B + 0.002, RF.hg1 - 0.06], [0, rotY, 0]);
      add(rifle, C('rf:pl08', () => new THREE.PlaneGeometry(0.04, 0.02)), M.d08, [s * 0.0195, S, 0.18], [0, rotY, 0]);
    }
  }

  /* ---------- 매 프레임: 왼손 IK · 재킷 천 · 로프 · 얼굴 · 발광 ---------- */
  const tmp = new V3(), tmp2 = new V3(), tS = new V3(), tT = new V3(), tE = new V3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), dn = new V3(0, -1, 0), rq = new THREE.Quaternion();
  const jA = Array.from({ length: 9 }, () => new V3()), jLen = [];
  m.ikW = 0; m.glow = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    // 왼손 IK: 조준하는 기술 중에는 총열 덮개를 받친다 (ikOff 기술 · 무기 없음이면 끔)
    const want = m.weaponOut || !rifle.visible ? 0 : f.state === 'act' ? (f.act.ikOff ? 0 : 1) : f.state === 'guard' ? 1 : 0;
    m.ikW += (want - m.ikW) * Math.min(1, dt * 14);
    if (m.ikW > 0.02) {
      J.chest.updateMatrixWorld(true); J.weapon.updateMatrixWorld(true);
      J.shoulderL.getWorldPosition(tS); J.weapon.localToWorld(tT.set(0.028, B0 - 0.05, RF.grip2));
      const L1 = DIMS.uArm * sc, L2 = (DIMS.lArm + 0.03) * sc;
      const natural = J.handL.getWorldPosition(new V3()); tT.lerp(natural, 1 - m.ikW);
      const d = clamp(tT.distanceTo(tS), 0.05, L1 + L2 - 0.002), dir = tT.clone().sub(tS).normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const hint = new V3(0, -1, 0).addScaledVector(f.fwd(new V3()), -0.2).add(f.right(new V3()).multiplyScalar(-0.6));
      const n = hint.addScaledVector(dir, -hint.dot(dir)).normalize();
      tE.copy(tS).addScaledVector(dir, a).addScaledVector(n, h);
      J.shoulderL.parent.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tE.clone().sub(tS).normalize()); J.shoulderL.quaternion.copy(q0.clone().invert().multiply(q1)); J.shoulderL.updateMatrixWorld(true);
      J.shoulderL.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tT.clone().sub(tE).normalize()); J.elbowL.quaternion.copy(q0.clone().invert().multiply(q1)); J.elbowL.updateMatrixWorld(true);
      J.handL.rotation.set(0, 0, -1.4 * m.ikW); J.handL.updateMatrixWorld(true);
    }
    J.chest.updateMatrixWorld(true);
    // 재킷 고정선: 왼 팔꿈치 앞 → 왼 위팔 → 등 → 오른 위팔 → 오른 팔꿈치 앞 (호 길이로 고르게 나눔)
    if (jacket) {
      J.elbowL.localToWorld(jA[0].set(0.03, -0.03, 0.05)); J.shoulderL.localToWorld(jA[1].set(0.07, -0.19, -0.02)); J.chest.localToWorld(jA[2].set(0.13, 0.14, -0.1));
      J.chest.localToWorld(jA[3].set(0.07, 0.15, -0.11)); J.chest.localToWorld(jA[4].set(0, 0.15, -0.115)); J.chest.localToWorld(jA[5].set(-0.07, 0.15, -0.11));
      J.chest.localToWorld(jA[6].set(-0.13, 0.17, -0.1)); J.shoulderR.localToWorld(jA[7].set(-0.07, -0.09, -0.02)); J.elbowR.localToWorld(jA[8].set(-0.03, -0.03, 0.05));
      let tot = 0; jLen[0] = 0; for (let i = 1; i < 9; i++) { tot += jA[i].distanceTo(jA[i - 1]); jLen[i] = tot; }
      const W = jacket.W; let s0 = 0;
      for (let i = 0; i < W; i++) { const L = tot * i / (W - 1); while (s0 < 7 && jLen[s0 + 1] < L) s0++; const k = (L - jLen[s0]) / Math.max(1e-6, jLen[s0 + 1] - jLen[s0]); jacket.anchors[i].lerpVectors(jA[s0], jA[s0 + 1], clamp(k, 0, 1)); }
      const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.035 * sc })), arms = f.hurt.slice(2, 6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * sc })), h0 = f.hurt[0];
      const hp = J.hips.getWorldPosition(tmp2), s2 = hp.clone().add(new V3(0, -0.06 * sc, 0));
      const caps = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.2), r: h0.r * 0.78 + 0.04 * sc }, ...arms, ...legs, { a: s2, b: s2, r: 0.17 * sc }];
      const wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 0.8, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 0.8];
      jacket.len = 0.5 * sc; jacket.mesh.visible = liningMesh.visible = vis; jacket.step(dt, caps, f.pos.y + 0.02, wind);
    }
    // 매달린 끈
    if (m.ropes.length) { const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.02 * sc })); m.root.getWorldQuaternion(rq); const windV = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6);
      for (const r of m.ropes) { r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); r.rope.step(dt, tmp, legs, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.view.mesh.visible = vis; } }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    // 청록 발광: 기본 은은하게 · 충전/개방 중 밝게
    const wantG = Math.max(f.chargeK || 0, f.stK && f.stK('atk', 1) > 1 ? 0.8 : 0, f.manaFull ? 0.5 : 0); m.glow += (wantG - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.88 + 0.12 * Math.sin(f.G.time * 6);
    M.glow.emissiveIntensity = (1.3 + m.glow * 2.2) * pulse; M.lens.emissiveIntensity = (0.8 + m.glow * 2.5) * pulse; M.jacket.emissiveIntensity = 0.7 + m.glow * 0.8;
    for (const o of extras) o.visible = vis;
  };
  const B0 = RF.bore;
  m.setWeapon = (v) => { rifle.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.135;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 판정 (개머리판 휘두르기 등): 개머리판 끝 ~ 총구 / 궤적: 개머리판 쪽만
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, RF.butt)); J.weapon.localToWorld(t.set(0, B0, RF.muzzle)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0.06, -0.05)); J.weapon.localToWorld(t.set(0, -0.06, RF.butt)); };
  m.muzzle = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, B0, RF.muzzle + 0.02)); };
  m.scopePt = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, RF.scopeY, 0.4)); };
  m.butt = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, RF.butt)); };
  m.extras = extras;
  return m;
}
