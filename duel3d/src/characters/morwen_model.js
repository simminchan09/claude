// 모르웬 (MORWEN · 피의 인형사) — 3D 모델 (기술·포즈는 morwen.js)
// "죽은 자의 기억을 인형에 묶어두는 인형사."
//
// 구성: 무릎까지 내려오는 연분홍 금발 + 드릴처럼 말린 긴 컬(로프 물리 · 나선 리본) · 앞머리 · 얼굴 옆 머리
//       파란 눈 · 이마의 붉은 십자 별 표식 · 작은 검은 뿔 · 검은 레이스 헤드드레스 + 파란 장미
//       검은 리본 초커 · 검은 보디스(분홍 테) · 검은 퍼프 소매(분홍 사슬 무늬 테) · 검은 망사 장갑
//       버건디·검정 체크 벨 스커트(붉은 십자 밑단 띠 · 분홍 프릴) · 분홍 앞치마(프릴 · 붉은 십자 문장 · 마름모 · 핏자국) · 등 뒤 큰 검은 리본
//       흰 털로 덮인 가는 다리 · 작은 검은 갈라진 발굽(파우누스)
//       왼팔: 꿰맨 양 인형 (단추 눈 · 갈색 덧댄 천 · 붉은 리본)
//       무기: 피가 흘러내리는 붉은 마리오네트 조종 십자 + 실 (공격할 때 실 채찍이 뻗는다)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, noise3, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.84, spineL: 0.17, chestL: 0.24, neckL: 0.066, shW: 0.17, uArm: 0.255, lArm: 0.235, hipW: 0.08, thigh: 0.41, shin: 0.42, headTop: 0.26 };
// 조종 십자 치수 (오른손 기준 +Z) · 실 채찍 길이
export const CR = { butt: -0.06, bar1: 0.1, bar2: 0.24, tip: 0.3, lash: 2.5 };
export const BLOOD = 0xd0102a, ROSE = 0xff4a7a, PINKF = 0xff7aa8, CREAM = 0xfff0e6, VIOLET = 0x4a1a4a, DARKR = 0x5a0812;
const C = (k, fn) => cached('mor:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function crossPath(g, x, y, s, w = 0.3) { const a = s * w; g.beginPath(); g.moveTo(x - a, y - s); g.lineTo(x + a, y - s); g.lineTo(x + a, y - a); g.lineTo(x + s, y - a); g.lineTo(x + s, y + a); g.lineTo(x + a, y + a); g.lineTo(x + a, y + s); g.lineTo(x - a, y + s); g.lineTo(x - a, y + a); g.lineTo(x - s, y + a); g.lineTo(x - s, y - a); g.lineTo(x - a, y - a); g.closePath(); }
// 핏자국: 번진 얼룩 + 튄 방울 + 흘러내린 줄기
function bloodSplat(g, r, x, y, s, drip = 1) {
  g.save(); g.fillStyle = 'rgba(150,8,24,0.85)';
  g.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, rr = s * (0.6 + 0.5 * r()); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } g.closePath(); g.fill();
  for (let i = 0; i < 14; i++) { const a = r() * TAU, d = s * (1 + r() * 1.6), rr = s * (0.05 + r() * 0.16); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rr, 0, TAU); g.fill(); }
  for (let i = 0; i < 4 * drip; i++) { const dx = x + (r() - 0.5) * s * 1.4, L = s * (0.8 + r() * 2.2), w = s * (0.06 + r() * 0.08); g.fillRect(dx - w / 2, y, w, L); g.beginPath(); g.arc(dx, y + L, w * 0.9, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(90,0,12,0.55)'; g.beginPath(); g.arc(x + s * 0.1, y - s * 0.1, s * 0.35, 0, TAU); g.fill();
  g.restore();
}
// 연분홍 금발 결 (strand uv v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(cap ? 17 : 29), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#f8cfc2'); gr.addColorStop(1, '#f2c2b6'); } else { gr.addColorStop(0, '#ffe6d6'); gr.addColorStop(0.5, '#f9d0c0'); gr.addColorStop(1, '#eeb0a8'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.4 ? 'rgba(214,120,122,0.32)' : k > 0.8 ? 'rgba(255,248,236,0.55)' : 'rgba(246,176,166,0.4)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.bezierCurveTo(x + (r() - 0.5) * 24, H * 0.66, x + (r() - 0.5) * 24, H * 0.33, x + (r() - 0.5) * 10, 0); g.stroke(); }
  if (cap) { g.fillStyle = 'rgba(255,250,240,0.4)'; const y0 = H * 0.35; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - 6 - r() * 16); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + 5 + r() * 12); g.closePath(); g.fill(); }
  return tex(c);
}
// 체크 스커트: 버건디·검정 격자 + 밑단 검은 띠(붉은 십자) — 캔버스 위 = 밑단 (loft v 1)
function plaidTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H); g.fillStyle = '#24121a'; g.fillRect(0, 0, W, H);
  const vg = g.createLinearGradient(0, H, 0, 0); vg.addColorStop(0, '#2e1520'); vg.addColorStop(1, '#1a0d14'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 64) { g.fillStyle = 'rgba(110,20,40,0.55)'; g.fillRect(x, 0, 10, H); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 26, 0, 4, H); g.fillStyle = 'rgba(160,60,90,0.28)'; g.fillRect(x + 40, 0, 2, H); }
  for (let y = 120; y < H; y += 56) { g.fillStyle = 'rgba(110,20,40,0.5)'; g.fillRect(0, y, W, 8); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 22, W, 3); }
  // 주름 음영
  for (let x = 0; x < W; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, 32, H); }
  // 밑단 띠
  g.fillStyle = '#120a0e'; g.fillRect(0, 0, W, 96); g.fillStyle = '#3a1020'; g.fillRect(0, 92, W, 5); g.fillRect(0, 4, W, 3);
  g.fillStyle = '#e8203e'; for (let x = 32; x < W; x += 64) { crossPath(g, x, 50, 18, 0.28); g.fill(); }
  return tex(c);
}
// 프릴: 분홍 바탕 + 밑단 물결 레이스 (알파) — 캔버스 위 = 밑단
function frillTex(col = '#f8b4c8') {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.clearRect(0, 0, W, H); g.fillStyle = col; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,240,245,0.55)'; g.fillRect(0, 0, W, 40);
  for (let x = 0; x < W; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(90,0,30,0.0)'); gr.addColorStop(0.5, 'rgba(90,0,30,0.16)'); gr.addColorStop(1, 'rgba(90,0,30,0.0)'); g.fillStyle = gr; g.fillRect(x, 0, 32, H); }
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < W; x += 32) { g.beginPath(); g.arc(x + 16, 0, 15, 0, Math.PI); g.fill(); }
  for (let x = 0; x < W; x += 32) for (const [dy, rr] of [[28, 4], [42, 2.5]]) { g.beginPath(); g.arc(x + 16, dy, rr, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over'; return tex(c);
}
// 앞치마 (flipY = false: 캔버스 위 = 허리, 아래 = 밑단) — 분홍 · 붉은 십자 문장 · 검은 마름모 · 핏자국
function apronTex() {
  const W = 512, H = 768, [c, g] = cv(W, H), r = rng(66);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f6c4d0'); gr.addColorStop(1, '#eeaabd'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 48) { const fg = g.createLinearGradient(x, 0, x + 48, 0); fg.addColorStop(0, 'rgba(120,20,50,0)'); fg.addColorStop(0.5, 'rgba(120,20,50,0.12)'); fg.addColorStop(1, 'rgba(120,20,50,0)'); g.fillStyle = fg; g.fillRect(x, 0, 48, H); }
  // 검은 마름모 (양옆으로 줄지어)
  g.strokeStyle = '#2a1018'; g.lineWidth = 6;
  for (const [x, y] of [[90, 200], [420, 210], [70, 400], [440, 390], [110, 590], [400, 600], [250, 640]]) { g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x + 24, y); g.lineTo(x, y + 34); g.lineTo(x - 24, y); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(x - 10, y - 14); g.lineTo(x + 10, y + 14); g.stroke(); }
  // 가운데 붉은 십자 문장 (금 테 · 끝이 꽃잎처럼 벌어짐)
  const cx = W / 2, cy = 300;
  const arm = (dx, dy, L, w) => { g.save(); g.translate(cx, cy); g.rotate(Math.atan2(dy, dx)); g.beginPath(); g.moveTo(0, -w * 0.5); g.lineTo(L * 0.75, -w * 0.45); g.quadraticCurveTo(L * 0.9, -w * 1.1, L, -w * 0.9); g.lineTo(L * 0.94, 0); g.lineTo(L, w * 0.9); g.quadraticCurveTo(L * 0.9, w * 1.1, L * 0.75, w * 0.45); g.lineTo(0, w * 0.5); g.closePath(); g.fillStyle = '#c0142c'; g.fill(); g.strokeStyle = '#7a0816'; g.lineWidth = 5; g.stroke(); g.restore(); };
  arm(0, -1, 120, 46); arm(1, 0, 100, 44); arm(-1, 0, 100, 44); arm(0, 1, 230, 50);
  g.fillStyle = '#d8b060'; g.beginPath(); g.arc(cx, cy, 22, 0, TAU); g.fill(); g.fillStyle = '#c0142c'; crossPath(g, cx, cy, 14, 0.3); g.fill();
  g.strokeStyle = 'rgba(255,200,210,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 6, cy - 100); g.lineTo(cx - 6, cy + 200); g.stroke();
  // 핏자국 (아래쪽 · 오른쪽에 크게)
  bloodSplat(g, r, 180, 560, 64, 2); bloodSplat(g, r, 330, 470, 30, 1); bloodSplat(g, r, 380, 680, 44, 1); bloodSplat(g, r, 120, 330, 18, 1);
  // 테두리 박음질
  g.strokeStyle = 'rgba(140,40,70,0.55)'; g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeRect(18, 6, W - 36, H - 24); g.setLineDash([]);
  const t = tex(c); t.flipY = false; return t;
}
// 흰 털: 결 + 끝이 밝은 털 다발 (캔버스 위 = loft v 1 = 아래)
function furTex() {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(91); g.fillStyle = '#f4e6e2'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const x = r() * W, y = r() * H, L = 10 + r() * 26, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(200,160,165,0.35)' : 'rgba(255,255,255,0.55)'; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 6, y + L * 0.5, x + (r() - 0.5) * 8, y + L); g.stroke(); }
  return tex(c, [3, 2]);
}
// 털 껍질 (알파): 아래로 흘러내린 털끝이 실루엣을 보송하게
function furShellTex() {
  const W = 512, H = 256, [c, g] = cv(W, H), r = rng(5); g.clearRect(0, 0, W, H);
  for (let i = 0; i < 1600; i++) { const x = r() * W, y = r() * H, L = 8 + r() * 22; g.strokeStyle = r() < 0.5 ? 'rgba(250,236,234,1)' : 'rgba(225,200,205,1)'; g.lineWidth = 1.2 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + L); g.stroke(); }
  return tex(c, [4, 2]);
}
// 검은 망사 (알파 · 살 위에 겹침)
function netTex() {
  const W = 128, [c, g] = cv(W, W); g.clearRect(0, 0, W, W); g.strokeStyle = 'rgba(16,10,14,1)'; g.lineWidth = 3;
  for (let i = -W; i < W * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + W, W); g.stroke(); g.beginPath(); g.moveTo(i, W); g.lineTo(i + W, 0); g.stroke(); }
  return tex(c, [6, 4]);
}
// 분홍 사슬 무늬 띠 (퍼프 소매 밑단 · 보디스 테)
function chainTex() {
  const W = 512, H = 64, [c, g] = cv(W, H); g.fillStyle = '#16090e'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f08ab0'; g.lineWidth = 5; for (let x = 0; x < W; x += 40) { g.beginPath(); g.ellipse(x + 20, H / 2, 16, 9, 0, 0, TAU); g.stroke(); } g.strokeStyle = '#ffc8dc'; g.lineWidth = 2; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x + 6, H / 2); g.lineTo(x + 34, H / 2); g.stroke(); }
  return tex(c, [3, 1]);
}
// 검은 레이스 (헤드드레스 프릴 · 알파)
function blackLaceTex() {
  const W = 512, H = 128, [c, g] = cv(W, H); g.clearRect(0, 0, W, H); g.fillStyle = '#120a0e'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < W; x += 24) { g.beginPath(); g.arc(x + 12, 0, 11, 0, Math.PI); g.fill(); }
  for (let x = 0; x < W; x += 24) for (const [dy, rr] of [[22, 3.5], [34, 2.5], [48, 3]]) { g.beginPath(); g.arc(x + 12 + (dy === 34 ? 12 : 0), dy, rr, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(90,40,60,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 70); g.lineTo(W, 70); g.stroke();
  return tex(c, [6, 1]);
}
// 양털 인형: 분홍빛 흰 양털 + 갈색 덧댄 천 · 박음질 (lathe/surf uv)
function woolTex() {
  const W = 512, H = 256, [c, g] = cv(W, H), r = rng(33); g.fillStyle = '#f6e2e4'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) { const x = r() * W, y = r() * H, rr = 4 + r() * 8; g.strokeStyle = r() < 0.5 ? 'rgba(210,170,180,0.55)' : 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, r() * TAU, r() * TAU + 4); g.stroke(); }
  for (const [x, y, s] of [[120, 120, 50], [380, 90, 40], [300, 190, 30]]) {
    g.fillStyle = '#8a5a4a'; g.beginPath(); for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU, rr = s * (0.75 + 0.35 * r()); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } g.closePath(); g.fill();
    g.strokeStyle = '#2a1410'; g.lineWidth = 3; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, x0 = x + Math.cos(a) * s * 0.92, y0 = y + Math.sin(a) * s * 0.74; g.beginPath(); g.moveTo(x0 - 4, y0 - 4); g.lineTo(x0 + 4, y0 + 4); g.stroke(); }
  }
  bloodSplat(g, r, 440, 200, 18, 0);
  return tex(c);
}
// 뿔: 검정 + 나이테 고리
function hornTex() { const W = 64, H = 256, [c, g] = cv(W, H); g.fillStyle = '#1a1418'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 14) { g.fillStyle = 'rgba(80,60,70,0.55)'; g.fillRect(0, y, W, 3); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y + 3, W, 2); } return tex(c); }
// 장미 꽃잎: 짙은 파랑 → 가장자리 밝게
function roseTex() { const W = 64, H = 128, [c, g] = cv(W, H), gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, '#16224a'); gr.addColorStop(0.6, '#2c4490'); gr.addColorStop(1, '#6a88d0'); g.fillStyle = gr; g.fillRect(0, 0, W, H); return tex(c); }

