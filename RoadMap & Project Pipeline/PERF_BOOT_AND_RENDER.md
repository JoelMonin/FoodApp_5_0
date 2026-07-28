# 🚀 CHANTIER — PERF_BOOT_AND_RENDER

> **Priorité :** Haute
> **Effort estimé :** 1-2 jours
> **Source :** ULTRA_AUDIT_REPORT.md (2026-05-01)
> **Statut :** À démarrer

---

## 🎯 Objectif

Éliminer les 5 frictions de performance directement visibles par l'utilisateur :
1. Page blanche au boot pendant 2-5 secondes (attente Firebase)
2. Lag à chaque caractère tapé dans la recherche d'inventaire
3. Recalcul redondant des compteurs (badges) à chaque action
4. Recalcul redondant de la grille emojis à chaque keystroke
5. Boucle imbriquée O(n²) dans `exportClipboard('categorized')`

---

## 📋 Findings concernés

### F1 — `await syncPull()` bloque le rendu initial
- **Fichier** : `js/app.js:41`
- **Statut** : TRACED — Confiance 85/100
- **Problème** : Sur 3G ou Firebase ralenti, l'utilisateur voit du blanc 2-5s alors que le state local est déjà disponible.
- **Code actuel** :
  ```javascript
  loadStateFromModule();           // instantané
  state = moduleState;
  const cloudData = await syncPull();   // BLOQUE 2-5s
  if (cloudData) { setState(cloudData); }
  renderCurrentView();              // ne s'exécute qu'après
  ```
- **Code cible** :
  ```javascript
  loadStateFromModule();
  state = moduleState;
  renderCurrentView();              // RENDU IMMÉDIAT depuis localStorage
  
  // Sync en arrière-plan
  syncPull().then(cloudData => {
    if (cloudData) {
      const localApiKey = state.aiConfig?.apiKey;
      if (localApiKey && (!cloudData.aiConfig || !cloudData.aiConfig.apiKey)) {
        if (!cloudData.aiConfig) cloudData.aiConfig = {};
        cloudData.aiConfig.apiKey = localApiKey;
      }
      setState(cloudData);          // déclenche stateUpdated → re-render automatique
    }
  }).catch(e => console.error('Background sync failed', e));
  ```

### F2 — `handleSearch` sans debounce
- **Fichier** : `js/app.js:228-230`
- **Statut** : TRACED — Confiance 90/100
- **Problème** : À chaque frappe, `renderPantry()` itère sur 200+ ingrédients en appelant `normalizeString` pour chacun.
- **Code cible** :
  ```javascript
  let _searchDebounce = null;
  function handleSearch(val) {
    state.search = val;
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => renderPantry(), 200);
  }
  ```

### F3 — `updateBadges` filtre 2× à chaque renderCurrentView
- **Fichier** : `js/app.js:629-657`
- **Statut** : TRACED — Confiance 75/100
- **Problème** : `state.ingredients.filter(i => i.inStock).length` + `.filter(i => i.inCart).length` à chaque cycle.
- **Solution** : Une seule passe avec accumulation :
  ```javascript
  function updateBadges() {
    let stockCount = 0, cartCount = 0;
    for (const i of state.ingredients) {
      if (i.inStock) stockCount++;
      if (i.inCart) cartCount++;
    }
    const favCount = state.favorites?.length || 0;
    // ... applique aux DOM
  }
  ```

### F4 — `updateEmojiSuggestions` sans debounce
- **Fichier** : `js/app.js:773-778` (dans `handleAddInput`)
- **Statut** : TRACED — Confiance 84/100
- **Problème** : `DEFAULT_DB.filter()` sur 273 items à chaque keystroke.
- **Solution** : Le debounce ajouté en F2 + `_addSuggestTimer` (déjà présent ligne 836) couvrent déjà partiellement. Vérifier que `updateEmojiSuggestions` est dans la branche debouncée et non pas appelée à chaque caractère synchroniquement.
- **Action** : Lire le flux exact de `handleAddInput`. Si `updateEmojiSuggestions(val)` est synchrone après chaque frappe, le déplacer dans le `setTimeout` ou le débouncer indépendamment (200ms).

### F5 — `exportClipboard('categorized'|'cart')` O(n²)
- **Fichier** : `js/app.js:575-601`
- **Statut** : TRACED — Confiance 89/100
- **Problème** : `cats.forEach(cat => { state.ingredients.filter(i => i.category === cat).forEach(...) })` = 16 catégories × 273 items = 4368 comparaisons.
- **Solution** : Pré-grouper en O(n) avec un `Map` :
  ```javascript
  const grouped = new Map();
  for (const i of state.ingredients) {
    if (!grouped.has(i.category)) grouped.set(i.category, []);
    grouped.get(i.category).push(i);
  }
  // Ensuite itérer une fois sur grouped.entries()
  ```

---

## 📝 Plan d'action

1. **F1 — Désynchroniser syncPull du rendu initial** (30 min)
   - Modifier `DOMContentLoaded` listener
   - Tester : ouvrir devtools → throttle 3G → vérifier que l'inventaire local s'affiche immédiatement
2. **F2 — Debouncer handleSearch** (15 min)
3. **F3 — Optimiser updateBadges** (15 min)
4. **F4 — Vérifier le flux updateEmojiSuggestions** (30 min) — peut-être déjà OK selon analyse
5. **F5 — Pré-grouper exportClipboard** (30 min)
6. **Validation** :
   - `npm run build` doit passer
   - `npm test` doit toujours être à 22/22
   - Tester manuellement : recherche fluide sur ingrédient, page non-blanche au boot

---

## ✅ Critères d'acceptation

- [ ] Au boot, la vue Inventaire s'affiche en < 100ms (avec données locales)
- [ ] La recherche dans l'inventaire ne lag pas (frappe rapide "saumon" en moins de 300ms)
- [ ] `npm run build` passe
- [ ] Aucune régression sur les tests existants

---

## 🔗 Liens

- Rapport d'audit source : `ULTRA_AUDIT_REPORT.md` §"Findings par Consensus" P1 Performance
- Code concerné : `js/app.js` exclusivement
