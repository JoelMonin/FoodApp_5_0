# LOT 009 — Boutons morts rebranchés — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — s'exécute après le LOT 007
> **Branche à créer :** `feat/lot9-boutons-morts`
> **Niveau d'audit : Standard** (interface, pas de zone sensible)
> **Effort estimé :** ~1 journée

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
`Backlog/BACKLOG - Regressions de la migration.md` (§1 : C1, C6, C7, C8), et le monolithe
`foodapp-v5-Joel.html` aux lignes citées — **oracle comportemental : on porte, on n'invente
pas.** Motif récurrent de ces casses : le CSS et le HTML ont survécu à la migration, le fil
JavaScript a été coupé ou rebranché de travers.

---

## Objectif

Quatre éléments visibles de l'interface ne font rien (ou plantent en silence). Les rebrancher
à l'identique du comportement d'origine.

## Périmètre — 4 chantiers

### 1. Changer l'icône d'un ingrédient (casse C1 — crash silencieux)

**Aujourd'hui :** cliquer l'emoji d'une carte d'inventaire (`src/ui/pantry.js:27` →
`openEditEmoji`) plante avant d'ouvrir la fenêtre : `js/app.js:862` écrit dans
`#edit-emoji-input`, un id qui n'existe **nulle part** (ni dans `index.html`, ni même dans le
monolithe — câblage réinventé de travers à la migration). Le modal `index.html:172-192`
contient `edit-emoji-name`, `emoji-search-input`, `edit-emoji-grid` — pas d'input emoji.

**Attendu (oracle : monolithe `openEditEmoji` l.5728, `renderEmojiEditGrid` l.5744,
`updateEmoji` l.5797) :**
- ouverture : le nom s'affiche, la grille `#edit-emoji-grid` est **immédiatement remplie** de
  suggestions locales (adapter la source : le monolithe utilisait `getEmojiSuggestions`/
  `EMOJI_MAP` ; le code actuel a `autoEmoji` + `DEFAULT_DB` + `getCategoryEmoji` — construire
  les suggestions à partir de ces sources existantes, SANS recréer une table d'emojis
  dupliquée : règle SSOT) ;
- clic sur une tuile → applique l'emoji, sauvegarde, ferme (contrat du `updateEmoji` du
  monolithe : pas d'étape intermédiaire) ;
- la recherche IA (`searchEmojiAI`, `js/app.js:1379+`) continue de remplir la même grille, et
  ses tuiles appliquent au clic de la même façon (aujourd'hui elles écrivent dans l'input
  fantôme) ;
- supprimer toute référence à `edit-emoji-input` (y compris `saveEmoji`, `js/app.js:866-873`,
  à réécrire ou supprimer selon le flux retenu) ;
- les tuiles émettent la classe **`emoji-edit-btn`** — son style migré dort dans
  `css/style.css:2093-2113` ; la classe `emoji-btn` actuellement émise (`js/app.js:1384`)
  n'existe dans aucun CSS.

### 2. Plein écran de la recette — mort trois fois (casse C6)

**Aujourd'hui :** `index.html:116` appelle `toggleRecipeFullscreen()` **sans argument** →
no-op (`js/app.js:528-531`) ; si elle recevait l'élément, elle poserait la classe
`fullscreen` qu'aucun CSS ne connaît (le CSS attend `recipe-fullscreen`,
`css/style.css:3154-3177`) ; et l'API plein écran native a disparu.

**Attendu (oracle : monolithe `toggleFullscreen` l.5430-5455, listeners l.5457-5464,
sortie dans `closeModal` l.6658) :**
- le bouton ⛶ (et son équivalent bureau généré par `src/ui/recipe.js:72`) cible l'overlay
  `#modal-recipe-detail` et bascule la classe **`recipe-fullscreen`** ;
- vrai plein écran d'appareil : `requestFullscreen`/`exitFullscreen` avec les préfixes
  (`webkit`, `moz`, `MS`), repli CSS pur si l'API échoue ;
- les 4 événements `fullscreenchange` (+ préfixes) resynchronisent la classe si l'utilisateur
  sort par Échap/geste système ;
- `closeModal` sort du plein écran si actif.

