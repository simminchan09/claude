// 레오 폰 아이젠가르트 — 3D 모델 (기술·포즈는 leo.js)
//
// 기본 도형을 쌓지 않고 sculpt.js 의 곡면 도구로 만든다:
//   몸통·팔다리 = 해부학 단면 로프트 위에 판금 갑옷층, 얼굴 = 구를 조각한 하나의 곡면(눈두덩·광대·코·턱),
//   머리카락·수염·털 = 굵기가 줄어드는 가닥 수천 개, 금 장식 = 노멀맵 양각 + 테두리 관.
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Cloth } from '../cloth.js';
import { faceMapper, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, onSurf, strand, spl, lathe, ang, fbm, gauss, smooth, heightToNormal, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 1.05, spineL: 0.23, chestL: 0.32, neckL: 0.1, shW: 0.235, uArm: 0.31, lArm: 0.29, hipW: 0.105, thigh: 0.49, shin: 0.48, headTop: 0.27 };
// 글레이브 치수 (오른손 기준 +Z 방향, m)
export const GL = { butt: -0.95, poleEnd: 0.98, guard: 1.0, bladeStart: 1.06, tip: 2.2, grip2: 0.6 };
export const GOLD = 0xffc24a, FIRE = 0xff6a2a, SHIELD = 0x6ab4ff, ROSE = 0xff5a7a;
const C = (k, fn) => cached('leo:' + k, fn);

