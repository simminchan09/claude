#!/data/data/com.termux/files/usr/bin/bash
# 갤럭시 탭에서 서버를 켜고 브라우저를 엽니다.
cd "$(dirname "$0")"
PORT=8000
# 브라우저로 전환해도 Termux가 잠들지 않게
command -v termux-wake-lock >/dev/null && termux-wake-lock
# 서버가 뜨면 브라우저 열기
( sleep 2; command -v termux-open-url >/dev/null && termux-open-url "http://localhost:$PORT" ) &
echo "브라우저가 안 열리면 Chrome에서 http://localhost:$PORT 을 여세요. (종료: Ctrl+C)"
python server.py --port "$PORT" "$@"
command -v termux-wake-unlock >/dev/null && termux-wake-unlock
