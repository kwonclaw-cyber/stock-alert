"use client";

import { useState } from "react";
import PageHelp from "../../components/PageHelp";

type Slide = { src: string; title: string; notes: string[] };

// 서버 시작 전 꼭 알아야 할 것 (가장 중요한 행동수칙)
const CHECKLIST: string[] = [
  "서버 접속 직후 문파부지·사냥채널로 이동 ❌ — 보스 루팅 우선권이 ‘채널 접속 순서’로 정해져요.",
  "인벤토리 비우고 입장 — 사망 시 귀속 아이템 빼고 전부 떨어져요 (특히 광물·재료).",
  "퀵슬롯 비워두기 — 먹은 아이템이 퀵슬롯에 먼저 들어와요. 전투 중 수시로 확인.",
  "/스폰 명령어 미리 복사해두기 — 갑자기 루팅 들어올 수 있어요.",
  "부적 하루 6개 구매 잊지 않기 — 일일 한도라 한 번 놓치면 못 따라가요.",
  "회피율·공격속도는 최대 40까지만 적용 — 40에 맞춰 세팅(낭비 금지).",
  "PVE 내공이 몬스터 요구치보다 5 이상 낮으면 데미지가 0 — 내공 먼저 확보.",
];

const SLIDES: Slide[] = [
  { src: "/guide/01-stat.png", title: "스텟", notes: [
    "잠재·재련·방어구 주문서·부적·영단으로 올리는 능력치.",
    "회피율·공격속도는 최대 40까지만 적용 → 40에 맞춰 주문서작.",
  ] },
  { src: "/guide/02-naegong.png", title: "내공", notes: [
    "PVP: 상대보다 내공 높으면 받는 데미지 감소.",
    "PVE: 요구치보다 5 이상 낮으면 데미지 0. 장비·재련·주문서(투구/벨트)·부적·반지·영단으로 확보.",
  ] },
  { src: "/guide/03-potential-1.png", title: "잠재능력 ①", notes: [
    "방어구 부위별 추가 능력치(8옵션). 잠재 리롤은 ‘우클릭’으로.",
  ] },
  { src: "/guide/04-potential-2.png", title: "잠재능력 ②", notes: [
    "한 장비 최대 3줄. 회피 최대4·공속 최대4·운 최대6.",
    "회피·공속·운 상옵 뜨면 물어보고 킵.",
  ] },
  { src: "/guide/05-scroll-1.png", title: "주문서 ①", notes: [
    "부위별 3~5회 시도. 잠재와 달리 장비 이전 시 사라짐.",
    "낮은 확률 주문서는 특수 스탯이 함께 붙음.",
  ] },
  { src: "/guide/06-scroll-2.png", title: "주문서 ②", notes: [
    "초반 체력 떡작(100%) → 중후반 내공 붙은 머리·벨트 중심 10%작.",
    "신발은 회피/공속 40캡에 맞춰 60/100% 섞어 작업.",
  ] },
  { src: "/guide/07-amulet-1.png", title: "부적 ①", notes: [
    "하루 6개(인겜3+API3), 3개 장착(옵션 겹침 금지).",
    "일일 한도라 한 번 놓치면 못 따라감 — 매일 챙기기.",
  ] },
  { src: "/guide/08-amulet-2.png", title: "부적 ② 강화·조합", notes: [
    "일반 재료 10exp, 레벨업당 일반10/고급20/희귀30, 최대 10레벨.",
    "조합: 같은 등급 10레벨 2개 + 부적석 → 상위 1개(랜덤·리롤).",
  ] },
  { src: "/guide/09-amulet-3.png", title: "부적 ③ 효율 루트", notes: [
    "필요한 갯수만큼만 재료로. 일반 10레벨 5개 이상 만들기 금지.",
    "레벨업한 부적을 재료로 넣기 금지.",
  ] },
  { src: "/guide/10-boss-loot.png", title: "보스 루팅", notes: [
    "딜 1등 개인 우선권 → 10초 후 누구나. 이후 ‘채널 접속 순서’로 먹힘.",
    "그래서 접속 후 이동하지 말 것.",
  ] },
  { src: "/guide/11-boss-caution.png", title: "보스 주의사항", notes: [
    "① 아이템 인벤에 들고오지 말기 ② 퀵슬롯 비우고 항상 확인 ③ /스폰 미리 복붙.",
  ] },
  { src: "/guide/12-mine.png", title: "광산", notes: [
    "활성석 쿨타임 있어 여러 광산 순회. 전초기지 건설로 이동 편하게(이동 500원).",
  ] },
  { src: "/guide/13-brewery.png", title: "양조장", notes: [
    "농장에서 항아리 들고 양조장에 넣으면 포션 재료로 가공. 약탈 가능.",
    "항아리 든 채로는 스킬 사용 불가(내려놓고 다시 들 수 있음).",
  ] },
];

export default function GuidePage() {
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        <b>서버 시작 전 숙지 가이드</b>예요 (총겜동 내수서버 · feat. 라로시). 아래 <b>체크리스트</b>를 먼저 보고, 각 시스템 슬라이드는 눌러서 크게 볼 수 있어요.
      </PageHelp>

      {/* 서버 시작 전 체크리스트 */}
      <section className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/[0.05] p-4">
        <h2 className="mb-2 text-base font-bold text-amber-300">✅ 서버 시작 전 체크리스트</h2>
        <ul className="space-y-1.5 text-sm text-white/85">
          {CHECKLIST.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-amber-300/70">{i + 1}.</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 시스템 슬라이드 */}
      <div className="space-y-5">
        {SLIDES.map((s) => (
          <section key={s.src} className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
            <div className="border-b border-white/10 px-4 py-2">
              <h3 className="text-sm font-bold text-emerald-300">{s.title}</h3>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.src}
              alt={s.title}
              onClick={() => setZoom(s.src)}
              className="w-full cursor-zoom-in bg-black/30 object-contain"
              loading="lazy"
            />
            <ul className="space-y-1 px-4 py-3 text-sm text-white/80">
              {s.notes.map((n, i) => (
                <li key={i} className="flex gap-2"><span className="text-white/30">•</span><span>{n}</span></li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-white/30">자료 출처: 라로시 · 총겜동 내수서버 가이드</p>

      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 overflow-auto bg-black/90 p-6">
          <button onClick={() => setZoom(null)} className="fixed right-4 top-4 z-10 rounded bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80">닫기 ✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" onClick={(e) => e.stopPropagation()} className="mx-auto rounded-lg" />
        </div>
      )}
    </div>
  );
}
