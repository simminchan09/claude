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
- 기본으로 `127.0.0.1`(내 컴퓨터)에서만 접속됩니다.

## 📲 컴퓨터 없이 갤럭시 탭만으로 사용 (Termux)
갤럭시 탭 안에서 서버를 실행하고, 같은 탭의 Chrome으로 `localhost`에 접속합니다.
탭에는 Claude/Codex CLI가 없으므로 **API 키**로 AI를 호출합니다 (각 사의 API 사용료가 별도로 듭니다).

1. **Termux 설치**: [F-Droid](https://f-droid.org/packages/com.termux/) 또는 [GitHub](https://github.com/termux/termux-app/releases)에서 받으세요.
   (Play 스토어 버전은 오래되어 동작하지 않을 수 있습니다)
2. Termux를 열고 아래 한 줄을 입력 (설치는 처음 한 번만)
   ```bash
   curl -fsSL https://raw.githubusercontent.com/simminchan09/claude/ccr-cf22c3aa-pwnjua/ai-debate/termux_setup.sh | bash
   ```
3. 실행
   ```bash
   ai-debate
   ```
   Chrome이 자동으로 `http://localhost:8000`을 엽니다. (안 열리면 직접 입력)
4. 처음 한 번 화면의 **⚙ 설정**에 API 키 입력 → 저장
   - Claude: https://console.anthropic.com/settings/keys
   - ChatGPT: https://platform.openai.com/api-keys
   - Gemini: https://aistudio.google.com/apikey
   - 키가 있는 AI만 참가합니다. (Gemini 하나만 넣어도 동작)
5. (선택) Chrome ⋮ → **홈 화면에 추가** — 다음부터는 Termux에서 `ai-debate` 실행 후 홈 화면 아이콘으로 열면 됩니다.

- 종료: Termux에서 `Ctrl+C` (Termux 키보드 위 CTRL 버튼 + C)
- Termux가 백그라운드에서 꺼지면: 설정 → 애플리케이션 → Termux → 배터리 → **제한 없음**
- 업데이트: Termux에서 2번 명령을 다시 실행

## 📱 갤럭시 탭(태블릿·휴대폰)에서 사용
AI CLI는 컴퓨터에서 실행되므로, **컴퓨터에서 서버를 켜고 갤럭시 탭은 브라우저로 접속**합니다.

1. 컴퓨터에서 실행
   ```bash
   python server.py --pad
   ```
   Windows는 `start_pad.bat`, Mac은 `start_pad.command`를 더블클릭해도 됩니다.
2. 터미널에 나온 주소를 갤럭시 탭의 **Chrome** 또는 **삼성 인터넷** 주소창에 그대로 입력 (컴퓨터와 **같은 Wi-Fi**여야 함)
   ```
   📱 태블릿/폰:  http://192.168.0.12:8000/?key=AbC123xY
   ```
3. (선택) 홈 화면 앱으로 설치
   - Chrome: 오른쪽 위 ⋮ → **홈 화면에 추가**
   - 삼성 인터넷: 아래 ≡ 메뉴 → **현재 페이지 추가** → **홈 화면**

- `key`는 같은 Wi-Fi의 다른 사람이 마음대로 쓰지 못하게 하는 접속 키입니다. 실행할 때마다 새로 만들어지며, 고정하려면 `--key 원하는키` (홈 화면 앱을 계속 쓰려면 고정 권장).
- 안 열리면: 컴퓨터 방화벽에서 Python 접속 허용 (Windows는 처음 실행 시 뜨는 창에서 **개인 네트워크 허용**), 공용/게스트 Wi-Fi는 기기 간 접속이 막혀 있을 수 있습니다.
- 아이패드·안드로이드 폰도 같은 방법으로 사용할 수 있습니다.

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
| `-b, --backend` | `auto` (`DEBATE_BACKEND`) | `auto`(CLI 우선, 없으면 API) / `cli` / `api` |
| `--timeout` | 600 | CLI 응답 대기 시간(초) |
| `--claude-model` | CLI: 각 CLI 기본값 / API: `claude-opus-5-5` (`CLAUDE_MODEL`) | Claude 모델 |
| `--openai-model` | CLI: 각 CLI 기본값 / API: `gpt-5` (`OPENAI_MODEL`) | ChatGPT 모델 |
| `--gemini-model` | CLI: 각 CLI 기본값 / API: `gemini-2.5-pro` (`GEMINI_MODEL`) | Gemini 모델 |
| `--max-tokens` | 2048 | API 모드 응답당 최대 토큰 |
| `--save DIR` | – | 토론 기록 저장 폴더 |
| `--mock` | – | 모의 응답 모드 |
