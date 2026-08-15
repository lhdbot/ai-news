@echo off
rem watch mode: fetch + summarize(new only); 页面动态读取数据，有更新无需重建/重启，
rem 下次访问即见新内容（代码变更才需要手动 npm run build + 重启）
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
rem shared job lock: another task running -> skip this round (it runs every 30min anyway)
node scripts\wait-lock.mjs --name watch --mode skip >> logs\update.log 2>&1 || exit /b 0
node scripts\heartbeat.mjs >> logs\update.log 2>&1
echo ==== watch %date% %time% ==== >> logs\update.log
node scripts\data-changed.mjs --mark >> logs\update.log 2>&1
node scripts\fetch-news.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs >> logs\update.log 2>&1
node scripts\build-radar.mjs >> logs\update.log 2>&1
node scripts\export-markdown.mjs >> logs\update.log 2>&1
rem daily personal impact analysis (self-guarded: skips if today's file exists)
node scripts\daily-impact.mjs --days=3 >> logs\update.log 2>&1
node scripts\data-changed.mjs --check >> logs\update.log 2>&1 && echo [watch] data updated, visible on next visit >> logs\update.log || echo [watch] no data change >> logs\update.log
rem keep-alive: site must stay up even when nothing changed (server reads data dynamically)
netstat -ano | findstr ":3000" | findstr LISTENING >nul || start /min "" cmd /c "npm start -- -p 3000 >> logs\server.log 2>&1"
del logs\job.lock
