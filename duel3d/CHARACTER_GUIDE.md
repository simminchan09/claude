# 캐릭터 추가 가이드

캐릭터 하나 = `src/characters/` 안의 파일 하나입니다. 시스템(입력·물리·판정·HUD·카메라·컷인·AI)은 모두 공용이라 캐릭터 파일에는 **외형, 포즈, 기술 데이터**만 들어갑니다.

## 1. 순서
1. `src/characters/trainer.js`를 복사해서 `src/characters/<이름>.js`로 만든다.
2. `src/characters/index.js`의 `ROSTER` 배열에 추가한다. 선택 화면에 바로 나타난다.
3. 훈련 모드(`1` 궁극기 충전, `2` 쿨타임 초기화, `3` 체력 회복, `4` 더미 행동 변경)에서 기술을 확인한다.

## 2. 캐릭터 정의 객체
```js
export default {
  id, name, short, title, desc,            // 표시용 텍스트
  stats: { hp, speed /*m/s*/, jump /*m/s*/ },
  palettes: [{ accent, armor, band }, ...], // [0] = 기본, [1] = 같은 캐릭터 미러전용 색
  skills: { heavy: { name }, s1: { name, cd }, s2: { name, cd }, ult: { name, sub } }, // HUD 스킬 칸 이름
  moveList: [['약공 ×3', '설명'], ...],    // 선택 화면 기술표
  createModel(palette),                     // 3D 모델 생성 (아래 3번)
  poses,                                    // 공통 포즈 (아래 4번)
  moves,                                    // 기술 (아래 5번)
  hitFx(G, point, dir, hit, attacker),      // (선택) 타격 이펙트 교체
  aiPick(f, opp, dist),                     // (선택) CPU가 쓸 기술 이름 반환
};
```

## 3. 모델
`buildHumanoid(dims)`가 관절 계층을 만들어 줍니다. 관절(`J.chest`, `J.handR` 등)에 메시를 붙이면 포즈에 따라 움직입니다.
- 무기는 `J.weapon`(오른손)에 붙이고 **+Z 방향**으로 뻗게 만든다.
- `weaponPts(base, tip)`을 구현하면 공격 중 무기 궤적이 자동으로 그려진다.
- `sole`(발바닥 두께)로 접지 높이를 맞춘다. 발은 자동으로 바닥에 붙는다.
- (선택) `update(dt, fighter)`로 머리카락·망토 같은 추가 애니메이션을 넣을 수 있다.

## 4. 포즈
포즈 = `{ hipY, 관절: [x, y, z] }` (라디안). 지정하지 않은 관절은 `base` 값을 따릅니다.

| 방향 | 규칙 |
|---|---|
| 팔·다리 앞으로 들기 | x 음수 |
| 무릎 접기 / 팔꿈치 굽히기 | 무릎 x 양수 / 팔꿈치 x 음수 |
| 상체 숙이기 · 비틀기 | spine/chest x 양수 · y 양수 = 왼쪽 |
| 팔 벌리기 | 왼팔 z 양수, 오른팔 z 음수 |

필수 포즈 이름: `base`(대기) `run` `jump` `guard` `hit` `air`(공중 피격) `down`(누움) `dash` `win` `portrait`(컷인 초상).

## 5. 기술
이름 규칙과 키: `light1 → light2 → light3` = 좌클릭 연타, `heavy` = 우클릭, `s1` = Shift, `s2` = E, `ult` = Q.

| 필드 | 의미 |
|---|---|
| `dur` | 전체 길이(초) |
| `keys` | `[[시간, 포즈]]` — 앞 키를 이어받아 누적. `'base'`나 포즈 이름도 가능 |
| `hits` | `[{ t0, t1, at: [오른쪽, 위, 앞], r, dmg, kb: [밀림, 띄움], stun, hs, unblock, force, nokill, noScale }]` |
| `ev` | `[[시간, (f, o, G) => {}]]` — 이펙트·투사체·순간이동 등 |
| `lunge` | `[[t0, t1, 전진속도]]` |
| `track` | 이 시간까지 상대 쪽으로 회전 |
| `next`, `cancel` | 약공 연계 대상과 입력 허용 시점 |
| `cd` | `'s1'`/`'s2'` 쿨타임 슬롯 |
| `trail` | 무기 궤적 표시 |
| `tick(f, o, G, t, dt)` | 매 프레임 실행 |
| `end(f, o, G)` | 종료·중단 시 정리 |
| `ult: true` + `cam` | 궁극기. 컷인 뒤 `cam` 키프레임으로 카메라 연출: `[[t, { ref: 'self'|'target', p: [오른쪽,위,앞], l: [...], fov }]]` |

적중하면 강공·스킬로 캔슬할 수 있습니다(시스템 공통).

## 6. 기술에서 쓸 수 있는 도구
- 좌표: `f.local([오른쪽, 위, 앞])`, `f.fwd()`, `f.right()`, `f.chest()`, `f.faceOpp()`
- 이펙트: `f.slashFx({ tilt, r, at, flip })`, `G.fx.burst / ring / slash / beam / light / impact / p`
- 화면: `G.shake(a)`, `G.flash(color, a)`, `G.slow(배율, 초)`, `G.setTint(color, a)`, `G.stage.flashSky(a)`
- 판정: `new Projectile(G, {...})` + `G.spawn()`, `areaHit(f, 중심, 반경, hit)`
- 궁극기 고정: `o.lock()` / `o.release()`
- 소리: `sfx('swing' | 'heavy' | 'hit' | 'big' | 'zap' | 'shot' | 'boom' | 'charge' | 'dash' ...)`
