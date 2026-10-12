// 테스트용 캐릭터: 훈련 기체 TB-01
// 새 캐릭터를 만들 때 이 파일을 복사해서 시작한다 (규칙은 ../../CHARACTER_GUIDE.md 참고).
import * as THREE from 'three';
import { buildHumanoid } from '../rig.js';
import { Projectile, areaHit } from '../entities.js';
import { rand, sfx } from '../core.js';
import { makePlunge } from '../plunge.js';

const V3 = THREE.Vector3;
const DIMS = { hipH: 0.98, spineL: 0.22, chestL: 0.3, neckL: 0.1, shW: 0.21, uArm: 0.29, lArm: 0.27, hipW: 0.1, thigh: 0.44, shin: 0.44 };

function createModel(pal) {
  const m = buildHumanoid(DIMS), J = m.J;
  const body = new THREE.MeshStandardMaterial({ color: 0x232833, metalness: 0.55, roughness: 0.42 });
  const armor = new THREE.MeshStandardMaterial({ color: pal.armor, metalness: 0.8, roughness: 0.28 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: pal.accent, emissiveIntensity: 2.4 });
  const blade = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, metalness: 1, roughness: 0.15 });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); parent.add(me); return me; };
  const limb = (parent, len, r, mat) => add(parent, new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10), mat, 0, -len / 2, 0);
  const joint = (parent, r = 0.04) => add(parent, new THREE.SphereGeometry(r, 12, 8), glow);
  // 골반 · 몸통
  add(J.hips, new THREE.BoxGeometry(0.3, 0.16, 0.2), armor, 0, -0.02, 0);
  add(J.spine, new THREE.CapsuleGeometry(0.12, 0.1, 4, 12), body, 0, 0.1, 0);
  const torso = add(J.chest, new THREE.CapsuleGeometry(0.17, 0.12, 6, 14), armor, 0, 0.15, 0); torso.scale.set(1.15, 1, 0.75);
  add(J.chest, new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20), glow, 0, 0.18, 0.12, Math.PI / 2);
  add(J.chest, new THREE.BoxGeometry(0.22, 0.24, 0.1), body, 0, 0.16, -0.13);
  for (const s of [-1, 1]) add(J.chest, new THREE.BoxGeometry(0.03, 0.18, 0.03), glow, s * 0.07, 0.17, -0.185);
  // 머리
  add(J.neck, new THREE.CylinderGeometry(0.045, 0.055, 0.12, 10), body, 0, 0.03, 0);
  const helm = add(J.head, new THREE.CapsuleGeometry(0.11, 0.07, 6, 14), armor, 0, 0.11, 0); helm.scale.set(0.95, 1, 1.05);
  add(J.head, new THREE.BoxGeometry(0.19, 0.045, 0.06), glow, 0, 0.12, 0.095);
  add(J.head, new THREE.BoxGeometry(0.02, 0.07, 0.18), armor, 0, 0.25, -0.02, -0.3);
  // 팔
  for (const [sh, el, ha] of [[J.shoulderL, J.elbowL, J.handL], [J.shoulderR, J.elbowR, J.handR]]) {
    const pad = add(sh, new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), armor, 0, 0.02, 0); pad.scale.set(1.1, 1, 1);
    limb(sh, DIMS.uArm, 0.055, body); joint(el); limb(el, DIMS.lArm, 0.052, armor);
    add(ha, new THREE.BoxGeometry(0.075, 0.1, 0.07), body, 0, -0.04, 0);
  }
  // 다리
  for (const [hp, kn, ft] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    limb(hp, DIMS.thigh, 0.075, body); joint(kn, 0.045); limb(kn, DIMS.shin, 0.065, armor);
    add(kn, new THREE.BoxGeometry(0.08, 0.2, 0.05), armor, 0, -0.18, 0.06);
    add(ft, new THREE.BoxGeometry(0.11, 0.07, 0.24), body, 0, -0.035, 0.05);
  }
  // 훈련용 블레이드 (+Z 방향)
  add(J.weapon, new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), body, 0, 0, 0.0, Math.PI / 2);
  add(J.weapon, new THREE.BoxGeometry(0.16, 0.035, 0.04), armor, 0, 0, 0.13);
  add(J.weapon, new THREE.BoxGeometry(0.018, 0.075, 0.95), blade, 0, 0, 0.62);
  add(J.weapon, new THREE.BoxGeometry(0.022, 0.012, 0.95), glow, 0, 0.042, 0.62);
  return {
    ...m, sole: 0.07,
    weaponPts(b, t) { J.weapon.localToWorld(b.set(0, 0, 0.25)); J.weapon.localToWorld(t.set(0, 0, 1.1)); },
  };
}

