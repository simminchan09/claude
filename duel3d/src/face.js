// 공용 얼굴: 얼굴형 조각 + 실제 사람 비율로 그리는 이목구비 (무표정)
//
//   animeHead(o) → { HC, HR, headPt, headN, headAt, dirOf, L }
//     headPt(dx, dy, dz, out): 단위 방향 → 머리 로컬 좌표.  head 곡면은 (u, v) → az = (u − 0.5)·2π, el = −π/2 + v·π 로 만든다.
//     L: 이목구비 높이(dy) — eye · brow · nose(코 밑) · mouth.  기하(콧대·입술 돌출)와 그림이 같은 자리에 오게 공유한다.
//   faceMapper(headPt, HC, HR) → M(x, y): 앞얼굴 위의 점(머리 로컬 m)을 머리 UV 캔버스 좌표로 바꾼다
//   paintFace(g, M, o): 눈썹 · 눈 · 코 · 입을 미터 단위로 그린다
//
// 비율 (실제 사람 기준):
//   눈은 머리 꼭대기 ~ 턱의 중간 · 눈 폭 ≈ 2.7~3.0cm · 두 눈 사이 = 눈 하나 · 홍채 지름 ≈ 1.15cm (윗눈꺼풀이 위를 조금 덮음)
//   눈썹 ~ 코 밑 = 코 밑 ~ 턱 · 입은 코 밑과 턱 사이의 위쪽 1/3 · 입 폭 ≈ 두 눈동자 사이
import * as THREE from 'three';
import { gauss, smooth, spl } from './sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const dirOf = (az, el, out = new V3()) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

// 코 높이 윤곽 (dy 기준: 미간 → 콧대 → 코끝 → 코 밑에서 뚝 떨어짐)
const NOSE = spl([[-0.46, 0], [-0.41, 0.2], [-0.37, 0.85], [-0.34, 1], [-0.26, 0.72], [-0.12, 0.42], [0.02, 0.2], [0.12, 0]]);

export function animeHead(o = {}) {
  const HC = o.C || new V3(0, 0.103, 0.006), HR = o.R || [0.072, 0.101, 0.09];
  const square = o.square ?? 0.5, jaw = o.jaw ?? 0.3, jaw0 = o.jaw0 ?? 0.22, chin = o.chin ?? 0.008, socket = o.socket ?? 0.003, nose = o.nose ?? 1, cheek = o.cheek ?? 0.004, brow = o.brow ?? 0.0025, lips = o.lips ?? 1, short = o.short ?? 0.08;
  const L = { eye: 0.04, brow: 0.19, nose: -0.375, mouth: -0.58, eyeAx: 0.43 };
  function headPt(dx, dy, dz, out) {
    const ax = Math.abs(dx), fz = Math.max(0, dz), bz = Math.max(0, -dz), low = smooth(-0.05, -0.95, dy);
    const h = Math.hypot(dx, dz) || 1e-6, cx = dx / h, cz = dz / h, n = 2 + square * (1 - low), sq = Math.pow(Math.pow(Math.abs(cx), n) + Math.pow(Math.abs(cz), n), -1 / n);
    let x = dx * sq * HR[0] * 0.97, y = dy * HR[1] * (1 - short * low), z = dz * sq * HR[2];
    z *= 1 + 0.1 * bz * smooth(-0.5, 0.4, dy);                                  // 뒤통수
    z *= 1 - 0.06 * fz * fz * (1 - low);                                         // 앞얼굴
    x *= 1 - low * (jaw0 + jaw * fz);                                            // 턱선
    z *= 1 - 0.36 * low * bz; y += 0.02 * low * bz * bz; z -= 0.01 * low * low * (1 - fz);
    x *= 1 + 0.1 * gauss(dy + 0.92, 0.12) * fz;                                  // 둥근 턱끝
    z += chin * gauss(dy + 0.86, 0.15) * Math.pow(fz, 3);
    z += cheek * gauss(ax - 0.52, 0.2) * gauss(dy + 0.16, 0.2) * fz;               // 광대
    z -= socket * gauss(ax - L.eyeAx, 0.15) * gauss(dy - L.eye, 0.1) * fz;          // 눈두덩
    z += brow * gauss(ax - 0.38, 0.25) * gauss(dy - L.brow, 0.07) * fz;            // 눈썹뼈
    // 코: 미간에서 시작해 코끝(코 밑 바로 위)에서 가장 높고, 콧방울이 양옆에
    z += nose * 0.013 * gauss(dx, 0.028 + 0.03 * smooth(-0.1, -0.35, dy)) * NOSE(dy) * Math.pow(fz, 3);
    z += nose * 0.004 * gauss(ax - 0.1, 0.035) * gauss(dy + 0.36, 0.035) * fz;
    // 입술: 윗입술 · 입 선 · 아랫입술 · 인중
    z += lips * (0.0028 * gauss(dy - L.mouth - 0.035, 0.03) + 0.0032 * gauss(dy - L.mouth + 0.04, 0.035) - 0.001 * gauss(dy - L.mouth, 0.01)) * gauss(dx, 0.17) * fz;
    z -= lips * 0.0008 * gauss(dx, 0.02) * gauss(dy - (L.mouth + L.nose) / 2, 0.06) * fz;
    return out.set(HC.x + x, HC.y + y, HC.z + z);
  }
  const headN = (p) => new V3((p.x - HC.x) / (HR[0] * HR[0]), (p.y - HC.y) / (HR[1] * HR[1]), (p.z - HC.z) / (HR[2] * HR[2])).normalize();
  const headAt = (az, el, off = 0, out = new V3()) => { const d = dirOf(az, el), p = headPt(d.x, d.y, d.z, out); if (off) p.addScaledVector(headN(p), off); return p; };
  return { HC, HR, headPt, headN, headAt, dirOf, L };
}

