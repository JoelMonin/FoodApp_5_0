# LOT 019 — La correspondance stock ↔ recette ne se trompe plus dans les cas clairs — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — ouvert le 2026-08-01 (cap validé par Joel, spec validée avant implémentation)
> **Branche :** `feat/lot19-correspondance-stock` (depuis `main`, V5.11 publiée)
> **Niveau d'audit : Standard renforcé** — changement de COMPORTEMENT dans le module le plus
> sensible du découpage (`stockMatch.js` décide ce que Joel achète) : audit du diff final +
> agents adversariaux locaux + questions fermées Gemini, preuve par retrait obligatoire
> **Version visée :** 5.12
> **Implémentation prévue : Sonnet**, sur la base de cette spec — la règle du §2 est le
> contrat, pas une suggestion.

---

## 1. Pourquoi ce lot

Le sélecteur « Choisir les articles à acheter » se trompe **dans les deux sens**, constaté en
usage réel par Joel (captures du 2026-08-01) :

- **« Fécule de tapioca »** déclarée absente et pré-cochée… alors que « Fécule (tapioca) »
  est dans l'inventaire, en stock.
- **« Levure boulangère sèche »** proposée à l'achat alors que « levure » est en stock —
  l'avis « manquant » de l'IA écrase la correspondance locale.
- À l'inverse, **« Épices tajine »** n'est pas à racheter selon la correspondance locale
  (« Épices couscous » est en stock) — ici c'est l'IA qui a raison, pas l'inventaire.

Deux causes racines, prouvées par la découverte :