/* =====================================================================
   텍스처 (캔버스) — 색 + 높이(→ 노멀맵)를 같은 붓질로 그린다
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1]) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function scroll(g, x, y, r, a0, turns, dir = 1) {
  g.beginPath(); const n = 48;
  for (let i = 0; i <= n; i++) { const t = i / n, rr = r * (1 - t * 0.85), a = a0 + dir * t * turns * TAU; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
}
function leaf(g, x, y, a, s) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); g.quadraticCurveTo(s * 0.5, s * 0.35, 0, 0); g.fill(); g.restore(); }
// 바로크 덩굴 한 묶음: 큰 소용돌이 + 줄기 + 작은 소용돌이 + 잎
function vine(g, x, y, s, flip = 1) {
  scroll(g, x, y, 34 * s, flip > 0 ? Math.PI : 0, 1.25, flip);
  g.beginPath(); g.moveTo(x - flip * 34 * s, y); g.bezierCurveTo(x - flip * 60 * s, y + 40 * s, x - flip * 20 * s, y + 80 * s, x + flip * 30 * s, y + 70 * s); g.stroke();
  scroll(g, x + flip * 30 * s, y + 70 * s, 16 * s, flip > 0 ? -Math.PI / 2 : -Math.PI / 2, 1.1, -flip);
  leaf(g, x - flip * 48 * s, y + 44 * s, flip > 0 ? 2.2 : 0.9, 22 * s); leaf(g, x - flip * 10 * s, y + 82 * s, flip > 0 ? 0.4 : 2.7, 18 * s);
}
function fleur(g, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s, s); g.beginPath();
  g.moveTo(0, -60); g.bezierCurveTo(18, -38, 16, -10, 6, 10); g.lineTo(-6, 10); g.bezierCurveTo(-16, -10, -18, -38, 0, -60);
  g.moveTo(6, 4); g.bezierCurveTo(30, -20, 58, -10, 48, 14); g.bezierCurveTo(42, 28, 26, 22, 30, 10); g.bezierCurveTo(22, 18, 14, 18, 8, 14);
  g.moveTo(-6, 4); g.bezierCurveTo(-30, -20, -58, -10, -48, 14); g.bezierCurveTo(-42, 28, -26, 22, -30, 10); g.bezierCurveTo(-22, 18, -14, 18, -8, 14);
  g.fill(); g.fillRect(-26, 14, 52, 9);
  g.beginPath(); g.moveTo(-5, 23); g.lineTo(5, 23); g.lineTo(3, 48); g.quadraticCurveTo(0, 56, -3, 48); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-12, 23); g.quadraticCurveTo(-30, 30, -24, 44); g.quadraticCurveTo(-14, 36, -6, 23); g.fill();
  g.beginPath(); g.moveTo(12, 23); g.quadraticCurveTo(30, 30, 24, 44); g.quadraticCurveTo(14, 36, 6, 23); g.fill();
  g.restore();
}
function noiseFill(g, w, h, r, n, a, sz = 2) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * a})`; g.fillRect(r() * w, r() * h, sz, sz); } }
// 색 캔버스와 높이 캔버스에 같은 장식을 그린다
function paired(w, h, base, draw, strength = 3) {
  const [c, g] = cv(w, h), [hc, hg] = cv(w, h);
  base(g); hg.fillStyle = '#000'; hg.fillRect(0, 0, w, h);
  g.lineCap = hg.lineCap = 'round'; g.lineJoin = hg.lineJoin = 'round';
  g.save(); g.strokeStyle = g.fillStyle = '#d8b05a'; draw(g, 1); g.restore();
  g.save(); g.globalAlpha = 0.5; g.strokeStyle = g.fillStyle = '#fff2c8'; g.translate(-1, -1.5); draw(g, 0.45); g.restore(); // 위쪽 하이라이트
  hg.save(); hg.filter = 'blur(2.2px)'; hg.strokeStyle = hg.fillStyle = '#fff'; draw(hg, 1.25); hg.restore();
  return { map: tex(c), normalMap: heightToNormal(hc, strength) };
}
const steelBase = (w, h, seed) => (g) => {
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#3b3940'); grd.addColorStop(1, '#25232a'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const r = rng(seed); noiseFill(g, w, h, r, w * 8, 0.05); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${0.012 * r()})`; g.fillRect(0, y, w, 1); }
};
// 일반 갑옷판 (반복): 바로크 덩굴 무늬
function armorTex() {
  const W = 1024;
  return paired(W, W, steelBase(W, W, 7), (g, k) => {
    g.lineWidth = 7 * k;
    const spots = [[180, 150, 1, 1], [700, 230, 1.1, -1], [420, 560, 0.9, 1], [880, 720, -1, 1], [150, 800, 1, -1], [600, 900, 0.8, 1]];
    for (const [x, y, s, f] of spots) for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) vine(g, x + ox, y + oy, Math.abs(s) * 1.5, f);
  });
}
// 가슴판 전용 (u = 둘레, 앞 중앙 = 가로 512): 좌우 대칭 장식
function cuirassTex() {
  const W = 1024, H = 512;
  return paired(W, H, steelBase(W, H, 13), (g, k) => {
    g.lineWidth = 6 * k;
    g.save(); g.lineWidth = 12 * k; g.beginPath(); g.moveTo(0, 12); g.lineTo(W, 12); g.moveTo(0, H - 10); g.lineTo(W, H - 10); g.stroke(); g.restore();
    g.beginPath(); g.moveTo(512, 70); g.lineTo(512, 470); g.stroke();
    for (const f of [-1, 1]) {
      const X = (dx) => 512 + f * dx;
      scroll(g, X(95), 190, 64, f > 0 ? Math.PI : 0, 1.35, f); scroll(g, X(165), 320, 48, f > 0 ? 0 : Math.PI, 1.25, -f); scroll(g, X(60), 400, 34, Math.PI / 2, 1.1, f);
      g.beginPath(); g.moveTo(X(6), 110); g.bezierCurveTo(X(60), 120, X(150), 130, X(160), 190); g.stroke();
      g.beginPath(); g.moveTo(X(30), 250); g.bezierCurveTo(X(80), 270, X(120), 300, X(117), 320); g.stroke();
      g.beginPath(); g.moveTo(X(10), 450); g.bezierCurveTo(X(80), 440, X(200), 420, X(215), 340); g.stroke();
      leaf(g, X(140), 245, f > 0 ? 0.5 : 2.6, 30); leaf(g, X(205), 400, f > 0 ? -0.8 : 3.9, 26); leaf(g, X(40), 330, f > 0 ? 1.3 : 1.8, 22);
      vine(g, X(330), 220, 1.2, f); vine(g, X(420), 340, 1.0, -f); // 옆구리 · 등
    }
    fleur(g, 512, 92, 0.75 * k + 0.25);
  });
}
// 앞치마(타바드): 짙은 천 + 금 자수 + 백합 문장
function tabardTex() {
  const [c, g] = cv(512, 1280);
  g.fillStyle = '#211e26'; g.fillRect(0, 0, 512, 1280);
  for (let y = 0; y < 1280; y += 3) { g.fillStyle = `rgba(255,255,255,${0.014 + 0.01 * Math.sin(y * 0.7)})`; g.fillRect(0, y, 512, 1); }
  noiseFill(g, 512, 1280, rng(3), 9000, 0.05);
  g.strokeStyle = g.fillStyle = '#d4ab52'; g.lineCap = 'round';
  g.lineWidth = 14; g.strokeRect(18, -20, 476, 1260); g.lineWidth = 4; g.strokeRect(44, -20, 424, 1230);
  fleur(g, 256, 860, 2.4); fleur(g, 256, 300, 1.35);
  g.lineWidth = 6; vine(g, 150, 520, 1.1, 1); vine(g, 362, 520, 1.1, -1); scroll(g, 256, 1080, 40, 0, 1.2, 1);
  g.lineWidth = 12; g.beginPath(); g.moveTo(18, 1180); g.lineTo(256, 1270); g.lineTo(494, 1180); g.stroke();
  return tex(c);
}
// 망토: 로열 블루 벨벳 + 아래쪽 금 장식 띠
function capeTex(base) {
  const [c, g] = cv(768, 1536), col = new THREE.Color(base), hexs = (k) => `#${col.clone().multiplyScalar(k).getHexString()}`;
  const grd = g.createLinearGradient(0, 0, 768, 0); grd.addColorStop(0, hexs(0.6)); grd.addColorStop(0.5, hexs(1.1)); grd.addColorStop(1, hexs(0.6));
  g.fillStyle = grd; g.fillRect(0, 0, 768, 1536);
  for (let x = 0; x < 768; x += 2) { g.fillStyle = `rgba(255,255,255,${0.01 + 0.01 * Math.sin(x * 0.37)})`; g.fillRect(x, 0, 1, 1536); }
  noiseFill(g, 768, 1536, rng(11), 16000, 0.04);
  g.strokeStyle = '#c9a24a'; g.fillStyle = '#c9a24a'; g.lineCap = 'round';
  g.lineWidth = 10; g.beginPath(); g.moveTo(0, 1400); g.lineTo(768, 1400); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(0, 1362); g.lineTo(768, 1362); g.stroke();
  for (let i = 0; i < 6; i++) { const x = 64 + i * 128; g.lineWidth = 5; scroll(g, x, 1462, 32, -Math.PI / 2, 1.15, 1); scroll(g, x + 64, 1462, 24, Math.PI / 2, 1.15, -1); }
  g.lineWidth = 7; g.beginPath(); g.moveTo(12, 0); g.lineTo(12, 1536); g.moveTo(756, 0); g.lineTo(756, 1536); g.stroke();
  g.globalAlpha = 0.2; fleur(g, 384, 780, 2.4);
  return tex(c);
}
// 털 결: 짧은 붓질 수천 번 (색 + 높이)
function furTex() {
  const W = 512, [c, g] = cv(W, W), [hc, h] = cv(W, W), r = rng(23);
  g.fillStyle = '#e4e1da'; g.fillRect(0, 0, W, W); h.fillStyle = '#404040'; h.fillRect(0, 0, W, W);
  g.lineCap = h.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = r() * W, y = r() * W, L = 14 + r() * 26, a = (r() - 0.5) * 0.5, w = 1 + r() * 2.2, k = r();
    const x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L, cx = (x + x2) / 2, cy = (y + y2) / 2 + (r() - 0.5) * 6;
    for (const [G, col] of [[g, `rgba(${235 + k * 20 | 0},${232 + k * 20 | 0},${226 + k * 22 | 0},0.55)`], [h, `rgba(255,255,255,${0.25 + k * 0.3})`]]) {
      const oxs = x > W - 50 ? [0, -W] : x < 50 ? [0, W] : [0], oys = y > W - 20 ? [0, -W] : y < 20 ? [0, W] : [0];
      for (const ox of oxs) for (const oy of oys) { G.strokeStyle = col; G.lineWidth = w; G.beginPath(); G.moveTo(x + ox, y + oy); G.quadraticCurveTo(cx + ox, cy + oy, x2 + ox, y2 + oy); G.stroke(); }
    }
    if (i % 4 === 0) { g.fillStyle = 'rgba(150,145,140,0.08)'; g.fillRect(x, y, 3, 3); }
  }
  const map = tex(c); return { map, normalMap: heightToNormal(hc, 2.2) };
}
// 털 카드: 위에서 아래로 퍼지며 끝이 가늘어지는 털 묶음 (투명 배경)
function furCardTex() {
  const W = 256, [c, g] = cv(W, W), r = rng(31); g.clearRect(0, 0, W, W); g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const x0 = W * (0.3 + r() * 0.4), x1 = x0 + (r() - 0.5) * W * 0.7, y1 = W * (0.55 + r() * 0.43), k = 0.82 + r() * 0.18, wd = 1.2 + r() * 2.6;
    const gr = g.createLinearGradient(0, 0, 0, y1); gr.addColorStop(0, `rgba(${255 * k | 0},${252 * k | 0},${246 * k | 0},1)`); gr.addColorStop(0.75, `rgba(${250 * k | 0},${248 * k | 0},${242 * k | 0},0.9)`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = gr; g.lineWidth = wd; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 30, y1 * 0.5, x1, y1); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 머리카락 결: 길이 방향(v)으로 가는 머리칼. alpha=true 면 끝이 투명하게 흩어지는 머리 다발용
function hairTex(alpha) {
  const W = 256, Hh = 512, [c, g] = cv(W, Hh), r = rng(alpha ? 41 : 43);
  if (alpha) g.clearRect(0, 0, W, Hh); else { g.fillStyle = '#c8c9d0'; g.fillRect(0, 0, W, Hh); }
  g.lineCap = 'round';
  for (let i = 0; i < (alpha ? 260 : 420); i++) {
    const x = r() * W, k = 0.78 + r() * 0.22, top = alpha ? Hh * (0.02 + r() * 0.3) : 0, wd = 1 + r() * 2.2, sway = (r() - 0.5) * 14;
    const gr = g.createLinearGradient(0, top, 0, Hh);
    gr.addColorStop(0, alpha ? 'rgba(255,255,255,0)' : `rgba(${242 * k | 0},${242 * k | 0},${248 * k | 0},1)`); gr.addColorStop(alpha ? 0.25 : 0, `rgba(${246 * k | 0},${246 * k | 0},${252 * k | 0},1)`); gr.addColorStop(1, `rgba(${236 * k | 0},${236 * k | 0},${244 * k | 0},1)`);
    g.strokeStyle = gr; g.lineWidth = wd; g.beginPath(); g.moveTo(x, Hh); g.quadraticCurveTo(x + sway, (top + Hh) / 2, x + sway * 0.4, top); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function fullerTex() {
  const [c, g] = cv(256, 1024);
  const grd = g.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#0a1230'); grd.addColorStop(0.5, '#1f3274'); grd.addColorStop(1, '#0a1230'); g.fillStyle = grd; g.fillRect(0, 0, 256, 1024);
  g.strokeStyle = g.fillStyle = '#d4ab52'; g.lineWidth = 7; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) { scroll(g, 80, 120 + i * 190, 42, 0, 1.15, 1); scroll(g, 176, 215 + i * 190, 42, Math.PI, 1.15, -1); }
  g.lineWidth = 10; g.strokeRect(6, 6, 244, 1012);
  return tex(c);
}

// 얼굴 텍스처 (머리 UV: P(az, el)): 따뜻한 피부 · 음영 · 이마 주름 · 위엄 있는 금빛 눈 (공용 paintEye 'stern')
function faceTex() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU;
  g.fillStyle = '#f2d0bc'; g.fillRect(0, 0, W, H);
  const [fx, fy] = P(0, 0.1), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,240,228,0.5)'); gr.addColorStop(0.6, 'rgba(255,228,214,0)'); gr.addColorStop(1, 'rgba(170,110,95,0.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.filter = 'blur(14px)'; g.fillStyle = 'rgba(230,120,110,0.18)'; for (const sd of [-1, 1]) { const [x, y] = P(sd * 0.52, -0.08); g.beginPath(); g.ellipse(x, y, K * 0.15, K * 0.06, 0, 0, TAU); g.fill(); } g.restore();
  g.save(); g.filter = 'blur(9px)'; g.fillStyle = 'rgba(150,80,70,0.3)'; for (const sd of [-1, 1]) { const [x, y] = P(sd * 0.37, 0.16); g.beginPath(); g.ellipse(x, y, K * 0.17, K * 0.06, 0, 0, TAU); g.fill(); } g.restore(); // 눈두덩 그늘
  // 이마 주름 · 미간 주름
  g.strokeStyle = 'rgba(150,90,70,0.35)'; g.lineCap = 'round'; g.lineWidth = 3;
  for (let k = 0; k < 3; k++) { const [x0, y0] = P(-0.42 + k * 0.03, 0.44 + k * 0.07), [x1, y1] = P(0, 0.46 + k * 0.07), [x2, y2] = P(0.42 - k * 0.03, 0.44 + k * 0.07); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1 - 8, x2, y2); g.stroke(); }
  // 코 옆 그늘
  g.save(); g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(160,95,80,0.45)'; g.lineWidth = 5; { const [x0, y0] = P(-0.07, 0.06), [x1, y1] = P(-0.06, -0.12); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 - 6, (y0 + y1) / 2, x1, y1); g.stroke(); } g.restore();
  // 이목구비: 실제 비율 · 무표정 (입은 수염에 가려 그리지 않고, 눈썹은 가닥으로 따로 만든다)
  const M = faceMapper(headPt, HC, [0.082, 0.112, 0.097], W, H);
  paintFace(g, M, { male: true, eyeY: HC.y + 0.0146, browY: HC.y + 0.03, noseY: HC.y - 0.019, mouthY: HC.y - 0.04, lidDrop: 0.12, noBrow: true, noMouth: true, iris: ['#ffe08a', '#d8a030', '#7a4e10', '#3a2608'], pupil: '#1a1006', lash: '#3a2c26' });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* =====================================================================
   얼굴: 구 하나를 조각한다 (방향 d → 머리 로컬 좌표)
   ===================================================================== */
