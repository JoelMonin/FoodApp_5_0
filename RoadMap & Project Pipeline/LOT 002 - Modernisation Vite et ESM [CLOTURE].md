# LOT 002 — Modernisation Vite et ESM

> **Statut :** ✅ CLÔTURÉ
> **Version :** 5.1
> **Source :** reconstitué depuis `SHIP_LOG.md` (fiche créée a posteriori le 2026-07-28)

---

## Objectif

Passer d'un fichier HTML unique à une véritable application web moderne, outillée.

## Livré

- Build et serveur de développement **Vite** (`vite.config.js`, `npm run dev` sur le port 5173)
- Modules **ES6** (`type="module"`) : `index.html` devient le point d'entrée
- Suite de tests **Vitest** en environnement jsdom

## Incident associé (corrigé depuis)

Les imports ESM sans extension `.js` fonctionnaient en développement mais **cassaient le site
publié** sur GitHub Pages. Hotfix livré avec la version 5.2. Un verrou anti-récidive avait été
proposé mais n'a jamais été mis en place — voir `Backlog/`.

## Traçabilité

- Journal de livraison : `SHIP_LOG.md`
