# LOT 017 — Second rangement de `js/app.js` — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — ouvert le 2026-07-31
> **Branche :** `feat/lot17-second-rangement-app-js`, chaînée depuis `feat/lot16` (le LOT 016
> est `[A PUBLIER]`, pas encore en ligne — précédent des LOTS 007+008, 009+010, 011+012)
> **Niveau d'audit : Standard** — déménagement de code sous filet de tests déjà dense
> **Version visée :** 5.11

---

## Objectif

Terminer le rangement commencé au LOT 014 (§A), qui avait ramené `js/app.js` de 2823 à
**1527 lignes** et s'était arrêté là où les frontières étaient nettes. Cible annoncée par la
fiche backlog : **~700 lignes**. Comme au LOT 014, **pare-feu A/B absolu : pas un
comportement observable ne change.**

---

## Ce que la phase découverte a corrigé dans le plan de départ

La fiche backlog était un bon point de départ, mais **trois de ses éléments étaient faux ou
incomplets**. Les découvrir maintenant, et non en cours de déplacement, est tout l'intérêt de
la phase obligatoire.

### 1. La mesure de départ était fausse deux fois

| Chiffre | Origine | Verdict |
|---|---|---|
| 1523 | fiche backlog, `CURRENT_GOAL.md`, `SHIP_LOG.md` | **faux** — écrit à la main à la clôture du LOT 014, jamais remesuré |
| 1366 | ma propre première vérification | **faux** — comptage des lignes NON VIDES (1363 réelles) |
| **1527** | `wc -l`, identique sur les 5 derniers commits | **exact** |

### 2. Le plan oubliait 16 fonctions, et elles ne sont pas optionnelles

Chaque module envisagé laissait derrière lui des fonctions qui ne sont appelées QUE par lui —
les abandonner dans `js/app.js` créerait des orphelines et empêcherait d'atteindre la cible.

| Module | Compagnons manquants du plan |
|---|---|
| `pasteRecipe.js` | `buildPastedFavorite` (lit `_lastTransformedRecipe`, donc **obligatoire** : la laisser forcerait à exporter une variable privée) |
| `favorites.js` | `saveRecipeOnly`, `saveRecipeAndList` |
| `aiPanel.js` | `AI_LOADING_TEXTS`, `generationDejaEnCours`, `updateAiCtaSummary`, `toggleAiSingle`, `renderImposedCapHint`, `updateAIContextSub`, `refreshImposedZone`, `removeExtraIngredient` (8) |
| `topbar.js` | `countStockAndCart`, `_favCountSub` |
| `settings.js` | `updateApiStatus`, `renderAiModelsInfo` |

### 3. La cible de 700 lignes n'est atteignable qu'au prix fort

| Scénario | `js/app.js` final |
|---|---|
| Plan strict de la fiche (27 noms) | **≈ 860** — cible ratée de 160 lignes |
| Plan + 16 compagnons + retrait de la zone morte | **≈ 690** — cible atteinte |

**Ce qui bloque, et qu'aucun découpage ne réduira** : 94 lignes de tuyauterie (bloc
`export {}` qui republie 39 noms pour les tests), 26 lignes d'`expose({…})` (contrat du HTML),
et 88 lignes d'imports **qui vont grossir**. Le bloc `export {}` ne diminuera pas : chaque
module extrait y ajoute un ré-export au lieu d'en retirer un.

**Décision : scénario B.** C'est le seul qui tient l'objectif que Joel a fixé.

---

## La découverte majeure : `modals.js` peut devenir une feuille pure

`openModal` est le hub du fichier — 5 groupes sur 6 en dépendent. Mais il porte **34 lignes
qui ne lui appartiennent pas** :

- `js/app.js:1023-1051` (29 l) : remise à zéro de la modale « coller une recette ». **Ce code
  écrit `_lastTransformedRecipe`, une variable privée de `pasteRecipe`.** Un import ne peut
  pas faire ça — d'où un cycle **bloquant**.
- `js/app.js:1053-1057` (5 l) : appel à `renderAiModelsInfo`, logique de réglages.

**En rendant ces 34 lignes à leurs modules respectifs, les deux cycles disparaissent** et
`modals.js` n'importe plus rien des autres écrans. C'est le meilleur retour sur risque du lot
— et **le seul geste qui déplace du code hors de sa fonction d'origine**, donc le seul qui
exige un filet explicite AVANT, pas seulement une preuve après.

### Les cycles restants

