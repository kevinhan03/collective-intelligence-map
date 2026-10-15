import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SiteHeader } from "@/components/site-header";
import { Telemetry } from "@/components/telemetry";
import "./globals.css";
import {
  canIndex,
  noIndex,
  siteOrigin,
  siteVerification,
  siteName,
  siteTitle,
  siteDescription,
} from "@/lib/seo";
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
const title = siteTitle;
const description = siteDescription;
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171d25",
  interactiveWidget: "resizes-content",
};
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin ?? "http://localhost:3000"),
  title: { default: title, template: "%s · 팅맵 (Ting map)" },
  description,
  robots: canIndex ? { index: true, follow: true } : noIndex,
  verification: {
    google: siteVerification.google,
    other: siteVerification.bing
      ? { "msvalidate.01": siteVerification.bing }
      : undefined,
  },
  openGraph: {
    title,
    description,
    siteName,
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
          <MobileNavigation />
        </Suspense>
        <Suspense fallback={null}>
          <Telemetry />
        </Suspense>
      </body>
    </html>
  );
}
