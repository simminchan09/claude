// 고죠 사토루 (GOJO) — 3D 모델 (기술·포즈는 gojo.js)
// 주술고전 교사 · 최강의 주술사. 무기 없이 맨손과 술식으로 싸운다.
//
// 구성: 아주 큰 키 · 마른 체형 · 하얀 피부
//       위로 쓸어 올린 뾰족한 새하얀 머리 (가닥 뭉치) · 눈을 덮는 검은 붕대 안대 (뒤 매듭 · 늘어진 두 끝: 로프 물리)
//       주술고전 교복: 짙은 남흑색 하이칼라 롱재킷 (앞 여밈 · 깃의 금 소용돌이 단추 · 허리 아래로 퍼지는 자락) · 검은 슬림 바지 · 검은 구두
//       맨손 (평소엔 왼손을 주머니에) — 펼친 손 / 주먹 두 벌을 기술에 따라 바꿔 보인다
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
// 다른 캐릭터보다 확실히 큰 키 (머리 끝 ≈ 1.95m) · 가는 팔다리
export const DIMS = { hipH: 1.03, spineL: 0.21, chestL: 0.29, neckL: 0.08, shW: 0.188, uArm: 0.31, lArm: 0.28, hipW: 0.088, thigh: 0.5, shin: 0.49, headTop: 0.27 };
export const BLUE = 0x3a7cff, BLUE2 = 0x9ad4ff, RED = 0xff2238, RED2 = 0xff8a7a, PURPLE = 0xa040ff, PURPLE2 = 0xe0b0ff, VOIDW = 0xe8f2ff;
const C = (k, fn) => cached('gojo:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// 직물 결 (가는 사선 짜임)
function weave(g, W, H, a) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1; for (let x = -H; x < W; x += 5) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); } }
// 재킷 상의: u 0 = 뒤 · 0.5 = 앞. 남흑색 · 앞 여밈선 · 옆 솔기 · 뒤 솔기 (캔버스 아래 = 허리)
function coatTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H); g.fillStyle = '#1b1e2c'; g.fillRect(0, 0, W, H); weave(g, W, H, 0.025);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 4; for (const u of [0.25, 0.75, 0.0, 1.0]) { g.beginPath(); g.moveTo(u * W, 0); g.lineTo(u * W, H); g.stroke(); }
  g.strokeStyle = 'rgba(120,130,170,0.18)'; g.lineWidth = 2; for (const u of [0.253, 0.753]) { g.beginPath(); g.moveTo(u * W, 0); g.lineTo(u * W, H); g.stroke(); }
  // 앞 여밈: 겹친 앞판 가장자리 (오른쪽이 위로 겹침) + 숨은 단추 자국
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W * 0.5 - 3, 0, 6, H); g.fillStyle = 'rgba(140,150,190,0.2)'; g.fillRect(W * 0.5 + 3, 0, 2, H);
  g.strokeStyle = 'rgba(140,150,190,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W * 0.53, 0); g.lineTo(W * 0.53, H); g.stroke();
  return tex(c);
}
// 자락 (치마꼴): 캔버스 위 = 아랫단 (v 1). 남흑색 · 아랫단 접단 · 앞 가장자리 · 옆 주머니 트임
function skirtTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H), gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, '#1d2030'); gr.addColorStop(1, '#171a26'); g.fillStyle = gr; g.fillRect(0, 0, W, H); weave(g, W, H, 0.025);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 26, W, 3); g.fillStyle = 'rgba(140,150,190,0.15)'; g.fillRect(0, 30, W, 2);
  for (const x of [0, W - 6]) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 6, H); }
  // 주머니 트임 (옆 앞쪽 · 허리 바로 아래)
  for (const u of [0.24, 0.76]) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(u * W - 46, H - 120, 92, 5); g.fillStyle = 'rgba(140,150,190,0.18)'; g.fillRect(u * W - 46, H - 114, 92, 2); }
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.5, 0); g.lineTo(W * 0.5, H); g.stroke(); // 뒤 트임 솔기
  return tex(c);
}
// 하얀 머리 (뿌리 살짝 푸른 회색 → 끝 흰색 — strand uv v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(57), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#dfe5f0'); gr.addColorStop(1, '#cfd6e4'); } else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#eef2f8'); gr.addColorStop(1, '#c6cede'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(120,135,170,0.28)' : 'rgba(255,255,255,0.5)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 14, H / 2, x + (r() - 0.5) * 8, 0); g.stroke(); }
  return tex(c);
}
// 붕대 안대: 검정 · 비스듬히 겹쳐 감은 결 (u 둘레 · v 폭)
function bandTex() {
  const W = 1024, H = 64, [c, g] = cv(W, H); g.fillStyle = '#121218'; g.fillRect(0, 0, W, H);
  for (let x = -H; x < W + H; x += 46) { g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, H); g.lineTo(x + 26, 0); g.stroke(); g.strokeStyle = 'rgba(120,125,150,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, H); g.lineTo(x + 30, 0); g.stroke(); }
  g.fillStyle = 'rgba(90,95,120,0.25)'; g.fillRect(0, 4, W, 2); g.fillRect(0, H - 6, W, 2); return tex(c, [3, 1]);
}
// 구두 가죽 (광택은 재질로) · 바지 직물
function pantsTex() { const [c, g] = cv(128, 128); g.fillStyle = '#121319'; g.fillRect(0, 0, 128, 128); weave(g, 128, 128, 0.03); return tex(c, [3, 6]); }

