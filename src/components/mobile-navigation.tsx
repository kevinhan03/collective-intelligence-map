"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, UserRound } from "lucide-react";

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
    <nav className="mobile-navigation lg:hidden" aria-label="모바일 주요 메뉴">
      {links.map(({ href, label, icon: Icon, active }) => (
        <Link key={href} href={href} aria-current={active ? "page" : undefined}>
          <Icon size={21} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
