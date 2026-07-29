# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 008 — Données en sécurité : TERMINÉ, `[A PUBLIER]`** (branche
`feat/lot8-donnees-en-securite`). Double audit Dur passé le 2026-07-29 (Gemini GO ;
NO-GO Codex corrigé — reset qui laissait fuir les suggestions IA vers le cloud).
**Le préalable bloquant du LOT 007 est levé** : le prochain lot à coder est le **007
(synchro collaborative, spec v3)**.

## État des lots

- **008** Données en sécurité — ✅ TERMINÉ, À PUBLIER (47 tests JS + 13 verrous pytest verts,
  build OK, double audit Dur passé, vérifs navigateur faites par les auditeurs).
  `DEFAULT_DB` reconstruite depuis l'export réel de Joel (297 ingrédients, contre 66 avant).
- **007** Synchro collaborative — spec **v3** prête (double audit v2 intégré, §0 ter),
  **DÉBLOQUÉ, prochain à coder** (`feat/lot7-synchro-collaborative` existe déjà — la
  rebaser/brancher sur l'état post-008)
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

LOT 008 terminé et audité (2026-07-29). Deux chemins possibles, au choix de Joel :
1. **Publier maintenant** (version 5.5 partielle) : merge `--no-ff` dans `main` sur feu vert
   explicite de Joel — la roadmap visait toutefois une 5.5 commune 008+007 ;
2. **Enchaîner sur le LOT 007** (synchro collaborative, spec v3, débloquée) et publier les
   deux ensemble en 5.5 — chemin recommandé par la roadmap.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même.
