'use client';

import { useState } from 'react';
import {
  StrategyConfig,
  Condition,
  BacktestResult,
  Trade,
} from '@/lib/backtest/types';

// ─── Defaults ────────────────────────────────────────────────────────────────

const MARKET_PRESETS: Record<string, string[]> = {
  KR: ['005930.KS', '000660.KS', '035420.KS'],
  US: ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA'],
  CRYPTO: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  FX: ['EURUSD=X', 'USDJPY=X'],
  INDEX: ['^GSPC', '^KS11', '^N225'],
};

const MARKET_LABELS: Record<string, string> = {
  KR: '주식(한국)',
  US: '미국주식',
  CRYPTO: '암호화폐',
  FX: '외환',
  INDEX: '지수',
};

const TIMEFRAME_LABELS: Record<string, string> = {
  '1h': '1시간봉',
  '4h': '4시간봉',
  '1d': '일봉',
  '1w': '주봉',
};

const INDICATOR_LABELS: Record<string, string> = {
  EMA: 'EMA(기간)',
  RSI: 'RSI(기간)',
  MACD: 'MACD(빠름,느림,시그널)',
  BB: 'BB(기간,표준편차)',
  ATR: 'ATR(기간)',
  PRICE: '가격(PRICE)',
};

const OPERATOR_LABELS: Record<string, string> = {
  above: '위에 있음',
  below: '아래에 있음',
  cross_above: '골든크로스',
  cross_below: '데드크로스',
};

function defaultCondition(): Condition {
  return {
    indicator: 'EMA',
    params: { period: 20 },
    operator: 'above',
    value: 0,
  };
}

function defaultConfig(): StrategyConfig {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 2);
  return {
    asset: 'SPY',
    market: 'US',
    timeframe: '1d',
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    initialCapital: 10000000,
    entryConditions: [defaultCondition()],
    filterConditions: [],
    exitConditions: [],
    stopLoss: 3,
    takeProfit: { tp1Pct: 5, tp2Pct: 10, trailing: false },
    positionSizing: { mode: 'fixed_risk', riskPct: 1 },
  };
}

// ─── Condition Row ────────────────────────────────────────────────────────────

