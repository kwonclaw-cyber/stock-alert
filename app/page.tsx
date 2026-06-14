import LogoutButton from "./logout-button";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">내수서버 길드 운영</h1>
          <p className="mt-1 text-sm text-white/50">
            숲(SOOP) 방송인 마인크래프트 내수서버
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholders.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20"
          >
            <div className="text-2xl">{p.emoji}</div>
            <h2 className="mt-3 text-lg font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-white/50">{p.desc}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-sm text-white/30">
        🚧 레퍼런스와 세부 기능이 정해지는 대로 이 영역을 채워갈 예정입니다.
      </p>
    </main>
  );
}

const placeholders = [
  { emoji: "🛡️", title: "길드원 명단", desc: "멤버 목록과 역할 관리" },
  { emoji: "📅", title: "일정 / 이벤트", desc: "방송·콘텐츠 일정 공유" },
  { emoji: "📢", title: "공지사항", desc: "운영진 공지 및 규칙" },
];
