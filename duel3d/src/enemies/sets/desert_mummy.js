// 모래 미라병 — 붕대에 감긴 유적의 망자 (잡몹)
// 구성: 깡마른 붕대 몸통 (대각선 붕대 결 · 노멀맵 · 얼룩) · 가슴의 찢어진 틈 사이로 보이는 갈비뼈와 저주의 금빛
//       청금석 · 홍옥 · 금 띠의 넓은 목걸이(우세크) · 주름 잡힌 허리 치마(셴디트) + 금 허리띠 · 앞 가리개
//       붕대 감긴 해골 머리 (움푹한 눈구멍 속 호박빛 눈 · 이마 붕대 틈) · 청동 팔찌 · 뼈만 남은 손가락
//       풀려서 늘어진 붕대 두 가닥 (로프 물리) · 무기: 청동 코페시 (낫 모양 이집트 검)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, strand, spl, lathe, gauss, smooth, envCube } from '../../sculpt.js';
import { V3, TAU, C, cv, tex, rng, T, shared, std, add, rim, lRim, normalFrom, physRig } from './desert_kit.js';

export const MUMMY_DIMS = { hipH: 0.95, spineL: 0.2, chestL: 0.28, neckL: 0.085, shW: 0.185, uArm: 0.29, lArm: 0.27, hipW: 0.088, thigh: 0.44, shin: 0.43, headTop: 0.24 };
const D = MUMMY_DIMS;

