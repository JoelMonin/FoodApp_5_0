# LOT 015 — Réglages fiables et cohérents — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — ouvert le 2026-07-30, s'exécute après le LOT 012 et AVANT le LOT 013
> **Branche :** `feat/lot15-reglages-fiables` (créée depuis `main` en 5.7)
> **Niveau d'audit : DUR** — le lot touche les sauvegardes, les restaurations et des
> risques de données incohérentes (zones sensibles : `src/state.js`, chemins d'export/import)
>
> **DISPOSITIF D'AUDIT (tranché par Joel le 2026-07-30 — Codex n'a plus de budget de
> jetons, il est hors jeu pour tout ce lot) :**
> - **Gemini = auditeur officiel** : audit du plan AVANT la 1ʳᵉ ligne de code, puis audit du
>   diff final. Consigne d'usage : ne lui poser que des **questions fermées et vérifiables**
>   (sa faiblesse connue est d'affirmer sans rouvrir le fichier), et **contrôler chaque
>   reproche sur pièce** avant de l'intégrer.
> - **Agents adversariaux locaux = le niveau DUR par étape.** Ce sont eux qui portent
>   l'intensité réelle : ils ont durci cette fiche (8 angles morts) puis trouvé 15 erreurs
>   de plus en phase découverte.
> - **NotebookLM = un seul passage de cohérence** sur la spec (« contredit-on une décision
>   d'un lot précédent ? »). **Jamais comme auditeur de code** : il ne voit pas le code.
> - ⚠️ Le critère d'acceptation « /ultra-audit » ci-dessous est **remplacé** par ce
>   dispositif (consigne permanente de Joel : ne pas lancer `/ultra-audit` sans demande).
> **Effort estimé :** ~2 journées (révisé après l'audit du 2026-07-30 : 10 chantiers,
> dont 2 blocages sur le format du fichier de sauvegarde) · **Version visée :** 5.8

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
fiche `LOT 008 - Donnees en securite [CLOTURE].md` (les protections à ne PAS casser),
et **l'ORACLE COMPORTEMENTAL : monolithe `foodapp-v5-Joel.html` l.6464-6487
(`exportClipboard`), l.6489-6515 (`exportJSON` / `importJSON`)**.

⚠️ **L'oracle a été relu le 2026-07-30 et il change la lecture du lot :** les chantiers
1, 2 et 3 ne sont pas des « améliorations » mais bien des **régressions de migration**
(le monolithe faisait déjà juste). Il révèle aussi deux pertes non repérées au premier
passage (chantier 9).

---

## PHASE DÉCOUVERTE (2026-07-30, à l'ouverture — 4 agents, lecture seule)

**Conclusion générale : la fiche était juste sur le FOND, fausse sur presque tous les
NUMÉROS DE LIGNE, et fausse sur 8 points de CONTENU.** Tout est corrigé ci-dessous et
répercuté dans le corps de la fiche.

### A. Dérive de numérotation — règle de conversion

La fiche a été rédigée avant la publication de la 5.7 (LOTS 011+012). Les décalages ne sont
**pas uniformes**, il faut les appliquer par zone :

| Fichier | Zone | Décalage |
|---|---|---|
| `index.html` | toute la vue Réglages | **+9** |
| `src/actions.js` | tout | **+31** |
| `src/state.js` | jusqu'à ~l.180 | **exact** |
| `src/state.js` | au-delà (`setState`, `applyExternalState`) | **+23** |
| `src/data.js` | tout | **exact** |
| `js/app.js` | garde-fous synchro, bloc `export {}` | **+21** |
| `js/app.js` | helper `expose` | **+16** |
| `js/app.js` | `exportClipboard`, `groupByCategory` | **+377** |
| `js/app.js` | `restoreJSON` / `importStockOnly` | **+601** |
| `js/app.js` | appel `expose({...})` | **+630** |
| `foodapp-v5-Joel.html` (oracle) | tout | **exact** ⭐ (une première) |

### B. Huit erreurs de CONTENU de la fiche (plus graves que les numéros)

1. **« liste blanche de 5 clés » (chantier 10a) → l'oracle en a SIX** : `ingredients`,
   `favorites`, `customCartItems`, `extraIngredients`, `aiConfig` (clé vidée) **et**
   `exportedAt` (oracle l.6490).
2. **« rien ne réécrit le champ de recherche » (chantier 10a) → FAUX pour le bureau.**
   `js/app.js:695-696` réécrit bien `#search-input.value = state.search` à chaque rendu de
   la barre supérieure. Le champ **jamais** réalimenté est `#mobile-search`
   (`index.html:253`). Le symptôme « boîte vide mais filtre actif » **n'existe que sur
   mobile** — c'est-à-dire l'usage principal de Joel, donc le chantier reste valide, mais
   pour la bonne raison.
3. **« neutraliser la vue comme le fait déjà `loadState` » → `loadState` ne neutralise PAS
   `currentView`** (`src/state.js:111-114` : uniquement `search`, `filter`,
   `showInStockOnly`, `showInCartOnly`). Neutraliser la vue est un **ajout**, pas une copie.
4. **L'oracle N'EXPORTE PAS les coches.** Elles vivent hors de `state` chez lui aussi, dans
   un `Set` séparé, et `importJSON` n'y touche jamais. **Le champ des coches dans le fichier
   est donc une NOUVEAUTÉ produit, pas une restauration** — écart à l'oracle à assumer et
   tracer, au même titre que le chantier 4.
5. **L'oracle n'affiche AUCUN toast chiffré à la copie** (`📋 Copié dans le presse-papiers`
   / `📋 Copié` au repli). Les toasts chiffrés du chantier 8 sont eux aussi une **décision
   produit de Joel au-dessus de l'oracle**, pas une restauration.
6. **Le toast actuel n'est pas « Copié ! »** mais `'Copié dans le presse-papiers !'`
   (`js/app.js:1580`). Un test écrit contre le libellé de la fiche échouerait.
7. **`importStockOnly` applique QUATRE champs, pas trois** : `inStock`, `inCart`, `pinned`
   **et `frozen`** (`src/actions.js:247-250`). Le sous-titre à réécrire (chantier 8) doit
   dire les quatre.
8. **Structure réelle des articles libres** : id préfixé **`extra_cart_`** (pas `custom_`)
   et `source: 'ai-extra'` (le monolithe écrivait `'custom'`). Un filtre bâti sur
   `id.startsWith('custom_')` raterait la donnée réelle de Joel.

### C. Sept pièges techniques trouvés, absents de la fiche

- **P1 — Il existe un CINQUIÈME état vide malhonnête.** `exportClipboard` n'a **pas de
  branche `else`** : un type inconnu laisse `text = ''`, copie une chaîne vide et affiche
  quand même le toast de succès. Le garde-fou du chantier 9 doit le couvrir explicitement.
- **P2 — `cat.toUpperCase()` est HORS du `try`** (`js/app.js:1558` et `1570`). Une catégorie
  `undefined` lève une erreur **non interceptée** : plus de copie, plus de toast, silence
  total. La rubrique des articles libres doit être posée **avant** d'atteindre ce point.
- **P3 — Un nom de rubrique ne suffit PAS à la placer en fin.** `groupByCategory` trie par
  `.sort()` brut (UTF-16) : `[ ARTICLES LIBRES ]` commence par `[` (U+005B), qui se place
  après les initiales A-S mais **avant `Épices sèches`** (É = U+00C9). La rubrique doit être
  **concaténée après la boucle**, hors de `groupByCategory` (dont l'ordre est contractualisé
  par commentaire — pare-feu A/B).
- **P4 — La garde d'entrée du chemin cloud n'est « plus stricte » que sur le TYPE.**
  `js/app.js:391-397` refuse un non-tableau mais **accepte `[]`**. La protection du vide vit
  ailleurs, côté sortie : `js/app.js:301-306`. Durcir `importJSON` demande **les deux**.
- **P5 — La garde `if (data.ingredients)` est encore plus faible qu'annoncé** : elle accepte
  aussi une chaîne. `"ingredients": "abc"` devient `['a','b','c']`, est filtré à `[]`, puis
  **reconstruit les 297 par défaut** et part au cloud. Il faut
  `Array.isArray(...) && length > 0`.
- **P6 — `importJSON` n'est pas sérialisé avec le moteur de synchro.** Contrairement à
  `resetAllData` (`src/actions.js:123`), il n'appelle pas `awaitSyncQuiescence()`. La fiche
  affirmait « rien à ajouter côté LOT 007 » : c'est vrai pour un **pull** concurrent (garde
  d'empreinte `js/app.js:398-403`), **faux pour un envoi déjà en vol**.
- **P7 — Les ids des deux champs fichier sont INVERSÉS par rapport à leur rôle.**
  `#import-file` (`index.html:570`) déclenche la **restauration totale**, `#restore-file`
  (`index.html:571`) la **fusion douce**. Le monolithe avait le câblage inverse : la
  migration a renommé les fonctions sans renommer les ids. Piège garanti pour l'exécutant
  ET pour l'audit.

### D. Ressources existantes à réutiliser (ne rien réinventer)

1. **`getCategoryEmoji`** (`src/data.js:38`, déjà importé `js/app.js:20`) — repli `📦`
   garanti. SSOT des emojis de rubrique. ⚠️ `exportClipboard` ne s'en sert **pas** encore :
   l'ajouter est un changement de format visible, pas une simple réutilisation.
2. **`groupByCategory`** (`js/app.js:1525-1534`) — réutilisable tel quel ; **ne pas y
   toucher** (ordre contractualisé, partagé par deux formats).
3. **Ordre canonique « coches PUIS état »** (`js/app.js:407-409`) : `replaceShoppingChecked`
   → `applyExternalState`. C'est exactement le motif réclamé par le chantier 5 — il existe
   déjà, il suffit de le copier. ⚠️ `replaceShoppingChecked` **ne persiste ni ne
   synchronise** : c'est le `saveState` interne de `setState` qui doit suivre.
4. **Gardes d'entrée** : `js/app.js:391-397` (type) **+** `js/app.js:301-306` (vide).
5. **`awaitSyncQuiescence()`** (`src/state.js:77-79`), déjà consommée par `resetAllData`.
6. **`__resetSyncEngineForTests()`** (`js/app.js:507-522`, exporté) — indispensable pour un
   test « restauration → cloud » sans pollution entre cas.
7. **Motifs de test déjà écrits** : faux `FileReader` synchrone
   (`tests/actions-data.test.js:123-126`), capture de `Blob` (`:94`), mock `localStorage`
   **par clé** (`tests/sync-scope.test.js:123-135` — un mock qui rend la même valeur pour
   toutes les clés casse `loadState`), `Object.assign(state, ...)` + `shoppingChecked.clear()`,
   faux Firebase en mémoire (`tests/sync-engine.test.js:81-90`), `registerSyncScheduler` en
   `try/finally`, stub de `confirm` (`tests/actions-data.test.js:309-318`).
8. **Structure invariante d'une carte de Réglages** (à respecter pour toute retouche de
   texte) : `button.export-btn.export-{share|backup|danger}` > `span.export-btn-icon` +
   `div` sans classe > `div.export-btn-label` (titre) + `div.export-btn-sub` (sous-titre).

### E. Gaps de couverture (le lot part de zéro sur sa propre zone)

- **AUCUN test n'existe** sur `exportClipboard`, `importJSON`, `restoreJSON`, ni sur la page
  Réglages (`#view-export`). Renommer ou supprimer une carte ne fait échouer **rien**
  aujourd'hui. Le budget de test est plus lourd que l'estimation initiale de ~2 journées.
- **Aucun bouton de Réglages ne porte d'`id`** : les tests devront cibler par texte ou par
  rang dans `.export-grid`. C'est le point le plus fragile du lot.
- **Aucune infrastructure presse-papiers en test** : pas de `setupFiles` dans
  `vite.config.js`. Chaque test devra poser et démonter son propre `navigator.clipboard`
  (via `Object.defineProperty`) et son `document.execCommand`.
- **`.toast.success` n'existe pas en CSS** (seuls `.toast` et `.toast.error`). Les toasts du
  chantier 8 restent donc en type neutre, sauf à ajouter du style — ce qui sortirait du
  « pas de redesign » annoncé.
- **Le second appelant `exportClipboard('cart')` (`js/app.js:711`, barre supérieure du
  LOT 012) n'est couvert que sur son LIBELLÉ** (`tests/topbar-context.test.js:86-90`), pas
  sur son effet. Modifier `exportClipboard` ne fera rien échouer de ce côté.
- **`dist/` est versionné** et contient encore les 4 formats (`dist/index.html:518,525,532,539`
  + le bundle minifié). Après suppression de `'full'`, un `grep` de contrôle les remontera :
  **faux positif attendu**, à consigner dans les 3 recherches convergentes.

### F. Deux constats sur l'oracle qui limitent son autorité ici

- **`EMOJI_CATEGORY_DEFAULTS` n'est pas dans le dépôt.** Le monolithe le charge depuis
  `foodapp-data.js` (l.4225), fichier **jamais versionné**. Le contenu exact des emojis de
  rubrique de l'oracle est donc **invérifiable** — `getCategoryEmoji` reste la seule SSOT
  utilisable, ce qui valide la consigne du chantier 2.
- **Chez l'oracle aussi, `customCartItems` était déjà mort** : annoté `// Deprecated`
  (l.4237), sa seule fonction d'alimentation (l.6107-6114) n'est appelée nulle part, et
  `renderShopping` ne l'affiche pas. La ligne 4829 (« retrait d'un article libre ») est du
  code inatteignable. La branche `custom` du format `cart` était donc **toujours vide en
  pratique** dans l'oracle. Le chantier 3 ne restaure pas un comportement observé : il
  **récupère une donnée réelle** (celle de Joel, arrivée par le cloud) qu'aucun écran ne
  montre plus. Justification inchangée, argumentaire à corriger.

