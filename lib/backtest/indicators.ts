import { OHLCV } from './types';

export function ema(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  // seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function sma(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result[i] = sum / period;
  }
  return result;
}

export function rsi(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  if (data.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    result[period] = 100 - 100 / (1 + avgGain / avgLoss);
  }

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      result[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return result;
}

export function macd(
  data: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: number; signal: number; histogram: number }[] {
  const result = data.map(() => ({ macd: NaN, signal: NaN, histogram: NaN }));
  const fastEma = ema(data, fast);
  const slowEma = ema(data, slow);
  const macdLine: number[] = data.map((_, i) => fastEma[i] - slowEma[i]);

  // signal EMA on macdLine (skip NaN prefix)
  const firstValid = slow - 1;
  const macdValid = macdLine.slice(firstValid);
  const signalLine = ema(macdValid, signalPeriod);

  for (let i = 0; i < macdValid.length; i++) {
    const idx = firstValid + i;
    if (!isNaN(macdLine[idx]) && !isNaN(signalLine[i])) {
      result[idx].macd = macdLine[idx];
      result[idx].signal = signalLine[i];
      result[idx].histogram = macdLine[idx] - signalLine[i];
    }
  }
  return result;
}

export function bollingerBands(
  data: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number }[] {
  const result = data.map(() => ({ upper: NaN, middle: NaN, lower: NaN }));
  const mid = sma(data, period);
  for (let i = period - 1; i < data.length; i++) {
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += Math.pow(data[j] - mid[i], 2);
    }
    const sd = Math.sqrt(variance / period);
    result[i] = {
      upper: mid[i] + stdDev * sd,
      middle: mid[i],
      lower: mid[i] - stdDev * sd,
    };
  }
  return result;
}

export function atr(candles: OHLCV[], period = 14): number[] {
  const result = new Array(candles.length).fill(NaN);
  if (candles.length < 2) return result;

  const trueRanges: number[] = [NaN];
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    trueRanges.push(Math.max(hl, hc, lc));
  }

  // seed ATR with SMA of first `period` TRs
  if (candles.length <= period) return result;
  let sumTr = 0;
  for (let i = 1; i <= period; i++) sumTr += trueRanges[i];
  result[period] = sumTr / period;

  for (let i = period + 1; i < candles.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + trueRanges[i]) / period;
  }
  return result;
}

export function vwap(candles: OHLCV[]): number[] {
  const result = new Array(candles.length).fill(NaN);
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumPV += typicalPrice * candles[i].volume;
    cumVol += candles[i].volume;
    result[i] = cumVol > 0 ? cumPV / cumVol : NaN;
  }
  return result;
}
