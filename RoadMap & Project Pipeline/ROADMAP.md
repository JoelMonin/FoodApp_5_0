# 🗺️ ROADMAP — FoodApp

> Vue d'ensemble des chantiers en cours et du backlog.
> Référencée par le workflow `/ultra-audit` (Étape 0.3) pour éviter les doublons de spec.
> Issue de l'**ULTRA_AUDIT_REPORT.md** du 2026-05-01.

---

## 🚧 EN COURS

_Aucun chantier ouvert pour l'instant._

---

## 🔥 PROCHAIN HAUTE PRIORITÉ

### [PERF_BOOT_AND_RENDER](PERF_BOOT_AND_RENDER.md) — Performance de démarrage et de rendu
> **Pourquoi maintenant** : Bugs UX directement visibles (page blanche au boot pendant 2-5s, lag à chaque frappe dans l'inventaire). Impact perçu immédiat par l'utilisateur.
> **Effort estimé** : 1-2 jours
> **Périmètre** : `js/app.js` (DOMContentLoaded, handleSearch, updateBadges, updateEmojiSuggestions, exportClipboard, renderCurrentView)

### [RACE_CONDITIONS_AI](RACE_CONDITIONS_AI.md) — Stabilité asynchrone et silent fails
> **Pourquoi maintenant** : Bugs actifs reproductibles (race condition sur suggestions IA, bouton "Sauver" silencieux dans modale paste-recipe, pattern fragile state/moduleState).
> **Effort estimé** : 1 jour
> **Périmètre** : `js/app.js` (handleAddInput, _lastTransformedRecipe, état/moduleState), `src/state.js`

---

## 📚 BACKLOG MOYEN TERME

### [SCHEMA_VALIDATION](SCHEMA_VALIDATION.md) — Validation des entrées externes
> **Pourquoi** : Défense en profondeur contre données malformées (Firebase compromis, localStorage altéré, IA hallucinante).
> **Effort estimé** : 1-2 jours
> **Périmètre** : `src/state.js`, `src/services/firebase.js`, `src/services/gemini.js`, `js/app.js` (handleAddInput prompt)

### [TESTS_UI_LAYER](TESTS_UI_LAYER.md) — Couverture tests couche UI et orchestration
> **Pourquoi** : 8 fonctions critiques de `app.js` sans aucun test. Filet de sécurité absent pour les futures évolutions.
> **Effort estimé** : 2-3 jours
> **Périmètre** : `tests/` (nouveaux fichiers), couverture de `app.js`, `src/ui/*`

### [SPLIT_APP_JS](SPLIT_APP_JS.md) — Refactor god-object app.js
> **Pourquoi** : `js/app.js` à 1290 lignes (sous le seuil 1500 mais en croissance). Encapsulation des 6 variables module fragiles. Mutualisation de logiques dupliquées (CAT_EMOJI, areSimilar dedup).
> **Effort estimé** : 2-3 jours
> **Périmètre** : `js/app.js`, `src/data.js` (CAT_EMOJI), `src/utils/dedup.js` (à créer), nouveau `src/ui/addForm.js` (à créer)

---

## 🌱 BACKLOG LONG TERME

### [A11Y_AND_MOTION](A11Y_AND_MOTION.md) — Accessibilité et animations respectueuses
> **Pourquoi** : Application destinée à un usage personnel (Joel) mais dette technique d'a11y qui s'accumule. Compatible mobile = exigence sur cibles tactiles 44px.
> **Effort estimé** : 1-2 jours
> **Périmètre** : `index.html` (sémantique), `css/style.css` (motion + tactile)

---

## ✅ [CLÔTURÉ]

### 2026-05-01 — Migration Monolithe → Modules ES6
- **Statut** : Livré
- **Objectif** : Décomposer le monolithe `foodapp-v5-Joel.html` (73k tokens) en modules ES6 sous `src/`
- **Périmètre** : Extraction state, services Firebase/Gemini, composants UI, utilitaires
- **Validation** : Build Vite OK, 22/22 tests verts, parité fonctionnelle restaurée après plusieurs lots de réparation

### 2026-05-01 — Premier Ultra-Audit
- **Statut** : Livré
- **Objectif** : Audit complet post-migration via 6 agents parallèles
- **Livrables** : `ULTRA_AUDIT_REPORT.md`, 6 chantiers spec'és, `audit_memory.md` initialisé avec 6 trade-offs/faux-positifs validés
