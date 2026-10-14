// 6. 용암 분화구 — 용암 임프 · 화염 술사 · 흑요석 골렘 · 화염 거인
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'volcano',
    grunt: { name: '용암 임프', short: '임프', title: '분화구의 졸개', fast: true, speed: 5.2, scale: 0.7, hp: 240, col: C(0xff6a1a, 0x5a1a10, 0x2a0a06, { trim: 0x2a1a1a, band: '#2a0a04' }), model: { weapon: 'claw', head: 'mask', horns: 0.12, tail: { glow: true }, wings: true, bigHead: 1.35 }, st: ['burn', 3, 6] },
    archer: { name: '화염 술사', short: '술사', title: '불꽃 교단', skill: '화염구', plan: 'float', kind: 'robe', col: C(0xff8a2a, 0x3a1a14, 0x1a0806, { cloth: 0x5a1a10, trim: 0xd8a040, band: '#2a0a04' }), model: { weapon: 'staff', orbit: 3 }, shot: { dmg: 40, color: 0xff7a2a, speed: 12, homing: 0.8, r: 0.36, st: ['burn', 4, 8] } },
    brute: { name: '흑요석 골렘', short: '흑요석', title: '용암의 핵', scale: 1.5, plan: 'golem', kind: 'obsidian', col: C(0xff5a10, 0x1a1418, 0x0a0808, { band: '#2a0804' }), model: { metal: 0.7, rough: 0.2 }, skill: '용암 분출', st: ['burn', 4, 10] },
    boss: { name: '화염 거인 수르트', short: '수르트', title: '분화구의 왕', scale: 1.95, s1: '불꽃 돌진', s2: '대지 용융', col: C(0xff4a10, 0x2a1410, 0x140806, { trim: 0xff8a2a, cloth: 0x3a0a06, band: '#2a0604' }), model: { weapon: 'greatsword', head: 'mask', horns: 0.22, crown: true, bulk: 1.15 }, st: ['burn', 3, 8],
      rain: { color: 0xff5a10, color2: 0xffd080, style: 'fall', st: ['burn', 4, 10], n: 6 }, volley: { color: 0xff7a2a, st: ['burn', 3, 8] } },
  });
