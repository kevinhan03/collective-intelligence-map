import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SiteHeader } from "@/components/site-header";
import { Telemetry } from "@/components/telemetry";
import "../globals.css";
import { notFound } from "next/navigation";
import { defaultLocale, hasLocale, locales } from "@/i18n/config";
import { indexedLocales } from "@/i18n/metadata";
import { I18nProvider } from "@/i18n/client";
import { getMessages } from "@/i18n/dictionaries";
import { createTranslator } from "@/i18n/translate";
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
  src: "../../../node_modules/@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-suit",
});
const suitHeavy = localFont({
  src: "../../../node_modules/@sun-typeface/suit/fonts/static/woff2/SUIT-Heavy.woff2",
  weight: "900",
  display: "swap",
  variable: "--font-suit-heavy",
});
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171d25",
  interactiveWidget: "resizes-content",
};
export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : defaultLocale;
  const t = createTranslator(locale, await getMessages(locale));
  const korean = locale === defaultLocale;
  const title = korean ? siteTitle : t("meta.siteTitle");
  const description = korean ? siteDescription : t("meta.siteDescription");
  return {
    metadataBase: new URL(siteOrigin ?? "http://localhost:3000"),
    title: { default: title, template: t("meta.titleTemplate") },
    description,
    robots:
      canIndex && indexedLocales.includes(locale)
        ? { index: true, follow: true }
        : noIndex,
    verification: {
      google: siteVerification.google,
      other: siteVerification.bing
        ? { "msvalidate.01": siteVerification.bing }
        : undefined,
    },
    openGraph: {
      title,
      description,
      siteName: korean ? siteName : "Ting map",
      images: ["/glass-neighborhood-og.jpg"],
      locale: korean ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/glass-neighborhood-og.jpg"],
    },
  };
}
export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}
export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const messages = await getMessages(lang);
  const t = createTranslator(lang, messages);
  return (
    <html
      lang={lang}
      className={`${suit.variable} ${suitHeavy.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <I18nProvider lang={lang} messages={messages}>
          <a href="#main" className="sr-only focus:not-sr-only">
            {t("common.skipToContent")}
          </a>
          <Suspense
            fallback={
              <div className="h-20" aria-label={t("common.loadingMenu")} />
            }
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
        </I18nProvider>
      </body>
    </html>
  );
}
