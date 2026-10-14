// 몬스터 제작 도구: 모델(부품 조합) · 기술 변형 · 공격 도우미 · 맵별 몬스터 세트 공장(makeSet)
// 캐릭터 정의와 같은 형식에 ai(행동)와 stats.daze(그로기) · stats.armor(슈퍼아머)가 추가된다.
// 기술의 tele: [시간, 'yellow' | 'red'] — 공격 예고 빛. 노랑은 패리 가능, 빨강(unblock)은 회피해야 한다.
// 피격 데이터의 st: [종류, 시간, 세기] — 맞으면 상태 효과(slow · burn · bleed · vuln)를 건다.
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { Projectile, areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import trainer from '../characters/trainer.js';
import { buildQuad, quadPoses, quadRun, buildGolem, buildFloater, floatPoses, buildDrone } from './bodies.js';

export const V3 = THREE.Vector3, TAU = Math.PI * 2;
const UP = new V3(0, 1, 0);
const DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.21, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44, headTop: 0.24 };
const T = trainer.moves;
export const poses = trainer.poses;

/* =====================================================================
   모델: 몸통 + 머리 · 무기 · 장식 부품을 조합한다
   o = { weapon, head, horns, tail, wings, cape, hat, mane, crown, halo, fins, shell(장갑 질감), bulk }
   ===================================================================== */
