# LOT 026 — Prompts de génération `[EN COURS]`

**Ouvert le 2026-08-02** · Branche `feat/lot26-prompts-generation` (**chaînée sur
`feat/lot25-amelioration-ia`**, même procédé que les LOTS 016/017/018) · Niveau d'audit :
**Standard** (audit du diff final à la clôture, comme le 025).

---

## 1. D'OÙ ÇA VIENT

Dans la foulée du LOT 025, Joel a demandé un **audit complet des prompts de génération de
recettes** (le message assemblé par `generateRecipes`, le modulateur de créativité, le mode
🎲). L'audit a rendu 6 constats ; Joel a tranché chacun le 2026-08-02 :

| # | Constat de l'audit | Décision de Joel |
|---|---|---|
| 1 | L'IA doit DEVINER les catégories : le squelette exige `"c":"[CATÉGORIE]"` sans jamais donner la liste (`CATEGORIES` n'est injectée que dans le prompt de la recette collée) | ✅ **À corriger** |
| 2 | Le bouton 🎲 est en partie du théâtre : son tirage 80-100 produit LA MÊME phrase que le curseur à fond (tout > 66 = « créatif »), seuls les filtres vidés le distinguent | 🗑️ **SUPPRIMER le bouton** (confirmé par question fermée — il ne s'agissait pas d'abandonner la piste, mais bien de retirer la fonctionnalité) |
| 3 | Aucune mémoire anti-répétition : trois générations d'affilée ressortent les mêmes classiques | ✅ **OK, mais SEULEMENT en série** : fenêtre glissante d'environ **60 minutes**, pas de mémoire permanente |
| 4 | La phrase « Sois TRÈS CRÉATIF » est faible, les modèles récents sont prudents | ❌ **NON** — « je n'ai pas envie de disqualifier les associations classiques ». Ne pas toucher aux 3 phrases de créativité |
| 5 | Les deux prompts n'exigent pas la même qualité d'étapes (repère sensoriel demandé d'un côté seulement) | ✅ **« La meilleure qualité tout le temps »** : un niveau suffisant d'information et de consignes pour réaliser la recette parfaitement |
| 6 | Les règles communes (guillemets/apostrophes, emoji, quantités) sont RECOPIÉES dans les deux prompts — P2 a dû être appliqué deux fois | ✅ **OK** — SSOT des consignes partagées |

## 2. PHASE DÉCOUVERTE

**Réutilise la découverte du LOT 025 (2026-08-02, agent Explore, fiche 025 §3)** — décision
motivée, pas une paresse : la zone est IDENTIQUE (les prompts de `src/services/gemini.js`,
leurs appelants, leurs tests), elle a été cartographiée le jour même, et re-vérifiée sur pièce
dans cette session (lectures directes de `gemini.js`, `aiPanel.js`, `helpers.js`,
`gemini.test.js`). Points clés re-confirmés :
- 2 prompts complets (`generateRecipes:188`, `transformRecipeFromText`) + 1 fragment factorisé
  (`creativityInstruction:141`, appuyé sur la SSOT `creativityLevel`, `helpers.js:224`).
- Les formulations de `generateRecipes` sont FIGÉES par `tests/gemini.test.js` (LOT 010) ;
  celles de `transformRecipeFromText` ne le sont pas → **en cas d'unification, c'est la
  formulation de `generateRecipes` qui survit**, l'autre s'aligne.
- Le 🎲 : recensé par 3 recherches convergentes (appel direct, accès dynamique, CSS/annexes) —
  `index.html:469`, `aiPanel.js:331-369` + 3 commentaires, `js/app.js` (import + republication
  + `expose()`), `tests/ai-random-mode.test.js` (fichier entier), `creativity-slider-ui.test.js`
  (2 mentions en exemple), `css/sections/12-utilities.css:403-418` (`.magic-btn`),
  `PROJECT_MAP.md` (2 lignes). ⚠️ **FAUX AMI : `.picker-magic-btn`** (dé du sélecteur de
  courses, `cartPicker.js:117`) est une AUTRE fonctionnalité, sur la liste des classes
  protégées de la campagne — INTERDIT d'y toucher.

## 3. LES 5 CHANTIERS

### A — La liste des catégories entre dans le prompt de génération
`CATEGORIES` (SSOT, `src/constants.js`) injectée dans les règles de données de
`generateRecipes`, comme elle l'est déjà dans le prompt de la recette collée. Sans elle, l'IA
invente des noms de rayon que `sanitizeCategory` rattrape ou relègue en « Autres » — articles
mal rangés dans la liste de courses.

### B — Suppression du bouton 🎲 (décision produit de Joel)
Retrait de TOUS les sites recensés au §2. La restauration du LOT 011 (chantier 4) est donc
volontairement défaite sur décision produit — tracée ici, pas une régression silencieuse.
⚠️ À préserver : le test « une valeur intermédiaire héritée (ex. 87) affiche le cran le plus
proche » de `creativity-slider-ui.test.js` — le COMPORTEMENT reste nécessaire (anciennes
sauvegardes) ; seule la mention du 🎲 comme exemple change.

### C — Anti-répétition en série (fenêtre 60 minutes)
Mémoire de session UNIQUEMENT (variable privée de `aiPanel.js`, ni synchronisée, ni
sauvegardée — un rechargement l'efface, choix assumé : la « série » dont parle Joel se joue
dans la même session). Après chaque génération réussie, les noms proposés sont notés avec
l'heure ; à la génération suivante, ceux de moins de 60 minutes partent dans le prompt :
« DÉJÀ PROPOSÉES RÉCEMMENT (n'en repropose AUCUNE, ni variante quasi identique) : … ».
Fenêtre vide → la ligne n'apparaît PAS (zéro jeton gaspillé).

### D — Règles de qualité des étapes, partagées et exigeantes
Une règle commune aux DEUX prompts : chaque étape autosuffisante — durées, températures et
niveau de feu quand ils s'appliquent, repère sensoriel de réussite, moment d'entrée de chaque
ingrédient. Objectif dicté par Joel : « pouvoir réaliser la recette parfaitement ».
⚠️ Pour la recette collée, garde de fidélité : compléter les précisions manquantes selon les
règles de l'art **sans jamais contredire le texte source** (leçon du volet C du LOT 025 : la
fidélité prime, c'est l'écart au source qui était le vrai grief).

### E — SSOT des consignes communes
Les règles partagées (guillemets + apostrophes, emoji unique, quantités+unités, catégories,
qualité des étapes) deviennent des constantes de module de `gemini.js`, consommées par les
deux prompts. Arbitrage d'unification : la formulation de `generateRecipes` (test-lockée)
survit, celle de `transformRecipeFromText` s'aligne. Un test prouve que la MÊME chaîne
apparaît dans les deux messages (anti-redivergence — le motif que P2 a payé deux fois).

## 4. CRITÈRES D'ACCEPTATION

1. Le message de génération contient la liste EXACTE des catégories officielles.
2. Plus aucune trace du 🎲 : ni bouton, ni fonction, ni style, ni test dédié — et le verrou
   de parité `on*=`↔`window` reste vert (preuve que le retrait est complet des deux côtés).
3. Le comportement « valeur de créativité héritée arrondie au cran le plus proche » survit.
4. Deux générations dans l'heure : la 2ᵉ envoie les noms de la 1ʳᵉ avec l'interdiction de
   les reproposer. Au-delà de 60 minutes : plus aucune mention. Première génération : pas de
   ligne anti-répétition du tout.
5. Les DEUX prompts portent la règle de qualité des étapes ; celui de la recette collée porte
   EN PLUS la garde de fidélité au texte source.
6. La règle des guillemets/apostrophes n'existe plus qu'en UN exemplaire dans le code source
   de `gemini.js`, et apparaît à l'identique dans les deux messages envoyés.
7. Aucun autre changement de comportement : créativité (3 phrases intactes au mot près),
   Règle d'Or, plafonds, modèles, transport `callAI`.

## 5. SUIVI

| Chantier | État | Preuves |
|---|---|---|
| A — catégories | ⏳ | |
| B — retrait du 🎲 | ⏳ | |
| C — anti-répétition 60 min | ⏳ | |
| D — qualité des étapes | ⏳ | |
| E — SSOT des consignes | ⏳ | |
