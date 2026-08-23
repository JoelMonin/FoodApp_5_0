# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif : **LOT 029 — Modèle 3.7 et gardes de type** (ouvert le 2026-08-03)

Branche `feat/lot29-modele-37-et-gardes`, **chaînée sur `feat/lot28-envie-du-moment`** (qui
porte encore 2 commits non publiés). Fiche :
`RoadMap & Project Pipeline/LOT 029 - Modele 3.7 et gardes de type [EN COURS].md`.

**Cinq chantiers** : (A) le modèle de raisonnement passe à `gemini-3.7-flash` · (B et C) les
gardes de type manquantes sur les réglages IA, findings F-011 et F-012 du registre technique ·
(D) plafond de sortie et lecture du motif d'arrêt · **(E) la vraie cause de la panne de Joel**
— une consigne ambiguë faisait écrire au modèle des guillemets simples comme délimiteurs,
1 génération sur 4 illisible.

| Étape | État |
|---|---|
| Implémentation + tests | ✅ 2026-08-03 |
| Preuve par retrait | ✅ 8/8 rouges (lot) + **7/7 rouges (correctifs d'audit)** |
| Validation unifiée | ✅ 986 Vitest · 216 Pytest · types OK · build OK |
| Audit Codex du diff final | ✅ 2026-08-03 — **NO-GO**, 1 finding CRITIQUE + 6 autres, **tous confirmés sur pièce et corrigés** |
| Contre-audit après correction | ⏳ **prochaine étape** (reprise du même fil Codex) |
| Essai réel de Joel | ⏳ bloquant avant publication |

⚠️ **Le premier diagnostic de la panne était FAUX** (troncature supposée, jamais observée). La
vraie cause n'a été trouvée qu'en instrumentant le navigateur de Joel. La fiche §D en garde la
trace complète — c'est la leçon la plus chère du lot.

---

## Version 5.16 en ligne (2026-08-02)

**LOT 028 publié en V5.16 le 2026-08-02** (feu vert de Joel : « publie »), **puis confirmé par
son essai réel : « ça marche »**. La fonctionnalité est validée à l'usage, pas seulement par
les tests.
Fiche : `RoadMap & Project Pipeline/LOT 028 - Envie du moment [CLOTURE].md`.
Niveau d'audit **relevé de Standard à Dur par Codex lui-même** (zone sensible
`src/services/gemini.js` + valeurs traversant des frontières externes persistées).

**Demande de Joel** : « pouvoir imposer un type de plat ou une contrainte particulière à la
génération, via un champ d'entrée libre ». Trois décisions prises par question fermée le
2026-08-02 : (1) champ « Envie du moment » **en tête des réglages IA**, avec rappel de la
consigne active dans le résumé sous le bouton Générer ; (2) en cas de contradiction avec les
puces, **la consigne libre gagne** (les ingrédients imposés restent au-dessus de tout, règle
d'or inchangée) ; (3) le champ « Exceptions autorisées » — découvert **jamais branché depuis
l'origine** (enregistré, synchronisé, restauré… jamais envoyé à l'IA, pas même dans l'oracle)
— **sera enfin branché** dans le même lot.

**La découverte a exhumé un défaut dormant depuis le premier jour** : `aiConfig.exceptions`
(« Exceptions autorisées ») était saisi, enregistré, synchronisé au cloud, sauvegardé et
restauré — mais **lu par aucun des 6 prompts du dépôt**, ni même par le monolithe d'origine.
Joel s'en était déjà servi (« Riz » dans sa sauvegarde du 2026-07-29) en croyant que l'IA en
tenait compte. Branché dans ce lot (décision 3).

| Étape | État |
|---|---|
| Branche + fiche + suivi | ✅ 2026-08-02 |
| Phase découverte | ✅ 2026-08-02 — 14 ressources, 12 gaps |
| Spécification | ✅ 2026-08-02 (fiche §6) |
| Implémentation + tests | ✅ 2026-08-02 — 17 tests neufs + 1 test de synchro |
| **Audit du diff final** | ✅ 2026-08-02 — **Codex 5.6 Sol : GO AVEC RÉSERVES**, 4 findings, **4 confirmés sur pièce, 4 corrigés** |
| Preuve par retrait | ✅ 2026-08-02 — **13 mutations / 13 rouges nommées, 0 nulle** |
| Validation unifiée | ✅ 2026-08-02 — **types OK · 952/952 Vitest · 216/216 Pytest · build OK** |
| Vérification visuelle | ✅ 2026-08-02 (app lancée en local) |
| Essai réel de Joel | ✅ 2026-08-02 — **essayé et concluant** |
| Publication | ✅ **V5.16 le 2026-08-02** |

**PREMIER AUDIT LANCÉ PAR CLAUDE LUI-MÊME** (2026-08-02) : le pont `scripts/audit_bridge.py`,
arrivé du projet jumeau le jour même, supprime le copier-coller manuel de Joel dans la boucle
d'audit. Codex a relevé le niveau de Standard à **Dur** de sa propre initiative. **Le meilleur
finding est un défaut que j'avais créé** : en branchant « Exceptions autorisées » au message
envoyé à l'IA, je lui ai donné une exposition qu'il n'avait pas — une valeur non textuelle
venue d'une sauvegarde corrompue plantait la génération. J'avais protégé le champ NEUF et
oublié le champ que je venais de rendre vivant.

## Version en ligne : V5.15 (2026-08-02)

**Les LOTS 025 + 026 + 027 sont publiés en V5.15 le 2026-08-02** (feu vert explicite de
Joel : « ok, publie tout en V5.15 »). Trois branches chaînées (`lot25` ← `lot26` ← `lot27`),
une seule fusion `--no-ff` dans `main`. Le commit de gouvernance du matin (nettoyage du
backlog + registre des dettes, sciemment retenu) est parti dans le même envoi.
**Métriques finales : types OK · 934/934 Vitest · 16/16 Pytest · build OK · 33 mutations
rouges cumulées (18+12+3), 0 nulle.**

Ce que la page en ligne gagne : l'import de recette lit la **fiche officielle
`schema.org/Recipe`** des sites (repli honnête sinon), l'aperçu montre la recette **entière**,
les prompts de génération sont soignés (catégories fournies, anti-répétition 60 min, étapes
autosuffisantes, SSOT), le bouton 🎲 est retiré (décision produit), et la puce **Keto**
rejoint les régimes.

## Lot tout juste publié — LOT 027 (V5.15)

**LOT 027 — Option Keto**, ouvert, terminé et publié le **2026-08-02** sur
`feat/lot27-option-keto`. Fiche :
`RoadMap & Project Pipeline/LOT 027 - Option Keto [CLOTURE].md`.
Une 6ᵉ puce « Keto » : **1 ligne d'HTML, zéro JS de production** (la chaîne clic → état →
cloud → restauration → prompt était entièrement générique), 6 tests neufs dont la première
couverture de la ligne « RÉGIMES & EXCLUSIONS » du prompt, 3 mutations/3 rouges. Publié sans
essai préalable par décision de Joel (tracé fiche §5-6, même procédé que le LOT 019).
Point parqué au registre technique : **F-011** (`diet` sans garde de type, contrairement à
`cuisines`).

