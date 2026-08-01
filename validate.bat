@echo off
echo ===================================================
echo [1/3] Validation des tests JS applicatifs (Vitest)
echo ===================================================
call npx vitest run
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Les tests JS Vitest ont echoue.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [2/3] Validation des verrous de gouvernance (Pytest)
echo ===================================================
call python -m pytest
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Les verrous de gouvernance Pytest ont echoue.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [3/3] Construction de production (Vite)
echo ===================================================
REM AJOUTE AU LOT 017, apres un defaut REEL que les deux etapes ci-dessus n'ont pas vu.
REM `js/app.js` a importe pendant cinq volets deux fonctions qui n'existaient plus dans
REM leurs modules. Vitest ne l'a jamais signale (798 tests verts), parce qu'il resout les
REM modules a la demande ; la construction de production, elle, echoue net. La branche
REM etait donc INPUBLIABLE sans que rien ne le dise.
REM Une suite de tests verte ne prouve pas que l'application se construit.
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] La construction de production a echoue - l'application ne serait pas publiable.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo SUCCESS: Tous les verrous et tests sont 100%% VERTS !
echo ===================================================
