# AI 日报（ai-news）

每天自动聚合全球优质 AI 资讯的中文网站：arXiv 论文（cs.AI / cs.CL / cs.LG）、OpenAI、Google DeepMind、Microsoft Research、Hugging Face Daily Papers、GitHub Trending 日/周/月榜第一名，以及量子位、TechCrunch、The Verge、MIT Technology Review 等中英文媒体。每条新闻提供**中文标题、原文总结、学到什么、影响、对你的建议**四个部分，不只是链接搬运。

## 工作原理（本机模式，当前默认）

```
Windows 计划任务 ai-news-watch（每 30 分钟巡检，有更新才走全流程）
  → scripts/watch-update.bat
    → node scripts/fetch-news.mjs   抓取 24 个内容源（RSS / JSON API / GitHub Trending）
    → node scripts/summarize-local.mjs  只对"新条目"调用本机 Kimi CLI 摘要（无更新时零 LLM 消耗）
    → node scripts/daily-impact.mjs --days=3  三日市场影响分析（当天已生成则跳过；每条结论标注依据出处）
    → 有变化才更新数据文件；页面为动态渲染（force-dynamic），下次访问即见新内容，
      无需整站重建/重启服务（只有改代码时才需要手动 npm run build + 重启）
    （变化检测用 scripts/data-changed.mjs 数据指纹；数据只保存在本地，不再 git 提交，代码提交手动进行）
另有 ai-news-daily（每天 07:10 全量刷新）、ai-news-daily-forecast（每天 10:00 三日滚动预测）、
     ai-news-weekly-forecast（每周一 08:00 七天周报预测 + 七天影响分析）
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

## 内容来源（24 个）

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

**开源热榜**
| 来源 | 地址 | 说明 |
|---|---|---|
| GitHub Trending 日榜 | https://github.com/trending?since=daily | 当日第一名仓库 |
| GitHub Trending 周榜 | https://github.com/trending?since=weekly | 当周第一名仓库 |
| GitHub Trending 月榜 | https://github.com/trending?since=monthly | 当月第一名仓库 |

**媒体**
| 来源 | 地址 | 说明 |
|---|---|---|
| 量子位 | https://www.qbitai.com/feed | 中文 AI 媒体，每日多篇 |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | 英文科技媒体 AI 频道 |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml | 英文科技媒体 AI 频道（Atom） |
| MIT Technology Review AI | https://www.technologyreview.com/topic/artificial-intelligence/feed/ | MIT 科技评论 AI 频道 |

## 本地开发

```bash
npm install
node scripts/fetch-news.mjs   # 抓取新闻，生成 data/news/ 下的日报数据
npm run dev                   # http://localhost:3000
```

其他命令：`npm run build`（生产构建）、`npm run lint`。

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

- `type`：RSS/Atom 用 `"rss"`；JSON API 参考 `"hf"`；GitHub Trending 用 `"trending"`
- `weight`：排序权重，官方一手源 10+，媒体 7-8
- `category`：无 LLM 摘要时的兜底分类，必须是以下之一：模型发布 / 论文研究 / 行业动态 / 工具产品 / 芯片算力 / 具身智能
- `site`：来源首页，网站页脚「信息来源」展示链接用（可选，缺省用 `url`）

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
data/state/              # 运行状态：source-health.json（源健康）、last-success.json（心跳）、deepseek-news.json 等
data/news/YYYY-MM-DD.json  # 每日新闻数据（脚本生成，仅本地保存，不入库）
data/forecasts/{daily,weekly}/YYYY-MM-DD.md  # 三日/每周预测报告（仅本地保存，不入库）
data/impact/{daily,weekly}/YYYY-MM-DD.md     # 三日/七天影响分析（仅本地保存，不入库）
.github/workflows/         # daily-update.yml（云端兜底已停用定时，仅手动触发）、ci.yml（构建验证）
```
