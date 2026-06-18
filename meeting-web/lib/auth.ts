import { SignJWT, jwtVerify } from "jose";

/**
 * 공용 비밀번호 기반 인증.
 * - SITE_PASSWORD: 접속 비밀번호 (회사 사람들과 공유)
 * - AUTH_SECRET: 세션 쿠키 서명 키 (길고 랜덤하게)
 */

export const SESSION_COOKIE = "meeting_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET 환경변수가 설정되지 않았습니다.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export function isPasswordValid(input: string): boolean {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) throw new Error("SITE_PASSWORD 환경변수가 설정되지 않았습니다.");
  return safeEqual(input, expected);
}

/** 타이밍 공격을 줄이기 위한 상수 시간 비교. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE;
