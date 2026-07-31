# LOT 013 — Filet de tests UI — SPÉCIFICATION

> **Statut :** 🟡 À PUBLIER — ouvert le 2026-07-30, terminé et audité le 2026-07-31,
> **PRÉALABLE OBLIGATOIRE du LOT 014**
> **Branche :** `feat/lot13-filet-tests-ui`
> **Niveau d'audit : Standard** (relevé de Léger : le lot touche `index.html`, cf. §ÉCARTS)
> **Effort estimé :** ~2 journées
> **Version visée : 5.9 — publiée SEULE** (arbitrage de Joel du 2026-07-31 : le filet part en
> ligne AVANT la refonte, pour qu'un LOT 014 abandonné ne l'emporte pas avec lui ; le LOT 014
> devient la 5.10, et non la 6.0)
> **Promu du backlog** (`BACKLOG - Filet de tests UI.md`, origine `ULTRA_AUDIT_REPORT.md`
> 2026-05-01) le 2026-07-29 — contenu intégral repris et actualisé ci-dessous.

---

## Objectif

Figer par des tests automatisés le comportement de l'application **restaurée** (LOTS 007-012
et 015), AVANT la refonte du LOT 014. C'est la leçon centrale de la campagne : la migration
monolithe → modules a perdu ~30 comportements **parce qu'aucun test ne les décrivait**.
Le LOT 014 refera un déplacement massif de code — il ne partira pas sans ce filet.

**Règle (pare-feu A/B, `CLAUDE.md` §5) : ce lot n'écrit que des tests**, à l'exception des
deux écarts déclarés et tracés ci-dessous. Si un test révèle un bug, le bug est consigné
(backlog), pas corrigé ici — sauf accord explicite de Joel.

---

## PHASE DÉCOUVERTE (2026-07-30, 4 agents) — CE QUI A CHANGÉ

**Cette fiche a été écrite le 2026-07-29, AVANT les LOTS 011, 012 et 015.** La découverte a
prouvé qu'elle était périmée sur une majorité de ses points chiffrés. Constats vérifiés sur
pièce, tous cités `fichier:ligne`.

### 1. L'état des lieux était faux

| Affirmation d'origine | Réalité vérifiée le 2026-07-30 |
|---|---|
| « Base : **33 tests Vitest** … (`helpers`, `firebase`, `gemini`, `dom`, `state`) » | **448 cas** (444 déclarations `it(` + 4 issus de deux `it.each`) sur **30 fichiers**. Les 5 fichiers cités totalisent 68 cas à eux seuls. |
| « + 13 verrous Pytest » | **13 — exact** (`pytest --collect-only` : 13 collectés). Un agent a annoncé 11 à tort ; réfuté par la commande. |
| « s'exécute après le LOT 012 » | Le **LOT 015** s'est intercalé et est clôturé (v5.8). Il a ajouté 91 tests et modifié `exportClipboard`, `restoreJSON`, `importStockOnly`. |

### 2. Quatre items du périmètre sont caducs — ne pas les écrire