## Lot précédent — LOT 026, publié en V5.15

**LOT 026 — Prompts de génération**, ouvert et terminé le **2026-08-02** sur
`feat/lot26-prompts-generation` (chaînée sur la branche du 025). **Audit final Codex : GO**
(2 findings, contre-vérifiés par mutation puis corrigés — dont un majeur : mes tests SSOT
prouvaient le message, pas le code ; verrou de SOURCE ajouté). 928/928 Vitest ·
12 mutations/12 rouges.
Fiche : `RoadMap & Project Pipeline/LOT 026 - Prompts de generation [CLOTURE].md`.
5 chantiers décidés par Joel après un audit des prompts : catégories injectées, **suppression
du bouton 🎲** (décision produit, confirmée par question fermée), anti-répétition sur 60 min
(mémoire de session uniquement), règles de qualité des étapes partagées, SSOT des consignes
communes. + correctif post-essai réel de Joel : plafond de sortie doublé (16384), message
d'erreur en français, erreurs affichées 6 s. **Refusé par Joel, à ne
pas re-proposer** : muscler la phrase « TRÈS CRÉATIF » (« je n'ai pas envie de disqualifier
les associations classiques »).

## Lot précédent — LOT 025, publié en V5.15

**LOT 025 — Amélioration IA**, ouvert et terminé le **2026-08-02** sur
`feat/lot25-amelioration-ia`. **Audit final Codex : GO** (1 finding mineur, contre-vérifié
puis corrigé). 914/914 Vitest · 18 mutations/18 rouges.
Fiche : `RoadMap & Project Pipeline/LOT 025 - Amelioration IA [CLOTURE].md`.

**Né d'un constat de Joel** : après import d'une recette Marmiton et transformation IA, il
croyait que l'application avait perdu sa recette. **Diagnostic : la transformation avait
réussi** — la recette structurée existait en entier en mémoire, mais l'écran n'affichait que
la phrase d'accroche. **On lui demandait de sauvegarder ce qu'il ne pouvait pas voir.**

| Volet | Résultat |
|---|---|
| **0** | Angle mort comblé : **aucun test ne prouvait que le texte collé arrivait dans le message envoyé à l'IA** — on pouvait le supprimer entièrement sans faire rougir un test. Bouché AVANT de toucher au reste |
| **A** | L'aperçu montre la recette COMPLÈTE : ingrédients, quantités, étapes numérotées (`src/utils/recipeText.js`) |
| **B** | La page importée est nettoyée avant l'envoi à l'IA (`src/utils/webClean.js`) — **−90 % mesuré sur la vraie page Marmiton**, 25 075 → 2 551 caractères — et le titre ne porte plus le préfixe `Title:` |
| **C** | Rapport de fidélité IA ↔ site. **Analyse seule, aucun prompt modifié** : 3 correctifs rédigés, en attente de décision de Joel (pare-feu A/B) |

**Validation : 879/879 Vitest · 16/16 Pytest · types OK · build OK · preuve par retrait 7/7,
0 nulle.**

**⚠️ AUTO-CORRECTION DU 2026-08-02 — MON RAPPORT DE FIDÉLITÉ (volet C) ÉTAIT FAUX SUR DEUX
POINTS SUR TROIS.** Joel a contesté, capture à l'appui ; vérification faite sur les données
structurées des sites ; **il a raison**. (1) Marmiton porte bien ses quantités — la blanquette
en donne treize ; sa capture affichait `½ kg` parce que la page était réglée sur 2 personnes,
le site recalcule. Seule la page **aubergines** n'en porte pas, et c'est une propriété de
cette recette-là, pas du site. (2) Mes deux griefs sur la blanquette (« viande dorée », «
champignons trop tôt ») sont **démentis par le texte source** : l'IA avait transcrit
fidèlement. **J'ai opposé mon opinion culinaire au texte source sans l'avoir lu** — même leçon
qu'aux LOTS 019 et 024. Détail : fiche du lot §6.1 bis et §6.2. **Seul défaut confirmé : les
apostrophes manquantes (P2).** P3 perd sa justification, P1 se réduit à un cas étroit.

