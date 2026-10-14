// 노을빛 해상 몬스터 공용 도구: 텍스처 캔버스 · 재질 · 메시 붙이기 · 금테 관 · 물리(로프/천) 관리
import * as THREE from 'three';
import { Cloth, Rope, RopeTube, RopeChain } from '../../cloth.js';
import { strand, cached, loftRing } from '../../sculpt.js';

export const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const C = (k, fn) => cached('ocean:' + k, fn);
export function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, rep = [1, 1], srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); return t; }
export function rng(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const _tex = {};
export const T = (k, f) => _tex[k] || (_tex[k] = f());
const _mat = {};
// 같은 몬스터가 여럿 나와도 재질은 한 번만 (잡몹용)
export const shared = (k, f) => _mat[k] || (_mat[k] = f());
export const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
export const phys = (o) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o });

// 메시 붙이기: add(부모, 지오메트리, 재질, 위치, 회전, 크기)
export function add(parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const me = new THREE.Mesh(geo, mat); me.position.set(p[0], p[1], p[2]); me.rotation.set(r[0], r[1], r[2]);
  if (typeof s === 'number') me.scale.setScalar(s); else me.scale.set(s[0], s[1], s[2]);
  me.castShadow = !mat.transparent; me.receiveShadow = true; parent.add(me); return me;
}
// 점들을 잇는 관 (금테 · 끈)
export const rim = (parent, key, pts, r, closed, mat) => add(parent, C(key, () => strand(pts, r, r, { closed, seg: Math.min(160, Math.max(20, pts.length * 2)), rad: 6 })), mat);
export const lRim = (parent, key, prof, v, r, mat, o = {}) => rim(parent, key, loftRing(prof, v, { n: 48, ...o }), r, !(o.a1 - (o.a0 ?? 0) < 0.999), mat);

// 세로 그라데이션 캔버스 (위 → 아래)
export function gradTex(stops, w = 32, h = 256) { const [c, g] = cv(w, h), gr = g.createLinearGradient(0, 0, 0, h); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); g.fillStyle = gr; g.fillRect(0, 0, w, h); return tex(c); }
// 높이 캔버스 → 노멀맵 (sculpt.heightToNormal 와 같지만 반복 · 세기 조절)
export function normalFrom(hc, strength = 2.5, rep = [1, 1]) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, g] = cv(w, h), out = g.createImageData(w, h), d = out.data, H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y - 1) - H(x, y + 1)) * strength, l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (-dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  g.putImageData(out, 0, 0); return tex(c, rep, false);
}

/* =====================================================================
   물리 부품 관리: 로프(붕대 · 꼬리 · 리본) · 천(망토). 몬스터는 몸 크기 배율(scale)이 있으므로 길이를 곱한다.
   r = { n, seg, joint, local, rest(몸 기준 방향), mat, prof(v), flat, side, caps: 'body'|'legs'|'none' }
   c = { W, H, len, mat, anchor(cl, f) → cl.anchors 채우기, caps(f) }
   ===================================================================== */
