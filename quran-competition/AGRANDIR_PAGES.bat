@echo off
chcp 65001 >nul
title Agrandissement des pages du Coran

:: Vérifier si Python est installé
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERREUR] Python n'est pas installe !
    echo.
    echo  Telechargez Python sur : https://www.python.org/downloads/
    echo  Cochez "Add Python to PATH" lors de l'installation
    echo.
    pause
    exit /b 1
)

:: Vérifier/installer Pillow
echo  Verification de Pillow...
python -c "from PIL import Image" >nul 2>&1
if errorlevel 1 (
    echo  Installation de Pillow en cours...
    pip install Pillow
)

:: Lancer le script
python "%~dp0AGRANDIR_PAGES.py"
