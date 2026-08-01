# LOT 024 — Nettoyage de dette + rectification — FICHE

> **Statut :** 🟡 A PUBLIER — ouvert et terminé le 2026-08-01
> **Branche :** `feat/lot24-nettoyage-dette`, chaînée depuis `feat/lot23-jauge-creativite`
> **Niveau d'audit : Léger** — nettoyage documentaire, zéro changement de comportement
> **Version visée :** 5.14, avec les LOTS 021, 022 et 023
> **Origine :** chantiers 2, 3 et 5 de l'évaluation de qualité du code demandée par Joel
> (2026-08-01) — chantier 1 = LOT 021, chantier 4 (limite assumée) = clos par accusé simple.

---

## Volet 1 — Nettoyage des comments-dette

**Périmètre trouvé bien plus étroit que redouté.** La recherche portait sur les comments qui
« enregistrent des chiffres ou racontent l'histoire », par opposition à ceux qui expliquent
le POURQUOI (règle du CLAUDE.md, confirmée par Joel). Recherche systématique de tout comment
`src/` citant un nombre de tests hors des fichiers `*.test.js` eux-mêmes : **6 résultats sur
l'ensemble du dossier**, pas les dizaines redoutées à l'annonce du chantier.

Sur les 6, **3 ont été laissés intacts** parce qu'ils portent une valeur de preuve, pas une
trivia historique :
- `src/ui/modals.js:40` — résultat d'une mutation (« 7 tests, débrancher chaque crochet fait
  rougir 6 et 1 ») : c'est la PREUVE qu'un branchement est couvert, pas un chiffre décoratif.
- `src/utils/stockMatch.js:66` — même nature (« 810 tests verts sans elle », justifiant le
  retrait d'un mécanisme redondant, LOT 019).
- `src/services/sync.js:47` — « 38 tests » soutient une décision de nommage encore valide.

**3 ont été trimés** — pure trivia de couverture, sans avertissement ni invariant, qui ne
fait que dériver avec le temps :
- `src/ui/aiPanel.js:18-19` — « ~71 tests répartis sur 7 fichiers » (liste de types de tests
  conservée, le compte retiré).
- `src/ui/settings.js:12` — « LOT 015 l'a dotée de 91 tests » (retiré ; la phrase suivante,
  qui porte la vraie information opérationnelle — le filet posé pour la zone aveugle —, est
  intacte).
- `src/ui/pantryView.js:12-13` — trois comptes précis par fichier de test (« 21 tests dans…,
  6 dans…, 3 dans… ») remplacés par les pointeurs de fichiers seuls, sans les comptes.

**Conclusion du sweep** : la base de commentaires du projet est saine. Ce n'est pas la
« dette générale » que l'évaluation de qualité avait pu laisser craindre — c'est un point
mineur, déjà rare, désormais traité.

---

## Volet 2 — `foodapp-v5-Joel.html` étiqueté ARCHIVE

En-tête de 18 lignes ajouté en tête du fichier (avant `<!DOCTYPE html>`), marquant
explicitement : ce n'est PAS l'application vivante, c'est l'oracle de référence
pré-LOT 014, cité par numéro de ligne dans des dizaines de commentaires du code vivant.

**Vérifié avant d'écrire l'en-tête** (pas affirmé sans preuve) : `package.json` et
`vite.config.js` ne le référencent nulle part — aucun chemin d'exécution ne le touche,
seulement des commentaires. `PROJECT_MAP.md` reçoit la même étiquette.

---

## Volet 3 — Auto-correction : mon diagnostic « chiffres faux du LOT 018 » était faux

**C'est le résultat le plus important de ce lot, et il n'est pas celui qu'on attendait.**

Pendant l'évaluation de qualité du 2026-08-01, j'ai affirmé à Joel que les nombres du
LOT 018 (« 5 béquilles, couplage 10 → 9 ») étaient faux, sur la base d'un `grep` rapide qui
trouvait 3 registrars et 6 points de couplage, stables. Joel a validé la correction de ces
« chiffres faux » comme chantier 3.

**En préparant CE lot**, plutôt que de corriger des documents sur la foi de mon affirmation
précédente, je l'ai revérifiée — sur pièce, à trois commits git précis
(`add46f2` = avant LOT 017, `48d3cb2` = clôture LOT 017, `62d4441` = clôture LOT 018), en
énumérant CHAQUE registrar et CHAQUE entrée un par un plutôt qu'en comptant sur un motif de
recherche.

**Résultat : les nombres déjà publiés étaient CORRECTS.** Il existe bien **5 registrars** —
`registerModalHooks`, `registerRecipeModalHooks`, `registerTopbarHooks`,
`registerAddFormNav` et **`registerSyncUi`** (`src/services/sync.js`) — et le compte
d'entrées suit exactement la trajectoire publiée : 9 avant le LOT 017, 10 après (rectifié
dès le LOT 017), 10 avant le LOT 018, **9 après** — la première baisse réelle, comme annoncé.

**Mon `grep` de la veille avait deux angles morts** : `registerAddFormNav` utilise un objet
`_nav`, pas `_hooks` — mon motif de recherche cherchait `_hooks` — et `registerSyncUi` vit
dans `src/services/`, hors du dossier `src/ui/` que j'avais balayé. Une recherche filtrée
par convention de nommage a pris la place d'un dénombrement exhaustif.

**Rien n'a été touché dans les fiches LOT 017 ou LOT 018, ni dans `ROADMAP.md` ou
`SHIP_LOG.md` : ils étaient déjà exacts.** La correction a été appliquée à `CURRENT_GOAL.md`,
qui portait ma fausse affirmation, avec l'explication complète du mécompte — pour qu'aucune
version fausse ne reste la dernière écrite quelque part.

**Ce que ce détour confirme, une nouvelle fois** : une affirmation chiffrée se reprouve, elle
ne se recopie pas — y compris quand l'affirmation à reprouver est la sienne propre, faite la
veille, en toute confiance.

---

## Validation

**Types OK · 842/842 Vitest · 16/16 Pytest · build OK.** Aucun test neuf : le volet 1 est un
nettoyage de commentaires (zéro comportement touché), le volet 2 ajoute un en-tête HTML en
commentaire (idem), le volet 3 corrige un document de suivi.
