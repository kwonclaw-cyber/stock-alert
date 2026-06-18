"use client";

import { useCallback, useEffect, useState } from "react";

type VolumeItem = {
  symbol: string;
  name: string;
  price: number;
  changeAmt: number | null;
  changePct: number;
  volume: number;
  marketCap: number | null;
  avgVolume: number | null;
  volumeRatio: number | null;
  quoteVolume?: number;
};

const MARKETS = [
  { key: "US",     label: "🇺🇸 미국" },
  { key: "KR",     label: "🇰🇷 한국" },
  { key: "CRYPTO", label: "₿ 암호화폐" },
];

function fmtVol(n?: number | null): string {
  if (!n) return "-";
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString("ko-KR");
}

function fmtPrice(n?: number | null): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: n < 10 ? 4 : 2 });
}

export default function VolumePage() {
  const [market, setMarket] = useState("US");
  const [data, setData] = useState<VolumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/volume?market=${m}`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(market);
    const id = window.setInterval(() => fetchData(market), 30_000);
    return () => clearInterval(id);
  }, [market, fetchData]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">🔥 거래량 순위</h2>
          <p className="text-xs text-white/40 mt-0.5">실시간 거래량 상위 종목 — 30초 자동갱신</p>
        </div>
        <div className="flex gap-1">
          {MARKETS.map(m => (
            <button
              key={m.key}
              onClick={() => setMarket(m.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition border ${
                market === m.key
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "border-white/15 text-white/50 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-white/25 text-right">마지막 갱신: {lastUpdated.toLocaleTimeString("ko-KR")}</p>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs text-white/40">
              <th className="px-4 py-3 text-left font-normal w-8">#</th>
              <th className="px-4 py-3 text-left font-normal">종목</th>
              <th className="px-4 py-3 text-right font-normal">현재가</th>
              <th className="px-4 py-3 text-right font-normal">등락률</th>
              <th className="px-4 py-3 text-right font-normal">
                {market === "CRYPTO" ? "24h 거래대금(USDT)" : "거래량"}
              </th>
              {market !== "CRYPTO" && (
                <>
                  <th className="px-4 py-3 text-right font-normal hidden sm:table-cell">거래량 비율</th>
                  <th className="px-4 py-3 text-right font-normal hidden md:table-cell">시가총액</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(15)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {[...Array(market === "CRYPTO" ? 5 : 7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-white/10" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((item, idx) => {
                  const up = (item.changePct ?? 0) >= 0;
                  const highVol = item.volumeRatio != null && item.volumeRatio >= 2;
                  return (
                    <tr
                      key={item.symbol}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="px-4 py-3 text-white/30 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{item.name}</div>
                        <div className="text-xs text-white/35">{item.symbol}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {fmtPrice(item.price)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${up ? "text-red-400" : "text-blue-400"}`}>
                        {up ? "▲" : "▼"} {Math.abs(item.changePct).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-white/70">
                        {market === "CRYPTO"
                          ? fmtVol(item.quoteVolume)
                          : fmtVol(item.volume)}
                      </td>
                      {market !== "CRYPTO" && (
                        <>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            {item.volumeRatio != null ? (
                              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                highVol ? "bg-orange-500/20 text-orange-300" : "text-white/40"
                              }`}>
                                {item.volumeRatio.toFixed(1)}x
                              </span>
                            ) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-white/50 text-xs hidden md:table-cell">
                            {fmtVol(item.marketCap)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!loading && data.length === 0 && (
          <div className="py-16 text-center text-white/30 text-sm">데이터를 불러올 수 없습니다</div>
        )}
      </div>
    </div>
  );
}
