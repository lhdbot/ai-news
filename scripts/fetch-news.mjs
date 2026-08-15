#!/usr/bin/env node
/**
 * AI 日报抓取 + 摘要脚本
 *
 * - 并发抓取 data/sources.json 配置的内容源（RSS / JSON API），单源 15s 超时，失败仅告警
 * - 取近 48h 条目，按 URL 去重；官方源加权、每源限 5 条，取 top 30
 * - 有 DEEPSEEK_API_KEY 时调用 DeepSeek（OpenAI 兼容）批量生成
 *   中文标题 / 一句话摘要 / 为什么重要 / 分类 / 标签（批次失败 sleep 2s 重试 1 次再降级）
 * - 无 key 时降级：保留原标题，category 按源类型推断，summarized=false
 * - pickTop 之后按标题分词 Jaccard 相似度合并同一事件的跨源报道（storyline 合并）
 * - 每源健康状态写 data/state/source-health.json，连续失败 ≥3 天经 scripts/lib/notify.mjs 告警
 * - 至少一个源抓取成功才写 data/state/last-success.json（全源失败不更新，
 *   scripts/heartbeat.mjs 据此判断断更并告警）
 * - 跨天复用：近 3 天已总结过的条目直接继承摘要，不再重复调用 LLM（省 token、避免搜索/标签重复）
 * - 输出 data/news/YYYY-MM-DD.json（北京时间；已存在则按 URL 合并去重）
 *   并维护 data/index.json
 *
 * 用法：node scripts/fetch-news.mjs
 */

import { extract, extractFromXml } from "@extractus/feed-extractor";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const NEWS_DIR = path.join(ROOT, "data", "news");
const INDEX_FILE = path.join(ROOT, "data", "index.json");
const STATE_DIR = path.join(ROOT, "data", "state");
const SOURCE_HEALTH_FILE = path.join(STATE_DIR, "source-health.json");
const LAST_SUCCESS_FILE = path.join(STATE_DIR, "last-success.json");

const FETCH_TIMEOUT_MS = 15_000;
const WINDOW_HOURS = 48;
const PER_SOURCE_CAP = 5;
const TOP_N = 30;
const DEEPSEEK_BATCH = 10;
const REUSE_DAYS = 3; // 跨天复用摘要的查找窗口（覆盖 48h 抓取窗口的跨日重合）

const CATEGORIES = [
  "模型发布",
  "论文研究",
  "行业动态",
  "工具产品",
  "芯片算力",
  "具身智能",
];

/**
 * 信息源列表来自 data/sources.json —— 想加源直接改那个文件，
 * 下次抓取（巡检每 30 分钟跑一次）自动生效，无需动本脚本。
 * 字段：name / url / type(rss|hf|trending|deepseek-news) / weight(越大排序越靠前，
 * 官方一手源 10+) / category(无 LLM 摘要时的兜底分类) / site(首页，页脚展示用)
 */
const SOURCES_FILE = path.join(ROOT, "data", "sources.json");

function loadSources() {
  const list = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf-8"));
  return list.filter((s) => s && s.name && s.url && s.type);
}

const SOURCES = loadSources();

const USER_AGENT =
  "Mozilla/5.0 (compatible; ai-news-daily/1.0; +https://github.com/)";

/* ------------------------------ 工具函数 ------------------------------ */