**⚠️ LE NETTOYEUR EST SUR-AJUSTÉ À MARMITON** (mesuré sur 4 sites, fiche §7) : −90 % sur
Marmiton, mais −65 % sur Marie Claire (plafond déclenché), −43 % sur Journal des Femmes et
**−15 % sur un blog**. Cause unique : la coupe de tête exige un titre de niveau 1, que seul
Marmiton possède. **Jamais destructeur** (garde-fou jamais déclenché, aucune recette amputée),
mais faible hors Marmiton.

**➡️ VOLET D PROPOSÉ, NON OUVERT — la fiche recette structurée.** Les 5 sites testés publient
déjà leur recette en données structurées (schema.org `Recipe`), et le lecteur de page sait
rendre le HTML brut pour y accéder. Sur la blanquette : 13 ingrédients avec quantités, 7
étapes au mot près, **1 088 caractères contre 25 000 (−96 %)**, et **plus rien à deviner pour
l'IA**. Résout d'un coup le sur-ajustement ET l'essentiel du grief du volet C. Trois pièges
déjà repérés (formes divergentes selon les sites, durées ISO, repli obligatoire) — fiche §8.

**➡️ VOLET D LIVRÉ le 2026-08-02** — `src/utils/recipeSchema.js`. L'application lit désormais
la fiche que le site publie déjà pour les machines. **Épreuve du réel : 10 fiches officielles
lues sur 13 sites.** Pour la blanquette de Joel, l'IA reçoit les 13 ingrédients avec quantités
et les 7 étapes au mot près — **1 257 caractères au lieu de 290 414**. Les 3 sites sans fiche
retombent sur le nettoyeur, avec un message honnête à l'écran.

**AUDIT DE SPEC CODEX (2026-08-02, AVANT la première ligne de code) : GO AVEC RÉSERVES,
6 findings, tous contre-vérifiés sur pièce — 4 confirmés, 1 partiel, 1 plausible, 0 rejeté.**
Deux ont été tranchés par Joel (D1 : un échec de lecture reste un échec sec, l'arbitrage
LOT 011 §9 Q2 tient ; D2 : budget de 10 s GLOBAL, pas par lecture). Le meilleur finding a
évité un piège invisible : réutiliser l'afficheur d'aperçu comme sérialiseur d'entrée IA
aurait fait qu'un jour, **changer la présentation à l'écran aurait changé le message envoyé
à l'IA sans que rien ne le signale**. Deux fonctions désormais séparées, frontière verrouillée
par des tests. **Une modification de test existant était inévitable : elle est DÉCLARÉE**
(fiche §10.1 bis), pas silencieuse.

**Validation du lot : 912/912 Vitest · 16/16 Pytest · types OK · build OK · preuve par
retrait 16/16, 0 nulle.**

**Les trois attentes de l'époque sont soldées** : (1) audit du diff final Codex → **GO** ;
(2) P2 (apostrophes) → appliqué, puis renforcé au LOT 026 (SSOT `REGLE_GUILLEMETS`) ;
(3) feu vert de publication → donné le 2026-08-02, parti en V5.15. Reste ouvert hors lot :
P1 version étroite (sources sans quantités), jamais tranché — au backlog des idées, pas une
dette.

---

Le backlog a été nettoyé le **2026-08-02** (hors lot, documents uniquement) : les
4 fiches re-vérifiées dans le code, 2 fermées, et création du registre des dettes techniques
`audits/BACKLOG_TECHNIQUE.md` — qui était réclamé par le démarrage de session depuis sa
création sans avoir jamais existé. **5 dettes actives** y sont tracées, la plus risquée étant
**F-002** (restauration hors ligne puis reconnexion : aucun test, risque de perte silencieuse
de données). **Le seul chantier ouvert du backlog produit est l'accessibilité.** Fusionné dans
`main` en local, **volontairement non publié** — l'envoi attendra un prochain lot.

--- Les **LOTS 021, 022, 023 et 024 sont publiés en Version 5.14 le 2026-08-01**
(feu vert explicite de Joel, après essai réel : « la meilleure version jusqu'à aujourd'hui,
vraiment utilisable dans la vraie vie »). Quatre lots nés de son évaluation de la qualité du
code, ouverts et mis en ligne le même jour.

- **LOT 021 — Le vérificateur de types** : relit le JavaScript existant, 128 signalements
  → 0, **sans qu'une ligne de comportement ne change**. Le défaut du LOT 017 est rejoué et
  attrapé en 1,2 s. Validation à 4 étapes. Fiche : `LOT 021 - Verificateur de types [CLOTURE].md`.
- **LOT 022 — La fiche de réglages IA toujours complète** : née d'un constat du LOT 021.
  Une restauration cloud/fichier sans réglages envoyait « Exactement **undefined**
  personnes » à Gemini. Preuve par retrait 3/3. **Le premier endroit que j'avais montré à
  Joel était le mauvais — corrigé, et vérifié par mutation.**
  Fiche : `LOT 022 - Reglages IA toujours complets [CLOTURE].md`.
