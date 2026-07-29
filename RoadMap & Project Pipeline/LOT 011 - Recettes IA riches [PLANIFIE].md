# LOT 011 — Recettes IA riches — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — s'exécute après le LOT 010
> **Branche à créer :** `feat/lot11-recettes-ia-riches`
> **Niveau d'audit : DUR** — touche `src/services/gemini.js` (zone sensible,
> `DOCTRINE_PRODUIT.md` §3)
> **Effort estimé :** ~1 à 2 journées — le plus gros lot de restauration

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
`Backlog/BACKLOG - Regressions de la migration.md` (§3 partiel et §4), monolithe
`foodapp-v5-Joel.html` aux lignes citées — **oracle comportemental.**

---

## Objectif

La migration a réduit tout l'écosystème « recettes IA » à un squelette : cartes appauvries,
détail appauvri, prompts amputés de leurs protections, favoris muets, récupération d'URL
dégradée. Restaurer la richesse d'origine — c'est la partie de l'app que Joel utilise pour
cuisiner.

## Périmètre — 7 chantiers

### 1. Cartes de résultats IA complètes

**Aujourd'hui :** `renderRecipeCard` (`src/ui/recipe.js:3-16`) = emoji + nom + « temps ·
difficulté ». **Oracle : monolithe `renderAIResults` l.5283-5337.**

**Attendu :** chaque carte restaure — numéro, méta complète (temps/difficulté/personnes/
cuisine), pitch (description courte), **tags d'ingrédients colorés** (vert = en stock,
orange = correspondance approximative, rouge = manquant, avec info-bulle « Correspond à … »)
et boutons directs « ⭐ Favoris » / « 🛍 hors stock → courses ».
- Les styles `.r-tag` existent, orphelins, dans `css/style.css:1618+` — les réutiliser, pas
  les recréer. **⚠️ Ils étaient promis à la suppression comme CSS mort dans l'ancien plan
  (`CURRENT_GOAL.md`) : ce lot les réactive, NE PAS les supprimer au LOT 014.**
- Correspondance stock : réutiliser `matchIngredientToStock` (créée au LOT 006,
  `js/app.js`) — ne PAS réécrire une deuxième logique de correspondance (SSOT).

### 2. Détail de recette complet

**Aujourd'hui :** `renderRecipeDetail` (`src/ui/recipe.js`) a perdu : pastilles d'état par
ingrédient, section « État des stocks », description et cuisine, Nutri-Score visuel
(`ns-bar`), étapes cochables (`toggle('done')`), et l'affichage des favoris « texte brut »
(`r.content`) — un favori collé tel quel s'affiche aujourd'hui VIDE.

**Attendu (oracle : le bloc détail du monolithe, autour de `renderRecipeDetail`/l.5340+) :**
restaurer ces six éléments. Le cas `r.content` est le plus important : un favori sans
`ingredients`/`steps` structurés affiche son texte brut, jamais une fiche vide.

### 3. Prompts et appels IA re-blindés

**Aujourd'hui vs monolithe (`generateRecipes`/`callGemini` l.5000+, `transformRecipeFromText`) :**
perdus — `safetySettings BLOCK_NONE`, `topK`/`topP`, la « RÈGLE D'OR » (les ingrédients
imposés priment sur le régime), la consigne des guillemets simples (anti-JSON cassé) ; et le
prompt de collage a perdu l'injection de l'inventaire, la contrainte aux catégories
officielles, le champ `s` (stock/pinned/missing), la description et le respect du nombre de
personnes du texte source.

**Attendu :** restaurer ces éléments dans `src/services/gemini.js`, à l'identique du
monolithe. **Règles SSOT impératives :** les modèles restent gouvernés par `AI_ROLES`
(`src/constants.js`) — aucun nom de modèle en dur ; les catégories viennent de `CATEGORIES`
(`src/data.js`).
**Risque si absent :** recettes bloquées par le filtre de sécurité Google, JSON invalide plus
fréquent — c'étaient des protections gagnées à l'usage.

### 4. Mode 🎲 « recette aléatoire » complet

**Aujourd'hui :** simple alias de la génération normale. **Oracle : l.5083-5103.**
**Attendu :** réinitialise les filtres de la vue IA puis génère avec créativité poussée
(80-100), comme à l'origine. Ne modifie pas la créativité SAUVEGARDÉE (restaurée au LOT 008) :
le boost est ponctuel.

### 5. Confort de génération

**Oracle : l.5052-5058 et l.5068-5072.**
- Textes d'étape animés pendant la génération (rotation 2,5 s : « Analyse du stock… » →
  « Recherche d'idées… » → « Rédaction des recettes… »), `clearInterval` garanti en fin ;
- scroll automatique vers les résultats sur mobile (`< 768px`) après réception ;
- verrouillage du textarea pendant la transformation d'une recette collée + aperçu du
  résultat (comportement `transformRecipeAI` du monolithe) ;
- remise à zéro des champs titre/contenu/URL à l'ouverture de « Coller une recette »
  (aujourd'hui seul `_lastTransformedRecipe` est purgé — LOT 006).

### 6. Récupération d'URL propre

**Aujourd'hui :** allorigins (HTML brut, pas de titre). **Oracle : `fetchRecipeFromUrl` du
monolithe — Jina Reader (`https://r.jina.ai/`).**
**Attendu :** repasser par Jina Reader (texte propre + titre auto-rempli). Conserver un repli
si Jina échoue (au choix de l'exécutant, comportement d'échec = toast explicite).

### 7. Favoris riches

**Aujourd'hui :** cartes muettes, pas de date. **Oracle : `renderFavorites` du monolithe.**
**Attendu :** vignette descriptive, tags d'état des ingrédients, boutons Voir/Supprimer par
carte, CTA « Coller une recette » sur l'état vide, et date de sauvegarde stockée à l'ajout
(`saveSuggestionToFavDirect`, `js/app.js`) et affichée.

## Pièges connus

- **Jeton anti-course du LOT 006** (`_aiSuggestGenId`) : les chantiers 3-5 touchent les mêmes
  fonctions — le préserver, tests à l'appui.
- Le rendu passe par `h()` (`src/utils/dom.js`) — sûr par construction. **Interdiction
  d'introduire du `innerHTML`** avec du contenu IA (règle XSS du projet).
- La casse C12 (quantités par personnes, LOT 010) touche le même modal — coordonner si les
  lots s'exécutent de front (recommandé : à la suite).

## Plan de test

- [ ] Unitaires : le prompt de génération contient RÈGLE D'OR + safetySettings + topK/topP
      (étendre `tests/gemini.test.js`) ; le prompt de collage contient l'inventaire et les
      catégories officielles ; un favori `content`-seul rend un texte non vide ; la date de
      sauvegarde est stockée
- [ ] Manuels (Joel) : cartes riches avec tags colorés fidèles au stock ; détail complet ;
      étapes cochables ; 🎲 varié ; textes d'attente animés ; scroll mobile ; import d'URL
      avec titre auto ; favoris riches datés

## Critères d'acceptation

- [ ] Validation unifiée verte + build OK ; zéro nom de modèle en dur hors `constants.js`
      (recherche `gemini-` : uniquement `constants.js`)
- [ ] Audit DUR rendu, réserves traitées
- [ ] Cocher les points §4 correspondants dans la fiche régressions

## Traçabilité

- Origine : fiche régressions §4 + §3 partiel — balayage 2026-07-29
- Dépend de : LOT 010 (modal partagé avec C12) ; réutilise `matchIngredientToStock` (LOT 006)