/* ---------- 얼굴: 실제 남성 비율 · 무표정 (눈은 붕대 안대 아래) ---------- */
const HEAD = animeHead({ C: new V3(0, 0.104, 0.006), R: [0.071, 0.104, 0.09], jaw: 0.33, chin: 0.01, nose: 1.1 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  g.fillStyle = '#fae8e0'; g.fillRect(0, 0, W, H);
  const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(255,250,246,0.55)'); gr.addColorStop(0.6, 'rgba(255,240,234,0)'); gr.addColorStop(1, 'rgba(190,150,150,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(200,150,145,0)'); cg.addColorStop(1, 'rgba(185,140,135,0.38)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  paintFace(g, M, { ...Y, male: true, tilt: 0.02, lidDrop: 0.06, open, iris: ['#e8f8ff', '#7ad0ff', '#2a7ae0', '#0a2a5a'], pupil: '#06142a', lash: '#e8ecf4', brow: '#e0e6f0' });
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
  const M = {
    skin: phys({ color: 0xfae6de, emissive: 0x7a5a56, emissiveIntensity: 0.3, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffe0d8) }),
    face: phys({ map: T('face', () => faceTex(false)), emissiveMap: T('face', () => faceTex(false)), emissive: 0x6a5856, emissiveIntensity: 1, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffe0d8) }),
    faceO: phys({ map: T('faceO', () => faceTex(true)), emissiveMap: T('faceO', () => faceTex(true)), emissive: 0x6a5856, emissiveIntensity: 1, roughness: 0.5 }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.42, sheen: 1, sheenColor: new THREE.Color(0xd8ecff), sheenRoughness: 0.35, emissive: 0x3a4250, emissiveIntensity: 0.45 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xd0e4ff), sheenRoughness: 0.35, emissive: 0x2a303c, emissiveIntensity: 0.4 }),
    band: phys({ map: T('band', bandTex), roughness: 0.75, sheen: 0.5, sheenColor: new THREE.Color(0x4a4e60) }),
    bandT: phys({ color: 0x141419, roughness: 0.75, sheen: 0.5, sheenColor: new THREE.Color(0x4a4e60) }),
    coat: phys({ map: T('coat', coatTex), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x5a6488) }),
    navy: phys({ color: 0x1b1e2c, roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x5a6488) }),
    navyD: phys({ color: 0x12141e, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0x4a5070) }),
    skirt: phys({ map: T('skirt', skirtTex), roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x5a6488), side: THREE.BackSide }),
    skirtIn: phys({ color: 0x0e1018, roughness: 0.7, side: THREE.FrontSide }),
    pants: phys({ map: T('pants', pantsTex), roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0x4a4e64) }),
    shoe: phys({ color: 0x0c0c10, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }),
    sole: phys({ color: 0x1a1a1e, roughness: 0.8 }),
    gold: phys({ color: 0xe8bc62, metalness: 1, roughness: 0.22, clearcoat: 0.5 }),
    goldD: phys({ color: 0xb08a40, metalness: 1, roughness: 0.32 }),
    nail: phys({ color: 0xf2d4cc, roughness: 0.25, clearcoat: 1 }),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  m.ropes = [];

  /* ---------- 골반 · 검은 바지 · 허리 ---------- */
  add(J.hips, C('pelvis', () => loft((v) => ({ y: -0.12 + 0.22 * v, rx: 0.136 - 0.016 * v, rzF: 0.086, rzB: 0.098, n: 2.2 }), 40, 8)), M.pants);
  const bX = spl([[0, 0.122], [0.45, 0.108], [1, 0.126]]), bF = spl([[0, 0.082], [0.5, 0.074], [1, 0.084]]);
  add(J.spine, C('belly', () => loft((v) => ({ y: -0.04 + 0.26 * v, rx: bX(v), rzF: bF(v), rzB: 0.084, n: 2.15 }), 40, 12, { uvU: 1 })), M.coat);
  // 허리 이음선 (상의와 자락 사이 · 가는 접힘)
  const waistP = (v) => ({ y: 0.02 + 0.03 * v, rx: 0.142, rzF: 0.096, rzB: 0.106, n: 2.3 });
  add(J.hips, C('waist', () => loft(waistP, 64, 3)), M.navy);
  rim(J.hips, 'waistR', loftRing(waistP, 0, { n: 56 }).map((q) => q.multiplyScalar(1.01)), 0.0035, true, M.navyD);

  /* ---------- 재킷 자락 (허리 → 무릎 위, 앞이 살짝 트임 · 다리 따라 출렁임) ---------- */
  const SK_L = 0.5, skR = (d) => { const t = d / SK_L, e = t * t * (1.5 - 0.5 * t); return { rx: 0.146 + 0.085 * e, rzF: 0.1 + 0.06 * e, rzB: 0.11 + 0.1 * e }; };
  const skirtFn = (u, v, p) => { const d = SK_L * v, s = skR(d), a0 = 0.515 + 0.03 * v, a1 = 1.485 - 0.03 * v; loftAt(() => ({ y: 0.025 - d, ...s, n: 2.1 }), a0 + (a1 - a0) * u, 0, p);
    const w = Math.sin(u * TAU * 6 + 0.7), k = 1 + 0.02 * w * smooth(0.15, 1, v); p.x *= k; p.z *= k; };
  const skGeo = C('skirt', () => surf(skirtFn, 96, 14)).clone(); skGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const skO = add(J.hips, skGeo, M.skirt), skI = add(J.hips, skGeo, M.skirtIn); skO.frustumCulled = skI.frustumCulled = false; skI.castShadow = false;
  m.skirt = { geo: skGeo, base: skGeo.attributes.position.array.slice() };

  /* ---------- 상체: 남흑색 재킷 · 하이칼라 · 금 소용돌이 단추 ---------- */
  const chX = spl([[0, 0.12], [0.3, 0.13], [0.6, 0.146], [0.85, 0.158], [1, 0.15]]), chF = spl([[0, 0.084], [0.5, 0.094], [1, 0.07]]), chB = spl([[0, 0.084], [0.6, 0.09], [1, 0.07]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.25 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.012 * gauss(ax - 0.062, 0.045) * gauss(p.y - 0.15, 0.06) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod, uvU: 1 })), M.coat);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.255 + 0.05 * Math.sin(v * Math.PI / 2), rx: 0.15 - 0.088 * v ** 0.7, rzF: 0.07 - 0.012 * v, rzB: 0.07 - 0.012 * v, n: 2.3 }), 40, 8)), M.coat);
  // 하이칼라: 목을 턱 밑까지 감싸는 높은 깃 (앞 가운데에서 맞닿음) · 윗단 접힘
  const colP = (v) => ({ y: 0.28 + 0.1 * v, rx: 0.058 + 0.008 * v, rzF: 0.06 + 0.012 * v, rzB: 0.062 + 0.004 * v, n: 2.2 });
  add(J.chest, C('collar', () => loft(colP, 48, 6, { a0: 0.515, a1: 1.485 })), M.navy);
  add(J.chest, C('collarIn', () => { const g = loft((v) => { const q = colP(v); return { ...q, rx: q.rx - 0.004, rzF: q.rzF - 0.004, rzB: q.rzB - 0.004 }; }, 40, 4); return g; }), M.navyD);
  rim(J.chest, 'colTop', loftRing(colP, 1, { a0: 0.515, a1: 1.485, n: 40 }), 0.004, false, M.navyD);
  // 금 소용돌이 단추: 깃 앞 아래 (주술고전 교복의 상징)
  { const p = loftAt(colP, 0.5, 0.32, new V3()); const g = new THREE.Group(); g.position.set(p.x, p.y, p.z + 0.004); g.rotation.x = -0.08; J.chest.add(g); m.button = g;
    add(g, C('btnBase', () => { const geo = new THREE.CylinderGeometry(0.019, 0.02, 0.006, 28); geo.rotateX(Math.PI / 2); return geo; }), M.gold);
    add(g, C('btnSpiral', () => { const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 2.2, r = 0.002 + 0.0155 * t; pts.push(new V3(Math.cos(a) * r, Math.sin(a) * r, 0.0042)); } return strand(pts, 0.0018, 0.0022, { seg: 90, rad: 6 }); }), M.goldD);
    add(g, C('btnRing', () => new THREE.TorusGeometry(0.0195, 0.0022, 6, 28)), M.goldD, [0, 0, 0.003]); }
  // 앞 여밈 단추 (숨은 단추 위 작은 검은 단추 셋)
  for (let i = 0; i < 3; i++) { const p = loftAt(chP, 0.5, 0.25 + i * 0.22, new V3(), chMod); add(J.chest, C('fbtn', () => new THREE.SphereGeometry(0.007, 10, 8)), M.navyD, [p.x - 0.008, p.y, p.z + 0.002], [0, 0, 0], [1, 1, 0.5]); }

  /* ---------- 어깨 · 팔 (남흑색 긴 소매 · 소맷부리) · 맨손 (펼친 손 / 주먹) ---------- */
  m.hands = {};
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    add(sh, C('deltoid', () => loft((v) => { const k = v < 0.4 ? Math.sqrt(Math.max(0, 1 - (1 - v / 0.4) ** 2)) : 1; return { y: 0.048 - 0.15 * v, rx: 0.003 + 0.049 * k - 0.002 * v, rz: 0.003 + 0.051 * k - 0.006 * v }; }, 20, 10)), M.coat);
    add(sh, C('uarm', () => loft((v) => ({ y: 0.0 - (DIMS.uArm + 0.012) * v, rx: 0.048 - 0.009 * v + 0.003 * Math.sin(v * Math.PI), rz: 0.047 - 0.008 * v }), 24, 10)), M.navy);
    add(el, C('farm', () => loft((v) => ({ y: 0.026 - (DIMS.lArm - 0.03) * v, rx: 0.042 - 0.004 * v, rz: 0.041 - 0.004 * v }), 24, 8)), M.navy);
    const cuffP = (v) => ({ y: -DIMS.lArm + 0.06 - 0.05 * v, rx: 0.043 + 0.002 * v, rz: 0.042 + 0.002 * v });
    add(el, C('cuff', () => loft(cuffP, 24, 3)), M.navy); rim(el, 'cuffR', loftRing(cuffP, 1, { n: 24 }), 0.003, true, M.navyD);
    add(el, C('wrist', () => loft((v) => ({ y: -DIMS.lArm + 0.04 - 0.05 * v, rx: 0.026, rz: 0.022 }), 16, 3)), M.skin);
    // 손: 펼친 손(살짝 굽힌 손가락) 과 주먹 두 벌
    const mk = (fist) => {
      const hg = new THREE.Group(); hg.scale.setScalar(0.92); hg.position.y = -0.006; ha.add(hg);
      add(hg, C('palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.019 + 0.003 * Math.sin(v * Math.PI), rz: 0.034 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), M.skin);
      for (let k = 0; k < 4; k++) {
        const z = 0.025 - k * 0.0165, L = k === 3 ? 0.84 : 1, pts = [], curl = fist ? 2.7 : 0.75 + k * 0.12, len = fist ? 0.03 : 0.036;
        for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * len + s * 0.003, -0.05 + Math.sin(th) * len - (fist ? 0 : 0.012 * i / 8), z)); }
        add(hg, C(`fing${s}${fist ? 'f' : 'o'}${k}`, () => strand(pts, 0.0078, 0.0062, { seg: 14, rad: 8 })), M.skin);
        add(hg, C('nail', () => new THREE.SphereGeometry(0.0055, 8, 6)), M.nail, pts[8].toArray(), [0, 0, 0], [1, 1, 0.6]);
      }
      add(hg, C('thumb' + s + (fist ? 'f' : 'o'), () => strand(fist ? [[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.004, -0.058, 0.044], [s * 0.018, -0.068, 0.034]] : [[0, -0.016, 0.03], [-s * 0.012, -0.036, 0.046], [-s * 0.012, -0.058, 0.052], [-s * 0.008, -0.074, 0.054]], 0.0092, 0.0068, { seg: 12, rad: 8 })), M.skin);
      return hg;
    };
    const open = mk(false), fist = mk(true); fist.visible = false; m.hands[s > 0 ? 'L' : 'R'] = { open, fist };
  }

  /* ---------- 다리: 검은 슬림 바지 · 검은 구두 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.082], [0.4, 0.074], [0.85, 0.058], [1, 0.055]]), thF = spl([[0, 0.08], [0.5, 0.068], [1, 0.055]]), thB = spl([[0, 0.082], [0.35, 0.072], [1, 0.052]]);
    add(hp, C('thigh', () => loft((v) => ({ y: 0.03 - L * v, rx: thX(v), rzF: thF(v), rzB: thB(v) }), 28, 12)), M.pants);
    const cX = spl([[0, 0.054], [0.3, 0.054], [0.75, 0.046], [1, 0.045]]), cF = spl([[0, 0.052], [0.5, 0.048], [1, 0.045]]), cB = spl([[0, 0.054], [0.3, 0.058], [0.7, 0.048], [1, 0.046]]);
    add(kn, C('shin', () => loft((v) => ({ y: 0.025 - (DIMS.shin - 0.045) * v, rx: cX(v), rzF: cF(v), rzB: cB(v) }), 28, 12)), M.pants);
    // 구두: 매끈한 검은 가죽 (앞코가 길고 낮음) · 밑창 · 굽
    const fw = spl([[0, 0.0], [0.08, 0.034], [0.3, 0.038], [0.62, 0.042], [0.88, 0.032], [1, 0.008]]), fh = spl([[0, 0.05], [0.1, 0.075], [0.3, 0.08], [0.58, 0.046], [0.85, 0.032], [1, 0.016]]);
    const FB = -0.07, shoe = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.7; p.set(Math.sign(c) * Math.abs(c) ** e * w, FB + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.07 + 0.28 * v); };
    add(ft, C('shoe', () => surf(shoe, 28, 20, { closedU: true })), M.shoe);
    add(ft, C('sole', () => surf((u, v, p) => { const [c, sn] = ang(u), e = 0.3; p.set(Math.sign(c) * Math.abs(c) ** e * (fw(v) + 0.003), FB - 0.012 + 0.012 * (Math.sign(sn) * Math.abs(sn) ** e + 1) / 2, -0.072 + 0.284 * v); }, 24, 14, { closedU: true })), M.sole);
    // 바짓단 (구두 위를 살짝 덮음)
    add(ft, C('hem', () => loft((v) => ({ y: -0.01 + 0.07 * v, rx: 0.048 - 0.002 * v, rzF: 0.054 - 0.004 * v, rzB: 0.05 - 0.002 * v }), 24, 3)), M.pants);
  }

  /* ---------- 목 · 얼굴 · 하얀 머리 · 붕대 안대 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.14 * v, rx: 0.037 - 0.007 * smooth(0.2, 0.8, v), rzF: 0.036 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.036 - 0.004 * v }), 20, 6)), M.skin);
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.1);
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.068, 0.108, -0.004], [s * 0.08, 0.112, -0.012], [s * 0.084, 0.096, -0.018], [s * 0.076, 0.08, -0.01]], 0.013, 0.007, { seg: 10, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  // 붕대 안대: 눈 높이에서 머리를 한 바퀴 (앞은 눈썹~콧대 위 · 뒤는 조금 높게) — 앞은 눈두덩을 평평하게 덮는다
  const bandC = (az) => 0.07 + 0.1 * (1 - Math.cos(az)) * 0.5, bandW = (az) => 0.36 - 0.08 * (1 - Math.cos(az)) * 0.5;
  const bandPt = (az, k, off, out) => { headAt(az, bandC(az) + (k - 0.5) * bandW(az), off, out); const fz = Math.max(0, Math.cos(az)); out.z = Math.max(out.z, HC.z + HR[2] * (0.93 - 0.06 * Math.abs(k - 0.5)) * fz * fz); return out; };
  add(H, C('band', () => surf((u, v, p) => bandPt(u * TAU, v, 0.007 + 0.002 * Math.sin(v * Math.PI), p), 96, 6, { closedU: true, uvU: 1 })), M.band);
  for (const k of [0, 1]) { const pts = []; for (let i = 0; i < 64; i++) pts.push(bandPt((i / 64) * TAU, k, 0.0075, new V3())); rim(H, 'bandE' + k, pts, 0.0022, true, M.bandT); }
  // 뒤 매듭
  { const p = bandPt(Math.PI, 0.5, 0.014, new V3()); add(H, C('knot', () => new THREE.SphereGeometry(0.016, 14, 10)), M.bandT, p.toArray(), [0, 0, 0], [1.3, 0.9, 0.8]); m.knotP = p; }
  {
    // 두피 (흰 머리 바탕): 앞은 안대 바로 위까지, 옆은 귀 위, 뒤는 목덜미
    const line = (az) => { const w = Math.cos(az); return w > 0 ? bandC(az) + bandW(az) * 0.5 - 0.02 : bandC(az) + bandW(az) * 0.5 - 0.02 - 0.95 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    const r = rng(19), UPV = new V3(0, 1, 0);
    // 뾰족한 가닥: 뿌리(두피) → 바깥 + 위로 솟아오름. up: 위로 쓸리는 정도, len: 길이
    const spike = (key, az, el, up, len, r0, droop = 0) => {
      const root = headAt(az, el, 0.004), n = headN(root).clone(), dir = n.clone().multiplyScalar(1).addScaledVector(UPV, up).normalize();
      const side = new V3().crossVectors(n, UPV); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
      const j = (r() - 0.5) * 0.4, d2 = dir.clone().addScaledVector(side, j).normalize();
      const p1 = root.clone().addScaledVector(n, 0.016), p2 = p1.clone().addScaledVector(d2, len * 0.45), tip = p1.clone().addScaledVector(d2, len).addScaledVector(UPV, -droop * len);
      const mid = p2.clone().addScaledVector(n, 0.006);
      add(H, C(key, () => strand([root.toArray(), p1.toArray(), mid.toArray(), tip.toArray()], r0, 0.0012, { seg: 14, rad: 7, flat: 0.4, ref: n.toArray() })), M.hair);
    };
    // 정수리 · 윗머리: 바깥 · 위로 뻗친 뾰족한 가닥 (둥근 부피)
    for (let k = 0; k < 9; k++) { const az = (k / 9) * TAU + r() * 0.4, el = 1.2 + r() * 0.25; spike('top' + k, az, el, 0.45, 0.055 + r() * 0.02, 0.03 + r() * 0.008); }
    for (let k = 0; k < 16; k++) { const az = (k / 16) * TAU + 0.2 + r() * 0.2, el = 0.85 + r() * 0.15, w = Math.cos(az); spike('mid' + k, az, el, w > 0.3 ? 0.5 : 0.2, 0.07 + r() * 0.025 + 0.02 * Math.max(0, w), 0.03 + r() * 0.006); }
    for (let k = 0; k < 20; k++) { const az = (k / 20) * TAU + r() * 0.15, el = 0.52 + r() * 0.14, w = Math.cos(az); spike('low' + k, az, el, w > 0.3 ? 0.5 : 0.1, 0.075 + r() * 0.03, 0.028 + r() * 0.006, w > 0.3 ? 0 : 0.15); }
    // 앞머리: 안대에 밀려 위 · 앞으로 솟은 가닥
    for (let k = 0; k < 13; k++) { const az = -1.0 + (k / 12) * 2.0 + (r() - 0.5) * 0.08, el = line(az) + 0.08 + r() * 0.06; spike('bangU' + k, az, el, 0.75 + r() * 0.3, 0.075 + r() * 0.03 + 0.015 * Math.cos(az), 0.026 + r() * 0.006); }
    // 안대 위로 흘러내리는 짧은 앞머리 몇 가닥
    for (const [az, len] of [[-0.18, 0.05], [0.12, 0.055], [0.42, 0.04], [-0.48, 0.04]]) { const el = line(az) + 0.16; spike('bangD' + az, az, el, -0.5, len, 0.02, 0.6); }
    // 옆머리: 귀 위를 덮으며 바깥 · 아래로
    for (let k = 0; k < 12; k++) { const sd = k < 6 ? 1 : -1, az = sd * (1.1 + (k % 6) * 0.2), el = 0.3 + r() * 0.1; spike('side' + k, az, el, -0.2, 0.055 + r() * 0.02, 0.026, 0.35); }
    // 뒷머리 · 목덜미: 아래 · 뒤로 뻗친 짧은 가닥
    for (let k = 0; k < 16; k++) { const az = Math.PI + (k / 15 - 0.5) * 2.6, el = 0.0 + r() * 0.35; spike('back' + k, az, el, -0.25 + (el > 0.2 ? 0.4 : 0), 0.065 + r() * 0.025, 0.028, 0.25); }
    for (let k = 0; k < 9; k++) { const az = Math.PI + (k / 8 - 0.5) * 1.8, el = -0.45 + r() * 0.15; spike('nape' + k, az, el, -0.7, 0.05 + r() * 0.015, 0.024, 0.4); }
  }
  // 안대 뒤 매듭에서 늘어진 두 끝 (로프 물리 · 납작한 리본)
  for (const s of [-1, 1]) {
    const rope = new Rope(5, 0.04, { damp: 0.975, stiff: 0.2 }), view = new RopeTube(rope, M.bandT, { sub: 3, rad: 8, flat: 0.16, side: new V3(1, 0, 0), prof: (v) => 0.017 * (1 - 0.15 * v) });
    m.ropes.push({ rope, view, joint: H, local: m.knotP.clone().add(new V3(s * 0.008, -0.004, 0)), rest: new V3(s * 0.25, -1, -0.5).normalize(), sideL: new V3(1, 0, 0) });
  }
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion(), lag = { L: 0, R: 0, vL: 0, vR: 0, sw: 0 };
  m.update = (dt, f) => {
    const vis = f.root.visible, sc = f.scale;
    // 자락: 다리 각도를 스프링으로 따라 출렁임 (달리면 뒤로 날림)
    lag.vL += ((J.hipL.rotation.x - lag.L) * 140 - lag.vL * 14) * dt; lag.L += lag.vL * dt; lag.vR += ((J.hipR.rotation.x - lag.R) * 140 - lag.vR * 14) * dt; lag.R += lag.vR * dt;
    const spd = Math.hypot(f.vel.x, f.vel.z); lag.sw += (Math.min(1, spd / 7) - lag.sw) * (1 - Math.exp(-dt * 10));
    { const base = m.skirt.base, pa = m.skirt.geo.attributes.position, arr = pa.array, spread = Math.abs(lag.L - lag.R), zL = -Math.sin(clamp(lag.L, -1.5, 1.5)), zR = -Math.sin(clamp(lag.R, -1.5, 1.5));
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2], depth = Math.max(0, 0.025 - y), wL = clamp(0.5 + x / 0.15, 0, 1), wR = 1 - wL, front = clamp(z / 0.14, 0, 1);
        const dz = (wL * zL + wR * zR) * depth * (0.6 + 0.4 * front), out = 1 + (spread * 0.28 + lag.sw * 0.12) * (depth / SK_L);
        arr[i] = x * out; arr[i + 1] = y + Math.abs(dz) * 0.3; arr[i + 2] = z * out + dz - lag.sw * 0.16 * depth;
      }
      pa.needsUpdate = true; m.skirt.geo.computeVertexNormals(); }
    // 안대 끝 (로프)
    H.updateMatrixWorld(true);
    const h0 = f.hurt[0], torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.75 + 0.04 * sc };
    const caps = [torso, { a: H.localToWorld(tmp2.copy(HC)), b: H.localToWorld(new V3().copy(HC)), r: 0.118 * sc }];
    H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq); const windV = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6);
    for (const r of m.ropes) { r.joint.localToWorld(tmp.copy(r.local)); r.view.side.copy(r.sideL).applyQuaternion(hq);
      r.rope.step(dt, tmp, caps, f.pos.y + 0.01, r.rest.clone().applyQuaternion(hq), windV); r.view.update(); r.view.mesh.visible = vis; }
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    // 손: 기술의 fist 값 ('L' · 'R' · 'LR') 에 따라 주먹
    const fi = (f.state === 'act' && f.act && f.act.fist) || (f.state === 'guard' ? 'LR' : '');
    // 주머니: 손이 옆 주머니 트임에 닿아 있으면 손을 감춘다 (주머니에 넣은 손)
    const pk = {}; for (const [k, s] of [['L', 1], ['R', -1]]) { J.hips.localToWorld(tmp.set(s * 0.18, -0.04, 0.11)); J['hand' + k].getWorldPosition(tmp2); pk[k] = tmp.distanceTo(tmp2) < 0.075 * sc; }
    for (const k of ['L', 'R']) { const on = fi.includes(k); m.hands[k].fist.visible = on && !pk[k]; m.hands[k].open.visible = !on && !pk[k]; }
  };
  m.setWeapon = (v) => { m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.082;
  // 오른손 무기 관절: 몸 기준 [피치, 좌우, 롤] (맨손이지만 규칙 유지 — 손 이펙트 기준점)
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  // 궤적 기준: 오른 아래팔 → 주먹 (판정은 기술마다 구로 함)
  m.weaponPts = (b, t) => { J.elbowR.localToWorld(b.set(0, -DIMS.lArm * 0.5, 0)); J.handR.localToWorld(t.set(0, -0.07, 0)); };
  m.trailPts = (b, t) => { J.handR.localToWorld(b.set(0, -0.02, 0)); J.handR.localToWorld(t.set(0, -0.08, 0)); };
  // 손 · 발 위치 (술식 이펙트 기준)
  m.handPos = (side, out = new V3()) => { const h = side === 'L' ? J.handL : J.handR; h.updateMatrixWorld(true); return h.localToWorld(out.set(side === 'L' ? 0.012 : -0.012, -0.06, 0.012)); };
  m.footPos = (side, out = new V3()) => { const ft = side === 'L' ? J.footL : J.footR; ft.updateMatrixWorld(true); return ft.localToWorld(out.set(0, -0.03, 0.12)); };
  m.tipPos = (out = new V3()) => m.handPos('R', out);
  m.extras = extras;
  return m;
}
