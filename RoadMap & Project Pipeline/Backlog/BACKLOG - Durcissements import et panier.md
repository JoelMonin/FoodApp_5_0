# BACKLOG — Durcissements import et panier (réserves non bloquantes de l'audit LOT 008)

> **Origine :** audit Dur du LOT 008 par Codex 5.6 (Sol), 2026-07-29. Findings tagués
> DURCISSEMENT, explicitement non bloquants — consignés ici plutôt que corrigés en
> passant (discipline `CLAUDE.md` §5 : pas de « correction en passant » hors spec).
> **Priorité :** basse. À regrouper avec un lot de la campagne s'il touche la zone
> (LOT 013 pour les tests, LOT 014 pour le reste), sinon après la campagne.

## 1. Ambiguïté de l'import par nom quand deux ingrédients partagent un nom

`importStockOnly` (`src/actions.js`) replie sur `areSimilar` par nom seul quand l'id d'une
entrée du fichier est inconnu. Or le catalogue contient légitimement deux « Haricot (rouge) »
(sec `pa7` / conserve `re_ing_17745578567330`) : une vieille sauvegarde dont les ids ont
changé pourrait appliquer le statut de la conserve au haricot sec.

- **Cas conditionnel** : ne se déclenche pas avec les fichiers actuels (ids concordants).
- **Piste** : préférer une correspondance de même catégorie quand plusieurs noms matchent.
- **Attention** : le monolithe (oracle, l.6517-6562) matchait par nom seul — ce durcissement
  dépasse l'oracle, donc changement de comportement à assumer explicitement (pare-feu A/B).
- Ajouter un test avec deux ingrédients homonymes de catégories différentes.

## ⛔ §2 et §3 — TRANCHÉS LE 2026-07-30 : les articles libres seront SUPPRIMÉS

**Décision de Joel** (découverte du LOT 013) : les articles libres ne sont ni voulus ni
utiles ; ils disparaissent au lieu d'être rebranchés. → **volet G du LOT 014**, où l'inventaire
complet (8 sites de production, 9 fichiers de tests) est déjà rédigé.

Les §2 et §3 ci-dessous sont **conservés pour la trace** (règle « rien ne se supprime ») mais
**ne sont plus des chantiers ouverts** : ils décrivent l'état d'avant la décision, et leur
résolution est désormais « retrait », pas « rebranchement ». Le §4 premier point (divergence
entre appareils) tombe mécaniquement avec eux.

## 2. `removeFromCart` ne reproduit pas l'oracle complet (articles libres)

L'oracle (monolithe l.4821-4832) distinguait `type === 'db'` (ingrédient : `inCart = false`
+ `shoppingSource = null`) du reste (article libre : retrait de `customCartItems`). La
version actuelle ignore `type`, ne retire pas les articles libres et ne remet pas
`shoppingSource` à null.

- **Non bloquant aujourd'hui** : le renderer modulaire ne passe que des ingrédients DB à
  cette fonction, le paramètre `type` est documenté comme fantôme.
- ⚠️ **Mise à jour 2026-07-30 :** le LOT 012 (clôturé en 5.7) a bien remis
  `shoppingSource = null` dans `removeFromCart`, mais **n'a pas** rebranché le retrait des
  articles libres. Ce point reste donc ouvert, et il est lié au §3 ci-dessous.

## 3. Les articles libres n'ont plus aucune interface (constat du LOT 015)

`state.customCartItems` est un champ **fantôme** : aucun code ne l'écrit ni ne l'affiche
depuis la migration, alors que la donnée existe réellement chez Joel et fait des
allers-retours cloud complets (`src/services/firebase.js:19`).

- Le LOT 015 **cesse de les ignorer à la copie** (son chantier 3) mais ne rebranche
  volontairement **aucune** interface — c'était hors périmètre.
- **Bonne nouvelle pour le futur lot** : le rendu existe déjà. `src/ui/shopping.js:7-11`
  sait afficher un article `source: 'ai-extra'` avec son tag `🛍 hors stock` — il ne reçoit
  simplement jamais ces objets.
- Manquent donc : l'ajout (l'oracle l'avait en l.6107-6114, mais **déjà mort chez lui**) et
  le retrait (§2 ci-dessus).
- ⚠️ Ces objets ne sont **jamais normalisés** (`sanitizeGlobalState` garantit seulement que
  le tableau existe, `src/state.js:153`) : pas de `name` garanti, pas de `category`. Tout
  rebranchement devra poser cette normalisation.

## 4. Deux comportements de synchro signalés par l'audit Gemini du LOT 015 (2026-07-30)

Antérieurs au LOT 015 et **non aggravés** par lui — consignés ici plutôt qu'absorbés dans
un lot déjà plus lourd que prévu.

- **Divergence des articles libres entre deux appareils.** Si l'appareil A vide le panier
  (`resetCart`) pendant que l'appareil B a des modifications en attente, l'envoi de B
  réinjecte son ancien `customCartItems` dans le cloud : au pull suivant, les articles
  réapparaissent sur A. C'est le comportement « dernier écrivain gagne » du LOT 007 appliqué
  à un tableau entier, pas un défaut propre à un lot.
- **Restauration hors ligne puis reconnexion.** Restaurer une sauvegarde sans réseau planifie
  un envoi qui échoue ; il faut garantir qu'à la reconnexion c'est bien l'état **restauré**
  qui part, et non l'ancien contenu cloud qui revient l'écraser. Le moteur du LOT 007 a une
  reprise sur échec, mais ce scénario précis n'est couvert par **aucun test**.

