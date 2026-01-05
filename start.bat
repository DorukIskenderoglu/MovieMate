@echo off
REM Easy Start Script for Windows
REM This script starts the development server

echo Initializing...
echo.

REM Check if we're in the correct directory
if not exist "package.json" (
    echo Error: package.json not found!
    echo Current directory: %CD%
    echo Please run this script from the project directory.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Start the development server
echo Starting development server...
echo The app will be available at http://localhost:5173
echo.

REM Start npm in a new window
start "Dev Server" cmd /k "npm run dev"

echo Server is running in a separate window.
echo Close the server window to stop the server.
echo.
pause

