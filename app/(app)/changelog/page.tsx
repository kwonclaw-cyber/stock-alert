import PageHelp from "../../components/PageHelp";
import { CHANGELOG } from "@/lib/changelog";

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        <b>업데이트 기록</b>이에요. 버전별로 추가·변경된 내용을 정리해둡니다. 새 기능이 배포되면 가장 위에 추가돼요.
      </PageHelp>

      <div className="space-y-3">
        {CHANGELOG.map((e, i) => (
          <article key={e.version} className="rounded-xl border border-white/10 bg-[#15171c] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-sm font-bold text-emerald-300">
                v{e.version}
              </span>
              <span className="text-xs text-white/40">{e.date}</span>
              {i === 0 && (
                <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  최신
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {e.changes.map((c, j) => (
                <li key={j} className="flex gap-2 text-sm text-white/80">
                  <span className="mt-1 text-emerald-400/70">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
