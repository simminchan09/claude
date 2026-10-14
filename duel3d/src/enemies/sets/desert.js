// 2. 붉은 모래 협곡 — 사막 유적의 미라 · 전갈 · 사암 골렘 · 모래 파라오
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'desert',
    grunt: { name: '모래 미라병', short: '미라병', title: '유적의 망자', col: C(0xffc04a, 0xd8c8a0, 0x6a5a48, { cloth: 0xe8dcc0, band: '#3a2408' }), model: { weapon: 'scimitar', head: 'skull', spikes: false, flat: false, thin: true, wrap: true }, st: ['bleed', 3, 5] },
    archer: { name: '거대 독전갈', short: '독전갈', title: '모래 속 사냥꾼', skill: '독침 사격', plan: 'quad', kind: 'scorpion', scale: 1.3, col: C(0x8aff4a, 0x7a3a1a, 0x3a2414, { trim: 0x2a1a0a, band: '#1a2a08' }), model: {}, shot: { dmg: 40, color: 0x9aff4a, speed: 16, homing: 0.4, st: ['burn', 4, 6] } },
    brute: { name: '사암 골렘', short: '골렘', title: '협곡의 수호석', plan: 'golem', kind: 'stone', col: C(0xff8a3a, 0xb06a3a, 0x7a4a2a, { band: '#2a1208' }), model: {}, skill: '사암 붕괴', st: ['slow', 2.5, 0.6] },
    boss: { name: '모래 파라오 세크메트', short: '세크메트', title: '협곡의 저주받은 왕', scale: 1.75, s1: '사풍 돌진', s2: '모래 폭풍 강타', col: C(0xffd040, 0x2a3a6a, 0x1a1408, { trim: 0xffc040, cloth: 0x2a3a8a, band: '#2a1a04' }), model: { weapon: 'spear', head: 'skull', hat: 'nemes', cape: true }, st: ['slow', 2, 0.7],
      rain: { color: 0xffb040, color2: 0xfff0b0, style: 'up', st: ['slow', 3, 0.5] }, volley: { color: 0xffc040, st: ['bleed', 3, 6] } },
  });