- **LOT 023 — La jauge de créativité ne ment plus** : ressenti de Joel (« on a bricolé un
  truc »). 101 positions pour 3 résultats réels, sans mise en évidence. Curseur à 3 arrêts
  fermes, libellé actif visible, seuillage extrait en SSOT. **La consigne envoyée à l'IA
  n'a pas changé d'un mot** — vérifié par mutation. Preuve par retrait 4/4.
  Fiche : `LOT 023 - Jauge de creativite honnete [CLOTURE].md`.
- **LOT 024 — Nettoyage de dette + rectification** : sweep des comments-dette (périmètre
  bien plus étroit que redouté), `foodapp-v5-Joel.html` étiqueté archive de référence, et
  une **auto-correction** — voir ci-dessous. Fiche :
  `LOT 024 - Nettoyage dette et rectification [CLOTURE].md`.

**⚠️ AUTO-CORRECTION DU 2026-08-01 — mon propre diagnostic « chiffres faux du LOT 018 »
était FAUX.** En préparant le lot de rectification, j'ai réaudité l'historique git ligne
par ligne (commits `add46f2`, `48d3cb2`, `62d4441`) plutôt que de refaire un `grep` rapide.
**Les nombres déjà écrits dans la fiche LOT 018, cette page, `ROADMAP.md` et `SHIP_LOG.md`
étaient CORRECTS** : 5 registrars (`registerModalHooks`, `registerRecipeModalHooks`,
`registerTopbarHooks`, `registerAddFormNav`, **`registerSyncUi`**), 10 → 9 points de
couplage. Mon affirmation « 3 béquilles, 6 entrées, jamais de changement », faite à Joel
pendant l'évaluation de qualité, oubliait deux registrars dans un comptage `grep` trop
rapide — `registerAddFormNav` (nommé `_nav`, pas `_hooks`) et `registerSyncUi`
(`src/services/sync.js`, hors du dossier `src/ui/`). **Rien n'a été touché dans les
documents de suivi : c'est ma déclaration à Joel qui était l'erreur**, corrigée ici pour
qu'aucune version fausse ne reste la dernière écrite.

---

## Historique récent

Le **LOT 020 a été publié en Version 5.13 le 2026-08-01** (feu vert de Joel
après essai : « j'ai testé, c'est ok »). Demande née de son retour de courses, ouverte et
mise en ligne le même jour. Détail, règle et preuves :
`RoadMap & Project Pipeline/LOT 020 - Ranger les achats [CLOTURE].md`.

**Ce que ça ajoute** : une barre collante en bas de la liste de courses, visible dès qu'un
article est coché — « 🏠 Ranger 3 achats ». Les articles cochés passent en stock et quittent
la liste ; les non cochés ne bougent pas. Le « 🗑️ Vider » est inchangé à côté.

**Fonctionnalité NEUVE, pas une restauration** : vérifié, l'oracle ne connaît que « Vider »,
qui balaie tout sans jamais toucher au stock. L'oracle n'est donc pas la référence ici.

**+ un défaut existant corrigé, en commit séparé et EN PREMIER** (`be124cb`) : `toggleStock`
était le seul des quatre chemins de sortie du panier à **ne pas effacer la coche**. L'id
restait dans le jeu de coches, persisté ET synchronisé — l'article revenait plus tard dans la
liste **déjà coché tout seul**. La règle du passage en stock vit désormais dans un helper
unique, `_passerEnStock`.

**Validation : 825/825 Vitest · preuve par retrait 6/6, 0 nulle.**

**Deux erreurs rattrapées avant commit** : un libellé « mon 1 achat » qui ne se dit pas, et
surtout **un test qui interrogeait `localStorage` sur une mauvaise clé** — il aurait comparé
`null` à `null` et serait passé quoi que fasse le code. Faux verrou exactement du type que le
LOT 014 traquait. Réécrit avec témoin explicite, et la mutation M4 prouve qu'il mord.

## Lot précédent — LOT 019, publié en V5.12 (le même jour)

Le **LOT 019 est publié en Version 5.12 le 2026-08-01** (feu vert
explicite de Joel au moment du déploiement) : ouvert, spécifié, implémenté et mis en ligne
le même jour. Détail, règle contractuelle et preuves :
`RoadMap & Project Pipeline/LOT 019 - Correspondance stock-recette [CLOTURE].md`.

**⚠️ PREMIER LOT DEPUIS LA 5.9 QUI CHANGE LE COMPORTEMENT VISIBLE** (les 016/017/018 étaient
invisibles) — et **publié SANS la vérification visuelle de Joel ni l'audit du diff final**,
les deux proposés et écartés par sa décision. Si un comportement du sélecteur de courses
surprend à l'usage, revenir ici en premier : l'audit reste faisable à froid sur `662c6f2`.

**Validation : 810/810 Vitest · 16/16 Pytest · build OK · preuve par retrait 7/7, 0 nulle.**

**Deux choses que la preuve par retrait a trouvées et que 810 tests verts ne disaient pas :**
1. **Un trou du filet** : rien ne couvrait le retrait du terme `|| i.s === 'missing'` de
   `src/ui/recipe.js`. J'avais écrit un commentaire affirmant un comportement que rien ne
   vérifiait. Test ajouté dans `tests/ai-cards-rich.test.js`.
