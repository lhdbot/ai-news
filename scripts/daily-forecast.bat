@echo off
rem daily 3-day rolling forecast (10:00): kimi forecast(3d) -> push (no build; pages read data dynamically)
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
node scripts\wait-lock.mjs --name daily-forecast --mode wait >> logs\update.log 2>&1 || exit /b 1
echo ==== daily-forecast %date% %time% ==== >> logs\update.log
node scripts\weekly-forecast.mjs --days=3 >> logs\update.log 2>&1
if errorlevel 1 goto failed
node scripts\push-wechat.mjs >> logs\update.log 2>&1
goto done
:failed
echo [notice][daily-forecast] forecast mjs failed >> logs\update.log
:done
del logs\job.lock
