# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 011 — Recettes IA riches** — ouvert le **2026-07-30**.
Branche : `feat/lot11-recettes-ia-riches` (partie de `main` en 5.6).
Fiche : `RoadMap & Project Pipeline/LOT 011 - Recettes IA riches [EN COURS].md`.
**Niveau d'audit : DUR** — touche `src/services/gemini.js`, zone sensible
(`DOCTRINE_PRODUIT.md` §3). Version visée : **5.7** (avec le LOT 012).

C'est le plus gros lot de restauration de la campagne : il rend à la partie « recettes IA »
la richesse qu'elle avait dans l'app d'origine — c'est la partie que Joel utilise pour
cuisiner.

### Suivi des 7 chantiers

| # | Chantier | État |
|---|---|---|
| 1 | Cartes de résultats IA complètes (méta, pitch, tags stock colorés, boutons directs) | ⬜ à faire (11B) |
| 2 | Détail de recette complet (pastilles, états stocks, Nutri-Score, étapes cochables, favori texte brut) | ⬜ à faire (11B) |
| 3 | Prompts et appels IA re-blindés (+ effort IA adapté par tâche, demande Joel du 2026-07-30) | ✅ codé (11A) |
| 4 | Mode 🎲 « recette aléatoire » complet | ✅ codé (11A) |
| 5 | Confort de génération (textes animés, scroll mobile, verrouillage du collage, champs vidés) | ⬜ à faire (11B) |
| 6 | Récupération d'URL propre (Jina Reader + titre auto) | ✅ codé (11A) |
| 7 | Favoris riches (vignette, tags, boutons, date de sauvegarde) | ⬜ à faire (11B) |

**Étapes de gouvernance :**
- [x] Fiche lue, branche créée
- [x] Phase découverte (3 explorateurs : ancrages oracle, chaîne IA, rendu/favoris)
- [x] Audit de spec AVANT code — duel Gemini + Codex Terra, tous deux NO-GO, 8 points
      intégrés après contre-vérification, 2 défauts trouvés en plus (créativité inopérante,
      conflit prompt/tests), 6 arbitrages tranchés par Joel
- [x] **Sous-lot 11A (moteur : chantiers 3, 4, 6) codé et validé** — 251/251 Vitest,
      13/13 Pytest, build OK
- [ ] Audit du sous-lot 11A
- [ ] Sous-lot 11B (rendu : chantiers 1, 2, 5, 7) — c'est là que les 4 acquis 009/010
      doivent être rejoués
- [ ] Validation unifiée finale + build OK
- [ ] Feu vert explicite de Joel pour la publication

### Critères d'acceptation qui ne se négocient pas

- **Rejouer objectivement les acquis 009/010** après la réécriture de l'écran de recette :
  bouton 🖨️, plein écran + sortie par Échap, fermeture par glissement, recalcul des
  quantités −/+ avec aller-retour exact. Ce sont des critères, pas des rappels.
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
- **011** Recettes IA riches — 🔵 **EN COURS** depuis le 2026-07-30
- **012** Confort d'usage retrouvé — PLANIFIÉ, ferme la check-list de campagne avec le 011
- **013** Filet de tests UI → **014** Refonte SSOT — PLANIFIÉS, ferment la campagne (V6.0)
- **015** Réglages fiables et cohérents — PLANIFIÉ, s'exécute avant le 013
- **005 + 006** — ✅ **PUBLIÉS en Version 5.4 le 2026-07-29**

## Vérités à ne pas perdre

- **Check-list de campagne** : `Backlog/BACKLOG - Regressions de la migration.md` — le LOT 011
  doit y cocher **tout le §4 sauf la topbar** (cartes, détail, prompts, favoris, URL) et le
  confort de génération du §3.
- **Le monolithe `foodapp-v5-Joel.html` est l'oracle comportemental** : on porte, on
  n'invente pas. Lire les lignes citées par chaque fiche AVANT d'écrire — et les **vérifier** :
  au LOT 010, 10 citations de lignes sur la fiche étaient périmées.
- **Ne pas reperdre les acquis des LOTS 005/006** (démarrage instantané, anti-course IA,
  sélecteur intelligent, `applyCloudState`).
- `.r-tag`, `.picker-magic-btn`, `.emoji-edit-btn`, `.sync-indicator.*` : CSS dormant que la
  campagne REBRANCHE — ne plus jamais les traiter en « CSS mort ». **Le LOT 011 réactive
  `.r-tag` : interdiction de le supprimer au LOT 014.**
- **Auditeur par défaut (budget de tokens serré, 2026-07-30)** : Codex 5.6 Terra, niveau
  medium — préféré à `/ultra-audit` et à Codex Sol, retenu après comparaison avec Gemini
  (Terra a trouvé un défaut réel que Gemini avait manqué sur le chantier 3 du LOT 010).

## Prochaine étape

Terminer la **phase découverte** du LOT 011, en tirer un plan d'attaque qui réutilise
explicitement les ressources existantes (`matchIngredientToStock`, `h()`, `AI_ROLES`,
`CATEGORIES`, styles `.r-tag`), puis le faire auditer AVANT d'écrire du code.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
une confirmation passée ne vaut pas pour la suivante.
