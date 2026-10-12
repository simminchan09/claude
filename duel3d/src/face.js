// 공용 애니메 얼굴: 얼굴형 조각(구 → 애니메 머리) + 머리 UV 캔버스에 그리는 눈
//
//   animeHead(o)  → { HC, HR, headPt, headN, headAt, dirOf }
//     headPt(dx, dy, dz, out): 단위 방향 → 머리 로컬 좌표.  head 곡면은 (u, v) → az = (u - 0.5)·2π, el = -π/2 + v·π 로 만든다.
//     o: C(중심) · R([x, y, z] 반지름) · square(두개 각짐) · jaw(V 턱 좁아짐) · chin(턱끝) · socket(눈두덩 깊이) · nose · cheek · brow · lips
//   paintEye(g, P, K, sd, o)  눈 하나를 그린다 (sd = +1 왼눈(+x) / -1 오른눈).  o.style: 'soft' | 'sharp' | 'stern'
//   P(az, el) → 캔버스 [x, y],  K = 캔버스 폭 / 2π
import * as THREE from 'three';
import { gauss, smooth } from './sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const dirOf = (az, el, out = new V3()) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

export function animeHead(o = {}) {
  const HC = o.C || new V3(0, 0.103, 0.006), HR = o.R || [0.072, 0.101, 0.09];
  const square = o.square ?? 0.55, jaw = o.jaw ?? 0.4, jaw0 = o.jaw0 ?? 0.28, chin = o.chin ?? 0.014, socket = o.socket ?? 0.0015, nose = o.nose ?? 1, cheek = o.cheek ?? 0.004, brow = o.brow ?? 0.003, lips = o.lips ?? 0.003, short = o.short ?? 0.17;
  // 각진 두개(옆면 평평) · 뒤로 나온 뒤통수 · 평평한 앞얼굴 · V자 턱(턱끝은 앞으로) · 턱 아래 → 목으로 꺾이는 면 · 광대 · 눈두덩 · 콧대
  function headPt(dx, dy, dz, out) {
    const ax = Math.abs(dx), fz = Math.max(0, dz), bz = Math.max(0, -dz), low = smooth(-0.05, -0.95, dy);
    const h = Math.hypot(dx, dz) || 1e-6, cx = dx / h, cz = dz / h, n = 2 + square * (1 - low), sq = Math.pow(Math.pow(Math.abs(cx), n) + Math.pow(Math.abs(cz), n), -1 / n);
    let x = dx * sq * HR[0] * 0.97, y = dy * HR[1] * (1 - short * low), z = dz * sq * HR[2]; // short: 하관을 짧게 (명조풍 작은 얼굴)
    z *= 1 + 0.1 * bz * smooth(-0.5, 0.4, dy);
    z *= 1 - 0.07 * fz * fz * (1 - low);
    x *= 1 - low * (jaw0 + jaw * fz);
    z *= 1 - 0.38 * low * bz;
    y += 0.022 * low * bz * bz;
    z -= 0.012 * low * low * (1 - fz);
    x *= 1 + 0.12 * gauss(dy + 0.92, 0.12) * fz; // 턱끝을 살짝 둥글게
    z += chin * gauss(dy + 0.86, 0.16) * Math.pow(fz, 3); y -= chin * 0.43 * gauss(dy + 0.86, 0.16) * fz;
    z += cheek * gauss(ax - 0.5, 0.2) * gauss(dy + 0.12, 0.22) * fz;
    z -= socket * gauss(ax - 0.36, 0.16) * gauss(dy - 0.04, 0.12) * fz;
    z += brow * gauss(ax - 0.34, 0.25) * gauss(dy - 0.24, 0.07) * fz;
    z += nose * (0.011 * gauss(dx, 0.04) * gauss(dy + 0.14, 0.065) + 0.004 * gauss(dx, 0.03) * gauss(dy + 0.02, 0.12)) * Math.pow(fz, 3);
    z += lips * gauss(dx, 0.14) * gauss(dy + 0.43, 0.08) * fz;
    return out.set(HC.x + x, HC.y + y, HC.z + z);
  }
  const headN = (p) => new V3((p.x - HC.x) / (HR[0] * HR[0]), (p.y - HC.y) / (HR[1] * HR[1]), (p.z - HC.z) / (HR[2] * HR[2])).normalize();
  const headAt = (az, el, off = 0, out = new V3()) => { const d = dirOf(az, el), p = headPt(d.x, d.y, d.z, out); if (off) p.addScaledVector(headN(p), off); return p; };
  return { HC, HR, headPt, headN, headAt, dirOf };
}

