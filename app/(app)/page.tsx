"use client";

import { useStore } from "../components/StoreProvider";
import { CellInput, JobSelect, Btn } from "../components/fields";
import Loading from "../components/Loading";
import PageHelp from "../components/PageHelp";
import { confirmDelete } from "@/lib/confirmDelete";

export default function MembersPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <div>
      <PageHelp>
        문파별 <b>멤버 명단</b>을 관리하는 곳이에요. 이름·직업을 입력하면 내실현황판·철타이머·일숙 등 다른 페이지에 <b>자동으로 연동</b>됩니다. “+ 멤버 추가”로 인원을 늘릴 수 있어요.
      </PageHelp>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.guilds.map((guild, gi) => (
          <section key={guild.id} className="rounded-xl border border-white/10 bg-[#15171c] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">{guild.name} 문파</h2>
              <span className="text-xs text-white/40">{guild.members.length}명</span>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[11px] font-medium text-white/45">
                  <th className="w-8 border-b border-white/10 py-1.5 text-center">#</th>
                  <th className="border-b border-white/10 py-1.5 text-left">이름</th>
                  <th className="border-b border-white/10 py-1.5 text-left">직업</th>
                  <th className="w-8 border-b border-white/10 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {guild.members.map((m, mi) => (
                  <tr key={mi} className="border-t border-white/5 transition hover:bg-white/[0.025]">
                    <td className="py-0.5 text-center text-[11px] text-white/35">
                      {mi === 0 ? "★" : mi + 1}
                    </td>
                    <td className="px-1 py-0.5">
                      <CellInput
                        value={m.name}
                        placeholder={mi === 0 ? "문주" : "이름"}
                        className="!text-left"
                        onChange={(v) =>
                          update((d) => {
                            d.guilds[gi].members[mi].name = v;
                          })
                        }
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <JobSelect
                        value={m.job}
                        className="!text-left"
                        onChange={(v) =>
                          update((d) => {
                            d.guilds[gi].members[mi].job = v;
                          })
                        }
                      />
                    </td>
                    <td className="text-center">
                      {mi !== 0 && (
                        <button
                          onClick={() => {
                            if (!confirmDelete("이 멤버를 삭제할까요?")) return;
                            update((d) => {
                              d.guilds[gi].members.splice(mi, 1);
                            });
                          }}
                          className="px-1 text-red-300/50 hover:text-red-300"
                          title="삭제"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2">
              <Btn
                variant="ghost"
                onClick={() =>
                  update((d) => {
                    d.guilds[gi].members.push({
                      name: "",
                      job: "",
                      weapon: "",
                      internal: "",
                      evasion: "",
                      atkSpeed: "",
                      sum: "",
                      helmet: "",
                      armor: "",
                      belt: "",
                      shoes: "",
                      ring: "",
                      health: "",
                      dopingLuck: "",
                      mount: "",
                    });
                  })
                }
              >
                + 멤버 추가
              </Btn>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
