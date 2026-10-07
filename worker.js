// Terrain worker: builds chunk geometry and map images off the main thread.
import { heightRaw, terrainColor, LEAF_RES, SIZE, HALF, SEA } from './world.js';

const R = LEAF_RES, V = R + 1;
const col = [0, 0, 0];

function buildChunk(x0, z0, size) {
  const step = size / R;
  // heights on an extended grid (one extra ring for normals)
  const E = V + 2;
  const hs = new Float32Array(E * E);
  for (let j = 0; j < E; j++) for (let i = 0; i < E; i++)
    hs[j * E + i] = heightRaw(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const nVert = V * V + 4 * V;
  const pos = new Float32Array(nVert * 3), nor = new Float32Array(nVert * 3), clr = new Float32Array(nVert * 3);
  const skirt = Math.max(2, step * 1.5);
  let minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const k = j * V + i, h = hs[(j + 1) * E + i + 1];
    const nx = hs[(j + 1) * E + i] - hs[(j + 1) * E + i + 2], nz = hs[j * E + i + 1] - hs[(j + 2) * E + i + 1], ny = 2 * step;
    const l = Math.hypot(nx, ny, nz);
    pos[k * 3] = i * step; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * step;
    nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
    terrainColor(h, ny / l, x0 + i * step, z0 + j * step, col);
    clr[k * 3] = col[0] ** 2.2; clr[k * 3 + 1] = col[1] ** 2.2; clr[k * 3 + 2] = col[2] ** 2.2;   // sRGB -> linear
    if (h < minY) minY = h; if (h > maxY) maxY = h;
  }
  // skirts: copies of edge vertices pushed down (hide LOD cracks)
  const edges = [];
  for (let i = 0; i < V; i++) edges.push(i);                      // top (j=0)
  for (let i = 0; i < V; i++) edges.push((V - 1) * V + i);        // bottom
  for (let j = 0; j < V; j++) edges.push(j * V);                  // left
  for (let j = 0; j < V; j++) edges.push(j * V + V - 1);          // right
  edges.forEach((src, n) => {
    const d = (V * V + n) * 3, s = src * 3;
    pos[d] = pos[s]; pos[d + 1] = pos[s + 1] - skirt; pos[d + 2] = pos[s + 2];
    nor[d] = nor[s]; nor[d + 1] = nor[s + 1]; nor[d + 2] = nor[s + 2];
    clr[d] = clr[s]; clr[d + 1] = clr[s + 1]; clr[d + 2] = clr[s + 2];
  });
  return { pos, nor, clr, minY: minY - skirt, maxY };
}

function buildMap(res) {
  const data = new Uint8ClampedArray(res * res * 4);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = -HALF + (i + 0.5) / res * SIZE, z = -HALF + (j + 0.5) / res * SIZE;
    const h = heightRaw(x, z);
    const k = (j * res + i) * 4;
    if (h < SEA) {
      const d = Math.min(1, -h / 40);
      data[k] = 40 - d * 15; data[k + 1] = 115 - d * 40; data[k + 2] = 180 - d * 50;
    } else {
      const e = SIZE / res;
      const hx = heightRaw(x + e, z), hz = heightRaw(x, z + e);
      const nx = h - hx, nz = h - hz, ny = e, l = Math.hypot(nx, ny, nz);
      terrainColor(h, ny / l, x, z, col);
      const shade = 0.82 + 0.5 * ((nx - nz) / l) + h / 1600;   // hill shading
      data[k] = col[0] * 255 * shade; data[k + 1] = col[1] * 255 * shade; data[k + 2] = col[2] * 255 * shade;
    }
    data[k + 3] = 255;
  }
  return data;
}

function buildMini(cx, cz, span, res) {
  const data = new Uint8ClampedArray(res * res * 4);
  const e = span / res;
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = cx - span / 2 + (i + 0.5) * e, z = cz - span / 2 + (j + 0.5) * e;
    const h = heightRaw(x, z), k = (j * res + i) * 4;
    if (h < SEA) { data[k] = 40; data[k + 1] = 110; data[k + 2] = 175; }
    else {
      const hx = heightRaw(x + e, z), hz = heightRaw(x, z + e);
      const nx = h - hx, nz = h - hz, l = Math.hypot(nx, e, nz);
      terrainColor(h, e / l, x, z, col);
      const shade = 0.85 + 0.6 * ((nx - nz) / l);
      data[k] = col[0] * 255 * shade; data[k + 1] = col[1] * 255 * shade; data[k + 2] = col[2] * 255 * shade;
    }
    data[k + 3] = 255;
  }
  return data;
}

self.onmessage = e => {
  const m = e.data;
  if (m.type === 'chunk') {
    const c = buildChunk(m.x0, m.z0, m.size);
    self.postMessage({ type: 'chunk', key: m.key, ...c }, [c.pos.buffer, c.nor.buffer, c.clr.buffer]);
  } else if (m.type === 'map') {
    const d = buildMap(m.res);
    self.postMessage({ type: 'map', res: m.res, data: d }, [d.buffer]);
  } else if (m.type === 'mini') {
    const d = buildMini(m.cx, m.cz, m.span, m.res);
    self.postMessage({ type: 'mini', cx: m.cx, cz: m.cz, span: m.span, res: m.res, data: d }, [d.buffer]);
  }
};