const HC = new V3(0, 0.112, 0.008); // 머리뼈 중심 (머리 관절 기준)
const noseY = spl([[-0.22, 0], [-0.16, 0.12], [-0.11, 0.6], [-0.05, 1.0], [0.0, 0.86], [0.1, 0.48], [0.22, 0.2], [0.32, 0]]);
function headPt(dx, dy, dz, out) {
  const ax = Math.abs(dx), sx = Math.sign(dx), fz = Math.max(0, dz);
  let x = dx * 0.082, y = dy * 0.112, z = dz * 0.097;
  if (dz < 0) z *= 1.07; // 뒤통수
  if (dy > 0.6) y -= (dy - 0.6) * 0.012;
  const low = smooth(0.1, -0.85, dy);
  x *= 1 - 0.24 * low * (1 - 0.25 * fz); // 턱으로 갈수록 좁게
  z += 0.013 * gauss(dy + 0.8, 0.22) * fz * fz; y -= 0.009 * gauss(dy + 0.82, 0.2) * fz; // 각진 턱
  z += 0.006 * gauss(ax - 0.58, 0.16) * gauss(dy + 0.02, 0.14) * (dz > 0 ? 1 : 0); x += sx * 0.004 * gauss(ax - 0.72, 0.15) * gauss(dy, 0.16); // 광대
  z -= 0.004 * gauss(ax - 0.5, 0.15) * gauss(dy + 0.32, 0.12) * fz; // 볼 꺼짐
  z += 0.011 * gauss(dy - 0.3, 0.09) * gauss(ax - 0.28, 0.32) * fz * fz; // 눈썹뼈
  z -= 0.012 * smooth(0.38, 0.92, dy) * fz; // 이마 경사
  z -= 0.004 * gauss(ax - 0.36, 0.13) * gauss(dy - 0.13, 0.09) * fz * fz; // 눈두덩 (그린 눈이 일그러지지 않게 얕게)
  x -= sx * 0.004 * gauss(ax - 0.85, 0.12) * gauss(dy - 0.25, 0.2); // 관자놀이
  // 코: 콧대 → 코끝 → 콧망울
  const nw = 0.05 + 0.05 * smooth(0.1, -0.1, dy);
  z += 0.024 * gauss(dx, nw) * noseY(dy) * fz * fz;
  z += 0.009 * gauss(ax - 0.1, 0.045) * gauss(dy + 0.1, 0.05) * fz;
  // 입술 (콧수염 아래)
  z += 0.005 * gauss(dx, 0.22) * gauss(dy + 0.34, 0.05) * fz; z -= 0.003 * gauss(dy + 0.38, 0.02) * gauss(dx, 0.2) * fz;
  return out.set(HC.x + x, HC.y + y, HC.z + z);
}
const dirOf = (az, el, out = new V3()) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
const headAt = (az, el, off = 0, out = new V3()) => {
  const d = dirOf(az, el), p = headPt(d.x, d.y, d.z, out);
  if (off) { const n = new V3((p.x - HC.x) / 0.0067, (p.y - HC.y) / 0.0125, (p.z - HC.z) / 0.0094).normalize(); p.addScaledVector(n, off); }
  return p;
};

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [];
  const env = envCube(), AT = T('armor', armorTex), CT = T('cuir', cuirassTex), FT = T('fur', furTex);
  const phys = (o) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 0.9; } return mt; };
  const nS = new THREE.Vector2(0.9, 0.9);
  const M = {
    armor: phys({ map: AT.map, normalMap: AT.normalMap, normalScale: nS, metalness: 0.82, roughness: 0.32, clearcoat: 0.45, clearcoatRoughness: 0.28 }),
    cuirass: phys({ map: CT.map, normalMap: CT.normalMap, normalScale: nS, metalness: 0.82, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
    steel: phys({ color: 0x35333b, metalness: 0.8, roughness: 0.3, clearcoat: 0.4 }),
    gold: phys({ color: 0xdcb45c, metalness: 1, roughness: 0.2, clearcoat: 0.3 }),
    under: phys({ color: pal.cloth ?? 0x1c2452, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0x5a6ab8), sheenRoughness: 0.5 }),
    leather: phys({ color: 0x2a201c, roughness: 0.55, clearcoat: 0.2 }),
    crimson: phys({ color: 0x8a0d1c, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xff5060) }),
    ruby: phys({ color: 0x6a0010, emissive: 0xff1430, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.08, clearcoat: 1 }),
    sapphire: phys({ color: 0x06103a, emissive: 0x2a5aff, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.08, clearcoat: 1 }),
    fur: phys({ color: 0xf4f2ec, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 }),
    furCard: phys({ map: T('furCard', furCardTex), alphaTest: 0.38, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.55 }),
    furB: phys({ map: FT.map, normalMap: FT.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 }),
    skin: phys({ color: 0xf0cdb8, emissive: 0x6a4a3c, emissiveIntensity: 0.3, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0xffc8b4) }),
    face: phys({ map: T('face', faceTex), emissiveMap: T('face', faceTex), emissive: 0x5a4640, emissiveIntensity: 1, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0xffc8b4) }),
    hairSolid: phys({ map: T('hairS', () => hairTex(false)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.35 }),
    hair: phys({ map: T('hairA', () => hairTex(true)), alphaTest: 0.35, color: 0xf2f2f6, roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.35 }),
    hairSh: phys({ map: T('hairA', () => hairTex(true)), alphaTest: 0.35, color: 0xc4c6d0, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xe8eaf4), sheenRoughness: 0.4 }),
    white: phys({ color: 0xe6e0d6, roughness: 0.25, clearcoat: 1 }), iris: phys({ color: 0x55788e, roughness: 0.2, clearcoat: 1 }), pupil: phys({ color: 0x050608, roughness: 0.2, clearcoat: 1 }),
    tabard: phys({ map: T('tab', tabardTex), roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color(0x8a7a5a) }),
    blade: phys({ color: 0x5c6372, metalness: 0.8, roughness: 0.2, clearcoat: 0.6, emissive: 0x0b1020, emissiveIntensity: 0.4 }),
    fuller: phys({ map: T('ful', fullerTex), metalness: 0.6, roughness: 0.3, emissive: 0x0a1a5a, emissiveIntensity: 0.45 }),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(24, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, o = {}) => rim(parent, key, loftRing(prof, v, { n: 64, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999));
  // 보석: 매끈한 카보숑 + 금 테
  const gem = (parent, mat, p, rot, r = 0.02) => {
    const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...rot); parent.add(g);
    add(g, C('cab' + r, () => new THREE.SphereGeometry(r, 20, 12)), mat, [0, 0, 0], [0, 0, 0], [1, 1.25, 0.55]);
    add(g, C('bez' + r, () => new THREE.TorusGeometry(r * 1.05, r * 0.2, 6, 28)), M.gold, [0, 0, -r * 0.1], [0, 0, 0], [1, 1.25, 1]);
    return g;
  };
  // 부채꼴 장식판 (팔꿈치·무릎 바깥 날개)
  const fan = () => {
    const sh = new THREE.Shape(); sh.moveTo(0, -0.02);
    for (let i = 0; i <= 5; i++) { const a = -1.2 + (i / 5) * 2.4, r = 0.075, b = a + 0.24; sh.quadraticCurveTo(Math.sin(a + 0.12) * r * 1.12, Math.cos(a + 0.12) * r * 1.12, Math.sin(b) * r * (i === 5 ? 0.3 : 0.86), Math.cos(b) * r * (i === 5 ? 0.3 : 0.86)); }
    sh.lineTo(0, -0.02);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 }); geo.translate(0, 0, -0.003); geo.computeVertexNormals(); return geo;
  };

  /* ---------- 골반 · 허리 · 폴드 · 태셋 · 타바드 ---------- */
  add(J.hips, C('hipcore', () => loft((v) => ({ y: 0.1 - 0.26 * v, rx: 0.165 + 0.02 * v, rzF: 0.125, rzB: 0.13, n: 2.2 }), 32, 8)), M.under);
  const beltP = (v) => ({ y: 0.035 + 0.075 * v, rx: 0.193 + 0.005 * Math.sin(v * Math.PI), rzF: 0.152, rzB: 0.142, n: 2.3 });
  add(J.hips, C('belt', () => loft(beltP, 64, 6, { uvU: 6 })), M.leather);
  lRim(J.hips, 'beltR0', beltP, 0, 0.007); lRim(J.hips, 'beltR1', beltP, 1, 0.007);
  {
    const b = new THREE.Group(); b.position.set(0, 0.072, 0.157); J.hips.add(b);
    const sh = new THREE.Shape(); const w = 0.058, h = 0.05, r = 0.018;
    sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r); sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
    add(b, C('buckle', () => new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 4, curveSegments: 10 })), M.gold);
    gem(b, M.ruby, [0, 0, 0.018], [0, 0, 0], 0.02);
  }
  for (let i = 0; i < 3; i++) {
    const y0 = 0.035 - i * 0.066, P = (v) => ({ y: y0 - 0.085 * v, rx: 0.2 + i * 0.012 + 0.014 * v, rzF: 0.16 + i * 0.012 + 0.016 * v, rzB: 0.15, n: 2.3 });
    add(J.hips, C('fauld' + i, () => loft(P, 40, 6, { a0: 0.24, a1: 0.76, uvU: 1.2, uvV: 0.2 })), M.armor);
    lRim(J.hips, 'fauldR' + i, P, 1, 0.006, { a0: 0.24, a1: 0.76 });
  }
  m.tassets = [];
  for (const s of [-1, 1]) {
    const tas = new THREE.Group(); tas.position.set(s * 0.17, -0.03, 0); tas.rotation.z = s * 0.1; J.hips.add(tas); m.tassets.push(tas);
    const uc = s > 0 ? 0.25 : 0.75;
    for (let i = 0; i < 3; i++) {
      const P = (v) => ({ y: -0.02 - i * 0.1 - 0.13 * v, rx: 0.215 + i * 0.014 + 0.024 * v, rz: 0.17 + i * 0.012 + 0.02 * v, n: 2.2 });
      const mod = (p) => { p.x -= s * 0.17; p.y += 0.03; };
      const o = { a0: uc - 0.095, a1: uc + 0.095, mod };
      add(tas, C(`tas${s}${i}`, () => loft(P, 16, 8, { ...o, uvU: 0.5, uvV: 0.3 })), M.armor);
      rim(tas, `tasR${s}${i}`, loftRing(P, 1, { ...o, n: 16 }), 0.006, false);
    }
  }
  const tabGeo = (L, back) => surf((u, v, p) => { const hw = 0.135 + 0.035 * (1 - v), x = (u - 0.5) * 2 * hw, t = 1 - v; p.set(x, -L * t - 0.08 * t * t * (1 - Math.abs(u - 0.5) * 2), (back ? 1 : -1) * 1.4 * x * x); }, 12, 28);
  const tabF = new THREE.Group(); tabF.position.set(0, 0.035, 0.168); J.hips.add(tabF); add(tabF, C('tabF', () => tabGeo(0.8, false)), M.tabard);
  const tabB = new THREE.Group(); tabB.position.set(0, 0.035, -0.158); J.hips.add(tabB); add(tabB, C('tabB', () => tabGeo(0.68, true)), M.tabard);
  m.tabF = tabF; m.tabB = tabB;

  /* ---------- 배 · 가슴판 · 목가리개 ---------- */
  add(J.spine, C('core', () => loft((v) => ({ y: -0.05 + 0.3 * v, rx: 0.15, rzF: 0.115, rzB: 0.11 }), 24, 4)), M.under);
  for (let i = 0; i < 3; i++) {
    const P = (v) => ({ y: 0.0 + i * 0.075 + 0.095 * v, rx: 0.17 + i * 0.009 - 0.008 * v, rzF: 0.136 + i * 0.008 - 0.006 * v, rzB: 0.122 + i * 0.005, n: 2.3 });
    add(J.spine, C('lame' + i, () => loft(P, 56, 5, { uvU: 3, uvV: 0.25 })), M.armor);
    lRim(J.spine, 'lameR' + i, P, 0, 0.0065);
  }
  const rxS = spl([[0, 0.17], [0.35, 0.205], [0.6, 0.218], [0.85, 0.2], [1, 0.15]]), rzFS = spl([[0, 0.138], [0.35, 0.156], [0.6, 0.166], [0.85, 0.15], [1, 0.115]]), rzBS = spl([[0, 0.126], [0.4, 0.136], [0.7, 0.142], [1, 0.11]]);
  const cuP = (v) => ({ y: -0.02 + 0.37 * v, rx: rxS(v), rzF: rzFS(v), rzB: rzBS(v), n: 2.35 });
  const cuMod = (p, u, v, c, sn) => {
    if (sn <= 0) return; const ax = Math.abs(p.x);
    p.z += (0.02 * gauss(p.x, 0.035) * smooth(0.02, 0.4, v) * (1 - smooth(0.82, 1, v)) + 0.016 * gauss(ax - 0.09, 0.065) * gauss(v - 0.6, 0.2)) * sn;
  };
  const cuF = (u, v, p) => loftAt(cuP, u, v, p, cuMod);
  add(J.chest, C('cuirass', () => loft(cuP, 96, 40, { mod: cuMod })), M.cuirass);
  lRim(J.chest, 'cuR0', cuP, 0, 0.009, { mod: cuMod }); lRim(J.chest, 'cuR1', cuP, 1, 0.008, { mod: cuMod });
  // 가운데 능선 + 양각 소용돌이 (금 관)
  const ctr = new V3(0, 0.16, 0);
  { const pts = []; for (let i = 0; i <= 16; i++) pts.push(onSurf(cuF, 0.5, 0.12 + i * 0.048, 0.004, ctr)); rim(J.chest, 'keel', pts, 0.0055, false); }
  for (const f of [-1, 1]) {
    const sc = (cu, cv0, r, a0, turns, dir, key) => {
      const pts = []; for (let i = 0; i <= 26; i++) { const t = i / 26, rr = r * (1 - t * 0.8), a = a0 + dir * t * turns * TAU; pts.push(onSurf(cuF, 0.5 + f * (cu + Math.cos(a) * rr / 1.15), cv0 + Math.sin(a) * rr / 0.37, 0.004, ctr)); }
      add(J.chest, C(key, () => strand(pts, 0.0055, 0.003, { seg: 52, rad: 6 })), M.gold);
    };
    sc(0.075, 0.66, 0.05, f > 0 ? Math.PI : 0, 1.2, f, 'scA' + f); sc(0.12, 0.38, 0.04, f > 0 ? 0 : Math.PI, 1.1, -f, 'scB' + f);
  }
  const gp = loftAt(cuP, 0.5, 0.56, new V3(), cuMod); m.gem = gem(J.chest, M.ruby, [gp.x, gp.y, gp.z + 0.004], [-0.15, 0, 0], 0.026).children[0];
  for (let i = 0; i < 2; i++) {
    const P = (v) => ({ y: 0.305 + i * 0.045 + 0.055 * v, rx: 0.152 - i * 0.026 - 0.032 * v, rzF: 0.125 - i * 0.02 - 0.03 * v, rzB: 0.115 - i * 0.02 - 0.028 * v, n: 2.1 });
    add(J.chest, C('gorget' + i, () => loft(P, 56, 6, { uvU: 2, uvV: 0.2 })), M.armor); lRim(J.chest, 'gorR' + i, P, 0, 0.006);
  }
  // 붉은 크라바트 (턱 아래)
  add(J.chest, C('cravat', () => surf((u, v, p) => { const x = (u - 0.5) * 0.075 * (1 - 0.55 * v); p.set(x, 0.385 - 0.1 * v, 0.092 + 0.024 * v - 2.2 * x * x + 0.006 * Math.sin(u * Math.PI * 4) * v); }, 12, 10)), M.crimson);

  /* ---------- 흰 털 목도리: 목을 두르는 굵기가 변하는 털 관 + 털 가닥 수천 개 (오른쪽 어깨가 크게) ---------- */
  {
    const fbase = (a, t, p, noisy) => {
      // R: 오른쪽 어깨 위 큰 털뭉치, D: 가슴 오른쪽으로 늘어진 자락
      const [c, s] = ang(a), R = gauss(a - 0.77, 0.12), D = gauss(a - 0.63, 0.07);
      const r = 0.04 + 0.1 * R + 0.06 * D, cx = c * (0.125 + 0.07 * R), cz = s * (0.108 + 0.035 * R + 0.02 * D), cy = 0.36 + 0.035 * R - 0.075 * D;
      const th = t * TAU, rx = Math.cos(th), ry = Math.sin(th);
      p.set(cx + c * rx * r, cy + ry * r * 0.88, cz + s * rx * r);
      if (noisy) { const n = fbm(p.x * 22 + 3, p.y * 22, p.z * 22, 3) - 0.5; const k = 1 + n * 0.55; p.set(cx + c * rx * r * k, cy + ry * r * 0.88 * k, cz + s * rx * r * k); }
      return [cx, cy, cz, r];
    };
    add(J.chest, C('furBody', () => surf((u, v, p) => fbase(v, u, p, true), 32, 140, { closedU: true, uvU: 3, uvV: 28 })), M.furB);
    // 털 카드: 털 묶음을 그린 반투명 판 수백 장을 표면을 따라 아래로 흘러내리게 겹쳐 깐다 (게임에서 쓰는 털 표현)
    const r = rng(5), mt = new THREE.Matrix4(), p = new V3(), col = new THREE.Color();
    const card = C('furCard', () => { const g = new THREE.PlaneGeometry(1, 1, 1, 4); g.translate(0, -0.5, 0); const ps = g.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setZ(i, 0.28 * y * y); } g.computeVertexNormals(); return g; });
    const N = 760, im = new THREE.InstancedMesh(card, M.furCard, N);
    for (let i = 0; i < N; i++) {
      let a, cc; do { a = r(); cc = fbase(a, 0, p, false); } while (r() > cc[3] / 0.14);
      const t = r(); fbase(a, t, p, true);
      const nrm = new V3(p.x - cc[0], p.y - cc[1], p.z - cc[2]).normalize();
      const flow = new V3(0, -1, 0).addScaledVector(nrm, nrm.y).add(new V3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5)); flow.addScaledVector(nrm, -flow.dot(nrm)).normalize();
      if (flow.lengthSq() < 0.5) flow.set(0, -1, 0);
      const side = new V3().crossVectors(nrm, flow).normalize(), yAx = flow.clone().negate(), zAx = new V3().crossVectors(side, yAx).normalize();
      const w = 0.045 + r() * 0.035, L = 0.06 + r() * 0.05;
      mt.makeBasis(side.multiplyScalar(w), yAx.multiplyScalar(L), zAx.multiplyScalar(w)); mt.setPosition(p.clone().addScaledVector(nrm, 0.004 - r() * 0.01)); im.setMatrixAt(i, mt);
      im.setColorAt(i, col.setRGB(0.88 + r() * 0.12, 0.87 + r() * 0.12, 0.85 + r() * 0.12));
    }
    im.castShadow = true; im.receiveShadow = true; J.chest.add(im);
  }

  /* ---------- 어깨 갑옷: 겹친 판(라메) + 말린 금테 ---------- */
  const pauldron = (sh, s, big) => {
    const g = new THREE.Group(); g.position.set(s * 0.012, big ? 0 : -0.03, 0); sh.add(g); if (!big) g.scale.setScalar(0.92); // 오른쪽은 털에 덮이므로 작게
    const lames = big ? [[1.5, 0.5], [0.72, 0.12], [0.34, -0.26], [-0.02, -0.58]] : [[1.5, 0.45], [0.62, 0.04], [0.24, -0.32]];
    lames.forEach(([e1, e0], i) => {
      const R = 0.142 + i * 0.012 + (big ? 0.012 : 0), ry = 0.1 + i * 0.004, cy = 0.03 - i * 0.012, span = i === 0 ? 0.9 : 0.62;
      const fn = (u, v, p) => {
        const ph = (u - 0.5) * 2 * span * Math.PI, e = e0 + (e1 - e0) * v, ce = Math.cos(e), fl = (1 - v) * 0.014 * i;
        p.set(s * (0.01 * i + ce * Math.cos(ph) * R + fl * Math.cos(ph)), cy + Math.sin(e) * ry, ce * Math.sin(ph) * R * 1.03 + fl * Math.sin(ph));
      };
      add(g, C(`pl${s}${big}${i}`, () => surf(fn, 48, 16, { uvU: 1.6, uvV: 0.55 })), M.armor);
      const pts = []; for (let k = 0; k <= 48; k++) { const p = new V3(); fn(k / 48, 0, p); pts.push(p); }
      rim(g, `plR${s}${big}${i}`, pts, i === 0 ? 0.008 : 0.0068, false);
    });
    if (big) {
      // 위로 말려 올라가는 금 장식 (설정화의 왼쪽 어깨)
      for (const [z, h, k] of [[-0.05, 0.13, 1], [0.035, 0.1, 0.8]]) {
        const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18, a = t * 4.2, rr = 0.035 * k * (1 - t * 0.7); pts.push(new V3(s * (0.05 + Math.sin(a) * rr * 0.4), 0.09 + t * h * 0.7 + Math.cos(a) * rr * 0.6 - rr * 0.6, z + Math.sin(a) * rr)); }
        add(g, C(`curl${s}${z}`, () => strand(pts, 0.011 * k, 0.003, { seg: 40, rad: 8 })), M.gold);
      }
      gem(g, M.ruby, [s * 0.14, 0.08, 0], [0, s * Math.PI / 2, 0], 0.018);
    }
  };
  pauldron(J.shoulderR, -1, false); pauldron(J.shoulderL, 1, true);

  /* ---------- 팔: 소매 · 상완갑 · 팔꿈치 컵 · 하완갑 · 종 모양 손목갑 · 쥔 주먹 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    const uaX = spl([[0, 0.064], [0.2, 0.073], [0.55, 0.064], [1, 0.054]]), uaZ = spl([[0, 0.062], [0.2, 0.069], [0.55, 0.062], [1, 0.053]]);
    add(sh, C('uarm', () => loft((v) => ({ y: 0.03 - (DIMS.uArm + 0.03) * v, rx: uaX(v), rz: uaZ(v) }), 28, 16)), M.under);
    const reP = (v) => ({ y: -0.1 - 0.17 * v, rx: 0.074 - 0.008 * v + 0.006 * smooth(0.8, 1, v), rz: 0.071 - 0.008 * v + 0.006 * smooth(0.8, 1, v) });
    add(sh, C('rere', () => loft(reP, 36, 8, { uvU: 1.2, uvV: 0.4 })), M.armor); lRim(sh, 'rereR0', reP, 0, 0.006); lRim(sh, 'rereR1', reP, 1, 0.006);
    add(el, C('couter', () => new THREE.SphereGeometry(0.064, 32, 20, Math.PI, Math.PI)), M.armor, [0, 0.005, -0.004], [0, 0, 0], [1, 1.15, 0.92]);
    add(el, C('couterR', () => new THREE.TorusGeometry(0.064, 0.0055, 6, 48)), M.gold, [0, 0.005, -0.004], [0, 0, 0], [1, 1.15, 1]);
    add(el, C('fan', fan), M.gold, [s * 0.062, 0, -0.02], [0, s * Math.PI / 2, 0], [0.9, 0.9, 1]);
    const vbX = spl([[0, 0.058], [0.25, 0.061], [1, 0.047]]), vbZ = spl([[0, 0.055], [0.25, 0.058], [1, 0.044]]);
    const vbP = (v) => ({ y: -0.03 - 0.19 * v, rx: vbX(v), rz: vbZ(v) });
    add(el, C('vamb', () => loft(vbP, 36, 12, { uvU: 1.2, uvV: 0.4 })), M.armor); lRim(el, 'vambR', vbP, 0, 0.006);
    const cfP = (v) => ({ y: -0.19 - 0.105 * v, rx: 0.05 + 0.026 * v ** 1.6, rz: 0.047 + 0.023 * v ** 1.6 });
    add(el, C('cuff', () => loft(cfP, 40, 8, { uvU: 1.2, uvV: 0.3 })), M.armor); lRim(el, 'cuffR1', cfP, 1, 0.0075); lRim(el, 'cuffR0', cfP, 0.35, 0.0045);
    gem(el, M.ruby, [s * 0.064, -0.245, 0], [0, s * Math.PI / 2, 0], 0.012);
    // 주먹: 손등판 + 말아 쥔 손가락 4개 + 엄지 (창대는 손 관절 아래 0.06 을 지난다)
    add(ha, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.086 * v, rx: 0.025 + 0.004 * Math.sin(v * Math.PI), rz: 0.041 + 0.006 * v, n: 3, cx: s * 0.02 }), 20, 8)), M.steel);
    add(ha, C('knuck' + s, () => loft((v) => ({ y: -0.07 - 0.024 * v, rx: 0.012, rz: 0.046, n: 3, cx: s * 0.044 }), 16, 3)), M.gold);
    for (let k = 0; k < 4; k++) {
      const z = 0.03 - k * 0.02, L = k === 3 ? 0.86 : 1, pts = [];
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * 2.75 * L; pts.push(new V3(s * Math.cos(th) * 0.036 + s * 0.004, -0.062 + Math.sin(th) * 0.036, z)); }
      add(ha, C(`fing${s}${k}`, () => strand(pts, 0.0105, 0.0085, { seg: 18, rad: 10, prof: (v) => 1 + 0.14 * gauss(v - 0.34, 0.07) + 0.1 * gauss(v - 0.68, 0.07) })), M.steel);
    }
    add(ha, C('thumb' + s, () => strand([[s * 0.0, -0.02, 0.038], [-s * 0.012, -0.045, 0.056], [s * 0.004, -0.072, 0.054], [s * 0.022, -0.086, 0.044]], 0.0125, 0.0092, { seg: 16, rad: 10 })), M.steel);
  }

  /* ---------- 다리: 바지 · 허벅지갑 · 무릎 컵 · 정강이갑(종아리) · 사바톤 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const thX = spl([[0, 0.1], [0.3, 0.093], [0.75, 0.077], [1, 0.066]]), thF = spl([[0, 0.1], [0.4, 0.095], [1, 0.068]]), thB = spl([[0, 0.11], [0.35, 0.1], [1, 0.064]]);
    const L = DIMS.thigh + 0.04, thP = (v) => ({ y: 0.04 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh', () => loft(thP, 32, 16)), M.under);
    const cuP2 = (v) => { const y = -0.06 - 0.33 * v, w = (0.04 - y) / L; return { y, rx: thX(w) + 0.014, rzF: thF(w) + 0.016, rzB: thB(w) + 0.014 }; };
    add(hp, C('cuisse', () => loft(cuP2, 28, 12, { a0: 0.27, a1: 0.73, uvU: 0.8, uvV: 0.6 })), M.armor);
    lRim(hp, 'cuisR', cuP2, 1, 0.0065, { a0: 0.27, a1: 0.73 });
    for (const a of [0.27, 0.73]) { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(cuP2, a, i / 10, new V3())); rim(hp, 'cuisS' + a, pts, 0.0055, false); }
    add(kn, C('poleyn', () => new THREE.SphereGeometry(0.07, 32, 20, 0, Math.PI)), M.armor, [0, 0.005, 0.012], [0, 0, 0], [1, 1.12, 0.85]);
    add(kn, C('poleynR', () => new THREE.TorusGeometry(0.07, 0.006, 6, 48)), M.gold, [0, 0.005, 0.012], [0, 0, 0], [1, 1.12, 1]);
    add(kn, C('fan', fan), M.gold, [s * 0.07, 0.01, 0.0], [0, s * Math.PI / 2, 0], [1, 1, 1]);
    const grX = spl([[0, 0.067], [0.3, 0.071], [1, 0.05]]), grF = spl([[0, 0.067], [0.3, 0.064], [1, 0.05]]), grB = spl([[0, 0.068], [0.3, 0.09], [0.6, 0.075], [1, 0.054]]);
    const grP = (v) => ({ y: -0.03 - (DIMS.shin - 0.035) * v, rx: grX(v), rzF: grF(v), rzB: grB(v), n: 2.1 });
    add(kn, C('greave', () => loft(grP, 40, 20, { uvU: 1.2, uvV: 0.7 })), M.armor);
    lRim(kn, 'grR0', grP, 0, 0.007); lRim(kn, 'grR1', grP, 1, 0.006);
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(grP, 0.5, 0.06 + i * 0.075, new V3()).add(new V3(0, 0, 0.003))); rim(kn, 'grRidge', pts, 0.0055, false); }
    // 사바톤: 발등을 덮는 겹판, 뾰족한 앞코, 평평한 바닥
    const sw = spl([[0, 0.0], [0.05, 0.032], [0.18, 0.046], [0.45, 0.05], [0.75, 0.04], [0.92, 0.022], [1, 0.003]]), shh = spl([[0, 0.02], [0.05, 0.065], [0.2, 0.1], [0.4, 0.076], [0.65, 0.046], [0.88, 0.03], [1, 0.006]]);
    const sab = (u, v, p) => { const [c, sn] = ang(u), w = sw(v), h = shh(v), e = 0.7; p.set(Math.sign(c) * Math.abs(c) ** e * w, -0.07 + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2 + 0.012 * smooth(0.85, 1, v), -0.07 + 0.31 * v); };
    add(ft, C('sabaton', () => surf(sab, 36, 28, { closedU: true, uvU: 1, uvV: 0.6 })), M.armor);
    for (const v of [0.42, 0.56, 0.7, 0.82]) { const pts = []; for (let i = 0; i <= 16; i++) { const p = new V3(); sab(0.2 + i / 16 * 0.6, v, p); pts.push(p); } rim(ft, 'sabR' + v, pts, 0.0045, false); }
  }

  /* ---------- 목 · 얼굴 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.15 * v, rx: 0.058 - 0.008 * v, rzF: 0.054, rzB: 0.05 }), 24, 6)), M.skin);
  const H = J.head;
  add(H, C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] })), M.face);
  for (const s of [-1, 1]) {
    // 눈: 흰자 · 홍채 · 동공 · 내리깐 윗눈꺼풀 (날카로운 눈매)
    // 눈은 얼굴 텍스처에 그린다 (faceTex · 공용 paintEye 'stern')
    // 굵은 흰 눈썹 (무표정: 거의 수평)
    for (let k = 0; k < 6; k++) {
      const a0 = s * (0.12 + k * 0.012), pts = [headAt(a0, 0.28 - k * 0.004, 0.003), headAt(s * (0.3 + k * 0.01), 0.3 + k * 0.006, 0.0045), headAt(s * (0.52 + k * 0.006), 0.31 + k * 0.004, 0.003)];
      add(H, C(`brow${s}${k}`, () => strand(pts, 0.0042 - k * 0.0003, 0.0012, { seg: 10, rad: 5 })), M.hairSolid);
    }
  }
  // 수염: 턱을 감싸는 수염 덩어리(조각 곡면) + 결 가닥 + 콧수염
  {
    const top = spl([[0, 0.12], [0.5, -0.2], [1, 0.12]]);
    const bf = (u, v, p) => {
      const az = (u - 0.5) * 3.7, f = gauss(az, 0.7), el0 = top(u), el = el0 + (-1.25 - el0) * v ** 0.9;
      headAt(az, el, 0, p);
      const th = (0.004 + 0.016 * f * v + 0.006 * v) * smooth(0, 0.2, v) * (1 - 0.6 * smooth(0.85, 1, Math.abs(u - 0.5) * 2)) + 0.0015 * Math.sin(az * 60 + v * 4) * v;
      const n = new V3((p.x - HC.x) / 0.0067, (p.y - HC.y) / 0.0125, (p.z - HC.z) / 0.0094).normalize(); p.addScaledVector(n, th + 0.002);
      p.y -= 0.045 * f * v * v; p.z += 0.012 * f * v * v; // 아래로 뾰족하게
    };
    add(H, C('beard', () => surf(bf, 64, 28, { uvU: 4, uvV: 1 })), M.hairSolid);
    const r = rng(17);
    for (let k = 0; k < 46; k++) {
      const u = 0.12 + r() * 0.76, v0 = 0.15 + r() * 0.3, pts = [];
      for (let i = 0; i <= 4; i++) { const p = new V3(); bf(u + (r() - 0.5) * 0.01, Math.min(1, v0 + i * (1 - v0) / 4), p); pts.push(p.addScaledVector(new V3(p.x - HC.x, 0, p.z - HC.z).normalize(), 0.002)); }
      add(H, C('bs' + k, () => strand(pts, 0.007, 0.002, { seg: 12, rad: 5, flat: 0.4 })), k % 3 ? M.hair : M.hairSh);
    }
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const pts = [headAt(s * 0.04, -0.17 + k * 0.01, 0.006), headAt(s * (0.26 + k * 0.03), -0.24 - k * 0.012, 0.009), headAt(s * (0.42 + k * 0.03), -0.4 - k * 0.03, 0.01), headAt(s * (0.46 + k * 0.03), -0.58 - k * 0.04, 0.008)];
      add(H, C(`mus${s}${k}`, () => strand(pts, 0.0085 - k * 0.0012, 0.0015, { seg: 16, rad: 6 })), M.hairSolid);
    }
  }
  // 머리카락: 뒤로 넘긴 두피 덮개(결 홈) + 뒤로 흘러 어깨까지 내려오는 긴 가닥 + 옆머리
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.12 + 0.5 * w * w : 0.12 - 0.92 * w * w; };
    const cap = (u, v, p) => {
      const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v;
      const th = 0.004 + 0.012 * smooth(0, 0.35, v) + 0.006 * Math.max(0, -Math.cos(az)) + 0.0022 * Math.abs(Math.sin(az * 15 + v * 1.5));
      headAt(az, el, th, p);
    };
    add(H, C('hairCap', () => surf(cap, 96, 26, { closedU: true, poles: [26], uvU: 10, uvV: 1 })), M.hairSolid);
    const r = rng(9);
    // 뒤로 넘긴 결 (이마선에서 정수리를 넘어 뒤통수까지)
    for (let k = 0; k < 22; k++) {
      const az = (r() - 0.5) * 1.6, e0 = line(az) + 0.04, pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(headAt(az * (1 - t * 0.3), e0 + t * (Math.PI - 0.72 - e0), 0.016 + 0.004 * Math.sin(t * Math.PI))); }
      add(H, C('hs' + k, () => strand(pts, 0.011, 0.007, { seg: 18, rad: 6, ref: [0, 1, -0.3], flat: 0.3 })), M.hairSolid);
    }
    // 긴 가닥: 뒤통수 → 목 뒤 → 등 (어깨 아래까지)
    for (let k = 0; k < 34; k++) {
      const az = Math.PI + (r() - 0.5) * 3.4, el = line(az) + 0.25 + r() * 0.5, p0 = headAt(az, Math.min(1.1, el), 0.012);
      const sx = Math.sin(az), spread = sx * (0.06 + r() * 0.05), len = 0.3 + r() * 0.12;
      const pts = [p0, new V3(p0.x * 1.15 + spread * 0.2, 0.02, -0.105 - r() * 0.02), new V3(p0.x * 1.1 + spread * 0.6, -0.1, -0.16 - r() * 0.02), new V3(p0.x + spread, -0.08 - len * 0.75, -0.2 - r() * 0.02)];
      add(H, C('hl' + k, () => strand(pts, 0.019, 0.006, { seg: 22, rad: 6, ref: [0, 0, -1], flat: 0.28 })), k % 3 ? M.hair : M.hairSh);
    }
    // 옆머리: 관자놀이에서 귀를 덮고 어깨 앞으로
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
      const p0 = headAt(s * (1.25 + k * 0.08), 0.35 - k * 0.03, 0.012), pts = [p0, headAt(s * (1.45 + k * 0.06), -0.1, 0.022), new V3(s * (0.11 + k * 0.008), -0.06, -0.01 - k * 0.012), new V3(s * (0.12 + k * 0.012), -0.22 - k * 0.02, -0.02 - k * 0.012)];
      add(H, C(`hside${s}${k}`, () => strand(pts, 0.017, 0.005, { seg: 20, rad: 6, ref: [s, 0, 0], flat: 0.3 })), k % 2 ? M.hairSh : M.hair);
    }
  }
  // 왕관: 뾰족한 테를 한 장의 곡면으로 + 위 테두리 관 + 보석
  {
    const crown = new THREE.Group(); crown.position.set(0, 0.188, -0.004); crown.rotation.x = -0.2; H.add(crown);
    const peaks = 9, hgt = (u) => { let h = 0.026; for (let i = 0; i < peaks; i++) { let d = Math.abs(u - (i / peaks + 0.5 / peaks * 0 + 0.5) % 1); d = Math.min(d, 1 - d); const pk = i % 2 === 0 ? 0.058 : 0.036; h += pk * Math.max(0, 1 - d / 0.04) ** 1.8; } return h; };
    const band = (u, v, p) => { const [c, sn] = ang(u), k = 1 + 0.12 * v * (hgt(u) / 0.1); p.set(c * 0.083 * k, v * hgt(u), sn * (sn > 0 ? 0.093 : 0.1) * k); };
    add(crown, C('crown', () => surf(band, 216, 6, { closedU: true })), M.gold);
    { const pts = []; for (let i = 0; i < 216; i++) { const p = new V3(); band(i / 216, 1, p); pts.push(p); } rim(crown, 'crownTop', pts, 0.0032, true); }
    { const pts = []; for (let i = 0; i < 72; i++) { const p = new V3(); band(i / 72, 0, p); pts.push(p); } rim(crown, 'crownBot', pts, 0.0058, true); }
    for (let i = 0; i < peaks; i++) {
      const u = (i / peaks + 0.5) % 1, [c, sn] = ang(u), tip = new V3(); band(u, 1, tip);
      if (i % 2 === 0) add(crown, C('ball', () => new THREE.SphereGeometry(0.0085, 20, 14)), M.gold, [tip.x, tip.y + 0.006, tip.z]);
      const um = (u + 0.5 / peaks) % 1, [c2, s2] = ang(um), gp2 = new V3(); band(um, 0.5, gp2);
      gem(crown, i % 3 === 0 ? M.ruby : M.sapphire, [gp2.x * 1.04, 0.016, gp2.z * 1.04], [0, Math.atan2(c2, s2), 0], 0.0085);
    }
  }

  /* ---------- 글레이브 ---------- */
  const glaive = new THREE.Group(); J.weapon.add(glaive); m.glaive = glaive;
  buildGlaive(glaive, M, add);

  /* ---------- 망토 (천 시뮬레이션) ---------- */
  const capeMat = phys({ map: T('cape' + (pal.cape ?? 0x1c2a6a), () => capeTex(pal.cape ?? 0x1c2a6a)), roughness: 0.75, sheen: 1, sheenColor: new THREE.Color(0x6a7ad8), sheenRoughness: 0.45 });
  let cloth = null;
  m.extras = extras;
  m.attachScene = (scene) => { if (cloth) return; cloth = new Cloth(scene, 13, 22, 1.58, capeMat); extras.push(cloth.mesh); };
  m.dispose = (scene) => { if (cloth) { scene.remove(cloth.mesh); cloth.mesh.geometry.dispose(); cloth = null; } };
  m.resetCloth = () => { if (cloth) cloth.ok = false; };

  /* ---------- 매 프레임: 왼손 IK · 망토 · 타바드 ---------- */
  const tS = new V3(), tT = new V3(), tE = new V3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), dn = new V3(0, -1, 0);
  m.ikW = 1;
  m.update = (dt, f) => {
    // 왼손은 창대를 잡는다 (기술마다 ikOff 로 끌 수 있음)
    const want = m.weaponOut ? 0 : f.state === 'act' ? (f.act.ikOff ? 0 : 1) : f.state === 'guard' ? 1 : 0;
    m.ikW += (want - m.ikW) * Math.min(1, dt * 14);
    if (m.ikW > 0.02) {
      J.chest.updateMatrixWorld(true); J.weapon.updateMatrixWorld(true);
      J.shoulderL.getWorldPosition(tS); J.weapon.localToWorld(tT.set(0, 0, GL.grip2));
      const sc = f.scale, L1 = DIMS.uArm * sc, L2 = DIMS.lArm * sc;
      const natural = J.handL.getWorldPosition(new V3()); tT.lerp(natural, 1 - m.ikW);
      const d = clamp(tT.distanceTo(tS), 0.05, L1 + L2 - 0.002), dir = tT.clone().sub(tS).normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const fw = f.fwd(new V3()), hint = new V3(0, -1, 0).addScaledVector(fw, -0.3).add(f.right(new V3()).multiplyScalar(-0.5));
      const n = hint.addScaledVector(dir, -hint.dot(dir)).normalize();
      tE.copy(tS).addScaledVector(dir, a).addScaledVector(n, h);
      J.shoulderL.parent.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tE.clone().sub(tS).normalize()); J.shoulderL.quaternion.copy(q0.clone().invert().multiply(q1));
      J.shoulderL.updateMatrixWorld(true);
      J.shoulderL.getWorldQuaternion(q0); q1.setFromUnitVectors(dn, tT.clone().sub(tE).normalize()); J.elbowL.quaternion.copy(q0.clone().invert().multiply(q1));
      J.elbowL.updateMatrixWorld(true);
    }
    const lift = Math.min(J.hipL.rotation.x, J.hipR.rotation.x);
    m.tabF.rotation.x = Math.min(0, lift) * 0.85 - Math.abs(f.vel.x + f.vel.z) * 0.004; m.tabB.rotation.x = Math.max(0, Math.max(J.hipL.rotation.x, J.hipR.rotation.x)) * 0.6 + 0.05;
    for (const t of m.tassets) t.rotation.x = Math.min(0, lift) * 0.4;
    if (cloth) {
      cloth.mesh.visible = f.root.visible;
      J.chest.updateMatrixWorld(true);
      const W = cloth.W;
      for (let i = 0; i < W; i++) {
        const u = i / (W - 1) - 0.5, edge = Math.abs(u) > 0.44;
        J.chest.localToWorld(cloth.anchors[i].set(u * (edge ? 0.62 : 0.54), DIMS.chestL - 0.01 + (edge ? 0.02 : 0), -0.15 - Math.cos(u * Math.PI) * 0.05 + (edge ? 0.06 : 0)));
      }
      const caps = f.hurt.filter((_, i) => i === 0 || i >= 6).map((c, i) => ({ a: c.a, b: c.b, r: c.r + (i === 0 ? 0.07 : 0.05) * f.scale }));
      const wv = (v) => clamp(-v * 1.1, -9, 9), w = [wv(f.vel.x) + Math.sin(f.G.time * 1.3) * 1.2, 0, wv(f.vel.z) + Math.cos(f.G.time * 1.1) * 1.2];
      cloth.len = 1.58 * f.scale; cloth.step(dt, caps, f.pos.y + 0.02, w);
    }
    if (m.gem) m.gem.material.emissiveIntensity = 0.8 + 0.3 * Math.sin(f.G.time * 3);
  };
  m.setWeapon = (v) => { m.glaive.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.07;
  // 무기 방향: 포즈의 weapon 값은 손목 회전이 아니라 [피치(위+), 좌우(오른쪽+), 롤] — 몸(루트) 기준 창끝 방향.
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 판정: 자루 앞부분부터 날 끝까지 / 궤적: 칼날만
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.25)); J.weapon.localToWorld(t.set(0, 0, GL.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, GL.bladeStart)); J.weapon.localToWorld(t.set(0, 0, GL.tip)); };
  return m;
}

