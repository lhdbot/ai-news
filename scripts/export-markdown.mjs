#!/usr/bin/env node
/**
 * 日报 markdown 导出：读当日（或 --date 指定）的 data/news/YYYY-MM-DD.json，
 * 导出 data/news/YYYY-MM-DD.md —— 标题、日期，每条 [title_zh](url) +
 * source/category/tags + 摘要/学到/影响/建议 四段。
 *
 * 用法:
 *   node scripts/export-markdown.mjs                # 导出当日日报
 *   node scripts/export-markdown.mjs --date=2026-08-14
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, 'data', 'news');

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

const dateArg = process.argv.find(a => a.startsWith('--date='));
const date = dateArg ? dateArg.split('=')[1] : beijingToday();

const src = path.join(NEWS_DIR, `${date}.json`);
if (!fs.existsSync(src)) {
  console.log(`[skip] ${src} 不存在`);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
const items = data.items ?? [];

const lines = [`# AI 日报（${date}）`, '', `> 共 ${items.length} 条`, ''];
items.forEach((it, i) => {
  const title = it.title_zh || it.title;
  lines.push(`## ${i + 1}. [${title}](${it.url})`, '');
  const meta = [`来源：${it.source || '未知'}`];
  if (it.category) meta.push(`分类：${it.category}`);
  if (Array.isArray(it.tags) && it.tags.length) meta.push(`标签：${it.tags.join('、')}`);
  lines.push(meta.join(' · '), '');
  if (it.summary_zh) lines.push(`**摘要**：${it.summary_zh}`, '');
  if (it.learn) lines.push(`**学到**：${it.learn}`, '');
  if (it.impact) lines.push(`**影响**：${it.impact}`, '');
  if (it.advice) lines.push(`**建议**：${it.advice}`, '');
});

const out = path.join(NEWS_DIR, `${date}.md`);
fs.writeFileSync(out, lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', 'utf8');
console.log(`[ok] 写入 ${path.relative(ROOT, out)}（${items.length} 条）`);
