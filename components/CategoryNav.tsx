import Link from "next/link";
import { CATEGORIES, CATEGORY_SLUGS } from "@/lib/news";

/** 左侧/顶部 分类快速导航；active 高亮当前板块 */
export default function CategoryNav({
  counts,
  active,
}: {
  counts: Record<string, number>;
  active?: string;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5 text-sm lg:sticky lg:top-20 lg:flex-col lg:gap-1">
      <p className="mb-1 hidden text-xs font-semibold tracking-wider text-muted lg:block">
        快速导航
      </p>
      <Link
        href="/"
        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-colors lg:px-2 ${
          !active
            ? "bg-accent/10 text-accent"
            : "text-muted hover:text-accent"
        }`}
      >
        <span>今日总览</span>
      </Link>
      {CATEGORIES.map((category) => (
        <Link
          key={category}
          href={`/category/${CATEGORY_SLUGS[category]}`}
          className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-colors lg:px-2 ${
            active === category
              ? "bg-accent/10 text-accent"
              : "border border-border/60 text-muted hover:border-accent/50 hover:text-accent lg:border-0"
          }`}
        >
          <span>{category}</span>
          <span className="text-xs text-muted/70">{counts[category] ?? 0}</span>
        </Link>
      ))}
    </nav>
  );
}
