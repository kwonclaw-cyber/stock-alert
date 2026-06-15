import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 현재 서버(배포)의 빌드 식별자. 클라이언트가 자기 빌드와 비교해 새 버전을 감지. */
export async function GET() {
  return NextResponse.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" });
}
