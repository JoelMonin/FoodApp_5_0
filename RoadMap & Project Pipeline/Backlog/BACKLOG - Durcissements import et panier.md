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
  cette fonction (`js/app.js:247`), le paramètre `type` est documenté comme fantôme.
- À rebrancher si un futur lot réintroduit la suppression d'articles libres depuis la liste
  de courses (probablement LOT 012, confort du panier).

## Traçabilité

- Audit source : NO-GO Codex 5.6 sur `f7d11ec`, corrigé en `2483c06` (les deux findings
  CRITIQUES — reset incomplet, export versionné — ont été traités ou levés par Joel ;
  cette fiche ne porte que les DURCISSEMENTS résiduels).
- Les deux autres durcissements du même audit ont été traités à la clôture du lot :
  test d'ordre push→reload durci (résolution prouvée, pas seulement l'invocation) ;
  `exportJSON` aligné sur l'oracle (`URL.revokeObjectURL` + toast « 💾 Export téléchargé »).
