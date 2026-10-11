// 맵 목록. 새 맵은 { id, name, concept, build(K) } 를 MAPS 에 추가하면 무작위 맵 후보에 들어간다.
// - build 안에서 K.fog()를 먼저 호출한다 (물·용암·구름바다 셰이더가 안개 값을 가져간다).
// - 결투장 안(반경 6.5~20m) 장애물은 K.cylS / K.boxS / K.rockS / K.colC / K.colB 로 만든다 (충돌·올라서기 자동).
//   중앙과 두 시작 위치(±4, 0)는 비워 둔다. 높이 1.7m 이하 장애물은 점프로 올라설 수 있다.
import * as THREE from 'three';
import { createKit, GLSL_NOISE } from './kit.js';

const TAU = Math.PI * 2;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const pol = (a, R) => [Math.sin(a) * R, Math.cos(a) * R];

/* ---------- 공용 소품 ---------- */
function torii(K, x, z, ry, s, red, blk) {
  const g = new THREE.Group(), H = 13 * s, sx = 7.5 * s, M = (geo, mat, px, py, pz, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.z = rz; m.castShadow = true; g.add(m); };
  for (const k of [-1, 1]) { M(cyl(0.75 * s, 0.85 * s, H, 16), red, k * sx, H / 2 - 1.1, 0); M(cyl(1.05 * s, 1.05 * s, 1.2, 16), blk, k * sx, -0.6, 0); M(box(3 * s, 0.9 * s, 1.6 * s), blk, k * 10.6 * s, H - 0.25 * s, 0, k * 0.22); }
  M(box(20 * s, 1 * s, 1.6 * s), blk, 0, H - 0.6 * s, 0); M(box(18.4 * s, 0.7 * s, 1.3 * s), red, 0, H - 1.4 * s, 0); M(box(17 * s, 0.6 * s, 0.7 * s), red, 0, H - 3.6 * s, 0); M(box(1.4 * s, 2.2 * s, 0.3 * s), blk, 0, H - 2.5 * s, 0.5 * s);
  g.position.set(x, 0, z); g.rotation.y = ry; K.add(g); return g;
}
// 석등 (결투장 안이면 solid = true 로 충돌 추가)
function stoneLantern(K, x, z, glowCol, stone, lightI = 22, solid = false) {
  const g = new THREE.Group(), glow = K.glow(glowCol, 3), parts = [], M = (geo, mat, y, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.y = ry; m.castShadow = true; g.add(m); parts.push(m); };
  M(cyl(0.5, 0.7, 0.4, 8), stone, 0.2); M(cyl(0.16, 0.2, 1.3, 8), stone, 1.05); M(box(0.8, 0.12, 0.8), stone, 1.75); M(box(0.55, 0.5, 0.55), glow, 2.05); M(cone(0.75, 0.5, 4), stone, 2.55, Math.PI / 4);
  g.position.set(x, 0, z); K.add(g); if (lightI) K.point(x, 2.05, z, glowCol, lightI, 16, 1);
  if (solid) K.colC(x, z, 0.6, 2.9, parts);
}
function floatingRocks(K, n, rMin, rMax, yMin, yMax, mat) {
  for (let i = 0; i < n; i++) { const [x, z] = K.around(rMin, rMax), m = K.mesh(new THREE.DodecahedronGeometry(K.r(0.8, 3.2), 0), mat, x, K.r(yMin, yMax), z); m.rotation.set(K.r(0, 3), K.r(0, 3), K.r(0, 3)); K.bob(m, 0.6, K.r(0.2, 0.6)); K.spin(m, 'y', 0.05); }
}
function scatter(K, n, rMin, rMax, fn, avoid) { const out = []; for (let i = 0; i < n; i++) { const [x, z, a] = K.around(rMin, rMax, avoid); out.push(fn(x, z, a, i)); } return out; }
function crate(K, x, z, s, ry, mat, edge, y0 = 0) {
  const m = K.boxS(x, z, s, s, s, ry, mat, { y0 });
  for (const [w, h, d, ox, oy] of [[s * 1.02, s * 0.12, s * 1.02, 0, s * 0.44], [s * 1.02, s * 0.12, s * 1.02, 0, -s * 0.44]]) { const b = new THREE.Mesh(box(w, h, d), edge); b.position.set(ox, oy, 0); m.add(b); }
  return m;
}
function barrel(K, x, z, mat, band) {
  const m = K.cylS(x, z, 0.45, 1.05, mat, { rTop: 0.42, seg: 14 });
  for (const y of [-0.32, 0.32]) { const b = new THREE.Mesh(cyl(0.46, 0.46, 0.06, 14), band); b.position.y = y; m.add(b); }
  return m;
}