// 앞얼굴 위 점 (x, y) → 캔버스 좌표.  W×H 캔버스, P(az, el) = [(az/2π + 0.5)·W, (0.5 − el/π)·H]
export function faceMapper(headPt, HC, HR, W = 2048, H = 1024) {
  const p = new V3(), d = new V3();
  const M = (x, y) => {
    let el = Math.asin(Math.max(-0.99, Math.min(0.99, (y - HC.y) / HR[1]))), az = Math.asin(Math.max(-0.99, Math.min(0.99, (x - HC.x) / HR[0])));
    for (let i = 0; i < 10; i++) { dirOf(az, el, d); headPt(d.x, d.y, d.z, p); el += ((y - p.y) / HR[1]) * 0.9; az += ((x - p.x) / (HR[0] * Math.max(0.3, Math.cos(el)))) * 0.9; }
    return [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H];
  };
  // 높이 dy (정면) → 머리 로컬 y
  M.yAt = (dy) => { headPt(0, dy, Math.sqrt(Math.max(0, 1 - dy * dy)), p); return p.y; };
  return M;
}

// 미터 좌표 경로 → 캔버스 경로 (베지어를 잘게 나눠 곡면 왜곡을 그대로 따른다)
const bez = (a, b, c, e, t) => { const u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1]]; };
function trace(M, segs, n = 14) { const pts = []; for (const [a, b, c, e] of segs) for (let i = pts.length ? 1 : 0; i <= n; i++) pts.push(M(...bez(a, b, c, e, i / n))); return pts; }
function path(pts, close) { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); return p; }
const ell = (M, cx, cy, rx, ry, n = 36) => { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push(M(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)); } return path(pts, true); };

