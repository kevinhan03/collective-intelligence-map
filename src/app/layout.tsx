import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata: Metadata = {
  title: {
    default: "Collective Map — 취향이 모이는 지도",
    template: "%s · Collective Map",
  },
  description:
    "장소를 넘어, 맥락을 발견하세요. 함께 추천하고 검증하는 공개 주제 커뮤니티.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only focus:not-sr-only">
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
