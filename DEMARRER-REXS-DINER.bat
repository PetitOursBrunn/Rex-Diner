@echo off
title Rex's Diner - Serveur temps reel
cd /d "%~dp0"
echo.
echo Lancement de Rex's Diner...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERREUR : Node.js n'est pas installe sur ce PC.
  echo Installe Node.js puis relance ce fichier.
  pause
  exit /b 1
)
node server.js
pause
