import type { Metadata } from "next";
import "./globals.css";
import { validateEnv } from "@/lib/validation";

// 애플리케이션 시작 시 환경 변수 검증
validateEnv();

export const metadata: Metadata = {
  title: "DocInsight",
  description: "문서 기반 검색과 답변 생성 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