### G. UN ARBITRAGE À FAIRE TRANCHER PAR JOEL (le seul)

**« Importer uniquement le stock » peut laisser des coches fantômes.** La fonction écrit
`target.inCart = !!jsonIng.inCart` (`src/actions.js:248`) **sans jamais purger
`shoppingChecked`**. Un article coché en cours de courses, que le fichier repasse à
« plus à acheter », **reste dans le Set** : invisible à l'écran (`src/ui/shopping.js:42`)
mais **poussé au cloud** (`src/services/firebase.js:61`).

C'est exactement le risque « ids fantômes » que le chantier 10c ferme sur le chemin de
**restauration totale** — mais sur le chemin de **fusion douce**, que le chantier 7 déclare
explicitement « comportement inchangé, seuls les textes bougent ».

- **Option A — corriger aussi ce chemin** : une ligne, cohérence totale des deux imports,
  mais c'est un changement de comportement dans un chantier annoncé « textes seulement »
  (entorse au pare-feu A/B, à assumer et tracer).
- **Option B — laisser en l'état et verser au backlog** : pare-feu A/B respecté à la
  lettre, mais le lot se clôt en sachant qu'une porte de données incohérentes reste ouverte
  juste à côté de celle qu'il vient de fermer.

**DÉCISION DE JOEL (2026-07-30) : OPTION A — on corrige aussi ce chemin.**
Entorse au pare-feu A/B **explicitement autorisée et tracée ici** : le chantier 7 cesse
d'être « comportement strictement inchangé » sur ce point précis. Conditions d'exécution :
- la correction se limite à purger `shoppingChecked` des ids repassés hors panier, rien
  d'autre — la fusion douce (appariement, 4 champs, ajout d'inconnus) ne bouge pas ;
- elle est couverte par son propre test, distinct de ceux du chantier 10c ;
- elle est signalée en clair à l'audit final comme un écart au périmètre initial, décidé
  par Joel, et non comme un débordement de l'exécutant.

---

## Objectif

Chaque bouton de la page Réglages doit produire **exactement ce que son titre et son
sous-titre annoncent**. Aujourd'hui, plusieurs cartes mentent : « Copier mon stock » copie
la liste de courses, « Données techniques (JSON) » copie du texte, la carte « Mise à zéro »
annonce d'effacer la clé API alors qu'elle la conserve. La page est contrôlée comme un
**ensemble cohérent** avant que le LOT 013 ne fige son comportement par des tests et que le
LOT 014 ne déplace `exportClipboard`.

## Périmètre — 10 chantiers (tous les arbitrages tranchés par Joel le 2026-07-30)

### 1. « Copier mon stock (liste simple) » copie… la liste de courses

**Aujourd'hui :** le bouton (`index.html:517-523`) promet « Liste brute de vos ingrédients
disponibles », mais `exportClipboard('simple')` (`js/app.js:1540-1548`) filtre `i.inCart`
(les articles À acheter) sous un en-tête « 🛒 LISTE DE COURSES ».

⚠️ **Découverte : `simple` et `cart` lisent aujourd'hui EXACTEMENT la même source**
(`state.ingredients.filter(i => i.inCart)`, `js/app.js:1542` et `1566`) avec le **même
en-tête** — deux boutons pour la même donnée, seul le groupement diffère. Les chantiers 1
et 3 ne sont donc pas indépendants : ils partagent la même ligne dupliquée, et ne
divergeront qu'après correction.

**Attendu :**
**Oracle (monolithe l.6466-6468, citation exacte) :**
`const inStock = state.ingredients.filter(i => i.inStock)` (l.6466, partagée avec
`categorized`) puis `text = inStock.map(i => i.name).join('\n')` — **le stock, confirmé.**
Régression nette.

**Attendu :**
- utiliser uniquement les ingrédients réellement **en stock** (`inStock`) ;
- en-tête cohérent avec le titre du bouton (stock, pas courses) ;
- état vide honnête : si le stock est vide, le texte copié le dit — pas de toast de succès
  qui laisse croire qu'une liste utile a été copiée (voir chantier 9 : l'oracle avait
  déjà ce garde-fou).

### 2. « Partager mon stock par rayons » embarque tout l'inventaire

**Aujourd'hui :** `exportClipboard('categorized')` (`js/app.js:1555-1563`) parcourt TOUT
`state.ingredients` avec des statuts ✅/🛒/⚪ — les produits absents et ceux seulement mis
aux courses partent dans le partage.

**Attendu :**
**Oracle (monolithe l.6469-6475, citation exacte) :** groupe le **seul** `inStock` par
catégorie, avec l'emoji de rubrique (`EMOJI_CATEGORY_DEFAULTS`) et des lignes `  - nom`,
rubriques séparées par une ligne vide, forme exacte `«emoji» «Catégorie» :` (espace avant
les deux-points). Régression nette.
⚠️ `EMOJI_CATEGORY_DEFAULTS` est un nom du monolithe : l'équivalent modulaire est
`getCategoryEmoji` (`src/data.js:38`, déjà importé par `js/app.js:20`) — ne pas recréer
une seconde table (SSOT §6). **Et c'est OBLIGATOIRE, pas préférable** : le fichier
`foodapp-data.js` qui portait la table du monolithe n'est pas dans le dépôt (découverte §F),
donc les emojis de rubrique de l'oracle sont invérifiables.
⚠️ **Ordre des rubriques : écart assumé.** L'oracle sortait les rubriques dans leur **ordre
de première apparition** dans l'inventaire (objet littéral, pas de tri). L'app trie par
`.sort()` (`js/app.js:1533`, ordre contractualisé par commentaire). **On garde le tri de
l'app** — plus stable et déjà partagé avec le format `cart` ; le pare-feu A/B interdit d'y
toucher pour un chantier qui ne le vise pas.