const G0 = new Map(); const geo = (k, f) => { if (!G0.has(k)) G0.set(k, f()); return G0.get(k); };
export function construct(pal, o = {}) {
  if (typeof o === 'string') o = { weapon: o };
  const m = buildHumanoid(DIMS), J = m.J, bulk = (o.bulk || 1) * (o.thin ? 0.55 : 1);
  const body = new THREE.MeshStandardMaterial({ color: pal.body ?? 0x15121c, metalness: o.metal ?? 0.35, roughness: o.rough ?? 0.5 });
  const shell = new THREE.MeshStandardMaterial({ color: pal.armor, metalness: o.metal ?? 0.5, roughness: o.rough ?? 0.3, flatShading: o.flat ?? true });
  const glow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: pal.accent, emissiveIntensity: 2.6 });
  const trim = new THREE.MeshStandardMaterial({ color: pal.trim ?? 0xc8a050, metalness: 0.8, roughness: 0.3 });
  const cloth = new THREE.MeshStandardMaterial({ color: pal.cloth ?? pal.armor, roughness: 0.85, side: THREE.DoubleSide });
  const add = (parent, g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(g, mat); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); parent.add(me); return me; };
  const limb = (parent, len, r, mat) => add(parent, new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 8), mat, 0, -len / 2, 0);
  // 몸통
  add(J.hips, new THREE.BoxGeometry(0.3 * bulk, 0.16, 0.2 * bulk), shell, 0, -0.02, 0);
  add(J.spine, new THREE.CapsuleGeometry(0.12 * bulk, 0.1, 4, 8), body, 0, 0.1, 0);
  if (o.thin) { // 해골 · 미라: 갈비뼈 고리와 등뼈
    const bone = o.wrap ? cloth : new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 });
    for (let i = 0; i < 4; i++) { const r = add(J.chest, new THREE.TorusGeometry(0.13 - i * 0.012, 0.014, 5, 14), bone, 0, 0.05 + i * 0.075, 0.01, Math.PI / 2); r.scale.set(1.1, 0.85, 1); }
    add(J.chest, new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), bone, 0, 0.16, -0.08); add(J.spine, new THREE.CylinderGeometry(0.02, 0.02, 0.26, 6), bone, 0, 0.1, -0.04);
    if (o.wrap) for (let i = 0; i < 6; i++) add(J.chest, new THREE.TorusGeometry(0.14, 0.02, 4, 12), cloth, 0, i * 0.06, 0, Math.PI / 2 + Math.sin(i) * 0.2, 0, Math.cos(i) * 0.2);
  } else { const tor = add(J.chest, new THREE.IcosahedronGeometry(0.22, o.smooth ? 2 : 0), shell, 0, 0.15, 0); tor.scale.set(1.1 * bulk, 1, 0.8 * bulk); }
  add(J.chest, new THREE.OctahedronGeometry(0.07), glow, 0, 0.16, 0.15 * bulk);
  if (o.spikes !== false) for (const s of [-1, 1]) add(J.chest, new THREE.ConeGeometry(0.06, 0.32, 5), shell, s * 0.2 * bulk, 0.32, -0.04, 0, 0, -s * 0.5);
  add(J.neck, new THREE.CylinderGeometry(0.045, 0.055, 0.12, 8), body, 0, 0.03, 0);
  // 머리
  const H = J.head, hd = o.head || 'crystal'; if (o.bigHead) H.scale.setScalar(o.bigHead); // 큰 머리 (고블린 · 임프)
  if (hd === 'crystal') { const h = add(H, new THREE.OctahedronGeometry(0.13), shell, 0, 0.12, 0); h.scale.set(0.9, 1.25, 1); add(H, new THREE.BoxGeometry(0.16, 0.025, 0.04), glow, 0, 0.13, 0.1); for (const s of [-1, 1]) add(H, new THREE.ConeGeometry(0.03, 0.22, 4), shell, s * 0.08, 0.27, -0.02, -0.4, 0, -s * 0.35); }
  else if (hd === 'skull') { const h = add(H, new THREE.SphereGeometry(0.115, 14, 10), shell, 0, 0.13, 0); h.scale.set(0.92, 1.05, 1.05); add(H, new THREE.BoxGeometry(0.13, 0.05, 0.1), shell, 0, 0.04, 0.04); for (const s of [-1, 1]) add(H, new THREE.SphereGeometry(0.028, 8, 6), glow, s * 0.045, 0.13, 0.095); add(H, new THREE.ConeGeometry(0.015, 0.03, 3), body, 0, 0.09, 0.11, -Math.PI / 2); }
  else if (hd === 'beast') { const h = add(H, new THREE.SphereGeometry(0.12, 12, 10), shell, 0, 0.12, 0); h.scale.set(0.95, 0.9, 1.05); add(H, new THREE.ConeGeometry(0.06, 0.2, 6), shell, 0, 0.09, 0.15, Math.PI / 2); add(H, new THREE.SphereGeometry(0.02, 6, 5), body, 0, 0.1, 0.25); for (const s of [-1, 1]) { add(H, new THREE.ConeGeometry(0.035, 0.12, 4), shell, s * 0.07, 0.24, -0.01, 0, 0, -s * 0.25); add(H, new THREE.SphereGeometry(0.018, 6, 5), glow, s * 0.045, 0.15, 0.1); } }
  else if (hd === 'goblin') { const h = add(H, new THREE.SphereGeometry(0.11, 12, 10), shell, 0, 0.12, 0); h.scale.set(1.05, 0.95, 1); add(H, new THREE.ConeGeometry(0.025, 0.09, 6), shell, 0, 0.1, 0.13, Math.PI / 2.4); for (const s of [-1, 1]) { add(H, new THREE.ConeGeometry(0.035, 0.2, 4), shell, s * 0.14, 0.15, -0.01, 0, 0, -s * 1.25); add(H, new THREE.SphereGeometry(0.02, 6, 5), glow, s * 0.045, 0.14, 0.095); } }
  else if (hd === 'helmet') { add(H, new THREE.CylinderGeometry(0.11, 0.12, 0.2, 10), shell, 0, 0.13, 0); add(H, new THREE.SphereGeometry(0.11, 10, 6, 0, TAU, 0, Math.PI / 2), shell, 0, 0.23, 0); add(H, new THREE.BoxGeometry(0.15, 0.022, 0.03), glow, 0, 0.14, 0.11); add(H, new THREE.BoxGeometry(0.025, 0.1, 0.24), trim, 0, 0.27, -0.01); }
  else if (hd === 'mask') { const h = add(H, new THREE.SphereGeometry(0.12, 12, 10), shell, 0, 0.13, 0); h.scale.set(1, 1.05, 1); for (const s of [-1, 1]) { add(H, new THREE.ConeGeometry(0.03, 0.16, 6), trim, s * 0.07, 0.27, 0, 0, 0, -s * 0.3); add(H, new THREE.ConeGeometry(0.012, 0.05, 4), new THREE.MeshStandardMaterial({ color: 0xf0ead8 }), s * 0.04, 0.06, 0.1, Math.PI); add(H, new THREE.SphereGeometry(0.022, 6, 5), glow, s * 0.045, 0.15, 0.1); } add(H, new THREE.BoxGeometry(0.09, 0.012, 0.02), body, 0, 0.08, 0.115); }
  else if (hd === 'visor') { add(H, new THREE.BoxGeometry(0.2, 0.19, 0.21), shell, 0, 0.13, 0); add(H, new THREE.BoxGeometry(0.21, 0.045, 0.02), glow, 0, 0.15, 0.106); add(H, new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), trim, 0.08, 0.28, -0.03); add(H, new THREE.SphereGeometry(0.016, 6, 5), glow, 0.08, 0.36, -0.03); }
  else if (hd === 'hood') { add(H, new THREE.ConeGeometry(0.15, 0.36, 10, 1, true), cloth, 0, 0.18, -0.01); add(H, new THREE.SphereGeometry(0.1, 10, 8), body, 0, 0.12, 0.0); for (const s of [-1, 1]) add(H, new THREE.SphereGeometry(0.018, 6, 5), glow, s * 0.035, 0.13, 0.09); }
  else if (hd === 'fish') { const h = add(H, new THREE.SphereGeometry(0.12, 12, 10), shell, 0, 0.12, 0.03); h.scale.set(0.85, 0.95, 1.35); add(H, new THREE.ConeGeometry(0.1, 0.2, 3), cloth, 0, 0.26, -0.04, -0.3); for (const s of [-1, 1]) { add(H, new THREE.SphereGeometry(0.03, 8, 6), glow, s * 0.07, 0.15, 0.1); add(H, new THREE.ConeGeometry(0.05, 0.14, 3), cloth, s * 0.12, 0.12, -0.02, 0, 0, -s * 1.3); } }
  else if (hd === 'star') { const h = add(H, new THREE.IcosahedronGeometry(0.12, 0), shell, 0, 0.13, 0); h.scale.set(0.9, 1.15, 0.95); add(H, new THREE.BoxGeometry(0.15, 0.02, 0.03), glow, 0, 0.14, 0.1); }
  else if (hd === 'stone') { const h = add(H, new THREE.DodecahedronGeometry(0.13, 0), shell, 0, 0.12, 0); h.scale.set(1.1, 0.9, 1); for (const s of [-1, 1]) add(H, new THREE.BoxGeometry(0.04, 0.02, 0.02), glow, s * 0.05, 0.13, 0.11); }
  // 장식
  if (o.horns) for (const s of [-1, 1]) { const hn = add(H, new THREE.ConeGeometry(0.035, o.horns, 6), trim, s * 0.09, 0.22 + o.horns * 0.3, -0.02, -0.35, 0, -s * 0.55); hn.castShadow = true; }
  if (o.crown) for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; add(H, new THREE.ConeGeometry(0.02, 0.1, 4), trim, Math.sin(a) * 0.1, 0.29, Math.cos(a) * 0.1); }
  if (o.halo) { const r = add(H, new THREE.TorusGeometry(0.2, 0.012, 6, 28), glow, 0, 0.42, -0.04, Math.PI / 2 - 0.2); r.userData.spin = 1; }
  if (o.hat === 'tricorn') { add(H, new THREE.CylinderGeometry(0.21, 0.24, 0.05, 3), body, 0, 0.25, 0); add(H, new THREE.CylinderGeometry(0.11, 0.12, 0.12, 12), body, 0, 0.3, 0); add(H, new THREE.TorusGeometry(0.2, 0.01, 4, 3), trim, 0, 0.27, 0, Math.PI / 2); }
  if (o.hat === 'straw') { add(H, new THREE.ConeGeometry(0.3, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0xc8a868, roughness: 0.9 }), 0, 0.3, 0); }
  if (o.hat === 'nemes') { add(H, new THREE.CylinderGeometry(0.13, 0.2, 0.32, 4, 1, true), trim, 0, 0.12, -0.05, 0, Math.PI / 4); add(H, new THREE.BoxGeometry(0.03, 0.06, 0.03), glow, 0, 0.27, 0.11); }
  if (o.mane) for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3; add(H, new THREE.ConeGeometry(0.05, 0.3, 4), cloth, Math.sin(a) * 0.12, 0.12 + Math.cos(a) * 0.03, -0.1, -1.9 + Math.abs(a) * 0.2, 0, a * 0.5); }
  if (o.fins) for (const s of [-1, 1]) add(J.chest, new THREE.ConeGeometry(0.06, 0.4, 3), cloth, s * 0.12, 0.3, -0.17, -0.7, 0, s * 0.2);
  if (o.tail) { let p = J.hips; for (let i = 0; i < 5; i++) { const g = new THREE.Group(); g.position.set(0, i ? -0.1 : -0.02, i ? 0 : -0.14); g.rotation.x = i ? 0.25 : 1.9; p.add(g); add(g, new THREE.ConeGeometry(0.05 * (1 - i * 0.15) * (o.tail.w || 1), 0.16, 6), o.tail.glow ? glow : shell, 0, -0.06, 0, Math.PI); p = g; if (o.tail.n && i === 4) for (let k = 0; k < o.tail.n; k++) add(g, new THREE.ConeGeometry(0.04, 0.5, 6), glow, (k - (o.tail.n - 1) / 2) * 0.09, -0.3, 0, Math.PI, 0, (k - (o.tail.n - 1) / 2) * 0.35); } }
  if (o.wings) for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.12, 0.3, -0.15); w.rotation.set(0.25, -s * 0.5, s * 0.35); J.chest.add(w); for (let k = 0; k < 4; k++) add(w, new THREE.BoxGeometry(0.42 - k * 0.07, 0.012, 0.11), o.wings === 'glow' ? glow : cloth, s * (0.24 - k * 0.02), 0.06 - k * 0.08, 0, 0, 0, s * (0.2 + k * 0.22)); }
  if (o.cape) { const c = add(J.chest, new THREE.PlaneGeometry(0.42, 0.9, 1, 4), cloth, 0, -0.1, -0.2, 0.12); c.geometry.translate(0, -0.12, 0); }
  if (o.pack) add(J.chest, new THREE.BoxGeometry(0.26, 0.3, 0.14), trim, 0, 0.12, -0.2);
  // 팔 · 다리
  for (const [sh, el, ha] of [[J.shoulderL, J.elbowL, J.handL], [J.shoulderR, J.elbowR, J.handR]]) {
    add(sh, new THREE.DodecahedronGeometry(0.09 * bulk, 0), shell); limb(sh, DIMS.uArm, 0.05 * bulk, body); add(el, new THREE.SphereGeometry(0.035, 8, 6), glow); limb(el, DIMS.lArm, 0.048 * bulk, shell);
    add(ha, new THREE.BoxGeometry(0.075, 0.1, 0.07), body, 0, -0.04, 0);
  }
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    limb(hp, DIMS.thigh, 0.072 * bulk, body); add(kn, new THREE.SphereGeometry(0.045, 8, 6), glow); limb(kn, DIMS.shin, 0.06 * bulk, shell);
    add(ft, new THREE.ConeGeometry(0.07, 0.26, 4), shell, 0, -0.04, 0.06, Math.PI / 2, 0, 0);
  }
  // 무기 (J.weapon 의 +Z 방향)
  const W = J.weapon, wp = o.weapon || 'dagger'; let len = 1.1;
  const pole = (l, r = 0.022, mat = body) => add(W, new THREE.CylinderGeometry(r, r, l, 8), mat, 0, 0, l / 2 - 0.15, Math.PI / 2);
  if (wp === 'claw') { len = 0.75; for (const x of [-0.035, 0, 0.035]) add(W, new THREE.BoxGeometry(0.012, 0.03, 0.7), glow, x, 0, 0.42); }
  else if (wp === 'hammer') { len = 1.3; add(W, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), body, 0, 0, 0.5, Math.PI / 2); add(W, new THREE.BoxGeometry(0.34, 0.34, 0.5), shell, 0, 0, 1.15); add(W, new THREE.BoxGeometry(0.36, 0.06, 0.52), glow, 0, 0, 1.15); }
  else if (wp === 'greatsword') { len = 1.7; add(W, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), body, 0, 0, 0, Math.PI / 2); add(W, new THREE.BoxGeometry(0.3, 0.05, 0.06), shell, 0, 0, 0.16); add(W, new THREE.BoxGeometry(0.04, 0.2, 1.5), shell, 0, 0, 0.95); add(W, new THREE.BoxGeometry(0.045, 0.03, 1.5), glow, 0, 0.1, 0.95); }
  else if (wp === 'sword' || wp === 'scimitar' || wp === 'katana') { len = wp === 'katana' ? 1.05 : 0.95; add(W, new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), body, 0, 0, 0, Math.PI / 2); add(W, new THREE.BoxGeometry(wp === 'katana' ? 0.08 : 0.2, 0.03, 0.04), trim, 0, 0, 0.11); const b = add(W, new THREE.BoxGeometry(0.012, wp === 'scimitar' ? 0.09 : 0.05, len - 0.12), shell, 0, 0, 0.12 + (len - 0.12) / 2); if (wp !== 'sword') b.rotation.x = -0.08; add(W, new THREE.BoxGeometry(0.014, 0.012, len - 0.12), glow, 0, wp === 'scimitar' ? 0.045 : 0.026, 0.12 + (len - 0.12) / 2); }
  else if (wp === 'spear' || wp === 'trident') { len = 1.9; pole(1.75, 0.02); if (wp === 'spear') add(W, new THREE.ConeGeometry(0.05, 0.32, 4), glow, 0, 0, 1.75, Math.PI / 2); else for (const x of [-0.08, 0, 0.08]) add(W, new THREE.ConeGeometry(0.022, 0.26, 4), glow, x, 0, 1.72 + (x ? -0.04 : 0), Math.PI / 2); if (wp === 'trident') add(W, new THREE.BoxGeometry(0.2, 0.025, 0.025), trim, 0, 0, 1.58); }
  else if (wp === 'club') { len = 1.1; add(W, new THREE.CylinderGeometry(0.11, 0.04, 1.0, 8), shell, 0, 0, 0.5, Math.PI / 2); for (let i = 0; i < 6; i++) add(W, new THREE.ConeGeometry(0.03, 0.09, 4), trim, Math.cos(i) * 0.1, Math.sin(i) * 0.1, 0.75 + (i % 3) * 0.1, 0, 0, i); }
  else if (wp === 'axe') { len = 1.2; pole(1.15); const h = add(W, new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12, 1, false, 0, Math.PI), shell, 0, 0.0, 0.95, 0, 0, Math.PI / 2); h.rotation.set(0, Math.PI / 2, 0); add(W, new THREE.BoxGeometry(0.03, 0.04, 0.42), glow, 0, 0.2, 0.95); }
  else if (wp === 'staff') { len = 1.5; pole(1.45, 0.02); add(W, new THREE.OctahedronGeometry(0.09), glow, 0, 0, 1.36); add(W, new THREE.TorusGeometry(0.1, 0.012, 6, 16), trim, 0, 0, 1.36); }
  else if (wp === 'bow') { len = 0.6; const g = add(W, new THREE.TorusGeometry(0.42, 0.016, 6, 20, Math.PI * 0.8), shell, 0, 0, 0.1, 0, Math.PI / 2, Math.PI * 0.6); g.position.z = -0.18; add(W, new THREE.CylinderGeometry(0.003, 0.003, 0.8, 3), glow, 0, 0, -0.06); }
  else if (wp === 'pistol' || wp === 'blaster') { len = 0.45; add(W, new THREE.BoxGeometry(0.05, 0.12, 0.08), body, 0, -0.04, 0); add(W, new THREE.CylinderGeometry(0.025, 0.03, 0.36, 8), wp === 'blaster' ? shell : trim, 0, 0.03, 0.18, Math.PI / 2); add(W, new THREE.TorusGeometry(0.03, 0.006, 4, 10), glow, 0, 0.03, 0.36); }
  else if (wp === 'shuriken' || wp === 'orb' || wp === 'flame' || wp === 'rock') { len = 0.3; const g = wp === 'shuriken' ? new THREE.OctahedronGeometry(0.08) : wp === 'rock' ? new THREE.DodecahedronGeometry(0.09) : new THREE.SphereGeometry(0.08, 10, 8); const s = add(J.handL, g, wp === 'rock' ? shell : glow, 0, -0.08, 0.04); if (wp === 'shuriken') s.scale.set(1, 0.2, 1); }
  else { len = 0.5; add(W, new THREE.BoxGeometry(0.02, 0.05, 0.45), glow, 0, 0, 0.28); }
  const spin = []; m.root.traverse((x) => x.userData.spin && spin.push(x));
  return { ...m, sole: 0.07, update(dt) { for (const s of spin) s.rotation.z += dt * 1.2; },
    tipPos(out) { return W.localToWorld(out.set(0, 0, len)); },
    weaponPts(b, t) { W.localToWorld(b.set(0, 0, 0.2)); W.localToWorld(t.set(0, 0, len)); } };
}