2. **Un défaut de conception dans mon propre moteur** : `_classer` portait une tolérance
   « une faute de frappe » qui faisait DOUBLON avec la dépluralisation — les deux se
   couvraient mutuellement, donc aucune n'était prouvable. La tolérance a été retirée : elle
   était aussi la plus risquée (elle classait « Farine » et « Marine » comme le même
   ingrédient, donnant le dernier mot à l'inventaire sur une paire que seule l'IA peut
   départager). **Deux mécanismes qui se couvrent l'un l'autre ne sont pas une sécurité,
   c'est un angle mort** — et seule la mutation le montre.

**Ce que le lot change à l'écran** : « Fécule de tapioca » est enfin reconnue dans
« Fécule (tapioca) » ; la levure boulangère n'est plus rachetée quand « levure » est en
stock ; les épices tajine restent proposées à l'achat malgré les épices couscous.

**La règle en une phrase** : l'inventaire a le dernier mot dès qu'il parle clairement
(correspondance exacte ou article générique en stock), l'IA n'arbitre que la zone du doute
(variantes cousines, stock plus spécifique que la demande, synonymes). Trois causes racines
prouvées par la découverte : le « premier voisin » au lieu du « meilleur » (`stockMatch.js:30`
vs oracle l.5339), « l'IA fait autorité » qui est une INVENTION de la v2 (l'oracle ne lit
jamais `ing.s` dans ce calcul), et les mots vides + dépluralisation de l'oracle (l.6354-6381)
perdus au portage — cause directe du cas « Fécule de tapioca ».

**Décisions prises par Joel le 2026-08-01 (ne pas re-demander)** : D2 cas « lait »/« lait de
coco » → l'IA départage ; D3 doute sans avis IA → proposer d'acheter. Critères
d'acceptation = les 9 cas du §3 de la fiche, issus des captures réelles (fécule reconnue,
levure plus jamais rachetée, épices tajine toujours proposées).

⚠️ Les 4 tests de `tests/stock-match.test.js:65-91` qui gravent « l'IA fait autorité » seront
RÉÉCRITS en connaissance de cause, pas « réparés ». Les 11 autres restent verts tels quels.
`areSimilar`/`normalizeString` globaux : INTERDIT d'y toucher (9 appelants de production
hors zone).

## Lot précédent — LOT 018, publié en V5.11

**LOT 018 — L'écran inventaire dans son module** : ouvert ET terminé le 2026-08-01 sur
`feat/lot18-ecran-inventaire`, **publié en V5.11 le 2026-08-01**. Détail :
`RoadMap & Project Pipeline/LOT 018 - Ecran inventaire dans son module [CLOTURE].md`.

**Le vrai enjeu n'était pas le nombre de lignes, c'était le couplage — et il a baissé.**

| | Avant | Après |
|---|---|---|
| `js/app.js` | 625 lignes | **568** |
| Crochets | 5 | 5 |
| **Points de couplage** | **10** | **9** |

**Première baisse réelle du couplage de toute la série** (celle annoncée au LOT 017 était
fausse). Elle tient à un point précis : `renderPantry` appelait `renderPantryFilters`, que le
LOT 017 avait logée dans `topbar.js`. En rapatriant les puces de filtre avec l'écran qu'elles
filtrent, le crochet `renderPantry` disparaît — il n'existait que pour elles.

**Depuis le début du rangement : `js/app.js` est passé de 2823 à 568 lignes, soit −80 %.**

**Trois pièges évités par la découverte**, chacun porteur d'une régression invisible :
`initChipsRowTouchScroll` (faux ami : son sélecteur couvre 8 éléments, dont 7 pour le panneau
IA), les 4 alias `Actions.*` (ils servent AUSSI à `expose()` — les emporter cassait 4 gestes
sans faire rougir un test), et l'annonce « le crochet tombera à 1 » (faux : il en reste 2,
trois textes du dépôt corrigés).

**⚠️ Leçon d'outillage à ne pas perdre** : la première validation après ce déménagement a
affiché **77 tests rouges**. Aucun n'était réel — cache de transformation Vite servant un
mélange d'ancien et de nouveau code. Vérifié par reproduction : seuls (15/15), deux à deux
(25/25), suite entière (798/798), puis deux validations complètes consécutives vertes.
**Un échec non reproduit ne prouve rien** : « corriger » sur cette foi aurait cassé du code
sain. C'est le pendant exact de la leçon du LOT 014 sur les faux rouges du harnais de mutation.

## Lot précédent — LOT 017, publié en V5.11

**LOT 017 — Second rangement de `js/app.js`** : ouvert ET **TERMINÉ le 2026-07-31** sur
`feat/lot17-second-rangement-app-js`, statut **A PUBLIER**. Chaînée depuis `feat/lot16`
(également `[A PUBLIER]`) : les deux lots partiront ensemble, comme les LOTS 007+008,
009+010 et 011+012. Détail et preuves :
`RoadMap & Project Pipeline/LOT 017 - Second rangement de app.js [A PUBLIER].md`.

**Objectif dépassé : `js/app.js` passe de 1527 à 625 lignes (−59 %)**, pour une cible
annoncée à ~700. Six modules extraits (`modals`, `settings`, `favorites`, `topbar`,
`pasteRecipe`, `aiPanel`).

