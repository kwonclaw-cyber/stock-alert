# 내수서버 길드 운영 페이지

숲(SOOP) 방송인들이 운영하는 마인크래프트 **내수서버**의 길드 운영 웹페이지입니다.
온라인 라이브 공유를 전제로 하며, **최초 접속 시 공용 비밀번호 게이트**로 보호됩니다.

## 기술 스택

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **jose** (세션 쿠키 서명/검증) + Next.js 미들웨어 기반 접속 게이트
- 배포: **Vercel** (권장) / Netlify

## 보안 동작 방식

- 모든 페이지는 미들웨어(`middleware.ts`)에서 세션 쿠키를 검사합니다.
- 유효한 세션이 없으면 `/login`으로 리다이렉트됩니다.
- `/login`에서 공용 비밀번호(`SITE_PASSWORD`)를 입력하면, 서명된 JWT가
  `HttpOnly` · `Secure` 쿠키로 발급됩니다. (기본 유효기간 7일)
- 비밀번호 비교는 상수 시간 비교로 처리합니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값을 채워주세요
npm run dev
```

`.env.local` 예시:

```bash
SITE_PASSWORD=원하는_공용_비밀번호
AUTH_SECRET=길고_랜덤한_시크릿   # 예: openssl rand -base64 32
```

## Vercel 배포

1. 이 저장소를 Vercel 프로젝트로 연결합니다.
2. **Settings → Environment Variables** 에 다음을 추가합니다.
   - `SITE_PASSWORD` — 길드원에게 공유할 공용 비밀번호
   - `AUTH_SECRET` — 길고 랜덤한 시크릿 (절대 외부 공유 금지)
3. 배포하면 발급된 URL로 라이브 공유할 수 있습니다.

## 다음 작업 (예정)

레퍼런스와 세부 요구사항이 정해지는 대로 채워갈 영역입니다.

- [ ] 길드원 명단 / 역할 관리
- [ ] 일정 · 이벤트 공유
- [ ] 공지사항
- [ ] 디자인 반영 (레퍼런스 기반)
