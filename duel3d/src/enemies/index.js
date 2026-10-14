// 몬스터 · 보스 정의 (토벌전 · 보스전) — 맵마다 그 맵 특색에 맞는 세트가 나온다
// 세트 = 잡몹(grunt) · 원거리(archer) · 정예(brute, 슈퍼아머) · 보스(boss). 만드는 도구는 kit.js 의 makeSet.
// 상태 효과 st: [종류, 시간, 세기] — slow(이동 ×k) · burn/bleed(초당 피해) · vuln(받는 피해 ×k)
import { makeSet } from './kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export const ENEMY_SETS = {
  // 1. 일식의 신전 — 공허 결정체
  eclipse: makeSet({ id: 'eclipse',
    grunt: { name: '공허 파편병', short: '파편병', title: '공허 잡병', col: C(0xff3a5a, 0x2a2233, 0x15121c, { band: '#2a0612' }), model: { weapon: 'claw' } },
    archer: { name: '공허 사수', short: '사수', title: '원거리 잡병', skill: '공허탄', col: C(0xb06aff, 0x231f33, 0x15121c, { band: '#1a0a2a' }), model: { weapon: 'dagger' }, shot: { dmg: 45 } },
    brute: { name: '공허 파쇄자', short: '파쇄자', title: '중장갑 정예', col: C(0xff6a2a, 0x332622, 0x15121c, { band: '#2a1006' }), model: { weapon: 'hammer' } },
    boss: { name: '공허의 기사 니힐', short: '니힐', title: '공허의 기사', s1: '공허 돌진', s2: '파멸의 강타', col: C(0xb04aff, 0x241c30, 0x15121c, { band: '#1a0628' }), model: { weapon: 'greatsword' },
      rain: { color: 0xb04aff }, volley: { color: 0xd08aff } },
  }),
  // 2. 붉은 모래 협곡 — 사막 유적의 미라 · 전갈 · 사암 골렘 · 모래 파라오
  desert: makeSet({ id: 'desert',
    grunt: { name: '모래 미라병', short: '미라병', title: '유적의 망자', col: C(0xffc04a, 0xd8c8a0, 0x6a5a48, { cloth: 0xe8dcc0, band: '#3a2408' }), model: { weapon: 'scimitar', head: 'skull', spikes: false, flat: false }, st: ['bleed', 3, 5] },
    archer: { name: '전갈 독궁수', short: '독궁수', title: '사막 사냥꾼', skill: '독화살', col: C(0x8aff4a, 0x7a3a1a, 0x3a2414, { band: '#1a2a08' }), model: { weapon: 'bow', head: 'beast', tail: { w: 0.9 } }, shot: { dmg: 40, color: 0x9aff4a, speed: 16, homing: 0.4, st: ['burn', 4, 6] } },
    brute: { name: '사암 골렘', short: '골렘', title: '협곡의 수호석', col: C(0xff8a3a, 0xb06a3a, 0x7a4a2a, { band: '#2a1208' }), model: { weapon: 'rock', head: 'stone', bulk: 1.25, spikes: false }, skill: '사암 붕괴', st: ['slow', 2.5, 0.6] },
    boss: { name: '모래 파라오 세크메트', short: '세크메트', title: '협곡의 저주받은 왕', s1: '사풍 돌진', s2: '모래 폭풍 강타', col: C(0xffd040, 0x2a3a6a, 0x1a1408, { trim: 0xffc040, cloth: 0x2a3a8a, band: '#2a1a04' }), model: { weapon: 'spear', head: 'skull', hat: 'nemes', cape: true }, st: ['slow', 2, 0.7],
      rain: { color: 0xffb040, color2: 0xfff0b0, style: 'up', st: ['slow', 3, 0.5] }, volley: { color: 0xffc040, st: ['bleed', 3, 6] } },
  }),
  // 3. 빙설 요새 — 서리 늑대 · 얼음 투척병 · 예티 · 빙설 여왕
  snow: makeSet({ id: 'snow',
    grunt: { name: '서리 늑대병', short: '늑대병', title: '설원 약탈자', fast: true, speed: 5.4, col: C(0x7ad8ff, 0xc8d8e8, 0x3a4a5a, { band: '#08182a' }), model: { weapon: 'claw', head: 'beast', mane: true, cloth: true, tail: { w: 1.3 } }, st: ['slow', 1.5, 0.75] },
    archer: { name: '얼음 투척병', short: '투척병', title: '요새의 척후', skill: '고드름 투척', col: C(0x9af0ff, 0x4a6a8a, 0x1a2a3a, { band: '#0a1a2a' }), model: { weapon: 'orb', head: 'hood' }, shot: { dmg: 42, color: 0xbaf4ff, speed: 14, st: ['slow', 2.5, 0.55] } },
    brute: { name: '설원 예티', short: '예티', title: '빙하의 거수', scale: 1.5, col: C(0x6ac8ff, 0xf0f4f8, 0x8a9aaa, { cloth: 0xf0f4f8, band: '#0a1a2a' }), model: { weapon: 'club', head: 'beast', mane: true, bulk: 1.35, flat: false, smooth: true }, skill: '빙하 내려찍기', st: ['slow', 3, 0.5] },
    boss: { name: '빙설 여왕 이스벨', short: '이스벨', title: '얼어붙은 요새의 주인', s1: '서리 질주', s2: '빙결 파동', col: C(0x8ae8ff, 0xd8ecff, 0x2a3a5a, { trim: 0xc8f0ff, cloth: 0x4a7aaa, band: '#06142a' }), model: { weapon: 'staff', head: 'crystal', crown: true, cape: true, wings: 'glow' }, st: ['slow', 2, 0.65],
      rain: { color: 0xa8f0ff, color2: 0xffffff, style: 'fall', st: ['slow', 3.5, 0.4], n: 6 }, volley: { color: 0xc8f8ff, st: ['slow', 2, 0.6] } },
  }),
  // 4. 바람의 평원 — 고블린 · 고블린 투석병 · 오우거 · 폭풍 켄타우로스
  plains: makeSet({ id: 'plains',
    grunt: { name: '고블린 약탈자', short: '고블린', title: '마을 습격대', fast: true, speed: 5.2, scale: 0.85, hp: 240, col: C(0xd8ff4a, 0x4a7a2a, 0x3a2a1a, { band: '#14240a' }), model: { weapon: 'dagger', head: 'goblin', spikes: false } },
    archer: { name: '고블린 투석병', short: '투석병', title: '언덕의 매복병', skill: '돌팔매', scale: 0.85, col: C(0xffe08a, 0x5a7a2a, 0x3a2a1a, { band: '#14240a' }), model: { weapon: 'rock', head: 'goblin', spikes: false }, shot: { dmg: 46, color: 0xc8b090, speed: 15, homing: 0.3, arc: 0.18 } },
    brute: { name: '평원 오우거', short: '오우거', title: '건초밭의 폭군', scale: 1.55, hp: 1000, col: C(0xffa04a, 0x8a9a5a, 0x5a4a3a, { cloth: 0x6a4a2a, band: '#241a0a' }), model: { weapon: 'club', head: 'mask', bulk: 1.4, flat: false, smooth: true, spikes: false }, skill: '몽둥이 내려찍기' },
    boss: { name: '폭풍 켄타우로스 갈레', short: '갈레', title: '평원을 달리는 폭풍', speed: 5.4, s1: '질풍 돌격', s2: '돌풍 짓밟기', col: C(0x7affd0, 0x3a6a4a, 0x2a2014, { trim: 0xd8c070, cloth: 0x2a5a3a, band: '#06241a' }), model: { weapon: 'spear', head: 'helmet', mane: true, tail: { w: 1.2 } },
      rain: { color: 0x9affe0, color2: 0xffffff, style: 'up', n: 6, gap: 0.18 }, volley: { color: 0xb8ffe8, n: 6, speed: 18 } },
  }),
  // 5. 노을빛 해상 — 해골 해적 · 해적 총잡이 · 심해 어인 · 유령 선장
  ocean: makeSet({ id: 'ocean',
    grunt: { name: '해골 해적', short: '해골', title: '저주받은 선원', col: C(0x4affd8, 0xe8e0c8, 0x2a2a3a, { cloth: 0x8a1a2a, band: '#08201e' }), model: { weapon: 'scimitar', head: 'skull', spikes: false, flat: false }, st: ['bleed', 3, 5] },
    archer: { name: '해적 총잡이', short: '총잡이', title: '갑판의 사수', skill: '권총 사격', col: C(0xffd060, 0x6a3a2a, 0x1a1a24, { trim: 0xd8a040, band: '#241608' }), model: { weapon: 'pistol', head: 'skull', hat: 'tricorn', spikes: false }, shot: { dmg: 48, color: 0xffe08a, speed: 24, homing: 0.15, r: 0.2 } },
    brute: { name: '심해 어인', short: '어인', title: '바다 밑의 전사', scale: 1.45, col: C(0x3affc8, 0x2a6a7a, 0x1a3a4a, { cloth: 0x3a9aa8, band: '#04202a' }), model: { weapon: 'trident', head: 'fish', fins: true, bulk: 1.2, flat: false, smooth: true, spikes: false }, skill: '해일 강타', st: ['slow', 2.5, 0.6] },
    boss: { name: '유령 선장 블랙타이드', short: '블랙타이드', title: '노을 바다의 망령', s1: '망령 돌진', s2: '심해의 일격', col: C(0x5affd0, 0x1a2a3a, 0x0a1218, { trim: 0xd8a040, cloth: 0x2a0a14, band: '#041a1a' }), model: { weapon: 'sword', head: 'skull', hat: 'tricorn', cape: true }, st: ['slow', 2, 0.7],
      rain: { color: 0xffa040, color2: 0x2a2a2a, style: 'fall', dmg: 90 }, volley: { color: 0x7affe0, st: ['slow', 2, 0.6] } },
  }),
  // 6. 용암 분화구 — 용암 임프 · 화염 술사 · 흑요석 골렘 · 화염 거인
  volcano: makeSet({ id: 'volcano',
    grunt: { name: '용암 임프', short: '임프', title: '분화구의 졸개', fast: true, speed: 5.2, scale: 0.85, hp: 240, col: C(0xff6a1a, 0x5a1a10, 0x2a0a06, { trim: 0x2a1a1a, band: '#2a0a04' }), model: { weapon: 'claw', head: 'mask', horns: 0.12, tail: { glow: true }, wings: true, cloth: 0x3a1010 }, st: ['burn', 3, 6] },
    archer: { name: '화염 술사', short: '술사', title: '불꽃 교단', skill: '화염구', col: C(0xff8a2a, 0x3a1a14, 0x1a0806, { cloth: 0x5a1a10, band: '#2a0a04' }), model: { weapon: 'flame', head: 'hood' }, shot: { dmg: 40, color: 0xff7a2a, speed: 12, homing: 0.8, r: 0.36, st: ['burn', 4, 8] } },
    brute: { name: '흑요석 골렘', short: '흑요석', title: '용암의 핵', scale: 1.5, col: C(0xff5a10, 0x1a1418, 0x0a0808, { band: '#2a0804' }), model: { weapon: 'rock', head: 'stone', bulk: 1.3, metal: 0.7, rough: 0.2 }, skill: '용암 분출', st: ['burn', 4, 10] },
    boss: { name: '화염 거인 수르트', short: '수르트', title: '분화구의 왕', scale: 1.75, s1: '불꽃 돌진', s2: '대지 용융', col: C(0xff4a10, 0x2a1410, 0x140806, { trim: 0xff8a2a, cloth: 0x3a0a06, band: '#2a0604' }), model: { weapon: 'greatsword', head: 'mask', horns: 0.22, crown: true, bulk: 1.15 }, st: ['burn', 3, 8],
      rain: { color: 0xff5a10, color2: 0xffd080, style: 'fall', st: ['burn', 4, 10], n: 6 }, volley: { color: 0xff7a2a, st: ['burn', 3, 8] } },
  }),
  // 7. 천봉 정상 — 산악 수행승 · 바람매 궁수 · 돌 수호상 · 천둥 산신
  peak: makeSet({ id: 'peak',
    grunt: { name: '타락한 수행승', short: '수행승', title: '정상의 파계승', fast: true, col: C(0xffb04a, 0xa83a1a, 0x2a1a14, { cloth: 0xc84a1a, band: '#2a1004' }), model: { weapon: 'staff', head: 'beast', spikes: false, hat: 'straw' } },
    archer: { name: '바람매 궁수', short: '매궁수', title: '하늘 사냥꾼', skill: '바람 화살', col: C(0xa8e0ff, 0x5a4a3a, 0x2a2420, { cloth: 0x6a5a4a, band: '#0a1a2a' }), model: { weapon: 'bow', head: 'beast', wings: true, spikes: false }, shot: { dmg: 22, n: 3, color: 0xc8f0ff, speed: 20, homing: 0.3, r: 0.22 } },
    brute: { name: '돌 수호상', short: '수호상', title: '불탑의 문지기', scale: 1.5, col: C(0x7ad0ff, 0x8a8a80, 0x5a5a54, { band: '#14181a' }), model: { weapon: 'axe', head: 'stone', bulk: 1.3, rough: 0.8, metal: 0.1 }, skill: '바위 내려찍기', st: ['slow', 2, 0.6] },
    boss: { name: '천둥 산신 뇌공', short: '뇌공', title: '구름 위의 산신', s1: '번개 돌진', s2: '뇌성 강타', col: C(0x8ad8ff, 0x2a2a4a, 0x10101c, { trim: 0xffd060, cloth: 0x3a3a6a, band: '#060a2a' }), model: { weapon: 'hammer', head: 'mask', horns: 0.14, halo: true, cape: true }, st: ['vuln', 3, 1.15],
      rain: { color: 0x9ae0ff, color2: 0xffffff, style: 'fall', st: ['vuln', 3, 1.2], n: 7, gap: 0.15, warn: 0.75 }, volley: { color: 0xbaf0ff, n: 7, speed: 22, st: ['vuln', 2, 1.15] } },
  }),
  // 8. 죽림 사당 — 그림자 닌자 · 수리검 닌자 · 오니 · 구미호
  bamboo: makeSet({ id: 'bamboo',
    grunt: { name: '그림자 닌자', short: '닌자', title: '죽림의 자객', fast: true, speed: 5.6, hp: 250, col: C(0xff3a4a, 0x1a1a24, 0x0a0a10, { cloth: 0x14141c, band: '#1a0408' }), model: { weapon: 'katana', head: 'hood', spikes: false }, st: ['bleed', 3, 6] },
    archer: { name: '수리검 닌자', short: '수리검', title: '나무 위의 눈', skill: '수리검 난사', col: C(0xc8c8ff, 0x24243a, 0x0a0a14, { cloth: 0x1a1a2a, band: '#0a0a1a' }), model: { weapon: 'shuriken', head: 'hood', spikes: false }, shot: { dmg: 20, n: 3, color: 0xd8d8ff, speed: 19, homing: 0.2, r: 0.2, st: ['bleed', 2, 5] } },
    brute: { name: '사당의 오니', short: '오니', title: '붉은 도깨비', scale: 1.55, col: C(0xffd040, 0xc83a2a, 0x5a1a14, { trim: 0xe8e0c8, cloth: 0x2a2a3a, band: '#2a0806' }), model: { weapon: 'club', head: 'mask', horns: 0.14, bulk: 1.35, flat: false, smooth: true, spikes: false }, skill: '도깨비 방망이' },
    boss: { name: '구미호 쿠즈하', short: '쿠즈하', title: '사당을 삼킨 여우', speed: 5.2, s1: '여우불 질주', s2: '요기 폭발', col: C(0xff7ad0, 0xf0e8f0, 0x2a1a2a, { trim: 0xff5a8a, cloth: 0xc82a4a, band: '#2a0a1a' }), model: { weapon: 'katana', head: 'beast', tail: { w: 1.2, n: 9 }, cape: true }, st: ['bleed', 3, 6],
      rain: { color: 0x8a6aff, color2: 0xff8ad0, style: 'up', n: 9, gap: 0.12, r: 1.3, dmg: 70 }, volley: { color: 0xa88aff, n: 9, speed: 13, st: ['bleed', 3, 5] } },
  }),
  // 9. 네온 시티 옥상 — 사이버 깡패 · 저격 드로이드 · 중장갑 메크 · 메가 메크
  neon: makeSet({ id: 'neon',
    grunt: { name: '사이버 깡패', short: '깡패', title: '옥상 갱단', fast: true, col: C(0xff2ad8, 0x2a2a3a, 0x14141c, { trim: 0x2affff, band: '#1a0420' }), model: { weapon: 'sword', head: 'visor', spikes: false }, st: ['vuln', 2, 1.1] },
    archer: { name: '저격 드로이드', short: '드로이드', title: '보안 시스템', skill: '레이저 사격', col: C(0x2affff, 0x3a3a4a, 0x1a1a24, { trim: 0xff2ad8, band: '#04202a' }), model: { weapon: 'blaster', head: 'visor', spikes: false, metal: 0.8, rough: 0.2 }, shot: { dmg: 44, color: 0x4affff, speed: 28, homing: 0.1, r: 0.18, st: ['vuln', 3, 1.12] } },
    brute: { name: '중장갑 메크', short: '메크', title: '진압용 기체', scale: 1.5, col: C(0xffd02a, 0x4a4a5a, 0x2a2a34, { trim: 0xffd02a, band: '#2a2004' }), model: { weapon: 'hammer', head: 'visor', bulk: 1.35, pack: true, metal: 0.8, rough: 0.25 }, skill: '파일 드라이버' },
    boss: { name: '메가 메크 오버클럭', short: '오버클럭', title: '옥상의 최종 병기', scale: 1.8, s1: '부스터 돌진', s2: '충격 착지', col: C(0xff2a6a, 0x2a2a38, 0x101018, { trim: 0x2affff, band: '#20041a' }), model: { weapon: 'greatsword', head: 'visor', pack: true, bulk: 1.2, wings: 'glow', metal: 0.85, rough: 0.2 }, st: ['vuln', 2, 1.12],
      rain: { color: 0xff3a8a, color2: 0x4affff, style: 'fall', n: 7, gap: 0.14, dmg: 80 }, volley: { color: 0x4affff, n: 6, speed: 26, st: ['vuln', 2, 1.15] } },
  }),
  // 10. 궤도 성역 — 별빛 수호병 · 성좌 마법사 · 수정 거상 · 성좌의 심판자
  orbit: makeSet({ id: 'orbit',
    grunt: { name: '별빛 수호병', short: '수호병', title: '성역의 파수꾼', col: C(0x9ab8ff, 0xe8e8f0, 0x2a2a3a, { trim: 0xd8c070, band: '#0a0a2a' }), model: { weapon: 'spear', head: 'helmet', spikes: false } },
    archer: { name: '성좌 마법사', short: '마법사', title: '별을 읽는 자', skill: '성광탄', col: C(0xd0a8ff, 0x3a2a6a, 0x14102a, { cloth: 0x2a1a5a, trim: 0xd8c070, band: '#120a2a' }), model: { weapon: 'staff', head: 'hood', halo: true }, shot: { dmg: 24, n: 3, color: 0xe0c8ff, speed: 11, homing: 0.9, r: 0.26, st: ['slow', 2, 0.7] } },
    brute: { name: '수정 거상', short: '거상', title: '궤도의 기둥', scale: 1.55, col: C(0x8ae0ff, 0x9ad8f0, 0x3a4a6a, { band: '#04142a' }), model: { weapon: 'greatsword', head: 'crystal', bulk: 1.3, metal: 0.2, rough: 0.05 }, skill: '수정 붕괴', st: ['slow', 2.5, 0.55] },
    boss: { name: '성좌의 심판자 아스트라', short: '아스트라', title: '궤도 성역의 천칭', s1: '유성 돌진', s2: '중력 붕괴', col: C(0xffe08a, 0xf0f0ff, 0x1a1a3a, { trim: 0xffd060, cloth: 0x3a3a8a, band: '#0a0a2a' }), model: { weapon: 'spear', head: 'star', halo: true, wings: 'glow', crown: true }, st: ['slow', 2, 0.65],
      rain: { color: 0xffe08a, color2: 0x9ab8ff, style: 'fall', n: 7, st: ['slow', 3, 0.45] }, volley: { color: 0xfff0b0, n: 7, speed: 12, st: ['slow', 2, 0.6] } },
  }),
};
// 맵에 맞는 세트 (모르는 맵이면 일식의 신전 세트)
export const enemiesFor = (mapId) => ENEMY_SETS[mapId] || ENEMY_SETS.eclipse;
export const ENEMIES = ENEMY_SETS.eclipse;
// 토벌전 구성 (역할 이름, 마지막은 보스)
export const WAVES = [['grunt', 'grunt', 'grunt'], ['grunt', 'archer', 'grunt', 'archer'], ['brute', 'grunt', 'archer'], ['boss']];
