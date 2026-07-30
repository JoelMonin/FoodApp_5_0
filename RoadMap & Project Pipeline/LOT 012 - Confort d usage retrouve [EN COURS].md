# LOT 012 — Confort d'usage retrouvé — SPÉCIFICATION

> **Statut :** 🟢 EN COURS — branche ouverte, phase découverte faite (2026-07-30)
> **Branche :** `feat/lot12-confort-usage` (chaînée depuis `feat/lot11-recettes-ia-riches`)
> **Niveau d'audit : Léger à Standard** — aucun fichier de la liste « zones sensibles »
> (`DOCTRINE_PRODUIT.md` §3) n'est modifié, MAIS la Zone C touche par proximité DOM les
> voyants de synchro du LOT 007 (déjà en production) : audit final à cibler précisément
> là-dessus, pas d'escalade de palier pour autant.
> **Effort estimé :** ~1 journée
> **Avancement :** Zone A ✅ codée+testée · Zone B ✅ codée+testée · Zone D ✅ codée ·
> Zone C en cours (la plus sensible, laissée pour la fin)

**Lecture obligatoire :** `CLAUDE.md`, `DOCTRINE_PRODUIT.md`, `PROJECT_MAP.md`,
`Backlog/BACKLOG - Regressions de la migration.md` (§3), monolithe `foodapp-v5-Joel.html`
aux lignes citées — **oracle comportemental.**

---

## Objectif

La vingtaine de petits gestes qui faisaient la fluidité de l'app d'origine. Individuellement
mineurs, ensemble ils font la différence entre « ça marche » et « c'est agréable ».
**Arbitrage global de Joel (2026-07-29) : le comportement d'avant est la référence.**

## Phase découverte (2026-07-30)

