/** 페이지 상단 간단 사용설명 배너 */
export default function PageHelp({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-white/55">
      <span className="mt-px text-sm">💡</span>
      <p>{children}</p>
    </div>
  );
}
