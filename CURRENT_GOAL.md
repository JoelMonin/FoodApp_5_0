# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 009 — Boutons morts rebranchés** (démarré le 2026-07-30, signal de Joel « on
attaque le lot 09 »). Branche `feat/lot9-boutons-morts` ouverte depuis `main`
(Version 5.5 en production). Niveau d'audit : Standard.

| Chantier | Casse | Statut |
|---|---|---|
| 1. Icône d'ingrédient (emoji picker) | C1 | ✅ Codé + testé |
| 2. Plein écran recette | C6 | ✅ Codé + testé |
| 3. Bouton imprimer + swipe-to-close | C7 | ✅ Codé + testé |
| 4. Panneau Informations Système (3 champs restants) | C8 | ✅ Codé + testé |

**Prêt à publier, publication reportée par choix de Joel (2026-07-30)** : audit Standard
Codex GO (2 passages : NO-GO puis GO après correction de 2 CRITIQUE + durcissement) et
vérification navigateur de Joel faites. 112/112 tests, 13/13 Pytest, build OK. Joel a
confirmé les commits mais a explicitement dit « pas pour déjà publier en 5.6 » — le lot
reste sur `feat/lot9-boutons-morts` (statut `[A PUBLIER]`), **aucun merge vers `main` tant
qu'il ne redonne pas le feu vert au moment même** (VERROU PRODUCTION — une confirmation
passée ne vaut pas pour la suivante). Détail complet : fiche LOT 009 §13-§14.

**Rappel synchro (LOT 007 en production)** : point de vigilance à l'usage — les
tests à deux appareils du §6.2 ont été levés par décision de Joel ; au moindre
comportement étrange, la fiche LOT 007 (§6.2) sert de grille de diagnostic.

## État des lots

- **008** Données en sécurité — ✅ **PUBLIÉ en Version 5.5 le 2026-07-30**.
  `DEFAULT_DB` reconstruite depuis l'export réel de Joel (297 ingrédients, contre 66 avant).
- **007** Synchro collaborative — ✅ **PUBLIÉ en Version 5.5 le 2026-07-30** (audit Dur
  double GO ; tests réels levés par Joel, constat à l'usage)
- **009 → 012** Restaurations (boutons, règles métier, IA riche, confort) — PLANIFIÉS,
  fiches détaillées prêtes à confier à un exécutant
- **013** Filet de tests UI → **014** Refonte SSOT — PLANIFIÉS, ferment la campagne (V6.0)
- **005 + 006** — ✅ **PUBLIÉS en Version 5.4 le 2026-07-29** (feu vert de Joel) — la
  campagne part d'une base en ligne saine

## Vérités à ne pas perdre

- **Check-list de campagne** : `Backlog/BACKLOG - Regressions de la migration.md` — chaque
  lot y coche ses points ; fin du LOT 012 = tout coché ou explicitement reporté.
- **Le monolithe `foodapp-v5-Joel.html` est l'oracle comportemental** : on porte, on
  n'invente pas. Lire les lignes citées par chaque fiche AVANT d'écrire.
- **Ne pas reperdre les acquis des LOTS 005/006** (démarrage instantané, anti-course IA,
  sélecteur intelligent, `applyCloudState`).
- `.r-tag`, `.picker-magic-btn`, `.emoji-edit-btn`, `.sync-indicator.*` : CSS dormant que la
  campagne REBRANCHE — ne plus jamais les traiter en « CSS mort ».
- Arbitrage « Moteur Tâches Complexes » TRANCHÉ (2026-07-29) : menu supprimé, remplacé par
  une information en lecture seule dérivée de `AI_ROLES` (LOT 010 §6).

## Prochaine étape

Version 5.5 en ligne. **Prochain chantier : LOT 009 — Boutons morts rebranchés**
(icône d'ingrédient C1, plein écran C6, imprimer C7, panneau système C8 restant) —
ouvrir `feat/lot9-boutons-morts` sur signal de Joel (« on attaque le lot 9 »).
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même.
