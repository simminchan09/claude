// 맵 목록. 새 맵은 { id, name, concept, build(K) } 를 MAPS 에 추가하면 선택 화면에 나타난다.
// build 안에서 K.fog()를 먼저 호출한다 (물·용암·구름바다 셰이더가 안개 값을 가져간다).
import * as THREE from 'three';
import { createKit, GLSL_NOISE, raw } from './kit.js';

const TAU = Math.PI * 2;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

/* ---------- 공용 소품 ---------- */
function torii(K, x, z, ry, s, red, blk) {
  const g = new THREE.Group(), H = 13 * s, sx = 7.5 * s, M = (geo, mat, px, py, pz, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.z = rz; m.castShadow = true; g.add(m); };
  for (const k of [-1, 1]) { M(cyl(0.75 * s, 0.85 * s, H, 16), red, k * sx, H / 2 - 1.1, 0); M(cyl(1.05 * s, 1.05 * s, 1.2, 16), blk, k * sx, -0.6, 0); M(box(3 * s, 0.9 * s, 1.6 * s), blk, k * 10.6 * s, H - 0.25 * s, 0, k * 0.22); }
  M(box(20 * s, 1 * s, 1.6 * s), blk, 0, H - 0.6 * s, 0); M(box(18.4 * s, 0.7 * s, 1.3 * s), red, 0, H - 1.4 * s, 0); M(box(17 * s, 0.6 * s, 0.7 * s), red, 0, H - 3.6 * s, 0); M(box(1.4 * s, 2.2 * s, 0.3 * s), blk, 0, H - 2.5 * s, 0.5 * s);
  g.position.set(x, 0, z); g.rotation.y = ry; K.add(g); return g;
}
function stoneLantern(K, x, z, glowCol, stone, lightI = 22) {
  const g = new THREE.Group(), glow = K.glow(glowCol, 3), M = (geo, mat, y, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.y = ry; m.castShadow = true; g.add(m); };
  M(cyl(0.5, 0.7, 0.4, 8), stone, 0.2); M(cyl(0.16, 0.2, 1.3, 8), stone, 1.05); M(box(0.8, 0.12, 0.8), stone, 1.75); M(box(0.55, 0.5, 0.55), glow, 2.05); M(cone(0.75, 0.5, 4), stone, 2.55, Math.PI / 4);
  g.position.set(x, 0, z); K.add(g); if (lightI) K.point(x, 2.05, z, glowCol, lightI, 16, 1);
}
function floatingRocks(K, n, rMin, rMax, yMin, yMax, mat) {
  for (let i = 0; i < n; i++) { const [x, z] = K.around(rMin, rMax), m = K.mesh(new THREE.DodecahedronGeometry(K.r(0.8, 3.2), 0), mat, x, K.r(yMin, yMax), z); m.rotation.set(K.r(0, 3), K.r(0, 3), K.r(0, 3)); K.bob(m, 0.6, K.r(0.2, 0.6)); K.spin(m, 'y', 0.05); }
}
function scatter(K, n, rMin, rMax, fn, avoid) { const out = []; for (let i = 0; i < n; i++) { const [x, z, a] = K.around(rMin, rMax, avoid); out.push(fn(x, z, a, i)); } return out; }

