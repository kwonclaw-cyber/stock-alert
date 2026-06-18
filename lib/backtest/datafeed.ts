import { OHLCV, StrategyConfig } from './types';

function intervalToYahoo(tf: string): string {
  switch (tf) {
    case '1h': return '1h';
    case '4h': return '1h'; // fetch 1h, aggregate
    case '1d': return '1d';
    case '1w': return '1wk';
    default: return '1d';
  }
}

function intervalToBinance(tf: string): string {
  switch (tf) {
    case '1h': return '1h';
    case '4h': return '4h';
    case '1d': return '1d';
    case '1w': return '1w';
    default: return '1d';
  }
}

function aggregate4h(candles: OHLCV[]): OHLCV[] {
  const result: OHLCV[] = [];
  for (let i = 0; i + 3 < candles.length; i += 4) {
    const chunk = candles.slice(i, i + 4);
    result.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[3].close,
      volume: chunk.reduce((a, c) => a + c.volume, 0),
    });
  }
  return result;
}

export async function fetchYahooFinance(
  symbol: string,
  interval: string,
  start: Date,
  end: Date
): Promise<OHLCV[]> {
  const yahooInterval = intervalToYahoo(interval);
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000);
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yahooInterval}&period1=${period1}&period2=${period2}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);

  const data = await res.json();
  const chart = data?.chart?.result?.[0];
  if (!chart) throw new Error('No data from Yahoo Finance');

  const timestamps: number[] = chart.timestamp ?? [];
  const ohlcv = chart.indicators?.quote?.[0];
  if (!ohlcv) throw new Error('No OHLCV data from Yahoo Finance');

  const candles: OHLCV[] = timestamps.map((t, i) => ({
    time: t,
    open: ohlcv.open[i] ?? NaN,
    high: ohlcv.high[i] ?? NaN,
    low: ohlcv.low[i] ?? NaN,
    close: ohlcv.close[i] ?? NaN,
    volume: ohlcv.volume[i] ?? 0,
  })).filter(c => !isNaN(c.close));

  if (interval === '4h') return aggregate4h(candles);
  return candles;
}

export async function fetchBinance(
  symbol: string,
  interval: string,
  start: Date,
  end: Date
): Promise<OHLCV[]> {
  const binanceInterval = intervalToBinance(interval);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&startTime=${startMs}&endTime=${endMs}&limit=1000`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance error: ${res.status}`);

  const data: number[][] = await res.json();
  return data.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }));
}

export async function fetchTossInvest(
  symbol: string,
  interval: string,
  start: Date,
  end: Date
): Promise<OHLCV[]> {
  const apiKey = process.env.TOSS_INVEST_API_KEY;
  if (!apiKey) throw new Error('TOSS_INVEST_API_KEY not set');

  const url = `https://openapi.tossinvest.com/v1/market/candles?symbol=${symbol}&interval=${interval}&from=${start.toISOString()}&to=${end.toISOString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Toss Invest error: ${res.status}`);

  const data = await res.json();
  const candles = data?.candles ?? data?.data ?? [];
  return candles.map((c: Record<string, unknown>) => ({
    time: typeof c.time === 'number' ? c.time : Math.floor(new Date(String(c.date ?? c.datetime ?? c.time)).getTime() / 1000),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume ?? 0),
  }));
}

export async function fetchOHLCV(config: StrategyConfig): Promise<OHLCV[]> {
  const start = new Date(config.startDate);
  const end = new Date(config.endDate);

  switch (config.market) {
    case 'KR':
      return fetchTossInvest(config.asset, config.timeframe, start, end);
    case 'CRYPTO':
      return fetchBinance(config.asset, config.timeframe, start, end);
    case 'US':
    case 'INDEX':
    case 'FX':
    default:
      return fetchYahooFinance(config.asset, config.timeframe, start, end);
  }
}
