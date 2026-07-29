@echo off
rem weekly forecast: collect 7d -> kimi forecast -> build -> commit/push
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
echo ==== weekly %date% %time% ==== >> logs\update.log
node scripts\weekly-forecast.mjs >> logs\update.log 2>&1
call npm run build >> logs\update.log 2>&1
git add data/ >> logs\update.log 2>&1
git diff --cached --quiet || git commit -m "data: weekly forecast" >> logs\update.log 2>&1
git push >> logs\update.log 2>&1 || echo push failed, will retry next run >> logs\update.log
