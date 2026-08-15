import { CATEGORY_COLORS, type NewsItem } from "@/lib/news";
import { Stars, formatHM } from "./bits";

/** 今日与你最相关 TOP 5：描边大数字卡片，第 1 名金色高亮 */
export default function TopPicks({
  picks,
}: {
  picks: { item: NewsItem; score: number }[];
}) {
  return (
    <div className="top5">
      {picks.map(({ item, score }, i) => {
        const color = CATEGORY_COLORS[item.category];
        return (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className={`t5-card ${i === 0 ? "no1" : ""}`}
            style={{ "--sc": color } as React.CSSProperties}
          >
            <div className="rank">{String(i + 1).padStart(2, "0")}</div>
            <div className="my-2">
              <Stars score={score} />
            </div>
            <h3>{item.title_zh || item.title}</h3>
            {item.summary_zh && <p className="sum">{item.summary_zh}</p>}
            <div className="src-line">
              {item.source}
              {formatHM(item.published_at) && ` · ${formatHM(item.published_at)}`}
            </div>
          </a>
        );
      })}
    </div>
  );
}
