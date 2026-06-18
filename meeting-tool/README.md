# 🎙️ 미팅 녹음 → Notion 회의록 (회사 PC 로컬 실행)

회의를 녹음하면 실시간으로 한국어 텍스트로 변환하고, Claude가 요약을 만들어
Notion 페이지로 업로드해 주는 **로컬 도구**입니다. 웹에 배포되지 않고
**이 PC에서만**(http://localhost:5000) 동작합니다.

## 동작 방식
1. **녹음 + 음성인식 (브라우저)** — 마이크로 녹음하면서 크롬/엣지 내장
   음성인식(Web Speech API, 한국어)으로 실시간 텍스트 변환. 별도 음성인식 API 키 불필요.
2. **요약 (Claude)** — 변환된 전문을 `한 줄 요약 / 핵심 논의 / 결정사항 / 할 일`로 정리.
3. **업로드 (Notion API)** — 요약 + 회의 전문을 Notion 페이지로 생성.

---

## 준비 (최초 1회)

### 1) Python 설치 확인
PowerShell에서 `python --version` (안 되면 `py --version`). 없으면
https://python.org 에서 설치(설치 화면에서 **"Add to PATH" 체크**).

### 2) Notion 통합 만들기
1. https://www.notion.so/my-integrations → **New integration** → **액세스 토큰** 복사 (`NOTION_API_KEY`).
2. 회의록을 저장할 **페이지**(또는 DB)를 열고 `···` → **연결(Connections)** → 위 통합 추가.
3. 페이지 URL 끝 32자리가 `NOTION_PARENT_PAGE_ID`.

### 3) 키 입력
이 폴더의 **`.env.example`** 을 복사 → 이름을 **`.env`** 로 변경 → 메모장으로 열어
`ANTHROPIC_API_KEY`, `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID` 값을 채우고 저장.
(`.env` 파일은 git에 올라가지 않습니다.)

---

## 사용

- **연결 점검 (마이크 없이):** `check_setup.bat` 더블클릭
  → `🎉 셀프테스트 성공` 과 Notion에 `[셀프테스트] 회의록` 페이지가 생기면 완료.
- **실제 녹음:** `run_meeting.bat` 더블클릭
  → 잠시 후 브라우저 자동 열림 → 마이크 허용 → **● 녹음 시작** →
  **■ 종료** → 텍스트 다듬기 → **Notion에 저장**.

> 명령어로 실행하려면: `pip install -r requirements.txt` 후 `python meeting_notes.py`

## 참고
- 음성인식 품질은 **크롬 / 엣지**에서 가장 좋습니다.
- 녹음된 오디오는 페이지 하단에서 다시 듣고 다운로드할 수 있습니다.
- 서버는 `127.0.0.1`(이 PC)에만 바인딩되어 외부에서 접속할 수 없습니다.
- 긴 회의도 자동으로 이어 받아쓰고, Notion 길이 제한(블록당 2000자 / 요청당 100블록)에
  맞춰 자동 분할 업로드합니다.
