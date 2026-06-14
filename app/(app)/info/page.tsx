"use client";

import { useStore } from "../../components/StoreProvider";
import { TextInput, TextArea, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import { uid } from "@/lib/data";

export default function InfoPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  const posts = [...data.infos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">서버 공략·꿀팁·공지 등 자유롭게 공유하세요.</p>
        <Btn
          variant="primary"
          onClick={() =>
            update((d) => {
              d.infos.unshift({
                id: uid(),
                title: "",
                body: "",
                link: "",
                author: "",
                updatedAt: new Date().toISOString(),
              });
            })
          }
        >
          + 새 글
        </Btn>
      </div>

      <div className="space-y-4">
        {posts.map((post) => {
          const pi = data.infos.findIndex((x) => x.id === post.id);
          return (
            <article key={post.id} className="rounded-xl border border-white/10 bg-[#1a1d24] p-4">
              <div className="mb-2 flex items-center gap-2">
                <TextInput
                  value={post.title}
                  onChange={(v) => update((d) => { d.infos[pi].title = v; d.infos[pi].updatedAt = new Date().toISOString(); })}
                  placeholder="제목"
                  className="flex-1 text-base font-semibold"
                />
                <button
                  onClick={() => update((d) => { d.infos.splice(pi, 1); })}
                  className="text-red-300/60 hover:text-red-300"
                  title="삭제"
                >
                  삭제
                </button>
              </div>
              <TextArea
                value={post.body}
                onChange={(v) => update((d) => { d.infos[pi].body = v; d.infos[pi].updatedAt = new Date().toISOString(); })}
                placeholder="내용을 입력하세요"
                rows={4}
                className="mb-2"
              />
              <div className="flex flex-wrap gap-2">
                <TextInput
                  value={post.link}
                  onChange={(v) => update((d) => { d.infos[pi].link = v; })}
                  placeholder="링크(선택) https://"
                  className="flex-1"
                />
                <TextInput
                  value={post.author}
                  onChange={(v) => update((d) => { d.infos[pi].author = v; })}
                  placeholder="작성자"
                  className="w-32"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-white/35">
                <span>{post.author && `${post.author} · `}{new Date(post.updatedAt).toLocaleString("ko-KR")}</span>
                {post.link && (
                  <a href={post.link} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                    링크 열기 ↗
                  </a>
                )}
              </div>
            </article>
          );
        })}
        {data.infos.length === 0 && (
          <p className="py-10 text-center text-sm text-white/30">아직 글이 없습니다. “새 글”을 눌러 작성하세요.</p>
        )}
      </div>
    </div>
  );
}