/* ---------- 텍스처 ---------- */
// 붕대: 비스듬한 띠가 겹겹이 (반복 가능: 기울기 0.25 · 간격 32px). hgt = 높이맵(띠 가운데가 높음)
function bandageCanvas(hgt, dark) {
  const W = 512, H = 512, [c, g] = cv(W, H), r = rng(dark ? 5 : 3);
  g.fillStyle = hgt ? '#000' : dark ? '#7a6a52' : '#cdbd98'; g.fillRect(0, 0, W, H);
  const sp = 32, s = 0.25, var4 = [0, 0.06, -0.04, 0.03];
  for (let k = -24; k < 24; k++) {
    const y0 = k * sp, w = sp * (1.18 + var4[((k % 4) + 4) % 4]);
    for (const oy of [-H, 0, H]) {
      g.save(); g.translate(0, y0 + oy); g.transform(1, s, 0, 1, 0, 0);
      const gr = g.createLinearGradient(0, -w / 2, 0, w / 2);
      if (hgt) { gr.addColorStop(0, '#000'); gr.addColorStop(0.18, '#888'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(0.85, '#aaa'); gr.addColorStop(1, '#111'); }
      else { const b = dark ? [122, 104, 80] : [214, 198, 162], v = var4[((k % 4) + 4) % 4] * 160; const cc = (m) => `rgb(${b.map((x) => Math.max(0, Math.min(255, x * m + v))).join(',')})`;
        gr.addColorStop(0, cc(0.55)); gr.addColorStop(0.2, cc(0.92)); gr.addColorStop(0.55, cc(1.05)); gr.addColorStop(0.9, cc(0.8)); gr.addColorStop(1, cc(0.5)); }
      g.fillStyle = gr; g.fillRect(-10, -w / 2, W + 20, w); g.restore();
    }
  }
  if (!hgt) {
    // 실 결 · 얼룩 (가장자리를 넘어가면 반대편에도)
    for (let i = 0; i < 900; i++) { const x = r() * W, y = r() * H; g.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.12)' : 'rgba(255,250,230,0.1)'; g.fillRect(x, y, 1 + r() * 6, 1); }
    for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * H, rr = 12 + r() * 40; for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, `rgba(${dark ? '40,30,18' : '120,88,48'},${0.25 + r() * 0.2})`); gr.addColorStop(1, 'rgba(120,88,48,0)'); g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); } }
  }
  return c;
}
// 몸통 붕대: 앞 가슴(u 0.5) 왼쪽에 찢어진 틈 (어두운 속살) — 캔버스 아래 = v 0
function chestCanvas() {
  const [c, g] = cv(1024, 512); g.drawImage(bandageCanvas(false), 0, 0); g.drawImage(bandageCanvas(false), 512, 0);
  const p = new Path2D(), cx = 0.56 * 1024, cy = 512 * 0.52; p.moveTo(cx - 40, cy - 70); p.bezierCurveTo(cx + 30, cy - 90, cx + 70, cy - 30, cx + 48, cy + 30); p.bezierCurveTo(cx + 30, cy + 80, cx - 30, cy + 70, cx - 52, cy + 20); p.bezierCurveTo(cx - 70, cy - 20, cx - 60, cy - 50, cx - 40, cy - 70);
  g.fillStyle = '#2a1a10'; g.fill(p); g.lineWidth = 7; g.strokeStyle = 'rgba(100,80,50,0.9)'; g.stroke(p);
  const gl = g.createRadialGradient(cx, cy, 4, cx, cy, 70); gl.addColorStop(0, 'rgba(255,190,70,0.65)'); gl.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = gl; g.fill(p);
  return c;
}
function chestGlow() { const [c, g] = cv(1024, 512); g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512); const cx = 0.56 * 1024, cy = 512 * 0.52, gl = g.createRadialGradient(cx, cy, 2, cx, cy, 60); gl.addColorStop(0, '#ffcf6a'); gl.addColorStop(0.6, '#a85a10'); gl.addColorStop(1, '#000'); g.fillStyle = gl; g.fillRect(cx - 80, cy - 80, 160, 160); return c; }
// 넓은 목걸이(우세크): 안쪽 → 바깥 동심 띠 (금 · 청금석 · 금 · 홍옥 · 터키석 · 금 구슬 술) — 캔버스 아래 = 안쪽(v 0)
function collarCanvas() {
  const W = 512, H = 128, [c, g] = cv(W, H), bands = [['#d8a840', 10], ['#1e3a8a', 18], ['#e8c060', 6], ['#b8402a', 16], ['#2aa0a0', 16], ['#e8c060', 6], ['#1e3a8a', 14], ['#d8a840', 42]];
  let y = H; for (const [col, h] of bands) { g.fillStyle = col; g.fillRect(0, y - h, W, h); y -= h; }
  // 구슬 결 · 바깥 물방울 장식
  for (let yy = 0; yy < H - 42; yy += 6) for (let x = (yy / 6) % 2 ? 3 : 0; x < W; x += 6) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, H - yy - 6, 1, 6); }
  for (let x = 4; x < W; x += 16) { g.fillStyle = '#f4d070'; g.beginPath(); g.ellipse(x + 4, 22, 5, 14, 0, 0, TAU); g.fill(); g.fillStyle = '#1e3a8a'; g.beginPath(); g.ellipse(x + 4, 24, 2.5, 8, 0, 0, TAU); g.fill(); }
  return c;
}
// 주름 치마: 세로 주름 + 아래 단 금 띠 (캔버스 위 = 허리)
function kiltCanvas() {
  const W = 512, H = 256, [c, g] = cv(W, H); g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 12) { const gr = g.createLinearGradient(x, 0, x + 12, 0); gr.addColorStop(0, 'rgba(90,70,40,0.4)'); gr.addColorStop(0.4, 'rgba(255,250,235,0.18)'); gr.addColorStop(1, 'rgba(90,70,40,0.3)'); g.fillStyle = gr; g.fillRect(x, 0, 12, H); }
  const r = rng(9); for (let i = 0; i < 10; i++) { const x = r() * W, y = r() * H, rr = 20 + r() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(110,80,40,0.3)'); gr.addColorStop(1, 'rgba(110,80,40,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  g.fillStyle = 'rgba(70,50,30,0.55)'; g.fillRect(0, H - 22, W, 22);
  return c;
}
function beltCanvas() { const W = 512, H = 64, [c, g] = cv(W, H); g.fillStyle = '#c89a3a'; g.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 32) { g.fillStyle = '#1e3a8a'; g.fillRect(x + 4, 14, 10, 36); g.fillStyle = '#b8402a'; g.fillRect(x + 18, 14, 10, 36); } g.fillStyle = '#f0d080'; g.fillRect(0, 4, W, 5); g.fillRect(0, H - 9, W, 5); return c; }

