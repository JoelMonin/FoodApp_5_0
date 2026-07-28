# 🪓 CHANTIER — SPLIT_APP_JS

> **Priorité :** Moyenne (avant que app.js dépasse 1500 lignes)
> **Effort estimé :** 2-3 jours
> **Source :** ULTRA_AUDIT_REPORT.md (2026-05-01)
> **Statut :** À démarrer après TESTS_UI_LAYER (refactor sécurisé par les tests)

---

## 🎯 Objectif

Découper `js/app.js` (1290 lignes) en sous-modules cohérents, encapsuler les 6 variables d'état UI éparpillées, et éliminer les duplications de logique repérées dans l'audit.

Conserver le pattern "1 fichier orchestrateur fin + N modules métier" pour rester lisible.

---

## 📋 Findings concernés

### F1 — God-object `js/app.js`
- **Statut** : Commentaire architectural global
- **Mesure** : 1290 lignes (sous le seuil 1500 du CLAUDE.md mais en croissance)
- **Responsabilités actuelles mélangées** : initialisation, routing, vues, handlers actions, prompts IA, gestion modales, logique métier (auto-suggestion, exports, scaling)

### F2 — 6 variables d'état UI au niveau module
- **Fichier** : `js/app.js:24-26 + 348-349 + 644 + 871 + 884`
- **Statut** : TRACED — Confiance 90/100
- **Variables** : `_isManualCategory`, `_localCategoryFill`, `_addSuggestTimer`, `_currentPickerData`, `_currentEditingIngId`, `_lastTransformedRecipe`
- **Problème** : État UI non encapsulé. Risque de race conditions, oubli de reset au switchView, fuite entre sessions.

### F3 — `CAT_EMOJI` map dupliquée
- **Fichier** : `js/app.js:146-155`
- **Statut** : TRACED — Confiance 95/100
- **Problème** : Seconde source de vérité avec `CATEGORIES` (`src/data.js:5`). Divergence garantie à terme.

### F4 — Logique de dedup `areSimilar` dupliquée
- **Fichier** : `js/app.js:897-901 + 924-928`
- **Statut** : TRACED — Confiance 88/100
- **Problème** : Même bloc `confirm()` dupliqué entre `addIngredient` et `addIngredientFromDb`.

### F5 — `guessCategoryLocally` listes hardcodées
- **Fichier** : `js/app.js:703-728`
- **Statut** : TRACED — Confiance 92/100
- **Problème** : Mots-clés (`poulet`, `boeuf`, etc.) hardcodés dans la fonction. Devraient venir d'une source dérivée de `DEFAULT_DB`.

### F6 — Import non utilisé dans `actions.js`
- **Fichier** : `src/actions.js:3`
- **Statut** : TRACED — Confiance 70/100
- **Problème** : `import { syncPush, syncPull } from './services/firebase.js';` jamais utilisé.

---

## 📝 Plan d'action

### Étape 1 — Migrer `CAT_EMOJI` dans `src/data.js` (1h)

```javascript
// src/data.js
export const CATEGORIES_WITH_EMOJI = [
  { name: 'Protéines',                 emoji: '🥩' },
  { name: 'Légumes',                   emoji: '🥦' },
  { name: 'Fruits',                    emoji: '🍎' },
  // ... etc
];

export const CATEGORIES = CATEGORIES_WITH_EMOJI.map(c => c.name);

export function getCategoryEmoji(catName) {
  return CATEGORIES_WITH_EMOJI.find(c => c.name === catName)?.emoji || '📦';
}
```

Mettre à jour `js/app.js:131-184` `renderPantryFilters` pour utiliser `getCategoryEmoji`. Supprimer la map locale.

### Étape 2 — Extraire `src/utils/dedup.js` (45 min)

```javascript
// src/utils/dedup.js
import { areSimilar, normalizeString } from './helpers.js';

/**
 * Demande confirmation si l'ingrédient ressemble à un existant.
 * @returns {boolean} false si l'utilisateur annule, true sinon.
 */
export function confirmIfSimilar(name, existingIngredients) {
  const similar = existingIngredients.find(i => areSimilar(i.name, name));
  if (!similar) return true;
  
  const exact = normalizeString(similar.name) === normalizeString(name);
  const type = exact ? 'existe déjà' : 'ressemble beaucoup';
  return confirm(`ℹ️ "${name}" ${type} à "${similar.name}" (${similar.category}).\nVoulez-vous quand même l'ajouter ?`);
}
```

Remplacer dans `app.js` les blocs lignes 897-901 et 924-928 par un appel à `confirmIfSimilar`.

### Étape 3 — Extraire `src/utils/categorize.js` (1h30)

Migrer `guessCategoryLocally` et `sanitizeCategory` (si elles existent toujours) dans un module dédié. Améliorer en passant : dériver les mots-clés de `DEFAULT_DB` quand possible.

```javascript
// src/utils/categorize.js
import { DEFAULT_DB, CATEGORIES } from '../data.js';
import { normalizeString } from './helpers.js';

// Index DB par première occurrence de chaque mot-clé
const KEYWORD_TO_CATEGORY = (() => {
  const map = new Map();
  for (const ing of DEFAULT_DB) {
    const firstWord = normalizeString(ing.name).split(/\s+/)[0];
    if (firstWord && !map.has(firstWord)) {
      map.set(firstWord, ing.category);
    }
  }
  return map;
})();

