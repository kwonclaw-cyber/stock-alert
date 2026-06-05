@echo off
chcp 949 >nul
cd /d "%~dp0"
echo ============================================
echo   메이트포스 매출수집 도우미 - 설치
echo ============================================
echo.
where python >nul 2>nul
if errorlevel 1 goto NOPY
echo [1/3] 필요한 프로그램 설치 중... (처음엔 몇 분 걸립니다)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo [2/3] 브라우저 구성요소 설치 중...
python -m playwright install chromium
echo.
echo [3/3] 계정 입력 파일 준비
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo  - 메모장이 열리면 메이트포스 아이디/비번을 넣고 저장 후 닫으세요.
  notepad ".env"
) else (
  echo  - .env 파일이 이미 있습니다.
)
echo.
echo ============================================
echo   설치 완료!  이제 run.bat 을 더블클릭하세요.
echo ============================================
pause
exit /b
:NOPY
echo [멈춤] 파이썬이 없습니다.
echo  1) https://www.python.org/downloads/ 에서 설치
echo  2) 설치화면 맨 아래 Add python.exe to PATH 체크
echo  3) 설치 후 이 파일을 다시 더블클릭
echo.
pause