**Attendu :**
- uniquement les ingrédients **en stock**, regroupés par catégorie ;
- ne pas inclure les produits absents ni ceux seulement placés dans les courses ;
- même exigence d'état vide honnête que le chantier 1.

### 3. « Copier ma liste de courses » oublie les articles libres

**Aujourd'hui :** `exportClipboard('cart')` (`js/app.js:1564-1575`) inclut les ingrédients
`inCart` mais **ignore `state.customCartItems`** (les articles ajoutés à la main dans la
liste de courses).

**Oracle (monolithe l.6476-6479, citation exacte) :**
`[...cart.map(i => i.name), ...custom.map(i => i.name)]` — les deux sources, confirmé.

⚠️ **PIÈGE MAJEUR — `customCartItems` est un champ fantôme dans l'app modulaire.** Aucun
code ne l'écrit ni ne l'affiche aujourd'hui (constat déjà posé par la fiche LOT 007, ligne
216 ; seuls `resetCart`/`resetAllData` le vident). **Mais la donnée existe RÉELLEMENT chez
Joel** : son export du 2026-07-29 contient
`{ id: "extra_cart_...", name: "porc haché", emoji: "🥩", checked: false, source: "ai-extra" }`,
et le champ fait des allers-retours cloud complets (`src/services/firebase.js:19`) — c'est
ce qui l'a maintenu en vie. Autrement dit, cet article est déjà invisible dans l'app —
l'inclure dans la copie **récupère une donnée aujourd'hui perdue de vue**, ça ne crée pas
une fonctionnalité.

⚠️ **CORRECTION de la découverte : ce n'est PAS une « régression nette ».** Chez l'oracle
aussi le champ était mort (`// Deprecated` l.4237, fonction d'alimentation l.6107-6114
jamais appelée, jamais affiché) : la branche `custom` du format `cart` y était **toujours
vide en pratique**. On ne restaure donc pas un comportement observé, on **récupère une
donnée réelle**. La conclusion du chantier ne change pas, sa justification si.

⚠️ **Structure réelle vérifiée** : id préfixé **`extra_cart_`** (et non `custom_`),
`source: 'ai-extra'` (le monolithe écrivait `'custom'`). Champs présents : `id`, `name`,
`emoji`, `checked`, `source`. **Aucun `category`, et `sanitizeGlobalState` ne normalise
JAMAIS ces objets** (`src/state.js:153` se contente de garantir que le tableau existe) —
donc pas de `name` garanti, pas d'emoji garanti non plus.

🔴 **RÈGLE MANQUANTE, ajoutée après l'audit Gemini (Q12).** La fiche constatait l'absence de
garantie sans dire quoi en faire — un objet venu du cloud ou d'un vieux fichier, dépourvu de
`name`, produirait la ligne littérale « undefined » dans la liste copiée par Joel.
**Règle retenue : un article libre sans nom exploitable (`name` absent, non-chaîne, ou vide
après nettoyage) est IGNORÉ à la copie** — jamais rendu, jamais remplacé par un texte de
substitution. L'emoji, lui, retombe sur le repli existant (`i.emoji || '🔸'`). Et si le
filtrage vide entièrement les deux sources, le garde-fou « rien à copier » du chantier 9
s'applique normalement.

**Conséquences à assumer dans ce lot :**
- le test ne peut PAS passer par l'interface (aucun parcours ne crée d'article libre) :
  il injecte la donnée directement dans l'état, comme le fait déjà `tests/sync-scope.test.js` ;
- **les articles libres n'ont pas de `category`** (structure réelle : `id`, `name`, `emoji`,
  `checked`, `source`) → le classement par rayon doit avoir une **règle explicite tranchée
  ici, pas laissée à l'exécutant**. ⚠️ **CORRECTION du 2026-07-30 : surtout PAS `AUTRES`.**
  `Autres` est à la fois une catégorie légitime (`src/data.js:32`, citation exacte) ET le
  repli imposé à tout ingrédient sans catégorie (`src/state.js:173`, citation exacte) : y
  verser les articles libres les mélangerait à de vrais ingrédients, et un test « jamais
  `undefined` » passerait au vert sans rien prouver. **Règle retenue : une rubrique au nom
  distinct et non collidable, du type `[ ARTICLES LIBRES ]`** ;
- **piège d'ordre — la fiche le sous-estimait.** `groupByCategory` trie par `.sort()` brut
  (`js/app.js:1533`), c'est-à-dire par code UTF-16 : `[ ARTICLES LIBRES ]` commence par `[`
  (U+005B), qui tombe **après** les initiales A-S mais **avant `Épices sèches`** (É =
  U+00C9). **Choisir un nom ne suffit donc PAS à mettre la rubrique en fin.** Elle doit être
  **concaténée après la boucle**, en dehors de `groupByCategory` — qui n'est pas modifié
  (partagé avec `categorized`, ordre contractualisé par commentaire `js/app.js:1531-1532` ;
  le pare-feu A/B interdit de changer l'ordre d'un format que ce chantier ne vise pas) ;
- ⚠️ **piège de plantage silencieux (découverte P2) :** `cat.toUpperCase()`
  (`js/app.js:1558` et `1570`) est **HORS du `try/catch`** de la copie. Un article libre qui
  entrerait dans `groupByCategory` avec `category: undefined` ferait échouer la copie **sans
  aucun message** — ni toast, ni erreur visible. La rubrique doit donc être posée **avant**
  d'atteindre ce point, jamais laissée à `undefined` ;
- **hors périmètre :** rebrancher l'ajout/retrait d'articles libres dans l'interface reste
  un sujet à part (à verser au backlog si Joel le souhaite — ce lot ne fait que cesser de
  les ignorer à la copie).

**Attendu :**
- inclure les ingrédients marqués « À acheter » ET les articles libres `customCartItems` ;
- vérifier le résultat vide (les deux sources vides) et le classement par rayon.

### 4. « Données techniques (JSON) » — TRANCHÉ par Joel (2026-07-30) : SUPPRESSION SÈCHE

**Aujourd'hui :** le bouton (`index.html:538-544`) promet « la base technique complète »
en JSON, mais `exportClipboard('full')` (`js/app.js:1549-1554`) produit un texte
d'inventaire à emojis — pas du JSON. (Découverte : **l'oracle avait déjà ce mensonge**,
son format `full` n'est pas du JSON non plus — libellé l.4050, code l.6480-6481.)

**Décision de Joel : supprimer la carte, sans remplacement.** Analyse à l'appui : après
les chantiers 1-3, tous les besoins réels sont couverts (2 formats de partage du stock,
la liste de courses, et le fichier de sauvegarde pour le dépannage) — un 3e format
« inventaire complet » de 297 lignes dans le presse-papiers ne sert personne, et un vrai
JSON presse-papiers ferait doublon avec « Télécharger une sauvegarde ».

⚠️ **ÉCART ASSUMÉ À L'ORACLE — à ne pas traiter comme un défaut par l'audit Dur.** Le
monolithe possédait bien ce format (l.6480-6481 : nom, catégorie et tags `[stock]`
`[courses]` `[épinglé]` `[surgelé]`). La règle de campagne veut que l'oracle prime ; **ici
Joel tranche au-dessus de l'oracle** — le besoin a disparu, la carte s'en va. C'est une
décision produit datée et tracée, pas un oubli de restauration.

**Attendu :**
- retirer la carte d'`index.html` (l.538-544) ET la branche `'full'` d'`exportClipboard`
  (`js/app.js:1549-1554`) ;
- **3 recherches convergentes** avant chaque retrait (`CLAUDE.md` §5) : appel direct,
  accès dynamique (chaîne `'full'`), configuration/scripts annexes.
  **Résultat déjà consigné par la phase découverte, à re-prouver à l'exécution :**
  `'full'` n'a **qu'un seul appelant vivant**, `index.html:538` ; aucun accès dynamique,
  aucun mapping, aucun `data-*` porteur du type ; ⚠️ `dist/` est **versionné** et en garde
  une copie figée (`dist/index.html:539` + bundle minifié) — **faux positif attendu**, à
  citer explicitement pour ne pas faire douter l'audit ;
- ⚠️ **RÉPONSE à la question ouverte de la fiche** : oui, la seconde entrée existe bien dans
  l'app modulaire, mais elle est **en JavaScript, pas dans `index.html`** — `js/app.js:711`,
  bouton `📋 Copier` de la barre supérieure du LOT 012, rendu uniquement sur la vue courses.
  Elle appelle `exportClipboard('cart')`. Conséquence : supprimer `'full'` est **sans
  risque**, mais **toucher à `'cart'` (chantier 3) impacte DEUX boutons**, dont un généré en
  JS et invisible à une recherche dans `index.html` ;
- pare-feu A/B : la suppression ne touche AUCUN autre format de copie.

### 5. Télécharger / Restaurer une sauvegarde — aller-retour cohérent des coches

