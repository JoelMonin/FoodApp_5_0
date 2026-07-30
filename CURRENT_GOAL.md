# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

Aucun — **Version 5.7 publiée le 2026-07-30** (vérification manuelle de Joel + feu vert
explicite). La check-list de campagne (`Backlog/BACKLOG - Regressions de la migration.md`)
est désormais **entièrement close** (§1-§4 cochés, §5 = garde-fou permanent) : c'était le
dernier étage de restauration prévu par la campagne. Prochain chantier à ouvrir :
**LOT 015 — Réglages fiables et cohérents** (s'exécute avant le 013, arbitrages déjà
tranchés).

## Lots tout juste publiés — Version 5.7 (2026-07-30)

- **LOT 011 — Recettes IA riches** : les 7 chantiers faits et testés (cartes de résultats
  complètes, détail de recette riche, prompts/appels IA re-blindés, mode 🎲 complet, confort
  de génération, récupération d'URL propre, favoris riches). Audit de spec en duel (Gemini +
  Codex Terra, NO-GO puis GO), sous-lots moteur et rendu chacun audité et corrigé (4 défauts
  réels, dont une vraie condition de course). Correctif hors-plan : `areSimilar` confondait
  des ingrédients sans rapport par fragment de texte, corrigé en portant l'algorithme
  mot-à-mot de l'oracle (constat de Joel en test réel).
- **LOT 012 — Confort d'usage retrouvé** : les 4 zones faites et testées (sélecteur éditable
  par ligne avec `cycleEmoji`, gestes clavier, barre supérieure contextuelle — sans jamais
  recréer le voyant de synchro du LOT 007 —, styles neufs). Audit de spec ET audit du diff
  final, tous deux Codex Terra GO, avec des corrections réelles à chaque passage. Défaut
  hors-plan trouvé et corrigé : la case à cocher du sélecteur s'affichait toujours cochée
  visuellement (bug du LOT 006, jamais testé jusqu'ici).

Les deux lots ont été chaînés sur une seule branche (`feat/lot12-confort-usage` ouverte
depuis `feat/lot11-recettes-ia-riches`) puis fusionnés ensemble dans `main` en un seul geste,
exactement comme les LOTS 007+008 et 009+010 avant eux. Métriques finales : 357/357 Vitest,
13/13 Pytest, build OK.

**Rappel synchro (LOT 007 en production)** : point de vigilance à l'usage — les tests à deux
appareils du §6.2 ont été levés par décision de Joel ; au moindre comportement étrange, la
fiche LOT 007 (§6.2) sert de grille de diagnostic.

### Critères d'acceptation qui ne se négocient pas (rappel pour les lots suivants)

- **Rejouer objectivement les acquis** d'un lot précédent avant de clore un chantier qui
  touche le même composant partagé.
- **Zéro nom de modèle IA en dur** hors `src/constants.js` (recherche `gemini-`).
- **Aucun `innerHTML`** avec du contenu venant de l'IA — rendu via `h()` uniquement.
- **Préserver le jeton anti-course** `_aiSuggestGenId` (acquis LOT 006).
- **Ne jamais remplacer en bloc un conteneur DOM qui porte un état vivant** (ex. le voyant
  de synchro dans `.mh-icons`) — mise à jour chirurgicale du nœud précis, sinon un état en
  cours (thinking/error) se réinitialise silencieusement (leçon LOT 012, zone C).

## État des lots

- **005 + 006** — ✅ **PUBLIÉS en Version 5.4 le 2026-07-29**
- **007 + 008** — ✅ **PUBLIÉS en Version 5.5 le 2026-07-30**
- **009 + 010** — ✅ **PUBLIÉS en Version 5.6 le 2026-07-30**
- **011 + 012** — ✅ **PUBLIÉS en Version 5.7 le 2026-07-30** — campagne de restauration
  achevée
- **015** Réglages fiables et cohérents — PLANIFIÉ, prochain à ouvrir, s'exécute avant le 013
- **013** Filet de tests UI → **014** Refonte SSOT — PLANIFIÉS, ferment la campagne (refonte)
  (V5.9 — cible ajustée par Joel le 2026-07-30, anciennement V6.0)

## Vérités à ne pas perdre

- **Campagne de restauration achevée** : `Backlog/BACKLOG - Regressions de la migration.md`
  §1-§4 entièrement cochés ou reportés. Les LOTS 013/014/015 qui suivent sont de la
  **refonte** (SSOT, découpage, fiabilité des Réglages), pas de la restauration — l'oracle
  `foodapp-v5-Joel.html` reste la référence de non-régression, mais il n'y a plus de
  comportement connu à rebrancher.
- **Le monolithe `foodapp-v5-Joel.html` est l'oracle comportemental** : on porte, on
  n'invente pas. Lire les lignes citées par chaque fiche AVANT d'écrire — et les
  **vérifier** : chaque lot de la campagne a trouvé des citations périmées ou des éléments
  déjà corrects que la découverte avait ratés (LOT 010 : 10 citations ; LOT 012 : 8
  citations + un élément déjà bon trouvé seulement à l'audit de spec).
- **Ne pas reperdre les acquis des LOTS 005/006** (démarrage instantané, anti-course IA,
  sélecteur intelligent, `applyCloudState`) ni ceux des LOTS 009-012 (🖨️, ⛶, glissement,
  quantités, `_aiSuggestGenId`, `AI_EMOJI_ONLY`, `cycleEmoji`, topbar contextuelle).
- `.picker-magic-btn`, `.emoji-edit-btn`, `.sync-indicator.*`, `.r-tag`, `.tb-btn-add`,
  `.add-results-list`, `.tb-btn.small` : CSS REBRANCHÉ par la campagne — interdiction de les
  traiter en « CSS mort » ou de les supprimer au LOT 014.
- **`areSimilar`** (`src/utils/helpers.js`) compare désormais des mots entiers, jamais des
  fragments de texte (porté depuis l'oracle, LOT 011 hors-plan) — ne pas revenir à une
  comparaison de sous-chaînes brutes en y retouchant plus tard.
- **`buildEmojiEditSuggestions(seed, category)`** (`js/app.js`, LOT 009 étendue au LOT 012) :
  le 2ᵉ paramètre est optionnel, réservé aux appelants hors édition d'ingrédient (ex.
  `cycleEmoji`) — ne jamais dupliquer une table d'emojis à côté.
- **Auditeur par défaut (budget de tokens serré, 2026-07-30)** : Codex 5.6 Terra, niveau
  medium — préféré à `/ultra-audit` et à Codex Sol. Discipline confirmée sur toute la
  campagne : spec ET diff final systématiquement audités avant clôture, même au niveau
  Standard — chaque audit a trouvé au moins une correction réelle.

## Prochaine étape

**Version 5.7 en ligne.** Prochain chantier : **LOT 015 — Réglages fiables et cohérents**
— ouvrir sur signal de Joel (`/new-lot 015 reglages-fiables`), après lecture de la fiche
(arbitrages déjà tranchés le 2026-07-30) et phase découverte obligatoire.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
une confirmation passée ne vaut pas pour la suivante.
