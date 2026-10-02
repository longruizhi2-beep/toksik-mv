@echo off
cd /d "%~dp0"
start "" http://localhost:8765/
node render\server.js --port 8765
