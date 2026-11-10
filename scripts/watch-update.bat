@echo off
rem Watch mode: fetch + summarize + digest. Pages read data dynamically,
rem so no rebuild is needed; only code changes require npm run build.
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name watch --mode skip >> logs\update.log 2>&1
if errorlevel 1 (
  echo [watch] another task is running, skip this round >> logs\update.log
  exit /b 0
)
node scripts\job-status.mjs start watch >> logs\update.log 2>&1
node scripts\heartbeat.mjs >> logs\update.log 2>&1
echo ==== watch %date% %time% ==== >> logs\update.log
node scripts\data-changed.mjs --mark >> logs\update.log 2>&1
node scripts\fetch-news.mjs >> logs\update.log 2>&1
if errorlevel 1 goto failed
node scripts\summarize-local.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs --retry --limit=20 >> logs\update.log 2>&1
node scripts\build-radar.mjs >> logs\update.log 2>&1
node scripts\build-digest.mjs >> logs\update.log 2>&1
node scripts\export-markdown.mjs >> logs\update.log 2>&1
node scripts\daily-impact.mjs --days=3 >> logs\update.log 2>&1
node scripts\data-changed.mjs --check >> logs\update.log 2>&1 && echo [watch] data updated >> logs\update.log || echo [watch] no data change >> logs\update.log
node scripts\job-status.mjs finish watch ok >> logs\update.log 2>&1
goto keepalive
:failed
node scripts\job-status.mjs finish watch failed "fetch failed" >> logs\update.log 2>&1
:keepalive
rem keep-alive: site must stay up even when nothing changed
netstat -ano | findstr ":3000" | findstr LISTENING >nul || start /min "" cmd /c "npm start -- -p 3000 >> logs\server.log 2>&1"
del logs\job.lock
