# LOT 013 — Filet de tests UI — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — ouvert le 2026-07-30, **PRÉALABLE OBLIGATOIRE du LOT 014**
> **Branche :** `feat/lot13-filet-tests-ui`
> **Niveau d'audit : Standard** (relevé de Léger : le lot touche `index.html`, cf. §ÉCARTS)
> **Effort estimé :** ~2 journées
> **Version visée : 5.9** (avec le LOT 014)
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

## Critères d'acceptation

- [ ] **Matrice de couverture des acquis — LE critère central** : un tableau listant chaque
      acquis des **LOTS 005 à 015** (la fiche d'origine disait 005-012 : le 015 s'est
      intercalé) avec, en face, LE test qui le fige — ou la preuve navigateur documentée
      quand jsdom ne peut pas le prouver. **Aucune ligne vide.** Un nombre global de tests
      n'est PAS un critère de couverture. Base de travail : les **84 acquis** relevés en
      découverte.
- [ ] **≥ 30 nouveaux tests** (plancher, pas objectif) ; chaque fonction du tableau A actualisé
      couverte (happy path minimum)
- [ ] `generateId` non-flaky ; 2 modes d'échec Firebase neufs ; 3 réponses IA dégradées
- [ ] Aucun `.skip`/`.only` ; validation unifiée verte ; build OK
- [ ] Diff hors `tests/` **limité à l'ÉCART 1** (ajout d'attributs d'ancrage dans `index.html`
      et les renderers). Aucun changement de comportement, aucune extraction.
- [ ] Les défauts trouvés en écrivant les tests sont **consignés au backlog**, pas corrigés
- [ ] Audit **Standard** : audit du diff final (Gemini, questions fermées) + agents adversariaux
      locaux avec question de mutation obligatoire

## Traçabilité

- Fiche d'origine : `Backlog/BACKLOG - Filet de tests UI.md` (supprimée à la promotion —
  contenu intégralement repris) ; source `ULTRA_AUDIT_REPORT.md` P1 Tests
- Débloque : LOT 014 (prérequis dur)
- Défauts consignés par ce lot : `Backlog/BACKLOG - Durcissements import et panier.md` §5-§7
