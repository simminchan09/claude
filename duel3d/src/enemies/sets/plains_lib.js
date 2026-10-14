// 몬스터 공용 조형 · 연출 도구 (바람의 평원 · 천봉 정상 세트가 함께 쓴다)
//   텍스처(얼룩 피부 · 돌 · 깃털 · 가죽) · 재질 · 짐승 머리 곡면 · 근육 팔다리 로프트 · 발톱 손 · 털 카드
//   로프 물리 묶음(attachScene / dispose / resetCloth) · 날아가는 무기(Missile) · 바닥 예고 표시(groundMark)
import * as THREE from 'three';
import { surf, loft, strand, spl, gauss, smooth, envCube, fbm, heightToNormal } from '../../sculpt.js';
import { Rope, RopeTube } from '../../cloth.js';
import { rand } from '../../core.js';

export const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);

/* =====================================================================
   캔버스 · 텍스처
   ===================================================================== */
export function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
export function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const _tex = {};
export const T = (k, f) => _tex[k] || (_tex[k] = f());
const hex = (c) => { const v = new THREE.Color(c); return [v.r * 255, v.g * 255, v.b * 255]; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// 얼룩 피부 · 돌 표면: 노이즈로 어두운색 → 기본색 → 밝은색을 섞고, 반점 · 사마귀 · 금(갈라짐)을 더한다.
// 같은 붓질로 높이 캔버스도 그려 노멀맵을 만든다 → { map, normal }
export function mottle(key, o) {
  return T('mot:' + key, () => {
    const W = o.w ?? 256, H = o.h ?? 256, [c, g] = cv(W, H), [hc, hg] = cv(W, H), r = rng(o.seed ?? 7);
    const A = hex(o.dark), B = hex(o.base), L = hex(o.light ?? o.base), img = g.createImageData(W, H), him = hg.createImageData(W, H), sc = o.scale ?? 6;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // 가로로 이어지게(원통 둘레) 노이즈를 원 위에서 샘플
      const a = (x / W) * TAU, R = sc / TAU, n = fbm(Math.cos(a) * R + 10, (y / H) * sc * (H / W), Math.sin(a) * R + 10, 4), n2 = fbm(Math.cos(a) * R * 4 + 3, (y / H) * sc * 4 * (H / W), Math.sin(a) * R * 4, 2);
      const t = smooth(0.25, 0.75, n), col = t < 0.5 ? mix3(A, B, t * 2) : mix3(B, L, (t - 0.5) * 2), k = 0.88 + n2 * 0.24, i = (y * W + x) * 4;
      img.data[i] = col[0] * k; img.data[i + 1] = col[1] * k; img.data[i + 2] = col[2] * k; img.data[i + 3] = 255;
      const hv = (n * 0.6 + n2 * 0.4) * 200; him.data[i] = him.data[i + 1] = him.data[i + 2] = hv; him.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); hg.putImageData(him, 0, 0);
    for (let i = 0; i < (o.spots ?? 0); i++) { const x = r() * W, y = r() * H, rr = 1 + r() * 4; g.fillStyle = `rgba(${A[0] | 0},${A[1] | 0},${A[2] | 0},${0.25 + r() * 0.4})`; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
    for (let i = 0; i < (o.warts ?? 0); i++) { const x = r() * W, y = r() * H, rr = 2 + r() * 4; const gr = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr); gr.addColorStop(0, `rgba(${L[0] | 0},${L[1] | 0},${L[2] | 0},0.8)`); gr.addColorStop(1, `rgba(${A[0] | 0},${A[1] | 0},${A[2] | 0},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      const hr = hg.createRadialGradient(x, y, 0, x, y, rr); hr.addColorStop(0, 'rgba(255,255,255,0.9)'); hr.addColorStop(1, 'rgba(255,255,255,0)'); hg.fillStyle = hr; hg.beginPath(); hg.arc(x, y, rr, 0, TAU); hg.fill(); }
    // 금: 구불구불한 선 (돌 · 갈라진 피부). crackGlow 면 빛나는 색으로 따로 그린 발광맵도 만든다
    let glowC = null;
    if (o.cracks) { const [ec, eg] = cv(W, H); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H); glowC = ec;
      for (let i = 0; i < o.cracks; i++) { let x = r() * W, y = r() * H, a = r() * TAU; const n = 6 + (r() * 10 | 0), wd = 0.8 + r() * 1.8;
        const pts = [[x, y]]; for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.4; x += Math.cos(a) * (4 + r() * 8); y += Math.sin(a) * (4 + r() * 8); pts.push([x, y]); }
        for (const [cg, col, w] of [[g, o.crackColor ?? 'rgba(20,16,12,0.85)', wd], [hg, 'rgba(0,0,0,1)', wd * 1.6], [eg, o.crackGlow ?? 'rgba(0,0,0,0)', wd * 1.3]]) { cg.strokeStyle = col; cg.lineWidth = w; cg.lineJoin = 'round'; cg.beginPath(); pts.forEach(([px, py], k) => (k ? cg.lineTo(px, py) : cg.moveTo(px, py))); cg.stroke(); } } }
    if (o.paint) o.paint(g, W, H, r, hg);
    const rep = o.rep ?? [1, 1];
    return { map: tex(c, rep), normal: heightToNormal(hc, o.bump ?? 2.2, rep), glow: glowC ? tex(glowC, rep) : null };
  });
}
// 깃털 · 비늘 무늬: 겹친 반원 비늘을 줄마다 엇갈려 그린다 (v 위 = 캔버스 위)
export function scaleTex(key, o) {
  return T('scl:' + key, () => {
    const W = o.w ?? 256, H = o.h ?? 256, [c, g] = cv(W, H), [hc, hg] = cv(W, H), r = rng(o.seed ?? 3), s = o.size ?? 24;
    g.fillStyle = o.bg; g.fillRect(0, 0, W, H); hg.fillStyle = '#000'; hg.fillRect(0, 0, W, H);
    for (let row = 0, y = -s; y < H + s; row++, y += s * (o.step ?? 0.55)) for (let x = (row % 2) * s * 0.5 - s; x < W + s; x += s) {
      const k = 0.85 + r() * 0.3, cl = new THREE.Color(o.fg).multiplyScalar(k), tip = new THREE.Color(o.tip ?? o.fg);
      const gr = g.createLinearGradient(0, y - s * 0.2, 0, y + s * 0.9); gr.addColorStop(0, '#' + cl.getHexString()); gr.addColorStop(1, '#' + tip.getHexString());
      g.fillStyle = gr; g.strokeStyle = o.line ?? 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath();
      if (o.feather) { g.moveTo(x - s * 0.5, y); g.quadraticCurveTo(x - s * 0.55, y + s * 0.7, x, y + s * 1.05); g.quadraticCurveTo(x + s * 0.55, y + s * 0.7, x + s * 0.5, y); }
      else g.arc(x, y, s * 0.55, 0, Math.PI);
      g.fill(); g.stroke();
      if (o.feather) { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + s * 0.95); g.stroke(); }
      const hr = hg.createRadialGradient(x, y + s * 0.2, 0, x, y + s * 0.3, s * 0.7); hr.addColorStop(0, '#fff'); hr.addColorStop(1, '#000'); hg.fillStyle = hr; hg.beginPath(); hg.arc(x, y + s * 0.2, s * 0.55, 0, Math.PI); hg.fill();
    }
    const rep = o.rep ?? [1, 1]; return { map: tex(c, rep), normal: heightToNormal(hc, 2, rep) };
  });
}
// 천 · 가죽: 바탕 + 결 + 바느질 + 해진 가장자리. paint(g, W, H, r) 로 무늬 추가
export function clothTex(key, o) {
  return T('clo:' + key, () => {
    const W = o.w ?? 256, H = o.h ?? 256, [c, g] = cv(W, H), r = rng(o.seed ?? 5);
    g.fillStyle = o.bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < (o.grain ?? 260); i++) { const x = r() * W, y = r() * H; g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'; g.fillRect(x, y, o.weave ? 1 : 2 + r() * 10, o.weave ? 2 + r() * 10 : 1 + r() * 2); }
    if (o.weave) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let x = 0; x < W; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (o.paint) o.paint(g, W, H, r);
    if (o.stitch) { g.strokeStyle = o.stitch; g.lineWidth = 2; g.setLineDash([5, 5]); for (const y of o.stitchY ?? [8, H - 8]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.setLineDash([]); }
    return tex(c, o.rep ?? [1, 1]);
  });
}
// 털 · 깃털 카드 (투명 가장자리) — 위쪽(뿌리) 불투명, 끝으로 갈수록 가늘다
export function cardTex(key, o) {
  return T('card:' + key, () => {
    const W = 128, H = 256, [c, g] = cv(W, H), r = rng(o.seed ?? 9); g.clearRect(0, 0, W, H); g.lineCap = 'round';
    const A = new THREE.Color(o.root), B = new THREE.Color(o.tip ?? o.root);
    if (o.feather) { // 깃털 한 장: 깃대 + 양쪽 깃가지
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#' + A.getHexString()); gr.addColorStop(1, '#' + B.getHexString());
      g.fillStyle = gr; g.beginPath(); g.moveTo(W / 2, 2); g.quadraticCurveTo(W * 0.98, H * 0.35, W * 0.62, H * 0.98); g.lineTo(W / 2, H * 0.94); g.lineTo(W * 0.38, H * 0.98); g.quadraticCurveTo(W * 0.02, H * 0.35, W / 2, 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; for (let y = 10; y < H * 0.95; y += 6) { g.beginPath(); g.moveTo(W / 2, y); g.lineTo(W * 0.1 + r() * 8, y + 16); g.moveTo(W / 2, y); g.lineTo(W * 0.9 - r() * 8, y + 16); g.stroke(); }
      if (o.band) { g.fillStyle = o.band; for (const y of [0.55, 0.75]) g.fillRect(0, H * y, W, H * 0.06); g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; }
      g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(255,255,240,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H * 0.94); g.stroke();
    } else for (let i = 0; i < (o.n ?? 120); i++) {
      const x0 = W * (0.3 + r() * 0.4), x1 = x0 + (r() - 0.5) * W * 0.6, y1 = H * (0.55 + r() * 0.43), k = 0.75 + r() * 0.35;
      const gr = g.createLinearGradient(0, 0, 0, y1); gr.addColorStop(0, `rgba(${A.r * 255 * k | 0},${A.g * 255 * k | 0},${A.b * 255 * k | 0},1)`); gr.addColorStop(0.8, `rgba(${B.r * 255 * k | 0},${B.g * 255 * k | 0},${B.b * 255 * k | 0},0.9)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.strokeStyle = gr; g.lineWidth = 1.5 + r() * 3; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 20, y1 * 0.5, x1, y1); g.stroke();
    }
    return tex(c);
  });
}

