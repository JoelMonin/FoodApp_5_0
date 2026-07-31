# LOT 017 — Second rangement de `js/app.js` — SPÉCIFICATION

> **Statut :** 🟡 A PUBLIER — ouvert et terminé le 2026-07-31
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

## Ordre d'exécution — RÉVISÉ après le volet 0

Le plan plaçait `modals.js` en **dernier**, comme le morceau le plus risqué. L'analyse des
dépendances a montré l'inverse : c'est le **hub** dont cinq zones dépendent, et tant qu'il
vivait dans `js/app.js`, chacune devait se le faire injecter. **Le sortir en premier éteint
des crochets au lieu d'en créer.**

| Volet | Contenu | État |
|---|---|---|
| **0** | Filet sur `saveAiConfigFromUI` + retrait de la zone morte | ✅ **FAIT** |
| **A** | `src/ui/modals.js` (`openModal`, `closeModal`, `initSwipeToClose`) — remonté du dernier au premier rang | ✅ **FAIT** |
| **B** | `src/ui/settings.js` (+ `updateApiStatus`, `renderAiModelsInfo`) — reprend le crochet `onApiConfigOpen` | ✅ **FAIT** |
| **C** | `src/ui/favorites.js` (+ `saveRecipeOnly`, `saveRecipeAndList`, `printRecipe`, `buildRecipeHandlers`) | ✅ **FAIT** |
| **D** | `src/ui/topbar.js` (+ `countStockAndCart`, `_favCountSub`, les 3 filtres) — **remonté avant `pasteRecipe`**, qui a besoin de `updateBadges` | ✅ **FAIT** |
| **E** | `src/ui/pasteRecipe.js` (+ `buildPastedFavorite`) — reprend `resetPasteModal` et ses 29 lignes | ✅ **FAIT** |
| **F** | `src/ui/aiPanel.js` (+ 8 compagnons) | ✅ **FAIT** |

Chaque volet : déplacement pur → validation unifiée verte → commit séparé. Un défaut trouvé
en chemin se fige, ne se corrige pas dans le même geste.

---

## RÉALISATION

### Volet 0 — la dernière zone aveugle, couverte AVANT tout déplacement ✅

**`saveAiConfigFromUI` n'avait AUCUN test.** Seule son *existence* était vérifiée (verrou de
parité) : un corps vide serait passé au vert alors que les réglages IA de Joel ne se seraient
plus jamais enregistrés. 8 tests posés (`tests/save-ai-config.test.js`), **5 mutations, 5
rouges nommés, témoin vert**.

Le piège figé au passage : la créativité passe par `parseInt(champ?.value || '50')`. Le `||`
porte sur une **chaîne**, et `'0'` est une chaîne non vide — une créativité volontairement
réglée à 0 survit donc. Déplacer le repli sur le nombre (`parseInt(...) || 50`) la remonterait
à 50 en silence : exactement le défaut du LOT 008, dans l'autre sens.

**Zone morte retirée** (`js/app.js`, 19 lignes) : un bloc JSDoc décrivant en détail
`matchIngredientToStock` — partie dans `stockMatch.js` au LOT 014 — juste au-dessus d'une
fonction qui n'était plus là, plus un commentaire sur le plein écran sans son code. Le
« commentaire menteur » que le LOT 014 traquait ailleurs, laissé par ses propres déplacements.

### Volet A — `src/ui/modals.js` : le hub sort, et éteint deux crochets ✅

`openModal`, `closeModal`, `initSwipeToClose` déménagent. **Déplacement pur**, prouvé par les
tests d'écran existants — aucun test neuf nécessaire, aucun import de test modifié.

**Les 34 lignes qui ne lui appartenaient pas** sont devenues des crochets. `openModal`
contenait la remise à zéro complète de « coller une recette » (29 l) et l'affichage des
modèles IA des réglages (5 l). Le premier bloc **écrit `_lastTransformedRecipe`, variable
privée d'un autre écran** — un import ne peut pas faire ça, c'était un vrai cycle. Désormais
le socle sait qu'il faut *prévenir* un écran, plus quoi faire à sa place.

**Bilan des couplages : 5 crochets → 4.**

| Crochet | Devenu |
|---|---|
| `registerCartPickerHooks` | ❌ supprimé — import direct |
| `registerEmojiModalHooks` | ❌ supprimé — import direct |
| `registerRecipeModalHooks` | ✅ conservé — `modals.js` importe `quitterPleinEcranSiBesoin` de `recipeModal.js`, l'inverse serait un vrai cycle |
| `registerModalHooks` | ➕ ajouté (2 crochets, sous le seuil de 6 fixé par le LOT 014) |

`cartPicker.js`, cité par le LOT 014 comme **le couplage le plus lourd du projet** (trois
injections), n'en a désormais plus **aucune**.

**Preuve par retrait, 4 mutations, 4 rouges :** oublier `registerModalHooks` au démarrage
→ 7 tests rouges ; débrancher chaque crochet → 6 et 1 ; retirer la classe `open` → 7.

