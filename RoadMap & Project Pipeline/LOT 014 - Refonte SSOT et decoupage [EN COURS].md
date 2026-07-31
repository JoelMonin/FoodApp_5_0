# LOT 014 — Refonte SSOT et découpage — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — ouvert le 2026-07-31, DERNIER lot de la campagne
> **Branche :** `feat/lot14-refonte-ssot` (ouverte depuis `main` après publication du 5.9)
> **Niveau d'audit : DUR** — refonte transverse, touche le moteur d'état
> **Effort estimé :** ~2-3 journées · **Version visée :** 5.10 (le LOT 013 a pris la 5.9 en
> partant seul — arbitrage de Joel du 2026-07-31, cf. `ROADMAP.md` §Historique)
> **Fusion de 3 fiches backlog promues le 2026-07-29** : `Decoupage app.js et style.css` +
> `Alias state fragile` + `Validation des donnees externes` (contenus repris ci-dessous) +
> volet SSOT demandé par Joel.

---

## Objectif

L'app restaurée fonctionne à 100 % (LOTS 007-012) et son comportement est figé par les tests
(LOT 013). Ce lot rend le code **propre, SSOT partout, facile à comprendre et à maintenir** —
la demande de fond de Joel — SANS changer un seul comportement observable.

**Pare-feu A/B absolu (`CLAUDE.md` §5) : zéro changement de comportement.** Chaque étape se
termine par la validation unifiée verte. Toute envie de « corriger en passant » = fiche
backlog, pas de code.

**⚠️ La leçon qui gouverne ce lot : la dernière réorganisation massive de ce code (la
migration Vite) a perdu ~30 comportements.** D'où : LOT 013 obligatoire avant, étapes
livrées UNE PAR UNE, validation après chacune, et l'inventaire des régressions comme
check-list de non-régression finale.

---

## PHASE DÉCOUVERTE (2026-07-31) — 4 agents, tout vérifié sur pièce

**Pourquoi elle était indispensable ici** : le corps de cette fiche a été rédigé le 2026-07-29,
soit **avant** les LOTS 015 (publié en 5.8) et 013 (publié en 5.9), qui ont tous deux travaillé
dans ses zones. La découverte a confirmé la règle de campagne : *aucune citation d'une fiche ne
vaut sans re-vérification*.

**Cause mécanique de la dérive des numéros de ligne** : le LOT 013 a inséré **11 lignes** dans
`renderPantryFilters` (`js/app.js:779-812`). Toute citation de la fiche postérieure à `:779` est
donc décalée de **+11**. Les citations antérieures sont exactes.

### A. Ce qui est DÉJÀ FAIT et sort du périmètre

