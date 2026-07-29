#!/usr/bin/env node
/**
 * 每周 AI 发展预测：汇总近 7 天日报 + 用户画像，调用本机 Kimi CLI 生成
 * markdown 预测报告，写入 data/forecasts/YYYY-MM-DD.md。
 *
 * 用法：node scripts/weekly-forecast.mjs
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
const FORECAST_DIR = path.join(ROOT, 'data', 'forecasts');
const PROFILE_FILE = path.join(ROOT, 'data', 'profile.md');
const MAX_ITEMS = 120;

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

function last7Dates() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(Date.now() + 8 * 3600e3 - i * 86400e3).toISOString().slice(0, 10));
  }
  return dates;
}

function collectWeekItems() {
  const items = [];
  for (const date of last7Dates()) {
    const file = path.join(NEWS_DIR, `${date}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const daily = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const it of daily.items ?? []) {
        items.push({ date, source: it.source, title: it.title_zh || it.title, summary: (it.summary_zh || '').slice(0, 120), category: it.category });
      }
    } catch { /* 跳过损坏文件 */ }
  }
  return items.slice(0, MAX_ITEMS);
}

function buildPrompt(items, profile) {
  return `你是一位资深 AI 行业分析师，为一位开发者读者写每周 AI 发展预测报告。

【读者画像】
${profile}

【本周新闻素材（近 7 天，JSON）】
${JSON.stringify(items, null, 1)}

请输出一份 markdown 报告（直接输出 markdown 正文，不要输出任何其他文字，不要使用任何工具），结构如下：
# AI 周报预测（${beijingToday()}）

## 本周盘点
3-5 条本周最重要的主线（每条 2-3 句，点出关键事件）

## 方向预测
3-5 个接下来 1-3 个月值得关注的 AI 发展方向。每个方向包含：**预测**（一句话判断）、**依据**（从本周素材推导）、**把握度**（高/中/低）

## 结合我的情况
针对上面的读者画像，给出 3 条具体建议：本周可以动手做什么（项目/工具/学习），每条说明为什么适合他、第一步怎么做。要具体到可执行，不要空话。

## 风险提示
1-2 条本周新闻中值得警惕的信号`;
}

function extractMarkdown(text) {
  // kimi 输出可能带会话尾巴，截到 markdown 开头之后
  const start = text.indexOf('#');
  if (start === -1) throw new Error('no markdown in kimi output');
  let md = text.slice(start);
  const tail = md.indexOf('To resume this session');
  if (tail !== -1) md = md.slice(0, tail);
  return md.trim() + '\n';
}

async function main() {
  const items = collectWeekItems();
  if (items.length < 10) {
    console.error(`[fatal] 近 7 天素材不足（${items.length} 条），先生成日报再跑预测`);
    process.exit(1);
  }
  console.log(`[info] 汇总近 7 天 ${items.length} 条素材`);

  const profile = fs.existsSync(PROFILE_FILE) ? fs.readFileSync(PROFILE_FILE, 'utf8') : '（未提供用户画像）';
  const prompt = buildPrompt(items, profile);

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
