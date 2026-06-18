"use client";

import { useCallback, useEffect, useState } from "react";

type MarketItem = {
  key: string;
  symbol: string;
  label: string;
  unit: string;
  currentPrice?: number;
  changeAmt?: number;
  changePct?: number;
  volume?: number;
  high52w?: number;
  low52w?: number;
  sparkData?: number[];
  error?: string;
};

// SVG 스파크라인
function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div className="h-16 w-full" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 200, H = 64;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  const color = up ? "#f87171" : "#60a5fa";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" />
      <polygon
        points={`0,${H} ${pts.join(" ")} ${W},${H}`}
        fill={color}
        fillOpacity="0.08"
      />
    </svg>
  );
}

function fmt(n?: number, decimals = 2) {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: decimals });
}

const MARKET_LABELS: Record<string, string> = {
  nasdaq:  "🇺🇸 나스닥 (IXIC)",
  usdkrw:  "💵 달러/원 환율",
  sox:     "🔬 필라델피아 반도체 (SOX)",
  kospi:   "🇰🇷 코스피",
  kosdaq:  "🟢 코스닥",
};

export default function MarketPage() {
  const [data, setData] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      const json = await res.json();
      if (Array.isArray(json)) {
        setData(json);
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = window.setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const activeItem = active ? data.find(d => d.key === active) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">📊 마켓 오버뷰</h2>
          <p className="text-xs text-white/40 mt-0.5">나스닥 · 달러환율 · 필반 · 코스피 · 코스닥 — 30초 자동갱신</p>
        </div>
        {lastUpdated && (
          <span className="text-xs text-white/30">
            마지막 갱신: {lastUpdated.toLocaleTimeString("ko-KR")}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : (
        <>
          {/* 5개 카드 그리드 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map(item => {
              const up = (item.changePct ?? 0) >= 0;
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActive(isActive ? null : item.key)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    isActive
                      ? "border-emerald-400/50 bg-emerald-400/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-white/50">{MARKET_LABELS[item.key]}</p>
                      {item.error ? (
                        <p className="text-sm text-red-400 mt-1">{item.error}</p>
                      ) : (
                        <p className="text-2xl font-bold text-white mt-0.5">
                          {item.unit}{fmt(item.currentPrice, item.key === "usdkrw" ? 1 : 2)}
                        </p>
                      )}
                    </div>
                    {!item.error && (
                      <div className={`rounded-lg px-2.5 py-1 text-sm font-bold ${up ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}`}>
                        {up ? "▲" : "▼"} {Math.abs(item.changePct ?? 0).toFixed(2)}%
                      </div>
                    )}
                  </div>
                  {!item.error && item.sparkData && (
                    <Sparkline data={item.sparkData} up={up} />
                  )}
                  {!item.error && (
                    <div className="mt-2 flex gap-4 text-xs text-white/40">
                      <span>전일대비 {up ? "+" : ""}{fmt(item.changeAmt, item.key === "usdkrw" ? 2 : 2)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 선택된 항목 상세 */}
          {activeItem && !activeItem.error && (
            <div className="rounded-xl border border-emerald-400/20 bg-white/5 p-5">
              <h3 className="text-sm font-bold text-white mb-4">{MARKET_LABELS[activeItem.key]} 상세</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "현재가", value: `${activeItem.unit}${fmt(activeItem.currentPrice, activeItem.key === "usdkrw" ? 2 : 2)}` },
                  { label: "전일대비", value: `${(activeItem.changePct ?? 0) >= 0 ? "+" : ""}${fmt(activeItem.changePct, 2)}%`, color: (activeItem.changePct ?? 0) >= 0 ? "text-red-400" : "text-blue-400" },
                  { label: "52주 최고", value: fmt(activeItem.high52w) },
                  { label: "52주 최저", value: fmt(activeItem.low52w) },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/40">{label}</p>
                    <p className={`text-base font-semibold mt-1 ${color ?? "text-white"}`}>{value}</p>
                  </div>
                ))}
              </div>

              {activeItem.sparkData && activeItem.sparkData.length > 0 && (
                <div className="mt-4 rounded-lg border border-white/10 bg-[#0f1117] p-4">
                  <p className="text-xs text-white/40 mb-2">최근 3개월 추이</p>
                  <div className="h-32">
                    <svg viewBox="0 0 400 80" className="w-full h-full" preserveAspectRatio="none">
                      {(() => {
                        const d = activeItem.sparkData!;
                        const min = Math.min(...d);
                        const max = Math.max(...d);
                        const rng = max - min || 1;
                        const W = 400, H = 80;
                        const pts = d.map((v, i) => `${(i / (d.length - 1)) * W},${H - ((v - min) / rng) * H}`);
                        const up = (activeItem.changePct ?? 0) >= 0;
                        const color = up ? "#f87171" : "#60a5fa";
                        return (
                          <>
                            <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" />
                            <polygon points={`0,${H} ${pts.join(" ")} ${W},${H}`} fill={color} fillOpacity="0.1" />
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
