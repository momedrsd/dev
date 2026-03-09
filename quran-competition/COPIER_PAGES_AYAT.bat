@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Copie des pages Ayat vers la competition
echo.
echo ================================================================
echo   COPIE DES PAGES DU CORAN - Warsh et Hafs
echo   Depuis Ayat vers la Competition Nationale de Recitation
echo ================================================================
echo.

:: Dossiers destination
set DEST_WARSH=%~dp0public\quran\warsh
set DEST_HAFS=%~dp0public\quran\hafs

echo Que voulez-vous copier ?
echo.
echo   [1] Warsh uniquement  
echo   [2] Hafs uniquement   
echo   [3] Les deux
echo.
set /p CHOIX="Votre choix (1/2/3): "

if "%CHOIX%"=="1" goto SAISIR_WARSH
if "%CHOIX%"=="2" goto SAISIR_HAFS
if "%CHOIX%"=="3" goto SAISIR_WARSH
echo Choix invalide.
pause
exit /b 1

:SAISIR_WARSH
echo.
echo Entrez le chemin COMPLET du dossier contenant les pages WARSH :
echo Exemple: C:\Users\VotreNom\AppData\Roaming\Ayat\warsh
echo.
set /p WARSH_SRC="Chemin Warsh: "
if "%CHOIX%"=="3" goto COPIER_WARSH_ET_HAFS
call :COPIER "%WARSH_SRC%" "%DEST_WARSH%" "Warsh"
goto FIN

:SAISIR_HAFS
echo.
echo Entrez le chemin COMPLET du dossier contenant les pages HAFS :
echo.
set /p HAFS_SRC="Chemin Hafs: "
call :COPIER "%HAFS_SRC%" "%DEST_HAFS%" "Hafs"
goto FIN

:COPIER_WARSH_ET_HAFS
call :COPIER "%WARSH_SRC%" "%DEST_WARSH%" "Warsh"
echo.
echo Entrez le chemin COMPLET du dossier contenant les pages HAFS :
set /p HAFS_SRC="Chemin Hafs: "
call :COPIER "%HAFS_SRC%" "%DEST_HAFS%" "Hafs"
goto FIN

:COPIER
set SRC=%~1
set DEST=%~2
set NOM=%~3

echo.
echo [%NOM%] Source : %SRC%
echo [%NOM%] Dest   : %DEST%
echo.

if not exist "%SRC%" (
    echo [ERREUR] Dossier introuvable : %SRC%
    goto :eof
)

if not exist "%DEST%" mkdir "%DEST%"

:: Detecter extension
set EXT=png
set COUNT=0
for %%f in ("%SRC%\*.png") do set /a COUNT+=1
if !COUNT!==0 (
    set EXT=jpg
    set COUNT=0
    for %%f in ("%SRC%\*.jpg") do set /a COUNT+=1
)

echo   Extension detectee : .!EXT!  /  !COUNT! fichiers trouves
echo   Copie et renommage en cours...
echo.

set NUM=1
for %%f in ("%SRC%\*.!EXT!") do (
    set PADDED=00!NUM!
    set PADDED=!PADDED:~-3!
    copy "%%f" "%DEST%\page_!PADDED!.png" >nul 2>&1
    set /a NUM+=1
    set /a MOD=NUM %% 100
    if !MOD!==0 echo   ... !NUM! pages copiees
)
set /a TOTAL=NUM-1
echo   [OK] %NOM% : !TOTAL! pages copiees ^(page_001.png ... page_!TOTAL!.png^)
goto :eof

:FIN
echo.
echo ================================================================
echo   TERMINE !
echo   Lancez DEMARRER.bat pour demarrer la competition !
echo ================================================================
echo.
pause
