export interface OHLCV {
  time: number; // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Condition {
  indicator: 'EMA' | 'RSI' | 'MACD' | 'BB' | 'ATR' | 'PRICE';
  params: Record<string, number>;
  operator: 'above' | 'below' | 'cross_above' | 'cross_below' | 'between';
  value?: number;
  compareIndicator?: string;
}

export interface TakeProfit {
  tp1Pct: number;
  tp2Pct: number;
  trailing: boolean;
}

export interface PositionSizing {
  mode: 'fixed_risk' | 'fixed_pct';
  riskPct: number;
}

export interface StrategyConfig {
  asset: string;
  market: 'KR' | 'US' | 'CRYPTO' | 'FX' | 'INDEX';
  timeframe: '1h' | '4h' | '1d' | '1w';
  startDate: string; // ISO date string
  endDate: string;
  initialCapital: number;
  entryConditions: Condition[];
  filterConditions: Condition[];
  exitConditions: Condition[];
  stopLoss: number; // percent
  takeProfit: TakeProfit;
  positionSizing: PositionSizing;
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  side: 'long' | 'short';
  size: number;
  pnl: number;
  pnlPct: number;
  exitReason: 'SL' | 'TP1' | 'TP2' | 'Signal' | 'End';
  drawdown: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  avgHoldingDays: number;
  calmarRatio: number;
}

export interface BacktestResult {
  trades: Trade[];
  equity: EquityPoint[];
  metrics: BacktestMetrics;
}
