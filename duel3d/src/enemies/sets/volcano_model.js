// 용암 분화구 몬스터 3D 모델: 용암 임프 · 화염 술사 · 흑요석 골렘 · 화염 거인 수르트
//
// 공통: 갈라진 용암 피부(캔버스 보로노이 균열 → 색 · 발광 · 범프 맵) · 흑요석(광택 검정 + 환경맵)
//   용암 임프   — 큰 머리에 굽은 뿔 · 뾰족 귀 · 웃는 이빨 입, 굽은 등 · 올챙이 배, 박쥐 날개(손가락 뼈 + 막) · 불꽃 끝 꼬리 · 발톱
//   화염 술사   — 떠다니는 교단 로브(그을린 밑단) · 깊은 고깔 두건 속 흑요석 가면 · 넓은 소매 · 화로 지팡이 · 허리띠 두 줄(로프)
//   흑요석 골렘 — 바위 덩어리 몸(면 분할 흑요석 + 용암 균열) · 가슴의 용암 핵 · 등의 흑요석 결정 · 거대한 바위 주먹
//   수르트     — 근육질 현무암 거인 · 불꽃 수염과 갈기 · 흑요석 뿔 왕관 · 한쪽 거대 견갑 · 허리 천(로프 2) · 톱날 흑요석 대검(용암 균열)
import * as THREE from 'three';
import { buildHumanoid } from '../../rig.js';
import { Rope, RopeTube } from '../../cloth.js';
import { surf, loft, loftAt, loftRing, strand, spl, gauss, smooth, fbm, noise3, envCube, cached } from '../../sculpt.js';
import { GOLEM_DIMS } from '../bodies.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = (k, fn) => cached('volcano:' + k, fn);
const _tx = {}; const TX = (k, f) => _tx[k] || (_tx[k] = f());
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function rng(s) { s = (s * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const lerp = (a, b, t) => a + (b - a) * t;

/* =====================================================================
   텍스처
   ===================================================================== */
// 갈라진 용암 피부: 보로노이 균열(타일 반복) — 균열 안은 붉게 · 가운데는 노랗게 빛나고, 가장자리는 그을려 어둡다
function magmaTex(seed, o) {
  const S = o.size || 512, r = rng(seed), pts = [];
  for (let i = 0; i < o.n; i++) pts.push(r(), r());
  const mk = () => { const [c, g] = cv(S, S); return [c, g, g.createImageData(S, S)]; };
  const [cA, gA, dA] = mk(), [cE, gE, dE] = mk(), [cB, gB, dB] = mk();
  const b0 = o.base, b1 = o.base2 || o.base, rc = o.crack || [150, 28, 6], hc = o.hot || [255, 170, 60], ec = o.emi || [230, 60, 8];
  for (let y = 0; y < S; y++) {
    const v = y / S, bv = v * TAU;
    for (let x = 0; x < S; x++) {
      const u = x / S, au = u * TAU;
      let f1 = 9, f2 = 9;
      for (let i = 0; i < pts.length; i += 2) {
        let dx = Math.abs(u - pts[i]); if (dx > 0.5) dx = 1 - dx; let dy = Math.abs(v - pts[i + 1]); if (dy > 0.5) dy = 1 - dy;
        const d = dx * dx + dy * dy; if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      const e = Math.sqrt(f2) - Math.sqrt(f1);
      const nz = fbm(3 + Math.cos(au) * 1.6, 3 + Math.sin(au) * 1.6, 3 + Math.cos(bv) * 1.6 + Math.sin(bv) * 0.9, 3);
      const fine = noise3(9 + Math.cos(au) * 9, 9 + Math.sin(au) * 9, 9 + Math.cos(bv) * 9 + Math.sin(bv) * 6);
      const w = o.w * (0.35 + nz * 1.3), crack = 1 - smooth(0, w, e), hot = 1 - smooth(0, w * 0.38, e), charK = 1 - smooth(w, w * 3.4, e);
      const sh = (0.7 + 0.5 * nz) * (0.85 + 0.3 * fine) * (1 - 0.55 * charK);
      const k = (y * S + x) * 4;
      for (let c = 0; c < 3; c++) {
        let col = lerp(b0[c], b1[c], nz) * sh; col = lerp(col, rc[c], crack); col = lerp(col, hc[c], hot);
        dA.data[k + c] = col; dE.data[k + c] = lerp(ec[c] * crack, hc[c], hot) * (o.ek ?? 1);
      }
      const hgt = 255 * (1 - charK * 0.5 - crack * 0.5) * (0.75 + 0.25 * fine);
      dB.data[k] = dB.data[k + 1] = dB.data[k + 2] = hgt; dA.data[k + 3] = dE.data[k + 3] = dB.data[k + 3] = 255;
    }
  }
  gA.putImageData(dA, 0, 0); gE.putImageData(dE, 0, 0); gB.putImageData(dB, 0, 0);
  return { map: tex(cA), emi: tex(cE), bump: tex(cB, false) };
}
function magmaMat(key, seed, o, mo = {}) {
  const t = TX(key, () => magmaTex(seed, o));
  const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emi, emissive: 0xffffff, emissiveIntensity: mo.ei ?? 1.2, bumpMap: t.bump, bumpScale: mo.bump ?? 2, roughness: mo.rough ?? 0.82, metalness: mo.metal ?? 0.05, flatShading: !!mo.flat, side: THREE.DoubleSide });
  if (mo.env) { m.envMap = envCube(); m.envMapIntensity = mo.env; }
  return m;
}
// 박쥐 날개 막: 어두운 가죽 + 빛나는 핏줄
function wingTex() {
  const S = 256, [c, g] = cv(S, S), [c2, g2] = cv(S, S), r = rng(77);
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#4a1408'); gr.addColorStop(1, '#1e0806'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g2.fillStyle = '#000'; g2.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { let x = r() * S, y = 0; g.beginPath(); g2.beginPath(); g.moveTo(x, y); g2.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 30; y += S / 8; g.lineTo(x, y); g2.lineTo(x, y); }
    g.strokeStyle = 'rgba(160,40,10,0.7)'; g.lineWidth = 1 + r() * 2; g.stroke(); g2.strokeStyle = `rgba(255,${80 + r() * 60 | 0},20,${0.4 + r() * 0.5})`; g2.lineWidth = 1 + r() * 1.5; g2.stroke(); }
  return { map: tex(c), emi: tex(c2) };
}
// 그을린 교단 로브: 짙은 진홍 천 · 금실 띠 · 아래(v=1 → 캔버스 위)로 갈수록 타서 검고, 밑단에 불씨
function robeTex() {
  const W = 512, H = 512, [c, g] = cv(W, H), [c2, g2] = cv(W, H), r = rng(31);
  g.fillStyle = '#4a0e08'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,4,2,0.18)' : 'rgba(120,30,14,0.14)'; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 8); }
  for (let x = 0; x < W; x += 3) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, 0, 1, H); }
  // 금실 띠 두 줄 (허리 쪽)
  for (const y0 of [H * 0.82, H * 0.9]) { g.fillStyle = '#b88a3a'; g.fillRect(0, y0, W, 7); g.fillStyle = '#5a3a10'; for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, y0 + 3.5); g.lineTo(x + 8, y0 - 3); g.lineTo(x + 16, y0 + 3.5); g.lineTo(x + 8, y0 + 10); g.closePath(); g.fill(); } }
  // 불꽃 문양 (앞자락)
  g.strokeStyle = '#c89040'; g.lineWidth = 4;
  for (let k = 0; k < 2; k++) { const cx = W * (0.5 + (k - 0.5) * 0.5); g.beginPath(); g.moveTo(cx, H * 0.75); g.bezierCurveTo(cx - 40, H * 0.6, cx + 30, H * 0.5, cx, H * 0.38); g.bezierCurveTo(cx - 20, H * 0.5, cx - 50, H * 0.55, cx - 30, H * 0.7); g.stroke(); }
  // 탄 밑단: 위쪽(캔버스 y 작음) = 밑단
  const gb = g.createLinearGradient(0, 0, 0, H * 0.3); gb.addColorStop(0, 'rgba(8,2,2,0.95)'); gb.addColorStop(1, 'rgba(8,2,2,0)'); g.fillStyle = gb; g.fillRect(0, 0, W, H * 0.3);
  g2.fillStyle = '#000'; g2.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { const x = r() * W, y = r() ** 2 * H * 0.12, s = 1 + r() * 4; g2.fillStyle = `rgba(255,${90 + r() * 120 | 0},20,${0.5 + r() * 0.5})`; g2.beginPath(); g2.arc(x, y, s, 0, TAU); g2.fill(); }
  g2.fillStyle = 'rgba(255,110,20,0.9)'; g2.fillRect(0, 0, W, 4);
  return { map: tex(c), emi: tex(c2) };
}
// 불꽃 털(수염 · 갈기): 뿌리 검붉음 → 끝 밝은 노랑 (strand v: 0 뿌리 → 1 끝)
function flameTex() {
  const [c, g] = cv(64, 256), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2a0602'); gr.addColorStop(0.35, '#a81e04'); gr.addColorStop(0.7, '#ff7a14'); gr.addColorStop(1, '#ffe08a'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const r = rng(5); for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,${120 + r() * 120 | 0},40,0.35)`; g.lineWidth = 1 + r() * 2; const x = r() * 64; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 10, 256); g.stroke(); }
  return tex(c);
}
// 그을린 허리 천: 거친 가죽 · 해진 끝(v=1) 불씨
function loinTex() {
  const [c, g] = cv(128, 256), r = rng(12); g.fillStyle = '#3a1208'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? 'rgba(10,2,2,0.25)' : 'rgba(110,40,20,0.2)'; g.fillRect(r() * 128, r() * 256, 1 + r() * 4, 1 + r() * 3); }
  g.fillStyle = '#9a6a2a'; g.fillRect(8, 0, 5, 256); g.fillRect(115, 0, 5, 256);
  for (let y = 20; y < 256; y += 46) { g.fillStyle = '#c89040'; g.beginPath(); g.moveTo(64, y); g.lineTo(80, y + 16); g.lineTo(64, y + 32); g.lineTo(48, y + 16); g.closePath(); g.fill(); }
  const gb = g.createLinearGradient(0, 200, 0, 256); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,0.9)'); g.fillStyle = gb; g.fillRect(0, 200, 128, 56);
  return tex(c);
}

