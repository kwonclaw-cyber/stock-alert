"use client";

import { useEffect, useState } from "react";
import { listSounds, getAlarmSound, setAlarmSound, previewSound, primeAudio } from "./alarm";

/** 알림음 선택 + 미리듣기 (개인 설정) */
export default function AlarmSoundPicker() {
  const [sound, setSound] = useState("beepbo");

  useEffect(() => {
    setSound(getAlarmSound());
  }, []);

  return (
    <label className="flex items-center gap-1.5 text-sm text-white/55">
      <span>알림음</span>
      <select
        value={sound}
        onChange={(e) => { primeAudio(); setAlarmSound(e.target.value); setSound(e.target.value); previewSound(e.target.value); }}
        className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-400/60"
      >
        {listSounds().map((s) => (
          <option key={s.id} value={s.id} className="bg-[#23262e]">{s.label}</option>
        ))}
      </select>
      <button
        onClick={() => { primeAudio(); previewSound(sound); }}
        className="rounded-md border border-white/15 px-2 py-1.5 text-xs text-white/70 hover:text-white"
        title="미리듣기"
      >
        ▶ 미리듣기
      </button>
    </label>
  );
}
