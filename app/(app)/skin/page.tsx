"use client";

import { useRef, useState } from "react";
import PageHelp from "../../components/PageHelp";

/**
 * 마인크래프트 스킨 → 도포(도복) 변환기.
 * 컨셉(팔레트) 단위로 관리한다. 새 컨셉은 CONCEPTS에 팔레트만 추가하면 드롭다운에 늘어난다.
 */

type RGB = [number, number, number];
type Palette = {
  RW: RGB; RB: RGB; NAVY: RGB; SLATE: RGB; DRAPE: RGB;
  SH: Record<string, number>;
};
type Concept = { id: string; name: string; desc: string; palette: Palette };

const SH_DEFAULT = { top: 1.04, bottom: 0.75, right: 0.88, front: 1.0, left: 0.84, back: 0.92 };

// ── 컨셉 목록 (새 컨셉은 여기에 추가) ──
const CONCEPTS: Concept[] = [
  {
    id: "dopo",
    name: "도복 (진한하늘)",
    desc: "머리는 그대로, 몸은 진한하늘 도포",
    palette: {
      RW: [232, 243, 252], RB: [118, 180, 226], NAVY: [52, 72, 102],
      SLATE: [86, 138, 186], DRAPE: [44, 52, 66], SH: SH_DEFAULT,
    },
  },
];

