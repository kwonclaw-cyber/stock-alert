import { OHLCV, StrategyConfig, BacktestResult, BacktestMetrics, Trade, EquityPoint, Condition } from './types';
import { ema, sma, rsi, macd, bollingerBands, atr } from './indicators';

interface IndicatorSeries {
  [key: string]: number[];
}

function getIndicatorKey(cond: Condition): string {
  const p = cond.params;
  switch (cond.indicator) {
    case 'EMA': return `EMA_${p.period ?? 20}`;
    // SMA not in Condition type
    case 'RSI': return `RSI_${p.period ?? 14}`;
    case 'MACD': return `MACD_${p.fast ?? 12}_${p.slow ?? 26}_${p.signal ?? 9}`;
    case 'BB': return `BB_${p.period ?? 20}_${p.stdDev ?? 2}`;
    case 'ATR': return `ATR_${p.period ?? 14}`;
    case 'PRICE': return 'PRICE';
    default: return cond.indicator;
  }
}

function preComputeIndicators(candles: OHLCV[], conditions: Condition[]): IndicatorSeries {
  const closes = candles.map(c => c.close);
  const series: IndicatorSeries = {};
  series['PRICE'] = closes;

  const allConds = conditions;
  for (const cond of allConds) {
    const key = getIndicatorKey(cond);
    if (series[key]) continue;
    const p = cond.params;
    switch (cond.indicator) {
      case 'EMA':
        series[key] = ema(closes, p.period ?? 20);
        break;
      case 'RSI':
        series[key] = rsi(closes, p.period ?? 14);
        break;
      case 'MACD': {
        const m = macd(closes, p.fast ?? 12, p.slow ?? 26, p.signal ?? 9);
        series[key] = m.map(v => v.macd);
        series[`${key}_signal`] = m.map(v => v.signal);
        series[`${key}_hist`] = m.map(v => v.histogram);
        break;
      }
      case 'BB': {
        const bb = bollingerBands(closes, p.period ?? 20, p.stdDev ?? 2);
        series[key] = bb.map(v => v.middle);
        series[`${key}_upper`] = bb.map(v => v.upper);
        series[`${key}_lower`] = bb.map(v => v.lower);
        break;
      }
      case 'ATR':
        series[key] = atr(candles, p.period ?? 14);
        break;
    }
  }
  return series;
}

function getIndicatorValue(series: IndicatorSeries, cond: Condition, i: number): number {
  const key = getIndicatorKey(cond);
  return series[key]?.[i] ?? NaN;
}

function evalCondition(series: IndicatorSeries, cond: Condition, i: number): boolean {
  if (i < 1) return false;
  const val = getIndicatorValue(series, cond, i);
  const valPrev = getIndicatorValue(series, cond, i - 1);
  if (isNaN(val) || isNaN(valPrev)) return false;
  const threshold = cond.value ?? 0;

  switch (cond.operator) {
    case 'above': return val > threshold;
    case 'below': return val < threshold;
    case 'cross_above': return valPrev <= threshold && val > threshold;
    case 'cross_below': return valPrev >= threshold && val < threshold;
    case 'between': return false; // needs extended support
    default: return false;
  }
}

function evalConditions(series: IndicatorSeries, conditions: Condition[], i: number): boolean {
  if (conditions.length === 0) return true;
  return conditions.every(c => evalCondition(series, c, i));
}

function computeMetrics(
  trades: Trade[],
  equity: EquityPoint[],
  initialCapital: number
): BacktestMetrics {
  const totalTrades = trades.length;
  if (totalTrades === 0 || equity.length === 0) {
    return {
      totalReturn: 0, annualizedReturn: 0, sharpe: 0, sortino: 0,
      maxDrawdown: 0, winRate: 0, profitFactor: 0, avgWin: 0,
      avgLoss: 0, totalTrades: 0, avgHoldingDays: 0, calmarRatio: 0,
    };
  }

  const finalEquity = equity[equity.length - 1].equity;
  const totalReturn = (finalEquity - initialCapital) / initialCapital * 100;

  const startTime = equity[0].time;
  const endTime = equity[equity.length - 1].time;
  const years = (endTime - startTime) / (365.25 * 24 * 3600);
  const annualizedReturn = years > 0
    ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100
    : totalReturn;

  // Daily returns for Sharpe/Sortino
  const dailyReturns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    dailyReturns.push((equity[i].equity - equity[i - 1].equity) / equity[i - 1].equity);
  }
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (dailyReturns.length || 1);
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

  const downsideReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = downsideReturns.reduce((a, b) => a + b * b, 0) / (downsideReturns.length || 1);
  const downsideStd = Math.sqrt(downsideVariance);
  const sortino = downsideStd > 0 ? (meanReturn / downsideStd) * Math.sqrt(252) : 0;

  // Max drawdown
  let peak = equity[0].equity;
  let maxDrawdown = 0;
  for (const pt of equity) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = (peak - pt.equity) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl <= 0);
  const winRate = (winners.length / totalTrades) * 100;
  const avgWin = winners.length > 0
    ? winners.reduce((a, t) => a + t.pnlPct, 0) / winners.length
    : 0;
  const avgLoss = losers.length > 0
    ? losers.reduce((a, t) => a + t.pnlPct, 0) / losers.length
    : 0;

  const grossProfit = winners.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgHoldingDays = trades.reduce((a, t) => a + (t.exitTime - t.entryTime) / (24 * 3600), 0) / totalTrades;
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  return {
    totalReturn, annualizedReturn, sharpe, sortino, maxDrawdown,
    winRate, profitFactor, avgWin, avgLoss, totalTrades, avgHoldingDays, calmarRatio,
  };
}

