import type { ReactNode } from "react";
import { noIndex } from "@/lib/seo";
export const metadata = { title: "크리에이터 스튜디오", robots: noIndex };
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
