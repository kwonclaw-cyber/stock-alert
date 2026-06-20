"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import PageHelp from "../../components/PageHelp";
import { sendDiscord } from "../../components/discord";
import { fileToDataUrl } from "../../components/imageUtil";
import { uid } from "@/lib/data";

type MediaKind = "image" | "video" | "youtube" | "soop" | "link";

/** URL 한 개의 표시 방식 판별 */
function classify(u: string): { kind: MediaKind; src: string } {
  if (/^data:image\//i.test(u) || /\.(png|jpe?g|gif|webp|bmp|avif)(\?.*)?$/i.test(u)) return { kind: "image", src: u };
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}` };
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)) return { kind: "video", src: u };
  if (/vod\.sooplive\.com\/player\/\d+/i.test(u)) return { kind: "soop", src: u };
  return { kind: "link", src: u };
}

const URL_RE = /(https?:\/\/[^\s]+|data:image\/[^\s]+)/gi;

/** 본문 텍스트 + 붙여넣은 이미지에서 미디어(영상/사진)를 순서대로 렌더 */
function MediaBlocks({ body, images, onZoom }: { body: string; images: string[]; onZoom: (src: string) => void }) {
  const urls = body.match(URL_RE) ?? [];
  const all = [...urls, ...images];
  if (all.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {all.map((u, i) => {
        const m = classify(u);
        if (m.kind === "image") {
          // eslint-disable-next-line @next/next/no-img-element
          return <img key={i} src={m.src} alt="" onClick={() => onZoom(m.src)} className="max-h-[70vh] w-full cursor-zoom-in rounded-lg bg-black/30 object-contain" />;
        }
        if (m.kind === "video") {
          return <video key={i} src={m.src} controls preload="metadata" className="max-h-[70vh] w-full rounded-lg bg-black" />;
        }
        if (m.kind === "youtube" || m.kind === "soop") {
          return (
            <div key={i} className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe src={m.src} className="h-full w-full" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          );
        }
        return (
          <a key={i} href={m.src} target="_blank" rel="noreferrer" className="block truncate text-sm text-emerald-400 hover:underline">
            🔗 {m.src}
          </a>
        );
      })}
    </div>
  );
}

/** 내용에 맞춰 높이가 늘어나는 textarea */
function AutoTextArea({
  value, onChange, onPasteImages, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPasteImages: (files: File[]) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
        if (files.length) { e.preventDefault(); onPasteImages(files); }
      }}
      className="w-full resize-none overflow-hidden rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/60"
    />
  );
}

export default function InfoPage() {
  const { data, update } = useStore();
  const [sent, setSent] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  if (!data) return <Loading />;

  const webhook = data.discordWebhook;

  async function pushPost(title: string, body: string, id: string) {
    const text = body.replace(URL_RE, (u) => (u.startsWith("data:") ? "[사진]" : u));
    const msg = `📢 **${title || "공지"}**\n${text}`;
    const ok = await sendDiscord(webhook, msg);
    setSent(ok ? id : null);
    setTimeout(() => setSent(null), 2000);
  }

  // 붙여넣기/드래그한 이미지를 글에 첨부 (data URL)
  async function addImages(postId: string, files: File[]) {
    for (const f of files) {
      const url = await fileToDataUrl(f, 1600);
      update((d) => { const p = d.infos.find((x) => x.id === postId); if (p) { p.images.push(url); p.updatedAt = new Date().toISOString(); } });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        서버 <b>공략·꿀팁·공지</b>를 자유롭게 공유하는 게시판이에요. <b>내용</b>에 <b>유튜브·mp4·숲(SOOP) VOD·사진 링크</b>를 적으면 글 안에서 <b>바로 영상·사진이 자리잡아요</b>. 사진은 <b>붙여넣기(Ctrl+V)</b>로도 넣을 수 있어요. 글은 <b>쓴 순서대로</b> 쌓이고, 내용이 길어지면 카드도 늘어나요.
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
          <Btn onClick={() => { void pushPost("내수서버 알림 테스트", "디스코드 연동이 정상 동작합니다 ✅", "test"); }} className="!text-xs">
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
              d.infos.push({
                id: uid(),
                title: "",
                body: "",
                link: "",
                author: "",
                images: [],
                updatedAt: new Date().toISOString(),
              });
            })
          }
        >
          + 새 글
        </Btn>
      </div>

      <div className="space-y-4">
        {data.infos.map((post, pi) => (
          <article key={post.id} className="rounded-xl border border-white/10 bg-[#1a1d24] p-4">
            <div className="mb-2 flex items-center gap-2">
              <TextInput
                value={post.title}
                onChange={(v) => update((d) => { d.infos[pi].title = v; d.infos[pi].updatedAt = new Date().toISOString(); })}
                placeholder="제목"
                className="flex-1 text-base font-semibold"
              />
              {webhook && (
                <Btn onClick={() => { void pushPost(post.title, post.body, post.id); }} className="!py-1 !text-xs" title="이 글을 디스코드로 전송">
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

            <AutoTextArea
              value={post.body}
              onChange={(v) => update((d) => { d.infos[pi].body = v; d.infos[pi].updatedAt = new Date().toISOString(); })}
              onPasteImages={(files) => addImages(post.id, files)}
              placeholder="내용을 입력하세요. 유튜브·mp4·숲VOD·사진 링크를 넣으면 바로 표시되고, 사진은 Ctrl+V로도 붙여넣을 수 있어요."
            />

            <MediaBlocks body={post.body} images={post.images} onZoom={(src) => setZoom(src)} />

            {post.images.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {post.images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => update((d) => { const p = d.infos.find((x) => x.id === post.id); if (p) p.images.splice(i, 1); })}
                    className="rounded border border-white/15 px-1.5 py-0.5 text-[11px] text-white/40 hover:text-red-300"
                    title="붙여넣은 사진 삭제"
                  >
                    🗑 사진{i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between gap-2">
              <TextInput
                value={post.author}
                onChange={(v) => update((d) => { d.infos[pi].author = v; })}
                placeholder="작성자"
                className="w-32"
              />
              <span className="text-xs text-white/35">{post.author && `${post.author} · `}{new Date(post.updatedAt).toLocaleString("ko-KR")}</span>
            </div>
          </article>
        ))}
        {data.infos.length === 0 && (
          <p className="py-10 text-center text-sm text-white/30">아직 글이 없습니다. “새 글”을 눌러 작성하세요.</p>
        )}
      </div>

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
