import Link from "next/link";
import SignalPanel from "@/components/SignalPanel";
import TopPicks from "@/components/TopPicks";
import HeroCard from "@/components/HeroCard";
import CategorySection from "@/components/CategorySection";
import {
  CATEGORIES,
  formatDateCN,
  getLatestBatchIds,
  getLatestNews,
  type NewsItem,
} from "@/lib/news";
import { scoreItem } from "@/lib/relevance";
import { getSources } from "@/lib/sources";
import { SITE_NAME } from "@/lib/site";
import { getRadar } from "@/lib/trends";
import { getDigest } from "@/lib/digest";
import { formatHM } from "@/components/bits";

// 数据由巡检任务更新：动态渲染，请求时读取最新数据文件，无需整站重建/重启
// ISR：数据最多缓存 300 秒；巡检写入后由下一次请求触发后台刷新
export const revalidate = 300;

export default function HomePage() {
  const daily = getLatestNews();

  if (!daily || daily.items.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">暂无内容</h1>
        <p className="mt-3 text-muted">
          还没有抓取到新闻。运行{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-accent">
            node scripts/fetch-news.mjs
          </code>{" "}
          生成第一期日报。
        </p>
      </div>
    );
  }

  // 优先读 digest（每日精选 30 条）；未生成时回退到全量日报
  const digest = getDigest(daily.date);
  const items = digest?.items ?? daily.items;
  const totalCount = daily.items.length;
  // 趋势雷达数据可能不存在（巡检未生成）：信号面板降级为纯装饰动画
  const radar = getRadar();
  // 精选条目直接带 isNew；回退模式仍按收录批次判断
  const batch = getLatestBatchIds(daily.items);
  const newIds = digest
    ? new Set(digest.items.filter((item) => item.isNew).map((item) => item.id))
    : batch.ids;
  const latestAt = digest ? digest.generated_at : batch.latestAt;
  // 与你最相关 TOP 5：按相关度打分排序（分数相同保持原顺序）
  const top5 = items
    .map((item, index) => ({ item, index, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5);
  // 头条：日报首条（抓取/编辑侧排序置顶）
  const headline = items[0];
  // 固定板块顺序（CATEGORIES），板块内按时间倒序
  const byCategory = new Map<string, NewsItem[]>();
  for (const category of CATEGORIES) {
    byCategory.set(
      category,
      items
        .filter((item) => item.category === category)
        .sort(
          (a, b) =>
            new Date(b.published_at).getTime() -
            new Date(a.published_at).getTime(),
        ),
    );
  }
  const rawByCategory = new Map<string, number>();
  for (const item of daily.items) {
    rawByCategory.set(item.category, (rawByCategory.get(item.category) ?? 0) + 1);
  }
  const coveredSources = new Set(daily.items.map((item) => item.source)).size;
  const totalSources = getSources().length;

  return (
    <div className="pb-4">
      <h1 className="sr-only">{SITE_NAME} · 每日 AI 资讯精选</h1>
      {/* 状态条：最新批次 + 收录概览（-mx 出血到主容器边缘） */}
      <div className="statusbar -mx-4 md:-mx-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 font-mono text-xs md:px-6">
          <span className="pulse-dot" aria-hidden="true" />
          {latestAt && newIds.size > 0 ? (
            <span className="text-accent">
              精选更新 {newIds.size} 条（{formatHM(latestAt)}）
            </span>
          ) : (
            <span className="text-accent">今日精选已更新</span>
          )}
          <span className="text-faint">
            {formatDateCN(daily.date)} · 今日精选{" "}
            <b className="font-medium text-muted">{items.length}</b> 条 / 收录{" "}
            <b className="font-medium text-muted">{totalCount}</b> 条 · 覆盖信源{" "}
            <b className="font-medium text-muted">
              {coveredSources}/{totalSources}
            </b>
          </span>
        </div>
      </div>

      {/* 信号雷达面板（记忆点） */}
      <div className="mt-7">
        <SignalPanel items={items} radar={radar} />
      </div>

      {/* 今日与你最相关 TOP 5 */}
      <section className="home-section" aria-labelledby="top5-h">
        <div className="block-head">
          <span className="sec-index" aria-hidden="true">SEC·01</span>
          <h2 id="top5-h">今日与你最相关 TOP 5</h2>
          <span className="en">PERSONALIZED · RANKED</span>
          <span className="tail">基于你的阅读画像打分</span>
        </div>
        <TopPicks picks={top5} />
      </section>

      {/* 今日头条 */}
      <section className="home-section hero-section" aria-labelledby="hero-h">
        <div className="block-head">
          <span className="sec-index" aria-hidden="true">SEC·02</span>
          <h2 id="hero-h">今日头条</h2>
          <span className="en">TOP STORY</span>
          <Link
            href="/archive"
            className="tail transition-colors hover:text-fg"
          >
            查看历史归档 →
          </Link>
        </div>
        <HeroCard item={headline} isNew={newIds.has(headline.id)} />
      </section>

      {/* 六分类板块 */}
      {CATEGORIES.map((category, index) => (
        <CategorySection
          key={category}
          category={category}
          items={byCategory.get(category) ?? []}
          newIds={newIds}
          total={rawByCategory.get(category) ?? 0}
          index={index + 3}
        />
      ))}
    </div>
  );
}
