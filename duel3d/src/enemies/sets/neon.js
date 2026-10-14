// 9. 네온 시티 옥상 — 사이버 깡패 · 저격 드로이드 · 중장갑 메크 · 메가 메크
import { makeSet } from '../kit.js';

const C = (accent, armor, body, extra = {}) => ({ accent, armor, body, band: extra.band, trim: extra.trim, cloth: extra.cloth });

export default makeSet({ id: 'neon',
    grunt: { name: '사이버 깡패', short: '깡패', title: '옥상 갱단', fast: true, col: C(0xff2ad8, 0x2a2a3a, 0x14141c, { trim: 0x2affff, band: '#1a0420' }), model: { weapon: 'sword', head: 'visor', spikes: false }, st: ['vuln', 2, 1.1] },
    archer: { name: '저격 드론', short: '드론', title: '보안 시스템', skill: '레이저 사격', plan: 'drone', col: C(0x2affff, 0x3a3a4a, 0x1a1a24, { trim: 0xff2ad8, band: '#04202a' }), model: {}, shot: { dmg: 44, color: 0x4affff, speed: 28, homing: 0.1, r: 0.18, st: ['vuln', 3, 1.12] } },
    brute: { name: '중장갑 메크', short: '메크', title: '진압용 기체', scale: 1.5, plan: 'golem', kind: 'mech', col: C(0xffd02a, 0x4a4a5a, 0x2a2a34, { trim: 0xffd02a, band: '#2a2004' }), model: { metal: 0.8, rough: 0.25 }, skill: '파일 드라이버' },
    boss: { name: '메가 메크 오버클럭', short: '오버클럭', title: '옥상의 최종 병기', scale: 1.9, plan: 'golem', kind: 'mech', s1: '부스터 돌진', s2: '충격 착지', col: C(0xff2a6a, 0x2a2a38, 0x101018, { trim: 0x2affff, band: '#20041a' }), model: { weapon: 'greatsword', head: 'visor', pack: true, bulk: 1.2, wings: 'glow', metal: 0.85, rough: 0.2 }, st: ['vuln', 2, 1.12],
      rain: { color: 0xff3a8a, color2: 0x4affff, style: 'fall', n: 7, gap: 0.14, dmg: 80 }, volley: { color: 0x4affff, n: 6, speed: 26, st: ['vuln', 2, 1.15] } },
  });
