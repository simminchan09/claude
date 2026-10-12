// 절차적 조형 도구: 기본 도형을 이어 붙이는 대신 매끈한 곡면을 직접 만든다.
//
//   surf(fn, nu, nv)      매개변수 곡면 — fn(u, v, out) 로 점을 정한다 (u, v ∈ [0, 1])
//   loft(prof, nu, nv)    단면 로프트 — 높이마다 타원/둥근 사각 단면 (팔다리 · 갑옷판 · 몸통)
//   strand(pts, r0, r1)   굵기가 변하는 관 — 머리카락 · 수염 · 털 · 금 장식선
//   noise3(x, y, z)       부드러운 값 노이즈 (0..1)
//   heightToNormal(c)     높이 캔버스 → 노멀맵 (금 상감 양각 등)
//
// 단면 각도 규칙: u = 0.5 가 앞(+Z), 0.25 가 왼쪽(+X), 0.75 가 오른쪽(-X), 0 / 1 이 뒤.
import * as THREE from 'three';

const V3 = THREE.Vector3, TAU = Math.PI * 2;

export function surf(fn, nu, nv, o = {}) {
  const cols = nu + 1, rows = nv + 1, n = cols * rows;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), p = new V3();
  const ru = o.uvU ?? 1, rv = o.uvV ?? 1;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, u = i / nu, v = j / nv; p.set(0, 0, 0); fn(u, v, p);
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = u * ru; uv[k * 2 + 1] = v * rv;
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    if (o.flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  // 닫힌 곡면은 이음매 법선을 평균해 줄무늬가 생기지 않게
  if (o.closedU) {
    const nr = g.attributes.normal;
    for (let j = 0; j < rows; j++) {
      const a = j * cols, b = a + nu, x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
      nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
    }
  }
  // 극점(반지름 0)으로 모이는 줄은 법선을 평균
  if (o.poles) for (const j of o.poles) {
    const nr = g.attributes.normal; let x = 0, y = 0, z = 0;
    for (let i = 0; i < cols; i++) { const k = j * cols + i; x += nr.getX(k); y += nr.getY(k); z += nr.getZ(k); }
    const l = Math.hypot(x, y, z) || 1; for (let i = 0; i < cols; i++) nr.setXYZ(j * cols + i, x / l, y / l, z / l);
  }
  return g;
}

// 단면 각도 → [cos, sin] (x = 왼쪽, z = 앞)
export const ang = (u) => { const t = u * TAU - Math.PI / 2; return [Math.cos(t), Math.sin(t)]; };
const sp = (c, e) => Math.sign(c) * Math.abs(c) ** e;