| Cycle | Traitement |
|---|---|
| `topbar` ⇄ `app.js` (6 fonctions : `switchView`, `exportClipboard`, `resetCart`, `setFilter`, `toggleSpecialFilter`, `resetFilters`) | **`registerTopbarHooks` — inévitable**, sauf à créer un 7ᵉ module `pantryView.js` |
| `favorites` ⇄ `app.js` (`printRecipe`, 3 lignes) | déplacer `printRecipe` — **aucun crochet** |
| `settings` ⇄ `app.js` (`updateApiStatus`) | l'emporter dans `settings.js` — **aucun crochet** |
| `aiPanel` ⇄ `app.js` (`togglePin`) | importer directement depuis `src/actions.js` — **aucun crochet** |

Règle du LOT 014 rappelée : **dès qu'une cible sort dans son module, le crochet qui la
remplaçait doit disparaître au profit d'un import direct.** Sortir `openModal` doit donc
supprimer les trois `registerCartPickerHooks` / `registerEmojiModalHooks` /
`registerRecipeModalHooks` existants.

---

## Pièges de nommage relevés (à ne pas déclencher en déménageant)

- **`window.saveRecipeOnly` n'est PAS la fonction `saveRecipeOnly`.** `expose` publie
  `saveRecipeOnly: savePastedRecipe` (`js/app.js:1512`) et `saveRecipeAndList:
  savePastedRecipeAndList` (`:1513`). Deux paires d'homonymes qui partent dans **deux modules
  différents**.
- **`saveApiKey` existe déjà dans `src/actions.js:186`** et n'est pas la même fonction que
  `js/app.js:1366`. Un import naïf créerait une collision silencieuse.
- **`_lastTransformedRecipe` est déclarée APRÈS ses trois usages** (`:1336`, usages `:839`,
  `:1027`, `:1316`) — à remonter en tête du module d'accueil.
- **`renderPantryFilters` n'est ni exportée ni exposée** : ses 6 tests l'atteignent par son
  vrai chemin d'appel (`switchView('pantry')`). Ce chemin doit rester intact.

---

## Prérequis dur : une zone aveugle à couvrir AVANT de la déplacer

**`saveAiConfigFromUI` (`js/app.js:704-709`) n'a AUCUN test** — vérifié : ses seules
références sont sa définition, son exposition, et trois `oninput=` d'`index.html`. Sa seule
couverture actuelle est l'*existence*, via le verrou de parité. Règle du LOT 014 : test de
caractérisation AVANT tout déplacement d'une fonction non couverte.

---

## Ce qui ne bougera pas : les imports des tests

Le LOT 014 n'a **pas** réécrit les imports de tests — il republie les noms à l'identique dans
le bloc `export {}` de `js/app.js`. `tests/picker-selection.test.js` importe toujours depuis
`'../js/app.js'` alors que le code vit dans `src/ui/cartPicker.js`. **Ce patron est repris
ici** : le budget « travail mécanique sur les tests » du lot tombe à zéro, et les tests
existants continuent de prouver le comportement après déménagement — ce qui est exactement
la garantie recherchée.

---

## Ordre d'exécution (du moins risqué au plus risqué)

| Volet | Contenu | Risque |
|---|---|---|
| **0** | Filet sur `saveAiConfigFromUI` + retrait de la zone morte (`js/app.js:727-755`, 29 lignes de commentaires orphelins du LOT 014) | nul |
| **A** | `src/ui/settings.js` (+ `updateApiStatus`, `renderAiModelsInfo`) | faible |
| **B** | `src/ui/favorites.js` (+ `saveRecipeOnly`, `saveRecipeAndList`, `printRecipe`) | faible |
| **C** | `src/ui/pasteRecipe.js` (+ `buildPastedFavorite`) et rapatriement des 29 lignes de remise à zéro | **moyen** |
| **D** | `src/ui/aiPanel.js` (+ 8 compagnons) | moyen |
| **E** | `src/ui/topbar.js` (+ `countStockAndCart`, `_favCountSub`) + `registerTopbarHooks` | moyen |
| **F** | `src/ui/modals.js` — en dernier, une fois devenu une feuille pure ; suppression des 3 crochets devenus inutiles | **le plus élevé** |

Chaque volet : déplacement pur → validation unifiée verte → commit séparé. Un défaut trouvé
en chemin se fige, ne se corrige pas dans le même geste.

---

## RÉALISATION

*(à compléter volet par volet)*
