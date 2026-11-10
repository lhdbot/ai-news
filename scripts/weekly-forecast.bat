@echo off
rem Weekly forecast + 7-day impact + forecast review, then push to WeChat.
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name weekly-forecast --mode wait >> logs\update.log 2>&1
if errorlevel 1 exit /b 1
node scripts\job-status.mjs start weekly-forecast >> logs\update.log 2>&1
echo ==== weekly %date% %time% ==== >> logs\update.log
node scripts\weekly-forecast.mjs --days=7 >> logs\update.log 2>&1
set FFAIL=%errorlevel%
node scripts\daily-impact.mjs --days=7 >> logs\update.log 2>&1
set IFAIL=%errorlevel%
node scripts\forecast-review.mjs >> logs\update.log 2>&1
if %FFAIL% NEQ 0 if %IFAIL% NEQ 0 goto failed
node scripts\push-wechat.mjs --weekly >> logs\update.log 2>&1
node scripts\job-status.mjs finish weekly-forecast ok >> logs\update.log 2>&1
goto done
:failed
node scripts\job-status.mjs finish weekly-forecast failed "forecast and impact failed" >> logs\update.log 2>&1
:done
del logs\job.lock
