// 이펙트 시스템: 파티클 · 참격 · 충격파 링 · 빛기둥 · 순간 광원 · 무기 궤적 · 방어막
import * as THREE from 'three';
import { rand, pick, TAU, clamp } from './core.js';

const V3 = THREE.Vector3;
const _c = new THREE.Color();
const UP = new V3(0, 1, 0);

/* ---------- 파티클 ---------- */
const PV = `attribute float size; attribute float alpha; attribute vec3 pcolor;
varying vec3 vC; varying float vA; uniform float uScale;
void main(){ vC=pcolor; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const PF_ADD = `varying vec3 vC; varying float vA;
void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; float a=pow(1.0-r,1.7);
  gl_FragColor=vec4(vC*a*vA + vec3(1.0)*pow(1.0-r,6.0)*vA*0.35,1.0); }`;
const PF_NORM = `varying vec3 vC; varying float vA;
void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; float a=(1.0-r*r);
  gl_FragColor=vec4(vC, a*vA); }`;

class Particles {
  constructor(scene, max, additive) {
    this.max = max; this.n = 0;
    const F = (k) => new Float32Array(max * k);
    this.pos = F(3); this.col = F(3); this.sz = F(1); this.al = F(1);
    this.vel = F(3); this.life = F(1); this.t = F(1); this.s0 = F(1); this.s1 = F(1); this.a0 = F(1); this.drag = F(1); this.grav = F(1); this.flick = F(1);
    const g = new THREE.BufferGeometry();
    const at = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', at(this.pos, 3)); g.setAttribute('pcolor', at(this.col, 3)); g.setAttribute('size', at(this.sz, 1)); g.setAttribute('alpha', at(this.al, 1));
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 } }, vertexShader: PV, fragmentShader: additive ? PF_ADD : PF_NORM,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 10 : 9; scene.add(this.pts); this.geo = g;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, color, a0, drag, grav, flick) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3; _c.set(color);
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z; this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = _c.r; this.col[i3 + 1] = _c.g; this.col[i3 + 2] = _c.b;
    this.life[i] = life; this.t[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.drag[i] = drag; this.grav[i] = grav; this.flick[i] = flick;
  }
  copy(d, s) {
    const d3 = d * 3, s3 = s * 3;
    for (let k = 0; k < 3; k++) { this.pos[d3 + k] = this.pos[s3 + k]; this.vel[d3 + k] = this.vel[s3 + k]; this.col[d3 + k] = this.col[s3 + k]; }
    this.life[d] = this.life[s]; this.t[d] = this.t[s]; this.s0[d] = this.s0[s]; this.s1[d] = this.s1[s]; this.a0[d] = this.a0[s]; this.drag[d] = this.drag[s]; this.grav[d] = this.grav[s]; this.flick[d] = this.flick[s];
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.t[i] += dt;
      if (this.t[i] >= this.life[i]) { this.n--; if (i !== this.n) this.copy(i, this.n); continue; }
      const i3 = i * 3, dr = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt; this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = this.t[i] / this.life[i];
      this.sz[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      let a = this.a0[i] * (1 - k) * Math.min(1, k * 12 + 0.3);
      if (this.flick[i] > 0) a *= 1 - this.flick[i] * 0.5 * (1 + Math.sin(this.t[i] * 40 + i));
      this.al[i] = a; i++;
    }
    const g = this.geo; for (const n of ['position', 'pcolor', 'size', 'alpha']) g.attributes[n].needsUpdate = true;
    g.setDrawRange(0, this.n);
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

/* ---------- 참격 (초승달) ---------- */
function crescentGeo(span = 2.6, seg = 48) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = -span / 2 + span * t, w = 0.34 * Math.sin(Math.PI * t) + 0.015;
    pos.push(Math.cos(a), Math.sin(a), 0, Math.cos(a) * (1 - w), Math.sin(a) * (1 - w), 0);
    uv.push(t, 1, t, 0);
    if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
const SLASH_VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const SLASH_FS = `uniform vec3 uColor; uniform float uOp; uniform float uProg; varying vec2 vUv;
void main(){ float t=vUv.x, e=vUv.y; float head=smoothstep(uProg-0.75,uProg,t)*step(t,uProg+0.02);
  float a=head*(0.15+0.85*e*e)*uOp*smoothstep(0.0,0.06,t)*smoothstep(1.0,0.9,t);
  vec3 c=mix(uColor, vec3(1.0), pow(e,3.0)*0.85); gl_FragColor=vec4(c*a,1.0); }`;
const BEAM_VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const BEAM_FS = `uniform vec3 uColor; uniform float uOp; uniform float uTime; varying vec2 vUv;
void main(){ float band=0.6+0.4*sin(vUv.x*TAU*3.0+uTime*20.0)*sin(vUv.y*30.0-uTime*40.0);
  float fade=smoothstep(1.0,0.55,vUv.y)*smoothstep(0.0,0.05,vUv.y);
  vec3 c=mix(uColor, vec3(1.0), 0.45*band); gl_FragColor=vec4(c*band*fade*uOp,1.0); }`.replace('TAU', '6.2831853');

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Particles(scene, 7000, true);
    this.smk = new Particles(scene, 900, false);
    this.time = 0;
    // 참격 풀
    const cg = crescentGeo();
    this.slashes = Array.from({ length: 20 }, () => {
      const m = new THREE.Mesh(cg, new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color() }, uOp: { value: 0 }, uProg: { value: 0 } }, vertexShader: SLASH_VS, fragmentShader: SLASH_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 11; scene.add(m); return { m, t: 0, life: 0, r: 1, on: false };
    });
    // 충격파 링 풀
    const rg = new THREE.RingGeometry(0.86, 1, 72);
    this.rings = Array.from({ length: 20 }, () => {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 11; scene.add(m); return { m, on: false };
    });
    // 빛기둥 풀
    const bg = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true); bg.translate(0, 0.5, 0);
    this.beams = Array.from({ length: 6 }, () => {
      const m = new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color() }, uOp: { value: 0 }, uTime: { value: 0 } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 11; scene.add(m); return { m, on: false };
    });
    // 순간 광원 (개수 고정: 셰이더 재컴파일 방지)
    this.lights = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffffff, 0, 14, 2); scene.add(l); return { l, t: 0, life: 1, i0: 0 }; });
    this.trails = []; this.shields = [];
  }
  setScale(s) { this.add.mat.uniforms.uScale.value = s; this.smk.mat.uniforms.uScale.value = s; }

  /* --- 기본 파티클 --- */
  p(pos, o = {}) {
    const v = o.vel || [0, 0, 0], sys = o.smoke ? this.smk : this.add;
    sys.spawn(pos.x, pos.y, pos.z, v[0], v[1], v[2], o.life ?? 0.5, o.size ?? 0.1, o.size1 ?? (o.size ?? 0.1) * 0.3, o.color ?? 0xffffff, o.alpha ?? 1, o.drag ?? 3, o.grav ?? 0, o.flick ?? 0);
  }
  // kind: spark(작은 불꽃) · glow(큰 빛) · ember(떠오르는 불씨) · smoke(연기) · dust(흙먼지)
  burst(pos, n, color, speed, o = {}) {
    const kind = o.kind || 'spark', dir = o.dir, spread = o.spread ?? Math.PI, cols = Array.isArray(color) ? color : [color];
    for (let i = 0; i < n; i++) {
      let vx, vy, vz;
      if (dir) {
        const a = rand(0, TAU), s = Math.sin(rand(0, spread)), c = Math.cos(Math.asin(s)), tmp = Math.abs(dir.y) < 0.9 ? UP : new V3(1, 0, 0);
        const t1 = new V3().crossVectors(dir, tmp).normalize(), t2 = new V3().crossVectors(dir, t1);
        const d = dir.clone().multiplyScalar(c).addScaledVector(t1, Math.cos(a) * s).addScaledVector(t2, Math.sin(a) * s);
        vx = d.x; vy = d.y; vz = d.z;
      } else { const u = rand(-1, 1), a = rand(0, TAU), r = Math.sqrt(1 - u * u); vx = r * Math.cos(a); vy = u; vz = r * Math.sin(a); }
      const sp = rand(speed * 0.25, speed), col = pick(cols), j = o.jitter || 0;
      const P = { x: pos.x + rand(-j, j), y: pos.y + rand(-j, j) * (o.flatJitter ? 0 : 1), z: pos.z + rand(-j, j) };
      const lk = o.lk || 1, sk = o.sk || 1;
      if (kind === 'spark') this.p(P, { vel: [vx * sp, vy * sp, vz * sp], life: rand(0.2, 0.55) * lk, size: rand(0.06, 0.13) * sk, size1: 0.02, color: col, drag: o.drag ?? 3.5, grav: o.grav ?? 9 });
      else if (kind === 'glow') this.p(P, { vel: [vx * sp, vy * sp, vz * sp], life: rand(0.25, 0.5) * lk, size: rand(0.5, 1.0) * sk, size1: rand(0.9, 1.6) * sk, color: col, alpha: 0.6, drag: o.drag ?? 4, grav: o.grav ?? 0 });
      else if (kind === 'ember') this.p(P, { vel: [vx * sp, vy * sp + 1, vz * sp], life: rand(0.6, 1.3) * lk, size: rand(0.05, 0.1) * sk, size1: 0.02, color: col, drag: o.drag ?? 1.5, grav: o.grav ?? -2.5, flick: 0.8 });
      else if (kind === 'smoke') this.p(P, { vel: [vx * sp, vy * sp, vz * sp], life: rand(0.6, 1.2) * lk, size: rand(0.4, 0.8) * sk, size1: rand(1.4, 2.4) * sk, color: col, alpha: 0.35, drag: o.drag ?? 3, grav: o.grav ?? -0.8, smoke: true });
      else if (kind === 'dust') this.p(P, { vel: [vx * sp, Math.abs(vy) * sp * 0.4, vz * sp], life: rand(0.4, 0.8) * lk, size: rand(0.25, 0.5) * sk, size1: rand(0.8, 1.3) * sk, color: col, alpha: 0.4, drag: o.drag ?? 4, grav: o.grav ?? 0.5, smoke: true });
    }
  }
  // 참격: fwd = 초승달 중앙이 향하는 방향, normal = 참격 평면의 법선, flip = 휘두르는 방향 반전
  slash(pos, o) {
    const s = this.slashes.find((x) => !x.on) || this.slashes[0];
    const X = o.fwd.clone().normalize(), N = o.normal || UP, Z = N.clone().addScaledVector(X, -N.dot(X)).normalize();
    const Y = new V3().crossVectors(Z, X);
    if (o.flip) { Y.negate(); Z.negate(); } // X축 기준 180° 회전 → 휘두르는 방향 반대
    const mtx = new THREE.Matrix4().makeBasis(X, Y, Z);
    s.m.quaternion.setFromRotationMatrix(mtx); s.m.position.copy(pos);
    s.r = o.r || 1.2; s.t = 0; s.life = o.life || 0.24; s.on = true; s.m.visible = true; s.m.scale.setScalar(s.r);
    s.m.material.uniforms.uColor.value.set(o.color ?? 0xffffff); s.m.material.uniforms.uOp.value = 1; s.m.material.uniforms.uProg.value = 0;
  }
  ring(pos, o = {}) {
    const r = this.rings.find((x) => !x.on) || this.rings[0];
    r.on = true; r.t = 0; r.life = o.life || 0.45; r.r0 = o.r0 ?? 0.2; r.r1 = o.r1 ?? 3; r.op = o.op ?? 0.9;
    r.m.position.copy(pos); r.m.material.color.set(o.color ?? 0xffffff); r.m.visible = true;
    const n = o.normal || UP; r.m.quaternion.setFromUnitVectors(new V3(0, 0, 1), n.clone().normalize()); r.billboard = !!o.billboard;
  }
  beam(pos, o = {}) {
    const b = this.beams.find((x) => !x.on) || this.beams[0];
    b.on = true; b.t = 0; b.life = o.life || 1; b.r = o.r || 1.2; b.h = o.h || 25; b.m.position.copy(pos);
    b.m.material.uniforms.uColor.value.set(o.color ?? 0xffffff); b.m.visible = true;
  }
  light(pos, color, intensity = 60, life = 0.25, dist = 14) {
    const L = this.lights.reduce((a, b) => (a.l.intensity <= b.l.intensity ? a : b));
    L.l.position.copy(pos); L.l.color.set(color); L.l.distance = dist; L.i0 = intensity; L.l.intensity = intensity; L.t = 0; L.life = life;
  }
  // 범용 타격 이펙트
  impact(pos, color, power = 1, dir) {
    const big = power >= 1.5;
    this.burst(pos, Math.round(14 * power), [color, 0xffffff], 9 * power, { dir, spread: dir ? 1.1 : Math.PI });
    this.burst(pos, big ? 4 : 2, color, 1.5, { kind: 'glow', sk: 0.8 * power });
    this.p(pos, { size: 1.4 * power, size1: 2.2 * power, life: 0.14, color: 0xffffff, alpha: 0.9 });
    this.ring(pos, { r0: 0.1, r1: 1.4 * power, life: 0.25, color, billboard: true });
    this.light(pos, color, 50 * power, 0.22, 10);
  }
  makeTrail(color, n = 22) {
    const pos = new Float32Array(n * 2 * 3), al = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n - 1; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('a', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: `attribute float a; varying float vA; void main(){ vA=a; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor=vec4(mix(uColor,vec3(1.0),vA*vA*0.6)*vA,1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 12; this.scene.add(mesh);
    const tr = { mesh, n, s: [], push(b, t) { this.s.push({ b: b.clone(), t: t.clone(), age: 0 }); if (this.s.length > n) this.s.shift(); }, clear() { this.s.length = 0; }, maxAge: 0.12 };
    this.trails.push(tr); return tr;
  }
  makeShield(color) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.98, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.add(s); m.scale.set(0.85, 1.05, 0.85); m.renderOrder = 12; this.scene.add(m);
    const sh = { m, s, k: 0, hit: 0 }; this.shields.push(sh); return sh;
  }

  update(dt, camera) {
    this.time += dt;
    this.add.update(dt); this.smk.update(dt);
    for (const s of this.slashes) if (s.on) {
      s.t += dt; const k = s.t / s.life; if (k >= 1) { s.on = false; s.m.visible = false; continue; }
      const u = s.m.material.uniforms; u.uProg.value = Math.min(1.75, k * 3.2); u.uOp.value = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      s.m.scale.setScalar(s.r * (0.92 + 0.15 * k));
    }
    for (const r of this.rings) if (r.on) {
      r.t += dt; const k = r.t / r.life; if (k >= 1) { r.on = false; r.m.visible = false; continue; }
      const e = 1 - (1 - k) ** 3; r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e); r.m.material.opacity = r.op * (1 - k);
      if (r.billboard) r.m.quaternion.copy(camera.quaternion);
    }
    for (const b of this.beams) if (b.on) {
      b.t += dt; const k = b.t / b.life; if (k >= 1) { b.on = false; b.m.visible = false; continue; }
      const a = k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.92, w = b.r * (k < 0.08 ? 0.3 + k / 0.08 * 0.9 : 1.2 - k * 0.7) * (1 + 0.08 * Math.sin(this.time * 60));
      b.m.scale.set(w, b.h, w); b.m.material.uniforms.uOp.value = a; b.m.material.uniforms.uTime.value = this.time;
    }
    for (const L of this.lights) if (L.l.intensity > 0) { L.t += dt; L.l.intensity = L.t >= L.life ? 0 : L.i0 * (1 - L.t / L.life) ** 2; }
    for (const tr of this.trails) {
      for (const s of tr.s) s.age += dt; while (tr.s.length && tr.s[0].age > tr.maxAge) tr.s.shift();
      const n = tr.s.length; tr.mesh.visible = n >= 2; if (n < 2) continue;
      const P = tr.mesh.geometry.attributes.position.array, A = tr.mesh.geometry.attributes.a.array;
      for (let i = 0; i < tr.n; i++) {
        const s = tr.s[Math.min(i, n - 1)], a = i < n ? clamp(1 - s.age / tr.maxAge, 0, 1) * (i / (n - 1)) : 0;
        P.set([s.b.x, s.b.y, s.b.z, s.t.x, s.t.y, s.t.z], i * 6); A[i * 2] = a * 0.15; A[i * 2 + 1] = a;
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true; tr.mesh.geometry.attributes.a.needsUpdate = true;
      tr.mesh.geometry.setDrawRange(0, (n - 1) * 6);
    }
  }
  clear() {
    this.add.clear(); this.smk.clear();
    for (const a of [this.slashes, this.rings, this.beams]) for (const x of a) { x.on = false; x.m.visible = false; }
    for (const L of this.lights) L.l.intensity = 0;
    for (const t of this.trails) t.clear();
  }
  setVisible(v) {
    this.add.pts.visible = v; this.smk.pts.visible = v;
    for (const a of [this.slashes, this.rings, this.beams]) for (const x of a) x.m.visible = v && x.on;
    for (const t of this.trails) t.mesh.visible = v && t.s.length >= 2;
    for (const s of this.shields) s.m.visible = v;
  }
}