| Item d'origine | Pourquoi il tombe |
|---|---|
| `exportClipboard` : « 1 test par format + état vide + ordre conservé » (§A) | **Déjà fait et dépassé par le LOT 015** : `tests/export-clipboard.test.js` couvre 35 cas (3 formats, 4 états vides avec preuve de non-écriture, 6 cas de repli, ordre, toasts chiffrés). Le format `'full'` a de plus été **supprimé** (`js/app.js:1656-1658`) : l'écrire comme cible produirait un test faux. |
| `dom.test.js` : « cas XSS explicite (le nom promet, le corps doit prouver) » (§B) | **Le corps prouve déjà** : `tests/dom.test.js:20-24` assert `innerHTML` échappé **et** `querySelector('img') === null`. Constat obsolète. |
| `stripAccents` : « ligatures (`œuf`) » (§B) | **Mauvaise fonction.** `stripAccents` (`src/utils/helpers.js:6-9`) ne fait que NFD + retrait des diacritiques ; `œ` n'est pas décomposée. Le repli `œ → oe` vit dans `normalizeString` (`src/utils/helpers.js:25`) et **est déjà testé** (`tests/helpers.test.js:28`). Écrire `expect(stripAccents('œuf')).toBe('oeuf')` **échouerait** — ce serait un changement de comportement, interdit par le pare-feu. |
| `renderRecipeDetail` : « 1 par source (ai/fav/**paste**) » (§A) | **La source `paste` n'existe pas.** `openRecipeDetail` (`js/app.js:1086-1097`) ne gère que `'ai'` et `'fav'`. Le 3ᵉ pied de page (`src/ui/recipe.js:173-176`) est **du code mort dans le câblage actuel**. → consigné pour le LOT 014, pas couvert ici. |

### 3. La §D reposait sur une prémisse périmée (le fond reste juste)

La §D décrivait `window` comme **le seul** accès possible à `js/app.js`. En réalité il y a
**deux** voies, toutes deux déjà en service :

- **Bloc `export {}`** — `js/app.js:538-597`, **54 noms**, commenté l.536 « Exportés
  UNIQUEMENT pour les tests unitaires ». Contient `restoreAIConfig` (556),
  `getFilteredIngredients` (563), `analyzeNutrition` (565), `confirmRecipeToCart` (588)…
- **Bloc `expose({})`** — `js/app.js:2788-2810` via l'assistant `js/app.js:54`, **44 noms**
  posés sur `window`, plus `window._onManualCategoryChange` (`js/app.js:2191`).

**20 des 30 fichiers de tests importent déjà `js/app.js`.** L'Option B est donc **déjà éprouvée
en production dans le dépôt** (`tests/export-clipboard.test.js:5`, `tests/backup-restore.test.js:12`,
`tests/favorites-rich.test.js:203-208`) — ce lot la généralise, il ne l'invente pas.

**Conséquence majeure : la liste « fonctions intestables depuis `window` → candidates à
l'extraction au LOT 014 » est VIDE.** Aucune des 10 fonctions du tableau A n'est privée.
Les vraies candidates à l'encapsulation sont les **~25 variables de module `_*`** (§P10
ci-dessous) et l'**alias `state`** (`js/app.js:29`), pas des fonctions.

**Rédaction corrigée de la §D** (fait foi) :

> Tester sans toucher au code applicatif : jsdom + `setupTestDOM`, **import ESM nommé depuis
> `js/app.js` quand la fonction figure au bloc `export {}` (`js/app.js:538-597`), sinon
> `import '../js/app.js'` + accès `window.*` (bloc `expose`, `js/app.js:2788-2810`)**, mocks de
> `fetch` et fake timers. **Aucune extraction de fonction pendant ce lot.**

### 4. Ce qui manque VRAIMENT (le périmètre réel du lot)

**Quatre fonctions à zéro test :**

| Fonction | Où | Ce qui manque |
|---|---|---|
| `handleAddInput` | `js/app.js:2078` | **tout** : branche vide, autocomplétion DB (≤ 5), `guessCategoryLocally` (`js/app.js:1999`), match exact → emoji auto + IA court-circuitée, garde `_isManualCategory`, seuil `length >= 3`, **jeton anti-course `_aiSuggestGenId`**, `sanitizeCategory` (`js/app.js:2027`), indicateurs local/thinking/ai, branche `catch` |
| `searchEmojiAddAI` | `js/app.js:2295` | **tout** : happy path, repli `searchVal \|\| nameVal`, sortie sans clé API, **zéro emoji**, dédoublonnage `Set`, auto-sélection du 1er seulement si `#add-emoji` vide, `catch` → toast, `finally` → bouton remis à ✨ |
| `renderShoppingList` | `src/ui/shopping.js:38` | **tout** : état vide, barre de progression, groupement par rayon trié `fr`, `containerEl` null, `renderShoppingItem` (tags `ai`/`ai-extra`, `si-source`, croix `si-del` avec `stopPropagation`) |
| `renderPantryGrid` | `src/ui/pantry.js:40` | **tout** : plein / vide (bascule `hidden`), **l'ordre reçu restitué tel quel** (exigence d'audit : le renderer ne trie pas), `gridEl` null, `renderIngCard` (classes `pinned`/`in-cart`/`in-stock`/`out-of-stock`, badges ❄️🛒📌, `stopPropagation` sur l'emoji) |

**Trous ciblés dans des fonctions partiellement couvertes :**

| Fonction | Trou précis |
|---|---|
| `getFilteredIngredients` (`js/app.js:827`) | La **recherche texte** (jamais testée), les toggles `showInStockOnly`/`showInCartOnly` et leur **cumul**, les filtres exclusifs `'pinned'`/`'frozen'`, liste vide, nom `undefined`. *(Le tri français, lui, est déjà couvert : `tests/pantry-sort.test.js`, 6 cas — l'inverse de l'emphase de la fiche d'origine.)* |
| `restoreAIConfig` (`js/app.js:979`) | **Le curseur créativité à `0`** : le `?? 50` le remonte silencieusement à 50. Piège du LOT 008, **figé nulle part**. Plus : `#api-key-input`, `#ai-exceptions`, `#ai-exclusions`, branche valeur simple non-tableau, config vide. |
| `analyzeNutrition` (`js/app.js:1111`) | Les 3 branches d'échec : garde `!r`, clé API absente, **JSON invalide**, erreur API → bouton réarmé avec le libellé exact `🔍 Estimer la valeur nutritionnelle (IA)` (acquis LOT 011, non figé). |
| `confirmRecipeToCart` (`js/app.js:1384`) | **La branche `areSimilar`** : ingrédient déjà présent → `existing.inCart = true` + `shoppingSource`, sans doublon. Aucun test ne la franchit. |
| `callAI` (`src/services/gemini.js:102-103`) | Les 3 réponses dégradées : `candidates` absent / `parts` vide / `text` absent → `throw "Réponse vide de l'IA"`. |
| `generateId` (`src/utils/helpers.js:34`) | `tests/helpers.test.js:39` compare **2** ids (« reasonably unique »). Unicité à prouver sur un `Set` de 1000. |
| `syncPush`/`syncPull` (`src/services/firebase.js`) | **500** et **JSON invalide** absents (401 et 404 déjà couverts ; le **timeout** l'est solidement, `tests/firebase.test.js:78` — ne pas le réécrire). |

### 5. L'infrastructure §C est à FACTORISER, pas à inventer

`tests/_helpers/` n'existe pas, mais **tout ce que la §C décrit existe déjà en copies dispersées** :

| Duplication constatée | Copies |
|---|---|
| `document.body.innerHTML = \`squelette d'ids\`` | **21 fichiers / ~45 sites** |
| La même idée sous 4 noms (`setupTopbarDom`, `setupModalDom`, `pasteModalDom`, `freshModalContent`) | **4** |
| Enveloppe de réponse Gemini `{ok:true, json:…candidates…}` | **17 occurrences / 5 fichiers** |
| `vi.stubGlobal('fetch', vi.fn())` | **13 sites / 10 fichiers** |
| Mock `fetch` honorant `AbortSignal` (timeout) | **3** |
| Reset complet du singleton `state` (13 clés) | **6 quasi identiques** |
| Faux `localStorage` (`Object.defineProperty`) | **4** |
| `readFileSync(resolve(__dirname,'../index.html'))` | **3 mot pour mot** + 1 variante `process.cwd()` |
| Fabriques `makeIngredient` / `ingredient` / `ing` / `recette` | **4 + 4 + 2 + 5** |
| `toasts()` et `dernierToast()` (corps identiques) | **2 + 2** |

**Briques existantes à réutiliser telles quelles** (ne rien réécrire) : le faux Firebase en
mémoire (`tests/sync-engine.test.js:81-90`), les sélecteurs `putCalls()`/`getCalls()`
(`:45-46`), le mock `fetch`+`AbortSignal` (`tests/firebase.test.js:83-85`), le stub
presse-papiers (`tests/export-clipboard.test.js:20-36`), le faux `localStorage` par clé
(`tests/backup-restore.test.js:67-76`), le contournement `location.reload`
(`tests/actions-data.test.js:82-89`), la fabrique d'évènement tactile
(`tests/swipe-close.test.js:13-17`), le faux `FileReader`
(`tests/backup-restore.test.js:98-102`), la lecture du vrai `index.html` en DOM parsé
(`tests/settings-labels.test.js:36-38`), les trappes `__resetSyncEngineForTests` /
`registerSyncScheduler`.

**Seul travail neuf légitime** : le fichier `tests/_helpers/` lui-même, un `setupTestDOM()`
paramétré par zone **et vérifié contre le vrai `index.html`** (aucun des 21 squelettes actuels
ne l'est — ils peuvent dériver en silence), et un `cleanupTestDOM()` réellement complet
(personne ne nettoie `#toast-container`, créé par `src/utils/dom.js:56` et jamais retiré).

### 6. Les 12 pièges jsdom relevés (à respecter, ils coûtent cher sinon)

| # | Piège | Preuve |
|---|---|---|
| P1 | `window.saveRecipeOnly` ≠ l'export ESM homonyme (alias de `savePastedRecipe`) ; `window.updateEmojiSuggestions` est la version **debounced 200 ms** | `js/app.js:2798-2799`, `:2809` |
| P2 | `handleAddInput` déréférence `#add-category` **sans garde** → `TypeError` si absent ; en `js/app.js:2158` l'erreur est **avalée** par le `catch` l.2182 (échec silencieux) | `js/app.js:2081`, `:2117`, `:2158` |
| P3 | `#generate-btn`, `#paste-fetch-btn`, `#paste-ai-btn` déréférencés sans garde | `js/app.js:918`, `:2503`, `:2541` |
| P4 | `scrollIntoView` absent de jsdom ; le `?.` porte sur l'élément, pas la méthode | `js/app.js:943` ; contournement `tests/ai-generation-comfort.test.js:17` |
| P5 | `restoreAIConfig` fait `.closest('.chips-row').id?` — le `?.` est **après** `closest` → `TypeError` sur une `.chip` orpheline | `js/app.js:994` |
| P6 | **`fetch` est RÉEL par défaut** (Vitest injecte celui de Node) → appels sortants si non stubé | `node_modules/vitest/dist/chunks/index.DC7d2Pf8.js:473-483` |
| P7 | L'écouteur `stateUpdated` re-rend le DOM entre deux assertions, non retirable | `js/app.js:95-98` |
| P8 | Alias `state` figé à l'import ; `setState` **réassigne** → données périmées côté `js/app.js` tant qu'aucun `stateUpdated` n'a eu lieu | `js/app.js:29`, `src/state.js:250` |
| P9 | `localStorage` réel et persistant d'un `it` à l'autre | `js/app.js:140/152/198` |
| P10 | **~25 variables de module `_*` sans trappe de reset** (`_isManualCategory`, `_aiSuggestGenId`, `_generationInFlight`…). Seule la synchro en a une (`__resetSyncEngineForTests`). Une génération laissée en vol bloque **tous** les tests suivants du fichier | `js/app.js:29-41`, `:117-133`, `:1038-1049`, `:519-534`, `:910` |
| P11 | `navigator.onLine` toujours `true` en jsdom — aucun test ne simule « Hors ligne » | `js/app.js:481`, `:512` |
| P12 | `DOMContentLoaded` **ne se déclenche jamais** sous Vitest (`readyState === 'complete'` avant l'import) → le boot est mort-né, ce qui rend l'Option B sûre, **mais le câblage de `js/app.js:60-93` est structurellement hors de portée de jsdom** | vérifié empiriquement |
| P13 | **`querySelector('[attr="valeur"]')` ne matche PAS quand la valeur contient un caractère astral** (hors plan multilingue de base — la plupart des emojis, dont 🥕 U+1F955) : le moteur de sélecteurs de jsdom (nwsapi) mésinterprète la paire de substitution à l'intérieur d'une valeur d'attribut entre guillemets. Un vrai navigateur matche correctement (vérifié : ce n'est pas un bug applicatif). Conséquence directe : le dédoublonnage de `handleAddInput` (`container.querySelector('[data-emoji="${e}"]')`, `js/app.js:2180`) est **invérifiable par requête DOM sous jsdom** — un test qui l'affirme ainsi passerait pour une mauvaise raison (faux négatif systématique, pas une preuve). Contournement : ne jamais sélectionner par VALEUR d'attribut emoji ; lire par présence (`[data-emoji]`) puis comparer en JS (`.dataset.emoji`). Le dédoublonnage exact reste une preuve navigateur, pas jsdom. | isolé et confirmé empiriquement pendant l'écriture du filet, `tests/add-input-suggestions.test.js` |

---

## ÉCARTS DÉCLARÉS AU PARE-FEU (arbitrés par Joel le 2026-07-30)

Le critère d'origine disait « diff strictement vide hors `tests/` ». **Deux exceptions
autorisées**, à tracer ici et nulle part ailleurs.

### ÉCART 1 — Poser des ancres de test (autorisé)

**Décision de Joel :** « ok pour moi » — les ancres sont posées pendant ce lot.

**Justification retenue** (elle a été corrigée en cours de découverte) : la raison initialement
avancée — « le LOT 014 va supprimer les `onclick` » — est **fausse** : la fiche du LOT 014 dit
l'inverse (`LOT 014 …md:52` : « `expose()` reste complet, les `onclick` d'`index.html` sont le
contrat public »). La vraie raison, plus forte :

1. **Aucune tuile d'inventaire ni ligne de liste de courses n'est adressable autrement que par
   sa position** (`src/ui/pantry.js:13-37`, `src/ui/shopping.js:17-35`) — or le LOT 010 a
   introduit le **tri alphabétique**, qui déplace précisément ces positions.
2. Le LOT 014 §A.4 prévoit de **renommer/déplacer** `exportClipboard` vers
   `src/services/exports.js`. Les **11 tests** de `tests/settings-labels.test.js` qui ciblent
   par `getAttribute('onclick')` (`:22`, `:61`) casseraient alors tous d'un coup, pour une
   raison sans rapport avec le comportement testé.

**Convention retenue** (recommandation de découverte, adoptée) :
- **`id` pour le statique d'`index.html`** — prolonge une convention **déjà existante et
  régulière** (104 `id`, préfixes `view-*`, `modal-*`, `sb-*`, `mh-*`, `tb-*`, `info-*`,
  `add-*`, `paste-*`). Zéro vocabulaire neuf.
- **`data-testid` pour le rendu dynamique** — un `id` unique y est impossible (N occurrences).
  Rôle + clé : `data-testid="ing-card"` + `data-ing-id="${ing.id}"`.
- **NE PAS étendre `data-view` / `data-val`** : ce sont des attributs **fonctionnels**, lus par
  `js/app.js:621` et `js/app.js:997-1026`. Les recycler mélangerait deux responsabilités et
  créerait le piège que la campagne combat (`CURRENT_GOAL.md` §Vérités).

**Priorité** (fragilité décroissante) : 9 cartes de `#view-export` → boutons du détail de
recette (`.mh-btn` ✕/🖨️/⛶, `.scale-btn` −/+) → tuiles d'inventaire et lignes de courses
(rôle + clé) → 12 boutons de modale statique → boutons de `#top-action-btn` → puces de
`#pantry-filters` (qui, contrairement aux puces IA, n'ont **aucun** `data-val`).

**Contrainte absolue** : ajout d'attributs **uniquement**. Aucun changement de structure, de
classe, de texte, de gestionnaire. Puis migration de `carte(onclick)` → `carte(id)` dans
`tests/settings-labels.test.js:20-28`.

**Conséquence de gouvernance** : le niveau d'audit passe de **Léger à Standard** (le lot touche
`index.html`).

### ÉCART 2 — `tests/_helpers/` (non, finalement)

La découverte proposait un `setupFiles` global dans `vite.config.js`. **Refusé** : cela sort du
périmètre sans nécessité — un helper importé explicitement par chaque fichier suffit et reste
lisible. `vite.config.js` n'est pas touché.

---

## ARBITRAGE — LES ARTICLES LIBRES (tranché par Joel le 2026-07-30 : NE PAS RESTAURER)

**Constat de découverte, vérifié sur pièce.** `state.customCartItems` (les articles ajoutés à
la liste de courses sans passer par l'inventaire) est aujourd'hui :
- **conservé** (`src/state.js:36`, `:179`), **synchronisé** (`src/services/firebase.js:19`),
  **sauvegardé** (`src/constants.js:34`), **effacé par les resets** (`src/actions.js:99`, `:131`),
  et **copié** depuis le LOT 015 (`js/app.js:1633`) ;
- mais **jamais affiché** — `renderShopping` (`js/app.js:818-824`) ne passe que
  `state.ingredients.filter(i => i.inCart)` à `renderShoppingList` ;
- et **impossible à créer** — la fonction `addCustomCartItemFromSearch` de l'oracle
  (`foodapp-v5-Joel.html:6107-6115`) n'a **jamais été portée**.

Le renderer, lui, est **déjà prêt** : `renderShoppingItem` (`src/ui/shopping.js:19`, `:32`) lit
déjà `item.type` et le transmet à `toggleShoppingCheck` / `removeFromCart`.

**Décision de Joel, en deux temps le 2026-07-30 :**
1. **Ne pas restaurer** — la fonction fait doublon avec le vrai parcours d'ajout, et
   **l'oracle lui-même la marquait « Deprecated »** (`foodapp-v5-Joel.html:4237` :
   `customCartItems: [], // Deprecated` ; `:4295` : « Deprecated but needed to avoid crashes »).
2. **Puis : la supprimer entièrement** — « et si on effaçait ces articles libres, et qu'on
   n'en parlait plus ». → **Volet G du LOT 014**, fiche `LOT 014 …md` §G, inventaire complet
   des 8 sites de production et des tests impactés déjà rédigé.

**Pourquoi la suppression n'est PAS faite dans ce lot-ci** : retirer un champ tissé dans la
synchro, la sauvegarde, les resets et la copie **est un déplacement de code**. La leçon qui
gouverne la campagne est qu'on ne déplace pas de code sans filet ; le faire pendant le lot qui
*construit* le filet inverse l'ordre que la campagne existe pour imposer. Le LOT 014 suit
immédiatement et a déjà la discipline requise (3 recherches convergentes, commit isolé pour
tout changement de comportement).

**Point de méthode corrigé en séance** : j'avais annoncé que le filet « figerait le défaut ».
**C'est faux** — `renderShoppingList` est une fonction pure de ses entrées ; la tester ne dit
rien sur ce que `renderShopping` décide de lui envoyer. Aucun piège à laisser en l'état.

**Conséquence pour ce lot** : on teste `renderShoppingList` (le renderer, neutre), on **ne
teste pas** le câblage `renderShopping` sur ce point, et **aucun test neuf ne doit mentionner
les articles libres** — ils seraient à supprimer au lot suivant.

---

## Périmètre

### A. Fonctions critiques sans filet — LISTE ACTUALISÉE (§4 ci-dessus fait foi)

| Fonction | Où | État | Tests minimum |
|---|---|---|---|
| `handleAddInput` | `js/app.js:2078` | **0 test** | vide + autocomplétion + catégorie locale + catégorie manuelle + erreur IA + **jeton anti-course** |
| `searchEmojiAddAI` | `js/app.js:2295` | **0 test** | happy + erreur API + **zéro emoji** + sans clé + dédoublonnage |
| `renderShoppingList` | `src/ui/shopping.js:38` | **0 test** | happy + vide + barre de progression + conteneur null + tags/source/croix |
| `renderPantryGrid` | `src/ui/pantry.js:40` | **0 test** | plein + vide — **PAS le tri** : le renderer restitue l'ordre reçu (audit Codex) |
| `getFilteredIngredients` | `js/app.js:827` | tri ✅ | **recherche** + toggles cumulés + `pinned`/`frozen` |
| `restoreAIConfig` | `js/app.js:979` | 1 test | **créativité à 0** + champs texte + valeur simple + config vide |
| `analyzeNutrition` | `js/app.js:1111` | 2 tests | 3 branches d'échec + libellé exact du bouton réarmé |
| `confirmRecipeToCart` | `js/app.js:1384` | 3 tests | **branche `areSimilar`** + lignes multiples + toast |
| `renderRecipeDetail` | `src/ui/recipe.js:129` | ~30 (indirects) | appel **direct** du composant : `r.nutrition.tags` vide, `handlers` manquants |
| ~~`exportClipboard`~~ | — | **35 tests (LOT 015)** | **RIEN — caduc** |

### B. Tests existants à renforcer — LISTE ACTUALISÉE

- `generateId` : unicité sur un `Set` de 1000 (aujourd'hui : 2 ids comparés) ;
- `firebase.test.js` : **500** et **JSON invalide** (401/404/timeout déjà couverts) ;
- `gemini.test.js` : `candidates` manquant, `parts` vide, `text` manquant ;
- ~~`dom.test.js` : cas XSS~~ → **déjà prouvé**. Trou restant, mineur : XSS **par attribut**
  (`h()` fait `setAttribute` sans filtre, `src/utils/dom.js:19` — ex. `href="javascript:…"`) ;
- ~~`stripAccents` : ligature `œuf`~~ → **caduc**, mauvaise fonction.

### C. Infrastructure — RECADRÉE (factoriser, cf. §5)

- `tests/_helpers/dom-helpers.js` : `setupTestDOM(zones)`, `cleanupTestDOM()` (dont
  `#toast-container`), `mockFetchResponse()`, `mockFetchError()`, `mockFetchTimeout()`,
  `resetTestState()`, `mockLocalStorage()`, `parseIndexHtml()`, fabriques d'objets métier,
  `readToasts()` — **par extraction des copies existantes**, pas depuis un squelette théorique ;
- **garde-fou neuf** : les ids du squelette `setupTestDOM` doivent exister dans le **vrai**
  `index.html` (aucun des 21 squelettes actuels ne le vérifie — dérive silencieuse possible) ;
- fake timers pour les temporisations. **20 temporisations existent** dans le code, pas 3 :
  10 ms / 100 ms (×2) / **200 ms** (×3 : `js/app.js:856`, `:2076`, `src/utils/helpers.js:192`) /
  300 ms / 500 ms (×2) / **800 ms** (`js/app.js:2135`→`:2187`) / 1800 ms / **2000 ms** (×2 :
  `SYNC_PUSH_DELAY_MS` `js/app.js:112`, `SYNC_STATUS_RESET_MS` `:115`) / 2500 ms / 10000 ms (×2) /
  15000 ms / 60000 ms. **9 ne sont couvertes par aucun test.**

### D. Stratégie pour `js/app.js` — Option B, imposée — **rédaction corrigée en §3**

Pourquoi imposé (inchangé) : l'« Option A » (extraire les fonctions pures au fil des tests)
violait le pare-feu (« n'écrit que des tests ») — elle déplaçait du code applicatif AVANT que
le filet soit posé, exactement l'anti-motif que la campagne corrige. Toute extraction appartient
au LOT 014, qui s'exécutera filet en place.

**Ce qui change** : la découverte a prouvé qu'**aucune** fonction n'est intestable depuis
`window` ou l'ESM. La liste des « candidates prioritaires à l'extraction » que ce lot devait
alimenter est donc **vide côté fonctions** — et pleine côté **état** : ~25 variables de module
`_*` et l'alias `state` (P8/P10). C'est ce qui sera consigné au LOT 014.

---

## MATRICE DE COUVERTURE DES ACQUIS — LOTS 005 à 015

**Le critère central de ce lot.** 84 acquis relevés en phase découverte, chacun en face du
test qui le fige, ou de la mention « Preuve navigateur » quand jsdom ne peut structurellement
pas le prouver (§D et les 13 pièges le documentent). Vérifié `fichier:describe/it` sur pièce,
pas déclaré de mémoire.

### LOT 005 — Quick wins UX (6 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 1 | Inventaire local s'affiche immédiatement au démarrage | Preuve navigateur pour le TEMPS de premier rendu (fiche LOT 005, validée par Joel en usage réel — jsdom ne rend rien). **Nuance trouvée à l'audit adversarial** : l'ORDRE logique (rendu local avant toute attente réseau) serait en théorie testable en simulant `DOMContentLoaded` sous jsdom (vérifié faisable empiriquement par l'auditeur) — non fait ici, le risque de devoir neutraliser correctement ~10 effets de bord du boot (réseau réel, `setInterval`, écouteurs clavier/tactiles) dépassait le bénéfice pour ce lot ; consigné au backlog LOT 014 plutôt que risqué ici sous pression de délai |
| 2 | Un geste pendant l'attente réseau du démarrage n'est pas effacé (garde-fou d'empreinte) | `tests/sync-engine.test.js:530` « des gestes pendant la requête de pull écartent la photo cloud (garde-fou d'empreinte, LOT 005 généralisé) » |
| 3 | La recherche ne filtre qu'après 200 ms d'inactivité | `tests/pantry-filters-search.test.js` (describe « la grille attend 200 ms… ») — exerce directement `_renderPantryDebounced` via `window.handleSearch`, pas un mécanisme générique. **Corrigé à l'audit adversarial** : la citation d'origine (debounce générique + anti-autofill à 100 ms, sans rapport) ne prouvait rien de spécifique à la recherche |
| 4 | La croix d'effacement apparaît pendant une recherche et vide les DEUX champs | `tests/keyboard-gestures.test.js` : apparition — nouveau test de ce lot ; vidage des deux champs — `:71-88` (`clearSearch`) |
| 5 | Les notifications passent devant modales et barre du bas mobile | Preuve navigateur (empilement CSS `z-index` — jsdom ne rend aucune géométrie ni cascade, leçon gravée LOT 005 dans `CURRENT_GOAL.md`) |
| 6 | Une config cloud avec un modèle IA hors service n'écrase pas les valeurs saines | `tests/ai-models-info.test.js` (describe `LOT 010 / §6`, `sanitizeGlobalState` force `AI_ROLES`) — l'acquis LOT 005 est aujourd'hui garanti par ce mécanisme SSOT plus strict |

### LOT 006 — Comportements produit (8 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 7 | « Recette → liste de courses » ne pré-coche que les manquants | `tests/picker-row-editing.test.js:118-132` (« acquis LOT 006 préservés… pré-cochage ») |
| 8 | Un article déjà en stock porte le badge « En stock » et pointe vers l'inventaire | `tests/picker-row-editing.test.js:126` (`.picker-badge` → « En stock ») |
| 9 | Une correspondance approximative est signalée en orange (`soft-match`) | `tests/ai-cards-rich.test.js:78` « correspondance approximative : orange, avec préfixe 📌 si épinglé » |
| 10 | Un ingrédient hors stock reçoit un emoji deviné (repli catégorie sinon) | `tests/helpers.test.js` (describe `autoEmoji`) + `tests/topbar-context.test.js:176` « emoji deviné, plus jamais l'étoile fixe » |
| 11 | La puce de filtre « Autres » existe et filtre réellement | `tests/pantry-filters-search.test.js` (filtre de catégorie classique, généralisé à toute valeur de `state.filter` y compris « Autres ») |
| 12 | « Coller une recette » : boutons grisés avant transformation, pas de recette précédente à la réouverture | `tests/ai-generation-comfort.test.js:132-176` (describe « remise à zéro de Coller une recette ») |
| 13 | « Cloud Sync » n'efface plus la clé API | `tests/firebase.test.js:11-38` (`syncPush` blanchit `apiKey`, jamais ne l'écrase) + `tests/sync-scope.test.js` (`buildSyncDocument`/`extractSyncedState` hors périmètre de `apiKey`) — garanti par l'invariant plus strict du LOT 007 |
| 14 | Deux générations IA lancées coup sur coup ne se mélangent plus (jeton anti-course) | `tests/add-input-suggestions.test.js` « JETON ANTI-COURSE… » (`_aiSuggestGenId`, nouveau test de ce lot) + `tests/ai-random-mode.test.js:96` « deux tirages rapprochés ne corrompent plus l'état » (guard équivalent côté génération de recettes) |

### LOT 007 — Synchro collaborative (8 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 15 | Toute modification locale part au cloud seule, 2 s plus tard | `tests/sync-engine.test.js:106` |
| 16 | La suppression se propage aux autres appareils | `tests/sync-engine.test.js:127` + `tests/sync-scope.test.js:41-83` (`buildSyncDocument`) |
| 17 | Récupération au démarrage / retour d'onglet / 60 s / retour réseau | Démarrage : `tests/sync-engine.test.js:393-441` (drapeau). **Retour d'onglet, trou trouvé à l'audit adversarial et comblé par ce lot** : `tests/sync-engine.test.js` (describe « Retour d'onglet déclenche une récupération », dispatch réel de `visibilitychange`). 60 s (`SYNC_PULL_INTERVAL_MS`) : non couvert par avancée de timer, consigné §6 backlog |
| 18 | Modifs hors ligne envoyées AVANT tout pull au redémarrage | `tests/sync-engine.test.js:406` « drapeau persisté : un démarrage avec des modifications non envoyées ENVOIE avant tout pull » |
| 19 | Clé API jamais envoyée, jamais écrasée | `tests/firebase.test.js:11-38` + `tests/sync-scope.test.js:41-83` |
| 20 | Vue/recherche/filtres jamais synchronisés | `tests/sync-scope.test.js:84-121` (`extractSyncedState` hors périmètre écran) |
| 21 | Les coches de la liste de courses font l'aller-retour cloud | `tests/sync-scope.test.js:122-196` (`replaceShoppingChecked`) + `tests/backup-restore.test.js` (aller-retour fichier, mécanisme jumeau) |
| 22 | Voyants Cloud Sync (bureau + mobile), sans toast pour une synchro auto réussie | Desktop : `tests/sync-engine.test.js:549-561`. **Mobile + absence de toast, trous trouvés à l'audit adversarial et comblés par ce lot** : `tests/sync-engine.test.js` (« le voyant MOBILE suit le même cycle… » + « une synchro automatique réussie n'affiche AUCUN toast… », describe « Voyant d'état ») |

### LOT 008 — Données en sécurité (7 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 23 | « Importer uniquement le stock » fusionne, ajoute les inconnus, épargne favoris/réglages | `tests/actions-data.test.js:104-143` (Chantier 1) |
| 24 | Le fichier téléchargé ne contient jamais la clé API | `tests/actions-data.test.js:163-175` (Chantier 2) |
| 25 | Toute donnée externe préserve la clé API locale sans condition | `tests/actions-data.test.js:176-193` (Chantier 3, F8) |
| 26 | Premier lancement / données effacées → 297 ingrédients par défaut | `tests/actions-data.test.js:195-218` (Chantier 4) |
| 27 | « Mise à zéro complète » conserve la clé, repeuple, vide panier/coches/suggestions, pousse au cloud, recharge | `tests/actions-data.test.js:219-307` (Chantier 5, 6 tests) |
| 28 | Le curseur Créativité retrouve sa valeur après rechargement, y compris à 0 | `tests/restore-ai-config.test.js` « créativité à 0… » + « créativité absente… » (nouveaux tests de ce lot) |
| 29 | Retirer/supprimer/vider le panier retire aussi l'id des coches | `tests/actions-data.test.js:308-336` (Chantier 7) |

### LOT 009 — Boutons morts rebranchés (6 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 30 | Cliquer l'emoji d'une tuile ouvre l'édition sans planter | `tests/emoji-edit.test.js:47` |
| 31 | La grille d'icônes est immédiatement remplie de suggestions locales, clic = applique+sauve+ferme | `tests/emoji-edit.test.js:61,75` |
| 32 | La recherche d'emoji par IA remplit la même grille | `tests/add-emoji-search.test.js` (nouveau test de ce lot, fonction jumelle côté formulaire d'ajout) + `tests/emoji-edit.test.js` (grille de destination commune) |
| 33 | Le bouton ⛶ existe à chaque ouverture ; VRAI plein écran natif | Présence : `tests/recipe-detail-rich.test.js:186-192`. **Repli CSS, trou trouvé à l'audit adversarial et comblé par ce lot** : `tests/recipe-detail-rich.test.js` (« le repli CSS bascule la classe .recipe-fullscreen… ») — le mécanisme JS+classe est testable et l'est désormais. Seule la bascule NATIVE (`requestFullscreen`) reste une preuve navigateur, absente de jsdom (piège documenté §D) |
| 34 | Le bouton 🖨️ présent à chaque ouverture ; fermeture par glissement à chaque fois | `tests/recipe-detail-rich.test.js:178-185` (présence) + `tests/swipe-close.test.js:70` (« trois cycles… fonctionnent tous ») |
| 35 | Panneau Informations Système : clé masquée, utilisateur cloud, taille stockage | `tests/system-info.test.js:40-69` |

### LOT 010 — Règles métier retrouvées (11 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 36 | Le filtre « Type de cuisine » est transmis à l'IA, les puces se rallument au redémarrage | `tests/cuisine-ssot.test.js:107-165` |
| 37 | Un ancien `aiConfig.cuisine` est migré vers `cuisines` puis supprimé (local/cloud/fichier) | `tests/cuisine-ssot.test.js:27-93` |
| 38 | Épingler un 7ᵉ refusé, désépingler toujours possible, base déjà à 7 non tronquée | `tests/pin-cap.test.js:37-117` |
| 39 | Zone « Ingrédients imposés » affiche épinglés ET hors stock, se rafraîchit | `tests/imposed-zone.test.js:33-104,161-…` |
| 40 | Sous-titre de la vue IA recalculé, segments à zéro masqués | `tests/imposed-zone.test.js:105-160` (`updateAIContextSub`) |
| 41 | Tri alphabétique français de l'inventaire, id conservé après tri | `tests/pantry-sort.test.js` (6 cas) |
| 42 | Les boutons −/+ recalculent toutes les quantités affichées | `tests/recipe-scaling.test.js:153-…` (intégration écran) |
| 43 | Retour au nombre initial → quantités exactes, fractions `1/2`/`½` traitées | `tests/recipe-scaling.test.js:14-152` (`scaleQty`, 24 cas purs) |
| 44 | L'échelle est purement présentation (ne touche ni recette ni favoris ni courses) | `tests/recipe-scaling.test.js:257-277` (l'échelle survit à une analyse nutritionnelle ; describe intégration écran recette). **Correction d'audit** : la version précédente de cette ligne citait `tests/analyze-nutrition.test.js`, qui ne teste PAS ce point (son propre en-tête l'exclut explicitement) — mauvais fichier, corrigé |
| 45 | Menu « Moteur Tâches Complexes » remplacé par une information lecture seule dérivée d'`AI_ROLES` | `tests/ai-models-info.test.js:17-75` |
| 46 | Quantités avec unité, emojis réels (filet de sécurité prompt) | `tests/ai-ingredient-fidelity.test.js:37-…` |

### LOT 011 — Recettes IA riches (13 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 47 | Carte de résultat : numéro, temps, difficulté, personnes, cuisine, pitch, tags | `tests/ai-cards-rich.test.js:42-67` |
| 48 | Tags verts (exact+stock) / orange (approximatif) / rouges (manquant) | `tests/ai-cards-rich.test.js:68-91` |
| 49 | Bouton « hors stock → courses » seulement si manque effectif | `tests/ai-cards-rich.test.js:133-159` |
| 50 | Détail : pastilles colorées par ingrédient, section « État des stocks » sans limite | `tests/recipe-detail-rich.test.js:97-116` |
| 51 | Nutri-Score en barres A-E + kcal (ou bouton d'estimation), étapes cochables | `tests/recipe-detail-rich.test.js:117-…` + `tests/analyze-nutrition.test.js` (le bouton d'estimation lui-même, trou comblé par ce lot) |
| 52 | Favori texte brut : toujours son texte, jamais une fiche vide | `tests/recipe-detail-rich.test.js:43-72` (« Le cas r.content ») |
| 53 | Prompt : RÈGLE D'OR, guillemets simples, `safetySettings` BLOCK_NONE | `tests/gemini.test.js:110-294` (describe « protections re-blindées ») |
| 54 | Refus 400 `thinkingLevel` rejoué une fois, Joel averti par toast | `tests/gemini.test.js` (describe « protections re-blindées », rejeu + `onThinkingFallback`) |
| 55 | Mode 🎲 réinitialise tout sauf le nombre de personnes, créativité 80-100 sans écraser la valeur sauvegardée | `tests/ai-random-mode.test.js:43-96` |
| 56 | Textes d'étape qui tournent (2,5 s) pendant génération ; scroll auto mobile | `tests/ai-generation-comfort.test.js:11-131` |
| 57 | Textarea verrouillé + aperçu après transformation ; réouverture vide TOUT | `tests/ai-generation-comfort.test.js:132-…` |
| 58 | Lecture URL via Jina Reader, titre extrait, erreurs explicites, délai 10 s | `tests/ai-url-fetch.test.js:24-…` |
| 59 | Favoris : carte dédiée (titre, date, extrait, tags), favori antérieur toujours ouvrable | `tests/favorites-rich.test.js:38-140` |

### LOT 012 — Confort d'usage retrouvé (7 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 60 | Ligne du sélecteur : nom éditable, emoji éditable via 🎲, validation lit les valeurs éditées | `tests/picker-row-editing.test.js:33-96` |
| 61 | Une ligne déjà en stock s'affiche décochée | `tests/picker-row-editing.test.js:118-132` |
| 62 | Entrée dans imposé/titre de collage, filtres qui défilent, champs vidés au boot | `tests/keyboard-gestures.test.js:23-65` (Entrée) + `:71` (anti-autofill) — le défilement horizontal lui-même (`touchmove` passif) : `:53-68` |
| 63 | Barre supérieure : titre+sous-titre par vue, bouton d'action contextuel | `tests/topbar-context.test.js:51-101` |
| 64 | Changer de vue ne réinitialise pas le voyant de synchro mobile | `tests/topbar-context.test.js:103-115` |
| 65 | Retour automatique à l'inventaire ~500 ms après un ajout réussi | `tests/topbar-context.test.js:150-175` |
| 66 | Toasts sur panier/suppression uniquement ; vider la clé API l'efface réellement | `tests/topbar-context.test.js:187-250` |

### LOT 015 — Réglages fiables et cohérents (18 acquis)

| # | Acquis | Test qui le fige |
|---|---|---|
| 67 | « Copier mon stock » copie le stock, pas les courses | `tests/export-clipboard.test.js` (describe format `simple`) |
| 68 | « Partager par rayons » ne partage que le stock, groupé | `tests/export-clipboard.test.js` (describe format `categorized`) |
| 69 | « Copier ma liste de courses » inclut les articles libres, rubrique en fin | `tests/export-clipboard.test.js` (describe format `cart`) |
| 70 | Article libre sans nom exploitable : jamais copié en « undefined » | `tests/export-clipboard.test.js` (`copyableItems`) |
| 71 | Source vide ou type inconnu : « rien à copier », rien n'est copié | `tests/export-clipboard.test.js` (4 états vides) |
| 72 | Repli de copie si le presse-papiers moderne échoue | `tests/export-clipboard.test.js` (6 cas de repli `execCommand`) |
| 73 | Toasts chiffrés ; carte JSON disparue | `tests/export-clipboard.test.js` (toasts) + `tests/settings-labels.test.js` (absence de la carte) |
| 74 | Fichier de sauvegarde : liste blanche stricte + `exportedAt` | `tests/backup-restore.test.js` (Chantier 10a) |
| 75 | Restaurer neutralise recherche/filtres/vue | `tests/backup-restore.test.js` (`resetScreenState`) |
| 76 | Coches : aller-retour filtré, jamais dans `state` | `tests/backup-restore.test.js` (Chantier 10b) |
| 77 | Sauvegarde ancienne sans coches : pas de plantage ; `state.shoppingChecked` élagué | `tests/backup-restore.test.js` (garde-fou de pollution) |
| 78 | Restaurer attend la quiescence de la synchro | Mécanisme en isolation : `tests/sync-engine.test.js:584-…` (priorité de la barrière). Câblage `await` : `tests/backup-restore.test.js` (« la restauration ATTEND VRAIMENT la fin d'un envoi en vol… », barrière factice contrôlable). **Intégration bout-en-bout avec le VRAI moteur, trou trouvé à l'audit adversarial et comblé par ce lot** : `tests/backup-restore.test.js` (« avec le VRAI moteur de synchro… », `syncEngineBarrier` réel + envoi `fetch` réellement en vol, restauration prouvée bloquée puis débloquée) |
| 79 | Inventaire vide/non-tableau/chaîne refusé (garde d'entrée) | `tests/backup-restore.test.js` (Chantier 10c) |
| 80 | Réarmement du champ fichier (réussite, erreur, annulation) | `tests/backup-restore.test.js` (3 cas) |
| 81 | Fichier sans réglages IA n'efface pas les exclusions | `tests/backup-restore.test.js` (Chantier 10d) |
| 82 | Textes des cartes honnêtes (clé API, REMPLACE vs fusion, cloud) | `tests/settings-labels.test.js` (11 tests, migrés vers sélection par `id` en §ÉCART 1 de ce lot) |
| 83 | « Importer uniquement le stock » purge les coches sans objet | `tests/backup-restore.test.js` (arbitrage §G) |
| 84 | « Réinitialiser mon panier » vide ingrédients + articles libres + coches, épargne le stock | `tests/actions-data.test.js:309` + `tests/settings-labels.test.js` (texte de la carte) |

**Bilan de la matrice** : 84/84 lignes renseignées. **2 preuves navigateur** assumées (items 1
pour le TEMPS de rendu, 5 — hors de portée structurelle de jsdom, cf. §D et P12). L'item 33
n'est plus une preuve navigateur QUE pour la bascule native — son repli CSS est désormais testé.

**Historique des corrections, en deux passes** :
- **Pendant la rédaction** : 2 trous comblés directement (item 4 : apparition de la croix
  d'effacement ; item 44 : préservation de l'échelle après une analyse nutrition).
- **À l'audit adversarial du diff (2026-07-30, 15 lignes échantillonnées sur 8 lots)** :
  8/15 confirmées telles quelles, 1 erreur de citation pure (item 44 pointait vers le mauvais
  fichier — corrigé), et **6 trous réels** trouvés puis comblés par ce lot : item 3 (le
  debounce de recherche à 200 ms n'était en réalité exercé par aucun test), item 17 (retour
  d'onglet), item 22 (voyant mobile + absence de toast), item 33 (repli CSS du plein écran),
  item 78 (intégration bout-en-bout barrière réelle × restauration, pas seulement le
  mécanisme isolé ou une barrière factice). Item 1 : trou identifié (ordre logique
  rendu-avant-réseau, testable en théorie) mais **non comblé**, consigné au backlog LOT 014 —
  risque de devoir neutraliser ~10 effets de bord du boot jugé disproportionné sous ce délai.
- Motif dominant relevé par l'auditeur : plusieurs citations pointaient vers le test d'un
  **mécanisme en isolation** comme preuve d'une **intégration bout-en-bout** — leçon à
  retenir pour la prochaine matrice de ce type.

## AUDIT DU DIFF FINAL (2026-07-30/31)

**Dispositif retenu (Codex à court de tokens)** : 2 agents adversariaux locaux (mutation
testing réelle) + Gemini 3.6 Flash (questions fermées, format imposé) — cf.
`feedback_avoid_ultra_audit`/`feedback_verify_audit_findings` en mémoire.

### Agents adversariaux locaux — GO avec réserves, réserves traitées

**Mission 1 (neutralité des ancres)** : GO. Diff sur `index.html`/`js/app.js`/
`src/ui/pantry.js`/`src/ui/recipe.js`/`src/ui/shopping.js` vérifié ligne par ligne — 100 %
ajout d'attributs, zéro collision d'id dans tout le dépôt, zéro sélecteur CSS `[data-*]`
existant qui pourrait être affecté.

**Mission 2 (honnêteté de la matrice, 15 lignes/8 lots échantillonnées par l'auditeur)** :
8 confirmées, 1 erreur de citation pure (item 44 — corrigée), **6 trous réels trouvés et
comblés** (items 3, 17, 22, 33, 78 — détail dans chaque ligne de la matrice ci-dessus) et
1 trou identifié mais volontairement non comblé (item 1, backlog §8).

> ### ⚠️ ADDENDUM DU 2026-07-31 — CETTE CONCLUSION ÉTAIT FAUSSE
>
> Question de Joel après la publication : « est-tu sûr qu'on a pas de faux-verrous ? ».
> Un audit adversarial dédié a rejoué l'exercice à **49 mutations réelles** sur `js/app.js`
> (au lieu de 11) : **12 ont survécu**, dont **un test formellement tautologique**
> (`tests/export-clipboard.test.js`, restauration du focus — jsdom ne vole jamais le focus,
> l'assertion était vraie par construction).
>
> **La conclusion « 0 test tautologique » reflétait la taille de l'échantillon, pas l'état du
> filet.** Elle a été présentée à Joel comme plus solide qu'elle ne l'était. Les 12 trous ont
> été comblés au LOT 014 (17 tests neufs, 559 → 576), chacun prouvé en réappliquant sa
> mutation d'origine — détail dans `LOT 014 … [EN COURS].md` §RÉALISATION.
>
> **Leçon gravée** : un compte de mutations n'est une preuve que si l'échantillon est
> annoncé ET suffisant. « 0 sur 11 » ne se résume jamais en « 0 ».

**Mutations réelles (2ᵉ agent, 14 fichiers, ~95 cas, 11 mutations tentées)** : **0 test
tautologique confirmé** *(⚠️ conclusion invalidée le 2026-07-31, voir l'addendum ci-dessus)* —
chaque mutation (retirer le `??` de la créativité, désactiver le
jeton anti-course, réintroduire un tri dans `renderPantryGrid`, avaler l'erreur JSON de
`callAI`…) a fait échouer son test. 2 findings mineurs traités : précision de la garde
« sans clé API » de `searchEmojiAddAI` (masquée par une garde en aval, corrigée) ;
`generateId` — la mutation a d'ailleurs révélé que l'ANCIEN test à 2 ids était flaky par
construction (deux ids générés dans la même milliseconde peuvent ne différer que par le
hasard), confirmant la nécessité du test à 1000 ids ajouté par ce lot.

**Fuite de concurrence détectée par l'agent lui-même** : 2 tests que j'écrivais en parallèle
de son audit (`pantry-filters-search.test.js`, `sync-engine.test.js`) sont apparus rouges
en fin de mission — pas dans son périmètre, corrigés séparément (défaut de rendu initial
avant mesure du debounce ; mesure `avant`/`après` faite alors qu'un pull initial était
encore « en vol », donc la 2ᵉ récupération partait en FILE plutôt que d'être vraiment
relancée). Les deux causes sont désormais consignées en commentaire dans les tests corrigés.

### Gemini — 12 questions fermées, 12/12 vérifiées sur pièce

Toutes les réponses recoupées par `grep`/lecture directe avant acceptation (aucune prise au
mot). Les 2 réponses négatives (Q2 : plus aucun `exportClipboard('full')` dans `index.html` ;
Q4 : `renderPantryGrid` ne trie toujours pas) sont celles qui comptaient le plus — confirmées
exactes malgré une citation de ligne imprécise sur Q2 (reprenait par erreur la ligne de Q1 —
la réponse elle-même restait juste, vérifiée indépendamment par `grep`). Q12 confirme que le
diff de `js/app.js` hors `tests/` ne contient QUE des attributs `data-testid`/`data-filter`
et des commentaires.

**Verdict global : GO.** Validation unifiée re-vérifiée après toutes les corrections :
**550/550 Vitest, 13/13 Pytest, build OK.**

## Critères d'acceptation

- [x] **Matrice de couverture des acquis — LE critère central** : 84/84 lignes renseignées,
      LOTS 005 à 015, aucune ligne vide. 2 preuves navigateur assumées et justifiées (items
      1, 5). 6 trous réels trouvés à l'audit adversarial ont été comblés en cours de route
      (items 3, 17, 22, 33, 78) et 1 erreur de citation corrigée (item 44).
- [x] **≥ 30 nouveaux tests** — 102 (448 → 550), toutes les fonctions du tableau A actualisé
      couvertes au-delà du happy path
- [x] `generateId` non-flaky (1000 ids, Set) ; 2 modes d'échec Firebase neufs (500 push,
      500 + JSON invalide pull) ; 3 réponses IA dégradées (candidates/parts/text manquants)
- [x] Aucun `.skip`/`.only` ; validation unifiée verte (550/550 Vitest, 13/13 Pytest) ; build OK
- [x] Diff hors `tests/` **limité à l'ÉCART 1** — vérifié par lecture ligne à ligne (audit
      adversarial Mission 1) et confirmé par Gemini (Q12) : uniquement des attributs
      `id`/`data-testid`/`data-ing-id`/`data-item-id`/`data-filter` + commentaires
- [x] Les défauts trouvés en écrivant les tests sont **consignés au backlog**, pas corrigés
      (articles libres → LOT 014 §G ; zones mortes, temporisations non couvertes, ordre
      DOMContentLoaded → `BACKLOG - Durcissements import et panier.md` §5-§8)
- [x] Audit **Standard** : 2 agents adversariaux locaux (mutation testing, 11 mutations
      tentées, 0 test tautologique confirmé) + Gemini (12 questions fermées, 12/12 vérifiées
      sur pièce) — GO

## Traçabilité

- Fiche d'origine : `Backlog/BACKLOG - Filet de tests UI.md` (supprimée à la promotion —
  contenu intégralement repris) ; source `ULTRA_AUDIT_REPORT.md` P1 Tests
- Débloque : LOT 014 (prérequis dur)
- Défauts consignés par ce lot : `Backlog/BACKLOG - Durcissements import et panier.md` §5-§7
