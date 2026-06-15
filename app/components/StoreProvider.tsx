"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AppData } from "@/lib/data";

export type SaveState = "loading" | "saved" | "saving" | "error";

type StoreContext = {
  data: AppData | null;
  saveState: SaveState;
  /** 초안을 수정한다. mutator로 next 데이터를 직접 변경. */
  update: (mutator: (draft: AppData) => void) => void;
};

const Ctx = createContext<StoreContext | null>(null);

const SAVE_DEBOUNCE = 600; // ms
const POLL_INTERVAL = 2000; // ms (라이브 동기화 주기)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(0); // 편집 발생 횟수
  const savedAt = useRef(0); // 마지막으로 저장 완료된 dirty 값
  const lastVersion = useRef(0); // 마지막으로 알고 있는 서버 버전
  const latest = useRef<AppData | null>(null); // 최신 로컬 데이터(저장용)

  const isIdle = () => dirty.current === savedAt.current;

  // 최초 로드
  useEffect(() => {
    let alive = true;
    fetch("/api/data", { cache: "no-store" })
      .then(async (r) => {
        lastVersion.current = Number(r.headers.get("x-data-version")) || 0;
        return r.json();
      })
      .then((d: AppData) => {
        if (!alive) return;
        latest.current = d;
        setData(d);
        setSaveState("saved");
      })
      .catch(() => alive && setSaveState("error"));
    return () => {
      alive = false;
    };
  }, []);

  // 라이브 동기화: 버전이 바뀌고 편집 중이 아니면 최신 데이터를 받아 반영
  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      if (!alive || !isIdle()) return;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { version } = (await r.json()) as { version: number };
        if (!alive || version === lastVersion.current || !isIdle()) return;
        const dr = await fetch("/api/data", { cache: "no-store" });
        const dv = Number(dr.headers.get("x-data-version")) || version;
        const fresh = (await dr.json()) as AppData;
        if (!alive || !isIdle()) return; // 받는 사이 편집 시작했으면 버림
        lastVersion.current = dv;
        latest.current = fresh;
        setData(fresh);
      } catch {
        // 네트워크 일시 오류 무시
      }
    }, POLL_INTERVAL);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const snapshotDirty = dirty.current;
      try {
        const res = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(latest.current),
        });
        const json = (await res.json()) as { ok: boolean; version?: number };
        if (res.ok && json.ok) {
          savedAt.current = snapshotDirty;
          if (json.version) lastVersion.current = json.version;
          setSaveState(isIdle() ? "saved" : "saving");
        } else {
          setSaveState("error");
        }
      } catch {
        setSaveState("error");
      }
    }, SAVE_DEBOUNCE);
  }, []);

  const update = useCallback(
    (mutator: (draft: AppData) => void) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev) as AppData;
        mutator(next);
        latest.current = next;
        dirty.current += 1;
        scheduleSave();
        return next;
      });
    },
    [scheduleSave],
  );

  return <Ctx.Provider value={{ data, saveState, update }}>{children}</Ctx.Provider>;
}

export function useStore(): StoreContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
