@echo off
chcp 65001 >/dev/null
cd /d "%~dp0"
echo ============================================
echo   메이트포스 매출수집 도우미 - 설치
echo ============================================
echo.
where python >/dev/null 2>/dev/null
if errorlevel 1 (
  echo [멈춤] 파이썬이 없습니다.
  echo 1) https://www.python.org/downloads/ 에서 파이썬을 설치하세요.
  echo 2) 설치 화면 맨 아래 "Add python.exe to PATH" 를 꼭 체크하세요.
  echo 3) 설치 후 이 파일(설치.bat)을 다시 더블클릭하세요.
  echo.
  pause
  exit /b
)
echo [1/3] 필요한 프로그램 설치 중... (처음엔 몇 분 걸립니다)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo [2/3] 브라우저 구성요소 설치 중...
python -m playwright install chromium
echo.
echo [3/3] 계정 입력 파일 준비
if not exist ".env" (
  copy ".env.example" ".env" >/dev/null
  echo  - 메모장이 열리면 메이트포스 아이디/비번을 넣고 [저장] 후 닫으세요.
  notepad ".env"
) else (
  echo  - .env 파일이 이미 있습니다. (수정하려면 메모장으로 .env 를 여세요)
)
echo.
echo ============================================
echo   설치 완료!  이제 run.bat 을 더블클릭해 사용하세요.
echo ============================================
pause
