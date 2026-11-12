# ai-news 项目技术总览（交接 / 分析用）

> 生成时间：2026-11-06 15:15（Asia/Shanghai）
> 仓库：https://github.com/lhdbot/ai-news （main，最新提交见 git log）
> 本地站点：http://localhost:3000 （生产模式 `next start`）
> 2026-11-12 更新：v0.5.0 增加信源缓存兜底、/api/health 与 npm run doctor。
> 2026-11-10 更新：已落地 P0 可靠性改造——锁自愈、任务状态 + /health、摘要失败队列 + zod Schema、
> 每日精选 digest（30 条）、全局 URL 索引、RSS 跨天去重；测试 43 个。
> 重要前提：**运行数据只保存在本地**，`data/news/`、`data/forecasts/`、`data/impact/`、`data/state/` 均被 .gitignore 忽略，远程仓库只有代码与配置。

---

## 0. 一句话定位

一个**单机运行的个性化 AI 情报系统**：每 30 分钟抓取 34 个中英文 AI 信源，用本机 Kimi CLI 生成中文标题/摘要/影响/建议，聚合成每日日报，并生成三日/七日预测、个人影响分析、趋势雷达，通过 Next.js 站点、只读 JSON API、RSS 和微信推送消费。

---

## 1. 技术栈

| 层 | 选型 |
|---|---|
| Web 框架 | Next.js 16.2.12（App Router + Turbopack） |
| UI | React 19.2.4、Tailwind CSS 4、自定义深色主题（`app/globals.css`，约 800 行） |
| 语言 | TypeScript 5（strict） |
| 校验 | zod 4 |
| Markdown | marked 18 + 白名单消毒（`lib/markdown.ts`） |
| 抓取 | Node 原生 fetch + `@extractus/feed-extractor` + curl 代理兜底 |
| LLM | 本机 Kimi CLI（`kimi -p`，零 API 费用）；可选 DeepSeek API 兜底 |
| 存储 | 文件系统 JSON / Markdown（无数据库） |
| 自动化 | Windows 计划任务 + .bat + Node 脚本 |
| 推送 | hermes agent（`hermes send --to weixin`） |
| 运行时 | Node v24.17（要求 >=22） |

---

## 2. 目录结构（关键部分）

```
app/                         Next.js App Router
  page.tsx                   首页（force-dynamic）
  archive/                   归档列表 + [date] 详情
  category/[slug]/           7 个板块页（英文 slug）
  tag/[tag]/                 标签页（30 条/页分页）
  trends/                    趋势雷达
  forecast/                  预测（三日/周报 + 应验度）
  impact/                    影响分析（三日/七天）
  search/                    服务端搜索（?q=）
  skills/                    Skills 推荐（静态）
  feed.xml/route.ts          RSS
  sitemap.ts / robots.ts     SEO（sitemap 动态）
  api/                       只读 JSON API
components/                  Header/Footer/NewsCard/HeroCard/CategorySection/SignalPanel/TopPicks...
lib/                         服务端数据层（news/sources/forecasts/impact/trends/relevance/markdown/api/site）
scripts/                     抓取、摘要、预测、影响、雷达、推送、锁、心跳
  lib/                       kimi / hermes / notify / prompt-budget / fs-atomic / categories
data/                        运行数据（仅本地）
  news/YYYY-MM-DD.json       每日日报（累积式）
  forecasts/{daily,weekly}/  预测 md + index.json
  impact/{daily,weekly}/     影响分析 md + index.json
  trends/taxonomy.json       趋势主题树（16 节点）
  trends/radar.json          雷达快照
  state/                     源健康、心跳、DeepSeek 官网去重状态
  sources.json / profile.example.* / tag-aliases.json / skills.json
logs/                        update.log / server.log（本地）
.github/workflows/           ci.yml（test+lint+build）、daily-update.yml（仅手动）
```

---

## 3. 总体架构

