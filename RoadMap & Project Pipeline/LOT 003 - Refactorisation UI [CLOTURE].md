# LOT 003 — Refactorisation UI

> **Statut :** ✅ CLÔTURÉ
> **Version :** 5.1 → 5.2
> **Source :** reconstitué depuis `SHIP_LOG.md` (fiche créée a posteriori le 2026-07-28)

---

## Objectif

Éliminer `innerHTML` de toute la couche d'affichage et découper les vues en modules.

## Livré

- Utilitaire `h()` dans `src/utils/dom.js` — construction du DOM sans injection HTML
- Vues extraites : `src/ui/pantry.js`, `src/ui/shopping.js`, `src/ui/recipe.js`,
  `src/ui/components.js`
- `index.html` converti en point d'entrée module

## Ce qu'il faut en retenir

> ⚠️ **ADDENDUM 2026-07-31 (LOT 014, volet D)** — `sanitize()` a été **SUPPRIMÉE** sur
> décision de Joel : trois recherches convergentes ont montré qu'elle n'avait aucun appelant
> en production, son seul « utilisateur » étant son propre test. La doctrine en vigueur est
> désormais celle de `CLAUDE.md` : rendu via `h()` UNIQUEMENT. Garder une seconde voie non
> utilisée revenait à laisser une porte ouverte vers `innerHTML`. La ligne ci-dessous est
> conservée telle quelle (règle « rien ne se supprime ») mais n'est plus applicable en l'état.

**Protection XSS structurelle** : tout nouveau markup passe par `h()` ou `sanitize()`, jamais
par `innerHTML`. C'est un acquis à ne pas perdre lors des refactorisations futures.

## Dette laissée par ce lot (découverte à l'audit #2)

La migration du monolithe vers les modules a **perdu des fonctionnalités au passage**, sans que
ce soit détecté à l'époque :

- Le sélecteur d'articles « recette → liste de courses » a perdu sa logique de comparaison au
  stock. Son CSS est resté dans la feuille de style, inutilisé. → réparé au **LOT 006**.
- Les styles de la fenêtre de détail d'une recette n'ont jamais été écrits. → réparé le
  2026-07-28 (hotfix production).
- L'affichage des recettes IA ciblait un identifiant inexistant : la fonctionnalité était morte
  en production. → réparé le 2026-07-28 (hotfix production).

**Leçon** : une migration réussie côté build peut laisser des fonctionnalités mortes. Seul un
test de bout en bout, ou un audit, les révèle.

## Traçabilité

- Journal de livraison : `SHIP_LOG.md`
- Audit : `ULTRA_AUDIT_REPORT.md` (audit #2, 2026-07-28)
