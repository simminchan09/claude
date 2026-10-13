// 오로라 (AURORA · 빛의 잔향) — 3D 모델 (기술·포즈는 aurora.js)
// 무너진 세계의 빛을 모으는 마지막 인도자.
//
// 구성: 이마의 푸른 수정 보석 + 작은 뿔 장식 · 머리 위에 떠 있는 금빛 광륜 · 귀의 은색 장치(푸른 구슬)
//       발목까지 내려오는 은백색 긴 머리 — 굵은 땋은 머리 하나(로프 물리) · 앞으로 내린 옆머리 · 등 뒤로 흐르는 머리칼(로프 물리)
//       짙은 피부 · 금빛 눈 · 남색 초커 + 푸른 보석
//       파랑·흰색 레오타드 (파란 가슴 · 흰 옆판 · 하이컷) + 앞판을 덮은 반투명 아쿠아 젤리 패널 · 왼 허리 은색 원반 장치
//       오른팔: 은색 기계 의수 (어깨 덮개 · 마디 판 · 푸른 발광선 · 기계 손) · 왼팔: 푸른 팔찌 · 남색 손목 밴드
//       가터 사이하이 (흰·파랑 밴드 + 금 테) · 허벅지 앞 파란 기계판 · 은 무릎판 · 파랑·검정 기계판 부츠 + 하이힐
//       허리 뒤에서 떠오르는 무지갯빛 빛의 리본 두 가닥 (로프 물리)
//       무기: 은색 기계 활 (활 · 소총 겸용 — 개머리 · 푸른 빛의 관 · 날 선 앞코 · 두 겹의 칼날 활대 · 빛의 시위)
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { clamp } from '../core.js';
import { Rope, RopeTube } from '../cloth.js';
import { animeHead, faceMapper, faceLayout, paintFace } from '../face.js';
import { surf, loft, loftAt, loftRing, strand, spl, lathe, ang, gauss, smooth, envCube, cached } from '../sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const DIMS = { hipH: 0.88, spineL: 0.18, chestL: 0.245, neckL: 0.07, shW: 0.172, uArm: 0.27, lArm: 0.245, hipW: 0.084, thigh: 0.445, shin: 0.43, headTop: 0.25 };
// 활 치수 (오른손 기준 +Z, m): 개머리 끝 · 손잡이 · 활대 뿌리 · 앞코 · 칼끝 · 활대 끝 높이 · 시위 위치
export const BW = { stock: -0.27, riser: 0.4, front: 0.8, tip: 1.04, limb: 0.8, string: -0.05 };
export const NAVY = 0x16245a, STEEL = 0x6a9ac0, ICE = 0xbaf0ff, CREAM = 0xf4f0e0, BOLT = 0x8ad8ff, GOLDA = 0xffd27a;
const C = (k, fn) => cached('aurora:' + k, fn);

/* =====================================================================
   텍스처
   ===================================================================== */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const SKIN = '#8e5c44', WHITE = '#e9eef4', BLUE = '#2456c0', NAVYC = '#14224e', AQUAC = '#2a8ad8';
