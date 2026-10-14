// 5. 노을빛 해상 — 해골 해적 · 해적 총잡이 · 심해 어인 · 유령 선장
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'ocean',
    grunt: { name: '해골 해적', short: '해골', title: '저주받은 선원', col: C(0x4affd8, 0xe8e0c8, 0x2a2a3a, { cloth: 0x8a1a2a, band: '#08201e' }), model: { weapon: 'scimitar', head: 'skull', spikes: false, flat: false, thin: true }, st: ['bleed', 3, 5] },
    archer: { name: '해적 총잡이', short: '총잡이', title: '갑판의 사수', skill: '권총 사격', col: C(0xffd060, 0x6a3a2a, 0x1a1a24, { trim: 0xd8a040, band: '#241608' }), model: { weapon: 'pistol', head: 'skull', hat: 'tricorn', spikes: false, thin: true, cape: true }, shot: { dmg: 48, color: 0xffe08a, speed: 24, homing: 0.15, r: 0.2 } },
    brute: { name: '심해 어인', short: '어인', title: '바다 밑의 전사', scale: 1.5, col: C(0x3affc8, 0x2a6a7a, 0x1a3a4a, { cloth: 0x3a9aa8, band: '#04202a' }), model: { weapon: 'trident', head: 'fish', fins: true, bulk: 1.2, flat: false, smooth: true, spikes: false }, skill: '해일 강타', st: ['slow', 2.5, 0.6] },
    boss: { name: '유령 선장 블랙타이드', short: '블랙타이드', title: '노을 바다의 망령', s1: '망령 돌진', s2: '심해의 일격', col: C(0x5affd0, 0x1a2a3a, 0x0a1218, { trim: 0xd8a040, cloth: 0x2a0a14, band: '#041a1a' }), plan: 'float', kind: 'ghost', model: { weapon: 'sword', hat: true, cape: true, orbit: 3 }, st: ['slow', 2, 0.7],
      rain: { color: 0xffa040, color2: 0x2a2a2a, style: 'fall', dmg: 90 }, volley: { color: 0x7affe0, st: ['slow', 2, 0.6] } },
  });
