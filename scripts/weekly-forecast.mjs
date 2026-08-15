#!/usr/bin/env node
/**
 * AI 发展预测：汇总近 N 天日报 + 用户画像，调用本机 Kimi CLI 生成
 * markdown 预测报告。
 *
 * --days=3（默认）：三日滚动预测，写入 data/forecasts/daily/YYYY-MM-DD.md
 * --days=7       ：每周预测，写入 data/forecasts/weekly/YYYY-MM-DD.md
 *
 * 用法：node scripts/weekly-forecast.mjs [--days=N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { callKimi, extractMarkdown } from './lib/kimi.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const FORECAST_ROOT = path.join(ROOT, 'data', 'forecasts');
const PROFILE_FILE = path.join(ROOT, 'data', 'profile.md');
const MAX_ITEMS = 120;

const daysArg = process.argv.find(a => a.startsWith('--days='));
const DAYS = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10) || 3) : 3;
const WEEKLY = DAYS >= 7;
const KIND = WEEKLY ? 'weekly' : 'daily';
const FORECAST_DIR = path.join(FORECAST_ROOT, KIND);
const WINDOW_LABEL = WEEKLY ? '近 7 天' : `近 ${DAYS} 天`;

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

function lastNDates(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    dates.push(new Date(Date.now() + 8 * 3600e3 - i * 86400e3).toISOString().slice(0, 10));
  }
  return dates;
}

function collectRecentItems() {
  const items = [];
  for (const date of lastNDates(DAYS)) {
    const file = path.join(NEWS_DIR, `${date}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const daily = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const it of daily.items ?? []) {
        items.push({ date, source: it.source, title: it.title_zh || it.title, url: it.url, summary: (it.summary_zh || '').slice(0, 120), category: it.category });
      }
    } catch { /* 跳过损坏文件 */ }
  }
  return items.slice(0, MAX_ITEMS);
}

function buildPrompt(items, profile) {
  const reportTitle = WEEKLY ? `# AI 周报预测（${beijingToday()}）` : `# AI 三日预测（${beijingToday()}）`;
  const reviewHead = WEEKLY ? '## 本周盘点' : '## 三日盘点';
  const reviewHint = WEEKLY ? '3-5 条本周最重要的主线' : '3-5 条近三天最重要的主线';
  const basisHint = WEEKLY ? '从本周素材推导' : '从近期素材推导';
  const actionHint = WEEKLY ? '本周可以动手做什么' : '这几天可以动手做什么';
  const riskHint = WEEKLY ? '1-2 条本周新闻中值得警惕的信号' : '1-2 条近三天新闻中值得警惕的信号';
  return `你是一位资深 AI 行业分析师，为一位开发者读者写 AI 发展预测报告。

【读者画像】
${profile}

【新闻素材（${WINDOW_LABEL}，JSON，每条含 url）】
${JSON.stringify(items, null, 1)}

请输出一份 markdown 报告（直接输出 markdown 正文，不要输出任何其他文字，不要使用任何工具），结构如下：
${reportTitle}

${reviewHead}
${reviewHint}（每条 2-3 句，点出关键事件）

## 方向预测
3-5 个接下来 1-3 个月值得关注的 AI 发展方向。每个方向包含：**预测**（一句话判断）、**依据**（${basisHint}，必须用 markdown 链接标注素材出处，格式 [标题](url)，禁止引用素材之外的新闻）、**把握度**（高/中/低）

## 与你技术栈的交叉点
1-3 条：素材中的新闻/预测方向与他的主力栈（LangGraph/RAG/微调/vLLM 部署）的具体交叉，说明能直接用在哪里，标注素材链接

## 本周可动手实验
1-2 个可以马上动手的小实验，每个必须附素材中提到的 repo 或论文链接，说明预期产出

## 简历可写点
1-2 条可直接写进简历的量化表述（数字+技术+结果），基于他已有经历结合本期热点包装

## 结合我的情况
针对上面的读者画像，给出 3 条具体建议：${actionHint}（项目/工具/学习），每条说明为什么适合他、第一步怎么做。要具体到可执行，不要空话。

## 风险提示
${riskHint}`;
}

async function main() {
  const items = collectRecentItems();
  if (items.length < 10) {
    console.error(`[fatal] ${WINDOW_LABEL}素材不足（${items.length} 条），先生成日报再跑预测`);
    process.exit(1);
  }
  console.log(`[info] 汇总${WINDOW_LABEL} ${items.length} 条素材`);

  const profile = fs.existsSync(PROFILE_FILE) ? fs.readFileSync(PROFILE_FILE, 'utf8') : '（未提供用户画像）';
  const prompt = buildPrompt(items, profile);

  let md = null;
  try {
    const stdout = await callKimi(prompt, { retries: 2, timeoutMs: 15 * 60 * 1000, label: KIND });
    md = extractMarkdown(stdout);
  } catch {
    console.error('[fatal] kimi 两次调用均失败');
    process.exit(1);
  }

  const date = beijingToday();
  fs.mkdirSync(FORECAST_DIR, { recursive: true });
  const file = path.join(FORECAST_DIR, `${date}.md`);
  fs.writeFileSync(file, md, 'utf8');
  console.log(`[ok] 写入 ${path.relative(ROOT, file)}（${md.length} 字符）`);

  const dates = fs.readdirSync(FORECAST_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map(f => f.replace(/\.md$/, ''))
    .sort()
    .reverse();
  fs.writeFileSync(
    path.join(FORECAST_DIR, 'index.json'),
    JSON.stringify({ updated_at: new Date().toISOString(), dates }, null, 2) + '\n',
    'utf8',
  );
  console.log('[done] 预测完成');
}

main().catch(err => { console.error('[fatal]', err); process.exitCode = 1; });