1. **`matchIngredientToStock` prend le PREMIER article au nom voisin, pas le MEILLEUR**
   (`src/utils/stockMatch.js:30`, `find` au lieu du tri de l'oracle
   `foodapp-v5-Joel.html:5339-5355` : exact > en stock > n'importe lequel).
2. **« L'IA fait autorité » est une invention de la version modulaire.** L'oracle ne consulte
   `ing.s` NULLE PART dans le calcul de disponibilité (une seule occurrence dans tout le
   monolithe, `foodapp-v5-Joel.html:5308`, pour afficher un bouton). Les blocs
   `src/utils/stockMatch.js:42-47` et les 4 tests `tests/stock-match.test.js:65-91` gravent
   un comportement qui n'a jamais existé dans l'app de référence.

**Découverte bonus** : le `normalizeString` de l'oracle (`foodapp-v5-Joel.html:6354-6381`)
retire les **mots vides** (`de, du, des, le, la, les, au, aux, un, une, d, l`), **ramène les
pluriels au singulier** (mot > 3 lettres, `s`/`x` final) et rejette les nombres isolés. Ces
trois raffinements ont été **perdus au portage** (`src/utils/helpers.js:29-49` n'en a aucun).
C'est LA cause du cas « fécule » : « fécule de tapioca » ≠ « fécule tapioca » sans retrait
du « de ».

---

## 2. LA RÈGLE (contrat d'implémentation — SSOT de ce lot)

**Principe** : l'inventaire a le dernier mot **dès qu'il parle clairement** ; l'IA n'arbitre
**que la zone du doute**. Ni la règle actuelle (l'IA écrase tout), ni celle de l'oracle
(l'IA ignorée partout) : un partage des rôles, chacun tranchant là où il voit clair.

### 2.1 Forme comparable d'un nom (LOCALE à `stockMatch.js` — ne PAS toucher `helpers.js`)

`nomComparable(nom)` = `normalizeString(nom)` puis, mot à mot :
1. retirer les mots vides : `de, du, des, le, la, les, au, aux, un, une, d, l` (liste de
   l'oracle, `foodapp-v5-Joel.html:6366`) ;
2. dépluraliser : si le mot fait plus de 3 lettres, retirer un `s` ou `x` final
   (`foodapp-v5-Joel.html:6371`) ;
3. rejeter les mots purement numériques (`foodapp-v5-Joel.html:6378`).

Le résultat est un **ensemble de mots**. « Fécule de tapioca » → `{fecule, tapioca}` ;
« Fécule (tapioca) » → `{fecule, tapioca}`. Identiques.

### 2.2 Classement de chaque candidat (candidats = articles d'inventaire acceptés par `areSimilar`, inchangé)

| Classe | Définition (sur les ensembles de mots comparables) | Exemple |
|---|---|---|
| **EXACTE** | ensembles identiques, OU distance de frappe ≤ 1 sur les formes jointes (les deux > 3 caractères) | « Fécule de tapioca » ↔ « Fécule (tapioca) » ; « Tomates » ↔ « Tomate » |
| **GÉNÉRIQUE en rayon** | les mots de l'ARTICLE D'INVENTAIRE sont tous dans la demande (inventaire ⊆ recette) | « levure » ↔ demande « Levure boulangère sèche » |
| **SPÉCIFIQUE en rayon** | les mots de la DEMANDE sont tous dans l'article (recette ⊆ inventaire) | demande « Lait » ↔ « Lait de coco » en stock |
| **FRATRIE** | tout le reste accepté par `areSimilar` | « Épices tajine » ↔ « Épices couscous » ; « Porc (haché) » ↔ « Porc (côtes) » |

### 2.3 Décision `inStock`

| Situation | Qui tranche | Résultat |
|---|---|---|
| Au moins un candidat **EXACTE ou GÉNÉRIQUE** | **L'inventaire, seul. L'avis IA est IGNORÉ.** | `inStock` = l'un de ces candidats a `inStock: true`. Un exact épuisé → manquant, même si l'IA dit « stock ». |
| Seulement des candidats **SPÉCIFIQUE ou FRATRIE** | **L'IA arbitre** (décisions Joel 2026-08-01, D2 et D3) | `s: 'stock'`/`'pinned'` → en stock ; `s: 'missing'` → manquant ; **`s` absent/inconnu → manquant** (l'erreur la moins chère : racheter, pas manquer en cuisinant). |
| **Aucun candidat** | **L'IA arbitre l'absence** | `s: 'stock'`/`'pinned'` → en stock (elle seule connaît les synonymes : « Maïzena » ↔ « Fécule (maïs) ») ; sinon manquant. |

### 2.4 Autres champs du résultat (forme à 5 champs conservée — aucun consommateur ne casse)

- **`matchedName`** = le MEILLEUR candidat, priorité : EXACTE en stock > EXACTE > GÉNÉRIQUE
  en stock > GÉNÉRIQUE > SPÉCIFIQUE en stock > FRATRIE en stock > SPÉCIFIQUE > FRATRIE.
  (Corrige aussi le texte « Correspond à “Fécule (maïs)” » quand « Fécule (tapioca) » existe.)
- **`isExact`** = il existe un candidat EXACTE — toujours **indépendant du stock** (règle
  figée par `tests/stock-match.test.js:50`, conservée telle quelle).
- **`isPinned`**, **`allMatchesInStock`** : calculs inchangés (via `areSimilar`).
- Ordre des couleurs inchangé (`stockMatch.js:75`) : `!inStock → rouge ; isExact → vert ;
  sinon orange`. Effet voulu : « Fécule de tapioca » devient VERTE (exacte au sens enrichi).

### 2.5 Alignement aval obligatoire

`src/ui/recipe.js:22` : retirer le terme `|| (r.ingredients || []).some(i => i.s === 'missing')`.
Le bouton « hors stock => courses » suit désormais les tags (`t.cls === 'red'`), sinon un
`s:'missing'` résiduel ferait apparaître le bouton sous des tags tous verts — incohérence
visible que la découverte a identifiée (vigilance n°4).

---

## 3. Critères d'acceptation — les captures de Joel du 2026-08-01, transcrites en tests

Chaque cas devient un test NOMMÉ, écrit et ROUGE **avant** l'implémentation (volet A) :

| # | Cas | Attendu |
|---|---|---|
| 1 | « Fécule de tapioca » demandée, « Fécule (tapioca) » en stock, IA dit `missing` | **en stock** (exacte, IA ignorée), tag vert, non pré-cochée |
| 2 | « Levure boulangère sèche » demandée, « levure » en stock, IA dit `missing` | **en stock** (générique, IA ignorée) — plus jamais rachetée |
| 3 | « Épices tajine » demandée, « Épices couscous » en stock, IA dit `missing` | **manquante** (fratrie → IA arbitre) — toujours proposée |
| 4 | Idem 3 mais `s` absent | **manquante** (défaut D3) |
| 5 | « Lait » demandé, « Lait de coco » en stock, IA dit `missing` | **manquant** (spécifique → IA arbitre, D2) |
| 6 | Idem 5 mais IA dit `stock` | **en stock** |
| 7 | « Maïzena » demandée, rien de voisin localement, IA dit `stock` | **en stock** (synonymie, seul cas où l'IA crée une disponibilité) |
| 8 | « Carotte » demandée, « Carotte » en stock ÉPUISÉE, IA dit `stock` | **manquante** (l'inventaire parle clairement — INVERSE du test actuel l.66) |
| 9 | « Tomates » demandée, « Tomate » en stock | **en stock**, tag vert (dépluralisation) |

Plus : les **11 tests de caractérisation hors bloc IA** (`tests/stock-match.test.js:26-63`,
`:93-136`) restent verts tels quels — c'est le filet de non-régression gratuit identifié par
la découverte.

---

## 4. Volets d'implémentation (ordre imposé)

- **Volet A — le filet d'abord.** Écrire les 9 tests d'acceptation du §3 (rouges), avec
  l'attendu consigné AVANT exécution (règle de preuve du CLAUDE.md §5). Vérifier que les 11
  tests conservés passent encore.
- **Volet B — le moteur.** `nomComparable` + classement + décision, ENTIÈREMENT contenus dans
  `src/utils/stockMatch.js`. Interdiction de toucher `areSimilar`/`normalizeString`
  (9 appelants de production hors zone — rayon d'impact mesuré par la découverte).
- **Volet C — la réécriture assumée.** Remplacer le bloc `describe` « l'IA fait autorité »
  (`tests/stock-match.test.js:65-91`) par un bloc « l'inventaire a le dernier mot quand il
  parle clairement » — on ne « répare » pas ces tests, on les remplace en le disant.
  Alignement `src/ui/recipe.js:22` (§2.5).
- **Volet D — preuve et validation.** Preuve par retrait sur le moteur (mutations : inverser
  la priorité inventaire/IA, vider la liste de mots vides, casser la dépluralisation —
  chaque mutation doit faire rougir un test NOMMÉ, harnais avec témoin non muté). Validation
  unifiée 3 étapes. Vérification visuelle par Joel sur SES cas (fécule, levure, tajine).

---

## 5. Ce qu'on ne touche PAS (périmètre fermé)

- **`areSimilar` / `normalizeString` globaux** (`src/utils/helpers.js`) — 9 appelants de
  production hors `stockMatch` (ajout manuel, import de stock, dédoublonnage panier…) qui
  ÉCRIVENT des données. La forme comparable du §2.1 vit dans `stockMatch.js` uniquement.
- **`confirmRecipeToCart`** (`src/ui/cartPicker.js:151`) — la fusion à l'écriture continue
  d'utiliser `areSimilar`. Asymétrie lecture/écriture CONSIGNÉE (vigilance n°7 de la
  découverte) : acceptée pour ce lot, à réexaminer seulement si un cas réel la révèle.
- **Le format legacy des vieux favoris** (`ingredients_stock`/`_pinned`/`_horsstock`) — mort
  en v2 (0 occurrence hors oracle), constat de la découverte, hors périmètre.
- **Les imports morts `js/app.js:16-18`** (`normalizeString`, `autoEmoji`, `areSimilar`
  importés sans usage) — signalés, à nettoyer dans un lot de nettoyage, pas ici (pare-feu A/B).

## 6. Décisions de Joel (2026-08-01) — ne pas re-demander

- **Cap validé** : partage des rôles inventaire/IA (« ça m'a l'air bcp plus malin »), spec
  détaillée avant implémentation, implémentation par Sonnet.
- **D2 — cas « lait »** (recette générique, stock spécifique) : **l'IA départage**.
- **D3 — doute sans avis IA** (fratrie, `s` absent) : **proposer d'acheter** (l'erreur la
  moins chère).
- Limite assumée et annoncée : dans la zone du doute, l'IA peut avoir un avis discutable sur
  un cas limite — la promesse est « plus jamais d'erreur dans les cas clairs », pas
  l'infaillibilité.
