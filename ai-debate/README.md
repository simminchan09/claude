# AI 토론 CLI (Claude × ChatGPT × Gemini)

CLI에서 명령을 내리면 **Claude, ChatGPT, Gemini** 세 AI가 토론하여 답을 찾습니다.

## 동작 방식
1. **라운드 1** – 세 AI가 서로의 답을 보지 않고 독립적으로 답변 (병렬 호출)
2. **라운드 2~N** – 각 AI가 다른 AI들의 직전 답변을 읽고 동의/반박하며 답변을 수정
3. 각 답변 끝의 `합의: 예/아니오`로 **모두 합의하면 조기 종료**, 아니면 최대 라운드까지 진행
4. **진행자 AI**(기본: Claude)가 토론 전체를 종합해 **최종 답변** 출력

## 설치
```bash
cd ai-debate
pip install -r requirements.txt
cp .env.example .env   # 그리고 API 키 입력
```
| 환경변수 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | ChatGPT |
| `GEMINI_API_KEY` (또는 `GOOGLE_API_KEY`) | Gemini |

키가 없는 AI는 자동으로 토론에서 제외됩니다.

## 사용법
```bash
python debate.py "파이썬에서 리스트와 튜플 중 무엇을 써야 할까?"   # 한 번 실행
python debate.py                                                    # 대화형 모드 (exit로 종료)
python debate.py -r 5 "질문"            # 최대 5라운드
python debate.py -m gemini "질문"       # Gemini가 최종 답변 정리
python debate.py --only claude,chatgpt "질문"   # 일부 AI만 참가
python debate.py --save logs "질문"     # 토론 기록을 logs/에 Markdown으로 저장
python debate.py --mock "질문"          # API 키 없이 흐름 테스트
```

## 옵션
| 옵션 | 기본값 | 설명 |
|---|---|---|
| `-r, --rounds` | 3 | 최대 토론 라운드 |
| `-m, --moderator` | Claude | 최종 답변 정리 AI |
| `--only` | 전체 | 참가 AI 지정 (쉼표 구분) |
| `--claude-model` | `claude-opus-5-5` (`CLAUDE_MODEL`) | Claude 모델 |
| `--openai-model` | `gpt-5` (`OPENAI_MODEL`) | ChatGPT 모델 |
| `--gemini-model` | `gemini-2.5-pro` (`GEMINI_MODEL`) | Gemini 모델 |
| `--max-tokens` | 2048 | 응답당 최대 토큰 |
| `--save DIR` | – | 토론 기록 저장 폴더 |
| `--mock` | – | 모의 응답 모드 |
