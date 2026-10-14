// 4. 바람의 평원 — 고블린 · 고블린 투석병 · 오우거 · 폭풍 켄타우로스
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'plains',
    grunt: { name: '고블린 약탈자', short: '고블린', title: '마을 습격대', fast: true, speed: 5.2, scale: 0.72, hp: 240, col: C(0xd8ff4a, 0x4a7a2a, 0x3a2a1a, { band: '#14240a' }), model: { weapon: 'dagger', head: 'goblin', spikes: false, bigHead: 1.45 } },
    archer: { name: '고블린 투석병', short: '투석병', title: '언덕의 매복병', skill: '돌팔매', scale: 0.72, col: C(0xffe08a, 0x5a7a2a, 0x3a2a1a, { band: '#14240a' }), model: { weapon: 'rock', head: 'goblin', spikes: false, bigHead: 1.45, pack: true }, shot: { dmg: 46, color: 0xc8b090, speed: 15, homing: 0.3, arc: 0.18 } },
    brute: { name: '평원 오우거', short: '오우거', title: '건초밭의 폭군', scale: 1.55, hp: 1000, plan: 'golem', kind: 'ogre', col: C(0xffa04a, 0x6a5a3a, 0x8a9a5a, { cloth: 0x6a4a2a, trim: 0x5a3a1a, band: '#241a0a' }), model: { weapon: 'club' }, skill: '몽둥이 내려찍기' },
    boss: { name: '폭풍 켄타우로스 갈레', short: '갈레', title: '평원을 달리는 폭풍', speed: 5.8, plan: 'quad', kind: 'centaur', scale: 1.35, s1: '질풍 돌격', s2: '돌풍 짓밟기', col: C(0x7affd0, 0x3a6a4a, 0x2a2014, { trim: 0xd8c070, cloth: 0x2a5a3a, band: '#06241a' }), model: {},
      rain: { color: 0x9affe0, color2: 0xffffff, style: 'up', n: 6, gap: 0.18 }, volley: { color: 0xb8ffe8, n: 6, speed: 18 } },
  });