/* =====================================================================
   공통 조형 도우미
   ===================================================================== */
const mesh = (parent, geo, mat, p, r, s) => { const me = new THREE.Mesh(geo, mat); if (p) me.position.set(p[0], p[1], p[2]); if (r) me.rotation.set(r[0], r[1], r[2]); if (s) me.scale.set(s[0], s[1], s[2]); parent.add(me); return me; };
const orient = (me, from, to) => { me.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3().subVectors(to, from).normalize()); me.position.copy(from); return me; };
const coneG = (key, r, h, seg = 7) => C('cone' + key, () => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; });
// 울퉁불퉁한 바위: 정이십면체를 잡음으로 밀어낸다 (면 분할 그대로 → 깎은 흑요석)
function rockGeo(key, r, det, amp, seed, stretch = [1, 1, 1]) {
  return C('rock' + key, () => {
    const g = new THREE.IcosahedronGeometry(r, det), p = g.attributes.position, q = new V3();
    for (let i = 0; i < p.count; i++) { q.fromBufferAttribute(p, i); const n = fbm(q.x * 4 / r + seed, q.y * 4 / r, q.z * 4 / r, 3); q.multiplyScalar(1 + amp * (n - 0.5) * 2); p.setXYZ(i, q.x * stretch[0], q.y * stretch[1], q.z * stretch[2]); }
    g.computeVertexNormals(); return g;
  });
}
// 길쭉한 결정 조각 (흑요석 가시)
const shardG = (key, r, h) => C('shard' + key, () => { const g = new THREE.OctahedronGeometry(1, 0); g.scale(r, h / 2, r * 0.8); g.translate(0, h * 0.42, 0); return g; });
// 팔다리 로프트: 관절 원점에서 -Y로 len 만큼. rx(v) · rzF(v) · rzB(v) 함수 또는 숫자
function limbGeo(key, len, top, rx, rzF, rzB, o = {}) {
  const f = (x) => (typeof x === 'function' ? x : () => x);
  const RX = f(rx), RF = f(rzF), RB = f(rzB ?? rzF);
  return C(key, () => loft((v) => ({ y: top - (len + top) * v, rx: RX(v), rzF: RF(v), rzB: RB(v), n: o.n ?? 2, cx: o.cx ? o.cx(v) : 0, cz: o.cz ? o.cz(v) : 0 }), o.nu ?? 20, o.nv ?? 10, { mod: o.mod, uvU: o.uvU ?? 1, uvV: o.uvV ?? 1 }));
}
// 구면 머리: az 0 = 앞(+Z) · el 위(+) / 아래(-) — mod(d, az, el) 은 반지름 방향 변위(m)를 돌려준다
function makeHead(key, o, mod, nu = 56, nv = 40) {
  const pt = (az, el, off = 0, out = new V3()) => {
    const ce = Math.cos(el); out.set(Math.sin(az) * ce * o.rx, Math.sin(el) * o.ry, Math.cos(az) * ce * (Math.cos(az) > 0 ? o.rzF : o.rzB));
    const L = out.length() || 1e-6, d = (mod ? mod(az, el, out) : 0) + off; out.multiplyScalar(1 + d / L); return out.add(o.c);
  };
  const geo = C(key, () => surf((u, v, p) => pt((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI, 0, p), nu, nv, { closedU: true, poles: [0, nv] }));
  return { geo, pt };
}
// 로프(천 끈 · 머리 다발) 공용 처리
function ropeKit(m) {
  m.ropes = []; const extras = [];
  m.attachScene = (scene) => { if (m._attached) return; m._attached = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); } };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; m._attached = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  const tmp = new V3(), rq = new THREE.Quaternion(), jq = new THREE.Quaternion();
  return (dt, f, extraCaps = []) => {
    const vis = f.root.visible, G = f.G, h0 = f.hurt[0];
    const caps = [{ a: h0.a, b: h0.b, r: h0.r * 0.9 }, ...f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.02 * f.scale })), ...extraCaps];
    const wind = new V3(-f.vel.x * 0.6 + Math.sin(G.time * 1.3) * 0.6, 0, -f.vel.z * 0.6 + Math.cos(G.time * 1.1) * 0.6);
    m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local));
      if (r.view.side && r.sideL) { r.joint.getWorldQuaternion(jq); r.view.side.copy(r.sideL).applyQuaternion(jq); }
      r.rope.step(dt, tmp, caps, f.pos.y + 0.02, r.rest.clone().applyQuaternion(rq), wind); r.view.update(); r.view.mesh.visible = vis;
    }
  };
}
// 손: 손바닥 + 손가락(strand) + 발톱. s = 1 왼손 · -1 오른손, n 손가락 수, k 크기
function buildHand(parent, key, s, mats, o = {}) {
  const k = o.k ?? 1, n = o.n ?? 4, g = new THREE.Group(); g.scale.setScalar(k); parent.add(g);
  mesh(g, C(key + 'palm' + s, () => loft((v) => ({ y: 0.005 - 0.065 * v, rx: 0.022 + 0.004 * Math.sin(v * Math.PI), rz: 0.034 + 0.004 * v, n: 2.6 }), 14, 6)), mats.skin);
  for (let i = 0; i < n; i++) {
    const z = 0.026 - i * (0.052 / Math.max(1, n - 1)), L = (o.len ?? 0.07) * (i === n - 1 ? 0.8 : 1), pts = [];
    const cu = o.curl ?? 1.4;
    for (let j = 0; j <= 6; j++) { const t = j / 6, a = t * cu; pts.push(new V3(-s * L * 0.45 * (1 - Math.cos(a)), -0.058 - L * Math.sin(a) / Math.max(0.3, cu) * 0.95, z + 0.006 * t)); }
    mesh(g, C(key + 'fing' + s + i + n, () => strand(pts, 0.0095, 0.0068, { seg: 10, rad: 7 })), mats.skin);
    const tip = pts[6], dir = tip.clone().sub(pts[5]).normalize();
    orient(mesh(g, coneG(key + 'claw', 0.0068, o.claw ?? 0.03), mats.claw), tip.clone().addScaledVector(dir, -0.004), tip.clone().add(dir));
  }
  const th = [new V3(-s * 0.012, -0.012, 0.03), new V3(-s * 0.02, -0.035, 0.046), new V3(-s * 0.016, -0.058, 0.05)];
  mesh(g, C(key + 'thumb' + s, () => strand(th, 0.01, 0.0075, { seg: 8, rad: 7 })), mats.skin);
  { const d = th[2].clone().sub(th[1]).normalize(); orient(mesh(g, coneG(key + 'claw', 0.0068, o.claw ?? 0.03), mats.claw), th[2].clone().addScaledVector(d, -0.004), th[2].clone().add(d)); }
  return g;
}

/* =====================================================================
   1. 용암 임프 — 작은 날개 달린 악마
   ===================================================================== */
