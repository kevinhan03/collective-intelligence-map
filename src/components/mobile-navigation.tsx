"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
      href: "/",
      label: "발견",
      icon: Compass,
      active:
        pathname === "/" ||
        pathname === "/discover" ||
        pathname.startsWith("/maps/"),
    },
    {
      href: "/saved",
      label: "저장",
      icon: Bookmark,
      active: pathname === "/saved",
    },
    {
      href: "/settings/profile",
      label: "내 정보",
      icon: UserRound,
      active:
        pathname.startsWith("/settings/") ||
        pathname === "/login" ||
        pathname === "/my-proposals",
    },
  ];
  return (
    <Dialog>
      <DialogTrigger
        className="mobile-menu-trigger lg:hidden"
        aria-label="메뉴 열기"
      >
        <Menu size={22} />
      </DialogTrigger>
      <DialogContent className="mobile-menu-panel">
        <DialogTitle>메뉴</DialogTitle>
        <DialogDescription>
          지도를 탐색하고 저장한 장소를 확인하세요.
        </DialogDescription>
        <nav className="grid gap-2" aria-label="모바일 주요 메뉴">
          {links.map(({ href, label, icon: Icon, active }) => (
            <DialogClose asChild key={href}>
              <Link
                href={href}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3"
                aria-current={active ? "page" : undefined}
              >
                <Icon size={21} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </DialogClose>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
