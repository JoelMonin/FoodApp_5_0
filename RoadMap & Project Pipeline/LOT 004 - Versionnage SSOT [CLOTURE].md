# LOT 004 — Versionnage SSOT

> **Statut :** ✅ CLÔTURÉ
> **Version :** 5.2 (publiée, tag `v5.2`)
> **Source :** reconstitué depuis `SHIP_LOG.md` (fiche créée a posteriori le 2026-07-28)

---

## Objectif

Un seul endroit où écrire le numéro de version, propagé automatiquement partout.

## Livré

- **Source unique** : `APP_VERSION` dans `src/constants.js`
- Propagateur : `python scripts/sync_version.py` (met à jour `package.json`, `index.html`, etc.)
- Verrou automatique : `tests/test_version_ssot.py` — la validation échoue si un numéro diverge

## Ce qu'il faut en retenir

**Ne jamais modifier un numéro de version à la main ailleurs que dans `src/constants.js`.**
Modifier cette valeur, puis lancer le propagateur. Règle gravée dans `CLAUDE.md` §6.

## Audit

Audit Standard *a posteriori* — il restait à faire au moment de la clôture. L'audit #2 du
2026-07-28 a couvert cette zone sans rien relever sur le versionnage.

## Traçabilité

- Journal de livraison : `SHIP_LOG.md`
- Règle de gouvernance : `CLAUDE.md` §6
