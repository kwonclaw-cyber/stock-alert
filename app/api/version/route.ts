import { NextResponse } from "next/server";
import { readVersion } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 경량 변경 감지용: 현재 데이터 버전만 반환 */
export async function GET() {
  const version = await readVersion();
  return NextResponse.json({ version });
}