export const IMP_DIMS = { hipH: 0.72, spineL: 0.16, chestL: 0.23, neckL: 0.07, shW: 0.145, uArm: 0.24, lArm: 0.23, hipW: 0.085, thigh: 0.33, shin: 0.35, headTop: 0.3 };
export function buildImp(pal) {
  const D = IMP_DIMS, m = buildHumanoid(D), J = m.J, env = envCube();
  const M = {
    skin: magmaMat('impSkin', 11, { n: 60, w: 0.0055, base: [120, 44, 26], base2: [58, 20, 14], size: 256 }, { ei: 1.0, rough: 0.7, bump: 1.5 }),
    horn: new THREE.MeshStandardMaterial({ color: 0x1c1310, roughness: 0.3, metalness: 0.25, envMap: env, envMapIntensity: 0.6 }),
    claw: new THREE.MeshStandardMaterial({ color: 0x0e0909, roughness: 0.2, metalness: 0.3, envMap: env, envMapIntensity: 0.8 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffd23a }), pupil: new THREE.MeshBasicMaterial({ color: 0x1a0400 }),
    mouth: new THREE.MeshBasicMaterial({ color: 0xff6a10 }), tooth: new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.4 }),
    wing: (() => { const t = TX('wing', wingTex); return new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emi, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.7, side: THREE.DoubleSide }); })(),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  // 골반 · 올챙이 배 · 굽은 가슴 (갈비뼈 결)
  mesh(J.hips, C('impPelvis', () => loft((v) => ({ y: 0.07 - 0.17 * v, rx: (0.098 + 0.01 * Math.sin(v * Math.PI)) * (1 - 0.85 * smooth(0.75, 1, v)), rzF: 0.08 * (1 - 0.8 * smooth(0.8, 1, v)), rzB: 0.088 * (1 - 0.8 * smooth(0.8, 1, v)) }), 24, 8)), M.skin);
  mesh(J.spine, C('impBelly', () => loft((v) => ({ y: -0.05 + 0.24 * v, rx: 0.096 + 0.018 * Math.sin(v * Math.PI), rzF: 0.08 + 0.042 * gauss(v - 0.4, 0.3), rzB: 0.078 }), 24, 10)), M.skin);
  const chX = spl([[0, 0.1], [0.4, 0.114], [0.72, 0.12], [1, 0.05]]), chF = spl([[0, 0.088], [0.5, 0.082], [1, 0.045]]), chB = spl([[0, 0.084], [0.5, 0.1], [0.8, 0.09], [1, 0.05]]);
  mesh(J.chest, C('impChest', () => loft((v) => ({ y: -0.03 + 0.27 * v, rx: chX(v), rzF: chF(v), rzB: chB(v) }), 28, 14, { mod: (p, u, v, c) => { const a = Math.abs(c); p.x += Math.sign(c) * (0.004 * Math.sin(v * 34) * smooth(0.05, 0.4, v) * (1 - smooth(0.55, 0.75, v)) * a + 0.022 * gauss(v - 0.84, 0.1) * smooth(0.5, 0.9, a)); } })), M.skin);
  // 등뼈 가시
  for (let i = 0; i < 4; i++) orient(mesh(J.chest, coneG('impSp', 0.012, 0.05), M.horn), new V3(0, 0.06 + i * 0.05, -0.085 - i * 0.004), new V3(0, 0.1 + i * 0.05, -0.16));
  mesh(J.neck, limbGeo('impNeck', 0.0, 0.1, 0.042, 0.045, 0.04), M.skin, [0, 0.0, 0], [Math.PI, 0, 0]);
  // 머리: 큰 두개골 · 넓은 턱 · 눈썹 뼈 · 움푹한 눈 · 뾰족 턱
  const HD = makeHead('impHead', { c: new V3(0, 0.12, 0.03), rx: 0.122, ry: 0.112, rzF: 0.13, rzB: 0.11 }, (az, el) => {
    const fr = Math.max(0, Math.cos(az)); let d = 0;
    d += 0.022 * fr * gauss(el - 0.32, 0.11) * gauss(az, 0.75);
    for (const s of [-1, 1]) { d -= 0.02 * gauss(az - s * 0.4, 0.17) * gauss(el - 0.13, 0.12); d += 0.012 * gauss(az - s * 0.8, 0.25) * gauss(el + 0.02, 0.15); }
    d += 0.03 * gauss(az, 0.2) * gauss(el + 0.06, 0.13);
    d += 0.03 * fr * smooth(-0.05, -0.6, el) * (1 - smooth(-0.9, -1.3, el));
    d += 0.035 * gauss(az, 0.35) * gauss(el + 0.95, 0.25);
    d += 0.015 * gauss(Math.abs(az) - Math.PI, 0.8) * gauss(el - 0.3, 0.4);
    return d;
  });
  const H = J.head; mesh(H, HD.geo, M.skin);
  for (const s of [-1, 1]) {
    const e = mesh(H, C('impEye', () => new THREE.SphereGeometry(0.024, 12, 8)), M.eye, null, null, [1.35, 0.7, 0.55]); e.position.copy(HD.pt(s * 0.4, 0.13, -0.008)); e.rotation.set(-0.1, s * 0.45, -s * 0.28);
    const pu = mesh(e, C('impPupil', () => new THREE.BoxGeometry(0.006, 0.034, 0.01)), M.pupil, [0, 0, 0.02]);
    // 뾰족 귀 (옆 · 뒤로)
    const b = HD.pt(s * 1.35, 0.1, -0.01); mesh(H, C('impEar' + s, () => strand([b, b.clone().add(new V3(s * 0.06, 0.03, -0.02)), b.clone().add(new V3(s * 0.12, 0.08, -0.05)), b.clone().add(new V3(s * 0.17, 0.12, -0.07))], 0.036, 0.002, { seg: 12, rad: 8, flat: 0.28, ref: [0, 0.2, 1] })), M.skin);
    // 뒤로 굽은 뿔 (마디 결)
    const hb = HD.pt(s * 0.38, 0.72, -0.006); const hp = [hb, hb.clone().add(new V3(s * 0.025, 0.07, -0.01)), hb.clone().add(new V3(s * 0.06, 0.13, -0.07)), hb.clone().add(new V3(s * 0.085, 0.14, -0.15)), hb.clone().add(new V3(s * 0.09, 0.11, -0.21))];
    mesh(H, C('impHorn' + s, () => strand(hp, 0.03, 0.002, { seg: 24, rad: 9, prof: (v) => 1 + 0.12 * Math.sin(v * 46) * (1 - v) })), M.horn);
  }
  // 웃는 입 (빛나는 틈) + 이빨
  { const pts = []; for (let i = 0; i <= 12; i++) { const az = -0.62 + 1.24 * (i / 12); pts.push(HD.pt(az, -0.4 + 0.12 * Math.abs(az / 0.62) ** 1.6, 0.002)); }
    mesh(H, C('impMouth', () => strand(pts, 0.009, 0.009, { seg: 24, rad: 6, flat: 0.45, ref: [0, 1, 0] })), M.mouth);
    for (let i = 0; i < 9; i++) { const t = i / 8, az = -0.5 + t, big = Math.abs(Math.abs(az) - 0.3) < 0.07, q = HD.pt(az, -0.4 + 0.12 * Math.abs(az / 0.62) ** 1.6 + 0.012, 0.004);
      const tt = mesh(H, coneG('impTooth' + big, big ? 0.008 : 0.005, big ? 0.03 : 0.016, 5), M.tooth); tt.position.copy(q); tt.rotation.set(Math.PI + 0.25, 0, 0); } }
  // 팔 · 손 (긴 발톱)
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    mesh(sh, C('impSh', () => new THREE.SphereGeometry(0.048, 14, 10)), M.skin, [s * 0.008, 0.005, 0]);
    mesh(sh, limbGeo('impUA', D.uArm + 0.01, 0.02, (v) => 0.037 - 0.008 * v + 0.008 * gauss(v - 0.35, 0.2), (v) => 0.036 - 0.007 * v + 0.01 * gauss(v - 0.4, 0.2), 0.034), M.skin);
    mesh(el, limbGeo('impFA', D.lArm, 0.015, (v) => 0.032 + 0.006 * gauss(v - 0.25, 0.2) - 0.01 * v, (v) => 0.03 + 0.005 * gauss(v - 0.25, 0.2) - 0.008 * v), M.skin);
    orient(mesh(el, coneG('impElb', 0.014, 0.06), M.horn), new V3(0, 0.0, -0.025), new V3(0, 0.03, -0.1));
    const hd = buildHand(ha, 'imp', s, M, { n: 3, k: 1.35, len: 0.06, claw: 0.05, curl: 1.0 }); hd.position.y = 0.01;
  }
  // 다리: 가는 허벅지 · 종아리 · 긴 발 (발톱 셋)
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    mesh(hp, limbGeo('impTh', D.thigh, 0.03, (v) => 0.056 - 0.018 * v, (v) => 0.055 - 0.016 * v, (v) => 0.058 - 0.02 * v), M.skin);
    mesh(kn, limbGeo('impSn', D.shin, 0.02, (v) => 0.038 - 0.014 * v, (v) => 0.04 - 0.016 * v, (v) => 0.042 + 0.012 * gauss(v - 0.25, 0.18) - 0.02 * v), M.skin);
    orient(mesh(kn, coneG('impKn', 0.012, 0.045), M.horn), new V3(0, 0.0, 0.03), new V3(0, 0.04, 0.09));
    const fg = C('impFoot', () => { const g = loft((v) => ({ y: -0.05 + 0.2 * v, rx: 0.034 + 0.012 * Math.sin(v * Math.PI) * (1 - v * 0.4), rz: 0.026 * (1 - 0.5 * v) + 0.004, cz: 0 }), 16, 8); g.rotateX(Math.PI / 2); g.translate(0, -0.035, 0); return g; });
    mesh(ft, fg, M.skin);
    for (const k of [-1, 0, 1]) { const x0 = k * 0.022, pts = [new V3(x0, -0.035, 0.13), new V3(x0 * 1.3, -0.04, 0.17), new V3(x0 * 1.5, -0.055, 0.2)];
      mesh(ft, C('impToe' + k, () => strand(pts, 0.012, 0.009, { seg: 6, rad: 6 })), M.skin);
      orient(mesh(ft, coneG('impTClaw', 0.008, 0.035), M.claw), pts[2], pts[2].clone().add(new V3(0, -0.4, 1))); }
    orient(mesh(ft, coneG('impSpur', 0.01, 0.04), M.claw), new V3(0, -0.03, -0.05), new V3(0, -0.06, -0.12));
  }
  // 박쥐 날개: 팔뼈 + 손가락 셋 + 막 (가슴 뒤에 붙어 퍼덕인다)
  const wings = [];
  for (const s of [-1, 1]) {
    const root = new THREE.Group(); root.position.set(s * 0.06, 0.19, -0.075); root.scale.setScalar(1.55); J.chest.add(root);
    const W = new V3(s * 0.22, 0.12, -0.08), tips = [new V3(s * 0.46, 0.3, -0.14), new V3(s * 0.52, 0.05, -0.16), new V3(s * 0.4, -0.16, -0.14), new V3(s * 0.12, -0.18, -0.06)], R0 = new V3(0, 0, 0);
    mesh(root, C('impWArm' + s, () => strand([R0, new V3(s * 0.1, 0.08, -0.03), W], 0.016, 0.01, { seg: 10, rad: 6 })), M.skin);
    tips.slice(0, 3).forEach((t, i) => { const mid = W.clone().lerp(t, 0.5).add(new V3(0, 0.02, -0.01)); mesh(root, C('impWF' + s + i, () => strand([W, mid, t], 0.009, 0.003, { seg: 10, rad: 5 })), M.skin); });
    orient(mesh(root, coneG('impWClaw', 0.008, 0.04), M.claw), W, W.clone().add(new V3(s * 0.2, 1, 0.2)));
    // 막: 손목에서 이웃한 두 뼈 끝 사이 부채꼴 (끝은 안쪽으로 처짐)
    const edges = [R0.clone().lerp(W, 0.15), ...tips];
    for (let i = 0; i < 4; i++) {
      const A = i === 0 ? R0.clone().add(new V3(0, 0.02, 0)) : tips[i - 1], B = tips[i], sag = i === 0 ? 0.02 : i === 3 ? 0.06 : 0.07;
      const geo = C('impMem' + s + i, () => surf((u, v, p) => { const e = A.clone().lerp(B, u), mid = W.clone(); e.addScaledVector(mid.clone().sub(e).normalize(), sag * 4 * u * (1 - u)); p.copy(W).lerp(e, v); p.z -= 0.012 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v); }, 8, 6));
      mesh(root, geo, M.wing);
    }
    void edges; wings.push({ root, s });
  }
  // 꼬리: 일곱 마디 (흔들림) + 불꽃 끝
  const tail = []; { let p = J.hips;
    for (let i = 0; i < 7; i++) { const g = new THREE.Group(); if (i) g.position.y = -0.075; else g.position.set(0, -0.04, -0.07); g.rotation.x = i ? -0.18 : 1.95; p.add(g); tail.push(g);
      mesh(g, C('impTail' + i, () => loft((v) => ({ y: 0.008 - 0.086 * v, rx: 0.026 * (1 - i * 0.12) * (1 - 0.15 * v) + 0.004, rz: 0.026 * (1 - i * 0.12) * (1 - 0.15 * v) + 0.004 }), 10, 4)), M.skin); p = g; }
    const tip = new THREE.Group(); tip.position.y = -0.08; p.add(tip); m.tailTip = tip;
    mesh(tip, C('impSpade', () => { const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.045, 0.07, 0.012); g.translate(0, -0.05, 0); return g; }), M.horn);
    m.tailFlame = mesh(tip, C('impFlame', () => { const g = new THREE.ConeGeometry(0.03, 0.12, 8); g.translate(0, 0.06, 0); return g; }), M.flame, [0, -0.08, 0], [Math.PI, 0, 0]); }
  // 매 프레임: 날개 퍼덕임 · 꼬리 흔들림 · 불씨
  let t = Math.random() * 10; const tmp = new V3();
  m.update = (dt, f) => {
    t += dt; const sp = Math.hypot(f.vel.x, f.vel.z), act = f.state === 'act', air = !f.onGround, fl = air || act ? 1 : sp > 1 ? 0.6 : 0.25, fq = air ? 14 : act ? 11 : 6;
    for (const w of wings) { const a = Math.sin(t * fq) * fl; w.root.rotation.set(0.1, -w.s * (0.3 - 0.15 * fl + 0.15 * a), w.s * (0.15 + 0.4 * a)); }
    tail.forEach((g, i) => { g.rotation.y = Math.sin(t * 2.6 - i * 0.6) * 0.18; if (i) g.rotation.x = -0.18 + Math.sin(t * 1.7 - i * 0.5) * 0.06; });
    m.tailFlame.scale.set(1 + 0.15 * Math.sin(t * 31), 0.8 + 0.4 * Math.abs(Math.sin(t * 17)), 1);
    M.skin.emissiveIntensity = 1.0 + 0.25 * Math.sin(t * 3.1);
    if (f.root.visible && Math.random() < dt * 14) { m.tailTip.getWorldPosition(tmp); f.G.fx.p(tmp, { vel: [(Math.random() - 0.5) * 0.4, 0.9 + Math.random(), (Math.random() - 0.5) * 0.4], size: 0.06, size1: 0.01, life: 0.4, color: Math.random() < 0.5 ? 0xff8a20 : 0xffd060, alpha: 0.9, drag: 1.2 }); }
  };
  m.sole = 0.07;
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.12, 0)); J.handR.localToWorld(tt.set(0, -0.12, 0.05)); };
  m.tipPos = (out) => J.head.localToWorld(out.set(0, 0.04, 0.16));
  return m;
}