/* =====================================================================
   기술 변형: 원본 기술 앞에 '자세 잡기(windup)'를 넣고 k배 느리게 → 적 공격이 읽힌다
   ===================================================================== */
export function slow(src, { k = 1.2, windup = 0.4, tele = 'yellow', dmg = 1, unblock = false, ev, hits, lunge, next, cancel, st } = {}) {
  const sh = (t) => windup + t * k;
  const keys = [src.keys[0], [windup, {}], ...src.keys.slice(1).map(([t, p]) => [sh(t), p])];
  return {
    dur: sh(src.dur), trail: src.trail, track: windup * 0.85, aim: true, keys, tele: tele ? [windup * 0.3, tele] : null, next, cancel: cancel ?? (next ? sh(src.cancel ?? src.dur * 0.6) : undefined),
    lunge: lunge ?? (src.lunge || []).map(([a, b, s]) => [sh(a), sh(b), s / k]),
    ev: ev ?? (src.ev || []).filter(([t]) => t > 0.001).map(([t, fn]) => [sh(t), fn]),
    hits: hits ?? (src.hits || []).map((h) => ({ ...h, t0: sh(h.t0), t1: sh(h.t1), dmg: h.dmg * dmg, unblock: unblock || h.unblock, noCrit: true, ...(st ? { st } : {}) })),
  };
}
export const swish = (f) => { sfx('swing'); f.slashFx({ tilt: 0.15, r: 1.35 * f.scale, at: [0, 1.15 * f.scale, 0.35] }); };
export const chop = (f) => { sfx('heavy'); f.slashFx({ tilt: Math.PI / 2, r: 1.4 * f.scale, at: [0.05, 1.1 * f.scale, 0.3], flip: true }); };
export function slam(f, G, r, dmg, color, st) {
  const c = f.local([0, 0, 1.2 * f.scale]).setY(0.06); sfx('boom'); G.shake(0.35);
  G.fx.ring(c, { normal: UP, r0: 0.4, r1: r * 1.2, life: 0.55, color }); G.fx.ring(c, { normal: UP, r0: 0.2, r1: r * 0.8, life: 0.4, color: 0xffffff });
  G.fx.burst(c, 40, [color, 0xffffff], 12, { dir: UP, spread: 1.3 }); G.fx.burst(c, 22, 0x6a5a70, 6, { kind: 'dust', sk: 1.5 }); G.fx.light(c.clone().setY(1), color, 90, 0.35);
  areaHit(f, c, r, { dmg, kb: [7, 7], stun: 0.6, hs: 0.1, shake: 0.15, unblock: true, noCrit: true, ...(st ? { st } : {}) });
}
// 투사체: 무기 끝(없으면 왼손)에서 상대 가슴으로. n발이면 부채꼴
export function shot(f, o, G, { dmg = 40, speed = 13, homing = 0.6, r = 0.3, spread = 0, n = 1, color, st, arc = 0 } = {}) {
  const h = f.model.tipPos ? f.model.tipPos(new V3()) : f.model.J.handL.getWorldPosition(new V3());
  for (let i = 0; i < n; i++) {
    const d = o.chest(new V3()).sub(h).normalize(), a = spread + (n > 1 ? (i - (n - 1) / 2) * 0.22 : 0);
    if (a) d.applyAxisAngle(UP, a); if (arc) { d.y += arc; d.normalize(); }
    G.spawn(new Projectile(G, { owner: f, pos: h.clone().addScaledVector(d, 0.3), vel: d.multiplyScalar(speed), r, color: color ?? f.palette.accent, homing, life: 3, hit: { dmg, kb: [4, 3], stun: 0.45, hs: 0.06, noCrit: true, ...(st ? { st } : {}) } }));
  }
  sfx('shot');
}
// 바닥 경고 → 폭발 기둥. style: 'up'(솟음) · 'fall'(하늘에서 떨어짐: 운석 · 고드름 · 포탄 · 별)
export function pillar(G, f, x, z, delay, { color, color2 = 0xffffff, dmg = 85, r = 1.6, st, style = 'up', warn = 0.9 } = {}) {
  let t = -delay, warned = false, boom = false; const col = color ?? f.palette.accent;
  return { done: false, owner: f, update(dt) {
    t += dt; if (t < 0) return;
    if (t < warn) {
      if (!warned) { warned = true; G.fx.ring(new V3(x, 0.05, z), { normal: UP, r0: r + 0.1, r1: r, life: warn, color: 0xff2a3a, op: 0.9 }); }
      if (Math.random() < 0.5) G.fx.p(new V3(x + rand(-r, r) * 0.9, 0.1, z + rand(-r, r) * 0.9), { vel: [0, rand(1, 3), 0], life: 0.4, size: 0.14, color: col });
      if (style === 'fall' && t > warn - 0.35) { const k = (warn - t) / 0.35; G.fx.p(new V3(x, 0.3 + k * 14, z), { size: 0.9, size1: 0.3, life: 0.12, color: col, alpha: 1 }); G.fx.burst(new V3(x, 0.3 + k * 14, z), 2, [col, color2], 2, { lk: 0.5 }); }
    } else if (!boom) {
      boom = true;
      if (style === 'up') G.fx.beam(new V3(x, 0, z), { r: r * 0.75, h: 14, color: col, life: 0.6 });
      G.fx.ring(new V3(x, 0.06, z), { normal: UP, r0: 0.3, r1: r * 1.6, life: 0.5, color: col });
      G.fx.burst(new V3(x, 0.5, z), 30, [col, color2], 10, { dir: UP, spread: style === 'up' ? 0.6 : 1.4 }); G.fx.light(new V3(x, 1, z), col, 80, 0.35);
      sfx('boom'); G.shake(0.2); areaHit(f, new V3(x, 0, z), r, { dmg, kb: [3, 9], stun: 0.6, hs: 0.08, unblock: true, noCrit: true, ...(st ? { st } : {}) }, 3);
    }
    if (t > warn + 0.6) this.done = true;
  }, kill() { this.done = true; } };
}

