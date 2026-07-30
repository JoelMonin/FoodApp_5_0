# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

Aucun — **LOT 011 ET LOT 012 sont tous deux terminés, validés et au statut `[A PUBLIER]`**
depuis le 2026-07-30. La campagne « Restauration & Refonte » a fermé toute sa check-list
(`Backlog/BACKLOG - Regressions de la migration.md` §1-§4 entièrement cochés ou reportés).
Reste : la vérification manuelle de Joel sur le LOT 012, puis une publication combinée des
deux lots en **version 5.7**, comme les paires précédentes (007+008→5.5, 009+010→5.6).

### LOT 012 — Confort d'usage retrouvé — bilan complet

Fiche : `RoadMap & Project Pipeline/LOT 012 - Confort d usage retrouve [A PUBLIER].md`.
La vingtaine de petits gestes qui faisaient la fluidité de l'app d'origine — ferme la
check-list de campagne avec le LOT 011.

**Les 4 zones, toutes codées et testées :**

| Zone | Contenu | État |
|---|---|---|
| A | Sélecteur d'articles : édition par ligne (nom + emoji via 🎲 `cycleEmoji`), complète le LOT 006 | ✅ |
| B | Clavier et gestes : Entrée sur `#ez-input`/`#paste-title`, scroll filtres mobile, anti-autofill | ✅ |
| D | Styles neufs (pas des pertes) : `.add-results-list`/`.add-res-item`, `.tb-btn.small` | ✅ |
| C | Navigation : barre supérieure contextuelle, retour auto, toasts, `shoppingSource` — zone la plus sensible, proximité DOM avec les voyants de synchro LOT 007 | ✅ |

**Gouvernance complète :**
- [x] Phase découverte (3 explorateurs) : 8 citations périmées corrigées + 3 découvertes
      hors fiche initiale
- [x] Audit de spec (Codex Terra, GO) : 3 précisions intégrées, la plus importante révélant
      que le vrai FAB oracle (`#fab-add`) était déjà restauré — la découverte avait raté cet
      élément, le vrai correctif était de retirer le doublon (`#topbar-add-btn`), pas de lui
      ajouter une bascule
- [x] 4 zones codées, chacune avec ses tests (33 tests neufs + 1 fichier adapté)
- [x] **Défaut hors-plan trouvé et corrigé** (zone A) : la case à cocher du sélecteur
      s'affichait toujours cochée visuellement (bug `checked` + `setAttribute`, LOT 006,
      jamais testé) — corrigé à son unique point d'appel
- [x] Audit du diff final (Codex Terra, GO) : 1 précision intégrée (retour auto à
      l'inventaire manquant sur l'ajout par autocomplétion, `addIngredientFromDb`)
- [x] Validation unifiée verte : 357/357 Vitest, 13/13 Pytest, build OK
- [ ] Vérification manuelle de Joel (mobile ET bureau) — seul point restant avant clôture

### LOT 011 — Recettes IA riches — bilan complet

Fiche : `RoadMap & Project Pipeline/LOT 011 - Recettes IA riches [A PUBLIER].md`.
Le plus gros lot de restauration de la campagne — rend à la partie « recettes IA » la
richesse qu'elle avait dans l'app d'origine, celle que Joel utilise pour cuisiner.

**Les 7 chantiers, tous codés et testés :**

| # | Chantier | État |
|---|---|---|
| 1 | Cartes de résultats IA complètes | ✅ |
| 2 | Détail de recette complet (4 acquis 009/010 vérifiés, dont 🖨️/⛶ en navigateur par Joel) | ✅ |
| 3 | Prompts et appels IA re-blindés | ✅ |
| 4 | Mode 🎲 « recette aléatoire » complet | ✅ |
| 5 | Confort de génération | ✅ |
| 6 | Récupération d'URL propre (Jina Reader) | ✅ |
| 7 | Favoris riches (+ restauration « Sauvegarder tel quel », arbitrage A1) | ✅ |

**Gouvernance complète :**
- [x] Phase découverte (3 explorateurs) puis audit de spec en duel (Gemini + Codex Terra,
      NO-GO, 8 points intégrés, 6 arbitrages de Joel)
- [x] Sous-lot 11A (moteur) : codé, audité (Codex Terra, NO-GO puis GO), 2 défauts réels
      corrigés (paramètre IA obsolète ; générations concurrentes pouvant corrompre les
      réglages sauvegardés de Joel)
- [x] Sous-lot 11B (rendu) : codé, audité (Codex Terra + Gemini en parallèle, NO-GO puis
      GO), 2 défauts réels corrigés (bouton « Sauvegarder tel quel » resté inatteignable
      malgré l'arbitrage A1 ; recette IA tronquée pouvant s'afficher vide)
- [x] **Correctif hors-plan** trouvé par Joel en test réel : `areSimilar` confondait des
      ingrédients sans rapport par fragment de texte (« Eau »≈« Agneau », « Oeuf »≈« Bœuf »)
      — corrigé en portant l'algorithme mot-à-mot de l'oracle. Point adjacent identifié
      (« Ail »/« Ail en poudre », un vrai défaut, pas un choix voulu comme dit à tort au
      premier passage) : **laissé tel quel sur décision de Joel**, à revisiter si ça gêne
      à l'usage
- [x] Vérification manuelle de Joel en navigateur (imprimer, plein écran, parcours complet)
- [x] Validation unifiée verte : 324/324 Vitest, 13/13 Pytest, build OK

### Critères d'acceptation qui ne se négocient pas (rappel pour les lots suivants)

