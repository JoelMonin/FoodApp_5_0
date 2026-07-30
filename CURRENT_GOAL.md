# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 012 — Confort d'usage retrouvé**, statut `[EN COURS]` depuis le 2026-07-30 — branche
`feat/lot12-confort-usage`, chaînée depuis `feat/lot11-recettes-ia-riches` (comme 010 depuis
009). Phase découverte faite (3 agents Explore en parallèle) : 8 citations périmées
corrigées dans la fiche + 3 découvertes hors fiche initiale (le ＋ flottant doit redevenir
masqué hors inventaire ; risque de collision cartographié entre la topbar mobile et le
voyant de synchro du LOT 007 ; deux fonctions mortes en doublon repérées et non touchées).
Ferme la check-list de campagne avec le LOT 011 ; publication combinée en **version 5.7**
sur feu vert explicite de Joel (comme 007+008→5.5, 009+010→5.6).

### LOT 012 — périmètre (fiche : `LOT 012 - Confort d usage retrouve [EN COURS].md`)

| Zone | Contenu |
|---|---|
| A | Sélecteur d'articles : édition par ligne (nom + emoji via 🎲 `cycleEmoji`), complète le LOT 006 |
| B | Clavier et gestes : Entrée sur `#ez-input`/`#paste-title`, scroll filtres mobile, anti-autofill |
| C | Navigation : barre supérieure contextuelle, ＋ flottant pantry-only, retour auto, toasts, `shoppingSource` — **zone la plus sensible du lot**, proximité DOM avec les voyants de synchro LOT 007 |
| D | Styles neufs (pas des pertes) : `.add-results-list`/`.add-res-item`, `.tb-btn.small` |

### LOT 011 — Recettes IA riches — bilan complet (terminé, `[A PUBLIER]`, attend le LOT 012)

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
- **012** Confort d'usage retrouvé — 🟢 **EN COURS** depuis le 2026-07-30, ferme la
  check-list de campagne avec le 011, se publiera avec lui en 5.7
- **013** Filet de tests UI → **014** Refonte SSOT — PLANIFIÉS, ferment la campagne
  (V5.9 — cible ajustée par Joel le 2026-07-30, anciennement V6.0)
- **015** Réglages fiables et cohérents — PLANIFIÉ, s'exécute avant le 013
- **005 + 006** — ✅ **PUBLIÉS en Version 5.4 le 2026-07-29**

## Vérités à ne pas perdre

- **Check-list de campagne** : `Backlog/BACKLOG - Regressions de la migration.md` — le
  LOT 011 y a coché **tout le §4 sauf la topbar** (cartes, détail, prompts, favoris, URL)
  et le confort de génération du §3. Reste au LOT 012 : §3 restant + topbar (§4).
- **Le monolithe `foodapp-v5-Joel.html` est l'oracle comportemental** : on porte, on
  n'invente pas. Lire les lignes citées par chaque fiche AVANT d'écrire — et les **vérifier** :
  au LOT 010, 10 citations de lignes sur la fiche étaient périmées ; au LOT 011, une
  vérification a aussi tranché « voulu vs défaut » sur `areSimilar` (Ail/Ail en poudre).
- **Ne pas reperdre les acquis des LOTS 005/006** (démarrage instantané, anti-course IA,
  sélecteur intelligent, `applyCloudState`) ni ceux des LOTS 009/010/011 (🖨️, ⛶, glissement,
  quantités, `_aiSuggestGenId`, `AI_EMOJI_ONLY`).
- `.picker-magic-btn`, `.emoji-edit-btn`, `.sync-indicator.*` : CSS dormant que la
  campagne REBRANCHE — ne plus jamais les traiter en « CSS mort ». `.r-tag` déjà réactivé
  par le LOT 011 : interdiction de le supprimer au LOT 014.
- **`areSimilar`** (`src/utils/helpers.js`) compare désormais des mots entiers, jamais des
  fragments de texte (porté depuis l'oracle, LOT 011 hors-plan) — ne pas revenir à une
  comparaison de sous-chaînes brutes en y retouchant plus tard.
- **Auditeur par défaut (budget de tokens serré, 2026-07-30)** : Codex 5.6 Terra, niveau
  medium — préféré à `/ultra-audit` et à Codex Sol, retenu après comparaison avec Gemini.
  Le LOT 011 a aussi utilisé Gemini en parallèle sur l'audit du sous-lot 11B (les deux ont
  convergé sur le même défaut critique, sans se voir).

## Prochaine étape

Coder les 4 zones du LOT 012 (A sélecteur, B clavier, C navigation, D styles) — ordre de
risque croissant, C en dernier car c'est la seule zone à proximité des voyants de synchro
LOT 007. Audit standard en fin de lot, ciblé sur ce risque de collision. À sa clôture :
publication combinée 011+012 en version 5.7.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
une confirmation passée ne vaut pas pour la suivante.
