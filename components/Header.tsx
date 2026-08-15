import Link from "next/link";
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
  return (
    <header className="sticky top-0 z-50 border-b border-border-soft bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-accent/35"
            style={{
              background: "linear-gradient(135deg,#123324,#0e1a2a)",
              boxShadow: "0 0 18px rgba(47,232,154,.15) inset",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2fe89a"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" strokeOpacity=".4" />
              <path d="M12 12 L18 7" />
              <circle cx="12" cy="12" r="1.6" fill="#2fe89a" stroke="none" />
            </svg>
          </span>
          <span>
            <span className="block text-[19px] font-extrabold tracking-wide">
              {SITE_NAME}
            </span>
            <span className="block font-mono text-[9.5px] tracking-[2.5px] text-faint">
              AI DAILY INTEL
            </span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto text-[13.5px]">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-white/5 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
          <a
            href="/feed.xml"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-white/5 hover:text-fg"
          >
            RSS
          </a>
        </nav>
      </div>
    </header>
  );
}