/* =====================================================================
   재질 · 메시 붙이기
   ===================================================================== */
export function phys(o) {
  const mt = new THREE.MeshPhysicalMaterial({ ...o });
  if ((o.metalness || 0) > 0.2) { mt.envMap = envCube(); mt.envMapIntensity = o.envMapIntensity ?? 1; }
  return mt;
}
export const glowMat = (color, k = 2.4) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: k });
export const addMesh = (parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => {
  const me = new THREE.Mesh(geo, mat); me.position.set(...p); me.rotation.set(...r); if (typeof s === 'number') me.scale.setScalar(s); else me.scale.set(...s); parent.add(me); return me;
};
// 금테 · 가죽끈: 점들을 지나는 관
export const tube = (pts, r0, r1 = r0, o = {}) => strand(pts.map((q) => (q.isVector3 ? q : new V3(...q))), r0, r1, { seg: o.seg ?? Math.max(12, pts.length * 3), rad: o.rad ?? 6, ...o });
// 구슬 줄 (염주 · 이빨 목걸이): 관의 굵기를 주기적으로 부풀려 한 메시로 만든다
export const beads = (pts, r, n, o = {}) => strand(pts.map((q) => (q.isVector3 ? q : new V3(...q))), r, r, { seg: n * 6, rad: 8, closed: o.closed, prof: (v) => 0.35 + 0.65 * Math.sqrt(Math.abs(Math.sin(v * n * Math.PI))) });

/* =====================================================================
   근육 팔다리 · 몸통 로프트
   rx / rz: [[v, 값], ...] 키프레임 (v 0 = 관절 위쪽 → 1 = 아래쪽 끝). mod 로 근육 불룩함 추가
   ===================================================================== */
export function limb(len, rx, rz = rx, o = {}) {
  const X = spl(rx), Zf = spl(o.rzF ?? rz), Zb = spl(o.rzB ?? rz), y0 = o.y0 ?? 0.02, cz = o.cz ? spl(o.cz) : null, cx = o.cx ? spl(o.cx) : null;
  return loft((v) => ({ y: y0 - (len + y0 + (o.y1 ?? 0)) * v, rx: X(v), rzF: Zf(v), rzB: Zb(v), cz: cz ? cz(v) : 0, cx: cx ? cx(v) : 0, n: o.n }), o.nu ?? 20, o.nv ?? 12, { mod: o.mod, uvV: o.uvV, uvU: o.uvU, poles: o.poles });
}
// 근육 불룩함: 각도 u 근처(0.5 앞 · 0 뒤 · 0.25 왼 · 0.75 오른) · 높이 v 근처를 바깥으로
export const bulge = (list) => (p, u, v, c, s) => {
  let k = 0; for (const [bu, bv, amt, wu = 0.12, wv = 0.18] of list) { let du = Math.abs(u - bu); du = Math.min(du, 1 - du); k += amt * gauss(du, wu) * gauss(v - bv, wv); }
  if (k) { const l = Math.hypot(p.x, p.z) || 1; p.x += (p.x / l) * k; p.z += (p.z / l) * k; }
};

/* =====================================================================
   짐승 · 괴물 머리 곡면
   방향 (az, el): az 0 = 앞(+Z), 양수 = 왼쪽(+X), el 위 +.  headPt(d) → 점
   o = { C, R:[x,y,z], snout:{len,w,h,y,drop}, nose:{len,w,y,hook}, brow, jaw, cheek, chin, socket:[az,el,depth], mouth:{y,w,depth}, back, flatTop }
   ===================================================================== */
export const dirOf = (az, el, out = new V3()) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
export function creatureHead(o) {
  const C = o.C ?? new V3(0, 0.1, 0), R = o.R, sn = o.snout, ns = o.nose, mo = o.mouth;
  function pt(dx, dy, dz, out) {
    const fz = Math.max(0, dz), bz = Math.max(0, -dz), ax = Math.abs(dx), low = smooth(0.1, -0.9, dy);
    let x = dx * R[0], y = dy * R[1], z = dz * R[2];
    x *= 1 + (o.jaw ?? 0) * low * (0.6 + 0.4 * fz) - (o.temple ?? 0) * gauss(dy - 0.35, 0.3);   // 턱 넓이 · 관자놀이
    z *= 1 + (o.back ?? 0) * bz * smooth(-0.4, 0.5, dy);                                     // 뒤통수
    if (o.flatTop) y *= 1 - o.flatTop * smooth(0.4, 1, dy);
    // 주둥이: 앞쪽 아래가 길게 튀어나온다
    if (sn) { const k = gauss(dy - (sn.y ?? -0.25), sn.h ?? 0.35) * gauss(dx, sn.w ?? 0.45) * Math.pow(fz, sn.p ?? 1.5); z += sn.len * k; y -= (sn.drop ?? 0) * k * sn.len; }
    // 코: 가운데 능선 + 매부리 (고블린 · 뇌공의 부리)
    if (ns) { const k = gauss(dx, ns.w ?? 0.12) * gauss(dy - (ns.y ?? -0.15), ns.h ?? 0.22) * Math.pow(fz, 4); z += ns.len * k; y -= (ns.hook ?? 0) * k * ns.len * smooth(-0.1, -0.45, dy - (ns.y ?? -0.15) + 0.1); }
    z += (o.brow ?? 0) * gauss(dy - (o.browY ?? 0.28), 0.1) * gauss(dx, 0.5) * fz;          // 눈썹뼈
    z += (o.cheek ?? 0) * gauss(ax - 0.55, 0.2) * gauss(dy + 0.1, 0.2) * fz;                 // 광대
    z += (o.chin ?? 0) * gauss(dy + 0.85, 0.2) * gauss(dx, 0.3) * fz;                         // 턱끝
    if (o.socket) { const [sa, se, sd] = o.socket, eaz = Math.atan2(dx, dz); z -= sd * gauss(Math.abs(eaz) - sa, 0.16) * gauss(Math.asin(Math.max(-1, Math.min(1, dy))) - se, 0.14) * fz; }
    if (mo) z -= mo.depth * gauss(dy - mo.y, mo.h ?? 0.035) * gauss(dx, mo.w ?? 0.4) * fz;      // 입 선
    return out.set(C.x + x, C.y + y, C.z + z);
  }
  const at = (az, el, off = 0, out = new V3()) => { const d = dirOf(az, el); pt(d.x, d.y, d.z, out); if (off) { const n = new V3(d.x / R[0], d.y / R[1], d.z / R[2]).normalize(); out.addScaledVector(n, off); } return out; };
  const geo = (nu = 64, nv = 48) => surf((u, v, p) => { const d = dirOf((u - 0.5) * TAU, -Math.PI / 2 + v * Math.PI); pt(d.x, d.y, d.z, p); }, nu, nv, { closedU: true, poles: [0, nv] });
  // 머리 텍스처 좌표: (az, el) → 캔버스 (W × H)
  const P = (az, el, W, H) => [(az / TAU + 0.5) * W, (0.5 - el / Math.PI) * H];
  return { C, R, pt, at, geo, P };
}

/* =====================================================================
   발톱 손 · 발: 손바닥 + 손가락 n 개 (관) + 발톱
   o = { s(좌우 1/-1), n, len, r, curl, spread, claw, palm:[w, l, t], mat, clawMat, thumb }
   ===================================================================== */
export function clawHand(C, key0, o) {
  const s = o.s ?? 1, key = key0 + (s > 0 ? 'L' : 'R'), g = new THREE.Group(), n = o.n ?? 4, [pw, pl, pt] = o.palm ?? [0.034, 0.06, 0.02], r0 = o.r ?? 0.011;
  addMesh(g, C(key + 'palm', () => loft((v) => ({ y: -0.005 - pl * v, rx: pt * (1 + 0.15 * Math.sin(v * Math.PI)), rz: pw * (0.9 + 0.2 * v), n: 2.6 }), 14, 6)), o.mat);
  const clawG = o.claw ? C(key + 'clawG', () => { const cg = new THREE.ConeGeometry(r0 * 0.8, o.claw, 6); cg.translate(0, o.claw / 2, 0); return cg; }) : null;
  const putClaw = (tip, d) => { const cl = addMesh(g, clawG, o.clawMat ?? o.mat, tip.toArray()); cl.quaternion.setFromUnitVectors(UP, d.normalize()); };
  // 손가락: 손바닥 끝에서 아래(-Y)로 뻗어 손바닥 쪽(-s X)으로 말린다. 폭 방향 = Z
  for (let k = 0; k < n; k++) {
    const t = n > 1 ? k / (n - 1) : 0.5, z = (t - 0.5) * pw * 1.5, L = (o.len ?? 0.06) * (1 - 0.3 * Math.abs(t - 0.35)), curl = o.curl ?? 1.4, pts = [new V3(0, -pl + 0.006, z)];
    for (let i = 1; i <= 6; i++) { const th = curl * (i / 6), q = pts[i - 1].clone(); q.x += -s * Math.sin(th) * L / 6; q.y -= Math.cos(th) * L / 6; q.z += (o.spread ?? 0.15) * z * 0.25; pts.push(q); }
    addMesh(g, C(`${key}f${k}`, () => strand(pts, r0, r0 * 0.7, { seg: 10, rad: 7 })), o.mat);
    if (clawG) putClaw(pts[6], pts[6].clone().sub(pts[5]));
  }
  if (o.thumb !== false) { const th = [new V3(-s * pt * 0.6, -0.012, pw * 0.85), new V3(-s * pt * 1.4, -0.03, pw * 1.25), new V3(-s * pt * 1.8, -0.05, pw * 1.2)];
    addMesh(g, C(key + 'thumb', () => strand(th, r0 * 1.1, r0 * 0.75, { seg: 8, rad: 7 })), o.mat);
    if (clawG) putClaw(th[2], th[2].clone().sub(th[1])); }
  return g;
}

/* =====================================================================
   털 · 깃털 카드 (InstancedMesh): sample(r) → { p, n(바깥 법선), flow(결 방향) } 를 n 번 뽑아 붙인다
   ===================================================================== */
export function cards(C, key, mat, N, sample, o = {}) {
  const geo = C('cardG' + (o.bend ?? 0.28), () => { const g = new THREE.PlaneGeometry(1, 1, 1, 3); g.translate(0, -0.5, 0); const ps = g.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setZ(i, (o.bend ?? 0.28) * y * y); } g.computeVertexNormals(); return g; });
  const im = new THREE.InstancedMesh(geo, mat, N), r = rng(o.seed ?? 11), mt = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const { p, n, flow, w, l, c } = sample(r, i), f = flow.clone().addScaledVector(n, -flow.dot(n)).normalize();
    const side = new V3().crossVectors(n, f).normalize(), yA = f.clone().negate(), zA = new V3().crossVectors(side, yA).normalize();
    mt.makeBasis(side.multiplyScalar(w), yA.multiplyScalar(l), zA.multiplyScalar(w)); mt.setPosition(p.clone().addScaledVector(n, o.lift ?? 0.004)); im.setMatrixAt(i, mt);
    im.setColorAt(i, c ?? col.setScalar(0.85 + r() * 0.15));
  }
  im.castShadow = true; return im;
}