## 5. Zones mortes relevées par la découverte du LOT 013 (2026-07-30)

Trois constats vérifiés sur pièce pendant la phase découverte. **Aucun n'est un défaut visible
par Joel** — ce sont des candidats au nettoyage du LOT 014, consignés ici pour ne pas être
retrouvés une quatrième fois.

- **La modale « ajout groupé » n'est ouverte par personne.** `#modal-shopping-bulk`
  (`index.html:23-39`, 2 ids et 3 `onclick`) n'a aucun appelant : recherche exhaustive dans
  `js/`, `src/` et `tests/` — les seules références sont `js/app.js:72` (liste générique des
  overlays), `:2265`, `:2272`, `:2740`. Pire, son gestionnaire `confirmBulkAdd`
  (`js/app.js:2267`) lit `cb.dataset.id`, un `data-id` que **personne n'écrit** : même ouverte
  à la main, elle ne fonctionnerait pas. → LOT 014 §E/§D, avec 3 recherches convergentes.
- **`sanitize()` n'est appelée nulle part.** `src/utils/dom.js:41` n'a d'appelant que
  `tests/dom.test.js:35`. Renforcer ses tests reviendrait à tester du code mort — c'est
  pourquoi le LOT 013 ne le fait pas. → LOT 014.
- **Le 3ᵉ pied de page du détail de recette est inatteignable.** `src/ui/recipe.js:173-176`
  couvre une source ≠ `ai`/`fav` (« 💾 Sauver » / « 🛒 + Liste »), or `openRecipeDetail`
  (`js/app.js:1086-1097`) ne produit que ces deux sources et `renderRecipeModal`
  (`js/app.js:1077-1083`) en est le seul appelant. C'est ce qui rend caduque la ligne
  « 1 test par source (ai/fav/paste) » de la fiche LOT 013 d'origine. → LOT 014.

## 6. Neuf temporisations du code ne sont couvertes par aucun test (constat LOT 013)

La découverte a relevé **20 temporisations** dans le code applicatif là où la fiche LOT 013
n'en citait que 3. Onze sont couvertes. Les neuf autres — 10 ms (apparition du toast,
`src/utils/dom.js:61`), 100 ms ×2 (`js/app.js:941-945`, `:2781`), 300 ms
(`src/utils/dom.js:64`), 800 ms (suggestion IA d'ajout, `js/app.js:2135`→`:2187`), 1800 ms
(`src/actions.js:172`), 3000 ms (durée d'un toast, `src/utils/dom.js:62`), 10 000 ms (retry
de synchro, `js/app.js:113`), 60 000 ms (pull périodique, `js/app.js:114`) — n'ont aucun
verrou. Le LOT 013 en traite une partie (les 800 ms sont dans son périmètre via
`handleAddInput`) ; le reste reste ouvert.

## 8. L'ordre « rendu local avant réseau » du démarrage n'est pas prouvé par un test

Constat de l'audit adversarial du LOT 013 (2026-07-30) : contrairement à ce que documentait
d'abord la matrice de couverture du lot, jsdom **peut** en théorie prouver cet acquis (LOT 005,
#1) — l'auditeur a vérifié empiriquement que `window.dispatchEvent(new Event('DOMContentLoaded'))`
déclenche bien le handler de démarrage de `js/app.js:60` sous Vitest, même après que
`document.readyState` soit passé à `'complete'`.

- **Non fait dans le LOT 013** : le handler enchaîne ~10 initialisations avec effets de bord
  réels (appels réseau non mockés par défaut, `setInterval` de synchro, écouteurs
  clavier/tactiles) — les neutraliser correctement pour isoler la seule question « le rendu
  local précède-t-il toute attente réseau » dépassait le temps disponible pour ce lot.
- **Piste pour le LOT 014** : dispatcher `DOMContentLoaded` avec `fetch` stubé en promesse
  jamais résolue, vérifier que `#ing-grid` contient déjà les ingrédients AVANT que la
  promesse ne soit levée.

## 7. Le câblage du démarrage est structurellement hors de portée des tests

`DOMContentLoaded` **ne se déclenche jamais** sous Vitest (`document.readyState === 'complete'`
avant l'import du module — vérifié empiriquement en découverte du LOT 013). Conséquence : le
contenu du handler `js/app.js:60-93` — l'ordre dans lequel le démarrage appelle
`loadStateFromModule`, `renderCurrentView`, `restoreAIConfig`, `initKeyboardShortcuts`,
`initSyncEngine`, les 6 `initSwipeToClose`… — n'est prouvable que par lecture ou preuve
navigateur. Les fonctions elles-mêmes sont testables une à une (elles sont exportées) ; c'est
**le câblage** qui ne l'est pas. À traiter par un verrou de parité au LOT 014 §F, ou à assumer
comme angle mort documenté.

## Traçabilité

- Audit source : NO-GO Codex 5.6 sur `f7d11ec`, corrigé en `2483c06` (les deux findings
  CRITIQUES — reset incomplet, export versionné — ont été traités ou levés par Joel ;
  cette fiche ne porte que les DURCISSEMENTS résiduels).
- Les deux autres durcissements du même audit ont été traités à la clôture du lot :
  test d'ordre push→reload durci (résolution prouvée, pas seulement l'invocation) ;
  `exportJSON` aligné sur l'oracle (`URL.revokeObjectURL` + toast « 💾 Export téléchargé »).
