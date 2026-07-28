# 🚀 ULTRA-AUDIT REPORT — 2026-07-28 (Audit #2)
**Cible :** Projet complet (Mode Full Scan) — `src/`, `js/app.js`, `css/style.css`, `index.html`, `tests/`.
**Périmètre exclu :** `foodapp-v5-Joel.html` (non déployé en production, sert de gabarit pour des copies personnalisées d'autres utilisateurs).

> 💡 **Disclaimer** : Ce rapport est une checklist pour raisonner, pas une todo-list obligatoire. Il contient des faux positifs inhérents à l'analyse statique. Les agents valident la cohérence du code, pas la correction de votre logique métier.

> 📌 **Contexte** : Deuxième audit du projet, ~3 mois après l'Audit #1 (2026-05-01, archivé plus bas). Les 6 chantiers issus de l'Audit #1 sont dans `RoadMap & Project Pipeline/` — tous encore **statut "À démarrer"**, diagnostics vérifiés toujours valides pendant cet audit (voir §ROADMAP_REF). `audit_memory.md` (6 entrées) a filtré 6 faux positifs connus. `audit_blacklist.md` est vide.

---

## 🏗️ Commentaire Architectural Global

La séparation `src/` (état, services, ui, utils) vs `js/app.js` (orchestration) reste saine : aucune violation de direction de dépendances détectée. Mais deux découvertes changent la priorité du chantier :

1. **Un bug bloque une fonctionnalité cœur en production** (génération de recettes IA — voir P0 ci-dessous) : le filet de tests à 22 cas ne l'a pas attrapé parce qu'aucun test n'importe `js/app.js` ni ne vérifie la correspondance des IDs DOM utilisés par le JS avec ceux réellement présents dans `index.html`. C'est un angle mort structurel, pas un hasard.
2. **La dette ne se limite plus à `js/app.js`** : `css/style.css` a grossi à 3519 lignes (2,3× le seuil d'alerte) sans jamais entrer dans la réflexion de modularisation — et il porte au moins 16 classes CSS référencées par `src/ui/recipe.js` mais jamais définies, ce qui laisse deux écrans entiers (carte recette, détail recette) sans style réel.

---

## ✅ Suites données (mise à jour du 2026-07-28, après déploiement)

Deux des trois findings P0 sont **corrigés et publiés en production** (merge `6fcd016` sur `main`, poussé sur GitHub Pages) :
- **Recettes IA jamais affichées** → RÉSOLU (`69da666`). Correction de l'ID DOM ciblé.
- **Modal recette sans style** → RÉSOLU (`be85c74`). Les styles manquants ont été ajoutés, mais mon premier jet contenait une séquence `*/` à l'intérieur d'un commentaire CSS (`mh-*/rd-*`), qui fermait le commentaire prématurément et invalidait la règle `.modal-content` qui suivait. Cause identifiée par une session Gemini après vérification en navigateur réel.
  - **Leçon retenue** : j'avais « vérifié » la correction en cherchant le texte de la règle dans le fichier servi par le serveur. Le texte était bien présent — et pourtant le navigateur rejetait la règle. Une présence n'est pas un effet. Sur tout changement visuel, la preuve valable est un rendu constaté en navigateur, pas une recherche textuelle (cf. `CLAUDE.md` §5, principe de preuve).
- **Base Firebase sans authentification** → **TOUJOURS OUVERT**, en attente d'arbitrage de Joel (sécuriser ou documenter comme risque accepté).

---

## 🔴 P0 — Findings critiques confirmés (production, action recommandée en priorité)

**[Bugs] `js/app.js:300` vs `index.html:506`** | Statut : **TRACED** (grep + lecture croisée sur `main`) | Confiance : 98/100
- **Verdict** : `renderAIResults()` cherche `document.getElementById('ai-results-grid')`. Cet ID n'existe nulle part dans `index.html` — le conteneur réel s'appelle `ai-results-list` (ligne 506).
- **Pourquoi** : `if (!grid) return;` sort immédiatement, silencieusement. **Aucune recette générée par l'IA ne s'affiche jamais à l'écran**, quel que soit l'utilisateur ou l'appareil.
- **Confirmé sur `main`** (production) : `git show main:js/app.js` contient la même ligne 300, `git show main:index.html` confirme `id="ai-results-list"`. Le bug est en ligne depuis au moins le commit `309a47c` (Version 5.2).
- **Origine** : trouvé indépendamment par une session Gemini pendant cet audit, revérifié ici par lecture directe du code.
- **Résolution** : `js/app.js:300` → remplacer `'ai-results-grid'` par `'ai-results-list'`. Changement d'une ligne, comportement observable restauré à l'intention d'origine (pare-feu A : ce n'est pas un changement de règle métier, c'est une correction d'un ID cassé).

---

**[Archi/UX] `src/ui/recipe.js` vs `css/style.css`** | Statut : **TRACED** (grep exhaustif, 0 correspondance) | Confiance : 90/100
- **Verdict** : `renderRecipeDetail()` et `renderRecipeCard()` construisent leur DOM avec 16 classes (`mh-left`, `mh-title`, `mh-right`, `rd-top`, `rd-emoji`, `rd-meta-row`, `rd-meta-badge`, `rd-ingredients`, `rd-ing-name`, `rd-ing-amount`, `rd-instructions`, `rd-section-title`, `rd-nutrition`, `rd-nut-item`, `rd-nut-val`, `rc-emoji`, `rc-info`) — **aucune n'existe dans `css/style.css`** (vérifié par grep exact sur les 16 noms).
- **Pourquoi** : Le modal de détail recette (ouvert depuis une suggestion IA ou un favori) et les cartes de recette rendent probablement sans mise en page ni style — éléments empilés au style par défaut du navigateur. Les classes réellement stylées dans le CSS (`.recipe-detail-name`, `.recipe-detail-meta`, `.rc-header`, `.rc-body`...) semblent être une ancienne convention de nommage jamais synchronisée avec le JS actuel.
- **Non confirmé visuellement** (l'agent ne peut pas rendre le navigateur) : à vérifier par une capture d'écran de l'écran "Détail recette" et d'une carte de recette IA avant de corriger, pour comprendre s'il s'agit d'un renommage de classes oublié en cours de route ou d'un fichier CSS incomplet.
- **Résolution proposée** : comparer les deux jeux de noms (`rd-*`/`mh-*`/`rc-emoji`/`rc-info` vs `.recipe-detail-*`/`.rc-*`) pour déterminer lequel est le bon, puis aligner l'un sur l'autre. Pas de changement de comportement métier — uniquement une correction de style cassé.

---

**[Sécurité] `src/services/firebase.js`** | Statut : **TRACED**, vérification réseau réalisée par l'agent d'audit (non rejouée ici pour éviter d'exposer à nouveau les données réelles) | Confiance : 80/100
- **Verdict** : `syncPush`/`syncPull` appellent l'URL Firebase Realtime Database (`FB_URL` + `FB_USER`, codés en dur dans `src/constants.js`, visibles dans le bundle JS public) **sans aucun en-tête d'authentification**.
- **Pourquoi** : Une requête GET anonyme sur l'URL construite par le code (`{FB_URL}/users/{FB_USER}.json`) a retourné un code 200 avec le contenu complet de l'inventaire/recettes. N'importe qui connaissant ou devinant cette URL peut lire — et, l'écriture utilisant le même schéma sans jeton, vraisemblablement altérer — les données cloud.
- **Différence avec les trade-offs déjà assumés** (`audit_memory.md`) : les entrées existantes couvrent la clé API IA (URL/localStorage) et le proxy CORS, pas les règles d'accès de la base Firebase elle-même. C'est une découverte distincte, jamais soumise à votre arbitrage.
- **Action** : ceci touche des données persistées et la confidentialité — **hors du pare-feu A** (nature B, décision produit). Deux issues possibles à trancher : (1) configurer des règles Firebase RTDB qui exigent une authentification, ou (2) si ce risque est jugé acceptable pour un usage personnel/familial (URL non devinable, base non indexée), le documenter explicitement comme trade-off assumé — au même titre que les autres.

---

## 🟠 P1 — Findings nouveaux (non déjà dans la roadmap)

**[Archi] `src/state.js:9-15 + 105-111`** | TRACED | 80/100 — `aiConfig.models` par défaut dupliqué mot pour mot entre l'état initial et `sanitizeGlobalState()`. Factoriser en une constante module `DEFAULT_AI_MODELS`.

**[Archi] `src/constants.js` (AI_ROLES) vs 8 occurrences** | TRACED | 75/100 — `'gemini-2.5-flash'` recodé en dur 8 fois dans `src/services/gemini.js` et `js/app.js` au lieu de référencer `AI_ROLES.FAST`/`AI_ROLES.REASONING`.

**[Archi] `css/style.css` (3519 lignes)** | TRACED | 80/100 — 2,3× le seuil d'alerte de `DOCTRINE_PRODUIT.md` §3 (1500 lignes). Aucun chantier de modularisation ne le couvre, contrairement à `app.js` (`SPLIT_APP_JS.md`).

**[Bugs] `js/app.js:41-51`** | TRACED | 68/100 — Si l'utilisateur modifie l'inventaire localement sans cliquer sur "Synchroniser", le prochain `syncPull()` au démarrage écrase silencieusement ces modifications locales par l'ancien état cloud (merge shallow, pas de détection de conflit).

**[Bugs] `js/app.js:458-466`** | TRACED | 60/100 — `openEnhancedCartPicker` coche `isMissing: true` pour tous les ingrédients d'une recette IA, sans lire le champ `s` ("stock"/"pinned"/"missing") renvoyé par l'IA. Des ingrédients déjà en stock peuvent être ajoutés à tort à la liste de courses si l'utilisateur ne décoche pas manuellement.

**[Bugs] `src/utils/helpers.js:72-74`** | TRACED | 55/100 — `autoEmoji()` est un stub qui retourne toujours `'🛒'` quels que soient ses arguments. Distinct du faux positif déjà en mémoire ("jamais utilisée") : la fonction *est* utilisée (`openEnhancedCartPicker`), mais son implémentation ne fait rien d'utile.

**[Perf] `js/app.js:887-919`** | TRACED | 78/100 — Une seule action (ajout/suppression d'ingrédient) déclenche deux reconstructions complètes de la grille : une via l'event `stateUpdated`, une seconde via un appel explicite à `renderPantry()`/`renderFavorites()` juste après.

**[Perf] `src/actions.js:12-42`** | TRACED | 68/100 — Cocher un seul ingrédient parmi ~273 reconstruit toute la grille (tous les nœuds DOM + listeners) au lieu de patcher la seule carte modifiée.

**[Tests] `tests/state.test.js:31-38`** | TRACED | 78/100 — Le mock `localStorage.getItem.mockReturnValue(...)` s'applique à tous les appels, y compris à la clé `pantry_v5_checked` qui reçoit alors un JSON incompatible (`new Set()` sur un objet non itérable) → `TypeError` avalé silencieusement par le `try/catch` de `loadState`. Le test passe alors que le code lève une exception cachée à chaque exécution.

**[Tests] `tests/state.test.js:20-21`** | TRACED | 55/100 — `beforeEach` ne réinitialise que `state.ingredients`; le reste de l'état (singleton de module) fuit d'un test à l'autre.

---

## 🟡 Hypothèses & signaux faibles (sous le seuil normal de remontée, indicatifs)

- **[Perf] `src/services/firebase.js:10`** | 42/100 — Clone complet de l'état (`JSON.parse(JSON.stringify)`) avant chaque push, sans debounce ; risque de micro-gel si les favoris deviennent volumineux.
- **[Perf] `src/state.js:63-74`** | 45/100 — `saveState()` sérialise l'état complet et déclenche un re-render à chaque appel, sans throttling, en cas de clics rapides successifs.
- **[UX] `css/style.css` toast (z-index 2000) vs modale (z-index 3000)** | 55/100 — Un toast déclenché pendant qu'une modale est ouverte (sauvegarde, erreur IA, sync) s'affiche derrière elle, invisible jusqu'à la fermeture de la modale.
- **[Sec] `index.html:141-169`** | 35/100 — Champ clé API en `type="password"` mais aucune protection contre une copie via l'inspecteur DOM. Mineur, cohérent avec le trade-off déjà assumé sur le stockage en clair.
- **[Sec] `package.json`** | 20/100 — Aucune dépendance de production réelle (tout est `fetch` natif) ; pas de surface de vulnérabilité npm identifiable côté prod.

---

## 🗺️ Findings référencés à la Roadmap (ROADMAP_REF)

Les 6 chantiers de `RoadMap & Project Pipeline/` ont été relus intégralement avant cet audit. Diagnostics vérifiés **toujours valides**, aucun n'a été commencé (statut "À démarrer" confirmé) :
- `PERF_BOOT_AND_RENDER.md` — boot bloquant, recherche sans debounce, `updateBadges`/`exportClipboard` non optimisés.
- `RACE_CONDITIONS_AI.md` — race condition suggestions IA, bouton "Sauver" silencieux, pattern `state = moduleState`.
- `SCHEMA_VALIDATION.md` — pas de validation Firebase/localStorage/IA.
- `TESTS_UI_LAYER.md` — toujours 0/8 fonctions critiques couvertes, 22 tests inchangés, `src/ui/*` toujours à 0%.
- `SPLIT_APP_JS.md` — `js/app.js` toujours à 1290 lignes, 6 variables module non encapsulées, `CAT_EMOJI` toujours dupliqué.
- `A11Y_AND_MOTION.md` — `<div onclick>`, chips sans ARIA, animations sans `prefers-reduced-motion`, cibles tactiles < 44px : tout confirmé inchangé.

---

## 👀 Vérifications visuelles recommandées (Suspect Visual Checklist)

Au-delà du finding P0 sur `recipe.js` (probable absence totale de style), l'agent UX a relevé, sans pouvoir les confirmer visuellement :

- **`css/style.css:1469, 1679, 3504`** — `var(--txt-main)` utilisé mais jamais défini dans `:root` (seul `--txt` existe) → couleur de texte potentiellement incohérente.
- **`css/style.css:2083`** — `var(--shadow-sm)` utilisé au hover mais jamais défini (`--shadow` et `--shadow-lg` seuls existent) → ombre au survol probablement absente.
- **`css/style.css:1591-1616` vs `3020-3036`** — `.r-tag.green`/`.r-tag.red` définis deux fois avec des couleurs différentes ; la cascade tranche, mais à confirmer que le rendu final correspond à l'intention.
- **`css/style.css:1139-1150` + `2864-2872`** — `.ai-settings` en largeur fixe 350px : zone d'écrasement possible entre 768px et 950px de large (petites tablettes, fenêtres partagées).
- **`css/style.css:888-893`** — `.ing-name` sans troncature dans une carte de 105px de large : noms longs ("Alternative végétale au lait d'amande") risquent de casser l'alignement de la grille.
- **`css/style.css:2929-2955` vs `2997-3017`** — deux mécanismes de plein écran recette coexistent (classe manuelle + Fullscreen API native) ; sur les navigateurs qui restreignent `requestFullscreen()` (ex. historiquement iOS Safari), aucun des deux jeux de styles ne s'applique.
- **`css/style.css:126-134` vs `2811-2823`** — traitement visuel de l'état "actif" différent entre la sidebar desktop et la bottom nav mobile — à confirmer que c'est un choix de design assumé.

*(Liste complète des 11 zones relevées disponible dans le journal de l'agent UX de cet audit — les points ci-dessus sont ceux jugés les plus susceptibles d'un impact utilisateur réel.)*

---

## 🚫 Findings écartés par croisement avec `audit_memory.md`

Filtrés silencieusement avant remontée (déjà validés faux positifs le 2026-05-01) : "js/app.js dépasse 1500 lignes", "autoEmoji() jamais utilisée" (nuance : elle est utilisée, mais son implémentation est un stub — voir P1 ci-dessus), clé API dans l'URL, apiKey en clair dans localStorage, proxy allorigins.win, AI_ROLES.REASONING = AI_ROLES.FAST.

---

## 📊 Synthèse en chiffres

- **3 findings P0** (production, dont un bug bloquant confirmé et un risque de sécurité à trancher)
- **9 findings P1** nouveaux, non couverts par les 6 chantiers déjà spécifiés
- **6 chantiers roadmap** revérifiés toujours valides, aucun démarré
- **5 signaux faibles** indicatifs (confiance < 50)
- **7 zones visuelles** à vérifier manuellement

---
---

# 🚀 ULTRA-AUDIT REPORT — 2026-05-01 (Audit #1, archivé)
**Cible :** Projet complet (Mode Full Scan — git absent, mode Laser indisponible)

> 📌 Ce premier audit est conservé pour traçabilité. Ses findings ont depuis été promus dans `RoadMap & Project Pipeline/` (`PERF_BOOT_AND_RENDER.md`, `RACE_CONDITIONS_AI.md`, `SCHEMA_VALIDATION.md`, `TESTS_UI_LAYER.md`, `SPLIT_APP_JS.md`, `A11Y_AND_MOTION.md`) et re-vérifiés valides lors de l'Audit #2 ci-dessus. Ne pas re-spécifier ces chantiers.

## 🏗️ Commentaire Architectural Global

Le projet a réussi la migration d'un monolithe HTML/JS de 73k tokens vers une architecture modulaire ES6. Le découpage `state / services / ui / utils` est sain et la sécurité XSS est traitée (zéro `innerHTML` dans le code applicatif).

**Cependant trois patterns transversaux pénalisent la maintenabilité :**

1. **`js/app.js` est devenu un orchestrateur god-object (1290 lignes)** — sous le seuil 1500 du CLAUDE.md, mais en croissance constante. Il porte à la fois : initialisation, routing, vues, handlers d'actions, prompts IA, gestion de modales, et logique métier (auto-suggestion, exports, scaling). Une seconde phase de découpage est inévitable à moyen terme.

2. **L'état partagé est éparpillé dans 6 variables module non-scopées** (`_isManualCategory`, `_localCategoryFill`, `_addSuggestTimer`, `_currentPickerData`, `_currentEditingIngId`, `_lastTransformedRecipe`). Pattern fragile pour les race conditions et les reset entre vues.

3. **Le pattern `state = moduleState` après chaque `setState`** (lignes 38, 50, 73) trahit une difficulté avec les live bindings ES6. Fonctionne mais coûte cognitivement à chaque modification.

**Côté tests** : couverture symbolique (22 tests, mais 80%+ des fonctions critiques de `app.js` ne sont pas testées). Le filet de sécurité n'attrape que la logique pure de `state.js`/`helpers.js`/`firebase.js`/`gemini.js`. Toute la couche UI et orchestration est livrée sans test.

---

## ⚡ Findings par Consensus (Priorité Haute)

### P1 — Architecture & dette technique

**[Archi+Bugs] `js/app.js:24-26 + 348-349 + 644 + 871 + 884`** | Statut : **TRACED** | Confiance : 90/100
- **Verdict** : 6 variables d'état UI au niveau module (`_isManualCategory`, `_localCategoryFill`, `_addSuggestTimer`, `_currentPickerData`, `_currentEditingIngId`, `_lastTransformedRecipe`).
- **Pourquoi** : État partagé non encapsulé. Risque de race conditions entre vues, oubli de reset au switchView, fuite de données entre sessions de modale.
- **Chaîne d'inférence (TRACED)** : `let _addSuggestTimer = null;` (ligne 26) → utilisé dans `handleAddInput` (834) → si user quitte vue Add pendant timer, le callback s'exécute quand même → écrit dans des éléments DOM qui peuvent ne plus exister.
- **Résolution** : Encapsuler dans un objet `addFormState = {}` réinitialisé au switchView, ou extraire la vue Add dans son propre module avec son propre scope.

---

**[Archi] `js/app.js:146-155`** | Statut : **TRACED** | Confiance : 95/100
- **Verdict** : Map `CAT_EMOJI` hardcodée dans `renderPantryFilters()` alors que les catégories sont définies dans `src/data.js`.
- **Pourquoi** : Seconde source de vérité. Si une catégorie est ajoutée à `CATEGORIES`, il faut penser à mettre à jour `CAT_EMOJI` séparément. Divergence garantie à terme.
- **Chaîne d'inférence (TRACED)** : `src/data.js:5` exporte `CATEGORIES` (16 strings) → `js/app.js:146-155` redéfinit un dict avec ces mêmes 16 noms en clés.
- **Résolution** : Migrer vers `src/data.js` un `CATEGORIES_WITH_EMOJI = [{ name, emoji }, ...]` et dériver `CATEGORIES = CATEGORIES_WITH_EMOJI.map(c => c.name)`.

---

**[Archi] `js/app.js:897-901 + 924-928`** | Statut : **TRACED** | Confiance : 88/100
- **Verdict** : Logique de détection de doublon (`areSimilar` + `confirm()`) dupliquée à l'identique entre `addIngredient` et `addIngredientFromDb`.
- **Pourquoi** : Risque de divergence (bug fixé dans une fonction mais pas dans l'autre).
- **Chaîne d'inférence (TRACED)** : Lignes 897-901 et 924-928, même bloc avec juste `name` vs `dbItem.name`.
- **Résolution** : Extraire une fonction `confirmIfSimilar(name): boolean`.

---

### P1 — Bugs et fragilités

**[Bugs] `js/app.js:1284-1285`** | Statut : **TRACED** | Confiance : 82/100
- **Verdict** : `_lastTransformedRecipe` est `null` à l'init. Si l'utilisateur ouvre la modale "Coller recette" et clique "Sauver" sans avoir cliqué "Transformer avec l'IA" avant, `saveRecipeOnly(null)` fait un `if (!r) return;` silencieux.
- **Pourquoi** : Bouton qui ne fait rien sans feedback utilisateur. UX cassée silencieusement.
- **Chaîne d'inférence (TRACED)** : `expose({ saveRecipeOnly: () => saveRecipeOnly(_lastTransformedRecipe) })` ligne 1284 → `_lastTransformedRecipe` initialisé `null` ligne 871 → uniquement assigné dans `transformRecipeAI` ligne 869.
- **Résolution** : Désactiver le bouton "Sauver tel quel" tant que `_lastTransformedRecipe === null`, OU afficher un toast "Cliquez d'abord sur Transformer".

---

**[Bugs+Perf] `js/app.js:834-878`** | Statut : **TRACED** | Confiance : 80/100
- **Verdict** : Race condition possible dans `handleAddInput`. Le `clearTimeout(_addSuggestTimer)` annule le futur callback, mais ne peut pas annuler une requête `callAI` déjà partie.
- **Pourquoi** : Si l'utilisateur tape "salsifi" puis efface vite et tape "tomate", deux requêtes IA peuvent revenir dans n'importe quel ordre. Le résultat de "salsifi" peut écraser celui de "tomate" si reçu après.
- **Chaîne d'inférence (TRACED)** : `setTimeout(async () => { ... await callAI(...) ... catSelect.value = ... })` ligne 836-865. Aucun token de génération ni AbortController.
- **Résolution** : Utiliser un compteur de génération : capturer `genId = ++_lastGenId` avant `await`, et après `await` n'appliquer le résultat que si `genId === _lastGenId`. Alternative : `AbortController` passé à `fetch` dans `callAI`.

---

**[Bugs] `js/app.js:38-50, 73`** | Statut : **TRACED** | Confiance : 88/100
- **Verdict** : Pattern `let state = moduleState; ... state = moduleState;` après chaque `setState`. Fragile car repose sur la mémorisation du développeur.
- **Pourquoi** : Si un futur contributeur appelle `setState()` sans re-synchroniser `state`, lit l'ancien objet. Bug invisible jusqu'à ce qu'il frappe.
- **Chaîne d'inférence (TRACED)** : `state.js` exporte `let state = {...}`, puis `setState` fait `state = {...state, ...partialState}` (réassignation, pas mutation). En ES6, les imports sont des live bindings, mais `let state = moduleState` copie la référence à un instant T. D'où la nécessité du re-sync.
- **Résolution** : Soit muter au lieu de réassigner dans `setState` (`Object.assign(state, partialState)`), soit ne jamais aliaser localement (`moduleState.x` partout au lieu de `state.x`).

---

**[Perf+UX] `js/app.js:41`** | Statut : **TRACED** | Confiance : 85/100
- **Verdict** : `await syncPull()` bloque tout rendu initial. Page blanche tant que Firebase n'a pas répondu.
- **Pourquoi** : Sur 3G ou Firebase ralenti, l'utilisateur voit du blanc 2-5 secondes alors que le state local est déjà disponible.
- **Chaîne d'inférence (TRACED)** : Ligne 37 `loadStateFromModule()` (instantané) → ligne 41 `await syncPull()` (bloquant) → ligne 55 `renderCurrentView()` (premier rendu). Si on inversait l'ordre, le rendu serait immédiat.
- **Résolution** : Render local immédiatement après `loadStateFromModule()`, lancer `syncPull()` en arrière-plan, et ré-render au retour via le listener `stateUpdated`.

---

**[Perf] `js/app.js:228-230`** | Statut : **TRACED** | Confiance : 90/100
- **Verdict** : `handleSearch` re-render à chaque keystroke sans debounce.
- **Pourquoi** : Sur 200+ ingrédients, l'utilisateur perçoit le lag à chaque caractère tapé. Le filtrage est cher (`normalizeString` × N ingrédients).
- **Chaîne d'inférence (TRACED)** : Ligne 228 `function handleSearch(val) { state.search = val; renderPantry(); }` → `renderPantry` appelle `renderPantryGrid` qui itère sur `getFilteredIngredients()` qui appelle `normalizeString` sur chaque ingrédient.
- **Résolution** : Debounce 200-300ms autour de `state.search = val; renderPantry();`.

---

**[Perf] `js/app.js:629-657 (updateBadges)`** | Statut : **TRACED** | Confiance : 75/100
- **Verdict** : `updateBadges()` filtre `state.ingredients` deux fois (`inStock`, `inCart`) à chaque appel, et est invoqué à chaque `renderCurrentView()` (donc à chaque `stateUpdated`).
- **Pourquoi** : Sur 200 ingrédients, 2 passages = 400 comparaisons à chaque toggle. Pas dramatique mais inutile.
- **Chaîne d'inférence (TRACED)** : Lignes 631-632 `state.ingredients.filter(i => i.inStock).length` et `.filter(i => i.inCart).length`, appelée depuis `renderCurrentView` (ligne 87).
- **Résolution** : Mémoïser dans `state.derivedCounts = { stock, cart }` mis à jour uniquement lors des actions toggleStock/toggleCart (ou via un Proxy).

---

### P1 — Sécurité

**[Sec] `src/services/firebase.js:45`** | Statut : **TRACED** | Confiance : 82/100
- **Verdict** : Données reçues du Firebase appliquées via `setState(cloudData)` sans validation de schéma.
- **Pourquoi** : Si la base Firebase est compromise (compte piraté ou config DB leak), un attaquant peut injecter des structures malformées qui crashent l'app, voire provoquer du XSS si certains champs finissent dans le DOM via une voie non sécurisée.
- **Chaîne d'inférence (TRACED)** : `syncPull()` retourne `await res.json()` sans validation → `app.js:49 setState(cloudData)` mutation directe → `cloudData.ingredients` peut contenir n'importe quoi → `renderPantry` itère et appelle `h('div', { class: ... }, ing.name)`. Le `h()` utilise `createTextNode` donc XSS contenu, mais d'autres champs (catégorie utilisée comme classe CSS, par ex.) pourraient passer.
- **Résolution** : Valider la forme attendue avant d'appliquer. Vérifier que `ingredients` est un Array, que chaque item a `id`, `name` strings, etc. Rejeter tout `cloudData` malformé avec un toast.

---

**[Sec] `src/state.js:40-45`** | Statut : **TRACED** | Confiance : 85/100
- **Verdict** : Même problème côté localStorage : `JSON.parse(localStorage)` puis spread direct dans `state` sans validation.
- **Pourquoi** : Un autre site ne peut pas écrire dans le localStorage, mais une extension malveillante ou un import JSON corrompu peut.
- **Chaîne d'inférence (TRACED)** : `loadState()` ligne 39 `JSON.parse(s)` → ligne 41 `state = { ...state, ...p };` direct → si `p` contient `aiConfig: 'string'` au lieu d'un objet, ça fonctionne mais corrompt l'état.
- **Résolution** : Une fonction `validateAndCoerce(data)` qui retourne un état conforme ou null. `sanitizeGlobalState` fait déjà 30% du travail mais ne vérifie pas les types primitifs.

---

**[Sec] `js/app.js:840`** | Statut : **TRACED** | Confiance : 70/100
- **Verdict** : Concaténation directe de `val` (input utilisateur) dans le prompt IA.
- **Pourquoi** : Un utilisateur taquin pourrait taper `xyz", "category":"💩💩💩` et essayer d'orienter la réponse. Impact limité (data côté client) mais pollue les suggestions.
- **Chaîne d'inférence (TRACED)** : Ligne 838 `const prompt = ` + ` "${val}" ` directement.
- **Résolution** : Échapper les guillemets/backslash de `val` avant insertion, ou utiliser un format de prompt structuré (JSON avec champ name).

---

**[Sec] `src/services/gemini.js:163`** | Statut : **HYPOTHESIS** | Confiance : 65/100
- **Verdict** : `transformRecipeFromText` retourne un objet recette parsé via JSON.parse sans validation de schéma. Cet objet est ensuite stocké dans `state.favorites`.
- **Pourquoi** : Si l'IA retourne `{name: "<script>alert(1)</script>"}`, le nom serait stocké tel quel. Mitigation actuelle : tous les rendus passent par `h()` qui utilise `createTextNode`, donc XSS étouffé. Mais si quelqu'un ajoute un jour un `innerHTML` dans recipe.js, l'attaque devient possible.
- **Pattern reconnu** : "Trust the AI output and store as-is" — défense en profondeur cassée.
- **Résolution** : Valider que `recipe.name`, `recipe.steps[]` sont bien des strings et limiter leur longueur.

---

### P1 — Tests : couverture critique manquante

**[Tests] `js/app.js + src/ui/`** | Statut : **TRACED** | Confiance : 95/100
- **Verdict** : 8 fonctions critiques sans aucun test (happy path ni mode dégradé) :
  - `handleAddInput` (logique métier complexe + appels IA + race conditions potentielles)
  - `searchEmojiAddAI` (regex, parsing emoji)
  - `exportClipboard` (4 formats, logique de groupement)
  - `analyzeNutrition` (parse JSON, mutation state)
  - `confirmRecipeToCart` (création items panier, dedup via `areSimilar`)
  - `renderShoppingList` (groupement, sort, état vide)
  - `renderRecipeDetail` (3 sources : ai/fav/paste)
  - `renderPantryGrid` (état vide vs plein, fragment DOM)
- **Pourquoi** : Toute la couche orchestration + UI est livrée sans filet. Régressions invisibles jusqu'à test manuel.
- **Mesure observée** : `tests/` contient 5 fichiers (dom, firebase, gemini, helpers, state) couvrant uniquement la logique pure.
- **Résolution** : Ajouter un fichier `tests/handleAddInput.test.js` minimum avec mock DOM (jsdom déjà configuré dans `vite.config.js`).

---

**[Tests] `tests/helpers.test.js:38-42`** | Statut : **TRACED** | Confiance : 75/100
- **Verdict** : Test `generateId` flaky par design — "should be reasonably unique" ne donne aucune garantie de reproductibilité.
- **Pourquoi** : Si la suite est lancée 1000 fois, le test peut casser une fois par chance. Bruit dans la CI.
- **Résolution** : Vérifier l'unicité sur un Set de 1000 IDs générés en boucle, ou tester les composantes (préfixe + format `prefix_<digits>_<random>`).

---

## 🟡 Hypothèses & Signaux Faibles

**[Bugs] `js/app.js:368, 540`** | Statut : **HYPOTHESIS** | Confiance : 65/100
- **Pattern reconnu** : `state.aiSuggestions[idx]` accédé sans bounds check explicite.
- **Scénario hypothétique** : Si `state.aiSuggestions` est invalidé (ex: nouvelle génération en cours) entre l'affichage de la carte et le clic, `idx` pointe vers un objet qui a changé. Mitigé par `if (!r) return;` lignes 365.

**[Bugs] `js/app.js:519-520`** | Statut : **HYPOTHESIS** | Confiance : 55/100
- **Pattern reconnu** : `const r = fav.recipe || fav;` — fallback fragile si `fav.recipe` est falsy mais existant (chaîne vide, 0, etc.).
- **Scénario hypothétique** : Import JSON avec `{ id: '1', recipe: '' }` → `r = '' || fav = fav` → la carte affiche les métadonnées du favori au lieu de la recette.

**[Bugs] `src/state.js:115`** | Statut : **HYPOTHESIS** | Confiance : 60/100
- **Pattern reconnu** : `setState` dispatch `stateUpdated` synchronement, listeners exécutés avant que tous les imports aient re-bind leur référence.
- **Scénario hypothétique** : Très improbable en pratique (single-threaded), mais théoriquement un listener qui déclenche un autre `setState` pourrait voir un état intermédiaire.

**[Sec] `src/services/gemini.js:16`** | Statut : **HYPOTHESIS — TRADE-OFF BY DESIGN** | Confiance : 70/100
- **Pattern reconnu** : Clé API Gemini envoyée dans l'URL (`?key=${apiKey}`).
- **Scénario hypothétique** : Logs réseau/serveurs proxy peuvent enregistrer la clé. Mitigation : architecture client-side sans backend, choix assumé. À documenter dans le README.

**[Sec] `src/state.js:65`** | Statut : **HYPOTHESIS — TRADE-OFF BY DESIGN** | Confiance : 65/100
- **Pattern reconnu** : `apiKey` stockée en clair dans localStorage.
- **Scénario hypothétique** : Une extension malveillante peut lire localStorage. Mitigation : architecture client-side, l'utilisateur fournit sa propre clé. Trade-off accepté.

**[Sec] `js/app.js:1080+ (allorigins.win)`** | Statut : **HYPOTHESIS — TRADE-OFF BY DESIGN** | Confiance : 65/100
- **Pattern reconnu** : Proxy tiers `allorigins.win` utilisé pour bypasser CORS sur la lecture d'URLs.
- **Scénario hypothétique** : Le proxy peut logger toutes les URLs scrapées. Risque privacy mineur (l'utilisateur scrape ses propres recettes publiques). Trade-off accepté.

**[Perf] `js/app.js:299-305`** | Statut : **HYPOTHESIS** | Confiance : 60/100
- **Pattern reconnu** : `recipes.map(...).renderRecipeCard` recrée 5 cartes complètes à chaque `renderAIResults`.
- **Scénario hypothétique** : Avec 5 recettes c'est trivial, mais si quelqu'un push à 50, le coût devient sensible.

---

## 👀 Vérifications Visuelles Recommandées (Suspect Visual Checklist)

L'agent UX a identifié **30 zones suspectes**. Les plus impactantes :

### Accessibilité (🔴 prioritaire)
- **`index.html:204-375`** — `<div>` cliquables avec `onclick` au lieu de `<button>` (sb-item, chips, navigation). Lecteurs d'écran ne les annoncent pas comme interactifs.
- **`index.html:338-375`** — Chips meal/time/diff/ppl simulent des `radio` sans `role="radio"` ni `aria-checked`. Navigation clavier dégradée.
- **`index.html:714-733`** — Bottom nav : pas de `aria-current="page"` sur l'onglet actif. État courant invisible aux ATs.
- **`index.html:384`** — Accordéon "filtres avancés" : `onclick` qui toggle `.open` sans `aria-expanded`. État ouvert/fermé non annoncé.

### Animations sans `prefers-reduced-motion`
- **`css/style.css:416-426 + 672-697 + 2661-2683`** — 11 keyframes sans respect du préf utilisateur (motion sickness, vestibulaire).

### Cibles tactiles < 44px
- **`css/style.css:3038-3062`** — Boutons modale (imprimer, fullscreen) à 32×32. Risque misclick mobile.
- **`css/style.css:1057-1079`** — Checkbox shopping à 22×22. À vérifier avec padding parent.

### Recommandation
Demander une capture d'écran des 4 zones suivantes pour analyse visuelle ciblée :
1. Vue Inventaire mobile (chips filtre)
2. Modale détail recette (tous les boutons header)
3. Vue Recettes IA (chips de configuration)
4. Bottom navigation en overlap avec une modale ouverte

---

## 🚫 Findings réfutés ou écartés par le Verifier

- **`js/app.js:1290`** | Agent Archi | **REFUTED** : claim "1290 > 1500" — vérifié `(Get-Content app.js).Count = 1290`, sous le seuil CLAUDE.md.
- **`js/app.js:463 — autoEmoji jamais utilisée`** | Agent Archi | **REFUTED** : utilisée ligne 463 dans `openEnhancedCartPicker` — `emoji: i.e || i.emoji || autoEmoji(i.n || i.name, CATEGORIES)`.
- **`js/app.js:160 — textContent risque XSS`** | Agent Sec | **FILTRÉ** : Confiance 42/100 sous le seuil de remontée.
- **`js/app.js:160-163 — data-emoji XSS`** | Agent Sec | **FILTRÉ** : Confiance 48/100 sous le seuil de remontée.
- **`js/app.js:851-852 — setFilter no validation`** | Agent Bugs | **REFUTED** : Le filtre vient exclusivement de boutons générés par `renderPantryFilters` avec valeurs contrôlées (CATEGORIES + 4 filtres spéciaux). Pas de surface d'attaque.

---

## 🧪 Désaccords inter-agents notables

**Aucun désaccord majeur détecté.** Les agents ont convergé sur les findings principaux (état partagé, manque de tests, pas de validation de schéma). L'absence de désaccord est un signal positif sur la solidité de l'architecture (rien d'extrême-controversé).

---

## 📊 Synthèse en 3 chiffres

- **15 findings P1** (TRACED, action recommandée)
- **8 hypothèses** dont 3 trade-offs by design (à documenter, pas à corriger)
- **30 zones visuelles suspectes** pour vérification humaine ultérieure
