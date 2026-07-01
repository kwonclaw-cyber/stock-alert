import { SignJWT, jwtVerify } from "jose";

/**
 * 공용 비밀번호 기반 인증 유틸리티.
 *
 * - SITE_PASSWORD: 문파원에게 공유할 공용 비밀번호
 * - AUTH_SECRET: 세션 쿠키 서명에 쓰이는 비밀 키 (길고 랜덤하게)
 *
 * 두 값 모두 환경변수로 주입한다. (.env.local / Vercel 환경변수)
 */

export const SESSION_COOKIE = "naesu_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return new TextEncoder().encode(secret);
}

/** 비밀번호 검증 후 서명된 세션 토큰을 발급한다. */
export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "guild" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

/** 세션 토큰이 유효한지 검증한다. (미들웨어/엣지 런타임 호환) */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

/** 입력된 비밀번호가 공용 비밀번호와 일치하는지 확인한다. */
export function isPasswordValid(input: string): boolean {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) {
    throw new Error("SITE_PASSWORD 환경변수가 설정되지 않았습니다.");
  }
  return safeEqual(input, expected);
}

/** 타이밍 공격을 줄이기 위한 상수 시간 비교. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE;
