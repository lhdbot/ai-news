#!/usr/bin/env node
/**
 * 预测复盘：找 data/forecasts/weekly/ 中发布已满 28 天、且 data/forecasts/review/
 * 尚无对应文件的预测报告，用其发布日后 4 周的新闻素材，让 Kimi 逐条预测打
 * 应验度 1-5 分 + 一句依据 + 链接，写入 data/forecasts/review/YYYY-MM-DD.md
 * （与原预测同名）。
 *
 * 用法:
 *   node scripts/forecast-review.mjs          # 只处理未复盘的预测
 *   node scripts/forecast-review.mjs --force  # 重新复盘所有满 28 天的预测
 */
import fs from 'node:fs';
import path from 'node:path';
import { callKimi, extractMarkdown } from './lib/kimi.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const WEEKLY_DIR = path.join(ROOT, 'data', 'forecasts', 'weekly');
const REVIEW_DIR = path.join(ROOT, 'data', 'forecasts', 'review');
const MIN_AGE_DAYS = 28;
const WINDOW_DAYS = 28;
const MAX_ITEMS = 150;

function addDays(dateStr, n) {
  const t = new Date(`${dateStr}T00:00:00Z`).getTime() + n * 86400e3;
  return new Date(t).toISOString().slice(0, 10);
}

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

/** 发布日后 4 周的新闻素材（截断控制长度） */
function collectNewsBetween(startDate, endDate) {
  const items = [];
  for (let d = new Date(`${startDate}T00:00:00Z`); d.toISOString().slice(0, 10) <= endDate; d = new Date(d.getTime() + 86400e3)) {
    const date = d.toISOString().slice(0, 10);
    const file = path.join(NEWS_DIR, `${date}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const daily = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const it of daily.items ?? []) {
        if (!(it.title_zh || it.title)) continue;
        items.push({
          date,
          source: it.source,
          title: it.title_zh || it.title,
          url: it.url,
          summary: (it.summary_zh || '').slice(0, 100),
        });
      }
    } catch { /* 跳过损坏文件 */ }
    if (items.length >= MAX_ITEMS) break;
  }
  return items.slice(0, MAX_ITEMS);
}

function buildPrompt(forecastDate, forecastMd, items) {
  return `你是一位资深 AI 行业分析师，正在复盘一份 4 周前发布的 AI 预测报告的应验程度。

【原预测报告（${forecastDate} 发布）】
${forecastMd}

【该报告发布后 4 周内的新闻素材（JSON，每条含 url）】
${JSON.stringify(items, null, 1)}

请输出一份 markdown 复盘报告（直接输出 markdown 正文，不要输出任何其他文字，不要使用任何工具），结构固定如下：

# 预测复盘（原预测 ${forecastDate}）

## 逐条应验度评分
从原报告"方向预测"板块中逐条提取预测，每条一行：
- **预测**：一句话概括原预测 —— **应验度 X/5** —— 一句依据（对照素材说明兑现/部分兑现/落空）（依据：[新闻标题](url)；多条用 ；分隔，只能引用上面素材中的条目，没有素材支撑则写"暂无素材验证"并把应验度标为 ?/5）

## 总体评价
2-3 句：这份预测整体命中率如何、哪类判断准哪类偏了、对以后做预测的启示`;
}

async function main() {
  const force = process.argv.includes('--force');
  const today = beijingToday();

  if (!fs.existsSync(WEEKLY_DIR)) {
    console.log('[skip] data/forecasts/weekly 不存在');
    return;
  }
  fs.mkdirSync(REVIEW_DIR, { recursive: true });

  const candidates = fs.readdirSync(WEEKLY_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map(f => f.replace(/\.md$/, ''))
    .filter(date => addDays(date, MIN_AGE_DAYS) <= today)
    .filter(date => force || !fs.existsSync(path.join(REVIEW_DIR, `${date}.md`)))
    .sort();

  if (candidates.length === 0) {
    console.log(`[skip] 没有满足条件的预测（需发布满 ${MIN_AGE_DAYS} 天且未复盘）`);
    return;
  }
  console.log(`[info] 待复盘预测 ${candidates.length} 份：${candidates.join('、')}`);

  for (const date of candidates) {
    const forecastMd = fs.readFileSync(path.join(WEEKLY_DIR, `${date}.md`), 'utf8');
    const items = collectNewsBetween(addDays(date, 1), addDays(date, WINDOW_DAYS));
    if (items.length < 10) {
      console.warn(`[warn] ${date}：发布日后 4 周新闻素材不足（${items.length} 条），跳过`);
      continue;
    }
    console.log(`[info] 复盘 ${date}（素材 ${items.length} 条），调用 Kimi…`);
    let md = null;
    try {
      const stdout = await callKimi(buildPrompt(date, forecastMd, items), { retries: 2, timeoutMs: 15 * 60 * 1000, label: `review ${date}` });
      md = extractMarkdown(stdout);
    } catch {
      console.warn(`[warn] ${date}：kimi 两次调用均失败，跳过`);
      continue;
    }
    fs.writeFileSync(path.join(REVIEW_DIR, `${date}.md`), md, 'utf8');
    console.log(`[ok] 写入 data/forecasts/review/${date}.md（${md.length} 字符）`);
  }
  console.log('[done] 复盘完成');
}

main().catch(err => { console.error('[fatal]', err); process.exitCode = 1; });