export function physRig(m, scale = 1) {
  const extras = []; m.ropes = []; m.cloths = []; m.extras = extras;
  m.addRope = (o) => {
    const rope = new Rope(o.n, o.seg * scale, { damp: o.damp ?? 0.978, stiff: o.stiff ?? 0.1 });
    const view = o.chain ? new RopeChain(rope, o.linkGeo, o.mat, o.end) : new RopeTube(rope, o.mat, { sub: o.sub ?? 2, rad: o.rad ?? 6, flat: o.flat ?? 1, side: o.side, prof: (v) => o.prof(v) * scale, uvV: o.uvV });
    const r = { rope, view, joint: o.joint, local: o.local, rest: o.rest.clone().normalize(), sideL: o.side ? o.side.clone() : null, caps: o.caps || 'body', end: o.end || null, mesh: o.chain ? view.im : view.mesh, grav: o.grav };
    m.ropes.push(r); return r;
  };
  m.addCloth = (o) => { const c = { ...o, cl: null }; m.cloths.push(c); return c; };
  m.attachScene = (scene) => {
    if (m._att) return; m._att = true;
    for (const c of m.cloths) { c.cl = new Cloth(scene, c.W, c.H, c.len * scale, c.mat); c.cl.mesh.castShadow = !c.mat.transparent; extras.push(c.cl.mesh); }
    for (const r of m.ropes) { scene.add(r.mesh); extras.push(r.mesh); if (r.end) { scene.add(r.end); extras.push(r.end); } }
    for (const o of m.worldObjs || []) { scene.add(o); extras.push(o); }
  };
  m.dispose = (scene) => {
    for (const o of extras) scene.remove(o);
    for (const c of m.cloths) if (c.cl) { c.cl.mesh.geometry.dispose(); c.cl = null; }
    for (const r of m.ropes) if (r.view.mesh) r.view.mesh.geometry.dispose();
    extras.length = 0; m._att = false;
  };
  m.resetCloth = () => { for (const c of m.cloths) if (c.cl) c.cl.ok = false; for (const r of m.ropes) r.rope.ok = false; };
  const tA = new V3(), rq = new THREE.Quaternion(), hq = new THREE.Quaternion();
  // 매 프레임: 몸 캡슐 기준 충돌 · 이동 반대 방향 바람
  m.stepPhys = (dt, f, o = {}) => {
    const vis = f.root.visible, sc = f.scale;
    const legs = f.hurt.slice(6).map((c) => ({ a: c.a, b: c.b, r: c.r + 0.03 * sc })), h0 = f.hurt[0];
    const torso = { a: h0.a, b: h0.b.clone().lerp(h0.a, 0.2), r: h0.r * 0.8 + 0.03 * sc };
    const head = f.hurt[1], body = [torso, { a: head.a.clone().lerp(head.b, 0.5), b: head.a.clone().lerp(head.b, 0.5), r: head.r * 0.9 }, ...legs, ...(o.extraCaps || [])];
    const floor = f.pos.y + 0.02, windV = new V3(-f.vel.x * 0.7 + (o.wind ? o.wind[0] : 0), 0, -f.vel.z * 0.7 + (o.wind ? o.wind[2] : 0));
    m.root.getWorldQuaternion(rq);
    for (const r of m.ropes) {
      if (r.skip) { r.mesh.visible = false; continue; }
      r.joint.updateMatrixWorld(true); r.joint.localToWorld(tA.copy(r.local));
      if (r.sideL) { r.joint.getWorldQuaternion(hq); r.view.side.copy(r.sideL).applyQuaternion(hq); }
      const caps = r.caps === 'legs' ? legs : r.caps === 'none' ? [] : body;
      r.rope.step(dt, tA, caps, floor, r.rest.clone().applyQuaternion(rq), windV); r.view.update(); r.mesh.visible = vis;
    }
    const wind = [windV.x * 1.4 + Math.sin(f.G.time * 1.3) * 0.8, 0, windV.z * 1.4 + Math.cos(f.G.time * 1.1) * 0.8];
    for (const c of m.cloths) { if (!c.cl) continue; c.anchor(c.cl, f); c.cl.len = c.len * sc; c.cl.mesh.visible = vis; c.cl.step(dt, c.caps ? c.caps(f, torso, legs) : [torso, ...legs], floor, wind); }
    for (const x of m.worldObjs || []) if (x.userData.followVis !== false) x.visible = vis && x.userData.on !== false;
  };
  return m;
}

// 두 관절로 된 다리 IK (무릎이 위로 굽음): root 를 발 목표로 돌리고, 넓적다리 · 정강이 각도를 코사인 법칙으로
// root: 다리 시작 그룹 (부모 기준 회전), a / b: 넓적다리 · 정강이 길이, knee: 정강이 그룹 (root 자식, +Z 방향 a 위치)
const _ik = new V3();
export function ik2(root, knee, target, a, b, lift = 0) {
  root.lookAt(target); // +Z → 목표
  root.updateMatrixWorld(true); const d = Math.max(0.05, Math.min(a + b - 0.002, root.getWorldPosition(_ik).distanceTo(target) / root.matrixWorld.getMaxScaleOnAxis()));
  const al = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))), be = Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b))));
  root.rotateX(-al - lift); knee.rotation.x = Math.PI - be;
}
