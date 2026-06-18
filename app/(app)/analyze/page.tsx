'use client';

import { useState, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'textarea' | 'select';

interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
}

interface Template {
  id: string;
  title: string;
  icon: string;
  fields: Field[];
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: 'backtest',
    title: '백테스트 방법론 분석',
    icon: '📊',
    fields: [
      { key: 'strategy', label: '전략 규칙', type: 'textarea', placeholder: '20일 이동평균 돌파 시 매수' },
      { key: 'asset', label: '자산', type: 'text', placeholder: 'KOSPI 200' },
      { key: 'timeframe', label: '시간 프레임', type: 'text', placeholder: '일봉' },
      { key: 'period', label: '백테스트 기간', type: 'text', placeholder: '2020-2024' },
    ],
  },
  {
    id: 'plan',
    title: '트레이딩 플랜 빌더',
    icon: '📋',
    fields: [
      { key: 'idea', label: '내 아이디어', type: 'textarea', placeholder: '아침 9시 갭 상승 종목 매수' },
      { key: 'riskPct', label: '리스크 %', type: 'text', placeholder: '1' },
      { key: 'maxDailyLoss', label: '일일 최대 손실', type: 'text', placeholder: '3%' },
    ],
  },
  {
    id: 'ma',
    title: '이동평균 전략 설계',
    icon: '📈',
    fields: [
      { key: 'asset', label: '자산', type: 'text', placeholder: '삼성전자' },
      { key: 'timeframe', label: '시간 프레임', type: 'text', placeholder: '60분봉' },
      {
        key: 'style',
        label: '매매 스타일',
        type: 'select',
        options: ['스캘핑', '데이트레이딩', '스윙', '장기투자'],
        placeholder: '스윙',
      },
      {
        key: 'risk',
        label: '위험 성향',
        type: 'select',
        options: ['낮음', '중간', '높음'],
        placeholder: '중간',
      },
    ],
  },
  {
    id: 'rsi',
    title: 'RSI 전략 설계',
    icon: '📉',
    fields: [
      { key: 'asset', label: '자산', type: 'text', placeholder: '비트코인' },
      { key: 'timeframe', label: '시간 프레임', type: 'text', placeholder: '4시간봉' },
      {
        key: 'direction',
        label: '거래 방향',
        type: 'select',
        options: ['롱전용', '숏전용', '양방향'],
        placeholder: '양방향',
      },
      {
        key: 'marketEnv',
        label: '시장 환경',
        type: 'select',
        options: ['추세장', '횡보장', '고변동성'],
        placeholder: '횡보장',
      },
    ],
  },
  {
    id: 'compare',
    title: '전략 A vs B 비교',
    icon: '⚖️',
    fields: [
      { key: 'strategyA_name', label: '전략 A 이름', type: 'text', placeholder: '골든크로스' },
      { key: 'strategyA_rules', label: '전략 A 규칙', type: 'textarea', placeholder: '50일 MA가 200일 MA 상향 돌파' },
      { key: 'strategyB_name', label: '전략 B 이름', type: 'text', placeholder: 'RSI 역추세' },
      { key: 'strategyB_rules', label: '전략 B 규칙', type: 'textarea', placeholder: 'RSI 30 이하 진입, 70 이상 청산' },
    ],
  },
  {
    id: 'pattern',
    title: '패턴 시스템화',
    icon: '🔍',
    fields: [
      { key: 'pattern', label: '관찰 내용', type: 'textarea', placeholder: '월요일 오전 급등 후 오후에 반드시 조정' },
      { key: 'asset', label: '자산', type: 'text', placeholder: '나스닥' },
      { key: 'timeframe', label: '시간 프레임', type: 'text', placeholder: '15분봉' },
      { key: 'marketEnv', label: '시장 환경', type: 'text', placeholder: '추세장' },
    ],
  },
  {
    id: 'diagnose',
    title: '손실 전략 진단',
    icon: '🔧',
    fields: [
      { key: 'asset_tf', label: '자산/시간프레임', type: 'text', placeholder: 'KOSPI/일봉' },
      { key: 'strategy_rules', label: '전략 규칙', type: 'textarea', placeholder: 'RSI 30 이하 매수, 70 이상 매도' },
      { key: 'trades_total', label: '총 거래 수', type: 'text', placeholder: '50' },
      { key: 'win_rate', label: '승률 %', type: 'text', placeholder: '42' },
      { key: 'avg_win', label: '평균 수익', type: 'text', placeholder: '2.1%' },
      { key: 'avg_loss', label: '평균 손실', type: 'text', placeholder: '1.8%' },
      { key: 'max_dd', label: '최대 낙폭 %', type: 'text', placeholder: '15' },
      { key: 'profit_factor', label: 'Profit Factor', type: 'text', placeholder: '0.85' },
      { key: 'notes', label: '관찰 메모', type: 'textarea', placeholder: '횡보장에서 특히 손실' },
    ],
  },
  {
    id: 'psychology',
    title: '트레이더 심리 코칭',
    icon: '🧠',
    fields: [
      { key: 'period', label: '기간', type: 'text', placeholder: '2024년 1분기' },
      { key: 'total_trades', label: '총 거래 수', type: 'text', placeholder: '45' },
      { key: 'win_rate', label: '승률 %', type: 'text', placeholder: '48' },
      { key: 'avg_win', label: '평균 수익', type: 'text', placeholder: '2.3%' },
      { key: 'avg_loss', label: '평균 손실', type: 'text', placeholder: '1.9%' },
      { key: 'best_trade', label: '최고 거래', type: 'text', placeholder: '+8%' },
      { key: 'worst_trade', label: '최악 거래', type: 'text', placeholder: '-5%' },
      { key: 'mistakes', label: '반복 실수', type: 'text', placeholder: 'FOMO, 조기청산' },
      { key: 'strategy', label: '전략', type: 'text', placeholder: '이동평균 크로스오버' },
    ],
  },
];

