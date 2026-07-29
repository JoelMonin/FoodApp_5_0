# SHIP LOG - FoodApp

## État du Projet
- **Version actuelle** : 5.5.0
- **Dernière mise à jour** : 30/07/2026
- **Statut** : Version 5.5 publiée (LOTS 007 + 008) — campagne « Restauration & Refonte » en cours, prochain chantier LOT 009

## Historique des modifications
- [x] [VERSION 5.5 - OnLine] 30/07/2026 : Publication des lots 008 + 007
    - Lot 008 — Données en sécurité : « Importer uniquement le stock » refait fusionner
      (statuts seulement), export blanchi de la clé API, `applyExternalState` point d'entrée
      unique préservant la clé sans condition, réinitialisation qui repeuple (297 ingrédients
      reconstruits depuis l'export réel de Joel) et pousse au cloud avant rechargement,
      hygiène du Set des coches
    - Lot 007 — Synchro collaborative : restauration du `saveState(push)` du monolithe en
      moteur bidirectionnel complet — envoi temporisé 2 s, drapeau « EN ATTENTE » persisté,
      anti-boucle « dernier cloud connu » (persistée, amorcée au premier lancement), pulls
      périodiques 60 s + visibilité + retour réseau, délai 15 s + retry unique, barrière
      reset↔moteur, voyant d'état et panneau système rebranchés (CSS dormant F7/C8),
      coches de courses synchronisées (décision Joel)
    - Audits Dur : LOT 008 double audit passé (28-29/07) ; LOT 007 Gemini GO + Codex GO
      final après 2 cycles de corrections (5 findings + 2 scénarios maintenus, tous fermés
      avec tests). Tests réels à deux appareils levés par décision explicite de Joel —
      constat à l'usage
    - Métriques : 92/92 Vitest + 13/13 Pytest verts, build OK
- [x] [VERSION 5.4 - OnLine] 29/07/2026 : Publication des lots 005 + 006
    - Lot 005 — Quick wins UX : démarrage instantané (rendu local d'abord, synchro en fond
      avec garde-fous d'empreinte), recherche fluide (debounce), croix d'effacement réparée,
      compteurs en une passe, notifications visibles, `setState` assainit les données externes
    - Lot 006 — Comportements produit : liste de courses qui ne pré-coche que les manquants,
      emojis devinés, puce « Autres », boutons de collage grisés, Cloud Sync qui n'efface
      plus la clé API (`applyCloudState`), anti-collision des requêtes IA, `AI_ROLES` SSOT
    - Publication groupée sur feu vert explicite de Joel, base saine avant la campagne
      « Restauration & Refonte » (LOTS 007-014, voir ROADMAP)
    - Métriques : 33/33 Vitest + 13/13 Pytest verts, build OK
- [x] [VERSION 5.3 - OnLine] 28/07/2026 : Ouverture de la 5.3
    - Bascule des modèles IA vers `gemini-3.6-flash` (SSOT `AI_ROLES` dans `src/constants.js`)
    - Numéro de version porté à 5.3.0 et propagé via `sync_version.py`
    - Gouvernance : règle « historique lisible » (journal de versions, pas de micro-commits)
    - Sauvegarde des 5 commandes d'agents dans `.claude/commands`
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
