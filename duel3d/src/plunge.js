// 낙하 공격 (공통): 공중에서 좌클릭 → 잠깐 떠오르며 무기를 치켜들었다가 수직으로 내리꽂고, 착지하며 충격파.
// 캐릭터는 자세만 넘기면 된다:  moves: { ...makePlunge({ up, fall, land, color }) }
//   up   = 치켜든 자세, fall = 떨어지는 동안 자세, land = 내려찍은 직후 자세 (포즈 이름 또는 포즈 객체)
import * as THREE from 'three';
import { areaHit } from './entities.js';
import { sfx } from './core.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
export const PLUNGE_MIN_H = 0.55; // 이 높이보다 낮으면 그냥 지상 공격

export function makePlunge({ up, fall, land, color, dmg = 72, r = 2.5, fallDmg = 34, fx }) {
  const colOf = (f) => color ?? f.palette.accent; // 색을 안 주면 팔레트 강조색
  return {
    plunge: {
      dur: 4, trail: true, aim: true, ikOff: true, plunge: true,
      keys: [[0, up], [0.13, up], [0.21, fall], [4, fall]], // 떠오르며 치켜듦 → 내리꽂으며 무기 끝이 아래로
      start: (f) => { f.vel.y = Math.max(f.vel.y * 0.3, 2.2); f.vel.x *= 0.25; f.vel.z *= 0.25; sfx('swing'); },
      tick: (f, o, G, t, dt) => {
        if (t < 0.15) { f.vel.y = Math.max(f.vel.y - 24 * dt, 0.3); f.vel.x *= 0.9; f.vel.z *= 0.9; return; }
        if (!f.plungeGo) { f.plungeGo = true; sfx('dash'); }
        f.vel.y = -27;
        // 가까운 상대 쪽으로 약간 유도 (수평 최대 9m/s)
        if (o && !o.gone && f.dist() < 7) {
          const dx = o.pos.x - f.pos.x, dz = o.pos.z - f.pos.z, d = Math.hypot(dx, dz), want = Math.max(0, d - 1.1 * o.scale), sp = Math.min(9, want * 5);
          f.vel.x = (dx / (d || 1)) * sp; f.vel.z = (dz / (d || 1)) * sp; f.faceOpp(20, dt);
        } else { f.vel.x *= 0.9; f.vel.z *= 0.9; }
        G.fx.p(f.chest(new V3()).add(new V3(0, 0.3, 0)), { vel: [0, 6, 0], size: 0.9, size1: 0.1, life: 0.18, color: colOf(f), alpha: 0.55 });
      },
      onLand: (f) => f.start('plungeLand'),
      end: (f) => { f.plungeGo = false; },
      // 떨어지는 도중 무기에 닿은 상대 (공중 상대도)
      hits: [{ t0: 0.15, t1: 4, dmg: fallDmg, kb: [2, 0], stun: 0.42, hs: 0.05, daze: 14, br: 0.18 }],
    },
    plungeLand: {
      dur: 0.5, cancel: 0.32, aim: false,
      keys: [[0, land], [0.24, land], [0.5, 'base']],
      ev: [[0, (f, o, G) => {
        f.vel.set(0, 0, 0); const color = colOf(f);
        const c = f.local([0, 0, 1.05 * f.scale]); c.y = f.pos.y + 0.05;
        sfx('boom'); sfx('heavy'); G.shake(0.32); G.hitstop = Math.max(G.hitstop || 0, 0.05);
        G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.3, r1: r * 1.25, life: 0.42, color });
        G.fx.ring(c, { normal: new V3(0, 1, 0), r0: 0.2, r1: r * 0.8, life: 0.3, color: 0xffffff });
        G.fx.burst(c.clone().setY(c.y + 0.3), 34, [color, 0xffffff], 9, { dir: new V3(0, 1, 0), spread: 1.1 });
        G.fx.burst(c, 22, 0x7a6a60, 5, { kind: 'dust', sk: 1.6 });
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.random() * 0.4, d = new V3(Math.cos(a), 0, Math.sin(a)); G.fx.slash(c.clone().addScaledVector(d, r * 0.45), { fwd: d, normal: new V3(0, 1, 0), r: r * 0.5, color, life: 0.4 }); }
        G.fx.light(c.clone().setY(c.y + 1), color, 90, 0.35);
        areaHit(f, c, r * f.scale, { dmg, kb: [4.5, 7.5], stun: 0.65, hs: 0.1, shake: 0.2, daze: 40, snd: 'big' }, 1.3);
        fx && fx(f, o, G, c);
      }]],
    },
  };
}
