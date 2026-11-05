@echo off
rem Daily full update: fetch -> summarize -> radar -> markdown export.
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name daily --mode wait >> logs\update.log 2>&1
if errorlevel 1 exit /b 1
echo ==== %date% %time% ==== >> logs\update.log
node scripts\fetch-news.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs >> logs\update.log 2>&1
node scripts\build-radar.mjs >> logs\update.log 2>&1
node scripts\export-markdown.mjs >> logs\update.log 2>&1
del logs\job.lock
