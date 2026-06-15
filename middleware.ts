import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * 최초 접속 보안 게이트.
 * 유효한 세션 쿠키가 없으면 /login 으로 보낸다.
 * 로그인/인증 API/정적 리소스는 통과시킨다.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 게이트를 적용하지 않는 경로
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    // 정적 이미지/에셋(로그인 화면 이미지 등)은 인증 없이 통과
    /\.(jpe?g|png|svg|webp|gif|ico|txt|xml|woff2?)$/i.test(pathname);

  if (isPublic) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = await verifySessionToken(token);

  if (!authed) {
    const loginUrl = new URL("/login", req.url);
    // 로그인 후 원래 가려던 곳으로 돌려보내기 위한 next 파라미터
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 정적 파일/이미지 최적화 경로를 제외한 모든 요청에 적용
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
