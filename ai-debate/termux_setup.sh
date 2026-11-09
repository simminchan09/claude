#!/data/data/com.termux/files/usr/bin/bash
# 갤럭시 탭(안드로이드) Termux 설치 스크립트
# 사용: curl -fsSL https://raw.githubusercontent.com/simminchan09/claude/ccr-cf22c3aa-pwnjua/ai-debate/termux_setup.sh | bash
set -e
REPO=https://github.com/simminchan09/claude.git
BRANCH=ccr-cf22c3aa-pwnjua
DIR="$HOME/claude"

echo "▶ 패키지 설치 (python, git)"
pkg update -y
pkg install -y python git

echo "▶ 프로그램 내려받기"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$DIR"
fi

echo "▶ 'ai-debate' 실행 명령 만들기"
cat > "$PREFIX/bin/ai-debate" <<SH
#!/data/data/com.termux/files/usr/bin/bash
exec bash "$DIR/ai-debate/start_tab.sh" "\$@"
SH
chmod +x "$PREFIX/bin/ai-debate"

echo
echo "✅ 설치 완료! 이제 Termux에서 아래 명령으로 실행하세요:"
echo "   ai-debate"