// 레오타드 상체: 흰 바탕 · 파란 가슴 · 가슴 위·등은 살 · 앞 가운데 파란 줄(젤리 패널 밑) · 남색 테.  loft uv: u 0 = 뒤 · 0.5 = 앞, v 0 = 아래(캔버스 아래)
function suitTopTex() {
  const W = 1024, H = 512, [c, g] = cv(W, H); g.fillStyle = WHITE; g.fillRect(0, 0, W, H);
  // 옆판 그늘 · 남색 봉제선
  for (const x of [W * 0.29, W * 0.71]) { const gr = g.createLinearGradient(x - 60, 0, x + 60, 0); gr.addColorStop(0, 'rgba(160,175,200,0)'); gr.addColorStop(0.5, 'rgba(150,165,195,0.35)'); gr.addColorStop(1, 'rgba(160,175,200,0)'); g.fillStyle = gr; g.fillRect(x - 60, 0, 120, H); }
  // 앞 가운데: 젤리 패널 밑의 파란 바탕
  { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a7ad0'); gr.addColorStop(1, '#1a4aa8'); g.fillStyle = gr; g.beginPath(); g.moveTo(W * 0.5 - 40, H * 0.5); g.lineTo(W * 0.5 + 40, H * 0.5); g.lineTo(W * 0.5 + 76, H); g.lineTo(W * 0.5 - 76, H); g.closePath(); g.fill(); }
  // 가슴 위 · 트인 등: 살
  g.fillStyle = SKIN; g.fillRect(0, 0, W, H * 0.27);
  for (const x of [0, W]) { g.beginPath(); g.ellipse(x, 0, 190, H * 0.62, 0, 0, TAU); g.fill(); }
  // 파란 가슴 (위는 둥글게 · 남색 테)
  for (const sd of [-1, 1]) {
    const cx = W * 0.5 + sd * 74, cy = H * 0.44, p = new Path2D(); p.ellipse(cx, cy, 82, 102, sd * 0.12, 0, TAU);
    const gr = g.createRadialGradient(cx - sd * 20, cy - 30, 10, cx, cy, 110); gr.addColorStop(0, '#4a86ec'); gr.addColorStop(0.7, BLUE); gr.addColorStop(1, '#18388a');
    g.fillStyle = gr; g.fill(p); g.strokeStyle = NAVYC; g.lineWidth = 7; g.stroke(p);
  }
  g.strokeStyle = NAVYC; g.lineWidth = 5; g.beginPath(); g.moveTo(W * 0.5 - 150, H * 0.62); g.quadraticCurveTo(W * 0.5, H * 0.7, W * 0.5 + 150, H * 0.62); g.stroke();
  return tex(c);
}
// 레오타드 배 · 골반: 흰 바탕 · 앞 파란 줄 · 골반은 하이컷(옆은 살)
function suitLowTex(pelvis) {
  const W = 1024, H = 256, [c, g] = cv(W, H); g.fillStyle = WHITE; g.fillRect(0, 0, W, H);
  for (const x of [W * 0.29, W * 0.71]) { const gr = g.createLinearGradient(x - 60, 0, x + 60, 0); gr.addColorStop(0, 'rgba(160,175,200,0)'); gr.addColorStop(0.5, 'rgba(150,165,195,0.35)'); gr.addColorStop(1, 'rgba(160,175,200,0)'); g.fillStyle = gr; g.fillRect(x - 60, 0, 120, H); }
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a4aa8'); gr.addColorStop(1, '#163a90'); g.fillStyle = gr;
  if (!pelvis) g.fillRect(W * 0.5 - 92, 0, 184, H);
  else {
    g.beginPath(); g.moveTo(W * 0.5 - 96, 0); g.lineTo(W * 0.5 + 96, 0); g.lineTo(W * 0.5 + 40, H); g.lineTo(W * 0.5 - 40, H); g.closePath(); g.fill();
    // 하이컷: 옆구리 아래로 크게 파인 다리 구멍 (살) + 남색 테
    for (const u of [0.25, 0.75]) { const x = u * W, p = new Path2D(); p.moveTo(x - 115, H + 4); const k = u < 0.5 ? 1 : -1; p.quadraticCurveTo(x - 50 * k, H * 0.42, x + 20 * k, H * 0.3); p.quadraticCurveTo(x + 60 * k, H * 0.42, x + 115, H + 4); p.closePath(); g.fillStyle = SKIN; g.fill(p); g.strokeStyle = NAVYC; g.lineWidth = 6; g.stroke(p); }
    g.fillStyle = NAVYC; g.fillRect(0, 0, W, 5);
  }
  return tex(c);
}
// 세로 그라데이션 (캔버스 위 = v 1)
function gradTex(top, bottom, w = 64, h = 256) { const [c, g] = cv(w, h), gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, w, h); return tex(c); }
// 땋은 머리: 엇갈린 결
function braidTex() {
  const W = 128, H = 512, [c, g] = cv(W, H); g.fillStyle = '#c8ccd8'; g.fillRect(0, 0, W, H);
  for (let y = -64, k = 0; y < H + 64; y += 32, k++) { const sd = k % 2 ? 1 : -1, gr = g.createLinearGradient(0, y, 0, y + 36); gr.addColorStop(0, '#9aa2b4'); gr.addColorStop(0.5, '#f6f8fc'); gr.addColorStop(1, '#9aa2b4'); g.fillStyle = gr; g.beginPath(); g.moveTo(sd > 0 ? 0 : W, y); g.lineTo(sd > 0 ? W : 0, y + 30); g.lineTo(sd > 0 ? W : 0, y + 56); g.lineTo(sd > 0 ? 0 : W, y + 26); g.closePath(); g.fill(); }
  const r = rng(5); for (let i = 0; i < 80; i++) { g.strokeStyle = 'rgba(120,130,150,0.35)'; g.lineWidth = 1; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20, y + 12); g.stroke(); }
  return tex(c, [1, 8]);
}
// 은백색 머리 (뿌리 약간 회색 → 끝 밝음 · strand uv v: 뿌리 0 → 끝 1 = 캔버스 위)
function hairTex(cap) {
  const W = 256, H = 512, [c, g] = cv(W, H), r = rng(19), gr = g.createLinearGradient(0, 0, 0, H);
  if (cap) { gr.addColorStop(0, '#d8dce6'); gr.addColorStop(1, '#c4c8d6'); } else { gr.addColorStop(0, '#f8faff'); gr.addColorStop(0.5, '#dfe4ee'); gr.addColorStop(1, '#b8bece'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 380; i++) { const x = r() * W, k = r(); g.strokeStyle = k < 0.4 ? 'rgba(110,118,140,0.32)' : k < 0.8 ? 'rgba(255,255,255,0.5)' : 'rgba(170,220,255,0.35)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (r() - 0.5) * 14, H / 2, x + (r() - 0.5) * 8, 0); g.stroke(); }
  return tex(c);
}
// 기계 판: 은색 바탕 + 패널 선 + 리벳
function plateTex(base, line) {
  const W = 256, H = 256, [c, g] = cv(W, H); g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.strokeStyle = line; g.lineWidth = 3; for (const y of [60, 140, 210]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 6); g.stroke(); }
  for (const x of [70, 190]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 60); g.stroke(); }
  g.fillStyle = line; for (const [x, y] of [[30, 30], [120, 100], [220, 170], [60, 180]]) { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
  return tex(c, [2, 1]);
}

/* ---------- 얼굴: 실제 비율 · 무표정 · 금빛 눈 · 짙은 피부 ---------- */
const HEAD = animeHead({ C: new V3(0, 0.103, 0.006), R: [0.07, 0.1, 0.088], jaw: 0.34 }), { HC, HR, headPt, headN, headAt, dirOf } = HEAD;
function faceTex(open, glow) {
  const W = 2048, H = 1024, [c, g] = cv(W, H), P = (az, el) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H], K = W / TAU, M = faceMapper(headPt, HC, HR, W, H), Y = faceLayout(M, HEAD.L);
  if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  else {
    g.fillStyle = '#946048'; g.fillRect(0, 0, W, H);
    const [fx, fy] = P(0, 0.05), gr = g.createRadialGradient(fx, fy, 30, fx, fy, K * 1.5); gr.addColorStop(0, 'rgba(196,140,108,0.45)'); gr.addColorStop(0.6, 'rgba(170,112,84,0)'); gr.addColorStop(1, 'rgba(70,38,30,0.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const [, cy0] = P(0, -0.62), cg = g.createLinearGradient(0, cy0, 0, H * 0.8); cg.addColorStop(0, 'rgba(80,44,34,0)'); cg.addColorStop(1, 'rgba(70,38,30,0.4)'); g.fillStyle = cg; g.fillRect(0, cy0, W, H);
  }
  paintFace(g, M, { ...Y, tilt: 0.05, lidDrop: 0.06, glow, open, iris: glow ? ['#fff8c8', '#ffd860', '#c89020', '#000'] : ['#fff0a8', '#f0b830', '#a06810', '#4a2a08'], pupil: '#2a1404', lash: '#241a1e', brow: '#d4d8e2', browW: 0.0026, lip: 'rgba(120,62,58,0.7)' });
  const t = new THREE.CanvasTexture(c); if (!glow) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// 무지갯빛 빛의 리본 · 시위 (가산 · 시간에 따라 색이 흐름)
function ribbonMat(op = 0.8) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOp: { value: op } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT; uniform float uOp; varying vec2 vUv;
      void main(){ float h = vUv.y * 2.2 - uT * 0.35 + vUv.x * 0.4; vec3 c = 0.55 + 0.45 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67))); c = mix(c, vec3(0.75, 0.95, 1.0), 0.45);
        float edge = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 3.0); float fade = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        gl_FragColor = vec4(c * uOp * (0.35 + 0.65 * edge) * fade, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

/* =====================================================================
   모델
   ===================================================================== */
const _tex = {};
const T = (k, f) => _tex[k] || (_tex[k] = f());
export function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J, extras = [], env = envCube();
  const phys = ({ env: useEnv, ...o }) => { const mt = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }); if ((o.metalness || 0) > 0.2 || useEnv) { mt.envMap = env; mt.envMapIntensity = o.envMapIntensity ?? 1; } return mt; };
  const glowC = pal.glow ?? BOLT;
  const add0 = (o) => { const mt = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...o }); return mt; };
  const M = {
    skin: phys({ color: 0x8e5c44, emissive: 0x3a2018, emissiveIntensity: 0.35, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0xd8a080) }),
    face: phys({ map: T('face', () => faceTex(false, false)), emissiveMap: T('face', () => faceTex(false, false)), emissive: 0x5e3c30, emissiveIntensity: 0.9, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0xd8a080) }),
    faceO: phys({ map: T('faceO', () => faceTex(true, false)), emissiveMap: T('faceO', () => faceTex(true, false)), emissive: 0x5e3c30, emissiveIntensity: 0.9, roughness: 0.5 }),
    eyeGlow: new THREE.MeshBasicMaterial({ map: T('faceG', () => faceTex(false, true)), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    hair: phys({ map: T('hair', () => hairTex(false)), roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xbfe8ff), sheenRoughness: 0.35, emissive: 0x2a3040, emissiveIntensity: 0.35 }),
    hairCap: phys({ map: T('hairC', () => hairTex(true)), roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xbfe8ff), sheenRoughness: 0.35, emissive: 0x2a3040, emissiveIntensity: 0.3 }),
    braid: phys({ map: T('braid', braidTex), roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xbfe8ff), sheenRoughness: 0.35, emissive: 0x2a3040, emissiveIntensity: 0.3 }),
    suitT: phys({ map: T('suitT', suitTopTex), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color(0xc8dcff) }),
    suitB: phys({ map: T('suitB', () => suitLowTex(false)), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    suitP: phys({ map: T('suitP', () => suitLowTex(true)), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    jelly: phys({ color: 0x38d0ff, emissive: 0x0a90d0, emissiveIntensity: 0.8, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.7, iridescenceIOR: 1.35, transparent: true, opacity: 0.82, env: true, envMapIntensity: 1.4 }),
    bubble: add0({ color: 0xd8fcff, opacity: 0.8 }),
    navy: phys({ color: NAVY, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    blue: phys({ color: 0x2a5ec8, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0.25 }),
    white: phys({ color: 0xeef2f8, roughness: 0.35, clearcoat: 0.6 }),
    stock: phys({ color: 0x0e1018, roughness: 0.42, sheen: 0.8, sheenColor: new THREE.Color(0x5a6a90) }),
    boot: phys({ color: 0x0c0e16, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.3 }),
    steel: phys({ map: T('plate', () => plateTex('#c8d2e0', '#7a8698')), color: 0xffffff, metalness: 1, roughness: 0.22, clearcoat: 0.5 }),
    steelS: phys({ color: 0xd0d8e6, metalness: 1, roughness: 0.2, clearcoat: 0.5 }),
    steelD: phys({ color: 0x6e7a8e, metalness: 1, roughness: 0.32 }),
    plateB: phys({ map: T('plateB', () => plateTex('#2a5ab8', '#142a68')), metalness: 0.5, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
    gold: phys({ color: 0xe0b460, metalness: 1, roughness: 0.26, clearcoat: 0.4 }),
    gem: phys({ color: 0x7ac8ff, emissive: 0x1a70ff, emissiveIntensity: 1.3, roughness: 0.04, clearcoat: 1, flatShading: true, env: true }),
    glow: add0({ color: glowC, opacity: 0.9 }),
    string: add0({ color: 0xe8fbff, opacity: 0.95 }),
    halo: phys({ color: 0xffd27a, emissive: 0xffb030, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.25 }),
    haloG: add0({ color: 0xffd890, opacity: 0.55, side: THREE.DoubleSide }),
    nail: phys({ color: 0x2a4a9a, roughness: 0.2, clearcoat: 1 }),
    ribbon: ribbonMat(0.75),
  };
  const add = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); me.scale.set(...s); me.castShadow = !(mat.blending === THREE.AdditiveBlending); me.receiveShadow = true; parent.add(me); return me; };
  const rim = (parent, key, pts, r, closed, mat = M.gold) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
  const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 56, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);
  const outN = (p) => new V3(p.x, 0, p.z).normalize();
  m.ropes = [];

  /* ---------- 몸통: 레오타드 (골반 하이컷 · 배 · 상체) ---------- */
  const pelP = (v) => ({ y: -0.11 + 0.2 * v, rx: 0.148 - 0.04 * v ** 1.3, rzF: 0.088 - 0.016 * v ** 1.5, rzB: 0.098 - 0.026 * v ** 2, n: 2.2 });
  const pelMod = (p, u, v, c, sn) => { if (sn < 0) { p.y -= 0.045 * (1 - v) ** 2 * (-sn) ** 1.5; p.z -= 0.012 * (1 - v) * (-sn) * gauss(Math.abs(p.x) - 0.06, 0.05); } }; // 엉덩이를 감싸도록 뒤쪽을 아래로
  add(J.hips, C('pelvis', () => loft(pelP, 40, 10, { mod: pelMod })), M.suitP);
  const bX = spl([[0, 0.112], [0.45, 0.088], [1, 0.104]]), bF = spl([[0, 0.076], [0.5, 0.066], [1, 0.074]]);
  const belP = (v) => ({ y: -0.035 + 0.24 * v, rx: bX(v), rzF: bF(v), rzB: 0.076, n: 2.15 });
  add(J.spine, C('belly', () => loft(belP, 40, 12)), M.suitB);
  const chX = spl([[0, 0.102], [0.3, 0.114], [0.55, 0.124], [0.8, 0.118], [1, 0.092]]), chF = spl([[0, 0.074], [0.5, 0.088], [1, 0.068]]), chB = spl([[0, 0.076], [0.6, 0.082], [1, 0.066]]);
  const chP = (v) => ({ y: -0.02 + 0.28 * v, rx: chX(v), rzF: chF(v), rzB: chB(v), n: 2.2 });
  const chMod = (p, u, v, c, sn) => { if (sn > 0) { const ax = Math.abs(p.x); p.z += 0.032 * gauss(ax - 0.056, 0.042) * gauss(p.y - 0.13, 0.05) * Math.pow(sn, 1.5); } };
  add(J.chest, C('chest', () => loft(chP, 56, 22, { mod: chMod })), M.suitT);
  add(J.chest, C('chestTop', () => loft((v) => ({ y: 0.195 + 0.075 * v, rx: 0.12 - 0.072 * v ** 0.8, rzF: 0.072 - 0.028 * v, rzB: 0.067 - 0.026 * v }), 40, 8)), M.skin);
  // 왼 허리: 은색 원반 장치 + 푸른 눈
  { const g = new THREE.Group(); const p = loftAt(pelP, 0.27, 0.62, new V3()); g.position.copy(p).addScaledVector(outN(p), 0.012); g.lookAt(g.position.clone().add(outN(p))); J.hips.add(g);
    add(g, C('hipDisc', () => lathe([[0, 0.012], [0.03, 0.01], [0.042, 0.004], [0.044, -0.006], [0, -0.006]], 28)), M.steelS, [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(g, C('hipRing', () => new THREE.TorusGeometry(0.03, 0.004, 8, 28)), M.navy, [0, 0, 0.012]);
    add(g, C('hipEye', () => new THREE.SphereGeometry(0.016, 16, 12)), M.gem, [0, 0, 0.012], [0, 0, 0], [1, 1, 0.6]); }
  // 젤리 패널: 가슴 사이 → 배 → 골반 앞 (반투명 아쿠아 · 울퉁불퉁한 표면 · 속에 빛 방울)
  const jelly = (joint, key, prof, mod, v0, v1, hw) => {
    const geo = C(key, () => surf((s, t, p) => { const v = v0 + (v1 - v0) * t, w = hw(t), u = 0.5 + (s - 0.5) * 2 * w; loftAt(prof, u, v, p, mod); const n = outN(p), e = Math.sin(s * Math.PI);
      p.addScaledVector(n, 0.004 + e * (0.006 + 0.003 * Math.sin(s * 11 + t * 17) * Math.sin(t * 9 + 1))); }, 14, 14));
    add(joint, geo, M.jelly);
    const r = rng(key.length * 7); for (let i = 0; i < 4; i++) { const p = new V3(); loftAt(prof, 0.5 + (r() - 0.5) * 2 * hw(0.5) * 0.7, v0 + (v1 - v0) * (0.15 + r() * 0.7), p, mod); p.addScaledVector(outN(p), 0.005); add(joint, C('bub', () => new THREE.SphereGeometry(0.004, 8, 6)), M.bubble, p.toArray(), [0, 0, 0], [1 + r(), 1 + r(), 1]); }
  };
  jelly(J.chest, 'jelC', chP, chMod, 0.0, 0.46, (t) => 0.06 - 0.03 * t);
  jelly(J.spine, 'jelS', belP, null, -0.02, 1.02, (t) => 0.075 - 0.012 * t);
  jelly(J.hips, 'jelH', pelP, null, 0.12, 1.0, (t) => 0.025 + 0.062 * t);

  /* ---------- 목: 남색 초커 + 푸른 보석 ---------- */
  add(J.neck, C('neck', () => loft((v) => ({ y: -0.03 + 0.13 * v, rx: 0.033 - 0.008 * smooth(0.2, 0.8, v), rzF: 0.032 - 0.006 * smooth(0.2, 0.8, v), rzB: 0.032 - 0.004 * v }), 20, 6)), M.skin);
  const chokP = (v) => ({ y: 0.012 + 0.03 * v, rx: 0.0345, rzF: 0.034, rzB: 0.034 });
  add(J.neck, C('choker', () => loft(chokP, 32, 3)), M.navy); lRim(J.neck, 'chkR0', chokP, 0, 0.0025, M.steelS); lRim(J.neck, 'chkR1', chokP, 1, 0.0025, M.steelS);
  add(J.neck, C('chkGem', () => { const g = new THREE.OctahedronGeometry(0.012, 0); g.scale(0.8, 1.3, 0.5); return g; }), M.gem, [0, 0.016, 0.038]);
  add(J.neck, C('chkDrop', () => strand([[0, 0.006, 0.037], [0, -0.012, 0.042], [0, -0.03, 0.05]], 0.003, 0.0015, { seg: 8, rad: 5 })), M.steelS);

  /* ---------- 팔: 왼팔 (살 · 푸른 팔찌 · 남색 손목 밴드) / 오른팔 (은색 기계 의수) ---------- */
  const hand = (ha, s, mPalm, mFing, mNail, mBack) => {
    const hg = new THREE.Group(); hg.scale.setScalar(0.84); hg.position.y = -0.006; ha.add(hg); const k0 = mPalm === M.skin ? 'h' : 'mh';
    add(hg, C(k0 + 'palm' + s, () => loft((v) => ({ y: -0.004 - 0.07 * v, rx: 0.02 + 0.003 * Math.sin(v * Math.PI), rz: 0.033 + 0.004 * v, n: 3, cx: s * 0.016 }), 18, 6)), mPalm);
    if (mBack) add(hg, C(k0 + 'back' + s, () => loft((v) => ({ y: 0.005 - 0.055 * v, rx: 0.023, rz: 0.036, n: 3, cx: s * 0.017 }), 18, 4, { a0: s > 0 ? 0.05 : 0.55, a1: s > 0 ? 0.45 : 0.95 })), mBack);
    for (let k = 0; k < 4; k++) {
      const z = 0.024 - k * 0.016, L = k === 3 ? 0.86 : 1, pts = [], curl = s > 0 ? 1.3 + k * 0.1 : 2.6;
      for (let i = 0; i <= 8; i++) { const th = -0.75 - i / 8 * curl * L; pts.push(new V3(s * Math.cos(th) * 0.03 + s * 0.003, -0.05 + Math.sin(th) * 0.03, z)); }
      add(hg, C(`${k0}fing${s}${k}`, () => strand(pts, 0.0074, 0.0058, { seg: 14, rad: 8 })), mFing);
      add(hg, C(`${k0}nail${s}${k}`, () => new THREE.SphereGeometry(0.0056, 8, 6)), mNail, pts[8].toArray(), [0, 0, 0], [1, 1, 0.6]);
      if (mPalm !== M.skin) for (const q of [3, 6]) add(hg, C('knuckle', () => new THREE.SphereGeometry(0.0078, 8, 6)), M.steelD, pts[q].toArray());
    }
    add(hg, C(k0 + 'thumb' + s, () => strand([[0, -0.016, 0.03], [-s * 0.01, -0.036, 0.045], [s * 0.003, -0.058, 0.044], [s * 0.017, -0.07, 0.036]], 0.009, 0.0066, { seg: 12, rad: 8 })), mFing);
  };
  // 왼팔
  { const sh = J.shoulderL, el = J.elbowL, s = 1;
    add(sh, C('delt', () => { const g = new THREE.SphereGeometry(0.05, 20, 14); g.scale(1.0, 0.95, 1.05); return g; }), M.skin, [0.006, -0.012, 0]);
    add(sh, C('uarm', () => loft((v) => ({ y: 0.025 - (DIMS.uArm + 0.025) * v, rx: 0.042 - 0.009 * v + 0.004 * Math.sin(v * Math.PI), rz: 0.04 - 0.008 * v }), 24, 10)), M.skin);
    const abP = (v) => ({ y: -0.09 - 0.024 * v, rx: 0.044, rz: 0.042 });
    add(sh, C('armlet', () => loft(abP, 28, 3)), M.blue); lRim(sh, 'armR0', abP, 0, 0.0025, M.gold); lRim(sh, 'armR1', abP, 1, 0.0025, M.gold);
    add(sh, C('armGem', () => new THREE.OctahedronGeometry(0.009, 0)), M.gem, [0.045, -0.102, 0]);
    add(el, C('farm', () => loft((v) => ({ y: 0.02 - DIMS.lArm * v, rx: 0.035 - 0.011 * v + 0.004 * Math.sin(v * 2.5), rz: 0.033 - 0.01 * v }), 24, 10)), M.skin);
    const wbP = (v) => ({ y: -DIMS.lArm + 0.07 - 0.06 * v, rx: 0.032 + 0.003 * v, rz: 0.03 + 0.003 * v });
    add(el, C('wband', () => loft(wbP, 28, 4)), M.navy); lRim(el, 'wbR0', wbP, 0, 0.0028, M.steelS); lRim(el, 'wbR1', wbP, 1, 0.0028, M.steelS);
    add(el, C('wbGem', () => new THREE.SphereGeometry(0.008, 10, 8)), M.gem, [0, -DIMS.lArm + 0.04, 0.033], [0, 0, 0], [1, 1.3, 0.6]);
    hand(J.handL, s, M.skin, M.skin, M.nail, null); }
  // 오른팔: 기계 의수
  { const sh = J.shoulderR, el = J.elbowR, s = -1;
    // 어깨 덮개: 겹친 은판 두 장 + 푸른 테
    for (let k = 0; k < 2; k++) {
      const pp = (v) => ({ y: 0.065 - k * 0.04 - 0.07 * v, rx: 0.062 + 0.012 * k + 0.018 * v, rz: 0.06 + 0.01 * k + 0.016 * v });
      add(sh, C('pld' + k, () => loft(pp, 24, 6, { a0: 0.52, a1: 0.98 })), M.steelS, [-0.01, 0, 0]);
      rim(sh, 'pldR' + k, loftRing(pp, 1, { a0: 0.52, a1: 0.98, n: 24 }).map((q) => q.add(new V3(-0.01, 0, 0))), 0.0035, false, M.blue);
    }
    add(sh, C('shBall', () => new THREE.SphereGeometry(0.046, 20, 14)), M.steelD, [0, -0.01, 0]);
    const muP = (v) => ({ y: -0.02 - (DIMS.uArm - 0.03) * v, rx: 0.044 - 0.006 * v, rz: 0.042 - 0.006 * v, n: 2.4 });
    add(sh, C('marm', () => loft(muP, 24, 10)), M.steel);
    for (const v of [0.3, 0.62]) lRim(sh, 'muR' + v, muP, v, 0.003, M.steelD);
    { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(muP, 0.75, 0.08 + 0.84 * i / 10, new V3()).multiplyScalar(1.05)); rim(sh, 'muGlow', pts, 0.0025, false, M.glow); }
    add(el, C('elBall', () => new THREE.SphereGeometry(0.038, 18, 12)), M.navy);
    add(el, C('elCap', () => loft((v) => ({ y: 0.03 - 0.06 * v, rx: 0.043, rz: 0.043 }), 16, 4, { a0: 0.9, a1: 1.1 })), M.steelS);
    const mfP = (v) => ({ y: -0.02 - (DIMS.lArm - 0.03) * v, rx: 0.042 - 0.012 * v + 0.004 * Math.sin(v * 2.5), rz: 0.04 - 0.011 * v, n: 2.3 });
    add(el, C('mfarm', () => loft(mfP, 24, 10)), M.steel);
    lRim(el, 'mfR0', mfP, 0.04, 0.0035, M.blue); lRim(el, 'mfR1', mfP, 0.96, 0.0035, M.blue);
    { const pts = []; for (let i = 0; i <= 10; i++) pts.push(loftAt(mfP, 0.75, 0.1 + 0.8 * i / 10, new V3()).multiplyScalar(1.06)); rim(el, 'mfGlow', pts, 0.003, false, M.glow);
      const p2 = []; for (let i = 0; i <= 10; i++) p2.push(loftAt(mfP, 0.5, 0.15 + 0.6 * i / 10, new V3()).multiplyScalar(1.05)); rim(el, 'mfGlow2', p2, 0.002, false, M.glow); }
    add(el, C('wrist', () => new THREE.CylinderGeometry(0.03, 0.03, 0.02, 18)), M.steelD, [0, -DIMS.lArm + 0.005, 0]);
    hand(J.handR, s, M.steelS, M.steelD, M.steelS, M.steelS); }

  /* ---------- 다리: 가터 사이하이 · 허벅지 앞 파란 기계판 · 은 무릎판 · 기계판 부츠 · 하이힐 ---------- */
  for (const [hp, kn, ft, s] of [[J.hipL, J.kneeL, J.footL, 1], [J.hipR, J.kneeR, J.footR, -1]]) {
    const L = DIMS.thigh + 0.03, thX = spl([[0, 0.07], [0.12, 0.077], [0.4, 0.074], [0.85, 0.055], [1, 0.053]]), thF = spl([[0, 0.07], [0.15, 0.072], [0.5, 0.066], [1, 0.053]]), thB = spl([[0, 0.074], [0.2, 0.08], [0.4, 0.072], [1, 0.048]]);
    const thP = (v) => ({ cx: -s * 0.012 * (1 - smooth(0, 0.3, v)), y: 0.0 - (L - 0.03) * v, rx: thX(v), rzF: thF(v), rzB: thB(v) });
    add(hp, C('thigh' + s, () => loft(thP, 28, 12)), M.skin);
    const stP = (v) => { const q = thP(0.5 + 0.5 * v); return { ...q, rx: q.rx + 0.002, rzF: q.rzF + 0.002, rzB: q.rzB + 0.002 }; };
    add(hp, C('stockT', () => loft(stP, 28, 10)), M.stock);
    // 밴드: 흰 레이스 띠 + 파란 줄 + 금 테
    const bdP = (v) => { const q = thP(0.47 + 0.07 * v); return { ...q, rx: q.rx + 0.005, rzF: q.rzF + 0.005, rzB: q.rzB + 0.005 }; };
    add(hp, C('band', () => loft(bdP, 32, 3)), M.white); lRim(hp, 'bdR0', bdP, 0, 0.003, M.gold); lRim(hp, 'bdR1', bdP, 1, 0.0035, M.blue);
    // 가터 끈: 레오타드 아래 → 밴드 (앞 · 옆)
    for (const [a, key] of [[0.5, 'gF' + s], [s > 0 ? 0.3 : 0.7, 'gS' + s]]) {
      const top = loftAt(thP, a, 0.02, new V3()), bot = loftAt(bdP, a, 1, new V3()); top.addScaledVector(outN(top), 0.004); bot.addScaledVector(outN(bot), 0.003);
      const mid = top.clone().lerp(bot, 0.5).addScaledVector(outN(top), 0.006);
      add(hp, C('gart' + key, () => strand([top, mid, bot], 0.005, 0.005, { seg: 10, rad: 5, flat: 0.3, ref: outN(mid).toArray() })), M.navy);
      add(hp, C('clip', () => new THREE.BoxGeometry(0.012, 0.016, 0.004)), M.steelS, bot.clone().addScaledVector(outN(bot), 0.003).toArray(), [0, Math.atan2(bot.x, bot.z), 0]);
    }
    // 허벅지 앞 파란 기계판 (금 테)
    const tpP = (v) => { const q = stP(0.15 + 0.55 * v); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.008, rzB: q.rzB + 0.006 }; };
    add(hp, C('tPlate', () => loft(tpP, 12, 8, { a0: 0.42, a1: 0.58 })), M.plateB);
    rim(hp, 'tpR', [...loftRing(tpP, 0, { a0: 0.42, a1: 0.58, n: 10 }), ...loftRing(tpP, 1, { a0: 0.42, a1: 0.58, n: 10 }).reverse()], 0.0025, true, M.gold);
    { const pts = []; for (let i = 0; i <= 10; i++) { const q = loftAt(tpP, 0.5 + s * 0.035, 0.05 + 0.9 * i / 10, new V3()); q.addScaledVector(outN(q), 0.002); pts.push(q); } rim(hp, 'tpLine' + s, pts, 0.0018, false, M.glow); }
    // 정강이: 검은 기계 부츠 (무릎 아래까지) · 앞 파란 판 · 은 무릎판 · 옆 금선
    const cX = spl([[0, 0.056], [0.3, 0.06], [0.75, 0.041], [1, 0.036]]), cF = spl([[0, 0.058], [0.5, 0.048], [1, 0.038]]), cB = spl([[0, 0.057], [0.3, 0.072], [0.7, 0.046], [1, 0.039]]);
    const gP = (v) => ({ y: 0.04 - (DIMS.shin + 0.0) * v, rx: cX(v), rzF: cF(v), rzB: cB(v), n: 2.1 });
    add(kn, C('shin', () => loft(gP, 28, 14)), M.boot);
    lRim(kn, 'shTop', gP, 0, 0.004, M.steelS);
    const spP = (v) => { const q = gP(0.1 + 0.8 * v); return { ...q, rx: q.rx + 0.006, rzF: q.rzF + 0.008, rzB: q.rzB + 0.004 }; };
    add(kn, C('shPlate', () => loft(spP, 12, 10, { a0: 0.4, a1: 0.6 })), M.plateB);
    rim(kn, 'spR', [...loftRing(spP, 0, { a0: 0.4, a1: 0.6, n: 10 }), ...loftRing(spP, 1, { a0: 0.4, a1: 0.6, n: 10 }).reverse()], 0.0025, true, M.gold);
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(gP, s > 0 ? 0.27 : 0.73, 0.08 + 0.85 * i / 12, new V3()).multiplyScalar(1.04)); rim(kn, 'shLine' + s, pts, 0.0022, false, M.gold); }
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(loftAt(gP, s > 0 ? 0.22 : 0.78, 0.15 + 0.7 * i / 12, new V3()).multiplyScalar(1.045)); rim(kn, 'shGlow' + s, pts, 0.0018, false, M.glow); }
    add(kn, C('kneeCap', () => surf((u, v, p) => { const w = 0.048 * (1 - 0.6 * v ** 1.4), a = (u - 0.5) * 2; p.set(a * w, -0.05 + 0.13 * v, 0.06 + 0.012 * Math.sin(v * Math.PI) - 0.025 * a * a); }, 8, 10)), M.steelS);
    add(kn, C('kneeGem', () => new THREE.OctahedronGeometry(0.009, 0)), M.gem, [0, 0.01, 0.073]);
    // 부츠 발: 굽 높은 발 (뒤꿈치 높고 앞꿈치 낮음) · 은 앞코 · 가는 하이힐 · 발목 링
    const fw = spl([[0, 0.0], [0.06, 0.027], [0.25, 0.034], [0.6, 0.037], [0.85, 0.029], [1, 0.006]]), fh = spl([[0, 0.028], [0.08, 0.056], [0.3, 0.06], [0.6, 0.036], [0.85, 0.024], [1, 0.01]]);
    const fb = (v) => -0.078 + 0.056 * (1 - smooth(0.3, 0.72, v));
    const foot = (u, v, p) => { const [c, sn] = ang(u), w = fw(v), h = fh(v), e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb(v) + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.058 + 0.235 * v); };
    add(ft, C('foot', () => surf(foot, 28, 20, { closedU: true })), M.boot);
    add(ft, C('toeCap', () => surf((u, v, p) => { const [c, sn] = ang(0.5 + (u - 0.5) * 0.9), vv = 0.72 + 0.28 * v, w = fw(vv) + 0.002, h = fh(vv) + 0.002, e = 0.75; p.set(Math.sign(c) * Math.abs(c) ** e * w, fb(vv) + h / 2 + Math.sign(sn) * Math.abs(sn) ** e * h / 2, -0.058 + 0.235 * vv); }, 10, 8)), M.steelS);
    add(ft, C('instep', () => surf((u, v, p) => { const a = (u - 0.5) * 2, vv = 0.3 + 0.4 * v, q = new V3(); foot(0.5 + a * 0.18, vv, q); p.copy(q); p.y += 0.004; }, 6, 8)), M.plateB);
    add(ft, C('heel', () => strand([[0, -0.03, -0.04], [0, -0.06, -0.044], [0, -0.087, -0.042]], 0.009, 0.003, { seg: 8, rad: 8 })), M.steelS);
    add(ft, C('soleT', () => surf((u, v, p) => { const vv = 0.62 + 0.38 * v, [c] = ang(u), w = fw(vv) * 0.95; p.set(c * w, -0.083 + 0.004 * Math.sin(u * TAU), -0.058 + 0.235 * vv); }, 12, 6, { closedU: true })), M.steelD);
    add(kn, C('ankle', () => loft((v) => ({ y: -DIMS.shin + 0.05 - 0.07 * v, rx: 0.037 + 0.006 * v, rz: 0.039 + 0.008 * v }), 16, 4)), M.boot);
    add(kn, C('ankR', () => new THREE.TorusGeometry(0.041, 0.004, 8, 24)), M.steelS, [0, -DIMS.shin + 0.03, 0], [Math.PI / 2, 0, 0]);
    add(kn, C('ankGem', () => new THREE.SphereGeometry(0.007, 10, 8)), M.gem, [s * 0.042, -DIMS.shin + 0.03, 0]);
  }

  /* ---------- 얼굴 · 머리 (은백색) · 이마 보석 · 뿔 장식 · 귀 장치 · 광륜 ---------- */
  const H = J.head;
  const headGeo = C('head', () => surf((u, v, p) => { const az = (u - 0.5) * TAU, el = -Math.PI / 2 + v * Math.PI, d = dirOf(az, el); headPt(d.x, d.y, d.z, p); }, 96, 72, { closedU: true, poles: [0, 72] }));
  m.headMesh = add(H, headGeo, M.face); H.scale.setScalar(1.1);
  m.eyeGlow = add(H, headGeo, M.eyeGlow, [0, 0, 0], [0, 0, 0], [1.002, 1.002, 1.002]); m.eyeGlow.renderOrder = 5;
  for (const s of [-1, 1]) add(H, C('ear' + s, () => strand([[s * 0.067, 0.1, -0.006], [s * 0.079, 0.104, -0.014], [s * 0.083, 0.09, -0.018]], 0.013, 0.006, { seg: 8, rad: 8, flat: 0.4, ref: [s, 0, 0] })), M.skin);
  const r = rng(11), clump = (key, pts, r0, r1, flat, ref, mat = M.hair) => add(H, C(key, () => strand(pts, r0, r1, { seg: 16, rad: 8, flat, ref })), mat);
  {
    const line = (az) => { const w = Math.cos(az); return w > 0 ? 0.13 + 0.38 * w * w : 0.13 - 0.9 * w * w; };
    add(H, C('hairCap', () => surf((u, v, p) => { const az = (u - 0.5) * TAU + Math.PI, e0 = line(az), el = e0 + (Math.PI / 2 - e0) * v; headAt(az, el, 0.006 + 0.012 * smooth(0, 0.4, v) + 0.006 * Math.max(0, -Math.cos(az)), p); }, 80, 22, { closedU: true, poles: [22], uvU: 8 })), M.hairCap);
    // 앞머리: 가운데 가르마 (이마 보석이 보이게) · 바깥으로 갈수록 길게 뺨까지
    for (const s of [-1, 1]) for (let j = 0; j < 8; j++) {
      const a = s * (0.13 + j * 0.13 + (r() - 0.5) * 0.03), side = Math.abs(a), tipEl = 0.26 - 0.06 * r() - 0.5 * smooth(0.35, 1.05, side), sweep = s * (0.1 + 0.05 * j / 7);
      const pts = [headAt(s * 0.04 + a * 0.25, 1.2, 0.02), headAt(a * 0.7 + sweep * 0.2, 0.85, 0.03), headAt(a * 0.92 + sweep * 0.6, 0.52, 0.03), headAt(a + sweep, (0.52 + tipEl) / 2, 0.024), headAt(a + sweep * 1.25, tipEl, 0.012)];
      const d = dirOf(a, 0.5); clump(`bang${s}${j}`, pts, (j % 2 ? 0.026 : 0.034) + r() * 0.008, 0.0014, 0.22, [d.x, d.y, d.z]);
    }
    // 얼굴 옆 머리 (귀를 덮고 턱 아래까지)
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const az = s * (1.12 + k * 0.17), pts = [headAt(az * 0.92, 0.75, 0.018), headAt(az, 0.15, 0.02), headAt(az * 1.02, -0.5 - k * 0.08, 0.02), headAt(az * 1.05, -0.95 - k * 0.06, 0.03)];
      const d = dirOf(az, 0); clump(`side${s}${k}`, pts, 0.034, 0.008, 0.24, [d.x, 0, d.z]);
    }
    // 뒷머리 덩어리 (땋기 시작하는 목덜미로 모임)
    for (let k = 0; k < 16; k++) {
      const az = Math.PI + (k - 7.5) * 0.22, pts = [headAt(az, 0.8, 0.016), headAt(az + (r() - 0.5) * 0.12, 0.05, 0.022), headAt(Math.PI + (az - Math.PI) * 0.55, -0.6, 0.02)];
      const d = dirOf(az, 0); clump('back' + k, pts, 0.042, 0.022, 0.26, [d.x, 0, d.z]);
    }
  }
  // 긴 머리칼: 앞으로 내린 옆머리 2 · 등 뒤로 흐르는 4 (로프 물리 · 납작한 물결 리본)
  const locks = [[1.22, -0.25, 9, true], [-1.22, -0.25, 9, true], [Math.PI + 0.55, -0.3, 11, false], [Math.PI - 0.55, -0.3, 11, false], [Math.PI + 1.0, -0.2, 10, false], [Math.PI - 1.0, -0.2, 10, false]];
  locks.forEach(([az, el, n, front], i) => {
    const rope = new Rope(n, 0.066, { damp: 0.978, stiff: 0.05 }), ph = i * 1.9, wide = front ? 0.03 : 0.042;
    const view = new RopeTube(rope, M.hair, { sub: 3, rad: 12, uvV: 2, flat: 0.28, side: new V3(1, 0, 0),
      prof: (v) => wide * (v < 0.05 ? 0.8 : 1 - 0.45 * v) * (v > 0.88 ? 1 - (v - 0.88) * 6 : 1), wave: (v) => 0.016 * Math.sin(v * TAU * 1.3 + ph) * smooth(0.1, 0.5, v) });
    const local = headAt(az, el, 0.02), sideL = new V3(Math.cos(az), 0, -Math.sin(az)), rest = front ? new V3(Math.sin(az) * 0.3, -1, 0.4).normalize() : new V3(Math.sin(az) * 0.4, -0.75, -0.6).normalize();
    m.ropes.push({ rope, view, joint: H, local, rest, sideL, caps: 'body' });
  });
  // 굵은 땋은 머리: 목덜미 → 발목 (마디마다 불룩한 엇갈림)
  { const rope = new Rope(17, 0.08, { damp: 0.982, stiff: 0.07 }), view = new RopeTube(rope, M.braid, { sub: 3, rad: 12, uvV: 9,
      prof: (v) => (0.034 + 0.012 * smooth(0, 0.18, v) - 0.016 * smooth(0.55, 0.93, v)) * (1 + 0.14 * Math.abs(Math.sin(v * Math.PI * 22))) * (v > 0.97 ? 0.6 : 1) });
    m.ropes.push({ rope, view, joint: H, local: headAt(Math.PI, -0.62, 0.0), rest: new V3(0, -1, -0.35).normalize(), caps: 'body', braid: true }); }
  // 빛의 리본: 허리 뒤 양옆에서 떠오름
  for (const s of [-1, 1]) {
    const rope = new Rope(12, 0.1, { damp: 0.96, stiff: 0.04 }), view = new RopeTube(rope, M.ribbon, { sub: 2, rad: 4, flat: 0.06, side: new V3(0, 1, 0), prof: (v) => 0.045 * (1 - 0.5 * v) });
    view.mesh.castShadow = false; view.mesh.renderOrder = 8;
    m.ropes.push({ rope, view, joint: J.hips, local: new V3(s * 0.12, 0.04, -0.09), rest: new V3(s * 0.7, 0.2, -0.7).normalize(), caps: 'legs', ribbon: s });
  }
  // 땋은 머리 끝: 은 고리 + 머리 술
  m.endTassel = (() => { const g = new THREE.Group(); add(g, C('btRing', () => new THREE.CylinderGeometry(0.026, 0.026, 0.03, 18)), M.steelS); add(g, C('btGem', () => new THREE.SphereGeometry(0.008, 10, 8)), M.gem, [0, 0, 0.026]);
    add(g, C('btTuft', () => lathe([[0.018, 0.0], [0.026, -0.04], [0.022, -0.1], [0.008, -0.15], [0, -0.16]], 14)), M.hair, [0, -0.012, 0]); return g; })();
  m.attachScene = (scene) => {
    if (m._attached) return; m._attached = true;
    for (const rp of m.ropes) { scene.add(rp.view.mesh); extras.push(rp.view.mesh); }
    scene.add(m.endTassel); extras.push(m.endTassel);
  };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; m._attached = false; };
  m.resetCloth = () => { for (const rp of m.ropes) rp.rope.ok = false; };

  // 이마: 푸른 수정 보석 + 은 틀 + 작은 뿔 장식 (관자놀이 위로)
  { const p = headAt(0, 0.43, 0.006), g = new THREE.Group(); g.position.copy(p); g.lookAt(p.clone().add(headN(p))); H.add(g);
    add(g, C('fGem', () => { const geo = new THREE.OctahedronGeometry(0.012, 0); geo.scale(0.75, 1.35, 0.55); return geo; }), M.gem, [0, 0, 0.004]);
    add(g, C('fFrame', () => strand([[0, 0.022, 0], [0.012, 0.004, 0.001], [0, -0.019, 0.002], [-0.012, 0.004, 0.001]], 0.0022, 0.0022, { closed: true, seg: 24, rad: 5 })), M.steelS);
    for (const s of [-1, 1]) add(g, C('fWing' + s, () => strand([[s * 0.011, 0.006, 0], [s * 0.024, 0.016, -0.004], [s * 0.032, 0.034, -0.012]], 0.003, 0.001, { seg: 10, rad: 5, flat: 0.5, ref: [0, 0, 1] })), M.steelS); }
  for (const s of [-1, 1]) {
    const b = headAt(s * 0.62, 0.86, 0.026), n = headN(b), up = new V3(0, 1, 0), back = new V3(0, 0, -1);
    const pts = [b, b.clone().addScaledVector(n, 0.012).addScaledVector(up, 0.02), b.clone().addScaledVector(n, 0.01).addScaledVector(up, 0.045).addScaledVector(back, 0.02).add(new V3(s * 0.006, 0, 0)), b.clone().addScaledVector(up, 0.065).addScaledVector(back, 0.05).add(new V3(s * 0.01, 0, 0))];
    add(H, C('horn' + s, () => strand(pts, 0.012, 0.0015, { seg: 14, rad: 7, flat: 0.45, ref: [s, 0, 0] })), M.navy);
    add(H, C('hornE' + s, () => strand(pts.map((q) => q.clone().add(new V3(0, 0, 0.004))), 0.0025, 0.0008, { seg: 14, rad: 5 })), M.glow);
    add(H, C('hornB' + s, () => new THREE.SphereGeometry(0.009, 10, 8)), M.steelS, b.toArray());
  }
  // 귀 장치: 은 원반 + 푸른 구슬 (옆머리 위)
  for (const s of [-1, 1]) { const p = headAt(s * 1.5, 0.02, 0.034), g = new THREE.Group(); g.position.copy(p); g.lookAt(p.clone().add(new V3(s, 0, 0.1))); H.add(g);
    add(g, C('earDisc', () => lathe([[0, 0.008], [0.016, 0.007], [0.022, 0.002], [0.022, -0.004], [0, -0.004]], 22)), M.steelS, [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(g, C('earOrb', () => new THREE.SphereGeometry(0.01, 14, 10)), M.gem, [0, 0, 0.008]);
    add(g, C('earFin', () => strand([[0, 0.01, 0], [0, 0.03, -0.012], [0, 0.05, -0.03]], 0.006, 0.001, { seg: 8, rad: 5, flat: 0.4, ref: [1, 0, 0] })), M.steelS); }
  // 광륜: 머리 위에 떠 있는 금빛 고리 (안쪽 띠 · 바깥 조각 호 · 빛살)
  const halo = new THREE.Group(); halo.rotation.order = 'YXZ'; m.root.add(halo); const haloS = new THREE.Group(); halo.add(haloS); const HS = 0.9; // 몸 기준으로 머리 위에 띄움 (고개를 젖혀도 하늘을 향함) m.halo = halo;
  { add(haloS, C('haloMain', () => { const g = new THREE.TorusGeometry(0.15, 0.008, 8, 72); g.scale(1, 1, 0.5); return g; }), M.halo, [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(haloS, C('haloIn', () => new THREE.TorusGeometry(0.105, 0.0035, 6, 64)), M.halo, [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) { const o = add(haloS, C('haloArc', () => { const g = new THREE.TorusGeometry(0.19, 0.006, 6, 30, 1.0); g.scale(1, 1, 0.4); return g; }), M.halo); o.rotation.set(Math.PI / 2, 0, i * TAU / 4 + 0.3); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, o = add(haloS, C('haloRay', () => { const g = new THREE.ConeGeometry(0.006, i % 2 ? 0.03 : 0.05, 4); g.rotateZ(-Math.PI / 2); g.translate(0.02, 0, 0); return g; }), M.halo); o.position.set(Math.cos(a) * 0.21, 0, Math.sin(a) * 0.21); o.rotation.y = -a; }
    m.haloGlow = add(haloS, C('haloGlow', () => new THREE.RingGeometry(0.09, 0.24, 64)), M.haloG, [0, 0, 0], [Math.PI / 2, 0, 0]); m.haloGlow.renderOrder = 9; }

  /* ---------- 무기: 은색 기계 활 (활 · 소총 겸용) ---------- */
  const bow = new THREE.Group(); J.weapon.add(bow); m.bow = bow; J.weapon.scale.setScalar(0.86);
  {
    const X = [Math.PI / 2, 0, 0];
    // 손잡이 (남색 감개) · 개머리 (은 · 푸른 빛의 관)
    add(bow, C('bw:grip', () => { const g = loft((v) => ({ y: -0.075 + 0.16 * v, rx: 0.016, rz: 0.02, n: 2.4 }), 16, 6); g.rotateX(Math.PI / 2); return g; }), M.navy);
    for (let i = 0; i < 5; i++) add(bow, C('bw:wrap', () => new THREE.TorusGeometry(0.019, 0.0025, 6, 16)), M.steelD, [0, 0, -0.06 + i * 0.032], [0, 0, 0], [0.85, 1.05, 1]);
    add(bow, C('bw:stock', () => { const g = loft((v) => ({ y: BW.stock + (-0.075 - BW.stock) * v, rx: 0.016 + 0.004 * v, rzF: 0.026 + 0.03 * (1 - v) ** 1.5, rzB: 0.02, n: 2.6 }), 18, 10); g.rotateX(Math.PI / 2); return g; }), M.steel);
    add(bow, C('bw:vial', () => new THREE.CylinderGeometry(0.008, 0.008, 0.12, 12)), M.glow, [0, -0.034, -0.17], X);
    add(bow, C('bw:vialC', () => new THREE.CylinderGeometry(0.011, 0.011, 0.13, 12, 1, true)), M.jelly, [0, -0.034, -0.17], X);
    // 몸통 (각진 은판 · 위쪽 유리관 · 옆 홈) · 총열 · 날 선 앞코
    const rcP = (v) => ({ y: 0.085 + (BW.riser + 0.06 - 0.085) * v, rx: 0.024 - 0.004 * v, rzF: 0.036 - 0.006 * v, rzB: 0.03 - 0.006 * v, n: 2.8 });
    add(bow, C('bw:recv', () => { const g = loft(rcP, 20, 12); g.rotateX(Math.PI / 2); return g; }), M.steel);
    add(bow, C('bw:tube', () => new THREE.CylinderGeometry(0.011, 0.011, 0.26, 14)), M.glow, [0, 0.042, 0.25], X);
    add(bow, C('bw:tubeC', () => new THREE.CylinderGeometry(0.015, 0.015, 0.28, 14, 1, true)), M.jelly, [0, 0.042, 0.25], X);
    for (const z of [0.11, 0.39]) add(bow, C('bw:tubeR', () => new THREE.CylinderGeometry(0.019, 0.019, 0.016, 14)), M.steelD, [0, 0.042, z], X);
    for (const s of [-1, 1]) add(bow, C('bw:slot' + s, () => strand([[s * 0.022, 0, 0.12], [s * 0.021, 0.004, 0.3], [s * 0.019, 0, 0.44]], 0.0028, 0.0028, { seg: 10, rad: 5 })), M.glow);
    add(bow, C('bw:trig', () => new THREE.TorusGeometry(0.02, 0.003, 6, 18, Math.PI * 1.2)), M.steelD, [0, -0.04, 0.1], [0, Math.PI / 2, 0.4]);
    add(bow, C('bw:barrel', () => { const g = loft((v) => ({ y: BW.riser + 0.05 + (BW.front - BW.riser - 0.05) * v, rx: 0.014, rzF: 0.02, rzB: 0.016, n: 2.5 }), 14, 6); g.rotateX(Math.PI / 2); return g; }), M.steelS);
    add(bow, C('bw:muzzle', () => new THREE.CylinderGeometry(0.02, 0.017, 0.05, 14)), M.steelD, [0, 0, BW.front - 0.02], X);
    add(bow, C('bw:blade', () => surf((u, v, p) => { const z = BW.front + (BW.tip - BW.front) * v, w = 0.03 * (1 - v ** 1.6) + 0.002, t = u * TAU; p.set(Math.sin(t) * 0.0035 * (1 - v * 0.7), Math.cos(t) * w + 0.004 * v, z); }, 10, 16, { closedU: true })), M.steelS);
    add(bow, C('bw:bladeE', () => strand([[0, 0.031, BW.front], [0, 0.02, BW.front + 0.12], [0, 0.006, BW.tip]], 0.0016, 0.0006, { seg: 16, rad: 5 })), M.string);
    // 활대: 두 겹의 칼날 판 (뒤로 휘어 넘어감) · 안쪽 푸른 발광선 · 끝 구슬
    const limb = (s, k) => { const sc = k ? 0.86 : 1, pts = [[0, s * 0.045, BW.riser + 0.02], [0, s * 0.2 * sc, BW.riser + 0.12], [0, s * 0.42 * sc, BW.riser + 0.12 - k * 0.02], [0, s * 0.62 * sc, BW.riser - 0.02 - k * 0.04], [0, s * 0.74 * sc, BW.riser - 0.22 - k * 0.04], [0, s * BW.limb * sc, BW.string - k * 0.02]]; return pts; };
    m.limbPts = [];
    for (const s of [-1, 1]) {
      const p0 = limb(s, 0), p1 = limb(s, 1);
      add(bow, C('bw:limb' + s, () => strand(p0, 0.036, 0.009, { seg: 40, rad: 10, flat: 0.22, ref: [1, 0, 0] })), M.steelS);
      add(bow, C('bw:limb2' + s, () => strand(p1.map(([x, y, z]) => [x + 0.008, y, z - 0.03]), 0.02, 0.006, { seg: 32, rad: 8, flat: 0.3, ref: [1, 0, 0] })), M.steelD);
      add(bow, C('bw:limbG' + s, () => strand(p0.map(([x, y, z]) => [x, y * 0.97, z - 0.012]), 0.0035, 0.0015, { seg: 32, rad: 5 })), M.glow);
      add(bow, C('bw:tipOrb', () => new THREE.SphereGeometry(0.014, 12, 10)), M.gem, p0[5]);
      add(bow, C('bw:tipCap' + s, () => strand([p0[4], [0, s * (BW.limb + 0.04), BW.string - 0.07], [0, s * (BW.limb + 0.06), BW.string - 0.14]], 0.01, 0.001, { seg: 12, rad: 6, flat: 0.3, ref: [1, 0, 0] })), M.steelS);
      m.limbPts.push(...p0.map((q) => new V3(...q)));
    }
    add(bow, C('bw:riser', () => { const g = new THREE.SphereGeometry(0.03, 16, 12); g.scale(0.9, 1.9, 1.3); return g; }), M.steelD, [0, 0, BW.riser + 0.02]);
    add(bow, C('bw:riserGem', () => new THREE.OctahedronGeometry(0.013, 0)), M.gem, [0.027, 0, BW.riser + 0.02]);
    add(bow, C('bw:riserGem', () => new THREE.OctahedronGeometry(0.013, 0)), M.gem, [-0.027, 0, BW.riser + 0.02]);
  }
  // 빛의 시위 (활대 끝 → 깍지 → 활대 끝) · 당기면 빛의 화살이 걸린다
  const unitCyl = C('bw:str', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); g.translate(0, 0.5, 0); return g; });
  const strA = add(bow, unitCyl, M.string), strB = add(bow, unitCyl, M.string);
  const nArrow = add(bow, C('bw:arrow', () => { const g = new THREE.CylinderGeometry(0.006, 0.01, 1, 8); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2); return g; }), M.glow);
  const nHead = add(bow, C('bw:arrowH', () => { const g = new THREE.OctahedronGeometry(0.03, 0); g.scale(0.6, 0.6, 1.8); return g; }), M.string);
  const TU = new V3(0, BW.limb, BW.string), TD = new V3(0, -BW.limb, BW.string), nock = new V3(), _d = new V3(), Yv = new V3(0, 1, 0);
  const placeStr = (mesh, a, b) => { _d.subVectors(b, a); const L = _d.length(); mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(Yv, _d.normalize()); mesh.scale.set(0.0022, L, 0.0022); };

  /* ---------- 매 프레임 ---------- */
  const tmp = new V3(), tmp2 = new V3(), hq = new THREE.Quaternion(), rq = new THREE.Quaternion();
  m.glow = 0; m.drawK = 0; m.haloK = 0;
  m.update = (dt, f) => {
    const vis = f.root.visible, G = f.G, time = G.time;
    J.chest.updateMatrixWorld(true);
    // 로프: 머리칼 · 땋은 머리 · 빛의 리본
    const sc = f.scale, h0 = f.hurt[0], hc = H.localToWorld(tmp2.copy(HC)), legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * sc }));
    const capsBody = [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.3), r: h0.r * 0.66 + 0.04 * sc }, { a: hc, b: hc.clone(), r: 0.108 * sc }, ...legs];
    const wind = new V3(-f.vel.x * 0.6, 0, -f.vel.z * 0.6), rwind = new V3(-f.vel.x * 1.2 + Math.sin(time * 1.7) * 3, 8.6 + Math.sin(time * 2.3) * 1.5, -f.vel.z * 1.2 + Math.cos(time * 1.3) * 3);
    H.getWorldQuaternion(hq); m.root.getWorldQuaternion(rq);
    for (const rp of m.ropes) {
      rp.joint.updateMatrixWorld(true); rp.joint.localToWorld(tmp.copy(rp.local)); if (rp.sideL) rp.view.side.copy(rp.sideL).applyQuaternion(hq);
      rp.rope.step(dt, tmp, rp.caps === 'legs' ? legs : capsBody, f.pos.y + 0.01, rp.rest.clone().applyQuaternion(rq), rp.ribbon ? rwind : wind); rp.view.update(); rp.view.mesh.visible = vis;
      if (rp.braid) { const p = rp.rope.p, n = p.length, t = m.endTassel; t.position.copy(p[n - 1]); _d.subVectors(p[n - 1], p[n - 2]).normalize(); t.quaternion.setFromUnitVectors(Yv, _d.negate()); t.visible = vis; }
    }
    M.ribbon.uniforms.uT.value = time; M.ribbon.uniforms.uOp.value = 0.55 + 0.4 * m.glow;
    // 얼굴: 무표정 · 기합 때만 입을 살짝 벌림 / 금빛 눈 · 빛 (기술 중 · 잔광이 가득 → 더 밝게)
    m.headMesh.material = f.state === 'act' && f.act && f.act.shout ? M.faceO : M.face;
    const want = Math.max(f.gemK || 0, (f.glowC || 0) >= 3 ? 0.75 : 0.25); m.glow += (want - m.glow) * Math.min(1, dt * 8);
    const pulse = 0.88 + 0.12 * Math.sin(time * 6);
    M.eyeGlow.opacity = (0.3 + m.glow * 0.55) * pulse; M.glow.opacity = (0.55 + m.glow * 0.45) * pulse; M.gem.emissiveIntensity = 1 + m.glow * 1.4; M.jelly.emissiveIntensity = 0.55 + m.glow * 0.6;
    // 광륜: 천천히 돌며 떠 있음 · 궁극기 때 열리며 커짐 (f.haloK)
    m.haloK += ((f.haloK || 0) - m.haloK) * Math.min(1, dt * 5);
    m.root.updateMatrixWorld(true); m.root.worldToLocal(H.localToWorld(halo.position.set(0, 0.2, -0.05))); halo.position.y += 0.2 + 0.012 * Math.sin(time * 1.8) + m.haloK * 0.35;
    m.haloSpin = (m.haloSpin || 0) + dt * (0.4 + m.haloK * 5); halo.rotation.set(-0.42 * (1 - m.haloK), 0, 0); haloS.rotation.y = m.haloSpin; halo.scale.setScalar(HS * (1 + m.haloK * 1.3));
    M.haloG.opacity = 0.35 + 0.15 * Math.sin(time * 3) + m.haloK * 0.5; M.halo.emissiveIntensity = 1 + m.haloK * 1.5;
    // 시위: 당김 정도 (f.drawK) 만큼 깍지가 뒤로 · 빛의 화살
    m.drawK += ((f.drawK || 0) - m.drawK) * Math.min(1, dt * 14);
    nock.set(0, 0, BW.string - 0.42 * m.drawK); placeStr(strA, TU, nock); placeStr(strB, TD, nock);
    nArrow.visible = nHead.visible = m.drawK > 0.08; if (nArrow.visible) { nArrow.position.copy(nock); nArrow.scale.set(1 + m.drawK, 1 + m.drawK, BW.tip - nock.z - 0.05); nHead.position.set(0, 0, BW.tip + 0.02); nHead.scale.setScalar(0.6 + m.drawK * 0.8); }
    // 활에 튀는 번개
    if (vis && bow.visible && Math.random() < 0.15 + m.glow * 0.8) { J.weapon.updateMatrixWorld(true); const i = (Math.random() * m.limbPts.length) | 0, p = J.weapon.localToWorld(tmp.copy(m.limbPts[i]));
      for (let k = 0; k < 3; k++) G.fx.p(p.clone().add(new V3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12)), { size: 0.05 + Math.random() * 0.05, size1: 0.01, life: 0.08 + Math.random() * 0.08, color: k ? glowC : 0xffffff, alpha: 1, drag: 0 }); }
    for (const o of extras) o.visible = vis;
  };
  m.setWeapon = (v) => { bow.visible = v; m.weaponOut = !v; };
  m.weaponOut = false;
  m.sole = 0.088;
  const wE = new THREE.Euler(0, 0, 0, 'YXZ'), wQ = new THREE.Quaternion(), wP = new THREE.Quaternion(), wR = new THREE.Quaternion();
  m.rigHook = () => {
    const w = J.weapon.rotation; wE.set(-w.x, -w.y, w.z, 'YXZ'); wQ.setFromEuler(wE);
    m.root.getWorldQuaternion(wR); J.weapon.parent.getWorldQuaternion(wP);
    J.weapon.quaternion.copy(wP.invert().multiply(wR).multiply(wQ)); J.weapon.updateMatrixWorld(true);
  };
  m.weaponPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0, 0.1)); J.weapon.localToWorld(t.set(0, 0, BW.tip)); };
  m.trailPts = (b, t) => { J.weapon.localToWorld(b.set(0, 0.03, BW.riser)); J.weapon.localToWorld(t.set(0, 0.01, BW.tip)); };
  // 화살이 나가는 곳 (앞코) · 활대 끝
  m.tipPos = (out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, 0, BW.tip)); };
  m.limbTip = (s, out = new V3()) => { J.weapon.updateMatrixWorld(true); return J.weapon.localToWorld(out.set(0, s * BW.limb, BW.string)); };
  m.extras = extras;
  return m;
}