function mummyMats(pal) {
  return shared('mummy:' + pal.accent, () => {
    const nB = T('bandN', () => normalFrom(bandageCanvas(true), 3.2, [1, 1]));
    const nB2 = T('bandN2', () => normalFrom(bandageCanvas(true), 3.2, [2, 1]));
    const M = {
      wrap: std({ map: T('band', () => tex(bandageCanvas(false))), normalMap: nB, roughness: 0.92 }),
      wrapD: std({ map: T('bandD', () => tex(bandageCanvas(false, true))), normalMap: nB, roughness: 0.95 }),
      chest: std({ map: T('mChest', () => tex(chestCanvas())), normalMap: nB2, emissiveMap: T('mChestG', () => tex(chestGlow())), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.9 }),
      bone: std({ color: 0xcfc2a0, roughness: 0.7 }),
      hole: std({ color: 0x1a100a, roughness: 1 }),
      gold: std({ color: 0xe8b850, metalness: 0.9, roughness: 0.3, envMap: envCube(), envMapIntensity: 1.2 }),
      bronze: std({ color: 0xd08a48, metalness: 0.85, roughness: 0.34, envMap: envCube(), envMapIntensity: 1.3 }),
      collar: std({ map: T('collar', () => tex(collarCanvas(), [6, 1])), metalness: 0.45, roughness: 0.4, side: THREE.DoubleSide }),
      kilt: std({ map: T('kilt', () => tex(kiltCanvas(), [3, 1])), roughness: 0.9, side: THREE.DoubleSide }),
      belt: std({ map: T('belt', () => tex(beltCanvas(), [2, 1])), metalness: 0.6, roughness: 0.35 }),
      eye: new THREE.MeshBasicMaterial({ color: pal.accent }),
      eyeGlow: new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
      edge: std({ color: 0x000000, emissive: pal.accent, emissiveIntensity: 1.6, metalness: 0.5, roughness: 0.3 }),
      grip: std({ map: T('band', () => tex(bandageCanvas(false))), roughness: 0.9, color: 0x9a8060 }),
    };
    M.loose = std({ map: M.wrap.map, normalMap: nB, roughness: 0.95, side: THREE.DoubleSide });
    return M;
  });
}

/* ---------- 붕대 감긴 머리: 해골 형태 (움푹한 눈 · 광대 · 좁은 턱) ---------- */
const HC = new V3(0, 0.115, 0.004);
export function skullPt(az, el, p, o = {}) {
  const ce = Math.cos(el), x = Math.sin(az) * ce, y = Math.sin(el), z = Math.cos(az) * ce, fr = Math.max(0, z);
  let rx = 0.078, ry = 0.098, rz = 0.094;
  // 아래쪽(얼굴 아래 · 턱)은 좁아지고 앞으로
  const low = smooth(0.05, -0.75, el);
  rx *= 1 - 0.32 * low; rz *= 1 - 0.1 * low * (1 - fr);
  let r = 1;
  r -= (o.socket ?? 0.2) * gauss(Math.abs(az) - 0.4, 0.2) * gauss(el - 0.06, 0.17) * fr;   // 눈구멍
  r += 0.07 * gauss(el - 0.25, 0.09) * fr * gauss(az, 0.7);                                // 눈썹뼈
  r += 0.07 * gauss(Math.abs(az) - 0.78, 0.18) * gauss(el + 0.1, 0.13);                     // 광대
  r -= 0.1 * gauss(Math.abs(az) - 0.95, 0.25) * gauss(el + 0.32, 0.18);                     // 볼 꺼짐
  r -= (o.nose ?? 0.12) * gauss(az, 0.1) * gauss(el + 0.1, 0.09) * fr;                     // 콧구멍
  r -= 0.05 * gauss(Math.abs(az) - 1.45, 0.25) * gauss(el - 0.15, 0.2);                     // 관자놀이
  r += 0.05 * gauss(el + 0.48, 0.1) * fr * gauss(az, 0.5);                                  // 윗니 줄 (턱)
  p.set(HC.x + x * rx * r, HC.y + y * ry * r, HC.z + z * rz * r + 0.012 * low * fr);
  if (y < -0.6) p.y = HC.y - ry * 0.6 - (-y - 0.6) * ry * 0.5; // 아래는 목으로 이어지도록 납작
  return p;
}

