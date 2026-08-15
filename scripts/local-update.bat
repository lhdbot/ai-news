@echo off
rem local daily update: fetch -> kimi summarize -> build -> commit/push
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name daily --mode wait >> logs\update.log 2>&1 || exit /b 1
echo ==== %date% %time% ==== >> logs\update.log
node scripts\fetch-news.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs >> logs\update.log 2>&1
node scripts\build-radar.mjs >> logs\update.log 2>&1
node scripts\export-markdown.mjs >> logs\update.log 2>&1
call npm run build >> logs\update.log 2>&1
git add data/ >> logs\update.log 2>&1
git diff --cached --quiet || git commit -m "data: local daily update" >> logs\update.log 2>&1
git push >> logs\update.log 2>&1 || echo push failed, will retry next run >> logs\update.log
del logs\job.lock