/* =====================================================================
   몸 형태 선택: r.plan = 'biped'(기본) · 'quad'(네발 · 전갈 · 켄타우로스) · 'golem'(거구) · 'float'(떠다님) · 'drone'
   ===================================================================== */
const golemPoses = (() => { const o = {}; for (const k in poses) o[k] = { ...poses[k] }; o.base = { ...poses.base, spine: [0.32, 0.12, 0], chest: [0.12, 0.1, 0], head: [-0.3, 0, 0], shoulderL: [0.05, 0, 0.32], shoulderR: [0.1, 0, -0.32], elbowL: [-0.3, 0, 0], elbowR: [-0.4, 0, 0] }; return o; })();
const floaterPoses = floatPoses(poses);
function bodyOf(r) {
  const o = { ...(r.model || {}), kind: r.kind };
  if (r.plan === 'quad') return { createModel: (p) => buildQuad(p, o), poses: quadPoses(r.kind), runCycle: quadRun };
  if (r.plan === 'golem') return { createModel: (p) => buildGolem(p, o), poses: golemPoses };
  if (r.plan === 'float') return { createModel: (p) => buildFloater(p, o), poses: floaterPoses };
  if (r.plan === 'drone') return { createModel: (p) => buildDrone(p, o), poses: floaterPoses };
  return { createModel: (p) => construct(p, r.model), poses };
}
// 네발 짐승 기술: 물기 · 앞발 할퀴기 · 덮치기 · 돌진 · 꼬리 회전 · 포효(기둥 소환) / 켄타우로스: 창 찌르기 · 앞발 들어 짓밟기 · 돌격
function quadKit(kind, k = 1, st) {
  const P = kind === 'centaur' ? 1.5 : 1.45, N = kind === 'centaur' ? -1.5 : kind === 'scorpion' ? -1.2 : -1.15, S = st ? { st } : {}, cen = kind === 'centaur';
  const H = (o) => ({ noCrit: true, ...S, ...o, dmg: o.dmg * k });
  const crouchK = { hipY: -0.12, chest: [0.22, 0, 0], hipL: [-P - 0.7, 0, 0], hipR: [-P - 0.7, 0, 0], kneeL: [1.2, 0, 0], kneeR: [1.2, 0, 0], shoulderL: [-P - 0.3, 0, 0], shoulderR: [-P - 0.3, 0, 0], elbowL: [0.5, 0, 0], elbowR: [0.5, 0, 0] };
  const fire = (f, G) => G.fx.burst(f.chest(), 22, [f.palette.accent, 0xffffff], 6);
  const M = {
    // 물기 (켄타우로스: 창 찌르기)
    bite: cen ? { dur: 0.95, trail: true, aim: true, track: 0.4, tele: [0.12, 'yellow'], cancel: 0.72, keys: [[0, 'base'], [0.4, { neck: [N + 0.15, 0.6, 0], chest: [-0.1, 0, 0] }], [0.56, { neck: [N - 0.15, -0.45, 0], chest: [0.1, 0, 0] }], [0.95, 'base']], lunge: [[0.42, 0.56, 6]], ev: [[0.42, swish]], hits: [H({ t0: 0.42, t1: 0.6, dmg: 30, kb: [3, 1], stun: 0.4, hs: 0.06 })] }
      : { dur: 0.95, aim: true, track: 0.4, tele: [0.12, 'yellow'], cancel: 0.7, keys: [[0, 'base'], [0.42, { chest: [-0.25, 0, 0], neck: [N - 0.45, 0, 0] }], [0.56, { chest: [0.22, 0, 0], neck: [N + 0.4, 0, 0] }], [0.95, 'base']], lunge: [[0.44, 0.58, 8]], ev: [[0.46, () => sfx('swing')]], hits: [H({ t0: 0.48, t1: 0.62, at: [0, 0.55, 0.95], r: 0.6, dmg: 28, kb: [3, 1], stun: 0.4, hs: 0.06 })] },
    // 앞발 할퀴기 (켄타우로스: 창 휘두르기)
    claw: cen ? { dur: 0.85, trail: true, aim: true, track: 0.2, keys: [[0, 'base'], [0.3, { neck: [N + 0.1, -0.7, 0.1] }], [0.48, { neck: [N, 0.8, -0.1] }], [0.85, 'base']], ev: [[0.32, chop]], hits: [H({ t0: 0.32, t1: 0.5, dmg: 30, kb: [4, 1], stun: 0.4, hs: 0.06 })] }
      : { dur: 0.8, aim: true, track: 0.2, keys: [[0, 'base'], [0.3, { shoulderR: [-P - 1.1, 0, -0.3], chest: [-0.2, 0.25, 0] }], [0.45, { shoulderR: [-P + 0.3, 0, 0.25], chest: [0.15, -0.2, 0] }], [0.8, 'base']], ev: [[0.36, (f) => { sfx('swing'); f.slashFx({ tilt: 1.2, r: 0.9 * f.scale, at: [-0.15, 0.5 * f.scale, 0.7] }); }]], hits: [H({ t0: 0.38, t1: 0.5, at: [-0.2, 0.45, 0.85], r: 0.65, dmg: 26, kb: [3, 1], stun: 0.4, hs: 0.06 })] },
    // 덮치기 / 켄타우로스: 앞발 들어 짓밟기
    pounce: { dur: 1.4, aim: true, track: 0.5, tele: [0.15, 'yellow'], keys: cen ? [[0, 'base'], [0.55, { chest: [-0.75, 0, 0], shoulderL: [-P - 1.0, 0, 0], shoulderR: [-P - 1.2, 0, 0], elbowL: [1.2, 0, 0], elbowR: [1.2, 0, 0], neck: [N + 0.6, 0, 0] }], [0.8, { chest: [0.15, 0, 0] }], [1.4, 'base']] : [[0, 'base'], [0.5, crouchK], [0.75, { chest: [-0.3, 0, 0], shoulderL: [-P - 0.9, 0, 0], shoulderR: [-P - 0.9, 0, 0], hipL: [-P + 0.5, 0, 0], hipR: [-P + 0.5, 0, 0] }], [1.0, { chest: [0.25, 0, 0] }], [1.4, 'base']],
      ev: cen ? [[0.8, (f, o, G) => slam(f, G, 2.6, 54 * k, f.palette.accent, st)]] : [[0.55, (f) => { f.vel.y = 6; f.onGround = false; sfx('jump'); }]], lunge: cen ? [] : [[0.55, 0.95, 9]], hits: cen ? [] : [H({ t0: 0.85, t1: 1.05, at: [0, 0.4, 0.7], r: 1.0, dmg: 46, kb: [6, 4], stun: 0.55, hs: 0.08 })] },
    // 돌진 (빨강: 회피)
    rush: { dur: 1.35, aim: true, track: 0.65, tele: [0.2, 'red'], keys: [[0, 'base'], [0.65, cen ? { chest: [0.15, 0, 0], neck: [N + 0.3, 0, 0] } : crouchK], [0.75, cen ? { neck: [N + 0.5, 0, 0] } : { chest: [0.1, 0, 0], neck: [N + 0.3, 0, 0], shoulderL: [-P - 0.7, 0, 0], shoulderR: [-P - 0.7, 0, 0], hipL: [-P + 0.6, 0, 0], hipR: [-P + 0.6, 0, 0] }], [1.0, {}], [1.35, 'base']],
      lunge: [[0.72, 1.0, 20]], ev: [[0.72, (f, o, G) => { sfx('dash'); fire(f, G); }]], hits: [H({ t0: 0.74, t1: 1.0, at: [0, 0.6, 0.9], r: 0.95, dmg: 58, kb: [8, 3], stun: 0.55, hs: 0.08, unblock: true })] },
    // 꼬리 회전 (빨강): 몸을 한 바퀴 돌려 주변을 쓴다
    whirl: { dur: 1.55, aim: true, track: 0.55, tele: [0.2, 'red'], keys: [[0, 'base'], [0.6, { hipY: -0.08, chest: [0.15, 0, 0] }], [0.8, { hips: [P, Math.PI, 0] }], [1.0, { hips: [P, TAU, 0] }], [1.01, { hips: [P, 0, 0] }], [1.55, 'base']],
      ev: [[0.62, () => sfx('swing')], [0.9, (f, o, G) => { G.fx.ring(f.pos.clone().setY(0.4), { normal: UP, r0: 0.5, r1: 3 * f.scale, life: 0.4, color: f.palette.accent }); G.fx.burst(f.chest(), 30, [f.palette.accent, 0xffffff], 9); }]],
      hits: [H({ t0: 0.66, t1: 1.0, at: [0, 0.6, 0], r: 2.3, dmg: 52, kb: [9, 4], stun: 0.6, hs: 0.08, unblock: true })] },
    // 포효 자세 (기둥 · 난사의 자세)
    howl: [[0, 'base'], [0.3, cen ? { neck: [N - 0.35, 0, 0], chest: [-0.4, 0, 0] } : { neck: [N - 0.6, 0, 0], chest: [-0.28, 0, 0], head: [-(P + N) - 0.4, 0, 0] }], [1.1, {}], [1.6, 'base']],
    // 독침 사격 자세 (전갈)
    sting: [[0, 'base'], [0.35, { chest: [-0.18, 0, 0], neck: [N - 0.15, 0, 0] }], [0.6, { chest: [0.1, 0, 0] }], [1.0, 'base']],
  };
  return M;
}