/* =====================================================================
   로프 물리 묶음: m.ropes = [{ rope, view, joint, local, rest, caps: 'body'|'legs'|'none', float }]
   Fighter 가 attachScene / dispose 를 부르고, 모델 update 에서 stepRopes(dt, f) 를 부른다
   ===================================================================== */
export function physKit(m) {
  m.ropes = []; const extras = m.extras = [];
  m.addRope = (joint, local, n, seg, mat, prof, o = {}) => {
    const rope = new Rope(n, seg, { damp: o.damp ?? 0.975, stiff: o.stiff ?? 0.1 }), view = new RopeTube(rope, mat, { sub: o.sub ?? 2, rad: o.rad ?? 8, flat: o.flat ?? 1, side: o.side, prof, uvV: o.uvV, wave: o.wave });
    view.mesh.castShadow = true; m.ropes.push({ rope, view, joint, local, rest: (o.rest ?? new V3(0, -1, 0)).clone().normalize(), caps: o.caps ?? 'body', float: o.float ?? 0, sideL: o.side ? o.side.clone() : null, end: o.end || null });
    return m.ropes[m.ropes.length - 1];
  };
  m.attachScene = (scene) => { if (m._att) return; m._att = true; for (const r of m.ropes) { scene.add(r.view.mesh); extras.push(r.view.mesh); if (r.end) { scene.add(r.end); extras.push(r.end); } } };
  m.dispose = (scene) => { for (const o of extras) scene.remove(o); extras.length = 0; m._att = false; };
  m.resetCloth = () => { for (const r of m.ropes) r.rope.ok = false; };
  const tmp = new V3(), rq = new THREE.Quaternion(), hq = new THREE.Quaternion(), wv = new V3();
  m.stepRopes = (dt, f, capsBody, capsLegs) => {
    const vis = f.root.visible; m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) {
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tmp.copy(r.local));
      if (r.sideL) { r.joint.getWorldQuaternion(hq); r.view.side.copy(r.sideL).applyQuaternion(hq); }
      wv.set(-f.vel.x * 0.8 + Math.sin(f.G.time * 1.7 + r.local.x * 9) * 1.2, r.float * 9.8, -f.vel.z * 0.8 + Math.cos(f.G.time * 1.3 + r.local.z * 7) * 1.2);
      r.rope.step(dt, tmp, r.caps === 'legs' ? capsLegs : r.caps === 'none' ? [] : capsBody, f.pos.y + 0.01, r.rest.clone().applyQuaternion(rq), wv);
      r.view.update(); r.view.mesh.visible = vis;
      if (r.end) { const p = r.rope.p; r.end.position.copy(p[p.length - 1]); r.end.quaternion.setFromUnitVectors(UP, tmp.subVectors(p[p.length - 2], p[p.length - 1]).normalize()); r.end.scale.setScalar(f.scale); r.end.visible = vis; }
    }
  };
  // 기본 충돌 캡슐: 몸통(짧게) + 머리 구 + 다리
  m.bodyCaps = (f, headR = 0.12) => {
    const sc = f.scale, h0 = f.hurt[0], h1 = f.hurt[1], legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * sc }));
    return { body: [{ a: h0.a, b: h0.b.clone().lerp(h0.a, 0.2), r: h0.r * 0.8 + 0.04 * sc }, { a: h1.b.clone().lerp(h1.a, 0.5), b: h1.b.clone().lerp(h1.a, 0.5), r: headR * sc }, ...legs], legs };
  };
  return m;
}

