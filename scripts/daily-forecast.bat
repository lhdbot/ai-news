@echo off
rem daily 3-day rolling forecast (10:00): kimi forecast(3d) -> build -> commit/push
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name daily-forecast --mode wait >> logs\update.log 2>&1 || exit /b 1
echo ==== daily-forecast %date% %time% ==== >> logs\update.log
node scripts\weekly-forecast.mjs --days=3 >> logs\update.log 2>&1
if errorlevel 1 goto failed
call npm run build >> logs\update.log 2>&1
git add data/ >> logs\update.log 2>&1
git diff --cached --quiet || git commit -m "data: daily 3d forecast" >> logs\update.log 2>&1
git push >> logs\update.log 2>&1 || echo push failed, will retry next run >> logs\update.log
node scripts\push-wechat.mjs >> logs\update.log 2>&1
goto done
:failed
echo [notice][daily-forecast] forecast mjs failed, skip build >> logs\update.log
:done
del logs\job.lock
