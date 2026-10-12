// 물리 부품: 천(망토) · 로프(땋은 머리 · 사슬) — 모두 verlet 적분, 몸 캡슐과 충돌
import * as THREE from 'three';

const V3 = THREE.Vector3, TAU = Math.PI * 2;

/* =====================================================================
   천 시뮬레이션 (망토): 위쪽 줄은 등에 고정, 몸 캡슐과 충돌
   ===================================================================== */
export class Cloth {
  constructor(scene, W, H, len, mat) {
    this.W = W; this.H = H; this.len = len; this.n = W * H;
    this.p = new Float32Array(this.n * 3); this.o = new Float32Array(this.n * 3); this.ok = false;
    const geo = new THREE.PlaneGeometry(1, 1, W - 1, H - 1); geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true; scene.add(this.mesh);
    this.acc = 0; this.anchors = Array.from({ length: W }, () => new V3());
  }
  reset() {
    const { W, H, p, o } = this;
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { const a = this.anchors[i], k = (j * W + i) * 3; p[k] = o[k] = a.x; p[k + 1] = o[k + 1] = a.y - j * this.dy; p[k + 2] = o[k + 2] = a.z - j * 0.01; }
    this.ok = true;
  }
  step(dt, caps, floor, wind) {
    const { W, H, p, o } = this;
    this.dx = this.anchors[0].distanceTo(this.anchors[1]); this.dy = this.len / (H - 1);
    if (!this.ok) this.reset();
    if (Math.hypot(p[0] - this.anchors[0].x, p[1] - this.anchors[0].y, p[2] - this.anchors[0].z) > 1.5) this.reset();
    this.acc += Math.min(dt, 0.05); const h = 1 / 90;
    while (this.acc >= h) {
      this.acc -= h;
      for (let j = 1; j < H; j++) for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3;
        for (let a = 0; a < 3; a++) { const v = (p[k + a] - o[k + a]) * 0.982; o[k + a] = p[k + a]; p[k + a] += v + (a === 1 ? -9.8 * h * h : wind[a] * h * h); }
      }
      for (let i = 0; i < W; i++) { const a = this.anchors[i], k = i * 3; p[k] = a.x; p[k + 1] = a.y; p[k + 2] = a.z; }
      for (let it = 0; it < 5; it++) {
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const k = (j * W + i) * 3;
          if (i < W - 1) this.link(k, k + 3, this.dx, j === 0);
          if (j < H - 1) this.link(k, k + W * 3, this.dy, j === 0);
          if (i < W - 1 && j < H - 1) this.link(k, k + W * 3 + 3, Math.hypot(this.dx, this.dy), j === 0);
          if (j < H - 2) this.link(k, k + W * 6, this.dy * 2, j === 0, 0.3); // 굽힘 강성: 잔주름 대신 큰 주름
        }
        for (let q = W * 3; q < this.n * 3; q += 3) {
          for (const c of caps) {
            const ax = c.a.x, ay = c.a.y, az = c.a.z, bx = c.b.x - ax, by = c.b.y - ay, bz = c.b.z - az, l2 = bx * bx + by * by + bz * bz;
            let t = l2 ? ((p[q] - ax) * bx + (p[q + 1] - ay) * by + (p[q + 2] - az) * bz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const cx = p[q] - (ax + bx * t), cy = p[q + 1] - (ay + by * t), cz = p[q + 2] - (az + bz * t), d = Math.hypot(cx, cy, cz), r = c.r;
            if (d < r && d > 1e-5) { const s = r / d; p[q] = ax + bx * t + cx * s; p[q + 1] = ay + by * t + cy * s; p[q + 2] = az + bz * t + cz * s; }
          }
          if (p[q + 1] < floor) p[q + 1] = floor;
        }
      }
    }
    const pos = this.mesh.geometry.attributes.position; pos.array.set(p); pos.needsUpdate = true; this.mesh.geometry.computeVertexNormals();
  }
  link(a, b, rest, pinA, k = 1) {
    const p = this.p, dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6, f = ((d - rest) / d) * k;
    if (pinA) { p[b] -= dx * f; p[b + 1] -= dy * f; p[b + 2] -= dz * f; }
    else { const h = f * 0.5; p[a] += dx * h; p[a + 1] += dy * h; p[a + 2] += dz * h; p[b] -= dx * h; p[b + 1] -= dy * h; p[b + 2] -= dz * h; }
  }
}


/* =====================================================================
   로프: 첫 점은 고정점(머리 뒤 · 손목 등), 나머지는 중력으로 늘어지며 몸 캡슐과 충돌
   ===================================================================== */