/* ---------- 얼굴: 실제 비율 · 무표정 · 파란 눈 · 이마의 붉은 십자 별 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.071, 0.1, 0.088], jaw: 0.34, chin: 0.006 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  g.fillStyle = '#fae6e2'; g.fillRect(0, 0, W, H);
  const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,250,248,0.6)'); gr.addColorStop(0.6, 'rgba(255,236,236,0)'); gr.addColorStop(1, 'rgba(190,140,150,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,150,0)'); cg.addColorStop(1, 'rgba(190,130,140,0.38)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  g.save(); g.filter = 'blur(18px)'; g.fillStyle = 'rgba(240,140,160,0.16)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.036, Y.noseY + 0.006); g.beginPath(); g.ellipse(x, y, 70, 30, 0, 0, TAU); g.fill(); } g.restore();
  // 이마의 붉은 십자 별 (위아래가 긴 네 갈래 별)
  { const my = Y.browY + 0.024, star = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, L = i % 2 ? 0.0028 : (i % 4 === 0 ? 0.017 : 0.0105); star.push(M(Math.sin(a) * L, my + Math.cos(a) * L * (i % 4 === 0 ? 1 : 0.8))); }
    g.fillStyle = '#d0182e'; g.beginPath(); star.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,120,130,0.7)'; const [sx, sy] = M(0, my); g.beginPath(); g.arc(sx, sy, 4, 0, TAU); g.fill(); }
  paintFace(g, M, { ...Y, tilt: -0.04, lidDrop: 0.1, open, iris: ['#d8f4ff', '#62b0ee', '#1c4c9a', '#0a1a44'], pupil: '#06102a', lash: '#3a2026', brow: '#c89a8a', lip: 'rgba(205,105,120,0.7)' });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   드릴 컬: 로프 중심선을 따라가다 아래쪽에서 나선 리본으로 말린다
   ===================================================================== */