// 공통 포즈 (모든 캐릭터가 같은 이름의 포즈를 가져야 한다)
const poses = {
  base: { hips: [0, -0.35, 0], spine: [0.1, 0.15, 0], chest: [0.05, 0.12, 0], head: [0, 0.12, 0],
    shoulderR: [-0.6, 0, -0.25], elbowR: [-1.0, 0, 0], weapon: [0.8, 0, 0], shoulderL: [-0.35, 0, 0.3], elbowL: [-1.3, 0, 0],
    hipL: [-0.4, 0, 0.08], kneeL: [0.55, 0, 0], footL: [-0.12, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.4, 0, 0] },
  run: { hips: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], hipL: [0, 0, 0], kneeL: [0.2, 0, 0], footL: [0, 0, 0], hipR: [0, 0, 0], kneeR: [0.2, 0, 0], spine: [0.15, 0, 0], shoulderR: [0.3, 0, -0.2], elbowR: [-0.6, 0, 0], weapon: [1.9, 0, 0], shoulderL: [0, 0, 0.15], elbowL: [-1.2, 0, 0] },
  jump: { hipL: [-1.3, 0, 0], kneeL: [1.8, 0, 0], hipR: [-0.5, 0, 0], kneeR: [1.4, 0, 0], shoulderR: [-1.0, 0, -0.5], elbowR: [-0.5, 0, 0], shoulderL: [-0.6, 0, 0.6] },
  guard: { spine: [0.15, 0, 0], chest: [0.1, 0, 0], shoulderR: [-1.3, 0, 0.35], elbowR: [-1.5, 0, 0], weapon: [0.2, 0, 0], shoulderL: [-1.2, 0, -0.2], elbowL: [-1.6, 0, 0],
    hipL: [-0.5, 0, 0.2], kneeL: [0.8, 0, 0], hipR: [0.35, 0, -0.2], kneeR: [0.6, 0, 0] },
  hit: { spine: [-0.4, 0, 0], chest: [-0.2, 0.2, 0], head: [-0.4, 0, 0], shoulderR: [0.4, 0, -0.5], elbowR: [-0.4, 0, 0], shoulderL: [0.4, 0, 0.5], elbowL: [-0.4, 0, 0] },
  air: { hips: [-0.5, 0, 0], spine: [-0.4, 0, 0], head: [-0.5, 0, 0], shoulderR: [0.6, 0, -0.9], shoulderL: [0.6, 0, 0.9], hipL: [-0.9, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.4, 0, 0], kneeR: [0.6, 0, 0] },
  down: { hipY: -0.76, hips: [-1.52, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0.3, 0, 0], shoulderR: [-2.4, 0, -0.5], shoulderL: [-2.2, 0, 0.6], elbowR: [-0.3, 0, 0], elbowL: [-0.4, 0, 0],
    hipL: [-0.1, 0, 0.15], kneeL: [0.3, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.9, 0, 0] },
  dash: { spine: [0.6, 0, 0], chest: [0.1, 0, 0], shoulderR: [0.9, 0, -0.3], elbowR: [-0.3, 0, 0], weapon: [1.9, 0, 0], shoulderL: [0.9, 0, 0.3], hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.6, 0, 0], kneeR: [0.9, 0, 0] },
  win: { hips: [0, 0, 0], spine: [-0.05, 0, 0], chest: [0, 0, 0], head: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.3], elbowR: [-0.2, 0, 0], weapon: [1.4, 0, 0], shoulderL: [0, 0, 0.2], elbowL: [-0.3, 0, 0],
    hipL: [-0.1, 0, 0.1], kneeL: [0.1, 0, 0], hipR: [0.1, 0, -0.1], kneeR: [0.1, 0, 0] },
  portrait: { chest: [0, -0.35, 0], head: [0.1, 0.25, 0], shoulderR: [-2.3, 0, -0.55], elbowR: [-1.2, 0, 0], weapon: [1.2, 0, 0] },
  charge: { hips: [0, -0.2, 0], spine: [0.3, 0, 0], chest: [0.2, 0.3, 0], shoulderR: [0.5, 0, -0.6], elbowR: [-0.3, 0, 0], weapon: [1.7, 0, 0], shoulderL: [-1.5, 0, 0.3], elbowL: [-0.2, 0, 0],
    hipL: [-0.9, 0, 0.2], kneeL: [1.2, 0, 0], hipR: [0.5, 0, -0.2], kneeR: [1.0, 0, 0] },
};