export function runBacktest(candles: OHLCV[], config: StrategyConfig): BacktestResult {
  const allConds = [
    ...config.entryConditions,
    ...config.filterConditions,
    ...config.exitConditions,
  ];
  const series = preComputeIndicators(candles, allConds);

  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  let capital = config.initialCapital;

  type Position = {
    entryTime: number;
    entryPrice: number;
    size: number;
    stopLossPrice: number;
    tp1Price: number;
    tp2Price: number;
    tp1Hit: boolean;
    trailingHigh: number;
    side: 'long';
  };
  let position: Position | null = null;

  equity.push({ time: candles[0].time, equity: capital });

  for (let i = 1; i < candles.length; i++) {
    const bar = candles[i];

    if (position) {
      // Check SL
      const slHit = bar.low <= position.stopLossPrice;
      const exitSLPrice = position.stopLossPrice;

      // Check TP2
      const tp2Hit = bar.high >= position.tp2Price;
      const tp1Hit = !position.tp1Hit && bar.high >= position.tp1Price;

      // Check exit signal
      const exitSignal = evalConditions(series, config.exitConditions, i);

      // Update trailing stop if trailing enabled and TP1 hit
      if (config.takeProfit.trailing && position.tp1Hit) {
        if (bar.high > position.trailingHigh) {
          position.trailingHigh = bar.high;
          // trail SL to (trailingHigh * (1 - stopLoss%))
          const newSL = position.trailingHigh * (1 - config.stopLoss / 100);
          if (newSL > position.stopLossPrice) position.stopLossPrice = newSL;
        }
      }

      let exitPrice: number | null = null;
      let exitReason: Trade['exitReason'] = 'Signal';

      if (slHit) {
        exitPrice = exitSLPrice;
        exitReason = 'SL';
      } else if (tp1Hit && !tp2Hit) {
        // Close 50% at TP1
        position.tp1Hit = true;
        const halfSize = position.size * 0.5;
        const pnl = (position.tp1Price - position.entryPrice) * halfSize;
        const pnlPct = (position.tp1Price / position.entryPrice - 1) * 100;
        capital += pnl;
        trades.push({
          entryTime: position.entryTime,
          exitTime: bar.time,
          entryPrice: position.entryPrice,
          exitPrice: position.tp1Price,
          side: 'long',
          size: halfSize,
          pnl,
          pnlPct,
          exitReason: 'TP1',
          drawdown: 0,
        });
        position.size = position.size - halfSize;
        equity.push({ time: bar.time, equity: capital });
        continue;
      } else if (tp2Hit) {
        exitPrice = position.tp2Price;
        exitReason = 'TP2';
      } else if (exitSignal) {
        exitPrice = bar.close;
        exitReason = 'Signal';
      }

      if (exitPrice !== null) {
        const pnl = (exitPrice - position.entryPrice) * position.size;
        const pnlPct = (exitPrice / position.entryPrice - 1) * 100;
        capital += pnl;
        trades.push({
          entryTime: position.entryTime,
          exitTime: bar.time,
          entryPrice: position.entryPrice,
          exitPrice,
          side: 'long',
          size: position.size,
          pnl,
          pnlPct,
          exitReason,
          drawdown: Math.min(0, pnlPct),
        });
        position = null;
        equity.push({ time: bar.time, equity: capital });
      } else {
        equity.push({ time: bar.time, equity: capital + (bar.close - position.entryPrice) * position.size });
      }
    } else {
      // Check entry
      const entryOk = evalConditions(series, config.entryConditions, i);
      const filterOk = evalConditions(series, config.filterConditions, i);

      if (entryOk && filterOk) {
        const entryPrice = bar.close;
        const slPrice = entryPrice * (1 - config.stopLoss / 100);
        const tp1Price = entryPrice * (1 + config.takeProfit.tp1Pct / 100);
        const tp2Price = entryPrice * (1 + config.takeProfit.tp2Pct / 100);

        let size: number;
        if (config.positionSizing.mode === 'fixed_risk') {
          const riskAmount = capital * (config.positionSizing.riskPct / 100);
          const riskPerShare = entryPrice - slPrice;
          size = riskPerShare > 0 ? riskAmount / riskPerShare : 0;
        } else {
          size = (capital * (config.positionSizing.riskPct / 100)) / entryPrice;
        }

        if (size > 0) {
          position = {
            entryTime: bar.time,
            entryPrice,
            size,
            stopLossPrice: slPrice,
            tp1Price,
            tp2Price,
            tp1Hit: false,
            trailingHigh: entryPrice,
            side: 'long',
          };
        }
        equity.push({ time: bar.time, equity: capital });
      } else {
        equity.push({ time: bar.time, equity: capital });
      }
    }
  }

  // Close open position at end
  if (position && candles.length > 0) {
    const lastBar = candles[candles.length - 1];
    const exitPrice = lastBar.close;
    const pnl = (exitPrice - position.entryPrice) * position.size;
    const pnlPct = (exitPrice / position.entryPrice - 1) * 100;
    capital += pnl;
    trades.push({
      entryTime: position.entryTime,
      exitTime: lastBar.time,
      entryPrice: position.entryPrice,
      exitPrice,
      side: 'long',
      size: position.size,
      pnl,
      pnlPct,
      exitReason: 'End',
      drawdown: Math.min(0, pnlPct),
    });
    equity[equity.length - 1] = { time: lastBar.time, equity: capital };
  }

  const metrics = computeMetrics(trades, equity, config.initialCapital);

  return { trades, equity, metrics };
}
