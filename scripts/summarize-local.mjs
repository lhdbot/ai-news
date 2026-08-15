#!/usr/bin/env node
/**
 * 本地摘要器：调用本机 Kimi CLI（kimi -p）为未摘要的新闻生成中文内容。
 * 不需要任何 API key，使用本机 Kimi Code 的额度。
 *
 * 用法:
 *   node scripts/summarize-local.mjs            # 处理今日所有 summarized=false 的条目
 *   node scripts/summarize-local.mjs --force=N  # 强制重新摘要前 N 条（调试用）
 *
 * 增强：
 * - 每条额外输出 trends（taxonomy id，1-3 个，非法值落盘前丢弃）
 * - category=论文研究 或来源为 arXiv/Hugging Face 的条目额外输出 method/result/limitation
 * - 批次 Kimi 重试仍失败且配置了 DEEPSEEK_API_KEY 时，用 DeepSeek API 兜底该批次
 * - tags 落盘前按 data/tag-aliases.json 归一化
 */
import fs from 'node:fs';
import path from 'node:path';
import { callKimi, extractJson } from './lib/kimi.mjs';

const BATCH = 10;
const CATEGORIES = ['模型发布', '论文研究', '行业动态', '工具产品', '芯片算力', '具身智能'];
const PAPER_SOURCES = /arxiv|hugging\s*face/i;

const ROOT = process.cwd();
const TAXONOMY_FILE = path.join(ROOT, 'data', 'trends', 'taxonomy.json');
const TAG_ALIAS_FILE = path.join(ROOT, 'data', 'tag-aliases.json');

// taxonomy：prompt 里注入 id+name 清单供模型选择，落盘前校验 id 合法性
const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'));
const VALID_TREND_IDS = new Set(taxonomy.nodes.map(n => n.id));
const TREND_MENU = taxonomy.nodes.map(n => `${n.id}（${n.name}）`).join('、');

// tag 别名归一化表（key 统一小写比较）
const aliases = JSON.parse(fs.readFileSync(TAG_ALIAS_FILE, 'utf8'));
const aliasMap = new Map(Object.entries(aliases).map(([k, v]) => [k.toLowerCase(), v]));
const normalizeTag = t => aliasMap.get(String(t).trim().toLowerCase()) ?? String(t).trim();

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const file = path.join(ROOT, 'data', 'news', `${beijingToday()}.json`);

if (!fs.existsSync(file)) {
  console.log(`no data file for ${beijingToday()}, nothing to summarize`);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const forceArg = process.argv.find(a => a.startsWith('--force='));
const allFlag = process.argv.includes('--all');
let targets;
if (allFlag) {
  targets = data.items;
} else if (forceArg) {
  targets = data.items.slice(0, parseInt(forceArg.split('=')[1], 10));
} else {
  targets = data.items.filter(i => !i.summarized);
}

if (targets.length === 0) {
  console.log('all items already summarized');
  process.exit(0);
}

const isPaper = i => i.category === '论文研究' || PAPER_SOURCES.test(i.source || '');

function buildPrompt(batch) {
  const payload = batch.map(i => ({
    id: i.id,
    title: i.title,
    snippet: (i.summary_zh || '').slice(0, 300),
    source: i.source,
    paper: isPaper(i),
  }));
  return `你是中文 AI 新闻编辑，读者是一位想持续学习 AI 的开发者。对下面 JSON 数组中的每条新闻，生成中文字段。
要求:
- title_zh: 中文标题(15字内,可直接用原标题若已为中文)
- summary_zh: 对原文内容的总结(60字内,说清发生了什么,不要只复述标题)
- learn: 读者可以从中学到什么(40字内,知识点/方法/趋势)
- impact: 这件事的影响(30字内,对行业/技术/用户)
- advice: 给读者的行动建议(30字内,具体可执行,如试试某个工具/关注某个方向/读原文)
- category: 必须是 [${CATEGORIES.join('/')}] 之一
- tags: 2-3个中文或专有名词标签
- trends: 从以下趋势 taxonomy 中选 1-3 个最贴切的 id：${TREND_MENU}。只能从清单中选，输出 id 数组
- paper=true 的条目额外输出三个字段（各一句话）：method（论文用了什么方法）、result（取得了什么结果）、limitation（有什么局限）；paper=false 的条目不要输出这三个字段
- 只输出 JSON 数组,每项含 id/title_zh/summary_zh/learn/impact/advice/category/tags/trends(及 paper 条目的 method/result/limitation),不要输出任何其他文字,不要使用任何工具

输入:
${JSON.stringify(payload, null, 1)}`;
}

/** DeepSeek API 兜底：仅当配置了 DEEPSEEK_API_KEY 时可用，失败返回 null */
async function callDeepSeek(prompt) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn(`deepseek fallback failed: ${e.message.slice(0, 200)}`);
    return null;
  }
}

let done = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  const prompt = buildPrompt(batch);
  let parsed = null;
  try {
    const stdout = await callKimi(prompt, { retries: 2, timeoutMs: 10 * 60 * 1000, label: `batch ${i / BATCH + 1}` });
    parsed = extractJson(stdout);
  } catch (e) {
    console.warn(`batch ${i / BATCH + 1}: kimi failed, trying deepseek fallback`);
    const out = await callDeepSeek(prompt);
    if (out) {
      try {
        parsed = extractJson(out);
      } catch (e2) {
        console.warn(`batch ${i / BATCH + 1}: deepseek output unparseable: ${e2.message.slice(0, 200)}`);
      }
    }
  }
  if (!parsed) {
    console.warn(`batch ${i / BATCH + 1}: skipped (kimi and fallback both failed)`);
    continue;
  }
  const byId = new Map(parsed.map(p => [p.id, p]));
  for (const item of batch) {
    const p = byId.get(item.id);
    if (!p || !CATEGORIES.includes(p.category)) continue;
    item.title_zh = String(p.title_zh || item.title);
    item.summary_zh = String(p.summary_zh || '');
    item.learn = String(p.learn || '');
    item.impact = String(p.impact || '');
    item.advice = String(p.advice || '');
    item.category = p.category;
    item.tags = Array.isArray(p.tags) ? p.tags.map(normalizeTag).filter(Boolean).slice(0, 4) : [];
    // trends 校验：只保留合法 taxonomy id，最多 3 个
    item.trends = Array.isArray(p.trends)
      ? [...new Set(p.trends.map(String))].filter(t => VALID_TREND_IDS.has(t)).slice(0, 3)
      : [];
    // 论文条目三字段；非论文条目确保不带这些字段
    if (isPaper(item)) {
      item.method = String(p.method || '');
      item.result = String(p.result || '');
      item.limitation = String(p.limitation || '');
    } else {
      delete item.method;
      delete item.result;
      delete item.limitation;
    }
    item.summarized = true;
    done++;
  }
  console.log(`batch ${i / BATCH + 1}: summarized ${done}/${targets.length}`);
  // 每批落盘一次，中断不丢已花费的额度
  data.generated_at = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

data.generated_at = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`done: ${done} items summarized via local kimi`);
