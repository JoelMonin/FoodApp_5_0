# CURRENT GOAL

## Objectif Principal
**[LOT 4] Versionnage SSOT** — démarré le 28/07/2026, branche `feat/lot4-version-ssot`.
Une seule source de vérité pour le numéro de version (v5.2 en cours) : un changement
unique propage la version partout (UI, package.json, journal).

## Sous-tâches
- [x] A. Constante `APP_VERSION` dans `src/constants.js` (la SSOT)
- [x] B. Script `scripts/sync_version.py` : propage vers index.html, package.json,
  package-lock.json, SHIP_LOG.md (le « tour de clé »)
- [x] C. Verrou pytest `tests/test_version_ssot.py` : casse si un emplacement dérive
- [x] D. Mise à jour PROJECT_MAP.md (nouveau script + nouveau test)
- [x] E. Validation unifiée verte (22 Vitest + 13 Pytest) + tour de clé testé
  aller-retour (9.9.9 → 5.2.0, diff neutre)

## Prochaine étape
Audit (niveau Standard) puis clôture du lot : merge --no-ff dans main.
