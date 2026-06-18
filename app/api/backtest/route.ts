import { NextRequest, NextResponse } from 'next/server';
import { fetchOHLCV } from '@/lib/backtest/datafeed';
import { runBacktest } from '@/lib/backtest/engine';
import { StrategyConfig } from '@/lib/backtest/types';

export async function POST(req: NextRequest) {
  try {
    const config: StrategyConfig = await req.json();

    if (!config.asset || !config.market || !config.timeframe) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const candles = await fetchOHLCV(config);
    if (!candles || candles.length < 50) {
      return NextResponse.json({ error: '데이터가 부족합니다. 기간을 늘려주세요.' }, { status: 400 });
    }

    const result = runBacktest(candles, config);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
