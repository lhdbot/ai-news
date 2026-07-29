#!/usr/bin/env node
/**
 * 本地摘要器：调用本机 Kimi CLI（kimi -p）为未摘要的新闻生成中文内容。
 * 不需要任何 API key，使用本机 Kimi Code 的额度。
 *
 * 用法:
 *   node scripts/summarize-local.mjs            # 处理今日所有 summarized=false 的条目
 *   node scripts/summarize-local.mjs --force=N  # 强制重新摘要前 N 条（调试用）
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
// kimi 是原生 exe，直接调用以避免 Windows cmd 的中文/转义问题
const KIMI = fs.existsSync(path.join(os.homedir(), '.kimi-code', 'bin', 'kimi.exe'))
  ? path.join(os.homedir(), '.kimi-code', 'bin', 'kimi.exe')
  : 'kimi';
const BATCH = 10;
const CATEGORIES = ['模型发布', '论文研究', '行业动态', '工具产品', '芯片算力', '具身智能'];

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const file = path.join(process.cwd(), 'data', 'news', `${beijingToday()}.json`);

if (!fs.existsSync(file)) {
  console.log(`no data file for ${beijingToday()}, nothing to summarize`);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const forceArg = process.argv.find(a => a.startsWith('--force='));
let targets;
if (forceArg) {
  targets = data.items.slice(0, parseInt(forceArg.split('=')[1], 10));
} else {
  targets = data.items.filter(i => !i.summarized);
}

if (targets.length === 0) {
  console.log('all items already summarized');
  process.exit(0);
}

function buildPrompt(batch) {
  const payload = batch.map(i => ({ id: i.id, title: i.title, snippet: (i.summary_zh || '').slice(0, 300), source: i.source }));
  return `你是中文 AI 新闻编辑。对下面 JSON 数组中的每条新闻，生成中文字段。
要求:
- title_zh: 中文标题(15字内,可直接用原标题若已为中文)
- summary_zh: 一句话中文摘要(40字内)
- why_it_matters: 为什么重要(30字内,中文)
- category: 必须是 [${CATEGORIES.join('/')}] 之一
- tags: 2-3个中文或专有名词标签
- 只输出 JSON 数组,每项含 id/title_zh/summary_zh/why_it_matters/category/tags,不要输出任何其他文字,不要使用任何工具

输入:
${JSON.stringify(payload, null, 1)}`;
}

function extractJson(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in output');
  return JSON.parse(text.slice(start, end + 1));
}

let done = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  const prompt = buildPrompt(batch);
  let parsed = null;
  for (let attempt = 1; attempt <= 2 && !parsed; attempt++) {
    try {
      const { stdout } = await run(KIMI, ['-p', prompt], {
        maxBuffer: 64 * 1024 * 1024,
        timeout: 10 * 60 * 1000,
      });
      parsed = extractJson(stdout);
    } catch (e) {
      console.warn(`batch ${i / BATCH + 1} attempt ${attempt} failed: ${e.message.slice(0, 200)}`);
    }
  }
  if (!parsed) {
    console.warn(`batch ${i / BATCH + 1}: skipped (kimi failed twice)`);
    continue;
  }
  const byId = new Map(parsed.map(p => [p.id, p]));
  for (const item of batch) {
    const p = byId.get(item.id);
    if (!p || !CATEGORIES.includes(p.category)) continue;
    item.title_zh = String(p.title_zh || item.title);
    item.summary_zh = String(p.summary_zh || '');
    item.why_it_matters = String(p.why_it_matters || '');
    item.category = p.category;
    item.tags = Array.isArray(p.tags) ? p.tags.map(String).slice(0, 4) : [];
    item.summarized = true;
    done++;
  }
  console.log(`batch ${i / BATCH + 1}: summarized ${done}/${targets.length}`);
}

data.generated_at = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`done: ${done} items summarized via local kimi`);
