@echo off
rem 登录后后台启动网站服务: http://localhost:3000
cd /d C:\Users\86159\ai-news
start /min "" cmd /c "npm start -- -p 3000 >> logs\server.log 2>&1"
