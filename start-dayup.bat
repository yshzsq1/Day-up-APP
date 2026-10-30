@echo off
cd /d "%~dp0"
where pythonw >nul 2>nul
if not errorlevel 1 (
  start "" pythonw "%~dp0server.py" --open
) else (
  start "DayUp" python "%~dp0server.py" --open
)
