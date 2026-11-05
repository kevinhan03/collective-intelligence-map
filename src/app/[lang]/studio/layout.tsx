import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslator } from "@/i18n/server";
import { noIndex } from "@/lib/seo";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("meta.studio"), robots: noIndex };
}
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