const ACC = (f) => f.palette.accent;

// 기술 데이터
// keys: [[시간, 포즈 덮어쓰기 | 'base' | 포즈이름]]  (앞 키를 이어받아 누적)
// hits: [{ t0, t1, at: [오른쪽, 위, 앞], r: 반경, dmg, kb: [밀림, 띄움], stun, hs: 히트스톱 }]
// lunge: [[t0, t1, 전진속도]]   ev: [[시간, (f, o, G) => {}]]
const moves = {
  // 공중 좌클: 낙하 공격 (공통 시스템, 자세만 지정)
  ...makePlunge({
    up: { spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], head: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.3], elbowR: [-0.5, 0, 0], weapon: [0.9, 0, 0], shoulderL: [-0.4, 0, 0.6], elbowL: [-0.8, 0, 0], hipL: [-1.2, 0, 0], kneeL: [1.6, 0, 0], hipR: [-0.5, 0, 0], kneeR: [1.3, 0, 0] },
    fall: { spine: [0.25, 0, 0], head: [-0.3, 0, 0], shoulderR: [-2.1, 0, -0.15], elbowR: [-0.3, 0, 0], weapon: [3.95, 0, 0], shoulderL: [-0.3, 0, 0.7], hipL: [-1.0, 0, 0], kneeL: [1.4, 0, 0], hipR: [-0.4, 0, 0], kneeR: [1.1, 0, 0] },
    land: { hips: [0, -0.2, 0], spine: [0.75, 0, 0], chest: [0.25, 0, 0], head: [-0.4, 0, 0], shoulderR: [-1.1, 0, -0.1], elbowR: [-0.1, 0, 0], weapon: [1.35, 0, 0], shoulderL: [0.3, 0, 0.5], hipL: [-1.2, 0, 0.1], kneeL: [1.7, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [1.5, 0, 0] },
  }),
  light1: { dur: 0.4, cancel: 0.22, next: 'light2', trail: true, track: 0.08,
    keys: [[0, { chest: [0.1, -1.0, 0], spine: [0.15, -0.3, 0], shoulderR: [-1.45, 0, -0.5], elbowR: [-0.25, 0, 0], weapon: [1.5, 0, 0] }], [0.09, { chest: [0.1, -1.15, 0] }],
      [0.18, { chest: [0.2, 0.95, 0], spine: [0.2, 0.35, 0], shoulderR: [-1.4, 0, 0.35] }], [0.27, { chest: [0.2, 1.1, 0] }], [0.4, 'base']],
    lunge: [[0.06, 0.16, 4]],
    ev: [[0.08, (f) => { sfx('swing'); f.slashFx({ tilt: 0.15, r: 1.35, at: [0, 1.15, 0.35] }); }]],
    hits: [{ t0: 0.1, t1: 0.2, at: [0, 1.1, 1.0], r: 0.85, dmg: 40, kb: [2.5, 0], stun: 0.34 }] },
  light2: { dur: 0.42, cancel: 0.24, next: 'light3', trail: true, track: 0.08,
    keys: [[0, { spine: [-0.1, 0, 0], chest: [0, -0.2, 0], shoulderR: [-2.9, 0, -0.25], elbowR: [-0.3, 0, 0], weapon: [1.5, 0, 0] }], [0.09, { shoulderR: [-3.0, 0, -0.2] }],
      [0.16, { spine: [0.3, 0, 0], chest: [0.2, 0.1, 0], shoulderR: [-1.35, 0, 0.1], elbowR: [-0.1, 0, 0] }], [0.24, { spine: [0.45, 0, 0], shoulderR: [-0.7, 0, 0.05] }], [0.42, 'base']],
    lunge: [[0.06, 0.16, 3.5]],
    ev: [[0.09, (f) => { sfx('swing'); f.slashFx({ tilt: Math.PI / 2, r: 1.3, at: [0.05, 1.0, 0.3], flip: true }); }]],
    hits: [{ t0: 0.1, t1: 0.2, at: [0, 1.0, 1.0], r: 0.9, dmg: 44, kb: [3, 0], stun: 0.36 }] },
  light3: { dur: 0.56, trail: true, track: 0.1,
    keys: [[0, { chest: [0, -0.7, 0], shoulderR: [-0.9, 0, -0.3], elbowR: [-1.9, 0, 0], weapon: [1.6, 0, 0] }], [0.12, { chest: [0, -0.8, 0] }],
      [0.18, { chest: [0.1, 0.5, 0], spine: [0.35, 0, 0], shoulderR: [-1.55, 0, 0], elbowR: [0, 0, 0], hipL: [-1.0, 0, 0.1], kneeL: [0.9, 0, 0], hipR: [0.7, 0, -0.1], kneeR: [0.2, 0, 0] }], [0.36, {}], [0.56, 'base']],
    lunge: [[0.13, 0.24, 9]],
    ev: [[0.15, (f, o, G) => { sfx('zap'); const p = f.local([0, 1.15, 1.2]); G.fx.ring(p, { normal: f.fwd(), r0: 0.2, r1: 1.4, life: 0.25, color: ACC(f) }); G.fx.burst(p, 16, [ACC(f), 0xffffff], 10, { dir: f.fwd(), spread: 0.3 }); }]],
    hits: [{ t0: 0.15, t1: 0.27, at: [0, 1.15, 1.25], r: 0.8, dmg: 66, kb: [7, 6.5], stun: 0.55, hs: 0.1, shake: 0.14 }] },
  heavy: { dur: 0.68, trail: true, track: 0.12,
    // 낮은 앞쪽에서 위로 쳐올린 뒤 도약 (칼날이 상대 몸 앞을 지나가도록)
    keys: [[0, { spine: [0.5, 0, 0], chest: [0.1, 0.1, 0], shoulderR: [-0.55, 0, 0.1], elbowR: [-0.1, 0, 0], weapon: [1.5, 0, 0], hipL: [-1.1, 0, 0], kneeL: [1.8, 0, 0], hipR: [-0.3, 0, 0], kneeR: [1.6, 0, 0] }],
      [0.1, { spine: [0.55, 0, 0], shoulderR: [-0.45, 0, 0.1] }], [0.2, { spine: [0.05, 0, 0], chest: [-0.05, 0.1, 0], shoulderR: [-2.0, 0, 0.05], hipL: [-0.7, 0, 0], kneeL: [0.9, 0, 0], hipR: [0.0, 0, 0], kneeR: [1.0, 0, 0] }],
      [0.3, { spine: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.1], hipL: [-0.5, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.1, 0, 0], kneeR: [0.9, 0, 0] }], [0.42, { shoulderR: [-3.1, 0, -0.1] }], [0.68, 'base']],
    lunge: [[0.06, 0.18, 4]],
    ev: [[0.2, (f, o, G) => { f.vel.y = 9.5; f.onGround = false; sfx('heavy'); f.slashFx({ tilt: Math.PI / 2, r: 1.6, at: [0, 1.3, 0.2], life: 0.28 }); G.fx.ring(f.pos.clone().setY(0.05), { normal: new V3(0, 1, 0), r0: 0.3, r1: 2.6, life: 0.4, color: ACC(f) }); }]],
    hits: [{ t0: 0.1, t1: 0.32, at: [0, 1.4, 0.9], r: 1.0, dmg: 80, kb: [1.5, 11], stun: 0.6, hs: 0.1, shake: 0.12 }] },
  s1: { dur: 0.55, cd: 's1', track: 0.2,
    keys: [[0, { chest: [0, 0.4, 0], shoulderL: [-0.5, 0, 0.5], elbowL: [-1.8, 0, 0] }], [0.18, { chest: [0, 0.5, 0] }],
      [0.24, { chest: [0.1, -0.6, 0], spine: [0.2, 0, 0], shoulderL: [-1.55, 0, 0], elbowL: [0, 0, 0] }], [0.4, {}], [0.55, 'base']],
    tick: (f, o, G, t) => { if (t < 0.22) { const h = f.model.J.handL.getWorldPosition(new V3()); G.fx.p(h, { size: 0.5, size1: 0.1, life: 0.15, color: ACC(f), alpha: 0.8 }); } },
    ev: [[0.02, () => sfx('charge')], [0.24, (f, o, G) => {
      const h = f.model.J.handL.getWorldPosition(new V3()), d = (o ? o.chest(new V3()) : f.local([0, 1.1, 12])).sub(h).normalize();
      G.spawn(new Projectile(G, { owner: f, pos: h.addScaledVector(d, 0.3), vel: d.multiplyScalar(17), r: 0.35, color: ACC(f), homing: 1.6, hit: { dmg: 70, kb: [5, 4], stun: 0.5, hs: 0.09, shake: 0.12 } }));
      sfx('shot'); G.fx.burst(h, 10, ACC(f), 5, { dir: d, spread: 0.6 });
    }]] },
  s2: { dur: 0.85, cd: 's2', track: 0.15,
    keys: [[0, { spine: [-0.2, 0, 0], shoulderR: [-2.9, 0, -0.3], shoulderL: [-2.9, 0, 0.3], elbowR: [-0.3, 0, 0], elbowL: [-0.3, 0, 0], weapon: [1.5, 0, 0] }],
      [0.4, {}], [0.52, { spine: [0.75, 0, 0], shoulderR: [-0.8, 0, -0.2], shoulderL: [-0.8, 0, 0.2], hipL: [-1.1, 0, 0], kneeL: [1.7, 0, 0], hipR: [-0.2, 0, 0], kneeR: [1.5, 0, 0] }], [0.68, {}], [0.85, 'base']],
    ev: [[0.1, (f) => { f.vel.y = 6.2; f.onGround = false; sfx('jump'); }],
      [0.55, (f, o, G) => {
        const c = f.pos.clone().setY(0.06); sfx('boom'); G.shake(0.3); G.flash(0xffffff, 0.15);
        G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.4, r1: 6.5, life: 0.55, color: ACC(f) }); G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.2, r1: 4.2, life: 0.4, color: 0xffffff });
        G.fx.burst(c, 40, [ACC(f), 0xffffff], 12, { dir: new V3(0, 1, 0), spread: 1.4 }); G.fx.burst(c, 20, 0x8a7a90, 6, { kind: 'dust', sk: 1.5 }); G.fx.light(c.clone().setY(1), ACC(f), 90, 0.35);
        areaHit(f, c, 4.6, { dmg: 72, kb: [6, 8.5], stun: 0.6, hs: 0.1, shake: 0.12 });
      }]] },
  // 궁극기: 컷인이 끝난 뒤 0초부터 진행된다
  // 극한 회피 뒤 좌클릭: 상대 옆으로 순간이동해 크게 벤다
  counter: { dur: 0.55, trail: true, aim: true,
    keys: [[0, { chest: [0.1, -1.1, 0], spine: [0.15, -0.3, 0], shoulderR: [-1.45, 0, -0.5], elbowR: [-0.25, 0, 0], weapon: [1.5, 0, 0] }], [0.09, { chest: [0.2, 1.0, 0], spine: [0.2, 0.35, 0], shoulderR: [-1.4, 0, 0.35] }], [0.2, { chest: [0.2, 1.15, 0] }], [0.55, 'base']],
    ev: [[0, (f, o, G) => {
      const from = f.chest();
      if (o) { const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(), side = new V3(-d.z, 0, d.x); f.pos.copy(o.pos).setY(o.onGround ? 0 : o.pos.y).addScaledVector(side, 1.2 + 0.4 * o.scale).addScaledVector(d, 0.6); f.faceOpp(); }
      for (let i = 0; i <= 8; i++) G.fx.p(from.clone().lerp(f.chest(), i / 8), { size: 0.8, size1: 0.2, life: 0.3, color: ACC(f), alpha: 0.7 });
      sfx('dash'); G.flash(ACC(f), 0.2);
    }], [0.05, (f) => { sfx('swing'); f.slashFx({ tilt: 0.2, r: 1.8, at: [0, 1.15, 0.35], life: 0.3 }); }]],
    hits: [{ t0: 0.03, t1: 0.16, at: [0, 1.1, 1.0], r: 1.0, dmg: 95, kb: [6, 4], stun: 0.6, hs: 0.12, shake: 0.15, daze: 45, snd: 'big' }] },
  ult: { dur: 2.7, ult: true, aim: true,
    keys: [[0, 'charge'], [0.24, 'charge'], [0.26, 'base'], [1.2, 'base'], [1.25, 'charge'], [2.7, 'charge']],
    cam: [[0, { ref: 'self', p: [1.7, 1.5, 2.6], l: [0, 1.2, 0], fov: 42 }], [0.25, { ref: 'target', p: [4.5, 2.3, -3.5], l: [0, 1.4, 0], fov: 52 }],
      [1.15, { ref: 'target', p: [-4.2, 1.0, -2.6], l: [0, 1.7, 0], fov: 55 }], [1.6, { ref: 'target', p: [0.5, 3.5, -10.5], l: [0, 3.2, 0], fov: 60 }], [2.7, { ref: 'target', p: [0.5, 4.2, -12.5], l: [0, 3.4, 0], fov: 60 }]],
    ev: [
      [0, (f, o, G) => { o.lock(); if (o.pos.y < 0.4) o.pos.y = 0.4; G.setTint(f.palette.accent, 0.35); sfx('charge'); G.fx.burst(f.chest(), 40, [ACC(f), 0xffffff], 8); G.fx.light(f.chest(), ACC(f), 80, 0.5); }],
      [0.25, (f, o, G) => {
        const from = f.chest(), d = new V3().subVectors(f.pos, o.pos).setY(0).normalize();
        f.pos.copy(o.pos).setY(0).addScaledVector(d, 1.5); f.faceOpp(1);
        for (let i = 0; i <= 10; i++) G.fx.p(from.clone().lerp(f.chest(), i / 10), { size: 0.9, size1: 0.2, life: 0.35, color: ACC(f), alpha: 0.7 });
        sfx('dash');
      }],
      ...Array.from({ length: 7 }, (_, i) => [0.42 + i * 0.11, (f, o, G) => {
        const a = i * 2.3 + rand(-0.3, 0.3); f.pos.set(o.pos.x + Math.sin(a) * 1.5, 0, o.pos.z + Math.cos(a) * 1.5); f.faceOpp(1); f.trail.clear();
        const n = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        G.fx.slash(o.chest(), { fwd: new V3(Math.cos(a), 0, -Math.sin(a)), normal: n, r: rand(1.4, 2.0), color: i % 2 ? 0xffffff : ACC(f), life: 0.26 });
        o.takeHit(f, { dmg: 16, kb: [0, 0], stun: 99, hs: 0.03, shake: 0.1, nokill: true, noScale: true, force: true });
        sfx('zap');
      }]),
      [1.2, (f, o, G) => {
        const d = new V3().subVectors(f.pos, o.pos).setY(0).normalize(); f.pos.copy(o.pos).setY(0).addScaledVector(d, 5); f.faceOpp(1);
        sfx('charge'); G.slow(0.5, 0.45); G.setTint(f.palette.accent, 0.5);
      }],
      [1.65, (f, o, G) => {
        o.release(); const p = o.pos.clone().setY(0);
        G.fx.beam(p, { r: 1.8, h: 34, color: ACC(f), life: 1.1 }); G.fx.ring(p.clone().setY(0.06), { normal: new V3(0, 1, 0), r0: 0.5, r1: 9, life: 0.8, color: ACC(f) });
        G.fx.burst(o.chest(), 90, [ACC(f), 0xffffff], 18, { lk: 1.4 }); G.fx.burst(p, 30, 0x8a7a90, 8, { kind: 'dust', sk: 2 }); G.fx.light(o.chest(), ACC(f), 160, 0.8, 22);
        G.flash(0xffffff, 0.9); G.shake(0.5); G.stage.flashSky(0.8); sfx('boom');
        o.takeHit(f, { dmg: 170, kb: [6, 12], stun: 0.9, hs: 0.18, shake: 0.4, noScale: true, force: true, snd: 'big' }, new V3().subVectors(o.pos, f.pos).setY(0).normalize());
      }],
    ],
    end: (f, o, G) => { G.setTint(0, 0); } },
};

