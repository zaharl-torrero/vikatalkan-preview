@echo off
cd /d "%~dp0"
echo http://127.0.0.1:8769
python -m http.server 8769 --bind 127.0.0.1 --directory dist
