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
| 8 | **013 — Filet de tests UI** | Figer le comportement restauré AVANT la refonte | **5.9** |
| 9 | **014 — Refonte SSOT et découpage** | Code propre, SSOT partout, verrous anti-récidive | **5.10** |

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
| [018](LOT%20018%20-%20Ecran%20inventaire%20dans%20son%20module%20%5BCLOTURE%5D.md) | L'écran inventaire dans son module — **625 → 568 lignes**, et surtout la **première baisse réelle du couplage** de la série (10 points → 9). Sort « sec » : zéro cycle, zéro crochet créé. Trois pièges évités par la découverte, dont un faux ami parfait | **CLOTURE** — publié en V5.11 le 2026-08-01 | `feat/lot18-ecran-inventaire` |
| [017](LOT%20017%20-%20Second%20rangement%20de%20app.js%20%5BCLOTURE%5D.md) | Second rangement de `js/app.js` — **1527 → 625 lignes (−59 %)**, six modules extraits (couplages stables : 5 crochets avant comme après — l'annonce d'une baisse à 4 était fausse, rectifiée dans la fiche). A trouvé un défaut que 798 tests verts ne voyaient pas : la construction de production était cassée depuis le premier volet. Validation unifiée portée de 2 à 3 étapes | **CLOTURE** — publié en V5.11 le 2026-08-01 | `feat/lot17-second-rangement-app-js` |
| [016](LOT%20016%20-%20Etiquettes%20de%20recette%20au%20propre%20%5BCLOTURE%5D.md) | Étiquettes de recette au propre — solde le point de sortie `.r-tag` laissé ouvert par le LOT 014 : les variantes rouge et verte n'ont plus qu'une définition, apparence prouvée identique, +6 tests de verrou (4 mutations, 4 rouges) | **CLOTURE** — publié en V5.11 le 2026-08-01 | `feat/lot16-etiquettes-recette-css` |
| [014](LOT%20014%20-%20Refonte%20SSOT%20et%20decoupage%20%5BCLOTURE%5D.md) | Refonte SSOT et découpage — les 9 volets faits et testés, check-list de régressions reparcourue, audit DUR final (6 agents adversariaux locaux : 1 bloquant + 3 moyens + 3 mineurs corrigés, rien laissé sans vérification sur pièce) | **CLOTURE** — publié en V5.10 le 2026-07-31 | `feat/lot14-refonte-ssot` |

## ✅ Clôturés

| Lot | Sujet | Version |
|---|---|---|
| [013](LOT%20013%20-%20Filet%20de%20tests%20UI%20%5BCLOTURE%5D.md) | **Filet de tests UI** — 102 tests neufs (448 → 550), matrice de couverture des 84 acquis des LOTS 005-015, infrastructure de test partagée avec son propre garde-fou, 2 audits adversariaux (mutation testing, 0 test tautologique) + audit Gemini | **5.9** |
| [015](LOT%20015%20-%20Reglages%20fiables%20et%20coherents%20%5BCLOTURE%5D.md) | **Réglages fiables et cohérents** — chaque bouton fait ce qu'il annonce : copies corrigées, bouton JSON supprimé, garde-fou « rien à copier » et repli de copie restaurés, périmètre du fichier de sauvegarde, coches sauvegardées et filtrées, gardes d'entrée durcies, trou de la barrière de synchro fermé | **5.8** |
| [012](LOT%20012%20-%20Confort%20d%20usage%20retrouve%20%5BCLOTURE%5D.md) | **Confort d'usage retrouvé** — sélecteur éditable (nom + emoji via 🎲), clavier et gestes, barre supérieure contextuelle, styles neufs | **5.7** |
| [011](LOT%20011%20-%20Recettes%20IA%20riches%20%5BCLOTURE%5D.md) | **Recettes IA riches** — cartes complètes, détail riche, prompts blindés, mode 🎲, favoris riches, récupération d'URL propre | **5.7** |
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

- **2026-08-01 — LOT 018 ouvert et terminé (A PUBLIER)** : l'écran inventaire sort dans
  `src/ui/pantryView.js`, en rapatriant au passage les puces de filtre que le LOT 017 avait
  logées dans la barre du haut. **Première baisse réelle du couplage de toute la série**
  (10 points → 9) : le crochet `renderPantry` disparaît, il n'existait que pour ces puces.
  `js/app.js` : 625 → 568 lignes, soit **−80 % depuis le début du rangement** (2823 avant le
  LOT 014). Premier module à sortir « sec » — zéro cycle, zéro crochet créé. La découverte a
  évité trois régressions invisibles, dont un faux ami parfait (`initChipsRowTouchScroll`,
  dont le commentaire parle des puces de filtre alors que son sélecteur couvre surtout le
  panneau IA). **Incident d'outillage consigné** : 77 tests rouges au premier passage,
  aucun réel — cache Vite obsolète, démonté par reproduction. Un échec non reproduit ne
  prouve rien.
