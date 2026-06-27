"use client";

import { useStore } from "../../components/StoreProvider";
import Board from "../../components/Board";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";

// 영단 종류 (라로시 가이드 '한월서버 영단' 트리 기준 · 총 갯수 미정)
const YOUNGDAN = [
  "용마단", "녹환단", "봉황단", "청환단", "해태단", "황환단",
  "자환단", "백호단", "기린단", "적환단", "백환단", "현무단",
  "흑환단", "주작단", "청룡단", "온환단", "옥환단", "천경단",
  "명월단", "매화단", "시공단", "금환단", "태극단", "용혈단",
];

export default function DwellingPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        <b>영단</b>(추가 내실) 정보예요. 아래 정리는 고정이고, <b>영단 화면 캡쳐·메모</b>는 카드에 <b>Ctrl+V</b>로 붙여넣으면 모두에게 공유돼요.
      </PageHelp>

      {/* 영단 핵심 정보 */}
      <section className="mb-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.04] p-4">
        <h2 className="mb-2 text-base font-bold text-emerald-300">📌 영단이란? (추가 내실)</h2>
        <ul className="space-y-1 text-sm text-white/80">
          <li>• 기존 코창의 <b className="text-white">‘무인의 거처’ 삭제 후 영단 시스템 추가</b> — 캐릭터의 추가 내실(능력치)을 올리는 수단.</li>
          <li>• 획득: <b className="text-white">보스쟁 · 채집 · 광</b> 등 다양한 방법.</li>
          <li>• <b className="text-white">테크를 선택</b>할 수 있음 — 예) 백호단·주작단이 둘 다 제작 가능하면 <b className="text-white">뭘 먼저 만들지 선택</b>.</li>
          <li>• 각 영단은 <b className="text-white">0~10레벨</b>로 강화. <b className="text-white/60">영단 총 갯수는 미정.</b></li>
        </ul>
      </section>

      {/* 영단 종류 */}
      <section className="mb-6 rounded-xl border border-white/10 bg-[#15171c] p-4">
        <h2 className="mb-3 text-base font-bold text-white/80">🧩 영단 종류 <span className="text-xs font-normal text-white/40">(확인된 것 · 추가될 수 있음)</span></h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {YOUNGDAN.map((name) => (
            <div key={name} className="rounded-md border border-white/10 bg-black/20 py-1.5 text-center text-sm text-white/75">
              {name}
            </div>
          ))}
        </div>
      </section>

      {/* 영단 화면 캡쳐 · 메모 (공유) */}
      <h2 className="mb-2 text-base font-bold text-white/80">📷 영단 화면 · 메모</h2>
      <Board
        posts={data.dwellings}
        mutate={(recipe) => update((d) => recipe(d.dwellings))}
        help={
          <>
            영단 트리·세팅 <b>스크린샷</b>을 <b>Ctrl+V</b>로 붙여넣거나, 추천 테크·획득처 등을 글로 정리해 두세요. (모두에게 공유)
          </>
        }
      />
    </div>
  );
}
