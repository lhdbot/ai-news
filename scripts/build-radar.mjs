#!/usr/bin/env node
/**
 * 技术雷达生成器：扫描近 14 天 data/news/*.json 中各条目的 trends 字段，
 * 按 taxonomy 节点统计热度，生成 data/trends/radar.json。纯计算，无 LLM。
 *
 * 用法：node scripts/build-radar.mjs
 *
 * heat（0-5）规则：
 *   基础分由 count14d（近 14 天命中条数）分档：
 *     0 条 -> 0；1-2 -> 1；3-5 -> 2；6-10 -> 3；11-19 -> 4；>=20 -> 5
 *   增长加成：growth = (last3d - prev3d) / max(prev3d, 1)，
 *     growth >= 1（近 3 天较前 3 天翻倍以上）且基础分 < 5 时 +1（封顶 5）。
 * topItems：该节点近 14 天命中条目按 (it.heat ?? it.weight ?? 0) 降序、再按日期降序取 3 条。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const TAXONOMY_FILE = path.join(ROOT, 'data', 'trends', 'taxonomy.json');
const RADAR_FILE = path.join(ROOT, 'data', 'trends', 'radar.json');
const WINDOW_DAYS = 14;

const beijingDate = offsetDays =>
  new Date(Date.now() + 8 * 3600e3 - offsetDays * 86400e3).toISOString().slice(0, 10);

function baseHeat(count14d) {
  if (count14d === 0) return 0;
  if (count14d <= 2) return 1;
  if (count14d <= 5) return 2;
  if (count14d <= 10) return 3;
  if (count14d <= 19) return 4;
  return 5;
}

const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'));

// 收集近 14 天所有带 trends 的条目
const items = [];
for (let d = 0; d < WINDOW_DAYS; d++) {
  const date = beijingDate(d);
  const file = path.join(NEWS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) continue;
  try {
    const daily = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const it of daily.items ?? []) {
      if (!Array.isArray(it.trends) || it.trends.length === 0) continue;
      items.push({
        date,
        title_zh: it.title_zh || it.title,
        url: it.url,
        trends: it.trends,
        score: it.heat ?? it.weight ?? 0,
        daysAgo: d,
      });
    }
  } catch { /* 跳过损坏文件 */ }
}

const nodes = taxonomy.nodes.map(node => {
  const hits = items.filter(it => it.trends.includes(node.id));
  const count14d = hits.length;
  const last3d = hits.filter(h => h.daysAgo < 3).length;
  const prev3d = hits.filter(h => h.daysAgo >= 3 && h.daysAgo < 6).length;
  const growth = (last3d - prev3d) / Math.max(prev3d, 1);
  let heat = baseHeat(count14d);
  if (growth >= 1 && heat < 5) heat += 1;
  const topItems = hits
    .sort((a, b) => (b.score - a.score) || (a.date < b.date ? 1 : -1))
    .slice(0, 3)
    .map(h => ({ title_zh: h.title_zh, url: h.url, date: h.date }));
  return {
    id: node.id,
    name: node.name,
    parent: node.parent,
    stage: node.stage,
    focus: node.focus,
    heat,
    count14d,
    last3d,
    prev3d,
    growth: Math.round(growth * 100) / 100,
    topItems,
  };
});

const radar = { generated_at: new Date().toISOString(), nodes };
fs.mkdirSync(path.dirname(RADAR_FILE), { recursive: true });
fs.writeFileSync(RADAR_FILE, JSON.stringify(radar, null, 2) + '\n', 'utf8');

const hot = nodes.filter(n => n.heat > 0).sort((a, b) => b.heat - a.heat || b.count14d - a.count14d);
console.log(`[ok] 写入 ${path.relative(ROOT, RADAR_FILE)}：${nodes.length} 个节点，近 ${WINDOW_DAYS} 天带 trends 条目 ${items.length} 条`);
for (const n of hot.slice(0, 10)) {
  console.log(`  heat=${n.heat} count14d=${n.count14d} last3d=${n.last3d} prev3d=${n.prev3d} growth=${n.growth}  ${n.id}（${n.name}）`);
}
if (hot.length === 0) console.log('  （暂无热点：近 14 天条目还没有 trends 字段，先跑 summarize-local）');