**⚠️ RECTIFICATION du 2026-07-31** : j'ai annoncé partout « couplages en baisse, 5 crochets
→ 4 ». **C'est faux.** Vrai au premier volet, faux dès le suivant (`registerTopbarHooks` a
rétabli le compte). Mesure réelle : **5 crochets avant, 5 après ; 9 points de couplage avant,
10 après.** Le couplage n'a pas baissé, il a très légèrement augmenté. Ce qui a changé est sa
NATURE : les crochets ne retiennent plus du code prisonnier du fourre-tout, ils pointent vers
l'écran inventaire, qui attend son propre module. Troisième chiffre recopié sans être
remesuré sur ce lot, après 1523 et 1366 — **une affirmation chiffrée se remesure à chaque
étape**.

**🔴 LE DÉFAUT À RETENIR DE CE LOT : la construction de production était cassée depuis le
premier volet, avec 798 tests verts.** `js/app.js` importait deux fonctions supprimées de
leurs modules ; Vitest résout les modules à la demande et n'a rien vu, `vite build` échoue
net. La branche a été **impubliable pendant cinq volets** sans que rien ne le signale.
Contre-épreuve faite : un import d'une fonction totalement imaginaire laisse les 798 tests
verts. **La validation unifiée passe donc de 2 à 3 étapes** (`validate.bat`, `npm run check`,
`CLAUDE.md` §4). Une suite de tests verte ne prouve pas que l'application se construit.

**⚠️ La mesure de départ était fausse DEUX FOIS** : la fiche backlog annonçait `js/app.js` à
**1523 lignes** (chiffre écrit à la main à la clôture du LOT 014, jamais remesuré), et ma
première vérification a répondu **1366** — un comptage des lignes NON VIDES, donc faux lui
aussi. **La valeur réelle est 1527 lignes**, identique depuis 5 commits. Deux chiffres faux
d'affilée sur la mesure la plus simple du lot : rien ne se cite sans être remesuré, pas même
une correction.

## Lot précédent — LOT 016, publié en V5.11

**LOT 016 — Étiquettes de recette au propre** : ouvert et **terminé le 2026-07-31** sur
`feat/lot16-etiquettes-recette-css`, statut **A PUBLIER**. Traite le point de sortie n°2 du
LOT 014 (`.r-tag`), que Joel avait volontairement reporté. Détail et preuves :
`RoadMap & Project Pipeline/LOT 016 - Etiquettes de recette au propre [A PUBLIER].md`.

**Le diagnostic a corrigé l'hypothèse du LOT 014** : `.r-tag.green` de `05-ai.css` était bien
100 % morte, mais `.r-tag.red` ne l'était qu'à moitié — `font-weight` et `box-shadow` y
survivaient. Un retrait en bloc, tel que l'hypothèse initiale l'aurait suggéré, aurait donc
changé l'apparence. **Décisions de Joel** : garder l'aspect actuel (zéro pixel modifié) et
laisser les variantes `gold`/`terra`, jamais produites par l'application.

**Suite prévue (décidée par Joel, pas encore ouverte)** : le second rangement de `js/app.js`
— fiche prête : `Backlog/BACKLOG - Second rangement de app.js.md`. À ouvrir via `/new-lot`,
avec phase découverte obligatoire.

## Lot tout juste publié — Version 5.10 (2026-07-31)

La campagne « Restauration & Refonte » est **achevée et en ligne** : le LOT 014 a été
**publié en Version 5.10 le 2026-07-31** (feu vert explicite de Joel, fusion `--no-ff` dans
`main`). Détail complet, y compris l'audit DUR final (6 agents adversariaux) :
`RoadMap & Project Pipeline/LOT 014 - Refonte SSOT et decoupage [CLOTURE].md`.

**Ordre arrêté : C1 → B → C → G → A → D → E → F.**

**Deux points signalés à Joel le 2026-07-31, décision inchangée :**
- La suppression des articles libres **efface** aussi le champ du cloud dès le premier envoi
  suivant (la fiche annonçait à tort qu'une copie périmée y resterait). Action de Joel avant la
  livraison du volet G : copier sa liste de courses s'il veut garder trace du « porc haché ».
- Deux libellés de Réglages qu'il lit (`index.html:535`, `:571`, « articles libres compris »)
  deviendront faux et seront réécrits dans le même volet.

**LOT 013 — Filet de tests UI** : terminé et audité le 2026-07-31, **publié seul en Version
5.9** — 102 tests neufs (448 → 550), matrice de couverture 84/84, 2 audits adversariaux locaux
(0 test tautologique confirmé) + audit Gemini (12/12 vérifiées sur pièce). **Arbitrage de Joel
du 2026-07-31** : rompre avec l'habitude de chaîner les lots par paires, parce que le 013 n'est
pas le pair du 014 mais sa police d'assurance — la garder sur l'étagère pendant le chantier le
plus risqué de la campagne, c'était la perdre avec lui en cas d'abandon. Le LOT 014 devient
donc la **5.10** (et non la 6.0). Détail : `LOT 013 - Filet de tests UI [A PUBLIER].md`.

**But en une phrase :** figer par des tests le comportement de l'app restaurée (LOTS 007-012
et 015), avant que le LOT 014 déplace le code en masse — exactement ce qui manquait lors de la
migration Vite, qui a perdu ~30 comportements en silence faute de filet.