- **2026-07-31 — LOT 017 ouvert et terminé (A PUBLIER)** : le second rangement de `js/app.js`
  aboutit **au-delà de sa cible** — 1527 → 625 lignes (−59 %) pour un objectif de ~700. Six
  modules extraits. **Rectification** : j'avais annoncé une baisse des couplages (5 crochets
  → 4) ; remesuré, c'est **5 avant et 5 après**, et 9 points de couplage contre 10. Le
  couplage n'a pas baissé — sa nature a changé (les crochets visent désormais l'écran
  inventaire, qui attend son module, au lieu de retenir du code prisonnier du fourre-tout). La phase découverte a corrigé trois erreurs du
  plan (mesure fausse deux fois, 16 fonctions oubliées, cible inatteignable en l'état) et
  l'ordre des volets a été revu deux fois en cours de route pour éviter des crochets
  temporaires. **Défaut majeur trouvé en fin de lot** : la construction de production était
  cassée depuis le premier volet, avec 798 tests verts — la branche était impubliable sans
  que rien ne le dise. La validation unifiée passe de 2 à 3 étapes.
- **2026-07-31 — LOT 016 ouvert et terminé (A PUBLIER)** : solde le point `.r-tag` reporté
  par le LOT 014. Le diagnostic a **infirmé l'hypothèse de départ** : `.r-tag.green` de
  `05-ai.css` était bien intégralement morte, mais `.r-tag.red` gardait deux propriétés
  vivantes (`font-weight`, `box-shadow`) — la retirer en bloc aurait changé l'écran. Joel a
  choisi de figer l'apparence actuelle et de laisser les variantes `gold`/`terra` inutilisées.
  Apparence prouvée identique par comparaison de la cascade calculée sur la feuille buildée,
  avec contre-épreuve ; verrou de 6 tests, 4 mutations et 4 rouges nommés. 790/790 Vitest.
- **2026-07-31 — LOT 014 publié en Version 5.10, campagne « Restauration & Refonte »
  achevée** : feu vert de Joel donné le soir même, fusion `--no-ff` de
  `feat/lot14-refonte-ssot` dans `main` et mise en ligne. Fiche passée en `[CLOTURE]`.
  Reste ouvert, hors lot et sciemment : le point `.r-tag.red`/`.r-tag.green` (à regarder à
  froid, « sans tout casser ») et le second rangement de `js/app.js` (fiche au backlog).
- **2026-07-31 — LOT 014 terminé, A PUBLIER** : les 9 volets (C1, B, C, G, A, D, correctifs
  IA, E, F) faits et testés, check-list des régressions reparcourue. Audit DUR final : 6
  agents adversariaux locaux en parallèle (correctifs IA, découpage `js/app.js`, CSS,
  sécurité des données, qualité des tests par mutation réelle, traque SSOT indépendante) —
  1 défaut bloquant et 3 moyens trouvés et corrigés, 3 mineurs corrigés, 1 mineur documenté
  sans être tranché (`.r-tag.red`/`.r-tag.green`, remonté à Joel car sur la liste des classes
  protégées de la campagne). 784/784 Vitest, 16/16 Pytest, build OK. **Joel a explicitement
  demandé de ne PAS publier en ligne pour l'instant** (VERROU PRODUCTION) : le lot reste sur
  sa branche, en attente du feu vert.
- **2026-07-31 — ouverture du LOT 014** : la phase découverte (4 agents) a de nouveau donné
  raison à la règle « aucune citation de fiche ne vaut sans re-vérification ». La fiche datait
  du 2026-07-29, donc d'avant les LOTS 015 et 013 : **3 de ses points étaient déjà soldés**
  (la table d'emojis dupliquée n'existe plus depuis le LOT 006 ; la séparation de la copie est
  faite à 80 % par le LOT 015 ; le volet « validation » est à ~40 % en place, avec 48 gardes
  déjà présentes dans le code). Un **défaut réel et actif en production** a été trouvé au
  passage : « Importer uniquement le stock » est resté sans la protection que le LOT 015 a
  posée sur son bouton jumeau — il part en tête du lot. Deux corrections annoncées à Joel :
  la suppression des articles libres **efface** aussi le champ du cloud (la fiche disait
  l'inverse), et deux libellés de Réglages qu'il lit deviendront faux. 40+ citations corrigées.
- **2026-07-31 — le filet publié seul, et non avec la refonte** : arbitrage de Joel à la
  clôture du LOT 013. La campagne avait pour habitude de chaîner les lots par paires
  (007+008, 009+010, 011+012) ; ici le 013 n'est pas le pair du 014, c'est sa **police
  d'assurance** — la laisser sur l'étagère pendant le chantier le plus risqué de la campagne
  aurait signifié la perdre en même temps que lui en cas d'abandon. Le LOT 013 part donc seul
  en **5.9** (aucun changement visible : tests + attributs d'ancrage), et le LOT 014 devient
  la **5.10** (et non la 6.0 — numérotation choisie par Joel).
- **2026-07-30 — ouverture du LOT 013** : phase découverte (4 agents) a montré que la fiche
  était périmée (33 tests annoncés vs 448 réels, plusieurs items déjà faits par le LOT 015,
  la §D reposait sur une prémisse fausse). Fiche réécrite. Deux arbitrages de Joel : ancres
  de test autorisées dans `index.html` (audit relevé à Standard) ; les « articles libres »
  (`customCartItems`), trouvés fantômes en cours de découverte, ne sont pas rebranchés mais
  **supprimés** au LOT 014 (nouveau volet G de sa fiche).
- **2026-07-29 — refonte « campagne Restauration & Refonte »** : le balayage des régressions
  (4 agents + auditeurs) a montré ~30 comportements perdus par la migration. Création des
  LOTS 008-014, spec 007 passée en v3 (double audit NO-GO intégré), statut `[PLANIFIE]`
  ajouté à la convention, backlog presque entièrement promu.
- **2026-07-28 — réorganisation initiale** : un fichier par lot, numéros à 3 chiffres,
  statuts. Révélé que `PERF_BOOT_AND_RENDER` et `RACE_CONDITIONS_AI` étaient déjà réalisés
  (lots 005/006) et sauvé le point `state = moduleState` en backlog.
