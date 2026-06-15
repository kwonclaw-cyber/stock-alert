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
const VER_KEY = "naesu:version";

const FILE_PATH = path.join(process.cwd(), ".data", "store.json");
const VER_PATH = path.join(process.cwd(), ".data", "version");

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

/** 데이터를 저장하고 변경 버전(타임스탬프)을 갱신한다. */
export async function writeData(data: AppData): Promise<number> {
  const version = Date.now();
  if (usingKv) {
    await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify(data),
    });
    await fetch(`${KV_URL}/set/${VER_KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: String(version),
    });
    return version;
  }

  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  await fs.writeFile(VER_PATH, String(version), "utf8");
  return version;
}

/** 현재 데이터 버전(마지막 저장 시각). 변경 감지용 경량 신호. */
export async function readVersion(): Promise<number> {
  if (usingKv) {
    try {
      const res = await fetch(`${KV_URL}/get/${VER_KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: "no-store",
      });
      const json = (await res.json()) as { result?: string | null };
      return json.result ? Number(json.result) || 0 : 0;
    } catch {
      return 0;
    }
  }
  try {
    return Number(await fs.readFile(VER_PATH, "utf8")) || 0;
  } catch {
    return 0;
  }
}