**Aujourd'hui (preuves, numéros vérifiés à l'ouverture) :**
- `exportJSON` (`src/actions.js:183-199`) exporte `state` seul — **les coches de courses
  `shoppingChecked` n'y sont pas** : c'est un Set séparé (`src/state.js:50`) persisté sous
  sa propre clé (`src/state.js:130`) ;
- restaurer un fichier (`importJSON` → `applyExternalState`, `src/actions.js:201-219`)
  laisse donc en place les **anciennes coches** d'un état précédent ;
- `restoreJSON` (`js/app.js:2433-2436`) ne réarme pas le champ fichier — contrairement à
  `importStockOnly` (`js/app.js:2438-2442`, qui fait `event.target.value = ''`) — donc
  sélectionner **deux fois le même fichier** ne déclenche rien la seconde fois. ⚠️ Le
  réarmement doit être posé **hors du `if (file)`** pour couvrir aussi l'annulation, et il
  est sûr immédiatement après l'appel (la lecture est déjà lancée sur l'objet `File`) —
  c'est exactement ce que fait l'oracle (l.6514) ;
- le sous-titre « Télécharger une sauvegarde » (`index.html:552`) ne dit pas que la
  clé API est exclue de l'export ;
- le sous-titre « Restaurer » (`index.html:559`) annonce « Remplace TOUTES vos données
  actuelles » — **inexact** : `applyExternalState` → `setState` fusionne
  (`{ ...state, ...data }`, `src/state.js:224`), donc **toute clé absente du fichier
  est conservée telle quelle**. Un fichier partiel ne remplace pas tout ;
- ⚠️ **PIÈGE DE LECTURE (découverte P7) : les ids des deux champs fichier sont INVERSÉS par
  rapport à leur rôle.** `#import-file` (`index.html:570`) déclenche la **restauration
  totale** ; `#restore-file` (`index.html:571`) la **fusion douce**. Le monolithe avait le
  câblage inverse (l.4079-4080) : la migration a renommé les fonctions sans renommer les
  ids. Ne jamais se fier au nom de l'id — lire les deux lignes ensemble.

⚠️ **RISQUE PRINCIPAL DU LOT — l'articulation avec la synchro cloud (LOT 007), à traiter
explicitement, c'est ce qui justifie le niveau d'audit DUR :**
- `applyExternalState(data)` planifie un **envoi cloud par défaut** (`scheduleSync = true`,
  `src/state.js:245`) : une restauration de fichier PART vers le cloud ;
- les coches vivent hors de `state` (Set séparé) et le périmètre du document synchronisé
  les inclut (LOT 007 §4.1, `src/services/firebase.js:61`, `tests/sync-scope.test.js`). Donc
  si la restauration remplace les coches, ce remplacement doit être fait **AVANT** la
  sauvegarde/l'envoi, pour que l'état et les coches partent dans le **même** document ;
- sinon : fenêtre d'incohérence où le cloud reçoit le nouvel inventaire avec les
  ANCIENNES coches — exactement le risque « données incohérentes » que ce lot doit fermer ;
- ✅ **le motif exact existe déjà, il suffit de le copier** : `js/app.js:407-409` fait
  `extractSyncedState` → `replaceShoppingChecked(checkedIds)` → `applyExternalState(patch,
  { scheduleSync: false })`. ⚠️ `replaceShoppingChecked` (`src/state.js:86-89`) **ne
  persiste ni ne synchronise rien** : dans l'ordre inverse, les coches ne partiraient ni sur
  le disque ni au cloud ;
- vérifier aussi le sens inverse : une restauration ne doit pas être écrasée par un pull
  concurrent (réutiliser les garde-fous du LOT 007, ne pas en réinventer) ;
- ⚠️ **CORRECTION DE LA DÉCOUVERTE (P6) — la fiche affirmait « rien à ajouter » côté
  LOT 007. C'est vrai pour un pull concurrent** (garde d'empreinte `js/app.js:398-403`),
  **faux pour un envoi déjà en vol.** `importJSON` (`src/actions.js:201-219`) n'appelle
  **pas** `awaitSyncQuiescence()`, contrairement à `resetAllData` (`src/actions.js:123`).
  Un envoi parti avant le clic peut donc aboutir **après** la restauration et réécrire
  l'ancien état dans le cloud — c'est exactement l'incident déjà corrigé au LOT 008 sur le
  chemin du reset. **La barrière doit être posée sur le chemin de restauration.**
  ⚠️ **Précision de l'audit Gemini (Q6) :** la barrière est transposable, mais **pas son
  environnement** — `resetAllData` se termine par un rechargement de page, ce qui masque
  beaucoup d'états intermédiaires ; la restauration de fichier, elle, continue de vivre.
  Conséquence pratique : le rappel `reader.onload` de `importJSON` (`src/actions.js:203`)
  est aujourd'hui **synchrone** et devra devenir asynchrone pour pouvoir attendre la
  barrière. Ce détail change la forme du code, pas la règle.

**Attendu :**
- définir un aller-retour cohérent pour `shoppingChecked` : la sauvegarde emporte les
  coches, la restauration les remplace — restaurer un fichier ne conserve JAMAIS les
  coches d'un état précédent ;
- compatibilité avec les anciennes sauvegardes dépourvues de ce champ (comportement
  défini et testé, pas un plantage ni des coches fantômes) ;
- réarmer le champ fichier après CHAQUE tentative (réussite, erreur, format non reconnu)
  pour pouvoir resélectionner le même fichier ;
- textes honnêtes : rappeler que la clé API locale est **exclue de l'export** et
  **conservée à la restauration** (comportement LOT 008, casses C3a/C3b) ;
- décider et écrire **où** les coches vivent dans le fichier — ⚠️ **voir le chantier 10b
  AVANT de choisir** : une clé posée naïvement à la racine crée un doublon dans l'état et
  casse la compatibilité descendante. Le format retenu doit être documenté dans la fiche
  à l'exécution ;
- **compatibilité descendante** : vérifier ce que fait réellement la 5.5 en ligne d'un
  fichier neuf — l'hypothèse « le champ inconnu est ignoré » est **fausse** telle quelle
  (chantier 10b) ; c'est le format choisi qui doit la rendre vraie.

### 6. « Mise à zéro complète » — le texte de la carte contredit le code

**Aujourd'hui :** la carte (`index.html:581-587`, titre l.584, sous-titre l.585) annonce
« Efface absolument tout (Stock, Favoris, Config) », mais `resetAllData`
(`src/actions.js:111-176`, clé préservée l.125 et l.134) **conserve la clé API** (et le dit
dans son propre confirm) ; le reset est aussi poussé vers le cloud.

**Attendu :**
- conserver le comportement sûr du LOT 008 tel quel (sérialisation avec la synchro, push
  explicite, suggestions IA purgées) — on ne touche PAS au code du reset sans nécessité ;
- corriger le **texte de la carte** : l'inventaire, les favoris et les réglages IA sont
  réinitialisés, la clé API est conservée ;
- préciser que la remise à zéro vise **aussi le cloud**.

### 7. Non-régressions (garde-fous du lot)

- « Importer uniquement le stock » reste une **fusion douce** (pas un remplacement) —
  son COMPORTEMENT ne bouge pas, seuls ses textes sont corrigés (chantier 8) ;
- « Réinitialiser mon panier » continue de vider les ingrédients à acheter,
  `customCartItems` ET `shoppingChecked` (`src/actions.js:96-103` — verrouillé par
  `tests/actions-data.test.js:309-318` ; le test devra stubber `confirm`) ;
- aucune régression des protections du LOT 008 (clé API jamais exportée, point d'entrée
  unique `applyExternalState`, reset sûr).

### 8. Clarté UX de la page (décisions Joel 2026-07-30) — textes et retours, pas de redesign

**Pare-feu A/B strict : ce chantier ne change que des libellés et des messages, jamais un
comportement** (à la seule exception des toasts chiffrés, qui font partie du comportement
attendu des chantiers 1-3).

- **Titres de sections orientés intention, sans jargon** : « Copier dans le
  presse-papiers » → « Partager » · « Fichier JSON » → « Sauvegarde » (le mot JSON reste
  admis dans les sous-titres pour décrire le fichier).
- **Toasts de copie honnêtes et chiffrés** : « Stock copié (23 ingrédients) », « Liste de
  courses copiée (8 articles) »… et état vide explicite (« Votre stock est vide — rien à
  copier ») au lieu du générique actuel, dont le texte réel est
  **`'Copié dans le presse-papiers !'`** (`js/app.js:1580`) et non « Copié ! ».
  ⚠️ **Écart à l'oracle assumé** : le monolithe n'affiche **aucun** toast chiffré
  (`📋 Copié dans le presse-papiers` au succès, `📋 Copié` au repli). Les toasts chiffrés
  sont une **décision produit de Joel au-dessus de l'oracle**, comme la suppression du
  chantier 4 — à ne pas traiter comme un défaut par l'audit Dur.
  ⚠️ **Contrainte de style** : `.toast.success` **n'existe pas** en CSS (seuls `.toast` et
  `.toast.error`, `css/style.css:2909` et `2921`). Les toasts de succès restent donc en type
  neutre — ajouter le style sortirait du « pas de redesign » annoncé par ce chantier.
