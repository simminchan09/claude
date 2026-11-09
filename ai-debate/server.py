#!/usr/bin/env python3
"""AI 토론 웹 서버 (localhost).

    python server.py                 # http://127.0.0.1:8000
    python server.py --port 9000
    python server.py --mock          # 실제 호출 없이 테스트
    python server.py --backend api   # API 키 사용
    python server.py --pad           # 같은 Wi-Fi의 태블릿(갤럭시 탭·아이패드)/휴대폰에서 접속 가능

debate.py 의 옵션(--backend, --timeout, --claude-model 등)을 그대로 사용할 수 있습니다.
외부 패키지 없이 Python 표준 라이브러리만 사용합니다.
"""

from __future__ import annotations

import argparse
import hmac
import json
import secrets
import socket
import sys
import threading
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import debate

STATIC = Path(__file__).resolve().parent / "static"
CONTENT_TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
                 ".json": "application/manifest+json; charset=utf-8", ".png": "image/png"}

ARGS: argparse.Namespace
PARTICIPANTS: list[debate.Participant] = []
LOCK = threading.Lock()  # 한 번에 하나의 토론만 실행 (CLI 세션 충돌 방지)
ACCESS_KEY = ""  # 외부(Wi-Fi) 접속 허용 시 필요한 접속 키. 빈 값이면 검사 안 함


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

    # ---- 접속 키 확인 (같은 Wi-Fi의 다른 사람이 마음대로 쓰지 못하게) ----
    def authorized(self) -> bool:
        if not ACCESS_KEY:
            return True
        candidates = [self.headers.get("X-Access-Key", "")]
        candidates += parse_qs(urlsplit(self.path).query).get("key", [])
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        if "debate_key" in cookie:
            candidates.append(cookie["debate_key"].value)
        return any(hmac.compare_digest(c, ACCESS_KEY) for c in candidates if c)

    def deny(self):
        body = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                "<body style='font-family:sans-serif;padding:24px'><h2>접속 키가 필요합니다</h2>"
                "<p>서버를 실행한 컴퓨터의 터미널에 표시된 주소(<code>?key=...</code> 포함)로 접속하세요.</p>").encode()
        self.send_response(403)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- GET ----
    def do_GET(self):
        path = urlsplit(self.path).path
        public = path in ("/manifest.json", "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable.png")  # 홈 화면 추가용 (비밀 아님)
        if not public and not self.authorized():
            return self.deny()
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
        if ACCESS_KEY and file.suffix == ".html":
            # 홈 화면 앱으로 열어도 키가 유지되도록 쿠키 저장 (1년)
            self.send_header("Set-Cookie", f"debate_key={ACCESS_KEY}; Path=/; Max-Age=31536000; SameSite=Strict; HttpOnly")
        self.end_headers()
        self.wfile.write(body)

    # ---- POST /api/debate : 토론 진행 상황을 SSE로 스트리밍 ----
    def do_POST(self):
        if urlsplit(self.path).path != "/api/debate":
            return self.send_error(404)
        if not self.authorized():
            return self.send_json({"error": "접속 키가 올바르지 않습니다."}, 403)
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


def lan_ips() -> list[str]:
    """이 컴퓨터의 Wi-Fi/LAN IP 주소 목록."""
    ips: list[str] = []
    try:  # 기본 경로의 IP (실제 패킷은 보내지 않음)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            ips.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return [ip for ip in ips if not ip.startswith("127.")]


def main() -> int:
    global ARGS, PARTICIPANTS, ACCESS_KEY
    ap = argparse.ArgumentParser(description="AI 토론 웹 서버", add_help=False)
    ap.add_argument("--host", default=None)
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--pad", "--lan", action="store_true", dest="pad",
                    help="같은 Wi-Fi의 태블릿/휴대폰에서 접속 허용")
    ap.add_argument("--key", default=None, help="외부 접속 키 직접 지정 (기본: 자동 생성)")
    ap.add_argument("--no-key", action="store_true", help="외부 접속 시 키 검사 끄기 (권장하지 않음)")
    own, rest = ap.parse_known_args()
    if "-h" in rest or "--help" in rest:
        print(__doc__)
        print("웹 서버 옵션: --port N, --pad(태블릿/폰 접속), --host ADDR, --key KEY, --no-key")
        return 0

    host = own.host or ("0.0.0.0" if own.pad else "127.0.0.1")
    external = host not in ("127.0.0.1", "localhost", "::1")
    if external and not own.no_key:
        ACCESS_KEY = own.key or secrets.token_urlsafe(6)

    debate.load_dotenv(Path(__file__).resolve().parent / ".env")
    ARGS = debate.parse_args(rest)
    PARTICIPANTS = debate.build_participants(ARGS)
    if not PARTICIPANTS:
        print("사용 가능한 AI가 없습니다. CLI 설치/로그인 또는 API 키를 확인하세요.", file=sys.stderr)
        return 1

    try:
        httpd = ThreadingHTTPServer((host, own.port), Handler)
    except OSError as e:
        print(f"포트 {own.port}를 열 수 없습니다 ({e}). --port 9000 처럼 다른 포트를 지정하세요.", file=sys.stderr)
        return 1
    httpd.daemon_threads = True
    names = ", ".join(f"{p.name}({p.model or '기본 모델'})" for p in PARTICIPANTS)
    q = f"/?key={ACCESS_KEY}" if ACCESS_KEY else "/"
    print(f"참가자: {names}")
    print(f"💻 이 컴퓨터:   http://localhost:{own.port}{q}")
    if external:
        ips = lan_ips() if host == "0.0.0.0" else [host]
        for ip in ips or ["<이 컴퓨터의 IP>"]:
            print(f"📱 태블릿/폰:  http://{ip}:{own.port}{q}")
        print("   (같은 Wi-Fi에 연결된 갤럭시 탭의 Chrome/삼성 인터넷에 위 주소를 그대로 입력하세요)")
        print("   (안 열리면 이 컴퓨터의 방화벽에서 Python 접속을 허용하세요)")
    print("종료: Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
