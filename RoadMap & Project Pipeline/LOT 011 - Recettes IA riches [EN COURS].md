# LOT 011 — Recettes IA riches — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — ouvert le 2026-07-30, après publication de la 5.6
> **Branche :** `feat/lot11-recettes-ia-riches` (partie de `main` en 5.6)
> **Niveau d'audit : DUR** — touche `src/services/gemini.js` (zone sensible,
> `DOCTRINE_PRODUIT.md` §3)
> **Effort estimé :** ~1 à 2 journées — le plus gros lot de restauration
> **Version visée :** 5.7 (avec le LOT 012)

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
`Backlog/BACKLOG - Regressions de la migration.md` (§3 partiel et §4), monolithe
`foodapp-v5-Joel.html` aux lignes citées — **oracle comportemental.**

> ⚠️ **Les ancrages ci-dessous ont été VÉRIFIÉS un par un lors de la phase découverte
> du 2026-07-30 (§8).** Deux noms de fonctions cités dans la version initiale de cette
> fiche n'existaient pas dans l'oracle ; ils sont corrigés ici. Les numéros de ligne
> restants sont exacts.

---

## Objectif

La migration a réduit tout l'écosystème « recettes IA » à un squelette : cartes appauvries,
détail appauvri, prompts amputés de leurs protections, favoris muets, récupération d'URL
dégradée. Restaurer la richesse d'origine — c'est la partie de l'app que Joel utilise pour
cuisiner.

## Périmètre — 7 chantiers

### 1. Cartes de résultats IA complètes

**Aujourd'hui :** `renderRecipeCard` (`src/ui/recipe.js:4-17`) = emoji + nom + « temps ·
difficulté ». **Oracle : `renderAIResults`, `foodapp-v5-Joel.html` l.5283-5331** (vérifié —
la fiche disait l.5337, la fonction se termine en réalité à 5331).

**Attendu — structure exacte de l'oracle (l.5308-5328) :**

```
.recipe-card (clic = ouvre le détail)
 └ .rc-header
    ├ .rc-num          → numéro d'ordre (i + 1)
    └ .rc-body
       ├ .rc-name      → r.name || r.title || 'Recette sans titre'
       ├ .rc-meta      → ⏱ temps · émoji de difficulté + difficulté ·
       │                  👥/👤 N pers. · 🍴 cuisine
       ├ .rc-pitch     → r.description (omis si absent)
       └ .rc-tags      → tags d'ingrédients colorés (6 MAXIMUM — `slice(0, 6)`)
 └ .rc-actions
    ├ .rc-btn.primary  → « Voir la recette → »
    ├ .rc-btn          → « ⭐ Favoris »
    └ .rc-btn.cart-btn → « 🛍 hors stock => courses »
                         AFFICHÉ UNIQUEMENT si au moins un ingrédient a s === 'missing'
```

**Règle des couleurs (oracle l.5294-5304), à respecter au caractère près :**

| Couleur | Condition oracle | Info-bulle |
|---|---|---|
| `green` | correspondance de nom **exacte** ET en stock | `Nom (En stock : <nom réel>)` |
| `orange` | en stock mais correspondance **approximative** | `Nom (Estimation basée sur : <noms>)` |
| `red` | pas en stock | `Nom (Manquant)` |

Préfixe `📌 ` sur le tag si l'ingrédient est épinglé.

- Les styles `.r-tag`, `.rc-header`, `.rc-num`, `.rc-body`, `.rc-pitch`, `.rc-tags`,
  `.rc-actions`, `.rc-btn` existent, **orphelins**, dans `css/style.css:1562-1720` — les
  réutiliser, pas les recréer. **⚠️ Ils étaient promis à la suppression comme CSS mort :
  ce lot les réactive, NE PAS les supprimer au LOT 014.**
- **Cascade CSS à vérifier avant de coder** : `.r-tag.green` / `.r-tag.red` sont définis
  DEUX fois (l.1483/1625 et l.3247/3253) ; `orange` n'existe QUE dans le second bloc
  (l.3259). Le second bloc gagne en cascade. Utiliser `green` / `orange` / `red`.
- Correspondance stock : réutiliser `matchIngredientToStock` (LOT 006, `js/app.js:1042`) —
  ne PAS réécrire une deuxième logique de correspondance (SSOT). **Elle doit être étendue**
  (voir §8, décision D3).

### 2. Détail de recette complet

**Aujourd'hui :** `renderRecipeDetail` (`src/ui/recipe.js:26-114`) a perdu : pastilles d'état
par ingrédient, section « État des stocks », description et cuisine, Nutri-Score visuel
(`ns-bar`), étapes cochables, et l'affichage des favoris « texte brut » (`r.content`) — un
favori collé tel quel s'affiche aujourd'hui **VIDE (confirmé par lecture de code : trois
recherches convergentes, aucune trace de `content` dans les modules)**.

**Oracle : `openRecipeDetail` l.5362 et `renderRecipeBody` l.5486-5597** (les deux ancrages
vérifiés EXACTS). Structure exacte à restaurer, dans cet ordre :

1. **Méta** (l.5570-5575) : ⏱ temps · émoji + difficulté · badge vert `👥 N pers.` ·
   🍴 cuisine (repli `'Française'`).