// 애니메 눈 (명조풍).  o: { az, el, style, iris: [밝은, 중간, 어두운, 테두리], pupil, lash, wink, glow }
//   soft  : 크고 세로로 긴 눈 · 진한 일자 윗속눈썹 · 아래로 갈수록 밝은 홍채 · 반사광 여러 개 (상냥한 표정)
//   sharp : 눈꼬리가 올라가고 윗눈꺼풀이 홍채를 반쯤 덮음 (날카로운 표정)
//   stern : 가늘고 평평한 윗눈꺼풀 · 눈 밑 주름 (위엄 있는 노인)
export function paintEye(g, P, K, sd, o = {}) {
  const st = o.style || 'soft', [cx, cy] = P(sd * (o.az ?? 0.36), o.el ?? 0.04);
  const S = { soft: { w: 0.54, up: 60, arch: 10, dn: 54, inY: 8, outY: 2, ir: [48, 62], iy: 10, pu: [9, 15] },
    sharp: { w: 0.52, up: 44, arch: 5, dn: 38, inY: 12, outY: -12, ir: [44, 54], iy: 10, pu: [10, 16] },
    stern: { w: 0.38, up: 22, arch: 2, dn: 18, inY: 4, outY: -4, ir: [24, 28], iy: 2, pu: [8, 11] } }[st];
  const w = K * S.w, inX = cx - sd * w * 0.47, outX = cx + sd * w * 0.52, ink = o.lash || '#24120e';
  const [c0, c1, c2, rim] = o.iris || ['#ffd27a', '#e8902a', '#7a3a0c', '#3a1806'];
  if (o.wink) {
    g.strokeStyle = ink; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(inX, cy + 8); g.quadraticCurveTo(cx, cy - 18, outX, cy + 8); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(outX, cy + 8); g.lineTo(outX + sd * 14, cy + 14); g.stroke(); return;
  }
  // 윗선: 안쪽에서 완만히 올라가 거의 일자로 가다 눈꼬리에서 내려옴
  const tA = [cx - sd * w * 0.25, cy - S.up + S.arch], tB = [cx + sd * w * 0.22, cy - S.up], tEnd = [outX, cy + S.outY];
  const top = new Path2D(); top.moveTo(inX, cy + S.inY); top.bezierCurveTo(tA[0], tA[1], tB[0], tB[1], ...tEnd);
  const eye = new Path2D(); eye.moveTo(inX, cy + S.inY); eye.bezierCurveTo(tA[0], tA[1], tB[0], tB[1], ...tEnd); eye.bezierCurveTo(cx + sd * w * 0.28, cy + S.dn, cx - sd * w * 0.22, cy + S.dn, inX, cy + S.inY);
  g.save(); g.clip(eye);
  if (!o.glow) { const sc = g.createLinearGradient(0, cy - S.up, 0, cy + S.dn); sc.addColorStop(0, '#d8d8e6'); sc.addColorStop(0.45, '#fbfaff'); sc.addColorStop(1, '#ffffff'); g.fillStyle = sc; g.fillRect(cx - w, cy - 90, w * 2, 180); }
  const ix = cx + sd * 3, iy = cy + S.iy, [rx, ry] = S.ir;
  const ig = g.createLinearGradient(0, iy - ry, 0, iy + ry); ig.addColorStop(0, c2); ig.addColorStop(0.32, c2); ig.addColorStop(0.62, c1); ig.addColorStop(1, c0);
  g.fillStyle = ig; g.beginPath(); g.ellipse(ix, iy, rx, ry, 0, 0, TAU); g.fill();
  if (!o.glow) {
    g.strokeStyle = rim; g.lineWidth = 3; g.stroke();
    // 홍채 안쪽 결 (방사 줄) + 밝은 고리
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1.5; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; g.beginPath(); g.moveTo(ix + Math.cos(a) * rx * 0.35, iy + Math.sin(a) * ry * 0.35); g.lineTo(ix + Math.cos(a) * rx * 0.9, iy + Math.sin(a) * ry * 0.9); g.stroke(); }
    g.strokeStyle = 'rgba(255,240,210,0.35)'; g.lineWidth = 3; g.beginPath(); g.ellipse(ix, iy + ry * 0.1, rx * 0.68, ry * 0.68, 0, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = o.pupil || '#2a1004'; g.globalAlpha = 0.8; g.beginPath(); g.ellipse(ix, iy - 2, S.pu[0], S.pu[1], 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    // 윗눈꺼풀 그림자 (눈 위쪽을 어둡게 덮음)
    const sh = g.createLinearGradient(0, cy - S.up, 0, cy - S.up + 34); sh.addColorStop(0, 'rgba(30,12,10,0.55)'); sh.addColorStop(1, 'rgba(30,12,10,0)'); g.fillStyle = sh; g.fillRect(cx - w, cy - S.up - 14, w * 2, 50);
    // 반사광: 큰 것 하나 · 작은 것 · 아래쪽 반짝임
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix - sd * rx * 0.34, iy - ry * 0.34, rx * 0.26, ry * 0.2, -0.4 * sd, 0, TAU); g.fill();
    g.beginPath(); g.arc(ix + sd * rx * 0.38, iy - ry * 0.05, rx * 0.09, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(ix + sd * rx * 0.1, iy + ry * 0.55, rx * 0.22, ry * 0.07, 0, 0, TAU); g.fill();
  }
  g.restore();
  if (o.glow) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // 진한 윗속눈썹: 눈꼬리로 갈수록 두꺼워짐
  g.strokeStyle = ink; g.lineWidth = st === 'stern' ? 6 : 9; g.stroke(top);
  g.lineWidth = st === 'stern' ? 7 : 15; g.beginPath(); g.moveTo(cx - sd * w * 0.05, cy - S.up + 2); g.bezierCurveTo(tB[0], tB[1] + 1, outX - sd * 10, cy + S.outY - 12, outX, cy + S.outY); g.stroke();
  g.lineWidth = 4;
  if (st === 'soft') { g.beginPath(); g.moveTo(outX - sd * 2, cy + S.outY); g.quadraticCurveTo(outX + sd * 10, cy + S.outY - 2, outX + sd * 16, cy + S.outY + 4); g.stroke(); }
  else if (st === 'sharp') { g.beginPath(); g.moveTo(outX - sd * 4, cy + S.outY); g.quadraticCurveTo(outX + sd * 10, cy + S.outY - 6, outX + sd * 20, cy + S.outY - 16); g.stroke(); }
  g.lineWidth = 2; g.strokeStyle = 'rgba(140,70,55,0.4)'; g.beginPath(); g.moveTo(inX + sd * 16, cy - S.up * 0.8); g.bezierCurveTo(tA[0], tA[1] - 14, tB[0], tB[1] - 14, outX - sd * 10, cy + S.outY - 18); g.stroke(); // 쌍꺼풀
  g.lineWidth = 2; g.strokeStyle = 'rgba(90,40,30,0.4)'; g.beginPath(); g.moveTo(cx + sd * w * 0.1, cy + S.dn * 0.8); g.quadraticCurveTo(cx + sd * w * 0.35, cy + S.dn * 0.62, outX - sd * 4, cy + S.outY + 6); g.stroke(); // 아래 속눈썹 (눈꼬리 쪽만 옅게)
  if (st === 'stern') {
    g.strokeStyle = 'rgba(120,70,50,0.45)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - sd * w * 0.3, cy + S.dn + 10); g.quadraticCurveTo(cx, cy + S.dn + 16, cx + sd * w * 0.35, cy + S.dn + 8); g.stroke();
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(outX + sd * 8, cy - 6 + k * 9); g.lineTo(outX + sd * 26, cy - 10 + k * 12); g.stroke(); }
  }
}