```
Windows 计划任务
├─ ai-news-watch            每 30 分钟
├─ ai-news-daily            每天 07:10
├─ ai-news-daily-forecast   每天 10:00
└─ ai-news-weekly-forecast  每周一 08:00
        │
        ▼  scripts/wait-lock.mjs（logs/job.lock 互斥，2h 自愈，排队 2.5min 间隔）
┌────────────────────────────── 抓取层 ──────────────────────────────┐
│ fetch-news.mjs：34 源并发抓取（RSS/Atom、HF JSON、HN、Trending、官网）│
│   → 48h 窗口 → URL 归一化去重 → 权重排序 → 分类配额/最小配额          │
│   → top 30 → 跨源事件合并 → 与当日已有合并 → 跨天复用摘要             │
└────────────────────────────────────────────────────────────────────┘
        │ 无 DEEPSEEK_API_KEY 时只聚合，不摘要
        ▼
summarize-local.mjs：Kimi CLI 批量补中文摘要/分类/标签/trends（10 条/批）
        │
        ├─ build-radar.mjs      近 14 天 trends → radar.json
        ├─ export-markdown.mjs  当日 JSON → Markdown
        └─ daily-impact.mjs     近 3 天新闻 + profile → 影响分析 md
        ▼
data/*.json / *.md  ← 原子写（tmp + rename）
        ▼
Next.js 页面（force-dynamic，请求时读文件） + /api/* + RSS + 微信推送
```

---

## 4. 数据模型

### 4.1 新闻条目（`data/news/YYYY-MM-DD.json`）

```json
{ "date": "2026-11-06", "generated_at": "ISO", "items": [ ... ] }
```

| 字段 | 含义 |
|---|---|
| `id` | URL 归一化后的 sha1 前 12 位 |
| `title` / `title_zh` | 原文标题 / 中文标题 |
| `summary_zh` | 中文摘要（60 字内） |
| `learn` / `impact` / `advice` | 学到什么 / 影响 / 建议 |
| `why_it_matters` | 预留字段（当前基本为空） |
| `url` / `source` / `published_at` | 原文 / 来源名 / 发布时间 |
| `category` | 7 分类之一：模型发布/论文研究/行业动态/工具产品/芯片算力/具身智能/人物经验 |
| `tags` | 2–4 个标签（经 `tag-aliases.json` 归一化） |
| `trends` | taxonomy 节点 id（1–3 个） |
| `heat` | 事件热度：主源权重 + 2×(合并源数−1) |
| `relatedSources` | 同一事件的其它来源 `[{source,url}]` |
| `method` / `result` / `limitation` | 论文三件套（仅论文条目） |
| `summarized` | 是否已完成 LLM 摘要 |
| `added_at` | 收录批次时间（用于「今日新增」徽标） |

### 4.2 其它数据

- `data/forecasts/{daily,weekly}/YYYY-MM-DD.md`：Kimi 生成的预测报告（Markdown），+ `index.json`。
- `data/impact/{daily,weekly}/YYYY-MM-DD.md`：影响分析，+ `index.json`。
- `data/forecasts/review/`：预测应验度复盘（当前 0 篇）。
- `data/trends/taxonomy.json`：16 个趋势节点（agent、coding-agent、mcp、rag 相关、inference-infra、robotics…），字段 id/name/parent/stage/focus/keywords。
- `data/trends/radar.json`：节点热度/近 14 天条数/近 3 天增速/topItems。
- `data/state/source-health.json`：每源 lastOk/lastFail/连续失败天数。
- `data/state/last-success.json`：最近一次成功抓取时间（心跳用）。
- `.local/profile.md` / `.local/profile.json`：个人技术栈、关键词、目标、关注趋势（用于个性化打分和报告）。示例在 `data/profile.example.*`；`.local/` 不入库。

---

## 5. 抓取与筛选算法（`scripts/fetch-news.mjs`）

| 常量 | 值 | 说明 |
|---|---|---|
| `WINDOW_HOURS` | 48 | 全局抓取窗口；源可用 `windowHours` 覆盖（人物博客 720h） |
| `PER_SOURCE_CAP` | 8 | 单源单次最多入选 |
| `TOP_N` | 30 | 单次抓取选出的条数上限 |
| `CATEGORY_CAPS` | 论文 12、工具 12 | 防止高权重源挤占（40%） |
| `CATEGORY_MINIMUMS` | 论文 3、模型 2、芯片 2、具身 2、行业 6、人物 3 | 保证七个板块有内容 |
| `TRENDING_MINIMUM` | 3 | 至少保留 3 个 GitHub 热榜 |
| 事件合并阈值 | Jaccard ≥ 0.6 | 中文 bigram + 英文词级，跨源并查集合并 |