function todayCN() {
  // 日报日期按北京时间计
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 任一时刻对应的北京时区自然日（YYYY-MM-DD） */
function cnDay(dateInput) {
  const t =
    dateInput instanceof Date ? dateInput.getTime() : new Date(dateInput).getTime();
  return new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function hashId(str) {
  return crypto.createHash("sha1").update(str).digest("hex").slice(0, 12);
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    // 去掉常见追踪参数
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "src") {
        u.searchParams.delete(key);
      }
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function stripHtml(s) {
  return (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 从 LLM 输出中容错提取 JSON（取第一个 [ 到最后一个 ]；否则取第一个 { 到最后一个 }） */
function extractJson(text) {
  if (!text) return null;
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(text.slice(arrStart, arrEnd + 1));
    } catch {
      /* 继续尝试对象 */
    }
  }
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(text.slice(objStart, objEnd + 1));
    } catch {
      return null;
    }
  }
  return null;
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} 超时（>${ms / 1000}s）`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ 抓取各源 ------------------------------ */

async function fetchRssSource(source, since) {
  let feed;
  try {
    feed = await withTimeout(
      extract(
        source.url,
        { descriptionMaxLen: 500, useISODateFormat: true },
        {
          headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      ),
      FETCH_TIMEOUT_MS + 2000,
      source.name,
    );
  } catch (directErr) {
    // 直连失败时回退 curl + 代理抓取 XML 后本地解析（GitHub atom 等源在部分网络环境需代理）
    const proxy = process.env.AI_NEWS_PROXY ?? "http://127.0.0.1:7897";
    const { stdout } = await execFileP(
      "curl",
      ["-s", "--max-time", String(FETCH_TIMEOUT_MS / 1000), "-x", proxy, "-A", USER_AGENT, source.url],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    if (!stdout || stdout.length < 200) {
      throw new Error(`直连失败(${(directErr.message || "").slice(0, 80)})且代理抓取内容异常`);
    }
    feed = extractFromXml(stdout, { descriptionMaxLen: 500, useISODateFormat: true });
  }
  const items = [];
  for (const entry of feed.entries ?? []) {
    if (!entry.link || !entry.title) continue;
    const published = entry.published ? new Date(entry.published) : null;
    if (published && !Number.isNaN(published.getTime())) {
      if (published < since) continue;
    }
    items.push({
      id: hashId(normalizeUrl(entry.link)),
      title: stripHtml(entry.title),
      url: entry.link,
      source: source.name,
      category: source.category,
      tags: [],
      published_at: published && !Number.isNaN(published.getTime())
        ? published.toISOString()
        : new Date().toISOString(),
      _weight: source.weight,
      _description: stripHtml(entry.description ?? "").slice(0, 500),
    });
  }
  return items;
}

async function fetchHfSource(source, since) {
  const res = await withTimeout(
    fetch(source.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
    FETCH_TIMEOUT_MS + 2000,
    source.name,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const papers = await res.json();
  const items = [];
  for (const p of Array.isArray(papers) ? papers : []) {
    const paper = p.paper ?? p;
    const title = paper.title ?? p.title;
    const paperId = paper.id ?? p.id;
    if (!title || !paperId) continue;
    const publishedRaw = paper.publishedAt ?? p.publishedAt ?? paper.submittedOn;
    const published = publishedRaw ? new Date(publishedRaw) : null;
    if (published && !Number.isNaN(published.getTime()) && published < since) {
      continue;
    }
    const url = `https://huggingface.co/papers/${paperId}`;
    items.push({
      id: hashId(normalizeUrl(url)),
      title: String(title).trim(),
      url,
      source: source.name,
      category: source.category,
      tags: [],
      published_at: published && !Number.isNaN(published.getTime())
        ? published.toISOString()
        : new Date().toISOString(),
      _weight: source.weight,
      _description: stripHtml(paper.summary ?? "").slice(0, 500),
    });
  }
  return items;
}

/* ------------------------- GitHub Trending ------------------------- */

/** github.com 网页在部分网络环境需走代理；优先直连，失败后回退 curl + 代理 */
async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (directErr) {
    const proxy = process.env.AI_NEWS_PROXY ?? "http://127.0.0.1:7897";
    const { stdout } = await execFileP(
      "curl",
      ["-s", "--max-time", String(FETCH_TIMEOUT_MS / 1000), "-x", proxy, "-A", "Mozilla/5.0", url],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    if (!stdout || stdout.length < 10000) {
      throw new Error(`直连失败(${(directErr.message || "").slice(0, 80)})且代理抓取内容异常`);
    }
    return stdout;
  }
}

