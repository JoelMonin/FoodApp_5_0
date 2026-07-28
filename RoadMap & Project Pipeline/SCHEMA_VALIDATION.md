# 🛡️ CHANTIER — SCHEMA_VALIDATION

> **Priorité :** Moyenne (défense en profondeur)
> **Effort estimé :** 1-2 jours
> **Source :** ULTRA_AUDIT_REPORT.md (2026-05-01)
> **Statut :** À démarrer après les chantiers HAUTE priorité

---

## 🎯 Objectif

Mettre en place une couche de validation des entrées externes (cloud, localStorage, IA) pour éviter qu'une donnée malformée corrompe l'état ou crashe l'app. Ce chantier ne corrige pas un bug actif, c'est de la défense en profondeur.

---

## 📋 Findings concernés

### F1 — Pas de validation de schéma sur Firebase
- **Fichier** : `src/services/firebase.js:45`
- **Statut** : TRACED — Confiance 82/100
- **Problème** : `syncPull()` retourne `await res.json()` sans validation. `setState(cloudData)` applique directement.
- **Risque** : Si la base Firebase est compromise (compte piraté, règles DB mal configurées) ou si le cloud retourne du JSON corrompu, l'app reçoit n'importe quoi.

### F2 — Pas de validation de schéma sur localStorage
- **Fichier** : `src/state.js:40-45`
- **Statut** : TRACED — Confiance 85/100
- **Problème** : `JSON.parse(localStorage)` puis `state = { ...state, ...p };` direct. Si `p.aiConfig` est une string au lieu d'un objet, ça corrompt l'état.
- **Mitigation actuelle** : `sanitizeGlobalState` fait 30% du travail (vérifie les types pour ingredients) mais pas pour aiConfig, favorites, etc.

### F3 — Pas de validation sur réponse `transformRecipeFromText`
- **Fichier** : `src/services/gemini.js:163` + `js/app.js:1085+`
- **Statut** : HYPOTHESIS — Confiance 65/100
- **Problème** : Recipe parsée sans validation. Stockée en favoris.
- **Mitigation actuelle** : Tous les rendus passent par `h()` (createTextNode), donc XSS étouffé. Mais défense en profondeur cassée.

### F4 — Concaténation directe de `val` dans le prompt IA
- **Fichier** : `js/app.js:838-840`
- **Statut** : TRACED — Confiance 70/100
- **Problème** : `const prompt = ...\"${val}\"...` permet à un utilisateur de pourrir son prompt en injectant du texte structurel.
- **Impact** : Limité (data côté client de l'utilisateur lui-même), mais pollue les suggestions.

---

## 📝 Plan d'action

### Étape 1 — Créer `src/utils/validate.js` (2-3h)

Module de validation léger sans dépendance externe (pas de Zod). Fonctions exportées :

```javascript
// src/utils/validate.js

export function isValidIngredient(i) {
  return i && typeof i === 'object'
    && typeof i.id === 'string'
    && typeof i.name === 'string'
    && typeof i.category === 'string';
}

export function isValidRecipe(r) {
  return r && typeof r === 'object'
    && typeof r.name === 'string'
    && r.name.length < 200
    && (Array.isArray(r.ingredients) || r.ingredients === undefined)
    && (Array.isArray(r.steps) || r.steps === undefined);
}

export function isValidAiConfig(c) {
  return c && typeof c === 'object'
    && (c.apiKey === undefined || typeof c.apiKey === 'string');
}

export function validateState(s) {
  if (!s || typeof s !== 'object') return false;
  if (s.ingredients && !Array.isArray(s.ingredients)) return false;
  if (s.favorites && !Array.isArray(s.favorites)) return false;
  if (s.aiConfig && !isValidAiConfig(s.aiConfig)) return false;
  return true;
}

export function escapePromptValue(str) {
  if (!str) return '';
  // Échappe les guillemets, backslashes et caractères structurels JSON
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .slice(0, 100); // Limite de longueur défensive
}
```

### Étape 2 — Appliquer `validateState` à syncPull (30 min)

```javascript
// src/services/firebase.js - syncPull()
import { validateState } from '../utils/validate.js';

export async function syncPull() {
  const url = `${FB_URL}/users/${encodeURIComponent(FB_USER)}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur Firebase Pull: ${res.statusText}`);
  
  const data = await res.json();
  if (data && !validateState(data)) {
    console.warn('[Firebase] Données cloud malformées, ignorées', data);
    return null;
  }
  return data;
}
```

### Étape 3 — Appliquer `validateState` à loadState (30 min)

```javascript
// src/state.js - loadState()
import { validateState } from './utils/validate.js';

export function loadState() {
  try {
    const s = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (validateState(p)) {
        state = { ...state, ...p };
      } else {
        console.warn('[localStorage] Données locales malformées, état par défaut conservé');
      }
    }
    // ... reste de la fonction
  }
  // ...
}
```

### Étape 4 — Valider les recettes IA (45 min)

```javascript
// js/app.js - transformRecipeAI()
import { isValidRecipe } from '../src/utils/validate.js';

async function transformRecipeAI() {
  // ...
  const recipe = await transformRecipeFromText(content, state.aiConfig.apiKey);
  if (!isValidRecipe(recipe)) {
    toast("L'IA a retourné une recette invalide", 'error');
    return;
  }
  _lastTransformedRecipe = recipe;
  // ...
}
```

### Étape 5 — Échapper les valeurs dans les prompts (30 min)

```javascript
// js/app.js - handleAddInput()
import { escapePromptValue } from '../src/utils/validate.js';

const safeVal = escapePromptValue(val);
const prompt = `Tu es un assistant culinaire. Pour l'ingrédient "${safeVal}", ...`;
```

### Étape 6 — Tests unitaires (1h)

Créer `tests/validate.test.js` avec les cas suivants :
- `validateState` : null, undefined, string, objet sans ingredients, objet avec ingredients = "string"
- `isValidRecipe` : null, recipe avec name absent, recipe avec name trop long, recipe valide
- `escapePromptValue` : guillemets, backslashes, sauts de ligne, longueur > 100

---

## ✅ Critères d'acceptation

- [ ] `src/utils/validate.js` créé avec 4 fonctions exportées
- [ ] `syncPull` rejette les données cloud malformées avec warning console
- [ ] `loadState` ignore le localStorage corrompu et conserve l'état par défaut
- [ ] `transformRecipeAI` toast une erreur si l'IA retourne une recette invalide
- [ ] Les prompts IA n'incluent plus de `val` brut (au moins 100 chars max + caractères échappés)
- [ ] `tests/validate.test.js` créé avec ≥10 cas de test
- [ ] `npm test` passe
- [ ] `npm run build` passe

---

## 📌 Notes

- Pas de dépendance externe (Zod, Yup) pour rester léger. Le projet est volontairement sans framework.
- La validation est **défensive**, pas paranoïaque : on log un warning et on conserve l'état par défaut. Pas de toast utilisateur sauf cas IA (où c'est utile).
- Limite de longueur sur `recipe.name` (200) et `escapePromptValue` (100) protège contre les payloads géants.

---

## 🔗 Liens

- Rapport d'audit source : `ULTRA_AUDIT_REPORT.md` §"Findings par Consensus" P1 Sécurité
- Fichiers concernés : `src/state.js`, `src/services/firebase.js`, `src/services/gemini.js`, `js/app.js`, `src/utils/validate.js` (nouveau), `tests/validate.test.js` (nouveau)
