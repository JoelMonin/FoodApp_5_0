# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**Aucun — les LOTS 007 et 008 sont TERMINÉS, `[A PUBLIER]`** sur
`feat/lot7-synchro-collaborative` (la branche contient les deux lots).
- **007 Synchro collaborative** : moteur bidirectionnel complet (envoi temporisé 2 s,
  drapeau persisté, anti-boucle « dernier cloud connu » amorcée et persistée, pulls
  périodiques, barrière reset↔moteur, voyant + panneau système). Audit Dur passé le
  2026-07-30 : Gemini GO · Codex GO final après 2 cycles de corrections. 92/92 vitest ·
  13/13 pytest · build OK. **Tests réels à deux appareils LEVÉS par décision de Joel**
  (constat à l'usage, la fiche §6.2 sert de grille de diagnostic en cas de souci).
- **008 Données en sécurité** : double audit passé le 2026-07-29 (détail : fiche 008).

## État des lots

- **008** Données en sécurité — ✅ TERMINÉ, À PUBLIER (47 tests JS + 13 verrous pytest verts,
  build OK, double audit Dur passé, vérifs navigateur faites par les auditeurs).
  `DEFAULT_DB` reconstruite depuis l'export réel de Joel (297 ingrédients, contre 66 avant).
- **007** Synchro collaborative — ✅ TERMINÉ, À PUBLIER (audit Dur double GO le
  2026-07-30 ; tests réels levés par Joel, constat à l'usage)
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

**Publication de la version 5.5 (008 + 007 ensemble)** — tout est prêt, il ne manque
que le feu vert EXPLICITE de Joel, donné au moment même : alors, propagation de la
version (`APP_VERSION` 5.5.0 + `sync_version.py`), merge `--no-ff` de
`feat/lot7-synchro-collaborative` dans `main`, commit « Version 5.5 - ... », push.
Ce qui changera sur la page en ligne : synchro automatique bidirectionnelle (LOT 007)
+ import/export/reset sécurisés et catalogue 297 ingrédients (LOT 008).
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même.
Ensuite : LOT 009 (boutons morts rebranchés), fiche prête.
