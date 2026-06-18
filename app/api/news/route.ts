import { NextRequest, NextResponse } from "next/server";

const HEADERS = { "User-Agent": "Mozilla/5.0" };

type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  score?: number;       // -1.0 ~ +1.0
  label?: "긍정" | "부정" | "중립";
  reason?: string;
};

// ── RSS 파싱 ─────────────────────────────────────────────────────────────
function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? block.match(/<title>(.*?)<\/title>/)?.[1]
      ?? "";
    const link = block.match(/<link>(.*?)<\/link>/)?.[1]
      ?? block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
      ?? "";
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
    if (title) items.push({ title: title.trim(), link: link.trim(), pubDate: pubDate.trim() });
  }
  return items.slice(0, 12);
}

async function fetchYahooRSS(symbol: string): Promise<NewsItem[]> {
  const url = `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseRSS(xml);
}

// ── Claude 감성 분석 ──────────────────────────────────────────────────────
async function analyzeSentiment(items: NewsItem[], apiKey: string): Promise<NewsItem[]> {
  if (items.length === 0) return items;

  const numbered = items.map((n, i) => `${i + 1}. ${n.title}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "당신은 금융 뉴스 감성 분석 전문가입니다. 반드시 JSON만 응답하세요. 설명 없이 JSON 배열만 출력하세요.",
      messages: [
        {
          role: "user",
          content: `다음 금융 뉴스 제목들의 주가에 대한 감성을 분석해주세요.
각 뉴스에 대해 score(-1.0~+1.0), label(긍정/부정/중립), reason(한국어 15자 이내) 반환.

뉴스 목록:
${numbered}

응답 형식 (JSON 배열만, 다른 텍스트 없이):
[{"score":0.8,"label":"긍정","reason":"실적 호조 기대감"},...]`,
        },
      ],
    }),
  });

  if (!res.ok) return items;

  const data = await res.json();
  const raw = data?.content?.[0]?.text ?? "";

  try {
    // JSON 추출 (앞뒤 마크다운 코드블록 제거)
    const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const scores: { score: number; label: string; reason: string }[] = JSON.parse(jsonStr);
    return items.map((item, i) => ({
      ...item,
      score: scores[i]?.score ?? 0,
      label: (scores[i]?.label as NewsItem["label"]) ?? "중립",
      reason: scores[i]?.reason ?? "",
    }));
  } catch {
    return items;
  }
}

// ── 집계 통계 ────────────────────────────────────────────────────────────
function calcStats(items: NewsItem[]) {
  const scored = items.filter(i => i.score !== undefined);
  if (scored.length === 0) return { avg: 0, positive: 0, negative: 0, neutral: 0 };
  const avg = scored.reduce((s, i) => s + (i.score ?? 0), 0) / scored.length;
  const positive = scored.filter(i => (i.score ?? 0) > 0.1).length;
  const negative = scored.filter(i => (i.score ?? 0) < -0.1).length;
  const neutral = scored.length - positive - negative;
  return { avg, positive, negative, neutral, total: scored.length };
}

// ── API 핸들러 ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol 파라미터 필요" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";

  try {
    const items = await fetchYahooRSS(symbol);
    if (items.length === 0) {
      return NextResponse.json({ items: [], stats: { avg: 0, positive: 0, negative: 0, neutral: 0, total: 0 } });
    }

    const analyzed = apiKey ? await analyzeSentiment(items, apiKey) : items;
    const stats = calcStats(analyzed);

    return NextResponse.json({ items: analyzed, stats }, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
