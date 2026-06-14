"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        setLoading(false);
        return;
      }
      router.replace(next);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">내수서버</h1>
          <p className="mt-1 text-sm text-white/50">길드 운영 페이지 · 접속 인증</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/70">
              접속 비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
              placeholder="공유받은 비밀번호를 입력하세요"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "확인 중..." : "입장하기"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          비밀번호는 길드 운영진에게 문의하세요.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
