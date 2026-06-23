"use client";

import { useState } from "react";
import { useStore } from "../../components/StoreProvider";
import { TextInput, TextArea, Btn } from "../../components/fields";
import Loading from "../../components/Loading";
import type { OwnerInfo } from "@/lib/data";

type Field = {
  key: keyof OwnerInfo;
  label: string;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
};

const FIELDS: Field[] = [
  { key: "ownerName",    label: "대표자 성함",   placeholder: "홍길동" },
  { key: "ownerPhone",   label: "대표자 연락처", placeholder: "010-0000-0000", type: "tel" },
  { key: "email",        label: "이메일 주소",   placeholder: "example@email.com", type: "email" },
  { key: "storePhone",   label: "매장 전화번호", placeholder: "02-0000-0000", type: "tel" },
  { key: "storeAddress", label: "매장 주소",     placeholder: "서울시 ...", multiline: true },
  { key: "naverId",      label: "네이버 ID",     placeholder: "naver_id" },
  { key: "naverPw",      label: "네이버 PW",     placeholder: "••••••••", type: "password" },
  { key: "storeKey",     label: "매장 키 정보",  placeholder: "키 정보 입력", multiline: true },
];

export default function OwnerPage() {
  const { data, update } = useStore();
  const [showPw, setShowPw] = useState(false);

  if (!data) return <Loading />;

  const info = data.ownerInfo;

  function set(key: keyof OwnerInfo, value: string) {
    update((d) => { d.ownerInfo[key] = value; });
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h2 className="text-lg font-bold">사장님 정보</h2>

      {FIELDS.map(({ key, label, placeholder, type, multiline }) => {
        const isPw = key === "naverPw";
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/70">{label}</label>
            {multiline ? (
              <TextArea
                value={info[key]}
                onChange={(v) => set(key, v)}
                placeholder={placeholder}
                rows={2}
              />
            ) : (
              <div className="flex items-center gap-2">
                <TextInput
                  value={info[key]}
                  onChange={(v) => set(key, v)}
                  placeholder={placeholder}
                  type={isPw ? (showPw ? "text" : "password") : (type ?? "text")}
                  className="flex-1"
                />
                {isPw && (
                  <Btn variant="ghost" onClick={() => setShowPw((v) => !v)}>
                    {showPw ? "숨기기" : "보기"}
                  </Btn>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
