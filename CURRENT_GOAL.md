# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

Aucun — **Version 5.6 publiée le 2026-07-30** (feu vert de Joel). Prochain chantier à ouvrir :
**LOT 011 — Recettes IA riches**.

## Lots tout juste publiés — Version 5.6 (2026-07-30)

- **LOT 010 — Règles métier retrouvées** : les 6 chantiers faits, audités (Codex spec + audit
  interne + Gemini + Codex Terra, tous GO), 218/218 tests. Cuisine transmise à l'IA (SSOT
  `cuisines`), plafond 6 épinglés restauré, zone imposée complète + sous-titre vivant,
  inventaire trié, quantités recalculées (fractions gérées, corrige un bug de l'oracle),
  menu de modèles remplacé par une info en lecture seule. Correctif hors-plan inclus : le
  prompt IA avait perdu ses indications de format (unités/emoji), corrigé et vérifié par
  Joel en navigateur.
- **LOT 009 — Boutons morts rebranchés** : icône d'ingrédient, plein écran recette, imprimer
  + swipe-to-close, panneau Informations Système. Audit Standard Codex GO, vérifié au
  navigateur par Joel.

Les deux lots ont été chaînés sur une seule branche (`feat/lot10-regles-metier` ouverte
depuis `feat/lot9-boutons-morts`) puis fusionnés ensemble dans `main` en un seul geste,
exactement comme les LOTS 007+008 pour la version 5.5.

**Rappel synchro (LOT 007 en production)** : point de vigilance à l'usage — les
tests à deux appareils du §6.2 ont été levés par décision de Joel ; au moindre
comportement étrange, la fiche LOT 007 (§6.2) sert de grille de diagnostic.

## État des lots

- **007 + 008** — ✅ **PUBLIÉS en Version 5.5 le 2026-07-30**
- **009 + 010** — ✅ **PUBLIÉS en Version 5.6 le 2026-07-30**
- **011 → 012** Restaurations (IA riche, confort) — PLANIFIÉS, fiches détaillées prêtes
- **013** Filet de tests UI → **014** Refonte SSOT — PLANIFIÉS, ferment la campagne (V6.0)
- **015** Réglages fiables et cohérents — PLANIFIÉ, s'exécute avant le 013
- **005 + 006** — ✅ **PUBLIÉS en Version 5.4 le 2026-07-29**

## Vérités à ne pas perdre

- **Check-list de campagne** : `Backlog/BACKLOG - Regressions de la migration.md` — chaque
  lot y coche ses points ; fin du LOT 012 = tout coché ou explicitement reporté.
- **Le monolithe `foodapp-v5-Joel.html` est l'oracle comportemental** : on porte, on
  n'invente pas. Lire les lignes citées par chaque fiche AVANT d'écrire.
- **Ne pas reperdre les acquis des LOTS 005/006** (démarrage instantané, anti-course IA,
  sélecteur intelligent, `applyCloudState`).
- `.r-tag`, `.picker-magic-btn`, `.emoji-edit-btn`, `.sync-indicator.*` : CSS dormant que la
  campagne REBRANCHE — ne plus jamais les traiter en « CSS mort ».
- **Auditeur par défaut (budget de tokens serré, 2026-07-30)** : Codex 5.6 Terra, niveau
  medium — préféré à `/ultra-audit` et à Codex Sol, retenu après comparaison avec Gemini
  (Terra a trouvé un défaut réel que Gemini avait manqué sur le chantier 3 du LOT 010).

## Prochaine étape

**Version 5.6 en ligne.** Prochain chantier de la campagne : **LOT 011 — Recettes IA
riches** — ouvrir sur signal de Joel (`/new-lot 011 recettes-ia-riches`), après lecture
de la fiche et phase découverte obligatoire.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
une confirmation passée ne vaut pas pour la suivante.
