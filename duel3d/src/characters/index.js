// 캐릭터 목록. 새 캐릭터는 파일을 만든 뒤 여기에 추가하면 선택 화면에 나타난다.
import leo from './leo.js';
import azazel from './azazel.js';
import aquarist from './aquarist.js';
import sui from './sui.js';
import trainer from './trainer.js';

export const ROSTER = [leo, azazel, aquarist, sui, trainer];
// 선택 화면에 표시할 빈 슬롯 수 (구현 예정 캐릭터 자리)
export const EMPTY_SLOTS = 0;