// ─── Markdown renderer ───────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // ## headers
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="text-lg font-bold text-white mt-4 mb-1">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={i} className="text-xl font-bold text-emerald-400 mt-4 mb-1">
          {line.slice(2)}
        </h2>
      );
    }
    // bullet points
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return (
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-emerald-400 mt-0.5">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    }
    // numbered list
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-emerald-400 min-w-[1.5rem]">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
    }
    // empty line
    if (line.trim() === '') return <div key={i} className="h-2" />;
    // normal line
    return <p key={i}>{renderInline(line)}</p>;
  });
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const [selectedId, setSelectedId] = useState<string>(TEMPLATES[0].id);
  const [params, setParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);

  const selected = TEMPLATES.find(t => t.id === selectedId)!;

  function handleSelect(id: string) {
    setSelectedId(id);
    setParams({});
    setResponse('');
    setError(null);
  }

  function setParam(key: string, value: string) {
    setParams(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResponse('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedId, params }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '알 수 없는 오류' }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setResponse(prev => prev + chunk);
        // auto-scroll
        if (responseRef.current) {
          responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Left panel: template selector ── */}
      <aside className="w-[280px] shrink-0 border-r border-white/10 overflow-y-auto bg-black/20 p-3 space-y-1.5">
        <p className="px-2 pb-1 text-xs text-white/40 font-medium uppercase tracking-wide">분석 템플릿</p>
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => handleSelect(t.id)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
              selectedId === t.id
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                : 'border border-transparent text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="leading-tight">{t.title}</span>
          </button>
        ))}
      </aside>

      {/* ── Right panel ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>{selected.icon}</span>
            <span>{selected.title}</span>
          </h1>
          <p className="text-sm text-white/40 mt-0.5">필드를 채우고 분석을 시작하세요.</p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          {selected.fields.map(field => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-medium text-white/60">{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={params[field.key] ?? ''}
                  onChange={e => setParam(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none resize-none"
                />
              ) : field.type === 'select' ? (
                <select
                  value={params[field.key] ?? field.options![0]}
                  onChange={e => setParam(field.key, e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                >
                  {field.options!.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={params[field.key] ?? ''}
                  onChange={e => setParam(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none"
                />
              )}
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white transition"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                분석 중...
              </span>
            ) : '🤖 분석 시작'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error.includes('ANTHROPIC_API_KEY') ? (
              <span>ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. .env.local 파일에 추가해주세요.</span>
            ) : (
              error
            )}
          </div>
        )}

        {/* Response */}
        {(response || loading) && (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
              <span className="text-xs text-white/50 font-medium">AI 분석 결과</span>
              {response && !loading && (
                <button
                  onClick={handleCopy}
                  className="text-xs text-white/40 hover:text-white transition px-2 py-1 rounded hover:bg-white/10"
                >
                  {copied ? '✓ 복사됨' : '복사'}
                </button>
              )}
            </div>
            <div
              ref={responseRef}
              className="bg-black/30 p-4 max-h-[60vh] overflow-y-auto font-mono text-sm text-white/85 leading-relaxed space-y-0.5"
            >
              {renderMarkdown(response)}
              {loading && (
                <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
