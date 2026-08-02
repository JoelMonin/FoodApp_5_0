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
| [027](LOT%20027%20-%20Option%20Keto%20%5BCLOTURE%5D.md) | Option Keto — une 6ᵉ puce « Keto » dans les options diététiques du panneau IA, pour générer des recettes cétogènes (très pauvres en glucides). 1 ligne d'HTML, zéro JS de production, 6 tests neufs (première couverture de la ligne « RÉGIMES & EXCLUSIONS » du prompt), 3 mutations/3 rouges | **CLOTURE** — publié en V5.15 le 2026-08-02 | `feat/lot27-option-keto` (chaînée sur lot26) |
| [026](LOT%20026%20-%20Prompts%20de%20generation%20%5BCLOTURE%5D.md) | Prompts de génération — 5 chantiers décidés par Joel après audit des prompts (2026-08-02) : liste des catégories enfin donnée à l'IA, suppression du bouton 🎲 (jugé « du théâtre » : équivalent au curseur à fond), anti-répétition sur 60 minutes, règles de qualité des étapes partagées par les deux prompts, SSOT des consignes communes. + correctif post-essai réel (plafond de sortie 16384, message d'erreur en français, erreurs affichées 6 s). Audit final Codex : **GO** (2 findings, tous deux contre-vérifiés par mutation puis corrigés). 928 tests, 12 mutations/12 rouges | **CLOTURE** — publié en V5.15 le 2026-08-02 | `feat/lot26-prompts-generation` (chaînée sur lot25) |
| [025](LOT%20025%20-%20Amelioration%20IA%20%5BCLOTURE%5D.md) | Amélioration IA — l'aperçu montre enfin la recette transformée EN ENTIER, la page importée est nettoyée avant l'envoi à l'IA, et surtout **l'import lit la fiche officielle que les sites publient pour les machines** (10 sites sur 13 mesurés, ~25× moins de texte payé). + P2 : l'IA cesse de manger les apostrophes. 2 audits Codex (spec : GO avec réserves, 6 findings traités · diff final : **GO**). 914 tests, 18 mutations/18 rouges | **CLOTURE** — publié en V5.15 le 2026-08-02 | `feat/lot25-amelioration-ia` |
| [024](LOT%20024%20-%20Nettoyage%20dette%20et%20rectification%20%5BCLOTURE%5D.md) | Nettoyage + rectification, 3 volets. (1) Comments-dette : 3 mentions de nombre de tests, sans valeur de « pourquoi », trimées dans `aiPanel.js`/`settings.js`/`pantryView.js` — sweep bien plus étroit que prévu, la base de commentaires du projet s'est révélée saine. (2) `foodapp-v5-Joel.html` étiqueté explicitement ARCHIVE DE RÉFÉRENCE en tête de fichier. (3) **Auto-correction** : mon diagnostic « chiffres faux du LOT 018 » était lui-même faux — réaudit git ligne par ligne, les nombres déjà publiés (5 registrars, 10→9) étaient corrects | **CLOTURE** — publié en V5.14 le 2026-08-01 | `feat/lot24-nettoyage-dette` |
| [023](LOT%20023%20-%20Jauge%20de%20creativite%20honnete%20%5BCLOTURE%5D.md) | La jauge de créativité ne ment plus — 101 positions ne produisaient que 3 résultats, sans mise en évidence. Curseur à 3 arrêts fermes (`step="50"`), libellé actif visible en direct, seuillage extrait en SSOT (`creativityLevel`). **La consigne envoyée à l'IA n'a pas changé d'un mot**, vérifié par mutation. Preuve par retrait 4/4 | **CLOTURE** — publié en V5.14 le 2026-08-01 | `feat/lot23-jauge-creativite` |
| [022](LOT%20022%20-%20Reglages%20IA%20toujours%20complets%20%5BCLOTURE%5D.md) | La fiche de réglages IA ne peut plus arriver à moitié vide. Une restauration cloud ou fichier sans réglages produisait un message envoyé à Gemini contenant littéralement « Exactement **undefined** personnes ». Un seul gardien (`sanitizeGlobalState`) comble les cases absentes sans jamais toucher à un choix — `0` et `''` compris. **Le premier endroit que j'avais montré à Joel était le mauvais** : prouvé par la mutation M3. Preuve par retrait 3/3 | **CLOTURE** — publié en V5.14 le 2026-08-01 | `feat/lot22-reglages-ia-complets` |
| [021](LOT%20021%20-%20Verificateur%20de%20types%20%5BCLOTURE%5D.md) | Un vérificateur de types relit le JavaScript existant. 128 signalements → 0, **sans qu'une ligne de comportement ne change**. 87 des 128 avaient une seule cause. Trois vrais défauts trouvés (options non documentées, béquilles mentant sur leur signature, annotation vague là où la prose était juste). Le défaut du LOT 017 rejoué et attrapé en 1,2 s, quand Vitest reste vert. Validation à 4 étapes | **CLOTURE** — publié en V5.14 le 2026-08-01 | `feat/lot21-verificateur-de-types` |
| [020](LOT%20020%20-%20Ranger%20les%20achats%20%5BCLOTURE%5D.md) | Ranger les achats — une barre collante « 🏠 Ranger N achats » apparaît dès qu'un article est coché : les cochés passent en stock et quittent la liste, les autres ne bougent pas. Fonctionnalité NEUVE (l'oracle ne connaît que « Vider »). **+ un défaut existant corrigé en commit séparé** : `toggleStock` était le seul des 4 chemins de sortie du panier à ne pas effacer la coche, d'où des articles qui revenaient « déjà cochés ». Preuve par retrait 6/6 | **CLOTURE** — publié en V5.13 le 2026-08-01, après essai de Joel | `feat/lot20-ranger-les-achats` |
| [019](LOT%20019%20-%20Correspondance%20stock-recette%20%5BCLOTURE%5D.md) | La correspondance stock ↔ recette ne se trompe plus dans les cas clairs — l'inventaire a le dernier mot quand il parle clairement (exact ou générique), l'IA n'arbitre que la zone du doute. Corrige aussi le « premier voisin » au lieu du « meilleur » et restaure les mots vides/pluriels perdus au portage. **Premier lot depuis 3 lots à changer le comportement visible.** 10 critères issus des captures de Joel, preuve par retrait 7/7 | **CLOTURE** — publié en V5.12 le 2026-08-01, sans vérification visuelle ni audit du diff (décision de Joel, tracée dans la fiche §7) | `feat/lot19-correspondance-stock` |
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

