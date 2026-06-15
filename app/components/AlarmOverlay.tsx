"use client";

import { useEffect, useState } from "react";
import { isAlarmRinging, getAlarmLabel, stopAlarm, subscribeAlarm } from "./alarm";

/** 알람이 울리는 동안 화면 상단에 표시되는 배너 (종료 버튼으로 정지) */
export default function AlarmOverlay() {
  const [ringing, setRinging] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const update = () => {
      setRinging(isAlarmRinging());
      setLabel(getAlarmLabel());
    };
    update();
    return subscribeAlarm(update);
  }, []);

  if (!ringing) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-3">
      <div className="flex items-center gap-3 rounded-xl border border-red-400/50 bg-[#2a1416] px-4 py-3 shadow-2xl">
        <span className="animate-pulse text-xl">🔔</span>
        <span className="text-sm font-bold text-white">{label}</span>
        <button
          onClick={stopAlarm}
          className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-red-400"
        >
          종료
        </button>
      </div>
    </div>
  );
}