- **Rejouer objectivement les acquis** d'un lot précédent avant de clore un chantier qui
  touche le même composant partagé.
- **Zéro nom de modèle IA en dur** hors `src/constants.js` (recherche `gemini-`).
- **Aucun `innerHTML`** avec du contenu venant de l'IA — rendu via `h()` uniquement.
- **Préserver le jeton anti-course** `_aiSuggestGenId` (acquis LOT 006).
- **Ne jamais remplacer en bloc un conteneur DOM qui porte un état vivant** (ex. le voyant
  de synchro dans `.mh-icons`) — mise à jour chirurgicale du nœud précis, sinon un état en
  cours (thinking/error) se réinitialise silencieusement (leçon LOT 012, zone C).

## Lots précédents — Version 5.6 (2026-07-30, en ligne)

- **LOT 010 — Règles métier retrouvées** : cuisine transmise à l'IA (SSOT `cuisines`),
  plafond 6 épinglés, zone imposée complète, inventaire trié, quantités recalculées
  (fractions gérées), menu de modèles remplacé par une info en lecture seule. Plus un
  correctif hors-plan : le prompt IA avait perdu ses indications de format (unités/emoji).
- **LOT 009 — Boutons morts rebranchés** : icône d'ingrédient, plein écran recette, imprimer
  + fermeture par glissement, panneau Informations Système.

**Rappel synchro (LOT 007 en production)** : point de vigilance à l'usage — les tests à deux
appareils du §6.2 ont été levés par décision de Joel ; au moindre comportement étrange, la
fiche LOT 007 (§6.2) sert de grille de diagnostic.

## État des lots

- **007 + 008** — ✅ **PUBLIÉS en Version 5.5 le 2026-07-30**
- **009 + 010** — ✅ **PUBLIÉS en Version 5.6 le 2026-07-30**
- **011** Recettes IA riches — 🟡 **A PUBLIER** depuis le 2026-07-30, attend le 012
- **012** Confort d'usage retrouvé — 🟡 **A PUBLIER** depuis le 2026-07-30, attend la
  vérification manuelle de Joel ; ferme la check-list de campagne, se publiera avec le 011
  en 5.7
- **013** Filet de tests UI → **014** Refonte SSOT — PLANIFIÉS, ferment la campagne
  (V5.9 — cible ajustée par Joel le 2026-07-30, anciennement V6.0)
- **015** Réglages fiables et cohérents — PLANIFIÉ, s'exécute avant le 013
- **005 + 006** — ✅ **PUBLIÉS en Version 5.4 le 2026-07-29**

## Vérités à ne pas perdre

- **Check-list de campagne close** : `Backlog/BACKLOG - Regressions de la migration.md` —
  tout le §1-§4 est désormais coché ou explicitement reporté (§5, garde-fou permanent). Le
  LOT 012 a fermé le dernier morceau (§3 restant + topbar contextuelle du §4).
- **Le monolithe `foodapp-v5-Joel.html` est l'oracle comportemental** : on porte, on
  n'invente pas. Lire les lignes citées par chaque fiche AVANT d'écrire — et les **vérifier** :
  au LOT 010, 10 citations périmées ; au LOT 011, un arbitrage « voulu vs défaut » sur
  `areSimilar` ; au LOT 012, 8 citations périmées + une phase découverte qui avait raté un
  élément déjà correct (`#fab-add`), trouvé seulement par l'audit de spec qui a suivi.
- **Ne pas reperdre les acquis des LOTS 005/006** (démarrage instantané, anti-course IA,
  sélecteur intelligent, `applyCloudState`) ni ceux des LOTS 009/010/011/012 (🖨️, ⛶,
  glissement, quantités, `_aiSuggestGenId`, `AI_EMOJI_ONLY`, `cycleEmoji`, topbar
  contextuelle).
- `.picker-magic-btn`, `.emoji-edit-btn`, `.sync-indicator.*` : CSS dormant REBRANCHÉ par la
  campagne — ne plus jamais les traiter en « CSS mort ». `.r-tag` (LOT 011), `.tb-btn-add`/
  `.add-results-list`/`.tb-btn.small` (LOT 012) : interdiction de les supprimer au LOT 014.
- **`areSimilar`** (`src/utils/helpers.js`) compare désormais des mots entiers, jamais des
  fragments de texte (porté depuis l'oracle, LOT 011 hors-plan) — ne pas revenir à une
  comparaison de sous-chaînes brutes en y retouchant plus tard.
- **`buildEmojiEditSuggestions(seed, category)`** (`js/app.js`, LOT 009 étendue au LOT 012) :
  le 2ᵉ paramètre est optionnel, réservé aux appelants hors édition d'ingrédient (ex.
  `cycleEmoji`) — ne jamais dupliquer une table d'emojis à côté.
- **Auditeur par défaut (budget de tokens serré, 2026-07-30)** : Codex 5.6 Terra, niveau
  medium — préféré à `/ultra-audit` et à Codex Sol. Discipline confirmée sur tout le LOT 012 :
  spec ET diff final systématiquement audités avant clôture, même au niveau Standard.

## Prochaine étape

**Aucun lot en cours.** En attente de :
1. La vérification manuelle de Joel sur le LOT 012 (mobile ET bureau — voir le Plan de
   test de la fiche).
2. Son feu vert explicite pour la publication combinée LOT 011 + LOT 012 en **version 5.7**.

Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
une confirmation passée ne vaut pas pour la suivante.

Après publication : prochain lot d'exécution de la campagne = **LOT 015 — Réglages fiables
et cohérents** (s'exécute avant le 013, arbitrages déjà tranchés), sur signal de Joel.
