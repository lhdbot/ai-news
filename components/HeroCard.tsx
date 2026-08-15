import { CATEGORY_COLORS, type NewsItem } from "@/lib/news";
import { scoreItem } from "@/lib/relevance";
import { Stars, formatHM } from "./bits";

const EMPTY_HINT = "暂无解读，待下一轮摘要补全";

function Cell({
  className,
  label,
  icon,
  text,
}: {
  className: string;
  label: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="hg-cell">
      <div className={`tag ${className}`}>
        {icon}
        {label}
      </div>
      <p>{text || EMPTY_HINT}</p>
    </div>
  );
}

/** 今日头条卡：标题 + 四段式拆解栏（背景速览/学到什么/影响/建议） */
export default function HeroCard({
  item,
  isNew = false,
}: {
  item: NewsItem;
  isNew?: boolean;
}) {
  const color = CATEGORY_COLORS[item.category];
  const related = item.relatedSources ?? [];
  const sources = [item.source, ...related.map((s) => s.source)];
  const addedHM = item.added_at ? formatHM(item.added_at) : "";

  return (
    <article
      className="hero"
      style={{ "--cc": color } as React.CSSProperties}
    >
      <div className="hero-main">
        <div className="badges">
          <span className="badge cat">{item.category}</span>
          {isNew && (
            <span className="badge new">
              <span className="dot" />
              今日新增
            </span>
          )}
          {related.length > 0 && (
            <span className="badge multi">🔥 {related.length + 1} 源报道</span>
          )}
          <Stars score={scoreItem(item)} />
          <span className="hero-src">
            {sources.join(" · ")}
            {addedHM && ` ｜ 收录于 ${addedHM}`}
          </span>
        </div>
        <a href={item.url} target="_blank" rel="noreferrer">
          <h2 className="transition-colors hover:text-accent">
            {item.title_zh || item.title}
          </h2>
        </a>
        {item.why_it_matters && <p className="lede">{item.why_it_matters}</p>}
      </div>
      <div className="hero-grid">
        <Cell
          className="t-bg"
          label="背景速览"
          text={item.summary_zh}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          }
        />
        <Cell
          className="t-learn"
          label="学到什么"
          text={item.learn}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          }
        />
        <Cell
          className="t-impact"
          label="影响"
          text={item.impact}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M14 7h7v7" />
            </svg>
          }
        />
        <Cell
          className="t-act"
          label="建议"
          text={item.advice}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          }
        />
      </div>
    </article>
  );
}
