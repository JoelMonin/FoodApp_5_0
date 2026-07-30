# LOT 010 — Règles métier retrouvées — SPÉCIFICATION

> **Statut :** 🔵 EN COURS — démarré le 2026-07-30 (signal de Joel « on démarre le lot 10 »)
> **Branche :** `feat/lot10-regles-metier`, ouverte **depuis `feat/lot9-boutons-morts`**
> (le LOT 009 n'est pas encore fusionné — publication reportée par Joel — et les deux lots
> visent la **même version 5.6** : les chaîner évite un conflit de fusion et permet de
> publier la 5.6 d'un bloc quand Joel donnera son feu vert)
> **Niveau d'audit : Standard** (+ relecture ciblée sur le chantier 1, qui touche le prompt IA)
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

### 2. Plafond « max 6 ingrédients imposés » (casse C9)

**Aujourd'hui** (lignes revérifiées) **:** `togglePin` (`src/actions.js:23-29`) n'a plus aucun
plafond ni toast, alors que l'UI promet toujours « Max 6 ingrédients imposés au total »
(`index.html:379`) et que `addExtraIngredient` garde SA limite de 6 (`js/app.js:1739-1741`).

**Attendu — règle TRANCHÉE (l'audit de campagne Codex a montré qu'un exécutant ne pouvait
pas choisir objectivement entre « 6 épinglés », « 6+6 » et « 6 au total ») :** l'oracle
prime, conformément à l'arbitrage global de Joel. Le monolithe plafonnait à **6 épinglés**
(l.4733-4742) ET, séparément, à **6 extras** (`addExtraIngredient` — plafond encore en
place aujourd'hui, `js/app.js:1739-1741`). Donc :
- restaurer le plafond de **6 épinglés** dans `togglePin` + toast d'explication, identiques
  à l'origine (lire l.4733-4742 pour le libellé exact) ;
- conserver le plafond de 6 extras existant, inchangé ;
- **corriger le libellé menteur de l'UI** (`index.html:379`, « Max 6 ingrédients imposés au
  total ») → « Max 6 épinglés + 6 hors stock » (ou équivalent exact) ;
- une constante par plafond (SSOT), partagée entre le code et le libellé si possible.

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

### 5. Quantités recalculées selon le nombre de personnes (casse C12)

**Aujourd'hui** (lignes revérifiées) **:** `changePplScale` (`js/app.js:968-975`) change le
chiffre affiché, rien d'autre (« Quantitative scaling logic could be added here if needed »).

**Attendu (oracle : monolithe `scaleQty` l.5474-5484, `changePplScale` l.5467-5472, état
`_currentScale`/`_originalPpl` l.5357-5359) :** les boutons −/+ recalculent chaque quantité
affichée (300 g → 450 g pour 2→3 personnes) et re-rendent la liste d'ingrédients du modal.
Porter la fonction d'analyse des quantités du monolithe (elle gère nombres, fractions et
unités collées). La valeur d'origine reste la référence : revenir au nombre initial redonne
les quantités initiales EXACTES (pas d'erreurs d'arrondi cumulées).

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

- [ ] Unitaires : prompt contient la cuisine choisie ; migration `cuisine`→`cuisines` ;
      plafond épinglés (à la limite, sous la limite, message) ; tri français (accents :
      « Épinard » avant « Fraise ») ; `scaleQty` (entiers, décimaux, fractions, unités
      collées, aller-retour sans dérive)
- [ ] Manuels (Joel) : puce Italienne → les recettes générées sont italiennes ; épingler un
      7e ingrédient → refus expliqué ; un épinglé apparaît et se retire dans la vue IA ;
      sous-titre vivant ; inventaire trié ; −/+ personnes recalcule les quantités

## Critères d'acceptation

- [ ] Validation unifiée verte + build OK ; arbitrage n°6 tranché et appliqué
- [ ] Audit Standard sur le diff final
- [ ] Cocher C5, C9, C10, C11, C12 dans la fiche régressions

## Traçabilité

- Origine : fiche régressions §1 — balayage 2026-07-29
- Dépend de : **LOT 008** (dépendance technique : `sanitizeGlobalState` et
  `applyExternalState` — correction d'audit de campagne, Gemini 3.1 Pro) ;
  LOT 009 (ordre de campagne)
