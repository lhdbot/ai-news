# AI 日报（ai-news）

每天自动聚合全球优质 AI 资讯的中文网站：arXiv 论文（cs.AI / cs.CL / cs.LG）、OpenAI、Google DeepMind、Microsoft Research、Hugging Face Daily Papers、GitHub Trending 日/周/月榜 AI Top 8、Hacker News 热帖，以及量子位、TechCrunch、The Verge、MIT Technology Review 等中英文媒体；另设「人物经验」板块收录 Simon Willison、Latent Space、Ethan Mollick 等人的 AI 实战与使用经验。每条新闻提供**中文标题、原文总结、学到什么、影响、对你的建议**四个部分，不只是链接搬运。

## 工作原理（本机模式，当前默认）

```
Windows 计划任务 ai-news-watch（每 30 分钟巡检，有更新才走全流程）
  → scripts/watch-update.bat
    → node scripts/fetch-news.mjs   抓取 34 个内容源（RSS / JSON API / GitHub Trending）
    → node scripts/summarize-local.mjs  只对"新条目"调用本机 Kimi CLI 摘要（无更新时零 LLM 消耗）
    → node scripts/daily-impact.mjs --days=3  三日市场影响分析（当天已生成则跳过；每条结论标注依据出处）
    → 有变化才更新数据文件；页面为动态渲染（force-dynamic），下次访问即见新内容，
      无需整站重建/重启服务（只有改代码时才需要手动 npm run build + 重启）
    （变化检测用 scripts/data-changed.mjs 数据指纹；数据只保存在本地，不再 git 提交，代码提交手动进行）
另有 ai-news-daily（每天 07:10 全量刷新）、ai-news-daily-forecast（每天 10:00 三日滚动预测
     + 三日影响分析 + 微信推送）、ai-news-weekly-forecast（每周一 08:00 七天周报预测 + 七天影响分析
     + 预测应验度复盘 + 微信推送）
任务互斥: 所有任务经 scripts/wait-lock.mjs 共用 logs/job.lock —— 撞车时串行排队，
         前一个完成后等 2.5 分钟再执行下一个，排队/自愈过程在日志中写 [提示]；
         锁超过 2 小时视为异常遗留，自动清理
微信推送: 报告生成后由 scripts/push-wechat.mjs 经 hermes agent 管道（hermes send --to weixin）
         把全文推送到个人微信；需先完成 hermes 的 Weixin 扫码配置（见脚本头注释）
网站服务: 登录 Windows 后由启动文件夹脚本 scripts/start-site.bat 自动拉起，
         访问 http://localhost:3000
日志: logs/update.log、logs/server.log
```

云端兜底（GitHub Actions）：`.github/workflows/daily-update.yml` 每天 UTC 23:00（北京时间 07:00）
定时跑一轮 `fetch-news.mjs`（使用仓库 secret `DEEPSEEK_API_KEY`），并保留手动触发；
本机断更时云端仍可产出当日数据。

## 内容来源（34 个）

**论文 / 研究**
| 来源 | 地址 | 说明 |
|---|---|---|
| arXiv cs.AI | https://rss.arxiv.org/rss/cs.AI | 人工智能论文，工作日每日更新 |
| arXiv cs.CL | https://rss.arxiv.org/rss/cs.CL | 计算与语言（NLP）论文 |
| arXiv cs.LG | https://rss.arxiv.org/rss/cs.LG | 机器学习论文 |
| Microsoft Research | https://www.microsoft.com/en-us/research/feed/ | 微软研究院博客 |
| Hugging Face Daily Papers | https://huggingface.co/papers | 每日热榜论文（JSON API） |

**大厂官方**
| 来源 | 地址 | 说明 |
|---|---|---|
| OpenAI Blog | https://openai.com/news/rss.xml | OpenAI 官方动态 |
| Google DeepMind | https://deepmind.google/blog/rss.xml | DeepMind 官方博客 |
| Google AI Blog | https://blog.google/technology/ai/rss/ | Google AI 官方产品与研究动态 |
| Anthropic News（镜像） | https://rsshub.bestblogs.dev/anthropic/news | Anthropic 官方新闻（RSSHub 镜像） |
| Hugging Face Blog | https://huggingface.co/blog/feed.xml | Hugging Face 官方博客（工具/产品向） |

