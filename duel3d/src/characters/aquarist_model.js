// 아리엘 (AQUARIST) — 3D 모델 (기술·포즈는 aquarist.js)
// "낙천적이고 호기심 많은 소녀. 바다 정령의 힘을 빌려 원거리 마법을 쓴다."
//
// 구성: 큰 하늘색 마녀 모자(검은 챙 안쪽 · 리본 · 금 별 문장 + 아쿠아마린) · 웨이브진 긴 주황빛 금발(로프 물리)
//       레이스 칼라 + 브로치 · 흰 실크 블라우스 · 비치는 레이스 퍼프 소매 · 손등을 덮는 파란 커프스
//       금테 두른 파란 케이프렛 · 갈색 코르셋 벨트(끈 · 금 고리) · 검은 치마 + 흰 프릴 페티코트(다리를 따라 출렁임)
//       금 별 무늬 파란 연미 자락(천 물리, 뾰족한 밑단) · 비치는 검은 스타킹 · 금색 하이힐
//       무기: 금빛 장식 지팡이 + 큰 아쿠아마린 (마법을 쓰면 빛난다)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.83, spineL: 0.18, chestL: 0.25, neckL: 0.068, shW: 0.18, uArm: 0.265, lArm: 0.24, hipW: 0.086, thigh: 0.4, shin: 0.39, headTop: 0.25 };
// 지팡이 치수 (오른손 기준 +Z 방향, m)
export const ST = { butt: -0.92, top: 0.62, gem: 0.75, crown: 0.92 };
export const AQUA = 0x3ad8ff, DEEP = 0x1a6aff, FOAM = 0xe8fbff, GOLDW = 0xffd27a;
const C = (k, fn) => cached('aqu:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function starPath(g, x, y, r0, r1, n = 5, rot = -Math.PI / 2) { g.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r1 : r0; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
function starShape(r0, r1, n = 5) { const sh = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i / (n * 2)) * TAU, r = i % 2 ? r1 : r0; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath(); return sh; }

