import Link from "next/link";
import type { Category, NewsItem } from "@/lib/news";
import { CATEGORY_COLORS, CATEGORY_SLUGS } from "@/lib/news";
import { scoreItem } from "@/lib/relevance";
import { Stars, formatHM } from "./bits";

const PREVIEW_COUNT = 6;

/** 板块内的紧凑卡片：分类色左边条 + 徽标行 + 标题/摘要 + 论文三行 */
function RailCard({ item, isNew }: { item: NewsItem; isNew: boolean }) {
  const showPaperMeta =
    item.category === "论文研究" &&
    Boolean(item.method || item.result || item.limitation);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="n-card"
    >
      <div className="n-top">
        <span className="n-cat">{item.category}</span>
        {isNew && <span className="n-new">今日新增</span>}
        <Stars score={scoreItem(item)} />
      </div>
      <h3>{item.title_zh || item.title}</h3>
      {item.summary_zh && <p className="sum">{item.summary_zh}</p>}
      {showPaperMeta && (
        <div className="paper-meta">
          {item.method && (
            <div className="pm-m">
              <b>方法</b>
              {item.method}
            </div>
          )}
          {item.result && (
            <div className="pm-r">
              <b>结果</b>
              {item.result}
            </div>
          )}
          {item.limitation && (
            <div className="pm-l">
              <b>局限</b>
              {item.limitation}
            </div>
          )}
        </div>
      )}
      <div className="src-line">
        {item.source}
        {formatHM(item.published_at) && ` · ${formatHM(item.published_at)}`}
      </div>
    </a>
  );
}

/** 首页板块预览：横向滑动卡片 + 「查看全部」进独立板块页 */
export default function CategorySection({
  category,
  items,
  newIds,
}: {
  category: Category;
  items: NewsItem[];
  /** 当日最新一轮收录的条目 id（显示"今日新增"徽标） */
  newIds?: Set<string>;
}) {
  const preview = items.slice(0, PREVIEW_COUNT);
  const color = CATEGORY_COLORS[category];
  return (
    <section
      className="mt-11"
      style={{ "--cc": color } as React.CSSProperties}
      aria-label={category}
    >
      <div className="cat-head">
        <span className="cmark" />
        <h2>{category}</h2>
        <span className="count">今日 {items.length} 条</span>
        <Link className="more" href={`/category/${CATEGORY_SLUGS[category]}`}>
          查看全部 →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted">
          今日暂无该板块内容
        </p>
      ) : (
        <div className="rail">
          {preview.map((item) => (
            <RailCard
              key={item.id}
              item={item}
              isNew={newIds?.has(item.id) ?? false}
            />
          ))}
        </div>
      )}
    </section>
  );
}