**Un commentaire menteur écrit puis corrigé dans le même volet** : l'en-tête annonçait qu'un
`tests/modals.test.js` vérifiait le branchement des crochets. Ce fichier n'existe pas, et la
mutation a montré que le branchement était **déjà** couvert. Corrigé — la règle du LOT 014
(« traquer les commentaires menteurs ») s'applique d'abord à ce qu'on vient d'écrire soi-même.

**`js/app.js` : 1527 → 1467 lignes.** Le gain paraît modeste (−60) parce que les 34 lignes de
cas particuliers **restent** pour l'instant dans `js/app.js` : elles partiront avec
`settings.js` (volet B) et `pasteRecipe.js` (volet D), sans que le branchement change de forme.

**Validation à chaque étape : 798/798 Vitest · 16/16 Pytest.**

### Volets B à F — les cinq écrans sortent ✅

| Module | Ce qu'il emporte | `js/app.js` |
|---|---|---|
| `src/ui/settings.js` | fiche technique, clé API, réglages libres (+ `updateApiStatus`, `onApiConfigOpen`) | 1467 → 1387 |
| `src/ui/favorites.js` | rendu, suppression, 3 chemins de sauvegarde, `buildRecipeHandlers`, `printRecipe` | 1387 → 1317 |
| `src/ui/topbar.js` | barre contextuelle, puces de filtre, pastilles (+ les 3 fonctions de filtre) | 1317 → 1098 |
| `src/ui/pasteRecipe.js` | lecture d'URL, transformation IA, 2 sauvegardes, `resetPasteModal` | 1098 → 918 |
| `src/ui/aiPanel.js` | génération, résultats, réglages IA, zone imposée (**17 fonctions, pas 9**) | 918 → **625** |

**Objectif dépassé : 1527 → 625 lignes (−59 %), pour une cible de ~700.**

Deux réordonnancements décidés en cours de route, chacun pour éviter un crochet temporaire :
`modals.js` d'abord (volet A), et `topbar.js` avant `pasteRecipe.js` — ce dernier a besoin de
`updateBadges`, qui serait sinon resté dans `js/app.js`.

### ⚠️ RECTIFICATION — le bilan des couplages que j'ai annoncé était FAUX

J'ai écrit « 5 crochets → 4 » dans les messages de commit, cette fiche, `CURRENT_GOAL.md`,
`ROADMAP.md` et mon compte rendu à Joel. **C'était vrai au volet A, et devenu faux au volet
suivant** : `registerTopbarHooks` a rétabli le compte à 5. Vérifié sur pièce le 2026-07-31.

| | Avant le lot | Après le lot |
|---|---|---|
| Nombre de crochets | **5** | **5** |
| Points de couplage (entrées) | **9** | **10** |

Le détail : `registerCartPickerHooks` (2) et `registerEmojiModalHooks` (2) ont disparu ;
`registerModalHooks` (2) et `registerTopbarHooks` (3) sont apparus. Restent inchangés
`registerAddFormNav` (1), `registerRecipeModalHooks` (2), `registerSyncUi` (2).

**Donc le couplage n'a PAS baissé — il a très légèrement augmenté.** Ce qui a réellement
changé est la NATURE des couplages, et c'est défendable, mais ce n'est pas ce que j'avais
annoncé :

- **avant**, deux modules déjà extraits dépendaient par injection de code resté prisonnier
  du fourre-tout, sans perspective de sortie ;
- **après**, les crochets pointent tous vers du code qui attend son propre module (l'écran
  inventaire) ou vers de vrais cycles irréductibles (`recipeModal`, `sync`).

La leçon est la même que celle du lot sur les commentaires menteurs : **une affirmation
chiffrée doit être remesurée à chaque étape, pas recopiée d'une étape à l'autre.** C'est
exactement l'erreur commise trois fois sur ce lot (1523, 1366, puis ce compte de crochets).

### Le défaut que 798 tests verts n'ont pas vu 🔴

**La construction de production était CASSÉE depuis le volet A**, donc la branche était
**impubliable**, et rien ne le disait. En supprimant deux crochets de leurs modules, j'avais
laissé `js/app.js` les importer encore. Vitest résout les modules à la demande et n'a jamais
bronché ; `vite build` échoue net sur `MISSING_EXPORT`.

**Contre-épreuve faite** : en important une `fonctionQuiNExistePas` totalement imaginaire,
les **798 tests passent toujours** — seule la construction la refuse.

**Correctif de fond, au-delà du bug** : la validation unifiée passe de 2 à **3 étapes**
(`validate.bat`, `npm run check` et `CLAUDE.md` §4 mis à jour ensemble). Une suite de tests
verte ne prouve pas que l'application se construit — donc pas qu'elle est publiable.

**Validation finale : 798/798 Vitest · 16/16 Pytest · build OK.**
