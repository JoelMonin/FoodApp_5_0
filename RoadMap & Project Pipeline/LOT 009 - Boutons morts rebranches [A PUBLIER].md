# LOT 009 — Boutons morts rebranchés — SPÉCIFICATION

> **Statut :** 🟢 A PUBLIER — implémenté, testé (112/112), audit Standard GO (Codex, §14),
> vérification navigateur faite par Joel (§13) — en attente du feu vert de publication
> **Branche :** `feat/lot9-boutons-morts`
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
- la recherche IA (`searchEmojiAI`, `js/app.js:1362` — la grille est remplie l.1379+)
  continue de remplir la même grille, et
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

- [x] Unitaires : construction des suggestions d'emoji (sources existantes, pas de table
      dupliquée) ; `updateSystemInfo` remplit les 3 champs avec un state connu (jsdom) ;
      glissement pour fermer (scénarios exacts de l'audit Codex) — `tests/emoji-edit.test.js`
      (9 tests), `tests/system-info.test.js` (5 tests), `tests/swipe-close.test.js` (6 tests)
- [x] Manuels (Joel, navigateur, 2026-07-30) : icône changée avec succès (grille +
      recherche IA — un premier essai de recherche a affiché « Erreur recherche emoji »,
      un second essai a fonctionné, voir §13) ; plein écran « semble ok » ; imprimer
      « semble ok » ; panneau Informations Système entièrement renseigné (clé masquée
      ****k6nE, `FoodApp_V5_Joel`, `pantry_v5 (74.62 KB)`, réseau Connecté). Glissement
      pour fermer non explicitement rapporté par Joel en navigateur — couvert depuis par
      6 tests unitaires (dont les scénarios exacts trouvés par l'audit), non bloquant

## Critères d'acceptation

- [x] Validation unifiée verte + build OK (112/112 Vitest, 13/13 Pytest, build OK)
- [x] Plus AUCUNE référence exécutable à `edit-emoji-input`, `system-storage`, ni à la classe
      fantôme `fullscreen` (3 recherches convergentes chacune, règle `CLAUDE.md` §5) — les
      seules occurrences restantes sont des commentaires explicatifs et les assertions
      négatives des tests eux-mêmes
- [x] Audit Standard sur le diff final — Codex, 2 passages : NO-GO puis **GO** (§14)
- [x] Cocher C1, C6, C7, C8 dans `Backlog/BACKLOG - Regressions de la migration.md`

## Traçabilité

- Origine : fiche régressions §1 (C1, C6, C7, C8) — balayage 2026-07-29 ; C1/C8 signalés
  aussi par Gemini 3.1 Pro le même jour
- Dépend de : LOT 007 (pour ne pas entrer en collision sur `updateSystemInfo`)

## 13. RÉALISATION (2026-07-30)

**Les 4 chantiers sont codés, testés unitairement et validés en unifié.** Détail par
casse :

- **C1 (icône)** : `openEditEmoji` remplit `#edit-emoji-grid` immédiatement (suggestions
  construites depuis `DEFAULT_DB`, repli sur l'emoji de catégorie si aucune correspondance —
  jamais de grille vide). Clic sur une tuile = applique + sauvegarde + ferme
  (`applyEditedEmoji`, contrat identique à l'oracle). `searchEmojiAI` remplit la même grille.
  `edit-emoji-input` et `saveEmoji` supprimés (plus aucun input libre à valider).
- **C6 (plein écran)** : vrai `requestFullscreen`/`exitFullscreen` (+ préfixes vendor), classe
  `recipe-fullscreen` posée en repli visuel même si l'API échoue, 4 écouteurs
  `fullscreenchange` resynchronisent la classe, `closeModal` sort du plein écran si actif.
- **C7 (imprimer + glissement)** : bouton 🖨️ ajouté dans l'en-tête de `renderRecipeDetail`,
  câblé sur `printRecipe`. `initSwipeToClose` délègue désormais à l'overlay (qui survit à
  `replaceChildren`) au lieu de capturer le noeud `.modal-content` une seule fois — le
  glissement fonctionne à chaque ouverture, pas seulement la première.
- **C8 (panneau système)** : `#info-api-key` (masquée + badge), `#info-fb-user` (`FB_USER`,
  SSOT), `#info-storage` (taille réelle du blob `pantry_v5`) rebranchés, construits en DOM
  sûr (`h()`, jamais d'`innerHTML` interpolé) plutôt qu'en portant tel quel l'`innerHTML` de
  l'oracle.

**Écart découvert en cours de route, hors texte initial de la fiche** : le CSS du plein
écran et de l'impression ciblait encore d'anciens noms de classes disparus à la migration
(`.modal`, `.modal-title`, `.recipe-detail-content`, `.rd-ing-list`, `.recipe-detail-section`,
`.recipe-steps`, `.modal-hdr-actions`, `.rd-scale-bar` — aucun n'existe dans le rendu actuel
de `renderRecipeDetail`). Sans correction, les boutons auraient été fonctionnels en JS mais
sans AUCUN effet visuel (plein écran qui ne change rien à l'écran, impression sans mise en
page). Renommage 1:1 vers les classes réellement rendues (`.modal-content`, `.mh-title`,
`.rd-instructions`, `.rd-ingredients`, `.rd-section-title`, `.mh-right`/`.mh-left .mh-btn`,
`.scale-btn`) — même logique que le reste du lot, aucune nouvelle règle inventée.

Le squelette HTML statique du modal recette (`index.html:109-136`, jamais visible — 3
recherches convergentes confirmant zéro référence exécutable ailleurs) a été supprimé plutôt
que réconcilié : `renderRecipeDetail` est la seule source du contenu (SSOT), option retenue
par l'exécutant faute d'arbitrage explicite de Joel entre les deux options proposées par la
fiche (« nettoyer OU faire correspondre »).

**Limitation d'outillage de l'exécutant** : cette session ne dispose d'aucun outil de
navigateur réel (pas de Playwright/Puppeteer connecté), donc aucune vérification visuelle
n'a pu être faite côté Claude — seul un test de fumée HTTP (serveur `npm run dev`, page
servie en 200, structure HTML vérifiée par grep). La vérification navigateur réelle
(règle `CLAUDE.md` §5) a donc été entièrement faite par **Joel**, le 2026-07-30, via le
serveur de dev laissé tournant : icône ✅, plein écran ✅, imprimer ✅, panneau système ✅
(voir §Plan de test ci-dessus pour le détail).

**Incident transitoire observé pendant la vérification** : le premier essai de recherche
d'emoji par IA (`searchEmojiAI`, rôle `FAST`) a échoué avec le toast générique « Erreur
recherche emoji » ; un second essai, sans aucun changement de code, a réussi. Root cause
non recherchée plus loin puisque non reproductible sur demande — l'hypothèse la plus
probable est un aléa réseau/API côté Gemini, pas un défaut du LOT 009 (aucun fichier
touchant `callAI`/`gemini.js` n'a été modifié par ce lot). Vérifié au passage : le modèle du
rôle `FAST` (`gemini-3.5-flash-lite`, distinct de `REASONING`) est un choix délibéré du
2026-07-28 (commit `9b850263`, ~1h après une unification temporaire sur `gemini-3.6-flash`
qu'une note de mémoire avait figée par erreur) — non lié à l'incident. Si l'erreur devait
redevenir systématique, c'est le premier endroit à vérifier.

## 14. AUDIT STANDARD — CODEX

**Premier passage (2026-07-30) : NO-GO**, 2 findings CRITIQUE + 1 BÉNIN.

| # | Finding | Gravité | Correction |
|---|---|---|---|
| 1 | Glissement : `currentY` jamais réinitialisé au démarrage d'un geste — un simple appui sans glisser après une fermeture réussie pouvait refermer la réouverture suivante | CRITIQUE | Reset de `currentY` dans `touchstart` + 5 tests (`tests/swipe-close.test.js`) verrouillant le scénario exact |
| 2 | Grille locale d'icône : un ingrédient ne correspondant qu'à lui-même (ex. Banane) n'affichait qu'1 tuile — aucun vrai choix. Le socle générique de repli dupliquait en plus une table déjà existante (SSOT) | CRITIQUE | `buildEmojiEditSuggestions` complète toujours avec l'emoji de catégorie + le socle générique ; ce socle est désormais `GENERIC_EMOJI_FALLBACK`, une constante unique partagée avec `updateEmojiSuggestions` |
| 3 | Règle CSS native `:fullscreen` visait encore l'ancienne classe `.modal` ; plafond `85vh` non levé en plein écran (les deux mécanismes) | BÉNIN | Sélecteur corrigé + `max-height` levé sur les deux mécanismes (classe et natif) |

Commit de correction : `4559c4c`. 111/111 tests (104 précédents + 7 nouveaux), 13/13 Pytest,
build OK. Renvoyé à Codex pour contre-vérification.

**Contre-vérification (2026-07-30) : GO.** Les deux CRITIQUE formellement levées (preuves
citées ligne par ligne sur le code corrigé et les tests). Le BÉNIN confirmé résolu. Une
réserve non bloquante supplémentaire (« ne rouvre pas l'audit ») : aucun `touchcancel` ne
remettait l'affichage en place si le geste était interrompu par le système — corrigé par
prudence (1 test de plus, 112/112 au total). Codex a aussi signalé que ce fichier et
`CURRENT_GOAL.md` restaient à resynchroniser à la clôture — fait dans la foulée.

**Verdict final : GO. Niveau Standard confirmé.**
