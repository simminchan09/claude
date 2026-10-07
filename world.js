// Shared world definition (used by the main thread and the terrain worker).
// World: 8654m x 8654m ≈ 74.9 km²

export const SIZE = 8654;
export const HALF = SIZE / 2;
export const SEA = 0;
export const ROOT = 1024;                 // quadtree root node size (m)
export const ORIGIN = -4608;              // quadtree / physics grid origin (9 roots cover 9216m)
export const LEAF_RES = 32;               // segments per chunk side
export const MIN_NODE = 64;               // finest chunk: 64m / 32 = 2m vertex spacing
export const GRID = MIN_NODE / LEAF_RES;  // 2m physics grid

// Regions
export const PLATEAU = { x: 300, z: 2300, r: 1000, h: 210 };
export const VOLCANO = { x: 2700, z: -2500, r: 1400, h: 640 };
export const DESERT = { x: -2600, z: 2500, r: 1800 };
export const SNOW = { x: -2500, z: -2500, r: 2200 };
export const LAKE = { x: 1900, z: 900, r: 750 };
export const CASTLE = { x: 0, z: -300, r: 260, h: 70 };

// ---------- noise ----------
export function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}
export function fbm(x, z, o) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; }
  return s;
}
export function ridged(x, z, o) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) {
    const n = 1 - Math.abs(vnoise(x * f + i * 17.3, z * f - i * 9.1));
    s += a * n * n; f *= 2.1; a *= 0.5;
  }
  return s;
}
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mulberry32 = a => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const dist = (x, z, p) => Math.hypot(x - p.x, z - p.z);

// ---------- biomes ----------
export function desertK(x, z) { return 1 - smooth(DESERT.r * 0.55, DESERT.r, dist(x, z, DESERT) + fbm(x / 700, z / 700, 2) * 300); }
export function volcanoK(x, z) { return 1 - smooth(VOLCANO.r * 0.5, VOLCANO.r * 1.05, dist(x, z, VOLCANO)); }
export function snowK(x, z) { return 1 - smooth(SNOW.r * 0.5, SNOW.r, dist(x, z, SNOW)); }
export function landK(x, z) {
  const nx = x / HALF, nz = z / HALF;
  const edge = Math.max(Math.abs(nx), Math.abs(nz)) * 0.6 + Math.hypot(nx, nz) * 0.4;
  const coast = edge + fbm(x * 0.0006, z * 0.0006, 4) * 0.16;
  return 1 - smooth(0.9, 1.02, coast);
}

// ---------- height ----------
export function heightRaw(x, z) {
  const land = landK(x, z);
  if (land <= 0) return -40 + vnoise(x / 300, z / 300) * 6;
  let h = 28 + fbm(x / 1600 + 3.1, z / 1600 - 7.7, 4) * 90 + fbm(x / 260 + 11, z / 260 + 5, 3) * 14 + vnoise(x / 35, z / 35) * 1.2;
  // mountain ranges (stronger in the snowy north-west)
  const sK = snowK(x, z);
  const mMask = smooth(-0.12, 0.3, fbm(x / 3000 + 40, z / 3000 + 11, 3) * 0.9 + sK * 0.55);
  if (mMask > 0) h += ridged(x / 1400, z / 1400, 5) * 520 * mMask;
  // desert dunes
  const dK = desertK(x, z);
  if (dK > 0) {
    const dunes = 34 + (1 - Math.abs(vnoise(x / 140, z / 70))) * 14 + fbm(x / 900, z / 900, 2) * 25;
    h = h + (dunes - h) * dK;
  }
  // volcano
  const dv = dist(x, z, VOLCANO);
  if (dv < VOLCANO.r * 1.1) {
    const t = Math.max(0, 1 - dv / VOLCANO.r);
    let cone = VOLCANO.h * Math.pow(t, 1.6) + vnoise(x / 60, z / 60) * 6 * t;
    if (dv < 140) cone -= (140 - dv) * 1.4;   // crater
    h = Math.max(h, cone);
  }
  // great lake
  const dl = dist(x, z, LAKE);
  if (dl < LAKE.r) h = h + (-22 - h) * (1 - smooth(LAKE.r * 0.55, LAKE.r, dl));
  // central castle mesa
  const dc = dist(x, z, CASTLE);
  if (dc < CASTLE.r + 120) h = h + (CASTLE.h + vnoise(x / 40, z / 40) * 0.6 - h) * (1 - smooth(CASTLE.r, CASTLE.r + 120, dc));
  // starting plateau with cliffs
  const dp = dist(x, z, PLATEAU);
  if (dp < PLATEAU.r + 400) {
    const rr = PLATEAU.r + fbm(x / 500, z / 500, 2) * 160;
    const k = 1 - smooth(rr - 60, rr + 15, dp);
    const top = PLATEAU.h + fbm(x / 220 + 5, z / 220, 3) * 28;
    if (k > 0) h = h + (Math.max(h, top) - h) * k;
  }
  return h * land + (-40) * (1 - land);
}

export function forestK(x, z, h) {
  if (h < 2.5 || h > 380) return 0;
  const f = smooth(-0.05, 0.3, fbm(x / 500 + 77, z / 500 - 5, 3));
  return f * (1 - desertK(x, z)) * (1 - volcanoK(x, z) * 0.95) * (1 - smooth(260, 380, h));
}
export function isSnow(x, z, h) {
  return h > 420 - snowK(x, z) * 300 + vnoise(x / 80, z / 80) * 25 && volcanoK(x, z) < 0.3;
}

// Terrain color (linear-ish RGB 0..1), shared by mesh, map and minimap.
export function terrainColor(h, ny, x, z, out) {
  const v = fbm(x * 0.03, z * 0.03, 2) * 0.5 + 0.5;
  const dK = desertK(x, z), vK = volcanoK(x, z);
  let r, g, b;
  if (h < 2.2) { r = 0.85; g = 0.79; b = 0.56; }
  else if (isSnow(x, z, h) && ny > 0.5) { r = 0.95; g = 0.96; b = 0.98; }
  else if (ny < 0.67) {
    if (vK > 0.4) { r = 0.27; g = 0.22; b = 0.2; } else { r = 0.51; g = 0.48; b = 0.43; }
  } else {
    // grass
    r = 0.37 + 0.2 * v; g = 0.6 + 0.14 * v; b = 0.23 + 0.07 * v;
    const f = forestK(x, z, h);
    r -= 0.13 * f; g -= 0.18 * f; b -= 0.08 * f;
    if (h > 220) { const k = smooth(220, 380, h); r += (0.5 - r) * k; g += (0.5 - g) * k; b += (0.4 - b) * k; }
    if (dK > 0) { r += (0.88 - r) * dK; g += (0.74 - g) * dK; b += (0.48 - b) * dK; }
    if (vK > 0) { const k = vK * vK; r += (0.32 - r) * k; g += (0.26 - g) * k; b += (0.22 - b) * k; }
  }
  out[0] = r; out[1] = g; out[2] = b;
  return out;
}
