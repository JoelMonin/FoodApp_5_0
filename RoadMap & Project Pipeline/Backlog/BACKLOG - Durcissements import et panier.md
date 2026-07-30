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

## Traçabilité

- Audit source : NO-GO Codex 5.6 sur `f7d11ec`, corrigé en `2483c06` (les deux findings
  CRITIQUES — reset incomplet, export versionné — ont été traités ou levés par Joel ;
  cette fiche ne porte que les DURCISSEMENTS résiduels).
- Les deux autres durcissements du même audit ont été traités à la clôture du lot :
  test d'ordre push→reload durci (résolution prouvée, pas seulement l'invocation) ;
  `exportJSON` aligné sur l'oracle (`URL.revokeObjectURL` + toast « 💾 Export téléchargé »).
