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

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        서버 들어가기 전에 <b>가볍게 한 번 훑어보면 좋은 자료</b>예요. 외울 필요는 없고 “이런 게 있구나” 정도면 충분해요. (총겜동 내수서버 · feat. 라로시)
      </PageHelp>

      <div className="mb-6 rounded-xl border border-white/10 bg-gradient-to-b from-emerald-400/[0.06] to-transparent p-5 text-center">
        <div className="text-2xl">🍵</div>
        <h1 className="mt-1 text-lg font-bold text-white/90">처음 오셨나요?</h1>
        <p className="mt-1 text-sm text-white/55">아래 내용만 알고 들어가도 첫날이 훨씬 수월해요.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <p className="mt-6 text-center text-xs text-white/30">더 자세한 건 부적·영단·광산&채집 타이머 탭에서 볼 수 있어요. (자료: 라로시 · 총겜동 내수서버)</p>
    </div>
  );
}
