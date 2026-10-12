// 아자젤 (AZAZEL) — 3D 모델 (기술·포즈는 azazel.js)
// "차별이라는 사슬을 끊어내고, 잃어버린 마족의 영광을 되찾고 싶어하는 양키 여고생"
//
// 구성: 빨간 단발 + 허벅지까지 오는 땋은 머리(로프 물리) · 검은 마족 뿔 · 뾰족 귀 · 볼 반창고 · 철 목줄(십자 문장)
//       크롭 재킷(세운 깃 + 흰 털 · 왼팔 불꽃 긴소매 · 오른팔 반소매) · 붕대 상의 + 붉은 스카프
//       손목·발목 족쇄와 끊어진 사슬(로프 물리) · 벨트·사슬·악마 키링 · 불꽃 무늬 롱 주름치마(다리를 따라 출렁임, 앞트임)
//       하이탑 운동화 · 무기 「GRIGORI」 가시 철퇴 (각성하면 붉게 달아오르며 불길)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Rope, RopeTube, RopeChain } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, fbm, gauss, smooth, heightToNormal, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.83, spineL: 0.18, chestL: 0.25, neckL: 0.068, shW: 0.185, uArm: 0.27, lArm: 0.245, hipW: 0.088, thigh: 0.4, shin: 0.39, headTop: 0.25 };
// 철퇴 치수 (오른손 기준 +Z 방향, m)
export const CL = { butt: -0.5, handleEnd: 0.42, head0: 0.42, head1: 1.17, top: 1.36, grip2: 0.28 };
export const FIRE = 0xff4a1a, EMBER = 0xffa52a, BLOOD = 0xd4142a, HOT = 0xffe08a;
const C = (k, fn) => cached('aza:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const FONT = '"Noto Sans KR","Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif';
// 불꽃 실루엣 (아래에서 위로 일렁이는 혀 모양)
function flames(g, x0, x1, yBase, h, n, r, fill) {
  g.fillStyle = fill; g.beginPath(); g.moveTo(x0, yBase);
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w, hh = h * (0.55 + r() * 0.45), lean = (r() - 0.5) * w * 0.6;
    g.bezierCurveTo(x + w * 0.1, yBase - hh * 0.4, x + w * 0.35 + lean, yBase - hh * 0.75, x + w * 0.5 + lean, yBase - hh);
    g.bezierCurveTo(x + w * 0.45 + lean * 0.5, yBase - hh * 0.55, x + w * 0.85, yBase - hh * 0.35, x + w, yBase - hh * 0.15 * r());
  }
  g.lineTo(x1, yBase); g.closePath(); g.fill();
}
// 붉은 머리칼 결 (solid)
function hairTex(base, dark, light) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(51); g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.45 ? dark : k > 0.85 ? light : base; g.globalAlpha = 0.35 + r() * 0.4; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 16, H / 2, x + (r() - 0.5) * 10, 0); g.stroke(); }
  // 천사의 고리: 정수리 쪽 가로 하이라이트 띠 (톱니 모양)
  g.globalAlpha = 0.55; g.fillStyle = light; const y0 = H * 0.32; g.beginPath(); g.moveTo(0, y0);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - 10 - r() * 22); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + 8 + r() * 16); g.closePath(); g.fill();
  g.globalAlpha = 1; return tex(c);
}
// 땋은 머리: 비스듬한 세 갈래 결
function braidTex() {
  const W = 256, H = 1024, [c, g] = cv(W, H); g.fillStyle = '#b8142a'; g.fillRect(0, 0, W, H); const r = rng(9);
  for (let y = -64; y < H + 64; y += 42) for (let k = 0; k < 2; k++) {
    const gr = g.createLinearGradient(0, y, 0, y + 46); gr.addColorStop(0, '#7a0a1c'); gr.addColorStop(0.45, '#e2384a'); gr.addColorStop(1, '#7a0a1c');
    g.fillStyle = gr; g.beginPath(); const x0 = k ? W : 0, x1 = k ? 0 : W; g.moveTo(x0, y); g.quadraticCurveTo(W / 2, y + 30, x1, y + 22); g.lineTo(x1, y + 44); g.quadraticCurveTo(W / 2, y + 52, x0, y + 34); g.closePath(); g.fill();
  }
  for (let i = 0; i < 200; i++) { g.strokeStyle = `rgba(255,${120 + r() * 80 | 0},${120 + r() * 60 | 0},${0.12 + r() * 0.2})`; g.lineWidth = 1; const y = r() * H; g.beginPath(); g.moveTo(r() * W, y); g.lineTo(r() * W, y + 20); g.stroke(); }
  return tex(c, [1, 6]);
}
// 붕대 / 흰 상의
function wrapTex(diag) {
  const W = 256, [c, g] = cv(W, W), r = rng(diag ? 3 : 4); g.fillStyle = '#ecebe6'; g.fillRect(0, 0, W, W);
  for (let i = -W; i < W * 2; i += 22) { g.strokeStyle = 'rgba(150,145,140,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, i); g.lineTo(W, i + (diag ? 60 : 0)); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, i + 3); g.lineTo(W, i + 3 + (diag ? 60 : 0)); g.stroke(); }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.fillRect(r() * W, r() * W, 2, 2); }
  return tex(c);
}
// 재킷 천: 검정 + 바늘땀 + 등 십자 문장
function jacketTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H), r = rng(21);
  g.fillStyle = '#18171c'; g.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.035})`; g.fillRect(r() * W, r() * H, 2, 1); }
  g.setLineDash([7, 6]); g.strokeStyle = '#555'; g.lineWidth = 2; for (const y of [14, H - 16]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.setLineDash([]);
  // 등(가로 중앙 = 뒤) 십자 문장
  const cx = 0, cy = H * 0.5;
  for (const ox of [0, W]) { g.save(); g.translate(cx + ox, cy); g.fillStyle = '#8a8890'; g.strokeStyle = '#2a2a2e'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -150); g.lineTo(24, -40); g.lineTo(120, -18); g.lineTo(24, 4); g.lineTo(0, 150); g.lineTo(-24, 4); g.lineTo(-120, -18); g.lineTo(-24, -40); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d4142a'; g.beginPath(); g.moveTo(0, -46); g.lineTo(14, -16); g.lineTo(0, 14); g.lineTo(-14, -16); g.closePath(); g.fill(); g.restore(); }
  return tex(c);
}
// 왼팔 긴소매: 검정 + 소맷부리에서 타오르는 불꽃
function sleeveTex() {
  const W = 512, H = 512, [c, g] = cv(W, H), r = rng(33);
  g.fillStyle = '#18171c'; g.fillRect(0, 0, W, H); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.03})`; g.fillRect(r() * W, r() * H, 2, 1); }
  // uv v=1(캔버스 위) 가 손목 쪽 → 위에서 아래로 타오르도록 뒤집어 그린다
  g.save(); g.translate(0, H); g.scale(1, -1);
  flames(g, -20, W + 20, H + 10, H * 0.62, 7, r, '#c8102a'); flames(g, -10, W + 10, H + 10, H * 0.42, 9, r, '#ff5a1a'); flames(g, 0, W, H + 10, H * 0.2, 12, r, '#ffc04a');
  g.fillStyle = '#c8102a'; g.fillRect(0, H - 34, W, 34); g.restore();
  return tex(c);
}
// 오른팔 반소매 패치(LORD 악마) + 빨간 줄
function patchTex() {
  const W = 512, H = 256, [c, g] = cv(W, H); g.fillStyle = '#18171c'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c8102a'; g.fillRect(0, 26, W, 16); g.fillRect(0, 50, W, 8);
  // 바깥쪽(왼쪽 측면 = u 0.25 · 오른쪽 측면 = u 0.75)에 패치
  for (const x of [W * 0.25, W * 0.75]) { g.save(); g.translate(x, 150); g.fillStyle = '#c8102a'; g.beginPath(); g.ellipse(0, 0, 54, 46, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = `900 30px ${FONT}`; g.textAlign = 'center'; g.fillText('LORD', 0, 10); g.fillStyle = '#c8102a'; g.beginPath(); g.moveTo(-44, -30); g.lineTo(-60, -62); g.lineTo(-26, -40); g.moveTo(44, -30); g.lineTo(60, -62); g.lineTo(26, -40); g.fill(); g.restore(); }
  return tex(c);
}
// 주름치마: 검정 주름 음영 + 아래 불꽃 실루엣 + 붉은 테 + 세로 글귀
function skirtTex() {
  const W = 2048, H = 1024, [c, g] = cv(W, H), r = rng(77);
  g.fillStyle = '#1c1b20'; g.fillRect(0, 0, W, H);
  const P = 32; for (let i = 0; i < P; i++) { const x = (i / P) * W, gr = g.createLinearGradient(x, 0, x + W / P, 0); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(x, 0, W / P, H); }
  const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // 캔버스 위 = v 1 = 밑단? → surf 의 v=0 이 허리, uv v=0 이 캔버스 아래. 밑단은 캔버스 위쪽
  g.save(); g.translate(0, H); g.scale(1, -1); flames(g, -40, W + 40, H + 10, H * 0.42, 14, r, 'rgba(70,68,76,0.9)'); flames(g, -40, W + 40, H + 10, H * 0.24, 18, r, 'rgba(46,45,52,0.95)'); g.restore();
  g.fillStyle = '#c8102a'; g.fillRect(0, 0, 18, H); g.fillRect(W - 18, 0, 18, H); g.fillRect(0, 0, W, 10);
  // 세로 글귀 (앞 중앙 왼쪽)
  g.save(); g.fillStyle = '#121116'; const tx = W * 0.075; g.fillRect(tx - 34, 40, 68, H * 0.86); g.fillStyle = '#e8e6ea'; g.font = `900 46px ${FONT}`; g.textAlign = 'center';
  const t = '不条理の鎖を喰いちぎれ'; for (let i = 0; i < t.length; i++) { g.save(); g.translate(tx, H - 90 - i * 70); g.scale(-1, -1); g.fillText(t[i], 0, 16); g.restore(); } g.restore();
  return tex(c);
}
// 등 뒤 「魔」 천 (찢어진 밑단, 투명)
function maClothTex() {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(5); g.clearRect(0, 0, W, H);
  g.fillStyle = '#e4e2e6'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.7);
  for (let x = W; x >= 0; x -= 32) g.lineTo(x - 16, H * (0.72 + r() * 0.26)), g.lineTo(x - 32, H * (0.66 + r() * 0.1));
  g.closePath(); g.fill(); for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 2, 2); }
  g.fillStyle = '#18171c'; g.font = `900 150px ${FONT}`; g.textAlign = 'center'; g.fillText('魔', W / 2, H * 0.42);
  return tex(c);
}
// 철퇴 머리: 검정 + 붉은 구름 소용돌이 + GRIGORI 명판 / 각성 발광맵
function clubTex(glow) {
  const W = 512, H = 1024, [c, g] = cv(W, H), r = rng(61);
  g.fillStyle = glow ? '#000' : '#141318'; g.fillRect(0, 0, W, H);
  const swirl = (x, y, s) => { g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * 4.4, rr = s * (1 - t * 0.85); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.lineWidth = s * 0.28; g.stroke(); };
  g.strokeStyle = glow ? '#ff6a1a' : '#c8102a'; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) { const x = r() * W, y = 80 + r() * (H - 200), s = 40 + r() * 50; for (const ox of [-W, 0, W]) swirl(x + ox, y, s); }
  g.fillStyle = glow ? '#ff3a10' : '#c8102a'; g.fillRect(0, 0, W, 40); g.fillRect(0, H - 50, W, 18);
  if (!glow) { g.save(); g.translate(W * 0.75, 180); g.rotate(-0.25); g.fillStyle = '#c9c9cf'; g.fillRect(-90, -24, 180, 48); g.strokeStyle = '#555'; g.lineWidth = 4; g.strokeRect(-90, -24, 180, 48); g.fillStyle = '#2a2a30'; g.font = `900 32px ${FONT}`; g.textAlign = 'center'; g.fillText('GRIGORI', 0, 12); g.restore(); }
  return tex(c, [1, 1], !glow);
}
// 뿔: 결 + 각성 시 빛나는 균열(발광맵)
function hornTex(glow) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(glow ? 8 : 7); g.fillStyle = glow ? '#000' : '#18161c'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 24) { g.fillStyle = glow ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.06)'; g.fillRect(0, y, W, 8); }
  g.strokeStyle = glow ? '#ff6a1a' : 'rgba(0,0,0,0)'; g.lineWidth = 3;
  for (let i = 0; i < 14; i++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += 10 + r() * 26; g.lineTo(x, y); } g.stroke(); }
  return tex(c, [1, 1], !glow);
}
// 눈: 붉은 홍채 + 동공 + 반사광 + 굵은 윗속눈썹 (투명 배경)
function eyeTex() {
  const W = 256, H = 128, [c, g] = cv(W, H); g.clearRect(0, 0, W, H);
  g.fillStyle = '#f6f1ec'; g.beginPath(); g.ellipse(128, 70, 92, 40, 0, 0, TAU); g.fill();
  const ir = g.createRadialGradient(128, 60, 4, 128, 70, 44); ir.addColorStop(0, '#ff8a6a'); ir.addColorStop(0.45, '#e01830'); ir.addColorStop(1, '#5a0010');
  g.fillStyle = ir; g.beginPath(); g.ellipse(128, 70, 36, 42, 0, 0, TAU); g.fill();
  g.fillStyle = '#2a0006'; g.beginPath(); g.ellipse(128, 72, 12, 20, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(112, 52, 9, 12, -0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(142, 88, 4, 5, 0, 0, TAU); g.fill();
  g.strokeStyle = '#1a0a0e'; g.lineCap = 'round'; g.lineWidth = 11; g.beginPath(); g.moveTo(26, 64); g.quadraticCurveTo(110, 18, 236, 44); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(236, 44); g.lineTo(250, 34); g.stroke();
  g.lineWidth = 3; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(52, 104); g.quadraticCurveTo(128, 118, 210, 100); g.stroke(); g.globalAlpha = 1;
  return tex(c);
}
// 얼굴 장식: 입 · 볼 반창고 (투명 배경)
function mouthTex() { const [c, g] = cv(128, 64); g.clearRect(0, 0, 128, 64); g.strokeStyle = '#6a2026'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(40, 30); g.quadraticCurveTo(64, 36, 88, 28); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(78, 30); g.lineTo(84, 30); g.lineTo(81, 38); g.fill(); return tex(c); }
// 벌린 입 + 송곳니 (화염 숨결 · 각성)
function mouthOpenTex() { const [c, g] = cv(128, 64); g.clearRect(0, 0, 128, 64); g.fillStyle = '#4a0a12'; g.beginPath(); g.moveTo(34, 22); g.quadraticCurveTo(64, 14, 94, 22); g.quadraticCurveTo(80, 58, 64, 58); g.quadraticCurveTo(48, 58, 34, 22); g.fill(); g.fillStyle = '#fff'; for (const x of [44, 80]) { g.beginPath(); g.moveTo(x - 5, 21); g.lineTo(x + 5, 20); g.lineTo(x, 34); g.fill(); } g.strokeStyle = '#6a2026'; g.lineWidth = 3; g.beginPath(); g.moveTo(34, 22); g.quadraticCurveTo(64, 14, 94, 22); g.stroke(); return tex(c); }
function plasterTex() { const [c, g] = cv(128, 128); g.clearRect(0, 0, 128, 128); g.save(); g.translate(64, 64); g.rotate(0.5); g.fillStyle = '#efe4d6'; g.fillRect(-46, -20, 92, 40); g.fillStyle = '#d8c6b0'; g.fillRect(-14, -20, 28, 40); g.strokeStyle = '#b8a48e'; g.lineWidth = 2; g.strokeRect(-46, -20, 92, 40); g.restore(); return tex(c); }
// 운동화: 검정 + 붉은 패널 + 끈
function shoeTex() {
  const W = 512, H = 256, [c, g] = cv(W, H); g.fillStyle = '#16151a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c8102a'; g.beginPath(); g.moveTo(0, H); g.quadraticCurveTo(W * 0.3, H * 0.4, W * 0.55, H); g.fill(); g.fillRect(W * 0.8, 0, W * 0.2, H);
  g.strokeStyle = '#e8e6ea'; g.lineWidth = 6; for (let i = 0; i < 6; i++) { const y = 30 + i * 30; g.beginPath(); g.moveTo(W * 0.4, y); g.lineTo(W * 0.6, y + 18); g.moveTo(W * 0.6, y); g.lineTo(W * 0.4, y + 18); g.stroke(); }
  return tex(c);
}
// 양말: 검정 + 윗단 붉은 줄
function sockTex() { const [c, g] = cv(64, 256); g.fillStyle = '#121116'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#c8102a'; g.fillRect(0, 232, 64, 14); g.fillRect(0, 214, 64, 8); return tex(c); } // 캔버스 아래 = 양말 윗단(v=0)
// 털 카드 (흰 털 묶음, 투명 배경)
function furCardTex() {
  const W = 256, [c, g] = cv(W, W), r = rng(31); g.clearRect(0, 0, W, W); g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const x0 = W * (0.3 + r() * 0.4), x1 = x0 + (r() - 0.5) * W * 0.7, y1 = W * (0.55 + r() * 0.43), k = 0.82 + r() * 0.18, wd = 1.2 + r() * 2.6;
    const gr = g.createLinearGradient(0, 0, 0, y1); gr.addColorStop(0, `rgba(${255 * k | 0},${252 * k | 0},${246 * k | 0},1)`); gr.addColorStop(0.75, `rgba(${250 * k | 0},${248 * k | 0},${242 * k | 0},0.9)`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = gr; g.lineWidth = wd; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 30, y1 * 0.5, x1, y1); g.stroke();
  }
  return tex(c);
}
function keyFaceTex() { const [c, g] = cv(128, 128); g.fillStyle = '#c8102a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(44, 54, 14, 10, 0.3, 0, TAU); g.ellipse(84, 54, 14, 10, -0.3, 0, TAU); g.fill(); g.fillStyle = '#1a0a0e'; g.beginPath(); g.arc(46, 56, 5, 0, TAU); g.arc(82, 56, 5, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 6; i++) g.lineTo(34 + i * 10, 84 + (i % 2) * 8); g.stroke(); return tex(c); }

// 얼굴 전체를 머리 곡면의 UV(방위·고도)에 직접 그린다: 큰 눈 · 속눈썹 · 눈썹 · 볼 홍조 · 코·턱 음영 · 입 · 반창고
//   open = 송곳니가 드러난 벌린 입 (화염 숨결 · 포효) / glow = 각성 시 빛나는 홍채만 그린 발광맵
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) g.fillStyle = '#000', g.fillRect(0, 0, W, H);
  else {
    g.fillStyle = '#fbdccb'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,240,230,0.55)'); gr.addColorStop(0.6, 'rgba(255,230,215,0)'); gr.addColorStop(1, 'rgba(190,120,110,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,120,110,0)'); cg.addColorStop(1, 'rgba(190,110,100,0.45)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
    g.save(); g.filter = 'blur(18px)'; g.fillStyle = 'rgba(240,120,125,0.2)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.036, Y.noseY + 0.006); g.beginPath(); g.ellipse(x, y, 70, 30, 0, 0, TAU); g.fill(); } g.restore();
    // 반창고 (오른쪽 볼)
  }
  // 이목구비: 실제 비율 · 무표정 (눈꼬리가 조금 올라간 날카로운 눈매 · 붉은 홍채) / glow = 각성 오버레이 (홍채만 발광)
  paintFace(g, M, { ...Y, tilt: 0.12, lidDrop: 0.1, glow, open, iris: glow ? ['#ffe0a0', '#ff6a1a', '#c02800', '#000'] : ['#f07060', '#c01428', '#4a0010', '#26040a'], pupil: '#1a0206', lash: '#1a070c', brow: '#7a1022' });
  const t = new THREE.CanvasTexture(c); if (!glow) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   얼굴: 애니메 얼굴 (둥근 볼 · 갸름한 V 턱 · 작은 코) — 눈·입은 데칼
   ===================================================================== */
// 공용 애니메 얼굴형 (V자 턱 · 평평한 앞얼굴 · 각진 두개) — 아리엘보다 턱이 조금 더 날렵
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.073, 0.102, 0.089], jaw: 0.34 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
// 얼굴 위에 붙이는 데칼 곡면 (방위 az0~az1, 고도 el0~el1)
const decal = (az0, az1, el0, el1, off, n = 16) => surf((u, v, p) => headAt(az0 + (az1 - az0) * u, el0 + (el1 - el0) * v, off, p), n, Math.max(4, n >> 1));

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 0.9; } return mt; };
  const hairRed = pal.hair ?? 0xd01c30;
  const M = {
    skin: phys({ color: 0xfbd9c6, emissive: 0x7a4a3c, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffc8b0) }), // 약한 자체발광 = 애니메식 밝은 피부
    hair: phys({ map: T('hair' + hairRed, () => hairTex('#' + new THREE.Color(hairRed).getHexString(), '#7a0a1c', '#ff6a72')), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xff8a90), sheenRoughness: 0.35 }),
    braid: phys({ map: T('braid', braidTex), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xff8a90), sheenRoughness: 0.35 }),
    horn: phys({ map: T('horn', () => hornTex(false)), emissiveMap: T('hornG', () => hornTex(true)), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }),
    jacket: phys({ map: T('jack', jacketTex), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x60606a) }),
    sleeve: phys({ map: T('sleeve', sleeveTex), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x60606a) }),
    patch: phys({ map: T('patch', patchTex), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x60606a) }),
    red: phys({ color: pal.lining ?? 0xc8102a, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xff6070) }),
    black: phys({ color: 0x18171c, roughness: 0.6 }),
    leather: phys({ color: 0x1a181c, roughness: 0.45, clearcoat: 0.4 }),
    rib: phys({ map: T('rib', () => { const [c, g] = cv(512, 32); g.fillStyle = '#141318'; g.fillRect(0, 0, 512, 32); for (let x = 0; x < 512; x += 6) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 2, 32); } return tex(c, [8, 1]); }), roughness: 0.8 }),
    wrap: phys({ map: T('wrapH', () => wrapTex(false)), color: 0xfff1e6, roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) }),
    // 얼굴: 자기 텍스처를 약하게 자체발광시켜 그늘에서도 밝고 따뜻한 애니메 피부 / 각성 눈빛은 아래 가산 오버레이
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x6a5048, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffc8b0) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x6a5048, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffc8b0) }),
    faceGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    bandage: phys({ map: T('wrapD', () => wrapTex(true)), color: 0xfff1e6, roughness: 0.85 }),
    iron: phys({ color: 0x5a5a62, metalness: 0.85, roughness: 0.35, clearcoat: 0.3 }),
    silver: phys({ color: 0xc8c8d0, metalness: 1, roughness: 0.22 }),
    ember: phys({ color: 0x3a0a00, emissive: 0xff7a1a, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.3 }),
    skirt: phys({ map: T('skirt', skirtTex), roughness: 0.68, sheen: 0.5, sheenColor: new THREE.Color(0x50505a) }),
    lining: phys({ color: pal.lining ?? 0xc8102a, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xff6070) }),
    ma: phys({ map: T('ma', maClothTex), alphaTest: 0.4, roughness: 0.85 }),
    sock: phys({ map: T('sock', sockTex), roughness: 0.75, sheen: 0.5, sheenColor: new THREE.Color(0x404048) }),
    shoe: phys({ map: T('shoe', shoeTex), roughness: 0.5, clearcoat: 0.3 }),
    sole: phys({ color: 0xeeece6, roughness: 0.6 }),
    fur: phys({ map: T('furC', furCardTex), alphaTest: 0.38, roughness: 0.85, emissive: 0x48443e, emissiveIntensity: 0.5, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.55 }),
    furB: phys({ color: 0xf4f1ea, roughness: 0.9, emissive: 0x48443e, emissiveIntensity: 0.5, sheen: 1, sheenColor: new THREE.Color(0xffffff) }),
    eye: phys({ map: T('eye', eyeTex), alphaTest: 0.3, emissiveMap: T('eye', eyeTex), emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.2, clearcoat: 1 }),
    mouth: phys({ map: T('mouth', mouthTex), alphaTest: 0.3, roughness: 0.5 }),
    mouthO: phys({ map: T('mouthO', mouthOpenTex), alphaTest: 0.3, roughness: 0.5, emissiveMap: T('mouthO', mouthOpenTex), emissive: 0xff5a1a, emissiveIntensity: 0 }),
    plaster: phys({ map: T('plaster', plasterTex), alphaTest: 0.3, roughness: 0.7 }),
    key: phys({ map: T('keyF', keyFaceTex), roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0xff8090) }),
    club: phys({ map: T('club', () => clubTex(false)), emissiveMap: T('clubG', () => clubTex(true)), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.3, clearcoat: 0.6 }),
    clubR: phys({ color: 0x2a0408, emissive: 0xff2a10, emissiveIntensity: 0, roughness: 0.4, metalness: 0.5 }),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.silver) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(140, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const linkGeo = C('link', () => new THREE.TorusGeometry(0.011, 0.0032, 6, 14).scale(1, 1.55, 1));
  const diamond = () => { const sh = new THREE.Shape(); sh.moveTo(0, 0.06); sh.lineTo(0.016, 0.02); sh.lineTo(0.008, 0); sh.lineTo(0.016, -0.02); sh.lineTo(0, -0.05); sh.lineTo(-0.016, -0.02); sh.lineTo(-0.008, 0); sh.lineTo(-0.016, 0.02); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 }); g.translate(0, -0.06, -0.003); return g; };
  m.ropes = []; // { rope, anchor: () => V3, rest: V3 local dir, view: RopeTube|RopeChain, caps }

  /* ---------- 골반 · 벨트 · 치마 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: 0.09 - 0.2 * v, rx: 0.118 + 0.026 * v, rzF: 0.085, rzB: 0.095, n: 2.2 }), 28, 6)), M.black);
  const beltP = (v) => ({ y: 0.005 + 0.048 * v, rx: 0.136, rzF: 0.104, rzB: 0.108, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 56, 4, { uvU: 4 })), M.leather);
  for (let i = 0; i < 16; i++) { const p = loftAt(beltP, i / 16, 0.5, new V3()); const n = new V3(p.x, 0, p.z).normalize(); add(J.hips, C('grom', () => new THREE.TorusGeometry(0.0055, 0.0018, 6, 14)), M.silver, [p.x + n.x * 0.002, p.y, p.z + n.z * 0.002], [0, Math.atan2(n.x, n.z), 0]); }
  // 비스듬한 붉은 벨트
  const rbP = (v) => ({ y: -0.012 + 0.022 * v, rx: 0.142, rzF: 0.11, rzB: 0.114, n: 2.3 });
  add(J.hips, C('redbelt', () => loft(rbP, 56, 3, { mod: (p, u, v, c) => { p.y += 0.035 * c; } })), M.red);
  add(J.hips, C('buckle', () => loft((v) => ({ y: 0.004 + 0.05 * v, rx: 0.022, rz: 0.006, n: 4, cz: 0 }), 12, 3)), M.silver, [0.03, 0, 0.108]);
  // 늘어진 사슬 (앞 왼쪽 → 옆) · 파우치 (오른쪽 뒤)
  { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, a = 0.42 - t * 0.17, p = loftAt(beltP, a, 0.2, new V3()); p.y -= Math.sin(t * Math.PI) * 0.07; const n = new V3(p.x, 0, p.z).normalize(); pts.push(p.addScaledVector(n, 0.01)); }
    const im = new THREE.InstancedMesh(linkGeo, M.silver, 13), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new V3(0, 1, 0);
    for (let i = 0; i < 13; i++) { const d = pts[i + 1].clone().sub(pts[i]).normalize(); q.setFromUnitVectors(Y, d).multiply(new THREE.Quaternion().setFromAxisAngle(Y, (i % 2) * Math.PI / 2)); mt.compose(pts[i].clone().add(pts[i + 1]).multiplyScalar(0.5), q, new V3(1, 1, 1)); im.setMatrixAt(i, mt); }
    im.castShadow = true; J.hips.add(im); }
  add(J.hips, C('pouch', () => loft((v) => ({ y: -0.005 - 0.085 * v, rx: 0.035, rz: 0.022, n: 4 }), 16, 4)), M.leather, [-0.12, 0, -0.07], [0, -0.9, 0]);
  // 치마: 앞 왼쪽 트임, 칼주름, 다리를 따라 출렁임 (매 프레임 변형)
  const sa0 = (v) => 0.418 + 0.035 * smooth(0.25, 1, v), sa1 = (v) => 1.418 - 0.04 * smooth(0.25, 1, v);
  const SK_L = 0.73;
  const skP = (v) => ({ y: 0.012 - SK_L * v, rx: 0.142 + 0.19 * v ** 1.15, rzF: 0.116 + 0.17 * v ** 1.15, rzB: 0.126 + 0.19 * v ** 1.15, n: 2.1 });
  const skF = (inner) => (u, v, p) => { const a = sa0(v) + (sa1(v) - sa0(v)) * u, [c] = ang(a); loftAt(skP, a, v, p); const pl = Math.abs(((a * 32) % 1 + 1) % 1 - 0.5) * 2, k = (1 + 0.04 * (pl - 0.5) * smooth(0, 0.12, v)) * (inner ? 0.985 : 1); p.x *= k; p.z *= k; return c; };
  const skirtOuter = surf(skF(false), 128, 22, { uvU: 1, uvV: 1 }), skirtInner = surf(skF(true), 96, 14);
  const skO = add(J.hips, skirtOuter, M.skirt), skI = add(J.hips, skirtInner, M.lining);
  for (const me of [skO, skI]) { me.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); me.userData.base = me.geometry.attributes.position.array.slice(); me.frustumCulled = false; }
  m.skirt = [skO, skI];
  // 등 뒤 왼쪽 「魔」 천
  const maG = new THREE.Group(); { const p = loftAt(beltP, 1.13, 0, new V3()); maG.position.copy(p).multiplyScalar(1.04); maG.rotation.y = Math.atan2(p.x, p.z); } J.hips.add(maG);
  add(maG, C('maCloth', () => surf((u, v, p) => { const t = 1 - v; p.set((u - 0.5) * 0.17, -0.42 * t, 0.012 - 0.5 * ((u - 0.5) * 0.17) ** 2); }, 6, 12)), M.ma);
  m.maG = maG;
  // 악마 키링 (앞 왼쪽 벨트에 매달린 로프)
  const keyObj = new THREE.Group();
  add(keyObj, C('keyBall', () => new THREE.SphereGeometry(0.032, 24, 16)), M.key, [0, -0.032, 0], [0, 0, 0], [1, 0.92, 0.85]);
  for (const s of [-1, 1]) add(keyObj, C('keyHorn' + s, () => strand([[s * 0.016, -0.012, 0], [s * 0.03, 0.004, 0], [s * 0.026, 0.018, 0.004]], 0.007, 0.001, { seg: 6, rad: 5 })), M.red);
  const keyRope = new Rope(4, 0.022, { damp: 0.97 }), keyView = new RopeChain(keyRope, linkGeo, M.silver, keyObj);
  const keyAnchor = loftAt(beltP, 0.4, 0, new V3()).multiplyScalar(1.03);
  m.ropes.push({ rope: keyRope, view: keyView, joint: J.hips, local: keyAnchor, rest: new V3(0, -1, 0.1), caps: 'legs' });

  /* ---------- 배 · 가슴 · 상의 · 스카프 ---------- */
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: spl([[0, 0.114], [0.45, 0.098], [1, 0.112]])(v), rzF: spl([[0, 0.082], [0.5, 0.074], [1, 0.082]])(v), rzB: 0.08, n: 2.15 }), 40, 14, {
    mod: (p, u, v, c, sn) => { if (sn > 0) { p.z += 0.003 * gauss(Math.abs(p.x) - 0.022, 0.012) * gauss(v - 0.6, 0.25) * sn; p.z -= 0.004 * gauss(p.x, 0.006) * gauss(v - 0.32, 0.03); } } })), M.skin);
  const chX = spl([[0, 0.118], [0.3, 0.128], [0.55, 0.138], [0.8, 0.132], [1, 0.1]]), chF = spl([[0, 0.084], [0.5, 0.094], [1, 0.074]]), chB = spl([[0, 0.08], [0.6, 0.088], [1, 0.07]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.03 * gauss(ax - 0.058, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 24, { mod: chMod, uvU: 3, uvV: 1.5 })), M.wrap);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.125 - 0.075 * v ** 0.8, rzF: 0.075 - 0.028 * v, rzB: 0.07 - 0.026 * v }), 40, 8, {
    mod: (p, u, v, c, sn) => { if (sn > 0) p.z += (0.005 * gauss(p.y - 0.232, 0.01) * gauss(Math.abs(p.x) - 0.055, 0.035) - 0.004 * gauss(p.x, 0.012) * gauss(p.y - 0.24, 0.02)) * sn; } })), M.skin); // 쇄골 · 목 아래 오목
  // 붉은 스카프 매듭 + 늘어진 끝 두 갈래
  { const p = loftAt(chP, 0.5, 0.86, new V3(), chMod);
    add(J.chest, C('tieKnot', () => new THREE.SphereGeometry(0.016, 18, 12)), M.red, [p.x, p.y, p.z + 0.012], [0, 0, 0], [1.2, 0.9, 0.7]);
    for (const s of [-1, 1]) add(J.chest, C('tie' + s, () => surf((u, v, q) => { const w = 0.03 * (1 - v * 0.6); q.set(s * 0.008 + (u - 0.5) * w + s * 0.022 * v, p.y - 0.01 - 0.095 * v, p.z + 0.016 + 0.01 * v - 0.004 * Math.sin(u * Math.PI)); }, 6, 8)), M.red); }

  /* ---------- 크롭 재킷 · 세운 깃 · 흰 털 ---------- */
  const jv0 = 0.34, jkP = (v) => { const w = jv0 + (1 - jv0) * v, s = chP(w); return { ...s, rx: s.rx + 0.03 + 0.008 * v, rzF: s.rzF + 0.034, rzB: s.rzB + 0.03 }; }; // 오버사이즈
  const ja0 = 0.565, ja1 = 1.435;
  const jkMod = (p, u, v, c, sn) => { const e = Math.min(Math.abs(u - ja0), Math.abs(u - ja1)), fold = 1 - smooth(0, 0.06, e); if (sn > 0) { p.z += 0.03 * gauss(Math.abs(p.x) - 0.058, 0.05) * gauss(p.y - 0.13, 0.06) * sn; } const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.012 * fold * (0.4 + v)); };
  add(J.chest, C('jacket', () => loft(jkP, 64, 12, { a0: ja0, a1: ja1, mod: jkMod, uvU: 1, uvV: 1 })), M.jacket);
  add(J.chest, C('jacketIn', () => loft((v) => { const s = jkP(v); return { ...s, rx: s.rx - 0.004, rzF: s.rzF - 0.004, rzB: s.rzB - 0.004 }; }, 48, 8, { a0: ja0, a1: ja1, mod: jkMod })), M.red);
  lRim(J.chest, 'jkHem', jkP, 0, 0.0045, M.silver, { a0: ja0, a1: ja1, mod: jkMod });
  for (const a of [ja0, ja1]) { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(jkP, a, i / 10, new V3(), jkMod)); rim(J.chest, 'jkEdge' + a, pts, 0.005, false); }
  // 붉은 라펠: 앞섶을 따라 바깥으로 젖혀진 넓은 깃 (아래로 갈수록 좁아짐) + 지그재그 은색 테
  for (const [a0, dir] of [[ja0, 1], [ja1, -1]]) {
    const lap = (u, v, p) => { const w = 0.012 + 0.07 * v ** 1.3, a = a0 + dir * w * u; loftAt(jkP, a, 0.18 + 0.82 * v, p, jkMod); const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.006 + 0.006 * u); };
    add(J.chest, C('lapel' + dir, () => surf(lap, 6, 12)), M.red);
    const pts = []; for (let i = 0; i <= 24; i++) { const v = i / 24, p = new V3(); lap(1, v, p); const n = new V3(p.x, 0, p.z).normalize(); pts.push(p.addScaledVector(n, (i % 2) * 0.004)); } rim(J.chest, 'lapRim' + dir, pts, 0.0032, false);
  }
  // 밑단 시보리 (골지 띠)
  { const hb = (v) => { const s0 = jkP(0); return { ...s0, y: s0.y - 0.018 + 0.026 * v, rx: s0.rx + 0.004, rzF: s0.rzF + 0.006, rzB: s0.rzB + 0.004 }; };
    add(J.chest, C('jkRib', () => loft(hb, 64, 3, { a0: ja0, a1: ja1, mod: jkMod, uvU: 1, uvV: 1 })), M.rib); }
  // 세운 깃: 목 뒤로 높이, 앞으로 갈수록 낮아지며 바깥으로 벌어진다
  const colF = (inner) => (u, v, p) => { const a = 0.6 + 0.8 * u, [c, s] = ang(a), back = Math.max(0, -s), h = 0.04 + 0.085 * back * back, R = (0.106 + 0.034 * (1 - back)) * (1 + 0.5 * v) + (inner ? -0.004 : 0); p.set(c * R, 0.235 + h * v, s * R * 0.92 - 0.004); };
  add(J.chest, C('collarO', () => surf(colF(false), 48, 6)), M.jacket); add(J.chest, C('collarI', () => surf(colF(true), 48, 6)), M.red);
  { const pts = []; for (let i = 0; i <= 40; i++) { const p = new V3(); colF(false)(i / 40, 1, p); pts.push(p); } rim(J.chest, 'colRim', pts, 0.004, false);
    // 깃 윗단을 따라 흰 털 (털 관 + 털 카드)
    const furPath = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().multiplyScalar(1.02).add(new V3(0, -0.006, 0))));
    add(J.chest, C('furTube', () => new THREE.TubeGeometry(furPath, 60, 0.02, 10, false)), M.furB);
    const N = 420, im = new THREE.InstancedMesh(C('furCard', () => { const g = new THREE.PlaneGeometry(1, 1, 1, 3); g.translate(0, -0.5, 0); const ps = g.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setZ(i, 0.28 * y * y); } g.computeVertexNormals(); return g; }), M.fur, N);
    const r = rng(12), mt = new THREE.Matrix4(), tg = new V3(), P = new V3(), col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const t = r(); furPath.getPointAt(t, P); furPath.getTangentAt(t, tg); const out = new V3(P.x, 0, P.z).normalize(), th = r() * TAU;
      const nrm = out.clone().multiplyScalar(Math.cos(th)).add(new V3(0, Math.sin(th), 0)).normalize(), p = P.clone().addScaledVector(nrm, 0.016);
      const flow = new V3(0, -1, 0).addScaledVector(out, 0.6).add(new V3((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6)); flow.addScaledVector(nrm, -flow.dot(nrm)).normalize();
      const side = new V3().crossVectors(nrm, flow).normalize(), yA = flow.clone().negate(), zA = new V3().crossVectors(side, yA).normalize(), w = 0.032 + r() * 0.025, L = 0.04 + r() * 0.035;
      mt.makeBasis(side.multiplyScalar(w), yA.multiplyScalar(L), zA.multiplyScalar(w)); mt.setPosition(p); im.setMatrixAt(i, mt); im.setColorAt(i, col.setRGB(0.9 + r() * 0.1, 0.89 + r() * 0.1, 0.87 + r() * 0.1));
    }
    im.castShadow = true; J.chest.add(im); }
  // 어깨 덮개
  for (const [sh, s] of [[J.shoulderL, 1], [J.shoulderR, -1]]) add(sh, C('shCap', () => new THREE.SphereGeometry(0.074, 32, 16, 0, TAU, 0, Math.PI * 0.55)), M.jacket, [s * 0.01, 0.01, 0], [0, 0, s * -0.3], [1, 0.82, 1.05]);

  /* ---------- 팔: 왼팔 불꽃 긴소매 · 오른팔 반소매 + 맨팔 붕대 · 족쇄와 사슬 · 손가락 없는 장갑 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const long = s > 0;
    if (long) {
      add(sh, C('slvU', () => loft((v) => ({ y: 0.03 - (DIMS.uArm + 0.03) * v, rx: 0.068 - 0.01 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.064 - 0.01 * v }), 28, 12)), M.jacket);
      const flP = (v) => ({ y: 0.03 - (DIMS.lArm - 0.0) * v, rx: 0.056 + 0.014 * v * v, rz: 0.054 + 0.013 * v * v }); // 소맷부리로 갈수록 넓어짐
      add(el, C('slvF', () => loft(flP, 28, 10, { uvU: 1, uvV: 1 })), M.sleeve); lRim(el, 'slvCuff', flP, 1, 0.005, M.red);
    } else {
      add(sh, C('uarmSkin', () => loft((v) => ({ y: 0.02 - (DIMS.uArm + 0.02) * v, rx: 0.042 - 0.007 * v, rz: 0.04 - 0.006 * v }), 20, 8)), M.skin);
      const ssP = (v) => ({ y: 0.035 - 0.17 * v, rx: 0.068 + 0.006 * v, rz: 0.064 + 0.006 * v });
      add(sh, C('slvS', () => loft(ssP, 28, 6, { uvU: 1, uvV: 1 })), M.patch); lRim(sh, 'slvSR', ssP, 1, 0.0045, M.red);
      add(el, C('farmSkin', () => loft((v) => ({ y: 0.02 - (DIMS.lArm + 0.0) * v, rx: 0.037 - 0.01 * v, rz: 0.035 - 0.01 * v }), 20, 8)), M.skin);
      add(el, C('bandage', () => loft((v) => ({ y: -0.1 - (DIMS.lArm - 0.1) * v, rx: 0.033 - 0.004 * v, rz: 0.031 - 0.004 * v }), 20, 6, { uvU: 1, uvV: 1.5 })), M.bandage);
    }
    // 족쇄
    const cfP = (v) => ({ y: -DIMS.lArm + 0.045 - 0.042 * v, rx: 0.046, rz: 0.043, n: 2.6 });
    add(el, C('cuff', () => loft(cfP, 28, 3)), M.iron); lRim(el, 'cuffR0', cfP, 0, 0.004, M.iron); lRim(el, 'cuffR1', cfP, 1, 0.004, M.iron);
    for (let i = 0; i < 4; i++) { const p = loftAt(cfP, i / 4 + 0.125, 0.5, new V3()); add(el, C('rivet', () => new THREE.SphereGeometry(0.0055, 10, 8)), M.silver, [p.x * 1.04, p.y, p.z * 1.04]); }
    const end = new THREE.Group(); add(end, C('diamond', diamond), M.iron);
    const rope = new Rope(6, 0.03, { damp: 0.975 }), view = new RopeChain(rope, linkGeo, M.iron, end);
    m.ropes.push({ rope, view, joint: el, local: new V3(s * 0.03, -DIMS.lArm + 0.004, -0.01), rest: new V3(0, -1, 0), caps: 'none', wrist: true });
    // 손: 검은 장갑 손바닥 + 맨 손가락 (조금 작게)
    const hg = new THREE.Group(); hg.scale.setScalar(0.86); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.072 * v, rx: 0.021 + 0.003 * Math.sin(v * Math.PI), rz: 0.034 + 0.005 * v, n: 3, cx: s * 0.017 }), 18, 6)), M.leather);
    for (let k = 0; k < 4; k++) {
      const z = 0.025 - k * 0.0165, L = k === 3 ? 0.86 : 1, pts = [];
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * 2.75 * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.052 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0082, 0.0068, { seg: 14, rad: 8 })), M.skin);
      add(hg, C(`fingG${s}${k}`, () => strand(pts.slice(0, 4), 0.0092, 0.0088, { seg: 6, rad: 8 })), M.leather);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.031], [-s * 0.01, -0.037, 0.046], [s * 0.003, -0.06, 0.045], [s * 0.018, -0.072, 0.037]], 0.0098, 0.0075, { seg: 12, rad: 8 })), M.skin);
  }

  /* ---------- 다리: 니삭스(붉은 줄) · 발목 족쇄 · 하이탑 운동화 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.084], [0.4, 0.074], [1, 0.054]]), thF = spl([[0, 0.08], [1, 0.054]]), thB = spl([[0, 0.088], [0.35, 0.078], [1, 0.05]]);
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12)), M.skin);
    const skP2 = (v) => { const y = -0.16 - (DIMS.thigh - 0.15) * v, w = (0.03 - y) / L; return { y, rx: thX(w) + 0.003, rzF: thF(w) + 0.003, rzB: thB(w) + 0.003 }; };
    add(hp, C('sockT', () => loft(skP2, 28, 8, { uvU: 1, uvV: 1 })), M.sock);
    const cX = spl([[0, 0.052], [0.3, 0.056], [1, 0.034]]), cF = spl([[0, 0.05], [1, 0.034]]), cB = spl([[0, 0.052], [0.3, 0.068], [1, 0.036]]);
    const shP = (v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) });
    add(kn, C('shin', () => loft(shP, 28, 14)), M.black);
    const akP = (v) => ({ y: -DIMS.shin + 0.1 - 0.04 * v, rx: 0.048, rz: 0.048, n: 2.5 });
    add(kn, C('ankleCuff', () => loft(akP, 28, 3)), M.iron); lRim(kn, 'akR0', akP, 0, 0.004, M.iron); lRim(kn, 'akR1', akP, 1, 0.004, M.iron);
    const end = new THREE.Group(); add(end, C('diamond', diamond), M.iron);
    const rope = new Rope(4, 0.03, { damp: 0.975 }), view = new RopeChain(rope, linkGeo, M.iron, end);
    m.ropes.push({ rope, view, joint: kn, local: new V3(s * 0.04, -DIMS.shin + 0.06, 0.0), rest: new V3(0, -1, 0), caps: 'none', floor: true });
    // 하이탑 운동화: 두꺼운 흰 밑창 + 검정/빨강 갑피 + 발목 칼라
    const sw = spl([[0, 0.0], [0.05, 0.03], [0.2, 0.04], [0.55, 0.043], [0.85, 0.036], [1, 0.012]]), shh = spl([[0, 0.03], [0.06, 0.08], [0.25, 0.1], [0.5, 0.07], [0.8, 0.05], [1, 0.03]]);
    const shoe = (u, v, p) => { const [c, sn] = ang(u), w = sw(v), h = shh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, -0.032 + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.06 + 0.24 * v); };
    add(ft, C('shoe', () => surf(shoe, 32, 22, { closedU: true })), M.shoe);
    add(ft, C('sole', () => surf((u, v, p) => { shoe(u, v, p); p.x *= 1.1; p.y = -0.055 + (p.y + 0.032) * 0.35; p.z = -0.065 + (p.z + 0.06) * 1.04; }, 32, 22, { closedU: true })), M.sole);
    add(ft, C('collar', () => loft((v) => ({ y: 0.0 + 0.09 * v, rx: 0.044, rzF: 0.046, rzB: 0.05, cz: -0.005 }), 24, 4)), M.shoe);
  }

  /* ---------- 목 · 철 목줄 · 얼굴 · 뿔 · 머리카락 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.038 - 0.009 * smooth(0.2, 0.8, v), rzF: 0.036 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.036 - 0.004 * v }), 20, 6)), M.skin); // 위로 갈수록 가늘게
  const coP = (v) => ({ y: 0.012 + 0.038 * v, rx: 0.052, rzF: 0.05, rzB: 0.048, n: 2.3 });
  add(J.neck, C('choker', () => loft(coP, 36, 3)), M.iron); lRim(J.neck, 'chkR0', coP, 0, 0.004, M.silver); lRim(J.neck, 'chkR1', coP, 1, 0.004, M.silver);
  { const g = new THREE.Group(); g.position.set(0, 0.03, 0.054); J.neck.add(g); const sh = new THREE.Shape(); sh.moveTo(0, 0.034); sh.lineTo(0.007, 0.01); sh.lineTo(0.026, 0.004); sh.lineTo(0.007, -0.002); sh.lineTo(0, -0.04); sh.lineTo(-0.007, -0.002); sh.lineTo(-0.026, 0.004); sh.lineTo(-0.007, 0.01); sh.closePath();
    add(g, C('cross', () => new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 })), M.silver);
    m.crossGlow = add(g, C('crossG', () => new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false })), M.ember, [0, 0, 0.0055], [0, 0, 0], [0.55, 0.55, 1]); }
  const H = J.head;
  m.headMesh = add(H, C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 88, 66, { closedU: true, poles: [0, 66] })), M.face);
  H.scale.setScalar(1.07); // 애니메 비율: 머리를 조금 크게
  m.faceGlow = add(H, C('head', () => null), M.faceGlow, [0, 0, 0], [0, 0, 0], [1.003, 1.003, 1.003]); m.faceGlow.castShadow = false; m.faceGlow.receiveShadow = false; m.faceGlow.renderOrder = 5;
  for (const s of [-1, 1]) {
    // 뾰족 귀
    add(H, C('ear' + s, () => strand([[s * 0.066, 0.1, -0.005], [s * 0.088, 0.112, -0.016], [s * 0.112, 0.138, -0.03]], 0.015, 0.0015, { seg: 10, rad: 8, flat: 0.35, ref: [s, 0, 0] })), M.skin);
  }
  // 뿔: 관자놀이 위에서 바깥 → 위 → 앞으로 휘는 마디진 뿔
  for (const s of [-1, 1]) {
    const pts = [[s * 0.05, 0.168, -0.012], [s * 0.098, 0.182, -0.04], [s * 0.128, 0.226, -0.04], [s * 0.128, 0.284, -0.01], [s * 0.108, 0.33, 0.026]];
    add(H, C('horn' + s, () => strand(pts, 0.026, 0.0025, { seg: 40, rad: 14, prof: (v) => 1 + 0.1 * Math.abs(Math.sin(v * 34)) * (1 - v) })), M.horn);
    add(H, C('hornBase' + s, () => strand([[s * 0.036, 0.16, 0.012], [s * 0.06, 0.172, -0.016], [s * 0.068, 0.158, -0.05]], 0.016, 0.012, { seg: 10, rad: 10 })), M.horn);
  }
  // 머리카락: 두피 덮개 + 덩어리진 가닥(앞머리는 오른쪽 눈을 덮음) + 바보털
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.1 + 0.4 * w * w : 0.1 - 0.85 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.014 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hair);
    const r = rng(19), clump = (key, pts, r0, r1, flat = 0.35, ref) => add(H, C(key, () => strand(pts, r0 * 1.15, r1, { seg: 16, rad: 8, flat: Math.min(0.55, flat * 1.35), ref: ref || [0, 0, 1] })), M.hair);
    // 앞머리: 정수리 앞 → 이마 → 눈썹 (오른쪽(-x)은 길게 눈을 덮는다)
    for (let k = 0; k < 13; k++) {
      const az = -0.98 + k * 0.165 + (r() - 0.5) * 0.04, right = az < -0.1, len = right ? 0.42 + 0.12 * gauss(az + 0.5, 0.25) : 0.26 + r() * 0.06;
      const pts = [headAt(az * 0.6, 1.05, 0.02), headAt(az * 0.85, 0.72, 0.024), headAt(az, 0.42, 0.02), headAt(az * 1.05 + (right ? 0.08 : 0), 0.42 - len, 0.016 + (right ? 0.006 : 0))];
      clump('bang' + k, pts, 0.024 + r() * 0.012, 0.003, 0.32, [0, 0, 1]);
    }
    // 옆머리 · 뒷머리 (짧고 삐침)
    for (let k = 0; k < 22; k++) {
      const az = k < 6 ? -(1.12 + k * 0.1) : k < 12 ? 1.12 + (k - 6) * 0.1 : Math.PI + (k - 16.5) * 0.26, el0 = k >= 12 ? 0.7 + (k % 2) * 0.25 : 0.6;
      const tipEl = k >= 12 ? -0.72 - r() * 0.2 : -0.5 - r() * 0.25, out = k >= 12 ? 0.03 : 0.02;
      const pts = [headAt(az, el0, 0.018), headAt(az + (r() - 0.5) * 0.2, (el0 + tipEl) / 2, out), headAt(az + (r() - 0.5) * 0.3, tipEl, out + 0.01)];
      const d = dirOf(az, 0); clump('side' + k, pts, 0.028, 0.004, 0.35, [d.x, 0, d.z]);
    }
    clump('ahoge', [headAt(0.2, 1.3, 0.01), new V3(0.01, 0.255, 0.03), new V3(0.03, 0.27, 0.07), new V3(0.04, 0.25, 0.09)], 0.009, 0.0015, 0.4, [1, 0, 0]);
    // 땋은 머리: 목덜미에서 허벅지까지 (로프 물리 + 땋은 결 관)
    const braid = new Rope(14, 0.052, { damp: 0.982, stiff: 0.08 });
    const bt = new RopeTube(braid, M.braid, { sub: 3, rad: 10, uvV: 1, prof: (v) => (v < 0.04 ? 0.026 : 0.024 * (1 - v * 0.25)) * (1 + 0.16 * Math.abs(Math.sin(v * Math.PI * 26))) * (v > 0.9 ? 1 + (v - 0.9) * 6 : 1) * (v > 0.985 ? 0.4 : 1) });
    m.ropes.push({ rope: braid, view: bt, joint: H, local: new V3(0, 0.03, -0.085), rest: new V3(0, -0.55, -0.83).normalize(), caps: 'body' });
    // 머리끈 (땋은 머리 끝 부분) — 로프 끝 근처를 따라감
    const tie = new THREE.Mesh(C('hairTie', () => new THREE.TorusGeometry(0.024, 0.008, 8, 20)), M.iron); tie.castShadow = true; m.braidTie = tie; extras.push(tie);
  }

  /* ---------- 무기: GRIGORI ---------- */
  const club = new THREE.Group(); J.weapon.add(club); m.glaive = club; m.club = club;
  buildClub(club, M, add);

  /* ---------- 씬에 붙는 것들 (로프 · 머리끈) ---------- */
  m.extras = extras;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    for (const r of m.ropes) { const o = r.view.mesh || r.view.im; scene.add(o); extras.push(o); if (r.view.end) { scene.add(r.view.end); extras.push(r.view.end); } }
    scene.add(m.braidTie);
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 매 프레임 ---------- */
  const tS = new V3(), tT = new V3(), tE = new V3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), dn = new V3(0, -1, 0), tmp = new V3();
  const lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 };
  m.ikW = 0; m.awake = 0;
  m.update = (dt, f) => {
    // 왼손: 두 손으로 쥐는 기술에서만 철퇴 자루를 잡는다
    const want = m.weaponOut ? 0 : f.state === 'act' ? (f.act.ikOff ? 0 : 1) : f.state === 'guard' ? 1 : 0;
    m.ikW += (want - m.ikW) * Math.min(1, dt * 14);
    if (m.ikW > 0.02) {
      J.chest.updateMatrixWorld(true); J.weapon.updateMatrixWorld(true);
      J.shoulderL.getWorldPosition(tS); J.weapon.localToWorld(tT.set(0, 0, CL.grip2));
      const sc = f.scale, L1 = DIMS.uArm * sc, L2 = DIMS.lArm * sc, natural = J.handL.getWorldPosition(new V3()); tT.lerp(natural, 1 - m.ikW);
      const d = clamp(tT.distanceTo(tS), 0.05, L1 + L2 - 0.002), dir = tT.clone().sub(tS).normalize(), a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const hint = new V3(0, -1, 0).addScaledVector(f.fwd(new V3()), -0.3).add(f.right(new V3()).multiplyScalar(-0.5)), n = hint.addScaledVector(dir, -hint.dot(dir)).normalize();
      tE.copy(tS).addScaledVector(dir, a).addScaledVector(n, h);
      J.shoulderL.parent.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tE.clone().sub(tS).normalize()); J.shoulderL.quaternion.copy(q0.clone().invert().multiply(q1)); J.shoulderL.updateMatrixWorld(true);
      J.shoulderL.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tT.clone().sub(tE).normalize()); J.elbowL.quaternion.copy(q0.clone().invert().multiply(q1)); J.elbowL.updateMatrixWorld(true);
    }
    // 치마: 다리 각도를 스프링으로 따라가며 앞뒤로 출렁임
    const k = 1 - Math.exp(-dt * 16), tgL = J.hipL.rotation.x, tgR = J.hipR.rotation.x;
    lag.vL += ((tgL - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((tgR - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * k;
    const spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.4, 1.4)), zR = -Math.sin(clamp(lag.R, -1.4, 1.4));
    for (const me of m.skirt) {
      const base = me.userData.base, pa = me.geometry.attributes.position, arr = pa.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, -y), wL = clamp(0.5 + x / 0.14, 0, 1), wR = 1 - wL;
        const dz = (wL * zL + wR * zR) * depth * 0.8, out = 1 + (spread * 0.22 + lag.sw * 0.12) * (depth / SK_L);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.18; arr[i + 2] = z * out + dz - lag.sw * 0.1 * depth;
      }
      pa.needsUpdate = true; me.geometry.computeVertexNormals();
    }
    m.maG.rotation.x = Math.max(0, Math.max(lag.L, lag.R)) * 0.5 + lag.sw * 0.35 + 0.05;
    // 로프들 (땋은 머리 · 사슬 · 키링)
    J.chest.updateMatrixWorld(true);
    // 피격 캡슐: 0 몸통 · 1 머리 · 2~5 팔 · 6~9 다리 (땋은 머리는 팔에 걸리지 않게 제외)
    const capsBody = f.hurt.filter((_, i) => i < 2 || i >= 6).map((c, i) => ({ a: c.a, b: c.b, r: c.r + (i === 0 ? 0.03 : 0.02) * f.scale })), capsLegs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.02 }));
    const wind = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6), fq = new THREE.Quaternion();
    for (const r of m.ropes) {
      r.joint.localToWorld(tmp.copy(r.local)); r.joint.getWorldQuaternion(fq);
      const rest = r.rest.clone(); if (r.joint === H) rest.applyQuaternion(m.root.getWorldQuaternion(new THREE.Quaternion())); else rest.set(0, -1, 0);
      r.rope.step(dt, tmp, r.caps === 'body' ? capsBody : r.caps === 'legs' ? capsLegs : [], f.pos.y + 0.01, rest, wind);
      r.view.update();
    }
    // 땋은 머리 끈 위치
    { const br = m.ropes.find((r) => r.joint === H).rope.p, i = br.length - 3; m.braidTie.position.copy(br[i]).lerp(br[i + 1], 0.5); m.braidTie.quaternion.setFromUnitVectors(new V3(0, 0, 1), tmp.subVectors(br[i + 1], br[i]).normalize()); m.braidTie.visible = f.root.visible; }
    for (const o of extras) o.visible = f.root.visible;
    m.chainsBroken = f.awakenT > 0;
    // 각성: 뿔 균열 · 눈 · 철퇴 발광 (0..1 로 부드럽게)
    // 불: f.fireK (0..1, 열기·발화·각성) → 철퇴 발광과 불길 / 각성: 뿔 균열 · 눈 · 송곳니
    m.awake += ((f.fireK ?? 0) - m.awake) * Math.min(1, dt * 4); m.horned = (m.horned || 0) + ((f.awakenT > 0 ? 1 : 0) - (m.horned || 0)) * Math.min(1, dt * 4);
    const pulse = 0.85 + 0.15 * Math.sin(f.G.time * 9);
    M.horn.emissiveIntensity = m.horned * 2.2 * pulse; M.faceGlow.opacity = m.horned * 0.9; m.faceGlow.visible = m.horned > 0.02; M.club.emissiveIntensity = m.awake * 1.8 * pulse; M.clubR.emissiveIntensity = m.awake * 1.5;
    M.ember.emissiveIntensity = 1 + m.awake * 1.5;
    const open = f.breathing || (f.state === 'act' && f.act && f.act.shout); // 평소엔 무표정 m.headMesh.material = open ? M.faceO : M.face;
    // 각성 중에는 손목 족쇄 사슬이 끊어져 있다
    for (const r of m.ropes) if (r.wrist) { const o = r.view.im; o.visible = f.root.visible && !m.chainsBroken; if (r.view.end) r.view.end.visible = o.visible; }
    if (m.awake > 0.45 && f.root.visible && !m.weaponOut && Math.random() < m.awake) {
      J.weapon.updateMatrixWorld(true); const p = J.weapon.localToWorld(tmp.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, CL.head0 + Math.random() * (CL.top - CL.head0)));
      f.G.fx.p(p, { vel: [rand2(), 1.5 + Math.random() * 2, rand2()], life: 0.35 + Math.random() * 0.3, size: 0.14 + Math.random() * 0.12, size1: 0.02, color: Math.random() < 0.5 ? FIRE : EMBER, alpha: 0.9, drag: 1.5 });
    }
  };
  const rand2 = () => (Math.random() - 0.5) * 0.8;
  m.setWeapon = (v) => { club.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.055;
  // 무기 방향: 포즈의 weapon 값 = 몸(루트) 기준 [피치(위+), 좌우(오른쪽+), 롤]
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.3)); J.weapon.localToWorld(t.set(0, 0, CL.top)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, CL.head0 + 0.12)); J.weapon.localToWorld(t.set(0, 0, CL.top)); };
  m.clubTip = (out) => J.weapon.localToWorld(out.set(0, 0, CL.head1));
  return m;
}