class DrillTube {
  // o: { curl0, curl1 (나선이 시작·완성되는 v), R (나선 반경), pitch (한 바퀴 길이 m), w (리본 폭), h (두께), side, rad }
  constructor(rope, mat, o = {}) {
    this.rope = rope; this.o = o; this.L = (rope.n - 1) * rope.seg; this.side = (o.side || new V3(1, 0, 0)).clone();
    const rows = o.rows ?? 120, rad = o.rad ?? 8, cols = rad + 1; this.rows = rows; this.rad = rad; this.cols = cols;
    const g = new THREE.BufferGeometry(), pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), idx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { uv[(j * cols + i) * 2] = i / rad; uv[(j * cols + i) * 2 + 1] = j / (rows - 1) * 3; }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < rad; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.curve = new THREE.CatmullRomCurve3(rope.p, false, 'centripetal');
  }
  update() {
    const { rows, cols, rad, o } = this, pos = this.mesh.geometry.attributes.position.array, P = new V3(), T = new V3(), N = new V3(), B = new V3(), Q = new V3(), A1 = new V3(), A2 = new V3();
    this.curve.points = this.rope.p; let prevN = null; const turns = this.L / (o.pitch ?? 0.07), ph = o.phase ?? 0;
    for (let j = 0; j < rows; j++) {
      const v = j / (rows - 1); this.curve.getPoint(v, P); this.curve.getTangent(v, T);
      if (!prevN) { N.copy(this.side).addScaledVector(T, -this.side.dot(T)); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize(); } else N.copy(prevN).addScaledVector(T, -prevN.dot(T)).normalize();
      prevN = N.clone(); B.crossVectors(T, N);
      const k = smooth(o.curl0 ?? 0.35, o.curl1 ?? 0.55, v), R = (o.R ?? 0.03) * k * (1 - 0.35 * smooth(0.85, 1, v)), a = v * turns * TAU * k + ph;
      Q.copy(P).addScaledVector(N, Math.cos(a) * R).addScaledVector(B, Math.sin(a) * R);
      // 단면: 위쪽(곧은 머리)은 옆으로 넓은 리본, 말린 부분은 축 방향으로 넓은 리본 (빈틈 없이 감김)
      const rad1 = A2.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      A1.copy(N).lerp(T, k).normalize(); if (k < 0.5) A2.copy(B); else A2.copy(rad1);
      const end = v > 0.96 ? 1 - (v - 0.96) / 0.04 * 0.8 : 1, w = (o.w ?? 0.03) * (1 - 0.3 * v) * end * (1 + 0.25 * k), h = (o.h ?? 0.009) * end * (1 + 0.6 * (1 - k));
      for (let i = 0; i < cols; i++) { const th = (i / rad) * TAU, x = Math.cos(th) * w, y = Math.sin(th) * h, q = (j * cols + i) * 3; pos[q] = Q.x + A1.x * x + A2.x * y; pos[q + 1] = Q.y + A1.y * x + A2.y * y; pos[q + 2] = Q.z + A1.z * x + A2.z * y; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere();
  }
}

/* =====================================================================
   꿰맨 양 인형 (모델 · 소환수 · 궁극기 거대 인형이 함께 쓴다)
   ===================================================================== */
const _dm = {};
function dollMats() {
  if (_dm.wool) return _dm;
  const ph = (o) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o });
  _dm.wool = ph({ map: T('wool', woolTex), roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffe0e8), sheenRoughness: 0.6, emissive: 0x2a1418, emissiveIntensity: 0.3 });
  _dm.face = ph({ color: 0xf2d6d6, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color(0xffe0e0) });
  _dm.brown = ph({ color: 0x8a5a4a, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color(0xd0a090) });
  _dm.btn = ph({ color: 0xc8a050, metalness: 0.9, roughness: 0.3, envMap: envCube() });
  _dm.thread = ph({ color: 0x1a0c0e, roughness: 0.9 });
  _dm.ribbon = ph({ color: 0xc81830, roughness: 0.45, sheen: 0.8, sheenColor: new THREE.Color(0xff8090) });
  _dm.blood = ph({ color: 0x8a0414, roughness: 0.15, clearcoat: 1, emissive: 0x3a0008, emissiveIntensity: 0.6 });
  _dm.hoof = ph({ color: 0x2a1c20, roughness: 0.6 });
  return _dm;
}
// 양털 덩어리 곡면: 반지름에 몽글몽글한 요철
function woolBlob(rx, ry, rz, bump = 0.12, seed = 0) {
  return surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el), b = 1 + bump * (noise3(d.x * 3.2 + seed, d.y * 3.2, d.z * 3.2) - 0.5) * 2 * Math.cos(el) ** 0.3; p.set(d.x * rx * b, d.y * ry * b, d.z * rz * b); }, 40, 28, { closedU: true, poles: [0, 28] });
}
// 인형 하나 (원점 = 몸 중심 · 머리가 +Z 쪽 · 크기 약 0.3m). 지오메트리는 공유 캐시
export function buildDoll() {
  const D = dollMats(), g = new THREE.Group(), add = (geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], par = g) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = true; par.add(me); return me; };
  add(C('d:body', () => woolBlob(0.085, 0.075, 0.1, 0.13, 1)), D.wool);
  const head = new THREE.Group(); head.position.set(0, 0.05, 0.1); head.rotation.x = 0.25; g.add(head); g.userData.head = head;
  add(C('d:head', () => woolBlob(0.062, 0.058, 0.062, 0.14, 7)), D.wool, [0, 0.01, 0], [0, 0, 0], [1, 1, 1], head);
  add(C('d:snout', () => { const geo = new THREE.SphereGeometry(0.04, 20, 14); geo.scale(0.95, 0.8, 1.15); return geo; }), D.face, [0, -0.012, 0.045], [0, 0, 0], [1, 1, 1], head);
  // 귀: 늘어진 큰 귀 (안쪽 분홍)
  for (const s of [-1, 1]) { const e = add(C('d:ear', () => { const geo = new THREE.SphereGeometry(0.03, 14, 10); geo.scale(0.55, 0.32, 1.25); geo.translate(0, 0, -0.03); return geo; }), D.face, [s * 0.055, 0.02, 0.005], [0.5, s * 1.9, s * 0.4], [1, 1, 1], head); e.userData.ear = s; }
  // 눈: 금 단추 (한쪽) · X 박음질 (다른 쪽)
  add(C('d:btn', () => new THREE.CylinderGeometry(0.014, 0.014, 0.006, 16)), D.btn, [0.03, 0.012, 0.055], [Math.PI / 2 - 0.3, 0, -0.5], [1, 1, 1], head);
  for (const [dx, dy, dz] of [[-0.004, -0.004, 0.002], [0.004, 0.004, 0.002]]) add(C('d:btnH', () => new THREE.SphereGeometry(0.0025, 6, 4)), D.thread, [0.03 + dx, 0.012 + dy, 0.059 + dz], [0, 0, 0], [1, 1, 1], head);
  for (const r of [0.8, -0.8]) add(C('d:xst', () => new THREE.CylinderGeometry(0.0022, 0.0022, 0.022, 6)), D.thread, [-0.03, 0.014, 0.058], [Math.PI / 2 - 0.3, 0, r], [1, 1, 1], head);
  // 머리 박음질 (정수리 가로지르는 꿰맨 자국)
  { const pts = []; for (let i = 0; i <= 12; i++) { const a = -1.0 + 2.0 * i / 12; pts.push(new V3(Math.sin(a) * 0.064, 0.012 + Math.cos(a) * 0.06, -0.01)); }
    add(C('d:seam', () => strand(pts, 0.0024, 0.0024, { seg: 30, rad: 5 })), D.thread, [0, 0, 0], [0, 0, 0], [1, 1, 1], head);
    for (let i = 1; i < 12; i++) { const p = pts[i]; add(C('d:stitch', () => new THREE.CylinderGeometry(0.0018, 0.0018, 0.016, 5)), D.thread, [p.x * 1.03, p.y * 1.0 + 0.002, p.z], [Math.PI / 2, 0, 0], [1, 1, 1], head); } }
  // 갈색 덧댄 천 (몸 옆)
  add(C('d:patch', () => { const geo = new THREE.CircleGeometry(0.032, 16); return geo; }), D.brown, [0.086, 0.01, -0.01], [0, Math.PI / 2, 0]);
  // 다리: 짧은 털 기둥 + 작은 발굽
  for (const [x, z] of [[-0.045, 0.05], [0.045, 0.05], [-0.045, -0.055], [0.045, -0.055]]) { add(C('d:leg', () => { const geo = new THREE.CylinderGeometry(0.018, 0.02, 0.06, 10); geo.translate(0, -0.03, 0); return geo; }), D.face, [x, -0.05, z]); add(C('d:hoof', () => new THREE.CylinderGeometry(0.02, 0.019, 0.016, 10)), D.hoof, [x, -0.088, z]); }
  // 목의 붉은 리본 + 피 얼룩
  add(C('d:collar', () => new THREE.TorusGeometry(0.05, 0.008, 8, 24)), D.ribbon, [0, 0.03, 0.08], [0.6, 0, 0]);
  for (const s of [-1, 1]) add(C('d:bow' + s, () => strand([[0, 0, 0], [s * 0.03, 0.016, 0.004], [s * 0.034, -0.012, 0.004], [0, 0, 0]], 0.006, 0.006, { closed: true, seg: 16, rad: 6, flat: 0.4, ref: [0, 0, 1] })), D.ribbon, [0, 0.0, 0.118], [0.4, 0, 0]);
  add(C('d:tail', () => woolBlob(0.022, 0.02, 0.02, 0.2, 3)), D.wool, [0, 0.03, -0.1]);
  add(C('d:drip', () => { const geo = new THREE.SphereGeometry(0.008, 10, 8); geo.scale(1, 1.8, 1); return geo; }), D.blood, [0.02, -0.005, 0.135]);
  return g;
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const crossC = pal.cross ?? 0xb0122a, roseC = pal.rose ?? 0xffffff, apronC = pal.apron ?? 0xffffff;
  const M = {
    skin: phys({ color: 0xfbe4e0, emissive: 0x7a5258, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8dc) }),
    face: phys({ map: T('face', () => faceTex(false)), emissiveMap: T('face', () => faceTex(false)), emissive: 0x6a5458, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8dc) }),
    faceO: phys({ map: T('faceO', () => faceTex(true)), emissiveMap: T('faceO', () => faceTex(true)), emissive: 0x6a5458, emissiveIntensity: 1, roughness: 0.5 }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xfff0e8), sheenRoughness: 0.35, emissive: 0x3a2020, emissiveIntensity: 0.3 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xfff0e8), sheenRoughness: 0.35, emissive: 0x3a2020, emissiveIntensity: 0.25 }),
    black: phys({ color: 0x16101a, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0x6a4a6a) }),
    velvet: phys({ color: 0x1e0c16, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0x8a3a5a), sheenRoughness: 0.5 }),
    chain: phys({ map: T('chain', chainTex), roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(0xff9ac0) }),
    pink: phys({ color: 0xf6b8c8, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffe0ea) }),
    skirt: phys({ map: T('plaid', plaidTex), roughness: 0.62, sheen: 0.8, sheenColor: new THREE.Color(0x7a3a50) }),
    frill: phys({ map: T('frill', () => frillTex()), alphaTest: 0.4, roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    frillW: phys({ map: T('frillW', () => frillTex('#fbe8ee')), alphaTest: 0.4, roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    apron: phys({ map: T('apron', apronTex), color: apronC, roughness: 0.58, sheen: 1, sheenColor: new THREE.Color(0xffe8f0), sheenRoughness: 0.5 }),
    fur: phys({ map: T('fur', furTex), roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6, emissive: 0x3a2a2c, emissiveIntensity: 0.35 }),
    furS: phys({ map: T('furS', furShellTex), alphaTest: 0.5, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff), emissive: 0x3a2a2c, emissiveIntensity: 0.35 }),
    net: phys({ map: T('net', netTex), alphaTest: 0.5, roughness: 0.6 }),
    hoof: phys({ color: 0x1e1418, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
    horn: phys({ map: T('horn', hornTex), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    lace: phys({ map: T('blace', () => { const t = blackLaceTex(); t.repeat.set(2, 1); return t; }), alphaTest: 0.4, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0x6a4a6a) }),
    rose: phys({ map: T('rose', roseTex), color: roseC, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0x8aa0ff), sheenRoughness: 0.4 }),
    leaf: phys({ color: 0x1a2a20, roughness: 0.6 }),
    gold: phys({ color: 0xd8a860, metalness: 1, roughness: 0.3 }),
    red: phys({ color: 0xc81830, roughness: 0.45, sheen: 0.8, sheenColor: new THREE.Color(0xff8090) }),
    cross: phys({ color: crossC, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.15, emissive: 0x3a0008, emissiveIntensity: 0.5 }),
    blood: phys({ color: 0x9a0618, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x4a0010, emissiveIntensity: 0.6, transparent: true, opacity: 0.95 }),
    string: new THREE.MeshBasicMaterial({ color: 0xff3a5a }),
    lash: new THREE.MeshBasicMaterial({ color: 0xff4a6a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    nail: phys({ color: 0x2a1018, roughness: 0.2, clearcoat: 1 }),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.lash; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const bow = (parent, key, p, s = 1, mat = M.black, r = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...r); g.scale.setScalar(s); parent.add(g);
    for (const q of [-1, 1]) add(g, C(key + 'L' + q, () => strand([[0, 0, 0], [q * 0.05, 0.03, -0.006], [q * 0.075, 0.0, -0.01], [q * 0.05, -0.028, -0.006], [0, 0, 0]], 0.009, 0.009, { closed: true, seg: 24, rad: 8, flat: 0.32, ref: [0, 0, 1] })), mat);
    for (const q of [-1, 1]) add(g, C(key + 'T' + q, () => strand([[0, 0, 0], [q * 0.02, -0.05, 0.004], [q * 0.012, -0.11, 0.01], [q * 0.035, -0.16, 0.006]], 0.013, 0.01, { seg: 14, rad: 8, flat: 0.25, ref: [0, 0, 1] })), mat);
    add(g, C(key + 'K', () => new THREE.SphereGeometry(0.014, 14, 10)), mat, [0, 0, 0.002], [0, 0, 0], [1, 1.1, 0.7]); return g; };
  m.ropes = [];

  /* ---------- 골반 · 벨 스커트 · 페티코트 프릴 · 앞치마 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: 0.09 - 0.2 * v, rx: 0.11 + 0.024 * v, rzF: 0.08, rzB: 0.09, n: 2.2 }), 28, 6)), M.black);
  const SK_L = 0.37, skR = (d) => { const t = d / SK_L, e = Math.sin(Math.min(1, t * 1.15) * Math.PI / 2) ** 0.9; return { rx: 0.128 + 0.2 * e, rzF: 0.1 + 0.18 * e, rzB: 0.11 + 0.2 * e }; }; // 페티코트로 부풀린 종 모양
  const skP = (v) => ({ y: 0.04 - SK_L * v, ...skR(SK_L * v), n: 2.05 });
  const pleat = (n, amp) => (p, u, v) => { const w = Math.sin(u * TAU * n + 0.7) + 0.35 * Math.sin(u * TAU * n * 2.3), k = 1 + amp * w * smooth(0.05, 0.9, v); p.x *= k; p.z *= k; p.y += 0.006 * w * v * v; };
  const skO = add(J.hips, C('skirt', () => loft(skP, 144, 16, { mod: pleat(12, 0.028) })), M.skirt);
  const ruffle = (n, amp, v0 = 0.2, ph = 0) => (p, u, v) => { const w = Math.sin(u * TAU * n + ph), k = 1 + amp * w * smooth(v0, 1, v); p.x *= k; p.z *= k; p.y += 0.006 * w * smooth(v0, 1, v); };
  const pcP = (d0, d1, out) => (v) => { const d = d0 + (d1 - d0) * v, s = skR(Math.min(SK_L, d)), ex = Math.max(0, d - SK_L) * 0.3; return { y: 0.04 - d, rx: s.rx * out + ex, rzF: s.rzF * out + ex, rzB: s.rzB * out + ex, n: 2.05 }; };
  const pc1 = add(J.hips, C('petti1', () => loft(pcP(0.32, 0.42, 0.985), 160, 8, { mod: ruffle(26, 0.04, 0.3, 1.3) })), M.frill);
  // 앞치마: 허리 앞에서 밑단 조금 위까지 (스커트 위로 살짝 띄움) + 프릴 테
  const APA = 0.17, apF = (dOut) => (u, v, p) => { const a = 0.5 - APA + 2 * APA * u, vv = 0.02 + 0.86 * v; loftAt(skP, a, vv, p); const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, 0.012 + dOut + 0.004 * Math.sin(u * TAU * 3) * v); };
  const apron = add(J.hips, C('apron', () => surf(apF(0), 24, 16)), M.apron);
  const apFr = add(J.hips, C('apronFr', () => surf((u, v, p) => { // 옆 · 아래 테를 따라 도는 프릴
    const t = u, side = t < 0.3 ? 0 : t < 0.7 ? 1 : 2, k = side === 0 ? t / 0.3 : side === 1 ? (t - 0.3) / 0.4 : (t - 0.7) / 0.3;
    const [uu, vv] = side === 0 ? [0, k] : side === 1 ? [k, 1] : [1, 1 - k]; apF(0.003)(uu, vv, p);
    const q = new V3(); apF(0.003)(side === 1 ? uu : uu === 0 ? -0.06 : 1.06, side === 1 ? 1.08 : vv, q); const out = q.sub(p).normalize(), n = new V3(p.x, 0, p.z).normalize();
    p.addScaledVector(out, 0.035 * v).addScaledVector(n, 0.006 * Math.sin(u * 140) * v + 0.004 * v); }, 140, 3)), M.frillW);
  m.skirt = [skO, pc1, apron, apFr];
  for (const me of m.skirt) { me.geometry = me.geometry.clone(); me.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); me.userData.base = me.geometry.attributes.position.array.slice(); me.frustumCulled = false; }
  // 허리띠 + 등 뒤 큰 검은 리본
  const beltP = (v) => ({ y: 0.03 + 0.04 * v, rx: 0.124, rzF: 0.096, rzB: 0.104, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 48, 2)), M.velvet);
  bow(J.hips, 'backBow', [0, 0.06, -0.11], 1.6, M.black, [0, Math.PI, 0]);

  /* ---------- 보디스 · 가슴 · 초커 ---------- */
  const bX = spl([[0, 0.112], [0.45, 0.084], [1, 0.1]]), bF = spl([[0, 0.076], [0.5, 0.062], [1, 0.072]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.076, n: 2.15 }), 40, 12)), M.velvet);
  const chX = spl([[0, 0.098], [0.3, 0.108], [0.55, 0.118], [0.8, 0.114], [1, 0.09]]), chF = spl([[0, 0.072], [0.5, 0.084], [1, 0.068]]), chB = spl([[0, 0.074], [0.6, 0.08], [1, 0.066]]);
  const chP = (v) => ({ y: -0.02 + 0.27 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.024 * gauss(ax - 0.054, 0.04) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod })), M.velvet);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.185 + 0.075 * v, rx: 0.116 - 0.07 * v ** 0.8, rzF: 0.07 - 0.026 * v, rzB: 0.066 - 0.024 * v }), 40, 8)), M.velvet);
  // 가슴 앞 분홍 레이스 V 테 + 붉은 십자 브로치
  for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 10; i++) { const v = 0.98 - 0.6 * (i / 10); pts.push(loftAt(chP, 0.5 + s * (0.13 - 0.12 * (i / 10)), v, new V3(), chMod).multiplyScalar(1.03)); } rim(J.chest, 'vTrim' + s, pts, 0.005, false, M.pink); }
  { const p = loftAt(chP, 0.5, 0.42, new V3(), chMod); const g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.006); J.chest.add(g);
    const sh = new THREE.Shape(); const a = 0.006, s = 0.02; sh.moveTo(-a, s); sh.lineTo(a, s); sh.lineTo(a, a); sh.lineTo(s * 0.8, a); sh.lineTo(s * 0.8, -a); sh.lineTo(a, -a); sh.lineTo(a, -s * 1.4); sh.lineTo(-a, -s * 1.4); sh.lineTo(-a, -a); sh.lineTo(-s * 0.8, -a); sh.lineTo(-s * 0.8, a); sh.lineTo(-a, a); sh.closePath();
    add(g, C('chCross', () => new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 })), M.cross); }
  // 가슴 아래 금 끈 장식 (코르셋 끈)
  for (let i = 0; i < 4; i++) { const v = 0.1 + i * 0.08, a = loftAt(chP, 0.44, v, new V3(), chMod).multiplyScalar(1.02), b = loftAt(chP, 0.56, v + 0.06, new V3(), chMod).multiplyScalar(1.02), c = loftAt(chP, 0.44, v + 0.06, new V3(), chMod).multiplyScalar(1.02), d = loftAt(chP, 0.56, v, new V3(), chMod).multiplyScalar(1.02); rim(J.chest, 'lc' + i, [a, b], 0.0018, false); rim(J.chest, 'lcB' + i, [d, c], 0.0018, false); }
  // 초커: 검은 리본 + 리본 매듭 + 늘어진 끈
  add(J.neck, C('choker', () => loft((v) => ({ y: 0.01 + 0.016 * v, rx: 0.036, rzF: 0.035, rzB: 0.035 }), 32, 2)), M.black);
  { const g = new THREE.Group(); g.position.set(0, 0.016, 0.037); J.neck.add(g); g.scale.setScalar(0.55);
    for (const q of [-1, 1]) add(g, C('chkB' + q, () => strand([[0, 0, 0], [q * 0.03, 0.016, -0.004], [q * 0.04, -0.008, -0.004], [0, 0, 0]], 0.006, 0.006, { closed: true, seg: 16, rad: 6, flat: 0.4, ref: [0, 0, 1] })), M.black);
    for (const q of [-1, 1]) add(g, C('chkT' + q, () => strand([[0, 0, 0], [q * 0.01, -0.04, 0.006], [q * 0.016, -0.09, 0.012]], 0.005, 0.004, { seg: 10, rad: 5, flat: 0.4, ref: [0, 0, 1] })), M.black); }
  // 목둘레 분홍 프릴
  add(J.chest, C('neckFrill', () => surf((u, v, p) => { const a = u * TAU, R = 0.05 + 0.03 * v, wv = Math.sin(u * TAU * 16) * 0.005 * v; p.set(Math.sin(a) * (R + wv), 0.268 - 0.012 * v, Math.cos(a) * (R + wv) * 0.95 + 0.004); }, 96, 3, { closedU: true })), M.frillW);

  /* ---------- 팔: 검은 퍼프 소매 (분홍 사슬 테) · 검은 망사 장갑 · 손 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.041 - 0.009 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.039 - 0.008 * v }), 24, 10)), M.skin);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.034 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.032 - 0.01 * v }), 24, 10)), M.skin);
    add(el, C('farmNet', () => loft((v) => ({ y: 0.0 - DIMS.lArm * v, rx: 0.036 - 0.01 * v + 0.004 * Math.sin(v * 2.5), rz: 0.034 - 0.009 * v }), 24, 10, { uvU: 2, uvV: 2 })), M.net);
    // 퍼프: 어깨에서 크게 부풀어 위팔 중간에서 오므라듦 (주름)
    const pfP = (v) => { const b = Math.sin(Math.PI * Math.min(1, v * 1.05) ** 0.75); return { y: 0.05 - 0.17 * v, rx: 0.048 + 0.04 * b, rz: 0.046 + 0.038 * b }; };
    const pfMod = (p, u, v) => { const k = 1 + 0.05 * Math.sin(u * TAU * 10) * Math.sin(Math.PI * v); p.x *= k; p.z *= k; };
    add(sh, C('puff', () => loft(pfP, 48, 14, { mod: pfMod })), M.velvet);
    const bandP = (v) => ({ y: -0.112 - 0.024 * v, rx: 0.05, rz: 0.048 });
    add(sh, C('puffBand', () => loft(bandP, 28, 2, { uvU: 1 })), M.chain);
    add(sh, C('puffFr', () => surf((u, v, p) => { const a = u * TAU, R = 0.049 + 0.018 * v, wv = Math.sin(u * TAU * 12) * 0.004 * v; p.set(Math.sin(a) * (R + wv), -0.136 - 0.022 * v, Math.cos(a) * (R + wv)); }, 64, 2, { closedU: true })), M.frill);
    // 장갑 끝 (손목) 레이스 프릴
    add(el, C('cuffFr', () => surf((u, v, p) => { const a = u * TAU, R = 0.03 + 0.016 * v, wv = Math.sin(u * TAU * 10) * 0.003 * v; p.set(Math.sin(a) * (R + wv), -DIMS.lArm + 0.03 - 0.02 * v, Math.cos(a) * (R + wv)); }, 48, 2, { closedU: true })), M.lace);
    const hg = new THREE.Group(); hg.scale.setScalar(0.8); hg.position.y = -0.006; ha.add(hg);
    for (const mat of [M.skin, M.net]) {
      const sc = mat === M.net ? 1.06 : 1, ky = mat === M.net ? 'N' : '';
      add(hg, C('palm' + s + ky, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: (0.02 + 0.003 * Math.sin(v * Math.PI)) * sc, rz: (0.033 + 0.004 * v) * sc, n: 3, cx: s * 0.016 }), 18, 6, { uvU: 2 })), mat);
      for (let k = 0; k < 4; k++) {
        const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.7 + k * 0.12 : 2.6;
        for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
        add(hg, C(`fing${s}${k}${ky}`, () => strand(pts, 0.0072 * sc, 0.0058 * sc, { seg: 14, rad: 8 })), mat);
        if (!ky) add(hg, C(`nail${s}${k}`, () => new THREE.SphereGeometry(0.0056, 8, 6)), M.nail, pts[8].toArray(), [0, 0, 0], [1, 1, 0.6]);
      }
      add(hg, C('thumb' + s + ky, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0088 * sc, 0.0066 * sc, { seg: 12, rad: 8 })), mat);
    }
  }

  /* ---------- 다리: 흰 털 (보송한 껍질) · 가는 정강이 · 작은 검은 갈라진 발굽 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.08], [0.4, 0.07], [0.85, 0.05], [1, 0.048]]), thF = spl([[0, 0.078], [0.5, 0.064], [1, 0.05]]), thB = spl([[0, 0.08], [0.35, 0.07], [1, 0.045]]);
    const furMod = (amp) => (p, u, v) => { const n = noise3(u * 18, v * 9, s * 3), k = 1 + amp * (n - 0.5); p.x *= k; p.z *= k; };
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12, { mod: furMod(0.06), uvU: 2 })), M.fur);
    add(hp, C('thighS', () => loft((v) => { const q = thP(v); return { ...q, rx: q.rx + 0.008, rzF: q.rzF + 0.008, rzB: q.rzB + 0.008 }; }, 28, 10, { uvU: 2 })), M.furS);
    // 정강이: 종아리는 짧고 발목 쪽으로 길고 가늘게 (파우누스의 발목)
    const cX = spl([[0, 0.05], [0.25, 0.05], [0.6, 0.032], [0.9, 0.024], [1, 0.026]]), cF = spl([[0, 0.048], [0.5, 0.036], [1, 0.026]]), cB = spl([[0, 0.05], [0.25, 0.062], [0.55, 0.038], [1, 0.026]]);
    const shP = (v) => ({ y: 0.02 - (DIMS.shin - 0.0) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) });
    add(kn, C('shin', () => loft(shP, 28, 16, { mod: furMod(0.08), uvU: 2 })), M.fur);
    add(kn, C('shinS', () => loft((v) => { const q = shP(v); return { ...q, rx: q.rx + 0.009, rzF: q.rzF + 0.009, rzB: q.rzB + 0.011 }; }, 28, 12, { uvU: 2 })), M.furS);
    // 발목 털 뭉치 (발굽 위로 늘어진 털)
    add(ft, C('fetlock', () => loft((v) => ({ y: 0.025 - 0.05 * v, rx: 0.028 + 0.008 * Math.sin(v * Math.PI), rzF: 0.03 + 0.006 * v, rzB: 0.032 + 0.01 * Math.sin(v * Math.PI) }), 24, 6, { mod: furMod(0.14) })), M.fur);
    add(ft, C('fetlockS', () => loft((v) => ({ y: 0.03 - 0.06 * v, rx: 0.036 + 0.008 * Math.sin(v * Math.PI), rzF: 0.038 + 0.004 * v, rzB: 0.04 + 0.01 * Math.sin(v * Math.PI) }), 24, 6)), M.furS);
    // 발굽: 앞이 비스듬한 작은 굽 두 쪽 (뒤꿈치 없이 발끝으로 선다)
    for (const q of [-1, 1]) add(ft, C('hoof' + q, () => surf((u, v, p) => { const [c, sn] = ang(u), y = -0.02 - 0.06 * v, w = 0.0125 + 0.003 * v, d = 0.022 + 0.012 * v, fz = 0.008 + 0.03 * v; p.set(q * 0.0135 + c * w, y, fz * (sn > 0 ? 1 : 0) + sn * d * (sn > 0 ? 0.7 : 0.55)); if (v > 0.98) p.y = -0.08; }, 20, 8, { closedU: true })), M.hoof);
  }

  /* ---------- 목 · 얼굴 · 머리카락 · 뿔 · 헤드드레스 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.032 - 0.007 * smooth(0.2, 0.8, v), rzF: 0.031 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.031 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  m.headMesh = add(H, C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] })), M.face);
  H.scale.setScalar(1.1);
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.067, 0.1, -0.006], [s * 0.079, 0.104, -0.014], [s * 0.083, 0.09, -0.018]], 0.012, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.14 + 0.38 * w * w : 0.14 - 0.9 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.008 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(19), clump = (key, pts, r0, r1, flat, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), M.hair);
    // 앞머리: 가운데 살짝 갈라 내린 일자 앞머리 (눈썹을 덮을락 말락)
    for (let k = 0; k < 17; k++) {
      const t = k / 16, az = 0.95 - t * 1.9 + (r() - 0.5) * 0.04, side = Math.abs(az), tipEl = 0.24 - 0.05 * r() - 0.36 * smooth(0.5, 0.95, side), sweep = (az > 0 ? 0.06 : -0.06) * (1 - side);
      const pts = [headAt(az * 0.3, 1.2, 0.02), headAt(az * 0.7, 0.85, 0.03), headAt(az * 0.92 + sweep * 0.5, 0.55, 0.03), headAt(az + sweep, (0.55 + tipEl) / 2, 0.024), headAt(az + sweep * 1.4, tipEl, 0.012)];
      const d = dirOf(az, 0.5); clump('bang' + k, pts, (k % 2 ? 0.024 : 0.034) + r() * 0.008, 0.0014, 0.22, [d.x, d.y, d.z]);
    }
    // 얼굴 옆 긴 머리: 귀 앞에서 가슴까지 (어깨 앞으로 내려온 머리)
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const az = s * (0.98 + k * 0.16), pts = [headAt(az * 0.9, 0.7, 0.018), headAt(az, 0.1, 0.018), headAt(az * 1.03, -0.5 - k * 0.05, 0.02), new V3(s * (0.1 + k * 0.012), -0.07 - k * 0.01, 0.04 - k * 0.012), new V3(s * (0.11 + k * 0.01), -0.17 - k * 0.025, 0.05 - k * 0.012)];
      const d = dirOf(az, 0); clump(`side${s}${k}`, pts, 0.03, 0.006, 0.24, [d.x, 0, d.z]);
    }
    // 뒷머리 덩어리 (헤드드레스 아래 볼륨 · 등으로 내려옴)
    for (let k = 0; k < 16; k++) {
      const az = Math.PI + (k - 7.5) * 0.24, pts = [headAt(az, 0.75, 0.016), headAt(az + (r() - 0.5) * 0.1, 0.0, 0.026), headAt(az + (r() - 0.5) * 0.15, -0.6, 0.024), headAt(az, -1.0, 0.03)];
      const d = dirOf(az, 0); clump('back' + k, pts, 0.044, 0.026, 0.28, [d.x, 0, d.z]);
    }
    // 드릴 컬: 양옆·뒤로 다섯 가닥씩 (로프 물리 · 아래쪽이 나선으로 말림)
    const locks = [];
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) locks.push([s * (1.45 + k * 0.33), -0.15 - 0.1 * (k % 2), [11, 12, 11, 10, 9][k], [0.04, 0.034, 0.044, 0.036, 0.03][k], k]);
    locks.forEach(([az, el, n, R, k], i) => {
      const rope = new Rope(n, 0.074, { damp: 0.978, stiff: 0.07 }), s = Math.sign(az);
      const view = new DrillTube(rope, M.hair, { R, pitch: 0.075 + 0.012 * (k % 2), w: 0.03, h: 0.011, curl0: 0.46 + 0.06 * (k % 3), curl1: 0.66 + 0.04 * (k % 2), side: new V3(Math.cos(az), 0, -Math.sin(az)), phase: i * 1.3, rows: 110, rad: 8 });
      const local = headAt(az, el, 0.022), rest = new V3(Math.sin(az) * 0.45, -0.85, Math.cos(az) * 0.4 - 0.3).normalize(), sideL = new V3(Math.cos(az), 0, -Math.sin(az));
      m.ropes.push({ rope, view, joint: H, local, rest, sideL, caps: 'body', s });
    });
  }
  // 작은 검은 뿔: 정수리 앞쪽에서 위로 솟아 뒤로 휨 (나이테 고리)
  for (const s of [-1, 1]) {
    const b = headAt(s * 0.45, 0.9, -0.004), pts = [b, b.clone().add(new V3(s * 0.006, 0.028, -0.004)), b.clone().add(new V3(s * 0.013, 0.058, -0.016)), b.clone().add(new V3(s * 0.015, 0.077, -0.04)), b.clone().add(new V3(s * 0.012, 0.081, -0.06))];
    add(H, C('horn' + s, () => strand(pts, 0.013, 0.0012, { seg: 24, rad: 10, prof: (v) => 1 + 0.08 * Math.sin(v * 60) * (1 - v) })), M.horn);
  }
  // 헤드드레스: 귀 뒤에서 정수리를 넘는 검은 레이스 프릴 두 겹 + 뒤통수 작은 보닛 + 양옆 파란 장미
  {
    for (const [k, off, wd] of [[0, 0, 0.03], [1, 0.012, 0.024]]) add(H, C('hdFrill' + k, () => surf((u, v, p) => { const t = (u - 0.5) * 2, az = t * 1.62, el = 0.62 + 0.4 * (1 - t * t) - 0.14 * k, q = headAt(az, el, 0.024 + off), n = headN(q); const fw = new V3(Math.sin(az), 0, Math.cos(az)).multiplyScalar(-0.4).add(n).normalize(); p.copy(q).addScaledVector(fw, wd * v).addScaledVector(n, 0.011 * Math.sin(u * 64 + k * 1.5) * v); }, 160, 3)), k ? M.lace : M.velvet);
    add(H, C('hdBand', () => surf((u, v, p) => { const t = (u - 0.5) * 2, az = t * 1.62, el = 0.62 + 0.4 * (1 - t * t) - 0.06 - 0.1 * v; headAt(az, el, 0.026, p); }, 80, 3)), M.black);
    add(H, C('bonnet', () => surf((u, v, p) => { const az = Math.PI + (u - 0.5) * 2.6, el = 0.2 + 0.7 * v; headAt(az, el, 0.034 + 0.006 * Math.sin(u * 40) * (1 - v), p); }, 40, 10)), M.velvet);
    { const pts = []; for (let i = 0; i <= 40; i++) pts.push(headAt(Math.PI + (i / 40 - 0.5) * 2.6, 0.2, 0.036)); rim(H, 'bonnetRim', pts, 0.004, false, M.pink); }
    // 파란 장미: 말린 꽃잎 리본 (나선) + 바깥 꽃잎 + 잎
    const rose = (p, sc, rot) => { const g = new THREE.Group(); g.position.copy(p); g.scale.setScalar(sc); g.lookAt(p.clone().add(headN(p).multiplyScalar(1).add(new V3(0, 0.3, 0)))); g.rotateZ(rot); H.add(g);
      add(g, C('roseC', () => surf((u, v, q) => { const a = u * TAU * 2.2, R = 0.003 + 0.011 * u, h = (0.012 - 0.004 * u) * v; q.set(Math.cos(a) * (R + 0.003 * v * u), Math.sin(a) * (R + 0.003 * v * u), h + 0.004); }, 70, 4)), M.rose);
      for (let k = 0; k < 3; k++) { const n = 5 + k, r0 = 0.008 + 0.007 * k, L = 0.013 + 0.004 * k, tl = 0.45 + 0.4 * k;
        for (let i = 0; i < n; i++) add(g, C('roseP' + k, () => surf((u, v, q) => { const e = (u - 0.5) * 2, w = e * (0.011 + 0.003 * k) * Math.sin(Math.PI * Math.min(1, 0.2 + v * 0.95)), rr = r0 + L * v * Math.sin(tl) - 0.004 * (1 - e * e) * v, z = 0.012 - 0.004 * k + L * v * Math.cos(tl) + 0.002 * e * e; q.set(rr, w, z); }, 6, 6)), M.rose, [0, 0, 0], [0, 0, (i / n) * TAU + k * 0.55]); }
      return g; };
    for (const s of [-1, 1]) { rose(headAt(s * 1.45, 0.42, 0.045), 1.5, s * 0.4); rose(headAt(s * 1.85, 0.62, 0.035), 1.05, s * 1.2); }
  }

  /* ---------- 왼팔에 안은 꿰맨 양 인형 ---------- */
  const doll = buildDoll(); doll.scale.setScalar(1.1); doll.position.set(-0.07, -0.13, 0.09); doll.rotation.set(Math.PI / 2, 0, 0.5); J.elbowL.add(doll); m.doll = doll;
  m.setDoll = (v) => { doll.visible = v; };

  /* ---------- 무기: 붉은 마리오네트 조종 십자 + 늘어진 실 + 공격용 실 채찍 ---------- */
  const rig = new THREE.Group(); J.weapon.add(rig); m.glaive = rig;
  {
    const X = [Math.PI / 2, 0, 0];
    add(rig, C('cr:main', () => { const g = loft((v) => ({ y: CR.butt + (CR.tip - CR.butt) * v, rx: 0.009, rz: 0.009, n: 3 }), 8, 4); g.rotateX(Math.PI / 2); return g; }), M.cross);
    for (const [z, w] of [[CR.bar1, 0.12], [CR.bar2, 0.085]]) {
      add(rig, C('cr:bar' + w, () => { const g = loft((v) => ({ y: -w + 2 * w * v, rx: 0.008, rz: 0.008, n: 3 }), 8, 4); g.rotateZ(Math.PI / 2); return g; }), M.cross, [0, 0, z]);
      for (const s of [-1, 1]) add(rig, C('cr:knob', () => new THREE.SphereGeometry(0.012, 12, 10)), M.cross, [s * w, 0, z]);
    }
    add(rig, C('cr:knobT', () => new THREE.SphereGeometry(0.014, 12, 10)), M.cross, [0, 0, CR.tip + 0.005]);
    add(rig, C('cr:knobB', () => new THREE.SphereGeometry(0.016, 12, 10)), M.cross, [0, 0, CR.butt]);
    add(rig, C('cr:ring', () => new THREE.TorusGeometry(0.02, 0.004, 8, 20)), M.gold, [0, 0, CR.bar1], X);
    // 흘러내리는 피: 막대 아래로 매달린 방울
    const drip = C('cr:drip', () => { const g = lathe([[0, 0], [0.006, -0.006], [0.005, -0.02], [0.008, -0.034], [0.006, -0.042], [0, -0.046]], 10); return g; });
    for (const [x, z, s] of [[-0.09, CR.bar1, 1.2], [0.05, CR.bar1, 0.8], [0.07, CR.bar2, 1], [-0.04, CR.bar2, 0.7], [0, 0.02, 1.3], [0, 0.18, 0.9]]) add(rig, drip, M.blood, [x, -0.012, z], [0, 0, 0], [s, s, s]);
    // 실 채찍 (공격 중에만 보임 · 휘두르는 방향 반대로 휜다)
    const LR = 26, lg = new THREE.BufferGeometry(), lpos = new Float32Array(LR * 4 * 3 * 3), lidx = [];
    for (let s = 0; s < 3; s++) for (let j = 0; j < LR - 1; j++) for (let i = 0; i < 4; i++) { const b = s * LR * 4, a = b + j * 4 + i, a2 = b + j * 4 + ((i + 1) % 4), c = a + 4, d = a2 + 4; lidx.push(a, c, a2, a2, c, d); }
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage)); lg.setIndex(lidx);
    m.lash = add(J.weapon, lg, M.lash); m.lash.frustumCulled = false; m.lash.visible = false; m.lash.renderOrder = 6; m.lashLR = LR;
  }
  // 조종 십자에서 늘어진 실 두 가닥 (로프 물리) + 끝의 핏방울
  for (const sx of [-0.12, 0.085]) {
    const rope = new Rope(6, 0.06, { damp: 0.97 }), view = new RopeTube(rope, M.string, { sub: 2, rad: 4, prof: () => 0.0022 });
    m.ropes.push({ rope, view, joint: J.weapon, local: new V3(sx, -0.012, sx < 0 ? CR.bar1 : CR.bar2), rest: new V3(0, -1, 0), caps: 'none', str: true });
  }
  m.beads = [0, 1].map(() => { const b = new THREE.Mesh(C('cr:bead', () => { const g = new THREE.SphereGeometry(0.01, 10, 8); g.scale(1, 1.5, 1); return g; }), M.blood); b.castShadow = true; return b; });

  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
    for (const b of m.beads) { scene.add(b); extras.push(b); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const r of m.ropes) r.view.mesh.geometry.dispose(); m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 매 프레임 ---------- */
  const lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 }, tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion(), wq = new THREE.Quaternion();
  const prevTip = new V3(), bendV = new V3(), lashP = new V3(); let hadTip = false;
  m.lashK = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible;
    // 스커트 · 프릴 · 앞치마: 다리 각도를 스프링으로 따라 출렁임
    const k = 1 - Math.exp(-dt * 16), tgL = J.hipL.rotation.x, tgR = J.hipR.rotation.x;
    lag.vL += ((tgL - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((tgR - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * k;
    const spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.4, 1.4)), zR = -Math.sin(clamp(lag.R, -1.4, 1.4));
    for (const me of m.skirt) {
      const base = me.userData.base, pa = me.geometry.attributes.position, arr = pa.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, 0.04 - y), wL = clamp(0.5 + x / 0.16, 0, 1), wR = 1 - wL;
        const dz = (wL * zL + wR * zR) * depth * 0.6, out = 1 + (spread * 0.2 + lag.sw * 0.1) * (depth / 0.45);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.3; arr[i + 2] = z * out + dz * 0.6 - lag.sw * 0.1 * depth;
      }
      pa.needsUpdate = true; me.geometry.computeVertexNormals();
    }
    J.chest.updateMatrixWorld(true);
    // 머리카락 · 실 로프 (몸통은 어깨 높이까지만 · 머리 구 · 스커트 구 · 다리)
    const sc = f.scale, h0 = f.hurt[0], hc = H.localToWorld(tmp2.copy(HC)), hp = J.hips.getWorldPosition(new V3());
    const sk1 = hp.clone().add(new V3(0, -0.16 * sc, 0)), sk2 = hp.clone().add(new V3(0, -0.3 * sc, 0));
    const capsBody = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.66 + 0.05 * sc }, { a: hc, b: hc, r: 0.108 * sc }, { a: sk1, b: sk1, r: 0.26 * sc }, { a: sk2, b: sk2, r: 0.34 * sc }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * sc }))];
    const wind = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6); H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq); J.weapon.getWorldQuaternion(wq);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); if (r.sideL) r.view.side.copy(r.sideL).applyQuaternion(hq);
      r.rope.step(dt, tmp, r.caps === 'none' ? [] : capsBody, f.pos.y + 0.01, r.str ? r.rest : r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = vis && (!r.str || rig.visible);
    }
    m.ropes.filter((r) => r.str).forEach((r, i) => { const p = r.rope.p; m.beads[i].position.copy(p[p.length - 1]); m.beads[i].visible = vis && rig.visible; });
    // 실 채찍: 기술이 lash 를 켜면 뻗어 나가고, 휘두르는 방향 반대로 휜다
    const want = f.lashOn ? 1 : 0; m.lashK += (want - m.lashK) * Math.min(1, dt * (want ? 28 : 10));
    J.weapon.updateMatrixWorld(true); J.weapon.localToWorld(lashP.set(0, 0, CR.tip + CR.lash));
    if (hadTip && dt > 0) { bendV.subVectors(lashP, prevTip).divideScalar(dt).applyQuaternion(wq.clone().invert()); } else bendV.set(0, 0, 0); prevTip.copy(lashP); hadTip = true;
    m.lash.visible = vis && m.lashK > 0.03 && rig.visible;
    if (m.lash.visible) {
      const arr = m.lash.geometry.attributes.position.array, LR = m.lashLR, Lk = CR.lash * Math.min(1, m.lashK * 1.15), bx = clamp(-bendV.x * 0.012, -0.5, 0.5), by = clamp(-bendV.y * 0.012, -0.5, 0.5), t = f.G.time;
      for (let s = 0; s < 3; s++) { const ox = (s - 1) * 0.05, ph = s * 2.1;
        for (let j = 0; j < LR; j++) { const v = j / (LR - 1), z = CR.tip + Lk * v, w = Math.sin(v * 9 + t * 30 + ph) * 0.03 * v, x = ox * (1 - v) + bx * v * v * Lk + w, y = -0.01 + by * v * v * Lk - 0.1 * v * v * (1 - m.lashK) + Math.cos(v * 7 + t * 24 + ph) * 0.02 * v, r = 0.008 * (1 - 0.6 * v) + 0.003;
          for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU, q = ((s * LR + j) * 4 + i) * 3; arr[q] = x + Math.cos(a) * r; arr[q + 1] = y + Math.sin(a) * r; arr[q + 2] = z; } } }
      m.lash.geometry.attributes.position.needsUpdate = true; m.lash.geometry.computeBoundingSphere();
      M.lash.opacity = 0.95 * Math.min(1, m.lashK * 1.5);
    }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    // 인형: 숨 쉬듯 귀가 살랑
    const hd = doll.userData.head; if (hd) hd.rotation.z = Math.sin(f.G.time * 2.2) * 0.06;
  };
  m.setWeapon = (v) => { rig.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.08;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 판정 = 조종 십자 ~ 실 채찍 끝 (채찍이 접혀 있으면 십자만)
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.05)); J.weapon.localToWorld(t.set(0, 0, CR.tip + CR.lash * Math.max(0.12, m.lashK))); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, CR.tip + CR.lash * 0.45 * m.lashK)); J.weapon.localToWorld(t.set(0, 0, CR.tip + CR.lash * Math.max(0.12, m.lashK))); };
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, CR.tip)); };
  m.lashTip = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, CR.tip + CR.lash * Math.max(0.12, m.lashK))); };
  m.extras = extras;
  return m;
}
