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
5. **« 📋 État des stocks »** (l.5511-5524) : la série complète de tags colorés
   (mêmes règles qu'au chantier 1, mais **sans limite de 6**).
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
- **`topK: 40` / `topP: 0.95`** (oracle l.5226-5233). Le mécanisme d'options existe déjà
  dans `callAI` (`src/services/gemini.js:28-29`) mais l'appelant ne les passe jamais.
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
  **La signature doit être étendue** — elle ne reçoit pas le stock aujourd'hui.
  **Ajout hors oracle validé par Joel (§9, Q1)** : une consigne demandant de conserver le
  nombre de personnes indiqué dans le texte source, au lieu de retomber sur 2.

**Règles SSOT impératives :** les modèles restent gouvernés par `AI_ROLES`
(`src/constants.js`) — aucun nom de modèle en dur ; les catégories viennent de `CATEGORIES`
(`src/data.js`).

**Niveau d'effort IA adapté par tâche (demande Joel 2026-07-30) :**
- Câbler le support de `thinkingConfig` dans `callAI` (`src/services/gemini.js`) pour
  transmettre `thinkingBudget` dans `generationConfig`.
- **Génération de recettes** (tâche complexe) : `thinkingBudget: 2048` (ou
  `thinkingLevel: "high"`) afin que le modèle de raisonnement travaille en profondeur et
  respecte toutes les contraintes.
- **Tâches instantanées** (`categorySuggest`, `emojiSearch`) : `thinkingBudget: 0` pour des
  réponses sans délai.
- Même patron que `topK`/`topP` : option facultative, ajoutée seulement si fournie, jamais
  imposée par défaut.

**⚠️ TROIS CHAÎNES DE CARACTÈRES SONT FIGÉES PAR DES TESTS EXISTANTS** — toute réécriture du
prompt de génération doit les préserver littéralement (`tests/gemini.test.js:82-101`,
`tests/cuisine-ssot.test.js:118-134`) :
`[QUANTITÉ+UNITÉ]` · `[1 EMOJI]` · `jamais vide` · la ligne `CUISINE : ${cuisineStr}`
avec `Libre` en repli.

**Risque si absent :** recettes bloquées par le filtre de sécurité Google, JSON invalide plus
fréquent — c'étaient des protections gagnées à l'usage.

### 4. Mode 🎲 « recette aléatoire » complet

**Aujourd'hui :** simple alias (`generateRandomWithStock`, `js/app.js:1927-1931`).
**Oracle : `generateRandomWithStock` l.5083-5103 (ancrage vérifié EXACT).**

**Attendu (oracle l.5092-5097) :** remettre à zéro `diet`, `equip`, `meal`, `time`, `diff`,
`exceptions`, `exclusions` et le filtre de cuisine, **en conservant `ppl`**, puis générer
avec une créativité aléatoire **entre 80 et 100** (`Math.floor(Math.random() * 21) + 80`).
Le boost est ponctuel : la créativité SAUVEGARDÉE (acquis LOT 008) ne doit pas être écrasée.

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
texte brut suivis de `...`), la série de tags d'état, et `.fav-actions` avec
« 👁 Voir » / « 🗑 Supprimer » (les deux avec `stopPropagation`).
État vide (oracle l.5871) : icône 📖, titre « Aucune recette favorite », phrase d'explication
et bouton « 📋 Coller une recette ».

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

## 10. AUDIT DE SPEC — AVANT LA PREMIÈRE LIGNE DE CODE

Décidé par Joel le 2026-07-30, comme au LOT 010 (où l'audit de spec avait rendu un NO-GO
avec 5 points bloquants réels). Auditeur : Codex 5.6 Terra, niveau medium.
Verdict et intégration : à compléter à réception.

---

## Traçabilité

- Origine : fiche régressions §4 + §3 partiel — balayage 2026-07-29
- Dépend de : LOT 010 (modal partagé avec C12) ; réutilise `matchIngredientToStock` (LOT 006)
- Phase découverte : 2026-07-30, 3 explorateurs — §8
