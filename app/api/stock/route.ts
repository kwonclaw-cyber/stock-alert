import { NextRequest, NextResponse } from "next/server";

const BASE = "https://openapi.tossinvest.com";
const API_KEY = process.env.TOSS_INVEST_API_KEY ?? "";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  // key가 tsck_live_... 형태면 직접 Bearer로 시도, 아니면 OAuth 교환
  if (API_KEY.startsWith("tsck_")) return API_KEY;

  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const res = await fetch(`${BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.TOSS_CLIENT_ID ?? "",
      client_secret: process.env.TOSS_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) throw new Error(`Token error ${res.status}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

async function tossGet(path: string) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    next: { revalidate: 0 },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function GET(req: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "TOSS_INVEST_API_KEY 환경변수 없음" }, { status: 500 });

  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");
  const symbol = searchParams.get("symbol") ?? "";

  try {
    if (action === "price") {
      const data = await tossGet(`/v1/market/price?stockCode=${symbol}`);
      return NextResponse.json(data);
    }

    if (action === "candles") {
      const interval = searchParams.get("interval") ?? "1D";
      const count = searchParams.get("count") ?? "100";
      const data = await tossGet(
        `/v1/market/candles?stockCode=${symbol}&interval=${interval}&count=${count}`
      );
      return NextResponse.json(data);
    }

    if (action === "search") {
      const q = searchParams.get("q") ?? "";
      const data = await tossGet(`/v1/market/search?query=${encodeURIComponent(q)}`);
      return NextResponse.json(data);
    }

    if (action === "orderbook") {
      const data = await tossGet(`/v1/market/orderbook?stockCode=${symbol}`);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