- **La paire Restaurer / Importer uniquement le stock doit devenir limpide** (constat
  Joel 2026-07-30 : distinction pas claire) :
  - « Restaurer une sauvegarde » = **remplacement total** — le sous-titre doit le dire
    en une phrase simple (tout est remplacé par le fichier, clé API locale conservée) ;
  - « Importer uniquement le stock » = **fusion douce** — sous-titre actuel
    (`index.html:566`) doublement inexact : il ne met pas à jour que la « disponibilité »
    (il applique **quatre** champs — `inStock`, `inCart`, `pinned` ET `frozen`,
    `src/actions.js:247-250` ; la fiche en annonçait trois) et il peut **ajouter** des
    ingrédients inconnus (`src/actions.js:252-258`). Réécrire le sous-titre pour dire la
    vérité, SANS changer le comportement ;
  - son toast dit « 📥 Restauration : X mis à jour, Y ajoutés » (`src/actions.js:262`) —
    le mot « Restauration » entretient la confusion avec le bouton d'à côté : reformuler
    (ex. « Stock fusionné : X mis à jour, Y ajoutés ») ;
  - les deux boutons acceptent le même fichier (celui de « Télécharger une sauvegarde ») :
    les sous-titres doivent le rendre évident.

### 9. Deux régressions de copie révélées par l'oracle (relecture du 2026-07-30)

Absentes du brief initial — trouvées en relisant `exportClipboard` du monolithe.

- **Le garde-fou « rien à copier » a été perdu.** Le monolithe sortait AVANT toute copie
  quand le texte était vide : `if (!text) { toast('Rien à copier', 'error'); return; }`
  (l.6483, citation exacte). Aujourd'hui, un stock vide copie quand même un en-tête suivi de
  « (Vide) » et affiche un toast de succès.

  🔴 **CORRECTION MAJEURE — AUDIT GEMINI DU 2026-07-30 (Q1), vérifiée sur pièce.**
  La fiche affirmait : « restaurer ce garde-fou les règle tous d'un coup — une seule
  correction, pas quatre (SSOT) ». **C'EST FAUX, et le porter tel quel ne corrigerait
  RIEN.** Chez l'oracle, `text` reste vide quand il n'y a pas de données, donc `if (!text)`
  se déclenche. Dans l'app modulaire, **chaque branche commence par écrire un en-tête** :
  `js/app.js:1541`, `1550`, `1556`, `1565` assignent `🛒 LISTE DE COURSES (date)` ou
  `📦 INVENTAIRE PAR RAYON (date)` **avant** de regarder les données. `text` n'est donc
  **jamais** vide pour un type connu, et le garde-fou porté à l'identique ne se
  déclencherait **que** pour un type inconnu.

  → **Règle retenue : le garde-fou teste la SOURCE, pas le texte final.** Chaque format
  détermine d'abord son jeu de données (`inStock`, `inCart` + `customCartItems`, …) ;
  **si ce jeu est vide, on sort avant toute écriture** — pas d'en-tête, pas d'appel au
  presse-papiers, message d'erreur. L'en-tête n'est composé qu'une fois la source jugée
  non vide. C'est bien UNE seule correction (SSOT), mais **pas celle que la fiche
  décrivait**.

  ⚠️ **Découverte P1 — il y a un CINQUIÈME cas** : `exportClipboard` n'a **aucune branche
  `else`** (`js/app.js:1576`). Un type inconnu laisse `text = ''`, écrit une chaîne vide
  dans le presse-papiers **et affiche le toast de succès**. C'est le **seul** cas que le
  garde-fou de l'oracle aurait attrapé tel quel. Il doit rester couvert et testé.
- **Le repli de copie a été perdu.** Le monolithe, si `navigator.clipboard` échouait,
  retombait sur un `<textarea>` + `document.execCommand('copy')` (l.6484-6486, le repli
  tenant sur la seule l.6485). Aujourd'hui l'échec donne juste « Erreur lors de la copie »
  (`js/app.js:1581-1583`) et l'utilisateur n'a aucun recours. À restaurer (contexte non
  sécurisé, navigateur ancien, permission refusée).
  ⚠️ **Ne pas porter l'oracle à l'identique** : son repli n'a **aucune garde d'existence**
  sur `document.execCommand` et **ne lit pas son retour booléen** (qui vaut `false` en cas
  d'échec silencieux). Le copier tel quel reproduirait un bug — sous jsdom **et** sur
  navigateur. Le portage doit vérifier l'existence de la fonction et son résultat.

**Écart assumé sur le FORMAT des lignes :** le monolithe copiait des noms nus
(`i.name`), **sans aucun en-tête global** (ni titre, ni date, ni compteur) ; l'app actuelle
ajoute un en-tête daté, l'emoji et un marqueur de statut. **On garde le format actuel**,
plus lisible pour un partage — écart délibéré à l'oracle, tracé ici pour l'audit Dur.

⚠️ **Précision de l'audit Gemini (Q15) — le 4ᵉ écart, désormais DÉCLARÉ.** L'oracle
produisait pour `cart` une **liste plate de noms nus** (l.6479), sans regroupement par rayon
et sans case `☐`. L'app groupe par rubrique `[ CATÉGORIE ]` et préfixe chaque ligne d'un `☐`
(`js/app.js:1569-1572`). **On garde le format de l'app** — une liste de courses cochable par
rayon est plus utile en magasin qu'une liste plate. Le lot compte donc **quatre** écarts
assumés au-dessus de l'oracle, pas trois : suppression du bouton JSON (ch. 4), toasts
chiffrés (ch. 8), coches dans le fichier de sauvegarde (ch. 5), et ce regroupement.

⚠️ **Précision de l'audit Gemini (Q2) — le « toujours ✅ » ne concerne QU'UN format.**
La fiche citait `js/app.js:1552` et `1560` : la première est la branche `full`, **qui
disparaît au chantier 4** (point sans objet), et `simple` (l.1546) n'a **aucun** marqueur
tandis que `cart` (l.1572) utilise `☐`, pas `✅`. **Seul `categorized` (l.1560) est
concerné.** L'arbitrage se réduit donc à : garder ou retirer le `✅` du format « par
rayons » une fois sa source restreinte à `inStock`. À trancher à l'exécution.

### 10. Le PÉRIMÈTRE du fichier de sauvegarde — 2 blocages trouvés à l'audit du 2026-07-30

**C'est le point le plus grave de la relecture, et il conditionne tout le chantier 5.**

**a) BLOQUANT — la sauvegarde emporte l'état d'écran, et le restaurer casse l'affichage.**
`exportJSON` sérialise `state` en ENTIER (`src/actions.js:186`) : partent donc dans le
fichier `currentView`, `search`, `filter`, `showInStockOnly`, `showInCartOnly`,
`aiSuggestions`, `currentSuggestionIdx`, `lastSync` (`src/state.js:40-47`, citation exacte).
Au démarrage, `loadState` neutralise explicitement recherche et filtres
(`src/state.js:111-114`, citation exacte, commentaire « for safety ») — **mais
`applyExternalState` ne le fait jamais** (`src/state.js:245-254` → `setState` →
`sanitizeGlobalState`, qui n'y touche pas). Conséquence concrète pour Joel : une sauvegarde
faite pendant qu'un filtre « en stock » ou une recherche étaient actifs, une fois restaurée,
**affiche un inventaire filtré ou vide**. `currentView` restauré fait en plus changer
d'écran tout seul (`renderCurrentView`, `js/app.js:587-605`, l'applique bien).
**L'oracle faisait juste :** liste blanche à l'export (l.6490) et `switchView('pantry')`
après import (l.6509). C'est donc une **régression de migration supplémentaire**, non
répertoriée jusqu'ici.

⚠️ **DEUX CORRECTIONS DE LA DÉCOUVERTE sur ce chantier :**
- **« rien ne réécrit le champ de recherche — `js/app.js:708-713` » est FAUX.** Sur le
  bureau, `js/app.js:695-696` réécrit bien `#search-input.value = state.search` à chaque
  rendu de la barre supérieure. Le champ qui n'est **jamais** réalimenté est
  `#mobile-search` (`index.html:253`). Le symptôme « boîte vide mais filtre actif »
  **n'existe donc que sur mobile** — l'usage principal de Joel : le chantier reste
  entièrement valide, mais pour la bonne raison. (La citation `708-713` désignait en
  réalité les boutons de la barre supérieure du LOT 012.)
- **« liste blanche de 5 clés » : l'oracle en a SIX.** `ingredients`, `favorites`,
  `customCartItems`, `extraIngredients`, `aiConfig` (clé vidée) **et `exportedAt`**.
- **« comme le fait déjà `loadState` » ne couvre PAS la vue** : `loadState` neutralise
  `search`, `filter`, `showInStockOnly`, `showInCartOnly` — **pas `currentView`**.
  Neutraliser la vue est un ajout, pas une copie d'un comportement existant.
- ⚠️ **Le champ des coches dans le fichier est une NOUVEAUTÉ, pas une restauration** :
  **l'oracle non plus n'exportait pas les coches** (Set hors `state` chez lui aussi,
  jamais relu à l'import). Écart produit assumé, au même titre que les chantiers 4 et 8.

→ **Attendu : définir une LISTE BLANCHE explicite du fichier de sauvegarde** (données
durables uniquement : inventaire, favoris, extras, articles libres, réglages IA sans clé,
coches) + un horodatage `exportedAt` (l'oracle l'avait, l'app l'a perdu). Et **neutraliser
recherche/filtres ET vue à la restauration**.

**b) BLOQUANT — mettre les coches « à la racine du fichier » créerait un doublon dans
l'état (violation SSOT §6).** `setState` fusionne (`{ ...state, ...data }`,
`src/state.js:224`) : une clé `shoppingChecked` dans le fichier deviendrait un **tableau
`state.shoppingChecked`** cohabitant avec le **Set** `shoppingChecked` (`src/state.js:50`)
— deux représentations de la même donnée. Rien ne l'élague, elle serait persistée puis
re-exportée indéfiniment. Cela **invalide aussi la compatibilité descendante annoncée** :
la 5.5 en ligne n'ignorerait pas le champ, elle l'absorberait et le figerait.