/* =====================================================================
   2. 화염 술사 — 떠다니는 교단 술사
   ===================================================================== */
export const MAGE_DIMS = { hipH: 0.98, spineL: 0.2, chestL: 0.27, neckL: 0.08, shW: 0.165, uArm: 0.27, lArm: 0.25, hipW: 0.09, thigh: 0.42, shin: 0.42, headTop: 0.3 };
export function buildMage(pal) {
  const D = MAGE_DIMS, m = buildHumanoid(D), J = m.J, env = envCube(), stepRopes = ropeKit(m);
  const rt = TX('robe', robeTex);
  const M = {
    robe: new THREE.MeshStandardMaterial({ map: rt.map, emissiveMap: rt.emi, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.9, side: THREE.DoubleSide }),
    robeD: new THREE.MeshStandardMaterial({ color: 0x220806, roughness: 0.95, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8a040, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2220, metalness: 0.8, roughness: 0.45, envMap: env, envMapIntensity: 0.6 }),
    void: new THREE.MeshBasicMaterial({ color: 0x040202 }),
    mask: magmaMat('obsMask', 23, { n: 14, w: 0.012, base: [22, 18, 24], base2: [10, 8, 12], size: 256 }, { ei: 1.4, rough: 0.2, metal: 0.4, env: 0.9 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x2a201c, roughness: 0.6 }), claw: new THREE.MeshStandardMaterial({ color: 0x0a0606, roughness: 0.3 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffa020 }), wood: new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffc060 }), halo: new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    rock: magmaMat('ember', 41, { n: 10, w: 0.03, base: [30, 20, 18], base2: [14, 10, 10], size: 128 }, { ei: 2, flat: true }),
  };
  // 로브 치마: 허리에서 발 아래까지 넓게 퍼짐 · 들쭉날쭉 그을린 밑단
  const skP = (v) => ({ y: 0.08 - 1.02 * v, rx: 0.12 + 0.2 * v ** 1.3, rzF: 0.1 + 0.2 * v ** 1.3, rzB: 0.11 + 0.24 * v ** 1.2 });
  const skMod = (p, u, v) => { const a = u * TAU; p.y += v > 0.8 ? (0.05 * Math.sin(a * 7) + 0.03 * Math.sin(a * 13 + 1)) * smooth(0.8, 1, v) : 0; const fold = 0.012 * Math.sin(a * 9) * smooth(0.2, 1, v); p.x += Math.cos(a) * fold; p.z += Math.sin(a) * fold; };
  m.skirt = mesh(J.hips, C('mageSkirt', () => loft(skP, 48, 16, { mod: skMod, uvU: 2 })), M.robe);
  mesh(J.hips, C('mageSkirtIn', () => loft((v) => { const q = skP(v); return { ...q, rx: q.rx - 0.006, rzF: q.rzF - 0.006, rzB: q.rzB - 0.006 }; }, 48, 16, { mod: skMod })), M.robeD);
  // 몸통 · 허리띠
  mesh(J.spine, C('mageBelly', () => loft((v) => ({ y: -0.06 + 0.26 * v, rx: 0.115 + 0.005 * v, rzF: 0.09, rzB: 0.095 }), 28, 6, { uvU: 2 })), M.robe);
  mesh(J.chest, C('mageChest', () => loft((v) => ({ y: -0.03 + 0.27 * v, rx: spl([[0, 0.118], [0.6, 0.13], [1, 0.07]])(v), rzF: spl([[0, 0.092], [0.6, 0.1], [1, 0.06]])(v), rzB: spl([[0, 0.095], [0.6, 0.1], [1, 0.065]])(v) }), 28, 10, { uvU: 2 })), M.robe);
  const beltP = (v) => ({ y: 0.03 + 0.05 * v, rx: 0.13, rzF: 0.108, rzB: 0.115 });
  mesh(J.hips, C('mageBelt', () => loft(beltP, 32, 2)), M.iron);
  for (const v of [0, 1]) mesh(J.hips, C('mageBeltR' + v, () => strand(loftRing(beltP, v, { n: 40 }), 0.004, 0.004, { closed: true, seg: 80, rad: 5 })), M.gold);
  mesh(J.hips, C('mageBuckle', () => new THREE.TorusGeometry(0.03, 0.008, 6, 14)), M.gold, [0, 0.055, 0.112]);
  mesh(J.hips, C('mageBuckleG', () => new THREE.OctahedronGeometry(0.018, 0)), M.eye, [0, 0.055, 0.115]);
  // 어깨 망토 (어깨를 덮는 짧은 망토 · 금테)
  const cpP = (v) => ({ y: 0.3 - 0.24 * v, rx: 0.08 + 0.18 * v ** 0.7, rzF: 0.07 + 0.09 * v ** 0.8, rzB: 0.075 + 0.13 * v ** 0.8 });
  const cpMod = (p, u, v) => { const a = u * TAU; p.y += (0.025 * Math.sin(a * 6)) * smooth(0.7, 1, v); };
  mesh(J.chest, C('mageCape', () => loft(cpP, 40, 8, { mod: cpMod, uvU: 2 })), M.robe);
  mesh(J.chest, C('mageCapeHem', () => strand(loftRing(cpP, 1, { n: 80, mod: cpMod }), 0.006, 0.006, { closed: true, seg: 160, rad: 5 })), M.gold);
  // 두건: 얼굴 쪽이 열린 고깔 (끝이 뒤로 처짐) + 금테
  const hdP = (v) => ({ y: -0.04 + 0.38 * v, rx: 0.135 * (1 - v ** 1.6) + 0.004, rzF: 0.15 * (1 - v ** 1.4) + 0.004, rzB: 0.14 * (1 - v ** 1.3) + 0.004, cz: -0.12 * v ** 2.2 + 0.01, cx: 0 });
  const hdO = { a0: 0.62, a1: 1.38 }; // 앞(0.5) 주변을 비움
  mesh(J.head, C('mageHood', () => loft(hdP, 36, 14, { ...hdO, mod: (p, u, v) => { if (v < 0.12) { p.x *= 1.15; } } })), M.robe);
  mesh(J.head, C('mageHoodIn', () => loft((v) => { const q = hdP(v); return { ...q, rx: q.rx - 0.008, rzF: q.rzF - 0.008, rzB: q.rzB - 0.008 }; }, 36, 14, hdO)), M.robeD);
  { const pts = []; for (let i = 0; i <= 18; i++) pts.push(loftAt(hdP, 0.62, 0.7 * (1 - i / 18), new V3())); for (let i = 1; i <= 18; i++) pts.push(loftAt(hdP, 1.38, 0.7 * (i / 18), new V3()));
    mesh(J.head, C('mageHoodR', () => strand(pts, 0.006, 0.006, { seg: 80, rad: 5 })), M.gold); }
  // 두건 속: 어둠 + 흑요석 가면 (빛나는 눈 · 균열)
  mesh(J.head, C('mageVoid', () => new THREE.SphereGeometry(0.105, 16, 12)), M.void, [0, 0.11, 0.0]);
  mesh(J.head, C('mageMask', () => surf((u, v, p) => { const az = (u - 0.5) * 2.2, el = -0.9 + 1.6 * v; p.set(Math.sin(az) * Math.cos(el) * 0.1, 0.11 + Math.sin(el) * 0.12 - 0.02 * gauss(az, 0.2) * gauss(el + 0.2, 0.2), 0.015 + Math.cos(az) * Math.cos(el) * 0.1 + 0.02 * gauss(az, 0.25) * gauss(el + 0.05, 0.2)); }, 20, 16)), M.mask);
  for (const s of [-1, 1]) mesh(J.head, C('mageEye', () => { const g = new THREE.SphereGeometry(0.016, 10, 8); g.scale(1.6, 0.6, 0.5); return g; }), M.eye, [s * 0.038, 0.13, 0.118], [0, s * 0.3, -s * 0.25]);
  // 팔: 넓은 소매 · 앙상한 손
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    mesh(sh, limbGeo('mageUA', D.uArm, 0.03, (v) => 0.048 + 0.006 * v, (v) => 0.046 + 0.006 * v), M.robe);
    const slP = (v) => ({ y: 0.02 - (D.lArm + 0.06) * v, rx: 0.05 + 0.065 * v ** 1.5, rzF: 0.05 + 0.07 * v ** 1.5, rzB: 0.05 + 0.075 * v ** 1.5, cz: -0.02 * v });
    const slMod = (p, u, v) => { p.y += 0.02 * Math.sin(u * TAU * 5) * smooth(0.8, 1, v); };
    mesh(el, C('mageSleeve', () => loft(slP, 24, 8, { mod: slMod })), M.robe);
    mesh(el, C('mageSleeveIn', () => loft((v) => { const q = slP(v); return { ...q, rx: q.rx - 0.005, rzF: q.rzF - 0.005, rzB: q.rzB - 0.005 }; }, 24, 8, { mod: slMod })), M.robeD);
    mesh(el, C('mageSleeveH', () => strand(loftRing(slP, 1, { n: 40, mod: slMod }), 0.004, 0.004, { closed: true, seg: 80, rad: 4 })), M.gold);
    mesh(el, limbGeo('mageWrist', 0.05, -D.lArm + 0.06, 0.02, 0.02), M.skin);
    buildHand(ha, 'mage', s, M, { n: 4, k: 1.0, len: 0.075, claw: 0.025, curl: 1.3 });
  }
  // 허리띠 두 줄: 앞으로 늘어진 천 끈 (로프)
  const SC = 1;
  for (const s of [-1, 1]) {
    const rope = new Rope(7, 0.085 * SC, { damp: 0.975, stiff: 0.05 });
    const view = new RopeTube(rope, M.robe, { sub: 3, rad: 8, flat: 0.18, side: new V3(1, 0, 0), prof: (v) => 0.03 * SC * (1 - 0.2 * v) });
    m.ropes.push({ rope, view, joint: J.hips, local: new V3(s * 0.05, 0.03, 0.12), rest: new V3(0, -1, 0.15).normalize(), sideL: new V3(1, 0, 0) });
  }
  // 화로 지팡이: 뒤틀린 나무 자루 · 쇠 고리 · 쇠 갈퀴 화로 속 불덩이
  const W = J.weapon;
  { const pts = []; for (let i = 0; i <= 16; i++) { const z = -0.55 + 1.5 * (i / 16); pts.push(new V3(0.008 * Math.sin(i * 1.7), 0.008 * Math.cos(i * 1.3), z)); }
    mesh(W, C('mageStaff', () => strand(pts, 0.02, 0.016, { seg: 48, rad: 8, prof: (v) => 1 + 0.1 * Math.sin(v * 70) })), M.wood);
    for (const z of [-0.5, 0.1, 0.78]) mesh(W, C('mageRing', () => new THREE.TorusGeometry(0.024, 0.006, 6, 14)), M.iron, [0, 0, z]);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4, pts2 = [new V3(Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0.92), new V3(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 1.0), new V3(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 1.12), new V3(Math.cos(a) * 0.02, Math.sin(a) * 0.02, 1.2)];
      mesh(W, C('mageProng' + k, () => strand(pts2, 0.008, 0.004, { seg: 14, rad: 5 })), M.iron); }
    m.orb = mesh(W, C('mageOrb', () => new THREE.SphereGeometry(0.05, 14, 10)), M.fire, [0, 0, 1.05]);
    m.orbH = mesh(W, C('mageOrbH', () => new THREE.SphereGeometry(0.09, 14, 10)), M.halo, [0, 0, 1.05]); }
  // 주위를 도는 용암 돌 셋
  const orb = new THREE.Group(); orb.position.y = 1.15; m.body.add(orb); const stones = [];
  for (let i = 0; i < 3; i++) { const s = mesh(orb, rockGeo('ember' + i, 0.045, 1, 0.3, i * 3), M.rock); stones.push(s); }
  let t = Math.random() * 10; const tmp = new V3();
  m.update = (dt, f) => {
    t += dt; m.sole = 0.2 + Math.sin(t * 1.8) * 0.05;
    m.skirt.rotation.y = Math.sin(t * 1.3) * 0.06; m.skirt.rotation.x = -Math.min(0.25, Math.hypot(f.vel.x, f.vel.z) * 0.04);
    stones.forEach((s, i) => { const a = t * 1.2 + (i / 3) * TAU; s.position.set(Math.cos(a) * 0.55, Math.sin(t * 2 + i * 2) * 0.12, Math.sin(a) * 0.55); s.rotation.set(t * 2 + i, t * 1.5, 0); });
    const pulse = 1 + 0.12 * Math.sin(t * 9) + 0.06 * Math.sin(t * 23); m.orb.scale.setScalar(pulse); m.orbH.scale.setScalar(pulse * (1 + 0.3 * (f.state === 'act' ? 1 : 0)));
    M.mask.emissiveIntensity = 1.2 + 0.4 * Math.sin(t * 2.3);
    if (f.root.visible && Math.random() < dt * 30) { m.orb.getWorldPosition(tmp); f.G.fx.p(tmp, { vel: [(Math.random() - 0.5) * 0.5, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 0.5], size: 0.1 + Math.random() * 0.06, size1: 0.02, life: 0.45, color: Math.random() < 0.6 ? 0xff7a20 : 0xffd070, alpha: 0.9, drag: 1.5 }); }
    if (f.root.visible && Math.random() < dt * 6) { J.hips.localToWorld(tmp.set((Math.random() - 0.5) * 0.5, -0.9, (Math.random() - 0.5) * 0.5)); f.G.fx.p(tmp, { vel: [0, 0.6, 0], size: 0.05, size1: 0.01, life: 0.6, color: 0xff6a10, alpha: 0.8, drag: 1 }); }
    stepRopes(dt, f);
  };
  m.sole = 0.2;
  m.tipPos = (out) => W.localToWorld(out.set(0, 0, 1.05));
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.3)); W.localToWorld(tt.set(0, 0, 1.15)); };
  return m;
}

