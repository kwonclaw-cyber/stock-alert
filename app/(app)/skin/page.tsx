"use client";

import { useRef, useState } from "react";
import PageHelp from "../../components/PageHelp";

/**
 * 마인크래프트 스킨 → 문파 단체복 변환기.
 * 컨셉마다 팔레트 + 디자인(overlay 함수)이 달라, 새 컨셉은 CONCEPTS에 추가하면 드롭다운에 늘어난다.
 */

type RGB = [number, number, number];
type FaceMap = Record<string, number[]>;
type Geo = { tf: FaceMap; arms: FaceMap[]; legs: FaceMap[]; HAND: RGB };
type BoxCfg = { t0: number; t1: number; cw: RGB; cb: RGB };
type Concept = {
  id: string;
  name: string;
  desc: string;
  band: [RGB, RGB] | null; // 머리띠 [기본, 포인트] (null=이 컨셉엔 머리띠 없음)
  base: { torso: BoxCfg; arm: BoxCfg; leg: BoxCfg };
  overlay: (d: Uint8ClampedArray, g: Geo) => void;
};

const SH: Record<string, number> = { top: 1.04, bottom: 0.75, right: 0.88, front: 1.0, left: 0.84, back: 0.92 };
const SIDES = ["front", "right", "left", "back"] as const;

// 공용 색
const SKY_W: RGB = [232, 243, 252], SKY_B: RGB = [118, 180, 226];
const NAVY: RGB = [52, 72, 102], SLATE: RGB = [86, 138, 186], DRAPE: RGB = [44, 52, 66];
const GOLD: RGB = [214, 178, 98], GOLD_D: RGB = [160, 128, 60];
const SILVER: RGB = [214, 228, 242], SKYA: RGB = [130, 190, 235];
const BLACK: RGB = [24, 28, 36];
const DARK_W: RGB = [74, 96, 124], DARK_B: RGB = [36, 48, 68];       // 흑천 예복 바탕
const STEEL_W: RGB = [152, 166, 180], STEEL_B: RGB = [104, 120, 136]; // 강철 흉갑
const STEEL_DK: RGB = [74, 88, 102];
const DEEP_W: RGB = [120, 160, 205], DEEP_B: RGB = [54, 78, 112];     // 제복 바탕