// 주황빛 금발 결 + 천사의 고리
function hairTex(ring = true) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(31); g.fillStyle = '#eb9a4c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.4 ? '#b8622a' : k > 0.82 ? '#ffd890' : '#f2a95a'; g.globalAlpha = 0.3 + r() * 0.45; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, H); g.bezierCurveTo(x + (r() - 0.5) * 30, H * 0.66, x + (r() - 0.5) * 30, H * 0.33, x + (r() - 0.5) * 12, 0); g.stroke(); }
  if (!ring) { const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(255,240,200,0.18)'); lg.addColorStop(0.5, 'rgba(255,240,200,0)'); lg.addColorStop(1, 'rgba(120,50,10,0.18)'); g.globalAlpha = 1; g.fillStyle = lg; g.fillRect(0, 0, W, H); return tex(c); }
  g.globalAlpha = 0.45; g.fillStyle = '#fff0c0'; const y0 = H * 0.3; g.beginPath(); g.moveTo(0, y0);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - 8 - r() * 20); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + 6 + r() * 14); g.closePath(); g.fill();
  g.globalAlpha = 1; return tex(c);
}
// 비치는 레이스: 육각 그물 + 꽃 문양 + 물결 테 (알파)
function laceTex() {
  const W = 512, [c, g] = cv(W, W), r = rng(8); g.clearRect(0, 0, W, W);
  g.fillStyle = 'rgba(250,250,255,0.5)'; g.fillRect(0, 0, W, W);
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.2;
  for (let y = 0; y < W; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W; x += 12) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.stroke(); }
  for (let i = 0; i < 14; i++) {
    const x = ((i * 137) % 5) * 110 + 50 + r() * 20, y = Math.floor(i / 5) * 170 + 80 + r() * 20;
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 13, 7, a, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 30, 0.2, 2.6); g.stroke(); g.lineWidth = 1.2;
  }
  return tex(c, [3, 2]);
}
// 흰 실크: 은은한 결
function silkTex() {
  const W = 256, [c, g] = cv(W, W), r = rng(4); g.fillStyle = '#f6f4f0'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 40; i++) { const x = r() * W, gr = g.createLinearGradient(x - 10, 0, x + 10, 0); gr.addColorStop(0, 'rgba(200,205,220,0)'); gr.addColorStop(0.5, 'rgba(200,205,220,0.25)'); gr.addColorStop(1, 'rgba(200,205,220,0)'); g.fillStyle = gr; g.fillRect(x - 10, 0, 20, W); }
  return tex(c, [2, 1]);
}
// 코르셋: 갈색 가죽 + 세로 봉제선 + 위아래 박음질
function corsetTex() {
  const W = 512, H = 256, [c, g] = cv(W, H), r = rng(12); g.fillStyle = '#6a3c22'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,220,180'},${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2, 2); }
  for (let i = 0; i < 12; i++) { const x = (i / 12) * W; g.fillStyle = 'rgba(30,14,6,0.55)'; g.fillRect(x, 0, 3, H); g.fillStyle = 'rgba(255,210,170,0.12)'; g.fillRect(x + 4, 0, 2, H); }
  g.strokeStyle = 'rgba(240,200,140,0.7)'; g.setLineDash([7, 6]); g.lineWidth = 2; for (const y of [12, H - 12]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.setLineDash([]);
  return tex(c);
}
// 파란 천: 결 + 은은한 광택
function blueTex(base = '#2f6fd0') {
  const W = 256, [c, g] = cv(W, W), r = rng(6); g.fillStyle = base; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,30' : '255,255,255'},${r() * 0.05})`; g.fillRect(r() * W, r() * W, 2, 1); }
  return tex(c, [2, 2]);
}
// 연미 자락: 파랑 그라데이션 + 흰 테 + 금 별, 밑단은 뾰족한 4갈래 (알파) — 캔버스 위 = 허리
function coatTex() {
  const W = 512, H = 1024, [c, g] = cv(W, H), r = rng(21); g.clearRect(0, 0, W, H);
  const hem = (x) => { const k = (x / W) * 3, f = k - Math.floor(k), tri = 1 - Math.abs(f - 0.5) * 2; return H * (0.82 + 0.16 * Math.pow(tri, 1.6)); }; // 3갈래 끝 (부드럽게)
  const path = new Path2D(); path.moveTo(0, 0); path.lineTo(W, 0); for (let x = W; x >= 0; x -= 4) path.lineTo(x, hem(x)); path.closePath();
  g.save(); g.clip(path);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a5cc0'); gr.addColorStop(0.6, '#3a7ae0'); gr.addColorStop(1, '#5a9cf0'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 8; i++) { const x = (i / 8) * W, fg = g.createLinearGradient(x, 0, x + W / 8, 0); fg.addColorStop(0, 'rgba(255,255,255,0.08)'); fg.addColorStop(0.5, 'rgba(0,0,40,0)'); fg.addColorStop(1, 'rgba(0,0,40,0.25)'); g.fillStyle = fg; g.fillRect(x, 0, W / 8, H); }
  // 금 별 (밑단 쪽에 많이)
  for (let i = 0; i < 26; i++) { const x = r() * W, y = H * (0.3 + 0.55 * Math.sqrt(r())), s = 8 + r() * 14; g.fillStyle = '#ffd36a'; starPath(g, x, y, s, s * 0.42); g.fill(); g.strokeStyle = 'rgba(140,90,20,0.6)'; g.lineWidth = 1.5; g.stroke(); }
  // 흰 테 (밑단 · 양옆)
  g.strokeStyle = '#f8f6f0'; g.lineWidth = 26; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, hem(x) - 6); g.stroke();
  g.strokeStyle = '#ffd36a'; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, hem(x) - 24); g.stroke();
  g.fillStyle = '#f8f6f0'; g.fillRect(0, 0, 16, H); g.fillRect(W - 16, 0, 16, H);
  g.restore(); return tex(c);
}
// 프릴 페티코트: 흰 바탕 + 밑단 레이스 구멍 (알파) — 캔버스 위 = 밑단 (surf v=1)
function frillTex() {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.clearRect(0, 0, W, H);
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(0,0,30,0.0)'); gr.addColorStop(0.5, 'rgba(0,0,30,0.1)'); gr.addColorStop(1, 'rgba(0,0,30,0.0)'); g.fillStyle = gr; g.fillRect(x, 0, 32, H); }
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < W; x += 32) { g.beginPath(); g.arc(x + 16, 0, 16, 0, Math.PI); g.fill(); }
  for (let x = 0; x < W; x += 32) for (const [dy, rr] of [[30, 5], [44, 3]]) { g.beginPath(); g.arc(x + 16, dy, rr, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over'; return tex(c, [1, 1]);
}
// 검은 치마: 주름 음영
function skirtTex() {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.fillStyle = '#16151c'; g.fillRect(0, 0, W, H);
  const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, '#22212c'); vg.addColorStop(1, '#141319'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3a62c0'; g.fillRect(0, 10, W, 5); g.fillStyle = '#c8a050'; g.fillRect(0, 18, W, 2); // 밑단 (캔버스 위 = v 1)
  return tex(c);
}

/* ---------- 얼굴 (머리 UV: P(az, el)) — 'n' 기본 · 'o' 입 벌림 · 'w' 윙크 ---------- */
function faceTex(mode) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU;
  g.fillStyle = '#fde2d2'; g.fillRect(0, 0, W, H);
  const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,245,236,0.6)'); gr.addColorStop(0.6, 'rgba(255,232,220,0)'); gr.addColorStop(1, 'rgba(200,130,120,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(210,130,120,0)'); cg.addColorStop(1, 'rgba(200,120,110,0.45)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  // 볼 홍조 (크게) + 홍조 빗금
  g.save(); g.filter = 'blur(16px)'; g.fillStyle = 'rgba(255,120,130,0.45)'; for (const sd of [-1, 1]) { const [x, y] = P(sd * 0.5, -0.17); g.beginPath(); g.ellipse(x, y, K * 0.17, K * 0.065, 0, 0, TAU); g.fill(); } g.restore();
  g.strokeStyle = 'rgba(230,90,110,0.55)'; g.lineWidth = 3; g.lineCap = 'round'; for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const [x, y] = P(sd * (0.44 + k * 0.06), -0.16); g.beginPath(); g.moveTo(x - 6, y + 8); g.lineTo(x + 6, y - 8); g.stroke(); }
  g.save(); g.filter = 'blur(10px)'; g.fillStyle = 'rgba(220,120,110,0.22)'; for (const sd of [-1, 1]) { const [x, y] = P(sd * 0.37, 0.1); g.beginPath(); g.ellipse(x, y, K * 0.2, K * 0.07, 0, 0, TAU); g.fill(); } g.restore();
  // 코
  { const [x, y] = P(0.01, -0.14); g.fillStyle = 'rgba(200,120,110,0.5)'; g.beginPath(); g.ellipse(x, y, 4, 3, 0, 0, TAU); g.fill(); }
  // 눈썹: 가늘고 둥글게 올라간 (밝은 표정)
  g.strokeStyle = '#a8602e'; g.lineCap = 'round';
  for (const sd of [-1, 1]) { const [x0, y0] = P(sd * 0.15, 0.22), [x1, y1] = P(sd * 0.36, 0.3), [x2, y2] = P(sd * 0.56, 0.25); for (let k = 0; k < 2; k++) { g.lineWidth = 7 - k * 3; g.beginPath(); g.moveTo(x0, y0 + k); g.quadraticCurveTo(x1, y1 - 6 + k, x2, y2 + k); g.stroke(); } }
  // 입
  if (mode === 'o') {
    const [x0, y0] = P(-0.15, -0.41), [x1, y1] = P(0.15, -0.41), [xb, yb] = P(0, -0.56);
    g.fillStyle = '#7a1a2a'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 + 4, x1, y1); g.quadraticCurveTo(x1 - 8, yb, xb, yb); g.quadraticCurveTo(x0 + 8, yb, x0, y0); g.fill();
    g.fillStyle = '#f08090'; g.beginPath(); g.ellipse(xb, yb - 12, 30, 12, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.fillRect(x0 + 16, y0, x1 - x0 - 32, 7);
    g.strokeStyle = '#a8404a'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 + 4, x1, y1); g.stroke();
  } else {
    // 활짝 웃는 입 (살짝 벌어진 D 모양)
    const [x0, y0] = P(-0.13, -0.42), [x1, y1] = P(0.13, -0.42), [xb, yb] = P(0, -0.5);
    g.fillStyle = '#8a2232'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 + 2, x1, y1); g.quadraticCurveTo(x1 - 10, yb, xb, yb); g.quadraticCurveTo(x0 + 10, yb, x0, y0); g.fill();
    g.fillStyle = '#f08898'; g.beginPath(); g.ellipse(xb, yb - 7, 20, 7, 0, 0, TAU); g.fill();
    g.strokeStyle = '#a8404a'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x0 - 6, y0 - 5); g.quadraticCurveTo(x0, y0 + 2, x0 + 4, y0); g.moveTo(x1 + 6, y1 - 5); g.quadraticCurveTo(x1, y1 + 2, x1 - 4, y1); g.stroke();
  }
  // 눈: 크고 둥근 호박색 눈 + 큰 반사광 / 윙크(오른눈 -x)는 ^ 모양
  for (const sd of [-1, 1]) {
    const [cx, cy] = P(sd * 0.36, 0.04), w = K * 0.43, inX = cx - sd * w * 0.46, outX = cx + sd * w * 0.5;
    if (mode === 'w' && sd < 0) {
      g.strokeStyle = '#3a1a10'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(inX, cy + 6); g.quadraticCurveTo(cx, cy - 26, outX, cy + 4); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.moveTo(outX, cy + 4); g.lineTo(outX + sd * 14, cy + 10); g.stroke();
      continue;
    }
    const top = new Path2D(); top.moveTo(inX, cy - 2); top.bezierCurveTo(cx - sd * w * 0.25, cy - 52, cx + sd * w * 0.28, cy - 52, outX, cy - 16);
    const eye = new Path2D(); eye.moveTo(inX, cy - 2); eye.bezierCurveTo(cx - sd * w * 0.25, cy - 52, cx + sd * w * 0.28, cy - 52, outX, cy - 16); eye.bezierCurveTo(cx + sd * w * 0.3, cy + 42, cx - sd * w * 0.25, cy + 44, inX, cy - 2);
    g.save(); g.clip(eye);
    g.fillStyle = '#fffaf6'; g.fillRect(cx - w, cy - 60, w * 2, 120);
    const ix = cx + sd * 3, iy = cy + 2, ir = g.createRadialGradient(ix, iy + 14, 4, ix, iy, 42); ir.addColorStop(0, '#ffe08a'); ir.addColorStop(0.45, '#f59a28'); ir.addColorStop(0.85, '#b85a10'); ir.addColorStop(1, '#5a2808');
    g.fillStyle = ir; g.beginPath(); g.ellipse(ix, iy, 36, 46, 0, 0, TAU); g.fill(); g.strokeStyle = '#4a2008'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#3a1806'; g.beginPath(); g.ellipse(ix, iy + 2, 11, 16, 0, 0, TAU); g.fill();
    const sh = g.createLinearGradient(0, cy - 40, 0, cy - 6); sh.addColorStop(0, 'rgba(80,30,10,0.6)'); sh.addColorStop(1, 'rgba(80,30,10,0)'); g.fillStyle = sh; g.fillRect(cx - w, cy - 44, w * 2, 40);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix - sd * 11, iy - 15, 10, 12, -0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(ix + sd * 12, iy + 18, 5, 5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(ix, iy + 24, 14, 6, 0, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = '#3a1a10'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 9; g.stroke(top);
    g.lineWidth = 6; g.beginPath(); g.moveTo(outX - sd * 4, cy - 14); g.quadraticCurveTo(outX + sd * 10, cy - 18, outX + sd * 16, cy - 26); g.stroke(); // 속눈썹 끝
    g.lineWidth = 3; g.strokeStyle = 'rgba(140,70,50,0.6)'; g.beginPath(); g.moveTo(inX + sd * 12, cy - 30); g.bezierCurveTo(cx - sd * w * 0.2, cy - 54, cx + sd * w * 0.25, cy - 54, outX - sd * 4, cy - 28); g.stroke();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(60,24,12,0.6)'; g.beginPath(); g.moveTo(cx - sd * w * 0.1, cy + 34); g.quadraticCurveTo(cx + sd * w * 0.3, cy + 28, outX - sd * 2, cy - 8); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   얼굴형 (아자젤과 같은 애니메 얼굴 — 조금 더 둥근 볼)
   ===================================================================== */
const HC = new V3(0, 0.103, 0.006), HR = [0.072, 0.101, 0.09];
// 구를 깎아 만든 애니메 얼굴: 각진 두개(옆면 평평) · 뒤로 나온 뒤통수 · 평평한 앞얼굴 · 눈두덩 · 작은 콧대 · 광대
//                          V자 턱선(턱끝은 앞으로 뾰족) · 턱 아래 → 목으로 꺾이는 면
function headPt(dx, dy, dz, out) {
  const ax = Math.abs(dx), fz = Math.max(0, dz), bz = Math.max(0, -dz), low = smooth(-0.05, -0.95, dy);
  // 수평 단면을 약간 둥근 사각으로 (두개는 각지게, 아래로 갈수록 타원)
  const h = Math.hypot(dx, dz) || 1e-6, cx = dx / h, cz = dz / h, n = 2 + 0.55 * (1 - low), sq = Math.pow(Math.pow(Math.abs(cx), n) + Math.pow(Math.abs(cz), n), -1 / n);
  let x = dx * sq * HR[0] * 0.97, y = dy * HR[1], z = dz * sq * HR[2];
  z *= 1 + 0.1 * bz * smooth(-0.5, 0.4, dy);                                   // 뒤통수
  z *= 1 - 0.07 * fz * fz * (1 - low);                                          // 앞얼굴을 평평하게
  // 턱: 아래로 갈수록 좁아지며 V 자 (앞쪽이 더 좁다), 옆·뒤 아래는 안으로 들어가 목으로 이어짐
  x *= 1 - low * (0.28 + 0.4 * fz);
  z *= 1 - 0.38 * low * bz;
  y += 0.022 * low * bz * bz;                                                   // 턱 뒤 → 귀 아래 각
  z -= 0.012 * low * low * (1 - fz) ;
  z += 0.014 * gauss(dy + 0.86, 0.16) * Math.pow(fz, 3); y -= 0.006 * gauss(dy + 0.86, 0.16) * fz;   // 앞으로 나온 턱끝
  z += 0.004 * gauss(ax - 0.5, 0.2) * gauss(dy + 0.12, 0.22) * fz;               // 광대
  z -= 0.004 * gauss(ax - 0.36, 0.16) * gauss(dy - 0.04, 0.12) * fz;            // 눈두덩 (눈이 살짝 들어감)
  z += 0.003 * gauss(ax - 0.34, 0.25) * gauss(dy - 0.24, 0.07) * fz;            // 눈썹뼈
  z += (0.011 * gauss(dx, 0.04) * gauss(dy + 0.14, 0.065) + 0.004 * gauss(dx, 0.03) * gauss(dy + 0.02, 0.12)) * Math.pow(fz, 3); // 콧대 · 코끝
  z += 0.003 * gauss(dx, 0.14) * gauss(dy + 0.43, 0.08) * fz;                   // 입술
  return out.set(HC.x + x, HC.y + y, HC.z + z);
}
const dirOf = (az, el, out = new V3()) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
const headN = (p) => new V3((p.x - HC.x) / (HR[0] * HR[0]), (p.y - HC.y) / (HR[1] * HR[1]), (p.z - HC.z) / (HR[2] * HR[2])).normalize();
const headAt = (az, el, off = 0, out = new V3()) => { const d = dirOf(az, el), p = headPt(d.x, d.y, d.z, out); if (off) p.addScaledVector(headN(p), off); return p; };

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const blue = pal.blue ?? 0x2f6fd0, hatC = pal.hat ?? 0x9ad0f4;
  const faceM = (k) => phys({ map: T('face' + k, () => faceTex(k)), emissiveMap: T('face' + k, () => faceTex(k)), emissive: 0x6a5450, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd0c0) });
  const M = {
    skin: phys({ color: 0xfde0d0, emissive: 0x7a5048, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd0c0) }),
    hair: phys({ map: T('hair', hairTex), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xffd8a0), sheenRoughness: 0.35, emissive: 0x3a1a08, emissiveIntensity: 0.25 }),
    hairS: phys({ map: T('hairS', () => hairTex(false)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xffd8a0), sheenRoughness: 0.35, emissive: 0x3a1a08, emissiveIntensity: 0.25 }),
    face: faceM('n'), faceO: faceM('o'), faceW: faceM('w'),
    blouse: phys({ map: T('silk', silkTex), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xdfe6ff), sheenRoughness: 0.3 }),
    lace: phys({ map: T('lace', laceTex), transparent: true, depthWrite: false, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    sheer: phys({ map: T('lace', laceTex), transparent: true, opacity: 0.45, depthWrite: false, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xdfe8ff) }),
    white: phys({ color: 0xf8f6f0, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    blue: phys({ map: T('blue', () => blueTex()), color: blue, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0x9ac8ff), sheenRoughness: 0.4 }),
    corset: phys({ map: T('corset', corsetTex), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    ribbon: phys({ color: 0x7a4426, roughness: 0.45, sheen: 0.8, sheenColor: new THREE.Color(0xd8a070) }),
    lacing: phys({ color: 0xf0e8d8, roughness: 0.7 }),
    gold: phys({ color: 0xf2c25a, metalness: 1, roughness: 0.24, clearcoat: 0.4 }),
    goldD: phys({ color: 0xc8902a, metalness: 1, roughness: 0.32 }),
    skirt: phys({ map: T('skirt', skirtTex), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x50506a) }),
    frill: phys({ map: T('frill', frillTex), alphaTest: 0.4, roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    black: phys({ color: 0x141318, roughness: 0.6 }),
    coat: phys({ map: T('coat', coatTex), alphaTest: 0.45, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0x9ac8ff), sheenRoughness: 0.4 }),
    hat: phys({ color: hatC, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xe0f4ff), sheenRoughness: 0.4, emissive: 0x1a3048, emissiveIntensity: 0.25 }),
    hatIn: phys({ color: 0x24336e, roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0x6a86d8) }),
    gem: phys({ color: 0x5ae8f0, emissive: AQUA, emissiveIntensity: 0.7, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, flatShading: true, envMapIntensity: 1.5 }),
    pearl: phys({ color: 0xf8f4ff, roughness: 0.18, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color(0xc0e8ff) }),
    halo: new THREE.MeshBasicMaterial({ color: AQUA, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  M.gem.envMap = env;
  // 비치는 스타킹: 정면(시선과 수직인 면)은 살빛이 비치고, 가장자리로 갈수록 짙은 검정
  M.tights = phys({ color: 0x241c22, roughness: 0.42, sheen: 0.7, sheenColor: new THREE.Color(0xa08898), sheenRoughness: 0.35 });
  M.tights.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ float nv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0); diffuseColor.rgb = mix(vec3(0.035, 0.03, 0.038), vec3(0.72, 0.46, 0.4), pow(nv, 1.9) * 0.7); }'); };
  M.tights.customProgramCacheKey = () => 'aqu-nylon';
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.lace && mat !== M.halo; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  m.ropes = [];

  /* ---------- 골반 · 코르셋 벨트 · 치마 · 페티코트 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: 0.09 - 0.2 * v, rx: 0.116 + 0.024 * v, rzF: 0.084, rzB: 0.096, n: 2.2 }), 28, 6)), M.black);
  const beltP = (v) => ({ y: 0.0 + 0.05 * v, rx: 0.134, rzF: 0.102, rzB: 0.108, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 56, 3, { uvU: 3 })), M.corset);
  lRim(J.hips, 'beltR0', beltP, 0, 0.003, M.goldD); lRim(J.hips, 'beltR1', beltP, 1, 0.003, M.goldD);
  { const p = loftAt(beltP, 0.5, 0.5, new V3()); // 금 고리 버클
    add(J.hips, C('buckle', () => new THREE.TorusGeometry(0.02, 0.0045, 8, 24)), M.gold, [p.x, p.y, p.z + 0.006], [0, 0, 0], [1.25, 1, 1]);
    add(J.hips, C('buckleBar', () => new THREE.CylinderGeometry(0.003, 0.003, 0.04, 8)), M.gold, [p.x, p.y, p.z + 0.007]); }
  // 검은 치마 (짧은 플레어 · 칼주름) + 흰 페티코트 두 단 (아래로 비침)
  const SK_L = 0.4, skR = (d) => { const t = d / SK_L, e = t * t * (1.6 - 0.6 * t); return { rx: 0.138 + 0.13 * e, rzF: 0.108 + 0.1 * e, rzB: 0.12 + 0.13 * e }; };
  const skP = (v) => ({ y: 0.01 - SK_L * v, ...skR(SK_L * v), n: 2.1 });
  const pleat = (n, amp) => (p, u, v) => { const w = Math.sin(u * TAU * n + 0.7) + 0.35 * Math.sin(u * TAU * n * 2.3), k = 1 + amp * w * smooth(0.05, 0.9, v); p.x *= k; p.z *= k; p.y += 0.008 * w * v * v; }; // 부드럽게 늘어진 큰 주름
  const skO = add(J.hips, C('skirt', () => loft(skP, 144, 16, { mod: pleat(11, 0.03) })), M.skirt);
  const pcP = (d0, d1, out) => (v) => { const d = d0 + (d1 - d0) * v, s = skR(d); return { y: 0.01 - d, rx: s.rx * out, rzF: s.rzF * out, rzB: s.rzB * out, n: 2.1 }; };
  const ruffle = (n, amp, v0 = 0.2, ph = 0) => (p, u, v) => { const w = Math.sin(u * TAU * n + ph), k = 1 + amp * w * smooth(v0, 1, v); p.x *= k; p.z *= k; p.y += 0.006 * w * smooth(v0, 1, v); };
  const pc1 = add(J.hips, C('petti1', () => loft(pcP(0.28, 0.44, 0.955), 160, 10, { mod: ruffle(17, 0.03, 0.55) })), M.frill);
  const pc2 = add(J.hips, C('petti2', () => loft(pcP(0.36, 0.475, 0.975), 160, 8, { mod: ruffle(21, 0.035, 0.3, 1.3) })), M.frill);
  m.skirt = [skO, pc1, pc2];
  for (const me of m.skirt) { me.geometry = me.geometry.clone(); me.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); me.userData.base = me.geometry.attributes.position.array.slice(); me.frustumCulled = false; }

  /* ---------- 블라우스 · 코르셋 · 가슴 ---------- */
  const bX = spl([[0, 0.114], [0.45, 0.088], [1, 0.104]]), bF = spl([[0, 0.078], [0.5, 0.066], [1, 0.076]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.15 }), 40, 12)), M.blouse);
  // 코르셋: 허리를 조이고 앞은 끈으로 엮음 (봉제 결 · 금 고리)
  const coP = (v) => { const y = -0.05 + 0.2 * v, w = clamp((y + 0.035) / 0.24, 0, 1); return { y, rx: bX(w) + 0.008, rzF: bF(w) + 0.009, rzB: 0.087, n: 2.2 }; };
  const coA0 = 0.53, coA1 = 1.47; // 앞 가운데는 끈 트임
  add(J.spine, C('corset', () => loft(coP, 56, 10, { a0: coA0, a1: coA1, uvU: 1 })), M.corset);
  lRim(J.spine, 'coR0', coP, 0, 0.003, M.goldD, { a0: coA0, a1: coA1 }); lRim(J.spine, 'coR1', coP, 1, 0.003, M.goldD, { a0: coA0, a1: coA1 });
  { const eL = [], eR = []; for (let i = 0; i <= 6; i++) { const v = 0.08 + i * 0.14; eL.push(loftAt(coP, coA0, v, new V3())); eR.push(loftAt(coP, coA1, v, new V3())); }
    for (const p of [...eL, ...eR]) add(J.spine, C('eyelet', () => new THREE.TorusGeometry(0.004, 0.0015, 6, 12)), M.gold, [p.x, p.y, p.z + 0.002]);
    for (let i = 0; i < 6; i++) { rim(J.spine, 'lace' + i, [eL[i], eL[i].clone().lerp(eR[i + 1], 0.5).add(new V3(0, 0, 0.004)), eR[i + 1]], 0.0018, false, M.lacing); rim(J.spine, 'laceB' + i, [eR[i], eR[i].clone().lerp(eL[i + 1], 0.5).add(new V3(0, 0, 0.004)), eL[i + 1]], 0.0018, false, M.lacing); }
    const top = eL[6].clone().lerp(eR[6], 0.5).add(new V3(0, 0.004, 0.006)); // 끈 매듭 리본
    for (const s of [-1, 1]) add(J.spine, C('lbow' + s, () => strand([[0, 0, 0], [s * 0.016, 0.008, 0.004], [s * 0.022, -0.004, 0.004], [0, 0, 0]], 0.003, 0.003, { closed: true, seg: 16, rad: 5 })), M.lacing, [top.x, top.y, top.z]);
    for (const s of [-1, 1]) add(J.spine, C('ltail' + s, () => strand([[0, 0, 0], [s * 0.006, -0.03, 0.006], [s * 0.004, -0.06, 0.004]], 0.0018, 0.0014, { seg: 8, rad: 5 })), M.lacing, [top.x, top.y, top.z]); }
  const chX = spl([[0, 0.104], [0.3, 0.114], [0.55, 0.124], [0.8, 0.12], [1, 0.094]]), chF = spl([[0, 0.076], [0.5, 0.086], [1, 0.07]]), chB = spl([[0, 0.078], [0.6, 0.086], [1, 0.07]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.028 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod, uvU: 2 })), M.blouse);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.122 - 0.074 * v ** 0.8, rzF: 0.074 - 0.028 * v, rzB: 0.069 - 0.026 * v }), 40, 8)), M.blouse);
  // 앞섶 단추 (블라우스 가운데)
  for (let i = 0; i < 3; i++) { const p = loftAt(chP, 0.5, 0.42 + i * 0.16, new V3(), chMod); add(J.chest, C('btn', () => new THREE.SphereGeometry(0.0055, 10, 8)), M.pearl, [p.x, p.y, p.z + 0.002]); }

  /* ---------- 케이프렛 (금테) · 레이스 칼라 · 브로치 ---------- */
  const cpP = (v) => ({ y: 0.262 - 0.17 * v ** 0.9, rx: 0.07 + 0.19 * v ** 0.7, rzF: 0.072 + 0.08 * v ** 0.8, rzB: 0.068 + 0.1 * v ** 0.8, n: 2.15 });
  const cpMod = (p, u, v) => { const fr = Math.sin(u * TAU * 9) * 0.006 * v * v; const n = new V3(p.x, 0, p.z).normalize(); p.addScaledVector(n, fr + 0.004); };
  const cpA0 = 0.535, cpA1 = 1.465;
  add(J.chest, C('capelet', () => loft(cpP, 72, 10, { a0: cpA0, a1: cpA1, mod: cpMod, uvU: 2 })), M.blue);
  add(J.chest, C('capeletIn', () => loft((v) => { const s = cpP(v); return { ...s, rx: s.rx - 0.004, rzF: s.rzF - 0.004, rzB: s.rzB - 0.004 }; }, 56, 8, { a0: cpA0, a1: cpA1, mod: cpMod })), M.white);
  lRim(J.chest, 'cpHem', cpP, 1, 0.0045, M.gold, { a0: cpA0, a1: cpA1, mod: cpMod, n: 96 });
  for (const a of [cpA0, cpA1]) { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(cpP, a, i / 10, new V3(), cpMod)); rim(J.chest, 'cpEdge' + a, pts, 0.004, false); }
  // 케이프렛 위 금 별 장식
  for (const [a, v] of [[0.32, 0.7], [0.68, 0.7], [0.12, 0.6], [0.88, 0.6], [0, 0.66]]) { const p = loftAt(cpP, a, v, new V3(), cpMod), n = new V3(p.x, 0.6, p.z).normalize(); const o = add(J.chest, C('cpStar', () => new THREE.ExtrudeGeometry(starShape(0.016, 0.007), { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 1 })), M.gold, [p.x + n.x * 0.003, p.y + n.y * 0.003, p.z + n.z * 0.003]); o.lookAt(o.position.clone().add(n)); }
  // 레이스 칼라: 목둘레 프릴 (물결)
  const colF = (u, v, p) => { const a = u * TAU, R = 0.044 + 0.036 * v, h = 0.29 + 0.026 * v - 0.014 * v * v, wv = Math.sin(u * TAU * 14) * 0.006 * v; p.set(Math.sin(a) * (R + wv), h + 0.004 * Math.sin(u * TAU * 16 + 1) * v, Math.cos(a) * (R + wv) * 0.96); };
  add(J.chest, C('collar', () => surf(colF, 128, 4, { closedU: true })), M.white);
  add(J.chest, C('collarL', () => surf((u, v, p) => { colF(u, v, p); p.y -= 0.012; p.x *= 1.08; p.z *= 1.08; }, 128, 4, { closedU: true })), M.lace);
  { const g = new THREE.Group(); g.position.set(0, 0.268, 0.062); g.rotation.x = -0.25; J.chest.add(g);
    add(g, C('brooch', () => new THREE.TorusGeometry(0.016, 0.004, 8, 24)), M.gold, [0, 0, 0], [0, 0, 0], [1, 1.2, 1]);
    add(g, C('broochGem', () => new THREE.SphereGeometry(0.012, 16, 12)), M.gem, [0, 0, 0.004], [0, 0, 0], [1, 1.2, 0.7]);
    for (const s of [-1, 1]) add(g, C('brBow' + s, () => strand([[0, 0, 0], [s * 0.03, 0.012, -0.004], [s * 0.034, -0.01, -0.004], [0, 0, 0]], 0.005, 0.005, { closed: true, seg: 18, rad: 6, flat: 0.4, ref: [0, 0, 1] })), M.blue, [0, 0, -0.004]);
    add(g, C('brDrop', () => new THREE.SphereGeometry(0.006, 10, 8)), M.pearl, [0, -0.028, 0]); }

  /* ---------- 팔: 맨팔 + 레이스 퍼프 소매 + 레이스 앞팔 + 파란 커프스 + 손 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.044 - 0.01 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.042 - 0.009 * v }), 24, 10)), M.skin);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - (DIMS.lArm + 0.0) * v, rx: 0.036 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.034 - 0.01 * v }), 24, 10)), M.skin);
    // 퍼프: 어깨에서 부풀었다가 팔꿈치 위에서 오므라듦 (주름)
    const pfP = (v) => { const b = Math.sin(Math.PI * Math.min(1, v * 1.08) ** 0.8); return { y: 0.045 - 0.19 * v, rx: 0.05 + 0.034 * b, rz: 0.048 + 0.032 * b }; };
    const pfMod = (p, u, v) => { const k = 1 + 0.045 * Math.sin(u * TAU * 9) * Math.sin(Math.PI * v); p.x *= k; p.z *= k; };
    add(sh, C('puffW', () => loft((v) => { const q = pfP(v); return { ...q, rx: q.rx * 0.82, rz: q.rz * 0.82 }; }, 32, 10, { mod: pfMod })), M.lace);
    add(sh, C('puff', () => loft(pfP, 48, 14, { mod: pfMod, uvU: 2 })), M.lace);
    const bandP = (v) => ({ y: -0.14 - 0.018 * v, rx: 0.05, rz: 0.048 });
    add(sh, C('puffBand', () => loft(bandP, 28, 2)), M.blue); lRim(sh, 'pbR', bandP, 0, 0.0028, M.gold);
    // 비치는 앞팔 소매 (팔꿈치 → 손목, 점점 넓어짐)
    add(el, C('farmLace', () => loft((v) => ({ y: 0.02 - (DIMS.lArm - 0.06) * v, rx: 0.04 + 0.006 * v, rz: 0.038 + 0.006 * v }), 28, 8, { uvU: 2 })), M.sheer);
    // 파란 커프스: 손목에서 나팔처럼 벌어져 손등을 덮는다 (손등 쪽이 길게)
    const cfP = (v) => ({ y: -DIMS.lArm + 0.06 - 0.095 * v, rx: 0.04 + 0.02 * v ** 1.4, rz: 0.039 + 0.017 * v ** 1.4 });
    const cfMod = (p, u, v, c) => { p.y += 0.025 * v * (1 - Math.max(0, s * c)); }; // 손바닥 안쪽(몸 쪽)은 짧게
    add(el, C('cuff' + s, () => loft(cfP, 40, 8, { mod: cfMod })), M.blue);
    lRim(el, 'cuffHem' + s, cfP, 1, 0.005, M.white, { mod: cfMod });
    lRim(el, 'cuffTop', cfP, 0, 0.0035, M.gold);
    { const p = loftAt(cfP, s > 0 ? 0.25 : 0.75, 0.35, new V3(), cfMod); add(el, C('cuffBtn', () => new THREE.SphereGeometry(0.006, 10, 8)), M.gold, [p.x * 1.06, p.y, p.z]); }
    // 손 (조금 작게)
    const hg = new THREE.Group(); hg.scale.setScalar(0.84); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.02 + 0.003 * Math.sin(v * Math.PI), rz: 0.033 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.skin);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [];
      const curl = s > 0 ? 1.35 + k * 0.12 : 2.6; for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0078, 0.0062, { seg: 14, rad: 8 })), M.skin);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0094, 0.007, { seg: 12, rad: 8 })), M.skin);
  }

  /* ---------- 다리: 비치는 검은 스타킹 · 금색 하이힐 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.088], [0.4, 0.078], [0.85, 0.056], [1, 0.054]]), thF = spl([[0, 0.084], [0.5, 0.07], [1, 0.054]]), thB = spl([[0, 0.086], [0.35, 0.076], [1, 0.049]]);
    add(hp, C('thigh', () => loft((v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) }), 28, 12)), M.tights);
    const cX = spl([[0, 0.052], [0.3, 0.056], [0.75, 0.036], [1, 0.03]]), cF = spl([[0, 0.05], [0.5, 0.042], [1, 0.03]]), cB = spl([[0, 0.052], [0.3, 0.07], [0.7, 0.042], [1, 0.032]]);
    add(kn, C('shin', () => loft((v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) }), 28, 14)), M.tights);
    add(kn, C('ankle', () => loft((v) => ({ y: -DIMS.shin + 0.03 - 0.05 * v, rx: 0.03 + 0.004 * v, rz: 0.032 + 0.006 * v }), 16, 4)), M.tights);
    // 발: 뒤꿈치가 들린 하이힐 자세 (뒤꿈치 -0.02 · 앞꿈치 -0.07)
    const fw = spl([[0, 0.0], [0.06, 0.026], [0.25, 0.033], [0.6, 0.038], [0.85, 0.03], [1, 0.006]]), fh = spl([[0, 0.025], [0.08, 0.055], [0.3, 0.058], [0.6, 0.034], [0.85, 0.024], [1, 0.012]]);
    const fb = (v) => -0.072 + 0.052 * (1 - smooth(0.3, 0.72, v));
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb(v) + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.055 + 0.23 * v); };
    add(ft, C('foot', () => surf(foot, 28, 20, { closedU: true })), M.tights);
    // 펌프스: 발 아래쪽 + 앞코만 감싼다 (발등은 스타킹이 보임)
    const shoe = (u, v, p) => { const hw = 0.28 + 0.22 * smooth(0.62, 0.86, v), uu = -hw + 2 * hw * u; foot(uu, v, p); p.x *= 1.07; p.y = fb(v) + (p.y - fb(v)) * 1.04 - 0.002; p.z = -0.058 + (p.z + 0.055) * 1.03; };
    add(ft, C('shoe', () => surf(shoe, 32, 22)), M.gold);
    add(ft, C('shoeRim', () => { const pts = []; for (let i = 0; i <= 40; i++) { const v = i / 40, p = new V3(); shoe(0, v, p); pts.push(p); } for (let i = 40; i >= 0; i--) { const v = i / 40, p = new V3(); shoe(1, v, p); pts.push(p); } return strand(pts, 0.0028, 0.0028, { seg: 120, rad: 5, closed: true }); }), M.goldD);
    add(ft, C('heel', () => { const g = new THREE.CylinderGeometry(0.011, 0.007, 0.052, 12); g.translate(0, -0.046, -0.042); return g; }), M.gold);
    add(ft, C('heelTip', () => { const g = new THREE.CylinderGeometry(0.0072, 0.0072, 0.006, 12); g.translate(0, -0.073, -0.042); return g; }), M.black);
    add(ft, C('strap', () => new THREE.TorusGeometry(0.036, 0.0032, 6, 28)), M.gold, [0, 0.0, -0.004], [Math.PI / 2 - 0.2, 0, 0], [0.95, 1.1, 1]);
    add(ft, C('shoeGem', () => new THREE.SphereGeometry(0.0065, 12, 10)), M.gem, [0, -0.034, 0.12], [0, 0, 0], [1, 0.8, 1]);
  }

  /* ---------- 연미 자락 (천 물리) ---------- */
  let cloth = null;
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    cloth = new Cloth(scene, 9, 16, 0.76, M.coat); extras.push(cloth.mesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
    scene.add(m.staffHalo);
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; if (cloth) { cloth.mesh.geometry.dispose(); cloth = null; } scene.remove(m.staffHalo); m._attached = false; };
  m.resetCloth = () => { if (cloth) cloth.ok = false; for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 목 · 얼굴 · 머리카락 · 마녀 모자 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.034, rzF: 0.034, rzB: 0.032 }), 20, 4)), M.skin);
  const H = J.head;
  m.headMesh = add(H, C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 88, 66, { closedU: true, poles: [0, 66] })), M.face);
  H.scale.setScalar(1.12); // 애니메 비율: 머리를 조금 크게
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.1, -0.006], [s * 0.08, 0.104, -0.014], [s * 0.084, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.12 + 0.36 * w * w : 0.12 - 0.9 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hair);
    const r = rng(23), clump = (key, pts, r0, r1, flat = 0.4, ref) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref: ref || [0, 0, 1] })), M.hairS);
    // 앞머리: 왼쪽(+x) 가르마에서 오른쪽으로 쓸어 넘긴 결
    for (let k = 0; k < 11; k++) {
      const t = k / 10, az = 0.95 - t * 1.9, side = Math.abs(az), tipEl = 0.2 - 0.05 * Math.sin(t * 9) - 0.32 * smooth(0.55, 1.0, side) + (r() - 0.5) * 0.04, sweep = -0.16 - 0.1 * t;
      const pts = [headAt(0.3 + az * 0.3, 1.18, 0.02), headAt(az * 0.75 + sweep * 0.3, 0.8, 0.03), headAt(az * 0.95 + sweep * 0.7, 0.5, 0.03), headAt(az + sweep, (0.5 + tipEl) / 2, 0.026), headAt(az + sweep * 1.2, tipEl, 0.014)];
      const d = dirOf(az, 0.5); clump('bang' + k, pts, 0.048 + r() * 0.01, 0.004, 0.2, [d.x, d.y, d.z]);
    }
    // 얼굴 옆 머리 (귀 앞, 턱까지 · 바깥으로 살짝 말림)
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const az = s * (1.0 + k * 0.14), pts = [headAt(az * 0.9, 0.7, 0.018), headAt(az, 0.15, 0.016), headAt(az * 1.02, -0.45 - k * 0.1, 0.014), headAt(az * 1.06, -0.85 - k * 0.08, 0.02)];
      const d = dirOf(az, 0); clump(`side${s}${k}`, pts, 0.032, 0.005, 0.22, [d.x, 0, d.z]);
    }
    // 뒷머리 위쪽 덩어리 (모자 아래 볼륨)
    for (let k = 0; k < 16; k++) {
      const az = Math.PI + (k - 7.5) * 0.24, pts = [headAt(az, 0.75, 0.016), headAt(az + (r() - 0.5) * 0.15, 0.0, 0.02), headAt(az + (r() - 0.5) * 0.2, -0.6, 0.016)];
      const d = dirOf(az, 0); clump('back' + k, pts, 0.04, 0.02, 0.26, [d.x, 0, d.z]);
    }
    // 긴 웨이브 머리: 뒤 7가닥 + 앞으로 내린 2가닥 (로프 물리 · 납작한 리본 관 · 옆으로 물결)
    const locks = [...[-1.15, -0.92, -0.69, -0.46, -0.23, 0, 0.23, 0.46, 0.69, 0.92, 1.15].map((d) => [Math.PI + d, -0.52 + 0.14 * Math.abs(d), 11 - Math.round(Math.abs(d) * 1.5)]), [1.3, -0.55, 8], [-1.3, -0.55, 8]];
    locks.forEach(([az, el, n], i) => {
      const front = i >= 11, rope = new Rope(n, 0.062, { damp: 0.978, stiff: 0.05 }), ph = i * 1.7, wide = front ? 0.034 : 0.05;
      const view = new RopeTube(rope, M.hairS, { sub: 3, rad: 12, uvV: 2, flat: 0.28, side: new V3(1, 0, 0),
        prof: (v) => wide * (v < 0.05 ? 0.8 : 1 - 0.45 * v) * (v > 0.88 ? 1 - (v - 0.88) * 6 : 1),
        wave: (v) => 0.018 * Math.sin(v * TAU * 1.4 + ph) * smooth(0.1, 0.5, v) });
      const local = headAt(az, el, 0.02), sideL = new V3(Math.cos(az), 0, -Math.sin(az)), rest = front ? new V3(Math.sin(az) * 0.3, -1, 0.35).normalize() : new V3(Math.sin(az) * 0.35, -0.75, -0.6).normalize();
      m.ropes.push({ rope, view, joint: H, local, rest, sideL, caps: 'body' });
    });
    // 아호게
    clump('ahoge', [headAt(-0.3, 1.25, 0.012), new V3(-0.01, 0.25, 0.02), new V3(-0.035, 0.262, 0.06), new V3(-0.05, 0.245, 0.075)], 0.008, 0.0015, 0.4, [1, 0, 0]);
  }
  // 마녀 모자: 넓은 물결 챙(안쪽 검정) · 뒤로 휘며 끝이 꺾인 원뿔 · 갈색 리본 띠 + 리본 · 금 별 문장 + 아쿠아마린
  {
    const hat = new THREE.Group(); hat.position.set(0, 0.168, -0.012); hat.rotation.set(-0.16, 0, 0.06); hat.scale.setScalar(0.9); H.add(hat); m.hat = hat;
    const r0 = 0.096, r1 = 0.245;
    const brim = (dy) => (u, v, p) => { const a = u * TAU, R = r0 + (r1 - r0) * v, t = v, wav = Math.sin(a * 5 + 0.6) * 0.012 * t * t; p.set(Math.sin(a) * R, -0.03 * t ** 1.5 + wav * 0.6 + 0.02 * Math.cos(a) * t * t - 0.012 * Math.sin(a) ** 2 * t * t + dy, Math.cos(a) * R * 1.02); }; // 앞은 살짝 들리고 옆은 부드럽게 처짐
    add(hat, C('brimT', () => surf(brim(0.0035), 96, 10, { closedU: true })), M.hat);
    add(hat, C('brimB', () => surf(brim(-0.0035), 96, 10, { closedU: true, flip: true })), M.hatIn);
    { const pts = []; for (let i = 0; i < 160; i++) { const p = new V3(); brim(0)(i / 160, 1, p); pts.push(p); } rim(hat, 'brimEdge', pts, 0.0055, true, M.hatIn); }
    // 원뿔: 중심선을 따라 링을 놓는다 (뒤로 휘고 끝은 아래로 꺾임) + 잔주름
    const cen = (t, o = new V3()) => o.set(0.015 * t * t, 0.27 * t - 0.05 * smooth(0.6, 1, t) * t, -0.03 * t - 0.12 * t ** 2.5 - 0.06 * smooth(0.7, 1, t));
    const crR = (t) => 0.098 * (1 - t) ** 1.05 * (1 + 0.08 * Math.sin(t * Math.PI)) + 0.005;
    const crown = (dr) => (u, v, p) => { const t = v, c = cen(t), c2 = cen(Math.min(1, t + 0.01)), c1 = cen(Math.max(0, t - 0.01)), T2 = c2.sub(c1).normalize(), X = new V3(1, 0, 0), Z = new V3().crossVectors(X, T2).normalize(), Xn = new V3().crossVectors(T2, Z).normalize(), a = u * TAU, fold = 1 + 0.05 * Math.sin(a * 4 + t * 7) * smooth(0.15, 0.8, t);
      const R = (crR(t) + dr) * fold; p.copy(c).addScaledVector(Xn, Math.sin(a) * R).addScaledVector(Z, Math.cos(a) * R); };
    add(hat, C('crown', () => surf(crown(0), 48, 30, { closedU: true, poles: [30] })), M.hat);
    // 리본 띠 + 옆 리본
    add(hat, C('band', () => surf((u, v, p) => crown(0.004)(u, 0.02 + 0.13 * v, p), 64, 4, { closedU: true })), M.ribbon);
    { const p = new V3(); crown(0.006)(0.25, 0.09, p);
      const bow = new THREE.Group(); bow.position.copy(p); bow.rotation.set(0, Math.PI / 2, 0.15); hat.add(bow);
      for (const s of [-1, 1]) add(bow, C('hbow' + s, () => strand([[0, 0, 0], [s * 0.05, 0.03, -0.006], [s * 0.07, 0.0, -0.01], [s * 0.05, -0.025, -0.006], [0, 0, 0]], 0.008, 0.008, { closed: true, seg: 24, rad: 8, flat: 0.32, ref: [0, 0, 1] })), M.ribbon);
      for (const s of [-1, 1]) add(bow, C('htail' + s, () => strand([[0, 0, 0], [s * 0.02, -0.04, 0.004], [s * 0.012, -0.09, 0.01], [s * 0.03, -0.13, 0.006]], 0.012, 0.009, { seg: 14, rad: 8, flat: 0.25, ref: [0, 0, 1] })), M.ribbon);
      add(bow, C('hknot', () => new THREE.SphereGeometry(0.013, 14, 10)), M.ribbon, [0, 0, 0.002], [0, 0, 0], [1, 1.1, 0.7]); }
    // 금 별 문장 + 아쿠아마린 (앞)
    { const p = new V3(); crown(0.008)(0.5, 0.11, p); const g = new THREE.Group(); g.position.copy(p); g.rotation.x = -0.25; hat.add(g);
      add(g, C('hStar', () => new THREE.ExtrudeGeometry(starShape(0.04, 0.017), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 })), M.gold);
      add(g, C('hRing', () => new THREE.TorusGeometry(0.02, 0.0035, 8, 28)), M.goldD, [0, 0, 0.007]);
      add(g, C('hGem', () => new THREE.IcosahedronGeometry(0.016, 1)), M.gem, [0, 0, 0.01], [0, 0, 0], [1, 1.15, 0.6]);
      for (const s of [-1, 1]) add(g, C('hWing' + s, () => strand([[s * 0.04, 0.004, 0], [s * 0.07, 0.02, -0.004], [s * 0.09, 0.006, -0.008], [s * 0.08, -0.008, -0.006]], 0.004, 0.0015, { seg: 12, rad: 5 })), M.gold); }
    // 모자 위 작은 별 두 개
    for (const [u, v] of [[0.42, 0.42], [0.6, 0.62]]) { const p = new V3(); crown(0.002)(u, v, p); const o = add(hat, C('hStarS', () => new THREE.ExtrudeGeometry(starShape(0.014, 0.006), { depth: 0.002, bevelEnabled: false })), M.gold, [p.x, p.y, p.z]); o.rotation.set(-0.5, 0, 0); }
  }

  /* ---------- 무기: 금빛 지팡이 + 아쿠아마린 ---------- */
  const SS = 0.85, staff = new THREE.Group(); staff.scale.setScalar(SS); J.weapon.add(staff); m.glaive = staff; m.staff = staff;
  {
    const X = [Math.PI / 2, 0, 0];
    add(staff, C('st:shaft', () => new THREE.CylinderGeometry(0.0125, 0.011, ST.top - ST.butt, 16, 1, true)), M.gold, [0, 0, (ST.top + ST.butt) / 2], X);
    add(staff, C('st:spiral', () => { const pts = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * TAU * 11; pts.push(new V3(Math.cos(a) * 0.0135, Math.sin(a) * 0.0135, ST.butt + 0.12 + (ST.top - ST.butt - 0.25) * t)); } return strand(pts, 0.0026, 0.0026, { seg: 260, rad: 5 }); }), M.blue);
    add(staff, C('st:grip', () => new THREE.CylinderGeometry(0.0155, 0.0155, 0.16, 16)), M.blue, [0, 0, 0], X);
    const band = C('st:band', () => lathe([[0.013, -0.012], [0.02, -0.008], [0.022, 0], [0.02, 0.008], [0.013, 0.012]], 24));
    for (const z of [-0.09, 0.09, -0.48, 0.36, ST.top - 0.02]) add(staff, band, M.gold, [0, 0, z], X);
    // 밑동: 물방울 장식
    add(staff, C('st:butt', () => lathe([[0.012, 0.03], [0.02, 0.01], [0.016, -0.02], [0.006, -0.05], [0, -0.06]], 20)), M.gold, [0, 0, ST.butt + 0.03], [-Math.PI / 2, 0, 0]);
    add(staff, C('st:buttGem', () => new THREE.IcosahedronGeometry(0.013, 1)), M.gem, [0, 0, ST.butt + 0.055]);
    // 머리: 받침 → 양옆 말린 금 덩굴 + 날개 잎 → 큰 아쿠아마린 → 초승달 고리 + 별
    add(staff, C('st:cup', () => lathe([[0.012, -0.03], [0.024, -0.005], [0.034, 0.02], [0.03, 0.04], [0.02, 0.05]], 24)), M.gold, [0, 0, ST.top + 0.02], X);
    for (const s of [-1, 1]) {
      const pts = [[0, 0, ST.top + 0.03], [s * 0.05, 0, ST.top + 0.05], [s * 0.085, 0, ST.gem - 0.02], [s * 0.09, 0, ST.gem + 0.05], [s * 0.065, 0, ST.gem + 0.1], [s * 0.03, 0, ST.gem + 0.115], [s * 0.012, 0, ST.gem + 0.1], [s * 0.022, 0, ST.gem + 0.085]];
      add(staff, C('st:curl' + s, () => strand(pts, 0.007, 0.004, { seg: 48, rad: 7 })), M.gold);
      const out = [[s * 0.06, 0, ST.top + 0.05], [s * 0.12, 0, ST.top + 0.06], [s * 0.15, 0, ST.top + 0.11], [s * 0.13, 0, ST.top + 0.14], [s * 0.11, 0, ST.top + 0.12], [s * 0.118, 0, ST.top + 0.1]];
      add(staff, C('st:curlO' + s, () => strand(out, 0.005, 0.003, { seg: 36, rad: 6 })), M.gold);
      add(staff, C('st:leaf' + s, () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.03, 0.02, 0.07, 0.0); sh.quadraticCurveTo(0.03, -0.012, 0, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 10 }); g.rotateX(Math.PI / 2); g.translate(0, 0, 0); return g; }), M.gold, [s * 0.03, 0, ST.top + 0.035], [0, s > 0 ? -0.5 : Math.PI + 0.5, 0]);
      add(staff, C('st:pearl', () => new THREE.SphereGeometry(0.008, 12, 10)), M.pearl, [s * 0.15, 0, ST.top + 0.11]);
    }
    add(staff, C('st:gem', () => { const g = new THREE.OctahedronGeometry(0.05, 1); g.scale(0.9, 0.7, 1.45); return g; }), M.gem, [0, 0, ST.gem]);
    add(staff, C('st:gemRing', () => new THREE.TorusGeometry(0.06, 0.004, 8, 40)), M.goldD, [0, 0, ST.gem], [0, Math.PI / 2, 0], [1, 1.35, 1]);
    add(staff, C('st:crescent', () => { const sh = new THREE.Shape(); sh.absarc(0, 0, 0.04, -0.3, Math.PI + 0.3, false); sh.absarc(0, 0.012, 0.03, Math.PI + 0.25, -0.25, true); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 18 }); g.translate(0, 0, -0.0025); g.rotateX(-Math.PI / 2); return g; }), M.gold, [0, 0, ST.crown - 0.06], [0, Math.PI / 2, Math.PI]);
    const top = add(staff, C('st:topStar', () => { const g = new THREE.ExtrudeGeometry(starShape(0.024, 0.01), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 }); g.translate(0, 0, -0.002); return g; }), M.gold, [0, 0, ST.crown], [Math.PI / 2, 0, 0]);
    top.rotation.set(0, Math.PI / 2, 0);
    // 보석 빛무리 (씬에 직접 붙어 항상 카메라를 향함)
    m.staffHalo = new THREE.Mesh(C('st:halo', () => new THREE.SphereGeometry(0.11, 16, 12)), M.halo); m.staffHalo.renderOrder = 10; m.staffHalo.frustumCulled = false;
  }

  /* ---------- 매 프레임 ---------- */
  const lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 }, tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion();
  m.glow = 0;
  m.update = (dt, f) => {
    // 치마 · 페티코트: 다리 각도를 스프링으로 따라 출렁임
    const k = 1 - Math.exp(-dt * 16), tgL = J.hipL.rotation.x, tgR = J.hipR.rotation.x;
    lag.vL += ((tgL - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((tgR - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * k;
    const spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.4, 1.4)), zR = -Math.sin(clamp(lag.R, -1.4, 1.4));
    for (const me of m.skirt) {
      const base = me.userData.base, pa = me.geometry.attributes.position, arr = pa.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, -y), wL = clamp(0.5 + x / 0.14, 0, 1), wR = 1 - wL;
        const dz = (wL * zL + wR * zR) * depth * 0.95, out = 1 + (spread * 0.3 + lag.sw * 0.15) * (depth / 0.48);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.3; arr[i + 2] = z * out + dz - lag.sw * 0.12 * depth;
      }
      pa.needsUpdate = true; me.geometry.computeVertexNormals();
    }
    J.chest.updateMatrixWorld(true);
    // 연미 자락: 허리 뒤 반 바퀴에 고정, 몸·다리·치마(구 두 개)와 충돌
    if (cloth) {
      cloth.mesh.visible = f.root.visible; const W = cloth.W;
      for (let i = 0; i < W; i++) { const a = 0.2 - 0.4 * (i / (W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0.6, cloth.anchors[i]).multiplyScalar(1.07)); }
      const hp = J.hips.getWorldPosition(new V3()), sc = f.scale;
      const caps = f.hurt.filter((_, i) => i === 0 || i >= 6).map((c, i) => ({ a: c.a, b: c.b, r: c.r + (i === 0 ? 0.04 : 0.05) * sc }));
      const s1 = hp.clone().add(new V3(0, -0.14 * sc, 0)), s2 = hp.clone().add(new V3(0, -0.3 * sc, 0));
      caps.push({ a: s1, b: s1, r: 0.2 * sc }, { a: s2, b: s2, r: 0.33 * sc + lag.sw * 0.04 });
      const wv = (v) => clamp(-v * 1.1, -9, 9), w = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 1.0, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 1.0];
      cloth.len = 0.76 * sc; cloth.step(dt, caps, f.pos.y + 0.02, w);
    }
    // 머리카락 로프
    // 피격 캡슐을 그대로 쓰면 몸통 캡슐 윗부분이 뒷머리 고정점을 삼켜 머리칼이 위로 튄다 → 몸통은 어깨 높이까지만, 머리는 구 하나
    const h0 = f.hurt[0], hc = H.localToWorld(tmp2.copy(HC)), capsBody = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.62 + 0.04 * f.scale }, { a: hc, b: hc, r: 0.104 * f.scale }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.02 * f.scale }))];
    const wind = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6); H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) {
      r.joint.localToWorld(tmp.copy(r.local)); r.view.side.copy(r.sideL).applyQuaternion(hq);
      r.rope.step(dt, tmp, capsBody, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = f.root.visible;
    }
    // 얼굴: 주문을 외칠 때 입을 벌리고, 승리 · 휴식 자세에서는 윙크
    const cast = f.state === 'act' && f.act && f.act.shout;
    m.headMesh.material = cast ? M.faceO : (f.state === 'win' || (f.idleT || 0) > 4) ? M.faceW : M.face;
    // 보석 발광: 마법을 쓸 때(f.gemK) + 만조 상태
    const want = Math.max(f.gemK || 0, f.tideT > 0 ? 0.7 : 0);
    m.glow += (want - m.glow) * Math.min(1, dt * 10);
    const pulse = 0.85 + 0.15 * Math.sin(f.G.time * 5);
    M.gem.emissiveIntensity = (0.6 + m.glow * 2.4) * pulse;
    J.weapon.updateMatrixWorld(true); J.weapon.localToWorld(m.staffHalo.position.set(0, 0, ST.gem * SS));
    m.staffHalo.scale.setScalar(f.scale * SS * (0.8 + m.glow * 1.1) * (0.95 + 0.05 * Math.sin(f.G.time * 9)));
    M.halo.opacity = 0.12 + m.glow * 0.45; m.staffHalo.visible = f.root.visible && staff.visible;
    if (f.root.visible && m.glow > 0.3 && Math.random() < m.glow * 0.8) { const p = m.staffHalo.position; f.G.fx.p(p.clone().add(new V3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2)), { vel: [(Math.random() - 0.5) * 0.6, 0.6 + Math.random(), (Math.random() - 0.5) * 0.6], size: 0.06 + Math.random() * 0.06, size1: 0.01, life: 0.5, color: Math.random() < 0.5 ? AQUA : FOAM, alpha: 0.9, drag: 1.5 }); }
    for (const o of extras) o.visible = f.root.visible;
  };
  m.setWeapon = (v) => { staff.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.072;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.1)); J.weapon.localToWorld(t.set(0, 0, ST.crown * SS)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, (ST.gem - 0.12) * SS)); J.weapon.localToWorld(t.set(0, 0, ST.crown * SS)); };
  m.gemPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, ST.gem * SS)); };
  m.extras = extras;
  return m;
}
