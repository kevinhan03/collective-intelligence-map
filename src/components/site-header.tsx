import Link from "next/link";
import { ArrowUpRight, Bookmark, Compass, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNavigation } from "@/components/mobile-navigation";
import { getViewer } from "@/server/queries";
export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="glass-panel glass-header sticky top-3 z-30">
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
          className="hidden items-center gap-2 lg:flex lg:gap-6"
          aria-label="주요 메뉴"
        >
          <Link
            href="/"
            className="hidden items-center gap-2 text-sm font-medium sm:flex"
          >
            <Compass size={16} />
            발견
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
                로그인
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          )}
        </nav>
        <div className="flex items-center gap-1 lg:hidden">
          <Link
            href="/saved"
            aria-label="저장한 장소"
            className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Bookmark size={20} />
          </Link>
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
