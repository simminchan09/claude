// 1. 일식의 신전 — 공허 결정체
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'eclipse',
    grunt: { name: '공허 파편병', short: '파편병', title: '공허 잡병', col: C(0xff3a5a, 0x2a2233, 0x15121c, { band: '#2a0612' }), model: { weapon: 'claw' } },
    archer: { name: '공허 사수', short: '사수', title: '떠도는 공허 정령', skill: '공허탄', plan: 'float', kind: 'wisp', col: C(0xb06aff, 0x231f33, 0x15121c, { cloth: 0x2a1a44, band: '#1a0a2a' }), model: { orbit: 5 }, shot: { dmg: 45 } },
    brute: { name: '공허 파쇄자', short: '파쇄자', title: '중장갑 정예', plan: 'golem', kind: 'obsidian', col: C(0xff6a2a, 0x332622, 0x15121c, { band: '#2a1006' }), model: { weapon: 'hammer' } },
    boss: { name: '공허의 기사 니힐', short: '니힐', title: '공허의 기사', s1: '공허 돌진', s2: '파멸의 강타', col: C(0xb04aff, 0x241c30, 0x15121c, { band: '#1a0628' }), model: { weapon: 'greatsword' },
      rain: { color: 0xb04aff }, volley: { color: 0xd08aff } },
  });
