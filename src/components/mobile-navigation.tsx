"use client";
import { useEffect } from "react";
import Link from "@/i18n/link";
import { usePathname } from "@/i18n/navigation";
import { useI18n } from "@/i18n/client";
import { LanguageSwitch } from "./language-switch";
import { Bookmark, Compass, UserRound, Menu } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
export function MobileNavigation() {
  const pathname = usePathname();
  const { t } = useI18n();
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--mobile-viewport-height",
        `${viewport.height}px`,
      );
    update();
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--mobile-viewport-height");
    };
  }, []);
  const links = [
    {
      href: "/studio",
      label: t("nav.createMap"),
      icon: Compass,
      active: pathname.startsWith("/studio"),
    },
    {
      href: "/",
      label: t("nav.discover"),
      icon: Compass,
      active:
        pathname === "/" ||
        pathname === "/discover" ||
        pathname.startsWith("/maps/"),
    },
    {
      href: "/saved",
      label: t("nav.saved"),
      icon: Bookmark,
      active: pathname === "/saved",
    },
    {
      href: "/settings/profile",
      label: t("nav.account"),
      icon: UserRound,
      active:
        pathname.startsWith("/settings/") ||
        pathname === "/login" ||
        pathname === "/my-proposals",
    },
  ];
  if (pathname === "/admin/catalog") return null;
  return (
    <Dialog>
      <DialogTrigger
        className="mobile-menu-trigger lg:hidden"
        aria-label={t("nav.openMenu")}
      >
        <Menu size={22} />
      </DialogTrigger>
      <DialogContent className="mobile-menu-panel">
        <DialogTitle>{t("nav.menu")}</DialogTitle>
        <DialogDescription>{t("nav.menuDescription")}</DialogDescription>
        <nav className="grid gap-2" aria-label={t("nav.mobileMain")}>
          {links.map(({ href, label, icon: Icon, active }) => (
            <DialogClose asChild key={href}>
              <Link
                href={href}
                prefetch={false}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3"
                aria-current={active ? "page" : undefined}
              >
                <Icon size={21} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </DialogClose>
          ))}
          <LanguageSwitch className="flex min-h-12 items-center gap-3 rounded-xl px-3" />
        </nav>
      </DialogContent>
    </Dialog>
  );
}
