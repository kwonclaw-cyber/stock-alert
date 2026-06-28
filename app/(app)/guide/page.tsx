"use client";

import PageHelp from "../../components/PageHelp";

type Topic = {
  icon: string;
  title: string;
  accent: string; // 좌측 강조색
  highlight: string; // 핵심 한 줄
  points: string[];
};

const TOPICS: Topic[] = [
  {
    icon: "📊", title: "스텟", accent: "border-l-sky-400",
    highlight: "회피율·공격속도는 최대 40까지만 적용돼요.",
    points: [
      "잠재·재련·방어구 주문서·부적·영단으로 올리는 능력치.",
      "회피·공속은 40을 넘겨도 40까지만 적용 → 40에 딱 맞추는 게 효율적.",
    ],
  },
  {
    icon: "🧬", title: "내공", accent: "border-l-amber-400",
    highlight: "PVE에서 내공이 요구치보다 5 이상 낮으면 데미지가 0이에요.",
    points: [
      "PVP: 상대보다 내공이 높으면 받는 데미지 감소.",
      "올리는 법: 높은 등급 장비 · 재련 · 주문서(투구/벨트) · 부적 · 반지 강화 · 영단.",
    ],
  },
  {
    icon: "🎲", title: "잠재능력", accent: "border-l-fuchsia-400",
    highlight: "리롤은 ‘우클릭’으로 하세요.",
    points: [
      "방어구 부위별 추가 능력치, 한 장비에 최대 3줄.",
      "줄당 최대: 회피 4 · 공속 4 · 운 6. 상옵 뜨면 물어보고 킵.",
      "잠재는 장비를 이전해도 유지돼요(주문서와 다름).",
    ],
  },
  {
    icon: "📜", title: "주문서", accent: "border-l-emerald-400",
    highlight: "장비를 이전하면 주문서 효과는 사라져요.",
    points: [
      "부위별 3~5회 시도. 낮은 확률 주문서엔 특수 스탯이 함께 붙음.",
      "초반엔 체력 100%작 → 중후반엔 내공 붙는 머리·벨트 위주 10%작.",
      "신발은 회피/공속 40캡에 맞춰 60·100%를 섞어 작업.",
    ],
  },
  {
    icon: "🪬", title: "부적", accent: "border-l-rose-400",
    highlight: "하루 6개 한도 — 한 번 놓치면 따라잡기 어려워요.",
    points: [
      "하루 6개(인게임 3 + API 티켓 3), 옵션 겹치지 않게 3개 장착.",
      "강화: 일반 재료 10exp, 레벨업당 일반10/고급20/희귀30, 최대 10레벨.",
      "조합: 같은 등급 10레벨 2개 + 부적석 → 상위 1개(랜덤·리롤).",
    ],
  },
  {
    icon: "💠", title: "영단 (추가 내실)", accent: "border-l-teal-400",
    highlight: "무인의 거처 대신 생긴 추가 내실 시스템이에요.",
    points: [
      "레이드·사냥·제작·탐험·퀘스트 등으로 획득, 0~10레벨.",
      "테크를 선택할 수 있어요 — 자세한 효과·획득처는 ‘영단’ 탭 참고.",
    ],
  },
  {
    icon: "👑", title: "보스 루팅", accent: "border-l-yellow-400",
    highlight: "서버 접속 후 바로 이동하지 마세요.",
    points: [
      "딜 1등 개인에게 우선 루팅권 → 10초 후 누구나.",
      "그 다음은 ‘채널에 먼저 접속한 순서’로 먹혀요 → 접속 후 이동 X.",
    ],
  },
  {
    icon: "⚠️", title: "보스 주의사항", accent: "border-l-red-400",
    highlight: "인벤·퀵슬롯 비우고, /스폰은 미리 복사.",
    points: [
      "사망 시 귀속 아이템 빼고 전부 떨어짐 → 인벤 비우고 입장.",
      "먹은 아이템은 퀵슬롯에 먼저 들어옴 → 퀵슬롯 비우고 수시 확인.",
      "/스폰 명령어를 미리 복사해두면 급할 때 편해요.",
    ],
  },
  {
    icon: "⛏️", title: "광산", accent: "border-l-orange-400",
    highlight: "전초기지를 세우면 파밍 동선이 편해져요.",
    points: [
      "활성석은 쿨타임이 있어 여러 광산을 돌며 캠.",
      "전초기지: 제한 없이 이동(이동 시 500원). 자세한 동선은 ‘광산&채집 타이머’ 탭.",
    ],
  },
  {
    icon: "🍶", title: "양조장", accent: "border-l-lime-400",
    highlight: "항아리를 든 채로는 스킬을 쓸 수 없어요.",
    points: [
      "농장에서 항아리를 들고 양조장에 넣으면 포션 재료로 가공돼요.",
      "약탈 가능 · 항아리는 자유롭게 내려놓고 다시 들 수 있어요.",
    ],
  },
];

