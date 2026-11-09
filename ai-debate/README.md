# AI 토론 CLI (Claude × ChatGPT × Gemini)

명령을 내리면 **Claude, ChatGPT, Gemini** 세 AI가 토론하여 답을 찾습니다.
**localhost 웹사이트**와 **터미널 CLI** 두 가지로 사용할 수 있습니다.

## 🌐 웹사이트로 실행 (localhost)
```bash
cd ai-debate
python server.py            # → http://localhost:8000 접속
python server.py --port 9000
python server.py --mock     # 실제 호출 없이 화면 테스트
```
- 외부 패키지 설치 불필요 (Python 표준 라이브러리만 사용)
- 라운드별로 세 AI의 답변이 카드로 표시되고, 먼저 끝난 AI부터 실시간으로 나타납니다
- 참가 AI 선택, 최대 라운드, 최종 정리 AI를 화면에서 선택 / 진행 중 `중지` 가능
- `--backend api`, `--save logs`, `--claude-model` 등 아래 CLI 옵션을 그대로 사용할 수 있습니다
- 기본으로 `127.0.0.1`(내 컴퓨터)에서만 접속됩니다. 같은 네트워크의 다른 기기에서 접속하려면 `--host 0.0.0.0`

## 동작 방식
1. **라운드 1** – 세 AI가 서로의 답을 보지 않고 독립적으로 답변 (병렬 호출)
2. **라운드 2~N** – 각 AI가 다른 AI들의 직전 답변을 읽고 동의/반박하며 답변을 수정
3. 각 답변 끝의 `합의: 예/아니오`로 **모두 합의하면 조기 종료**, 아니면 최대 라운드까지 진행
4. **진행자 AI**(기본: Claude)가 토론 전체를 종합해 **최종 답변** 출력

## 설치 (기본: CLI 모드 — API 키 불필요)
각 AI의 공식 CLI를 설치하고 한 번씩 로그인하면 구독 계정으로 동작합니다.
```bash
npm install -g @anthropic-ai/claude-code   # claude  → Claude
npm install -g @openai/codex               # codex   → ChatGPT
npm install -g @google/gemini-cli          # gemini  → Gemini

claude    # 로그인
codex     # 로그인 (ChatGPT 계정으로 Sign in)
gemini    # 로그인 (Google 계정)
```
설치되지 않은 CLI의 AI는 자동으로 토론에서 제외됩니다.
실행 파일 경로가 다르면 `CLAUDE_CMD`, `CODEX_CMD`, `GEMINI_CMD` 환경변수로 지정하세요.

내부적으로 다음처럼 호출합니다 (도구 실행은 읽기 전용/계획 모드로 제한):
| AI | 명령 |
|---|---|
| Claude | `claude -p --output-format text --system-prompt ...` |
| ChatGPT | `codex exec --skip-git-repo-check --sandbox read-only -o <파일> -` |
| Gemini | `gemini --output-format text --approval-mode plan -p ...` |

### API 모드 (선택)
`--backend api` 사용 시 API 키로 호출합니다.
```bash
pip install -r requirements.txt
cp .env.example .env   # 그리고 API 키 입력
```
| 환경변수 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | ChatGPT |
| `GEMINI_API_KEY` (또는 `GOOGLE_API_KEY`) | Gemini |

## 💻 터미널 CLI 사용법
```bash
python debate.py "파이썬에서 리스트와 튜플 중 무엇을 써야 할까?"   # 한 번 실행
python debate.py                                                    # 대화형 모드 (exit로 종료)
python debate.py -r 5 "질문"            # 최대 5라운드
python debate.py -m gemini "질문"       # Gemini가 최종 답변 정리
python debate.py --only claude,chatgpt "질문"   # 일부 AI만 참가
python debate.py --save logs "질문"     # 토론 기록을 logs/에 Markdown으로 저장
python debate.py --backend api "질문"  # CLI 대신 API 키 사용
python debate.py --mock "질문"          # 실제 호출 없이 흐름 테스트
```

## 옵션
| 옵션 | 기본값 | 설명 |
|---|---|---|
| `-r, --rounds` | 3 | 최대 토론 라운드 |
| `-m, --moderator` | Claude | 최종 답변 정리 AI |
| `--only` | 전체 | 참가 AI 지정 (쉼표 구분) |
| `-b, --backend` | `cli` (`DEBATE_BACKEND`) | `cli` 또는 `api` |
| `--timeout` | 600 | CLI 응답 대기 시간(초) |
| `--claude-model` | CLI: 각 CLI 기본값 / API: `claude-opus-5-5` (`CLAUDE_MODEL`) | Claude 모델 |
| `--openai-model` | CLI: 각 CLI 기본값 / API: `gpt-5` (`OPENAI_MODEL`) | ChatGPT 모델 |
| `--gemini-model` | CLI: 각 CLI 기본값 / API: `gemini-2.5-pro` (`GEMINI_MODEL`) | Gemini 모델 |
| `--max-tokens` | 2048 | API 모드 응답당 최대 토큰 |
| `--save DIR` | – | 토론 기록 저장 폴더 |
| `--mock` | – | 모의 응답 모드 |