**选择顺序**：GitHub 热榜保底 3 → 各分类最小配额 → 按「源权重 desc，发布时间 desc」补满 30。
**去重**：URL 去协议追踪参数/hash/尾斜杠后作为 key；同一 URL 不重复。
**跨天复用**：近 3 天已摘要条目按 URL 继承摘要，保留原 `added_at`，避免重复调用 LLM。
**当日合并**：已有条目 + 本次新增（仅追加，不重排、不裁剪）→ 因此**日文件会持续增长**（今天 101 条）。
**失败处理**：单源失败仅告警；全部失败则不写日报、不更新心跳。
**代理兜底**：直连 15s → curl + 本地代理（默认 127.0.0.1:7897）30s；代理请求限 3 并发；HF/HN 等 JSON 源同样走该兜底。
**源过滤**：Trending 页面解析 + AI 关键词过滤；HN 仅取 front_page、≥20 points、AI 相关。

---

## 6. LLM 生成链路

### 6.1 摘要（`scripts/summarize-local.mjs`）
- 输入：当日 `summarized=false` 的条目，10 条/批。
- 模型：本机 Kimi CLI `kimi -p`；重试 2 次；单次 10 分钟超时；失败且配置 `DEEPSEEK_API_KEY` 时用 DeepSeek 兜底。
- 输出字段：title_zh / summary_zh / learn / impact / advice / category / tags / trends；论文条目额外 method/result/limitation。
- 约束：category 必须是 7 类之一；trends 必须是 taxonomy 合法 id；标签按别名表归一化；**专用来源分类锁定**（arXiv/HF Papers/微软研究院 → 论文研究；宇树/智元 → 具身智能）。
- 写入：每批完成即原子写盘，中断不丢已生成内容。
- 支持 `--date=YYYY-MM-DD` 补历史、`--force=N`、`--all`。

### 6.2 预测与影响
- `weekly-forecast.mjs --days=3|7`：近 N 天新闻 + `.local/profile.md` → Markdown 预测；上限 120 条素材。
- `daily-impact.mjs --days=3|7`：近 N 天新闻 + 画像 → 影响分析；上限 80 条；当天文件存在则跳过。
- 两者都使用 `prompt-budget`：超过 26K 字符先丢 summary、再按比例裁条目，规避 Windows 32K 命令行上限（`spawn ENAMETOOLONG`）。
- 输出经 `extractMarkdown` 截取正文，原子写 md + index.json。

### 6.3 趋势雷达（`scripts/build-radar.mjs`）
纯计算：近 14 天条目的 `trends` 命中数 → 基础热度分档（1–5）；近 3 天较前 3 天翻倍以上 +1；每节点取 top 3 条目。

---

## 7. 内容体系

### 7.1 信源（`data/sources.json`，34 个）

| 分组 | 代表源 |
|---|---|
| 论文/研究 | arXiv cs.AI / cs.CL / cs.LG、Hugging Face Daily Papers、Microsoft Research |
| 大厂官方 | OpenAI、Google DeepMind、Google AI Blog、Anthropic（RSSHub 镜像）、Hugging Face Blog |
| 芯片算力 | NVIDIA Developer Blog、NVIDIA Newsroom |
| 具身智能 | 宇树 Unitree SDK commits、智元 AgibotTech commits |
| 开源/发布 | GitHub Trending 日/周/月榜、llama.cpp、vLLM、Ollama Releases、DeepSeek V3/R1/Harness |
| 媒体 | 量子位、TechCrunch AI、The Verge AI、MIT Technology Review、The Decoder、Interconnects、HN 热帖 |
| 人物经验 | Simon Willison、Latent Space、Ethan Mollick |
| 官网 | DeepSeek 官网新闻（无 RSS，HTML 抓取 + slug 去重） |

### 7.2 分类与内容配比（历史累计，2942 条）
论文 973（33%）、行业 842（29%）、工具 721（24%）、模型 161（5%）、芯片 151（5%）、具身 79（3%）、人物 15（0.5%）。

### 7.3 内容加工
每条内容尽量提供「中文标题 + 总结 + 学到什么 + 影响 + 建议」五段式；论文额外方法/结果/局限；首页头条为四栏拆解（背景/学到/影响/建议）。

### 7.4 个性化与信号
- 相关度打分（`lib/relevance.ts`）：`heat` 基础分 + 技术栈命中×4 + 关键词命中×2 + 关注趋势命中×3；映射 1–5 星。
- 首页「今日与你最相关 TOP 5」按分数排序。
- 信号面板：`条数×2 + 多源事件×5 + 平均热度×3`（截断 100），附分类柱状图与雷达动画。

---

## 8. Web 层

