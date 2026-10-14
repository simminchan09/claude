// 몬스터 · 보스 정의 (토벌전 · 보스전) — 맵마다 그 맵 특색에 맞는 세트가 나온다
// 세트 = 잡몹(grunt) · 원거리(archer) · 정예(brute, 슈퍼아머) · 보스(boss). 맵별 파일은 sets/<맵 id>.js
// 상태 효과 st: [종류, 시간, 세기] — slow(이동 ×k) · burn/bleed(초당 피해) · vuln(받는 피해 ×k)
import eclipse from './sets/eclipse.js';
import desert from './sets/desert.js';
import snow from './sets/snow.js';
import plains from './sets/plains.js';
import ocean from './sets/ocean.js';
import volcano from './sets/volcano.js';
import peak from './sets/peak.js';
import bamboo from './sets/bamboo.js';
import neon from './sets/neon.js';
import orbit from './sets/orbit.js';

export const ENEMY_SETS = { eclipse, desert, snow, plains, ocean, volcano, peak, bamboo, neon, orbit };
// 맵에 맞는 세트 (모르는 맵이면 일식의 신전 세트)
export const enemiesFor = (mapId) => ENEMY_SETS[mapId] || ENEMY_SETS.eclipse;
export const ENEMIES = ENEMY_SETS.eclipse;
// 토벌전 구성 (역할 이름, 마지막은 보스)
export const WAVES = [['grunt', 'grunt', 'grunt'], ['grunt', 'archer', 'grunt', 'archer'], ['brute', 'grunt', 'archer'], ['boss']];
