# LOT 018 — L'écran inventaire dans son module — FICHE

> **Statut :** ✅ CLOTURE — publié en **Version 5.11** le 2026-08-01 (avec les LOTS 016 et 017)
> **Branche :** `feat/lot18-ecran-inventaire`, chaînée depuis `feat/lot17` (elle-même sur
> `feat/lot16`) — **trois lots non publiés s'empilent**, signalé à Joel
> **Niveau d'audit : Standard** — déménagement pur, sous filet de tests déjà dense
> **Version visée :** 5.11 (avec les LOTS 016 et 017)

---

## Pourquoi ce lot

Le LOT 017 a sorti six écrans de `js/app.js`, mais **n'a pas fait baisser le couplage** — je
l'avais annoncé à tort, la rectification est dans sa fiche. L'inventaire était le dernier
écran encore logé dans le point d'entrée, et surtout **le seul dont la sortie pouvait
réellement réduire le couplage**.

La raison tient en une ligne : `renderPantry` appelle `renderPantryFilters`, que le LOT 017
avait placée dans `topbar.js`. Sortir l'inventaire sans emporter les puces de filtre aurait
fait dialoguer les deux modules en aller-retour — on aurait déplacé le problème.

---

## Résultat mesuré (tout remesuré, rien recopié)

| | Avant | Après |
|---|---|---|
| `js/app.js` | 625 lignes | **568 lignes** |
| Crochets (registrars) | 5 | **5** (stable) |
| **Points de couplage (entrées)** | **10** | **9** |

**C'est la première baisse réelle du couplage de toute la série.** Elle est modeste — une
entrée — mais elle est réelle et mesurée, contrairement à celle que j'avais annoncée pour le
LOT 017.

Depuis le début du rangement : `js/app.js` est passé de **2823 lignes (avant LOT 014) à 568**,
soit **−80 %**.

---

## Ce qui a bougé

**`src/ui/pantryView.js` (nouveau, 197 lignes)** réunit deux moitiés jusque-là séparées :
- depuis `js/app.js` : `renderPantry`, `getFilteredIngredients`, la barre de recherche
  (`handleSearch`, `clearSearch`, `updateSearchClearButtons`, les deux tables d'identifiants,
  le rendu temporisé) ;
- depuis `src/ui/topbar.js` : `renderPantryFilters`, `setFilter`, `toggleSpecialFilter`,
  `resetFilters`.

**Le crochet `renderPantry` a disparu.** Les trois fonctions de filtre appellent désormais
`renderPantry()` directement, puisqu'elles vivent dans le même module qu'elle.

**`src/ui/topbar.js` retrouve son vrai périmètre** : le titre, le sous-titre, le bouton
d'action contextuel, l'icône mobile, les pastilles de comptage. Ses deux crochets restants
(`switchView`, `exportClipboard`) ne visent aucun écran en particulier — la navigation et le
partage sont communs à plusieurs vues.

**Zéro cycle, zéro crochet créé** : c'est le premier module de la série à sortir « sec ».

---

## Trois pièges évités grâce à la découverte

Chacun aurait causé une régression réelle, et aucun n'était visible à l'œil nu.

1. **`initChipsRowTouchScroll` est un faux ami parfait.** Son commentaire parle des « puces de
   filtre », ce qui en fait un candidat évident au déménagement. Mais son sélecteur
   `.chips-row` couvre **8 éléments d'`index.html`, dont 7 appartiennent au panneau IA** — un
   seul est l'inventaire. C'est de l'initialisation globale : la déplacer aurait silencieusement
   restreint le défilement tactile des réglages IA.
2. **Les 4 alias `Actions.*` ont deux consommateurs**, pas un : la grille d'inventaire **et**
   `expose()`. Les emporter aurait cassé `window.toggleStock` et trois gestes voisins — et
   **aucun test de la grille n'aurait rougi**, puisqu'ils injectent des doublures. Le module
   importe donc ces actions directement, et `js/app.js` garde ses alias.
3. **Le crochet ne tombe pas à 1 mais à 2.** Trois textes du dépôt (`js/app.js`,
   `src/ui/topbar.js`, `PROJECT_MAP.md`) annonçaient « il n'en restera qu'un » — je l'avais
   moi-même répété à Joel. Faux : `exportClipboard` reste. Les trois sont corrigés.

**Un choix tranché explicitement**, pour ne pas le laisser à l'omission :
`initSearchAutofillGuard` (3 lignes, n'appelle que `clearSearch`) **reste au démarrage**, avec
les autres fonctions d'initialisation, plutôt que de partir dans le module.

---

## L'incident des 77 tests rouges — et pourquoi il ne prouvait rien

La première validation après le déménagement a affiché **77 tests en échec**, répartis sur dix
fichiers sans rapport apparent (recettes, correspondance de stock, sélecteur de courses).

**Aucun n'était réel.** Vérifié dans cet ordre : les fichiers incriminés passent seuls (15/15),
puis deux par deux (25/25), puis la suite entière (798/798), puis **deux validations complètes
consécutives, vertes**, et enfin le code de sortie du script (0).

L'explication : le cache de transformation de Vite servait un mélange d'ancien et de nouveau
code, les fichiers ayant été réécrits pendant que le cache était chaud.

**La leçon est celle du harnais de mutation du LOT 014, dans l'autre sens** : là-bas, des
rouges étaient en réalité des plantages qui ne prouvaient rien ; ici, des rouges étaient un
artefact d'outillage. **Un résultat de test qui change tout seul entre deux exécutions ne
prouve rien tant qu'il n'est pas reproduit.** Ne jamais « corriger » un code sur la foi d'un
échec non reproduit — j'aurais cassé du code sain.

---

## Validation

**798/798 Vitest · 16/16 Pytest · build OK**, deux passages complets consécutifs, code de
sortie 0. Aucun test neuf, aucun import de test modifié : le patron du LOT 014 (republier les
noms depuis `js/app.js`) a tenu une fois de plus.
