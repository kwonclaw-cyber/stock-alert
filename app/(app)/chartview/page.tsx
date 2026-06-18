"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Candle } from "@/app/components/StockChart";

const StockChart = dynamic(() => import("@/app/components/StockChart"), { ssr: false });

const INTERVALS = [
  { label: "1일", value: "1d", range: "6mo" },
  { label: "1주", value: "1wk", range: "2y" },
  { label: "1개월", value: "1mo", range: "5y" },
  { label: "1시간", value: "1h", range: "5d" },
];

type Meta = {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  changeAmt: number;
  changePct: number;
  high52w: number;
  low52w: number;
  volume: number;
};

type SearchResult = { symbol: string; name: string; exchange: string; type: string };

function fmt(n?: number, d = 2) {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: d });
}

// 간단한 마크다운 렌더러
function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-white/80">
      {lines.map((line, i) => {
        if (/^#{1,2}\s/.test(line)) {
          return <p key={i} className="font-bold text-white mt-3">{line.replace(/^#+\s/, "")}</p>;
        }
        if (/^#{3,}\s/.test(line)) {
          return <p key={i} className="font-semibold text-emerald-300 mt-2">{line.replace(/^#+\s/, "")}</p>;
        }
        if (/^\s*[-•*]\s/.test(line)) {
          return (
            <p key={i} className="pl-3 text-white/70 before:content-['·'] before:mr-2 before:text-emerald-400">
              {line.replace(/^\s*[-•*]\s/, "").replace(/\*\*(.*?)\*\*/g, "$1")}
            </p>
          );
        }
        if (/^\|/.test(line)) {
          return <p key={i} className="font-mono text-xs text-white/60 whitespace-pre">{line}</p>;
        }
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className={line === "" ? "h-2" : ""}>
            {parts.map((p, j) =>
              j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{p}</strong> : p
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function ChartViewPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [symbolName, setSymbolName] = useState("Apple Inc.");
  const [interval, setInterval_] = useState("1d");
  const [range, setRange] = useState("6mo");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  const fetchCandles = useCallback(async (sym: string, iv: string, rng: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chartview?action=candles&symbol=${sym}&interval=${iv}&range=${rng}`);
      const data = await res.json();
      if (data.error) return;
      setCandles(data.candles ?? []);
      setMeta(data.meta ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandles(symbol, interval, range);
  }, [symbol, interval, range, fetchCandles]);

  function onQuery(v: string) {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!v.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/chartview?action=search&q=${encodeURIComponent(v)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
    }, 300);
  }

  function selectSymbol(r: SearchResult) {
    setSymbol(r.symbol);
    setSymbolName(r.name);
    setQuery("");
    setSearchResults([]);
    setAiText("");
  }

  async function runAiAnalysis() {
    if (!meta || candles.length === 0) return;
    setAiLoading(true);
    setAiText("");

    // 간단한 통계 계산 (서버로 넘길 컨텍스트)
    const closes = candles.map(c => c.close);
    const last = closes[closes.length - 1];
    const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
    const high30 = Math.max(...candles.slice(-30).map(c => c.high));
    const low30 = Math.min(...candles.slice(-30).map(c => c.low));

    const prompt = `종목: ${symbolName} (${symbol})
현재가: ${last}
20일 이동평균: ${ma20.toFixed(2)}
50일 이동평균: ${ma50.toFixed(2)}
52주 최고가: ${meta.high52w}
52주 최저가: ${meta.low52w}
최근 30봉 고점: ${high30.toFixed(2)}
최근 30봉 저점: ${low30.toFixed(2)}
전일 대비: ${meta.changePct >= 0 ? "+" : ""}${meta.changePct?.toFixed(2)}%
인터벌: ${interval}

위 데이터를 바탕으로 다음을 분석해주세요:
1. **현재 추세 방향** (상승/하락/횡보) — 이유 포함
2. **주요 지지선/저항선** — 구체적 가격 제시
3. **현재 포지션 판단** (매수 유리 / 매도 유리 / 관망) — 근거 포함
4. **단기(1~2주) 시나리오** — 상승 시나리오, 하락 시나리오
5. **리스크 요인** — 주의해야 할 점 2~3가지
숫자와 가격 기준으로 구체적으로 작성하세요.`;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: "_custom", params: {}, _prompt: prompt }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "분석 실패" }));
        setAiText(`오류: ${err.error}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAiText(text);
        aiRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    } finally {
      setAiLoading(false);
    }
  }

  const up = (meta?.changePct ?? 0) >= 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">🔍 종목 차트 & AI 분석</h2>
        <p className="text-xs text-white/40 mt-0.5">종목 검색 → 차트 확인 → AI 분석 요청</p>
      </div>

      {/* 검색 */}
      <div className="relative max-w-md">
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="종목명 또는 티커 검색 (예: 삼성전자, AAPL, BTC...)"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-emerald-400/50"
        />
        {searchResults.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-xl border border-white/15 bg-[#1a1d24] shadow-2xl overflow-hidden">
            {searchResults.map(r => (
              <li key={r.symbol}>
                <button
                  onClick={() => selectSymbol(r)}
                  className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-white/10 transition"
                >
                  <div className="text-left">
                    <p className="text-sm text-white font-medium">{r.name}</p>
                    <p className="text-xs text-white/35">{r.symbol} · {r.exchange}</p>
                  </div>
                  <span className="text-xs rounded px-1.5 py-0.5 bg-white/10 text-white/40">{r.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 종목 헤더 + 시세 */}
      {meta && (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs text-white/40">{meta.symbol} · {meta.currency}</p>
            <h3 className="text-lg font-bold text-white">{symbolName}</h3>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="text-3xl font-bold text-white">{fmt(meta.currentPrice)}</span>
              <span className={`text-sm font-medium ${up ? "text-red-400" : "text-blue-400"}`}>
                {up ? "▲" : "▼"} {fmt(Math.abs(meta.changeAmt))} ({up ? "+" : ""}{fmt(meta.changePct)}%)
              </span>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-white/40">
            <span>52주 최고 {fmt(meta.high52w)}</span>
            <span>52주 최저 {fmt(meta.low52w)}</span>
            <span>거래량 {meta.volume?.toLocaleString("ko-KR")}</span>
          </div>
        </div>
      )}

      {/* 차트 */}
      <div className="rounded-xl border border-white/10 bg-[#0f1117] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white/70">캔들 차트</span>
          <div className="flex gap-1 flex-wrap">
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                onClick={() => { setInterval_(iv.value); setRange(iv.range); }}
                className={`rounded px-2.5 py-1 text-xs font-medium border transition ${
                  interval === iv.value
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "border-transparent text-white/40 hover:text-white"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex h-[400px] items-center justify-center text-white/25 text-sm">불러오는 중...</div>
        ) : candles.length > 0 ? (
          <StockChart candles={candles} height={420} />
        ) : (
          <div className="flex h-[400px] items-center justify-center text-white/25 text-sm">데이터 없음</div>
        )}
      </div>

      {/* AI 분석 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">🤖 AI 차트 분석</h3>
            <p className="text-xs text-white/35 mt-0.5">현재 지표를 기반으로 추세·지지저항·포지션 판단을 생성합니다</p>
          </div>
          <button
            onClick={runAiAnalysis}
            disabled={aiLoading || !meta}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {aiLoading ? "분석 중..." : "분석 시작"}
          </button>
        </div>

        {aiText ? (
          <div className="rounded-lg border border-white/10 bg-[#0f1117] p-4 max-h-[500px] overflow-y-auto" ref={aiRef}>
            <RenderMarkdown text={aiText} />
            {aiLoading && <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse ml-1 align-middle" />}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-white/20 text-sm">
            &quot;분석 시작&quot; 버튼을 누르면 AI가 현재 차트를 분석합니다
          </div>
        )}
      </div>
    </div>
  );
}
