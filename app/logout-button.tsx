"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
    >
      로그아웃
    </button>
  );
}
