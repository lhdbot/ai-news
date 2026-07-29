import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
          <span className="text-lg font-bold tracking-wide">{SITE_NAME}</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href="/" className="transition-colors hover:text-accent">
            今日
          </Link>
          <Link href="/archive" className="transition-colors hover:text-accent">
            归档
          </Link>
          <Link href="/forecast" className="transition-colors hover:text-accent">
            预测
          </Link>
          <Link href="/impact" className="transition-colors hover:text-accent">
            影响分析
          </Link>
          <Link href="/skills" className="transition-colors hover:text-accent">
            Skills
          </Link>
          <a
            href="/feed.xml"
            className="transition-colors hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            RSS
          </a>
        </nav>
      </div>
    </header>
  );
}
