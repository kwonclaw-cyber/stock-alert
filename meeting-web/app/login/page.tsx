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
    <main className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">🎙️ 회의록</h1>
        <p className="login-sub">녹음 · 텍스트 변환 · Notion 업로드 · 접속 인증</p>
        <form onSubmit={handleSubmit}>
          <label className="label" htmlFor="password">접속 비밀번호</label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="공유받은 비밀번호를 입력하세요"
          />
          {error && (
            <p className="result err" style={{ marginTop: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="btn btn-save"
            style={{ width: "100%", marginTop: 16 }}
          >
            {loading ? "확인 중..." : "입장하기"}
          </button>
        </form>
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
