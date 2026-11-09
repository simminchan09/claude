#!/usr/bin/env python3
"""AI 토론 웹 서버 (localhost).

    python server.py                 # http://127.0.0.1:8000
    python server.py --port 9000
    python server.py --mock          # 실제 호출 없이 테스트
    python server.py --backend api   # API 키 사용

debate.py 의 옵션(--backend, --timeout, --claude-model 등)을 그대로 사용할 수 있습니다.
외부 패키지 없이 Python 표준 라이브러리만 사용합니다.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import debate

STATIC = Path(__file__).resolve().parent / "static"
CONTENT_TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml"}

ARGS: argparse.Namespace
PARTICIPANTS: list[debate.Participant] = []
LOCK = threading.Lock()  # 한 번에 하나의 토론만 실행 (CLI 세션 충돌 방지)


class Handler(BaseHTTPRequestHandler):
    server_version = "AIDebate/1.0"

    def log_message(self, fmt, *a):  # 간결한 로그
        sys.stderr.write(f"[{self.log_date_time_string()}] {fmt % a}\n")

    # ---- 공통 ----
    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- GET ----
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/participants":
            return self.send_json({
                "backend": "mock" if ARGS.mock else ARGS.backend,
                "participants": [{"name": p.name, "model": p.model or "기본 모델"} for p in PARTICIPANTS],
                "rounds": ARGS.rounds,
                "moderator": ARGS.moderator,
            })
        if path == "/":
            path = "/index.html"
        file = (STATIC / path.lstrip("/")).resolve()
        if STATIC not in file.parents or not file.is_file():
            return self.send_error(404)
        body = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(file.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- POST /api/debate : 토론 진행 상황을 SSE로 스트리밍 ----
    def do_POST(self):
        if self.path != "/api/debate":
            return self.send_error(404)
        try:
            length = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(length) or b"{}")
            task = str(req.get("task", "")).strip()
            rounds = max(1, min(10, int(req.get("rounds", ARGS.rounds))))
            moderator = str(req.get("moderator") or ARGS.moderator)
            only = {n.lower() for n in req.get("only") or []}
        except (ValueError, TypeError):
            return self.send_json({"error": "잘못된 요청입니다."}, 400)
        if not task:
            return self.send_json({"error": "명령을 입력하세요."}, 400)
        participants = [p for p in PARTICIPANTS if not only or p.name.lower() in only]
        if not participants:
            return self.send_json({"error": "참가할 AI가 없습니다."}, 400)
        if not LOCK.acquire(blocking=False):
            return self.send_json({"error": "다른 토론이 진행 중입니다. 끝난 뒤 다시 시도하세요."}, 409)

        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()

            def send(ev: dict):
                self.wfile.write(f"data: {json.dumps(ev, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()

            send({"type": "start", "task": task, "participants": [p.name for p in participants]})
            for ev in debate.debate_events(task, participants, rounds, moderator):
                if ev["type"] == "final" and ARGS.save:
                    ev["saved"] = str(debate.save_transcript(ARGS.save, task, ev["transcript"], ev["text"]))
                ev.pop("transcript", None)
                send(ev)
            send({"type": "done"})
        except (BrokenPipeError, ConnectionResetError):
            self.log_message("클라이언트가 연결을 끊었습니다 (토론 중단).")
        except Exception as e:  # noqa: BLE001
            try:
                send({"type": "error", "message": f"{type(e).__name__}: {e}"})
            except OSError:
                pass
        finally:
            LOCK.release()
            self.close_connection = True


def main() -> int:
    global ARGS, PARTICIPANTS
    ap = argparse.ArgumentParser(description="AI 토론 웹 서버", add_help=False)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    own, rest = ap.parse_known_args()
    if "-h" in rest or "--help" in rest:
        print(__doc__)
        return 0

    debate.load_dotenv(Path(__file__).resolve().parent / ".env")
    ARGS = debate.parse_args(rest)
    PARTICIPANTS = debate.build_participants(ARGS)
    if not PARTICIPANTS:
        print("사용 가능한 AI가 없습니다. CLI 설치/로그인 또는 API 키를 확인하세요.", file=sys.stderr)
        return 1

    httpd = ThreadingHTTPServer((own.host, own.port), Handler)
    httpd.daemon_threads = True
    names = ", ".join(f"{p.name}({p.model or '기본 모델'})" for p in PARTICIPANTS)
    print(f"참가자: {names}")
    print(f"🌐 http://{'localhost' if own.host in ('127.0.0.1', '0.0.0.0') else own.host}:{own.port} 에서 열렸습니다. (종료: Ctrl+C)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