/* =====================================================================
   글레이브: 금 띠 자루 · 가죽 감개 · 말린 금 코등이 · 날 끝이 얇아지는 넓은 칼날 · 뒤끝 창날
   ===================================================================== */
function buildGlaive(g, M, add) {
  const pole = GL.poleEnd - GL.butt, X = [Math.PI / 2, 0, 0];
  add(g, C('gl:pole', () => new THREE.CylinderGeometry(0.02, 0.02, pole, 28, 1, true)), M.steel, [0, 0, (GL.poleEnd + GL.butt) / 2], X);
  const band = C('gl:band', () => lathe([[0.0198, -0.024], [0.025, -0.02], [0.028, -0.012], [0.0275, 0], [0.028, 0.012], [0.025, 0.02], [0.0198, 0.024]], 36));
  for (const z of [GL.butt + 0.07, -0.55, -0.17, 0.17, 0.48, 0.78]) add(g, band, M.gold, [0, 0, z], X);
  // 가죽 감개 (나선)
  add(g, C('gl:wrap', () => { const pts = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * TAU * 11; pts.push(new V3(Math.cos(a) * 0.0212, Math.sin(a) * 0.0212, -0.14 + 0.28 * t)); } return strand(pts, 0.0042, 0.0042, { seg: 220, rad: 5 }); }), M.leather);
  // 뒤끝: 금 깍지 + 잎 모양 창날
  add(g, C('gl:buttCap', () => lathe([[0.0198, 0.03], [0.026, 0.02], [0.03, 0.0], [0.026, -0.03], [0.014, -0.05], [0.008, -0.056]], 36)), M.gold, [0, 0, GL.butt], X);
  const leafBlade = (len, w) => {
    const sh = new THREE.Shape(); sh.moveTo(-w * 0.4, 0); sh.quadraticCurveTo(-w * 1.15, len * 0.3, -w * 0.2, len * 0.82); sh.quadraticCurveTo(0, len * 0.95, 0, len); sh.quadraticCurveTo(0, len * 0.95, w * 0.2, len * 0.82); sh.quadraticCurveTo(w * 1.15, len * 0.3, w * 0.4, 0); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3, curveSegments: 20 });
    geo.translate(0, 0, -0.006); geo.rotateX(Math.PI / 2);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const ax = Math.abs(p.getX(i)) / w; p.setY(i, p.getY(i) * clamp(1.2 - ax * 1.1, 0.15, 1)); }
    geo.computeVertexNormals(); return geo;
  };
  add(g, C('gl:buttBlade', () => leafBlade(0.2, 0.04)), M.blade, [0, 0, GL.butt - 0.05], [0, Math.PI, 0]);
  // 날밑 소켓 + 말린 금 코등이
  const gz = GL.guard;
  add(g, C('gl:socket', () => lathe([[0.0198, -0.07], [0.024, -0.05], [0.03, -0.02], [0.036, 0.0], [0.034, 0.03], [0.026, 0.06], [0.022, 0.075]], 36)), M.gold, [0, 0, gz], X);
  for (const s of [-1, 1]) {
    add(g, C('gl:arm' + s, () => strand([[s * 0.025, 0, gz - 0.01], [s * 0.08, 0, gz - 0.012], [s * 0.135, 0, gz + 0.01], [s * 0.16, 0, gz + 0.055], [s * 0.14, 0, gz + 0.085], [s * 0.115, 0, gz + 0.07], [s * 0.12, 0, gz + 0.05]], 0.015, 0.004, { seg: 48, rad: 10, flat: 0.75 })), M.gold);
    add(g, C('gl:arm2' + s, () => strand([[s * 0.03, 0, gz - 0.02], [s * 0.07, 0, gz - 0.045], [s * 0.085, 0, gz - 0.075], [s * 0.065, 0, gz - 0.085], [s * 0.058, 0, gz - 0.07]], 0.009, 0.003, { seg: 32, rad: 8, flat: 0.75 })), M.gold);
    const sg = new THREE.Group(); sg.position.set(s * 0.06, 0.012, gz - 0.008); sg.rotation.x = -Math.PI / 2; g.add(sg);
    add(sg, C('cab0.014', () => new THREE.SphereGeometry(0.014, 28, 18)), M.sapphire, [0, 0, 0], [0, 0, 0], [1, 1, 0.55]);
  }
  { const rg = new THREE.Group(); rg.position.set(0, 0.03, gz + 0.012); rg.rotation.x = -Math.PI / 2; g.add(rg); add(rg, C('cab0.022', () => new THREE.SphereGeometry(0.022, 28, 18)), M.ruby, [0, 0, 0], [0, 0, 0], [0.8, 1.3, 0.55]); add(rg, C('bez0.022', () => new THREE.TorusGeometry(0.023, 0.0045, 10, 36)), M.gold, [0, 0, -0.002], [0, 0, 0], [0.8, 1.3, 1]); }
  // 칼날: 넓은 몸체 + 뒤쪽 가시, 가장자리로 갈수록 얇아짐 (날 선 느낌)
  const L = GL.tip - GL.bladeStart, sh = new THREE.Shape();
  sh.moveTo(-0.095, 0); sh.quadraticCurveTo(-0.11, 0.05, -0.17, 0.115); sh.quadraticCurveTo(-0.13, 0.14, -0.118, 0.19); sh.quadraticCurveTo(-0.125, L * 0.5, -0.11, L * 0.7); sh.quadraticCurveTo(-0.085, L * 0.9, 0, L);
  sh.quadraticCurveTo(0.07, L * 0.88, 0.112, L * 0.62); sh.quadraticCurveTo(0.122, 0.3, 0.118, 0.2); sh.quadraticCurveTo(0.13, 0.15, 0.158, 0.13); sh.quadraticCurveTo(0.11, 0.07, 0.095, 0); sh.closePath();
  const ex = (shape, depth, bevel, thin) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 20 }); geo.translate(0, 0, -depth / 2); geo.rotateX(Math.PI / 2);
    if (thin) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const ax = Math.abs(p.getX(i)) / 0.125, tz = p.getZ(i) / L; p.setY(i, p.getY(i) * clamp(1.25 - ax * 1.05 - Math.max(0, tz - 0.8) * 2.5, 0.16, 1)); } }
    geo.computeVertexNormals(); return geo;
  };
  const outer = add(g, C('gl:bladeO', () => ex(sh, 0.012, 0.006, true)), M.gold, [0, 0, GL.bladeStart - 0.004]); outer.scale.set(1.06, 0.9, 1.01);
  const blade = add(g, C('gl:blade', () => ex(sh, 0.02, 0.005, true)), M.blade, [0, 0, GL.bladeStart]);
  const fs = new THREE.Shape(); fs.moveTo(-0.052, 0.2); fs.lineTo(-0.058, L * 0.6); fs.quadraticCurveTo(-0.04, L * 0.8, 0, L * 0.86); fs.quadraticCurveTo(0.04, L * 0.8, 0.058, L * 0.6); fs.lineTo(0.052, 0.2); fs.quadraticCurveTo(0, 0.16, -0.052, 0.2);
  // 풀러: 칼날 두께 곡면을 그대로 따라 붙인다 (양면)
  for (const s of [-1, 1]) add(g, C('gl:fuller' + s, () => {
    const geo = new THREE.ShapeGeometry(fs, 24), uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.06) / 0.12, pos.getY(i) / (L * 0.86));
    geo.rotateX(Math.PI / 2);
    for (let i = 0; i < pos.count; i++) { const ax = Math.abs(pos.getX(i)) / 0.125, tz = pos.getZ(i) / L; pos.setY(i, s * (0.015 * clamp(1.25 - ax * 1.05 - Math.max(0, tz - 0.8) * 2.5, 0.16, 1) + 0.0007)); }
    geo.computeVertexNormals(); return geo;
  }), M.fuller, [0, 0, GL.bladeStart]);
  return blade;
}
