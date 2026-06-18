@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   미팅 회의록 - 연결 점검 (셀프테스트)
echo ============================================
echo.

if not exist ".env" (
  echo [안내] .env 파일이 없습니다.
  echo  .env.example 파일을 복사해서 .env 로 이름을 바꾸고,
  echo  키 값을 채운 뒤 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

where python >nul 2>nul
if %errorlevel%==0 (set PY=python) else (set PY=py)

echo 필요한 패키지 확인/설치 중...
%PY% -m pip install -q -r requirements.txt
echo.

%PY% meeting_notes.py --selftest

echo.
pause
