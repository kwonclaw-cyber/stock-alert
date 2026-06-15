"use client";

/** 서버 프록시(/api/discord)를 통해 디스코드 웹훅으로 메시지를 보낸다 */
export async function sendDiscord(webhook: string, content: string): Promise<boolean> {
  if (!webhook) return false;
  try {
    const r = await fetch("/api/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhook, content }),
    });
    const j = (await r.json()) as { ok?: boolean };
    return Boolean(j.ok);
  } catch {
    return false;
  }
}
