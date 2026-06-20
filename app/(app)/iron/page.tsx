"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import GuildSelect from "../../components/GuildSelect";
import PageHelp from "../../components/PageHelp";
import { confirmDelete } from "@/lib/confirmDelete";
import { resolveMembers } from "../../components/useMembers";
import { startAlarm, primeAudio, notify, requestNotifyPermission } from "../../components/alarm";
import AlarmSoundPicker from "../../components/AlarmSoundPicker";
import { todayKey, uid } from "@/lib/data";

function remainLabel(lastDoneAt: string | null, cooldownMin: number, now: number) {
  if (cooldownMin <= 0 || !lastDoneAt) return null;
  const ms = new Date(lastDoneAt).getTime() + cooldownMin * 60_000 - now;
  if (ms <= 0) return { ready: true, text: "가능" };
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return { ready: false, text: h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}` };
}

export default function IronPage() {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [alarmKeys, setAlarmKeys] = useState<Set<string>>(new Set());
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("iron-alarm-keys") || "[]");
      if (Array.isArray(saved)) setAlarmKeys(new Set(saved as string[]));
    } catch {
      // 무시
    }
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const iron = data?.iron;
  const members = data && iron ? resolveMembers(data, iron.guildId, iron.manualMembers) : [];

  // 내가 알림 켠 문파원만, 철넣기 다시 가능해지면(0분 전) 1회 알림
  useEffect(() => {
    if (!data || !iron || iron.cooldownMin <= 0 || alarmKeys.size === 0) return;
    for (const m of members) {
      if (!alarmKeys.has(m.key)) continue;
      const r = iron.records[m.key];
      if (!r?.lastDoneAt) continue;
      const next = new Date(r.lastDoneAt).getTime() + iron.cooldownMin * 60_000;
      const key = `${m.key}:${r.lastDoneAt}`;
      if (Date.now() >= next && !fired.current.has(key)) {
        fired.current.add(key);
        startAlarm(`⛏ ${m.name} 철넣기 가능!`);
        notify("⛏ 철넣기 가능", `${m.name} 철넣기 가능 시간입니다.`);
      }
    }
  }, [now, alarmKeys, data, iron, members]);

  if (!data || !iron) return <Loading />;

  const today = todayKey();

  function toggleMemberAlarm(memberKey: string) {
    primeAudio();
    setAlarmKeys((prev) => {
      const next = new Set(prev);
      if (next.has(memberKey)) next.delete(memberKey);
      else next.add(memberKey);
      localStorage.setItem("iron-alarm-keys", JSON.stringify([...next]));
      return next;
    });
  }
  function clearAlarms() {
    setAlarmKeys(new Set());
    localStorage.setItem("iron-alarm-keys", "[]");
  }
  async function askPerm() {
    setPerm(await requestNotifyPermission());
  }

  const rec = (key: string) => iron.records[key] ?? { lastDoneAt: null, daily: {} };
  const todayCount = (key: string) => rec(key).daily[today] ?? 0;
  const totalDoneToday = members.reduce((sum, m) => sum + todayCount(m.key), 0);

  function complete(key: string) {
    update((d) => {
      const r = d.iron.records[key] ?? { lastDoneAt: null, daily: {} };
      r.lastDoneAt = new Date().toISOString();
      r.daily[today] = (r.daily[today] ?? 0) + 1;
      d.iron.records[key] = r;
    });
  }
  function undo(key: string) {
    update((d) => {
      const r = d.iron.records[key];
      if (!r) return;
      r.daily[today] = Math.max(0, (r.daily[today] ?? 0) - 1);
      r.lastDoneAt = null; // 쿨타임 해제 → 다시 완료 가능
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHelp>
        문파원별 <b>철넣기 완료</b>를 누르면 오늘 횟수가 1 올라가고 시간이 기록돼요. 주기(분)를 설정하면 다음 가능 시각까지 카운트다운이 표시되고, 그동안 버튼은 <b>대기중</b>으로 잠겨요(↺로 취소·해제). 각 문파원의 <b>🔔</b>을 켜면 <b>그 사람만</b> 다시 가능해질 때(0분 전) 소리가 <b>종료를 누를 때까지</b> 울려요. <b>알림은 개인 설정</b>이라(내 브라우저에만 저장) 본인이 원하는 인원만 골라 켜면 됩니다. (탭 열려 있어야 동작 · 명단은 멤버현황 연동)
      </PageHelp>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <GuildSelect guilds={data.guilds} value={iron.guildId} onChange={(id) => update((d) => { d.iron.guildId = id; })} />
        <label className="flex items-center gap-1.5 text-sm text-white/50">
          철넣기 주기
          <TextInput type="number" value={iron.cooldownMin} onChange={(v) => update((d) => { d.iron.cooldownMin = Number(v) || 0; })} className="w-20" />
          분 <span className="text-xs text-white/30">(0=타이머 없음)</span>
        </label>
        {alarmKeys.size > 0 && perm !== "granted" && (
          <Btn onClick={askPerm} className="!py-1.5">알림 권한 허용</Btn>
        )}
        <span className="rounded-md border border-white/15 px-2.5 py-1.5 text-sm text-white/55" title="이 브라우저에서 알림 켠 문파원 수 (개인 설정)">
          🔔 내 알림 {alarmKeys.size}명
        </span>
        <AlarmSoundPicker />
        {alarmKeys.size > 0 && (
          <button onClick={clearAlarms} className="text-xs text-white/45 hover:text-white">모두 끄기</button>
        )}
        <div className="ml-auto rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm">
          <span className="text-white/60">오늘 누적 완료</span>{" "}
          <b className="text-emerald-300">{totalDoneToday}</b>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15171c]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-[11px] font-medium text-white/45">
              <th className="w-10 border-b border-white/10 py-2 text-center">#</th>
              <th className="w-12 border-b border-white/10 py-2 text-center" title="내 알림 (개인 설정)">알림</th>
              <th className="border-b border-white/10 py-2 text-left">문파원</th>
              <th className="border-b border-white/10 py-2 text-center">마지막 완료</th>
              {iron.cooldownMin > 0 && <th className="border-b border-white/10 py-2 text-center">다음 가능</th>}
              <th className="w-24 border-b border-white/10 py-2 text-center">오늘 횟수</th>
              <th className="w-40 border-b border-white/10 py-2 text-center">완료 체크</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const r = rec(m.key);
              const remain = remainLabel(r.lastDoneAt, iron.cooldownMin, now);
              const cnt = todayCount(m.key);
              const onCooldown = remain ? !remain.ready : false; // 넣어서 시간 도는 중
              return (
                <tr key={m.key} className={`border-t border-white/5 transition hover:bg-white/[0.04] ${onCooldown ? "" : "bg-red-500/[0.07]"}`}>
                  <td className="py-1.5 text-center text-[11px] text-white/35">{i + 1}</td>
                  <td className="py-1.5 text-center">
                    <button
                      onClick={() => toggleMemberAlarm(m.key)}
                      title={alarmKeys.has(m.key) ? "내 알림 켜짐 — 클릭해서 끄기" : "내 알림 끄기 — 클릭해서 켜기"}
                      className={`text-base transition ${alarmKeys.has(m.key) ? "opacity-100" : "opacity-25 grayscale hover:opacity-60"}`}
                    >
                      🔔
                    </button>
                  </td>
                  <td className="py-1.5 pl-3 text-left">
                    {m.manual ? (
                      <ManualName
                        value={m.name}
                        onChange={(v) => update((d) => { const mm = d.iron.manualMembers.find((x) => `m:${x.id}` === m.key); if (mm) mm.name = v; })}
                        onRemove={() => update((d) => { d.iron.manualMembers = d.iron.manualMembers.filter((x) => `m:${x.id}` !== m.key); })}
                      />
                    ) : (
                      <span className="text-white/85">{m.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-center text-xs text-white/45">
                    {r.lastDoneAt ? new Date(r.lastDoneAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  {iron.cooldownMin > 0 && (
                    <td className={`py-1.5 text-center font-mono text-xs ${remain?.ready ? "text-emerald-400" : "text-white/60"}`}>
                      {remain ? remain.text : "—"}
                    </td>
                  )}
                  <td className="py-1.5 text-center">
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm font-bold ${cnt > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-white/40"}`}>
                      {cnt}
                    </span>
                  </td>
                  <td className="py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {onCooldown ? (
                        <Btn variant="primary" disabled title={`다음 가능까지 대기 (${remain!.text})`} className="!py-1 !text-xs">대기중</Btn>
                      ) : (
                        <button
                          onClick={() => complete(m.key)}
                          title="철 구워!!"
                          className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-sm transition hover:bg-red-400"
                        >
                          철구워!!
                        </button>
                      )}
                      <button onClick={() => undo(m.key)} className="px-1 text-white/35 hover:text-white" title="1회 취소(쿨타임 해제)">↺</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <Btn variant="ghost" onClick={() => update((d) => { d.iron.manualMembers.push({ id: uid(), name: "" }); })}>
          + 문파원 수동 추가
        </Btn>
      </div>
    </div>
  );
}

function ManualName({ value, onChange, onRemove }: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <TextInput value={value} onChange={onChange} placeholder="이름(수동)" className="w-28 !py-1" />
      <button onClick={() => { if (confirmDelete("이 인원을 삭제할까요?")) onRemove(); }} className="text-red-300/50 hover:text-red-300" title="삭제">×</button>
    </span>
  );
}