export const MAPS = [
  /* 1 */ { id: 'eclipse', name: '일식의 신전', concept: '호수 위 석조 결투장 · 일식의 밤', build(K) {
    K.fog(0x241226, 0.0085);
    K.sky({ top: 0x030208, mid: 0x13081f, hor: 0x5c1a26, bot: 0x050306, sun: 'eclipse', sunDir: [0.28, 0.3, -1], sunCol: 0xff9e6b, sunSize: 0.07, stars: 0.8 });
    K.lights({ sky: 0x8a74c0, ground: 0x2a1018, hemi: 1.25, key: 0xffbe96, keyI: 2.6, fill: 0x6f86ff, fillI: 0.7 });
    K.water({ y: -1.1, deep: 0x07050e, shallow: 0x1c1030, skyC: 0x5c1a26, amp: 0.12, spec: 1.4 });
    K.arena({ style: 'stone', curb: 0x4a3f52, runes: 0xffa070 });
    const stone = K.std(0x3a3341), cap = K.std(0x2a2430);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.11; if (Math.abs(Math.abs(a - Math.PI)) < 0.35) continue;
      const R = 26 + K.r(0, 1.5), broken = K.rand() < 0.35, h = broken ? K.r(3, 8) : K.r(10, 13), x = Math.sin(a) * R, z = Math.cos(a) * R;
      K.mesh(cyl(0.75, 0.9, h, 14), stone, x, h / 2 - 1.1, z); K.mesh(box(2.3, 0.6, 2.3), cap, x, -0.9, z);
      if (!broken) K.mesh(box(2.1, 0.5, 2.1), cap, x, h - 0.85, z); else { const c = K.mesh(cyl(0.75, 0.75, 2.2, 14), stone, x + K.r(-2, 2), -0.6, z + K.r(-2, 2)); c.rotation.set(Math.PI / 2, K.r(0, TAU), 0.3); }
      if (i % 3 === 1) stoneLantern(K, Math.sin(a) * (R - 3.2), Math.cos(a) * (R - 3.2), 0xff9a4a, cap);
    }
    torii(K, 0, -34, 0, 1, K.std(0x4a0d12, { rough: 0.65 }), K.std(0x120a0e, { rough: 0.6 }));
    K.mesh(cyl(11, 12, 1, 6), stone, 0, -1.1, -34);
    K.mountains({ color: 0x1c1228, count: 46 });
    floatingRocks(K, 16, 32, 58, 4, 18, K.std(0x3a3142, { flat: true }));
    K.weather({ type: 'ember', count: 500, color: 0xff9a5a, size: 0.09 });
  } },

  /* 2 */ { id: 'desert', name: '붉은 모래 협곡', concept: '사막 · 메사 절벽 · 한낮의 태양', build(K) {
    K.fog(0xdcb88c, 0.0062);
    K.sky({ top: 0x2d5fa8, mid: 0x7fb0de, hor: 0xf3d2a0, sun: 'sun', sunDir: [0.5, 0.55, -0.7], sunCol: 0xfff1c8, sunSize: 0.035, clouds: 0.25, cloudCol: 0xfff2e0 });
    K.lights({ sky: 0xbcd4f0, ground: 0x8a5a30, hemi: 1.4, key: 0xfff0d0, keyI: 3.2 });
    K.ground({ color: 0xc8975a, color2: 0xe2b97a, hills: 5, dunes: 2.2, freq: 0.02, flatR: 20 });
    K.arena({ style: 'sand', side: 0x9a6a3a, curb: 0x7a4a22, height: 0.7 });
    K.mountains({ shape: 'mesa', color: 0xa8542e, band: 0xe0904a, count: 34, rMin: 110, rMax: 240, hMin: 30, hMax: 75, wMin: 20, wMax: 40, y: -2 });
    const sand = K.std(0xc9925a), gold = K.std(0xd8a838, { metal: 0.8, rough: 0.3 });
    for (let i = 0; i < 6; i++) { // 오벨리스크
      const a = (i / 6) * TAU + 0.3, x = Math.sin(a) * 21, z = Math.cos(a) * 21;
      if (i === 2) { const o = K.mesh(cyl(0.45, 0.9, 9, 4), sand, x, 0.5, z); o.rotation.set(0, Math.PI / 4, Math.PI / 2.2); continue; }
      const o = K.mesh(cyl(0.45, 0.9, 9, 4), sand, x, 4.5, z); o.rotation.y = Math.PI / 4; K.mesh(cone(0.65, 1.2, 4), gold, x, 9.6, z).rotation.y = Math.PI / 4;
      K.mesh(box(2.2, 0.6, 2.2), K.std(0xa87444), x, 0.3, z);
    }
    const cact = K.std(0x4a7a3a), pts = scatter(K, 26, 26, 70, (x, z) => ({ x, z, s: K.r(0.8, 1.3), ry: K.r(0, TAU) }));
    K.inst(cyl(0.32, 0.38, 4.2, 8), cact, pts.map((p) => ({ ...p, y: 2.1 * p.s })));
    K.inst(cyl(0.22, 0.25, 1.6, 8), cact, pts.flatMap((p) => [{ x: p.x + 0.55 * p.s * Math.cos(p.ry), z: p.z + 0.55 * p.s * Math.sin(p.ry), y: 2.6 * p.s, s: p.s }, { x: p.x - 0.5 * p.s * Math.cos(p.ry), z: p.z - 0.5 * p.s * Math.sin(p.ry), y: 2.1 * p.s, s: p.s * 0.8 }]));
    K.inst(new THREE.DodecahedronGeometry(1, 0), K.std(0xb06a3c, { flat: true }), scatter(K, 40, 20, 90, (x, z) => ({ x, z, y: 0, s: K.r(0.5, 2.4), ry: K.r(0, 3), rx: K.r(0, 3) })));
    K.weather({ type: 'sand', count: 700, color: 0xe8c890, size: 0.07, height: 6, wind: [1, 0.3], opacity: 0.6 });
  } },

  /* 3 */ { id: 'snow', name: '빙설 요새', concept: '설원 · 얼음 결정 · 오로라의 밤', build(K) {
    K.fog(0x15233c, 0.011);
    K.sky({ top: 0x02040c, mid: 0x0a1a33, hor: 0x2d4a6a, sun: 'moon', sunDir: [-0.4, 0.45, -0.8], sunCol: 0xdfe8ff, sunSize: 0.045, stars: 0.9, aurora: 1 });
    K.lights({ sky: 0x7a9ad0, ground: 0x30405a, hemi: 1.3, key: 0xbcd0ff, keyI: 1.9, fill: 0x4060a0, fillI: 0.5 });
    K.ground({ color: 0xdfe8f2, color2: 0xb8c8de, hills: 7, freq: 0.025, flatR: 19 });
    K.arena({ style: 'snow', raised: false, runes: 0x7ad0ff, runeOpacity: 0.35 });
    const ice = K.std(0x9fdcff, { rough: 0.15, metal: 0.1, opacity: 0.8, emissive: 0x2a7ac0, ei: 0.7 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, R = K.r(18.5, 21), h = K.r(3, 8), m = K.mesh(cyl(0.35, 0.8, h, 6), ice, Math.sin(a) * R, h / 2 - 0.3, Math.cos(a) * R); m.rotation.set(K.r(-0.25, 0.25), K.r(0, 3), K.r(-0.25, 0.25)); }
    const trees = scatter(K, 170, 26, 95, (x, z) => ({ x, z, s: K.r(0.8, 1.6), ry: K.r(0, TAU) }));
    K.inst(cyl(0.18, 0.25, 2, 6), K.std(0x3a2a20), trees.map((p) => ({ ...p, y: 1 * p.s })));
    [[3.2, 3.6, 2.6], [2.5, 3, 4.2], [1.7, 2.4, 5.6]].forEach(([r, h, y]) => {
      K.inst(cone(r, h, 8), K.std(0x1f3a2c, { flat: true }), trees.map((p) => ({ ...p, y: y * p.s })));
      K.inst(cone(r * 0.6, h * 0.45, 8), K.std(0xf2f6ff, { flat: true }), trees.map((p) => ({ ...p, y: (y + h * 0.32) * p.s })));
    });
    const wall = K.std(0x8a96a8, { flat: true }), snowTop = K.std(0xf4f8ff);
    for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3, x = Math.sin(a + Math.PI) * 34, z = Math.cos(a + Math.PI) * 34, w = K.mesh(box(9, K.r(4, 8), 2.4), wall, x, 2, z); w.rotation.y = a; }
    for (const a of [-1.05, 1.05]) { const x = Math.sin(a + Math.PI) * 34, z = Math.cos(a + Math.PI) * 34; K.mesh(cyl(3, 3.4, 13, 10), wall, x, 6, z); K.mesh(cone(3.8, 4.5, 10), snowTop, x, 14.7, z); }
    for (const [x, z] of [[-12, 13], [12, 13]]) { K.mesh(cyl(0.6, 0.4, 1, 10), K.std(0x3a3a44, { metal: 0.6 }), x, 0.5, z); K.point(x, 1.5, z, 0xff8a3a, 26, 14, 1); }
    K.mountains({ color: 0x3a4a64, snow: true, count: 40, hMin: 40, hMax: 110 });
    K.weather({ type: 'snow', count: 1000, color: 0xffffff, size: 0.09, wind: [0.5, 0.2] });
  } },

  /* 4 */ { id: 'plains', name: '바람의 평원', concept: '초원 · 거석 원형 유적 · 맑은 하늘', build(K) {
    K.fog(0xc6dcef, 0.0045);
    K.sky({ top: 0x2a68cf, mid: 0x6aa6ea, hor: 0xd8ecf8, sun: 'sun', sunDir: [-0.3, 0.7, -0.5], sunCol: 0xfffbe8, sunSize: 0.03, clouds: 0.75 });
    K.lights({ sky: 0xcfe4ff, ground: 0x4a6a2a, hemi: 1.5, key: 0xfff4e0, keyI: 3 });
    K.ground({ color: 0x4f7d32, color2: 0x86a848, hills: 9, freq: 0.018, flatR: 20 });
    K.arena({ style: 'grass', raised: false });
    const stone = K.std(0x8a8a86, { flat: true });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, h = K.r(3.2, 4.2), m = K.mesh(box(1.3, h, 0.8), stone, Math.sin(a) * 19.5, h / 2 - 0.2, Math.cos(a) * 19.5); m.rotation.y = a; m.rotation.z = K.r(-0.05, 0.05);
      if (i % 2 === 0) { const b = (i + 0.5) / 14 * TAU, l = K.mesh(box(1.1, 0.7, 4.8), stone, Math.sin(b) * 19.5, h + 0.1, Math.cos(b) * 19.5); l.rotation.y = b; } }
    K.inst(cone(0.12, 0.55, 4), K.std(0x5f9a38), scatter(K, 1800, 17.5, 70, (x, z) => ({ x, z, y: 0.2, s: K.r(0.6, 1.4), ry: K.r(0, 3) })), false);
    const trees = scatter(K, 70, 32, 140, (x, z) => ({ x, z, s: K.r(1, 1.8), ry: K.r(0, TAU) }));
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

  /* 5 */ { id: 'ocean', name: '노을빛 해상', concept: '바다 · 목조 갑판 · 등대와 난파선', build(K) {
    K.fog(0xd88a70, 0.006);
    K.sky({ top: 0x1c2a5a, mid: 0x6a4a8a, hor: 0xffa86a, sun: 'sun', sunDir: [0.15, 0.07, -1], sunCol: 0xffc890, sunSize: 0.05, clouds: 0.45, cloudCol: 0xffb0a0 });
    K.lights({ sky: 0x9a8ac0, ground: 0x203040, hemi: 1.25, key: 0xffb488, keyI: 2.6, keyDir: [0.3, 0.5, -1], fill: 0x5070c0, fillI: 0.6 });
    K.water({ y: -1.7, deep: 0x0a1a3a, shallow: 0x2a5a8a, skyC: 0xffa070, amp: 0.7, spec: 2.4 });
    K.arena({ style: 'wood', side: 0x4a2e1a, curb: 0x2a1a10, height: 0.6, base: false });
    const wood = K.std(0x3a2414), rope = K.std(0xc8b088);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; K.mesh(cyl(0.35, 0.35, 7, 8), wood, Math.sin(a) * 16, -3.8, Math.cos(a) * 16); K.mesh(cyl(0.12, 0.12, 1.2, 6), wood, Math.sin(a) * 16.8, 0.6, Math.cos(a) * 16.8); }
    const rail = new THREE.Mesh(new THREE.TorusGeometry(16.8, 0.06, 6, 96), rope); rail.rotation.x = Math.PI / 2; rail.position.y = 1.05; K.add(rail);
    const ship = new THREE.Group(); ship.position.set(-34, -1.2, -24); ship.rotation.set(0.12, 0.6, 0.18); K.add(ship);
    const hull = new THREE.Mesh(cyl(3.2, 2, 22, 8, 1), K.std(0x2a1a10)); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.55); hull.castShadow = true; ship.add(hull);
    const mast = new THREE.Mesh(cyl(0.3, 0.4, 18, 8), wood); mast.position.y = 9; mast.rotation.z = 0.25; ship.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(8, 7, 6, 6), K.std(0xe8dcc0, { rough: 1 })); sail.material.side = THREE.DoubleSide; sail.position.set(1.5, 10, 0.4); sail.rotation.set(0, 0.3, 0.25); ship.add(sail);
    const rocks = K.std(0x2a2830, { flat: true });
    for (let i = 0; i < 6; i++) K.mesh(new THREE.DodecahedronGeometry(K.r(3, 7), 0), rocks, 40 + K.r(-6, 6), -2, -48 + K.r(-6, 6)).rotation.set(K.r(0, 3), K.r(0, 3), 0);
    const lh = new THREE.Group(); lh.position.set(40, 2, -48); K.add(lh);
    [[0xf2ece0, 0], [0xb8302a, 4], [0xf2ece0, 8], [0xb8302a, 12]].forEach(([c, y]) => { const s = new THREE.Mesh(cyl(1.6 - y * 0.05, 1.8 - y * 0.05, 4, 16), K.std(c)); s.position.y = y + 2; s.castShadow = true; lh.add(s); });
    const lamp = new THREE.Mesh(cyl(1.1, 1.1, 1.6, 12), K.glow(0xffe8a0, 4)); lamp.position.y = 16.8; lh.add(lamp);
    const cap = new THREE.Mesh(cone(1.6, 1.8, 12), K.std(0x2a2a2a)); cap.position.y = 18.5; lh.add(cap);
    const beamG = cone(4, 40, 24, true); beamG.translate(0, -20, 0); beamG.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const bh = new THREE.Group(); bh.position.y = 16.8; bh.add(beam); lh.add(bh); K.spin(bh, 'y', 0.7);
    K.weather({ type: 'spray', count: 220, color: 0xffffff, size: 0.08, height: 4, opacity: 0.55 });
  } },

  /* 6 */ { id: 'volcano', name: '용암 분화구', concept: '화산 · 용암의 바다 · 현무암 기둥', build(K) {
    K.fog(0x2a0c06, 0.012);
    K.sky({ top: 0x080202, mid: 0x2a0806, hor: 0x8a2a12, sun: 'none', clouds: 0.7, cloudCol: 0x3a1a14 });
    K.lights({ sky: 0x7a3a2a, ground: 0xff5a1a, hemi: 1.25, key: 0xffa070, keyI: 1.8, keyDir: [0.2, 1, 0.3], fill: 0xff4010, fillI: 0.7 });
    K.lava({ y: -1.5 });
    K.arena({ style: 'obsidian', shape: 'hex', side: 0x16101a, ei: 0.9, height: 1.2 });
    const basalt = K.std(0x1c1820, { flat: true, rough: 0.7 });
    K.inst(cyl(1, 1, 1, 6), basalt, scatter(K, 70, 18.5, 32, (x, z) => { const h = K.r(1, 6); return { x, z, y: h / 2 - 1.5, sx: K.r(0.8, 1.3), sz: K.r(0.8, 1.3), sy: h, ry: K.r(0, 1) }; }));
    K.inst(cone(1, 1, 5), K.std(0x0a0a0e, { metal: 0.4, rough: 0.2 }), scatter(K, 40, 22, 60, (x, z) => { const h = K.r(3, 9); return { x, z, y: h / 2 - 1.5, sx: K.r(0.6, 1.4), sz: K.r(0.6, 1.4), sy: h, rx: K.r(-0.3, 0.3), rz: K.r(-0.3, 0.3) }; }));
    const vol = K.mesh(cone(80, 70, 18, true), K.std(0x1e1416, { flat: true }), 0, 30, -150); vol.scale.set(1, 1, 0.8);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(15, 24), K.glow(0xff5a10, 3)); crater.rotation.x = -Math.PI / 2; crater.position.set(0, 58, -150); K.add(crater);
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3, f = K.mesh(box(2.2, 60, 0.6), K.glow(0xff6a1a, 2.5), Math.sin(a) * 24, 30, -150 + Math.cos(a) * 24 * 0.8 + 18); f.rotation.set(-0.85, a, 0); }
    K.mountains({ color: 0x1a1012, count: 30, rMin: 170, rMax: 280 });
    for (const [x, z] of [[18, 0], [-18, 0], [0, 18], [0, -18]]) K.point(x, -0.5, z, 0xff5a1a, 60, 22, 1);
    K.weather({ type: 'ember', count: 700, color: 0xff7a2a, size: 0.1 }); K.weather({ type: 'ash', count: 400, color: 0x5a5a5a, size: 0.08, wind: [0.4, 0] });
  } },

  /* 7 */ { id: 'peak', name: '천봉 정상', concept: '산악 · 구름 바다 위 봉우리 · 새벽', build(K) {
    K.fog(0xd9c4d8, 0.0035);
    K.sky({ top: 0x0c1a48, mid: 0x3a5aa8, hor: 0xffc6a8, sun: 'sun', sunDir: [-0.6, 0.12, -0.8], sunCol: 0xffd7b0, sunSize: 0.045, clouds: 0.2 });
    K.lights({ sky: 0xa8b8ff, ground: 0x6a5a70, hemi: 1.35, key: 0xffd0b0, keyI: 2.8, keyDir: [-0.6, 0.45, -0.8] });
    K.cloudSea({ y: -16, color: 0xffeaea, shade: 0x9a8ab8 });
    K.arena({ style: 'rock', side: 0x4a4a52, height: 1.2 });
    K.mesh(cyl(18.5, 5, 34, 10), K.std(0x44444e, { flat: true }), 0, -18.4, 0);
    K.mountains({ shape: 'spire', color: 0x4a4a58, snow: true, rMin: 70, rMax: 220, hMin: 50, hMax: 120, wMin: 14, wMax: 22, y: -34, count: 34 });
    const pole = K.std(0x5a4030), cols = [0x2a6ad8, 0xf2f2f2, 0xd8302a, 0x3aa84a, 0xf2c21a];
    const poles = [0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * TAU + 0.4, x = Math.sin(a) * 18.2, z = Math.cos(a) * 18.2; K.mesh(cyl(0.1, 0.12, 5, 6), pole, x, 2.5, z); return [x, z]; });
    cols.forEach((c, ci) => {
      const list = [];
      poles.forEach(([x0, z0], i) => { const [x1, z1] = poles[(i + 1) % 6]; for (let k = 1; k < 16; k++) if (k % 5 === ci) { const t = k / 16, sag = Math.sin(t * Math.PI) * 1.4; list.push({ x: x0 + (x1 - x0) * t, y: 4.6 - sag - 0.25, z: z0 + (z1 - z0) * t, ry: Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2 }); } });
      K.inst(box(0.5, 0.5, 0.02), K.std(c, { rough: 1 }), list, false);
    });
    const cairn = K.std(0x7a7a84, { flat: true });
    for (let i = 0; i < 5; i++) { const [x, z] = K.around(15.8, 16.5); for (let k = 0; k < 4; k++) K.mesh(new THREE.DodecahedronGeometry(0.45 - k * 0.08, 0), cairn, x, 0.3 + k * 0.55, z); }
    K.weather({ type: 'wind', count: 260, color: 0xffffff, size: 0.06, height: 8, wind: [1, 0.25], opacity: 0.5 });
  } },

  /* 8 */ { id: 'bamboo', name: '죽림 사당', concept: '대나무 숲 · 반딧불 · 달밤', build(K) {
    K.fog(0x0c1a14, 0.026);
    K.sky({ top: 0x020604, mid: 0x081812, hor: 0x2a4a3a, sun: 'moon', sunDir: [0.3, 0.55, -0.7], sunCol: 0xf2f4e0, sunSize: 0.06, stars: 0.6 });
    K.lights({ sky: 0x6a9a80, ground: 0x1a2a1a, hemi: 1.15, key: 0xd8e8ff, keyI: 1.7, fill: 0x4a8a6a, fillI: 0.4 });
    K.ground({ color: 0x1e2a18, color2: 0x34452a, hills: 3, flatR: 19 });
    K.arena({ style: 'moss', raised: false });
    const stalks = scatter(K, 460, 19.5, 62, (x, z) => ({ x, z, s: K.r(0.8, 1.25), h: K.r(10, 16) }), [Math.PI, 0.32]);
    K.inst(cyl(0.09, 0.11, 1, 7), K.std(0x6a8a3a, { rough: 0.5 }), stalks.map((p) => ({ x: p.x, z: p.z, y: p.h / 2, sx: p.s, sz: p.s, sy: p.h, rx: K.r(-0.06, 0.06), rz: K.r(-0.06, 0.06) })));
    K.inst(cyl(0.125, 0.125, 0.08, 7), K.std(0x4a6a2a), stalks.flatMap((p) => [0.25, 0.5, 0.75].map((t) => ({ x: p.x, z: p.z, y: p.h * t, s: p.s }))), false);
    K.inst(new THREE.IcosahedronGeometry(1.2, 0), K.std(0x22401e, { flat: true }), stalks.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.x + K.r(-0.6, 0.6), z: p.z + K.r(-0.6, 0.6), y: p.h - K.r(0, 2), sx: K.r(1, 2), sy: 0.5, sz: K.r(1, 2) })));
    const sh = new THREE.Group(); sh.position.set(0, 0, -25); K.add(sh);
    const red = K.std(0x7a1a14), dark = K.std(0x1a1414), M = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; sh.add(m); return m; };
    M(box(8, 0.8, 6), K.std(0x4a4a44), 0, 0.4, 0); for (const [x, z] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) M(cyl(0.22, 0.22, 4, 8), red, x, 2.8, z);
    M(box(9, 0.5, 7), dark, 0, 4.9, 0); M(cone(6, 2.4, 4), dark, 0, 6.3, 0).rotation.y = Math.PI / 4;
    K.point(0, 3, -22, 0xff6a3a, 18, 14, 1);
    torii(K, 0, -17.8, 0, 0.45, red, dark);
    const st = K.std(0x4a4e48); for (const a of [0.8, 2.3, 3.9, 5.4]) stoneLantern(K, Math.sin(a) * 17.6, Math.cos(a) * 17.6, 0xffb060, st, 14);
    K.weather({ type: 'firefly', count: 240, color: 0xc8ff6a, size: 0.13, area: 30, height: 5 });
  } },

  /* 9 */ { id: 'neon', name: '네온 시티 옥상', concept: '도시 · 마천루 옥상 헬리패드 · 비 내리는 밤', build(K) {
    K.fog(0x140a26, 0.0095);
    K.sky({ top: 0x040210, mid: 0x150a30, hor: 0x5a1a5a, sun: 'none', stars: 0.15, clouds: 0.5, cloudCol: 0x2a1440 });
    K.lights({ sky: 0x6a4ab0, ground: 0x200a30, hemi: 1.15, key: 0xb0a0ff, keyI: 1.4, keyDir: [0.3, 1, 0.4], fill: 0xff3ad0, fillI: 0.55 });
    K.arena({ style: 'neon', shape: 'oct', side: 0x1a1c26, height: 1, ei: 2.2, rough: 0.35, metal: 0.6, base: false });
    const roof = K.std(0x1a1a22, { rough: 0.5, metal: 0.4 }), metal = K.std(0x2a2c36, { metal: 0.7, rough: 0.4 });
    K.mesh(box(48, 1, 48), roof, 0, -1.6, 0);
    const winA = K.windowTexture(1, ['#ffd28a', '#9ad8ff', '#ffffff']), bmat = new THREE.MeshStandardMaterial({ color: 0x14141c, emissive: 0xffffff, emissiveMap: winA, emissiveIntensity: 1.3, roughness: 0.6, metalness: 0.4 });
    winA.repeat.set(2, 6);
    K.mesh(box(48, 100, 48), bmat, 0, -52, 0, false);
    for (const [x, z, w, h, d] of [[19, 19, 4, 2.4, 3], [-20, 18, 6, 1.6, 4], [20, -19, 3, 3, 3]]) K.mesh(box(w, h, d), metal, x, h / 2 - 1.1, z);
    const tank = K.mesh(cyl(2.2, 2.2, 4, 16), metal, -19, 3.5, -19); K.mesh(cone(2.4, 1.4, 16), metal, -19, 6.2, -19);
    for (let i = 0; i < 4; i++) K.mesh(cyl(0.12, 0.12, 6, 6), metal, -19 + Math.cos(i * 1.57) * 1.8, -0.1, -19 + Math.sin(i * 1.57) * 1.8);
    K.mesh(cyl(0.08, 0.15, 14, 6), metal, 21, 6, -21); const tip = K.mesh(new THREE.SphereGeometry(0.3, 8, 6), K.glow(0xff2040, 4), 21, 13.2, -21);
    K.updaters.push((dt, t) => { tip.visible = Math.sin(t * 4) > 0; });
    const towers = scatter(K, 90, 70, 220, (x, z) => ({ x, z, w: K.r(12, 26), d: K.r(12, 26), h: K.r(50, 150) }));
    K.inst(box(1, 1, 1), bmat, towers.map((b) => ({ x: b.x, z: b.z, y: -90 + b.h / 2, sx: b.w, sy: b.h, sz: b.d })), false);
    const signCols = ['#ff2ad4', '#22e6ff', '#ffe03a', '#7a5aff'], words = ['ECLIPSE', '決闘', 'NEO 7', 'ARENA', '24H', 'RAMEN'];
    for (let i = 0; i < 14; i++) {
      const b = towers[i * 5], c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'), col = signCols[i % 4];
      g.fillStyle = '#000'; g.fillRect(0, 0, 512, 128); g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112); g.fillStyle = col; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words[i % words.length], 256, 66);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: tx, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const y = Math.min(-90 + b.h - 6, K.r(-20, 30)); p.position.set(b.x * 0.92, y, b.z * 0.92); p.lookAt(0, y, 0); K.add(p);
    }
    for (const [x, z, c] of [[16, 16, 0xff2ad4], [-16, -16, 0x22e6ff], [-16, 16, 0x7a5aff], [16, -16, 0x22e6ff]]) K.point(x, 2.5, z, c, 30, 18);
    const cars = []; for (let i = 0; i < 12; i++) { const m = K.mesh(box(1.6, 0.5, 3.4), K.glow(i % 2 ? 0xff4a6a : 0xfff0c0, 3), 0, 0, 0, false); cars.push({ m, r: K.r(40, 110), y: K.r(-10, 35), sp: K.r(0.05, 0.12) * (i % 2 ? 1 : -1), a: K.r(0, TAU) }); }
    K.updaters.push((dt) => { for (const c of cars) { c.a += c.sp * dt; c.m.position.set(Math.sin(c.a) * c.r, c.y, Math.cos(c.a) * c.r); c.m.rotation.y = c.a + Math.PI / 2; } });
    K.weather({ type: 'rain', count: 1400, color: 0x9ab4ff, area: 35, height: 22 });
  } },

  /* 10 */ { id: 'orbit', name: '궤도 성역', concept: '우주 · 떠 있는 대리석 성역 · 거대 행성', build(K) {
    K.fog(0x0a0518, 0.002);
    K.sky({ top: 0x020108, mid: 0x0a0620, hor: 0x1a0c3a, bot: 0x020108, sun: 'sun', sunDir: [0.7, 0.25, -0.6], sunCol: 0xfff0ff, sunSize: 0.02, stars: 1, starsBelow: true, nebula: 0.6 });
    K.lights({ sky: 0xa090ff, ground: 0x302050, hemi: 1.15, key: 0xfff4ff, keyI: 2.6, fill: 0x60a0ff, fillI: 0.6 });
    K.arena({ style: 'marble', side: 0xb8b4c8, emColor: 0xffffff, ei: 1.3, height: 1, base: false, rough: 0.35 });
    K.mesh(cyl(17.3, 2, 16, 12), K.std(0x3a3448, { flat: true }), 0, -9, 0);
    const crystal = K.std(0x000000, { emissive: 0x9a6aff, ei: 2.2 }), crystal2 = K.std(0x000000, { emissive: 0x4ad8ff, ei: 2.2 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, m = K.mesh(new THREE.OctahedronGeometry(K.r(0.6, 1.4)), i % 2 ? crystal : crystal2, Math.sin(a) * K.r(4, 12), -K.r(9, 17), Math.cos(a) * K.r(4, 12)); m.scale.y = 2.4; }
    const orb = []; for (let i = 0; i < 12; i++) { const m = K.mesh(new THREE.OctahedronGeometry(K.r(0.7, 1.5)), i % 2 ? crystal : crystal2, 0, 0, 0); m.scale.y = 2; orb.push({ m, r: K.r(21, 28), a: (i / 12) * TAU, y: K.r(2, 9), sp: K.r(0.05, 0.12) }); }
    K.updaters.push((dt, t) => { for (const o of orb) { o.a += o.sp * dt; o.m.position.set(Math.sin(o.a) * o.r, o.y + Math.sin(t + o.a * 3) * 0.6, Math.cos(o.a) * o.r); o.m.rotation.y += dt; } });
    const marble = K.std(0xd8d4e4, { rough: 0.4 });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4, arch = K.mesh(new THREE.TorusGeometry(4, 0.45, 8, 24, i === 2 ? Math.PI * 0.6 : Math.PI), marble, Math.sin(a) * 20, -0.5, Math.cos(a) * 20); arch.rotation.y = a + Math.PI / 2; }
    floatingRocks(K, 22, 30, 70, -20, 20, K.std(0xbab6c8, { flat: true }));
    // 행성 + 대기 + 고리
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
  const K = createKit(scene, def.id.length * 7 + 1); def.build(K); return K.finish();
}
export { raw };
