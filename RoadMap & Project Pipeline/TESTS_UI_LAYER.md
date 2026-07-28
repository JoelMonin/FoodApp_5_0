# 🧪 CHANTIER — TESTS_UI_LAYER

> **Priorité :** Moyenne (filet de sécurité pour évolutions futures)
> **Effort estimé :** 2-3 jours
> **Source :** ULTRA_AUDIT_REPORT.md (2026-05-01)
> **Statut :** À démarrer après PERF + RACE_CONDITIONS

---

## 🎯 Objectif

Couvrir par des tests automatisés les 8 fonctions critiques de `app.js` et de `src/ui/*` actuellement sans aucun filet, et corriger les tests existants superficiels ou flaky.

État actuel : 22 tests, mais ~80% des fonctions critiques de la couche orchestration et UI ne sont pas couvertes.

---

## 📋 Findings concernés

### A — Fonctions critiques non testées (8 fonctions)

| Fonction | Fichier | Pourquoi critique | Tests minimum requis |
|---|---|---|---|
| `handleAddInput` | `app.js:780` | Logique IA + race conditions + debounce | 1 happy path + 1 vide + 1 manuel category + 1 erreur IA |
| `searchEmojiAddAI` | `app.js:978` | Regex emoji + parsing + fallback | 1 happy + 1 erreur API + 1 emojis vides |
| `exportClipboard` | `app.js:556` | 4 formats, logique métier | 1 test par format + 1 état vide |
| `analyzeNutrition` | `app.js:394` | Parse JSON, mutation state | 1 happy + 1 JSON invalide + 1 erreur API |
| `confirmRecipeToCart` | `app.js:484` | Création items + dedup areSimilar | 1 happy + 1 avec dedup + 1 panier vide |
| `restoreAIConfig` | `app.js:307` | DOM manipulation + chips state | 1 config par défaut + 1 config remplie + 1 chips multi |
| `renderShoppingList` | `src/ui/shopping.js:38` | Groupement + sort + état vide | 1 happy + 1 vide + 1 progress calc |
| `renderRecipeDetail` | `src/ui/recipe.js:18` | 3 sources (ai/fav/paste) + nutrition | 1 par source + 1 sans nutrition |
| `renderPantryGrid` | `src/ui/pantry.js:40` | État vide vs plein | 1 plein + 1 vide |

### B — Tests existants superficiels ou flaky

- `tests/helpers.test.js:38-42` : `generateId` flaky par design ("should be reasonably unique") → vérifier sur Set de 1000
- `tests/firebase.test.js:11-40` : assertion finale floue (`expect(result.lastSync).toBeDefined()` au lieu de vérifier la structure)
- `tests/firebase.test.js:42` : 1 seul test d'erreur (status 401) → ajouter timeout, JSON malformé, missing fields
- `tests/gemini.test.js:54-62` : pas de test pour `candidates[0]` manquant ou `parts[]` vide
- `tests/dom.test.js:20-24` : nom trompeur "NOT interpret HTML" — ajouter cas XSS explicite
- `tests/helpers.test.js:5-9` : `stripAccents` couvre 2 cas seulement → ajouter null, undefined, empty string, unicode combos

### C — Modules UI à 0% de couverture

- `src/ui/pantry.js` (renderPantryGrid, renderIngCard)
- `src/ui/shopping.js` (renderShoppingList, renderShoppingItem)
- `src/ui/recipe.js` (renderRecipeCard, renderRecipeDetail)
- `src/ui/components.js` (Badge, ActionButton, SectionLabel)

---

## 📝 Plan d'action

### Étape 1 — Setup jsdom helpers (1h)

Créer `tests/_helpers/dom-helpers.js` :

```javascript
// tests/_helpers/dom-helpers.js
export function setupTestDOM() {
  document.body.innerHTML = `
    <div id="ing-grid"></div>
    <div id="ing-empty" class="hidden"></div>
    <div id="shopping-scroll"></div>
    <div id="modal-recipe-detail"></div>
    <input id="add-name" />
    <input id="add-emoji" />
    <select id="add-category"><option value=""></option></select>
    <input id="add-frozen" type="checkbox" />
    <div id="add-results-list"></div>
    <p id="category-suggestion-indicator"></p>
    <div id="emoji-suggestions"></div>
    <input id="add-emoji-search" />
    <button id="add-emoji-search-btn"></button>
    <div id="modal-recipe-cart-list"></div>
  `;
}

export function cleanupTestDOM() {
  document.body.innerHTML = '';
}

export function mockFetchResponse(data) {
  return { ok: true, json: () => Promise.resolve(data), statusText: 'OK' };
}

export function mockFetchError(status, statusText = 'Error') {
  return { ok: false, status, statusText, json: () => Promise.resolve({}) };
}
```

