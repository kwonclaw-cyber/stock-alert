import { NextResponse } from "next/server";

const YF = "https://query2.finance.yahoo.com";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

// 나스닥, 달러/원, 필라델피아반도체, 코스피, 코스닥
const MARKET_SYMBOLS = [
  { key: "nasdaq",  symbol: "^IXIC",   label: "나스닥",           unit: "" },
  { key: "usdkrw",  symbol: "KRW=X",   label: "달러/원 환율",     unit: "₩" },
  { key: "sox",     symbol: "^SOX",    label: "필라델피아 반도체", unit: "" },
  { key: "kospi",   symbol: "^KS11",   label: "코스피",           unit: "" },
  { key: "kosdaq",  symbol: "^KQ11",   label: "코스닥",           unit: "" },
];

async function fetchQuote(symbol: string) {
  const url = `${YF}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`${symbol} fetch failed ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`${symbol} no data`);

  const meta = result.meta;
  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
  const volumes: number[] = result.indicators?.quote?.[0]?.volume ?? [];

  // 최근 유효 종가
  const validCloses = closes.filter((v: number) => v != null && !isNaN(v));
  const currentPrice = meta.regularMarketPrice ?? validCloses[validCloses.length - 1];
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? validCloses[validCloses.length - 2];
  const changeAmt = currentPrice - prevClose;
  const changePct = prevClose > 0 ? (changeAmt / prevClose) * 100 : 0;

  // 스파크라인용 최근 30일 종가
  const sparkData = timestamps
    .map((t: number, i: number) => ({ t, v: closes[i] }))
    .filter((d: { t: number; v: number }) => d.v != null && !isNaN(d.v))
    .slice(-30)
    .map((d: { t: number; v: number }) => d.v);

  return {
    symbol,
    currentPrice,
    changeAmt,
    changePct,
    volume: volumes[volumes.length - 1] ?? 0,
    high52w: meta.fiftyTwoWeekHigh,
    low52w: meta.fiftyTwoWeekLow,
    sparkData,
  };
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      MARKET_SYMBOLS.map(m => fetchQuote(m.symbol))
    );

    const data = results.map((r, i) => ({
      ...MARKET_SYMBOLS[i],
      ...(r.status === "fulfilled" ? r.value : { error: (r.reason as Error).message }),
    }));

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