**Deux arbitrages pris à l'ouverture (2026-07-30) :**
- **Ancres de test autorisées** : `id` sur les 9 cartes de Réglages + les modales statiques,
  `data-testid` sur le rendu dynamique (tuiles d'inventaire, lignes de courses — aujourd'hui
  adressables par leur seule position, alors que le LOT 010 les trie et les déplace). Ajout
  d'attributs uniquement, aucun changement de structure. Audit relevé à Standard en
  conséquence (le lot touche `index.html`).
- **Articles libres (`customCartItems`)** : ni restaurés, ni traités ici. Joel a tranché de
  les **supprimer** (« et si on effaçait ces articles libres, et qu'on n'en parlait plus »)
  plutôt que de rebrancher leur affichage/ajout manquants. La suppression est un déplacement
  de code : elle attend le filet, donc part au **LOT 014 §G** (inventaire des 8 sites déjà
  rédigé). Aucun test neuf de ce lot ne doit les mentionner.

## Lot tout juste publié — Version 5.8 (2026-07-30)

- **LOT 015 — Réglages fiables et cohérents** : les 10 chantiers faits et testés. La zone
  n'avait AUCUN test avant ce lot ; elle en compte désormais 91. Deux défauts BLOQUANTS
  trouvés par les agents adversariaux locaux, dont un trou dans la barrière de quiescence
  du LOT 007 qui annulait une restauration quelques secondes après le message de succès.
  Quatre écarts assumés au-dessus de l'oracle, tous tracés. Détail : voir la fiche clôturée.

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
- **013** Filet de tests UI — ✅ **PUBLIÉ en Version 5.9 le 2026-07-31**
- **014** Refonte SSOT et découpage — ✅ **PUBLIÉ en Version 5.10 le 2026-07-31** — ferme la
  campagne « Restauration & Refonte ».
- **016 + 017 + 018** Le grand rangement de `js/app.js` — ✅ **PUBLIÉS en Version 5.11 le
  2026-08-01** — `js/app.js` : 2823 → 568 lignes (−80 %), 7 modules d'écran, première baisse
  réelle du couplage (10 → 9)

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
  **`.r-tag` a été traitée au LOT 016**, sans jamais rien supprimer de vivant : les variantes
  rouge et verte étaient définies deux fois, elles ne le sont plus qu'une, et l'apparence à
  l'écran est prouvée identique. Les autres classes de cette liste restent intouchées.
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
- **Auditeur par défaut (Codex à court de tokens depuis le 2026-07-30)** : Gemini (questions
  FERMÉES uniquement — OUI/NON + `fichier:ligne` + citation littérale) + agents adversariaux
  locaux (question de mutation obligatoire) ; NotebookLM = mémoire de corpus, jamais auditeur
  de code. **Aucun GO ni NO-GO ne se prend sans rouvrir le code** — sur le LOT 015, les
  quatre passages d'audit ont chacun trouvé quelque chose, y compris le dernier passage GO/0.
  Détail : mémoire `feedback_avoid_ultra_audit` / `feedback_verify_audit_findings`.

## LOT 014 CLOS — PUBLIÉ en V5.10 le 2026-07-31 (bilan conservé pour mémoire)

**Métriques : 784/784 Vitest · 16/16 Pytest · build OK · `js/app.js` 2823 → 1523 lignes (−46 %)
· feuille de style 49,5 → 43,96 Ko.**

### Ce qui est FAIT

