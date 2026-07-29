@echo off
rem watch mode: fetch + summarize(new only); rebuild/restart/commit only on changes
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
if exist logs\watch.lock exit /b 0
echo lock > logs\watch.lock
echo ==== watch %date% %time% ==== >> logs\update.log
node scripts\fetch-news.mjs >> logs\update.log 2>&1
node scripts\summarize-local.mjs >> logs\update.log 2>&1
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
echo [watch] no changes >> logs\update.log
:done
del logs\watch.lock
