// 클라운 (CLOWN · 차원의 광대) — 3D 모델 (기술·포즈는 clown.js)
// 차원의 틈을 넘나드는 적 진영의 광대 소녀.
//
// 구성: 기울여 쓴 큰 진홍 실크해트(검은 띠 · 금 테 · 다이아 문장 · 꽂힌 화살 · 트럼프 카드) · 검정 + 크림 투톤 긴 생머리(히메컷 · 로프 물리)
//       광대 화장(눈을 지나는 검은 세로 표식 · 눈 밑 다이아) · 붉은 눈 · 검은 레이스 초커 + 큰 검은 나비 넥타이
//       어깨를 드러낸 진홍 상의(금테 · 금 다이아 문장) · 부푼 진홍 퍼프 소매 · 검은 코르셋(흰 끈) · 떨어진 진홍 소매 + 흰 프릴 커프스
//       금테 · 다이아 무늬 진홍 치마 + 검은 프릴 페티코트 두 단(다리를 따라 출렁임) · 양옆 긴 진홍 꼬리 자락(천 물리 · 끝에 녹색 보석 장식)
//       할리퀸 다이아(검정/크림) 니삭스 · 붉은 가터 · 정강이를 감은 붉은 리본 · 다이아 버클 검은 플랫폼 하이힐
//       무기: 긴 검은 장대 낫 — 줄무늬 자루 · 금 고리 · 녹색 보석 · 머리의 큰 진홍 초승달 날 + 반대편 작은 날 + 창끝 · 뒤끝 작은 초승달
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth, Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.86, spineL: 0.18, chestL: 0.25, neckL: 0.068, shW: 0.175, uArm: 0.265, lArm: 0.24, hipW: 0.086, thigh: 0.41, shin: 0.4, headTop: 0.27 };
// 장대 낫 치수 (오른손 기준 +Z, m) — grip2 = 왼손이 잡는 자리
export const SC = { butt: -0.8, top: 1.2, grip2: 0.46, bladeL: 0.74 };
export const CRIM = 0xff1f4a, MAG = 0xff3ab8, BLOOD = 0xb0001c, GOLDC = 0xffd27a, VOID = 0x2a0618, JADEC = 0x3aff8a;
const C = (k, fn) => cached('clown:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function dia(g, x, y, w, h) { g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w, y); g.lineTo(x, y + h); g.lineTo(x - w, y); g.closePath(); }
export function diaShape(w, h) { const s = new THREE.Shape(); s.moveTo(0, h); s.lineTo(w, 0); s.lineTo(0, -h); s.lineTo(-w, 0); s.closePath(); return s; }

// 머리카락: 검정(푸른 윤기) / 크림 금발 — strand uv v: 뿌리 0 → 끝 1
function hairTex(tone, ring) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(tone === 'b' ? 17 : 29), cream = tone === 'c';
  g.fillStyle = cream ? '#eadcb0' : '#18161e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { const x = r() * W, k = r(); g.strokeStyle = cream ? (k < 0.4 ? '#bba272' : k > 0.82 ? '#fff6dc' : '#dccb98') : (k < 0.45 ? '#08070c' : k > 0.85 ? '#5a5a72' : '#26242e'); g.globalAlpha = 0.3 + r() * 0.45; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, H); g.bezierCurveTo(x + (r() - 0.5) * 24, H * 0.66, x + (r() - 0.5) * 24, H * 0.33, x + (r() - 0.5) * 10, 0); g.stroke(); }
  if (ring) { g.globalAlpha = cream ? 0.45 : 0.32; g.fillStyle = cream ? '#fffbea' : '#8a8aa8'; const y0 = H * 0.3; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - 8 - r() * 20); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + 6 + r() * 14); g.closePath(); g.fill(); }
  g.globalAlpha = 1; return tex(c);
}
// 실크해트 몸통: 진홍 · 검정 세로 판 + 금 선 + 앞 다이아 문장 (lathe uv: u = 둘레(0 = 앞), v = 아래 → 위)
function hatTex(main, dark) {
  const W = 1024, H = 256, [c, g] = cv(W, H), n = 10;
  for (let i = 0; i < n; i++) { const x0 = (i / n) * W, x1 = ((i + 1) / n) * W; g.fillStyle = i % 2 ? '#141218' : main; g.fillRect(x0, 0, x1 - x0, H);
    const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0, H);
    g.fillStyle = '#d8b060'; g.fillRect(x0 - 2, 0, 4, H); }
  const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, dark); g.globalAlpha = 0.35; g.fillStyle = vg; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  // 앞 문장 (u = 0 → 캔버스 양끝)
  for (const x of [0, W]) { g.fillStyle = '#d8b060'; dia(g, x, H * 0.5, 34, 58); g.fill(); g.fillStyle = main; dia(g, x, H * 0.5, 24, 44); g.fill(); g.strokeStyle = '#d8b060'; g.lineWidth = 3; dia(g, x, H * 0.5, 14, 26); g.stroke(); }
  for (const u of [0.25, 0.75]) { g.fillStyle = '#d8b060'; dia(g, u * W, H * 0.62, 16, 26); g.fill(); g.fillStyle = '#141218'; dia(g, u * W, H * 0.62, 9, 16); g.fill(); }
  g.fillStyle = '#d8b060'; g.fillRect(0, 0, W, 6); return tex(c);
}
// 진홍 천: 결 + 은은한 광택
function clothTex(main) { const W = 256, [c, g] = cv(W, W), r = rng(5); g.fillStyle = main; g.fillRect(0, 0, W, W); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.05})`; g.fillRect(r() * W, r() * W, 2, 1); } return tex(c, [2, 2]); }
// 상의(가슴 loft): 아래 = 검은 코르셋, 가운데 = 진홍 튜브톱(하트 모양 윗선), 위 = 살 (loft uv: u 0.5 = 앞, v 0 = 아래)
export const bustTop = (u) => 0.6 + 0.05 * gauss(Math.abs(u - 0.5) - 0.075, 0.045) - 0.05 * gauss(u - 0.5, 0.022);
function topTex(main) {
  const W = 1024, H = 512, [c, g] = cv(W, H), Y = (v) => (1 - v) * H;
  g.fillStyle = '#f8e4dc'; g.fillRect(0, 0, W, H);
  // 진홍 띠
  g.beginPath(); g.moveTo(0, Y(0.3)); for (let x = 0; x <= W; x += 4) g.lineTo(x, Y(bustTop(x / W))); g.lineTo(W, Y(0.3)); g.closePath(); g.fillStyle = main; g.fill();
  const sh = g.createLinearGradient(0, Y(0.66), 0, Y(0.3)); sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = sh; g.fill();
  // 검은 코르셋 (세로 봉제선)
  g.fillStyle = '#141218'; g.fillRect(0, Y(0.3), W, H); for (let i = 0; i < 16; i++) { const x = (i / 16) * W; g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, Y(0.3), 3, H); }
  g.fillStyle = '#d8b060'; g.fillRect(0, Y(0.3) - 3, W, 5);
  return tex(c);
}
// 코르셋(배): 검은 새틴 + 세로 봉제선 + 위아래 박음질
function corsetTex() {
  const W = 512, H = 256, [c, g] = cv(W, H), r = rng(12); g.fillStyle = '#16141a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.03})`; g.fillRect(r() * W, r() * H, 2, 2); }
  for (let i = 0; i < 14; i++) { const x = (i / 14) * W; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, 0, 3, H); g.fillStyle = 'rgba(200,190,220,0.14)'; g.fillRect(x + 4, 0, 3, H); }
  g.strokeStyle = 'rgba(200,60,80,0.7)'; g.setLineDash([7, 6]); g.lineWidth = 2; for (const y of [10, H - 10]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.setLineDash([]);
  return tex(c);
}
// 치마: 진홍 바탕 · 주름 음영 · 밑단 금 두 줄 · 다이아 무늬 줄 · 앞 가운데 검은 V 판 (캔버스 위 = 밑단 v 1, u 0.5 = 앞)
function skirtTex(main, dark) {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.fillStyle = main; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 46) { const gr = g.createLinearGradient(x, 0, x + 46, 0); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = gr; g.fillRect(x, 0, 46, H); }
  const vg = g.createLinearGradient(0, H, 0, 0); vg.addColorStop(0, dark); vg.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.5; g.fillStyle = vg; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  // 앞 검은 V 판 (허리에서 좁고 밑단에서 넓게) + 금테
  const vp = new Path2D(); vp.moveTo(W * 0.5 - 14, H); vp.lineTo(W * 0.5 + 14, H); vp.lineTo(W * 0.5 + 110, 0); vp.lineTo(W * 0.5 - 110, 0); vp.closePath();
  g.fillStyle = '#141218'; g.fill(vp); g.strokeStyle = '#d8b060'; g.lineWidth = 5; g.stroke(vp);
  // 다이아 무늬 줄 (밑단 위) · 금 두 줄
  for (let i = 0; i < 16; i++) { const x = (i + 0.5) / 16 * W; if (Math.abs(x - W / 2) < 80) continue; g.fillStyle = '#d8b060'; dia(g, x, 62, 13, 22); g.fill(); g.fillStyle = i % 2 ? '#141218' : main; dia(g, x, 62, 8, 15); g.fill(); }
  g.fillStyle = '#d8b060'; g.fillRect(0, 22, W, 7); g.fillRect(0, 36, W, 3); g.fillStyle = '#141218'; g.fillRect(0, 0, W, 12);
  return tex(c);
}
// 검은 프릴 페티코트: 밑단 레이스 구멍 (알파) — 캔버스 위 = 밑단
function frillTex(col, hi) {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.clearRect(0, 0, W, H); g.fillStyle = col; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, hi); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, 0, 32, H); }
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < W; x += 32) { g.beginPath(); g.arc(x + 16, 0, 16, 0, Math.PI); g.fill(); }
  for (let x = 0; x < W; x += 32) for (const [dy, rr] of [[30, 5], [44, 3]]) { g.beginPath(); g.arc(x + 16, dy, rr, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over'; return tex(c);
}
// 할리퀸 다이아 (검정 / 크림)
function harleTex(nx, ny) {
  const W = 256, H = 512, [c, g] = cv(W, H), w = W / nx, h = H / ny; g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H);
  for (let j = -1; j <= ny; j++) for (let i = -1; i <= nx; i++) { const x = (i + 0.5) * w, y = (j + 0.5) * h; g.fillStyle = (i + j) % 2 ? '#efe6d2' : '#17151b'; dia(g, x, y, w / 2, h / 2); g.fill(); g.fillStyle = (i + j) % 2 ? '#efe6d2' : '#17151b'; dia(g, x + w / 2, y + h / 2, w / 2, h / 2); g.fill(); }
  // 다이아 이음매 금선
  g.strokeStyle = 'rgba(190,150,80,0.55)'; g.lineWidth = 1.5; for (let j = -1; j <= ny + 1; j++) for (let i = -1; i <= nx + 1; i++) { dia(g, i * w, j * h, w / 2, h / 2); g.stroke(); }
  const t = tex(c); return t;
}
// 꼬리 자락: 진홍 · 금테 · 금 다이아, 밑단은 뾰족한 두 갈래 (알파) — 캔버스 위 = 허리
function tailTex(main, dark) {
  const W = 256, H = 1024, [c, g] = cv(W, H); g.clearRect(0, 0, W, H);
  const hem = (x) => { const tri = 1 - Math.abs(x / W - 0.5) * 2; return H * (0.8 + 0.18 * tri ** 1.4); };
  const p = new Path2D(); p.moveTo(0, 0); p.lineTo(W, 0); for (let x = W; x >= 0; x -= 4) p.lineTo(x, hem(x)); p.closePath();
  g.save(); g.clip(p);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, dark); gr.addColorStop(0.35, main); gr.addColorStop(1, main); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) { const x = (i / 5) * W, fg = g.createLinearGradient(x, 0, x + W / 5, 0); fg.addColorStop(0, 'rgba(255,255,255,0.07)'); fg.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = fg; g.fillRect(x, 0, W / 5, H); }
  for (let i = 0; i < 3; i++) { const y = 380 + i * 170; g.fillStyle = '#d8b060'; dia(g, W / 2, y, 22, 36); g.fill(); g.fillStyle = '#141218'; dia(g, W / 2, y, 13, 23); g.fill(); }
  g.strokeStyle = '#141218'; g.lineWidth = 22; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, hem(x) - 8); g.stroke();
  g.strokeStyle = '#d8b060'; g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, hem(x) - 22); g.stroke();
  g.fillStyle = '#d8b060'; g.fillRect(0, 0, 9, H); g.fillRect(W - 9, 0, 9, H);
  g.restore(); return tex(c);
}
// 낫 자루: 검정 바탕 + 크림 사선 줄무늬
function poleTex() { const W = 64, H = 256, [c, g] = cv(W, H); g.fillStyle = '#121016'; g.fillRect(0, 0, W, H); g.fillStyle = '#d8cfb8'; for (let y = -64; y < H + 64; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 24); g.lineTo(W, y + 32); g.lineTo(0, y + 8); g.closePath(); g.fill(); } return tex(c, [1, 14]); }
// 낫 날: 짙은 진홍 → 검정 그라데이션 + 핏빛 결
function bladeTex(main) { const W = 256, H = 256, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0e0a0e'); gr.addColorStop(0.45, '#2a0812'); gr.addColorStop(1, main); g.fillStyle = gr; g.fillRect(0, 0, W, H); const r = rng(3); for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,80,110,${r() * 0.12})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * H; g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + 20, W * 0.6, y - 20, W, y + r() * 30); g.stroke(); } return tex(c); }
// 트럼프 카드 (다이아 에이스)
function cardTex() { const W = 128, H = 180, [c, g] = cv(W, H); g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, W, H); g.strokeStyle = '#c8a050'; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12); g.fillStyle = '#c01030'; dia(g, W / 2, H / 2, 26, 40); g.fill(); g.font = 'bold 26px serif'; g.fillText('A', 12, 34); dia(g, 22, 52, 7, 11); g.fill(); return tex(c); }

