"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Menu, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MobileNavigation() {
  const pathname = usePathname();
  const links = [
    {
      href: "/",
      label: "발견",
      icon: Compass,
      active: pathname === "/" || pathname.startsWith("/maps/"),
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
      active: pathname.startsWith("/settings/") || pathname === "/login",
    },
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="lg:hidden"
          variant="ghost"
          size="icon"
          aria-label="메뉴 열기"
        >
          <Menu size={21} />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="!top-[calc(env(safe-area-inset-top)+68px)] !right-4 !left-auto !w-56 !translate-x-0 !translate-y-0 gap-1 rounded-2xl bg-card p-2 shadow-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">메뉴</DialogTitle>
        <nav aria-label="모바일 주요 메뉴" className="grid gap-1">
          {links.map(({ href, label, icon: Icon, active }) => (
            <DialogClose asChild key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-primary"
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            </DialogClose>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
