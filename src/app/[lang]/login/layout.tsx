import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslator } from "@/i18n/server";
import { noIndex } from "@/lib/seo";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("meta.login"), robots: noIndex };
}
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
