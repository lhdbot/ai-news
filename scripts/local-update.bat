@echo off
rem Daily full update: fetch -> summarize -> radar -> digest -> markdown export.
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name daily --mode wait >> logs\update.log 2>&1
if errorlevel 1 exit /b 1
node scripts\job-status.mjs start daily >> logs\update.log 2>&1
echo ==== %date% %time% ==== >> logs\update.log
node scripts\fetch-news.mjs >> logs\update.log 2>&1
if errorlevel 1 goto failed
node scripts\summarize-local.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs --retry --limit=20 >> logs\update.log 2>&1
node scripts\build-radar.mjs >> logs\update.log 2>&1
node scripts\build-digest.mjs >> logs\update.log 2>&1
node scripts\export-markdown.mjs >> logs\update.log 2>&1
node scripts\job-status.mjs finish daily ok >> logs\update.log 2>&1
goto done
:failed
node scripts\job-status.mjs finish daily failed "fetch failed" >> logs\update.log 2>&1
:done
del logs\job.lock
