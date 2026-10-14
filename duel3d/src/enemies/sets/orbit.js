// 10. 궤도 성역 — 별빛 수호병 · 성좌 마법사 · 수정 거상 · 성좌의 심판자 아스트라
// 잡몹 · 원거리 · 정예는 makeSet 의 기술(밸런스)을 그대로 쓰고 모델만 새로 조형한다 (orbit_model.js).
// 보스 아스트라는 기술 · 자세 · AI 를 모두 직접 정의한다 (orbit_boss.js).
import { makeSet } from '../kit.js';
import { buildSentinel, buildStarMage, buildCrystalColossus } from './orbit_model.js';
import * as B from './orbit_boss.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

const S = makeSet({ id: 'orbit',
    grunt: { name: '별빛 수호병', short: '수호병', title: '성역의 파수꾼', col: C(0x9ab8ff, 0xe8e8f0, 0x2a2a3a, { trim: 0xd8c070, band: '#0a0a2a' }), model: { weapon: 'spear', head: 'helmet', spikes: false } },
    archer: { name: '성좌 마법사', short: '마법사', title: '별을 읽는 자', skill: '성광탄', plan: 'float', kind: 'robe', col: C(0xd0a8ff, 0x3a2a6a, 0x14102a, { cloth: 0x2a1a5a, trim: 0xd8c070, band: '#120a2a' }), model: { weapon: 'staff', halo: true, orbit: 7 }, shot: { dmg: 24, n: 3, color: 0xe0c8ff, speed: 11, homing: 0.9, r: 0.26, st: ['slow', 2, 0.7] } },
    brute: { name: '수정 거상', short: '거상', title: '궤도의 기둥', scale: 1.6, plan: 'golem', kind: 'crystal', col: C(0x8ae0ff, 0x9ad8f0, 0x3a4a6a, { band: '#04142a' }), model: { metal: 0.2, rough: 0.05 }, skill: '수정 붕괴', st: ['slow', 2.5, 0.55] },
    boss: { name: '성좌의 심판자 아스트라', short: '아스트라', title: '궤도 성역의 천칭', col: C(0xffe08a, 0xf0f0ff, 0x1a1a3a, { trim: 0xffd060, cloth: 0x3a3a8a, band: '#0a0a2a' }), plan: 'float', kind: 'wisp' },
  });
S.grunt.createModel = (p) => buildSentinel(p);
S.archer.createModel = (p) => buildStarMage(p);
S.brute.createModel = (p) => buildCrystalColossus(p);
// 보스: 천체의 심판자 (중력 · 격자 낙성 · 광선 고리 · 거울 분신 · 시간 정지 → 심판)
S.boss = { ...S.boss, scale: 1.5, stats: { hp: 4200, speed: 4.2, jump: 9, daze: 340, armor: true, breakTime: 5 },
  skills: B.skills, createModel: B.createModel, poses: B.poses, moves: B.moves, ai: B.ai };
delete S.boss.runCycle;
export default S;
