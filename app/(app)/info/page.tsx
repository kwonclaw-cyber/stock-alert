"use client";

import { useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, TextArea, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { sendDiscord } from "../../components/discord";
import { uid } from "@/lib/data";

export default function InfoPage() {
  const { data, update } = useStore();
  const [sent, setSent] = useState<string | null>(null);
  if (!data) return <Loading />;

  const posts = [...data.infos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const webhook = data.discordWebhook;

  async function pushPost(title: string, body: string, link: string, id: string) {
    const msg = `📢 **${title || "공지"}**\n${body}${link ? `\n${link}` : ""}`;
    const ok = await sendDiscord(webhook, msg);
    setSent(ok ? id : null);
    setTimeout(() => setSent(null), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        서버 <b>공략·꿀팁·공지</b>를 자유롭게 공유하는 게시판이에요. “새 글”로 추가하면 자동 저장돼요. <b>디스코드 웹훅</b>을 등록하면 글을 <b>디스코드로 전송</b>하거나, 보스 젠 알림을 채널로 자동 푸시할 수 있어요.
      </PageHelp>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#15171c] p-3">
        <span className="text-sm font-semibold text-white/70">🔗 디스코드 웹훅</span>
        <TextInput
          value={webhook}
          onChange={(v) => update((d) => { d.discordWebhook = v; })}
          placeholder="https://discord.com/api/webhooks/..."
          className="!text-left min-w-0 flex-1"
        />
        {webhook && (
          <Btn onClick={() => { void pushPost("내수서버 알림 테스트", "디스코드 연동이 정상 동작합니다 ✅", "", "test"); }} className="!text-xs">
            {sent === "test" ? "전송됨 ✓" : "테스트 전송"}
          </Btn>
        )}
      </div>
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
                {webhook && (
                  <Btn onClick={() => { void pushPost(post.title, post.body, post.link, post.id); }} className="!py-1 !text-xs" title="이 글을 디스코드로 전송">
                    {sent === post.id ? "전송됨 ✓" : "디스코드"}
                  </Btn>
                )}
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
