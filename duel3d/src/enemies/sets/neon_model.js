// 네온 시티 옥상 몬스터 3D 모델: 사이버 깡패 · 저격 드론 · 중장갑 메크 · 메가 메크 오버클럭 (+ 실드 발생기 · 지원 드론)
//
//   사이버 깡패   — 가죽 재킷(네온 지퍼 · 뒷자락 로프 2) · 왼팔 의수(관절 발광 링 · 유압봉) · 네온 모히칸 · 고글 바이저 + 호흡기 · 네온 마체테
//   저격 드론     — 유선형 동체 · 덕트 프로펠러 넷 · 카메라 렌즈 눈 · 동체 아래 레일건 · 조준 레이저(사격 준비 중)
//   중장갑 메크   — 각진 장갑판(경고 줄무늬) · 조종석 바이저 · 오른팔 파일 드라이버(말뚝이 튀어나감) · 왼팔 방패 · 배기통
//   오버클럭     — 날렵한 대형 메크 · 가슴 반응로(과열 시 주황 · 장갑판이 열려 증기) · 어깨 미사일 포드(덮개 열림) · 등 쌍발 추진기(부스트 불꽃)
//                  오른팔 플라즈마 블레이드 · 왼팔 레이저 캐논 · 모노아이 · 실드 돔(2페이즈)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { Rope, RopeTube } from '../../cloth.js';
import { surf, loft, loftAt, loftRing, strand, spl, gauss, smooth, envCube, cached } from '../../sculpt.js';
import { GOLEM_DIMS } from '../bodies.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = (k, fn) => cached('neon:' + k, fn);
const _tx = {}; const TX = (k, f) => _tx[k] || (_tx[k] = f());
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function rng(s) { s = (s * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/* =====================================================================
   텍스처
   ===================================================================== */
// 장갑판: 금속 바탕 · 판 이음선 · 리벳 · 긁힘 · 경고 줄무늬(선택) / 발광 맵: 가는 네온 선
function panelTex(seed, base, o = {}) {
  const S = 512, [c, g] = cv(S, S), [c2, g2] = cv(S, S), [c3, g3] = cv(S, S), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S); g2.fillStyle = '#000'; g2.fillRect(0, 0, S, S); g3.fillStyle = '#808080'; g3.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)'; g.fillRect(r() * S, r() * S, 1 + r() * 30, 1); }
  // 판 나누기
  const cells = [[0, 0, S, S]];
  for (let k = 0; k < 9; k++) { const i = (r() * cells.length) | 0, [x, y, w, h] = cells[i]; if (w < 90 || h < 90) continue; cells.splice(i, 1); if (r() < 0.5) { const m = w * (0.3 + r() * 0.4); cells.push([x, y, m, h], [x + m, y, w - m, h]); } else { const m = h * (0.3 + r() * 0.4); cells.push([x, y, w, m], [x, y + m, w, h - m]); } }
  for (const [x, y, w, h] of cells) {
    const shade = (r() - 0.5) * 18; g.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${Math.abs(shade) / 255})`; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    g3.strokeStyle = '#202020'; g3.lineWidth = 4; g3.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    for (const [px, py] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(px, py, 3.2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(px - 0.8, py - 0.8, 1.6, 0, TAU); g.fill(); g3.fillStyle = '#c0c0c0'; g3.beginPath(); g3.arc(px, py, 3, 0, TAU); g3.fill(); }
    if (o.hazard && r() < 0.22 && w > 120) { g.save(); g.beginPath(); g.rect(x + 6, y + h - 34, w - 12, 24); g.clip(); g.fillStyle = '#e8b818'; g.fillRect(x, y + h - 34, w, 24); g.fillStyle = '#141414'; for (let k = -40; k < w + 40; k += 28) { g.beginPath(); g.moveTo(x + k, y + h - 34); g.lineTo(x + k + 14, y + h - 34); g.lineTo(x + k - 10, y + h - 10); g.lineTo(x + k - 24, y + h - 10); g.closePath(); g.fill(); } g.restore(); }
    if (o.neon && r() < 0.5) { g2.strokeStyle = '#fff'; g2.lineWidth = 2.5; const yy = y + 12 + r() * (h - 24); g2.beginPath(); g2.moveTo(x + 10, yy); g2.lineTo(x + w * (0.4 + r() * 0.5), yy); g2.stroke(); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 10, yy); g.lineTo(x + w * 0.5, yy); g.stroke(); }
    if (o.text && r() < 0.18) { g.fillStyle = 'rgba(230,230,240,0.55)'; g.font = 'bold 16px monospace'; g.fillText(['OC-9', 'MK-II', 'XR', '07', 'HV'][(r() * 5) | 0], x + 14, y + 30); }
  }
  return { map: tex(c), emi: tex(c2), bump: tex(c3, false) };
}
// 가죽 재킷: 검은 가죽 결 · 바느질 · 등 그래피티 해골 / 바지: 짙은 천
function leatherTex() {
  const S = 512, [c, g] = cv(S, S), r = rng(21); g.fillStyle = '#16141a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)'; const x = r() * S, y = r() * S; g.beginPath(); g.ellipse(x, y, 1 + r() * 4, 1 + r() * 2, r() * 3, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(160,150,170,0.35)'; g.setLineDash([4, 4]); g.lineWidth = 1.5; for (const y of [30, 480]) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); } for (const x of [128, 384]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); } g.setLineDash([]);
  // 등(u=0 → x=0 근처)의 해골 그래피티
  const sk = (cx) => { g.fillStyle = '#ff2ad8'; g.globalAlpha = 0.85; g.beginPath(); g.arc(cx, 250, 46, Math.PI, 0); g.lineTo(cx + 34, 300); g.lineTo(cx - 34, 300); g.closePath(); g.fill(); g.fillStyle = '#16141a'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 18, 255, 11, 0, TAU); g.fill(); } g.fillRect(cx - 4, 272, 8, 12); for (let i = -2; i <= 2; i++) g.fillRect(cx + i * 12 - 3, 292, 6, 10); g.globalAlpha = 1; };
  sk(0); sk(S);
  return tex(c);
}
function clothTex(col, seed) { const S = 256, [c, g] = cv(S, S), r = rng(seed); g.fillStyle = col; g.fillRect(0, 0, S, S); for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.1)'; g.fillRect(r() * S, r() * S, 1, 2 + r() * 4); } g.strokeStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < S; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + 2); g.stroke(); } return tex(c); }

/* =====================================================================
   공통 조형 도우미
   ===================================================================== */
const mesh = (parent, geo, mat, p, r, s) => { const me = new THREE.Mesh(geo, mat); if (p) me.position.set(p[0], p[1], p[2]); if (r) me.rotation.set(r[0], r[1], r[2]); if (s) me.scale.set(s[0], s[1], s[2]); parent.add(me); return me; };
const orient = (me, from, to) => { me.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3().subVectors(to, from).normalize()); me.position.copy(from); return me; };
// 모서리가 둥근 상자 (초타원 단면 로프트 · 위아래 모서리도 둥글게): 중심 원점, 높이 = y
function boxR(key, w, h, d, o = {}) {
  const b = o.bevel ?? 0.18, n = o.n ?? 5, tw = o.taper ?? 0, td = o.taperD ?? 0;
  return C('box' + key, () => loft((v) => { const e = Math.min(v, 1 - v) / b, k = e >= 1 ? 1 : Math.sqrt(1 - (1 - e) ** 2) * 0.35 + 0.65 * (1 - (1 - e) ** 2); const kk = Math.max(0.04, k);
    return { y: -h / 2 + h * v, rx: (w / 2) * kk * (1 - tw * v), rzF: (d / 2) * kk * (1 - td * v) + (o.front ?? 0) * v, rzB: (d / 2) * kk * (1 - td * v), n, cz: (o.lean ?? 0) * v }; }, o.nu ?? 28, o.nv ?? 10, { uvU: o.uvU ?? 1, uvV: o.uvV ?? 1 }));
}
const cyl = (key, r0, r1, h, seg = 16) => C('cyl' + key, () => new THREE.CylinderGeometry(r1, r0, h, seg));
const tubeZ = (key, r0, r1, h, seg = 16) => C('tz' + key, () => { const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, h / 2); return g; });
const coneG = (key, r, h, seg = 7) => C('cone' + key, () => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; });
function limbGeo(key, len, top, rx, rzF, rzB, o = {}) {
  const f = (x) => (typeof x === 'function' ? x : () => x), RX = f(rx), RF = f(rzF), RB = f(rzB ?? rzF);
  return C(key, () => loft((v) => ({ y: top - (len + top) * v, rx: RX(v), rzF: RF(v), rzB: RB(v), n: o.n ?? 2 }), o.nu ?? 20, o.nv ?? 10, { mod: o.mod, uvU: o.uvU ?? 1 }));
}
function makeHead(key, o, mod, nu = 48, nv = 36) {
  const pt = (az, el, off = 0, out = new V3()) => { const ce = Math.cos(el); out.set(Math.sin(az) * ce * o.rx, Math.sin(el) * o.ry, Math.cos(az) * ce * (Math.cos(az) > 0 ? o.rzF : o.rzB)); const L = out.length() || 1e-6, d = (mod ? mod(az, el) : 0) + off; out.multiplyScalar(1 + d / L); return out.add(o.c); };
  return { geo: C(key, () => surf((u, v, p) => pt((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI, 0, p), nu, nv, { closedU: true, poles: [0, nv] })), pt };
}
function ropeKit(m) {
  m.ropes = []; const extras = [];
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  const tmp = new V3(), rq = new THREE.Quaternion(), jq = new THREE.Quaternion();
  return (dt, f) => {
    const vis = f.root.visible, G = f.G, h0 = f.hurt[0], caps = [{ a: h0.a, b: h0.b, r: h0.r * 0.95 }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * f.scale }))];
    const wind = new V3(-f.vel.x * 0.7 + Math.sin(G.time * 1.3) * 0.8, 0, -f.vel.z * 0.7 + Math.cos(G.time * 1.1) * 0.8); m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) { r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local)); if (r.sideL) { r.joint.getWorldQuaternion(jq); r.view.side.copy(r.sideL).applyQuaternion(jq); }
      r.rope.step(dt, tmp, caps, f.pos.y + 0.02, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = vis; }
  };
}
// 손 (장갑 · 기계 손): 손바닥 + 손가락 넷 + 엄지
function buildHand(parent, key, s, mat, o = {}) {
  const g = new THREE.Group(); g.scale.setScalar(o.k ?? 1); parent.add(g);
  mesh(g, C(key + 'palm', () => loft((v) => ({ y: 0.005 - 0.065 * v, rx: 0.022 + 0.004 * Math.sin(v * Math.PI), rz: 0.034 + 0.003 * v, n: 2.8 }), 14, 6)), mat);
  for (let i = 0; i < 4; i++) { const z = 0.026 - i * 0.017, L = i === 3 ? 0.05 : 0.065, pts = []; for (let j = 0; j <= 5; j++) { const t = j / 5, a = t * 1.2; pts.push(new V3(-s * L * 0.45 * (1 - Math.cos(a)), -0.058 - L * Math.sin(a) / 1.2 * 0.95, z)); }
    mesh(g, C(key + 'fg' + s + i, () => strand(pts, 0.0095, 0.008, { seg: 8, rad: 6 })), mat); }
  mesh(g, C(key + 'th' + s, () => strand([new V3(-s * 0.012, -0.012, 0.03), new V3(-s * 0.022, -0.035, 0.044), new V3(-s * 0.02, -0.056, 0.048)], 0.01, 0.008, { seg: 8, rad: 6 })), mat);
  return g;
}

/* =====================================================================
   1. 사이버 깡패
   ===================================================================== */
export const THUG_DIMS = { hipH: 0.96, spineL: 0.21, chestL: 0.29, neckL: 0.09, shW: 0.2, uArm: 0.29, lArm: 0.27, hipW: 0.095, thigh: 0.44, shin: 0.43, headTop: 0.27 };
export function buildThug(pal) {
  const D = THUG_DIMS, m = buildHumanoid(D), J = m.J, env = envCube(), stepRopes = ropeKit(m);
  const P = TX('thugPanel', () => panelTex(5, '#5a5c68', {}));
  const NEON = pal.accent ?? 0xff2ad8, CY = pal.trim ?? 0x2affff;
  const M = {
    jacket: new THREE.MeshStandardMaterial({ map: TX('leather', leatherTex), roughness: 0.42, metalness: 0.15, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.3 }),
    pants: new THREE.MeshStandardMaterial({ map: TX('pants', () => clothTex('#24262e', 9)), roughness: 0.9, side: THREE.DoubleSide }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc89a80, roughness: 0.55 }), hair: new THREE.MeshBasicMaterial({ color: NEON }),
    metal: new THREE.MeshStandardMaterial({ map: P.map, bumpMap: P.bump, bumpScale: 1, color: 0xd0d4e0, metalness: 0.85, roughness: 0.3, envMap: env, envMapIntensity: 1, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x18181e, metalness: 0.6, roughness: 0.35, envMap: env, envMapIntensity: 0.6 }),
    neon: new THREE.MeshBasicMaterial({ color: NEON }), cyan: new THREE.MeshBasicMaterial({ color: CY }),
    visor: new THREE.MeshStandardMaterial({ color: 0x100a14, emissive: NEON, emissiveIntensity: 1.6, metalness: 0.5, roughness: 0.1, envMap: env }),
    shoe: new THREE.MeshStandardMaterial({ color: 0xe8e8ee, roughness: 0.5 }), blade: new THREE.MeshStandardMaterial({ color: 0x9aa0b0, metalness: 1, roughness: 0.18, envMap: env, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    edge: new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  /* ---------- 하체: 바지 · 무릎 보호대 · 운동화(네온 밑창) ---------- */
  mesh(J.hips, C('tPelvis', () => loft((v) => ({ y: 0.1 - 0.2 * v, rx: (0.13 + 0.01 * Math.sin(v * Math.PI)) * (1 - 0.75 * smooth(0.75, 1, v)), rzF: 0.095 * (1 - 0.7 * smooth(0.8, 1, v)), rzB: 0.105 * (1 - 0.7 * smooth(0.8, 1, v)) }), 28, 8)), M.pants);
  const beltP = (v) => ({ y: 0.04 + 0.04 * v, rx: 0.136, rzF: 0.1, rzB: 0.11, n: 2.2 });
  mesh(J.hips, C('tBelt', () => loft(beltP, 32, 2)), M.dark); mesh(J.hips, C('tBuckle', () => new THREE.BoxGeometry(0.05, 0.035, 0.01)), M.metal, [0, 0.06, 0.103]);
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    mesh(hp, limbGeo('tTh', D.thigh, 0.04, (v) => 0.072 - 0.016 * v, (v) => 0.07 - 0.014 * v, (v) => 0.074 - 0.018 * v, { nu: 20, nv: 10 }), M.pants);
    mesh(hp, boxR('tPocket', 0.03, 0.09, 0.07, { bevel: 0.25 }), M.pants, [s * 0.066, -0.2, 0.0]);
    mesh(kn, limbGeo('tSh', D.shin, 0.02, (v) => 0.055 - 0.012 * v, (v) => 0.055 - 0.012 * v, (v) => 0.058 + 0.008 * gauss(v - 0.3, 0.2) - 0.016 * v), M.pants);
    mesh(kn, boxR('tKnee', 0.08, 0.1, 0.03, { bevel: 0.3 }), M.dark, [0, -0.02, 0.055], [0.15, 0, 0]);
    mesh(kn, C('tKneeL', () => new THREE.BoxGeometry(0.05, 0.008, 0.006)), M.cyan, [0, -0.02, 0.072]);
    const shoe = C('tShoe', () => { const g = loft((v) => ({ y: -0.065 + 0.25 * v, rx: 0.045 + 0.008 * Math.sin(v * Math.PI), rzF: 0.04 * (1 - 0.4 * v ** 2) + 0.01, rzB: 0.028, n: 2.4 }), 20, 8); g.rotateX(Math.PI / 2); g.translate(0, -0.045, 0); return g; });
    mesh(ft, shoe, M.shoe);
    { const pts = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; pts.push(new V3(Math.cos(a) * 0.05, -0.08, 0.06 + Math.sin(a) * 0.13)); } mesh(ft, C('tSole', () => strand(pts, 0.008, 0.008, { closed: true, seg: 48, rad: 5 })), M.neon); }
  }
  /* ---------- 상체: 가죽 재킷 (네온 지퍼 · 깃 · 뒤로 넘긴 후드) ---------- */
  mesh(J.spine, C('tBelly', () => loft((v) => ({ y: -0.06 + 0.28 * v, rx: 0.13 + 0.008 * v, rzF: 0.095, rzB: 0.1 }), 32, 8)), M.jacket);
  const chP = (v) => ({ y: -0.03 + 0.31 * v, rx: spl([[0, 0.138], [0.6, 0.155], [0.85, 0.15], [1, 0.08]])(v), rzF: spl([[0, 0.1], [0.6, 0.11], [1, 0.07]])(v), rzB: spl([[0, 0.105], [0.6, 0.112], [1, 0.07]])(v) });
  mesh(J.chest, C('tChest', () => loft(chP, 36, 12)), M.jacket);
  // 재킷 밑단 (골반을 살짝 덮음)
  mesh(J.hips, C('tHem', () => loft((v) => ({ y: 0.14 - 0.12 * v, rx: 0.142 + 0.012 * v, rzF: 0.105 + 0.01 * v, rzB: 0.115 + 0.012 * v }), 32, 3)), M.jacket);
  { const zp = []; for (let i = 0; i <= 14; i++) { const q = loftAt(chP, 0.5, i / 14 * 0.92, new V3()); q.z += 0.004; q.x += 0.012; zp.push(q); } mesh(J.chest, C('tZip', () => strand(zp, 0.004, 0.004, { seg: 30, rad: 5 })), M.neon); }
  mesh(J.chest, C('tCollar', () => loft((v) => ({ y: 0.25 + 0.07 * v, rx: 0.085 + 0.012 * v, rzF: 0.075 + 0.015 * v, rzB: 0.08 + 0.02 * v }), 24, 3, { a0: 0.58, a1: 1.42 })), M.jacket);
  mesh(J.chest, C('tHood', () => loft((v) => ({ y: 0.26 - 0.14 * v, rx: 0.1 + 0.02 * Math.sin(v * Math.PI), rzF: 0.05, rzB: 0.07 + 0.05 * Math.sin(v * Math.PI), cz: -0.07 }), 24, 6, { a0: 0.75, a1: 1.25 })), M.jacket);
  /* ---------- 오른팔: 소매 · 장갑 / 왼팔: 의수 (관절 링 발광 · 유압봉) ---------- */
  mesh(J.shoulderR, C('tShR', () => new THREE.SphereGeometry(0.07, 14, 10)), M.jacket, [-0.01, -0.01, 0]);
  mesh(J.shoulderR, limbGeo('tUAR', D.uArm, 0.03, (v) => 0.054 - 0.006 * v, 0.054), M.jacket);
  mesh(J.elbowR, limbGeo('tFAR', D.lArm - 0.02, 0.02, (v) => 0.05 - 0.008 * v, (v) => 0.05 - 0.008 * v), M.jacket);
  mesh(J.elbowR, cyl('tCuff', 0.044, 0.046, 0.03), M.dark, [0, -D.lArm + 0.04, 0]);
  buildHand(J.handR, 'tGlove', -1, M.dark, { k: 1.05 });
  mesh(J.shoulderL, boxR('tCyShL', 0.15, 0.11, 0.13, { bevel: 0.3 }), M.metal, [0.03, 0.0, 0]);
  mesh(J.shoulderL, C('tCyRing', () => new THREE.TorusGeometry(0.05, 0.007, 6, 18)), M.cyan, [0.0, -0.06, 0], [Math.PI / 2, 0, 0]);
  mesh(J.shoulderL, limbGeo('tCyUA', D.uArm - 0.04, -0.05, (v) => 0.04 - 0.004 * v, 0.042, null, { n: 3 }), M.metal);
  for (const s of [-1, 1]) mesh(J.shoulderL, cyl('tRod', 0.008, 0.008, D.uArm - 0.1), M.dark, [0.0, -0.17, s * 0.045]);
  mesh(J.elbowL, C('tCyEl', () => new THREE.SphereGeometry(0.042, 14, 10)), M.dark); mesh(J.elbowL, C('tCyElR', () => new THREE.TorusGeometry(0.043, 0.006, 6, 18)), M.cyan, [0, 0, 0], [0, Math.PI / 2, 0]);
  mesh(J.elbowL, limbGeo('tCyFA', D.lArm - 0.02, -0.03, (v) => 0.042 + 0.006 * Math.sin(v * Math.PI) - 0.01 * v, (v) => 0.045 - 0.008 * v, null, { n: 3 }), M.metal);
  mesh(J.elbowL, C('tCyLed', () => new THREE.BoxGeometry(0.006, 0.12, 0.012)), M.neon, [0.046, -0.14, 0.0]);
  buildHand(J.handL, 'tCyH', 1, M.metal, { k: 1.05 });
  /* ---------- 머리: 얼굴 · 고글 바이저 · 호흡기 · 네온 모히칸 ---------- */
  mesh(J.neck, limbGeo('tNeck', 0.0, 0.11, 0.045, 0.045, 0.048), M.skin, [0, 0, 0], [Math.PI, 0, 0]);
  const HD = makeHead('thugHead', { c: new V3(0, 0.11, 0.01), rx: 0.084, ry: 0.11, rzF: 0.1, rzB: 0.094 }, (az, el) => { const fr = Math.max(0, Math.cos(az)); let d = 0.008 * fr * gauss(el - 0.25, 0.1) + 0.018 * gauss(az, 0.16) * gauss(el + 0.05, 0.12) - 0.006 * fr * smooth(-0.2, -0.9, el) * (1 - smooth(-1.1, -1.4, el)); for (const s of [-1, 1]) d -= 0.008 * gauss(az - s * 0.35, 0.15) * gauss(el - 0.12, 0.1); return d; });
  const H = J.head; mesh(H, HD.geo, M.skin);
  // 고글 바이저 (얼굴을 감싸는 띠)
  { const vP = (v) => ({ y: 0.115 + 0.04 * v, rx: 0.094, rzF: 0.112, rzB: 0.1 }); mesh(H, C('tVisor', () => loft(vP, 36, 2, { a0: 0.22, a1: 0.78 })), M.visor);
    mesh(H, C('tStrap', () => loft((v) => ({ y: 0.12 + 0.025 * v, rx: 0.09, rzF: 0.1, rzB: 0.1 }), 32, 2, { a0: -0.24, a1: 0.24 })), M.dark); }
  // 호흡기
  mesh(H, boxR('tResp', 0.1, 0.06, 0.05, { bevel: 0.35, n: 3 }), M.dark, [0, 0.035, 0.085], [Math.PI / 2 - 0.25, 0, 0]);
  for (const s of [-1, 1]) { mesh(H, cyl('tFilt', 0.02, 0.02, 0.035), M.metal, [s * 0.05, 0.03, 0.1], [Math.PI / 2, 0, s * 0.6]); mesh(H, cyl('tFiltG', 0.012, 0.012, 0.037), M.neon, [s * 0.05, 0.03, 0.1], [Math.PI / 2, 0, s * 0.6]); }
  // 귀걸이 · 모히칸
  for (const s of [-1, 1]) mesh(H, C('tEar', () => new THREE.TorusGeometry(0.01, 0.0025, 4, 10)), M.metal, [s * 0.086, 0.07, 0.0], [0, Math.PI / 2, 0]);
  for (let k = 0; k < 11; k++) { const el = 0.55 + k * 0.1 - (k > 9 ? 0.3 : 0), az = k < 6 ? 0 : Math.PI, ee = k < 6 ? 0.6 + k * 0.17 : 1.5 - (k - 5) * 0.2; const b = HD.pt(az, ee, -0.004), n = b.clone().sub(new V3(0, 0.11, 0.01)).normalize(), L = 0.07 + 0.03 * Math.sin(k * 0.6);
    mesh(H, C('tMoh' + k, () => strand([b, b.clone().addScaledVector(n, L * 0.5).add(new V3(0, 0.0, -0.01)), b.clone().addScaledVector(n, L).add(new V3(0, 0, -0.035))], 0.012, 0.001, { seg: 8, rad: 6, flat: 0.25, ref: [1, 0, 0] })), M.hair); void el; }
  /* ---------- 재킷 뒷자락 (로프 2) ---------- */
  for (const s of [-1, 1]) { const rope = new Rope(6, 0.07, { damp: 0.975, stiff: 0.1 }); const view = new RopeTube(rope, M.jacket, { sub: 3, rad: 8, flat: 0.15, side: new V3(1, 0, 0), prof: (v) => 0.055 * (1 - 0.3 * v) });
    m.ropes.push({ rope, view, joint: J.hips, local: new V3(s * 0.07, 0.04, -0.11), rest: new V3(s * 0.15, -1, -0.3).normalize(), sideL: new V3(1, 0, 0) }); }
  /* ---------- 무기: 네온 마체테 ---------- */
  const W = J.weapon, BL = 0.86;
  mesh(W, C('tGrip', () => { const g = new THREE.CylinderGeometry(0.018, 0.02, 0.18, 10); g.rotateX(Math.PI / 2); return g; }), M.dark, [0, 0, -0.02]);
  mesh(W, C('tGuard', () => new THREE.BoxGeometry(0.03, 0.08, 0.02)), M.metal, [0, 0.01, 0.08]);
  const bladeF = (u, v, p) => { const a = u * TAU, w = 0.045 + 0.025 * Math.sin(v * Math.PI * 0.9) - 0.04 * smooth(0.85, 1, v), th = 0.006 * (1 - v * 0.5); p.set(Math.cos(a) * th, Math.sin(a) > 0 ? Math.sin(a) * w : Math.sin(a) * 0.012, 0.09 + (BL - 0.09) * v + 0.02 * smooth(0.85, 1, v) * Math.max(0, Math.sin(a))); };
  mesh(W, C('tBlade', () => surf(bladeF, 10, 30, { closedU: true })), M.blade);
  { const pts = []; for (let i = 0; i <= 24; i++) { const q = new V3(); bladeF(0.25, i / 24, q); pts.push(q); } mesh(W, C('tEdge', () => strand(pts, 0.0035, 0.0015, { seg: 48, rad: 4 })), M.edge); }
  let t = Math.random() * 10;
  m.update = (dt, f) => { t += dt; M.visor.emissiveIntensity = 1.4 + 0.4 * Math.sin(t * 4) + (Math.random() < 0.02 ? -1 : 0); M.edge.opacity = f.state === 'act' ? 1 : 0.7; stepRopes(dt, f); };
  m.sole = 0.085;
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.12)); W.localToWorld(tt.set(0, 0, BL)); };
  m.tipPos = (out) => W.localToWorld(out.set(0, 0, BL));
  return m;
}

/* =====================================================================
   2. 저격 드론 (몸은 숨긴 리그 위에 뜬 기체)
   ===================================================================== */
const FLOAT_DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.2, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44, headTop: 0.24 };
export function buildDrone(pal, o = {}) {
  const m = buildHumanoid(FLOAT_DIMS), env = envCube(), k = o.k ?? 1, CY = pal.accent ?? 0x2affff, PK = pal.trim ?? 0xff2ad8;
  const P = TX('dronePanel', () => panelTex(13, '#4a4e5c', { neon: true, text: true }));
  const M = {
    hull: new THREE.MeshStandardMaterial({ map: P.map, bumpMap: P.bump, bumpScale: 0.8, emissiveMap: P.emi, emissive: CY, emissiveIntensity: 1.2, metalness: 0.75, roughness: 0.3, envMap: env, envMapIntensity: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x14141c, metalness: 0.7, roughness: 0.3, envMap: env, envMapIntensity: 0.7 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x050810, metalness: 0.2, roughness: 0.02, envMap: env, envMapIntensity: 2 }),
    cy: new THREE.MeshBasicMaterial({ color: CY }), pk: new THREE.MeshBasicMaterial({ color: PK }),
    blade: new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    laser: new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  const d = new THREE.Group(); d.position.y = 1.5; d.scale.setScalar(k); m.body.add(d); m.drone = d;
  // 동체: 앞이 둥글고 뒤로 가늘어지는 유선형 (단면 초타원)
  const hullP = (v) => { const z = -0.32 + 0.6 * v, w = 0.17 * Math.sin(Math.min(1, v * 1.15) * Math.PI) ** 0.6 + 0.01; return { y: z, rx: w * 1.1, rzF: w * 0.62, rzB: w * 0.5, n: 2.6 }; };
  mesh(d, C('dHull', () => { const g = loft(hullP, 32, 18); g.rotateX(Math.PI / 2); return g; }), M.hull);
  mesh(d, C('dSpine', () => { const g = loft((v) => ({ y: -0.24 + 0.4 * v, rx: 0.03 * Math.sin(v * Math.PI) + 0.005, rz: 0.03 * Math.sin(v * Math.PI) + 0.005 }), 10, 8); g.rotateX(Math.PI / 2); return g; }), M.dark, [0, 0.1, 0]);
  // 눈: 카메라 렌즈 + 발광 고리
  mesh(d, C('dEyeH', () => { const g = new THREE.CylinderGeometry(0.075, 0.085, 0.06, 24); g.rotateX(Math.PI / 2); return g; }), M.dark, [0, 0.0, 0.26]);
  m.lens = mesh(d, C('dLens', () => new THREE.SphereGeometry(0.062, 20, 14, 0, TAU, 0, Math.PI / 2)), M.lens, [0, 0, 0.285], [Math.PI / 2, 0, 0]);
  mesh(d, C('dEyeR', () => new THREE.TorusGeometry(0.068, 0.008, 6, 24)), M.cy, [0, 0, 0.29]);
  m.pupil = mesh(d, C('dPupil', () => new THREE.CircleGeometry(0.022, 16)), M.pk, [0, 0, 0.348]);
  // 레일건: 동체 아래 긴 포신 (가속 코일 고리)
  mesh(d, boxR('dGunB', 0.08, 0.2, 0.07, { bevel: 0.25 }), M.dark, [0, -0.12, 0.05], [Math.PI / 2, 0, 0]);
  mesh(d, tubeZ('dBarrel', 0.022, 0.018, 0.46), M.dark, [0, -0.13, 0.08]);
  for (let i = 0; i < 4; i++) mesh(d, C('dCoil', () => new THREE.TorusGeometry(0.03, 0.006, 6, 14)), M.cy, [0, -0.13, 0.24 + i * 0.07]);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.13, 0.56); d.add(muzzle);
  // 조준 레이저 (사격 준비 때만)
  m.laser = mesh(d, C('dLaser', () => { const g = new THREE.CylinderGeometry(0.008, 0.008, 1, 6, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5); return g; }), M.laser, [0, -0.13, 0.56]); m.laser.visible = false;
  // 덕트 프로펠러 넷: 팔 · 덕트 고리 · 회전 날개 · 발광 테
  const rot = [];
  for (const [x, z] of [[0.3, 0.16], [-0.3, 0.16], [0.3, -0.2], [-0.3, -0.2]]) {
    const arm = mesh(d, boxR('dArm', 0.04, Math.hypot(x, z) * 0.9, 0.025, { bevel: 0.3, n: 3 }), M.dark, [x / 2, 0.02, z / 2], [Math.PI / 2, 0, 0]); arm.rotation.set(Math.PI / 2, 0, -Math.atan2(x, z)); arm.rotation.order = 'YXZ'; arm.rotation.set(Math.PI / 2, Math.atan2(x, z), 0);
    const duct = new THREE.Group(); duct.position.set(x, 0.04, z); d.add(duct);
    mesh(duct, C('dDuct', () => { const g = new THREE.LatheGeometry([[0.1, -0.035], [0.112, -0.02], [0.115, 0.02], [0.105, 0.035], [0.098, 0.03], [0.098, -0.03]].map(([a, b]) => new THREE.Vector2(a, b)), 28); return g; }), M.hull);
    mesh(duct, C('dDuctR', () => new THREE.TorusGeometry(0.112, 0.005, 5, 28)), M.cy, [0, 0.022, 0], [Math.PI / 2, 0, 0]);
    mesh(duct, cyl('dHub', 0.02, 0.02, 0.04), M.dark);
    const r = new THREE.Group(); duct.add(r); rot.push(r);
    for (let i = 0; i < 3; i++) mesh(r, C('dProp', () => { const g = new THREE.BoxGeometry(0.19, 0.004, 0.035); g.translate(0.095, 0, 0); return g; }), M.dark, [0, 0, 0], [0.25, (i / 3) * TAU, 0]);
    mesh(r, C('dDisc', () => { const g = new THREE.CircleGeometry(0.095, 24); g.rotateX(-Math.PI / 2); return g; }), M.blade);
  }
  // 안테나 · 꼬리 핀
  mesh(d, cyl('dAnt', 0.004, 0.004, 0.18), M.dark, [0.05, 0.16, -0.18], [-0.4, 0, 0]); m.tip = mesh(d, C('dAntT', () => new THREE.SphereGeometry(0.012, 8, 6)), M.pk, [0.05, 0.24, -0.215]);
  mesh(d, boxR('dFin', 0.012, 0.12, 0.1, { bevel: 0.3, n: 3 }), M.hull, [0, 0.1, -0.24], [0.4, 0, 0]);
  let t = Math.random() * 10; const tmp = new V3(), tmp2 = new V3();
  m.update = (dt, f) => {
    t += dt; rot.forEach((r, i) => (r.rotation.y += dt * (38 + i * 3)));
    const act = f.state === 'act' ? f.actName : null, run = f.state === 'run';
    d.position.y = 1.5 + Math.sin(t * 2.2) * 0.07; d.rotation.z = Math.sin(t * 1.3) * 0.08; d.rotation.x += ((run ? 0.3 : act === 'light1' && f.at > 0.35 && f.at < 0.7 ? 0.6 : 0) - d.rotation.x) * Math.min(1, dt * 6);
    const aiming = act === 's1' && f.at < (f.act.fireT ?? 0.9);
    m.laser.visible = aiming && f.root.visible; if (aiming) { m.laser.scale.z = 22; M.laser.opacity = 0.35 + 0.5 * Math.abs(Math.sin(t * 30)) * (f.at / (f.act.fireT ?? 0.9)); }
    m.pupil.scale.setScalar(aiming ? 0.6 + 0.4 * Math.sin(t * 20) : 1); M.pk.color.setHex(aiming ? 0xff2a4a : PK);
    if (f.root.visible && Math.random() < dt * 4) { muzzle.getWorldPosition(tmp); f.G.fx.p(tmp, { vel: [0, 0.2, 0], size: 0.04, size1: 0.01, life: 0.3, color: CY, alpha: 0.7 }); }
    void tmp2;
  };
  m.sole = 0.07;
  m.tipPos = (out) => muzzle.getWorldPosition(out);
  m.weaponPts = (b, tt) => { d.localToWorld(b.set(0, 0, 0)); muzzle.getWorldPosition(tt); };
  return m;
}

/* =====================================================================
   3. 중장갑 메크 (거구 리그)
   ===================================================================== */
export function buildMech(pal) {
  const D = GOLEM_DIMS, m = buildHumanoid(D), J = m.J, env = envCube(), Y = pal.accent ?? 0xffd02a;
  const P = TX('mechPanel', () => panelTex(17, '#5c5f6c', { hazard: true, text: true }));
  const M = {
    plate: new THREE.MeshStandardMaterial({ map: P.map, bumpMap: P.bump, bumpScale: 1, metalness: 0.7, roughness: 0.38, envMap: env, envMapIntensity: 0.9 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x24252c, metalness: 0.8, roughness: 0.35, envMap: env, envMapIntensity: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc8, metalness: 1, roughness: 0.2, envMap: env, envMapIntensity: 1.2 }),
    yel: new THREE.MeshStandardMaterial({ color: 0xe8b818, metalness: 0.4, roughness: 0.4, envMap: env, envMapIntensity: 0.5 }),
    glow: new THREE.MeshBasicMaterial({ color: Y }), glass: new THREE.MeshStandardMaterial({ color: 0x1a1406, emissive: Y, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.05, envMap: env, envMapIntensity: 1.5 }),
    hose: new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.6 }),
  };
  // 골반 · 배 (관절 프레임) · 가슴 장갑 블록 (앞으로 기운 조종석)
  mesh(J.hips, boxR('mPelvis', 0.44, 0.2, 0.3, { bevel: 0.3 }), M.frame, [0, -0.02, 0]);
  for (const s of [-1, 1]) mesh(J.hips, boxR('mSkirt', 0.16, 0.2, 0.06, { bevel: 0.25, n: 4 }), M.plate, [s * 0.14, -0.1, 0.16], [-0.15, 0, 0]);
  mesh(J.spine, cyl('mWaist', 0.17, 0.2, 0.26, 18), M.frame, [0, 0.1, 0]);
  for (let i = 0; i < 3; i++) mesh(J.spine, C('mWRing', () => new THREE.TorusGeometry(0.19, 0.014, 6, 24)), M.steel, [0, 0.02 + i * 0.08, 0], [Math.PI / 2, 0, 0]);
  mesh(J.chest, boxR('mChest', 0.72, 0.5, 0.48, { bevel: 0.2, taper: -0.15, front: 0.06, lean: 0.03 }), M.plate, [0, 0.24, 0]);
  mesh(J.chest, boxR('mChestTop', 0.5, 0.12, 0.36, { bevel: 0.35 }), M.frame, [0, 0.52, -0.02]);
  // 조종석 바이저 (노란 발광 유리) · 테
  mesh(J.chest, C('mCanopy', () => surf((u, v, p) => { const a = (u - 0.5) * 1.6, e = -0.4 + v * 0.8; p.set(Math.sin(a) * 0.2, 0.32 + Math.sin(e) * 0.09, 0.15 + Math.cos(a) * Math.cos(e) * 0.14); }, 16, 8)), M.glass);
  mesh(J.chest, C('mCanR', () => { const pts = []; for (let i = 0; i <= 20; i++) { const a = -0.8 + 1.6 * (i / 20); pts.push(new V3(Math.sin(a) * 0.205, 0.32 + 0.085, 0.15 + Math.cos(a) * Math.cos(0.4) * 0.145)); } return strand(pts, 0.012, 0.012, { seg: 40, rad: 6 }); }), M.yel);
  for (const s of [-1, 1]) { mesh(J.chest, cyl('mLamp', 0.035, 0.035, 0.04), M.frame, [s * 0.27, 0.42, 0.24], [Math.PI / 2, 0, 0]); mesh(J.chest, C('mLampG', () => new THREE.CircleGeometry(0.028, 14)), M.glow, [s * 0.27, 0.42, 0.262]); }
  // 등: 배기통 둘 (연기)
  const stacks = [];
  for (const s of [-1, 1]) { mesh(J.chest, cyl('mStack', 0.05, 0.045, 0.36), M.frame, [s * 0.18, 0.52, -0.26], [-0.25, 0, 0]); const st = new THREE.Object3D(); st.position.set(s * 0.18, 0.72, -0.3); J.chest.add(st); stacks.push(st); }
  mesh(J.chest, boxR('mPack', 0.46, 0.32, 0.16, { bevel: 0.25 }), M.plate, [0, 0.3, -0.27]);
  // 머리 없음: 목 자리에 센서 블록
  mesh(J.head, boxR('mSensor', 0.16, 0.08, 0.14, { bevel: 0.3 }), M.frame, [0, 0.0, 0.12]); mesh(J.head, C('mSensorG', () => new THREE.BoxGeometry(0.12, 0.018, 0.01)), M.glow, [0, 0.0, 0.192]);
  // 팔
  m.pile = null;
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    mesh(a, boxR('mShoulder', 0.3, 0.26, 0.3, { bevel: 0.3 }), M.plate, [s * 0.06, 0.04, 0]);
    mesh(a, boxR('mShTop', 0.32, 0.05, 0.32, { bevel: 0.4 }), M.yel, [s * 0.06, 0.18, 0]);
    mesh(a, cyl('mUA', 0.08, 0.09, D.uArm), M.frame, [0, -D.uArm / 2, 0]);
    for (const z of [-1, 1]) mesh(a, cyl('mPiston', 0.016, 0.016, D.uArm * 0.8), M.steel, [s * 0.09, -D.uArm / 2, z * 0.05]);
    mesh(b, C('mElbow', () => new THREE.SphereGeometry(0.1, 14, 10)), M.frame);
    mesh(b, boxR('mFA' + s, 0.24, D.lArm + 0.06, 0.26, { bevel: 0.2, taper: -0.2 }), M.plate, [0, -D.lArm / 2, 0.01]);
    if (s < 0) { // 파일 드라이버: 앞팔 아래 원통 + 튀어나가는 말뚝
      const g = new THREE.Group(); g.position.set(0, -D.lArm - 0.04, 0.04); b.add(g);
      mesh(g, cyl('mPileH', 0.1, 0.1, 0.22, 18), M.frame); mesh(g, C('mPileR', () => new THREE.TorusGeometry(0.1, 0.014, 6, 20)), M.yel, [0, -0.1, 0], [Math.PI / 2, 0, 0]);
      const spike = new THREE.Group(); g.add(spike); m.pile = spike;
      mesh(spike, cyl('mSpike', 0.05, 0.05, 0.3, 14), M.steel, [0, -0.1, 0]); mesh(spike, C('mSpikeT', () => { const gg = new THREE.ConeGeometry(0.05, 0.14, 14); gg.rotateX(Math.PI); return gg; }), M.steel, [0, -0.32, 0]);
    } else { // 왼팔: 진압 방패
      mesh(b, boxR('mShield', 0.06, 0.6, 0.46, { bevel: 0.15, n: 4 }), M.plate, [0.16, -0.22, 0.05]); mesh(b, C('mShieldG', () => new THREE.BoxGeometry(0.01, 0.4, 0.03)), M.glow, [0.195, -0.22, 0.05]);
      mesh(c, boxR('mFist', 0.2, 0.2, 0.22, { bevel: 0.3 }), M.frame, [0, -0.1, 0.02]);
    }
  }
  // 다리: 굵은 허벅지 · 무릎 장갑 · 유압 정강이 · 큰 발
  for (const [a, b, c, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    mesh(a, boxR('mTh', 0.22, D.thigh + 0.04, 0.24, { bevel: 0.25 }), M.plate, [0, -D.thigh / 2, 0]);
    mesh(b, boxR('mKnee', 0.2, 0.18, 0.12, { bevel: 0.3 }), M.yel, [0, 0.0, 0.12], [0.2, 0, 0]);
    mesh(b, cyl('mShin', 0.1, 0.12, D.shin), M.frame, [0, -D.shin / 2, 0]);
    mesh(b, boxR('mShinP', 0.2, D.shin * 0.8, 0.1, { bevel: 0.25 }), M.plate, [0, -D.shin * 0.45, 0.08]);
    mesh(b, cyl('mShPist', 0.018, 0.018, D.shin * 0.7), M.steel, [0, -D.shin * 0.5, -0.11]);
    mesh(c, boxR('mFoot', 0.26, 0.1, 0.4, { bevel: 0.3 }), M.frame, [0, -0.04, 0.07]);
    mesh(c, boxR('mToe', 0.27, 0.06, 0.14, { bevel: 0.4 }), M.yel, [0, -0.06, 0.25]);
  }
  let t = Math.random() * 10; const tmp = new V3();
  m.update = (dt, f) => {
    t += dt; const firing = f.state === 'act' && f.actName === 'light1' && f.at > (f.act.pileT ?? 1) && f.at < (f.act.pileT ?? 1) + 0.35;
    if (m.pile) m.pile.position.y += ((firing ? -0.32 : 0) - m.pile.position.y) * Math.min(1, dt * (firing ? 40 : 6));
    M.glow.color.setHex(Y).multiplyScalar(0.85 + 0.15 * Math.sin(t * 6));
    if (f.root.visible && Math.random() < dt * 8) { const s = stacks[(Math.random() * 2) | 0]; s.getWorldPosition(tmp); f.G.fx.p(tmp, { vel: [0, 1.2, -0.3], size: 0.15, size1: 0.5, life: 0.9, color: 0x5a5a66, alpha: 0.3, smoke: true, drag: 1 }); }
  };
  m.sole = 0.07;
  m.tipPos = (out) => J.handR.localToWorld(out.set(0, -0.3, 0.04));
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.2, 0)); J.handR.localToWorld(tt.set(0, -0.4, 0.04)); };
  return m;
}

/* =====================================================================
   4. 메가 메크 오버클럭 (보스)
   ===================================================================== */
export const OC_DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.34, neckL: 0.07, shW: 0.27, uArm: 0.31, lArm: 0.3, hipW: 0.12, thigh: 0.45, shin: 0.46, headTop: 0.24 };
export const OC_BLADE = 1.55;
export function buildOverclock(pal) {
  const D = OC_DIMS, m = buildHumanoid(D), J = m.J, env = envCube(), PK = pal.accent ?? 0xff2a6a, CY = pal.trim ?? 0x2affff;
  const P = TX('ocPanel', () => panelTex(29, '#3a3c4a', { neon: true, text: true }));
  const M = {
    plate: new THREE.MeshStandardMaterial({ map: P.map, bumpMap: P.bump, bumpScale: 0.8, emissiveMap: P.emi, emissive: CY, emissiveIntensity: 1.0, metalness: 0.8, roughness: 0.28, envMap: env, envMapIntensity: 1.1 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd8dae4, metalness: 0.5, roughness: 0.25, envMap: env, envMapIntensity: 0.9 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x18181f, metalness: 0.85, roughness: 0.3, envMap: env, envMapIntensity: 0.8 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xaab0c0, metalness: 1, roughness: 0.18, envMap: env, envMapIntensity: 1.3 }),
    pk: new THREE.MeshBasicMaterial({ color: PK }), cy: new THREE.MeshBasicMaterial({ color: CY }),
    core: new THREE.MeshBasicMaterial({ color: CY }), coreH: new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    blade: new THREE.MeshBasicMaterial({ color: PK, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    bladeC: new THREE.MeshBasicMaterial({ color: 0xffe0f0 }),
    flame: new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    dome: new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: false }),
    domeW: new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }),
  };
  const neonLine = (parent, key, pts, r = 0.006, mat = M.cy) => mesh(parent, C(key, () => strand(pts, r, r, { seg: Math.max(12, pts.length * 4), rad: 5 })), mat);
  /* ---------- 몸통: 골반 장갑 · 분절 허리 · 가슴 블록 · 반응로 · 열리는 냉각판 ---------- */
  mesh(J.hips, boxR('oPelvis', 0.36, 0.18, 0.26, { bevel: 0.3 }), M.frame, [0, -0.01, 0]);
  for (const [x, z, ry] of [[0, 0.14, 0], [0.17, 0.05, 1.2], [-0.17, 0.05, -1.2], [0.1, -0.13, 2.6], [-0.1, -0.13, -2.6]]) { const g = new THREE.Group(); g.position.set(x, 0.0, z); g.rotation.y = ry; J.hips.add(g); mesh(g, boxR('oSkirt', 0.15, 0.22, 0.035, { bevel: 0.2, n: 4, taper: 0.25 }), M.white, [0, -0.11, 0.02], [-0.2, 0, 0]); neonLine(g, 'oSkirtL', [new V3(-0.05, -0.04, 0.045), new V3(0.05, -0.04, 0.045)], 0.005, M.pk); }
  for (let i = 0; i < 4; i++) mesh(J.spine, cyl('oSeg' + i, 0.12 + i * 0.012, 0.125 + i * 0.012, 0.06, 18), i % 2 ? M.frame : M.steel, [0, 0.02 + i * 0.06, 0]);
  mesh(J.chest, boxR('oChest', 0.56, 0.4, 0.38, { bevel: 0.22, taper: -0.22, front: 0.05 }), M.plate, [0, 0.2, 0]);
  mesh(J.chest, boxR('oCollar', 0.36, 0.08, 0.28, { bevel: 0.4 }), M.frame, [0, 0.42, -0.02]);
  // 가슴 장식 판 (흰 장갑) 양쪽 — 과열 시 바깥으로 열린다
  m.vents = [];
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.12, 0.3, 0.2); J.chest.add(g); mesh(g, boxR('oPec', 0.22, 0.16, 0.05, { bevel: 0.3, n: 4 }), M.white, [s * 0.06, 0, 0.0], [0.15, 0, -s * 0.15]); neonLine(g, 'oPecL' + s, [new V3(s * 0.0, -0.07, 0.035), new V3(s * 0.15, -0.04, 0.03)], 0.005, M.pk); m.vents.push({ g, s }); }
  // 반응로 코어
  mesh(J.chest, C('oCoreR', () => new THREE.TorusGeometry(0.07, 0.018, 8, 24)), M.steel, [0, 0.17, 0.24]);
  m.core = mesh(J.chest, C('oCore', () => new THREE.SphereGeometry(0.055, 18, 12)), M.core, [0, 0.17, 0.235]);
  m.coreH = mesh(J.chest, C('oCoreH', () => new THREE.SphereGeometry(0.1, 16, 12)), M.coreH, [0, 0.17, 0.24]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; mesh(J.chest, C('oCoreF', () => new THREE.BoxGeometry(0.012, 0.04, 0.012)), M.frame, [Math.cos(a) * 0.07, 0.17 + Math.sin(a) * 0.07, 0.255], [0, 0, a]); }
  // 등: 쌍발 추진기 (노즐 · 불꽃)
  m.flames = [];
  mesh(J.chest, boxR('oBack', 0.46, 0.34, 0.14, { bevel: 0.25 }), M.frame, [0, 0.22, -0.22]);
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.15, 0.2, -0.3); g.rotation.x = -0.35; J.chest.add(g);
    mesh(g, cyl('oThr', 0.07, 0.085, 0.36, 18), M.plate); mesh(g, cyl('oNoz', 0.1, 0.075, 0.1, 18), M.steel, [0, -0.22, 0]); mesh(g, C('oNozG', () => new THREE.CircleGeometry(0.075, 18)), M.cy, [0, -0.271, 0], [Math.PI / 2, 0, 0]);
    neonLine(g, 'oThrL', [new V3(0, 0.15, 0.086), new V3(0, -0.15, 0.086)], 0.006, M.pk);
    const fl = mesh(g, C('oFlame', () => { const gg = new THREE.ConeGeometry(0.08, 0.7, 14, 1, true); gg.translate(0, -0.35, 0); gg.rotateX(Math.PI); gg.translate(0, -0.27, 0); return gg; }), M.flame, [0, 0, 0], [Math.PI, 0, 0]); m.flames.push(fl); }
  // 어깨 미사일 포드 (덮개가 열린다)
  m.lids = []; m.pods = [];
  /* ---------- 머리: 날렵한 투구 · 모노아이 · 안테나 날개 ---------- */
  mesh(J.neck, cyl('oNeck', 0.06, 0.07, 0.1, 14), M.frame, [0, 0.03, 0]);
  const hdP = (v) => ({ y: -0.02 + 0.2 * v, rx: 0.1 * (1 - 0.5 * v ** 2), rzF: 0.12 * (1 - 0.45 * v ** 1.5) + 0.02 * smooth(0.2, 0.5, v) * (1 - v), rzB: 0.11 * (1 - 0.3 * v ** 2), n: 2.6 });
  mesh(J.head, C('oHelm', () => loft(hdP, 32, 12)), M.white);
  mesh(J.head, C('oFace', () => loft((v) => ({ y: -0.04 + 0.12 * v, rx: 0.085, rzF: 0.1, rzB: 0.08, n: 2.4 }), 24, 4)), M.frame);
  m.eye = mesh(J.head, C('oEye', () => loft((v) => ({ y: 0.075 + 0.025 * v, rx: 0.101, rzF: 0.123, rzB: 0.1, n: 2.6 }), 32, 2, { a0: 0.3, a1: 0.7 })), M.pk);
  for (const s of [-1, 1]) { mesh(J.head, C('oFin' + s, () => strand([[s * 0.09, 0.12, -0.02], [s * 0.13, 0.2, -0.08], [s * 0.15, 0.27, -0.18]], 0.02, 0.003, { seg: 10, rad: 6, flat: 0.25, ref: [1, 0, 0] })), M.white); neonLine(J.head, 'oFinL' + s, [new V3(s * 0.1, 0.13, -0.03), new V3(s * 0.135, 0.2, -0.09), new V3(s * 0.15, 0.25, -0.16)], 0.004, M.cy); }
  mesh(J.head, boxR('oCrest', 0.03, 0.06, 0.18, { bevel: 0.3, n: 3 }), M.white, [0, 0.2, -0.02], [0.2, 0, 0]);
  /* ---------- 팔: 큰 어깨 장갑(포드) · 관절 · 오른팔 블레이드 발생기 · 왼팔 레이저 캐논 ---------- */
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    mesh(a, C('oShBall', () => new THREE.SphereGeometry(0.09, 16, 12)), M.frame);
    mesh(a, boxR('oPaul', 0.26, 0.2, 0.3, { bevel: 0.3, taper: 0.2 }), M.white, [s * 0.07, 0.07, 0], [0, 0, -s * 0.25]);
    neonLine(a, 'oPaulL' + s, [new V3(s * 0.02, 0.0, 0.155), new V3(s * 0.17, -0.03, 0.15)], 0.006, M.pk);
    // 미사일 포드 (어깨 위 뒤쪽): 상자 + 구멍 6 (발광) + 덮개
    const pod = new THREE.Group(); pod.position.set(s * 0.06, 0.2, -0.06); a.add(pod); m.pods.push(pod);
    mesh(pod, boxR('oPod', 0.18, 0.12, 0.22, { bevel: 0.25 }), M.plate);
    for (let i = 0; i < 6; i++) mesh(pod, C('oPodH', () => new THREE.CircleGeometry(0.022, 10)), M.pk, [(i % 3 - 1) * 0.05, 0.062, (i < 3 ? -0.04 : 0.04)], [-Math.PI / 2, 0, 0]);
    const lid = new THREE.Group(); lid.position.set(0, 0.062, -0.11); pod.add(lid); mesh(lid, boxR('oLid', 0.19, 0.022, 0.23, { bevel: 0.3 }), M.white, [0, 0.012, 0.115]); m.lids.push(lid);
    mesh(a, cyl('oUA', 0.065, 0.075, D.uArm, 16), M.frame, [0, -D.uArm / 2, 0]);
    mesh(a, boxR('oUAP', 0.15, D.uArm * 0.7, 0.15, { bevel: 0.3 }), M.plate, [s * 0.015, -D.uArm * 0.5, 0]);
    mesh(b, C('oElb', () => new THREE.SphereGeometry(0.075, 14, 10)), M.steel);
    mesh(b, boxR('oFA' + s, 0.16, D.lArm, 0.18, { bevel: 0.25, taper: -0.25 }), M.white, [0, -D.lArm / 2, 0.0]);
    neonLine(b, 'oFAL' + s, [new V3(s * 0.085, -0.05, 0.05), new V3(s * 0.1, -D.lArm + 0.04, 0.05)], 0.005, M.cy);
    buildHand(c, 'oHand', s, M.frame, { k: 1.25 });
  }
  // 왼팔 레이저 캐논: 앞팔 아래 긴 포신 (끝 발광)
  { const g = new THREE.Group(); g.position.set(0.0, -D.lArm + 0.02, 0.1); J.elbowL.add(g); m.cannon = g;
    mesh(g, boxR('oCanB', 0.12, 0.28, 0.12, { bevel: 0.25 }), M.plate, [0.0, 0.08, 0]);
    const br = mesh(g, cyl('oCanBar', 0.05, 0.04, 0.42, 16), M.frame, [0, -0.15, 0]); void br;
    for (let i = 0; i < 3; i++) mesh(g, C('oCanR', () => new THREE.TorusGeometry(0.052, 0.008, 6, 16)), M.pk, [0, -0.05 - i * 0.1, 0], [Math.PI / 2, 0, 0]);
    m.muzzle = new THREE.Object3D(); m.muzzle.position.set(0, -0.38, 0); g.add(m.muzzle);
    m.muzzleG = mesh(g, C('oMuz', () => new THREE.SphereGeometry(0.04, 12, 8)), M.cy, [0, -0.37, 0]); }
  // 오른팔 플라즈마 블레이드 (무기 관절 +Z)
  const W = J.weapon;
  mesh(W, cyl('oHilt', 0.03, 0.03, 0.22, 12), M.frame, [0, 0, 0], [Math.PI / 2, 0, 0]);
  mesh(W, boxR('oEmit', 0.08, 0.06, 0.12, { bevel: 0.3 }), M.steel, [0, 0, 0.12]);
  m.blade = new THREE.Group(); W.add(m.blade);
  mesh(m.blade, C('oBlade', () => surf((u, v, p) => { const a = u * TAU, w = 0.07 * (1 - smooth(0.75, 1, v) * 0.9) + 0.006, z = 0.17 + (OC_BLADE - 0.17) * v; p.set(Math.cos(a) * 0.016, Math.sin(a) * w, z); }, 12, 24, { closedU: true })), M.blade);
  mesh(m.blade, C('oBladeC', () => surf((u, v, p) => { const a = u * TAU, w = 0.022 * (1 - smooth(0.75, 1, v) * 0.9) + 0.003, z = 0.17 + (OC_BLADE - 0.2) * v; p.set(Math.cos(a) * 0.006, Math.sin(a) * w, z); }, 8, 20, { closedU: true })), M.bladeC);
  /* ---------- 다리: 허벅지 장갑 · 무릎 · 뒤로 꺾인 듯한 정강이 장갑 · 발톱 발 ---------- */
  for (const [a, b, c, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    mesh(a, cyl('oThJ', 0.07, 0.08, D.thigh, 14), M.frame, [0, -D.thigh / 2, 0]);
    mesh(a, boxR('oTh', 0.17, D.thigh * 0.85, 0.2, { bevel: 0.25, taper: 0.2 }), M.white, [s * 0.01, -D.thigh * 0.45, 0.01]);
    neonLine(a, 'oThL' + s, [new V3(s * 0.088, -0.08, 0.04), new V3(s * 0.08, -D.thigh + 0.08, 0.03)], 0.005, M.pk);
    mesh(b, boxR('oKnee', 0.15, 0.16, 0.1, { bevel: 0.35 }), M.plate, [0, 0.0, 0.09], [0.25, 0, 0]);
    mesh(b, cyl('oShJ', 0.065, 0.07, D.shin, 14), M.frame, [0, -D.shin / 2, 0]);
    mesh(b, boxR('oShin', 0.16, D.shin * 0.85, 0.18, { bevel: 0.25, taper: -0.15, lean: -0.06 }), M.white, [0, -D.shin * 0.48, 0.02]);
    mesh(b, cyl('oCalf', 0.022, 0.022, D.shin * 0.6), M.steel, [0, -D.shin * 0.5, -0.1]);
    mesh(c, boxR('oFoot', 0.16, 0.08, 0.3, { bevel: 0.3, front: -0.02 }), M.frame, [0, -0.045, 0.08]);
    for (const k of [-1, 0, 1]) mesh(c, boxR('oToe', 0.045, 0.05, 0.14, { bevel: 0.35, taper: 0.4 }), M.white, [k * 0.055, -0.06, 0.25], [0.15, k * 0.25, 0]);
    mesh(c, boxR('oHeel', 0.06, 0.05, 0.1, { bevel: 0.35 }), M.white, [0, -0.06, -0.1]);
  }
  /* ---------- 실드 돔 (2페이즈: 발생기가 살아 있는 동안) ---------- */
  m.dome = mesh(m.body, C('oDome', () => new THREE.IcosahedronGeometry(1.25, 2)), M.domeW, [0, 1.0, 0]); m.domeIn = mesh(m.dome, C('oDomeS', () => new THREE.SphereGeometry(1.22, 24, 16)), M.dome); m.dome.visible = false;
  /* ---------- 매 프레임 ---------- */
  let t = Math.random() * 10; const tmp = new V3(), cHot = new THREE.Color(0xff6a1a), cCy = new THREE.Color(CY), cMix = new THREE.Color(), cB = new THREE.Color(0xff1a3a); m.heatK = 0; m.ventK = 0; m.podK = 0; m.boostK = 0; m.domeK = 0;
  m.update = (dt, f) => {
    t += dt; const G = f.G, vis = f.root.visible, act = f.state === 'act' ? f.actName : null, rate = Math.min(1, dt * 6);
    m.heatK += ((f.ocHeat || 0) / 100 - m.heatK) * rate; m.ventK += ((act === 'vent' ? 1 : 0) - m.ventK) * Math.min(1, dt * 8);
    m.podK += ((act === 'missile' && f.at < 1.6 ? 1 : 0) - m.podK) * Math.min(1, dt * 10);
    const boost = act === 's1' && f.at > 0.55 && f.at < 1.25 || act === 's2' && f.at < 1.2 || f.boostT > 0; m.boostK += ((boost ? 1 : 0.0) - m.boostK) * Math.min(1, dt * 12);
    m.domeK += ((f.shieldOn ? 1 : 0) - m.domeK) * rate;
    const hot = Math.max(m.heatK * 0.8, m.ventK), ber = f.berserk ? 1 : 0;
    cMix.copy(cCy).lerp(cHot, hot); if (ber && !m.ventK) cMix.lerp(cB, 0.6);
    M.core.color.copy(cMix); M.coreH.color.copy(cMix); M.plate.emissive.copy(cMix); M.cy.color.copy(cMix);
    const pulse = 1 + 0.15 * Math.sin(t * (8 + hot * 20)); m.core.scale.setScalar(pulse * (1 + hot * 0.4)); m.coreH.scale.setScalar(pulse * (1.1 + hot * 0.8));
    M.pk.color.setHex(ber ? 0xff2a2a : PK); M.blade.opacity = 0.5 + 0.2 * Math.sin(t * 25) + (act && act.startsWith('light') ? 0.25 : 0);
    for (const v of m.vents) { v.g.rotation.y = v.s * 0.9 * m.ventK; v.g.position.z = 0.2 + 0.04 * m.ventK; }
    for (const l of m.lids) l.rotation.x = -1.4 * m.podK;
    M.flame.opacity = m.boostK * (0.75 + 0.25 * Math.sin(t * 40)); for (const fl of m.flames) fl.scale.set(1, 0.6 + m.boostK * (1 + 0.3 * Math.sin(t * 33)), 1);
    m.dome.visible = vis && m.domeK > 0.02; M.domeW.opacity = 0.35 * m.domeK * (0.8 + 0.2 * Math.sin(t * 6)); M.dome.opacity = 0.1 * m.domeK; m.dome.rotation.y += dt * 0.6; m.dome.scale.setScalar(1 + 0.02 * Math.sin(t * 9));
    if (vis) {
      if (hot > 0.55 && Math.random() < dt * 40 * hot) { const v = m.vents[(Math.random() * 2) | 0]; v.g.getWorldPosition(tmp); G.fx.p(tmp, { vel: [(Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5], size: 0.3, size1: 1.0, life: 0.8, color: 0xd8d8e0, alpha: 0.35, smoke: true, drag: 1.5 }); }
      if (m.boostK > 0.3) for (const fl of m.flames) { fl.getWorldPosition(tmp); G.fx.p(tmp, { vel: [(Math.random() - 0.5), -1.5, (Math.random() - 0.5)], size: 0.35, size1: 0.05, life: 0.25, color: Math.random() < 0.5 ? 0x6ad8ff : 0xffffff, alpha: 0.9, drag: 2 }); }
      if (ber && Math.random() < dt * 12) { J.chest.localToWorld(tmp.set((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.4)); G.fx.p(tmp, { vel: [0, 1, 0], size: 0.08, size1: 0.01, life: 0.4, color: 0xff2a4a, alpha: 0.9, drag: 1 }); }
    }
  };
  m.sole = 0.07;
  m.trailPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.35)); W.localToWorld(tt.set(0, 0, OC_BLADE)); };
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.2)); W.localToWorld(tt.set(0, 0, OC_BLADE)); };
  m.tipPos = (out) => m.muzzle.getWorldPosition(out);
  m.podPos = (i, out) => m.pods[i % 2].localToWorld(out.set(0, 0.1, 0));
  return m;
}

/* =====================================================================
   5. 실드 발생기 (2페이즈 소환물 · 부수면 오버클럭의 실드가 꺼진다)
   ===================================================================== */
export function buildPylon(pal) {
  const m = buildHumanoid(FLOAT_DIMS), env = envCube(), CY = pal.accent ?? 0x2affff;
  const P = TX('ocPanel', () => panelTex(29, '#3a3c4a', { neon: true, text: true }));
  const M = { plate: new THREE.MeshStandardMaterial({ map: P.map, bumpMap: P.bump, bumpScale: 0.8, emissiveMap: P.emi, emissive: CY, emissiveIntensity: 1, metalness: 0.8, roughness: 0.3, envMap: env }),
    frame: new THREE.MeshStandardMaterial({ color: 0x18181f, metalness: 0.85, roughness: 0.3, envMap: env }), cy: new THREE.MeshBasicMaterial({ color: CY }),
    beam: new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }) };
  const g = new THREE.Group(); m.body.add(g);
  mesh(g, cyl('pBase', 0.55, 0.45, 0.25, 8), M.frame, [0, 0.12, 0]); mesh(g, C('pBaseR', () => new THREE.TorusGeometry(0.5, 0.025, 6, 8)), M.cy, [0, 0.25, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; mesh(g, boxR('pLeg', 0.12, 0.6, 0.12, { bevel: 0.3, taper: 0.4 }), M.plate, [Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.32], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]); }
  mesh(g, cyl('pCol', 0.16, 0.12, 1.3, 12), M.plate, [0, 0.9, 0]);
  const rings = []; for (let i = 0; i < 3; i++) rings.push(mesh(g, C('pRing', () => new THREE.TorusGeometry(0.32, 0.03, 8, 24)), M.cy, [0, 0.8 + i * 0.32, 0], [Math.PI / 2, 0, 0]));
  const orb = mesh(g, C('pOrb', () => new THREE.IcosahedronGeometry(0.2, 1)), M.cy, [0, 1.75, 0]);
  m.beam = mesh(g, C('pBeam', () => { const gg = new THREE.CylinderGeometry(0.04, 0.04, 1, 6, 1, true); gg.translate(0, 0.5, 0); return gg; }), M.beam); m.beam.visible = false;
  let t = 0; const tmp = new V3(), tmp2 = new V3(), q = new THREE.Quaternion();
  m.update = (dt, f) => {
    t += dt; rings.forEach((r, i) => { r.rotation.z = t * (1 + i * 0.5) * (i % 2 ? -1 : 1); r.position.y = 0.8 + i * 0.32 + Math.sin(t * 3 + i) * 0.04; }); orb.rotation.y += dt * 2; orb.scale.setScalar(1 + 0.1 * Math.sin(t * 8));
    // 보스로 잇는 에너지 줄기
    const B = f.link; m.beam.visible = !!(B && B.state !== 'ko' && f.state !== 'ko' && f.root.visible);
    if (m.beam.visible) { orb.getWorldPosition(tmp); B.chest(tmp2); const L = tmp.distanceTo(tmp2); m.body.worldToLocal(tmp2.clone()); const dir = tmp2.clone().sub(tmp).normalize(); q.setFromUnitVectors(new V3(0, 1, 0), dir); const pq = new THREE.Quaternion(); g.getWorldQuaternion(pq); m.beam.quaternion.copy(pq.invert().multiply(q)); m.beam.position.copy(orb.position); m.beam.scale.set(1, L / f.scale, 1); M.beam.opacity = 0.35 + 0.25 * Math.sin(t * 20); }
  };
  m.sole = 0.0; m.tipPos = (out) => orb.getWorldPosition(out); m.weaponPts = (b, tt) => { orb.getWorldPosition(b); orb.getWorldPosition(tt); };
  return m;
}