**芯片算力**
| 来源 | 地址 | 说明 |
|---|---|---|
| NVIDIA Developer Blog | https://developer.nvidia.com/blog/feed | NVIDIA 开发者技术博客（Atom） |
| NVIDIA Newsroom | https://nvidianews.nvidia.com/rss.xml | NVIDIA 官方新闻稿 |

**具身智能**
| 来源 | 地址 | 说明 |
|---|---|---|
| 宇树 Unitree SDK | https://github.com/unitreerobotics/unitree_sdk2/commits/main.atom | 宇树 SDK main 分支提交动态 |
| 智元机器人 AgibotTech | https://github.com/AgibotTech/Agibot_D1_Max/commits/main.atom | 智元 AgibotTech 最近活跃仓库提交动态 |

**开源热榜与发布**
| 来源 | 地址 | 说明 |
|---|---|---|
| GitHub Trending 日榜 | https://github.com/trending?since=daily | 当日 AI 相关 Top 8 仓库 |
| GitHub Trending 周榜 | https://github.com/trending?since=weekly | 本周 AI 相关 Top 8 仓库 |
| GitHub Trending 月榜 | https://github.com/trending?since=monthly | 本月 AI 相关 Top 8 仓库 |
| llama.cpp Releases | https://github.com/ggml-org/llama.cpp/releases.atom | 本地推理引擎官方发布 |
| vLLM Releases | https://github.com/vllm-project/vllm/releases.atom | 高吞吐推理框架官方发布 |
| Ollama Releases | https://github.com/ollama/ollama/releases.atom | 本地模型运行工具官方发布 |

**媒体**
| 来源 | 地址 | 说明 |
|---|---|---|
| 量子位 | https://www.qbitai.com/feed | 中文 AI 媒体，每日多篇 |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | 英文科技媒体 AI 频道 |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml | 英文科技媒体 AI 频道（Atom） |
| MIT Technology Review AI | https://www.technologyreview.com/topic/artificial-intelligence/feed/ | MIT 科技评论 AI 频道 |
| Hacker News AI 热帖 | https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50 | 分钟级首页热帖，AI 过滤且至少 20 points |
| The Decoder | https://the-decoder.com/feed/ | 日更 AI 新闻媒体 |
| Interconnects | https://www.interconnects.ai/feed | 前沿模型与行业深度分析 |

**人物经验**
| 来源 | 地址 | 说明 |
|---|---|---|
| Simon Willison | https://simonwillison.net/atom/everything/ | AI 工具链与实战技巧 |
| Latent Space | https://www.latent.space/feed | AI 工程师与前沿模型实践 |
| Ethan Mollick | https://www.oneusefulthing.org/feed | AI 在工作与教学中的使用方法 |

## 本地开发

```bash
npm install
node scripts/fetch-news.mjs   # 抓取新闻，生成 data/news/ 下的日报数据
npm run dev                   # http://localhost:3000
```

其他命令：`npm run build`（生产构建）、`npm run lint`、`npm test`。
补某天未完成的摘要：`node scripts/summarize-local.mjs --date=2026-11-02`。

> **Windows 计划任务注意**：`.bat` 必须保持 CRLF 换行、注释只用 ASCII。
> UTF-8 + LF + 中文注释会被 cmd 按 GBK 解析并吞掉下一行（曾导致 30 分钟巡检从 2026-08-15 起静默失效）。

## 只读 JSON API

本站保留原有计划任务，其他本地工具可通过以下接口读取数据，无需重复抓取：

| 接口 | 说明 |
|---|---|
| `GET /api/news/latest` | 最新日报 |
| `GET /api/news/YYYY-MM-DD` | 指定日期日报 |
| `GET /api/intelligence/latest?kind=daily` | 最新三日预测与影响分析 |
| `GET /api/intelligence/YYYY-MM-DD?kind=weekly` | 指定日期的七天预测与影响分析 |

`kind` 支持 `daily`（默认）和 `weekly`。情报接口返回 `{ kind, forecast, impact }`。
新闻接口额外支持 `?view=digest` 返回当日精选（最多 30 条），默认 `full` 保持兼容。，报告以 Markdown 文本提供；某一类报告尚未生成时对应字段为 `null`。非法参数返回 400，无数据返回 404，所有接口均禁止缓存。

## 每日精选、摘要重试与运行状态（2026-11 新增）

