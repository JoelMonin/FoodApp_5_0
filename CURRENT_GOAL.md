# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

Aucun — **Version 5.8 publiée le 2026-07-30** (LOT 015, feu vert explicite de Joel après
vérification navigateur). Prochain chantier à ouvrir : **LOT 013 — Filet de tests UI**.

**But en une phrase :** chaque bouton de la page Réglages doit faire exactement ce que son
titre annonce — aujourd'hui « Copier mon stock » copie la liste de courses, « Données
techniques (JSON) » ne produit pas de JSON, et « Mise à zéro » annonce d'effacer la clé API
alors qu'elle la conserve.

**Les 10 chantiers — tous faits**

| # | Chantier | État |
|---|---|---|
| 1 | « Copier mon stock » copie le stock, plus les courses | ✅ |
| 2 | « Partager par rayons » ne partage que le stock | ✅ |
| 3 | « Copier ma liste de courses » n'oublie plus les articles libres | ✅ |
| 4 | Suppression sèche du bouton « Données techniques (JSON) » | ✅ |
| 5 | Aller-retour cohérent sauvegarde ↔ restauration (coches comprises) | ✅ |
| 6 | Texte honnête de « Mise à zéro complète » | ✅ |
| 7 | Non-régressions (LOT 008, panier) | ✅ |
| 8 | Textes et retours de la page (pas de redesign) | ✅ |
| 9 | Garde-fou « rien à copier » + repli de copie restaurés | ✅ |
| 10 | Périmètre du fichier de sauvegarde (4 blocages) | ✅ |

**Ce que la campagne d'audit a coûté et rapporté (dispositif de remplacement de Codex) :**
- **Phase découverte (4 agents)** : la fiche était juste sur le fond mais fausse sur presque
  toutes ses références de ligne (+9 à +630), plus 8 erreurs de contenu et 7 pièges.
- **Audit de spec Gemini** : NO-GO, 4 points — dont l'invalidation du raisonnement central du
  chantier 9 (le garde-fou porté tel quel ne se serait jamais déclenché).
- **2 audits adversariaux locaux** : **2 BLOQUANTS** (le trou de la barrière de synchro, qui
  annulait la restauration quelques secondes après coup ; une garde d'entrée encore
  contournable menant à l'écrasement de l'inventaire), 5 IMPORTANTS, et **4 tests réécrits
  parce qu'ils ne prouvaient rien**.
- **Audit du diff final Gemini** : GO, 0 correction — sa seule critique de test s'est révélée
  **fausse à la vérification** (la mutation annoncée « verte » casse 4 tests).

**Rappel : la campagne « Restauration & Refonte » est close côté restauration** — les
LOTS 015/013/014 sont de la **refonte**. L'oracle `foodapp-v5-Joel.html` reste la référence
de non-régression, mais ce lot assume **QUATRE écarts délibérés** au-dessus de lui : les
trois décidés par Joel (suppression du bouton JSON, toasts chiffrés, coches dans le fichier
de sauvegarde) plus le regroupement par rayon de la liste de courses, déclaré à l'audit.

**Arbitrage §G tranché par Joel** : le chemin « Importer uniquement le stock » purge
désormais les coches devenues sans objet — écart de périmètre autorisé et tracé.

## Lot tout juste publié — Version 5.8 (2026-07-30)

- **LOT 015 — Réglages fiables et cohérents** : les 10 chantiers faits et testés. La zone
  n'avait AUCUN test avant ce lot ; elle en compte désormais 91. Deux défauts BLOQUANTS
  trouvés par les agents adversariaux locaux, dont un trou dans la barrière de quiescence
  du LOT 007 qui annulait une restauration quelques secondes après le message de succès.
  Quatre écarts assumés au-dessus de l'oracle, tous tracés.

## Lots précédents — Version 5.7 (2026-07-30)

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
- **015** — ✅ **PUBLIÉ en Version 5.8 le 2026-07-30**
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
- **`BACKUP_STATE_KEYS`** (`src/constants.js`, LOT 015) : SSOT du périmètre du fichier de
  sauvegarde, utilisée à l'export ET à la restauration. Ne jamais y ajouter un champ
  d'écran ; les coches n'y sont pas (elles entrent par `replaceShoppingChecked`).
- **`resetScreenState({ resetView })`** (`src/state.js`, LOT 015) : SSOT de la neutralisation
  recherche/filtres/vue, partagée par `loadState` (sans la vue) et la restauration (avec).
  La règle n'existait que dans `loadState` — c'est ce qui causait l'écran cassé au retour.
- **La barrière de quiescence a la PRIORITÉ sur la file du moteur** (`js/app.js`,
  `requestSyncOp`, LOT 015) : une opération mise en file pendant qu'un chemin explicite
  attend est périmée et n'est PAS relancée. Sans cette règle, elle partait avec l'état
  d'avant et annulait la restauration. Ne pas « restaurer » l'ancien comportement en
  croyant réparer une synchro manquante.
- **Un garde-fou « rien à copier » doit porter sur la SOURCE, jamais sur le texte final**
  (leçon LOT 015) : les formats composent leur en-tête avant de regarder les données, donc
  un test sur le texte ne se déclenche jamais.
- **Auditeur par défaut (budget de tokens serré, 2026-07-30)** : Codex 5.6 Terra, niveau
  medium — préféré à `/ultra-audit` et à Codex Sol. Discipline confirmée sur toute la
  campagne : spec ET diff final systématiquement audités avant clôture, même au niveau
  Standard — chaque audit a trouvé au moins une correction réelle.

## Prochaine étape

**Version 5.8 en ligne.** Prochain chantier : **LOT 013 — Filet de tests UI** — ouvrir sur
signal de Joel (`/new-lot 013 filet-tests-ui`), après phase découverte obligatoire.
⚠️ **Premier geste du LOT 013** : poser des `id` sur les cartes de Réglages — aucune n'en
porte, ce qui rendrait les sélecteurs du filet fragiles aux changements de libellé (point
de passage retenu à l'audit final du LOT 015, volontairement non corrigé là-bas pour ne
pas glisser une modification non auditée après la clôture).
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
une confirmation passée ne vaut pas pour la suivante.
Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même —
une confirmation passée ne vaut pas pour la suivante.
