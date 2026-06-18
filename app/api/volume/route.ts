import { NextRequest, NextResponse } from "next/server";

const YF = "https://query2.finance.yahoo.com";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

async function fetchMostActive(region: string, count = 30) {
  const url = `${YF}/v1/finance/screener/predefined/saved?formatted=false&scrIds=most_actives&count=${count}&region=${region}&lang=${region === "KR" ? "ko-KR" : "en-US"}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`volume fetch failed ${res.status}`);
  const json = await res.json();
  const quotes = json?.finance?.result?.[0]?.quotes ?? [];
  return quotes.map((q: Record<string, unknown>) => {
    const vol = q.regularMarketVolume as number ?? 0;
    const avgVol = q.averageDailyVolume3Month as number ?? 0;
    return {
      symbol: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      price: q.regularMarketPrice,
      changeAmt: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      volume: vol,
      marketCap: q.marketCap,
      avgVolume: avgVol,
      volumeRatio: avgVol > 0 ? vol / avgVol : null,
    };
  });
}

// 업비트 공개 API로 암호화폐 거래량
async function fetchCryptoVolume() {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/24hr",
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return [];
  const tickers = await res.json() as Array<{
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    volume: string;
    quoteVolume: string;
  }>;
  return tickers
    .filter((t) => t.symbol.endsWith("USDT"))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, 25)
    .map((t) => ({
      symbol: t.symbol,
      name: t.symbol.replace("USDT", "/USDT"),
      price: parseFloat(t.lastPrice),
      changeAmt: null,
      changePct: parseFloat(t.priceChangePercent),
      volume: parseFloat(t.volume),
      marketCap: null,
      avgVolume: null,
      volumeRatio: null,
      quoteVolume: parseFloat(t.quoteVolume),
    }));
}

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get("market") ?? "US";

  try {
    let data;
    if (market === "CRYPTO") {
      data = await fetchCryptoVolume();
    } else {
      data = await fetchMostActive(market === "KR" ? "KR" : "US");
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
