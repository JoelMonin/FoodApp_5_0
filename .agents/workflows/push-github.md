---
description: Publie le lot validé sur GitHub Pages (branche main, servie directement depuis la racine).
---

**Vérifié le 2026-07-28 (GitHub API `repos/.../pages`)** : GitHub Pages sert la branche `main`
depuis sa racine (`source.path = "/"`, `build_type = "legacy"`). Il n'y a **aucune étape de
build ni de copie de fichier** : `index.html` (racine) est déjà le point d'entrée SPA moderne et
charge `js/app.js` en module ES, qui importe `src/*.js` à la volée dans le navigateur.

**Corollaire : ce workflow n'écrase plus jamais `index.html` avec `foodapp-v5-Joel.html`.**
Ce dernier fichier n'est pas lié au déploiement du site principal — il sert de base aux copies
personnalisées d'autres utilisateurs (voir `create-user-version.md`).

Publier sur `main`, c'est fusionner la branche `feat/` validée, selon le **VERROU PRODUCTION**
de `CLAUDE.md` §2 : aucune étape de ce workflow ne s'exécute sans confirmation explicite de
Joel donnée au moment du déploiement.

1. **Pré-requis, dans l'ordre** :
   - Validation unifiée verte (`.\validate.bat`).
   - Annonce claire à Joel de ce qui va changer sur la page en ligne.
   - **Confirmation explicite de Joel**, donnée pour ce déploiement précis.

2. Fusion, **sans force**, avec préservation du graphe :
   `git checkout main`
   `git merge --no-ff feat/<nom-de-la-branche>`

3. Envoi vers le dépôt distant, **jamais avec `--force`** :
   `git push origin main`

4. Confirmation visuelle : afficher l'URL live (`https://joelmonin.github.io/FoodApp_5_0/`) et
   rappeler que GitHub Pages peut prendre jusqu'à quelques minutes à republier.
