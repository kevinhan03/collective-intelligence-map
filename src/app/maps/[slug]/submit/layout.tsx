import type { Metadata } from "next";
import type { ReactNode } from "react";
import { noIndex } from "@/lib/seo";
export const metadata: Metadata = { title: "장소 제안", robots: noIndex };
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
