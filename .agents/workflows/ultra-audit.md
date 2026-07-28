# /ultra-audit - Audit Parallèle Multi-Agents (100% Autonome)

Audit approfondi utilisant 6 agents parallèles locaux. 
Conçu pour être "token-efficient" et se concentrer sur l'**architecture, la stratégie et l'analyse statique**. 

> 💡 **Philosophie d'Indépendance** : Cet outil a été créé pour **remplacer** totalement les audits cloud payants. Il agit comme l'unique filet de sécurité du projet. Sa force réside dans sa rapidité, son contrôle total des tokens, et sa capacité à scruter le code sous 6 angles sans dépendre d'un service externe.

## 🎯 Étape 0 : Cible, Contexte & Vérification Git

Avant tout lancement, l'orchestrateur doit préparer le terrain :

1. 🧠 **Lecture de la Mémoire (Dream Layer + Blacklist)** : L'orchestrateur DOIT charger DEUX fichiers complémentaires (s'ils existent) :
   - `.claude/audit_memory.md` → **Faux positifs récurrents** : findings à filtrer SILENCIEUSEMENT du rapport (semantique : *"ignore ça, ce n'est pas un vrai problème dans ce projet"*).
   - `.claude/audit_blacklist.md` → **Trade-offs refusés en mémoire** : findings qui doivent rester VISIBLES dans le rapport mais qu'il est INTERDIT de proposer comme candidat audit_memory en Étape 4.5 (semantique : *"mentionne mais ne demande plus à archiver, l'utilisateur a déjà tranché"*).

   Les deux fichiers suivent le même format YAML (voir §"Formats" ci-dessous). Confondre les deux sémantiques = bug de protocole.

2. 🛡️ **Clause de Conscience Git** : L'orchestrateur DOIT exécuter `git branch --no-merged master` (ou la branche principale équivalente).
   - **Si la sortie est vide** : ne rien signaler. Les branches existantes sont des fossiles déjà intégrés, sans risque de faux positif. Ne pas mentionner leur existence.
   - **Si la sortie est non-vide** : lister UNIQUEMENT les branches non mergées et avertir l'utilisateur : *"Attention, ces N branches contiennent du travail non fusionné dans master : [liste]. Si elles incluent des correctifs en cours, cet audit risque de signaler à tort des bugs déjà résolus ailleurs. Veux-tu cibler une de ces branches plutôt que master ?"*
   - **Interdit** : juger qualitativement « il semble y avoir des branches sœurs ». La condition est binaire et vérifiable par commande Git.

