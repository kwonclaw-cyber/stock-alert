import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 디스코드 웹훅으로 메시지 전송 (CORS 회피용 서버 프록시) */
export async function POST(req: NextRequest) {
  let webhook = "";
  let content = "";
  try {
    const body = await req.json();
    webhook = String(body?.webhook ?? "");
    content = String(body?.content ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
  }

  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhook)) {
    return NextResponse.json({ ok: false, error: "유효한 디스코드 웹훅 URL이 아닙니다." }, { status: 400 });
  }
  if (!content.trim()) {
    return NextResponse.json({ ok: false, error: "내용이 비어 있습니다." }, { status: 400 });
  }

  try {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
    return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false, error: "전송 실패" }, { status: 502 });
  }
}