// ── 픽셀 헬퍼 ──
type Buf = Uint8ClampedArray;
const pxAt = (d: Buf, x: number, y: number): RGB & { 3?: number } => {
  const i = (y * 64 + x) * 4; return [d[i], d[i + 1], d[i + 2]] as RGB;
};
const alphaAt = (d: Buf, x: number, y: number) => d[(y * 64 + x) * 4 + 3];
const setPx = (d: Buf, x: number, y: number, c: RGB) => { const i = (y * 64 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
const lerp = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const shade = (c: RGB, f: number): RGB => c.map((v) => Math.min(255, Math.max(0, Math.round(v * f)))) as RGB;
function faces(u: number, v: number, w: number, h: number, dd: number) {
  return {
    top: [u + dd, v, w, dd], bottom: [u + dd + w, v, w, dd], right: [u, v + dd, dd, h],
    front: [u + dd, v + dd, w, h], left: [u + dd + w, v + dd, dd, h], back: [u + dd + w + dd, v + dd, w, h],
  } as Record<string, number[]>;
}
function paintBox(d: Buf, u: number, v: number, w: number, h: number, dd: number, t0: number, t1: number, pal: Palette) {
  const fs = faces(u, v, w, h, dd);
  for (const name in fs) {
    const [x0, y0, fw, fh] = fs[name];
    for (let j = 0; j < fh; j++) {
      const t = name === "top" ? t0 : name === "bottom" ? t1 : t0 + (t1 - t0) * (fh > 1 ? j / (fh - 1) : 0);
      const base = shade(lerp(pal.RW, pal.RB, t), pal.SH[name]);
      for (let i = 0; i < fw; i++) setPx(d, x0 + i, y0 + j, base);
    }
  }
  return fs;
}

export default function SkinPage() {
  const [model, setModel] = useState<"auto" | "slim" | "classic">("auto");
  const [band, setBand] = useState(true);
  const [conceptId, setConceptId] = useState(CONCEPTS[0].id);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [over, setOver] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const outRef = useRef<HTMLCanvasElement | null>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const flatRef = useRef<HTMLCanvasElement>(null);

  // 최신 옵션을 build에서 참조하기 위한 ref (이벤트 핸들러에서 즉시 반영)
  const optRef = useRef({ model, band, conceptId });
  optRef.current = { model, band, conceptId };

  function say(msg: string, isErr = false) { setStatus(msg); setErr(isErr); }

  function loadFile(f: File) {
    const img = new Image();
    img.onload = () => {
      if (!((img.width === 64 && img.height === 64) || (img.width === 64 && img.height === 32))) {
        say(`64×64 또는 64×32 PNG만 지원해요. (현재: ${img.width}×${img.height})`, true); return;
      }
      const c = document.createElement("canvas"); c.width = 64; c.height = 64;
      c.getContext("2d")!.drawImage(img, 0, 0);
      srcRef.current = c;
      build();
    };
    img.onerror = () => say("이미지를 읽을 수 없어요.", true);
    img.src = URL.createObjectURL(f);
  }

  function build() {
    const srcCanvas = srcRef.current;
    if (!srcCanvas) return;
    const { model: mode, band: useBand, conceptId: cid } = optRef.current;
    const pal = CONCEPTS.find((c) => c.id === cid)?.palette ?? CONCEPTS[0].palette;
    const { RW, RB, NAVY, SLATE, DRAPE, SH } = pal;

    const src = srcCanvas.getContext("2d")!.getImageData(0, 0, 64, 64).data;

    // 슬림 감지
    let armPix = 0, edgeEmpty = true;
    for (let y = 16; y < 32; y++) {
      for (let x = 40; x < 54; x++) if (alphaAt(src, x, y) > 0) armPix++;
      for (const x of [54, 55]) if (alphaAt(src, x, y) > 0) edgeEmpty = false;
    }
    const detected = armPix > 0 && edgeEmpty ? "slim" : "classic";
    const slim = mode === "auto" ? detected === "slim" : mode === "slim";
    const AW = slim ? 3 : 4;

    // 손 색 = 얼굴 앞면에서 가장 흔한 불투명색
    const cnt: Record<string, number> = {};
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) {
      if (alphaAt(src, x, y) > 0) { const p = pxAt(src, x, y); const k = p[0] + "," + p[1] + "," + p[2]; cnt[k] = (cnt[k] || 0) + 1; }
    }
    let HAND: RGB = [231, 222, 175]; let best = 0;
    for (const k in cnt) if (cnt[k] > best) { best = cnt[k]; HAND = k.split(",").map(Number) as RGB; }

    const outCanvas = document.createElement("canvas"); outCanvas.width = 64; outCanvas.height = 64;
    const octx = outCanvas.getContext("2d")!;
    const out = octx.createImageData(64, 64);
    const d = out.data;
    // 머리(0~15행) 그대로 복사
    for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4; d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; d[i + 3] = src[i + 3]; }

    // 머리띠
    if (useBand) {
      const free = (x: number, y: number) => alphaAt(d, x, y) === 0;
      const sif = (x: number, y: number, c: RGB) => { if (free(x, y)) setPx(d, x, y, c); };
      for (const [x0, x1, f] of [[32, 40, SH.right], [48, 56, SH.left], [56, 64, SH.back]] as const)
        for (let x = x0; x < x1; x++) sif(x, 8, shade(SLATE, f));
      for (let x = 40; x < 48; x++) setPx(d, x, 8, SLATE);
      setPx(d, 43, 8, NAVY); setPx(d, 44, 8, NAVY);
      sif(59, 8, NAVY); sif(60, 8, NAVY);
      sif(59, 9, shade(SLATE, 0.9)); sif(60, 9, shade(SLATE, 0.9));
      sif(59, 10, NAVY); sif(60, 11, shade(SLATE, 0.85));
    }

    // 몸통
    const tf = paintBox(d, 16, 16, 8, 12, 4, 0.05, 0.45, pal);
    const [fx, fy] = tf.front;
    const F = (i: number, j: number, c: RGB) => setPx(d, fx + i, fy + j, c);
    F(3, 0, HAND); F(4, 1, HAND);
    F(1, 0, SLATE); F(2, 1, SLATE);
    F(4, 0, shade(RW, 0.97)); F(5, 0, shade(RW, 0.97));
    for (const [i, j] of [[2, 0], [3, 1], [3, 2], [4, 3], [4, 4], [5, 5], [5, 6], [5, 7]]) F(i, j, NAVY);
    for (const [i, j] of [[2, 2], [3, 3], [3, 4], [4, 5], [4, 6], [4, 7]]) F(i, j, SLATE);
    for (const name of ["front", "right", "left", "back"]) {
      const [bx, by, bw] = tf[name];
      for (let i = 0; i < bw; i++) { setPx(d, bx + i, by + 8, shade(SLATE, SH[name])); setPx(d, bx + i, by + 9, shade(NAVY, SH[name])); }
    }
    F(1, 8, shade(SLATE, 0.85)); F(2, 8, shade(SLATE, 0.85));
    F(1, 10, DRAPE); F(1, 11, SLATE);
    const [bxx, byy] = tf.back;
    for (let j = 0; j < 10; j++) { setPx(d, bxx + 3, byy + j, DRAPE); setPx(d, bxx + 4, byy + j, shade(DRAPE, 1.25)); }
    setPx(d, bxx + 3, byy + 10, DRAPE); setPx(d, bxx + 4, byy + 10, [150, 170, 195]); setPx(d, bxx + 3, byy + 11, SLATE);

    // 팔
    for (const [u, v] of [[40, 16], [32, 48]]) {
      const af = paintBox(d, u, v, AW, 12, 4, 0.05, 0.42, pal);
      for (const name of ["front", "right", "left", "back"]) {
        const [ax, ay, aw] = af[name];
        for (let i = 0; i < aw; i++) { setPx(d, ax + i, ay + 8, shade(SLATE, SH[name])); setPx(d, ax + i, ay + 9, shade(NAVY, SH[name])); }
        for (const j of [10, 11]) for (let i = 0; i < aw; i++) setPx(d, ax + i, ay + j, shade(HAND, SH[name]));
      }
      setPx(d, af.front[0], af.front[1], SLATE);
    }

    // 다리(치마)
    for (const [u, v] of [[0, 16], [16, 48]]) {
      const lf = paintBox(d, u, v, 4, 12, 4, 0.45, 1.0, pal);
      for (const name of ["front", "right", "left", "back"]) {
        const [lx, ly, lw] = lf[name];
        for (let i = 0; i < lw; i++) { setPx(d, lx + i, ly + 10, shade(SLATE, SH[name])); setPx(d, lx + i, ly + 11, shade(RW, SH[name] * 0.98)); }
      }
    }
    const rlf = faces(0, 16, 4, 12, 4).front, llf = faces(16, 48, 4, 12, 4).front;
    for (let j = 0; j < 10; j++) {
      const c = shade(lerp(RW, RB, 0.45 + 0.55 * j / 9), 0.88);
      setPx(d, rlf[0] + 3, rlf[1] + j, c); setPx(d, llf[0] + 0, llf[1] + j, c);
    }

    // 옷감 텍스처
    const handK = HAND.join(",");
    for (let y = 16; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (alphaAt(d, x, y) === 0) continue;
      const p = pxAt(d, x, y);
      if (p[0] + p[1] + p[2] < 300) continue;
      if (p[0] + "," + p[1] + "," + p[2] === handK) continue;
      const dg = (x + y) % 3, f = dg === 0 ? 0.962 : dg === 1 ? 1.0 : 1.025;
      let h = ((x * 73856093) ^ (y * 19349663)) % 9; h = (h + 9) % 9;
      const n = h - 4;
      setPx(d, x, y, [0, 1, 2].map((k) => Math.min(255, Math.max(0, Math.round(p[k] * f + n)))) as RGB);
    }

    octx.putImageData(out, 0, 0);
    outRef.current = outCanvas;
    render(slim, AW);
    const auto = mode === "auto" ? " (자동 감지)" : "";
    say(`완성! 모델: ${slim ? "슬림 Alex" : "클래식 Steve"}${auto} · 손 색은 얼굴에서 자동 추출`);
    setHasResult(true);
  }

  function render(slim: boolean, AW: number) {
    const outCanvas = outRef.current; if (!outCanvas) return;
    const s = 12;
    const blit = (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, shh: number, dx: number, dy: number) => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(outCanvas, sx, sy, sw, shh, dx * s, dy * s, sw * s, shh * s);
    };
    const cf = frontRef.current!.getContext("2d")!, cb = backRef.current!.getContext("2d")!;
    cf.clearRect(0, 0, 192, 384); cb.clearRect(0, 0, 192, 384);
    blit(cf, 20, 20, 8, 12, 4, 8); blit(cf, 44, 20, AW, 12, 4 - AW, 8); blit(cf, 36, 52, AW, 12, 12, 8);
    blit(cf, 4, 20, 4, 12, 4, 20); blit(cf, 20, 52, 4, 12, 8, 20);
    blit(cf, 8, 8, 8, 8, 4, 0); blit(cf, 40, 8, 8, 8, 4, 0);
    blit(cb, 32, 20, 8, 12, 4, 8); blit(cb, 44 + AW + 4, 20, AW, 12, 12, 8); blit(cb, 36 + AW + 4, 52, AW, 12, 4 - AW, 8);
    blit(cb, 12, 20, 4, 12, 8, 20); blit(cb, 28, 52, 4, 12, 4, 20);
    blit(cb, 24, 8, 8, 8, 4, 0); blit(cb, 56, 8, 8, 8, 4, 0);
    const cl = flatRef.current!.getContext("2d")!;
    cl.clearRect(0, 0, 256, 256); cl.imageSmoothingEnabled = false;
    cl.drawImage(outCanvas, 0, 0, 256, 256);
  }

  function rebuildIf() { if (srcRef.current) build(); }
  function download() {
    if (!outRef.current) return;
    const a = document.createElement("a");
    a.download = "도포_스킨.png"; a.href = outRef.current.toDataURL("image/png"); a.click();
  }

  const checker: React.CSSProperties = {
    imageRendering: "pixelated",
    background: "repeating-conic-gradient(#1f1f1f 0 25%, #252525 0 50%) 0 0/16px 16px",
    borderRadius: 6,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        마인크래프트 <b>스킨 PNG</b>를 넣으면 <b>머리는 그대로</b>, 몸은 <b>도포(도복)</b>로 바꿔줘요. 손 색은 얼굴에서 자동으로 맞춰요. (변환은 내 브라우저에서만 처리 · 저장은 다운로드)
      </PageHelp>

      <details className="mb-2 rounded-lg bg-[#15171c] p-3">
        <summary className="cursor-pointer text-sm font-bold text-white/85">📖 사용법</summary>
        <div className="mt-2 space-y-1 text-sm leading-relaxed text-white/60">
          <p>1. 내 스킨 PNG를 아래 상자에 <b className="text-white/80">드래그하거나 클릭</b>해서 선택.</p>
          <p>2. 머리는 원본 유지, 몸은 <b className="text-white/80">도포</b>가 입혀져요. 손 색은 얼굴색에서 자동 추출.</p>
          <p>3. 슬림(Alex)/클래식(Steve)은 자동 감지 — 틀리면 <b className="text-white/80">모델</b>에서 직접 선택.</p>
          <p>4. 머리 장식이 있으면 머리띠가 피해서 둘러져요. 어색하면 <b className="text-white/80">머리띠</b>를 끄세요.</p>
          <p className="mt-1 rounded-md bg-black/30 px-2.5 py-1.5 text-xs">💡 적용: <b className="text-white/70">자바판</b> 런처 → 스킨 → 새 스킨(모델 맞추기), <b className="text-white/70">베드락</b> 옷장 → 새 스킨 → 파일 선택.</p>
        </div>
      </details>

      {/* 입력 카드 */}
      <div className="rounded-xl border border-white/10 bg-[#15171c] p-4">
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center text-sm transition ${over ? "border-emerald-400/60 bg-emerald-400/5 text-emerald-200" : "border-white/20 text-white/45 hover:border-emerald-400/40"}`}
        >
          여기에 스킨 파일을 <b className="text-white/70">드래그</b>하거나 <b className="text-white/70">클릭</b>해서 선택 (64×64 또는 64×32 PNG)
        </div>
        <input ref={fileRef} type="file" accept="image/png" hidden onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); e.target.value = ""; }} />

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/55">
          <label className="flex items-center gap-2">컨셉
            <select value={conceptId} onChange={(e) => { setConceptId(e.target.value); rebuildIf(); }} className="rounded-md border border-white/15 bg-black/30 px-2 py-1 font-semibold text-white outline-none focus:border-emerald-400/60">
              {CONCEPTS.map((c) => <option key={c.id} value={c.id} className="bg-[#23262e]">{c.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">모델
            <select value={model} onChange={(e) => { setModel(e.target.value as typeof model); rebuildIf(); }} className="rounded-md border border-white/15 bg-black/30 px-2 py-1 font-semibold text-white outline-none focus:border-emerald-400/60">
              <option value="auto" className="bg-[#23262e]">자동 감지</option>
              <option value="slim" className="bg-[#23262e]">슬림 (Alex)</option>
              <option value="classic" className="bg-[#23262e]">클래식 (Steve)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={band} onChange={(e) => { setBand(e.target.checked); rebuildIf(); }} className="accent-emerald-500" /> 머리띠 추가</label>
        </div>
        {status && <div className={`mt-3 text-xs font-bold ${err ? "text-rose-300" : "text-emerald-300"}`}>{status}</div>}
      </div>

      {/* 결과 */}
      <div className={`mt-4 rounded-xl border border-white/10 bg-[#15171c] p-4 ${hasResult ? "" : "hidden"}`}>
        <div className="flex flex-wrap items-start justify-center gap-6">
          <div className="text-center"><canvas ref={frontRef} width={192} height={384} style={checker} /><div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/45">앞</div></div>
          <div className="text-center"><canvas ref={backRef} width={192} height={384} style={checker} /><div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/45">뒤</div></div>
          <div className="text-center"><canvas ref={flatRef} width={256} height={256} style={checker} /><div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/45">텍스처 64×64</div></div>
        </div>
        <div className="mt-4 text-center">
          <button onClick={download} className="rounded-full bg-emerald-500 px-8 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-emerald-400">스킨 다운로드</button>
        </div>
      </div>
    </div>
  );
}