3. 🗺️ **Consultation de la Roadmap (Anti-doublon — ÉTAPE BLOQUANTE)** : L'orchestrateur DOIT lister les fichiers de `RoadMap & Project Pipeline/*.md` (hors `[CLÔTURÉ]`) et lire au minimum :
   - `ROADMAP.md` (vue d'ensemble des chantiers en cours et du backlog)
   - Tout fichier dont le nom est cité dans les sections "EN COURS", "PROCHAIN HAUTE PRIORITÉ" et "BACKLOG MOYEN TERME"

   **🔒 Vérification matérialisée (anti-shortcut)** : avant de pouvoir invoquer l'outil `Agent` (Étape 1), l'orchestrateur DOIT explicitement écrire dans son raisonnement (thought/TodoWrite/log) la liste **complète et nommée** des chantiers actifs lus, avec une ligne par chantier. Format obligatoire :
   ```
   📋 Chantiers actifs consultés (Étape 0.3) :
   - SPLIT REPORT_CONTEXT — Décomposition God Object (Backlog HAUTE)
   - HTTP_RESILIENCE — Pooling et Retry (Backlog MOYEN)
   - [autres...]
   ```
   Sans ce listing visible, **l'invocation des agents en Étape 1 est interdite** (l'utilisateur peut interrompre l'audit).

   **Règle stricte** : si un finding identifié pendant l'audit correspond à un chantier déjà spécifié dans la roadmap, l'orchestrateur ne le re-spécifie PAS dans le rapport. Il le mentionne par référence : *"Voir spec existante `[NOM_CHANTIER].md`. Le diagnostic est-il toujours valide ? Faut-il prioriser ?"*. Cela évite que l'audit redécouvre tous les 3 mois ce qui est déjà tracé.

4. 📏 **Garde-fou "Diff trop gros"** : Avant de demander la cible, l'orchestrateur exécute `git diff --stat <base>..HEAD` (selon le mode envisagé). Si le diff dépasse **2000 lignes** OU **30 fichiers**, il DOIT proposer un découpage avant tout déploiement d'agents :
   > *"Le diff est massif (X lignes / Y fichiers). Auditer en bloc dégraderait la qualité ET brûlerait le budget tokens. Veux-tu cibler : (a) `modules/` uniquement, (b) `templates/` + `static/` uniquement, (c) ce qui a changé depuis le dernier merge mergé sur master, (d) tout d'un coup en assumant la perte de qualité ?"*
   Si l'utilisateur choisit (d), procéder mais logger un avertissement dans le rapport final.

5. 🎯 **Choix de la cible** : Demander à l'utilisateur : **Voulez-vous cibler le dernier diff ou tout le projet ?**
   - **Mode Laser (recommandé)** : Analyser uniquement le diff par rapport à main (`git diff HEAD~1` ou `git diff --cached`). **Si le diff est vide, l'orchestrateur refuse de lancer l'audit (pas de matière, pas de revue).**
   - **Mode Full Scan** : Analyser l'ensemble des dossiers applicatifs (`modules/`, `templates/`, `app.py`, `tests/`).

## 🩺 Étape 1.0 : Dry-run technique (CONDITIONNEL — MCP externe uniquement)

**Cette étape ne s'applique QUE si l'orchestrateur s'exécute via un MCP externe** (ex: Antigravity → `mcp_claude-worker_Agent`, ou tout pont API tiers). Si l'orchestrateur tourne en environnement natif (Claude Code direct, sans pont MCP), **sauter cette étape légitimement** : son outil `Agent` interne est intégré, fiable, et un dry-run serait pure surcharge tokens.

**Si MCP externe** :
1. Émettre un appel `Agent` ultra-léger : `subagent_type=Explore` + prompt `"Réponds 'OK'. Aucun fichier à lire."`.
2. Si la réponse arrive en <10s avec `"OK"` (ou équivalent) → tunnel MCP fonctionnel, passer à l'Étape 1.
3. Si timeout, erreur, ou silence → **basculer en mode dégradé EXPLICITE** : l'orchestrateur prévient l'utilisateur :
   > *"⚠️ MCP claude-worker indisponible (modèle Flash ? quota ? réseau ?). Je bascule en mode single-agent (audit simulé manuellement). La diversité multi-lentilles n'est pas garantie. Continuer ou attendre ?"*
4. **Interdit** de prétendre déployer 6 agents si le dry-run a échoué : tout rapport produit en mode dégradé DOIT inclure cette mention en disclaimer du livrable.

## 🤖 Étape 1 : Déploiement des 6 Agents (En parallèle)

Lancer DANS UN SEUL MESSAGE (via l'outil `Agent` natif en environnement Claude Code, ou via MCP `mcp_claude-worker_Agent` en environnement Antigravity) les 6 agents de type `Explore` sur la cible choisie, avec ces lentilles précises.

> 📋 **RÈGLE DE FORMAT STRICT (OBLIGATOIRE — NON-NÉGOCIABLE)** : 2 variantes selon la nature du finding. **Toute prose libre hors de ces formats est ignorée par l'orchestrateur** — pas de tolérance, pas d'exception. La discipline du format est ce qui rend l'audit machine-checkable et auditable a posteriori.
>
> **Variante A — Format comportemental** (bugs / sécurité / perf — un symptôme à reproduire) :
> ```
> [Fichier | Ligne | Scénario d'échec | Attendu | Observé | Confiance: NN/100]
> ```
>
> **Variante B — Format structurel** (archi / style / tests — une règle violée, pas un crash) :
> ```
> [Fichier | Ligne | Règle violée | Mesure observée | Seuil/cible | Confiance: NN/100]
> ```
>
> **Règles d'utilisation** :
> - Les agents choisissent la variante la plus appropriée par finding (pas globalement).
> - **`Confiance` est un entier 0-100**, pas un mot vague ("haute", "modérée"). 0 = totalement spéculatif, 100 = prouvé sans ambiguïté possible.
> - **Confiance < 50 → finding non remonté** (l'agent doit s'auto-filtrer ; sinon l'orchestrateur le filtre en Étape 3).
> - Confiance 50-69 = signal faible (irait en section "Signaux faibles").
> - Confiance 70-89 = finding standard (irait en section principale après Verifier).
> - Confiance 90-100 = finding solide (généralement REPRODUCED ou TRACED après Étape 2).
> - **Champ optionnel `files_examined: [path1, path2, ...]`** en sortie de chaque agent — utile pour cross-check coverage si l'orchestrateur tourne en MCP externe (Gemini Flash a tendance à halluciner sa couverture). En Claude Code natif, ce champ est facultatif.

### Lentilles d'analyse

1. 🏛️ **Agent Qualité, Architecture & Style** *(privilégie variante B)*
> Audite l'architecture et la cohérence. Cherche si le changement réinvente une abstraction existante, s'il viole la direction des dépendances, ou s'il introduit une seconde source de vérité. Vérifie le respect du fichier `CLAUDE.md` et des conventions de nommage du projet.

2. 🐛 **Agent Correction Logique & Bugs** *(privilégie variante A)*
> Audite la robustesse de manière isolée. Traque les erreurs de raisonnement, les conditions inversées, les erreurs "off-by-one", les cas limites non gérés, les race conditions, et les chemins null/undefined non protégés.

3. 🔒 **Agent Sécurité (OWASP)** *(privilégie variante A)*
> Audite les vulnérabilités. Cherche les injections SQL (f-strings), les failles XSS/CSRF dans Jinja, la mauvaise gestion de clés API/secrets, la validation des inputs et les configurations potentiellement dangereuses.

4. 🧪 **Agent Audit des Tests** *(privilégie variante B)*
> Évalue la couverture et la qualité (`tests/`). Vérifie si les "happy paths" ET les modes de défaillance sont testés. Traque les tests dont le nom promet une chose mais qui en testent une autre, ainsi que les "flaky tests".

5. ⚡ **Agent Performance & Optimisation** *(privilégie variante A)*
> Audite l'efficience. Scanne les patterns coûteux : requêtes N+1, boucles imbriquées linéarisables, appels bloquants là où l'async serait approprié, et lectures non paginées sur des collections non bornées.

6. 🎨 **Agent UX/UI & Accessibilité (Mode Éclaireur)** *(format spécial : Suspect Visual Checklist)*
> Lit le code HTML/CSS. Vérifie la sémantique, la cohérence du design system (ex: Glassmorphism), l'accessibilité. **CRITIQUE** : Ne prend pas d'initiative de vision. Crée uniquement une "Suspect Visual Checklist" des zones de code qui pourraient mal s'afficher (flex-wrap douteux, modales superposées) pour une vérification humaine ultérieure.

## 🛡️ Étape 2 : Verifier Stratifié (Post-Collecte)

> *Cette étape s'exécute APRÈS que les agents ont rendu leurs findings. Causalité claire : pas de qualification avant collecte.*

L'orchestrateur agit comme un Verifier implacable. **Il ne signale pas, il qualifie.** Chaque finding reçoit l'un des **5 statuts formels** ci-dessous, qui remplacent le binaire "P0/P1 ou ignoré" de la v3.

### Règle d'or : *"Tu observes, tu ne patches pas"*

Le Verifier ne modifie JAMAIS le code source. Si la reproduction d'un bug nécessite une modification du code, ou une opération destructive, ou un accès réseau externe → STOP, statut `HYPOTHESIS` avec note "verification-impossible-without-mutation".

### Les 5 statuts

| Statut | Définition | Preuve attendue |
|---|---|---|
| **REPRODUCED** | Bug prouvé par exécution concrète | Commande exacte + input + output verbatim |
| **TRACED** | Bug prouvé par lecture de code (chaîne d'appel complète, du caller jusqu'au crash) | Liste ordonnée des fichiers:lignes traversés |
| **HYPOTHESIS** | Pattern reconnu, plausible, mais non démontré | Référence au pattern + scénario hypothétique |
| **REFUTED** | Faux positif prouvé (chaîne cassée, code en réalité paramétré, valeur en réalité bornée) | Justification écrite du pourquoi |
| **ROADMAP_REF** | Finding pointe un chantier déjà spec'é dans la roadmap | Nom du fichier `RoadMap & Project Pipeline/[NOM].md` |

### Capture verbatim obligatoire pour REPRODUCED

Tout finding qualifié REPRODUCED **DOIT** inclure :
- **Commande** exacte qui a déclenché la preuve (`pytest tests/...::test_X`, `grep -nE 'pattern' file.py`, `python -c "..."`).
- **Input** précis (paramètres, fixtures, état initial).
- **Output verbatim** : la sortie réelle observée, pas une paraphrase.

Format obligatoire dans le rapport :
```
Statut : REPRODUCED
Commande : pytest tests/test_arbiter.py::test_runtime_error_on_mismatch -v
Input    : douane_log={"final_immediate_orders":0,...}, is_action=True (mock)
Output   : RuntimeError: [ARBITER] Incohérence is_action pour mode=IMMEDIATE_ORDERS_VALIDATED ...
```

**Pas de capture verbatim → pas de REPRODUCED**, downgrade automatique en TRACED ou HYPOTHESIS.

### Effort proportionnel à la sévérité claim

Le Verifier ne dépense pas le même effort sur tous les findings. Tableau de référence :

| Sévérité claim agent | Effort attendu | Statut cible | Si échec de tentative |
|---|---|---|---|
| **Critical** | Tenter REPRODUCED, sinon TRACED | REPRODUCED(critical) ou TRACED(critical) | HYPOTHESIS(medium) — downgrade |
| **High** | Tenter REPRODUCED, sinon TRACED | REPRODUCED(high) ou TRACED(high) | HYPOTHESIS(medium) — downgrade |
| **Medium** | Tenter TRACED minimum | TRACED(medium) | HYPOTHESIS(low) — downgrade |
| **Low** | HYPOTHESIS direct (pas de tentative coûteuse) | HYPOTHESIS(low) | REFUTED si pattern absent du code |

**Conséquence** : les findings critical/high reçoivent l'effort de qualification maximal (REPRODUCED prouvé ou TRACED prouvé) ; les findings low sont expédiés rapidement en HYPOTHESIS sans mobiliser de tokens. Le budget se concentre sur le signal, pas sur le bruit.

### Croisements systématiques (filtrage avant qualification)

Avant de qualifier un finding, le Verifier le croise avec :
1. **`.claude/audit_memory.md`** (Dream Layer) : si pattern matche → finding **retiré silencieusement** du flux (jamais qualifié, jamais affiché).
2. **`.claude/audit_blacklist.md`** : si pattern matche → finding **conservé visible** dans le rapport mais marqué pour ne PAS être proposé en archivage en Étape 4.5.
3. **Roadmap chargée en Étape 0.3** : si finding correspond à un chantier déjà spec'é → statut **ROADMAP_REF** avec mention `Voir spec [NOM_CHANTIER].md`. Pas de re-spécification.

### Philosophie

> *"Tu ne reproduis pas tout le code, tu forces la chaîne d'inférence à descendre du général au spécifique. Capturer verbatim ce qui est REPRODUCED + nommer précisément ce qui est seulement HYPOTHESIS = 95% du bénéfice d'un vrai verifier industriel pour 20% du coût."*

## 🧠 Étape 3 : Synthèse Intelligente (Orchestrateur)

À la réception des rapports structurés ET après le filtre inférentiel, l'orchestrateur applique cette logique :

- **Filtrage par confiance** : tout finding avec confiance < 50% est listé en "signal faible" sans escalade P0/P1.

- **Consensus = Corroboration vs Répétition** : Si 2 agents pointent la même ligne, l'orchestrateur doit analyser :
  - **Vrai consensus** (= corroboration) : agents apportent des perspectives différentes (ex: Perf voit un N+1 + Archi voit une couche violée sur la même ligne) → escalade légitime en P0.
  - **Faux consensus** (= répétition) : 2+ agents répètent le même pattern reconnu (ex: 3 agents qui voient "assert en prod") → 1 seul finding compte.

- **Mise en exergue des Désaccords** : Si l'Agent Archi aime une solution mais l'Agent Perf la trouve trop lente, l'exposer explicitement pour que l'utilisateur puisse trancher le compromis.

- **Commentaire Architectural Global** : Formuler un avis "macro" sur l'impact de ces changements sur la philosophie de code du projet.

## 📝 Étape 4 : Le Livrable (`ULTRA_AUDIT_REPORT.md`)

> 🔒 **RÈGLE D'OR — ÉCRITURE DISQUE AVANT CHAT** : Le rapport DOIT être écrit sur disque dans `ULTRA_AUDIT_REPORT.md` (via `Write` ou équivalent) **AVANT** toute réponse résumée à l'utilisateur dans le chat. Un audit qui ne vit qu'en chat n'est pas un livrable — c'est une conversation. Si l'orchestrateur répond à l'utilisateur sans avoir écrit le fichier, le protocole est violé. Vérification : `ULTRA_AUDIT_REPORT.md` doit avoir un timestamp postérieur à l'invocation de la commande.

Générer ou mettre à jour le fichier de rapport avec cette structure stricte. Le format prose ci-dessous est **dérivé** du format strict des agents (Étape 1) — l'orchestrateur reformule en prose lisible sans changer les faits.

```markdown
# 🚀 ULTRA-AUDIT REPORT - [Date]
**Cible** : [Diff récent | Projet complet]

> 💡 **Disclaimer** : Ce rapport est une checklist pour raisonner, pas une todo-list obligatoire. Il contient des faux positifs inhérents à l'analyse statique. Les agents valident la cohérence du code, pas la correction de votre logique métier.

## 🏗️ Commentaire Architectural Global
[Analyse macro du changement ou de l'état du projet - Ex: "Ce diff introduit X nouvelles responsabilités alors que Y le fait déjà". Permet de voir la "Big Picture".]

## ⚡ Findings par Consensus (Priorité Haute)
[Findings qualifiés REPRODUCED ou TRACED par le Verifier. Le bruit est réduit par le consensus VRAI (corroboration de perspectives différentes) + la qualification stratifiée.]
- **[Sévérité] `fichier.py:lignes`** | Statut: **REPRODUCED** ou **TRACED** | (Signalé par: Agent A + Agent B | Confiance moyenne: XX/100)
  - **Verdict** : Ce qui ne va pas (concrètement).
  - **Pourquoi** : Le risque ou problème réel engendré.
  - **Preuve (REPRODUCED)** : Commande exacte + Input + Output verbatim. *OU*
  - **Chaîne d'inférence (TRACED)** : Caller → callee → symptôme avec fichiers:lignes traversés.
  - **Résolution** : Piste concrète ou snippet de correction.

## 🟡 Hypothèses & Signaux Faibles
[Findings qualifiés HYPOTHESIS par le Verifier (pattern reconnu, plausible, non démontré) + findings d'un seul agent + confiance <70 + désaccords inter-agents. L'utilisateur doit trancher.]
- **[Sévérité] `fichier.py:lignes`** | Statut: **HYPOTHESIS** | Confiance: XX/100
  - **Pattern reconnu** : Description du pattern et pourquoi il est plausible.
  - **Scénario hypothétique** : Comment le bug pourrait se déclencher (non prouvé).

## 🗺️ Findings référencés à la Roadmap (ROADMAP_REF)
[Findings dont le diagnostic est déjà tracé dans un chantier de la roadmap. Pas de re-spécification.]
- **`fichier.py:lignes`** | Statut: **ROADMAP_REF** | Voir spec : `RoadMap & Project Pipeline/[NOM_CHANTIER].md`
  - **Diagnostic toujours valide ?** [Question implicite à l'utilisateur.]

## 👀 Vérifications Visuelles Recommandées (Suspect Checklist)
[Liste des zones HTML/CSS suspectes signalées par l'Agent UX/UI. L'utilisateur peut choisir de fournir une capture d'écran pour une analyse visuelle de ces points précis (Économie de tokens).]

## 🚫 Findings réfutés ou écartés par le Verifier
[Findings qualifiés REFUTED ou retirés par croisement memory/blacklist. Transparence totale + candidats à `audit_memory.md` ou `audit_blacklist.md` (Étape 5).]
- `fichier.py:ligne` — [agent qui a signalé] — Statut: **REFUTED** | Raison : [chaîne d'inférence prouvée cassée / valeur en réalité bornée / déjà dans audit_memory / etc.].
```

## 🤝 Étape 4.5 : Validation utilisateur des rétrogradations

Avant de mettre à jour la mémoire (Étape 5), l'orchestrateur **propose à l'utilisateur** la liste des findings rétrogradés par le Verifier Stratifié ET candidats à intégrer dans `audit_memory.md`.

**🚫 Filtrage anti-insistance via blacklist** : avant toute proposition, l'orchestrateur croise chaque candidat avec `.claude/audit_blacklist.md` (chargé en Étape 0.1). Si le pattern matche une entrée blacklistée, le candidat est **automatiquement écarté** de la liste de propositions — l'utilisateur a déjà tranché par le passé, on n'insiste pas. Ces candidats blacklistés sont juste mentionnés dans la section "Findings rétrogradés" du rapport pour transparence.

Format de la question utilisateur (uniquement pour candidats NON-blacklistés) :

> *"Le Verifier a rétrogradé/écarté ces N findings. Voici les rétrogradations qui mériteraient d'être mémorisées comme faux positifs récurrents (les patterns blacklistés ont déjà été écartés automatiquement) :*
> *1. [pattern] — raison : [...]. Confirmer ?*
> *2. [pattern] — raison : [...]. Confirmer ?*
> *Réponds 'oui pour 1,2' ou 'aucun' ou détaille."*

**Aucune écriture dans `audit_memory.md` sans confirmation explicite de l'utilisateur.** C'est ce qui empêche la mémoire de se remplir de fausses certitudes auto-générées.

**Ajout d'une entrée à la blacklist** : si l'utilisateur répond *"non, et arrête de me proposer ce pattern"* (ou équivalent — refus avec demande explicite d'arrêt), l'orchestrateur ajoute le pattern à `.claude/audit_blacklist.md` (avec confirmation explicite avant écriture, comme pour audit_memory).

## 📚 Étape 5 : Mise à jour de la Mémoire (Dream Layer + Blacklist)

À la fin de l'audit, **et seulement après confirmation utilisateur (Étape 4.5)**, l'orchestrateur met à jour les fichiers concernés.

### Formats

#### `.claude/audit_memory.md` — Dream Layer (filtrage silencieux)

Format YAML strict :
```yaml
# .claude/audit_memory.md
# Catalogue des faux positifs récurrents validés par l'utilisateur.
# Sémantique : "ignore ce pattern, ce n'est pas un vrai problème dans CE projet".
# Chaque entrée DOIT être révisée tous les 6 mois (champ last_validated).

- pattern: "Description courte du finding récurrent (ex: '.env exposé')"
  rule: "Pourquoi ce n'est pas un vrai problème dans CE projet"
  scope: "fichier.py ou modules/* — où la règle s'applique"
  agent: security  # security | bugs | archi | tests | perf | ux
  date_added: 2026-05-05
  last_validated: 2026-05-05
  validated_by: "joel.monin"  # ou audit_run_id
```

#### `.claude/audit_blacklist.md` — Anti-insistance (mention OK, archivage refusé)

Format YAML strict (même structure que audit_memory mais sémantique différente) :
```yaml
# .claude/audit_blacklist.md
# Patterns que l'utilisateur a explicitement REFUSÉ de mémoriser.
# Sémantique : "ce trade-off doit RESTER VISIBLE à chaque audit, ne le propose
# plus comme candidat audit_memory en Étape 4.5".
# Différent du Dream Layer : ici on ne filtre PAS le finding, on bloque
# seulement la proposition d'archivage.

- pattern: "Description du trade-off contextuel (ex: 'CSRF absent en host=127.0.0.1')"
  reason: "Pourquoi l'utilisateur veut le voir à chaque audit (ex: 'Critique si publié hors local')"
  refused_at: 2026-05-06
  refused_runs: 3   # nombre de fois où le pattern a été refusé avant ajout à la blacklist
  refused_by: "joel.monin"
```

### Règles d'hygiène (communes aux 2 fichiers)

- **Expiration** : si `last_validated` (memory) > 6 mois OU `refused_at` (blacklist) > 12 mois, l'entrée doit être re-confirmée par l'utilisateur au prochain audit.
- **Pas plus de 50 entrées par fichier** : au-delà, c'est probablement le signe d'agents trop bavards. Préférer corriger les prompts agents.
- **Jamais d'entrée auto-écrite sans Étape 4.5** : aucun pattern ne va en mémoire ou en blacklist sans confirmation humaine.
- **Format YAML strict** : pas de prose libre dans les fichiers (les agents les parsent).
- **Sémantiques distinctes** : ne JAMAIS fusionner les 2 fichiers. `audit_memory` filtre silencieusement, `audit_blacklist` empêche seulement l'insistance — un finding peut donc apparaître dans le rapport même s'il est blacklisté.

---

## ✅ Checklist de Gouvernance (Standard pour un Lot)
- [ ] **Cadrage** : Lancement de `/ultra-audit` (Mode Full Scan) pour identifier les risques architecturaux avant de commencer à coder.
- [ ] **Développement** : Forge de la feature sur une branche isolée (`feat/`).
- [ ] **Validation** : Lancement de `/ultra-audit` (Mode Laser sur le diff) comme filet de sécurité final avant le merge.
- [ ] **Correction** : Résolution des P0/P1 remontés par la synthèse de l'audit.
- [ ] **Documentation** : Mise à jour du `ROADMAP.md` et `SHIP_LOG.md`.
- [ ] **Déploiement** : Autorisation humaine explicite avant le merge sur `main`.