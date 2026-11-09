# AI 라운드테이블

명령을 입력하면 **Claude · ChatGPT · Gemini** 가 서로의 답변을 보고 비판·보완하며 논의한 뒤,
진행자 모델이 최종 답변을 정리해 주는 프로그램입니다. 파이썬 표준 라이브러리만 사용합니다 (Python 3.9+).

## 진행 방식

1. **1라운드** – 세 모델이 동시에 각자 독립적으로 답변
2. **2라운드 이후** – 각 모델이 다른 모델들의 최신 답변을 검토해 동의/반대 이유를 밝히고 개선안 제시
   (모든 모델이 `[합의]` 를 표시하면 조기 종료, 아니면 `--rounds` 까지 진행)
3. **최종 답변** – 진행자(기본: Claude)가 토론 전체를 종합해 최종 답변 작성

## 설정

### Claude — API 키 없이 구독 계정으로 (권장)

Claude Code를 설치하고 구독(Pro/Max) 계정으로 한 번 로그인해 두면, `ANTHROPIC_API_KEY` 가 없을 때
프로그램이 자동으로 `claude` 명령을 통해 Claude를 부릅니다. 사용량은 구독 한도에서 차감됩니다.

```bash
npm install -g @anthropic-ai/claude-code
```
```bash
claude
```
(처음 실행 시 나오는 안내에 따라 로그인한 뒤 `/exit` 로 나오면 됩니다.)

### API 키

나머지는 API 키를 환경변수로 설정합니다. 키가 없는 모델은 자동으로 제외됩니다.

```bash
export ANTHROPIC_API_KEY=...   # Claude (선택: 설정하면 구독 대신 API 사용)
export OPENAI_API_KEY=...      # ChatGPT
export GEMINI_API_KEY=...      # Gemini (GOOGLE_API_KEY 도 인식)
```

사용 모델은 환경변수로 바꿀 수 있습니다 (괄호는 기본값):
`CLAUDE_MODEL` (API: claude-opus-5-5, 구독: Claude Code 기본 모델), `OPENAI_MODEL` (gpt-5), `GEMINI_MODEL` (gemini-2.5-pro)

## 사용법

한 번 실행:

```bash
python3 roundtable.py "서울에서 부산까지 가장 저렴하게 가는 방법을 정리해줘"
```

대화형 모드 (명령을 계속 입력, `exit` 로 종료):

```bash
python3 roundtable.py
```

옵션:

| 옵션 | 설명 |
|---|---|
| `-r, --rounds N` | 최대 토론 라운드 수 (기본 3) |
| `-m, --models` | 참가 모델, 예: `claude,gemini` |
| `--moderator` | 최종 답변을 정리할 모델 (기본 `claude`) |
| `--claude auto/api/cli` | Claude 호출 방식 (기본 auto: API 키가 있으면 API, 없으면 구독 `claude` 명령) |
| `--max-tokens N` | 응답당 최대 토큰 (기본 4096) |
| `-o, --output FILE` | 토론 기록을 마크다운으로 저장 |
| `-q, --quiet` | 토론 과정 없이 최종 답변만 출력 |
| `--mock` | API 호출 없이 가짜 응답으로 흐름 테스트 |

예: 토론 기록을 저장하며 5라운드까지

```bash
python3 roundtable.py -r 5 -o debate.md "이 문장을 자연스러운 영어로 번역해줘: ..."
```
