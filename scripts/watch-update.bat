@echo off
rem watch mode: fetch + summarize(new only); rebuild/restart/commit only on changes
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
rem shared job lock: another task running -> skip this round (it runs every 30min anyway)
node scripts\wait-lock.mjs --name watch --mode skip >> logs\update.log 2>&1 || exit /b 0
node scripts\heartbeat.mjs >> logs\update.log 2>&1
echo ==== watch %date% %time% ==== >> logs\update.log
node scripts\fetch-news.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs >> logs\update.log 2>&1
node scripts\build-radar.mjs >> logs\update.log 2>&1
node scripts\export-markdown.mjs >> logs\update.log 2>&1
rem daily personal impact analysis (self-guarded: skips if today's file exists)
node scripts\daily-impact.mjs --days=3 >> logs\update.log 2>&1
git add data/ >> logs\update.log 2>&1
git diff --cached --quiet && goto nochange
echo [watch] new items found, rebuilding >> logs\update.log
git commit -m "data: watch update" >> logs\update.log 2>&1
call npm run build >> logs\update.log 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do taskkill /PID %%p /F >> logs\update.log 2>&1
start /min "" cmd /c "npm start -- -p 3000 >> logs\server.log 2>&1"
git push >> logs\update.log 2>&1 || echo push failed >> logs\update.log
goto done
:nochange
rem keep-alive: site must stay up even when nothing changed
netstat -ano | findstr ":3000" | findstr LISTENING >nul || start /min "" cmd /c "npm start -- -p 3000 >> logs\server.log 2>&1"
echo [watch] no changes >> logs\update.log
:done
del logs\job.lock