### 3. Bouton Imprimer et fermeture par glissement (casse C7)

**Aujourd'hui :** `openRecipeDetail` (`js/app.js:463-464`) fait `replaceChildren` sur
l'overlay → le squelette statique d'`index.html:109-136` (dont le bouton 🖨️ l.115) est
détruit dès la première ouverture, et les écouteurs tactiles posés par
`initSwipeToClose('modal-recipe-detail')` (`js/app.js:1403-1407`, attachés au `.modal-content`
d'origine) meurent avec lui.

**Attendu :**
- `renderRecipeDetail` (`src/ui/recipe.js`) recrée le bouton 🖨️ dans l'en-tête du modal,
  câblé sur `printRecipe` (la fonction existe, `js/app.js:1308-1310`) ;
- le glissement-pour-fermer fonctionne à CHAQUE ouverture, pas seulement la première —
  au choix de l'exécutant : ré-attacher après chaque `replaceChildren`, ou déléguer les
  écouteurs à l'overlay (qui, lui, survit). Critère : 3 ouvertures/fermetures successives
  au doigt ;
- nettoyer le squelette statique d'`index.html:109-136` devenu inutile (il n'est jamais
  visible) OU le faire correspondre au rendu — pas les deux versions divergentes (SSOT).

### 4. Panneau « Informations Système » — les 3 champs restants (casse C8)

**Contexte :** le LOT 007 restaure `#info-last-sync` et `#info-network` (+ écouteurs
`online`/`offline`). Ce chantier complète le panneau (`index.html:609-629`), figé sur « -- ».

**Attendu (oracle : monolithe `updateSystemInfo` l.4440-4483) :**
- `#info-api-key` : clé masquée `****` + 4 derniers caractères, badge « Configurée (Locale) »
  ou « Manquante » ;
- `#info-fb-user` : identifiant `FB_USER` (importé de la config Firebase) ;
- `#info-storage` : taille de `pantry_v5` en Ko ;
- supprimer la branche morte `#system-storage` (`js/app.js:776` — id inexistant partout) ;
- rafraîchi à l'affichage de la vue Réglages/Export (`js/app.js:157` appelle déjà
  `updateSystemInfo` — conserver ce point d'accroche).

## Pièges connus

- **Ne pas régresser le LOT 006** : le sélecteur d'articles, les boutons grisés du collage et
  `applyCloudState`/`applyExternalState` (LOT 008) touchent les mêmes zones.
- **Preuve visuelle = navigateur.** Une recherche de texte dans les fichiers ne prouve rien
  pour du CSS/DOM (leçon gravée, `CLAUDE.md` §5 et LOT 005).
- Vérifier chaque ligne du monolithe citée AVANT d'écrire — ne pas se fier à cette fiche de
  mémoire (règle : l'oracle est le code d'origine, pas sa description).

## Plan de test

- [ ] Unitaires : construction des suggestions d'emoji (sources existantes, pas de table
      dupliquée) ; `updateSystemInfo` remplit les 3 champs avec un state connu (jsdom)
- [ ] Manuels (Joel, navigateur) : changer une icône en 2 clics ; ⛶ passe l'appareil en vrai
      plein écran et Échap resynchronise ; 🖨️ imprime depuis une recette rouverte 3 fois ;
      glissement ferme le modal à chaque ouverture ; panneau Informations Système entièrement
      renseigné, y compris après passage hors ligne

## Critères d'acceptation

- [ ] Validation unifiée verte + build OK
- [ ] Plus AUCUNE référence à `edit-emoji-input`, `system-storage`, ni à la classe fantôme
      `fullscreen` (3 recherches convergentes chacune, règle `CLAUDE.md` §5)
- [ ] Audit Standard sur le diff final
- [ ] Cocher C1, C6, C7, C8 dans `Backlog/BACKLOG - Regressions de la migration.md`

## Traçabilité

- Origine : fiche régressions §1 (C1, C6, C7, C8) — balayage 2026-07-29 ; C1/C8 signalés
  aussi par Gemini 3.1 Pro le même jour
- Dépend de : LOT 007 (pour ne pas entrer en collision sur `updateSystemInfo`)
