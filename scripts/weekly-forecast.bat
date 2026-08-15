@echo off
rem weekly forecast + weekly impact (Mon 08:00): collect 7d -> kimi -> build -> commit/push
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name weekly-forecast --mode wait >> logs\update.log 2>&1 || exit /b 1
echo ==== weekly %date% %time% ==== >> logs\update.log
node scripts\weekly-forecast.mjs --days=7 >> logs\update.log 2>&1
set FFAIL=%errorlevel%
node scripts\daily-impact.mjs --days=7 >> logs\update.log 2>&1
set IFAIL=%errorlevel%
node scripts\forecast-review.mjs >> logs\update.log 2>&1
if %FFAIL% NEQ 0 if %IFAIL% NEQ 0 goto failed
call npm run build >> logs\update.log 2>&1
git add data/ >> logs\update.log 2>&1
git diff --cached --quiet || git commit -m "data: weekly forecast + impact" >> logs\update.log 2>&1
git push >> logs\update.log 2>&1 || echo push failed, will retry next run >> logs\update.log
node scripts\push-wechat.mjs --weekly >> logs\update.log 2>&1
goto done
:failed
echo [notice][weekly] forecast and impact both failed, skip build >> logs\update.log
:done
del logs\job.lock