3 agents Explore en parallèle, un par zone (A, B+D, C). Citations oracle très majoritairement
exactes ; en revanche plusieurs numéros de ligne côté **code migré** étaient périmés (le
fichier `js/app.js` a beaucoup grossi pendant le LOT 011) et une citation oracle (zone C,
reset de `shoppingSource`) pointait carrément vers le mauvais bloc de fonctions. **8
corrections** intégrées directement dans le §Périmètre ci-dessous (détail et numéros exacts
sur place, pas dupliqués ici) :
- Zone A : `confirmRecipeToCart` (637+ → 1251) ;
- Zone B : oracle anti-autofill (6774 → 6773, écart d'une ligne) ;
- Zone C : `#top-action-btn` (297 → 274), fonction de rendu (`js/app.js:214` erroné, la
  vraie fonction s'appelle `renderTopbar` et vit en 618-647), reset `shoppingSource`
  (oracle l.4724-4751 faux → vrais resets en l.4719 et l.4826) ;
- Zone D : `.add-results-list`/`.add-res-item` (645 → 629, 992 → 1773/1797),
  `.tb-btn.small` (49 → 246).

Trois découvertes supplémentaires, non prévues par la fiche initiale, intégrées au §C :
le ＋ flottant (`#topbar-add-btn`) doit redevenir masqué hors inventaire (actuellement
toujours visible — vrai bug, pas juste un « confort ») ; le risque de collision entre la
réécriture de `.mh-icons` et le voyant de synchro `#sync-indicator-mobile` (LOT 007,
production) est désormais cartographié précisément ; deux fonctions mortes en doublon
(`switchView` et `saveApiKey` dans `src/actions.js`) sont signalées pour ne pas être
confondues avec les vraies, sans être touchées ici (pare-feu A/B, candidates LOT 014).

Ressources réutilisables confirmées (pas de nouvelle infra à écrire) : CSS complet du
picker déjà posé (LOT historique), `buildEmojiEditSuggestions` (LOT 009, SSOT emoji),
`SEARCH_INPUT_IDS`/`clearSearch()` (anti-autofill), `toast()`, `autoEmoji()`. Gap confirmé :
aucun test du dépôt ne simule un événement clavier — infra de test clavier à créer en Zone B.

## Périmètre

### A. Sélecteur d'articles : l'édition par ligne (complète le LOT 006)

**Oracle : monolithe l.5677-5700 (rendu), `cycleEmoji` l.5809-5824, `confirmRecipeToCart`
l.5826-5862.** Citations vérifiées EXACTES à la découverte. Le LOT 006 a restauré le style
et le pré-cochage ; il manque l'édition :
- chaque ligne : champ **nom modifiable** (`pick-name-*`), **emoji modifiable** (`readonly`,
  changé seulement via 🎲) avec bouton `.picker-magic-btn` qui fait défiler les suggestions,
  libellé de catégorie (`pick-cat-*`, hidden input) ;
- la validation (**`confirmRecipeToCart`, code actuel `js/app.js:1251-1275`** — citation
  `637+` de la fiche initiale périmée) lit aujourd'hui `_currentPickerData[i]` (valeurs
  D'ORIGINE) au lieu du DOM : c'est tout le trou à combler. Elle doit lire les inputs
  `pick-name-*`/`pick-emoji-*` une fois qu'ils existent. **Nuance de l'audit Codex** : ne pas
  confondre « input absent » (repli sur `_currentPickerData[i]`, cas défensif qui ne devrait
  pas arriver) et « nom vidé volontairement par Joel » (l'input existe mais `.value` est
  vide après `trim()` — dans ce cas, refuser proprement CETTE ligne, pas de repli silencieux
  sur le nom d'origine qui ferait ajouter un article sous un nom que Joel vient d'effacer) ;
- `cycleEmoji` : relit `pick-name-${idx}` à chaque clic (si Joel a corrigé le nom avant de
  cliquer 🎲, les suggestions se basent sur le nom corrigé) + liste de secours large (l.5819),
  cycle circulaire ;
- **préserver les acquis du LOT 006**, tous dans `openEnhancedCartPicker`
  (`js/app.js:1187-1249`) : pré-cochage « manquants seulement » (l.1215), badge « En stock »
  (l.1239), correspondances approximatives orange/`soft-match` (l.1218/1229), case maîtresse
  (`index.html:95` + `toggleAllPickerItems`/`updatePickerRow`, l.1969-1977/1960-1967). Le
  remplacement emoji+nom (actuellement fusionnés en un seul nœud texte, l.1220) par deux
  inputs distincts doit se limiter à ce nœud, sans toucher au reste de la fonction.

**Découvertes à respecter :**
- CSS déjà prêt, rien à créer : `.picker-magic-btn` (`css/style.css:2467-2485`, confirmé),
  `.picker-emoji-wrap`/`.picker-emoji-inp` (l.2444-2457), `.picker-name-inp` + `:focus`
  (l.2498-2515), `.picker-cat-label` (l.2517-2521).
- **SSOT emoji** : l'oracle s'appuie sur `getEmojiSuggestions`/`EMOJI_MAP`, qui n'existent PAS
  dans le code migré. Le LOT 009 a déjà posé le remplaçant SSOT pour ce même besoin :
  `buildEmojiEditSuggestions(seed)` (`js/app.js:1652-1660`, commentaire explicite
  « jamais de table d'emojis dupliquée »). `cycleEmoji` doit RÉUTILISER cette fonction, pas
  réintroduire une `EMOJI_MAP` — sinon violation SSOT quasi garantie à l'audit.
- **Piège oracle lui-même** : `confirmRecipeToCart` référence une checkbox
  `pick-strat-new-${i}` (l.5834-5836, « créer un nouvel ingrédient plutôt que fusionner »)
  qui n'est JAMAIS rendue dans le HTML de l'oracle (vérifié sur l.5652-5693) — code mort dans
  l'oracle même. Ne pas la « restaurer » comme un comportement perdu.
- Seul test existant touchant la zone : `tests/ai-ingredient-fidelity.test.js` (filet emoji
  IA du LOT 010, ne couvre ni l'édition ni `cycleEmoji`) — plan de test à écrire de zéro.
- **Défaut hors-plan trouvé et corrigé pendant l'implémentation** (par le nouveau test de
  non-régression du pré-cochage, exigé par les Pièges connus de cette zone) : la case à
  cocher de chaque ligne s'affichait TOUJOURS visuellement cochée, même pour un article déjà
  en stock (`checked` passé à `h()` via `setAttribute`, qui rend un booléen HTML « présent »
  dès que la valeur existe, même `false`) — défaut du LOT 006, jamais testé jusqu'ici,
  invisible car la couleur de la ligne (pilotée séparément par la classe CSS) restait
  correcte. Un seul point d'appel dans toute la base (`checked` n'est utilisé nulle part
  ailleurs comme prop de `h()`) : corrigé localement par affectation directe de la propriété
  IDL, `h()` lui-même non touché (blast radius réel, pas un cas hypothétique — pas de raison
  de le réécrire pour un unique appelant).

### B. Clavier et gestes

**Oracle : l.6744, l.6746, l.6790-6793, l.6773-6781** (dernière plage : 6773, pas 6774 —
écart d'une ligne dans la fiche initiale). Les 4 citations sont exactes sur le fond, et les
4 comportements sont **100 % absents** du code migré (zéro listener clavier nulle part dans
le dépôt, zéro `touchmove` sur `.chips-row`) :
- Entrée dans `#ez-input` (vue IA, `index.html:377`) → `addExtraIngredient()` (existe déjà,
  `js/app.js:2019-2020`, juste pas câblée au clavier) ;
- Entrée dans `#paste-title` → focus sur `#paste-content` (les deux ids existent déjà,
  `index.html:65`/`71`) ;
- `touchmove` avec `stopPropagation` (passif) sur chaque `.chips-row` — scroll horizontal
  des filtres sans entraîner la page (mobile) ;
- vidage anti-autofill des champs de recherche 100 ms après le démarrage : l'infrastructure
  existe déjà et doit être RÉUTILISÉE — `SEARCH_INPUT_IDS` (`js/app.js:745`) et
  `clearSearch()` (`js/app.js:762-771`) font déjà exactement ce vidage, seulement sur clic
  manuel. Il ne manque que le `setTimeout(…, 100)` au boot qui les appelle.

**Découverte** : aucun test du dépôt ne simule un événement clavier (`KeyboardEvent`,
`dispatchEvent`) — zéro match sur toute la codebase. Le plan de test de cette zone part
d'une couverture nulle, infrastructure de test à créer.

### C. Navigation et retours visuels — zone la plus sensible du lot

**Oracle : `updateTopbar` l.4520-4579 (exact), l.6458 (exact), toasts des actions.**
La fonction gère en réalité **6 vues** (pantry/shopping/ai/favorites/export/add), pas 5.

- **Barre supérieure contextuelle** : le bouton d'action est `#top-action-btn`
  (**`index.html:274`**, pas 297) ; le vidage systématique actuel est dans **`renderTopbar`
  (`js/app.js:618-647`, ligne 646)** — PAS `js/app.js:214` (qui appartient aujourd'hui au
  moteur de synchro LOT 007) ni une fonction `updateTopbar` (ce nom n'existe pas côté migré,
  la fonction s'appelle `renderTopbar`). Elle doit redevenir contextuelle — ＋ (inventaire),
  « 📋 Copier » + « 🗑️ Vider » (courses), ⚙️ (IA), « 📋 Coller une recette » (favoris) ;
  icônes mobiles (`#mh-icons`) et sous-titre mobile (`#mh-subtitle`, compteur contextuel)
  dynamiques (les deux existent en HTML mais sont 100 % figés, zéro JS ne les touche
  aujourd'hui) ; barres de recherche masquées hors inventaire ;

  **Titres/sous-titres exacts (oracle l.4521-4532, table transcrite au mot près — corrigé
  par l'audit Codex, l'actuel divergeait déjà : « Mes Courses » au lieu de « Liste de
  courses », « Favoris » au lieu de « Recettes favorites », sous-titres IA/favoris absents) :**

  | Vue | Titre | Sous-titre (fonction) |
  |---|---|---|
  | pantry | Inventaire | `N en stock` |
  | shopping | Liste de courses | `N article(s)` |
  | ai | Recettes IA | `basé sur N ingrédient(s) en stock` |
  | favorites | Recettes favorites | `N recette(s)` |
  | export | Réglages | *(vide)* |
  | add | Ajouter un ingrédient | *(vide)* |

  Note de portage : le pluriel oracle du sous-titre `ai` a un bug d'espace pour N=1
  (`'ingrédient' + 'en stock'` → « ingrédienten stock », collé) — typo oracle, pas une
  intention. **Corrigée silencieusement au portage** (espace ajouté), comme le code mort
  `pick-strat-new` de la Zone A : un défaut mécanique de l'oracle n'est pas restauré tel quel ;

  **Boutons d'action par vue (oracle l.4549-4563), classes CSS déjà toutes présentes,
  aucune à créer :** pantry → `<button class="tb-btn-add">＋</button>` (CSS
  `css/style.css:393-407`, jamais utilisée jusqu'ici) ; shopping → `.tb-btn` « 📋 Copier »
  + `.tb-btn.terra` « 🗑️ Vider » ; ai → `.tb-icon-btn` ⚙️ ; favorites → `.tb-btn.primary`
  « 📋 Coller une recette » ; export/add → vide (comportement actuel déjà correct par
  accident, `actionEl.replaceChildren()`) ;
- **Le vrai FAB de l'oracle est DÉJÀ restauré et correct, ne pas y toucher** : `#fab-add`
  (`index.html:718`, `class="fab-btn hidden"`, CSS `.fab-btn` en `css/style.css:3056-3077`,
  position `fixed` bas-droite) est DÉJÀ basculé correctement par
  `document.getElementById('fab-add')?.classList.toggle('hidden', view !== 'pantry')`
  (`js/app.js:591`, dans `renderCurrentView`). **Ma phase découverte initiale avait raté cet
  élément** (elle n'avait grepé que `topbar-add-btn`) — trouvé par l'audit Codex du
  2026-07-30 ;
- **`#topbar-add-btn` (`index.html:275`) est un bouton EN TROP, sans équivalent oracle** :
  round vert `36×36`, `position:relative` (pas un vrai FAB flottant, juste stylé pour y
  ressembler), posé en sibling de `#top-action-btn` dans `.header-actions`, sans classe
  `hidden` ni bascule — affiché en permanence sur toutes les vues aujourd'hui. Une fois
  `#top-action-btn` restauré (branche pantry → `.tb-btn-add`, CSS déjà présent
  `css/style.css:393-407`, jamais utilisé jusqu'ici), les deux boutons ＋ se retrouveraient
  côte à côte dans le même `.header-actions` sur la vue inventaire — doublon visuel confirmé
  par Codex. **Correction : retirer `#topbar-add-btn` du HTML** (aucune bascule à lui
  ajouter, aucun rôle oracle à lui trouver — pur artefact de migration) ; laisser `#fab-add`
  intact ;
- retour automatique à l'inventaire ~500 ms après un ajout réussi (l.6458, dans
  `addIngredient`, confirmé) ;
- compteur « Principal (N ingrédients) » de la barre latérale (`#sb-label-principal`,
  `index.html` L180, figé sur « Principal ») remis à jour ;
- **toasts de feedback — corrigé par l'audit Codex : PAS sur le stock.** L'oracle ne toaste
  QUE sur panier et suppression (`toggleCart` l.4730, `deleteIngredient` l.4752) ;
  `toggleStock` (l.4713-4722) n'a jamais toasté dans l'oracle, même en repli sur stock. La
  fiche initiale disait « stock/panier/suppression » à tort. `toast()` existe déjà
  (`src/utils/dom.js:53-66`) mais `toggleCart`/`deleteIngredient` (`src/actions.js`) ne
  l'appellent pas encore (seule `togglePin` le fait déjà) — **ne pas ajouter de toast à
  `toggleStock`** ;
- remise à zéro de `shoppingSource` : **citation oracle corrigée** — l.4724-4751 de la fiche
  initiale est FAUSSE (cette plage couvre `toggleCart`/`togglePin`/`deleteIngredient`, aucun
  ne touche `shoppingSource`). Les VRAIS resets sont **l.4719** (dans `toggleStock`, l'article
  redevient en stock) et **l.4826** (dans `removeFromCart`, retrait manuel). Vérifier ces deux
  lignes avant d'écrire, pas la plage citée initialement ;
- emoji deviné pour les ingrédients hors stock (`autoEmoji(val)` au lieu de « ✨ » fixe —
  confirmé existant tel quel, `src/utils/helpers.js:119-124`) ;
- suppression de la clé API possible : champ vidé + Sauver → clé effacée, toast « Clé API
  supprimée » (le monolithe l'acceptait, l.6589-6594, aucune garde ; l'actuel — vraie
  fonction câblée `saveApiKey()`, `js/app.js:2273-2282` — bloque avec un toast d'erreur et
  ne touche pas la clé existante. **Attention** : ne pas confondre avec l'orpheline
  `saveApiKey(key)` de `src/actions.js:166-169`, jamais appelée, code mort à ne pas toucher
  dans ce lot — pare-feu A/B).

**Risque critique — non-régression LOT 007 (confirmé et cartographié)** : `.mh-icons`
(`index.html` L236-249, conteneur des icônes mobiles) contient **`#sync-indicator-mobile` en
premier enfant**. C'est EXACTEMENT le nœud que l'oracle réécrit en bloc
(`mhIcons.innerHTML = html`, oracle l.4577). Si la restauration reproduit ce remplacement en
bloc sans réinjecter le balisage sync EXACT (id `sync-indicator-mobile` + structure interne
`.sync-icon-svg`/`.sync-label`) à chaque régénération, deux issues possibles : (a) un sync en
cours ou une erreur persistante affichée par `setSyncStatus` est silencieusement réinitialisée
à chaque changement de vue, ou (b) si l'id/la classe changent, `setSyncStatus` devient un
no-op silencieux (voyant mort, aucune erreur JS). **Préférer une mise à jour chirurgicale de
`.mh-icons`** (ne toucher que les nœuds hors sync) à un `innerHTML =` global. Les voyants
desktop (`#sync-indicator-desktop`, sidebar) et le panneau Réglages (`#info-*`) sont dans des
conteneurs DOM séparés — risque uniquement d'oubli d'appel (`renderCurrentView`,
`js/app.js:571-595`, appelle déjà `renderTopbar` L580 ET `updateApiStatus()` L582 à la
suite : les deux doivent rester appelés).

**Autre point noté, non touché dans ce lot (pare-feu A/B)** : `switchView` a une définition
morte en doublon dans `src/actions.js:8-12` (dispatche un `CustomEvent('viewChanged')` que
personne n'écoute) — la vraie est `js/app.js:599-603`, exposée globalement. Ne pas confondre
les deux, ne pas « nettoyer » le doublon ici (candidat LOT 014).

### D. Styles jamais créés (nouveau code, pas des pertes)

- `.add-results-list` / `.add-res-item` (autocomplétion du formulaire d'ajout — citations
  périmées corrigées : conteneur **`index.html:629`** (pas 645), génération des lignes
  **`js/app.js:1773` (`handleAddInput`) et `:1797`** (pas 992)) : créer le style — lignes
  cliquables avec padding, survol, séparation. CSS actuellement inexistant (0 règle) ; le
  HTML généré mélange emoji+nom en deux nœuds texte bruts dans le même `<div class="add-res-
  item">` (pas de `<span>` séparés) — à garder en tête si un style différencié est voulu ;
- `.tb-btn.small` (**`src/ui/recipe.js:246`**, pas 49 — bouton « Estimer le Nutri-Score ») :
  créer la variante réduite OU retirer la classe d'intention — pas de classe morte. Base
  `.tb-btn` existante (`css/style.css:329-344`) avec des variantes sœurs déjà là
  (`.primary`, `.terra`, l.352-366) comme patron à suivre pour `.small`.

## Pièges connus

- Zone du sélecteur = zone du LOT 006 : tests de non-régression sur le pré-cochage avant/après.
- Le retour auto à l'inventaire ne doit PAS casser l'enchaînement d'ajouts : le formulaire se
  réinitialise déjà (LOT 006) — reproduire le comportement du monolithe tel quel (500 ms).
- `renderTopbar` (pas `updateTopbar` — ce nom n'existe pas côté migré) est appelée par
  `renderCurrentView` (`js/app.js:580`), pas directement par `switchView` : vérifier chaque
  vue après (6 vues : pantry/shopping/ai/favorites/export/add, × bureau/mobile).
- La barre supérieure et le header mobile portent les **voyants de synchro et d'état réseau
  posés par le LOT 007** : ÉTENDRE la fonction existante sans les écraser (rappel d'audit de
  campagne, Gemini 3.6 Flash) — **risque cartographié précisément en découverte, cf. §C** :
  ne jamais faire un `innerHTML =` global sur `.mh-icons` sans réinjecter le balisage exact
  de `#sync-indicator-mobile`, sous peine de voyant réinitialisé ou mort silencieusement.

## Audit de spec (2026-07-30)

**Codex 5.6 Terra, niveau medium (auditeur par défaut) — VERDICT : GO, niveau Standard
confirmé.** Aucun défaut critique ; 3 précisions « À CORRIGER · durcissement », toutes
vérifiées contre le vrai code avant intégration (une s'est révélée plus importante que son
libellé ne le laissait penser) et intégrées directement dans le §Périmètre ci-dessus :

1. **FAB en double** — la plus significative. Le vrai FAB oracle (`#fab-add`) est en fait
   **déjà restauré et déjà correct** dans le code actuel (`index.html:718` +
   `js/app.js:591`) ; ma phase découverte l'avait raté (elle n'avait grepé que
   `topbar-add-btn`, jamais `fab-add`). Le vrai correctif est de **retirer**
   `#topbar-add-btn` (artefact de migration sans équivalent oracle), pas de lui ajouter une
   bascule comme je le pensais avant l'audit.
2. **Toasts** — l'oracle ne toaste jamais sur `toggleStock`, seulement panier/suppression ;
   la fiche initiale (« stock/panier/suppression ») était imprécise.
3. **Titres/sous-titres** — table exacte de l'oracle absente de la fiche initiale, alors que
   le texte actuel divergeait déjà (« Mes Courses » vs « Liste de courses », etc.) : risque
   réel de improvisation au moment d'écrire le code. Table transcrite mot pour mot.

Confirmations utiles (pas de changement de plan, juste validées) : retrait du `<label>`
(Zone A) sain et fidèle à l'oracle ; extension de `buildEmojiEditSuggestions` sûre si la
signature à un seul argument reste inchangée ; retrait de `isMissing`/`matchedName`/`isExact`
au push dans `state.ingredients` sain (aucun consommateur en aval, vérifié par grep) — avec
la nuance « input absent vs vidé volontairement » ci-dessus ; les deux nouvelles lignes
`shoppingSource` (l.4719/l.4826) confirmées ; la mise à jour chirurgicale de `.mh-icons`
(plutôt que l'`innerHTML=` global de l'oracle) confirmée nécessaire — et sa raison profonde
désormais comprise : le voyant de synchro de l'oracle est STATIQUE (jamais d'état
thinking/error), celui du LOT 007 est dynamique. Porter le remplacement en bloc de l'oracle
casserait un comportement que l'oracle lui-même n'a jamais eu à préserver.

## Plan de test

- [ ] Unitaires : `cycleEmoji` (cycle circulaire, liste de secours, réutilise
      `buildEmojiEditSuggestions`) ; validation du sélecteur avec nom/emoji édités ;
      `autoEmoji` sur extra ; bascule `hidden` du FAB ＋ selon la vue ; resets
      `shoppingSource` (stock retrouvé + retrait panier) ; **voyant de synchro
      (`#sync-indicator-mobile`) qui SURVIT à un changement de vue pendant un état
      `thinking`/`error`** — le point le plus à risque de la zone C, cf. §C ;
      toasts panier/suppression émis (PAS stock) ; titres/sous-titres = table oracle §C
      au caractère près
- [ ] Manuels (Joel, mobile ET bureau) : 🎲 change l'emoji ; nom corrigé conservé dans la
      liste ; Entrée partout ; filtres scrollables au doigt ; barre supérieure contextuelle
      sur les 6 vues (pantry/shopping/ai/favorites/export/add) ; retour auto après ajout ;
      suppression de clé possible ; ＋ flottant visible seulement sur l'inventaire ; **un
      SEUL bouton ＋ visible sur l'inventaire** (pas de doublon `topbar-add-btn`/`fab-add`)

## Critères d'acceptation

- [ ] Validation unifiée verte + build OK ; audit Léger/Standard rendu
- [ ] Cocher les points §3 dans la fiche régressions — **fin de la restauration : tous les
      points §1-§4 de la fiche doivent être cochés ou explicitement reportés**

## Traçabilité

- Origine : fiche régressions §3 — balayage 2026-07-29 ; `cycleEmoji` signalé aussi par
  Gemini 3.1 Pro
- Dépend de : LOT 011 (ordre de campagne)
- Phase découverte : 2026-07-30, 3 agents Explore, 8 citations périmées corrigées + 3
  découvertes hors fiche initiale (détail en tête de fiche et §Périmètre)
