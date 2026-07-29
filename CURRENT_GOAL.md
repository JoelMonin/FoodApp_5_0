# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 008 — Données en sécurité** (`[EN COURS]`, branche `feat/lot8-donnees-en-securite`).
Préalable bloquant du LOT 007 : verdict unanime du duel d'audit (Gemini 3.1 Pro + Codex 5.6) —
la synchro auto amplifierait les casses d'import/réinitialisation en perte de données
multi-appareils.

## État des lots

- **008** Données en sécurité — 7 chantiers codés, validation unifiée verte (46 tests JS +
  13 verrous pytest), build OK. **Reste : audit Dur + vérifications manuelles navigateur
  (Joel) avant clôture.** `DEFAULT_DB` reconstruite le 2026-07-29 depuis l'export réel de
  Joel (297 ingrédients — l'ancienne base n'en avait que 66).
- **007** Synchro collaborative — spec **v3** prête (double audit v2 intégré, §0 ter), code
  bloqué par 008
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

LOT 008 implémenté le 2026-07-29 sur `feat/lot8-donnees-en-securite` (7 chantiers, 13 tests
dédiés + 46/46 au total, `.\validate.bat` vert, build OK). Reste avant clôture : audit Dur
(Codex/Gemini) sur le diff final, puis vérifications manuelles en navigateur par Joel (liste
dans la fiche du lot). Une fois ces deux étapes faites → LOT 008 clôturé, LOT 007 débloqué.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même.