export default {
  id: 'tb01', name: '훈련 기체 TB-01', short: 'TB-01', title: '시스템 테스트용 기체',
  desc: '모든 시스템(콤보·띄우기·투사체·범위기·궁극기 컷인)을 확인하기 위한 표준 캐릭터입니다.',
  stats: { hp: 1000, speed: 7.2, jump: 9.5 },
  palettes: [{ accent: 0x46e6ff, armor: 0xc3cad6, band: '#06283a' }, { accent: 0xff7a2a, armor: 0x3b3f4a, band: '#3a1206' }],
  skills: { heavy: { name: '올려베기' }, s1: { name: '에너지탄', cd: 4 }, s2: { name: '충격파', cd: 7 }, ult: { name: '오버클럭', sub: '데모 드라이브' } },
  moveList: [['C (타이밍)', '극한 회피 → 적이 느려지고 좌클릭으로 반격'], ['F (타이밍)', '패리 → 노란 예고 공격을 튕겨내기'], ['좌클 ×3', '베기 → 내려베기 → 찌르기(띄움)'], ['우클', '올려베기 (공중으로 띄움)'], ['Shift', '유도 에너지탄'], ['E', '도약 후 지면 충격파 (범위)'], ['Q', '오버클럭: 7연속 순간이동 베기 → 빛기둥']],
  createModel, poses, moves,
};
