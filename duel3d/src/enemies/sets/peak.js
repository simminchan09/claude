// 7. 천봉 정상 — 산악 수행승 · 바람매 궁수 · 돌 수호상 · 천둥 산신
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'peak',
    grunt: { name: '타락한 수행승', short: '수행승', title: '정상의 파계승', fast: true, col: C(0xffb04a, 0xa83a1a, 0x2a1a14, { cloth: 0xc84a1a, band: '#2a1004' }), model: { weapon: 'staff', head: 'beast', spikes: false, hat: 'straw' } },
    archer: { name: '바람매 궁수', short: '매궁수', title: '하늘 사냥꾼', skill: '바람 화살', col: C(0xa8e0ff, 0x5a4a3a, 0x2a2420, { cloth: 0x6a5a4a, band: '#0a1a2a' }), model: { weapon: 'bow', head: 'beast', wings: true, spikes: false, tail: { w: 0.7 } }, shot: { dmg: 22, n: 3, color: 0xc8f0ff, speed: 20, homing: 0.3, r: 0.22 } },
    brute: { name: '돌사자 해태', short: '해태', title: '불탑의 문지기', scale: 1.6, plan: 'quad', kind: 'lion', col: C(0x7ad0ff, 0x8a8a80, 0x8a8a80, { cloth: 0x6a6a64, band: '#14181a' }), model: { rough: 0.85, metal: 0.05, flat: true }, skill: '바위 내려찍기', st: ['slow', 2, 0.6] },
    boss: { name: '천둥 산신 뇌공', short: '뇌공', title: '구름 위의 산신', s1: '번개 돌진', s2: '뇌성 강타', col: C(0x8ad8ff, 0x2a2a4a, 0x10101c, { trim: 0xffd060, cloth: 0x3a3a6a, band: '#060a2a' }), model: { weapon: 'hammer', head: 'mask', horns: 0.14, halo: true, cape: true }, st: ['vuln', 3, 1.15],
      rain: { color: 0x9ae0ff, color2: 0xffffff, style: 'fall', st: ['vuln', 3, 1.2], n: 7, gap: 0.15, warn: 0.75 }, volley: { color: 0xbaf0ff, n: 7, speed: 22, st: ['vuln', 2, 1.15] } },
  });