export const MAPS = [
  /* 1 */ { id: 'eclipse', name: '일식의 신전', concept: '호수 위 석조 신전 · 부서진 석주와 제단 · 일식의 밤', build(K) {
    K.fog(0x241226, 0.0075);
    K.sky({ top: 0x030208, mid: 0x13081f, hor: 0x5c1a26, bot: 0x050306, sun: 'eclipse', sunDir: [0.28, 0.3, -1], sunCol: 0xff9e6b, sunSize: 0.07, stars: 0.8 });
    K.lights({ sky: 0x8a74c0, ground: 0x2a1018, hemi: 1.25, key: 0xffbe96, keyI: 2.6, fill: 0x6f86ff, fillI: 0.7 });
    K.water({ y: -1.1, deep: 0x07050e, shallow: 0x1c1030, skyC: 0x5c1a26, amp: 0.12, spec: 1.4 });
    K.arena({ style: 'stone', curb: 0x4a3f52, runes: 0xffa070 });
    const stone = K.std(0x3a3341), cap = K.std(0x2a2430);
    // 안쪽: 석주 (온전한 것 · 부러진 그루터기)
    [[0.5, 12, 7.5], [1.55, 11.5, 1.1], [2.6, 12.5, 6.8], [3.65, 11, 1.3], [4.7, 12.2, 7], [5.75, 12, 0.9]].forEach(([a, R, h]) => {
      const [x, z] = pol(a, R), p = K.cylS(x, z, 0.85, h, stone, { rTop: 0.75 });
      if (h > 3) { const c = new THREE.Mesh(box(2, 0.5, 2), cap); c.position.y = h / 2 - 0.2; c.castShadow = true; p.add(c); }
    });
    // 제단 두 개 (올라설 수 있음)
    for (const a of [0, Math.PI]) { const [x, z] = pol(a, 16.5), m = K.boxS(x, z, 3.4, 2.2, 1.1, a, cap); const f = new THREE.Mesh(box(1.4, 0.3, 0.9), K.glow(0xff8a50, 1.2)); f.position.y = 0.7; m.add(f); K.point(x, 2, z, 0xff8a50, 14, 10, 1); }
    // 쓰러진 석주
    const fp = K.mesh(cyl(0.8, 0.8, 7, 14), stone, -8.5, 0.75, -12); fp.rotation.set(0, 0, Math.PI / 2); fp.rotation.y = 0.5; K.colB(-8.5, -12, 7, 1.6, 1.5, 0.5, fp);
    // 석등
    for (const a of [0.78, 2.36, 3.93, 5.5]) { const [x, z] = pol(a, 8.2); stoneLantern(K, x, z, 0xff9a4a, cap, 16, true); }
    // 바깥 경계 석주 · 도리이
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.1; if (Math.abs(a - Math.PI) < 0.3) continue; const [x, z] = pol(a, 27.5), h = K.r(9, 13); K.mesh(cyl(0.75, 0.9, h, 14), stone, x, h / 2 - 1.1, z); K.mesh(box(2.1, 0.5, 2.1), cap, x, h - 0.85, z); }
    torii(K, 0, -36, 0, 1, K.std(0x4a0d12, { rough: 0.65 }), K.std(0x120a0e, { rough: 0.6 }));
    K.mountains({ color: 0x1c1228, count: 46 });
    floatingRocks(K, 16, 36, 60, 4, 18, K.std(0x3a3142, { flat: true }));
    K.weather({ type: 'ember', count: 500, color: 0xff9a5a, size: 0.09 });
  } },

  /* 2 */ { id: 'desert', name: '붉은 모래 협곡', concept: '사막 유적 · 바위 기둥 · 무너진 성벽과 오벨리스크', build(K) {
    K.fog(0xdcb88c, 0.0058);
    K.sky({ top: 0x2d5fa8, mid: 0x7fb0de, hor: 0xf3d2a0, sun: 'sun', sunDir: [0.5, 0.55, -0.7], sunCol: 0xfff1c8, sunSize: 0.035, clouds: 0.25, cloudCol: 0xfff2e0 });
    K.lights({ sky: 0xbcd4f0, ground: 0x8a5a30, hemi: 1.4, key: 0xfff0d0, keyI: 3.2 });
    K.ground({ color: 0xc8975a, color2: 0xe2b97a, hills: 5, dunes: 2.2, freq: 0.02, flatR: 26 });
    K.arena({ style: 'sand', raised: false });
    const rock = K.std(0xb4643a, { flat: true }), sandst = K.std(0xc9925a), wall = K.std(0xb88458, { flat: true }), gold = K.std(0xd8a838, { metal: 0.8, rough: 0.3 });
    // 바위 기둥
    [[0.9, 15, 2.6, 6.5], [2.4, 16.5, 2.2, 5], [4.1, 14, 3, 7], [5.4, 17, 2, 4.5]].forEach(([a, R, r, h]) => { const [x, z] = pol(a, R); K.rockS(x, z, r, h, rock); });
    // 무너진 성벽 (높은 벽 · 낮은 벽)
    [[0.2, 10, 5, 3, 0.2], [1.6, 9.5, 4, 1.2, 1.6], [3.3, 11, 5.5, 2.6, 3.3], [4.8, 9.5, 3.5, 1.1, 4.8]].forEach(([a, R, w, h, ry]) => { const [x, z] = pol(a, R); K.boxS(x, z, w, 0.9, h, ry + Math.PI / 2, wall); });
    // 오벨리스크 (서 있는 것 2 · 쓰러진 것 1)
    for (const a of [1.2, 3.9]) { const [x, z] = pol(a, 13), o = K.cylS(x, z, 0.95, 9, sandst, { rTop: 0.5, seg: 4, ry: Math.PI / 4 }); const tip = new THREE.Mesh(cone(0.7, 1.2, 4), gold); tip.position.y = 5.1; tip.rotation.y = Math.PI / 4; o.add(tip); }
    const fo = K.mesh(cyl(0.5, 0.95, 8, 4), sandst, 6, 0.75, -15); fo.rotation.set(0, 0.9, Math.PI / 2); K.colB(6, -15, 8, 1.7, 1.4, 0.9 + Math.PI / 2, fo);
    // 선인장 · 낮은 바위
    const cact = K.std(0x4a7a3a);
    for (const [a, R] of [[0.55, 18], [2.9, 18.5], [4.5, 19], [5.9, 12]]) { const [x, z] = pol(a, R), c = K.cylS(x, z, 0.35, 3.6, cact, { rTop: 0.3, seg: 8 }); for (const s of [-1, 1]) { const arm = new THREE.Mesh(cyl(0.2, 0.22, 1.4, 8), cact); arm.position.set(s * 0.55, 0.3 + s * 0.3, 0); c.add(arm); } }
    for (const [a, R] of [[0.6, 7.5], [2.7, 8], [5.1, 7.5]]) { const [x, z] = pol(a, R); K.rockS(x, z, 1.1, 1.2, rock); }
    // 바깥
    K.mountains({ shape: 'mesa', color: 0xa8542e, band: 0xe0904a, count: 34, rMin: 110, rMax: 240, hMin: 30, hMax: 75, wMin: 20, wMax: 40, y: -2 });
    const pts = scatter(K, 26, 30, 80, (x, z) => ({ x, z, s: K.r(0.8, 1.3), ry: K.r(0, TAU) }));
    K.inst(cyl(0.32, 0.38, 4.2, 8), cact, pts.map((p) => ({ ...p, y: 2.1 * p.s })));
    K.inst(new THREE.DodecahedronGeometry(1, 0), rock, scatter(K, 40, 26, 90, (x, z) => ({ x, z, y: 0, s: K.r(0.8, 3), ry: K.r(0, 3), rx: K.r(0, 3) })));
    K.weather({ type: 'sand', count: 700, color: 0xe8c890, size: 0.07, height: 6, wind: [1, 0.3], opacity: 0.6 });
  } },

  /* 3 */ { id: 'snow', name: '빙설 요새', concept: '설원 요새 · 얼음 결정 · 보급 상자 · 오로라의 밤', build(K) {
    K.fog(0x15233c, 0.01);
    K.sky({ top: 0x02040c, mid: 0x0a1a33, hor: 0x2d4a6a, sun: 'moon', sunDir: [-0.4, 0.45, -0.8], sunCol: 0xdfe8ff, sunSize: 0.045, stars: 0.9, aurora: 1 });
    K.lights({ sky: 0x7a9ad0, ground: 0x30405a, hemi: 1.3, key: 0xbcd0ff, keyI: 1.9, fill: 0x4060a0, fillI: 0.5 });
    K.ground({ color: 0xdfe8f2, color2: 0xb8c8de, hills: 7, freq: 0.025, flatR: 25 });
    K.arena({ style: 'snow', raised: false, runes: 0x7ad0ff, runeOpacity: 0.3 });
    const ice = K.std(0x9fdcff, { rough: 0.15, metal: 0.1, opacity: 0.85, emissive: 0x2a7ac0, ei: 0.7 }), wall = K.std(0x8a96a8, { flat: true }), snowTop = K.std(0xf4f8ff);
    const wood = K.std(0x6a4a2a), iron = K.std(0x3a3a44, { metal: 0.6 });
    // 얼음 결정 무리
    [[0.4, 13], [2.0, 15], [3.4, 12.5], [5.0, 15.5]].forEach(([a, R]) => { const [x, z] = pol(a, R); const m = K.cylS(x, z, 0.9, K.r(4.5, 6.5), ice, { rTop: 0.25, seg: 6 }); m.rotation.z = K.r(-0.12, 0.12);
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(cyl(0.1, 0.4, K.r(1.5, 2.6), 6), ice); s.position.set(K.r(-0.9, 0.9), K.r(-1.8, -1), K.r(-0.9, 0.9)); s.rotation.set(K.r(-0.6, 0.6), 0, K.r(-0.6, 0.6)); m.add(s); } });
    // 무너진 요새 벽 (눈 쌓인 윗면)
    [[1.1, 17, 7, 3.2], [2.7, 18, 5, 2.2], [4.3, 17.5, 6, 3.6], [5.9, 18, 4.5, 1.4]].forEach(([a, R, w, h]) => { const [x, z] = pol(a, R), m = K.boxS(x, z, w, 1.2, h, a + Math.PI / 2, wall); const s = new THREE.Mesh(box(w * 1.02, 0.25, 1.3), snowTop); s.position.y = h / 2; m.add(s); });
    // 보급 상자 (쌓인 것 포함)
    for (const [a, R, y0] of [[0.95, 9, 0], [0.95, 9, 1.2], [1.25, 9.6, 0], [3.9, 9, 0], [4.2, 9.5, 0], [4.05, 9.2, 1.2]]) { const [x, z] = pol(a, R); crate(K, x, z, 1.2, a, wood, iron, y0); }
    // 눈더미 · 화로
    for (const [a, R] of [[2.4, 8], [5.6, 8.5]]) { const [x, z] = pol(a, R); K.rockS(x, z, 1.5, 1, snowTop); }
    for (const a of [1.6, 4.7]) { const [x, z] = pol(a, 7.5), b = K.cylS(x, z, 0.55, 1, iron, { rTop: 0.7 }); K.point(x, 1.6, z, 0xff8a3a, 26, 14, 1); const fire = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), K.glow(0xff7a2a, 3)); fire.position.y = 0.6; b.add(fire); }
    // 바깥: 침엽수림 · 망루 · 산
    const trees = scatter(K, 170, 28, 95, (x, z) => ({ x, z, s: K.r(0.8, 1.6), ry: K.r(0, TAU) }));
    K.inst(cyl(0.18, 0.25, 2, 6), K.std(0x3a2a20), trees.map((p) => ({ ...p, y: 1 * p.s })));
    [[3.2, 3.6, 2.6], [2.5, 3, 4.2], [1.7, 2.4, 5.6]].forEach(([r, h, y]) => {
      K.inst(cone(r, h, 8), K.std(0x1f3a2c, { flat: true }), trees.map((p) => ({ ...p, y: y * p.s })));
      K.inst(cone(r * 0.6, h * 0.45, 8), snowTop, trees.map((p) => ({ ...p, y: (y + h * 0.32) * p.s })));
    });
    for (const a of [2.6, 3.7]) { const [x, z] = pol(a, 32); K.mesh(cyl(3, 3.4, 13, 10), wall, x, 6, z); K.mesh(cone(3.8, 4.5, 10), snowTop, x, 14.7, z); }
    K.mountains({ color: 0x3a4a64, snow: true, count: 40, hMin: 40, hMax: 110 });
    K.weather({ type: 'snow', count: 1000, color: 0xffffff, size: 0.09, wind: [0.5, 0.2] });
  } },

  /* 4 */ { id: 'plains', name: '바람의 평원', concept: '초원 마을 어귀 · 거석 · 건초더미 · 울타리와 우물', build(K) {
    K.fog(0xc6dcef, 0.0042);
    K.sky({ top: 0x2a68cf, mid: 0x6aa6ea, hor: 0xd8ecf8, sun: 'sun', sunDir: [-0.3, 0.7, -0.5], sunCol: 0xfffbe8, sunSize: 0.03, clouds: 0.75 });
    K.lights({ sky: 0xcfe4ff, ground: 0x4a6a2a, hemi: 1.5, key: 0xfff4e0, keyI: 3 });
    K.ground({ color: 0x4f7d32, color2: 0x86a848, hills: 9, freq: 0.018, flatR: 26 });
    K.arena({ style: 'grass', raised: false });
    const stone = K.std(0x8a8a86, { flat: true }), wood = K.std(0x7a5634), hay = K.std(0xd8b85a, { rough: 1 });
    // 거석 (짝을 이룬 돌 위에 덮개돌)
    for (const a of [0.4, 2.5, 4.6]) {
      for (const d of [-0.16, 0.16]) { const [x, z] = pol(a + d, 14.5); K.boxS(x, z, 1.3, 0.9, 3.8, a + d, stone); }
      const [x, z] = pol(a, 14.5), l = K.mesh(box(5, 0.8, 1.2), stone, x, 4.2, z); l.rotation.y = a + Math.PI / 2;
    }
    // 큰 나무
    { const [x, z] = pol(1.5, 15), t = K.cylS(x, z, 0.8, 5, K.std(0x5a4030), { rTop: 0.55 }); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 1), K.std(0x3e7a2e, { flat: true })); c.position.y = 4.4; c.castShadow = true; t.add(c); }
    // 건초더미
    for (const [a, R] of [[0.95, 9.5], [3.5, 10], [5.6, 11]]) { const [x, z] = pol(a, R), h = K.cylS(x, z, 1.15, 1.3, hay, { rTop: 1.05 }); const top = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 8, 0, TAU, 0, Math.PI / 2), hay); top.position.y = 0.65; top.scale.y = 0.45; h.add(top); }
    // 나무 울타리 (낮아서 넘을 수 있음)
    for (const [a, R, ry] of [[2.0, 18.5, 2.0], [3.0, 18, 3.0], [5.1, 18.5, 5.1]]) {
      const [x, z] = pol(a, R), f = K.boxS(x, z, 5, 0.18, 1.0, ry + Math.PI / 2, wood);
      for (const d of [-2.3, 0, 2.3]) { const p = new THREE.Mesh(box(0.2, 1.3, 0.2), wood); p.position.set(d, 0.1, 0); f.add(p); }
    }
    // 우물
    { const [x, z] = pol(4.0, 8.5), w = K.cylS(x, z, 1.1, 0.9, stone); for (const s of [-1, 1]) { const p = new THREE.Mesh(box(0.15, 2.2, 0.15), wood); p.position.set(s * 0.9, 1.3, 0); w.add(p); } const r = new THREE.Mesh(cone(1.5, 0.9, 4), K.std(0x8a3a2a)); r.position.y = 2.7; r.rotation.y = Math.PI / 4; w.add(r); }
    // 바깥
    K.inst(cone(0.12, 0.55, 4), K.std(0x5f9a38), scatter(K, 1800, 6, 70, (x, z) => ({ x, z, y: 0.2, s: K.r(0.6, 1.4), ry: K.r(0, 3) })), false);
    const trees = scatter(K, 70, 30, 140, (x, z) => ({ x, z, s: K.r(1, 1.8), ry: K.r(0, TAU) }));
    K.inst(cyl(0.3, 0.45, 4, 7), K.std(0x5a4030), trees.map((p) => ({ ...p, y: 2 * p.s })));
    K.inst(new THREE.IcosahedronGeometry(2.6, 1), K.std(0x3e7a2e, { flat: true }), trees.map((p) => ({ ...p, y: 5.2 * p.s })));
    const mill = new THREE.Group(); mill.position.set(48, 0, -60); K.add(mill);
    const tw = new THREE.Mesh(cyl(2, 3.4, 16, 8), K.std(0xe8e2d4)); tw.position.y = 8; tw.castShadow = true; mill.add(tw);
    const roof = new THREE.Mesh(cone(2.8, 3.5, 8), K.std(0x8a3a2a)); roof.position.y = 17.7; mill.add(roof);
    const blades = new THREE.Group(); blades.position.set(0, 14.5, 2.4); mill.add(blades);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(box(1.4, 9, 0.15), K.std(0xd8c8a8)); b.position.y = 4.6; const p = new THREE.Group(); p.rotation.z = (i / 4) * TAU; p.add(b); blades.add(p); }
    mill.lookAt(0, 0, 0); K.spin(blades, 'z', 0.6);
    K.mountains({ color: 0x6a86a8, snow: true, rMin: 200, rMax: 300, count: 36 });
    K.weather({ type: 'petal', count: 350, color: 0xffd0e8, size: 0.09, height: 10 });
  } },

  /* 5 */ { id: 'ocean', name: '노을빛 해상', concept: '거대 범선 갑판 · 돛대 · 화물 상자와 대포 · 저녁 바다', build(K) {
    K.fog(0xd88a70, 0.0055);
    K.sky({ top: 0x1c2a5a, mid: 0x6a4a8a, hor: 0xffa86a, sun: 'sun', sunDir: [0.15, 0.07, -1], sunCol: 0xffc890, sunSize: 0.05, clouds: 0.45, cloudCol: 0xffb0a0 });
    K.lights({ sky: 0x9a8ac0, ground: 0x203040, hemi: 1.25, key: 0xffb488, keyI: 2.6, keyDir: [0.3, 0.5, -1], fill: 0x5070c0, fillI: 0.6 });
    K.water({ y: -1.7, deep: 0x0a1a3a, shallow: 0x2a5a8a, skyC: 0xffa070, amp: 0.7, spec: 2.4 });
    K.arena({ style: 'wood', side: 0x4a2e1a, curb: 0x2a1a10, height: 0.6, base: false });
    const wood = K.std(0x3a2414), plank = K.std(0x6a4a2e), iron = K.std(0x2a2a30, { metal: 0.7, rough: 0.4 }), sailM = K.std(0xe8dcc0, { rough: 1 }); sailM.side = THREE.DoubleSide;
    // 돛대 2개 (활대 · 돛)
    for (const z of [12, -12]) {
      const m = K.cylS(0, z, 0.5, 17, wood, { rTop: 0.35 });
      for (const [y, w] of [[2.5, 9], [5.5, 7]]) { const yard = new THREE.Mesh(cyl(0.18, 0.18, w, 8), wood); yard.rotation.z = Math.PI / 2; yard.position.y = y; m.add(yard); const sl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 2.8, 6, 3), sailM); sl.position.set(0, y - 1.5, 0.3); m.add(sl); }
    }
    // 화물 상자 · 통
    for (const [x, z, y0] of [[-9, 6, 0], [-9, 6, 1.3], [-10.4, 6.2, 0], [9.5, -5, 0], [9.5, -6.4, 0], [9.6, -5.7, 1.3], [-12, -9, 0], [12, 9, 0]]) crate(K, x, z, 1.3, 0.1, plank, iron, y0);
    for (const [x, z] of [[-7, -7.5], [-6.2, -8.4], [7, 7.5], [7.9, 8.2], [14, -1], [-14, 1.5], [3, 16], [-3, -16]]) barrel(K, x, z, plank, iron);
    // 대포 (뱃전)
    for (const [a, R] of [[1.1, 19], [2.0, 19], [4.2, 19], [5.1, 19]]) {
      const [x, z] = pol(a, R), c = K.boxS(x, z, 1.4, 1.6, 0.9, a, wood); const b = new THREE.Mesh(cyl(0.28, 0.36, 2.4, 12), iron); b.rotation.x = Math.PI / 2; b.position.set(0, 0.55, 0.9); c.add(b);
    }
    // 고물 갑판 (올라설 수 있는 단)
    { const q = K.boxS(17, 0, 3.6, 10, 1.5, 0, plank); const rl = new THREE.Mesh(box(0.15, 0.8, 10), wood); rl.position.set(1.7, 1.1, 0); q.add(rl); }
    // 난간 · 바깥 풍경
    const rail = new THREE.Mesh(new THREE.TorusGeometry(22.8, 0.08, 6, 120), K.std(0xc8b088)); rail.rotation.x = Math.PI / 2; rail.position.y = 1.05; K.add(rail);
    for (let i = 0; i < 24; i++) { const [x, z] = pol((i / 24) * TAU, 22.8); K.mesh(cyl(0.12, 0.12, 1.2, 6), wood, x, 0.5, z); }
    for (let i = 0; i < 16; i++) { const [x, z] = pol((i / 16) * TAU, 21); K.mesh(cyl(0.4, 0.4, 7, 8), wood, x, -3.8, z); }
    const rocks = K.std(0x2a2830, { flat: true });
    for (let i = 0; i < 6; i++) K.mesh(new THREE.DodecahedronGeometry(K.r(3, 7), 0), rocks, 44 + K.r(-6, 6), -2, -52 + K.r(-6, 6)).rotation.set(K.r(0, 3), K.r(0, 3), 0);
    const lh = new THREE.Group(); lh.position.set(44, 2, -52); K.add(lh);
    [[0xf2ece0, 0], [0xb8302a, 4], [0xf2ece0, 8], [0xb8302a, 12]].forEach(([c, y]) => { const s = new THREE.Mesh(cyl(1.6 - y * 0.05, 1.8 - y * 0.05, 4, 16), K.std(c)); s.position.y = y + 2; s.castShadow = true; lh.add(s); });
    const lamp = new THREE.Mesh(cyl(1.1, 1.1, 1.6, 12), K.glow(0xffe8a0, 4)); lamp.position.y = 16.8; lh.add(lamp);
    const beamG = cone(4, 40, 24); beamG.translate(0, -20, 0); beamG.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const bh = new THREE.Group(); bh.position.y = 16.8; bh.add(beam); lh.add(bh); K.spin(bh, 'y', 0.7);
    K.weather({ type: 'spray', count: 220, color: 0xffffff, size: 0.08, height: 4, opacity: 0.55 });
  } },

  /* 6 */ { id: 'volcano', name: '용암 분화구', concept: '흑요석 단상 · 현무암 기둥 계단 · 용암 웅덩이(피해) · 분화구', build(K) {
    K.fog(0x2a0c06, 0.011);
    K.sky({ top: 0x080202, mid: 0x2a0806, hor: 0x8a2a12, sun: 'none', clouds: 0.7, cloudCol: 0x3a1a14 });
    K.lights({ sky: 0x7a3a2a, ground: 0xff5a1a, hemi: 1.25, key: 0xffa070, keyI: 1.8, keyDir: [0.2, 1, 0.3], fill: 0xff4010, fillI: 0.7 });
    K.lava({ y: -1.5 });
    K.arena({ style: 'obsidian', shape: 'hex', side: 0x16101a, ei: 0.9, height: 1.2 });
    const basalt = K.std(0x1c1820, { flat: true, rough: 0.7 }), obs = K.std(0x0a0a0e, { metal: 0.4, rough: 0.2 });
    // 현무암 기둥 무리 (낮은 것부터 계단처럼)
    for (const [a, R] of [[0.6, 13], [2.7, 14], [4.6, 13.5]]) [[0, 0, 1], [1.7, 0.4, 2], [0.9, 1.6, 3.2], [-0.8, 1.4, 4.4]].forEach(([dx, dz, h]) => { const [x, z] = pol(a, R); K.cylS(x + dx, z + dz, 0.95, h, basalt, { seg: 6 }); });
    // 흑요석 가시
    for (const [a, R] of [[1.6, 17], [3.6, 18], [5.6, 17.5], [0.05, 18.5]]) { const [x, z] = pol(a, R); K.cylS(x, z, 1.1, K.r(3.5, 5.5), obs, { rTop: 0.08, seg: 5 }); }
    // 용암 웅덩이 (서 있으면 피해)
    for (const [a, R, r] of [[1.25, 9, 2], [3.3, 9.5, 2.2], [5.25, 10, 1.8]]) {
      const [x, z] = pol(a, R), m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), K.glow(0xff5a10, 2.6)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); K.add(m);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, 24), basalt); rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.05, z); K.add(rim);
      K.hazard(x, z, r, 40, 0xff6a1a); K.point(x, 0.8, z, 0xff5a10, 18, 8, 1);
      K.updaters.push((dt, t) => { m.material.emissiveIntensity = 2.2 + Math.sin(t * 3 + a) * 0.6; });
    }
    // 바깥
    K.inst(cyl(1, 1, 1, 6), basalt, scatter(K, 70, 24, 36, (x, z) => { const h = K.r(1, 6); return { x, z, y: h / 2 - 1.5, sx: K.r(0.8, 1.3), sz: K.r(0.8, 1.3), sy: h, ry: K.r(0, 1) }; }));
    const vol = K.mesh(cone(80, 70, 18), K.std(0x1e1416, { flat: true }), 0, 30, -150); vol.scale.set(1, 1, 0.8);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(15, 24), K.glow(0xff5a10, 3)); crater.rotation.x = -Math.PI / 2; crater.position.set(0, 58, -150); K.add(crater);
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3, f = K.mesh(box(2.2, 60, 0.6), K.glow(0xff6a1a, 2.5), Math.sin(a) * 24, 30, -150 + Math.cos(a) * 24 * 0.8 + 18); f.rotation.set(-0.85, a, 0); }
    K.mountains({ color: 0x1a1012, count: 30, rMin: 170, rMax: 280 });
    for (const [x, z] of [[24, 0], [-24, 0], [0, 24], [0, -24]]) K.point(x, -0.5, z, 0xff5a1a, 60, 22, 1);
    K.weather({ type: 'ember', count: 700, color: 0xff7a2a, size: 0.1 }); K.weather({ type: 'ash', count: 400, color: 0x5a5a5a, size: 0.08, wind: [0.4, 0] });
  } },

  /* 7 */ { id: 'peak', name: '천봉 정상', concept: '구름 위 산 정상 · 바위 노두 · 불탑과 룽다 깃발 · 새벽', build(K) {
    K.fog(0xd9c4d8, 0.0035);
    K.sky({ top: 0x0c1a48, mid: 0x3a5aa8, hor: 0xffc6a8, sun: 'sun', sunDir: [-0.6, 0.12, -0.8], sunCol: 0xffd7b0, sunSize: 0.045, clouds: 0.2 });
    K.lights({ sky: 0xa8b8ff, ground: 0x6a5a70, hemi: 1.35, key: 0xffd0b0, keyI: 2.8, keyDir: [-0.6, 0.45, -0.8] });
    K.cloudSea({ y: -16, color: 0xffeaea, shade: 0x9a8ab8 });
    K.arena({ style: 'rock', side: 0x4a4a52, height: 1.2 });
    K.mesh(cyl(24.5, 6, 36, 10), K.std(0x44444e, { flat: true }), 0, -19.4, 0);
    const rock = K.std(0x5a5a66, { flat: true }), white = K.std(0xf2eee4), gold = K.std(0xd8a838, { metal: 0.8, rough: 0.3 });
    // 바위 노두
    [[0.3, 14, 2.4, 3.5], [1.4, 17, 2, 2.2], [2.9, 15, 3, 4.5], [4.1, 17.5, 1.8, 1.5], [5.3, 14.5, 2.5, 3.2]].forEach(([a, R, r, h]) => { const [x, z] = pol(a, R); K.rockS(x, z, r, h, rock); });
    // 불탑 (기단에 올라설 수 있음)
    { const [x, z] = pol(3.55, 10.5), b = K.boxS(x, z, 3.2, 3.2, 1.4, 0.2, white); const d = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 10, 0, TAU, 0, Math.PI / 2), white); d.position.y = 0.7; b.add(d);
      const sp = new THREE.Mesh(cone(0.35, 2.2, 10), gold); sp.position.y = 2.9; b.add(sp); K.colC(x, z, 1.2, 3.4); }
    // 돌탑
    for (const [a, R] of [[0.95, 9], [2.2, 8.5], [5.85, 8.5]]) { const [x, z] = pol(a, R), parts = []; for (let k = 0; k < 4; k++) parts.push(K.mesh(new THREE.DodecahedronGeometry(0.5 - k * 0.09, 0), rock, x, 0.35 + k * 0.6, z)); K.colC(x, z, 0.5, 2.4, parts); }
    // 룽다 깃발: 장대 6개 사이에 줄
    const pole = K.std(0x5a4030), cols = [0x2a6ad8, 0xf2f2f2, 0xd8302a, 0x3aa84a, 0xf2c21a];
    const poles = [0, 1, 2, 3, 4, 5].map((i) => { const [x, z] = pol((i / 6) * TAU + 0.5, 20.5); K.cylS(x, z, 0.14, 5.5, pole, { seg: 6 }); return [x, z]; });
    cols.forEach((c, ci) => {
      const list = [];
      poles.forEach(([x0, z0], i) => { const [x1, z1] = poles[(i + 1) % 6]; for (let k = 1; k < 20; k++) if (k % 5 === ci) { const t = k / 20, sag = Math.sin(t * Math.PI) * 1.6; list.push({ x: x0 + (x1 - x0) * t, y: 5.1 - sag - 0.25, z: z0 + (z1 - z0) * t, ry: Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2 }); } });
      K.inst(box(0.5, 0.5, 0.02), K.std(c, { rough: 1 }), list, false);
    });
    K.mountains({ shape: 'spire', color: 0x4a4a58, snow: true, rMin: 70, rMax: 220, hMin: 50, hMax: 120, wMin: 14, wMax: 22, y: -34, count: 34 });
    K.weather({ type: 'wind', count: 260, color: 0xffffff, size: 0.06, height: 8, wind: [1, 0.25], opacity: 0.5 });
  } },

  /* 8 */ { id: 'bamboo', name: '죽림 사당', concept: '대나무 숲 속 사당 · 대나무 덤불 · 석등 · 잉어 연못 · 반딧불', build(K) {
    K.fog(0x0c1a14, 0.022);
    K.sky({ top: 0x020604, mid: 0x081812, hor: 0x2a4a3a, sun: 'moon', sunDir: [0.3, 0.55, -0.7], sunCol: 0xf2f4e0, sunSize: 0.06, stars: 0.6 });
    K.lights({ sky: 0x6a9a80, ground: 0x1a2a1a, hemi: 1.2, key: 0xd8e8ff, keyI: 1.7, fill: 0x4a8a6a, fillI: 0.45 });
    K.ground({ color: 0x1e2a18, color2: 0x34452a, hills: 3, flatR: 25 });
    K.arena({ style: 'moss', raised: false });
    const stalkM = K.std(0x6a8a3a, { rough: 0.5 }), leaf = K.std(0x22401e, { flat: true }), st = K.std(0x4a4e48), red = K.std(0x7a1a14), dark = K.std(0x1a1414);
    // 대나무 덤불 (안쪽 장애물)
    for (const [a, R] of [[0.35, 12], [1.3, 16], [2.2, 11.5], [3.0, 16.5], [4.0, 12.5], [5.0, 16], [5.8, 11]]) {
      const [cx, cz] = pol(a, R), list = [];
      for (let k = 0; k < 9; k++) { const h = K.r(9, 15); list.push({ x: cx + K.r(-1, 1), z: cz + K.r(-1, 1), y: h / 2, sy: h, rx: K.r(-0.08, 0.08), rz: K.r(-0.08, 0.08) }); }
      const im = K.inst(cyl(0.1, 0.12, 1, 7), stalkM, list); K.colC(cx, cz, 1.25, 14, [im]);
      K.inst(new THREE.IcosahedronGeometry(1.2, 0), leaf, list.slice(0, 5).map((p) => ({ x: p.x, z: p.z, y: p.sy - 1, sx: 1.8, sy: 0.5, sz: 1.8 })));
    }
    // 석등 · 잉어 연못 · 디딤돌 · 쓰러진 대나무 다발
    for (const a of [0.8, 2.6, 4.45]) { const [x, z] = pol(a, 8.5); stoneLantern(K, x, z, 0xffb060, st, 14, true); }
    { const [x, z] = pol(3.55, 15), pond = new THREE.Mesh(new THREE.CircleGeometry(3, 28), K.std(0x0a2a2a, { rough: 0.05, metal: 0.8 })); pond.rotation.x = -Math.PI / 2; pond.position.set(x, 0.02, z); K.add(pond);
      for (let k = 0; k < 4; k++) { const f = K.mesh(box(0.5, 0.05, 0.2), K.glow(k % 2 ? 0xff7a2a : 0xffffff, 0.8), x + K.r(-1.5, 1.5), 0.04, z + K.r(-1.5, 1.5), false); K.spin(f, 'y', K.r(-0.6, 0.6)); } }
    { const lg = K.mesh(cyl(0.35, 0.35, 6, 8), K.std(0x8a7a3a), 0, 0.35, 15); lg.rotation.set(0, 0.3, Math.PI / 2); K.colB(0, 15, 6, 0.8, 0.7, 0.3 + Math.PI / 2, lg); }
    // 바깥: 사당 · 빽빽한 대숲
    const sh = new THREE.Group(); sh.position.set(0, 0, -30); K.add(sh);
    const M = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; sh.add(m); return m; };
    M(box(8, 0.8, 6), st, 0, 0.4, 0); for (const [x, z] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) M(cyl(0.22, 0.22, 4, 8), red, x, 2.8, z);
    M(box(9, 0.5, 7), dark, 0, 4.9, 0); M(cone(6, 2.4, 4), dark, 0, 6.3, 0).rotation.y = Math.PI / 4;
    K.point(0, 3, -27, 0xff6a3a, 18, 14, 1); torii(K, 0, -24, 0, 0.45, red, dark);
    const stalks = scatter(K, 420, 25, 64, (x, z) => ({ x, z, s: K.r(0.8, 1.25), h: K.r(10, 16) }), [Math.PI, 0.28]);
    K.inst(cyl(0.09, 0.11, 1, 7), stalkM, stalks.map((p) => ({ x: p.x, z: p.z, y: p.h / 2, sx: p.s, sz: p.s, sy: p.h, rx: K.r(-0.06, 0.06), rz: K.r(-0.06, 0.06) })));
    K.inst(new THREE.IcosahedronGeometry(1.2, 0), leaf, stalks.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.x + K.r(-0.6, 0.6), z: p.z + K.r(-0.6, 0.6), y: p.h - K.r(0, 2), sx: K.r(1, 2), sy: 0.5, sz: K.r(1, 2) })));
    K.weather({ type: 'firefly', count: 260, color: 0xc8ff6a, size: 0.13, area: 30, height: 5 });
  } },

  /* 9 */ { id: 'neon', name: '네온 시티 옥상', concept: '마천루 옥상 · 공조기와 물탱크 · 네온 광고판 · 비 내리는 밤', build(K) {
    K.fog(0x140a26, 0.009);
    K.sky({ top: 0x040210, mid: 0x150a30, hor: 0x5a1a5a, sun: 'none', stars: 0.15, clouds: 0.5, cloudCol: 0x2a1440 });
    K.lights({ sky: 0x6a4ab0, ground: 0x200a30, hemi: 1.15, key: 0xb0a0ff, keyI: 1.4, keyDir: [0.3, 1, 0.4], fill: 0xff3ad0, fillI: 0.55 });
    K.arena({ style: 'neon', shape: 'oct', side: 0x1a1c26, height: 1, ei: 2.2, rough: 0.35, metal: 0.6, base: false });
    const metal = K.std(0x2a2c36, { metal: 0.7, rough: 0.4 }), dark = K.std(0x16161e, { metal: 0.5, rough: 0.5 });
    const winA = K.windowTexture(1, ['#ffd28a', '#9ad8ff', '#ffffff']), bmat = new THREE.MeshStandardMaterial({ color: 0x14141c, emissive: 0xffffff, emissiveMap: winA, emissiveIntensity: 1.3, roughness: 0.6, metalness: 0.4 });
    winA.repeat.set(2, 6); K.mesh(box(56, 100, 56), bmat, 0, -51, 0, false);
    // 공조기 (팬이 돈다)
    for (const [a, R] of [[0.4, 12], [1.9, 15], [3.3, 11.5], [4.8, 15.5]]) {
      const [x, z] = pol(a, R), u = K.boxS(x, z, 2.6, 2.2, 1.5, a, metal);
      const fan = new THREE.Mesh(cyl(0.8, 0.8, 0.08, 16), K.glow(0x22e6ff, 0.6)); fan.position.y = 0.78; u.add(fan);
      const bl = new THREE.Mesh(box(1.5, 0.05, 0.25), dark); bl.position.y = 0.84; u.add(bl); K.spin(bl, 'y', 8);
    }
    // 물탱크 (기둥 위)
    { const [x, z] = pol(2.6, 17), parts = []; parts.push(K.mesh(cyl(2.2, 2.2, 3.5, 18), metal, x, 4.5, z)); parts.push(K.mesh(cone(2.4, 1.2, 18), metal, x, 6.8, z));
      for (let i = 0; i < 4; i++) parts.push(K.mesh(cyl(0.12, 0.12, 2.8, 6), metal, x + Math.cos(i * 1.57) * 1.7, 1.4, z + Math.sin(i * 1.57) * 1.7)); K.colC(x, z, 2.2, 7, parts); }
    // 환기구 파이프 · 네온 광고판 벽 · 빛나는 상자
    for (const [a, R] of [[1.15, 9], [4.0, 9]]) { const [x, z] = pol(a, R); K.cylS(x, z, 0.45, 2.6, metal); }
    const signCols = ['#ff2ad4', '#22e6ff'], signTxt = ['ECLIPSE', '決闘'];
    [[5.6, 13.5], [0.85 + Math.PI, 18.5]].forEach(([a, R], i) => {
      const [x, z] = pol(a, R), w = K.boxS(x, z, 6, 0.5, 3.6, a + Math.PI / 2, dark, { y0: 0 });
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256); g.strokeStyle = signCols[i]; g.lineWidth = 10; g.strokeRect(14, 14, 484, 228); g.fillStyle = signCols[i]; g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(signTxt[i], 256, 132);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3), new THREE.MeshBasicMaterial({ map: tx })); p.position.z = s * 0.27; p.rotation.y = s < 0 ? Math.PI : 0; w.add(p); }
    });
    for (const [a, R, y0] of [[2.3, 8.5, 0], [2.45, 9.3, 0], [2.35, 8.9, 1.1], [5.2, 8.5, 0]]) { const [x, z] = pol(a, R); K.boxS(x, z, 1.1, 1.1, 1.1, a, K.std(0x101018, { emissive: 0x7a5aff, ei: 0.5 }), { y0 }); }
    // 바깥: 빌딩 숲 · 간판 · 차
    const towers = scatter(K, 90, 75, 220, (x, z) => ({ x, z, w: K.r(12, 26), d: K.r(12, 26), h: K.r(50, 150) }));
    K.inst(box(1, 1, 1), bmat, towers.map((b) => ({ x: b.x, z: b.z, y: -90 + b.h / 2, sx: b.w, sy: b.h, sz: b.d })), false);
    const words = ['ECLIPSE', '決闘', 'NEO 7', 'ARENA', '24H', 'RAMEN'], cols4 = ['#ff2ad4', '#22e6ff', '#ffe03a', '#7a5aff'];
    for (let i = 0; i < 14; i++) {
      const b = towers[i * 5], c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'), col = cols4[i % 4];
      g.fillStyle = '#000'; g.fillRect(0, 0, 512, 128); g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112); g.fillStyle = col; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words[i % words.length], 256, 66);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: tx, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const y = Math.min(-90 + b.h - 6, K.r(-20, 30)); p.position.set(b.x * 0.92, y, b.z * 0.92); p.lookAt(0, y, 0); K.add(p);
    }
    for (const [x, z, c] of [[20, 0, 0xff2ad4], [-20, 0, 0x22e6ff], [0, 20, 0x7a5aff], [0, -20, 0x22e6ff]]) K.point(x, 3, z, c, 34, 20);
    const cars = []; for (let i = 0; i < 12; i++) { const m = K.mesh(box(1.6, 0.5, 3.4), K.glow(i % 2 ? 0xff4a6a : 0xfff0c0, 3), 0, 0, 0, false); cars.push({ m, r: K.r(45, 110), y: K.r(-10, 35), sp: K.r(0.05, 0.12) * (i % 2 ? 1 : -1), a: K.r(0, TAU) }); }
    K.updaters.push((dt) => { for (const c of cars) { c.a += c.sp * dt; c.m.position.set(Math.sin(c.a) * c.r, c.y, Math.cos(c.a) * c.r); c.m.rotation.y = c.a + Math.PI / 2; } });
    K.weather({ type: 'rain', count: 1400, color: 0x9ab4ff, area: 35, height: 22 });
  } },

  /* 10 */ { id: 'orbit', name: '궤도 성역', concept: '우주에 뜬 대리석 성역 · 수정 기둥 · 무너진 아치 · 고리 행성', build(K) {
    K.fog(0x0a0518, 0.002);
    K.sky({ top: 0x020108, mid: 0x0a0620, hor: 0x1a0c3a, bot: 0x020108, sun: 'sun', sunDir: [0.7, 0.25, -0.6], sunCol: 0xfff0ff, sunSize: 0.02, stars: 1, starsBelow: true, nebula: 0.6 });
    K.lights({ sky: 0xa090ff, ground: 0x302050, hemi: 1.15, key: 0xfff4ff, keyI: 2.6, fill: 0x60a0ff, fillI: 0.6 });
    K.arena({ style: 'marble', side: 0xb8b4c8, emColor: 0xffffff, ei: 1.3, height: 1, base: false, rough: 0.35 });
    K.mesh(cyl(23.3, 3, 18, 12), K.std(0x3a3448, { flat: true }), 0, -10, 0);
    const marble = K.std(0xd8d4e4, { rough: 0.4 }), crystal = K.std(0x000000, { emissive: 0x9a6aff, ei: 2.2 }), crystal2 = K.std(0x000000, { emissive: 0x4ad8ff, ei: 2.2 });
    // 수정 기둥
    [[0.75, 12], [2.35, 12], [3.9, 12], [5.5, 12]].forEach(([a, R], i) => { const [x, z] = pol(a, R), m = K.cylS(x, z, 0.8, 5.5, i % 2 ? crystal : crystal2, { rTop: 0.2, seg: 6 }); K.bob(m, 0.0, 1); });
    // 무너진 아치 (기둥 두 개 + 반원)
    for (const a of [0, 1.57, 3.14, 4.71]) {
      const [x, z] = pol(a, 17.5), rx = Math.cos(a) * 2.6, rz = -Math.sin(a) * 2.6, broken = a === 3.14;
      K.cylS(x + rx, z + rz, 0.6, 4, marble); K.cylS(x - rx, z - rz, 0.6, broken ? 1.6 : 4, marble);
      if (!broken) { const arch = K.mesh(new THREE.TorusGeometry(2.6, 0.45, 8, 24, Math.PI), marble, x, 4, z); arch.rotation.y = a + Math.PI / 2; }
    }
    // 대리석 블록 계단 · 받침대
    for (const [a, R, w, h] of [[0.35, 8.5, 2, 1], [0.5, 9.5, 2, 2], [3.5, 8.5, 2.4, 1.3], [5.1, 9, 1.8, 0.9], [2.0, 9, 2.6, 1.6]]) { const [x, z] = pol(a, R); K.boxS(x, z, w, w, h, a, marble); }
    { const [x, z] = pol(1.2, 15), p = K.boxS(x, z, 2.2, 2.2, 1.5, 0.3, marble); const st = new THREE.Mesh(new THREE.OctahedronGeometry(1), crystal); st.position.y = 2.2; st.scale.y = 1.8; p.add(st); K.spin(st, 'y', 0.8); }
    // 바깥: 공전하는 수정 · 떠다니는 파편 · 행성
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, m = K.mesh(new THREE.OctahedronGeometry(K.r(0.6, 1.4)), i % 2 ? crystal : crystal2, Math.sin(a) * K.r(4, 14), -K.r(9, 17), Math.cos(a) * K.r(4, 14)); m.scale.y = 2.4; }
    const orb = []; for (let i = 0; i < 12; i++) { const m = K.mesh(new THREE.OctahedronGeometry(K.r(0.7, 1.5)), i % 2 ? crystal : crystal2, 0, 0, 0); m.scale.y = 2; orb.push({ m, r: K.r(27, 34), a: (i / 12) * TAU, y: K.r(2, 9), sp: K.r(0.05, 0.12) }); }
    K.updaters.push((dt, t) => { for (const o of orb) { o.a += o.sp * dt; o.m.position.set(Math.sin(o.a) * o.r, o.y + Math.sin(t + o.a * 3) * 0.6, Math.cos(o.a) * o.r); o.m.rotation.y += dt; } });
    floatingRocks(K, 22, 36, 75, -20, 20, K.std(0xbab6c8, { flat: true }));
    const pm = new THREE.ShaderMaterial({ uniforms: { uSun: { value: K.sunDir } }, vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(mat3(modelMatrix)*normal); vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vP; ${GLSL_NOISE}
        void main(){ float b=fbm(vec2(vP.y*0.05+fbm(vP.xz*0.02)*2.0, 0.5)); vec3 c=mix(vec3(0.75,0.45,0.85),vec3(0.25,0.3,0.75),b); c=mix(c,vec3(0.95,0.8,0.7),smoothstep(0.6,0.75,b));
          float l=max(dot(vN,uSun),0.0)*1.1+0.06; gl_FragColor=vec4(c*l,1.0); }`, fog: false });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(90, 64, 32), pm); planet.position.set(-170, 50, -270); K.add(planet);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(96, 48, 24), new THREE.MeshBasicMaterial({ color: 0x9a7aff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, fog: false }));
    atm.position.copy(planet.position); K.add(atm);
    const ring = new THREE.Mesh(new THREE.RingGeometry(120, 170, 96), new THREE.MeshBasicMaterial({ color: 0xd8c0ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.position.copy(planet.position); ring.rotation.set(1.2, 0.3, 0.2); K.add(ring); K.spin(planet, 'y', 0.01);
    K.weather({ type: 'spark', count: 320, color: 0xbfd8ff, size: 0.09, height: 20 });
  } },
];

export function buildStage(scene, id) {
  const def = MAPS.find((m) => m.id === id) || MAPS[0];
  const K = createKit(scene, def.id.length * 7 + 1); def.build(K); const st = K.finish(); st.def = def; return st;
}
