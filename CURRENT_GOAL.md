# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 010 — Règles métier retrouvées** (démarré le 2026-07-30, signal de Joel « on démarre
le lot 10 »). Branche `feat/lot10-regles-metier`, ouverte **depuis `feat/lot9-boutons-morts`**
(et non depuis `main`) : le LOT 009 n'est pas encore publié et les deux lots visent la même
**version 5.6** — les chaîner évite un conflit de fusion et permet de publier la 5.6 d'un bloc.
Niveau d'audit : **Standard**, avec relecture ciblée du chantier 1 (il touche le prompt IA).

| Chantier | Casse | Statut |
|---|---|---|
| 1. Filtre « Type de cuisine » réellement transmis à l'IA | C5 | ⬜ À faire |
| 2. Plafond « max 6 épinglés » + libellé UI corrigé | C9 | ⬜ À faire |
| 3. Zone « Ingrédients imposés » complète + sous-titre vivant | C10 | ⬜ À faire |
| 4. Tri alphabétique de l'inventaire | C11 | ⬜ À faire |
| 5. Quantités recalculées selon le nombre de personnes | C12 | ⬜ À faire |
| 6. Menu « Moteur Tâches Complexes » supprimé (arbitrage tranché) | — | ⬜ À faire |

**Phase découverte faite le 2026-07-30** (étape bloquante, avant toute ligne de code) :
24 ressources réutilisables recensées, 6 groupes de manques, et **10 citations de lignes
périmées corrigées dans la fiche**. Détail : fiche LOT 010 §7.

## Lot précédent — en attente de publication

**LOT 009 — Boutons morts rebranchés** : ✅ terminé, audit Standard Codex GO, vérifié au
navigateur par Joel, 112/112 tests. Statut `[A PUBLIER]` sur `feat/lot9-boutons-morts`.
**Publication reportée par choix explicite de Joel le 2026-07-30** (« ok pour commit, mais
pas pour déjà publier en 5.6 »). **Aucun merge vers `main` tant qu'il ne redonne pas le feu
vert au moment même** (VERROU PRODUCTION — une confirmation passée ne vaut pas pour la
suivante). Le LOT 010 s'empile dessus : les deux partiront ensemble en 5.6.

**Rappel synchro (LOT 007 en production)** : point de vigilance à l'usage — les
tests à deux appareils du §6.2 ont été levés par décision de Joel ; au moindre
comportement étrange, la fiche LOT 007 (§6.2) sert de grille de diagnostic.

## État des lots

- **008** Données en sécurité — ✅ **PUBLIÉ en Version 5.5 le 2026-07-30**.
  `DEFAULT_DB` reconstruite depuis l'export réel de Joel (297 ingrédients, contre 66 avant).
- **007** Synchro collaborative — ✅ **PUBLIÉ en Version 5.5 le 2026-07-30** (audit Dur
  double GO ; tests réels levés par Joel, constat à l'usage)
- **009** Boutons morts rebranchés — ✅ terminé, `[A PUBLIER]` (publication reportée par Joel)
- **010** Règles métier retrouvées — 🔵 **EN COURS**
- **011 → 012** Restaurations (IA riche, confort) — PLANIFIÉS, fiches détaillées prêtes
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

Version 5.5 en ligne. **En cours : LOT 010 — Règles métier retrouvées** (6 chantiers
ci-dessus), empilé sur le LOT 009 non publié. Ensuite : LOT 011 — Recettes IA riches.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
et deux lots attendent désormais ce feu vert (009 + 010 = version 5.6).
