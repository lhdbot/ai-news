@echo off
rem 本地每日更新: 抓取 -> Kimi 摘要 -> 构建 -> 提交/推送数据
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
echo ==== %date% %time% ==== >> logs\update.log
node scripts\fetch-news.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs >> logs\update.log 2>&1
call npm run build >> logs\update.log 2>&1
git add data/ >> logs\update.log 2>&1
git diff --cached --quiet || git commit -m "data: local daily update" >> logs\update.log 2>&1
git push >> logs\update.log 2>&1 || echo push failed, will retry next run >> logs\update.log
