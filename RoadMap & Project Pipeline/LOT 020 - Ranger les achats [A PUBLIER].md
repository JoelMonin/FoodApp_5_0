# LOT 020 — Ranger les achats — SPÉCIFICATION

> **Statut :** 🟡 A PUBLIER — ouvert ET terminé le 2026-08-01 (attend le feu vert de Joel)
> **Branche :** `feat/lot20-ranger-les-achats` (depuis `main`, V5.12 publiée)
> **Niveau d'audit : Standard** — ajout de fonctionnalité + correction d'un défaut existant,
> dans une zone déjà couverte par des tests (`shopping-list-render`, `actions-data` §F7)
> **Version visée :** 5.13
> **Origine :** demande de Joel au retour de ses courses (2026-08-01)

---

## 1. Le besoin, dans ses mots

> « un bouton qui permet de vider la liste de courses des éléments cochés comme ayant été
> achetés, et qui fait en sorte que ces ingrédients achetés se marquent comme en stock
> (attention au cas où j'avais encore du stock) »

**C'est une fonctionnalité NEUVE, pas une restauration.** Vérifié dans l'oracle : il ne
connaît que `resetCart` (« 🗑️ Vider », `foodapp-v5-Joel.html:4555` et `:6565`), qui vide TOUT
sans jamais toucher au stock. Rien n'existe nulle part pour « ranger ce que j'ai acheté ».
L'oracle n'est donc pas la référence ici — c'est une décision produit de Joel.

**Réponse au point « attention au stock »** : le cas est sans danger, et pour une raison
précise — l'app ne connaît pas les quantités, seulement un oui/non `inStock`. Un article
qu'on avait déjà ET qu'on rachète reste simplement « en stock ». Rien à additionner, rien à
écraser. Le vrai risque est humain (cocher un article qu'on n'a pas trouvé), traité au §4.

---

## 2. Le comportement attendu

Une **barre qui apparaît en bas de la liste dès qu'au moins un article est coché**, annonçant
le compte exact : « 🏠 Ranger mes 3 achats ». Un appui, et pour **chaque article coché** :

| | Avant | Après |
|---|---|---|
| `inStock` | peu importe | **`true`** |
| `inCart` | `true` | **`false`** (il quitte la liste) |
| `shoppingSource` | ex. « Tarte aux pommes » | **`null`** (la recette est oubliée) |
| coche (`shoppingChecked`) | présente | **retirée** |

**Les articles NON cochés ne bougent pas.** C'est toute la différence avec « 🗑️ Vider », qui
reste inchangé à côté et garde son rôle de remise à zéro brutale.

**SSOT — la règle du passage en stock ne s'écrit pas deux fois.** Ces quatre effets sont
exactement ceux que produit déjà `toggleStock` quand un article redevient disponible
(`src/actions.js:18-30`, hérité de l'oracle l.4719). Le lot **extrait cette règle dans un
helper unique** (`_passerEnStock`) utilisé par les deux chemins, plutôt que d'en recopier une
seconde version.

**Aucun re-rendu manuel** : `saveState()` émet `stateUpdated`, que `js/app.js:216` écoute pour
relancer `renderCurrentView()` — la liste et les pastilles de comptage se remettent à jour
seules. Ne pas rajouter d'appel de rendu dans l'action.

---

## 3. Le défaut existant à corriger — LA COCHE FANTÔME

**Trouvé pendant la découverte, corrigé sur demande explicite de Joel**, dans un **commit
séparé et EN PREMIER** (le pare-feu A/B interdit de mélanger un correctif à une
fonctionnalité).

**Le défaut** : trois chemins sortent un article du panier, et **un seul oublie de nettoyer sa
coche**.

| Chemin | Nettoie `shoppingChecked` ? | Test |
|---|---|---|
| `toggleCart` (`actions.js:65`) | ✅ oui | `actions-data.test.js:474` |
| `removeFromCart` (`actions.js:102`) | ✅ oui | (couvert §F7) |
| `resetCart` (`actions.js:109`) | ✅ oui | `actions-data.test.js:458` |
| **`toggleStock` (`actions.js:18-30`)** | ❌ **NON** | **aucun** |

**Ce que ça produit à l'écran** : on coche « Carotte » dans la liste de courses, puis on la
marque « en stock » depuis l'inventaire. Elle quitte bien la liste (`inCart: false`), mais
**son identifiant reste dans le jeu de coches**, qui est persisté ET synchronisé. Si la
carotte revient un jour dans la liste, **elle y apparaît déjà cochée** sans qu'on ait rien
fait.

C'est le symptôme exact contre lequel le LOT 008 avait mis en garde en commentaire de
`toggleCart` (« sinon la synchro du LOT 007 diffuserait des ids fantômes ») — la garde a été
posée sur trois chemins, jamais sur le quatrième.

**Le correctif est une ligne**, absorbée par l'extraction de `_passerEnStock` du §2 : le
helper nettoie la coche, donc les deux chemins en héritent.

---

## 4. Critères d'acceptation (écrits AVANT le code)

**L'action :**
1. 3 cochés sur 8 → les 3 passent en stock et quittent la liste, **les 5 autres intacts**
   (ni `inStock`, ni `inCart`, ni coche touchés)
2. un article **déjà en stock** et coché → reste en stock, quitte la liste, aucune erreur
3. **la coche est effacée** pour chaque article rangé (pas d'id fantôme)
4. `shoppingSource` repasse à `null`
5. un article **coché mais plus dans le panier** (id résiduel) n'est PAS remis en stock —
   l'action ne travaille que sur l'intersection « dans le panier ET coché »
6. rien de coché → l'action ne change rien et ne déclenche pas de sauvegarde inutile

**La barre :**
7. 0 coché → **aucune barre** rendue
8. ≥1 coché → barre présente, libellé portant le **bon compte** (accord singulier/pluriel)
9. le compte ignore les coches fantômes (ids absents du panier), comme le fait déjà la barre
   de progression (`shopping.js:45`)
10. un clic appelle l'action une seule fois

**Le correctif :**
11. `toggleStock` (passage en stock) retire l'id du jeu de coches
12. `toggleStock` (retour en rupture) ne touche PAS aux coches ni au panier — le sens inverse
    reste strictement inchangé

---

## 5. Filet de sécurité — décision de Joel (2026-08-01)

**Retenu : le compte sur le bouton suffit.** Le libellé annonce exactement ce qui va partir,
un message de confirmation suit l'action. **Pas de fenêtre de confirmation** (un clic de plus
les mains pleines au magasin), **pas d'annulation** (nettement plus de code pour un cas rare,
réparable en deux clics depuis l'inventaire).

**Placement retenu : barre en bas de la liste**, collante (`position: sticky`), qui n'apparaît
qu'à partir d'un article coché — atteignable au pouce sans remonter l'écran.

**Choix d'implémentation qui en découle** : la barre est rendue **dans le conteneur existant**
`#shopping-scroll`, comme dernier élément de `renderShoppingList`. Conséquence volontaire :
**aucune modification d'`index.html`**, donc l'audit reste au niveau Standard et le verrou de
parité `on*=`↔`window` n'est pas concerné.

---

## 5bis. Résultat

**Les 12 critères du §4 sont couverts et verts.** Répartition constatée avant implémentation,
conforme à l'attendu : 11 rouges sur 13 tests neufs — les 2 verts d'emblée étaient ceux qui
vérifient l'ABSENCE de barre, normalement satisfaits tant que la barre n'existe pas.

**Preuve par retrait : 6/6 valides, 0 nulle.** Chaque mutation a fait rougir exactement le
test attendu, témoin non muté vert à chaque tour :

| Mutation | Rouges |
|---|---|
| M1 — la coche n'est plus effacée au passage en stock (retour du défaut) | 2 (le correctif **et** la fonctionnalité) |
| M2 — on range tout le panier, coché ou non | 3 |
| M3 — on range sur la seule coche, sans vérifier le panier | 1 |
| M4 — la sauvegarde part même quand rien n'est coché | 1 |
| M5 — la barre s'affiche sans aucune coche | 1 |
| M6 — le compte de la barre ignore le filtrage des coches fantômes | 1 |

**M1 est la plus parlante** : elle rejoue le défaut corrigé au §3 et fait rougir *deux* tests
issus de *deux* lots différents. C'est la preuve que l'extraction de `_passerEnStock` a bien
fait converger les deux chemins sur une règle unique — casser la règle casse les deux usages.

**Deux erreurs de ma part, rattrapées avant le commit :**
- un libellé « mon 1 achat », qui ne se dit pas en français — corrigé en « Ranger 1 achat » ;
- un test qui interrogeait `localStorage` sur une **mauvaise clé** (`foodapp_v5_state` au lieu
  de `pantry_v5`). Il aurait comparé `null` à `null` et serait passé **toujours**, quoi que
  fasse le code : un faux verrou exactement du type que le LOT 014 a passé son temps à
  démasquer. Réécrit avec un témoin explicite, et M4 prouve désormais qu'il mord.

---

## 6. Ce qu'on ne touche PAS

- **`resetCart` / « 🗑️ Vider »** : inchangé, y compris sa fenêtre de confirmation.
- **Le sens « retour en rupture » de `toggleStock`** : seul le passage EN stock est modifié.
- **Le modèle de données** : aucune quantité introduite, `inStock` reste un oui/non.
- **`index.html`** : aucune modification (cf. §5).