/* =====================================================================
   GRIGORI: 손잡이 아래 갈고리 날 · 끝 창날 · 원뿔 철퇴 머리(붉은 구름) · 가시 띠 · 삼지창 끝
   ===================================================================== */
function buildClub(g, M, add) {
  const X = [Math.PI / 2, 0, 0];
  add(g, C('cl:handle', () => new THREE.CylinderGeometry(0.016, 0.016, CL.handleEnd - CL.butt, 20, 1, true)), M.iron, [0, 0, (CL.handleEnd + CL.butt) / 2], X);
  add(g, C('cl:wrap', () => { const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * TAU * 9; pts.push(new V3(Math.cos(a) * 0.0172, Math.sin(a) * 0.0172, -0.16 + 0.36 * t)); } return strand(pts, 0.0042, 0.0042, { seg: 200, rad: 5 }); }), M.red);
  const band = C('cl:band', () => lathe([[0.016, -0.016], [0.022, -0.012], [0.024, 0], [0.022, 0.012], [0.016, 0.016]], 28));
  for (const z of [-0.2, 0.22, CL.butt + 0.05]) add(g, band, M.iron, [0, 0, z], X);
  // 끝 창날 + 갈고리 날
  const leafG = C('cl:spike', () => { const sh = new THREE.Shape(); sh.moveTo(-0.022, 0); sh.quadraticCurveTo(-0.03, 0.04, 0, 0.13); sh.quadraticCurveTo(0.03, 0.04, 0.022, 0); sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2, curveSegments: 12 }); geo.translate(0, 0, -0.005); geo.rotateX(Math.PI / 2); return geo; });
  add(g, leafG, M.silver, [0, 0, CL.butt + 0.02], [0, Math.PI, 0]);
  add(g, C('cl:hook', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.05, 0.01, 0.075, 0.07); sh.quadraticCurveTo(0.05, 0.04, 0.03, 0.04); sh.quadraticCurveTo(0.012, 0.03, 0, 0.05); sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 12 }); geo.translate(0, 0, -0.003); geo.rotateX(Math.PI / 2); return geo; }), M.silver, [0.01, 0, -0.32]);
  // 철퇴 머리: 팔각 원뿔 (아래 가늘고 위 굵게)
  const hp = (v) => ({ y: CL.head0 + (CL.head1 - CL.head0) * v, rx: 0.03 + 0.05 * v ** 1.2, rz: 0.03 + 0.05 * v ** 1.2, n: 2.8 });
  add(g, C('cl:head', () => { const geo = loft(hp, 32, 16, { uvU: 1, uvV: 1 }); geo.rotateX(Math.PI / 2); return geo; }), M.club);
  add(g, C('cl:neck', () => lathe([[0.016, -0.03], [0.026, -0.02], [0.034, 0], [0.031, 0.02]], 28)), M.iron, [0, 0, CL.head0], X);
  // 가시 띠 + 가시
  add(g, C('cl:crownBand', () => lathe([[0.072, -0.03], [0.088, -0.024], [0.09, 0], [0.088, 0.024], [0.074, 0.032]], 32)), M.iron, [0, 0, CL.head1], X);
  const spike = C('cl:spikeC', () => { const geo = new THREE.ConeGeometry(0.014, 0.05, 10); geo.translate(0, 0.025, 0); return geo; });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, o = add(g, spike, M.silver, [Math.cos(a) * 0.086, Math.sin(a) * 0.086, CL.head1]); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(Math.cos(a), Math.sin(a), 0)); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5, z = CL.head0 + 0.28 + (i % 2) * 0.18, rr = 0.03 + 0.05 * ((z - CL.head0) / (CL.head1 - CL.head0)) ** 1.2; const o = add(g, spike, M.iron, [Math.cos(a) * rr, Math.sin(a) * rr, z], [0, 0, 0], [0.7, 0.7, 0.7]); o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(Math.cos(a), Math.sin(a), 0.15).normalize()); }
  add(g, C('cl:cap', () => lathe([[0.072, 0], [0.06, 0.03], [0.03, 0.045], [0.0, 0.048]], 28)), M.clubR, [0, 0, CL.head1 + 0.028], X);
  // 삼지창 끝
  for (const [x, len] of [[-0.042, 0.13], [0, 0.17], [0.042, 0.13]]) {
    add(g, C('cl:tine' + len, () => strand([[0, 0, 0], [0, 0, len * 0.6], [0, 0, len]], 0.011, 0.0015, { seg: 12, rad: 6, flat: 0.45, ref: [0, 1, 0] })), M.silver, [x, 0, CL.head1 + 0.05]);
    if (x) add(g, C('cl:barb', () => strand([[0, 0, 0], [0.012, 0, 0.02], [0.02, 0, 0.045]], 0.006, 0.001, { seg: 8, rad: 5 })), M.silver, [x, 0, CL.head1 + 0.09], [0, x > 0 ? 0 : Math.PI, 0]);
  }
}
