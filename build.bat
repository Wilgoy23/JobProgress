@echo off
rem Builds dist\JobProgress.exe: a single file that runs the whole app.
setlocal
cd /d "%~dp0"

echo [1/3] Building the React frontend...
pushd frontend
call npm install --no-audit --no-fund || goto :fail
call npm run build || goto :fail
popd

echo [2/3] Preparing the Python environment...
if not exist backend\.venv\Scripts\python.exe (
  python -m venv backend\.venv || goto :fail
)
backend\.venv\Scripts\python -m pip install --disable-pip-version-check -q -r backend\requirements-build.txt || goto :fail

echo [3/3] Packaging JobProgress.exe...
backend\.venv\Scripts\python -m PyInstaller --noconfirm --clean --log-level WARN ^
  --onefile --windowed --name JobProgress ^
  --icon "%CD%\assets\icon.ico" ^
  --add-data "%CD%\frontend\dist;frontend_dist" ^
  --paths "%CD%\backend" ^
  --collect-submodules uvicorn ^
  --distpath "%CD%\dist" --workpath "%CD%\build" --specpath "%CD%\build" ^
  backend\desktop.py || goto :fail

echo.
echo Done: %CD%\dist\JobProgress.exe
exit /b 0

:fail
echo.
echo Build failed.
exit /b 1
