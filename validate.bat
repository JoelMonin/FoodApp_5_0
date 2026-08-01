@echo off
echo ===================================================
echo [1/4] Verification des types (TypeScript sur le JS)
echo ===================================================
REM AJOUTE AU LOT 021. Place en PREMIER a dessein : c'est l'etape la plus rapide (~4 s) et
REM celle qui echoue le plus tot sur une faute de frappe ou un import casse. Inutile de
REM lancer 825 tests pour apprendre qu'un nom n'existe pas.
REM
REM Il ne convertit RIEN en TypeScript : il relit le JavaScript existant et signale ce
REM qu'aucun test ne peut voir. Reglage volontairement non strict (`jsconfig.json`) : la
REM cible, ce sont les fautes FACTUELLES, pas une migration de langage.
REM
REM Premier passage du LOT 021 : 128 signalements, dont 87 dus a UNE seule cause. Apres
REM traitement : zero, sans qu'une seule ligne de comportement ait change (825 tests
REM identiques avant et apres).
call npx tsc -p jsconfig.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Le verificateur de types a trouve des erreurs.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [2/4] Validation des tests JS applicatifs (Vitest)
echo ===================================================
call npx vitest run
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Les tests JS Vitest ont echoue.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [3/4] Validation des verrous de gouvernance (Pytest)
echo ===================================================
call python -m pytest
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Les verrous de gouvernance Pytest ont echoue.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [4/4] Construction de production (Vite)
echo ===================================================
REM AJOUTE AU LOT 017, apres un defaut REEL que les deux etapes ci-dessus n'ont pas vu.
REM `js/app.js` a importe pendant cinq volets deux fonctions qui n'existaient plus dans
REM leurs modules. Vitest ne l'a jamais signale (798 tests verts), parce qu'il resout les
REM modules a la demande ; la construction de production, elle, echoue net. La branche
REM etait donc INPUBLIABLE sans que rien ne le dise.
REM Une suite de tests verte ne prouve pas que l'application se construit.
REM
REM LOT 021 : l'etape 1 attrape desormais ce defaut precis BIEN PLUS TOT (prouve par
REM mutation). La construction reste indispensable — elle seule verifie que Vite sait
REM reellement assembler l'application, ce qu'aucun verificateur de types ne garantit.
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] La construction de production a echoue - l'application ne serait pas publiable.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo SUCCESS: Tous les verrous et tests sont 100%% VERTS !
echo ===================================================
