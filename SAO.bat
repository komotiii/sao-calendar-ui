@echo off
set "SCRIPT_DIR=%~dp0"
start "SAOCalendar" python "%SCRIPT_DIR%serverfix.py"
