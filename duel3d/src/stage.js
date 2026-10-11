// 맵: 「일식의 신전」 — 호수 위 원형 석조 결투장
import * as THREE from 'three';
import { rand, TAU } from './core.js';

export const ARENA_R = 15.5;      // 캐릭터 이동 한계 반경 (m)
const PLAT_R = 17;                // 결투장 상판 반경

function mulberry(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function stoneTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), r = mulberry(9), C = S / 2;
  g.fillStyle = '#3b3442'; g.fillRect(0, 0, S, S);
  // 동심원 석판
  const ringW = 44;
  for (let rad = 60; rad < C; rad += ringW) {
    const n = Math.max(8, Math.round((TAU * rad) / 70)), off = r() * TAU;
    for (let i = 0; i < n; i++) {
      const a0 = off + (i / n) * TAU, a1 = off + ((i + 1) / n) * TAU, l = 34 + r() * 18, h = 260 + r() * 30;
      g.fillStyle = `hsl(${h},${8 + r() * 8}%,${l * 0.62}%)`;
      g.beginPath(); g.arc(C, C, rad + ringW - 2, a0 + 0.004, a1 - 0.004); g.arc(C, C, rad + 1, a1 - 0.004, a0 + 0.004, true); g.closePath(); g.fill();
    }
  }
  // 중앙 문양 (일식)
  g.fillStyle = '#2a2430'; g.beginPath(); g.arc(C, C, 60, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,190,150,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(C, C, 46, 0, TAU); g.stroke();
  g.fillStyle = '#120e16'; g.beginPath(); g.arc(C, C, 30, 0, TAU); g.fill();
  // 줄눈 · 균열 · 얼룩
  g.strokeStyle = 'rgba(10,8,14,.7)'; g.lineWidth = 3;
  for (let rad = 60; rad < C; rad += ringW) { g.beginPath(); g.arc(C, C, rad, 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(8,6,10,.55)'; g.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`; g.fillRect(r() * S, r() * S, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function runeTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), r = mulberry(4), C = S / 2;
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  const circ = (rad, w) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, rad, 0, TAU); g.stroke(); };
  circ(C * 0.93, 5); circ(C * 0.88, 2); circ(C * 0.72, 3); circ(C * 0.69, 1.5);
  // 룬 문자 띠
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU; g.save(); g.translate(C + Math.cos(a) * C * 0.805, C + Math.sin(a) * C * 0.805); g.rotate(a + Math.PI / 2); g.lineWidth = 3;
    g.beginPath(); const k = 3 + ((r() * 3) | 0); let x = (r() - 0.5) * 18, y = (r() - 0.5) * 24; g.moveTo(x, y);
    for (let j = 0; j < k; j++) { x = (r() - 0.5) * 22; y = (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); g.restore();
  }
  // 방사형 선
  g.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(C + Math.cos(a) * C * 0.2, C + Math.sin(a) * C * 0.2); g.lineTo(C + Math.cos(a) * C * 0.69, C + Math.sin(a) * C * 0.69); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1; }
  circ(C * 0.2, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const SKY_VS = `varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`;
const SKY_FS = `varying vec3 vDir; uniform vec3 uSun; uniform float uTime; uniform vec3 uTint; uniform float uTintA; uniform float uFlash;
void main(){
  vec3 d=normalize(vDir); float h=d.y;
  vec3 top=vec3(0.012,0.008,0.03), mid=vec3(0.075,0.032,0.12), hor=vec3(0.36,0.1,0.15);
  vec3 col=mix(hor,mid,smoothstep(0.0,0.22,h)); col=mix(col,top,smoothstep(0.22,0.75,h));
  if(h<0.0) col=mix(hor*0.55,vec3(0.02,0.01,0.025),smoothstep(0.0,-0.25,h));
  float a=acos(clamp(dot(d,uSun),-1.0,1.0)); float R=0.07;
  vec3 t1=normalize(cross(uSun,vec3(0.0,1.0,0.0))); vec3 t2=cross(t1,uSun); float th=atan(dot(d,t2),dot(d,t1));
  float rays=0.55+0.45*sin(th*23.0+uTime*0.25)*sin(th*9.0-uTime*0.17)+0.2*sin(th*61.0);
  float cor=exp(-(a-R)*16.0)*rays*step(R,a);
  col+=vec3(1.0,0.62,0.42)*cor*1.3+vec3(1.0,0.35,0.28)*exp(-a*2.6)*0.4;
  col+=vec3(1.0,0.94,0.86)*smoothstep(0.005,0.0,abs(a-R))*2.2;
  if(a<R) col=vec3(0.004,0.002,0.006)+vec3(1.0,0.8,0.7)*smoothstep(R*0.75,R,a)*0.04;
  col=mix(col,uTint,uTintA); col+=vec3(0.55,0.7,1.0)*uFlash*smoothstep(-0.1,0.6,h);
  gl_FragColor=vec4(col,1.0);
}`;

export function buildStage(scene) {
  const group = new THREE.Group(); scene.add(group);
  const sunDir = new THREE.Vector3(0.28, 0.3, -1).normalize();
  scene.fog = new THREE.FogExp2(0x241226, 0.0085);

  // 하늘
  const skyMat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: sunDir }, uTime: { value: 0 }, uTint: { value: new THREE.Color(0) }, uTintA: { value: 0 }, uFlash: { value: 0 } }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
  // 별
  { const r = mulberry(3), n = 1600, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = r() * 0.95 + 0.05, a = r() * TAU, s = Math.sqrt(1 - u * u); p.set([Math.cos(a) * s * 450, u * 450, Math.sin(a) * s * 450], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffeef0, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false }))); }

  // 조명
  const hemi = new THREE.HemisphereLight(0x8a74c0, 0x2a1018, 1.25); group.add(hemi);
  const key = new THREE.DirectionalLight(0xffbe96, 2.6); key.position.copy(sunDir).multiplyScalar(40).setY(26); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.camera.updateProjectionMatrix();
  group.add(key); group.add(key.target);
  const fill = new THREE.DirectionalLight(0x6f86ff, 0.7); fill.position.set(-20, 14, 25); group.add(fill);

  // 호수
  const water = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: 0x0b0814, metalness: 0.9, roughness: 0.22 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -1.1; water.receiveShadow = true; group.add(water);

  // 결투장
  const stoneSide = new THREE.MeshStandardMaterial({ color: 0x2c2633, roughness: 0.9, metalness: 0.05 });
  const top = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.82, metalness: 0.08 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(PLAT_R, PLAT_R + 0.4, 0.9, 96), [stoneSide, top, stoneSide]);
  plat.position.y = -0.45; plat.receiveShadow = true; plat.castShadow = true; group.add(plat);
  const step1 = new THREE.Mesh(new THREE.CylinderGeometry(PLAT_R + 1.4, PLAT_R + 1.9, 0.6, 96), stoneSide); step1.position.y = -0.95; step1.receiveShadow = true; group.add(step1);
  // 가장자리 연석
  const curb = new THREE.Mesh(new THREE.TorusGeometry(PLAT_R - 0.15, 0.16, 8, 128), new THREE.MeshStandardMaterial({ color: 0x4a3f52, roughness: 0.7 }));
  curb.rotation.x = Math.PI / 2; curb.position.y = 0.02; group.add(curb);
  // 룬 마법진 (발광)
  const runeMat = new THREE.MeshBasicMaterial({ map: runeTexture(), color: 0xffa070, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_R * 2 + 1.4, ARENA_R * 2 + 1.4), runeMat); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.012; group.add(rune);

  // 기둥 (일부는 부서짐)
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3a3341, roughness: 0.85 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2a2430, roughness: 0.8 });
  const r = mulberry(17), lanterns = [];
  const NP = 14;
  for (let i = 0; i < NP; i++) {
    const a = (i / NP) * TAU + 0.11, R = 26 + r() * 1.5, broken = r() < 0.35, h = broken ? 3 + r() * 5 : 10 + r() * 3;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    if (Math.abs(Math.atan2(x, z) - Math.PI) < 0.35 || Math.abs(Math.atan2(x, z) + Math.PI) < 0.35) continue; // 도리이 앞은 비움
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, h, 14), pillarMat); p.position.set(x, h / 2 - 1.1, z); p.castShadow = true; p.receiveShadow = true; group.add(p);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 2.3), capMat); base.position.set(x, -0.9, z); group.add(base);
    if (!broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 2.1), capMat); cap.position.set(x, h - 0.85, z); cap.castShadow = true; group.add(cap); }
    else { const chunk = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.2, 14), pillarMat); chunk.position.set(x + rand(-2, 2), -0.6, z + rand(-2, 2)); chunk.rotation.set(Math.PI / 2, r() * TAU, 0.3); chunk.castShadow = true; group.add(chunk); }
    if (i % 3 === 1) lanterns.push(new THREE.Vector3(Math.sin(a) * (R - 3.2), 0, Math.cos(a) * (R - 3.2)));
  }
  // 석등
  const lampLights = [];
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff9a4a, emissiveIntensity: 3 });
  for (const p of lanterns.slice(0, 4)) {
    const g = new THREE.Group(); g.position.copy(p);
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 8), capMat, 0.2); add(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 8), pillarMat, 1.05);
    add(new THREE.BoxGeometry(0.8, 0.12, 0.8), capMat, 1.75); add(new THREE.BoxGeometry(0.55, 0.5, 0.55), glowMat, 2.05);
    add(new THREE.ConeGeometry(0.75, 0.5, 4), capMat, 2.55).rotation.y = Math.PI / 4; add(new THREE.SphereGeometry(0.1, 8, 6), capMat, 2.85);
    const L = new THREE.PointLight(0xff8a40, 22, 16, 2); L.position.set(0, 2.05, 0); g.add(L); lampLights.push(L);
    group.add(g);
  }
  // 대형 도리이 (일식 방향)
  { const gate = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: 0x4a0d12, roughness: 0.65 }), blk = new THREE.MeshStandardMaterial({ color: 0x120a0e, roughness: 0.6 });
    const sx = 7.5, H = 13;
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, H, 16), red); p.position.set(s * sx, H / 2 - 1.1, 0); p.castShadow = true; gate.add(p);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.2, 16), blk); f.position.set(s * sx, -0.6, 0); gate.add(f); }
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(20, 1.0, 1.6), blk); kasagi.position.y = H - 0.6; gate.add(kasagi);
    for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.6), blk); tip.position.set(s * 10.6, H - 0.25, 0); tip.rotation.z = s * 0.22; gate.add(tip); }
    const shimaki = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.7, 1.3), red); shimaki.position.y = H - 1.4; gate.add(shimaki);
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(17, 0.6, 0.7), red); nuki.position.y = H - 3.6; gate.add(nuki);
    const gaku = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.3), blk); gaku.position.set(0, H - 2.5, 0.5); gate.add(gaku);
    gate.position.set(0, 0, -34); gate.traverse((m) => { if (m.isMesh) m.castShadow = true; }); group.add(gate);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 1, 6), stoneSide); ped.position.set(0, -1.1, -34); group.add(ped); }
  // 원경 산
  { const mm = new THREE.MeshStandardMaterial({ color: 0x1c1228, roughness: 1, flatShading: true }), r2 = mulberry(31);
    for (let i = 0; i < 46; i++) {
      const a = r2() * TAU, R = 150 + r2() * 110, h = 30 + r2() * 70, g = new THREE.ConeGeometry(18 + r2() * 30, h, 7, 3);
      const pos = g.attributes.position; for (let k = 0; k < pos.count; k++) { if (pos.getY(k) < h / 2 - 0.1) { pos.setX(k, pos.getX(k) * (0.8 + r2() * 0.5)); pos.setZ(k, pos.getZ(k) * (0.8 + r2() * 0.5)); pos.setY(k, pos.getY(k) + (r2() - 0.5) * 6); } }
      g.computeVertexNormals(); const m = new THREE.Mesh(g, mm); m.position.set(Math.sin(a) * R, h / 2 - 4, Math.cos(a) * R); m.rotation.y = r2() * TAU; group.add(m);
    } }
  // 떠다니는 바위
  const rocks = [];
  { const rm = new THREE.MeshStandardMaterial({ color: 0x3a3142, roughness: 0.9, flatShading: true }), r3 = mulberry(77);
    for (let i = 0; i < 16; i++) {
      const a = r3() * TAU, R = 32 + r3() * 26, s = 0.8 + r3() * 2.6, m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rm);
      m.position.set(Math.sin(a) * R, 4 + r3() * 14, Math.cos(a) * R); m.rotation.set(r3() * 3, r3() * 3, r3() * 3); m.castShadow = true; group.add(m);
      rocks.push({ m, y: m.position.y, ph: r3() * TAU, sp: 0.2 + r3() * 0.4 });
    } }
  // 날리는 불씨
  const EN = 500, ePos = new Float32Array(EN * 3), eVel = [];
  for (let i = 0; i < EN; i++) { ePos.set([rand(-40, 40), rand(-1, 18), rand(-40, 40)], i * 3); eVel.push(rand(0.2, 0.8)); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ePos, 3).setUsage(THREE.DynamicDrawUsage));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xff9a5a, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false; group.add(embers);

  let flashA = 0;
  return {
    group, sunDir, sky: skyMat, key,
    flashSky(a) { flashA = Math.max(flashA, a); },
    setTint(color, a) { skyMat.uniforms.uTint.value.set(color); skyMat.uniforms.uTintA.value = a; },
    update(dt, t) {
      skyMat.uniforms.uTime.value = t; flashA = Math.max(0, flashA - dt * 2.5); skyMat.uniforms.uFlash.value = flashA;
      runeMat.opacity = 0.42 + 0.14 * Math.sin(t * 1.3); rune.rotation.z = t * 0.02;
      for (const L of lampLights) L.intensity = 20 + Math.sin(t * 9 + L.id) * 2.5 + Math.sin(t * 23 + L.id * 3) * 1.5;
      for (const k of rocks) { k.m.position.y = k.y + Math.sin(t * k.sp + k.ph) * 0.6; k.m.rotation.y += dt * 0.05; }
      for (let i = 0; i < EN; i++) {
        const j = i * 3; ePos[j + 1] += eVel[i] * dt; ePos[j] += Math.sin(t * 0.7 + i) * 0.3 * dt; ePos[j + 2] += 0.25 * dt;
        if (ePos[j + 1] > 18) { ePos[j + 1] = -1; ePos[j] = rand(-40, 40); ePos[j + 2] = rand(-40, 40); }
      }
      eg.attributes.position.needsUpdate = true;
    },
  };
}