/** 解析 Trending 页面第 1 名仓库 */
async function fetchTrendingSource(source) {
  const html = await withTimeout(fetchHtml(source.url), FETCH_TIMEOUT_MS + 5000, source.name);
  const m = html.match(/<article class="Box-row">[\s\S]*?<\/article>/);
  if (!m) throw new Error("未解析到 Trending 条目（页面结构可能已变更）");
  const art = m[0];

  const repoMatch = art.match(/<h2[^>]*>[\s\S]*?<a href="(\/[^"]+)"/);
  if (!repoMatch) throw new Error("未解析到仓库链接");
  const repoPath = repoMatch[1].trim(); // /owner/repo
  const repoName = repoPath.slice(1);

  const descMatch = art.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/);
  const desc = descMatch ? stripHtml(descMatch[1]) : "";

  const langMatch = art.match(/itemprop="programmingLanguage">([^<]+)</);
  const lang = langMatch ? langMatch[1].trim() : "";

  const starsMatch = art.match(/([\d,]+)\s*stars\s*(today|this week|this month)/);
  const stars = starsMatch ? `${starsMatch[1]} stars ${starsMatch[2]}` : "";

  const url = `https://github.com${repoPath}`;
  return [
    {
      id: hashId(normalizeUrl(url) + source.name),
      title: `${repoName}: ${desc || "GitHub Trending #1"}`,
      url,
      source: source.name,
      category: source.category,
      tags: [],
      published_at: new Date().toISOString(),
      _weight: source.weight,
      _description: [desc, lang && `语言: ${lang}`, stars && `热度: ${stars}`]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500),
    },
  ];
}

/* ------------------------- DeepSeek 官网新闻 ------------------------- */

/**
 * www.deepseek.com 无 RSS，抓取 /news/ 页中的 /news/<slug>/ 链接。
 * 已见 slug 存 data/state/deepseek-news.json，只上报新增公告；
 * 首次运行仅记录存量，避免把历史公告当新闻刷屏。
 */
const DS_STATE_FILE = path.join(ROOT, "data", "state", "deepseek-news.json");

async function fetchDeepseekNewsSource(source) {
  const html = await withTimeout(fetchHtml(source.url), FETCH_TIMEOUT_MS + 5000, source.name);
  const found = new Map(); // slug -> 链接文本
  for (const m of html.matchAll(/<a\b[^>]*href="\/news\/([a-z0-9-]+)\/"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const slug = m[1].toLowerCase();
    if (!found.has(slug)) found.set(slug, stripHtml(m[2]).slice(0, 100));
  }
  const slugs = [...found.keys()];
  if (slugs.length === 0) throw new Error("未解析到官网新闻链接（页面结构可能已变更）");

  let seen = null;
  try {
    seen = new Set(JSON.parse(fs.readFileSync(DS_STATE_FILE, "utf-8")));
  } catch { /* 首次运行 */ }
  fs.mkdirSync(path.dirname(DS_STATE_FILE), { recursive: true });
  fs.writeFileSync(DS_STATE_FILE, JSON.stringify(slugs, null, 2) + "\n", "utf-8");
  if (!seen) {
    console.log(`[info] ${source.name}: 首次运行，记录 ${slugs.length} 条存量公告，不上报`);
    return [];
  }

  return slugs
    .filter((slug) => !seen.has(slug))
    .map((slug) => {
      const url = `https://www.deepseek.com/news/${slug}/`;
      const linkText = found.get(slug);
      return {
        id: hashId(normalizeUrl(url)),
        title: `DeepSeek 官网新公告: ${linkText || slug}`,
        url,
        source: source.name,
        category: source.category,
        tags: ["DeepSeek"],
        published_at: new Date().toISOString(),
        _weight: source.weight,
        _description: `DeepSeek 官网发布新公告（${slug}），详见 ${url}`,
      };
    });
}

async function fetchAllSources(since) {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const items =
        source.type === "hf"
          ? await fetchHfSource(source, since)
          : source.type === "trending"
            ? await fetchTrendingSource(source)
            : source.type === "deepseek-news"
              ? await fetchDeepseekNewsSource(source)
              : await fetchRssSource(source, since);
      console.log(`[ok] ${source.name}: ${items.length} 条`);
      return items;
    }),
  );
  const all = [];
  const failed = [];
  const statuses = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
      statuses.push({ name: SOURCES[i].name, ok: true });
    } else {
      failed.push(SOURCES[i].name);
      statuses.push({
        name: SOURCES[i].name,
        ok: false,
        error: r.reason?.message ?? String(r.reason),
      });
      console.warn(`[warn] 源「${SOURCES[i].name}」抓取失败: ${r.reason?.message ?? r.reason}`);
    }
  });
  if (failed.length > 0) {
    console.warn(`[warn] 共 ${failed.length} 个源失败（已跳过）: ${failed.join(", ")}`);
  }
  await updateSourceHealth(statuses);
  // 附加源成功数（挂在数组上，保持返回类型不变）
  all.okCount = statuses.filter((s) => s.ok).length;
  return all;
}