// 네발 보스: 기본 보스 기술(기둥 · 난사 · 강타 효과)을 네발 동작으로 바꾼다
function quadBoss(B, bm) {
  const Q = quadKit(B.kind, 1.7, B.st), cen = B.kind === 'centaur', P = cen ? 1.5 : 1.45, N = cen ? -1.5 : -1.15;
  const rear = [[0, 'base'], [0.8, { chest: [-0.8, 0, 0], shoulderL: [-P - 1.1, 0, 0], shoulderR: [-P - 1.3, 0, 0], elbowL: [1.3, 0, 0], elbowR: [1.3, 0, 0], neck: [N + 0.6, 0, 0] }], [1.3, { chest: [-0.4, 0, 0] }], [1.45, { chest: [0.2, 0, 0], shoulderL: [-P + 0.2, 0, 0], shoulderR: [-P + 0.2, 0, 0] }], [bm.s2.dur, 'base']];
  return { ...bm,
    light1: { ...Q.bite, next: 'light2' }, light2: { ...Q.claw, next: 'light3', cancel: 0.62 }, light3: Q.pounce,
    heavy: cen ? Q.pounce : Q.whirl,
    s1: { ...Q.rush, cd: 's1' },
    s2: cen ? { ...bm.s2, keys: rear, lunge: [] } : { ...Q.whirl, cd: 's2', ev: [...Q.whirl.ev, [1.0, (f, o, G) => bm.s2.ev[1][1](f, o, G)]] },
    rain: { ...bm.rain, keys: Q.howl }, volley: { ...bm.volley, keys: Q.howl } };
}