export function guessCategoryLocally(name) {
  if (!name) return '';
  const n = normalizeString(name);
  if (n.length < 3) return '';
  
  // Match exact dans DEFAULT_DB
  const exact = DEFAULT_DB.find(i => normalizeString(i.name) === n);
  if (exact) return exact.category;
  
  // Match par premier mot
  const firstWord = n.split(/\s+/)[0];
  if (KEYWORD_TO_CATEGORY.has(firstWord)) {
    return KEYWORD_TO_CATEGORY.get(firstWord);
  }
  
  return '';
}

export function sanitizeCategory(aiCat, name) {
  if (!aiCat) return guessCategoryLocally(name) || 'Conserves & bocaux';
  if (CATEGORIES.includes(aiCat)) return aiCat;
  // ... mapping AI hallucinations
}
```

### Étape 4 — Extraire `src/services/exports.js` (45 min)

Migrer `exportClipboard` (avec optimisation O(n) du chantier PERF si déjà fait) :

```javascript
// src/services/exports.js
import { state } from '../state.js';

export async function exportClipboard(type) {
  const text = buildClipboardText(type);
  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

function buildClipboardText(type) {
  // ... (logique existante, optimisée)
}
```

Mettre à jour `app.js` pour importer et appeler. La fonction `exportClipboard` exposée via `window.exportClipboard` peut wrapper avec le toast.

### Étape 5 — Extraire `src/ui/addForm.js` (3-4h, le plus gros)

C'est le plus gros morceau : encapsuler les 6 variables d'état UI dans un seul module avec son propre scope.

Structure cible :

```javascript
// src/ui/addForm.js
import { state, saveState } from '../state.js';
import { DEFAULT_DB, CATEGORIES } from '../data.js';
import { callAI } from '../services/gemini.js';
import { guessCategoryLocally, sanitizeCategory } from '../utils/categorize.js';
import { confirmIfSimilar } from '../utils/dedup.js';
import { h, toast } from '../utils/dom.js';
import { generateId, normalizeString } from '../utils/helpers.js';

// État privé du module
const formState = {
  isManualCategory: false,
  localCategoryFill: false,
  addSuggestTimer: null,
  aiSuggestGenId: 0
};

export function reset() {
  formState.isManualCategory = false;
  formState.localCategoryFill = false;
  clearTimeout(formState.addSuggestTimer);
  formState.aiSuggestGenId++;
}

export function handleAddInput(val) {
  // ... logique actuelle, lit/écrit formState
}

export function addIngredient() {
  // ... utilise confirmIfSimilar
}

export function onManualCategoryChange() {
  formState.isManualCategory = true;
  // ...
}

export function searchEmojiAddAI() {
  // ...
}
```

Dans `app.js`, remplacer :
```javascript
// Avant
let _isManualCategory = false;
let _addSuggestTimer = null;
function handleAddInput(val) { ... }
window._onManualCategoryChange = function() { ... };

// Après
import * as AddForm from '../src/ui/addForm.js';
// reset au switchView
function switchView(view) {
  if (view === 'add') AddForm.reset();
  // ...
}
window._onManualCategoryChange = AddForm.onManualCategoryChange;
expose({ ..., handleAddInput: AddForm.handleAddInput, addIngredient: AddForm.addIngredient, searchEmojiAddAI: AddForm.searchEmojiAddAI });
```

### Étape 6 — Extraire `src/ui/recipeModal.js` (2h)

Encapsuler `_currentPickerData`, `_currentPickerRecipeName`, `_lastTransformedRecipe`, `_currentEditingIngId` dans un module similaire.

### Étape 7 — Nettoyer `src/actions.js` (15 min)

Supprimer `import { syncPush, syncPull } from './services/firebase.js';` ligne 3 (non utilisé).

### Étape 8 — Validation (30 min)

- `npm run build` doit passer
- `npm test` doit toujours passer (les tests UI du chantier précédent garantissent la non-régression)
- `js/app.js` doit avoir < 700 lignes après refactor
- Aucune variable `_xxx` au niveau module dans `app.js`

---

## ✅ Critères d'acceptation

- [ ] `js/app.js` < 700 lignes
- [ ] Aucune variable `_*` au niveau module dans `app.js` (toutes encapsulées dans des modules de vue)
- [ ] `CAT_EMOJI` supprimée de `app.js`, dérivée de `src/data.js`
- [ ] Logique `confirmIfSimilar` dans un seul module
- [ ] Imports morts supprimés (`actions.js`)
- [ ] Tests existants verts
- [ ] `npm run build` OK

---

## 📌 Notes

**Pré-requis fortement recommandé** : avoir terminé `TESTS_UI_LAYER` avant ce chantier. Refactor sans tests = risque de régression invisible.

**Découpage progressif** : ce chantier peut être livré en plusieurs PR (1 par étape) plutôt qu'en un seul gros lot. Plus sûr.

---

## 🔗 Liens

- Rapport d'audit source : `ULTRA_AUDIT_REPORT.md` §"Commentaire Architectural Global" et §"P1 Architecture & dette technique"
- Chantier pré-requis : `TESTS_UI_LAYER.md`
- Fichiers concernés : `js/app.js`, `src/data.js`, `src/actions.js`, `src/utils/dedup.js` (nouveau), `src/utils/categorize.js` (nouveau), `src/services/exports.js` (nouveau), `src/ui/addForm.js` (nouveau), `src/ui/recipeModal.js` (nouveau)
