"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Candle } from "@/app/components/StockChart";

const StockChart = dynamic(() => import("@/app/components/StockChart"), { ssr: false });

const INTERVALS = [
  { label: "1분", value: "1" },
  { label: "5분", value: "5" },
  { label: "15분", value: "15" },
  { label: "30분", value: "30" },
  { label: "1시간", value: "60" },
  { label: "일봉", value: "1D" },
  { label: "주봉", value: "1W" },
];

type PriceInfo = {
  stockCode?: string;
  name?: string;
  currentPrice?: number;
  changeRate?: number;
  changeAmount?: number;
  marketCap?: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
};

type SearchResult = { stockCode: string; name: string; market?: string };

function fmt(n?: number) {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR");
}

function fmtRate(r?: number) {
  if (r == null) return "-";
  const sign = r >= 0 ? "+" : "";
  return `${sign}${r.toFixed(2)}%`;
}

export default function StockPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [symbol, setSymbol] = useState("005930"); // 삼성전자 기본값
  const [symbolName, setSymbolName] = useState("삼성전자");
  const [interval, setInterval] = useState("1D");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [price, setPrice] = useState<PriceInfo>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPrice = useCallback(async (sym: string) => {
    try {
      const res = await fetch(`/api/stock?action=price&symbol=${sym}`);
      const data = await res.json();
      if (data.error) return;
      setPrice(data);
    } catch {}
  }, []);

  const fetchCandles = useCallback(async (sym: string, iv: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock?action=candles&symbol=${sym}&interval=${iv}&count=200`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      // 응답 형태 정규화 (배열이거나 data.candles 일 수 있음)
      const raw: Candle[] = Array.isArray(data) ? data : (data.candles ?? data.data ?? []);
      setCandles(raw);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice(symbol);
    fetchCandles(symbol, interval);
    const id = window.setInterval(() => fetchPrice(symbol), 5000);
    return () => clearInterval(id);
  }, [symbol, interval, fetchPrice, fetchCandles]);

  function onQueryChange(v: string) {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!v.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock?action=search&q=${encodeURIComponent(v)}`);
        const data = await res.json();
        const list: SearchResult[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
        setSearchResults(list.slice(0, 8));
      } catch {}
    }, 300);
  }

  function selectSymbol(item: SearchResult) {
    setSymbol(item.stockCode);
    setSymbolName(item.name);
    setQuery("");
    setSearchResults([]);
  }

  const up = (price.changeRate ?? 0) >= 0;

  return (
    <div className="space-y-5">
      {/* 검색 + 종목 헤더 */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative w-72">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="종목명 또는 코드 검색..."
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50"
          />
          {searchResults.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-lg border border-white/15 bg-[#1a1d24] shadow-xl">
              {searchResults.map((r) => (
                <li key={r.stockCode}>
                  <button
                    onClick={() => selectSymbol(r)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-white/10"
                  >
                    <span className="text-white">{r.name}</span>
                    <span className="text-white/40">{r.stockCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-white">{symbolName}</h2>
            <span className="text-sm text-white/40">{symbol}</span>
          </div>
          <div className="flex items-baseline gap-3 mt-0.5">
            <span className="text-2xl font-bold text-white">{fmt(price.currentPrice)}원</span>
            <span className={`text-sm font-medium ${up ? "text-red-400" : "text-blue-400"}`}>
              {fmtRate(price.changeRate)} ({up ? "+" : ""}{fmt(price.changeAmount)})
            </span>
          </div>
        </div>
      </div>

      {/* 시세 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "거래량", value: fmt(price.volume) },
          { label: "시가", value: fmt(price.open) },
          { label: "고가", value: fmt(price.high) },
          { label: "저가", value: fmt(price.low) },
          { label: "시가총액", value: price.marketCap ? `${(price.marketCap / 1e12).toFixed(1)}조` : "-" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-white/40">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div className="rounded-xl border border-white/10 bg-[#0f1117] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white/70">캔들 차트</span>
          <div className="flex gap-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                onClick={() => setInterval(iv.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  interval === iv.value
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-white/40 hover:text-white/70 border border-transparent"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex h-[400px] items-center justify-center text-white/30 text-sm">
            불러오는 중...
          </div>
        )}
        {error && !loading && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-sm text-red-400 font-medium">API 오류</p>
            <p className="text-xs text-red-400/70 mt-1 font-mono break-all">{error}</p>
            <p className="text-xs text-white/40 mt-2">
              토스증권 개발자 센터에서 API 키/엔드포인트를 확인해주세요.
            </p>
          </div>
        )}
        {!loading && !error && candles.length > 0 && (
          <StockChart candles={candles} height={420} />
        )}
        {!loading && !error && candles.length === 0 && (
          <div className="flex h-[400px] items-center justify-center text-white/30 text-sm">
            데이터 없음
          </div>
        )}
      </div>

      {/* 분석 패널 (향후 추가 예정) */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-white/50">분석 패널 — 추가 예정</p>
        <p className="text-xs text-white/30 mt-1">원하시는 분석 내용을 알려주시면 구현해드립니다.</p>
      </div>
    </div>
  );
}
