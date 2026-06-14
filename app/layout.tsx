import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "내수서버 길드 운영",
  description: "숲(SOOP) 방송인 마인크래프트 내수서버 길드 운영 페이지",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