/* ---------- 얼굴: 실제 비율 · 무표정 · 붉은 눈 · 광대 표식 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.071, 0.1, 0.089], jaw: 0.33 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#fae6e0'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,250,248,0.6)'); gr.addColorStop(0.6, 'rgba(255,240,236,0)'); gr.addColorStop(1, 'rgba(190,140,145,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,140,140,0)'); cg.addColorStop(1, 'rgba(190,130,130,0.38)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
    g.save(); g.filter = 'blur(16px)'; g.fillStyle = 'rgba(240,130,150,0.16)'; for (const sd of [-1, 1]) { const [x, y] = M(sd * 0.036, Y.noseY + 0.006); g.beginPath(); g.ellipse(x, y, 66, 28, 0, 0, TAU); g.fill(); } g.restore();
    // 광대 표식: 눈을 세로로 지나는 검은 선 (위 · 아래 끝이 뾰족) — 눈은 paintFace 가 위에 다시 그린다
    for (const sd of [-1, 1]) {
      const x0 = sd * 0.0305, top = Y.browY + 0.016, bot = Y.eyeY - 0.034, wd = (y) => 0.0026 * Math.sin(Math.PI * clamp((y - bot) / (top - bot), 0, 1)) ** 0.6 + 0.0004;
      const L = [], R = []; for (let i = 0; i <= 24; i++) { const y = bot + (top - bot) * (i / 24); L.push(M(x0 - wd(y), y)); R.push(M(x0 + wd(y), y)); }
      g.fillStyle = '#170a10'; g.beginPath(); [...L, ...R.reverse()].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      // 아래 끝 눈물방울
      const d = [M(x0, bot + 0.002), M(x0 + 0.0028, bot - 0.003), M(x0, bot - 0.0085), M(x0 - 0.0028, bot - 0.003)]; g.beginPath(); d.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    }
    // 왼눈 밑 작은 다이아
    { const cx = 0.043, cy = Y.eyeY - 0.024, d = [M(cx, cy + 0.0042), M(cx + 0.0026, cy), M(cx, cy - 0.0042), M(cx - 0.0026, cy)]; g.fillStyle = '#5a0a1c'; g.beginPath(); d.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
  }
  paintFace(g, M, { ...Y, tilt: 0.05, lidDrop: 0.05, glow, open, iris: glow ? ['#ffd0d0', '#ff4a5a', '#d01028', '#000'] : ['#ffa090', '#e8203a', '#7a0818', '#38040a'], pupil: '#1a0206', lash: '#120a10', brow: '#2a2026', lip: 'rgba(150,24,44,0.85)' });
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
  const pid = pal.id || 'r', main = pal.main || '#a8142c', dark = pal.dark || '#4a0612', gemC = pal.gem ?? JADEC;
  const faceM = (open) => { const k = open ? 'faceO' : 'face'; return phys({ map: T(k, () => faceTex(open, false)), emissiveMap: T(k, () => faceTex(open, false)), emissive: 0x6a5658, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8d8) }); };
  const M = {
    skin: phys({ color: 0xfae2da, emissive: 0x7a5858, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffd8d8) }),
    face: faceM(false), faceO: faceM(true),
    eyeGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    hairB: phys({ map: T('hairB', () => hairTex('b', false)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0x8a8ab0), sheenRoughness: 0.35, emissive: 0x05040a, emissiveIntensity: 0.5 }),
    hairBR: phys({ map: T('hairBR', () => hairTex('b', true)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0x8a8ab0), sheenRoughness: 0.35 }),
    hairC: phys({ map: T('hairC', () => hairTex('c', false)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xfff0c8), sheenRoughness: 0.4, emissive: 0x2a2210, emissiveIntensity: 0.3 }),
    hairCR: phys({ map: T('hairCR', () => hairTex('c', true)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xfff0c8), sheenRoughness: 0.4 }),
    top: phys({ map: T('top' + pid, () => topTex(main)), roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color(0xff9aa8) }),
    corset: phys({ map: T('corset', corsetTex), roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
    crim: phys({ map: T('cloth' + pid, () => clothTex(main)), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xff8098), sheenRoughness: 0.4 }),
    skirt: phys({ map: T('skirt' + pid, () => skirtTex(main, dark)), roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xff8098), sheenRoughness: 0.45 }),
    frill: phys({ map: T('frillK', () => frillTex('#141218', 'rgba(150,140,170,0.14)')), alphaTest: 0.4, roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0x8a8098) }),
    frillW: phys({ map: T('frillW', () => frillTex('#fbf8f2', 'rgba(0,0,30,0.1)')), alphaTest: 0.4, roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    tail: phys({ map: T('tail' + pid, () => tailTex(main, dark)), alphaTest: 0.45, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xff8098), sheenRoughness: 0.4 }),
    hat: phys({ map: T('hat' + pid, () => hatTex(main, dark)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xff8098), sheenRoughness: 0.4 }),
    hatIn: phys({ color: new THREE.Color(main).multiplyScalar(0.45), roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xff6080) }),
    hatC: phys({ map: T('cloth' + pid, () => clothTex(main)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xff8098), sheenRoughness: 0.4 }),
    black: phys({ color: 0x16141a, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x6a6078) }),
    satin: phys({ color: 0x141218, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.8, sheenColor: new THREE.Color(0x8a80a0) }),
    patent: phys({ color: 0x0e0c10, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    white: phys({ color: 0xf8f4ee, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    red: phys({ color: 0xc8102c, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xff8090) }),
    gold: phys({ color: 0xf0c060, metalness: 1, roughness: 0.25, clearcoat: 0.4 }),
    goldD: phys({ color: 0xc08a30, metalness: 1, roughness: 0.32 }),
    gem: phys({ color: 0x6affa8, emissive: gemC, emissiveIntensity: 0.9, roughness: 0.05, clearcoat: 1, flatShading: true }),
    ruby: phys({ color: 0xff3050, emissive: 0xc0102a, emissiveIntensity: 0.6, roughness: 0.05, clearcoat: 1, flatShading: true }),
    stockT: phys({ map: T('harT', () => harleTex(4, 2)), roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color(0xd0c8d8) }),
    stockS: phys({ map: (() => { const t = T('harS', () => harleTex(4, 4)); return t; })(), roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color(0xd0c8d8) }),
    lacing: phys({ color: 0xf0e8e0, roughness: 0.7 }),
    pole: phys({ map: T('pole', poleTex), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    blade: phys({ map: T('blade' + pid, () => bladeTex(main)), metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x30000c, emissiveIntensity: 1 }),
    edge: new THREE.MeshBasicMaterial({ color: pal.accent ?? CRIM, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    card: phys({ map: T('card', cardTex), roughness: 0.4 }),
    nail: phys({ color: 0x5a0a1c, roughness: 0.2, clearcoat: 1 }),
  };
  M.gem.envMap = env; M.ruby.envMap = env; M.blade.envMap = env; M.blade.envMapIntensity = 0.8;
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = mat !== M.edge && mat !== M.eyeGlow; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const diaGeo = (key, w, h, d = 0.003) => C(key, () => new THREE.ExtrudeGeometry(diaShape(w, h), { depth: d, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1 }));
  // 금테 다이아 장식 (안쪽 보석)
  const emblem = (parent, key, p, n, w, h, inner = M.ruby) => { const g = new THREE.Group(); g.position.copy(p); g.lookAt(p.clone().add(n)); parent.add(g); add(g, diaGeo('emb' + key, w, h), M.gold); add(g, C('embG' + key, () => { const o = new THREE.OctahedronGeometry(1, 0); o.scale(w * 0.55, h * 0.6, w * 0.35); return o; }), inner, [0, 0, 0.004]); return g; };
  const bow = (parent, key, p, s, mat, tail = 0.05) => { // 나비 리본 (s = 크기)
    const g = new THREE.Group(); g.position.set(...p); parent.add(g);
    for (const q of [-1, 1]) add(g, C(key + 'l' + q, () => strand([[0, 0, 0], [q * 0.05 * s, 0.026 * s, -0.004 * s], [q * 0.068 * s, -0.004 * s, -0.008 * s], [q * 0.05 * s, -0.028 * s, -0.004 * s], [0, 0, 0]], 0.008 * s, 0.008 * s, { closed: true, seg: 24, rad: 8, flat: 0.35, ref: [0, 0, 1] })), mat);
    if (tail) for (const q of [-1, 1]) add(g, C(key + 't' + q, () => strand([[0, 0, 0], [q * 0.014 * s, -0.03 * s, 0.004], [q * 0.01 * s, -tail * s, 0.008], [q * 0.024 * s, -tail * 1.3 * s, 0.004]], 0.009 * s, 0.007 * s, { seg: 14, rad: 8, flat: 0.25, ref: [0, 0, 1] })), mat);
    add(g, C(key + 'k', () => new THREE.SphereGeometry(0.011 * s, 14, 10)), mat, [0, 0, 0.002], [0, 0, 0], [1, 1.1, 0.7]);
    return g;
  };
  m.ropes = [];

  /* ---------- 골반 · 허리띠 · 치마 · 페티코트 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: 0.09 - 0.2 * v, rx: 0.116 + 0.024 * v, rzF: 0.084, rzB: 0.096, n: 2.2 }), 28, 6)), M.black);
  const beltP = (v) => ({ y: 0.0 + 0.045 * v, rx: 0.134, rzF: 0.102, rzB: 0.108, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 56, 3)), M.satin);
  lRim(J.hips, 'beltR0', beltP, 0, 0.003, M.gold); lRim(J.hips, 'beltR1', beltP, 1, 0.003, M.gold);
  { const p = loftAt(beltP, 0.5, 0.5, new V3()); emblem(J.hips, 'belt', p.add(new V3(0, 0, 0.004)), new V3(0, 0, 1), 0.018, 0.026); }
  const SK_L = 0.36, skR = (d) => { const t = d / SK_L, e = t * t * (1.6 - 0.6 * t); return { rx: 0.14 + 0.15 * e, rzF: 0.11 + 0.12 * e, rzB: 0.122 + 0.15 * e }; };
  const skP = (v) => ({ y: 0.01 - SK_L * v, ...skR(SK_L * v), n: 2.1 });
  const pleat = (n, amp) => (p, u, v) => { const w = Math.sin(u * TAU * n + 0.7) + 0.35 * Math.sin(u * TAU * n * 2.3), k = 1 + amp * w * smooth(0.05, 0.9, v); p.x *= k; p.z *= k; p.y += 0.008 * w * v * v; };
  const skO = add(J.hips, C('skirt', () => loft(skP, 144, 16, { mod: pleat(12, 0.035) })), M.skirt);
  const pcP = (d0, d1, out) => (v) => { const d = d0 + (d1 - d0) * v, s = skR(Math.min(d, SK_L * 1.25)); return { y: 0.01 - d, rx: s.rx * out, rzF: s.rzF * out, rzB: s.rzB * out, n: 2.1 }; };
  const ruffle = (n, amp, v0 = 0.2, ph = 0) => (p, u, v) => { const w = Math.sin(u * TAU * n + ph), k = 1 + amp * w * smooth(v0, 1, v); p.x *= k; p.z *= k; p.y += 0.006 * w * smooth(v0, 1, v); };
  const pc1 = add(J.hips, C('petti1', () => loft(pcP(0.26, 0.41, 0.96), 160, 10, { mod: ruffle(19, 0.04, 0.5) })), M.frill);
  const pc2 = add(J.hips, C('petti2', () => loft(pcP(0.33, 0.45, 0.94), 160, 8, { mod: ruffle(23, 0.045, 0.3, 1.3) })), M.frill);
  m.skirt = [skO, pc1, pc2];
  for (const me of m.skirt) { me.geometry = me.geometry.clone(); me.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); me.userData.base = me.geometry.attributes.position.array.slice(); me.frustumCulled = false; }

  /* ---------- 코르셋(배) · 상의(진홍 튜브톱) · 가슴 ---------- */
  const bX = spl([[0, 0.114], [0.45, 0.086], [1, 0.102]]), bF = spl([[0, 0.078], [0.5, 0.064], [1, 0.075]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.078, n: 2.15 }), 40, 12)), M.skin);
  const coP = (v) => { const y = -0.05 + 0.24 * v, w = clamp((y + 0.035) / 0.24, 0, 1); return { y, rx: bX(w) + 0.007, rzF: bF(w) + 0.008, rzB: 0.086, n: 2.2 }; };
  add(J.spine, C('corset', () => loft(coP, 56, 10, { uvU: 1 })), M.corset);
  lRim(J.spine, 'coR0', coP, 0, 0.003, M.gold);
  // 앞 끈 (흰 끈 X자 · 금 고리)
  { const eL = [], eR = []; for (let i = 0; i <= 6; i++) { const v = 0.08 + i * 0.145; eL.push(loftAt(coP, 0.47, v, new V3()).multiplyScalar(1.02)); eR.push(loftAt(coP, 0.53, v, new V3()).multiplyScalar(1.02)); }
    for (const p of [...eL, ...eR]) add(J.spine, C('eyelet', () => new THREE.TorusGeometry(0.0038, 0.0014, 6, 12)), M.gold, [p.x, p.y, p.z + 0.001]);
    for (let i = 0; i < 6; i++) { rim(J.spine, 'lace' + i, [eL[i], eL[i].clone().lerp(eR[i + 1], 0.5).add(new V3(0, 0, 0.003)), eR[i + 1]], 0.0017, false, M.lacing); rim(J.spine, 'laceB' + i, [eR[i], eR[i].clone().lerp(eL[i + 1], 0.5).add(new V3(0, 0, 0.003)), eL[i + 1]], 0.0017, false, M.lacing); } }
  const chX = spl([[0, 0.102], [0.3, 0.112], [0.55, 0.122], [0.8, 0.118], [1, 0.092]]), chF = spl([[0, 0.075], [0.5, 0.086], [1, 0.07]]), chB = spl([[0, 0.077], [0.6, 0.084], [1, 0.068]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.03 * gauss(ax - 0.054, 0.04) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 64, 24, { mod: chMod, uvU: 1 })), M.top);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.12 - 0.072 * v ** 0.8, rzF: 0.073 - 0.028 * v, rzB: 0.068 - 0.026 * v }), 40, 8)), M.skin);
  // 튜브톱 윗선 금테 (하트 모양)
  { const pts = []; for (let i = 0; i < 96; i++) { const u = i / 96, p = loftAt(chP, u, bustTop(u), new V3(), chMod); p.addScaledVector(new V3(p.x, 0, p.z).normalize(), 0.003); pts.push(p); } rim(J.chest, 'bustRim', pts, 0.0035, true); }
  // 가슴 가운데 금 다이아 문장 (세로로 긴 장식)
  { const p = loftAt(chP, 0.5, 0.5, new V3(), chMod); p.z += 0.006; emblem(J.chest, 'chest', p, new V3(0, 0.1, 1), 0.014, 0.03, M.gem);
    const sh = diaShape(0.008, 0.016); add(J.chest, C('chDia2', () => new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false })), M.gold, [0, p.y - 0.048, loftAt(chP, 0.5, 0.33, new V3(), chMod).z + 0.004]); }

  /* ---------- 목 · 초커 · 나비 넥타이 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.034 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.033 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.033 - 0.004 * v }), 20, 6)), M.skin);
  const chokP = (v) => ({ y: 0.015 + 0.024 * v, rx: 0.0325, rzF: 0.0325, rzB: 0.033 });
  add(J.neck, C('choker', () => loft(chokP, 32, 3)), M.black); lRim(J.neck, 'chokR', chokP, 0, 0.0015, M.goldD); lRim(J.neck, 'chokR1', chokP, 1, 0.0015, M.goldD);
  { const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; pts.push(new V3(Math.sin(a) * 0.035, 0.012 + 0.003 * Math.sin(a * 16), Math.cos(a) * 0.035)); } rim(J.neck, 'chokLace', pts, 0.0022, true, M.black); }
  bow(J.neck, 'tie', [0, 0.012, 0.04], 1.15, M.satin, 0); m.tie = J.neck.children[J.neck.children.length - 1]; m.tie.rotation.x = 0.25;
  // 흰 프릴 자보 (넥타이 아래)
  add(J.chest, C('jabot', () => surf((u, v, p) => { const w = 0.012 + 0.016 * v, x = (u - 0.5) * 2 * w; p.set(x, 0.268 - 0.06 * v, 0.07 - 0.012 * v + 0.004 * Math.sin(u * TAU * 3) * v + 0.01 * (1 - (2 * u - 1) ** 2) * v); }, 12, 6)), M.white);

  /* ---------- 팔: 맨팔 · 퍼프 소매(금 다이아) · 떨어진 진홍 소매 · 흰 프릴 커프스 · 손 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.042 - 0.009 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.04 - 0.008 * v }), 24, 10)), M.skin);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.035 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.033 - 0.01 * v }), 24, 10)), M.skin);
    // 퍼프: 어깨 아래(어깨는 드러남)에서 부풀었다가 위팔 가운데에서 오므라듦
    const pfP = (v) => { const b = Math.sin(Math.PI * Math.min(1, 0.08 + v * 1.0) ** 0.85); return { y: 0.01 - 0.17 * v, rx: 0.046 + 0.04 * b, rz: 0.044 + 0.037 * b, cx: s * 0.008 * b }; };
    const pfMod = (p, u, v) => { const k = 1 + 0.05 * Math.sin(u * TAU * 8) * Math.sin(Math.PI * v); p.x *= k; p.z *= k; };
    add(sh, C('puff' + s, () => loft(pfP, 48, 14, { mod: pfMod, poles: [] })), M.crim);
    const bandP = (v) => ({ y: -0.155 - 0.016 * v, rx: 0.047, rz: 0.045 });
    add(sh, C('puffBand', () => loft(bandP, 28, 2)), M.black); lRim(sh, 'pbR', bandP, 0, 0.0028, M.gold); lRim(sh, 'pbR1', bandP, 1, 0.0028, M.gold);
    lRim(sh, 'pfTop' + s, pfP, 0, 0.003, M.gold, { mod: pfMod });
    { const p = loftAt(pfP, s > 0 ? 0.25 : 0.75, 0.42, new V3(), pfMod); emblem(sh, 'puff', p.add(new V3(s * 0.004, 0, 0)), new V3(s, 0.1, 0.25), 0.02, 0.03); }
    // 떨어진 소매: 팔꿈치 위에서 손목까지 나팔처럼 벌어짐 (위 검은 레이스 띠 · 금 다이아)
    const slP = (v) => ({ y: 0.05 - (DIMS.lArm + 0.02) * v, rx: 0.041 + 0.016 * v ** 1.6, rz: 0.039 + 0.014 * v ** 1.6 });
    add(el, C('sleeve', () => loft(slP, 36, 12)), M.crim);
    lRim(el, 'slTop', slP, 0, 0.004, M.black); lRim(el, 'slHem', slP, 1, 0.003, M.gold);
    { const p = loftAt(slP, s > 0 ? 0.25 : 0.75, 0.25, new V3()); emblem(el, 'slv', p.add(new V3(s * 0.004, 0, 0)), new V3(s, 0, 0.2), 0.014, 0.022); }
    // 흰 프릴 커프스 (두 겹)
    for (const [k, d, R] of [[0, 0.0, 0.06], [1, 0.022, 0.054]]) {
      const cfP = (v) => ({ y: -DIMS.lArm + 0.03 - d - 0.045 * v, rx: R - 0.012 + 0.016 * v, rz: R - 0.014 + 0.015 * v });
      add(el, C('cuff' + k, () => loft(cfP, 64, 4, { mod: ruffle(13, 0.09, 0.1, k) })), M.frillW);
    }
    // 손 (조금 작게 · 진홍 손톱)
    const hg = new THREE.Group(); hg.scale.setScalar(0.84); hg.position.y = -0.006; ha.add(hg);
    add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.02 + 0.003 * Math.sin(v * Math.PI), rz: 0.033 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.skin);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.35 + k * 0.12 : 2.6;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`fing${s}${k}`, () => strand(pts, 0.0076, 0.006, { seg: 14, rad: 8 })), M.skin);
      add(hg, C(`nail${s}${k}`, () => new THREE.SphereGeometry(0.0056, 8, 6)), M.nail, pts[8].toArray(), [0, 0, 0], [1, 1, 0.6]);
    }
    add(hg, C('thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.0092, 0.0068, { seg: 12, rad: 8 })), M.skin);
  }

  /* ---------- 다리: 할리퀸 니삭스 · 붉은 가터 · 정강이 리본 · 플랫폼 하이힐 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.088], [0.4, 0.077], [0.85, 0.055], [1, 0.053]]), thF = spl([[0, 0.084], [0.5, 0.069], [1, 0.053]]), thB = spl([[0, 0.086], [0.35, 0.075], [1, 0.048]]);
    const thP = (v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 28, 12)), M.skin);
    const stP = (v) => { const q = thP(0.36 + 0.64 * v); return { ...q, rx: q.rx + 0.002, rzF: q.rzF + 0.002, rzB: q.rzB + 0.002 }; };
    add(hp, C('stockT', () => loft(stP, 32, 10)), M.stockT); lRim(hp, 'stTop', stP, 0, 0.0035, M.black);
    // 붉은 가터 띠 + 리본
    const gtP = (v) => { const q = thP(0.38 + 0.07 * v); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.006, rzB: q.rzB + 0.006 }; };
    add(hp, C('garter', () => loft(gtP, 32, 3)), M.red); lRim(hp, 'gtR', gtP, 0, 0.002, M.goldD); lRim(hp, 'gtR1', gtP, 1, 0.002, M.goldD);
    { const k = loftAt(gtP, s > 0 ? 0.3 : 0.7, 0.5, new V3()).multiplyScalar(1.05); const b = bow(hp, 'gbow', [k.x, k.y, k.z], 0.6, M.red, 0.06); b.rotation.y = s * 0.9; }
    const cX = spl([[0, 0.052], [0.3, 0.056], [0.75, 0.036], [1, 0.03]]), cF = spl([[0, 0.05], [0.5, 0.042], [1, 0.03]]), cB = spl([[0, 0.052], [0.3, 0.07], [0.7, 0.042], [1, 0.032]]);
    const shP = (v) => ({ y: 0.02 - (DIMS.shin - 0.02) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) });
    add(kn, C('shin', () => loft(shP, 28, 14)), M.stockS);
    add(kn, C('ankle', () => loft((v) => ({ y: -DIMS.shin + 0.03 - 0.05 * v, rx: 0.03 + 0.004 * v, rz: 0.032 + 0.006 * v }), 16, 4)), M.black);
    // 정강이를 X자로 감은 붉은 리본 (두 나선)
    for (const q of [-1, 1]) { const pts = []; for (let i = 0; i <= 40; i++) { const v = 0.06 + 0.86 * (i / 40), u = 0.5 + q * (i / 40) * 1.5, p = loftAt(shP, ((u % 1) + 1) % 1, v, new V3()); p.x *= 1.06; p.z *= 1.06; pts.push(p); } add(kn, C('rib' + q, () => strand(pts, 0.0055, 0.0055, { seg: 120, rad: 6, flat: 0.3 })), M.red); }
    // 발: 뒤꿈치가 들린 하이힐 (뒤꿈치 -0.02 · 앞꿈치 -0.072) — 검은 구두가 감싼다
    const fw = spl([[0, 0.0], [0.06, 0.026], [0.25, 0.033], [0.6, 0.038], [0.85, 0.03], [1, 0.006]]), fh = spl([[0, 0.025], [0.08, 0.055], [0.3, 0.058], [0.6, 0.034], [0.85, 0.024], [1, 0.012]]);
    const fb = (v) => -0.072 + 0.052 * (1 - smooth(0.3, 0.72, v));
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w * 1.06, fb(v) + (h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2) * 1.04 - 0.002, -0.058 + 0.235 * v); };
    add(ft, C('shoe', () => surf(foot, 28, 20, { closedU: true })), M.patent);
    // 플랫폼 밑창 (앞꿈치) · 높은 굽
    add(ft, C('platform', () => { const sh = new THREE.Shape(); const N = 14; for (let i = 0; i <= N; i++) { const v = 0.58 + 0.42 * (i / N), x = fw(v) * 1.12 + 0.002; (i ? sh.lineTo(x, -0.058 + 0.235 * v) : sh.moveTo(x, -0.058 + 0.235 * v)); } for (let i = N; i >= 0; i--) { const v = 0.58 + 0.42 * (i / N); sh.lineTo(-(fw(v) * 1.12 + 0.002), -0.058 + 0.235 * v); } sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 4 }); g.rotateX(Math.PI / 2); g.translate(0, -0.071, 0); return g; }), M.patent);
    add(ft, C('heel', () => { const g = new THREE.CylinderGeometry(0.014, 0.009, 0.078, 12); g.translate(0, -0.058, -0.04); return g; }), M.patent);
    add(ft, C('heelTip', () => { const g = new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 12); g.translate(0, -0.096, -0.04); return g; }), M.goldD);
    // 발목 끈 + 다이아 버클 (녹색 보석)
    add(ft, C('strap', () => new THREE.TorusGeometry(0.035, 0.0035, 6, 28)), M.patent, [0, 0.0, -0.004], [Math.PI / 2 - 0.2, 0, 0], [0.95, 1.1, 1]);
    { const g = new THREE.Group(); g.position.set(0, -0.012, 0.05); g.rotation.x = -0.9; ft.add(g); add(g, diaGeo('buckle', 0.016, 0.022, 0.003), M.gold); add(g, C('bkGem', () => { const o = new THREE.OctahedronGeometry(1, 0); o.scale(0.008, 0.011, 0.005); return o; }), M.gem, [0, 0, 0.004]); }
  }

  /* ---------- 목 위: 얼굴 · 투톤 머리카락 · 실크해트 ---------- */
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.1);
  m.eyeGlow = add(H, headGeo, M.eyeGlow, [0, 0, 0], [0, 0, 0], [1.002, 1.002, 1.002]); m.eyeGlow.renderOrder = 5;
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.1, -0.006], [s * 0.08, 0.104, -0.014], [s * 0.084, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  const hm = (x) => (x > 0.002 ? 'c' : 'b'); // 왼쪽(+x) = 크림, 오른쪽 = 검정
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.14 + 0.36 * w * w : 0.14 - 0.9 * w * w; };
    // 머리 덮개: 왼쪽 반(크림) · 오른쪽 반(검정)
    for (const [a0, a1, mat] of [[0, Math.PI, M.hairCR], [Math.PI, TAU, M.hairBR]])
      add(H, C('cap' + a0, () => surf((u, v, p) => { const az = a0 + (a1 - a0) * u, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 40, 22, { poles: [22], uvU: 4 })), mat);
    const r = rng(19), clump = (key, pts, r0, r1, flat, ref, tone) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), tone === 'c' ? M.hairC : M.hairB);
    // 히메컷 앞머리: 눈썹 아래에서 일자로 끊김
    for (let k = 0; k < 19; k++) {
      const t = k / 18, az = 0.95 - t * 1.9 + (r() - 0.5) * 0.03, side = Math.abs(az), tipEl = 0.17 - 0.03 * r() - 0.12 * smooth(0.6, 0.95, side);
      const pts = [headAt(az * 0.35, 1.2, 0.02), headAt(az * 0.75, 0.82, 0.03), headAt(az * 0.95, 0.5, 0.03), headAt(az, (0.5 + tipEl) / 2, 0.026), headAt(az * 1.01, tipEl, 0.014)];
      const d = dirOf(az, 0.5); clump('bang' + k, pts, (k % 2 ? 0.026 : 0.034) + r() * 0.008, 0.004, 0.22, [d.x, d.y, d.z], hm(Math.sin(az)));
    }
    // 옆머리(히메컷 사이드): 귀 앞에서 턱 아래까지 곧게
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const az = s * (1.02 + k * 0.13), pts = [headAt(az * 0.9, 0.72, 0.018), headAt(az, 0.15, 0.018), headAt(az * 1.01, -0.5 - k * 0.08, 0.016), headAt(az * 1.02, -0.95 - k * 0.1, 0.02)];
      const d = dirOf(az, 0); clump(`side${s}${k}`, pts, 0.03, 0.006, 0.22, [d.x, 0, d.z], s > 0 ? 'c' : 'b');
    }
    // 뒷머리 위쪽 덩어리 (모자 아래 볼륨)
    for (let k = 0; k < 16; k++) {
      const az = Math.PI + (k - 7.5) * 0.24, pts = [headAt(az, 0.75, 0.016), headAt(az + (r() - 0.5) * 0.12, 0.0, 0.02), headAt(az + (r() - 0.5) * 0.15, -0.62, 0.016)];
      const d = dirOf(az, 0); clump('back' + k, pts, 0.042, 0.022, 0.26, [d.x, 0, d.z], hm(Math.sin(az)));
    }
    // 긴 생머리: 뒤 7가닥 + 앞으로 내린 2가닥 + 옆으로 흩날리는 2가닥 (로프 물리 · 납작한 리본 관)
    const locks = [...[-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9].map((d) => ({ az: Math.PI + d, el: -0.5 + 0.1 * Math.abs(d), n: 12 - Math.round(Math.abs(d) * 1.6), w: 0.056, kind: 'back' })),
      { az: 1.25, el: -0.5, n: 9, w: 0.032, kind: 'front' }, { az: -1.25, el: -0.5, n: 9, w: 0.032, kind: 'front' },
      { az: 1.85, el: 0.3, n: 8, w: 0.042, kind: 'wing' }, { az: -1.85, el: 0.3, n: 8, w: 0.042, kind: 'wing' }];
    locks.forEach(({ az, el, n, w, kind }, i) => {
      const x = Math.sin(az), tone = kind === 'back' && Math.abs(x) < 0.05 ? 'b' : hm(x), rope = new Rope(n, 0.062, { damp: 0.978, stiff: kind === 'wing' ? 0.08 : 0.06 });
      const view = new RopeTube(rope, tone === 'c' ? M.hairC : M.hairB, { sub: 3, rad: 12, uvV: 2, flat: 0.26, side: new V3(1, 0, 0),
        prof: (v) => w * (v < 0.05 ? 0.85 : 1 - 0.4 * v) * (v > 0.86 ? 1 - (v - 0.86) * 5.5 : 1),
        wave: kind === 'wing' ? (v) => 0.012 * Math.sin(v * TAU + i) * smooth(0.2, 0.6, v) : null });
      const local = headAt(az, el, 0.02), sideL = new V3(Math.cos(az), 0, -Math.sin(az));
      const rest = kind === 'front' ? new V3(Math.sin(az) * 0.25, -1, 0.4).normalize() : kind === 'wing' ? new V3(Math.sign(x) * 0.55, -0.8, -0.35).normalize() : new V3(Math.sin(az) * 0.3, -0.75, -0.6).normalize();
      m.ropes.push({ rope, view, joint: H, local, rest, sideL, caps: 'body' });
    });
  }
  // 실크해트: 넓은 챙(양옆이 살짝 말려 올라감 · 금 테) · 진홍/검정 판 몸통 · 검은 띠 + 리본 · 금 다이아 문장 · 꽂힌 화살 · 트럼프 카드
  {
    const hat = new THREE.Group(); hat.position.set(0.012, 0.166, -0.012); hat.rotation.set(-0.16, 0.12, -0.2); H.add(hat); m.hat = hat;
    const r0 = 0.084, r1 = 0.215;
    const brim = (dy) => (u, v, p) => { const a = u * TAU, R = r0 + (r1 - r0) * v, side = Math.sin(a) ** 2; p.set(Math.sin(a) * R, dy + 0.045 * side * v ** 2.2 - 0.012 * Math.cos(a) ** 2 * v * v, Math.cos(a) * R * 1.05); };
    add(hat, C('brimT', () => surf(brim(0.003), 96, 10, { closedU: true })), M.hatC);
    add(hat, C('brimB', () => surf(brim(-0.003), 96, 10, { closedU: true, flip: true })), M.hatIn);
    { const pts = []; for (let i = 0; i < 160; i++) { const p = new V3(); brim(0)(i / 160, 1, p); pts.push(p); } rim(hat, 'brimEdge', pts, 0.0055, true); }
    const HH = 0.225, crR = (t) => 0.082 + 0.012 * t * t;
    add(hat, C('crown', () => { const g = new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => { const t = i / 8; return new THREE.Vector2(crR(t), t * HH); }), 64); g.scale(1, 1, 1.07); return g; }), M.hat);
    add(hat, C('crownTop', () => { const g = new THREE.CircleGeometry(crR(1), 48); g.rotateX(-Math.PI / 2); g.scale(1, 1, 1.07); g.translate(0, HH, 0); return g; }), M.hatC);
    add(hat, C('crownRim', () => { const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; pts.push(new V3(Math.sin(a) * crR(1), HH, Math.cos(a) * crR(1) * 1.07)); } return strand(pts, 0.004, 0.004, { closed: true, seg: 128, rad: 6 }); }), M.gold);
    add(hat, C('band', () => { const g = new THREE.LatheGeometry([0, 0.012, 0.024, 0.036, 0.046].map((y) => new THREE.Vector2(crR(y / HH) + 0.003, y + 0.002)), 64); g.scale(1, 1, 1.07); return g; }), M.satin);
    for (const y of [0.004, 0.048]) add(hat, C('bandR' + y, () => { const pts = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; pts.push(new V3(Math.sin(a) * (crR(y / HH) + 0.004), y, Math.cos(a) * (crR(y / HH) + 0.004) * 1.07)); } return strand(pts, 0.0022, 0.0022, { closed: true, seg: 128, rad: 5 }); }), M.gold);
    // 띠 옆 리본 (왼쪽) + 트럼프 카드 (오른쪽)
    { const b = bow(hat, 'hbow', [0.092, 0.026, 0.0], 1.0, M.satin, 0); b.rotation.y = Math.PI / 2; }
    add(hat, C('card', () => new THREE.BoxGeometry(0.045, 0.064, 0.0015)), M.card, [-0.085, 0.06, 0.03], [0.1, -1.1, 0.25]);
    // 앞 큰 다이아 문장 (띠 위)
    emblem(hat, 'hat', new V3(0, 0.026, crR(0.13) * 1.07 + 0.006), new V3(0, 0, 1), 0.02, 0.03);
    // 꽂힌 화살: 몸통을 비스듬히 꿰뚫음 (화살촉은 한쪽, 깃은 반대쪽)
    const arrowGeo = C('arrow', () => { const g = new THREE.CylinderGeometry(0.003, 0.003, 0.34, 8); g.rotateX(Math.PI / 2); return g; });
    const headG = C('arrowHead', () => { const g = new THREE.ConeGeometry(0.008, 0.03, 4); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.17 + 0.015); return g; });
    const fletch = C('fletch', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.018, 0.01); sh.lineTo(0.05, 0.012); sh.lineTo(0.04, 0); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.001, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(0, 0, -0.17); return g; });
    for (const [px, py, pz, ry, rx] of [[0.0, 0.13, 0.0, -1.2, 0.25], [0.0, 0.1, 0.01, -1.7, -0.15], [0.0, 0.155, -0.01, -2.3, 0.4], [0, 0.085, 0, 0.6, 0.1]]) {
      const a = new THREE.Group(); a.position.set(px, py, pz); a.rotation.set(rx, ry, 0, 'YXZ'); hat.add(a);
      add(a, arrowGeo, M.goldD); add(a, headG, M.gold);
      for (let k = 0; k < 3; k++) { const fm = add(a, fletch, k % 2 ? M.hatC : M.black); fm.rotation.z = (k / 3) * TAU; }
    }
  }

  /* ---------- 양옆 긴 꼬리 자락 (천 물리) · 끝 장식 ---------- */
  let tails = [];
  const pendant = () => { const g = new THREE.Group(); add(g, C('pdRing', () => new THREE.TorusGeometry(0.008, 0.002, 6, 12)), M.gold, [0, 0.006, 0]); const d = new THREE.Group(); d.position.y = -0.03; g.add(d); add(d, diaGeo('pd', 0.018, 0.03, 0.004), M.gold); add(d, C('pdGem', () => { const o = new THREE.OctahedronGeometry(1, 0); o.scale(0.01, 0.018, 0.007); return o; }), M.gem, [0, 0, 0.003]); return g; };
  m.endTassels = [pendant(), pendant()];
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    tails = [new Cloth(scene, 4, 14, 0.78, M.tail), new Cloth(scene, 4, 14, 0.78, M.tail)];
    for (const c of tails) extras.push(c.mesh);
    for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); }
    for (const t of m.endTassels) { scene.add(t); extras.push(t); }
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; for (const c of tails) c.mesh.geometry.dispose(); tails = []; m._attached = false; };
  m.resetCloth = () => { for (const c of tails) c.ok = false; for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 무기: 장대 낫 ---------- */
  const scy = new THREE.Group(); J.weapon.add(scy); m.glaive = scy; m.scythe = scy;
  {
    const X = [Math.PI / 2, 0, 0];
    add(scy, C('sc:pole', () => new THREE.CylinderGeometry(0.0165, 0.0165, SC.top - SC.butt, 16, 1, true)), M.pole, [0, 0, (SC.top + SC.butt) / 2], X);
    const ring = C('sc:ring', () => lathe([[0.0165, -0.014], [0.023, -0.01], [0.025, 0], [0.023, 0.01], [0.0165, 0.014]], 24));
    for (const z of [SC.butt + 0.06, -0.12, 0.12, 0.62, SC.top - 0.16]) add(scy, ring, M.gold, [0, 0, z], X);
    // 자루의 녹색 보석 (금 다이아 받침)
    for (const z of [0.36, 0.86]) { const g = new THREE.Group(); g.position.z = z; scy.add(g);
      for (const q of [-1, 1]) { const o = add(g, diaGeo('sc:gm', 0.016, 0.034, 0.003), M.gold, [q * 0.018, 0, 0], [0, q * Math.PI / 2, 0]); o.rotation.order = 'YXZ'; o.rotation.x = Math.PI / 2; }
      add(g, C('sc:gem', () => { const o = new THREE.OctahedronGeometry(1, 0); o.scale(0.02, 0.02, 0.034); return o; }), M.gem); }
    // 머리: 금 받침 → 창끝 · 양옆 날
    add(scy, C('sc:socket', () => lathe([[0.017, -0.06], [0.026, -0.03], [0.034, 0.0], [0.03, 0.03], [0.022, 0.05]], 24)), M.gold, [0, 0, SC.top], X);
    add(scy, C('sc:headGem', () => { const o = new THREE.OctahedronGeometry(1, 0); o.scale(0.03, 0.022, 0.03); return o; }), M.gem, [0, 0, SC.top + 0.01]);
    add(scy, C('sc:spike', () => { const sh = new THREE.Shape(); sh.moveTo(-0.022, 0); sh.quadraticCurveTo(-0.03, 0.08, 0, 0.24); sh.quadraticCurveTo(0.03, 0.08, 0.022, 0); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 }); g.translate(0, 0, -0.004); g.rotateX(Math.PI / 2); g.rotateY(Math.PI / 2); return g; }), M.goldD, [0, 0, SC.top + 0.04]);
    // 초승달 날: c(t) = 바깥으로 L·t, 손잡이 쪽(-z)으로 휨. 등(+z 쪽)과 날(-z 쪽, 오목)
    const crescent = (L, W, droop, curl) => { const sh = new THREE.Shape(), N = 30, sp = [], ed = [];
      for (let i = 0; i <= N; i++) { const t = i / N, x = L * t, y = -droop * t * t - curl * t ** 4, w = W * Math.pow(1 - t, 0.8) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.6 + 0.2))); sp.push([x - 0.25 * w * t, y + w * 0.35]); ed.push([x + 0.2 * w * t, y - w * 0.65]); }
      sh.moveTo(sp[0][0], sp[0][1]); for (const p of sp) sh.lineTo(p[0], p[1]); for (let i = ed.length - 1; i >= 0; i--) sh.lineTo(ed[i][0], ed[i][1]); sh.closePath(); return { sh, ed }; };
    const toLocal = (sx, sy, side, flipZ) => new THREE.Matrix4().makeBasis(new V3(0, side, 0), new V3(0, 0, flipZ), new V3(side * flipZ, 0, 0));
    const mkBlade = (key, L, W, droop, curl, side, flipZ, z0) => {
      const { sh, ed } = crescent(L, W, droop, curl), mt = toLocal(0, 0, side, flipZ);
      const geo = C('sc:bl' + key, () => { const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -0.003); g.applyMatrix4(mt);
        g.computeVertexNormals(); return g; });
      add(scy, geo, M.blade, [0, 0, z0]);
      const pts = ed.slice(2, ed.length - 1).map(([x, y]) => new V3(x, y, 0).applyMatrix4(mt).add(new V3(0, 0, z0)));
      add(scy, C('sc:ed' + key, () => strand(pts, 0.0028, 0.001, { seg: 60, rad: 5 })), M.edge);
      return pts;
    };
    m.bladeEdge = mkBlade('main', SC.bladeL, 0.13, 0.22, 0.12, -1, 1, SC.top - 0.02);
    mkBlade('sub', 0.34, 0.075, 0.16, 0.08, 1, 1, SC.top - 0.03);
    mkBlade('butt', 0.2, 0.05, 0.1, 0.04, 1, -1, SC.butt + 0.03);
    add(scy, C('sc:buttCap', () => lathe([[0.017, 0.03], [0.022, 0.0], [0.016, -0.04], [0.004, -0.09], [0, -0.1]], 20)), M.gold, [0, 0, SC.butt], [-Math.PI / 2, 0, 0]);
    // 날 뿌리의 금 발톱 장식
    for (const q of [-1, 1]) add(scy, C('sc:claw' + q, () => strand([[0, 0, SC.top - 0.06], [0, q * 0.05, SC.top - 0.02], [0, q * 0.07, SC.top + 0.05], [0, q * 0.05, SC.top + 0.1]], 0.007, 0.002, { seg: 16, rad: 6, flat: 0.5, ref: [1, 0, 0] })), M.gold);
  }

  /* ---------- 매 프레임 ---------- */
  const lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 }, tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion();
  const tS = new V3(), tT = new V3(), tE = new V3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), dn = new V3(0, -1, 0);
  m.glow = 0; m.ikW = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible;
    // 왼손 IK: 기술 중(ikOff 가 아니면) · 방어 중에는 낫 자루를 잡는다
    const want = m.weaponOut ? 0 : f.state === 'act' ? (f.act.ikOff ? 0 : 1) : f.state === 'guard' ? 1 : 0;
    m.ikW += (want - m.ikW) * Math.min(1, dt * 14);
    if (m.ikW > 0.02) {
      J.chest.updateMatrixWorld(true); J.weapon.updateMatrixWorld(true);
      J.shoulderL.getWorldPosition(tS); J.weapon.localToWorld(tT.set(0, 0, SC.grip2));
      const sc = f.scale, L1 = DIMS.uArm * sc, L2 = (DIMS.lArm + 0.05) * sc;
      const natural = J.handL.getWorldPosition(new V3()); tT.lerp(natural, 1 - m.ikW);
      const d = clamp(tT.distanceTo(tS), 0.05, L1 + L2 - 0.002), dir = tT.clone().sub(tS).normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const hint = new V3(0, -1, 0).addScaledVector(f.fwd(new V3()), -0.3).add(f.right(new V3()).multiplyScalar(-0.5));
      const n = hint.addScaledVector(dir, -hint.dot(dir)).normalize();
      tE.copy(tS).addScaledVector(dir, a).addScaledVector(n, h);
      J.shoulderL.parent.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tE.clone().sub(tS).normalize()); J.shoulderL.quaternion.copy(q0.clone().invert().multiply(q1)); J.shoulderL.updateMatrixWorld(true);
      J.shoulderL.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tT.clone().sub(tE).normalize()); J.elbowL.quaternion.copy(q0.clone().invert().multiply(q1)); J.elbowL.updateMatrixWorld(true);
    }
    // 치마 · 페티코트: 다리 각도를 스프링으로 따라 출렁임
    const k = 1 - Math.exp(-dt * 16);
    lag.vL += ((J.hipL.rotation.x - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * k;
    const spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.4, 1.4)), zR = -Math.sin(clamp(lag.R, -1.4, 1.4));
    if (vis) for (const me of m.skirt) {
      const base = me.userData.base, pa = me.geometry.attributes.position, arr = pa.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, -y), wL = clamp(0.5 + x / 0.14, 0, 1), wR = 1 - wL;
        const dz = (wL * zL + wR * zR) * depth * 0.95, out = 1 + (spread * 0.3 + lag.sw * 0.15) * (depth / 0.46);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.3; arr[i + 2] = z * out + dz - lag.sw * 0.12 * depth;
      }
      pa.needsUpdate = true; me.geometry.computeVertexNormals();
    }
    J.chest.updateMatrixWorld(true);
    const sc = f.scale, wv = (v) => clamp(-v * 1.1, -9, 9), wind = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 1.0, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 1.0];
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.05 * sc })), h0 = f.hurt[0], hp = J.hips.getWorldPosition(new V3());
    // 꼬리 자락: 허리 양옆(조금 뒤)에 고정 · 몸 · 다리 · 치마(구)와 충돌
    tails.forEach((cl, i) => {
      const s = i ? -1 : 1;
      for (let q = 0; q < cl.W; q++) { const a = s > 0 ? 0.3 - 0.16 * (q / (cl.W - 1)) : 0.7 + 0.16 * (q / (cl.W - 1)); J.hips.localToWorld(loftAt(beltP, a, 0.3, cl.anchors[q]).multiplyScalar(1.1)); }
      const s1 = hp.clone().add(new V3(0, -0.12 * sc, 0)), s2 = hp.clone().add(new V3(0, -0.28 * sc, 0));
      const caps = [{ a: h0.a, b: h0.b, r: h0.r + 0.04 * sc }, ...legs, { a: s1, b: s1, r: 0.2 * sc }, { a: s2, b: s2, r: 0.31 * sc + lag.sw * 0.04 + spread * 0.05 }];
      cl.len = 0.78 * sc; cl.mesh.visible = vis; cl.step(dt, caps, f.pos.y + 0.02, wind);
      const kk = ((cl.H - 1) * cl.W + 1) * 3, t = m.endTassels[i]; t.position.set((cl.p[kk] + cl.p[kk + 3]) / 2, (cl.p[kk + 1] + cl.p[kk + 4]) / 2 - 0.01, (cl.p[kk + 2] + cl.p[kk + 5]) / 2); t.visible = vis && cl.ok; t.rotation.y = f.yaw + (i ? -1.2 : 1.2);
    });
    // 머리카락 로프 (몸통은 어깨 높이까지만 · 머리는 구 하나)
    const hc = H.localToWorld(tmp2.copy(HC)), capsBody = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.66 + 0.045 * sc }, { a: hc, b: hc, r: 0.106 * sc }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.02 * sc })), { a: hp.clone().add(new V3(0, -0.2 * sc, 0)), b: hp.clone().add(new V3(0, -0.2 * sc, 0)), r: 0.3 * sc }];
    const windV = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6); H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) {
      r.joint.localToWorld(tmp.copy(r.local)); r.view.side.copy(r.sideL).applyQuaternion(hq);
      r.rope.step(dt, tmp, capsBody, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.view.mesh.visible = vis;
    }
    // 얼굴: 무표정 · 웃음/기합 때만 입을 살짝 벌림 / 붉은 눈빛 · 날의 핏빛 (광기 · 기술 중 밝게)
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    const want2 = Math.max(f.riftK || 0, (f.madness || 0) >= 100 ? 0.8 : 0.2); m.glow += (want2 - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.88 + 0.12 * Math.sin(f.G.time * 6);
    M.eyeGlow.opacity = (0.3 + m.glow * 0.6) * pulse; M.edge.opacity = (0.45 + m.glow * 0.55) * pulse; M.blade.emissiveIntensity = 0.8 + m.glow * 2.2; M.gem.emissiveIntensity = 0.8 + m.glow;
    for (const o of extras) if (!m.endTassels.includes(o)) o.visible = vis;
  };
  m.setWeapon = (v) => { scy.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.097;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 판정: 자루 가운데 → 큰 날 가운데 / 궤적: 머리 → 날 끝
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.25)); J.weapon.localToWorld(t.set(0, -0.36, SC.top - 0.08)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, -0.04, SC.top - 0.25)); J.weapon.localToWorld(t.set(0, -0.62, SC.top - 0.3)); };
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, -0.62, SC.top - 0.3)); };
  m.headPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, SC.top)); };
  m.extras = extras;
  return m;
}
