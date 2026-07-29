#!/usr/bin/env node
/**
 * 每日个人市场影响分析：取当日日报 + 用户画像，调用本机 Kimi CLI
 * 从市场/行业行情角度分析"今天的新闻对我有什么影响"，
 * 输出 markdown 到 data/impact/YYYY-MM-DD.md。
 *
 * 自守卫：当天文件已存在则直接跳过（每天最多消耗一次 Kimi 调用）。
 * 由 watch-update.bat 在摘要之后调用；也可手动跑：
 *   node scripts/daily-impact.mjs          # 今天已生成则跳过
 *   node scripts/daily-impact.mjs --force  # 强制重新生成
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const KIMI = fs.existsSync(path.join(os.homedir(), '.kimi-code', 'bin', 'kimi.exe'))
  ? path.join(os.homedir(), '.kimi-code', 'bin', 'kimi.exe')
  : 'kimi';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');
const IMPACT_DIR = path.join(ROOT, 'data', 'impact');
const PROFILE_FILE = path.join(ROOT, 'data', 'profile.md');
const MAX_ITEMS = 50;
const MIN_ITEMS = 5;

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

function collectTodayItems(date) {
  const file = path.join(NEWS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const daily = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (daily.items ?? [])
      .map(it => ({
        source: it.source,
        category: it.category,
        title: it.title_zh || it.title,
        summary: (it.summary_zh || '').slice(0, 150),
        advice: (it.advice || '').slice(0, 80),
      }))
      .filter(it => it.title)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function buildPrompt(items, profile, date) {
  return `你是一位资深 AI 行业分析师兼职业顾问。请基于今天的新闻和市场行情，为一位特定开发者分析"这些事对我有什么影响"。

【读者画像】
${profile}

【今日新闻素材（${date}，JSON）】
${JSON.stringify(items, null, 1)}

要求：
- 站在市场/行业行情角度分析（岗位需求变化、技能溢价与贬值、技术方向冷热、公司战略信号），不要复述新闻本身
- 所有结论必须落到"对这位读者"身上，贴着他的技术栈和项目经历，不要放之四海皆准的废话
- 输出 markdown 正文（不要输出任何其他文字，不要使用任何工具），结构固定如下：

# 每日市场影响分析（${date}）

## 今日市场信号
3-5 条从今天新闻读出的市场走向判断（每条一句判断 + 一句依据）

## 对我的影响
分三个维度各 1-2 条：**岗位需求**（招聘市场在为什么样的人付钱）、**技能价值**（他的 LangGraph/RAG/微调/部署技能今天在升值还是贬值）、**项目机会**（他的在途项目能蹭上什么）

## 机会窗口
1-3 个现在动手正合适的事（开源项目/工具/练手方向），说明为什么是现在、第一步做什么

## 风险预警
1-2 条需要警惕的信号（方向过热、技能被替代、护城河变浅等），各给一句应对

## 今日行动建议
1-3 条今天/本周就能执行的具体动作，按优先级排序`;
}

function extractMarkdown(text) {
  // kimi 输出可能带会话尾巴，截到 markdown 开头之后
  const start = text.indexOf('#');
  if (start === -1) throw new Error('no markdown in kimi output');
  let md = text.slice(start);
  const tail = md.indexOf('To resume this session');
  if (tail !== -1) md = md.slice(0, tail);
  // kimi 有时给正文整体加缩进（首行因 slice 从 '#' 开始而缩进已被去掉，
  // 所以计算公共缩进时跳过首行），去掉公共前导空格保证标题/列表正常渲染
  const lines = md.trim().split('\n');
  const indents = lines.slice(1).filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  if (min > 0) md = lines.map((l, i) => (i === 0 ? l : l.slice(Math.min(min, l.match(/^ */)[0].length)))).join('\n');
  return md.trim() + '\n';
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
    console.log(`[skip] 今日（${date}）影响分析已存在，跳过（--force 可重生成）`);
    return;
  }

  const items = collectTodayItems(date);
  if (items.length < MIN_ITEMS) {
    console.log(`[skip] 今日素材不足（${items.length} 条），等日报积累后再生成`);
    return;
  }
  console.log(`[info] 今日素材 ${items.length} 条，调用 Kimi 生成影响分析…`);

  const profile = fs.existsSync(PROFILE_FILE) ? fs.readFileSync(PROFILE_FILE, 'utf8') : '（未提供用户画像）';
  const prompt = buildPrompt(items, profile, date);

  let md = null;
  for (let attempt = 1; attempt <= 2 && !md; attempt++) {
    try {
      const { stdout } = await run(KIMI, ['-p', prompt], { maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
      md = extractMarkdown(stdout);
    } catch (e) {
      console.warn(`[warn] attempt ${attempt} failed: ${e.message.slice(0, 200)}`);
    }
  }
  if (!md) {
    console.error('[fatal] kimi 两次调用均失败');
    process.exit(1);
  }

  fs.writeFileSync(file, md, 'utf8');
  console.log(`[ok] 写入 ${path.relative(ROOT, file)}（${md.length} 字符）`);
  updateIndex();
  console.log('[done] 影响分析完成');
}

main().catch(err => { console.error('[fatal]', err); process.exitCode = 1; });
