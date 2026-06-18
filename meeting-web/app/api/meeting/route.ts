import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const TEXT_LIMIT = 2000; // Notion rich_text 단일 블록 최대 길이
const CHILDREN_LIMIT = 100; // 한 요청당 children 블록 최대 개수

type Block = Record<string, unknown>;

function chunk(text: string, size = TEXT_LIMIT): string[] {
  if (!text) return [""];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
function richText(text: string) {
  return chunk(text).map((c) => ({ type: "text", text: { content: c } }));
}
function paragraph(text: string): Block {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText(text) } };
}
function heading(level: 1 | 2 | 3, text: string): Block {
  const key = `heading_${level}` as const;
  return { object: "block", type: key, [key]: { rich_text: richText(text) } };
}
function bullet(text: string): Block {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(text) } };
}

/** 간단한 마크다운(제목/불릿/문단)을 Notion 블록으로 변환 */
function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split("\n")) {
    const s = raw.replace(/\*\*(.+?)\*\*/g, "$1").trim();
    if (!s) continue;
    if (s.startsWith("### ")) blocks.push(heading(3, s.slice(4)));
    else if (s.startsWith("## ")) blocks.push(heading(2, s.slice(3)));
    else if (s.startsWith("# ")) blocks.push(heading(1, s.slice(2)));
    else if (s.startsWith("- ") || s.startsWith("* ")) blocks.push(bullet(s.slice(2)));
    else blocks.push(paragraph(s));
  }
  return blocks;
}

function transcriptToBlocks(transcript: string): Block[] {
  const paras = transcript.split("\n").map((p) => p.trim()).filter(Boolean);
  const list = paras.length ? paras : [transcript.trim() || "(내용 없음)"];
  return list.map((p) => paragraph(p));
}

/** Claude로 회의 요약 */
async function summarize(transcript: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 미설정");

  const prompt = `다음은 회의를 음성인식으로 받아쓴 전문입니다. 받아쓰기 특성상 오탈자나 끊김이 있을 수 있으니 맥락으로 자연스럽게 보정해서 이해하세요.
각 줄이 '이름: 발언' 형태로 화자가 표시돼 있으면, 누가 무엇을 말했는지 반영해서 정리하세요.

아래 형식의 한국어 마크다운으로 간결하게 정리해주세요.

## 한 줄 요약
(회의 핵심을 1~2문장으로)

## 핵심 논의
- (주요 논의 사항을 bullet로)

## 결정사항
- (확정된 결정을 bullet로, 없으면 "특별한 결정사항 없음")

## 할 일 (Action Items)
- (담당자가 언급됐다면 "담당자: 내용" 형태로, 없으면 "별도 할 일 없음")

[회의 전문]
${transcript}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude 요약 실패 (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { content?: { text?: string }[] };
  return json.content?.[0]?.text ?? "";
}

/** 입력값(페이지/DB URL 또는 ID)에서 32자리 Notion ID만 추출 */
function extractNotionId(input?: string): string {
  if (!input) return "";
  const m = input.replace(/-/g, "").match(/[0-9a-fA-F]{32}/);
  return m ? m[0] : input.trim();
}

type NotionTarget = { token?: string; pageId?: string; dbId?: string; titleProp?: string };

/** Notion 페이지 생성 후 URL 반환. 사용자가 지정한 토큰/위치를 우선 사용하고, 없으면 서버 기본값. */
async function createNotionPage(title: string, blocks: Block[], target: NotionTarget = {}): Promise<string> {
  const token = (target.token && target.token.trim()) || process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error("Notion 토큰이 없습니다. 페이지의 'Notion 설정'에서 통합 토큰을 입력하세요.");
  }

  const dbId = extractNotionId(target.dbId) || process.env.NOTION_DATABASE_ID?.trim() || "";
  const pageId = extractNotionId(target.pageId) || process.env.NOTION_PARENT_PAGE_ID?.trim() || "";

  let parent: Record<string, string>;
  let properties: Record<string, unknown>;
  if (dbId) {
    const titleProp = (target.titleProp && target.titleProp.trim()) || process.env.NOTION_TITLE_PROPERTY?.trim() || "이름";
    parent = { database_id: dbId };
    properties = { [titleProp]: { title: [{ text: { content: title } }] } };
  } else if (pageId) {
    parent = { page_id: pageId };
    properties = { title: { title: [{ text: { content: title } }] } };
  } else {
    throw new Error("저장할 Notion 페이지(또는 데이터베이스)가 지정되지 않았습니다. 'Notion 설정'에서 페이지를 지정하세요.");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ parent, properties, children: blocks.slice(0, CHILDREN_LIMIT) }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Notion 업로드 실패 (${res.status}): ${detail.slice(0, 400)}`);
  }
  const page = (await res.json()) as { id: string; url?: string };

  const rest = blocks.slice(CHILDREN_LIMIT);
  for (let i = 0; i < rest.length; i += CHILDREN_LIMIT) {
    const batch = rest.slice(i, i + CHILDREN_LIMIT);
    const r = await fetch(`${NOTION_API}/blocks/${page.id}/children`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ children: batch }),
    });
    if (!r.ok) {
      const detail = await r.text();
      throw new Error(`Notion 블록 추가 실패 (${r.status}): ${detail.slice(0, 400)}`);
    }
  }
  return page.url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}`;
}

export async function POST(req: NextRequest) {
  let title = "";
  let transcript = "";
  let wantSummary = true;
  const notion: NotionTarget = {};
  try {
    const body = await req.json();
    title = String(body?.title ?? "").trim();
    transcript = String(body?.transcript ?? "").trim();
    wantSummary = body?.summarize !== false;
    notion.token = String(body?.notionToken ?? "");
    notion.pageId = String(body?.notionPageId ?? "");
    notion.dbId = String(body?.notionDbId ?? "");
    notion.titleProp = String(body?.notionTitleProp ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!transcript) {
    return NextResponse.json({ ok: false, error: "변환된 텍스트가 비어 있습니다." }, { status: 400 });
  }
  if (!title) {
    const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    title = `회의록 ${now}`;
  }

  // 요약은 선택. 끄거나 키가 없으면 Claude를 호출하지 않아 크레딧이 들지 않는다.
  const doSummary = wantSummary && Boolean(process.env.ANTHROPIC_API_KEY);
  let summary: string | null = null;
  let note: string | null = null;
  if (doSummary) {
    try {
      summary = await summarize(transcript);
    } catch (e) {
      summary = null;
      const name = e instanceof Error ? e.name : "Error";
      note = `AI 요약은 생략되었습니다 (${name}). 전문은 정상 저장됩니다.`;
    }
  }

  const blocks: Block[] = [];
  if (summary) {
    blocks.push(...markdownToBlocks(summary));
    blocks.push({ object: "block", type: "divider", divider: {} });
  }
  blocks.push(heading(2, "🎙️ 회의 전문"));
  blocks.push(...transcriptToBlocks(transcript));

  try {
    const url = await createNotionPage(title, blocks, notion);
    return NextResponse.json({ ok: true, url, title, summarized: Boolean(summary), note });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
