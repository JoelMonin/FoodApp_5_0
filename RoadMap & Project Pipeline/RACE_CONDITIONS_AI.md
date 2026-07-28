# ⚠️ CHANTIER — RACE_CONDITIONS_AI

> **Priorité :** Haute
> **Effort estimé :** 1 jour
> **Source :** ULTRA_AUDIT_REPORT.md (2026-05-01)
> **Statut :** À démarrer

---

## 🎯 Objectif

Éliminer les 3 fragilités asynchrones et silent fails identifiées dans l'audit :
1. Race condition entre requêtes IA successives (suggestions de catégorie)
2. Bouton "Sauver tel quel" silencieux dans la modale "Coller recette"
3. Pattern fragile `state = moduleState` après chaque `setState`

---

## 📋 Findings concernés

### F1 — Race condition dans `handleAddInput`
- **Fichier** : `js/app.js:834-878`
- **Statut** : TRACED — Confiance 80/100
- **Scénario** : Utilisateur tape "salsifi", attend, puis efface et tape "tomate". Deux `callAI` partent en parallèle. Si la réponse "salsifi" arrive après "tomate", elle écrase la catégorie correcte.
- **Code actuel** :
  ```javascript
  _addSuggestTimer = setTimeout(async () => {
    const apiKey = state.aiConfig?.apiKey;
    // ...
    const raw = await callAI(prompt, apiKey, model, ...);
    // ... applique le résultat sans vérifier si c'est encore d'actualité
    catSelect.value = finalCat;
  }, 800);
  ```
- **Code cible** : Token de génération invalidé si nouvelle requête lancée :
  ```javascript
  let _aiSuggestGenId = 0;
  
  _addSuggestTimer = setTimeout(async () => {
    const myGenId = ++_aiSuggestGenId;
    const apiKey = state.aiConfig?.apiKey;
    if (!apiKey) return;
    
    try {
      const raw = await callAI(prompt, apiKey, model, ...);
      // Vérifier que cette requête est toujours d'actualité
      if (myGenId !== _aiSuggestGenId) return;
      // ... appliquer le résultat
    } catch (e) {
      if (myGenId !== _aiSuggestGenId) return;
      console.warn('[AI Suggest]', e.message);
    }
  }, 800);
  ```
- **Alternative plus propre** : `AbortController` passé à `fetch` dans `callAI` (signal d'annulation natif). Demande de modifier `src/services/gemini.js` pour accepter un signal.

### F2 — `_lastTransformedRecipe` null → bouton silencieux
- **Fichier** : `js/app.js:871, 1284-1285`
- **Statut** : TRACED — Confiance 82/100
- **Scénario** : Utilisateur ouvre "Coller recette", colle du texte, clique "Sauver tel quel" sans avoir cliqué "Transformer avec l'IA". → `saveRecipeOnly(null)` → `if (!r) return;` silencieux.
- **Solutions possibles** (à choisir) :
  
  **Option A — Désactiver le bouton tant qu'aucune recette transformée :**
  ```javascript
  // Dans transformRecipeAI(), après succès :
  document.getElementById('paste-save-btn').disabled = false;
  document.getElementById('paste-save-and-cart-btn').disabled = false;
  
  // Dans openPasteModal() :
  document.getElementById('paste-save-btn').disabled = true;
  document.getElementById('paste-save-and-cart-btn').disabled = true;
  _lastTransformedRecipe = null;
  ```
  
  **Option B — Toast d'erreur explicite si pas de recette :**
  ```javascript
  saveRecipeOnly: () => {
    if (!_lastTransformedRecipe) {
      toast("Cliquez d'abord sur 'Transformer avec l'IA'", 'error');
      return;
    }
    saveRecipeOnly(_lastTransformedRecipe);
  }
  ```
  
  **Option C — Sauvegarder le texte brut comme fallback :**
  Plus complexe, à éviter pour ce chantier.

  **Recommandation** : Option A (UX correcte sans bruit).

### F3 — Pattern `state = moduleState` fragile
- **Fichiers** : `js/app.js:38, 50, 73`, `src/state.js:115`
- **Statut** : TRACED — Confiance 88/100
- **Problème** : `state.js` réassigne `state = {...state, ...partial}` dans `setState`. Cette réassignation crée un nouvel objet, donc les modules qui ont fait `let state = moduleState;` voient l'ancienne référence. Le pattern `state = moduleState;` après chaque `setState` est compensatoire et fragile.
- **Solutions possibles** (à choisir) :
  
  **Option A — Muter au lieu de réassigner dans `setState` :**
  ```javascript
  // src/state.js
  export function setState(partialState) {
    Object.assign(state, partialState);   // mutation, pas réassignation
    saveState();
  }
  ```
  Avantage : `let state = moduleState;` reste valide à vie.
  Inconvénient : si `partialState` contient `aiConfig`, on remplace l'objet entier (pas de deep-merge automatique).
  
  **Option B — Ne plus aliaser localement :**
  Remplacer toutes les lectures `state.x` dans `app.js` par `moduleState.x`. ES6 live bindings garantissent la fraîcheur.
  Avantage : aucun pattern de re-sync nécessaire.
  Inconvénient : refactor large (~80 occurrences dans app.js).
  
  **Recommandation** : Option A — moins invasive, conserve la sémantique actuelle.

---

## 📝 Plan d'action

1. **F1 — Token de génération sur handleAddInput** (1h)
   - Ajouter `let _aiSuggestGenId = 0;` au niveau module
   - Encapsuler chaque `await callAI` avec capture/vérification du genId
   - Tester : taper rapidement plusieurs ingrédients, vérifier que seul le dernier résultat est appliqué

2. **F2 — Désactiver boutons "Sauver" sans recette transformée** (30 min)
   - Identifier les IDs HTML des boutons (probablement `paste-save-btn` + `paste-save-and-cart-btn`)
   - Ajouter `disabled = true` à l'ouverture de la modale
   - Activer après transformation réussie
   - Tester : ouvrir modale, vérifier que les boutons sont grisés ; transformer puis cliquer sauver

3. **F3 — Mutation au lieu de réassignation dans setState** (1h)
   - Modifier `src/state.js` `setState` pour utiliser `Object.assign(state, ...)`
   - Supprimer les `state = moduleState;` redondants dans `app.js` (lignes 38, 50, 73)
   - Tester : pull Firebase, vérifier que les ingrédients s'affichent correctement après sync
   - Tests existants (`tests/state.test.js`) doivent toujours passer

4. **Validation globale** :
   - `npm run build`
   - `npm test`
   - Tests manuels listés ci-dessus

---

## ✅ Critères d'acceptation

- [ ] Tester race condition handleAddInput : taper "salsifi" puis effacer puis taper "tomate" rapidement → seul "tomate" doit appliquer une catégorie
- [ ] Boutons "Sauver tel quel" et "Sauver + liste" grisés à l'ouverture de la modale paste
- [ ] Plus aucun `state = moduleState;` dans `app.js` après cette refacto
- [ ] Tests existants verts

---

## 🔗 Liens

- Rapport d'audit source : `ULTRA_AUDIT_REPORT.md` §"Findings par Consensus" P1 Bugs et fragilités
- Fichiers concernés : `js/app.js`, `src/state.js`