/* =====================================================================
   날아가는 무기 (화살 · 돌 · 던진 창): mesh 의 +Z 를 속도 방향으로 돌린다
   o = { owner, pos, vel, mesh, r, hit, life, grav, homing, spin, color, onHit(self, res), onEnd(self), pierce, tick(self, dt) }
   ===================================================================== */
export class Missile {
  constructor(G, o) {
    Object.assign(this, { G, owner: o.owner, pos: o.pos.clone(), vel: o.vel.clone(), r: o.r ?? 0.25, h: o.hit, life: o.life ?? 3, grav: o.grav ?? 0, homing: o.homing ?? 0, spin: o.spin ?? 0, color: o.color ?? 0xffffff, onHit: o.onHit, onEnd: o.onEnd, pierce: !!o.pierce, tickFn: o.tick, t: 0, done: false, hitSet: new Set(), trail: o.trail ?? 1 });
    this.mesh = o.mesh; this.mesh.position.copy(this.pos); this.mesh.scale.setScalar(o.scale ?? this.owner.scale); G.scene.add(this.mesh); this.roll = 0;
  }
  update(dt) {
    const G = this.G, tgt = this.owner.opp; this.t += dt;
    if (this.homing && tgt && this.t < (this.homeT ?? 9)) { const sp = this.vel.length(), d = tgt.chest(new V3()).sub(this.pos).normalize().multiplyScalar(sp); this.vel.lerp(d, 1 - Math.exp(-this.homing * dt)); }
    this.vel.y -= this.grav * dt; if (this.tickFn) this.tickFn(this, dt); if (this.done) return;
    this.pos.addScaledVector(this.vel, dt); this.mesh.position.copy(this.pos);
    if (this.vel.lengthSq() > 1e-4) { this.mesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), this.vel.clone().normalize()); if (this.spin) { this.roll += this.spin * dt; this.mesh.rotateZ(this.roll); } }
    if (this.trail) { G.fx.p(this.pos, { size: this.r * 1.6, size1: this.r * 0.3, life: 0.18, color: this.color, alpha: 0.5 * this.trail, drag: 0 }); if (Math.random() < 0.5) G.fx.burst(this.pos, 1, this.color, 1, { lk: 0.5 }); }
    for (const t of this.owner.foes()) if (!this.hitSet.has(t.id) && t.hurtHit(this.pos, this.r)) {
      const res = t.takeHit(this.owner, this.h, this.vel.clone().setY(0).normalize());
      if (res) { this.hitSet.add(t.id); G.fx.impact(this.pos, this.color, 1.1); this.onHit && this.onHit(this, res); if (!this.pierce) return this.kill(); }
    }
    const W = G.stage && G.stage.world;
    if (this.t > this.life || this.pos.y < 0.03 || (W && !this.pierce && W.solidAt(this.pos, this.r * 0.5)) || Math.hypot(this.pos.x, this.pos.z) > 40) { G.fx.impact(this.pos, this.color, 0.6); this.kill(); }
  }
  kill() { if (this.done) return; this.done = true; this.G.scene.remove(this.mesh); this.onEnd && this.onEnd(this); }
}

