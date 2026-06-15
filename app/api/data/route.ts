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
    const data = normalizeData(body);
    const version = await writeData(data);
    return NextResponse.json({ ok: true, version });
  } catch {
    return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 400 });
  }
}
