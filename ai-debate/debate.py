#!/usr/bin/env python3
"""AI 토론 CLI: Claude, ChatGPT, Gemini가 토론하여 명령에 대한 답을 찾습니다.

사용법:
    python debate.py "질문 또는 명령"          # 한 번 실행
    python debate.py                           # 대화형 모드
    python debate.py -r 4 "질문"               # 최대 토론 라운드 4회
    python debate.py --backend api "질문"      # CLI 대신 API 키로 호출
    python debate.py --mock "질문"             # 실제 호출 없이 동작 테스트

기본(--backend cli)은 설치·로그인된 CLI를 사용합니다 (API 키 불필요):
    Claude  -> claude  (Claude Code)
    ChatGPT -> codex   (OpenAI Codex CLI)
    Gemini  -> gemini  (Gemini CLI)
"""

from __future__ import annotations

import argparse
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# 출력 도우미
# ---------------------------------------------------------------------------

USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def color(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text


def header(text: str) -> None:
    line = "═" * 70
    print(color(f"\n{line}\n {text}\n{line}", "1;37"))


def load_dotenv(path: Path) -> None:
    """간단한 .env 로더 (외부 의존성 없음). 이미 설정된 환경변수는 덮어쓰지 않습니다."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


# ---------------------------------------------------------------------------
# 참가자 (각 AI)
# ---------------------------------------------------------------------------


@dataclass
class Participant:
    name: str
    model: str
    color_code: str
    max_tokens: int = 2048
    _client: object = field(default=None, repr=False)

    def ask(self, system: str, prompt: str) -> str:
        raise NotImplementedError


class ClaudeParticipant(Participant):
    def ask(self, system: str, prompt: str) -> str:
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic()
        resp = self._client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()


class ChatGPTParticipant(Participant):
    def ask(self, system: str, prompt: str) -> str:
        if self._client is None:
            import openai

            self._client = openai.OpenAI()
        resp = self._client.responses.create(
            model=self.model,
            instructions=system,
            input=prompt,
            max_output_tokens=self.max_tokens,
        )
        return (resp.output_text or "").strip()


class GeminiParticipant(Participant):
    def ask(self, system: str, prompt: str) -> str:
        from google.genai import types

        if self._client is None:
            from google import genai

            key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            self._client = genai.Client(api_key=key)
        resp = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=self.max_tokens,
            ),
        )
        return (resp.text or "").strip()


# ---- CLI 백엔드 (구독 로그인된 CLI를 subprocess로 호출) ----------------------


class CLIParticipant(Participant):
    timeout: int = 600
    env_cmd: str = ""      # 실행 파일 경로를 덮어쓰는 환경변수 이름
    default_bin: str = ""

    def binary(self) -> str:
        return os.environ.get(self.env_cmd) or self.default_bin

    def run(self, cmd: list[str], stdin: str, cwd: str) -> str:
        proc = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=self.timeout,
            cwd=cwd,
        )
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout).strip()[-800:]
            raise RuntimeError(f"{shlex.join(cmd[:2])} 종료 코드 {proc.returncode}: {err}")
        return proc.stdout

    def ask(self, system: str, prompt: str) -> str:
        with tempfile.TemporaryDirectory(prefix="ai-debate-") as cwd:
            return self.ask_cli(system, prompt, cwd).strip()

    def ask_cli(self, system: str, prompt: str, cwd: str) -> str:
        raise NotImplementedError


class ClaudeCLI(CLIParticipant):
    env_cmd, default_bin = "CLAUDE_CMD", "claude"

    def ask_cli(self, system: str, prompt: str, cwd: str) -> str:
        cmd = [self.binary(), "-p", "--output-format", "text", "--system-prompt", system]
        if self.model:
            cmd += ["--model", self.model]
        return self.run(cmd, prompt, cwd)


class CodexCLI(CLIParticipant):
    env_cmd, default_bin = "CODEX_CMD", "codex"

    def ask_cli(self, system: str, prompt: str, cwd: str) -> str:
        out = Path(cwd) / "last_message.txt"
        cmd = [
            self.binary(), "exec",
            "--skip-git-repo-check",
            "--sandbox", "read-only",
            "--color", "never",
            "-o", str(out),
        ]
        if self.model:
            cmd += ["-m", self.model]
        cmd.append("-")  # 프롬프트를 표준 입력으로 전달
        stdout = self.run(cmd, f"{system}\n\n{prompt}", cwd)
        return out.read_text(encoding="utf-8") if out.is_file() else stdout


class GeminiCLI(CLIParticipant):
    env_cmd, default_bin = "GEMINI_CMD", "gemini"

    def ask_cli(self, system: str, prompt: str, cwd: str) -> str:
        cmd = [
            self.binary(),
            "--output-format", "text",
            "--approval-mode", "plan",
            "-p", "위 내용의 지시에 따라 답변하세요.",  # 표준 입력 뒤에 덧붙여짐
        ]
        if self.model:
            cmd += ["-m", self.model]
        return self.run(cmd, f"{system}\n\n{prompt}", cwd)


class MockParticipant(Participant):
    """API 키 없이 흐름을 확인하기 위한 가짜 참가자."""

    def ask(self, system: str, prompt: str) -> str:
        time.sleep(0.2)
        if "최종 답변" in system:
            return f"[{self.name} 모의 최종 답변] 세 AI의 의견을 종합한 결론입니다."
        if "라운드 1" in prompt:
            return f"[{self.name} 모의 답변] 제 초기 의견입니다.\n\n합의: 아니오"
        return f"[{self.name} 모의 답변] 다른 의견을 검토해 수정했습니다.\n\n합의: 예"


API_DEFAULT_MODELS = {"Claude": "claude-opus-5-5", "ChatGPT": "gpt-5", "Gemini": "gemini-2.5-pro"}


def build_participants(args: argparse.Namespace) -> list[Participant]:
    # (이름, API 클래스, CLI 클래스, 모델, 색상, API 키 환경변수)
    specs = [
        ("Claude", ClaudeParticipant, ClaudeCLI, args.claude_model, "1;33", ["ANTHROPIC_API_KEY"]),
        ("ChatGPT", ChatGPTParticipant, CodexCLI, args.openai_model, "1;32", ["OPENAI_API_KEY"]),
        ("Gemini", GeminiParticipant, GeminiCLI, args.gemini_model, "1;34", ["GEMINI_API_KEY", "GOOGLE_API_KEY"]),
    ]
    chosen = {s.strip().lower() for s in args.only.split(",")} if args.only else None
    result: list[Participant] = []
    for name, api_cls, cli_cls, model, ccode, keys in specs:
        if chosen and name.lower() not in chosen:
            continue
        if args.mock:
            result.append(MockParticipant(name, "mock", ccode, args.max_tokens))
        elif args.backend == "cli":
            p = cli_cls(name, model or "", ccode, args.max_tokens)
            p.timeout = args.timeout
            if shutil.which(p.binary()):
                result.append(p)
            else:
                print(color(f"⚠ {name}: '{p.binary()}' 명령을 찾을 수 없어 토론에서 제외합니다.", "33"))
        elif any(os.environ.get(k) for k in keys):
            result.append(api_cls(name, model or API_DEFAULT_MODELS[name], ccode, args.max_tokens))
        else:
            print(color(f"⚠ {name}: {' 또는 '.join(keys)} 가 없어 토론에서 제외합니다.", "33"))
    return result


# ---------------------------------------------------------------------------
# 토론 진행
# ---------------------------------------------------------------------------

DEBATE_SYSTEM = """당신은 {name}입니다. 다른 AI({others})와 함께 사용자의 명령에 대한 최선의 답을 찾기 위해 토론하고 있습니다.
규칙:
- 정확하고 근거 있는 내용만 말하세요. 모르는 것은 모른다고 하세요.
- 다른 참가자의 의견에서 옳은 점은 받아들이고, 틀린 점은 구체적인 이유와 함께 지적하세요.
- 고집하지 말고, 설득되면 입장을 바꾸세요.
- 답변은 사용자의 언어로 작성하세요.
- 답변의 마지막 줄에는 반드시 "합의: 예" 또는 "합의: 아니오"를 쓰세요.
  ("예"는 현재 다른 참가자들과 핵심 결론에 동의한다는 뜻입니다.)"""

ROUND1_PROMPT = """[라운드 1]
사용자의 명령:
\"\"\"{task}\"\"\"

다른 참가자의 의견을 보기 전, 당신의 독립적인 답변을 작성하세요."""

ROUNDN_PROMPT = """[라운드 {round}]
사용자의 명령:
\"\"\"{task}\"\"\"

당신의 직전 답변:
{mine}

다른 참가자들의 직전 답변:
{others}

다른 참가자들의 답변을 검토하세요. 동의하는 점, 반박할 점을 밝히고 개선된 답변을 작성하세요."""

FINAL_SYSTEM = """당신은 AI 토론의 진행자입니다. 참가자들의 토론 내용을 바탕으로 사용자에게 줄 최종 답변을 작성하세요.
- 토론에서 검증된 정확한 내용만 포함하세요.
- 의견이 끝까지 갈린 부분이 있으면 각 입장을 간단히 밝히세요.
- 토론 과정 설명은 최소화하고, 사용자의 명령에 대한 답 자체에 집중하세요.
- 사용자의 언어로 작성하세요."""

FINAL_PROMPT = """사용자의 명령:
\"\"\"{task}\"\"\"

토론 기록:
{transcript}

위 토론을 종합하여 최종 답변을 작성하세요."""

AGREE_RE = re.compile(r"합의\s*[:：]\s*(예|아니오|yes|no)", re.IGNORECASE)


def agreed(text: str) -> bool:
    matches = AGREE_RE.findall(text)
    return bool(matches) and matches[-1].lower() in ("예", "yes")


def strip_agree(text: str) -> str:
    return AGREE_RE.sub("", text).rstrip()


def safe_ask(p: Participant, system: str, prompt: str, retries: int = 2) -> str:
    for attempt in range(retries + 1):
        try:
            return p.ask(system, prompt) or "(빈 응답)"
        except Exception as e:  # noqa: BLE001
            if attempt == retries:
                return f"(오류: {type(e).__name__}: {e})"
            time.sleep(2 ** attempt)
    return "(오류)"


def print_answer(p: Participant, text: str) -> None:
    print(color(f"\n▶ {p.name} ({p.model or '기본 모델'})", p.color_code))
    print(text)


def run_debate(task: str, participants: list[Participant], args: argparse.Namespace) -> str:
    names = [p.name for p in participants]
    systems = {
        p.name: DEBATE_SYSTEM.format(name=p.name, others=", ".join(n for n in names if n != p.name) or "없음")
        for p in participants
    }
    latest: dict[str, str] = {}
    transcript: list[str] = []

    with ThreadPoolExecutor(max_workers=len(participants)) as pool:
        for rnd in range(1, args.rounds + 1):
            header(f"라운드 {rnd} / 최대 {args.rounds}")
            prompts = {}
            for p in participants:
                if rnd == 1:
                    prompts[p.name] = ROUND1_PROMPT.format(task=task)
                else:
                    others = "\n\n".join(
                        f"--- {n} ---\n{strip_agree(latest[n])}" for n in names if n != p.name
                    )
                    prompts[p.name] = ROUNDN_PROMPT.format(
                        round=rnd, task=task, mine=strip_agree(latest[p.name]), others=others
                    )
            futures = {p.name: pool.submit(safe_ask, p, systems[p.name], prompts[p.name]) for p in participants}
            for p in participants:
                answer = futures[p.name].result()
                latest[p.name] = answer
                transcript.append(f"[라운드 {rnd}] {p.name}:\n{answer}")
                print_answer(p, answer)

            if len(participants) > 1 and rnd > 1 and all(agreed(latest[n]) for n in names):
                print(color("\n✔ 모든 참가자가 합의했습니다. 토론을 종료합니다.", "1;32"))
                break
            if len(participants) == 1:
                break

    # 최종 답변 작성
    moderator = next((p for p in participants if p.name.lower() == args.moderator.lower()), participants[0])
    header(f"최종 답변 (진행자: {moderator.name})")
    final = safe_ask(
        moderator,
        FINAL_SYSTEM,
        FINAL_PROMPT.format(task=task, transcript="\n\n".join(transcript)),
    )
    print(final)

    if args.save:
        save_dir = Path(args.save)
        save_dir.mkdir(parents=True, exist_ok=True)
        path = save_dir / f"debate_{datetime.now():%Y%m%d_%H%M%S}.md"
        path.write_text(
            f"# 명령\n\n{task}\n\n# 토론 기록\n\n" + "\n\n".join(transcript) + f"\n\n# 최종 답변\n\n{final}\n",
            encoding="utf-8",
        )
        print(color(f"\n💾 저장됨: {path}", "36"))
    return final


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Claude, ChatGPT, Gemini가 토론하여 답을 찾는 CLI")
    ap.add_argument("task", nargs="*", help="명령/질문 (생략하면 대화형 모드)")
    ap.add_argument("-r", "--rounds", type=int, default=3, help="최대 토론 라운드 수 (기본 3)")
    ap.add_argument("-m", "--moderator", default="Claude", help="최종 답변을 정리할 AI (Claude/ChatGPT/Gemini)")
    ap.add_argument("--only", help="참가할 AI만 지정 (예: claude,gemini)")
    ap.add_argument("-b", "--backend", choices=["cli", "api"], default=os.environ.get("DEBATE_BACKEND", "cli"),
                    help="cli: claude/codex/gemini CLI 사용 (기본), api: API 키 사용")
    ap.add_argument("--timeout", type=int, default=600, help="CLI 응답 대기 시간(초, 기본 600)")
    ap.add_argument("--claude-model", default=os.environ.get("CLAUDE_MODEL"))
    ap.add_argument("--openai-model", default=os.environ.get("OPENAI_MODEL"))
    ap.add_argument("--gemini-model", default=os.environ.get("GEMINI_MODEL"))
    ap.add_argument("--max-tokens", type=int, default=2048, help="API 모드 응답당 최대 토큰 (기본 2048)")
    ap.add_argument("--save", metavar="DIR", help="토론 기록을 Markdown으로 저장할 폴더")
    ap.add_argument("--mock", action="store_true", help="API 호출 없이 모의 응답으로 실행")
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv(Path.cwd() / ".env")
    args = parse_args(argv)
    if args.rounds < 1:
        print("라운드 수는 1 이상이어야 합니다.", file=sys.stderr)
        return 2

    participants = build_participants(args)
    if not participants:
        hint = ("claude / codex / gemini CLI를 설치하고 로그인하세요." if args.backend == "cli"
                else ".env 파일에 API 키를 설정하세요.")
        print(color(f"사용 가능한 AI가 없습니다. {hint}", "1;31"), file=sys.stderr)
        return 1
    print(color("참가자: " + ", ".join(f"{p.name}({p.model or '기본 모델'})" for p in participants), "1;36"))

    if args.task:
        run_debate(" ".join(args.task), participants, args)
        return 0

    print(color("대화형 모드입니다. 명령을 입력하세요. (종료: exit, quit, Ctrl+D)", "36"))
    while True:
        try:
            task = input(color("\n명령> ", "1;35")).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if task.lower() in ("exit", "quit", "종료"):
            break
        if task:
            try:
                run_debate(task, participants, args)
            except KeyboardInterrupt:
                print(color("\n중단됨.", "31"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