2. **Description** en italique entre guillemets, omise si absente (l.5576).
3. **Nutri-Score visuel** (l.5541-5560) : bloc `.nutri-score-logo` / `.ns-brand` /
   `.ns-bars` / `.ns-bar.ns-A…ns-E` avec `.active` sur la lettre obtenue, plus
   `🔥 ~N kcal / pers.` et les tags santé en `.r-tag.blue`. Si pas encore d'analyse :
   bouton « 🔍 Estimer la valeur nutritionnelle (IA) », **affiché seulement si la recette a
   des ingrédients structurés** (jamais sur un favori texte brut).
4. **« 👨‍🍳 Ingrédients & Quantités »** (l.5499-5509) : une ligne par ingrédient —
   pastille ● colorée (vert exact / `#ef6c00` approximatif / `#d63031` manquant), emoji
   (repli `autoEmoji`), nom en gras, quantité mise à l'échelle via `scaleQty` à droite.
5. **« 📋 État des stocks »** (l.5511-5524) : la série complète de tags colorés,
   **sans limite de nombre**. ⚠️ Mêmes COULEURS qu'au chantier 1, mais **info-bulles
   DIFFÉRENTES** (§10-G) : ici l'oracle écrit `Nom (Stock : <noms>)` quand l'ingrédient est
   en stock, et **rien du tout** (juste le nom) quand il est manquant. Ne pas recopier les
   trois textes des cartes.
6. **« 🔥 Préparation Détaillée »** (l.5536) : `<ol class="recipe-steps">` dont chaque
   `<li>` bascule la classe `done` au clic. **Vérifié : purement visuel dans l'oracle, aucune
   persistance** (`this.classList.toggle('done')`). Repli si aucune étape : ligne en
   italique « Aucune étape de préparation détaillée. »
7. **Cas `r.content` (le plus important, oracle l.5593)** : la bascule se fait sur
   **`if (r.steps)`** — s'il n'y a pas d'étapes structurées, tout le corps est remplacé par
   le texte brut `r.content` (retours à la ligne préservés), et le bouton « liste de courses »
   est **masqué**. Un favori collé n'affiche jamais une fiche vide.

Styles orphelins à réactiver : `.recipe-steps li` / `li.done` (`css/style.css:2576-2663`),
`.nutri-score-logo` / `.ns-*` (`css/style.css:3652-3724`), `.recipe-detail-section`,
`.recipe-ing-list`, `.nutri-kcal`.

### 3. Prompts et appels IA re-blindés

