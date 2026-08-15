#!/usr/bin/env node
/**
 * 个人市场影响分析：汇总近 N 天日报 + 用户画像，调用本机 Kimi CLI
 * 从市场/行业行情角度分析"这些新闻对我有什么影响"。
 * 每条结论都必须用 markdown 链接标注依据出处（标题/来源/日期）。
 *
 * --days=3（默认）：三日影响分析，写入 data/impact/daily/YYYY-MM-DD.md
 * --days=7       ：七天影响分析，写入 data/impact/weekly/YYYY-MM-DD.md
 *
 * 自守卫：当天对应文件已存在则直接跳过（每个周期最多消耗一次 Kimi 调用）。
 * 由 watch-update.bat（--days=3）和 weekly-forecast.bat（--days=7）调用；也可手动跑：
 *   node scripts/daily-impact.mjs [--days=N]          # 已生成则跳过
 *   node scripts/daily-impact.mjs [--days=N] --force  # 强制重新生成
 */
import fs from 'node:fs';
import path from 'node:path';
import { callKimi, extractMarkdown } from './lib/kimi.mjs';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const IMPACT_ROOT = path.join(ROOT, 'data', 'impact');
const PROFILE_FILE = path.join(ROOT, 'data', 'profile.md');
const MAX_ITEMS = 80;
const MIN_ITEMS = 5;

const daysArg = process.argv.find(a => a.startsWith('--days='));
const DAYS = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10) || 3) : 3;
const WEEKLY = DAYS >= 7;
const KIND = WEEKLY ? 'weekly' : 'daily';
const IMPACT_DIR = path.join(IMPACT_ROOT, KIND);
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
        if (!(it.title_zh || it.title)) continue;
        items.push({
          date,
          source: it.source,
          category: it.category,
          title: it.title_zh || it.title,
          url: it.url,
          summary: (it.summary_zh || '').slice(0, 150),
          advice: (it.advice || '').slice(0, 80),
        });
      }
    } catch { /* 跳过损坏文件 */ }
  }
  return items.slice(0, MAX_ITEMS);
}

function buildPrompt(items, profile, date) {
  const signalHead = WEEKLY ? '## 本周市场信号' : '## 近期市场信号';
  const signalHint = WEEKLY ? '3-5 条从本周新闻读出的市场走向判断' : '3-5 条从近三天新闻读出的市场走向判断';
  const actionHead = WEEKLY ? '## 本周行动建议' : '## 近期行动建议';
  return `你是一位资深 AI 行业分析师兼职业顾问。请基于${WINDOW_LABEL}的新闻和市场行情，为一位特定开发者分析"这些事对我有什么影响"。

【读者画像】
${profile}

【新闻素材（${WINDOW_LABEL}，JSON，每条含 url）】
${JSON.stringify(items, null, 1)}

要求：
- 站在市场/行业行情角度分析（岗位需求变化、技能溢价与贬值、技术方向冷热、公司战略信号），不要复述新闻本身
- 所有结论必须落到"对这位读者"身上，贴着他的技术栈和项目经历，不要放之四海皆准的废话
- 【可溯源，最重要】每个板块里的每一条结论，结尾都必须用 markdown 链接标注依据，格式：
  （依据：[新闻标题](url) · 来源 · 日期；多条依据并列，用 ；分隔）
  依据只能引用上面素材中的条目，禁止编造或引用素材之外的新闻；没有素材支撑的判断不要写
- 输出 markdown 正文（不要输出任何其他文字，不要使用任何工具），结构固定如下：

# 市场影响分析（${WINDOW_LABEL} · ${date}）

${signalHead}
${signalHint}（每条一句判断 + 一句依据）

## 对我的影响
分三个维度各 1-2 条：**岗位需求**（招聘市场在为什么样的人付钱）、**技能价值**（他的 LangGraph/RAG/微调/部署技能在升值还是贬值）、**项目机会**（他的在途项目能蹭上什么）

## 与你技术栈的交叉点
1-3 条：素材中的新闻与他的主力栈（LangGraph/RAG/微调/vLLM 部署）的具体交叉，说明能直接用在哪里

## 本周可动手实验
1-2 个可以马上动手的小实验，每个必须附素材中提到的 repo 或论文链接，说明预期产出

## 简历可写点
1-2 条可直接写进简历的量化表述（数字+技术+结果），基于他已有经历结合本期新闻热点包装

## 机会窗口
1-3 个现在动手正合适的事（开源项目/工具/练手方向），说明为什么是现在、第一步做什么

## 风险预警
1-2 条需要警惕的信号（方向过热、技能被替代、护城河变浅等），各给一句应对

${actionHead}
1-3 条马上就能执行的具体动作，按优先级排序`;
}

function updateIndex() {
  const dates = fs.readdirSync(IMPACT_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map(f => f.replace(/\.md$/, ''))
    .sort()
    .reverse();
  fs.writeFileSync(
    path.join(IMPACT_DIR, 'index.json'),
    JSON.stringify({ updated_at: new Date().toISOString(), dates }, null, 2) + '\n',
    'utf8',
  );
}

async function main() {
  const force = process.argv.includes('--force');
  const date = beijingToday();
  fs.mkdirSync(IMPACT_DIR, { recursive: true });
  const file = path.join(IMPACT_DIR, `${date}.md`);

  if (!force && fs.existsSync(file)) {
    console.log(`[skip] 今日（${date}）${KIND} 影响分析已存在，跳过（--force 可重生成）`);
    return;
  }

  const items = collectRecentItems();
  if (items.length < MIN_ITEMS) {
    console.log(`[skip] ${WINDOW_LABEL}素材不足（${items.length} 条），等日报积累后再生成`);
    return;
  }
  console.log(`[info] ${WINDOW_LABEL}素材 ${items.length} 条，调用 Kimi 生成 ${KIND} 影响分析…`);

  const profile = fs.existsSync(PROFILE_FILE) ? fs.readFileSync(PROFILE_FILE, 'utf8') : '（未提供用户画像）';
  const prompt = buildPrompt(items, profile, date);

  let md = null;
  try {
    const stdout = await callKimi(prompt, { retries: 2, timeoutMs: 15 * 60 * 1000, label: KIND });
    md = extractMarkdown(stdout);
  } catch {
    console.error('[fatal] kimi 两次调用均失败');
    process.exit(1);
  }

  fs.writeFileSync(file, md, 'utf8');
  console.log(`[ok] 写入 ${path.relative(ROOT, file)}（${md.length} 字符）`);
  updateIndex();
  console.log('[done] 影响分析完成');
}

main().catch(err => { console.error('[fatal]', err); process.exitCode = 1; });
