#!/usr/bin/env python3
"""AI 라운드테이블: Claude, ChatGPT, Gemini가 서로 논의하며 사용자의 명령을 해결합니다.

진행 방식
  1) 1라운드: 세 모델이 각자 독립적으로 답변
  2) 2라운드~: 서로의 최신 답변을 보고 비판·보완하여 수정안 제시
     (모두가 [합의] 를 표시하면 조기 종료)
  3) 최종 정리: 진행자 모델이 논의 전체를 종합해 최종 답변 작성

외부 패키지 없이 파이썬 표준 라이브러리만 사용합니다.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request

TIMEOUT = 300
CONSENSUS_TAG = "[합의]"


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
def post_json(url: str, headers: dict, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body[:500]}") from None


# --------------------------------------------------------------------------- #
# 모델 어댑터
# messages: [{"role": "user"|"assistant", "content": str}, ...]
# --------------------------------------------------------------------------- #
class Participant:
    name = ""
    env_key = ""
    env_model = ""
    default_model = ""

    def __init__(self, max_tokens: int):
        self.api_key = os.environ.get(self.env_key, "")
        self.model = os.environ.get(self.env_model, self.default_model)
        self.max_tokens = max_tokens

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def chat(self, system: str, messages: list[dict]) -> str:
        raise NotImplementedError


class Claude(Participant):
    name = "Claude"
    env_key = "ANTHROPIC_API_KEY"
    env_model = "CLAUDE_MODEL"
    default_model = "claude-opus-5-5"

    def chat(self, system, messages):
        data = post_json(
            "https://api.anthropic.com/v1/messages",
            {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
            {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "system": system,
                "messages": messages,
            },
        )
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


class ChatGPT(Participant):
    name = "ChatGPT"
    env_key = "OPENAI_API_KEY"
    env_model = "OPENAI_MODEL"
    default_model = "gpt-5"

    def chat(self, system, messages):
        data = post_json(
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {self.api_key}"},
            {
                "model": self.model,
                "max_completion_tokens": self.max_tokens,
                "messages": [{"role": "system", "content": system}, *messages],
            },
        )
        return data["choices"][0]["message"].get("content") or ""


class Gemini(Participant):
    name = "Gemini"
    env_key = "GEMINI_API_KEY"
    env_model = "GEMINI_MODEL"
    default_model = "gemini-2.5-pro"

    def __init__(self, max_tokens):
        super().__init__(max_tokens)
        if not self.api_key:
            self.api_key = os.environ.get("GOOGLE_API_KEY", "")

    def chat(self, system, messages):
        contents = [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
            for m in messages
        ]
        data = post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
            {"x-goog-api-key": self.api_key},
            {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": contents,
                "generationConfig": {"maxOutputTokens": self.max_tokens},
            },
        )
        cands = data.get("candidates") or []
        if not cands:
            raise RuntimeError(f"빈 응답: {json.dumps(data, ensure_ascii=False)[:300]}")
        parts = cands[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts if not p.get("thought"))


class Mock(Participant):
    """API 키 없이 흐름을 시험해 보는 가짜 참가자 (--mock)."""

    def __init__(self, name, max_tokens):
        self.name = name
        self.model = "mock"
        self.api_key = "mock"
        self.max_tokens = max_tokens

    def chat(self, system, messages):
        last = messages[-1]["content"]
        if "최종 답변" in system:
            return f"(mock 최종 답변 — {self.name} 정리)"
        if "다른 참가자" in last:
            return f"{self.name}: 다른 의견을 검토했고 동의합니다.\n{CONSENSUS_TAG}"
        return f"{self.name}의 첫 답변입니다."


PARTICIPANT_CLASSES = {"claude": Claude, "chatgpt": ChatGPT, "gemini": Gemini}


# --------------------------------------------------------------------------- #
# 프롬프트
# --------------------------------------------------------------------------- #
def system_prompt(me: str, others: list[str]) -> str:
    return (
        f"당신은 '{me}'입니다. {', '.join(others) or '다른 AI'}와(과) 함께 라운드테이블 토론에 참여해 "
        "사용자의 명령을 가장 정확하고 완성도 높게 해결하는 것이 목표입니다.\n"
        "- 첫 라운드에서는 독립적으로 최선의 답을 제시하세요.\n"
        "- 이후 라운드에서는 다른 참가자의 답변에서 틀린 점, 빠진 점, 더 나은 점을 구체적으로 지적하고, "
        "타당한 지적은 받아들여 자신의 답을 개선하세요. 근거 없이 동조하지 마세요.\n"
        f"- 현재 답에 더 이상 수정할 점이 없고 다른 참가자들과 실질적으로 합의했다면 마지막 줄에 {CONSENSUS_TAG} 를 쓰세요.\n"
        "- 사용자의 언어로 답하세요."
    )


SYNTH_SYSTEM = (
    "당신은 AI 라운드테이블의 진행자입니다. 사용자의 명령과 Claude·ChatGPT·Gemini의 토론 기록을 읽고, "
    "합의된 내용과 가장 타당한 주장을 종합해 사용자에게 줄 최종 답변을 작성하세요. "
    "토론 과정 설명은 최소화하고, 의견이 끝까지 갈린 중요한 지점만 짧게 언급하세요. 사용자의 언어로 답하세요."
)


def round_prompt(task: str, round_no: int, me: str, latest: dict[str, str]) -> str:
    others = "\n\n".join(f"### {n}의 답변\n{t}" for n, t in latest.items() if n != me)
    return (
        f"[{round_no}라운드] 다른 참가자들의 최신 답변입니다.\n\n{others}\n\n"
        f"원래 명령: {task}\n\n"
        "다른 참가자 답변을 검토해 (1) 동의/반대하는 점과 이유, (2) 개선된 당신의 최종안 을 제시하세요."
    )


# --------------------------------------------------------------------------- #
# 토론 진행
# --------------------------------------------------------------------------- #
class Roundtable:
    def __init__(self, participants: list[Participant], moderator: Participant,
                 rounds: int, verbose: bool = True):
        self.participants = participants
        self.moderator = moderator
        self.rounds = rounds
        self.verbose = verbose

    def log(self, text: str = ""):
        if self.verbose:
            print(text, flush=True)

    def _ask(self, p: Participant, system: str, history: list[dict]) -> str:
        try:
            return p.chat(system, history).strip()
        except Exception as e:  # noqa: BLE001
            return f"(오류로 응답하지 못함: {e})"

    def run(self, task: str) -> tuple[str, list[dict]]:
        names = [p.name for p in self.participants]
        histories = {p.name: [] for p in self.participants}
        systems = {p.name: system_prompt(p.name, [n for n in names if n != p.name]) for p in self.participants}
        transcript: list[dict] = []
        latest: dict[str, str] = {}

        for r in range(1, self.rounds + 1):
            self.log(f"\n{'=' * 70}\n  {r}라운드\n{'=' * 70}")
            for p in self.participants:
                content = task if r == 1 else round_prompt(task, r, p.name, latest)
                histories[p.name].append({"role": "user", "content": content})

            with concurrent.futures.ThreadPoolExecutor(len(self.participants)) as ex:
                futs = {p.name: ex.submit(self._ask, p, systems[p.name], list(histories[p.name]))
                        for p in self.participants}
                replies = {n: f.result() for n, f in futs.items()}

            for p in self.participants:
                reply = replies[p.name] or "(빈 응답)"
                histories[p.name].append({"role": "assistant", "content": reply})
                latest[p.name] = reply
                transcript.append({"round": r, "speaker": p.name, "model": p.model, "text": reply})
                self.log(f"\n--- {p.name} ({p.model}) ---\n{reply}")

            if r > 1 and len(self.participants) > 1 and all(
                CONSENSUS_TAG in latest[n] for n in names
            ):
                self.log(f"\n>>> 모든 참가자가 합의하여 {r}라운드에서 토론을 마칩니다.")
                break

        record = "\n\n".join(
            f"[{t['round']}라운드] {t['speaker']}:\n{t['text']}" for t in transcript
        )
        self.log(f"\n{'=' * 70}\n  최종 답변 (진행자: {self.moderator.name})\n{'=' * 70}")
        final = self._ask(
            self.moderator,
            SYNTH_SYSTEM,
            [{"role": "user", "content": f"사용자의 명령:\n{task}\n\n토론 기록:\n{record}\n\n최종 답변을 작성하세요."}],
        )
        print(final, flush=True)
        transcript.append({"round": "final", "speaker": self.moderator.name, "model": self.moderator.model, "text": final})
        return final, transcript


def save_transcript(path: str, task: str, transcript: list[dict]):
    lines = [f"# AI 라운드테이블 기록", "", f"- 일시: {dt.datetime.now():%Y-%m-%d %H:%M:%S}", "",
             "## 명령", "", task, ""]
    for t in transcript:
        title = "최종 답변" if t["round"] == "final" else f"{t['round']}라운드"
        lines += [f"## {title} — {t['speaker']} ({t['model']})", "", t["text"], ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def build(args) -> tuple[list[Participant], Participant]:
    wanted = [w.strip().lower() for w in args.models.split(",") if w.strip()]
    for w in wanted:
        if w not in PARTICIPANT_CLASSES:
            sys.exit(f"알 수 없는 모델: {w} (가능: {', '.join(PARTICIPANT_CLASSES)})")

    if args.mock:
        ps = [Mock(PARTICIPANT_CLASSES[w].name, args.max_tokens) for w in wanted]
    else:
        ps = []
        for w in wanted:
            p = PARTICIPANT_CLASSES[w](args.max_tokens)
            if p.available:
                ps.append(p)
            else:
                print(f"[경고] {p.name}: {p.env_key} 가 설정되지 않아 제외합니다.", file=sys.stderr)
    if not ps:
        sys.exit("사용 가능한 모델이 없습니다. API 키 환경변수를 설정하세요 (README 참고).")

    mod_name = PARTICIPANT_CLASSES.get(args.moderator.lower(), Claude).name
    moderator = next((p for p in ps if p.name == mod_name), ps[0])
    return ps, moderator


def main():
    ap = argparse.ArgumentParser(description="Claude·ChatGPT·Gemini가 서로 논의하며 명령을 해결합니다.")
    ap.add_argument("task", nargs="*", help="명령 (생략하면 대화형 모드)")
    ap.add_argument("-r", "--rounds", type=int, default=3, help="최대 토론 라운드 수 (기본 3)")
    ap.add_argument("-m", "--models", default="claude,chatgpt,gemini", help="참가 모델 (쉼표 구분)")
    ap.add_argument("--moderator", default="claude", help="최종 답변을 정리할 모델 (기본 claude)")
    ap.add_argument("--max-tokens", type=int, default=4096, help="응답당 최대 토큰")
    ap.add_argument("-o", "--output", help="토론 기록을 저장할 마크다운 파일 경로")
    ap.add_argument("-q", "--quiet", action="store_true", help="토론 과정은 숨기고 최종 답변만 출력")
    ap.add_argument("--mock", action="store_true", help="API 호출 없이 가짜 응답으로 흐름 테스트")
    args = ap.parse_args()

    participants, moderator = build(args)
    table = Roundtable(participants, moderator, max(1, args.rounds), verbose=not args.quiet)
    print(f"참가자: {', '.join(f'{p.name}({p.model})' for p in participants)} | 진행자: {moderator.name}")

    def handle(task: str, idx: int | None = None):
        _, transcript = table.run(task)
        if args.output:
            path = args.output
            if idx is not None:
                base, ext = os.path.splitext(path)
                path = f"{base}-{idx}{ext or '.md'}"
            save_transcript(path, task, transcript)
            print(f"\n[기록 저장: {path}]")

    if args.task:
        handle(" ".join(args.task))
        return

    print("명령을 입력하세요. (종료: exit / quit / Ctrl+D)")
    n = 0
    while True:
        try:
            task = input("\n명령> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if task.lower() in {"exit", "quit", "종료"}:
            break
        if task:
            n += 1
            handle(task, n)


if __name__ == "__main__":
    main()
