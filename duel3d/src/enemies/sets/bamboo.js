// 8. 죽림 사당 — 그림자 닌자 · 수리검 닌자 · 오니 · 구미호
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'bamboo',
    grunt: { name: '그림자 닌자', short: '닌자', title: '죽림의 자객', fast: true, speed: 5.6, hp: 250, col: C(0xff3a4a, 0x1a1a24, 0x0a0a10, { cloth: 0x14141c, band: '#1a0408' }), model: { weapon: 'katana', head: 'hood', spikes: false }, st: ['bleed', 3, 6] },
    archer: { name: '수리검 닌자', short: '수리검', title: '나무 위의 눈', skill: '수리검 난사', col: C(0xc8c8ff, 0x24243a, 0x0a0a14, { cloth: 0x1a1a2a, band: '#0a0a1a' }), model: { weapon: 'shuriken', head: 'hood', spikes: false }, shot: { dmg: 20, n: 3, color: 0xd8d8ff, speed: 19, homing: 0.2, r: 0.2, st: ['bleed', 2, 5] } },
    brute: { name: '사당의 오니', short: '오니', title: '붉은 도깨비', scale: 1.55, plan: 'golem', kind: 'oni', col: C(0xffd040, 0x5a1a14, 0xc83a2a, { trim: 0xe8c040, cloth: 0xd8a040, band: '#2a0806' }), model: { weapon: 'club' }, skill: '도깨비 방망이' },
    boss: { name: '구미호 쿠즈하', short: '쿠즈하', title: '사당을 삼킨 여우', speed: 6, plan: 'quad', kind: 'fox', scale: 1.7, s1: '여우불 질주', s2: '요기 폭발', col: C(0xff7ad0, 0xf0e8f0, 0x2a1a2a, { trim: 0xff5a8a, cloth: 0xc82a4a, band: '#2a0a1a' }), model: { tails: 9, crown: true }, st: ['bleed', 3, 6],
      rain: { color: 0x8a6aff, color2: 0xff8ad0, style: 'up', n: 9, gap: 0.12, r: 1.3, dmg: 70 }, volley: { color: 0xa88aff, n: 9, speed: 13, st: ['bleed', 3, 5] } },
  });
