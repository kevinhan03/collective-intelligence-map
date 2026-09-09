import Link from "next/link";
import { ArrowUpRight, Bookmark, Compass, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/server/queries";
export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between gap-4 px-5 md:px-9">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Collective Map 홈"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <MapIcon size={20} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            collective<span className="text-muted-foreground"> map</span>
            <span className="ml-2 hidden align-top text-[9px] tracking-widest text-primary sm:inline">
              BETA
            </span>
          </span>
        </Link>
        <nav
          className="flex items-center gap-2 md:gap-6"
          aria-label="주요 메뉴"
        >
          <Link
            href="/"
            className="hidden items-center gap-2 text-sm font-medium sm:flex"
          >
            <Compass size={16} />
            커뮤니티 탐색
          </Link>
          <Link
            href="/saved"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Bookmark size={16} />
            <span className="hidden sm:inline">저장한 장소</span>
          </Link>
          {viewer ? (
            <>
              <Link
                href="/settings/profile"
                className="rounded-full bg-secondary px-3 py-2 text-xs font-medium"
              >
                @{viewer.handle}
              </Link>
              {viewer.role === "admin" && (
                <Link href="/admin/moderation" className="text-xs">
                  관리
                </Link>
              )}
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">
                참여하기
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
