import { promises as fs } from "fs";
import path from "path";
import { type AppData, defaultData, normalizeData } from "./data";

/**
 * 앱 데이터 저장소.
 *
 * - Vercel KV / Upstash Redis 환경변수가 있으면 그쪽에 저장(여러 명이 라이브 공유).
 *   KV_REST_API_URL, KV_REST_API_TOKEN 필요.
 * - 없으면 로컬 파일(.data/store.json)에 저장(개발용 / 단일 인스턴스).
 *
 * ⚠️ Vercel 배포에서 여러 명이 함께 수정하려면 KV 스토어 연결이 필요하다.
 *    (파일 저장은 서버리스 환경에서 영구 보존되지 않음)
 */

// Vercel KV(=Upstash) 환경변수: 두 가지 명명 규칙 모두 지원
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_KEY = "naesu:appdata";

const FILE_PATH = path.join(process.cwd(), ".data", "store.json");

export const usingKv = Boolean(KV_URL && KV_TOKEN);

export async function readData(): Promise<AppData> {
  if (usingKv) {
    try {
      const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: "no-store",
      });
      const json = (await res.json()) as { result?: string | null };
      if (json.result) return normalizeData(JSON.parse(json.result));
    } catch {
      // 실패 시 기본값
    }
    return defaultData();
  }

  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    return normalizeData(JSON.parse(raw));
  } catch {
    return defaultData();
  }
}

export async function writeData(data: AppData): Promise<void> {
  if (usingKv) {
    await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify(data),
    });
    return;
  }

  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}
