import { NextRequest, NextResponse } from "next/server";
import { readNav, writeNav } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 광산&채집 네비(공유). 쿨타임(appdata)과 별도 키라 서로 덮어쓰지 않는다.
 * GET은 엣지 캐시(s-maxage)로 인원수와 무관하게 KV 사용량을 낮춘다.
 */
export async function GET() {
  const nav = await readNav();
  return NextResponse.json(nav, {
    headers: { "Cache-Control": "public, s-maxage=2, stale-while-revalidate=5" },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    // 숫자 값만 정제해서 저장
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(body)) {
      const n = Number(v);
      if (n >= 1 && n <= 5) clean[k] = n;
    }
    await writeNav(clean);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