| 路由 | 说明 | 渲染 |
|---|---|---|
| `/` | 首页：状态条、信号面板、TOP5、头条、7 分类预览 | force-dynamic |
| `/archive`、`/archive/[date]` | 历史归档 / 单日全量 | force-dynamic |
| `/category/[slug]` | 7 个板块（models/papers/industry/tools/chips/embodied/people） | force-dynamic |
| `/tag/[tag]` | 标签聚合，30 条/页 | force-dynamic |
| `/trends` | 雷达表 + 主题树 | force-dynamic |
| `/forecast` | 三日/周预测 + 应验度，`?d=/?w=/?r=` | 动态 |
| `/impact` | 三日/七天影响分析，`?d=/?w=` | 动态 |
| `/search` | 服务端检索，`?q=`，最多 50 条 | force-dynamic |
| `/skills` | 静态推荐页 | 静态 |
| `/feed.xml` | 近 7 天 RSS（有跨天重复） | 动态 |
| `/sitemap.xml`、`/robots.txt` | SEO | sitemap 动态 |

**设计**：深色「情报指挥舱」风格，7 分类主题色，状态条/脉冲点/雷达动画；卡片密集信息流。
**可访问性**：首页隐藏 h1、表单 label、focus-visible、aria-current；`text-faint` 对比度已提到约 4.7:1。
**SEO**：metadata、动态 sitemap、RSS；暂无 canonical 与 OG image。

### 只读 API
| 接口 | 返回 |
|---|---|
| `GET /api/news/latest` | 最新日报（DailyNews） |
| `GET /api/news/YYYY-MM-DD` | 指定日期日报；非法日期 400，无数据 404 |
| `GET /api/intelligence/latest?kind=daily|weekly` | `{kind, forecast, impact}` |
| `GET /api/intelligence/YYYY-MM-DD?kind=...` | 指定日期；同上 |

所有接口 `Cache-Control: no-store`，错误结构 `{error:{code,message}}`。

---

## 9. 自动化与运维

- **计划任务**：watch 每 30 分钟；daily 07:10；daily-forecast 10:00；weekly 周一 08:00。
- **bat 规范**：必须 CRLF + ASCII 注释（UTF-8/LF 会被 cmd 按 GBK 解析并吞行，曾导致巡检停摆 3 个月）。
- **互斥**：`logs/job.lock`，2 小时视为异常锁自动清理；wait 模式排队 45 分钟。
- **心跳**：`last-success.json` 超过 26h → 告警 + exit 1。
- **源健康**：连续失败 ≥3 天告警（经 hermes 推微信）。
- **数据变化检测**：`data-changed.mjs` 指纹（条数 + id 列表 + 已摘要数 + 报告文件大小）。
- **站点保活**：watch 末尾 `netstat` 检查 3000，未监听则 `npm start`。
- **日志**：`logs/update.log`（脚本）、`logs/server.log`（Next）。
- **推送**：报告生成后 `push-wechat.mjs` → hermes；失败不阻断主流程。
- **环境变量**：`DEEPSEEK_API_KEY`（可选）、`AI_NEWS_PROXY`（默认 http://127.0.0.1:7897）、`AI_NEWS_HERMES`、`AI_NEWS_WECHAT_TARGET`、`NEXT_PUBLIC_SITE_URL`。

---

## 10. 当前运行指标（2026-11-06 15:15）

| 指标 | 数值 |
|---|---|
| 日报天数 | 78（2026-07-29 → 2026-11-06） |
| 累计条目 | 2942 |
| 已摘要 | 2806（95.4%） |
| 唯一 URL | 2010；跨天重复 URL 708 |
| 今日（11-06）条目 | 101（工具 37 / 行业 28 / 论文 13 / 模型 11 / 芯片 7 / 人物 4 / 具身 1） |
| 分类累计 | 论文 973、行业 842、工具 721、模型 161、芯片 151、具身 79、人物 15 |
| 三日预测 | 75 篇（最新 11-06） |
| 周报预测 | 4 篇（最新 09-28） |
| 三日影响 | 19 篇（最新 11-06） |
| 七天影响 | 11 篇（最新 10-26） |
| 应验度复盘 | 0 篇 |
| 雷达 | 16 节点，生成于 11-06 07:09 UTC |
| 最近成功抓取 | 2026-11-06 07:08:52 UTC（15:08 北京） |
| 站点 | 200，首页约 119KB |
| 代理失败源 | 每轮 9–15 个（arXiv/HF/Trending/部分媒体，网络波动） |

---

## 11. 已知问题与技术债（按优先级）

