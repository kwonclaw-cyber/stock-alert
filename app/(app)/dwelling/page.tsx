"use client";

import { useStore } from "../../components/StoreProvider";
import Board from "../../components/Board";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";

// 영단 효과·획득처 (라로시 가이드 '한월서버 영단' 슬라이드 기준)
type Youngdan = { name: string; color: string; effect: string; source: string };
const YOUNGDAN: Youngdan[] = [
  { name: "시공단", color: "bg-cyan-400", effect: "물약회복량(%) +3, 경험치획득량(%) +1", source: "무림 맹주 제작" },
  { name: "녹환단", color: "bg-emerald-500", effect: "힘(%) +1, 생명력(%) +1", source: "우물영단상자" },
  { name: "황환단", color: "bg-amber-400", effect: "힘 +2, 민첩 +2, 생명력 +2, 행운 +2", source: "우물영단상자" },
  { name: "태극단", color: "bg-zinc-300", effect: "보스공격력(%) +1, 힘 +3", source: "검성 레이드 보상" },
  { name: "천경단", color: "bg-fuchsia-300", effect: "행운(%) +1, 공격력 +3", source: "사냥 시 확률 드랍" },
  { name: "자환단", color: "bg-purple-500", effect: "민첩(%) +1, 행운(%) +1", source: "출석체크 7일차" },
  { name: "청환단", color: "bg-sky-500", effect: "공격력 +3, 보스공격력(%) +1", source: "대장장이 제작" },
  { name: "명월단", color: "bg-slate-200", effect: "보스공격력(%) +1, 행운 +3", source: "오공 레이드 보상" },
  { name: "적환단", color: "bg-red-500", effect: "체력 +15, 체력(%) +1", source: "탐험 획득 (현재 1개 남음)" },
  { name: "용혈단", color: "bg-red-700", effect: "체력(%) +3, 생명력 +5", source: "우물영기 100개 · 우물혈석 1개 · 토끼내단 · 대장장이불 10개" },
  { name: "매화단", color: "bg-pink-400", effect: "치명타공격력(%) +3, 체력 +5", source: "수련의 탑 퀘스트" },
  { name: "흑환단", color: "bg-zinc-700", effect: "저항(%) +3, 물약회복량(%) +3", source: "약초 제작 (조합법 미공개)" },
  { name: "백환단", color: "bg-slate-100", effect: "경험치획득량(%) +1, 드랍율(%) +1", source: "항아리에서 확률적 드랍" },
  { name: "은환단", color: "bg-slate-300", effect: "최종공격력(%) +1", source: "장로쥐 레이드 보상" },
  { name: "금환단", color: "bg-yellow-400", effect: "스킬피해량(%) +1", source: "레벨 보상 및 히든 퀘스트" },
  { name: "옥환단", color: "bg-green-400", effect: "공격력(%) +1", source: "해상포인트" },
  { name: "청룡단", color: "bg-blue-500", effect: "경험치획득량(%) +1, 힘 +4", source: "희귀 약초 드랍 (낮에 캘 시 2개 획득 확률↑)" },
  { name: "주작단", color: "bg-orange-500", effect: "경험치획득량(%) +1, 생명력 +4", source: "조선장 NPC 제작 (고래기름 1개 · 10만전)" },
  { name: "현무단", color: "bg-red-900", effect: "경험치획득량(%) +1, 행운 +4", source: "주작단 제작 실패 시 획득 (5% 확률)" },
];
// 트리에는 있으나 효과 미확인
const YOUNGDAN_UNKNOWN = ["용마단", "봉황단", "해태단", "백호단", "기린단", "온환단"];

export default function DwellingPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHelp>
        <b>영단</b>(추가 내실) 효과·획득처 정리예요. 아래 표는 고정이고, <b>영단 화면 캡쳐·메모</b>는 카드에 <b>Ctrl+V</b>로 붙여넣으면 모두에게 공유돼요.
      </PageHelp>

      {/* 영단 핵심 정보 */}
      <section className="mb-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.04] p-4">
        <h2 className="mb-2 text-base font-bold text-emerald-300">📌 영단이란? (추가 내실)</h2>
        <ul className="space-y-1 text-sm text-white/80">
          <li>• 기존 코창의 <b className="text-white">‘무인의 거처’ 삭제 후 영단 시스템 추가</b> — 캐릭터의 추가 내실(능력치)을 올리는 수단.</li>
          <li>• 획득: <b className="text-white">레이드 · 사냥 · 제작 · 탐험 · 퀘스트</b> 등 다양한 방법.</li>
          <li>• <b className="text-white">테크를 선택</b>할 수 있음 (예: 백호단·주작단이 둘 다 제작 가능하면 뭘 먼저 만들지 선택). 각 영단 <b className="text-white">0~10레벨</b>.</li>
        </ul>
      </section>

      {/* 영단 효과·획득처 */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-bold text-white/80">🧩 영단 효과 &amp; 획득처 <span className="text-xs font-normal text-white/40">({YOUNGDAN.length}종 확인)</span></h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {YOUNGDAN.map((y) => (
            <div key={y.name} className="rounded-lg border border-white/10 bg-[#15171c] p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`h-4 w-4 shrink-0 rounded-full ${y.color} ring-1 ring-white/25`} />
                <span className="font-bold text-white/90">{y.name}</span>
              </div>
              <div className="text-xs leading-relaxed text-emerald-200/90">
                <b className="text-white/40">효과 </b>{y.effect}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-white/55">
                <b className="text-white/40">획득 </b>{y.source}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/40">
          효과 미확인: <span className="text-white/55">{YOUNGDAN_UNKNOWN.join(" · ")}</span> (트리엔 있으나 자료 미공개 · 영단 총 갯수 미정)
        </p>
      </section>

      {/* 영단 화면 캡쳐 · 메모 (공유) */}
      <h2 className="mb-2 text-base font-bold text-white/80">📷 영단 화면 · 메모</h2>
      <Board
        posts={data.dwellings}
        mutate={(recipe) => update((d) => recipe(d.dwellings))}
        help={
          <>
            영단 트리·세팅 <b>스크린샷</b>을 <b>Ctrl+V</b>로 붙여넣거나, 추천 테크·우선순위 등을 글로 정리해 두세요. (모두에게 공유)
          </>
        }
      />
    </div>
  );
}