// o: { eyeY, browY, noseY, mouthY, ipd, eyeW, eyeH, iris, irisD, pupil, lash, brow, browW, lip, male, tilt, noMouth, noBrow, open, glow, lidDrop }
export function paintFace(g, M, o) {
  const male = !!o.male, ipd = o.ipd ?? (male ? 0.064 : 0.06), ew = o.eyeW ?? (male ? 0.029 : 0.028), eh = o.eyeH ?? (male ? 0.0095 : 0.0115), irD = o.irisD ?? 0.0116, tilt = o.tilt ?? 0, drop = o.lidDrop ?? 0;
  const [c0, c1, c2, rim] = o.iris || ['#e8b060', '#a8682a', '#4a2a10', '#2a160a'], ink = o.lash || '#2a1a14';
  const px = (m) => Math.abs(M(m, o.eyeY)[0] - M(0, o.eyeY)[0]); // 미터 → 픽셀 (가로)
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const sd of [-1, 1]) {
    const ex = sd * ipd / 2, ey = o.eyeY, inX = ex - sd * ew * 0.5, outX = ex + sd * ew * 0.5, t = tilt * ew; // tilt: 눈꼬리 높이 (+ 올라감)
    const inn = [inX, ey - eh * 0.08], out = [outX, ey + t * 0.5 + eh * 0.02];
    const upPk = ey + eh * (0.55 - drop);
    const upper = [[inn, [inX + sd * ew * 0.12, ey + eh * 0.42], [ex - sd * ew * 0.05, upPk], [ex + sd * ew * 0.12, upPk - eh * 0.04]], [[ex + sd * ew * 0.12, upPk - eh * 0.04], [ex + sd * ew * 0.3, upPk - eh * 0.1], [outX - sd * ew * 0.04, out[1] + eh * 0.2], out]];
    const lower = [[out, [ex + sd * ew * 0.28, ey - eh * 0.42], [ex - sd * ew * 0.15, ey - eh * 0.48], inn]];
    const up = trace(M, upper), lo = trace(M, lower), eye = path([...up, ...lo.slice(1)], true);
    if (!o.glow) {
      // 눈두덩 그늘 · 쌍꺼풀 선
      g.save(); g.filter = 'blur(8px)'; g.fillStyle = 'rgba(150,90,80,0.22)'; g.fill(ell(M, ex, ey + eh * 0.6, ew * 0.62, eh * 0.75)); g.restore();
      g.strokeStyle = 'rgba(130,75,60,0.42)'; g.lineWidth = 2; g.stroke(path(trace(M, [[[inX + sd * ew * 0.18, ey + eh * 0.62], [ex - sd * ew * 0.05, upPk + eh * 0.42], [ex + sd * ew * 0.25, upPk + eh * 0.3], [outX - sd * ew * 0.05, out[1] + eh * 0.45]]])));
    }
    g.save(); g.clip(eye);
    if (!o.glow) { const [sx0, sy0] = M(ex, ey + eh), [, sy1] = M(ex, ey - eh); const sc = g.createLinearGradient(0, sy0, 0, sy1); sc.addColorStop(0, '#c8c0c4'); sc.addColorStop(0.45, '#f4f0f0'); sc.addColorStop(1, '#faf8f6'); g.fillStyle = sc; g.fillRect(sx0 - px(ew), sy0 - 10, px(ew) * 2, sy1 - sy0 + 20); }
    // 홍채 · 동공 (윗눈꺼풀이 위를 조금 덮음)
    const ix = ex + sd * ew * 0.02, iy = ey - eh * 0.04, ir = irD / 2, [cxp, cyp] = M(ix, iy), [, ytop] = M(ix, iy + ir), [, ybot] = M(ix, iy - ir);
    const ig = g.createLinearGradient(0, ytop, 0, ybot); ig.addColorStop(0, c2); ig.addColorStop(0.45, c1); ig.addColorStop(1, c0);
    g.fillStyle = ig; g.fill(ell(M, ix, iy, ir, ir));
    if (!o.glow) {
      g.strokeStyle = rim; g.lineWidth = 2.5; g.stroke(ell(M, ix, iy, ir, ir));
      g.fillStyle = o.pupil || '#120806'; g.fill(ell(M, ix, iy, ir * 0.36, ir * 0.36));
      const sh = g.createLinearGradient(0, ytop - 6, 0, cyp); sh.addColorStop(0, 'rgba(20,10,8,0.55)'); sh.addColorStop(1, 'rgba(20,10,8,0)'); g.fillStyle = sh; g.fillRect(cxp - px(ew), ytop - 30, px(ew) * 2, cyp - ytop + 30);
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.fill(ell(M, ix - sd * ir * 0.38, iy + ir * 0.36, ir * 0.2, ir * 0.17));
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fill(ell(M, ix + sd * ir * 0.35, iy - ir * 0.4, ir * 0.1, ir * 0.08));
    }
    g.restore();
    if (o.glow) continue;
    // 속눈썹: 윗선은 진하게 (눈꼬리 쪽이 조금 두꺼움), 아랫선은 옅게 · 눈머리 분홍
    g.strokeStyle = ink; g.lineWidth = male ? 4.5 : 5.5; g.stroke(path(up));
    g.lineWidth = male ? 5.5 : 7.5; g.stroke(path(trace(M, [upper[1]])));
    if (!male) { g.lineWidth = 3; g.stroke(path(trace(M, [[out, [outX + sd * ew * 0.06, out[1] + eh * 0.05], [outX + sd * ew * 0.12, out[1] + eh * 0.12], [outX + sd * ew * 0.15, out[1] + eh * 0.2]]]))); }
    g.strokeStyle = 'rgba(80,40,30,0.38)'; g.lineWidth = 1.8; g.stroke(path(lo.slice(0, Math.round(lo.length * 0.75))));
    g.fillStyle = 'rgba(230,140,140,0.6)'; g.fill(ell(M, inX + sd * ew * 0.03, ey - eh * 0.06, ew * 0.035, eh * 0.14));
  }
  // 눈썹: 눈머리 위에서 시작해 2/3 지점이 가장 높고 꼬리는 가늘게
  if (!o.noBrow) for (const sd of [-1, 1]) {
    const by = o.browY, x0 = sd * (ipd / 2 - ew * 0.52), x1 = sd * (ipd / 2 + ew * 0.18), x2 = sd * (ipd / 2 + ew * 0.62), bw = o.browW ?? (male ? 0.0042 : 0.0028);
    const top = trace(M, [[[x0, by + bw * 0.5], [x0 + sd * ew * 0.3, by + bw * 1.2], [x1 - sd * ew * 0.15, by + bw * 1.6], [x1, by + bw * 1.5]], [[x1, by + bw * 1.5], [x1 + sd * ew * 0.15, by + bw * 1.4], [x2 - sd * ew * 0.1, by - bw * 0.2], [x2, by - bw * 0.5]]], 10);
    const bot = trace(M, [[[x2, by - bw * 0.5], [x2 - sd * ew * 0.12, by - bw * 0.3], [x1 + sd * ew * 0.1, by + bw * 0.6], [x1, by + bw * 0.55]], [[x1, by + bw * 0.55], [x1 - sd * ew * 0.2, by + bw * 0.55], [x0 + sd * ew * 0.2, by - bw * 0.45], [x0, by - bw * 0.5]]], 10);
    g.fillStyle = o.brow || '#5a3a24'; g.globalAlpha = 0.85; g.fill(path([...top, ...bot.slice(1)], true)); g.globalAlpha = 1;
  }
  // 코: 콧대 옆 그늘 (빛은 왼쪽 위) · 코끝 · 콧구멍 · 콧방울
  { const ny = o.noseY, nl = o.eyeY - ny;
    g.save(); g.filter = 'blur(4px)'; g.strokeStyle = 'rgba(160,95,85,0.35)'; g.lineWidth = 6; g.stroke(path(trace(M, [[[-0.006, o.eyeY - nl * 0.05], [-0.0075, o.eyeY - nl * 0.4], [-0.008, ny + nl * 0.3], [-0.007, ny + nl * 0.12]]])));
    g.fillStyle = 'rgba(150,85,75,0.3)'; g.fill(ell(M, 0, ny - 0.0015, 0.011, 0.0028)); g.restore();
    g.fillStyle = 'rgba(255,240,230,0.35)'; g.fill(ell(M, 0.001, ny + 0.0045, 0.0032, 0.0028));
    g.fillStyle = 'rgba(110,55,50,0.55)'; for (const sd of [-1, 1]) g.fill(ell(M, sd * 0.0055, ny + 0.0005, 0.0024, 0.0011));
    g.strokeStyle = 'rgba(150,85,75,0.45)'; g.lineWidth = 2; for (const sd of [-1, 1]) g.stroke(path(trace(M, [[[sd * 0.008, ny + 0.0005], [sd * 0.0115, ny + 0.001], [sd * 0.0125, ny + 0.004], [sd * 0.0105, ny + 0.0065]]], 8))); }
  // 입: 무표정 (다문 입 · 은은한 입술색) / open: 살짝 벌림
  if (!o.noMouth) {
    const my = o.mouthY, mw = o.mouthW ?? (male ? 0.025 : 0.0225), lip = o.lip || (male ? 'rgba(170,100,95,0.55)' : 'rgba(205,110,115,0.75)');
    const upperLip = trace(M, [[[-mw, my], [-mw * 0.5, my + 0.0022], [-mw * 0.18, my + 0.0042], [0, my + 0.0032]], [[0, my + 0.0032], [mw * 0.18, my + 0.0042], [mw * 0.5, my + 0.0022], [mw, my]]], 10);
    const lowerLip = trace(M, [[[mw, my], [mw * 0.6, my - 0.0042], [-mw * 0.6, my - 0.0042], [-mw, my]]], 16);
    g.fillStyle = lip; g.fill(path([...upperLip, ...lowerLip.slice(1)], true));
    if (o.open) { g.fillStyle = '#4a1418'; g.fill(ell(M, 0, my - 0.0012, mw * 0.62, 0.0034)); g.fillStyle = 'rgba(255,250,245,0.9)'; g.fill(ell(M, 0, my + 0.0012, mw * 0.45, 0.0008)); }
    else { g.strokeStyle = 'rgba(110,45,50,0.8)'; g.lineWidth = 2.5; g.stroke(path(trace(M, [[[-mw * 0.96, my], [-mw * 0.4, my - 0.0004], [mw * 0.4, my - 0.0004], [mw * 0.96, my]]], 14))); }
    g.fillStyle = 'rgba(255,235,230,0.3)'; g.fill(ell(M, 0, my - 0.0025, mw * 0.3, 0.0008)); // 아랫입술 반사
    g.save(); g.filter = 'blur(3px)'; g.fillStyle = 'rgba(150,85,80,0.25)'; g.fill(ell(M, 0, my - 0.0075, mw * 0.5, 0.002)); g.restore(); // 아랫입술 밑 그늘
  }
}
// 이목구비 기본 배치 (머리 L 공유): 눈 · 눈썹 · 코 밑 · 입 높이 (머리 로컬 m)
export function faceLayout(M, L) { return { eyeY: M.yAt(L.eye), browY: M.yAt(L.brow), noseY: M.yAt(L.nose), mouthY: M.yAt(L.mouth) }; }
