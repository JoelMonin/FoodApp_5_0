# 🗺️ ROADMAP — FoodApp

> Index des lots. **Un fichier par lot**, une ligne par lot ici.
> Le détail vit dans la fiche du lot, jamais dans ce fichier.

---

## 🎯 LE PROJET EN COURS : campagne « Restauration & Refonte » (décidée le 2026-07-29)

Le balayage systématique du 2026-07-29 a prouvé que la migration monolithe → modules a perdu
**~30 comportements en silence** (12 casses franches). Décision de Joel : **le projet est de
tout rebrancher** — le comportement de l'app d'origine est la référence — puis de refondre le
code pour qu'il soit **SSOT partout, propre et maintenable**. Objectif final : une app
fonctionnelle à 100 %.

**Ordre d'exécution** (les numéros de lot ne changent jamais ; l'ordre, si) :

| # | Lot | Rôle | Version visée |
|---|---|---|---|
| 1 | **008 — Données en sécurité** | Fermer les chemins de perte de données. **Préalable bloquant du 007** (l'envoi auto amplifierait les casses) | 5.5 |
| 2 | **007 — Synchro collaborative** (spec v3) | La restauration phare : synchro auto bidirectionnelle | 5.5 |
| 3 | **009 — Boutons morts rebranchés** | Icône, plein écran, imprimer, panneau système | 5.6 |
| 4 | **010 — Règles métier retrouvées** | Cuisine transmise à l'IA, plafond épinglés, tri, quantités | 5.6 |
| 5 | **011 — Recettes IA riches** | Cartes, détail, prompts blindés, favoris, URL | 5.7 |
| 6 | **012 — Confort d'usage retrouvé** | 🎲 emojis, clavier, topbar contextuelle, ~20 gestes | 5.7 |
| 7 | **015 — Réglages fiables et cohérents** | Chaque bouton de Réglages fait ce qu'il annonce (copies, sauvegardes, reset) | 5.8 |
| 8 | **013 — Filet de tests UI** | Figer le comportement restauré AVANT la refonte | 5.8 |
| 9 | **014 — Refonte SSOT et découpage** | Code propre, SSOT partout, verrous anti-récidive | **5.9** |

La check-list de campagne est `Backlog/BACKLOG - Regressions de la migration.md` : chaque lot
y coche ses points ; à la fin du LOT 012, tout §1-§4 doit être coché ou explicitement reporté.

---

## 📐 Convention de nommage (à respecter)

```
LOT NNN - Nom court [STATUT].md        ← un fichier par lot, numéro sur 3 chiffres
Backlog/BACKLOG - Nom court.md         ← pas encore un lot, pas encore de numéro
```

| Statut | Signification |
|---|---|
| `[PLANIFIE]` | Fiche rédigée, numéro attribué, pas encore démarré |
| `[EN COURS]` | Lot actif, branche ouverte |
| `[A PUBLIER]` | Terminé et validé, en attente du feu vert de Joel pour la mise en ligne |
| `[CLOTURE]` | Fusionné dans `main`, en production |
| `[ABANDONNE]` | Arrêté — la fiche reste, avec le motif |

**Règles :**
- Le numéro est attribué à l'ouverture du lot et **ne change jamais**.
- Un élément du backlog n'a **pas** de numéro tant qu'il n'est pas promu en lot ; à la
  promotion, sa fiche backlog est absorbée par la fiche du lot (contenu repris, trace citée).
- Le suffixe de statut se met à jour **dans le même commit** que le changement d'état.
- Rien ne se supprime : un lot abandonné garde sa fiche et son motif.

---

## 🔵 En cours / planifiés (ordre d'exécution ci-dessus)

| Lot | Sujet | Statut | Branche |
|---|---|---|---|
| [011](LOT%20011%20-%20Recettes%20IA%20riches%20%5BA%20PUBLIER%5D.md) | Recettes IA riches (7 chantiers codés, 2 sous-lots audités, vérifié en navigateur) | **A PUBLIER** — attend le LOT 012 | `feat/lot11-recettes-ia-riches` |
| [012](LOT%20012%20-%20Confort%20d%20usage%20retrouve%20%5BPLANIFIE%5D.md) | Confort d'usage retrouvé | PLANIFIÉ | `feat/lot12-confort-usage` |
| [015](LOT%20015%20-%20Reglages%20fiables%20et%20coherents%20%5BPLANIFIE%5D.md) | Réglages fiables et cohérents (arbitrages tranchés le 2026-07-30) — s'exécute AVANT le 013 | PLANIFIÉ | `feat/lot15-reglages-fiables` |
| [013](LOT%20013%20-%20Filet%20de%20tests%20UI%20%5BPLANIFIE%5D.md) | Filet de tests UI (promu du backlog) | PLANIFIÉ | `feat/lot13-filet-tests-ui` |
| [014](LOT%20014%20-%20Refonte%20SSOT%20et%20decoupage%20%5BPLANIFIE%5D.md) | Refonte SSOT et découpage (fusion de 3 fiches backlog) | PLANIFIÉ | `feat/lot14-refonte-ssot` |

## ✅ Clôturés

| Lot | Sujet | Version |
|---|---|---|
| [010](LOT%20010%20-%20Regles%20metier%20retrouvees%20%5BCLOTURE%5D.md) | **Règles métier retrouvées** — cuisine transmise à l'IA, plafond épinglés, zone imposée complète, tri alphabétique, quantités recalculées, menu modèles remplacé | **5.6** |
| [009](LOT%20009%20-%20Boutons%20morts%20rebranches%20%5BCLOTURE%5D.md) | **Boutons morts rebranchés** — icône d'ingrédient, plein écran, imprimer, panneau système | **5.6** |
| [007](LOT%20007%20-%20Synchro%20collaborative%20%5BCLOTURE%5D.md) | **Synchro collaborative** — moteur bidirectionnel complet (la restauration phare) | **5.5** |
| [008](LOT%20008%20-%20Donnees%20en%20securite%20%5BCLOTURE%5D.md) | **Données en sécurité** — import/export/reset sûrs, catalogue 297 ingrédients | **5.5** |
| [006](LOT%20006%20-%20Comportements%20produit%20%5BCLOTURE%5D.md) | Liste de courses intelligente, emojis devinés, Cloud Sync réparé | **5.4** |
| [005](LOT%20005%20-%20Quick%20wins%20UX%20%5BCLOTURE%5D.md) | Démarrage instantané, recherche fluide, réparations d'usage | **5.4** |
| [004](LOT%20004%20-%20Versionnage%20SSOT%20%5BCLOTURE%5D.md) | Versionnage SSOT (`APP_VERSION` + propagateur + verrou) | 5.2 |
| [003](LOT%20003%20-%20Refactorisation%20UI%20%5BCLOTURE%5D.md) | Refactorisation UI (DOM sûr, vues extraites) | 5.1 → 5.2 |
| [002](LOT%20002%20-%20Modernisation%20Vite%20et%20ESM%20%5BCLOTURE%5D.md) | Modernisation Vite et modules ES6 | 5.1 |
| [001](LOT%20001%20-%20Extraction%20des%20services%20%5BCLOTURE%5D.md) | Extraction des services Firebase et Gemini | 5.0 → 5.1 |

---

## 📚 Backlog — pas encore des lots

| Sujet | Priorité | Effort |
|---|---|---|
| [Régressions de la migration](Backlog/BACKLOG%20-%20Regressions%20de%20la%20migration.md) | — | **Check-list de campagne**, ventilée dans les LOTS 007-012 (voir son en-tête) |
| [Durcissements import et panier](Backlog/BACKLOG%20-%20Durcissements%20import%20et%20panier.md) | Basse | Réserves non bloquantes de l'audit LOT 008 — à absorber par LOTS 012/013/014 |
| [Accessibilité et animations](Backlog/BACKLOG%20-%20Accessibilite%20et%20animations.md) | Basse | 1-2 j — après la campagne |

Fiches promues le 2026-07-29 (absorbées, traçées dans les fiches de lot) : Filet de tests UI
→ LOT 013 · Découpage app.js/style.css + Alias state + Validation données externes → LOT 014.
Arbitrages parqués ventilés : menu « Moteur Tâches Complexes » → LOT 010 (§6) · verrou
imports ESM → LOT 014 (§F).

---

## 📌 Historique de cette roadmap

- **2026-07-29 — refonte « campagne Restauration & Refonte »** : le balayage des régressions
  (4 agents + auditeurs) a montré ~30 comportements perdus par la migration. Création des
  LOTS 008-014, spec 007 passée en v3 (double audit NO-GO intégré), statut `[PLANIFIE]`
  ajouté à la convention, backlog presque entièrement promu.
- **2026-07-28 — réorganisation initiale** : un fichier par lot, numéros à 3 chiffres,
  statuts. Révélé que `PERF_BOOT_AND_RENDER` et `RACE_CONDITIONS_AI` étaient déjà réalisés
  (lots 005/006) et sauvé le point `state = moduleState` en backlog.
