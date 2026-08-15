import type { NewsItem } from "@/lib/news";
import { scoreItem, starsOf } from "@/lib/relevance";
import TagBadge from "./TagBadge";

const CATEGORY_STYLES: Record<string, string> = {
  模型发布: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",
  论文研究: "text-indigo-300 border-indigo-400/40 bg-indigo-400/10",
  行业动态: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  工具产品: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  芯片算力: "text-rose-300 border-rose-400/40 bg-rose-400/10",
  具身智能: "text-violet-300 border-violet-400/40 bg-violet-400/10",
};

export function CategoryBadge({ category }: { category: string }) {
  const style =
    CATEGORY_STYLES[category] ??
    "text-muted border-border bg-surface-2";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs ${style}`}>
      {category}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NewsCard({
  item,
  featured = false,
  isNew = false,
}: {
  item: NewsItem;
  featured?: boolean;
  /** 是否为当日最新一轮收录的条目（显示"今日新增"徽标） */
  isNew?: boolean;
}) {
  const displayTitle = item.title_zh || item.title;
  const relevanceScore = scoreItem(item);
  const relevanceStars = starsOf(relevanceScore);
  const sourceCount = (item.relatedSources?.length ?? 0) + 1;
  const showHeat = (item.heat ?? 0) >= 12;
  const showPaperMeta =
    item.category === "论文研究" &&
    Boolean(item.method || item.result || item.limitation);
  return (
    <article
      className={`group flex flex-col rounded-xl border border-border bg-surface transition-colors hover:border-accent/60 ${
        featured ? "p-6 md:p-8" : "p-4"
      }`}
    >
      <div
        className={`flex flex-wrap items-center gap-2 text-xs text-muted ${
          featured ? "mb-3" : "mb-2"
        }`}
      >
        <CategoryBadge category={item.category} />
        {isNew && (
          <span
            className="rounded border border-green-400/50 bg-green-400/15 px-1.5 py-0.5 text-xs font-medium text-green-300"
            title={item.added_at ? `收录于 ${formatTime(item.added_at)}` : "今日新增"}
          >
            今日新增
          </span>
        )}
        <span className="font-medium text-fg/70">{item.source}</span>
        <span>{formatTime(item.published_at)}</span>
        <span
          className="text-amber-300"
          title={`相关度 ${relevanceScore} 分`}
        >
          {"★".repeat(relevanceStars)}
          {"☆".repeat(5 - relevanceStars)}
        </span>
        {showHeat && (
          <details className="relative">
            <summary className="cursor-pointer list-none text-orange-300">
              🔥 {sourceCount} 源报道
            </summary>
            <ul className="absolute left-0 z-10 mt-1 min-w-40 space-y-1 rounded-lg border border-border bg-surface-2 p-2 shadow-lg">
              <li>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg/80 hover:text-accent"
                >
                  {item.source}
                </a>
              </li>
              {(item.relatedSources ?? []).map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-fg/80 hover:text-accent"
                  >
                    {s.source}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <a href={item.url} target="_blank" rel="noreferrer" className="block">
        <h3
          className={`font-bold leading-snug transition-colors group-hover:text-accent ${
            featured ? "text-2xl md:text-3xl" : "text-sm line-clamp-2"
          }`}
        >
          {displayTitle}
          <span className="ml-1 inline-block text-muted opacity-0 transition-opacity group-hover:opacity-100">
            ↗
          </span>
        </h3>
      </a>

      {item.summarized && item.title_zh && item.title_zh !== item.title && (
        <p
          className={`mt-1 text-muted line-clamp-1 ${
            featured ? "text-xs" : "text-[11px]"
          }`}
        >
          {item.title}
        </p>
      )}

      {item.summary_zh && (
        <p
          className={`text-muted ${
            featured
              ? "mt-3 text-base leading-relaxed"
              : "mt-2 text-[13px] leading-normal"
          }`}
        >
          <span className="mr-1 font-semibold text-fg/70">总结</span>
          {item.summary_zh}
        </p>
      )}

      {showPaperMeta && (
        <div
          className={`space-y-1 rounded-md border border-indigo-400/30 bg-indigo-400/5 ${
            featured ? "mt-3 px-3 py-2" : "mt-2 px-2.5 py-1.5"
          }`}
        >
          {(
            [
              ["方法", item.method],
              ["结果", item.result],
              ["局限", item.limitation],
            ] as const
          ).map(
            ([label, value]) =>
              value && (
                <p
                  key={label}
                  className={`text-fg/80 ${
                    featured
                      ? "text-sm leading-relaxed"
                      : "text-xs leading-normal"
                  }`}
                >
                  <span className="mr-1 font-semibold text-indigo-300">
                    {label}
                  </span>
                  {value}
                </p>
              ),
          )}
        </div>
      )}

      {(item.learn || item.impact || item.why_it_matters || item.advice) && (
        <div className={featured ? "mt-3 space-y-2" : "mt-2 space-y-1.5"}>
          {item.learn && (
            <div
              className={`rounded-md border-l-2 border-emerald-400 bg-emerald-400/5 ${
                featured ? "px-3 py-2" : "px-2.5 py-1.5"
              }`}
            >
              <p
                className={`font-semibold text-emerald-300 ${
                  featured ? "text-xs" : "text-[11px]"
                }`}
              >
                学到什么
              </p>
              <p
                className={`text-fg/80 ${
                  featured
                    ? "mt-1 text-sm leading-relaxed"
                    : "mt-0.5 text-xs leading-normal"
                }`}
              >
                {item.learn}
              </p>
            </div>
          )}
          {(item.impact || item.why_it_matters) && (
            <div
              className={`rounded-md border-l-2 border-accent bg-accent/5 ${
                featured ? "px-3 py-2" : "px-2.5 py-1.5"
              }`}
            >
              <p
                className={`font-semibold text-accent ${
                  featured ? "text-xs" : "text-[11px]"
                }`}
              >
                影响
              </p>
              <p
                className={`text-fg/80 ${
                  featured
                    ? "mt-1 text-sm leading-relaxed"
                    : "mt-0.5 text-xs leading-normal"
                }`}
              >
                {item.impact || item.why_it_matters}
              </p>
            </div>
          )}
          {item.advice && (
            <div
              className={`rounded-md border-l-2 border-amber-400 bg-amber-400/5 ${
                featured ? "px-3 py-2" : "px-2.5 py-1.5"
              }`}
            >
              <p
                className={`font-semibold text-amber-300 ${
                  featured ? "text-xs" : "text-[11px]"
                }`}
              >
                对你的建议
              </p>
              <p
                className={`text-fg/80 ${
                  featured
                    ? "mt-1 text-sm leading-relaxed"
                    : "mt-0.5 text-xs leading-normal"
                }`}
              >
                {item.advice}
              </p>
            </div>
          )}
        </div>
      )}

      {item.tags.length > 0 && (
        <div
          className={`flex flex-wrap gap-1.5 ${featured ? "mt-4" : "mt-3"}`}
        >
          {item.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  );
}
