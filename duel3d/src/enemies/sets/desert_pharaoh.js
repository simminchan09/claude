// 모래 파라오 세크메트 — 협곡의 저주받은 왕 (보스)
// 구성: 암사자 머리 (도드라진 주둥이 · 코 · 수염 패드 · 빛나는 금빛 눈 · 뺨 갈기 털 다발 · 두건 위로 솟은 귀)
//       금 · 청금석 줄무늬 네메스 두건 (앞 이마 띠 · 어깨로 늘어진 두 자락 · 등 뒤 땋은 꼬리) · 이마의 우라에우스 코브라 · 머리 뒤 태양 원반
//       근육질 몸 (가슴 · 복근 굴곡) · 깃털 무늬 금 흉갑 · 커다란 우세크 목걸이 · 금 어깨 원반 · 금 팔찌 · 청금석 팔토시 · 발톱
//       주름 잡힌 흰 금 셴디트 + 청금석 허리띠 · 앞 코브라 가리개 · 금 정강이 갑주 · 샌들
//       물리: 청금석 별무늬 망토 (천) · 앞 휘장 (천) · 사자 꼬리 (로프 + 털 술) · 허리 양옆 붉은 리본 2
//       무기: 와스 홀 창 (긴 자루 · 비스듬한 짐승 머리 장식 · 초승달 칼날 · 아래 두 갈래)
//       석관 봉인: 몸을 감싸는 금 석관 두 쪽 (봉인 중에만 나타나고, 금이 가며 빛남)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { surf, loft, loftAt, strand, spl, lathe, gauss, smooth, envCube } from '../../sculpt.js';
import { V3, TAU, C, cv, tex, rng, T, phys, std, add, rim, lRim, normalFrom, physRig } from './desert_kit.js';

export const PHARAOH_DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.235, uArm: 0.3, lArm: 0.28, hipW: 0.1, thigh: 0.46, shin: 0.45, headTop: 0.3 };
const D = PHARAOH_DIMS;
export const WAS = { butt: -0.5, top: 1.55 };