/* =====================================================================
   맵별 몬스터 세트: 잡몹(grunt) · 원거리(archer) · 정예(brute) · 보스(boss)
   s = { id, grunt, archer, brute, boss } — 각 항목에 이름 · 색 · 모델 · 상태 효과 · 투사체 · 2페이즈 기술 설정
   ===================================================================== */
const pal = (c) => ({ accent: c.accent, armor: c.armor, body: c.body, trim: c.trim, cloth: c.cloth, band: c.band });
export function makeSet(s) {
  const g = s.grunt, a = s.archer, b = s.brute, B = s.boss;
  const grunt = {
    id: `${s.id}_grunt`, name: g.name, short: g.short, title: g.title, enemy: true, scale: g.scale || 1,
    stats: { hp: g.hp ?? 280, speed: g.speed ?? 4.6, jump: 8, daze: 70, breakTime: 3 }, palettes: [pal(g.col)],
    skills: { s1: { name: '-', cd: 1 }, s2: { name: '-', cd: 1 }, ult: { name: '-', sub: '' } },
    ...bodyOf(g),
    moves: g.plan === 'quad' ? (() => { const Q = quadKit(g.kind, 0.9, g.st); return { light1: { ...Q.bite, next: 'light2' }, light2: Q.claw, heavy: Q.pounce }; })() : {
      light1: slow(T.light1, { k: 1.3, windup: 0.45, next: 'light2', dmg: 0.7, st: g.st }),
      light2: slow(T.light2, { k: 1.3, windup: 0.15, tele: null, dmg: 0.7, st: g.st }),
      heavy: slow(T.light3, { k: 1.2, windup: 0.6, dmg: 0.8, st: g.st, ev: [[0.6 + 0.15 * 1.2, () => sfx('zap')]] }),
    },
    ai: { range: 2.1, keep: 1.4, cdMin: g.fast ? 0.9 : 1.2, cdMax: g.fast ? 2 : 2.6, chain: 0.6, pick: (f, o, d) => (d < 2.6 ? (Math.random() < 0.65 ? 'light' : 'heavy') : null) },
  };
  const sh = a.shot || {};
  const archer = {
    id: `${s.id}_archer`, name: a.name, short: a.short, title: a.title, enemy: true, scale: a.scale || 1,
    stats: { hp: a.hp ?? 210, speed: 4.2, jump: 8, daze: 55, breakTime: 3 }, palettes: [pal(a.col)],
    skills: { s1: { name: a.skill || '사격', cd: sh.cd ?? 2.2 }, s2: { name: '-', cd: 1 }, ult: { name: '-', sub: '' } },
    ...bodyOf(a),
    moves: a.plan === 'quad' ? (() => { const Q = quadKit(a.kind, 0.8); return { light1: Q.claw, s1: { dur: 1.0, cd: 's1', aim: true, track: 0.35, tele: [0.12, 'yellow'], keys: Q.sting, ev: [[0.42, (f, o, G) => o && shot(f, o, G, { dmg: (sh.dmg ?? 45) / (sh.n || 1) ** 0.5, ...sh })]] } }; })() : {
      light1: slow(T.light1, { k: 1.3, windup: 0.4, dmg: 0.6 }),
      s1: { ...slow(T.s1, { k: 1.4, windup: 0.5, ev: [[0.5 + 0.24 * 1.4, (f, o, G) => o && shot(f, o, G, { dmg: (sh.dmg ?? 45) / (sh.n || 1) ** 0.5, ...sh })]] }), cd: 's1', tick: undefined },
    },
    ai: { range: 11, keep: 7, cdMin: 1.0, cdMax: 2.2, pick: (f, o, d) => (d > 4 && f.cd.s1 <= 0 ? 's1' : d < 2.6 ? 'light' : null) },
  };
  const brute = {
    id: `${s.id}_brute`, name: b.name, short: b.short, title: b.title, enemy: true, scale: b.scale || 1.4,
    stats: { hp: b.hp ?? 900, speed: 3.4, jump: 7, daze: 150, armor: true, breakTime: 4 }, palettes: [pal(b.col)],
    skills: { s1: { name: '-', cd: 1 }, s2: { name: b.skill || '지면 강타', cd: 6 }, ult: { name: '-', sub: '' } },
    ...bodyOf(b),
    moves: b.plan === 'quad' ? (() => { const Q = quadKit(b.kind, 1.6, b.st); return { light1: Q.bite, s2: { ...Q.pounce, cd: 's2', tele: [0.15, 'red'], hits: [], ev: [[0.55, (f) => { f.vel.y = 6.5; f.onGround = false; sfx('jump'); }], [0.98, (f, o, G) => slam(f, G, 4.5, 110, f.palette.accent, b.st)]] } }; })() : {
      light1: slow(T.light2, { k: 1.5, windup: 0.6, dmg: 1.5, st: b.st, ev: [[0.6 + 0.09 * 1.5, chop]] }),
      s2: { ...slow(T.s2, { k: 1.2, windup: 0.7, tele: 'red', ev: [[0.7 + 0.1 * 1.2, (f) => { f.vel.y = 5; f.onGround = false; }], [0.7 + 0.55 * 1.2, (f, o, G) => slam(f, G, 4.5, 110, f.palette.accent, b.st)]] }), cd: 's2' },
    },
    ai: { range: 2.9, keep: 2, cdMin: 1.6, cdMax: 3, pick: (f, o, d) => (d < 3.4 ? (f.cd.s2 <= 0 && Math.random() < 0.45 ? 's2' : 'light') : null) },
  };
  const R = B.rain || {};
  const boss = {
    id: `${s.id}_boss`, name: B.name, short: B.short, title: B.title, enemy: true, boss: true, scale: B.scale || 1.6,
    stats: { hp: B.hp ?? 4200, speed: B.speed ?? 4.6, jump: 9, daze: 340, armor: true, breakTime: 5 }, palettes: [pal(B.col)],
    skills: { s1: { name: B.s1 || '돌진', cd: 6 }, s2: { name: B.s2 || '파멸의 강타', cd: 8 }, ult: { name: '-', sub: '' } },
    ...bodyOf(B),
    moves: (B.plan === 'quad' ? (bm) => quadBoss(B, bm) : (bm) => bm)({
      light1: slow(T.light1, { k: 1.25, windup: 0.5, next: 'light2', dmg: 1.6, st: B.st, ev: [[0.5 + 0.08 * 1.25, swish]] }),
      light2: slow(T.light2, { k: 1.25, windup: 0.2, tele: null, next: 'light3', dmg: 1.6, st: B.st, ev: [[0.2 + 0.09 * 1.25, chop]] }),
      light3: slow(T.light3, { k: 1.2, windup: 0.35, tele: 'yellow', dmg: 1.5, st: B.st }),
      heavy: slow(T.heavy, { k: 1.2, windup: 0.55, dmg: 1.4, st: B.st }),
      // 돌진: 빨간 예고 뒤 멀리서 단숨에 베어 지나간다 (회피해야 함)
      s1: { ...slow(T.light3, { k: 1.0, windup: 0.75, tele: 'red', unblock: true, dmg: 1.8, st: B.st, lunge: [[0.75 + 0.12, 0.75 + 0.36, 20]], ev: [[0.75 + 0.12, (f, o, G) => { sfx('dash'); G.fx.burst(f.chest(), 20, f.palette.accent, 6); }]] }), cd: 's1' },
      s2: { ...slow(T.s2, { k: 1.15, windup: 0.8, tele: 'red', ev: [[0.8 + 0.1 * 1.15, (f) => { f.vel.y = 7; f.onGround = false; }], [0.8 + 0.55 * 1.15, (f, o, G) => {
        slam(f, G, 5.5, 130, f.palette.accent, B.st);
        for (let i = 1; i <= 2; i++) G.spawn({ done: false, t: 0, owner: f, update(dt) { this.t += dt; if (this.t > i * 0.35 && !this.d) { this.d = true; const c = f.pos.clone().setY(0.06); G.fx.ring(c, { normal: UP, r0: 2, r1: 5.5 + i * 3, life: 0.6, color: f.palette.accent }); areaHit(f, c, 5.5 + i * 3, { dmg: 50, kb: [6, 5], stun: 0.4, unblock: true, noCrit: true, ...(B.st ? { st: B.st } : {}) }, 0.5); } if (this.t > 1.2) this.done = true; }, kill() { this.done = true; } });
      }]] }), cd: 's2' },
      // 2페이즈 전용: 맵 테마 기둥(운석 · 고드름 · 번개 …)을 플레이어 주변에 연속 소환
      rain: { dur: 1.6, aim: true, track: 0.4, tele: [0.2, 'red'], keys: [[0, 'base'], [0.3, { shoulderR: [-3.0, 0, -0.2], spine: [-0.2, 0, 0] }], [1.2, {}], [1.6, 'base']],
        ev: [[0.45, (f, o, G) => { if (!o) return; sfx('charge'); const n = R.n ?? 5; for (let i = 0; i < n; i++) { const ang = rand(0, TAU), rr = i === 0 ? 0 : rand(1.5, R.spread ?? 4); G.spawn(pillar(G, f, o.pos.x + Math.cos(ang) * rr, o.pos.z + Math.sin(ang) * rr, i * (R.gap ?? 0.22), { color: R.color, color2: R.color2, style: R.style, st: R.st ?? B.st, dmg: R.dmg ?? 85, r: R.r ?? 1.6 })); } }]] },
      // 2페이즈 전용: 사방으로 테마 투사체 난사
      volley: { dur: 1.3, aim: true, track: 0.6, tele: [0.15, 'yellow'], keys: [[0, 'base'], [0.25, { spine: [0.2, 0.3, 0], shoulderL: [-1.5, 0, 0.3], shoulderR: [-1.5, 0, -0.3] }], [0.9, {}], [1.3, 'base']],
        ev: [[0.5, (f, o, G) => o && shot(f, o, G, { dmg: 34, n: B.volley?.n ?? 5, speed: B.volley?.speed ?? 15, homing: 0.25, r: 0.32, color: B.volley?.color, st: B.volley?.st ?? B.st })], [0.8, (f, o, G) => o && shot(f, o, G, { dmg: 34, n: (B.volley?.n ?? 5) - 1, speed: B.volley?.speed ?? 15, homing: 0.25, r: 0.32, color: B.volley?.color, st: B.volley?.st ?? B.st })]] },

    }),
    ai: { range: 8, keep: 2.2, cdMin: 0.9, cdMax: 2.0, chain: 0.85,
      pick: (f, o, d) => {
        if (f.enraged && Math.random() < 0.22) return 'rain';
        if (f.enraged && d > 4 && Math.random() < 0.3) return 'volley';
        if (d > 5 && f.cd.s1 <= 0) return 's1';
        if (d < 4 && f.cd.s2 <= 0 && Math.random() < 0.35) return 's2';
        if (d < 3.6) return Math.random() < 0.7 ? 'light' : 'heavy';
        return f.cd.s1 <= 0 ? 's1' : null;
      } },
  };
  return { grunt, archer, brute, boss };
}
