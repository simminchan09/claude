// 3. 빙설 요새 — 서리 늑대 · 얼음 정령 · 설원 예티 · 빙설 여왕 이스벨
// 잡몹 · 원거리 · 정예는 makeSet 의 기술(밸런스)을 그대로 쓰고 모델만 새로 조형한다 (snow_model.js).
// 보스 이스벨은 기술 · 자세 · AI 를 모두 직접 정의한다 (snow_boss.js).
import { makeSet } from '../kit.js';
import { buildFrostWolf, buildIceSpirit, buildYeti } from './snow_model.js';
import * as B from './snow_boss.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

const S = makeSet({ id: 'snow',
    grunt: { name: '서리 늑대', short: '늑대', title: '설원의 사냥개', fast: true, speed: 6, plan: 'quad', kind: 'wolf', scale: 1.25, col: C(0x7ad8ff, 0xc8d8e8, 0xb8c8d8, { band: '#08182a' }), model: {}, st: ['slow', 1.5, 0.75] },
    archer: { name: '얼음 정령', short: '정령', title: '눈보라의 혼', skill: '고드름 투척', plan: 'float', kind: 'wisp', col: C(0x9af0ff, 0xc8ecff, 0x1a2a3a, { cloth: 0x8ad0ff, band: '#0a1a2a' }), model: { orbit: 6 }, shot: { dmg: 42, color: 0xbaf4ff, speed: 14, st: ['slow', 2.5, 0.55] } },
    brute: { name: '설원 예티', short: '예티', title: '빙하의 거수', scale: 1.5, plan: 'golem', kind: 'fur', col: C(0x6ac8ff, 0x9ab8d0, 0xf0f4f8, { band: '#0a1a2a' }), model: {}, skill: '빙하 내려찍기', st: ['slow', 3, 0.5] },
    boss: { name: '빙설 여왕 이스벨', short: '이스벨', title: '얼어붙은 요새의 주인', col: C(0x8ae8ff, 0xd8ecff, 0x2a3a5a, { trim: 0xc8f0ff, cloth: 0x4a7aaa, band: '#06142a' }), plan: 'float', kind: 'gown' },
  });
S.grunt.createModel = (p) => buildFrostWolf(p);
S.archer.createModel = (p) => buildIceSpirit(p);
S.brute.createModel = (p) => buildYeti(p);
// 보스: 원거리 견제형 얼음 마법사
S.boss = { ...S.boss, scale: 1.5, stats: { hp: 4200, speed: 4.4, jump: 9, daze: 340, armor: true, breakTime: 5 },
  skills: B.skills, createModel: B.createModel, poses: B.poses, moves: B.moves, ai: B.ai };
delete S.boss.runCycle;
export default S;
