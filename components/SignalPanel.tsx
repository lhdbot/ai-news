import { CATEGORIES, CATEGORY_COLORS, type Category, type NewsItem } from "@/lib/news";
import { scoreItem } from "@/lib/relevance";
import type { Radar } from "@/lib/trends";

/**
 * 今日信号指数（0-100）：
 *   收录条数 × 2            —— 信息量基础分（50 条即封顶的主要贡献）
 * + 多源交叉确认条目 × 5    —— 同一事件被多个信源报道，信号更强
 * + 平均热度 × 3            —— 编辑/抓取侧给出的 heat（0-10）取均值加权
 * 最后 min(100, …) 截断。数据不足（无 relatedSources / heat）时对应项自然为 0。
 */
function signalIndex(items: NewsItem[], multiSource: number): number {
  if (items.length === 0) return 0;
  const avgHeat =
    items.reduce((sum, it) => sum + (it.heat ?? 0), 0) / items.length;
  return Math.min(
    100,
    Math.round(items.length * 2 + multiSource * 5 + avgHeat * 3),
  );
}

/** 雷达图上的光点位置：按 node id 哈希给出确定性的伪随机坐标（%） */
function blipPosition(id: string): { left: string; top: string } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const left = 18 + (h % 64); // 18%–81%
  const top = 15 + ((h >> 8) % 60); // 15%–74%
  return { left: `${left}%`, top: `${top}%` };
}

const BLIP_CLASSES = ["", "b2", "b3"] as const;

export default function SignalPanel({
  items,
  radar,
}: {
  items: NewsItem[];
  /** 趋势雷达数据；为 null 时雷达仅作装饰（光点退化为默认位置） */
  radar: Radar | null;
}) {
  const total = items.length;
  const multiSource = items.filter(
    (it) => (it.relatedSources?.length ?? 0) > 0,
  ).length;
  const index = signalIndex(items, multiSource);

  // 相关度分档：高 ≥22 / 中 10-21 / 观察 <10（与 starsOf 分档一致）
  let high = 0;
  let mid = 0;
  for (const it of items) {
    const s = scoreItem(it);
    if (s >= 22) high += 1;
    else if (s >= 10) mid += 1;
  }
  const low = total - high - mid;

  // 多源确认最多的事件，作为图例说明
  const topMulti = items
    .filter((it) => (it.relatedSources?.length ?? 0) > 0)
    .sort(
      (a, b) => (b.relatedSources?.length ?? 0) - (a.relatedSources?.length ?? 0),
    )[0];

  // 分类信号分布：各分类条数柱状图，高度按当日最大值归一
  const counts = CATEGORIES.map(
    (c) => items.filter((it) => it.category === c).length,
  );
  const maxCount = Math.max(1, ...counts);

  // 雷达光点：取热度最高的 3 个趋势节点；radar 为 null 时用默认装饰光点
  const blips = radar
    ? [...radar.nodes]
        .sort((a, b) => b.heat - a.heat)
        .slice(0, 3)
        .map((n) => blipPosition(n.id))
    : [
        { left: "62%", top: "26%" },
        { left: "30%", top: "58%" },
        { left: "70%", top: "70%" },
      ];

  return (
    <div className="signal-panel" aria-label="今日信号面板">
      <div className="radar-box">
        <div className="radar" aria-hidden="true">
          <span className="ring" />
          <span className="ring" />
          <span className="ring" />
          <span className="cross h" />
          <span className="cross v" />
          <span className="sweep" />
          {blips.map((pos, i) => (
            <span
              key={i}
              className={`blip ${BLIP_CLASSES[i % BLIP_CLASSES.length]}`}
              style={pos}
            />
          ))}
        </div>
        <span className="radar-label">
          {radar ? "SIGNAL RADAR · 24H" : "SIGNAL RADAR · 待机"}
        </span>
      </div>
      <div className="signal-stats">
        <div className="stat">
          <div className="num green">
            {index}
            <em>/100</em>
          </div>
          <div className="lbl">今日信号指数</div>
          <div className="legend">条数×2 + 多源×5 + 均热×3</div>
        </div>
        <div className="stat">
          <div className="num">
            {total}
            <em>条</em>
          </div>
          <div className="lbl">今日收录总量</div>
          <div className="legend">
            高相关 {high} · 中相关 {mid} · 观察 {low}
          </div>
        </div>
        <div className="stat">
          <div className="num">
            {multiSource}
            <em>条</em>
          </div>
          <div className="lbl">多源交叉报道</div>
          <div className="legend">
            {topMulti
              ? `${(topMulti.title_zh || topMulti.title).slice(0, 14)}… 获 ${
                  (topMulti.relatedSources?.length ?? 0) + 1
                } 源确认`
              : "今日暂无跨源事件"}
          </div>
        </div>
        <div className="stat">
          <div className="lbl" style={{ marginBottom: 6 }}>
            分类信号分布
          </div>
          <div className="bars" aria-hidden="true">
            {CATEGORIES.map((c: Category, i) => (
              <i
                key={c}
                style={
                  {
                    "--c": CATEGORY_COLORS[c],
                    height: `${Math.max(12, Math.round((counts[i] / maxCount) * 100))}%`,
                  } as React.CSSProperties
                }
                title={`${c} ${counts[i]} 条`}
              />
            ))}
          </div>
          <div className="legend">模型 / 论文 / 行业 / 工具 / 芯片 / 具身</div>
        </div>
      </div>
    </div>
  );
}
