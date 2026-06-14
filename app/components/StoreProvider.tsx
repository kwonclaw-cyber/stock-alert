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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/data", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: AppData) => {
        if (!alive) return;
        setData(d);
        setSaveState("saved");
      })
      .catch(() => alive && setSaveState("error"));
    return () => {
      alive = false;
    };
  }, []);

  const scheduleSave = useCallback((next: AppData) => {
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 700);
  }, []);

  const update = useCallback(
    (mutator: (draft: AppData) => void) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev) as AppData;
        mutator(next);
        scheduleSave(next);
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
