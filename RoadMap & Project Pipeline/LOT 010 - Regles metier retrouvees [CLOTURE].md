# LOT 010 — Règles métier retrouvées — SPÉCIFICATION

> **Statut :** ✅ CLÔTURÉ — publié en **Version 5.6** le 2026-07-30 (feu vert de Joel,
> fusionné avec le LOT 009). Démarré le 2026-07-30 (signal de Joel « on démarre le lot 10 »).
> **Branche :** `feat/lot10-regles-metier`, ouverte **depuis `feat/lot9-boutons-morts`**
> (le LOT 009 n'était pas encore fusionné — publication reportée par Joel — et les deux lots
> visaient la **même version 5.6** : les chaîner a évité un conflit de fusion et a permis de
> publier la 5.6 d'un bloc)
> **Niveau d'audit : DUR** — relevé de `Standard` à `Dur` le 2026-07-30 sur constat de l'audit
> de spec (Codex) : le lot modifie `src/state.js` et `src/ui/recipe.js`, deux **zones sensibles**
> explicitement listées par `DOCTRINE_PRODUIT.md` §3, ce qui rend le niveau Dur obligatoire
> (`CLAUDE.md` §5). Concrètement : boucle d'audit **par étape** (et non un seul audit final).
> **Effort estimé :** ~1 journée

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
`Backlog/BACKLOG - Regressions de la migration.md` (§1 : C5, C9, C10, C11, C12), monolithe
`foodapp-v5-Joel.html` aux lignes citées — **oracle comportemental.**

---

## Objectif

Cinq règles métier fonctionnaient il y a 3 mois et ont été perdues en silence. L'interface
promet encore certaines d'entre elles (plafond des épinglés, boutons de personnes). Les
restaurer à l'identique.

## Périmètre — 5 chantiers + 1 arbitrage

### 1. Le filtre « Type de cuisine » réellement transmis à l'IA (casse C5)

**Aujourd'hui** (lignes revérifiées en phase découverte, cf. §7) **:** `index.html:406-416`
passe `'cuisine'` → `toggleAiChip` (`js/app.js:819-825`) écrit `state.aiConfig.cuisine` ; mais
le prompt lit `aiConfig.cuisines` (`src/services/gemini.js:73`), initialisé `[]`
(`src/state.js:28`) et jamais alimenté. Les puces s'allument, le choix est ignoré. Le monolithe
mappait `'cuisine'→'cuisines'` (l.4958 : `const map = { 'diet': 'diet', 'cuisine': 'cuisines',
'equip': 'equip' };`).

⚠️ **Découvert en phase découverte, absent de la spec initiale :** dans le modulaire,
`restoreAIConfig` (`js/app.js:789-798`) ne rallume pas les puces par un mapping mais **déduit
le nom du champ depuis l'`id` de la rangée** (`'ai-cuisine-chips'` → `cuisine`). Renommer
uniquement l'`onclick` ne suffirait donc pas : l'`id` `ai-cuisine-chips` (`index.html:405`)
doit devenir `ai-cuisines-chips` pour rester cohérent. Vérifié : cet `id` n'est référencé
nulle part ailleurs (aucune occurrence en CSS, JS ou tests).

**Attendu — corriger par le SSOT, pas par un second mapping :**
- UN seul nom de champ : `cuisines`. Modifier les `onclick` d'`index.html` pour passer
  `'cuisines'` (vérifier que `diet` et `equip` restent cohérents — ils le sont déjà) ;
- vérifier TOUS les lecteurs/écrivains : `toggleAiChip`, `restoreAIConfig` (qui relit le même
  champ pour rallumer les puces), `saveAiConfigFromUI`, `gemini.js` ;
- migration douce dans `sanitizeGlobalState` : si un vieux `aiConfig.cuisine` existe
  (localStorage ou cloud), le verser dans `cuisines` puis le supprimer.
  ⚠️ `sanitizeGlobalState` aura déjà été modifiée par le LOT 008 (reconstruction de
  l'inventaire par défaut) : ÉTENDRE l'existant, ne rien réécrire, et vérifier que la
  migration passe bien par le point d'entrée unique `applyExternalState` (LOT 008) pour les
  données venant du cloud ou d'un fichier ;
- test qui fige la règle : une config avec `cuisines:['italienne']` → le prompt généré
  contient « italienne » (étendre `tests/gemini.test.js`).

**RÈGLE EXACTE (audit de spec Codex + arbitrage de Joel du 2026-07-30 — SSOT strict) :**

> `cuisines` est l'**unique champ canonique et définitif**. Lors de l'assainissement, si un
> ancien `cuisine` existe, transférer sa valeur vers `cuisines` **puis supprimer `cuisine`**.
> Tous les chemins — local, cloud, IA — n'utilisent ensuite que `cuisines`.
>
> - **Idempotence** : après un premier assainissement, `cuisine` n'existe plus ; tout passage
>   suivant, y compris pendant `resetAllData` (`src/actions.js:94-120`, qui recrée une config
>   canonique avant d'assainir), ne change plus le résultat.
> - **Préséance** : `applyExternalState` remplace la config locale par l'externe et ne conserve
>   localement que la clé API (`src/state.js:222-230`) — **la valeur cloud gagne** après
>   migration, sauf saisie locale survenue pendant la requête (protection LOT 007,
>   `js/app.js:347-388`).
> - **Pas d'envoi correctif** : un simple téléchargement ne déclenche aucun renvoi vers le
>   cloud. Mais tout document envoyé ensuite est canonique : `buildSyncDocument`
>   (`src/services/firebase.js:54-62`) recopie tous les réglages sauf clé et modèles — un
>   `cuisine` non supprimé repartirait au cloud, d'où l'obligation de le supprimer.
> - **Collision des deux champs** (`cuisine` et `cuisines` présents et différents) :
>   **arbitrage de Joel — SSOT strict**, la valeur de l'ancien `cuisine` est versée dans
>   `cuisines` (elle représente le dernier choix réellement effectué par l'utilisateur, puisque
>   c'est le champ que l'interface cassée écrivait et relisait), puis `cuisine` disparaît.

### 2. Plafond « max 6 ingrédients imposés » (casse C9)

**Aujourd'hui** (lignes revérifiées) **:** `togglePin` (`src/actions.js:23-29`) n'a plus aucun
plafond ni toast, alors que l'UI promet toujours « Max 6 ingrédients imposés au total »
(`index.html:379`) et que `addExtraIngredient` garde SA limite de 6 (`js/app.js:1739-1741`).

**Attendu — règle TRANCHÉE (l'audit de campagne Codex a montré qu'un exécutant ne pouvait
pas choisir objectivement entre « 6 épinglés », « 6+6 » et « 6 au total ») :** l'oracle
prime, conformément à l'arbitrage global de Joel. Le monolithe plafonnait à **6 épinglés**
(l.4733-4742) ET, séparément, à **6 extras** (`addExtraIngredient` — plafond encore en
place aujourd'hui, `js/app.js:1739-1741`). Donc :
- restaurer le plafond de **6 épinglés** dans `togglePin` + toast d'explication ;
- conserver le plafond de 6 extras existant, inchangé ;
- **corriger le libellé menteur de l'UI** (`index.html:379`) ;
- une constante par plafond (SSOT), partagée entre le code et le libellé si possible.

**RÈGLE EXACTE (audit de spec Codex — oracle relu et confirmé mot à mot, l.4733-4742) :**

> - **Ne jamais tronquer ni normaliser les épinglés existants.** Une base contenant déjà 7
>   épinglés (ou plus) les garde tous : le plafond ne rétro-agit pas.
> - Le refus porte **uniquement sur un passage non-épinglé → épinglé** quand le compteur vaut
>   déjà 6 ou plus. Le **désépinglage reste toujours autorisé**, même au-delà du plafond
>   (c'est la seule façon pour l'utilisateur de redescendre).
> - Libellés **exacts** de l'oracle, à reprendre tels quels :
>   - refus : `Maximum 6 ingrédients épinglés` (toast de type erreur) ;
>   - succès épinglage : `📌 {nom} épinglé pour l'IA` ;
>   - succès désépinglage : `{nom} désépinglé`.
> - Libellé UI exact : **« Max 6 épinglés + 6 hors stock »**.
> - Test obligatoire : une base préexistante à 7 épinglés — aucun n'est perdu, le 8ᵉ est
>   refusé, et un désépinglage fonctionne.

### 3. Zone « Ingrédients imposés » complète + sous-titre vivant (casse C10)

**Aujourd'hui** (lignes revérifiées) **:** `renderExtraChips` (`js/app.js:1760-1769`) n'affiche
QUE les extras, sans emoji. Un épinglé est envoyé à l'IA (`gemini.js:70`) mais invisible et non
retirable dans la vue IA. Le sous-titre `#ai-context-sub` (`index.html:306`) est figé sur son
texte par défaut. `renderExtraChips` n'a qu'UN seul site d'appel (`js/app.js:538`, au rendu de
la vue IA) : ni `togglePin`, ni `addExtraIngredient`, ni `removeExtraIngredient` ne rafraîchit
la zone — c'est la cause du « rien ne bouge » constaté.

✅ **Bonne nouvelle de la phase découverte :** tout le CSS de la zone existe déjà et n'attend
que d'être utilisé (`css/style.css:1296-1451` et `3637-3648` : `.imposed-zone`, `.pz-label`,
`.pz-chips`, `.pz-chip`, `.pz-chip-del`, `.pz-empty`, équivalents `.ez-*`), ainsi que le
conteneur `#imposed-chips` (`index.html:364-381`). Aucune CSS à écrire. Modèle de puce
« emoji + ✕ » déjà écrit et réutilisable : `renderShoppingItem` (`src/ui/shopping.js:4-36`).

**Attendu (oracle : monolithe `renderImposedZone` l.4875-4910, `updateAIContextSub`
l.4943-4953) :**
- deux sections : « 📍 Dans l'inventaire » (épinglés, puce avec emoji + ✕ qui désépingle) et
  « 🛒 Hors inventaire » (extras, avec emoji — voir LOT 012 chantier autoEmoji) ;
- sous-titre recalculé à chaque changement : « X ingrédient(s) en stock · Y épinglé(s) ·
  Z hors stock » (pluriels du monolithe) ;
- rafraîchi aux mêmes moments que l'origine : rendu de la vue IA, épinglage/désépinglage,
  ajout/retrait d'extra.

**RÈGLE EXACTE (audit de spec Codex — oracle relu, l.4733-4741, 4868-4870, 4912-4952) :**

> - ⚠️ **Dépassement volontaire de l'oracle, assumé et tracé :** l'oracle ne rafraîchit
>   que la zone (`renderImposedZone`) après un épinglage, **pas le sous-titre** — c'est un
>   oubli de l'original. La fiche demande à raison mieux, mais ne doit pas le présenter comme
>   « identique à l'origine ». Comportement retenu : au rendu de la vue IA, après
>   épinglage/désépinglage **et** après ajout/retrait d'un extra → rafraîchir **la zone ET le
>   sous-titre**.
> - **Segments masqués à zéro** (règle de l'oracle, l.4949-4951) : le stock est toujours
>   affiché ; le segment « épinglé(s) » n'apparaît **que si** son compteur est > 0 ; idem pour
>   « hors stock ». Pluriel sur « ingrédient » et « épinglé », **pas** sur « hors stock ».
> - **Toujours recalculer depuis l'état vivant**, jamais depuis une copie mémorisée :
>   supprimer un ingrédient épinglé (`src/actions.js:42-47`) le retire donc automatiquement de
>   la zone, du compteur et du prochain prompt (`src/services/gemini.js:70-87` recalcule les
>   épinglés depuis `state.ingredients`). Aucun code de nettoyage supplémentaire n'est requis —
>   mais un test doit le prouver.

### 4. Tri alphabétique de l'inventaire (casse C11)

**Aujourd'hui** (lignes revérifiées) **:** `getFilteredIngredients` (`js/app.js:665-685`) rend
l'ordre d'insertion — un ajout apparaît en fin de grille.

**Attendu (oracle : monolithe l.4646, littéralement
`return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));`) :** tri
appliqué au résultat filtré. **Piège vérifié en phase découverte :** l'export presse-papier ne
passe PAS par `getFilteredIngredients` (il lit `state.ingredients` puis `groupByCategory`,
`js/app.js:1148-1159`, dont le tri « par défaut volontaire » a été conservé au LOT 005) —
les deux chemins sont disjoints, `getFilteredIngredients` n'est utilisée que par `renderPantry`
(`js/app.js:651`). Le tri est donc sans risque pour l'export, à condition de ne pas trier
`state.ingredients` lui-même.

**RISQUE ÉCARTÉ (audit de spec Codex) :** je craignais que les cartes d'inventaire soient
identifiées par leur **position** dans la liste — auquel cas trier aurait fait agir un clic sur
le mauvais ingrédient (bug silencieux grave). Vérifié : aucun clic n'utilise la position.
`getFilteredIngredients` renvoie une copie, `renderPantry` transmet les objets, et chaque carte
appelle les actions avec `ing.id` (`js/app.js:646-684`, `src/ui/pantry.js:13-35`) — exactement
comme l'oracle (l.4619-4657). Un test « après tri, cliquer la première carte agit bien sur SON
identifiant » reste un verrou utile à poser.

### 5. Quantités recalculées selon le nombre de personnes (casse C12)

**Aujourd'hui** (lignes revérifiées) **:** `changePplScale` (`js/app.js:968-975`) change le
chiffre affiché, rien d'autre (« Quantitative scaling logic could be added here if needed »).

**Attendu (oracle : monolithe `scaleQty` l.5474-5484, `changePplScale` l.5467-5472, état
`_currentScale`/`_originalPpl` l.5357-5359) :** les boutons −/+ recalculent chaque quantité
affichée (300 g → 450 g pour 2→3 personnes) et re-rendent la liste d'ingrédients du modal.
Porter la fonction d'analyse des quantités du monolithe. La valeur d'origine reste la
référence : revenir au nombre initial redonne les quantités initiales EXACTES (pas d'erreurs
d'arrondi cumulées).

⚠️ **Correction de la fiche (audit de spec Codex, oracle relu l.5474-5484) :** la phrase
« elle gère nombres, **fractions** et unités collées » était **fausse**. L'oracle ne gère que
les entiers et décimaux (point ou virgule), avec unité collée, arrondis à 1 décimale. Voir
l'arbitrage de Joel ci-dessous.

**Précisions issues de la phase découverte :**
- forme des données confirmée : chaque ingrédient est `{n, q, e, c, s}` où `q` est une
  **chaîne** (« 300 g »), identique pour les deux sources réelles du modal ;
- « trois sources » est inexact : le modal n'a que **deux** points d'entrée
  (`openRecipeDetail(idx,'ai')` et `(id,'fav')`, `js/app.js:837-866`). La « recette collée »
  passe obligatoirement par une sauvegarde en favori avant d'atteindre le modal — le scaling
  la couvre donc, mais par le chemin `'fav'`, pas par un troisième chemin à écrire ;
- l'échelle doit être **réinitialisée à chaque ouverture** de modal, MAIS `analyzeNutrition`
  (`js/app.js:895`) re-rend le modal en cours d'usage : il ne doit PAS réinitialiser une
  échelle déjà choisie par l'utilisateur.

**RÈGLE EXACTE — FRONTIÈRES (audit de spec Codex, oracle relu et vérifié) :**

> **L'échelle est strictement une PRÉSENTATION du modal.** Elle ne modifie ni la recette, ni
> les favoris, ni les suggestions, ni les données envoyées à la liste de courses.
> - **Liste de courses** : elle ignore totalement les quantités — vérifié dans le modulaire,
>   `openEnhancedCartPicker` (`js/app.js:1012-1029`) ne lit que nom, catégorie, emoji et
>   statut, jamais `q`. Aucune fuite possible de l'échelle vers le panier.
> - **Analyse nutritionnelle** : continue d'utiliser la recette et le nombre de personnes
>   **d'origine** (oracle l.5386-5398). Une analyse relance l'affichage **sans perdre**
>   l'échelle en cours (oracle l.5418-5421).
> - **Cycle de vie** : fermer puis rouvrir le modal **revient à l'échelle 1** (oracle
>   l.5378-5382). Valeur initiale : `parseInt(r.people || r.ppl) || 2` — on conserve le repli
>   `|| r.ppl` déjà accepté par le modulaire (`src/ui/recipe.js:83-87`).
> - **Bornes : 1 à 20 personnes**, hors de quoi le clic est sans effet (oracle l.5467-5472).
> - **Anti-dérive** : l'échelle est recalculée depuis la valeur d'origine
>   (`_currentScale = nouveauNombre / _originalPpl`), jamais accumulée ; et à l'échelle 1 la
>   chaîne d'origine est renvoyée **telle quelle, sans reformatage**. Ces deux propriétés
>   doivent survivre à l'extension ci-dessous.

**ARBITRAGE DE JOEL (2026-07-30) — dépassement volontaire de l'oracle, assumé :**

> **Prendre réellement en charge les fractions**, ASCII (`1/2`, `3/4`) et Unicode (`½`, `¼`,
> `¾`…), lors du recalcul, **sans dérive lors des changements successifs**.
>
> **Ce n'est pas qu'un confort — c'est une correction.** Vérification faite sur l'oracle :
> sa recherche de nombres (`/(\d+([.,]\d+)?)/g`) traite `1/2 citron` comme **deux nombres
> séparés** : à l'échelle 2 elle produit **`2/4 citron`** — une quantité corrompue, pas
> seulement mal arrondie. Les fractions Unicode (`½`), elles, sont silencieusement ignorées.
> Restaurer l'oracle à l'identique reviendrait donc à réintroduire un bug connu.
>
> Format de sortie : cohérent avec l'oracle — décimal, virgule française, **1 décimale
> maximum** (`½ citron` × 3 → `1,5 citron`). À l'échelle 1, la chaîne d'origine reste
> **inchangée** (`½` reste `½`), ce qui garantit l'aller-retour exact.

**BUG RÉEL trouvé par Joel en test navigateur (2026-07-30, après commit `28859da`) :**
quantités affichées sans unité (« 200 » au lieu de « 200 g ») et, dans la liste de courses,
une unité seule (« g », « pièce », « ml », « brins ») à la place de l'emoji. Cause racine :
le prompt IA modulaire (`src/services/gemini.js`) avait perdu les indications de format que
l'oracle donnait explicitement (`foodapp-v5-Joel.html` l.5214 : `"q":"[QUANTITÉ+UNITÉ]"`,
`"e":"[1 EMOJI]"`) — sans elles, l'IA improvisait. Corrigé au commit `9dc5d08` : indications
restaurées + filet de sécurité (`openEnhancedCartPicker`, `js/app.js`) qui rejette tout champ
emoji ne ressemblant pas à un vrai emoji Unicode, même si l'IA dévie encore un jour.
**Revérifié par Joel en navigateur après correctif : confirmé bon** (« c mieux » — captures
d'écran d'une nouvelle recette, unités et emojis corrects sur les deux écrans).

### 6. Menu « Moteur Tâches Complexes » — TRANCHÉ par Joel (2026-07-29)

Le choix de l'utilisateur y est écrasé à chaque chargement (`sanitizeGlobalState` force les
modèles à chaque démarrage — voulu depuis l'incident des modèles périmés).

**Décision de Joel : SUPPRIMER le menu.** À la place, afficher une **information en lecture
seule** : quel(s) modèle(s) l'app utilise et pour quoi faire. Concrètement :
- retirer le `<select>` et son câblage (3 recherches convergentes avant suppression,
  `CLAUDE.md` §5) ;
- afficher à sa place un petit bloc informatif dérivé de `AI_ROLES` (`src/constants.js`,
  SSOT — ne JAMAIS écrire les noms de modèles en dur dans le HTML), du type :
  « Recettes, nutrition et analyse : `gemini-3.6-flash` · Catégories et emojis :
  `gemini-3.5-flash-lite` », libellés générés depuis la table des rôles ;
- ~~si un second `<select>` du même écran est lui aussi sans effet, appliquer le même
  traitement~~ → **vérifié en phase découverte : ce second menu n'existe pas.** Il n'y a
  qu'un seul `<select>` de modèle (`id="api-model-complex"`, `index.html:132`), recherche
  exhaustive faite sur `index.html`, `js/**`, `src/**`, `css/**`, `tests/**`, `scripts/**`.
  Point sans objet.

**Précisions issues de la phase découverte :**
- `AI_ROLES` (`src/constants.js:8-11`) n'a que **2 entrées** (`REASONING`, `FAST`) et aucun
  libellé métier. C'est `defaultAiModels()` (`src/state.js:9-17`) qui répartit **5 usages**
  sur ces 2 modèles (`recipeGeneration`, `nutrition`, `smartPaste` → REASONING ;
  `categorySuggest`, `emojiSearch` → FAST). Le bloc informatif doit se dériver de CES DEUX
  tables, pas des 2 clés brutes ;
- ⚠️ **piège de vérification** : le choix du menu reste actif pendant la session en cours et
  n'est écrasé qu'au **rechargement** suivant (`sanitizeGlobalState` ne repasse qu'à
  `loadState`). Un test qui resterait dans la même session conclurait à tort que le menu
  fonctionne — il faut simuler le cycle complet sauvegarde → rechargement.

**RÈGLE EXACTE (audit de spec Codex) :**

> - **Texte exact du bloc informatif :** « Recettes, nutrition et transformation de texte :
>   {modèle affecté à ces usages} · Catégories et emojis : {modèle affecté à ces usages} ».
>   Les **noms de modèles** sont lus depuis l'affectation canonique (`defaultAiModels()`
>   `src/state.js:9-16` + `AI_ROLES` `src/constants.js:5-10`) et **jamais écrits dans le
>   HTML** ; seuls les libellés métier sont fixes.
> - **Périmètre de suppression strict** : retirer **exclusivement** le `<select>` et ses deux
>   lectures conditionnelles (`js/app.js:1322-1328` à l'ouverture, `js/app.js:1849-1863` à la
>   sauvegarde). Vérifié : ces lectures sont conditionnelles, leur retrait ne casse pas
>   mécaniquement l'enregistrement de la clé API — mais tailler trop large dans `saveApiKey`
>   rendrait l'IA **inutilisable**.
> - **Test de non-régression obligatoire** : saisir puis enregistrer une clé API continue de
>   fonctionner après suppression du menu.

---

## 7. PHASE DÉCOUVERTE (faite le 2026-07-30, avant la 1ʳᵉ ligne de code)

Agent Explore lancé sur les 6 chantiers (règle anti-récidive, `CLAUDE.md` §3). Résultat :
**24 ressources réutilisables · 6 groupes de manques · 10 citations de lignes fausses**.

**Ce qui existe déjà et sera réutilisé (extraits) :**
- `toast()` (`src/utils/dom.js:53-66`) — LA notification du projet, déjà importée dans
  `src/actions.js` : le toast du plafond épinglés n'a rien à créer ;
- le patron exact du plafond est déjà écrit pour les extras (`js/app.js:1739-1741`) ;
- `h()` (`src/utils/dom.js:8-33`) + `renderShoppingItem` (`src/ui/shopping.js:4-36`) —
  puce « emoji + ✕ » déjà écrite, à transposer ;
- tout le CSS de la zone « ingrédients imposés » (voir chantier 3) ;
- `localeCompare(…, 'fr')` déjà la convention du projet (`src/ui/shopping.js:80,84`) ;
- `applyExternalState` / `sanitizeGlobalState` (`src/state.js:222-231` / `144-186`) —
  point d'entrée unique pour la migration du chantier 1, à ÉTENDRE en fin de fonction ;
- `defaultAiConfig()` (`src/state.js:24-32`) — SSOT de la forme d'`aiConfig`, contient
  déjà `cuisines: []` (le bon nom est donc déjà le canonique).

**Manques réels à écrire :** la migration `cuisine`→`cuisines` · les constantes de plafond
(aucune n'existe, le 6 des extras est un nombre en dur) · `renderImposedZone` et
`updateAIContextSub` (inexistants dans le modulaire) · le tri dans `getFilteredIngredients` ·
`scaleQty` + l'état d'échelle (inexistants) · le bloc informatif dérivé d'`AI_ROLES` ·
et l'ajout au bloc `export {}` de `js/app.js` des fonctions à tester.

**Citations de lignes corrigées dans cette fiche :** les 10 références au code actuel
étaient périmées (elles pointaient vers du code sans rapport — moteur de synchro, panneau
système…). Elles ont été remplacées ci-dessus par les lignes vérifiées le 2026-07-30. Les
références à l'**oracle** (`foodapp-v5-Joel.html`), elles, sont **toutes exactes** — aucune
correction (vérifiées : l.4646, 4733-4742, 4875-4910, 4943-4953, 4958, 5357-5359,
5467-5472, 5474-5484).

**Pièges relevés à ne pas oublier en codant :** `sanitizeGlobalState` tourne aussi pendant
la remise à zéro complète (migration à rendre idempotente) · `applyExternalState` fusionne
`aiConfig` avant l'assainissement (l'ordre de préséance cloud > local doit survivre à la
migration) · la signature `togglePin(id)` est appelée depuis 3 endroits dont un `onclick`
généré, à ne pas changer.

---

## Plan de test

Enrichi le 2026-07-30 par l'audit de spec : chaque règle exacte ci-dessus doit avoir son test.

**Chantier 1 — cuisine**
- [ ] prompt généré contient « italienne » quand `cuisines:['italienne']`
- [ ] migration `cuisine`→`cuisines` : valeur transférée **et** `cuisine` supprimé
- [ ] migration **idempotente** : 2ᵉ passage sans effet ; passage pendant `resetAllData` sans effet
- [ ] collision des deux champs → `cuisine` gagne puis disparaît (arbitrage Joel)
- [ ] document sortant (`buildSyncDocument`) ne contient **jamais** `cuisine`
- [ ] une valeur sauvegardée rallume bien la puce après rechargement (renommage de l'`id`)

**Chantier 2 — plafond**
- [ ] base préexistante à **7 épinglés** : aucun perdu, 8ᵉ refusé, désépinglage possible
- [ ] libellés de toast exacts (refus, épinglage, désépinglage)

**Chantier 3 — zone imposée**
- [ ] segments masqués à zéro ; pluriels exacts
- [ ] sous-titre rafraîchi après épinglage (dépassement volontaire de l'oracle)
- [ ] supprimer un ingrédient épinglé le retire de la zone, du compteur et du prompt

**Chantier 4 — tri**
- [ ] tri français (accents : « Épinard » avant « Fraise »)
- [ ] après tri, agir sur la 1ʳᵉ carte agit bien sur SON identifiant (verrou anti-régression)
- [ ] l'export presse-papier garde son ordre d'origine

**Chantier 5 — quantités**
- [ ] `scaleQty` : entiers, décimaux point/virgule, unités collées
- [ ] **fractions ASCII (`1/2`) et Unicode (`½`)** — arbitrage Joel ; vérifier explicitement
      que `1/2` ne devient jamais `2/4` (bug de l'oracle)
- [ ] aller-retour sans dérive ; à l'échelle 1 la chaîne est **inchangée**
- [ ] bornes 1–20 : au-delà, le clic est sans effet
- [ ] l'échelle ne fuit **pas** vers la liste de courses ni vers l'analyse nutritionnelle
- [ ] une analyse nutritionnelle **conserve** l'échelle ; fermer/rouvrir la **remet à 1**

**Chantier 6 — menu modèles**
- [ ] enregistrer une clé API fonctionne toujours après suppression du menu
- [ ] le bloc informatif affiche les modèles lus depuis la source unique (aucun nom en dur)

**Manuels (Joel)**
- [ ] puce Italienne → les recettes générées sont italiennes ; épingler un 7e ingrédient →
      refus expliqué ; un épinglé apparaît et se retire dans la vue IA ; sous-titre vivant ;
      inventaire trié ; −/+ personnes recalcule les quantités

## Critères d'acceptation

- [ ] Validation unifiée verte + build OK ; arbitrage n°6 tranché et appliqué
- [ ] **Audit DUR** (relevé de Standard le 2026-07-30) : boucle par étape sur les trois zones
      sensibles du lot — migration/plafonds, rendu de la zone imposée, calcul des quantités
- [ ] Cocher C5, C9, C10, C11, C12 dans la fiche régressions

---

## 8. AUDIT DE SPEC — CODEX (2026-07-30, AVANT la première ligne de code)

Audit demandé par Joel (« ça vaut le coup de faire auditer les specs avant de se lancer ? »),
conforme au niveau Standard alors en vigueur (« audit spec court + un audit du diff final »).
Audit **statique** (verrou lecture seule de Codex maintenu).

**Verdict : NO-GO sur la spec** — 5 points bloquants, 2 arbitrages remontés à Joel.

| # | Constat de Codex | Vérifié par moi ? | Traitement |
|---|---|---|---|
| 1 | Collision `cuisine`/`cuisines` non tranchée ; un `cuisine` non supprimé repartirait au cloud (`firebase.js:54-62`) | ✅ exact | Règle exacte intégrée au chantier 1 + arbitrage Joel |
| 2 | Aucune règle pour une base ayant **déjà** > 6 épinglés ; libellés de toast non cités | ✅ exact (oracle l.4733-4742 relu mot à mot) | Règle exacte intégrée au chantier 2 |
| 3 | L'oracle ne rafraîchit PAS le sous-titre après épinglage ; segments masqués à zéro non spécifiés | ✅ exact (l.4943-4952) | Dépassement de l'oracle désormais **assumé et tracé** |
| 4 | Risque « tri = clic sur le mauvais ingrédient » **inexistant** (tout passe par l'identifiant) | ✅ exact | Risque écarté, verrou de test conservé |
| 5 | La fiche prétendait que l'oracle gère les **fractions** — c'est faux ; bornes 1–20 et frontières panier/nutrition non spécifiées | ✅ exact (l.5474-5484) | Frontières intégrées + arbitrage Joel |
| 6 | Texte du bloc informatif non fixé ; risque de casser l'enregistrement de la clé API | ✅ exact (lectures conditionnelles `js/app.js:1322-1328`, `1849-1863`) | Texte et périmètre exacts intégrés |
| 7 | **Niveau d'audit sous-évalué** : le lot touche `src/state.js` et `src/ui/recipe.js`, zones sensibles de `DOCTRINE_PRODUIT.md` §3 → niveau **Dur** obligatoire (`CLAUDE.md` §5) | ✅ exact | Fiche, critères d'acceptation et `CURRENT_GOAL.md` relevés en **Dur** |

**Les 7 constats ont été recontrôlés un par un contre le code réel et l'oracle avant
intégration — aucun n'a été pris pour argent comptant, aucun ne s'est révélé faux.**

**Découverte supplémentaire de ma contre-vérification (absente de l'audit) :** la fonction
de mise à l'échelle de l'oracle ne se contente pas d'ignorer les fractions, elle les
**corrompt** — `1/2 citron` à l'échelle 2 devient `2/4 citron`. Cela transforme l'arbitrage
« fractions » de Joel en correction de bug, et non en simple confort.

**Audits d'étape post-implémentation :**
- Chantiers 1+2 (`f09c423`, `7eebf03`) — `/ultra-audit` interne, 6 lentilles + vérification
  adversariale : **0 défaut confirmé**. 3 pointeurs confirmant que le chantier 3 est la suite
  logique (la zone imposée devait afficher aussi les épinglés).
- Chantier 3 (`1fa05fe`) — audité par **Gemini** (Codex et l'audit interne mis en pause pour
  raison de budget de tokens, cf. décision de Joel du 2026-07-30) : **GO sans réserve**.
  Lignes citées vérifiées à un ou deux près, conclusion confirmée indépendamment par l'audit
  précédent (le sélecteur `.chip` générique ne capte plus les nouvelles puces).
- Chantiers 4-6 + correctif unités/emoji (`79d8135..HEAD`, périmètre `f51eea2..c8f74d2`)
  — audité par **Codex Terra** (niveau medium, retenu comme auditeur par défaut après
  comparaison avec Gemini au chantier 3) : **GO**, deux durcissements non bloquants,
  tous deux vérifiés puis traités avant clôture :
  1. **Filtre emoji trop permissif** (`js/app.js`, chantier 5) — `.test()` cherchait un
     emoji n'importe où dans la chaîne au lieu de vérifier la chaîne entière : une valeur
     mixte comme `"g🐟"` passait le filtre avec la lettre toujours collée devant l'emoji.
     **Corrigé** : correspondance ancrée sur la chaîne entière (`^...+$`), qui accepte en
     plus les emojis à présentation texte par défaut explicitement forcés (`❤️`), rejetés
     à tort par le premier filtre. 2 tests ajoutés reproduisant les deux cas.
  2. **Nutrition + échelle non exercée par un test** — comportement vérifié par lecture de
     code seulement. **2 tests ajoutés** qui déclenchent réellement `analyzeNutrition`
     après un changement d'échelle et vérifient la préservation de l'échelle affichée et
     l'usage du nombre de personnes d'origine dans la requête IA.
  Tous les autres points (tri après filtrage sans mutation, priorité de la fraction ASCII
  dans `scaleQty`, absence de dérive cumulée, aucune mutation de la recette, 3 recherches
  convergentes du chantier 6, SSOT du bloc informatif) : confirmés sans réserve.

**Arbitrages de Joel (2026-07-30) :**
1. **SSOT strict** — `cuisines` est l'unique champ définitif ; l'ancien `cuisine` est versé
   dedans puis supprimé ; tous les chemins (local, cloud, IA) n'utilisent plus que `cuisines`.
2. **Fractions** — dépassement volontaire de l'oracle : prise en charge réelle des fractions
   ASCII et Unicode, sans dérive lors des changements successifs.

---

## Traçabilité

- Origine : fiche régressions §1 — balayage 2026-07-29
- Dépend de : **LOT 008** (dépendance technique : `sanitizeGlobalState` et
  `applyExternalState` — correction d'audit de campagne, Gemini 3.1 Pro) ;
  LOT 009 (ordre de campagne)
