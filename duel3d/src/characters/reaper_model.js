// 그레이브 (GRAVE) — 3D 모델 (기술·포즈는 reaper.js)
// 사슬 갈고리로 사냥감을 끌어오는 흉터투성이 현상금 사냥꾼.
//
// 구성: 보라 빛이 도는 헝클어진 검은 머리 · 오른 눈썹을 가르는 흉터 · 코와 입을 덮는 가죽 마스크
//       찢어진 보라 목도리(겹겹이 감은 두건 + 등 뒤로 늘어진 자락: 천 물리)
//       민소매 검은 튜닉 · 가슴을 가로지르는 가죽 끈과 버클 · 굵은 팔 (위팔 붕대)
//       왼 어깨: 리벳 박힌 녹슨 주황 견갑 (오른 어깨는 작은 견갑) · 가죽 벨트 + 주머니 + 빛나는 자홍 독병 셋 + 꼰 밧줄
//       허리 앞뒤로 늘어진 찢어진 보라 천(천 물리) · 옆 튜닉 자락 · 헐렁한 검은 바지 · 왼 무릎 녹슨 무릎 보호대
//       정강이 붕대 · 끈 달린 무거운 장화
//       오른팔: 팔뚝을 감은 굵은 사슬 · 손에 쥔 긴 사슬(로프 물리) 끝의 세 갈래 갈고리 (자홍 빛 날)
//       왼팔: 이빨이 줄지어 박힌 아가리 모양 녹슨 건틀릿 (벌렸다 다물며 문다)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeChain } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
// 큰 체격: 넓은 어깨 · 굵은 팔다리
export const DIMS = { hipH: 0.97, spineL: 0.2, chestL: 0.29, neckL: 0.075, shW: 0.215, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.46, shin: 0.45, headTop: 0.25 };
// 사슬 길이 (m, 몸 크기 배율 전): 늘어뜨림 · 채찍 기본
export const CH = { idle: 0.46, whip: 3.8, links: 400, pitch: 0.05 };
export const MAG = 0xff2ad8, MAG2 = 0xff9af0, PURP = 0x6a2a8a, RUST = 0xc0642a, POIS = 0xb02ae0;
const C = (k, fn) => cached('reaper:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 얼룩 (낡은 천 · 녹)
function blotch(g, W, H, n, cols, r0, r1, seed) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, rr = r0 + r() * (r1 - r0), gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, cols[i % cols.length]); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } }
function scratches(g, W, H, n, col, seed, len = 30) { const r = rng(seed); g.strokeStyle = col; for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, a = r() * TAU, l = len * (0.3 + r()); g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }
// 낡은 검은 천 (튜닉 · 바지): 세로 주름 · 해진 얼룩
function blackClothTex(seed = 3, rep = [2, 2]) {
  const W = 256, H = 256, [c, g] = cv(W, H); g.fillStyle = '#1b1a1d'; g.fillRect(0, 0, W, H);
  const r = rng(seed); for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)'; g.fillRect(r() * W, r() * H, 1 + r() * 2, 4 + r() * 10); }
  blotch(g, W, H, 14, ['rgba(70,55,50,0.22)', 'rgba(0,0,0,0.3)', 'rgba(60,45,70,0.18)'], 10, 40, seed + 7);
  return tex(c, rep);
}
// 어두운 가죽 (벨트 · 끈 · 장화 · 마스크): 긁힘 · 테두리 바느질
function leatherTex(base = '#3a261a', seed = 5, rep = [1, 1], stitch = true) {
  const W = 256, H = 256, [c, g] = cv(W, H); g.fillStyle = base; g.fillRect(0, 0, W, H);
  blotch(g, W, H, 24, ['rgba(0,0,0,0.3)', 'rgba(120,80,50,0.18)'], 8, 34, seed);
  scratches(g, W, H, 50, 'rgba(150,110,80,0.25)', seed + 3, 16); scratches(g, W, H, 30, 'rgba(0,0,0,0.35)', seed + 9, 12);
  if (stitch) { g.strokeStyle = 'rgba(190,160,120,0.55)'; g.lineWidth = 2; g.setLineDash([6, 6]); for (const y of [10, H - 10]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.setLineDash([]); }
  return tex(c, rep);
}
// 녹슨 주황 철판: 녹 얼룩 · 긁힘 · 구멍 · 테두리 어두움
function rustTex(seed = 11, rep = [1, 1]) {
  const W = 512, H = 512, [c, g] = cv(W, H); g.fillStyle = '#b8642e'; g.fillRect(0, 0, W, H);
  blotch(g, W, H, 60, ['rgba(110,45,20,0.55)', 'rgba(230,140,70,0.4)', 'rgba(70,30,15,0.5)', 'rgba(200,110,50,0.35)'], 10, 60, seed);
  const r = rng(seed + 1); for (let i = 0; i < 1800; i++) { g.fillStyle = r() < 0.6 ? 'rgba(60,25,10,0.45)' : 'rgba(250,170,100,0.3)'; const s = 1 + r() * 2.5; g.fillRect(r() * W, r() * H, s, s); }
  scratches(g, W, H, 80, 'rgba(250,200,150,0.35)', seed + 2, 40); scratches(g, W, H, 40, 'rgba(40,15,5,0.5)', seed + 4, 24);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(40,15,5,0.5)'); gr.addColorStop(0.12, 'rgba(0,0,0,0)'); gr.addColorStop(0.88, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,15,5,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return tex(c, rep);
}
// 찢어진 보라 천 (천 물리 자락): 캔버스 위 = 고정 줄, 아래 끝이 들쭉날쭉 찢어지고 구멍이 뚫림 (alphaTest)
function tornTex(top, bot, seed, holes = 3) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0);
  let y = H * (0.8 + r() * 0.12); for (let x = W; x >= 0; x -= 10 + r() * 14) { y = H * (0.66 + r() * 0.33); g.lineTo(x, y); g.lineTo(x - 4, y - 20 - r() * 50); }
  g.lineTo(0, H * 0.75); g.closePath(); g.fill();
  // 결 · 얼룩 · 해진 세로 줄
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 70; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(220,170,255,0.08)'; g.lineWidth = 1 + r() * 3; const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 20, H); g.stroke(); }
  blotch(g, W, H, 12, ['rgba(20,5,25,0.4)', 'rgba(70,45,30,0.3)'], 14, 50, seed + 5);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < holes; i++) { const x = 30 + r() * (W - 60), yy = H * (0.3 + r() * 0.35); g.beginPath(); g.ellipse(x, yy, 4 + r() * 8, 8 + r() * 16, r(), 0, TAU); g.fill(); }
  // 양옆 가장자리 해짐
  for (let i = 0; i < 18; i++) { const sd = i % 2, yy = r() * H; g.beginPath(); g.moveTo(sd * W, yy); g.lineTo(sd * W + (sd ? -1 : 1) * (4 + r() * 10), yy + 6); g.lineTo(sd * W, yy + 14); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  const t = tex(c); return t;
}
// 목도리(두건) 결: 감긴 주름 · 보라
function scarfTex(a, b) {
  const W = 256, H = 256, [c, g] = cv(W, H); g.fillStyle = a; g.fillRect(0, 0, W, H); const r = rng(17);
  for (let i = 0; i < 26; i++) { const y = r() * H, gr = g.createLinearGradient(0, y - 12, 0, y + 12); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, i % 2 ? 'rgba(10,0,15,0.45)' : b); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y - 12, W, 24); }
  blotch(g, W, H, 10, ['rgba(20,5,25,0.35)'], 10, 40, 23); return tex(c, [3, 1]);
}
// 붕대: 비스듬한 감김 줄 · 얼룩
function bandageTex() {
  const W = 128, H = 256, [c, g] = cv(W, H); g.fillStyle = '#d8ccb4'; g.fillRect(0, 0, W, H);
  for (let y = -40; y < H + 40; y += 22) { g.strokeStyle = 'rgba(110,90,70,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 26); g.stroke(); g.strokeStyle = 'rgba(255,250,235,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y + 5); g.lineTo(W, y + 31); g.stroke(); }
  blotch(g, W, H, 8, ['rgba(120,90,60,0.3)', 'rgba(90,40,30,0.18)'], 8, 24, 31); return tex(c, [2, 2]);
}
// 검은 머리 (보라 윤기): strand uv v 뿌리 0 → 끝 1
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(43), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#0e0b10'); gr.addColorStop(1, '#0b090d'); } else { gr.addColorStop(0, '#3a2048'); gr.addColorStop(0.25, '#161018'); gr.addColorStop(1, '#0c0a0e'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.5 ? 'rgba(0,0,0,0.5)' : 'rgba(140,90,180,0.12)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 14, H / 2, x + (r() - 0.5) * 8, 0); g.stroke(); }
  return tex(c);
}
// 꼰 밧줄 (벨트 · 갈고리 자루 감개)
function ropeTex(a, b, hi) {
  const W = 64, H = 256, [c, g] = cv(W, H); g.fillStyle = a; g.fillRect(0, 0, W, H);
  for (let y = -32; y < H + 32; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 17); gr.addColorStop(0, b); gr.addColorStop(0.5, hi); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 20); g.lineTo(W, y + 31); g.lineTo(0, y + 11); g.closePath(); g.fill(); }
  return tex(c, [1, 8]);
}
// 장화 / 바지 경계 같은 단색 + 노이즈
function noiseTex(base, seed, rep = [1, 1]) { const W = 128, H = 128, [c, g] = cv(W, H); g.fillStyle = base; g.fillRect(0, 0, W, H); blotch(g, W, H, 16, ['rgba(0,0,0,0.3)', 'rgba(255,255,255,0.06)'], 6, 22, seed); return tex(c, rep); }

