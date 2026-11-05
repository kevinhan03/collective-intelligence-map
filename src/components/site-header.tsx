import { CatalogSessionGuard } from "./admin/catalog-session-guard";
import Link from "@/i18n/link";
import { connection } from "next/server";
import { ArrowUpRight, Bookmark, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/server/queries";
import { ScrollHeader } from "./scroll-header";
import { LanguageSwitch } from "./language-switch";
import { getTranslator } from "@/i18n/server";
export async function SiteHeader() {
  // Auth SDK session expiry checks belong to request-time rendering.
  await connection();
  const [viewer, t] = await Promise.all([getViewer(), getTranslator()]);
  return (
    <ScrollHeader>
      <CatalogSessionGuard userId={viewer?.id ?? null} />
      <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between gap-4 px-5 md:px-9">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2.5"
          aria-label={t("nav.home")}
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <MapIcon size={20} />
          </span>
          <span className="font-heading text-xl font-black tracking-tight">
            Ting<span className="text-muted-foreground"> map</span>
          </span>
        </Link>
        <nav
          className="hidden items-center gap-2 lg:flex lg:gap-6"
          aria-label={t("nav.main")}
        >
          <LanguageSwitch className="flex items-center gap-1.5 text-sm text-muted-foreground" />
          <Link
            href="/saved"
            prefetch={false}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Bookmark size={16} />
            <span className="hidden sm:inline">{t("nav.saved")}</span>
          </Link>
          {viewer ? (
            <>
              <Link
                href="/studio"
                prefetch={false}
                className="text-sm text-muted-foreground"
              >
                {t("nav.myMaps")}
              </Link>
              <Link
                href="/my-proposals"
                prefetch={false}
                className="text-sm text-muted-foreground"
              >
                {t("nav.myProposals")}
              </Link>
              <Link
                href="/settings/profile"
                prefetch={false}
                className="rounded-full bg-secondary px-3 py-2 text-xs font-medium"
              >
                @{viewer.handle}
              </Link>
              {viewer.role === "admin" && (
                <span className="flex items-center gap-4">
                  <Link
                    href="/admin/catalog"
                    prefetch={false}
                    className="text-xs"
                  >
                    {t("nav.homeContent")}
                  </Link>
                  <Link
                    href="/admin/moderation"
                    prefetch={false}
                    className="text-xs"
                  >
                    {t("nav.admin")}
                  </Link>
                </span>
              )}
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login" prefetch={false}>
                {t("nav.login")}
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </ScrollHeader>
  );
}
