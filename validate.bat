@echo off
echo ===================================================
echo [1/2] Validation des tests JS applicatifs (Vitest)
echo ===================================================
call npx vitest run
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Les tests JS Vitest ont echoue.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [2/2] Validation des verrous de gouvernance (Pytest)
echo ===================================================
call python -m pytest
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Les verrous de gouvernance Pytest ont echoue.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo SUCCESS: Tous les verrous et tests sont 100%% VERTS !
echo ===================================================