/* =====================================================================
   3. 흑요석 골렘 — 용암 핵을 품은 바위 거구
   ===================================================================== */
export function buildGolem(pal) {
  const D = GOLEM_DIMS, m = buildHumanoid(D), J = m.J, env = envCube();
  const M = {
    obs: magmaMat('golemSkin', 7, { n: 26, w: 0.014, base: [26, 22, 30], base2: [10, 9, 14], crack: [170, 40, 6], size: 512 }, { ei: 1.3, rough: 0.28, metal: 0.35, env: 0.8, flat: true, bump: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.08, metalness: 0.55, envMap: env, envMapIntensity: 1.3, flatShading: true }),
    core: new THREE.MeshBasicMaterial({ color: 0xffb040 }), coreH: new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffc040 }),
  };
  const rockMod = (k, f = 5) => (p, u, v, c, s) => { const n = fbm(p.x * f + k, p.y * f, p.z * f, 3) - 0.5; const L = Math.hypot(p.x, p.z) || 1; p.x += (p.x / L) * n * 0.05; p.z += (p.z / L) * n * 0.05; };
  // 골반 · 배 · 거대한 가슴 (앞으로 굽은 등)
  mesh(J.hips, C('gPelvis', () => loft((v) => ({ y: 0.12 - 0.26 * v, rx: (0.23 + 0.02 * Math.sin(v * Math.PI)) * (1 - 0.7 * smooth(0.75, 1, v)), rzF: 0.17 * (1 - 0.7 * smooth(0.8, 1, v)), rzB: 0.19 * (1 - 0.7 * smooth(0.8, 1, v)) }), 22, 8, { mod: rockMod(1) })), M.obs);
  mesh(J.spine, C('gBelly', () => loft((v) => ({ y: -0.06 + 0.3 * v, rx: 0.22 + 0.04 * v, rzF: 0.18 + 0.02 * v, rzB: 0.19 + 0.03 * v }), 22, 8, { mod: rockMod(2) })), M.obs);
  const cX = spl([[0, 0.27], [0.35, 0.36], [0.7, 0.4], [1, 0.16]]), cF = spl([[0, 0.21], [0.5, 0.25], [1, 0.12]]), cB = spl([[0, 0.22], [0.5, 0.3], [0.85, 0.28], [1, 0.12]]);
  mesh(J.chest, C('gChest', () => loft((v) => ({ y: -0.04 + 0.48 * v, rx: cX(v), rzF: cF(v), rzB: cB(v), cz: -0.02 * v }), 32, 14, { mod: (p, u, v, c, s) => { rockMod(3, 4)(p, u, v, c, s); if (s > 0.3) { const k = gauss(p.x, 0.07) * gauss(p.y - 0.22, 0.08); p.z -= 0.09 * k; } } })), M.obs);
  // 가슴의 용암 핵 + 둘러싼 흑요석 조각
  m.core = mesh(J.chest, C('gCore', () => new THREE.IcosahedronGeometry(0.075, 1)), M.core, [0, 0.22, 0.19]);
  m.coreH = mesh(J.chest, C('gCoreH', () => new THREE.SphereGeometry(0.12, 14, 10)), M.coreH, [0, 0.22, 0.2]);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, b = new V3(Math.cos(a) * 0.1, 0.22 + Math.sin(a) * 0.1, 0.2), tip = b.clone().add(new V3(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.08));
    orient(mesh(J.chest, shardG('gCs', 0.022, 0.1), M.glass), b, tip); }
  // 등: 흑요석 결정 무리
  for (const [x, y, z, rx, rz, h] of [[0, 0.38, -0.22, -0.9, 0, 0.36], [0.13, 0.34, -0.2, -0.8, -0.4, 0.28], [-0.13, 0.34, -0.2, -0.8, 0.4, 0.3], [0.22, 0.2, -0.22, -0.6, -0.7, 0.22], [-0.22, 0.22, -0.22, -0.6, 0.7, 0.24], [0.06, 0.16, -0.27, -1.1, -0.2, 0.18], [-0.07, 0.12, -0.27, -1.2, 0.2, 0.2]]) {
    mesh(J.chest, shardG('gBk' + h, 0.05, h), M.glass, [x, y, z], [rx, 0, rz]); }
  // 머리: 어깨 사이에 파묻힌 각진 바위 · 눈 틈 · 눈썹 조각
  mesh(J.head, rockGeo('gHead', 0.13, 1, 0.18, 5, [1.1, 0.85, 1]), M.obs, [0, 0.06, 0.1]);
  mesh(J.head, C('gEyes', () => new THREE.BoxGeometry(0.16, 0.022, 0.03)), M.eye, [0, 0.07, 0.215], [0.1, 0, 0]);
  for (const s of [-1, 1]) mesh(J.head, shardG('gBrow', 0.03, 0.14), M.glass, [s * 0.06, 0.11, 0.18], [1.2, 0, s * 1.2]);
  // 팔: 거대한 바위 어깨 · 두꺼운 팔 · 큰 주먹
  for (const [a, b, c, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    mesh(a, rockGeo('gPaul' + s, 0.2, 1, 0.22, 9 + s, [1.1, 0.95, 1.05]), M.obs, [s * 0.04, 0.05, 0]);
    for (let k = 0; k < 3; k++) mesh(a, shardG('gPs' + k, 0.04, 0.22 - k * 0.04), M.glass, [s * (0.08 + k * 0.05), 0.18 - k * 0.02, -0.04 + k * 0.03], [-0.2 + k * 0.15, 0, -s * (0.4 + k * 0.25)]);
    mesh(a, limbGeo('gUA', D.uArm, 0.0, (v) => 0.12 + 0.02 * gauss(v - 0.4, 0.25), (v) => 0.12 + 0.02 * gauss(v - 0.4, 0.25), 0.12, { mod: rockMod(4 + s) }), M.obs);
    mesh(b, rockGeo('gElb' + s, 0.11, 1, 0.2, 2 + s), M.obs);
    mesh(b, limbGeo('gFA', D.lArm, 0.02, (v) => 0.125 + 0.05 * v, (v) => 0.13 + 0.04 * v, (v) => 0.135 + 0.05 * v, { mod: rockMod(6) }), M.obs);
    const fist = mesh(c, rockGeo('gFist' + s, 0.15, 1, 0.16, 12 + s, [1, 1.05, 1.15]), M.obs, [0, -0.1, 0.02]);
    for (let k = 0; k < 4; k++) mesh(c, rockGeo('gKn' + k, 0.05, 0, 0.2, k), M.glass, [s * (0.08 - k * 0.055) * -1 * s * s, -0.16, 0.12]);
    void fist;
  }
  // 다리: 짧고 굵은 기둥 · 넓은 발판
  for (const [a, b, c, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    mesh(a, limbGeo('gTh', D.thigh, 0.04, (v) => 0.15 - 0.02 * v, 0.15, (v) => 0.16 - 0.02 * v, { mod: rockMod(7) }), M.obs);
    mesh(b, rockGeo('gKnee' + s, 0.11, 1, 0.2, 3 + s), M.obs, [0, 0, 0.04]);
    mesh(b, limbGeo('gSh', D.shin, 0.02, (v) => 0.13 + 0.02 * v, (v) => 0.13 + 0.02 * v, (v) => 0.14, { mod: rockMod(8) }), M.obs);
    mesh(c, rockGeo('gFoot' + s, 0.16, 1, 0.12, 4 + s, [1, 0.45, 1.35]), M.obs, [0, -0.04, 0.07]);
  }
  let t = Math.random() * 10; const tmp = new V3(), drips = [J.chest, J.handL, J.handR, J.spine];
  m.update = (dt, f) => {
    t += dt; const k = 1 + 0.25 * Math.sin(t * 2.2) + (f.state === 'act' ? 0.3 : 0);
    M.obs.emissiveIntensity = 1.1 + 0.35 * Math.sin(t * 1.7); m.core.scale.setScalar(k); m.coreH.scale.setScalar(k * (1 + 0.1 * Math.sin(t * 13)));
    if (f.root.visible && Math.random() < dt * 10) { const j = drips[(Math.random() * drips.length) | 0]; j.localToWorld(tmp.set((Math.random() - 0.5) * 0.3, Math.random() * 0.3, 0.1)); f.G.fx.p(tmp, { vel: [0, -1, 0], size: 0.07, size1: 0.03, life: 0.6, color: 0xff7a20, alpha: 0.9, drag: 0.5, grav: 6 }); }
  };
  m.sole = 0.07;
  m.tipPos = (out) => J.handR.localToWorld(out.set(0, -0.12, 0.1));
  m.weaponPts = (b, tt) => { J.elbowR.localToWorld(b.set(0, -0.2, 0)); J.handR.localToWorld(tt.set(0, -0.22, 0.05)); };
  return m;
}

/* =====================================================================
   4. 화염 거인 수르트 — 분화구의 왕
   ===================================================================== */
export const SURT_DIMS = { hipH: 0.94, spineL: 0.21, chestL: 0.33, neckL: 0.08, shW: 0.27, uArm: 0.31, lArm: 0.29, hipW: 0.115, thigh: 0.44, shin: 0.44, headTop: 0.3 };
export const SURT_BLADE = 1.75; // 대검 끝 (무기 관절 +Z)
export function buildSurt(pal, SC = 1.95) {
  const D = SURT_DIMS, m = buildHumanoid(D), J = m.J, env = envCube(), stepRopes = ropeKit(m);
  const M = {
    skin: magmaMat('surtSkin', 3, { n: 34, w: 0.0055, base: [104, 70, 58], base2: [52, 34, 30], size: 512 }, { ei: 0.9, rough: 0.62, bump: 2.5 }),
    obs: magmaMat('surtObs', 19, { n: 16, w: 0.008, base: [24, 20, 28], base2: [8, 7, 10], crack: [160, 30, 6], size: 256 }, { ei: 1.2, rough: 0.22, metal: 0.45, env: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 0.1, metalness: 0.6, envMap: env, envMapIntensity: 1.2 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc89040, metalness: 1, roughness: 0.32, envMap: env, envMapIntensity: 1 }),
    flame: new THREE.MeshStandardMaterial({ map: TX('flame', flameTex), emissiveMap: TX('flame', flameTex), emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.6, side: THREE.DoubleSide }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffe080 }), lava: new THREE.MeshBasicMaterial({ color: 0xff7a20 }),
    edge: new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    claw: new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 0.3 }),
    loin: new THREE.MeshStandardMaterial({ map: TX('loin', loinTex), roughness: 0.9, side: THREE.DoubleSide }),
    rock: magmaMat('boulder', 29, { n: 12, w: 0.02, base: [44, 36, 34], base2: [20, 16, 16], size: 256 }, { ei: 1.4, flat: true }),
  };
  /* ---------- 몸통: 골반 · 복근 · 큰 가슴(대흉근) · 넓은 등 ---------- */
  mesh(J.hips, C('sPelvis', () => loft((v) => ({ y: 0.09 - 0.2 * v, rx: (0.16 + 0.012 * Math.sin(v * Math.PI)) * (1 - 0.75 * smooth(0.75, 1, v)), rzF: 0.11 * (1 - 0.7 * smooth(0.8, 1, v)), rzB: 0.125 * (1 - 0.7 * smooth(0.8, 1, v)) }), 28, 8)), M.skin);
  const abs = (p, u, v, c, s) => { if (s > 0.2) { for (const row of [0.25, 0.5, 0.75]) for (const sd of [-1, 1]) p.z += 0.009 * gauss(p.x - sd * 0.034, 0.022) * gauss(v - row, 0.11) * s; p.z -= 0.006 * gauss(p.x, 0.006); } };
  mesh(J.spine, C('sBelly', () => loft((v) => ({ y: -0.05 + 0.27 * v, rx: 0.15 + 0.022 * v, rzF: 0.118, rzB: 0.12 + 0.012 * v }), 32, 12, { mod: abs })), M.skin);
  const cX = spl([[0, 0.17], [0.3, 0.195], [0.62, 0.235], [0.86, 0.24], [1, 0.12]]), cF = spl([[0, 0.125], [0.6, 0.145], [1, 0.09]]), cB = spl([[0, 0.13], [0.55, 0.155], [1, 0.1]]);
  const chMod = (p, u, v, c, s) => { if (s > 0) { const ax = Math.abs(p.x); p.z += 0.04 * gauss(ax - 0.08, 0.06) * gauss(v - 0.62, 0.16) * s ** 1.3; p.z -= 0.012 * gauss(p.x, 0.012) * gauss(v - 0.6, 0.25); p.y -= 0.02 * gauss(ax - 0.08, 0.06) * gauss(v - 0.48, 0.07) * s; } else { p.z -= 0.012 * gauss(p.x, 0.02) * (-s); } const ax = Math.abs(c); p.x += Math.sign(c) * 0.015 * gauss(v - 0.45, 0.2) * ax; };
  mesh(J.chest, C('sChest', () => loft((v) => ({ y: -0.03 + 0.36 * v, rx: cX(v), rzF: cF(v), rzB: cB(v) }), 40, 18, { mod: chMod })), M.skin);
  // 승모근 · 목
  mesh(J.chest, C('sTrap', () => loft((v) => ({ y: 0.29 + 0.08 * v, rx: 0.17 - 0.1 * v, rzF: 0.09 - 0.025 * v, rzB: 0.11 - 0.04 * v, cz: -0.015 }), 28, 6)), M.skin);
  mesh(J.neck, limbGeo('sNeck', 0.0, 0.12, 0.06, 0.06, 0.065), M.skin, [0, 0, 0], [Math.PI, 0, 0]);
  /* ---------- 머리: 무거운 이마 · 깊은 눈 · 넓은 코 · 불꽃 수염과 갈기 · 흑요석 뿔 왕관 ---------- */
  const HD = makeHead('surtHead', { c: new V3(0, 0.12, 0.015), rx: 0.098, ry: 0.118, rzF: 0.108, rzB: 0.1 }, (az, el) => {
    const fr = Math.max(0, Math.cos(az)); let d = 0;
    d += 0.02 * fr * gauss(el - 0.3, 0.09) * gauss(az, 0.7);
    for (const s of [-1, 1]) { d -= 0.016 * gauss(az - s * 0.36, 0.15) * gauss(el - 0.15, 0.1); d += 0.01 * gauss(az - s * 0.7, 0.2) * gauss(el - 0.0, 0.14); }
    d += 0.028 * gauss(az, 0.17) * gauss(el + 0.02, 0.16) * smooth(-0.3, 0.1, el) - 0.004;
    d += 0.012 * fr * smooth(0, -0.7, el) * (1 - smooth(-1, -1.4, el));
    if (el < -0.2) d += 0.01 * Math.abs(Math.sin(az)) * smooth(-0.2, -0.8, el);
    return d;
  });
  const H = J.head; mesh(H, HD.geo, M.skin); H.scale.setScalar(1.0);
  for (const s of [-1, 1]) { const e = mesh(H, C('sEye', () => { const g = new THREE.SphereGeometry(0.017, 10, 8); g.scale(1.5, 0.6, 0.6); return g; }), M.eye); e.position.copy(HD.pt(s * 0.36, 0.15, -0.006)); e.rotation.set(0, s * 0.35, -s * 0.15); }
  const rf = rng(3), flameStrand = (key, pts, r0, r1) => mesh(H, C(key, () => strand(pts, r0, r1, { seg: 14, rad: 6, flat: 0.55 })), M.flame);
  // 불꽃 수염: 턱 · 볼에서 아래 앞으로 흘러내리며 끝이 갈라짐
  for (let k = 0; k < 13; k++) { const az = -1.2 + 2.4 * (k / 12), el = -0.42 - 0.5 * (1 - Math.abs(az) / 1.3) ** 0.6, b = HD.pt(az, el, -0.004), out = new V3(Math.sin(az), 0, Math.cos(az)), L = 0.09 + 0.09 * (1 - Math.abs(az) / 1.2) + rf() * 0.04;
    flameStrand('sBeard' + k, [b, b.clone().addScaledVector(out, 0.03).add(new V3(0, -0.05, 0.01)), b.clone().addScaledVector(out, 0.04).add(new V3((rf() - 0.5) * 0.03, -L * 0.7, 0.03)), b.clone().addScaledVector(out, 0.02).add(new V3((rf() - 0.5) * 0.05, -L, 0.05 + rf() * 0.02))], 0.017, 0.002); }
  // 콧수염
  for (const s of [-1, 1]) { const b = HD.pt(s * 0.12, -0.12, 0.002); flameStrand('sMus' + s, [b, b.clone().add(new V3(s * 0.04, -0.015, 0.01)), b.clone().add(new V3(s * 0.07, -0.06, 0.0)), b.clone().add(new V3(s * 0.08, -0.12, -0.01))], 0.012, 0.002); }
  // 불꽃 갈기: 정수리 · 뒤통수에서 위 · 뒤로 솟구침
  for (let k = 0; k < 22; k++) { const az = Math.PI + (k - 10.5) * 0.24, el = 0.3 + 0.4 * rf(), b = HD.pt(az, el, -0.006), up = 0.08 + rf() * 0.08;
    flameStrand('sMane' + k, [b, b.clone().add(new V3(Math.sin(az) * 0.04, 0.05, Math.cos(az) * 0.04 - 0.02)), b.clone().add(new V3(Math.sin(az) * 0.07, up * 0.8, -0.08)), b.clone().add(new V3(Math.sin(az) * 0.06 + (rf() - 0.5) * 0.04, up * 1.25, -0.16 - rf() * 0.06))], 0.03, 0.002); }
  for (let k = 0; k < 8; k++) { const az = (k - 3.5) * 0.18, b = HD.pt(az, 0.85, -0.004); flameStrand('sTop' + k, [b, b.clone().add(new V3(az * 0.05, 0.05, -0.02)), b.clone().add(new V3(az * 0.08, 0.1, -0.08)), b.clone().add(new V3(az * 0.06, 0.14, -0.15))], 0.024, 0.002); }
  // 흑요석 왕관: 이마를 두른 테 · 위로 솟은 가시 · 큰 뿔 둘
  { const ring = []; for (let i = 0; i <= 48; i++) { const az = (i / 48) * TAU; ring.push(HD.pt(az, 0.52 - 0.12 * Math.max(0, -Math.cos(az)), 0.012)); }
    mesh(H, C('sCrown', () => strand(ring, 0.016, 0.016, { closed: true, seg: 96, rad: 6, flat: 0.6, ref: [0, 1, 0] })), M.obs);
    for (let i = 0; i < 9; i++) { const az = -1.6 + i * 0.4, b = HD.pt(az, 0.55, 0.012), n = b.clone().sub(new V3(0, 0.12, 0.015)).normalize(); const L = i === 4 ? 0.12 : 0.07 - Math.abs(i - 4) * 0.004;
      orient(mesh(H, shardG('sCs' + i, 0.014, L), M.glass), b, b.clone().add(n.multiplyScalar(0.3)).add(new V3(0, 1, 0))); }
    mesh(H, C('sCrGem', () => new THREE.OctahedronGeometry(0.018, 0)), M.lava, [0, 0.19, 0.125]);
    for (const s of [-1, 1]) { const b = HD.pt(s * 1.2, 0.5, 0.01), pts = [b, b.clone().add(new V3(s * 0.06, 0.03, -0.01)), b.clone().add(new V3(s * 0.12, 0.1, -0.04)), b.clone().add(new V3(s * 0.13, 0.2, -0.08)), b.clone().add(new V3(s * 0.1, 0.28, -0.1))];
      mesh(H, C('sHorn' + s, () => strand(pts, 0.032, 0.002, { seg: 24, rad: 9, prof: (v) => 1 + 0.08 * Math.sin(v * 40) * (1 - v) })), M.glass); } }
  /* ---------- 팔: 삼각근 · 이두 · 굵은 앞팔 · 흑요석 팔찌 / 왼어깨 거대 견갑 ---------- */
  for (const [sh, el, ha, s] of [[J.shoulderL, J.elbowL, J.handL, 1], [J.shoulderR, J.elbowR, J.handR, -1]]) {
    mesh(sh, C('sDelt', () => loft((v) => ({ y: 0.08 - 0.22 * v, rx: 0.105 - 0.025 * v, rzF: 0.1 - 0.02 * v, rzB: 0.105 - 0.025 * v }), 20, 8)), M.skin, [s * 0.015, 0, 0]);
    mesh(sh, limbGeo('sUA', D.uArm + 0.01, 0.0, (v) => 0.085 - 0.014 * v, (v) => 0.08 + 0.024 * gauss(v - 0.45, 0.2), (v) => 0.082 + 0.016 * gauss(v - 0.35, 0.2), { nu: 24, nv: 12 }), M.skin);
    mesh(el, limbGeo('sFA', D.lArm, 0.02, (v) => 0.078 + 0.014 * gauss(v - 0.25, 0.2) - 0.02 * v, (v) => 0.074 + 0.01 * gauss(v - 0.2, 0.2) - 0.016 * v, null, { nu: 24, nv: 12 }), M.skin);
    const brP = (v) => ({ y: -0.1 - 0.18 * v, rx: 0.085 - 0.012 * v, rz: 0.082 - 0.012 * v, n: 2.4 });
    mesh(el, C('sBracer', () => loft(brP, 24, 4)), M.obs);
    for (const v of [0, 1]) mesh(el, C('sBrR' + v, () => strand(loftRing(brP, v, { n: 32 }), 0.006, 0.006, { closed: true, seg: 64, rad: 5 })), M.gold);
    for (let k = 0; k < 3; k++) orient(mesh(el, shardG('sBrS', 0.012, 0.07), M.glass), new V3(s * 0.06, -0.14 - k * 0.05, -0.02), new V3(s * 0.12, -0.12 - k * 0.05, -0.05));
    buildHand(ha, 'surt', s, M, { n: 4, k: 1.7, len: 0.065, claw: 0.02, curl: 1.5 });
  }
  // 왼쪽 거대 견갑: 겹친 흑요석 판 셋 + 가시 + 금테
  for (let k = 0; k < 3; k++) {
    const pp = (v) => ({ y: 0.11 - k * 0.05 - 0.1 * v, rx: 0.1 + 0.015 * k + 0.04 * v, rz: 0.1 + 0.012 * k + 0.035 * v });
    mesh(J.shoulderL, C('sPld' + k, () => loft(pp, 24, 6, { a0: 0.0, a1: 0.5 })), M.obs, [0.02, 0, 0], [0, 0, 0.12 * k]);
    mesh(J.shoulderL, C('sPldR' + k, () => strand(loftRing(pp, 1, { a0: 0, a1: 0.5, n: 24 }), 0.006, 0.006, { seg: 48, rad: 5 })), M.gold, [0.02, 0, 0], [0, 0, 0.12 * k]);
  }
  for (const [dy, dz, ax, len] of [[0.12, -0.03, 0.5, 0.2], [0.09, 0.05, 0.8, 0.14], [0.08, -0.09, 1.1, 0.15]]) {
    const b = new V3(0.08, dy, dz); orient(mesh(J.shoulderL, shardG('sPs' + len, 0.024, len), M.glass), b, b.clone().add(new V3(0.6, Math.cos(ax), -Math.sin(ax) * 0.5)));
  }
  /* ---------- 허리: 넓은 벨트(금테 · 용암 보석 버클) · 허리 천(로프) · 허벅지 흑요석 판 ---------- */
  const beltP = (v) => ({ y: 0.02 + 0.08 * v, rx: 0.175 - 0.004 * v, rzF: 0.13, rzB: 0.142, n: 2.3 });
  mesh(J.hips, C('sBelt', () => loft(beltP, 48, 3)), M.obs);
  for (const v of [0, 1]) mesh(J.hips, C('sBeltR' + v, () => strand(loftRing(beltP, v, { n: 48 }), 0.006, 0.006, { closed: true, seg: 96, rad: 5 })), M.gold);
  { const g = new THREE.Group(); g.position.set(0, 0.06, 0.136); J.hips.add(g);
    const sh = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; i ? sh.lineTo(Math.cos(a) * 0.055, Math.sin(a) * 0.055) : sh.moveTo(Math.cos(a) * 0.055, Math.sin(a) * 0.055); } sh.closePath();
    mesh(g, C('sBuckle', () => new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 })), M.gold);
    mesh(g, C('sBuckG', () => new THREE.OctahedronGeometry(0.03, 0)), M.lava, [0, 0, 0.022]); }
  for (const [sd, z, w] of [[1, 0.13, 0.15], [-1, -0.14, 0.18]]) {
    const rope = new Rope(7, 0.085 * SC, { damp: 0.972, stiff: 0.1 });
    const view = new RopeTube(rope, M.loin, { sub: 3, rad: 10, flat: 0.12, side: new V3(1, 0, 0), prof: (v) => w * SC * 0.5 * (1 - 0.15 * v) });
    m.ropes.push({ rope, view, joint: J.hips, local: new V3(0, 0.0, z), rest: new V3(0, -1, sd * 0.25).normalize(), sideL: new V3(1, 0, 0) });
  }
  // 허벅지 바깥 판 (다리를 따라 움직임)
  for (const [hp, s] of [[J.hipL, 1], [J.hipR, -1]]) {
    for (let k = 0; k < 2; k++) { const tp = (v) => ({ y: 0.06 - k * 0.07 - 0.13 * v, rx: 0.118 + 0.01 * v, rz: 0.114 + 0.01 * v });
      const a0 = s > 0 ? 0.08 : 0.58; mesh(hp, C('sTas' + s + k, () => loft(tp, 14, 4, { a0, a1: a0 + 0.34 })), M.obs);
      mesh(hp, C('sTasR' + s + k, () => strand(loftRing(tp, 1, { a0, a1: a0 + 0.34, n: 14 }), 0.005, 0.005, { seg: 28, rad: 5 })), M.gold); }
  }
  /* ---------- 다리: 굵은 허벅지 · 흑요석 정강이 갑주(무릎 가시) · 무거운 장화 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    mesh(hp, limbGeo('sTh', D.thigh + 0.02, 0.04, (v) => 0.11 - 0.028 * v, (v) => 0.108 + 0.012 * gauss(v - 0.4, 0.25) - 0.025 * v, (v) => 0.112 - 0.03 * v, { nu: 24, nv: 12 }), M.skin);
    const gP = (v) => ({ y: 0.05 - D.shin * v, rx: 0.084 - 0.018 * v, rzF: 0.088 - 0.02 * v, rzB: 0.094 + 0.014 * gauss(v - 0.3, 0.2) - 0.026 * v, n: 2.2 });
    mesh(kn, C('sGreave', () => loft(gP, 24, 10, { mod: (p, u, v, c, sn) => { if (sn > 0) p.z += 0.012 * gauss(p.x, 0.015) * sn; } })), M.obs);
    mesh(kn, C('sGrR', () => strand(loftRing(gP, 0, { n: 32 }), 0.006, 0.006, { closed: true, seg: 64, rad: 5 })), M.gold);
    orient(mesh(kn, shardG('sKs', 0.03, 0.14), M.glass), new V3(0, 0.02, 0.06), new V3(0, 0.35, 1));
    const bt = C('sBoot', () => { const g = loft((v) => ({ y: -0.07 + 0.29 * v, rx: 0.072 + 0.01 * Math.sin(v * Math.PI), rzF: 0.06 * (1 - 0.35 * v) + 0.006, rzB: 0.036 + 0.034 * (1 - v), n: 2.4 }), 20, 8); g.rotateX(Math.PI / 2); g.translate(0, -0.05, 0); return g; });
    mesh(ft, bt, M.obs); mesh(ft, limbGeo('sAnk', 0.07, 0.04, 0.074, 0.074, 0.078), M.obs);
    for (const k of [-1, 0, 1]) orient(mesh(ft, coneG('sToe', 0.014, 0.05), M.claw), new V3(k * 0.03, -0.05, 0.2), new V3(k * 0.035, -0.08, 0.3));
  }
  /* ---------- 무기: 톱날 흑요석 대검 (가운데 용암 균열 · 달아오르는 날) ---------- */
  const W = J.weapon, sword = new THREE.Group(); W.add(sword); m.sword = sword; const L0 = 0.12, L1 = SURT_BLADE;
  { // 자루 · 폼멜
    mesh(sword, C('sGrip', () => { const g = loft((v) => ({ y: -0.24 + 0.34 * v, rx: 0.022, rz: 0.022 }), 12, 4); g.rotateX(Math.PI / 2); return g; }), M.loin);
    for (let i = 0; i < 5; i++) mesh(sword, C('sGripR', () => new THREE.TorusGeometry(0.024, 0.004, 5, 12)), M.gold, [0, 0, -0.2 + i * 0.07]);
    mesh(sword, rockGeo('sPommel', 0.04, 0, 0.2, 2), M.glass, [0, 0, -0.27]);
    // 코등이: 아래로 휜 흑요석 날개 + 용암 보석
    for (const s of [-1, 1]) mesh(sword, C('sGuard' + s, () => strand([[0, 0, 0.1], [0, s * 0.12, 0.08], [0, s * 0.22, 0.02], [0, s * 0.26, -0.06]], 0.035, 0.004, { seg: 16, rad: 7, flat: 0.5, ref: [1, 0, 0] })), M.obs);
    mesh(sword, C('sGuardG', () => new THREE.OctahedronGeometry(0.035, 0)), M.lava, [0, 0, 0.1]);
    // 칼날: 넓고 두꺼운 마름모 단면 · 양날 톱니 · 끝은 뾰족
    const bw = (v) => (0.085 - 0.025 * v) * (1 - smooth(0.86, 1, v) * 0.97) + 0.003, saw = (v) => 0.018 * Math.max(0, Math.sin(v * 15 * Math.PI)) ** 2 * (1 - smooth(0.8, 0.9, v));
    const bladeAt = (u, v, p) => { const a = u * TAU, ex = Math.cos(a), ey = Math.sin(a), w = bw(v) + saw(v) * Math.abs(ey) ** 4, th = 0.022 * (1 - 0.6 * v); p.set(ex * th * (1 - Math.abs(ey) ** 0.6 * 0.85), ey * w, L0 + (L1 - L0) * v + smooth(0.86, 1, v) * 0.03 * (1 - Math.abs(ey))); };
    mesh(sword, C('sBlade', () => surf(bladeAt, 12, 60, { closedU: true })), M.obs);
    // 가운데 용암 균열 (지그재그) · 날을 따라 달아오르는 선
    const crack = []; for (let i = 0; i <= 24; i++) { const v = 0.03 + 0.8 * (i / 24); crack.push(new V3(0, 0.012 * Math.sin(i * 2.7) + 0.006 * Math.sin(i * 7.1), L0 + (L1 - L0) * v)); }
    for (const sx of [-1, 1]) mesh(sword, C('sCrack' + sx, () => strand(crack.map((q) => new V3(sx * 0.013, q.y, q.z)), 0.006, 0.004, { seg: 60, rad: 5, flat: 0.5, ref: [1, 0, 0] })), M.lava);
    for (const sy of [-1, 1]) { const ed = []; for (let i = 0; i <= 40; i++) { const v = i / 40, q = new V3(); bladeAt(sy > 0 ? 0.25 : 0.75, v, q); ed.push(q); }
      mesh(sword, C('sEdge' + sy, () => strand(ed, 0.007, 0.002, { seg: 120, rad: 5 })), M.edge); }
  }
  // 왼손 바위 (던지기 기술 중에만 보임)
  m.boulder = mesh(J.handL, rockGeo('sBoulder', 0.24, 1, 0.25, 4), M.rock, [0, -0.2, 0.08]); m.boulder.visible = false;
  /* ---------- 매 프레임 ---------- */
  let t = Math.random() * 10; const tmp = new V3(), tmp2 = new V3(); m.heat = 0;
  m.update = (dt, f) => {
    t += dt; const vis = f.root.visible, G = f.G, ign = f.ignited ? 1 : 0;
    m.heat += (Math.max(ign, f.state === 'act' ? 0.45 : 0.12) - m.heat) * Math.min(1, dt * 4);
    const pulse = 0.85 + 0.15 * Math.sin(t * 5) + 0.05 * Math.sin(t * 17);
    M.skin.emissiveIntensity = (0.9 + 0.6 * m.heat) * pulse; M.obs.emissiveIntensity = 1.0 + 1.2 * m.heat;
    M.flame.emissiveIntensity = 1.4 + 0.5 * Math.sin(t * 9) + ign * 0.6; M.edge.opacity = 0.45 + 0.55 * m.heat * pulse; M.edge.color.setHex(ign ? 0xffc060 : 0xff6a20);
    H.children.forEach((c) => { if (c.material === M.flame) c.scale.set(1, 1 + 0.06 * Math.sin(t * 11 + c.id), 1); });
    if (vis) {
      // 수염 · 갈기 불꽃 · 대검 불길
      if (Math.random() < dt * 40) { H.localToWorld(tmp.set((Math.random() - 0.5) * 0.24, 0.12 + Math.random() * 0.25, -0.06 - Math.random() * 0.1)); G.fx.p(tmp, { vel: [(Math.random() - 0.5) * 0.5, 1.2 + Math.random() * 1.5, -0.3], size: 0.12 + Math.random() * 0.12, size1: 0.02, life: 0.45, color: Math.random() < 0.6 ? 0xff7a20 : 0xffc060, alpha: 0.85, drag: 1.4 }); }
      if (Math.random() < dt * 18) { H.localToWorld(tmp.set((Math.random() - 0.5) * 0.12, -0.05 - Math.random() * 0.12, 0.12)); G.fx.p(tmp, { vel: [0, 1 + Math.random(), 0.3], size: 0.09, size1: 0.02, life: 0.35, color: 0xff8a30, alpha: 0.8, drag: 1.4 }); }
      const n = ign ? 3 : m.heat > 0.4 ? 1 : 0;
      for (let i = 0; i < n; i++) if (Math.random() < dt * 30) { W.localToWorld(tmp.set(0, (Math.random() - 0.5) * 0.15, L0 + (L1 - L0) * Math.random())); G.fx.p(tmp, { vel: [(Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.6], size: 0.16 + Math.random() * 0.14 * (1 + ign), size1: 0.03, life: 0.4 + Math.random() * 0.25, color: Math.random() < 0.55 ? 0xff6a10 : 0xffd070, alpha: 0.9, drag: 1.5 }); }
      // 열기 오라: 발밑 아지랑이 불씨
      if (Math.random() < dt * (8 + ign * 10)) { const a = Math.random() * TAU, R = (2.4 + ign * 0.8) * Math.random(); tmp2.set(f.pos.x + Math.cos(a) * R, 0.1, f.pos.z + Math.sin(a) * R); G.fx.p(tmp2, { vel: [0, 0.8 + Math.random(), 0], size: 0.07, size1: 0.01, life: 0.8, color: 0xff6a20, alpha: 0.7, drag: 0.6, flick: 0.6 }); }
    }
    stepRopes(dt, f);
  };
  m.sole = 0.08;
  m.trailPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.5)); W.localToWorld(tt.set(0, 0, L1)); };
  m.weaponPts = (b, tt) => { W.localToWorld(b.set(0, 0, 0.2)); W.localToWorld(tt.set(0, 0, L1)); };
  m.tipPos = (out) => J.handL.localToWorld(out.set(0, -0.2, 0.08));
  return m;
}