→ **Attendu : les coches entrent par `replaceShoppingChecked` (`src/state.js:86-89`,
citation exacte), pas par le `spread` de `setState`.** Le champ du fichier doit être extrait
AVANT et retiré de l'objet passé à `applyExternalState`. Vérifier ensuite qu'aucune clé
fantôme ne subsiste dans `state`.

🔴 **DÉCISION DE FORMAT, prise après l'audit Gemini (Q9) — la fiche la renvoyait à
« l'exécution » sans la trancher.** Gemini confirme qu'**aucune clé de racine n'est sûre** :
le `spread` de `setState` absorbe tout, et la 5.7 en ligne figerait le champ dans son état
puis le re-exporterait indéfiniment. Ce n'est pas une perte de données (la construction du
document cloud se fait clé par clé, `src/services/firebase.js:54-63`, et n'emporte donc pas
l'orpheline), mais c'est une violation SSOT qui se propage.

**Format retenu, en deux volets :**
1. **Le champ s'appelle `shoppingChecked`, à la racine du fichier** — nom honnête et lisible,
   plutôt qu'un alias obscur qui ne protégerait de rien puisque aucune racine n'est sûre.
   La nouvelle version l'**extrait et le supprime** de l'objet avant `applyExternalState`.
2. **Filet de rattrapage dans `sanitizeGlobalState` : la nouvelle version élague
   `state.shoppingChecked` s'il existe.** Ainsi, si Joel restaure un fichier neuf sur un
   appareil resté en 5.7 (cache navigateur, second téléphone), la clé orpheline créée là-bas
   **disparaît d'elle-même** au passage en 5.8. La compatibilité descendante devient vraie
   *par réparation*, à défaut de pouvoir l'être *par prévention*.

⚠️ Ce filet doit être testé pour ce qu'il est : un état d'entrée contenant
`state.shoppingChecked` (comme après un aller-retour 5.7) doit ressortir **sans** cette clé,
et le Set doit rester la seule représentation.

**c) Les coches restaurées doivent être filtrées.** Le LOT 008 (chantier 7) garantit que le
Set ne contient que des ids réellement « à acheter » (verrouillé par
`tests/actions-data.test.js:308-340`). Une restauration brute réintroduirait des ids
fantômes, invisibles à l'écran (`src/ui/shopping.js:42`, citation exacte) mais poussés au
cloud (`src/services/firebase.js:61`, citation exacte). → ne garder que les ids présents
dans l'inventaire restauré et marqués `inCart`.

**d) Un fichier à inventaire VIDE passe la garde d'entrée.** `importJSON` ne teste que la
présence de `data.ingredients` (`src/actions.js:206`) — or `[]` est « vrai ».
`sanitizeGlobalState` reconstruit alors les 297 ingrédients par défaut
(`src/state.js:161-169`, citation exacte) et l'envoi cloud part quand même.

⚠️ **DEUX CORRECTIONS DE LA DÉCOUVERTE sur ce point :**
- **C'est pire que « `[]` est vrai » (P5).** La garde accepte aussi une **chaîne** :
  `"ingredients": "abc"` passe, `sanitizeGlobalState` (`src/state.js:147-151`) fait
  `Object.values()` dessus → `['a','b','c']` → filtré à `[]` → **reconstruction des 297 par
  défaut** → envoi cloud. La garde doit donc tester `Array.isArray(...) && length > 0`.
- **« s'aligner sur la garde du chemin cloud, plus stricte » ne suffit PAS (P4).** La garde
  d'entrée du pull (`js/app.js:391-397`) n'est plus stricte que sur le **type**
  (`Array.isArray`) : elle **accepte `[]`**. La protection du vide vit ailleurs, côté
  **sortie** — `js/app.js:301-306`. Il faut donc combiner les **deux**, pas copier la
  première.

## Frontières avec les autres lots

- **LOT 011** : la carte « Transformer un texte en recette » (lecture URL propre, titre
  automatique, nettoyage des champs, aperçu) reste au LOT 011 — hors périmètre ici.
- **LOT 012** : la barre supérieure de Réglages reste au LOT 012.
- **LOT 013** (après ce lot) — ⚠️ **CHEVAUCHEMENT À TRANCHER AVANT OUVERTURE.** La fiche
  du LOT 013 se réserve nommément la ligne « `exportClipboard` | 1 test par format + état
  vide + ordre conservé » (`LOT 013 …md:37`), alors que le plan de test ci-dessous exige
  déjà un test par format. **Règle retenue : le LOT 015 écrit les tests de ce qu'il
  CORRIGE** (c'est la preuve de sa propre correction, et la gouvernance interdit de dire
  « fini » sans preuve) ; **le LOT 013 retire ces lignes de son périmètre** et se concentre
  sur ce qu'il est seul à couvrir. À répercuter dans la fiche du LOT 013 au moment de
  l'ouverture de ce lot. Aligner aussi la MÉTHODE : le LOT 013 §D impose l'accès **via
  `window`** et interdit l'extraction (l.67-79) — le LOT 015 doit suivre la même
  convention, donc **ne pas ajouter `exportClipboard` au bloc `export {}`**
  (`js/app.js:526-585`) : la fonction n'est exposée que sur `window` (helper `expose`
  `js/app.js:54-58`, appel `js/app.js:2639-2661`, `exportClipboard` en l.2657), et c'est
  suffisant pour la tester. ✅ **Vérifié à la découverte** : `exportClipboard` n'est
  effectivement PAS dans le bloc `export {}` — rien à changer de ce côté. Idem pour
  `restoreJSON`, `importStockOnly`, `resetCart`, `resetAllData`, `exportJSON` : toutes
  exposées sur `window` uniquement (les cinq dernières restant testables directement via
  leurs exports ESM natifs dans `src/actions.js`).
- **LOT 014** : déplacera ensuite `exportClipboard` hors de `js/app.js` **sans changer
  son comportement** (ce lot-ci fixe le comportement, le 014 déplace le code).

## Plan d'attaque — 3 sous-lots, risque croissant (proposé le 2026-07-30)

Même logique qu'au LOT 012 : on code du moins risqué au plus risqué, chaque sous-lot est
commité et testé séparément, et le plus dangereux passe en dernier — quand le filet de
tests de la zone existe déjà.

### Sous-lot A — Le presse-papiers (chantiers 1, 2, 3, 4, 9 + les toasts du 8)

Tout tient dans `exportClipboard` (`js/app.js:1536-1585`) et dans la carte à supprimer
(`index.html:538-544`). Ordre interne :
1. **Le garde-fou « rien à copier » d'abord** (chantier 9), **dans sa version corrigée par
   l'audit Gemini** : il teste la **source de données**, pas le texte final — sinon il ne
   se déclenche jamais, les en-têtes étant écrits avant toute vérification. Concrètement :
   chaque format calcule d'abord son jeu de données, sort immédiatement si ce jeu est vide,
   et ne compose l'en-tête qu'ensuite. Une seule correction ferme bien les cinq cas, mais
   **pas** par un simple `if (!text)`.
2. Le **repli de copie** (chantier 9), avec garde d'existence et lecture du retour.
3. Les **sources** : `simple` → `inStock`, `categorized` → `inStock` groupé avec
   `getCategoryEmoji`, `cart` → `inCart` **+** `customCartItems`.
4. La **rubrique des articles libres**, concaténée APRÈS la boucle (jamais via
   `groupByCategory`, qu'on ne touche pas).
5. La **suppression sèche** de `'full'` + de sa carte, avec les 3 recherches convergentes
   consignées (et le faux positif `dist/` cité).
6. Les **toasts chiffrés** et les messages d'état vide.

⚠️ Point de vigilance : `'cart'` a **deux** boutons (la carte de Réglages et
`js/app.js:711`, barre supérieure). Les deux doivent être vérifiés.

**Preuve :** `tests/export-clipboard.test.js` (neuf), avec son propre stub de
`navigator.clipboard` et de `document.execCommand`.

✅ **FAIT le 2026-07-30 — 27 tests, validation unifiée verte (383/383 Vitest, 13/13
verrous).** Décisions prises à l'exécution, toutes traçées :
- **Le garde-fou porte sur la source** : `buildClipboardText(type)` renvoie l'en-tête, le
  corps et le **compte de la source** séparément ; `exportClipboard` sort avant toute
  écriture si le compte est nul. Un type inconnu renvoie `null` → « Rien à copier ».
- **Marqueur ✅ retiré** du format « par rayons » (arbitrage Q2) : la source étant
  restreinte au stock, il aurait toujours valu ✅.
- **En-têtes rendus honnêtes** : `✅ MON STOCK` et `📦 MON STOCK PAR RAYON` — les deux
  annonçaient auparavant une liste de courses ou un inventaire complet.
- **Repli de copie durci** : garde d'existence sur `document.execCommand`, lecture de son
  retour booléen, nettoyage du `<textarea>` même en cas d'échec.
- **Second point d'entrée couvert** : le bouton `📋 Copier` de la barre supérieure est
  désormais **cliqué** dans un test, plus seulement lu.
- **3 recherches convergentes sur `'full'` consignées** : aucun appel JS, aucun `onclick`
  restant, aucun accès dynamique. Seules occurrences restantes : l'oracle (référence en
  lecture seule), les fiches, et `dist/` (artefact de build versionné, faux positif attendu
  et annoncé, régénéré par `npm run build`).

