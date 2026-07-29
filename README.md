# AI 日报（ai-news）

每天自动聚合全球优质 AI 资讯的中文网站：arXiv 论文（cs.AI / cs.CL / cs.LG）、OpenAI、Google DeepMind、Microsoft Research、Hugging Face Daily Papers，以及量子位、TechCrunch、The Verge、MIT Technology Review 等中英文媒体。由 DeepSeek 自动生成中文标题、一句话摘要和「为什么重要」，GitHub Actions 每日定时更新，Vercel 自动部署。

## 工作原理（Git 即 CMS）

```
GitHub Actions cron（北京时间每天 07:10）
  → node scripts/fetch-news.mjs 抓取 10 个内容源（RSS / JSON API）
  → DeepSeek 批量生成中文摘要（无 key 时降级为只聚合）
  → 写入 data/news/YYYY-MM-DD.json 并提交回仓库（只提交 data/）
  → push 触发 Vercel 重新部署
```

## 本地开发

```bash
npm install
node scripts/fetch-news.mjs   # 抓取新闻，生成 data/news/ 下的日报数据
npm run dev                   # http://localhost:3000
```

其他命令：`npm run build`（生产构建）、`npm run lint`。

## 配置 DeepSeek API key

摘要功能依赖 [DeepSeek API](https://platform.deepseek.com)（OpenAI 兼容接口，成本极低，月开销 <1 元）。

- 本地：设置环境变量 `DEEPSEEK_API_KEY` 后再运行抓取脚本
  ```bash
  # Windows PowerShell
  $env:DEEPSEEK_API_KEY="sk-..."
  node scripts/fetch-news.mjs
  ```
- GitHub Actions：仓库 **Settings → Secrets and variables → Actions** 添加名为
  `DEEPSEEK_API_KEY` 的 secret，workflow 会自动注入。

未配置 key 时脚本照常运行，只是不生成中文摘要（保留原标题与来源推断的分类，`summarized: false`）。

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

## 部署到 Vercel

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
scripts/fetch-news.mjs  # 抓取 + 摘要脚本（Node 直接运行，无 TS 依赖）
data/news/YYYY-MM-DD.json  # 每日新闻数据（由脚本生成并提交）
.github/workflows/      # daily-update.yml（定时更新）、ci.yml（构建验证）
```
