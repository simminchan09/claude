// 맵 제작 도구: 하늘 · 조명 · 안개 · 결투장 바닥 · 지형 · 물/용암/구름바다 · 산맥 · 날씨 · 인스턴스 배치
// 모든 맵은 반경 23m 결투장(이동 반경 ARENA_R) 위 y = 0 에서 싸운다.
// 결투장 안의 장애물은 K.cylS / K.boxS / K.rockS 로 만들면 충돌·올라서기·카메라 투명화가 자동으로 붙는다.
import * as THREE from 'three';

export const ARENA_R = 21;
export const PLAT_R = 23;
const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
// 셰이더용 색: 16진수 값을 화면에 보이는 그대로 쓴다 (색공간 변환 없음)
export const raw = (h) => new THREE.Color().setHex(h, THREE.LinearSRGBColorSpace);

export function mulberry(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 2D 값 노이즈 (지형용)
function vnoise(seed) {
  const r = mulberry(seed), P = new Float32Array(256 * 256); for (let i = 0; i < P.length; i++) P[i] = r();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v; };
  return (x, y) => n(x, y) * 0.5 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.2;
}

export const GLSL_NOISE = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}`;
const FOG_GLSL = `uniform vec3 uFogC; uniform float uFogD;
vec3 applyFog(vec3 c, vec3 w){ float d=length(cameraPosition-w); return mix(c,uFogC,1.0-exp(-uFogD*uFogD*d*d)); }`;

/* ---------------- 하늘 ---------------- */
const SKY_VS = `varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`;
const SKY_FS = `varying vec3 vDir;
uniform vec3 uTop,uMid,uHor,uBot,uSunCol,uSun,uTint,uCloudCol; uniform float uSunType,uSunSize,uTime,uAurora,uTintA,uFlash,uCloud,uNebula;
${GLSL_NOISE}
void main(){
  vec3 d=normalize(vDir); float h=d.y;
  vec3 col=mix(uHor,uMid,smoothstep(0.0,0.22,h)); col=mix(col,uTop,smoothstep(0.22,0.8,h));
  if(h<0.0) col=mix(uHor,uBot,smoothstep(0.0,-0.25,h));
  float a=acos(clamp(dot(d,uSun),-1.0,1.0)); float R=uSunSize;
  if(uSunType>0.5 && uSunType<1.5){ // 일식
    vec3 t1=normalize(cross(uSun,vec3(0.0,1.0,0.0))); vec3 t2=cross(t1,uSun); float th=atan(dot(d,t2),dot(d,t1));
    float rays=0.55+0.45*sin(th*23.0+uTime*0.25)*sin(th*9.0-uTime*0.17)+0.2*sin(th*61.0);
    col+=uSunCol*exp(-(a-R)*16.0)*rays*step(R,a)*1.3+uSunCol*vec3(1.0,0.6,0.6)*exp(-a*2.6)*0.4;
    col+=vec3(1.0,0.94,0.86)*smoothstep(0.005,0.0,abs(a-R))*2.2;
    if(a<R) col=vec3(0.004,0.002,0.006);
  } else if(uSunType>1.5 && uSunType<2.5){ // 태양
    col+=uSunCol*(smoothstep(R,R*0.8,a)*3.0+exp(-a*9.0)*0.7+exp(-a*2.2)*0.25);
  } else if(uSunType>2.5){ // 달
    float m=smoothstep(R,R*0.94,a); float cr=fbm(d.xz*90.0);
    col=mix(col,uSunCol*(0.75+0.35*cr),m); col+=uSunCol*exp(-a*7.0)*0.25*(1.0-m);
  }
  if(uAurora>0.0){
    float wave=sin(d.x*3.0+uTime*0.2)*0.08+sin(d.z*5.0-uTime*0.13)*0.05; float y=h-0.38-wave;
    float curtain=0.5+0.5*sin(d.x*24.0+d.z*9.0+uTime*0.9);
    col+=vec3(0.25,1.0,0.6)*exp(-y*y*55.0)*curtain*uAurora*smoothstep(0.0,0.25,h);
    col+=vec3(0.7,0.35,1.0)*exp(-(y-0.1)*(y-0.1)*90.0)*curtain*0.5*uAurora;
  }
  if(uNebula>0.0){ float n=fbm(d.xy*2.5+d.z*1.7+uTime*0.003); float n2=fbm(d.zy*3.1+5.0);
    col+=vec3(0.45,0.15,0.8)*smoothstep(0.45,0.9,n)*uNebula+vec3(0.1,0.4,0.9)*smoothstep(0.5,0.95,n2)*uNebula*0.7; }
  if(uCloud>0.0 && h>0.0){ vec2 p=d.xz/(h+0.12)*1.3+vec2(uTime*0.006,uTime*0.002); float n=fbm(p);
    float c=smoothstep(0.42,0.78,n)*uCloud*smoothstep(0.0,0.12,h); vec3 cc=uCloudCol*(0.75+0.35*smoothstep(0.4,0.9,n)); col=mix(col,cc,c); }
  col=mix(col,uTint,uTintA); col+=vec3(0.55,0.7,1.0)*uFlash*smoothstep(-0.1,0.6,h);
  gl_FragColor=vec4(col,1.0);
}`;
const SUN_TYPES = { none: 0, eclipse: 1, sun: 2, moon: 3 };

/* ---------------- 바닥 텍스처 ---------------- */
function canvas(S = 1024) { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; }
function speckle(g, S, r, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * a})`; g.fillRect(r() * S, r() * S, 2, 2); } }
function radialTiles(g, S, r, col, grout, ringW = 44) {
  const C = S / 2;
  for (let rad = 60; rad < C; rad += ringW) {
    const n = Math.max(8, Math.round((TAU * rad) / 70)), off = r() * TAU;
    for (let i = 0; i < n; i++) {
      const a0 = off + (i / n) * TAU, a1 = off + ((i + 1) / n) * TAU; g.fillStyle = col(r);
      g.beginPath(); g.arc(C, C, rad + ringW - 2, a0 + 0.004, a1 - 0.004); g.arc(C, C, rad + 1, a1 - 0.004, a0 + 0.004, true); g.closePath(); g.fill();
    }
  }
  g.strokeStyle = grout; g.lineWidth = 3; for (let rad = 60; rad < C; rad += ringW) { g.beginPath(); g.arc(C, C, rad, 0, TAU); g.stroke(); }
}
function cracks(g, S, r, n, col, w = 1.5) { g.strokeStyle = col; g.lineWidth = w; for (let i = 0; i < n; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } }
// style: stone · sand · snow · grass · wood · obsidian · neon · marble · moss · rock
export function floorTexture(style, o = {}) {
  const S = 1024, [c, g] = canvas(S), r = mulberry(o.seed || 9), C = S / 2; let em = null;
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
  if (style === 'stone') {
    g.fillStyle = '#3b3442'; g.fillRect(0, 0, S, S);
    radialTiles(g, S, r, (r) => hsl(o.hue ?? 265 + r() * 30, 8 + r() * 8, (34 + r() * 18) * 0.62), 'rgba(10,8,14,.7)');
    g.fillStyle = '#2a2430'; g.beginPath(); g.arc(C, C, 60, 0, TAU); g.fill(); g.fillStyle = '#120e16'; g.beginPath(); g.arc(C, C, 30, 0, TAU); g.fill();
    cracks(g, S, r, 40, 'rgba(8,6,10,.55)'); speckle(g, S, r, 9000, 0.07);
  } else if (style === 'sand') {
    g.fillStyle = '#c99a62'; g.fillRect(0, 0, S, S);
    radialTiles(g, S, r, (r) => hsl(30 + r() * 8, 35 + r() * 12, 52 + r() * 10), 'rgba(90,55,25,.45)', 64);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '240,210,160' : '120,80,40'},${0.25 * r()})`; g.beginPath(); g.ellipse(r() * S, r() * S, 4 + r() * 18, 1 + r() * 2, 0.3, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(110,60,25,.6)'; g.lineWidth = 6; g.beginPath(); g.arc(C, C, C * 0.82, 0, TAU); g.stroke(); g.beginPath(); g.arc(C, C, 90, 0, TAU); g.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.moveTo(C + Math.cos(a) * 90, C + Math.sin(a) * 90); g.lineTo(C + Math.cos(a) * C * 0.82, C + Math.sin(a) * C * 0.82); g.stroke(); }
    speckle(g, S, r, 12000, 0.08);
  } else if (style === 'snow') {
    g.fillStyle = '#e7eef6'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${150 + r() * 40},${180 + r() * 40},${220 + r() * 30},${0.12 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * S, r() * S, 20 + r() * 90, 10 + r() * 50, r() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(120,160,210,.35)'; g.lineWidth = 10; g.beginPath(); g.arc(C, C, C * 0.86, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(150,200,240,.35)'; g.beginPath(); g.arc(C, C, 120, 0, TAU); g.fill();
    cracks(g, S, r, 14, 'rgba(120,170,220,.5)', 2); speckle(g, S, r, 8000, 0.08);
  } else if (style === 'grass') {
    g.fillStyle = '#4f7a34'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26000; i++) { const x = r() * S, y = r() * S, l = 4 + r() * 10; g.strokeStyle = `hsla(${85 + r() * 30},${40 + r() * 25}%,${22 + r() * 25}%,.7)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - l); g.stroke(); }
    g.strokeStyle = 'rgba(120,95,60,.85)'; g.lineWidth = 34; g.beginPath(); g.arc(C, C, C * 0.86, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(130,110,80,.9)'; g.beginPath(); g.arc(C, C, 70, 0, TAU); g.fill();
    for (let i = 0; i < 180; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,240,120,.9)' : 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 2, 0, TAU); g.fill(); }
  } else if (style === 'wood') {
    g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, S, S);
    const pw = 56; for (let x = 0; x < S; x += pw) for (let y = -r() * 300; y < S; y += 300 + r() * 200) {
      g.fillStyle = hsl(26 + r() * 8, 35 + r() * 10, 26 + r() * 12); g.fillRect(x + 2, y, pw - 4, 296);
      for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(40,24,12,.35)'; g.lineWidth = 1; g.beginPath(); const xx = x + 6 + r() * (pw - 12); g.moveTo(xx, y); g.lineTo(xx + (r() - 0.5) * 6, y + 296); g.stroke(); }
      g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x + 10, y + 12, 3, 0, TAU); g.arc(x + pw - 10, y + 12, 3, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(230,200,140,.5)'; g.lineWidth = 8; g.beginPath(); g.arc(C, C, C * 0.85, 0, TAU); g.stroke(); speckle(g, S, r, 6000, 0.07);
  } else if (style === 'obsidian') {
    g.fillStyle = '#141014'; g.fillRect(0, 0, S, S);
    radialTiles(g, S, r, (r) => hsl(280 + r() * 40, 8, 6 + r() * 6), 'rgba(0,0,0,.8)', 52);
    const [ec, eg] = canvas(S); eg.fillStyle = '#000'; eg.fillRect(0, 0, S, S); cracks(eg, S, r, 70, '#ff6a1a', 3); cracks(eg, S, r, 40, '#ffb04a', 1.2);
    eg.strokeStyle = '#ff5010'; eg.lineWidth = 4; eg.beginPath(); eg.arc(C, C, C * 0.86, 0, TAU); eg.stroke();
    em = new THREE.CanvasTexture(ec); em.colorSpace = THREE.SRGBColorSpace; speckle(g, S, r, 6000, 0.06);
  } else if (style === 'neon') {
    g.fillStyle = '#121420'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 128) for (let y = 0; y < S; y += 128) { g.fillStyle = hsl(230, 15, 9 + r() * 5); g.fillRect(x + 3, y + 3, 122, 122); }
    const [ec, eg] = canvas(S); eg.fillStyle = '#000'; eg.fillRect(0, 0, S, S);
    eg.strokeStyle = o.c1 || '#22e6ff'; eg.lineWidth = 2; for (let x = 0; x <= S; x += 128) { eg.beginPath(); eg.moveTo(x, 0); eg.lineTo(x, S); eg.moveTo(0, x); eg.lineTo(S, x); eg.stroke(); }
    eg.strokeStyle = o.c2 || '#ff2ad4'; eg.lineWidth = 7; eg.beginPath(); eg.arc(C, C, C * 0.88, 0, TAU); eg.stroke(); eg.lineWidth = 3; eg.beginPath(); eg.arc(C, C, C * 0.8, 0, TAU); eg.stroke();
    eg.font = 'bold 150px sans-serif'; eg.textAlign = 'center'; eg.textBaseline = 'middle'; eg.lineWidth = 5; eg.strokeText('H', C, C);
    em = new THREE.CanvasTexture(ec); em.colorSpace = THREE.SRGBColorSpace;
  } else if (style === 'marble') {
    g.fillStyle = '#d9d6e4'; g.fillRect(0, 0, S, S);
    radialTiles(g, S, r, (r) => hsl(250 + r() * 30, 10 + r() * 8, 78 + r() * 10), 'rgba(90,80,120,.45)', 60);
    for (let i = 0; i < 50; i++) { let x = r() * S, y = r() * S; g.strokeStyle = `rgba(120,110,150,${0.15 + r() * 0.25})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 90; y += (r() - 0.3) * 40; g.lineTo(x, y); } g.stroke(); }
    const [ec, eg] = canvas(S); eg.fillStyle = '#000'; eg.fillRect(0, 0, S, S); eg.strokeStyle = '#ffd77a'; eg.lineWidth = 5; eg.beginPath(); eg.arc(C, C, C * 0.86, 0, TAU); eg.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; eg.beginPath(); eg.moveTo(C + Math.cos(a) * C * 0.86, C + Math.sin(a) * C * 0.86); eg.lineTo(C + Math.cos(a + TAU / 3) * C * 0.86, C + Math.sin(a + TAU / 3) * C * 0.86); eg.lineWidth = 2; eg.stroke(); }
    em = new THREE.CanvasTexture(ec); em.colorSpace = THREE.SRGBColorSpace;
  } else if (style === 'moss') {
    g.fillStyle = '#2c3328'; g.fillRect(0, 0, S, S);
    radialTiles(g, S, r, (r) => hsl(90 + r() * 30, 8 + r() * 10, 18 + r() * 10), 'rgba(5,10,5,.7)', 48);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${60 + r() * 40},${110 + r() * 50},${40 + r() * 20},${0.15 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * S, r() * S, 8 + r() * 40, 5 + r() * 20, r() * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${150 + r() * 60},${90 + r() * 40},30,.7)`; g.save(); g.translate(r() * S, r() * S); g.rotate(r() * 3); g.beginPath(); g.ellipse(0, 0, 9, 4, 0, 0, TAU); g.fill(); g.restore(); }
    speckle(g, S, r, 7000, 0.07);
  } else { // rock
    g.fillStyle = '#5a5a60'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) { g.fillStyle = hsl(220 + r() * 30, 5 + r() * 6, 30 + r() * 22); g.beginPath(); const x = r() * S, y = r() * S, s = 10 + r() * 50; g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s * 0.8); g.lineTo(x - s * 0.9, y); g.closePath(); g.fill(); }
    cracks(g, S, r, 60, 'rgba(20,20,26,.6)', 2); g.strokeStyle = 'rgba(240,240,250,.4)'; g.lineWidth = 8; g.beginPath(); g.arc(C, C, C * 0.86, 0, TAU); g.stroke(); speckle(g, S, r, 9000, 0.09);
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; return { map, em };
}
function runeTexture(seed = 4) {
  const S = 1024, [c, g] = canvas(S), r = mulberry(seed), C = S / 2; g.strokeStyle = '#fff';
  const circ = (rad, w) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, rad, 0, TAU); g.stroke(); };
  circ(C * 0.93, 5); circ(C * 0.88, 2); circ(C * 0.72, 3); circ(C * 0.69, 1.5); circ(C * 0.2, 3);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU; g.save(); g.translate(C + Math.cos(a) * C * 0.805, C + Math.sin(a) * C * 0.805); g.rotate(a + Math.PI / 2); g.lineWidth = 3; g.beginPath();
    let x = (r() - 0.5) * 18, y = (r() - 0.5) * 24; g.moveTo(x, y); for (let j = 0; j < 3 + ((r() * 3) | 0); j++) { x = (r() - 0.5) * 22; y = (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); g.restore();
  }
  g.globalAlpha = 0.35; g.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(C + Math.cos(a) * C * 0.2, C + Math.sin(a) * C * 0.2); g.lineTo(C + Math.cos(a) * C * 0.69, C + Math.sin(a) * C * 0.69); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function windowTexture(seed, cols) {
  const [c, g] = canvas(256), r = mulberry(seed); g.fillStyle = '#05060c'; g.fillRect(0, 0, 256, 256);
  for (let y = 4; y < 256; y += 10) for (let x = 4; x < 256; x += 8) if (r() < 0.42) { g.fillStyle = cols[(r() * cols.length) | 0]; g.globalAlpha = 0.4 + r() * 0.6; g.fillRect(x, y, 5, 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* ---------------- 키트 ---------------- */
export function createKit(scene, seed = 1) {
  const group = new THREE.Group(); scene.add(group);
  const K = { group, scene, rand: mulberry(seed), updaters: [], fogC: raw(0), fogD: 0, sunDir: new V3(0.3, 0.4, -1).normalize(), sunCol: raw(0xffffff), skyMat: null, flashA: 0, shaderMats: [] };
  K.r = (a, b) => a + K.rand() * (b - a);
  K.add = (o) => { group.add(o); return o; };
  K.mesh = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m; };
  K.std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0.05, flatShading: !!o.flat, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.opacity, opacity: o.opacity ?? 1 });
  K.glow = (color, i = 2.5) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: i });
  // 극좌표로 결투장 밖 무작위 위치 (avoid: 피할 각도 범위 [중심, 폭])
  K.around = (rMin, rMax, avoid) => { for (;;) { const a = K.r(0, TAU), R = K.r(rMin, rMax); if (avoid && Math.abs(((a - avoid[0] + Math.PI) % TAU + TAU) % TAU - Math.PI) < avoid[1]) continue; return [Math.sin(a) * R, Math.cos(a) * R, a]; } };

  K.fog = (color, density) => { K.fogC.setHex(color, THREE.LinearSRGBColorSpace); K.fogD = density; scene.fog = new THREE.FogExp2(color, density); };
  K.sky = (o) => {
    K.sunDir.copy(new V3(...(o.sunDir || [0.3, 0.4, -1])).normalize()); K.sunCol.setHex(o.sunCol ?? 0xffffff, THREE.LinearSRGBColorSpace);
    const U = { uTop: o.top, uMid: o.mid, uHor: o.hor, uBot: o.bot ?? o.hor, uCloudCol: o.cloudCol ?? 0xffffff };
    const uni = { uSun: { value: K.sunDir }, uSunCol: { value: K.sunCol }, uSunType: { value: SUN_TYPES[o.sun || 'none'] }, uSunSize: { value: o.sunSize ?? 0.06 },
      uTime: { value: 0 }, uAurora: { value: o.aurora ?? 0 }, uCloud: { value: o.clouds ?? 0 }, uNebula: { value: o.nebula ?? 0 }, uTint: { value: raw(0) }, uTintA: { value: 0 }, uFlash: { value: 0 } };
    for (const k in U) uni[k] = { value: raw(U[k]) };
    K.skyMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), K.skyMat); sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
    if (o.stars) {
      const n = 1800, p = new Float32Array(n * 3), r = mulberry(3);
      for (let i = 0; i < n; i++) { const u = o.starsBelow ? r() * 2 - 1 : r() * 0.95 + 0.05, a = r() * TAU, s = Math.sqrt(1 - u * u); p.set([Math.cos(a) * s * 450, u * 450, Math.sin(a) * s * 450], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffeef0, size: 1.3, sizeAttenuation: false, transparent: true, opacity: o.stars, fog: false, depthWrite: false })));
    }
  };
  K.lights = (o) => {
    group.add(new THREE.HemisphereLight(o.sky ?? 0x8a74c0, o.ground ?? 0x2a1018, o.hemi ?? 1.2));
    const key = new THREE.DirectionalLight(o.key ?? 0xffffff, o.keyI ?? 2.5);
    const kd = o.keyDir ? new V3(...o.keyDir).normalize() : K.sunDir.clone(); key.position.copy(kd).multiplyScalar(40); if (key.position.y < 12) key.position.y = 12;
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.camera.updateProjectionMatrix(); group.add(key, key.target);
    if (o.fillI) { const fill = new THREE.DirectionalLight(o.fill ?? 0x6f86ff, o.fillI); fill.position.set(-20, 14, 25); group.add(fill); }
  };
  K.point = (x, y, z, color, intensity, dist = 16, flicker = 0) => {
    const L = new THREE.PointLight(color, intensity, dist, 2); L.position.set(x, y, z); group.add(L);
    if (flicker) { const ph = K.r(0, 9); K.updaters.push((dt, t) => { L.intensity = intensity * (1 + Math.sin(t * 9 + ph) * 0.12 * flicker + Math.sin(t * 23 + ph * 3) * 0.07 * flicker); }); }
    return L;
  };
  // 결투장: style = 바닥 텍스처, raised = 단상 여부, shape = 'round' | 'hex' | 'oct'
  K.arena = (o) => {
    const { map, em } = floorTexture(o.style, o);
    const top = new THREE.MeshStandardMaterial({ map, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0.05, emissive: em ? (o.emColor ?? 0xffffff) : 0x000000, emissiveMap: em, emissiveIntensity: o.ei ?? 1.6 });
    const seg = o.shape === 'hex' ? 6 : o.shape === 'oct' ? 8 : 96;
    if (o.raised !== false) {
      const side = K.std(o.side ?? 0x2c2633, { rough: 0.9 }), h = o.height ?? 0.9;
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(PLAT_R, PLAT_R + 0.4, h, seg), [side, top, side]); plat.position.y = -h / 2; plat.receiveShadow = plat.castShadow = true; group.add(plat);
      if (o.base !== false) K.mesh(new THREE.CylinderGeometry(PLAT_R + 1.4, PLAT_R + 1.9, 0.6, seg), side, 0, -h - 0.25, 0);
      if (o.curb) { const curb = new THREE.Mesh(new THREE.TorusGeometry(PLAT_R - 0.15, 0.16, 8, 128), K.std(o.curb, { rough: 0.7 })); curb.rotation.x = Math.PI / 2; curb.position.y = 0.02; group.add(curb); }
    } else {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(PLAT_R, seg), top); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.01; disc.receiveShadow = true; group.add(disc);
    }
    if (o.runes) {
      const mat = new THREE.MeshBasicMaterial({ map: runeTexture(), color: o.runes, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_R * 2 + 1.4, ARENA_R * 2 + 1.4), mat); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.02; group.add(rune);
      const op = o.runeOpacity ?? 0.5; K.updaters.push((dt, t) => { mat.opacity = op * (0.8 + 0.25 * Math.sin(t * 1.3)); rune.rotation.z = t * 0.02; });
    }
  };
  // 지면: 결투장 밖으로 갈수록 높낮이(hills)가 생긴다
  K.ground = (o) => {
    const size = o.size ?? 700, segs = o.segs ?? 160, g = new THREE.PlaneGeometry(size, size, segs, segs); g.rotateX(-Math.PI / 2);
    const nz = vnoise(o.seed ?? 5), pos = g.attributes.position, cA = new THREE.Color(o.color), cB = new THREE.Color(o.color2 ?? o.color), cols = new Float32Array(pos.count * 3), tc = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z), ramp = Math.min(1, Math.max(0, (d - (o.flatR ?? 22)) / 30));
      const n = nz(x * (o.freq ?? 0.03) + 50, z * (o.freq ?? 0.03) + 50); let y = (o.y ?? -0.02) + ramp * (o.hills ?? 4) * (n - 0.3) + (o.ridge ? ramp * ramp * Math.max(0, n - 0.45) * o.ridge : 0);
      if (o.dunes) y += ramp * Math.sin(x * 0.08 + Math.sin(z * 0.05) * 2) * o.dunes;
      pos.setY(i, y); tc.copy(cA).lerp(cB, Math.min(1, Math.max(0, n * 1.6 - 0.4))); cols.set([tc.r, tc.g, tc.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.95, metalness: 0, flatShading: !!o.flat })); m.receiveShadow = true; group.add(m); return m;
  };
  // K.fog()를 먼저 호출해야 물·용암·구름바다에 안개가 적용된다
  const fogUniforms = () => ({ uFogC: { value: K.fogC }, uFogD: { value: K.fogD } });
  K.water = (o) => {
    const g = new THREE.PlaneGeometry(o.size ?? 900, o.size ?? 900, 220, 220); g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDeep: { value: raw(o.deep ?? 0x061a2a) }, uShallow: { value: raw(o.shallow ?? 0x1d6a7a) }, uSkyC: { value: raw(o.skyC ?? 0x9ab8d0) },
        uSun: { value: K.sunDir }, uSunCol: { value: K.sunCol }, uAmp: { value: o.amp ?? 0.35 }, uSpec: { value: o.spec ?? 1.6 }, ...fogUniforms() },
      vertexShader: `uniform float uTime,uAmp; varying vec3 vW; varying float vH;
        void main(){ vec4 w=modelMatrix*vec4(position,1.0); float h=sin(w.x*0.15+uTime*1.1)*0.5+sin(w.z*0.21+uTime*0.85)*0.35+sin((w.x+w.z)*0.42+uTime*1.9)*0.15;
          w.y+=h*uAmp; vH=h; vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uDeep,uShallow,uSkyC,uSun,uSunCol; uniform float uSpec; varying vec3 vW; varying float vH; ${FOG_GLSL}
        void main(){ vec3 n=normalize(cross(dFdx(vW),dFdy(vW))); if(n.y<0.0) n=-n; vec3 v=normalize(cameraPosition-vW);
          float fr=pow(1.0-max(dot(n,v),0.0),3.0); vec3 col=mix(uDeep,uShallow,clamp(vH*0.4+0.45,0.0,1.0)); col=mix(col,uSkyC,fr*0.75);
          vec3 r=reflect(-v,n); col+=uSunCol*pow(max(dot(r,uSun),0.0),90.0)*uSpec; col+=vec3(0.9)*smoothstep(0.7,0.95,vH)*0.25;
          gl_FragColor=vec4(applyFog(col,vW),1.0); }` });
    const m = new THREE.Mesh(g, mat); m.position.y = o.y ?? -1.2; m.frustumCulled = false; group.add(m); K.updaters.push((dt, t) => { mat.uniforms.uTime.value = t; }); return m;
  };
  K.lava = (o = {}) => {
    const g = new THREE.PlaneGeometry(o.size ?? 900, o.size ?? 900, 120, 120); g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, ...fogUniforms() },
      vertexShader: `uniform float uTime; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); w.y+=sin(w.x*0.1+uTime*0.6)*0.15+sin(w.z*0.13+uTime*0.4)*0.15; vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vW; ${GLSL_NOISE} ${FOG_GLSL}
        void main(){ vec2 p=vW.xz*0.06; float n=fbm(p+vec2(uTime*0.02,uTime*0.013)); float n2=fbm(p*2.7-vec2(uTime*0.05,0.0));
          float hot=smoothstep(0.42,0.62,n*0.7+n2*0.45); vec3 crust=vec3(0.06,0.02,0.02); vec3 lava=mix(vec3(1.4,0.25,0.03),vec3(2.2,1.1,0.2),smoothstep(0.7,1.0,hot*n2*1.6));
          vec3 col=mix(crust,lava,hot); gl_FragColor=vec4(applyFog(col,vW),1.0); }` });
    const m = new THREE.Mesh(g, mat); m.position.y = o.y ?? -1.4; m.frustumCulled = false; group.add(m); K.updaters.push((dt, t) => { mat.uniforms.uTime.value = t; }); return m;
  };
  K.cloudSea = (o = {}) => {
    const g = new THREE.PlaneGeometry(900, 900, 1, 1); g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCol: { value: raw(o.color ?? 0xffffff) }, uShade: { value: raw(o.shade ?? 0x8a90b0) }, ...fogUniforms() },
      vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uCol,uShade; varying vec3 vW; ${GLSL_NOISE} ${FOG_GLSL}
        void main(){ vec2 p=vW.xz*0.018+vec2(uTime*0.004,uTime*0.002); float n=fbm(p)*0.7+fbm(p*3.0+3.0)*0.3; vec3 col=mix(uShade,uCol,smoothstep(0.35,0.75,n));
          float a=smoothstep(0.25,0.55,n); gl_FragColor=vec4(applyFog(col,vW),a); }` });
    for (let i = 0; i < (o.layers ?? 3); i++) { const m = new THREE.Mesh(g, mat); m.position.y = (o.y ?? -10) - i * 2.5; m.frustumCulled = false; m.renderOrder = -1; group.add(m); }
    K.updaters.push((dt, t) => { mat.uniforms.uTime.value = t; });
  };
  // 산맥: shape = 'cone' | 'mesa' | 'spire', snow = 눈 덮인 정상
  K.mountains = (o) => {
    const r = mulberry(o.seed ?? 31), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), base = new THREE.Color(o.color), snow = new THREE.Color(o.snowColor ?? 0xeef3ff), band = new THREE.Color(o.band ?? o.color);
    for (let i = 0; i < (o.count ?? 40); i++) {
      const a = r() * TAU, R = (o.rMin ?? 150) + r() * ((o.rMax ?? 260) - (o.rMin ?? 150)), h = (o.hMin ?? 30) + r() * ((o.hMax ?? 90) - (o.hMin ?? 30)), w = (o.wMin ?? 18) + r() * (o.wMax ?? 30);
      const g = o.shape === 'mesa' ? new THREE.CylinderGeometry(w * (0.6 + r() * 0.3), w, h, 7 + ((r() * 4) | 0), 4) : new THREE.ConeGeometry(w, h, 7, 4);
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), tc = new THREE.Color();
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k), t = (y + h / 2) / h;
        if (y < h / 2 - 0.1 || o.shape === 'mesa') { pos.setX(k, pos.getX(k) * (0.85 + r() * 0.35)); pos.setZ(k, pos.getZ(k) * (0.85 + r() * 0.35)); if (o.shape !== 'mesa') pos.setY(k, y + (r() - 0.5) * h * 0.08); }
        if (o.shape === 'spire') { pos.setX(k, pos.getX(k) * (1 - t * 0.5)); pos.setZ(k, pos.getZ(k) * (1 - t * 0.5)); }
        tc.copy(base); if (o.shape === 'mesa') tc.lerp(band, (Math.sin(t * 22) * 0.5 + 0.5) * 0.6); if (o.snow && t > 0.68) tc.copy(snow); cols.set([tc.r, tc.g, tc.b], k * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.position.set(Math.sin(a) * R, h / 2 + (o.y ?? -4), Math.cos(a) * R); m.rotation.y = r() * TAU; group.add(m);
    }
  };
  // 인스턴스 배치: list = [{x,y,z,ry,s,sx,sy,sz}]
  K.inst = (geo, mat, list, shadow = true) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
    list.forEach((p, i) => { e.set(p.rx || 0, p.ry || 0, p.rz || 0); q.setFromEuler(e); sc.set(p.sx ?? p.s ?? 1, p.sy ?? p.s ?? 1, p.sz ?? p.s ?? 1); m4.compose(new V3(p.x, p.y ?? 0, p.z), q, sc); im.setMatrixAt(i, m4); });
    im.castShadow = shadow; im.receiveShadow = true; group.add(im); return im;
  };
  // 날씨 파티클: type = ember · snow · sand · petal · rain · firefly · ash · wind · spark · spray
  K.weather = (o) => {
    const type = o.type, n = o.count ?? 500, A = o.area ?? 40, H = o.height ?? 18;
    if (type === 'rain') {
      const pos = new Float32Array(n * 6), sp = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = K.r(-A, A), y = K.r(0, H), z = K.r(-A, A); pos.set([x, y, z, x - 0.05, y + 0.7, z], i * 6); sp[i] = K.r(18, 26); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: o.color ?? 0x9ab4ff, transparent: true, opacity: o.opacity ?? 0.45, depthWrite: false })); ls.frustumCulled = false; group.add(ls);
      K.updaters.push((dt) => { for (let i = 0; i < n; i++) { const j = i * 6; let y = pos[j + 1] - sp[i] * dt; if (y < -0.5) { y = H; pos[j] = pos[j + 3] = K.r(-A, A); pos[j + 2] = pos[j + 5] = K.r(-A, A); } pos[j + 1] = y; pos[j + 4] = y + 0.7; } g.attributes.position.needsUpdate = true; });
      return;
    }
    const pos = new Float32Array(n * 3), vel = [], ph = [];
    for (let i = 0; i < n; i++) { pos.set([K.r(-A, A), K.r(-1, H), K.r(-A, A)], i * 3); vel.push(K.r(0.4, 1)); ph.push(K.r(0, TAU)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const add = ['ember', 'firefly', 'spark'].includes(type);
    const mat = new THREE.PointsMaterial({ color: o.color ?? 0xffffff, size: o.size ?? 0.1, transparent: true, opacity: o.opacity ?? 0.85, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; group.add(pts);
    const wind = o.wind ?? [0.3, 0];
    K.updaters.push((dt, t) => {
      for (let i = 0; i < n; i++) {
        const j = i * 3, v = vel[i], p = ph[i];
        if (type === 'snow') { pos[j + 1] -= v * 1.6 * dt; pos[j] += (Math.sin(t + p) * 0.4 + wind[0]) * dt; pos[j + 2] += (Math.cos(t * 0.7 + p) * 0.3 + wind[1]) * dt; }
        else if (type === 'sand' || type === 'wind') { const s = type === 'wind' ? 14 : 6; pos[j] += (wind[0] * s + Math.sin(t * 2 + p)) * v * dt; pos[j + 2] += wind[1] * s * v * dt; pos[j + 1] += Math.sin(t * 3 + p) * 0.3 * dt; }
        else if (type === 'petal') { pos[j + 1] -= v * 0.7 * dt; pos[j] += (1.2 + Math.sin(t * 1.5 + p)) * v * dt; pos[j + 2] += Math.cos(t + p) * 0.6 * dt; }
        else if (type === 'firefly') { pos[j] += Math.sin(t * 0.7 + p) * 0.5 * dt; pos[j + 1] += Math.sin(t * 1.1 + p * 2) * 0.35 * dt; pos[j + 2] += Math.cos(t * 0.6 + p) * 0.5 * dt; }
        else if (type === 'ash') { pos[j + 1] -= v * 0.6 * dt; pos[j] += (wind[0] + Math.sin(t + p) * 0.3) * dt; }
        else { pos[j + 1] += v * (type === 'spark' ? 0.4 : 0.9) * dt; pos[j] += Math.sin(t * 0.7 + i) * 0.3 * dt; pos[j + 2] += 0.2 * dt; } // ember · spark · spray
        if (pos[j + 1] > H) pos[j + 1] = -1; if (pos[j + 1] < -1.2) pos[j + 1] = H;
        if (pos[j] > A) pos[j] = -A; if (pos[j] < -A) pos[j] = A; if (pos[j + 2] > A) pos[j + 2] = -A; if (pos[j + 2] < -A) pos[j + 2] = A;
      }
      if (type === 'firefly') mat.opacity = (o.opacity ?? 0.9) * (0.65 + 0.35 * Math.sin(t * 3));
      g.attributes.position.needsUpdate = true;
    });
  };
  K.windowTexture = windowTexture;
  K.spin = (obj, axis, speed) => K.updaters.push((dt) => { obj.rotation[axis] += speed * dt; });
  K.bob = (obj, amp, speed) => { const y0 = obj.position.y, p = K.r(0, TAU); K.updaters.push((dt, t) => { obj.position.y = y0 + Math.sin(t * speed + p) * amp; }); };

  /* ---------- 결투장 안 장애물 (충돌) ----------
     원기둥: { t:'c', x, z, r, y0, top }   상자: { t:'b', x, z, hw, hd, c, s, y0, top } (ry 회전)
     top 이 낮으면(점프 높이 1.7m 이하) 위에 올라설 수 있다. */
  K.colliders = []; K.occ = []; K.hazards = [];
  const solid = (mesh, col) => {
    K.colliders.push(col);
    if (mesh) { const list = Array.isArray(mesh) ? mesh : [mesh]; for (const m of list) { m.material = m.material.clone(); m.userData.fade = 1; K.occ.push(m); } col.meshes = list; }
    return mesh;
  };
  K.solid = solid;
  K.cylS = (x, z, r, h, mat, o = {}) => { const y0 = o.y0 ?? 0, m = K.mesh(new THREE.CylinderGeometry(o.rTop ?? r, r, h, o.seg ?? 14), mat, x, y0 + h / 2, z); if (o.ry) m.rotation.y = o.ry; return solid(m, { t: 'c', x, z, r: o.colR ?? r, y0, top: y0 + h }); };
  K.boxS = (x, z, w, d, h, ry, mat, o = {}) => { const y0 = o.y0 ?? 0, m = K.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z); m.rotation.y = ry; return solid(m, { t: 'b', x, z, hw: w / 2, hd: d / 2, c: Math.cos(ry), s: Math.sin(ry), y0, top: y0 + h }); };
  K.rockS = (x, z, r, h, mat) => { const m = K.mesh(new THREE.DodecahedronGeometry(1, 0), mat, x, h * 0.42, z); m.scale.set(r, h * 0.55, r * K.r(0.85, 1.1)); m.rotation.y = K.r(0, TAU); return solid(m, { t: 'c', x, z, r: r * 0.86, y0: 0, top: h * 0.9 }); };
  // 장애물 콜라이더만 (보이는 모양은 직접 만든 경우)
  K.colC = (x, z, r, top, meshes) => solid(meshes || null, { t: 'c', x, z, r, y0: 0, top });
  K.colB = (x, z, w, d, top, ry, meshes) => solid(meshes || null, { t: 'b', x, z, hw: w / 2, hd: d / 2, c: Math.cos(ry), s: Math.sin(ry), y0: 0, top });
  // 위험 지대: 서 있으면 주기적으로 피해 (체력 1 아래로는 깎지 않음)
  K.hazard = (x, z, r, dps, color) => K.hazards.push({ x, z, r, dps, color });

  // 장애물 질의 (fighter · 투사체 · AI 가 사용)
  const toLocal = (b, x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; };
  const inside = (c, x, z, pad) => {
    if (c.t === 'c') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
    const [lx, lz] = toLocal(c, x, z); return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad;
  };
  const world = {
    colliders: K.colliders, hazards: K.hazards, occ: K.occ,
    // (x,z)에서 높이 y 기준 발을 디딜 수 있는 가장 높은 면
    groundAt(x, z, y) { let g = 0; for (const c of K.colliders) if (c.top <= y + 0.35 && c.top > g && inside(c, x, z, 0.12)) g = c.top; return g; },
    // 반경 rad 원(높이 y~y+1.7)을 장애물 밖으로 밀어낸다. 밀린 법선을 돌려준다
    push(p, rad) {
      let nx = 0, nz = 0, hit = false;
      for (const c of K.colliders) {
        if (c.top <= p.y + 0.35 || c.y0 >= p.y + 1.7) continue;
        if (c.t === 'c') {
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad;
          if (d < m) { const ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0; p.x = c.x + ux * m; p.z = c.z + uz * m; nx += ux; nz += uz; hit = true; }
        } else {
          const [lx, lz] = toLocal(c, p.x, p.z), cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz));
          let ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz), qx, qz, lnx, lnz;
          if (d > 1e-4) { if (d >= rad) continue; lnx = ox / d; lnz = oz / d; qx = cx + lnx * rad; qz = cz + lnz * rad; }
          else { const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz); if (px < pz) { lnx = Math.sign(lx) || 1; lnz = 0; qx = lnx * (c.hw + rad); qz = lz; } else { lnx = 0; lnz = Math.sign(lz) || 1; qx = lx; qz = lnz * (c.hd + rad); } }
          p.x = c.x + qx * c.c + qz * c.s; p.z = c.z - qx * c.s + qz * c.c; nx += lnx * c.c + lnz * c.s; nz += -lnx * c.s + lnz * c.c; hit = true;
        }
      }
      if (!hit) return null; const l = Math.hypot(nx, nz) || 1; return { x: nx / l, z: nz / l };
    },
    // 점(반경 r)이 장애물 안인지 (투사체용)
    solidAt(p, r) { for (const c of K.colliders) if (p.y < c.top && p.y > c.y0 - r && inside(c, p.x, p.z, r)) return true; return false; },
    // 앞쪽 dist 거리 안에서 막는 장애물의 최대 높이 (없으면 0) — AI 길찾기용
    blockedAhead(p, dx, dz, dist, rad = 0.45) {
      let top = 0; for (let k = 1; k <= 3; k++) { const x = p.x + dx * dist * k / 3, z = p.z + dz * dist * k / 3;
        for (const c of K.colliders) if (c.top > p.y + 0.35 && c.y0 < p.y + 1.7 && inside(c, x, z, rad)) top = Math.max(top, c.top - p.y); }
      return top;
    },
  };
  K.finish = () => ({
    group, sunDir: K.sunDir, world,
    flashSky(a) { K.flashA = Math.max(K.flashA, a); },
    setTint(color, a) { if (!K.skyMat) return; K.skyMat.uniforms.uTint.value.setHex(color, THREE.LinearSRGBColorSpace); K.skyMat.uniforms.uTintA.value = a; },
    update(dt, t) {
      if (K.skyMat) { K.skyMat.uniforms.uTime.value = t; K.flashA = Math.max(0, K.flashA - dt * 2.5); K.skyMat.uniforms.uFlash.value = K.flashA; }
      for (const u of K.updaters) u(dt, t);
    },
    dispose() {
      scene.remove(group); scene.fog = null;
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) { for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); }
        if (o.isLight && o.dispose) o.dispose();
      });
    },
  });
  return K;
}
