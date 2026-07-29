# LOT 001 — Extraction des services

> **Statut :** ✅ CLÔTURÉ
> **Version :** 5.0 → 5.1
> **Source :** reconstitué depuis `SHIP_LOG.md` (fiche créée a posteriori le 2026-07-28)

---

## Objectif

Sortir les intégrations externes du monolithe `foodapp-v5-Joel.html` pour en faire des
modules isolés et testables.

## Livré

- `src/services/firebase.js` — authentification et persistance cloud
- `src/services/gemini.js` — appels à l'IA
- Premiers tests unitaires avec mocks (`tests/firebase.test.js`, `tests/gemini.test.js`)

## Ce qu'il faut en retenir

Ces deux services sont classés **zone sensible** dans `DOCTRINE_PRODUIT.md` §3 : toute
modification qui les touche relève au minimum d'un audit Standard.

## Traçabilité

- Journal de livraison : `SHIP_LOG.md`
- Cartographie : `PROJECT_MAP.md` §1