/* ---------- 얼굴: 실제 비율 · 무표정 · 오른 눈썹을 가르는 흉터 (아래 얼굴은 가죽 마스크) ---------- */
const HEAD = animeHead({ C: new V3(0, 0.104, 0.008), R: [0.075, 0.103, 0.092], jaw: 0.22, jaw0: 0.15, chin: 0.012, square: 0.75, nose: 1.15, brow: 0.0045, cheek: 0.003 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  g.fillStyle = '#c99a80'; g.fillRect(0, 0, W, H);
  const [fx, fy] = P(0, 0.08), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(240,205,180,0.45)'); gr.addColorStop(0.6, 'rgba(220,180,160,0)'); gr.addColorStop(1, 'rgba(120,80,70,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 눈가 그늘 (마스크 위 · 깊은 눈두덩)
  g.save(); g.filter = 'blur(10px)'; g.fillStyle = 'rgba(70,40,40,0.35)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.032, Y.eyeY + 0.002); g.beginPath(); g.ellipse(x, y, 70, 26, 0, 0, TAU); g.fill(); } g.restore();
  // 흉터: 오른 눈썹 위에서 눈 아래 광대까지 비스듬히 (x 음수 = 캐릭터 오른쪽)
  { const pts = [[-0.022, Y.browY + 0.024], [-0.03, Y.browY + 0.004], [-0.036, Y.eyeY - 0.006], [-0.042, Y.eyeY - 0.022]].map(([x, y]) => M(x, y));
    g.lineCap = 'round'; g.strokeStyle = 'rgba(120,50,50,0.85)'; g.lineWidth = 9; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.strokeStyle = 'rgba(235,170,150,0.7)'; g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 4; i++) { const [x, y] = M(-0.026 - i * 0.005, Y.browY + 0.016 - i * 0.012); g.strokeStyle = 'rgba(120,50,50,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 10, y - 4); g.lineTo(x + 10, y + 4); g.stroke(); } }
  // 이목구비는 공용 설정(FACE_FEATURES)을 따른다 — 무표정
  paintFace(g, M, { ...Y, male: true, tilt: 0.02, lidDrop: 0.16, open, noMouth: true, iris: ['#e8b0ff', '#a050d0', '#4a1a6a', '#1a0826'], pupil: '#0e0612', lash: '#141016', brow: '#18121a', browW: 0.005 });
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
  const glow = pal.glow ?? MAG, clothA = pal.cloth || ['#6a2c86', '#3a1648'], tag = pal.tag || 'a';
  const M = {
    skin: phys({ color: 0xc8967c, emissive: 0x4a2a22, emissiveIntensity: 0.32, roughness: 0.55, sheen: 0.35, sheenColor: new THREE.Color(0xffc8a8) }),
    face: phys({ map: T('face', () => faceTex(false)), emissiveMap: T('face', () => faceTex(false)), emissive: 0x4a3430, emissiveIntensity: 0.9, roughness: 0.55, sheen: 0.35, sheenColor: new THREE.Color(0xffc8a8) }),
    faceO: phys({ map: T('faceO', () => faceTex(true)), emissiveMap: T('faceO', () => faceTex(true)), emissive: 0x4a3430, emissiveIntensity: 0.9, roughness: 0.55 }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x6a3a90), sheenRoughness: 0.45 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x5a3480), sheenRoughness: 0.45 }),
    tunic: phys({ map: T('tunic', () => blackClothTex(3, [3, 2])), roughness: 0.75, sheen: 0.5, sheenColor: new THREE.Color(0x6a6070) }),
    pants: phys({ map: T('pants', () => blackClothTex(9, [2, 3])), roughness: 0.8, sheen: 0.5, sheenColor: new THREE.Color(0x605868) }),
    leather: phys({ map: T('lth', () => leatherTex('#3a261a', 5, [2, 1])), roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    leatherD: phys({ map: T('lthD', () => leatherTex('#241812', 8, [2, 1])), roughness: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.45 }),
    strap: phys({ map: T('strap', () => leatherTex('#4a2e1c', 13, [1, 6])), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    mask: phys({ map: T('mask', () => leatherTex('#2a201c', 21, [2, 1])), roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    boot: phys({ map: T('boot', () => leatherTex('#2c1c16', 27, [2, 2], false)), roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.35 }),
    soleM: phys({ map: T('sole', () => noiseTex('#16110f', 4)), roughness: 0.85 }),
    rust: phys({ map: T('rust', () => rustTex(11)), roughness: 0.7, metalness: 0.35, envMapIntensity: 0.5 }),
    rustD: phys({ map: T('rustD', () => rustTex(29)), color: 0x9a7a6a, roughness: 0.75, metalness: 0.4, envMapIntensity: 0.5 }),
    iron: phys({ color: 0x4a403c, metalness: 0.85, roughness: 0.42, envMapIntensity: 0.8 }),
    ironD: phys({ color: 0x2c2624, metalness: 0.8, roughness: 0.5, envMapIntensity: 0.6 }),
    rivet: phys({ color: 0x6a5a50, metalness: 0.9, roughness: 0.35 }),
    tooth: phys({ color: 0xb8aea0, metalness: 0.75, roughness: 0.3, envMapIntensity: 1.1 }),
    maw: phys({ color: 0x1a0a10, roughness: 0.8, emissive: glow, emissiveIntensity: 0.05 }),
    bandage: phys({ map: T('band', bandageTex), roughness: 0.85, sheen: 0.4, sheenColor: new THREE.Color(0xfff0d8) }),
    scarf: phys({ map: T('scarf' + tag, () => scarfTex(clothA[0], 'rgba(200,140,230,0.18)')), roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color(0xc890e8) }),
    torn: phys({ map: T('torn' + tag, () => tornTex(clothA[0], clothA[1], 51)), alphaTest: 0.5, roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color(0xc890e8) }),
    tornB: phys({ map: T('tornB' + tag, () => tornTex(clothA[0], clothA[1], 77, 4)), alphaTest: 0.5, roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color(0xc890e8) }),
    tornS: phys({ map: T('tornS' + tag, () => tornTex(clothA[0], clothA[1], 91, 2)), alphaTest: 0.5, roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color(0xc890e8) }),
    tornK: phys({ map: T('tornK', () => tornTex('#1e1c20', '#121114', 63, 1)), alphaTest: 0.5, roughness: 0.8, sheen: 0.5, sheenColor: new THREE.Color(0x605868) }),
    rope: phys({ map: T('rope', () => ropeTex('#6a5440', '#4a3828', '#9a8060')), roughness: 0.85 }),
    glass: phys({ color: 0xf0d8ff, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.45, clearcoat: 1, depthWrite: false }),
    potion: phys({ color: glow, emissive: glow, emissiveIntensity: 1.4, roughness: 0.2, transparent: true, opacity: 0.92 }),
    cork: phys({ color: 0x9a7048, roughness: 0.9 }),
    hookM: phys({ color: 0x3a3236, metalness: 0.85, roughness: 0.35, envMapIntensity: 1 }),
    edge: new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    nail: phys({ color: 0xb08878, roughness: 0.4 }),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.edge && mat !== M.glass; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.iron) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const rivetG = C('rivet', () => new THREE.SphereGeometry(0.0065, 10, 8));
  // 곡면 위 리벳 줄: prof 의 높이 v 에서 각도 a0~a1 사이에 n 개
  const rivets = (parent, prof, v, a0, a1, n, out = 1.03, mat = M.rivet) => { for (let i = 0; i < n; i++) { const p = loftAt(prof, a0 + (a1 - a0) * ((i + 0.5) / n), v, new V3()), q = new V3(p.x, 0, p.z); add(parent, rivetG, mat, [p.x + (q.x / (q.length() || 1)) * 0.003 * out, p.y, p.z + (q.z / (q.length() || 1)) * 0.003 * out]); } };
  const buckle = (parent, p, rot = [0, 0, 0], sc = 1) => { const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...rot); g.scale.setScalar(sc); parent.add(g);
    add(g, C('buckle', () => { const sh = new THREE.Shape(); sh.moveTo(-0.02, -0.016); sh.lineTo(0.02, -0.016); sh.lineTo(0.02, 0.016); sh.lineTo(-0.02, 0.016); sh.closePath(); const h = new THREE.Path(); h.moveTo(-0.013, -0.009); h.lineTo(-0.013, 0.009); h.lineTo(0.013, 0.009); h.lineTo(0.013, -0.009); h.closePath(); sh.holes.push(h); return new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 }); }), M.iron);
    add(g, C('buckleP', () => new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 6)), M.iron, [0, 0, 0.004]); return g; };

  /* ---------- 골반 · 바지 · 벨트 · 독병 · 주머니 · 옆 튜닉 자락 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: -0.14 + 0.24 * v, rx: 0.174 - 0.012 * v, rzF: 0.124, rzB: 0.136, n: 2.2 }), 40, 8)), M.pants);
  const bX = spl([[0, 0.164], [0.45, 0.158], [1, 0.166]]), bF = spl([[0, 0.118], [0.5, 0.114], [1, 0.12]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.05 + 0.27 * v, rx: bX(v), rzF: bF(v), rzB: 0.112, n: 2.2 }), 40, 10, { uvU: 1 })), M.tunic);
  const beltP = (v) => ({ y: 0.025 + 0.068 * v, rx: 0.184, rzF: 0.134, rzB: 0.142, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 64, 4, { uvU: 3 })), M.leather); lRim(J.hips, 'beltR0', beltP, 0, 0.0035, M.leatherD); lRim(J.hips, 'beltR1', beltP, 1, 0.0035, M.leatherD);
  // 녹슨 사각 버클
  { const p = loftAt(beltP, 0.5, 0.5, new V3()); const g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.004); J.hips.add(g);
    add(g, C('bbuck', () => { const sh = new THREE.Shape(); sh.moveTo(-0.045, -0.04); sh.lineTo(0.045, -0.04); sh.lineTo(0.045, 0.04); sh.lineTo(-0.045, 0.04); sh.closePath(); const h = new THREE.Path(); h.moveTo(-0.03, -0.026); h.lineTo(-0.03, 0.026); h.lineTo(0.03, 0.026); h.lineTo(0.03, -0.026); h.closePath(); sh.holes.push(h); return new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }); }), M.rustD);
    add(g, C('bbuckP', () => new THREE.CylinderGeometry(0.005, 0.005, 0.07, 8)), M.iron, [0.0, 0, 0.008]); }
  // 꼰 밧줄 벨트: 벨트 아래로 비스듬히 처짐
  { const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48, p = loftAt(beltP, a, 0, new V3()); p.multiplyScalar(1.05); p.y = 0.02 - 0.03 * Math.max(0, Math.cos((a - 0.62) * TAU)) - 0.006; pts.push(p); } rim(J.hips, 'ropeBelt', pts, 0.008, true, M.rope); }
  // 주머니: 오른 옆 · 오른 뒤 · 왼 뒤
  const pouch = (a, key, w, h) => { const p = loftAt(beltP, a, 0.3, new V3()), n = new V3(p.x, 0, p.z).normalize(), g = new THREE.Group(); g.position.copy(p).addScaledVector(n, 0.024); g.rotation.y = Math.atan2(n.x, n.z); J.hips.add(g);
    add(g, C('pouch' + key, () => loft((v) => ({ y: 0.02 - h * v, rx: w * (1 - 0.1 * v), rz: 0.022 + 0.004 * Math.sin(v * Math.PI), n: 4 }), 16, 6)), M.leatherD);
    add(g, C('pflap' + key, () => surf((u, v, q) => { const x = (u - 0.5) * 2 * (w + 0.003); q.set(x, 0.024 - 0.05 * v, 0.024 + 0.004 * Math.cos(x / w * 1.5) - 0.002 * v); }, 8, 4)), M.leather);
    add(g, rivetG, M.iron, [0, -0.022, 0.028]); };
  pouch(0.71, 'A', 0.036, 0.085); pouch(0.84, 'B', 0.032, 0.075); pouch(0.12, 'C', 0.034, 0.08);
  // 독병 세 개 (자홍빛 액체 · 코르크 · 가죽 고리) — 앞 왼쪽
  m.vials = [];
  { const bottle = C('vial', () => lathe([[0.0, -0.05], [0.017, -0.048], [0.021, -0.03], [0.021, 0.0], [0.012, 0.012], [0.008, 0.022], [0.009, 0.03], [0.0, 0.03]], 18));
    const liquid = C('vialL', () => lathe([[0.0, -0.046], [0.015, -0.044], [0.018, -0.03], [0.018, -0.006], [0.0, -0.006]], 16));
    for (const [a, i] of [[0.335, 0], [0.375, 1], [0.415, 2]]) {
      const p = loftAt(beltP, a, 0.15, new V3()), n = new V3(p.x, 0, p.z).normalize(), g = new THREE.Group(); g.position.copy(p).addScaledVector(n, 0.026); g.position.y -= 0.025; g.rotation.y = Math.atan2(n.x, n.z); g.rotation.z = (i - 1) * 0.06; J.hips.add(g);
      add(g, liquid, M.potion); add(g, bottle, M.glass); add(g, C('cork', () => new THREE.CylinderGeometry(0.0085, 0.007, 0.016, 10)), M.cork, [0, 0.036, 0]);
      add(g, C('vialLoop', () => new THREE.TorusGeometry(0.023, 0.0045, 6, 20)), M.leatherD, [0, -0.012, 0], [Math.PI / 2, 0, 0]);
      add(g, C('vialStrap', () => strand([[0, 0.012, 0.0], [0, 0.03, 0.006], [0, 0.05, 0.002]], 0.006, 0.006, { seg: 6, rad: 6, flat: 0.3, ref: [0, 0, 1] })), M.leatherD, [0, 0, -0.022]);
      m.vials.push(g);
    } }
  // 옆 튜닉 자락 (찢어진 검은 천, 양옆만 — 앞뒤는 보라 천 물리)
  for (const [a0, a1, k] of [[0.13, 0.36, 'L'], [0.64, 0.87, 'R']]) add(J.hips, C('skirt' + k, () => loft((v) => ({ y: 0.04 - 0.24 * v, rx: 0.186 + 0.05 * v, rzF: 0.136 + 0.035 * v, rzB: 0.144 + 0.04 * v, n: 2.3 }), 20, 6, { a0, a1, flip: true })), M.tornK);

  /* ---------- 상체: 근육질 가슴 · 민소매 튜닉 · 가로지르는 가죽 끈 ---------- */
  const chX = spl([[0, 0.162], [0.3, 0.174], [0.6, 0.192], [0.82, 0.198], [1, 0.15]]), chF = spl([[0, 0.118], [0.5, 0.128], [0.8, 0.124], [1, 0.09]]), chB = spl([[0, 0.114], [0.5, 0.124], [0.8, 0.128], [1, 0.092]]);
  const chP = (v) => ({ y: -0.02 + 0.31 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.3 });
  const chMod = (p, u, v, c, sn) => { const ax = Math.abs(p.x);
    if (sn > 0) { p.z += 0.022 * gauss(ax - 0.07, 0.05) * gauss(p.y - 0.18, 0.05) * Math.pow(sn, 1.5); p.z -= 0.005 * gauss(p.x, 0.012) * gauss(p.y - 0.12, 0.12) * sn; }
    else { p.z -= 0.012 * gauss(ax - 0.085, 0.05) * gauss(p.y - 0.2, 0.06) * -sn; p.z += 0.006 * gauss(p.x, 0.014) * -sn; } };
  add(J.chest, C('chest', () => loft(chP, 64, 24, { mod: chMod, uvU: 1 })), M.tunic);
  // 승모근 → 목
  const trP = (v) => ({ y: 0.285 + 0.06 * v, rx: 0.142 - 0.084 * v ** 0.75, rzF: 0.088 - 0.034 * v, rzB: 0.09 - 0.032 * v, n: 2.2 });
  add(J.chest, C('traps', () => loft(trP, 48, 8)), M.tunic);
  // 가죽 끈: 왼 어깨 → 오른 옆구리 (굵은 것) · 오른 어깨 → 왼 옆구리 · 가슴 가로 끈 + 버클들
  const strapOn = (key, from, to, w, mod) => { const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, u = from[0] + (to[0] - from[0]) * t, v = from[1] + (to[1] - from[1]) * t, p = loftAt(chP, u, v, new V3(), chMod); const q = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(q, 0.007); if (mod) mod(p, t); pts.push(p); }
    add(J.chest, C(key, () => strand(pts, w, w, { seg: 36, rad: 8, flat: 0.18, ref: [0, 0, 1] })), M.strap); return pts; };
  const sA = strapOn('strapA', [0.38, 0.98], [0.66, 0.02], 0.022), sB = strapOn('strapB', [0.62, 0.98], [0.4, 0.15], 0.016);
  const sC = strapOn('strapC', [0.32, 0.62], [0.68, 0.62], 0.013);
  buckle(J.chest, sA[9].toArray(), [0, 0, -0.95], 1.15); buckle(J.chest, sB[11].toArray(), [0, 0, 0.9]); buckle(J.chest, sC[12].toArray(), [0, -0.25, 0]);
  // 등 쪽 끈 (어깨 너머로 이어짐)
  for (const [k, a, b, w] of [['strapAB', [0.12, 0.98], [0.86, 0.06], 0.022], ['strapBB', [0.88, 0.98], [0.16, 0.12], 0.016]]) { const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, p = loftAt(chP, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, new V3(), chMod); p.addScaledVector(new V3(p.x, 0, p.z).normalize(), 0.007); pts.push(p); } add(J.chest, C(k, () => strand(pts, w, w, { seg: 36, rad: 8, flat: 0.18, ref: [0, 0, -1] })), M.strap); }

  /* ---------- 목 · 목도리(두건) ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.04 + 0.15 * v, rx: 0.06 - 0.01 * smooth(0.2, 0.8, v), rzF: 0.056 - 0.008 * smooth(0.2, 0.8, v), rzB: 0.058 - 0.006 * v }), 20, 6)), M.skin);
  // 두건: 어깨 위에 겹겹이 감긴 굵은 보라 천 (울퉁불퉁한 감김 결)
  const cowl = (key, y0, y1, r0, r1, z0, ph) => { const pr = (v) => ({ y: y0 + (y1 - y0) * v, rx: r0 + (r1 - r0) * v ** 0.8, rzF: (r0 + (r1 - r0) * v ** 0.8) * 0.8 + z0, rzB: (r0 + (r1 - r0) * v ** 0.8) * 0.78, n: 2.1 });
    add(J.chest, C(key, () => loft(pr, 56, 10, { mod: (p, u, v) => { const k = 1 + 0.07 * Math.sin(u * TAU * 3 + ph + v * 2) * Math.sin(v * Math.PI) + 0.04 * Math.sin(u * TAU * 7 + ph) + 0.03 * Math.sin(u * TAU * 11 + v * 4); p.x *= k; p.z *= k; p.y += 0.01 * Math.sin(u * TAU * 2 + ph); }, uvU: 1 })), M.scarf); };
  cowl('cowl0', 0.2, 0.31, 0.215, 0.15, 0.015, 0); cowl('cowl1', 0.27, 0.37, 0.17, 0.105, 0.02, 1.7); cowl('cowl2', 0.33, 0.41, 0.115, 0.08, 0.016, 3.1);
  // 앞 왼쪽으로 늘어진 목도리 끝 (짧은 정적 자락)
  add(J.chest, C('scarfTail', () => surf((u, v, p) => { const w = 0.07 - 0.02 * v, x = 0.08 + (u - 0.5) * 2 * w + 0.03 * v; loftAt(chP, 0.5 - Math.atan2(x, 0.12) / TAU, 0.86 - 0.5 * v, p, chMod); p.x = x; p.z += 0.03 + 0.012 * Math.sin(u * Math.PI); }, 8, 10)), M.tornS);

  /* ---------- 어깨 견갑 · 팔 (근육 · 붕대) ---------- */
  const big = (sh, s) => { // 왼 어깨: 리벳 박힌 녹슨 주황 견갑 (위 돔 + 아래 미늘판 두 장 + 검은 가죽 안판)
    const g = new THREE.Group(); g.position.set(s * 0.02, 0.0, 0); g.rotation.z = s * 0.12; sh.add(g);
    const dome = (v) => ({ y: 0.11 - 0.15 * v, rx: 0.045 + 0.085 * Math.sqrt(v), rz: 0.05 + 0.08 * Math.sqrt(v), cx: s * 0.01 });
    add(g, C('pldIn' + s, () => loft((v) => { const q = dome(v); return { ...q, rx: q.rx * 1.03 + 0.004, rz: q.rz * 1.03 + 0.004, y: q.y - 0.012 }; }, 28, 8, { a0: s > 0 ? -0.08 : 0.42, a1: s > 0 ? 0.58 : 1.08 })), M.leatherD);
    add(g, C('pld' + s, () => loft(dome, 32, 10, { a0: s > 0 ? -0.05 : 0.45, a1: s > 0 ? 0.55 : 1.05, mod: (p, u, v) => { p.y += 0.006 * Math.sin(v * Math.PI); } })), M.rust);
    rim(g, 'pldR' + s, loftRing(dome, 1, { a0: s > 0 ? -0.05 : 0.45, a1: s > 0 ? 0.55 : 1.05, n: 30 }), 0.0045, false, M.rustD);
    rivets(g, dome, 0.92, s > 0 ? -0.02 : 0.47, s > 0 ? 0.53 : 1.03, 9);
    for (let k = 0; k < 2; k++) { const lp = (v) => ({ y: -0.035 - k * 0.042 - 0.05 * v, rx: 0.132 + 0.01 * k + 0.008 * v, rz: 0.13 + 0.008 * k + 0.008 * v, cx: s * (0.016 + 0.006 * k) });
      const a0 = s > 0 ? 0.02 + 0.03 * k : 0.53 + 0.03 * k, a1 = a0 + 0.42 - 0.06 * k;
      add(g, C(`lame${s}${k}`, () => loft(lp, 24, 4, { a0, a1 })), M.rust); rim(g, `lameR${s}${k}`, loftRing(lp, 1, { a0, a1, n: 24 }), 0.004, false, M.rustD); rivets(g, lp, 0.5, a0 + 0.02, a1 - 0.02, 5); }
    // 견갑을 묶은 가죽 끈
    add(g, C('pldStrap' + s, () => strand([[s * 0.02, 0.11, 0.05], [s * 0.1, 0.02, 0.1], [s * 0.13, -0.08, 0.06]], 0.012, 0.012, { seg: 12, rad: 6, flat: 0.25, ref: [s, 0.3, 0.6] })), M.strap);
  };
  const small = (sh, s) => { // 오른 어깨: 가죽 판 + 작은 녹슨 판
    const g = new THREE.Group(); g.position.set(s * 0.015, 0.0, 0); g.rotation.z = s * 0.15; sh.add(g);
    const dome = (v) => ({ y: 0.085 - 0.12 * v, rx: 0.04 + 0.072 * Math.sqrt(v), rz: 0.045 + 0.068 * Math.sqrt(v), cx: s * 0.008 });
    const a0 = s > 0 ? 0.0 : 0.5, a1 = a0 + 0.5;
    add(g, C('spdL' + s, () => loft((v) => ({ ...dome(v), rx: dome(v).rx + 0.006, rz: dome(v).rz + 0.006, y: dome(v).y - 0.02 }), 24, 6, { a0: a0 - 0.04, a1: a1 + 0.04 })), M.leatherD);
    add(g, C('spd' + s, () => loft(dome, 24, 8, { a0, a1 })), M.rust); rim(g, 'spdR' + s, loftRing(dome, 1, { a0, a1, n: 24 }), 0.004, false, M.rustD); rivets(g, dome, 0.9, a0 + 0.03, a1 - 0.03, 6);
  };
  const delt = (v) => { const k = Math.min(1, v / 0.7); return { y: 0.085 - 0.2 * v, rx: 0.09 * Math.pow(Math.sin(k * Math.PI / 2), 0.55) * (v > 0.7 ? 1 - (v - 0.7) * 0.5 : 1), rz: 0.086 * Math.pow(Math.sin(k * Math.PI / 2), 0.55) * (v > 0.7 ? 1 - (v - 0.7) * 0.5 : 1) }; };
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('delt' + s, () => loft((v) => ({ ...delt(v), cx: s * 0.006 }), 24, 10, { poles: [0] })), M.skin);
    // 위팔: 이두 · 삼두 불룩
    add(sh, C('uarm', () => loft((v) => ({ y: 0.02 - (DIMS.uArm + 0.03) * v, rx: 0.072 - 0.014 * v + 0.008 * gauss(v - 0.45, 0.25), rzF: 0.066 - 0.01 * v + 0.016 * gauss(v - 0.5, 0.2), rzB: 0.068 - 0.01 * v + 0.012 * gauss(v - 0.35, 0.25) }), 24, 12)), M.skin);
    // 위팔 붕대 + 늘어진 끝
    const bdP = (v) => ({ y: -0.06 - 0.12 * v, rx: 0.078 - 0.006 * v, rzF: 0.08 - 0.004 * v, rzB: 0.078 - 0.006 * v });
    add(sh, C('bandU', () => loft(bdP, 24, 6, { uvU: 1, uvV: 1 })), M.bandage); lRim(sh, 'bandUR', bdP, 0, 0.003, M.bandage);
    add(sh, C('bandTail' + s, () => strand([[s * 0.068, -0.1, -0.03], [s * 0.078, -0.14, -0.04], [s * 0.074, -0.2, -0.05]], 0.011, 0.007, { seg: 8, rad: 6, flat: 0.3, ref: [s, 0, 0] })), M.bandage);
    // 아래팔
    add(el, C('farm', () => loft((v) => ({ y: 0.03 - DIMS.lArm * v, rx: 0.062 + 0.01 * gauss(v - 0.22, 0.2) - 0.02 * v, rz: 0.057 + 0.006 * gauss(v - 0.25, 0.2) - 0.016 * v }), 24, 10)), M.skin);
    if (s > 0) big(sh, s); else small(sh, s);
  }
  // 오른 아래팔: 가죽 팔토시 + 감긴 굵은 사슬
  const linkGeo = C('link', () => new THREE.TorusGeometry(0.019, 0.0058, 6, 12).scale(1, 1.6, 1));
  const linkS = C('linkS', () => new THREE.TorusGeometry(0.013, 0.004, 6, 10).scale(1, 1.55, 1));
  { const brP = (v) => ({ y: -0.035 - 0.21 * v, rx: 0.074 - 0.018 * v, rz: 0.068 - 0.016 * v });
    add(J.elbowR, C('brR', () => loft(brP, 24, 6)), M.leather); lRim(J.elbowR, 'brR0', brP, 0, 0.004, M.leatherD); lRim(J.elbowR, 'brR1', brP, 1, 0.005, M.leatherD);
    const im = new THREE.InstancedMesh(linkGeo, M.iron, 34), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new V3(0, 1, 0);
    const hel = (t) => { const a = t * TAU * 3.6, v = 0.08 + 0.82 * t, p = brP(v); return new V3(Math.cos(a) * (p.rx + 0.014), p.y, Math.sin(a) * (p.rz + 0.014)); };
    for (let i = 0; i < 34; i++) { const t0 = i / 34, a = hel(t0), b = hel(t0 + 1 / 34), d = b.clone().sub(a).normalize(); q.setFromUnitVectors(Y, d).multiply(new THREE.Quaternion().setFromAxisAngle(Y, (i % 2) * Math.PI / 2)); mt.compose(a.clone().add(b).multiplyScalar(0.5), q, new V3(1, 1, 1)); im.setMatrixAt(i, mt); }
    im.castShadow = true; J.elbowR.add(im); }
  // 왼 아래팔: 녹슨 건틀릿 팔통 + 가죽 띠
  { const gaP = (v) => ({ y: -0.02 - 0.25 * v, rx: 0.08 - 0.014 * v, rzF: 0.077 - 0.012 * v, rzB: 0.075 - 0.012 * v, n: 2.3 });
    add(J.elbowL, C('gaunt', () => loft(gaP, 28, 8)), M.rust); lRim(J.elbowL, 'gauntR0', gaP, 0, 0.005, M.rustD); rivets(J.elbowL, gaP, 0.06, 0, 1, 10);
    for (const v of [0.35, 0.72]) { const sp = (w) => { const q = gaP(v + 0.06 * w); return { ...q, rx: q.rx + 0.004, rzF: q.rzF + 0.004, rzB: q.rzB + 0.004 }; }; add(J.elbowL, C('gaS' + v, () => loft(sp, 28, 2)), M.strap); buckle(J.elbowL, loftAt(sp, 0.25, 0.5, new V3()).multiplyScalar(1.04).toArray(), [0, Math.PI / 2, 0], 0.8); } }

  /* ---------- 손: 손가락 없는 가죽 장갑 (오른손: 사슬을 움켜쥔 주먹) ---------- */
  for (const [ha, s] of [[J.handL, 1], [J.handR, -1]]) {
    const hg = new THREE.Group(); hg.scale.setScalar(1.05); hg.position.y = -0.004; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.075 * v, rx: 0.024 + 0.003 * Math.sin(v * Math.PI), rz: 0.038 + 0.005 * v, n: 3, cx: s * 0.017 }), 18, 6)), M.leatherD);
    for (let k = 0; k < 4; k++) {
      const z = 0.027 - k * 0.018, L = k === 3 ? 0.86 : 1, pts = [];
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * (s < 0 ? 3.3 : 2.8) * L; pts.push(new V3(s * Math.cos(th) * 0.032 + s * 0.004, -0.056 + Math.sin(th) * 0.032, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0095, 0.0078, { seg: 14, rad: 8 })), M.skin);
      add(hg, C(`fingG${s}${k}`, () => strand(pts.slice(0, 4), 0.0108, 0.0102, { seg: 6, rad: 8 })), M.leatherD);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.018, 0.033], [-s * 0.012, -0.04, 0.05], [s * 0.003, -0.064, 0.048], [s * 0.02, -0.076, 0.04]], 0.0115, 0.0085, { seg: 12, rad: 8 })), M.skin);
  }

  /* ---------- 왼손 아가리 건틀릿: 앞(+z) 위턱 · 뒤 아래턱, 손목 경첩에서 벌어진다 · 옆 가장자리에 이빨 줄 ---------- */
  const jaw = new THREE.Group(); jaw.position.set(0.0, 0.03, 0.0); J.handL.add(jaw); m.jaw = 0;
  {
    const L = 0.25, base = (v) => ({ rx: 0.084 + 0.01 * Math.sin(v * Math.PI) , rz: 0.086 + 0.006 * Math.sin(v * Math.PI) });
    const jP = (v, k = 1) => { const b = base(v), t = Math.sqrt(Math.max(0, 1 - smooth(0.62, 1.0, v))); return { y: -L * v, rx: b.rx * (0.45 + 0.55 * t) * k, rzF: b.rz * t * k, rzB: b.rz * t * k * 0.92, n: 2.3 }; };
    const halves = [['up', 0.25, 0.75, M.rust], ['lo', 0.75, 1.25, M.rustD]];
    m.jawParts = {};
    for (const [nm, a0, a1, mat] of halves) {
      const g = new THREE.Group(); jaw.add(g); m.jawParts[nm] = g;
      add(g, C('jaw' + nm, () => loft(jP, 28, 18, { a0, a1, poles: [] })), mat);
      add(g, C('jawIn' + nm, () => loft((v) => jP(v, 0.9), 20, 12, { a0, a1, flip: true })), M.maw);
      rim(g, 'jawRim' + nm, (() => { const pts = []; for (let i = 0; i <= 24; i++) pts.push(loftAt((v) => jP(v), a0, i / 24, new V3())); for (let i = 24; i >= 0; i--) pts.push(loftAt((v) => jP(v), a1, i / 24, new V3())); return pts; })(), 0.0045, false, M.rustD);
      rivets(g, (v) => jP(v), 0.15, a0 + 0.03, a1 - 0.03, 7, 1.1);
      // 등줄기 능선 + 리벳 (가운데 각도)
      { const mid = (a0 + a1) / 2, pts = []; for (let i = 0; i <= 14; i++) pts.push(loftAt((v) => jP(v, 1.035), mid, 0.04 + 0.85 * (i / 14), new V3())); rim(g, 'jawRidge' + nm, pts, 0.006, false, M.rustD); }
      // 이빨: 양옆 가장자리 (위턱은 -z 쪽, 아래턱은 +z 쪽을 향함) + 끝의 큰 송곳니
      const up = nm === 'up', tooth = C('tooth', () => { const geo = new THREE.ConeGeometry(0.011, 0.05, 6); geo.translate(0, 0.02, 0); return geo; });
      for (const side of [0, 1]) for (let i = 0; i < 7; i++) {
        const v = 0.14 + i * 0.105 + (up ? 0 : 0.05); if (v > 0.9) continue;
        const p = loftAt((w) => jP(w, 0.96), side ? 0.25 : 0.75, v, new V3()); const o = add(g, tooth, M.tooth, p.toArray(), [0, 0, 0], [1, 0.8 + 0.4 * Math.sin(i * 1.7) ** 2, 1]);
        o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(side ? -0.35 : 0.35, -0.15, up ? -1 : 1).normalize());
      }
      for (const sx of [-1, 1]) { const p = loftAt((w) => jP(w, 0.9), 0.5 + (up ? 0 : 0.5) + sx * 0.08, 0.86, new V3()); const o = add(g, tooth, M.tooth, p.toArray(), [0, 0, 0], [1.3, 1.5, 1.3]); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(0, -0.4, up ? -1 : 1).normalize()); }
    }
    // 경첩 볼트
    for (const sx of [-1, 1]) add(jaw, C('hinge', () => new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12)), M.iron, [sx * 0.088, -0.012, 0], [0, 0, Math.PI / 2]);
  }

  /* ---------- 다리: 헐렁한 바지 · 왼 무릎 보호대 · 정강이 붕대 · 끈 달린 무거운 장화 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const Lt = DIMS.thigh + 0.06, thX = spl([[0, 0.108], [0.45, 0.1], [1, 0.084]]), thF = spl([[0, 0.104], [0.5, 0.096], [1, 0.082]]), thB = spl([[0, 0.114], [0.4, 0.104], [1, 0.084]]);
    const thP = (v) => ({ y: 0.05 - Lt * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 14, { mod: (p, u, v) => { const k = 1 + 0.035 * Math.sin(u * TAU * 4 + v * 5) * smooth(0.1, 0.4, v) + 0.02 * Math.sin(u * TAU * 9 - v * 3); p.x *= k; p.z *= k; } })), M.pants);
    const cX = spl([[0, 0.086], [0.5, 0.078], [0.85, 0.082], [1, 0.07]]), cF = spl([[0, 0.084], [0.6, 0.074], [0.85, 0.08], [1, 0.066]]), cB = spl([[0, 0.088], [0.4, 0.084], [0.85, 0.084], [1, 0.068]]);
    add(kn, C('shinP', () => loft((v) => ({ y: 0.06 - 0.34 * v, rx: cX(v), rzF: cF(v), rzB: cB(v) }), 28, 12, { mod: (p, u, v) => { const k = 1 + 0.04 * Math.sin(u * TAU * 5 + v * 7) * smooth(0.5, 0.9, v); p.x *= k; p.z *= k; } })), M.pants);
    // 정강이 붕대 (바지 끝을 감아 묶음)
    const bdP = (v) => ({ y: -0.25 - 0.07 * v, rx: 0.074 - 0.006 * v, rzF: 0.072 - 0.006 * v, rzB: 0.074 - 0.006 * v });
    add(kn, C('bandS', () => loft(bdP, 24, 5, { uvU: 1, uvV: 0.6 })), M.bandage);
    // 장화 목: 굵은 가죽 + 끈 세 줄 + 버클
    const btP = (v) => ({ y: -0.3 - (DIMS.shin - 0.32) * v, rx: 0.068 - 0.006 * v, rzF: 0.07 - 0.004 * v, rzB: 0.074 - 0.006 * v });
    add(kn, C('bootS', () => loft(btP, 28, 8)), M.boot); lRim(kn, 'bootSR', btP, 0, 0.006, M.leatherD);
    for (const [v, i] of [[0.12, 0], [0.48, 1], [0.84, 2]]) { const sp = (w) => { const q = btP(v + 0.08 * w); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.006, rzB: q.rzB + 0.006 }; }; add(kn, C('bootStrap' + i, () => loft(sp, 28, 2)), M.strap); const p = loftAt(sp, s > 0 ? 0.25 : 0.75, 0.5, new V3()).multiplyScalar(1.05); buckle(kn, p.toArray(), [0, s * Math.PI / 2, 0], 0.85); }
    // 장화 발: 둥근 앞코 · 두꺼운 굽 밑창 · 발등 끈
    const sw = spl([[0, 0.0], [0.05, 0.04], [0.2, 0.054], [0.55, 0.058], [0.85, 0.05], [1, 0.016]]), shh = spl([[0, 0.07], [0.06, 0.12], [0.25, 0.13], [0.5, 0.09], [0.8, 0.07], [1, 0.044]]);
    const shoe = (u, v, p) => { const [c, sn] = ang(u), w = sw(v), h = shh(v), e = 0.72; p.set(Math.sign(c) * Math.abs(c) ** e * w, -0.052 + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.08 + 0.31 * v); };
    add(ft, C('shoe', () => surf(shoe, 32, 22, { closedU: true })), M.boot);
    add(ft, C('sole', () => surf((u, v, p) => { shoe(u, v, p); p.x *= 1.1; p.y = -0.078 + (p.y + 0.052) * 0.36; p.z = -0.086 + (p.z + 0.08) * 1.04; }, 32, 22, { closedU: true })), M.soleM);
    for (let i = 0; i < 2; i++) { const v = 0.48 + i * 0.14, pts = []; for (let k = 0; k <= 12; k++) { const u = 0.25 + 0.5 * (k / 12), p = new V3(); shoe(u, v, p); p.multiplyScalar(1.02); pts.push(p); } rim(ft, 'footStrap' + i, pts, 0.008, false, M.strap); }
    if (s > 0) { // 왼 무릎 녹슨 보호대 + 끈
      const kp = (v) => ({ y: 0.08 - 0.17 * v, rx: 0.096 + 0.006 * Math.sin(v * Math.PI), rzF: 0.1 + 0.016 * Math.sin(v * Math.PI), rzB: 0.09 });
      add(kn, C('knee', () => loft(kp, 24, 10, { a0: 0.3, a1: 0.7, mod: (p, u, v) => { p.z += 0.01 * Math.sin(v * Math.PI); } })), M.rust); rim(kn, 'kneeR', (() => { const r = loftRing(kp, 0, { a0: 0.3, a1: 0.7, n: 20 }), r2 = loftRing(kp, 1, { a0: 0.3, a1: 0.7, n: 20 }); return [...r, ...r2.reverse()]; })(), 0.004, true, M.rustD);
      rivets(kn, kp, 0.12, 0.33, 0.67, 5, 1.4); rivets(kn, kp, 0.88, 0.33, 0.67, 5, 1.4);
      for (const v of [0.25, 0.75]) { const sp = (w) => { const q = kp(v + 0.06 * w); return { ...q, rx: q.rx - 0.004, rzF: 0.088, rzB: 0.09 }; }; add(kn, C('kneeS' + v, () => loft(sp, 24, 2, { a0: 0.68, a1: 1.32 })), M.strap); }
    }
  }

  /* ---------- 머리 · 가죽 마스크 · 헝클어진 머리 ---------- */
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.08);
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.072, 0.1, -0.006], [s * 0.084, 0.104, -0.014], [s * 0.088, 0.088, -0.02]], 0.014, 0.007, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  // 마스크: 콧대에서 턱 아래까지, 귀 앞까지 감싼다 (가운데 솔기 · 옆 끈)
  { const top = (az) => -0.16 + 0.12 * Math.cos(Math.min(1, Math.abs(az) / 1.3) * Math.PI / 2) - 0.18 * smooth(0.9, 1.45, Math.abs(az));
    const maskFn = (u, v, p) => { const az = (u - 0.5) * 2 * 1.42, e0 = -1.32, e1 = top(az), el = e0 + (e1 - e0) * v; const d = dirOf(az, el); headPt(d.x, d.y, d.z, p); const n = headN(p); p.addScaledVector(n, 0.0055 + 0.004 * smooth(0.0, 0.3, 1 - Math.abs(u - 0.5) * 2) * gauss(el + 0.35, 0.3)); };
    add(H, C('mask', () => surf(maskFn, 40, 20)), M.mask);
    rim(H, 'maskTop', (() => { const pts = []; for (let i = 0; i <= 30; i++) { const p = new V3(); maskFn(i / 30, 1, p); pts.push(p); } return pts; })(), 0.0028, false, M.leatherD);
    rim(H, 'maskSeam', (() => { const pts = []; for (let i = 0; i <= 14; i++) { const p = new V3(); maskFn(0.5, 0.15 + 0.85 * (i / 14), p); p.addScaledVector(headN(p), 0.001); pts.push(p); } return pts; })(), 0.0018, false, M.leatherD);
    for (const sx of [-1, 1]) { // 옆 리벳 · 머리 뒤로 두른 끈
      for (const vv of [0.35, 0.7]) { const p = new V3(); maskFn(sx > 0 ? 0.97 : 0.03, vv, p); add(H, rivetG, M.rivet, p.toArray()); }
      const pts = []; for (let i = 0; i <= 10; i++) pts.push(headAt(sx * (1.4 + (Math.PI - 1.4) * (i / 10)), -0.38 + 0.25 * Math.sin((i / 10) * Math.PI / 2), 0.004)); rim(H, 'maskStrap' + sx, pts, 0.005, false, M.leatherD);
    } }
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.16 + 0.36 * w * w : 0.16 - 0.75 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.004 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(19), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 14, rad: 8, flat, ref, prof: (v) => 0.3 + 0.7 * smooth(0, 0.22, v) })), M.hair);
    const tip = (p, d, k) => p.clone().addScaledVector(d, k);
    // 정수리 · 뒤: 뒤로 쓸려 끝이 뻗친 헝클어진 뭉치
    for (let k = 0; k < 18; k++) {
      const az = Math.PI + (k / 17 - 0.5) * 3.0 + (r() - 0.5) * 0.2, el = 0.55 + 0.6 * r(), n = dirOf(az, el), root = headAt(az, el, 0.004);
      const out = n.clone().multiplyScalar(0.45).add(new V3(0, 0.2, -0.7)).normalize(), len = 0.035 + 0.03 * r();
      clump('top' + k, [headAt(az, el + 0.12, -0.004), tip(root, n, 0.008), tip(root, out, len * 0.6).addScaledVector(n, 0.008), tip(root, out, len)], 0.024 + 0.008 * r(), 0.002, 0.3, [n.x, n.y, n.z]);
    }
    // 앞머리: 이마 위로 쓸어 넘겼다가 오른쪽(-x)으로 몇 가닥 흘러내림
    for (let k = 0; k < 13; k++) {
      const t = k / 12, az = 0.85 - t * 1.7 + (r() - 0.5) * 0.05, fall = az < -0.05 && az > -0.6 && k % 2 === 0, tipEl = fall ? 0.2 - 0.05 * r() : 0.5 + 0.15 * r(), sw = -0.12;
      const pts = [headAt(az * 0.4, 1.2, 0.0), headAt(az * 0.8, 0.95, 0.03), headAt(az + sw * 0.5, 0.72, 0.03), headAt(az + sw, (0.72 + tipEl) / 2, fall ? 0.026 : 0.045), headAt(az + sw * 1.4, tipEl, fall ? 0.014 : 0.05)];
      const d = dirOf(az, 0.6); clump('bang' + k, pts, (k % 2 ? 0.024 : 0.032) + r() * 0.006, 0.0015, 0.24, [d.x, d.y, d.z]);
    }
    // 옆 · 뒤: 짧게 친 뭉치 (귀 위 · 목덜미에서 끝이 뻗침)
    for (let k = 0; k < 24; k++) {
      const az = (k / 24) * TAU + 0.13, w = Math.cos(az); if (w > 0.2) continue;
      const tipEl = (w < -0.5 ? -0.5 : 0.0) + (r() - 0.5) * 0.08, n = dirOf(az, tipEl);
      const pts = [headAt(az, 0.6, 0.016), headAt(az, 0.25, 0.022), headAt(az + (r() - 0.5) * 0.08, tipEl + 0.12, 0.024), headAt(az, tipEl, 0.02).addScaledVector(n, 0.012)];
      clump('side' + k, pts, 0.034, 0.003, 0.3, [n.x, 0, n.z]);
    }
  }

  /* ---------- 천 물리: 허리 앞 · 뒤 보라 자락, 목도리 등 자락 ---------- */
  let cloths = [];
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    cloths = [new Cloth(scene, 5, 11, 0.6, M.torn), new Cloth(scene, 6, 12, 0.7, M.tornB), new Cloth(scene, 4, 10, 0.52, M.tornS)];
    for (const c of cloths) extras.push(c.mesh);
    for (const o of [chainIM, hookObj, loose.view.im]) { scene.add(o); extras.push(o); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const c of cloths) c.mesh.geometry.dispose(); cloths = []; m._attached = false; };
  m.resetCloth = () => { for (const c of cloths) c.ok = false; chain.ok = false; loose.rope.ok = false; };

  /* ---------- 무기: 긴 사슬 (로프 물리) + 세 갈래 갈고리 · 팔뚝에서 늘어진 짧은 사슬 ---------- */
  const chain = new Rope(16, CH.idle / 15, { damp: 0.955 });
  const chainIM = new THREE.InstancedMesh(linkGeo, M.iron, CH.links); chainIM.frustumCulled = false; chainIM.castShadow = true; chainIM.count = 0;
  const hookObj = new THREE.Group(); // +Y = 사슬 쪽, 갈고리 날은 -Y 로 뻗는다
  {
    add(hookObj, C('hk:eye', () => new THREE.TorusGeometry(0.026, 0.008, 8, 18)), M.iron, [0, 0.03, 0]);
    add(hookObj, C('hk:shank', () => lathe([[0.0, -0.17], [0.026, -0.165], [0.03, -0.14], [0.02, -0.12], [0.02, -0.03], [0.026, -0.015], [0.022, 0.006], [0.0, 0.01]], 14)), M.hookM);
    add(hookObj, C('hk:wrap', () => { const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 6; pts.push(new V3(Math.cos(a) * 0.022, -0.035 - 0.08 * t, Math.sin(a) * 0.022)); } return strand(pts, 0.0045, 0.0045, { seg: 120, rad: 5 }); }), M.rope);
    for (const y of [-0.03, -0.118]) add(hookObj, C('hk:band', () => new THREE.TorusGeometry(0.024, 0.005, 6, 16)), M.iron, [0, y, 0], [Math.PI / 2, 0, 0]);
    // 날: 납작한 쐐기 (가운데 긴 날 + 양옆으로 휘었다가 아래로 꺾인 날)
    const blade = (key, pts, w) => add(hookObj, C('hk:' + key, () => strand(pts, w, 0.0012, { seg: 24, rad: 8, flat: 0.28, ref: [0, 0, 1] })), M.hookM);
    const edge = (key, pts) => add(hookObj, C('hk:e' + key, () => strand(pts, 0.004, 0.0008, { seg: 24, rad: 5 })), M.edge);
    const cpt = [[0, -0.15, 0], [0, -0.25, 0], [0, -0.36, 0], [0, -0.43, 0]];
    blade('c', cpt, 0.024); edge('c1', cpt.map(([x, y, z]) => [x + 0.016 * (1 + y * 2), y, z])); edge('c2', cpt.map(([x, y, z]) => [x - 0.016 * (1 + y * 2), y, z]));
    for (const sx of [-1, 1]) {
      const sp = [[sx * 0.018, -0.14, 0], [sx * 0.09, -0.17, 0], [sx * 0.13, -0.24, 0], [sx * 0.125, -0.33, 0], [sx * 0.105, -0.39, 0]];
      blade('s' + sx, sp, 0.02); edge('s' + sx, sp.map(([x, y, z], i) => [x + sx * 0.012 * (i ? 1 : 0), y, z]));
      // 안쪽 미늘
      add(hookObj, C('hk:barb' + sx, () => strand([[sx * 0.12, -0.25, 0], [sx * 0.095, -0.27, 0], [sx * 0.085, -0.3, 0]], 0.01, 0.001, { seg: 8, rad: 6, flat: 0.3, ref: [0, 0, 1] })), M.hookM);
    }
    hookObj.scale.setScalar(1.0);
  }
  // 팔뚝 사슬에서 늘어진 짧은 사슬 (RopeChain)
  const loose = { rope: new Rope(7, 0.03, { damp: 0.97 }) }; loose.view = new RopeChain(loose.rope, linkS, M.ironD, null);
  m.hookTarget = null; // V3: 던진 갈고리 위치 (설정되면 손 → 그 점까지 사슬을 뻗는다)
  m.chainOn = true;
  const cs = { wk: 0, wl: CH.whip }; m.cs = cs;

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), anc = new V3(), axis = new V3(), DOWN = new V3(0, -1, 0), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), Y = new V3(0, 1, 0), ONE = new V3(1, 1, 1), lag = { L: 0, R: 0, vL: 0, vR: 0 }, cum = new Float32Array(16);
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    J.chest.updateMatrixWorld(true);
    const wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 0.8, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 0.8];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.045 * sc })), h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.2), r: h0.r * 0.78 + 0.05 * sc };
    if (cloths.length) {
      const [fr, bk, sf] = cloths, hp = J.hips.getWorldPosition(new V3()), butt = hp.clone().addScaledVector(f.fwd(tmp2), -0.05 * sc).add(new V3(0, -0.1 * sc, 0));
      for (let i = 0; i < fr.W; i++) { const a = 0.405 + 0.19 * (i / (fr.W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0, fr.anchors[i]).multiplyScalar(1.06)); }
      fr.len = 0.6 * sc; fr.mesh.visible = vis; fr.step(dt, [...legs, { a: hp, b: hp, r: 0.13 * sc }], f.pos.y + 0.02, wind);
      for (let i = 0; i < bk.W; i++) { const a = 1.11 - 0.22 * (i / (bk.W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0, bk.anchors[i]).multiplyScalar(1.06)); }
      bk.len = 0.7 * sc; bk.mesh.visible = vis; bk.step(dt, [torso, ...legs, { a: butt, b: butt, r: 0.14 * sc }], f.pos.y + 0.02, wind);
      for (let i = 0; i < sf.W; i++) { const x = 0.09 - 0.14 * (i / (sf.W - 1)); J.chest.localToWorld(sf.anchors[i].set(x, 0.3, -0.13 - 0.02 * Math.cos(x * 8))); }
      sf.len = 0.52 * sc; sf.mesh.visible = vis; sf.step(dt, [{ a: h0.a, b: h0.b, r: h0.r * 0.62 }], f.pos.y + 0.02, wind);
    }
    // 사슬: 늘어뜨림 (물리) · 채찍 (무기 방향으로 곧게) · 던짐 (손 → 갈고리 위치)
    const wkT = m.chainOn ? (f.whipK || 0) : 0; cs.wk += (wkT - cs.wk) * Math.min(1, dt * (wkT > cs.wk ? 40 : 7)); cs.wl += ((f.whipL || CH.whip) - cs.wl) * Math.min(1, dt * 16);
    J.weapon.updateMatrixWorld(true); J.weapon.getWorldPosition(anc); axis.set(0, 0, 1).transformDirection(J.weapon.matrixWorld);
    const P = chain.p, n = P.length;
    if (m.hookTarget) {
      const tg = m.hookTarget, d = anc.distanceTo(tg), sag = Math.min(0.35, d * 0.035);
      for (let i = 0; i < n; i++) { const u = i / (n - 1); P[i].lerpVectors(anc, tg, u); P[i].y -= sag * Math.sin(u * Math.PI); chain.o[i].copy(P[i]); }
      chain.ok = true; chain.seg = d / (n - 1);
    } else {
      const idl = f.wrapK ? CH.idle * 0.3 : CH.idle, len = (idl + (cs.wl - idl) * cs.wk) * sc; chain.seg = len / (n - 1);
      chain.step(dt, anc, [], f.pos.y + 0.03, DOWN, null);
      if (cs.wk > 0.01) { const k = 1 - Math.exp(-dt * 50 * cs.wk); for (let i = 1; i < n; i++) { const w = k * (1 - 0.3 * (i / (n - 1)) * (1 - cs.wk)); tmp.copy(anc).addScaledVector(axis, i * chain.seg); P[i].lerp(tmp, w); chain.o[i].lerp(P[i], w); } }
    }
    // 사슬 고리 배치 (일정한 간격)
    cum[0] = 0; for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + P[i].distanceTo(P[i - 1]);
    const total = cum[n - 1], pitch = CH.pitch * sc, cnt = Math.min(CH.links, Math.floor(total / pitch)); let seg = 1;
    for (let k = 0; k < cnt; k++) {
      const s0 = (k + 0.5) * pitch; while (seg < n - 1 && cum[seg] < s0) seg++;
      const a = P[seg - 1], b = P[seg], t = (s0 - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      tmp.lerpVectors(a, b, t); tmp2.subVectors(b, a).normalize(); q.setFromUnitVectors(Y, tmp2); qr.setFromAxisAngle(Y, (k % 2) * Math.PI / 2); q.multiply(qr);
      mtx.compose(tmp, q, tmp2.set(sc, sc, sc)); chainIM.setMatrixAt(k, mtx);
    }
    chainIM.count = cnt; chainIM.instanceMatrix.needsUpdate = true; chainIM.visible = vis && m.chainOn;
    tmp2.subVectors(P[n - 1], P[n - 3]).normalize(); hookObj.position.copy(P[n - 1]); hookObj.quaternion.setFromUnitVectors(Y, tmp2.negate()); hookObj.scale.setScalar(sc * 1.35); hookObj.visible = vis && m.chainOn;
    m.hookPos = hookObj.position;
    // 팔뚝 짧은 사슬
    J.elbowR.localToWorld(tmp.set(-0.05, -0.22, -0.02)); loose.rope.seg = 0.03 * sc; loose.rope.step(dt, tmp, [], f.pos.y + 0.02, DOWN, null); loose.view.update(); loose.view.im.visible = vis;
    // 아가리 건틀릿: f.jawK (0 다묾 · 1 벌림)
    const jw = Math.max(0.18, f.jawK || 0); m.jaw += (jw - m.jaw) * Math.min(1, dt * (jw > m.jaw ? 30 : 22));
    m.jawParts.up.rotation.x = -m.jaw * 0.62; m.jawParts.lo.rotation.x = m.jaw * 0.32;
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림 (마스크 아래)
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    // 독병 · 갈고리 날 빛 (사냥 게이지가 가득 차면 더 밝게)
    const full = (f.hunt || 0) >= 100, pulse = 0.85 + 0.15 * Math.sin(f.G.time * (full ? 9 : 4));
    M.potion.emissiveIntensity = (1.1 + (full ? 1 : 0)) * pulse; M.edge.opacity = (0.65 + (full ? 0.35 : 0) + cs.wk * 0.2) * pulse; M.maw.emissiveIntensity = 0.05 + m.jaw * 0.6;
    for (const o of extras) if (o !== chainIM && o !== hookObj) o.visible = vis;
  };
  m.setWeapon = (v) => { m.chainOn = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.078;
  // 무기 방향: 포즈의 weapon 값 = 몸(루트) 기준 [피치(위+), 좌우(오른쪽+), 롤] — 채찍질 때 사슬이 이 방향으로 곧게 뻗는다
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 판정: 손 → 채찍 길이 끝 (무기 방향 축)
  const wlen = () => Math.max(1.0, CH.idle + (cs.wl - CH.idle) * Math.max(cs.wk, 0.6));
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.08)); J.weapon.localToWorld(t.set(0, 0, wlen())); };
  m.trailPts = (b, t) => { const L = wlen(); J.weapon.localToWorld(b.set(0, 0, L * 0.45)); J.weapon.localToWorld(t.set(0, 0, L + 0.15)); };
  m.handPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.getWorldPosition(out); };
  m.jawPos = (out = new V3()) => { J.handL.updateMatrixWorld(true); return J.handL.localToWorld(out.set(0, -0.14, 0)); };
  m.extras = extras;
  return m;
}