| Point de la fiche | Verdict de la découverte |
|---|---|
| §A étape 1 — supprimer la map `CAT_EMOJI` dupliquée | **PRÉMISSE FAUSSE.** `grep -rn "CAT_EMOJI" js/ src/ index.html` → non trouvé. Soldé par le LOT 006 ; `src/data.js:7-8` documente lui-même la suppression. **Étape retirée.** |
| §A étape 4 — « découper `exportClipboard` en fonction pure + wrapper toast » | **DÉJÀ FAIT À 80 % par le LOT 015.** `buildClipboardText` (`js/app.js:1599-1669`) est déjà pure, `writeToClipboard` (`:1678-1713`) isole l'effet de bord, `exportClipboard` (`:1724-1738`) n'est plus qu'un wrapper de 15 lignes. **Reste un simple DÉPLACEMENT** du bloc `js/app.js:1548-1738` (191 l, 2 dépendances : `getCategoryEmoji` et `state`). |
| §C — « `loadState` ignore un localStorage corrompu » | **PARTIELLEMENT FAIT.** Le `try/catch` + `console.error` existe (`src/state.js:95-106`) et couvre le JSON *illisible*. Ce qui manque, c'est le contrôle de **type** d'un JSON *lisible* (`"abc"` → clés `0/1/2` collées dans l'état). Reformulé ci-dessous. |
| §C — « `syncPull` rejette un document cloud invalide » | **DÉJÀ FAIT, mais PAS où la fiche le dit.** Le garde vit dans `js/app.js:403-409` (`performSyncPull`), pas dans `src/services/firebase.js` (transport pur : `res.ok` + délai 15 s). Et il y en a **DEUX**, pas un : entrant `:403-409` **et** sortant `:313-318` (protection anti-vidange du cloud, testé `sync-engine.test.js:496`). **Ne pas supprimer le sortant en croyant dédoublonner.** |
| §C — validation du fichier de sauvegarde | **SOLDÉ par le LOT 015.** `estUnIngredientPlausible` (`src/actions.js:254-258`) + refus sans écriture ni envoi cloud (`:259-264`), couverts par 10 tests dédiés (`tests/backup-restore.test.js:290-392`). **À EXTRAIRE, pas à réécrire.** |
| §F — verrou de parité `on*=` ↔ `window` | **Serait VERT dès sa création** : les 32 noms de fonction référencés par les 99 attributs `on*=` d'`index.html` sont tous branchés. Verrou de non-régression pur — c'est correct, mais le dire pour ne pas chercher un bug qui n'existe pas. |
| §D — squelette statique du modal recette | **SOLDÉ au LOT 009**, il n'en reste rien (`index.html:108-112`). |

**Total : 48 gardes de validation existent déjà** dans le code (inventaire complet en annexe de
la découverte). **Le volet C est à ~40 % déjà en place.**

### B. Ce que la découverte a TROUVÉ EN PLUS

#### B1. 🔴 DÉFAUT RÉEL ET ACTIF EN PRODUCTION — `importStockOnly`

Le LOT 015 a fermé la porte « Restaurer une sauvegarde ». **La porte jumelle « Importer
uniquement le stock » est restée ouverte** avec sa garde faible d'origine :

```js
// src/actions.js:316-319
if (!data.ingredients) { toast('Format non reconnu', 'error'); return; }
// … puis src/actions.js:346
state.ingredients.push({ ...jsonIng, id: newId });
```

Un fichier `{"ingredients": ["Tomate","Oignon"]}` passe la garde ; le spread d'une **chaîne**
produit `{0:'T',1:'o',…}`. Ces objets survivent à `sanitizeGlobalState` (ce *sont* des objets,
`src/state.js:181`, et `name` n'est jamais garanti, `:197-205`) : **des ingrédients fantômes
sans nom entrent dans l'inventaire, sont persistés, puis poussés au cloud.**

➡️ **Traité en TÊTE du volet C.** C'est le même incident que le LOT 015 a corrigé à la porte
d'à côté, resté ouvert par symétrie manquante.

#### B2. Le volet G efface le champ du CLOUD — la fiche disait l'inverse

La fiche annonçait « le document cloud gardera une copie périmée du champ, simplement plus
lue ». **Faux** : `buildSyncDocument` (`src/services/firebase.js:54-63`) reconstruit le document
**de zéro** et `syncPush` (`:95-109`) fait un **`PUT` = remplacement entier** (documenté `:90`).
➡️ **Les articles libres seront EFFACÉS du cloud dès le premier envoi suivant, sans retour.**
Annoncé à Joel le 2026-07-31 ; décision inchangée. Action de Joel avant livraison du volet G :
copier sa liste de courses s'il veut garder trace de son « porc haché ».

#### B3. Deux libellés VISIBLES par Joel deviennent des mensonges (volet G)

```
index.html:535  « …rangé par rayon, articles libres compris. »   (carte « Copier ma liste »)
index.html:571  « …articles libres compris. Votre stock n'est pas touché. »  (carte « Vider »)
```
Verrouillés par `tests/settings-labels.test.js:100-103` et `:154-158`. **Le volet G compte donc
10 sites de production, pas 8** — et il touche du texte que Joel lit.

#### B4. Fuite localStorage non prévue (volet G)

`saveState` sérialise `state` en entier (`src/state.js:147`) et `loadState` fusionne (`:99`).
Sans un `delete state.customCartItems` dans `sanitizeGlobalState`, **la clé survivra
indéfiniment dans `pantry_v5`**. Le patron existe déjà juste au-dessus : `src/state.js:171`
(`delete state.shoppingChecked`, filet SSOT du LOT 015).

#### B5. Piège de découpage majeur — collision de noms `saveRecipeOnly` / `saveRecipeAndList`

Ces deux noms existent dans **les deux contrats publics, avec des fonctions DIFFÉRENTES** :

```js
js/app.js:578-579   export { saveRecipeOnly, saveRecipeAndList }        // les vraies (prennent r)
js/app.js:2809-2810 expose({ saveRecipeOnly: savePastedRecipe, … })     // d'AUTRES (sans args)
```
`import { saveRecipeOnly }` ≠ `window.saveRecipeOnly`. Documenté par
`tests/favorites-rich.test.js:203-208`. **Un découpage par nom fusionnerait ces deux fonctions.**

#### B6. Le volet B est plus simple ET plus large que prévu

- **Plus simple** : aucun code du dépôt ne compare l'identité de l'objet `state`
  (`Object.is`/`WeakMap`/`=== state` : zéro occurrence). **Tous les tests utilisent déjà
  `Object.assign(state, …)`** (`tests/_helpers/dom-helpers.js:295`, `tests/state.test.js:26`,
  `tests/actions-data.test.js:63`) : le passage à la mutation **aligne la prod sur ce que les
  tests font déjà**. L'équivalence `aiConfig` demandée par la fiche est **garantie par
  construction** (`Object.assign` est superficiel comme le spread).
- **Plus large** : `loadState` réassigne AUSSI (`src/state.js:99`) — sans le corriger, la
  compensation `js/app.js:62` reste obligatoire et le critère d'acceptation est intenable. Et
  `loadState` réassigne `shoppingChecked` (`src/state.js:103`), **en contradiction directe avec
  le contrat de `replaceShoppingChecked`** (`:82-89` : « on mute le Set en place, jamais par
  affectation »). Contradiction interne au module, absente de la fiche.
- **Décompte exact** : 4 sites (`js/app.js:29` déclaration de l'alias, `:62`, `:96`, `:422`).
  Cible réaliste = **3 suppressions**, l'alias `:29` peut rester (chemin le moins risqué : garder
  l'alias évite de réécrire ~200 sites de lecture/écriture dans `js/app.js`).
  `:422` n'est pas redondant : `saveState` dispatche `stateUpdated` **dans** son `try`
  (`src/state.js:146-153`), donc si `localStorage.setItem` lève, `:422` est le seul filet.

#### B7. Volet E — l'interdiction « ne pas toucher `rd-*` / `mh-*` » est trop grossière

**7 des 14 sélecteurs `rd-*` sont réellement morts** : `.rd-section-title`, `.rd-ingredients`,
`.rd-ing-name`, `.rd-instructions`, `.rd-nutrition`, `.rd-nut-item`, `.rd-nut-val` — le JS émet
`.recipe-detail-section`, `.recipe-ing-qty-list`, `.recipe-steps` (`src/ui/recipe.js:230`, `:197`,
`:222`). Idem `.mh-search-bar.searching` (`css/style.css:324-327`, 0 occurrence de `searching`).
➡️ **L'interdiction doit être reformulée sélecteur par sélecteur, pas par famille.** Restent
formellement vivants et intouchables : `.r-tag*`, `.picker-magic-btn` (`css/style.css:2506`),
`.emoji-edit-btn` (`:2132`), `.sync-indicator.*` (`:618-697`), `.rd-top/.rd-emoji/.rd-meta-row/
.rd-meta-badge/.rd-ing-amount`, et 10 des 11 `mh-*`.

**Un commentaire du CSS ment et induirait le nettoyage en erreur** : `css/style.css:2882-2883`
affirme que `rc-emoji`/`rc-info` sont « la structure réellement utilisée » et `rc-header`/
`rc-body` « orphelines ». C'est **exactement l'inverse** (`src/ui/recipe.js:28-56`). À corriger.

#### B8. Volet E — le découpage naturel n'est PAS celui décrit par la fiche

`css/style.css` = **3 785 lignes** (fiche : ~3700), chargé par **une seule balise**
(`index.html:12`), aucun `import` CSS depuis un module JS. **Vite 8 embarque postcss-import**
→ la voie sûre est de garder `css/style.css` comme **fichier-chapeau de `@import`** dans l'ordre
actuel : `index.html` reste intact et l'ordre de cascade est mécaniquement préservé.

Le fichier a **12 sections déjà balisées** — mais la section « UTILITIES » (`:3138-3690`, 553 l)
est en réalité **une poubelle de surcharges tardives** de domaines traités plus haut. **Couper
strictement aux frontières actuelles** et garder ce bloc en avant-dernier ; le remonter dans les
fichiers de domaine **changerait le rendu**.

**Pièges d'ordre recensés** (l'ordre source seul tranche, même spécificité) :
`.ez-chip` ×3 (`:1354`, `:1440`, `:3679`) · `.ai-sticky-cta` (`:1211` vs `:3543` `!important`) ·
`.generate-btn` (`:1519` vs `:3560`) · `.r-tag.green` (`:1634` vs `:3286`) · `.r-tag.red`
(`:1492` vs `:3292`, **rendu visuellement inversé**) · `.recipe-detail-section` (`:1500` AI VIEW
vs `:2637` MODALS — **fusion inter-sections**) · **`@keyframes spin` déclaré 2× (`:2959` et
`:3379`) : les `@keyframes` NE FUSIONNENT PAS, la dernière déclaration remplace l'autre en
entier — le piège le plus dangereux du fichier** · 9 media-queries disséminées dont une tout à
la fin (`:3776-3785`) qui surcharge `.ing-emoji`, stylée en section COMPONENTS (~880).

#### B9. Volet F — le verrou d'imports serait ROUGE à sa création

**22 sites** violent déjà la règle (21 imports statiques + 1 dynamique,
`tests/sync-scope.test.js:183`), **tous dans `tests/`**, 10 fichiers. `src/` (19 imports) et
`js/app.js` (11 imports) sont à **100 % conformes**. ➡️ **Décision : corriger les 22 sites dans
le commit du verrou** (mécanique, sans risque, cohérent avec « SSOT partout »), plutôt que
restreindre le périmètre à la zone déjà saine.

**Deux précisions indispensables pour le verrou de parité**, sans lesquelles il serait rouge à
tort : (a) il doit lire `expose({…})` **ET** les `window.X =` (sinon
`window._onManualCategoryChange`, `js/app.js:2202`, le fait échouer) ; (b) il doit rester
**unidirectionnel** — le sens inverse épinglerait `pushToFirebase`, exposé **volontairement**
sans bouton (décision tracée `LOT 007:156` et `:609`).

**Emplacement des nouveaux verrous** : `tests/test_project_map_freshness.py:41` balaie `tests/`
en `glob("*.*")` **non récursif** (alors que `src/` est en `rglob`). Les 2 verrous vont **à plat
dans `tests/`** et **doivent** être ajoutés à `PROJECT_MAP.md`.

#### B10. Zones aveugles — le découpage y avancerait sans filet

Le LOT 013 a porté la suite à 550 tests, mais ces fonctions restent **sans test direct**, et le
découpage va les déplacer : `renderPantryFilters` (`js/app.js:763-818`, 56 l — **la zone que le
LOT 013 a lui-même modifiée**) · `searchEmojiAI` (`:2642-2673`, 33 l, appel réseau, câblée dans
`index.html`) · `matchIngredientToStock` (`:1238-1278`, 41 l, cœur du calcul « en stock /
manquant ») · `guessCategoryLocally` (`:2010-2036`, 49 mots-clés en dur) · `sanitizeCategory`
(`:2038-2051`, 8 règles en dur) · `selectEmoji` (`:2622-2640`) · `confirmBulkAdd` (`:2275-2285`)
· `toggleAllPickerItems` (`:2296-2305`) · `initKeyboardShortcuts` (`:2741-2767`).
➡️ **Règle du lot : toute fonction de cette liste que l'on déplace se voit d'abord poser un test
de caractérisation** (elle décrit le comportement actuel, quel qu'il soit) — sinon le filet du
LOT 013 a un trou exactement là où le code bouge.

#### B11. Duplications SSOT réelles trouvées en plus de la liste du volet D

**Valeurs** : les catégories du `<select>` d'`index.html:650-665` sont **écrites à la main** et
**déjà divergentes** de `src/data.js:15-33` (la catégorie de repli `Autres` y manque, alors que
`src/state.js:199` l'impose) · 2 clés localStorage hors du fichier de constantes
(`js/app.js:110-111`) · `'Autres'` en dur ×5 · émojis de repli en dur (`'🔸'` ×4, `'🛒'` ×3,
`'❓'`) · table des vues et de leurs alias (`fav`↔`favorites`, `export`↔`settings`) **sans aucune
représentation canonique**, recopiée 4× · `toLocaleDateString('fr-FR')` ×4.

**Logique** : 2 recherches d'emoji par IA avec 2 prompts et 2 regex (`js/app.js:2316` vs `:2654`,
la seconde sans garde de clé API et avec une regex qui rate des émojis) · 2 constructeurs de
suggestions d'emoji depuis `DEFAULT_DB` (`:2073` vs `:1947`) · **3 normalisations différentes
pour chercher dans `DEFAULT_DB` dans le MÊME formulaire** (`:2112` insensible aux accents vs
`:2081` et `:1949` sensibles — taper « epinard » remplit la liste mais pas la grille) · 2
regroupements par catégorie avec 2 tris différents (`js/app.js:1548` vs `src/ui/shopping.js:60`)
· 4 fonctions « pousser un favori » dont 2 lignes strictement identiques (`:1475` ≡ `:1482`) ·
`addIngredient`/`addIngredientFromDb` : **12 lignes dupliquées**, pas seulement le bloc
« confirmer si similaire » (aussi le reset du formulaire `:2232-2236` ≡ `:2260-2264` et la queue
`:2243` ≡ `:2272`) · `_localCategoryFill` (`js/app.js:31`) **écrite 5 fois, lue zéro fois** ·
`stripAccents` (`src/utils/helpers.js:6-9`) et `sanitize()` (`src/utils/dom.js:41-46`) : **code
mort**, aucun appelant en production.

### C. Arbitrages pris à l'ouverture (hors Joel, tracés ici)

1. **`isValidIngredient` NE DOIT PAS exiger `category`.** La règle telle qu'écrite dans le
   volet C (« objet avec `id` string, `name` string, `category` string ») **rejetterait des
   fichiers de sauvegarde aujourd'hui acceptés**, dont les sauvegardes de l'ère monolithe au
   champ `n` — et casserait `tests/backup-restore.test.js:351` et `:360`. La garde réelle
   (`src/actions.js:254-258`) n'exige pas `category` **délibérément**, car
   `sanitizeGlobalState:199` la pose à `'Autres'`. ➡️ **On extrait la garde existante, on ne la
   durcit pas.** Le pare-feu A/B l'emporte sur la lettre de la fiche.
2. **`escapePromptValue` couvre DEUX fonctions, pas une** : `js/app.js:2157` (`handleAddInput`)
   **et** `js/app.js:2316` (`searchEmojiAddAI`, même formulaire d'ajout). Restent explicitement
   **exclus** : `js/app.js:2654` (`searchEmojiAI`, autre champ) et `js/app.js:1135`
   (`analyzeNutrition`, contenu long), ainsi que tout le contenu de recette collée.
3. **Ordre d'exécution ajusté** : `C1` (le trou `importStockOnly`) passe **en tout premier**,
   avant même B — c'est un défaut actif en production, il ne doit pas attendre une refonte.

### D. Tableau de correction des citations de la fiche

| Affirmation d'origine | Valeur vérifiée le 2026-07-31 |
|---|---|
| `js/app.js` fait 2 810 lignes | **2 821** |
| `:2191` `window._onManualCategoryChange` | **`:2202`** |
| `:2788` / `:2788-2810` `expose({})` | **`:2799-2821`** (44 noms : ✅ exact) |
| `:538-597` `export {}`, 54 noms | ✅ **exact** |
| `~25` variables `_*` aux plages `:29-41`, `:117-133`, `:1038-1049`, `:1904`, `:2569` | **24 `let _*` + `let state` = 25.** Plages : `:29-41` ✅, `:117-133` ✅, → **`:1049-1060`**, → **`:1915`**, → **`:2580`** |
| `js/app.js:910` (génération en vol) | **`:921`** |
| « les 36 fonctions branchées par `on*=` » | **32 noms distincts** (99 attributs `on*=`) |
| `renderShopping`, `js/app.js:818-824` | **`:829-836`** (contenu de l'affirmation : ✅ exact) |
| rubrique `[ARTICLES LIBRES]`, `js/app.js:1629-1640` | `FREE_ITEMS_SECTION` **`:1563`** · branche `cart` **`:1638-1664`** · seule occurrence de code **`:1644`** · toast **`:1656-1660`** |
| `src/ui/shopping.js:19`, `:32` (param `type`) | **`:21`** et **`:34`** — et le retrait entraîne aussi **`src/ui/shopping.js:64`** (`type:'db'`) + 3 assertions (`tests/topbar-context.test.js:248`, `tests/shopping-list-render.test.js:80` et `:88`) |
| volet G : 8 sites de production | **10** (+ `index.html:535` et `:571`) |
| volet G : 57 occurrences de test / 24 dans `export-clipboard` | **41 occurrences** / **12** dans `export-clipboard` |
| volet G : « l'essentiel est du décor sauf `export-clipboard` » | **Faux** : `tests/backup-restore.test.js:147-150`, `:479-491`, `:493-499`, `:533-549` · `tests/sync-scope.test.js:66-74`, `:85-92` · `tests/actions-data.test.js:309-318` portent aussi des **assertions dédiées** qui échoueront |
| `addCustomCartItemFromSearch`, oracle `:6107-6115` | **`:6107-6114`** |
| `.generate-btn` 2× en `l.1503` et `l.3506` | **`css/style.css:1519`** et **`:3560`** — et ce ne sont pas des copies mais un bloc de base + un bloc « polish », seul `transition` en conflit |
| `css/style.css` ~3700 lignes | **3 785** |
| §E « base/layout, inventaire, courses, IA/recettes, modales, réglages » | Sections réelles : préambule · LAYOUT · COMPONENTS *(contient la grille d'inventaire)* · SHOPPING · AI · FAVORITES · **EXPORT** *(= les réglages)* · ADD INGREDIENT · MODALS · LOADING · RESPONSIVE · UTILITIES · NUTRITION |
| §C « `syncPull` rejette… » | Garde réel dans **`js/app.js:403-409`**, couplé à l'UI (`setSyncStatus`, `toast`, `return false` qui pilote le retry). Pas un remplacement mécanique. |

**Vérifié EXACT et confirmé** : module ESM plat, aucun IIFE / top-level await / `import()`
dynamique · `src/state.js:36`/`:179`, `src/constants.js:34`, `src/services/firebase.js:19`,
`src/actions.js:99`/`:131`/`:80`/`:86` · `removeFromCart` ignore totalement `type` **sur tous
les chemins** (ensemble d'appelants fermé, jamais sur `window`) · articles libres jamais
affichés et impossibles à créer · l'oracle les marquait « Deprecated » · le moteur de synchro
vit bien dans `js/app.js` (bloc contigu **`:100-534`**, 19 fonctions, avec le point d'injection
`registerSyncScheduler`/`registerSyncBarrier` déjà en place `:460-461` → **extraction possible
sans import circulaire**) · `AI_ROLES` et les plafonds du LOT 010 sont des SSOT **impeccables**,
rien à y faire.

---

## Périmètre

### A. Découpage de `js/app.js` (ex-fiche SPLIT_APP_JS, actualisée)

`js/app.js` fait **2 810 lignes** (mesuré le 2026-07-30, découverte du LOT 013 — la fiche
annonçait « ~1500 avant campagne », soit **+87 %** après les restaurations). Cible :
**un orchestrateur fin (< 700 lignes) + N modules métier.**

**Précisions issues de la découverte du LOT 013 (vérifiées `fichier:ligne`)** :
- `js/app.js` est un module ESM **plat** : au niveau racine il n'y a que **4 instructions
  exécutables** (`js/app.js:60-93` le handler `DOMContentLoaded`, `:95-98` l'écouteur
  `stateUpdated`, `:2191` `window._onManualCategoryChange`, `:2788` `expose({...})`).
  Aucun IIFE, aucun top-level await, aucun `import()` dynamique.
- Deux contrats publics coexistent : le bloc **`export {}`** (`js/app.js:538-597`, **54 noms**,
  « exportés UNIQUEMENT pour les tests ») et le bloc **`expose({})`** (`js/app.js:2788-2810`,
  **44 noms** sur `window`). Le découpage doit préserver **les deux**.
- Le vrai obstacle n'est pas les fonctions mais l'**état de module** : ~25 variables `_*`
  (`js/app.js:29-41`, `:117-133`, `:1038-1049`, `:1904`, `:2569`), dont **une seule** dispose
  d'une trappe de reset (`__resetSyncEngineForTests`, `js/app.js:519-534`). C'est ce qui rend
  les tests fragiles aujourd'hui (une génération laissée en vol bloque tous les tests suivants
  d'un fichier, `js/app.js:910`) — l'étape 5 ci-dessous est donc la plus rentable.

Étapes héritées de la fiche d'origine — à re-vérifier sur l'état réel du code, plusieurs
points ont pu être résolus par les LOTS 005-012 :
1. `CAT_EMOJI` dupliquée → vérifier : `CATEGORIES_WITH_EMOJI`/`getCategoryEmoji` existent
   déjà dans `src/data.js` (LOT 006). S'il reste une map locale dans `app.js`, la supprimer
   (3 recherches convergentes avant : appel direct, accès dynamique, config annexe) ;
2. logique « confirmer si similaire » dupliquée entre `addIngredient` et
   `addIngredientFromDb` → extraire `src/utils/dedup.js::confirmIfSimilar` ;
3. `guessCategoryLocally`/`sanitizeCategory` → `src/utils/categorize.js`, mots-clés dérivés
   de `DEFAULT_DB` quand possible (au lieu de listes en dur — SSOT) ;
4. `exportClipboard` → `src/services/exports.js` (fonction pure + wrapper toast) ;
5. formulaire d'ajout → `src/ui/addForm.js` : encapsuler l'état de module épars
   (`_isManualCategory`, `_localCategoryFill`, `_addSuggestTimer`, `_aiSuggestGenId`…) dans
   un état privé de module avec `reset()` appelé par `switchView` ;
6. modales recette/sélecteur → `src/ui/recipeModal.js` : encapsuler `_currentPickerData`,
   `_lastTransformedRecipe`, `_currentEditingIngId`… ;
7. le moteur de synchro du LOT 007 (s'il vit dans `app.js`) → `src/services/sync.js`.

Critère par étape : `expose()` reste complet (les `onclick` d'`index.html` sont le contrat
public — les 36 fonctions inventoriées au balayage du 2026-07-29 doivent toutes rester
branchées), tests verts, build OK.

### B. Alias `state` fragile (ex-fiche dédiée, reprise intégrale)

`setState` (`src/state.js`) **réassigne** l'état ; `js/app.js` garde un alias local compensé
par des `state = moduleState` manuels. Qu'un futur `setState` oublie la compensation et l'app
travaille sur des données périmées, sans aucun signal.

**Option A retenue (recommandation de la fiche d'origine) : muter au lieu de réassigner** —
`Object.assign(state, partialState)` + suppression de TOUS les `state = moduleState`
compensatoires. Condition de la fiche d'origine à démontrer par un test : équivalence stricte
sur `aiConfig` (remplacement entier, pas de fusion profonde — comportement actuel à
conserver) et sur les tableaux. Au moindre écart observable → STOP, ça devient une spec.

### C. Validation des données externes — CHANGEMENT DE COMPORTEMENT ASSUMÉ

⚠️ **Exception au pare-feu A/B de ce lot** (l'audit de campagne Codex a relevé la
contradiction : « zéro changement observable » + « rejets de données » sont incompatibles).
Ce volet C introduit des comportements NOUVEAUX — des rejets de données invalides — validés
par Joel via cette spec. Tout le reste du lot reste à zéro changement observable. **Livrer
ce volet dans un commit SÉPARÉ des volets de refonte**, pour qu'un problème se revert seul.

Créer `src/utils/validate.js` (léger, zéro dépendance). **Règles COMPLÈTES — la fiche
backlog d'origine a été supprimée à la promotion, cette fiche est la SEULE référence
(correction d'autonomie, audit Codex)** :
- `isValidIngredient(i)` : objet avec `id` string, `name` string, `category` string ;
- `isValidRecipe(r)` : objet avec `name` string de moins de 200 caractères ; `ingredients`
  et `steps` soit absents, soit tableaux ;
- `isValidAiConfig(c)` : objet ; `apiKey` absente ou string ;
- `validateState(s)` : objet ; **`ingredients` PRÉSENT et tableau — c'est l'invariant du
  garde §4.9 du LOT 007, que cette couche généralise** ; `favorites` et `extraIngredients`
  absents ou tableaux ; `aiConfig` absent ou valide ;
- `escapePromptValue(str)` : échappe `\` et `"`, remplace les sauts de ligne par des
  espaces, tronque à 100 caractères.

Application — périmètres STRICTS :
- `syncPull` rejette un document cloud qui échoue `validateState` (REMPLACE le garde minimal
  du LOT 007, ne pas empiler deux gardes — l'invariant `ingredients` ci-dessus le couvre) ;
- `loadState` ignore un localStorage corrompu (état par défaut conservé, warning console) ;
- `transformRecipeAI` refuse une recette IA qui échoue `isValidRecipe` (toast explicite) ;
- `escapePromptValue` s'applique **UNIQUEMENT au champ ingrédient du formulaire d'ajout**
  (`handleAddInput` → prompts de catégorie/emoji). **JAMAIS au texte de recette collé ni à
  aucun contenu long** : tronquer une recette à 100 caractères détruirait la fonctionnalité
  de collage (audit Codex).

### D. Traque SSOT transverse (demande de Joel)

Balayage systématique, `grep` à l'appui, avec correction ou fiche backlog par trouvaille :
- `.generate-btn` défini 2× dans `css/style.css` (l.1503 et l.3506 avec `!important`) —
  fusionner ;
- doublon connu : le squelette statique du modal recette vs rendu dynamique (traité au
  LOT 009 — vérifier qu'il n'en reste rien) ;
- chaque constante métier (catégories, seuils, libellés récurrents, clés localStorage,
  plafond des épinglés du LOT 010…) : UNE représentation canonique, les autres dérivées ;
- règle de sortie : `grep` de contrôle documenté dans le commit pour chaque duplication
  traitée.

### E. Découpage de `css/style.css` (~3700 lignes) et CSS mort

- Découper en feuilles par domaine (base/layout, inventaire, courses, IA/recettes, modales,
  réglages) importées dans l'ordre actuel — **l'ordre des règles CSS est un comportement** :
  le préserver strictement ;
- CSS mort : suppression UNIQUEMENT avec 3 recherches convergentes par sélecteur.
  **⚠️ NE PAS supprimer `.r-tag` ni les styles réactivés par la campagne** (`.picker-magic-btn`,
  `.emoji-edit-btn`, `.sync-indicator.*`, `mh-*`/`rd-*`) — l'ancien plan (`CURRENT_GOAL.md`
  d'avant campagne) les croyait morts, les LOTS 007-012 les ont rebranchés.

### G. Suppression des « articles libres » — CHANGEMENT DE COMPORTEMENT ASSUMÉ

⚠️ **Deuxième exception au pare-feu A/B de ce lot**, au même titre que le volet C.
**Décidé par Joel le 2026-07-30** (« et si on effaçait ces articles libres, et qu'on n'en
parlait plus »), après avoir constaté que la fonction ne lui sert pas. **À livrer dans un
commit SÉPARÉ**, comme le volet C.

**Ce que c'est :** `state.customCartItems` — des articles ajoutés à la liste de courses sans
passer par l'inventaire. Dans l'oracle, ils étaient créés depuis la recherche
(`foodapp-v5-Joel.html:6107-6115`, `addCustomCartItemFromSearch`). **L'oracle lui-même les
marquait « Deprecated »** (`foodapp-v5-Joel.html:4237` et `:4295`).

**État actuel (découverte du LOT 013, vérifié sur pièce) :** conservés, synchronisés,
sauvegardés, effacés par les resets et **copiés** — mais **jamais affichés** (`renderShopping`,
`js/app.js:818-824`, ne passe que `state.ingredients.filter(i => i.inCart)`) et **impossibles
à créer** (aucun portage de `addCustomCartItemFromSearch`). C'est donc un vestige à demi
branché, pas une fonctionnalité.

**Pourquoi ici et pas au LOT 013 :** supprimer un champ tissé dans la synchro, la sauvegarde,
les resets et la copie **est un déplacement de code**. La leçon qui gouverne la campagne est
qu'on ne déplace pas de code sans filet — le faire pendant le lot qui *construit* le filet
inverse l'ordre que toute la campagne existe pour imposer.

**Inventaire complet des sites à traiter (8 en production, 9 fichiers de tests) :**

| Site | Rôle |
|---|---|
| `src/state.js:36` | valeur par défaut |
| `src/state.js:179` | garde `if (!state.customCartItems) … = []` |
| `src/constants.js:34` | entrée dans `BACKUP_STATE_KEYS` (périmètre du fichier de sauvegarde) |
| `src/services/firebase.js:19` | entrée dans `SYNC_ARRAY_KEYS` |
| `src/actions.js:99` | `resetCart()` |
| `src/actions.js:131` | reset global |
| `js/app.js:1629-1640` | rubrique `[ ARTICLES LIBRES ]` de la copie (LOT 015) + comptage du toast |
| `src/actions.js:80`, `:86` + `src/ui/shopping.js:19`, `:32` | **paramètre `type` mort** de `toggleShoppingCheck` / `removeFromCart` : `removeFromCart` l'ignore totalement et ne cherche que dans `state.ingredients` (vérifié — aucun bug actif, mais le paramètre ne sert plus à rien) |

**Tests impactés** (57 occurrences sur 9 fichiers) : l'essentiel est du décor (la remise à
zéro de `state` cite la clé), **sauf `tests/export-clipboard.test.js` (24 occurrences)** qui
contient les tests dédiés du LOT 015 : rubrique `[ ARTICLES LIBRES ]` placée en fin, article
sans nom exploitable ignoré, gardes de type (`{0:{}}`, string, 42, null), toasts chiffrés
incluant les articles libres. Ces tests sont à **supprimer**, pas à contourner.

**Effets à annoncer à Joel avant livraison :** sa liste de courses copiée cessera d'inclure
son « porc haché » (seul endroit où il était encore visible) ; les fichiers de sauvegarde
créés après ce lot ne porteront plus le champ ; le document cloud gardera une copie périmée
du champ, simplement plus lue.

**Discipline** : 3 recherches convergentes par site (appel direct, accès dynamique, config
annexe) avant tout retrait, conformément à `CLAUDE.md` §5.

### F. Verrous anti-récidive

- **Verrou imports ESM** (arbitrage parqué depuis le LOT 002) : test qui échoue si un import
  relatif omet l'extension `.js` ;
- **Verrou parité** : test qui échoue si une fonction référencée par un `on*=` d'`index.html`
  n'est pas exposée sur `window` (aurait détecté une partie des casses de la migration) ;
- `PROJECT_MAP.md` mis à jour (nouveaux modules) — le verrou de fraîcheur pytest y veille.

## Ordre d'exécution et livraison

**Ordre arrêté après la phase découverte du 2026-07-31 : C1 → B → C → G → A → D → E → F.**

- **C1 en tout premier** — le trou d'`importStockOnly` (§B1 de la découverte) est un défaut
  **actif en production** : il n'attend pas une refonte. Commit isolé, immédiatement reversible.
- **B avant A** — la mutation de `state` simplifie le découpage.
- **G avant A/D/E** — retire du code que les autres volets devraient sinon déplacer pour rien.
- **E après tout le reste** — c'est le seul volet dont la preuve exige un contrôle navigateur.

**Un commit par étape aboutie**, validation unifiée verte à chaque commit. Pas de « grand
soir » : si une étape déraille, on la revert seule.
**C et G sont les deux seuls volets à changement de comportement : commits séparés, isolés
des volets de refonte pure.**

**Règle de non-régression propre à ce lot (§B10 de la découverte)** : toute fonction de la liste
des zones aveugles que l'on déplace se voit **d'abord** poser un test de caractérisation — qui
décrit le comportement actuel, quel qu'il soit. Déplacer du code non testé annulerait
localement le bénéfice du LOT 013.

## Critères d'acceptation

- [x] **C1 soldé (2026-07-31)** : `importStockOnly` refuse ce qui n'est pas un inventaire,
      sans écriture ni envoi cloud. 9 tests calqués sur ceux du bouton voisin
      (`tests/actions-data.test.js`, describe « LOT 014 §C1 »). **559/559 Vitest, 13/13
      Pytest, build OK.** Détail de l'exécution en §RÉALISATION ci-dessous.
- [ ] `js/app.js` < 700 lignes ; plus aucune variable `_*` de module dans `app.js`
- [ ] Plus aucun `state = moduleState` compensatoire (**3 suppressions** : `js/app.js:62`,
      `:96`, `:422` — l'alias `:29` peut rester) **et `loadState` ne réassigne plus**
      (`src/state.js:99` et `:103`, ce dernier en contradiction avec `replaceShoppingChecked`)
- [ ] `validate.js` en place sur les 3 portes (cloud, localStorage, IA)
- [ ] **Volet G soldé** : plus aucune occurrence de `customCartItems` dans `js/` ni `src/`
      (`grep` de contrôle documenté dans le commit) ; paramètre `type` mort retiré de
      `toggleShoppingCheck`/`removeFromCart` **et de `src/ui/shopping.js:64`** ; tests du LOT 015
      dédiés aux articles libres supprimés, pas neutralisés ; **les 2 libellés d'`index.html`
      (`:535`, `:571`) réécrits** avec leurs tests (`settings-labels.test.js:100`, `:154`) ;
      **`delete state.customCartItems` posé dans `sanitizeGlobalState`** sur le modèle de
      `src/state.js:171`, sinon la clé survit indéfiniment dans le localStorage de Joel
- [ ] Zéro duplication SSOT connue restante (liste D soldée ou en fiches backlog)
- [ ] Les 2 verrous anti-récidive en place et rouges quand on les provoque
- [ ] Validation unifiée verte, build OK, **check-list de la fiche régressions re-parcourue
      intégralement** : aucun comportement restauré n'a re-disparu
- [ ] **Oracle visuel après le découpage CSS (audit Codex + leçon gravée du LOT 005)** :
      preuve NAVIGATEUR avant/après pour les 5 vues ET les modales (détail de recette,
      sélecteur, icône, API), en bureau ET en mobile. jsdom ne prouve ni cascade, ni
      géométrie, ni plein écran ; « le texte des règles est présent dans le fichier » n'est
      pas une preuve (incident du commentaire CSS, LOT 005).
- [ ] Audit DUR final de campagne

---

## RÉALISATION

### Étape C1 — la porte jumelle fermée (2026-07-31)

**Ce qui a été trouvé en codant, et qui a changé le correctif.** Le premier réflexe — réutiliser
telle quelle la garde du LOT 015 (`estUnIngredientPlausible` : nom **ET** identifiant) — était
faux : un test existant (`tests/actions-data.test.js:117`) prouve qu'un fichier peut
légitimement dire « ingrédient `ing_1`, maintenant en stock » **sans répéter son nom**. Appliquer
la garde stricte aurait refusé des fichiers qui fonctionnent aujourd'hui — une régression
déguisée en durcissement, exactement ce que la découverte avait anticipé au sujet de
`isValidIngredient` (§C.1 des arbitrages).

**D'où deux règles distinctes sur un socle unique** (`src/actions.js`, niveau module) :
`aUnNomExploitable` (socle) · `estUnIngredientPlausible` = socle **ET** id → `importJSON`
(remplacement total, indexé par id, règle inchangée) · `estFusionnable` = id **OU** nom →
`importStockOnly` (fusion douce, qui fabrique elle-même les ids manquants).

**Le correctif a deux moitiés, parce que la fuite en avait deux :**
1. **Filtre d'entrée** (`estFusionnable`) : écarte chaînes, nombres, `null` et objets vides
   avant la boucle. Sans lui, un `null` faisait *lever* la boucle (`jsonIng.id`) et l'app
   annonçait « Format JSON invalide » ; et un fichier entièrement illisible annonçait un
   **succès**.
2. **Garde de création** (`aUnNomExploitable` dans la branche `else`) : un `id` qui ne
   correspond à **aucun** ingrédient local et sans nom (`{"id":"zzz"}`) tombait dans la
   branche d'ajout et **créait** un ingrédient sans nom. Fuite plus discrète que la première,
   non repérée par la phase découverte, trouvée en lisant la branche.

**Preuve par retrait du correctif** (discipline `feedback_verify_audit_findings` — un test vert
ne prouve rien tant qu'on n'a pas vu le rouge) : les deux moitiés ont été neutralisées
**séparément**. Filtre d'entrée neutralisé → **3 tests rouges** (liste de noms, objets vides,
valeurs aberrantes). Garde de création neutralisée → **1 test rouge** (id inconnu sans nom).
Aucune moitié n'est redondante ; aucun des 9 tests n'est tautologique.

**Volontairement NON traité ici** (reste au volet C) : `loadState` sans garde de type, la
validation de recette IA, `escapePromptValue`, et la mutualisation dans `src/utils/validate.js`
— où les 3 prédicats iront. C1 devait rester minimal et reversible seul.

---

## Traçabilité

- Fiches d'origine (supprimées à la promotion, contenus repris) :
  `Backlog/BACKLOG - Decoupage app.js et style.css.md`, `Backlog/BACKLOG - Alias state
  fragile.md`, `Backlog/BACKLOG - Validation des donnees externes.md` — sources
  `ULTRA_AUDIT_REPORT.md` (audits #1 et #2)
- Prérequis : LOT 013 (filet de tests) — NON NÉGOCIABLE
- Clôture la campagne « Restauration & Refonte »