**Nettoyage intégral du 2026-08-02** : les quatre fiches ont été relues et **re-vérifiées dans
le code**, point par point. Trois sont fermées, **une seule reste un chantier ouvert**.

**Où va quoi, depuis le 2026-08-02** : un **chantier** (plusieurs jours, un plan, une valeur
produit) reste ici, en backlog produit. Un **finding** (défaut ponctuel, angle mort de test,
dette assumée) vit dans **`audits/BACKLOG_TECHNIQUE.md`**, le registre technique — un seul
domicile par finding, relu à chaque démarrage de session.

| Sujet | Priorité | État au 2026-08-02 |
|---|---|---|
| [Accessibilité et animations](Backlog/BACKLOG%20-%20Accessibilite%20et%20animations.md) | Basse | 🟠 **OUVERT — le seul vrai chantier restant.** Les 6 findings re-mesurés et tous confirmés : 47 `<div>` cliquables, 0 attribut d'accessibilité, 0 règle « réduire les animations », cibles tactiles à 32 et 22 px pour un standard de 44. Effort 1-2 j |
| [Durcissements import et panier](Backlog/BACKLOG%20-%20Durcissements%20import%20et%20panier.md) | — | ➡️ **MIGRÉE** vers `audits/BACKLOG_TECHNIQUE.md` (findings **F-001 à F-010**) : ce n'étaient pas des chantiers mais des findings d'audit, et leur place est au registre technique. Fiche conservée pour la trace de l'origine |
| [Régressions de la migration](Backlog/BACKLOG%20-%20Regressions%20de%20la%20migration.md) | — | ✅ **FERMÉE** — zéro case non cochée. Conservée pour son **§5 « faux morts »**, garde-fou permanent : à relire avant de déclarer un comportement « perdu à la migration » |
| [Second rangement de `app.js`](Backlog/BACKLOG%20-%20Second%20rangement%20de%20app.js.md) | — | ✅ **FERMÉE** — absorbée par les LOTS 017 et 018 (publiés en 5.11). Cible « sous 700 lignes » dépassée : `js/app.js` est à **568** |

Fiches promues le 2026-07-29 (absorbées, traçées dans les fiches de lot) : Filet de tests UI
→ LOT 013 · Découpage app.js/style.css + Alias state + Validation données externes → LOT 014.
Arbitrages parqués ventilés : menu « Moteur Tâches Complexes » → LOT 010 (§6) · verrou
imports ESM → LOT 014 (§F).

---

## 📌 Historique de cette roadmap

