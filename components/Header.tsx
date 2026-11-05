"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE_NAME } from "@/lib/site";

const NAV_ITEMS = [
  { href: "/", label: "今日" },
  { href: "/trends", label: "趋势雷达" },
  { href: "/archive", label: "归档" },
  { href: "/impact", label: "影响分析" },
  { href: "/forecast", label: "预测" },
  { href: "/search", label: "搜索" },
  { href: "/skills", label: "Skills" },
] as const;

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (onNavigate?: () => void) =>
    NAV_ITEMS.map((item) => {
      const active =
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={`nav-link ${active ? "active" : ""}`}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <header className="sticky top-0 z-50 border-b border-border-soft bg-bg/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="brand-link flex shrink-0 items-center gap-3">
          <span className="brand-mark" aria-hidden="true">
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" strokeOpacity=".4" />
              <path d="M12 12 L18 7" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span>
            <span className="block text-[19px] font-extrabold tracking-wide">
              {SITE_NAME}
            </span>
            <span className="brand-subtitle">AI DAILY INTEL</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="主导航">
          {links()}
          <a
            href="/feed.xml"
            target="_blank"
            rel="noreferrer"
            className="nav-link"
          >
            RSS
          </a>
        </nav>

        <button
          type="button"
          className="menu-button ml-auto md:hidden"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-navigation" className="mobile-nav md:hidden" aria-label="移动端导航">
          {links(() => setOpen(false))}
          <a
            href="/feed.xml"
            target="_blank"
            rel="noreferrer"
            className="nav-link"
          >
            RSS
          </a>
        </nav>
      )}
    </header>
  );
}
