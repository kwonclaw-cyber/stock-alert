# 🎙️ 회의록 웹앱 (meeting-web)

회의를 **녹음 → 실시간 텍스트 변환 → Claude 요약 → Notion 업로드**까지 한 페이지에서
처리하는 **비밀번호 보호 사내 웹앱**입니다. Vercel에 배포해서 PC·폰 어디서든 주소만
열어 사용합니다. (게임 길드 사이트와는 완전히 분리된 별도 배포)

## 동작 방식
1. **녹음 + 음성인식 (브라우저)** — 크롬/엣지 내장 음성인식(한국어)으로 실시간 변환.
2. **요약 (Claude, 선택)** — `한 줄 요약 / 핵심 논의 / 결정사항 / 할 일`. 끄거나 키가 없으면 호출 안 함(크레딧 0).
3. **업로드 (Notion)** — 요약 + 전문을 Notion 페이지로 생성. 토큰은 서버에만 있어 안전.

접속은 **공용 비밀번호**(`SITE_PASSWORD`)로 보호됩니다.

---

## Vercel 배포 (한 번만)

> 이 앱은 저장소의 **하위 폴더**(`meeting-web/`)에 있습니다. 길드 사이트와 같은 저장소지만
> **별도의 Vercel 프로젝트**로 배포하며, 핵심은 **Root Directory를 `meeting-web` 로 지정**하는 것입니다.

1. https://vercel.com → **Add New… → Project**
2. 이 GitHub 저장소(`stock-alert`) 선택 → **Import**
3. **Root Directory** 항목에서 **Edit** → **`meeting-web`** 선택 ⭐ (가장 중요)
4. **Environment Variables** 에 아래 값 입력:

   | 이름 | 값 |
   |------|-----|
   | `SITE_PASSWORD` | 회사 사람들과 공유할 접속 비밀번호 (자유롭게) |
   | `AUTH_SECRET` | 길고 랜덤한 문자열 (예: `openssl rand -base64 32` 결과) |
   | `ANTHROPIC_API_KEY` | Claude 키 (요약 안 쓸 거면 비워도 됨) |
   | `NOTION_API_KEY` | Notion 통합 토큰 |
   | `NOTION_PARENT_PAGE_ID` | 회의록 저장할 Notion 페이지 ID (32자리) |

5. **Deploy** 클릭 → 1~2분 후 배포 완료. 나오는 주소(예: `meeting-web-xxxx.vercel.app`)를 북마크.

> ⚠️ 그 Notion 페이지에 Notion 통합(연결)을 **추가(공유)** 해야 업로드됩니다.
> (페이지 `···` → 연결 → 통합 선택)

### 환경변수를 바꾼 경우
Vercel → 프로젝트 → **Settings → Environment Variables** 에서 수정 후
**Deployments → 최신 배포 → Redeploy** 해야 반영됩니다.

---

## 사용
1. 배포된 주소 접속 → **접속 비밀번호** 입력
2. **● 녹음 시작** → 회의 진행 (실시간 변환) → **■ 종료**
3. 텍스트 다듬기(선택) → **Notion에 저장** → "✅ 저장 완료" 링크 확인
4. AI 요약이 필요 없으면 **"AI 요약 포함" 체크 해제** (Claude 크레딧 미사용)

## 로컬 개발 (선택)
```bash
cd meeting-web
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

## 참고
- 음성인식 품질은 **크롬 / 엣지**에서 가장 좋습니다. (Web Speech API)
- 브라우저 음성인식은 변환을 위해 음성을 외부(브라우저 제공자) 서버로 전송합니다.
- 긴 회의도 자동으로 이어 받아쓰고, Notion 길이 제한(블록당 2000자/요청당 100블록)에 맞춰 자동 분할합니다.