- **2026-08-02 — V5.15 publiée (LOTS 025+026+027 d'un bloc)** : l'import de recette lit la
  fiche officielle `schema.org/Recipe` des sites (fin du « tout balancer à l'IA »), l'aperçu
  montre la recette entière, les prompts de génération refaits sur 5 chantiers décidés par
  Joel, et l'option Keto ajoutée le jour même de sa demande. Trois branches chaînées
  (`lot25` ← `lot26` ← `lot27`), une seule fusion `--no-ff`. Le commit de gouvernance du
  matin (registre des dettes, sciemment non publié jusqu'ici) part dans le même envoi.
- **2026-08-02 — création du registre des dettes techniques** : `audits/BACKLOG_TECHNIQUE.md`
  était réclamé par l'étape 5bis du démarrage de session depuis sa création, mais **n'avait
  jamais existé** (vérifié : aucune trace dans tout l'historique git). Les findings vivaient
  éparpillés dans les fiches de backlog — c'est précisément pour ça qu'ils s'y sont périmés.
  Les 10 findings de la fiche « Durcissements » y ont été **déplacés, pas copiés** (F-001 à
  F-010) : un finding n'a qu'un seul domicile, sinon les deux versions divergent.
- **2026-08-02 — nettoyage intégral du backlog** : les quatre fiches relues et **vérifiées
  dans le code**, pas seulement recopiées. Constat : elles avaient vieilli en silence.
  **Toutes les références de ligne de la fiche « Durcissements » étaient fausses** — elle
  citait `js/app.js:2135` et `:2781` alors que ce fichier ne fait plus que 568 lignes depuis
  le LOT 018, et la fiche « Accessibilité » visait `css/style.css`, découpé en 13 sections
  depuis le LOT 014. **Cinq points étaient déjà réglés** sans que personne ne l'ait noté
  (articles libres supprimés, modale morte retirée, `sanitize()` supprimée, deux défauts de
  catégorisation corrigés). Deux fiches fermées, deux allégées. Le compte des temporisations
  sans test a été **re-mesuré** : 5 et non 9, sur 16 sites et non 20. **Leçon consignée :
  une fiche de backlog qui cite des numéros de ligne se périme au premier rangement.**
- **2026-08-01 — LOTS 023 et 024 terminés, en file pour la V5.14** : la jauge de créativité
  (ressenti de Joel : « on a bricolé un truc ») retrouve un curseur à 3 arrêts fermes, avec
  le palier actif visible — sans toucher un mot de ce que l'IA reçoit, vérifié par mutation.
  Puis nettoyage : `foodapp-v5-Joel.html` étiqueté ARCHIVE en tête de fichier, quelques
  comments-dette trimés. **Ironie assumée** : en préparant la « correction des chiffres
  faux du LOT 018 » demandée par Joel, un réaudit git ligne par ligne a montré que les
  chiffres déjà publiés étaient CORRECTS — c'est mon propre diagnostic de la veille qui
  s'est trompé, en oubliant deux registrars dans un comptage `grep` trop rapide. Corrigé
  dans `CURRENT_GOAL.md`, rien à toucher dans les fiches LOT 017/018.
- **2026-08-01 — LOT 020 publié en V5.13, le jour même de son ouverture** : demande de Joel
  au retour de ses courses. Une barre collante range d'un geste les articles cochés dans
  l'inventaire. **Fonctionnalité neuve** (l'oracle ne connaît que « Vider »), donc décision
  produit et non portage. La découverte a exhumé au passage un **défaut réel** : `toggleStock`
  était le seul des quatre chemins de sortie du panier à ne pas effacer la coche, d'où des
  articles qui revenaient « déjà cochés » — corrigé en commit séparé et en premier, sur
  demande explicite de Joel. Preuve par retrait 6/6, dont une mutation qui fait rougir deux
  tests de deux lots à la fois (preuve que la règle est bien unique). Testé par Joel avant
  publication.
- **2026-08-01 — LOT 019 publié en V5.12, le jour même de son ouverture** : la liste de
  courses cesse de se tromper dans les cas clairs. Trois défauts corrigés, dont deux
  invisibles jusqu'ici : « l'IA fait autorité » était une **invention de la version
  modulaire** (l'oracle ne consulte jamais ce champ pour ce calcul), et les mots vides +
  pluriels de l'oracle avaient été perdus au portage. **Preuve par retrait 7/7** — dont deux
  échecs au premier passage qui ont révélé un trou du filet ET un défaut de conception dans
  le moteur neuf (deux mécanismes se couvrant mutuellement, donc aucun prouvable).
  Publié sans vérification visuelle ni audit du diff, par décision de Joel (fiche §7).
- **2026-08-01 — V5.11 publiée (LOTS 016+017+018 d'un bloc) puis LOT 019 ouvert** : le grand
  rangement est en ligne (`js/app.js` 2823 → 568 lignes, aucun changement visible). Dans la
  foulée, Joel valide le cap du LOT 019 : réinvestigation du sélecteur de courses sur ses
  captures réelles — trois défauts trouvés (premier voisin au lieu du meilleur, « l'IA fait
  autorité » qui est une invention de la v2 jamais présente dans l'oracle, mots
  vides/pluriels perdus au portage). Nouvelle règle : l'inventaire tranche les cas clairs,
  l'IA arbitre le doute. Décisions D2/D3 prises par AskUserQuestion, spec détaillée rédigée
  AVANT implémentation.
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
