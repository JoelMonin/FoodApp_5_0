# BACKLOG — Second rangement de `js/app.js`

**Origine : critère d'acceptation NON ATTEINT du LOT 014.** La fiche visait `js/app.js`
**sous 700 lignes** ; le lot l'a amené de **2 823 à 1 523 lignes (−46 %)** et s'est arrêté là
où les frontières étaient nettes. **Arbitrage de Joel du 2026-07-31 : ni abandonner, ni
empiler sur le 014 — un lot séparé, à froid.** La 5.10 se publie avec le −46 %.

## Pourquoi ce n'est pas urgent

Rien ne fonctionne moins bien à 1 523 lignes qu'à 700. Le bénéfice est de la lisibilité :
retrouver un comportement, et ne pas voir un futur chantier toucher six écrans à la fois. Le
LOT 014 a déjà pris la part la plus rentable — l'état privé de chaque zone vit désormais dans
son module, plus en tête d'un fichier de 2 800 lignes.

## Pourquoi ce sera beaucoup plus facile qu'au LOT 014

À l'ouverture du 014, les zones à déplacer étaient **aveugles** : il a fallu écrire des tests
de caractérisation AVANT chaque déplacement. Ce n'est plus le cas — les LOTS 013 et 014 ont
porté le filet de 448 à 773 tests, et les zones ci-dessous sont couvertes. Le travail devient
un vrai déménagement, pas une exploration.

## Ce qui reste à sortir (~1 000 lignes, mesuré le 2026-07-31)

| Module envisagé | Ce qu'il emporte | Ordre de grandeur |
|---|---|---|
| `src/ui/pasteRecipe.js` | modale « coller une recette » : `transformRecipeAI`, `fetchRecipeFromUrl`, `savePastedRecipe(AndList)`, `setPasteSaveButtonsEnabled`, `_lastTransformedRecipe` | ~180 l |
| `src/ui/favorites.js` | `renderFavorites`, `buildRecipeHandlers`, `saveSuggestionToFavDirect`, `deleteFav`, `pousserFavori` | ~150 l |
| `src/ui/aiPanel.js` | `generateSuggestions`, `generateRandomWithStock`, `renderAI(Results)`, `renderExtraChips`, `addExtraIngredient`, `restoreAIConfig`, `toggleAiChip` | ~250 l |
| `src/ui/topbar.js` | `renderTopbar` (101 l), `renderPantryFilters`, `updateBadges` | ~200 l |
| `src/ui/modals.js` | `openModal`, `closeModal`, `initSwipeToClose` | ~130 l |
| `src/ui/settings.js` | `updateSystemInfo`, `saveApiKey`, `saveAiConfigFromUI` | ~120 l |

Restent alors dans `js/app.js` : le démarrage, `switchView`, `saveState`, les branchements
`expose({…})` et les injections de crochets — soit un point d'entrée, ce qu'il doit être.

## Les 4 variables `_*` de module encore dans `js/app.js`

`_generationInFlight` (partirait avec `aiPanel`) · `_lastTransformedRecipe` (avec
`pasteRecipe`) · `_favCountSub` et `_renderPantryDebounced` (câblage de démarrage, leur place
est probablement ici).

## Pièges relevés pendant le LOT 014, à ne pas redécouvrir

- **`buildRecipeHandlers` a été LAISSÉ exprès dans `js/app.js`** : c'est du câblage vers la
  zone favoris, et le déplacer vers `recipeModal` aurait demandé SIX injections au lieu de
  deux. Il partira naturellement avec `favorites.js` — mais ne jamais le forcer ailleurs.
- **Le MOTIF des faux verrous de modale** : les tests vérifiaient le CONTENU d'une modale sans
  jamais vérifier qu'elle S'AFFICHE. Débrancher l'ouverture ne faisait rougir personne. Avant
  de déplacer `openModal`, poser le verrou qui manque.
- **Idiome d'injection** (`registerXxxHooks`) réservé aux VRAIS cycles d'imports, pas au
  confort. Il y en a déjà cinq ; en ajouter sans cycle réel serait de la dette.
- **Preuve par retrait sur chaque test neuf**, et **exiger un nom de test dans la preuve** :
  un harnais qui conclut « rouge » sur un code de sortie non nul compte les plantages au
  chargement comme des preuves (11 preuves nulles le 2026-07-31).
