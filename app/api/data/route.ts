import { NextRequest, NextResponse } from "next/server";
import { readData, readVersion, writeData } from "@/lib/store";
import { normalizeData } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [data, version] = await Promise.all([readData(), readVersion()]);
  return NextResponse.json(data, { headers: { "x-data-version": String(version) } });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // 낙관적 동시성: 클라이언트가 알고 있던 버전이 서버와 다르면(누군가 먼저 저장)
    // 통째로 덮어쓰지 않고 409 + 최신 데이터를 돌려준다. 클라이언트가 병합 후 재시도.
    const base = Number(req.headers.get("x-base-version")) || 0;
    if (base) {
      const cur = await readVersion();
      if (cur && base !== cur) {
        const data = await readData();
        return NextResponse.json({ ok: false, conflict: true, version: cur, data }, { status: 409 });
      }
    }
    const data = normalizeData(body);
    const version = await writeData(data);
    return NextResponse.json({ ok: true, version });
  } catch {
    return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 400 });
  }
}
