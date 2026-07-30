# LOT 014 — Refonte SSOT et découpage — SPÉCIFICATION

> **Statut :** ⚪ PLANIFIÉ — DERNIER lot de la campagne, après le LOT 013 (prérequis DUR)
> **Branche à créer :** `feat/lot14-refonte-ssot`
> **Niveau d'audit : DUR** — refonte transverse, touche le moteur d'état
> **Effort estimé :** ~2-3 journées · **Version visée :** 5.9
> **Fusion de 3 fiches backlog promues le 2026-07-29** : `Decoupage app.js et style.css` +
> `Alias state fragile` + `Validation des donnees externes` (contenus repris ci-dessous) +
> volet SSOT demandé par Joel.

---

## Objectif

L'app restaurée fonctionne à 100 % (LOTS 007-012) et son comportement est figé par les tests
(LOT 013). Ce lot rend le code **propre, SSOT partout, facile à comprendre et à maintenir** —
la demande de fond de Joel — SANS changer un seul comportement observable.

**Pare-feu A/B absolu (`CLAUDE.md` §5) : zéro changement de comportement.** Chaque étape se
termine par la validation unifiée verte. Toute envie de « corriger en passant » = fiche
backlog, pas de code.

**⚠️ La leçon qui gouverne ce lot : la dernière réorganisation massive de ce code (la
migration Vite) a perdu ~30 comportements.** D'où : LOT 013 obligatoire avant, étapes
livrées UNE PAR UNE, validation après chacune, et l'inventaire des régressions comme
check-list de non-régression finale.

## Périmètre

### A. Découpage de `js/app.js` (ex-fiche SPLIT_APP_JS, actualisée)

`js/app.js` fait **2 810 lignes** (mesuré le 2026-07-30, découverte du LOT 013 — la fiche
annonçait « ~1500 avant campagne », soit **+87 %** après les restaurations). Cible :
**un orchestrateur fin (< 700 lignes) + N modules métier.**

**Précisions issues de la découverte du LOT 013 (vérifiées `fichier:ligne`)** :
- `js/app.js` est un module ESM **plat** : au niveau racine il n'y a que **4 instructions
  exécutables** (`js/app.js:60-93` le handler `DOMContentLoaded`, `:95-98` l'écouteur
  `stateUpdated`, `:2191` `window._onManualCategoryChange`, `:2788` `expose({...})`).
  Aucun IIFE, aucun top-level await, aucun `import()` dynamique.
- Deux contrats publics coexistent : le bloc **`export {}`** (`js/app.js:538-597`, **54 noms**,
  « exportés UNIQUEMENT pour les tests ») et le bloc **`expose({})`** (`js/app.js:2788-2810`,
  **44 noms** sur `window`). Le découpage doit préserver **les deux**.
- Le vrai obstacle n'est pas les fonctions mais l'**état de module** : ~25 variables `_*`
  (`js/app.js:29-41`, `:117-133`, `:1038-1049`, `:1904`, `:2569`), dont **une seule** dispose
  d'une trappe de reset (`__resetSyncEngineForTests`, `js/app.js:519-534`). C'est ce qui rend
  les tests fragiles aujourd'hui (une génération laissée en vol bloque tous les tests suivants
  d'un fichier, `js/app.js:910`) — l'étape 5 ci-dessous est donc la plus rentable.

Étapes héritées de la fiche d'origine — à re-vérifier sur l'état réel du code, plusieurs
points ont pu être résolus par les LOTS 005-012 :
1. `CAT_EMOJI` dupliquée → vérifier : `CATEGORIES_WITH_EMOJI`/`getCategoryEmoji` existent
   déjà dans `src/data.js` (LOT 006). S'il reste une map locale dans `app.js`, la supprimer
   (3 recherches convergentes avant : appel direct, accès dynamique, config annexe) ;
2. logique « confirmer si similaire » dupliquée entre `addIngredient` et
   `addIngredientFromDb` → extraire `src/utils/dedup.js::confirmIfSimilar` ;
3. `guessCategoryLocally`/`sanitizeCategory` → `src/utils/categorize.js`, mots-clés dérivés
   de `DEFAULT_DB` quand possible (au lieu de listes en dur — SSOT) ;
