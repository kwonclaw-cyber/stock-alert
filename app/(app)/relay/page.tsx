"use client";

import { useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, TextArea, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { uid } from "@/lib/data";
import { MAIN_GUILD_ID } from "@/lib/guilds";

export default function RelayPage() {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<Record<string, { author: string; text: string }>>({});
  if (!data) return <Loading />;

  // 박사장 문파원 이름(중복 제거, 빈 값 제외)
  const guild = data.guilds.find((g) => g.id === MAIN_GUILD_ID) ?? data.guilds[0];
  const members = Array.from(
    new Set((guild?.members ?? []).map((m) => m.name.trim()).filter(Boolean)),
  );

  const posts = data.relays;

  function setD(id: string, patch: Partial<{ author: string; text: string }>) {
    setDraft((s) => { const cur = s[id] ?? { author: "", text: "" }; return { ...s, [id]: { ...cur, ...patch } }; });
  }
  function addComment(postId: string) {
    const d = draft[postId];
    if (!d?.author || !d.text.trim()) return;
    update((s) => {
      const p = s.relays.find((x) => x.id === postId);
      if (p) p.comments.push({ id: uid(), author: d.author, text: d.text.trim(), at: new Date().toISOString() });
    });
    setDraft((s) => ({ ...s, [postId]: { author: d.author, text: "" } }));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        <b>작성자(글쓴이)</b>가 할 말·공지를 남기면, <b>작성자를 제외한 박사장 문파원 전원</b>이 그 글에 <b>댓글</b>로 등록하는 곳이에요. 누가 아직 안 남겼는지 <b>남은 인원</b>으로 한눈에 볼 수 있어요. (이름은 박사장 멤버현황 기준)
      </PageHelp>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">작성자 빼고 문파원 모두 댓글 등록</p>
        <Btn
          variant="primary"
          onClick={() => update((s) => { s.relays.unshift({ id: uid(), title: "", body: "", target: "", author: "", comments: [], createdAt: new Date().toISOString() }); })}
        >
          + 새 전달
        </Btn>
      </div>

      <div className="space-y-4">
        {posts.map((post, pi) => {
          const commented = new Set(post.comments.map((c) => c.author));
          const remaining = members.filter((n) => n !== post.target && !commented.has(n));
          const d = draft[post.id] ?? { author: "", text: "" };
          return (
            <article key={post.id} className="rounded-xl border border-white/10 bg-[#1a1d24] p-4">
              <div className="mb-2 flex items-center gap-2">
                <TextInput
                  value={post.title}
                  onChange={(v) => update((s) => { s.relays[pi].title = v; })}
                  placeholder="제목 (예: OO에게 전달)"
                  className="flex-1 text-base font-semibold"
                />
                <button onClick={() => update((s) => { s.relays.splice(pi, 1); })} className="text-red-300/60 hover:text-red-300" title="삭제">삭제</button>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-white/55">작성자(글쓴이)</span>
                <select
                  value={post.target}
                  onChange={(e) => update((s) => { s.relays[pi].target = e.target.value; })}
                  className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-white outline-none"
                >
                  <option value="" className="text-black">작성자 선택…</option>
                  {members.map((n) => (
                    <option key={n} value={n} className="text-black">{n}</option>
                  ))}
                </select>
                {post.target && <span className="rounded-md border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-xs font-bold text-amber-200">✍ {post.target} (작성자·댓글 제외)</span>}
              </div>

              <TextArea
                value={post.body}
                onChange={(v) => update((s) => { s.relays[pi].body = v; })}
                placeholder="할 말 / 공지 내용"
                rows={3}
                className="mb-3"
              />

              {/* 남은 인원 */}
              <div className="mb-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
                <div className="mb-1.5 text-xs font-semibold text-white/55">
                  댓글 현황 <span className="text-emerald-300">{commented.size}</span> / {Math.max(0, members.length - (post.target ? 1 : 0))}명
                </div>
                {remaining.length === 0 ? (
                  <p className="text-xs text-emerald-300">모두 댓글 완료 ✅</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-white/35">남은 인원:</span>
                    {remaining.map((n) => (
                      <span key={n} className="rounded border border-white/15 px-1.5 py-0.5 text-[11px] text-white/55">{n}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 댓글 목록 */}
              <div className="space-y-1.5">
                {post.comments.map((c, ci) => (
                  <div key={c.id} className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-sm">
                    <span className="shrink-0 font-bold text-emerald-300">{c.author}</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-white/85">{c.text}</span>
                    <span className="shrink-0 text-[10px] text-white/30">{new Date(c.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <button onClick={() => update((s) => { s.relays[pi].comments.splice(ci, 1); })} className="shrink-0 text-red-300/40 hover:text-red-300" title="댓글 삭제">×</button>
                  </div>
                ))}
                {post.comments.length === 0 && <p className="py-1 text-center text-xs text-white/25">아직 댓글이 없어요.</p>}
              </div>

              {/* 댓글 작성 */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={d.author}
                  onChange={(e) => setD(post.id, { author: e.target.value })}
                  className="rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white outline-none"
                >
                  <option value="" className="text-black">내 이름…</option>
                  {members.filter((n) => n !== post.target).map((n) => (
                    <option key={n} value={n} className="text-black">{n}</option>
                  ))}
                </select>
                <input
                  value={d.text}
                  onChange={(e) => setD(post.id, { text: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") addComment(post.id); }}
                  placeholder="댓글 입력 후 Enter"
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
                />
                <Btn variant="primary" onClick={() => addComment(post.id)} className="!py-1.5 !text-xs">댓글</Btn>
              </div>
            </article>
          );
        })}
        {posts.length === 0 && (
          <p className="py-10 text-center text-sm text-white/30">전달 글이 없습니다. “새 전달”을 눌러 작성하세요.</p>
        )}
      </div>
    </div>
  );
}
