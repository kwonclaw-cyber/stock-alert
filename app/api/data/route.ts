import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/store";
import { normalizeData } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readData();
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const data = normalizeData(body);
    await writeData(data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 400 });
  }
}
