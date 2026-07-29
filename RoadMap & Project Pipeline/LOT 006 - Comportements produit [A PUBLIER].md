# LOT 006 — Comportements produit

> **Statut :** 🟡 TERMINÉ — en attente de publication (feu vert de Joel)
> **Branche :** `feat/lot6-comportements-produit` · commit `a35e74c`
> **Effort réel :** ~4 h · **Validation :** 33/33 Vitest + 13/13 Pytest, build OK
> **Origine :** audit #2 (`ULTRA_AUDIT_REPORT.md`), ex-chantier `RACE_CONDITIONS_AI`

---

## Objectif

Corriger les comportements que Joel constate à l'usage. **Tous les arbitrages produit de ce
lot ont été tranchés par Joel avant l'implémentation** (pare-feu A/B, `CLAUDE.md` §5).

## Arbitrages rendus par Joel

| Question | Décision |
|---|---|
| Que pré-cocher dans « recette → liste de courses » ? | **Seulement ce qui manque** |
| Bouton « Sauver tel quel » inopérant | **Le griser tant qu'il est inutilisable** |
| Emoji automatique | **Réutiliser la recherche qui marche déjà** (idée de Joel, meilleure que les 3 options proposées) |

## Livré

- **Liste de courses intelligente** : seuls les ingrédients manquants sont pré-cochés. Ce qui
  est déjà en stock porte un badge et indique à quoi il correspond dans l'inventaire ; une
  correspondance approximative est signalée en orange.
- **Emojis devinés** : `autoEmoji` réutilise la recherche du formulaire d'ajout
  (correspondance exacte dans la base), avec repli sur l'emoji de la catégorie.
- **Puce de filtre « Autres »** : les ingrédients qui y atterrissaient étaient jusqu'ici
  impossibles à filtrer.
- **Fenêtre « Coller une recette »** : boutons grisés tant que le texte n'est pas transformé,
  et remise à zéro à chaque ouverture.
- **« Cloud Sync » n'efface plus la clé API** et confirme enfin son résultat.
- **Collision de requêtes IA** supprimée (jeton de génération).
- **Noms d'ingrédients longs** : ne déforment plus la grille.
- **Plus aucun nom de modèle IA en dur** hors de `src/constants.js`.

## Découvertes majeures de la phase découverte

1. **Le sélecteur riche existait déjà**, mais dans l'ancien monolithe. Tout son CSS
   (`.picker-item`, badges, « Correspond à… ») **dormait dans la feuille de style, inutilisé** :
   le code émettait une classe `picker-row` qui n'existait nulle part. La fonctionnalité avait
   été perdue lors de la migration du LOT 003. **On a restauré, pas inventé.**
2. **`_lastTransformedRecipe` n'était jamais remise à zéro** : après avoir fermé puis rouvert
   la fenêtre, « Sauvegarder tel quel » pouvait enregistrer **la recette précédente**.
3. **Trois valeurs de secours pointaient vers le mauvais modèle IA** depuis la bascule de la veille.
4. **« Cloud Sync » effaçait la clé API** : la règle « le cloud n'efface jamais la clé locale »
   n'était écrite qu'au démarrage, pas dans le bouton. Corrigé par une fonction unique
   (`applyCloudState`) utilisée par les deux chemins.

## Non traité — sorti du périmètre

- **Alias `state` fragile** (ex-`RACE_CONDITIONS_AI` §F3) → `Backlog/BACKLOG - Alias state fragile.md`
- **Le menu « Moteur Tâches Complexes » est sans effet** : le choix de l'utilisateur est
  systématiquement écrasé au chargement suivant. Demande une décision produit (faire respecter
  le choix, ou retirer le menu). → à arbitrer.
- **Suppression des ingrédients entre appareils** → traité au LOT 007.

## Traçabilité

- Audit source : `ULTRA_AUDIT_REPORT.md` (audit #2)
- Mémoire d'audit : `.claude/audit_memory.md`
