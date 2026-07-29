# 🗺️ ROADMAP — FoodApp

> Index des lots. **Un fichier par lot**, une ligne par lot ici.
> Le détail vit dans la fiche du lot, jamais dans ce fichier.

---

## 📐 Convention de nommage (à respecter)

```
LOT NNN - Nom court [STATUT].md        ← un fichier par lot, numéro sur 3 chiffres
Backlog/BACKLOG - Nom court.md         ← pas encore un lot, pas encore de numéro
```

| Statut | Signification |
|---|---|
| `[EN COURS]` | Lot actif, branche ouverte |
| `[A PUBLIER]` | Terminé et validé, en attente du feu vert de Joel pour la mise en ligne |
| `[CLOTURE]` | Fusionné dans `main`, en production |
| `[ABANDONNE]` | Arrêté — la fiche reste, avec le motif |

**Règles :**
- Le numéro est attribué à l'ouverture du lot et **ne change jamais**.
- Un élément du backlog n'a **pas** de numéro tant qu'il n'est pas promu en lot.
- Le suffixe de statut se met à jour **dans le même commit** que le changement d'état.
- Rien ne se supprime : un lot abandonné garde sa fiche et son motif.

---

## 🔵 En cours

| Lot | Sujet | Branche |
|---|---|---|
| [007](LOT%20007%20-%20Synchro%20collaborative%20%5BEN%20COURS%5D.md) | **Synchro collaborative** — fusion article par article, envoi automatique | `feat/lot7-synchro-collaborative` |

## 🟡 En attente de publication

| Lot | Sujet | Branche |
|---|---|---|
| [006](LOT%20006%20-%20Comportements%20produit%20%5BA%20PUBLIER%5D.md) | Liste de courses intelligente, emojis devinés, Cloud Sync réparé | `feat/lot6-comportements-produit` |
| [005](LOT%20005%20-%20Quick%20wins%20UX%20%5BA%20PUBLIER%5D.md) | Démarrage instantané, recherche fluide, réparations d'usage | `feat/lot5-quick-wins-ux` |

## ✅ Clôturés

| Lot | Sujet | Version |
|---|---|---|
| [004](LOT%20004%20-%20Versionnage%20SSOT%20%5BCLOTURE%5D.md) | Versionnage SSOT (`APP_VERSION` + propagateur + verrou) | 5.2 |
| [003](LOT%20003%20-%20Refactorisation%20UI%20%5BCLOTURE%5D.md) | Refactorisation UI (DOM sûr, vues extraites) | 5.1 → 5.2 |
| [002](LOT%20002%20-%20Modernisation%20Vite%20et%20ESM%20%5BCLOTURE%5D.md) | Modernisation Vite et modules ES6 | 5.1 |
| [001](LOT%20001%20-%20Extraction%20des%20services%20%5BCLOTURE%5D.md) | Extraction des services Firebase et Gemini | 5.0 → 5.1 |

---

## 📚 Backlog — pas encore des lots

| Sujet | Priorité | Effort |
|---|---|---|
| [Filet de tests UI](Backlog/BACKLOG%20-%20Filet%20de%20tests%20UI.md) | Moyenne | 2-3 j |
| [Validation des données externes](Backlog/BACKLOG%20-%20Validation%20des%20donnees%20externes.md) | Moyenne | 1-2 j |
| [Découpage `app.js` et `style.css`](Backlog/BACKLOG%20-%20Decoupage%20app.js%20et%20style.css.md) | Moyenne | 2-3 j |
| [Alias `state` fragile](Backlog/BACKLOG%20-%20Alias%20state%20fragile.md) | Moyenne | 1 h |
| [Accessibilité et animations](Backlog/BACKLOG%20-%20Accessibilite%20et%20animations.md) | Basse | 1-2 j |

### À arbitrer par Joel (pas encore de fiche)

- **Le menu « Moteur Tâches Complexes » est sans effet** : le choix est écrasé au chargement
  suivant. Faire respecter le choix, ou retirer le menu ?
- **Verrou anti-récidive sur les imports ESM sans extension** — proposé après l'incident du
  LOT 002, jamais mis en place.

---

## 📌 Historique de cette roadmap

Réorganisée le **2026-07-28** : les chantiers étaient nommés par thème sans numéro ni statut,
ce qui masquait deux choses — que `PERF_BOOT_AND_RENDER` et `RACE_CONDITIONS_AI` étaient
**déjà réalisés** par les lots 005 et 006, et qu'un de leurs points (`state = moduleState`)
ne l'était **pas** et allait disparaître avec les fichiers. Il a été sauvé en backlog.