const SUMMARY = [
  { emoji: "📊🧬", title: "스텟·내공", sub: "40캡 / 내공" },
  { emoji: "🎲📜", title: "잠재·주문서", sub: "리롤·내공작" },
  { emoji: "🪬💠", title: "부적·영단", sub: "매일·테크" },
  { emoji: "👑⚠️", title: "보스", sub: "접속순·인벤" },
  { emoji: "⛏️🍶", title: "광산·양조장", sub: "전초·항아리" },
];

// 한 장 요약 포스터(밝은 인포그래픽). border엔 테두리+배경, num/callout은 배경색을 담는다.
type PCard = { title: string; emojis: string; hl: string; points: string[]; point: string; border: string; num: string; callout: string };
const POSTER: PCard[] = [
  { title: "스텟", emojis: "📊⚔️🛡️", hl: "회피·공속은 최대 40까지만 적용", points: ["잠재·재련·주문서·부적·영단으로 올림", "40 넘겨도 40까지만 → 딱 맞추기"], point: "회피·공속 40 맞추기", border: "border-amber-300 bg-amber-50", num: "bg-amber-500", callout: "bg-amber-100" },
  { title: "내공", emojis: "🧬💪", hl: "PVE 요구치보다 5↓이면 데미지 0", points: ["PVP: 내공 높으면 받는 데미지 ↓", "장비·재련·주문서·부적·반지·영단"], point: "내공 먼저 확보", border: "border-emerald-300 bg-emerald-50", num: "bg-emerald-500", callout: "bg-emerald-100" },
  { title: "잠재능력", emojis: "🎲🔁", hl: "리롤은 ‘우클릭’", points: ["부위별 최대 3줄 (회피4·공속4·운6)", "장비 이전해도 유지됨"], point: "상옵 뜨면 킵!", border: "border-sky-300 bg-sky-50", num: "bg-sky-500", callout: "bg-sky-100" },
  { title: "주문서", emojis: "📜✨", hl: "장비 이전하면 사라짐", points: ["초반 체력 100%작 → 중후반 내공 머리·벨트 10%작", "신발은 40캡 맞춰 60·100% 혼합"], point: "머리·벨트 내공작", border: "border-purple-300 bg-purple-50", num: "bg-purple-500", callout: "bg-purple-100" },
  { title: "부적", emojis: "🪬📅", hl: "하루 6개 한도 — 놓치면 못 따라감", points: ["3개 장착(옵션 겹침 X)", "조합: 10레벨 2개 + 부적석 → 상위"], point: "매일 6개 챙기기", border: "border-rose-300 bg-rose-50", num: "bg-rose-500", callout: "bg-rose-100" },
  { title: "영단", emojis: "💠🌿", hl: "무인의 거처 대신 생긴 추가 내실", points: ["레이드·사냥·제작·탐험·퀘로 획득", "테크 선택 가능 (0~10레벨)"], point: "‘영단’ 탭 참고", border: "border-teal-300 bg-teal-50", num: "bg-teal-500", callout: "bg-teal-100" },
  { title: "보스 루팅", emojis: "👑🥇", hl: "접속 후 바로 이동하지 말기", points: ["딜 1등 우선 → 10초 후 누구나", "그다음 ‘채널 접속 순서’로 먹힘"], point: "접속 순서 = 루팅", border: "border-yellow-300 bg-yellow-50", num: "bg-yellow-500", callout: "bg-yellow-100" },
  { title: "보스 주의", emojis: "⚠️🎒", hl: "인벤·퀵슬롯 비우고 /스폰 복붙", points: ["사망 시 귀속 빼고 다 떨어짐", "먹은 템은 퀵슬롯에 먼저 들어옴"], point: "인벤 비우고 입장", border: "border-red-300 bg-red-50", num: "bg-red-500", callout: "bg-red-100" },
  { title: "광산", emojis: "⛏️🏯", hl: "전초기지 세우면 동선 편함", points: ["활성석 쿨타임 → 여러 광산 순회", "전초기지 이동 500원"], point: "전초 짓고 순회", border: "border-orange-300 bg-orange-50", num: "bg-orange-500", callout: "bg-orange-100" },
  { title: "양조장", emojis: "🍶🏺", hl: "항아리 든 채로는 스킬 사용 불가", points: ["농장 항아리 → 양조장에서 포션 재료", "약탈 가능 · 내려놓고 다시 들 수 있음"], point: "항아리 운반 주의", border: "border-lime-300 bg-lime-50", num: "bg-lime-500", callout: "bg-lime-100" },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Nanum+Pen+Script&display=swap" />
      <PageHelp>
        서버 들어가기 전에 <b>가볍게 한 번 훑어보면 좋은 자료</b>예요. 외울 필요는 없고 “이런 게 있구나” 정도면 충분해요. (총겜동 내수서버)
      </PageHelp>

      <div className="mb-6 rounded-xl border border-white/10 bg-gradient-to-b from-emerald-400/[0.06] to-transparent p-5 text-center">
        <div className="text-2xl">⚔️</div>
        <h1 className="mt-1 text-lg font-bold text-white/90">들어가기 전에 미리 공부하고 가자</h1>
        <p className="mt-1 text-sm text-white/55">지난 코창서버 내용과 질추님 오피셜들을 통해 미리 익혀두면 첫날이 훨씬 수월해요.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOPICS.map((t) => (
          <section key={t.title} className={`rounded-xl border border-white/10 ${t.accent} border-l-4 bg-[#15171c] p-4`}>
            <h2 className="flex items-center gap-2 text-base font-bold text-white/90">
              <span className="text-lg">{t.icon}</span>{t.title}
            </h2>
            <p className="mt-1.5 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-amber-200/90">
              💡 {t.highlight}
            </p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-white/75">
              {t.points.map((p, i) => (
                <li key={i} className="flex gap-1.5"><span className="text-white/25">·</span><span>{p}</span></li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* 한 장 요약 포스터 (밝은 인포그래픽) */}
      <section className="mt-8 rounded-2xl bg-[#fdfbf5] p-5 text-gray-800 sm:p-7" style={{ fontFamily: "'Gaegu', system-ui, sans-serif" }}>
        <h2
          className="flex items-center justify-center gap-3 whitespace-nowrap text-center leading-none text-gray-800"
          style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: "clamp(26px, 6vw, 50px)" }}
        >
          <span className="text-amber-400">✦</span> 들어가기 전에 공부하고 가자 <span className="text-amber-400">✦</span>
        </h2>
        <p className="mt-1 text-center text-sm text-gray-500 sm:text-lg">총겜동 내수서버 · 한 장 요약 ⚔️</p>
        <div className="mx-auto mt-3 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/70 px-4 py-2.5 text-center text-sm font-bold sm:text-lg">
          핵심은 <span className="text-rose-500">스텟·내공</span>, <span className="text-blue-500">잠재·주문서</span>, <span className="text-emerald-600">부적·영단</span>, <span className="text-amber-600">보스(루팅·주의)</span>, <span className="text-violet-600">광산·양조장</span> 체크!
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {POSTER.map((c, i) => (
            <div key={c.title} className={`rounded-2xl border-[3px] ${c.border} p-4`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${c.num}`}>{i + 1}</span>
                <span className="text-lg font-extrabold text-gray-800">{c.title}</span>
                <span className="ml-auto text-lg">{c.emojis}</span>
              </div>
              <p className="mt-2 inline-block rounded-md bg-yellow-200/80 px-2 py-1 text-sm font-bold text-gray-800">💡 {c.hl}</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {c.points.map((p, j) => (
                  <li key={j} className="flex gap-1.5"><span className="font-bold text-green-600">✓</span><span>{p}</span></li>
                ))}
              </ul>
              <div className={`mt-2 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-800 ${c.callout}`}>→ 포인트 · {c.point}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border-2 border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-2xl text-fuchsia-500" style={{ fontFamily: "'Nanum Pen Script', cursive" }}>✦ 핵심 체크포인트</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SUMMARY.map((s) => (
              <div key={s.title} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
                <div className="text-xl">{s.emoji}</div>
                <div className="mt-1 text-sm font-bold text-gray-800">{s.title}</div>
                <div className="text-xs text-gray-500">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">⚔️ 총겜동 내수서버 · 서버 시작 전 한 장 요약</p>
      </section>

      <p className="mt-6 text-center text-xs text-white/30">더 자세한 건 부적·영단·광산&채집 타이머 탭에서 볼 수 있어요. (자료: 총겜동 내수서버)</p>
    </div>
  );
}