function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  function updateParams(key: string, val: number) {
    onChange({ ...cond, params: { ...cond.params, [key]: val } });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
      <select
        value={cond.indicator}
        onChange={e => {
          const ind = e.target.value as Condition['indicator'];
          const defaults: Record<string, Record<string, number>> = {
            EMA: { period: 20 },
            RSI: { period: 14 },
            MACD: { fast: 12, slow: 26, signal: 9 },
            BB: { period: 20, stdDev: 2 },
            ATR: { period: 14 },
            PRICE: {},
          };
          onChange({ ...cond, indicator: ind, params: defaults[ind] ?? {} });
        }}
        className="rounded bg-white/10 px-2 py-1 text-sm text-white"
      >
        {Object.entries(INDICATOR_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Param inputs */}
      {cond.indicator === 'EMA' || cond.indicator === 'RSI' || cond.indicator === 'ATR' ? (
        <input
          type="number"
          value={cond.params.period ?? 14}
          onChange={e => updateParams('period', Number(e.target.value))}
          className="w-16 rounded bg-white/10 px-2 py-1 text-sm text-white"
          placeholder="기간"
        />
      ) : null}
      {cond.indicator === 'MACD' ? (
        <>
          <input type="number" value={cond.params.fast ?? 12} onChange={e => updateParams('fast', Number(e.target.value))} className="w-14 rounded bg-white/10 px-2 py-1 text-sm text-white" placeholder="빠름" />
          <input type="number" value={cond.params.slow ?? 26} onChange={e => updateParams('slow', Number(e.target.value))} className="w-14 rounded bg-white/10 px-2 py-1 text-sm text-white" placeholder="느림" />
          <input type="number" value={cond.params.signal ?? 9} onChange={e => updateParams('signal', Number(e.target.value))} className="w-14 rounded bg-white/10 px-2 py-1 text-sm text-white" placeholder="시그널" />
        </>
      ) : null}
      {cond.indicator === 'BB' ? (
        <>
          <input type="number" value={cond.params.period ?? 20} onChange={e => updateParams('period', Number(e.target.value))} className="w-16 rounded bg-white/10 px-2 py-1 text-sm text-white" placeholder="기간" />
          <input type="number" step="0.1" value={cond.params.stdDev ?? 2} onChange={e => updateParams('stdDev', Number(e.target.value))} className="w-16 rounded bg-white/10 px-2 py-1 text-sm text-white" placeholder="표준편차" />
        </>
      ) : null}

      <select
        value={cond.operator}
        onChange={e => onChange({ ...cond, operator: e.target.value as Condition['operator'] })}
        className="rounded bg-white/10 px-2 py-1 text-sm text-white"
      >
        {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      <input
        type="number"
        value={cond.value ?? 0}
        onChange={e => onChange({ ...cond, value: Number(e.target.value) })}
        className="w-20 rounded bg-white/10 px-2 py-1 text-sm text-white"
        placeholder="값"
      />

      <button onClick={onRemove} className="ml-auto rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10">✕</button>
    </div>
  );
}

function ConditionBuilder({
  label,
  conditions,
  onChange,
}: {
  label: string;
  conditions: Condition[];
  onChange: (cs: Condition[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">{label}</span>
        {conditions.length < 5 && (
          <button
            onClick={() => onChange([...conditions, defaultCondition()])}
            className="rounded px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-400/10"
          >
            + 조건 추가
          </button>
        )}
      </div>
      {conditions.length === 0 && (
        <p className="text-xs text-white/30">조건 없음 (항상 참)</p>
      )}
      {conditions.map((c, i) => (
        <ConditionRow
          key={i}
          cond={c}
          onChange={updated => {
            const next = conditions.slice();
            next[i] = updated;
            onChange(next);
          }}
          onRemove={() => onChange(conditions.filter((_, j) => j !== i))}
        />
      ))}
    </div>
  );
}

// ─── Equity Chart ─────────────────────────────────────────────────────────────

function EquityChart({ equity }: { equity: BacktestResult['equity'] }) {
  if (equity.length < 2) return null;
  const values = equity.map(e => e.equity);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const W = 1000;
  const H = 200;
  const points = equity.map((e, i) => {
    const x = (i / (equity.length - 1)) * W;
    const y = H - ((e.equity - minV) / range) * H;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M 0,${H} L ${points.join(' L ')} L ${W},${H} Z`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white/70">에쿼티 커브</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#eq-grad)" />
        <path d={pathD} fill="none" stroke="#34d399" strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-white/40">
        <span>{new Date(equity[0].time * 1000).toLocaleDateString('ko-KR')}</span>
        <span>{new Date(equity[equity.length - 1].time * 1000).toLocaleDateString('ko-KR')}</span>
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const colorClass = positive === undefined ? 'text-white' : positive ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`mt-1 text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const [config, setConfig] = useState<StrategyConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  function update(partial: Partial<StrategyConfig>) {
    setConfig(prev => ({ ...prev, ...partial }));
  }

  async function runBacktest() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '오류가 발생했습니다.');
      setResult(data as BacktestResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  const m = result?.metrics;

  function fmt(v: number, decimals = 2) {
    return isFinite(v) ? v.toFixed(decimals) : '—';
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold text-white">🔬 백테스트</h1>

      {/* ── Strategy Builder ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
        <h2 className="text-base font-semibold text-white">전략 설정</h2>

        {/* Market tabs */}
        <div>
          <label className="mb-1.5 block text-xs text-white/50">마켓</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(MARKET_LABELS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => update({ market: k as StrategyConfig['market'], asset: MARKET_PRESETS[k][0] })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${config.market === k ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'border border-white/15 text-white/50 hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Asset */}
        <div>
          <label className="mb-1.5 block text-xs text-white/50">종목</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={config.asset}
              onChange={e => update({ asset: e.target.value })}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white w-40"
              placeholder="심볼 입력"
            />
            {MARKET_PRESETS[config.market]?.map(s => (
              <button
                key={s}
                onClick={() => update({ asset: s })}
                className={`rounded-md px-2.5 py-1 text-xs transition ${config.asset === s ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'border border-white/15 text-white/50 hover:text-white'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <label className="mb-1.5 block text-xs text-white/50">타임프레임</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TIMEFRAME_LABELS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => update({ timeframe: k as StrategyConfig['timeframe'] })}
                className={`rounded-md px-3 py-1.5 text-sm transition ${config.timeframe === k ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'border border-white/15 text-white/50 hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Dates & Capital */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs text-white/50">시작일</label>
            <input
              type="date"
              value={config.startDate}
              onChange={e => update({ startDate: e.target.value })}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">종료일</label>
            <input
              type="date"
              value={config.endDate}
              onChange={e => update({ endDate: e.target.value })}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">초기 자본 (원)</label>
            <input
              type="number"
              value={config.initialCapital}
              onChange={e => update({ initialCapital: Number(e.target.value) })}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white w-40"
            />
          </div>
        </div>
      </div>

      {/* ── Conditions ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
        <h2 className="text-base font-semibold text-white">진입/청산 조건</h2>
        <ConditionBuilder
          label="진입 조건 (Entry)"
          conditions={config.entryConditions}
          onChange={cs => update({ entryConditions: cs })}
        />
        <ConditionBuilder
          label="필터 조건 (Filter)"
          conditions={config.filterConditions}
          onChange={cs => update({ filterConditions: cs })}
        />
        <ConditionBuilder
          label="청산 조건 (Exit)"
          conditions={config.exitConditions}
          onChange={cs => update({ exitConditions: cs })}
        />
      </div>

      {/* ── Risk Management ── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">리스크 관리</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs text-white/50">손절 %</label>
            <input
              type="number"
              step="0.1"
              value={config.stopLoss}
              onChange={e => update({ stopLoss: Number(e.target.value) })}
              className="w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">TP1 %</label>
            <input
              type="number"
              step="0.1"
              value={config.takeProfit.tp1Pct}
              onChange={e => update({ takeProfit: { ...config.takeProfit, tp1Pct: Number(e.target.value) } })}
              className="w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">TP2 %</label>
            <input
              type="number"
              step="0.1"
              value={config.takeProfit.tp2Pct}
              onChange={e => update({ takeProfit: { ...config.takeProfit, tp2Pct: Number(e.target.value) } })}
              className="w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-sm text-white/70">
              <input
                type="checkbox"
                checked={config.takeProfit.trailing}
                onChange={e => update({ takeProfit: { ...config.takeProfit, trailing: e.target.checked } })}
                className="accent-emerald-400"
              />
              트레일링 스탑
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs text-white/50">포지션 사이징</label>
            <select
              value={config.positionSizing.mode}
              onChange={e => update({ positionSizing: { ...config.positionSizing, mode: e.target.value as StrategyConfig['positionSizing']['mode'] } })}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
            >
              <option value="fixed_risk">자본 리스크% 기준</option>
              <option value="fixed_pct">고정%</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">리스크 %</label>
            <input
              type="number"
              step="0.1"
              value={config.positionSizing.riskPct}
              onChange={e => update({ positionSizing: { ...config.positionSizing, riskPct: Number(e.target.value) } })}
              className="w-24 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* ── Run Button ── */}
      <button
        onClick={runBacktest}
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 text-base font-semibold text-white transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            백테스트 실행 중...
          </span>
        ) : '▶ 백테스트 실행'}
      </button>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && m && (
        <div className="space-y-5">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard label="총수익률" value={`${fmt(m.totalReturn)}%`} positive={m.totalReturn > 0} />
            <MetricCard label="연환산수익률" value={`${fmt(m.annualizedReturn)}%`} positive={m.annualizedReturn > 0} />
            <MetricCard label="샤프지수" value={fmt(m.sharpe)} positive={m.sharpe > 1} />
            <MetricCard label="소르티노" value={fmt(m.sortino)} positive={m.sortino > 1} />
            <MetricCard label="최대낙폭" value={`-${fmt(m.maxDrawdown)}%`} positive={false} />
            <MetricCard label="승률" value={`${fmt(m.winRate)}%`} positive={m.winRate > 50} />
            <MetricCard label="프로핏팩터" value={isFinite(m.profitFactor) ? fmt(m.profitFactor) : '∞'} positive={m.profitFactor > 1} />
            <MetricCard label="총거래수" value={String(m.totalTrades)} />
            <MetricCard label="평균보유일" value={`${fmt(m.avgHoldingDays, 1)}일`} />
            <MetricCard label="칼마비율" value={fmt(m.calmarRatio)} positive={m.calmarRatio > 1} />
          </div>

          {/* Equity curve */}
          <EquityChart equity={result.equity} />

          {/* Trades table */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs">
                  <th className="px-4 py-3 text-left">진입일시</th>
                  <th className="px-4 py-3 text-left">청산일시</th>
                  <th className="px-4 py-3 text-right">진입가</th>
                  <th className="px-4 py-3 text-right">청산가</th>
                  <th className="px-4 py-3 text-right">손익%</th>
                  <th className="px-4 py-3 text-left">청산사유</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t: Trade, i: number) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2.5 text-white/70">{new Date(t.entryTime * 1000).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-2.5 text-white/70">{new Date(t.exitTime * 1000).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-2.5 text-right text-white/80">{t.entryPrice.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-white/80">{t.exitPrice.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${t.pnl > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {t.pnlPct > 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${
                        t.exitReason === 'SL' ? 'bg-blue-500/20 text-blue-300' :
                        t.exitReason === 'TP1' ? 'bg-emerald-500/20 text-emerald-300' :
                        t.exitReason === 'TP2' ? 'bg-emerald-500/30 text-emerald-200' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {t.exitReason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.trades.length === 0 && (
              <div className="py-8 text-center text-white/30 text-sm">거래 없음</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
