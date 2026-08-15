import type { Metadata } from "next";
import { getRadar, type RadarNode } from "@/lib/trends";
import { getProfile } from "@/lib/relevance";

export const metadata: Metadata = {
  title: "趋势雷达",
  description:
    "AI 技术趋势雷达：按主题树追踪各趋势的阶段、热度、近 14 天报道量与近 3 天增速。",
};

function flames(heat: number): string {
  if (heat <= 0) return "—";
  return "🔥".repeat(Math.min(5, Math.round(heat)));
}

function growthText(node: RadarNode): string {
  if (node.last3d === 0 && node.prev3d === 0) return "—";
  const pct = Math.round(node.growth * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

export default function TrendsPage() {
  const radar = getRadar();

  if (!radar) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">趋势雷达</h1>
        <p className="mt-3 text-muted">趋势数据生成中，等待下次巡检。</p>
      </div>
    );
  }

  const profile = getProfile();
  const focusTrends = new Set(profile?.focusTrends ?? []);
  const byHeat = [...radar.nodes].sort((a, b) => b.heat - a.heat);

  // 按 parent 分层：children 映射 + 根节点（parent 为空或指向不存在的节点）
  const ids = new Set(radar.nodes.map((n) => n.id));
  const children = new Map<string, RadarNode[]>();
  const roots: RadarNode[] = [];
  for (const node of radar.nodes) {
    if (node.parent && ids.has(node.parent)) {
      const list = children.get(node.parent) ?? [];
      list.push(node);
      children.set(node.parent, list);
    } else {
      roots.push(node);
    }
  }
  const sortByHeat = (list: RadarNode[]) =>
    list.sort((a, b) => b.heat - a.heat || a.name.localeCompare(b.name));
  sortByHeat(roots);
  for (const list of children.values()) sortByHeat(list);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">趋势雷达</h1>
      <p className="mt-2 text-sm text-muted">
        数据由巡检任务生成 · 生成于 {radar.generated_at}
      </p>

      {/* ① 雷达表 */}
      <section className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-semibold">趋势</th>
              <th className="px-4 py-3 font-semibold">阶段</th>
              <th className="px-4 py-3 font-semibold">热度</th>
              <th className="px-4 py-3 font-semibold">14 天条数</th>
              <th className="px-4 py-3 font-semibold">近 3 天增速</th>
              <th className="px-4 py-3 font-semibold">关注度</th>
            </tr>
          </thead>
          <tbody>
            {byHeat.map((node) => (
              <tr
                key={node.id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium">{node.name}</span>
                  {node.focus && (
                    <span className="ml-2 text-xs text-muted">
                      {node.focus}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">{node.stage || "—"}</td>
                <td className="px-4 py-2.5" title={`heat ${node.heat}`}>
                  {flames(node.heat)}
                </td>
                <td className="px-4 py-2.5 text-muted">{node.count14d}</td>
                <td
                  className={`px-4 py-2.5 ${
                    node.growth > 0
                      ? "text-emerald-300"
                      : node.growth < 0
                        ? "text-rose-300"
                        : "text-muted"
                  }`}
                  title={`近 3 天 ${node.last3d} 条 / 前 3 天 ${node.prev3d} 条`}
                >
                  {growthText(node)}
                </td>
                <td className="px-4 py-2.5">
                  {focusTrends.has(node.id) ? (
                    <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                      关注中
                    </span>
                  ) : (
                    <span className="text-xs text-muted/50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ② 分层树视图 + ③ 每趋势 topItems */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold">趋势主题树</h2>
        <div className="space-y-3">
          {roots.map((root) => (
            <TrendTreeNode
              key={root.id}
              node={root}
              childrenMap={children}
              depth={0}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function TrendTreeNode({
  node,
  childrenMap,
  depth,
}: {
  node: RadarNode;
  childrenMap: Map<string, RadarNode[]>;
  depth: number;
}) {
  const kids = childrenMap.get(node.id) ?? [];
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : "1.5rem" }}>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{node.name}</span>
          {node.stage && (
            <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
              {node.stage}
            </span>
          )}
          <span className="text-xs">{flames(node.heat)}</span>
          <span className="text-xs text-muted">
            14 天 {node.count14d} 条 · 增速 {growthText(node)}
          </span>
        </div>
        {node.focus && (
          <p className="mt-1 text-xs text-muted">{node.focus}</p>
        )}
        {node.topItems.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {node.topItems.map((item) => (
              <li key={item.url} className="flex gap-2">
                {item.date && (
                  <span className="shrink-0 text-muted/70">{item.date}</span>
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg/80 underline-offset-2 transition-colors hover:text-accent hover:underline"
                >
                  {item.title_zh || item.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      {kids.length > 0 && (
        <div className="mt-3 space-y-3 border-l border-border/60 pl-0">
          {kids.map((kid) => (
            <TrendTreeNode
              key={kid.id}
              node={kid}
              childrenMap={childrenMap}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
