@echo off
chcp 65001 > nul
title Compétition Nationale de Récitation du Coran - Édition 9
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   المسابقة الوطنية لتلاوة القرآن الكريم                 ║
echo  ║   Compétition Nationale de Récitation du Coran           ║
echo  ║   Édition 9 — Warsh et Hafs                              ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Check Node.js
node --version > nul 2>&1
if %errorlevel% neq 0 (
  echo  ❌ Node.js n'est pas installé!
  echo  Télécharger depuis: https://nodejs.org
  pause
  exit
)

:: Check if node_modules exists
if not exist "node_modules\" (
  echo  📦 Installation des dépendances...
  npm install
  echo.
)

:: Get IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
  set IP=%%a
  goto :found
)
:found
set IP=%IP: =%

echo  ✅ Démarrage du serveur...
echo.
echo  ┌─────────────────────────────────────────┐
echo  │  Accès LOCAL:   http://localhost:3000   │
echo  │  Accès RÉSEAU:  http://%IP%:3000  │
echo  └─────────────────────────────────────────┘
echo.
echo  Comptes par défaut (changer avant la compétition!):
echo    admin / password
echo    president / password
echo    juge1..4 / password
echo    public / password
echo.
echo  Appuyez sur Ctrl+C pour arrêter le serveur
echo.

node server.js

pause
