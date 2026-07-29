# AI 日报（ai-news）

每天自动聚合全球优质 AI 资讯的中文网站：arXiv 论文（cs.AI / cs.CL / cs.LG）、OpenAI、Google DeepMind、Microsoft Research、Hugging Face Daily Papers，以及量子位、TechCrunch、The Verge、MIT Technology Review 等中英文媒体。自动生成中文标题、一句话摘要和「为什么重要」。

## 工作原理（本机模式，当前默认）

```
Windows 计划任务 ai-news-daily（每天 07:10）
  → scripts/local-update.bat
    → node scripts/fetch-news.mjs   抓取 11 个内容源（RSS / JSON API）
    → node scripts/summarize-local.mjs  调用本机 Kimi CLI 生成中文摘要（用本机 Kimi 额度，无需 API key）
    → npm run build                 重建静态站
    → git commit + push data/       提交数据（GitHub 作备份）
网站服务: 登录 Windows 后由启动文件夹脚本 scripts/start-site.bat 自动拉起，
         访问 http://localhost:3000
日志: logs/update.log、logs/server.log
```

云端模式（GitHub Actions cron + Vercel + DeepSeek key）已停用，仅保留 `.github/workflows/daily-update.yml` 手动触发作为备用。

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

编辑 `scripts/fetch-news.mjs` 顶部的 `SOURCES` 数组，加一项即可：

```js
{
  name: "来源名称",
  url: "https://example.com/feed.xml",
  type: "rss",        // RSS/Atom 用 "rss"；JSON API 需在脚本里加一个 fetch 函数
  weight: 8,          // 排序权重，官方一手源 10+，媒体 7-8
  category: "行业动态", // 无 LLM 摘要时的兜底分类
}
```

分类必须是以下之一：模型发布 / 论文研究 / 行业动态 / 工具产品 / 芯片算力 / 具身智能。

## 部署到 Vercel（可选，当前未启用）

1. 把本仓库 push 到 GitHub。
2. 到 [vercel.com](https://vercel.com) 用 GitHub 登录，**Import** 该仓库 —— 零配置，自动识别 Next.js。
3. （可选）在 Vercel 项目环境变量或仓库环境中设置 `NEXT_PUBLIC_SITE_URL` 为你的正式域名，用于 sitemap / RSS / OG 中的绝对链接。
4. 之后每天 Actions 提交 `data/` 更新后，Vercel 会自动重新构建部署。

## 目录结构

```
app/                    # Next.js App Router 页面（首页 / 归档 / 标签 / feed.xml / sitemap / robots）
components/             # NewsCard、CategorySection、TagBadge、Header、Footer
lib/news.ts             # 内容层：zod schema + 数据读取
lib/site.ts             # 站点名称 / URL 等常量
scripts/fetch-news.mjs  # 抓取脚本（Node 直接运行，无 TS 依赖）
scripts/summarize-local.mjs  # 本机 Kimi CLI 摘要器
scripts/local-update.bat     # 本地每日更新入口（计划任务调用）
scripts/start-site.bat       # 登录后启动网站服务（启动文件夹调用）
data/news/YYYY-MM-DD.json  # 每日新闻数据（由脚本生成并提交）
.github/workflows/         # daily-update.yml（备用，手动触发）、ci.yml（构建验证）
```