export class Rope {
  constructor(n, seg, o = {}) {
    this.n = n; this.seg = seg; this.ok = false; this.acc = 0; this.damp = o.damp ?? 0.985; this.stiff = o.stiff ?? 0; // stiff: 직전 마디 방향 유지(굽힘 강성)
    this.p = Array.from({ length: n }, () => new V3()); this.o = Array.from({ length: n }, () => new V3()); this.dir = new V3(0, -1, 0);
  }
  reset(anchor, dir) { for (let i = 0; i < this.n; i++) { this.p[i].copy(anchor).addScaledVector(dir || this.dir, i * this.seg); this.o[i].copy(this.p[i]); } this.ok = true; }
  // rest: 고정점에서 나가는 기본 방향 (예: 머리 뒤로·아래로) — 첫 마디가 그쪽을 향하게 살짝 끈다
  step(dt, anchor, caps, floor, rest, wind) {
    const { p, o, n } = this;
    if (!this.ok || p[0].distanceTo(anchor) > 1.5) this.reset(anchor, rest);
    this.acc += Math.min(dt, 0.05); const h = 1 / 90, tA = new V3(), tB = new V3();
    while (this.acc >= h) {
      this.acc -= h;
      for (let i = 1; i < n; i++) { tA.subVectors(p[i], o[i]).multiplyScalar(this.damp); o[i].copy(p[i]); p[i].add(tA); p[i].y -= 9.8 * h * h; if (wind) p[i].addScaledVector(wind, h * h); }
      p[0].copy(anchor);
      if (rest) { tB.copy(anchor).addScaledVector(rest, this.seg); p[1].lerp(tB, 0.25); }
      for (let it = 0; it < 6; it++) {
        for (let i = 0; i < n - 1; i++) {
          tA.subVectors(p[i + 1], p[i]); const d = tA.length() || 1e-6, f = (d - this.seg) / d;
          if (i === 0) p[1].addScaledVector(tA, -f); else { p[i].addScaledVector(tA, f * 0.5); p[i + 1].addScaledVector(tA, -f * 0.5); }
          if (this.stiff && i > 0) { tB.subVectors(p[i], p[i - 1]).normalize().multiplyScalar(this.seg).add(p[i]); p[i + 1].lerp(tB, this.stiff); }
        }
        for (let i = 1; i < n; i++) {
          const q = p[i];
          for (const c of caps) {
            tA.subVectors(c.b, c.a); const l2 = tA.lengthSq(); let t = l2 ? tB.subVectors(q, c.a).dot(tA) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
            tB.copy(c.a).addScaledVector(tA, t); const dx = q.x - tB.x, dy = q.y - tB.y, dz = q.z - tB.z, d = Math.hypot(dx, dy, dz);
            if (d < c.r && d > 1e-5) { const s = c.r / d; q.set(tB.x + dx * s, tB.y + dy * s, tB.z + dz * s); }
          }
          if (q.y < floor) q.y = floor;
        }
      }
    }
  }
}

// 로프를 따라가는 굵기 변화 관 (땋은 머리 등). prof(v) = 반지름, 매 프레임 링을 다시 놓는다
export class RopeTube {
  constructor(rope, mat, o = {}) {
    this.rope = rope; this.sub = o.sub ?? 3; this.rad = o.rad ?? 10; this.prof = o.prof || (() => 0.02); this.twist = o.twist ?? 0;
    const rows = (rope.n - 1) * this.sub + 1, cols = this.rad + 1; this.rows = rows; this.cols = cols;
    const g = new THREE.BufferGeometry(), pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), idx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { uv[(j * cols + i) * 2] = i / this.rad; uv[(j * cols + i) * 2 + 1] = (j / (rows - 1)) * (o.uvV ?? 1); }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < this.rad; i++) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.curve = new THREE.CatmullRomCurve3(rope.p, false, 'centripetal');
  }
  update() {
    const { rows, cols, rad } = this, pos = this.mesh.geometry.attributes.position, P = new V3(), T = new V3(), N = new V3(), B = new V3(), up = new V3(0, 0, 1);
    this.curve.points = this.rope.p; let prevN = null;
    for (let j = 0; j < rows; j++) {
      const v = j / (rows - 1); this.curve.getPoint(v, P); this.curve.getTangent(v, T);
      if (!prevN) { N.crossVectors(T, up); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize(); } else { N.copy(prevN).addScaledVector(T, -prevN.dot(T)).normalize(); }
      prevN = N.clone(); B.crossVectors(T, N); const r = this.prof(v), tw = v * this.twist;
      for (let i = 0; i < cols; i++) { const th = (i / rad) * TAU + tw, k = (j * cols + i) * 3, c = Math.cos(th) * r, s = Math.sin(th) * r; pos.array[k] = P.x + N.x * c + B.x * s; pos.array[k + 1] = P.y + N.y * c + B.y * s; pos.array[k + 2] = P.z + N.z * c + B.z * s; }
    }
    pos.needsUpdate = true; this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere();
  }
}

// 로프를 따라 늘어선 사슬 고리 (번갈아 90° 돌린 고리), 끝에 장식 하나
export class RopeChain {
  constructor(rope, linkGeo, mat, endObj) {
    this.rope = rope; this.im = new THREE.InstancedMesh(linkGeo, mat, rope.n - 1); this.im.frustumCulled = false; this.im.castShadow = true; this.end = endObj || null;
  }
  update() {
    const p = this.rope.p, m = new THREE.Matrix4(), q = new THREE.Quaternion(), r = new THREE.Quaternion(), d = new V3(), Y = new V3(0, 1, 0), mid = new V3(), one = new V3(1, 1, 1);
    for (let i = 0; i < p.length - 1; i++) {
      d.subVectors(p[i + 1], p[i]); const L = d.length() || 1e-6; d.divideScalar(L); q.setFromUnitVectors(Y, d); r.setFromAxisAngle(Y, (i % 2) * Math.PI / 2); q.multiply(r);
      mid.addVectors(p[i], p[i + 1]).multiplyScalar(0.5); m.compose(mid, q, one); this.im.setMatrixAt(i, m);
    }
    this.im.instanceMatrix.needsUpdate = true; this.im.computeBoundingSphere();
    if (this.end) { const a = p[p.length - 2], b = p[p.length - 1]; d.subVectors(b, a).normalize(); this.end.position.copy(b); this.end.quaternion.setFromUnitVectors(Y, d.negate()); }
  }
}