/* ------------------------------ 源健康监控 ------------------------------ */

/** 经 scripts/lib/notify.mjs 发送告警；该文件可能尚不存在（由其他模块提供），容忍缺失 */
async function tryNotify(text) {
  console.log(`[alert] ${text}`);
  try {
    const mod = await import("./lib/notify.mjs");
    if (typeof mod.notify === "function") {
      await mod.notify(text);
      console.log("[ok] 告警已通过 lib/notify.mjs 发送");
    }
  } catch (err) {
    console.warn(`[warn] notify 模块不可用，告警仅记录日志: ${err.message}`);
  }
}

function prevCNDay(dayStr) {
  const t = new Date(`${dayStr}T00:00:00Z`).getTime() - 24 * 3600 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * 把每个源的抓取结果写入 data/state/source-health.json：
 * { 源名: { lastOk, lastFail, consecutiveFailDays } }
 * 连续失败天数按北京时区自然日累计（跨运行）：成功则清零；
 * 连续失败 ≥3 天时触发告警。
 */
async function updateSourceHealth(statuses) {
  let health = {};
  try {
    health = JSON.parse(fs.readFileSync(SOURCE_HEALTH_FILE, "utf-8"));
  } catch {
    /* 首次运行 */
  }
  const today = todayCN();
  const nowIso = new Date().toISOString();
  for (const st of statuses) {
    const h = health[st.name] ?? {
      lastOk: null,
      lastFail: null,
      consecutiveFailDays: 0,
    };
    if (st.ok) {
      h.lastOk = nowIso;
      h.consecutiveFailDays = 0;
    } else {
      const prevFailDay = h.lastFail ? cnDay(h.lastFail) : null;
      if (prevFailDay === today) {
        // 同一天内多次失败只算一天
        h.consecutiveFailDays = Math.max(1, h.consecutiveFailDays ?? 0);
      } else if (prevFailDay === prevCNDay(today)) {
        h.consecutiveFailDays = (h.consecutiveFailDays ?? 0) + 1;
      } else {
        h.consecutiveFailDays = 1;
      }
      h.lastFail = nowIso;
    }
    health[st.name] = h;
  }
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    SOURCE_HEALTH_FILE,
    JSON.stringify(health, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[ok] 更新 data/state/source-health.json（${statuses.length} 个源）`);
  for (const st of statuses) {
    const h = health[st.name];
    if (!st.ok && h.consecutiveFailDays >= 3) {
      await tryNotify(
        `ai-news 源「${st.name}」已连续 ${h.consecutiveFailDays} 天抓取失败，最近错误: ${st.error ?? "未知"}`,
      );
    }
  }
}

/* ------------------------------ 排序与筛选 ------------------------------ */

function pickTop(items) {
  // 按 URL 去重
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = normalizeUrl(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  // 排序：源权重优先，其次时间新
  deduped.sort((a, b) => {
    if (b._weight !== a._weight) return b._weight - a._weight;
    return new Date(b.published_at) - new Date(a.published_at);
  });
  // 每源限额 + top N
  const perSource = new Map();
  const picked = [];
  for (const item of deduped) {
    const n = perSource.get(item.source) ?? 0;
    if (n >= PER_SOURCE_CAP) continue;
    perSource.set(item.source, n + 1);
    picked.push(item);
    if (picked.length >= TOP_N) break;
  }
  return picked;
}

/* --------------------------- 事件（storyline）合并 --------------------------- */

const STORYLINE_THRESHOLD = 0.6;

/** 归一化标题（小写、去标点）后混合分词：
 *  连续汉字段切相邻字符 bigram，英文/数字段按词保留。
 *  中文标题没有空格，旧版按空白切分会让整句变成一个 token，跨源中文报道
 *  的 Jaccard 相似度趋近于 0、事件合并失效；bigram 对同义改写更稳健。
 */
function titleTokens(title) {
  const text = (title ?? "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return new Set();
  const tokens = new Set();
  const runs = text.match(/[\p{Script=Han}]+|[^\p{Script=Han}\s]+/gu) ?? [];
  for (const run of runs) {
    if (run.length === 1) {
      tokens.add(`c:${run}`);
      continue;
    }
    if (/^[\p{Script=Han}]+$/u.test(run)) {
      for (let i = 0; i + 1 < run.length; i++) {
        tokens.add(`c:${run[i]}${run[i + 1]}`);
      }
    } else {
      tokens.add(`w:${run}`);
    }
  }
  return tokens;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * 标题分词两两 Jaccard ≥ 0.6 且来自不同源的条目合并为一个事件组（并查集传递合并）：
 * 保留组内 _weight 最高的条目，其余进其 relatedSources: [{source, url}]；
 * heat = 主源 _weight + 2 * (合并数 - 1)，未合并条目 heat = _weight。
 */
function mergeStorylines(items) {
  const tokens = items.map((it) => titleTokens(it.title));
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].source === items[j].source) continue;
      if (jaccard(tokens[i], tokens[j]) >= STORYLINE_THRESHOLD) union(i, j);
    }
  }
  const groups = new Map();
  items.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });
  const merged = [];
  let groupCount = 0;
  for (const idxs of groups.values()) {
    idxs.sort((a, b) => items[b]._weight - items[a]._weight);
    const main = { ...items[idxs[0]] };
    const others = idxs.slice(1);
    if (others.length > 0) {
      groupCount++;
      main.relatedSources = others.map((k) => ({
        source: items[k].source,
        url: items[k].url,
      }));
    }
    main.heat = main._weight + 2 * others.length;
    merged.push(main);
  }
  console.log(
    `[info] 事件合并：${items.length} 条 → ${merged.length} 条，合并组数 ${groupCount}`,
  );
  return merged;
}

/* ------------------------------ DeepSeek 摘要 ------------------------------ */

async function summarizeBatch(apiKey, batch) {
  const payload = batch.map((it, i) => ({
    idx: i,
    title: it.title,
    source: it.source,
    description: it._description,
  }));
  const prompt = [
    "你是一名资深 AI 行业编辑，读者是一位想持续学习 AI 的开发者。下面是若干条 AI 相关新闻/论文/开源项目的标题与简介（JSON 数组）。",
    "请为每一条生成以下字段，并以 JSON object 返回，形如 {\"items\": [{\"idx\": 0, ...}]}：",
    '- "title_zh": 简洁准确的中文标题（不超过 30 字）',
    '- "summary_zh": 对原文内容的总结（不超过 80 字，说清发生了什么，不要只复述标题）',
    '- "learn": 读者可以从中学到什么（不超过 50 字，知识点/方法/趋势）',
    '- "impact": 这件事的影响（不超过 40 字，对行业/技术/用户）',
    '- "advice": 给读者的行动建议（不超过 40 字，具体可执行）',
    `- "category": 从以下分类中任选一个：${CATEGORIES.join("、")}`,
    '- "tags": 2-4 个标签（公司/模型/技术名词，尽量用原文专有名词）',
    "只返回 JSON，不要输出其他内容。",
    "",
    JSON.stringify(payload),
  ].join("\n");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  // 容错解析：模型偶尔会在 JSON 外包 markdown 代码块或夹带前后缀文字
  const parsed = extractJson(content);
  if (!parsed) throw new Error("无法从 LLM 输出解析 JSON（输出非 JSON）");
  const arr = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  const byIdx = new Map(arr.map((x) => [x.idx, x]));
  return batch.map((_, i) => byIdx.get(i) ?? null);
}

async function summarizeAll(items) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log("[info] 未设置 DEEPSEEK_API_KEY，跳过 LLM 摘要（降级模式）。");
    return items.map((it) => ({
      ...it,
      title_zh: "",
      summary_zh: it._description.slice(0, 80),
      why_it_matters: "",
      tags: [],
      summarized: false,
    }));
  }
  console.log(`[info] 使用 DeepSeek 生成摘要，共 ${items.length} 条…`);
  const out = [];
  for (let i = 0; i < items.length; i += DEEPSEEK_BATCH) {
    const batch = items.slice(i, i + DEEPSEEK_BATCH);
    let results = null;
    const batchNo = i / DEEPSEEK_BATCH + 1;
    try {
      results = await summarizeBatch(apiKey, batch);
    } catch (err) {
      console.warn(`[warn] DeepSeek 批次 ${batchNo} 失败: ${err.message}，2s 后重试 1 次…`);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        results = await summarizeBatch(apiKey, batch);
        console.log(`[ok] DeepSeek 批次 ${batchNo} 重试成功`);
      } catch (retryErr) {
        console.warn(`[warn] DeepSeek 批次 ${batchNo} 重试仍失败，该批次降级: ${retryErr.message}`);
      }
    }
    batch.forEach((it, j) => {
      const r = results?.[j];
      if (r && r.title_zh) {
        out.push({
          ...it,
          title_zh: String(r.title_zh ?? ""),
          summary_zh: String(r.summary_zh ?? ""),
          learn: String(r.learn ?? ""),
          impact: String(r.impact ?? ""),
          advice: String(r.advice ?? ""),
          category: CATEGORIES.includes(r.category) ? r.category : it.category,
          tags: Array.isArray(r.tags) ? r.tags.map(String).slice(0, 5) : [],
          summarized: true,
        });
      } else {
        out.push({
          ...it,
          title_zh: "",
          summary_zh: it._description.slice(0, 80),
          why_it_matters: "",
          tags: [],
          summarized: false,
        });
      }
    });
  }
  return out;
}

/* ------------------------------ 落盘 ------------------------------ */

function loadExisting(date) {
  const file = path.join(NEWS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function writeDaily(date, items) {
  fs.mkdirSync(NEWS_DIR, { recursive: true });
  const file = path.join(NEWS_DIR, `${date}.json`);
  const daily = {
    date,
    generated_at: new Date().toISOString(),
    items,
  };
  fs.writeFileSync(file, JSON.stringify(daily, null, 2) + "\n", "utf-8");
  console.log(`[ok] 写入 ${path.relative(ROOT, file)}（${items.length} 条）`);
}

function updateIndex() {
  const dates = fs
    .readdirSync(NEWS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
  fs.writeFileSync(
    INDEX_FILE,
    JSON.stringify({ updated_at: new Date().toISOString(), dates }, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[ok] 更新 data/index.json（${dates.length} 天）`);
}

/* ------------------------------ 主流程 ------------------------------ */

async function main() {
  const date = todayCN();
  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);
  console.log(`[info] 抓取窗口：近 ${WINDOW_HOURS} 小时；日报日期 ${date}（北京时间）`);

  const raw = await fetchAllSources(since);
  console.log(`[info] 各源合计 ${raw.length} 条（去重前）`);

  if (raw.okCount === 0) {
    // 全源失败（断网/被墙等）：不落盘、不更新心跳，heartbeat 将按 26h 阈值告警
    console.warn(
      `[warn] 全部 ${SOURCES.length} 个源均抓取失败：跳过日报写入，且不更新 last-success（heartbeat 将按 26h 阈值告警）`,
    );
    return;
  }

  let picked = pickTop(raw);
  console.log(`[info] 去重/限额后 ${picked.length} 条`);

  // 同一事件的跨源报道合并为一个 storyline（保留最高权重条目，其余进 relatedSources）
  picked = mergeStorylines(picked);

  // 与当日已有数据合并：新条目若 URL 已存在则丢弃（保留已有摘要）
  const existing = loadExisting(date);
  const existingUrls = new Set(
    (existing?.items ?? []).map((it) => normalizeUrl(it.url)),
  );
  const newItems = picked.filter((it) => !existingUrls.has(normalizeUrl(it.url)));
  console.log(`[info] 当日已有 ${existingUrls.size} 条，本次新增 ${newItems.length} 条`);

  // 跨天复用：近 REUSE_DAYS 天已总结过的条目直接继承摘要（省 LLM 调用、避免搜索/标签重复）
  const summaryCache = new Map(); // url -> 最近一天的已总结条目
  for (let i = 1; i <= REUSE_DAYS; i++) {
    const prev = loadExisting(cnDay(Date.now() - i * 86400e3));
    if (!prev) continue;
    for (const it of prev.items) {
      if (it.summarized && (it.title_zh || it.summary_zh)) {
        const key = normalizeUrl(it.url);
        if (!summaryCache.has(key)) summaryCache.set(key, it); // 只保留最近一天
      }
    }
  }
  const freshItems = [];
  const reusedItems = [];
  for (const it of newItems) {
    const old = summaryCache.get(normalizeUrl(it.url));
    if (!old) {
      freshItems.push(it);
      continue;
    }
    reusedItems.push({
      ...it, // 保留本次抓取的 url/source/relatedSources/heat 等
      title_zh: old.title_zh ?? "",
      summary_zh: old.summary_zh ?? "",
      learn: old.learn ?? "",
      impact: old.impact ?? "",
      advice: old.advice ?? "",
      category: old.category ?? it.category,
      tags: old.tags ?? [],
      trends: old.trends,
      method: old.method,
      result: old.result,
      limitation: old.limitation,
      summarized: true,
      added_at: old.added_at, // 保留原收录时间，避免被标为"今日新增"
    });
  }
  console.log(`[info] 跨天复用摘要 ${reusedItems.length} 条，需新摘要 ${freshItems.length} 条`);

  const summarized = await summarizeAll(freshItems);
  // 新收录条目标 added_at（收录时间），前端据此标注"今日新增"批次；已有条目保留原值
  const addedAt = new Date().toISOString();
  for (const it of summarized) {
    if (!it.added_at) it.added_at = addedAt;
  }
  // 清理内部字段
  const clean = (it) => {
    const rest = { ...it };
    delete rest._weight;
    delete rest._description;
    return rest;
  };
  const merged = [
    ...(existing?.items ?? []),
    ...reusedItems.map(clean),
    ...summarized.map(clean),
  ];
  // 兜底：当天一条都没有且没有历史文件时，仍然写一个空日报，保证前端有数据可读
  writeDaily(date, merged);
  updateIndex();

  // 记录本次成功时间，供 scripts/heartbeat.mjs 判断断更
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    LAST_SUCCESS_FILE,
    JSON.stringify({ ts: new Date().toISOString() }, null, 2) + "\n",
    "utf-8",
  );
  console.log("[ok] 写入 data/state/last-success.json");

  const aiSummarized = summarized.filter((s) => s.summarized).length;
  console.log(
    `[done] 完成：当日共 ${merged.length} 条，其中跨天复用 ${reusedItems.length} 条、本次 AI 摘要 ${aiSummarized} 条。`,
  );
}

// 仅直接运行时执行主流程；被 import 时（如测试）只导出函数
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error("[fatal]", err);
    process.exitCode = 1;
  });
}

export { mergeStorylines, titleTokens, jaccard };
