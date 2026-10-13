// 밸런스 표: 캐릭터별 · 기술 분류별 피해 배율.
// 분류는 기술을 시작할 때 정해지고(light/heavy/s1/s2/ult/counter/plunge), 그 기술이 만든 투사체 · 소환물 · 장판의 피해에도 그대로 따라간다.
// 기준(치명타 제외, 단일 대상): 근접 4연타 합 ≈ 175~185 · 원거리 4연타 ≈ 150 · 강공격(쿨 7~8초) ≈ 90~105 · 피해 스킬 ≈ 쿨타임 × 10 + 15 · 궁극기 ≈ 275~290
export const BALANCE = {
  leo:      { light: 0.84, s1: 0.65, s2: 0.8, ult: 0.92 },
  azazel:   { light: 0.88, s1: 1.1, s2: 1.1, counter: 0.9 },
  aquarist: { s1: 1.25, s2: 1.1, ult: 0.76 },
  sui:      { light: 1.06, ult: 1.15 },
  clown:    { light: 1.18, heavy: 2.0, s1: 0.85, ult: 0.88 },
  sniper:   {},
  lancer:   { s1: 0.95, counter: 0.8, ult: 0.84 },
  ignethia: { light: 1.2, heavy: 0.5, ult: 0.72 },
  guardian: { light: 0.94 },
  aurora:   { light: 1.06, s1: 1.6, s2: 1.3, ult: 1.17 },
  mudang:   { light: 1.35, s1: 1.45, s2: 1.1, ult: 1.1, plunge: 1.4 },
  morwen:   { light: 1.48, heavy: 0.83, ult: 0.97 },
};
// 기술 이름 → 분류 (move.cat 으로 직접 지정 가능, 쿨타임이 있는 보조 동작은 그 쿨타임 분류를 따른다)
export function moveCat(name, m) {
  if (m && m.cat) return m.cat;
  if (name.startsWith('light')) return 'light';
  if (name.startsWith('plunge')) return 'plunge';
  if (name === 'heavy' || name === 's1' || name === 's2' || name === 'ult' || name === 'counter') return name;
  if (m && m.ult) return 'ult';
  return (m && m.cd) || null;
}
export const balMul = (id, cat) => (cat && BALANCE[id] && BALANCE[id][cat]) || 1;