// prof(v) → { y, rx, rz, rzF?, rzB?, cx?, cz?, n? }  (n > 2 이면 둥근 사각)
// o.a0 / o.a1: 일부 각도만 (판갑) · o.mod(p, u, v, cos, sin, s): 추가 변형
export function loftAt(prof, uu, v, p, mod) {
  const s = prof(v), [c, sn] = ang(uu), e = 2 / (s.n || 2);
  const x = sp(c, e) * s.rx, z = sp(sn, e) * (sn > 0 ? (s.rzF ?? s.rz) : (s.rzB ?? s.rz));
  p.set((s.cx || 0) + x, s.y, (s.cz || 0) + z);
  if (mod) mod(p, uu, v, c, sn, s);
  return p;
}
export function loft(prof, nu = 32, nv = 24, o = {}) {
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? 1, full = a1 - a0 >= 0.999;
  return surf((u, v, p) => loftAt(prof, a0 + (a1 - a0) * u, v, p, o.mod), nu, nv, { closedU: full, flip: o.flip, uvU: o.uvU, uvV: o.uvV, poles: o.poles });
}
// 로프트 한 높이(v)의 테두리 점들 (금테 관을 두를 때)
export function loftRing(prof, v, o = {}) {
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? 1, full = a1 - a0 >= 0.999, n = o.n ?? 64, pts = [];
  for (let i = 0; i < (full ? n : n + 1); i++) pts.push(loftAt(prof, a0 + (a1 - a0) * (i / n), v, new V3(), o.mod));
  return pts;
}
// 곡면 위 한 점을 바깥(ctr 에서 멀어지는 쪽)으로 off 만큼 띄움
export function onSurf(fn, u, v, off, ctr = new V3()) {
  const p = new V3(), a = new V3(), b = new V3(), c = new V3(), d = new V3(), e = 0.002;
  fn(u, v, p); fn(u + e, v, a); fn(u - e, v, b); fn(u, v + e, c); fn(u, v - e, d);
  const n = a.sub(b).cross(c.sub(d)).normalize(); if (n.dot(p.clone().sub(ctr)) < 0) n.negate();
  return p.addScaledVector(n, off);
}
// 키프레임 보간 (Catmull-Rom): keys = [[x, 값], ...] (x 오름차순)
export function spl(keys) {
  const n = keys.length;
  return (x) => {
    if (x <= keys[0][0]) return keys[0][1]; if (x >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0; while (x > keys[i + 1][0]) i++;
    const t = (x - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(n - 1, i + 2)][1], t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
}
export const lathe = (prof, seg = 32) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// 굵기가 변하는 관. pts: 점 배열 또는 Curve. o.ref 를 주면 그 방향으로 납작하게(flat) 눕힌다
export function strand(pts, r0, r1 = r0, o = {}) {
  const curve = pts.isCurve ? pts : new THREE.CatmullRomCurve3(pts.map((q) => (q.isVector3 ? q : new V3(...q))), !!o.closed, 'centripetal');
  const seg = o.seg ?? 20, rad = o.rad ?? 6, flat = o.flat ?? 1, T = new V3(), N = new V3(), B = new V3(), P = new V3(), ref = o.ref ? new V3(...o.ref).normalize() : null;
  const fr = ref ? null : curve.computeFrenetFrames(seg, !!o.closed);
  return surf((u, v, p) => {
    curve.getPointAt(v, P);
    if (ref) { curve.getTangentAt(v, T); B.crossVectors(T, ref); if (B.lengthSq() < 1e-6) B.set(1, 0, 0); B.normalize(); N.crossVectors(B, T); }
    else { const k = Math.round(v * seg); N.copy(fr.normals[k]); B.copy(fr.binormals[k]); }
    const k = o.prof ? o.prof(v) : 1, r = (r0 + (r1 - r0) * (o.ease ? o.ease(v) : v)) * k, th = u * TAU;
    p.copy(P).addScaledVector(B, Math.cos(th) * r).addScaledVector(N, Math.sin(th) * r * flat);
  }, rad, seg, { closedU: true });
}

// 부드러운 값 노이즈 (0..1)
function hash(x, y, z) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const fx = xf * xf * (3 - 2 * xf), fy = yf * yf * (3 - 2 * yf), fz = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy), L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
export const fbm = (x, y, z, o = 3) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s / (1 - 0.5 ** o); };
export const gauss = (x, w = 1) => Math.exp(-(x / w) * (x / w));
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 높이 캔버스(밝을수록 높음) → 노멀맵 텍스처
export function heightToNormal(hc, strength = 2.5, rep = [1, 1]) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), out = g.createImageData(w, h), d = out.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y - 1) - H(x, y + 1)) * strength, l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (-dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t;
}

// 금속 반사용 간이 환경맵 (하늘-지평선-바닥 그라디언트 + 밝은 반점). 렌더러 없이 캔버스로 만든다.
let _env = null;
export function envCube() {
  if (_env) return _env;
  const faces = [];
  for (let f = 0; f < 6; f++) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    if (f === 2) { g.fillStyle = '#e8ecf4'; g.fillRect(0, 0, 128, 128); }
    else if (f === 3) { g.fillStyle = '#2a2420'; g.fillRect(0, 0, 128, 128); }
    else {
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#dfe4ee'); gr.addColorStop(0.47, '#8a8f9c'); gr.addColorStop(0.53, '#5a5048'); gr.addColorStop(1, '#2a2420');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 2; i++) { const x = 30 + ((f * 37 + i * 50) % 70), y = 22 + i * 14, rg = g.createRadialGradient(x, y, 0, x, y, 22 - i * 8); rg.addColorStop(0, 'rgba(255,250,235,0.95)'); rg.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); }
    }
    faces.push(c);
  }
  _env = new THREE.CubeTexture(faces); _env.colorSpace = THREE.SRGBColorSpace; _env.needsUpdate = true; return _env;
}

// 지오메트리 캐시 (같은 캐릭터가 여럿 나와도 한 번만 만든다)
const _geo = new Map();
export const cached = (key, fn) => { let g = _geo.get(key); if (!g) { g = fn(); _geo.set(key, g); } return g; };
