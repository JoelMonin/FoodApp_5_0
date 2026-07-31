# CURRENT GOAL

## Objectif principal — campagne « Restauration & Refonte » (décidée par Joel le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence**. Le projet est désormais de **tout rebrancher** (le
comportement de l'app d'origine fait référence), puis de **refondre le code en SSOT propre et
maintenable**. Détail et ordre : `RoadMap & Project Pipeline/ROADMAP.md`.

## Lot actif

**LOT 014 — Refonte SSOT et découpage**, ouvert le 2026-07-31 sur `feat/lot14-refonte-ssot`
(depuis `main`, après publication du 5.9). Dernier lot de la campagne. Niveau d'audit **DUR**.
**Phase découverte faite** (4 agents) : 3 points de la fiche étaient déjà soldés par les LOTS
006/013/015, un **défaut actif en production** a été trouvé (`importStockOnly`, voir ci-dessous),
40+ citations corrigées. Détail complet :
`RoadMap & Project Pipeline/LOT 014 - Refonte SSOT et decoupage [EN COURS].md` §PHASE DÉCOUVERTE.

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
- **014** Refonte SSOT et découpage — 🔵 **EN COURS** (ouvert le 2026-07-31), ferme la campagne
  (V5.10)

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
- **Auditeur par défaut (Codex à court de tokens depuis le 2026-07-30)** : Gemini (questions
  FERMÉES uniquement — OUI/NON + `fichier:ligne` + citation littérale) + agents adversariaux
  locaux (question de mutation obligatoire) ; NotebookLM = mémoire de corpus, jamais auditeur
  de code. **Aucun GO ni NO-GO ne se prend sans rouvrir le code** — sur le LOT 015, les
  quatre passages d'audit ont chacun trouvé quelque chose, y compris le dernier passage GO/0.
  Détail : mémoire `feedback_avoid_ultra_audit` / `feedback_verify_audit_findings`.

## POINT DE REPRISE — LOT 014 (état au 2026-07-31, arbre propre)

**Métriques : 771/771 Vitest · 16/16 Pytest · build OK · `js/app.js` 2823 → 1523 lignes (−46 %)
· feuille de style 49,5 → 44,2 Ko (−10,9 %).**

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

**Correctifs de comportement décidés par Joel et livrés** : les 2 défauts de catégorisation ·
la grille d'emojis insensible aux accents (formulaire d'ajout ET édition d'icône) ·
`sanitize()` supprimée (addendum posé sur la fiche du LOT 003).

### Ce qui RESTE — **tous les volets sont livrés ; 4 points de sortie**

1. **CRITÈRE NON ATTEINT, décision de périmètre pour Joel** : `js/app.js` devait passer sous
   **700 lignes**, il en fait **1 523** (−46 %). Atteindre la cible demande une SECONDE
   tournée d'extraction (~1 000 lignes : modale « coller une recette », favoris, panneau IA,
   barre supérieure, modales génériques, réglages), de la taille du volet A mais bien moins
   risquée — ces zones sont désormais couvertes par les LOTS 013/014. **Soit on la fait, soit
   on entérine le −46 %.**
2. **Check-list de la fiche régressions à re-parcourir une à une.** Elle est couverte
   indirectement par les 771 tests, ce qui n'est pas un parcours explicite.
3. **Audit DUR final de campagne** (Gemini en questions fermées + agents adversariaux locaux).
4. **Coup d'œil de Joel sur les 5 vues et les modales** : le découpage CSS est prouvé au
   niveau du fichier produit, mais le retrait des 62 règles mortes change forcément ce
   fichier. Le raisonnement est solide, un regard humain reste la ceinture et les bretelles.

**Un point signalé, sans décision** : la recherche d'emoji par IA de la modale d'édition
(`src/ui/emojiModal.js`) affiche « Erreur recherche emoji » quand c'est simplement la clé qui
manque. Hors des quatre sites du correctif validé, donc laissé tel quel.
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
  (dont 2 blocs de doc orphelins laissés par un déplacement). Balayer après chaque geste.
- **`PROJECT_MAP.md` à chaque nouveau module ou fichier de test** (le verrou pytest l'exige,
  et il est désormais durci : une mention en passant ne suffit plus).

Rappel VERROU PRODUCTION : aucun merge/push vers `main` sans confirmation au moment même.