**Oracle — noms corrigés (les noms cités par la version initiale de cette fiche
n'existaient pas dans le monolithe) :**

| Fiche initiale (FAUX) | Vrai nom oracle | Lignes |
|---|---|---|
| `generateRecipes` « l.5000+ » | **`generateSuggestions`** | l.5042-5081 |
| `callGemini` « l.5000+ » | `callGemini` | **l.5160-5281** |
| `transformRecipeFromText` | **`transformRecipeAI`** | l.5976-6034 |

**À restaurer dans `src/services/gemini.js`, à l'identique de l'oracle :**

- **`safetySettings` BLOCK_NONE** (oracle l.5219-5224) — les 4 catégories
  (`HARASSMENT`, `HATE_SPEECH`, `SEXUALLY_EXPLICIT`, `DANGEROUS_CONTENT`).
  Absent aujourd'hui de `callAI` : à câbler dans le corps de requête, **frère** de
  `generationConfig`, pas dedans.
- **`topK: 40` / `topP: 0.95`** (oracle l.5226-5233) : ❌ **NE PAS RESTAURER** — voir §10-A.
  Ces paramètres sont **dépréciés et purement ignorés** par `gemini-3.6-flash` et
  `gemini-3.5-flash-lite`. Les restaurer serait du code mort qui donnerait la fausse
  impression d'avoir rebranché une protection. Le mécanisme d'options de `callAI`
  (`src/services/gemini.js:28-29`) reste en place, simplement personne ne l'alimente.
- **« RÈGLE D'OR »** (oracle l.5196), texte littéral à porter :
  `⚠️ RÈGLE D'OR : Si un ingrédient est "IMPOSÉ" (ex: Riz), il A PRIORITÉ et annule toute
  contrainte de régime qui l'interdirait (ex: Sans Céréales).`
- **Consigne des guillemets simples** (oracle l.5203) : `Utilise UNIQUEMENT des guillemets
  simples (') dans les textes (titre, description, étapes). Aucun guillemet double (") dans
  les valeurs de texte.` — c'est une PRÉVENTION en amont ; elle ne remplace pas le sauvetage
  de JSON malformé déjà présent (`gemini.js:112-141`), les deux sont complémentaires.
- **Prompt de collage** (`transformRecipeFromText`, aujourd'hui minimal `gemini.js:146-173`) :
  restaurer l'injection de l'inventaire, la contrainte aux catégories officielles
  (`CATEGORIES.join(', ')`), le champ `s` (`stock|pinned|missing`), la `description`, et les
  règles de cohérence de l'oracle (titre exact, temps incluant repos, quantités réalistes,
  un seul emoji, repère sensoriel par étape, pas de formulation marketing).
  **Contrat d'appel complet à écrire (§10-H)** — aujourd'hui la fonction ne reçoit que
  `(text, apiKey, model)` (`src/services/gemini.js:146`) et l'appelant ne lui transmet **ni le
  titre saisi par l'utilisateur, ni l'inventaire** (`js/app.js:1963`), alors que l'oracle
  injecte les deux (l.5989-5993). Nouvelle signature : titre (repli littéral `Sans titre`),
  contenu, liste des ingrédients en stock, clé, modèle. Un test doit prouver qu'un titre saisi
  à la main arrive bien dans le prompt.
  **Ajout hors oracle validé par Joel (§9, Q1)** : une consigne demandant de conserver le
  nombre de personnes indiqué dans le texte source, au lieu de retomber sur 2.

**Règles SSOT impératives :** les modèles restent gouvernés par `AI_ROLES`
(`src/constants.js`) — aucun nom de modèle en dur ; les catégories viennent de `CATEGORIES`
(`src/data.js`).

**Niveau d'effort IA adapté par tâche (demande Joel 2026-07-30) — FORME CORRIGÉE, §10-A :**
- Câbler `thinkingConfig` dans `generationConfig` de `callAI` (`src/services/gemini.js`).
- **`thinkingLevel` (chaîne), PAS `thinkingBudget` (nombre)** : les modèles Gemini 3.x
  utilisent l'énumération `minimal` / `low` / `medium` / `high`. Envoyer les deux dans la
  même requête provoque une **erreur 400**.
- **Génération de recettes** (`gemini-3.6-flash`) : `thinkingLevel: "high"`.
- **Tâches instantanées** (`categorySuggest`, `emojiSearch`, `gemini-3.5-flash-lite`) :
  `thinkingLevel: "minimal"` — il n'existe pas de niveau « zéro ».
- Option facultative : ajoutée seulement si fournie, jamais imposée par défaut.
- **Filet de sécurité obligatoire** : si l'API répond 400 en citant `thinkingConfig` ou
  `thinkingLevel`, `callAI` rejoue **une seule fois** la requête sans ce champ. Sans ce
  repli, un changement d'API côté Google casserait 100 % des générations.

**⚠️ CONFLIT ORACLE ↔ TESTS — LE PIÈGE PRINCIPAL DE CE CHANTIER (§10-B).**
La consigne « restaurer le prompt à l'identique de l'oracle » est **impossible telle quelle** :
porter littéralement le prompt de l'oracle **casse deux tests existants**.

| Chaîne exigée par un test | Ce que produirait l'oracle littéral | Verdict |
|---|---|---|
| `CUISINE : italienne` (`tests/cuisine-ssot.test.js:118`) | `CUISINE : Limité STRICTEMENT à : italienne.` | ❌ casse |
| `jamais vide` (`tests/gemini.test.js:96`) | `Interdiction des quantités vides` | ❌ casse |
| `CUISINE : Libre` (`tests/cuisine-ssot.test.js:128`) | `CUISINE : Libre (Monde).` | ✅ passe |
| `[QUANTITÉ+UNITÉ]` et `[1 EMOJI]` (`tests/gemini.test.js:86,93`) | présents dans le gabarit de l'oracle | ✅ passent |

**Règle de résolution (non négociable) :** les formulations figées par les tests viennent du
LOT 010 et corrigent un bug **que Joel a constaté en usage réel** (quantités sans unité,
emojis remplacés par du texte). Elles sont **plus récentes que l'oracle et priment sur lui**.
Le prompt final est donc une **FUSION explicite**, pas une copie :
on porte la STRUCTURE et les CONTRAINTES de l'oracle, on garde les FORMULATIONS du LOT 010.
Aucun test existant ne doit être modifié pour faire passer le nouveau prompt.

**Contraintes de l'oracle absentes de la fiche initiale, à porter (l.5186-5205) :**
mission « exactement 5 recettes » · `TYPE DE PLAT : Obligatoire ->` · imposés « C'est une
obligation stricte » / « Aucune contrainte spécifique (liberté totale) » ·
`NOMBRE DE PERSONNES : Exactement N personnes. Aligne les quantités.` · définition explicite
des 4 valeurs de `s` · interdiction des ingrédients `Aucun` et `N/A` · « Tu NE DOIS retourner
QUE du code JSON […] AUCUN texte explicatif ».

**Risque si absent :** recettes bloquées par le filtre de sécurité Google, JSON invalide plus
fréquent — c'étaient des protections gagnées à l'usage.

### 4. Mode 🎲 « recette aléatoire » complet

**Aujourd'hui :** simple alias (`generateRandomWithStock`, `js/app.js:1927-1931`).
**Oracle : `generateRandomWithStock` l.5083-5103 (ancrage vérifié EXACT).**

**Attendu (oracle l.5092-5097) :** remettre à zéro `diet`, `equip`, `meal`, `time`, `diff`,
`exceptions`, `exclusions` et le filtre de cuisine, **en conservant `ppl`**, puis générer
avec une créativité aléatoire **entre 80 et 100** (`Math.floor(Math.random() * 21) + 80`).
Le boost est ponctuel : la créativité SAUVEGARDÉE (acquis LOT 008) ne doit pas être écrasée.

**🚨 DÉCOUVERTE MAJEURE — LA CRÉATIVITÉ N'AGIT PLUS DU TOUT (§10-C, arbitrage Joel requis).**
Dans l'oracle, la créativité pilotait `temperature` (`0.2 + créativité/100`). Or
**`temperature` est déprécié et purement ignoré par `gemini-3.6-flash`**. Conséquence
vérifiée : le curseur « Créativité » de l'écran Recettes IA **n'a aucun effet aujourd'hui**,
et un mode 🎲 qui se contente de pousser la créativité à 90 produirait **exactement les mêmes
recettes** qu'une génération normale. Restaurer le mécanisme à l'identique reviendrait donc à
livrer un bouton qui ne fait rien. Voir l'arbitrage A2 au §11.

**🐛 Bug de l'oracle à NE PAS reproduire (décision D1, §8) :** l'oracle remet à zéro une clé
`cuisine` (singulier) alors que le reste du code lit `cuisines` (pluriel) — le filtre de
cuisine n'était donc **jamais** réellement vidé. Le LOT 010 a fait de `cuisines` la SSOT
stricte sur arbitrage explicite de Joel ; on corrige, on ne recopie pas le bug.

### 5. Confort de génération

**Oracle : l.5052-5058 et l.5068-5072 (ancrages vérifiés EXACTS).**
- **Textes d'étape animés** pendant la génération — littéraux de l'oracle (l.5052) :
  `"Analyse du stock..."`, `"Recherche d'idées..."`, `"Rédaction des recettes..."`
  (trois points ASCII, pas de caractère typographique). Rotation par `setInterval` de
  **2500 ms**, écriture dans l'attribut `data-loading-text` du bouton. `clearInterval`
  **garanti** dans le `finally` (oracle l.5077) — le `finally` de `generateSuggestions`
  existe déjà côté modules, c'est le point d'ancrage naturel.
- **Scroll automatique vers les résultats** (oracle l.5068-5072) : `setTimeout` de 100 ms,
  condition `window.innerWidth < 768`, cible `#ai-results-col` (**pas** `#ai-results-list`),
  `scrollIntoView({ behavior:'smooth', block:'start' })`.
- **Verrouillage du textarea pendant la transformation + aperçu du résultat**
  (oracle l.6019-6025) : le champ contenu passe en `disabled` et affiche
  `✅ Recette analysée et formatée par l'IA.` suivi de la description ; le bouton
  « Transformer » est masqué, le bouton de sauvegarde devient « Sauvegarder en favoris »,
  le bouton « + Liste » apparaît. Aujourd'hui seul le bouton est désactivé
  (`js/app.js:1954-1975`).
- **Remise à zéro des champs à l'ouverture de « Coller une recette »** (oracle
  `openPasteModal` l.5932-5942) : titre, contenu **et URL** vidés, textarea réactivé,
  boutons remis dans leur état initial. Aujourd'hui `openModal` ne purge que
  `_lastTransformedRecipe` (`js/app.js:1376-1392`) — acquis LOT 006 à conserver.