### Étape 2 — Tests UI components (2h)

Créer `tests/ui-components.test.js` :
- Pantry: renderPantryGrid avec liste vide → empty state visible
- Pantry: renderPantryGrid avec 3 items → 3 cartes
- Shopping: renderShoppingList vide → message "Liste vide"
- Shopping: renderShoppingList avec 5 items dans 2 catégories → groupement correct + progress bar
- Recipe: renderRecipeDetail avec source 'ai' → boutons ⭐ Favoris + 🛒 Liste
- Recipe: renderRecipeDetail avec source 'fav' → boutons 💾 Sauver + 🛒 + Liste
- Recipe: renderRecipeDetail sans nutrition → pas de section Nutrition

### Étape 3 — Tests app.js orchestration (3-4h)

Pour pouvoir tester `app.js`, il faut éventuellement extraire des fonctions pures dans des modules séparés ou utiliser des mocks aggressifs. Stratégie :

**Option A** — Extraire les helpers de `app.js` dans `src/` :
- `getFilteredIngredients` → `src/utils/filtering.js`
- `exportClipboard` → `src/services/exports.js`
- `guessCategoryLocally`, `sanitizeCategory` → `src/utils/categorize.js`

Une fois extraits, tests classiques sans DOM.

**Option B** — Tests d'intégration avec jsdom et mock complet du module `app.js` :
Plus lourd mais préserve l'architecture actuelle.

**Recommandation** : Option A pour les fonctions pures (exportClipboard, guessCategoryLocally), Option B pour les fonctions DOM-dépendantes (handleAddInput).

Tests à créer (Option A) :
- `tests/exports.test.js` : 4 formats de exportClipboard, état vide
- `tests/categorize.test.js` : guessCategoryLocally exact match, mots-clés, fallback
- `tests/filtering.test.js` : getFilteredIngredients avec search, filter spécial, combinaison

Tests à créer (Option B) :
- `tests/handleAddInput.test.js` : avec setupTestDOM + mock fetch + fake timers Vitest

### Étape 4 — Renforcer les tests existants (1-2h)

```javascript
// tests/helpers.test.js — generateId
it('produces unique IDs over 1000 calls', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) ids.add(generateId('test'));
  expect(ids.size).toBe(1000);
});

// tests/helpers.test.js — stripAccents
it('handles edge cases', () => {
  expect(stripAccents(null)).toBe('');
  expect(stripAccents(undefined)).toBe('');
  expect(stripAccents('')).toBe('');
  expect(stripAccents('œuf')).toBe('œuf'); // ligature non décomposable
});

// tests/firebase.test.js — syncPush erreurs étendues
it('throws on 500', async () => {...});
it('throws on network error', async () => {...});
it('strips API key in body verbatim', async () => {
  // Vérifier le body envoyé contient '"apiKey":""' et pas la vraie clé
});

// tests/gemini.test.js — réponses dégradées
it('throws when candidates missing', async () => {...});
it('throws when parts empty', async () => {...});
it('throws when text missing', async () => {...});
```

### Étape 5 — Validation (30 min)

- `npm test` doit afficher au moins 50 tests verts (vs 22 actuellement)
- `npm run build` doit toujours passer
- Aucun test marqué `.skip` ou `.only` en commit

---

## ✅ Critères d'acceptation

- [ ] Au moins 30 nouveaux tests créés (objectif total : 52+ tests)
- [ ] Les 8 fonctions critiques listées ont chacune ≥1 happy path test
- [ ] `tests/helpers.test.js` `generateId` n'est plus flaky (Set de 1000)
- [ ] `tests/firebase.test.js` couvre 3 modes de défaillance (401, 500, JSON invalid)
- [ ] `npm test` passe à 100%
- [ ] Tests UI utilisent `setupTestDOM` / `cleanupTestDOM` réutilisables

---

## 📌 Notes architecturales

L'extraction de fonctions pures de `app.js` (Étape 3 Option A) recouvre partiellement le chantier `SPLIT_APP_JS`. Les deux chantiers peuvent être menés en parallèle si on extrait au fur et à mesure de l'écriture des tests.

**Coordination avec SPLIT_APP_JS** : commencer par TESTS_UI_LAYER permet de figer le comportement avant de refactor. C'est la séquence "tests d'abord, refactor après" classique.

---

## 🔗 Liens

- Rapport d'audit source : `ULTRA_AUDIT_REPORT.md` §"Findings par Consensus" P1 Tests
- Chantier complémentaire : `SPLIT_APP_JS.md`
- Fichiers concernés : `tests/` (nouveaux), `src/utils/` (nouveaux modules extraits)