| Étape | Résultat |
|---|---|
| Ouverture + découverte | 4 agents ; 3 points de la fiche déjà soldés ; 40+ citations corrigées |
| **C0** — faux verrous | **12 trouvés** (49 mutations) et comblés. Addendum à la fiche du LOT 013, dont le « 0 test tautologique » était faux |
| **C1** | `importStockOnly` refuse enfin ce qui n'est pas un inventaire |
| **B** | mutation de l'état ; 3 rattrapages supprimés, invariant verrouillé par `const` |
| **C** | `src/utils/validate.js` (SSOT des gardes d'entrée) |
| **G** | articles libres supprimés (10 sites) |
| **A — TERMINÉ** | **8 modules extraits** : `exports`, `sync`, `categorize`, `stockMatch`, `addForm`, `cartPicker`, `emojiModal`, `recipeModal`. Modale morte « ajout groupé » retirée (3 recherches convergentes) |
| **F — TERMINÉ** | **3 verrous** : parité `on*=`↔`window` (à l'EXÉCUTION), imports ESM (22 sites corrigés), durcissement `PROJECT_MAP`. Les 3 portent une garde anti-vide |
| **D — 2 passes faites** | 13 duplications supprimées + 1 défaut réel (« Autres » absent du menu) + verrou `categories-ssot` |
| **Correctifs IA — FAITS** | extracteur JSON unique (`src/utils/aiJson.js`, **4** sites et non 3) + message unique de clé API. 13 mutations, 13 rouges. Détail : fiche du lot, § « Correctifs IA » |
| **E — TERMINÉ** | CSS découpé en 13 sections (**feuille produite identique octet pour octet**, contre-épreuve incluse) + **62 règles mortes retirées (−10,9 %)**. Les 3 recherches convergentes ont évité de casser le Nutri-Score. Verrou `css-sections` (5 mutations / 5 rouges) |
| **Check-list régressions — RE-PARCOURUE** | 41 points, un par un. 1 trou trouvé (retour auto 500 ms non verrouillé) + comblé |
| **Audit DUR final — FAIT** | 6 agents adversariaux locaux en parallèle (un bloquant, trois moyens, trois mineurs corrigés — 10 tests neufs, tous prouvés par retrait). Détail : fiche du lot, § « Audit DUR final de campagne » |

**Correctifs de comportement décidés par Joel et livrés** : les 2 défauts de catégorisation ·
la grille d'emojis insensible aux accents (formulaire d'ajout ET édition d'icône) ·
`sanitize()` supprimée (addendum posé sur la fiche du LOT 003).

### Les 2 points de sortie — **tous deux clos par Joel le 2026-07-31**

1. **Coup d'œil de Joel sur les 5 vues et les modales** (le retrait des 62 règles CSS mortes
   change forcément le fichier produit, même si la preuve au niveau du build est solide) —
   **fait, « tout m'a l'air ok »**.
2. **Décision de Joel sur `.r-tag.red`/`.r-tag.green`** (probablement dupliquées entre
   `05-ai.css` et `12-utilities.css`, même mécanisme que `.recipe-detail-section` déjà
   corrigé — mais `.r-tag` figure sur la liste des classes protégées « CSS REBRANCHÉ par la
   campagne », donc remonté plutôt que tranché seul) — **Joel a choisi de clôturer le lot
   d'abord et de regarder ce point ensuite, séparément, « sans tout casser »**. ✅ **SOLDÉ
   par le LOT 016** le 2026-07-31, après publication de la 5.10. À retenir : l'hypothèse
   posée ici (« la version de `05-ai.css` serait du CSS mort ») n'était vraie que pour le
   VERT ; la rouge gardait deux propriétés vivantes, et l'appliquer telle quelle aurait
   changé l'écran.

**Publication : FAITE.** Après une première clôture en `[A PUBLIER]` (Joel ne voulait pas
publier tout de suite), le feu vert explicite est arrivé le 2026-07-31 au soir
(« tu peux publier la dernière version ») : version montée en 5.10.0 (SSOT +
`sync_version.py`), validation re-passée verte, fusion `--no-ff` dans `main`, mise en ligne.

**SECOND RANGEMENT de `js/app.js` (2823 → 1523 lignes, −46 %, cible 700 non atteinte)** :
tranché par Joel le 2026-07-31 — ni abandonné, ni empilé sur ce lot déjà énorme, un lot
séparé à froid. Fiche prête avec l'inventaire mesuré : `Backlog/BACKLOG - Second rangement de
app.js.md`.

**Un point signalé, sans décision** : la recherche d'emoji par IA de la modale d'édition
(`src/ui/emojiModal.js`) affiche « Erreur recherche emoji » quand c'est simplement la clé qui
manque. Hors des quatre sites du correctif validé — **corrigé par Joel le 2026-07-31** malgré
tout, cinquième site aligné sur `MESSAGE_CLE_API_MANQUANTE`.
**Clos** : les émojis de repli divergents (`🔸`/`❓`/`🛒`/`📦`) — Joel a dit « laisse comme ça ».

### Règles de ce lot à ne pas perdre

- **Un test de caractérisation AVANT tout déplacement** d'une fonction non couverte.
- **Un déplacement ne change JAMAIS un comportement** — un défaut trouvé en chemin se fige
  d'abord, se corrige dans un commit séparé, et seulement sur décision de Joel.
- **Preuve par retrait obligatoire.** Sur ce lot : ~75 mutations. Elles ont trouvé **8 faux
  verrous dans mes propres tests**, et surtout un MOTIF — les tests de modale vérifiaient le
  CONTENU, jamais que la modale S'AFFICHE. Débrancher l'ouverture du sélecteur de courses ou du
  détail de recette ne faisait rougir personne.
- **EXIGER UN NOM DE TEST DANS LA PREUVE.** Un harnais de mutation qui conclut « rouge » sur un
  code de sortie non nul peut compter des **plantages au chargement** comme des preuves : c'est
  arrivé, 11 preuves valaient zéro (l'outil de test était lancé depuis `c:\…` en minuscule au
  lieu de `C:\…`, ce qui casse la résolution du projet). Une mutation n'est prouvée que si un
  test NOMMÉ rougit — et le harnais doit toujours porter un témoin non muté qui reste vert.
- **Vérifier toute piste d'audit sur pièce.** La fiche de découverte contenait 2 affirmations
  FAUSSES (sur `searchEmojiAI`), NotebookLM 2 sur 13. Aucune n'a été appliquée telle quelle.
- **Traquer les commentaires menteurs.** Mes propres correctifs en ont créé 4 dans la journée
  (dont 2 blocs de doc orphelins laissés par un déplacement) ; l'audit DUR final en a trouvé
  2 de plus, dont un qui affirmait l'EXACT INVERSE du code (`toggleSpecialFilter`). Balayer
  après chaque geste ne suffit pas — un second regard, indépendant, en trouve encore.
- **Un audit final rouvre TOUJOURS le code, même sur du travail déjà auto-audité.** L'audit
  DUR de clôture a trouvé un défaut BLOQUANT (l'extracteur JSON unique recréait le symptôme
  qu'il devait éliminer, sur un chemin différent) dans du code livré le jour même avec ses
  propres mutations vertes. Les mutations prouvent ce qu'elles testent, pas ce à quoi
  personne n'a pensé — un regard adversarial indépendant reste irremplaçable.
- **`PROJECT_MAP.md` à chaque nouveau module ou fichier de test** (le verrou pytest l'exige,
  et il est désormais durci : une mention en passant ne suffit plus).

Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même.
