import { NextResponse } from "next/server";
import { readVersion } from "@/lib/store";

export const runtime = "nodejs";

/**
 * 경량 변경 감지용: 현재 데이터 버전만 반환.
 * 엣지 캐시(s-maxage)를 걸어, 여러 명이 동시에 확인해도 KV는 몇 초에 한 번만 친다.
 * (인원수와 무관하게 사용량을 낮춤)
 */
export async function GET() {
  const version = await readVersion();
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=10" } },
  );
}
