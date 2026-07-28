# /init - Session Kickoff Brief (universel : executant Claude + auditeurs Gemini/Codex)

Execute les etapes suivantes dans l'ordre et produis un brief structure.

> **Si tu es l'AUDITEUR (Gemini ou Codex, read-only)** : saute l'etape 1 (tu ne codes
> jamais — pas de branche a creer) et AJOUTE la lecture de ton mandat
> `.agents/01_auditor_role.md`. Tout le reste s'applique tel quel (lecture seule).

## Etape 0 - PROJECT_MAP (BLOQUANT - anti-touriste)

Lis `PROJECT_MAP.md` a la racine du projet. C'est l'index dense de l'organisation
projet (inventaire de ce qu'il cartographie : `DOCTRINE_PRODUIT.md` §2).

**Pourquoi cette etape est en premier** : 2026-05-21 — 30 minutes perdues a chercher
un fichier persistant faute de carte du projet. Plus jamais. Si PROJECT_MAP.md
est absent, alerter l'utilisateur immediatement (un commit l'a probablement
supprime par accident — restaurer via git history).

## Etape 1 - Branche active (EXECUTANT seulement)
Execute: git branch --show-current
Si la branche est main ou master : affiche un AVERTISSEMENT et rappelle de creer une branche feat/ avant de coder.

## Etape 2 - Objectif actif
Lis CURRENT_GOAL.md en entier.
Extrait : numero de lot actif, titre, avancement.

## Etape 3 - Historique recent
Lis SHIP_LOG.md.
Extrait les 3 dernieres entrees : [TITRE] Date — resume en 1 ligne (+ SHA si present).
(Les entrees ne sont pas toutes des [LOT XX] : gouvernance, audits, sessions groupees.)

## Etape 3bis - Anti-derive journal/repo (garde-fou)
Execute: git rev-list $(git log -1 --format=%H -- SHIP_LOG.md)..HEAD --count
Si >= 3 : flag DERIVE dans le brief (le journal et le repo racontent deux histoires) —
proposer entree groupee SHIP_LOG ou /handoff, Joel tranche.

## Etape 4 - Horizon
Lis dans `RoadMap & Project Pipeline/ROADMAP.md` la section **SEQUENCE** la plus recente
(ordre d'execution numerote — ex. « CAP SECURITE-ARGENT »). Le prochain candidat = la
premiere position non livree de la sequence. NE PAS deduire l'ordre en scannant les
statuts des lots (la sequence prime ; la « boucle produit » se pioche selon l'envie).

## Etape 4bis - Fraicheur corpus NotebookLM (garde-fou)
Si `export_nblm/_MANIFEST.txt` existe : compare son SHA a `git rev-parse --short HEAD`.
SHA different (ou dossier absent) → noter CORPUS PERIME dans le brief, a titre d'information.
Regle (allegement Joel 2026-07-24) : la regeneration ne se fait plus apres chaque merge mais
AU MOMENT DE S'EN SERVIR (avant une phase decouverte P0/P1 ou un balayage demande) —
`python scripts/export_nblm_sources.py` + re-upload par Joel. JAMAIS lancer un prompt NBLM
sur un corpus perime. Auditeurs : signaler seulement, ne rien executer.

## Etape 5 - Etat du repo
Execute: git status --short
Note les fichiers modifies non commites.

## Etape 5bis - Backlog technique (garde-fou anti-poubelle, regle Joel 2026-07-21)

Lis `audits/BACKLOG_TECHNIQUE.md` et mesure :
1. Le nombre de findings de la section **« Findings actifs »** (en-tetes `### [F-`).
2. Les entrees de la section « traités / écartés » dont le texte NE PROUVE PAS le
   traitement (titre sans TRAITÉ, corps au conditionnel « si on traite ») = ouverts
   deguises — les compter A PART. **Pourquoi** : constat 2026-07-21, la poubelle avait
   deux etages (12 actifs oublies + des ouverts ranges en « traités »).
3. Parmi les actifs : ceux dates de **plus d'un mois**, et TOUT ce qui est **securite**
   ou **BLOCKER** (mots-cles : securite, CSRF, BLOCKER, BOMBE, moteur).

Sortie dans le brief : **3 lignes MAX** (compte actifs + mal classes · plus d'un mois ·
securite/BLOCKER) + UNE question : « un de me findings merite-t-il promotion en lot ? »
Pas de rapport detaille — le detail vit dans le backlog lui-meme.

## Etape 6 - Brief final

Produis ce resume :

---
SESSION BRIEF - [date du jour]

BRANCHE : [nom]  <-- AVERTISSEMENT si main/master (executant)

OBJECTIF ACTIF : [LOT XX] [Nom]
  Avancement : [description ou %]

DERNIERES LIVRAISONS :
  [TITRE]   [date] - [resume] (SHA: XXXXXXX si present)
  [TITRE-1] [date] - [resume]
  [TITRE-2] [date] - [resume]

PROCHAINES ETAPES (sequence ROADMAP) :
  [position N] - [titre]
  [position N+1] - [titre]

JOURNAL : [OK / DERIVE : N commits depuis la derniere entree SHIP_LOG]
CORPUS NBLM : [a jour / PERIME (SHA manifest != HEAD) / absent]
BACKLOG : [N actifs (+M mal classes) · X de plus d'un mois · securite/BLOCKER : liste courte ou « aucun »]
  -> question : un de ces findings merite-t-il promotion en lot ?
REPO : [X fichiers modifies / Propre]

ROUTAGE PROPOSE : executant [modele Claude] · auditeur [modele] · effort [niveau]
  — 1/2 ligne de justification, selon la priorite pressentie (regle Joel 2026-07-12 :
  toujours annoncer modele + effort ; envisager un duel intra-famille si audit).
---

Termine par : Quelle est la priorite de cette session ?
