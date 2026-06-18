import { NextRequest, NextResponse } from "next/server";

const YF = "https://query2.finance.yahoo.com";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

// 검색
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const interval = req.nextUrl.searchParams.get("interval") ?? "1d";
  const range = req.nextUrl.searchParams.get("range") ?? "1y";

  if (action === "search") {
    const url = `${YF}/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=0&quotesCount=8&enableFuzzyQuery=true`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return NextResponse.json([], { status: 200 });
    const json = await res.json();
    const quotes = (json?.quotes ?? []).map((q: Record<string, string>) => ({
      symbol: q.symbol,
      name: q.longname ?? q.shortname ?? q.symbol,
      exchange: q.exchDisp ?? q.exchange,
      type: q.quoteType,
    }));
    return NextResponse.json(quotes);
  }

  if (action === "candles") {
    const url = `${YF}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } });
    if (!res.ok) return NextResponse.json({ error: `fetch failed ${res.status}` }, { status: 502 });
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return NextResponse.json({ error: "no data" }, { status: 404 });

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    const candles = timestamps
      .map((t: number, i: number) => ({
        time: t,
        open: (q.open as number[])[i],
        high: (q.high as number[])[i],
        low: (q.low as number[])[i],
        close: (q.close as number[])[i],
        volume: (q.volume as number[])[i],
      }))
      .filter(c => c.open != null && c.close != null);

    const meta = result.meta;
    return NextResponse.json({
      candles,
      meta: {
        symbol: meta.symbol,
        currency: meta.currency,
        name: meta.longName ?? meta.shortName ?? symbol,
        currentPrice: meta.regularMarketPrice,
        changeAmt: meta.regularMarketPrice - meta.chartPreviousClose,
        changePct: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
        high52w: meta.fiftyTwoWeekHigh,
        low52w: meta.fiftyTwoWeekLow,
        volume: meta.regularMarketVolume,
      },
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