- **每日精选 digest**：`scripts/build-digest.mjs` 从当日原始日报中选最多 30 条，写入 `data/digests/YYYY-MM-DD.json`；
  规则：当日首次出现优先、七个分类有固定配额、跨天重复只在热度高时补位。首页优先读 digest，归档/分类页仍读全量。
- **全局 URL 索引**：`data/index/urls.json` 记录每个 URL 的首次出现日期，供 digest 与 RSS 去重；
  可用 `node scripts/rebuild-url-index.mjs` 从历史日报重建。
- **跨天事件**：`data/index/events.json` 记录 eventId；7 天窗口内标题 Jaccard ≥0.6 的条目归为同一事件，
  digest 按 eventId 去重，避免同一事件反复出现；可用 `node scripts/rebuild-event-index.mjs` 重建。
- **页面缓存（ISR）**：首页 5 分钟、归档 1 小时、分类 10 分钟、趋势 30 分钟；搜索与 API 保持实时。
- **源级成功率**：`source-health.json` 记录每源累计成功/失败次数与最后错误，`/health` 展示成功率与失败最多的源。
- **内容质量报告**：`quality-report.mjs` 计算摘要完成率、跨天重复率、事件/多源事件、digest 覆盖；写入 `data/quality/`，/health 展示。
- **更新日志**：`/changelog` 页面 + `data/changelog.json`，版本化记录功能、修复与安全变更。
- **摘要失败队列**：`data/state/summary-queue.json`；LLM 输出逐条过 zod Schema，失败单条重试一次，
  仍失败按 5m/30m/2h/24h 退避；`summarize-local.mjs --retry --limit=20` 在每轮巡检中补跑。
  历史缺口可先用 `node scripts/enqueue-missing-summaries.mjs` 一次性入队。
- **任务状态与 /health**：每个 bat 首尾调用 `scripts/job-status.mjs`，状态写入 `data/state/jobs/`，
  事件写入 `logs/app.jsonl`；`/health` 页面展示任务、信源健康、摘要队列与数据新鲜度。
- **锁自愈**：`logs/job.lock` 改为 JSON（job/pid/startedAt），超过 45 分钟或持有进程退出即自动清理。

## 配置摘要引擎

默认使用**本机 Kimi CLI**（`scripts/summarize-local.mjs`，`kimi -p` 非交互调用），零额外成本。