/* ---------- 텍스처 ---------- */
function furCanvas(base, dark, light, seed = 3) {
  const W = 256, H = 256, [c, g] = cv(W, H), r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1600; i++) { const x = r() * W, y = r() * H, l = 4 + r() * 10; g.strokeStyle = r() < 0.5 ? dark : light; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l); g.stroke(); }
  return c;
}
function nemesCanvas() { const W = 512, H = 256, [c, g] = cv(W, H); for (let x = 0; x < W; x += 32) { g.fillStyle = '#e0b04a'; g.fillRect(x, 0, 18, H); g.fillStyle = '#1c3488'; g.fillRect(x + 18, 0, 14, H); g.fillStyle = 'rgba(255,240,180,0.5)'; g.fillRect(x + 3, 0, 3, H); } return c; }
function featherCanvas() {
  const W = 512, H = 256, [c, g] = cv(W, H); g.fillStyle = '#c89838'; g.fillRect(0, 0, W, H);
  for (let row = 0; row < 9; row++) for (let i = -1; i < 18; i++) { const x = i * 30 + (row % 2) * 15, y = H - row * 30; g.fillStyle = row % 3 === 0 ? '#1e3a8a' : row % 3 === 1 ? '#e8c060' : '#2a9a9a'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 15, y - 40, x + 30, y); g.closePath(); g.fill(); g.strokeStyle = '#7a5a18'; g.lineWidth = 2; g.stroke(); }
  return c;
}
function collarCanvas() {
  const W = 512, H = 160, [c, g] = cv(W, H), bands = [['#d8a840', 10], ['#1e3a8a', 20], ['#e8c060', 6], ['#b8402a', 18], ['#2aa0a0', 18], ['#e8c060', 6], ['#1e3a8a', 18], ['#d8a840', 64]];
  let y = H; for (const [col, h] of bands) { g.fillStyle = col; g.fillRect(0, y - h, W, h); y -= h; }
  for (let x = 4; x < W; x += 16) { g.fillStyle = '#f4d070'; g.beginPath(); g.ellipse(x + 4, 30, 6, 20, 0, 0, TAU); g.fill(); g.fillStyle = '#b8402a'; g.beginPath(); g.ellipse(x + 4, 34, 3, 11, 0, 0, TAU); g.fill(); }
  return c;
}
function kiltCanvas() {
  const W = 512, H = 256, [c, g] = cv(W, H); g.fillStyle = '#f0e8d4'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 10) { const gr = g.createLinearGradient(x, 0, x + 10, 0); gr.addColorStop(0, 'rgba(120,100,60,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,250,0.2)'); gr.addColorStop(1, 'rgba(120,100,60,0.25)'); g.fillStyle = gr; g.fillRect(x, 0, 10, H); }
  g.fillStyle = '#d8a840'; g.fillRect(0, H - 18, W, 10); g.fillStyle = '#1e3a8a'; g.fillRect(0, H - 8, W, 8);
  return c;
}
function beltCanvas() { const W = 512, H = 64, [c, g] = cv(W, H); g.fillStyle = '#1e3a8a'; g.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 24) { g.fillStyle = '#e8c060'; g.fillRect(x + 2, 12, 8, 40); g.fillStyle = '#b8402a'; g.fillRect(x + 12, 20, 8, 24); } g.fillStyle = '#f0d080'; g.fillRect(0, 2, W, 6); g.fillRect(0, H - 8, W, 6); return c; }
function shaftCanvas() { const W = 64, H = 512, [c, g] = cv(W, H); g.fillStyle = '#1a2a6a'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 64) { g.fillStyle = '#e0b04a'; g.fillRect(0, y, W, 10); g.fillStyle = '#b8402a'; g.fillRect(0, y + 10, W, 4); } return c; }
// 망토: 청금석 바탕 · 금 별 · 금 테두리 (캔버스 위 = 어깨)
function capeCanvas() {
  const W = 256, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#22348a'); gr.addColorStop(1, '#0e1a4a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(12); g.fillStyle = '#f0c860'; for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, s = 3 + r() * 4; g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, rr = k % 2 ? s * 0.4 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
  g.fillStyle = '#d8a840'; g.fillRect(0, 0, 10, H); g.fillRect(W - 10, 0, 10, H); g.fillRect(0, H - 22, W, 22); g.fillStyle = '#b8402a'; g.fillRect(0, H - 30, W, 6);
  return c;
}
function tabardCanvas() { const W = 128, H = 512, [c, g] = cv(W, H); for (let y = 0; y < H; y += 40) { g.fillStyle = '#e0b04a'; g.fillRect(0, y, W, 22); g.fillStyle = '#1e3a8a'; g.fillRect(0, y + 22, W, 14); g.fillStyle = '#b8402a'; g.fillRect(0, y + 36, W, 4); } g.fillStyle = '#7a5010'; g.fillRect(0, 0, 6, H); g.fillRect(W - 6, 0, 6, H); return c; }
// 석관 앞면: 금 바탕 · 가슴에 엇갈린 팔 · 날개 · 상형문자 띠 (glow = 문자 · 균열)
function sarcCanvas(glow) {
  const W = 512, H = 1024, [c, g] = cv(W, H);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = 6; }
  else { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#b8862a'); gr.addColorStop(0.5, '#f0cc6a'); gr.addColorStop(1, '#b8862a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = 120; y < 300; y += 24) { g.fillStyle = (y / 24) % 2 ? '#1e3a8a' : '#e8c060'; g.fillRect(0, y, W, 12); }
    g.fillStyle = '#1e3a8a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(W / 2 - 180 + i * 45, 480, 18, 60, 0.3, 0, TAU); g.fill(); }
    g.strokeStyle = '#7a5010'; g.lineWidth = 8; }
  for (let i = 0; i < 6; i++) { const y = 600 + i * 64; g.strokeRect(W / 2 - 40, y, 80, 54); g.beginPath(); g.arc(W / 2, y + 27, 14, 0, TAU); g.stroke(); }
  if (glow) { const r = rng(5); for (let k = 0; k < 7; k++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 80; y += 30 + r() * 40; g.lineTo(x, y); } g.stroke(); } }
  return c;
}

/* ---------- 암사자 머리 ---------- */
const HC = new V3(0, 0.115, 0.012);
function lionPt(az, el, p) {
  const ce = Math.cos(el), x = Math.sin(az) * ce, y = Math.sin(el), z = Math.cos(az) * ce, fr = Math.max(0, z);
  let rx = 0.086, ry = 0.09, rz = 0.094, r = 1;
  r -= 0.06 * gauss(Math.abs(az) - 0.42, 0.18) * gauss(el - 0.12, 0.13) * fr;      // 눈두덩 안쪽
  r += 0.05 * gauss(el - 0.28, 0.1) * fr;                                           // 이마 눈썹
  const muz = gauss(az, 0.55) * gauss(el + 0.22, 0.24) * fr;                          // 주둥이
  p.set(HC.x + x * rx * r * (1 - 0.08 * muz), HC.y + y * ry * r, HC.z + z * rz * r + 0.045 * muz);
  p.y -= 0.012 * gauss(az, 0.3) * gauss(el + 0.05, 0.12) * fr; // 콧등 움푹
  if (y < -0.55) p.y = HC.y - ry * 0.55 - (-y - 0.55) * ry * 0.6;
  return p;
}

