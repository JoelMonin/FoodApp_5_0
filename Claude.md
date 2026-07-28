# CLAUDE.md - Source de Verite Unique de la gouvernance (workflow agentique, portable)
# Lu par : Claude Code (natif). Gemini et Codex le recoivent via AGENTS.md (fichier GENERE).
# Ce qui est propre a CETTE application vit dans `DOCTRINE_PRODUIT.md` (cf. §7).

---

## 0. PHASE -1 : LIRE `PROJECT_MAP.md` AVANT TOUTE EXPLORATION (BLOQUANT)

**Avant** de chercher un fichier / fonction / script / table / endpoint — **lire
`PROJECT_MAP.md`** (index dense « ou trouver quoi en 10s »). Inventaire cartographie + regle
de maj : `DOCTRINE_PRODUIT.md` §2.

**Garde-fou** : `tests/test_project_map_freshness.py` casse si un composant/fichier est ajoute
sans maj.

---

## 1. ECOSYSTEME & ROLES

| Role | Qui | Canal |
|---|---|---|
| **Executant technique (UNIQUE)** | Claude Code | VSCode Extension / CLI |
| **Auditeur / Project Manager** | Codex ou Gemini | VSCode IDE / Antigravity |
| **Radar corpus entier** | NotebookLM | Web |

**Regles inter-agents :**
- L'Auditeur donne le cap (Pourquoi, Quoi) et valide ; **Claude Code execute (Comment)**.
- **L'Auditeur n'ecrit AUCUN code de sa propre initiative** — seule exception : demande
  CLAIRE ET EXPLICITE de Joel. Mandat : `.agents/01_auditor_role.md`.
- Joel designe l'Auditeur du jour. Session « Duel » = plusieurs auditeurs en parallele,
  sans se voir (§5).
- `AGENTS.md` = FICHIER GENERE par `scripts/sync_agents_md.py` (mandat + ce fichier hors
  NOINJECT), auto-injecte au demarrage chez les auditeurs. NE JAMAIS l'editer a la main :
  editer la source **puis regenerer** (verrou : `tests/test_agents_md_freshness.py`).
<!-- NOINJECT -->
- Specifique Codex : `default_permissions=":read-only"` + `approval_policy="never"`
  (`.codex/config.toml`) = garde-fou par DEFAUT. **Joel seul** peut LEVER ce verrou,
  explicitement et par tache. Verrou non leve -> Codex ne lance aucune commande qui ecrit sur
  disque, demande les resultats a Claude, et audite en statique (lecture + git diff/log).
<!-- /NOINJECT -->

---

## 2. GOUVERNANCE & GIT

**Communication :** style Chef de Projet (impact utilisateur, pas de jargon dev).

**Collaboration avec Joel :**
- **Joel n'est PAS codeur** : langage simple, zero jargon, impact avant implementation ;
  questions ELI5 (AskUserQuestion).
- Une decision deja tranchee par Joel ne se **re-demande pas**.
<!-- NOINJECT -->
- Commandes longues -> ARRIERE-PLAN + ETA annonce, jamais de blocage silencieux.
<!-- /NOINJECT -->

**Autonomie :** branches feat/ autorisees sans validation ; **la branche par defaut du depot**
est interdite sans feu vert explicite.

**Discipline Git (non negociable) :**
- INTERDIT `git add .` **et `git add -A`** — **staging fichier par fichier**, toujours.
- Jamais de commit sans demande. Exception : sauvegarde bornee sur branche feat/ autorisee.
- **Une branche par LOT** (sous-lots A/B/C/D inclus, sur `feat/lotN-nom`).
- **Fusions** : TOUJOURS `git merge --no-ff` (preserve le graphe), UNE fois a la cloture du lot.
- **Sauvegarde** : tout fichier de gouvernance est suivi et inclus dans un commit.

---

## 3. DOCUMENTATION & SUIVI

**Lecture obligatoire en debut de chantier :** `RoadMap & Project Pipeline/ROADMAP.md` + spec
du lot actif.

**Fichiers de suivi (toujours a jour) :** `CURRENT_GOAL.md` (objectif actif) · `SHIP_LOG.md`
(livraisons : SHA/metriques/date) · `ROADMAP.md` (`[CLOTURE]` a chaque lot fini).

**Ouverture de chantier :** signal langage naturel ("on se lance/attaque/commence sur X"...) ->
proposer `/new-lot [N] [nom]` AVANT toute branche/code.

**Phase decouverte obligatoire (prerequis dur, AVANT la 1ere ligne feat) :** agent Explore avec
check-list ciblee sur les ressources existantes de la zone (`DOCTRINE_PRODUIT.md` §2).

**Nommage projet :** `NOM - 3 ou 4 mots`.

---

## 4. QUALITE & LIVRAISON (VALIDATION UNIFIÉE)

**Tests — zero echec tolere :** lot non clonable si la validation unifiée échoue.
- **Validation Unifiée** : Exécutée via `.\validate.bat` (ou `npm run check`). Elle enchaîne :
  1. `npx vitest run` (tests applicatifs JS en mode une passe sans watch).
  2. `pytest` (verrous de fraîcheur Python pour `AGENTS.md` et `PROJECT_MAP.md`).

**Seuils d'alerte archi (signaler) :** fichier > 1500 lignes · fonction > 150 lignes · modif
> 5 fichiers sans interface claire. (*Alerte sur `foodapp-v5-Joel.html`*).

**Preuves d'achevement :**
- INTERDIT de dire « fini/100%/clos » sans checklist des criteres posee AVANT.
- Protocole Handoff ZIP (`handoff/`) produit sur demande de Joel ou pour livrable externe.

---

## 5. AGENTS & SECURITE

**NIVEAUX D'AUDIT :** tout chantier = Claude Code + 1 auditeur ; seule l'INTENSITE varie.
- **Leger** (UX/polish/docs/texte) : auto-audit + relecture scope/diff/tests.
- **Standard** : audit spec court + UN audit sur le diff FINAL du lot.
- **Dur** : boucle PAR ETAPE + auto-trigger /ultra-audit (reserve aux zones sensibles de `DOCTRINE_PRODUIT.md` §3).
- **Duel** : mode comparatif activable a tout niveau.

**BOUCLE AUTONOME VIA LE PONT D'AUDIT (`scripts/audit_bridge.py`)** : la PAUSE par tour est levée si le pont est actif. PAUSE obligatoire en cas de désaccord sur un finding critique ou doute sur les données.

---

## 6. SINGLE SOURCE OF TRUTH (SSOT) & DRY

- **Regle absolue** : chaque parametre metier / config / etat a UNE seule representation canonique.
- **Verification proactive** : traquer la duplication par `grep` AVANT de coder.

---

## 7. DOCTRINE PRODUIT — LECTURE OBLIGATOIRE

**Tout ce qui est propre a CETTE application vit dans `DOCTRINE_PRODUIT.md`** : doctrines
metier de FoodApp, perimetre technique, zones sensibles, frontieres de test.
**AVANT toute analyse, specification, implementation ou decision d'audit touchant le produit,
LIRE `DOCTRINE_PRODUIT.md`**.