1. **代理是单点且不稳定**：本地 7897 代理延迟 10s+，每轮仍有 9–15 个源失败；GitHub Trending 3 个源基本每轮超时；arXiv/HF 时好时坏。抓取成功率高度依赖代理状态。
2. **当日文件无上限**：每 30 分钟追加，今天已 101 条；「日报 Top 30」只约束单次抓取，日累计后首页/归档/搜索体积持续变大。
3. **跨天重复**：708 个 URL 在多日重复出现（48h 窗口导致），RSS 未做跨天去重。
4. **摘要缺口**：136 条（4.6%）无中文摘要；失败批次只在当天重试，跨天不补。
5. **周报/复盘缺失**：周报只有 4 期（最近 09-28），应验度复盘 0 期；周一任务曾返回 `0x80070020`。
6. **板块内容极不均衡**：具身 79 条（2.7%）、人物 15 条（0.5%）；「具身智能」常见 0–1 条。
7. **全站 `force-dynamic` + 文件系统**：每次请求读文件（有 mtime 缓存），无数据库/缓存层；数据量继续增长后搜索/标签/归档会变慢。
8. **个性化依赖静态画像**：`.local/profile.md/json` 需手改；打分逻辑简单（关键词加权），无行为反馈。
9. **隐私（已处理）**：画像已于 2026-11-10 移出仓库并清理历史；本地文件只在 `.local/`，不要再提交。
10. **无 canonical / OG image**；搜索为表单提交（非即时）。
11. **Windows 单机依赖**：关机/断网/代理挂即断更；无云端兜底（daily-update 仅手动）。
12. **日志编码混杂**：cmd 默认 GBK 写 UTF-8 输出，`update.log` 可读性差。
13. **偶发遗留进程**：Kimi CLI 超时后可能留下孤儿进程；`next dev` 与 `next start` 曾同时占用 3000（已处理）。
14. **分类仍会漂移**：选择期有配额、摘要期锁专用来源，但日累计后工具类仍可能超过 40%。
15. **事件合并只在单次抓取的 30 条内**，不跨已存条目；同一事件的不同 URL 仍可能在后续轮次重复进入。

---

## 12. 建议其他 agent 重点分析的问题

**数据质量**
- 如何量化摘要质量（准确性/信息密度/一致性）？是否该做抽检或 LLM-as-judge？
- 跨天重复 708 条应如何在日文件层去重，而不破坏「实时新增」体验？
- 分类体系是否需要合并/拆分（具身、人物长期缺内容）？

**算法**
- `pickTop` 的权重/配额/最小配额是否合理？是否该改成排序学习或多目标优化？
- 事件合并阈值 0.6 的误合并/漏合并率如何评估？
- 雷达热度（条数分档 + 增长加成）是否能反映真实趋势？是否该引入时间衰减/来源权重？

**架构**
- 文件系统 + force-dynamic 的扩展上限在哪？何时该迁移到 SQLite/Postgres 或 ISR？
- 当日无限追加是否该改成「每次快照 + 合并视图」？
- 全站动态渲染的 TTFB（100–500ms）是否可接受？

**产品**
- 101 条/天是否过载？日报、实时流、周报三种节奏如何分工？
- 个性化 TOP5 是否真的有效？如何验证？
- 微信推送的时机与内容取舍（全文 vs 摘要）？

**运维/安全**
- 代理单点如何降级（多代理、缓存、直连白名单）？
- 计划任务失败如何做到可观测（心跳已有，但源级/任务级告警不足）？
- 公开仓库中的个人画像、无鉴权 API、markdown 消毒是否足够？

---

## 13. 常用命令

```bash
npm install
node scripts/fetch-news.mjs            # 抓取（不摘要）
node scripts/summarize-local.mjs       # 补当日未摘要
node scripts/summarize-local.mjs --date=2026-11-02
node scripts/build-radar.mjs
node scripts/daily-impact.mjs --days=3
node scripts/weekly-forecast.mjs --days=7
node scripts/normalize-categories.mjs  # 纠正专用来源分类
node scripts/push-wechat.mjs [--weekly|--test]
npm test && npm run lint && npm run build
npm start -- -p 3000
```

计划任务对应：`scripts/watch-update.bat`、`local-update.bat`、`daily-forecast.bat`、`weekly-forecast.bat`。

---

## 14. 版本与提交

- 当前分支：`main`（已推送 origin）。2026-11-10 重写历史以移除个人画像，旧哈希已失效。
- 近期提交请用 `git log --oneline` 查看（历史重写后哈希已变化）。
- 工作区仅剩未跟踪的个人文件 `百度网盘上传清单.md`。