4. `exportClipboard` → `src/services/exports.js` (fonction pure + wrapper toast) ;
5. formulaire d'ajout → `src/ui/addForm.js` : encapsuler l'état de module épars
   (`_isManualCategory`, `_localCategoryFill`, `_addSuggestTimer`, `_aiSuggestGenId`…) dans
   un état privé de module avec `reset()` appelé par `switchView` ;
6. modales recette/sélecteur → `src/ui/recipeModal.js` : encapsuler `_currentPickerData`,
   `_lastTransformedRecipe`, `_currentEditingIngId`… ;
7. le moteur de synchro du LOT 007 (s'il vit dans `app.js`) → `src/services/sync.js`.

Critère par étape : `expose()` reste complet (les `onclick` d'`index.html` sont le contrat
public — les 36 fonctions inventoriées au balayage du 2026-07-29 doivent toutes rester
branchées), tests verts, build OK.

### B. Alias `state` fragile (ex-fiche dédiée, reprise intégrale)

`setState` (`src/state.js`) **réassigne** l'état ; `js/app.js` garde un alias local compensé
par des `state = moduleState` manuels. Qu'un futur `setState` oublie la compensation et l'app
travaille sur des données périmées, sans aucun signal.

**Option A retenue (recommandation de la fiche d'origine) : muter au lieu de réassigner** —
`Object.assign(state, partialState)` + suppression de TOUS les `state = moduleState`
compensatoires. Condition de la fiche d'origine à démontrer par un test : équivalence stricte
sur `aiConfig` (remplacement entier, pas de fusion profonde — comportement actuel à
conserver) et sur les tableaux. Au moindre écart observable → STOP, ça devient une spec.

### C. Validation des données externes — CHANGEMENT DE COMPORTEMENT ASSUMÉ

⚠️ **Exception au pare-feu A/B de ce lot** (l'audit de campagne Codex a relevé la
contradiction : « zéro changement observable » + « rejets de données » sont incompatibles).
Ce volet C introduit des comportements NOUVEAUX — des rejets de données invalides — validés
par Joel via cette spec. Tout le reste du lot reste à zéro changement observable. **Livrer
ce volet dans un commit SÉPARÉ des volets de refonte**, pour qu'un problème se revert seul.

Créer `src/utils/validate.js` (léger, zéro dépendance). **Règles COMPLÈTES — la fiche
backlog d'origine a été supprimée à la promotion, cette fiche est la SEULE référence
(correction d'autonomie, audit Codex)** :
- `isValidIngredient(i)` : objet avec `id` string, `name` string, `category` string ;
- `isValidRecipe(r)` : objet avec `name` string de moins de 200 caractères ; `ingredients`
  et `steps` soit absents, soit tableaux ;
- `isValidAiConfig(c)` : objet ; `apiKey` absente ou string ;
- `validateState(s)` : objet ; **`ingredients` PRÉSENT et tableau — c'est l'invariant du
  garde §4.9 du LOT 007, que cette couche généralise** ; `favorites` et `extraIngredients`
  absents ou tableaux ; `aiConfig` absent ou valide ;
- `escapePromptValue(str)` : échappe `\` et `"`, remplace les sauts de ligne par des
  espaces, tronque à 100 caractères.

Application — périmètres STRICTS :
- `syncPull` rejette un document cloud qui échoue `validateState` (REMPLACE le garde minimal
  du LOT 007, ne pas empiler deux gardes — l'invariant `ingredients` ci-dessus le couvre) ;
- `loadState` ignore un localStorage corrompu (état par défaut conservé, warning console) ;
- `transformRecipeAI` refuse une recette IA qui échoue `isValidRecipe` (toast explicite) ;
- `escapePromptValue` s'applique **UNIQUEMENT au champ ingrédient du formulaire d'ajout**
  (`handleAddInput` → prompts de catégorie/emoji). **JAMAIS au texte de recette collé ni à
  aucun contenu long** : tronquer une recette à 100 caractères détruirait la fonctionnalité
  de collage (audit Codex).

### D. Traque SSOT transverse (demande de Joel)

Balayage systématique, `grep` à l'appui, avec correction ou fiche backlog par trouvaille :
- `.generate-btn` défini 2× dans `css/style.css` (l.1503 et l.3506 avec `!important`) —
  fusionner ;
- doublon connu : le squelette statique du modal recette vs rendu dynamique (traité au
  LOT 009 — vérifier qu'il n'en reste rien) ;
- chaque constante métier (catégories, seuils, libellés récurrents, clés localStorage,
  plafond des épinglés du LOT 010…) : UNE représentation canonique, les autres dérivées ;
- règle de sortie : `grep` de contrôle documenté dans le commit pour chaque duplication
  traitée.

### E. Découpage de `css/style.css` (~3700 lignes) et CSS mort

- Découper en feuilles par domaine (base/layout, inventaire, courses, IA/recettes, modales,
  réglages) importées dans l'ordre actuel — **l'ordre des règles CSS est un comportement** :
  le préserver strictement ;
- CSS mort : suppression UNIQUEMENT avec 3 recherches convergentes par sélecteur.
  **⚠️ NE PAS supprimer `.r-tag` ni les styles réactivés par la campagne** (`.picker-magic-btn`,
  `.emoji-edit-btn`, `.sync-indicator.*`, `mh-*`/`rd-*`) — l'ancien plan (`CURRENT_GOAL.md`
  d'avant campagne) les croyait morts, les LOTS 007-012 les ont rebranchés.

### G. Suppression des « articles libres » — CHANGEMENT DE COMPORTEMENT ASSUMÉ

⚠️ **Deuxième exception au pare-feu A/B de ce lot**, au même titre que le volet C.
**Décidé par Joel le 2026-07-30** (« et si on effaçait ces articles libres, et qu'on n'en
parlait plus »), après avoir constaté que la fonction ne lui sert pas. **À livrer dans un
commit SÉPARÉ**, comme le volet C.

**Ce que c'est :** `state.customCartItems` — des articles ajoutés à la liste de courses sans
passer par l'inventaire. Dans l'oracle, ils étaient créés depuis la recherche
(`foodapp-v5-Joel.html:6107-6115`, `addCustomCartItemFromSearch`). **L'oracle lui-même les
marquait « Deprecated »** (`foodapp-v5-Joel.html:4237` et `:4295`).

**État actuel (découverte du LOT 013, vérifié sur pièce) :** conservés, synchronisés,
sauvegardés, effacés par les resets et **copiés** — mais **jamais affichés** (`renderShopping`,
`js/app.js:818-824`, ne passe que `state.ingredients.filter(i => i.inCart)`) et **impossibles
à créer** (aucun portage de `addCustomCartItemFromSearch`). C'est donc un vestige à demi
branché, pas une fonctionnalité.

**Pourquoi ici et pas au LOT 013 :** supprimer un champ tissé dans la synchro, la sauvegarde,
les resets et la copie **est un déplacement de code**. La leçon qui gouverne la campagne est
qu'on ne déplace pas de code sans filet — le faire pendant le lot qui *construit* le filet
inverse l'ordre que toute la campagne existe pour imposer.

**Inventaire complet des sites à traiter (8 en production, 9 fichiers de tests) :**

| Site | Rôle |
|---|---|
| `src/state.js:36` | valeur par défaut |
| `src/state.js:179` | garde `if (!state.customCartItems) … = []` |
| `src/constants.js:34` | entrée dans `BACKUP_STATE_KEYS` (périmètre du fichier de sauvegarde) |
| `src/services/firebase.js:19` | entrée dans `SYNC_ARRAY_KEYS` |
| `src/actions.js:99` | `resetCart()` |
| `src/actions.js:131` | reset global |
| `js/app.js:1629-1640` | rubrique `[ ARTICLES LIBRES ]` de la copie (LOT 015) + comptage du toast |
| `src/actions.js:80`, `:86` + `src/ui/shopping.js:19`, `:32` | **paramètre `type` mort** de `toggleShoppingCheck` / `removeFromCart` : `removeFromCart` l'ignore totalement et ne cherche que dans `state.ingredients` (vérifié — aucun bug actif, mais le paramètre ne sert plus à rien) |

**Tests impactés** (57 occurrences sur 9 fichiers) : l'essentiel est du décor (la remise à
zéro de `state` cite la clé), **sauf `tests/export-clipboard.test.js` (24 occurrences)** qui
contient les tests dédiés du LOT 015 : rubrique `[ ARTICLES LIBRES ]` placée en fin, article
sans nom exploitable ignoré, gardes de type (`{0:{}}`, string, 42, null), toasts chiffrés
incluant les articles libres. Ces tests sont à **supprimer**, pas à contourner.

**Effets à annoncer à Joel avant livraison :** sa liste de courses copiée cessera d'inclure
son « porc haché » (seul endroit où il était encore visible) ; les fichiers de sauvegarde
créés après ce lot ne porteront plus le champ ; le document cloud gardera une copie périmée
du champ, simplement plus lue.

**Discipline** : 3 recherches convergentes par site (appel direct, accès dynamique, config
annexe) avant tout retrait, conformément à `CLAUDE.md` §5.

### F. Verrous anti-récidive

- **Verrou imports ESM** (arbitrage parqué depuis le LOT 002) : test qui échoue si un import
  relatif omet l'extension `.js` ;
- **Verrou parité** : test qui échoue si une fonction référencée par un `on*=` d'`index.html`
  n'est pas exposée sur `window` (aurait détecté une partie des casses de la migration) ;
- `PROJECT_MAP.md` mis à jour (nouveaux modules) — le verrou de fraîcheur pytest y veille.

## Ordre d'exécution et livraison

Étapes livrées séquentiellement (B → C → **G** → A → D → E → F recommandé — B d'abord car il
simplifie A ; **G tôt** car il retire du code que A/D/E devraient sinon déplacer pour rien),
**un commit par étape aboutie**, validation unifiée verte à chaque commit.
Pas de « grand soir » : si une étape déraille, on la revert seule.
**C et G sont les deux seuls volets à changement de comportement : commits séparés, isolés
des volets de refonte pure.**

## Critères d'acceptation

- [ ] `js/app.js` < 700 lignes ; plus aucune variable `_*` de module dans `app.js`
- [ ] Plus aucun `state = moduleState` compensatoire
- [ ] `validate.js` en place sur les 3 portes (cloud, localStorage, IA)
- [ ] **Volet G soldé** : plus aucune occurrence de `customCartItems` dans `js/` ni `src/`
      (`grep` de contrôle documenté dans le commit) ; paramètre `type` mort retiré de
      `toggleShoppingCheck`/`removeFromCart` ; tests du LOT 015 dédiés aux articles libres
      supprimés, pas neutralisés
- [ ] Zéro duplication SSOT connue restante (liste D soldée ou en fiches backlog)
- [ ] Les 2 verrous anti-récidive en place et rouges quand on les provoque
- [ ] Validation unifiée verte, build OK, **check-list de la fiche régressions re-parcourue
      intégralement** : aucun comportement restauré n'a re-disparu
- [ ] **Oracle visuel après le découpage CSS (audit Codex + leçon gravée du LOT 005)** :
      preuve NAVIGATEUR avant/après pour les 5 vues ET les modales (détail de recette,
      sélecteur, icône, API), en bureau ET en mobile. jsdom ne prouve ni cascade, ni
      géométrie, ni plein écran ; « le texte des règles est présent dans le fichier » n'est
      pas une preuve (incident du commentaire CSS, LOT 005).
- [ ] Audit DUR final de campagne

## Traçabilité

- Fiches d'origine (supprimées à la promotion, contenus repris) :
  `Backlog/BACKLOG - Decoupage app.js et style.css.md`, `Backlog/BACKLOG - Alias state
  fragile.md`, `Backlog/BACKLOG - Validation des donnees externes.md` — sources
  `ULTRA_AUDIT_REPORT.md` (audits #1 et #2)
- Prérequis : LOT 013 (filet de tests) — NON NÉGOCIABLE
- Clôture la campagne « Restauration & Refonte »