export function buildPharaoh(pal, scale = 1.75) {
  const m = buildHumanoid(D), J = m.J, env = envCube(); physRig(m, scale);
  const accent = pal.accent;
  const M = {
    skin: phys({ map: T('p:fur', () => tex(furCanvas('#b47c3c', 'rgba(110,64,24,0.12)', 'rgba(240,190,120,0.12)'), [2, 2])), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0xffd8a0) }),
    face: phys({ map: T('p:furF', () => tex(furCanvas('#c08a48', 'rgba(110,64,24,0.3)', 'rgba(250,210,150,0.35)', 7), [4, 4])), roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color(0xffe0b0) }),
    mane: phys({ map: T('p:mane', () => tex(furCanvas('#8a5420', 'rgba(60,30,10,0.45)', 'rgba(220,150,80,0.35)', 9), [1, 2])), roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0xffc080) }),
    muzzle: phys({ color: 0xe8cfa8, roughness: 0.7 }),
    nose: phys({ color: 0x3a1a14, roughness: 0.35, clearcoat: 0.6 }),
    gold: phys({ color: 0xf0c060, metalness: 1, roughness: 0.24, clearcoat: 0.4, envMap: env, envMapIntensity: 1.3 }),
    goldD: phys({ color: 0xb08030, metalness: 1, roughness: 0.34, envMap: env }),
    lapis: phys({ color: 0x1e3a9a, metalness: 0.2, roughness: 0.25, clearcoat: 1, envMap: env, envMapIntensity: 0.6 }),
    nemes: phys({ map: T('p:nemes', () => tex(nemesCanvas(), [3, 1])), metalness: 0.6, roughness: 0.3, clearcoat: 0.6, envMap: env, envMapIntensity: 0.9 }),
    feather: phys({ map: T('p:feath', () => tex(featherCanvas(), [2, 1])), metalness: 0.55, roughness: 0.35, clearcoat: 0.5, envMap: env }),
    collar: phys({ map: T('p:collar', () => tex(collarCanvas(), [7, 1])), metalness: 0.5, roughness: 0.35, clearcoat: 0.5, envMap: env, side: THREE.DoubleSide }),
    kilt: phys({ map: T('p:kilt', () => tex(kiltCanvas(), [3, 1])), roughness: 0.75, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) }),
    belt: phys({ map: T('p:belt', () => tex(beltCanvas(), [3, 1])), metalness: 0.4, roughness: 0.35, envMap: env }),
    shaft: phys({ map: T('p:shaft', () => tex(shaftCanvas(), [1, 3])), metalness: 0.5, roughness: 0.3, envMap: env }),
    cape: phys({ map: T('p:cape', () => tex(capeCanvas())), roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0x8aa0ff), side: THREE.DoubleSide }),
    tabard: phys({ map: T('p:tab', () => tex(tabardCanvas())), roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }),
    red: phys({ color: 0xb02a20, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xff8070), side: THREE.DoubleSide }),
    claw: phys({ color: 0x1a1210, roughness: 0.25, clearcoat: 1 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffb830 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x1a0a00 }),
    eyeGlow: new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    sun: phys({ color: 0xffd060, emissive: accent, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.25 }),
    sunHalo: new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    blade: phys({ color: 0xf8d880, emissive: accent, emissiveIntensity: 0.5, metalness: 1, roughness: 0.18, envMap: env, envMapIntensity: 1.4 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    sarc: phys({ map: T('p:sarc', () => tex(sarcCanvas(false))), emissiveMap: T('p:sarcG', () => tex(sarcCanvas(true))), emissive: accent, emissiveIntensity: 0.6, metalness: 0.85, roughness: 0.3, envMap: env, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
  };
  m.mats = M;
  /* ---------- 골반 · 셴디트 · 허리띠 · 앞 가리개 ---------- */
  add(J.hips, C('p:pelvis', () => loft((v) => ({ y: -0.12 + 0.2 * v, rx: 0.13 - 0.015 * v, rzF: 0.09, rzB: 0.1, n: 2.2 }), 32, 8)), M.skin);
  const kP = (v) => ({ y: 0.04 - 0.3 * v, rx: 0.14 + 0.08 * v, rzF: 0.1 + 0.06 * v, rzB: 0.11 + 0.05 * v, n: 2.2 });
  add(J.hips, C('p:kilt', () => loft(kP, 72, 6, { mod: (p, u, v) => { const k = 1 + 0.03 * Math.sin(u * TAU * 26) * v; p.x *= k; p.z *= k; } })), M.kilt);
  const beltP = (v) => ({ y: 0.02 + 0.07 * v, rx: 0.142, rzF: 0.102, rzB: 0.112, n: 2.3 });
  add(J.hips, C('p:belt', () => loft(beltP, 48, 2, { uvU: 2 })), M.belt); lRim(J.hips, 'p:beltR0', beltP, 0, 0.006, M.gold); lRim(J.hips, 'p:beltR1', beltP, 1, 0.006, M.gold);
  add(J.hips, C('p:buckle', () => new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24).rotateX(Math.PI / 2)), M.gold, [0, 0.055, 0.108]);
  add(J.hips, C('p:buckleG', () => new THREE.SphereGeometry(0.016, 12, 10)), M.lapis, [0, 0.055, 0.115]);
  /* ---------- 배 · 가슴 (근육) · 깃털 흉갑 · 목걸이 · 어깨 ---------- */
  const bX = spl([[0, 0.13], [0.5, 0.118], [1, 0.134]]);
  add(J.spine, C('p:belly', () => loft((v) => ({ y: -0.04 + 0.26 * v, rx: bX(v), rzF: 0.085, rzB: 0.085, n: 2.15 }), 36, 12, { mod: (p, u, v, c, sn) => { if (sn > 0.3) p.z += 0.008 * (0.5 + 0.5 * Math.cos(v * 18)) * gauss(Math.abs(p.x) - 0.03, 0.025) * sn; } })), M.skin);
  const chX = spl([[0, 0.138], [0.35, 0.162], [0.7, 0.178], [0.9, 0.168], [1, 0.11]]), chF = spl([[0, 0.094], [0.55, 0.116], [1, 0.076]]);
  const chP = (v) => ({ y: -0.02 + 0.3 * v, rx: chX(v), rzF: chF(v), rzB: 0.1, n: 2.2 });
  const pecs = (p, u, v, c, sn) => { if (sn > 0) p.z += 0.02 * gauss(Math.abs(p.x) - 0.06, 0.045) * gauss(p.y - 0.17, 0.05) * sn; };
  add(J.chest, C('p:chest', () => loft(chP, 52, 18, { mod: pecs })), M.skin);
  const corP = (v) => { const q = chP(v * 0.45); return { ...q, rx: q.rx + 0.008, rzF: q.rzF + 0.008, rzB: q.rzB + 0.008 }; };
  add(J.chest, C('p:corslet', () => loft(corP, 52, 8, { uvU: 1 })), M.feather); lRim(J.chest, 'p:corR', corP, 1, 0.006, M.gold); lRim(J.chest, 'p:corR0', corP, 0, 0.006, M.gold);
  const colS = (u, v, p) => { const a = (u - 0.5) * TAU, r = 0.072 + 0.15 * v, cx = Math.sin(a), cz = Math.cos(a); p.set(cx * r * 1.22, 0.29 - 0.09 * v * v - 0.03 * v * Math.max(0, cz), cz * r * (cz > 0 ? 0.95 : 0.85) + 0.004); };
  add(J.chest, C('p:collar', () => surf(colS, 64, 6)), M.collar);
  { const o = []; for (let i = 0; i < 64; i++) { const q = new V3(); colS(i / 64, 1, q); o.push(q); } rim(J.chest, 'p:colR', o, 0.007, true, M.gold); }
  /* ---------- 목 · 암사자 머리 · 갈기 · 네메스 · 우라에우스 · 태양 원반 ---------- */
  add(J.neck, C('p:neck', () => loft((v) => ({ y: -0.03 + 0.14 * v, rx: 0.058 - 0.008 * v, rz: 0.056 - 0.006 * v }), 20, 6)), M.skin);
  const H = J.head; H.scale.setScalar(1.08);
  add(H, C('p:head', () => surf((u, v, p) => lionPt((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI, p), 64, 48, { closedU: true, poles: [0, 48] })), M.face);
  { const nt = lionPt(0, -0.12, new V3()); add(H, C('p:nose', () => { const g = new THREE.SphereGeometry(0.026, 14, 10); g.scale(1.3, 0.75, 0.8); return g; }), M.nose, [nt.x, nt.y + 0.008, nt.z + 0.004]);
    for (const s of [-1, 1]) { const w = lionPt(s * 0.2, -0.26, new V3()); add(H, C('p:wpad', () => new THREE.SphereGeometry(0.026, 12, 10)), M.muzzle, [w.x, w.y, w.z - 0.012], [0, 0, 0], [1, 0.8, 0.75]); }
    const mo = []; for (let i = 0; i <= 10; i++) { const q = lionPt(-0.5 + i * 0.1, -0.42 + 0.05 * Math.abs(i - 5) / 5, new V3()); mo.push(q.sub(HC).multiplyScalar(1.015).add(HC)); } rim(H, 'p:mouth', mo, 0.004, false, M.nose);
    const ch = lionPt(0, -0.55, new V3()); add(H, C('p:chin', () => new THREE.SphereGeometry(0.028, 12, 10)), M.muzzle, [ch.x, ch.y + 0.01, ch.z - 0.02], [0, 0, 0], [1, 0.7, 0.8]); }
  for (const s of [-1, 1]) {
    const e = lionPt(s * 0.42, 0.12, new V3());
    add(H, C('p:eyeW', () => { const g = new THREE.SphereGeometry(0.013, 14, 10); g.scale(1.6, 0.62, 0.5); return g; }), M.eye, [e.x, e.y, e.z - 0.003], [0, s * 0.35, -s * 0.2]);
    add(H, C('p:pup', () => { const g = new THREE.SphereGeometry(0.004, 8, 6); g.scale(0.6, 1.6, 0.6); return g; }), M.pupil, [e.x, e.y, e.z + 0.002]);
    const gl = add(H, C('p:eyeG', () => new THREE.SphereGeometry(0.03, 10, 8)), M.eyeGlow, [e.x, e.y, e.z]); gl.renderOrder = 4; m['eyeG' + s] = gl;
    const lid = []; for (let i = 0; i <= 6; i++) lid.push(lionPt(s * (0.3 + i * 0.04), 0.15 - 0.02 * Math.abs(i - 3), new V3()).sub(HC).multiplyScalar(1.02).add(HC)); rim(H, 'p:lid' + s, lid, 0.0035, false, M.nose);
    // 귀: 두건 위로 솟은 둥근 귀
    add(H, C('p:ear' + s, () => { const g = lathe([[0.03, 0], [0.034, 0.02], [0.026, 0.045], [0.012, 0.062], [0, 0.066]], 14); g.scale(1, 1, 0.45); return g; }), M.mane, [s * 0.07, 0.2, -0.035], [-0.35, 0, -s * 0.3], 0.75);
  }
  // 뺨 갈기: 두건 가장자리 아래로 삐져나온 짧은 털 다발
  { const r = rng(4);
    for (let k = 0; k < 12; k++) { const s2 = k < 6 ? -1 : 1, i = k % 6, az = s2 * (0.66 + i * 0.03), el0 = 0.05 - i * 0.11;
      const a = lionPt(az, el0, new V3()), d = new V3(Math.sin(az), 0, Math.cos(az) * 0.3).normalize(), b = a.clone().addScaledVector(d, 0.025).add(new V3(0, -0.025, -0.01)), c = b.clone().addScaledVector(d, 0.012).add(new V3(0, -0.03, -0.02));
      add(H, C('p:mane' + k, () => strand([a, b, c], 0.018 + r() * 0.005, 0.002, { seg: 8, rad: 6, flat: 0.45, ref: [d.x, d.y, d.z] })), M.mane); } }
  // 네메스: 정수리 덮개 + 뒤 · 옆으로 퍼지는 두건 (앞얼굴 제외)
  const nP = (v) => ({ y: 0.2 - 0.32 * v, rx: 0.098 + 0.085 * v * v, rzF: 0.1 + 0.02 * v, rzB: 0.1 + 0.05 * v, cz: 0.006 - 0.03 * v, n: 2.2 });
  add(H, C('p:nemes', () => loft(nP, 48, 12, { a0: 0.6, a1: 1.4, uvU: 1 })), M.nemes);
  add(H, C('p:nemesTop', () => loft((v) => ({ y: 0.195 + 0.025 * Math.sin(v * Math.PI / 2), rx: 0.1 * Math.cos(v * Math.PI / 2) + 0.001, rzF: 0.104 * Math.cos(v * Math.PI / 2) + 0.001, rzB: 0.102 * Math.cos(v * Math.PI / 2) + 0.001, cz: 0.006 }), 40, 8, { uvU: 1 })), M.nemes);
  { const band = []; for (let i = 0; i <= 20; i++) { const az = -0.75 + i * 0.075; band.push(lionPt(az, 0.62, new V3()).sub(HC).multiplyScalar(1.09).add(HC)); } rim(H, 'p:band', band, 0.009, false, M.gold); }
  // 어깨로 늘어진 두 자락 (머리 기준)
  for (const s of [-1, 1]) add(H, C('p:lap' + s, () => surf((u, v, p) => { const y = 0.02 - 0.3 * v, w = 0.03 + 0.012 * v; p.set(s * (0.098 + 0.03 * v) + (u - 0.5) * 2 * w * 0.3, y, 0.03 + (u - 0.5) * 2 * w + 0.02 * v); }, 4, 10)), M.nemes);
  for (const s of [-1, 1]) add(H, C('p:lapE' + s, () => new THREE.BoxGeometry(0.02, 0.012, 0.07)), M.gold, [s * 0.128, -0.285, 0.05]);
  add(H, C('p:queue', () => strand([[0, 0.05, -0.12], [0, -0.06, -0.15], [0, -0.2, -0.14]], 0.03, 0.02, { seg: 10, rad: 8 })), M.nemes);
  // 우라에우스 (코브라): 이마 띠 위로 솟음
  { const g = new THREE.Group(); g.position.copy(lionPt(0, 0.62, new V3()).sub(HC).multiplyScalar(1.1).add(HC)); H.add(g);
    add(g, C('p:cobra', () => strand([[0, -0.01, -0.01], [0, 0.02, 0.01], [0, 0.05, 0.005], [0, 0.07, 0.012]], 0.009, 0.006, { seg: 12, rad: 6 })), M.gold);
    add(g, C('p:hood', () => { const s = new THREE.SphereGeometry(0.024, 12, 10); s.scale(1, 1.3, 0.35); return s; }), M.gold, [0, 0.065, 0.004]);
    add(g, C('p:hoodG', () => new THREE.SphereGeometry(0.008, 8, 6)), M.lapis, [0, 0.065, 0.013]); }
  // 태양 원반
  const sun = new THREE.Group(); sun.position.set(0, 0.3, -0.1); H.add(sun); m.sun = sun;
  add(sun, C('p:sun', () => new THREE.CylinderGeometry(0.13, 0.13, 0.02, 40).rotateX(Math.PI / 2)), M.sun);
  add(sun, C('p:sunR', () => new THREE.TorusGeometry(0.135, 0.01, 8, 48)), M.gold);
  const sh = add(sun, C('p:sunH', () => new THREE.CircleGeometry(0.3, 40)), M.sunHalo, [0, 0, -0.02]); sh.renderOrder = 3; m.sunHalo = sh;
  for (const s of [-1, 1]) add(sun, C('p:sunHorn' + s, () => strand([[s * 0.06, -0.12, 0.0], [s * 0.15, -0.1, 0], [s * 0.17, 0.02, 0], [s * 0.12, 0.13, 0]], 0.012, 0.004, { seg: 14, rad: 6 })), M.goldD, [0, 0, -0.012]);
  /* ---------- 팔: 근육 · 금 팔찌 · 청금석 팔토시 · 발톱 ---------- */
  for (const [shJ, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(shJ, C('p:delt', () => { const g = new THREE.SphereGeometry(0.068, 18, 14); g.scale(1.05, 0.95, 1); return g; }), M.skin, [s * 0.01, -0.005, 0]);
    const pd = (v) => ({ y: 0.07 - 0.1 * v, rx: 0.08 + 0.025 * v, rz: 0.078 + 0.02 * v });
    add(shJ, C('p:pad' + s, () => loft(pd, 28, 5, { a0: s > 0 ? 0.0 : 0.5, a1: s > 0 ? 0.5 : 1.0 })), M.gold, [s * 0.012, 0, 0]); lRim(shJ, 'p:padR' + s, pd, 1, 0.006, M.lapis, { a0: s > 0 ? 0.0 : 0.5, a1: s > 0 ? 0.5 : 1.0 });
    const uX = spl([[0, 0.062], [0.35, 0.068], [0.75, 0.056], [1, 0.047]]);
    add(shJ, C('p:uarm', () => loft((v) => ({ y: 0.02 - (D.uArm + 0.02) * v, rx: uX(v), rzF: uX(v) * 1.05, rzB: uX(v) * 0.95 }), 24, 10, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z += 0.01 * gauss(v - 0.4, 0.2) * sn; } })), M.skin);
    const ab = (v) => ({ y: -0.08 - 0.035 * v, rx: 0.071, rz: 0.073 });
    add(shJ, C('p:armlet', () => loft(ab, 24, 2)), M.gold); lRim(shJ, 'p:abR', ab, 0.5, 0.005, M.lapis);
    const fX = spl([[0, 0.052], [0.3, 0.056], [1, 0.038]]);
    add(el, C('p:farm', () => loft((v) => ({ y: 0.02 - D.lArm * v, rx: fX(v), rz: fX(v) * 0.92 }), 24, 10)), M.skin);
    const brP = (v) => ({ y: -0.1 - (D.lArm - 0.12) * v, rx: fX(0.35 + 0.65 * v) + 0.007, rz: fX(0.35 + 0.65 * v) * 0.92 + 0.007 });
    add(el, C('p:bracer', () => loft(brP, 24, 4)), M.lapis); lRim(el, 'p:brR0', brP, 0, 0.005, M.gold); lRim(el, 'p:brR1', brP, 1, 0.005, M.gold);
    const hg = new THREE.Group(); ha.add(hg);
    add(hg, C('p:palm' + s, () => loft((v) => ({ y: -0.005 - 0.075 * v, rx: 0.024, rz: 0.04 + 0.004 * v, n: 3, cx: s * 0.008 }), 14, 5)), M.skin);
    for (let k = 0; k < 4; k++) { const z = 0.03 - k * 0.019, curl = s < 0 ? 2.4 : 1.2, pts = [];
      for (let i = 0; i <= 6; i++) { const th = -0.6 - (i / 6) * curl; pts.push(new V3(s * 0.01 + s * Math.cos(th) * 0.035, -0.065 + Math.sin(th) * 0.036, z)); }
      add(hg, C(`p:f${s}${k}`, () => strand(pts, 0.011, 0.008, { seg: 10, rad: 7 })), M.skin);
      add(hg, C('p:claw', () => new THREE.ConeGeometry(0.006, 0.026, 6)), M.claw, pts[6].toArray(), [0, 0, s < 0 ? -2.6 : -1.4]); }
    add(hg, C('p:th' + s, () => strand([[0, -0.016, 0.034], [-s * 0.008, -0.04, 0.05], [s * 0.004, -0.064, 0.05]], 0.012, 0.009, { seg: 8, rad: 7 })), M.skin);
  }
  /* ---------- 다리: 근육 · 금 정강이 갑주 · 샌들 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const tX = spl([[0, 0.088], [0.4, 0.078], [1, 0.054]]);
    add(hp, C('p:thigh', () => loft((v) => ({ y: 0.03 - (D.thigh + 0.03) * v, rx: tX(v), rzF: tX(v) * 1.02, rzB: tX(v) }), 24, 12)), M.skin);
    const cX = spl([[0, 0.054], [0.3, 0.062], [0.75, 0.04], [1, 0.034]]);
    add(kn, C('p:shin', () => loft((v) => ({ y: 0.02 - D.shin * v, rx: cX(v), rzF: cX(v) * 0.92, rzB: cX(v) * 1.15 }), 24, 12)), M.skin);
    const gP = (v) => ({ y: -0.04 - 0.34 * v, rx: cX(0.1 + 0.75 * v) + 0.01, rzF: cX(0.1 + 0.75 * v) * 0.92 + 0.014, rzB: cX(0.1 + 0.75 * v) * 1.15 + 0.004 });
    add(kn, C('p:greave', () => loft(gP, 28, 8, { a0: 0.18, a1: 0.82, mod: (p, u, v) => { p.z += 0.006 * gauss(u - 0.5, 0.05); } })), M.gold);
    lRim(kn, 'p:grR', gP, 0, 0.005, M.lapis, { a0: 0.18, a1: 0.82 });
    add(kn, C('p:kneeP', () => { const g = new THREE.SphereGeometry(0.05, 14, 10, 0, TAU, 0, Math.PI / 2); g.rotateX(Math.PI / 2); g.scale(1, 1, 0.6); return g; }), M.gold, [0, 0, 0.04]);
    add(ft, C('p:foot', () => surf((u, v, p) => { const a = u * TAU, w = 0.04 * Math.sin(Math.min(1, v * 1.3 + 0.25) * Math.PI * 0.9) + 0.008, h = 0.045 * (1 - v * 0.6); p.set(Math.cos(a) * w, -0.05 + h / 2 + Math.sin(a) * h / 2, -0.05 + 0.21 * v); }, 18, 12, { closedU: true })), M.skin);
    add(ft, C('p:sole', () => new THREE.BoxGeometry(0.1, 0.014, 0.25)), M.goldD, [0, -0.062, 0.05]);
    add(ft, C('p:strap', () => new THREE.TorusGeometry(0.04, 0.006, 6, 20)), M.gold, [0, -0.02, 0.06], [Math.PI / 2 + 0.3, 0, 0], [1, 1.2, 1]);
  }
  /* ---------- 무기: 와스 홀 창 ---------- */
  const W = J.weapon;
  add(W, C('p:shaft', () => new THREE.CylinderGeometry(0.019, 0.02, WAS.top - WAS.butt - 0.2, 12).rotateX(Math.PI / 2)), M.shaft, [0, 0, (WAS.top + WAS.butt) / 2 - 0.1]);
  for (const z of [-0.2, 0.25, 1.05]) add(W, C('p:wband', () => new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12).rotateX(Math.PI / 2)), M.gold, [0, 0, z]);
  // 위: 비스듬한 짐승 머리 (와스) + 초승달 칼날
  add(W, C('p:wasHead', () => strand([[0, 0, 1.3], [0, 0.03, 1.36], [0, 0.07, 1.39], [0, 0.11, 1.37]], 0.028, 0.012, { seg: 10, rad: 8, flat: 0.6, ref: [1, 0, 0] })), M.gold);
  add(W, C('p:wasEar', () => new THREE.ConeGeometry(0.012, 0.05, 6)), M.gold, [0, 0.12, 1.34], [-0.6, 0, 0]);
  const bladeSh = () => { const s = new THREE.Shape(); s.moveTo(-0.02, 0); s.quadraticCurveTo(0.03, 0.18, -0.06, 0.34); s.quadraticCurveTo(0.17, 0.2, 0.08, -0.02); s.quadraticCurveTo(0.04, -0.03, -0.02, 0); return s; };
  add(W, C('p:wasBlade', () => { const g = new THREE.ExtrudeGeometry(bladeSh(), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 1, curveSegments: 14 }); g.translate(0, 0, -0.003); g.rotateY(-Math.PI / 2); g.rotateX(-Math.PI / 2); g.translate(0, -0.03, 1.28); return g; }), M.blade);
  add(W, C('p:wasEdge', () => { const c = new THREE.QuadraticBezierCurve(new THREE.Vector2(-0.06, 0.34), new THREE.Vector2(0.17, 0.2), new THREE.Vector2(0.08, -0.02)); return strand(c.getPoints(16).map((q) => new V3(0, -0.03 - q.x, 1.28 + q.y)), 0.004, 0.004, { seg: 32, rad: 5 }); }), M.edge);
  add(W, C('p:wasTip', () => new THREE.ConeGeometry(0.02, 0.16, 8).rotateX(Math.PI / 2)), M.blade, [0, 0, WAS.top - 0.04]);
  // 아래: 두 갈래
  for (const s of [-1, 1]) add(W, C('p:fork' + s, () => strand([[0, 0, -0.38], [0, s * 0.03, -0.45], [0, s * 0.035, -0.52]], 0.012, 0.004, { seg: 8, rad: 6 })), M.gold);
  /* ---------- 석관 봉인 (몸 기준, 앞 · 뒤 두 쪽) ---------- */
  const sarc = new THREE.Group(); m.body.add(sarc); sarc.visible = false; m.sarc = sarc;
  const sP = spl([[0, 0.2], [0.25, 0.24], [0.5, 0.3], [0.72, 0.36], [0.82, 0.3], [0.9, 0.26], [1, 0.05]]);
  const halves = [];
  for (const [a0, a1, key] of [[0.25, 0.75, 'f'], [0.75, 1.25, 'b']]) {
    const g = new THREE.Group(); sarc.add(g);
    add(g, C('p:sarc' + key, () => loft((v) => ({ y: 0.02 + 2.0 * v, rx: sP(v) * 1.05, rzF: sP(v) * 0.85, rzB: sP(v) * 0.8, n: 2.3 }), 40, 24, { a0, a1 })), M.sarc);
    lRim(g, 'p:sarcR' + key + '0', (v) => ({ y: 0.02 + 2.0 * v, rx: sP(v) * 1.05, rzF: sP(v) * 0.85, rzB: sP(v) * 0.8, n: 2.3 }), 0.02, 0.012, M.goldD, { a0, a1 });
    halves.push(g);
  }
  m.halves = halves;
  // 봉인 강도 k: 0 = 없음 → 1 = 닫힘, crack: 0..1 (균열 빛)
  m.setSeal = (k, crack = 0) => { sarc.visible = k > 0.01; halves[0].position.z = (1 - k) * 0.9; halves[1].position.z = -(1 - k) * 0.9; sarc.scale.setScalar(0.85 + 0.15 * k); M.sarc.opacity = 0.35 + 0.57 * k; M.sarc.emissiveIntensity = 0.5 + crack * 3.5; };
  /* ---------- 물리: 망토 · 앞 휘장 · 사자 꼬리 · 리본 ---------- */
  const tA = new V3();
  m.addCloth({ W: 7, H: 13, len: 1.2, mat: M.cape, anchor: (cl) => { for (let i = 0; i < cl.W; i++) { const u = i / (cl.W - 1), x = 0.19 - 0.38 * u; J.chest.localToWorld(cl.anchors[i].set(x, 0.27 - 0.03 * Math.abs(x) * 4, -0.1 - 0.02 * (1 - Math.abs(x) * 5))); } } });
  m.addCloth({ W: 4, H: 9, len: 0.62, mat: M.tabard, anchor: (cl) => { for (let i = 0; i < cl.W; i++) { const x = 0.075 - 0.15 * (i / (cl.W - 1)); J.hips.localToWorld(cl.anchors[i].set(x, 0.02, 0.122)); } }, caps: (f, torso, legs) => legs });
  const tailR = m.addRope({ n: 9, seg: 0.075, joint: J.hips, local: new V3(0, -0.06, -0.11), rest: new V3(0, -0.5, -1), mat: M.skin, prof: (v) => 0.02 - 0.008 * v, rad: 8, caps: 'legs', stiff: 0.2 });
  for (const s of [-1, 1]) m.addRope({ n: 6, seg: 0.07, joint: J.hips, local: new V3(s * 0.14, 0.04, 0.02), rest: new V3(s * 0.2, -1, 0.1), mat: M.red, prof: () => 0.022, flat: 0.15, side: new V3(1, 0, 0), caps: 'none' });
  const tuft = new THREE.Group(); add(tuft, C('p:tuft', () => lathe([[0.004, 0.02], [0.03, 0], [0.04, -0.05], [0.03, -0.1], [0, -0.12]], 14)), M.mane); m.worldObjs = [tuft];
  /* ---------- 매 프레임 ---------- */
  let t = 0, lag = 0; const q = new THREE.Quaternion();
  m.update = (dt, f) => {
    t += dt; const k = 0.5 + 0.5 * Math.sin(t * 2.4), en = f.enraged ? 1 : 0;
    M.sun.emissiveIntensity = 1.4 + k * 0.8 + en; m.sunHalo.material.opacity = 0.22 + 0.15 * k + 0.15 * en; m.sunHalo.scale.setScalar(1 + 0.08 * k + 0.25 * en);
    m.eyeG1.material.opacity = 0.4 + 0.2 * k + 0.3 * en;
    m.stepPhys(dt, f);
    const p = tailR.rope.p, a = p[p.length - 2], b = p[p.length - 1]; tuft.position.copy(b); tuft.quaternion.setFromUnitVectors(new V3(0, -1, 0), tA.subVectors(b, a).normalize()); tuft.scale.setScalar(f.scale);
  };
  m.sole = 0.07;
  m.tipPos = (out = new V3()) => W.localToWorld(out.set(0, 0, WAS.top));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.35)); W.localToWorld(tt.set(0, 0, WAS.top)); };
  m.handPos = (out = new V3()) => J.handL.localToWorld(out.set(0, -0.08, 0.02));
  return m;
}