### Sous-lot B — Les textes des cartes (chantier 6 + reste du 8)

Aucun comportement touché : titres de sections (« Partager », « Sauvegarde »), sous-titre
honnête de « Mise à zéro complète » (clé API conservée, le cloud aussi est remis à zéro),
paire Restaurer / Importer-stock rendue limpide, toast « Stock fusionné » au lieu de
« Restauration ». On ne modifie que le contenu de `.export-btn-label` et
`.export-btn-sub` — la structure de carte reste intacte.

**Preuve :** test léger sur les libellés + relecture visuelle de Joel.

✅ **FAIT le 2026-07-30 — 15 tests (`tests/settings-labels.test.js`).** Le test lit le
**vrai `index.html`** (aucun test du dépôt ne le faisait) et cible les boutons par leur
`onclick`, **jamais par leur texte** : chercher une carte par son libellé pour ensuite
vérifier ce libellé serait circulaire, et aucun bouton de la page ne porte d'`id`.

Textes réécrits :
- sections « Copier dans le presse-papiers » → **« Partager »**, « Fichier JSON » →
  **« Sauvegarde »** ;
- « Copier ma liste de courses » annonce désormais les **articles libres** qu'elle inclut ;
- « Télécharger une sauvegarde » prévient que **la clé API n'est jamais écrite** ;
- « Restaurer une sauvegarde » dit **REMPLACE TOUT** + clé locale conservée ;
- « Importer uniquement le stock » dit la vérité : **le MÊME fichier, en douceur**, les
  **quatre** états repris (stock, à acheter, épinglé, surgelé) et l'**ajout** d'inconnus —
  l'ancien texte n'en disait aucun ;
- « Mise à zéro complète » ne prétend plus effacer la clé API (le code la conserve) et
  précise que **le cloud est visé aussi** ;
- son toast passe de « 📥 Restauration : … » à **« 🔄 Stock fusionné : … »**, le mot
  « Restauration » entretenant la confusion avec le bouton voisin.

**Hors fiche, trouvé à la découverte et corrigé ici** (texte pur, même sous-lot) :
l'infobulle du bouton qui ouvre les Réglages affichait « Ouvrir les **rglages** »
(`index.html:205`) — accents perdus à un moment de l'historique.

**Écart de périmètre assumé** : le sous-titre de « Réinitialiser mon panier » a lui aussi
été corrigé (il annonçait « décoche les articles à acheter » alors qu'il **vide aussi les
articles libres**). Le chantier 7 garantit son COMPORTEMENT, pas son texte — et ce texte
devenait trompeur maintenant que les articles libres sont visibles à la copie.

### Sous-lot C — Sauvegarde et restauration (chantiers 5, 7, 10a-d + §G)

Le cœur du risque, donc en dernier. Ordre interne :
1. **Liste blanche d'export** + `exportedAt` (chantier 10a).
2. **Gardes d'entrée durcies** : tableau NON vide, en combinant les deux gardes existantes
   (chantier 10d + P4 + P5).
3. **Barrière de synchro** sur le chemin de restauration (P6), sur le modèle de
   `resetAllData`.
4. **Coches** : format de fichier hors racine, entrée par `replaceShoppingChecked` AVANT
   `applyExternalState`, filtrage des ids fantômes (10b + 10c).
5. **Neutralisation** recherche / filtres / vue à la restauration (10a).
6. **Réarmement** du champ fichier, hors du `if (file)` (chantier 5).
7. **§G** : purge des coches devenues sans objet sur le chemin de fusion douce.

**Preuve :** `tests/backup-restore.test.js` (neuf), avec faux `FileReader`, faux Firebase
et `__resetSyncEngineForTests`.

✅ **FAIT le 2026-07-30 — 28 tests. Validation unifiée verte : 430/430 Vitest, 13/13
verrous, build de production OK.**

Décisions et points de mise en œuvre, tous traçés :
- **SSOT du périmètre du fichier** : `BACKUP_STATE_KEYS` (`src/constants.js`) sert **à la
  fois** à l'export et à la restauration — une seule liste, pas deux qui dérivent. Les
  coches et `exportedAt` sont ajoutés explicitement à côté, hors de la liste d'état.
- **SSOT de la neutralisation d'écran** : `resetScreenState({ resetView })`
  (`src/state.js`), désormais partagé par `loadState` (sans la vue, on rouvre l'app là où
  on l'a quittée) et par la restauration (avec la vue, comme l'oracle l.6509). La règle
  n'existait que dans `loadState`, ce qui expliquait le défaut.
- **Ordre d'écriture** : coches filtrées → neutralisation d'écran → `applyExternalState`.
  L'état et les coches sont donc en place **avant** que l'envoi cloud soit planifié : un
  test le vérifie en inspectant ce que voit le planificateur au moment où il est appelé.
- **`reader.onload` est devenu asynchrone** pour pouvoir attendre `awaitSyncQuiescence()`.
- **Les anciens fichiers ne sont pas rejetés** : leurs champs d'écran sont simplement
  ignorés (ils ne sont pas dans la liste blanche), et l'absence du champ des coches vide le
  Set au lieu de laisser survivre les anciennes.

⚠️ **Discipline de preuve appliquée au test le plus douteux.** Les deux tests du
réarmement du champ fichier étaient d'abord **tautologiques** : jsdom interdit d'affecter
une valeur non vide à un `input[type=file]`, donc lire `champ.value === ''` passait au vert
**sans le correctif**. Ils ont été réécrits avec un accesseur témoin qui part d'une valeur
non vide, puis **vérifiés en retirant temporairement le correctif** : attendu écrit
d'avance (« les 2 tests doivent échouer »), résultat conforme (2 échecs), correctif remis.

---

## Audit de spec — Gemini 3.6 Flash, 2026-07-30 : **NO-GO, 4 points** → tous intégrés

Premier audit du dispositif de remplacement de Codex. Brief en 15 questions **fermées**
(réponse imposée : OUI/NON + `fichier:ligne` + citation littérale) + 3 questions ouvertes
bornées — méthode choisie pour contrer sa faiblesse connue (affirmer sans rouvrir le
fichier). **Chaque point a été revérifié sur pièce avant intégration.**

| # | Finding | Vérifié | Traitement |
|---|---|---|---|
| **Q1** | Le garde-fou « rien à copier » porté tel quel **ne se déclencherait jamais** : chaque branche écrit un en-tête dans `text` avant de regarder les données (`js/app.js:1541,1550,1556,1565`) | ✅ **CONFIRMÉ sur pièce** | 🔴 **Correction majeure** — le garde-fou teste désormais la **source**, pas le texte final. Chantier 9 et sous-lot A réécrits. |
| **Q9** | Aucune clé de racine n'est sûre pour les coches ; la 5.7 absorberait et figerait le champ | ✅ Confirmé — risque déjà connu (§10b), mais **décision jamais prise** | Format tranché : champ `shoppingChecked` à la racine, extrait avant `applyExternalState`, **+ élagage de rattrapage** dans `sanitizeGlobalState` |
| **Q12** | Un article libre sans `name` produirait la ligne « undefined » | ✅ Confirmé — constat présent, **règle absente** | Règle ajoutée : article sans nom exploitable **ignoré** à la copie |
| **Q15** | Le regroupement par rayon + `☐` du format `cart` est un **4ᵉ écart** à l'oracle, non déclaré | ✅ Confirmé (oracle l.6479 = liste plate de noms nus) | Écart déclaré ; le lot en compte **quatre**, pas trois |

**Deux précisions utiles hors « à corriger »**, également intégrées :
- **Q2** — le « toujours ✅ » ne concerne que `categorized` : `full` disparaît, `simple` n'a
  pas de marqueur, `cart` utilise `☐`. L'arbitrage se réduit à un seul format.
- **Q6** — la barrière de synchro est transposable, mais `reader.onload` devra devenir
  **asynchrone** pour pouvoir l'attendre.

**Confirmations obtenues (aucune action) :** Q3 (non-régression du cas nominal), Q4 (les
ingrédients ont toujours une catégorie, les articles libres ne passant pas par
`groupByCategory`), Q5 (le type inconnu reste couvert), Q7 (l'ordre coches → état du chemin
cloud est bien le bon modèle), Q8 (aucune donnée durable absente de la liste blanche), Q10
(un ancien fichier se restaure proprement), Q11 (**aucun test existant mis en péril par la
correction du §G** — revérifié : `tests/actions-data.test.js` ne touche `shoppingChecked`
que dans son chantier 7, qui ne teste pas `importStockOnly`), Q13 (l'ordre des sous-lots
n'a pas de dépendance inverse), Q14 (pas de concurrence possible, JavaScript est
mono-tâche).

**Questions ouvertes :** O1 désigne le risque d'envoi en vol — **déjà couvert** par la
barrière du sous-lot C (P6). O2 (divergence de `customCartItems` entre deux appareils) et
O3 (restauration hors ligne puis reconnexion) décrivent des comportements **du moteur de
synchro du LOT 007**, antérieurs à ce lot et non aggravés par lui → **versés au backlog**,
hors périmètre (les élargir ici ferait dériver un lot déjà plus lourd que prévu).

---

## Plan de test

⚠️ **Contrainte d'environnement mesurée le 2026-07-30 :** sous jsdom, `navigator.clipboard`
**et** `document.execCommand` sont `undefined`. Conséquences obligatoires :
- chaque test de copie doit **simuler `navigator.clipboard`**, sinon le `try` de
  `js/app.js:1578-1584` avale une erreur et le test valide en réalité le chemin d'échec ;
