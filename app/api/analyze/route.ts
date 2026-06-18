import { NextRequest } from 'next/server';

const SYSTEM_PROMPT =
  '당신은 10년 경력의 퀀트 트레이딩 전문가입니다. 한국어로 답변하세요. 숫자와 구체적인 규칙으로만 답변하세요.';

const TEMPLATES: Record<string, string> = {
  backtest: `역할: 당신은 10년 경력의 퀀트 트레이딩 애널리스트입니다.

전략: {strategy}
자산: {asset}
시간 프레임: {timeframe}
백테스트 기간: {period}

다음을 분석해주세요:
1. 전략 개요: 이 전략이 작동하는 시장 논리를 3줄로 설명
2. 백테스트 로직: 신호 발생 → 진입 → 청산까지 단계별 플로우차트
3. 핵심 성과 지표 계산법: 승률, Profit Factor, 기댓값, 최대낙폭, 샤프비율, 칼마비율
4. 수동 기록 거래 로그 표 양식 제시
5. 과최적화(Overfitting) 방지: In-sample/Out-of-sample 분리, Walk-Forward 방법론
6. 이 전략이 실패할 시장 조건과 필터 방법
초보자도 이해할 수 있도록 전문 용어는 괄호 안에 한국어 설명 추가`,

  plan: `역할: 당신은 시스템 트레이딩 설계 전문가이자 트레이딩 코치입니다.

내 아이디어: {idea}
리스크 %: {riskPct}
일일 최대 손실: {maxDailyLoss}

다음을 포함한 완전한 트레이딩 플랜을 만들어주세요:
1. 시장 사전 조건 (큰 그림 추세)
2. 정확한 진입 규칙 (숫자로, 모호한 표현 금지)
3. 정확한 청산 규칙 (시간/지표/가격 기반)
4. 손절 위치와 기술적 근거
5. 익절 전략 (단계별 부분 청산: TP1 50%, TP2 잔여)
6. 포지션 크기 계산 공식: 계좌 × 리스크% ÷ (진입가 - SL) = 수량
7. 일일/주간 최대 거래 수와 최대 손실 한도
8. 저품질 진입 필터
9. 진입 전 10초 체크리스트
10. 거래 후 복기 저널 양식
규칙을 표로 정리하고 예시 거래 1개 포함`,

  ma: `역할: 당신은 이동평균선 전략 전문 퀀트 트레이딩 전략가입니다.

자산: {asset}
시간 프레임: {timeframe}
매매 스타일: {style}
위험 성향: {risk}

다음을 설계해주세요:
1. 이동평균선 조합 선택과 근거 (단기/중기/장기 MA 역할, EMA vs SMA 이유)
2. 매수 조건 (전부 충족 시 진입): 가격조건, 확인신호, 거래량 필터
3. 매도/청산 조건 (기술적/시간기반/트레일링)
4. 손절 규칙 (고정% vs ATR 방식 추천 및 근거)
5. 익절 규칙 (1차 50% 청산 위치, 2차/트레일링)
6. 진입하지 말 것 (MA 수렴 시, 뉴스 전후, 기타 3가지)
7. TradingView에서 30분 수동 백테스트 방법
8. 가짜 신호(Whipsaw) 필터링 3가지
9. 초보자 예시 거래 (각 규칙 적용)
10. 최적 시장 조건 vs 피해야 할 조건
바로 적용 가능한 숫자와 규칙으로 작성`,

  rsi: `역할: 당신은 RSI 기반 전략 전문 기술적 분석 전문가입니다.

자산: {asset}
시간 프레임: {timeframe}
거래 방향: {direction}
시장 환경: {marketEnv}

다음을 설계해주세요:
1. RSI 최적 설정값 (기간, 과매수/과매도 기준선과 근거)
2. 정확한 진입 신호 (과매도 반등형/추세 확인형/다이버전스형 중 선택)
3. 확인 신호 (RSI만으로 진입 금지 — 추가 지표 2개)
4. 신호 무효화 조건
5. 손절 위치 (RSI 기반 + 가격 기반)
6. 익절 목표 (RSI 기반 + 가격 기반)
7. 최소 손익비(RRR) 기준
8. 절대 진입하면 안 되는 상황 5가지
9. RSI 가짜 신호 줄이는 방법 3가지
10. 최종 판단: RSI를 반전 신호로 쓸지 추세 확인 도구로 쓸지`,

  compare: `역할: 당신은 트레이딩 전략 비교 분석 전문가입니다.

전략 A 이름: {strategyA_name}
전략 A 규칙: {strategyA_rules}

전략 B 이름: {strategyB_name}
전략 B 규칙: {strategyB_rules}

다음 기준으로 각 항목 1~10점 평가:
1. 단순성 (규칙 명확성)
2. 손익비 잠재력
3. 예상 승률
4. 낙폭 위험
5. 예상 거래 횟수 (월 평균)
6. 추세장 성과
7. 횡보장 성과
8. 백테스트 난이도

표로 정리하고 종합 점수 제시.
초보자 추천 / 공격적 트레이더 추천 / 두 전략 결합 방법 제시.
각 항목마다 2줄 이상 근거 포함.`,

  pattern: `역할: 당신은 시스템 트레이딩 연구원입니다.

패턴/관찰: {pattern}
자산: {asset}
시간 프레임: {timeframe}
시장 환경: {marketEnv}

주관적 관찰을 검증 가능한 전략으로 변환해주세요:
1. 명확한 가설 수립 (반증 가능한 형태)
2. 정확한 진입 규칙 (측정 가능하게)
3. 정확한 청산 규칙
4. 손절 위치와 근거
5. 익절 목표와 근거
6. 신뢰도 높이는 보조 지표 2~3가지
7. 수동 백테스트 절차 (단계별)
8. 결과 기록 스프레드시트 양식
9. 이 전략이 실패할 수 있는 이유 3가지
10. 통계적 유의성을 위한 최소 거래 수
"이 패턴에 실제 엣지(Edge)가 있는가?" 결론 포함`,

  diagnose: `역할: 당신은 손실 나는 전략을 살리는 전문 트레이딩 멘토입니다.

자산/시간프레임: {asset_tf}
전략 규칙: {strategy_rules}
총 거래 수: {trades_total}
승률: {win_rate}%
평균 수익: {avg_win}
평균 손실: {avg_loss}
최대 낙폭: {max_dd}%
Profit Factor: {profit_factor}
관찰 메모: {notes}

데이터 기반으로 진단해주세요:
1. 근본 문제 진단 (승률/손익비/포지션크기/시장환경 중 주원인 1가지)
2. 손실을 만드는 규칙 찾기
3. 추가 테스트할 필터 3가지
4. 손절 진단 (ATR 기준 적정 범위 제안)
5. 익절 진단 (달성 가능성 평가)
6. 낙폭 절반으로 줄이는 즉시 적용 방법
7. 지금 당장 바꿔야 할 것 1가지
8. 아직 바꾸지 말아야 할 것
9. 개선된 전략 v2.0 (달라진 점 명시)
10. v2.0 검증을 위한 30회 테스트 계획
감이 아닌 숫자로 진단`,

  psychology: `역할: 당신은 트레이더 심리 및 퍼포먼스 전문 코치입니다.

기간: {period}
총 거래 수: {total_trades}
승률: {win_rate}%
평균 수익: {avg_win}
평균 손실: {avg_loss}
최고 거래: {best_trade}
최악 거래: {worst_trade}
반복 실수: {mistakes}
전략: {strategy}

분석해주세요:
1. 가장 큰 강점 (데이터 근거)
2. 가장 큰 약점 (우선 고쳐야 할 패턴)
3. 손실을 가장 많이 만드는 실수 (금액 관점 우선순위)
4. 문제의 근원 진단 (전략/심리/리스크관리 중 주원인)
5. 커스텀 진입 전 10초 점검표
6. 주간 리뷰 템플릿 (일요일 30분)
7. 거래 점수 시스템 (1~10점, 결과가 아닌 과정 평가)
8. 반복 실수 방지 규칙
9. 향후 30일 개선 계획 (주 단위)
"이 트레이더가 6개월 후 수익권 진입 가능한가?" 솔직한 평가 포함`,
};

function buildPrompt(templateId: string, params: Record<string, string>): string {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown template: ${templateId}`);
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let templateId: string;
  let params: Record<string, string>;
  let _prompt: string | undefined;
  try {
    const body = await req.json();
    templateId = body.templateId;
    params = body.params ?? {};
    _prompt = body._prompt; // 직접 프롬프트 전달 허용
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식입니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let prompt: string;
  if (_prompt) {
    prompt = _prompt;
  } else {
    try {
      prompt = buildPrompt(templateId, params);
    } catch (e: unknown) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : '템플릿 오류' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(JSON.stringify({ error: `Anthropic API 오류: ${err}` }), {
      status: anthropicRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(parsed.delta.text));
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
