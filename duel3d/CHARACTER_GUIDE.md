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
  aiRange: [min, max],                      // (선택) 원거리 캐릭터: CPU가 이 거리를 유지하며 사거리 안에서 쏜다 (아리엘)
  aimRange,                                 // (선택) 기술 시작 시 자동으로 상대를 바라보는 거리 (기본 10m)
  resource(f),                              // (선택) HP 아래 고유 게이지 { v, label, color, full }
};
```

## 3. 모델
`buildHumanoid(dims)`가 관절 계층을 만들어 줍니다. 관절(`J.chest`, `J.handR` 등)에 메시를 붙이면 포즈에 따라 움직입니다.
- 무기는 `J.weapon`(오른손)에 붙이고 **+Z 방향**으로 뻗게 만든다.
- `weaponPts(base, tip)`을 구현하면 공격 중 무기 궤적이 자동으로 그려진다.
- `sole`(발바닥 두께)로 접지 높이를 맞춘다. 발은 자동으로 바닥에 붙는다.
- 피격 판정은 관절 위치로 만든 캡슐(머리·몸통·팔·다리)이다. 굵기는 어깨 폭(`dims.shW`) 기준이며 `hurtScale`(정의 객체)로 키우거나 줄이고, 머리 끝은 `dims.headTop`(기본 0.2m)으로 맞춘다. 훈련 모드 `5` 로 확인.
- (선택) `update(dt, fighter)`로 머리카락·망토 같은 추가 애니메이션을 넣을 수 있다.
- (선택) `attachScene(scene)` / `dispose(scene)`: 캐릭터 밖(씬)에 두는 메시(예: 천 시뮬레이션 망토)를 만들고 정리한다. 이런 메시는 `extras` 배열에 넣으면 컷인 초상 렌더 때 함께 숨겨진다.
- (선택) `trailPts(base, tip)`: 궤적은 칼날만 그리고 판정은 `weaponPts`(자루 포함)로 하고 싶을 때.
- (선택) `rigHook(fighter)`: 포즈 적용 직후 호출된다. 레오는 여기서 `weapon` 값을 손목 회전 대신 **몸 기준 창끝 방향 [피치(위+), 좌우(오른쪽+), 롤]** 로 해석한다 — 긴 무기는 이 방식이 궤적을 잡기 훨씬 쉽다.
- 무기를 던지는 기술은 `setWeapon(false)` 동안 `weaponOut` 이 참이 되어 공격 입력이 막힌다.

### 3-0. 물리 부품 (`src/cloth.js`)
- `Cloth(scene, W, H, len, mat)`: 위쪽 줄이 고정된 천 (망토). 매 프레임 `anchors` 를 옮기고 `step()`.
- `Rope(n, seg)`: 첫 점이 고정된 로프 (땋은 머리 · 사슬 · 키링). `step(dt, 고정점, 충돌 캡슐, 바닥, 기본 방향)`.
- `RopeTube` / `RopeChain`: 로프를 굵기가 변하는 관 / 사슬 고리로 그린다. 아자젤의 `m.ropes` 처리 참고.
  `RopeTube` 의 `flat`(납작한 리본) · `wave(v)`(옆으로 물결) · `side`(넓은 면 방향, 매 프레임 갱신 가능)로 긴 웨이브 머리를 만든다 — 아리엘 참고. 머리칼 충돌에는 피격 캡슐 대신 짧은 몸통 캡슐 + 머리 구를 쓴다 (몸통 캡슐 윗부분이 뒷머리 고정점을 삼키면 머리칼이 위로 튄다).
- 몸 밖(씬)에 두는 메시는 `extras` 에 넣어 컷인 초상에서 숨긴다.

### 3-0b. 얼굴 (`src/face.js`)
- `animeHead({ C, R, jaw, chin, short, nose, ... })`: 구를 깎아 얼굴형(턱선 · 평평한 앞얼굴 · 콧대 · 입술 · 눈두덩)을 만든다. `L` 에 이목구비 높이가 들어 있어 그림과 기하가 같은 자리에 온다.
- `faceMapper(headPt, HC, HR)` + `paintFace(g, M, { eyeY, browY, noseY, mouthY, ... })`: 이목구비를 **미터 단위**로 그린다 — 실제 사람 비율 (눈 폭 ≈ 2.8cm · 눈 사이 = 눈 하나 · 홍채 1.15cm · 눈썹~코 밑 = 코 밑~턱 · 입 폭 ≈ 두 눈동자 사이). 표정은 무표정, `open` 은 살짝 벌린 입.
- `faceLayout(M, L)` 로 기본 배치를 얻는다. 머리 곡면 uv 는 az = (u − 0.5)·2π, el = −π/2 + v·π.

### 3-1. 조형 도구 (`src/sculpt.js`)
기본 도형(원기둥·구·박스)을 이어 붙이면 도형 티가 납니다. 레오처럼 곡면을 직접 만드세요.
- `loft(prof, nu, nv, { a0, a1, mod })`: 높이 v 마다 `{ y, rx, rz | rzF, rzB, n }` 단면(n>2 = 둥근 사각). 팔다리·몸통·갑옷판. `a0~a1` 로 일부 각도만(판갑), `mod` 로 능선·근육 같은 추가 변형.
- `surf(fn, nu, nv)`: 완전한 매개변수 곡면. 얼굴·털 관·수염처럼 자유 형태.
- `strand(pts, r0, r1, { flat, ref, prof })`: 굵기가 줄어드는 관. 머리카락(납작하게)·손가락·금 장식선.
- `loftRing` / `onSurf`: 판 가장자리 금테, 곡면 위 양각 장식선 배치.
- `heightToNormal(canvas)`: 높이 캔버스 → 노멀맵. 색 캔버스와 같은 붓질로 그리면 금 상감이 도드라짐.
- `cached(key, fn)`: 같은 지오메트리는 한 번만 만든다 (같은 캐릭터가 여러 명 나올 때).
- 털·머리카락은 반투명 카드(`alphaTest`) + 결 텍스처가 가장 자연스럽다.

## 4. 포즈
포즈 = `{ hipY, 관절: [x, y, z] }` (라디안). 지정하지 않은 관절은 `base` 값을 따릅니다.

| 방향 | 규칙 |
|---|---|
| 팔·다리 앞으로 들기 | x 음수 |
| 무릎 접기 / 팔꿈치 굽히기 | 무릎 x 양수 / 팔꿈치 x 음수 |
| 상체 숙이기 · 비틀기 | spine/chest x 양수 · y 양수 = 왼쪽 |
| 팔 벌리기 | 왼팔 z 양수, 오른팔 z 음수 |

필수 포즈 이름: `base`(대기) `run` `jump` `guard` `hit` `air`(공중 피격) `down`(누움) `dash` `win` `portrait`(컷인 초상). `crouch`(앉기)는 없으면 기본 자세에 다리·상체만 굽혀 자동으로 만든다. `idle2` 를 주면 4초 이상 가만히 있을 때 그 자세로 바뀐다.

## 5. 기술
이름 규칙과 키: `light1 → light2 → light3` = 좌클릭 연타, `heavy` = 우클릭, `s1` = Shift, `s2` = E, `ult` = Q, `counter` = 극한 회피 직후 좌클릭(선택).

| 필드 | 의미 |
|---|---|
| `dur` | 전체 길이(초) |
| `keys` | `[[시간, 포즈]]` — 앞 키를 이어받아 누적. `'base'`나 포즈 이름도 가능 |
| `hits` | `[{ t0, t1, at: [오른쪽, 위, 앞], r, dmg, kb: [밀림, 띄움], stun, hs, unblock, force, nokill, noScale }]` |
| 판정 방식 | `trail: true` 기술은 **칼날이 실제로 지나간 경로**(weaponPts 선분, 반경 `br` 기본 0.14m)로 판정한다. 칼날이 상대 몸 앞을 지나가도록 키프레임을 잡을 것. `weapon: false` 를 주면 `at`·`r` 구로 판정 |
| `ev` | `[[시간, (f, o, G) => {}]]` — 이펙트·투사체·순간이동 등 |
| `lunge` | `[[t0, t1, 전진속도]]` (이 구간에는 기술 중 이동이 꺼짐) |
| `move` / `noMove` | 기술 중 이동 속도 배율 (기본 0.28) / 이동 금지 |
| `track` | 이 시간까지 상대 쪽으로 회전 |
| `next`, `cancel` | 약공 연계 대상과 입력 허용 시점 |
| `cd` | `'heavy'`/`'s1'`/`'s2'` 쿨타임 슬롯 (초는 `skills[슬롯].cd`) |
| `onHit(f, att, h, dir)` | 이 기술 도중 맞았을 때 호출. `{ dmgK, armor }` 를 돌려주면 피해 배율·경직 무시 (예: 레오 반격 태세) |
| `ikOff` | 레오 전용: 왼손 IK 끄기 (한 손 기술) |
| `trail` | 무기 궤적 표시 |
| `tele` | `[시간, 'yellow' \| 'red']` 공격 예고 빛 (주로 적 기술. 빨강이면 hits 에 `unblock: true`) |
| hits 의 `daze` | 그로기 누적량 (기본: 피해 × 0.55) |
| `tick(f, o, G, t, dt)` | 매 프레임 실행 |
| `end(f, o, G)` | 종료·중단 시 정리 |
| `ult: true` + `cam` | 궁극기. 컷인 뒤 `cam` 키프레임으로 카메라 연출: `[[t, { ref: 'self'|'target', p: [오른쪽,위,앞], l: [...], fov }]]` |

적중하면 강공·스킬로 캔슬할 수 있습니다(시스템 공통).

- hits 의 `weapon: false` = 무기가 아닌 몸(발차기·박치기)으로 치는 공격: `at`·`r` 구로 판정.
- 정의 객체 `resource(f) → { v: 0..1, label, color, full }` 를 주면 HP 아래에 고유 게이지가 표시된다 (예: 아자젤 열기).
- 버프 배율: `f.dmgMul`(주는 피해) · `f.defMul`(받는 피해) · `f.spdMul`(이동 속도) · `f.cdMul`(쿨타임 회복 속도). 아자젤 각성 참고.

**낙하 공격(공중 좌클릭)** 은 공통 시스템입니다. `src/plunge.js` 의 `makePlunge` 에 자세 3개만 넘겨 기술 목록에 펼치세요:
```js
const moves = {
  ...makePlunge({ up: '치켜든 자세', fall: { ...떨어지며 무기 끝이 아래 }, land: { ...내려찍은 직후 }, color: 0xffc24a, dmg: 72, r: 2.5, fx: (f, o, G, c) => {} }),
  light1: { ... },
};
```
`plunge`(낙하)와 `plungeLand`(착지 충격파) 두 기술이 만들어집니다. 정의하지 않은 캐릭터는 공중 좌클릭이 그대로 `light1` 입니다.

## 6. 기술에서 쓸 수 있는 도구
- 좌표: `f.local([오른쪽, 위, 앞])`, `f.fwd()`, `f.right()`, `f.chest()`, `f.faceOpp()`
- 이펙트: `f.slashFx({ tilt, r, at, flip })`, `G.fx.burst / ring / slash / beam / light / impact / p`
- 화면: `G.shake(a)`, `G.flash(color, a)`, `G.slow(배율, 초)`, `G.setTint(color, a)`, `G.stage.flashSky(a)`
- 판정: `new Projectile(G, {...})` + `G.spawn()`, `areaHit(f, 중심, 반경, hit)`
- 상태 효과: `t.addStatus(kind, 초, k, src)` — 'bleed'·'burn'(초당 피해) · 'slow'(이동 ×k) · 'vuln'(받는 피해 ×k, 1 미만이면 피해 감소) · 'atk'(주는 피해 ×k) · 'haste' · 'regen'. 읽기 `f.stK(kind)`. 라운드마다 초기화할 고유 상태는 `def.onReset(f)`. 확정 치명타는 hit 데이터에 `crit: true`.
- 원거리 기술: `G.spawn()` 에는 `update(dt)` · `done` · `kill()` 을 가진 무엇이든 넣을 수 있다. 아리엘의 `WaterOrb`(유도 · 관통 · 폭발) · `WaterLance` · `BubblePrison`(lock/release 로 가둠) · `Whirlpool`(끌어당김 + 연속 피해) 참고. 기술의 `move`(0~1)로 시전 중 이동 속도를 정한다.
- 궁극기 고정: `o.lock()` / `o.release()`
- 대사: `G.say(f, '"대사"')` (화면 아래 자막)
- 소리: `sfx('swing' | 'heavy' | 'hit' | 'big' | 'zap' | 'shot' | 'boom' | 'charge' | 'dash' ...)`

## 7. 몬스터 · 보스
`src/enemies/index.js` 에 같은 형식으로 정의합니다. 추가 필드:
- `stats.daze`(그로기 최대치) · `stats.armor`(슈퍼아머) · `stats.breakTime`(브레이크 시간) · `scale`(몸 크기 배율) · `boss: true`
- `ai: { range, keep, cdMin, cdMax, chain, pick(f, o, dist) }` — `pick` 이 쓸 기술 이름('light' · 'heavy' · 's1' …)을 돌려준다
- `slow(원본기술, { k, windup, tele, dmg, unblock, ev })` 로 캐릭터 기술을 느리고 예고가 있는 적 기술로 바꿀 수 있다
- 토벌전 구성은 같은 파일의 `WAVES`
