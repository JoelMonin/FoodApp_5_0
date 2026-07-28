# SHIP LOG - FoodApp

## État du Projet
- **Version actuelle** : 5.2.0
- **Dernière mise à jour** : 28/07/2026
- **Statut** : Hotfix production livré (recettes IA) — audit #2 réalisé, 1 arbitrage sécurité en attente

## Historique des modifications
- [x] [HOTFIX PRODUCTION] 28/07/2026 : Recettes IA réparées (SHA: 6fcd016)
    - Affichage des recettes IA restauré : `renderAIResults` ciblait un ID DOM inexistant
      (`ai-results-grid` au lieu de `ai-results-list`) — l'IA générait bien, rien ne s'affichait
      jamais à l'écran. Bug en ligne depuis au moins la 5.2 (SHA: 69da666)
    - Modal détail recette : ajout des styles manquants (`.modal-content`, `.mh-*`, `.rd-*`,
      `.rc-emoji`, `.rc-info`), utilisés par `src/ui/recipe.js` mais absents de la feuille de
      style — le détail s'affichait sans habillage (SHA: be85c74)
    - Origine : audit complet #2 (`ULTRA_AUDIT_REPORT.md`), diagnostic croisé Claude Code / Gemini
    - Métriques : 22/22 Vitest + 13/13 Pytest verts
- [x] [VERSION 5.2 - OnLine] 28/07/2026 : Publication de la 5.2 (tag v5.2)
    - Lot 4 : versionnage SSOT (APP_VERSION + sync_version.py + verrou pytest) — audit Standard a posteriori
    - Hotfix production : imports ESM avec extension .js (site GitHub Pages réparé)
    - Gouvernance : VERROU PRODUCTION (main = page en ligne, feu vert explicite obligatoire)
    - Métriques : 22/22 Vitest + 13/13 Pytest verts
- [x] [PUBLICATION] 28/07/2026 : Synchronisation du dépôt distant et publication GitHub Pages (SHA: c6e82c5)
- [x] [GOUVERNANCE] 28/07/2026 : Cadre de gouvernance agentique et verrous de fraîcheur (SHA: 7af3e4b)
    - CLAUDE.md (source de vérité) + AGENTS.md généré + DOCTRINE_PRODUIT.md
    - Verrous pytest (AGENTS.md, PROJECT_MAP.md) + validation unifiée `validate.bat`
    - Métriques : 22/22 tests Vitest + 10/10 verrous Pytest verts
- [x] [BASELINE] 28/07/2026 : Initialisation git et baseline applicative (SHA: be74103)
- [x] Lot 1 : Extraction services (Firebase/Gemini) & Tests unitaires
- [x] Lot 2 : Modernisation architecture (Vite/ESM)
- [x] Lot 3 : Refactorisation UI (DOM Safe / h-functions)
    - [x] Migration index.html -> type module
    - [x] Refactorisation Inventaire (Pantry)
    - [x] Refactorisation Liste de courses (Shopping)
    - [x] Refactorisation Recettes IA et Favoris

## Notes techniques
- Architecture ESM modulaire (app.js < 400 lignes).
- Vitest : 22 tests passés (100% vert).
- Protection XSS totale : Suppression de innerHTML au profit de l'utilitaire `h()`.
- Build Vite validé pour production.
