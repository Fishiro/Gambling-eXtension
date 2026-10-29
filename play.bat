@echo off
rem Double-click to play the web version: starts a small local server and opens the game in your browser.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is needed: https://nodejs.org & pause & exit /b 1)
node tools\serve.js
pause
