import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site-header";
import { Telemetry } from "@/components/telemetry";
import "./globals.css";
const suit = localFont({
  src: "../../node_modules/@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-suit",
});
const suitHeavy = localFont({
  src: "../../node_modules/@sun-typeface/suit/fonts/static/woff2/SUIT-Heavy.woff2",
  weight: "900",
  display: "swap",
  variable: "--font-suit-heavy",
});
const title = "Ting map — 취향이 모이는 지도";
const description =
  "장소를 넘어, 맥락을 발견하세요. 함께 추천하고 검증하는 공개 주제 커뮤니티.";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171d25",
  interactiveWidget: "resizes-content",
};
export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: { default: title, template: "%s · Ting map" },
  description,
  openGraph: {
    title,
    description,
    siteName: "Ting map",
    images: ["/glass-neighborhood-og.jpg"],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/glass-neighborhood-og.jpg"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${suit.variable} ${suitHeavy.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only">
          본문으로 건너뛰기
        </a>
        <Suspense
          fallback={<div className="h-20" aria-label="메뉴 불러오는 중" />}
        >
          <SiteHeader />
        </Suspense>
        {children}
        <Suspense fallback={null}>
          <Telemetry />
        </Suspense>
      </body>
    </html>
  );
}