### 6. Récupération d'URL propre

**Aujourd'hui :** allorigins (`fetchRecipeFromUrl`, `js/app.js:1933-1952`) — HTML brut, pas
de titre. **Oracle : `fetchRecipeFromUrl` l.5944-5974.**

**Attendu :** repasser par Jina Reader — URL exacte `https://r.jina.ai/<url>` (préfixe
simple, sans encodage de l'URL cible), titre extrait de la première ligne du Markdown
retourné : `text.split('\n')[0].replace(/^#+\s*/, '').trim()`.

**Vérifications de l'oracle oubliées par la fiche initiale (l.5944-5959), à porter :**
- URL vide → `Veuillez entrer une adresse URL`
- URL ne commençant pas par `http` → `L'adresse doit commencer par http:// ou https://`
- réponse HTTP en échec → `if (!res.ok) throw new Error('Impossible de lire la page')`
  (c'est bien une RESTAURATION, pas un durcissement inventé)

**Durcissement retenu (§10-D, ne réintroduit AUCUN repli — compatible avec l'arbitrage Q2) :**
délai d'expiration de 10 s sur l'appel, et réponse vide ou non textuelle traitée comme un
échec. Sans cela, un service tiers bloqué laisse le bouton en « Lecture… » indéfiniment, et
une page d'erreur HTML finirait comme titre de recette.

Conserver le contrat DOM actuel : bouton `#paste-fetch-btn`, champ cible `#paste-content`,
champ titre `#paste-title`.

**Comportement d'échec — ARBITRÉ (§9, Q2) : AUCUN repli.** Joel a tranché le 2026-07-30 :
on s'en tient à l'oracle. `allorigins` est **remplacé**, pas conservé en secours. En cas
d'échec, message littéral de l'oracle :
`Erreur de lecture. Vérifiez l'URL ou copiez le texte manuellement.`

### 7. Favoris riches

**Aujourd'hui :** `renderFavorites` (`js/app.js:1163-1178`) réutilise la carte appauvrie ;
`saveSuggestionToFavDirect` (`js/app.js:1187-1192`) ne stocke aucune date.
**Oracle : `renderFavorites` l.5867-5916, `saveSuggestionToFavDirect` l.6097-6105.**

**Attendu (oracle l.5903-5915) :** carte `.fav-card` avec `.fav-header` / `.fav-title`,
`.fav-excerpt` (description si recette structurée, sinon les 100 premiers caractères du
texte brut suivis de `...`), la série de tags d'état (**plafond de 8**, oracle l.5891 — à ne
pas confondre avec le plafond de 6 des cartes IA), et `.fav-actions` avec
« 👁 Voir » / « 🗑 Supprimer » (les deux avec `stopPropagation`).
État vide (oracle l.5871) : icône 📖, titre « Aucune recette favorite », phrase d'explication
et bouton « 📋 Coller une recette ».

**Les favoris ont leur PROPRE composant de rendu (`.fav-card`), distinct de la carte de
résultat IA (`.recipe-card`).** C'est ainsi dans l'oracle — deux fonctions séparées. Cela
supprime au passage le risque signalé par l'audit : aujourd'hui les deux écrans partagent
`renderRecipeCard` sans passer les mêmes handlers, et un bouton d'action ajouté à la carte IA
planterait au clic côté favoris (§10-E).

**⚠️ FORME DES DONNÉES — point de sécurité (§10-F).** Joel a déjà des favoris enregistrés en
production ET dans le cloud. Deux formes coexistent :

| | Forme | Où |
|---|---|---|
| Oracle | `{ id, title, recipe, date }` ou `{ id, title, content, date }` (imbriquée) | l.6041-6055 |
| Version 5.6 en ligne | `{ ...recette, id }` (plate, sans date) | `js/app.js:1187` |

**Décision : la forme PLATE reste canonique.** On ajoute uniquement `date`, et on garde les
replis de lecture déjà en place (`fav.recipe || fav`, `js/app.js:909` et `1173`) pour rester
tolérant. **Aucune migration destructive des favoris existants** — un favori déjà enregistré
doit continuer à s'ouvrir et à s'afficher, date absente = pas de date affichée, pas d'erreur.
Le favori « texte brut » est la seule exception de forme : `{ id, title, content, date }`.

Champ de date : l'oracle stocke bien `date: new Date().toLocaleDateString('fr-FR')` à
l'ajout. Styles `.fav-card`, `.fav-date`, `.fav-excerpt`, `.fav-empty*` déjà présents,
orphelins, `css/style.css:1746-1842`.

**Affichage de la date — ARBITRÉ (§9, Q3) : OUI.** Dans l'oracle la date était stockée mais
**jamais affichée** (zéro lecture dans tout le monolithe). Joel a tranché le 2026-07-30 :
on la stocke ET on l'affiche, dans `.fav-date` qui existe déjà et attend ce champ.

## Pièges connus

- **`renderRecipeModal()` (`js/app.js:893-902`) est le point d'entrée UNIQUE de rendu du
  modal**, verrouillé par contrat : `openRecipeDetail` réinitialise l'échelle,
  `changePplScale` la change, `analyzeNutrition` la PRÉSERVE. Tout nouveau chemin de rendu
  doit passer par là — jamais un `replaceChildren` direct, sous peine de reperdre
  silencieusement le plein écran (LOT 009) et le recalcul des quantités (LOT 010).
- **`syncRecipeFullscreenClass` cible `#modal-recipe-detail` en dur** (`js/app.js:1008`) et
  le CSS plein écran s'accroche à `.modal-overlay.recipe-fullscreen` + `.modal-content` :
  ne pas changer l'id du modal ni la classe racine rendue par `renderRecipeDetail`.
- **`initSwipeToClose` s'appuie sur `overlay.querySelector('.modal-content')`** et sur les
  100 premiers pixels du haut : conserver `.modal-content` comme racine rendue.
- **Deux appelants pour `renderRecipeCard`** (résultats IA `js/app.js:794`, favoris
  `js/app.js:1174`) : toute nouvelle prop attendue par la carte enrichie doit être fournie
  par LES DEUX, sinon un contexte plante au clic sans erreur au rendu. Au passage, l'appelant
  « favoris » ne transmet pas `source: 'fav'` — à corriger puisque les boutons directs en
  dépendent.
- **Jeton anti-course du LOT 006** (`_aiSuggestGenId`, `js/app.js:34`) : il protège
  **uniquement** le flux de suggestion de catégorie/emoji (`handleAddInput`), PAS la
  génération de recettes. Ne pas le casser ; ne pas supposer qu'il couvre déjà les chantiers
  3-5.
- Le rendu passe par `h()` (`src/utils/dom.js:8-33`) — sûr par construction. **Interdiction
  d'introduire du `innerHTML`** avec du contenu IA (règle XSS du projet). `h()` ignore
  silencieusement les enfants `null`, ce qui permet le patron `condition ? h(...) : null`.
- **Aucun test ne verrouille aujourd'hui le bouton 🖨️ ni le plein écran** — seuls le
  glissement (`tests/swipe-close.test.js`) et le recalcul des quantités
  (`tests/recipe-scaling.test.js`) ont un filet. Ces deux-là sont donc à vérifier À LA MAIN
  après la réécriture du modal.
- Un commentaire de `src/state.js:217` contient la chaîne `gemini-2.0-flash` : faux positif
  connu du critère « zéro nom de modèle en dur », à signaler à l'audit plutôt qu'à supprimer.

## Plan de test

- [ ] Unitaires : le prompt de génération contient RÈGLE D'OR + safetySettings + topK/topP
      + consigne guillemets simples (étendre `tests/gemini.test.js`) ; le prompt de collage
      contient l'inventaire et les catégories officielles ; `thinkingConfig` transmis quand
      demandé et absent sinon ; un favori `content`-seul rend un texte non vide ; la date de
      sauvegarde est stockée ; les 3 couleurs de tags suivent la règle exacte de l'oracle ;
      le mode 🎲 vide bien `cuisines` et conserve `ppl` sans écraser la créativité sauvegardée
- [ ] Non-régression : les 3 chaînes figées du prompt sont toujours présentes après
      réécriture ; `renderRecipeModal` reste le seul point de rendu du modal
- [ ] Manuels (Joel) : cartes riches avec tags colorés fidèles au stock ; détail complet ;
      étapes cochables ; 🎲 varié ; textes d'attente animés ; scroll mobile ; import d'URL
      avec titre auto ; favoris riches
- [ ] **Rejouer OBJECTIVEMENT les acquis 009/010 après la refonte du modal** (audit Codex :
      un rappel textuel peut être « respecté » en apparence tout en reperdant un acquis) :
      bouton 🖨️ présent et fonctionnel après 3 réouvertures · plein écran + resynchronisation
      à la sortie par Échap · fermeture par glissement · recalcul des quantités −/+ avec
      aller-retour exact. Ces quatre points sont des CRITÈRES D'ACCEPTATION, pas des rappels.

## Critères d'acceptation

- [ ] Validation unifiée verte + build OK ; zéro nom de modèle en dur hors `constants.js`
      (recherche `gemini-` : uniquement `constants.js`, plus le commentaire connu de
      `src/state.js:217`)
- [ ] Audit DUR rendu, réserves traitées
- [ ] Cocher les points §4 correspondants dans la fiche régressions

---

## 8. PHASE DÉCOUVERTE — 2026-07-30 (obligatoire, faite AVANT la première ligne de code)

Trois explorateurs en lecture seule : vérification des ancrages de l'oracle · inventaire de
la chaîne IA · inventaire du rendu et des favoris.

### 8.1 Vérification des ancrages (le piège n°1 du projet)

Au LOT 010, **10 citations de lignes de la fiche étaient périmées**. Contrôle systématique
cette fois : **les numéros de ligne sont exacts ou quasi-exacts** (une seule borne de fin
décalée, l.5331 au lieu de 5337). En revanche **deux NOMS de fonctions n'existaient pas dans
l'oracle** — corrigés au §3 : `generateSuggestions` et `transformRecipeAI`.

### 8.2 Ressources réutilisables trouvées (à réutiliser, pas à recréer)

| Ressource | Où | Sert à |
|---|---|---|
| `callAI` — point d'entrée HTTP unique vers Gemini | `src/services/gemini.js:11-60` | §3 : y greffer `safetySettings` et `thinkingConfig`, sans dupliquer d'appel `fetch` |
| Sauvetage de JSON tronqué (parcours caractère par caractère) | `src/services/gemini.js:112-141` | §3 : déjà là, à conserver — complémentaire de la consigne guillemets simples |
| `matchIngredientToStock` | `js/app.js:1042-1064` | §1 et §2 : correspondance stock, SSOT — à étendre (D3) |
| Patron de correspondance approximative + « Correspond à … » | `js/app.js:1104-1111` (sélecteur de courses) | §1 : même schéma de lecture des couleurs, déjà éprouvé |
| `scaleQty` | `src/utils/helpers.js:129` | §2 : quantités mises à l'échelle dans le nouveau rendu d'ingrédients |
| `autoEmoji` | `src/utils/helpers.js:84` | §2 : repli d'emoji par ingrédient (l'oracle fait pareil) |
| `AI_ROLES` / `defaultAiModels()` | `src/constants.js:8-11`, `src/state.js:9-17` | §3 : SSOT des modèles, réaligné à chaque assainissement d'état |
| `CATEGORIES` | `src/data.js:15-40` | §3 : catégories officielles injectées dans le prompt de collage (patron déjà utilisé `js/app.js:1630`) |
| `h()` | `src/utils/dom.js:8-33` | tout le rendu ; `title` passe par `setAttribute`, enfants `null` ignorés |
| `buildRecipeHandlers` | `js/app.js:871-884` | point d'extension des handlers du modal |
| CSS orphelin cartes : `.rc-header/.rc-num/.rc-body/.rc-pitch/.rc-tags/.rc-actions/.rc-btn` | `css/style.css:1562-1720` | §1 |
| CSS orphelin tags : `.r-tag` + `green/orange/red` | `css/style.css:1483, 1618-1643, 3247-3263` | §1, §2, §7 |
| CSS orphelin favoris : `.fav-card/.fav-title/.fav-date/.fav-excerpt/.fav-actions/.fav-btn/.fav-empty*` | `css/style.css:1746-1842` | §7 |
| CSS orphelin étapes : `.recipe-steps li` / `li.done` | `css/style.css:2576-2663` | §2 |
| CSS orphelin Nutri-Score : `.nutri-score-logo/.ns-brand/.ns-bars/.ns-bar.ns-A…E/.active` | `css/style.css:3652-3724` | §2 |

### 8.3 Manques réels à écrire (rien d'existant à réutiliser)

`safetySettings` · `topK`/`topP` côté appelant · `thinkingConfig` · RÈGLE D'OR · consigne
guillemets simples · enrichissement du prompt de collage (+ extension de sa signature pour
recevoir le stock) · textes animés + `clearInterval` · scroll mobile · verrouillage du
textarea + aperçu · vidage des champs de collage · mode 🎲 réel · pastilles / section
« État des stocks » / Nutri-Score visuel / étapes cochables / rendu `r.content` · Jina
Reader · date de sauvegarde des favoris · boutons directs par carte.

### 8.4 Décisions d'exécution prises à la découverte

- **D1 — Le bug `cuisine` du mode 🎲 est corrigé, pas recopié.** L'oracle vidait une clé
  fantôme au singulier. Le LOT 010 a fait de `cuisines` la SSOT stricte sur arbitrage
  explicite de Joel ; la correction est la conséquence directe de cet arbitrage déjà tranché.
- **D2 — Le rendu reste « bête ».** Les états de stock sont calculés dans `js/app.js` (là où
  vit l'inventaire) et passés en propriétés aux composants de `src/ui/recipe.js`, qui
  n'accèdent jamais à l'état global. C'est la ligne déjà tenue par le projet ; l'alternative
  (exporter `matchIngredientToStock` vers la couche d'affichage) créerait une dépendance
  inverse.
- **D3 — `matchIngredientToStock` est ÉTENDUE, pas modifiée.** L'oracle a besoin de deux
  informations que la fonction ne renvoie pas : `isPinned` (préfixe 📌) et la liste des
  correspondances en stock (info-bulles). Elles sont **ajoutées** au retour.
  **La sémantique existante de `inStock` / `isExact` / `matchedName` n'est PAS touchée** :
  elle est figée par le sélecteur de courses et ses tests (pare-feu A/B — un enrichissement
  ne change jamais un comportement observable existant).
  ⚠️ **Écart assumé avec l'oracle, à déclarer à l'audit** : l'oracle ignore le statut `s`
  annoncé par l'IA et ne regarde que l'inventaire ; la version du LOT 006 fait confiance à
  `s` en priorité. Dans le cas limite « l'IA dit *en stock* mais l'inventaire dit *épuisé* »,
  les deux ne donnent pas la même couleur. On garde la version LOT 006 (plus récente,
  délibérée, couverte par des tests) et on documente la divergence.
- **D4 — Étapes cochables : aucune persistance.** Vérifié dans l'oracle : simple bascule de
  classe au clic, perdue à la fermeture. Rien à ajouter dans l'état ni dans la synchro.

---

## 9. ARBITRAGES DE JOEL — TRANCHÉS le 2026-07-30

La phase découverte a établi que **trois points de cette fiche décrivaient des NOUVEAUTÉS et
non des restaurations**. Règle du projet : « on porte, on n'invente pas ». Soumis à Joel,
tranchés :

| # | Point | Réalité de l'oracle | **Décision de Joel** |
|---|---|---|---|
| Q1 | « Respecter le nombre de personnes du texte source » dans le prompt de collage | Aucune instruction de ce type ; `"people":2` n'est qu'un exemple de format | ✅ **RETENU** — la consigne est ajoutée au prompt de collage |
| Q2 | Repli si Jina Reader échoue | Aucun repli — seulement un message d'erreur | ❌ **ÉCARTÉ** — on s'en tient à l'oracle : Jina Reader seul, et en cas d'échec un message explicite invitant à copier le texte à la main. **Le code allorigins actuel est donc REMPLACÉ, pas conservé en secours.** |
| Q3 | Date de sauvegarde des favoris **affichée** | Stockée, jamais affichée (0 lecture) | ✅ **RETENU** — date stockée à l'ajout ET affichée dans `.fav-date` |

**Conséquence directe de Q2 sur le chantier 6 :** `fetchRecipeFromUrl` ne garde aucune trace
d'`allorigins`. Un seul chemin, un seul point de défaillance, message d'erreur littéral de
l'oracle : `Erreur de lecture. Vérifiez l'URL ou copiez le texte manuellement.`

## 10. AUDIT DE SPEC — 2026-07-30 (avant la première ligne de code)

Décidé par Joel. **Duel** : Gemini 3.6 Flash ET Codex 5.6 Terra, en parallèle, sans se voir.
**Les deux ont rendu NO-GO.** Chaque point a ensuite été **contre-vérifié contre le vrai
code** avant intégration (protocole du LOT 010, où deux findings d'auditeur s'étaient révélés
inexacts). Résultat : 8 points retenus, 1 réfuté, 2 défauts trouvés par la contre-vérification
elle-même que ni l'un ni l'autre n'avait vus.

| Réf | Point | Source | Vérification | Traitement |
|---|---|---|---|---|
| **A** | `topK`/`topP`/`temperature` dépréciés et ignorés par Gemini 3.x ; `thinkingBudget` remplacé par `thinkingLevel` ; les deux ensemble → erreur 400 | Terra (précis), Gemini (partiel) | ✅ **CONFIRMÉ** par la documentation Google | §3 réécrit : `thinkingLevel` `high`/`minimal`, `topK`/`topP` NON restaurés, repli sur erreur 400 |
| **B** | Le prompt ne peut pas être porté « à l'identique » : il **casse 2 tests existants** | 🔍 **Trouvé par la contre-vérification** (Terra avait vu le prompt incomplet, pas le conflit) | ✅ vérifié ligne à ligne | §3 : règle de fusion explicite — les formulations du LOT 010 priment sur l'oracle |
| **C** | La créativité ne pilote plus rien : `temperature` est ignoré ⇒ le mode 🎲 serait un bouton mort | 🔍 **Trouvé par la contre-vérification** | ✅ conséquence directe de A | §4 + arbitrage A2 (§11) |
| **D** | Lecture d'URL : aucune validation, aucun délai, aucun contrôle de réponse | Terra + Gemini (convergents) | ✅ **CONFIRMÉ** — et la validation d'URL + `res.ok` sont dans l'oracle, donc des RESTAURATIONS oubliées | §6 complété |
| **E** | `renderRecipeCard` partagé par deux écrans sans les mêmes handlers ⇒ plantage au clic | Gemini | ✅ **CONFIRMÉ**, mais le correctif proposé était mauvais : l'oracle a **deux composants distincts** | §7 : les favoris reçoivent leur propre `.fav-card` |
| **F** | Forme des favoris non tranchée ; risque sur les données déjà enregistrées de Joel | Terra | ✅ **CONFIRMÉ** (plate en 5.6 vs imbriquée dans l'oracle) | §7 : forme plate canonique, `date` ajoutée, aucune migration destructive |
| **G** | Info-bulles du détail ≠ info-bulles des cartes | Terra | ✅ **CONFIRMÉ**, la fiche disait « mêmes règles » à tort | §2 corrigé |
| **H** | Prompt de collage : ni le titre ni l'inventaire ne sont transmis | Terra | ✅ **CONFIRMÉ** | §3 : contrat d'appel complet |
| **I** | Plafond de 8 tags sur les favoris (vs 6 sur les cartes) | Terra | ✅ **CONFIRMÉ** (oracle l.5891) | §7 complété |
| **J** | « Trois chaînes figées » alors que la fiche en énumérait quatre | Terra | ✅ **CONFIRMÉ** — erreur de rédaction | §3 corrigé |
| **K** | ❌ « L'oracle écrit les textes d'attente dans `btn.textContent` » | Gemini | ❌ **RÉFUTÉ** : l'oracle utilise `setAttribute('data-loading-text')` (l.5054-5057), et le mécanisme CSS existe déjà (`css/style.css:3539`, `index.html:473`) | Aucun changement — la fiche avait raison |
| **L** | Confirmer que `openEnhancedCartPicker` ne régresse pas | Gemini + Terra (convergents) | ✅ ajout pur confirmé | Test de non-régression ajouté au plan |

**Ordre d'exécution retenu** (les deux auditeurs convergeaient) : sous-lots sur la MÊME
branche, avec un audit à la fin de chacun.
- **11A — moteur** : chantiers 3, 4, 6 (services + flux d'appel, validés par tests unitaires
  sans risque d'altérer l'affichage).
- **11B — rendu** : chantiers 1, 2, 5, 7 (DOM, CSS dormant, favoris) — c'est là que les
  4 acquis des LOTS 009/010 doivent être rejoués impitoyablement.

## 11. ARBITRAGES REMONTÉS À JOEL PAR L'AUDIT — TRANCHÉS le 2026-07-30

| # | Question | **Décision de Joel** |
|---|---|---|
| **A1** | « Sauvegarder tel quel » : l'oracle enregistrait un favori en texte brut SANS passer par l'IA (l.6048-6054). Le LOT 006 a grisé ce bouton tant que le texte n'est pas transformé, ce qui rend ce chemin **impossible** — et donc l'affichage `r.content` du chantier 2 serait du code mort. | ✅ **RESTAURER L'ORIGINAL.** Le bouton redevient actif dès qu'il y a un titre ET du contenu. Le choix du LOT 006 est explicitement défait ici. Voir §12-A1. |
| **A2** | Le curseur « Créativité » n'agit plus (§10-C) : le réglage qu'il pilotait est ignoré par les modèles Gemini 3.x. | ✅ **LA FAIRE PASSER PAR LA CONSIGNE.** La créativité est traduite en mots dans le prompt. Écart assumé avec l'oracle — l'original ne fonctionne plus. Voir §12-A2. |
| **A3** | Écart D3 : une recette peut afficher « en stock » parce que l'IA l'affirme, même si l'inventaire dit épuisé. | ✅ **ON CROIT L'IA.** Le comportement du LOT 006 est confirmé et devient un choix explicite de Joel, plus une simple conséquence technique. Le sélecteur de liste de courses n'est pas touché. |

## 12. RÈGLES D'EXÉCUTION ISSUES DES ARBITRAGES A1 ET A2

### A1 — « Sauvegarder tel quel » rendu à nouveau possible

- `setPasteSaveButtonsEnabled` (`js/app.js:1366`) ne conditionne plus l'activation à la seule
  présence d'une recette transformée. Règle de l'oracle (l.6039) : refus **uniquement** si le
  titre est vide, ou si le contenu ET la recette transformée sont tous deux absents ;
  message `Titre et contenu requis`.
- Deux formes de favori à l'enregistrement (oracle l.6041-6054), **posées sur la forme plate
  canonique retenue au §7** :
  - texte transformé par l'IA → la recette structurée, plus `date` ;
  - texte brut → `{ id, title, content, date }`.
- **Acquis LOT 006 à NE PAS perdre en défaisant ce point** : `_lastTransformedRecipe` doit
  toujours être remis à zéro à l'ouverture du modal, sans quoi « Sauvegarder tel quel »
  réenregistrerait silencieusement la recette de la session précédente. C'est le vrai bug que
  le LOT 006 corrigeait ; seul le grisage des boutons est défait, pas la remise à zéro.
- Le chantier 2 (rendu `r.content`) devient utile : il existe enfin un chemin qui crée ce type
  de favori. Un test doit couvrir la boucle complète : coller du texte → sauvegarder tel quel
  → rouvrir → le texte s'affiche.

### A2 — La créativité passe par la consigne

- Le curseur reste la SSOT (`state.aiConfig.creativity`, 0-100, restauré au LOT 008) : sa
  valeur ne change pas de nature, seule son utilisation change.
- `generateRecipes` traduit la valeur en une consigne textuelle par paliers, injectée dans le
  prompt. **Aucun nombre brut envoyé à l'IA** — une phrase.
- `temperature` n'est plus envoyé aux modèles Gemini 3.x (ignoré, cf. §10-A).
- Le mode 🎲 (chantier 4) tire toujours une valeur entre 80 et 100 : elle produit désormais un
  effet réel via la consigne, et le boost reste ponctuel (la valeur sauvegardée est intacte).
- Tests : trois valeurs de curseur donnent trois consignes différentes dans le prompt ; la
  valeur sauvegardée n'est jamais écrasée par le mode 🎲.

---

## Traçabilité

- Origine : fiche régressions §4 + §3 partiel — balayage 2026-07-29
- Dépend de : LOT 010 (modal partagé avec C12) ; réutilise `matchIngredientToStock` (LOT 006)
- Phase découverte : 2026-07-30, 3 explorateurs — §8