也可改用 [DeepSeek API](https://platform.deepseek.com)（OpenAI 兼容，月开销 <1 元）：设置环境变量 `DEEPSEEK_API_KEY` 后 `fetch-news.mjs` 会优先用它摘要；未配置时只聚合不摘要（`summarized: false`），可再由 `summarize-local.mjs` 补摘要。

## 如何添加新的内容源

编辑 `data/sources.json`，加一项即可（不用动任何代码）：

```json
{
  "name": "来源名称",
  "url": "https://example.com/feed.xml",
  "type": "rss",
  "weight": 8,
  "category": "行业动态",
  "site": "https://example.com"
}
```

- `type`：RSS/Atom 用 `"rss"`；Hugging Face Papers 用 `"hf"`；GitHub Trending 用 `"trending"`；Hacker News 用 `"hn"`
- `weight`：排序权重，官方一手源 10+，媒体 7-8
- `count`：Trending/HN 单源最多返回条数（可选，默认 8）
- `minPoints`：HN 最低热度（可选，默认 20）
- `windowHours`：按源覆盖抓取窗口小时数（可选，默认 48；人物博客等低频源可设 720/2160）
- `category`：无 LLM 摘要时的兜底分类，必须是以下之一：模型发布 / 论文研究 / 行业动态 / 工具产品 / 芯片算力 / 具身智能 / 人物经验
- `site`：来源首页，网站页脚「信息来源」展示链接用（可选，缺省用 `url`）

Trending 会先过滤非 AI 项目，再按榜序取 Top 8；同一次抓取中的跨榜重复仓库按 URL 去重。日报 Top 30 中论文研究最多 40%、工具产品最多 40%，并保留 3 个 GitHub 热榜、6 个行业动态和 3 个人物经验位置，防止高热源挤占其他内容。

保存后无需重启：本地巡检每 30 分钟跑一次 `fetch-news.mjs`，下次抓取自动读新配置；
有新内容时会自动摘要、重新构建，页脚的来源列表也随之更新。

GitHub Trending 源直连失败时会自动回退到 curl + 本地代理（环境变量 `AI_NEWS_PROXY`，默认 `http://127.0.0.1:7897`）。

## 事件合并、源健康告警与心跳

- **事件（storyline）合并**：`fetch-news.mjs` 在筛选 top 30 之后、LLM 摘要之前，把标题分词
  （小写、去标点）两两 Jaccard 相似度 ≥ 0.6 且来自不同源的条目合并为同一事件：
  保留组内权重最高的条目，其余进其 `relatedSources`，并计算 `heat = 主源权重 + 2 × (合并数 - 1)`。
- **源健康**：每次抓取把 `{源名: {lastOk, lastFail, consecutiveFailDays}}` 写入
  `data/state/source-health.json`（连续失败天数按北京时区自然日跨运行累计）；
  某源连续失败 ≥3 天时经 `scripts/lib/notify.mjs` 的 `notify(text)` 发送告警（文件缺失时仅记日志）。
- **心跳**：`node scripts/heartbeat.mjs` 读取 `data/state/last-success.json`，
  距上次成功抓取超过 26 小时则告警并以退出码 1 结束，否则静默退出 0；可挂到巡检/计划任务里做断更监控。
- **DeepSeek 重试**：摘要批次失败后 sleep 2s 重试 1 次，仍失败才降级为不摘要。

## 部署到 Vercel（可选，当前未启用）

1. 把本仓库 push 到 GitHub。
2. 到 [vercel.com](https://vercel.com) 用 GitHub 登录，**Import** 该仓库 —— 零配置，自动识别 Next.js。
3. （可选）在 Vercel 项目环境变量或仓库环境中设置 `NEXT_PUBLIC_SITE_URL` 为你的正式域名，用于 sitemap / RSS / OG 中的绝对链接。
4. 之后每天 Actions 提交 `data/` 更新后，Vercel 会自动重新构建部署。

## 目录结构

```
app/                    # Next.js App Router 页面（首页 / 板块页 /category/[slug] / 影响分析 /impact / 归档 / 标签 / 预测 / Skills / feed.xml / sitemap / robots）
components/             # NewsCard、CategoryNav（左侧快速导航）、CategorySection（首页板块横向预览条）、TagBadge、Header、Footer
lib/news.ts             # 内容层：zod schema + 数据读取 + 板块中英文 slug 映射（CATEGORY_SLUGS）
lib/sources.ts          # 信息源读取（页脚展示用）
lib/site.ts             # 站点名称 / URL 等常量
scripts/fetch-news.mjs  # 抓取脚本（Node 直接运行，无 TS 依赖；源列表读 data/sources.json）
scripts/heartbeat.mjs      # 断更心跳检查（>26h 未成功抓取则告警并 exit 1）
scripts/summarize-local.mjs  # 本机 Kimi CLI 摘要器
scripts/weekly-forecast.mjs  # 预测生成器（--days=3 三日滚动 / --days=7 七天周报）
scripts/daily-impact.mjs     # 影响分析生成器（--days=3 三日 / --days=7 七天，结论标注依据出处）
scripts/push-wechat.mjs      # 微信推送（hermes send 管道，报告全文推到个人微信）
scripts/wait-lock.mjs        # 任务互斥锁（串行排队 + 异常锁自愈）
scripts/local-update.bat     # 本地每日更新入口（计划任务调用）
scripts/daily-forecast.bat   # 每日三日滚动预测（计划任务调用）
scripts/weekly-forecast.bat  # 每周一七天预测（计划任务调用）
scripts/start-site.bat       # 登录后启动网站服务（启动文件夹调用）
data/sources.json        # 信息源配置（抓取脚本 + 页脚展示共用，加源只改这里）
data/digests/            # 每日精选（脚本生成，不入库）
data/index/             # 全局 URL 索引（脚本生成，不入库）
data/state/              # 运行状态（含 jobs/ 任务状态、summary-queue.json）：source-health.json（源健康）、last-success.json（心跳）、deepseek-news.json 等
data/news/YYYY-MM-DD.json  # 每日新闻数据（脚本生成，仅本地保存，不入库）
data/forecasts/{daily,weekly}/YYYY-MM-DD.md  # 三日/每周预测报告（仅本地保存，不入库）
data/impact/{daily,weekly}/YYYY-MM-DD.md     # 三日/七天影响分析（仅本地保存，不入库）
.github/workflows/         # daily-update.yml（云端兜底已停用定时，仅手动触发）、ci.yml（构建验证）
```