- le repli de copie ne peut être prouvé que par **espionnage d'un `execCommand` simulé** —
  et le code du repli doit **vérifier l'existence de `document.execCommand` avant de
  l'appeler**, sinon il plante en test (et sur certains navigateurs).

⚠️ **Confirmé et aggravé par la découverte :** `vite.config.js` n'a **aucun `setupFiles`**,
donc aucun mock global — chaque fichier de test devra poser ET démonter son propre
`navigator.clipboard` (par `Object.defineProperty`, la propriété n'étant pas modifiable
directement) et son `document.execCommand`. **Ce coût de mise en place n'était pas chiffré
dans l'estimation de ~2 journées.** Deuxième aggravation : **aucun bouton de la page
Réglages ne porte d'`id`** — les tests DOM devront cibler par texte ou par rang dans
`.export-grid`, ce qui est le point le plus fragile du lot.

- [x] Un test par format de copie restant (`simple`, `categorized`, `cart`) + preuve de
      la suppression propre de `'full'` (3 recherches convergentes consignées, aucune
      référence morte)
- [x] Tests des toasts chiffrés et des messages d'état vide (chantiers 1-3 et 8)
- [x] Tests avec stock vide, courses vides, et articles libres (`customCartItems`)
- [x] Test aller-retour sauvegarde → restauration **avec coches** (les anciennes coches ne
      survivent jamais)
- [x] Test d'une ancienne sauvegarde sans le champ des coches (compatibilité)
- [x] Test de deux sélections successives du même fichier (champ réarmé)
- [x] Preuve que la **clé API ne sort jamais** (presse-papiers ET fichier)
- [x] Garde-fou « rien à copier » : chaque format, source vide → aucune écriture dans le
      presse-papiers + message d'erreur (chantier 9)
- [x] Repli de copie : `navigator.clipboard` en échec → le texte est quand même copié
      (chantier 9) — **et** son échec silencieux (`execCommand` renvoyant `false`) traité
      comme un échec, ce que l'oracle ne faisait pas
- [x] Articles libres sans catégorie → rubrique dédiée, jamais `undefined` (chantier 3)
- [x] **Synchro :** restauration d'un fichier → l'état ET les coches partent dans le
      MÊME document cloud (chantier 5) ; aucune fenêtre avec les anciennes coches
- [x] Restauration d'un fichier **partiel** : comportement conforme au texte affiché
      (les clés absentes sont conservées — chantier 5)
- [x] **Sauvegarde faite avec un filtre/une recherche actifs → restaurée, l'inventaire
      s'affiche en entier** (aucun filtre, aucune recherche, vue par défaut — chantier 10a)
- [x] Le fichier exporté ne contient **que** la liste blanche (aucun champ d'écran, aucune
      suggestion IA) + `exportedAt` (chantier 10a)
- [x] Après restauration, `state` ne contient **aucune clé fantôme** `shoppingChecked` —
      les coches vivent dans le Set seul (chantier 10b)
- [x] Coches restaurées **filtrées** : un id absent de l'inventaire ou non « à acheter »
      n'entre jamais dans le Set (chantier 10c)
- [x] Fichier avec `ingredients: []` → **refusé**, pas de reconstruction des 297 par
      défaut, aucun envoi cloud (chantier 10d)
- [x] **Ajouté par la découverte (P5)** : fichier avec `ingredients: "abc"` (une chaîne) →
      **refusé** lui aussi, pas de reconstruction des 297, aucun envoi cloud
- [x] **Ajouté par la découverte (P1)** : `exportClipboard` appelé avec un type inconnu →
      **rien n'est écrit** dans le presse-papiers, message d'erreur, aucun toast de succès
- [x] **Ajouté par la découverte (P2)** : un article libre sans catégorie ne fait **jamais
      planter** la copie (le plantage serait silencieux : ni toast, ni erreur visible)
- [x] **Ajouté par la découverte (P3)** : la rubrique des articles libres sort bien **en
      dernier**, y compris quand l'inventaire contient une catégorie accentuée
      (`Épices sèches`) — le seul choix du nom ne le garantit pas
- [x] **Ajouté par la découverte (P6)** : la restauration **attend la fin d'un envoi en
      vol** avant d'écrire (barrière `awaitSyncQuiescence`), sinon l'ancien état peut
      revenir écraser le cloud après coup
- [x] **Ajouté par la découverte** : le second bouton de copie (`📋 Copier` de la barre
      supérieure, `js/app.js:711`) produit bien le **même résultat** que la carte de
      Réglages — il n'était testé que sur son libellé. Le test **clique réellement** le
      bouton rendu par `renderTopbar('shopping')`
- [x] **Ajouté par l'audit Gemini (Q1)** : source vide → **aucun en-tête n'est composé** et
      `navigator.clipboard.writeText` **n'est jamais appelé du tout**. C'est le test qui
      distingue le vrai garde-fou du faux : un `if (!text)` naïf laisserait passer un texte
      « en-tête + (Vide) » et le test resterait vert à tort
- [x] **Ajouté par l'audit Gemini (Q9)** : un état contenant une clé orpheline
      `state.shoppingChecked` (comme après un aller-retour par la 5.7) ressort **élagué**
      de `sanitizeGlobalState` ; le Set reste la seule représentation *(sous-lot C)*
- [x] **Ajouté par l'audit Gemini (Q12)** : un article libre sans `name` exploitable est
      **ignoré** à la copie — la chaîne « undefined » n'apparaît jamais dans le texte copié
- [ ] Manuels (Joel) : vérification navigateur de CHAQUE carte de Réglages — le résultat
      correspond au titre et au sous-titre

## Critères d'acceptation

- [x] Suppression sèche du bouton « Données techniques (JSON) » appliquée (arbitrage
      Joel du 2026-07-30) et retouches UX du chantier 8 en place
- [x] Validation unifiée verte + build OK — **430/430 Vitest, 13/13 verrous, build OK**
- [ ] **Audit DUR** selon le dispositif tranché en tête de fiche (Gemini sur le plan puis
      sur le diff final + agents adversariaux locaux par étape) — ~~/ultra-audit~~ remplacé
- [x] Le chemin « Importer uniquement le stock » ne laisse plus de coche fantôme (§G,
      écart au périmètre initial autorisé par Joel le 2026-07-30)
- [ ] Chaque carte de Réglages vérifiée en navigateur par Joel

## Traçabilité

- Origine : brief de Joel du 2026-07-30 (fiabilité complète de la page Réglages) ;
  arbitrages tranchés le même jour (suppression sèche du bouton JSON, retouches UX)
- Dépend de : LOT 012 (ordre de campagne) · protections du LOT 008 (à préserver)
- Bloque : LOT 013 (tests figés sur le comportement corrigé) · LOT 014 (déplacement de
  `exportClipboard` à comportement constant)
- Note : les lignes citées dans le brief d'origine ont été revérifiées sur le code du
  2026-07-30 et corrigées dans cette fiche (léger décalage de numérotation).
- **Relecture du 2026-07-30 (avant ouverture)** : confrontation à l'oracle monolithe et au
  moteur de synchro. Ajouts : chantier 9 (garde-fou « rien à copier » + repli de copie),
  risque synchro du chantier 5, champ fantôme `customCartItems` et sa règle de classement
  (chantier 3), écarts à l'oracle assumés (chantiers 4 et 9), inexactitude du texte
  « Remplace TOUTES vos données » (chantier 5).
- **Audit adversarial du 2026-07-30 (avant ouverture, agent dédié)** : 8 angles morts
  trouvés, tous intégrés. Deux BLOQUANTS → chantier 10 (l'état d'écran part dans la
  sauvegarde et casse l'affichage à la restauration ; les coches à la racine créeraient un
  doublon SSOT). Cinq IMPORTANTS → contrainte jsdom du plan de test, rubrique `AUTRES`
  collidante corrigée en `ARTICLES LIBRES`, coches restaurées à filtrer, garde d'entrée
  d'un inventaire vide, chevauchement de tests avec le LOT 013 tranché. Un MINEUR →
  `getCategoryEmoji` au lieu du nom monolithe, marqueur ✅ devenu constant.
  L'audit a aussi **levé une inquiétude** : les garde-fous du LOT 007 protègent déjà une
  restauration d'un pull concurrent (`js/app.js:223-232, 357, 377-382`) — rien à ajouter.
- **Phase découverte du 2026-07-30 (à l'ouverture, 4 agents)** : voir la section dédiée en
  tête de fiche. Bilan : **toutes** les citations de ligne vers `index.html`, `js/app.js`,
  `src/actions.js` et la moitié basse de `src/state.js` étaient décalées (jusqu'à +630) ;
  **8 erreurs de contenu** et **7 pièges techniques** trouvés en plus. Seules les citations
  vers l'oracle étaient exactes — une première sur la campagne, mais 11 affirmations *sur*
  l'oracle se sont révélées fausses. Tout est corrigé dans le corps de la fiche.
- **À verser au backlog si Joel le souhaite** (hors périmètre de ce lot) : rebrancher
  l'ajout/retrait d'articles libres dans la liste de courses — le champ existe, la donnée
  existe, mais aucune interface ne le nourrit depuis la migration. ⚠️ La découverte a
  montré que `src/ui/shopping.js:7-11` **sait déjà** afficher ces articles (tag
  `🛍 hors stock`) : le renderer est prêt, il ne reçoit simplement jamais ces objets.