export function buildMummy(pal, scale = 1) {
  const m = buildHumanoid(D), J = m.J, M = mummyMats(pal);
  physRig(m, scale);
  /* 골반 · 배 · 가슴 */
  add(J.hips, C('m:pelvis', () => loft((v) => ({ y: -0.11 + 0.19 * v, rx: 0.115 - 0.02 * v, rzF: 0.078, rzB: 0.09, n: 2.2 }), 32, 8, { uvU: 2 })), M.wrapD);
  const bX = spl([[0, 0.096], [0.5, 0.074], [1, 0.09]]), bF = spl([[0, 0.068], [0.5, 0.05], [1, 0.064]]);
  add(J.spine, C('m:belly', () => loft((v) => ({ y: -0.04 + 0.25 * v, rx: bX(v), rzF: bF(v), rzB: 0.062, n: 2.1 }), 32, 10, { uvU: 2, uvV: 1 })), M.wrap);
  const chX = spl([[0, 0.096], [0.35, 0.114], [0.65, 0.124], [0.88, 0.116], [1, 0.076]]), chF = spl([[0, 0.066], [0.5, 0.08], [1, 0.054]]);
  const chP = (v) => ({ y: -0.02 + 0.3 * v, rx: chX(v), rzF: chF(v), rzB: 0.074, n: 2.15 });
  // 갈비 굴곡 (앞가슴에 띠 모양 융기)
  const chMod = (p, u, v, c, sn) => { if (sn > 0.2) { const k = Math.max(0, Math.sin(v * 34)) ** 2 * smooth(0.12, 0.3, v) * smooth(0.75, 0.55, v); p.z += 0.004 * k * sn; } };
  add(J.chest, C('m:chest', () => loft(chP, 48, 18, { mod: chMod, uvU: 1 })), M.chest);
  // 찢어진 틈 속 갈비뼈 세 줄
  { const q = loftAt(chP, 0.53, 0.52, new V3());
    for (let i = 0; i < 3; i++) add(J.chest, C('m:rib' + i, () => strand([[q.x - 0.035, q.y + 0.035 - i * 0.03, q.z - 0.006], [q.x, q.y + 0.03 - i * 0.03 + 0.004, q.z + 0.004], [q.x + 0.04, q.y + 0.02 - i * 0.03, q.z - 0.008]], 0.006, 0.005, { seg: 10, rad: 6 })), M.bone); }
  // 우세크 목걸이: 어깨 위로 드리운 넓은 판
  const colS = (u, v, p) => { const a = (u - 0.5) * TAU, r = 0.062 + 0.11 * v, cx = Math.sin(a), cz = Math.cos(a); p.set(cx * r * 1.18, 0.262 - 0.07 * v * v - 0.02 * v * Math.max(0, cz) + 0.012 * Math.max(0, -cz) * v, cz * r * (cz > 0 ? 0.92 : 0.86) + 0.004); };
  add(J.chest, C('m:collar', () => surf(colS, 48, 6)), M.collar);
  { const pts = []; for (let i = 0; i < 48; i++) { const p = new V3(); colS(i / 48, 1, p); pts.push(p); } rim(J.chest, 'm:collarR', pts, 0.005, true, M.gold);
    const pts2 = []; for (let i = 0; i < 48; i++) { const p = new V3(); colS(i / 48, 0, p); pts2.push(p); } rim(J.chest, 'm:collarR0', pts2, 0.004, true, M.gold); }
  /* 허리띠 · 주름 치마 · 앞 가리개 */
  const beltP = (v) => ({ y: 0.025 + 0.05 * v, rx: 0.122, rzF: 0.084, rzB: 0.096, n: 2.3 });
  add(J.hips, C('m:belt', () => loft(beltP, 40, 2, { uvU: 2 })), M.belt);
  const kP = (v) => ({ y: 0.03 - 0.25 * v, rx: 0.125 + 0.07 * v, rzF: 0.088 + 0.05 * v, rzB: 0.1 + 0.05 * v, n: 2.2 });
  // 주름: 둘레 방향으로 물결 · 아랫단 들쭉날쭉
  add(J.hips, C('m:kilt', () => loft(kP, 64, 6, { uvU: 1, mod: (p, u, v) => { const k = 1 + 0.035 * Math.sin(u * TAU * 22) * v; p.x *= k; p.z *= k; if (v > 0.9) p.y += 0.012 * Math.sin(u * 47) * (v - 0.9) * 10; } })), M.kilt);
  const flap = new THREE.Group(); flap.position.set(0, 0.0, 0.092); J.hips.add(flap); m.flap = flap;
  add(flap, C('m:flap', () => surf((u, v, p) => { const w = 0.055 + 0.03 * v; p.set((u - 0.5) * 2 * w, 0.02 - 0.3 * v, 0.004 + 0.03 * v - 0.025 * ((u - 0.5) * 2) ** 2); }, 6, 8)), M.belt);
  /* 목 · 머리 */
  add(J.neck, C('m:neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.046 - 0.008 * v, rz: 0.044 - 0.006 * v }), 16, 5, { uvU: 1 })), M.wrap);
  const H = J.head;
  const headGeo = C('m:head', () => surf((u, v, p) => skullPt((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI, p, { socket: 0.13, nose: 0.05 }), 64, 48, { closedU: true, poles: [0, 48], uvU: 1.5, uvV: 1 }));
  add(H, headGeo, M.wrap); H.scale.setScalar(1.18);
  // 눈: 붕대 틈 속 어두운 구멍 + 빛나는 눈동자 (왼눈만 크게 보임)
  for (const s of [-1, 1]) {
    const p = skullPt(s * 0.4, 0.06, new V3(), { socket: 0.13 });
    add(H, C('m:sock', () => new THREE.SphereGeometry(0.02, 12, 8)), M.hole, [p.x, p.y, p.z - 0.004], [0, 0, 0], [1.2, 0.8, 0.5]);
    add(H, C('m:eye', () => new THREE.SphereGeometry(0.0075, 10, 8)), M.eye, [p.x, p.y, p.z + 0.004]);
    const gl = add(H, C('m:eyeG', () => new THREE.SphereGeometry(0.02, 10, 8)), M.eyeGlow, [p.x, p.y, p.z + 0.006]); gl.renderOrder = 4;
  }
  // 이마 · 턱을 가로지르는 겹친 붕대 띠 (도드라짐)
  for (const [el0, tw, key] of [[0.36, 0.1, 'a'], [-0.24, -0.16, 'b'], [-0.52, 0.06, 'c']]) {
    const pts = []; for (let i = 0; i <= 24; i++) { const az = -Math.PI + (i / 24) * TAU; pts.push(skullPt(az, el0 + tw * Math.sin(az), new V3()).sub(HC).multiplyScalar(1.045).add(HC)); }
    add(H, C('m:hband' + key, () => strand(pts, 0.011, 0.011, { closed: true, seg: 48, rad: 6, flat: 0.35, ref: [0, 1, 0] })), M.wrapD);
  }
  /* 팔: 붕대 감긴 가는 팔 · 청동 팔찌 · 뼈 손가락 */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('m:delt', () => { const g = new THREE.SphereGeometry(0.052, 16, 12); g.scale(1, 0.9, 1); return g; }), M.wrapD, [s * 0.008, 0.0, 0]);
    add(sh, C('m:uarm', () => loft((v) => ({ y: 0.02 - (D.uArm + 0.02) * v, rx: 0.045 - 0.009 * v + 0.004 * Math.sin(v * 3), rz: 0.042 - 0.009 * v }), 18, 10, { uvU: 0.5, uvV: 1 })), M.wrap);
    add(el, C('m:elb', () => new THREE.SphereGeometry(0.03, 12, 10)), M.wrapD);
    add(el, C('m:farm', () => loft((v) => ({ y: 0.01 - D.lArm * v, rx: 0.037 - 0.012 * v + 0.005 * Math.sin(v * 2.6), rz: 0.033 - 0.009 * v }), 18, 10, { uvU: 0.5, uvV: 1 })), M.wrap);
    const brP = (v) => ({ y: -D.lArm * 0.5 - 0.06 * v, rx: 0.036, rz: 0.032 });
    add(el, C('m:bracer', () => loft(brP, 20, 2)), M.bronze); lRim(el, 'm:brR0', brP, 0, 0.004, M.gold); lRim(el, 'm:brR1', brP, 1, 0.004, M.gold);
    const hg = new THREE.Group(); ha.add(hg);
    add(hg, C('m:palm' + s, () => loft((v) => ({ y: -0.005 - 0.06 * v, rx: 0.016, rz: 0.028 + 0.004 * v, n: 3, cx: s * 0.006 }), 12, 5, { uvU: 0.3 })), M.wrap);
    for (let k = 0; k < 4; k++) {
      const z = 0.02 - k * 0.013, curl = s < 0 ? 2.4 : 1.1 + k * 0.15, pts = [];
      for (let i = 0; i <= 6; i++) { const th = -0.6 - (i / 6) * curl; pts.push(new V3(s * 0.006 + s * Math.cos(th) * 0.028, -0.055 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`m:fing${s}${k}`, () => strand(pts, 0.0062, 0.004, { seg: 10, rad: 6 })), k % 2 ? M.bone : M.wrapD);
    }
    add(hg, C('m:thumb' + s, () => strand([[0, -0.014, 0.024], [-s * 0.006, -0.034, 0.038], [s * 0.004, -0.054, 0.036]], 0.007, 0.005, { seg: 8, rad: 6 })), M.wrapD);
  }
  /* 다리 · 발 */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const thX = spl([[0, 0.076], [0.5, 0.062], [1, 0.047]]);
    add(hp, C('m:thigh', () => loft((v) => ({ y: 0.03 - (D.thigh + 0.03) * v, rx: thX(v), rzF: thX(v) * 0.95, rzB: thX(v) }), 20, 12, { uvU: 0.6, uvV: 1.4 })), M.wrap);
    add(kn, C('m:knee', () => new THREE.SphereGeometry(0.04, 12, 10)), M.wrapD, [0, 0, 0.006]);
    const cX = spl([[0, 0.047], [0.3, 0.053], [0.8, 0.034], [1, 0.031]]);
    add(kn, C('m:shin', () => loft((v) => ({ y: 0.01 - D.shin * v, rx: cX(v), rzF: cX(v) * 0.9, rzB: cX(v) * 1.15 }), 20, 12, { uvU: 0.6, uvV: 1.4 })), M.wrap);
    add(ft, C('m:foot', () => surf((u, v, p) => { const a = u * TAU, w = 0.034 * Math.sin(Math.min(1, v * 1.4 + 0.2) * Math.PI * 0.9) + 0.008, h = 0.036 * (1 - v * 0.6); p.set(Math.cos(a) * w, -0.045 + h / 2 + Math.sin(a) * h / 2, -0.04 + 0.18 * v); }, 16, 10, { closedU: true })), M.wrapD);
  }
  /* 무기: 청동 코페시 (낫 모양 · 금 날 빛) */
  const W = J.weapon;
  add(W, C('m:grip', () => { const g = new THREE.CylinderGeometry(0.016, 0.018, 0.17, 10); g.rotateX(Math.PI / 2); return g; }), M.grip, [0, 0, 0]);
  add(W, C('m:pommel', () => new THREE.SphereGeometry(0.024, 10, 8)), M.gold, [0, 0, -0.09]);
  add(W, C('m:guard', () => new THREE.BoxGeometry(0.03, 0.05, 0.02)), M.gold, [0, 0, 0.09]);
  const kh = () => { const sh = new THREE.Shape(); sh.moveTo(0.09, 0.013); sh.lineTo(0.36, 0.012); sh.quadraticCurveTo(0.47, 0.02, 0.5, 0.11); sh.quadraticCurveTo(0.52, 0.2, 0.44, 0.27); sh.quadraticCurveTo(0.64, 0.22, 0.64, 0.06); sh.quadraticCurveTo(0.6, -0.06, 0.4, -0.014); sh.lineTo(0.09, -0.013); sh.closePath(); return sh; };
  const kg = new THREE.Group(); kg.scale.setScalar(0.78); kg.position.z = 0.02; W.add(kg);
  add(kg, C('m:khopesh', () => { const g = new THREE.ExtrudeGeometry(kh(), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 }); g.translate(0, 0, -0.004); g.rotateY(-Math.PI / 2); return g; }), M.bronze);
  add(kg, C('m:khEdge', () => { const c = new THREE.QuadraticBezierCurve(new THREE.Vector2(0.44, 0.27), new THREE.Vector2(0.64, 0.22), new THREE.Vector2(0.64, 0.06)), c2 = new THREE.QuadraticBezierCurve(new THREE.Vector2(0.64, 0.06), new THREE.Vector2(0.6, -0.06), new THREE.Vector2(0.4, -0.014)); const pts = [...c.getPoints(12), ...c2.getPoints(12).slice(1)].map((q) => new V3(0, q.y, q.x)); return strand(pts, 0.0035, 0.0035, { seg: 40, rad: 5 }); }), M.edge);
  /* 풀린 붕대 두 가닥 */
  m.addRope({ n: 7, seg: 0.07, joint: J.elbowL, local: new V3(0.025, -D.lArm * 0.62, -0.01), rest: new V3(0.1, -1, -0.2), mat: M.loose, prof: () => 0.02, flat: 0.12, side: new V3(1, 0, 0), caps: 'none' });
  m.addRope({ n: 8, seg: 0.075, joint: J.hips, local: new V3(-0.06, 0.02, -0.1), rest: new V3(-0.2, -1, -0.5), mat: M.loose, prof: (v) => 0.024 - 0.006 * v, flat: 0.12, side: new V3(0, 0, 1), caps: 'legs' });
  /* 매 프레임 */
  let lag = 0;
  m.update = (dt, f) => {
    lag += (Math.min(J.hipL.rotation.x, J.hipR.rotation.x) - lag) * Math.min(1, dt * 14);
    flap.rotation.x = Math.min(0, lag) * 0.8 - 0.05;
    m.stepPhys(dt, f);
  };
  m.sole = 0.05;
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0.08, 0.5));
  m.weaponPts = (b, t) => { W.localToWorld(b.set(0, 0, 0.12)); W.localToWorld(t.set(0, 0.1, 0.52)); };
  return m;
}
