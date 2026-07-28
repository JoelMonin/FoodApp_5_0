# DOCTRINE_PRODUIT.md — Ce que fait CETTE application (FoodApp)

> **Fichier compagnon de `CLAUDE.md`.** `CLAUDE.md` porte le **workflow agentique**
> (réutilisable dans n'importe quel projet) ; **ce fichier-ci porte tout ce qui est propre à
> l'Application FoodApp** : règles métier, périmètre technique, zones sensibles, protocole
> d'interaction avec Joel et seuils d'alerte.
>
> **QUAND LE LIRE — obligation, pas suggestion.** Avant toute **analyse, spécification,
> implémentation ou décision d'audit** touchant le produit FoodApp. Un verdict rendu sans avoir
> lu ce fichier sur un sujet produit est un verdict mal formé.
>
> **AUDIENCE** : Claude Code le lit nativement. Les auditeurs (Codex / Gemini) le lisent
> **sur pointeur** — `AGENTS.md` doit rester portable d'un projet à l'autre.

---

## 1. COLLABORATION AVEC JOEL & STYLE DE COMMUNICATION

- **Style Chef de Projet (non-développeur)** : Parle-moi comme à un chef de projet, pas un dev. Explique les problèmes par leur **impact sur l'utilisateur** (ex: "Le bouton de recette ne réagit pas car...") et pas par le jargon technique. Questions complexes -> format simple / ELI5 (AskUserQuestion).
- **Une décision déjà tranchée par Joel ne se re-demande pas.**
- **Transparence sur les bugs** : Mes bugs sont MES bugs (1ère personne, jamais "legacy" ou "quelqu'un").

---

## 2. PÉRIMÈTRE TECHNIQUE & SPECIFICITÉS FOODAPP

- **Architecture** : Application web SPA (Vite + HTML Vanilla / JavaScript ES Modules + CSS).
- **Intégrations clés** : Firebase (authentification / persistance) et Gemini (suggestions d'IA / analyse de recettes).
- **Déploiement & Dépôt Distant** : 
  - **Dépôt GitHub** : `JoelMonin/FoodApp_5_0` (`https://github.com/JoelMonin/FoodApp_5_0.git`).
  - **URL Live GitHub Pages** : [https://joelmonin.github.io/FoodApp_5_0/](https://joelmonin.github.io/FoodApp_5_0/)
  - **Workflow Déploiement** : `.agents/workflows/push-github.md` (synchronisation et publication vers la branche `main` distante).
- **Gestion des versions & Handoff** : 
  - Protocole Handoff (Livrable ZIP) : Tout lot impliquant une modification de code doit générer un pack de validation dans `handoff/`.
- **Cartographie `PROJECT_MAP.md`** : Mettre à jour dans le même commit tout ajout ou suppression d'un composant JS, fichier HTML, feuille CSS, workflow ou fichier de test.

---

## 3. SEUILS D'ALERTE ARCHITECTURALE & ZONES SENSIBLES

- **Seuil d'alerte sur la taille des fichiers** : Signaler un risque majeur d'architecte si un fichier approche ou dépasse **1 500 lignes**.
  *Attention : `foodapp-v5-Joel.html` dépasse déjà ce seuil et constitue une zone sensible prioritaire de modularisation.*
- **Modularisation** : Toujours extraire la logique métier de la présentation UI (`src/state.js`, `src/actions.js`, `src/ui/`).
- **Zones sensibles du produit** : 
  - Moteur d'état (`src/state.js`).
  - Services d'intégration externe (`src/services/firebase.js`, `src/services/gemini.js`).
  - Calculs nutritionnels et gestion de la garde-manger/recettes (`src/ui/pantry.js`, `src/ui/recipe.js`).

---

## 4. ÉCOSYSTÈME DE TEST & STRATÉGIE DE VALIDATION

- **Double Écosystème de Test (Option Pragmatique)** :
  1. **Tests Applicatifs JS (Vitest)** : Exécutés via `npx vitest run` (mode une passe sans surveillance).
  2. **Verrous de Fraîcheur Gouvernance (Pytest)** : Exécutés via `pytest` (vérification de la fraîcheur d'AGENTS.md et PROJECT_MAP.md).
- **Validation Unifiée** : Tout lot doit être validé avec la commande unifiée `.\validate.bat` (ou `npm run check`), qui enchaîne les 2 écosystèmes. Aucun lot ne peut être clos ou mergé avec des tests rouges.
