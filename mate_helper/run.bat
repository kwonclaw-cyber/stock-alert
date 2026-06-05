@echo off
chcp 65001 >/dev/null
cd /d "%~dp0"
if not exist ".env" (
  echo [멈춤] 아직 설치가 안 됐습니다. 먼저 "설치.bat" 을 더블클릭하세요.
  pause
  exit /b
)
echo 도우미 실행 중... 이 창을 켜둔 채로
echo 브라우저에서 http://localhost:8765/월마감.html 을 여세요.
echo (종료하려면 이 창을 닫으면 됩니다)
python server.py
pause