// 픽셀 헬퍼
const alphaAt = (d: Uint8ClampedArray, x: number, y: number) => d[(y * 64 + x) * 4 + 3];
const pxAt = (d: Uint8ClampedArray, x: number, y: number): RGB => { const i = (y * 64 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
const setPx = (d: Uint8ClampedArray, x: number, y: number, c: RGB) => { const i = (y * 64 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
const lerp = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const shade = (c: RGB, f: number): RGB => c.map((v) => Math.min(255, Math.max(0, Math.round(v * f)))) as RGB;
function faces(u: number, v: number, w: number, h: number, dd: number): FaceMap {
  return {
    top: [u + dd, v, w, dd], bottom: [u + dd + w, v, w, dd], right: [u, v + dd, dd, h],
    front: [u + dd, v + dd, w, h], left: [u + dd + w, v + dd, dd, h], back: [u + dd + w + dd, v + dd, w, h],
  };
}
function paintBox(d: Uint8ClampedArray, u: number, v: number, w: number, h: number, dd: number, cfg: BoxCfg): FaceMap {
  const fs = faces(u, v, w, h, dd);
  for (const name in fs) {
    const [x0, y0, fw, fh] = fs[name];
    for (let j = 0; j < fh; j++) {
      const t = name === "top" ? cfg.t0 : name === "bottom" ? cfg.t1 : cfg.t0 + (cfg.t1 - cfg.t0) * (fh > 1 ? j / (fh - 1) : 0);
      const base = shade(lerp(cfg.cw, cfg.cb, t), SH[name]);
      for (let i = 0; i < fw; i++) setPx(d, x0 + i, y0 + j, base);
    }
  }
  return fs;
}
const box = (t0: number, t1: number, cw: RGB, cb: RGB): BoxCfg => ({ t0, t1, cw, cb });

// ── 컨셉 목록 ──
const CONCEPTS: Concept[] = [
  {
    id: "dopo", name: "도복 (진한하늘)", desc: "사선 깃 도포 + 허리띠 + 등 뒷자락",
    band: [SLATE, NAVY],
    base: { torso: box(0.05, 0.45, SKY_W, SKY_B), arm: box(0.05, 0.42, SKY_W, SKY_B), leg: box(0.45, 1.0, SKY_W, SKY_B) },
    overlay(d, { tf, arms, legs, HAND }) {
      const [fx, fy] = tf.front;
      const F = (i: number, j: number, c: RGB) => setPx(d, fx + i, fy + j, c);
      F(3, 0, HAND); F(4, 1, HAND);
      F(1, 0, SLATE); F(2, 1, SLATE);
      F(4, 0, shade(SKY_W, 0.97)); F(5, 0, shade(SKY_W, 0.97));
      for (const [i, j] of [[2, 0], [3, 1], [3, 2], [4, 3], [4, 4], [5, 5], [5, 6], [5, 7]]) F(i, j, NAVY);
      for (const [i, j] of [[2, 2], [3, 3], [3, 4], [4, 5], [4, 6], [4, 7]]) F(i, j, SLATE);
      for (const n of SIDES) { const [bx, by, bw] = tf[n];
        for (let i = 0; i < bw; i++) { setPx(d, bx + i, by + 8, shade(SLATE, SH[n])); setPx(d, bx + i, by + 9, shade(NAVY, SH[n])); } }
      F(1, 10, DRAPE); F(1, 11, SLATE);
      const [bxx, byy] = tf.back;
      for (let j = 0; j < 10; j++) { setPx(d, bxx + 3, byy + j, DRAPE); setPx(d, bxx + 4, byy + j, shade(DRAPE, 1.25)); }
      setPx(d, bxx + 3, byy + 10, DRAPE); setPx(d, bxx + 4, byy + 10, [150, 170, 195]); setPx(d, bxx + 3, byy + 11, SLATE);
      for (const af of arms) for (const n of SIDES) { const [ax, ay, aw] = af[n];
        for (let i = 0; i < aw; i++) { setPx(d, ax + i, ay + 8, shade(SLATE, SH[n])); setPx(d, ax + i, ay + 9, shade(NAVY, SH[n])); } }
      for (const lf of legs) for (const n of SIDES) { const [lx, ly, lw] = lf[n];
        for (let i = 0; i < lw; i++) { setPx(d, lx + i, ly + 10, shade(SLATE, SH[n])); setPx(d, lx + i, ly + 11, shade(SKY_W, SH[n] * 0.98)); } }
    },
  },
  {
    id: "heukcheon", name: "흑천 예복", desc: "짙은 흑청 도포 + 어깨 은자수 + 겹깃 + 하늘 매듭",
    band: [SKYA, NAVY],
    base: { torso: box(0.1, 0.85, DARK_W, DARK_B), arm: box(0.1, 0.8, DARK_W, DARK_B), leg: box(0.5, 1.0, DARK_W, DARK_B) },
    overlay(d, { tf, arms, legs }) {
      const [fx, fy] = tf.front;
      const F = (i: number, j: number, c: RGB) => setPx(d, fx + i, fy + j, c);
      // 겹깃(이중 V): 바깥 은, 안쪽 하늘
      for (const [i, j] of [[1, 0], [2, 1], [3, 2], [4, 3], [4, 4]]) F(i, j, SILVER);
      for (const [i, j] of [[2, 0], [3, 1], [4, 2]]) F(i, j, SKYA);
      for (const [i, j] of [[6, 0], [5, 1], [5, 2]]) F(i, j, SILVER);
      // 어깨 자수(은 점)
      for (const i of [0, 1, 6, 7]) F(i, 0, i % 2 === 0 ? SILVER : shade(SILVER, 0.75));
      for (const af of arms) for (const n of ["front", "back"]) { const [ax, ay, aw] = af[n];
        for (let j = 0; j < 2; j++) for (let i = 0; i < aw; i++) if ((i + j) % 2 === 0) setPx(d, ax + i, ay + j, shade(SILVER, SH[n] * 0.92)); }
      // 허리: 하늘 끈 + 은 매듭
      for (const n of SIDES) { const [bx, by, bw] = tf[n];
        for (let i = 0; i < bw; i++) setPx(d, bx + i, by + 8, shade(SKYA, SH[n] * 0.9)); }
      F(3, 8, SILVER); F(4, 8, SILVER); F(3, 9, shade(SKYA, 0.8));
      // 소매: 하늘 안감 커프
      for (const af of arms) for (const n of SIDES) { const [ax, ay, aw] = af[n];
        for (let i = 0; i < aw; i++) { setPx(d, ax + i, ay + 7, shade(SKYA, SH[n])); setPx(d, ax + i, ay + 8, shade(SKYA, SH[n] * 0.85)); setPx(d, ax + i, ay + 9, shade(DARK_B, SH[n])); } }
      // 자락: 하늘 밑단
      for (const lf of legs) for (const n of SIDES) { const [lx, ly, lw] = lf[n];
        for (let i = 0; i < lw; i++) { setPx(d, lx + i, ly + 10, shade(DARK_B, SH[n] * 0.9)); setPx(d, lx + i, ly + 11, shade(SKYA, SH[n] * 0.9)); } }
      const [bxx, byy] = tf.back;
      for (let j = 0; j < 8; j++) setPx(d, bxx + 3, byy + j, shade(DARK_B, 0.8));
      for (const i of [0, 1, 6, 7]) setPx(d, bxx + i, byy + 0, i % 2 === 0 ? SILVER : shade(SILVER, 0.75));
    },
  },
  {
    id: "cheonggang", name: "청강 갑주", desc: "음각 강철 흉갑(엉덩이까지) + 어깨 갑 + 하늘 전포",
    band: [NAVY, BLACK],
    base: { torso: box(0.1, 0.5, STEEL_W, STEEL_B), arm: box(0.15, 0.5, SKY_W, SKY_B), leg: box(0.45, 0.95, SKY_W, SKY_B) },
    overlay(d, { tf, arms, legs }) {
      // 흉갑: 몸통 전체(끝까지) — 음각 점무늬 + 판 이음선 + 테두리
      for (const face of ["front", "back"]) { const [fx, fy] = tf[face];
        for (let i = 0; i < 8; i++) for (let j = 0; j < 12; j++) { if ((i * 7 + j * 3) % 5 === 0) setPx(d, fx + i, fy + j, STEEL_DK); }
        for (let i = 0; i < 8; i++) { setPx(d, fx + i, fy + 3, shade(STEEL_DK, 0.9)); setPx(d, fx + i, fy + 7, shade(STEEL_DK, 0.9)); }
        for (let j = 0; j < 12; j++) { setPx(d, fx + 0, fy + j, shade(NAVY, 1.1)); setPx(d, fx + 7, fy + j, shade(NAVY, 1.1)); }
        for (let i = 0; i < 8; i++) setPx(d, fx + i, fy + 11, shade(NAVY, 1.05)); // 하단 마감
      }
      const [fx, fy] = tf.front;
      setPx(d, fx + 3, fy + 0, BLACK); setPx(d, fx + 4, fy + 0, BLACK); // 목끈
      setPx(d, fx + 3, fy + 9, GOLD); setPx(d, fx + 4, fy + 9, GOLD);   // 버클
      // 어깨 갑(견갑)
      for (const af of arms) for (const n of SIDES) { const [ax, ay, aw] = af[n];
        for (let j = 0; j < 3; j++) for (let i = 0; i < aw; i++) setPx(d, ax + i, ay + j, shade(lerp(STEEL_W, STEEL_B, j / 2), SH[n]));
        for (let i = 0; i < aw; i++) setPx(d, ax + i, ay + 3, shade(NAVY, SH[n])); }
      // 갑주 치마(요갑): 다리 상단 2줄 강철 + 마감선 → 갑옷이 엉덩이까지 내려온 실루엣
      for (const lf of legs) for (const n of SIDES) { const [lx, ly, lw] = lf[n];
        for (let j = 0; j < 2; j++) for (let i = 0; i < lw; i++) {
          const c = (i * 7 + j * 3) % 5 === 0 ? STEEL_DK : lerp(STEEL_W, STEEL_B, 0.3 + j * 0.35);
          setPx(d, lx + i, ly + j, shade(c, SH[n]));
        }
        for (let i = 0; i < lw; i++) setPx(d, lx + i, ly + 2, shade(NAVY, SH[n])); }
      // 하늘 전포 중앙 트임(앞/뒤)
      const [r, l] = legs;
      for (const face of ["front", "back"]) {
        const [rx, ry] = r[face]; for (let j = 3; j < 10; j++) setPx(d, rx + 3, ry + j, shade(NAVY, 0.9));
        const [lx2, ly2] = l[face]; for (let j = 3; j < 10; j++) setPx(d, lx2 + 0, ly2 + j, shade(NAVY, 0.9));
      }
      // 부츠
      for (const lf of legs) for (const n of SIDES) { const [lx, ly, lw] = lf[n];
        for (let i = 0; i < lw; i++) { setPx(d, lx + i, ly + 10, shade(NAVY, SH[n])); setPx(d, lx + i, ly + 11, shade(BLACK, SH[n])); } }
    },
  },
  {
    id: "yejang", name: "예장 제복", desc: "금술 견장 + 가슴 금줄 + 검은 벨트·금 버클",
    band: null,
    base: { torso: box(0.15, 0.6, DEEP_W, DEEP_B), arm: box(0.15, 0.6, DEEP_W, DEEP_B), leg: box(0.55, 0.95, DEEP_W, DEEP_B) },
    overlay(d, { tf, arms, legs }) {
      const [fx, fy] = tf.front;
      const F = (i: number, j: number, c: RGB) => setPx(d, fx + i, fy + j, c);
      for (const n of SIDES) { const [bx, by, bw] = tf[n]; for (let i = 0; i < bw; i++) setPx(d, bx + i, by + 0, shade(NAVY, SH[n])); }
      F(3, 0, GOLD); F(4, 0, GOLD); // 깃 금장
      // 가슴 금줄(사선)
      for (const [i, j] of [[6, 1], [5, 2], [6, 3], [5, 4], [6, 5]]) F(i, j, GOLD);
      F(7, 1, GOLD_D);
      // 더블 버튼
      for (const j of [2, 4, 6]) { F(2, j, GOLD); F(4, j, GOLD_D); }
      // 검은 벨트 + 금 버클
      for (const n of SIDES) { const [bx, by, bw] = tf[n];
        for (let i = 0; i < bw; i++) setPx(d, bx + i, by + 8, shade(BLACK, Math.max(0.85, SH[n]))); }
      F(3, 8, GOLD); F(4, 8, GOLD);
      // 견장(금 + 프린지) + 금 커프스
      for (const af of arms) for (const n of SIDES) { const [ax, ay, aw] = af[n];
        for (let i = 0; i < aw; i++) { setPx(d, ax + i, ay + 0, GOLD); setPx(d, ax + i, ay + 1, i % 2 === 0 ? GOLD_D : GOLD); }
        for (let i = 0; i < aw; i++) { setPx(d, ax + i, ay + 8, shade(GOLD, SH[n] * 0.95)); setPx(d, ax + i, ay + 9, shade(GOLD_D, SH[n])); } }
      // 바지: 금 옆선 + 검은 구두
      for (const lf of legs) { const [lx, ly] = lf.front; for (let j = 0; j < 10; j++) setPx(d, lx + 0, ly + j, shade(GOLD_D, 0.9)); }
      for (const lf of legs) for (const n of SIDES) { const [lx, ly, lw] = lf[n];
        for (let i = 0; i < lw; i++) setPx(d, lx + i, ly + 11, shade(BLACK, SH[n])); }
      const [bxx, byy] = tf.back;
      for (let j = 1; j < 8; j++) setPx(d, bxx + 3, byy + j, shade(DEEP_B, 0.85));
    },
  },
];

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
    const concept = CONCEPTS.find((c) => c.id === cid) ?? CONCEPTS[0];

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

    // 손 색
    const cnt: Record<string, number> = {};
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) {
      if (alphaAt(src, x, y) > 0) { const p = pxAt(src, x, y); const k = p.join(","); cnt[k] = (cnt[k] || 0) + 1; }
    }
    let HAND: RGB = [231, 222, 175]; let best = 0;
    for (const k in cnt) if (cnt[k] > best) { best = cnt[k]; HAND = k.split(",").map(Number) as RGB; }

    const outCanvas = document.createElement("canvas"); outCanvas.width = 64; outCanvas.height = 64;
    const octx = outCanvas.getContext("2d")!;
    const out = octx.createImageData(64, 64);
    const d = out.data;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4; d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; d[i + 3] = src[i + 3]; }

    // 머리띠 (컨셉 색)
    if (useBand && concept.band) {
      const [BC, BD] = concept.band;
      const free = (x: number, y: number) => alphaAt(d, x, y) === 0;
      const sif = (x: number, y: number, c: RGB) => { if (free(x, y)) setPx(d, x, y, c); };
      for (const [x0, x1, f] of [[32, 40, SH.right], [48, 56, SH.left], [56, 64, SH.back]] as const)
        for (let x = x0; x < x1; x++) sif(x, 8, shade(BC, f));
      for (let x = 40; x < 48; x++) setPx(d, x, 8, BC);
      setPx(d, 43, 8, BD); setPx(d, 44, 8, BD);
      sif(59, 8, BD); sif(60, 8, BD);
      sif(59, 9, shade(BC, 0.9)); sif(60, 9, shade(BC, 0.9));
      sif(59, 10, BD); sif(60, 11, shade(BC, 0.85));
    }

    // 기본 몸(컨셉별 바탕색) + 손
    const tf = paintBox(d, 16, 16, 8, 12, 4, concept.base.torso);
    const a1 = paintBox(d, 40, 16, AW, 12, 4, concept.base.arm);
    const a2 = paintBox(d, 32, 48, AW, 12, 4, concept.base.arm);
    const l1 = paintBox(d, 0, 16, 4, 12, 4, concept.base.leg);
    const l2 = paintBox(d, 16, 48, 4, 12, 4, concept.base.leg);
    for (const af of [a1, a2]) for (const n of SIDES) { const [ax, ay, aw] = af[n];
      for (const j of [10, 11]) for (let i = 0; i < aw; i++) setPx(d, ax + i, ay + j, shade(HAND, SH[n])); }

    // 컨셉 디자인
    concept.overlay(d, { tf, arms: [a1, a2], legs: [l1, l2], HAND });

    // 옷감 노이즈
    const handK = HAND.join(",");
    for (let y = 16; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (alphaAt(d, x, y) === 0) continue;
      const p = pxAt(d, x, y);
      if (p[0] + p[1] + p[2] < 160) continue;
      if (p.join(",") === handK) continue;
      const dg = (x + y) % 3, f = dg === 0 ? 0.965 : dg === 1 ? 1.0 : 1.02;
      let h = ((x * 73856093) ^ (y * 19349663)) % 7; h = (h + 7) % 7;
      const n = h - 3;
      setPx(d, x, y, [0, 1, 2].map((k) => Math.min(255, Math.max(0, Math.round(p[k] * f + n)))) as RGB);
    }

    octx.putImageData(out, 0, 0);
    outRef.current = outCanvas;
    render(slim, AW);
    const auto = mode === "auto" ? " (자동 감지)" : "";
    say(`완성! ${concept.name} · 모델: ${slim ? "슬림 Alex" : "클래식 Steve"}${auto}`);
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
    const name = CONCEPTS.find((c) => c.id === optRef.current.conceptId)?.name ?? "스킨";
    const a = document.createElement("a");
    a.download = `${name}_스킨.png`; a.href = outRef.current.toDataURL("image/png"); a.click();
  }

  const concept = CONCEPTS.find((c) => c.id === conceptId) ?? CONCEPTS[0];
  const checker: React.CSSProperties = {
    imageRendering: "pixelated",
    background: "repeating-conic-gradient(#1f1f1f 0 25%, #252525 0 50%) 0 0/16px 16px",
    borderRadius: 6,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHelp>
        마인크래프트 <b>스킨 PNG</b>를 넣으면 <b>머리는 그대로</b>, 몸은 선택한 <b>문파 단체복 컨셉</b>으로 바꿔줘요. 손 색은 얼굴에서 자동으로 맞춰요. (변환은 내 브라우저에서만 처리 · 저장은 다운로드)
      </PageHelp>

      <details className="mb-2 rounded-lg bg-[#15171c] p-3">
        <summary className="cursor-pointer text-sm font-bold text-white/85">📖 사용법</summary>
        <div className="mt-2 space-y-1 text-sm leading-relaxed text-white/60">
          <p>1. 내 스킨 PNG를 아래 상자에 <b className="text-white/80">드래그하거나 클릭</b>해서 선택.</p>
          <p>2. 머리는 원본 유지, 몸은 선택한 <b className="text-white/80">컨셉 의상</b>이 입혀져요. 손 색은 얼굴색에서 자동 추출.</p>
          <p>3. 슬림(Alex)/클래식(Steve)은 자동 감지 — 틀리면 <b className="text-white/80">모델</b>에서 직접 선택.</p>
          <p>4. 머리 장식이 있으면 머리띠가 피해서 둘러져요. 어색하면 <b className="text-white/80">머리띠</b>를 끄세요.</p>
          <p className="mt-1 rounded-md bg-black/30 px-2.5 py-1.5 text-xs">💡 적용: <b className="text-white/70">자바판</b> 런처 → 스킨 → 새 스킨(모델 맞추기), <b className="text-white/70">베드락</b> 옷장 → 새 스킨 → 파일 선택.</p>
        </div>
      </details>

      <details className="mb-2 rounded-lg bg-[#15171c] p-3">
        <summary className="cursor-pointer text-sm font-bold text-white/85">🔍 내 스킨 파일 따오는 법</summary>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-white/60">
          <div>
            <b className="text-white/80">방법 1 — 마인크래프트 공식 사이트 (자바판)</b>
            <p>1. minecraft.net 로그인 → 우측 상단 프로필 → <b className="text-white/80">Profile(프로필)</b></p>
            <p>2. Skins 탭에서 지금 스킨 위의 <b className="text-white/80">⋯ → Download(다운로드)</b></p>
          </div>
          <div>
            <b className="text-white/80">방법 2 — NameMC (닉네임만 알면 됨)</b>
            <p>1. namemc.com 에서 내 닉네임 검색</p>
            <p>2. 내 프로필의 스킨 이미지 클릭 → 우측 <b className="text-white/80">Download</b> 버튼</p>
          </div>
          <div>
            <b className="text-white/80">방법 3 — 런처</b>
            <p>자바판 런처 → 스킨 탭에서 쓰던 스킨에 마우스 올려 나오는 메뉴에서 복제/저장</p>
          </div>
          <p className="mt-1 rounded-md bg-black/30 px-2.5 py-1.5 text-xs">💡 어떤 방법이든 <b className="text-white/70">64×64 PNG</b>면 돼요. 오래된 64×32 스킨도 넣을 수 있어요.</p>
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
          <label className={`flex items-center gap-2 ${concept.band ? "cursor-pointer" : "opacity-40"}`}>
            <input type="checkbox" checked={band} disabled={!concept.band} onChange={(e) => { setBand(e.target.checked); rebuildIf(); }} className="accent-emerald-500" /> 머리띠 추가
          </label>
        </div>
        <p className="mt-2 text-xs text-white/35">{concept.name} — {concept.desc}</p>
        {status && <div className={`mt-2 text-xs font-bold ${err ? "text-rose-300" : "text-emerald-300"}`}>{status}</div>}
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
