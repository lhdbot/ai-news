@echo off
rem start site server on logon: http://localhost:3000
cd /d C:\Users\86159\ai-news
if not exist logs mkdir logs
start /min "" cmd /c "npm start -- -p 3000 >> logs\server.log 2>&1"