/* =====================================================================
   바닥 예고 표시: kind 'lane'(돌진 길 · 너비 w · 길이 len · 방향 yaw) · 'disc'(원 r) · 'ring'(고리 r)
   life 동안 깜빡이며 점점 진해지고 끝나면 사라진다. follow(self) 로 매 프레임 위치 갱신 가능
   ===================================================================== */
const MARK_GEO = {};
export function groundMark(G, o) {
  const kind = o.kind || 'disc', col = o.color ?? 0xff2a3a;
  const geo = MARK_GEO[kind] || (MARK_GEO[kind] = kind === 'lane' ? (() => { const g = new THREE.PlaneGeometry(1, 1, 1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0.5); return g; })() : kind === 'ring' ? (() => { const g = new THREE.RingGeometry(0.86, 1, 64); g.rotateX(-Math.PI / 2); return g; })() : (() => { const g = new THREE.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2); return g; })());
  const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 3; mesh.position.set(o.x ?? 0, (o.y ?? 0) + 0.04, o.z ?? 0);
  if (kind === 'lane') { mesh.scale.set(o.w ?? 2, 1, o.len ?? 10); mesh.rotation.y = o.yaw ?? 0; } else mesh.scale.setScalar(o.r ?? 1.5);
  let edge = null;
  if (kind === 'disc') { edge = new THREE.Mesh(MARK_GEO.ringE || (MARK_GEO.ringE = (() => { const g = new THREE.RingGeometry(0.93, 1, 64); g.rotateX(-Math.PI / 2); return g; })()), mat.clone()); edge.renderOrder = 4; mesh.add(edge); }
  G.scene.add(mesh);
  const self = { done: false, owner: o.owner, t: 0, mesh, update(dt) {
    this.t += dt; const k = Math.min(1, this.t / (o.life ?? 1)), fl = 0.75 + 0.25 * Math.sin(this.t * (10 + 18 * k));
    if (o.follow) o.follow(this, dt);
    mat.opacity = (o.op ?? 0.32) * (0.4 + 0.6 * k) * fl * (k > 0.97 ? (1 - k) / 0.03 : 1); if (edge) edge.material.opacity = Math.min(1, mat.opacity * 2.6);
    if (o.grow && kind !== 'lane') mesh.scale.setScalar((o.r ?? 1.5) * (0.3 + 0.7 * smooth(0, 0.4, k)));
    if (this.t >= (o.life ?? 1)) this.kill();
  }, kill() { if (this.done) return; this.done = true; G.scene.remove(mesh); mat.dispose(); if (edge) edge.material.dispose(); } };
  G.spawn(self); return self;
}
// 선분 위 점들 사이로 번개 지그재그 파티클 (a → b)
export function bolt(G, a, b, color, o = {}) {
  const n = o.n ?? 14, d = new V3().subVectors(b, a), L = d.length(), side = new V3().crossVectors(d, Math.abs(d.y) / (L || 1) > 0.9 ? new V3(1, 0, 0) : UP).normalize(), up2 = new V3().crossVectors(side, d).normalize();
  let prev = a.clone();
  for (let i = 1; i <= n; i++) {
    const t = i / n, j = i === n ? 0 : (o.jit ?? 0.35) * Math.min(1, L / 4), q = a.clone().addScaledVector(d, t).addScaledVector(side, rand(-j, j)).addScaledVector(up2, rand(-j, j));
    for (let k = 0; k < 3; k++) G.fx.p(prev.clone().lerp(q, k / 3), { size: o.size ?? 0.35, size1: 0.05, life: o.life ?? 0.16, color: k ? color : 0xffffff, alpha: 1, drag: 0 });
    prev = q;
  }
}
// 2 마디 IK (평면): 길이 a, b 로 거리 d 에 닿을 때 [첫 마디 각도 보정, 둘째 마디 굽힘]
export function ik2(a, b, d) {
  const dd = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, d));
  const A = Math.acos((a * a + dd * dd - b * b) / (2 * a * dd)), B = Math.acos((a * a + b * b - dd * dd) / (2 * a * b));
  return [A, Math.PI - B];
}
