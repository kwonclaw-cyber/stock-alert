"use client";

import { useEffect, useRef, useState } from "react";
import { TextInput, Btn } from "./fields";
import PageHelp from "./PageHelp";
import { fileToDataUrl } from "./imageUtil";
import { uid, type BoardPost } from "@/lib/data";
import { confirmDelete } from "@/lib/confirmDelete";

type MediaKind = "image" | "video" | "youtube" | "soop" | "link";

function classify(u: string): { kind: MediaKind; src: string } {
  if (/^data:image\//i.test(u) || /\.(png|jpe?g|gif|webp|bmp|avif)(\?.*)?$/i.test(u)) return { kind: "image", src: u };
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}` };
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)) return { kind: "video", src: u };
  if (/vod\.sooplive\.com\/player\/\d+/i.test(u)) return { kind: "soop", src: u };
  return { kind: "link", src: u };
}

const TOKEN_RE = /(\[\[img:[\w-]+\]\]|https?:\/\/[^\s]+)/g;

/** 본문(텍스트 + 링크 + [[img:id]] 토큰)을 순서대로 인라인 렌더 */
function renderContent(body: string, images: BoardPost["images"], onZoom: (src: string) => void) {
  const map = new Map(images.map((im) => [im.id, im.url]));
  const parts = body.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    const tok = part.match(/^\[\[img:([\w-]+)\]\]$/);
    if (tok) {
      const url = map.get(tok[1]);
      if (!url) return null;
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={i} src={url} alt="" onClick={() => onZoom(url)} className="max-h-[70vh] w-full cursor-zoom-in rounded-lg bg-black/30 object-contain" />;
    }
    if (/^https?:\/\//i.test(part)) {
      const m = classify(part);
      if (m.kind === "image") {
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={i} src={m.src} alt="" onClick={() => onZoom(m.src)} className="max-h-[70vh] w-full cursor-zoom-in rounded-lg bg-black/30 object-contain" />;
      }
      if (m.kind === "video") return <video key={i} src={m.src} controls preload="metadata" className="max-h-[70vh] w-full rounded-lg bg-black" />;
      if (m.kind === "youtube" || m.kind === "soop") {
        return (
          <div key={i} className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe src={m.src} className="h-full w-full" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        );
      }
      return <a key={i} href={m.src} target="_blank" rel="noreferrer" className="break-all text-emerald-400 hover:underline">{m.src}</a>;
    }
    return <span key={i} className="whitespace-pre-wrap">{part}</span>;
  });
}

/** 내용에 맞춰 높이가 늘어나고, 사진을 커서 위치에 넣을 수 있는 본문 입력 */
function BodyEditor({
  value, onChange, onPasteImages, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPasteImages: (files: File[], caret: number) => void;
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
        if (files.length) { e.preventDefault(); onPasteImages(files, e.currentTarget.selectionStart ?? value.length); }
      }}
      onDrop={(e) => {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
        if (files.length) { e.preventDefault(); onPasteImages(files, value.length); }
      }}
      className="w-full resize-none overflow-hidden rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/60"
    />
  );
}

/** 정보공유·영단 공용 게시판. 본문에 링크/사진을 넣으면 그 자리에 영상·사진이 표시된다. */
export default function Board({
  posts, mutate, help,
}: {
  posts: BoardPost[];
  mutate: (recipe: (list: BoardPost[]) => void) => void;
  help: React.ReactNode;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState<Record<string, boolean>>({});
  const toggleEditor = (id: string) => setShowEditor((s) => ({ ...s, [id]: !s[id] }));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id: string) => setCollapsed((s) => ({ ...s, [id]: !s[id] }));

  async function pasteImages(postId: string, files: File[], caret: number) {
    const added: BoardPost["images"] = [];
    for (const f of files) added.push({ id: uid(), url: await fileToDataUrl(f, 1600) });
    mutate((list) => {
      const p = list.find((x) => x.id === postId);
      if (!p) return;
      const tokens = added.map((a) => `[[img:${a.id}]]`).join("\n");
      const before = p.body.slice(0, caret);
      const after = p.body.slice(caret);
      p.body = `${before}${before && !before.endsWith("\n") ? "\n" : ""}${tokens}\n${after}`;
      p.images.push(...added);
      p.updatedAt = new Date().toISOString();
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>{help}</PageHelp>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">사진·영상은 <b className="text-white/70">붙여넣기(Ctrl+V)</b>하거나 링크를 적으면 본문 그 자리에 들어가요.</p>
        <Btn
          variant="primary"
          onClick={() => {
            const id = uid();
            mutate((list) => { list.push({ id, title: "", body: "", images: [], author: "", updatedAt: new Date().toISOString() }); });
            setShowEditor((s) => ({ ...s, [id]: true }));
          }}
        >
          + 새 글
        </Btn>
      </div>

      <div className="space-y-4">
        {posts.map((post, pi) => (
          <article key={post.id} className="rounded-xl border border-white/10 bg-[#1a1d24] p-4">
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => toggleCollapse(post.id)}
                className="shrink-0 rounded-md px-1.5 py-1 text-sm text-white/45 transition hover:bg-white/10 hover:text-white"
                title={collapsed[post.id] ? "펼치기" : "접기 (제목만 보기)"}
              >
                {collapsed[post.id] ? "▸" : "▾"}
              </button>
              <TextInput
                value={post.title}
                onChange={(v) => mutate((list) => { list[pi].title = v; list[pi].updatedAt = new Date().toISOString(); })}
                placeholder="제목"
                className="flex-1 text-base font-semibold"
              />
              {!collapsed[post.id] && (
                <>
                  <button
                    onClick={() => toggleEditor(post.id)}
                    className={`rounded-md border px-2 py-1 text-xs transition ${showEditor[post.id] ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/55 hover:text-white"}`}
                    title={showEditor[post.id] ? "읽기 모드로 (입력창 숨김)" : "편집 모드로 (입력창 열기)"}
                  >
                    {showEditor[post.id] ? "📖 읽기 모드" : "✏️ 편집 모드"}
                  </button>
                  <button onClick={() => { if (confirmDelete("이 글을 삭제할까요?")) mutate((list) => { list.splice(pi, 1); }); }} className="text-red-300/60 hover:text-red-300" title="삭제">삭제</button>
                </>
              )}
            </div>

            {!collapsed[post.id] && (
              <>
                {showEditor[post.id] && (
                  <BodyEditor
                    value={post.body}
                    onChange={(v) => mutate((list) => { list[pi].body = v; list[pi].updatedAt = new Date().toISOString(); })}
                    onPasteImages={(files, caret) => pasteImages(post.id, files, caret)}
                    placeholder="내용을 입력하세요. 유튜브·mp4·숲VOD·사진 링크를 넣거나 사진을 Ctrl+V로 붙여넣으면 그 자리에 표시돼요."
                  />
                )}

                {post.body.trim() || post.images.length > 0 ? (
                  <div className={`space-y-2 text-sm text-white/85 ${showEditor[post.id] ? "mt-2" : ""}`}>
                    {renderContent(post.body, post.images, setZoom)}
                  </div>
                ) : (
                  !showEditor[post.id] && <p className="py-3 text-center text-xs text-white/30">내용이 없어요. ‘✏️ 편집 모드’를 눌러 작성하세요.</p>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <TextInput
                    value={post.author}
                    onChange={(v) => mutate((list) => { list[pi].author = v; })}
                    placeholder="작성자"
                    className="w-32"
                  />
                  <span className="text-xs text-white/35">{post.author && `${post.author} · `}{new Date(post.updatedAt).toLocaleString("ko-KR")}</span>
                </div>
              </>
            )}
          </article>
        ))}
        {posts.length === 0 && (
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
