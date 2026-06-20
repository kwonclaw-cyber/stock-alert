"use client";

import { JOBS, HIDDEN_JOBS, jobColorClass } from "@/lib/guilds";

/** 직업 선택 드롭다운 (표 셀용). 직업별로 글자색이 입혀진다. */
export function JobSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const known = value === "" || (JOBS as readonly string[]).includes(value) || (HIDDEN_JOBS as readonly string[]).includes(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full cursor-pointer rounded bg-transparent px-1 py-1 text-center font-bold outline-none transition focus:bg-white/10 ${jobColorClass(value)} ${className}`}
    >
      <option value="" className="text-black">직업</option>
      <optgroup label="일반">
        {JOBS.map((j) => (
          <option key={j} value={j} className="text-black">{j}</option>
        ))}
      </optgroup>
      <optgroup label="히든">
        {HIDDEN_JOBS.map((j) => (
          <option key={j} value={j} className="text-black">✦ {j}</option>
        ))}
      </optgroup>
      {!known && (
        <option value={value} className="text-black">{value}</option>
      )}
    </select>
  );
}

/** 흰 셀 안에 들어가는 테두리 없는 입력 (표 셀용) */
export function CellInput({
  value,
  onChange,
  type = "text",
  className = "",
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded bg-transparent px-1 py-1 text-center text-white/85 outline-none transition placeholder:text-white/20 focus:bg-white/10 ${className}`}
    />
  );
}

/** 어두운 폼에서 쓰는 텍스트 입력 */
export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 ${className}`}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-y rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 ${className}`}
    />
  );
}

/** 작은 버튼 */
export function Btn({
  children,
  onClick,
  variant = "default",
  className = "",
  title,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const styles = {
    default: "border border-white/15 text-white/80 hover:border-white/30 hover:text-white",
    primary: "bg-emerald-500 text-black font-semibold hover:bg-emerald-400",
    danger: "border border-red-500/30 text-red-300 hover:bg-red-500/10",
    ghost: "text-white/40 hover:text-white/80",
  }[variant];
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`rounded-md px-2.5 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-current ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
