# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 007 — Synchro collaborative (spec v3) : CODE ÉCRIT le 2026-07-29**, branche
`feat/lot7-synchro-collaborative` (contient tout le travail du 008). Moteur bidirectionnel
complet : envoi temporisé 2 s à chaque modification, drapeau « EN ATTENTE » persisté,
anti-boucle « dernier cloud connu », pulls périodiques 60 s + visibilité + retour réseau,
voyant d'état restauré, panneau `#info-last-sync`/`#info-network` rebranché.
Validation verte (82/82 vitest dont 35 nouveaux, 13/13 pytest, build OK).
**AUDIT DUR PASSÉ le 2026-07-30** : Gemini GO · Codex GO final après 2 cycles de
corrections (drapeau = vraie modification du document, référence persistée et amorcée,
empreinte complète, barrière reset↔moteur). 92/92 vitest · 13/13 pytest · build OK.
Détail : fiche du lot, §12 et §12 bis.
**Reste avant clôture : les tests §6.2 par Joel, à deux appareils, en conditions réelles.**

## État des lots

- **008** Données en sécurité — ✅ TERMINÉ, À PUBLIER (47 tests JS + 13 verrous pytest verts,
  build OK, double audit Dur passé, vérifs navigateur faites par les auditeurs).
  `DEFAULT_DB` reconstruite depuis l'export réel de Joel (297 ingrédients, contre 66 avant).
- **007** Synchro collaborative — **CODE ÉCRIT** (2026-07-29), validation verte ;
  attend audit Dur + tests réels de Joel avant `[A PUBLIER]`
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

Joel a choisi le chemin roadmap : **008 + 007 publiés ensemble en version 5.5**.
1. Audit Dur du LOT 007 (Gemini + Codex, avec sauvegarde/restauration du cloud de
   production — même protocole qu'au LOT 008) ;
2. Tests §6.2 par Joel, à deux appareils, en conditions réelles ;
3. Sur feu vert EXPLICITE de Joel : merge `--no-ff` de la branche dans `main`,
   commit « Version 5.5 - ... ».
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même.
