# LOT 010 — Règles métier retrouvées — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — s'exécute après le LOT 009
> **Branche à créer :** `feat/lot10-regles-metier`
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

**Aujourd'hui :** `index.html:432-442` passe `'cuisine'` → `toggleAiChip` (`js/app.js:430-436`)
écrit `state.aiConfig.cuisine` ; mais le prompt lit `aiConfig.cuisines` (`src/services/
gemini.js:73`), initialisé `[]` (`src/state.js:25`) et jamais alimenté. Les puces s'allument,
le choix est ignoré. Le monolithe mappait `'cuisine'→'cuisines'` (l.4955-4958).

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

**Aujourd'hui :** `togglePin` (`src/actions.js:20-26`) n'a plus aucun plafond ni toast, alors
que l'UI promet toujours « Max 6 ingrédients imposés au total » (`index.html:404`) et que
`addExtraIngredient` garde SA limite de 6.

**Attendu — règle TRANCHÉE (l'audit de campagne Codex a montré qu'un exécutant ne pouvait
pas choisir objectivement entre « 6 épinglés », « 6+6 » et « 6 au total ») :** l'oracle
prime, conformément à l'arbitrage global de Joel. Le monolithe plafonnait à **6 épinglés**
(l.4733-4742) ET, séparément, à **6 extras** (`addExtraIngredient` — plafond encore en
place aujourd'hui, `js/app.js:1219`). Donc :
- restaurer le plafond de **6 épinglés** dans `togglePin` + toast d'explication, identiques
  à l'origine (lire l.4733-4742 pour le libellé exact) ;
- conserver le plafond de 6 extras existant, inchangé ;
- **corriger le libellé menteur de l'UI** (`index.html:404`, « Max 6 ingrédients imposés au
  total ») → « Max 6 épinglés + 6 hors stock » (ou équivalent exact) ;
- une constante par plafond (SSOT), partagée entre le code et le libellé si possible.

### 3. Zone « Ingrédients imposés » complète + sous-titre vivant (casse C10)

**Aujourd'hui :** `renderExtraChips` (`js/app.js:1240-1249`) n'affiche QUE les extras, sans
emoji. Un épinglé est envoyé à l'IA (`gemini.js:70`) mais invisible et non retirable dans la
vue IA. Le sous-titre `#ai-context-sub` (`index.html:332`) est figé sur son texte par défaut.

**Attendu (oracle : monolithe `renderImposedZone` l.4875-4910, `updateAIContextSub`
l.4943-4953) :**
- deux sections : « 📍 Dans l'inventaire » (épinglés, puce avec emoji + ✕ qui désépingle) et
  « 🛒 Hors inventaire » (extras, avec emoji — voir LOT 012 chantier autoEmoji) ;
- sous-titre recalculé à chaque changement : « X ingrédient(s) en stock · Y épinglé(s) ·
  Z hors stock » (pluriels du monolithe) ;
- rafraîchi aux mêmes moments que l'origine : rendu de la vue IA, épinglage/désépinglage,
  ajout/retrait d'extra.

### 4. Tri alphabétique de l'inventaire (casse C11)

**Aujourd'hui :** `getFilteredIngredients` (`js/app.js:281-301`) rend l'ordre d'insertion —
un ajout apparaît en fin de grille.

**Attendu (oracle : monolithe l.4646) :** tri `localeCompare('fr')` sur le nom, appliqué au
résultat filtré. **Piège :** ne PAS toucher à l'ordre de l'export presse-papier — son tri
« par défaut volontaire » a été explicitement conservé au LOT 005 (fiche LOT 005, livraison D).

### 5. Quantités recalculées selon le nombre de personnes (casse C12)

**Aujourd'hui :** `changePplScale` (`js/app.js:533-540`) change le chiffre affiché, rien
d'autre (« Quantitative scaling logic could be added here if needed »).

**Attendu (oracle : monolithe `scaleQty` l.5474+, `changePplScale` l.5467, état
`_currentScale`/`_originalPpl` l.5357-5359) :** les boutons −/+ recalculent chaque quantité
affichée (300 g → 450 g pour 2→3 personnes) et re-rendent la liste d'ingrédients du modal.
Porter la fonction d'analyse des quantités du monolithe (elle gère nombres, fractions et
unités collées). Fonctionne pour les trois sources du modal (IA, favori, recette collée).
La valeur d'origine reste la référence : revenir au nombre initial redonne les quantités
initiales EXACTES (pas d'erreurs d'arrondi cumulées).

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
- si un second `<select>` du même écran est lui aussi sans effet, appliquer le même
  traitement (vérifier — les deux menus de modèles partagent probablement le même défaut).

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
